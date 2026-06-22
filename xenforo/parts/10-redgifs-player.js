    // =========================================================
    // FEATURE: player nativo de RedGifs (substitui o iframe por <video> com o mp4 da API — reaproveitado do reddit.js)
    // À PROVA DE FALHA: qualquer erro (sem GM / API / blob) RESTAURA o embed nativo (iframe). Nunca deixa buraco.
    //
    // Mapa interno (ver "PIPELINE DE VÍDEO" no índice do topo do arquivo):
    //   API redgifs .. GMX · rgIdFrom · gmGetJSON · rgToken · rgVideo (id → urls.hd/sd + poster)
    //   infra ........ rgBlob · getRgLoadIO/getRgPlayIO · rgPump (fila máx 3) · rgHost/rgDirect
    //   carga ........ rgLoad → rgViaDirect (streaming) | rgViaBlob (download) · rgRestore (falha → iframe)
    //   player UI .... rgBuild · rgControls (controles próprios) · rgStart · buildNativeVideo
    //   turbo ........ turboResolve/turboApi/turboUrlFromJson · processTurboNativeEmbeds (Simp)
    //   aplica ....... applyRedgifsPlayer (loaders/iframes do fórum → nosso player) · rgHidePlaceholder
    // =========================================================
    const GMX = (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest
              : (typeof GM !== 'undefined' && GM.xmlHttpRequest ? GM.xmlHttpRequest.bind(GM) : null);

    function rgIdFrom(s) {   // id do redgifs em qualquer url (/ifr/ /watch/ /gifs/ /i/)
        const m = (s || '').match(/redgifs\.com\/(?:ifr|watch|gifs|i)\/([A-Za-z0-9]+)/i);
        return m ? m[1] : null;
    }
    function gmGetJSON(url, headers) {
        return new Promise((resolve, reject) => {
            if (!GMX) { reject(new Error('no GM_xmlhttpRequest')); return; }
            GMX({ method: 'GET', url, headers: headers || {}, timeout: 12000,
                onload: r => { if (r.status >= 200 && r.status < 300) { try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(e); } } else reject(new Error('HTTP ' + r.status)); },
                onerror: () => reject(new Error('neterror')), ontimeout: () => reject(new Error('timeout')) });
        });
    }
    let rgTok = null, rgTokAt = 0, rgTokP = null;
    function rgToken() {   // token temporário (~reuso 50min). Dedup: N redgifs ao mesmo tempo reusam UM fetch (evita rate-limit)
        if (rgTok && (Date.now() - rgTokAt) < 3e6) return Promise.resolve(rgTok);
        if (rgTokP) return rgTokP;
        rgTokP = gmGetJSON('https://api.redgifs.com/v2/auth/temporary').then(j => {
            rgTokP = null; rgTok = j && j.token; rgTokAt = Date.now();
            if (!rgTok) throw new Error('no token');
            return rgTok;
        }, e => { rgTokP = null; throw e; });
        return rgTokP;
    }
    const rgCache = new Map();
    async function rgVideo(id) {
        const key = id.toLowerCase();
        if (rgCache.has(key)) return rgCache.get(key);
        const tok = await rgToken();
        const j = await gmGetJSON('https://api.redgifs.com/v2/gifs/' + key, { Authorization: 'Bearer ' + tok });
        const gif = j && j.gif, u = gif && gif.urls;
        if (!u || !(u.hd || u.sd)) throw new Error('no urls');
        // poster SEMPRE: api → senão constrói do id em CamelCase (gif.id) — padrão media.redgifs.com/{Id}-poster.jpg
        const poster = u.poster || u.thumbnail || (gif.id ? 'https://media.redgifs.com/' + gif.id + '-poster.jpg' : '');
        const out = { hd: u.hd || u.sd, sd: u.sd || u.hd, poster: poster, w: gif.width || 0, h: gif.height || 0 };
        rgCache.set(key, out);
        return out;
    }
    function rgBlob(url, referer) {   // baixa o mp4 forjando o Referer do host → fura hotlink/CORS (<video> direto às vezes dá tela preta)
        const ref = referer || 'https://www.redgifs.com/';
        return new Promise((resolve, reject) => {
            if (!GMX) { reject(new Error('no GMX')); return; }
            GMX({ method: 'GET', url, responseType: 'blob', timeout: 30000, headers: { Referer: ref, Origin: ref.replace(/\/$/, '') },
                onload: r => { if (r.status >= 200 && r.status < 300 && r.response) resolve(r.response); else reject(new Error('HTTP ' + r.status)); },
                onerror: () => reject(new Error('neterror')), ontimeout: () => reject(new Error('timeout')) });
        });
    }

    const rgBlobs = [];   // LRU dos objectURLs (libera memória; o vídeo recarrega ao revisitar)
    const rgLiveVideos = new Set();   // todos os <video> smg-rg-v vivos — rgSolo muta os outros sem varrer o doc
    let rgLoadIO = null, rgPlayIO = null, rgFreeIO = null;
    function getRgLoadIO() {   // PREPARO: ~1 tela antes da viewport, enfileira (rgPump, máx 3) só o POSTER do redgifs (rgPrepare — sem baixar vídeo). O play (rgLoad) é no clique.
        return rgLoadIO || (rgLoadIO = makeLazyIO(el => { if (!el.dataset.rgLoaded && !el.dataset.rgPrepared) rgEnqueue(() => rgPrepare(el)); }, { rootMargin: '100% 0px' }));
    }
    function rgAutoOK(v) { return !(v.duration > 60) || v._rgUserPlayed; }   // vídeo >1min NÃO toca sozinho (só no clique); curto (gif/loop) autoplay normal
    function getRgPlayIO() {   // PLAY: toca mudo quando ≥40% visível, pausa fora
        if (rgPlayIO || !('IntersectionObserver' in window)) return rgPlayIO;
        rgPlayIO = new IntersectionObserver(es => es.forEach(e => {
            const v = e.target;
            // AUTOPLAY OFF (req): inline NÃO toca ao entrar na viewport — só PAUSA ao sair (se o usuário tinha dado play).
            if (!(e.isIntersecting && e.intersectionRatio >= 0.4)) { try { v.pause(); } catch (x) {} }
        }), { threshold: [0, 0.4] });
        return rgPlayIO;
    }
    // FAR offscreen (>2000px): solta o src do redgifs → libera memória/decoder (numa thread longa com
    // muitos vídeos, sem isso N players ficam bufferizados ao mesmo tempo). Recarrega via rgLoadIO ao voltar.
    function getRgFreeIO() {
        if (rgFreeIO || !('IntersectionObserver' in window)) return rgFreeIO;
        rgFreeIO = new IntersectionObserver(es => es.forEach(e => {
            if (e.isIntersecting) return;   // ainda perto (≤2000px) → mantém carregado
            const v = e.target;
            if (!v.dataset.rgid || !v.dataset.rgLoaded || !v.getAttribute('src')) return;   // só redgifs JÁ carregado (turbo tem URL que expira → nunca solta; src ausente = ainda buscando, não mexe)
            try { v.pause(); } catch (x) {}
            v.removeAttribute('src'); try { v.load(); } catch (x) {}   // descarta o buffer/decoder (libera memória/decoder)
            v.dataset.rgLoaded = '';
            const w = v.closest('.smg-rg'); if (w) { w.classList.remove('smg-rg-loading', 'smg-rg-buffering'); w.classList.add('smg-rg-ready'); }   // volta ao PRONTO (poster ainda setado + play central): clicar recarrega e toca (autoplay off → não recarrega sozinho ao voltar)
        }), { rootMargin: '2000px 0px' });
        return rgFreeIO;
    }
    // só um com áudio: muta os OUTROS players vivos. O Set self-poda nós detached → sem querySelectorAll no doc a cada play/unmute.
    function rgSolo(video) { rgLiveVideos.forEach(o => { if (!o.isConnected) rgLiveVideos.delete(o); else if (o !== video) o.muted = true; }); }
    // libera os objectURLs dos vídeos que saíram do DOM (ex.: ao fechar o feed) — senão os ≤6 blobs ficam até a próxima evicção da LRU.
    function rgReleaseDetachedBlobs() {
        for (let i = rgBlobs.length - 1; i >= 0; i--) {
            const e = rgBlobs[i];
            if (!e.video || !e.video.isConnected) { try { URL.revokeObjectURL(e.url); } catch (x) {} rgBlobs.splice(i, 1); }
        }
    }

    // FILA: serializa o carregamento (rgLoad/rgLoadUrl) em máx RG_MAX_CONCURRENT. O streaming direto libera o slot no
    // metadata (rápido); o blob segura o slot o download inteiro — por isso o inline-autoplay-off adia o blob (deferBlob).
    let rgActive = 0; const rgQueue = [];
    const RG_MAX_CONCURRENT = 3;   // máx de vídeos carregando ao mesmo tempo (2 serializava demais a fila → "demora muito no próximo lote")
    function rgPump() { while (rgActive < RG_MAX_CONCURRENT && rgQueue.length) { const fn = rgQueue.shift(); rgActive++; Promise.resolve().then(fn).finally(() => { rgActive--; rgPump(); }); } }
    function rgEnqueue(fn) { rgQueue.push(fn); rgPump(); }

    function rgPlayIfVisible(video, wrap) {
        // NÃO tira o skeleton aqui (isso é no 'loadeddata', quando há frame). Aqui só decide o autoplay.
        if (!video._rgInFeed && !video._rgUserPlayed) return;   // INLINE não-clicado: só prepara, NÃO toca (autoplay off). Feed (_rgInFeed) ou já-clicado (_rgUserPlayed) → toca.
        if (!rgAutoOK(video)) return;   // >1min → não autoplay
        const rect = video.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < (window.innerHeight || 0)) { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
    }

    // O reddit.js baixa o mp4 INTEIRO em blob só pra DE-TAINT (normalizar áudio via Web Audio) — feature que NÃO temos.
    // Logo: streaming DIRETO (toca enquanto baixa = instantâneo). Os hosts bloqueiam hotlink por Referer → usamos
    // referrerPolicy=no-referrer. Se der tela-preta/erro, cai pro blob (Referer forjado). rgDirect memoriza POR HOST
    // (redgifs e turbo têm hotlink diferente → não pode ser um flag só).
    const rgDirect = {};   // host → true (streaming direto funciona) | false (precisa de blob) | undefined (desconhecido)
    function rgHost(url) { try { return new URL(url, location.href).hostname.split('.').slice(-2).join('.'); } catch (e) { return '?'; } }

    // INLINE com autoplay off (não-feed, não-clicado): NÃO baixa o blob (mp4 INTEIRO) à toa — isso segurava o slot da
    // fila (rgPump) o download todo e fazia o "próximo lote demorar muito" + pesava a página. Guarda a URL e adia pro
    // play; mostra o estado PRONTO (.smg-rg-ready = poster/preto + play central fixo, SEM spinner). No play, o toggle()
    // baixa via rgViaBlob com a URL guardada. (O bug antigo da "caixa preta" era faltar o .smg-rg-ready: tirava o
    // skeleton e ficava preto sem affordance — agora mostra o play. Feed e tiles clicados baixam de verdade na hora.)
    function deferBlob(video, url, wrap) {
        if (video._rgInFeed || video._rgUserPlayed) return false;   // feed / já clicado → baixa o blob de verdade agora
        video._rgDeferUrl = url;                                     // guarda a URL; o toggle() baixa no clique
        if (wrap) { wrap.classList.remove('smg-rg-loading'); wrap.classList.add('smg-rg-ready'); }
        return true;
    }

    // INLINE (autoplay-off): PREPARA só o poster + aspect REAL via API — SEM baixar nenhum byte de vídeo. O <video> fica
    // sem src até o clique (toggle → rgLoad). RedGifs tem poster + dimensões na API → preview rico e aspect certo (zero
    // CLS) de graça, e nenhum stream de metadata por vídeo na tela. (turbo/saint NÃO têm dimensões na API → seguem no
    // metadata leve, senão a caixa viria 16:9 e pularia pro aspect real no play.)
    // POSTER do redgifs via GM (blob): o media.redgifs.com/{Id}-poster.jpg é referer-locked (403 com o referer do fórum) E o
    // <video poster> NÃO respeita o referrerPolicy do elemento → buscamos o poster com Referer redgifs e setamos via blob (mesma-origem).
    function rgSetPoster(video, url) {
        if (!video || !url || video.poster) return;   // já tem poster (rgPrepare setou) → rgLoad não re-baixa nem cria 2º objectURL órfão
        if (!GMX) { video.poster = url; return; }   // sem GM → direto (pode 403, mas é o que dá)
        rgBlob(url).then(b => {
            if (!video.isConnected || video.poster) return;
            try { video.poster = video._rgPosterUrl = URL.createObjectURL(b); } catch (e) { video.poster = url; }   // _rgPosterUrl → rgDispose revoga
        }, () => { if (video.isConnected && !video.poster) video.poster = url; });   // GM falhou → tenta direto
    }
    async function rgPrepare(video) {
        if (!video || video.dataset.rgLoaded || video.dataset.rgPrepared || !video.dataset.rgid) return;
        video.dataset.rgPrepared = '1';
        const wrap = video.closest('.smg-rg');
        let r;
        try { r = await rgVideo(video.dataset.rgid); }
        catch (e) {
            // gif MORTO (sem urls / 404 / 410 / 403) → "RedGifs unavailable" NA HORA (não fica em spinner pra sempre).
            // transiente (rede / 429 / 5xx / timeout) → re-tenta com backoff; após 3 falhas, desiste e mostra o erro.
            const msg = (e && e.message) || '';
            const tries = (+video.dataset.rgTries || 0) + 1; video.dataset.rgTries = String(tries);
            if (/no urls|HTTP 4(0[34]|10)/i.test(msg) || tries >= 3) { rgRestore(video, true); return; }
            video.dataset.rgPrepared = '';
            setTimeout(() => { if (video.isConnected && !video.dataset.rgPrepared && !video.dataset.rgLoaded) rgEnqueue(() => rgPrepare(video)); }, 1500 * tries);
            return;
        }
        if (!video.isConnected) return;
        if (r.poster) rgSetPoster(video, r.poster);            // poster = preview (é um frame do gif) — via GM blob (referer-locked)
        if (r.w && r.h && wrap) wrap.style.aspectRatio = r.w + ' / ' + r.h;
        if (wrap) { wrap.classList.remove('smg-rg-loading'); wrap.classList.add('smg-rg-ready'); }   // poster + play central, sem spinner
    }

    async function rgLoad(video) {
        if (!video || video.dataset.rgLoaded || !video.dataset.rgid) return;
        video.dataset.rgLoaded = '1';
        const wrap = video.closest('.smg-rg');
        if (wrap) wrap.classList.add('smg-rg-loading');
        let r;
        try { r = await rgVideo(video.dataset.rgid); }
        catch (e) {
            const msg = (e && e.message) || '';
            console.warn('[smg-rg] API redgifs falhou:', video.dataset.rgid, msg);
            // gif MORTO (API sem urls, ou 404/410/403) → placeholder limpo (o iframe do redgifs só mostraria "Error loading this gif").
            // erro transitório (rede/429/5xx) → iframe nativo (pode recuperar).
            rgRestore(video, /no urls|HTTP 4(0[34]|10)/i.test(msg));
            return;
        }
        if (!video.isConnected) return;   // removido (ex.: navegou no feed) durante o fetch da API → não monta src/blob num nó detached
        if (r.poster) rgSetPoster(video, r.poster);   // poster aparece já (some a caixa preta) — via GM blob (referer-locked)
        if (r.w && r.h && wrap) wrap.style.aspectRatio = r.w + ' / ' + r.h;   // proporção REAL
        const pick = video._rgSd ? r.sd : r.hd;   // post = SD (menor/rápido); feed = HD
        video._rgUrl = pick;   // guarda a URL resolvida → botão de download
        if (rgDirect[rgHost(pick)] === false) {   // host precisa de blob (download inteiro, pesado)
            if (deferBlob(video, pick, wrap)) return;   // INLINE autoplay-off: adia pro play (não trava a fila baixando o mp4 inteiro à toa)
            return rgViaBlob(video, pick, wrap);
        }
        return rgViaDirect(video, pick, wrap);                                        // streaming direto (rápido)
    }

    function rgViaDirect(video, url, wrap) {   // STREAMING progressivo (no-referrer) — começa a tocar em ~1s, sem baixar tudo
        const host = rgHost(url);
        return new Promise(resolve => {
            let settled = false;
            const cleanup = () => { video.removeEventListener('loadedmetadata', onData); video.removeEventListener('error', onErr); clearTimeout(wd); };
            const ok = () => { if (settled) return; settled = true; rgDirect[host] = true; cleanup(); rgPlayIfVisible(video, wrap); resolve(); };
            // hard = falha REAL (erro/0x0) → memoriza que o host precisa de blob (próximos vão direto pro blob, sem perder tempo no probe).
            // soft = só timeout de rede lenta → cai pro blob SÓ neste vídeo, sem condenar o host inteiro: 1 vídeo lento não vira sessão toda em full-download.
            const toBlob = hard => { if (settled) return; settled = true; if (hard) rgDirect[host] = false; cleanup(); try { video.removeAttribute('src'); video.load(); } catch (x) {} if (deferBlob(video, url, wrap)) { resolve(); return; } rgViaBlob(video, url, wrap).then(resolve); };
            const onData = () => { if (video.videoWidth > 0) ok(); else toBlob(true); };
            const onErr = () => toBlob(true);
            video.addEventListener('loadedmetadata', onData, { once: true });   // metadata basta p/ confirmar acesso + pegar duração/proporção
            video.addEventListener('error', onErr, { once: true });
            const wd = setTimeout(() => { if (video.readyState < 1) toBlob(false); }, rgDirect[host] === true ? 15000 : 8000);   // tolerante: o 206 funciona; só cai pro blob (que é + lento) em lentidão EXTREMA. Erro real cai na hora pelo onErr.
            video.referrerPolicy = video._rgKeepRef || 'no-referrer';   // host referer-locked (imagepond): preserva o referer da origem (senão 403); resto = no-referrer
            video.preload = 'metadata';   // só metadata (não baixa o vídeo inteiro à toa — economiza banda em vídeo longo); toca/bufferiza no play
            video.src = url;
        });
    }

    function rgViaBlob(video, url, wrap) {   // baixa o mp4 inteiro (Referer forjado) — confiável mas sem streaming. Já roda DENTRO do slot do rgLoad (não enfileira de novo: daria deadlock).
        if (wrap) wrap.classList.add('smg-rg-loading');
        return rgBlob(url, video._rgRef).then(blob => {
            if (!video.isConnected) return;   // detached durante o download (ex.: navegou no feed) → não cria objectURL órfão
            const u = URL.createObjectURL(blob);
            rgBlobs.push({ url: u, video });
            // LRU: evicta o objectURL mais antigo que NÃO está tocando — revogar/limpar um vídeo em loop visível o apagaria na cara do usuário
            while (rgBlobs.length > 6) {
                const idx = rgBlobs.findIndex(e => e.video !== video && (!e.video || e.video.paused));
                if (idx < 0) break;   // todos os outros estão tocando → deixa passar de 6 por ora (eviccionam quando pausarem)
                const old = rgBlobs.splice(idx, 1)[0];
                try { URL.revokeObjectURL(old.url); } catch (x) {}
                if (old.video) { old.video.removeAttribute('src'); old.video.load(); old.video.dataset.rgLoaded = ''; }
            }
            video.referrerPolicy = '';
            video.src = u;
            rgPlayIfVisible(video, wrap);
        }).catch(() => {   // blob tbm falhou → último recurso: mp4 direto no-referrer; se falhar, volta o iframe
            video.addEventListener('error', () => rgRestore(video), { once: true });
            video.referrerPolicy = 'no-referrer';
            video.src = url;
            rgPlayIfVisible(video, wrap);
        });
    }
    // teardown COMPLETO de um player que vai sair do DOM (feed troca de slide / fecha / fallback):
    // pausa, solta o src (decoder/buffer), revoga poster blob + mp4 blob, desregistra dos 3 IOs e
    // tira do rgLiveVideos. Sem isto o feed acumulava um <video> ZUMBI por slide visitado (o Set só
    // se auto-podava dentro do rgSolo, que roda apenas em play COM som — sessão muda nunca podava).
    function rgDispose(video) {
        if (!video) return;
        try { video.pause(); } catch (e) {}
        if (rgPlayIO) rgPlayIO.unobserve(video);
        if (rgFreeIO) rgFreeIO.unobserve(video);
        if (rgLoadIO) rgLoadIO.unobserve(video);
        if (video._rgPosterUrl) { try { URL.revokeObjectURL(video._rgPosterUrl); } catch (e) {} video._rgPosterUrl = null; }
        for (let i = rgBlobs.length - 1; i >= 0; i--) if (rgBlobs[i].video === video) { try { URL.revokeObjectURL(rgBlobs[i].url); } catch (e) {} rgBlobs.splice(i, 1); }
        if (video.getAttribute('src')) { video.removeAttribute('src'); try { video.load(); } catch (e) {} }
        rgLiveVideos.delete(video);
    }
    function rgRestore(video, dead) {
        const wrap = video.closest('.smg-rg'); if (!wrap) return;
        // todo branch abaixo tira o <video> do DOM → teardown completo primeiro,
        // senão o IO/Set retém o nó detached (vaza o elemento + decoder).
        rgDispose(video);
        // gif MORTO (redgifs): em vez do iframe que mostra "Error loading this gif", um placeholder discreto
        if (dead && video.dataset.rgid && !wrap._rgFallback) {
            const ph = document.createElement('div'); ph.className = 'smg-rg-fail'; ph.textContent = i18n('RedGifs unavailable');
            if (wrap.parentNode) wrap.parentNode.insertBefore(ph, wrap);
            wrap.remove(); return;
        }
        if (wrap._rgFallback) { const fb = wrap._rgFallback; wrap.remove(); fb(); return; }   // turbo/saint → monta o iframe nativo
        if (wrap._rgIframe) { if (wrap.parentNode) wrap.parentNode.insertBefore(wrap._rgIframe, wrap); wrap._rgIframe.style.display = ''; wrap.remove(); return; }   // tínhamos REMOVIDO o iframe (parar o áudio) → recoloca no lugar
        const id = video.dataset.rgid;
        if (wrap._rgFeedHost && id) {   // feed/overlay → volta o iframe nativo do feed (com autoplay)
            const f = document.createElement('iframe');
            f.src = feedEmbedUrl('https://www.redgifs.com/ifr/' + id, true);
            f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
            f.allowFullscreen = true;
            wrap._rgFeedHost.appendChild(f);
            wrap.remove(); return;
        }
        const host = wrap._rgLoader;   // veio de um loader (sem iframe) → monta o iframe nativo do redgifs no lugar
        if (host && id) {
            const ifr = document.createElement('iframe');
            ifr.src = 'https://www.redgifs.com/ifr/' + id;
            ifr.setAttribute('allow', 'autoplay; fullscreen');
            ifr.allowFullscreen = true; ifr.loading = 'lazy';
            ifr.dataset.rgDone = '1';   // não re-processar
            host.appendChild(ifr);
        }
        wrap.remove();
    }
    function rgBuild(rgid) {   // <video> mudo+loop com NOSSOS controles (não o nativo do HTML5); autoplay só em vista; object-fit:contain
        const wrap = document.createElement('div'); wrap.className = 'smg-rg smg-rg-loading';   // skeleton já no build (escondido até o frame chegar)
        const video = document.createElement('video');
        video.className = 'smg-rg-v';
        video.loop = true; video.muted = true; video.playsInline = true; video.preload = 'none';   // SEM controls nativo
        video.referrerPolicy = 'no-referrer';   // o POSTER do redgifs (media.redgifs.com/{Id}-poster.jpg) é referer-locked: 403 com o referer do fórum, 200 sem → precisa estar setado ANTES de setar o poster (rgPrepare/rgLoad)
        video.dataset.rgid = rgid;
        video._rgSource = 'RedGifs';   // marca dágua da fonte (watermark no hover)
        rgLiveVideos.add(video);
        video._rgExt = 'https://www.redgifs.com/watch/' + rgid;   // botão "abrir em nova guia"
        video._rgFeed = 'https://www.redgifs.com/ifr/' + rgid;    // botão "abrir no visualizador" (bate com collectMediaFrom)
        wrap.appendChild(video);
        rgControls(wrap, video);   // play/pause + flash · progresso seekável · volume flyout · tempo · externo · visualizador · auto-hide
        return { wrap, video };
    }
    function rgFmt(t) {   // M:SS; ≥ 1h vira H:MM:SS (vídeo longo mostrava "160:19" em vez de "2:40:19")
        t = Math.max(0, t | 0);
        const h = t / 3600 | 0, m = (t / 60 | 0) % 60, s = t % 60, ss = (s < 10 ? '0' : '') + s;
        return h ? h + ':' + (m < 10 ? '0' : '') + m + ':' + ss : m + ':' + ss;
    }
    // nome do arquivo p/ o download: usa o ?fn= (turbo) ou o último segmento; senão genérico
    function rgDownloadName(url, source) {
        try { const u = new URL(url, location.href); const fn = u.searchParams.get('fn'); if (fn) return fn.replace(/[\\/:*?"<>|]+/g, '_'); const seg = decodeURIComponent((u.pathname.split('/').pop() || '')); if (/\.\w{2,5}$/.test(seg)) return seg; } catch (e) {}
        return (source || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '') + '.mp4';
    }
    function rgControls(wrap, video) {   // controles próprios: play central + progresso embaixo + rail vertical (volume · overlay · tela cheia · externo)
        const mkAct = (icon, label, on) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'smg-rgc-act'; b.innerHTML = icon; b.title = i18n(label); b.setAttribute('aria-label', i18n(label)); b.addEventListener('click', on); return b; };
        const toggle = () => {
            if (!video.paused) { video.pause(); return; }
            video._rgUserPlayed = true;
            if (video._rgDeferUrl) {   // o blob foi adiado (inline autoplay-off) → baixa AGORA + toca (rgViaBlob → rgPlayIfVisible; _rgUserPlayed já é true)
                const u = video._rgDeferUrl; video._rgDeferUrl = null;
                wrap.classList.remove('smg-rg-ready'); wrap.classList.add('smg-rg-loading');
                rgViaBlob(video, u, wrap);
                return;
            }
            if (video._rgUrl && !video.dataset.rgLoaded) {   // turbo/saint preparado (só poster) → AGORA faz o stream + toca
                wrap.classList.remove('smg-rg-ready'); wrap.classList.add('smg-rg-loading');
                rgLoadUrl(video, video._rgUrl, wrap);
                return;
            }
            if (video.dataset.rgid && !video.dataset.rgLoaded) {   // redgifs preparado (só poster) → AGORA baixa o vídeo de verdade + toca (rgLoad → rgViaDirect/Blob → rgPlayIfVisible; _rgUserPlayed já é true)
                wrap.classList.remove('smg-rg-ready'); wrap.classList.add('smg-rg-loading');
                rgLoad(video);
                return;
            }
            const p = video.play(); if (p && p.catch) p.catch(() => {});
        };
        // SEEK ±5s + flash "« 5s" / "5s »"
        const sflash = document.createElement('div'); sflash.className = 'smg-rgc-seekflash';
        let sflashT;
        const seek = d => {
            if (!video.duration) return;
            video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + d));
            sflash.textContent = d < 0 ? '« 5s' : '5s »';
            sflash.classList.add('on'); clearTimeout(sflashT); sflashT = setTimeout(() => sflash.classList.remove('on'), 480);
        };
        // CLIQUE no vídeo: 1× = play/pause · 2× = ±5s (metade esquerda/direita). timer separa single de double-click.
        let clickT = null;
        video.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            if (clickT) return;   // já há um clique pendente → este é o 2º (o dblclick cuida do seek)
            clickT = setTimeout(() => { clickT = null; toggle(); }, 230);
        });
        video.addEventListener('dblclick', e => {
            e.preventDefault(); e.stopPropagation();
            if (clickT) { clearTimeout(clickT); clickT = null; }   // cancela o play/pause pendente
            const r = video.getBoundingClientRect();
            seek((e.clientX - r.left) < r.width / 2 ? -5 : 5);
        });
        // CENTRO: play grande (só no pausado/pronto) — seek é por DUPLO-CLIQUE no vídeo (estilo YouTube)
        const flash = document.createElement('div'); flash.className = 'smg-rgc-flash';
        const playBtn = document.createElement('button'); playBtn.type = 'button'; playBtn.className = 'smg-rgc-play'; playBtn.setAttribute('aria-label', i18n('Play/Pause')); playBtn.innerHTML = ICONS.rgPlay;
        playBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggle(); });
        flash.appendChild(playBtn);
        // SCRUBBER (no topo da barra): buffer + preenchido + knob; seekável por drag
        const buf = document.createElement('div'); buf.className = 'smg-rgc-buf';
        const fill = document.createElement('div'); fill.className = 'smg-rgc-fill';
        const knob = document.createElement('div'); knob.className = 'smg-rgc-knob'; fill.appendChild(knob);
        const bar = document.createElement('div'); bar.className = 'smg-rgc-bar'; bar.append(buf, fill);
        const prog = document.createElement('div'); prog.className = 'smg-rgc-prog'; prog.appendChild(bar);
        // rect CACHEADO no pointerdown (não muda durante o drag): getBoundingClientRect por pointermove
        // forçava layout síncrono a cada move (o write do 'seeking'/fill suja o layout entre moves)
        const seekTo = (cx, r) => { if (!video.duration || !r.width) return; video.currentTime = Math.max(0, Math.min(1, (cx - r.left) / r.width)) * video.duration; };
        prog.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const r = bar.getBoundingClientRect(); seekTo(e.clientX, r); const mv = ev => seekTo(ev.clientX, r); const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); }; document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); });
        // TEMPO (atual / duração)
        const tEl = document.createElement('span'); tEl.className = 'smg-rgc-time'; tEl.textContent = '0:00';
        // PERF: escreve no text node (.data = characterData, que o observer global NÃO escuta). textContent
        // recriava o text node a cada timeupdate (~4Hz/vídeo) → mutação childList → processAll com dirtyRoots
        // vazio = FULL-SCAN do body a cada tick. Skip-if-same corta os ticks dentro do mesmo segundo.
        const syncTime = () => { const s = rgFmt(video.currentTime) + (video.duration ? ' / ' + rgFmt(video.duration) : ''); if (tEl.firstChild.data !== s) tEl.firstChild.data = s; };
        video.addEventListener('timeupdate', () => { if (video.duration) fill.style.width = (video.currentTime / video.duration * 100) + '%'; syncTime(); });
        video.addEventListener('loadedmetadata', syncTime);
        video.addEventListener('progress', () => { try { if (video.buffered.length && video.duration) buf.style.width = (video.buffered.end(video.buffered.length - 1) / video.duration * 100) + '%'; } catch (x) {} });
        // VOLUME: barra DIV (igual a de progresso, que SEMPRE renderiza — o <input range> vinha só como um PONTO).
        // Linha no canto inferior-ESQUERDO [mudo][======barra======], sempre visível no hover (sem flyout).
        const mute = mkAct(ICONS.volumeMute, 'Mute', e => { e.stopPropagation(); video.muted = !video.muted; if (!video.muted) { if (!video.volume) video.volume = 1; rgSolo(video); } syncVol(); });
        const volfill = document.createElement('div'); volfill.className = 'smg-rgc-volfill';
        const volbar = document.createElement('div'); volbar.className = 'smg-rgc-volbar'; volbar.setAttribute('role', 'slider'); volbar.setAttribute('aria-label', i18n('Volume')); volbar.appendChild(volfill);
        const syncVol = () => { mute.innerHTML = (video.muted || !video.volume) ? ICONS.volumeMute : ICONS.volume; volfill.style.width = ((video.muted ? 0 : video.volume) * 100) + '%'; };
        const setVolFromX = (cx, r) => { if (!r.width) return; const v = Math.max(0, Math.min(1, (cx - r.left) / r.width)); video.volume = v; video.muted = (v === 0); if (v > 0) rgSolo(video); syncVol(); };
        volbar.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const r = volbar.getBoundingClientRect(); setVolFromX(e.clientX, r); const mv = ev => setVolFromX(ev.clientX, r); const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); }; document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); });
        const volgrp = document.createElement('div'); volgrp.className = 'smg-rgc-vol'; volgrp.append(mute, volbar);   // volume na barra (slider expande no hover)
        // rail (2 botões): (1) abrir no NOSSO visualizador (feed) · (2) TELA CHEIA real. O "abrir EXTERNO" virou o badge da FONTE (.smg-rgc-src), canto sup-direito.
        const over = mkAct(ICONS.gallery, 'Open in viewer', e => { e.stopPropagation(); document.querySelectorAll('video.smg-rg-v').forEach(v => { try { v.pause(); } catch (x) {} }); if (video._rgFeed) { try { openMediaFeed(video._rgFeed); } catch (x) {} } });   // grid (galeria) ≠ cantos (fullscreen)
        over.classList.add('smg-rgc-over');   // escondido no feed (lá já É o visualizador) — ver CSS
        const fs = mkAct(ICONS.rgExpand, 'Fullscreen', e => { e.stopPropagation(); try { document.fullscreenElement ? document.exitFullscreen() : wrap.requestFullscreen(); } catch (x) {} });
        const dl = mkAct(ICONS.download, 'Download', e => { e.stopPropagation(); const u = video._rgUrl; if (u) smgDownload(u, rgDownloadName(u, video._rgSource)); else if (video._rgExt) window.open(video._rgExt, '_blank', 'noopener'); });
        // BARRA INFERIOR (YouTube): scrubber em cima + linha [play · volume · tempo ··· download · visualizador · tela cheia]
        const barPlay = mkAct(ICONS.rgPlay, 'Play/Pause', e => { e.stopPropagation(); toggle(); }); barPlay.classList.add('smg-rgc-barplay');   // ícone PREENCHIDO → isenta do fill:none do #smg-feed
        const bottom = document.createElement('div'); bottom.className = 'smg-rgc-bottom';
        const row = document.createElement('div'); row.className = 'smg-rgc-row';
        const leftc = document.createElement('div'); leftc.className = 'smg-rgc-left'; leftc.append(barPlay, volgrp, tEl);
        const rightc = document.createElement('div'); rightc.className = 'smg-rgc-right'; rightc.append(dl, over, fs);
        row.append(leftc, rightc);
        bottom.append(prog, row);
        // FONTE + abrir EXTERNO num só: badge clicável no canto SUP-DIREITO ("Turbo ↗"). É a marca-dágua da fonte E o "abrir no host".
        const src = document.createElement('a'); src.className = 'smg-rgc-src'; src.target = '_blank'; src.rel = 'noopener noreferrer'; src.title = i18n('Open in new tab');
        src.innerHTML = '<span class="smg-rgc-src-t">' + (video._rgSource || '') + '</span>' + ICONS.rgExternal;
        const syncSrcHref = () => { if (video._rgExt) src.href = video._rgExt; };   // redgifs já tem _rgExt aqui; turbo/saint setam logo após o build → sincroniza no hover
        syncSrcHref(); src.addEventListener('pointerenter', syncSrcHref);
        src.addEventListener('click', e => { e.stopPropagation(); if (!video._rgExt) e.preventDefault(); });   // não dispara o play/pause do player; sem _rgExt → não navega
        // estado play/pause → classe (o CSS mostra/esconde o play central)
        video.addEventListener('play', () => { wrap.classList.add('smg-rgc-playing'); playBtn.innerHTML = ICONS.rgPause; barPlay.innerHTML = ICONS.rgPause; if (!video.muted) rgSolo(video); });
        video.addEventListener('pause', () => { wrap.classList.remove('smg-rgc-playing'); playBtn.innerHTML = ICONS.rgPlay; barPlay.innerHTML = ICONS.rgPlay; });
        video.addEventListener('volumechange', syncVol);
        // LOADING ao avançar/voltar: spinner por cima SÓ no SEEK do usuário (era o pedido). NÃO usa 'waiting':
        // vídeo PAUSADO + preload=metadata (inline, autoplay off) dispara 'waiting' no load mas NUNCA 'canplay'/'playing'
        // → dava spinner ETERNO. 'seeking' NÃO dispara no load (só quando o usuário muda o currentTime). Remoção redundante p/ garantir.
        video.addEventListener('seeking', () => wrap.classList.add('smg-rg-buffering'));
        ['seeked', 'canplay', 'playing', 'loadeddata', 'pause', 'suspend', 'error', 'abort'].forEach(ev => video.addEventListener(ev, () => wrap.classList.remove('smg-rg-buffering')));
        // SKELETON: revela o player só quando o vídeo TEM frame de verdade (loadeddata/canplay). Persistente (não 'once').
        const clearSkel = () => wrap.classList.remove('smg-rg-loading', 'smg-rg-ready');   // carregou de verdade → tira skeleton E o estado "pronto". MANTÉM o aspect-ratio: a caixa fica no aspect REAL (setado no metadata/API) → revela já no tamanho certo, sem "ajustar no play"
        video.addEventListener('loadeddata', clearSkel);
        video.addEventListener('canplay', () => { clearSkel(); wrap.classList.remove('smg-rg-buffering'); });
        wrap.append(flash, sflash, bottom, src);
        syncVol(); syncTime();
    }
    function rgStart(video, preferSd) {   // preferSd: post = SD (rápido); feed = HD
        video._rgSd = !!preferSd;
        const lio = getRgLoadIO(), pio = getRgPlayIO(), fio = getRgFreeIO();
        if (lio) lio.observe(video); else rgLoad(video);   // sem IO → carrega já
        if (pio) pio.observe(video);
        if (fio) fio.observe(video);   // libera o src se o vídeo ficar muito longe da viewport (memória)
    }

    // ---- player nativo p/ um mp4 JÁ conhecido (turbo/saint via scrape): reusa rgControls + streaming direto→blob ----
    function buildNativeVideo(mp4Url, blobReferer, fallback, source) {
        const wrap = document.createElement('div'); wrap.className = 'smg-rg smg-rg-loading';   // skeleton já no build (escondido até o frame chegar)
        const video = document.createElement('video'); video.className = 'smg-rg-v';
        video.loop = true; video.muted = true; video.playsInline = true; video.preload = 'none';
        video._rgRef = blobReferer || '';                 // Referer p/ o blob (host hotlink-protected)
        if (source) video._rgSource = source;             // marca dágua da fonte (watermark no hover)
        rgLiveVideos.add(video);
        if (fallback) wrap._rgFallback = fallback;         // falha total do vídeo → volta o iframe
        video.addEventListener('loadedmetadata', () => { if (video.videoWidth && video.videoHeight) wrap.style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight; }, { once: true });
        wrap.appendChild(video);
        rgControls(wrap, video);
        return { wrap, video };
    }
    function rgLoadUrl(video, url, wrap) {   // = rgLoad, mas com a URL pronta (sem a API do redgifs)
        if (!video || video.dataset.rgLoaded) return;
        video.dataset.rgLoaded = '1';
        if (wrap) wrap.classList.add('smg-rg-loading');
        if (rgDirect[rgHost(url)] === false) {   // host conhecido-blob
            if (deferBlob(video, url, wrap)) return;   // inline autoplay-off → adia o blob pro play
            return rgViaBlob(video, url, wrap);
        }
        return rgViaDirect(video, url, wrap);
    }
    function rgStartUrl(video, url, wrap) {   // toca quando visível + carrega já (na fila, máx 3, junto do redgifs)
        const pio = getRgPlayIO(); if (pio) pio.observe(video);
        rgEnqueue(() => rgLoadUrl(video, url, wrap));
    }
    // PREPARO p/ URL conhecida (turbo): mostra o poster + estado PRONTO, SEM baixar nenhum byte de vídeo. O stream
    // acontece só no PLAY (toggle → rgLoadUrl). Igual ao player do turbo (preload=none + poster) → first-paint
    // instantâneo e zero contenção de banda no feed (antes: rgStartUrl baixava metadata de CADA turbo adiantado).
    function rgPrepareUrl(video, url, wrap, poster) {
        video._rgUrl = url;
        if (poster) {
            video.poster = poster;
            const im = new Image();   // pré-carrega o poster (warm cache) E pega as dimensões → seta o aspect-ratio da caixa (sem isso a caixa colapsa: turbo não tem dims na API)
            im.onload = () => { if (im.naturalWidth && im.naturalHeight && wrap) wrap.style.aspectRatio = im.naturalWidth + ' / ' + im.naturalHeight; };
            im.src = poster;
        }
        if (wrap) { wrap.classList.remove('smg-rg-loading'); wrap.classList.add('smg-rg-ready'); }
        const pio = getRgPlayIO(); if (pio) pio.observe(video);   // pausa ao sair da viewport (se o usuário tiver dado play)
    }

    // libera o slot do turbo/saint do aspect 16:9 + overflow:hidden quando montamos NOSSO player dentro dele.
    // INLINE (setProperty important) de propósito: à prova de :has não-aplicado/cascata → vídeo vertical NUNCA é cortado.
    function fillSlot(slot) {
        if (!slot) return;
        slot.classList.add('smg-turbo-slot--filled');
        slot.style.setProperty('aspect-ratio', 'auto', 'important');
        slot.style.setProperty('overflow', 'visible', 'important');
    }
    // desfaz o fillSlot: volta o slot ao 16:9. Necessário se o player nativo MONTOU e depois FALHOU (cai pro iframe):
    // o iframe é position:absolute → precisa do slot com altura (16:9), senão colapsa (altura 0) e some.
    function unfillSlot(slot) {
        if (!slot) return;
        slot.classList.remove('smg-turbo-slot--filled');
        slot.style.removeProperty('aspect-ratio');
        slot.style.removeProperty('overflow');
    }

    // o embed do turbo é um PLAYER JS que pega o vídeo via /api/sign — então NÃO baixamos a página-player (25KB = o "2º player"
    // desnecessário, já que o nosso é o player). Resolvemos DIRETO pela API (só precisa do id + Referer). Bem mais rápido.
    // poster do turbo/saint a partir do mp4 resolvido (dl*.turbocdn.st/data/{id}.mp4 → cdn.turbo.cr/thumbs/{id}.jpg). Sem request extra.
    function turboPoster(mp4) { const m = (mp4 || '').match(/\/data\/([^/?#.]+)\.[a-z0-9]+/i); return m ? 'https://cdn.turbo.cr/thumbs/' + m[1] + '.jpg' : ''; }
    function turboResolve(embedUrl, cb) {
        const id = (embedUrl.match(/\/embed\/([^/?#]+)/) || [])[1] || '';
        if (!GMX || !id) { cb(null); return; }
        turboApi(id, embedUrl, cb);
    }
    // pega a URL do vídeo pela API do turbo: GET /api/sign?v={id} → { success, url } (mp4/mov assinado em dl*.turbocdn.st, com exp/token)
    function turboApi(id, embedUrl, cb) {
        if (!GMX || !id) { cb(null); return; }
        GMX({ method: 'GET', url: 'https://turbo.cr/api/sign?v=' + encodeURIComponent(id), timeout: 12000,
            headers: { Referer: embedUrl, 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json, text/plain, */*' },
            onload: r => {
                const t = r.responseText || '';
                let url = null;
                try { url = turboUrlFromJson(JSON.parse(t)); } catch (e) { const m = t.match(/https?:[^"'\s\\]+\.(?:mp4|mov|webm|m3u8)[^"'\s\\]*/i); if (m) url = m[0].replace(/\\\//g, '/'); }
                if (url && /\.m3u8(\?|$)/i.test(url)) { console.warn('[smg-turbo] HLS (.m3u8) precisa de hls.js → iframe:', id); cb(null); return; }
                cb(url || null);
            },
            onerror: () => { cb(null); },
            ontimeout: () => { cb(null); } });
    }
    function turboUrlFromJson(j) {   // procura a URL do vídeo em formatos comuns de resposta
        if (!j) return null;
        if (typeof j === 'string') return /\.(mp4|m3u8)/i.test(j) ? j : null;
        const direct = j.url || j.file || j.src || j.video || j.source || j.link || (j.data && (j.data.url || j.data.file || j.data.src || j.data.video));
        if (direct && typeof direct === 'string') return direct;
        if (Array.isArray(j) && j.length) return turboUrlFromJson(j[0]);
        if (Array.isArray(j.sources) && j.sources.length) return turboUrlFromJson(j.sources[0]);
        if (Array.isArray(j.files) && j.files.length) return turboUrlFromJson(j.files[0]);
        const m = JSON.stringify(j).match(/https?:[^"'\s\\]+\.(?:mp4|m3u8)[^"'\s\\]*/i);   // varredura geral
        return m ? m[0].replace(/\\\//g, '/') : null;
    }

    // SIMP: o turbo já vem como IFRAME nativo (.generic2wide-iframe-div > iframe[src*=turbo], NÃO como link) → troca pelo nosso player.
    // (o nosso fallback é .generic2wide-iframe-div > .smg-turbo-slot > iframe, ou seja NETO — o seletor `>` direto só pega o nativo.)
    function processTurboNativeEmbeds(roots) {
        if (!(FEATURES.turboNativePlayer && GMX)) return;
        eachIn(roots, '.generic2wide-iframe-div > iframe[src*="turbo.cr/embed/"]:not([data-tb-done])', ifr => {
            ifr.dataset.tbDone = '1';
            const id = (ifr.getAttribute('src').match(/\/embed\/([^/?#]+)/) || [])[1];
            const div = ifr.parentElement;
            if (!id || !div || div.querySelector('.smg-rg, .smg-turbo-slot')) return;   // já temos player/slot aqui
            // DEDUP cross-pass: o processTurboLinks (link → nosso wrapper) já montou esse MESMO turbo nesse corpo?
            // (no SMG o XF às vezes emite o turbo como LINK + iframe nativo p/ o mesmo id → dava 2 players).
            const body = div.closest('.message-userContent, .comment-body') || div.closest('.bbWrapper');
            if (body && body.querySelector('[data-tb-id="' + id + '"]')) { ifr.remove(); return; }   // já tem o nosso → só mata o iframe velho
            div.dataset.tbId = id;   // reconcilia: o link pass pula se ver esse id
            const embedUrl = 'https://turbo.cr/embed/' + id;
            // PARA O PLAYER VELHO JÁ: detacha o iframe nativo (mata rede/áudio do turbo antigo) e põe spinner no lugar.
            // Sem isto o iframe ficava CARREGANDO/TOCANDO durante todo o scrape async = "old turbo carrega primeiro, depois o nosso".
            const slot = document.createElement('div'); slot.className = 'smg-turbo-slot';
            const loading = document.createElement('div'); loading.className = 'smg-loading';
            slot.appendChild(loading);
            div.insertBefore(slot, ifr);
            ifr.remove();
            const restoreIframe = () => { if (slot.querySelector('iframe')) return; unfillSlot(slot); loading.remove(); ifr.classList.add('saint-iframe'); ifr.removeAttribute('style'); slot.appendChild(ifr); };   // iframe nativo PREENCHE o slot 16:9 (saint-iframe + tira o style inline height:360px que quebrava na coluna)
            turboResolve(embedUrl, mp4 => {
                if (div.querySelector('.smg-rg')) return;
                if (!mp4) { restoreIframe(); return; }            // sem url → volta o iframe nativo
                const { wrap, video } = buildNativeVideo(mp4, 'https://turbo.cr/', restoreIframe, 'Turbo');
                video._rgExt = embedUrl; video._rgFeed = embedUrl;
                loading.remove();
                slot.appendChild(wrap);
                fillSlot(slot);   // solta o 16:9/overflow do slot → não corta vídeo vertical
                rgPrepareUrl(video, mp4, wrap, turboPoster(mp4));   // poster + pronto; stream só no play
            });
        });
    }

    // SMG: imagepond vem como IFRAME nativo (iframe[src*=imagepond.net/videos/{id}], solto no .bbWrapper) → troca pelo nosso player.
    // O mp4 (referer-locked à ORIGEM do fórum: 403 sem Referer, 206 com) sai do scrape da página /videos/{id} (a id do iframe
    // não mapeia direto pro nome do arquivo). Tocamos DIRETO (streaming, referer preservado via _rgKeepRef), blob como rede de segurança.
    function imagepondPoster(mp4) { return (mp4 || '').replace(/\.(?:mp4|mov|m4v|webm)(\?.*)?$/i, '_thumb.jpg'); }   // media/videos/{nome}.{ext} → {nome}_thumb.jpg (não é referer-locked)
    // → { mp4, img }: a página /videos/{id} do imagepond pode ser VÍDEO ou IMAGEM. O ARQUIVO de vídeo (media.imagepond.net/media/videos/…)
    // NÃO está no HTML estático da /videos/{id} (carrega por JS) — ele aparece na página /i/{slug} que a /videos/ LINKA. Então: tenta achar
    // a mídia direta nesta página; se não, segue UMA vez pro link /i/ e procura lá. `mp4` pode ser .mp4/.mov/.m4v/.webm (o player nativo toca todos).
    function imagepondResolve(pageUrl, cb) {
        if (!GMX || !pageUrl) { cb(null); return; }
        const VEXT = '(?:mp4|mov|m4v|webm)';
        const grabVid = t => {
            let m = t.match(new RegExp('<source[^>]+src=["\']([^"\']+\\.' + VEXT + '[^"\']*)["\']', 'i'));   // <source> direto (não HLS .m3u8)
            let v = m ? m[1] : null;
            if (!v) { const g = t.match(new RegExp('https?://[^"\'\\s)]*media\\.imagepond\\.net/media/videos/[^"\'\\s)]+\\.' + VEXT + '[^"\'\\s)]*', 'i')); v = g ? g[0] : null; }
            return v ? v.replace(/&amp;/g, '&') : null;
        };
        const grabImg = t => {   // imagem de CONTEÚDO (/media/images/) EXCLUINDO ícones do site (android-chrome/favicon/apple-touch/mstile/logo)
            const re = /https?:\/\/[^"'\s)]*media\.imagepond\.net\/media\/images\/[^"'\s)]+\.(?:jpe?g|png|webp|gif|avif)[^"'\s)]*/ig;
            for (let mm; (mm = re.exec(t));) { if (!/android-chrome|apple-touch-icon|favicon|mstile|safari-pinned-tab|site[-_]?icon|app[-_]?icon|(?:^|[/_-])logo(?:[/_.-]|$)/i.test(mm[0])) return mm[0].replace(/&amp;/g, '&'); }
            return null;
        };
        GMX({ method: 'GET', url: pageUrl, timeout: 12000,
            headers: { Referer: location.origin + '/', Accept: 'text/html,application/xhtml+xml,*/*' },
            onload: r => {
                const t = r.responseText || '';
                const vid = grabVid(t);
                if (vid) { cb({ mp4: vid, img: null }); return; }
                const img = grabImg(t);
                if (img) { cb({ mp4: null, img }); return; }
                // /videos/{id}: o arquivo mora na página /i/{slug} (linkada aqui). Segue UMA vez (não a partir de uma /i/, evita loop), pulando o /i/{id}/download.
                if (!/\/i\//.test(pageUrl)) {
                    const re = /https?:\/\/[^"'\s)]*imagepond\.net\/i\/[^"'\s)]+/ig;
                    for (let mm; (mm = re.exec(t));) { const u = mm[0].replace(/&amp;/g, '&'); if (!/\/download\b/i.test(u)) { imagepondResolve(u, cb); return; } }
                }
                cb(null);
            },
            onerror: () => cb(null), ontimeout: () => cb(null) });
    }
    function processImagepondNativeEmbeds(roots) {
        if (!(FEATURES.imagepondEmbeds && GMX)) return;
        eachIn(roots, 'iframe[src*="imagepond.net/videos/"]:not([data-ip-done]), iframe[src*="imagepond.net/video/"]:not([data-ip-done])', ifr => {
            ifr.dataset.ipDone = '1';
            if (ifr.closest('.smg-rg')) return;   // já é o iframe de fallback que NÓS montamos
            const pageUrl = ifr.getAttribute('src') || '';
            const id = (pageUrl.match(/\/videos?\/([^/?#]+)/) || [])[1];
            if (!id) return;
            // PARA O PLAYER VELHO JÁ: detacha o iframe nativo (mata rede/áudio do imagepond) e põe spinner no lugar.
            const wrapper = document.createElement('div'); wrapper.className = 'generic2wide-iframe-div'; wrapper.dataset.ipId = id;
            const slot = document.createElement('div'); slot.className = 'smg-turbo-slot';
            const loading = document.createElement('div'); loading.className = 'smg-loading';
            slot.appendChild(loading);
            wrapper.appendChild(slot);
            ifr.replaceWith(wrapper);
            const restoreIframe = () => { if (slot.querySelector('iframe')) return; unfillSlot(slot); loading.remove(); ifr.classList.add('saint-iframe'); ifr.removeAttribute('style'); slot.appendChild(ifr); };   // falha total → iframe nativo PREENCHENDO o slot 16:9 (saint-iframe + tira o style inline height:360px que quebrava na coluna)
            const activate = () => {
                if (slot.dataset.ipActivated) return;   // run-once (turboIO E o masonry podem chamar)
                slot.dataset.ipActivated = '1'; slot._smgActivate = null;
                imagepondResolve(pageUrl, res => {
                    if (wrapper.querySelector('.smg-rg')) return;
                    if (res && res.mp4) {                                   // VÍDEO → nosso player
                        const { wrap, video } = buildNativeVideo(res.mp4, location.origin + '/', restoreIframe, 'ImagePond');
                        video._rgKeepRef = 'origin';                        // mp4 referer-locked → streaming direto PRESERVANDO o referer (senão 403); blob (com _rgRef) é o backup
                        video._rgExt = pageUrl; video._rgFeed = pageUrl;
                        loading.remove();
                        slot.appendChild(wrap);
                        fillSlot(slot);                                    // solta o 16:9/overflow do slot → não corta vídeo vertical
                        rgPrepareUrl(video, res.mp4, wrap, imagepondPoster(res.mp4));   // poster + pronto; stream só no play
                        return;
                    }
                    if (res && res.img) {                                   // IMAGEM (o /videos/ do imagepond às vezes é foto) → troca o embed por <img> (entra no pipeline de img + masonry)
                        const a = document.createElement('a'); a.href = res.img; a.target = '_blank'; a.rel = 'noopener noreferrer';
                        const img = document.createElement('img'); img.className = 'bbImage'; img.src = res.img; img.loading = 'lazy'; img.alt = ''; img.dataset.smgLink = pageUrl;
                        a.appendChild(img);
                        wrapper.replaceWith(a);
                        scheduleRun();
                        return;
                    }
                    restoreIframe();                                        // sem mp4 nem img → iframe nativo
                });
            };
            const io = FEATURES.lazyEmbeds ? getTurboIO() : null;
            if (io) { slot._smgActivate = activate; io.observe(slot); } else activate();
        });
        // LINK direto do imagepond: <a href="imagepond.net/video/{numId}.{hash}"><div>media.imagepond.net/media/{numId}.mp4</div></a>
        // o mp4 vem no texto (ou é derivável do href) e NÃO é referer-locked → toca direto. Vira nosso player no lugar do link.
        eachIn(roots, 'a[href*="imagepond.net/video/"]:not([data-ip-done])', link => {
            link.dataset.ipDone = '1';
            if (link.closest('.smg-rg, .smg-turbo-slot')) return;
            const href = link.getAttribute('href') || '';
            let mp4 = (link.textContent.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i) || [])[0];
            if (!mp4) { const m = href.match(/\/video\/(\d+)/); if (m) mp4 = 'https://media.imagepond.net/media/' + m[1] + '.mp4'; }
            if (!mp4) return;
            const wrapper = document.createElement('div'); wrapper.className = 'generic2wide-iframe-div';
            const slot = document.createElement('div'); slot.className = 'smg-turbo-slot';
            wrapper.appendChild(slot);
            link.replaceWith(wrapper);
            const { wrap, video } = buildNativeVideo(mp4, location.origin + '/', null, 'ImagePond');
            video._rgExt = href || mp4;
            slot.appendChild(wrap);
            fillSlot(slot);
            rgPrepareUrl(video, mp4, wrap, imagepondPoster(mp4));   // poster = {id}_thumb.jpg (mesmo padrão do /videos/; não é referer-locked)
        });
    }

    // esconde o placeholder nativo ("Click here to load redgifs media" / botão de expand) ao montar o player num .generic2wide-iframe-div (Simp)
    // ⚠️ setProperty(...,'important'): a CSS tem `span[data-s9e-mediaembed=redgifs]{display:block !important}` → display:none inline NÃO vence sem o !important.
    function rgHidePlaceholder(wrap) {
        const div = wrap.closest('.generic2wide-iframe-div');
        if (div) Array.from(div.children).forEach(c => { if (!c.classList.contains('smg-rg')) c.style.setProperty('display', 'none', 'important'); });
    }

    function applyRedgifsPlayer(roots) {
        if (!GMX) return;   // sem GM_xmlhttpRequest não dá pra furar o CORS da API → deixa o iframe nativo (autoLoadRedgifs cuida)
        // 1) LOADER ainda sem iframe → monta direto pelo id do onclick (não chega a baixar o iframe nativo)
        eachIn(roots, 'div.generic2wide-iframe-div[onclick*="redgifs"]:not([data-rg-done])', div => {
            // já virou iframe → o caso 2 assume. MARCA: sem isso o div ficava no loop (re-checado todo
            // full-scan) e, depois que o caso 2 trocava o iframe pelo player, voltava aqui SEM iframe e
            // montava um SEGUNDO player pelo onclick remanescente (vídeo duplicado).
            if (div.querySelector('iframe')) { div.dataset.rgDone = '1'; return; }
            const id = rgIdFrom(div.getAttribute('onclick') || '');
            if (!id) return;
            div.dataset.rgDone = '1';
            div.dataset.redgifsAutoloaded = 'true';   // autoLoadRedgifs não clica mais nele
            div.removeAttribute('onclick');            // mata o loadMedia nativo (clique no nosso player não injeta iframe duplicado)
            const { wrap, video } = rgBuild(id);
            wrap._rgLoader = div;
            div.appendChild(wrap);
            rgHidePlaceholder(wrap);   // esconde o placeholder nativo ("Click here to load…") — Simp
            rgStart(video, true);   // post = SD
        });
        // 2) IFRAME de redgifs (s9e OU já injetado) → troca por <video>, REMOVE o iframe (restaura na falha).
        // ⚠️ REMOVE, não esconde: iframe com display:none CONTINUA TOCANDO (o áudio do "duplicado" que tocava 20s).
        eachIn(roots, 'iframe[src*="redgifs.com"]:not([data-rg-done]), iframe[data-src*="redgifs.com"]:not([data-rg-done])', ifr => {
            ifr.dataset.rgDone = '1';
            if (ifr.closest('.smg-rg')) return;   // é o iframe de fallback que NÓS montamos → não mexer
            // ANTI-DUP: já existe player nesse embed (loader assumido no caso 1, ou 2ª injeção do site) → REMOVE o iframe (parar áudio), sem 2º player
            const box = ifr.closest('span[data-s9e-mediaembed], .generic2wide-iframe-div') || ifr.parentNode;
            if (box && box.querySelector('.smg-rg')) { ifr.remove(); return; }
            const id = rgIdFrom(ifr.getAttribute('src') || ifr.getAttribute('data-src') || '');
            if (!id) return;
            const { wrap, video } = rgBuild(id);
            wrap._rgIframe = ifr;
            ifr.parentNode.insertBefore(wrap, ifr);   // wrap entra no lugar do iframe
            ifr.remove();                              // mata o iframe (e o áudio) — guardado em wrap._rgIframe p/ restaurar na falha
            rgHidePlaceholder(wrap);   // Simp: se o site auto-carregou o redgifs como iframe DENTRO do .generic2wide-iframe-div, esconde o placeholder ("Click here to load…")
            rgStart(video, true);   // post = SD
        });
        // 3) CATCH-ALL (Simp): assim que um .generic2wide-iframe-div ganha nosso player/fail, esconde o placeholder nativo
        //    ("Click here to load redgifs media"), seja qual for a estrutura/timing. MARCA O DIV (não o placeholder):
        //    antes o seletor varria TODO span[data-s9e-mediaembed] do doc a cada frame e nunca marcava os sem player (leak).
        //    Agora só os divs SEM player ainda (conjunto pequeno) são re-checados; o div com player é marcado e sai do loop.
        eachIn(roots, '.generic2wide-iframe-div:not([data-rg-ph])', div => {
            if (!div.querySelector('.smg-rg, .smg-rg-fail')) {
                // div SEM traço de redgifs (turbo/saint/iframe-fallback) nunca vai ganhar este placeholder →
                // marca e sai do loop. Antes ficava re-checado em TODO full-scan pra sempre (centenas de
                // querySelector à toa em thread grande). Só continua re-checando quem é redgifs pendente.
                if (!/redgifs/i.test(div.getAttribute('onclick') || '') && !div.querySelector('span[data-s9e-mediaembed="redgifs"], .iframe-wrapper-redgifs, iframe[src*="redgifs"], iframe[data-src*="redgifs"]')) div.dataset.rgPh = '1';
                return;   // redgifs ainda sem player → re-checa no próximo frame (não marca)
            }
            div.dataset.rgPh = '1';
            div.querySelectorAll('span[data-s9e-mediaembed], .iframe-wrapper-redgifs').forEach(ph => {
                if (!ph.querySelector('.smg-rg, .smg-rg-fail')) ph.style.setProperty('display', 'none', 'important');   // !important vence a CSS `display:block !important` do s9e
            });
        });
    }
