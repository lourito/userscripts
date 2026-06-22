    // =========================================================
    // FEATURE: turbo embeds
    // =========================================================

    // helper: IntersectionObserver p/ montar embeds só perto da viewport (lazy)
    let turboIO = null;
    function getTurboIO() {   // monta o embed (slot._smgActivate) só perto da viewport (lazy) — ~1 tela à frente, igual ao redgifs ("pronto quando chega"; o blob fica adiado pro play)
        return turboIO || (turboIO = makeLazyIO(el => { if (el._smgActivate) el._smgActivate(); }, { rootMargin: '100% 0px' }));
    }

    // tira o <a> CRU do turbo da página depois que ele virou player (ou já existe um pro mesmo id). Sem isto, link de
    // texto (ex.: 2 URLs na MESMA linha — o XF não auto-embeda, fica <a>texto</a>) aparece VISÍVEL acima do player.
    // Remove tbm o <br> imediatamente seguinte (senão sobra linha em branco). wrapper = âncora p/ achar o <br> (foi
    // inserido entre o link e o <br>); no dedup (sem wrapper) o <br> está direto após o link.
    function retireTurboLink(link, wrapper) {
        const br = (wrapper || link).nextElementSibling;
        if (br && br.tagName === 'BR') br.remove();
        link.remove();
    }

    function processTurboLinks(roots) {
        // :not(.smg-turbo-fallback) → não re-processa o nosso próprio link de
        // fallback (que aponta pro turbo.cr), senão vira loop infinito de wrappers.
        eachIn(roots, 'a[href*="turbo.cr/"]:not(.smg-turbo-fallback):not([data-turbo-iframe-processed])', link => {

            // turbo.cr/a/{id} = ÁLBUM (galeria de vários itens), não um vídeo único → o /embed/ não serve.
            // marca como processado e deixa o link cru (o groupLinks pega como chip de file-host).
            if (/turbo\.cr\/a\//i.test(link.href)) { link.dataset.turboIframeProcessed = 'true'; return; }

            // pega o ÚLTIMO segmento do path, seja qual for o prefixo:
            // /{id}, /e/{id}, /v/{id}, /embed/{id}, etc. id pode ter _ e -.
            const match = link.href.match(/turbo\.cr\/(?:[^/?#]+\/)*([a-zA-Z0-9_-]+)/i);
            if (!match) return;

            link.dataset.turboIframeProcessed = 'true';

            const id = match[1];
            const originalHref = link.href;
            const embedUrl = `https://turbo.cr/embed/${id}`;

            // card de preview do xenforo: esconde
            const previewBlock = link.closest('.contentRow') || link.closest('.block-row');
            if (previewBlock) previewBlock.style.display = 'none';

            // DEDUP: o MESMO turbo já embedado nesse corpo? (XF às vezes deixa o link cru + o card unfurl pro mesmo vídeo → 2 players)
            const bodyEl = link.closest('.message-userContent, .comment-body') || link.closest('.bbWrapper');
            if (bodyEl && bodyEl.querySelector('.generic2wide-iframe-div[data-tb-id="' + id + '"]')) { retireTurboLink(link); return; }   // já tem player desse id → só tira o <a> cru

            // wrapper já com o link original SEMPRE clicável (mesmo se der 404)
            const wrapper = buildEmbedWrapper(originalHref, id);   // default = turbo
            wrapper.dataset.tbId = id;   // marca p/ o dedup acima
            (previewBlock || link).insertAdjacentElement('afterend', wrapper);
            if (!previewBlock) retireTurboLink(link, wrapper);   // tira o <a> cru (a URL crua na página): o player + o fallback embutido já cobrem o "abrir no turbo"

            const slot = wrapper.querySelector('.smg-turbo-slot');

            // FALLBACK: o iframe clássico (pré-check de 404; spinner fica até carregar/dar erro)
            const iframeFallback = () => turboCheck(embedUrl, ok => {
                wrapper.querySelector('.smg-turbo-fallback')?.style.removeProperty('display');   // scrape falhou → revela o link de escape ("Open on turbo")
                if (slot.querySelector('iframe')) { slot.querySelector('.smg-loading')?.remove(); return; }   // já tem iframe → não duplica
                slot.querySelectorAll('.smg-rg').forEach(e => e.remove());   // ANTI-DUP: se sobrou nosso player, tira antes do iframe
                unfillSlot(slot);   // player nativo pode ter montado e falhado → volta o slot ao 16:9 p/ o iframe (absoluto) não colapsar
                const loading = slot.querySelector('.smg-loading');
                if (!ok) { loading?.remove(); slot.appendChild(buildTurboError()); return; }
                const iframe = buildTurboIframe(embedUrl);
                const stopLoading = () => loading?.remove();
                iframe.addEventListener('load', stopLoading, { once: true });
                setTimeout(stopLoading, 15000);
                slot.appendChild(iframe);
            });

            // monta o embed: 1º tenta o PLAYER NOSSO (extrai o mp4 do turbo) → controles próprios; se não achar/falhar, cai pro iframe.
            const activate = () => {
                if (slot.dataset.tbActivated) return;   // run-once (turboIO E o masonry podem chamar) → sem scrape/vídeo duplicado
                slot.dataset.tbActivated = '1'; slot._smgActivate = null;
                if (!(FEATURES.turboNativePlayer && GMX)) { iframeFallback(); return; }
                turboResolve(embedUrl, mp4 => {
                    if (slot.querySelector('.smg-rg')) return;        // já tem nosso player → nada a fazer
                    if (!mp4) { iframeFallback(); return; }            // sem url → iframe
                    slot.querySelectorAll('iframe, .smg-loading, .smg-turbo-error').forEach(e => e.remove());   // ANTI-DUP: tira iframe/spinner ANTES do nosso player
                    const poster = turboPoster(mp4);   // poster igual ao player do turbo — sem request extra
                    const { wrap, video } = buildNativeVideo(mp4, 'https://turbo.cr/', iframeFallback, 'Turbo');
                    video._rgExt = originalHref;   // botão "abrir em nova guia" → turbo
                    video._rgFeed = embedUrl;      // botão "abrir no visualizador" (bate com collectMediaFrom)
                    slot.parentElement && slot.parentElement.querySelector('.smg-turbo-fallback')?.remove();   // tira o link de baixo (o botão dos controles substitui)
                    slot.appendChild(wrap);
                    fillSlot(slot);   // solta o 16:9/overflow do slot → não corta vídeo vertical
                    rgPrepareUrl(video, mp4, wrap, poster);   // poster + estado pronto; stream só no play (preload none) → first-paint instantâneo, sem contenção no feed
                });
            };

            // lazy: só dispara o precheck/iframe quando o embed chega perto da tela
            const io = FEATURES.lazyEmbeds ? getTurboIO() : null;
            if (io) {
                slot._smgActivate = activate;
                io.observe(slot);
            } else {
                activate();
            }
        });
    }

    // wrapper GENÉRICO de embed (turbo E saint — eram 2 funções byte-idênticas): .generic2wide-iframe-div
    // > .smg-turbo-slot (recebe o player/iframe, com spinner) + link de fallback sempre clicável.
    // opts.label = texto do fallback · opts.doneAttr = data-attr que marca o fallback p/ não re-processar.
    function buildEmbedWrapper(originalHref, id, opts) {
        opts = opts || {};
        const wrapper = document.createElement('div');
        wrapper.className = 'generic2wide-iframe-div';

        const slot = document.createElement('div');
        slot.className = 'smg-turbo-slot';

        // spinner enquanto o precheck/scrape roda e o player monta
        const loading = document.createElement('div');
        loading.className = 'smg-loading';
        slot.appendChild(loading);

        const fallback = document.createElement('a');
        fallback.className = 'smg-turbo-fallback';
        fallback.dataset[opts.doneAttr || 'turboIframeProcessed'] = opts.doneVal || 'true';   // :not([data-…]) não re-processa o próprio fallback (evita loop)
        fallback.href = originalHref;
        fallback.target = '_blank';
        fallback.rel = 'noopener noreferrer';
        fallback.textContent = '↗ ' + i18n(opts.label || 'Open on turbo.cr') + ' (' + id + ')';
        fallback.style.display = 'none';   // escondido enquanto faz o scrape → SÓ aparece se cair pro iframe/erro (sem o flash do "Open on…" antes do player)

        wrapper.append(slot, fallback);
        return wrapper;
    }

    // PERF: substitui os seletores `.bbWrapper:has(.generic2wide-iframe-div)` do CSS (o engine reavalia :has a cada
    // mutação de subtree — e o processAll muta quase todo frame). Marca o wrapper-pai com .smg-has-g2w 1× por embed
    // (guard por dataset, escopado via roots) → o CSS casa a classe estática em vez do :has dinâmico. Cobre tanto os
    // embeds que NÓS criamos (buildEmbedWrapper) quanto os nativos do Simp (auto-load redgifs já vem no HTML).
    function markG2wWrappers(roots) {
        eachIn(roots, '.generic2wide-iframe-div:not([data-g2w-up])', div => {
            div.dataset.g2wUp = '1';
            const w = div.closest('.bbWrapper, .message-userContent, .message-content');
            if (w) w.classList.add('smg-has-g2w');
        });
    }

    function buildTurboIframe(embedUrl) {
        const iframe = document.createElement('iframe');
        iframe.className = 'saint-iframe';
        iframe.src = embedUrl;

        // força um viewport interno grande
        iframe.width = '1280';
        iframe.height = '720';
        iframe.loading = 'lazy';
        iframe.allowFullscreen = true;
        iframe.setAttribute(
            'allow',
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen'
        );

        return iframe;
    }

    function buildTurboError() {
        const box = document.createElement('div');
        box.className = 'smg-turbo-error';
        box.textContent = i18n('⚠ turbo.cr unavailable (404) — use the link below');
        return box;
    }

    // Decide se monta o iframe. Estratégia OTIMISTA: só mostra o card de erro
    // num 404/410 confirmado por GET. Qualquer ambiguidade (403, 5xx, bloqueio,
    // timeout, erro de rede, HEAD tratado diferente) → mostra o iframe mesmo
    // assim — o link de fallback já cobre o caso de estar de fato quebrado.
    // Sem GM_xmlhttpRequest, assume ok.
    function turboCheck(url, cb) {
        if (typeof GM_xmlhttpRequest !== 'function') {
            cb(true);
            return;
        }

        const decide = status => {
            if (isOkStatus(status)) cb(true);
            else if (status === 404 || status === 410) cb(false); // morto confirmado
            else cb(true);                                         // na dúvida, mostra
        };

        // GET (com Range) confirma — muitos servidores tratam HEAD diferente do GET
        const getConfirm = () => GM_xmlhttpRequest({
            method: 'GET',
            url,
            timeout: 8000,
            headers: { Range: 'bytes=0-1024' },
            onload: res => decide(res.status),
            onerror: () => cb(true),
            ontimeout: () => cb(true),
        });

        GM_xmlhttpRequest({
            method: 'HEAD',
            url,
            timeout: 8000,
            onload: res => {
                if (isOkStatus(res.status)) cb(true);
                else getConfirm(); // qualquer não-ok no HEAD → confirma com GET
            },
            onerror: getConfirm,
            ontimeout: getConfirm,
        });
    }

    function isOkStatus(status) {
        return status === 206 || (status >= 200 && status < 400);
    }
