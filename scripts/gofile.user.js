// ==UserScript==
// @name         GoFile — Card Grid, Search & Theater Stage
// @namespace    gofile-grid
// @version      3.0.0
// @description  Reestrutura a pasta do GoFile (gofile.io/d/) NO MESMO formato dos outros scripts. PASTA: remove a sidebar, coloca uma TOPBAR (logo + busca que filtra os arquivos), conteúdo em LARGURA TOTAL, e os arquivos (que eram lista) viram uma GRADE de cards (thumb 16:9 + nome + meta + Download). STAGE (ao clicar num arquivo): overlay fixo igual ao bunkr — (1) TOPBAR com infos do arquivo (pasta/nome/tamanho + Download/Tela cheia), (2) a MÍDIA grande no meio (reusa o item_play NATIVO do gofile, que resolve o item.link, e MOVE o player pro stage → sem precisar de API/token), (3) STRIP da galeria no rodapé com os outros arquivos + o atual marcado + ◀▶. TEMA AMOLED + accent azul. SPA: MutationObserver no #filemanager_itemslist trata itens conforme nascem/paginam. Engine intacta. @include por regex.
// @author       claudiogepeto
// @run-at       document-start
// @match        *://gofile.io/*
// @match        *://*.gofile.io/*
// @match        *://gofile.to/*
// @match        *://*.gofile.to/*
// @noframes
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    "use strict";
    if (window.top !== window.self) return;

    document.documentElement.classList.add("gf");
    const ACCENT = "#3b82f6";

    const CSS = `
        /* ===================== TEMA AMOLED ===================== */
        html.gf, html.gf body { background: #0b0c0f !important; color: #e9e9ee !important; }
        html.gf .bg-gray-900 { background: #0b0c0f !important; }
        html.gf .bg-gray-800 { background: #101218 !important; }
        html.gf .bg-gray-700 { background: #1a1d24 !important; }
        html.gf .bg-gray-600 { background: #222630 !important; }
        html.gf .border-gray-700, html.gf .border-gray-600, html.gf .border-gray-500 { border-color: rgba(255,255,255,0.08) !important; }
        html.gf ::selection { background: rgba(59,130,246,0.35); }
        html.gf ::-webkit-scrollbar { width: 10px; height: 10px; }
        html.gf ::-webkit-scrollbar-thumb { background: #2a2c33; border-radius: 8px; border: 2px solid #0b0c0f; }

        /* ===================== SEM SIDEBAR + TOPBAR + LARGURA TOTAL ===================== */
        html.gf #index_sidebar, html.gf #index_sidebarOverlay { display: none !important; }
        html.gf #index_app { display: block !important; padding: 0 !important; gap: 0 !important; max-width: none !important; }
        html.gf #index_content { border-radius: 0 !important; background: #0b0c0f !important; overflow: visible !important; max-width: none !important; width: 100% !important; display: flex !important; flex-direction: column !important; min-height: 100vh !important; }
        html.gf #index_main { flex: 1 1 auto !important; }
        html.gf #index_content > footer, html.gf #index_content footer { margin-top: auto !important; }
        html.gf #index_header { position: sticky; top: 0; z-index: 50; display: flex !important; align-items: center; gap: 16px; background: #0e0f13 !important; border: 0 !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; border-radius: 0 !important; padding: 9px 20px !important; }
        html.gf #index_toggleSidebar, html.gf #index_ads { display: none !important; }
        html.gf .gf-brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 18px; color: #fff; text-decoration: none; flex: 0 0 auto; }
        html.gf .gf-brand img { height: 26px; }
        html.gf .gf-brand h2 { font-size: 18px !important; margin: 0 !important; }
        html.gf .gf-topsearch { flex: 1 1 560px; max-width: 560px; margin: 0 auto; }
        html.gf .gf-topsearch input { width: 100%; height: 38px; box-sizing: border-box; padding: 0 16px 0 40px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.06) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a3a3ad' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m21 21-4.3-4.3'/%3E%3C/svg%3E") no-repeat 14px center; background-size: 16px; color: #fff; font-size: 14px; outline: none; }
        html.gf .gf-topsearch input:focus { border-color: rgba(255,255,255,0.34); background-color: rgba(255,255,255,0.1); }
        html.gf #index_main { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 14px clamp(16px, 3vw, 40px) 48px !important; }
        html.gf #index_main > #filemanager { max-width: none !important; width: 100% !important; }
        html.gf #filemanager_maincontent { padding: 4px 0 10px !important; }
        html.gf .gf-hide { display: none !important; }

        /* ===================== GRADE DE CARDS (largura total) ===================== */
        html.gf #filemanager_itemslist { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)) !important; gap: 16px !important; padding: 14px 0 !important; background: transparent !important; border: 0 !important; align-items: start !important; }
        @media (max-width: 700px) { html.gf #filemanager_itemslist { grid-template-columns: repeat(auto-fill, minmax(45vw, 1fr)) !important; gap: 12px !important; } }
        html.gf #filemanager_itemslist > [id^="filemanager_itemslist_"] { grid-column: 1 / -1 !important; }

        html.gf .gf-card { position: relative !important; display: flex !important; flex-direction: column !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 14px !important; background: #15171d !important; overflow: hidden !important; transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease; }
        html.gf .gf-card.gf-filtered { display: none !important; }
        html.gf .gf-card:hover { transform: translateY(-3px); border-color: ${ACCENT}88 !important; box-shadow: 0 10px 26px rgba(0,0,0,0.5) !important; }
        html.gf .gf-card > .flex { flex-direction: column !important; align-items: stretch !important; justify-content: flex-start !important; padding: 0 !important; gap: 0 !important; }
        html.gf .gf-card .overflow-auto { overflow: visible !important; }
        html.gf .gf-media { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #0a0a0c; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; }
        html.gf .gf-media img { width: 100% !important; height: 100% !important; max-height: none !important; object-fit: cover !important; display: block; }
        html.gf .gf-media-ic i { font-size: 42px; color: ${ACCENT}; opacity: .75; }
        html.gf .gf-media-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .12s ease; }
        html.gf .gf-card:hover .gf-media-play { opacity: 1; }
        html.gf .gf-media-play span { width: 50px; height: 50px; border-radius: 50%; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; }
        html.gf .gf-card .min-w-4 { position: absolute !important; top: 8px; left: 8px; z-index: 3; margin: 0 !important; }
        html.gf .gf-card .min-w-8 { display: none !important; }
        html.gf .gf-card .truncate { white-space: normal !important; overflow: visible !important; padding: 10px 12px 4px !important; min-width: 0; }
        html.gf .gf-card a.item_open { font-size: 13px !important; font-weight: 600 !important; color: #e9e9ee !important; cursor: pointer; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.35; }
        html.gf .gf-card a.item_open:hover { color: ${ACCENT} !important; }
        html.gf .gf-card .truncate .text-gray-400 { color: rgba(255,255,255,0.5) !important; }
        /* esconde a barra de ações do card (Download/⋯/Play/Open) — download fica SÓ no overlay e no multiselect.
           os botões continuam no DOM (display:none) → o stage e o multiselect ainda os acionam via .click() */
        html.gf .gf-card > .flex > div:last-child { display: none !important; }
        html.gf .gf-card .item-mediaplayer { display: none !important; }   /* o player vai pro stage */

        /* ===================== BARRA DE MULTISELECT (flutuante) ===================== */
        .gf-bulk { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%) translateY(20px); z-index: 2147482000; display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 14px; background: #14161a; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 12px 34px rgba(0,0,0,0.6); opacity: 0; pointer-events: none; transition: opacity .18s ease, transform .18s ease; min-width: 300px; font-family: Inter, system-ui, sans-serif; }
        .gf-bulk.open { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
        .gf-bulk-count { font: 600 13px Inter, system-ui, sans-serif; color: #fff; white-space: nowrap; }

        /* ===================== STAGE (igual bunkr) ===================== */
        html.gf.gf-has-stage, html.gf.gf-has-stage body { overflow: hidden !important; }
        .gf-stage { position: fixed; inset: 0; z-index: 2147483000; display: none; flex-direction: column; background: #0b0c0f; color: #fff; font-family: Inter, system-ui, sans-serif; }
        .gf-stage.open { display: flex; }
        .gf-stage * { box-sizing: border-box; }
        .gf-stage-mid { position: relative; flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 12px 14px; overflow: hidden; }
        .gf-stage-mid .item-mediaplayer { display: flex !important; width: 100% !important; height: 100% !important; max-width: 100% !important; max-height: 100% !important; margin: 0 !important; align-items: center; justify-content: center; }
        .gf-stage-mid video, .gf-stage-mid img { width: 100% !important; height: 100% !important; max-width: 100% !important; max-height: 100% !important; min-height: 0 !important; object-fit: contain !important; border-radius: 12px !important; background: #000 !important; display: block; }
        .gf-stage-mid audio { width: 70vw !important; height: auto !important; min-height: 0 !important; }
        .gf-spin { width: 44px; height: 44px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.22); border-top-color: ${ACCENT}; animation: gf-spin .8s linear infinite; }
        @keyframes gf-spin { to { transform: rotate(360deg); } }

        .gf-vrow { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; padding: 9px 14px; background: #0e0f13; border-bottom: 1px solid rgba(255,255,255,.08); overflow-x: auto; white-space: nowrap; }
        .gf-vrow .gf-name { flex: 0 1 auto; min-width: 60px; max-width: 40vw; display: inline-flex; align-items: center; gap: 8px; padding: 0 4px; font-weight: 600; }
        .gf-vrow .gf-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .gf-stats { display: flex; align-items: center; gap: 14px; padding: 0 8px; flex: 0 0 auto; }
        .gf-stat { font-size: 12px; color: rgba(255,255,255,.62); font-weight: 600; }
        .gf-spacer { flex: 1 1 auto; min-width: 8px; }
        .gf-item { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border: 1px solid rgba(255,255,255,.1); border-radius: 9px; background: rgba(255,255,255,.05); color: #fff; font: 13px/1 Inter, system-ui, sans-serif; cursor: pointer; text-decoration: none; transition: background .12s, border-color .12s; }
        .gf-item:hover { background: rgba(255,255,255,.1); border-color: ${ACCENT}66; }
        .gf-item.is-primary { background: ${ACCENT}; border-color: ${ACCENT}; color: #06101f; font-weight: 700; }
        .gf-vsep { flex: 0 0 auto; width: 1px; height: 22px; margin: 0 3px; background: rgba(255,255,255,.1); }
        /* ícones SVG (estilo bunkr): accent nos contornos, escuro no botão primário */
        .gf-item svg { width: 18px; height: 18px; color: ${ACCENT}; }
        .gf-item.is-primary svg { color: #06101f; }
        .gf-vrow .gf-name svg { width: 18px; height: 18px; color: ${ACCENT}; flex: 0 0 auto; }
        .gf-nav-side svg { width: 26px; height: 26px; }
        .gf-sbtn svg { width: 18px; height: 18px; color: ${ACCENT}; }
        .gf-media-play span svg { width: 24px; height: 24px; color: #fff; }
        .gf-strip-thumb svg { width: 30px; height: 30px; }
        .gf-strip-meta { display: flex; align-items: center; gap: 5px; padding: 7px 8px; }
        .gf-strip-meta svg { width: 13px; height: 13px; color: ${ACCENT}; flex: 0 0 auto; }

        .gf-nav-side { position: absolute; top: 50%; transform: translateY(-50%); z-index: 6; width: 46px; height: 46px; border: 0; border-radius: 50%; background: rgba(0,0,0,.5); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity .18s, background .12s; font-size: 22px; }
        .gf-nav-prev { left: 16px; } .gf-nav-next { right: 16px; }
        .gf-stage.has-nav .gf-stage-mid:hover .gf-nav-side { opacity: 1; pointer-events: auto; }
        @media (hover: none) { .gf-stage.has-nav .gf-nav-side { opacity: .85; pointer-events: auto; } }
        .gf-nav-side:hover { background: rgba(0,0,0,.74); }

        .gf-stripwrap { flex: 0 0 auto; display: flex; flex-direction: column; background: #0e0f13; border-top: 1px solid rgba(255,255,255,.08); }
        .gf-stripbar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; }
        .gf-striplabel { font-size: 12px; font-weight: 600; color: rgba(255,255,255,.55); }
        .gf-sbtn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 28px; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: rgba(255,255,255,.05); color: #fff; cursor: pointer; font-size: 16px; }
        .gf-sbtn:hover { background: rgba(255,255,255,.1); border-color: ${ACCENT}66; }
        .gf-stripwrap.is-collapsed .gf-strip { display: none; }
        .gf-stripwrap.is-collapsed .gf-collapse { transform: rotate(180deg); }
        .gf-strip { display: flex; gap: 8px; overflow-x: auto; padding: 4px 12px 12px; scrollbar-width: none; }
        .gf-strip::-webkit-scrollbar { display: none; height: 0; }
        .gf-strip-item { flex: 0 0 auto; width: 168px; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; overflow: hidden; background: rgba(255,255,255,.03); color: #fff; cursor: pointer; transition: border-color .12s, transform .12s; }
        .gf-strip-item:hover { border-color: ${ACCENT}88; transform: translateY(-2px); }
        .gf-strip-item.is-current { border-color: ${ACCENT} !important; box-shadow: 0 0 0 2px ${ACCENT}, 0 0 14px -2px ${ACCENT}; }
        .gf-strip-thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; background: #000; display: flex; align-items: center; justify-content: center; color: ${ACCENT}; }
        .gf-strip-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .gf-strip-name { font-size: 11px; line-height: 1.25; color: rgba(255,255,255,.82); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
        .gf-strip-item.is-current .gf-strip-name { color: #fff; font-weight: 700; }
        @media (max-width: 600px) { .gf-strip-item { width: 130px; } .gf-vrow .gf-name { max-width: 50vw; } }
    `;

    if (typeof GM_addStyle === "function") GM_addStyle(CSS);
    else { const s = document.createElement("style"); s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }

    const keepRoot = () => { if (!document.documentElement.classList.contains("gf")) document.documentElement.classList.add("gf"); };
    try { new MutationObserver(keepRoot).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}

    function el(tag, props, ...kids) {
        const n = document.createElement(tag);
        if (props) for (const [k, v] of Object.entries(props)) {
            if (v == null) continue;
            if (k === "class") n.className = v; else if (k === "html") n.innerHTML = v;
            else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
            else n.setAttribute(k, v);
        }
        for (const kid of kids) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
        return n;
    }
    // ícones SVG portados do bunkr.js (stroke currentColor → herdam a cor do contexto/accent)
    const svgi = inner => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block">${inner}</svg>`;
    const IC = {
        download: svgi('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
        copy: svgi('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
        expand: svgi('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
        close: svgi('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
        grid: svgi('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
        video: svgi('<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4V8z"/>'),
        image: svgi('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
        file: svgi('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
        chevL: svgi('<path d="m15 18-6-6 6-6"/>'),
        chevR: svgi('<path d="m9 18 6-6-6-6"/>'),
        chevDown: svgi('<path d="m6 9 6 6 6-6"/>'),
        play: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="display:block"><path d="M7 4.5v15a1 1 0 0 0 1.52.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
    };
    // botão estilo bunkr: SVG + label opcional
    function vbtn(icon, label, opts) { const b = el("button", Object.assign({ class: "gf-item", type: "button" }, opts || {})); b.insertAdjacentHTML("beforeend", icon); if (label) b.append(el("span", null, label)); return b; }
    const SIZE_RE = /\b\d+(?:\.\d+)?\s?(?:B|KB|MB|GB|TB)\b/i;

    /* ===================== STAGE ===================== */
    let stage, stMid, stName, stSize, stDl, stStrip, stIcon, stCur = null;
    const kindIcon = k => k === "image" ? IC.image : (k === "other" ? IC.file : IC.video);
    function buildStage() {
        if (stage) return;
        stage = el("div", { class: "gf-stage" });
        const vrow = el("div", { class: "gf-vrow" });
        const back = vbtn(IC.grid, "Galeria", { title: "Voltar pra galeria", onClick: closeStage });
        stIcon = el("span", { class: "gf-nameic" }); stIcon.insertAdjacentHTML("beforeend", IC.video);
        stName = el("span", null, "");
        const nameWrap = el("div", { class: "gf-name" }, stIcon, stName);
        const stats = el("div", { class: "gf-stats" });
        stSize = el("span", { class: "gf-stat" }, "");
        stats.append(stSize);
        stDl = vbtn(IC.download, "Download", { class: "gf-item is-primary", title: "Baixar" });
        const copy = vbtn(IC.copy, "Copiar", { title: "Copiar link da pasta", onClick: () => { try { navigator.clipboard && navigator.clipboard.writeText(location.href); } catch (e) {} } });
        const fs = vbtn(IC.expand, "", { title: "Tela cheia", onClick: () => { try { document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen(); } catch (e) {} } });
        const close = vbtn(IC.close, "", { title: "Fechar (Esc)", onClick: closeStage });
        vrow.append(back, el("div", { class: "gf-vsep" }), nameWrap, stats, el("div", { class: "gf-spacer" }), stDl, copy, fs, el("div", { class: "gf-vsep" }), close);

        stMid = el("div", { class: "gf-stage-mid" });
        const navPrev = el("button", { class: "gf-nav-side gf-nav-prev", type: "button", title: "Anterior", onClick: e => { e.stopPropagation(); navStage(-1); } }); navPrev.insertAdjacentHTML("beforeend", IC.chevL);
        const navNext = el("button", { class: "gf-nav-side gf-nav-next", type: "button", title: "Próximo", onClick: e => { e.stopPropagation(); navStage(1); } }); navNext.insertAdjacentHTML("beforeend", IC.chevR);
        stMid.append(navPrev, navNext);

        const stripwrap = el("div", { class: "gf-stripwrap" });
        stStrip = el("div", { class: "gf-strip" });
        if (localStorage.getItem("gf_strip_collapsed") === "1") stripwrap.classList.add("is-collapsed");
        const collapse = el("button", { class: "gf-sbtn gf-collapse", type: "button", title: "Recolher / expandir", onClick: () => { stripwrap.classList.toggle("is-collapsed"); try { localStorage.setItem("gf_strip_collapsed", stripwrap.classList.contains("is-collapsed") ? "1" : "0"); } catch (e) {} } }); collapse.insertAdjacentHTML("beforeend", IC.chevDown);
        const prev = el("button", { class: "gf-sbtn", type: "button", title: "Rolar", onClick: () => stStrip.scrollBy({ left: -stStrip.clientWidth * 0.8, behavior: "smooth" }) }); prev.insertAdjacentHTML("beforeend", IC.chevL);
        const next = el("button", { class: "gf-sbtn", type: "button", title: "Rolar", onClick: () => stStrip.scrollBy({ left: stStrip.clientWidth * 0.8, behavior: "smooth" }) }); next.insertAdjacentHTML("beforeend", IC.chevR);
        stripwrap.append(el("div", { class: "gf-stripbar" }, collapse, el("span", { class: "gf-striplabel" }, "Arquivos da pasta"), el("div", { class: "gf-spacer" }), prev, next), stStrip);

        stage.append(vrow, stMid, stripwrap);
        (document.body || document.documentElement).appendChild(stage);
        document.addEventListener("keydown", e => { if (e.key === "Escape" && stage.classList.contains("open")) closeStage(); });
    }
    function playableCards() { return Array.from(document.querySelectorAll(".gf-card")).filter(c => c._gf && c._gf.playable && !c.classList.contains("gf-filtered")); }
    function renderStrip() {
        const cards = playableCards();
        stStrip.textContent = "";
        stage.classList.toggle("has-nav", cards.length > 1);
        cards.forEach(card => {
            const d = card._gf;
            const it = el("div", { class: "gf-strip-item" + (card === stCur ? " is-current" : ""), title: d.name });
            const th = el("div", { class: "gf-strip-thumb" });
            if (d.thumb) th.append(el("img", { src: d.thumb, alt: "", loading: "lazy", referrerpolicy: "no-referrer" })); else th.insertAdjacentHTML("beforeend", kindIcon(d.kind));
            const meta = el("div", { class: "gf-strip-meta" }); meta.insertAdjacentHTML("beforeend", kindIcon(d.kind)); meta.append(el("span", { class: "gf-strip-name" }, d.name));
            it.append(th, meta);
            it.addEventListener("click", () => loadStageItem(card));
            it._card = card;
            stStrip.appendChild(it);
        });
        const cur = stStrip.querySelector(".is-current");
        if (cur) setTimeout(() => { try { const br = cur.getBoundingClientRect(), sr = stStrip.getBoundingClientRect(); stStrip.scrollBy({ left: (br.left + br.width / 2) - (sr.left + sr.width / 2), behavior: "smooth" }); } catch (e) {} }, 80);
    }
    function navStage(dir) {
        const cards = playableCards(); if (cards.length < 2) return;
        let i = cards.indexOf(stCur); if (i < 0) i = 0;
        loadStageItem(cards[(i + dir + cards.length) % cards.length]);
    }
    function loadStageItem(card) {
        if (stCur && stCur !== card) { const cb = stCur.querySelector(".item_close"); if (cb) try { cb.click(); } catch (e) {} }
        stCur = card;
        const d = card._gf || {};
        stName.textContent = d.name || ""; stSize.textContent = d.size || "";
        if (stIcon) stIcon.innerHTML = kindIcon(d.kind);
        stDl.onclick = () => { const b = card.querySelector(".item_download"); if (b) try { b.click(); } catch (e) {} };
        // marca o atual na strip
        Array.from(stStrip.children).forEach(ch => ch.classList.toggle("is-current", ch._card === card));
        const cur = stStrip.querySelector(".is-current"); if (cur) { try { const br = cur.getBoundingClientRect(), sr = stStrip.getBoundingClientRect(); stStrip.scrollBy({ left: (br.left + br.width / 2) - (sr.left + sr.width / 2), behavior: "smooth" }); } catch (e) {} }
        // mídia: reusa o item_play NATIVO e move o .item-mediaplayer pro stage
        Array.from(stMid.querySelectorAll(".item-mediaplayer")).forEach(m => { const v = m.querySelector("video,audio"); if (v) { try { v.pause(); } catch (e) {} } m.remove(); });
        stMid.querySelectorAll(".gf-spin, .gf-stage-msg").forEach(e => e.remove());
        const spin = el("div", { class: "gf-spin" }); stMid.appendChild(spin);
        const play = card.querySelector(".item_play");
        if (!play) { spin.remove(); stMid.appendChild(el("div", { class: "gf-stage-msg", style: "color:#888" }, "Sem pré-visualização")); return; }
        try { play.click(); } catch (e) {}
        let tries = 0;
        const iv = setInterval(() => {
            const mp = card.querySelector(".item-mediaplayer");
            if (mp) { clearInterval(iv); spin.remove(); stMid.appendChild(mp); const v = mp.querySelector("video"); if (v) { v.controls = true; const p = v.play && v.play(); if (p && p.catch) p.catch(() => {}); } }
            else if (++tries > 60) { clearInterval(iv); }
        }, 80);
    }
    function openStage(card) { buildStage(); stCur = card; stage.classList.add("open"); document.documentElement.classList.add("gf-has-stage"); renderStrip(); loadStageItem(card); }
    function closeStage() {
        if (!stage) return;
        Array.from(stMid.querySelectorAll(".item-mediaplayer")).forEach(m => { const v = m.querySelector("video,audio"); if (v) { try { v.pause(); } catch (e) {} } m.remove(); });
        if (stCur) { const cb = stCur.querySelector(".item_close"); if (cb) try { cb.click(); } catch (e) {} }
        stage.classList.remove("open"); document.documentElement.classList.remove("gf-has-stage"); stCur = null;
    }

    /* ===================== GRID: linha → card ===================== */
    function processItem(it) {
        if (it.dataset.gfDone) return; it.dataset.gfDone = "1";
        it.classList.add("gf-card");
        it.classList.remove("border-b", "border-gray-600");
        const img = it.querySelector("img.item_thumbnail");
        const nameLink = it.querySelector("a.item_open");
        const name = nameLink ? (nameLink.textContent || "").replace(/\s+/g, " ").trim() : "";
        const sizeText = Array.from(it.querySelectorAll(".truncate .text-gray-400 span, .truncate .text-gray-400 div")).map(e => (e.textContent || "").trim()).find(t => SIZE_RE.test(t)) || "";
        const playable = !!it.querySelector(".item_play");
        const media = el("div", { class: "gf-media" });
        if (img) { media.appendChild(img); const tw = it.querySelector(".thumbnail"); if (tw) tw.remove(); }
        else { const ic = it.querySelector(".min-w-8 i"); const span = el("span", { class: "gf-media-ic" }); span.innerHTML = '<i class="' + ((ic && ic.className) || "fas fa-file") + '"></i>'; media.appendChild(span); }
        const kind = /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i.test(name) ? "image" : (playable ? "video" : "other");
        if (playable) { const ov = el("div", { class: "gf-media-play" }); const sp = el("span"); sp.insertAdjacentHTML("beforeend", IC.play); ov.append(sp); media.appendChild(ov); }
        it.insertBefore(media, it.firstChild);
        it._gf = { name, size: sizeText, thumb: img ? (img.getAttribute("src") || img.src) : "", playable, kind };

        const onClick = e => { e.preventDefault(); e.stopPropagation(); if (playable) openStage(it); else { const open = it.querySelector(".item_open"); if (open) open.click(); } };
        media.addEventListener("click", onClick);
        if (nameLink && playable) nameLink.addEventListener("click", onClick, true);
    }
    function scan() {
        const list = document.getElementById("filemanager_itemslist");
        if (!list) return false;
        list.querySelectorAll(":scope > [data-item-id]:not([data-gf-done])").forEach(processItem);
        return true;
    }

    /* ===================== MULTISELECT: barra flutuante com "Baixar selecionados" ===================== */
    let bulkBar, bulkCount;
    function checkedBoxes() { return Array.from(document.querySelectorAll("#filemanager_itemslist .item_checkbox:checked")); }
    function bulkDownload() {
        // 1º tenta o "Download Selected" do Gofile Enhanced (aria2/IDM); senão baixa item a item (escalonado)
        const enh = document.querySelector('#GofileEnhanced_Container a[aria-label="Download Selected" i], a[aria-label="Download Selected" i]');
        if (enh) { try { enh.click(); return; } catch (e) {} }
        checkedBoxes().forEach((cb, i) => { const it = cb.closest("[data-item-id]"); const b = it && it.querySelector(".item_download"); if (b) setTimeout(() => { try { b.click(); } catch (e) {} }, i * 400); });
    }
    function ensureBulkBar() {
        if (bulkBar) return;
        bulkBar = el("div", { class: "gf-bulk" });
        bulkCount = el("span", { class: "gf-bulk-count" }, "0 selecionados");
        const dl = vbtn(IC.download, "Baixar selecionados", { class: "gf-item is-primary", onClick: bulkDownload });
        const clear = vbtn(IC.close, "Limpar", { onClick: () => { checkedBoxes().forEach(cb => { cb.checked = false; cb.dispatchEvent(new Event("change", { bubbles: true })); }); updateBulk(); } });
        bulkBar.append(bulkCount, el("div", { class: "gf-spacer" }), dl, clear);
        (document.body || document.documentElement).appendChild(bulkBar);
    }
    function updateBulk() {
        ensureBulkBar();
        const n = checkedBoxes().length;
        bulkCount.textContent = n + (n === 1 ? " selecionado" : " selecionados");
        bulkBar.classList.toggle("open", n > 0);
    }
    document.addEventListener("change", e => { const t = e.target; if (t && t.classList && t.classList.contains("item_checkbox")) updateBulk(); }, true);
    document.addEventListener("click", e => { const t = e.target; if (t && t.classList && t.classList.contains("item_checkbox")) setTimeout(updateBulk, 0); }, true);

    /* ===================== topbar (branding + busca que filtra a grade) ===================== */
    function applyFilter(q) {
        q = (q || "").toLowerCase().trim();
        document.querySelectorAll(".gf-card").forEach(c => { const n = (c._gf && c._gf.name || "").toLowerCase(); c.classList.toggle("gf-filtered", !!q && n.indexOf(q) === -1); });
    }
    function buildTopbar() {
        const header = document.getElementById("index_header");
        if (!header || header.dataset.gfTop) return;
        const brand = document.getElementById("index_branding");
        if (!brand) return;
        header.dataset.gfTop = "1";
        brand.classList.add("gf-brand");
        const search = el("div", { class: "gf-topsearch" });
        const inp = el("input", { type: "text", placeholder: "Buscar nesta pasta…", autocomplete: "off", spellcheck: "false" });
        inp.addEventListener("input", () => applyFilter(inp.value));
        search.appendChild(inp);
        header.insertBefore(search, header.firstChild);
        header.insertBefore(brand, header.firstChild);
    }

    let observed = false;
    function start() {
        buildTopbar();
        const list = document.getElementById("filemanager_itemslist");
        if (!list) return false;
        scan();
        if (!observed) { observed = true; try { new MutationObserver(() => scan()).observe(list, { childList: true, subtree: true }); } catch (e) {} }
        return true;
    }
    function onReady(fn) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true }); else fn(); }
    onReady(() => { buildTopbar(); if (!start()) { let n = 0; const id = setInterval(() => { buildTopbar(); if (start() || ++n > 60) clearInterval(id); }, 300); } });
})();
