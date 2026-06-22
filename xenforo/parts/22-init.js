    // =========================================================
    // INIT: processAll() roda TODAS as features · scheduleRun (coalesce rAF do observer) ·
    //       detectPageClasses (smg-sc/smg-smg/home/threadlist/thread) · boot() + MutationObserver.
    //       ⇒ processAll roda quase TODO frame: cada pass tem que sair barato (REGRA DE OURO, ver topo).
    // =========================================================
    function processAll(roots) {
        if (smgDisabled) return;   // kill-switch global (gmSet('smg-off','1') p/ desligar tudo)

        if (FEATURES.customFavicon) safe(setFavicon);

        if (FEATURES.autoFullImages) safe(unlazyImageLinks, roots);   // jpg6.su/jpg5 & afins: materializa a img do noscript (ou mostra o link) ANTES do processImages/masonry
        if (FEATURES.autoFullImages) safe(processImages, roots);
        if (FEATURES.imageLightbox) safe(setupImageClickFeed);
        if (FEATURES.unwrapLinks) safe(unwrapRedirectLinks, roots);   // PRIMEIRO: revela a URL real (goto/redirect) p/ os embeds verem o link verdadeiro
        if (FEATURES.fileHostCards) safe(processFileHostCards, roots);   // CEDO (logo após o unwrap): card de file-host (pixeldrain/bunkr/gofile/…) já aparece com skeleton, sem esperar o pipeline de imagens; ANTES do groupLinks
        if (FEATURES.turboEmbeds) safe(processTurboLinks, roots);
        if (FEATURES.turboEmbeds) safe(processTurboNativeEmbeds, roots);   // Simp: turbo nativo (iframe) → nosso player
        if (FEATURES.saintEmbeds) safe(processSaintLinks, roots);
        if (FEATURES.imagepondEmbeds) safe(processImagepondNativeEmbeds, roots);   // SMG: imagepond nativo (iframe) → nosso player
        if (FEATURES.directMedia) safe(processFileditchLinks, roots);   // Fileditch: página-viewer → resolve o <source> temp → nosso player (ANTES do directMedia, que não toca file.php)
        if (FEATURES.directMedia) safe(processDirectMedia, roots);
        if (FEATURES.groupLinks) safe(groupPostLinks, roots);
        if (FEATURES.revealLikedPosts) safe(revealLikedPosts, roots);
        if (FEATURES.redgifsPlayer) safe(applyRedgifsPlayer, roots);   // ANTES do autoLoad: reivindica os loaders e troca o iframe por <video> (à prova de falha)
        if (FEATURES.autoLoadRedgifs) safe(autoLoadRedgifs, roots);
        safe(markG2wWrappers, roots);   // marca .smg-has-g2w no wrapper-pai dos embeds → CSS casa classe estática em vez do :has(.generic2wide-iframe-div)
        if (FEATURES.autoExpandSpoilers) safe(autoExpandSpoilers, roots);
        // POR ÚLTIMO: agrupa imagens+vídeos/embeds no masonry do post, DEPOIS de redgifs/spoilers/reveal materializarem a mídia (não move o placeholder do redgifs antes do autoload clicar)
        if (FEATURES.autoFullImages) safe(buildPostGalleries, roots);
        if (FEATURES.sidebarNavigation) safe(setupPostNavigation);
        if (FEATURES.autoSearchTitleOnly) safe(enableSearchTitlesOnly);
        safe(buildSearchResultsPanel);   // página de resultados da busca: input + filtros inline no header (1×, guard interno)
        if (FEATURES.keyboardShortcuts) safe(setupKeyboardShortcuts);

        safe(markThreadGridContainer, roots);
        safe(markCategoryNodeBlocks, roots);   // classe estática no lugar do .block--category:has(.node)
        if (FEATURES.thumbPlaceholders) safe(markGridPlaceholders, roots);
        safe(styleArticleCards);   // article view: monta o .smg-article-grid ANTES do infinite scroll
        if (FEATURES.infiniteScroll) safe(setupInfiniteScroll);
        if (cls.contains('smg-home') && !cls.contains('smg-watched-feed')) {   // as passes de home SÓ rodam com smg-home (pula thread/lista) — e NÃO no modo feed (a home está escondida; rodar o remake só ressuscitaria nós escondidos)
            safe(markHomeAdBlocks);   // classe estática no lugar do :has() de bloco-de-anúncio
            safe(relocateSimpcityNodes);
            safe(mergeSmallHomeSections);
            safe(expandSubForums);
            safe(relocateSmgNodes);
            safe(splitTransSection);
            safe(sortHomeCards);
            safe(reorderHomeSections);
            safe(makeHomeCardsClickable);
            safe(layoutHomeSidebar);
        }
        safe(buildFilterBars);       // barra única segmentada nos 2 sites (substitui o .block-outer nativo)
        safe(buildThreadHeader);     // .p-body-header da thread: ações (feed/galeria/download) + tira autor/data
        safe(buildPostCards, roots); // posts → card estilo Reddit (header + conteúdo + action bar); escopado, 1×/post
        safe(buildCommentCards, roots); // comentários (uw_fcs/SMG) → mesmo modelo, indentados; escopado, 1×/comentário
        safe(buildCommentBar, roots);   // header dos comentários: label "Sort:" + "Previous comments" → "Load more"
        safe(restoreNavMode);        // F5 com ?view=gallery|feed (+ ?order=) → reabre o modo (1x)
        if (FEATURES.bookmarksFeed) safe(setupBookmarksFeed);   // /account/bookmarks: toggle Lista↔Feed (posts salvos como river)
        if (FEATURES.hoverPreview) safe(setupThumbPreview);
        safe(setupSourceWatermark);  // marca dágua da fonte no hover de cada mídia (1× bound)

        if (FEATURES.topBar) safe(buildTopbar);
        if (FEATURES.headerNotices) safe(setupHeaderNotices);   // avisos da página recolhidos num iconezinho
        safe(watchNativeBadges);   // mantém os badges (alertas) da topbar/dock em sincronia com o XF, ao vivo

        // reaplica o filtro de autor em posts recém-carregados (scroll infinito)
        if (authorFilter) safe(applyAuthorFilter);
    }

    // O observer dispara em QUALQUER mutação do DOM. Como o próprio processAll
    // muta o DOM, sem coalescer ele se re-dispara num flood de microtasks que
    // não cede pro render e trava a aba. Solução: no máximo 1 execução por frame.
    // Coleta os subtrees ADICIONADOS → os passes de conteúdo varrem só eles (scope), não o documento
    // inteiro a cada frame. A cada FULL_SCAN_EVERY runs (ou quando não houve adição) faz 1 full-scan de
    // segurança — pega nós que o scope não enxergou (ex.: match por atributo que mudou depois).
    let scheduled = false, dirtyRoots = new Set(), runCount = 0, fullPending = false, fullT = 0;
    const FULL_SCAN_EVERY = 20;   // PERF: full-scan (todos os passes no body inteiro) a cada 20 runs em vez de 10 — os passes escopados já pegam tudo que é ADICIONADO; o full-scan é só backstop p/ match por atributo (raro), então 20 frames de atraso é imperceptível e corta o custo pela metade

    function scheduleRun(mutations) {
        if (mutations) for (const m of mutations) for (const n of m.addedNodes) if (n.nodeType === 1) dirtyRoots.add(n);
        if (scheduled) return;
        scheduled = true;

        requestAnimationFrame(() => {
            scheduled = false;
            const full = (++runCount % FULL_SCAN_EVERY === 0) || fullPending;
            // frame SEM nó adicionado (remoção pura — spinner/freeze do feed — ou troca de text node):
            // não há nada novo pra processar; o full-scan imediato aqui varria o body INTEIRO a cada
            // tick (ex.: scroll no feed congelando cards = vários full-scans/s). Backstop preservado:
            // agenda UM full-scan coalescido (máx 1 a cada ~600ms) p/ os casos raros de match por atributo.
            if (!full && !dirtyRoots.size) {
                if (!fullT) fullT = setTimeout(() => { fullT = 0; fullPending = true; scheduleRun(); }, 600);
                return;
            }
            fullPending = false;
            const roots = full ? [document.body] : [...dirtyRoots];
            dirtyRoots = new Set();
            processAll(roots);
        });
    }

    if (smgDisabled) return;   // kill-switch: não injeta CSS nem roda nada

    const cls = document.documentElement.classList;

    // detecta as classes de página (smg-home/thread/threadlist/tv-grid). Roda 2x: cedo (URL+
    // data-template, no document-start) e de novo no DOM-ready (aí o .structItem--thread já existe).
    function detectPageClasses() {
        const tpl = document.documentElement.getAttribute('data-template') || '';
        const path = location.pathname;
        if (tpl === 'forum_list') { cls.add('smg-home-page'); if (FEATURES.homeRemake) cls.add('smg-home'); }  // smg-home (remake) gated; smg-home-page sempre (marcador)
        if (tpl === 'thread_view' || /\/threads\//.test(path)) cls.add('smg-thread');
        const isList = !!document.querySelector('.structItem--thread')
            || /\/whats-new(\/|$)/i.test(path) || /\/forums\/[^/]+/i.test(path)   // qualquer página de fórum (mesmo só com sub-fóruns)
            || tpl === 'search_results' || tpl === 'forum_view';
        if (isList) cls.add('smg-threadlist');
        if (tpl === 'search_results') cls.add('smg-search-page');   // página de resultados: painel inline + lista re-tematizada (CSS)
        if (tpl === 'search_form') cls.add('smg-search-form');      // form de busca avançada: re-tematizado (CSS; widgets do XF intactos)
        if (cls.contains('smg-threadlist') && gmGet('smg-threadview', 'grid') === 'grid') cls.add('smg-tv-grid');
        // página com menu lateral legítimo (conta/settings) → flag estática p/ o CSS (substitui o
        // :not(:has(.p-body-sideNav)) ancorado no .p-body-main, que re-validava a cada mutação da thread)
        if (/^account/i.test(tpl) || document.querySelector('.p-body-sideNav')) cls.add('smg-has-sidenav');
    }

    // ===== FASE 1 (document-start): tematiza ANTES da 1ª pintura → mata o flash do site antigo =====
    cls.add(/socialmediagirls/i.test(location.hostname) ? 'smg-smg' : 'smg-sc');  // site
    if (feedViewWanted()) cls.add('smg-watched-feed');   // feed ligado (home ?view=feed) → CSS esconde o conteúdo nativo JÁ, sem flash (smg-watched-feed = "feed on")
    if (FEATURES.autoFullImages) cls.add('smg-masonry-on');   // "Galeria" (full-res + masonry por post) — masonry atrelado à galeria
    if (FEATURES.unwrapLinks) { bindProxyClick(); handleRedirectPage(); }   // liga o intercept de clique JÁ no document-start (antes do XF) + pula página de aviso
    detectPageClasses();                                  // 1ª passada (o que dá pra saber sem o DOM)
    injectStyles();                                       // CSS já vale enquanto o HTML é parseado
    if (FEATURES.topBar) cls.add('smg-topbar-on');        // esconde o header nativo já (reserva o espaço)

    // DEEP-LINK (notificação/permalink → #post-X): ao cair fundo na thread, o conteúdo ACIMA (imagens/embeds/masonry)
    // carrega depois e EMPURRAVA pra baixo o post que você está vendo (ele era o último a assentar). Aqui:
    //   (1) processa o post-alvo PRIMEIRO → a mídia dele monta antes do scan completo do body;
    //   (2) scroll-anchor MANUAL: a cada reflow contra-rola a diferença (ANTES do paint, via ResizeObserver) pra ele
    //       ficar PARADO. Embeds já são lazy (turboIO), então o de cima nem baixa vídeo.
    //   JANELA ADAPTATIVA: segura enquanto AINDA HOUVER reflow (thread pesada assenta devagar — fixo 6s soltava no meio),
    //       2s sem nenhum mexido → solta; teto absoluto 30s. SOLTA na 1ª rolagem REAL do usuário (wheel/seta/PageUp-Down/
    //       Home-End/Space ou touchMOVE) — NÃO num toque solto (touchstart sozinho desancorava no mobile a cada tap).
    function pinDeepLinkPost() {
        const h = (location.hash || '').replace(/^#/, '');
        if (!h || !/^(?:js-)?(?:post|comment|post-comment)-\d+$/.test(h)) return;
        const el = document.getElementById(h) || document.querySelector('[data-content="' + h.replace(/^js-/, '') + '"]');
        const target = el && (el.closest('article.message, .message--post, .comment, .message-responseRow') || el);
        if (!target) return;
        safe(processAll, [target]);   // a mídia do post VISÍVEL monta antes do scan completo
        if (typeof ResizeObserver === 'undefined') return;
        let done = false, iv = 0, idle = 0, cap = 0, want = 0;
        const RELEASE = ['wheel', 'touchmove', 'keydown'];
        const SCROLL_KEYS = { ArrowUp: 1, ArrowDown: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1, ' ': 1, Spacebar: 1 };
        const stop = () => { if (done) return; done = true; ro.disconnect(); if (iv) clearInterval(iv); if (idle) clearTimeout(idle); if (cap) clearTimeout(cap); RELEASE.forEach(ev => window.removeEventListener(ev, onUser)); };
        const bump = () => { if (done) return; if (idle) clearTimeout(idle); idle = setTimeout(stop, 2000); };   // renova a janela a cada reflow; 2s parado → solta
        const keep = () => { if (done || !target.isConnected) return; const d = target.getBoundingClientRect().top - want; if (d > 0.5 || d < -0.5) { window.scrollBy(0, d); bump(); } };   // reflow ACIMA moveu o alvo → contra-rola + renova
        const onUser = e => { if (e.type === 'keydown' && !SCROLL_KEYS[e.key]) return; stop(); };   // só gesto de ROLAGEM solta (tecla normal/tap não)
        const ro = new ResizeObserver(keep);
        try { target.scrollIntoView(); } catch (e) {}   // posiciona via scroll-margin-top (abaixo da topbar)
        want = target.getBoundingClientRect().top;       // âncora = posição logo após o scroll
        ro.observe(document.body);
        iv = setInterval(keep, 100);
        cap = setTimeout(stop, 30000);                    // teto absoluto
        bump();                                           // arma a janela ociosa (solta sozinho se nada reflow em 2s)
        RELEASE.forEach(ev => window.addEventListener(ev, onUser, { passive: true }));
        window.addEventListener('load', keep, { once: true });
    }
    // ===== FASE 2 (DOM pronto): re-detecta (DOM) + monta os componentes (topbar/dock/filter bar) =====
    function boot() {
        safe(handleCrossSiteSearch);   // chegou com #smg-xsearch (botão "abrir no outro fórum")? roda a busca e já navega pro resultado
        if (FEATURES.unwrapLinks) handleRedirectPage();   // página de aviso do simp (precisa do DOM p/ achar o .simpLinkProxy-targetLink)
        detectPageClasses();   // agora o DOM existe (.structItem--thread dos fóruns do SMG, etc.)
        if (FEATURES.topBar && !document.querySelector('.p-nav')) cls.remove('smg-topbar-on');  // sem nav → restaura header
        if (feedContext()) safe(setupFeedView);   // home: monta o river se ?view=feed; o observer abaixo embeda a mídia do conteúdo injetado
        safe(pinDeepLinkPost);   // deep-link (#post-X): processa o alvo + segura ele no lugar ANTES do scan completo empurrar tudo
        processAll([document.body]);
        new MutationObserver(scheduleRun).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();
