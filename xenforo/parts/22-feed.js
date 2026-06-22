    // =========================================================
    // FEED (river de posts) — modo "feed" da /watched/threads (?view=feed).
    // Arquitetura em 3 camadas: 21-feed-db.js (IndexedDB) · 22-feed-sync.js (busca/escreve) ·
    // ESTE (parse serializável + render). O render LÊ DO BANCO (cursor por ts desc, instantâneo)
    // e dispara o sync no fundo; o sync busca raso/incremental e escreve no banco.
    //   ⚠️ riverParsePost devolve só strings/números (vai pro IndexedDB → nada de nós do DOM).
    // =========================================================
    function isHomePage() { return (document.documentElement.getAttribute('data-template') || '') === 'forum_list' || document.documentElement.classList.contains('smg-home-page'); }
    // o feed mora SÓ na HOME agora (removido o modo da /watched/threads). Acesso exclusivo pela topbar (?view=feed).
    function feedContext() {
        return isHomePage() ? { key: 'smg-homeview' } : null;
    }
    // modo feed: ligado só com ?view=feed na URL (sem sticky — o caminho de entrada é sempre o link da topbar).
    function feedViewWanted() {
        return !!feedContext() && new URLSearchParams(location.search).get('view') === 'feed';
    }

    // janela de BUSCA: até quantos dias atrás paginamos por thread (≠ o que fica guardado). 14d → 1º contato traz mais história;
    // quem acessa sempre cai no delta (só o último dia, barato). Tunável: gmSet('smg-feed-window-days','21').
    const RIVER_WINDOW_DAYS = (parseInt(gmGet('smg-feed-window-days', ''), 10) || 14);
    const RIVER_MAX_PAGES = 4;     // máx páginas voltadas por thread (default; o sync usa 1 = raso)
    // RETENÇÃO (≠ janela de busca): quanto tempo o post FICA no banco. Maior que a janela → não joga fora o que já buscamos
    // (posts > 1 semana que vieram de brinde nas páginas recentes ficam visíveis no feed, scroll abaixo). Tunável: gmSet('smg-feed-retention-days','60').
    const RIVER_RETENTION_DAYS = (parseInt(gmGet('smg-feed-retention-days', ''), 10) || 30);
    // horas entre sweeps FUNDOS da lista de seguidas (re-descobre thread parada em pág 2+). Default 6h; ajuste com gmSet('smg-feed-deep-ttl','12').
    const FEED_DEEP_TTL = (parseInt(gmGet('smg-feed-deep-ttl', ''), 10) || 6) * 3600;
    const FEED_COLD_THREADS = (parseInt(gmGet('smg-feed-cold-threads', ''), 10) || 120);   // 1º contato: foreground busca AO MENOS esse tanto de threads (não para na janela)
    const FEED_BACKFILL_TTL = 24 * 3600;          // o drain de fundo re-varre TUDO no máx 1×/dia
    const FEED_BACKFILL_PAGE_DELAY = 1500;        // respiro entre páginas da lista no drain (fundo, sem pressa)
    const FEED_BACKFILL_MAX_PAGES = 50;           // teto de páginas do drain (~1000 threads)
    // SELF-HEAL do cache: BUMP isto sempre que o formato do post serializado (riverParsePost) ou a lógica de sync mudar.
    // Na próxima abertura, dataVersion != FEED_DATA_VERSION → o IDB é descartado e reconstruído sozinho (o usuário NÃO precisa limpar cache na mão).
    const FEED_DATA_VERSION = 6;

    // fila throttled p/ as buscas (não estoura o flood control do fórum) — usada pelo sync
    const RIVER_CONCURRENCY = 3;
    let riverActive = 0; const riverQueue = [];
    function riverPump() {
        while (riverActive < RIVER_CONCURRENCY && riverQueue.length) {
            const job = riverQueue.shift();
            riverActive++;
            Promise.resolve().then(job).then(() => { riverActive--; riverPump(); }, () => { riverActive--; riverPump(); });
        }
    }
    function riverEnqueue(job) {
        return new Promise(resolve => { riverQueue.push(() => job().then(resolve, () => resolve(null))); riverPump(); });
    }

    // watermark por host: na próxima visita só os posts mais novos que ISSO ganham o destaque "novo"
    const RIVER_WM_KEY = 'smg-river-wm-' + location.hostname;
    function riverWatermark() { return parseInt(gmGet(RIVER_WM_KEY, '0'), 10) || 0; }
    function riverSetWatermark(ts) { if (ts) gmSet(RIVER_WM_KEY, String(ts)); }

    // timestamp do último post de um item da lista (p/ ordenar/decidir delta)
    function structItemTs(it) {
        const t = it.querySelector('.structItem-cell--latest time, .structItem-latestDate time, time.structItem-latestDate, .structItem-latestDate, time');
        if (!t) return 0;
        let ts = parseInt(t.getAttribute('data-timestamp') || t.getAttribute('data-time') || '0', 10) || 0;
        if (!ts) { const dt = t.getAttribute('datetime'); if (dt) { const ms = Date.parse(dt); if (!isNaN(ms)) ts = Math.floor(ms / 1000); } }
        return ts;
    }
    // lê as threads seguidas de um doc (página da lista de seguidas) e ordena por recência real.
    // root = o doc buscado pelo sync (fresco) ou document (fallback). NUNCA confiar só no DOM da página: fica estagnado.
    function riverWatchedThreads(root) {
        const out = [];
        (root || document).querySelectorAll('.structItem--thread').forEach(it => {
            const titleA = it.querySelector('.structItem-title a[href*="/threads/"]');
            if (!titleA) return;
            const base = (titleA.getAttribute('href') || '').replace(/\/(unread|latest|page-\d+|post-\d+).*$/, '').replace(/[#?].*$/, '').replace(/\/$/, '');
            if (!base) return;
            out.push({ base: base, href: base + '/latest', fallbackTitle: (titleA.textContent || '').trim(), thumb: feedThumbUrl(it), lastTs: structItemTs(it) });
        });
        out.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
        return out;
    }

    // título = h1 SEM os prefixos (senão "ASMR OnlyFans" cola no nome); prefixos viram HTML de chips à parte
    const PREFIX_SEL = '.label, .labelLink, [class*="label--"], .prefix, [class*="prefix"]';
    function riverThreadMeta(doc, t) {
        const titleEl = doc.querySelector('h1.p-title-value, .p-title-value');
        let title = t.fallbackTitle || '', prefixesHtml = '';
        if (titleEl) {
            const clone = titleEl.cloneNode(true);
            const labels = Array.from(clone.querySelectorAll(PREFIX_SEL));
            prefixesHtml = labels.map(l => l.outerHTML).join('');
            labels.forEach(l => l.remove());
            title = (clone.textContent || '').replace(/\s+/g, ' ').trim() || t.fallbackTitle || '';
        }
        return { title: title, prefixesHtml: prefixesHtml, thumb: t.thumb || '' };
    }
    // busca uma thread: última página (/latest) e volta página a página enquanto o post mais antigo da página ainda
    // estiver na janela de BUSCA (cutoff, máx maxPages). ARMAZENA TUDO das páginas que tocou — inclusive posts > 1 semana
    // que dividem a página com os recentes (já buscamos, não joga fora). O cutoff controla só ATÉ ONDE paginar, não o que guardar;
    // a retenção (fdbPrune por RIVER_RETENTION_DAYS) é quem limpa o antigo de verdade. maxPages=1 = raso (sync).
    function riverFetchThread(t, cutoffTs, maxPages) {
        const collected = [];
        let pagesLeft = maxPages || RIVER_MAX_PAGES;
        function grab(url) {
            return fetchDoc(url, { credentials: 'same-origin' }).then(doc => {
                pagesLeft--;
                const meta = riverThreadMeta(doc, t);
                const parsed = Array.from(doc.querySelectorAll('article.message--post, article.message[data-content^="post-"]'))
                    .filter(p => p.querySelector('.message-userContent'))
                    .map(p => riverParsePost(p, meta, url)).filter(Boolean);
                let oldest = Infinity;
                parsed.forEach(p => { if (p.ts) oldest = Math.min(oldest, p.ts); collected.push(p); });   // guarda TODOS (já buscamos a página); cutoff só decide se vale buscar a página anterior
                if (pagesLeft > 0 && oldest !== Infinity && oldest >= cutoffTs) {
                    const canon = doc.querySelector('link[rel="canonical"]');
                    const ch = canon && canon.getAttribute('href');
                    const pm = ch && ch.match(/\/page-(\d+)/);
                    const cur = pm ? parseInt(pm[1], 10) : 1;
                    if (cur > 1) return grab(ch.replace(/\/page-\d+.*$/, '').replace(/[#?].*$/, '') + '/page-' + (cur - 1));
                }
                return null;
            });
        }
        let start; try { start = new URL(t.href, location.href).href; } catch (e) { return Promise.resolve([]); }
        return grab(start).then(() => collected, () => collected);
    }
    // des-lazya as imagens do conteúdo (SMG usa lazyload: data-src + <noscript>). A JS de lazyload do fórum NÃO
    // roda no feed → sem isso as imagens ficam placeholder. Roda no doc PARSEADO (scripting off → o img do
    // <noscript> é DOM real) ANTES de serializar; injetado na página viva, o noscript viraria TEXTO e a img sumiria.
    function riverUnlazy(root) {
        if (!root || !root.querySelectorAll) return;
        const realOf = el => { const u = (el.getAttribute('data-src') || el.getAttribute('data-url') || el.getAttribute('data-original') || el.getAttribute('src') || ''); return /^data:/.test(u) ? '' : u; };
        root.querySelectorAll('img').forEach(img => {
            const cur = img.getAttribute('src') || '';
            const real = img.getAttribute('data-src') || img.getAttribute('data-url') || img.getAttribute('data-original') || '';
            if (real && !/^data:/.test(real) && (!cur || /^data:/.test(cur))) img.setAttribute('src', real);
            const ss = img.getAttribute('data-srcset'); if (ss) img.setAttribute('srcset', ss);
            // loading=lazy NATIVO (não depende da JS de lazyload do fórum, que é o que não roda aqui):
            // difere o fetch das offscreen. Remover o attr deixava TODA img do chunk eager — baixava/decodificava
            // mídia que o freeze (±1500px) descartava logo em seguida.
            img.setAttribute('loading', 'lazy'); img.classList.remove('lazyload', 'lazyloading', 'lazyloaded');
        });
        root.querySelectorAll('noscript').forEach(ns => {
            let inner = ns.querySelector && ns.querySelector('img');   // captura (DOMParser): noscript é DOM
            if (!inner && ns.textContent && /<img/i.test(ns.textContent)) {   // render (página viva): noscript virou TEXTO → re-parseia o HTML
                try { inner = new DOMParser().parseFromString(ns.textContent, 'text/html').querySelector('img'); } catch (e) {}
            }
            if (!inner) { ns.remove(); return; }   // noscript sem img → remove (senão vira texto no inject)
            const real = (ns.ownerDocument || document).importNode(inner, true);
            const r = realOf(real); if (r) real.setAttribute('src', r);
            real.setAttribute('loading', 'lazy'); real.classList.remove('lazyload', 'lazyloading', 'lazyloaded');
            const prev = ns.previousElementSibling;
            if (prev && prev.tagName === 'IMG') { prev.replaceWith(real); ns.remove(); } else ns.replaceWith(real);
        });
        // WRAPPERS lazyload (ex.: .bbImageWrapper do SMG): o CSS do fórum faz `.lazyload{opacity:0}` até a JS
        // de lazyload marcar `lazyloaded` — JS que NÃO roda no feed. Tirar a classe de TODO elemento (não só
        // img) revela o pixel; sem isso a img tem src real mas o wrapper fica opacity:0 e some.
        if (root.classList) root.classList.remove('lazyload', 'lazyloading');
        root.querySelectorAll('.lazyload, .lazyloading').forEach(el => el.classList.remove('lazyload', 'lazyloading'));
    }
    // extrai um post → objeto SERIALIZÁVEL (vai pro IndexedDB): nada de nós do DOM, só strings/números
    function riverParsePost(post, meta, threadUrl) {
        const body = post.querySelector('.message-userContent .bbWrapper') || post.querySelector('.message-userContent');
        if (!body) return null;
        riverUnlazy(body);   // resolve as imagens lazy ANTES de serializar (senão somem no feed do SMG)
        const dc = post.getAttribute('data-content') || '';
        const m = dc.match(/post-(\d+)/) || (post.id || '').match(/(\d+)/);
        const postId = m ? m[1] : '';
        if (!postId) return null;
        let ts = 0;
        const times = post.querySelectorAll('.message-attribution time, time');
        for (let i = 0; i < times.length && !ts; i++) {
            const te = times[i];
            ts = parseInt(te.getAttribute('data-timestamp') || te.getAttribute('data-time') || '0', 10) || 0;
            if (!ts) { const dt = te.getAttribute('datetime'); if (dt) { const ms = Date.parse(dt); if (!isNaN(ms)) ts = Math.floor(ms / 1000); } }
        }
        const author = (post.getAttribute('data-author') || '').trim()
            || (((post.querySelector('.message-name .username, .message-name') || {}).textContent) || '').trim();
        const authorA = post.querySelector('.message-name a[href*="/members/"], .message-avatar a[href*="/members/"]');
        let permalink = threadUrl;
        const permA = post.querySelector('.message-attribution a[href*="/post-"], a.message-attribution-gadget[href*="/post-"]');
        if (permA) { try { permalink = new URL(permA.getAttribute('href'), location.href).href; } catch (e) {} }
        else permalink = threadUrl.replace(/[#?].*$/, '').replace(/\/(latest|unread|page-\d+|post-\d+)$/, '') + '#post-' + postId;
        return {
            postId: postId, ts: ts, author: author, authorHref: authorA ? authorA.getAttribute('href') : '',
            threadTitle: meta.title, prefixesHtml: meta.prefixesHtml || '', threadThumb: meta.thumb || '',
            permalink: permalink, contentHtml: body.outerHTML || ''
        };
    }

    function buildFeedOpen(href) {
        const a = document.createElement('a');
        a.className = 'smg-fp-open'; a.href = href;
        const t = document.createElement('span'); t.textContent = i18n('Open in thread');
        a.appendChild(t);
        a.insertAdjacentHTML('beforeend', ICONS.arrowRight);
        return a;
    }
    // card: [foto da thread] · tags / nome do tópico / postado por autor · tempo · conteúdo · footer
    function riverCard(p, wm) {
        const card = document.createElement('div');
        card.className = 'smg-fp-card' + (p.ts && p.ts > wm ? ' is-unread' : '');
        card.dataset.ts = String(p.ts || 0);
        card._html = p.contentHtml || '';   // p/ a poda "descongelar" o conteúdo depois

        const head = document.createElement('div'); head.className = 'smg-fp-head';
        const thumbA = document.createElement('a'); thumbA.className = 'smg-fp-thumb'; thumbA.href = p.permalink || '#';
        const tLetter = ((p.threadTitle || '?').trim().charAt(0) || '?').toUpperCase();
        if (p.threadThumb) {
            const im = document.createElement('img'); im.src = p.threadThumb; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; im.alt = '';
            im.addEventListener('error', () => { im.remove(); thumbA.classList.add('smg-fp-thumb--letter'); thumbA.textContent = tLetter; });
            thumbA.appendChild(im);
        } else { thumbA.classList.add('smg-fp-thumb--letter'); thumbA.textContent = tLetter; }
        head.appendChild(thumbA);

        const meta = document.createElement('div'); meta.className = 'smg-fp-meta';
        if (p.prefixesHtml) { const tags = document.createElement('div'); tags.className = 'smg-fp-tags'; tags.innerHTML = p.prefixesHtml; meta.appendChild(tags); }
        const tname = document.createElement('a'); tname.className = 'smg-fp-tname'; tname.href = p.permalink || '#'; tname.textContent = p.threadTitle || ''; meta.appendChild(tname);
        const by = document.createElement('div'); by.className = 'smg-fp-by';
        by.appendChild(document.createTextNode(i18n('post by') + ' '));
        if (p.author) { const au = document.createElement(p.authorHref ? 'a' : 'span'); au.className = 'smg-fp-byname'; if (p.authorHref) au.href = p.authorHref; au.textContent = p.author; by.appendChild(au); }
        if (p.ts) { const dot = document.createElement('span'); dot.className = 'smg-fp-dot'; dot.textContent = ' · '; by.appendChild(dot); const tm = document.createElement('span'); tm.className = 'smg-fp-time'; tm.textContent = smgRelTime(p.ts); by.appendChild(tm); }
        meta.appendChild(by);
        head.appendChild(meta);
        // botão de compartilhar (copia o permalink do post) — canto sup-direito do card
        const share = document.createElement('button');
        share.type = 'button'; share.className = 'smg-fp-share'; share.setAttribute('aria-label', 'Share'); share.title = i18n('Copy link');
        share.innerHTML = ICONS.share;
        share.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            const url = p.permalink || location.href;
            const done = () => { share.innerHTML = ICONS.shareDone; share.classList.add('is-done'); setTimeout(() => { share.innerHTML = ICONS.share; share.classList.remove('is-done'); }, 1400); };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy link:', url));
            else window.prompt('Copy link:', url);
        });
        head.appendChild(share);
        card.appendChild(head);

        const c = document.createElement('div'); c.className = 'smg-fp-content message-userContent';
        if (p.contentHtml) { c.innerHTML = p.contentHtml; riverUnlazy(c); }   // injeta + des-lazya (cache velho/noscript-virou-texto) → o observer global embeda mídia + masonry
        card.appendChild(c);

        card.appendChild(buildFeedOpen(p.permalink || '#'));
        return card;
    }

    // container onde o river mora = o PAI do bloco da lista (ancorado no .structItem--thread → robusto). Cacheado.
    let riverHost = null;
    function riverContainer() {
        if (riverHost && riverHost.isConnected) return riverHost;
        const item = document.querySelector('.structItem--thread');
        const block = item && item.closest('.block');
        riverHost = (block && block.parentElement)
            || document.querySelector('.p-body-main') || document.querySelector('.p-body-content')
            || document.querySelector('.p-body-inner') || document.querySelector('.p-body') || document.body;
        return riverHost;
    }

    // ---- RENDER (lê do banco; o sync enche em background) ----
    const RIVER_CHUNK = 15;   // posts pintados por bloco (scroll)
    let riverBuilt = false, riverList = null, riverSeen = null, riverLastTs = null, riverOldWm = 0,
        riverMoreEl = null, riverMoreIO = null, riverNoMore = false, riverRendering = false,
        riverPill = null, riverFreezeIO = null, riverFirstPainted = false;

    // PODA: card a >1500px da viewport tem o conteúdo "congelado" (altura travada, innerHTML limpo →
    // descarrega imagens/vídeos, para o áudio). Ao voltar pra perto, descongela do _html guardado.
    // Mantém o DOM/memória limitados num scroll longo sem mexer no scroll (altura preservada).
    function riverFreeze(card, preH) {   // preH: altura pré-lida em lote pelo IO (evita reflow forçado por card)
        if (card._frozen) return;
        const c = card.querySelector('.smg-fp-content');
        if (!c) return;
        const h = preH != null ? preH : c.offsetHeight;
        if (!h) return;
        c.style.height = h + 'px';
        c.innerHTML = '';
        card._frozen = true;
    }
    function riverThaw(card) {
        if (!card._frozen) return;
        const c = card.querySelector('.smg-fp-content');
        if (c) { c.innerHTML = card._html || ''; riverUnlazy(c); c.style.height = ''; }   // des-lazya de novo ao descongelar
        card._frozen = false;
    }
    function riverObserveCard(card) {
        if (!riverFreezeIO) {
            if (typeof IntersectionObserver === 'undefined') return;
            riverFreezeIO = new IntersectionObserver(ents => {
                // 2 FASES (lê todas as alturas → depois escreve): offsetHeight intercalado com innerHTML=''
                // forçava um reflow da página inteira POR card no mesmo callback (vários cards cruzam o
                // limiar num batch de scroll rápido)
                const toFreeze = [], toThaw = [];
                ents.forEach(e => { if (e.isIntersecting) toThaw.push(e.target); else if (!e.target._frozen) toFreeze.push(e.target); });
                const hs = toFreeze.map(card => { const c = card.querySelector('.smg-fp-content'); return c ? c.offsetHeight : 0; });
                toFreeze.forEach((card, i) => riverFreeze(card, hs[i]));
                toThaw.forEach(riverThaw);
            }, { rootMargin: '1500px 0px' });
        }
        riverFreezeIO.observe(card);
    }

    // pílula "N novos posts" (estilo Twitter): aparece quando o sync traz coisa nova e você NÃO está no topo
    function riverNearTop() { return (window.scrollY || document.documentElement.scrollTop || 0) <= 600; }
    function showPill(n) {
        if (!riverPill || !n) return;
        riverPill.querySelector('.smg-river-pill-t').textContent = n + ' ' + i18n(n === 1 ? 'new post' : 'new posts');
        riverPill.hidden = false;
    }
    function hidePill() { if (riverPill) riverPill.hidden = true; }

    function riverEmptyState(msg) {
        if (riverMoreIO) { riverMoreIO.disconnect(); riverMoreIO = null; }
        if (riverMoreEl) { riverMoreEl.remove(); riverMoreEl = null; }
        if (riverList) riverList.innerHTML = '<div class="smg-fp-empty">' + msg + '</div>';
    }
    // 1ª pintura real: troca o spinner grande (.smg-fp-loading) pela lista + monta a sentinela. Idempotente.
    // Enquanto não há post pra mostrar (cache frio + sync na rede), o spinner FICA — sem isso a lista some.
    function firstPaint() {
        if (riverFirstPainted || !riverList) return;
        riverFirstPainted = true;
        riverList.innerHTML = '';   // remove o .smg-fp-loading
        mountSentinel();
    }
    // pinta o próximo bloco do BANCO. >0 = pintou; 0 = banco esgotado; -1 = pulado (já renderizando/fim)
    function renderNextChunk() {
        if (riverRendering || riverNoMore || !riverList) return Promise.resolve(-1);
        riverRendering = true;
        return fdbGetPostsDesc(RIVER_CHUNK, riverLastTs, riverSeen).then(posts => {
            riverRendering = false;
            if (!posts.length) return 0;
            firstPaint();   // só limpa o loader QUANDO há conteúdo de fato (senão o spinner segue girando)
            const frag = document.createDocumentFragment();
            const cards = [];
            posts.forEach(p => { riverSeen.add(p.postId); try { const card = riverCard(p, riverOldWm); cards.push(card); frag.appendChild(card); } catch (e) {} });
            if (riverMoreEl) riverList.insertBefore(frag, riverMoreEl); else riverList.appendChild(frag);
            cards.forEach(riverObserveCard);   // poda: começa a vigiar cada card novo
            riverLastTs = posts[posts.length - 1].ts;
            return posts.length;
        }, () => { riverRendering = false; return 0; });
    }
    // NOVIDADES (otimização de novos itens): pega os posts UNSEEN que pertencem à janela já renderizada —
    // ts ACIMA do cursor de baixo (riverLastTs). NÃO usa "ts > topo": o sync pode capturar um post FORA DE ORDEM
    // (mais novo que a base, porém MAIS VELHO que um topo pintado num poll anterior — ex.: thread veio stale e só
    // entrou no poll seguinte). Com "ts > topo" esse post sumia. Aqui pega tudo que é unseen e cai dentro/acima da janela.
    function fetchFreshPosts() {
        if (!riverList || !riverSeen) return Promise.resolve([]);
        const floor = riverLastTs || 0;
        // PERF: passa o floor (riverLastTs = ts do card MAIS ANTIGO pintado) como limite inferior do cursor IDB →
        // ele só varre a faixa acima da janela renderizada, em vez de começar no topo e pular O(|seen|) já-vistos a
        // cada poll de 60s. Cobre captura fora de ordem (post entre floor e o topo entra: ts > floor). O filtro JS
        // abaixo vira redundante-seguro (garante o caso floor=0, em que afterTs=null = comportamento original).
        return fdbGetPostsDesc(80, null, riverSeen, floor || null).then(
            posts => posts.filter(p => !floor || (p.ts || 0) > floor),
            () => []
        );
    }
    // insere cada post novo na POSIÇÃO CERTA (ts desc), não só no topo → respeita captura fora de ordem.
    // Preserva scroll e os cards já pintados; o observer global embeda a mídia dos novos.
    function insertFreshPosts(posts) {
        // materializa a lista 1× (não por post): os novos chegam em ts-desc e entram entre cards
        // ORIGINAIS, então o ref de inserção é sempre um card pré-existente → cachear evita o qSA O(n·m)/post.
        const existing = riverList.querySelectorAll('.smg-fp-card');
        posts.forEach(p => {
            if (riverSeen.has(p.postId)) return;
            riverSeen.add(p.postId);
            let card; try { card = riverCard(p, riverOldWm); } catch (e) { return; }
            card.classList.add('smg-fp-enter');   // entrada animada (só os recém-chegados; some após a animação)
            setTimeout(() => card.classList.remove('smg-fp-enter'), 1300);
            let ref = null;
            for (let i = 0; i < existing.length; i++) { if ((+existing[i].dataset.ts || 0) < (p.ts || 0)) { ref = existing[i]; break; } }
            if (ref) riverList.insertBefore(card, ref);
            else if (riverMoreEl) riverList.insertBefore(card, riverMoreEl);
            else riverList.appendChild(card);
            riverObserveCard(card);
        });
    }
    function renderMore() {
        renderNextChunk().then(n => {
            if (n === 0) {
                if (!feedSyncRunning) { riverNoMore = true; if (riverMoreIO) { riverMoreIO.disconnect(); riverMoreIO = null; } if (riverMoreEl) { riverMoreEl.remove(); riverMoreEl = null; } }
            } else if (n > 0 && riverMoreEl && riverMoreIO) {
                riverMoreIO.unobserve(riverMoreEl); riverMoreIO.observe(riverMoreEl);   // re-observa: enche até passar a viewport (render local = barato)
            }
        });
    }
    function mountSentinel() {
        riverMoreEl = document.createElement('button'); riverMoreEl.type = 'button'; riverMoreEl.className = 'smg-river-more';
        riverMoreEl.innerHTML = '<span class="smg-loading"></span><span class="smg-river-more-t">' + i18n('Load more') + '</span>';
        if (feedSyncRunning) riverMoreEl.classList.add('is-loading');   // montou DURANTE o sync (firstPaint roda após o kickSync) → já nasce girando
        riverMoreEl.addEventListener('click', renderMore);
        riverList.appendChild(riverMoreEl);
        riverMoreIO = new IntersectionObserver(ents => { ents.forEach(e => { if (e.isIntersecting) renderMore(); }); }, { rootMargin: '600px 0px' });
        riverMoreIO.observe(riverMoreEl);
    }
    // recarrega o topo do banco (após o sync trazer novidades) — só se o usuário está perto do topo
    function refreshTop(force) {
        if (!riverList || (!force && (window.scrollY || document.documentElement.scrollTop || 0) > 600)) return;
        if (riverFreezeIO) riverFreezeIO.disconnect();   // os cards atuais vão embora → para de vigiá-los (os novos re-observam)
        Array.prototype.slice.call(riverList.querySelectorAll('.smg-fp-card')).forEach(el => el.remove());
        riverSeen = new Set(); riverLastTs = null; riverNoMore = false;
        hidePill();
        if (!riverMoreEl) mountSentinel();
        renderMore();
        saveNewestWatermark();   // o usuário está vendo o topo → marca os novos como vistos
    }
    // 1ª vez (cache vazio): em vez de um spinner mudo, mostra "Configurando seu feed" + progresso enquanto o sync
    // varre TODAS as threads seguidas pela rede. FICA na tela até o sync inteiro terminar (não some no 1º batch) —
    // aí pinta tudo de uma vez (afterSync→renderMore). O setupProgress atualiza a contagem/barra ao vivo.
    function showSetupState() {
        if (!riverList || riverFirstPainted) return;
        riverList.innerHTML =
            '<div class="smg-fp-setup">' +
                '<span class="smg-fp-setup-spin"></span>' +
                '<div class="smg-fp-setup-title">' + i18n('Setting up your feed') + '</div>' +
                '<div class="smg-fp-setup-sub">' + i18n('Reading the threads you follow…') + '</div>' +
                '<div class="smg-fp-setup-bar"><span class="smg-fp-setup-barfill"></span></div>' +
            '</div>';
    }
    // atualiza o aviso de setup ao vivo: "{done}/{total} tópicos · {added} posts" + barra de progresso. No-op após a 1ª pintura.
    function setupProgress(p) {
        if (!riverList || riverFirstPainted || !p) return;
        const sub = riverList.querySelector('.smg-fp-setup-sub');
        const fill = riverList.querySelector('.smg-fp-setup-barfill');
        if (!sub) return;
        if (!p.total) { sub.textContent = i18n('Reading the threads you follow…'); return; }
        sub.textContent = p.done + '/' + p.total + ' ' + i18n('threads') + ' · ' + p.added + ' ' + i18n('posts');
        if (fill) fill.style.width = Math.round((p.done / p.total) * 100) + '%';
    }
    function buildRiver() {
        if (riverBuilt || document.getElementById('smg-river')) return;
        riverBuilt = true;

        const wrap = document.createElement('div'); wrap.id = 'smg-river';
        // header do feed (título + slot p/ o ícone de notices) — substitui a antiga tabbar como "barra" do feed
        const fhead = document.createElement('div'); fhead.className = 'smg-river-head';
        fhead.innerHTML = '<h1 class="smg-river-title">Timeline</h1><div class="smg-river-head-actions"></div>';
        wrap.appendChild(fhead);
        riverList = document.createElement('div'); riverList.className = 'smg-fp-list';
        riverList.innerHTML = '<div class="smg-fp-loading"><span class="smg-loading"></span></div>';
        wrap.appendChild(riverList);
        // pílula "novos posts" (fixed, flutua no topo) — clicar recarrega o topo e sobe
        riverPill = document.createElement('button'); riverPill.type = 'button'; riverPill.className = 'smg-river-pill'; riverPill.hidden = true;
        riverPill.innerHTML = ICONS.show + '<span class="smg-river-pill-t"></span>';   // chevron-up (reusa o registry; era inline igual ao ICONS.show)
        riverPill.addEventListener('click', () => { refreshTop(true); window.scrollTo(0, 0); });
        wrap.appendChild(riverPill);
        const host = riverContainer();
        host.appendChild(wrap);

        riverSeen = new Set(); riverLastTs = null; riverNoMore = false; riverOldWm = riverWatermark();
        const cutoff = Math.floor(Date.now() / 1000) - RIVER_WINDOW_DAYS * 86400;

        // SELF-HEAL: se o formato do cache mudou (FEED_DATA_VERSION bumpado), descarta e reconstrói ANTES de ler → a mudança reflete sozinha
        fdbEnsureVersion(FEED_DATA_VERSION).then(() => fdbCountPosts()).then(count => {
            if (count) renderMore();          // cache existe → pinta na hora (firstPaint troca o spinner pelo conteúdo)
            else showSetupState();            // cache vazio = 1ª vez (ou pós-reset) → "Configurando seu feed" FICA até o sync inteiro terminar
            kickSync(cutoff, !count);         // cold = cache vazio → varre fundo (+ páginas/thread) e só pinta no fim
        }, () => { firstPaint(); kickSync(cutoff, true); });   // sem IndexedDB → degrada (só sync, sem cache)
    }
    function saveNewestWatermark() { fdbGetPostsDesc(1, null, null).then(top => { if (top.length) riverSetWatermark(top[0].ts || 0); }); }
    // depois de cada sync: pinta o cache se estava vazio; senão detecta NOVIDADES (unseen dentro/acima da janela,
    // não "ts > topo" — captura fora de ordem!) e insere em ordem (perto do topo) ou mostra a pílula.
    function afterSync() {
        return fdbCountPosts().catch(() => 0).then(count => {
            if (!count) { riverEmptyState(i18n('No recent posts')); return; }
            if (!riverSeen.size) { renderMore(); saveNewestWatermark(); return; }   // cache vazio na abertura → pinta agora
            return fetchFreshPosts().then(fresh => {
                if (!fresh.length) return;
                if (riverNearTop()) { insertFreshPosts(fresh); saveNewestWatermark(); }   // insere em ordem (preserva scroll + cards de baixo)
                else showPill(fresh.length);   // longe do topo → pílula (não marca visto → highlight preservado)
            });
        });
    }
    // base canônica + título da thread ABERTA (página de thread). '' se não for uma thread.
    function feedCurrentThread() {
        if (!/\/threads\//.test(location.pathname)) return null;
        const canon = document.querySelector('link[rel="canonical"]');
        let base = (canon && canon.getAttribute('href')) || location.href;
        base = base.replace(/\/(unread|latest|page-\d+|post-\d+).*$/, '').replace(/[#?].*$/, '').replace(/\/$/, '');
        if (!base) return null;
        const titleEl = document.querySelector('h1.p-title-value, .p-title-value');
        const title = titleEl ? (titleEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
        return { base: base, title: title };
    }
    // SEGUIR thread → joga ela no nosso banco NA HORA (puxa os posts recentes), sem esperar o sync da home.
    // Reusa o pipeline do sync (syncOneThread) → mesmo parse/dedupe/janela. Surfacing se o feed estiver aberto.
    function feedAddThread(base, title, thumb) {
        if (!base) return Promise.resolve(0);
        const cutoff = Math.floor(Date.now() / 1000) - RIVER_WINDOW_DAYS * 86400;
        const t = { base: base, href: base + '/latest', fallbackTitle: title || '', thumb: thumb || '', lastTs: Math.floor(Date.now() / 1000) };
        return fdbEnsureVersion(FEED_DATA_VERSION)   // garante o schema/versão certo mesmo se o feed nunca foi aberto nesta sessão
            .then(() => syncOneThread(t, cutoff, RIVER_MAX_PAGES))
            .then(n => { if (n && riverList && riverList.isConnected) afterSync(); return n; })
            .catch(() => 0);
    }
    function feedAddCurrentThread() { const c = feedCurrentThread(); return c ? feedAddThread(c.base, c.title, '') : Promise.resolve(0); }
    // DEIXAR DE SEGUIR → tira a thread (e os posts dela) do banco, pra não vazar no feed depois.
    function feedRemoveCurrentThread() {
        const c = feedCurrentThread(); if (!c) return Promise.resolve();
        return fdbDeleteThread(threadIdFromBase(c.base));
    }
    function kickSync(cutoff, cold) {
        if (riverMoreEl) riverMoreEl.classList.add('is-loading');
        // COLD (1ª vez / pós-reset, com a mensagem na tela): varre FUNDO + MAIS páginas por thread e mostra progresso ao vivo;
        //   NÃO pinta incremental — afterSync pinta TUDO de uma vez quando o sync inteiro termina (a msg fica até lá).
        // WARM: DEEP só quando o cache está VELHO (> TTL) — aí re-pagina a lista (acha thread em pág 2+); senão RASO (page 1).
        //   Pro propósito do banco: não re-paginar 12 páginas a cada abertura. WARM pinta do IDB e o afterSync insere as novidades.
        const go = deep => {
            const opts = { deep: deep };
            if (cold) { opts.pagesPerThread = RIVER_MAX_PAGES; opts.minThreads = FEED_COLD_THREADS; opts.onProgress = setupProgress; }   // cold: 120 threads no mín + mais páginas/thread + barra de progresso
            else opts.onBatch = () => { if (riverList && riverSeen && !riverSeen.size) renderMore(); };
            feedSync(cutoff, opts)
                .then(() => { if (riverMoreEl) riverMoreEl.classList.remove('is-loading'); return afterSync(); })
                .then(() => feedBackfill(cutoff));   // FUNDO: depois do foreground, continua varrendo o resto das seguidas de pouco em pouco até o banco ter tudo
        };
        if (cold) { go(true); return; }   // cold sempre fundo
        fdbGetMeta('lastDeepSync').then(
            last => go(!last || (Math.floor(Date.now() / 1000) - last) > FEED_DEEP_TTL),
            () => go(true));   // sem meta/IDB → deep
    }
    // DRAIN de FUNDO: depois do foreground (120 threads), continua varrendo a lista de seguidas INTEIRA, página a página,
    // sincronizando cada thread no banco — de pouco em pouco, throttle compartilhado (riverEnqueue), respiro entre páginas
    // e PAUSA quando a aba some. As recentes já vieram no foreground → o delta do syncOneThread as pula barato. Marca
    // 'backfillDone' ao completar (re-varre no máx 1×/dia); se cancelado (saiu do feed), NÃO marca → retoma no próximo open.
    let feedBackfillRunning = false, feedBackfillStop = false;
    function feedWhenVisible() {
        if (!document.hidden) return Promise.resolve();
        return new Promise(resolve => {
            const on = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', on); resolve(); } };
            document.addEventListener('visibilitychange', on);
        });
    }
    function feedBackfillNext(doc) {
        const a = doc.querySelector('a.pageNav-jump--next[href], link[rel="next"][href], a[rel="next"][href]');
        const h = a && a.getAttribute('href');
        if (!h) return null;
        try { return new URL(h, location.href).href; } catch (e) { return null; }
    }
    function feedBackfill(cutoff) {
        if (feedBackfillRunning) return Promise.resolve();
        feedBackfillRunning = true; feedBackfillStop = false;
        return fdbGetMeta('backfillDone').then(done => {
            if (done && (Math.floor(Date.now() / 1000) - done) < FEED_BACKFILL_TTL) return null;   // já completou no último dia → nada
            let added = 0; const seen = new Set();
            const walk = (url, depth) => {
                if (feedBackfillStop || !url || !riverList || !riverList.isConnected) return Promise.resolve();
                return feedWhenVisible()
                    .then(() => fetchDoc(url, { credentials: 'same-origin' }))
                    .then(doc => {
                        const threads = riverWatchedThreads(doc).filter(t => { if (seen.has(t.base)) return false; seen.add(t.base); return true; });
                        const next = feedBackfillNext(doc);
                        return Promise.all(threads.map(t => riverEnqueue(() => syncOneThread(t, cutoff, 1).then(n => { added += n; }))))
                            .then(() => {
                                if (feedBackfillStop || !next || depth >= FEED_BACKFILL_MAX_PAGES) return;
                                return new Promise(res => setTimeout(res, FEED_BACKFILL_PAGE_DELAY)).then(() => walk(next, depth + 1));
                            });
                    }, () => {});   // página falhou → encerra o drain (retoma depois)
            };
            let start; try { start = new URL(feedWatchedUrl(), location.href).href; } catch (e) { start = feedWatchedUrl(); }
            return walk(start, 1).then(() => {
                if (feedBackfillStop) return;   // cancelado → não marca completo (retoma no próximo open)
                return fdbSetMeta('backfillDone', Math.floor(Date.now() / 1000)).then(() => { if (added) afterSync(); });   // completou → surfacing das novidades acumuladas
            });
        }).then(() => { feedBackfillRunning = false; }, () => { feedBackfillRunning = false; });
    }
    // POLLING: enquanto o feed está visível, re-sincroniza (lista FRESCA + delta) → posts novos aparecem via
    // pílula sem recarregar a página. Resolve o "saiu há 2 min e não atualizou". Para ao sair do feed / aba oculta.
    let feedPollTimer = null;
    function feedPoll() {
        if (document.hidden || !riverList || !riverList.isConnected) return;
        feedSync(Math.floor(Date.now() / 1000) - RIVER_WINDOW_DAYS * 86400, {}).then(() => afterSync());
    }
    function feedVisPoll() { if (!document.hidden) feedPoll(); }
    function feedStartPoll() {
        if (feedPollTimer) return;
        feedPollTimer = setInterval(feedPoll, 60000);
        document.addEventListener('visibilitychange', feedVisPoll);
    }
    function feedStopPoll() {
        if (feedPollTimer) { clearInterval(feedPollTimer); feedPollTimer = null; }
        document.removeEventListener('visibilitychange', feedVisPoll);
        feedBackfillStop = true;   // saiu do feed → cancela o drain de fundo (retoma no próximo open)
    }

    // ---- ativa o modo feed (home ?view=feed) ----  (sem tabbar: a saída é o logo/Home da topbar)
    function applyRiverMode(mode) {
        const feed = mode === 'feed';
        document.documentElement.classList.toggle('smg-watched-feed', feed);
        const host = riverContainer();
        Array.prototype.forEach.call(host.children, ch => {
            if (ch.id === 'smg-river') return;
            ch.classList.toggle('smg-river-hide', feed);
        });
        if (feed) { buildRiver(); feedStartPoll(); } else feedStopPoll();
    }
    let riverSetupDone = false;
    function setupFeedView() {
        if (riverSetupDone) return;
        if (!feedContext()) return;
        riverSetupDone = true;
        if (feedViewWanted()) applyRiverMode('feed');   // home + ?view=feed → monta o river; senão home normal (nada)
    }
