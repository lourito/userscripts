    // =========================================================
    // FEATURE: alertas "Limpo" — tira ruído do HTML nativo do XF
    // nativo: "<autor> postou no/replied to <chips> <título>. Podem haver/There may be… · hora · marcar-lido"
    // limpo : 3 linhas → (1) tags coloridas  (2) nome do tópico  (3) publicado por @autor · data + botão marcar-lido
    // Simp usa <span class="label label--x">, SMG usa <span class="prefix prefixx"> — pegamos os dois.
    // estratégia: extrai as peças nativas (move = preserva handlers AJAX) e remonta o .contentRow-main do zero.
    // =========================================================

    // marca um alerta como lido NO SERVIDOR (XF) e atualiza o estado local + o contador do sino
    function markAlertRead(li, btn, href) {
        if (!href || btn.dataset.busy) return;
        btn.dataset.busy = '1';
        const csrf = document.documentElement.getAttribute('data-csrf')
            || (document.querySelector('input[name="_xfToken"]') || {}).value || '';
        // XF valida CSRF de POST pelo CORPO (form-urlencoded), não pela query — replicamos o XF.ajax
        fetch(href, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: '_xfToken=' + encodeURIComponent(csrf) + '&_xfResponseType=json&_xfWithData=1'
        })
            .then(r => r.text().then(txt => ({ ok: r.ok, txt })))
            .then(({ ok, txt }) => {
                let j = null; try { j = JSON.parse(txt); } catch (e) {}
                if (!ok || (j && (j.errors || j.errorHtml))) throw new Error('xf');   // falhou no servidor → NÃO marca local
                if (li && li.classList) { li.classList.remove('is-unread'); li.classList.add('smg-al-old'); }   // some o dot + esmaece na hora (virou lida)
                btn.remove();
                const nav = document.querySelector('.p-navgroup-link--alerts');   // baixa o contador → o observer sincroniza topbar/dock
                if (nav) {
                    const n = Math.max(0, (parseInt(nav.getAttribute('data-badge') || '0', 10) || 0) - 1);
                    if (n > 0) nav.setAttribute('data-badge', String(n)); else nav.removeAttribute('data-badge');
                }
            })
            .catch(() => { delete btn.dataset.busy; });   // falhou → permite tentar de novo
    }
    function cleanAlertRow(main) {
        if (!main || main.dataset.smgAlert) return;
        // título = nome do tópico. Em alerta de COMENTÁRIO o .fauxBlockLink-blockLink é a palavra "commented"
        // e o tópico vem num <a href="/threads/…"> separado → preferimos o link de thread quando existe.
        const title = main.querySelector('a[href*="/threads/"]') || main.querySelector('.fauxBlockLink-blockLink');
        main.dataset.smgAlert = '1';                                    // marca ANTES do guard → alerta sem tópico não é re-escaneado a cada refresh
        if (!title) return;                                             // tipo de alerta sem tópico: deixa nativo (só i18n)
        const isComment = !!main.querySelector('a[href*="/comments/"]');
        // ícone de tipo à ESQUERDA (comentário vs publicação) — diferencia rápido, no lugar da foto removida
        const row = main.parentElement;
        if (row && row.classList.contains('contentRow') && !row.querySelector(':scope > .smg-al-icon')) {
            const ico = document.createElement('span');
            ico.className = 'smg-al-icon ' + (isComment ? 'smg-al-icon--comment' : 'smg-al-icon--post');
            ico.innerHTML = isComment ? ICONS.comment : ICONS.newPost;
            row.insertBefore(ico, row.firstChild);
        }

        const minor = main.querySelector('.contentRow-minor');
        const chips = Array.from(main.querySelectorAll('.label, .prefix'));   // Simp = .label · SMG = .prefix
        const userLink = main.querySelector('a.username, a[href*="/members/"]');

        // linha 3 — tags: move os chips nativos (com a cor da plataforma) pra fora do título
        const tags = document.createElement('div');
        tags.className = 'smg-al-tags';
        chips.forEach(c => { if (c !== title && !c.contains(title)) { c.classList.add('smg-al-chip'); tags.appendChild(c); } });

        // título: chips já saíram → textContent é só o NOME; separadores ( | / ) viram vírgula
        title.textContent = (title.textContent || '')
            .replace(/[|/]/g, ',').replace(/\s*,\s*/g, ', ')
            .replace(/(?:,\s*)+$/, '').replace(/^\s*,\s*/, '')
            .replace(/\s{2,}/g, ' ').trim();
        title.classList.add('smg-al-title');

        // linha 2 — publicado por @autor · hora · ✕
        const by = document.createElement('div');
        by.className = 'smg-al-by';
        if (userLink && userLink !== title) {
            const uname = (userLink.textContent || '').trim().replace(/^@/, '');
            if (uname) {
                userLink.textContent = '@' + uname;
                userLink.classList.add('smg-al-user');
                by.appendChild(document.createTextNode(isComment ? (IS_PT ? 'comentário de ' : 'commented by ') : (IS_PT ? 'publicado por ' : 'posted by ')));
                by.appendChild(userLink);
            }
        }
        let markHref = null;
        if (minor) {
            const timeEl = minor.querySelector('time');
            if (timeEl) { timeEl.classList.add('smg-al-time'); by.appendChild(timeEl); }
            const markRead = Array.from(minor.querySelectorAll('a')).find(a => {
                const href = a.getAttribute('href') || '', cls = a.className || '', txt = (a.textContent || '').trim();
                return /alert-toggle|\/alert\/\d+\/(?:un)?read|mark-read|mark_read/i.test(href)
                    || /alert--mark|alertToggle|alertToggler/i.test(cls)
                    || /^(?:mark read|mark unread|marcar como lido|marcar como não lida|unread|não lida)$/i.test(txt);
            });
            markHref = markRead && markRead.getAttribute('href');
        }

        // remonta do zero: (1) tags · (2) nome · (3) publicado-por+data — verbo, boilerplate e foto não voltam
        main.textContent = '';
        if (tags.children.length) main.appendChild(tags);
        main.appendChild(title);
        if (by.childNodes.length) main.appendChild(by);

        // botão "marcar como lido" SEMPRE visível nas não-lidas — persiste no servidor + atualiza o estado
        const li = main.closest('li.alert') || main.closest('li');
        if (markHref && li && li.classList && li.classList.contains('is-unread')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'smg-al-read';
            btn.title = i18n('Mark read');
            btn.setAttribute('aria-label', i18n('Mark read'));
            const lbl = document.createElement('span');     // texto "Marcar como lido" — só aparece no mobile (CSS)
            lbl.className = 'smg-al-read-txt';
            lbl.textContent = i18n('Mark read');
            btn.appendChild(lbl);
            btn.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); markAlertRead(li, btn, markHref); });
            main.appendChild(btn);
        }
    }

    // agrupa em "Novas" (não lidas) e "Anteriores" (lidas) — estilo Facebook, com cabeçalho de seção
    function groupAlerts(list) {
        const ol = (list.matches && list.matches('ol, ul')) ? list
                 : (list.querySelector && list.querySelector('ol.listPlain, ul.listPlain, ol, ul'));
        if (!ol || ol.dataset.smgGrouped) return;
        const rows = Array.from(ol.children).filter(li => li.querySelector && li.querySelector('.contentRow-main'));
        if (!rows.length) return;
        ol.dataset.smgGrouped = '1';
        const unread = rows.filter(li => li.classList && li.classList.contains('is-unread'));
        const read = rows.filter(li => unread.indexOf(li) < 0);
        const mkHeader = txt => { const li = document.createElement('li'); li.className = 'smg-al-section'; li.textContent = txt; return li; };
        ol.textContent = '';   // limpa rows + separador nativo + espaços em branco
        if (unread.length) { ol.appendChild(mkHeader(IS_PT ? 'Não lidas' : 'Unread')); unread.forEach(li => ol.appendChild(li)); }
        if (read.length) { ol.appendChild(mkHeader(IS_PT ? 'Lidas' : 'Read')); read.forEach(li => { li.classList.add('smg-al-old'); ol.appendChild(li); }); }
    }

    function cleanAlertList(list) {
        if (!list) return;
        try {
            if (list.classList) list.classList.add('smg-alert-clean');
            list.querySelectorAll('.contentRow-main:not([data-smg-alert])').forEach(main => {
                try { cleanAlertRow(main); } catch (e) {}
            });
            groupAlerts(list);
        } catch (e) {}
        i18nDom(list);   // "Mark read" → "Marcar como lido" + qualquer resíduo EN do HTML buscado
    }
