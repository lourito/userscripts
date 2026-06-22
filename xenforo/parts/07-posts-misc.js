    // ── part 07-posts-misc: filtro por autor · atalhos de teclado · scroll infinito ──
    // =========================================================
    // FEATURE: filtrar posts por autor
    // =========================================================

    let authorFilter = null; // username em minúsculas, ou null = mostrar todos

    // setado pela dock; o scroll infinito chama pra atualizar o número da página exibido
    let smgUpdateDockPage = null;

    function applyAuthorFilter(full) {
        // por frame (scroll infinito) processa só os posts NOVOS; full=true (ao TROCAR o filtro) re-avalia todos
        const sel = full ? '.message--post' : '.message--post:not([data-smg-filt])';
        document.querySelectorAll(sel).forEach(p => {
            p.dataset.smgFilt = '1';
            const a = (p.getAttribute('data-author') || '').toLowerCase();
            p.style.display = (!authorFilter || a === authorFilter) ? '' : 'none';
        });
    }

    // =========================================================
    // FEATURE: atalhos de teclado (j/k navegação · g goto · / busca · f feed)
    // =========================================================

    let kbBound = false;

    function setupKeyboardShortcuts() {
        if (kbBound) return;
        kbBound = true;

        document.addEventListener('keydown', e => {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            // feed aberto tem os próprios atalhos (setas/espaço/esc)
            if (document.getElementById('smg-feed')?.classList.contains('open')) return;

            const click = id => document.getElementById(id)?.click();

            switch (e.key) {
                case 'j': click('smg-post-nav-down'); break;   // próximo post
                case 'k': click('smg-post-nav-up'); break;     // post anterior
                case 'g': click('smg-post-goto'); break;       // ir pra página
                case 'f': if (FEATURES.mediaFeed) openMediaFeed(null, null, { fromStart: true }); break;   // modo feed (navegação própria, página 1)
                case 'v': click('smg-view-toggle'); break;     // alterna lista/grade
                case '[': click('smg-post-page-prev'); break;  // página anterior
                case ']': click('smg-post-page-next'); break;  // próxima página
                case '/': e.preventDefault(); click('smg-thread-search'); break; // busca
                default: return;
            }
        });
    }

    // =========================================================
    // FEATURE: scroll infinito na thread (anexa as próximas páginas)
    // =========================================================

    let infScrollBound = false;

    // pager-sync do scroll infinito: espelha a página visível na URL + dock + paginadores (nativo e SMG).
    // Fábrica: encapsula shownPage; devolve a função chamada no listener de scroll do setupInfiniteScroll.
    function makePagerSync(startPage, originalUrl) {
        let shownPage = startPage;

        const currentSep = () => {
            const refY = 120; // linha de referência perto do topo
            const seps = document.querySelectorAll('.smg-inf-sep[data-page]');
            let sep = null;
            for (let i = 0; i < seps.length; i++) {   // separadores em ordem do DOM → tops monotônicos
                if (seps[i].getBoundingClientRect().top <= refY) sep = seps[i];
                else break;                            // 1º abaixo da linha → o resto também está → encerra
            }
            return sep;
        };

        const syncPage = () => {
            const sep = currentSep();
            const p = sep ? parseInt(sep.dataset.page, 10) : startPage;
            if (p === shownPage) return;
            shownPage = p;
            try { history.replaceState(history.state, '', sep ? sep.dataset.url : originalUrl); } catch {}
            if (typeof smgUpdateDockPage === 'function') smgUpdateDockPage(p);

            // "X of Y" do paginador simples (topo e rodapé)
            document.querySelectorAll('.pageNavSimple-el--current').forEach(el => {
                el.textContent = el.textContent.replace(/(\d+)(\s*of\s*\d+)/i, p + '$2');
            });

            // destaque "current" do paginador janelado — move o .pageNav-page--current
            // só se a página estiver na janela visível do pager (links têm /page-N; o "1" é a base)
            document.querySelectorAll('.pageNav-main').forEach(ul => {
                let target = null;
                ul.querySelectorAll('li.pageNav-page > a[href]').forEach(a => {
                    const m = (a.getAttribute('href') || '').match(/\/page-(\d+)/);
                    if ((m ? parseInt(m[1], 10) : 1) === p) target = a.parentElement;
                });
                if (!target) return; // página fora da janela do pager
                ul.querySelectorAll('.pageNav-page--current').forEach(li => li.classList.remove('pageNav-page--current'));
                target.classList.add('pageNav-page--current');
            });

            // espelha o "current" + o compacto cur/max na nossa barra única (SMG)
            document.querySelectorAll('.smg-bar-pages').forEach(pages => {
                let target = null;
                pages.querySelectorAll('a[href]').forEach(a => {
                    const m = (a.getAttribute('href') || '').match(/\/page-(\d+)/);
                    if ((m ? parseInt(m[1], 10) : 1) === p) target = a;
                });
                if (!target) return;
                pages.querySelectorAll('.smg-bar-btn--current').forEach(a => a.classList.remove('smg-bar-btn--current'));
                target.classList.add('smg-bar-btn--current');
            });
            document.querySelectorAll('.smg-bar-compact').forEach(c => { c.textContent = c.textContent.replace(/^\s*\d+/, p); });
        };
        return syncPage;
    }

    function setupInfiniteScroll() {
        if (infScrollBound) return;
        // página SEM paginação não ganha uma depois do load: marca como "resolvido" senão a detecção
        // inteira (querySelectors + readPageJump) re-roda TODO frame de processAll, pra sempre
        const settle = () => { if (document.readyState === 'complete') infScrollBound = true; };

        // contexto detectado por DOM (URLs de fórum do socialmediagirls não têm /forums/, ex.: /youtubers/)
        let container, itemSelector, fetchScope, keyOf = null;   // keyOf: dedup por thread (article view repete sticky por página)
        if (document.querySelector('.message--post')) {
            // thread (posts)
            container = document.querySelector('.message--post').parentElement;
            itemSelector = '.message--post';
            fetchScope = doc => doc;
        } else if (document.querySelector('.structItem--thread')) {
            // listagem de fórum/seguidas — container real (evita o grupo sticky, que repete em toda página)
            const pick = root => root.querySelector('.structItemContainer-group.js-threadList')
                || root.querySelector('.structItemContainer-group:not(.structItemContainer-group--sticky)')
                || (root.querySelector('.structItem--thread') || {}).parentElement
                || null;
            container = pick(document);
            itemSelector = '.structItem--thread';
            fetchScope = doc => pick(doc) || doc;
        } else if (document.querySelector('.smg-article-grid')) {
            // article view (forum_view_type_article): cards já movidos pro nosso grid; anexa os da próxima página nele
            container = document.querySelector('.smg-article-grid');
            itemSelector = '.message--articlePreview';
            fetchScope = doc => doc.querySelector('.block--articles') || doc;   // artigos da próxima página (no .block-body nativo do XF)
            keyOf = el => { const a = el.querySelector('.articlePreview-title a[href*="/threads/"]'); return a ? a.getAttribute('href').replace(/\/(unread|latest|page-\d+|post-\d+).*$/, '').replace(/\/$/, '') : null; };
        } else if (document.documentElement.getAttribute('data-template') === 'search_results') {
            // resultados de busca — só o conteúdo principal (evita o block-row da sidebar)
            const pick = root => {
                const scope = root.querySelector('.p-body-pageContent') || root;
                const r = scope.querySelector('.block-body > .block-row');
                return r ? r.parentElement : null;
            };
            container = pick(document);
            itemSelector = '.block-row';
            fetchScope = doc => pick(doc) || doc;
        } else {
            settle(); return;
        }
        if (!container) { settle(); return; }

        // segue o link "Next" REAL de cada página (robusto a qualquer formato de
        // paginação — /page-N, ?page=N, etc.); evita repetir a mesma página
        const nextLink = root => {
            const a = root.querySelector('.pageNav-jump--next, .pageNavSimple-el--next');
            return a ? a.getAttribute('href') : null;
        };
        const pageNumOf = url => {
            const m = (url || '').match(/(?:\/page-|[?&]page=)(\d+)/);
            return m ? parseInt(m[1], 10) : null;
        };

        let nextUrl = nextLink(document);
        if (!nextUrl) { settle(); return; } // página única ou já na última

        const pj = readPageJump();
        const startPage = pj ? pj.cur : 1;
        const originalUrl = location.pathname + location.search;

        infScrollBound = true;
        let loading = false;
        let done = false;
        let lastNum = startPage;
        // dedup (article view): registra as threads já presentes pra não repetir os sticky em cada página
        const seen = new Set();
        if (keyOf) container.querySelectorAll(itemSelector).forEach(el => { const k = keyOf(el); if (k) seen.add(k); });

        const check = () => {
            if (!FEATURES.infiniteScroll) return;   // desligar no settings para na hora (o observer fica, mas não carrega mais)
            if (loading || done || !nextUrl) return;
            if (document.getElementById('smg-feed')?.classList.contains('open')) return; // feed tem o seu próprio
            const rest = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
            if (rest > 1400) return;

            loading = true;
            const url = nextUrl;
            const num = pageNumOf(url) || (lastNum + 1);

            fetchDoc(url, { credentials: 'same-origin' })
                .then(doc => {
                    const items = fetchScope(doc).querySelectorAll(itemSelector);
                    if (!items.length) { done = true; nextUrl = null; return; }

                    // separador como <li> se o container for lista (ol/ul), senão <div>
                    const sep = document.createElement(/^(OL|UL)$/.test(container.tagName) ? 'li' : 'div');
                    sep.className = 'smg-inf-sep';
                    sep.dataset.page = num;  // p/ sincronizar o paginador
                    sep.dataset.url = url;   // URL real dessa página (p/ replaceState)
                    sep.textContent = i18n('Page') + ' ' + num;
                    container.appendChild(sep);

                    items.forEach(p => {
                        if (keyOf) { const k = keyOf(p); if (k && seen.has(k)) return; if (k) seen.add(k); }  // pula thread repetida (sticky)
                        container.appendChild(document.importNode(p, true));
                    });
                    lastNum = num;
                    nextUrl = nextLink(doc); // segue o "Next" da página recém-buscada
                    if (!nextUrl) done = true;
                    if (authorFilter) applyAuthorFilter();
                })
                .catch(() => {})
                .finally(() => { loading = false; });
        };

        // ---- sincroniza o paginador com o que está na tela (URL + número da dock + "X of Y") ----
        const syncPage = makePagerSync(startPage, originalUrl);

        onScrollRaf(() => { check(); syncPage(); });

        check();
    }
