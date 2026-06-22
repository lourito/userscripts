    // =========================================================
    // FEATURE: topbar reformulada (ícones + popovers agrupados)
    // lê os links REAIS da nav nativa via data-nav-id → funciona no simpcity e no smg
    //
    // buildTopbar() é uma função só; mapa interno (Cmd+F): ZONA ESQUERDA (logo+Discover) ·
    //   ZONA CENTRAL (search bar) · ZONA DIREITA (notices/seguindo/alertas/conta) ·
    //   "// ----" abrir/fechar popovers · docked→flutuante · sheets mobile (sino/Discover/User)
    // =========================================================
    let topbarBuilt = false;
    function buildTopbar() {
        if (topbarBuilt || document.getElementById('smg-topbar-wrap')) return;
        if (!document.querySelector('.p-nav')) return; // sem nav nativa = nada a fazer
        topbarBuilt = true;

        const badgeOf = sel => {
            const el = document.querySelector(sel);
            const n = el ? parseInt(el.getAttribute('data-badge') || '0', 10) : 0;
            return n > 0 ? n : 0;
        };
        const postThreadHref = (() => {
            const e = document.querySelector('.p-title-pageAction a[href*="post-thread"], .p-title-pageAction a[href*="create-thread"], .p-title-pageAction a[href*="add-thread"]');
            return e ? e.getAttribute('href') : null;
        })();

        // carrega a lista nativa do XF (alertas/etc) dentro de `body`: conteúdo → erro.
        // rethrow no catch p/ quem chamou resetar seu próprio flag de "já carregou".
        const loadXfListInto = (body, url, cleanAlerts) =>
            fetchXfList(url)
                .then(node => { body.innerHTML = ''; body.appendChild(node); if (cleanAlerts) cleanAlertList(node); })
                .catch(err => { body.innerHTML = '<div class="smg-tb-loading">' + i18n('Error loading.') + '</div>'; throw err; });

        // topbar em 3 zonas: ESQUERDA (logo + Discover) · CENTRO (search bar) · DIREITA (Seguindo · Notificações · User)
        // a navbar inferior (mobile) segue com os mesmos destinos via dock
        const discoverItems = [
            { section: 'Explore' },
            { label: 'Trending', desc: 'Most popular right now', icon: ICONS.flame, href: navHref('trending', 'smgtrending', 'trending2') },
            { label: 'What\'s new', desc: 'Recently posted', icon: ICONS.sparkles, href: navHref('whatsNew', 'whatsNew2') || '/whats-new/' },
            { label: 'New posts', desc: 'Latest messages', icon: ICONS.layers, href: navHref('whatsNewPosts', 'newPosts', 'whatsNewPosts2') || '/whats-new/posts/' },
            { label: 'Featured', desc: 'Featured content', icon: ICONS.star, href: navHref('featured') },
            { label: 'Activity', desc: 'Activity feed', icon: ICONS.activity, href: navHref('latestActivity') },
            { section: 'Threads' },
            { label: 'Find threads', desc: 'Browse threads', icon: ICONS.search, href: navHref('findThreads') || '/find-threads/started' },
            { label: 'Unanswered', desc: 'Awaiting a reply', icon: ICONS.help, href: navHref('unansweredThreads') || '/find-threads/unanswered' },
            { section: 'Community' },
            { label: 'Members', desc: 'Member list', icon: ICONS.users, href: navHref('members') || '/members/' },
            { label: 'Online now', desc: 'Who\'s online', icon: ICONS.user, href: navHref('currentVisitors') || '/online/' },
        ];
        // esquerda = só o Discover (dropdown). Seguindo/Notificações/User viram ícones à DIREITA.
        const watchedHref = navHref('watchedThreads', 'watched', 'watchedThreads2') || '/watched/threads';
        const groups = [
            { label: 'Discover', mega: true, icon: ICONS.compass, items: discoverItems, featured: {   // mega-menu (grid 2-col + ícones em tile + painel destacado), estilo Vimeo
                title: 'Timeline', desc: 'Posts from the threads you follow, newest first.', cta: 'Open Timeline',
                href: '/?view=feed', icon: ICONS.feed,
            } },
            { label: 'Timeline', icon: ICONS.feed, href: '/?view=feed' },   // ex-"Feed": river de posts das threads seguidas; mora SÓ na home (ver 22-feed.js)
            { label: 'Following', icon: ICONS.rss, href: watchedHref },     // threads que você segue (watched) — RSS ("inscrito nas atualizações"), distinto do bookmark de Salvos
        ];

        const wrap = document.createElement('div');
        wrap.id = 'smg-topbar-wrap';
        const bar = document.createElement('div');
        bar.id = 'smg-topbar';
        // inner alinhado à largura do conteúdo (ehentai): barra é full-width, inner é centralizado
        const inner = document.createElement('div');
        inner.id = 'smg-tb-inner';

        // logo (lido da nav nativa antes de escondê-la)
        const logoImg = document.querySelector('.p-header-logo img, .uix_logo img');
        const logoA = document.createElement('a');
        logoA.className = 'smg-tb-logo';
        logoA.href = '/';
        if (document.documentElement.classList.contains('smg-smg')) { logoA.innerHTML = SMG_LOGO_HTML; logoA.classList.add('smg-tb-logo--custom'); }
        else if (logoImg) { const im = document.createElement('img'); im.src = logoImg.getAttribute('src') || ''; im.alt = ''; logoA.appendChild(im); }
        else logoA.textContent = 'Home';
        // ZONA ESQUERDA: logo + Discover (o logo já é o "Início")
        const left = document.createElement('div');
        left.className = 'smg-tb-left';
        left.appendChild(logoA);

        const popovers = [];

        // navegação (esquerda) = só o Discover
        const nav = document.createElement('div');
        nav.className = 'smg-tb-nav';

        const cleanDiv = arr => { // remove divisores duplicados/nas pontas
            const out = [];
            arr.forEach(it => { if (it.divider) { if (out.length && !out[out.length - 1].divider) out.push(it); } else out.push(it); });
            while (out.length && out[out.length - 1].divider) out.pop();
            return out;
        };
        // mega-menu (Discover): agrupa em seções → grid de 2 colunas (ícone em tile + label + desc) + painel destacado à direita (estilo Vimeo)
        const arrowR = ICONS.arrowRight;
        const buildMegaPop = (items, feat) => {
            const secs = [];
            items.forEach(it => {
                if (it.section) { secs.push({ title: it.section, rows: [] }); return; }
                if (!it.href) return;                         // item sem destino (navHref vazio) → pula
                if (!secs.length) secs.push({ title: '', rows: [] });
                secs[secs.length - 1].rows.push(it);
            });
            const main = secs.filter(s => s.rows.length).map(s =>
                '<div class="smg-tb-mega-sec">' +
                (s.title ? '<div class="smg-tb-mega-label">' + s.title + '</div>' : '') +
                '<div class="smg-tb-mega-grid">' +
                s.rows.map(it =>
                    '<a class="smg-tb-megaitem" href="' + safeHref(it.href) + '">' +
                        '<span class="smg-tb-megaico">' + it.icon + '</span>' +
                        '<span class="smg-tb-megatext"><span class="smg-tb-megatitle">' + it.label + '</span>' +
                        (it.desc ? '<span class="smg-tb-megadesc">' + it.desc + '</span>' : '') + '</span>' +
                    '</a>'
                ).join('') +
                '</div></div>'
            ).join('');
            let html = '<div class="smg-tb-mega-cols"><div class="smg-tb-mega-main">' + main + '</div>';
            if (feat) html += '<a class="smg-tb-mega-feat" href="' + safeHref(feat.href) + '">' +
                '<div class="smg-tb-mega-feat-art">' + (feat.icon || '') + '</div>' +
                '<div class="smg-tb-mega-feat-body">' +
                    '<div class="smg-tb-mega-feat-title">' + feat.title + '</div>' +
                    '<div class="smg-tb-mega-feat-desc">' + feat.desc + '</div>' +
                    '<div class="smg-tb-mega-feat-cta">' + feat.cta + arrowR + '</div>' +
                '</div></a>';
            return html + '</div>';
        };
        groups.forEach(g => {
            if (g.href) { // atalho = link direto (sem dropdown)
                const a = document.createElement('a');
                a.className = 'smg-tb-item';
                a.href = g.href;
                a.innerHTML = (g.icon ? '<span class="smg-tb-ico">' + g.icon + '</span>' : '') + '<span>' + g.label + '</span>';
                nav.appendChild(a);
                return;
            }
            if (g.mega) {   // Discover → mega-menu (grid + painel destacado), não a lista simples
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'smg-tb-item smg-tb-trigger';
                btn.innerHTML = (g.icon ? '<span class="smg-tb-ico">' + g.icon + '</span>' : '') + '<span>' + g.label + '</span><span class="smg-tb-caret">' + ICONS.hide + '</span>';
                const pop = document.createElement('div');
                pop.className = 'smg-tb-pop smg-tb-pop--mega';
                pop.innerHTML = buildMegaPop(g.items, g.featured);
                nav.appendChild(btn);
                wrap.appendChild(pop);
                popovers.push({ btn, pop });
                return;
            }
            const items = cleanDiv(g.items.filter(it => it.divider || it.href));
            if (!items.some(it => !it.divider)) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'smg-tb-item smg-tb-trigger';
            btn.innerHTML = (g.icon ? '<span class="smg-tb-ico">' + g.icon + '</span>' : '') + '<span>' + g.label + '</span><span class="smg-tb-caret">' + ICONS.hide + '</span>';
            const pop = document.createElement('div');
            pop.className = 'smg-tb-pop';
            pop.innerHTML = items.map(it => it.divider
                ? '<div class="smg-tb-popdiv"></div>'
                : '<a class="smg-tb-poprow" href="' + safeHref(it.href) + '">' +
                    '<span class="smg-tb-popico">' + it.icon + '</span>' +
                    '<span class="smg-tb-poptext"><span class="smg-tb-poptitle">' + it.label + '</span><span class="smg-tb-popdesc">' + it.desc + '</span></span>' +
                '</a>'
            ).join('');
            nav.appendChild(btn);
            wrap.appendChild(pop);
            popovers.push({ btn, pop });
        });
        inner.appendChild(left);   // ESQUERDA = só o logo (a nav foi pro centro)

        // ZONA CENTRAL: navegação (Discover · Timeline · Following), centralizada — estilo Spellbook
        const center = document.createElement('div');
        center.className = 'smg-tb-center smg-tb-center--nav';
        center.appendChild(nav);
        inner.appendChild(center);

        // SEARCH vira OVERLAY que OCUPA a topbar quando aberto (disparado pelo ícone de busca na direita; reusa toda a engine do setupSearch)
        const searchBar = document.createElement('div');
        searchBar.className = 'smg-tb-search smg-tb-search--overlay';
        const tbInput = document.createElement('input');
        tbInput.type = 'text';
        tbInput.className = 'smg-tb-search-input';
        tbInput.placeholder = i18n('Search the forum…');
        tbInput.setAttribute('aria-label', i18n('Search'));
        tbInput.setAttribute('enterkeyhint', 'search');
        tbInput.autocapitalize = 'off'; tbInput.autocomplete = 'off'; tbInput.spellcheck = false;
        searchBar.innerHTML = '<span class="smg-tb-search-ico">' + ICONS.search + '</span>';
        // chip de contexto (Reddit-style): "Buscar em <tópico/fórum>" com × — preenchido/mostrado/escondido pelo setupSearch
        const tbChip = document.createElement('button');
        tbChip.type = 'button'; tbChip.className = 'smg-tb-search-chip smg-search-chip'; tbChip.hidden = true;
        tbChip.innerHTML = '<span class="smg-search-chip-t"></span><span class="smg-search-chip-x" aria-label="' + i18n('Clear') + '">' + ICONS.close + '</span>';
        searchBar.appendChild(tbChip);
        searchBar.appendChild(tbInput);
        // botão ⇥ — indica/abre a paleta de comandos (Tab)
        const tbCmd = document.createElement('button');
        tbCmd.type = 'button'; tbCmd.className = 'smg-search-cmdbtn'; tbCmd.title = i18n('Commands (Tab)'); tbCmd.setAttribute('aria-label', i18n('Commands (Tab)'));
        tbCmd.textContent = '⇥'; searchBar.appendChild(tbCmd);   // a própria paleta (Tab/⇥) lista os comandos → dispensa o "?" separado
        // busca avançada (link) + config de defaults (engrenagem); href setado já aqui (o setupSearch roda antes do topbar existir)
        const tbAdv = document.createElement('a');
        tbAdv.className = 'smg-search-adv'; tbAdv.target = '_blank'; tbAdv.rel = 'noopener'; tbAdv.setAttribute('aria-label', i18n('Advanced'));
        tbAdv.href = ((document.querySelector('form[data-xf-init="quick-search"]') || {}).getAttribute && document.querySelector('form[data-xf-init="quick-search"]').getAttribute('action') || '/search/search').replace(/search\/?$/, '');
        tbAdv.innerHTML = ICONS.filter; searchBar.appendChild(tbAdv);   // funil = busca avançada (distinto da config)
        const tbCfg = document.createElement('button');
        tbCfg.type = 'button'; tbCfg.className = 'smg-search-cfg'; tbCfg.setAttribute('aria-label', i18n('Search defaults'));
        tbCfg.innerHTML = ICONS.sliders; searchBar.appendChild(tbCfg);   // sliders = ajustar defaults (distinto da engrenagem do dock)
        // (sem botão "Buscar": digitar já busca via debounce; Enter força + grava; "Ver todos" abre a página cheia)
        // foco/clique → abre o dropdown (setupSearch decide drop vs modal) · Enter → busca · Esc → fecha. Eventos custom desacoplam do escopo da dock.
        const tbOpenSearch = () => document.dispatchEvent(new CustomEvent('smg-search-open'));
        tbInput.addEventListener('focus', tbOpenSearch);
        tbInput.addEventListener('click', tbOpenSearch);
        tbInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); document.querySelector('#smg-search-pop .smg-search-go')?.click(); }
            else if (e.key === 'Escape') { e.preventDefault(); document.dispatchEvent(new CustomEvent('smg-search-close')); tbInput.blur(); }
        });
        // placeholder ROTATIVO — alterna a cada 3s (pausa enquanto você digita/foca). Edite SEARCH_HINTS com os termos que quiser.
        const SEARCH_HINTS = [
            i18n('Search the forum…'),
            'Lana Rhoades', 'Mia Khalifa', 'Brandi Love', 'Riley Reid', 'Abella Danger',
            'Angela White', 'Eva Elfie', 'Sweetie Fox', 'Liya Silver', 'Gabbie Carter',
            'Pokimane', 'Amouranth', 'Emiru', 'Kyedae', 'Valkyrae',
            'Alinity', 'Loserfruit', 'Chica', 'QuarterJade', 'LilyPichu',
        ];
        if (SEARCH_HINTS.length > 1) {
            let hintI = 0;
            setInterval(() => {
                if (document.hidden || !tbInput.offsetParent) return;   // aba em background / busca fechada → não gira placeholder que ninguém vê
                if (tbInput.value || document.activeElement === tbInput) return;
                if (document.documentElement.classList.contains('smg-search-scoped')) return;   // chip de contexto ativo → placeholder fixo "Buscar em X"
                hintI = (hintI + 1) % SEARCH_HINTS.length;
                tbInput.placeholder = SEARCH_HINTS[hintI];
            }, 3000);
        }
        // botão de fechar o overlay de busca (X à direita do input)
        const searchClose = document.createElement('button');
        searchClose.type = 'button'; searchClose.className = 'smg-tb-search-close'; searchClose.setAttribute('aria-label', 'Close');
        searchClose.innerHTML = ICONS.close;
        searchClose.addEventListener('click', () => document.dispatchEvent(new CustomEvent('smg-search-close')));
        searchBar.appendChild(searchClose);
        inner.appendChild(searchBar);

        // ações (direita)
        const actions = document.createElement('div');
        actions.className = 'smg-tb-actions';
        const iconAct = (icon, label, href, badge) => {
            const a = document.createElement(href ? 'a' : 'button');
            if (href) a.href = href; else a.type = 'button';
            a.className = 'smg-tb-act';
            a.setAttribute('aria-label', label);
            a.title = label;
            a.innerHTML = '<span class="smg-tb-ico">' + icon + '</span>' + (badge ? '<span class="smg-tb-badge">' + (badge > 99 ? '99+' : badge) + '</span>' : '');
            return a;
        };

        // dropdown de lista (alertas) — agora ÍCONE à direita, conteúdo nativo do XF sob demanda
        const listPopover = (icon, label, badge, fetchUrl, allHref, markHref, iconOnly) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = (iconOnly ? 'smg-tb-act' : 'smg-tb-item') + ' smg-tb-trigger';
            btn.setAttribute('aria-label', label);
            btn.title = label;
            btn.innerHTML = iconOnly
                ? '<span class="smg-tb-ico">' + icon + '</span>'
                    + (badge ? '<span class="smg-tb-badge">' + (badge > 99 ? '99+' : badge) + '</span>' : '')
                : '<span class="smg-tb-ico">' + icon + '</span><span>' + label + '</span>'
                    + (badge ? '<span class="smg-tb-badge smg-tb-badge--inline">' + (badge > 99 ? '99+' : badge) + '</span>' : '');
            const pop = document.createElement('div');
            pop.className = 'smg-tb-pop smg-tb-pop--list';
            pop.innerHTML =
                '<div class="smg-tb-acchead">' + label + '</div>' +
                '<div class="smg-tb-listbody"><div class="smg-tb-loading">Loading…</div></div>' +
                '<div class="smg-tb-popfoot"><a href="' + allHref + '">See all</a>' + (markHref ? '<a href="' + markHref + '">Mark read</a>' : '') + '</div>';
            let loaded = false;
            const load = () => {
                if (loaded) return;
                loaded = true;
                loadXfListInto(pop.querySelector('.smg-tb-listbody'), fetchUrl, /alert/i.test(fetchUrl)).catch(() => { loaded = false; });
            };
            return { btn, pop, noSwitch: true, onOpen: load };
        };

        // NOTICES: ficam no banner nativo DENTRO da página (.notices--block) — não são mais recolhidos pra topbar.

        // ZONA DIREITA, ícone 1 — Search: abre o overlay que ocupa a topbar (Following saiu daqui → virou nav central)
        const searchBtn = iconAct(ICONS.search, 'Search');
        searchBtn.classList.add('smg-tb-searchbtn');
        searchBtn.addEventListener('click', e => {
            e.stopPropagation();   // não borbulha pro handler de clique-fora (capture pointerdown) que reverteria
            document.dispatchEvent(new CustomEvent('smg-search-open'));
            // foco robusto: agora + próximo frame + fallback (query fresca; o overlay precisa estar focável)
            const f = () => { const inp = document.querySelector('.smg-tb-search-input'); if (inp) try { inp.focus({ preventScroll: true }); } catch (x) {} };
            f(); requestAnimationFrame(f); setTimeout(f, 80);
        });
        actions.appendChild(searchBtn);

        // ZONA DIREITA, ícone 2 — Notificações (ícone + badge, dropdown à direita)
        const alertsPop = listPopover(ICONS.alerts, 'Alerts', badgeOf('.p-navgroup-link--alerts'), '/account/alerts-popup', '/account/alerts', '/account/alerts/mark-read', true);
        alertsPop.btn.classList.add('smg-rt-alerts');   // alvo do sync reativo de badge
        actions.appendChild(alertsPop.btn); wrap.appendChild(alertsPop.pop); popovers.push({ ...alertsPop, right: true });

        // ZONA DIREITA, ícone 3 — conta (avatar + popover)
        const accBtn = document.createElement('button');
        accBtn.type = 'button';
        accBtn.className = 'smg-tb-account';
        const userLink = document.querySelector('.p-navgroup-link--user');
        const uname = (userLink && userLink.getAttribute('title')) || 'Account';
        accBtn.setAttribute('aria-label', 'Account');
        // clona o avatar nativo do XF — foto onde existe, ou o avatar-letra colorido
        const navAv = document.querySelector('.p-navgroup-link--user .avatar') || document.querySelector('.p-account .avatar');
        if (navAv) accBtn.appendChild(navAv.cloneNode(true));
        else accBtn.textContent = (uname[0] || '?').toUpperCase();

        const accPop = document.createElement('div');
        accPop.className = 'smg-tb-pop smg-tb-pop--account';
        const accSections = [
            [ // conta
                { label: 'Profile', icon: ICONS.user, href: navHref('profile', 'defaultYourProfile') || '/account/' },
                { label: 'Your account', icon: ICONS.settings, href: navHref('defaultYourAccount') || '/account/' },
            ],
            [ // salvos + assistidos — logo abaixo da conta (pedido)
                { label: 'Bookmarks', icon: ICONS.bookmarks, href: navHref('bookmarks') || '/account/bookmarks' },
                { label: 'Watched forums', icon: ICONS.alerts, href: navHref('watchedForums', 'watchedForums2') || '/watched/forums' },
            ],
            [ // criar / comunicação
                { label: 'Post thread', icon: ICONS.plus, href: postThreadHref },
                { label: 'Messages', icon: ICONS.mail, href: navHref('directMessages', 'conversations') || '/direct-messages/' },
            ],
            [ // "Meus" — itens pessoais que estavam espalhados em outros menus
                { label: 'Your threads', icon: ICONS.layers, href: navHref('yourThreads') || '/find-threads/started' },
                { label: 'Contributed', icon: ICONS.chat, href: navHref('contributedThreads') || '/find-threads/contributed' },
                { label: 'Your tickets', icon: ICONS.help, href: navHref('YourTickets') },
            ],
            [ // ações
                { label: 'Preferences', icon: ICONS.sliders, href: navHref('settings') || '/account/preferences' },
                { label: 'History', icon: ICONS.sortDate, href: navHref('history') },
                { label: 'Log out', icon: ICONS.postUp, href: navHref('defaultLogOut') || '/logout/' },
            ],
        ];
        const accRow = it => '<a class="smg-tb-poprow smg-tb-poprow--sm" href="' + safeHref(it.href) + '"><span class="smg-tb-popico">' + it.icon + '</span><span class="smg-tb-poptitle">' + it.label + '</span></a>';
        accPop.innerHTML = '<div class="smg-tb-acchead"></div>' +
            accSections.map(sec => sec.filter(it => it.href)).filter(sec => sec.length)
                .map(sec => sec.map(accRow).join('')).join('<div class="smg-tb-popdiv"></div>');
        accPop.querySelector('.smg-tb-acchead').textContent = uname;   // nome do user via textContent (não interpola HTML)
        actions.appendChild(accBtn);
        wrap.appendChild(accPop);
        popovers.push({ btn: accBtn, pop: accPop, right: true });   // sem noSwitch → abre no HOVER (igual Discover)

        inner.appendChild(actions);
        bar.appendChild(inner);
        wrap.appendChild(bar);
        // prepend (não append): no desktop é fixed (tanto faz), mas no mobile a barra é position:static
        // e precisa ser o 1º elemento do body pra renderizar no TOPO (senão cai pro fim da página)
        document.body.insertBefore(wrap, document.body.firstChild);
        document.documentElement.classList.add('smg-topbar-on');

        // ---- abrir/fechar popovers (megamenu: hover troca, clique abre/fecha) ----
        const wirePopovers = () => {
            let openIdx = -1;
            const place = (btn, pop) => {
                const br = btn.getBoundingClientRect();
                const center = (br.left - bar.getBoundingClientRect().left) + br.width / 2;   // centro do botão relativo à barra
                const left = center - pop.offsetWidth / 2;                                     // centraliza o pop sob o item
                const maxLeft = bar.offsetWidth - pop.offsetWidth - 8;
                pop.style.right = 'auto';
                pop.style.left = Math.max(8, Math.min(left, maxLeft)) + 'px';
            };
            const closeAll = () => {
                popovers.forEach(p => { p.pop.classList.remove('open'); p.btn.classList.remove('active'); });
                openIdx = -1;
            };
            const openAt = i => {
                closeAll();
                const p = popovers[i];
                p.btn.classList.add('active');
                if (p.right) { // alinha pela direita do botão (barra é full-width)
                    const r = p.btn.getBoundingClientRect();
                    p.pop.style.left = 'auto';
                    p.pop.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
                } else place(p.btn, p.pop);
                p.pop.classList.add('open');
                if (p.onOpen) p.onOpen();
                openIdx = i;
            };
            // hover: os menus "hoveráveis" (Discover) abrem ao passar o mouse e fecham ao sair
            // (com ponte pelo próprio popover). Alerts/Conta (noSwitch) seguem só no clique.
            let hoverTimer = null;
            const cancelHoverClose = () => { if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; } };
            const scheduleHoverClose = i => { cancelHoverClose(); hoverTimer = setTimeout(() => { if (openIdx === i) closeAll(); }, 180); };
            popovers.forEach((p, i) => {
                p.btn.addEventListener('click', e => { e.stopPropagation(); cancelHoverClose(); if (openIdx === i) closeAll(); else openAt(i); });
                if (!p.noSwitch) {
                    p.btn.addEventListener('mouseenter', () => { cancelHoverClose(); openAt(i); });
                    p.btn.addEventListener('mouseleave', () => scheduleHoverClose(i));
                    p.pop.addEventListener('mouseenter', cancelHoverClose);
                    p.pop.addEventListener('mouseleave', () => scheduleHoverClose(i));
                }
            });
            document.addEventListener('click', e => { if (!wrap.contains(e.target)) closeAll(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
        };
        wirePopovers();

        // ---- docked no topo → flutuante após rolar ----
        const syncDock = () => { wrap.classList.toggle('floating', window.scrollY > 40); };
        onScrollRaf(syncDock);
        syncDock();

        // ---- mobile: bottom sheets (sino/Discover/User) — concern separada do topbar desktop ----
        const buildMobileSheets = () => {
            // o sino da navbar inferior abre um SHEET com os alertas
            const aSheet = document.createElement('div');
            aSheet.id = 'smg-alerts-sheet';
            aSheet.className = 'smg-sheet';
            aSheet.innerHTML =
                '<div class="smg-csheet-panel">' +
                    '<div class="smg-sheet-grip"></div>' +
                    '<div class="smg-csheet-head"><span>Alerts</span><a href="/account/alerts">See all</a></div>' +
                    '<div class="smg-csheet-body smg-tb-listbody"><div class="smg-tb-loading">Loading…</div></div>' +
                '</div>';
            document.body.appendChild(aSheet);
            let aSheetLoaded = false;
            const openAlertsSheet = () => {
                aSheet.classList.add('open');
                if (aSheetLoaded) return;
                aSheetLoaded = true;
                loadXfListInto(aSheet.querySelector('.smg-csheet-body'), '/account/alerts-popup', true).catch(() => { aSheetLoaded = false; });
            };
            aSheet.addEventListener('click', e => { if (e.target === aSheet) aSheet.classList.remove('open'); });
            const navBell = document.getElementById('smg-nav-alerts');
            if (navBell) navBell.addEventListener('click', e => {
                if (window.matchMedia('(max-width: 600px)').matches) { e.preventDefault(); openAlertsSheet(); }
            });

            // helper genérico de bottom sheet (Discover / User)
            const makeSheet = (id, title, bodyHTML) => {
                const s = document.createElement('div');
                s.id = id;
                s.className = 'smg-sheet';
                s.innerHTML =
                    '<div class="smg-csheet-panel">' +
                        '<div class="smg-sheet-grip"></div>' +
                        '<div class="smg-csheet-head"><span>' + title + '</span></div>' +
                        '<div class="smg-csheet-body">' + bodyHTML + '</div>' +
                    '</div>';
                document.body.appendChild(s);
                s.addEventListener('click', e => { if (e.target === s) s.classList.remove('open'); });
                return s;
            };
            const sheetRow = it => it.divider
                ? '<div class="smg-tb-popdiv"></div>'
                : '<a class="smg-tb-poprow" href="' + safeHref(it.href) + '">' +
                    '<span class="smg-tb-popico">' + it.icon + '</span>' +
                    '<span class="smg-tb-poptext"><span class="smg-tb-poptitle">' + it.label + '</span>' +
                    (it.desc ? '<span class="smg-tb-popdesc">' + it.desc + '</span>' : '') + '</span>' +
                '</a>';
            const wireSheet = (btnId, sheet) => {
                const b = document.getElementById(btnId);
                if (b) b.addEventListener('click', e => { e.preventDefault(); sheet.classList.add('open'); });
            };

            // Discover → sheet com os mesmos itens do dropdown da topbar
            const dSheet = makeSheet('smg-discover-sheet', 'Discover',
                cleanDiv(discoverItems.filter(it => it.divider || it.href)).map(sheetRow).join(''));
            wireSheet('smg-nav-discover', dSheet);

            // User → sheet com as seções do menu de conta (Salvos mora aqui agora)
            const uBody = '<div class="smg-csheet-user"></div>' +
                accSections.map(sec => sec.filter(it => it.href)).filter(sec => sec.length)
                    .map(sec => sec.map(sheetRow).join('')).join('<div class="smg-tb-popdiv"></div>');
            const uSheet = makeSheet('smg-user-sheet', 'Account', uBody);
            uSheet.querySelector('.smg-csheet-user').textContent = uname;   // nome do user via textContent
            wireSheet('smg-nav-user', uSheet);

            return { aSheet, dSheet, uSheet };
        };
        const { aSheet, dSheet, uSheet } = buildMobileSheets();
        // arrastar pra baixo fecha os sheets mobile de alerts / profile / discover (mesmo gesto do modal de busca)
        [aSheet, uSheet, dSheet].filter(Boolean).forEach(s =>
            addSwipeClose(s.querySelector('.smg-csheet-panel'), () => s.classList.remove('open'), () => s.classList.contains('open')));

        // traduz TODA a UI da topbar + sheets mobile (Discover/User/Alertas) de uma vez.
        // só casa chaves em inglês → nome de usuário e conteúdo nativo passam intactos.
        i18nDom(wrap); i18nDom(aSheet); i18nDom(dSheet); i18nDom(uSheet);
    }

    // NOTICES recolhidos: esconde o banner nativo (.notices--block) e deixa só um iconezinho (megafone + contagem)
    // NO LUGAR dele, DENTRO da página. Clicar abre um popover com os avisos. Roda em qualquer página que tenha avisos.
    let smgNoticesDone = false;
    function setupHeaderNotices() {
        // na HOME, espera a barra de abas (latest/trending/following) montar — o ícone vai PRA ELA, não pro banner
        if (document.documentElement.classList.contains('smg-home') && FEATURES.homeRemake && !document.documentElement.classList.contains('smg-watched-feed') && !document.querySelector('.smg-feed-tabs')) return;   // home normal: espera as abas; modo feed: não espera (a tab não vem — vai pro header do river)
        if (document.documentElement.classList.contains('smg-watched-feed') && !document.querySelector('.smg-river-head')) return;   // modo feed: espera o header do river montar (o ícone mora nele) — re-tenta no próximo pass
        const blocks = document.querySelectorAll('.notices--block:not([data-smg-noticed])');
        if (!blocks.length) return;
        const seen = new Set();
        const notices = [];
        let firstBlock = null;
        blocks.forEach(b => {
            if (!firstBlock) firstBlock = b;
            b.setAttribute('data-smg-noticed', '1');
            b.querySelectorAll('.notice').forEach(n => {
                const c = n.querySelector('.notice-content');
                const txt = c && (c.textContent || '').trim();
                if (!txt) return;                                   // caixa vazia (bug do XF) → ignora
                const id = n.getAttribute('data-notice-id') || txt.slice(0, 60);
                if (seen.has(id)) return; seen.add(id);             // dedupe (o scroller do XF clona o <li>)
                notices.push(c.cloneNode(true));                    // clona já (o banner vai ser escondido)
            });
            b.style.setProperty('display', 'none', 'important');    // esconde o banner nativo
        });
        if (smgNoticesDone || !notices.length || !firstBlock) return;   // launcher 1x; sem texto → fica só escondido
        smgNoticesDone = true;

        const w = document.createElement('div');
        w.className = 'smg-notices';
        w.innerHTML =
            '<button type="button" class="smg-notices-btn" aria-label="' + i18n('Notices') + '" title="' + i18n('Notices') + '">' +
                '<span class="smg-notices-ico">' + ICONS.megaphone + '</span>' +
                '<span class="smg-notices-badge">' + notices.length + '</span>' +
            '</button>' +
            '<div class="smg-notices-pop"><div class="smg-notices-head">' + i18n('Notices') + '</div><div class="smg-notices-body"></div></div>';
        const body = w.querySelector('.smg-notices-body');
        notices.forEach(c => { const it = document.createElement('div'); it.className = 'smg-notice-item'; it.appendChild(c); body.appendChild(it); });
        const riverHead = document.documentElement.classList.contains('smg-watched-feed')
            ? (document.querySelector('.smg-river-head-actions') || document.querySelector('.smg-river-head')) : null;
        const homeTabs = document.querySelector('.smg-feed-tabs');
        const titleVal = document.querySelector('.p-body-header .p-title-value');
        if (riverHead) {   // MODO FEED (home): ícone no header do river ("Feed" + ações) — banner nativo já escondido
            w.classList.add('smg-notices--bar');
            riverHead.appendChild(w);
        } else if (homeTabs) {   // HOME: na barra de abas, à direita (antes do "See all")
            w.classList.add('smg-notices--bar');
            const seeAll = homeTabs.querySelector('.smg-feed-seeall');
            if (seeAll) homeTabs.insertBefore(w, seeAll); else homeTabs.appendChild(w);
        } else if (titleVal) {
            titleVal.appendChild(w);   // THREAD: inline, à DIREITA do título
        } else {
            firstBlock.parentNode.insertBefore(w, firstBlock);   // fallback (página sem título/abas): no lugar do banner
        }
        i18nDom(w);
        const btn = w.querySelector('.smg-notices-btn');
        btn.addEventListener('click', e => { e.stopPropagation(); w.classList.toggle('open'); });
        document.addEventListener('click', e => { if (!w.contains(e.target)) w.classList.remove('open'); });   // clique-fora fecha
        document.addEventListener('keydown', e => { if (e.key === 'Escape') w.classList.remove('open'); });
    }
