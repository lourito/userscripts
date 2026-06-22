// ==UserScript==
// @name         Instagram — Native Video Controls & Mosaic Feed
// @namespace    instagram-native-player
// @version      3.11.3
// @updateURL    https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/instagram.user.js
// @downloadURL  https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/instagram.user.js
// @description  Camada aditiva sobre a interface do Instagram. (1) Player de vídeo integrado (feed, reels, explore, stories): progresso scrubável, play/pause, mudo+volume, velocidade, PiP, fullscreen e atalhos — SEMPRE ligado. (2) Feed da home em MASONRY com DOM próprio (OPCIONAL, off por padrão): lê os posts da lista nativa (harvest) e renderiza cards nossos em multicolunas estáveis (altura reservada por aspect-ratio), stories alinhadas, right rail escondida e nav esquerdo fixo. v3.0: TODAS as funcionalidades (menos o player) viram FLAGS num painel de ajustes flutuante (mesmo modelo do reddit/twitter: FAB de engrenagem no canto inferior-direito → painel com toggles/sliders agrupados). v3.1+: polish visual do mosaico — paleta própria (PRETO premium no escuro com texto mais legível; claro no light, detectado por luminância do fundo), cards com hover (eleva + zoom da mídia), tray de stories emoldurada, skeleton neutro. Colunas (Auto/2/3/4), densidade, sombra/legenda/contadores são FLAGS no painel. Galeria navega por scroll horizontal do mouse/trackpad. Em STORIES o player vira só a barra de progresso (scrub) — o post original fica intacto (nada de subir o reply). v3.5: o MESMO mosaico (proporção real) também no /explore/ e nos perfis (/usuario/) — tiles só-mídia, reels com preview no hover, clique abre em modal; flags Grid no Explore / Grid no perfil / Grid nos salvos (off por padrão; EXPLORE e SALVOS usam o MESMO card da home (header + barra de ação like/comentar/compartilhar/salvar + legenda), clicar abre modal; perfil segue como tile só-mídia. Salvos: o "salvar" vira REMOVER, + MULTISSELEÇÃO no header pra remover/mover vários pra coleção de uma vez. Ações do grid via API (like/save). v3.6: largura/colunas/densidade viram ajustes de CONTEÚDO que valem pra home, explore E perfil (a coluna toda do perfil acompanha a largura); thumbnails dos tiles usam a versão pequena da API (carregam bem mais rápido). Prefs em localStorage.
// @author       claudiogepeto
// @match        https://www.instagram.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==
(function () {
    "use strict";

    if (window.top !== window.self) return;   // ignora iframes embutidos

    /* ==================================================================== *
     * FILOSOFIA — só ADICIONO, nunca escondo/movo elemento do Instagram.
     *   • Trilha fina sempre visível no rodapé do vídeo = "player integrado".
     *   • Fileira de botões só no hover, num gradiente curto.
     *   • pointer-events:none no container; auto só nos widgets → todo o
     *     resto da overlay do IG (like/coment/legenda/áudio/tap-pra-pausar)
     *     continua clicável e visível. Diferente do script de referência,
     *     que faz opacity:0 + reposiciona os botões nativos.
     *
     * GUARDS (perf) — observer DEBOUNCED + WeakSet por nó + poda por
     *   isConnected; sem polling permanente. AbortController por vídeo limpa
     *   todos os listeners de uma vez no destroy.
     * ==================================================================== */

    /* ------------------------------------------------------------------ *
     * Config / defaults (persistidos em localStorage)
     * ------------------------------------------------------------------ */
    const PREFS_KEY = "igvc:prefs";
    const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
    const SEEK = 5;            // segundos por seek (J/L/setas)
    const VOL_STEP = 0.05;     // passo de volume (setas ↑/↓)
    const HIDE_DELAY = 1600;   // ms até esconder a fileira após o cursor parar
    const MIN_SIZE = 80;       // px — ignora vídeos minúsculos/sem layout

    // Painel de ajustes — MESMO modelo do reddit/twitter: GROUPS (source of truth) → FAB + painel
    // flutuante de toggles/sliders. Cada item vira uma flag em `prefs`. O PLAYER de vídeo não é flag
    // (sempre ligado); volume/speed seguem como estado vivo do player (ajustados pelos controles, fora
    // do painel). `dep` esmaece o item quando a flag-pai está off; `hint` vira a linha de descrição.
    const GROUPS = [
        { title: "Feed (home)", items: [
            { key: "masonry",   label: "Feed em mosaico",        hint: "Troca o feed da home por cards em multicolunas (masonry). Off = feed nativo do IG.", def: false },
            { key: "hideRail",  label: "Esconder coluna direita", hint: "Remove a barra lateral direita (perfil/sugestões/rodapé) no feed em mosaico.", def: true, dep: "masonry" },
            { key: "pinNav",    label: "Fixar menu lateral",      hint: "Trava a largura do menu esquerdo (sem expandir no hover).", def: true, dep: "masonry" },
            { key: "showCaption", label: "Mostrar legenda",       hint: "Exibe a legenda (até 2 linhas) abaixo de cada card. (só home)", def: true, dep: "masonry" },
            { key: "showCounts",  label: "Mostrar contadores",    hint: "Exibe curtidas/comentários/reposts na barra de ações. (só home)", def: true, dep: "masonry" },
        ] },
        { title: "Grid (Explore / Perfil / Salvos)", items: [
            { key: "gridExplore", label: "Grid no Explore", hint: "Troca a grade quadrada do /explore/ por um mosaico em proporção REAL (tiles só-mídia, clicar abre em modal).", def: false },
            { key: "gridProfile", label: "Grid no perfil",  hint: "Mesmo mosaico na grade de posts dos perfis (/usuario/). Off = grade quadrada nativa.", def: false },
            { key: "gridSaved",   label: "Grid nos salvos", hint: "Mosaico na página de Salvos (/usuario/saved/), com barra de ação em cada tile pra REMOVER dos salvos direto. Também liga junto com 'Grid no perfil'.", def: false },
        ] },
        { title: "Mosaico — largura · colunas · densidade", items: [   // valem p/ TODAS as superfícies (home + explore + perfil)
            { key: "feedWidth", label: "Largura do conteúdo",     hint: "Largura máxima do bloco de conteúdo — vale pra home, explore E perfil.", type: "slider", min: 960, max: 1840, def: 1320, unit: "px", step: 20 },
            { key: "cols",      label: "Colunas",                 hint: "Nº de colunas do mosaico (Auto se adapta à largura). 3 é o recomendado; 4 carrega muito mais mídia por tela e pode causar lentidão.", type: "select", def: "auto",
              options: [{ value: "auto", label: "Auto" }, { value: "2", label: "2" }, { value: "3", label: "3 (Recomendado)" }, { value: "4", label: "4 (pode travar)" }] },
            { key: "density",   label: "Densidade",               hint: "Compacto = colunas mais estreitas, menos respiro, mais itens na tela.", type: "select", def: "comfortable",
              options: [{ value: "comfortable", label: "Confortável" }, { value: "compact", label: "Compacto" }] },
            { key: "cardShadow",  label: "Sombra nos cards",      hint: "Eleva os cards/tiles com sombra (resting + realce no hover). Off = só borda.", def: true },
        ] },
        { title: "Vídeo", items: [
            { key: "autoUnmute", label: "Auto-desmutar vídeos", hint: "Tira o mudo dos vídeos novos automaticamente (o player respeita seu mute manual).", def: false },
            { key: "stories",    label: "Player nos stories",   hint: "Mostra a barra do player (no hover) também em /stories/.", def: true },
            { key: "keyboard",   label: "Atalhos de teclado",   hint: "Espaço/K play, J/L e setas seek, M mudo, F tela cheia, ,/. frame, [ ] velocidade…", def: true },
        ] },
        { title: "Interface", items: [
            { key: "hideMessages", label: "Esconder dock de mensagens", hint: "Remove o balão flutuante de Mensagens no canto inferior.", def: false },
            { key: "backToTop",    label: "Botão voltar ao topo",       hint: "Mostra um botão pra rolar ao topo quando você desce a página.", def: false },
        ] },
    ];
    const ITEMS = GROUPS.flatMap((g) => g.items);
    const DEFAULTS = Object.assign(
        { volume: 0.6, speed: 1 },   // estado vivo do player (não exposto no painel)
        Object.fromEntries(ITEMS.map((i) => [i.key, i.def])),
    );

    let prefs = loadPrefs();
    function loadPrefs() {
        try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(PREFS_KEY) || "{}")); }
        catch { return Object.assign({}, DEFAULTS); }
    }
    function savePrefs() {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* quota/priv */ }
    }
    const savePrefsSoon = debounce(savePrefs, 400);

    /* ------------------------------------------------------------------ *
     * Helpers
     * ------------------------------------------------------------------ */
    function addStyle(css) {
        if (typeof GM_addStyle === "function") return GM_addStyle(css);
        const s = document.createElement("style");
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
        return s;
    }
    function debounce(fn, ms) {
        let t;
        return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
    }
    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
    const isHover = (n) => { try { return n.matches(":hover"); } catch { return false; } };

    // Builder de DOM mínimo. props: class/html/style(obj)/on<Event>/attr.
    function el(tag, props, ...kids) {
        const n = document.createElement(tag);
        if (props) for (const [k, v] of Object.entries(props)) {
            if (v == null) continue;
            if (k === "class") n.className = v;
            else if (k === "html") n.innerHTML = v;
            else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
            else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
            else n.setAttribute(k, v);
        }
        for (const kid of kids) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
        return n;
    }

    /* ================================================================== *
     * Captura de mídia da API do IG (fetch + XHR + JSON inline).
     *   Os <video> do feed são blob:/MSE — NÃO dá pra reusar de forma
     *   confiável (o IG vira a MediaSource ao virtualizar → preto). Mas a
     *   API entrega as URLs .mp4 REAIS em `video_versions[]`. Eu capturo-as
     *   por `code` (shortcode) e toco MEU PRÓPRIO <video src=mp4> → robusto,
     *   recriável a cada hover, sem emprestar nada do IG.
     * ================================================================== */
    const igMedia = new Map();              // code -> { isVideo, videoUrl, imageUrl, w, h, author, avatar, caption, likes, comments, pk }
    let igAppId = "936619743392459";        // X-IG-App-ID do web (default; atualizado pelo interceptor) — p/ o unsave direto
    function fmtCountNum(n) {
        if (n == null || n === "" || isNaN(n)) return "";
        n = +n;
        if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, "") + "M";
        if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 ? 1 : 0).replace(/\.0$/, "") + "K";
        return String(n);
    }
    function smallestVideo(vs) {            // menor resolução disponível = preview leve (menos travamento)
        let best = null;
        for (const v of vs) if (v && v.url && (!best || (v.width || 0) < (best.width || 1e9))) best = v;
        return best ? best.url : "";
    }
    function pickImage(cand) {              // candidato ~médio (nem o maior, nem o menor)
        if (!cand || !cand.length) return "";
        const s = cand.slice().sort((a, b) => (b.width || 0) - (a.width || 0));
        return (s[Math.min(1, s.length - 1)] || s[0]).url || "";
    }
    function pickThumb(cand) {              // THUMBNAIL leve p/ os tiles do grid: o MENOR candidato ainda nítido (≥360px) → carrega rápido
        if (!cand || !cand.length) return "";
        const s = cand.slice().sort((a, b) => (a.width || 0) - (b.width || 0));   // asc
        return (s.find((c) => (c.width || 0) >= 360) || s[s.length - 1]).url || "";
    }
    function ingestNode(m) {                // normaliza UM item de mídia da API → igMedia[code]
        if (!m || typeof m !== "object" || !m.code) return;
        const hasV = !!(m.video_versions && m.video_versions.length);
        let imageUrl = pickImage(m.image_versions2 && m.image_versions2.candidates);
        let thumbUrl = pickThumb(m.image_versions2 && m.image_versions2.candidates);
        let w = m.original_width || 0, h = m.original_height || 0;
        let isVideo = hasV, videoUrl = hasV ? smallestVideo(m.video_versions) : "";
        let carousel = null;
        if (m.carousel_media && m.carousel_media.length) {     // carrossel: guardo TODOS os slides p/ navegar (setas)
            carousel = m.carousel_media.map((c) => {
                const cv = !!(c.video_versions && c.video_versions.length);
                return {
                    isVideo: cv, videoUrl: cv ? smallestVideo(c.video_versions) : "",
                    imageUrl: pickImage(c.image_versions2 && c.image_versions2.candidates),
                    thumbUrl: pickThumb(c.image_versions2 && c.image_versions2.candidates),
                    w: c.original_width || 0, h: c.original_height || 0,
                };
            });
            const f = m.carousel_media[0];                     // capa = 1º slide (o card não auto-toca; quem toca é o slide)
            if (!imageUrl) imageUrl = pickImage(f.image_versions2 && f.image_versions2.candidates);
            if (!thumbUrl) thumbUrl = pickThumb(f.image_versions2 && f.image_versions2.candidates);
            if (!w && f.original_width) { w = f.original_width; h = f.original_height; }
            isVideo = false; videoUrl = "";
        }
        if (!imageUrl && !videoUrl) return;
        const prev = igMedia.get(m.code) || {};
        igMedia.set(m.code, {
            isVideo: isVideo || prev.isVideo, videoUrl: videoUrl || prev.videoUrl || "", imageUrl: imageUrl || prev.imageUrl || "",
            thumbUrl: thumbUrl || prev.thumbUrl || "",
            pk: (m.pk || (m.id && String(m.id).split("_")[0])) || prev.pk || "",   // media pk → unsave/like/save via API
            authorPk: (m.user && m.user.pk) || prev.authorPk || "",                // user pk → follow via API
            following: (m.user && m.user.friendship_status) ? !!m.user.friendship_status.following : prev.following,   // já segue? (se a API trouxer)
            carousel: carousel || prev.carousel || null,
            w: w || prev.w || 0, h: h || prev.h || 0,
            author: (m.user && m.user.username) || prev.author || "",
            avatar: (m.user && m.user.profile_pic_url) || prev.avatar || "",
            caption: (m.caption && (m.caption.text || (typeof m.caption === "string" ? m.caption : ""))) || prev.caption || "",
            likes: fmtCountNum(m.like_count) || prev.likes || "",
            comments: fmtCountNum(m.comment_count) || prev.comments || "",
        });
    }
    const igCollections = new Map();        // collection_id -> collection_name (capturadas do tráfego do IG)
    function walkForMedia(node, depth) {    // varre o JSON inteiro atrás de itens de mídia (schema aninhado/variável)
        if (!node || typeof node !== "object" || depth > 12) return;
        if (Array.isArray(node)) { for (const x of node) walkForMedia(x, depth + 1); return; }
        if (node.code && (node.video_versions || node.image_versions2 || node.carousel_media)) ingestNode(node);
        if (node.collection_id && node.collection_name) igCollections.set(String(node.collection_id), String(node.collection_name));   // coleções de salvos
        for (const k in node) { const v = node[k]; if (v && typeof v === "object") walkForMedia(v, depth + 1); }
    }
    function ingestText(text) {
        if (!text || text.length < 40 || (text.indexOf("video_versions") < 0 && text.indexOf("image_versions2") < 0 && text.indexOf("collection_id") < 0)) return;
        let j; try { j = JSON.parse(text); } catch (_) { return; }
        try { walkForMedia(j, 0); } catch (_) { /**/ }
        try { queueMetaUpdate(); } catch (_) { /**/ }   // igMedia atualizou → preenche header/legenda dos cards já renderizados
    }
    // PERF: respostas interceptadas chegam no MEIO do scroll (paginação) — o 2º JSON.parse (centenas de KB)
    // + walk recursivo na main thread viravam spike de jank empilhado no parse do próprio IG. igMedia só é
    // consultado no hover/build do card → algumas centenas de ms de atraso são de graça.
    const ingestSoon = (text) => {
        if (typeof requestIdleCallback === "function") requestIdleCallback(() => ingestText(text), { timeout: 500 });   // timeout menor → metadados (autor/legenda) chegam mais cedo
        else setTimeout(() => ingestText(text), 120);
    };
    // intercepta fetch + XHR no contexto da PÁGINA p/ ler as respostas da API (graphql/feed)
    function installInterceptors() {
        const W = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;
        const wanted = (u) => /graphql|\/api\/v1\/|\/api\/graphql|feed\/timeline/i.test(u || "");
        try {
            const of = W.fetch;
            if (typeof of === "function" && !of.__igPatched) {
                W.fetch = function (...a) {
                    try {   // captura o X-IG-App-ID das chamadas do IG → usado no unsave direto da página de salvos
                        const h = a[1] && a[1].headers;
                        if (h) { const g = h.get ? (k) => h.get(k) : (k) => h[k] || h[String(k).toLowerCase()]; const id = g("x-ig-app-id") || g("X-IG-App-ID"); if (id) igAppId = id; }
                    } catch (_) { /**/ }
                    const pr = of.apply(this, a);
                    try {
                        pr.then((res) => {
                            try { if (res && wanted(res.url)) res.clone().text().then(ingestSoon).catch(() => {}); } catch (_) { /**/ }
                        }).catch(() => {});
                    } catch (_) { /**/ }
                    return pr;
                };
                W.fetch.__igPatched = true;
            }
        } catch (_) { /**/ }
        try {
            const XHR = W.XMLHttpRequest;
            if (XHR && XHR.prototype && !XHR.prototype.__igPatched) {
                const oOpen = XHR.prototype.open, oSend = XHR.prototype.send;
                XHR.prototype.open = function (m, u) { this.__igUrl = u; return oOpen.apply(this, arguments); };
                XHR.prototype.send = function () {
                    try { this.addEventListener("load", () => { try { if (wanted(this.__igUrl) && (!this.responseType || this.responseType === "text")) ingestSoon(this.responseText); } catch (_) { /**/ } }); } catch (_) { /**/ }
                    return oSend.apply(this, arguments);
                };
                XHR.prototype.__igPatched = true;
            }
        } catch (_) { /**/ }
    }
    function ingestInlineJSON() {           // posts iniciais vêm server-rendered no HTML (não via fetch)
        try { for (const s of document.querySelectorAll('script[type="application/json"]')) ingestText(s.textContent || ""); } catch (_) { /**/ }
    }
    installInterceptors();                  // JÁ no document-start (antes do bundle do IG pegar o fetch)
    const codeOf = (key) => { const m = (key || "").match(/\/(?:p|reel)\/([^/?#]+)/); return m ? m[1] : ""; };
    function fmt(s) {
        if (!isFinite(s) || s < 0) s = 0;
        s = Math.floor(s);
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
        const p = (n) => String(n).padStart(2, "0");
        return h ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`;
    }
    const speedLabel = (r) => r + "×";
    const isStory = () => location.pathname.startsWith("/stories/");
    function isEditable(node) {
        const a = node || document.activeElement;
        return !!(a && (a.isContentEditable || /^(input|textarea|select)$/i.test(a.tagName) ||
            a.getAttribute && a.getAttribute("role") === "textbox" ||
            (a.closest && a.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"]'))));
    }

    /* ------------------------------------------------------------------ *
     * Ícones (Material, fill:currentColor)
     * ------------------------------------------------------------------ */
    const svg = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${p}"/></svg>`;
    const ICONS = {
        play: svg("M8 5v14l11-7z"),
        pause: svg("M6 19h4V5H6v14zm8-14v14h4V5h-4z"),
        volHigh: svg("M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"),
        volLow: svg("M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"),
        volMute: svg("M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4 9.91 6.09 12 8.18V4z"),
        pip: svg("M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.11.9 2 2 2h18c1.1 0 2-.89 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"),
        fs: svg("M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"),
        fsExit: svg("M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"),
        gear: svg("M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84a.484.484 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"),
    };

    /* ------------------------------------------------------------------ *
     * CSS
     * ------------------------------------------------------------------ */
    addStyle(`
.igvc-host{ position:relative; isolation:isolate; --igvc-bar-h:44px; }

/* IG nativo (modo padrão/feed): escondo o controle de volume do IG — temos o nosso —
   e subo o botão de "marcados" pra não ficar atrás da barra. Em stories esses
   elementos vivem no header (fora do host), então a regra é naturalmente só do feed. */
.igvc-host div[role="slider"][aria-label*="olume" i],
.igvc-host [role="slider"]:has(svg[aria-label*="Audio" i]),
.igvc-host button[aria-label*="Toggle audio" i]{ display:none !important; }
.igvc-host div:has(> button svg[aria-label*="Tag" i]),
.igvc-host div:has(> button svg[aria-label*="marca" i]){
  bottom:calc(var(--igvc-bar-h,44px) + 8px) !important; top:auto !important;
}
.igvc-bar{
  position:absolute; left:0; right:0; bottom:0; z-index:2147483647;
  pointer-events:none; color:#fff;
  font:500 12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
  user-select:none; -webkit-user-select:none;
}
/* gradiente só no hover, atrás da fileira */
.igvc-bar::before{
  content:""; position:absolute; left:0; right:0; bottom:0; height:68px;
  background:linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0));
  opacity:0; transition:opacity .2s ease; pointer-events:none;
}
.igvc-bar.igvc-show::before{ opacity:1; }

/* trilha de progresso — sempre visível, fininha; engorda no hover */
.igvc-track{
  position:absolute; left:0; right:0; bottom:0; height:3px; z-index:2;   /* ACIMA da row: senão a fileira (irmã posterior) tapa a trilha no hover e o seek não pega */
  pointer-events:auto; cursor:pointer; touch-action:none;
  background:rgba(255,255,255,.22); transition:height .12s ease;
}
.igvc-bar.igvc-show .igvc-track{ height:9px; }
.igvc-buffered{ position:absolute; left:0; top:0; bottom:0; width:0; background:rgba(255,255,255,.32); }
.igvc-fill{ position:absolute; left:0; top:0; bottom:0; width:0; background:#0095f6; }
.igvc-thumb{
  position:absolute; top:50%; left:0; width:12px; height:12px; margin-left:-6px;
  border-radius:50%; background:#0095f6; pointer-events:none;
  transform:translateY(-50%) scale(0); transition:transform .12s ease;
}
.igvc-bar.igvc-show .igvc-thumb{ transform:translateY(-50%) scale(1); }

/* fileira de botões — escondida até hover. pointer-events:none no container,
   auto só nos widgets, pra clique fora dos botões cair na overlay do IG. */
.igvc-row{
  position:absolute; left:0; right:0; bottom:0; z-index:1;   /* abaixo da trilha (a trilha precisa pegar o clique de seek na faixa de baixo) */
  display:flex; align-items:center; gap:4px; padding:6px 8px 11px;
  pointer-events:none; opacity:0; transform:translateY(6px);
  transition:opacity .18s ease, transform .18s ease;
}
/* com o player visível, a faixa inferior INTEIRA captura o clique (largura toda) —
   aí a guarda anti-nav da barra engole, e miss-click "pro lado" não navega pro post. */
.igvc-bar.igvc-show .igvc-row{ opacity:1; transform:none; pointer-events:auto; }
.igvc-row .igvc-spacer{ flex:1 1 auto; }
.igvc-btn{
  pointer-events:auto; display:inline-flex; align-items:center; justify-content:center;
  flex:0 0 auto; width:30px; height:30px; padding:0; border:0; border-radius:8px;
  background:transparent; color:#fff; cursor:pointer; opacity:.92;
  transition:background .15s ease, opacity .15s ease;
}
.igvc-btn:hover{ background:rgba(255,255,255,.18); opacity:1; }
.igvc-btn svg{ width:20px; height:20px; fill:currentColor; display:block; }
.igvc-time{
  pointer-events:none; font-variant-numeric:tabular-nums; opacity:.96;
  padding:0 4px; white-space:nowrap; text-shadow:0 1px 2px rgba(0,0,0,.5);
}
.igvc-speed{ width:auto; min-width:36px; padding:0 6px; font-weight:700; font-size:12px; }

/* volume: slider some até hover do grupo */
.igvc-vol{ display:flex; align-items:center; pointer-events:auto; }
.igvc-vol .igvc-range{ width:0; opacity:0; transition:width .18s ease, opacity .18s ease; }
.igvc-vol.igvc-vol-open .igvc-range, .igvc-vol:focus-within .igvc-range{ width:70px; opacity:1; }
input.igvc-range{
  -webkit-appearance:none; appearance:none; pointer-events:auto;
  height:4px; border-radius:2px; background:rgba(255,255,255,.4); margin:0 4px; cursor:pointer;
  touch-action:none; -webkit-user-drag:none;
}
input.igvc-range::-webkit-slider-thumb{ -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:#fff; cursor:pointer; }
input.igvc-range::-moz-range-thumb{ width:12px; height:12px; border:0; border-radius:50%; background:#fff; cursor:pointer; }

/* popover de velocidade (config saiu pro painel flutuante) */
.igvc-pop{
  position:absolute; bottom:46px; min-width:84px; padding:6px;
  background:rgba(18,18,18,.97); border:1px solid rgba(255,255,255,.12);
  border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.45);
  display:none; flex-direction:column; gap:2px; pointer-events:auto;
}
.igvc-pop.igvc-open{ display:flex; }
.igvc-pop-speed{ right:84px; min-width:84px; }
.igvc-pop button{ background:transparent; border:0; color:#fff; text-align:left; padding:6px 10px; border-radius:6px; cursor:pointer; font:inherit; white-space:nowrap; }
.igvc-pop button:hover{ background:rgba(255,255,255,.12); }
.igvc-pop button.igvc-on{ color:#0095f6; font-weight:700; }

/* stories: do nosso player fica SÓ a barra de progresso (scrub) — o post original (reply, like,
   tudo) permanece INTACTO. Sem gradiente e sem a fileira de botões (não montados em story). */
.igvc-bar.igvc-story::before{ display:none; }

/* fullscreen no host: centraliza o vídeo, barra um tico maior */
.igvc-host:fullscreen, .igvc-host.igvc-fs{ width:100vw; height:100vh; background:#000; display:flex; align-items:center; justify-content:center; }
.igvc-host:fullscreen video, .igvc-host.igvc-fs video{ max-width:100vw; max-height:100vh; width:auto; height:auto; margin:auto; }
.igvc-host.igvc-fs .igvc-btn svg{ width:24px; height:24px; }
.igvc-host.igvc-fs .igvc-track{ height:5px; }
.igvc-host.igvc-fs .igvc-time{ font-size:13px; }
`);

    /* ------------------------------------------------------------------ *
     * CSS — feed da home em MOSAICO (multicolunas estilo dashboard)
     *   • só ADITIVO: alargo os wrappers de largura do route do feed e troco
     *     a coluna única por CSS `columns`. Cards = os próprios <article>.
     *   • tema-aware: cores via as vars do IG (--ig-elevated-background etc),
     *     com fallback dark, então respeita claro/escuro.
     * ------------------------------------------------------------------ */
    addStyle(`
/* largura: solto os caps de 470/630px do route do feed (NÃO toco no <main>, que é shell) */
.igm-wide{ max-width:none !important; width:100% !important; --x-width:100% !important; --x-maxWidth:100% !important; }

/* right rail (perfil/sugestões/footer) — irmão da coluna do feed na "row" */
.igm-norail{ display:none !important; }

/* vars tunáveis: nav (offset) e largura máx do bloco de conteúdo (≤3 colunas, preenchem) */
:root{ --igm-navw:72px; --igm-maxw:1320px; }

/* nav esquerdo fixo: pino a largura (= --igm-navw) e mato a transition (sem hover-expand) */
.igm-navpin{ width:var(--igm-navw) !important; min-width:var(--igm-navw) !important; max-width:var(--igm-navw) !important; flex:0 0 var(--igm-navw) !important; transition:none !important; }

/* a coluna do feed começa em x=0 (nav é overlay fixo, não ocupa fluxo) → desloco o
   conteúdo pela largura do nav. */
.igm-col{ box-sizing:border-box !important; padding-left:var(--igm-navw) !important; }

/* wrapper comum que contém stories E cards: capo aqui (max-width + margin auto) → o
   bloco inteiro (stories + grid) centra no espaço útil e fica alinhado por construção. */
.igm-content{ max-width:var(--igm-maxw) !important; width:100% !important; margin-left:auto !important; margin-right:auto !important; box-sizing:border-box !important; --x-width:100% !important; --x-maxWidth:100% !important; }
/* coluna do grid (explore/profile) que nasce SOB o nav fixo: maxw + padding do nav → conteúdo maxw centrado em (viewport − nav), igual à home */
.igm-gridnav{ max-width:calc(var(--igm-maxw) + var(--igm-navw)) !important; padding-left:var(--igm-navw) !important; }
/* perfil: o header (avatar/bio/stats) mantém a centragem nativa do IG, mas MAIOR (zoom) e com respiro no
   topo (o IG cola no topo). As abas (posts/reels/tagged) centralizadas. */
.igm-gridcol header { zoom:1.22; padding-top:30px !important; }
.igm-gridcol [role="tablist"] { justify-content:center !important; }
/* explore/search: a barra de busca e o bloco de resultados acompanham a largura do conteúdo (best-effort) */
.igm-gridcol [role="search"], .igm-gridcol form[role="search"],
.igm-gridcol div:has(> input[aria-label*="esquis" i]), .igm-gridcol div:has(> input[aria-label*="earch" i]),
.igm-gridcol input[aria-label*="esquis" i], .igm-gridcol input[aria-label*="earch" i] { max-width:none !important; width:100% !important; }

/* garante a tray de stories preenchendo o bloco e alinhada à esquerda (não centrada/estreita) */
.igm-stories{ width:100% !important; max-width:none !important; margin-left:0 !important; margin-right:0 !important; }

/* === FEED PRÓPRIO (DOM NOSSO) ============================================ *
 * A lista nativa do IG fica VIVA mas fora de vista (.igf-src): continua sendo o
 * "fornecedor" de dados (harvest) e mantém o IG carregando ao rolar. Eu renderizo
 * CARDS meus (.igf-card) num container meu (.igf-feed) e faço o masonry em JS com
 * alturas CONHECIDAS (aspect-ratio reserva a mídia antes de carregar) → estável. */
/* ~150vh: posts vivos o bastante pra tocar os visíveis, sem renderizar/decodificar demais (lag) */
.igf-src{ position:fixed !important; top:0 !important; left:0 !important; width:480px !important; height:150vh !important; overflow-y:auto !important; opacity:0 !important; pointer-events:none !important; z-index:-1 !important; }
.igf-feed{ position:relative; width:100%; padding:8px 0 80px; box-sizing:border-box; --igf-colw:340px; }
/* telas menores (conteúdo encosta nas bordas): respiro lateral. Cards são absolutos → estreito o feed com margem
   (padding não empurraria os absolutos). A tray de stories e o header também ganham um respiro. */
@media (max-width:1400px){
  .igf-feed{ width:calc(100% - 28px) !important; margin-left:14px !important; margin-right:14px !important; }
  .igm-stories{ margin-left:14px !important; margin-right:14px !important; }
}
.igf-card{ position:absolute; top:0; left:0; width:var(--igf-colw); box-sizing:border-box; border-radius:14px; overflow:hidden;
  background:rgb(var(--ig-elevated-background, 32, 32, 32)); border:1px solid rgba(255,255,255,.08); }
.igf-head{ display:flex; align-items:center; gap:8px; padding:9px 11px; }
.igf-who{ display:flex; align-items:center; gap:8px; min-width:0; text-decoration:none; }
.igf-head img{ width:30px; height:30px; border-radius:50%; object-fit:cover; flex:0 0 auto; background:#222; }
.igf-head b{ font-size:13px; font-weight:600; color:var(--ig-primary-text, #f5f5f5); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.igf-follow{ margin-left:auto; flex:0 0 auto; background:none; border:0; cursor:pointer; padding:6px 10px; border-radius:8px;
  color:#4a9eff; font-size:13px; font-weight:700; }
.igf-follow:hover{ background:rgba(255,255,255,.07); }
.igf-follow.on{ color:var(--ig-secondary-text, #aaa); font-weight:600; }
.igf-media{ display:block; position:relative; width:100%; background:#000; overflow:hidden; }
.igf-media img{ width:100%; height:100%; object-fit:cover; display:block; }
/* vídeo movido pra cá: preenche a mídia SEM CORTAR (contain). A caixa já foi reservada na proporção REAL do vídeo (updateRatio no loadedmetadata) → encaixa sem barras. */
.igf-video video{ position:absolute !important; inset:0 !important; width:100% !important; height:100% !important; object-fit:contain !important; background:#000; }
.igf-video.on .igf-play{ display:none; }
.igf-play{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
.igf-play svg{ width:46px; height:46px; opacity:.92; filter:drop-shadow(0 1px 5px rgba(0,0,0,.55)); }
.igf-cap{ padding:6px 11px 12px; font-size:13px; line-height:1.35; color:var(--ig-secondary-text, #c7c7c7);
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.igf-cap b{ color:var(--ig-primary-text, #f5f5f5); font-weight:600; }
/* barra de ações única abaixo da mídia (like/comment/repost/share … save) */
.igf-actions{ display:flex; align-items:center; gap:2px; padding:7px 7px 3px; }
.igf-act{ display:inline-flex; align-items:center; gap:5px; background:none; border:0; cursor:pointer; padding:6px 7px; border-radius:8px;
  color:var(--ig-primary-text, #f5f5f5); font-size:13px; font-weight:600; line-height:1; }
.igf-act:hover{ background:rgba(255,255,255,.08); }
.igf-act svg{ width:22px; height:22px; display:block; }
.igf-act.igf-like.on svg{ fill:#ff3040; stroke:#ff3040; }
.igf-act.igf-save.on svg{ fill:currentColor; }
.igf-act-sp{ flex:1 1 auto; }
.igf-video{ cursor:pointer; }
/* loader: UM spinner no FIM do feed, SEMPRE visível (sem toggle = sem bug de "some, tem que scrollar").
   Some só quando o feed se esgota (.igf-done). É também a sentinela que dispara o carregar-mais. */
.igf-loader{ display:flex; align-items:center; justify-content:center; gap:10px; padding:34px 26px 60px; min-height:40px;
  color:var(--ig-secondary-text, #aaa); font-size:13px; }
.igf-loader.igf-done{ display:none; }
.igf-spin{ width:26px; height:26px; border:3px solid rgba(255,255,255,.18); border-top-color:#fff; border-radius:50%; animation:igf-rot .8s linear infinite; }
@keyframes igf-rot{ to{ transform:rotate(360deg); } }
/* skeleton de ABERTURA: grade FIXA na home desde o document-start (feedback imediato no load, cobre o IG).
   Removido quando o 1º card real entra (ou timeout). NÃO é o "carregando mais" (esse é o .igf-loader). */
.igf-boot{ position:fixed; inset:0; z-index:9998; overflow:hidden; background:rgb(var(--ig-background, 0,0,0)); }
.igf-boot-grid{ max-width:var(--igm-maxw, 1320px); margin:0 auto; box-sizing:border-box;
  padding:80px var(--igm-navw,72px) 40px; column-count:3; column-gap:24px; }
.igf-boot-cell{ break-inside:avoid; margin:0 0 24px; border-radius:14px;
  background:linear-gradient(100deg, rgba(255,255,255,.04) 30%, rgba(255,255,255,.10) 50%, rgba(255,255,255,.04) 70%);
  background-size:200% 100%; animation:igf-shim 1.2s linear infinite; }
@keyframes igf-shim{ to{ background-position:-200% 0; } }
/* share virou COPIAR link: feedback de copiado (check azul) */
.igf-act.igf-copied svg{ stroke:#0095f6; }

/* ===== carrossel/galeria: setas + dots + contador (slides na proporção do post, cover) ===== */
.igf-carousel{ position:relative; display:block; }
.igf-cstage{ position:absolute; inset:0; }
.igf-cstage img, .igf-cstage video{ width:100% !important; height:100% !important; object-fit:cover; display:block; }
.igf-cnav{ position:absolute; top:50%; transform:translateY(-50%); z-index:3; width:30px; height:30px; padding:0;
  display:flex; align-items:center; justify-content:center; border:0; border-radius:50%;
  background:rgba(0,0,0,.45); color:#fff; cursor:pointer; opacity:0; transition:opacity .15s ease; }
.igf-carousel:hover .igf-cnav{ opacity:.95; }
.igf-cnav:hover{ background:rgba(0,0,0,.7); }
.igf-cnav:disabled, .igf-cnav[hidden]{ display:none; }
.igf-cnav svg{ width:22px; height:22px; display:block; }
.igf-cprev{ left:8px; }
.igf-cnext{ right:8px; }
.igf-cdots{ position:absolute; left:0; right:0; bottom:8px; z-index:3; display:flex; gap:4px; justify-content:center; pointer-events:none; }
.igf-cdot{ width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,.5); transition:background .15s ease; }
.igf-cdot.on{ background:#fff; }
.igf-ccount{ position:absolute; top:8px; right:8px; z-index:3; pointer-events:none;
  background:rgba(0,0,0,.55); color:#fff; font-size:11px; font-weight:600; padding:2px 8px; border-radius:10px; }
`);

    /* ------------------------------------------------------------------ *
     * CSS — v3.2 POLISH do mosaico: paleta própria (preto premium no escuro,
     *   claro no light), micro-interações, densidade, estados. O tema real do
     *   IG é detectado por LUMINÂNCIA do fundo em JS → html.igf-dark.
     *   Bloco POSTERIOR ao CSS base → sobrepõe por ordem de origem.
     * ------------------------------------------------------------------ */
    addStyle(`
/* paleta — escuro: card quase-preto (AMOLED) separado do fundo por hairline+sombra; texto bem claro */
html.igf-dark{
  --igf-card-bg:#0e0e10;
  --igf-line: rgba(255,255,255,.10);
  --igf-line-hov: rgba(255,255,255,.26);
  --igf-hover-bg: rgba(255,255,255,.08);
  --igf-text:#f4f4f5;
  --igf-text-2:#b9b9c0;
  --igf-shadow: 0 1px 2px rgba(0,0,0,.55);
  --igf-shadow-hov: 0 18px 44px rgba(0,0,0,.64);
}
/* claro */
html:not(.igf-dark){
  --igf-card-bg:#ffffff;
  --igf-line: rgba(0,0,0,.12);
  --igf-line-hov: rgba(0,0,0,.26);
  --igf-hover-bg: rgba(0,0,0,.05);
  --igf-text:#0b0b0d;
  --igf-text-2:#5b5b62;
  --igf-shadow: 0 1px 2px rgba(0,0,0,.08);
  --igf-shadow-hov: 0 16px 36px rgba(0,0,0,.18);
}
/* card: bg + borda da paleta + transições; sombra (resting + hover) só com a flag igf-shadow */
.igf-card{ background:var(--igf-card-bg) !important; border-color:var(--igf-line) !important;
  transition:transform .2s cubic-bezier(.2,.7,.3,1), box-shadow .2s ease, border-color .2s ease; }
.igf-feed.igf-shadow .igf-card{ box-shadow:var(--igf-shadow); }
.igf-feed.igf-shadow .igf-card:hover{ transform:translateY(-4px); box-shadow:var(--igf-shadow-hov); border-color:var(--igf-line-hov) !important; }
.igf-feed:not(.igf-shadow) .igf-card:hover{ border-color:var(--igf-line-hov) !important; }
/* texto legível (sobrepõe o cinza nativo do IG) */
.igf-head b{ color:var(--igf-text) !important; }
.igf-act{ color:var(--igf-text) !important; }
.igf-cap{ color:var(--igf-text-2) !important; }
.igf-cap b{ color:var(--igf-text) !important; }
/* zoom leve da mídia no hover (a .igf-media tem overflow:hidden → clipa o zoom) */
.igf-media > img, .igf-cstage img{ transition:transform .35s cubic-bezier(.2,.7,.3,1); }
.igf-card:hover .igf-media > img, .igf-card:hover .igf-cstage img{ transform:scale(1.045); }
/* hovers neutros */
.igf-act:hover, .igf-follow:hover{ background:var(--igf-hover-bg) !important; }

/* flags do painel: sombra / legenda / contadores */
.igf-feed.igf-nocap .igf-cap{ display:none; }
.igf-feed.igf-nocounts .igf-act > span{ display:none; }

/* densidade COMPACTA (GAP cai via JS; aqui o respiro interno + fontes) */
.igf-feed.igf-dense .igf-head{ padding:7px 9px; }
.igf-feed.igf-dense .igf-head img{ width:26px; height:26px; }
.igf-feed.igf-dense .igf-actions{ padding:5px 5px 2px; }
.igf-feed.igf-dense .igf-act{ padding:5px 6px; font-size:12px; }
.igf-feed.igf-dense .igf-act svg{ width:20px; height:20px; }
.igf-feed.igf-dense .igf-cap{ padding:4px 9px 10px; font-size:12.5px; }
.igf-feed.igf-dense .igf-card{ border-radius:12px; }

/* skeleton de abertura: shimmer NEUTRO (visível em claro e escuro) */
.igf-boot-cell{ background:linear-gradient(100deg, rgba(128,128,128,.10) 30%, rgba(128,128,128,.22) 50%, rgba(128,128,128,.10) 70%); background-size:200% 100%; }

/* stories: emoldura a tray como um card (alinha com a grade do mosaico) */
.igm-stories{ background:var(--igf-card-bg); border:1px solid var(--igf-line); border-radius:14px; padding:12px 14px !important; margin-bottom:10px !important; box-sizing:border-box; }

/* tiles do explore/profile (só-mídia): cursor + badge de reel/galeria no canto */
.igf-tile .igf-media{ cursor:pointer; display:block; }
.igf-tile-badge{ position:absolute; top:8px; right:8px; z-index:2; pointer-events:none; color:#fff; filter:drop-shadow(0 1px 4px rgba(0,0,0,.7)); }
.igf-tile-badge svg{ width:22px; height:22px; display:block; }
.igf-act.igf-busy{ opacity:.45; pointer-events:none; }   /* removendo dos salvos… */

/* ===== SALVOS: toolbar de multisseleção + overlay/checkbox nos tiles ===== */
.igf-savedbar{ display:flex; align-items:center; gap:10px; padding:4px 2px 12px; }
.igf-sb-sp{ flex:1 1 auto; }
.igf-sb-count{ font-size:13px; color:var(--igf-text-2); }
.igf-sb-btn{ all:unset; cursor:pointer; padding:8px 15px; border-radius:9px; font:700 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#fff; background:#0095f6; }
.igf-sb-btn:hover{ filter:brightness(1.08); }
.igf-sb-ghost{ background:transparent; color:var(--igf-text); border:1px solid var(--igf-line); }
.igf-sb-danger{ background:#ed4956; }
.igf-sb-btn[disabled]{ opacity:.45; pointer-events:none; }
/* visibilidade por modo: normal = só "Selecionar"; modo seleção = count + Cancelar + Remover */
.igf-savedbar .igf-sb-ghost, .igf-savedbar .igf-sb-danger, .igf-savedbar .igf-sb-count{ display:none; }
.igf-savedbar.on .igf-sb-sel{ display:none; }
.igf-savedbar.on .igf-sb-ghost, .igf-savedbar.on .igf-sb-danger{ display:inline-block; }
.igf-savedbar.on .igf-sb-count{ display:inline; }
/* overlay de seleção: cobre o tile só no modo seleção (captura o clique → marca/desmarca) */
.igf-selovl{ display:none; position:absolute; inset:0; z-index:6; cursor:pointer; transition:background .12s ease; }
.igf-feed.igf-selecting .igf-card-saved .igf-selovl{ display:block; }
.igf-feed.igf-selecting .igf-card-saved .igf-actions{ display:none; }   /* no modo seleção esconde a barra de ação */
.igf-card.igf-sel .igf-selovl{ background:rgba(0,149,246,.22); }
.igf-card.igf-sel{ outline:3px solid #0095f6; outline-offset:-3px; }
.igf-selcb{ position:absolute; top:10px; left:10px; width:24px; height:24px; border-radius:50%; border:2px solid #fff; background:rgba(0,0,0,.4); box-shadow:0 1px 5px rgba(0,0,0,.55); box-sizing:border-box; }
.igf-card.igf-sel .igf-selcb{ background:#0095f6; }
.igf-card.igf-sel .igf-selcb::after{ content:""; position:absolute; left:8px; top:4px; width:6px; height:11px; border:solid #fff; border-width:0 2.5px 2.5px 0; transform:rotate(45deg); }
/* menu de coleções + toast */
.igf-collmenu{ position:fixed; z-index:2147483647; min-width:220px; max-height:60vh; overflow-y:auto; padding:6px; background:#1c1c1e; border:1px solid #363638; border-radius:12px; box-shadow:0 12px 34px rgba(0,0,0,.6); }
.igf-cm-head{ font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#8e8e93; padding:6px 10px 4px; }
.igf-cm-item{ all:unset; cursor:pointer; display:block; width:100%; box-sizing:border-box; padding:9px 11px; border-radius:8px; color:#f5f5f5; font:600 13px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
.igf-cm-item:hover{ background:#2c2c2e; }
.igf-cm-new{ color:#0095f6; }
.igf-toast{ position:fixed; left:50%; bottom:80px; transform:translateX(-50%) translateY(8px); z-index:2147483647; background:#1c1c1e; color:#f5f5f5; border:1px solid #363638; border-radius:999px; padding:9px 18px; font:13px -apple-system,sans-serif; box-shadow:0 6px 22px rgba(0,0,0,.5); opacity:0; pointer-events:none; transition:opacity .2s, transform .2s; }
.igf-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
`);

    /* ------------------------------------------------------------------ *
     * CSS — painel de ajustes flutuante (mesmo modelo do reddit/twitter,
     *   prefixo igs-, accent azul do IG). FAB de engrenagem no canto.
     * ------------------------------------------------------------------ */
    addStyle(`
#igs-fab{ position:fixed; right:18px; bottom:18px; z-index:2147483646; width:44px; height:44px;
  display:flex; align-items:center; justify-content:center; background:#1c1c1e; color:#f5f5f5;
  border:1px solid #363638; border-radius:50%; cursor:pointer; opacity:.72;
  box-shadow:0 6px 20px rgba(0,0,0,.45);
  transition:opacity .2s, color .15s, background .15s, border-color .15s, transform .2s; }
#igs-fab:hover{ opacity:1; color:#fff; background:#0095f6; border-color:#0095f6; transform:rotate(30deg); }
#igs-fab svg{ width:21px; height:21px; fill:currentColor; display:block; }
/* esconder o dock de mensagens */
html.igf-no-msg .igf-msgdock{ display:none !important; }
/* botão voltar-ao-topo: acima do FAB, aparece só ligado + rolado */
#igs-totop{ position:fixed; right:18px; bottom:72px; z-index:2147483646; width:42px; height:42px;
  display:none; align-items:center; justify-content:center; background:#1c1c1e; color:#f5f5f5;
  border:1px solid #363638; border-radius:50%; cursor:pointer; opacity:.72; box-shadow:0 6px 20px rgba(0,0,0,.45);
  transition:opacity .2s, color .15s, background .15s, border-color .15s, transform .2s; }
#igs-totop:hover{ opacity:1; color:#fff; background:#0095f6; border-color:#0095f6; transform:translateY(-2px); }
#igs-totop svg{ width:20px; height:20px; fill:currentColor; display:block; }
html.igf-totop-on.igf-scrolled #igs-totop{ display:flex; }
#igs-panel{ position:fixed; right:18px; bottom:70px; z-index:2147483647; width:384px; max-height:88vh;
  display:none; flex-direction:column; overflow:hidden;
  background:#1c1c1e; color:#f5f5f5; border:1px solid #363638; border-radius:18px; box-shadow:0 16px 50px rgba(0,0,0,.65);
  font:14px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; transform-origin:bottom right; }
#igs-panel.open{ display:flex; animation:igs-pop .16s cubic-bezier(.2,.7,.3,1); }
@keyframes igs-pop{ from{ opacity:0; transform:translateY(10px) scale(.97); } to{ opacity:1; transform:none; } }
.igs-head{ display:flex; align-items:center; gap:10px; padding:14px 14px 12px; border-bottom:1px solid #2a2a2d; }
.igs-logo{ width:28px; height:28px; border-radius:9px; background:#0095f6; display:flex; align-items:center; justify-content:center; flex:none; }
.igs-logo svg{ width:17px; height:17px; fill:#fff; }
.igs-head b{ font-size:16px; font-weight:800; flex:1; }
.igs-x{ all:unset; cursor:pointer; color:#9a9a9d; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size:16px; border-radius:50%; transition:.15s; }
.igs-x:hover{ color:#f5f5f5; background:#2c2c2e; }
.igs-search{ padding:10px 14px; border-bottom:1px solid #2a2a2d; }
.igs-search > div{ display:flex; align-items:center; gap:8px; background:#000; border:1px solid #363638; border-radius:999px; padding:7px 12px; transition:border-color .15s; }
.igs-search > div:focus-within{ border-color:#0095f6; }
.igs-search svg{ width:16px; height:16px; fill:#8e8e93; flex:none; }
.igs-search input{ all:unset; flex:1; color:#f5f5f5; font:inherit; }
.igs-search input::placeholder{ color:#8e8e93; }
.igs-body{ display:flex; min-height:0; flex:1; }
.igs-rail{ display:flex; flex-direction:column; gap:4px; padding:10px 8px; border-right:1px solid #2a2a2d; flex:none; }
.igs-tab{ all:unset; box-sizing:border-box; width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; color:#8e8e93; cursor:pointer; transition:background .15s,color .15s; }
.igs-tab svg{ width:21px; height:21px; fill:currentColor; }
.igs-tab:hover{ background:#242426; color:#f5f5f5; }
.igs-tab.active{ background:rgba(0,149,246,.15); color:#0095f6; }
.igs-content{ flex:1; min-width:0; overflow-y:auto; padding:6px 0 12px; scrollbar-width:thin; scrollbar-color:#48484a transparent; }
.igs-content::-webkit-scrollbar{ width:8px; }
.igs-content::-webkit-scrollbar-thumb{ background:#48484a; border-radius:99px; border:2px solid #1c1c1e; }
.igs-sec{ display:none; }
.igs-sec-title{ font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#8e8e93; padding:12px 16px 6px; }
.igs-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 12px; cursor:pointer; border-radius:9px; margin:1px 6px; transition:background .12s; }
.igs-row:hover{ background:#242426; }
.igs-rowlbl{ flex:1; display:flex; flex-direction:column; gap:2px; min-width:0; }
.igs-hint{ color:#8e8e93; font-size:11px; line-height:1.3; font-weight:400; }
.igs-row select{ background:#000; color:#f5f5f5; border:1px solid #363638; border-radius:8px; padding:5px 8px; font:inherit; cursor:pointer; flex:0 0 auto; }
.igs-row.dim, .igs-slider.dim{ opacity:.4; pointer-events:none; }
.igs-sw{ position:relative; width:38px; height:22px; flex:none; }
.igs-sw input{ position:absolute; inset:0; opacity:0; margin:0; cursor:pointer; }
.igs-sw i{ position:absolute; inset:0; border-radius:999px; background:#48484a; transition:.18s; pointer-events:none; }
.igs-sw i::after{ content:""; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition:.18s; box-shadow:0 1px 2px rgba(0,0,0,.4); }
.igs-sw input:checked + i{ background:#0095f6; }
.igs-sw input:checked + i::after{ transform:translateX(16px); }
.igs-slider{ display:flex; flex-direction:column; gap:8px; padding:10px 12px; margin:1px 6px; }
.igs-lab{ display:flex; justify-content:space-between; align-items:center; color:#dcdcdd; }
.igs-lab .val{ color:#0095f6; font-weight:700; background:rgba(0,149,246,.12); border-radius:6px; padding:1px 8px; font-size:13px; min-width:38px; text-align:center; }
.igs-slider input[type=range]{ width:100%; accent-color:#0095f6; cursor:pointer; }
.igs-empty{ display:none; color:#8e8e93; text-align:center; padding:32px 16px; }
.igs-foot{ display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-top:1px solid #2a2a2d; }
.igs-ver{ color:#6b6b70; font-size:12px; }
.igs-reset{ all:unset; cursor:pointer; color:#8e8e93; font-size:13px; font-weight:600; padding:4px 8px; border-radius:7px; transition:.15s; }
.igs-reset:hover{ color:#ff3040; background:rgba(255,48,64,.1); }
`);

    /* ------------------------------------------------------------------ *
     * Acha o "wrapper" do vídeo — o box que contém o <video> e a overlay
     * de tap do IG (div[data-instancekey]) como irmãos. Fallback: sobe até
     * o primeiro ancestral que enquadra o vídeo, senão o pai direto.
     * ------------------------------------------------------------------ */
    function findWrapper(video) {
        let node = video.parentElement;
        for (let d = 0; d < 15 && node; d++) {
            if (node.querySelector(":scope > div[data-instancekey]")) return node;
            node = node.parentElement;
        }
        // fallback heurístico: ancestral cuja largura ~= a do vídeo (o frame visual)
        const vw = video.getBoundingClientRect().width;
        node = video.parentElement;
        let best = video.parentElement;
        for (let d = 0; d < 6 && node; d++) {
            const w = node.getBoundingClientRect().width;
            if (vw && Math.abs(w - vw) <= 2) best = node;
            node = node.parentElement;
        }
        return best || video.parentElement;
    }

    /* ------------------------------------------------------------------ *
     * Controller por vídeo
     * ------------------------------------------------------------------ */
    const bound = new WeakSet();              // <video> já tratados
    const controllers = new WeakMap();        // <video> -> controller
    const live = new Set();                   // <video>s vivos (pra poda/teclado)

    function attach(video) {
        if (bound.has(video)) return;
        if (video.closest && video.closest(".igf-src")) return;   // vídeo da lista nativa off-screen → só anexa quando eu mover pro card
        const host = findWrapper(video);
        if (!host) return;

        const story = isStory();
        if (story && !prefs.stories) { bound.add(video); return; }  // marca e ignora

        bound.add(video);
        live.add(video);

        const ac = new AbortController();
        const sig = ac.signal;
        const on = (t, ev, fn, opts) => t.addEventListener(ev, fn, Object.assign({ signal: sig }, opts));

        if (getComputedStyle(host).position === "static") host.style.position = "relative";
        host.classList.add("igvc-host");

        /* ---- DOM ---- */
        const buffered = el("div", { class: "igvc-buffered" });
        const fill = el("div", { class: "igvc-fill" });
        const thumb = el("div", { class: "igvc-thumb" });
        const track = el("div", { class: "igvc-track", title: "" }, buffered, fill, thumb);

        const playBtn = el("button", { class: "igvc-btn", "aria-label": "Play/Pause", html: ICONS.play });
        const time = el("span", { class: "igvc-time" }, "0:00");

        const speedBtn = el("button", { class: "igvc-btn igvc-speed", "aria-label": "Velocidade" }, speedLabel(prefs.speed));
        const speedPop = el("div", { class: "igvc-pop igvc-pop-speed" });

        const muteBtn = el("button", { class: "igvc-btn", "aria-label": "Mudo", html: ICONS.volHigh });
        const range = el("input", { class: "igvc-range", type: "range", min: "0", max: "1", step: "0.01", value: String(prefs.volume), "aria-label": "Volume" });
        const volGroup = el("div", { class: "igvc-vol" }, muteBtn, range);

        const pipBtn = el("button", { class: "igvc-btn", "aria-label": "Picture-in-Picture", html: ICONS.pip });
        const fsBtn = el("button", { class: "igvc-btn", "aria-label": "Tela cheia", html: ICONS.fs });
        // (config/ajustes saíram do player → painel flutuante único, ver buildPanel)

        const row = el("div", { class: "igvc-row" },
            playBtn, time, el("span", { class: "igvc-spacer" }),
            speedBtn, volGroup, pipBtn, fsBtn, speedPop);

        // story: SÓ a barra de progresso (track). feed/reels: track + fileira de botões. (el ignora kid null)
        const bar = el("div", { class: "igvc-bar" + (story ? " igvc-story" : "") }, track, story ? null : row);

        // Onde montar a barra:
        //  • feed: dentro do host (acompanha o vídeo).
        //  • stories: no "card" da story (ancestral que contém o <textarea> de reply),
        //    como ÚLTIMO filho — DEPOIS do rodapé. Senão o rodapé (irmão posterior do
        //    container do vídeo) pinta por cima da barra e os cliques não passam.
        let storyBox = null;
        function findStoryParts() {
            // storyBox: a caixa TRANSFORMADA da story (o containing-block dos absolutos). Monto a barra
            // aqui como ÚLTIMO filho → ela pinta ACIMA de toda a overlay do IG (reply, tap-zones), então
            // os cliques de SEEK passam. O POST ORIGINAL fica INTACTO (não toco no reply/like/footer).
            // Fallback: ancestral com <textarea> (card), senão o host.
            let n = host.parentElement, box = null, card = null;
            for (let i = 0; i < 16 && n; i++) {
                const tf = getComputedStyle(n).transform;
                if (!box && tf && tf !== "none") box = n;   // tf vazio em alguns engines = sem transform
                if (!card && n.querySelector("textarea")) card = n;
                n = n.parentElement;
            }
            storyBox = box || card || host;
            return !!(box || card);
        }
        if (story) findStoryParts();
        (storyBox || host).appendChild(bar);

        // Defesa anti-navegação: no feed o vídeo vem embrulhado num <a href="/reels/...">
        // e a barra fica DENTRO do anchor. Clicar num controle dispararia a navegação
        // (ação default do <a>) + o onClick delegado do React. Engulo na borda da barra:
        // os handlers dos widgets rodam no target (antes), aqui no bubble mato default +
        // propagação. mousedown/pointerdown só param a propagação (sem preventDefault),
        // senão o arraste do slider de volume quebraria.
        on(bar, "click", (e) => { e.preventDefault(); e.stopPropagation(); });
        on(bar, "mousedown", (e) => e.stopPropagation());
        // anchors são "draggable" por padrão e o player vive DENTRO do <a href="/reels/...">:
        // arrastar qualquer controle (ex.: o slider de volume) faz o browser arrastar o
        // LINK, com a imagem do post como ghost ("puxa a imagem de trás"). O dragstart
        // dispara no <a> (ancestral), não no controle — então marco o press na barra e
        // cancelo o dragstart no document (capture) enquanto durar.
        let pressing = false;
        on(bar, "pointerdown", (e) => { pressing = true; e.stopPropagation(); });
        on(document, "pointerup", () => { pressing = false; });
        on(document, "pointercancel", () => { pressing = false; });
        on(document, "dragstart", (e) => { if (pressing) e.preventDefault(); }, { capture: true });

        const controller = { video, host, bar, destroy };
        controllers.set(video, controller);

        // stories: se o card/rodapé ainda não montou, tenta de novo e RELOCA a barra
        // do host pro card (+ religa o hover no card).
        if (story && storyBox === host) {   // não achou a caixa/reply ainda → tenta de novo e move
            const relocate = () => {
                if (storyBox !== host) return;
                if (findStoryParts() && storyBox !== host) {
                    storyBox.appendChild(bar);
                    on(storyBox, "mouseenter", () => setShown(true));
                    on(storyBox, "mouseleave", hide);
                }
            };
            const lt = [setTimeout(relocate, 300), setTimeout(relocate, 900), setTimeout(relocate, 1800)];
            sig.addEventListener("abort", () => lt.forEach(clearTimeout));
        }

        /* ---- estado de áudio: aplica prefs e sobrevive aos resets do IG ---- */
        function applyAV() {
            try { video.volume = prefs.volume; } catch { /**/ }
            try { video.playbackRate = prefs.speed; } catch { /**/ }
            if (prefs.autoUnmute && video._igvcMuteIntent == null) { try { video.muted = false; } catch { /**/ } }
        }
        applyAV();
        const t1 = setTimeout(applyAV, 140);
        const t2 = setTimeout(() => { applyAV(); video._igvcSettled = true; }, 600);
        sig.addEventListener("abort", () => { clearTimeout(t1); clearTimeout(t2); });

        /* ---- progresso / tempo ---- */
        let dragging = false;
        function renderTime() {
            if (dragging) return;
            const d = video.duration;
            if (!isFinite(d) || d <= 0) { fill.style.width = "0%"; thumb.style.left = "0%"; if (time.textContent) time.textContent = ""; return; }
            const pc = clamp(video.currentTime / d, 0, 1) * 100;
            fill.style.width = pc + "%";
            thumb.style.left = pc + "%";
            const tt = fmt(video.currentTime) + " / " + fmt(d);   // guard "mudou?" (mesmo padrão do setVolIcon): timeupdate é ~4Hz, o texto só muda 1×/s
            if (time.textContent !== tt) time.textContent = tt;
        }
        function renderBuffered() {
            try {
                const b = video.buffered, d = video.duration;
                if (b && b.length && isFinite(d) && d > 0) buffered.style.width = clamp(b.end(b.length - 1) / d, 0, 1) * 100 + "%";
            } catch { /**/ }
        }
        let dragRect = null;   // rect do track cacheado no pointerdown (não muda no meio do drag) — getBoundingClientRect por pointermove forçava layout (os writes de fill/thumb sujam o layout entre moves)
        const fracAt = (clientX) => { const r = dragRect || track.getBoundingClientRect(); return r.width ? clamp((clientX - r.left) / r.width, 0, 1) : 0; };
        function seekTo(f) {
            const d = video.duration;
            if (isFinite(d) && d > 0) video.currentTime = f * d;
            fill.style.width = f * 100 + "%"; thumb.style.left = f * 100 + "%";
        }
        on(track, "pointerdown", (e) => { e.preventDefault(); dragging = true; dragRect = track.getBoundingClientRect(); try { track.setPointerCapture(e.pointerId); } catch { /**/ } seekTo(fracAt(e.clientX)); });
        on(track, "pointermove", (e) => { if (dragging) seekTo(fracAt(e.clientX)); });
        on(track, "pointerup", () => { dragging = false; dragRect = null; });
        on(track, "pointercancel", () => { dragging = false; dragRect = null; });
        on(track, "wheel", (e) => { e.preventDefault(); const d = video.duration; if (isFinite(d)) video.currentTime = clamp(video.currentTime + (e.deltaY < 0 ? 2 : -2), 0, d); }, { passive: false });

        on(video, "timeupdate", renderTime);
        on(video, "durationchange", renderTime);
        on(video, "progress", renderBuffered);
        on(video, "loadedmetadata", () => { renderTime(); renderBuffered(); });

        /* ---- play / pause ---- */
        function setPlayIcon() { playBtn.innerHTML = video.paused ? ICONS.play : ICONS.pause; }
        on(playBtn, "click", () => { if (video.paused) video.play().catch(() => { }); else video.pause(); });
        on(video, "play", setPlayIcon);
        on(video, "pause", setPlayIcon);
        setPlayIcon();

        /* ---- mudo / volume ---- */
        let volDragging = false, lastVolIcon = "";
        function setVolIcon() {
            // guard "mudou?": só reescreve o SVG quando o estado do ícone muda (IG
            // dispara volumechange em rajada; reescrever idêntico = flicker).
            const want = (video.muted || video.volume === 0) ? "mute" : (video.volume < 0.5 ? "low" : "high");
            if (want !== lastVolIcon) { muteBtn.innerHTML = want === "mute" ? ICONS.volMute : want === "low" ? ICONS.volLow : ICONS.volHigh; lastVolIcon = want; }
            const rv = String(video.muted ? 0 : video.volume);
            if (range.value !== rv && !volDragging && document.activeElement !== range) range.value = rv;
        }
        on(muteBtn, "click", () => {
            const m = !(video.muted || video.volume === 0);
            video.muted = m; video._igvcMuteIntent = m;
            if (!m && video.volume === 0) { video.volume = prefs.volume || 0.5; }
            setVolIcon();
        });
        on(range, "input", () => {
            const v = parseFloat(range.value);
            video.volume = v; video.muted = v === 0; video._igvcMuteIntent = v === 0;
            prefs.volume = v; savePrefsSoon(); setVolIcon();
        });
        // mantém o slider aberto enquanto arrasta — senão ele colapsa no meio do
        // gesto e o arraste "cai" na imagem do post atrás (drag nativo da <img>).
        on(volGroup, "mouseenter", () => volGroup.classList.add("igvc-vol-open"));
        on(volGroup, "mouseleave", () => { if (!volDragging) volGroup.classList.remove("igvc-vol-open"); });
        on(range, "pointerdown", () => { volDragging = true; volGroup.classList.add("igvc-vol-open"); });
        on(document, "pointerup", () => { if (volDragging) { volDragging = false; if (!isHover(volGroup)) volGroup.classList.remove("igvc-vol-open"); } });
        on(video, "volumechange", () => {
            setVolIcon();
            if (video._igvcSettled && !video.muted && video.volume > 0) { prefs.volume = video.volume; savePrefsSoon(); }
        });
        setVolIcon();

        /* ---- velocidade ---- */
        function setSpeed(r) {
            video.playbackRate = r; prefs.speed = r; savePrefsSoon();
            speedBtn.textContent = speedLabel(r);
            for (const b of speedPop.children) b.classList.toggle("igvc-on", parseFloat(b.dataset.r) === r);
        }
        for (const r of SPEEDS) {
            const b = el("button", { "data-r": String(r) }, speedLabel(r));
            b.addEventListener("click", () => { setSpeed(r); closePops(); });
            speedPop.appendChild(b);
        }
        on(speedBtn, "click", () => { const open = speedPop.classList.contains("igvc-open"); closePops(); if (!open) speedPop.classList.add("igvc-open"); });
        on(video, "ratechange", () => { speedBtn.textContent = speedLabel(video.playbackRate); });

        /* ---- PiP ---- */
        on(pipBtn, "click", async () => {
            try {
                if (document.pictureInPictureElement) await document.exitPictureInPicture();
                else if (video.requestPictureInPicture) await video.requestPictureInPicture();
            } catch { /**/ }
        });

        /* ---- fullscreen (no host, pra barra continuar visível) ---- */
        on(fsBtn, "click", () => { toggleFullscreen(host, video); });
        on(document, "fullscreenchange", () => {
            const fs = document.fullscreenElement === host;
            host.classList.toggle("igvc-fs", fs);
            fsBtn.innerHTML = fs ? ICONS.fsExit : ICONS.fs;
        });

        /* ---- popovers (só velocidade; ajustes ficam no painel flutuante) ---- */
        function closePops() { speedPop.classList.remove("igvc-open"); }
        on(document, "click", (e) => { if (!bar.contains(e.target)) closePops(); }, { capture: true });

        /* ---- show/hide da fileira (hover) ---- */
        let hideTimer = 0;
        function popsOpen() { return speedPop.classList.contains("igvc-open"); }
        function setShown(on) {
            bar.classList.toggle("igvc-show", on);   // reveal na BARRA (no feed engorda a trilha + mostra a fileira)
        }
        function hide() { clearTimeout(hideTimer); if (!popsOpen()) setShown(false); }
        function show() {
            setShown(true);
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => { if (!isHover(bar) && !popsOpen()) setShown(false); }, HIDE_DELAY);
        }
        if (story) {
            // hover na caixa inteira da story (vídeo + reply + barra): mover entre eles não
            // "sai" da caixa → sem flicker, e a barra (filha da caixa) fica no hover.
            const tgt = storyBox || host;
            on(tgt, "mouseenter", () => setShown(true));
            on(tgt, "mouseleave", hide);
        } else {
            // feed: capture phase porque o IG engole pointer events na overlay (bubble).
            on(host, "mousemove", show, { capture: true });
            on(host, "mouseleave", hide);
        }

        renderTime(); renderBuffered();

        function destroy() {
            ac.abort();
            bar.remove();
            host.classList.remove("igvc-host", "igvc-show", "igvc-fs");
            live.delete(video);
            controllers.delete(video);
            bound.delete(video);
        }
    }

    /* ------------------------------------------------------------------ *
     * Fullscreen util (host com fallbacks de vendor)
     * ------------------------------------------------------------------ */
    function toggleFullscreen(host, video) {
        try {
            if (document.fullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); return; }
            const req = host.requestFullscreen || host.webkitRequestFullscreen;
            if (req) req.call(host);
            else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();   // iOS
        } catch { /**/ }
    }

    /* ------------------------------------------------------------------ *
     * Teclado — age no vídeo mais centralizado e visível
     * ------------------------------------------------------------------ */
    function activeVideo() {
        let best = null, bestD = Infinity;
        const cy = innerHeight / 2;
        for (const v of document.querySelectorAll("video")) {
            const r = v.getBoundingClientRect();
            if (r.width < MIN_SIZE || r.height < MIN_SIZE) continue;
            if (r.bottom < 0 || r.top > innerHeight) continue;
            const d = Math.abs((r.top + r.bottom) / 2 - cy);
            if (d < bestD) { bestD = d; best = v; }
        }
        return best;
    }

    const rightHold = { timer: 0, temp: false, video: null };
    // teclas que a gente trata — qualquer outra sai ANTES do activeVideo() (que varre todos os <video> + rects por keydown)
    const IGV_KEYS = new Set([" ", "k", "K", "j", "J", "l", "L", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
        "m", "M", "f", "F", "p", "P", ",", ".", "[", "<", "]", ">", "Home", "End", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    document.addEventListener("keydown", (e) => {
        if (!prefs.keyboard) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (!IGV_KEYS.has(e.key)) return;
        if (isEditable(e.target)) return;
        const v = activeVideo();
        if (!v) return;
        const d = v.duration;
        const stop = () => { e.preventDefault(); e.stopPropagation(); };

        switch (e.key) {
            case " ": case "k": case "K":
                stop(); if (v.paused) v.play().catch(() => { }); else v.pause(); break;
            case "j": case "J":
                stop(); if (isFinite(d)) v.currentTime = clamp(v.currentTime - SEEK, 0, d); break;
            case "l": case "L":
                stop(); if (isFinite(d)) v.currentTime = clamp(v.currentTime + SEEK, 0, d); break;
            case "ArrowLeft":
                stop(); if (isFinite(d)) v.currentTime = clamp(v.currentTime - SEEK, 0, d); break;
            case "ArrowRight":
                stop();
                if (e.repeat) break;
                rightHold.video = v;
                rightHold.timer = setTimeout(() => { rightHold.temp = true; v._igvcPrevRate = v.playbackRate; v.playbackRate = 2; }, 220);
                break;
            case "ArrowUp":
                stop(); v.muted = false; v.volume = clamp(v.volume + VOL_STEP, 0, 1); v._igvcMuteIntent = false; break;
            case "ArrowDown":
                stop(); v.volume = clamp(v.volume - VOL_STEP, 0, 1); break;
            case "m": case "M":
                stop(); v.muted = !v.muted; v._igvcMuteIntent = v.muted; break;
            case "f": case "F":
                stop(); { const c = controllers.get(v); toggleFullscreen(c ? c.host : v.parentElement, v); } break;
            case "p": case "P":
                stop(); (async () => { try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await v.requestPictureInPicture(); } catch { /**/ } })(); break;
            case ",":
                stop(); v.pause(); v.currentTime = clamp(v.currentTime - 1 / 30, 0, d || 1e9); break;
            case ".":
                stop(); v.pause(); v.currentTime = clamp(v.currentTime + 1 / 30, 0, d || 1e9); break;
            case "[": case "<":
                stop(); { let i = SPEEDS.indexOf(v.playbackRate); if (i < 0) i = SPEEDS.indexOf(1); v.playbackRate = SPEEDS[clamp(i - 1, 0, SPEEDS.length - 1)]; prefs.speed = v.playbackRate; savePrefsSoon(); } break;
            case "]": case ">":
                stop(); { let i = SPEEDS.indexOf(v.playbackRate); if (i < 0) i = SPEEDS.indexOf(1); v.playbackRate = SPEEDS[clamp(i + 1, 0, SPEEDS.length - 1)]; prefs.speed = v.playbackRate; savePrefsSoon(); } break;
            case "Home": stop(); v.currentTime = 0; break;
            case "End": stop(); if (isFinite(d)) v.currentTime = d; break;
            default:
                if (e.key >= "0" && e.key <= "9") { stop(); if (isFinite(d)) v.currentTime = d * (parseInt(e.key, 10) / 10); }
        }
    }, true);

    document.addEventListener("keyup", (e) => {
        if (e.key !== "ArrowRight") return;
        clearTimeout(rightHold.timer);
        const v = rightHold.video;
        if (rightHold.temp && v) { v.playbackRate = v._igvcPrevRate || prefs.speed; rightHold.temp = false; }
        else if (v) { const d = v.duration; if (isFinite(d)) v.currentTime = clamp(v.currentTime + SEEK, 0, d); }  // tap = +5s
        rightHold.video = null;
    }, true);

    /* ------------------------------------------------------------------ *
     * Feed em MOSAICO (home) — dashboard de cards em multicolunas.
     *   • Coluna única de <article> → CSS columns no tamanho NATIVO do card
     *     (não toco na largura interna do post: matar o calc(min(470px…))
     *     colapsa a mídia → cards viravam só barra+legenda).
     *   • Alargo a coluna do feed (caps 470/630) e ESCONDO a right rail
     *     (perfil/sugestões/footer) — o irmão da coluna do feed na "row".
     *   • Nav esquerdo fixo (pin 72px + sem transition) p/ não expandir no hover.
     *   • Re-asserto a cada scan (classList idempotente) p/ aguentar re-render
     *     do React. Escopo do feed: só a home; nav-pin segue a pref (global).
     * ------------------------------------------------------------------ */
    const isHome = () => location.pathname === "/" || location.pathname === "";
    // um post/reel ABERTO (rota /p/CODE/, /reel/CODE/ ou /reels/CODE/ — com código, não a aba /reels/)
    const isPostRoute = () => /^\/(p|reel|reels)\/[^/]+/.test(location.pathname);
    // o feed deve seguir VIVO? home sempre; OU um post aberto em MODAL por cima do feed (a rota virou /p/CODE/,
    // mas a modal do IG é overlay → nosso feed + a lista nativa seguem montados atrás). Sem isto, abrir a modal
    // virava "não-home" → unmasonry() destruía o feed (igSrc=null) e o clique seguinte caía no go() = redirect.
    const feedShouldLive = () => isHome() || (isPostRoute() && !!(feedEl && feedEl.isConnected));

    // ===== SUPERFÍCIES: home (feed de <article>) · explore/profile (grade de tiles <a>) =====
    // O mesmo motor de masonry/loadMore serve as 3; só muda o "que é um item" e "como buildar o card".
    const RESERVED = new Set(["", "explore", "reels", "reel", "p", "stories", "direct", "accounts", "about",
        "legal", "settings", "your_activity", "directory", "challenge", "lite", "web", "api", "graphql", "emails", "session", "qr", "oauth"]);
    const isExplore = () => /^\/explore(\/|$)/.test(location.pathname);
    const isSaved = () => {   // /usuario/saved/... (qualquer sub-rota: all-posts, coleções)
        const segs = location.pathname.split("/").filter(Boolean);
        return segs.length >= 2 && !RESERVED.has(segs[0]) && segs[1] === "saved";
    };
    const isProfile = () => {
        const segs = location.pathname.split("/").filter(Boolean);
        if (!segs.length || RESERVED.has(segs[0])) return false;
        if (segs.length === 1) return true;                                   // /usuario/  (aba Posts)
        return segs.length === 2 && ["reels", "tagged"].includes(segs[1]);    // /usuario/reels|tagged (saved é superfície própria)
    };
    let surface = "home";          // 'home' | 'explore' | 'profile' | 'saved' — qual harvester/builder usar
    let mountedSurface = null;     // o que está montado agora (pra trocar = teardown + remount)
    // qual superfície DEVE estar montada agora (considerando os toggles + post aberto em modal por cima)
    function targetSurface() {
        if (isHome() && prefs.masonry) return "home";
        if (isExplore() && prefs.gridExplore) return "explore";
        if (isSaved() && (prefs.gridSaved || prefs.gridProfile)) return "saved";   // salvos: flag própria OU junto do perfil
        if (isProfile() && prefs.gridProfile) return "profile";
        if (/\/(p|reel)\/[^/]+/.test(location.pathname) && feedEl && feedEl.isConnected) return mountedSurface;   // modal por cima → mantém
        return null;
    }
    const GRID_SEL = 'a[role="link"][href*="/p/"], a[role="link"][href*="/reel/"]';   // tile do explore/profile
    const itemsIn = (root) => root.querySelectorAll(surface === "home" ? "article" : GRID_SEL);
    const harvestOne = (node) => surface === "home" ? harvestPost(node) : harvestTile(node);
    const keyOf = (node) => surface === "home" ? postKey(node) : tileKey(node);

    function feedArticleList() {
        // a lista = pai comum direto de >=2 <article> dentro do <main>
        const arts = document.querySelectorAll("main article");
        if (arts.length < 2) return null;
        const p = arts[0].parentElement;
        let n = 0;
        for (const a of arts) if (a.parentElement === p) n++;
        return n >= 2 ? p : null;
    }

    // coluna do feed + a(s) rail(s) irmã(s). A coluna = filho direto da "row" de
    // 2 colunas. Ancoro no cap inline de 630px (constante de layout do IG); a
    // stories-tray mora DENTRO do cap630, então nunca é confundida com rail.
    // Fallback (se o 630 sumir): o split de 2 colunas mais EXTERNO antes do <main>.
    function feedColumnSplit(list) {
        let col = null;
        for (let n = list; n && n.tagName !== "MAIN" && n !== document.body; n = n.parentElement) {
            if (/max-width\s*:\s*630px/.test(n.getAttribute("style") || "")) { col = n; break; }
        }
        if (!col) {
            for (let c = list; c && c.parentElement; c = c.parentElement) {
                const row = c.parentElement;
                if (row.tagName === "MAIN" || row === document.body) break;
                const kids = [...row.children].filter((k) => k.nodeType === 1);
                if (kids.length >= 2 && kids.some((k) => k !== c && !k.contains(list))) col = c; // mantém o mais externo
            }
        }
        if (!col || !col.parentElement) return null;
        const rails = [...col.parentElement.children].filter((k) => k.nodeType === 1 && k !== col && !k.contains(list));
        return { col, rails };
    }

    // caixa de largura do nav esquerdo: ancestral (com width px + transition) dos
    // links de nav (explore/reels). É o que o IG anima no hover. Uso a.pathname
    // (não o href cru) p/ casar tanto href relativo quanto absoluto.
    function leftNavWidthBox() {
        let a = null;
        for (const x of document.querySelectorAll('a[href*="explore"], a[href*="reels"]')) {
            const p = x.pathname || "";
            if (p === "/explore/" || p === "/explore" || p === "/reels/" || p === "/reels") { a = x; break; }
        }
        if (!a) return null;
        let n = a.parentElement, best = null;
        for (let d = 0; d < 16 && n && n.tagName !== "MAIN" && n !== document.body; d++, n = n.parentElement) {
            const st = n.getAttribute("style") || "";
            if (/width\s*:\s*\d+px/i.test(st)) { best = n; if (/transition/i.test(st)) return n; }
        }
        return best;
    }

    /* ============================================================================ *
     * FEED PRÓPRIO — em vez de reposicionar os <article> do IG (que ele virtualiza e
     * RECRIA no scroll = briga perdida), eu LEIO os dados de cada post (harvest) e
     * renderizo CARDS MEUS (.igf-card) num container MEU (.igf-feed). Sabendo a proporção
     * da mídia, reservo a altura via aspect-ratio ANTES de carregar → masonry determinístico,
     * append-only, nada se mexe. A lista nativa fica viva off-screen (.igf-src) só pra
     * abastecer dados e manter o IG carregando ao rolar.
     * ============================================================================ */
    const MAXCOLS = 3, MINCOLW = 280, TOP_PAD = 8;   // auto: até 3 colunas; itens menores vêm da página estreita (--igm-maxw)
    const LOADMORE_ROUNDS = 10, GROWTH_MAX_MS = 1600;   // por chamada: até N páginas; cada rodada espera os posts CHEGAREM (event-driven), não sleep fixo
    let GAP = 24;   // gap entre cards — vira 14 no modo compacto (applySettings)
    const MAXRATIO = 1.9;                                       // teto de altura/largura → vídeo não passa a viewport
    const PLAY_SVG = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';
    // ícones da barra de ações (outline, herdam currentColor)
    const ICO = {
        like: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
        comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 20.5l1.4-4.1A8.4 8.4 0 0 1 3.5 11.5a8.5 8.5 0 0 1 17 0z"/></svg>',
        repost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
        share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
        save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
        open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
        link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>',
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        chevL: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
        chevR: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>',
    };
    const SPIN_HTML = '<div class="igf-spin"></div><span>Carregando mais…</span>';
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const posts = new Map();        // key -> dados do post (dedup por permalink)
    const order = [];               // keys na ordem de harvest
    const rendered = new Set();     // keys já renderizados
    const carouselWait = new Map(); // key -> 1ª vez vista como galeria (espera os slides da API p/ ter ‹ ›)
    let feedEl = null, igSrc = null, srcMO = null, srcMOTarget = null, resizeBound = false, layoutQ = false;
    let feedCols = [], feedNcols = 0, feedColw = 0;
    let loaderEl = null, loaderIO = null, loading = false, nativePauseTimer = null, feedExhausted = false;
    const raf = (typeof requestAnimationFrame !== "undefined") ? requestAnimationFrame : (cb) => setTimeout(cb, 16);

    function postKey(a) {
        const link = a.querySelector('a[href*="/p/"], a[href*="/reel/"]');
        if (!link) return null;
        const m = (link.pathname || link.getAttribute("href") || "").match(/\/(?:p|reel)\/[^/?#]+/);
        if (!m) return null;
        if (a.dataset.igfKey !== m[0]) a.dataset.igfKey = m[0];   // hint p/ nativeArticle (lá é VERIFICADO — React pode reciclar o nó com outro post)
        return m[0];
    }
    // lê um post de um <article> do IG. true se um NOVO post entrou.
    function harvestPost(a) {
        const key = postKey(a);
        if (!key || posts.has(key)) return false;
        const box = a.querySelector('[style*="470px"]');
        if (!box) return false;
        const video = box.querySelector("video");
        // o carrier de 470px só contém a MÍDIA (o avatar fica no header, fora dele) → 1ª img = a mídia/poster
        const mainImg = box.querySelector("img");
        const media = (video && video.getAttribute("poster")) || (mainImg && mainImg.src) || "";
        if (!media && !video) return false;             // post de imagem sem img ainda → tenta depois (vídeo sem poster vira placeholder)
        // proporção NATURAL (altura/largura) — NÃO trava em 4:5. Pego do nativo já carregado;
        // só caio no spacer do IG (4:5 capado) se a mídia ainda não tem dimensão. `natural` diz
        // se já é a real (senão o card atualiza quando a mídia carregar de fato).
        let ratio = 0, natural = false;
        if (video && video.videoWidth) { ratio = video.videoHeight / video.videoWidth; natural = true; }
        else if (mainImg && mainImg.naturalWidth) { ratio = mainImg.naturalHeight / mainImg.naturalWidth; natural = true; }
        if (!ratio) { const spacer = box.querySelector('[style*="padding-bottom"]'); if (spacer) { const m = (spacer.getAttribute("style") || "").match(/padding-bottom:\s*([\d.]+)%/); if (m) ratio = +m[1] / 100; } }
        ratio = Math.max(0.4, Math.min(ratio || 1, MAXRATIO));
        const prof = [...a.querySelectorAll("a")].map((l) => l.pathname || "").find((p) => /^\/[^/]+\/$/.test(p) && !/^\/(explore|reels|p|reel)\//.test(p));
        const author = prof ? prof.replace(/\//g, "") : "";
        const avatar = a.querySelector('img[alt*="profile" i]') || a.querySelector("img");
        const capEl = a.querySelector("h1");
        const link = a.querySelector('a[href*="/p/"], a[href*="/reel/"]');
        // contadores (na área de ações, DEPOIS da mídia, em ordem: like, comment, repost)
        const nums = [];
        let afterMedia = false;
        for (const e of a.querySelectorAll("span, a, div")) {
            if (e === box || box.contains(e)) { afterMedia = true; continue; }
            if (!afterMedia || e.children.length) continue;
            const t = (e.textContent || "").trim();
            if (/^\d[\d.,]*\s?[KMmilB]*$/.test(t) && t.length < 10 && !nums.includes(t)) { nums.push(t); if (nums.length >= 3) break; }
        }
        // follow: existe um botão "Follow"/"Seguir" no post? (= ainda não sigo)
        let canFollow = false;
        for (const b of a.querySelectorAll('button, [role="button"]')) {
            if (/^(follow|seguir)$/i.test((b.textContent || "").trim())) { canFollow = true; break; }
        }
        posts.set(key, {
            key, code: codeOf(key), href: (link.pathname || link.getAttribute("href") || ""), author,
            avatar: avatar ? avatar.src : "", media, isVideo: !!video, ratio,
            caption: capEl ? (capEl.textContent || "").trim().slice(0, 220) : "",
            likes: nums[0] || "", comments: nums[1] || "", reposts: nums[2] || "", follow: canFollow, natural,
        });
        order.push(key);
        return true;
    }
    // chave de um TILE (o próprio <a> é o item; href tem /p/CODE ou /{user}/p/CODE)
    function tileKey(a) {
        const href = a.getAttribute("href") || a.href || "";
        const m = href.match(/\/(?:p|reel)\/[^/?#]+/);
        if (!m) return null;
        if (a.dataset.igfKey !== m[0]) a.dataset.igfKey = m[0];
        return m[0];
    }
    // lê um TILE (explore/profile) → post só-mídia. Proporção REAL: API (igMedia w/h) → senão naturalW/H
    // do thumbnail (o IG serve a imagem em aspecto real e só CORTA por CSS p/ quadrado) → senão 1:1.
    function harvestTile(a) {
        const key = tileKey(a);
        if (!key || posts.has(key)) return false;
        const code = codeOf(key);
        const rec = igMedia.get(code) || {};
        // CARD COMPLETO (explore/salvos): renderiza JÁ com a mídia; autor/avatar/legenda são PREENCHIDOS depois,
        // quando o igMedia ingere a resposta da API (updateCardsMeta) — em vez de esperar (o 1º lote saía sem header).
        const img = a.querySelector("img");
        const vid = a.querySelector("video");   // tiles de REEL no explore são <video> (sem <img>) → pego o poster
        // PRIORIDADE = thumbUrl da API (pequena, proporção real, disponível assim que o JSON é lido — NÃO espera
        // o <img> da grade nativa off-screen carregar, que é o gargalo). Fallbacks: img/poster nativo, imagem cheia.
        const media = rec.thumbUrl || (img && img.getAttribute("src")) || (vid && (vid.getAttribute("poster") || vid.poster)) || rec.imageUrl || "";
        if (!media) return false;                             // sem poster/thumb ainda → NÃO commita (re-tenta quando renderizar) → nunca tela preta
        const isVideo = !!rec.isVideo || !!vid || !!a.querySelector('svg[aria-label="Reel" i], svg[aria-label="Clip" i], svg[aria-label*="eel" i], svg[aria-label*="lip" i]');
        const iconCarousel = !!a.querySelector('svg[aria-label*="arousel" i]');   // ícone de galeria no tile
        const hasSlides = !!(rec.carousel && rec.carousel.length > 1);
        // GALERIA: se o tile É galeria mas a API ainda não trouxe os slides, ESPERA até ~1.5s (a navegação ‹ ›
        // precisa deles). Sem isto, harvestava cedo demais e a galeria virava capa única (sem setas).
        if (iconCarousel && !hasSlides) {
            const t0 = carouselWait.get(key);
            if (!t0) { carouselWait.set(key, Date.now()); return false; }
            if (Date.now() - t0 < 1500) return false;         // ainda esperando os slides
        }
        const isCarousel = hasSlides || iconCarousel;
        let ratio = 0, natural = false;
        if (rec.h && rec.w) { ratio = rec.h / rec.w; natural = true; }
        else if (img && img.naturalWidth) { ratio = img.naturalHeight / img.naturalWidth; natural = true; }
        else if (vid && vid.videoWidth) { ratio = vid.videoHeight / vid.videoWidth; natural = true; }
        ratio = Math.max(0.4, Math.min(ratio || 1, MAXRATIO));
        posts.set(key, {
            key, code, href: (a.getAttribute("href") || a.href || ""), media, isVideo, tile: true, carouselIcon: isCarousel, ratio, natural,
            // dados p/ o CARD COMPLETO (explore/salvos): vêm da API (igMedia), não do DOM do tile
            author: rec.author || "", avatar: rec.avatar || "", caption: rec.caption || "", likes: rec.likes || "", comments: rec.comments || "", reposts: "",
            authorPk: rec.authorPk || "", following: rec.following, follow: rec.following !== true,   // mostra "Seguir" a menos que JÁ siga
        });
        order.push(key);
        return true;
    }
    const go = (href) => { if (href) location.href = href; };
    // URL canônica e LIMPA do post (sem ?igsh=/utm de tracking) — montada do code, não da href com query
    function cleanPostUrl(p) {
        const code = p.code || codeOf(p.key);
        const kind = /\/reel\//.test(p.href) ? "reel" : "p";
        return code ? (location.origin + "/" + kind + "/" + code + "/") : (location.origin + (p.href || "/"));
    }
    function fallbackCopy(text, done) {   // sem navigator.clipboard (http/permita) → execCommand
        try {
            const ta = el("textarea", { style: { position: "fixed", top: "-1000px", opacity: "0" } });
            ta.value = text; (document.body || document.documentElement).appendChild(ta); ta.focus(); ta.select();
            document.execCommand("copy"); ta.remove(); if (done) done();
        } catch (_) { /**/ }
    }
    function copyLink(p, btn) {            // share = COPIAR o link limpo pro clipboard (+ feedback de check)
        const url = cleanPostUrl(p);
        const done = () => {
            btn.classList.add("igf-copied"); btn.innerHTML = ICO.check; btn.title = "Link copiado";
            setTimeout(() => { btn.classList.remove("igf-copied"); btn.innerHTML = ICO.link; btn.title = "Copiar link"; }, 1500);
        };
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
            else fallbackCopy(url, done);
        } catch (_) { fallbackCopy(url, done); }
    }
    // ABRIR A MODAL (overlay sobre o feed), não navegar. O <a> de permalink (`/p/CODE/`) só NAVEGA →
    // página do post ("outra página"). A modal in-feed é aberta por `openPostModalForId` (bundle), que
    // dispara no onClick do BOTÃO DE COMENTÁRIO nativo (PolarisCommentButton → no desktop dá
    // preventDefault + abre a modal, SEM navegar). Então o alvo certo é esse botão — não o link.
    function nativeModalTrigger(art) {
        if (!art) return null;
        // ícone de comentário (locale varia: Comment / Comentar / Comentário) → seu botão clicável (role=button)
        const svg = art.querySelector('svg[aria-label="Comment" i], svg[aria-label="Comentar" i], svg[aria-label="Comentário" i], svg[aria-label*="omment" i], svg[aria-label*="oment" i]');
        return svg ? svg.closest('[role="button"], button, a') : null;
    }
    function clickModalTrigger(key) {
        const btn = nativeModalTrigger(nativeArticle(key));
        if (btn) { btn.click(); return true; }   // React processa o clique sintético → openPostModalForId → overlay
        return false;
    }
    // clico o botão de comentário NATIVO → overlay. PORÉM a lista nativa fica off-screen (.igf-src) e o IG
    // VIRTUALIZA: o artigo do card clicado pode não estar no DOM. Aí rolo o igSrc até a fração visual desse
    // card pra forçar o re-render e re-tento. Último recurso (~900ms): go() = NAVEGA pra página do post.
    function openPost(p, card) {
        if (!igSrc || !igSrc.isConnected) applyFeed();   // igSrc sumiu/ficou stale (modal re-renderizou o feed) → re-aponta antes de tentar
        if (clickModalTrigger(p.key)) return;
        bringNativeIntoView(p, card, 0);
    }
    // tile (explore/profile): o item nativo É um <a>; clicá-lo abre o post em MODAL (o IG intercepta o
    // onClick e faz history.push sem sair da página). Off-screen (.igf-src) → o .click() programático passa.
    function nativeTile(key) {
        if (!igSrc) return null;
        for (const a of igSrc.querySelectorAll(GRID_SEL)) if (tileKey(a) === key) return a;
        return null;
    }
    function openItem(p, card) { return p.tile ? openTile(p, card) : openPost(p, card); }   // dispatch home↔grid
    function openTile(p, card, tries) {
        if (!igSrc || !igSrc.isConnected) applyGrid();
        const a = nativeTile(p.key);
        if (a) { a.click(); return; }                                  // → modal do IG (clicar o tile NATIVO abre o lightbox)
        // tile nativo virtualizado (off-screen) → rola a grade nativa pra renderizá-lo e re-tenta. SÓ navega como
        // último recurso (o usuário quer MODAL, não a página). Centralizo o tile na janela off-screen + mais tentativas.
        if (!igSrc || (tries || 0) > 18) { go(cleanPostUrl(p)); return; }
        if (!loading) {
            const max = Math.max(0, igSrc.scrollHeight - igSrc.clientHeight);
            const n = order.length || 1, idx = Math.max(0, order.indexOf(p.key));
            const frac = n > 1 ? idx / (n - 1) : 0;
            igSrc.scrollTop = Math.max(0, Math.min(max, frac * max - igSrc.clientHeight / 2));   // CENTRALIZA (mais chance de renderizar)
        }
        setTimeout(() => openTile(p, card, (tries || 0) + 1), 90);
    }
    function bringNativeIntoView(p, card, tries) {
        if (clickModalTrigger(p.key)) return;
        if (!igSrc || tries > 7) { go(cleanPostUrl(p)); return; }   // desisti → navega pra página do post
        if (!loading) {                                             // loadMore controla o scrollTop; não brigo
            const max = Math.max(0, igSrc.scrollHeight - igSrc.clientHeight);
            let frac;
            if (card && card.isConnected) {                         // fração visual REAL do card clicado (mais preciso que índice)
                const top = (window.scrollY || 0) + card.getBoundingClientRect().top;
                const docMax = Math.max(1, document.documentElement.scrollHeight - (window.innerHeight || 800));
                frac = Math.min(1, Math.max(0, top / docMax));
            } else {
                const n = order.length || 1, idx = Math.max(0, order.indexOf(p.key));
                frac = n > 1 ? idx / (n - 1) : 0;
            }
            // varre ±~2vh em torno da estimativa ao longo das tentativas (cobre erro de virtualização)
            igSrc.scrollTop = Math.max(0, Math.min(max, frac * max + (tries - 3) * igSrc.clientHeight * 0.5));
        }
        setTimeout(() => bringNativeIntoView(p, card, tries + 1), 110);
    }
    // acha o <article> nativo (vivo no igSrc) pelo permalink — p/ like/follow real e mover o vídeo.
    // FAST-PATH pelo data-igf-key estampado no postKey (chamado por frame de scroll via syncSrcScroll):
    // o loop antigo fazia querySelector por artigo, por chamada. O hint é re-verificado (postKey re-estampa
    // se o React reciclou o nó); mismatch → cai no loop completo.
    function nativeArticle(key) {
        if (!igSrc || !key) return null;
        const hint = igSrc.querySelector('article[data-igf-key="' + key + '"]');
        if (hint && postKey(hint) === key) return hint;
        for (const a of igSrc.querySelectorAll("article")) if (postKey(a) === key) return a;
        return null;
    }
    function likePost(p, btn) {
        const art = nativeArticle(p.key);
        const svg = art && art.querySelector('svg[aria-label="Like" i], svg[aria-label="Curtir" i], svg[aria-label="Unlike" i], svg[aria-label="Descurtir" i]');
        const nb = svg && svg.closest('[role="button"], button, a, div');
        if (nb) { nb.click(); btn.classList.toggle("on"); }   // clica o like nativo (best-effort) + feedback
        else go(p.href);
    }
    // salva DIRETO clicando o bookmark nativo (não abre modal). Mesmo padrão do followPost: se o artigo
    // foi virtualizado, traz pra perto e re-tenta; NUNCA abre a página/modal (salvar é só salvar).
    function savePost(p, btn, tries) {
        const art = nativeArticle(p.key);
        const svg = art && art.querySelector('svg[aria-label="Save" i], svg[aria-label="Salvar" i], svg[aria-label="Remove" i], svg[aria-label="Remover" i]');
        const nb = svg && svg.closest('[role="button"], button, a, div');
        if (nb) { nb.click(); btn.classList.toggle("on"); return; }   // clica o salvar nativo + feedback
        if (!igSrc || (tries || 0) > 7) return;                        // desisti
        if (!loading) {
            const max = Math.max(0, igSrc.scrollHeight - igSrc.clientHeight);
            const n = order.length || 1, idx = Math.max(0, order.indexOf(p.key));
            igSrc.scrollTop = Math.max(0, Math.min(max, (n > 1 ? idx / (n - 1) : 0) * max + ((tries || 0) - 3) * igSrc.clientHeight * 0.5));
        }
        setTimeout(() => savePost(p, btn, (tries || 0) + 1), 110);
    }
    // ações do CARD do GRID (explore/salvos) — não há artigo nativo p/ clicar → via API (toggle, reverte se falhar).
    function likeGrid(p, card, btn) {
        const pk = pkOf(p);
        if (!pk) { openItem(p, card); return; }               // sem pk → abre o modal (curte lá)
        const on = !btn.classList.contains("on");
        btn.classList.toggle("on", on);
        igApiPost("/api/v1/web/likes/" + pk + (on ? "/like/" : "/unlike/"), "").then((ok) => { if (!ok) btn.classList.toggle("on", !on); });
    }
    function saveGrid(p, card, btn) {
        if (surface === "saved") { unsaveTile(p, card, btn); return; }   // salvos: o "salvar" É des-salvar (+ some o card)
        const pk = pkOf(p);
        if (!pk) { openItem(p, card); return; }
        const on = !btn.classList.contains("on");
        btn.classList.toggle("on", on);
        igApiPost("/api/v1/web/save/" + pk + (on ? "/save/" : "/unsave/"), "").then((ok) => { if (!ok) btn.classList.toggle("on", !on); });
    }
    function followGrid(p, btn) {   // seguir/deixar de seguir via API (explore/salvos — sem botão nativo)
        const upk = p.authorPk || (igMedia.get(p.code || codeOf(p.key)) || {}).authorPk;
        if (!upk) { openItem(p, null); return; }
        const wasFollowing = btn.classList.contains("on");
        const next = !wasFollowing;
        btn.classList.toggle("on", next); btn.textContent = next ? "Seguindo" : "Seguir";
        igApiPost("/api/v1/friendships/" + (next ? "create" : "destroy") + "/" + upk + "/", "").then((ok) => {
            if (!ok) { btn.classList.toggle("on", wasFollowing); btn.textContent = wasFollowing ? "Seguindo" : "Seguir"; }
        });
    }
    // segue clicando o botão nativo (vivo no igSrc). Se o <article> foi virtualizado (saiu da janela viva
    // do igSrc no scroll), traz de volta pra perto e re-tenta — NUNCA navega pra página (o botão é só seguir).
    function followPost(p, btn, tries) {
        const art = nativeArticle(p.key);
        let nb = null;
        if (art) for (const b of art.querySelectorAll('button, [role="button"]')) if (/^(follow|seguir|following|seguindo)$/i.test((b.textContent || "").trim())) { nb = b; break; }
        if (nb) { nb.click(); const on = btn.classList.toggle("on"); btn.textContent = on ? "Seguindo" : "Seguir"; return; }
        if (!igSrc || (tries || 0) > 7) return;               // desisti — fica em "Seguir", sem navegar
        if (!loading) {                                       // traz o nativo pra janela viva (mesmo padrão do openPost/bringNativeIntoView)
            const max = Math.max(0, igSrc.scrollHeight - igSrc.clientHeight);
            const n = order.length || 1, idx = Math.max(0, order.indexOf(p.key));
            igSrc.scrollTop = Math.max(0, Math.min(max, (n > 1 ? idx / (n - 1) : 0) * max + ((tries || 0) - 3) * igSrc.clientHeight * 0.5));
        }
        setTimeout(() => followPost(p, btn, (tries || 0) + 1), 110);
    }

    // --- vídeo no card: toca APENAS no HOVER do mouse (muted = autoplay-safe). ---
    // Hover entra → empresta o <video> NATIVO desse card + toca. Hover sai / sai da tela → DEVOLVE
    // (remove o vídeo emprestado) e volta o poster. Crucial: o IG vira a MediaSource quando virtualiza
    // o artigo → o vídeo emprestado fica PRETO. Por isso NÃO acumulo vídeos mortos nos cards: solto-os.
    let videoIO = null, pickQ = false, hoverCard = null;
    const visVids = new Set();   // cards de vídeo VISÍVEIS (mantém o nativo por perto → hover instantâneo)
    const videoState = new Map();   // code -> currentTime: retoma de onde parou quando o vídeo é recriado (sai/volta do hover)
    let feedSoundOn = false;        // intenção GLOBAL de som no feed: o 1º unmute (gesto) liga; novos vídeos já entram com som
    function ensureVideoIO() {
        if (videoIO || typeof IntersectionObserver === "undefined") return;
        videoIO = new IntersectionObserver((ents) => {
            for (const e of ents) {
                if (e.isIntersecting) visVids.add(e.target);
                else { visVids.delete(e.target); if (hoverCard === e.target) hoverCard = null; releaseVideo(e.target); }   // saiu da tela → devolve (evita preto)
            }
        }, { threshold: [0, 0.5] });
    }
    // só o card sob o MOUSE toca; os demais DEVOLVEM o vídeo (poster). (re-avaliado no hover e quando os natives mudam)
    function pickVideos() {
        for (const card of visVids) if (card !== hoverCard) releaseVideo(card);
        if (hoverCard && hoverCard.isConnected) activateVideo(hoverCard);
    }
    function queuePick() { if (pickQ) return; pickQ = true; raf(() => { pickQ = false; pickVideos(); }); }
    function onCardEnter(card) { hoverCard = card; syncSrcScroll(); activateVideo(card); }   // sync traz o nativo; activate tenta já
    function onCardLeave(card) { if (hoverCard === card) hoverCard = null; releaseVideo(card); }
    function activateVideo(card) {
        const media = card.querySelector(".igf-video");
        if (!media) return;
        let v = media.querySelector("video");
        if (!v) {                                          // ainda não tem vídeo no card → cria
            const rec = igMedia.get(card.dataset.code || "");
            if (rec && rec.videoUrl) {
                // CAMINHO BOM: MEU <video> com a URL .mp4 REAL da API → confiável, recriável, sem preto
                v = el("video", { src: rec.videoUrl, preload: "auto", playsinline: "", "webkit-playsinline": "" });
                v.loop = true; v.playsInline = true; v.dataset.igOwn = "1";
                v.muted = !feedSoundOn;                          // preserva a intenção de som (não re-muta a cada hover)
                try { v.volume = prefs.volume; } catch (_) { /**/ }
                const savedT = videoState.get(card.dataset.code || "");   // retoma de onde parou
                if (savedT) v.addEventListener("loadedmetadata", () => { try { if (savedT < (v.duration || 1e9)) v.currentTime = savedT; } catch (_) { /**/ } }, { once: true });
                v.addEventListener("volumechange", () => { feedSoundOn = !v.muted && v.volume > 0; });   // (des)mutou → intenção global segue
                v.addEventListener("error", () => releaseVideo(card), { once: true });   // URL expirada → volta o poster (sem tela preta)
            } else {
                // FALLBACK: empresta o <video> nativo (menos confiável; some/preto ao virtualizar)
                const art = nativeArticle(card.dataset.key);
                v = art && art.querySelector("video");
                if (!v) return;                            // sem URL e sem nativo → fica o poster
                v.muted = true;
            }
            if (!media.querySelector("[data-instancekey]")) media.appendChild(el("div", { "data-instancekey": "igf" }));   // âncora p/ o player mirar a MÍDIA
            media.appendChild(v);
            media.classList.add("on");
            if (!card.classList.contains("igf-tile")) { try { attach(v); } catch (_) { /**/ } }   // feed: barra de player. tile: preview limpo (sem barra)
            const upd = () => { if (v.videoWidth) updateRatio(card, media, v.videoHeight / v.videoWidth); };   // proporção REAL do vídeo
            if (v.videoWidth) upd(); else v.addEventListener("loadedmetadata", upd, { once: true });
        }
        try {
            v.loop = true; v.playsInline = true;
            const pr = v.play && v.play();
            // som sem gesto pode ser bloqueado pela política de autoplay → cai pra mudo (mas toca)
            if (pr && pr.catch) pr.catch(() => { try { v.muted = true; const p2 = v.play(); if (p2 && p2.catch) p2.catch(() => {}); } catch (_) { /**/ } });
        } catch (_) { /**/ }
    }
    // devolve o vídeo emprestado: pausa, destrói a barra do player, REMOVE o <video> (que morre ao
    // virtualizar → preto) e volta o poster. Próximo hover empresta um nativo FRESCO.
    function releaseVideo(card) {
        const media = card && card.querySelector(".igf-video");
        const v = media && media.querySelector("video");
        if (!v) return;
        try { v.pause(); } catch (_) { /**/ }
        const code = card.dataset.code;                                            // guarda a posição p/ retomar ao recriar
        if (code && v.dataset.igOwn) { const t = v.currentTime; if (isFinite(t) && t > 0) videoState.set(code, t); }
        const ctrl = controllers.get(v);
        if (ctrl && ctrl.destroy) { try { ctrl.destroy(); } catch (_) { /**/ } }   // remove a barra + listeners
        try { v.remove(); } catch (_) { /**/ }
        const dummy = media.querySelector('[data-instancekey="igf"]'); if (dummy) dummy.remove();
        media.classList.remove("on");                                              // poster + badge de play reaparecem
    }
    function observeVideoCard(card) {
        if (card.dataset.vio || !card.querySelector(".igf-video")) return;
        ensureVideoIO();
        if (videoIO) { videoIO.observe(card); card.dataset.vio = "1"; }
    }

    // mantém a lista nativa (off-screen) ALINHADA ao card de vídeo MAIS CENTRAL da tua viewport
    // → o <video> nativo dos cards que você está VENDO fica vivo (não virtualizado) e pronto p/ tocar.
    // (Antes alinhava por ratio global: o nativo do card visível caía fora da janela → não tocava,
    //  enquanto um card menos visível, cujo nativo por acaso estava vivo, é que tocava.)
    let syncQ = false;
    function centeredVideoCard() {              // card de vídeo mais perto do centro da tela (âncora p/ o nativo)
        if (!visVids.size) return null;
        const vh = window.innerHeight || 800; let best = null, bestD = Infinity;
        for (const card of visVids) {
            if (!card.isConnected) continue;
            const r = card.getBoundingClientRect();
            if (Math.min(r.bottom, vh) - Math.max(r.top, 0) < 60) continue;   // praticamente fora da tela
            const d = Math.abs((r.top + r.bottom) / 2 - vh / 2);
            if (d < bestD) { bestD = d; best = card; }
        }
        return best;
    }
    function syncSrcScroll(retry) {
        if (syncQ) return; syncQ = true;
        raf(() => {
            syncQ = false;
            if (!igSrc || loading) return;
            const anchor = (hoverCard && hoverCard.isConnected) ? hoverCard : centeredVideoCard();   // hover manda; senão o card central
            const art = anchor && nativeArticle(anchor.dataset.key);
            if (art) {
                // centraliza o ARTIGO nativo dentro do igSrc → natives da região visível ficam vivos.
                // DEAD-BAND: o nativo só precisa estar PERTO do centro, não pixel-perfeito — o nudge de
                // scrollTop a cada frame re-disparava a virtualização do React, que disparava o srcMO,
                // que re-harvestava… um loop de churn alimentado pelo próprio scroll.
                const sr = igSrc.getBoundingClientRect(), ar = art.getBoundingClientRect();
                const delta = (ar.top - sr.top) - (igSrc.clientHeight / 2 - ar.height / 2);
                if (Math.abs(delta) > (igSrc.clientHeight || 480) / 3) igSrc.scrollTop += delta;
                queuePick();                                   // nativo certo agora existe → toca o card central
            } else {
                // âncora ainda não renderizada (virtualizada) → aproxima por ratio e afina 1x quando renderizar
                const docMax = (document.documentElement.scrollHeight - (window.innerHeight || 800)) || 1;
                const r = Math.min(1, Math.max(0, (window.scrollY || 0) / docMax));
                const srcMax = igSrc.scrollHeight - igSrc.clientHeight;
                if (srcMax > 0 && Math.abs(igSrc.scrollTop - r * srcMax) > (igSrc.clientHeight || 480) / 3) igSrc.scrollTop = r * srcMax;   // mesmo dead-band
                if (!retry) raf(() => syncSrcScroll(true));
            }
        });
    }

    // altura da mídia mudou (proporção real só veio no load) → re-mede e re-empacota essa posição
    function updateRatio(card, media, r) {
        if (!r || !isFinite(r)) return;
        r = Math.max(0.4, Math.min(r, MAXRATIO));
        const ar = (1 / r).toFixed(4);
        if (media.style.aspectRatio === ar) return;
        media.style.aspectRatio = ar;
        delete card.dataset.h; delete card.dataset.final;     // altura nova → re-mede + re-posiciona
        queueLayout();
    }
    // galeria/carrossel: navega os slides com SETAS (+ dots + contador). Slides ficam na proporção do POST
    // (cover) → o masonry NÃO reflui ao trocar de slide. Slide de vídeo mostra a capa + ▶ (toca abrindo a modal).
    function buildCarousel(p, card, slides) {
        const wrap = el("a", { class: "igf-media igf-carousel", href: cleanPostUrl(p) });
        wrap.style.aspectRatio = (1 / p.ratio).toFixed(4);
        wrap.addEventListener("click", (e) => {               // clicar o slide → modal (ctrl/cmd/meio = nova aba)
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
            e.preventDefault(); openItem(p, card);            // home → modal in-feed; tile → clica o <a> nativo
        });
        let idx = 0;
        const stage = el("div", { class: "igf-cstage" });
        const prev = el("button", { class: "igf-cnav igf-cprev", type: "button", "aria-label": "Anterior", html: ICO.chevL });
        const next = el("button", { class: "igf-cnav igf-cnext", type: "button", "aria-label": "Próximo", html: ICO.chevR });
        const dots = el("div", { class: "igf-cdots" });
        for (let i = 0; i < slides.length; i++) dots.appendChild(el("span", { class: "igf-cdot" }));
        const counter = el("div", { class: "igf-ccount" });
        function render() {
            const s = slides[idx] || {};
            stage.textContent = "";
            stage.appendChild(el("img", { src: s.thumbUrl || s.imageUrl || p.media || "", loading: "lazy", decoding: "async", alt: "" }));
            if (s.isVideo) stage.appendChild(el("div", { class: "igf-play", html: PLAY_SVG }));   // capa de vídeo: ▶ (abre na modal)
            for (let i = 0; i < dots.children.length; i++) dots.children[i].classList.toggle("on", i === idx);
            counter.textContent = (idx + 1) + "/" + slides.length;
            prev.hidden = idx === 0;
            next.hidden = idx === slides.length - 1;
        }
        const step = (d) => { const ni = clamp(idx + d, 0, slides.length - 1); if (ni === idx) return; idx = ni; render(); };
        const nav = (d, e) => { e.preventDefault(); e.stopPropagation(); step(d); };
        prev.addEventListener("click", (e) => nav(-1, e));
        next.addEventListener("click", (e) => nav(1, e));
        // SCROLL HORIZONTAL do mouse/trackpad (ou shift+roda) navega os slides — 1 por gesto (lock + acúmulo).
        let wheelAcc = 0, wheelLock = false;
        wrap.addEventListener("wheel", (e) => {
            const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
            if (!dx) return;                                 // gesto vertical puro → deixa a página rolar
            e.preventDefault(); e.stopPropagation();
            if (wheelLock) return;
            wheelAcc += dx;
            if (Math.abs(wheelAcc) >= 40) {                  // limiar → 1 passo (trackpad manda muitos deltas pequenos)
                step(wheelAcc > 0 ? 1 : -1);
                wheelAcc = 0; wheelLock = true;
                setTimeout(() => { wheelLock = false; }, 240);
            }
        }, { passive: false });
        wrap.append(stage, prev, next, counter, dots);
        render();
        return wrap;
    }
    // tile só-mídia (explore/profile): mídia na proporção real + badge de reel/galeria; clique abre em modal.
    const TILE_REEL = '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    const TILE_CAROUSEL = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/></svg>';
    function buildTile(p) {   // só PERFIL (só-mídia). home/explore/salvos = card completo (buildCard).
        const code = p.code || codeOf(p.key);
        const card = el("div", { class: "igf-card igf-tile", "data-key": p.key, "data-code": code });
        // GALERIA: se a API trouxe os slides, usa o carrossel (setas ‹ ›, dots, contador, scroll horizontal) — igual ao card da home
        const slides = (igMedia.get(code) || {}).carousel;
        if (slides && slides.length > 1) {
            card.appendChild(buildCarousel(p, card, slides));
            card.dataset.loaded = "1";                        // altura já reservada pela proporção do post
        } else {
            const media = p.isVideo ? el("div", { class: "igf-media igf-video" }) : el("a", { class: "igf-media", href: cleanPostUrl(p) });
            media.style.aspectRatio = (1 / p.ratio).toFixed(4);
            if (p.media) {
                const img = el("img", { src: p.media, loading: "lazy", decoding: "async", alt: "" });
                img.addEventListener("load", () => { if (!p.natural && img.naturalWidth) updateRatio(card, media, img.naturalHeight / img.naturalWidth); card.dataset.loaded = "1"; queueLayout(); }, { once: true });
                media.appendChild(img);
            } else card.dataset.loaded = "1";
            if (p.isVideo) media.appendChild(el("div", { class: "igf-tile-badge", html: TILE_REEL }));
            else if (p.carouselIcon) media.appendChild(el("div", { class: "igf-tile-badge", html: TILE_CAROUSEL }));
            media.addEventListener("click", (e) => {          // clique → abre o post em MODAL (fica na página)
                if (e.target.closest && e.target.closest(".igvc-bar")) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // ctrl/cmd/meio = nova aba
                e.preventDefault(); openTile(p, card);
            });
            if (p.isVideo) {                                  // reels: preview muda no hover (sem barra de player)
                media.addEventListener("mouseenter", () => onCardEnter(card));
                media.addEventListener("mouseleave", () => onCardLeave(card));
            }
            card.appendChild(media);
        }
        return card;
    }
    function removeTileCard(card) { if (card) { card.remove(); feedNcols = 0; queueLayout(); } }   // some com o tile + re-empacota
    const pkOf = (p) => (igMedia.get(p.code || codeOf(p.key)) || {}).pk;
    // unsave DIRETO via API do IG → Promise<bool> (ok). Sem modal.
    function unsaveApi(pk) {
        const csrf = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || "";
        return fetch("/api/v1/web/save/" + pk + "/unsave/", {
            method: "POST", credentials: "include", body: "",
            headers: { "X-CSRFToken": csrf, "X-IG-App-ID": igAppId, "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded" },
        }).then((r) => r.ok).catch(() => false);
    }
    // REMOVER DOS SALVOS (1 tile) — direto via API; fallback: a "dança do modal".
    function unsaveTile(p, card, btn) {
        const pk = pkOf(p);
        if (!pk) { unsaveViaModal(p, card, btn); return; }   // sem pk (API não veio) → fallback modal
        btn.classList.add("igf-busy");
        unsaveApi(pk).then((ok) => { if (ok) removeTileCard(card); else { btn.classList.remove("igf-busy"); unsaveViaModal(p, card, btn); } });
    }
    // ===== MULTISSELEÇÃO nos salvos: toolbar "Selecionar" → marca tiles → "Remover dos salvos" em lote =====
    let savedSelectMode = false, savedToolbar = null, savedToolbarSync = null;
    const savedSelected = new Map();   // key -> card
    function setSelectMode(on) {
        savedSelectMode = !!on;
        if (!savedSelectMode) { for (const c of savedSelected.values()) c.classList.remove("igf-sel"); savedSelected.clear(); closeCollectionMenu(); }
        if (feedEl) feedEl.classList.toggle("igf-selecting", savedSelectMode);
        if (savedToolbarSync) savedToolbarSync();
    }
    function toggleSelect(p, card) {
        if (savedSelected.has(p.key)) { savedSelected.delete(p.key); card.classList.remove("igf-sel"); }
        else { savedSelected.set(p.key, card); card.classList.add("igf-sel"); }
        if (savedToolbarSync) savedToolbarSync();
    }
    async function removeSelected() {
        const entries = [...savedSelected.entries()];
        if (!entries.length) return;
        setSelectMode(false);                                // sai do modo (limpa marca/set), mas já capturei os itens
        for (const [key, card] of entries) {                 // serial (não martela a API do IG)
            const p = posts.get(key); if (!p) { removeTileCard(card); continue; }
            const pk = pkOf(p);
            if (pk) { if (await unsaveApi(pk)) removeTileCard(card); }
            else { card.remove(); }                           // sem pk (raro) → some só visualmente
        }
        feedNcols = 0; queueLayout();
    }
    function buildSavedToolbar() {
        const bar = el("div", { class: "igf-savedbar" });
        const count = el("span", { class: "igf-sb-count" });
        const sel = el("button", { class: "igf-sb-btn igf-sb-sel", type: "button" }, "Selecionar");
        const cancel = el("button", { class: "igf-sb-btn igf-sb-ghost", type: "button" }, "Cancelar");
        const coll = el("button", { class: "igf-sb-btn igf-sb-ghost igf-sb-coll", type: "button" }, "Mover p/ coleção ▾");
        const remove = el("button", { class: "igf-sb-btn igf-sb-danger", type: "button" }, "Remover dos salvos");
        sel.addEventListener("click", () => setSelectMode(true));
        cancel.addEventListener("click", () => setSelectMode(false));
        coll.addEventListener("click", (e) => { e.stopPropagation(); openCollectionMenu(coll); });
        remove.addEventListener("click", () => removeSelected());
        bar.append(el("span", { class: "igf-sb-sp" }), count, sel, cancel, coll, remove);
        savedToolbarSync = () => {
            bar.classList.toggle("on", savedSelectMode);
            const n = savedSelected.size;
            count.textContent = n ? (n + " selecionado" + (n > 1 ? "s" : "")) : "Toque pra selecionar";
            for (const b of [remove, coll]) { if (n) b.removeAttribute("disabled"); else b.setAttribute("disabled", ""); }
        };
        savedToolbarSync();
        return bar;
    }
    // ===== MOVER PARA COLEÇÃO (best-effort: endpoints privados do IG, não verificáveis no snapshot) =====
    function igApiPost(path, body) {
        const csrf = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || "";
        return fetch(path, { method: "POST", credentials: "include", body,
            headers: { "X-CSRFToken": csrf, "X-IG-App-ID": igAppId, "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded" },
        }).then((r) => r.ok).catch(() => false);
    }
    const selectedPks = () => [...savedSelected.keys()].map((key) => { const p = posts.get(key); return p ? pkOf(p) : null; }).filter(Boolean);
    async function moveSelectedToCollection(collectionId, newName) {
        const pks = selectedPks();
        if (!pks.length) { toast("Sem ids de mídia (a API ainda não trouxe)"); return; }
        const ids = encodeURIComponent(JSON.stringify(pks));
        const ok = newName
            ? await igApiPost("/api/v1/collections/create/", "name=" + encodeURIComponent(newName) + "&added_collection_media_ids=" + ids)
            : await igApiPost("/api/v1/collections/" + collectionId + "/edit/", "added_collection_media_ids=" + ids);
        toast(ok ? ("Movido p/ " + (newName || igCollections.get(collectionId) || "coleção")) : "Falhou ao mover (endpoint mudou?)");
        setSelectMode(false);
    }
    let igCollMenu = null;
    function closeCollectionMenu() { if (igCollMenu) { igCollMenu.remove(); igCollMenu = null; document.removeEventListener("click", collMenuCloser, true); } }
    function collMenuCloser(e) { if (igCollMenu && !igCollMenu.contains(e.target)) closeCollectionMenu(); }
    function openCollectionMenu(anchor) {
        closeCollectionMenu();
        const menu = el("div", { class: "igf-collmenu" });
        if (igCollections.size) {
            menu.appendChild(el("div", { class: "igf-cm-head" }, "Adicionar à coleção"));
            for (const [id, name] of igCollections) {
                const b = el("button", { class: "igf-cm-item", type: "button" }, name);
                b.addEventListener("click", () => { closeCollectionMenu(); moveSelectedToCollection(id, null); });
                menu.appendChild(b);
            }
        }
        const nb = el("button", { class: "igf-cm-item igf-cm-new", type: "button" }, "+ Nova coleção");
        nb.addEventListener("click", () => { closeCollectionMenu(); const name = prompt("Nome da nova coleção:"); if (name && name.trim()) moveSelectedToCollection(null, name.trim()); });
        menu.appendChild(nb);
        const r = anchor.getBoundingClientRect();
        menu.style.top = (r.bottom + 6) + "px"; menu.style.right = Math.max(8, (window.innerWidth - r.right)) + "px";
        (document.body || document.documentElement).appendChild(menu);
        igCollMenu = menu;
        setTimeout(() => document.addEventListener("click", collMenuCloser, true), 0);
    }
    let igToastEl = null, igToastT = 0;
    function toast(msg) {
        if (!igToastEl) { igToastEl = el("div", { class: "igf-toast" }); (document.body || document.documentElement).appendChild(igToastEl); }
        igToastEl.textContent = msg; igToastEl.classList.add("show");
        clearTimeout(igToastT); igToastT = setTimeout(() => igToastEl.classList.remove("show"), 2400);
    }
    // FALLBACK (sem pk / API falhou): abre a modal, clica o salvar (preenchido = des-salva), fecha e some o card.
    function unsaveViaModal(p, card, btn) {
        const a = nativeTile(p.key);
        if (!a) { openTile(p, card); return; }
        btn.classList.add("igf-busy");
        a.click();                                            // abre a modal
        let tries = 0;
        const iv = setInterval(() => {
            tries++;
            const dlg = document.querySelector('[role="dialog"]');
            const svg = dlg && dlg.querySelector('svg[aria-label="Remove" i], svg[aria-label="Remover" i], svg[aria-label="Save" i], svg[aria-label="Salvar" i]');
            const sb = svg && svg.closest('[role="button"], button, div[role="button"]');
            if (sb) {
                clearInterval(iv);
                sb.click();                                   // des-salva
                // fecha a modal (botão X, senão Escape) e remove o card
                setTimeout(() => {
                    const x = dlg.querySelector('svg[aria-label="Close" i], svg[aria-label="Fechar" i]');
                    const xb = x && x.closest('[role="button"], button');
                    if (xb) xb.click(); else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
                    removeTileCard(card);
                }, 140);
            } else if (tries > 30) { clearInterval(iv); btn.classList.remove("igf-busy"); }
        }, 110);
    }
    function buildCard(p) {
        if (p.tile && surface === "profile") return buildTile(p);   // PERFIL = tile só-mídia; home/explore/salvos = card completo
        const grid = !!p.tile;                                      // explore/salvos: sem artigo nativo → ações via API/modal
        const code = p.code || codeOf(p.key);
        const card = el("div", { class: "igf-card" + (surface === "saved" ? " igf-card-saved" : ""), "data-key": p.key, "data-code": code });
        const profHref = p.author ? "/" + p.author + "/" : p.href;
        const head = el("div", { class: "igf-head" });
        const who = el("a", { class: "igf-who", href: profHref });   // nome/avatar → PERFIL
        if (p.avatar) who.appendChild(el("img", { src: p.avatar, loading: "lazy", alt: "" }));
        who.appendChild(el("b", {}, p.author || ""));
        head.appendChild(who);
        if (p.follow) {                                       // botão de seguir (só quando ainda não sigo) — home + explore + salvos
            const fb = el("button", { class: "igf-follow" }, "Seguir");
            fb.addEventListener("click", () => grid ? followGrid(p, fb) : followPost(p, fb));
            head.appendChild(fb);
        }
        card.appendChild(head);
        const slides = (igMedia.get(code) || {}).carousel;    // carrossel? (todos os slides vieram da API)
        const isCarousel = !!(slides && slides.length > 1);
        let media;
        if (isCarousel) {
            media = buildCarousel(p, card, slides);            // galeria: setas + dots + contador (slides em cover na ratio do post)
            card.dataset.loaded = "1";                         // altura já reservada pela proporção do post
        } else {
            // mídia: imagem = link pro post; vídeo = autoplay/pause (hover) + click liga/desliga som
            media = p.isVideo ? el("div", { class: "igf-media igf-video" }) : el("a", { class: "igf-media", href: cleanPostUrl(p) });
            if (!p.isVideo) media.addEventListener("click", (e) => {   // clique na IMAGEM → modal do IG (post + comentários), sem sair da página
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // ctrl/cmd/meio = deixa abrir em nova aba
                e.preventDefault(); openItem(p, card);
            });
            media.style.aspectRatio = (1 / p.ratio).toFixed(4);   // reserva a altura ANTES do load (proporção REAL, não 4:5)
            if (p.media) {
                const img = el("img", { src: p.media, loading: "lazy", alt: "" });
                img.addEventListener("load", () => {              // proporção real ao carregar (se não veio do nativo) + congela
                    if (!p.natural && img.naturalWidth) updateRatio(card, media, img.naturalHeight / img.naturalWidth);
                    card.dataset.loaded = "1"; queueLayout();
                }, { once: true });
                media.appendChild(img);
            } else card.dataset.loaded = "1";                     // vídeo sem poster → já "pronto" (placeholder)
            if (p.isVideo) {
                media.appendChild(el("div", { class: "igf-play", html: PLAY_SVG }));
                media.addEventListener("mouseenter", () => onCardEnter(card));   // hover → toca só este
                media.addEventListener("mouseleave", () => onCardLeave(card));   // saiu → pausa
                media.addEventListener("click", (e) => {
                    if (e.target.closest && e.target.closest(".igvc-bar")) return;   // clique no player (seek/mudo/etc) → ignora
                    if (grid) { e.preventDefault(); openItem(p, card); return; }     // explore/salvos: clique no vídeo → MODAL
                    const v = media.querySelector("video");
                    if (v) { v.muted = !v.muted; if (v.paused) { try { v.play(); } catch (_) { /**/ } } }   // home: clique = liga/desliga som
                    else { hoverCard = card; activateVideo(card); }
                });
            }
        }
        card.appendChild(media);
        // barra de ações única abaixo da mídia
        const actions = el("div", { class: "igf-actions" });
        const act = (icon, count, onClick, cls) => {
            const b = el("button", { class: "igf-act" + (cls ? " " + cls : "") });
            b.innerHTML = icon;
            if (count) b.appendChild(el("span", {}, count));
            b.addEventListener("click", onClick);
            return b;
        };
        actions.appendChild(act(ICO.like, p.likes, (e) => grid ? likeGrid(p, card, e.currentTarget) : likePost(p, e.currentTarget), "igf-like"));
        actions.appendChild(act(ICO.comment, p.comments, () => openItem(p, card)));   // → modal (comentários)
        actions.appendChild(act(ICO.repost, p.reposts, () => openItem(p, card)));
        const sh = act(ICO.link, "", (e) => copyLink(p, e.currentTarget), "igf-share"); sh.title = "Copiar link";
        actions.appendChild(sh);                              // share → COPIAR link limpo (sem tracking)
        actions.appendChild(el("div", { class: "igf-act-sp" }));
        const sv = act(ICO.save, "", (e) => grid ? saveGrid(p, card, e.currentTarget) : savePost(p, e.currentTarget), "igf-save");
        sv.title = surface === "saved" ? "Remover dos salvos" : "Salvar";
        if (surface === "saved") sv.classList.add("on");      // já está salvo → bookmark preenchido (clicar des-salva + some o card)
        actions.appendChild(sv);
        card.appendChild(actions);
        if (surface === "saved") {                            // overlay de multisseleção (cobre o card no modo seleção)
            const ovl = el("div", { class: "igf-selovl" }, el("div", { class: "igf-selcb" }));
            ovl.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(p, card); });
            card.appendChild(ovl);
        }
        if (p.caption) card.appendChild(el("div", { class: "igf-cap" }, p.caption));   // SÓ a descrição (o nome já está no header)
        return card;
    }

    // ---- masonry: card já CARREGADO congela a COLUNA (não salta de coluna no scroll); o que ainda
    //      carrega é dinâmico (coluna mais curta). O TOP é SEMPRE o fundo corrente da coluna → quando a
    //      proporção real chega (updateRatio muda a altura de um card acima), ele e os de baixo na MESMA
    //      coluna descem juntos, o resto fica parado, e dois cards na mesma coluna NUNCA se sobrepõem. ----
    function placeCard(card, colw, ncols) {
        let col;
        const sc = card.dataset.col;
        if (card.dataset.final && sc !== undefined && +sc < ncols) {
            col = +sc;                                        // COLUNA congelada (não salta de coluna)
        } else {
            col = 0; for (let k = 1; k < ncols; k++) if (feedCols[k] < feedCols[col]) col = k;   // shortest-column
            card.dataset.col = String(col);
            if (card.dataset.loaded) card.dataset.final = "1";   // mídia carregada → congela a COLUNA
        }
        // TOP não congela: vem do fundo corrente da coluna. Card de cima que muda de altura tarde
        // empurra os de baixo (correto), em vez de ser invadido por um top absoluto stale (= sobreposição).
        const top = feedCols[col];
        card.dataset.top = String(Math.round(top));
        if (card.style.position !== "absolute") card.style.position = "absolute";
        // writes GUARDADOS: sem mudança de altura o top recalculado bate com o anterior — escrever idêntico
        // ainda suja o style; comparar antes torna o re-layout de 500 cards ~500 comparações de string, zero writes
        const L = (col * (colw + GAP)) + "px", T = Math.round(top) + "px";
        if (card.style.left !== L) card.style.left = L;
        if (card.style.top !== T) card.style.top = T;
        let h = card.dataset.h ? +card.dataset.h : 0;
        if (!h) {
            h = card.offsetHeight;
            if (h) card.dataset.h = String(h);               // só PERSISTE altura real medida; 0 (ainda sem layout) re-mede no próximo frame
            else h = Math.round(colw * 1.25 + 150);          // estimativa só deste frame (não grava → não congela altura errada)
        }
        feedCols[col] = top + h + GAP;
    }
    function feedMetrics() {
        const cw = feedEl.clientWidth || Math.round(feedEl.getBoundingClientRect().width);
        if (cw < 120) return null;
        const minw = prefs.density === "compact" ? 230 : MINCOLW;   // compacto: colunas mais estreitas → cabe mais
        let ncols = Math.max(1, Math.floor((cw + GAP) / (minw + GAP)));
        if (prefs.cols && prefs.cols !== "auto") {                  // nº de colunas FORÇADO (header), com piso de ~180px/coluna
            const fit = Math.max(1, Math.floor((cw + GAP) / (180 + GAP)));
            ncols = Math.max(1, Math.min(+prefs.cols, fit));
        } else if (ncols > MAXCOLS) ncols = MAXCOLS;
        return { ncols, colw: Math.max(1, Math.floor((cw - (ncols - 1) * GAP) / ncols)) };
    }
    function layoutFeed() {
        if (!feedEl || !feedEl.isConnected) return;
        const m = feedMetrics();
        if (!m) return;
        const { ncols, colw } = m;
        feedEl.style.setProperty("--igf-colw", colw + "px");
        const cards = [...feedEl.children].filter((c) => c.classList && c.classList.contains("igf-card"));
        if (ncols !== feedNcols || colw !== feedColw) {            // resize → re-empacota do zero (descongela)
            feedNcols = ncols; feedColw = colw;
            for (const c of cards) { delete c.dataset.final; delete c.dataset.col; delete c.dataset.top; delete c.dataset.h; }
        }
        feedCols = new Array(ncols).fill(TOP_PAD);
        // PRÉ-MEDE em lote os sem altura (reads juntos ANTES dos writes do place): no resize (que limpa
        // todos os dataset.h) o offsetHeight intercalado com left/top forçava um layout síncrono POR card
        for (const c of cards) if (!c.dataset.h) { const h = c.offsetHeight; if (h) c.dataset.h = String(h); }
        for (const card of cards) placeCard(card, colw, ncols);    // congelados restauram, resto é dinâmico
        const H = Math.round(feedCols.length ? Math.max.apply(null, feedCols) : 0) + "px";
        if (feedEl.style.height !== H) feedEl.style.height = H;
        positionLoader();
    }
    function positionLoader() { if (loaderEl) loaderEl.style.minHeight = "40px"; }   // (loader flui após o feed)
    function queueLayout() { if (layoutQ) return; layoutQ = true; raf(() => { layoutQ = false; layoutFeed(); }); }

    // coalesce as rajadas de mutação do IG (durante o load ele muta MUITO) num harvest por frame → 1º paint mais leve
    let syncFeedQ = false;
    function queueSyncFeed() { if (syncFeedQ) return; syncFeedQ = true; raf(() => { syncFeedQ = false; syncOwnFeed(); }); }
    // harvest da lista do IG → renderiza os novos cards → masonry
    let lastHarvestSig = "";
    function syncOwnFeed() {
        if (!feedEl || !igSrc) return;
        // BAILOUT: assinatura da janela montada (contagem + 1º/último permalink). O srcMO + o scan
        // disparam isto a cada churn do React — que o NOSSO scroll-sync induz — e sem mudança real
        // o harvest+layout completos rodavam por frame de scroll (O(N) cards, crescendo com a sessão).
        const arts = itemsIn(igSrc);
        const n = arts.length;
        const sig = n ? (n + "|" + (keyOf(arts[0]) || "") + "|" + (keyOf(arts[n - 1]) || "")) : "0";
        // bailout só quando JÁ TEM cards: se o feed está VAZIO (React removeu/recriou, ou 1º paint), nunca
        // baila → re-tenta o harvest todo scan até aparecer algo (evita ficar travado em "só o spinner").
        if (rendered.size > 0 && sig === lastHarvestSig && rendered.size === order.length) { if (!loading) queuePick(); return; }
        lastHarvestSig = sig;
        for (const a of arts) harvestOne(a);
        for (const key of order) {
            if (rendered.has(key)) continue;
            const card = buildCard(posts.get(key));
            feedEl.appendChild(card);
            rendered.add(key);
            observeVideoCard(card);   // vídeo → rastreia visibilidade (toca no hover)
        }
        if (rendered.size) { unmountBoot(); if (igSrc) igSrc.classList.add("igf-src"); }   // 1º card real → tira o skeleton + esconde a grade nativa (grid: só agora, pra não dar tela preta)
        else if (surface !== "home" && igSrc) igSrc.classList.remove("igf-src");           // GRID vazio → mostra a grade NATIVA (nunca deixa só o spinner numa tela vazia)
        updateCardsMeta();      // preenche autor/avatar/legenda dos cards que renderizaram antes do igMedia
        layoutFeed();
        if (!loading) queuePick();
    }
    // PREENCHE o header (autor/avatar/seguir) + legenda dos cards de GRID que renderizaram antes da API trazer os
    // metadados (igMedia). Roda quando o igMedia ingere uma resposta + a cada syncOwnFeed.
    let metaUpdQ = false;
    function queueMetaUpdate() { if (metaUpdQ) return; metaUpdQ = true; raf(() => { metaUpdQ = false; updateCardsMeta(); }); }
    function updateCardsMeta() {
        if (!feedEl || surface === "home" || surface === "profile") return;   // só grids de CARD completo (explore/salvos)
        let relayout = false;
        for (const card of feedEl.children) {
            if (!card.classList || !card.classList.contains("igf-card") || card.dataset.metaDone) continue;
            const rec = igMedia.get(card.dataset.code);
            if (!rec || (!rec.author && !rec.caption)) continue;
            const p = posts.get(card.dataset.key); if (!p) continue;
            if (rec.author) p.author = rec.author;
            if (rec.avatar) p.avatar = rec.avatar;
            if (rec.caption) p.caption = rec.caption;
            if (rec.authorPk) p.authorPk = rec.authorPk;
            const who = card.querySelector(".igf-who");
            if (who && p.author) {
                who.setAttribute("href", "/" + p.author + "/");
                if (p.avatar && !who.querySelector("img")) who.insertBefore(el("img", { src: p.avatar, loading: "lazy", alt: "" }), who.firstChild);
                const b = who.querySelector("b"); if (b && b.textContent !== p.author) b.textContent = p.author;
            }
            if (rec.following === true) { const fb = card.querySelector(".igf-follow"); if (fb) fb.remove(); }   // já sigo → tira o "Seguir"
            if (p.caption && !card.querySelector(".igf-cap")) {
                card.appendChild(el("div", { class: "igf-cap" }, p.caption));
                delete card.dataset.h; delete card.dataset.final; relayout = true;   // legenda mudou a ALTURA → re-empacota
            }
            card.dataset.metaDone = "1";
        }
        if (relayout) { feedNcols = 0; queueLayout(); }
    }
    // espera CHEGAR POST NOVO → resolve ASSIM QUE chega, ou após maxMs (rede lenta / fim).
    // CRÍTICO: mede crescimento por `order.length` (nossa lista append-only/dedupada), NÃO pelo nº de <article>
    // renderizados — o IG VIRTUALIZA a lista off-screen (renderiza embaixo, REMOVE em cima), então a contagem
    // de <article> fica ~constante mesmo carregando páginas → o detector antigo só batia no timeout (10s+).
    // `order` só cresce quando um permalink INÉDITO aparece → imune à virtualização.
    function waitForNewPosts(beforeOrder, maxMs) {
        return new Promise((resolve) => {
            const src = igSrc;
            if (!src) return resolve(false);
            let done = false;
            const finish = (grew) => { if (done) return; done = true; try { obs.disconnect(); } catch (_) { /**/ } clearInterval(iv); clearTimeout(to); resolve(grew); };
            const check = () => {
                if (igSrc !== src) return finish(false);          // trocou de superfície no meio → para
                for (const a of itemsIn(src)) harvestOne(a);      // harvest baila barato em key já vista
                if (order.length > beforeOrder) finish(true);
            };
            const obs = new MutationObserver(check);
            try { obs.observe(src, { childList: true, subtree: true }); } catch (_) { /**/ }
            const iv = setInterval(check, 100);
            const to = setTimeout(() => finish(false), maxMs);
            check();
        });
    }
    // puxa VÁRIAS páginas de uma vez: rola a lista nativa off-screen p/ re-disparar o loader do IG, espera os
    // posts CHEGAREM (event-driven, por order.length), renderiza, repete — até LOADMORE_ROUNDS páginas por chamada.
    // BUMP: scrollTop=max parado NÃO re-dispara o IntersectionObserver do loader do IG (precisa SAIR e VOLTAR).
    // OBS: a paginação do IG é por CURSOR (sequencial) → não dá pra buscar páginas em paralelo; o ganho é não
    // esperar sleep fixo + pré-carregar um buffer grande à frente (rootMargin) por rodada de scroll.
    async function loadMore() {
        if (loading || !igSrc || feedExhausted) return;
        loading = true;
        const src = igSrc, surf = surface;   // captura: navegar/trocar de superfície no meio (teardown) zera igSrc → abortar
        const rounds = surf === "home" ? LOADMORE_ROUNDS : 4;   // grid: menos páginas por disparo (tiles em massa pesam)
        let empties = 0;
        for (let i = 0; i < rounds && empties < 2; i++) {
            if (igSrc !== src || surface !== surf) break;   // desmontou/trocou → para (evita scroll em nó morto)
            const before = order.length;
            src.scrollTop = Math.max(0, src.scrollHeight - src.clientHeight * 2);   // SOBE (loader sai da viewport)
            await sleep(50);
            if (igSrc !== src) break;
            src.scrollTop = src.scrollHeight;                                       // DESCE até o fim (loader re-entra → IG busca)
            const grew = await waitForNewPosts(before, GROWTH_MAX_MS);              // resolve no 1º post inédito (early-out)
            if (igSrc !== src) break;
            syncOwnFeed();                                                          // renderiza os novos cards JÁ
            empties = grew ? 0 : empties + 1;
        }
        if (igSrc !== src) return;          // outra superfície assumiu → não mexo no loading/layout dela
        loading = false; layoutFeed();
        // PERFIL é FINITO (um perfil tem N posts) → 2 rodadas vazias = acabou: ESCONDE o spinner (senão gira pra
        // sempre num perfil de 6 posts). Home E explore NÃO: são ~infinitos (recomendações) → 2 vazias = só
        // rede/timing (falso-positivo), mantém o spinner.
        if ((surf === "profile" || surf === "saved") && empties >= 2) { feedExhausted = true; if (loaderEl) loaderEl.classList.add("igf-done"); }
    }
    // gatilho redundante por SCROLL: não depende do IntersectionObserver re-disparar (era o que sumia o
    // loading e exigia "sobe e desce"). Toda rolagem, se o spinner está perto do fim da tela → puxa mais.
    function maybeLoadMore() {
        if (loading || !loaderEl) return;
        const r = loaderEl.getBoundingClientRect();
        if (r.top < (window.innerHeight || 800) + (surface === "home" ? 4500 : 1500)) loadMore();   // grid: lookahead menor (menos itens vivos)
    }
    // classes do feed dirigidas pelas flags: sombra / densidade / legenda / contadores
    function applyFeedClasses() {
        if (!feedEl) return;
        feedEl.classList.toggle("igf-shadow", !!prefs.cardShadow);
        feedEl.classList.toggle("igf-dense", prefs.density === "compact");
        feedEl.classList.toggle("igf-nocap", !prefs.showCaption);
        feedEl.classList.toggle("igf-nocounts", !prefs.showCounts);
    }
    // tema REAL do IG (independe do OS): luminância do fundo (--ig-background, fallback bg do body).
    function isDarkTheme() {
        try {
            const v = getComputedStyle(document.documentElement).getPropertyValue("--ig-background").trim();
            let rgb = null;
            if (v) { const m = v.split(",").map((s) => parseFloat(s)); if (m.length >= 3 && m.every((x) => !isNaN(x))) rgb = m; }
            if (!rgb) { const bg = getComputedStyle(document.body || document.documentElement).backgroundColor; const m = bg && bg.match(/[\d.]+/g); if (m && m.length >= 3) rgb = m.map(Number); }
            if (!rgb) return true;
            return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) < 128;
        } catch { return true; }
    }
    let lastDark = null;
    function applyTheme() {   // toggla html.igf-dark (guard "mudou?" → não reescreve a cada scan)
        const dark = isDarkTheme();
        if (dark === lastDark) return;
        lastDark = dark;
        document.documentElement.classList.toggle("igf-dark", dark);
    }
    function mountOwnFeed(list, cwrap) {
        let src = list;                              // igSrc = branch dos cards (filho do cwrap que contém a lista)
        while (src.parentElement && src.parentElement !== cwrap) src = src.parentElement;
        igSrc = src;
        // home: esconde a nativa JÁ (harvest confiável, o skeleton cobre). GRID (explore/profile): só esconde
        // DEPOIS que renderizar o 1º card (em syncOwnFeed) → se o harvest falhar, a grade NATIVA continua à
        // mostra em vez de tela preta.
        if (surface === "home") igSrc.classList.add("igf-src");
        if (!feedEl || !feedEl.isConnected) {
            feedEl = el("div", { class: "igf-feed" });
            applyFeedClasses();                      // sombra/densidade/legenda/contadores desde o 1º paint
            cwrap.appendChild(feedEl);               // meu feed depois das stories
            if (surface === "saved") { savedToolbar = buildSavedToolbar(); cwrap.insertBefore(savedToolbar, feedEl); }   // toolbar de multisseleção ACIMA do mosaico
            loaderEl = el("div", { class: "igf-loader" + (feedExhausted ? " igf-done" : "") }); loaderEl.innerHTML = SPIN_HTML;
            cwrap.appendChild(loaderEl);             // spinner no fim (escondido se o grid já esgotou) — feedback + sentinela do carregar-mais
            rendered.clear(); feedNcols = 0;         // feed novo (React pode ter removido) → re-renderiza + re-empacota
            ingestInlineJSON();                      // posts iniciais (server-render) → já tenho URLs de mídia/vídeo
            // F5: o igMedia (autor/legenda) pode chegar DEPOIS que a página assentou (sem mais mutações p/ re-disparar).
            // Poll por alguns segundos preenchendo o header/legenda dos cards conforme a API chega.
            [600, 1500, 3000, 5000, 8000].forEach((t) => setTimeout(() => { if (feedEl) updateCardsMeta(); }, t));
            layoutFeed();
            if (typeof IntersectionObserver !== "undefined") {
                if (loaderIO) loaderIO.disconnect();
                // grid (explore/profile): prefetch MENOS agressivo — os tiles são leves mas em massa pesam (decode/layout)
                loaderIO = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) loadMore(); }, { rootMargin: surface === "home" ? "4500px" : "1500px" });
                loaderIO.observe(loaderEl);          // perto do fim (ou feed curto no início) → puxa páginas
            }
        } else if (feedEl.parentElement !== cwrap) {
            // o React re-renderizou o cwrap (grade nova) e ÓRFÃO o nosso feed → MOVE p/ o cwrap atual (mantém os
            // cards, sem recriar). Sem isto, o feed velho ficava num lugar e a grade nova aparecia visível ao lado.
            cwrap.appendChild(feedEl);
            if (loaderEl) cwrap.appendChild(loaderEl);
        }
        if (typeof MutationObserver !== "undefined" && srcMOTarget !== igSrc) {   // re-aponta o observer quando a grade muda (React re-render)
            if (!srcMO) srcMO = new MutationObserver(queueSyncFeed); else srcMO.disconnect();
            srcMO.observe(igSrc, { childList: true, subtree: true });
            srcMOTarget = igSrc;
        }
        if (!resizeBound && typeof window.addEventListener === "function") {
            resizeBound = true;
            window.addEventListener("resize", queueLayout, { passive: true });
            // 1 rAF coalescido p/ o trio (antes o maybeLoadMore lia rect do loader em TODO evento cru de scroll)
            let scrollQ = false;
            window.addEventListener("scroll", () => {
                if (scrollQ) return; scrollQ = true;
                // GRID não usa vídeo nativo (toca o nosso da API) → NÃO roda syncSrcScroll: ele rolava a grade
                // nativa a cada scroll, fazendo o IG renderizar/decodificar mais = principal lag no explore.
                raf(() => { scrollQ = false; if (surface === "home") syncSrcScroll(); queuePick(); maybeLoadMore(); });
            }, { passive: true });
        }
        // o IG autoplaya os vídeos da lista off-screen (decode invisível = lag). Eu só preciso
        // deles VIVOS, não tocando → pauso periodicamente os que não movi pro meu card.
        if (!nativePauseTimer && typeof setInterval === "function" && typeof IntersectionObserver !== "undefined") nativePauseTimer = setInterval(pauseNativeVideos, 1000);
        syncOwnFeed();
    }
    function pauseNativeVideos() {
        if (!igSrc) return;
        // só PAUSA + muta (seguro). NÃO sobrescrevo .play() — o explore do IG depende do playback dos previews
        // pra a lógica da própria grade; matar o play travava o render (grade some → só o spinner).
        for (const v of igSrc.querySelectorAll("video")) { v.muted = true; if (!v.paused) { try { v.pause(); } catch (_) { /**/ } } }
    }
    function teardownOwnFeed() {
        if (srcMO) { srcMO.disconnect(); srcMO = null; } srcMOTarget = null;
        if (loaderIO) { loaderIO.disconnect(); loaderIO = null; }
        if (videoIO) { videoIO.disconnect(); videoIO = null; }
        if (nativePauseTimer) { clearInterval(nativePauseTimer); nativePauseTimer = null; }
        visVids.clear(); hoverCard = null; videoState.clear(); feedSoundOn = false;
        if (igSrc) { igSrc.classList.remove("igf-src"); igSrc = null; }
        if (feedEl) { feedEl.remove(); feedEl = null; }
        if (loaderEl) { loaderEl.remove(); loaderEl = null; }
        if (savedToolbar) { savedToolbar.remove(); savedToolbar = null; savedToolbarSync = null; }
        savedSelectMode = false; savedSelected.clear();
        posts.clear(); order.length = 0; rendered.clear(); carouselWait.clear(); lastHarvestSig = "";
        feedCols = []; feedNcols = 0; feedColw = 0; loading = false; feedExhausted = false;
    }

    // wrapper comum que contém stories + cards = o filho do col que contém a lista
    function contentWrapper(col, list) {
        let w = list;
        while (w.parentElement && w.parentElement !== col) w = w.parentElement;
        return w;
    }
    // a tray de stories (atributo semântico estável do IG)
    function storiesTray(col) {
        return col.querySelector('[data-pagelet="story_tray"]') || col.querySelector('[aria-label*="Stories" i]');
    }

    let chromeApplied = false;   // alguma classe .igm-* viva no DOM → o unmasonry tem o que limpar
    function applyNavPin() {
        if (!prefs.masonry || !prefs.pinNav) {   // flag off → garante que nenhum nav fica pinado
            for (const e of document.querySelectorAll(".igm-navpin")) e.classList.remove("igm-navpin");
            return;
        }
        if (document.querySelector(".igm-navpin")) return;
        const box = leftNavWidthBox();
        if (box) { box.classList.add("igm-navpin"); chromeApplied = true; }
    }
    function applyFeed() {
        const list = feedArticleList();
        if (!list) return;
        const split = feedColumnSplit(list);
        if (!split) return;   // sem a estrutura conhecida → não monto o feed próprio (evita bagunça)
        // scaffolding: da lista até o col tudo full-width (.igm-wide, tira o cap de 630), MENOS o
        // wrapper-comum (.igm-content, capado) → stories + meu feed centram juntos = alinhados.
        const cwrap = contentWrapper(split.col, list);
        chromeApplied = true;
        for (let n = list.parentElement, i = 0; n && n.tagName !== "MAIN" && i < 16; n = n.parentElement, i++) {
            n.classList.add(n === cwrap ? "igm-content" : "igm-wide");
            if (n === split.col) break;
        }
        // offset só se o feed começa SOB o nav (overlay); senão dobraria o respiro
        const navBox = document.querySelector(".igm-navpin") || leftNavWidthBox();
        const navW = navBox ? (navBox.getBoundingClientRect().width || 72) : 0;
        const colLeft = split.col.getBoundingClientRect().left;
        split.col.classList.toggle("igm-col", navW > 0 && colLeft < navW - 4);
        const tray = storiesTray(split.col);
        if (tray) tray.classList.add("igm-stories");
        for (const r of split.rails) r.classList.toggle("igm-norail", !!prefs.hideRail);   // flag: esconder coluna direita
        mountOwnFeed(list, cwrap);   // esconde a lista nativa + renderiza MEU feed em masonry
    }
    // ===== EXPLORE / PROFILE: grade de tiles → mosaico próprio =====
    // a "grade" = ancestral mais baixo que abraça a maioria dos tiles (eles vêm agrupados em linhas).
    function gridContainer() {
        let tiles = [...document.querySelectorAll("main " + GRID_SEL)].filter((a) => a.querySelector("img, svg, video"));
        // PREFERE a grade NOVA/visível: quando o React re-renderiza, a grade antiga continua no DOM já
        // ESCONDIDA (.igf-src) → ignoro-a pra não confundir a detecção (era a causa do "grade nativa + nosso
        // mosaico aparecerem juntos"). Se TODOS estão escondidos (steady state) → uso todos (re-assert).
        const fresh = tiles.filter((a) => !a.closest(".igf-src"));
        if (fresh.length >= 4) tiles = fresh;
        if (tiles.length < 4) return null;
        // sobe até o ancestral que contém TODOS os tiles (a GRADE inteira). Threshold de 80% deixava 1 tile de
        // fora (ex.: perfil de 6 posts) → ele ficava VISÍVEL (grid nativo aparecendo). Guarda o de maior contagem
        // como fallback (caso algum tile esteja numa seção separada).
        let best = null, bestN = 0;
        for (let n = tiles[0].parentElement, d = 0; d < 16 && n && n.tagName !== "MAIN"; d++, n = n.parentElement) {
            const c = tiles.reduce((s, t) => s + (n.contains(t) ? 1 : 0), 0);
            if (c > bestN) { bestN = c; best = n; }
            if (c === tiles.length) return n;   // contém TODOS → é a grade
        }
        return bestN >= Math.max(4, Math.floor(tiles.length * 0.8)) ? best : null;
    }
    function applyGrid() {
        const grid = gridContainer();
        if (!grid || !grid.parentElement) return;   // grade ainda não montou (ou estrutura desconhecida)
        const cwrap = grid.parentElement;
        // COLUNA = ancestral mais alto logo abaixo do <main> → engloba o HEADER do perfil + o grid.
        let col = grid;
        while (col.parentElement && col.parentElement.tagName !== "MAIN" && col.parentElement !== document.body) col = col.parentElement;
        chromeApplied = true;
        // offset do nav: medir pelo <main> (estável) — col.left mudaria DEPOIS da centragem, quebrando o teste.
        const main = col.closest("main") || document.querySelector("main");
        const navBox = leftNavWidthBox();
        const navW = navBox ? (navBox.getBoundingClientRect().width || 72) : 0;
        const underNav = navW > 0 && main && main.getBoundingClientRect().left < navW - 4;
        for (let n = grid; n && n !== col; n = n.parentElement) n.classList.add("igm-wide");   // tira os caps internos do IG
        // a COLUNA inteira (header + grid) ganha a MESMA largura/centragem do feed da home (--igm-maxw)
        col.classList.add("igm-content", "igm-gridcol");
        if (underNav) col.classList.add("igm-gridnav");   // main nasce sob o nav fixo → desloca p/ centrar em (viewport − nav), igual home
        mountOwnFeed(grid, cwrap);   // grid vira .igf-src (off-screen, vivo) + renderiza nosso mosaico
    }
    // skeleton de ABERTURA (grade fixa) mostrado o quanto antes na home; sai no 1º card real ou no timeout.
    let bootEl = null, bootTimer = null;
    function mountBoot() {
        if (bootEl || !prefs.masonry || !isHome() || rendered.size) return;   // já tem cards (ex.: voltou de uma modal) → sem flash de skeleton
        bootEl = el("div", { class: "igf-boot" });
        const grid = el("div", { class: "igf-boot-grid" });
        const hs = [340, 440, 300, 400, 320, 480, 360, 420, 380, 300, 460, 340];
        for (let i = 0; i < 12; i++) { const c = el("div", { class: "igf-boot-cell" }); c.style.height = hs[i % hs.length] + "px"; grid.appendChild(c); }
        bootEl.appendChild(grid);
        (document.body || document.documentElement).appendChild(bootEl);
        if (bootTimer) clearTimeout(bootTimer);
        bootTimer = setTimeout(() => { if (!rendered.size) unmountBoot(); }, 9000);   // segurança: nunca cobrir o IG p/ sempre
    }
    function unmountBoot() { if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; } if (bootEl) { bootEl.remove(); bootEl = null; } }
    function syncMasonry() {
        applyTheme();    // mantém html.igf-dark em dia com o tema atual do IG (claro/escuro)
        const surf = targetSurface();
        if (surf !== mountedSurface) { unmasonry(); lastHarvestSig = ""; mountedSurface = surf; }   // trocou de superfície → limpa tudo (sig inclusive)
        applyNavPin();   // gating próprio (masonry && pinNav) — só home
        if (surf === "home") { surface = "home"; if (isHome()) mountBoot(); applyFeed(); }
        else if (surf === "explore" || surf === "profile" || surf === "saved") { surface = surf; applyGrid(); }
        else unmasonry();
    }
    function unmasonry() {
        unmountBoot();
        // sem nada aplicado, não há o que limpar — sem este flag os 5 querySelectorAll full-doc rodavam
        // a CADA burst de mutação em reels/stories (as superfícies mais churnentas do IG), sempre vazios
        if (!chromeApplied) return;
        chromeApplied = false;
        teardownOwnFeed();   // tira o off-screen da lista nativa + remove meu feed
        for (const e of document.querySelectorAll(".igm-wide")) e.classList.remove("igm-wide");
        for (const e of document.querySelectorAll(".igm-content")) e.classList.remove("igm-content");
        for (const e of document.querySelectorAll(".igm-gridnav")) e.classList.remove("igm-gridnav");
        for (const e of document.querySelectorAll(".igm-gridcol")) e.classList.remove("igm-gridcol");
        for (const e of document.querySelectorAll(".igm-col")) e.classList.remove("igm-col");
        for (const e of document.querySelectorAll(".igm-stories")) e.classList.remove("igm-stories");
        for (const e of document.querySelectorAll(".igm-norail")) e.classList.remove("igm-norail");
    }

    /* ------------------------------------------------------------------ *
     * Scan + observação (debounced) + SPA. Sem polling permanente.
     * ------------------------------------------------------------------ */
    let retryPending = false;
    const retryCount = new WeakMap();   // tentativas de attach por <video> sem layout (cap anti-polling)
    function scheduleRetry() {
        if (retryPending) return;
        retryPending = true;
        setTimeout(() => { retryPending = false; scan(); }, 400);   // vídeo sem layout ainda
    }

    function scan() {
        // poda mortos / reconstrói barras que o React removeu
        for (const v of [...live]) {
            const c = controllers.get(v);
            if (!v.isConnected) { c && c.destroy(); continue; }
            if (c && c.bar && !c.bar.isConnected) { c.destroy(); }   // será re-attachado abaixo
        }
        for (const v of document.querySelectorAll("video")) {
            if (bound.has(v)) continue;
            const r = v.getBoundingClientRect();
            if (r.width < MIN_SIZE || r.height < MIN_SIZE) {
                // CAP por vídeo: preload 0x0 PERSISTENTE (comum em reels/stories) re-agendava o scan
                // a cada 400ms p/ sempre — vira polling permanente. Se ele ganhar tamanho depois,
                // a própria mutação do React dispara o scanSoon e o attach acontece por evento.
                const n = (retryCount.get(v) || 0) + 1; retryCount.set(v, n);
                if (n <= 5) scheduleRetry();
                continue;
            }
            attach(v);
        }
        syncMasonry();
        ensurePanel();   // FAB do painel sobrevive aos re-renders do IG (SPA)
        if (prefs.hideMessages) tagMessagesDock();   // re-marca o dock de mensagens (React re-renderiza)
    }
    const scanSoon = debounce(scan, 180);

    const mo = new MutationObserver(scanSoon);
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // SPA: patch no history + popstate → re-scan (IG troca de tela sem reload)
    function onNav() { scanSoon(); setTimeout(scan, 450); }
    for (const m of ["pushState", "replaceState"]) {
        const orig = history[m];
        history[m] = function () { const r = orig.apply(this, arguments); onNav(); return r; };
    }
    window.addEventListener("popstate", onNav);

    /* ------------------------------------------------------------------ *
     * Painel de ajustes flutuante (FAB + painel) — mesmo modelo do
     *   reddit/twitter. Fonte de verdade: GROUPS. Cada controle muta `prefs`,
     *   salva e re-aplica. As flags do feed re-aplicam via applySettings; as
     *   do vídeo (autoUnmute/stories/keyboard) são lidas ao vivo pelo player.
     * ------------------------------------------------------------------ */
    // Reaplica o que é dirigido por CSS var / classes / re-montagem do feed (toggles de vídeo são lidos ao vivo).
    function applySettings() {
        const de = document.documentElement;
        de.classList.toggle("igf-no-msg", !!prefs.hideMessages);   // esconde o dock de mensagens
        de.classList.toggle("igf-totop-on", !!prefs.backToTop);    // habilita o botão voltar-ao-topo
        de.style.setProperty("--igm-maxw", (prefs.feedWidth || 1320) + "px");
        GAP = prefs.density === "compact" ? 14 : 24;   // densidade → gap entre cards (layout em JS)
        if (prefs.hideMessages) tagMessagesDock();     // marca o dock p/ o CSS escondê-lo
        syncMasonry();          // monta/atualiza o feed (mountOwnFeed aplica as classes no 1º paint)
        applyFeedClasses();     // garante sombra/densidade/legenda/contadores com o feed já montado
        feedNcols = 0;          // força re-pack do zero: densidade/legenda/contadores mudam a ALTURA dos cards (dataset.h fica stale)
        queueLayout();
    }
    // marca o DOCK DE MENSAGENS (balão flutuante) p/ o CSS escondê-lo. Acha por link /direct/ ou ícone/texto
    // perto do rodapé-direito e sobe até o ancestral FIXO (o container do dock).
    function tagMessagesDock() {
        if (document.querySelector(".igf-msgdock")) return;   // já marcado (ainda vivo)
        const vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
        const nearDock = (r) => r.width && r.bottom > vh - 280 && r.right > vw - 760;
        let hit = null;
        for (const a of document.querySelectorAll('a[href*="/direct/"], svg[aria-label*="essage" i], svg[aria-label*="ensage" i], svg[aria-label*="essenger" i]')) {
            if (nearDock(a.getBoundingClientRect())) { hit = a; break; }
        }
        if (!hit) for (const e of document.querySelectorAll('div[role="button"]')) {   // fallback: texto "Messages"/"Mensagens"
            const t = (e.textContent || "").trim();
            if ((t === "Messages" || t === "Mensagens") && nearDock(e.getBoundingClientRect())) { hit = e; break; }
        }
        if (!hit) return;
        for (let n = hit, i = 0; n && n !== document.body && i < 9; n = n.parentElement, i++) {
            if (getComputedStyle(n).position === "fixed") { n.classList.add("igf-msgdock"); return; }
        }
    }
    let totopBound = false;
    function bindBackToTop() {   // 1 listener global → liga a classe .igf-scrolled qdo desce a página (CSS mostra o botão)
        if (totopBound) return; totopBound = true;
        let cur = false;
        window.addEventListener("scroll", () => {
            const s = (window.scrollY || window.pageYOffset || 0) > 500;
            if (s !== cur) { cur = s; document.documentElement.classList.toggle("igf-scrolled", s); }
        }, { passive: true });
    }
    const TOTOP_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>';
    // Ícones do rail de categorias — ordem = ordem de GROUPS (Feed, Grid, Mosaico, Vídeo, Interface).
    const PANEL_ICONS = [
        "M12 3l9 8h-3v9h-4v-6H10v6H6v-9H3l9-8z",                                                              // Feed (home)
        "M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z",                                         // Grid
        "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm2 0v14h6V5H5zm8 0v14h6V5h-6z",  // Mosaico (colunas)
        "M8 5v14l11-7z",                                                                                       // Vídeo (play)
        "M3 17h6v-2H3v2zm0-5h10v-2H3v2zm0-7v2h14V5H3zm18 12v-2h-6v2h6zm0-5v-2H11v2h10zm-6-7v2h6V5h-6z",         // Interface (tune)
    ];
    function buildPanel() {
        if (document.getElementById("igs-fab")) return;
        const fab = el("button", { id: "igs-fab", type: "button", title: "Ajustes do Instagram", html: ICONS.gear });
        const toTop = el("button", { id: "igs-totop", type: "button", title: "Voltar ao topo", html: TOTOP_SVG });
        toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
        const panel = el("div", { id: "igs-panel", role: "dialog", "aria-label": "Ajustes do Instagram" });

        // cabeçalho
        const close = el("button", { class: "igs-x", type: "button", title: "Fechar", onClick: () => panel.classList.remove("open") }, "✕");
        panel.append(el("div", { class: "igs-head" },
            el("span", { class: "igs-logo", html: ICONS.gear }),
            el("b", {}, "Instagram"), close));

        // busca (filtra todas as categorias)
        const search = el("input", {
            type: "text", placeholder: "Buscar ajuste…", spellcheck: "false",
            onKeydown: (e) => e.stopPropagation(), onKeyup: (e) => e.stopPropagation(),
        });
        panel.append(el("div", { class: "igs-search" },
            el("div", {}, el("span", { html: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>' }), search)));

        const rail = el("div", { class: "igs-rail" });
        const content = el("div", { class: "igs-content" });
        const empty = el("div", { class: "igs-empty" }, "Nenhum ajuste encontrado");
        const sections = [], tabs = [];
        let active = 0;

        const refreshDimming = () => {
            panel.querySelectorAll("[data-dep]").forEach((r) => r.classList.toggle("dim", !prefs[r.getAttribute("data-dep")]));
        };

        GROUPS.forEach((grp, gi) => {
            const sec = el("div", { class: "igs-sec" });
            sec.append(el("div", { class: "igs-sec-title" }, grp.title));
            for (const item of grp.items) {
                const lbl = item.label.toLowerCase();
                if (item.type === "slider") {
                    const valEl = el("span", { class: "val" }, prefs[item.key] + (item.unit || ""));
                    const input = el("input", {
                        type: "range", min: String(item.min), max: String(item.max), step: String(item.step || 1), value: String(prefs[item.key]),
                        onInput: (e) => { prefs[item.key] = +e.target.value; valEl.textContent = e.target.value + (item.unit || ""); savePrefs(); applySettings(); refreshDimming(); },
                    });
                    sec.append(el("div", { class: "igs-slider", "data-dep": item.dep, "data-label": lbl },
                        el("div", { class: "igs-lab" }, el("span", {}, item.label), valEl), input,
                        item.hint ? el("small", { class: "igs-hint" }, item.hint) : null));
                } else if (item.type === "select") {
                    const sel = el("select", { onChange: (e) => { prefs[item.key] = e.target.value; savePrefs(); applySettings(); refreshDimming(); } },
                        ...item.options.map((o) => el("option", Object.assign({ value: o.value }, String(prefs[item.key]) === o.value ? { selected: "" } : {}), o.label)));
                    sec.append(el("div", { class: "igs-row", "data-label": lbl },
                        el("span", { class: "igs-rowlbl" }, el("span", {}, item.label), item.hint ? el("small", { class: "igs-hint" }, item.hint) : null), sel));
                } else {
                    const input = el("input", Object.assign({
                        type: "checkbox",
                        onChange: (e) => { prefs[item.key] = e.target.checked; savePrefs(); applySettings(); refreshDimming(); },
                    }, prefs[item.key] ? { checked: "" } : {}));
                    sec.append(el("label", { class: "igs-row", "data-dep": item.dep, "data-label": lbl },
                        el("span", { class: "igs-rowlbl" },
                            el("span", {}, item.label),
                            item.hint ? el("small", { class: "igs-hint" }, item.hint) : null),
                        el("span", { class: "igs-sw" }, input, el("i", {}))));
                }
            }
            content.append(sec);
            sections.push(sec);

            const tab = el("button", { class: "igs-tab", type: "button", title: grp.title,
                html: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PANEL_ICONS[gi] || PANEL_ICONS[0]}"/></svg>` });
            tab.addEventListener("click", () => { search.value = ""; showTab(gi); });
            rail.append(tab); tabs.push(tab);
        });

        content.append(empty);
        panel.append(el("div", { class: "igs-body" }, rail, content));

        function showTab(i) {
            active = i; panel.classList.remove("searching"); empty.style.display = "none";
            sections.forEach((sec, idx) => {
                sec.style.display = idx === i ? "block" : "none";
                sec.querySelectorAll("[data-label]").forEach((r) => (r.style.display = ""));
                const t = sec.querySelector(".igs-sec-title"); if (t) t.style.display = "";
            });
            tabs.forEach((tb, idx) => tb.classList.toggle("active", idx === i));
            content.scrollTop = 0;
        }
        search.addEventListener("input", () => {
            const q = search.value.trim().toLowerCase();
            if (!q) { showTab(active); return; }
            tabs.forEach((tb) => tb.classList.remove("active"));
            let any = false;
            sections.forEach((sec) => {
                let vis = false;
                sec.querySelectorAll("[data-label]").forEach((r) => {
                    const m = r.getAttribute("data-label").indexOf(q) !== -1;
                    r.style.display = m ? "" : "none"; if (m) { vis = true; any = true; }
                });
                sec.style.display = vis ? "block" : "none";
                const t = sec.querySelector(".igs-sec-title"); if (t) t.style.display = vis ? "" : "none";
            });
            empty.style.display = any ? "none" : "block";
        });

        panel.append(el("div", { class: "igs-foot" },
            el("button", { class: "igs-reset", type: "button", onClick: () => {
                prefs = Object.assign({}, DEFAULTS); savePrefs(); panel.remove(); fab.remove(); toTop.remove(); buildPanel(); applySettings();
            } }, "Restaurar padrões"),
            el("span", { class: "igs-ver" }, (typeof GM_info !== "undefined" && GM_info.script ? "v" + GM_info.script.version : ""))));

        fab.addEventListener("click", () => { panel.classList.toggle("open"); refreshDimming(); });
        document.addEventListener("click", (e) => { if (!panel.contains(e.target) && e.target !== fab && !fab.contains(e.target)) panel.classList.remove("open"); });
        (document.body || document.documentElement).append(fab, panel, toTop);
        bindBackToTop();
        showTab(0);
        refreshDimming();
    }
    function ensurePanel() { if (!document.getElementById("igs-fab") && document.body) buildPanel(); }

    // bootstrap
    if (prefs.masonry && isHome()) mountBoot();   // skeleton de abertura JÁ no document-start (antes do IG renderizar)
    document.documentElement.style.setProperty("--igm-maxw", (prefs.feedWidth || 1320) + "px");   // largura do feed desde o 1º paint
    GAP = prefs.density === "compact" ? 14 : 24;   // densidade salva válida no 1º layout (sem esperar interação)
    document.documentElement.classList.toggle("igf-no-msg", !!prefs.hideMessages);   // flags de interface desde o 1º paint
    document.documentElement.classList.toggle("igf-totop-on", !!prefs.backToTop);
    applyTheme();   // html.igf-dark já no 1º paint (paleta correta dos cards)
    scan();
    ensurePanel();
    window.addEventListener("DOMContentLoaded", () => { mountBoot(); ingestInlineJSON(); ensurePanel(); scan(); });
    window.addEventListener("load", () => { ensurePanel(); scan(); setTimeout(scan, 1200); });
})();
