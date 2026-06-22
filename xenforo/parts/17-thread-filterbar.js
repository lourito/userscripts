    // =========================================================
    // BARRA ÚNICA SEGMENTADA (filter bar) — SMG · thread + fórum
    // Um componente só (pager · ordenar · ações). Espelha os links do XF e
    // PROXY-CLICA os botões nativos (que ficam escondidos no DOM, igual a dock faz):
    // watch/mark-read/translate/jump-to-new/menu seguem com o comportamento AJAX do XF.
    // O .block-outer nativo é escondido (fonte de dados pro scroll infinito + page-jump).
    // Mapa: smgBarBtn/smgPopHost/smgJumpHost (blocos) · smgPagerGroup/smgSortGroup/smgPrimaryActions/smgMoreButton (grupos) · buildFilterBars (monta tudo) · fetchXfList (AJAX da listagem).
    // =========================================================
    const SMG_CHEVRON = dir => svgIcon(dir < 0 ? '<path d="m15 18-6-6 6-6"/>' : '<path d="m9 18 6-6-6-6"/>');
    const SMG_ICO = {   // ⚠️ ícones SÓ do filtro-bar (paths crus p/ svgIcon()). check saiu → usar ICONS.shareDone (era idêntico)
        globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
        eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
        thumb: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    };

    // tooltip estilo dock, mas position:FIXED (escapa o overflow:hidden da barra). um elemento só, reposicionado.
    let smgTipEl = null;
    function smgShowTip(btn, text) {
        if (!smgTipEl) { smgTipEl = document.createElement('div'); smgTipEl.className = 'smg-bar-tip'; document.body.appendChild(smgTipEl); }
        smgTipEl.textContent = text;
        const r = btn.getBoundingClientRect();
        smgTipEl.style.left = Math.round(r.left + r.width / 2) + 'px';
        smgTipEl.style.top = Math.round(r.top - 8) + 'px';
        smgTipEl.classList.add('show');
    }
    function smgHideTip() { if (smgTipEl) smgTipEl.classList.remove('show'); }

    function smgBarBtn({ icon, label, title, href, current, onClick, cls }) {
        title = i18n(title); label = i18n(label);
        const el = document.createElement(href ? 'a' : 'button');
        if (href) el.href = href; else el.type = 'button';
        el.className = 'smg-bar-btn' + (icon && !label ? ' smg-bar-btn--icon' : '') + (current ? ' smg-bar-btn--current' : '') + (cls ? ' ' + cls : '');
        if (title) { el.title = title; el.setAttribute('aria-label', title); }
        el.innerHTML = (icon ? '<span class="smg-bar-ic">' + icon + '</span>' : '') + (label ? '<span>' + label + '</span>' : '');
        if (onClick) el.addEventListener('click', onClick);
        // ícones (sem label visível) ganham o tooltip custom no hover (lê el.title VIVO → watch atualiza)
        if (title && icon && !label) {
            el.addEventListener('mouseenter', () => smgShowTip(el, el.title || title));
            el.addEventListener('mouseleave', smgHideTip);
            el.addEventListener('click', smgHideTip);
        }
        return el;
    }

    // popover ancorado num botão (abre no clique, fecha clicando fora). pop é position:fixed →
    // posiciono acima do botão na hora de abrir (escapa o overflow:hidden da barra).
    function smgPopHost(triggerBtn, popEl) {
        const host = document.createElement('span');
        host.className = 'smg-bar-pophost';
        const place = () => {
            const r = triggerBtn.getBoundingClientRect();
            popEl.style.left = Math.round(r.left + r.width / 2) + 'px';
            popEl.style.top = Math.round(r.top - 8) + 'px';
        };
        triggerBtn.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            const open = host.classList.toggle('open');
            if (open) { place(); setTimeout(() => { const i = popEl.querySelector('input'); if (i) i.focus(); }, 0); }
        });
        document.addEventListener('click', e => { if (!host.contains(e.target)) host.classList.remove('open'); });
        host.append(triggerBtn, popEl);
        return host;
    }

    // "ir pra página" (template /page-%page%): input + Go
    function smgJumpHost(tpl, max, label, cls) {
        const btn = smgBarBtn({ label, title: 'Go to page', cls });
        const pop = document.createElement('div'); pop.className = 'smg-bar-pop smg-bar-pop--jump';
        const input = document.createElement('input'); input.type = 'number'; input.min = '1';
        if (max) { input.max = String(max); input.placeholder = '1–' + max; }
        const go = document.createElement('button'); go.type = 'button'; go.className = 'smg-bar-go'; go.textContent = i18n('Go');
        const nav = () => {
            const n = parseInt(input.value, 10);
            if (!n || n < 1 || !tpl || (max && n > +max)) return;
            let url = (n === 1) ? tpl.replace(/\/page-%page%/, '/') : tpl.replace('%page%', String(n));
            if (location.search && url.indexOf('?') < 0 && /[?&]order=/.test(location.search)) url += location.search;
            window.location.href = url;
        };
        go.addEventListener('click', nav);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nav(); } });
        pop.append(input, go);
        return smgPopHost(btn, pop);
    }

    function smgPageUrlTpl(wrap) {
        const row = wrap.querySelector('[data-page-url]');
        if (row) return row.getAttribute('data-page-url');                 // .../page-%page%
        const any = wrap.querySelector('.pageNav-page > a[href*="/page-"]');
        return any ? any.getAttribute('href').replace(/\/page-\d+/, '/page-%page%') : null;
    }
    function smgCurPage(wrap) {
        const cur = wrap.querySelector('.pageNav-page--current');
        if (cur) return (cur.textContent || '').trim();
        const simp = wrap.querySelector('.pageNavSimple-el--current');
        const m = simp && (simp.textContent || '').match(/(\d+)\s*of/i);
        return m ? m[1] : '1';
    }

    // GRUPO 1 — pager (números no desktop · cur/max no mobile · prev/next · jump)
    function smgPagerGroup(wrap) {
        const main = wrap.querySelector('.pageNav-main');
        if (!main) return null;
        const g = document.createElement('div'); g.className = 'smg-bar-group smg-bar-pager';
        const prev = wrap.querySelector('.pageNav-jump--prev');
        const next = wrap.querySelector('.pageNav-jump--next');
        const tpl = smgPageUrlTpl(wrap);
        const pjInput = wrap.querySelector('.js-pageJumpPage');
        const max = pjInput ? pjInput.getAttribute('max') : null;
        if (prev) g.appendChild(smgBarBtn({ icon: SMG_CHEVRON(-1), title: 'Previous', href: prev.getAttribute('href') }));
        // compacto (mobile): cur / max
        const compact = document.createElement('span'); compact.className = 'smg-bar-compact';
        compact.textContent = smgCurPage(wrap) + (max ? ' / ' + max : '');
        g.appendChild(compact);
        // números (desktop) — espelha os <li> que o XF mostra
        const pages = document.createElement('span'); pages.className = 'smg-bar-pages';
        main.querySelectorAll(':scope > li').forEach(li => {
            if (li.classList.contains('pageNav-page--skip')) { if (tpl) pages.appendChild(smgJumpHost(tpl, max, '…', 'smg-bar-jump')); return; }
            const a0 = li.querySelector('a'); if (!a0) return;
            pages.appendChild(smgBarBtn({ label: (a0.textContent || '').trim(), href: a0.getAttribute('href'), current: li.classList.contains('pageNav-page--current') }));
        });
        g.appendChild(pages);
        if (next) g.appendChild(smgBarBtn({ icon: SMG_CHEVRON(1), title: 'Next', href: next.getAttribute('href') }));
        return g;
    }

    // GRUPO 2 — ordenar (data ⇄ reações): dois <a> reais, ativo = knob branco. só thread.
    function smgSortGroup(bo) {
        const wrap = bo.querySelector('.tabs--standalone');
        if (!wrap) return null;
        // acha os 2 links por HREF (independe de idioma): reação tem ?order=reaction_score; data é a sem order=
        let dateLink = null, reactLink = null;
        wrap.querySelectorAll('.tabs-tab').forEach(t => {
            const h = t.getAttribute('href') || '';
            if (/order=reaction/i.test(h)) reactLink = t;
            else if (!/order=/i.test(h)) dateLink = t;
        });
        if (!dateLink || !reactLink) return null;
        const onReactions = /[?&]order=reaction/i.test(location.search) || reactLink.classList.contains('is-active');
        // TOGGLE ÚNICO (igual a dock): ícone de ORDENAÇÃO (⇅) + critério atual; clicar leva pro outro
        const curLabel = onReactions ? i18n('Reactions') : i18n('Date');
        const orderIcon = svgIcon('<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>');
        const g = document.createElement('div'); g.className = 'smg-bar-group smg-bar-sort';
        const btn = smgBarBtn({
            icon: orderIcon,
            label: curLabel,
            href: (onReactions ? dateLink : reactLink).getAttribute('href'),
            cls: 'smg-bar-sorttoggle',
        });
        // tooltip (botão tem label, então o auto-tooltip não pega → adiciono manual)
        const tip = i18n('Order by') + ' ' + curLabel.toLowerCase() + ' — ' + i18n('click to toggle');
        btn.title = tip; btn.setAttribute('aria-label', tip);
        btn.addEventListener('mouseenter', () => smgShowTip(btn, tip));
        btn.addEventListener('mouseleave', smgHideTip);
        btn.addEventListener('click', smgHideTip);
        g.appendChild(btn);
        return g;
    }

    // GRUPO 3 — ações (ícones que PROXY-CLICAM o nativo escondido)
    function smgProxyConfirm(nativeEl) { // watch/mark-read: clica + auto-confirma o overlay
        nativeEl.click();
        waitForElement('.overlay button[type="submit"].button--primary, .overlay .button--cta', 4000).then(c => c && c.click());
    }

    // GRUPO 3 — ações PRIMÁRIAS (ícones que PROXY-CLICAM o nativo): ir-pra-nova · seguir · marcar lido · traduzir
    function smgPrimaryActions(bo) {
        const g = document.createElement('div'); g.className = 'smg-bar-group smg-bar-actions';
        let n = 0;
        const jumpNew = bo.querySelector('[data-xf-click="scroll-to"]');
        if (jumpNew) { g.appendChild(smgBarBtn({ icon: svgIcon('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'), title: 'Go to new', onClick: () => jumpNew.click() })); n++; }
        const watch = bo.querySelector('[data-sk-watch]');
        if (watch) {
            // ICONS.watch/unwatch JÁ são <svg> completos → usar direto. Estado por idioma-neutro + destaque.
            const b = smgBarBtn({ icon: ICONS.watch, title: 'Watch' });
            const paint = on => {
                b.querySelector('.smg-bar-ic').innerHTML = on ? ICONS.unwatch : ICONS.watch;
                b.title = on ? 'Unwatch' : 'Watch';
                b.classList.toggle('smg-bar-btn--on', on);   // destaca quando seguindo
            };
            paint(smgIsWatching(watch));
            b.addEventListener('click', () => {
                paint(!smgIsWatching(watch));                // REATIVO: vira na hora (otimista)
                smgProxyConfirm(watch);
                setTimeout(() => paint(smgIsWatching(watch)), 1500);  // re-sincroniza
            });
            g.appendChild(b); n++;
        }
        const markRead = bo.querySelector('a[href*="mark-read"]');
        if (markRead) { g.appendChild(smgBarBtn({ icon: ICONS.shareDone, title: 'Mark read', onClick: () => smgProxyConfirm(markRead) })); n++; }
        const tr = bo.querySelector('.smgTranslator-globalBtn');
        if (tr) { g.appendChild(smgBarBtn({ icon: svgIcon(SMG_ICO.globe), title: 'Translate', onClick: () => tr.click() })); n++; }
        // HIDE/SHOW DISCUSSIONS (addon do site): vira ícone na barra (proxy-click no nativo escondido), junto do translate.
        // ESPELHA o nativo: ícone eye/eye-slash + texto + contagem vêm dele (sem assumir semântica/idioma). bo.querySelector
        // primeiro (1 nativo por block-outer, igual translate); fallback no document se vier solto. Guard 1×/elemento:
        // 2 barras (topo+rodapé) compartilhando UM nativo → 1 proxy só (evita dessincronizar); natives por-barra → 1 cada.
        const disc = bo.querySelector('.smg-discussion-toggle') || document.querySelector('.smg-discussion-toggle');
        if (disc && !disc.dataset.smgDiscProxied) {
            disc.dataset.smgDiscProxied = '1';
            const txtEl = disc.querySelector('.smg-toggle-text');
            const cntEl = disc.querySelector('.smg-discussion-count');
            const b = smgBarBtn({ icon: svgIcon(SMG_ICO.eyeOff), title: 'Hide Discussions' });
            const paint = () => {
                const slash = !!disc.querySelector('.fa-eye-slash');   // espelha o ícone nativo (eye-slash = mostrando → clicar esconde)
                b.querySelector('.smg-bar-ic').innerHTML = svgIcon(slash ? SMG_ICO.eyeOff : SMG_ICO.eye);
                const txt = (txtEl && txtEl.textContent.trim()) || i18n('Discussions');
                const cnt = (cntEl && cntEl.textContent.trim()) || '';
                const lbl = txt + (cnt ? ' ' + cnt : '');
                b.title = lbl; b.setAttribute('aria-label', lbl);   // tooltip = texto+contagem vivos do nativo
                b.classList.toggle('smg-bar-btn--on', !slash);   // destaca quando as discussões estão ESCONDIDAS
            };
            paint();
            b.addEventListener('click', () => { disc.click(); setTimeout(paint, 60); });   // proxy-click + re-sincroniza
            g.appendChild(b); n++;   // o nativo é escondido por CSS (.smg-discussion-toggle-container, em 05) — robusto a múltiplas instâncias + re-render do addon
        }
        return n ? g : null;
    }

    // GRUPO 4 — "Mais" (•••): menu nativo + botões diretos não-primários (ex.: Bump), deduplicados.
    // Cada linha PROXY-CLICA o nativo (preserva overlay/menu do XF) → nada some.
    function smgMoreButton(bo) {
        const moreTrigger = bo.querySelector('.menuTrigger, button[data-xf-click="menu"]');
        const moreMenu = moreTrigger && (moreTrigger.parentElement?.querySelector('.menu .menu-content')
            || (moreTrigger.closest('.buttonGroup-buttonWrapper') || {}).querySelector?.('.menu-content'));
        const items = [], seen = new Set();
        const push = (el, label) => {
            const key = (label || '').toLowerCase().replace(/\s+/g, ' ').trim();
            if (!key || seen.has(key)) return; seen.add(key);
            items.push({ label: (label || '').trim(), el });
        };
        if (moreMenu) moreMenu.querySelectorAll('.menu-linkRow').forEach(r => push(r, r.textContent));
        bo.querySelectorAll('.buttonGroup .button--link, .buttonGroup a.button, .buttonGroup button.button').forEach(b => {
            if (b.classList.contains('menuTrigger') || b.hasAttribute('data-sk-watch') || b.classList.contains('smgTranslator-globalBtn')
                || b.getAttribute('data-xf-click') === 'scroll-to' || (b.getAttribute('href') || '').indexOf('mark-read') >= 0) return;
            push(b, (b.querySelector('.button-text') || b).textContent);
        });
        if (!items.length) return null;
        const g = document.createElement('div'); g.className = 'smg-bar-group smg-bar-more';
        const btn = smgBarBtn({ label: '⋯', title: 'More' });
        const pop = document.createElement('div'); pop.className = 'smg-bar-pop';
        items.forEach(it => {
            const row = document.createElement('button'); row.type = 'button'; row.className = 'smg-bar-poprow'; row.textContent = it.label;
            row.addEventListener('click', e => { e.stopPropagation(); btn.closest('.smg-bar-pophost').classList.remove('open'); it.el.click(); });
            pop.appendChild(row);
        });
        g.appendChild(smgPopHost(btn, pop));
        return g;
    }

    function smgDivider() { const d = document.createElement('span'); d.className = 'smg-bar-div'; return d; }

    // HEADER DA THREAD (.p-body-header): linha de ações (feed · galeria · download, maiores) ACIMA do título,
    // e remove autor + data da linha de descrição (mantém as tags). Roda 1× no boot (header é server-render, estático).
    function buildThreadHeader() {
        if (!document.documentElement.classList.contains('smg-thread')) return;   // só em thread (fórum tem .p-body-header também)
        const header = document.querySelector('.p-body-header:not([data-smg-thead])');
        if (!header) return;
        header.setAttribute('data-smg-thead', '1');
        // tira autor + data da .p-description (mantém as tags)
        const desc = header.querySelector('.p-description');
        if (desc) {
            const u = desc.querySelector('a.username'); const ul = u && u.closest('li'); if (ul) ul.remove();
            const t = desc.querySelector('time'); const tl = t && t.closest('li'); if (tl) tl.remove();
        }
        // linha de ações no topo do header (feed/galeria/download), com navegação própria (página 1)
        const bar = document.createElement('div'); bar.className = 'smg-thead-actions';
        const mk = (icon, title, label, onClick) => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'smg-thead-btn';
            b.title = i18n(title); b.setAttribute('aria-label', i18n(title));
            b.innerHTML = '<span class="smg-thead-ic">' + icon + '</span>';
            const l = document.createElement('span'); l.className = 'smg-thead-lbl'; l.textContent = i18n(label);   // visível só no mobile (CSS)
            b.appendChild(l);
            if (onClick) b.addEventListener('click', onClick);
            b.addEventListener('mouseenter', () => smgShowTip(b, b.title));   // reusa o tooltip fixed da barra
            b.addEventListener('mouseleave', smgHideTip); b.addEventListener('click', smgHideTip);
            return b;
        };
        // ícones outline limpos (sem depender de fill): feed = play · galeria = grade · download = seta. Label só no mobile.
        if (FEATURES.mediaFeed) bar.appendChild(mk(svgIcon('<polygon points="6 3 20 12 6 21 6 3"/>'), 'Feed mode', 'Feed', () => openMediaFeed(null, null, { fromStart: true })));
        bar.appendChild(mk(ICONS.gallery, 'Gallery', 'Gallery', () => openGallery()));
        if (FEATURES.mediaDownload) { const d = mk(ICONS.download, 'Download media', 'Download', null); d.addEventListener('click', () => openDownloadModal()); bar.appendChild(d); }
        // DESKTOP: na linha do título, fixo à direita (dentro do .p-title → coluna centralizada).
        // MOBILE: a barra DESCE pra depois das tags → ordem unificada título → tags → ações
        // (antes a barra full-width entrava no meio e as tags ficavam órfãs DEPOIS dos botões).
        // matchMedia move o nó só ao cruzar o breakpoint (1 listener, zero custo no scroll/resize comum).
        const title = header.querySelector('.p-title');
        const placeBar = mobile => {
            if (mobile && desc && desc.parentNode) desc.insertAdjacentElement('afterend', bar);
            else if (title) title.appendChild(bar);
            else header.insertBefore(bar, header.firstChild);
        };
        const mqMob = window.matchMedia ? window.matchMedia('(max-width: 600px)') : null;
        placeBar(!!(mqMob && mqMob.matches));
        if (mqMob) { const onMq = e => placeBar(e.matches); if (mqMob.addEventListener) mqMob.addEventListener('change', onMq); else if (mqMob.addListener) mqMob.addListener(onMq); }
    }

    function buildFilterBars() {
        const cl = document.documentElement.classList;
        if (!cl.contains('smg-thread') && !cl.contains('smg-threadlist')) return;   // os 2 sites (SMG + simpcity)
        document.querySelectorAll('.block-outer:not([data-smg-bar])').forEach(bo => {
            const wrap = bo.querySelector('.pageNavWrapper');
            const bar = document.createElement('div'); bar.className = 'smg-bar';
            const add = g => { if (!g) return; if (bar.children.length) bar.appendChild(smgDivider()); bar.appendChild(g); };
            // ordem: pager · ações(…sino…traduzir) · ORDENAR · mais(•••)
            add(wrap ? smgPagerGroup(wrap) : null);
            add(smgPrimaryActions(bo));
            add(smgSortGroup(bo));
            add(smgMoreButton(bo));
            bo.setAttribute('data-smg-bar', '1');      // marca SEMPRE (mesmo barra vazia) → não re-varre/reconstrói todo frame
            if (!bar.children.length) return;          // nada útil nessa barra → deixa o nativo
            // esconde os nativos (ficam no DOM: proxy-click + scroll infinito leem deles)
            Array.from(bo.children).forEach(c => c.style.setProperty('display', 'none', 'important'));
            bo.insertBefore(bar, bo.firstChild);
        });
    }

    // =========================================================
    // POST estilo REDDIT: card de 1 coluna — header (avatar · nome · tempo · #N + título/banners/stats),
    // conteúdo (inalterado) e action bar (React · Comentar · Compartilhar · Salvar · Traduzir · ⋯).
    // MOVE os botões NATIVOS pro card (preserva o AJAX/tooltip/picker do XF — os relative-selectors do XF
    // resolvem porque tudo continua DENTRO do mesmo <article>); o CSS (.smg-pc) esconde os containers vazios
    // (coluna do usuário, attribution, actionBar nativa). Escopado (buildPostCards no processAll) → pega posts
    // do scroll infinito. 1×/post via data-smg-card.
    // =========================================================
    function smgRelTime(tsSec) {   // epoch s → "há 4 meses" / "4mo ago"
        let s = Math.floor(Date.now() / 1000) - tsSec;
        if (s < 45) return IS_PT ? 'agora' : 'now';
        const U = IS_PT
            ? [[31536000, 'ano', 'anos'], [2592000, 'mês', 'meses'], [604800, 'semana', 'semanas'], [86400, 'dia', 'dias'], [3600, 'hora', 'horas'], [60, 'minuto', 'minutos']]
            : [[31536000, 'y', 'y'], [2592000, 'mo', 'mo'], [604800, 'w', 'w'], [86400, 'd', 'd'], [3600, 'h', 'h'], [60, 'm', 'm']];
        for (const [sec, one, many] of U) {
            const n = Math.floor(s / sec);
            if (n >= 1) return IS_PT ? ('há ' + n + ' ' + (n === 1 ? one : many)) : (n + many + ' ago');
        }
        return IS_PT ? 'agora' : 'now';
    }
    function smgKNum(n) { return n >= 1000 ? (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'k' : String(n); }
    function smgReactionLabel(n) {   // o react é um CONTADOR: "1 reação" / "6 reações" (PT) · "1 reaction" / "6 reactions" (EN)
        const w = IS_PT ? (n === 1 ? 'reação' : 'reações') : (n === 1 ? 'reaction' : 'reactions');
        return smgKNum(n) + ' ' + w;
    }
    function smgPostReactionCount(post) {   // SÓ as reações do POST: a .reactionsBar dele. NÃO somar comentários (usam .comment-reactions) — era o "React 6"
        const bar = post.querySelector('.message-cell--main .reactionsBar');
        let n = 0; if (bar) bar.querySelectorAll('.smgReactionPill-count').forEach(c => n += parseInt(c.textContent, 10) || 0);
        if (n) return n;
        const md = post.querySelector('.message-footer .message-microdata meta[itemprop="userInteractionCount"]');
        if (md && +md.getAttribute('content')) return +md.getAttribute('content');
        if (bar) { const names = bar.querySelectorAll('.reactionsBar-link bdi').length; const m = (bar.textContent || '').match(/(\d[\d.,]*)\s*(?:outros|others)/i); return names + (m ? (parseInt(m[1].replace(/[.,]/g, ''), 10) || 0) : 0); }
        return 0;
    }
    function smgActLabel(el, text) {   // garante rótulo de texto no botão movido (share/save são só ícone)
        if (el.querySelector('.smg-pc-act-lbl')) return;
        const s = document.createElement('span'); s.className = 'smg-pc-act-lbl'; s.textContent = i18n(text);
        el.appendChild(s);
    }
    // popover ⋯ : UM listener de document p/ TODOS os cards (antes era 1 por post/comentário —
    // centenas acumulados no scroll infinito, cada clique na página rodava N contains()).
    // Só um popover fica aberto por vez → fechar é O(1) via referência.
    let openMoreWrap = null, moreCloseBound = false;
    function smgToggleMore(wrap) {
        if (openMoreWrap && openMoreWrap !== wrap) { openMoreWrap.classList.remove('open'); openMoreWrap = null; }
        const on = wrap.classList.toggle('open');
        openMoreWrap = on ? wrap : null;
        if (!moreCloseBound) {
            moreCloseBound = true;
            document.addEventListener('click', e => {
                if (openMoreWrap && !openMoreWrap.contains(e.target)) { openMoreWrap.classList.remove('open'); openMoreWrap = null; }
            });
        }
    }
    function buildPostCard(post) {
        post.dataset.smgCard = '1';   // marca ANTES do guard (REGRA DE OURO): post deletado/placeholder sem marca era re-varrido em todo full-scan
        const inner = post.querySelector(':scope > .message-inner');
        const main = inner && inner.querySelector(':scope > .message-cell--main');
        if (!inner || !main) return;   // não é um post padrão (deletado/placeholder) → deixa nativo
        post.classList.add('smg-pc');
        const messageMain = main.querySelector('.message-main') || main;
        const userCell = inner.querySelector(':scope > .message-cell--user');
        const attribution = messageMain.querySelector('.message-attribution');
        const footerBar = messageMain.querySelector('.message-actionBar');

        // ---------- HEADER ----------
        const head = document.createElement('div'); head.className = 'smg-pc-head';
        const avatar = userCell && userCell.querySelector('.message-avatar a.avatar, .message-avatar .avatar');
        if (avatar) { avatar.classList.add('smg-pc-avatar'); head.appendChild(avatar); }
        const meta = document.createElement('div'); meta.className = 'smg-pc-meta';
        const row1 = document.createElement('div'); row1.className = 'smg-pc-row1';
        const idline = document.createElement('div'); idline.className = 'smg-pc-idline';
        const name = userCell && userCell.querySelector('.message-name');
        if (name) { name.classList.add('smg-pc-name'); idline.appendChild(name); }
        const timeEl = attribution && attribution.querySelector('time');
        if (timeEl) {
            const ts = +(timeEl.getAttribute('data-timestamp') || 0);
            const dot = document.createElement('span'); dot.className = 'smg-pc-dot'; dot.textContent = '·';
            const t = document.createElement('span'); t.className = 'smg-pc-time';
            t.textContent = ts ? smgRelTime(ts) : (timeEl.textContent || '').trim();
            t.title = timeEl.getAttribute('title') || (timeEl.textContent || '').trim();
            idline.append(dot, t);
        }
        // DISCUSSÃO (social): badge "DISCUSSION" + indicador "silent" (vivem no attribution) → entram na idline após o tempo
        const discBadge = attribution && attribution.querySelector('.smg-discussion-badge');
        if (discBadge) idline.appendChild(discBadge);
        const silent = attribution && attribution.querySelector('.smg-silent-indicator');
        if (silent) idline.appendChild(silent);
        row1.appendChild(idline);
        let postNum = null;
        if (attribution) attribution.querySelectorAll('a').forEach(a => { if (!postNum && /^D?#\d/.test((a.textContent || '').trim())) postNum = a; });   // #398 (post) ou D#1 (discussão, .smg-discussion-number)
        if (postNum) { postNum.classList.add('smg-pc-num'); row1.appendChild(postNum); }
        meta.appendChild(row1);
        const row2 = document.createElement('div'); row2.className = 'smg-pc-row2';
        const title = userCell && userCell.querySelector('.userTitle');
        if (title) { title.classList.add('smg-pc-utitle'); row2.appendChild(title); }
        if (userCell) userCell.querySelectorAll('.userBanner').forEach(b => row2.appendChild(b));
        const badges = userCell && userCell.querySelector('.featuredBadges');
        if (badges) row2.appendChild(badges);
        if (row2.childNodes.length) meta.appendChild(row2);
        // 3ª linha (stats do usuário: cadastro · mensagens · pontos) removida a pedido — não anexa o .message-userExtras
        head.appendChild(meta);
        messageMain.insertBefore(head, messageMain.firstChild);

        // ---------- ACTION BAR ----------
        const bar = document.createElement('div'); bar.className = 'smg-pc-actions';
        const react = footerBar && footerBar.querySelector('.actionBar-action--reaction');
        if (react) {
            react.classList.add('smg-pc-act', 'smg-pc-act--react');
            // CONTADOR: ícone limpo (thumbs-up) + "N reações". O visual nativo (sprite/<i>/emoji/"React" = a "asa" torta) fica escondido via CSS.
            const ic = document.createElement('span'); ic.className = 'smg-pc-react-ic'; ic.innerHTML = svgIcon(SMG_ICO.thumb);
            const lbl = document.createElement('span'); lbl.className = 'smg-pc-react-n'; lbl.textContent = smgReactionLabel(smgPostReactionCount(post));
            react.insertBefore(lbl, react.firstChild); react.insertBefore(ic, react.firstChild);
            bar.appendChild(react);
        }
        const comment = footerBar && footerBar.querySelector('.uw_fcs_post_comment');   // social = comentário; simp não tem
        const reply = footerBar && footerBar.querySelector('.actionBar-action--reply');
        const commentBtn = comment || reply;   // sem comentário (simp) → Responder vira o "Comentar". Já tem TEXTO nativo (Comment/Responder/Reply) → NÃO adiciona rótulo (senão duplica: "Responder Reply")
        if (commentBtn) { commentBtn.classList.add('smg-pc-act', 'smg-pc-act--comment'); bar.appendChild(commentBtn); }
        const save = attribution && attribution.querySelector('a.bookmarkLink');
        if (save) { save.classList.add('smg-pc-act', 'smg-pc-act--save'); smgActLabel(save, 'Save'); bar.appendChild(save); }
        const translate = footerBar && footerBar.querySelector('.smgTranslator-btn');
        if (translate) { translate.classList.add('smg-pc-act', 'smg-pc-act--translate'); bar.appendChild(translate); }
        const share = attribution && attribution.querySelector('a.message-attribution-gadget[data-xf-init="share-tooltip"]');   // Share = ÚLTIMO (depois do translate)
        if (share) { share.classList.add('smg-pc-act', 'smg-pc-act--share'); smgActLabel(share, 'Share'); bar.appendChild(share); }
        // ⋯ overflow: multiquote · (reply, se Comentar veio do comentário) · denunciar
        const moreItems = [];
        const mq = footerBar && footerBar.querySelector('.js-multiQuote'); if (mq) moreItems.push(mq);
        if (comment && reply) moreItems.push(reply);
        const report = footerBar && footerBar.querySelector('.actionBar-action--report'); if (report) moreItems.push(report);
        if (moreItems.length) {
            const moreWrap = document.createElement('div'); moreWrap.className = 'smg-pc-morewrap';
            const moreBtn = document.createElement('button'); moreBtn.type = 'button'; moreBtn.className = 'smg-pc-act smg-pc-act--more'; moreBtn.setAttribute('aria-label', i18n('More')); moreBtn.textContent = '⋯';
            const pop = document.createElement('div'); pop.className = 'smg-pc-morepop';
            moreItems.forEach(el => { el.classList.add('smg-pc-morerow'); pop.appendChild(el); });
            moreBtn.addEventListener('click', e => { e.stopPropagation(); smgToggleMore(moreWrap); });
            moreWrap.append(moreBtn, pop); bar.appendChild(moreWrap);
        }
        const content = messageMain.querySelector('.message-content');
        if (content) content.insertAdjacentElement('afterend', bar); else messageMain.appendChild(bar);
    }
    function buildPostCards(roots) {
        if (!document.documentElement.classList.contains('smg-thread')) return;   // só em thread (onde há posts)
        eachIn(roots, 'article.message:not([data-smg-card])', buildPostCard);
    }

    // COMENTÁRIOS (uw_fcs, só no SMG): mesmo modelo do post — header compacto (avatar · user · tempo · #N),
    // body, action bar leve (react · responder · ⋯ citar/denunciar/traduzir/share). Indentação (thread-line) via CSS.
    // MOVE os nativos (preserva AJAX); reusa o popover ⋯ do post (smg-pc-more*). 1×/comentário via data-smg-cc.
    function buildCommentCard(comment) {
        comment.dataset.smgCc = '1';   // marca ANTES do guard (REGRA DE OURO)
        const cinner = comment.querySelector(':scope > .comment-inner');
        if (!cinner) return;
        comment.classList.add('smg-cc');
        const cmain = cinner.querySelector(':scope > .comment-main');
        const cwrap = cmain && cmain.querySelector('.comment-contentWrapper');
        const footerBar = comment.querySelector('.comment-footer .comment-actionBar');

        const head = document.createElement('div'); head.className = 'smg-cc-head';
        const avatar = cinner.querySelector(':scope > .comment-avatar a.avatar, :scope > .comment-avatar .avatar');
        if (avatar) { avatar.classList.add('smg-cc-avatar'); head.appendChild(avatar); }
        const idline = document.createElement('div'); idline.className = 'smg-cc-idline';
        const userLink = cwrap && cwrap.querySelector('a.comment-user');
        if (userLink) { userLink.classList.add('smg-cc-name'); idline.appendChild(userLink); }
        const timeEl = cwrap && cwrap.querySelector('time');
        if (timeEl) {
            const ts = +(timeEl.getAttribute('data-timestamp') || 0);
            const dot = document.createElement('span'); dot.className = 'smg-pc-dot'; dot.textContent = '·';
            const t = document.createElement('span'); t.className = 'smg-cc-time';
            t.textContent = ts ? smgRelTime(ts) : (timeEl.textContent || '').trim();
            t.title = timeEl.getAttribute('title') || '';
            idline.append(dot, t);
        }
        let numA = null;
        const opp = cwrap && cwrap.querySelector('.message-attribution-opposite');
        if (opp) opp.querySelectorAll('a').forEach(a => { if (!numA && /#[\d.]/.test((a.textContent || '').trim())) numA = a; });
        if (numA) { numA.classList.add('smg-cc-num'); idline.appendChild(numA); }
        head.appendChild(idline);
        cinner.insertBefore(head, cinner.firstChild);

        const bar = document.createElement('div'); bar.className = 'smg-cc-actions';
        const react = footerBar && footerBar.querySelector('.actionBar-action--reaction');
        if (react) {
            react.classList.add('smg-cc-act', 'smg-cc-act--react');
            let n = 0; comment.querySelectorAll('.comment-reactions .smgReactionPill-count').forEach(c => n += parseInt(c.textContent, 10) || 0);
            const ic = document.createElement('span'); ic.className = 'smg-cc-react-ic'; ic.innerHTML = svgIcon(SMG_ICO.thumb);
            const lbl = document.createElement('span'); lbl.className = 'smg-cc-react-n'; lbl.textContent = smgReactionLabel(n);
            react.insertBefore(lbl, react.firstChild); react.insertBefore(ic, react.firstChild);
            bar.appendChild(react);
        }
        const cReply = footerBar && footerBar.querySelector('.uw_cq_btn');   // "Comment" = responder AO comentário (já tem texto nativo)
        if (cReply) { cReply.classList.add('smg-cc-act', 'smg-cc-act--comment'); bar.appendChild(cReply); }
        // ⋯ : compartilhar · citar · denunciar · traduzir
        const moreItems = [];
        const cShare = cwrap && cwrap.querySelector('.uw_fcs_comment_share'); if (cShare) moreItems.push(cShare);
        [footerBar && footerBar.querySelector('.actionBar-action--reply'), footerBar && footerBar.querySelector('.actionBar-action--report'), footerBar && footerBar.querySelector('.smgTranslator-btn')].forEach(el => { if (el) moreItems.push(el); });
        if (moreItems.length) {
            const mw = document.createElement('div'); mw.className = 'smg-pc-morewrap';
            const mb = document.createElement('button'); mb.type = 'button'; mb.className = 'smg-cc-act smg-cc-act--more'; mb.setAttribute('aria-label', i18n('More')); mb.textContent = '⋯';
            const pop = document.createElement('div'); pop.className = 'smg-pc-morepop';
            moreItems.forEach(el => { el.classList.add('smg-pc-morerow'); pop.appendChild(el); });
            mb.addEventListener('click', e => { e.stopPropagation(); smgToggleMore(mw); });
            mw.append(mb, pop); bar.appendChild(mw);
        }
        const body = comment.querySelector('.comment-body');
        if (body) body.insertAdjacentElement('afterend', bar); else (comment.querySelector('.js-quickEditTargetComment') || cinner).appendChild(bar);
    }
    function buildCommentCards(roots) {
        if (!document.documentElement.classList.contains('smg-thread')) return;
        eachIn(roots, '.message-responses .comment:not([data-smg-cc])', buildCommentCard);
    }
    // header da seção de comentários (SMG/uw_fcs): label "Sort:" antes do chip + "Previous comments" → "Load more"
    function buildCommentBar(roots) {
        if (!document.documentElement.classList.contains('smg-thread')) return;
        eachIn(roots, '.uw-comment-count .uw-fcs-sort-toggle:not([data-smg-sortlbl])', t => {
            t.dataset.smgSortlbl = '1';
            const lbl = document.createElement('span'); lbl.className = 'smg-cbar-sortlbl'; lbl.textContent = i18n('Sort:');
            t.insertBefore(lbl, t.firstChild);
        });
        eachIn(roots, '.uw_load_prev:not([data-smg-lm])', a => { a.dataset.smgLm = '1'; a.textContent = i18n('Load more'); });   // re-aparece após cada load → pass por-elemento
    }

    // (THREAD header restyle removido — era dead code, nunca chamado; buildFilterBars cobre pager/ordenar/ações nos 2 sites)

    // carrega um popup de lista do XF (alertas/mensagens) e devolve o nó da lista;
    // _xfResponseType=json → só o conteúdo já preenchido · _xfToken → evita "Security error"
    function fetchXfList(fetchUrl) {
        const csrf = document.documentElement.getAttribute('data-csrf')
            || (document.querySelector('input[name="_xfToken"]') || {}).value || '';
        const url = fetchUrl + (fetchUrl.indexOf('?') >= 0 ? '&' : '?') + '_xfResponseType=json'
            + (csrf ? '&_xfToken=' + encodeURIComponent(csrf) : '');
        return fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            .then(r => r.text())
            .then(t => {
                let html = t;
                try { const j = JSON.parse(t); html = (j.html && (j.html.content || j.html)) || j.content || t; } catch (e) {}
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                return tmp.querySelector('.listPlain') || tmp.querySelector('.js-alertsMenuBody') || tmp.querySelector('.js-convMenuBody') || tmp;
            });
    }
