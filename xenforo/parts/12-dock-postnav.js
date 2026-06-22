    // =========================================================
    // DOCK — navegação (setupPostNavigation): a barra flutuante + busca + filtros + sheet mobile.
    // É a MAIOR função do arquivo. Mapa interno (Cmd+F no texto "// ----"):
    //   layout ....... links da página · page jump · botões · navegação global · navbar mobile · montagem
    //   estado ....... estado da dock · bottom sheet (mobile)
    //   popovers ..... goto · search (+ histórico compartilhado) · settings · filtro por autor · filtro da listagem
    //   posts ........ helpers de post · navegação entre posts · share · save · watch thread · paginação · sort
    //   init ......... estado inicial + atualização dos botões no scroll
    // =========================================================

    function setupPostNavigation() {
        // já montado: sai cedo (não re-escaneia posts a cada mutação)
        if (document.getElementById('smg-post-nav-wrapper')) return;

        // anchors de cada post (ignora respostas em quote)
        let posts = Array.from(
            document.querySelectorAll('span.u-anchorTarget[id^="post-"]')
        ).filter(el => !el.closest('.message-responseRow'));

        // fallback
        if (posts.length === 0) {
            posts = Array.from(document.querySelectorAll('.message'));
        }

        // dock é global: monta em qualquer página. Os grupos de navegação/ação
        // (e a fiação deles) só fazem sentido numa thread.
        const onThreadUrl = /\/threads\//.test(location.pathname);
        if (onThreadUrl && posts.length === 0) return; // espera os posts da thread carregarem
        const isThread = onThreadUrl && posts.length > 0;

        posts.forEach(el => {
            if (el instanceof HTMLElement) el.style.scrollMarginTop = '0px';
        });

        // ---- links da página (casados por CLASSE/HREF, não por texto → funcionam em PT, EN, etc.) ----
        const prevPageLink = document.querySelector('.pageNav-jump--prev, .pageNavSimple-el--prev');
        const nextPageLink = document.querySelector('.pageNav-jump--next, .pageNavSimple-el--next');
        // sort tabs: a de reação tem ?order=reaction_score no href; a de data é a sem order=
        let sortDateLink = null, sortReactionLink = null;
        document.querySelectorAll('.tabs--standalone .tabs-tab, .block-outer-opposite--postSortFilter .tabs-tab').forEach(t => {
            const h = t.getAttribute('href') || '';
            if (/order=reaction/i.test(h)) sortReactionLink = t;
            else if (!/order=/i.test(h)) sortDateLink = t;
        });

        let sortIsDate = !/reaction/i.test(window.location.search || '');

        // ---- page jump (goto): página atual (URL) + total, via readPageJump ----
        const pageJump = (() => {
            const pj = readPageJump();
            return pj ? { tpl: pj.tpl, current: pj.cur, max: pj.max } : null;
        })();

        // ---- botões ----
        const btnSearch = makeDockButton({ id: 'smg-thread-search', icon: ICONS.search, label: 'Search' });
        const btnShare = makeDockButton({ id: 'smg-post-share', icon: ICONS.share, label: 'Copy post' });
        const btnSave = makeDockButton({ id: 'smg-post-save', icon: ICONS.save, label: 'Save post' });
        const btnWatch = makeDockButton({ id: 'smg-thread-watch', icon: ICONS.watch, label: 'Watch thread' });
        const btnSort = makeDockButton({ id: 'smg-post-sort-toggle', icon: ICONS.sortDate, label: 'Sort by date' });
        btnSort.classList.add('smg-nav-labeled');   // pílula com o critério escrito (Data/Reações) — deixa claro pelo quê ordena
        btnSort.appendChild(Object.assign(document.createElement('span'), { className: 'smg-nav-btn-text' }));
        const btnPagePrev = makeDockButton({ id: 'smg-post-page-prev', icon: ICONS.pagePrev, label: 'Prev page' });
        const btnPageNext = makeDockButton({ id: 'smg-post-page-next', icon: ICONS.pageNext, label: 'Next page' });
        const btnGoto = makeDockButton({
            id: 'smg-post-goto',
            icon: pageJump ? String(pageJump.current) : ICONS.goto, // mostra a página atual
            label: 'Go to page',
        });
        // o scroll infinito chama isto pra refletir a página que está na tela
        if (pageJump) smgUpdateDockPage = n => { pageJump.current = n; setBtnIcon(btnGoto, String(n)); };
        const btnUp = makeDockButton({ id: 'smg-scroll-top', icon: ICONS.scrollTop, label: 'Scroll to top' });        // (era "Prev post") → rola pro topo
        const btnDown = makeDockButton({ id: 'smg-scroll-bottom', icon: ICONS.scrollBottom, label: 'Scroll to bottom' }); // (era "Next post") → rola pro fim

        // listagem (fórum/busca): paginação na dock + botão que abre o filtro nativo do XenForo
        const onListUrl = !!document.querySelector('.structItem--thread')
            || !!document.querySelector('.message--articlePreview')                      // article view (forum_view_type_article)
            || /\/forums\/[^/]+/.test(location.pathname)                                  // qualquer página de fórum
            || /^forum_view/.test(document.documentElement.getAttribute('data-template') || '')
            || document.documentElement.getAttribute('data-template') === 'search_results'
            || /\/search\//.test(location.pathname);
        const btnListFilter = (onListUrl && document.querySelector('.filterBar-menuTrigger'))
            ? makeDockButton({ id: 'smg-list-filter', icon: ICONS.filter, label: 'Filter' })
            : null;

        // alternar lista/grade (onde há .structItem--thread: fórum e threads seguidas)
        let viewMode = gmGet('smg-threadview', 'grid');   // grid é o default (toggle lista/grade segue existindo)
        const btnViewToggle = (onListUrl && (document.querySelector('.structItem--thread') || document.querySelector('.message--articlePreview')))
            ? makeDockButton({ id: 'smg-view-toggle', icon: viewMode === 'grid' ? ICONS.list : ICONS.gallery, label: viewMode === 'grid' ? 'List view' : 'Grid view' })
            : null;
        if (btnViewToggle) btnViewToggle.addEventListener('click', () => {
            viewMode = viewMode === 'grid' ? 'list' : 'grid';
            gmSet('smg-threadview', viewMode);
            document.documentElement.classList.toggle('smg-tv-grid', viewMode === 'grid');
            setBtnIcon(btnViewToggle, viewMode === 'grid' ? ICONS.list : ICONS.gallery);
            setBtnLabel(btnViewToggle, viewMode === 'grid' ? 'List view' : 'Grid view');
        });

        const isList = !isThread && onListUrl && (!!pageJump || !!btnListFilter || !!btnViewToggle);

        // ---- navegação global (links) — base do fórum via quick-search (vale em qualquer página) ----
        const boardBase = (() => {
            const qs = document.querySelector('form[data-xf-init="quick-search"]');
            const act = qs?.getAttribute('action') || '/search/search';
            return act.replace(/search\/search\/?$/, '') || '/'; // '/' ou '/community/'
        })();
        const btnHome = makeDockLink({ id: 'smg-nav-home', icon: ICONS.home, label: 'Home', href: boardBase });
        const btnAlerts = makeDockLink({ id: 'smg-nav-alerts', icon: ICONS.alerts, label: 'Alerts', href: boardBase + 'account/alerts' });
        const btnWatched = makeDockLink({ id: 'smg-nav-watched', icon: ICONS.watched, label: 'Watched', href: boardBase + 'watched/threads' });
        const btnTimeline = makeDockLink({ id: 'smg-nav-timeline', icon: ICONS.feed, label: 'Timeline', href: boardBase + '?view=feed' });   // espelha o item central da topbar (river das seguidas)
        // discover/user: só na navbar inferior (mobile); abrem bottom sheets montados no buildTopbar.
        // são links (fallback caso a topbar esteja off); com a topbar, o wireSheet faz preventDefault e abre o sheet.
        const btnDiscover = makeDockLink({ id: 'smg-nav-discover', icon: ICONS.compass, label: 'Discover', href: boardBase + 'whats-new/' });
        const btnUser = makeDockLink({ id: 'smg-nav-user', icon: ICONS.user, label: 'Account', href: boardBase + 'account/' });
        // modo feed · galeria · baixar mídia: MOVIDOS pro header da thread (smg-bar, ver 17-thread-filterbar.js).
        const btnSettings = makeDockButton({ id: 'smg-nav-settings', icon: ICONS.settings, label: 'Settings' });
        const btnFilter = isThread ? makeDockButton({ id: 'smg-post-filter', icon: ICONS.filter, label: 'Filter by author' }) : null;

        // ---- navbar mobile estilo Instagram: profile vira avatar circular + item da página atual fica "ativo" (ícone preenchido) ----
        // (só visível no mobile — no desktop a nav central some e sobra a engrenagem; aqui é inofensivo)
        const navAvatar = document.querySelector('.p-navgroup-link--user .avatar');
        if (navAvatar) {
            const ico = btnUser.querySelector('.smg-nav-ico');
            if (ico) { ico.innerHTML = ''; ico.appendChild(navAvatar.cloneNode(true)); ico.classList.add('smg-nav-ico--avatar'); }
        }
        (function markActiveNav() {
            const path = location.pathname;
            // só MARCA a classe — o "preenchido" é feito via CSS no próprio ícone de contorno (que já renderiza).
            // (trocar innerHTML por um <svg fill> separado falhava no render → o ícone sumia)
            const on = btn => btn.classList.add('smg-nav-active');
            if (/[?&]view=feed/.test(location.search)) on(btnTimeline);   // ANTES do home: o feed mora NA home (?view=feed)
            else if (document.documentElement.classList.contains('smg-home-page') || path === boardBase || path === '/') on(btnHome);
            else if (/\/watched\//.test(path)) on(btnWatched);
            else if (/\/account\/alerts/.test(path)) on(btnAlerts);
            else if (/\/account(\/|$)/.test(path)) on(btnUser);                 // avatar ganha o anel
            else if (/\/whats-new(\/|$)/.test(path)) on(btnDiscover);
        })();

        // ---- montagem (esquerda: navegação · centro: global · direita: ações) ----
        const panel = document.createElement('div');
        panel.id = 'smg-post-nav-panel';

        // navegação principal (+config) — no desktop só sobra a engrenagem; no mobile vira a navbar inferior
        // navbar mobile = 5 itens (espelha a topbar, que tem a Timeline): início · timeline · buscar · notificações · user.
        // Discover e Watched ficam no DOM (escondidos via CSS) → o wireSheet/sheet de opções ainda os alcançam.
        // (a engrenagem fica escondida no mobile e some atrás do FAB de opções; no desktop tudo some e sobra ela)
        const centralBtns = [btnHome, btnTimeline, btnDiscover, btnWatched, btnSearch, btnAlerts, btnUser];   // engrenagem saiu daqui → vai pra ESQUERDA da dock (não fica sozinha no centro)
        const centralGroup = makeGroup(...centralBtns);
        centralGroup.classList.add('smg-nav-center');

        // botão que abre o bottom sheet de opções (só aparece no mobile)
        const btnSheet = makeDockButton({ id: 'smg-dock-sheet-btn', icon: ICONS.sliders, label: 'Options' });

        if (isThread) {
            // desktop: ações (esq.) · navegação principal (centro) · navegação de página (dir.)
            // mobile: navbar central + botão de opções à direita (os lados vão pro sheet)
            const actionsGroup = makeGroup(btnFilter, btnShare, btnSave, btnWatch);   // feed saiu daqui → foi pra central
            actionsGroup.classList.add('smg-side');
            const pagenavGroup = makeGroup(btnSort, btnPagePrev, btnGoto, btnPageNext);
            pagenavGroup.classList.add('smg-side');
            const scrollGroup = makeGroup(btnUp, btnDown);   // scroll topo/fundo num grupo próprio
            scrollGroup.classList.add('smg-side');
            panel.append(
                btnSettings, makeDivider(),   // engrenagem à ESQUERDA
                actionsGroup, makeDivider(),
                centralGroup, makeDivider(),  // nav (navbar no mobile; escondido no desktop)
                pagenavGroup, makeDivider(),  // divider à ESQUERDA do scroll topo/fundo
                scrollGroup,
                btnSheet
            );
        } else if (isList) {
            // listagem (fórum/busca): central · paginação + filtro · opções
            // (o grupo é .smg-side → some da navbar no mobile e vai pro sheet)
            const listBtns = [];
            if (pageJump) listBtns.push(btnPagePrev, btnGoto, btnPageNext);
            if (btnListFilter) listBtns.push(btnListFilter);
            if (btnViewToggle) listBtns.push(btnViewToggle);
            const listGroup = makeGroup(...listBtns);
            listGroup.classList.add('smg-side');
            panel.append(btnSettings, makeDivider(), centralGroup, makeDivider(), listGroup, btnSheet);   // engrenagem à ESQUERDA
        } else {
            // fora de thread: navbar central + botão de opções (geral)
            panel.append(centralGroup, btnSheet);
        }

        const navWrapper = document.createElement('div');
        navWrapper.id = 'smg-post-nav-wrapper';
        // sem ações de thread/lista, no desktop sobraria só a engrenagem → marca p/ esconder a dock
        if (!isThread && !isList) navWrapper.classList.add('smg-dock-baronly');

        // handle pra reabrir quando a dock for ocultada manualmente
        const handle = document.createElement('button');
        handle.id = 'smg-dock-handle';
        handle.type = 'button';
        handle.title = i18n('Show dock');
        handle.innerHTML = ICONS.show;

        // popover do goto (fora do panel pra não ser cortado pelo overflow no mobile)
        const gotoPop = document.createElement('div');
        gotoPop.id = 'smg-goto-pop';
        gotoPop.innerHTML =
            '<span class="smg-goto-title">Go to page</span>' +
            '<div class="smg-goto-stepper">' +
                '<button type="button" class="smg-goto-step" data-dir="-1" aria-label="Decrease">−</button>' +
                '<input type="number" class="smg-goto-input" min="1" value="1">' +
                '<button type="button" class="smg-goto-step" data-dir="1" aria-label="Increase">+</button>' +
            '</div>' +
            '<span class="smg-goto-max"></span>' +
            '<button type="button" class="smg-goto-btn">Go</button>';

        // busca: dialog modal (montado no body, dentro de um overlay com backdrop escuro)
        const searchPop = document.createElement('div');
        searchPop.id = 'smg-search-pop';
        searchPop.innerHTML =
            '<div class="smg-search-bar">' +
                '<span class="smg-search-lupa">' + ICONS.search + '</span>' +
                '<button type="button" class="smg-search-chip" hidden><span class="smg-search-chip-t"></span><span class="smg-search-chip-x" aria-label="' + i18n('Clear') + '">' + ICONS.close + '</span></button>' +
                '<input type="text" class="smg-search-input" placeholder="Search the forum…" enterkeyhint="search" autocapitalize="off" autocomplete="off" spellcheck="false">' +
                '<button type="button" class="smg-search-cmdbtn" aria-label="' + i18n('Commands (Tab)') + '" title="' + i18n('Commands (Tab)') + '">⇥</button>' +
                '<a class="smg-search-adv" target="_blank" rel="noopener" aria-label="' + i18n('Advanced') + '">' + ICONS.filter + '</a>' +
                '<button type="button" class="smg-search-cfg" aria-label="' + i18n('Search defaults') + '">' + ICONS.sliders + '</button>' +
                '<span class="smg-search-kbd" title="Press Esc to close">esc</span>' +
                '<button type="button" class="smg-search-close" aria-label="Close">' + ICONS.close + '</button>' +
            '</div>' +
            // filtros vêm de COMANDOS na barra (by:/sort:/posts:/title:). `by` fica oculto (ref interna p/ c[users]).
            '<input type="text" class="smg-search-by" hidden>' +
            '<div class="smg-search-results" hidden></div>' +
            '<div class="smg-search-history" hidden>' +
                '<div class="smg-search-hist-head">' +
                    '<span class="smg-search-hist-title">Recent searches</span>' +
                    '<span class="smg-search-hist-badge"></span>' +
                    '<button type="button" class="smg-search-hist-toggle">Show all</button>' +
                    '<button type="button" class="smg-search-hist-clear">Clear</button>' +
                '</div>' +
                '<div class="smg-search-hist-list"></div>' +
            '</div>' +
            '<div class="smg-search-empty" hidden>' +
                '<span class="smg-search-empty-ic">' + ICONS.search + '</span>' +
                '<span class="smg-search-empty-t">Search the forum</span>' +
                '<span class="smg-search-empty-s">Type at least 3 characters to see results</span>' +
                '<span class="smg-search-empty-hint"><span class="smg-search-tabkey">⇥ Tab</span><code>!t</code><code>!i</code><code>!a</code><code>!sn</code></span>' +
            '</div>' +
            '<div class="smg-search-foot">' +
                '<span class="smg-search-hint">Enter to search</span>' +
                '<button type="button" class="smg-search-go"><span class="smg-search-go-ic">' + ICONS.search + '</span>Search</button>' +
            '</div>';

        // backdrop (portal escuro) + dialog, fora da dock (o transform da dock no desktop quebraria o position:fixed)
        const searchOverlay = document.createElement('div');
        searchOverlay.id = 'smg-search-overlay';
        searchOverlay.appendChild(searchPop);
        document.body.appendChild(searchOverlay);
        i18nDom(searchOverlay);

        // popover de configurações (engrenagem) — toggles persistidos via GM_setValue
        const settingsPop = document.createElement('div');
        settingsPop.id = 'smg-settings-pop';
        // ícone por categoria (rail à esquerda) + sliders dos tunables do feed (gmGet/gmSet)
        const SET_ICONS = { 'Appearance': ICONS.sliders, 'Images': ICONS.typeImage, 'Videos': ICONS.typeVideo, 'Links & files': ICONS.link, 'Thread & reading': ICONS.list, 'Feed': ICONS.feed };
        const SET_TUNABLES = [
            { key: 'smg-feed-window-days', label: i18n('Search window (days)'), min: 3, max: 30, def: 14 },
            { key: 'smg-feed-retention-days', label: i18n('Keep posts for (days)'), min: 7, max: 90, def: 30 },
            { key: 'smg-feed-cold-threads', label: i18n('Threads on first load'), min: 40, max: 300, step: 10, def: 120 },
            { key: 'smg-feed-deep-ttl', label: i18n('Deep re-scan every (h)'), min: 1, max: 48, def: 6 },
        ];
        const qAttr = s => (s || '').toLowerCase().replace(/["<>]/g, '');
        const setToggleRow = it =>
            '<label class="smg-set-row" data-q="' + qAttr(it.label + ' ' + ((it.desc && (IS_PT ? it.desc.pt : it.desc.en)) || '')) + '">' +
                '<span class="smg-set-text">' +
                    '<span class="smg-set-label">' + it.label + '</span>' +
                    (it.desc ? '<span class="smg-set-desc">' + (IS_PT ? it.desc.pt : it.desc.en) + '</span>' : '') +
                '</span>' +
                '<input type="checkbox" data-feat="' + it.key + '"' + (FEATURES[it.key] ? ' checked' : '') + '>' +
                '<span class="smg-switch"></span>' +
            '</label>';
        const setSliderRow = it => {
            const v = parseInt(gmGet(it.key, ''), 10) || it.def;
            return '<div class="smg-set-slider" data-q="' + qAttr(it.label) + '">' +
                '<div class="smg-set-slidertop"><span class="smg-set-label">' + it.label + '</span><span class="smg-set-val">' + v + '</span></div>' +
                '<input type="range" data-tune="' + it.key + '" min="' + it.min + '" max="' + it.max + '" step="' + (it.step || 1) + '" value="' + v + '">' +
            '</div>';
        };
        const SET_SECTIONS = SETTINGS_META.concat([{ section: 'Feed', sliders: SET_TUNABLES }]);
        const setRail = SET_SECTIONS.map((s, i) => '<button type="button" class="smg-set-tab' + (i === 0 ? ' active' : '') + '" data-i="' + i + '" title="' + s.section + '" aria-label="' + s.section + '">' + (SET_ICONS[s.section] || ICONS.settings) + '</button>').join('');
        const setContent = SET_SECTIONS.map((s, i) =>
            '<div class="smg-set-sec" data-i="' + i + '"' + (i === 0 ? '' : ' hidden') + '>' +
                '<div class="smg-set-sectitle">' + s.section + '</div>' +
                (s.items ? s.items.map(setToggleRow).join('') : '') +
                (s.sliders ? s.sliders.map(setSliderRow).join('') : '') +
            '</div>').join('');
        settingsPop.innerHTML =
            '<div class="smg-set-head"><span class="smg-set-logo">' + ICONS.settings + '</span><b class="smg-set-title">' + i18n('Settings') + '</b><button type="button" class="smg-set-x" aria-label="' + i18n('Close') + '">' + ICONS.close + '</button></div>' +
            '<div class="smg-set-search"><span class="smg-set-searchic">' + ICONS.search + '</span><input type="text" class="smg-set-q" placeholder="' + i18n('Search setting…') + '" spellcheck="false" autocomplete="off"></div>' +
            '<div class="smg-set-body">' +
                '<div class="smg-set-rail">' + setRail + '</div>' +
                '<div class="smg-set-content">' + setContent + '<div class="smg-set-empty" hidden>' + i18n('No settings found') + '</div></div>' +
            '</div>' +
            '<div class="smg-set-foot">' +
                '<button type="button" class="smg-set-reset">' + i18n('Restore defaults') + '</button>' +
                '<button type="button" class="smg-set-reload">' + i18n('Reload') + '</button>' +
                '<span class="smg-set-ver"></span>' +
            '</div>';

        // popover de filtro por autor (só em thread)
        const filterPop = isThread ? document.createElement('div') : null;
        if (filterPop) {
            filterPop.id = 'smg-filter-pop';
            filterPop.innerHTML =
                '<span class="smg-pop-title">Filter posts by author</span>' +
                '<div class="smg-filter-quick"></div>' +
                '<div class="smg-filter-row">' +
                    '<input type="text" class="smg-filter-input" placeholder="Username…">' +
                    '<button type="button" class="smg-filter-apply">Filter</button>' +
                '</div>' +
                '<button type="button" class="smg-filter-clear">Show all</button>';
        }

        // popover do filtro da listagem (fórum) — conteúdo carregado sob demanda
        const listFilterPop = (isList && btnListFilter) ? document.createElement('div') : null;
        if (listFilterPop) {
            listFilterPop.id = 'smg-listfilter-pop';
            listFilterPop.innerHTML = '<span class="smg-pop-title">Filter</span><div class="smg-lf-body">Loading…</div>';
        }

        // backdrop dos popovers do dock (settings/filtro) — vira o scrim do bottom sheet no mobile.
        // clicar nele fecha via o handler de clique-fora (não está dentro de nenhum pop/botão).
        const dockBackdrop = document.createElement('div');
        dockBackdrop.className = 'smg-dock-backdrop';
        navWrapper.append(panel, handle, gotoPop, settingsPop, dockBackdrop);
        if (filterPop) navWrapper.append(filterPop);
        if (listFilterPop) navWrapper.append(listFilterPop);
        document.body.appendChild(navWrapper);
        i18nDom(navWrapper);

        // ---- estado da dock (só ocultar manual; sem auto-hide no scroll) ----

        const DOCK_HIDDEN_KEY = 'smg-dock-hidden';
        let manualHidden = localStorage.getItem(DOCK_HIDDEN_KEY) === '1';

        function applyManualHidden() {
            navWrapper.classList.toggle('manual-hidden', manualHidden);
        }

        // ocultar agora vem de dentro das Settings
        function hideDock() {
            manualHidden = true;
            localStorage.setItem(DOCK_HIDDEN_KEY, '1');
            applyManualHidden();
        }

        handle.addEventListener('click', () => {
            manualHidden = false;
            localStorage.setItem(DOCK_HIDDEN_KEY, '0');
            applyManualHidden();
        });

        applyManualHidden();

        // ---- bottom sheet de opções (mobile): o botão à direita abre tudo aqui ----
        const setupOptionsSheet = () => {
            const sheet = document.createElement('div');
            sheet.id = 'smg-sheet';
            sheet.innerHTML =
                '<div class="smg-sheet-panel">' +
                    '<div class="smg-sheet-grip"></div>' +
                    '<div class="smg-sheet-body"></div>' +
                '</div>';
            document.body.appendChild(sheet);

            const sheetPanel = sheet.querySelector('.smg-sheet-panel');
            const sheetBody = sheet.querySelector('.smg-sheet-body');

            const closeSheet = () => sheet.classList.remove('open');

            const sheetItem = (iconHtml, label, onClick, disabled) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'smg-sheet-item' + (disabled ? ' smg-sheet-disabled' : '');
                const ico = document.createElement('span'); ico.className = 'smg-sheet-ico'; ico.innerHTML = iconHtml;   // iconHtml = SVG controlado pelo script
                const lbl = document.createElement('span'); lbl.className = 'smg-sheet-lbl'; lbl.textContent = label;   // label pode ser username (filtro por autor) → textContent, NUNCA innerHTML
                b.append(ico, lbl);
                // stopPropagation: senão o clique borbulha até o handler de "fora" e fecha
                // o popover que acabamos de abrir (config/goto/filtro)
                b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
                return b;
            };
            // lê ícone+label+ESTADO atuais do botão da dock e delega o clique (mantém estado sincronizado)
            const fromBtn = btn => {
                const item = sheetItem(
                    btn.querySelector('.smg-nav-ico')?.innerHTML || '',
                    btn.dataset.label || '',
                    () => { if (btn.disabled) return; closeSheet(); btn.click(); },
                    btn.disabled
                );
                // espelha o estado ativo (watch seguindo, filtro aplicado, etc.) — lido a cada abertura do sheet
                if (btn.classList.contains('smg-active')) item.classList.add('smg-active');
                return item;
            };

            function rebuildSheet() {
                sheetBody.innerHTML = '';

                const addSection = (title, items) => {
                    items = items.filter(Boolean);
                    if (!items.length) return;
                    const h = document.createElement('div');
                    h.className = 'smg-sheet-title';
                    h.textContent = title;
                    const grid = document.createElement('div');
                    grid.className = 'smg-sheet-grid';
                    items.forEach(it => grid.appendChild(it));
                    sheetBody.append(h, grid);
                };

                // General no TOPO
                addSection('General', [
                    fromBtn(btnSettings),
                    sheetItem(ICONS.hide, 'Hide dock', () => { closeSheet(); hideDock(); }),
                ]);
                // Discover/Watched saíram da navbar (5 itens) → continuam alcançáveis por aqui
                // (fromBtn delega o click: Discover abre o sheet do wireSheet; Watched navega pelo href)
                addSection('Explore', [fromBtn(btnDiscover), fromBtn(btnWatched)]);
                if (isThread) {
                    addSection('Post', [btnShare, btnSave, btnWatch, btnFilter].map(b => b && fromBtn(b)));
                    // Sort by date entra DEPOIS de Next page
                    addSection('Navigation', [btnUp, btnDown, btnPagePrev, btnGoto, btnPageNext, btnSort].map(b => b && fromBtn(b)));
                } else if (isList) {
                    const listItems = [];
                    if (pageJump) listItems.push(btnPagePrev, btnGoto, btnPageNext);
                    if (btnListFilter) listItems.push(btnListFilter);
                    if (btnViewToggle) listItems.push(btnViewToggle);
                    addSection('Page', listItems.map(b => b && fromBtn(b)));
                }
                i18nDom(sheetBody);
            }

            btnSheet.addEventListener('click', () => { rebuildSheet(); sheet.classList.add('open'); });
            sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); }); // toca no fundo fecha

            // arrastar o sheet pra baixo fecha (só quando já está no topo do scroll)
            let shY = 0, shDy = 0, shDrag = false;
            sheetPanel.addEventListener('touchstart', e => {
                if (e.touches.length !== 1) { shDrag = false; return; }
                shDrag = sheetPanel.scrollTop <= 0;
                shY = e.touches[0].clientY;
                shDy = 0;
                sheetPanel.style.transition = 'none';
            }, { passive: true });
            sheetPanel.addEventListener('touchmove', e => {
                if (!shDrag) return;
                shDy = e.touches[0].clientY - shY;
                if (shDy > 0) sheetPanel.style.transform = 'translateY(' + shDy + 'px)';
            }, { passive: true });
            sheetPanel.addEventListener('touchend', () => {
                if (!shDrag) return;
                shDrag = false;
                sheetPanel.style.transition = '';
                sheetPanel.style.transform = '';
                if (shDy > 90) closeSheet();
            });
        };
        setupOptionsSheet();

        // ---- goto: popover pra pular pra uma página ----
        const gotoInput = gotoPop.querySelector('.smg-goto-input');
        const gotoMax = gotoPop.querySelector('.smg-goto-max');
        const gotoGoBtn = gotoPop.querySelector('.smg-goto-btn');

        function clampPage(n) {
            if (!n || n < 1) n = 1;
            if (pageJump && pageJump.max && n > pageJump.max) n = pageJump.max;
            return n;
        }

        function closePopovers() {
            navWrapper.classList.remove('goto-open', 'settings-open', 'filter-open', 'listfilter-open', 'smg-dock-show');
            searchOverlay.classList.remove('open');
        }
        // arrastar pra baixo fecha os sheets/modais mobile (settings · filtro têm grip = bottom sheet; goto é popover pequeno → fora)
        const isMobileSheet = () => window.innerWidth <= 600;
        addSwipeClose(settingsPop, closePopovers, () => isMobileSheet() && navWrapper.classList.contains('settings-open'));
        if (filterPop) addSwipeClose(filterPop, closePopovers, () => isMobileSheet() && navWrapper.classList.contains('filter-open'));

        function openGoto() {
            if (!pageJump) return;
            closePopovers();
            gotoInput.max = pageJump.max || '';
            gotoInput.value = pageJump.current;
            gotoMax.textContent = pageJump.max ? 'of ' + pageJump.max + ' pages' : '';
            navWrapper.classList.add('goto-open');
            setTimeout(() => { gotoInput.focus(); gotoInput.select(); }, 0);
        }

        function doGoto() {
            if (!pageJump) return;
            window.location.href = pageJump.tpl.replace('%page%', clampPage(parseInt(gotoInput.value, 10)));
        }

        btnGoto.addEventListener('click', e => {
            e.stopPropagation();
            if (navWrapper.classList.contains('goto-open')) closePopovers();
            else openGoto();
        });

        // botões − / + (sempre visíveis)
        gotoPop.querySelectorAll('.smg-goto-step').forEach(b => {
            b.addEventListener('click', () => {
                gotoInput.value = clampPage((parseInt(gotoInput.value, 10) || 1) + parseInt(b.dataset.dir, 10));
            });
        });

        gotoInput.addEventListener('change', () => {
            gotoInput.value = clampPage(parseInt(gotoInput.value, 10));
        });

        gotoGoBtn.addEventListener('click', doGoto);

        gotoInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); doGoto(); }
            else if (e.key === 'Escape') closePopovers();
        });

        // ---- search: popover de busca (XenForo /search/search) ----
        const setupSearch = () => {
            const threadId = (location.pathname.match(/threads\/[^/]+\.(\d+)/) || [])[1] || '';
            // node id do fórum pai: último link /forums/slug.ID/ do breadcrumb
            const forumId = (() => {
                let id = '';
                document.querySelectorAll('.p-breadcrumbs a[href*="/forums/"], .breadcrumbs a[href*="/forums/"]').forEach(a => {
                    const m = (a.getAttribute('href') || '').match(/\/forums\/[^/]+\.(\d+)/);
                    if (m) id = m[1];
                });
                return id;
            })();

            const searchInput = searchPop.querySelector('.smg-search-input');
            // input ATIVO: desktop usa o input REAL da topbar (dropdown); mobile usa o input do próprio modal.
            const getSearchInput = () => (window.innerWidth > 600 && document.querySelector('.smg-tb-search-input')) || searchInput;
            const searchResultsEl = searchPop.querySelector('.smg-search-results');
            const searchBy = searchPop.querySelector('.smg-search-by');   // oculto — preenchido pelo comando by:
            const searchAdv = searchPop.querySelector('.smg-search-adv');
            const searchHistEl = searchPop.querySelector('.smg-search-history');
            const searchHistList = searchPop.querySelector('.smg-search-hist-list');
            const searchHistToggle = searchPop.querySelector('.smg-search-hist-toggle');
            const searchHistClear = searchPop.querySelector('.smg-search-hist-clear');
            const searchHistBadge = searchPop.querySelector('.smg-search-hist-badge');
            const searchEmptyEl = searchPop.querySelector('.smg-search-empty');

            // action + token do quick-search da própria página (robusto a subdiretório)
            const qsForm = document.querySelector('form[data-xf-init="quick-search"]');
            const searchAction = qsForm?.getAttribute('action') || '/search/search';
            if (searchAdv) searchAdv.href = searchAction.replace(/search\/?$/, ''); // /search/search -> /search/

            let applyingEntry = false;   // true durante fillFromEntry → segura o re-search por filtro

            // ===== ESCOPO estilo Reddit: começa no CONTEXTO (tópico/fórum atual); chip com × na barra → "em tudo" =====
            // título da página SEM o que injetamos/o XF cola dentro do h1 (botão de notices, prefixos/labels)
            const pageTitle = (() => {
                const el = document.querySelector('h1.p-title-value, .p-title-value'); if (!el) return '';
                const c = el.cloneNode(true);
                c.querySelectorAll('.smg-notices, .label, .labelLink, [class*="label--"], .prefix, [class*="prefix"]').forEach(x => x.remove());
                return (c.textContent || '').replace(/\s+/g, ' ').trim();
            })();
            const ctxLabel = threadId
                ? pageTitle
                : forumId
                    ? (() => { let n = ''; document.querySelectorAll('.p-breadcrumbs a[href*="/forums/"], .breadcrumbs a[href*="/forums/"]').forEach(a => { const t = a.textContent.trim(); if (t) n = t; }); return n || pageTitle; })()
                    : '';
            let currentScope = threadId ? 'thread' : (forumId && ctxLabel ? 'forum' : 'everywhere');
            let titlesOn = true, orderDate = false;   // (re)setados pelos comandos a cada busca

            function applyScopeUI() {
                const isThread = currentScope === 'thread';
                const scoped = isThread || (currentScope === 'forum' && !!ctxLabel);   // tópico vale pelo threadId (mesmo sem título); fórum precisa do nome
                document.documentElement.classList.toggle('smg-search-scoped', scoped);
                const chipText = isThread ? i18n('This thread') : ctxLabel;   // TÓPICO: rótulo curto fixo (nomes de tópico podem ser enormes); FÓRUM: nome
                const kind = isThread ? '' : i18n('Forum');                   // tópico não precisa de tag — o rótulo já diz
                Array.prototype.forEach.call(document.querySelectorAll('.smg-tb-search-chip, .smg-search-chip'), ch => {
                    ch.hidden = !scoped;
                    const t = ch.querySelector('.smg-search-chip-t'); if (t) t.textContent = chipText;
                    let k = ch.querySelector('.smg-search-chip-k');
                    if (scoped && kind) { if (!k) { k = document.createElement('span'); k.className = 'smg-search-chip-k'; ch.insertBefore(k, t); } k.textContent = kind; }
                    else if (k) k.remove();
                });
                const ph = isThread ? i18n('Search in this thread') : (scoped ? (i18n('Search in') + ' ' + ctxLabel) : i18n('Search the forum…'));
                if (searchInput) searchInput.placeholder = ph;
                const tb = document.querySelector('.smg-tb-search-input'); if (tb) tb.placeholder = ph;
            }
            function unscope() { currentScope = 'everywhere'; applyScopeUI(); researchOnFilter(); try { getSearchInput().focus(); } catch (e) {} }
            // × do chip (delegado → cobre o chip da topbar E o do modal)
            document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.smg-search-chip-x')) { e.preventDefault(); e.stopPropagation(); unscope(); } });
            applyScopeUI();

            // defaults configuráveis (engrenagem da barra) — DECLARADOS AQUI (antes do bloco que os usa no setup); comando explícito sempre vence
            const CFG_TITLES = 'smg-search-def-titles', CFG_ORDER = 'smg-search-def-order', CFG_LIKE = 'smg-search-like';
            let cfgTitles = localStorage.getItem(CFG_TITLES) === '1';                 // só-títulos por padrão (busca global/fórum)
            let cfgOrder = localStorage.getItem(CFG_ORDER) === '1';                   // por data por padrão
            let cfgLike = (localStorage.getItem(CFG_LIKE) ?? '1') === '1';            // wildcard de parte da palavra

            // BUSCA AVANÇADA (na barra): com query → abre os RESULTADOS NATIVOS numa nova aba (POST, igual o inline → garantido),
            // já com o escopo/filtros atuais; a página de resultados tem o painel pra refinar. Sem query → o form de busca avançada.
            const advUrl = searchAction.replace(/search\/?$/, '');   // /search/search → /search/
            Array.prototype.forEach.call(document.querySelectorAll('.smg-search-adv'), a => { a.href = advUrl; a.title = i18n('Advanced'); });   // href base (ctrl/middle-click)
            function openAdvanced() {
                const p = parseCommands(getSearchInput().value);
                if (!p.keywords && !p.by) { window.open(advUrl, '_blank', 'noopener'); return; }   // sem query → form avançado
                const token = qsForm?.querySelector('input[name="_xfToken"]')?.value || document.querySelector('input[name="_xfToken"]')?.value || '';
                const fields = [['keywords', likeify(p.keywords)], ['_xfToken', token]];
                if (currentScope === 'thread' && threadId) fields.push(['c[thread]', threadId], ['search_type', 'post']);   // search_type=post é OBRIGATÓRIO p/ restringir À thread (senão o XF busca threads no global e ignora c[thread])
                else if (currentScope === 'forum' && forumId) fields.push(['c[nodes][0]', forumId], ['c[child_nodes]', '1']);
                const titles = (p.titles != null) ? p.titles : (currentScope !== 'thread' && cfgTitles);
                if (titles && currentScope !== 'thread') fields.push(['c[title_only]', '1']);
                if (p.by) fields.push(['c[users]', p.by]);
                const order = p.order ? (p.order === 'date') : cfgOrder;
                if (order) fields.push(['order', 'date']);
                const f = document.createElement('form'); f.method = 'post'; f.action = searchAction; f.target = '_blank'; f.style.display = 'none';
                fields.forEach(kv => { const i = document.createElement('input'); i.type = 'hidden'; i.name = kv[0]; i.value = kv[1]; f.appendChild(i); });
                document.body.appendChild(f); f.submit(); setTimeout(() => f.remove(), 0);
            }
            document.addEventListener('click', e => { const adv = e.target.closest && e.target.closest('.smg-search-adv'); if (adv) { e.preventDefault(); openAdvanced(); } });

            // CONFIG de defaults da busca (engrenagem na barra) — portalizada no body, igual o tooltip
            const cfgPortal = document.createElement('div'); cfgPortal.className = 'smg-search-cfg-portal';
            const cfgRow = (key, label, on) => '<label class="smg-search-cfg-row"><input type="checkbox" data-cfg="' + key + '"' + (on ? ' checked' : '') + '><span>' + label + '</span></label>';
            cfgPortal.innerHTML = '<div class="smg-search-cfg-head">' + i18n('Search defaults') + '</div>' +
                cfgRow(CFG_TITLES, i18n('Titles only by default'), cfgTitles) +
                cfgRow(CFG_ORDER, i18n('Newest first by default'), cfgOrder) +
                cfgRow(CFG_LIKE, i18n('Match partial words'), cfgLike);
            document.body.appendChild(cfgPortal);
            cfgPortal.addEventListener('change', e => {
                const k = e.target.getAttribute && e.target.getAttribute('data-cfg'); if (!k) return;
                const on = !!e.target.checked; localStorage.setItem(k, on ? '1' : '0');
                if (k === CFG_TITLES) cfgTitles = on; else if (k === CFG_ORDER) cfgOrder = on; else if (k === CFG_LIKE) cfgLike = on;
                researchOnFilter();   // re-busca com o novo default (se já tem query)
            });
            function closeCfg() { cfgPortal.classList.remove('open'); document.querySelectorAll('.smg-search-cfg').forEach(b => b.classList.remove('open')); }
            document.addEventListener('click', e => {
                const g = e.target.closest && e.target.closest('.smg-search-cfg');
                if (g) {
                    e.preventDefault(); e.stopPropagation();
                    const willOpen = !cfgPortal.classList.contains('open');
                    closeCfg();
                    if (willOpen) { const r = g.getBoundingClientRect(); cfgPortal.classList.add('open'); g.classList.add('open'); const w = cfgPortal.offsetWidth || 240; let left = r.right - w; if (left < 8) left = 8; cfgPortal.style.left = left + 'px'; cfgPortal.style.top = (r.bottom + 8) + 'px'; }
                    return;
                }
                if (!e.target.closest('.smg-search-cfg-portal')) closeCfg();
            });

            // TECLADO: Backspace no input VAZIO remove o chip de contexto ("Neste tópico") → vira "em tudo"
            document.addEventListener('keydown', e => {
                if (e.key !== 'Backspace') return;
                const inp = e.target; if (!inp.matches || !inp.matches('.smg-tb-search-input, .smg-search-input')) return;
                if (currentScope !== 'everywhere' && inp.value === '' && (inp.selectionStart || 0) === 0) { e.preventDefault(); unscope(); }
            });

            // MENU DE COMANDOS (Tab): paleta pra escolher !a/!sn/!st/!t/!i com teclado ou clique — descobrível sem decorar
            const CMD_ITEMS = [
                { code: '!t', ins: '!t ', label: i18n('titles only') },
                { code: '!i', ins: '!i ', label: i18n('search post text') },
                { code: '!a', ins: '!a ', label: i18n('author') },
                { code: '!sn', ins: '!sn ', label: i18n('by date') },
                { code: '!st', ins: '!st ', label: i18n('Relevance') },
            ];
            const cmdMenu = document.createElement('div'); cmdMenu.className = 'smg-search-cmd';
            cmdMenu.innerHTML = '<div class="smg-search-cmd-head">' + i18n('Search commands') + '</div>' +
                CMD_ITEMS.map((c, i) => '<button type="button" class="smg-search-cmd-item" data-i="' + i + '"><code>' + c.code + '</code><span>' + c.label + '</span></button>').join('');
            document.body.appendChild(cmdMenu);
            let cmdSel = -1;
            function cmdOpen() {
                const bar = (window.innerWidth > 600 && document.querySelector('.smg-tb-search')) || searchPop.querySelector('.smg-search-bar'); if (!bar) return;
                const r = bar.getBoundingClientRect();
                cmdMenu.classList.add('open');
                cmdMenu.style.left = Math.max(8, r.left) + 'px';
                cmdMenu.style.top = (r.bottom + 8) + 'px';
                cmdMenu.style.minWidth = Math.min(340, Math.max(240, r.width)) + 'px';
                cmdSetSel(0);
            }
            function cmdClose() { cmdMenu.classList.remove('open'); cmdSel = -1; }
            function cmdSetSel(i) {
                const items = cmdMenu.querySelectorAll('.smg-search-cmd-item'); if (!items.length) return;
                cmdSel = (i + items.length) % items.length;
                items.forEach((el, j) => el.classList.toggle('sel', j === cmdSel));
            }
            function cmdInsert(i) {
                const c = CMD_ITEMS[i]; if (!c) return;
                const inp = getSearchInput(); const v = inp.value.replace(/\s+$/, '');
                inp.value = (v ? v + ' ' : '') + c.ins;
                cmdClose(); inp.focus();
                try { const L = inp.value.length; inp.setSelectionRange(L, L); } catch (e) {}
                inp.dispatchEvent(new Event('input', { bubbles: true }));   // re-avalia (flags re-buscam; !a espera o nome)
            }
            cmdMenu.addEventListener('mousedown', e => { const it = e.target.closest && e.target.closest('.smg-search-cmd-item'); if (it) { e.preventDefault(); cmdInsert(+it.dataset.i); } });
            // CAPTURE: roda ANTES dos handlers de Enter→buscar; com o menu aberto, intercepta a navegação/seleção
            document.addEventListener('keydown', e => {
                if (!e.target.matches || !e.target.matches('.smg-tb-search-input, .smg-search-input')) return;
                const open = cmdMenu.classList.contains('open');
                if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); if (!open) cmdOpen(); else cmdSetSel(cmdSel + (e.shiftKey ? -1 : 1)); return; }
                if (!open) return;
                if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); cmdSetSel(cmdSel + 1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); cmdSetSel(cmdSel - 1); }
                else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); cmdInsert(cmdSel); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cmdClose(); }
                else cmdClose();   // qualquer outra tecla → fecha e segue digitando
            }, true);
            document.addEventListener('mousedown', e => { if (cmdMenu.classList.contains('open') && !(e.target.closest && (e.target.closest('.smg-search-cmd') || e.target.closest('.smg-tb-search-input, .smg-search-input')))) cmdClose(); });
            // botão ⇥ (indica que o Tab existe + abre a paleta no clique → também serve no mobile, que não tem Tab)
            document.addEventListener('click', e => {
                const b = e.target.closest && e.target.closest('.smg-search-cmdbtn'); if (!b) return;
                e.preventDefault(); e.stopPropagation();
                if (cmdMenu.classList.contains('open')) cmdClose(); else { cmdOpen(); try { getSearchInput().focus(); } catch (x) {} }
            });

            // ===== COMANDOS na barra: by:/from: (autor) · sort:new|top (data|relevância) · posts:/body: (corpo) · title: (só título) =====
            // devolve { keywords, by, order(bool=data), titles(null=auto | true | false) } e tira os comandos do texto buscado.
            // comandos com prefixo "!": !a <user> (autor) · !sn (data) · !st (relevância) · !t (só títulos) · !i (inclui o corpo).
            // \b evita falso-positivo (ex.: "!important" fica na busca). order: null=padrão | 'date' | 'rel'; titles: null=padrão | true | false.
            function parseCommands(raw) {
                let by = '', order = null, titles = null;
                const kw = (raw || '')
                    .replace(/(?:^|\s)!a\b\s+("[^"]+"|\S+)/gi, (m, v) => { by = v.replace(/^"|"$/g, ''); return ' '; })
                    .replace(/(?:^|\s)!sn\b/gi, () => { order = 'date'; return ' '; })
                    .replace(/(?:^|\s)!st\b/gi, () => { order = 'rel'; return ' '; })
                    .replace(/(?:^|\s)!t\b/gi, () => { titles = true; return ' '; })
                    .replace(/(?:^|\s)!i\b/gi, () => { titles = false; return ' '; })
                    .replace(/\s+/g, ' ').trim();
                return { keywords: kw, by: by, order: order, titles: titles };
            }
            // aplica o parse no estado. DEFAULT (sem comando) vem da config; `title:`/`posts:`/`sort:` sobrescrevem.
            function applyParsed(p) {
                if (searchBy) searchBy.value = p.by || '';
                orderDate = p.order ? (p.order === 'date') : cfgOrder;
                titlesOn = (p.titles != null) ? p.titles : (currentScope !== 'thread' && cfgTitles);   // em tópico nunca é só-título
            }
            // %LIKE%: a busca (MySQL fulltext) não acha por parte da palavra → wildcard de PREFIXO (termo* = LIKE 'termo%').
            // Infix real (%termo%) o fulltext não suporta; respeita aspas/operadores (+ - " *) do usuário. Liga/desliga na config.
            function likeify(q) {
                if (!cfgLike || !q || /[*"+\-]/.test(q)) return q;
                return q.split(/\s+/).map(w => (w.length >= 3 && /^[\wÀ-ſ]+$/.test(w)) ? w + '*' : w).join(' ');
            }

            // ---- histórico (últimos 1000, COMPARTILHADO entre os fóruns via GM storage) ----
            const SEARCH_HISTORY_KEY = 'smg-search-history';
            const HIST_CHUNK = 30;   // linhas por lote: expandido renderiza incremental no scroll (nunca monta as 1000 de uma vez)
            const HIST_MAX = 1000;
            const SCOPE_LABEL = { everywhere: 'Everywhere', threads: 'Threads', forum: 'This forum', thread: 'This thread' };
            let histExpanded = false;
            let histShown = 0;       // linhas já renderizadas na lista (índice do próximo lote)

            // gmGet/gmSet usam GM_*Value (mesmo storage do script em todos os domínios), com fallback localStorage
            // PERF: parse 1× por sessão (cache) — o JSON.parse de até 1000 entradas (~100KB) rodava a CADA
            // keystroke <3 chars (clearResults→renderHistory). Outra aba gravar não invalida o cache: staleness
            // aceitável (resolve no F5); esta aba sempre escreve via saveHistory, que atualiza o cache.
            let histCache = null;
            const loadHistory = () => { if (histCache) return histCache; try { histCache = JSON.parse(gmGet(SEARCH_HISTORY_KEY, '[]')) || []; } catch { histCache = []; } return histCache; };
            const saveHistory = arr => { histCache = arr; gmSet(SEARCH_HISTORY_KEY, JSON.stringify(arr)); };

            const histKey = e => (e.q || '') + '|' + (e.by || '') + '|' + (e.scope || '') + '|' + (e.titles ? 1 : 0) + '|' + (e.order || '');

            function addHistory(entry) {
                if (!entry.q && !entry.by) return;
                const k = histKey(entry);
                const arr = loadHistory().filter(e => histKey(e) !== k); // dedupe: move pro topo
                arr.unshift(entry);
                saveHistory(arr.slice(0, HIST_MAX));
            }

            function removeHistory(entry) {   // só persiste — a linha sai do DOM no handler do × (sem re-render → scroll preservado)
                const k = histKey(entry);
                saveHistory(loadHistory().filter(e => histKey(e) !== k));
            }

            // reconstrói o TEXTO da barra (keywords + comandos) a partir de uma entrada do histórico
            function entryToBar(e) {
                let s = e.q || '';
                if (e.by) s += ' !a ' + (/\s/.test(e.by) ? '"' + e.by + '"' : e.by);
                if (e.order === 'date') s += ' !sn';
                if (e.titles) s += ' !t';   // default é tudo → só recompõe o comando quando era só-títulos
                return s.trim();
            }
            function fillFromEntry(e) {
                applyingEntry = true;
                getSearchInput().value = entryToBar(e);
                currentScope = ((e.scope === 'thread' && threadId) || (e.scope === 'forum' && forumId)) ? e.scope : 'everywhere';   // só reusa o escopo se existe NESTA página
                applyScopeUI();
                applyingEntry = false;
            }
            function applyHistoryEntry(e) { fillFromEntry(e); doSearch(true); }            // clique na linha: busca direto (grava)
            function sendToBar(e) { fillFromEntry(e); getSearchInput().focus(); }       // ↖ manda pra barra SEM buscar (ajusta filtros e busca depois)
            function openOnOther(e) {                                                   // ↗ abre a MESMA busca no OUTRO fórum (simpcity ↔ smg)
                const other = /socialmediagirls/i.test(location.hostname) ? 'https://simpcity.cr/' : 'https://forums.socialmediagirls.com/';
                const payload = { q: e.q || '', by: e.by || '', titles: !!e.titles, threads: e.scope === 'threads', order: e.order || '' };
                window.open(other + '#smg-xsearch=' + encodeURIComponent(JSON.stringify(payload)), '_blank', 'noopener');
            }

            function buildHistRow(e) {
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'smg-search-hist-item';
                const tags = [];
                if (e.scope && e.scope !== 'everywhere') tags.push(i18n(SCOPE_LABEL[e.scope] || e.scope));
                if (e.q && e.by) tags.push(i18n('author') + ': ' + e.by);
                if (e.titles) tags.push(i18n('titles only'));
                if (e.order === 'date') tags.push(i18n('by date'));
                const otherLabel = /socialmediagirls/i.test(location.hostname) ? 'SimpCity' : 'SocialMediaGirls';
                row.innerHTML =
                    '<span class="smg-search-hist-ico">' + ICONS.search + '</span>' +
                    '<span class="smg-search-hist-q"></span>' +
                    (tags.length ? '<span class="smg-search-hist-meta"></span>' : '') +
                    '<span class="smg-search-hist-acts">' +
                        '<span class="smg-search-hist-act smg-search-hist-edit" role="button" aria-label="' + i18n('Edit in search bar') + '" title="' + i18n('Edit in search bar') + '">' + svgIcon('<line x1="17" y1="17" x2="7" y2="7"/><polyline points="7 17 7 7 17 7"/>') + '</span>' +
                        '<span class="smg-search-hist-act smg-search-hist-cross" role="button" aria-label="' + i18n('Search on') + ' ' + otherLabel + '" title="' + i18n('Search on') + ' ' + otherLabel + '">' + svgIcon('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>') + '</span>' +
                        '<span class="smg-search-hist-act smg-search-hist-remove" role="button" aria-label="' + i18n('Remove') + '">' + ICONS.close + '</span>' +
                    '</span>';
                row.querySelector('.smg-search-hist-q').textContent = e.q || (i18n('author') + ': ' + e.by);
                if (tags.length) row.querySelector('.smg-search-hist-meta').textContent = tags.join(' · ');
                row.addEventListener('click', () => applyHistoryEntry(e));
                row.querySelector('.smg-search-hist-edit').addEventListener('click', ev => { ev.stopPropagation(); sendToBar(e); });
                row.querySelector('.smg-search-hist-cross').addEventListener('click', ev => { ev.stopPropagation(); openOnOther(e); });
                row.querySelector('.smg-search-hist-remove').addEventListener('click', ev => {
                    ev.stopPropagation();
                    removeHistory(e);                       // persiste
                    row.remove();                           // tira SÓ a linha (sem re-render → o scroll fica onde está)
                    histShown = Math.max(0, histShown - 1);
                    const all = loadHistory();
                    searchHistBadge.textContent = all.length;
                    searchHistToggle.hidden = all.length <= 5;
                    if (!all.length) { renderHistory(); return; }   // zerou → estado vazio
                    if (histShown < all.length) {
                        if (!histExpanded && histShown < 5) appendHistChunk(all, 1);   // recolhido: repõe a 5ª linha
                        else if (histExpanded && searchHistList.scrollHeight - searchHistList.scrollTop - searchHistList.clientHeight < 220) appendHistChunk(all, 1);   // lista ficou curta → repõe
                    }
                });
                return row;
            }
            // anexa as próximas n linhas a partir de histShown (render incremental — as ~1000 nunca montam de uma vez)
            function appendHistChunk(all, n) {
                const end = Math.min(all.length, histShown + n);
                for (let i = histShown; i < end; i++) { const row = buildHistRow(all[i]); searchHistList.appendChild(row); i18nDom(row); }
                histShown = end;
            }
            function renderHistory() {
                const all = loadHistory();
                if (!all.length) { searchHistEl.hidden = true; searchEmptyEl.hidden = false; return; }   // sem histórico → estado vazio (não um toco só com a toolbar)
                searchEmptyEl.hidden = true;
                searchHistEl.hidden = false;
                searchHistBadge.textContent = all.length;
                // fechado: 5 mais recentes · aberto: lista SCROLLÁVEL (chunks de HIST_CHUNK conforme rola — substituiu a paginação ‹ ›)
                searchHistList.classList.toggle('smg-search-hist-list--scroll', histExpanded);
                searchHistList.scrollTop = 0;
                searchHistList.innerHTML = '';
                histShown = 0;
                appendHistChunk(all, histExpanded ? HIST_CHUNK : 5);
                searchHistToggle.hidden = all.length <= 5;
                searchHistToggle.textContent = histExpanded ? i18n('Show less') : i18n('Show all');
            }
            // perto do fundo → próximo lote (rAF-throttled, passive — padrão onScrollRaf, mas no scroll DA LISTA)
            let histScrollTick = false;
            searchHistList.addEventListener('scroll', () => {
                if (!histExpanded || histScrollTick) return;
                histScrollTick = true;
                requestAnimationFrame(() => {
                    histScrollTick = false;
                    if (searchHistList.scrollHeight - searchHistList.scrollTop - searchHistList.clientHeight >= 220) return;
                    const all = loadHistory();
                    if (histShown < all.length) appendHistChunk(all, HIST_CHUNK);
                });
            }, { passive: true });

            searchHistToggle.addEventListener('click', () => { histExpanded = !histExpanded; renderHistory(); });
            searchHistClear.addEventListener('click', () => {
                if (!confirm(i18n('Clear all recent searches?'))) return;   // confirma antes de apagar
                saveHistory([]); histExpanded = false; renderHistory();
            });

            // mobile: mantém o sheet ACIMA do teclado e sem passar do topo da tela (visualViewport)
            const vv = window.visualViewport;
            function syncSearchKeyboard() {
                if (!vv || !searchOverlay.classList.contains('open')) return;
                if (window.innerWidth > 600) { searchPop.style.bottom = ''; searchPop.style.maxHeight = ''; return; }
                const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));  // altura do teclado
                searchPop.style.bottom = kb + 'px';                            // encosta acima do teclado
                searchPop.style.maxHeight = Math.round(vv.height - 8) + 'px';  // nunca ultrapassa o topo visível
            }
            if (vv) { vv.addEventListener('resize', syncSearchKeyboard); vv.addEventListener('scroll', syncSearchKeyboard); }

            // DROPDOWN (desktop): ancora o pop abaixo do input REAL da topbar. MODAL (mobile/sem topbar): centralizado, como antes.
            const isDrop = () => window.innerWidth > 600 && !!document.querySelector('.smg-tb-search-input');
            function positionDrop() {
                const bar = document.querySelector('.smg-tb-search'); if (!bar) return;
                const r = bar.getBoundingClientRect();
                const w = Math.min(Math.max(r.width, 460), window.innerWidth - 16);
                let left = r.left; if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w; if (left < 8) left = 8;
                // writes guardados: o followDrop roda por frame — só escreve quando a âncora moveu de fato
                const t = (r.bottom + 8) + 'px', l = left + 'px', ww = w + 'px';
                if (searchPop.style.top !== t) searchPop.style.top = t;
                if (searchPop.style.left !== l) searchPop.style.left = l;
                if (searchPop.style.width !== ww) searchPop.style.width = ww;
            }
            // a topbar tem 2 alturas (76 ↔ 56 no .floating, com transição de 220ms) → enquanto o dropdown
            // está aberto, SEGUE a âncora a cada frame (1 rect + writes guardados num único elemento; o
            // loop morre sozinho ao fechar). Posicionar só no open deixava o pop descolado/sobreposto
            // quando a topbar encolhia/voltava com a busca aberta.
            let dropFollow = 0;
            function followDrop() {
                if (!searchOverlay.classList.contains('open') || !searchPop.classList.contains('smg-search-pop--drop')) { dropFollow = 0; return; }
                positionDrop();
                dropFollow = requestAnimationFrame(followDrop);
            }
            function openSearch() {
                closePopovers();
                histExpanded = false; // sempre abre recolhido (5 recentes)
                clearResults();   // some com os resultados da busca anterior + re-renderiza o histórico
                if (searchHistList.classList.contains('smg-search-hist-list--scroll')) renderHistory();   // fechou expandido → o clearResults pulou o render (histórico visível); força voltar pros 5
                applyScopeUI();   // reflete o chip de contexto + placeholder ao abrir
                const drop = isDrop();
                searchOverlay.classList.toggle('smg-search-overlay--drop', drop);
                searchPop.classList.toggle('smg-search-pop--drop', drop);
                if (drop) { positionDrop(); if (!dropFollow) dropFollow = requestAnimationFrame(followDrop); }
                else { searchPop.style.top = ''; searchPop.style.left = ''; searchPop.style.width = ''; }
                searchOverlay.classList.add('open');
                document.documentElement.classList.add('smg-search-open');   // mostra o botão Buscar dentro do input da topbar (CSS)
                // foco síncrono mantém o gesto p/ abrir o teclado no mobile (no desktop o input já é o da topbar, foco é no-op)
                getSearchInput().focus({ preventScroll: true });
                if (!drop) { syncSearchKeyboard(); setTimeout(syncSearchKeyboard, 260); }   // mobile: ajusta acima do teclado
            }

            function closeSearch() {
                searchOverlay.classList.remove('open');
                document.documentElement.classList.remove('smg-search-open');
                searchPop.style.bottom = ''; searchPop.style.maxHeight = '';   // limpa pra animação de saída
                searchPop.style.top = ''; searchPop.style.left = ''; searchPop.style.width = '';   // limpa o posicionamento do dropdown
            }

            function doSearch(addToHistory) {
                const p = parseCommands(getSearchInput().value);
                applyParsed(p);                          // by:/sort:/posts: → estado (searchBy/orderDate/titlesOn)
                const q = p.keywords, by = p.by;
                if (!q && !by) return;

                if (addToHistory) addHistory({ q, by, scope: currentScope, titles: titlesOn, order: orderDate ? 'date' : '', t: Date.now() });   // grava as KEYWORDS limpas + filtros (reconstrói os comandos ao reabrir)

                const token = qsForm?.querySelector('input[name="_xfToken"]')?.value
                    || document.querySelector('input[name="_xfToken"]')?.value || '';

                const fields = [['keywords', likeify(q)], ['_xfToken', token]];   // wildcard de prefixo p/ achar por parte da palavra (ambos os fóruns)
                // ESCOPO: dentro do tópico busca POSTS (c[thread]); no fórum, posts dos nós (com filhos). title_only só faz sentido fora do tópico.
                if (currentScope === 'thread' && threadId) fields.push(['c[thread]', threadId], ['search_type', 'post']);   // search_type=post é OBRIGATÓRIO p/ restringir À thread (senão o XF busca threads no global e ignora c[thread])
                else if (currentScope === 'forum' && forumId) fields.push(['c[nodes][0]', forumId], ['c[child_nodes]', '1']);
                if (titlesOn && currentScope !== 'thread') fields.push(['c[title_only]', '1']);
                if (by) fields.push(['c[users]', by]);
                if (orderDate) fields.push(['order', 'date']);   // omitido = relevance (default do XF)

                runSearchInline(fields);
            }
            // === busca INLINE: faz o fetch dos resultados e mostra NO PRÓPRIO dropdown (em vez de navegar) ===
            let searchSeq = 0, searchAbort = null;
            function runSearchInline(fields) {
                const seq = ++searchSeq;
                if (searchAbort) searchAbort.abort();   // mata o POST anterior (full-text é caro no servidor; o seq só descartava a RESPOSTA — a request continuava rodando)
                const ctrl = searchAbort = (typeof AbortController === 'function') ? new AbortController() : null;
                searchHistEl.hidden = true;   // esconde o histórico enquanto mostra resultados
                searchEmptyEl.hidden = true;
                searchResultsEl.hidden = false;
                searchResultsEl.innerHTML = '<div class="smg-search-rloading"><span class="smg-loading"></span></div>';
                const body = fields.map(f => encodeURIComponent(f[0]) + '=' + encodeURIComponent(f[1])).join('&');
                fetch(searchAction, { method: 'POST', body: body, credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl ? ctrl.signal : undefined })
                    .then(r => r.text().then(html => ({ html: html, url: r.url })))
                    .then(o => { if (seq === searchSeq) paintResults(parseSearchResults(new DOMParser().parseFromString(o.html, 'text/html')), o.url); })
                    .catch(err => { if (seq === searchSeq && !(err && err.name === 'AbortError')) searchResultsEl.innerHTML = '<div class="smg-search-noresults">' + i18n('Search failed') + '</div>'; });
            }
            function parseSearchResults(doc) {
                const out = [];
                doc.querySelectorAll('.block-body .contentRow').forEach(row => {
                    const a = row.querySelector('.contentRow-title a[href], h3 a[href], .contentRow-main a[href]');
                    if (!a) return;
                    let href = a.getAttribute('href') || '';
                    try { href = new URL(href, location.href).href; } catch (e) {}
                    const snip = row.querySelector('.contentRow-snippet');
                    const minor = row.querySelector('.contentRow-minor');
                    // prefixos/tags: SimpCity usa .label; SMG usa .prefix (mesma divergência dos alertas) → seletor cobre os dois, senão a tag vaza no título ("YoutubersGals Of Gurk")
                    const LABEL_SEL = '.label, .label-append, [class*="label--"], .prefix, [class*="prefix"]';
                    const titleEl = a.closest('.contentRow-title') || a.parentElement;
                    const labels = titleEl ? Array.from(titleEl.querySelectorAll(LABEL_SEL)) : [];
                    const aClone = a.cloneNode(true);   // tags vêm DENTRO do <a> → tira do texto do título (senão duplica/cola)
                    aClone.querySelectorAll(LABEL_SEL).forEach(l => l.remove());
                    // FOTO = thumbnail do tópico (.structItem-cell--icon > .dcThumbnail; a URL real está no background-image do <img>). Reusa o dcThumbUrl.
                    const thumbEl = row.querySelector('.dcThumbnail');
                    let photo = thumbEl ? dcThumbUrl(thumbEl) : '';
                    if (/no_image|defaultThumbnail/i.test(photo)) photo = '';   // placeholder "sem imagem" → ignora
                    out.push({
                        href: href,
                        title: aClone.textContent.replace(/\s+/g, ' ').trim(),
                        snippet: snip ? snip.textContent.replace(/\s+/g, ' ').trim() : '',
                        meta: minor ? minor.textContent.replace(/\s+/g, ' ').trim() : '',
                        photo: photo,   // URL do thumbnail (string) — img limpa no paint (sem clonar <a> aninhado)
                        labels: labels.map(l => document.importNode(l, true)),  // tags/prefixos originais
                    });
                });
                return out;
            }
            // clicar num resultado (ou "Ver todos") TAMBÉM grava a busca no histórico — antes só Enter/Buscar gravava, então type→clica-link se perdia
            function commitCurrentSearch() {
                const p = parseCommands(getSearchInput().value);
                addHistory({ q: p.keywords, by: p.by, scope: currentScope, titles: (p.titles === true), order: p.order ? 'date' : '', t: Date.now() });
            }
            // termos p/ highlight = keywords digitadas (sem comandos/aspas/wildcard), ≥2 chars
            function hlTerms() {
                const kw = (parseCommands(getSearchInput().value).keywords || '');
                return kw.split(/\s+/).map(s => s.replace(/["*]/g, '').trim()).filter(s => s.length >= 2);
            }
            // escreve `text` em `el` envolvendo as ocorrências dos termos em <mark> (text nodes → SEM injeção de HTML).
            // como a busca usa wildcard de prefixo, o termo "fileste" destaca a palavra inteira "filester" ([\w] após o termo).
            function setHL(el, text, terms) {
                el.textContent = '';
                if (!terms.length || !text) { el.textContent = text || ''; return; }
                const esc = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\w]*');
                let re; try { re = new RegExp('(' + esc.join('|') + ')', 'ig'); } catch (e) { el.textContent = text; return; }
                let last = 0, m;
                while ((m = re.exec(text))) {
                    if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
                    const mk = document.createElement('mark'); mk.className = 'smg-search-hl'; mk.textContent = m[0];
                    el.appendChild(mk);
                    last = m.index + m[0].length;
                    if (re.lastIndex === m.index) re.lastIndex++;   // guarda contra match vazio
                }
                if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
            }
            function paintResults(results, finalUrl) {
                searchResultsEl.innerHTML = '';
                const terms = hlTerms();
                if (!results.length) {
                    const e = document.createElement('div'); e.className = 'smg-search-noresults'; e.textContent = i18n('No results');
                    searchResultsEl.appendChild(e);
                } else {
                    results.slice(0, 20).forEach(r => {
                        const a = document.createElement('a');
                        a.className = 'smg-search-result'; a.href = r.href;
                        if (r.photo) {   // foto = thumbnail do tópico (esquerda)
                            const f = document.createElement('span'); f.className = 'smg-search-result-fig';
                            const img = document.createElement('img'); img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.alt = '';
                            img.src = r.photo;
                            img.addEventListener('error', () => f.remove(), { once: true });   // falhou/mixed-content → some (sem broken-img)
                            f.appendChild(img); a.appendChild(f);
                        }
                        const main = document.createElement('span'); main.className = 'smg-search-result-main';
                        const tr = document.createElement('span'); tr.className = 'smg-search-result-titlerow';
                        (r.labels || []).forEach(l => tr.appendChild(l));   // tags/prefixos originais (antes do título, estilo do fórum)
                        const t = document.createElement('span'); t.className = 'smg-search-result-title'; setHL(t, r.title, terms); tr.appendChild(t);
                        main.appendChild(tr);
                        if (r.snippet) { const s = document.createElement('span'); s.className = 'smg-search-result-snippet'; setHL(s, r.snippet, terms); main.appendChild(s); }
                        if (r.meta) { const m = document.createElement('span'); m.className = 'smg-search-result-meta'; m.textContent = r.meta; main.appendChild(m); }
                        a.appendChild(main);
                        a.addEventListener('click', commitCurrentSearch);   // grava a busca ao abrir o resultado
                        searchResultsEl.appendChild(a);
                    });
                }
                if (finalUrl && /\/search\//.test(finalUrl)) {
                    const all = document.createElement('a');
                    all.className = 'smg-search-result-all'; all.href = finalUrl;
                    all.innerHTML = '<span class="smg-search-all-t"></span>' + ICONS.arrowRight;
                    all.querySelector('.smg-search-all-t').textContent = i18n('See all results');
                    all.addEventListener('click', commitCurrentSearch);   // "Ver todos" também grava
                    searchResultsEl.appendChild(all);
                }
                searchResultsEl.hidden = false;
            }
            function clearResults() {   // volta pro histórico — sem re-render se ele JÁ está na tela (era rebuild por keystroke)
                if (!searchResultsEl.hidden) { searchResultsEl.hidden = true; searchResultsEl.innerHTML = ''; }
                if (searchHistEl.hidden && searchEmptyEl.hidden) renderHistory();
            }
            // DEBOUNCE: busca enquanto digita (não grava histórico; só Enter/Buscar grava). Delegado: vale pro input da topbar E do modal + autor.
            let searchDebounce = null;
            function onSearchInput() {
                clearTimeout(searchDebounce);
                const p = parseCommands(getSearchInput().value);
                if (p.keywords.length < 3 && !p.by) { clearResults(); return; }   // vazio/curto demais → histórico (XF tem mínimo de caracteres)
                searchDebounce = setTimeout(() => doSearch(false), 420);
            }
            document.addEventListener('input', e => { if (e.target && e.target.matches && e.target.matches('.smg-tb-search-input, .smg-search-input')) onSearchInput(); });
            // mudança de FILTRO (escopo via chip) re-busca JÁ (sem debounce) se já existe query. Hoisted → ok no init.
            function researchOnFilter() {
                if (applyingEntry) return;
                const p = parseCommands(getSearchInput().value);
                if (p.keywords.length < 3 && !p.by) return;
                clearTimeout(searchDebounce);
                doSearch(false);
            }

            searchInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); clearTimeout(searchDebounce); doSearch(true); }
                else if (e.key === 'Escape') closePopovers();
            });
            searchPop.querySelector('.smg-search-go').addEventListener('click', () => { clearTimeout(searchDebounce); doSearch(true); });

            btnSearch.addEventListener('click', e => {
                e.stopPropagation();
                if (searchOverlay.classList.contains('open')) closeSearch();
                else openSearch();
            });

            // fechar: botão X, clique no backdrop (modal), Esc
            searchPop.querySelector('.smg-search-close').addEventListener('click', closeSearch);
            searchOverlay.addEventListener('click', e => { if (e.target === searchOverlay) closeSearch(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && searchOverlay.classList.contains('open')) closeSearch(); });

            // abrir/fechar disparado pela topbar (input real) via eventos custom — desacopla do escopo do dock
            document.addEventListener('smg-search-open', openSearch);
            document.addEventListener('smg-search-close', closeSearch);
            // DROPDOWN (desktop): o overlay é pointer-events:none, então o clique-no-backdrop não vale — fecha ao clicar FORA do pop e da search bar
            document.addEventListener('pointerdown', e => {
                if (!searchOverlay.classList.contains('open') || !searchPop.classList.contains('smg-search-pop--drop')) return;
                if (searchPop.contains(e.target) || (e.target.closest && e.target.closest('.smg-tb-search, .smg-search-cmd, .smg-search-cfg-portal'))) return;   // portais (paleta/config) ficam no body → não contam como "fora"
                closeSearch();
            }, true);
            window.addEventListener('resize', () => { if (searchOverlay.classList.contains('open') && searchPop.classList.contains('smg-search-pop--drop')) positionDrop(); });
            // arrastar pra baixo fecha o modal de busca (mobile; não no dropdown do desktop)
            addSwipeClose(searchPop, closeSearch, () => searchOverlay.classList.contains('open') && !searchPop.classList.contains('smg-search-pop--drop'));
        };
        setupSearch();

        // ---- settings (engrenagem) ----
        const setupSettings = () => {
            btnSettings.addEventListener('click', e => {
                e.stopPropagation();
                if (navWrapper.classList.contains('settings-open')) closePopovers();
                else { closePopovers(); navWrapper.classList.add('settings-open'); }
            });
            // toggles (FEATURES)
            settingsPop.querySelectorAll('input[data-feat]').forEach(inp => {
                inp.addEventListener('change', () => { FEATURES[inp.dataset.feat] = inp.checked; saveFeatures(); });
            });
            // sliders (tunables do feed → gmSet; aplicam na próxima abertura do feed)
            settingsPop.querySelectorAll('input[data-tune]').forEach(inp => {
                inp.addEventListener('input', () => {
                    gmSet(inp.dataset.tune, String(inp.value));
                    const badge = inp.parentElement.querySelector('.smg-set-val'); if (badge) badge.textContent = inp.value;
                });
            });
            // versão (do gerenciador de userscript)
            const verEl = settingsPop.querySelector('.smg-set-ver');
            if (verEl) verEl.textContent = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? 'v' + GM_info.script.version : '';
            // fechar (×) + recarregar
            settingsPop.querySelector('.smg-set-x').addEventListener('click', e => { e.stopPropagation(); closePopovers(); });
            settingsPop.querySelector('.smg-set-reload').addEventListener('click', () => location.reload());
            // restaurar padrões: zera FEATURES + tunables e recarrega
            settingsPop.querySelector('.smg-set-reset').addEventListener('click', () => {
                if (!confirm(i18n('Restore default settings?'))) return;
                Object.assign(FEATURES, DEFAULT_FEATURES); saveFeatures();
                SET_TUNABLES.forEach(t => gmSet(t.key, ''));   // limpa → volta ao default no código
                location.reload();
            });
            // rail de categorias + busca (filtra entre todas)
            const setTabs = Array.prototype.slice.call(settingsPop.querySelectorAll('.smg-set-tab'));
            const setSecs = Array.prototype.slice.call(settingsPop.querySelectorAll('.smg-set-sec'));
            const setEmpty = settingsPop.querySelector('.smg-set-empty');
            const setQ = settingsPop.querySelector('.smg-set-q');
            const setContentEl = settingsPop.querySelector('.smg-set-content');
            let setActive = 0;
            function setShowTab(i) {
                setActive = i; if (setQ) setQ.value = ''; settingsPop.classList.remove('searching'); if (setEmpty) setEmpty.hidden = true;
                setSecs.forEach((s, j) => { s.hidden = j !== i; s.querySelectorAll('[data-q]').forEach(r => { r.style.display = ''; }); });
                setTabs.forEach((t, j) => t.classList.toggle('active', j === i));
                if (setContentEl) setContentEl.scrollTop = 0;
            }
            setTabs.forEach((t, i) => t.addEventListener('click', e => { e.stopPropagation(); setShowTab(i); }));
            if (setQ) {
                setQ.addEventListener('keydown', e => e.stopPropagation());
                setQ.addEventListener('input', () => {
                    const term = setQ.value.trim().toLowerCase();
                    if (!term) { setShowTab(setActive); return; }
                    settingsPop.classList.add('searching'); setTabs.forEach(t => t.classList.remove('active'));
                    let any = false;
                    setSecs.forEach(s => {
                        let vis = false;
                        s.querySelectorAll('[data-q]').forEach(r => { const m = r.getAttribute('data-q').indexOf(term) !== -1; r.style.display = m ? '' : 'none'; if (m) { vis = true; any = true; } });
                        s.hidden = !vis;
                    });
                    if (setEmpty) setEmpty.hidden = any;
                });
            }

            // FAB de configurações: nas páginas onde a dock fica escondida (baronly no desktop), garante
            // acesso ao mod. Clique → revela a dock (só a engrenagem) + abre o settings. O closePopovers reseta.
            if (navWrapper.classList.contains('smg-dock-baronly') && !document.getElementById('smg-settings-fab')) {
                const fab = document.createElement('button');
                fab.id = 'smg-settings-fab';
                fab.type = 'button';
                fab.title = i18n('Settings');
                fab.setAttribute('aria-label', i18n('Settings'));
                fab.innerHTML = '<span class="smg-nav-ico">' + ICONS.settings + '</span>';   // mesmo wrapper da dock (fill:none → outline, não blob)
                fab.addEventListener('click', e => {
                    e.stopPropagation();
                    if (navWrapper.classList.contains('settings-open')) { closePopovers(); return; }
                    closePopovers();
                    navWrapper.classList.add('smg-dock-show', 'settings-open');
                });
                document.body.appendChild(fab);
            }
        };
        setupSettings();

        // ---- filtro por autor ----
        const setupAuthorFilter = () => {
            if (!filterPop) return;
            const opAuthor = (document.querySelector('.message--post')?.getAttribute('data-author') || '').trim();
            const curAuthorOf = () => (getPostElement(getCurrentPostIndex())?.getAttribute('data-author') || '').trim();
            const filterInput = filterPop.querySelector('.smg-filter-input');
            const quick = filterPop.querySelector('.smg-filter-quick');

            const syncChips = () => quick.querySelectorAll('.smg-filter-chip').forEach(c =>
                c.classList.toggle('active', !!authorFilter && c.dataset.author?.toLowerCase() === authorFilter));

            const setFilter = name => {
                authorFilter = name ? name.toLowerCase() : null;
                applyAuthorFilter(true);   // troca de filtro → re-avalia TODOS os posts (não só os novos)
                btnFilter.classList.toggle('smg-active', !!authorFilter);
                setBtnLabel(btnFilter, name ? (i18n('Filtering') + ': ' + name) : 'Filter by author');
                syncChips();
                closePopovers();
            };

            const addChip = (name, label) => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'smg-filter-chip';
                chip.dataset.author = name;
                chip.textContent = label || name;
                chip.addEventListener('click', () => setFilter(name));
                quick.appendChild(chip);
            };

            btnFilter.addEventListener('click', e => {
                e.stopPropagation();
                if (navWrapper.classList.contains('filter-open')) { closePopovers(); return; }
                closePopovers();
                // chips rápidos: OP + autor do post em foco
                quick.innerHTML = '';
                if (opAuthor) addChip(opAuthor, opAuthor + ' (OP)');
                const cur = curAuthorOf();
                if (cur && cur.toLowerCase() !== opAuthor.toLowerCase()) addChip(cur);
                syncChips();
                filterInput.value = '';
                navWrapper.classList.add('filter-open');
                setTimeout(() => filterInput.focus({ preventScroll: true }), 0);
            });

            filterPop.querySelector('.smg-filter-apply').addEventListener('click', () => {
                const v = filterInput.value.trim();
                if (v) setFilter(v);
            });
            filterInput.addEventListener('keydown', ev => {
                if (ev.key === 'Enter') { ev.preventDefault(); const v = filterInput.value.trim(); if (v) setFilter(v); }
                else if (ev.key === 'Escape') closePopovers();
            });
            filterPop.querySelector('.smg-filter-clear').addEventListener('click', () => setFilter(null));
        };
        setupAuthorFilter();

        // ---- filtro da listagem (fórum): popover reimplementada no nosso estilo ----
        const setupListFilter = () => {
            if (!listFilterPop) return;
            const lfBody = listFilterPop.querySelector('.smg-lf-body');
            let lfLoaded = false, lfData = null;

            const lfRow = label => {
                const row = document.createElement('div');
                row.className = 'smg-lf-row';
                if (label) { const l = document.createElement('div'); l.className = 'smg-lf-label'; l.textContent = label; row.appendChild(l); }
                return row;
            };
            const cloneSel = orig => { const s = document.importNode(orig, true); s.className = 'smg-lf-select'; s.removeAttribute('id'); s.removeAttribute('aria-labelledby'); return s; };

            function buildListFilter(form) {
                lfData = { action: form.getAttribute('action') || location.pathname, token: form.querySelector('input[name="_xfToken"]')?.value || '' };
                lfBody.innerHTML = '';

                // Em destaque (toggle)
                const featOrig = form.querySelector('input[name="featured"]');
                let featChip = null;
                if (featOrig) {
                    const row = lfRow('');
                    featChip = document.createElement('button');
                    featChip.type = 'button';
                    featChip.className = 'smg-chip smg-chip-toggle' + (featOrig.checked ? ' active' : '');
                    featChip.dataset.on = featOrig.checked ? '1' : '0';
                    featChip.innerHTML = '<span class="smg-chip-check">' + svgIcon('<path d="M20 6 9 17l-5-5"/>') + '</span>Apenas em destaque';
                    featChip.addEventListener('click', () => { const on = featChip.dataset.on !== '1'; featChip.dataset.on = on ? '1' : '0'; featChip.classList.toggle('active', on); });
                    row.appendChild(featChip);
                    lfBody.appendChild(row);
                }

                // Prefixos (chips com a cor do label do fórum)
                const prefixSelect = form.querySelector('select[name="prefix_id[]"]');
                let chipsWrap = null;
                if (prefixSelect) {
                    const row = lfRow('Prefixo');
                    chipsWrap = document.createElement('div');
                    chipsWrap.className = 'smg-lf-chips';
                    const makeChip = opt => {
                        const chip = document.createElement('button');
                        chip.type = 'button';
                        chip.className = 'smg-chip smg-lf-prefix' + (opt.selected ? ' active' : '');
                        chip.dataset.value = opt.value;
                        chip.dataset.on = opt.selected ? '1' : '0';
                        const lc = opt.getAttribute('data-label-class');
                        if (lc) { const s = document.createElement('span'); s.className = lc; s.textContent = opt.textContent.trim(); chip.appendChild(s); }
                        else chip.textContent = opt.textContent.trim();
                        chip.addEventListener('click', () => { const on = chip.dataset.on !== '1'; chip.dataset.on = on ? '1' : '0'; chip.classList.toggle('active', on); });
                        return chip;
                    };
                    Array.from(prefixSelect.children).forEach(node => {
                        if (node.tagName === 'OPTGROUP') {
                            const h = document.createElement('div'); h.className = 'smg-lf-group'; h.textContent = node.label;
                            chipsWrap.appendChild(h);
                            Array.from(node.children).forEach(opt => chipsWrap.appendChild(makeChip(opt)));
                        } else if (node.tagName === 'OPTION' && node.value !== '-1') { // (Any) = nenhum selecionado
                            chipsWrap.appendChild(makeChip(node));
                        }
                    });
                    row.appendChild(chipsWrap);
                    lfBody.appendChild(row);
                }

                // Iniciado por
                const starterOrig = form.querySelector('input[name="starter"]');
                let starterInput = null;
                if (starterOrig) {
                    const row = lfRow('Started by');
                    starterInput = document.createElement('input');
                    starterInput.type = 'text';
                    starterInput.className = 'smg-lf-input';
                    starterInput.placeholder = 'Username';
                    starterInput.value = starterOrig.value || '';
                    row.appendChild(starterInput);
                    lfBody.appendChild(row);
                }

                // Última atualização
                const lastOrig = form.querySelector('select[name="last_days"]');
                let lastClone = null;
                if (lastOrig) { const row = lfRow('Last updated'); lastClone = cloneSel(lastOrig); row.appendChild(lastClone); lfBody.appendChild(row); }

                // Ordenar por + direção
                const orderOrig = form.querySelector('select[name="order"]');
                const dirOrig = form.querySelector('select[name="direction"]');
                let orderClone = null, dirClone = null;
                if (orderOrig && dirOrig) {
                    const row = lfRow('Sort by');
                    const sort = document.createElement('div'); sort.className = 'smg-lf-sort';
                    orderClone = cloneSel(orderOrig); dirClone = cloneSel(dirOrig);
                    sort.append(orderClone, dirClone);
                    row.appendChild(sort);
                    lfBody.appendChild(row);
                }

                // Filtrar
                const apply = document.createElement('button');
                apply.type = 'button';
                apply.className = 'smg-lf-apply';
                apply.textContent = 'Filter';
                apply.addEventListener('click', () => {
                    const fields = [['_xfToken', lfData.token], ['apply', '1']];
                    if (featChip && featChip.dataset.on === '1') fields.push(['featured', '1']);
                    if (chipsWrap) chipsWrap.querySelectorAll('.smg-lf-prefix[data-on="1"]').forEach(c => fields.push(['prefix_id[]', c.dataset.value]));
                    const sv = starterInput ? starterInput.value.trim() : '';
                    if (sv) fields.push(['starter', sv]);
                    if (lastClone) fields.push(['last_days', lastClone.value]);
                    if (orderClone) fields.push(['order', orderClone.value]);
                    if (dirClone) fields.push(['direction', dirClone.value]);
                    postForm(lfData.action, fields);
                });
                lfBody.appendChild(apply);
                i18nDom(lfBody);
            }

            const tryBuild = form => {
                if (!form) return false;
                try { buildListFilter(form); } catch (err) { console.warn('[smg] erro ao montar filtro', err); lfBody.textContent = i18n('Error building the filter.'); }
                return true;
            };

            // fallback: usa o loader nativo do XenForo (carrega o form em .js-filterMenuBody, escondido)
            const loadViaNative = () => {
                const trigger = document.querySelector('.filterBar-menuTrigger');
                const menuBody = document.querySelector('.filterBar .js-filterMenuBody');
                if (!trigger || !menuBody) { lfBody.textContent = i18n('Filter unavailable.'); return; }
                if (tryBuild(menuBody.querySelector('form'))) return; // já carregado antes

                // esconde o menu nativo onde quer que o XF o posicione (pode reparentar pro body)
                const closeNative = () => document.querySelectorAll('.menu[data-href*="filters"]').forEach(m => {
                    m.classList.remove('is-active');
                    m.setAttribute('aria-hidden', 'true');
                });
                const hide = document.createElement('style');
                hide.textContent = '.menu[data-href*="filters"]{opacity:0!important;pointer-events:none!important}';
                document.head.appendChild(hide);
                const sy = window.scrollY;
                trigger.click(); // dispara só o AJAX nativo (o menu fica invisível)

                let tries = 0;
                const poll = setInterval(() => {
                    const f = menuBody.querySelector('form');
                    if (f) {
                        clearInterval(poll);
                        tryBuild(f);            // lê os valores do form nativo
                        closeNative();          // fecha o menu nativo de vez
                        window.scrollTo(0, sy); // desfaz o scroll do autofocus
                        setTimeout(() => hide.remove(), 60);
                    } else if (++tries > 60) {
                        clearInterval(poll);
                        closeNative();
                        hide.remove();
                        lfLoaded = false;
                        lfBody.textContent = i18n('Error loading the filter.');
                    }
                }, 100);
            };

            function loadListFilter() {
                if (lfLoaded) return;
                lfLoaded = true;
                const url = document.querySelector('.filterBar .menu[data-href]')?.getAttribute('data-href');
                if (!url) { loadViaNative(); return; }
                const tok = (document.documentElement.getAttribute('data-csrf') || '').trim();
                fetch(url + (url.includes('?') ? '&' : '?') + '_xfResponseType=json&_xfWithData=1' + (tok ? '&_xfToken=' + encodeURIComponent(tok) : ''), { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
                    .then(r => r.text())
                    .then(text => {
                        let h = text;
                        try {
                            const j = JSON.parse(text);
                            if (j && j.html && typeof j.html === 'object' && j.html.content) h = j.html.content;
                            else if (j && typeof j.html === 'string') h = j.html;
                        } catch {}
                        const form = new DOMParser().parseFromString(h, 'text/html').querySelector('form');
                        if (!tryBuild(form)) loadViaNative(); // fetch sem form → fallback nativo
                    })
                    .catch(err => { console.warn('[smg] erro no fetch do filtro', err); loadViaNative(); });
            }

            btnListFilter.addEventListener('click', e => {
                e.stopPropagation();
                if (navWrapper.classList.contains('listfilter-open')) { closePopovers(); return; }
                closePopovers();
                navWrapper.classList.add('listfilter-open');
                loadListFilter();
            });
        };
        setupListFilter();

        // fecha os popovers da dock (goto/config/filtro) ao clicar fora — o search tem backdrop próprio
        document.addEventListener('click', e => {
            if (!navWrapper.classList.contains('goto-open') && !navWrapper.classList.contains('settings-open')
                && !navWrapper.classList.contains('filter-open') && !navWrapper.classList.contains('listfilter-open')) return;
            const inside = gotoPop.contains(e.target)
                || settingsPop.contains(e.target) || (filterPop && filterPop.contains(e.target))
                || (listFilterPop && listFilterPop.contains(e.target))
                || btnGoto.contains(e.target)
                || btnSettings.contains(e.target) || (btnFilter && btnFilter.contains(e.target))
                || (btnListFilter && btnListFilter.contains(e.target))
                || (e.target.closest && e.target.closest('.filterBar')); // não fecha ao usar o loader nativo
            if (!inside) closePopovers();
        });

        // ---- helpers de post ----
        let lastPostScan = 0, lastScanHeight = 0;
        function refreshPosts() {   // scroll infinito anexa posts DEPOIS do build → re-materializa a lista (só quando cresce)
            const h = document.documentElement.scrollHeight;
            if (h === lastScanHeight) return;   // nada anexado desde o último scan → poupa o qSA doc-wide + closest por anchor
            lastScanHeight = h;
            let p = Array.from(document.querySelectorAll('span.u-anchorTarget[id^="post-"]')).filter(el => !el.closest('.message-responseRow'));
            if (!p.length) p = Array.from(document.querySelectorAll('.message'));
            if (p.length > posts.length) posts = p;
        }
        function getCurrentPostIndex() {
            const refY = 100;

            let closestIndex = 0;
            let closestDist = Infinity;

            for (let i = 0; i < posts.length; i++) {
                const top = posts[i].getBoundingClientRect().top;
                const dist = Math.abs(top - refY);
                if (dist < closestDist) { closestDist = dist; closestIndex = i; }
                if (top > refY) break;   // posts em ordem do DOM → tops monotônicos; daqui pra frente só aumenta a distância
            }

            return closestIndex;
        }

        function scrollToPost(index) {
            if (index < 0 || index >= posts.length) return;

            const el = posts[index];
            if (el instanceof HTMLElement) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        function getPostElement(index) {
            const anchor = posts[index];
            if (!anchor) return null;
            return anchor.closest('.message') || anchor.parentElement;
        }

        // estado dos botões prev/next/goto: depende só de constantes capturadas no mount → seta 1× (não no scroll)
        function updatePostButtonsState() {
            btnPagePrev.disabled = !prevPageLink;
            btnPageNext.disabled = !nextPageLink;
            btnGoto.disabled = !pageJump;
        }
        // sondagem "cheguei no fim da lista?" (scroll infinito anexou posts) — throttled 800ms.
        // ANTES: updatePostButtonsState rodava getCurrentPostIndex() (loop de getBoundingClientRect sobre
        // TODOS os posts) a CADA frame de scroll só pra gatear isto. Agora o rect-loop só roda quando o
        // throttle libera; o estado dos botões (constante) saiu do caminho do scroll.
        function pollEndOfList() {
            const now = Date.now();
            if (now - lastPostScan <= 800) return;
            lastPostScan = now;
            // "perto do fim?" só precisa do ÚLTIMO anchor (1 rect) — getCurrentPostIndex() lia o rect de
            // TODOS os posts até o atual (O(N) num thread fundo) só pra gatear este refresh
            const last = posts[posts.length - 1];
            if (last && last.getBoundingClientRect().top < window.innerHeight * 2) refreshPosts();
        }

        // ---- scroll topo / fundo (substituem o nav de post) ----
        btnUp.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        btnDown.addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));

        // ---- share ----
        btnShare.addEventListener('click', async () => {
            const anchor = posts[getCurrentPostIndex()];
            if (!anchor?.id) return;

            const url = window.location.origin + window.location.pathname + '#' + anchor.id;

            try {
                await navigator.clipboard.writeText(url);
                setBtnIcon(btnShare, ICONS.shareDone);
                setBtnLabel(btnShare, 'Copied!');
                setTimeout(() => {
                    setBtnIcon(btnShare, ICONS.share);
                    setBtnLabel(btnShare, 'Copy post');
                }, 900);
            } catch {}
        });

        // ---- save (bookmark) ----
        btnSave.addEventListener('click', () => {
            const postEl = getPostElement(getCurrentPostIndex());
            if (!postEl) return;

            let bookmarkLink = postEl.querySelector('a[data-xf-click="bookmark"]');

            if (!bookmarkLink) {
                bookmarkLink = Array.from(postEl.querySelectorAll('a[href]'))
                    .find(a => a.textContent?.trim() === 'Add bookmark');
            }

            bookmarkLink?.click();
        });

        // ---- watch thread ----
        function getWatchButton() {
            return document.querySelector('.buttonGroup a[data-sk-watch][data-sk-unwatch]');
        }

        const paintWatch = on => {
            setBtnIcon(btnWatch, on ? ICONS.unwatch : ICONS.watch);
            setBtnLabel(btnWatch, on ? 'Unwatch thread' : 'Watch thread');
            btnWatch.classList.toggle('smg-active', on);   // destaca quando seguindo
        };
        function updateWatchIcon() { paintWatch(smgIsWatching(getWatchButton())); }

        btnWatch.addEventListener('click', async () => {
            const watchBtn = getWatchButton();
            if (!watchBtn) return;
            const wasWatching = smgIsWatching(watchBtn);
            paintWatch(!wasWatching);   // REATIVO: vira o estado na hora (otimista)
            watchBtn.click();
            const confirmBtn = await waitForElement('.overlay button[type="submit"].button--primary');
            confirmBtn?.click();
            setTimeout(() => {
                updateWatchIcon();                  // re-sincroniza com o real (corrige se errou)
                const nowWatching = smgIsWatching(getWatchButton());
                // sincroniza o NOSSO banco do feed com a mudança: passou a seguir → adiciona a thread (puxa posts já); deixou de seguir → remove
                if (nowWatching && !wasWatching) safe(feedAddCurrentThread);
                else if (!nowWatching && wasWatching) safe(feedRemoveCurrentThread);
            }, 1500);
        });

        updateWatchIcon();

        // ---- paginação ----
        btnPagePrev.addEventListener('click', () => prevPageLink?.click());
        btnPageNext.addEventListener('click', () => nextPageLink?.click());

        // ---- sort ----
        function updateSortIcon() {
            setBtnIcon(btnSort, sortIsDate ? ICONS.sortDate : ICONS.star);
            setBtnLabel(btnSort, sortIsDate ? 'Sort by date' : 'Sort by reactions');   // data-label segue p/ o sheet (mobile) + aria
            const t = btnSort.querySelector('.smg-nav-btn-text'); if (t) t.textContent = i18n(sortIsDate ? 'Date' : 'Reactions');
        }

        btnSort.addEventListener('click', () => {
            sortIsDate = !sortIsDate;
            updateSortIcon();

            if (sortIsDate) sortDateLink?.click();
            else sortReactionLink?.click();
        });

        updateSortIcon();

        // ---- estado inicial dos botões (1×) + sondagem de fim-de-lista no scroll ----
        updatePostButtonsState();

        onScrollRaf(pollEndOfList);
    }
