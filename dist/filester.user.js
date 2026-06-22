// ==UserScript==
// @name         Filester — Theater Stage, Album Strip & Gallery
// @namespace    filester-theater
// @version      2.0.0
// @updateURL    https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/filester.user.js
// @downloadURL  https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/filester.user.js
// @description  Reestrutura a página de ARQUIVO do filester (filester.me/.sh/.gg & afins) num STAGE igual ao bunkr/pixeldrain — em vez de só temar o fluxo nativo (player travado em 40vh, download lá no fim, header gigante). (1) STAGE fixed cobrindo a página: TOPBAR de info no topo (Galeria/nome/tamanho/tipo + Download/Copiar/Tela cheia/Report), a MÍDIA preenchendo o meio (o #videoContainer/.image-container NATIVO é MOVIDO pra cá → a engine loadVideo()/Plyr do filester continua viva, não quebra), e um FOOTER com a STRIP rolável dos outros arquivos ("More from <user>", clonados do .related-files-grid) com ◀▶. (2) VÍDEO: tira o cap de 40vh → o maior que cabe na viewport, centralizado. (3) FOTO: zoom em níveis (1x→2x→4x no clique) + drag pan. (4) ÁLBUM/galeria (/f/): grade larga AMOLED com mais colunas + cards bonitos. (5) TEMA AMOLED #0b0c0f. EARLY PAINT: placeholder preto via CSS no document-start cobre a interface nativa até o stage montar (sem flash); fallback some se não achar mídia. @include por regex (o TLD muda).
// @author       claudiogepeto
// @match        *://filester.me/*
// @match        *://*.filester.me/*
// @match        *://filester.sh/*
// @match        *://*.filester.sh/*
// @match        *://filester.gg/*
// @match        *://*.filester.gg/*
// @noframes
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==
(function () {
    "use strict";
    if (window.top !== window.self) return;   // ignora iframes/embeds

    // tipo de página pela URL (document-start → sem flash): /d/ = ARQUIVO (vídeo/foto → STAGE); /f/ = GALERIA do usuário (grade)
    const PATH = location.pathname;
    const isFile = /\/d\//.test(PATH);
    const isAlbum = /\/f\//.test(PATH);
    document.documentElement.classList.add("fl");
    if (isFile) document.documentElement.classList.add("fl-file");
    if (isAlbum) document.documentElement.classList.add("fl-album");

    const ACCENT = "#4f8cff";

    const CSS = `
        /* ===================== TEMA AMOLED ===================== */
        html.fl, html.fl body, html.fl #filehub, html.fl .min-h-screen { background: #0b0c0f !important; color: #e9e9ee !important; }
        html.fl ::selection { background: rgba(79,140,255,0.35); }
        html.fl a { color: #8ab4ff; }
        html.fl ::-webkit-scrollbar { width: 10px; height: 10px; }
        html.fl ::-webkit-scrollbar-thumb { background: #2a2c33; border-radius: 8px; border: 2px solid #0b0c0f; }

        /* ===================== EARLY PAINT (arquivo): tampa preta cobre a interface nativa até o stage montar ===================== */
        html.fl-file::before { content: ""; position: fixed; inset: 0; background: #0b0c0f; z-index: 98000; pointer-events: none; }
        html.fl-file.fl-fallback::before { display: none; }
        html.fl-has-stage, html.fl-has-stage body { overflow: hidden !important; }

        /* ===================== STAGE (porta do bunkr.js, accent azul) ===================== */
        .fl-stage { position: fixed; inset: 0; z-index: 99000; display: flex; flex-direction: column; background: #0b0c0f; color: #fff; font-family: Inter, system-ui, sans-serif; }
        .fl-stage * { box-sizing: border-box; }
        .fl-stage-mid { position: relative; flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 12px 14px; overflow: hidden; }

        /* a mídia NATIVA movida pra cá preenche o meio (tira o cap de 40vh do filester) */
        .fl-stage-mid > .media-container, .fl-stage-mid > #videoContainer, .fl-stage-mid > .image-container {
            position: relative !important; width: auto !important; max-width: 100% !important; height: auto !important;
            max-height: 100% !important; min-height: 0 !important; margin: 0 !important;
            border-radius: 14px !important; overflow: hidden !important; background: #000 !important;
            display: flex !important; align-items: center !important; justify-content: center !important;
        }
        .fl-stage.is-video .fl-stage-mid > .media-container, .fl-stage.is-video .fl-stage-mid > #videoContainer { width: 100% !important; height: 100% !important; }
        .fl-stage-mid video, .fl-stage-mid #videoPlayer, .fl-stage-mid .plyr, .fl-stage-mid .plyr__video-wrapper {
            width: 100% !important; height: 100% !important; max-height: 100% !important; min-height: 0 !important; object-fit: contain !important; background: transparent !important;
        }
        .fl-stage-mid #videoPlayOverlay { position: absolute !important; inset: 0 !important; }
        .fl-stage .plyr { --plyr-color-main: ${ACCENT}; }

        /* foto: zoom/pan próprio (1x→2x→4x) — host clipa, só a <img> é transformada */
        .fl-img-host { position: relative; display: block; width: -moz-fit-content; width: fit-content; max-width: 100%; max-height: 100%; margin: 0 auto; overflow: hidden; border-radius: 14px; }
        .fl-image { display: block; max-width: 100%; max-height: calc(100dvh - 150px); width: auto; height: auto; background: #000; cursor: zoom-in; user-select: none; -webkit-user-drag: none; transform-origin: center center; will-change: transform; touch-action: none; }
        .fl-img-host.is-zoomed .fl-image { cursor: grab; }
        .fl-img-host.is-zoomed .fl-image:active { cursor: grabbing; }

        /* ---- vrow (topbar de info/ações) ---- */
        .fl-vrow { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; padding: 9px 14px; background: #0e0f13; border-bottom: 1px solid rgba(255,255,255,.08); overflow-x: auto; overflow-y: hidden; white-space: nowrap; scrollbar-width: thin; }
        .fl-vrow::-webkit-scrollbar { height: 6px; } .fl-vrow::-webkit-scrollbar-thumb { background: ${ACCENT}55; border-radius: 4px; }
        .fl-name { flex: 0 1 auto; min-width: 60px; max-width: 36vw; display: inline-flex; align-items: center; gap: 8px; padding: 0 4px; font-weight: 600; }
        .fl-name svg { color: ${ACCENT}; flex: 0 0 auto; }
        .fl-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fl-stats { display: flex; align-items: center; gap: 14px; padding: 0 8px; flex: 0 0 auto; }
        .fl-stat { font-size: 12px; color: rgba(255,255,255,.62); font-weight: 600; }
        .fl-spacer { flex: 1 1 auto; min-width: 8px; }
        .fl-item { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border: 1px solid rgba(255,255,255,.1); border-radius: 9px; background: rgba(255,255,255,.05); color: #fff; font: 13px/1 Inter, system-ui, sans-serif; cursor: pointer; text-decoration: none; transition: background .12s, border-color .12s; }
        .fl-item:hover { background: rgba(255,255,255,.1); border-color: ${ACCENT}66; }
        .fl-item svg { width: 18px; height: 18px; color: ${ACCENT}; }
        .fl-item.is-primary { background: ${ACCENT}; border-color: ${ACCENT}; color: #07101f; font-weight: 700; }
        .fl-item.is-primary svg { color: #07101f; } .fl-item.is-primary:hover { filter: brightness(1.07); }
        .fl-vsep { flex: 0 0 auto; width: 1px; height: 22px; margin: 0 3px; background: rgba(255,255,255,.1); }

        /* ---- strip (footer dos outros arquivos) ---- */
        .fl-stripwrap { flex: 0 0 auto; display: flex; flex-direction: column; background: #0e0f13; border-top: 1px solid rgba(255,255,255,.08); }
        .fl-stripbar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; }
        .fl-striplabel { font-size: 12px; font-weight: 600; color: rgba(255,255,255,.55); white-space: nowrap; }
        .fl-sbtn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 28px; padding: 0; flex: 0 0 auto; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: rgba(255,255,255,.05); color: #fff; cursor: pointer; transition: background .12s, border-color .12s; }
        .fl-sbtn:hover { background: rgba(255,255,255,.1); border-color: ${ACCENT}66; } .fl-sbtn svg { width: 18px; height: 18px; color: ${ACCENT}; }
        .fl-stripwrap.is-collapsed .fl-strip { display: none; }
        .fl-stripwrap.is-collapsed .fl-collapse svg { transform: rotate(180deg); }
        .fl-strip { display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; padding: 4px 12px 12px; scrollbar-width: none; }
        .fl-strip::-webkit-scrollbar { display: none; height: 0; }
        .fl-strip-item { flex: 0 0 auto; width: 158px; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; overflow: hidden; background: rgba(255,255,255,.03); color: #fff; text-decoration: none; transition: border-color .12s, transform .12s; }
        .fl-strip-item:hover { border-color: ${ACCENT}88; transform: translateY(-2px); }
        .fl-strip-item.is-current { border-color: ${ACCENT} !important; box-shadow: 0 0 0 2px ${ACCENT}, 0 0 14px -2px ${ACCENT}; }
        .fl-strip-item.is-current .fl-strip-name { color: #fff; font-weight: 700; }
        .fl-strip-thumb { width: 100%; height: 92px; object-fit: cover; background: #000; display: block; }
        .fl-strip-meta { display: flex; align-items: center; gap: 5px; padding: 7px 8px; }
        .fl-strip-meta svg { width: 13px; height: 13px; flex: 0 0 auto; color: ${ACCENT}; }
        .fl-strip-name { font-size: 11px; line-height: 1.25; color: rgba(255,255,255,.82); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
        @media (max-width: 600px) { .fl-strip-item { width: 120px; } .fl-strip-thumb { height: 70px; } .fl-name { max-width: 50vw; } }

        /* ---- setas prev/próximo sobre a mídia (quando há >1 na strip) ---- */
        .fl-nav-side { position: absolute; top: 50%; transform: translateY(-50%); z-index: 6; width: 46px; height: 46px; border: 0; border-radius: 50%; background: rgba(0,0,0,.5); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity .18s ease, background .12s ease; }
        .fl-nav-prev { left: 16px; } .fl-nav-next { right: 16px; }
        .fl-stage.has-nav .fl-stage-mid:hover .fl-nav-side { opacity: 1; pointer-events: auto; }
        @media (hover: none) { .fl-stage.has-nav .fl-nav-side { opacity: .85; pointer-events: auto; } }
        .fl-nav-side:hover { background: rgba(0,0,0,.74); } .fl-nav-side:active { transform: translateY(-50%) scale(.92); }
        .fl-nav-side svg { width: 26px; height: 26px; display: block; }

        /* toast */
        .fl-toast { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%) translateY(12px); z-index: 100001; padding: 10px 18px; border-radius: 20px; background: #14161a; border: 1px solid ${ACCENT}66; color: #fff; font: 13px Inter, system-ui, sans-serif; box-shadow: 0 6px 22px rgba(0,0,0,.6); opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s; }
        .fl-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

        /* ===================== GALERIA (/f/): grade larga + cards bonitos ===================== */
        html.fl .container, html.fl .files-section { max-width: min(100% - 28px, 1800px) !important; width: 100% !important; }
        html.fl .files-list.grid-view { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)) !important; gap: 14px !important; }
        @media (max-width: 700px) { html.fl .files-list.grid-view { grid-template-columns: repeat(auto-fill, minmax(46vw, 1fr)) !important; gap: 10px !important; } }
        html.fl .file-item { display: flex !important; flex-direction: column !important; border-radius: 14px !important; overflow: hidden !important; background: #111317 !important; border: 1px solid rgba(255,255,255,0.07) !important; cursor: pointer; transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease; }
        html.fl .file-item:hover { transform: translateY(-3px); border-color: ${ACCENT}88 !important; box-shadow: 0 10px 26px rgba(0,0,0,0.5) !important; }
        html.fl .file-preview { position: relative; width: 100% !important; aspect-ratio: 1 / 1; background: #0a0a0c !important; overflow: hidden !important; }
        html.fl .file-preview img { width: 100% !important; height: 100% !important; object-fit: cover !important; display: block; }
        html.fl .file-info { padding: 9px 11px !important; }
        html.fl .file-name { font-size: 12.5px !important; font-weight: 600 !important; color: #e9e9ee !important; line-height: 1.35 !important; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        html.fl .file-meta { font-size: 11px !important; color: rgba(255,255,255,0.5) !important; margin-top: 3px !important; }
        /* header da galeria compacto */
        html.fl-album header.text-center { max-width: min(100% - 28px, 1800px) !important; margin: 0 auto !important; padding: 12px 0 8px !important; }
        html.fl-album header svg { width: 40px !important; height: 40px !important; }
        /* folder header (título + meta) */
        html.fl .folder-header { border-bottom: 1px solid rgba(255,255,255,.08) !important; padding-bottom: 16px !important; margin-bottom: 18px !important; }
        html.fl .folder-title { font-size: 26px !important; font-weight: 800 !important; color: #fff !important; }
        html.fl .folder-meta { color: rgba(255,255,255,.55) !important; font-size: 13px !important; display: flex !important; gap: 8px !important; flex-wrap: wrap !important; }
        html.fl .folder-meta .separator { color: rgba(255,255,255,.25) !important; }
        /* filtros (All/Images/Videos/Other) + view + sort = barra de pills */
        html.fl .filters-bar { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; flex-wrap: wrap !important; margin-bottom: 18px !important; }
        html.fl .filter-group { display: flex !important; gap: 6px !important; flex-wrap: wrap !important; }
        html.fl .filter-btn { padding: 8px 16px !important; border-radius: 999px !important; border: 1px solid rgba(255,255,255,.12) !important; background: rgba(255,255,255,.04) !important; color: rgba(255,255,255,.7) !important; font-size: 13px !important; font-weight: 600 !important; cursor: pointer !important; transition: background .12s, color .12s, border-color .12s !important; }
        html.fl .filter-btn:hover { background: rgba(255,255,255,.09) !important; color: #fff !important; }
        html.fl .filter-btn.active { background: ${ACCENT} !important; border-color: ${ACCENT} !important; color: #07101f !important; }
        html.fl .view-btn { border-radius: 10px !important; border: 1px solid rgba(255,255,255,.12) !important; background: rgba(255,255,255,.04) !important; color: rgba(255,255,255,.7) !important; }
        html.fl .view-btn.active { background: ${ACCENT}22 !important; border-color: ${ACCENT} !important; color: #fff !important; }
        html.fl .sort-select { padding: 8px 12px !important; border-radius: 10px !important; border: 1px solid rgba(255,255,255,.12) !important; background: #14161a !important; color: #fff !important; font-size: 13px !important; cursor: pointer !important; }
        /* section header + paginação */
        html.fl .section-header { display: flex !important; align-items: center !important; justify-content: space-between !important; margin-bottom: 14px !important; }
        html.fl .file-count { font-size: 14px !important; font-weight: 700 !important; color: rgba(255,255,255,.8) !important; }
        html.fl .pagination { display: flex !important; align-items: center !important; gap: 8px !important; }
        html.fl .page-info { font-size: 13px !important; color: rgba(255,255,255,.55) !important; }
        html.fl .pagination .page-link { display: inline-flex !important; align-items: center !important; justify-content: center !important; min-width: 34px !important; height: 34px !important; padding: 0 10px !important; border-radius: 9px !important; border: 1px solid rgba(255,255,255,.12) !important; background: rgba(255,255,255,.04) !important; color: #cbd9ff !important; text-decoration: none !important; font-weight: 700 !important; transition: background .12s, border-color .12s !important; }
        html.fl .pagination .page-link:hover { background: ${ACCENT} !important; border-color: ${ACCENT} !important; color: #07101f !important; }
        /* badge de play nas thumbs de vídeo (m4v vem como data-type="other") */
        html.fl .file-item .download-btn { position: absolute !important; top: 8px !important; right: 8px !important; width: 30px !important; height: 30px !important; border-radius: 9px !important; border: 0 !important; background: rgba(0,0,0,.6) !important; color: #fff !important; cursor: pointer !important; opacity: 0; transition: opacity .12s, background .12s; z-index: 2; }
        html.fl .file-item { position: relative !important; }
        html.fl .file-item:hover .download-btn { opacity: 1; }
        html.fl .file-item .download-btn:hover { background: ${ACCENT} !important; color: #07101f !important; }
        @media (hover: none) { html.fl .file-item .download-btn { opacity: 1; } }
    `;

    function addCSS(css) {
        if (typeof GM_addStyle === "function") { GM_addStyle(css); return; }
        const s = document.createElement("style"); s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    }
    addCSS(CSS);

    // re-asserta as classes-raiz se o Tailwind do filester limpar o class do <html>
    const keepRoot = () => { const c = document.documentElement.classList; if (!c.contains("fl")) c.add("fl"); if (isFile && !c.contains("fl-file")) c.add("fl-file"); if (isAlbum && !c.contains("fl-album")) c.add("fl-album"); };
    try { new MutationObserver(keepRoot).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}

    /* ===================== helpers (porta enxuta do bunkr.js) ===================== */
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
    const svgi = inner => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block">${inner}</svg>`;
    const IC = {
        download: svgi('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
        copy: svgi('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
        expand: svgi('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
        flag: svgi('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'),
        grid: svgi('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
        image: svgi('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
        video: svgi('<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4V8z"/>'),
        chevL: svgi('<path d="m15 18-6-6 6-6"/>'),
        chevR: svgi('<path d="m9 18 6-6-6-6"/>'),
        chevDown: svgi('<path d="m6 9 6 6 6-6"/>'),
    };

    let toastT;
    function toast(msg) {
        let t = document.querySelector(".fl-toast");
        if (!t) { t = el("div", { class: "fl-toast" }); (document.body || document.documentElement).appendChild(t); }
        t.textContent = msg; t.classList.add("show");
        clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800);
    }
    function fallbackCopy(s) { try { const t = el("textarea", { style: { position: "fixed", opacity: "0", left: "-9999px" } }); t.value = s; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; } catch { return false; } }
    function copyText(s) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s).then(() => true, () => fallbackCopy(s));
        return Promise.resolve(fallbackCopy(s));
    }

    /* ===================== STAGE (página de arquivo /d/) ===================== */
    let mediaMounted = false;

    // strip dos "outros arquivos" — clonados do .related-files-grid (cada item é <a href="/d/{slug}"> com thumb + nome)
    function relatedItems() {
        const grid = document.querySelector(".related-files-grid");
        return grid ? Array.from(grid.querySelectorAll(":scope > .related-file-item, :scope > a.related-file-item")) : [];
    }
    const isVidName = n => /\.(mp4|m4v|mov|webm|mkv|avi|ts|flv)$/i.test(n || "");
    function stripCard(name, href, thumb, isV, current) {
        const card = el("a", { class: "fl-strip-item" + (current ? " is-current" : ""), href, title: name });
        card.append(el("img", { class: "fl-strip-thumb", src: thumb || "", alt: "", loading: "lazy" }));
        const meta = el("div", { class: "fl-strip-meta" }); meta.insertAdjacentHTML("beforeend", isV ? IC.video : IC.image); meta.append(el("span", { class: "fl-strip-name" }, name));
        card.append(meta); return card;
    }
    function renderStrip(strip) {
        const items = relatedItems();
        const stage = strip.closest(".fl-stage");
        const cur = stage && stage._cur;
        const wrap = strip.closest(".fl-stripwrap");
        const sig = items.length + "|" + (cur ? "1" : "0");
        if (strip.dataset.sig === sig) return; strip.dataset.sig = sig;
        strip.textContent = "";
        const hrefs = [];
        // 1º card = o arquivo ATUAL, marcado como selecionado (não vem na lista "More from user")
        let curCard = null;
        if (cur) { curCard = stripCard(cur.name, cur.href, cur.thumb, cur.isVid, true); strip.appendChild(curCard); if (cur.href) hrefs.push(cur.href); }
        items.forEach(it => {
            const href = it.getAttribute("href") || "#";
            const img = it.querySelector("img");
            const nameEl = it.querySelector(".related-file-name");
            const name = (nameEl ? nameEl.textContent : (img ? img.getAttribute("alt") : "") || "").trim();
            strip.appendChild(stripCard(name, href, (img && (img.getAttribute("src") || img.src)) || "", isVidName(name), false));
            if (href && href !== "#") hrefs.push(href);
        });
        if (wrap) wrap.style.display = strip.children.length ? "" : "none";
        if (stage) stage.classList.toggle("has-nav", hrefs.length > 1);
        strip._hrefs = hrefs;
        // centraliza o card atual na strip (igual bunkr)
        if (curCard) setTimeout(() => { try { const br = curCard.getBoundingClientRect(), sr = strip.getBoundingClientRect(); strip.scrollBy({ left: (br.left + br.width / 2) - (sr.left + sr.width / 2), behavior: "smooth" }); } catch (e) {} }, 80);
    }
    function navFile(strip, dir) {
        const hrefs = strip && strip._hrefs; if (!hrefs || hrefs.length < 2) return;
        const curPath = location.pathname;
        let i = hrefs.findIndex(h => { try { return new URL(h, location.origin).pathname === curPath; } catch (e) { return h === curPath; } });
        if (i < 0) i = 0;   // hrefs[0] = atual → wrap circular pela sequência
        const next = hrefs[(i + dir + hrefs.length) % hrefs.length];
        if (next) location.href = next;
    }

    function findMedia() {
        const v = document.querySelector("#videoContainer, .media-container, .video-container");
        if (v && v.querySelector("video, #videoPlayer, #videoPlayOverlay")) return { box: v, kind: "video" };
        const i = document.querySelector(".image-container");
        if (i) return { box: i, kind: "image" };
        if (v) return { box: v, kind: "video" };
        return null;
    }

    function buildStage() {
        if (document.querySelector(".fl-stage")) return document.querySelector(".fl-stage");
        // título do ARQUIVO (NÃO o <h1> do logo "filester.me BETA v0.7" que mora no <header>)
        const h1 = document.querySelector("main h1") || Array.from(document.querySelectorAll("h1")).find(h => !h.closest("header"));
        const media = findMedia();
        if (!h1 || !media) return null;   // main/mídia ainda não prontos

        const name = (h1.textContent || "").trim();
        const sizeEl = document.querySelector("main .text-neutral-400") || (h1.parentElement && h1.parentElement.querySelector(".text-neutral-400"));
        const size = sizeEl ? (sizeEl.textContent || "").replace(/\s+/g, " ").trim() : "";
        const galleryA = document.querySelector('a[href*="/f/"]');
        const reportA = document.querySelector('a[href*="/report"], a[href*="report?file"]');
        const dlBtn = document.getElementById("downloadButton") || document.querySelector('a[id*="download" i], .download-btn');
        const isVid = media.kind === "video";

        const stage = el("div", { class: "fl-stage " + (isVid ? "is-video" : "is-image") });

        // ---- vrow ----
        const vrow = el("div", { class: "fl-vrow" });
        if (galleryA) { const b = el("a", { class: "fl-item", href: galleryA.href, title: "Ver a galeria do uploader" }); b.insertAdjacentHTML("beforeend", IC.grid); b.append(el("span", null, "Galeria")); vrow.append(b, el("div", { class: "fl-vsep" })); }
        const nameEl = el("div", { class: "fl-name", title: name }); nameEl.insertAdjacentHTML("beforeend", isVid ? IC.video : IC.image); nameEl.append(el("span", null, name)); vrow.append(nameEl);
        const stats = el("div", { class: "fl-stats" });
        if (size) stats.append(el("span", { class: "fl-stat" }, size));
        stats.append(el("span", { class: "fl-stat" }, isVid ? "Vídeo" : "Imagem"));
        vrow.append(stats, el("div", { class: "fl-spacer" }));
        // Download → dispara o botão NATIVO (a engine do filester busca o CDN e baixa) — não dá pra ler o href cedo (vem "#")
        const dl = el("button", { class: "fl-item is-primary", title: "Baixar", onClick: () => { if (dlBtn) dlBtn.click(); else toast("Botão de download não encontrado"); } });
        dl.insertAdjacentHTML("beforeend", IC.download); dl.append(el("span", null, "Download")); vrow.append(dl);
        const copyBtn = el("button", { class: "fl-item", title: "Copiar link", onClick: () => copyText(location.href).then(ok => toast(ok ? "Link copiado" : "Falha ao copiar")) }); copyBtn.insertAdjacentHTML("beforeend", IC.copy); copyBtn.append(el("span", null, "Copiar")); vrow.append(copyBtn);
        const fsBtn = el("button", { class: "fl-item", title: "Tela cheia", onClick: () => { try { document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen(); } catch (e) {} } }); fsBtn.insertAdjacentHTML("beforeend", IC.expand); vrow.append(fsBtn);
        if (reportA) { vrow.append(el("div", { class: "fl-vsep" })); const b = el("a", { class: "fl-item", href: reportA.href, title: "Reportar" }); b.insertAdjacentHTML("beforeend", IC.flag); vrow.append(b); }

        // ---- mid (mídia movida pra cá) ----
        const mid = el("div", { class: "fl-stage-mid" });
        const navPrev = el("button", { class: "fl-nav-side fl-nav-prev", title: "Anterior", onClick: e => { e.stopPropagation(); navFile(stage._strip, -1); } }); navPrev.insertAdjacentHTML("beforeend", IC.chevL);
        const navNext = el("button", { class: "fl-nav-side fl-nav-next", title: "Próximo", onClick: e => { e.stopPropagation(); navFile(stage._strip, 1); } }); navNext.insertAdjacentHTML("beforeend", IC.chevR);
        mid.append(navPrev, navNext);

        // ---- strip ----
        const stripwrap = el("div", { class: "fl-stripwrap" });
        const strip = el("div", { class: "fl-strip" });
        if (localStorage.getItem("fl_strip_collapsed") === "1") stripwrap.classList.add("is-collapsed");
        const collapseBtn = el("button", { class: "fl-sbtn fl-collapse", title: "Recolher / expandir", onClick: () => { stripwrap.classList.toggle("is-collapsed"); try { localStorage.setItem("fl_strip_collapsed", stripwrap.classList.contains("is-collapsed") ? "1" : "0"); } catch (e) {} } }); collapseBtn.insertAdjacentHTML("beforeend", IC.chevDown);
        const prevBtn = el("button", { class: "fl-sbtn", title: "Rolar p/ trás", onClick: () => strip.scrollBy({ left: -strip.clientWidth * 0.8, behavior: "smooth" }) }); prevBtn.insertAdjacentHTML("beforeend", IC.chevL);
        const nextBtn = el("button", { class: "fl-sbtn", title: "Rolar p/ frente", onClick: () => strip.scrollBy({ left: strip.clientWidth * 0.8, behavior: "smooth" }) }); nextBtn.insertAdjacentHTML("beforeend", IC.chevR);
        stripwrap.append(el("div", { class: "fl-stripbar" }, collapseBtn, el("span", { class: "fl-striplabel" }, "Arquivos do álbum"), el("div", { class: "fl-spacer" }), prevBtn, nextBtn), strip);
        stage._strip = strip;

        // dados do arquivo ATUAL (pro card "selecionado" na strip). thumb = /t/{uuid}; uuid vem do link de report (?file=) ou do bloco de detalhes
        let uuid = "";
        if (reportA) { const m = reportA.href.match(/file=([a-f0-9-]{8,})/i); if (m) uuid = m[1]; }
        if (!uuid) { const u = Array.from(document.querySelectorAll("main .font-mono")).map(e => (e.textContent || "").trim()).find(t => /^[a-f0-9-]{32,}$/i.test(t)); if (u) uuid = u; }
        stage._cur = { name, href: location.pathname + location.search, thumb: uuid ? (location.origin + "/t/" + uuid) : "", isVid };

        stage.append(vrow, mid, stripwrap);
        document.body.insertBefore(stage, document.body.firstChild);
        document.documentElement.classList.add("fl-has-stage");

        // MOVE a mídia nativa pro meio do stage (a engine loadVideo()/Plyr do filester segue viva → não quebra)
        if (isVid) {
            mid.appendChild(media.box);
            setupVideoLoad(media.box);   // carrega o vídeo via API (o loadVideo nativo é quebrado p/ octet-stream)
        } else {
            mountPhotoZoom(mid, media.box);
        }
        mediaMounted = true;

        renderStrip(strip);
        const grid = document.querySelector(".related-files-grid");
        if (grid) { try { new MutationObserver(() => renderStrip(strip)).observe(grid, { childList: true }); } catch (e) {} }
        return stage;
    }

    // foto: zoom em níveis + drag pan (porta do bunkr mountPhotoZoom)
    function mountPhotoZoom(mid, container) {
        const img = container.querySelector("img") || document.querySelector(".image-preview, .image-container img");
        if (!img) { mid.appendChild(container); return; }
        const host = el("div", { class: "fl-img-host" });
        mid.appendChild(host);
        img.classList.add("fl-image");
        host.appendChild(img);
        const ZOOMS = [1, 2, 4]; let zi = 0, z = 1, tx = 0, ty = 0;
        const clampPan = () => { const mx = Math.max(0, (img.clientWidth * z - host.clientWidth) / 2), my = Math.max(0, (img.clientHeight * z - host.clientHeight) / 2); tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty)); };
        const applyTf = () => { img.style.transform = z === 1 ? "" : `translate(${tx}px,${ty}px) scale(${z})`; host.classList.toggle("is-zoomed", z !== 1); };
        const setZoomIdx = i => { zi = ((i % ZOOMS.length) + ZOOMS.length) % ZOOMS.length; z = ZOOMS[zi]; if (z === 1) { tx = ty = 0; } else clampPan(); applyTf(); };
        let drag = null;
        img.addEventListener("pointerdown", e => { if (e.button) return; e.preventDefault(); drag = { x: e.clientX, y: e.clientY, tx, ty, moved: false }; try { img.setPointerCapture(e.pointerId); } catch (er) {} });
        img.addEventListener("pointermove", e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true; if (z !== 1 && drag.moved) { tx = drag.tx + dx; ty = drag.ty + dy; clampPan(); applyTf(); } });
        const end = e => { if (!drag) return; const click = !drag.moved; drag = null; try { img.releasePointerCapture(e.pointerId); } catch (er) {} if (click) setZoomIdx(zi + 1); };
        img.addEventListener("pointerup", end); img.addEventListener("pointercancel", end);
    }

    // O loadVideo() NATIVO só é definido pelo file_dl.js se isVideo(window.fileType) for true — pra .m4v com
    // type "application/octet-stream" ele NUNCA é definido → o overlay chama undefined() e "clico e nada acontece".
    // Solução: carregamos o vídeo nós mesmos, replicando a API nativa (mesma origem): POST /api/public/view
    // {file_slug} → view_url; src = https://cn1.filester.me{view_url} (a engine do filester usa exatamente isso).
    const FL_CDN = "https://cn1.filester.me";
    function fileSlug() { return location.pathname.split("/").filter(Boolean).pop() || ""; }
    async function loadFilesterVideo(box) {
        const v = box.querySelector("#videoPlayer") || box.querySelector("video");
        if (!v) return false;
        if (v.dataset.flLoaded === "1") return true;
        const r = await fetch(location.origin + "/api/public/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_slug: fileSlug() }) });
        if (!r.ok) throw new Error("view HTTP " + r.status);
        const data = await r.json();
        if (!data || !data.view_url) throw new Error("sem view_url");
        v.querySelectorAll("source").forEach(s => s.remove());
        v.preload = "metadata"; v.setAttribute("controls", "");   // só metadata no auto-load; stream completo só no play
        v.src = FL_CDN + data.view_url;
        try { v.load(); } catch (e) {}
        v.dataset.flLoaded = "1";
        const ov = box.querySelector("#videoPlayOverlay"); if (ov) ov.style.display = "none";
        return true;
    }
    // rewire do overlay (mata o onclick nativo quebrado) + auto-load (UX de player)
    function setupVideoLoad(box) {
        const ov = box.querySelector("#videoPlayOverlay");
        if (ov) { ov.removeAttribute("onclick"); ov.onclick = null; ov.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); loadFilesterVideo(box).catch(err => { console.warn("[filester] view falhou", err); toast("Falha ao carregar o vídeo"); if (ov) ov.style.display = ""; }); }); }
        loadFilesterVideo(box).catch(() => { if (ov) ov.style.display = ""; });   // se o auto-load falhar, mantém o overlay clicável
    }

    /* ===================== boot ===================== */
    function onReady(fn) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
        else fn();
    }
    onReady(() => {
        if (!isFile) return;   // galeria/home: só o tema/CSS (sem stage)
        let n = 0, id = null;
        const stop = () => { if (id) clearInterval(id); };
        const tick = () => {
            const stage = buildStage();
            if (stage && mediaMounted) { stop(); return; }
            if (++n > 16) {   // ~6.4s sem mídia (pdf/zip/áudio?) → tira o placeholder e mostra a página nativa
                stop();
                if (!mediaMounted) { document.documentElement.classList.add("fl-fallback"); const st = document.querySelector(".fl-stage"); if (st) st.remove(); document.documentElement.classList.remove("fl-has-stage"); }
            }
        };
        tick();
        id = setInterval(tick, 400);
    });
})();
