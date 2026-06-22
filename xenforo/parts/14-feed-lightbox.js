    // =========================================================
    // FEATURE: modo feed (tiktok) — mídia da thread em tela cheia, snap vertical
    //
    // Mapa interno:
    //   coleta ....... feedEmbedUrl · collectMediaFrom (acha imgs/vídeos/embeds num root)
    //   galeria ...... gal* (galPageUrl/Observe/Tile/Fetch/RenderPage/JumpTo/…) + openGallery/closeGallery
    //   visualizador . openMediaFeed() ← GRANDE: slides, zoom, nav (nextVisible/goTo/advance),
    //                  buildSlide, loadNextPage, mute/filtro, downloadCurrent
    // =========================================================

    // autoplay + mudo nos players suportados (param na URL; o iframe já tem allow="autoplay")
    function feedEmbedUrl(url, muted) {
        try {
            const u = new URL(url);
            const q = new URLSearchParams(u.search);
            if (/redgifs/i.test(u.hostname)) { q.set('autoplay', '1'); q.set('muted', muted ? '1' : '0'); }
            else if (/turbo\.cr/i.test(u.hostname)) { q.set('autoplay', '1'); }      // mute: sem param conhecido
            else if (/imagepond\.net/i.test(u.hostname)) { q.set('autoplay', '1'); } // mute: sem param conhecido
            else if (/youtube|youtu\.be/i.test(u.hostname)) { q.set('autoplay', '1'); q.set('mute', muted ? '1' : '0'); }
            else return url;
            u.search = q.toString();
            return u.toString();
        } catch { return url; }
    }

    // normaliza turbo/saint p/ a URL de embed do TURBO (saint redireciona pro turbo; o Referer da API /sign tem que ser turbo.cr).
    function resolveUrlFor(url) {
        const m = (url || '').match(/(?:turbo\.cr|saint2?\.(?:su|cr))\/embed\/([a-zA-Z0-9_-]+)/i);
        return m ? 'https://turbo.cr/embed/' + m[1] : url;
    }

    // extrai mídia (imagens + embeds) de um documento/elemento — vale na página viva e em páginas buscadas
    function collectMediaFrom(root) {
        const items = [];
        const local = new Set();
        const add = (type, url) => { if (url && !local.has(url)) { local.add(url); items.push({ type, url }); } };

        root.querySelectorAll('img.bbImage, video.smg-rg-v, iframe.saint-iframe, iframe[src*="imagepond.net"], span[data-s9e-mediaembed] iframe, span[data-s9e-mediaembed-iframe], .generic2wide-iframe-div iframe, .generic2wide-iframe-div[onclick*="redgifs"], .bbCodeBlock--unfurl[data-url], a[href*="turbo.cr/"]:not(.smg-turbo-fallback), a[href*="saint.su/"]:not(.smg-turbo-fallback), a[href*="saint2.su/"]:not(.smg-turbo-fallback), a[href*="saint.cr/"]:not(.smg-turbo-fallback), a[href*="saint2.cr/"]:not(.smg-turbo-fallback)').forEach(el => {
            // FORMA CRUA (a galeria re-busca a página do servidor, SEM nosso processamento):
            if (el.matches('span[data-s9e-mediaembed-iframe]')) {   // redgifs = <span data-s9e-mediaembed-iframe='[...,"src","https:\/\/…/ifr/ID"]'> (sem <iframe> nem .generic2wide)
                let arr; try { arr = JSON.parse(el.getAttribute('data-s9e-mediaembed-iframe') || '[]'); } catch (e) { return; }
                const si = arr.indexOf('src'); const src = si >= 0 ? arr[si + 1] : '';
                if (/redgifs\.com\/ifr\/|turbo\.cr\/embed\/|saint2?\.(?:su|cr)/i.test(src)) add('embed', src);
                return;
            }
            if (el.matches('.bbCodeBlock--unfurl[data-url]')) {   // turbo/saint = card unfurl com data-url REAL (o <a> é um /goto base64). bunkr/pixeldrain caem aqui e são IGNORADOS (regex só turbo/saint).
                const u = el.getAttribute('data-url') || '';
                const t = u.match(/turbo\.cr\/embed\/([a-zA-Z0-9_-]+)/i);
                if (t) { add('embed', 'https://turbo.cr/embed/' + t[1]); return; }
                const s = u.match(/(saint2?\.(?:su|cr))\/(?:embed\/)?([a-zA-Z0-9_-]+)/i);
                if (s) add('embed', 'https://' + s[1] + '/embed/' + s[2]);
                return;
            }
            if (el.tagName === 'IMG') {
                add('image', imageUrlOf(el));
            } else if (el.tagName === 'VIDEO') {   // nosso player já montado: redgifs pelo id; turbo (Simp nativo) pelo _rgFeed
                if (el.dataset.rgid) add('embed', 'https://www.redgifs.com/ifr/' + el.dataset.rgid);
                else if (el._rgFeed) add('embed', el._rgFeed);
            } else if (el.tagName === 'IFRAME') {
                add('embed', absUrl(el.getAttribute('src') || ''));
            } else if (el.tagName === 'A') {   // link cru de turbo/saint (ex.: páginas buscadas pela galeria, onde o iframe ainda não foi montado)
                const href = el.getAttribute('href') || '';
                if (/turbo\.cr\/a\//i.test(href)) return;   // turbo.cr/a/ = álbum (galeria), não vídeo único → não embeda
                const t = href.match(/turbo\.cr\/(?:[^/?#]+\/)*([a-zA-Z0-9_-]+)/i);
                if (t) { add('embed', 'https://turbo.cr/embed/' + t[1]); return; }
                const s = href.match(/(saint2?\.(?:su|cr))\/(?:[^/?#]+\/)*([a-zA-Z0-9_-]+)/i);
                if (s) add('embed', 'https://' + s[1] + '/embed/' + s[2]);
            } else { // div de redgifs ainda não carregado: pega o id do onclick
                if (el.querySelector('iframe')) return;
                const m = (el.getAttribute('onclick') || '').match(/redgifs\.com\/ifr\/([a-zA-Z0-9_-]+)/i);
                if (m) add('embed', 'https://www.redgifs.com/ifr/' + m[1]);
            }
        });
        return items;
    }

    // AVISO ÚNICO (1ª vez que abre galeria/feed pela dock/header): esses modos têm navegação PRÓPRIA —
    // começam na página 1 da thread e paginam toda a mídia, separados de onde você está lendo.
    // Salva a flag no GM/localStorage → nunca mais reaparece.
    function showNavModeNotice() {
        if (gmGet('smg-navmode-notice', '0') === '1') return;
        if (document.getElementById('smg-navnotice')) return;
        const ov = document.createElement('div');
        ov.id = 'smg-navnotice';
        ov.innerHTML =
            '<div class="smg-navnotice-card">' +
                '<div class="smg-navnotice-title">' + i18n('Gallery and Feed') + '</div>' +
                '<div class="smg-navnotice-text">' + i18n('Gallery and Feed browse the whole thread with their own pagination — they start at page 1 and page through all the media, independently of where you are reading. Use their own pager and sort.') + '</div>' +
                '<button type="button" class="smg-navnotice-ok">' + i18n('Got it') + '</button>' +
            '</div>';
        document.body.appendChild(ov);
        const close = () => { gmSet('smg-navmode-notice', '1'); ov.remove(); };
        ov.querySelector('.smg-navnotice-ok').addEventListener('click', close);
        ov.addEventListener('click', e => { if (e.target === ov) close(); });   // clicar no scrim também fecha
    }

    // GALERIA: overlay (igual o feed) com a mídia da thread numa grade masonry + SCROLL INFINITO próprio
    // (puxa as próximas páginas da thread) + header com "ir ao topo" e ordenar (data/reações).
    // Clicar num tile abre o feed naquele item (por cima). Reusa collectMediaFrom + openMediaFeed.
    let galState = null;
    let galDockSortBtn = null, galDockGotoBtn = null;   // botões da dock da galeria (criados 1x) — re-sincronizados a cada abertura
    // sort = UM botão toggle, IGUAL ao btnSort da thread: o ícone alterna data⇄reações conforme galState.order
    function galSyncSortBtn() {
        if (!galDockSortBtn || !galState) return;
        const isDate = galState.order === 'date';
        setBtnIcon(galDockSortBtn, isDate ? ICONS.sortDate : ICONS.star);
        setBtnLabel(galDockSortBtn, isDate ? 'Sort by date' : 'Sort by reactions');
        const t = galDockSortBtn.querySelector('.smg-nav-btn-text');   // texto visível: deixa claro PELO QUÊ está ordenado
        if (t) t.textContent = i18n(isDate ? 'Date' : 'Reactions');
    }
    // PERSISTÊNCIA do modo na URL (query param) → F5 reabre galeria/feed em vez de cair na thread.
    // replaceState (não polui o histórico). Params: view=gallery|feed · order=date|reaction (sort da galeria).
    // SEM página: a galeria sempre reabre na página 1 (restaurar página quebrava a paginação no F5).
    function smgSetNavParam(view, order) {
        try {
            const u = new URL(location.href);
            if (view) {
                u.searchParams.set('view', view);
                if (order) u.searchParams.set('order', order); else u.searchParams.delete('order');
            } else {
                u.searchParams.delete('view'); u.searchParams.delete('order');
            }
            history.replaceState(history.state, '', u.toString());
        } catch (e) {}
    }
    // no boot (e em cada pass até a thread montar): se a URL pede um modo, reabre. Roda 1x só.
    let smgNavRestored = false;
    function restoreNavMode() {
        if (smgNavRestored || !document.documentElement.classList.contains('smg-thread')) return;
        smgNavRestored = true;
        const p = new URLSearchParams(location.search);
        const v = p.get('view');
        if (v === 'gallery') openGallery(p.get('order'));
        else if (v === 'feed') openMediaFeed(null, null, { fromStart: true });
    }
    function galPageUrl(n, order) {
        let b = location.pathname.replace(/\/page-\d+/, '').replace(/\/(unread|latest)$/, '');
        if (!b.endsWith('/')) b += '/';
        return b + (n > 1 ? 'page-' + n : '') + (order === 'reaction' ? '?order=reaction_score' : '');
    }
    let galIO = null;
    function galObserve(tile) {   // carrega o preview do tile (iframe c/ poster) só quando entra na viewport
        if (!galIO) galIO = makeLazyIO(el => { if (el._galLoad) el._galLoad(); }, { rootMargin: '600px 0px' });
        if (galIO) galIO.observe(tile); else if (tile._galLoad) tile._galLoad();   // sem IO no browser → carrega na hora
    }
    function galTile(it, page) {
        const tile = document.createElement('div');
        tile.className = 'smg-gallery-tile smg-gallery-tile--' + it.type;
        tile.dataset.page = page;
        if (it.type === 'image') {
            tile.classList.add('is-loading');   // shimmer até a imagem pintar (some no load/erro)
            const img = document.createElement('img');
            img.loading = 'lazy'; img.alt = '';
            const full = it.url, med = getMedUrl(full);   // TILE = médio (perf); o feed abre o FULL no clique (alta)
            const done = () => tile.classList.remove('is-loading');
            img.addEventListener('load', done);
            img.addEventListener('error', () => { if (med !== full && img.src !== full) img.src = full; else done(); });   // médio 404 → tenta o full; full falhou → tira o shimmer
            img.src = med;
            if (img.complete && img.naturalWidth) done();   // já em cache → sem shimmer preso
            tile.appendChild(img);
            tile.addEventListener('click', () => openMediaFeed(full, galState && galState.items));
        } else {
            // vídeo: placeholder → carrega o player (preview/poster) ao entrar na viewport · toca inline · botão maximizar abre no feed
            tile.innerHTML = '<span class="smg-gallery-play">' + svgIcon('<polygon points="6 3 20 12 6 21 6 3"/>') + '</span>';
            const maxBtn = document.createElement('button');
            maxBtn.type = 'button'; maxBtn.className = 'smg-gallery-max';
            maxBtn.title = i18n('Expand'); maxBtn.setAttribute('aria-label', i18n('Expand'));
            maxBtn.innerHTML = svgIcon('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>');
            maxBtn.addEventListener('click', e => { e.stopPropagation(); openMediaFeed(it.url, galState && galState.items); });
            tile.appendChild(maxBtn);
            tile._galLoad = () => {
                if (tile.dataset.loaded) return;
                tile.dataset.loaded = '1';
                const ph = tile.querySelector('.smg-gallery-play'); if (ph) ph.remove();
                const toIframe = () => { if (!tile.isConnected || tile.querySelector('.smg-rg, iframe')) return; tile.insertBefore(buildTurboIframe(it.url), maxBtn); };
                // tile ganha o aspect REAL do vídeo (vertical = tile alto, não esmagado em 16:9)
                const fitTile = video => video.addEventListener('loadedmetadata', () => { if (video.videoWidth && video.videoHeight) tile.style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight; }, { once: true });
                const rid = (FEATURES.redgifsPlayer && GMX) ? rgIdFrom(it.url) : null;
                if (rid) {   // redgifs → NOSSO player (autoplay-off, igual ao inline)
                    const { wrap, video } = rgBuild(rid);
                    tile.insertBefore(wrap, maxBtn);
                    fitTile(video);
                    rgStart(video, true);
                } else if (GMX && FEATURES.turboNativePlayer && /turbo\.cr|saint2?\.(?:su|cr)/i.test(it.url)) {   // turbo/saint → resolve mp4 → NOSSO player; falha → iframe
                    turboResolve(resolveUrlFor(it.url), mp4 => {
                        if (!tile.isConnected || tile.querySelector('.smg-rg, iframe')) return;
                        if (!mp4) { toIframe(); return; }
                        const { wrap, video } = buildNativeVideo(mp4, 'https://turbo.cr/', toIframe, /saint/i.test(it.url) ? 'Saint' : 'Turbo');
                        video._rgExt = it.url; video._rgFeed = it.url;
                        tile.insertBefore(wrap, maxBtn);
                        fitTile(video);   // fallback: aspect REAL no metadata (dispara no play)
                        // POSTER-ONLY (igual ao inline): zero bytes de vídeo até o play. rgStartUrl streamava
                        // metadata de CADA tile que cruzava o IO — rolar 200 tiles enfileirava 200 loads que
                        // nunca eram liberados (turbo não solta o src). O aspect do tile vem do poster.
                        const poster = turboPoster(mp4);
                        if (poster) { const pi = new Image(); pi.onload = () => { if (pi.naturalWidth && tile.isConnected) tile.style.aspectRatio = pi.naturalWidth + ' / ' + pi.naturalHeight; }; pi.src = poster; }
                        rgPrepareUrl(video, mp4, wrap, poster);
                    });
                } else {   // imagepond/youtube/etc → iframe (não temos player nativo)
                    toIframe();
                }
            };
            galObserve(tile);
        }
        return tile;
    }
    // tiles-fantasma (shimmer) com alturas variadas — reservam espaço enquanto a página carrega
    const GAL_SKEL_H = [115, 70, 145, 95, 62, 128, 88, 108, 78];
    function galSkelTile(i) {
        const t = document.createElement('div');
        t.className = 'smg-gallery-skel';
        t.style.paddingTop = GAL_SKEL_H[i % GAL_SKEL_H.length] + '%';   // altura via padding-% (relativo à largura da coluna)
        return t;
    }
    function galMakeSection(n, skel) {
        const sec = document.createElement('div');
        sec.className = 'smg-gallery-page' + (skel ? ' is-skel' : '');
        sec.dataset.page = n;
        sec.innerHTML = '<div class="smg-gallery-pagehdr"><span>' + i18n('Page') + ' ' + n + '</span></div>';   // separador "Page N" — rola junto (NÃO é sticky)
        const cols = document.createElement('div');
        cols.className = 'smg-gallery-cols';
        sec.appendChild(cols);
        return sec;
    }
    // muta o scroller mantendo `keep` visualmente fixo (corrige scrollTop pela variação de altura acima dele) → sem "pulo"
    function galKeepStable(keep, mutate) {
        const sc = galState.scroller;
        if (!keep || !keep.isConnected) { mutate(); return; }
        const before = keep.getBoundingClientRect().top;
        mutate();
        sc.scrollTop += keep.getBoundingClientRect().top - before;
    }
    // retorna true se ADICIONOU mídia nova (o galFetch usa isso: página vazia → pula direto pra próxima)
    function galRenderPage(doc, n, where, sec) {
        if (!galState || !sec || !sec.isConnected) return false;   // jump/close cancelou esta busca
        const fresh = collectMediaFrom(doc).filter(it => !galState.seen.has(it.url));
        fresh.forEach(it => galState.seen.add(it.url));
        if (!fresh.length) {   // página sem mídia nova → tira o skeleton (preservando a posição)
            galKeepStable(where === 'prepend' ? sec.nextElementSibling : null, () => sec.remove());
            if (!galState.scroller.querySelector('.smg-gallery-page'))
                galState.scroller.innerHTML = '<div class="smg-gallery-empty">' + i18n('No media on this page') + '</div>';
            return false;
        }
        const cols = sec.querySelector('.smg-gallery-cols');
        const frag = document.createDocumentFragment();
        fresh.forEach(it => frag.appendChild(galTile(it, n)));
        // troca skeleton → real sem "pulo": no append ancora no topo da própria seção (preenche p/ baixo);
        // no prepend a seção está ACIMA da viewport → ancora no que vem ABAIXO dela (o que se está lendo)
        const keep = where === 'prepend' ? sec.nextElementSibling : sec;
        galKeepStable(keep, () => { cols.innerHTML = ''; cols.appendChild(frag); sec.classList.remove('is-skel'); });
        galState.items = where === 'prepend' ? fresh.concat(galState.items) : galState.items.concat(fresh);
        return true;
    }
    // carrega a PRÓXIMA página enquanto o paginador disser que tem (hasMore). Encadeado no .then do galFetch →
    // percorre TODAS as páginas da thread automaticamente (páginas vazias no meio são atravessadas). Sem piso por
    // itens nem por altura (heurísticas que travavam): a fonte de verdade é o "Next" do paginador.
    function galEnsureFilledDown() {
        if (!galState || galState.loading || !galState.hasMore || galState.hi >= 300) return;   // 300 = backstop anti-runaway
        galFetch(galState.hi + 1, 'append');
    }
    // ainda não há ~3 telas de conteúdo abaixo do ponto de leitura → vale pré-buscar a próxima página
    function galNeedMoreBelow() {
        const sc = galState && galState.scroller;
        return !!sc && (sc.scrollHeight - sc.scrollTop - sc.clientHeight) < sc.clientHeight * 3;
    }
    // tem próxima página? segue o link "Next" do paginador (IGUAL ao infinite scroll da thread) — presente em
    // toda página menos a última. É a fonte de verdade pra "pode buscar mais": NÃO depende de parsear o total
    // (que vinha errado e travava). Funciona em /page-N, ?page=N, etc.
    function galHasNext(doc) {
        return !!doc.querySelector('.pageNav-jump--next, .pageNavSimple-el--next');
    }
    // total de páginas (SÓ pro display do goto "of N pages") — duas fontes; não trava mais o fetch.
    function galMaxFromDoc(doc) {
        let max = 0;
        doc.querySelectorAll('.pageNav a[href], .pageNavSimple a[href]').forEach(a => {
            const m = (a.getAttribute('href') || '').match(/\/page-(\d+)/);
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        const cur = doc.querySelector('.pageNavSimple-el--current');
        const sm = cur && cur.textContent.match(/(\d+)\D+(\d+)/);   // "1 of 30" / "1 de 30" / "1 / 30" → pega o 2º nº
        if (sm) max = Math.max(max, parseInt(sm[2], 10) || 0);
        const inp = doc.querySelector('[data-xf-init="page-jump"] input[type="number"]');
        const im = inp && parseInt(inp.getAttribute('max') || '', 10);
        if (im) max = Math.max(max, im);
        return max;
    }
    function galFetch(n, where) {
        if (!galState || galState.loading || n < 1) return;   // sem teto por max: quem decide "tem mais" é o paginador (hasMore)
        galState.loading = true;
        const gen = galState.gen;
        const sc = galState.scroller;
        const empty = sc.querySelector('.smg-gallery-empty'); if (empty) empty.remove();
        // skeleton imediato, na MESMA posição da seção real → reserva espaço + dá feedback durante o fetch
        const sec = galMakeSection(n, true);
        const cols = sec.querySelector('.smg-gallery-cols');
        for (let i = 0; i < 9; i++) cols.appendChild(galSkelTile(i));
        if (where === 'prepend') { galKeepStable(sc.firstElementChild, () => sc.insertBefore(sec, sc.firstChild)); galState.lo = n; }
        else { sc.appendChild(sec); galState.hi = Math.max(galState.hi, n); }
        galUpdatePager();
        fetchDoc(galPageUrl(n, galState.order), { credentials: 'same-origin' })   // SEM X-Requested-With: garante a página COMPLETA (com paginador), igual ao infinite scroll
            .then(doc => {
                if (!galState || galState.gen !== gen) return;   // jump/close no meio do caminho
                galState.hasMore = galHasNext(doc);   // FONTE DE VERDADE: o paginador desta página tem "Next"?
                // max é só pro display do goto: o maior entre paginação do doc, DOM vivo e a página atual descoberta.
                galState.max = Math.max(galState.max, galMaxFromDoc(doc) || 0, (readPageJump() || {}).max || 0, galState.hi + (galState.hasMore ? 1 : 0));
                const added = galRenderPage(doc, n, where, sec);   // renderiza (ou remove a seção se a página não tiver mídia nova)
                galState.loading = false;
                galUpdatePager();
                // append → encadeia a PRÓXIMA: SEMPRE através de página vazia (não adiciona altura, o scroll
                // não retomaria), e com mídia só enquanto faltar ~3 telas abaixo — o handler de scroll (<900px)
                // retoma sob demanda. Antes encadeava INCONDICIONAL: abrir a galeria baixava+parseava a thread
                // INTEIRA (até 300 fetches sequenciais, centenas de MB), com o usuário parado na página 1.
                if (where === 'append' && (!added || galNeedMoreBelow())) galEnsureFilledDown();
            })
            .catch(() => {
                if (!galState || galState.gen !== gen) return;
                galState.loading = false;
                if (sec.isConnected) galKeepStable(where === 'prepend' ? sec.nextElementSibling : null, () => sec.remove());
                if (where === 'prepend') galState.lo = n + 1; else if (galState.hi === n) galState.hi = n - 1;   // libera p/ tentar de novo no próximo scroll
            });
    }
    function galJumpTo(n) {
        if (!galState) return;
        n = Math.max(1, Math.min(galState.max, n));
        if (galIO) galIO.disconnect();   // larga os tiles de vídeo observados (evita refs presas a nós removidos)
        galState.gen++; galState.seen = new Set(); galState.items = []; galState.loading = false; galState.hasMore = true;
        galState.scroller.innerHTML = ''; galState.scroller.scrollTop = 0;
        galState.lo = n; galState.hi = n - 1;   // hi = n-1 → galFetch(n,'append') seta hi=n
        galFetch(n, 'append');
    }
    function galUpdatePager() {
        if (!galState) return;
        // página real = a última seção cujo cabeçalho está no topo (ou acima) da viewport
        const ref = galState.scroller.getBoundingClientRect().top + 56;
        let page = galState.lo;
        // seções em ordem no DOM (top crescente) → a 1ª cujo top passa de ref fixa a página: corta cedo
        // em vez de medir as seções abaixo da viewport a cada frame de scroll da galeria.
        const secs = galState.scroller.querySelectorAll('.smg-gallery-page');
        for (let i = 0; i < secs.length; i++) {
            if (secs[i].getBoundingClientRect().top <= ref) page = parseInt(secs[i].dataset.page, 10) || page;
            else break;
        }
        galState.viewPage = page;
        if (galDockGotoBtn) setBtnIcon(galDockGotoBtn, String(page));   // nº da página DENTRO do botão goto (igual à thread)
    }
    function galSetOrder(order) {
        if (!galState || galState.order === order) return;
        galState.order = order;
        galSyncSortBtn();   // troca o ícone/label do botão toggle (data⇄reações)
        smgSetNavParam('gallery', order);   // persiste a ordem na URL (F5 mantém)
        galJumpTo(1);   // nova ordem → volta pra página 1 e pro topo (não faz sentido manter a página atual numa ordem diferente)
    }
    function closeGallery() {
        const gal = document.getElementById('smg-gallery');
        if (gal) gal.classList.remove('open');
        smgSetNavParam(null);   // saiu pro thread → limpa a URL
        if (galIO) galIO.disconnect();   // solta os tiles de vídeo observados (sem isso, nós removidos ficam presos no IO)
        // esvazia a grade AGORA (reabrir reconstrói da pág. 1 de qualquer jeito): manter milhares de tiles +
        // <video> com src vivo num DOM display:none segurava dezenas/centenas de MB até a próxima abertura
        const grid = gal && gal.querySelector('.smg-gallery-grid');
        if (grid) { grid.querySelectorAll('video.smg-rg-v').forEach(rgDispose); grid.innerHTML = ''; }
        rgReleaseDetachedBlobs();
        galState = null;
        const feed = document.getElementById('smg-feed');
        if (!(feed && feed.classList.contains('open'))) document.documentElement.style.overflow = '';
    }
    function openGallery(order) {
        showNavModeNotice();   // aviso único: galeria/feed têm navegação própria (página 1, sort próprio)
        let gal = document.getElementById('smg-gallery');
        if (!gal) {
            gal = document.createElement('div');
            gal.id = 'smg-gallery';
            // SEM barra superior: a grade ocupa tudo. Controles numa DOCK flutuante embaixo, IDÊNTICA à da thread:
            // mesmos botões (makeDockButton/.smg-nav-btn), MESMO sort TOGGLE (data⇄reações no MESMO botão),
            // MESMA paginação (prev · goto-com-nº · next, ícones ICONS.pagePrev/pageNext) e MESMO stepper de "ir pra página".
            // + um botão Fechar à direita (label visível). Só a fiação muda: pagina/ordena a GALERIA, não a thread.
            gal.innerHTML = '<div class="smg-gallery-grid"></div>';
            const gdock = document.createElement('div'); gdock.className = 'smg-gallery-dock';
            const gpanel = document.createElement('div'); gpanel.className = 'smg-gallery-dock-panel';

            const gSort = makeDockButton({ id: 'smg-gal-sort', icon: ICONS.sortDate, label: 'Sort by date' });   // 1 botão toggle (= btnSort), pílula com texto do critério
            gSort.classList.add('smg-nav-labeled');
            gSort.appendChild(Object.assign(document.createElement('span'), { className: 'smg-nav-btn-text' }));
            const gPrev = makeDockButton({ id: 'smg-gal-prev', icon: ICONS.pagePrev, label: 'Prev page' });
            const gGoto = makeDockButton({ id: 'smg-gal-goto', icon: '1', label: 'Go to page' });                // mostra o nº da página (= btnGoto)
            const gNext = makeDockButton({ id: 'smg-gal-next', icon: ICONS.pageNext, label: 'Next page' });
            galDockSortBtn = gSort; galDockGotoBtn = gGoto;

            const gClose = makeDockButton({ id: 'smg-gal-close', icon: ICONS.close, label: 'Close' });
            gClose.classList.add('smg-gallery-close'); gClose.removeAttribute('data-label');   // label fica VISÍVEL (não tooltip)
            gClose.appendChild(Object.assign(document.createElement('span'), { className: 'smg-gallery-close-label', textContent: i18n('Close') }));

            const gnav = makeGroup(gSort, gPrev, gGoto, gNext);   // MESMO grupo único da thread (sort + pagenav juntos, 6px)
            gpanel.append(gnav, makeDivider(), gClose);

            // stepper "ir pra página" — MESMA estrutura/classes do #smg-goto-pop da thread (só o container é próprio)
            const gGotoPop = document.createElement('div');
            gGotoPop.className = 'smg-gallery-goto-pop';
            gGotoPop.innerHTML =
                '<span class="smg-goto-title">Go to page</span>' +
                '<div class="smg-goto-stepper">' +
                    '<button type="button" class="smg-goto-step" data-dir="-1" aria-label="Decrease">−</button>' +
                    '<input type="number" class="smg-goto-input" min="1" value="1">' +
                    '<button type="button" class="smg-goto-step" data-dir="1" aria-label="Increase">+</button>' +
                '</div>' +
                '<span class="smg-goto-max"></span>' +
                '<button type="button" class="smg-goto-btn">Go</button>';

            gdock.append(gpanel, gGotoPop);
            gal.appendChild(gdock);
            document.body.appendChild(gal);
            i18nDom(gal);

            // sort: alterna data⇄reações (galSetOrder recarrega na nova ordem; galSyncSortBtn troca o ícone)
            gSort.addEventListener('click', () => { if (galState) galSetOrder(galState.order === 'date' ? 'reaction' : 'date'); });
            // paginação: prev/next pulam 1 página
            gPrev.addEventListener('click', () => galJumpTo((galState ? (galState.viewPage || galState.lo) : 1) - 1));
            gNext.addEventListener('click', () => galJumpTo((galState ? (galState.viewPage || galState.lo) : 1) + 1));

            // goto stepper (idêntico ao da thread; pula via galJumpTo na própria galeria)
            const gIn = gGotoPop.querySelector('.smg-goto-input');
            const gMax = gGotoPop.querySelector('.smg-goto-max');
            const galClamp = n => { if (!n || n < 1) n = 1; const mx = galState ? galState.max : 1; if (mx && n > mx) n = mx; return n; };
            const galCloseGoto = () => gdock.classList.remove('goto-open');
            const galOpenGoto = () => {
                const mx = galState ? galState.max : 1;
                gIn.max = mx || '';
                gIn.value = galState ? (galState.viewPage || galState.lo) : 1;
                gMax.textContent = mx ? 'of ' + mx + ' pages' : '';
                gdock.classList.add('goto-open');
                setTimeout(() => { gIn.focus(); gIn.select(); }, 0);
            };
            const galDoGoto = () => { galJumpTo(galClamp(parseInt(gIn.value, 10))); galCloseGoto(); };
            gGoto.addEventListener('click', e => { e.stopPropagation(); if (gdock.classList.contains('goto-open')) galCloseGoto(); else galOpenGoto(); });
            gGotoPop.querySelectorAll('.smg-goto-step').forEach(b => b.addEventListener('click', () => { gIn.value = galClamp((parseInt(gIn.value, 10) || 1) + parseInt(b.dataset.dir, 10)); }));
            gIn.addEventListener('change', () => { gIn.value = galClamp(parseInt(gIn.value, 10)); });
            gGotoPop.querySelector('.smg-goto-btn').addEventListener('click', galDoGoto);
            gIn.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); galDoGoto(); }
                else if (e.key === 'Escape') { e.stopPropagation(); galCloseGoto(); }
            });
            document.addEventListener('click', e => {   // clique-fora fecha o goto
                if (!gdock.classList.contains('goto-open')) return;
                if (gGotoPop.contains(e.target) || gGoto.contains(e.target)) return;
                galCloseGoto();
            });

            gClose.addEventListener('click', closeGallery);
            document.addEventListener('keydown', e => {   // Esc: fecha o goto primeiro; senão a galeria (se o feed estiver POR CIMA, ele trata)
                if (e.key !== 'Escape' || !gal.classList.contains('open')) return;
                const fd = document.getElementById('smg-feed');
                if (fd && fd.classList.contains('open')) return;
                if (gdock.classList.contains('goto-open')) { galCloseGoto(); return; }
                closeGallery();
            });
            const sc = gal.querySelector('.smg-gallery-grid');
            let galRaf = 0;
            sc.addEventListener('scroll', () => {
                if (galRaf) return;
                galRaf = requestAnimationFrame(() => {
                    galRaf = 0;
                    if (!galState) return;
                    if (galState.hasMore && sc.scrollHeight - (sc.scrollTop + sc.clientHeight) < 900) galFetch(galState.hi + 1, 'append');   // desce → próxima (se houver)
                    if (sc.scrollTop < 500 && galState.lo > 1) galFetch(galState.lo - 1, 'prepend');                     // sobe → anterior
                    galUpdatePager();
                });
            }, { passive: true });
        }
        const scroller = gal.querySelector('.smg-gallery-grid');
        const head = gal.querySelector('.smg-gallery-dock-panel');
        scroller.innerHTML = '';   // o galFetch insere o skeleton na hora (sem flash de "sem mídia")
        const pj = readPageJump();
        order = (order === 'reaction') ? 'reaction' : 'date';   // sort PRÓPRIO ('date' default); restaurado do ?order= no F5
        const cur = 1;             // SEMPRE página 1 (restaurar a página quebrava a paginação no F5 → percorre tudo desde o começo)
        const max = pj ? pj.max : 1;   // galMaxFromDoc + readPageJump corrigem no 1º fetch
        galState = { scroller, head, seen: new Set(), items: [], loading: false, hasMore: true, order, lo: cur, hi: cur - 1, max, viewPage: cur, gen: 0 };
        galSyncSortBtn();          // a dock é criada 1x → sincroniza o toggle com a ordem (data/reações) a cada abertura
        if (galDockGotoBtn) setBtnIcon(galDockGotoBtn, String(cur));
        galFetch(cur, 'append');   // página 1; o scroll/ensure puxam as próximas (pra baixo)
        gal.classList.add('open');
        document.documentElement.style.overflow = 'hidden';
        smgSetNavParam('gallery', order);   // F5 reabre a galeria com a mesma ordem
    }

    // baixa a mídia de um slide do feed (imagem via GM_download c/ fallback de aba; embed = abre o player externo).
    // separado do controller porque só depende do elemento do slide.
    function downloadSlide(s) {
        if (!s) return;
        const img = s.querySelector('.smg-feed-media');
        const emb = s.querySelector('.smg-feed-embed');
        if (img) {
            const url = img.dataset.src || img.src;
            if (!url) return;
            const name = (url.split('/').pop() || 'image').split(/[?#]/)[0] || 'image';
            if (typeof GM_download === 'function') {
                try {
                    GM_download({ url, name, onerror: () => window.open(url, '_blank', 'noopener'), ontimeout: () => window.open(url, '_blank', 'noopener') });
                    return;
                } catch {}
            }
            window.open(url, '_blank', 'noopener');
        } else if (emb) {
            window.open(emb.dataset.src, '_blank', 'noopener'); // player externo: baixe de lá
        }
    }

    function openMediaFeed(startUrl, mediaList, opts) {
        opts = opts || {};
        // DOCK/HEADER → feed com navegação PRÓPRIA: começa da página 1 da thread (não de onde você está lendo).
        // Se não estamos na página 1, busca-a antes e reabre semeando com ela (paginando daí pra frente).
        if (opts.fromStart && !mediaList && !opts.seed) {
            smgSetNavParam('feed');   // F5 reabre o feed (dock/header). Feed por clique em imagem é transitório (não persiste).
            showNavModeNotice();
            const pj0 = readPageJump();
            if (pj0 && pj0.cur > 1) {
                fetchDoc(pj0.tpl.replace('%page%', '1'), { credentials: 'same-origin' })
                    .then(doc => openMediaFeed(null, null, { seed: collectMediaFrom(doc), startPage: 1 }))
                    .catch(() => openMediaFeed(null, null, { seed: collectMediaFrom(document), startPage: pj0.cur }));
                return;
            }
            opts.startPage = 1;   // já na página 1 (ou thread de página única) → segue normal
        }
        // shell criado uma vez; os listeners persistentes falam com feed._ctrl (setado a cada abertura)
        let feed = document.getElementById('smg-feed');
        if (!feed) {
            feed = document.createElement('div');
            feed.id = 'smg-feed';
            feed.innerHTML =
                '<button class="smg-feed-close" type="button" aria-label="Close">' + ICONS.close + '</button>' +
                '<div class="smg-feed-tools">' +
                    '<button class="smg-feed-tool smg-feed-filter" type="button" aria-label="Filter media">' + ICONS.layers + '</button>' +
                    '<button class="smg-feed-tool smg-feed-mute" type="button" aria-label="Sound">' + ICONS.volumeMute + '</button>' +
                    '<button class="smg-feed-tool smg-feed-download" type="button" aria-label="Download" title="Download">' + ICONS.download + '</button>' +
                '</div>' +
                '<button class="smg-feed-nav smg-feed-prev" type="button" aria-label="Previous">' + svgIcon('<path d="m18 15-6-6-6 6"/>') + '</button>' +
                '<button class="smg-feed-nav smg-feed-next" type="button" aria-label="Next">' + svgIcon('<path d="m6 9 6 6 6-6"/>') + '</button>' +
                '<div class="smg-feed-counter"></div>' +
                '<div class="smg-feed-track"><div class="smg-feed-reel"></div></div>' +
                '<button class="smg-feed-striparrow smg-feed-striparrow--prev" type="button" aria-label="Previous">' + svgIcon('<path d="m15 18-6-6 6-6"/>') + '</button>' +
                '<div class="smg-feed-strip"></div>' +
                '<button class="smg-feed-striparrow smg-feed-striparrow--next" type="button" aria-label="Next">' + svgIcon('<path d="m9 18 6-6-6-6"/>') + '</button>';
            document.body.appendChild(feed);
            i18nDom(feed);

            const trackEl = feed.querySelector('.smg-feed-track');

            const closeFeed = () => {
                feed.classList.remove('open');
                const galOpen = document.getElementById('smg-gallery') && document.getElementById('smg-gallery').classList.contains('open');
                if (!galOpen) document.documentElement.style.overflow = '';   // galeria por baixo (feed aberto via tile) continua fullscreen
                const reelEl = feed.querySelector('.smg-feed-reel');
                reelEl.querySelectorAll('video.smg-rg-v').forEach(rgDispose);   // teardown completo dos players antes do wipe
                reelEl.innerHTML = '';
                feed.querySelector('.smg-feed-strip').innerHTML = '';
                feed._ctrl = null;
                rgReleaseDetachedBlobs();   // os <video> do feed saíram do DOM → libera os objectURLs de blob agora
                smgSetNavParam(galOpen ? 'gallery' : null, galOpen && galState ? galState.order : null);   // volta o param pra gallery (se aberta) ou limpa
            };
            feed.querySelector('.smg-feed-close').addEventListener('click', closeFeed);
            feed.querySelector('.smg-feed-prev').addEventListener('click', () => feed._ctrl && feed._ctrl.step(-1));
            feed.querySelector('.smg-feed-next').addEventListener('click', () => feed._ctrl && feed._ctrl.step(1));
            feed.querySelector('.smg-feed-download').addEventListener('click', () => feed._ctrl && feed._ctrl.download());
            feed.querySelector('.smg-feed-mute').addEventListener('click', () => feed._ctrl && feed._ctrl.toggleMute());
            feed.querySelector('.smg-feed-filter').addEventListener('click', () => feed._ctrl && feed._ctrl.cycleFilter());

            // filmstrip (miniaturas) SEMPRE visível por padrão (toggle removido)
            feed.classList.add('strip-open');

            // setas < > de navegação do filmstrip: rolam a fita ~70% da largura; somem nas pontas
            const stripEl = feed.querySelector('.smg-feed-strip');
            const stripPrev = feed.querySelector('.smg-feed-striparrow--prev');
            const stripNext = feed.querySelector('.smg-feed-striparrow--next');
            const updateStripArrows = () => {
                const max = stripEl.scrollWidth - stripEl.clientWidth;
                stripPrev.classList.toggle('is-hidden', stripEl.scrollLeft <= 2);
                stripNext.classList.toggle('is-hidden', max <= 2 || stripEl.scrollLeft >= max - 2);
            };
            feed._updateStripArrows = updateStripArrows;   // o per-open chama após montar os thumbs (setActive)
            stripPrev.addEventListener('click', () => stripEl.scrollBy({ left: -stripEl.clientWidth * 0.7, behavior: 'smooth' }));
            stripNext.addEventListener('click', () => stripEl.scrollBy({ left: stripEl.clientWidth * 0.7, behavior: 'smooth' }));
            let stripRaf = 0;
            stripEl.addEventListener('scroll', () => { if (stripRaf) return; stripRaf = requestAnimationFrame(() => { stripRaf = 0; updateStripArrows(); }); }, { passive: true });

            // roda do mouse → 1 slide por vez, suave
            trackEl.addEventListener('wheel', e => {
                if (!feed._ctrl) return;
                e.preventDefault();
                if (Math.abs(e.deltaY) < 6) return;
                feed._ctrl.step(e.deltaY > 0 ? 1 : -1);
            }, { passive: false });

            document.addEventListener('keydown', e => {
                if (!feed.classList.contains('open')) return;
                if (e.key === 'Escape') closeFeed();
                else if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); feed._ctrl && feed._ctrl.step(1); }
                else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); feed._ctrl && feed._ctrl.step(-1); }
                else if (e.key === 'm') { feed._ctrl && feed._ctrl.toggleMute(); }
                else if (e.key === 'd') { feed._ctrl && feed._ctrl.download(); }
            });

            const setupFeedGestures = () => {
                // gestos touch: pinça (zoom em imagem) · arrasto p/ pan quando ampliada ·
                // swipe vertical p/ navegar · puxar pra baixo no topo fecha
                const dist2 = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
                let mode = null, dragStartY = 0, dragDy = 0, moved = false;
                let pinchStart = 0, pinchBase = 1, panSX = 0, panSY = 0, panBX = 0, panBY = 0;
                const applyZoom = (img, z) => { img.style.transform = 'translate(' + z.x + 'px,' + z.y + 'px) scale(' + z.scale + ')'; };

                trackEl.addEventListener('touchstart', e => {
                    if (!feed._ctrl) return;
                    const img = feed._ctrl.activeImg();
                    const z = img && (img._zoom || (img._zoom = { scale: 1, x: 0, y: 0 }));
                    if (img) img.style.transition = 'none';   // pinch/pan em tempo real (sem o ease do clique)
                    if (e.touches.length === 2 && img) {
                        mode = 'pinch';
                        pinchStart = dist2(e.touches);
                        pinchBase = z.scale;
                    } else if (e.touches.length === 1 && img && z.scale > 1) {
                        mode = 'pan';
                        panSX = e.touches[0].clientX; panSY = e.touches[0].clientY;
                        panBX = z.x; panBY = z.y;
                    } else if (e.touches.length === 1) {
                        mode = 'nav';
                        dragStartY = e.touches[0].clientY; dragDy = 0; moved = false;
                        feed._ctrl.reel.style.transition = 'none';
                    } else {
                        mode = null;
                    }
                }, { passive: true });

                trackEl.addEventListener('touchmove', e => {
                    if (!feed._ctrl || !mode) return;
                    const c = feed._ctrl;
                    if (mode === 'pinch') {
                        const img = c.activeImg();
                        if (!img || e.touches.length < 2) return;
                        const z = img._zoom;
                        z.scale = Math.max(1, Math.min(5, pinchBase * dist2(e.touches) / (pinchStart || 1)));
                        applyZoom(img, z);
                        e.preventDefault();
                    } else if (mode === 'pan') {
                        const img = c.activeImg();
                        if (!img) return;
                        const z = img._zoom;
                        z.x = panBX + (e.touches[0].clientX - panSX);
                        z.y = panBY + (e.touches[0].clientY - panSY);
                        applyZoom(img, z);
                        e.preventDefault();
                    } else { // nav
                        dragDy = e.touches[0].clientY - dragStartY;
                        if (Math.abs(dragDy) > 8) moved = true;
                        let dy = dragDy;
                        if ((c.cur() === 0 && dy > 0) || (c.cur() === c.len() - 1 && dy < 0)) dy *= 0.3; // resistência nas pontas
                        c.reel.style.transform = 'translateY(calc(' + (-c.cur() * 100) + 'vh + ' + dy + 'px))';
                        e.preventDefault();
                    }
                }, { passive: false });

                trackEl.addEventListener('touchend', e => {
                    if (!feed._ctrl) return;
                    const c = feed._ctrl;
                    if (mode === 'pinch' || mode === 'pan') {
                        const img = c.activeImg();
                        if (img && img._zoom && img._zoom.scale <= 1.02) { img._zoom = { scale: 1, x: 0, y: 0 }; img.style.transform = ''; }
                        if (e.touches.length === 0) mode = null;
                        return;
                    }
                    if (mode === 'nav') {
                        mode = null;
                        if (c.cur() === 0 && dragDy >= 110) { closeFeed(); return; } // puxar pra baixo no topo → fecha
                        if (dragDy <= -45) c.advance(1);
                        else if (dragDy >= 45) c.advance(-1);
                        else c.goTo(c.cur());
                    }
                });

                // GRAB (desktop): arrasta a imagem AMPLIADA pra deslizar. Limiar distingue drag de clique → não togla zoom no fim do arrasto.
                let grabbing = false, gMoved = false, gSX = 0, gSY = 0, gBX = 0, gBY = 0, suppressClick = false;
                trackEl.addEventListener('mousedown', e => {
                    if (e.button !== 0) return;
                    suppressClick = false;
                    if (!feed._ctrl) return;
                    const img = feed._ctrl.activeImg(), z = img && img._zoom;
                    if (!img || !z || z.scale <= 1.02) return;   // só desliza quando ampliada
                    grabbing = true; gMoved = false; gSX = e.clientX; gSY = e.clientY; gBX = z.x; gBY = z.y;
                    img.style.transition = 'none'; img.classList.add('smg-grabbing');
                    e.preventDefault();
                });
                window.addEventListener('mousemove', e => {
                    if (!grabbing || !feed._ctrl) return;
                    const img = feed._ctrl.activeImg(), z = img && img._zoom;
                    if (!img || !z) return;
                    const dx = e.clientX - gSX, dy = e.clientY - gSY;
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) gMoved = true;
                    z.x = gBX + dx; z.y = gBY + dy;
                    img.style.transform = 'translate(' + z.x + 'px,' + z.y + 'px) scale(' + z.scale + ')';
                });
                window.addEventListener('mouseup', () => {
                    if (!grabbing) return;
                    grabbing = false;
                    const img = feed._ctrl && feed._ctrl.activeImg();
                    if (img) img.classList.remove('smg-grabbing');
                    if (gMoved) suppressClick = true;   // arrastou → o click seguinte é ignorado (não togla zoom)
                });

                // tap/click: IMAGEM → cicla zoom no ponto clicado · VÍDEO → libera os controles do player
                trackEl.addEventListener('click', e => {
                    if (!feed._ctrl) return;
                    if (moved) { moved = false; return; }                   // foi swipe (touch)
                    if (suppressClick) { suppressClick = false; return; }   // foi grab (mouse)
                    if (!feed._ctrl.toggleZoom(e.clientX, e.clientY)) feed._ctrl.toggleLive();
                });
            };
            setupFeedGestures();
        }

        const reel = feed.querySelector('.smg-feed-reel');
        const counter = feed.querySelector('.smg-feed-counter');
        const prevBtn = feed.querySelector('.smg-feed-prev');
        const strip = feed.querySelector('.smg-feed-strip');
        const muteBtn = feed.querySelector('.smg-feed-mute');
        const filterBtn = feed.querySelector('.smg-feed-filter');

        reel.innerHTML = '';
        strip.innerHTML = '';
        reel.style.transition = 'none';
        reel.style.transform = 'translateY(0)';

        let muted = gmGet('smg-feed-muted', '1') === '1';
        let filterMode = 'all'; // all | image | embed
        const FILTERS = ['all', 'image', 'embed'];
        const FILTER_ICON = { all: ICONS.layers, image: ICONS.typeImage, embed: ICONS.playCircle };
        const FILTER_LABEL = { all: i18n('Filter: all'), image: i18n('Filter: images'), embed: i18n('Filter: videos') };
        setMuteIcon();
        setFilterIcon();

        const initial = mediaList || opts.seed || collectMediaFrom(document);   // galeria → lista própria · dock/header(fromStart) → página 1 buscada · maximizar → página atual
        if (!initial.length) {
            reel.innerHTML = '<div class="smg-feed-slide"><div class="smg-feed-empty">' + i18n('No media on this page') + '</div></div>';
            feed.classList.add('open');
            document.documentElement.style.overflow = 'hidden';
            feed._ctrl = null;
            return;
        }

        const seen = new Set();
        const slides = [];
        const thumbs = [];
        let startSlideIdx = -1;   // índice do startUrl, capturado no buildSlide
        let current = 0;
        let lastActive = -1;   // último slide ativado: setActive só mexe nele + no novo + vizinhos (não em todos os N)
        let animating = false;
        let navTimer;

        // paginação p/ scroll infinito (busca as próximas páginas da thread)
        const pj = readPageJump();
        let loadedPage = opts.startPage || (pj ? pj.cur : 1);   // dock/header(fromStart)=1 · maximizar=página atual
        const maxPage = pj ? pj.max : loadedPage;
        let loadingPage = false;
        const myGen = (feed._gen = (feed._gen || 0) + 1);   // geração desta abertura; loadNextPage abandona fetch de sessão antiga (close+reopen rápido)

        // ---- filtro de mídia (tudo / imagens / vídeos) ----
        const mtypeOf = idx => slides[idx] && slides[idx].dataset.mtype; // 'image' | 'embed'
        const isVisible = idx => filterMode === 'all' || mtypeOf(idx) === filterMode;
        function nextVisible(from, dir) {
            for (let i = from + dir; i >= 0 && i < slides.length; i += dir) if (isVisible(i)) return i;
            return -1;
        }
        function firstVisible() {
            for (let i = 0; i < slides.length; i++) if (isVisible(i)) return i;
            return -1;
        }
        function visibleCount() { let n = 0; for (let i = 0; i < slides.length; i++) if (isVisible(i)) n++; return n; }
        function visiblePos(idx) { let n = 0; for (let i = 0; i <= idx; i++) if (isVisible(i)) n++; return n; }

        // só o slide ativo tem o iframe (perf + autoplay/stop); imagens carregam ±1 slide.
        // toca SÓ os slides afetados — o anterior (limpa embed/is-live/zoom) + o novo + vizinhos do novo —
        // em vez de iterar os N slides a cada navegação. Invariante: só o slide ativo tem conteúdo no embed.
        function setActive(idx) {
            current = Math.max(0, Math.min(slides.length - 1, idx));
            const prev = lastActive;
            lastActive = current;
            [prev, current - 1, current, current + 1].forEach((j, k, arr) => {
                if (j < 0 || j >= slides.length || arr.indexOf(j) !== k) return;   // fora do range, ou índice repetido (já tratado)
                const s = slides[j];
                const emb = s.querySelector('.smg-feed-embed');
                const img = s.querySelector('.smg-feed-media');
                if (emb) {
                    emb.classList.remove('is-live'); // ao navegar, volta pro modo swipe
                    if (j === current && !emb.firstChild) {
                        const rid = (FEATURES.redgifsPlayer && GMX) ? rgIdFrom(emb.dataset.src) : null;
                        if (rid) {   // redgifs → player NOSSO (mp4 HD da API), não o iframe; fallback p/ iframe na falha (rgRestore via _rgFeedHost)
                            const { wrap, video } = rgBuild(rid);
                            wrap._rgFeedHost = emb;
                            video._rgSd = false;   // feed = HD
                            video._rgInFeed = true;   // feed = slide ativo TOCA (autoplay off vale só pro inline)
                            video.muted = muted;
                            emb.appendChild(wrap);
                            rgLoad(video);   // slide ativo → carrega e toca já (sem IO)
                        } else if (GMX && FEATURES.turboNativePlayer && /turbo\.cr|saint2?\.(?:su|cr)/i.test(emb.dataset.src)) {   // turbo/saint → NOSSO player (resolve mp4 async; fallback iframe na falha)
                            const src = emb.dataset.src;
                            const { wrap, video } = buildNativeVideo(src, 'https://turbo.cr/', null, /saint/i.test(src) ? 'Saint' : 'Turbo');
                            wrap._rgFeedHost = emb;
                            video._rgSd = false; video._rgInFeed = true; video.muted = muted;
                            video._rgExt = src; video._rgFeed = src;
                            const toIframe = () => { if (!wrap.isConnected) return; const host = wrap.parentElement; wrap.remove(); const f = document.createElement('iframe'); f.src = feedEmbedUrl(src, muted); f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen'; f.allowFullscreen = true; host.appendChild(f); };
                            wrap._rgFallback = toIframe;
                            emb.appendChild(wrap);   // monta SINCRONO (sem corrida no setActive)
                            turboResolve(resolveUrlFor(src), mp4 => {
                                if (!wrap.isConnected) return;   // navegou → emb foi limpo
                                if (!mp4) { toIframe(); return; }
                                rgLoadUrl(video, mp4, wrap);
                                const play = () => video.play().catch(() => {});
                                video.addEventListener('loadeddata', play, { once: true });
                                video.addEventListener('canplay', play, { once: true });
                            });
                        } else {
                            const f = document.createElement('iframe');
                            f.src = feedEmbedUrl(emb.dataset.src, muted);
                            f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
                            f.allowFullscreen = true;
                            emb.appendChild(f);
                        }
                    } else if (j !== current && emb.firstChild) {
                        emb.querySelectorAll('video.smg-rg-v').forEach(rgDispose);   // teardown (pausa/solta src/poster blob/IOs/Set) ANTES de descartar — senão cada slide visitado deixava um <video> zumbi retido a sessão toda
                        emb.innerHTML = '';
                    }
                }
                if (img) {
                    if (!img.src && Math.abs(j - current) <= 1) img.src = img.dataset.src;
                    if (j !== current && img._zoom) { img._zoom = { scale: 1, x: 0, y: 0 }; img.style.transform = ''; } // reseta zoom ao sair
                }
            });
            if (thumbs[prev]) thumbs[prev].classList.remove('active');
            if (thumbs[current]) thumbs[current].classList.add('active');
            revealActiveThumb();
            if (feed._updateStripArrows) feed._updateStripArrows();   // atualiza as setas < > do filmstrip
            const vc = visibleCount();
            counter.textContent = vc ? (visiblePos(current) + ' / ' + vc) : '0 / 0';
            prevBtn.style.visibility = nextVisible(current, -1) >= 0 ? '' : 'hidden';
            if (current >= slides.length - 3) loadNextPage();
        }

        function revealActiveThumb() {
            const t = thumbs[current];
            if (t && feed.classList.contains('strip-open')) t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        }

        function buildSlide(it) {
            if (seen.has(it.url)) return;
            seen.add(it.url);
            const idx = slides.length;
            if (startUrl && startSlideIdx < 0 && it.url === startUrl) startSlideIdx = idx;   // captura aqui → sem o findIndex+querySelector por slide depois (galeria pode semear MILHARES)

            const slide = document.createElement('div');
            slide.className = 'smg-feed-slide';
            slide.dataset.mtype = it.type; // 'image' | 'embed'

            const thumb = document.createElement('button');
            thumb.type = 'button';
            thumb.className = 'smg-feed-thumb';
            thumb.addEventListener('click', () => goTo(idx));

            if (it.type === 'image') {
                const img = document.createElement('img');
                img.className = 'smg-feed-media';
                img.dataset.src = it.url; // lazy: src setado no setActive
                slide.appendChild(img);

                const ti = document.createElement('img');
                ti.loading = 'lazy';
                ti.src = getMedUrl(it.url);   // tier MÉDIO num tile de 64px (igual galTile): full-res aqui baixava+decodificava MBs por thumb, no meio da transição de slide
                ti.addEventListener('error', () => { if (ti.src !== it.url) ti.src = it.url; }, { once: true });   // host sem .md. → full
                thumb.appendChild(ti);
            } else {
                const emb = document.createElement('div');
                emb.className = 'smg-feed-embed';
                emb.dataset.src = it.url;
                slide.appendChild(emb);

                const badge = document.createElement('span');
                badge.className = 'smg-feed-thumb-embed';
                badge.innerHTML = ICONS.typeVideo;
                thumb.appendChild(badge);
            }

            reel.appendChild(slide);
            slides.push(slide);
            strip.appendChild(thumb);
            thumbs.push(thumb);
            thumb.style.display = isVisible(idx) ? '' : 'none';
        }

        function loadNextPage() {
            if (mediaList || loadingPage || !pj || loadedPage >= maxPage) return;   // seedado pela galeria → não pagina sozinho
            loadingPage = true;
            const next = loadedPage + 1;
            fetchDoc(pj.tpl.replace('%page%', next), { credentials: 'same-origin' })
                .then(doc => {
                    if (feed._gen !== myGen) return;   // feed fechado/reaberto durante o fetch → essa sessão é obsoleta (closure velha)
                    if (!feed.classList.contains('open')) { loadingPage = false; return; }   // usuário fechou no meio → não monta slide órfão
                    collectMediaFrom(doc).forEach(buildSlide);
                    loadedPage = next;
                    loadingPage = false;
                })
                .catch(() => { loadingPage = false; });
        }

        function goTo(i) {
            current = Math.max(0, Math.min(slides.length - 1, i));
            reel.style.transition = 'transform .34s cubic-bezier(.22,.61,.36,1)';
            reel.style.transform = 'translateY(' + (-current * 100) + 'vh)';
            setActive(current);
        }

        // avança respeitando o filtro (usado por swipe/wheel/teclado)
        function advance(d) {
            const t = nextVisible(current, d);
            goTo(t < 0 ? current : t);
        }

        function step(d) {
            if (animating) return;
            const t = nextVisible(current, d);
            if (t < 0) return;
            animating = true;
            goTo(t);
            clearTimeout(navTimer);
            navTimer = setTimeout(() => { animating = false; }, 380);
        }

        function toggleLive() {
            const emb = slides[current] && slides[current].querySelector('.smg-feed-embed');
            if (emb) emb.classList.toggle('is-live');
        }

        function activeImg() {
            return slides[current] ? slides[current].querySelector('.smg-feed-media') : null;
        }

        // ZOOM por clique (desktop): 2 níveis (2× → 3.5×) e o 3º clique reseta. Sempre mira o ponto clicado (mantém-no
        // sob o cursor, mesmo subindo de nível). Reusa img._zoom (mesmo objeto do pinch). Retorna false se o slide NÃO
        // for imagem → o caller cai no toggleLive (vídeo).
        const ZOOM_STEPS = [2, 3.5];   // até 2 níveis
        function applyZoomTransform(img, z) { img.style.transform = 'translate(' + z.x + 'px,' + z.y + 'px) scale(' + z.scale + ')'; }
        function toggleZoom(clientX, clientY) {
            const img = activeImg();
            if (!img) return false;
            const z = img._zoom || (img._zoom = { scale: 1, x: 0, y: 0, level: 0 });
            if (z.level == null) z.level = z.scale > 1.02 ? 1 : 0;   // compat com estado vindo do pinch
            img.style.transition = 'transform .22s ease';            // suave no clique (o pinch/drag zera isso)
            z.level = (z.level + 1) % 3;                             // 0 → 1 → 2 → 0
            if (z.level === 0) {                                    // 3º clique → reseta
                img._zoom = { scale: 1, x: 0, y: 0, level: 0 };
                img.style.transform = '';
                img.classList.remove('smg-zoomed');
                return true;
            }
            const s = ZOOM_STEPS[z.level - 1];
            const r = img.getBoundingClientRect();                  // box JÁ transformado → mantém o ponto fixo mesmo ampliando de novo
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            z.x += (clientX - cx) * (1 - s / z.scale);
            z.y += (clientY - cy) * (1 - s / z.scale);
            z.scale = s;
            applyZoomTransform(img, z);
            img.classList.add('smg-zoomed');
            return true;
        }

        // ---- download da mídia em foco (lógica em downloadSlide, module-level) ----
        function downloadCurrent() { downloadSlide(slides[current]); }

        // ---- mudo (redgifs/youtube; turbo/imagepond não têm param conhecido) ----
        function setMuteIcon() {
            muteBtn.innerHTML = muted ? ICONS.volumeMute : ICONS.volume;
            muteBtn.title = muted ? i18n('Unmute') : i18n('Mute');
            muteBtn.classList.toggle('smg-active', !muted);
        }
        function toggleMute() {
            muted = !muted;
            gmSet('smg-feed-muted', muted ? '1' : '0');
            setMuteIcon();
            const emb = slides[current] && slides[current].querySelector('.smg-feed-embed');
            if (emb) { emb.innerHTML = ''; setActive(current); } // recarrega o player com o novo parâmetro
        }

        // ---- filtro de mídia ----
        function setFilterIcon() {
            filterBtn.innerHTML = FILTER_ICON[filterMode];
            filterBtn.title = FILTER_LABEL[filterMode];
            filterBtn.classList.toggle('smg-active', filterMode !== 'all');
        }
        function cycleFilter() {
            filterMode = FILTERS[(FILTERS.indexOf(filterMode) + 1) % FILTERS.length];
            setFilterIcon();
            thumbs.forEach((t, j) => t.style.display = isVisible(j) ? '' : 'none');
            if (!isVisible(current)) {
                const v = firstVisible();
                if (v >= 0) goTo(v);
                else { counter.textContent = '0 / 0'; } // nada nesse filtro
            } else {
                setActive(current);
            }
        }

        feed._ctrl = {
            cur: () => current, len: () => slides.length, reel,
            goTo, step, advance, toggleLive, toggleZoom, activeImg, revealActiveThumb,
            download: downloadCurrent, toggleMute, cycleFilter,
        };

        initial.forEach(buildSlide);

        // começa na imagem clicada (índice capturado durante o próprio build — ver buildSlide)
        const startIndex = startSlideIdx >= 0 ? startSlideIdx : 0;

        feed.classList.add('open');
        document.documentElement.style.overflow = 'hidden';
        current = startIndex;
        reel.style.transition = 'none';
        reel.style.transform = 'translateY(' + (-current * 100) + 'vh)';
        setActive(current);
    }
