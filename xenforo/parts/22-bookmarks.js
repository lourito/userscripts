    // =========================================================
    // BOOKMARKS como FEED — a página /account/bookmarks lista POSTS salvos (.contentRow → /posts/{id}/).
    // REPLACE TOTAL: esconde a visão nativa e mostra um feed com EXATAMENTE esses posts — parseia a lista (todas as
    // páginas), busca o conteúdo de cada post e renderiza com riverCard (mesmo visual do feed da home) + a nota do
    // bookmark. Reusa riverParsePost/riverThreadMeta/riverCard/riverEnqueue/fetchDoc (escopo do IIFE).
    // =========================================================
    function isBookmarksPage() {
        return (document.documentElement.getAttribute('data-template') || '') === 'account_bookmarks';
    }
    function bmNextLink(doc) {
        const a = doc.querySelector('a.pageNav-jump--next[href], link[rel="next"][href], a[rel="next"][href]');
        const h = a && a.getAttribute('href');
        if (!h) return null;
        try { return new URL(h, location.href).href; } catch (e) { return null; }
    }
    // parseia as linhas de bookmark de um doc → [{postId, postUrl, title, author, authorHref, thumb, note}]
    function bmParseRows(doc) {
        const out = [], seen = new Set();
        doc.querySelectorAll('.contentRow').forEach(row => {
            const titleA = row.querySelector('.contentRow-title a[href*="/posts/"]');
            // fallback do link: o menu "Copy link / Edit" também aponta /posts/{id}/...
            const href = (titleA && titleA.getAttribute('href')) || (row.querySelector('a[href*="/posts/"]') || {}).href || '';
            const m = href.match(/\/posts\/(\d+)/);
            if (!m) return;
            const postId = m[1]; if (seen.has(postId)) return; seen.add(postId);
            let title = ((titleA && titleA.textContent) || '').replace(/\s+/g, ' ').trim();
            title = title.replace(/^Post in thread\s*/i, '').replace(/^['"‘’“”]+|['"‘’“”]+$/g, '').trim();
            const av = row.querySelector('.contentRow-figure .avatar img, .contentRow-figure img');
            const thumb = (av && (av.getAttribute('src') || '')) || '';
            const authorA = row.querySelector('.contentRow-minor a.username, .contentRow-minor a[href*="/members/"]');
            const author = (authorA && authorA.textContent.trim()) || (row.querySelector('.contentRow-figure .avatar[title]') || {}).title || '';
            let note = ((row.querySelector('.contentRow-snippet') || {}).textContent || '').replace(/\s+/g, ' ').trim();
            if (/^no bookmark note\.?$/i.test(note)) note = '';
            const te = row.querySelector('.contentRow-minor time, time');   // data do bookmark → ordenação (desc) e diff
            let bmTs = te ? (parseInt(te.getAttribute('data-timestamp') || '0', 10) || 0) : 0;
            if (!bmTs && te) { const dt = te.getAttribute('datetime'); if (dt) { const ms = Date.parse(dt); if (!isNaN(ms)) bmTs = Math.floor(ms / 1000); } }
            let postUrl; try { postUrl = new URL(href, location.href).href; } catch (e) { return; }
            out.push({ postId: postId, postUrl: postUrl, title: title, author: author, authorHref: authorA ? authorA.getAttribute('href') : '', thumb: /^data:/.test(thumb) ? '' : thumb, note: note, bmTs: bmTs });
        });
        return out;
    }
    // lista COMPLETA de bookmarks: página atual (document) + segue a paginação (sequencial)
    function bmFetchAllRows() {
        const rows = bmParseRows(document);
        const next = bmNextLink(document);
        if (!next) return Promise.resolve(rows);
        const seen = new Set(rows.map(r => r.postId));
        const walk = (url, depth) => fetchDoc(url, { credentials: 'same-origin' }).then(doc => {
            bmParseRows(doc).forEach(r => { if (!seen.has(r.postId)) { seen.add(r.postId); rows.push(r); } });
            const n = bmNextLink(doc);
            return (n && depth < 40) ? walk(n, depth + 1) : rows;
        }, () => rows);
        return walk(next, 1);
    }
    // busca o conteúdo do post salvo → objeto serializável do riverParsePost (null se sumiu/erro)
    function bmFetchPost(row) {
        return fetchDoc(row.postUrl, { credentials: 'same-origin' }).then(doc => {
            const postEl = doc.querySelector('article[data-content="post-' + row.postId + '"]') || doc.getElementById('js-post-' + row.postId)
                || doc.querySelector('article.message--post');   // fallback: o /posts/{id}/ cai na página posicionada nesse post
            if (!postEl) return null;
            const meta = riverThreadMeta(doc, { fallbackTitle: row.title, thumb: row.thumb });
            return riverParsePost(postEl, meta, row.postUrl);
        }, () => null);
    }
    // REMOVE dos salvos: busca o form de confirmação (/posts/{id}/bookmark?delete=1, sem AJAX → HTML) e submete via POST.
    // 2 passos = robusto ao contrato exato do XF (pega _xfToken + campos do próprio form). Resolve true no sucesso.
    function bmUnsave(postId) {
        return fetchDoc('/posts/' + postId + '/bookmark?delete=1', { credentials: 'same-origin' }).then(doc => {
            const form = doc.querySelector('form[action*="/bookmark"]') || doc.querySelector('form.block, form');
            if (!form) return false;
            const fd = new FormData();
            form.querySelectorAll('input[name], textarea[name], select[name]').forEach(i => { if (i.type !== 'submit' && i.name) fd.append(i.name, i.value); });
            if (!fd.has('delete')) fd.append('delete', '1');
            fd.set('_xfResponseType', 'json'); fd.append('_xfWithData', '1');
            let action; try { action = new URL(form.getAttribute('action') || ('/posts/' + postId + '/bookmark'), location.href).href; } catch (e) { action = '/posts/' + postId + '/bookmark'; }
            return fetch(action, { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: fd })
                .then(r => r.ok ? r.json().catch(() => ({})) : null)
                .then(j => !!j && !(j.errors && j.errors.length));
        }, () => false).catch(() => false);
    }
    // card do feed (riverCard) + a nota do bookmark por cima do conteúdo + botão "remover dos salvos"
    function bmCard(obj, row) {
        const card = riverCard(obj, 0);   // wm=0 → nunca marca "novo"
        card.dataset.bmId = row.postId; card.dataset.bmTs = String(row.bmTs || 0);
        if (row.note) {
            const n = document.createElement('div'); n.className = 'smg-bm-note'; n.textContent = row.note;
            const c = card.querySelector('.smg-fp-content');
            if (c) card.insertBefore(n, c); else card.appendChild(n);
        }
        const rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'smg-bm-remove'; rm.title = i18n('Remove from saved'); rm.setAttribute('aria-label', i18n('Remove from saved'));
        rm.innerHTML = ICONS.bookmarkRemove;
        rm.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            if (rm.disabled) return; rm.disabled = true; rm.classList.add('is-busy');
            bmUnsave(row.postId).then(ok => {
                if (!ok) { rm.disabled = false; rm.classList.remove('is-busy'); return; }
                fdbDeleteBookmark(row.postId);   // tira do cache → não volta na próxima abertura
                card.classList.add('smg-bm-leaving');   // some com animação e tira do DOM
                setTimeout(() => card.remove(), 260);
            });
        });
        const share = card.querySelector('.smg-fp-share');
        if (share && share.parentNode) share.parentNode.insertBefore(rm, share);   // antes do compartilhar (que fica na borda)
        else (card.querySelector('.smg-fp-head') || card).appendChild(rm);
        return card;
    }
    function bmCardFromRec(rec) { return bmCard(rec.obj, { postId: rec.postId, note: rec.note, bmTs: rec.bmTs }); }
    // insere `node` (tem data-bm-ts) na lista mantendo ordem por bmTs DESC
    function bmPlaceByTs(list, node) {
        const ts = +(node.dataset.bmTs || 0);
        const kids = list.children;
        for (let i = 0; i < kids.length; i++) { if (ts > +(kids[i].dataset.bmTs || 0)) { list.insertBefore(node, kids[i]); return; } }
        list.appendChild(node);
    }
    let bmRendered = false;
    // RENDER: pinta do CACHE na hora (sem "configurando"), depois revalida pela rede e faz o DIFF (remove os que saíram,
    // busca só os NOVOS, atualiza nota/ordem). Sem IndexedDB, fdbGetBookmarks→[] e os put/delete viram no-op → cai no
    // comportamento antigo (busca tudo). O "Configurando…" só aparece quando NÃO há nada em cache (1ª vez).
    function renderBookmarksFeed(list) {
        if (bmRendered) return; bmRendered = true;
        fdbGetBookmarks().then(cached => {
            if (!list.isConnected) return;
            const byId = Object.create(null); cached.forEach(c => { byId[c.postId] = c; });
            const hadCache = cached.length > 0;
            if (hadCache) {
                list.innerHTML = '';
                cached.slice().sort((a, b) => (b.bmTs || 0) - (a.bmTs || 0)).forEach(rec => { try { list.appendChild(bmCardFromRec(rec)); } catch (e) {} });
            } else {
                list.innerHTML = '<div class="smg-fp-setup"><span class="smg-fp-setup-spin"></span><div class="smg-fp-setup-title">' + i18n('Setting up your feed') + '</div><div class="smg-fp-setup-sub">' + i18n('Gathering posts…') + '</div></div>';
            }
            bmFetchAllRows().then(rows => {
                if (!list.isConnected) return;
                const live = Object.create(null); rows.forEach(r => { live[r.postId] = r; });
                // removidos dos salvos (em outro dispositivo/aba) → tira do cache e da tela
                cached.forEach(c => { if (!live[c.postId]) { fdbDeleteBookmark(c.postId); const el = list.querySelector('[data-bm-id="' + c.postId + '"]'); if (el) el.remove(); } });
                // atualiza nota/ordem dos já cacheados (barato)
                rows.forEach(r => { const c = byId[r.postId]; if (c && (c.note !== r.note || c.bmTs !== r.bmTs)) { c.note = r.note; c.bmTs = r.bmTs; fdbPutBookmark(c); } });
                const fresh = rows.filter(r => !byId[r.postId]);
                if (!hadCache) { if (!rows.length) { list.innerHTML = '<div class="smg-fp-empty">' + i18n('No recent posts') + '</div>'; return; } list.innerHTML = ''; }
                if (!hadCache && !fresh.length) { list.innerHTML = '<div class="smg-fp-empty">' + i18n('No recent posts') + '</div>'; return; }
                fresh.forEach(r => {
                    const ph = document.createElement('div'); ph.className = 'smg-bm-skel'; ph.dataset.bmId = r.postId; ph.dataset.bmTs = String(r.bmTs || 0);
                    bmPlaceByTs(list, ph);   // posição certa por bmTs (novos salvos = topo)
                    riverEnqueue(() => bmFetchPost(r).then(obj => {
                        if (!ph.isConnected) return;
                        if (!obj) { ph.remove(); return; }
                        const rec = { postId: r.postId, obj: obj, note: r.note, bmTs: r.bmTs };
                        fdbPutBookmark(rec);
                        try { ph.replaceWith(bmCardFromRec(rec)); } catch (e) { ph.remove(); }
                    }));
                });
            }, () => { if (!hadCache && list.isConnected) list.innerHTML = '<div class="smg-fp-empty">' + i18n('No recent posts') + '</div>'; });
        });
    }
    let bmBuilt = false;
    function setupBookmarksFeed() {
        if (!FEATURES.bookmarksFeed || bmBuilt || !isBookmarksPage()) return;
        const blockBody = document.querySelector('.p-body-pageContent .block-body') || document.querySelector('.block-body');
        if (!blockBody || !blockBody.parentNode) return;
        bmBuilt = true;
        // REPLACE TOTAL: esconde a visão nativa inteira (barra de filtros + lista) e renderiza o feed no lugar dela.
        document.documentElement.classList.add('smg-bm-feed-on');   // CSS esconde a sidebar da conta + dá largura cheia
        const nativeBlock = blockBody.closest('.block') || blockBody;
        const feed = document.createElement('div'); feed.id = 'smg-bm-feed';
        const list = document.createElement('div'); list.className = 'smg-fp-list'; feed.appendChild(list);
        nativeBlock.parentNode.insertBefore(feed, nativeBlock);
        nativeBlock.style.setProperty('display', 'none', 'important');
        renderBookmarksFeed(list);
    }
