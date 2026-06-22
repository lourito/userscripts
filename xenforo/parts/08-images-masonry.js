    // =========================================================
    // FEATURE: auto full images + portrait grid
    // =========================================================

    // 2 tiers de preload (anti-CLS no scroll rápido):
    //  · thumbIO (alcance GRANDE, 3000px): força a THUMB a carregar bem antes da viewport. Thumb é
    //    pequena/barata → fixa o tamanho da caixa cedo, então mesmo num fling a imagem já entra dimensionada.
    //  · fullIO (alcance médio, 1800px): troca pra full mais perto (qualidade). Como a thumb já carregou
    //    e tem a MESMA proporção, o swap não mexe no layout.
    let thumbIO = null, medIO = null;
    function getThumbIO() {   // tira a THUMB do lazy nativo (loading=eager) bem antes da viewport (3000px)
        return thumbIO || (thumbIO = makeLazyIO(el => { el.loading = 'eager'; }, { rootMargin: '3000px 0px' }));
    }
    function getMedIO() {     // troca pra MÉDIA (.md.) mais perto da tela (thumb já dá o tamanho → swap sem flash)
        return medIO || (medIO = makeLazyIO(img => {
            const med = img.dataset.smgMed;
            if (med && img.getAttribute('src') !== med) img.src = med;
        }, { rootMargin: '800px 0px' }));   // 800px: troca só perto (não compete com o redgifs)
    }

    // remove os <br> (+ whitespace) que separam DOIS chips de link adjacentes — post que é só lista de links (jpg6/jpg5 &
    // afins, sem img renderizável) ficava com um <br> entre cada → cascata de linhas vazias. Conservador: só colapsa o <br>
    // que tem um chip dos DOIS lados (não encosta em <br> que separa chip de TEXTO real). Cada chip limpa as próprias bordas →
    // a run inteira colapsa conforme os chips nascem (sync no unlazy, async no onerror): a borda comum é removida pelo chip mais tardio do par.
    function dropChipBreaks(chip) {
        if (!chip || !chip.parentNode) return;
        const isChip = n => n && n.nodeType === 1 && n.classList && n.classList.contains('smg-imglink-fallback');
        const skipWs = (n, dir) => { while (n && n.nodeType === 3 && !n.textContent.trim()) n = n[dir]; return n; };
        ['nextSibling', 'previousSibling'].forEach(dir => {
            for (;;) {
                const br = skipWs(chip[dir], dir);
                if (!(br && br.nodeType === 1 && br.tagName === 'BR')) break;
                if (!isChip(skipWs(br[dir], dir))) break;   // só remove <br> com chip dos dois lados
                let w = chip[dir];                          // do chip até o <br>: tira whitespace + o próprio <br>
                while (w && w !== br) { const nx = w[dir]; if (w.nodeType === 3 && !w.textContent.trim()) w.remove(); w = nx; }
                br.remove();
            }
        });
    }
    // se o href é um proxy do fórum (/goto/link-confirmation?url=.. ou /redirect/?to=..) → devolve o DESTINO real decodificado; senão devolve igual. decodeProxyHref vem do 21 (escopo compartilhado).
    function resolveProxyHref(h) { const r = decodeProxyHref(h || ''); return (r && /^https?:/i.test(r)) ? r : (h || ''); }
    // imagem que NÃO renderiza (host fora / hotlink / 404) → troca por um chip de link clicável (jpg6.su/jpg5 & afins)
    function imgFailLink(img) {
        if (!img || img.dataset.smgFailed || !img.parentNode) return;
        img.dataset.smgFailed = '1';
        const raw = img.dataset.smgLink || img.currentSrc || img.getAttribute('src') || '';
        if (!raw || /^data:/.test(raw)) { img.classList.add('smg-img-ready'); return; }   // sem destino útil → só tira o shimmer
        const href = resolveProxyHref(raw);   // mostra/abre a URL final, não o /goto/...&s=hash
        // se a img é o ÚNICO conteúdo do <a> wrapper (jpg6) → o próprio <a> vira o chip (evita <a> aninhado inválido e deixa o dropChipBreaks enxergar o chip); senão troca só a img
        const wrap = img.parentNode;
        let chip;
        if (wrap.tagName === 'A' && wrap.childElementCount === 1 && !(wrap.textContent || '').trim()) {
            wrap.innerHTML = ''; wrap.classList.add('link', 'link--external', 'smg-imglink-fallback');
            wrap.href = href; wrap.target = '_blank'; wrap.rel = 'noopener noreferrer'; wrap.textContent = href;
            chip = wrap;
        } else {
            chip = document.createElement('a');
            chip.href = href; chip.target = '_blank'; chip.rel = 'noopener noreferrer';
            chip.className = 'link link--external smg-imglink-fallback'; chip.textContent = href;
            img.replaceWith(chip);
        }
        dropChipBreaks(chip);
    }
    function processOneImage(img) {
        // guarda o link do host (jpg6.su/jpg5/…) ENQUANTO a img ainda está no <a> — ANTES do lazy-swap e da masonry mover (depois closest('a') falha) → fallback de link
        if (!img.dataset.smgLink) { const la = img.closest('a.link--external[href]'); if (la) img.dataset.smgLink = la.getAttribute('href') || ''; }
        const src = img.currentSrc || img.src || '';
        if (!/^https?:/i.test(src)) {                // placeholder lazy ainda sem URL real
            // tira da varredura por-mutação (data-smg-lazy-wait) e re-processa SÓ esta imagem quando o
            // lazy-loader setar o src (load/error). Antes ficava no loop, re-escaneada a cada mutação.
            // SEM timeout especulativo: espera o load nativo (loading=lazy), igual ao site padrão.
            if (!img.dataset.smgLazyWait) {
                img.dataset.smgLazyWait = '1';
                const reproc = () => { if (!img.dataset.smgLazyWait) return; delete img.dataset.smgLazyWait; processOneImage(img); };
                img.addEventListener('load', reproc, { once: true });
                img.addEventListener('error', reproc, { once: true });
            }
            return;
        }
        delete img.dataset.smgLazyWait;
        img.dataset.fullProcessed = 'true';          // EXAMINADA → fora das próximas varreduras
        img.decoding = 'async';                      // decode fora da thread principal (menos jank)
        img.classList.remove('lazyload', 'lazyloading');   // o FÓRUM faz .lazyload/.lazyloading{opacity:0} até revelar; a img já tem src http → tira senão fica invisível esperando o reveal
        // NADA de timeout-de-link: a img carrega nativa igual ao site padrão (que carrega de boa). Link de fallback SÓ em erro real (onerror) ou complete sem dimensão (404/hotlink) — abaixo. O timeout de 7s trocava imagem offscreen (naturalWidth 0 pq ainda não rolou até ela) por chip de link → "imagem não aparece" no nosso mod.

        // ao ganhar dimensão (thumb ou full), trava a proporção e tira o shimmer → caixa estável
        const onReady = () => {
            if (img.complete && !img.naturalWidth) { imgFailLink(img); return; }   // completou QUEBRADA (404/hotlink/host fora) → mostra o link no lugar
            if (img.naturalWidth && img.naturalHeight && !img.style.aspectRatio)
                img.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
            img.classList.add('smg-img-ready');
        };
        if (img.complete) onReady();                 // já resolvida (ok ou quebrada) → sem shimmer preso
        else {
            img.addEventListener('load', onReady, { once: true });
            img.addEventListener('error', () => imgFailLink(img), { once: true });   // não renderizou → link clicável (pedido do user)
        }

        // ANTI-PULO: NÃO troca a thumb pela full na hora. Mantém a thumb (carrega rápido e fixa
        // o tamanho) e só troca pra full perto da viewport (IO). Como a full tem a MESMA proporção,
        // subir/descer um thread enorme não reflui o layout — era o swap imediato + lazy que blankava
        // a imagem e fazia ela "estourar" de tamanho ao carregar.
        const imgbox = isImgboxThumb(src);   // imgbox: thumb `_t` → original `_o` (sem tier médio próprio → exibe o original no post)
        const big = getBigUrl(src);          // sobe pra FULL nos hosts conhecidos (.md/.th, imgbox, pixhost, …)
        const convMd = src.includes('.md.'), convTh = src.includes('.th.');
        // ANTES só entrava .md/.th/imgbox → hosts com padrão próprio de thumb (pixhost & cia) ficavam na BAIXA.
        // Agora qualquer host que o getBigUrl saiba subir (big !== src) também entra no upgrade.
        if (convMd || convTh || imgbox || big !== src) {
            const full = big;
            const med = convMd ? src : (convTh ? src.replace('.th.', '.md.') : full);   // tier MÉDIO só p/ convenção .md/.th; resto (pixhost/imgbox) exibe o FULL direto
            img.dataset.smgFull = full;
            img.dataset.smgMed = med;
            img.removeAttribute('srcset');
            const link = img.closest('a');
            if (link) link.href = full;              // maximizar (feed/lightbox) abre o FULL (alta)
            if (img.title) img.title = cleanText(img.title);
            if (img.alt) img.alt = cleanText(img.alt);
            const tio = getThumbIO(); if (tio) tio.observe(img);   // thumb carrega bem cedo → tamanho fixo antes de aparecer
            if (med !== src) {                       // src é .th. → sobe pra .md. perto da viewport; .md. já exibido FICA (nunca vai pro full no post)
                const mio = getMedIO();
                if (mio) mio.observe(img); else img.src = med;     // sem IO → troca direto (fallback)
            }
        }
    }
    function processImages(roots) {
        // o seletor exclui examinadas (data-full-processed) E placeholders sem src (data-smg-lazy-wait,
        // que voltam via seu próprio load). Scope: no boot roots=[body] (full), numa mutação só os subtrees novos.
        eachIn(roots, 'img.bbImage:not([data-full-processed]):not([data-smg-lazy-wait])', processOneImage);
    }

    // hosts de imagem estilo chevereto (jpg6.su / jpg5.su / jpg.church & afins): a página /img/{slug} "cozinha" a URL real
    // (data-src = base64 de hex, XOR com uma CHAVE ESTÁTICA branded — anti-scraper). Recuperei a chave por criptanálise
    // (2 amostras, crib "https://" + prefixo comum) → decode puro, sem depender de estado do browser. A imagem é do mesmo
    // CDN cuckcapital que os jpg6 EMBEDADOS já carregam, então um <img> normal exibe inline (sem 403 de hotlink).
    function cheveretoViewer(url) {
        let u; try { u = new URL(url); } catch (e) { return null; }
        if (!/^(?:jpg\d*\.\w{2,}|host\.church)$/i.test(u.hostname)) return null;   // jpg6.su / jpg.church / jpg5.fish / host.church …
        if (!/\/(?:img|image|i|a|album)\//i.test(u.pathname)) return null;          // só páginas de viewer/galeria (não imagem direta)
        return { host: u.hostname, gallery: /\/(?:a|album)\//i.test(u.pathname) };
    }
    const CHV_KEY = 'seltilovessimpcity@simpcityhatesscrapers';   // chave XOR estática (período 40) do "cooked" do chevereto
    function cheveretoDecode(b64) {
        let hex; try { hex = atob(b64); } catch (e) { return ''; }
        if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return '';
        let out = '';
        for (let i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ CHV_KEY.charCodeAt((i / 2) % CHV_KEY.length));
        return /^https?:\/\/\S+\.(?:jpe?g|png|webp|gif|avif)/i.test(out) ? out : '';
    }
    const chvCache = new Map();      // viewerUrl → directUrl|null (1× por sessão)
    const chvInflight = new Map();   // dedup de fetches simultâneos do mesmo viewer
    let chvActive = 0; const chvQueue = [];   // throttle (galeria de N links pelados não estoura a rede)
    function chvPump() { while (chvActive < 4 && chvQueue.length) { const fn = chvQueue.shift(); chvActive++; fn(() => { chvActive--; chvPump(); }); } }
    // busca a página de viewer (GMX, fura CORS), extrai o data-src cooked e decodifica → URL direta da imagem. cb(url|null).
    function cheveretoResolve(viewerUrl, cb) {
        if (chvCache.has(viewerUrl)) { cb(chvCache.get(viewerUrl)); return; }
        if (chvInflight.has(viewerUrl)) { chvInflight.get(viewerUrl).push(cb); return; }
        if (!GMX) { cb(null); return; }
        chvInflight.set(viewerUrl, [cb]);
        const done = url => { chvCache.set(viewerUrl, url || null); const cbs = chvInflight.get(viewerUrl) || []; chvInflight.delete(viewerUrl); cbs.forEach(f => { try { f(url || null); } catch (e) {} }); };
        chvQueue.push(release => {
            GMX({ method: 'GET', url: viewerUrl, timeout: 12000, headers: { Referer: location.origin + '/', Accept: 'text/html,*/*' },
                onload: r => { const t = r.responseText || ''; const m = t.match(/<img[^>]*\bcooked="true"[^>]*\bdata-src="([A-Za-z0-9+/=]+)"/i) || t.match(/\bdata-src="([A-Za-z0-9+/=]{40,})"/i); done(m ? cheveretoDecode(m[1]) : ''); release(); },
                onerror: () => { done(''); release(); }, ontimeout: () => { done(''); release(); } });
        });
        chvPump();
    }
    // link pelado de viewer → card (estado de loading) → resolve a imagem → troca por <img bbImage> (masonry/lightbox pegam).
    // Falha (rede/decode/host fora) → o card fica. Galeria (/a/): só card (resolver N imagens é outra fase).
    function cheveretoEmbed(linkEl, href, chv) {
        // fhCard recebe um OBJETO {label,href,sub,logo} — a chamada posicional antiga deixava o.label=undefined ("?")
        // e o.sub caía no String.prototype.sub ("function sub() { [native code] }").
        let card; try { card = fhCard({ label: chv.host, href: href, sub: i18n(chv.gallery ? 'Gallery' : 'Image'), logo: fhLogoChain({ key: 'chevereto' }, href, null) }); } catch (e) { return; }
        linkEl.replaceWith(card);
        if (chv.gallery) { cheveretoGallery(card, href, chv.host); return; }   // galeria → embeda TODAS as imagens (1 fetch por página)
        cheveretoResolve(href, url => {
            if (!url || !card.isConnected) return;   // falhou → fica o card
            const full = getBigUrl(url);   // a viewer do chevereto serve a versão .md (MÉDIA) → sobe pro ORIGINAL (resolução cheia)
            const img = document.createElement('img'); img.className = 'bbImage'; img.loading = 'lazy'; img.alt = ''; img.dataset.smgLink = href; img.dataset.smgFull = full;
            img.addEventListener('load', () => { if (typeof scheduleRun === 'function') scheduleRun(); }, { once: true });   // tem dimensões → masonry re-grida
            img.addEventListener('error', () => {}, { once: true });   // CDN fora → deixa o que estiver (card já foi removido; vira img quebrada rara)
            const link = document.createElement('a'); link.href = full; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.appendChild(img);
            card.replaceWith(link);
            img.src = full;
        });
    }
    // GALERIA chevereto (/a/ /album/): embeda TODAS as imagens. 1 fetch por PÁGINA (não por imagem) — extrai os thumbs
    // da listagem e sobe pro ORIGINAL com getBigUrl (os thumbs seguem a convenção .md). Teto de páginas + nº de imagens
    // p/ não martelar o host (≠ gofile: aqui é 1 request por página, throttle de 4, e sem token/anti-bot).
    const CHV_GAL_MAX_PAGES = 12, CHV_GAL_MAX_IMGS = 600;
    function chvImgUrlsFrom(doc, host) {
        const out = [];
        // itens da listagem chevereto: <a href=".../img/{slug}"><img src="...md.jpg" data-src="..."></a>
        doc.querySelectorAll('.list-item-image img, .image-container img, a[href*="/img/"] img, [class*="list-item"] img').forEach(im => {
            let s = im.getAttribute('data-src') || im.getAttribute('src') || '';
            if (!s) return;
            if (/^[A-Za-z0-9+/=]{40,}$/.test(s) && s.indexOf('/') === -1) s = cheveretoDecode(s);   // thumb "cooked" (base64) → decodifica
            try { s = new URL(s, 'https://' + host).href; } catch (e) { return; }
            if (!/\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i.test(s)) return;
            if (/avatar|\/logo|favicon|placeholder|\/cover|loading/i.test(s)) return;   // descarta UI
            out.push(getBigUrl(s));   // .md/.th → ORIGINAL
        });
        return out;
    }
    function chvNextPageHref(doc, curUrl) {
        const a = doc.querySelector('[data-pagination="next"], a[rel="next"], .pagination-next a, li.pagination-next a, a[href*="?page="][rel~="next"]');
        let h = a && a.getAttribute('href'); if (!h) return '';
        try { return new URL(h, curUrl).href; } catch (e) { return ''; }
    }
    function cheveretoGallery(card, href, host) {
        if (!GMX) return;   // sem GMX → fica o card
        const all = [], seen = new Set(); let pages = 0, finished = false;
        const finish = () => {
            if (finished) return; finished = true;
            if (!card.isConnected || !all.length) return;   // nada extraído → fica o card
            const frag = document.createDocumentFragment();
            all.forEach(u => {
                const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
                const img = document.createElement('img'); img.className = 'bbImage'; img.loading = 'lazy'; img.alt = ''; img.dataset.smgLink = href; img.dataset.smgFull = u;
                img.addEventListener('load', () => { if (typeof scheduleRun === 'function') scheduleRun(); }, { once: true });
                a.appendChild(img); img.src = u; frag.appendChild(a);
            });
            card.replaceWith(frag);
            if (typeof scheduleRun === 'function') scheduleRun();
        };
        const fetchPage = url => {
            chvQueue.push(release => {
                GMX({ method: 'GET', url: url, timeout: 15000, headers: { Referer: location.origin + '/', Accept: 'text/html,*/*' },
                    onload: r => {
                        let doc; try { doc = new DOMParser().parseFromString(r.responseText || '', 'text/html'); } catch (e) { release(); finish(); return; }
                        chvImgUrlsFrom(doc, host).forEach(u => { if (!seen.has(u) && all.length < CHV_GAL_MAX_IMGS) { seen.add(u); all.push(u); } });
                        pages++;
                        const next = chvNextPageHref(doc, url);
                        release();
                        if (next && pages < CHV_GAL_MAX_PAGES && all.length < CHV_GAL_MAX_IMGS) fetchPage(next);
                        else finish();
                    },
                    onerror: () => { release(); finish(); }, ontimeout: () => { release(); finish(); } });
            });
            chvPump();
        };
        fetchPage(href);
    }
    // LINKS de imagem (jpg6.su / jpg5 / jpg.church & afins): a img mora SÓ no <noscript> (inerte com JS) → o <a> fica
    // vazio e a limpeza de "espaço fantasma" o removia (sumia tudo). Materializa a img do noscript pro <a> (vira bbImage →
    // a masonry grida). Se a img falhar (host caiu/hotlink) OU não houver URL → mostra o LINK clicável no lugar.
    function unlazyImageLinks(roots) {
        eachIn(roots, 'a.link--external[href]:not([data-smg-imglink])', a => {
            a.dataset.smgImglink = '1';
            if (a.closest('.generic2wide-iframe-div, .smg-rg')) return;   // virou player (turbo/saint/imagepond) → não mexe
            // pula SÓ se já existe uma img REAL (fora de <noscript>). ⚠️ o querySelector('img') cru casava com a img INERTE
            // do <noscript> (no XF via AJAX o noscript vira DOM) e abortava → o <a> ficava vazio e a masonry o removia.
            if ([].some.call(a.querySelectorAll('img'), im => !im.closest('noscript'))) return;
            const href = resolveProxyHref(a.getAttribute('href') || '');   // chip/fallback mostra a URL final, não o /goto/ redirect
            // mostra o LINK como texto clicável DENTRO do próprio <a href> (usado quando não há img OU a img falha) → nunca fica vazio
            const showLink = () => { if (!a.isConnected) return; a.innerHTML = ''; a.classList.add('smg-imglink-fallback'); a.textContent = href || a.href; dropChipBreaks(a); };
            const linkChip = () => { const lk = document.createElement('a'); lk.href = href; lk.target = '_blank'; lk.rel = 'noopener noreferrer'; lk.className = 'link link--external smg-imglink-fallback'; lk.textContent = href; return lk; };
            // URL da img: do <noscript> — seja ele DOM (querySelector) ou texto cru (regex)
            const ns = a.querySelector('noscript');
            let url = '';
            if (ns) {
                const ni = ns.querySelector && ns.querySelector('img');
                if (ni) url = ni.getAttribute('data-url') || ni.getAttribute('data-src') || ni.getAttribute('src') || '';
                if (!url || /^data:/.test(url)) (ns.textContent || '').replace(/(?:data-url|data-src|src)\s*=\s*["']([^"']+)["']/gi, (m, u) => { if ((!url || /^data:/.test(url)) && !/^data:/.test(u)) url = u; return m; });
            }
            if (!url || /^data:/.test(url)) {   // sem URL extraível
                const chv = cheveretoViewer(href);   // jpg6.su & afins → resolve a imagem REAL (decode do cooked) e exibe inline; fallback = card
                if (chv) { cheveretoEmbed(a, href, chv); return; }
                showLink(); return;   // resto → link em texto
            }
            const img = document.createElement('img');
            img.className = 'bbImage'; img.src = url; img.loading = 'eager'; img.alt = '';   // EAGER: força resolver (lazy + sem aspect-ratio = célula vazia, e o onerror nunca dispara)
            img.dataset.smgLink = href;
            img.addEventListener('error', () => {
                if (a.isConnected) showLink();                          // img ainda no <a> → vira texto-link
                else if (img.parentNode) { const c = linkChip(); img.replaceWith(c); dropChipBreaks(c); }   // a masonry moveu pro grid → chip de link no lugar
            }, { once: true });
            a.innerHTML = '';   // limpa o noscript + whitespace
            a.appendChild(img);
        });
    }

    // GALERIA NO POST (html.smg-masonry-on): agrupa TODA a mídia do post — imagens E vídeos/embeds —
    // num .auto-image-grid (masonry por CSS). Roda DEPOIS dos passes de embed (turbo/saint/redgifs/direta)
    // pra os wrappers já existirem. Incremental: embed lazy que aparecer depois entra no grid já existente.
    function collectGalleryBlocks(scope) {
        const out = [];
        // imagens + TODOS os embeds: wrappers conhecidos (turbo/saint/redgifs/s9e/mídia direta) + iframe/video SOLTOS (imagepond, vídeo nativo, outros hosts)
        scope.querySelectorAll('img.bbImage, .generic2wide-iframe-div, .smg-dm-wrap, span[data-s9e-mediaembed], iframe[src*="imagepond.net"]').forEach(el => {   // só tipos conhecidos + imagepond (bare video/iframe puxava vídeo nativo preto/thumb quebrada)
            // NÃO excluir .bbCodeBlock geral: o turbo/saint do XF vive DENTRO de .bbCodeBlock--unfurl (card de link). Só pula citação/chips/assinatura.
            if (el.closest('.bbCodeQuote, .smg-post-links, .message-signature')) return;
            // img/iframe/video que JÁ está dentro de um wrapper coletado → representado por ele (evita duplicar)
            if (/^(IMG|IFRAME|VIDEO)$/.test(el.tagName) && el.closest('.generic2wide-iframe-div, .smg-dm-wrap, span[data-s9e-mediaembed]')) return;
            // s9e dentro de um .generic2wide-iframe-div (redgifs do Simp) → o DIV pai é o bloco (senão conta 2x: o span + o div)
            if (el.matches('span[data-s9e-mediaembed]') && el.closest('.generic2wide-iframe-div')) return;
            // s9e CONSUMIDO (saint/turbo/redgifs tiraram o iframe e montaram o player num generic2wide-iframe-div IRMÃO →
            // sobrou só o .url-below vazio): FANTASMA. Sem isto ele virava um bloco a mais → grid com coluna(s) vazia(s).
            if (el.matches('span[data-s9e-mediaembed]') && !el.querySelector('iframe, video, img')) return;
            // .generic2wide-iframe-div VAZIO NÃO conta como mídia (loader pós-autoload esvazia: iframe vai pra s9e separado).
            // basta o teste de conteúdo: o loader que ASSUMIMOS tem .smg-rg>video → entra; o esvaziado (sem iframe/slot/video) → sai.
            if (el.matches('.generic2wide-iframe-div') && !el.querySelector('iframe, .smg-turbo-slot, video, .smg-rg-fail')) return;
            out.push(el);
        });
        return out;
    }
    function blockRelH(b) {   // altura relativa (h/w) p/ distribuir no masonry, SEM reflow (usa o aspect-ratio já conhecido)
        if (b.tagName === 'IMG') {
            const m = (b.style.aspectRatio || '').match(/([\d.]+)\D+([\d.]+)/);
            if (m && +m[1]) return (+m[2]) / (+m[1]);
            if (b.naturalWidth) return b.naturalHeight / b.naturalWidth;
            return 1.3;
        }
        // embed: usa o aspect-ratio REAL se o player já souber (redgifs/turbo setam no .smg-rg após carregar — muitos são retrato, não 16:9)
        const rg = (b.matches && b.matches('.smg-rg')) ? b : (b.querySelector && b.querySelector('.smg-rg'));
        const am = rg && rg.style.aspectRatio && rg.style.aspectRatio.match(/([\d.]+)\D+([\d.]+)/);
        if (am && +am[1]) return (+am[2]) / (+am[1]);
        return 0.5625;   // embeds/vídeo 16:9 (default até o player saber a proporção)
    }
    function gridCols() { return window.innerWidth < 600 ? 1 : 3; }   // faixa (p/ detectar a troca mobile↔desktop no resize)
    // nº de colunas pela quantidade E orientação:
    //   · mobile → 1 · 2 itens ambos HORIZONTAIS → 1 (cada um full width) · 2 itens vertical/misto → 2 (lado a lado, cap 75vh) · resto → 3
    function gridColsFor(blocks) {
        if (window.innerWidth < 600) return 1;
        if (blocks.length === 2) return blocks.every(b => blockRelH(b) < 1) ? 1 : 2;
        return 3;
    }
    // ===== MASONRY via CSS Grid (row-span) =====
    // grid `display:grid` com colunas iguais e linhas FINAS (MASONRY_ROW); cada item reserva N linhas (gridRowEnd: span N) → empacotamento
    // estilo Pinterest E um item pode ATRAVESSAR colunas (gridColumn: span 2) — o que o flex de colunas não permitia.
    //   · row-span = nº de linhas finas que cobrem a ALTURA REAL do item; medido por ResizeObserver (sempre certo, mesmo quando a imagem/
    //     o player resolve o tamanho depois) — só um provisório por aspecto é posto na 1ª pintura p/ evitar flash.
    //   · item HORIZONTAL (imagem OU vídeo, h/w < 0.9) num grid de ≥2 colunas → gridColumn span 2.
    const MASONRY_ROW = 8, MASONRY_GAP = 8;   // px — DEVE casar com grid-auto-rows + gap da .auto-image-grid na CSS
    function spanForHeight(h) { return Math.max(1, Math.ceil((h + MASONRY_GAP) / (MASONRY_ROW + MASONRY_GAP))); }
    let masonryRO = null, masonryDirty = new Set(), masonryRaf = 0;
    function scheduleRelayout(grid) {
        masonryDirty.add(grid);
        if (masonryRaf) return;
        masonryRaf = requestAnimationFrame(() => { masonryRaf = 0; const gs = masonryDirty; masonryDirty = new Set(); gs.forEach(g => { if (g.isConnected) relayoutGrid(g); }); });
    }
    function getMasonryRO() {
        if (masonryRO) return masonryRO;
        if (typeof ResizeObserver === 'undefined') return null;
        masonryRO = new ResizeObserver(entries => {
            for (const e of entries) {
                const grid = e.target.parentElement;   // o tamanho de um item mudou (img/player resolveu) → recalcula spans/colunas do grid
                if (grid && grid.classList && grid.classList.contains('auto-image-grid')) scheduleRelayout(grid);
            }
        });
        return masonryRO;
    }
    // embed lazy (turbo/saint): ativa AGORA se perto da viewport; senão re-observa na posição nova
    function activateLazyEmbed(b) {
        const slot = b.querySelector && b.querySelector('.smg-turbo-slot');
        if (!(slot && slot._smgActivate && !slot.querySelector('iframe, .smg-turbo-error'))) return;
        const rect = slot.getBoundingClientRect();
        const near = rect.top < (window.innerHeight || 0) + 800 && rect.bottom > -800;
        if (near || !turboIO) { const fn = slot._smgActivate; slot._smgActivate = null; turboIO && turboIO.unobserve(slot); fn(); }
        else { turboIO.unobserve(slot); turboIO.observe(slot); }
    }
    // row-span (nº de linhas finas) pela ALTURA estimada do item na largura w — determinístico (aspecto + teto), sem medir.
    function rowSpanFor(b, w) {
        let h = w * blockRelH(b); const cap = (window.innerHeight || 800) * 0.75; if (h > cap) h = cap;
        return 'span ' + spanForHeight(h);
    }
    // (re)faz o layout: nº de colunas + col-span (horizontal = 2 colunas) + row-span (aspecto). Determinístico → idempotente.
    function relayoutGrid(grid) {
        const items = Array.prototype.filter.call(grid.children, c => c.nodeType === 1);
        if (!items.length) return;
        const N = gridColsFor(items);
        grid.style.setProperty('--smg-mcols', N);
        grid.classList.toggle('smg-grid-pair-port', items.length === 2 && N === 2);   // par vertical/misto → cap 75vh (CSS)
        const colW = Math.max(40, (grid.clientWidth - (N - 1) * MASONRY_GAP) / N);
        items.forEach(b => {
            const span2 = (N >= 2 && blockRelH(b) < 0.9) ? Math.min(2, N) : 1;   // QUALQUER item HORIZONTAL (imagem ou vídeo) → 2 colunas
            const cs = span2 > 1 ? ('span ' + span2) : '';
            if (b.style.gridColumn !== cs) b.style.gridColumn = cs;
            const rs = rowSpanFor(b, colW * span2 + MASONRY_GAP * (span2 - 1));
            if (b.style.gridRowEnd !== rs) b.style.gridRowEnd = rs;
        });
        if (N >= 3) expandLonelyWides(grid, N, colW);   // item de 2 colunas SOZINHO (sem mídia ao lado) → ocupa as 3
    }
    // mede o layout denso atual e, se um item de 2 colunas não tem NADA ao lado na faixa vertical dele, expande pra largura cheia (3 col).
    function expandLonelyWides(grid, N, colW) {
        const all = Array.prototype.filter.call(grid.children, c => c.nodeType === 1);
        const wides = all.filter(c => /span 2/.test(c.style.gridColumn || ''));
        if (!wides.length) return;
        const gr = grid.getBoundingClientRect();   // força o layout denso atual → mede
        const rects = all.map(el => ({ el: el, r: el.getBoundingClientRect() }));
        const tol = 4;
        wides.forEach(w => {
            const wr = w.getBoundingClientRect();
            const band = rr => rr.bottom > wr.top + tol && rr.top < wr.bottom - tol;   // sobrepõe verticalmente o item largo
            const rightGap = (gr.right - wr.right) > colW * 0.5, leftGap = (wr.left - gr.left) > colW * 0.5;   // sobra ≈1 coluna de um lado
            const someoneRight = rects.some(o => o.el !== w && band(o.r) && o.r.left >= wr.right - tol);
            const someoneLeft = rects.some(o => o.el !== w && band(o.r) && o.r.right <= wr.left + tol);
            if ((rightGap && !someoneRight) || (leftGap && !someoneLeft)) {
                w.style.gridColumn = '1 / -1';   // nada ao lado → ocupa as 3 colunas
                w.style.gridRowEnd = rowSpanFor(w, grid.clientWidth);
            }
        });
    }
    // move os novos blocos pra serem filhos DIRETOS do grid (sem colunas .smg-mcol), observa o tamanho e faz o layout.
    function fillGrid(grid, newBlocks) {
        grid.style.removeProperty('grid-template-columns'); grid.style.columnCount = '';   // limpa modos antigos (multicol / template inline)
        const ro = getMasonryRO();
        newBlocks.forEach(b => {
            if (b.parentNode === grid) return;
            const unfurl = b.closest('.bbCodeBlock--unfurl');   // ANTES de mover: o card de link vira caixa vazia → esconde
            grid.appendChild(b); b.dataset.smgGridded = '1';
            if (unfurl) unfurl.style.display = 'none';
            if (ro) ro.observe(b);
            activateLazyEmbed(b);
        });
        relayoutGrid(grid);
    }
    // remove os <a> esvaziados (a img foi pro grid) + os <br> separadores, no PARENT do grid — sem tocar em texto/links reais.
    function cleanupGhosts(grid) {
        const parent = grid.parentNode; if (!parent) return;
        parent.querySelectorAll(':scope > a').forEach(a => {
            let real = false;   // conteúdo PRÓPRIO do <a> (ignora <noscript>, que vaza como texto OU vira DOM dependendo do parse)
            a.childNodes.forEach(n => { if (n.nodeType === 1 && n.tagName !== 'NOSCRIPT') real = true; else if (n.nodeType === 3 && n.textContent.trim()) real = true; });
            if (real) return;   // <a> com texto/mídia real → mantém SEMPRE
            let sib = a.nextSibling; a.remove();
            while (sib && sib.nodeType === 3 && !sib.textContent.trim()) { const nx = sib.nextSibling; sib.remove(); sib = nx; }
            if (sib && sib.nodeName === 'BR') sib.remove();   // o <br> que separava esta imagem da próxima
        });
        let p = grid.previousSibling;   // <br>/ws colado ANTES do grid (sobra dos breaks das imagens movidas) → senão empurra o grid pra baixo
        while (p && (p.nodeName === 'BR' || (p.nodeType === 3 && !p.textContent.trim()))) { const pv = p.previousSibling; p.remove(); p = pv; }
    }
    // GALERIA EM CONTEXTO (era: UM grid no fim do post → quebrava o contexto quando havia texto entre as mídias). Agora agrupa
    // só RUNS de mídia CONTÍGUA (separadas apenas por <br>/espaço); texto OU card/elemento não-mídia entre mídias QUEBRA a run →
    // vira um grid à parte NO LUGAR de origem, então o texto fica junto da mídia a que se refere. Run de 1 mídia → fica inline.
    function buildPostGallery(scope) {
        const byParent = new Map();   // parent-do-fluxo → Map(flowEl → [blocks]); flowEl = o nó que senta no fluxo (o <a> da img, ou o próprio wrapper)
        collectGalleryBlocks(scope).forEach(b => {
            if (b.dataset.smgGridded) return;   // já gridada (filho direto do grid)
            const flow = (b.tagName === 'IMG') ? (b.closest('a') || b) : b;
            const parent = flow.parentNode; if (!parent) return;
            if (!byParent.has(parent)) byParent.set(parent, new Map());
            const m = byParent.get(parent); if (!m.has(flow)) m.set(flow, []); m.get(flow).push(b);
        });
        byParent.forEach((flowMap, parent) => {
            let run = [];   // itens contíguos: {flow,blocks} (mídia nova) | {grid} (grid já existente → mídia nova adjacente entra nele)
            const flush = () => {
                const items = run; run = [];
                const ungridded = []; items.forEach(it => { if (it.blocks) ungridded.push.apply(ungridded, it.blocks); });
                if (!ungridded.length) return;   // run sem mídia nova → nada a fazer (resize é tratado à parte)
                let grid = (items.find(it => it.grid) || {}).grid;
                const have = grid ? grid.children.length : 0;   // itens já no grid (filhos diretos)
                if (ungridded.length + have < 2) return;   // run de 1 mídia → inline (sem grid)
                if (!grid) {
                    const firstFlow = (items.find(it => it.flow) || {}).flow;
                    if (!firstFlow || !firstFlow.parentNode) return;
                    grid = document.createElement('div'); grid.className = 'auto-image-grid';
                    firstFlow.parentNode.insertBefore(grid, firstFlow);   // grid NO LUGAR (antes da 1ª mídia da run)
                }
                fillGrid(grid, ungridded);
                cleanupGhosts(grid);
            };
            Array.from(parent.childNodes).forEach(node => {
                if (node.nodeType === 3) { if (node.textContent.trim()) flush(); return; }   // texto real → quebra a run; whitespace → mantém
                if (node.nodeType !== 1) return;
                if (node.tagName === 'BR') return;   // separador → mantém a run
                if (node.classList && node.classList.contains('auto-image-grid')) { run.push({ grid: node }); return; }   // grid existente
                if (flowMap.has(node)) { run.push({ flow: node, blocks: flowMap.get(node) }); return; }   // mídia ainda não gridada
                flush();   // card/parágrafo/qualquer outro elemento → quebra a run (preserva o contexto texto↔mídia)
            });
            flush();
        });
    }
    // resize/rotação: a LARGURA das colunas muda sozinha (grid fluido) → o ResizeObserver re-mede e corrige o row-span.
    // Só ao CRUZAR a faixa mobile↔desktop o NÚMERO de colunas muda → reaplica o layout (N + col-span) nas grids existentes.
    let masonryResizeBound = false, masonryBucket = -1;
    function bindMasonryResize() {
        if (masonryResizeBound) return;
        masonryResizeBound = true;
        masonryBucket = gridCols();
        let t;
        window.addEventListener('resize', () => {
            clearTimeout(t);
            t = setTimeout(() => {
                const b = gridCols();
                if (b === masonryBucket) return;   // mesma faixa → o RO já cuida da largura
                masonryBucket = b;
                document.querySelectorAll('.auto-image-grid').forEach(relayoutGrid);   // recalcula nº de colunas + col-span
            }, 200);
        }, { passive: true });
    }
    function buildPostGalleries(roots) {
        if (!document.documentElement.classList.contains('smg-masonry-on')) return;   // só com a Galeria ligada
        bindMasonryResize();
        // gate barato (data-smg-galseen marca cada item 1x → steady-state ~0). Escopo = CORPO do post (.message-userContent)
        // inteiro, NÃO só dentro do .bbWrapper: no SMG nosso embed às vezes entra como IRMÃO do .bbWrapper (fora dele) e ficava de fora.
        // corpo do post = .message-userContent · comentário (profile post / SMG) = .comment-body
        const types = ['img.bbImage', '.generic2wide-iframe-div', '.smg-dm-wrap', 'span[data-s9e-mediaembed]', 'iframe[src*="imagepond.net"]'];
        const sel = [];
        ['.message-userContent', '.comment-body'].forEach(root => types.forEach(t => sel.push(root + ' ' + t + ':not([data-smg-galseen])')));
        const bodies = new Set();
        eachIn(roots, sel.join(','), el => {
            el.dataset.smgGalseen = '1';
            if (el.closest('.bbCodeQuote, .message-signature')) return;   // não agrupa citação/assinatura (unfurl com embed PODE entrar)
            const b = el.closest('.message-userContent, .comment-body');
            if (b) bodies.add(b);
        });
        bodies.forEach(buildPostGallery);
    }
