    // ── part 13: "search titles only" (enableSearchTitlesOnly) + painel inline na página de resultados (buildSearchResultsPanel) + clique na imagem abre o feed (setupImageClickFeed) ──
    // =========================================================
    // FEATURE: auto "search titles only"
    // =========================================================

    // PERF: roda em todo processAll. Antes fazia um querySelectorAll global a CADA frame mesmo depois de
    // aplicar (o form do quick-search persiste no DOM, então sempre casava). Agora marca 'done' assim que
    // processa ao menos um form → o qSA global para de rodar após o boot. Enquanto nenhum form existe ainda
    // (boot cedo), segue tentando no próximo frame; raríssimo form injetado via AJAX depois é o único caso perdido.
    let searchTitlesDone = false;
    function enableSearchTitlesOnly() {
        if (searchTitlesDone) return;
        const forms = document.querySelectorAll('form[data-xf-init="quick-search"]');
        // sem form e DOM completo (guest/tema sem quick-search) → desiste de vez; senão este qSA global rodava TODO frame pra sempre
        if (!forms.length) { if (document.readyState === 'complete') searchTitlesDone = true; return; }
        forms.forEach(form => {
            if (form.dataset.titleOnlyApplied) return;
            form.dataset.titleOnlyApplied = 'true';

            const checkbox = form.querySelector('input[name="c[title_only]"]');

            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                // dispara change caso o XenForo escute
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        searchTitlesDone = true;
    }

    // =========================================================
    // FEATURE: painel de busca INLINE na página de RESULTADOS (search_results)
    // Input pré-preenchido (edição rápida da query) + filtros direto no header: escopo · ordenar
    // (relevância ⇄ data) · só-títulos · autor · link pro form avançado pré-preenchido (?searchform=1).
    // A URL canônica do XF carrega TODOS os params da busca (q / t / o / g / c[...]) — é o que deixa
    // o link re-executável quando o cache expira — então dá pra reconstruir os campos e re-POSTar
    // /search/search (mesmo caminho do quick-search; mexer no GET não re-roda confiável). Params sem
    // UI própria (c[newer_than], prefixos, grouped…) PASSAM DIRETO → editar não perde restrição nenhuma.
    // Filtros (escopo/ordenar/só-títulos) aplicam NA HORA (navega); query/autor aplicam no Enter/Buscar.
    // =========================================================
    let rsPanelDone = false;
    function buildSearchResultsPanel() {
        if (rsPanelDone) return;
        if ((document.documentElement.getAttribute('data-template') || '') !== 'search_results') { rsPanelDone = true; return; }
        const header = document.querySelector('.p-body-header');
        if (!header) { if (document.readyState === 'complete') rsPanelDone = true; return; }   // header ainda não parseado → tenta no próximo frame
        rsPanelDone = true;

        const sp = new URLSearchParams(location.search);
        const q0 = sp.get('q') || '';
        const by0 = sp.get('c[users]') || '';
        if (!q0 && !by0) return;   // busca sem params reconstruíveis (ex.: /search/member) → não monta

        // estado atual lido da URL
        let titlesOn = sp.get('c[title_only]') === '1';
        let orderDate = (sp.get('o') || '') === 'date';
        const nodeIds = [];
        sp.forEach((v, k) => { if (/^c\[nodes\]/.test(k) && v) nodeIds.push(v); });
        const inThread = sp.get('c[thread]') || '';
        const tParam = sp.get('t') || '';
        let scope = inThread ? 'thread' : nodeIds.length ? 'forum' : tParam === 'thread' ? 'threads' : tParam ? 'type' : 'everywhere';
        const SCOPES = [{ v: 'everywhere', label: i18n('Everywhere') }, { v: 'threads', label: i18n('Threads') }];
        if (nodeIds.length) SCOPES.push({ v: 'forum', label: i18n('This forum') });
        if (inThread) SCOPES.push({ v: 'thread', label: i18n('This thread') });
        if (scope === 'type') SCOPES.push({ v: 'type', label: tParam });   // tipo sem UI própria (profile_post…) — preserva como veio

        const panel = document.createElement('div');
        panel.id = 'smg-rs-panel';
        panel.innerHTML =
            '<div class="smg-search-bar">' +
                '<span class="smg-search-lupa">' + ICONS.search + '</span>' +
                '<input type="text" class="smg-search-input smg-rs-q" placeholder="Search the forum…" enterkeyhint="search" autocapitalize="off" autocomplete="off" spellcheck="false">' +
                '<button type="button" class="smg-search-go"><span class="smg-search-go-ic">' + ICONS.search + '</span>' + i18n('Search') + '</button>' +
            '</div>' +
            '<div class="smg-search-toolbar">' +
                '<div class="smg-search-scope">' +
                    '<button type="button" class="smg-search-scope-btn">' +
                        '<span class="smg-search-scope-cur"></span>' +
                        '<span class="smg-search-scope-chev">' + svgIcon('<path d="m6 9 6 6 6-6"/>') + '</span>' +
                    '</button>' +
                    '<div class="smg-search-scope-list" hidden></div>' +
                '</div>' +
                '<button type="button" class="smg-search-order-btn">' +
                    '<span class="smg-search-order-ic">' + svgIcon('<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>') + '</span>' +
                    '<span class="smg-search-order-cur"></span>' +
                '</button>' +
                '<button type="button" class="smg-search-switch" role="switch" title="Search thread titles only (ignores post text)">' +
                    '<span class="smg-search-switch-track"><span class="smg-search-switch-thumb"></span></span>' +
                    '<span class="smg-search-switch-lbl">Titles only</span>' +
                '</button>' +
                '<button type="button" class="smg-search-author-btn" aria-label="Author" title="Filter by author">' + svgIcon('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>') + '</button>' +
                '<a class="smg-search-adv" title="Advanced" aria-label="Advanced">' + ICONS.sliders + '</a>' +
            '</div>' +
            '<div class="smg-search-author-wrap" hidden>' +
                '<input type="text" class="smg-search-by" placeholder="Author (optional)">' +
            '</div>';

        const qInput = panel.querySelector('.smg-rs-q');
        const byInput = panel.querySelector('.smg-search-by');
        const authorWrap = panel.querySelector('.smg-search-author-wrap');
        const authorBtn = panel.querySelector('.smg-search-author-btn');
        const titlesSw = panel.querySelector('.smg-search-switch');
        const orderBtn = panel.querySelector('.smg-search-order-btn');
        const orderCur = panel.querySelector('.smg-search-order-cur');
        const scopeBtn = panel.querySelector('.smg-search-scope-btn');
        const scopeCur = panel.querySelector('.smg-search-scope-cur');
        const scopeList = panel.querySelector('.smg-search-scope-list');

        qInput.value = q0;
        byInput.value = by0;
        // form avançado PRÉ-PREENCHIDO com esta busca (mesmo link que o XF usa no título)
        panel.querySelector('.smg-search-adv').href = location.pathname + (location.search ? location.search + '&' : '?') + 'searchform=1';

        function submit() {
            const q = qInput.value.trim(), by = byInput.value.trim();
            if (!q && !by) { qInput.focus(); return; }
            const fields = [['keywords', q]];
            if (scope === 'threads') fields.push(['search_type', 'thread']);
            else if (scope === 'type' && tParam) fields.push(['search_type', tParam]);
            else if (scope === 'thread' && inThread) fields.push(['c[thread]', inThread]);
            else if (scope === 'forum') {
                nodeIds.forEach((id, i) => fields.push(['c[nodes][' + i + ']', id]));
                const cn = sp.get('c[child_nodes]'); if (cn) fields.push(['c[child_nodes]', cn]);
            }
            if (titlesOn) fields.push(['c[title_only]', '1']);
            if (by) fields.push(['c[users]', by]);
            if (orderDate) fields.push(['order', 'date']);   // omitido = relevance (default do XF)
            // o resto da URL passa direto (newer_than/prefixos/…) — só ficam de fora as chaves com UI própria acima
            sp.forEach((v, k) => {
                if (k === 'q' || k === 't' || k === 'o' || k === 'g' || k === 'page' || k === 'searchform'
                    || k === 'c[users]' || k === 'c[title_only]' || k === 'c[thread]' || k === 'c[child_nodes]' || /^c\[nodes\]/.test(k)) return;
                fields.push([k, v]);
            });
            if (sp.get('g')) fields.push(['grouped', sp.get('g')]);   // g (URL) ⇄ grouped (form)
            const qsForm = document.querySelector('form[data-xf-init="quick-search"]');
            const action = qsForm?.getAttribute('action') || '/search/search';
            const token = qsForm?.querySelector('input[name="_xfToken"]')?.value
                || document.querySelector('input[name="_xfToken"]')?.value
                || document.documentElement.getAttribute('data-csrf') || '';
            fields.push(['_xfToken', token]);
            postForm(action, fields);
        }

        // ESCOPO — menu dropdown (mesmo componente do dialog); trocar aplica na hora
        function closeScope() { scopeList.hidden = true; scopeBtn.classList.remove('open'); }
        function paintScope() {
            const s = SCOPES.find(x => x.v === scope) || SCOPES[0];
            scopeCur.textContent = s.label;
            scopeList.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.scope === scope));
        }
        SCOPES.forEach(s => {
            const opt = document.createElement('button');
            opt.type = 'button';
            opt.dataset.scope = s.v;
            opt.textContent = s.label;
            opt.addEventListener('click', () => { closeScope(); if (scope !== s.v) { scope = s.v; paintScope(); submit(); } });
            scopeList.appendChild(opt);
        });
        scopeBtn.addEventListener('click', e => {
            e.stopPropagation();
            const willOpen = scopeList.hidden;
            scopeList.hidden = !willOpen;
            scopeBtn.classList.toggle('open', willOpen);
        });
        document.addEventListener('click', e => { if (!e.target.closest || !e.target.closest('#smg-rs-panel .smg-search-scope')) closeScope(); });

        // ORDENAR — chip-toggle relevância ⇄ data; trocar aplica na hora (é o &o=date da URL)
        function paintOrder() {
            const lbl = i18n(orderDate ? 'Date' : 'Relevance');
            orderCur.textContent = lbl;
            const tip = i18n('Order by') + ' ' + lbl.toLowerCase() + ' — ' + i18n('click to toggle');
            orderBtn.title = tip; orderBtn.setAttribute('aria-label', tip);
        }
        orderBtn.addEventListener('click', () => { orderDate = !orderDate; paintOrder(); submit(); });

        // SÓ TÍTULOS — switch; trocar aplica na hora
        function paintTitles() { titlesSw.classList.toggle('on', titlesOn); titlesSw.setAttribute('aria-checked', titlesOn ? 'true' : 'false'); }
        titlesSw.addEventListener('click', () => { titlesOn = !titlesOn; paintTitles(); submit(); });

        // AUTOR — ícone 👤 revela o campo (aplica no Enter/Buscar)
        function syncAuthor() { authorBtn.classList.toggle('has-value', !!byInput.value.trim()); }
        authorBtn.addEventListener('click', () => {
            const willOpen = authorWrap.hidden;
            authorWrap.hidden = !willOpen;
            authorBtn.classList.toggle('open', willOpen);
            if (willOpen) byInput.focus();
        });
        byInput.addEventListener('input', syncAuthor);
        if (by0) { authorWrap.hidden = false; authorBtn.classList.add('open'); }

        [qInput, byInput].forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }));
        panel.querySelector('.smg-search-go').addEventListener('click', submit);

        paintScope(); paintOrder(); paintTitles(); syncAuthor();

        // monta logo abaixo da linha de termos do header (ou do título, se ela não existir)
        const anchor = header.querySelector('.p-description') || header.querySelector('.p-title');
        if (anchor) anchor.insertAdjacentElement('afterend', panel);
        else header.appendChild(panel);
        i18nDom(panel);
    }

    // =========================================================
    // FEATURE: clicar na imagem abre o modo feed naquela imagem
    // =========================================================

    const absUrl = u => { try { return new URL(u, location.href).href; } catch { return u; } };

    // URL da imagem em resolução cheia: href do <a> (se for imagem) senão o src
    function imageUrlOf(img) {
        const a = img.closest('a');
        const href = a ? (a.getAttribute('href') || '') : '';
        if (/\.(jpe?g|png|gif|webp|avif|bmp)(\?|#|$)/i.test(href)) return absUrl(href);
        // src pode ser um placeholder lazy (data:image/gif base64 1x1) → usa a URL real do data-*
        let src = img.getAttribute('src') || img.src || '';
        if (/^data:/i.test(src)) src = img.getAttribute('data-src') || img.getAttribute('data-url') || img.getAttribute('data-original') || src;
        return absUrl(getBigUrl(src));
    }

    let imageClickBound = false;
    function setupImageClickFeed() {
        if (imageClickBound) return;
        imageClickBound = true;
        // intercepta o clique nas imagens (capture, pra ganhar do lightbox nativo do XenForo)
        document.addEventListener('click', e => {
            if (!e.target.closest) return;
            let img = e.target.closest('img.bbImage');
            if (!img) {
                // imagem ÚNICA (inline) fica dentro de <a href=imagem target=_blank>; o <a> é block e mais largo que a img
                // (centralizada) → clicar na área do <a> ao lado da imagem abria o link. Pega o <a> que embrulha uma bbImage.
                const a = e.target.closest('a');
                if (a && !a.classList.contains('smg-imglink-fallback')) img = a.querySelector('img.bbImage');
                if (!img) return;
            }
            e.preventDefault();
            e.stopPropagation();
            openMediaFeed(imageUrlOf(img));
        }, true);
    }
