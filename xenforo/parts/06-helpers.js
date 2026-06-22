    // =========================================================
    // HELPERS: text / url
    // =========================================================

    function getBigUrl(url) {
        // imgbox NÃO segue a convenção .md/.th: thumb = thumbs2.imgbox.com/.../HASH_t.jpg,
        // original = images2.imgbox.com/.../HASH_o.jpg (o `_b` é um CROP quadrado, não serve). Sobe pro original.
        if (/\bimgbox\.com\//i.test(url) && /_t\.(?:jpe?g|png|gif|webp)(?:$|[?#])/i.test(url))
            return url.replace(/\/\/thumbs(\d*)\.imgbox\.com\//i, '//images$1.imgbox.com/').replace(/_t(\.(?:jpe?g|png|gif|webp))(?=$|[?#])/i, '_o$1');
        // pixhost: thumb = t{N}.pixhost.to/thumbs/{gal}/{file}  →  full = img{N}.pixhost.to/images/{gal}/{file}
        if (/\/\/t\d*\.pixhost\.to\/thumbs\//i.test(url))
            return url.replace(/\/\/t(\d*)\.pixhost\.to\/thumbs\//i, '//img$1.pixhost.to/images/');
        return url.replace('.md.', '.').replace('.th.', '.');
    }
    function isImgboxThumb(url) { return /\bimgbox\.com\//i.test(url) && /_t\.(?:jpe?g|png|gif|webp)(?:$|[?#])/i.test(url); }

    // inverso do getBigUrl: insere `.md.` antes da extensão → tier MÉDIO dos hosts que seguem a convenção
    // (imgbox/pixhost/…). Usado nos previews da galeria (tile = médio, perf; o feed abre o full no clique).
    // URL sem extensão de imagem reconhecida (ou que já é .md./.th.) volta intacta → quem usa cai no full por fallback.
    function getMedUrl(url) {
        if (!url || /\.(?:md|th)\./i.test(url)) return url;
        return url.replace(/(\.(?:jpe?g|png|gif|webp|avif|bmp))(\?|#|$)/i, '.md$1$2');
    }

    function cleanText(text) {
        return text.replace('.md', '').replace('.th', '');
    }

    // =========================================================
    // HELPERS: dom
    // =========================================================

    // estado de "seguindo" SEM depender de idioma: a label atual === data-sk-unwatch ⇒ seguindo
    // (o XF alterna o texto do botão entre data-sk-watch e data-sk-unwatch; comparamos com o attr)
    function smgIsWatching(w) {
        if (!w) return false;
        const label = ((w.querySelector('.button-text') || w).textContent || '').trim().toLowerCase();
        const un = (w.getAttribute('data-sk-unwatch') || '').trim().toLowerCase();
        return !!un && label === un;
    }

    function waitForElement(selector, timeout = 5000) {
        return new Promise(resolve => {
            const existing = document.querySelector(selector);

            if (existing) {
                resolve(existing);
                return;
            }

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);

                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    // GET same-origin → parseia a resposta HTML num Document. `opts` passam direto pro fetch:
    // alguns callers OMITEM X-Requested-With de propósito (querem a página inteira, não o parcial
    // AJAX do XF); outros mandam (querem o parcial). O .text()→parse é que era repetido em toda parte.
    function fetchDoc(url, opts) {
        return fetch(url, opts)
            .then(r => r.text())
            .then(html => new DOMParser().parseFromString(html, 'text/html'));
    }

    // monta um <form> POST oculto com os campos [nome, valor] e submete (navega p/ o resultado).
    // usado pela busca e pelo filtro da listagem — ambos POSTam pro endpoint nativo do XenForo.
    function postForm(action, fields) {
        const f = document.createElement('form');
        f.method = 'post';
        f.action = action;
        f.style.display = 'none';
        fields.forEach(([n, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); });
        document.body.appendChild(f);
        f.submit();
    }

    // href "seguro": neutraliza esquemas perigosos (javascript:/data:/vbscript:) vindos de href lidos
    // da página, deixando passar http(s)/relativo/âncora. Defesa contra href poisoned (servidor comprometido/XSS armazenado).
    function safeHref(url) {
        return /^\s*(javascript|data|vbscript):/i.test(url || '') ? '#' : (url || '#');
    }

    // roda fn em cada elemento que casa `selector` DENTRO dos roots dados (incluindo cada root, se ele
    // mesmo casar). No boot roots=[body] → varre o doc todo; numa mutação roots = subtrees recém-adicionados,
    // então os passes de conteúdo escapam do querySelectorAll no documento inteiro a cada frame.
    // fn DEVE ser idempotente (marca o nó) → dedup garantido mesmo se um nó casar por 2 roots.
    function eachIn(roots, selector, fn) {
        for (const root of roots) {
            if (!root || root.nodeType !== 1) continue;
            if (root.matches(selector)) fn(root);
            root.querySelectorAll(selector).forEach(fn);
        }
    }

    // listener de scroll throttled por requestAnimationFrame (no máx 1 fn por frame; passive).
    // o flag de "já agendado" fica encapsulado aqui (era repetido na dock/topbar/scroll infinito).
    function onScrollRaf(fn) {
        let tick = false;
        window.addEventListener('scroll', () => {
            if (tick) return;
            tick = true;
            requestAnimationFrame(() => { tick = false; fn(); });
        }, { passive: true });
    }

    // =========================================================
    // HELPERS: ui builders
    // =========================================================

    // base dos botões da dock: <button> ou <a> com o MESMO visual (id · classe · tamanho · ícone · tooltip).
    function makeDockEl(tag, { id, icon, label = '', fontSize = 20 }) {
        const el = document.createElement(tag);
        el.id = id;
        if (tag === 'button') el.type = 'button';
        el.className = 'smg-nav-btn';
        el.style.setProperty('--smg-btn-fs', fontSize + 'px');

        // icon-only: label vira tooltip (data-label) + aria-label
        if (label) {
            label = i18n(label);
            el.dataset.label = label;
            el.setAttribute('aria-label', label);
        }

        const ico = document.createElement('span');
        ico.className = 'smg-nav-ico';
        ico.innerHTML = icon;
        el.appendChild(ico);

        return el;
    }
    function makeDockButton(opts) { return makeDockEl('button', opts); }
    // botão que é link de navegação (mesmo visual da dock, mas <a>)
    function makeDockLink(opts) { const a = makeDockEl('a', opts); a.href = opts.href; return a; }

    function setBtnIcon(btn, icon) {
        const ico = btn.querySelector('.smg-nav-ico');
        if (ico) ico.innerHTML = icon;
    }

    // atualiza o tooltip/aria (label não é mais visível)
    function setBtnLabel(btn, label) {
        label = i18n(label);
        btn.dataset.label = label;
        btn.setAttribute('aria-label', label);
    }

    function makeDivider() {
        const divider = document.createElement('div');
        divider.className = 'smg-nav-divider';
        return divider;
    }

    function makeGroup(...buttons) {
        const group = document.createElement('div');
        group.className = 'smg-nav-group';
        buttons.filter(Boolean).forEach(btn => group.appendChild(btn));
        return group;
    }

    // arrastar pra baixo fecha (bottom sheets / modais mobile). Engata SÓ no topo (~64px = grip/header) → não
    // conflita com o scroll do conteúdo. isActive() opcional gate (ex.: só quando o sheet está aberto + mobile).
    function addSwipeClose(panel, closeFn, isActive) {
        if (!panel || typeof closeFn !== 'function') return;
        let y0 = 0, dy = 0, drag = false;
        panel.addEventListener('touchstart', e => {
            drag = false;
            if (e.touches.length !== 1) return;
            if (isActive && !isActive()) return;
            const r = panel.getBoundingClientRect();
            if (e.touches[0].clientY - r.top > 64) return;   // toque fora da zona do grip/header → deixa o scroll rolar
            drag = true; y0 = e.touches[0].clientY; dy = 0;
            panel.style.transition = 'none';
        }, { passive: true });
        panel.addEventListener('touchmove', e => {
            if (!drag) return;
            dy = e.touches[0].clientY - y0;
            if (dy > 0) panel.style.transform = 'translateY(' + dy + 'px)';
        }, { passive: true });
        panel.addEventListener('touchend', () => {
            if (!drag) return;
            drag = false;
            panel.style.transition = '';
            panel.style.transform = '';
            if (dy > 90) closeFn();   // passou do limiar → fecha (a transição do CSS leva pro translateY(100%))
        });
    }

    // =========================================================
    // HELPERS: paginação + estado compartilhado entre features
    // =========================================================

    // template de URL + página atual/total (dock goto, scroll infinito da thread e do feed).
    // A página atual vem da URL (/page-N) — confiável; o input do page-jump costuma vir
    // vazio/errado no document-end, o que bagunçava a dock e o ponto de partida do scroll.
    // Retorna null em thread de página única.
    function readPageJump() {
        const row = document.querySelector('[data-xf-init="page-jump"][data-page-url]');
        let tpl = row ? row.getAttribute('data-page-url') : null; // .../page-%page%
        if (!tpl) {
            // tema sem o menu page-jump: deriva o template de um link de paginação
            const href = Array.from(document.querySelectorAll('.pageNav a[href], .pageNavSimple a[href]'))
                .map(a => a.getAttribute('href') || '')
                .find(h => /\/page-\d+/.test(h));
            if (href) tpl = href.replace(/\/page-\d+/, '/page-%page%');
        }
        if (!tpl) return null; // página única

        const um = location.pathname.match(/\/page-(\d+)/);
        let cur = um ? parseInt(um[1], 10) : 1;

        // total: a maior página vista (links de paginação + "X of Y" + atributo max do input)
        let max = cur;
        document.querySelectorAll('.pageNav a[href], .pageNavSimple a[href]').forEach(a => {
            const m = (a.getAttribute('href') || '').match(/\/page-(\d+)/);
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        const simple = document.querySelector('.pageNavSimple-el--current')?.textContent.match(/(\d+)\s*of\s*(\d+)/i);
        if (simple) max = Math.max(max, parseInt(simple[2], 10) || 0);
        const im = parseInt(row?.querySelector('input[type="number"]')?.getAttribute('max') || '', 10);
        if (im) max = Math.max(max, im);

        return { tpl, cur: cur || 1, max: max || 1 };
    }

    // IntersectionObserver "once": ao entrar na viewport (rootMargin/threshold em opts), des-observa o
    // alvo e roda onEnter(alvo) UMA vez. Centraliza o padrão repetido (thumb/full/turbo/galeria/redgifs-load).
    // Retorna null se o browser não tiver IO → o caller cai no fallback de carregar na hora.
    function makeLazyIO(onEnter, opts) {
        if (!('IntersectionObserver' in window)) return null;
        return new IntersectionObserver((entries, obs) => {
            entries.forEach(en => { if (en.isIntersecting) { obs.unobserve(en.target); onEnter(en.target); } });
        }, opts || {});
    }
