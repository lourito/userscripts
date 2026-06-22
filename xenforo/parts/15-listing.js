    // =========================================================
    // LISTAGEM (modo lista/grade): marca o container REAL dos itens (.structItem--thread)
    // que o modo grade transforma em grid (o toggle lista/grade vive no dock)
    // =========================================================

    function markThreadGridContainer(roots) {
        if (!document.documentElement.classList.contains('smg-threadlist')) return;   // structItem só existe em listagem; evita varrer o DOM em toda página/tick
        eachIn(roots, '.structItem--thread:not([data-smg-tl])', it => {
            it.dataset.smgTl = '1';   // guard: NodeList vazia uma vez marcados (não varre todo frame)
            if (it.parentElement) it.parentElement.classList.add('smg-tl-grid');
        });
    }

    // marca .smg-has-nodes no .block--category que lista sub-fóruns — o CSS casa a classe estática
    // no lugar de .block--category:has(.node) (re-validado a cada mutação da listagem)
    function markCategoryNodeBlocks(roots) {
        if (!document.documentElement.classList.contains('smg-threadlist')) return;
        eachIn(roots, '.block--category:not([data-smg-nodechk])', b => {
            b.dataset.smgNodechk = '1';
            if (b.querySelector('.node')) b.classList.add('smg-has-nodes');
        });
    }

    // ===== badges REATIVOS: topbar + dock acompanham o contador nativo do XF (alertas) AO VIVO =====
    // o XF muda data-badge em .p-navgroup-link--alerts ao marcar lido / chegar alerta; observamos e re-sincronizamos
    // os badges da topbar e da dock — sem precisar de F5.
    let badgeObsBound = false;
    function nativeBadgeCount(sel) {
        const el = document.querySelector(sel);
        const n = el ? parseInt(el.getAttribute('data-badge') || '0', 10) : 0;
        return n > 0 ? n : 0;
    }
    function setReactiveBadge(host, n, cls) {
        if (!host) return;
        let b = host.querySelector(':scope > .' + cls);
        if (n > 0) {
            const t = n > 99 ? '99+' : String(n);
            if (!b) { b = document.createElement('span'); b.className = cls; host.appendChild(b); }
            if (b.textContent !== t) b.textContent = t;   // só muta se mudou (senão o observer entra em loop)
        } else if (b) { b.remove(); }
    }
    function syncReactiveBadges() {
        const alerts = nativeBadgeCount('.p-navgroup-link--alerts');
        setReactiveBadge(document.querySelector('#smg-topbar .smg-rt-alerts'), alerts, 'smg-tb-badge');     // topbar (ícone do sino)
        setReactiveBadge(document.querySelector('#smg-nav-alerts .smg-nav-ico'), alerts, 'smg-nav-badge');  // dock / navbar mobile
    }
    function watchNativeBadges() {
        if (badgeObsBound) return;   // o MutationObserver já mantém os badges em sync ao vivo — não varre todo frame
        const targets = ['.p-navgroup-link--alerts', '.p-navgroup-link--conversations']
            .map(s => document.querySelector(s)).filter(Boolean);
        if (!targets.length) return;     // sem nav nativa (logout/página sem nav) → nem sincroniza badge à toa todo frame
        syncReactiveBadges();
        badgeObsBound = true;
        const obs = new MutationObserver(syncReactiveBadges);
        targets.forEach(el => obs.observe(el, { attributes: true, attributeFilter: ['data-badge'] }));
    }

    // SMG: cards sem thumb real (XF mostra o avatar do autor, ou nada) ganham um PLACEHOLDER
    // com a marca SMG. Vale no grid E na lista (o CSS ajusta o tamanho por modo). Idempotente.
    // forum_view_type_article (ex.: games.91): marca o container dos .message--articlePreview como grid
    // (pega também sticky/featured que ficam fora do .block-body) + placeholder nos cards sem imagem.
    function styleArticleCards() {
        if (!document.documentElement.classList.contains('smg-threadlist')) return;
        const arts = document.querySelectorAll('.message--articlePreview:not([data-smg-art])');   // guard no seletor: idle = NodeList vazia
        if (!arts.length) return;
        const mark = document.documentElement.classList.contains('smg-smg') ? SMG_PH_MARK : SC_PH_MARK;
        const wantPh = FEATURES.thumbPlaceholders;

        // RECONSTRÓI: o XF (article view) usa um grid "magazine" com grid-template-areas + grid-area por
        // :nth-of-type (o 1º card ocupa a linha toda). Trocar grid-template-columns não resolve. Solução:
        // mover os cards pra um container NOSSO (.smg-article-grid), onde aquelas regras :nth-of-type NÃO casam.
        // O grid/lista é controlado por CSS (gated em smg-tv-grid) → o toggle lista/grade da dock funciona aqui também.
        const origs = new Set();
        arts.forEach(a => { const p = a.parentElement; if (p && !p.classList.contains('smg-article-grid')) origs.add(p); });
        origs.forEach(orig => {
            if (!orig.parentElement) return;
            const grid = document.createElement('div');
            grid.className = 'smg-article-grid';
            orig.parentElement.insertBefore(grid, orig.nextSibling);
            orig.querySelectorAll(':scope > .message--articlePreview').forEach(a => grid.appendChild(a));
            orig.style.setProperty('display', 'none', 'important');   // esconde o container original (vazio)
        });

        arts.forEach(art => {
            if (art.dataset.smgArt) return;
            art.dataset.smgArt = '1';
            // meta: esconde o li do "share" aqui (substitui o li:has(.fa-share-alt) do CSS — era por-li em todo recalc)
            const shareIco = art.querySelector('.articlePreview-meta .fa-share-alt');
            const shareLi = shareIco && shareIco.closest('li');
            if (shareLi) shareLi.style.setProperty('display', 'none', 'important');
            if (!wantPh) return;
            const main = art.querySelector('.articlePreview-main');
            if (!main) return;
            const imgLink = art.querySelector('.articlePreview-image');
            const img = imgLink && imgLink.querySelector('img');
            const addPh = () => {
                if (main.querySelector('.smg-art-ph')) return;
                const ph = document.createElement('a');
                ph.className = 'smg-art-ph';
                const tl = art.querySelector('.articlePreview-title a[href*="/threads/"]');
                if (tl) ph.href = tl.getAttribute('href');
                ph.innerHTML = mark;
                main.insertBefore(ph, main.firstChild);
                if (imgLink) imgLink.style.setProperty('display', 'none', 'important');
            };
            if (!img) { addPh(); return; }
            const verify = () => { if (img.naturalWidth === 0) addPh(); };   // carregou mas veio vazio/quebrado
            if (img.complete) verify();
            else { img.addEventListener('load', verify, { once: true }); img.addEventListener('error', addPh, { once: true }); }
        });
    }

    function markGridPlaceholders(roots) {
        if (!document.documentElement.classList.contains('smg-threadlist')) return;  // os 2 sites
        const mark = document.documentElement.classList.contains('smg-smg') ? SMG_PH_MARK : SC_PH_MARK;
        eachIn(roots, '.structItem--thread:not([data-smg-ph])', it => {
            it.setAttribute('data-smg-ph', '1');   // marca ANTES dos guards (REGRA DE OURO): ad/linha sem ícone ficava fora da marca e era re-varrida em todo full-scan
            if (it.classList.contains('samUnitWrapper')) return; // ad: nem mexe (some via CSS)
            const cell = it.querySelector('.structItem-cell--icon:not(.structItem-cell--iconEnd)');
            if (!cell) return;
            const addPh = () => {
                if (it.classList.contains('smg-no-thumb')) return;
                it.classList.add('smg-no-thumb');
                const ph = document.createElement('div');
                ph.className = 'smg-thumb-ph';
                ph.innerHTML = mark;
                cell.insertBefore(ph, cell.firstChild);
            };
            const thumb = cell.querySelector('.dcThumbnail, .dtt-thread-thumbnail');
            if (!thumb) { addPh(); return; }              // sem thumb (avatar/vazio) → placeholder
            const img = thumb.querySelector('img');
            if (!img) { addPh(); return; }
            // simpcity (.dcThumbnail): o thumb REAL vem no background-image do <img> (src é 1x1).
            if (thumb.classList.contains('dcThumbnail')) {
                const m = (img.style.backgroundImage || '').match(/url\(\s*["']?([^"')]+)/i);
                const url = m && m[1];
                if (!url || /^data:/i.test(url)) { addPh(); return; }   // sem bg real → placeholder
                // bg-image não tem onerror → testa o carregamento (ex.: thumbs do domínio .su morto → 404)
                const probe = new Image();
                probe.onerror = addPh;
                probe.onload = () => { if (!probe.naturalWidth) addPh(); };
                probe.src = url;
                return;
            }
            // SMG (.dtt-thread-thumbnail): <img src> real → placeholder se quebrar
            if (img.complete && img.naturalWidth === 0) addPh();
            else img.addEventListener('error', addPh, { once: true });
        });
    }
