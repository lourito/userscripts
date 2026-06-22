// ==UserScript==
// @name         Turbo — stage estilo Bunkr/Pixeldrain/Filester (player próprio + strip do álbum)
// @namespace    turbo-theater
// @version      1.0.0
// @updateURL    https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/turbo.user.js
// @downloadURL  https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/turbo.user.js
// @description  Reestrutura a página de VÍDEO do turbo.cr (/v/) num STAGE igual ao bunkr/pixeldrain/filester: STAGE fixed cobrindo a página com (1) TOPBAR de info (Álbum/nome/tamanho/views + Download/Copiar/Tela cheia/Report), (2) a MÍDIA preenchendo o meio — PLAYER PRÓPRIO (a página nativa só tem um <iframe> de embed; aqui pego o mp4 assinado via GET /api/sign?v={id} e toco num <video> próprio, com refresh antes do exp e fallback p/ o iframe nativo se a API falhar), (3) FOOTER com a STRIP rolável dos outros vídeos do álbum ("More videos", clonados) + item atual marcado + ◀▶. ÁLBUM (/a/): tema AMOLED + tabela de arquivos estilizada. TEMA AMOLED #0b0c0f. EARLY PAINT no document-start (sem flash). Escopo TRAVADO no domínio turbo.cr (sem regex amplo) p/ não impactar outros scripts.
// @author       claudiogepeto
// @match        *://turbo.cr/*
// @match        *://*.turbo.cr/*
// @noframes
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==
(function () {
    "use strict";
    if (window.top !== window.self) return;   // ignora iframes/embeds (o /embed/ roda dentro de iframe)

    const PATH = location.pathname;
    const isVideo = /\/(?:v|embed)\//.test(PATH);
    const isAlbum = /\/a\//.test(PATH);
    document.documentElement.classList.add("tb");
    if (isVideo) document.documentElement.classList.add("tb-file");
    if (isAlbum) document.documentElement.classList.add("tb-album");

    const ACCENT = "#ef4444";   // vermelho do turbo
    const THUMB_BASE = "https://thumbs.saint2.cr/thumbs/";   // thumb do vídeo = {base}{id}.jpg

    const CSS = `
        /* ===================== TEMA AMOLED ===================== */
        html.tb, html.tb body { background: #0b0c0f !important; color: #e9e9ee !important; }
        html.tb ::selection { background: rgba(239,68,68,0.35); }
        html.tb ::-webkit-scrollbar { width: 10px; height: 10px; }
        html.tb ::-webkit-scrollbar-thumb { background: #2a2c33; border-radius: 8px; border: 2px solid #0b0c0f; }

        /* ===================== EARLY PAINT (vídeo): tampa preta até o stage montar ===================== */
        html.tb-file::before { content: ""; position: fixed; inset: 0; background: #0b0c0f; z-index: 98000; pointer-events: none; }
        html.tb-file.tb-fallback::before { display: none; }
        html.tb-has-stage, html.tb-has-stage body { overflow: hidden !important; }

        /* ===================== STAGE ===================== */
        .tb-stage { position: fixed; inset: 0; z-index: 99000; display: flex; flex-direction: column; background: #0b0c0f; color: #fff; font-family: Inter, system-ui, sans-serif; }
        .tb-stage * { box-sizing: border-box; }
        .tb-stage-mid { position: relative; flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 12px 14px; overflow: hidden; }
        .tb-video { width: 100%; height: 100%; max-height: 100%; object-fit: contain; background: #000; border-radius: 14px; outline: none; display: block; }
        .tb-stage-mid > iframe { width: 100%; height: 100%; border: 0; border-radius: 14px; background: #000; }
        .tb-spin { position: absolute; top: 50%; left: 50%; width: 42px; height: 42px; margin: -21px 0 0 -21px; border-radius: 50%; border: 3px solid rgba(255,255,255,.22); border-top-color: ${ACCENT}; animation: tb-spin .8s linear infinite; }
        @keyframes tb-spin { to { transform: rotate(360deg); } }

        /* ---- vrow (topbar) ---- */
        .tb-vrow { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; padding: 9px 14px; background: #0e0f13; border-bottom: 1px solid rgba(255,255,255,.08); overflow-x: auto; overflow-y: hidden; white-space: nowrap; scrollbar-width: thin; }
        .tb-vrow::-webkit-scrollbar { height: 6px; } .tb-vrow::-webkit-scrollbar-thumb { background: ${ACCENT}55; border-radius: 4px; }
        .tb-name { flex: 0 1 auto; min-width: 60px; max-width: 36vw; display: inline-flex; align-items: center; gap: 8px; padding: 0 4px; font-weight: 600; }
        .tb-name svg { color: ${ACCENT}; flex: 0 0 auto; }
        .tb-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tb-stats { display: flex; align-items: center; gap: 14px; padding: 0 8px; flex: 0 0 auto; }
        .tb-stat { font-size: 12px; color: rgba(255,255,255,.62); font-weight: 600; }
        .tb-spacer { flex: 1 1 auto; min-width: 8px; }
        .tb-item { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border: 1px solid rgba(255,255,255,.1); border-radius: 9px; background: rgba(255,255,255,.05); color: #fff; font: 13px/1 Inter, system-ui, sans-serif; cursor: pointer; text-decoration: none; transition: background .12s, border-color .12s; }
        .tb-item:hover { background: rgba(255,255,255,.1); border-color: ${ACCENT}66; }
        .tb-item svg { width: 18px; height: 18px; color: ${ACCENT}; }
        .tb-item.is-primary { background: ${ACCENT}; border-color: ${ACCENT}; color: #1a0606; font-weight: 700; }
        .tb-item.is-primary svg { color: #1a0606; } .tb-item.is-primary:hover { filter: brightness(1.07); }
        .tb-vsep { flex: 0 0 auto; width: 1px; height: 22px; margin: 0 3px; background: rgba(255,255,255,.1); }

        /* ---- strip (footer) ---- */
        .tb-stripwrap { flex: 0 0 auto; display: flex; flex-direction: column; background: #0e0f13; border-top: 1px solid rgba(255,255,255,.08); }
        .tb-stripbar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; }
        .tb-striplabel { font-size: 12px; font-weight: 600; color: rgba(255,255,255,.55); white-space: nowrap; }
        .tb-sbtn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 28px; padding: 0; flex: 0 0 auto; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: rgba(255,255,255,.05); color: #fff; cursor: pointer; transition: background .12s, border-color .12s; }
        .tb-sbtn:hover { background: rgba(255,255,255,.1); border-color: ${ACCENT}66; } .tb-sbtn svg { width: 18px; height: 18px; color: ${ACCENT}; }
        .tb-stripwrap.is-collapsed .tb-strip { display: none; }
        .tb-stripwrap.is-collapsed .tb-collapse svg { transform: rotate(180deg); }
        .tb-strip { display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; padding: 4px 12px 12px; scrollbar-width: none; }
        .tb-strip::-webkit-scrollbar { display: none; height: 0; }
        .tb-strip-item { flex: 0 0 auto; width: 168px; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; overflow: hidden; background: rgba(255,255,255,.03); color: #fff; text-decoration: none; transition: border-color .12s, transform .12s; }
        .tb-strip-item:hover { border-color: ${ACCENT}88; transform: translateY(-2px); }
        .tb-strip-item.is-current { border-color: ${ACCENT} !important; box-shadow: 0 0 0 2px ${ACCENT}, 0 0 14px -2px ${ACCENT}; }
        .tb-strip-item.is-current .tb-strip-name { color: #fff; font-weight: 700; }
        .tb-strip-thumb { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #000; display: block; }
        .tb-strip-meta { display: flex; align-items: center; gap: 5px; padding: 7px 8px; }
        .tb-strip-meta svg { width: 13px; height: 13px; flex: 0 0 auto; color: ${ACCENT}; }
        .tb-strip-name { font-size: 11px; line-height: 1.25; color: rgba(255,255,255,.82); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
        @media (max-width: 600px) { .tb-strip-item { width: 130px; } .tb-name { max-width: 50vw; } }

        /* ---- setas prev/próximo ---- */
        .tb-nav-side { position: absolute; top: 50%; transform: translateY(-50%); z-index: 6; width: 46px; height: 46px; border: 0; border-radius: 50%; background: rgba(0,0,0,.5); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity .18s ease, background .12s ease; }
        .tb-nav-prev { left: 16px; } .tb-nav-next { right: 16px; }
        .tb-stage.has-nav .tb-stage-mid:hover .tb-nav-side { opacity: 1; pointer-events: auto; }
        @media (hover: none) { .tb-stage.has-nav .tb-nav-side { opacity: .85; pointer-events: auto; } }
        .tb-nav-side:hover { background: rgba(0,0,0,.74); } .tb-nav-side:active { transform: translateY(-50%) scale(.92); }
        .tb-nav-side svg { width: 26px; height: 26px; display: block; }

        /* toast */
        .tb-toast { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%) translateY(12px); z-index: 100001; padding: 10px 18px; border-radius: 20px; background: #14161a; border: 1px solid ${ACCENT}66; color: #fff; font: 13px Inter, system-ui, sans-serif; box-shadow: 0 6px 22px rgba(0,0,0,.6); opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s; }
        .tb-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

        /* ===================== ÁLBUM (/a/): tabela → GRADE de cards ===================== */
        /* o conteúdo nativo é max-w-6xl (estreito) → alarga p/ ocupar a página toda (header/main/footer juntos) */
        html.tb-album .max-w-6xl { max-width: min(100% - 32px, 1800px) !important; }
        html.tb-album #searchInput, html.tb-album #sortSelect { background: #14161a !important; border-color: rgba(255,255,255,.12) !important; color: #fff !important; }
        html.tb-album #btnDownloadAlbum { background: ${ACCENT} !important; border-color: ${ACCENT} !important; color: #1a0606 !important; }
        .tb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; padding: 18px; }
        @media (max-width: 700px) { .tb-grid { grid-template-columns: repeat(auto-fill, minmax(46vw, 1fr)); gap: 12px; padding: 12px; } }
        .tb-card { position: relative; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden; background: #111317; transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease; }
        .tb-card:hover { transform: translateY(-3px); border-color: ${ACCENT}88; box-shadow: 0 10px 26px rgba(0,0,0,0.5); }
        .tb-card-link { display: block; color: inherit; text-decoration: none; }
        .tb-card-thumb { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; overflow: hidden; }
        .tb-card-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .tb-card-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .12s ease; }
        .tb-card:hover .tb-card-play { opacity: 1; }
        .tb-card-play span { width: 50px; height: 50px; border-radius: 50%; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; }
        .tb-card-play svg { width: 24px; height: 24px; color: #fff; }
        .tb-card-body { padding: 10px 12px; }
        .tb-card-name { font-size: 13px; font-weight: 600; color: #e9e9ee; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .tb-card-meta { font-size: 11.5px; color: rgba(255,255,255,0.5); margin-top: 4px; }
        .tb-card-dl { position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; border-radius: 9px; background: rgba(0,0,0,.6); color: #fff; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .12s ease, background .12s ease; text-decoration: none; }
        .tb-card:hover .tb-card-dl { opacity: 1; }
        .tb-card-dl svg { width: 16px; height: 16px; }
        .tb-card-dl:hover { background: ${ACCENT}; color: #1a0606; }
        @media (hover: none) { .tb-card-dl, .tb-card-play { opacity: 1; } }
        .tb-empty { grid-column: 1 / -1; padding: 30px; text-align: center; color: rgba(255,255,255,0.5); }
    `;

    function addCSS(css) {
        if (typeof GM_addStyle === "function") { GM_addStyle(css); return; }
        const s = document.createElement("style"); s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    }
    addCSS(CSS);

    const keepRoot = () => { const c = document.documentElement.classList; if (!c.contains("tb")) c.add("tb"); if (isVideo && !c.contains("tb-file")) c.add("tb-file"); if (isAlbum && !c.contains("tb-album")) c.add("tb-album"); };
    try { new MutationObserver(keepRoot).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}

    /* ===================== helpers ===================== */
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
        video: svgi('<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4V8z"/>'),
        chevL: svgi('<path d="m15 18-6-6 6-6"/>'),
        chevR: svgi('<path d="m9 18 6-6-6-6"/>'),
        chevDown: svgi('<path d="m6 9 6 6 6-6"/>'),
    };

    let toastT;
    function toast(msg) {
        let t = document.querySelector(".tb-toast");
        if (!t) { t = el("div", { class: "tb-toast" }); (document.body || document.documentElement).appendChild(t); }
        t.textContent = msg; t.classList.add("show");
        clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800);
    }
    function fallbackCopy(s) { try { const t = el("textarea", { style: { position: "fixed", opacity: "0", left: "-9999px" } }); t.value = s; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; } catch { return false; } }
    function copyText(s) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s).then(() => true, () => fallbackCopy(s));
        return Promise.resolve(fallbackCopy(s));
    }

    function vidId() { return (PATH.match(/\/(?:v|embed)\/([^/?#]+)/) || [])[1] || ""; }

    /* ===================== PLAYER PRÓPRIO (mp4 assinado via /api/sign, com refresh antes do exp) ===================== */
    function expOf(u) { try { return parseInt(new URL(u, location.origin).searchParams.get("exp"), 10) || 0; } catch (e) { return 0; } }
    async function signUrl(id) {
        const r = await fetch("/api/sign?v=" + encodeURIComponent(id), { credentials: "include" });
        const d = await r.json();
        if (!d || !d.success || !d.url) throw new Error("sign falhou");
        return d.url;
    }
    function scheduleRefresh(video, id) {
        const exp = expOf(video.src); if (!exp) return;
        const ms = Math.max((exp - Math.floor(Date.now() / 1000) - 60) * 1000, 10000);
        clearTimeout(video._refT);
        video._refT = setTimeout(() => {
            signUrl(id).then(u => {
                const t = video.currentTime || 0, playing = !video.paused;
                video.src = u; try { video.load(); } catch (e) {}
                if (t) { video.currentTime = t; if (playing) video.play().catch(() => {}); }
                scheduleRefresh(video, id);
            }).catch(() => { video._refT = setTimeout(() => scheduleRefresh(video, id), 30000); });
        }, ms);
    }
    function mountIframe(mid) {   // fallback: usa o <iframe> de embed nativo do turbo
        const ifr = document.querySelector("iframe.saint-iframe, iframe[src*='/embed/']");
        if (ifr) { mid.querySelectorAll(".tb-spin").forEach(s => s.remove()); mid.appendChild(ifr); return true; }
        return false;
    }
    function mountVideo(mid, id) {
        const spin = el("div", { class: "tb-spin" }); mid.appendChild(spin);
        const video = el("video", { class: "tb-video", controls: "", playsinline: "", preload: "metadata" });
        let recovering = false;
        video.addEventListener("error", () => {   // url expirou/erro de rede → re-assina 1×
            if (recovering) return; recovering = true;
            signUrl(id).then(u => { recovering = false; const t = video.currentTime || 0; video.src = u; try { video.load(); } catch (e) {} if (t) video.currentTime = t; }).catch(() => { recovering = false; });
        });
        signUrl(id).then(u => {
            spin.remove();
            video.src = u; mid.appendChild(video); try { video.load(); } catch (e) {}
            scheduleRefresh(video, id);
        }).catch(() => { spin.remove(); if (!mountIframe(mid)) toast("Falha ao carregar o vídeo"); });
    }

    /* ===================== STRIP (relacionados "More videos") ===================== */
    function relatedItems() {
        // cards de vídeo relacionados = <a href="/v/{id}"> que contêm uma <img> (no aside "More videos")
        return Array.from(document.querySelectorAll('a[href*="/v/"]')).filter(a => a.querySelector("img") && !a.closest(".tb-stage"));
    }
    function stripCard(name, href, thumb, current) {
        const card = el("a", { class: "tb-strip-item" + (current ? " is-current" : ""), href, title: name });
        card.append(el("img", { class: "tb-strip-thumb", src: thumb || "", alt: "", loading: "lazy", referrerpolicy: "no-referrer" }));
        const meta = el("div", { class: "tb-strip-meta" }); meta.insertAdjacentHTML("beforeend", IC.video); meta.append(el("span", { class: "tb-strip-name" }, name));
        card.append(meta); return card;
    }
    function renderStrip(strip) {
        const items = relatedItems();
        const stage = strip.closest(".tb-stage");
        const cur = stage && stage._cur;
        const wrap = strip.closest(".tb-stripwrap");
        const sig = items.length + "|" + (cur ? "1" : "0");
        if (strip.dataset.sig === sig) return; strip.dataset.sig = sig;
        strip.textContent = "";
        const hrefs = [];
        let curCard = null;
        if (cur) { curCard = stripCard(cur.name, cur.href, cur.thumb, true); strip.appendChild(curCard); if (cur.href) hrefs.push(cur.href); }
        items.forEach(a => {
            const href = a.getAttribute("href") || "#";
            const img = a.querySelector("img");
            const nameEl = a.querySelector(".font-semibold, .truncate");
            const name = (nameEl ? nameEl.textContent : (img ? img.getAttribute("alt") : "") || "").replace(/\s+/g, " ").trim();
            strip.appendChild(stripCard(name, href, (img && (img.getAttribute("src") || img.src)) || "", false));
            if (href && href !== "#") hrefs.push(href);
        });
        if (wrap) wrap.style.display = strip.children.length ? "" : "none";
        if (stage) stage.classList.toggle("has-nav", hrefs.length > 1);
        strip._hrefs = hrefs;
        if (curCard) setTimeout(() => { try { const br = curCard.getBoundingClientRect(), sr = strip.getBoundingClientRect(); strip.scrollBy({ left: (br.left + br.width / 2) - (sr.left + sr.width / 2), behavior: "smooth" }); } catch (e) {} }, 80);
    }
    function navFile(strip, dir) {
        const hrefs = strip && strip._hrefs; if (!hrefs || hrefs.length < 2) return;
        const curPath = location.pathname;
        let i = hrefs.findIndex(h => { try { return new URL(h, location.origin).pathname === curPath; } catch (e) { return h === curPath; } });
        if (i < 0) i = 0;
        const next = hrefs[(i + dir + hrefs.length) % hrefs.length];
        if (next) location.href = next;
    }

    /* ===================== STAGE ===================== */
    let mediaMounted = false;
    function buildStage() {
        if (document.querySelector(".tb-stage")) return document.querySelector(".tb-stage");
        const id = vidId();
        const titleEl = document.getElementById("videoTitle");
        if (!id || !titleEl) return null;
        const name = (titleEl.textContent || "").replace(/\s+/g, " ").trim();
        const sizeEl = document.getElementById("videoSize");
        const viewsEl = document.getElementById("videoViews");
        const size = sizeEl ? (sizeEl.textContent || "").trim() : "";
        const views = viewsEl ? (viewsEl.textContent || "").trim() : "";
        const albumA = document.querySelector('a[href*="/a/"]');
        const dlA = document.getElementById("btnDownload") || document.querySelector('a[href*="/d/"]');
        const reportBtn = document.getElementById("btnReport");

        const stage = el("div", { class: "tb-stage is-video" });

        // ---- vrow ----
        const vrow = el("div", { class: "tb-vrow" });
        if (albumA) { const b = el("a", { class: "tb-item", href: albumA.href, title: "Ver o álbum" }); b.insertAdjacentHTML("beforeend", IC.grid); b.append(el("span", null, "Álbum")); vrow.append(b, el("div", { class: "tb-vsep" })); }
        const nameEl = el("div", { class: "tb-name", title: name }); nameEl.insertAdjacentHTML("beforeend", IC.video); nameEl.append(el("span", null, name)); vrow.append(nameEl);
        const stats = el("div", { class: "tb-stats" });
        if (size) stats.append(el("span", { class: "tb-stat" }, size));
        if (views) stats.append(el("span", { class: "tb-stat" }, views));
        vrow.append(stats, el("div", { class: "tb-spacer" }));
        if (dlA) { const b = el("a", { class: "tb-item is-primary", href: dlA.href, title: "Baixar" }); b.insertAdjacentHTML("beforeend", IC.download); b.append(el("span", null, "Download")); vrow.append(b); }
        const copyBtn = el("button", { class: "tb-item", title: "Copiar link", onClick: () => copyText(location.href).then(ok => toast(ok ? "Link copiado" : "Falha ao copiar")) }); copyBtn.insertAdjacentHTML("beforeend", IC.copy); copyBtn.append(el("span", null, "Copiar")); vrow.append(copyBtn);
        const fsBtn = el("button", { class: "tb-item", title: "Tela cheia", onClick: () => { try { document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen(); } catch (e) {} } }); fsBtn.insertAdjacentHTML("beforeend", IC.expand); vrow.append(fsBtn);
        if (reportBtn) { vrow.append(el("div", { class: "tb-vsep" })); const b = el("button", { class: "tb-item", title: "Reportar", onClick: () => { try { reportBtn.click(); } catch (e) {} } }); b.insertAdjacentHTML("beforeend", IC.flag); vrow.append(b); }

        // ---- mid ----
        const mid = el("div", { class: "tb-stage-mid" });
        const navPrev = el("button", { class: "tb-nav-side tb-nav-prev", title: "Anterior", onClick: e => { e.stopPropagation(); navFile(stage._strip, -1); } }); navPrev.insertAdjacentHTML("beforeend", IC.chevL);
        const navNext = el("button", { class: "tb-nav-side tb-nav-next", title: "Próximo", onClick: e => { e.stopPropagation(); navFile(stage._strip, 1); } }); navNext.insertAdjacentHTML("beforeend", IC.chevR);
        mid.append(navPrev, navNext);

        // ---- strip ----
        const stripwrap = el("div", { class: "tb-stripwrap" });
        const strip = el("div", { class: "tb-strip" });
        if (localStorage.getItem("tb_strip_collapsed") === "1") stripwrap.classList.add("is-collapsed");
        const collapseBtn = el("button", { class: "tb-sbtn tb-collapse", title: "Recolher / expandir", onClick: () => { stripwrap.classList.toggle("is-collapsed"); try { localStorage.setItem("tb_strip_collapsed", stripwrap.classList.contains("is-collapsed") ? "1" : "0"); } catch (e) {} } }); collapseBtn.insertAdjacentHTML("beforeend", IC.chevDown);
        const prevBtn = el("button", { class: "tb-sbtn", title: "Rolar p/ trás", onClick: () => strip.scrollBy({ left: -strip.clientWidth * 0.8, behavior: "smooth" }) }); prevBtn.insertAdjacentHTML("beforeend", IC.chevL);
        const nextBtn = el("button", { class: "tb-sbtn", title: "Rolar p/ frente", onClick: () => strip.scrollBy({ left: strip.clientWidth * 0.8, behavior: "smooth" }) }); nextBtn.insertAdjacentHTML("beforeend", IC.chevR);
        stripwrap.append(el("div", { class: "tb-stripbar" }, collapseBtn, el("span", { class: "tb-striplabel" }, "Vídeos do álbum"), el("div", { class: "tb-spacer" }), prevBtn, nextBtn), strip);
        stage._strip = strip;
        stage._cur = { name, href: location.pathname + location.search, thumb: THUMB_BASE + id + ".jpg" };

        stage.append(vrow, mid, stripwrap);
        document.body.insertBefore(stage, document.body.firstChild);
        document.documentElement.classList.add("tb-has-stage");

        mountVideo(mid, id);
        mediaMounted = true;

        renderStrip(strip);
        const aside = document.querySelector("aside") || document.body;
        try { new MutationObserver(() => renderStrip(strip)).observe(aside, { childList: true, subtree: true }); } catch (e) {}
        return stage;
    }

    /* ===================== ÁLBUM (/a/): tabela → grade de cards (busca/sort reimplementados no grid) ===================== */
    function buildAlbumGrid() {
        const tbody = document.getElementById("fileTbody");
        if (!tbody || document.querySelector(".tb-grid")) return !!document.querySelector(".tb-grid");
        const rows = Array.from(tbody.querySelectorAll("tr.file-row"));
        if (!rows.length) return false;
        const data = rows.map(row => {
            const a = row.querySelector("a[data-thumb]") || row.querySelector('a[href*="/v/"]');
            const id = row.dataset.id || "";
            const sizeTd = row.querySelector(".file-size");
            return {
                id,
                name: row.dataset.name || (a ? a.textContent.replace(/\s+/g, " ").trim() : "") || id,
                size: parseInt(row.dataset.size || "0", 10) || 0,
                sizeText: sizeTd ? (sizeTd.textContent || "").trim() : "",
                views: parseInt(row.dataset.views || "0", 10) || 0,
                href: (a && a.getAttribute("href")) || ("/v/" + id),
                thumb: (a && a.getAttribute("data-thumb")) || (THUMB_BASE + id + ".jpg"),
                type: (row.children[2] && (row.children[2].textContent || "").trim()) || "mp4",
            };
        });
        const grid = el("div", { class: "tb-grid" });
        const table = tbody.closest("table") || tbody;
        const wrap = table.closest(".overflow-x-auto") || table;
        wrap.style.display = "none";
        wrap.insertAdjacentElement("afterend", grid);
        const cards = data.map(d => {
            const card = el("div", { class: "tb-card" });
            const link = el("a", { class: "tb-card-link", href: d.href });
            const th = el("div", { class: "tb-card-thumb" });
            const img = el("img", { src: d.thumb, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
            img.addEventListener("error", function () { this.style.visibility = "hidden"; }, { once: true });
            const play = el("div", { class: "tb-card-play" }); play.insertAdjacentHTML("beforeend", "<span>" + IC.video + "</span>");
            th.append(img, play);
            const body = el("div", { class: "tb-card-body" });
            body.append(el("div", { class: "tb-card-name", title: d.name }, d.name));
            body.append(el("div", { class: "tb-card-meta" }, [d.type, d.sizeText, d.views ? (d.views + " views") : ""].filter(Boolean).join(" · ")));
            link.append(th, body); card.append(link);
            const dl = el("a", { class: "tb-card-dl", href: "/d/" + d.id, title: "Download" }); dl.insertAdjacentHTML("beforeend", IC.download); card.append(dl);
            return { d, card };
        });
        function render() {
            const q = (((document.getElementById("searchInput") || {}).value) || "").toLowerCase().trim();
            const sort = ((document.getElementById("sortSelect") || {}).value) || "name_asc";
            let list = cards.filter(c => !q || c.d.name.toLowerCase().indexOf(q) !== -1);
            const cmp = {
                name_asc: (a, b) => a.d.name.localeCompare(b.d.name),
                name_desc: (a, b) => b.d.name.localeCompare(a.d.name),
                size_asc: (a, b) => a.d.size - b.d.size,
                size_desc: (a, b) => b.d.size - a.d.size,
                views_asc: (a, b) => a.d.views - b.d.views,
                views_desc: (a, b) => b.d.views - a.d.views,
            }[sort];
            if (cmp) list = list.slice().sort(cmp);
            grid.textContent = "";
            if (!list.length) { grid.append(el("div", { class: "tb-empty" }, "Nada encontrado")); return; }
            list.forEach(c => grid.append(c.card));
        }
        const si = document.getElementById("searchInput"); if (si) si.addEventListener("input", render);
        const ss = document.getElementById("sortSelect"); if (ss) ss.addEventListener("change", render);
        render();
        return true;
    }

    /* ===================== boot ===================== */
    function onReady(fn) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
        else fn();
    }
    onReady(() => {
        if (isAlbum) {   // galeria: tabela → grade de cards (as linhas podem renderizar após o load)
            let n = 0; const aid = setInterval(() => { if (buildAlbumGrid() || ++n > 20) clearInterval(aid); }, 300);
            buildAlbumGrid();
            return;
        }
        if (!isVideo) return;   // home: só tema/CSS
        let n = 0, id = null;
        const stop = () => { if (id) clearInterval(id); };
        const tick = () => {
            const stage = buildStage();
            if (stage && mediaMounted) { stop(); return; }
            if (++n > 16) { stop(); if (!mediaMounted) { document.documentElement.classList.add("tb-fallback"); const st = document.querySelector(".tb-stage"); if (st) st.remove(); document.documentElement.classList.remove("tb-has-stage"); } }
        };
        tick();
        id = setInterval(tick, 400);
    });
})();
