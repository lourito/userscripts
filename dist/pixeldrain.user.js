// ==UserScript==
// @name         Pixeldrain — UI amoled/verde + player via mirror (bypass do limite)
// @namespace    pixeldrain-mirror-player
// @version      14.11.0
// @updateURL    https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/pixeldrain.user.js
// @downloadURL  https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/pixeldrain.user.js
// @description  Refaz o pixeldrain.com em cima de MIRRORS (proxy Cloudflare/espelho), contornando o limite de 6 GB/dia (que é por IP), e redesenha a interface. EARLY LOADING: roda em document-start e injeta o CSS ANTES da 1ª pintura (zero flash do tema padrão). PLAYER PRÓPRIO (portado do userscripts/xenforo rgControls — controles estilo YouTube: play central, scrubber arrastável c/ buffer, volume flyout, tempo, tela cheia, ±5s no duplo-clique, spinner no seek): quando a cota estoura, o pixeldrain troca o vídeo pela tela "slow down" — escondo e injeto meu <video src=MIRROR> (SEM controls nativo) com Range/seek; cada arquivo recomeça do melhor mirror e troca sozinho no que falhar. TEMA: AMOLED #000, TEXTO BRANCO (alto contraste), verde só nos botões. DOIS MODOS: CONTEÚDO (#item=N) = topbar global + row do vídeo (info à esquerda: ← Galeria/nome/stats; ações à direita: Download/Copiar/Tela cheia/Mirror[info]/Detalhes/QR) + player + strip de thumbs no rodapé com barra de controle (colapsar + ◀▶ que rolam a tira, sem scrollbar); GALERIA (a NATIVA do pixeldrain, que renderiza o grid dentro do .file_preview e herda meu tema) = topbar global + barra de álbum (BUSCA GLOBAL: filtra a galeria E a tira do rodapé, com chip de filtro no rodapé + Zip/Copiar todos/.txt) + grid. Busca isola o teclado (stopPropagation) p/ não disparar os atalhos nativos (ex.: "r"=Report). CRÍTICO: ao entrar na galeria removo o overlay do meu player (.pdx-host z-index:30) que cobria o grid e deixava tudo PRETO. PERF: observer ignora a própria UI + a galeria nativa (1196 thumbs lazy); sync com guarda de assinatura (hash+modo+id) p/ não re-trabalhar à toa; sem reescrever 1196 src de thumbnail. Topbar global = links default reais; sem re-parentear o menu nativo (travava). v14.8.2: hideForeign() esconde TODO filho estranho (não-pdx) do file_viewer e da file_preview_row → mata chrome nativo órfão sem saber o seletor (ex.: o spinner de loading que vazava no canto sup. direito). Mirrors (ordem de teste): OFICIAL pixeldrain.com SEMPRE 1º (v14.7 — dentro da cota serve direto sem proxy; estourada, 403 instantâneo → failover) → worker próprio opcional (localStorage pdx_worker, sem UI) → lista dinâmica (proxy.json = cdn.pixeldrain.eu.cc, o load-balancer da CF; cache 24h) → pixeldra.in (mesmo backend do oficial, NÃO contorna IP). [v14.6.2: o pool de 16 nós diretos cdnNN foi REVERTIDO — cada nó travado só resolvia no watchdog de 14s e 16 em série = busca lenta demais, sobretudo p/ imagem.] IMAGENS: mesmo bypass do vídeo — overlay <img> servido do MIRROR (failover de mirror, zoom em níveis 1x→2x→4x no clique + DRAG p/ pan via transform, setas < > de álbum que ficam FIXAS), pois a imagem nativa também cai na tela "slow down". v14.8: o loading do mirror virou um spinner COMPACTO dentro do chip "Mirror" (não o spinrão central) — dirigido pelo estado de load do <video>/<img>; o spinrão central só aparece em seek do usuário (suprimido no restore-seek do failover). Prefs em localStorage.
// @author       claudiogepeto
// @match        https://pixeldrain.com/*
// @noframes
// @run-at       document-start
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==
(function () {
    "use strict";
    if (window.top !== window.self) return;

    /* MIRRORS (ordem = prioridade; cada arquivo recomeça do preferido e troca no que falhar) */
    /* OFICIAL (pixeldrain.com) = SEMPRE o 1º testado (user): dentro da cota ele serve direto, sem proxy/latência; estourada a cota ele dá 403 INSTANTÂNEO no <video>/<img> → failover rápido p/ os mirrors. Só paga o custo do mirror quando o original realmente falha. */
    const OFFICIAL = { name: "oficial", file: id => `https://pixeldrain.com/api/file/${id}`, dl: id => `https://pixeldrain.com/api/file/${id}?download`, zip: lid => `https://pixeldrain.com/api/list/${lid}/zip` };
    const STATIC_MIRRORS = [
        { name: "pixeldra.in", file: id => `https://pixeldra.in/api/file/${id}`,    dl: id => `https://pixeldra.in/api/file/${id}?download`,    zip: lid => `https://pixeldra.in/api/list/${lid}/zip` },
        // { name: "meu-worker", file: id => `https://SEU.workers.dev/api/file/${id}?download`, dl: id => `https://SEU.workers.dev/api/file/${id}?download`, zip: lid => `https://SEU.workers.dev/api/list/${lid}/zip` },
    ];
    const PROXY_JSON = "https://pixeldrain-bypass.gamedrive.org/api/proxy.json";
    const PCACHE_KEY = "pdx_proxies", PCACHE_TS = "pdx_proxies_ts", PCACHE_TTL = 24 * 3600 * 1000;
    const VIDEO_EXT = /\.(mp4|m4v|webm|mkv|mov|avi|flv|f4v|wmv|mpe?g|m2ts|ts|ogv|3gp|divx|qt)$/i;
    const IMAGE_EXT = /\.(jpe?g|jfif|png|gif|webp|avif|bmp|svg|heic|heif|tiff?|ico)$/i;
    const ALIVE = ["loadedmetadata", "loadeddata", "canplay", "progress", "playing"];
    const WATCHDOG_MS = 14000;
    const PREFS_KEY = "pdx_prefs";

    /* Links default do site (verificados no DOM/menu nativo do pixeldrain) */
    const SITE_LINKS = [
        { href: "/home", label: "Home", icon: "home" },
        { href: "/user/filemanager#files", label: "Meus arquivos", icon: "image" },
        { href: "/user/filemanager#lists", label: "Meus álbuns", icon: "photo_library" },
        { href: "/home#pro", label: "Premium", icon: "star" },
        { href: "/api", label: "API", icon: "code" },
    ];

    /* ------------------------------------------------------------------ * Helpers */
    function addStyle(css) {
        if (typeof GM_addStyle === "function") return GM_addStyle(css);
        const s = document.createElement("style"); s.textContent = css;
        (document.head || document.documentElement).appendChild(s); return s;
    }
    function debounce(fn, ms) { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }
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
    const icon = name => el("i", { class: "icon" }, name);
    const hide = n => { if (n && n.style && n.style.display !== "none") { n.dataset.pdxHidden = "1"; n.style.display = "none"; } };
    /* esconde TODO filho "estranho" (não-pdx, fora da whitelist `keep`) de um container — mata chrome nativo que não conhecemos por nome (ex.: o spinner de loading órfão que vaza no canto, classe Svelte hasheada/volátil) sem precisar do seletor exato. */
    function hideForeign(parent, keep) { if (!parent) return; for (const c of Array.from(parent.children)) { if (!c.classList) { hide(c); continue; } let mine = false; for (const k of c.classList) { if (k.indexOf("pdx-") === 0) { mine = true; break; } } if (mine) continue; if (keep && keep.some(s => c.classList.contains(s))) continue; hide(c); } }
    const log = (...a) => { try { console.info("[pdx]", ...a); } catch {} };
    function fmtSize(b) { b = +b || 0; const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return (i === 0 ? b : b.toFixed(b < 10 ? 2 : b < 100 ? 1 : 0)) + " " + u[i]; }
    function copyText(s) {
        try { return navigator.clipboard.writeText(s); } catch {}
        try { const t = el("textarea", { style: { position: "fixed", opacity: "0" } }); t.value = s; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); } catch {}
        return Promise.resolve();
    }
    function downloadText(name, content) {
        const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
        const a = el("a", { href: url, download: name }); document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    let toastT;
    function toast(msg) {
        let t = document.querySelector(".pdx-toast");
        if (!t) { t = el("div", { class: "pdx-toast" }); document.body.append(t); }
        t.textContent = msg; t.classList.add("show");
        clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800);
    }
    function goFullscreen() {
        const target = (cur && cur.host) || document.querySelector(".pdx-host") || document.querySelector(".file_preview") || document.documentElement;
        const req = target.requestFullscreen || target.webkitRequestFullscreen || target.webkitEnterFullscreen || target.mozRequestFullScreen || target.msRequestFullscreen;
        if (!req) return toast("Tela cheia indisponível");
        try { const p = req.call(target); if (p && p.catch) p.catch(() => {}); } catch {}
    }

    /* ------------------------------------------------------------------ * Prefs */
    const prefs = Object.assign({ volume: 1, muted: false, stripCollapsed: false, rate: 1 },
        (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } })());
    const saveP = debounce(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {} }, 250);

    /* ------------------------------------------------------------------ * Mirrors (prefIdx = preferido; gIdx = atual do arquivo) */
    let MIRRORS = [OFFICIAL, ...STATIC_MIRRORS];
    let prefIdx = 0, gIdx = 0, dynBases = [];
    const at = i => MIRRORS[((i % MIRRORS.length) + MIRRORS.length) % MIRRORS.length];
    const M = () => at(gIdx);
    function userMirror() {                       // worker próprio (localStorage pdx_worker) = PRIORIDADE MÁXIMA: roda no IP da Cloudflare → contorna o bloqueio por IP
        try { const b = (localStorage.getItem("pdx_worker") || "").trim().replace(/\/+$/, ""); if (!/^https?:\/\//.test(b)) return [];
            return [{ name: "meu-worker", file: id => `${b}/api/file/${id}`, dl: id => `${b}/api/file/${id}?download`, zip: lid => `${b}/api/list/${lid}/zip` }]; } catch { return []; }
    }
    /* ROLLBACK v14.6.2: o pool de 16 nós diretos cdnNN.pixeldrain.eu.cc (embaralhados) foi REMOVIDO — cada nó travado só resolvia no watchdog de 14s e 16 em série = busca eterna (pior em imagem, que não dá erro rápido como o vídeo). Volta a usar o LB cdn.pixeldrain.eu.cc via proxy.json. */
    function rebuildMirrors() {
        const dyn = dynBases.filter(Boolean).map(b => ({ name: b, file: id => `https://${b}/${id}`, dl: id => `https://${b}/${id}?download`, zip: lid => `https://${b}/zip/${lid}` }));
        MIRRORS = [OFFICIAL, ...userMirror(), ...dyn, ...STATIC_MIRRORS];   // OFICIAL sempre 1º → worker próprio (se houver) → LB do proxy.json (cdn.pixeldrain.eu.cc) → pixeldra.in
    }
    function setDynamic(bases) { dynBases = (bases || []).filter(Boolean); rebuildMirrors(); }
    rebuildMirrors();                             // já aplica o worker próprio no load (antes do proxy.json)
    async function loadProxies() {
        let cached = []; try { cached = JSON.parse(localStorage.getItem(PCACHE_KEY) || "[]"); } catch {}
        const ts = +localStorage.getItem(PCACHE_TS) || 0;
        if (cached.length && Date.now() - ts < PCACHE_TTL) { setDynamic(cached); }
        else try {
            const r = await fetch(PROXY_JSON, { cache: "no-store" });
            const list = ((await r.json()).proxies || []).map(p => String(p).replace(/^https?:\/\//, "").replace(/\/+$/, "")).filter(Boolean);
            if (list.length) { localStorage.setItem(PCACHE_KEY, JSON.stringify(list)); localStorage.setItem(PCACHE_TS, String(Date.now())); setDynamic(list); }
            else if (cached.length) setDynamic(cached);
        } catch (e) { if (cached.length) setDynamic(cached); log("proxy.json falhou", e); }
        prefIdx = 0; gIdx = 0;                 // dinâmico entrou: recomeça do melhor
        if (cur) applyMirror(cur.media);
        refreshChips(); sync();
    }

    /* ------------------------------------------------------------------ * Alvo / álbum */
    function viewerData() {
        try { if (typeof unsafeWindow !== "undefined" && unsafeWindow.viewer_data) return unsafeWindow.viewer_data; } catch {}
        try { return window.viewer_data || null; } catch { return null; }
    }
    function currentIndex() { const m = location.hash.match(/item=(\d+)/); return m ? +m[1] : 0; }
    function currentFile() {
        const vd = viewerData();
        if (vd && vd.api_response) {
            if (Array.isArray(vd.api_response.files)) return vd.api_response.files[currentIndex()] || vd.api_response.files[0] || null;
            if (vd.api_response.id) return vd.api_response;
        }
        let id = null, name = "", mime = "";
        const img = document.querySelector('.file_selected img[src*="/api/file/"]') || document.querySelector('.file_preview img[src*="/api/file/"]');
        if (img) { const mm = (img.getAttribute("src") || "").match(/\/api\/file\/([A-Za-z0-9]+)/); if (mm) id = mm[1]; name = img.getAttribute("alt") || ""; }
        if (!id) { const mu = location.pathname.match(/\/(?:u|d|file|api\/file)\/([A-Za-z0-9]+)/); if (mu) id = mu[1]; }
        if (!id) return null;
        if (!name) { const h = document.querySelector(".file_viewer_headerbar_title"); if (h) name = h.textContent.trim().split("\n").pop().trim(); }
        document.querySelectorAll(".file_preview td").forEach(td => { const mm = (td.textContent || "").match(/[a-z]+\/[a-z0-9.+-]+/i); if (mm) mime = mm[0]; });
        return { id, name: name || id, mime_type: mime };
    }
    // IMAGEM decidida PRIMEIRO (mime/ext) — tem precedência sobre allow_video_player, que no pixeldrain é flag de CAPACIDADE (o viewer pode usar player), não "é vídeo": imagem em álbum com player habilitado vem com allow_video_player:true e era mal-classificada como vídeo.
    const isImageFile = f => !!f && ((f.mime_type && /^image\//i.test(f.mime_type)) || (IMAGE_EXT.test(f.name || "") && !(f.mime_type && /^video\//i.test(f.mime_type))));
    const isVideoFile = f => !!f && !isImageFile(f) && ((f.mime_type && /^video\//i.test(f.mime_type)) || VIDEO_EXT.test(f.name || "") || f.allow_video_player === true);
    function albumInfo() {
        const vd = viewerData();
        if (vd && vd.type === "list" && vd.api_response && Array.isArray(vd.api_response.files))
            return { lid: vd.api_response.id || (location.pathname.match(/\/l\/([A-Za-z0-9]+)/) || [])[1], title: vd.api_response.title || "", files: vd.api_response.files.map(f => ({ id: f.id, name: f.name })) };
        return null;
    }
    /* a galeria NATIVA renderiza o grid `.gallery` DENTRO do `.file_preview` (não destrói o .file_viewer) */
    function inGallery() { return !!document.querySelector(".file_viewer .gallery") || location.hash.replace(/^#/, "") === "gallery"; }

    /* ==================================================================== * (1) PLAYER (sempre on p/ vídeo) */
    function hideNative(preview) {
        for (const c of Array.from(preview.children)) {
            if (c.classList && c.classList.contains("pdx-host")) continue;
            if (c.style.display !== "none") { c.dataset.pdxHidden = "1"; c.style.display = "none"; }
        }
        preview.querySelectorAll("video:not(.pdx-video)").forEach(v => { try { v.pause(); v.muted = true; } catch {} });
    }
    function showNative(preview) { if (!preview) return; preview.querySelectorAll("[data-pdx-hidden]").forEach(c => { c.style.display = ""; delete c.dataset.pdxHidden; }); }
    let cur = null;
    const state = { file: null, filter: "", stripShown: 0, stripTotal: 0 };
    try { state.filter = (new URLSearchParams(location.search).get("q") || "").trim().toLowerCase(); } catch {}   // F5: restaura o filtro do ?q=
    let lastIndex = 0, lastId = null;
    function teardownPlayer() {     // "player" = qualquer overlay nosso (vídeo OU imagem)
        if (!cur) return;
        try { cur.ac.abort(); } catch {}
        clearTimeout(cur.watchdog);
        if (cur.kind === "video") { try { cur.media.pause(); } catch {} }
        try { cur.media.removeAttribute("src"); if (cur.kind === "video") cur.media.load(); } catch {}
        try { cur.host.remove(); } catch {}
        showNative(cur.preview); cur = null; setMirrorLoading(false);
    }
    /* CRÍTICO: tira QUALQUER overlay meu de cima do preview (senão o grid da galeria fica PRETO atrás dele) */
    function clearPlayerOverlay() {
        teardownPlayer();
        document.querySelectorAll(".pdx-host").forEach(h => { try { h.remove(); } catch {} });
        const prev = document.querySelector(".file_preview"); showNative(prev);
    }
    function armWatchdog() { clearTimeout(cur.watchdog); cur.alive = false; cur.watchdog = setTimeout(() => { if (cur && !cur.alive) nextMirror(); }, WATCHDOG_MS); }
    function applyMirror(media) {
        if (!cur || cur.media !== media) return;
        cur.fail.style.display = "none";
        if (cur.kind === "video") {
            const t = media.currentTime, paused = media.paused;
            media.src = M().file(cur.id);
            try { media.load(); } catch {}
            if (t > 0) media.addEventListener("loadedmetadata", function once() { if (cur) cur.restoring = true; try { media.currentTime = t; if (!paused) media.play().catch(() => {}); } catch {} media.addEventListener("seeked", () => { if (cur) cur.restoring = false; }, { once: true }); }, { once: true });
        } else {
            media.src = M().file(cur.id);            // imagem: só troca a origem (sem load()/currentTime)
        }
        armWatchdog(); refreshChips(); setMirrorLoading(true); log("→", M().name, cur.id);
    }
    function nextMirror() { if (!cur) return; if (gIdx < MIRRORS.length - 1) { gIdx++; applyMirror(cur.media); } else { clearTimeout(cur.watchdog); cur.fail.style.display = "flex"; setMirrorLoading(false); } }
    function cycleMirror() { prefIdx = gIdx = (prefIdx + 1) % MIRRORS.length; if (cur) applyMirror(cur.media); refreshChips(); toast("Mirror: " + M().name); }
    /* ---- PLAYER PRÓPRIO (portado do userscripts/xenforo rgControls) — controles estilo YouTube ---- */
    const svgi = inner => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block">${inner}</svg>`;
    const PL_ICONS = {
        play: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="display:block"><path d="M7 4.5v15a1 1 0 0 0 1.52.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="display:block"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
        volume: svgi('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'),
        mute: svgi('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'),
        expand: svgi('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
        download: svgi('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
        chevL: svgi('<path d="m15 18-6-6 6-6"/>'),
        chevR: svgi('<path d="m9 18 6-6-6-6"/>'),
        skipBack: svgi('<path d="M3 2v6h6"/><path d="M21 12A9 9 0 0 0 6 5.3L3 8"/>'),   /* seta circular ↺ (com "5" por cima) */
        skipFwd: svgi('<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>'),
    };
    function fmtT(s) { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; const p = n => String(n).padStart(2, "0"); return h ? h + ":" + p(m) + ":" + p(ss) : m + ":" + p(ss); }
    function buildPlayerControls(wrap, video, ac) {
        const mkAct = (ic, label, on) => { const b = el("button", { type: "button", class: "pdx-plc-act", title: label, "aria-label": label }); b.innerHTML = ic; b.addEventListener("click", on); return b; };
        const toggle = () => { if (!video.paused) { video.pause(); return; } const p = video.play(); if (p && p.catch) p.catch(() => {}); };
        // SEEK ±5s + flash "« 5s" / "5s »"
        const sflash = el("div", { class: "pdx-plc-seekflash" }); let sflashT;
        const seek = d => { if (!video.duration) return; video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + d)); sflash.textContent = d < 0 ? "« 5s" : "5s »"; sflash.classList.add("on"); clearTimeout(sflashT); sflashT = setTimeout(() => sflash.classList.remove("on"), 480); };
        // clique no vídeo: 1× = play/pause · 2× = ±5s (metade esq/dir). timer separa single de double-click.
        let clickT = null;
        video.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); if (clickT) return; clickT = setTimeout(() => { clickT = null; toggle(); }, 230); });
        video.addEventListener("dblclick", e => { e.preventDefault(); e.stopPropagation(); if (clickT) { clearTimeout(clickT); clickT = null; } const r = video.getBoundingClientRect(); seek((e.clientX - r.left) < r.width / 2 ? -5 : 5); });
        // play central (só no pausado)
        const playBtn = el("button", { type: "button", class: "pdx-plc-play", "aria-label": "Play/Pause" }); playBtn.innerHTML = PL_ICONS.play;
        playBtn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); toggle(); });
        const flash = el("div", { class: "pdx-plc-flash" }, playBtn);
        // scrubber: buffer + preenchido + knob, arrastável (rect cacheado no pointerdown)
        const buf = el("div", { class: "pdx-plc-buf" });
        const knob = el("div", { class: "pdx-plc-knob" });
        const fill = el("div", { class: "pdx-plc-fill" }, knob);
        const bar = el("div", { class: "pdx-plc-bar" }, buf, fill);
        const prog = el("div", { class: "pdx-plc-prog" }, bar);
        const seekTo = (cx, r) => { if (!video.duration || !r.width) return; video.currentTime = Math.max(0, Math.min(1, (cx - r.left) / r.width)) * video.duration; };
        prog.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); const r = bar.getBoundingClientRect(); seekTo(e.clientX, r); const mv = ev => seekTo(ev.clientX, r); const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); }; document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); });
        // tempo (escreve no text node = characterData, observer não escuta)
        const tEl = el("span", { class: "pdx-plc-time" }, "0:00");
        const syncTime = () => { const s = fmtT(video.currentTime) + (video.duration ? " / " + fmtT(video.duration) : ""); if (tEl.firstChild.data !== s) tEl.firstChild.data = s; };
        video.addEventListener("timeupdate", () => { if (video.duration) fill.style.width = (video.currentTime / video.duration * 100) + "%"; syncTime(); });
        video.addEventListener("loadedmetadata", syncTime);
        video.addEventListener("progress", () => { try { if (video.buffered.length && video.duration) buf.style.width = (video.buffered.end(video.buffered.length - 1) / video.duration * 100) + "%"; } catch {} });
        // volume: mute + barra que expande no hover
        const mute = mkAct(PL_ICONS.mute, "Mudo", e => { e.stopPropagation(); video.muted = !video.muted; if (!video.muted && !video.volume) video.volume = 1; syncVol(); });
        const volfill = el("div", { class: "pdx-plc-volfill" });
        const volbar = el("div", { class: "pdx-plc-volbar", role: "slider", "aria-label": "Volume" }, volfill);
        const syncVol = () => { mute.innerHTML = (video.muted || !video.volume) ? PL_ICONS.mute : PL_ICONS.volume; volfill.style.width = ((video.muted ? 0 : video.volume) * 100) + "%"; };
        const setVolFromX = (cx, r) => { if (!r.width) return; const v = Math.max(0, Math.min(1, (cx - r.left) / r.width)); video.volume = v; video.muted = (v === 0); syncVol(); };
        volbar.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); const r = volbar.getBoundingClientRect(); setVolFromX(e.clientX, r); const mv = ev => setVolFromX(ev.clientX, r); const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); }; document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); });
        const volgrp = el("div", { class: "pdx-plc-vol" }, mute, volbar);
        // ações direita: download via mirror + tela cheia
        const goFs = () => { try { document.fullscreenElement ? document.exitFullscreen() : wrap.requestFullscreen(); } catch {} };
        const dlb = mkAct(PL_ICONS.download, "Baixar (mirror)", e => { e.stopPropagation(); const f = state.file; if (f) window.open(M().dl(f.id), "_blank"); });
        const fsb = mkAct(PL_ICONS.expand, "Tela cheia (f)", e => { e.stopPropagation(); goFs(); });
        const barPlay = mkAct(PL_ICONS.play, "Play/Pause (espaço)", e => { e.stopPropagation(); toggle(); }); barPlay.classList.add("pdx-plc-barplay");
        // −5s / +5s = seta circular + "5" (estilo YouTube replay/forward), além do duplo-clique e das setas ←/→
        const mkSkip = (ic, label, on) => { const b = el("button", { type: "button", class: "pdx-plc-act pdx-plc-skip", title: label, "aria-label": label }); b.innerHTML = ic; b.appendChild(el("span", { class: "pdx-plc-skipn" }, "5")); b.addEventListener("click", on); return b; };
        const skipBack = mkSkip(PL_ICONS.skipBack, "Voltar 5s (←)", e => { e.stopPropagation(); seek(-5); });
        const skipFwd = mkSkip(PL_ICONS.skipFwd, "Avançar 5s (→)", e => { e.stopPropagation(); seek(5); });
        // VELOCIDADE: botão mostra o rate atual; menu sobe com 0.25x…5x; persiste em prefs.rate
        const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
        const speedMenu = el("div", { class: "pdx-plc-speedmenu" });
        const speedBtn = el("button", { type: "button", class: "pdx-plc-act pdx-plc-speed", title: "Velocidade", "aria-label": "Velocidade" }, "1x");
        const speedWrap = el("div", { class: "pdx-plc-speedwrap" }, speedMenu, speedBtn);
        let speedCloser = null;
        const closeSpeed = () => { speedMenu.classList.remove("open"); if (speedCloser) { document.removeEventListener("pointerdown", speedCloser, true); speedCloser = null; } };
        const openSpeed = () => { speedMenu.classList.add("open"); speedCloser = ev => { if (!speedWrap.contains(ev.target)) closeSpeed(); }; document.addEventListener("pointerdown", speedCloser, true); };
        RATES.forEach(r => { const it = el("button", { type: "button", class: "pdx-plc-speeditem" }, r + "x"); it.dataset.r = r; it.addEventListener("click", e => { e.stopPropagation(); try { video.playbackRate = r; } catch {} closeSpeed(); }); speedMenu.appendChild(it); });
        speedBtn.addEventListener("click", e => { e.stopPropagation(); speedMenu.classList.contains("open") ? closeSpeed() : openSpeed(); });
        const syncSpeed = () => { const r = video.playbackRate; speedBtn.textContent = r + "x"; speedMenu.querySelectorAll(".pdx-plc-speeditem").forEach(it => it.classList.toggle("on", +it.dataset.r === r)); };
        video.addEventListener("ratechange", () => { prefs.rate = video.playbackRate; saveP(); syncSpeed(); });
        video.addEventListener("loadedmetadata", () => { try { video.playbackRate = prefs.rate || 1; } catch {} });
        const leftc = el("div", { class: "pdx-plc-left" }, barPlay, skipBack, skipFwd, volgrp, tEl);   // play primeiro (YouTube)
        const rightc = el("div", { class: "pdx-plc-right" }, speedWrap, dlb, fsb);
        const row = el("div", { class: "pdx-plc-row" }, leftc, rightc);
        const bottom = el("div", { class: "pdx-plc-bottom" }, prog, row);
        // setas < > nos cantos p/ trocar de mídia (só em álbum) — reusa navItem (muda #item=N±1 → sync remonta)
        const al = albumInfo(), multi = !!(al && al.files.length > 1);
        const sideArrows = [];
        if (multi) {
            const prevA = el("button", { type: "button", class: "pdx-plc-side pdx-plc-sprev", title: "Mídia anterior", "aria-label": "Mídia anterior" }); prevA.innerHTML = PL_ICONS.chevL; prevA.addEventListener("click", e => { e.stopPropagation(); navItem(-1); });
            const nextA = el("button", { type: "button", class: "pdx-plc-side pdx-plc-snext", title: "Próxima mídia", "aria-label": "Próxima mídia" }); nextA.innerHTML = PL_ICONS.chevR; nextA.addEventListener("click", e => { e.stopPropagation(); navItem(1); });
            sideArrows.push(prevA, nextA);
        }
        // estado play/pause → classe (CSS mostra/esconde o play central) + ícones
        video.addEventListener("play", () => { wrap.classList.add("pdx-pl-playing"); playBtn.innerHTML = PL_ICONS.pause; barPlay.innerHTML = PL_ICONS.pause; });
        video.addEventListener("pause", () => { wrap.classList.remove("pdx-pl-playing"); playBtn.innerHTML = PL_ICONS.play; barPlay.innerHTML = PL_ICONS.play; });
        video.addEventListener("volumechange", syncVol);
        // spinner só no SEEK do usuário (não no load)
        video.addEventListener("seeking", () => { if (cur && cur.restoring) return; wrap.classList.add("pdx-pl-buffering"); });   // não mostra o spinrão no restore-seek do failover (só em seek do usuário)
        ["seeked", "canplay", "playing", "loadeddata", "pause", "suspend", "error", "abort"].forEach(ev => video.addEventListener(ev, () => wrap.classList.remove("pdx-pl-buffering")));
        // ATALHOS DE TECLADO (YouTube) — só no modo conteúdo, fora de inputs; capture p/ preemptar o atalho nativo; limpos no teardown (ac)
        const setRate = dir => { const i = RATES.indexOf(video.playbackRate); const ni = Math.max(0, Math.min(RATES.length - 1, (i < 0 ? 3 : i) + dir)); try { video.playbackRate = RATES[ni]; } catch {} };
        const onKey = e => {
            if (e.ctrlKey || e.metaKey || e.altKey || inGallery()) return;
            const t = e.target;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || (t.closest && t.closest(".pdx-search")))) return;
            const k = e.key; let h = true;
            if (k === " " || k === "k") toggle();
            else if (k === "ArrowLeft") seek(-5);
            else if (k === "ArrowRight") seek(5);
            else if (k === "j") seek(-10);
            else if (k === "l") seek(10);
            else if (k === "ArrowUp") { video.muted = false; video.volume = Math.min(1, video.volume + 0.05); }
            else if (k === "ArrowDown") video.volume = Math.max(0, video.volume - 0.05);
            else if (k === "m") { video.muted = !video.muted; if (!video.muted && !video.volume) video.volume = 1; }
            else if (k === "f") goFs();
            else if (k === "<") setRate(-1);
            else if (k === ">") setRate(1);
            else if (k >= "0" && k <= "9" && video.duration) video.currentTime = video.duration * (+k) / 10;
            else h = false;
            if (h) { e.preventDefault(); e.stopPropagation(); }
        };
        if (ac) document.addEventListener("keydown", onKey, { capture: true, signal: ac.signal });
        wrap.append(flash, sflash, bottom, ...sideArrows);
        try { video.playbackRate = prefs.rate || 1; } catch {}
        syncVol(); syncTime(); syncSpeed();
    }
    function mountPlayer(f) {
        const preview = document.querySelector(".file_preview");
        if (!preview) return;
        if (cur && cur.kind === "video" && cur.id === f.id && cur.host.isConnected) { hideNative(preview); return; }
        teardownPlayer();
        hideNative(preview);
        gIdx = prefIdx;                          // novo arquivo: recomeça do mirror preferido
        const ac = new AbortController();
        const on = (e, ev, fn) => e.addEventListener(ev, fn, { signal: ac.signal });
        const video = el("video", { class: "pdx-video", playsinline: "", preload: "metadata" });   // SEM controls nativo — usamos o nosso
        video.volume = prefs.volume; video.muted = prefs.muted;
        on(video, "volumechange", () => { prefs.volume = video.volume; prefs.muted = video.muted; saveP(); });
        ALIVE.forEach(ev => on(video, ev, () => { if (cur) { cur.alive = true; clearTimeout(cur.watchdog); cur.fail.style.display = "none"; } setMirrorLoading(false); }));
        on(video, "error", () => nextMirror());
        const fail = el("div", { class: "pdx-fail" },
            el("div", null, "Todos os mirrors falharam para este arquivo."),
            el("div", { class: "pdx-failrow" },
                el("button", { class: "pdx-mini", onClick: () => { gIdx = prefIdx; applyMirror(cur.media); } }, "↻ Tentar de novo"),
                el("a", { class: "pdx-mini", href: "https://pixeldrain.com/api/file/" + f.id, target: "_blank", rel: "noopener" }, "Abrir no oficial")));
        fail.style.display = "none";
        const host = el("div", { class: "pdx-host pdx-pl" }, video, fail);
        buildPlayerControls(host, video, ac);      // nossos controles (play central, scrubber, volume, tempo, tela cheia, ±5s, velocidade, atalhos)
        preview.appendChild(host);
        cur = { id: f.id, kind: "video", preview, host, media: video, fail, ac, alive: false, watchdog: null };
        applyMirror(video);
    }
    /* ---- IMAGEM via mirror (mesmo bypass do player): overlay <img> no .file_preview, com failover de mirror, zoom no clique e setas < > de álbum.
       O pixeldrain bloqueia a imagem nativa (tela "slow down") igual ao vídeo — então sirvo a imagem do MIRROR em vez da origem oficial. */
    function mountImage(f) {
        const preview = document.querySelector(".file_preview");
        if (!preview) return;
        if (cur && cur.kind === "image" && cur.id === f.id && cur.host.isConnected) { hideNative(preview); return; }
        teardownPlayer();
        hideNative(preview);
        gIdx = prefIdx;                          // novo arquivo: recomeça do mirror preferido
        const ac = new AbortController();
        const on = (e, ev, fn) => e.addEventListener(ev, fn, { signal: ac.signal });
        const img = el("img", { class: "pdx-image", alt: f.name || "", draggable: "false" });   // exibição: <img> não exige CORS, mesmo cross-origin
        on(img, "load", () => { if (cur) { cur.alive = true; clearTimeout(cur.watchdog); cur.fail.style.display = "none"; } setMirrorLoading(false); });
        on(img, "error", () => nextMirror());
        const fail = el("div", { class: "pdx-fail" },
            el("div", null, "Todos os mirrors falharam para esta imagem."),
            el("div", { class: "pdx-failrow" },
                el("button", { class: "pdx-mini", onClick: () => { gIdx = prefIdx; applyMirror(cur.media); } }, "↻ Tentar de novo"),
                el("a", { class: "pdx-mini", href: "https://pixeldrain.com/api/file/" + f.id, target: "_blank", rel: "noopener" }, "Abrir no oficial")));
        fail.style.display = "none";
        const host = el("div", { class: "pdx-host pdx-img-host" }, img, fail);
        // ZOOM em NÍVEIS (clique cicla 1x→2x→4x→1x) + DRAG p/ pan (arrasto). Só a IMAGEM é transformada — as setas < > são filhas do host (não transformadas) → ficam FIXAS, não se mexem com o pan.
        const ZOOMS = [1, 2, 4]; let zi = 0, z = 1, tx = 0, ty = 0;
        const clampPan = () => { const mx = Math.max(0, (img.clientWidth * z - host.clientWidth) / 2), my = Math.max(0, (img.clientHeight * z - host.clientHeight) / 2); tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty)); };
        const applyTf = () => { img.style.transform = z === 1 ? "" : `translate(${tx}px,${ty}px) scale(${z})`; host.classList.toggle("pdx-zoomed", z !== 1); };
        const setZoomIdx = i => { zi = ((i % ZOOMS.length) + ZOOMS.length) % ZOOMS.length; z = ZOOMS[zi]; if (z === 1) { tx = ty = 0; } else clampPan(); applyTf(); };   // re-clampa o pan ao trocar de nível (bounds mudam)
        let drag = null;
        on(img, "pointerdown", e => { if (e.button) return; e.preventDefault(); e.stopPropagation(); drag = { x: e.clientX, y: e.clientY, tx, ty, moved: false }; try { img.setPointerCapture(e.pointerId); } catch {} });
        on(img, "pointermove", e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true; if (z !== 1 && drag.moved) { tx = drag.tx + dx; ty = drag.ty + dy; clampPan(); applyTf(); } });
        const endDrag = e => { if (!drag) return; const click = !drag.moved; drag = null; try { img.releasePointerCapture(e.pointerId); } catch {} if (click) setZoomIdx(zi + 1); };   // clique SEM arrasto = próximo nível (cicla)
        on(img, "pointerup", endDrag); on(img, "pointercancel", endDrag);
        // setas < > nos cantos p/ trocar de mídia (só em álbum) — reusa o estilo/lógica do player
        const al = albumInfo(), multi = !!(al && al.files.length > 1);
        if (multi) {
            const prevA = el("button", { type: "button", class: "pdx-plc-side pdx-plc-sprev", title: "Mídia anterior", "aria-label": "Mídia anterior" }); prevA.innerHTML = PL_ICONS.chevL; prevA.addEventListener("click", e => { e.stopPropagation(); navItem(-1); });
            const nextA = el("button", { type: "button", class: "pdx-plc-side pdx-plc-snext", title: "Próxima mídia", "aria-label": "Próxima mídia" }); nextA.innerHTML = PL_ICONS.chevR; nextA.addEventListener("click", e => { e.stopPropagation(); navItem(1); });
            host.append(prevA, nextA);
        }
        // atalhos no modo imagem: ←/→ troca de mídia, f = tela cheia (capture p/ preemptar o nativo; limpos no teardown via ac)
        const onKey = e => {
            if (e.ctrlKey || e.metaKey || e.altKey || inGallery()) return;
            const t = e.target;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || (t.closest && t.closest(".pdx-search")))) return;
            let h = true;
            if (e.key === "ArrowLeft") navItem(-1);
            else if (e.key === "ArrowRight") navItem(1);
            else if (e.key === "f") goFullscreen();
            else h = false;
            if (h) { e.preventDefault(); e.stopPropagation(); }
        };
        document.addEventListener("keydown", onKey, { capture: true, signal: ac.signal });
        preview.appendChild(host);
        cur = { id: f.id, kind: "image", preview, host, media: img, fail, ac, alive: false, watchdog: null };
        applyMirror(img);
    }

    /* ==================================================================== * UI comum */
    function tbtn(ic, label, title, onClick, extra) { return el("button", { class: "pdx-item" + (extra ? " " + extra : ""), title: title || label, onClick }, icon(ic), label ? el("span", null, label) : null); }
    const vsep = () => el("div", { class: "pdx-vsep" });
    const statCell = label => el("div", { class: "pdx-stat" }, el("span", { class: "pdx-k" }, label), el("b", { class: "pdx-statv" }, "—"));
    function popup(title, body) {
        document.querySelectorAll(".pdx-modal").forEach(m => m.remove());
        const card = el("div", { class: "pdx-card" },
            el("div", { class: "pdx-card-h" }, el("span", null, title), el("button", { class: "pdx-x", title: "Fechar", onClick: () => modal.remove() }, icon("close"))),
            el("div", { class: "pdx-card-b" }, body));
        const modal = el("div", { class: "pdx-modal", onClick: e => { if (e.target === modal) modal.remove(); } }, card);
        document.body.append(modal); return modal;
    }
    function detailsPopup(f) {
        const rows = [["Nome", f.name], ["Tipo", f.mime_type || "—"], ["Tamanho", f.size ? fmtSize(f.size) : "—"],
            ["Views", f.views ?? "—"], ["Downloads", f.downloads ?? "—"],
            ["Enviado", f.date_upload ? new Date(f.date_upload).toLocaleString() : "—"], ["SHA-256", f.hash_sha256 || "—"]];
        popup("Detalhes", el("div", null,
            el("table", { class: "pdx-tbl" }, ...rows.map(([k, v]) => el("tr", null, el("td", null, k), el("td", null, String(v))))),
            el("div", { class: "pdx-links" },
                el("a", { href: M().dl(f.id), target: "_blank", rel: "noopener" }, "↓ Mirror (" + M().name + ")"),
                el("a", { href: "https://pixeldrain.com/u/" + f.id, target: "_blank", rel: "noopener" }, "↗ Página oficial"),
                el("a", { href: "https://pixeldrain.com/api/file/" + f.id + "/info", target: "_blank", rel: "noopener" }, "ℹ API info"))));
    }
    function qrPopup(f) {
        popup("QR — download", el("div", { style: { textAlign: "center" } },
            el("img", { class: "pdx-qr", src: "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=" + encodeURIComponent(M().dl(f.id)), alt: "QR" }),
            el("div", { class: "pdx-qrcap" }, "Baixe direto no celular (via " + M().name + "), sem gastar cota.")));
    }

    /* ==================================================================== * (2a) TOPBAR GLOBAL (ambos os modos) — links default reais, sem mover o menu nativo (re-parentear trava) */
    function buildGlobalTopbar(fv) {
        if (fv.querySelector(":scope > .pdx-gtop")) return;
        const uname = (document.querySelector(".button_username") || {}).textContent;
        const gtop = el("div", { class: "pdx-gtop" },
            el("a", { class: "pdx-logo", href: "/", title: "Pixeldrain" }, el("img", { src: "/res/img/pixeldrain_32.png", alt: "pd" })),
            ...SITE_LINKS.map(l => el("a", { class: "pdx-glink", href: l.href, title: l.label }, icon(l.icon), el("span", null, l.label))),
            el("div", { class: "pdx-spacer" }),
            el("a", { class: "pdx-account", href: "/user", title: "Dashboard / minha conta" }, icon("account_circle"), el("span", null, (uname || "Conta").trim() || "Conta")),
            el("a", { class: "pdx-glink pdx-icononly", href: "/user/settings", title: "Configurações da conta" }, icon("settings")),
        );
        fv.insertBefore(gtop, fv.firstChild);
    }

    /* (2b) BARRA DE ÁLBUM (só no modo galeria) — título + BUSCA + Zip/Copiar todos/.txt.
       O filtro é GLOBAL (state.filter): vale p/ a galeria E p/ a tira do rodapé; chip no rodapé indica o filtro ativo. */
    function galTitleText(title, shown, total) { return (title || "Álbum") + " · " + (shown == null || shown === total ? total + " arquivos" : shown + " de " + total); }
    function matchName(node) { let nm = node.dataset.pdxName; if (nm === undefined) { nm = (node.textContent || "").trim().toLowerCase(); node.dataset.pdxName = nm; } return !state.filter || nm.indexOf(state.filter) !== -1; }
    function setFilterParam(q) {   // grava o filtro no ?q= sem recarregar (replaceState mantém path+hash de navegação)
        try { const u = new URL(location.href); if (q) u.searchParams.set("q", q); else u.searchParams.delete("q"); history.replaceState(history.state, "", u.pathname + u.search + u.hash); } catch {}
    }
    function applyFilter(q) { state.filter = (q || "").trim().toLowerCase(); setFilterParam(state.filter); filterGalleryCards(); applyStripFilter(); }
    function filterGalleryCards() {
        const cards = document.querySelectorAll(".file_preview .gallery .file");
        let shown = 0;
        cards.forEach(c => { const vis = matchName(c); c.style.display = vis ? "" : "none"; if (vis) shown++; });
        const t = document.querySelector(".pdx-galtitle");
        if (t) { const al = albumInfo(); t.textContent = galTitleText(al && al.title, state.filter ? shown : null, cards.length); }
    }
    function applyStripFilter() {
        const strip = document.querySelector(".pdx-stripwrap .pdx-strip"); if (!strip) return;
        if (strip.dataset.pdxFsig !== state.filter) {                       // só re-percorre os file_button quando a query muda
            strip.dataset.pdxFsig = state.filter;
            let shown = 0; const btns = strip.querySelectorAll(".file_button");
            // classe (não style inline) porque `.pdx-strip .file_button{display:flex!important}` ganharia do inline sem !important
            btns.forEach(b => { const vis = matchName(b); b.classList.toggle("pdx-fhide", !vis); if (vis) shown++; });
            state.stripShown = shown; state.stripTotal = btns.length;
        }
        updateStripFilterChip();
    }
    function updateStripFilterChip() {
        const bar = document.querySelector(".pdx-stripbar"); if (!bar) return;
        let chip = bar.querySelector(".pdx-stripfilter");
        if (!state.filter) { if (chip) chip.remove(); return; }
        if (!chip) {
            chip = el("div", { class: "pdx-stripfilter", title: "Filtro ativo (vindo da busca da galeria)" }, icon("filter_alt"),
                el("span", { class: "pdx-stripfilter-t" }),
                el("button", { class: "pdx-stripfilter-x", title: "Limpar filtro", onClick: clearFilter }, icon("close")));
            const label = bar.querySelector(".pdx-striplabel");
            bar.insertBefore(chip, label ? label.nextSibling : bar.firstChild);
        }
        const t = chip.querySelector(".pdx-stripfilter-t"); if (t) t.textContent = "“" + state.filter + "” · " + state.stripShown + " de " + state.stripTotal;
    }
    function clearFilter() { state.filter = ""; setFilterParam(""); filterGalleryCards(); applyStripFilter(); document.querySelectorAll(".pdx-search-in").forEach(i => { i.value = ""; }); }
    function buildGalbar(fv) {
        if (fv.querySelector(":scope > .pdx-galbar")) return;
        const al = albumInfo(); if (!al) return;
        const links = () => al.files.map(x => M().dl(x.id)).join("\n") + "\n";
        const stop = e => e.stopPropagation();                              // não deixa o keystroke subir p/ os atalhos nativos (ex.: "r" = Report)
        const bar = el("div", { class: "pdx-galbar" },
            el("div", { class: "pdx-galtitle" }, galTitleText(al.title, null, al.files.length)),
            el("label", { class: "pdx-search" }, icon("search"),
                el("input", { class: "pdx-search-in", type: "search", placeholder: "Filtrar arquivos…", value: state.filter, "aria-label": "Filtrar arquivos",
                    onInput: debounce(e => applyFilter(e.target.value), 140), onKeydown: stop, onKeyup: stop, onKeypress: stop })),
            tbtn("folder_zip", "Baixar tudo (.zip)", "Baixar o álbum inteiro via mirror", () => window.open(M().zip(al.lid), "_blank")),
            tbtn("content_copy", "Copiar todos", al.files.length + " links — cola no gerenciador", () => copyText(links()).then(() => toast(al.files.length + " links copiados"))),
            tbtn("description", "Exportar .txt", "Lista aria2 -i", () => { downloadText((al.lid || "album") + ".txt", links()); toast("Lista exportada"); }));
        const gtop = fv.querySelector(":scope > .pdx-gtop");
        fv.insertBefore(bar, gtop ? gtop.nextSibling : fv.firstChild);
    }

    /* (2c) ROW DO VÍDEO (só no modo conteúdo) — botões construídos UMA vez; handlers leem state.file */
    function buildVideoRowOnce(vrow) {
        const al = albumInfo(); const multi = !!(al && al.files.length > 1);
        vrow.append(
            // GRUPO INFO (esquerda): voltar p/ galeria + nome + stats. (Os < > saíram daqui → foram pro rodapé, na tira.)
            multi ? tbtn("grid_view", "Galeria", "Voltar para a galeria", () => { location.hash = "gallery"; }, "pdx-toview") : null,
            multi ? vsep() : null,
            el("div", { class: "pdx-name", title: "" }, icon("movie"), el("span")),
            el("div", { class: "pdx-stats" }, statCell("Views"), statCell("Downloads"), statCell("Tamanho")),
            el("div", { class: "pdx-spacer" }),
            // GRUPO AÇÕES (direita): primárias | mirror | detalhes
            tbtn("download", "Download", "Baixar este arquivo via mirror", () => state.file && window.open(M().dl(state.file.id), "_blank"), "pdx-primary"),
            tbtn("content_copy", "Copiar", "Copiar o link direto (mirror)", () => state.file && copyText(M().dl(state.file.id)).then(() => toast("Link copiado"))),
            tbtn("fullscreen", "Tela cheia", "Tela cheia", goFullscreen),
            vsep(),
            buildMirrorChip(),
            vsep(),
            tbtn("info", "", "Detalhes do arquivo", () => state.file && detailsPopup(state.file)),
            tbtn("qr_code_2", "", "QR p/ baixar no celular", () => state.file && qrPopup(state.file)),
        );
    }
    function updateVideoRow(vrow, f) {
        state.file = f;
        if (vrow.dataset.fid === String(f.id)) return;
        vrow.dataset.fid = String(f.id);
        const nameEl = vrow.querySelector(".pdx-name");
        if (nameEl) {
            nameEl.title = f.name;
            const ic = nameEl.querySelector(".icon"); if (ic) ic.textContent = isVideoFile(f) ? "movie" : isImageFile(f) ? "image" : "draft";
            const sp = nameEl.querySelector("span"); if (sp) sp.textContent = f.name;
        }
        const sv = vrow.querySelectorAll(".pdx-statv");
        if (sv[0]) sv[0].textContent = String(f.views ?? "—");
        if (sv[1]) sv[1].textContent = String(f.downloads ?? "—");
        if (sv[2]) sv[2].textContent = f.size ? fmtSize(f.size) : "—";
    }
    function refreshChips() { document.querySelectorAll(".pdx-mirror-name").forEach(m => { m.textContent = "Mirror: " + M().name; }); }
    function setMirrorLoading(on) { document.querySelectorAll(".pdx-mirror").forEach(c => c.classList.toggle("pdx-loading", !!on)); }   // loading do mirror = spinner COMPACTO dentro do chip (não o spinrão central)
    /* DROPDOWN de mirror: o chip vira clicável p/ ESCOLHER manualmente, mantendo o switch AUTOMÁTICO (failover no erro/timeout). Menu em position:FIXED (a vrow tem overflow → absolute seria cortado). */
    let mirrorCloser = null;
    function closeMirrorMenu() { document.querySelectorAll(".pdx-mirror-wrap").forEach(w => w.classList.remove("is-open")); document.querySelectorAll(".pdx-mirror-menu").forEach(m => { m.hidden = true; }); if (mirrorCloser) { document.removeEventListener("pointerdown", mirrorCloser, true); mirrorCloser = null; } }
    function openMirrorMenu(wrap) {
        const btn = wrap.querySelector(".pdx-mirror"), menu = wrap.querySelector(".pdx-mirror-menu"); if (!btn || !menu) return;
        menu.textContent = "";
        menu.append(el("div", { class: "pdx-mirror-menu-h" }, "Mirror — troca sozinho no erro"));
        MIRRORS.forEach((mir, i) => {       // monta na hora a partir do MIRRORS atual (muda quando o proxy.json entra)
            const cu = i === gIdx;
            menu.appendChild(el("button", { type: "button", class: "pdx-mirror-menu-item" + (cu ? " is-current" : ""), title: mir.name, onClick: e => { e.stopPropagation(); pickMirror(i); closeMirrorMenu(); } }, icon(cu ? "check" : "dns"), el("span", null, mir.name)));
        });
        menu.hidden = false; wrap.classList.add("is-open");
        const r = btn.getBoundingClientRect();
        menu.style.minWidth = r.width + "px";
        menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - (menu.offsetWidth || 220) - 8)) + "px";
        const mh = menu.offsetHeight;
        menu.style.top = ((r.bottom + 6 + mh > window.innerHeight) ? Math.max(8, r.top - 6 - mh) : r.bottom + 6) + "px";   // abre p/ baixo, ou p/ cima se não couber
        mirrorCloser = ev => { if (!wrap.contains(ev.target)) closeMirrorMenu(); };
        document.addEventListener("pointerdown", mirrorCloser, true);
    }
    function toggleMirrorMenu(wrap) { const m = wrap.querySelector(".pdx-mirror-menu"); if (m && m.hidden) openMirrorMenu(wrap); else closeMirrorMenu(); }
    function pickMirror(i) { prefIdx = gIdx = ((i % MIRRORS.length) + MIRRORS.length) % MIRRORS.length; if (cur) applyMirror(cur.media); refreshChips(); toast("Mirror: " + M().name); }   // escolha manual = vira o preferido (próximo arquivo começa nele)
    function buildMirrorChip() {
        const chev = icon("expand_more"); chev.classList.add("pdx-mirror-chev");
        const wrap = el("div", { class: "pdx-mirror-wrap" });
        const btn = el("button", { type: "button", class: "pdx-item pdx-mirror", title: "Mirror atual (origem do stream) — troca sozinho no erro/timeout; clique p/ escolher",
            onClick: e => { e.stopPropagation(); toggleMirrorMenu(wrap); } },
            el("span", { class: "pdx-mirror-spin", "aria-hidden": "true" }), icon("dns"), el("span", { class: "pdx-mirror-name" }, "Mirror: " + M().name), chev);
        wrap.append(btn, el("div", { class: "pdx-mirror-menu", hidden: "" }));
        return wrap;
    }

    /* (3) STRIP de thumbs no rodapé (modo conteúdo) — o .nav_container nativo movido p/ dentro de um wrap c/ barra de controle */
    function filteredIndices() {   // índices (no álbum) que passam no filtro atual; sem filtro = todos
        const a = albumInfo(); if (!a) return [];
        if (!state.filter) return a.files.map((_, i) => i);
        const out = [];
        a.files.forEach((f, i) => { if ((f.name || "").toLowerCase().indexOf(state.filter) !== -1) out.push(i); });
        return out;
    }
    function navItem(d) {           // próximo/anterior DENTRO da lista filtrada (respeita state.filter)
        const a = albumInfo(); if (!a || !a.files.length) return;
        const idxs = filteredIndices(); if (!idxs.length) return;
        const cur = currentIndex();
        const pos = idxs.indexOf(cur);
        let target;
        if (pos === -1) target = d > 0 ? (idxs.find(i => i > cur) ?? idxs[0]) : ([...idxs].reverse().find(i => i < cur) ?? idxs[idxs.length - 1]);   // atual fora do filtro → vizinho filtrado na direção
        else target = idxs[((pos + d) % idxs.length + idxs.length) % idxs.length];                                                                  // wrap dentro do filtro
        location.hash = "#item=" + target;
    }
    function scrollStripToCenter(btn) {        // centraliza horizontalmente na tira (scrollBy = só horizontal, não rola a página)
        const ln = document.querySelector(".pdx-stripwrap .list_navigator"); if (!ln || !btn) return;
        const br = btn.getBoundingClientRect(), lr = ln.getBoundingClientRect();
        if (!br.width) return;                 // escondido (filtrado) → não centraliza
        const delta = (br.left + br.width / 2) - (lr.left + lr.width / 2);
        try { ln.scrollBy({ left: delta, behavior: "smooth" }); } catch { ln.scrollLeft += delta; }
    }
    function markStripCurrent() {              // destaca + centraliza o vídeo atual na tira (atual = o N-ésimo file_button, ordem = álbum)
        const strip = document.querySelector(".pdx-stripwrap .pdx-strip"); if (!strip) return;
        const btns = strip.querySelectorAll(".file_button"); if (!btns.length) return;
        const ci = currentIndex();
        btns.forEach((b, i) => b.classList.toggle("pdx-strip-cur", i === ci));
        if (btns[ci]) scrollStripToCenter(btns[ci]);
    }
    function scrollStrip(dir) {                                   // < > rolam a tira (no lugar da scrollbar horizontal)
        const ln = document.querySelector(".pdx-stripwrap .list_navigator"); if (!ln) return;
        const amt = Math.max(180, (ln.clientWidth || 600) * 0.82);
        try { ln.scrollBy({ left: dir * amt, behavior: "smooth" }); } catch { ln.scrollLeft += dir * amt; }
    }
    function applyStripCollapsed(w) {
        const c = !!prefs.stripCollapsed;
        w.classList.toggle("pdx-collapsed", c);
        const ic = w.querySelector(".pdx-strip-toggle .icon"); if (ic) ic.textContent = c ? "expand_less" : "expand_more";
    }
    function toggleStripCollapsed() { prefs.stripCollapsed = !prefs.stripCollapsed; saveP(); const w = document.querySelector(".pdx-stripwrap"); if (w) applyStripCollapsed(w); }
    function buildStripBar() {
        return el("div", { class: "pdx-stripbar" },
            el("button", { class: "pdx-sbtn pdx-strip-toggle", title: "Recolher / expandir a tira", onClick: toggleStripCollapsed }, icon("expand_more")),
            el("span", { class: "pdx-striplabel" }, "Arquivos do álbum"),
            el("div", { class: "pdx-spacer" }),
            el("button", { class: "pdx-sbtn pdx-strip-prev", title: "Rolar p/ trás", onClick: () => scrollStrip(-1) }, icon("chevron_left")),
            el("button", { class: "pdx-sbtn pdx-strip-next", title: "Rolar p/ frente", onClick: () => scrollStrip(1) }, icon("chevron_right")),
        );
    }
    function setupStrip(fv) {
        let wrap = fv.querySelector(":scope > .pdx-stripwrap");
        const al = albumInfo();
        if (!al || al.files.length <= 1) {                       // item único / fora de álbum → SEM bottombar (e remove a que sobrou de um álbum anterior na SPA)
            if (wrap) wrap.remove();
            return;
        }
        const nav = fv.querySelector(":scope > .nav_container") || (wrap && wrap.querySelector(".nav_container"));
        if (!nav) return;                                        // arquivo único / sem tira
        if (!wrap) {
            wrap = el("div", { class: "pdx-stripwrap" });
            wrap.append(buildStripBar());
            const prog = fv.querySelector(":scope > .progress_bar_outer");
            if (prog) fv.insertBefore(wrap, prog); else fv.appendChild(wrap);
            applyStripCollapsed(wrap);
        }
        if (nav.parentNode !== wrap) {                           // move a tira nativa p/ dentro do wrap (1x; ou se o Svelte recriou)
            wrap.querySelectorAll(":scope > .nav_container").forEach(n => { if (n !== nav) try { n.remove(); } catch {} });
            nav.classList.add("pdx-strip"); hide(nav.querySelector(".nav_button"));
            wrap.append(nav);
            delete nav.dataset.pdxFsig;                          // tira nova → força re-aplicar o filtro
        }
        applyStripFilter();                                      // propaga o filtro da galeria p/ a tira (guard por Fsig = barato)
    }

    /* ==================================================================== * Orquestração — sync unificado (galeria nativa ↔ conteúdo) */
    let lastSig = null;
    const sync = debounce(() => {
        const fv = document.querySelector(".file_viewer");
        const row = document.querySelector(".file_preview_row");
        if (!fv || !row) return;
        hideForeign(fv, ["file_preview_row", "nav_container"]);   // esconde TODO chrome nativo do file_viewer (headerbar, progress bar E o loading órfão do canto) — mantém só conteúdo + tira (movida depois) + nossa UI
        hideForeign(row, ["file_preview"]);                       // dentro da row: esconde toolbar/loaders nativos, mantém só o .file_preview (preview + galeria nativa)
        const preview = row.querySelector(".file_preview");
        if (preview) preview.style.left = "0";
        buildGlobalTopbar(fv);

        const gal = inGallery();
        const f = gal ? null : currentFile();
        const sig = (gal ? "G" : "C") + "|" + location.hash + "|" + (f ? f.id : "");
        if (sig === lastSig) {                   // PERF: nada mudou de fato → evita re-trabalho, só mantém o essencial
            if (gal) clearPlayerOverlay();
            else if (f && isVideoFile(f)) mountPlayer(f);   // se o Svelte tirou meu overlay, remonta (guard interno = barato)
            else if (f && isImageFile(f)) mountImage(f);
            return;
        }
        lastSig = sig;
        if (state.filter) setFilterParam(state.filter);   // reafirma o ?q após navegação (o hash-router nativo pode reescrever a URL)

        if (gal) {                               // GALERIA NATIVA (grid dentro do .file_preview)
            clearPlayerOverlay();                // tira o overlay do player → fim do PRETO
            buildGalbar(fv);
            const si = fv.querySelector(".pdx-search-in"); if (si && si.value !== state.filter) si.value = state.filter;
            if (state.filter) { filterGalleryCards(); setTimeout(filterGalleryCards, 120); }   // mantém o filtro ao voltar (cards podem renderizar tarde)
            fv.classList.add("pdx-mode-gallery"); fv.classList.remove("pdx-mode-content");
            return;
        }
        fv.classList.add("pdx-mode-content"); fv.classList.remove("pdx-mode-gallery");
        if (!f) { teardownPlayer(); return; }
        lastIndex = currentIndex();
        let vrow = fv.querySelector(":scope > .pdx-vrow");
        if (!vrow) { vrow = el("div", { class: "pdx-vrow" }); fv.insertBefore(vrow, row); buildVideoRowOnce(vrow); }
        updateVideoRow(vrow, f);
        setupStrip(fv);
        if (isVideoFile(f)) mountPlayer(f);
        else if (isImageFile(f)) mountImage(f);
        else teardownPlayer();
        if (f.id !== lastId) { lastId = f.id; setTimeout(markStripCurrent, 60); }
    }, 120);

    /* TEMA: AMOLED #000, texto branco (alto contraste), verde só nos botões */
    addStyle(`
        :root{ --pdx-green:#6fb586; --pdx-green-2:#8ad0a3; --pdx-text:#f2f4f2; --pdx-muted:#8b918b; --pdx-surface:#0a0b0a; --pdx-line:#1b1f1b; }
        :root, html, body {
            --body_background:#000!important; --body_color:#000!important; --background_color:#000!important; --background:#000!important;
            --background_pattern:none!important; --background_pattern_color:#000!important;
            --background_text_color:#f2f4f2!important; --body_text_color:#f2f4f2!important;
            --card_color:#0a0b0a!important; --shaded_background:rgba(0,0,0,.9)!important;
            --separator:#1b1f1b!important; --shadow_color:#000!important;
            --highlight_color:#6fb586!important; --highlight_background:rgba(111,181,134,.16)!important; --highlight_text_color:#04140a!important;
            --link_color:#8ad0a3!important;
            --input_background:#0e100e!important; --input_hover_background:#171a17!important; --input_text:#f2f4f2!important;
            --scrollbar_foreground_color:#2c3b32!important; --scrollbar_hover_color:#6fb586!important; --danger_color:#d9737d!important;
        }
        body{ background:#000!important; }
        /* EARLY PAINT: pré-esconde o chrome nativo JÁ no document-start (antes da 1ª pintura) → não pisca enquanto o hideForeign do sync não roda */
        .file_viewer > .headerbar, .file_viewer > .progress_bar_outer, .file_preview_row > .toolbar{ display:none!important; }
        .file_preview, .file_preview .block{ background:#000!important; border:none!important; }   /* nunca mostrar branco atrás do conteúdo */

        /* galeria NATIVA (#gallery, dentro do .file_preview): vira GRID amplo (−1 coluna/maiores + mais espaço) MANTENDO o card NATIVO intacto.
           NÃO mexer no fluxo do thumb (.icon_container) — fazer absolute/height:0 parou de renderizar as imagens. Só grid + tamanho. */
        .file_preview .gallery{ background:#000!important; display:grid!important; grid-template-columns:repeat(auto-fill,minmax(245px,1fr))!important; gap:16px!important; padding:8px 10px 24px!important; align-content:start!important; }
        .file_preview .gallery .file{ width:auto!important; max-width:none!important; margin:0!important; border:1px solid var(--pdx-line,#1b1f1b)!important; border-radius:8px!important; overflow:hidden!important; font-size:13px!important; font-weight:700!important; }
        .file_preview .gallery .file .icon_container{ width:100%!important; background-size:cover!important; background-position:center!important; }   /* enche a coluna (mais larga) → imagem maior, sem tirar do fluxo */
        .file_preview .gallery .file:hover{ border-color:var(--pdx-green,#6fb586)!important; }
        .file_preview .gallery .highlight{ box-shadow:0 0 0 2px var(--pdx-green,#6fb586)!important; border-color:var(--pdx-green,#6fb586)!important; }
    `);

    /* UI do script */
    addStyle(`
        .pdx-gtop, .pdx-vrow, .pdx-galbar{ display:flex; align-items:center; gap:6px; overflow-x:auto; overflow-y:hidden; scrollbar-width:thin; white-space:nowrap; flex:0 0 auto; }
        .pdx-gtop::-webkit-scrollbar, .pdx-vrow::-webkit-scrollbar, .pdx-galbar::-webkit-scrollbar{ height:6px; }
        .pdx-gtop::-webkit-scrollbar-thumb, .pdx-vrow::-webkit-scrollbar-thumb, .pdx-galbar::-webkit-scrollbar-thumb{ background:#6fb58655; border-radius:4px; }

        .pdx-gtop{ padding:5px 10px; gap:3px; background:#000; border-bottom:1px solid var(--pdx-line,#1b1f1b); }
        .pdx-logo{ display:inline-flex; align-items:center; padding:0 6px 0 2px; flex:0 0 auto; } .pdx-logo img{ height:22px; width:22px; display:block; }
        .pdx-glink{ flex:0 0 auto; display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:8px; border:1px solid transparent; color:var(--pdx-text,#f2f4f2); text-decoration:none; font:13px/1 system-ui,-apple-system,sans-serif; transition:background .12s,border-color .12s; }
        .pdx-glink:hover{ background:var(--input_hover_background,#171a17); border-color:#6fb58633; }
        .pdx-glink .icon{ font-size:18px; color:var(--pdx-green,#6fb586); } .pdx-glink.pdx-icononly{ padding:6px 8px; }
        .pdx-account{ flex:0 0 auto; display:inline-flex; align-items:center; gap:7px; padding:6px 12px; border-radius:8px; background:rgba(111,181,134,.12); border:1px solid #6fb58644; color:var(--pdx-text,#f2f4f2); text-decoration:none; font:13px/1 system-ui; font-weight:600; }
        .pdx-account:hover{ background:rgba(111,181,134,.2); } .pdx-account .icon{ color:var(--pdx-green,#6fb586); font-size:19px; }

        .pdx-galbar{ padding:6px 10px; background:var(--pdx-surface,#0a0b0a); border-bottom:1px solid var(--pdx-line,#1b1f1b); }
        .pdx-galtitle{ flex:0 0 auto; padding:0 4px; font-weight:600; color:var(--pdx-text,#f2f4f2); }
        /* busca: só border-bottom (sempre visível), focus = ring só embaixo, e largo (flex-grow) */
        .pdx-search{ flex:1 1 520px; min-width:160px; display:inline-flex; align-items:center; gap:8px; margin:0 12px; padding:6px 2px; border:0; border-bottom:2px solid #2a2f2a; border-radius:0; background:transparent; box-shadow:0 1px 0 0 transparent; transition:border-color .14s, box-shadow .14s; }
        .pdx-search:focus-within{ border-bottom-color:var(--pdx-green,#6fb586); box-shadow:0 1px 0 0 var(--pdx-green,#6fb586); }
        .pdx-search .icon{ font-size:19px; color:var(--pdx-muted,#8b918b); flex:0 0 auto; } .pdx-search:focus-within .icon{ color:var(--pdx-green,#6fb586); }
        .pdx-search-in{ flex:1 1 auto; min-width:40px; background:transparent; border:none; outline:none; color:var(--pdx-text,#f2f4f2); font:14px system-ui,-apple-system,sans-serif; }
        .pdx-search-in::placeholder{ color:var(--pdx-muted,#8b918b); } .pdx-search-in::-webkit-search-cancel-button{ filter:invert(.6); cursor:pointer; }
        .file_viewer.pdx-mode-content > .pdx-galbar{ display:none!important; }
        .file_viewer.pdx-mode-gallery > .pdx-vrow{ display:none!important; }
        .file_viewer.pdx-mode-content > .pdx-gtop{ display:none!important; }   /* no vídeo/imagem: SÓ a vrow (info) no topo — topbar global some (estilo bunkr); volta na galeria */

        .pdx-vrow{ padding:7px 10px; background:var(--pdx-surface,#0a0b0a); border-bottom:1px solid var(--pdx-line,#1b1f1b); }
        .pdx-name{ flex:0 1 auto; min-width:60px; max-width:32vw; display:inline-flex; align-items:center; gap:7px; padding:0 4px; color:var(--pdx-text,#f2f4f2); font-weight:600; }
        .pdx-name .icon{ color:var(--pdx-green,#6fb586); font-size:18px; flex:0 0 auto; } .pdx-name span{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .pdx-stats{ display:flex; align-items:center; gap:20px; padding:0 8px; flex:0 0 auto; }
        .pdx-stat{ display:inline-flex; align-items:baseline; gap:7px; }
        .pdx-stat .pdx-k{ font-size:.72em; color:var(--pdx-muted,#8b918b); text-transform:uppercase; letter-spacing:.05em; }
        .pdx-stat .pdx-statv{ font-size:.95em; color:var(--pdx-text,#f2f4f2); font-weight:700; }
        .pdx-spacer{ flex:1 1 auto; min-width:8px; } .pdx-vsep{ flex:0 0 auto; width:1px; height:22px; margin:0 3px; background:var(--pdx-line,#1b1f1b); }

        .pdx-item{ flex:0 0 auto; display:inline-flex; align-items:center; gap:7px; padding:7px 11px; border:1px solid var(--pdx-line,#1b1f1b); border-radius:8px;
            background:var(--input_background,#0e100e); color:var(--pdx-text,#f2f4f2); font:13px/1 system-ui,-apple-system,sans-serif; cursor:pointer; text-decoration:none; transition:background .12s,border-color .12s; }
        .pdx-item:hover{ background:var(--input_hover_background,#171a17); border-color:#6fb58666; }
        .pdx-item .icon{ font-size:18px; color:var(--pdx-green,#6fb586); }
        .pdx-item span{ white-space:nowrap; color:var(--pdx-text,#f2f4f2); }
        .pdx-primary{ background:var(--pdx-green,#6fb586); border-color:var(--pdx-green,#6fb586); }
        .pdx-primary .icon, .pdx-primary span{ color:#06170d; }
        .pdx-primary:hover{ background:var(--pdx-green-2,#8ad0a3); border-color:var(--pdx-green-2,#8ad0a3); }
        .pdx-mirror{ background:rgba(111,181,134,.12); border-color:#6fb58644; cursor:pointer; }
        .pdx-mirror-spin{ display:none; width:14px; height:14px; flex:0 0 auto; border-radius:50%; border:2px solid #6fb58655; border-top-color:var(--pdx-green,#6fb586); animation:pdx-spin .7s linear infinite; }
        .pdx-mirror.pdx-loading .pdx-mirror-spin{ display:inline-block; }   /* testando/carregando o mirror → spinner no lugar do ícone dns */
        .pdx-mirror.pdx-loading > .icon:not(.pdx-mirror-chev){ display:none; }   /* esconde o dns no loading, mas mantém o chevron */
        /* dropdown de mirror (clicável) */
        .pdx-mirror-wrap{ position:relative; flex:0 0 auto; display:inline-flex; }
        .pdx-mirror-chev{ font-size:16px!important; margin-left:-2px; opacity:.7; transition:transform .12s; }
        .pdx-mirror-wrap.is-open .pdx-mirror-chev{ transform:rotate(180deg); }
        .pdx-mirror-menu{ position:fixed; z-index:10002; min-width:200px; max-height:300px; overflow:auto; display:flex; flex-direction:column; gap:2px; padding:6px; background:rgba(14,16,14,.98); border:1px solid var(--pdx-line,#1b1f1b); border-radius:10px; box-shadow:0 12px 34px rgba(0,0,0,.6); }
        .pdx-mirror-menu[hidden]{ display:none; }
        .pdx-mirror-menu-h{ padding:4px 8px 6px; font-size:11px; color:var(--pdx-muted,#8b918b); text-transform:uppercase; letter-spacing:.04em; }
        .pdx-mirror-menu-item{ display:flex; align-items:center; gap:8px; padding:7px 10px; border:0; border-radius:7px; background:transparent; color:var(--pdx-text,#f2f4f2); font:13px system-ui,-apple-system,sans-serif; cursor:pointer; text-align:left; white-space:nowrap; }
        .pdx-mirror-menu-item:hover{ background:var(--input_hover_background,#171a17); }
        .pdx-mirror-menu-item .icon{ font-size:16px; color:var(--pdx-muted,#8b918b); flex:0 0 auto; }
        .pdx-mirror-menu-item.is-current{ color:var(--pdx-green,#6fb586); font-weight:700; }
        .pdx-mirror-menu-item.is-current .icon{ color:var(--pdx-green,#6fb586); }
        .pdx-item.pdx-info{ cursor:default; } .pdx-item.pdx-info:hover{ background:rgba(111,181,134,.12); border-color:#6fb58644; }   /* info, não botão */
        .pdx-toview{ background:rgba(111,181,134,.14); border-color:#6fb58655; }
        .pdx-nav{ padding:7px 8px; }

        .pdx-host{ position:absolute; inset:0; z-index:30; background:#000; overflow:hidden; }
        .pdx-video{ position:absolute; inset:0; width:100%; height:100%; object-fit:contain; background:#000; outline:none; cursor:pointer; display:block; }
        /* IMAGEM (mesmo overlay z-index:30): ajusta por padrão; clique = tamanho real c/ scroll no host */
        .pdx-img-host{ display:flex; align-items:center; justify-content:center; }   /* overflow:hidden herdado do .pdx-host → o zoom NÃO rola (é transform), as setas ficam fixas */
        .pdx-image{ max-width:100%; max-height:100%; width:auto; height:auto; background:#000; display:block; cursor:zoom-in; user-select:none; -webkit-user-drag:none; transform-origin:center center; will-change:transform; touch-action:none; }
        .pdx-img-host.pdx-zoomed .pdx-image{ cursor:grab; }
        .pdx-img-host.pdx-zoomed .pdx-image:active{ cursor:grabbing; }
        .pdx-img-host:hover .pdx-plc-side{ opacity:1; pointer-events:auto; }
        @media (hover:none){ .pdx-img-host .pdx-plc-side{ opacity:.85; pointer-events:auto; } }
        .pdx-img-host .pdx-plc-side svg{ width:26px; height:26px; display:block; fill:none!important; }
        .pdx-fail{ position:absolute; inset:0; z-index:6; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:24px; text-align:center; color:#fff; background:rgba(0,0,0,.9); font:14px system-ui; }
        .pdx-failrow{ display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
        .pdx-mini{ padding:6px 12px; border:1px solid #6fb58655; border-radius:7px; background:#0e100e; color:var(--pdx-text,#f2f4f2); cursor:pointer; text-decoration:none; } .pdx-mini:hover{ background:#171a17; }

        /* ---- controles do NOSSO player (portados do xenforo, accent = verde): play central + barra inferior YouTube ---- */
        .pdx-plc-flash{ position:absolute; inset:0; z-index:2; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity .2s ease; }
        .pdx-pl:not(.pdx-pl-playing):not(.pdx-pl-buffering) .pdx-plc-flash{ opacity:1; }   /* pausado → play central visível (affordance) */
        .pdx-plc-flash button{ border:0; border-radius:50%; cursor:pointer; padding:0; background:rgba(0,0,0,.55); color:#fff; display:flex; align-items:center; justify-content:center; transition:transform .12s ease, background .12s ease; pointer-events:none; }
        .pdx-plc-flash button:hover{ transform:scale(1.08); background:rgba(0,0,0,.72); }
        .pdx-pl:not(.pdx-pl-playing) .pdx-plc-flash button{ pointer-events:auto; }
        .pdx-plc-play{ width:64px; height:64px; } .pdx-plc-play svg{ width:30px; height:30px; display:block; margin-left:3px; }
        @media (max-width:600px){ .pdx-plc-play{ width:54px; height:54px; } .pdx-plc-play svg{ width:26px; height:26px; } }
        .pdx-plc-bottom{ position:absolute; left:0; right:0; bottom:0; z-index:3; padding:8px 6px 3px; background:linear-gradient(to top, rgba(0,0,0,.8) 0%, rgba(0,0,0,.3) 62%, transparent 100%); opacity:0; pointer-events:none; transition:opacity .18s ease; }
        .pdx-pl:hover .pdx-plc-bottom, .pdx-pl:not(.pdx-pl-playing) .pdx-plc-bottom{ opacity:1; pointer-events:auto; }
        @media (hover:none){ .pdx-plc-bottom{ opacity:1; pointer-events:auto; } }
        .pdx-plc-prog{ position:relative; width:100%; height:14px; display:flex; align-items:center; cursor:pointer; touch-action:none; }
        .pdx-plc-bar{ position:relative; width:100%; height:3px; background:rgba(255,255,255,.28); border-radius:3px; transition:height .1s ease; }
        .pdx-plc-prog:hover .pdx-plc-bar{ height:5px; }
        .pdx-plc-buf{ position:absolute; left:0; top:0; bottom:0; width:0; background:rgba(255,255,255,.30); border-radius:3px; pointer-events:none; }
        .pdx-plc-fill{ position:absolute; left:0; top:0; bottom:0; width:0; background:var(--pdx-green,#6fb586); border-radius:3px; pointer-events:none; }
        .pdx-plc-knob{ position:absolute; right:-6px; top:50%; width:12px; height:12px; border-radius:50%; background:var(--pdx-green,#6fb586); transform:translateY(-50%) scale(0); transition:transform .1s ease; }
        .pdx-plc-prog:hover .pdx-plc-knob{ transform:translateY(-50%) scale(1); }
        .pdx-plc-row{ display:flex; align-items:center; justify-content:space-between; gap:4px; padding:1px 4px 2px; }
        .pdx-plc-left, .pdx-plc-right{ display:flex; align-items:center; gap:1px; }
        .pdx-plc-act{ width:40px; height:40px; border:0; border-radius:50%; cursor:pointer; padding:0; background:transparent; color:#fff; opacity:.92; display:flex; align-items:center; justify-content:center; transition:opacity .1s ease, transform .1s ease; }   /* flat (YouTube): sem círculo no hover */
        .pdx-plc-act:hover{ opacity:1; } .pdx-plc-act:active{ transform:scale(.86); }
        .pdx-plc-act svg{ width:24px; height:24px; display:block; filter:drop-shadow(0 0 1px rgba(0,0,0,.45)); }
        .pdx-pl .pdx-plc-act svg{ fill:none!important; } .pdx-pl .pdx-plc-play svg, .pdx-pl .pdx-plc-barplay svg{ fill:currentColor!important; }
        .pdx-plc-vol{ display:flex; align-items:center; }
        .pdx-plc-volbar{ position:relative; width:0; height:4px; border-radius:3px; background:rgba(255,255,255,.35); cursor:pointer; opacity:0; transition:width .18s ease, opacity .18s ease, margin .18s ease; touch-action:none; }
        .pdx-plc-vol:hover .pdx-plc-volbar{ width:60px; opacity:1; margin:0 6px 0 2px; }
        .pdx-plc-volbar::before{ content:""; position:absolute; left:0; right:0; top:-9px; bottom:-9px; }
        .pdx-plc-volfill{ position:absolute; left:0; top:0; bottom:0; width:0; background:#fff; border-radius:3px; pointer-events:none; }
        .pdx-plc-time{ color:#fff; font:600 12px/1 system-ui,-apple-system,sans-serif; font-variant-numeric:tabular-nums; padding:0 6px; white-space:nowrap; flex:0 0 auto; }
        @media (max-width:600px){ .pdx-plc-act{ width:30px; height:30px; } .pdx-plc-act svg{ width:19px; height:19px; } .pdx-plc-time{ font-size:11px; padding:0 4px; } }
        .pdx-plc-seekflash{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); z-index:3; color:#fff; font:700 15px/1 system-ui,-apple-system,sans-serif; background:rgba(0,0,0,.55); padding:9px 15px; border-radius:999px; opacity:0; transition:opacity .15s ease; pointer-events:none; white-space:nowrap; }
        .pdx-plc-seekflash.on{ opacity:1; }
        .pdx-pl.pdx-pl-buffering::after{ content:""; position:absolute; top:50%; left:50%; width:42px; height:42px; margin:-21px 0 0 -21px; border-radius:50%; border:3px solid rgba(255,255,255,.22); border-top-color:rgba(255,255,255,.9); animation:pdx-spin .8s linear infinite; z-index:4; pointer-events:none; }
        .pdx-host:fullscreen{ width:100vw; height:100vh; background:#000; } .pdx-host:fullscreen .pdx-video{ height:100%; }
        @keyframes pdx-spin{ to{ transform:rotate(360deg); } }
        /* velocidade = botão de TEXTO; −5/+5 = ícone (seta circular) com "5" por cima */
        .pdx-plc-speed{ width:auto!important; min-width:40px; padding:0 10px; color:#fff; font:800 13px/1 system-ui,-apple-system,sans-serif; font-variant-numeric:tabular-nums; }
        .pdx-plc-skip{ position:relative; }
        .pdx-plc-skip .pdx-plc-skipn{ position:absolute; left:0; right:0; top:53%; transform:translateY(-50%); text-align:center; font:800 8.5px/1 system-ui,-apple-system,sans-serif; color:#fff; pointer-events:none; text-shadow:0 0 2px rgba(0,0,0,.5); }
        .pdx-plc-speedwrap{ position:relative; display:flex; align-items:center; }
        .pdx-plc-speedmenu{ position:absolute; bottom:calc(100% + 8px); right:0; z-index:5; display:none; flex-direction:column; gap:2px; padding:6px; max-height:240px; overflow:auto; background:rgba(16,18,16,.97); border:1px solid var(--pdx-line,#1b1f1b); border-radius:9px; box-shadow:0 8px 24px rgba(0,0,0,.55); }
        .pdx-plc-speedmenu.open{ display:flex; }
        .pdx-plc-speeditem{ border:0; background:transparent; color:#fff; font:600 13px/1 system-ui,-apple-system,sans-serif; padding:7px 16px; border-radius:6px; cursor:pointer; text-align:right; white-space:nowrap; }
        .pdx-plc-speeditem:hover{ background:rgba(255,255,255,.12); }
        .pdx-plc-speeditem.on{ color:var(--pdx-green,#6fb586); font-weight:800; }
        /* setas < > nos cantos (prev/next mídia) — aparecem no hover do player */
        .pdx-plc-side{ position:absolute; top:50%; transform:translateY(-50%); z-index:4; width:46px; height:46px; border:0; border-radius:50%; background:rgba(0,0,0,.5); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity .18s ease, background .12s ease; }
        .pdx-plc-sprev{ left:12px; } .pdx-plc-snext{ right:12px; }
        .pdx-pl:hover .pdx-plc-side{ opacity:1; pointer-events:auto; }
        @media (hover:none){ .pdx-plc-side{ opacity:.85; pointer-events:auto; } }
        .pdx-plc-side:hover{ background:rgba(0,0,0,.74); } .pdx-plc-side:active{ transform:translateY(-50%) scale(.92); }
        .pdx-pl .pdx-plc-side svg{ width:26px; height:26px; display:block; fill:none!important; }

        /* rodapé (conteúdo): wrap = barra de controle (colapso + < >) + a tira nativa movida pra dentro */
        .pdx-stripwrap{ display:flex; flex-direction:column; flex:0 0 auto; background:var(--pdx-surface,#0a0b0a); border-top:1px solid var(--pdx-line,#1b1f1b); }
        .file_viewer.pdx-mode-gallery > .pdx-stripwrap{ display:none!important; }
        .pdx-stripbar{ display:flex; align-items:center; gap:6px; padding:5px 8px; }
        .pdx-striplabel{ font-size:12px; font-weight:600; color:var(--pdx-muted,#8b918b); white-space:nowrap; }
        .pdx-sbtn{ display:inline-flex; align-items:center; justify-content:center; width:32px; height:28px; padding:0; flex:0 0 auto; border:1px solid var(--pdx-line,#1b1f1b); border-radius:7px; background:var(--input_background,#0e100e); color:var(--pdx-text,#f2f4f2); cursor:pointer; transition:background .12s,border-color .12s; }
        .pdx-sbtn:hover{ background:var(--input_hover_background,#171a17); border-color:#6fb58666; }
        .pdx-sbtn .icon{ font-size:20px; color:var(--pdx-green,#6fb586); }
        .pdx-stripfilter{ display:inline-flex; align-items:center; gap:6px; flex:0 0 auto; padding:3px 5px 3px 10px; border:1px solid #6fb58655; border-radius:999px; background:rgba(111,181,134,.12); color:var(--pdx-text,#f2f4f2); font:12px system-ui,-apple-system,sans-serif; white-space:nowrap; }
        .pdx-stripfilter > .icon{ font-size:16px; color:var(--pdx-green,#6fb586); }
        .pdx-stripfilter-x{ display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; padding:0; border:none; border-radius:50%; background:transparent; color:var(--pdx-muted,#8b918b); cursor:pointer; }
        .pdx-stripfilter-x:hover{ background:#6fb58633; color:var(--pdx-text,#f2f4f2); } .pdx-stripfilter-x .icon{ font-size:16px; color:inherit; }
        .pdx-stripwrap.pdx-collapsed .pdx-strip{ display:none!important; }
        .pdx-stripwrap.pdx-collapsed .pdx-strip-prev, .pdx-stripwrap.pdx-collapsed .pdx-strip-next{ display:none; }
        /* a tira: !important porque o nativo .list_navigator.svelte-xbrph3.svelte-xbrph3 (3 classes) ganha; scrollbar escondida (navega pelos < >) */
        .pdx-strip{ display:flex!important; flex-direction:column!important; flex:0 0 auto!important; max-height:138px!important; border:none!important; background:transparent!important; }
        .pdx-strip .list_navigator{ display:flex!important; flex-wrap:nowrap!important; align-items:center!important; overflow-x:auto!important; overflow-y:hidden!important; white-space:nowrap!important; gap:8px!important; padding:8px!important; flex:1 1 auto!important; scrollbar-width:none!important; }
        .pdx-strip .list_navigator::-webkit-scrollbar{ display:none!important; height:0!important; }
        .pdx-strip .file_button{ width:128px!important; height:96px!important; flex:0 0 auto!important; display:flex!important; flex-direction:column!important; align-items:stretch!important;
            padding:0 7px 6px!important; margin:0!important; overflow:hidden!important; border:1px solid var(--pdx-line,#1b1f1b)!important; border-radius:9px!important; background:#0e100e!important;
            color:var(--pdx-text,#f2f4f2)!important; font-size:11px!important; line-height:1.2!important; white-space:normal!important; word-break:break-word!important; box-shadow:none!important; vertical-align:top!important; transition:border-color .12s, transform .12s!important; }
        .pdx-strip .file_button:hover{ border-color:#6fb58666!important; transform:translateY(-2px); text-decoration:none!important; }
        .pdx-strip .file_button > img{ width:calc(100% + 14px)!important; height:64px!important; min-height:64px!important; margin:0 -7px 5px!important; object-fit:cover!important; float:none!important; display:block!important; background:#000; border-radius:8px 8px 0 0; }
        .pdx-strip .file_button.file_selected, .pdx-strip .file_button.pdx-strip-cur{ border-color:var(--pdx-green)!important; box-shadow:0 0 0 2px var(--pdx-green), 0 0 14px -2px var(--pdx-green)!important; }
        .pdx-strip .file_button.pdx-fhide{ display:none!important; }   /* filtro: 3 classes + !important ganha do display:flex!important */

        .pdx-toast{ position:fixed; left:50%; bottom:18px; transform:translateX(-50%) translateY(12px); z-index:10000; padding:9px 16px; border-radius:20px;
            background:var(--pdx-surface,#0a0b0a); border:1px solid #6fb58655; color:var(--pdx-text,#f2f4f2); font:13px system-ui; box-shadow:0 4px 18px #000; opacity:0; pointer-events:none; transition:opacity .2s,transform .2s; }
        .pdx-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
        .pdx-modal{ position:fixed; inset:0; z-index:10001; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.75); }
        .pdx-card{ background:var(--pdx-surface,#0a0b0a); color:var(--pdx-text,#f2f4f2); border:1px solid #6fb58633; border-radius:12px; min-width:300px; max-width:92vw; max-height:88vh; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 10px 40px #000; }
        .pdx-card-h{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; background:#000; font-weight:600; border-bottom:1px solid var(--pdx-line,#1b1f1b); }
        .pdx-x{ background:none; border:none; color:inherit; cursor:pointer; display:flex; opacity:.8; } .pdx-x:hover{ opacity:1; color:var(--pdx-green); }
        .pdx-card-b{ padding:14px; overflow:auto; }
        .pdx-tbl{ width:100%; border-collapse:collapse; font-size:13px; } .pdx-tbl td{ padding:5px 8px; border-bottom:1px solid var(--pdx-line,#1b1f1b); vertical-align:top; word-break:break-all; } .pdx-tbl td:first-child{ color:var(--pdx-muted,#8b918b); white-space:nowrap; width:1%; }
        .pdx-links{ display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; } .pdx-links a{ padding:6px 10px; border-radius:6px; background:#0e100e; color:var(--pdx-green); text-decoration:none; font-size:12px; border:1px solid #6fb58633; } .pdx-links a:hover{ background:#171a17; }
        .pdx-qr{ width:240px; height:240px; border-radius:8px; background:#fff; } .pdx-qrcap{ margin-top:10px; font-size:12px; color:var(--pdx-muted,#8b918b); max-width:240px; margin-inline:auto; }
    `);

    /* observer: ignora mutações da PRÓPRIA UI e da galeria nativa (1196 thumbs lazy = muita mutação à toa) */
    const OURS = ".pdx-gtop,.pdx-vrow,.pdx-galbar,.pdx-stripwrap,.pdx-strip,.pdx-host,.pdx-toast,.pdx-modal,.gallery";
    function relevant(muts) {
        for (const m of muts) { const t = m.target; if (t && t.nodeType === 1 && t.closest && t.closest(OURS)) continue; return true; }
        return false;
    }
    /* boot: o CSS já foi injetado sync lá em cima (antes da 1ª pintura = early load); a lógica de DOM espera o body */
    function boot() {
        window.addEventListener("hashchange", sync);
        new MutationObserver(muts => { if (relevant(muts)) sync(); }).observe(document.body, { childList: true, subtree: true });
        loadProxies();
        sync();
    }
    if (document.body) boot();
    else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
