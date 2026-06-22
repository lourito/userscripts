// ==UserScript==
// @name         Rule34 Dark + Full-Width Grid
// @namespace    rule34-dark-grid
// @version      1.11.0
// @updateURL    https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/rule34.user.js
// @downloadURL  https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/rule34.user.js
// @author       claudiogepeto
// @description  Modern dark theme, full-width masonry grid with infinite scroll, grouped topbar with a curated tag-search modal, fullscreen lightbox viewer (image + video) for rule34.xxx
// @match        https://rule34.xxx/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      rule34.xxx
// @connect      *
// ==/UserScript==
(function () {
    "use strict";

    // ===================================================================== //
    //  Config + helpers                                                     //
    // ===================================================================== //
    const PAGE_SIZE = 42;      // rule34 posts per listing page (pid step)
    const ACCENT = "#8fd14f";  // rule34 brand green, brightened for dark UI
    const GAP = 12;            // masonry gap (px)

    const addStyle = (css) => {
        if (typeof GM_addStyle === "function") return GM_addStyle(css);
        const s = document.createElement("style");
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    };
    const debounce = (fn, ms) => {
        let t;
        return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    };
    const el = (tag, props = {}, html) => {
        const n = Object.assign(document.createElement(tag), props);
        if (html != null) n.innerHTML = html;
        return n;
    };
    const setUrlParam = (k, v) => {
        try {
            const u = new URL(location.href);
            if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
            history.replaceState(null, "", u.href);
        } catch (e) {}
    };
    const params = () => new URLSearchParams(location.search);
    const getCookie = (k) => { const m = document.cookie.match("(?:^|; )" + k.replace(/([.*+?^${}()|[\]\\])/g, "\\$1") + "=([^;]*)"); return m ? decodeURIComponent(m[1]) : ""; };
    const setCookie = (k, v) => { document.cookie = `${k}=${v}; path=/; max-age=31536000`; };

    // shared infinite-scroll loading indicator (spinner + message)
    const makeStatus = () => el("div", { id: "r34-status", className: "r34-loadmore" }, `<span class="r34-spin"></span><span class="r34-loadmore-txt"></span>`);
    const setStatus = (s, kind, msg) => {
        if (!s) return;
        s.classList.toggle("is-loading", kind === "loading");
        s.classList.toggle("is-done", kind === "done");
        s.classList.toggle("is-error", kind === "error");
        const t = s.querySelector(".r34-loadmore-txt");
        if (t) t.textContent = msg || "";
    };

    // ---- icons (line-icon family from the e-h script) ----
    const svg = (inner) =>
        `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
    const ICON = {
        search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
        close: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
        prev: svg('<path d="m15 18-6-6 6-6"/>'),
        next: svg('<path d="m9 18 6-6-6-6"/>'),
        film: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 14h4M17 9h4M17 14h4"/>'),
        download: svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>'),
        plus: svg('<path d="M12 5v14M5 12h14"/>'),
        minus: svg('<path d="M5 12h14"/>'),
        play: svg('<path d="M6 4l14 8-14 8Z" fill="currentColor" stroke="none"/>'),
        external: svg('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>'),
        heart: svg('<path d="M12 20s-7-4.5-9.5-9A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9.5 5C19 15.5 12 20 12 20Z"/>'),
        star: svg('<path d="M12 3l2.6 5.6L21 9.4l-4.5 4.3L17.6 21 12 17.8 6.4 21l1.1-7.3L3 9.4l6.4-.8Z"/>'),
        chevron: svg('<path d="m6 9 6 6 6-6"/>'),
        grid: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
        square: svg('<rect x="4" y="4" width="16" height="16" rx="2"/>'),
        cols: svg('<rect x="3" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/>'),
        rows: svg('<rect x="3" y="5" width="18" height="5" rx="1.5"/><rect x="3" y="14" width="18" height="5" rx="1.5"/>'),
        dice: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" stroke="none"/>'),
        chat: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>'),
        tag: svg('<path d="M20 12l-8 8-9-9V3h8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
        brush: svg('<path d="M9.5 14.5 4 20c-.6.6-.6 1.5 0 2s1.5.6 2 0l5.5-5.5"/><path d="M14 4l6 6-7 7-6-6 7-7Z"/>'),
        link: svg('<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>'),
        book: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>'),
        folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),
        trophy: svg('<path d="M8 4h8v6a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3"/><path d="M9 20h6M12 14v6"/>'),
        upload: svg('<path d="M12 19V8"/><path d="m7 12 5-5 5 5"/><path d="M5 21h14"/>'),
        video: svg('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>'),
        info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'),
        mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
        user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6.5 8-6.5s8 2.5 8 6.5"/>'),
        help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.7-2.5 2-2.5 3.5"/><path d="M12 17h.01"/>'),
    };

    // ---- tag typing + colours (gelbooru tag-type-* classes) ----
    const TAG_TYPE_COLOR = {
        artist: "#ff6b6b", character: "#8fd14f", copyright: "#e07ad6",
        general: "#9bb8ff", metadata: "#f0b34c", meta: "#f0b34c", deprecated: "#9aa0a8",
    };
    const tagTypes = new Map();
    const tagColor = (name) => TAG_TYPE_COLOR[tagTypes.get(name)] || "#9aa0a8";

    const tagStore = (() => {
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem("r34-tags") || "[]"); } catch (e) {}
        const set = new Set(arr);
        let dirty = false;
        const persist = debounce(() => {
            if (!dirty) return;
            try { localStorage.setItem("r34-tags", JSON.stringify([...set].slice(-6000))); dirty = false; } catch (e) {}
        }, 1500);
        return {
            add: (t) => { t = (t || "").trim(); if (t && !/^(score|rating):/.test(t) && !set.has(t)) { set.add(t); dirty = true; persist(); } },
            all: () => [...set],
        };
    })();

    // compact tag counts: 5032285 -> 5M, 41894 -> 42k
    const fmtCount = (s) => {
        const n = +String(s || "").replace(/[^\d]/g, "");
        if (!n) return "";
        if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
        if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "k";
        return "" + n;
    };

    // ---- listing-page meta parsing (validated against the snapshot) ----
    function parseMeta(title) {
        title = title || "";
        const rating = (title.match(/\brating:(\w+)/) || [])[1] || "";
        const score = +((title.match(/\bscore:(-?\d+)/) || [])[1] || 0);
        const tags = title.split(/\s+/).filter((w) => w && !/^score:/.test(w) && !/^rating:/.test(w));
        return { tags, score, rating };
    }

    // thumbnail -> sample: same host/dir on rule34, only the folder + prefix change.
    // (~850px instead of ~250px so the bigger masonry cards stay crisp.)
    const sampleUrl = (thumb) => {
        if (!thumb || /^data:/.test(thumb) || !/\/thumbnails\//.test(thumb)) return thumb;
        return thumb.replace("/thumbnails/", "/samples/").replace(/thumbnail_/i, "sample_");
    };

    // ---- full-media resolution (post page is same-origin → plain fetch) ----
    const mediaCache = new Map();
    const postUrl = (id) => `${location.origin}/index.php?page=post&s=view&id=${id}`;
    async function resolveMedia(id) {
        if (mediaCache.has(id)) return mediaCache.get(id);
        const p = (async () => {
            const res = await fetch(postUrl(id), { credentials: "include" });
            const html = await res.text();
            const vid = html.match(/<source[^>]+src=["']([^"']+\.(?:mp4|webm)[^"']*)["']/i) || html.match(/<video[^>]*\bsrc=["']([^"']+)["']/i);
            if (vid) return { type: "video", url: vid[1].replace(/&amp;/g, "&") };
            const orig = html.match(/href=["']([^"']*\/\/[^"']+\/images\/[^"']+\.(?:jpe?g|png|gif|webp)[^"']*)["']/i);
            const img = html.match(/id=["']image["'][^>]*\bsrc=["']([^"']+)["']/i) || html.match(/<img[^>]*\bsrc=["']([^"']*\/\/[^"']+\/(?:images|samples)\/[^"']+)["']/i);
            const url = (orig || img || [])[1];
            return url ? { type: "image", url: url.replace(/&amp;/g, "&") } : null;
        })().catch(() => null);
        mediaCache.set(id, p);
        return p;
    }

    // ---- shared tag-query navigation ----
    const currentTags = () =>
        decodeURIComponent((params().get("tags") || "").replace(/\+/g, " "))
            .split(/\s+/).filter((t) => t && t !== "all");
    function navWithTags(tags) {
        const u = new URL(location.origin + "/index.php");
        u.searchParams.set("page", "post");
        u.searchParams.set("s", "list");
        u.searchParams.set("tags", tags.length ? tags.join(" ") : "all");
        const v = params().get("r34_sort"); if (v) u.searchParams.set("r34_sort", v);
        location.href = u.href;
    }

    // ===================================================================== //
    //  Bootstrap                                                            //
    // ===================================================================== //
    let searchOpener = null;      // set by buildSearch()
    let sidebarGroups = [];       // curated tags parsed from #tag-sidebar
    let gridResort = null;        // re-applied after each infinite-scroll batch
    let cardSeq = 0;
    // view modes set a target column WIDTH; column COUNT = floor(containerWidth / target),
    // so it scales with resolution (no hard cap). "grid" → ~6 columns at 1920px.
    const VIEWS = [
        { id: "grid", icon: ICON.grid, target: 280, title: "Grid" },
        { id: "compact", icon: ICON.cols, target: 215, title: "Compact" },
        { id: "large", icon: ICON.square, target: 460, title: "Large" },
        { id: "list", icon: ICON.rows, target: 1e6, title: "List" },
    ];
    const MOBILE_BP = 768;
    const isMobile = () => window.innerWidth <= MOBILE_BP;
    let viewMode = (() => { try { return localStorage.getItem("r34-viewmode") || "grid"; } catch (e) { return "grid"; } })();
    if (!VIEWS.some((v) => v.id === viewMode)) viewMode = "grid";

    // ---- robust bootstrap: theme at document-start AND re-ensured on DOMContentLoaded ----
    // (an early GM_addStyle/inline-<style> can be dropped by CSP/timing on some reloads,
    //  which left the page unstyled until navigating; the id lets us detect + re-inject)
    const CSS = injectCss();
    const injectOnce = () => {
        if (document.getElementById("r34-style")) return;
        let sEl = null;
        try { if (typeof GM_addStyle === "function") sEl = GM_addStyle(CSS); } catch (e) {}
        if (!sEl) { sEl = document.createElement("style"); sEl.textContent = CSS; (document.head || document.documentElement).appendChild(sEl); }
        if (sEl && sEl.setAttribute) sEl.id = "r34-style";
    };
    document.documentElement.classList.add("r34");
    injectOnce();
    document.addEventListener("keydown", (e) => {   // registered once, top-level (searchOpener fills in later)
        if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); searchOpener && searchOpener(); }
    });

    // Self-healing bootstrap: theme is re-ensured every trigger; the page enhancements run
    // once but RETRY on a later trigger if a run throws (so an F5 can't half-apply and stick).
    let booted = false;
    const start = () => {
        document.documentElement.classList.add("r34");
        injectOnce();
        if (booted) return;
        try {
            const p = params();
            const page = p.get("page") || "post";
            const s = p.get("s") || "";
            sidebarGroups = parseSidebarTags();   // learn curated tags before the sidebar is hidden
            buildSearch();
            buildTopbar();
            buildBottomNav();
            // route by CONTENT (not just the page param) so favorites / pool view / search
            // results also get the grid, and everything else gets a styled generic page
            if (document.querySelector("#static-index")) {
                document.documentElement.classList.add("r34-home");
                setupHome();
            } else if (page === "post" && s === "view") {
                document.documentElement.classList.add("r34-view");
                setupPostView();
            } else if (page === "comment" && document.querySelector('#comment-list .post[id^="p"]')) {
                document.documentElement.classList.add("r34-listpage", "r34-comments-page");
                setupCommentsPage();
            } else if (document.querySelector('span.thumb a[id^="p"]')) {
                document.documentElement.classList.add("r34-list");   // posts · favorites · pool view · search
                setupGrid();
            } else if (document.querySelector("#content table.highlightable")) {
                document.documentElement.classList.add("r34-listpage", "r34-table-page");
                setupTablePage();
            } else if (page === "account" && document.querySelector("#user-index")) {
                document.documentElement.classList.add("r34-listpage", "r34-account");
            } else {
                document.documentElement.classList.add("r34-listpage", "r34-page");   // upload · forum · iCame · wiki · static · account sub-pages
            }
            booted = true;   // only lock once a full run succeeds
        } catch (e) { /* a later trigger retries; base theme already applied regardless */ }
    };
    if (document.readyState !== "loading") start();
    document.addEventListener("DOMContentLoaded", start);
    window.addEventListener("load", start);

    // ===================================================================== //
    //  Curated tag parsing (from the native #tag-sidebar)                   //
    // ===================================================================== //
    function parseSidebarTags() {
        const ul = document.querySelector("#tag-sidebar");
        if (!ul) return [];
        const groups = [];
        let cur = null;
        for (const li of ul.children) {
            const h = li.querySelector("h6");
            if (h && !/tag-type/.test(li.className)) { cur = { label: h.textContent.trim(), tags: [] }; groups.push(cur); continue; }
            const type = (li.className.match(/tag-type-([a-z]+)/) || [])[1];
            if (!type) continue;
            const postLink = li.querySelector('a[href*="page=post"]');
            if (!postLink) continue;
            const name = decodeURIComponent((postLink.href.match(/[?&]tags=([^&]+)/) || [])[1] || "").replace(/\+/g, " ").trim();
            if (!name || name === "all") continue;
            const label = postLink.textContent.trim() || name.replace(/_/g, " ");
            const count = (li.querySelector(".tag-count")?.textContent || "").trim();
            const wiki = li.querySelector('a[href*="search="]')?.href || "";
            tagTypes.set(name, type);
            tagStore.add(name);
            if (!cur) { cur = { label: "Tags", tags: [] }; groups.push(cur); }
            cur.tags.push({ name, label, count, wiki, type });
        }
        return groups.filter((g) => g.tags.length);
    }

    // ===================================================================== //
    //  Topbar: grouped nav + curated tag-search button                      //
    // ===================================================================== //
    const navHref = (h) => {
        if (/^(https?:|mailto:)/.test(h)) return h;
        if (h.startsWith("?")) return location.origin + "/index.php" + h;
        if (h.startsWith("/")) return location.origin + h;
        return h;
    };
    const NAV = [
        { label: "Posts", href: "?page=post&s=list&tags=all", icon: ICON.grid },
        { label: "Random", href: "?page=post&s=random", icon: ICON.dice },
        { label: "Comments", href: "?page=comment&s=list", icon: ICON.chat },
        { group: "Browse", icon: ICON.book, items: [
            { label: "Tags", href: "?page=tags&s=list", icon: ICON.tag },
            { label: "Artists", href: "?page=artist&s=list", icon: ICON.brush },
            { label: "Aliases", href: "?page=alias&s=list", icon: ICON.link },
            { label: "Pools", href: "?page=pool&s=list", icon: ICON.folder },
            { label: "Forum", href: "?page=forum&s=list", icon: ICON.chat },
            { label: "Wiki", href: "?page=wiki&s=list", icon: ICON.book },
            { label: "iCame Top 100", href: "?page=icame", icon: ICON.trophy },
        ] },
        { group: "Site", icon: ICON.upload, items: [
            { label: "Browse Videos", href: "?page=post&s=list&tags=video", icon: ICON.film },
            { label: "Upload Image", href: "?page=post&s=add", icon: ICON.upload },
            { label: "Upload Video", href: "?page=post&s=addVideo", icon: ICON.video },
            { sep: true },
            { label: "About", href: "?page=about", icon: ICON.info },
            { label: "Help", href: "?page=help", icon: ICON.help },
            { label: "Contact Us", href: "mailto:staff@booru.org", icon: ICON.mail },
            { label: "DMCA", href: "mailto:dmca@booru.org", icon: ICON.mail },
            { label: "TOS", href: "?page=tos", icon: ICON.info },
        ] },
        { group: "Links", icon: ICON.external, items: [
            { label: "Discord", href: "https://discord.gg/rule34xxx", icon: ICON.chat, ext: true },
            { label: "X", href: "https://x.com/slayerduckie", icon: ICON.external, ext: true },
            { label: "Other Sites", href: "/link.php", icon: ICON.external },
        ] },
    ];

    function isCurrentTop(item) {
        if (!item.href || !item.href.startsWith("?")) return false;
        const u = new URL(navHref(item.href));
        const ip = u.searchParams.get("page"), is = u.searchParams.get("s") || "";
        const cp = params().get("page") || "post", cs = params().get("s") || "";
        if (ip !== cp) return false;
        if (ip === "post") {                                  // Posts vs Random share page=post
            if (is === "random") return cs === "random";
            return (is === "list" || is === "") && (cs === "list" || cs === "");
        }
        return true;
    }

    function buildTopbar() {
        const header = document.querySelector("#header");
        if (!header || document.querySelector("#r34-bar")) return;

        const bar = el("div", { id: "r34-bar" });
        const logo = el("a", { className: "r34-logo", href: location.origin + "/" }, `Rule <b>34</b>`);
        const nav = el("nav", { className: "r34-nav" });

        for (const item of NAV) {
            if (item.group) {
                const group = el("div", { className: "r34-nav-group" });
                const top = el("button", { type: "button", className: "r34-nav-top" },
                    `${item.icon}<span>${item.group}</span><span class="r34-caret">${ICON.chevron}</span>`);
                const panel = el("div", { className: "r34-nav-panel" });
                for (const sub of item.items) {
                    if (sub.sep) { panel.appendChild(el("div", { className: "r34-nav-sep" })); continue; }
                    const a = el("a", { className: "r34-nav-item", href: navHref(sub.href) }, `<span class="r34-nav-ico">${sub.icon}</span><b>${sub.label}</b>`);
                    if (sub.ext) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
                    panel.appendChild(a);
                }
                top.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const wasOpen = group.classList.contains("open");
                    document.querySelectorAll(".r34-nav-group.open").forEach((g) => g.classList.remove("open"));
                    group.classList.toggle("open", !wasOpen);
                });
                group.append(top, panel);
                nav.appendChild(group);
            } else {
                const a = el("a", { className: "r34-nav-top" + (isCurrentTop(item) ? " is-current" : ""), href: navHref(item.href) }, `${item.icon}<span>${item.label}</span>`);
                nav.appendChild(a);
            }
        }
        document.addEventListener("click", () => document.querySelectorAll(".r34-nav-group.open").forEach((g) => g.classList.remove("open")));

        const right = el("div", { className: "r34-bar-right" });
        const searchBtn = el("button", { type: "button", className: "r34-search", title: "Search posts or tags (⌘K)" }, `${ICON.search}<span>Search</span><kbd>⌘K</kbd>`);
        searchBtn.addEventListener("click", () => searchOpener && searchOpener());
        const acct = el("a", { className: "r34-acct", href: navHref("?page=account&s=home") }, `${ICON.user}<span>My Account</span>`);
        right.append(searchBtn, acct);

        bar.append(logo, nav, right);
        header.insertBefore(bar, header.firstChild);
    }

    // mobile bottom dock (same scheme as the e-h script): primary nav lives here while
    // the topbar collapses to just the logo
    function buildBottomNav() {
        if (document.querySelector("#r34-botnav")) return;
        const o = location.origin;
        const curPage = params().get("page") || "post";
        const curS = params().get("s") || "";
        const isCur = (label) => {
            if (label === "Posts") return curPage === "post" && (curS === "list" || curS === "");
            if (label === "Comments") return curPage === "comment";
            if (label === "Account") return curPage === "account";
            return false;
        };
        const items = [
            { icon: ICON.grid, label: "Posts", href: o + "/index.php?page=post&s=list&tags=all" },
            { icon: ICON.dice, label: "Random", href: o + "/index.php?page=post&s=random" },
            { icon: ICON.search, label: "Search", action: "search", center: true },
            { icon: ICON.chat, label: "Comments", href: o + "/index.php?page=comment&s=list" },
            { icon: ICON.user, label: "Account", href: o + "/index.php?page=account&s=home" },
        ];
        const nav = el("nav", { id: "r34-botnav" });
        for (const it of items) {
            const a = el(it.href ? "a" : "button", { className: "r34-botnav-item" + (it.center ? " center" : "") + (isCur(it.label) ? " is-current" : "") });
            if (it.href) a.href = it.href; else a.type = "button";
            a.innerHTML = `<span class="r34-botnav-ico">${it.icon}</span><span class="r34-botnav-lbl"></span>`;
            a.querySelector(".r34-botnav-lbl").textContent = it.label;
            if (it.action === "search") a.addEventListener("click", (e) => { e.preventDefault(); searchOpener && searchOpener(); });
            nav.append(a);
        }
        document.body.appendChild(nav);
    }

    // ===================================================================== //
    //  Curated tag-search modal (mirrors the sidebar's grouped structure)   //
    // ===================================================================== //
    function buildSearch() {
        if (document.querySelector("#r34-search")) return;
        const RECENT_KEY = "r34-recent";
        const loadHist = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter((e) => e && e.url); } catch (e) { return []; } };
        const saveHist = (a) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(a.slice(0, 60))); } catch (e) {} };
        const addHist = (entry) => { if (entry && entry.url) { const a = loadHist().filter((e) => e.url !== entry.url); a.unshift(entry); saveHist(a); } };

        const overlay = el("div", { id: "r34-search", hidden: true });
        overlay.innerHTML = `
            <div class="r34-s-box" role="dialog">
                <div class="r34-s-head">
                    <div class="r34-s-field-wrap">${ICON.search}<input class="r34-s-field" type="text" placeholder="Search posts by tag, or filter the list below…" autocomplete="off"><kbd class="r34-s-kbd">esc</kbd></div>
                    <div class="r34-s-legend">
                        <span class="r34-lg"><i class="r34-lg-q">?</i>wiki</span>
                        <span class="r34-lg"><i class="r34-lg-i">+</i>include</span>
                        <span class="r34-lg"><i class="r34-lg-e">−</i>exclude</span>
                        <span class="r34-lg-note">colour = tag type</span>
                    </div>
                </div>
                <div class="r34-s-chips" hidden></div>
                <div class="r34-s-body"></div>
                <div class="r34-s-foot"><button class="r34-s-reset" type="button">Reset</button><span class="r34-s-hint">Enter to search · click a tag to add</span><button class="r34-s-go" type="button">Search</button></div>
            </div>`;
        document.body.appendChild(overlay);

        const q1 = (s) => overlay.querySelector(s);
        const field = q1(".r34-s-field");
        const chipsRow = q1(".r34-s-chips");
        const body = q1(".r34-s-body");
        const chips = new Set(currentTags());

        const addInclude = (name) => { chips.delete("-" + name); chips.add(name); field.value = ""; render(); field.focus(); };
        const addExclude = (name) => { chips.delete(name); chips.add("-" + name); field.value = ""; render(); field.focus(); };

        // a single tag row, structured exactly like the sidebar: [?] [+] [−] name count
        const tagRow = (t) => {
            const row = el("div", { className: "r34-tg" });
            row.style.setProperty("--tc", TAG_TYPE_COLOR[t.type] || "#9aa0a8");
            const wiki = el("a", { className: "r34-tg-act r34-tg-wiki", title: "Wiki", href: t.wiki || "#", target: "_blank", rel: "noopener" }, "?");
            if (!t.wiki) wiki.style.visibility = "hidden";
            const inc = el("button", { type: "button", className: "r34-tg-act r34-tg-inc", title: "Include this tag" }, ICON.plus);
            const exc = el("button", { type: "button", className: "r34-tg-act r34-tg-exc", title: "Exclude this tag" }, ICON.minus);
            const acts = el("div", { className: "r34-tg-acts" });
            acts.append(wiki, inc, exc);
            const name = el("button", { type: "button", className: "r34-tg-name" });
            name.textContent = t.label || t.name.replace(/_/g, " ");
            const count = el("span", { className: "r34-tg-count" }, fmtCount(t.count));
            inc.addEventListener("click", () => addInclude(t.name));
            exc.addEventListener("click", () => addExclude(t.name));
            name.addEventListener("click", () => addInclude(t.name));
            row.append(acts, name, count);
            return row;
        };

        const flat = () => sidebarGroups.flatMap((g) => g.tags);
        const render = () => {
            // selected chips
            chipsRow.innerHTML = "";
            chipsRow.hidden = !chips.size;
            for (const t of chips) {
                const neg = t.startsWith("-");
                const nm = neg ? t.slice(1) : t;
                const chip = el("span", { className: "r34-s-chip" + (neg ? " is-neg" : "") });
                chip.style.setProperty("--tc", tagColor(nm));
                const lbl = el("span", {}); lbl.textContent = (neg ? "−" : "") + nm.replace(/_/g, " ");
                const x = el("button", { type: "button", className: "r34-s-chipx" }, ICON.close);
                x.addEventListener("click", () => { chips.delete(t); render(); });
                chip.append(lbl, x);
                chipsRow.append(chip);
            }

            const q = field.value.trim().toLowerCase().replace(/\s+/g, "_");
            body.innerHTML = "";
            const tagsBox = el("div", { className: "r34-s-tags" });   // tags get their own internal scroll
            if (q) {
                // run-the-typed-query row (stays above the scroll area)
                const run = el("button", { type: "button", className: "r34-s-run" }, `${ICON.search}<span>Search <b>${q.replace(/_/g, " ")}</b></span>`);
                run.addEventListener("click", commit);
                body.append(run);
                const matches = flat().filter((t) => t.name.toLowerCase().includes(q) || (t.label || "").toLowerCase().includes(q.replace(/_/g, " ")));
                const extra = tagStore.all().filter((n) => n.toLowerCase().includes(q) && !matches.some((m) => m.name === n)).slice(0, 40).map((n) => ({ name: n, label: n.replace(/_/g, " "), count: "", wiki: "", type: tagTypes.get(n) }));
                const list = el("div", { className: "r34-tg-list" });
                [...matches, ...extra].slice(0, 160).forEach((t) => list.append(tagRow(t)));
                if (!list.children.length) list.append(el("div", { className: "r34-s-empty" }, "No matching tags — Enter to search anyway."));
                tagsBox.append(list);
            } else if (sidebarGroups.length) {
                for (const g of sidebarGroups) {
                    tagsBox.append(el("div", { className: "r34-tg-glabel" }, g.label));
                    const list = el("div", { className: "r34-tg-list" });
                    g.tags.forEach((t) => list.append(tagRow(t)));
                    tagsBox.append(list);
                }
            } else {
                tagsBox.append(el("div", { className: "r34-s-empty" }, "Type a tag and press Enter to search."));
            }
            body.append(tagsBox);

            // recents below the tag scroll — always visible, not buried under the tags
            if (!q) {
                const hist = loadHist();
                if (hist.length) {
                    const recents = el("div", { className: "r34-s-recents" });
                    const head = el("div", { className: "r34-s-rhead" }, `<span>Recent</span>`);
                    const clr = el("button", { type: "button", className: "r34-s-rclear" }, "Clear");
                    clr.addEventListener("click", () => { saveHist([]); render(); });
                    head.append(clr);
                    recents.append(head);
                    const rl = el("div", { className: "r34-s-rlist" });
                    hist.slice(0, 12).forEach((h) => {
                        const it = el("button", { type: "button", className: "r34-s-recent" }, `${ICON.search}<span class="r34-s-recent-q">${h.q || "(all)"}</span>`);
                        it.addEventListener("click", () => { location.href = h.url; });
                        rl.append(it);
                    });
                    recents.append(rl);
                    body.append(recents);
                }
            }
        };

        function commit() {
            field.value.trim().split(/\s+/).filter(Boolean).forEach((x) => chips.add(x.replace(/\s+/g, "_")));
            const tags = [...chips];
            const u = new URL(location.origin + "/index.php");
            u.searchParams.set("page", "post"); u.searchParams.set("s", "list");
            u.searchParams.set("tags", tags.length ? tags.join(" ") : "all");
            addHist({ q: tags.join(" "), url: u.href });
            location.href = u.href;
        }

        const open = () => {
            chips.clear(); currentTags().forEach((t) => chips.add(t));
            overlay.hidden = false; field.value = ""; render();
            document.documentElement.style.overflow = "hidden";
            setTimeout(() => field.focus(), 30);
        };
        const close = () => { overlay.hidden = true; document.documentElement.style.overflow = ""; };
        searchOpener = () => (overlay.hidden ? open() : close());

        field.addEventListener("input", render);
        field.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
        q1(".r34-s-go").addEventListener("click", commit);
        q1(".r34-s-reset").addEventListener("click", () => { chips.clear(); field.value = ""; render(); field.focus(); });
        overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(); });
    }

    // ===================================================================== //
    //  Masonry helpers                                                      //
    // ===================================================================== //
    let pageGrids = [];           // one masonry grid per loaded page (block-stacked, separated by dividers)
    const sizeCard = (card) => { const h = card.getBoundingClientRect().height; if (h) card.style.gridRowEnd = "span " + (Math.round(h) + GAP); };
    const sizeAll = (grid) => grid.querySelectorAll(".r34-card").forEach(sizeCard);
    const viewTarget = () => (VIEWS.find((v) => v.id === viewMode) || VIEWS[1]).target;
    function applyCols(grid) {
        const w = grid.clientWidth || grid.offsetWidth || window.innerWidth;
        // mobile: ignore the (hidden) view selector — always a 2-up grid with bigger thumbs
        const target = isMobile() ? 165 : viewTarget();
        grid.style.setProperty("--r34-cols", Math.max(1, Math.floor(w / target)));
        grid.dataset.view = isMobile() ? "mobile" : viewMode;
    }

    // Keep the viewport visually anchored across a layout change. A masonry re-pack (a thumb
    // settling into its real height) shifts everything below it; without this, a card resolving
    // *above* the fold shoves the page you're reading. We pin whatever sits at mid-viewport,
    // run the layout change, then scroll by however much that anchor moved.
    function withScrollAnchor(fn) {
        const cx = Math.min(window.innerWidth / 2, window.innerWidth - 1);
        let anchor = null;
        for (const y of [0.5, 0.35, 0.65, 0.2]) {
            const p = document.elementFromPoint(cx, Math.round(window.innerHeight * y));
            anchor = p && p.closest ? p.closest(".r34-card") : null;
            if (anchor) break;
        }
        const prevTop = anchor ? anchor.getBoundingClientRect().top : 0;
        fn();
        if (anchor && anchor.isConnected) {
            const delta = anchor.getBoundingClientRect().top - prevTop;
            if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
        }
    }

    // Coalesce thumb-settle resizes into a single anchored layout pass per frame.
    let settleQueue = new Set(), settleRAF = 0;
    function queueSettle(card) {
        settleQueue.add(card);
        if (settleRAF) return;
        settleRAF = requestAnimationFrame(() => {
            settleRAF = 0;
            const batch = settleQueue; settleQueue = new Set();
            withScrollAnchor(() => batch.forEach((c) => { if (c.isConnected) sizeCard(c); }));
        });
    }

    function relayoutAll() {
        pageGrids = pageGrids.filter((g) => g.isConnected);
        pageGrids.forEach((g) => applyCols(g));
        withScrollAnchor(() => pageGrids.forEach((g) => sizeAll(g)));
    }
    function initMasonry(container) {
        relayoutAll();
        let lastW = container.clientWidth;
        const ro = new ResizeObserver(() => { const w = container.clientWidth; if (Math.abs(w - lastW) < 1) return; lastW = w; relayoutAll(); });
        ro.observe(container);
    }

    // A page section = optional "Page N" divider + its own masonry grid.
    function pageDivider(label) {
        const d = el("div", { className: "r34-divider" });
        d.innerHTML = `<span class="r34-divider-line"></span><span class="r34-divider-lbl">Page ${label}</span><span class="r34-divider-line"></span>`;
        return d;
    }
    function addPage(container, posts, dividerLabel) {
        const sec = el("div", { className: "r34-page-sec" });
        if (dividerLabel) sec.appendChild(pageDivider(dividerLabel));
        const pg = el("div", { className: "r34-pagegrid" });
        for (const it of posts) pg.appendChild(postCard(it));
        sec.appendChild(pg);
        container.appendChild(sec);     // appended at the bottom → never reflows pages above
        pageGrids.push(pg);
        applyCols(pg); sizeAll(pg);
        return pg;
    }
    function pageNumFromUrl(u) {
        try { return Math.floor(+(new URL(u, location.origin).searchParams.get("pid") || 0) / PAGE_SIZE) + 1; } catch (e) { return 0; }
    }

    // ===================================================================== //
    //  Listing: full-width masonry grid + infinite scroll                   //
    // ===================================================================== //
    function setupGrid() {
        if (document.getElementById("r34-grid")) return;
        const firstThumb = document.querySelector("span.thumb");
        const list = document.querySelector(".image-list") || (firstThumb && firstThumb.parentElement);  // favorites/pool view may not wrap in .image-list
        if (!list) return;
        const seen = new Set();
        const posts = extractPosts(document, seen);
        if (!posts.length) return;

        const container = el("div", { id: "r34-grid" });
        const toolbar = buildToolbar(container, posts.length);
        const status = makeStatus();

        list.before(toolbar, container);
        container.after(status);
        list.style.display = "none";

        pageGrids = [];
        addPage(container, posts, null);     // first loaded page → no divider above it
        if (gridResort) gridResort();

        initMasonry(container);
        setupGridScroll(container, status, seen, toolbar);
        setupViewer(container);
    }

    function extractPosts(root, seen) {
        const out = [];
        for (const span of root.querySelectorAll("span.thumb")) {
            const a = span.querySelector("a");
            const img = span.querySelector("img");
            if (!a || !img) continue;
            const id = (span.id || "").replace(/^s/, "") || (a.id || "").replace(/^p/, "");
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const title = img.getAttribute("title") || img.getAttribute("alt") || "";
            const { tags, score, rating } = parseMeta(title);
            tags.forEach((t) => tagStore.add(t));
            const thumb = img.getAttribute("src") || img.getAttribute("data-cfsrc") || img.dataset.src || "";
            out.push({ id, href: a.href, thumb, tags, score, rating });
        }
        return out;
    }

    const VIDEO_TAGS = new Set(["video", "animated", "mp4", "webm", "sound"]);
    function postCard(it) {
        const card = el("a", { className: "r34-card", href: it.href });
        card.dataset.id = it.id;
        card.dataset.idx = String(cardSeq++);
        card.dataset.score = String(it.score || 0);
        const isVideo = it.tags.some((t) => VIDEO_TAGS.has(t));

        // placeholder height until the image loads — keeps the grid tall so infinite
        // scroll doesn't run away while lazy thumbs are still blank
        card.classList.add("r34-ld");
        card.style.gridRowEnd = "span " + (200 + GAP);
        const thumb = el("div", { className: "r34-thumb" });
        if (it.thumb && !/^data:/.test(it.thumb)) {
            const img = el("img", { loading: "lazy", alt: it.tags.slice(0, 8).join(" ") });
            const sample = sampleUrl(it.thumb);
            let triedThumb = sample === it.thumb;
            const settle = () => { card.classList.remove("r34-ld"); queueSettle(card); };
            img.addEventListener("load", settle);
            img.addEventListener("error", () => {
                if (!triedThumb) { triedThumb = true; img.src = it.thumb; } // sample missing → fall back to thumbnail
                else settle();
            });
            img.src = sample;
            thumb.appendChild(img);
            // hover → upgrade to full resolution (image posts only; fetched once, cached, no GP)
            if (!isVideo) {
                let hov, up = false;
                card.addEventListener("mouseenter", () => {
                    if (up) return;
                    hov = setTimeout(async () => {
                        const m = await resolveMedia(it.id);
                        if (!up && m && m.type === "image" && m.url) { up = true; const pre = new Image(); pre.onload = () => { img.src = m.url; }; pre.src = m.url; }
                    }, 300);
                });
                card.addEventListener("mouseleave", () => clearTimeout(hov));
            }
        } else {
            card.classList.remove("r34-ld");
        }
        if (isVideo) thumb.appendChild(el("span", { className: "r34-badge-vid" }, ICON.play));
        card.appendChild(thumb);

        const meta = el("div", { className: "r34-cmeta" });
        meta.appendChild(el("span", { className: "r34-cscore" }, ICON.star + `<b>${it.score || 0}</b>`));
        if (it.rating) {
            const r = it.rating[0].toLowerCase();
            const dot = el("span", { className: "r34-crate r34-rate-" + r, title: it.rating });
            dot.textContent = r.toUpperCase();
            meta.appendChild(dot);
        }
        card.appendChild(meta);
        return card;
    }

    // next page URL: prefer the paginator's "next" link, else bump pid on the CURRENT url
    // (NOT location.href — that bug made it loop back to page 2 and stop early)
    function nextFrom(currentUrl, doc) {
        const nx = doc && doc.querySelector('#paginator a[alt="next"], #paginator a[alt="next page"]');
        if (nx && nx.getAttribute("href")) return new URL(nx.getAttribute("href"), location.origin).href;
        const u = new URL(currentUrl || location.href, location.origin);
        u.searchParams.set("pid", +(u.searchParams.get("pid") || 0) + PAGE_SIZE);
        return u.href;
    }

    // dual trigger: IntersectionObserver + a throttled scroll listener (scroll still works
    // even when the sentinel stays within view after an error/empty page)
    function watchScroll(sentinel, loadMore) {
        new IntersectionObserver(() => loadMore(), { rootMargin: "1600px 0px" }).observe(sentinel);
        let ticking = false;
        window.addEventListener("scroll", () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => { ticking = false; loadMore(); });
        }, { passive: true });
    }

    function setupGridScroll(container, status, seen, toolbar) {
        let url = nextFrom(location.href, document);
        let loading = false, done = false;
        const sentinel = el("div", { id: "r34-sentinel" });
        status.after(sentinel);
        const countEl = toolbar.querySelector(".r34-count b");
        const nearBottom = () => sentinel.getBoundingClientRect().top <= window.innerHeight + 1600;

        async function loadMore() {
            if (loading || done || !url) return;
            loading = true;
            setStatus(status, "loading", "Loading more…");
            try {
                while (!done && nearBottom()) {
                    const fetched = url;                          // the page we're about to add
                    const res = await fetch(fetched, { credentials: "include" });
                    if (!res.ok) throw new Error(res.status);
                    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
                    const more = extractPosts(doc, seen);
                    if (!more.length) { done = true; break; }     // empty page = real end
                    addPage(container, more, pageNumFromUrl(fetched));
                    if (gridResort) gridResort();
                    if (countEl) countEl.textContent = container.querySelectorAll(".r34-card").length;
                    url = nextFrom(fetched, doc);
                }
                setStatus(status, done ? "done" : "", done ? "You’re all caught up" : "");
            } catch (e) {
                setStatus(status, "error", "Couldn’t load — scroll to retry");
            } finally {
                loading = false;
            }
        }
        watchScroll(sentinel, loadMore);
    }

    function sortGrid(grid, key) {
        const cards = Array.from(grid.querySelectorAll(".r34-card"));
        const num = (c, k) => +c.dataset[k] || 0;
        const cmps = {
            default: (a, b) => num(a, "idx") - num(b, "idx"),
            score: (a, b) => num(b, "score") - num(a, "score"),
            id_desc: (a, b) => num(b, "id") - num(a, "id"),
            id_asc: (a, b) => num(a, "id") - num(b, "id"),
        };
        cards.sort(cmps[key] || cmps.default).forEach((c) => grid.appendChild(c));
    }

    // ===================================================================== //
    //  Toolbar: heading + Filter-AI switch + sort + density (max 3 cols)     //
    // ===================================================================== //
    function buildToolbar(grid, count) {
        const tb = el("div", { id: "r34-toolbar" });
        const top = el("div", { className: "r34-tb-top" });

        const tagsNow = currentTags();
        const heading = el("div", { className: "r34-count" });
        heading.innerHTML = `<span class="r34-count-q">${tagsNow.length ? tagsNow.join(" ") : "all posts"}</span> · <b>${count}</b> loaded`;

        // Filter AI (relocated from the sidebar; sets the native cookie + reloads)
        const aiOn = getCookie("filter_ai") === "1";
        const ai = el("label", { className: "r34-switch" });
        ai.innerHTML = `<input type="checkbox"${aiOn ? " checked" : ""}><span class="r34-switch-track"></span><span class="r34-switch-lbl">Filter AI</span>`;
        ai.querySelector("input").addEventListener("change", (e) => { setCookie("filter_ai", e.target.checked ? "1" : "0"); location.reload(); });

        // sort
        const preSort = params().get("r34_sort") || "default";
        const sortSel = el("select", { className: "r34-sort" });
        sortSel.innerHTML =
            `<option value="default">Newest</option><option value="score">Top score</option><option value="id_desc">Newest id</option><option value="id_asc">Oldest id</option>`;
        sortSel.value = preSort;
        sortSel.addEventListener("change", () => {
            const v = sortSel.value;
            // sort within each page block (keeps the page dividers meaningful)
            gridResort = v === "default" ? null : () => pageGrids.forEach((g) => sortGrid(g, v));
            pageGrids.forEach((g) => sortGrid(g, v));
            setUrlParam("r34_sort", v === "default" ? "" : v);
        });
        if (preSort !== "default") gridResort = () => pageGrids.forEach((g) => sortGrid(g, preSort));

        // view mode (Compact / Grid / Large / List) — sets target column width
        const seg = el("div", { className: "r34-seg" });
        VIEWS.forEach((v) => {
            const b = el("button", { type: "button", title: v.title }, v.icon);
            b.dataset.v = v.id;
            b.classList.toggle("on", v.id === viewMode);
            b.addEventListener("click", () => {
                viewMode = v.id;
                try { localStorage.setItem("r34-viewmode", v.id); } catch (e) {}
                seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.v === v.id));
                relayoutAll();
            });
            seg.appendChild(b);
        });

        top.append(heading, ai, sortSel, seg);

        // active tag chips (removable)
        const tagRow = el("div", { className: "r34-tagrow" });
        const active = currentTags();
        active.forEach((t, i) => {
            const neg = t.startsWith("-");
            const name = neg ? t.slice(1) : t;
            const chip = el("span", { className: "r34-chip" + (neg ? " is-neg" : "") });
            chip.style.setProperty("--tc", tagColor(name));
            const lbl = el("span", {}); lbl.textContent = (neg ? "−" : "") + name.replace(/_/g, " ");
            const x = el("button", { type: "button", className: "r34-chipx", "aria-label": "Remove" }, ICON.close);
            x.addEventListener("click", () => { active.splice(i, 1); navWithTags(active); });
            chip.append(lbl, x);
            tagRow.append(chip);
        });
        tagRow.style.display = active.length ? "flex" : "none";

        tb.append(top, tagRow);
        return tb;
    }

    // ===================================================================== //
    //  Fullscreen viewer (lightbox) — image + video, filmstrip, key nav     //
    // ===================================================================== //
    function setupViewer(grid) {
        let items = [];
        let idx = 0;
        let open = false;

        const modal = el("div", { id: "r34-viewer" });
        modal.innerHTML =
            `<div class="r34-v-counter"></div>` +
            `<a class="r34-v-open" target="_blank" title="Open post page">${ICON.external}</a>` +
            `<a class="r34-v-dl" title="Download" download>${ICON.download}</a>` +
            `<button class="r34-v-strip-btn" type="button" aria-label="Toggle thumbnails">${ICON.film}</button>` +
            `<button class="r34-v-close" type="button" aria-label="Close">${ICON.close}</button>` +
            `<button class="r34-v-nav r34-v-prev" type="button" aria-label="Previous">${ICON.prev}</button>` +
            `<button class="r34-v-nav r34-v-next" type="button" aria-label="Next">${ICON.next}</button>` +
            `<div class="r34-v-stage"><div class="r34-v-spinner"></div><div class="r34-v-media"></div></div>` +
            `<div class="r34-v-strip"></div>`;
        document.body.appendChild(modal);

        const stage = modal.querySelector(".r34-v-stage");
        const mediaWrap = modal.querySelector(".r34-v-media");
        const counter = modal.querySelector(".r34-v-counter");
        const strip = modal.querySelector(".r34-v-strip");
        const openLink = modal.querySelector(".r34-v-open");
        const dlLink = modal.querySelector(".r34-v-dl");

        const collect = () => Array.from(grid.querySelectorAll(".r34-card")).map((c) => ({ id: c.dataset.id, href: c.href, thumb: c.querySelector("img")?.src || "" }));

        const buildStrip = () => {
            strip.textContent = "";
            items.forEach((it, i) => {
                const cell = el("button", { type: "button", className: "r34-strip-cell" });
                cell.dataset.i = i;
                if (it.thumb) { const im = el("img", { loading: "lazy", alt: "" }); im.src = it.thumb; cell.appendChild(im); }
                strip.appendChild(cell);
            });
        };
        const markStrip = () => {
            strip.querySelectorAll(".r34-strip-cell").forEach((c) => c.classList.toggle("active", +c.dataset.i === idx));
            const a = strip.querySelector(".r34-strip-cell.active");
            if (a) a.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
        };

        const setMedia = (m) => {
            mediaWrap.innerHTML = "";
            if (!m) { modal.classList.remove("loading"); mediaWrap.append(el("div", { className: "r34-v-fail" }, "Couldn’t load media")); return; }
            if (m.type === "video") {
                const v = el("video", { controls: true, autoplay: true, loop: true, playsInline: true, className: "r34-v-vid" });
                v.src = m.url;
                v.addEventListener("loadeddata", () => modal.classList.remove("loading"));
                v.addEventListener("error", () => modal.classList.remove("loading"));
                mediaWrap.appendChild(v);
            } else {
                const img = el("img", { className: "r34-v-img", alt: "" });
                img.onload = img.onerror = () => modal.classList.remove("loading");
                img.src = m.url;
                mediaWrap.appendChild(img);
            }
            dlLink.href = m.url;
        };

        async function show(i) {
            if (!items.length) return;
            idx = (i + items.length) % items.length;
            const it = items[idx];
            counter.textContent = `${idx + 1} / ${items.length}`;
            openLink.href = it.href;
            markStrip();
            modal.classList.add("loading");
            mediaWrap.innerHTML = "";
            const m = await resolveMedia(it.id);
            if (!open || items[idx] !== it) return;
            setMedia(m);
            const nxt = items[(idx + 1) % items.length];
            if (nxt) resolveMedia(nxt.id).then((mm) => { if (mm && mm.type === "image") new Image().src = mm.url; });
        }
        const step = (d) => show(idx + d);
        const openFrom = (id) => {
            items = collect();
            idx = Math.max(0, items.findIndex((x) => x.id === id));
            open = true;
            modal.classList.add("open");
            document.documentElement.style.overflow = "hidden";
            buildStrip();
            show(idx);
        };
        const close = () => { open = false; modal.classList.remove("open"); document.documentElement.style.overflow = ""; mediaWrap.innerHTML = ""; };

        modal.querySelector(".r34-v-close").addEventListener("click", close);
        modal.querySelector(".r34-v-prev").addEventListener("click", () => step(-1));
        modal.querySelector(".r34-v-next").addEventListener("click", () => step(1));
        stage.addEventListener("click", (e) => { if (e.target === stage) close(); });
        strip.addEventListener("click", (e) => { const c = e.target.closest(".r34-strip-cell"); if (c) show(+c.dataset.i); });

        const stripBtn = modal.querySelector(".r34-v-strip-btn");
        const setStrip = (on) => { modal.classList.toggle("r34-nostrip", !on); stripBtn.classList.toggle("is-active", on); try { localStorage.setItem("r34-strip", on ? "1" : "0"); } catch (e) {} };
        stripBtn.addEventListener("click", () => setStrip(modal.classList.contains("r34-nostrip")));
        setStrip((() => { try { return localStorage.getItem("r34-strip") !== "0"; } catch (e) { return true; } })());

        let wheelLock = false;
        stage.addEventListener("wheel", (e) => {
            if (Math.abs(e.deltaY) < 4) return;
            e.preventDefault();
            if (wheelLock) return;
            wheelLock = true; setTimeout(() => (wheelLock = false), 320);
            step(e.deltaY > 0 ? 1 : -1);
        }, { passive: false });
        let tsx = 0, tsy = 0;
        stage.addEventListener("touchstart", (e) => { if (e.touches.length === 1) { tsx = e.touches[0].clientX; tsy = e.touches[0].clientY; } }, { passive: true });
        stage.addEventListener("touchend", (e) => { const t = e.changedTouches[0], dx = t.clientX - tsx, dy = t.clientY - tsy; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) step(dx < 0 ? 1 : -1); }, { passive: true });
        document.addEventListener("keydown", (e) => {
            if (!open) return;
            if (e.key === "Escape") close();
            else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); step(1); }
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); step(-1); }
        });

        grid.addEventListener("click", (e) => {
            const card = e.target.closest(".r34-card");
            if (!card || e.ctrlKey || e.metaKey || e.button !== 0) return;
            e.preventDefault();
            openFrom(card.dataset.id);
        });
    }

    // ===================================================================== //
    //  Post view (s=view) — dark restyle + centred media                    //
    // ===================================================================== //
    function setupPostView() {
        if (document.getElementById("r34-pbar")) return;
        const main = document.querySelector("#right-col") || document.querySelector("#content > .content") || document.querySelector("#content");
        const sidebar = document.querySelector("#content > .sidebar") || document.querySelector(".sidebar");
        const media = document.querySelector("#image, #gelcomVideoPlayer, video");
        if (media) media.classList.add("r34-pv-media");
        if (!main) return;

        // blurred backdrop behind the media to fill the side gaps
        const mflex = media && media.closest(".flexi");
        if (mflex) {
            mflex.classList.add("r34-pv-stage");
            const bsrc = media.tagName === "IMG" ? (media.currentSrc || media.src) : (media.getAttribute("poster") || "");
            if (bsrc) { const blur = el("div", { className: "r34-pv-blur" }); blur.style.backgroundImage = `url("${bsrc}")`; mflex.insertBefore(blur, mflex.firstChild); }
        }

        const allSb = (sel) => (sidebar ? Array.from(sidebar.querySelectorAll(sel)) : []);
        const favLink = allSb("a").find((a) => /addFav\(/.test(a.getAttribute("onclick") || ""));
        const voteLink = allSb("a").find((a) => /post_vote\(/.test(a.getAttribute("onclick") || ""));
        const origLink = (sidebar && sidebar.querySelector(".r34-pv-original")) || allSb("a").find((a) => /\/images\//.test(a.href) || /original image/i.test(a.textContent));
        const score = ((sidebar && sidebar.querySelector('[id^="psc"]'))?.textContent || "").trim();
        const statItems = allSb("#stats li").map((li) => li.textContent.replace(/\s+/g, " ").trim());

        // ---------- top action bar ----------
        const bar = el("div", { id: "r34-pbar" });
        const left = el("div", { className: "r34-pbar-grp" });
        const right = el("div", { className: "r34-pbar-grp" });

        const prev = document.querySelector("#prev_search_link");
        const next = document.querySelector("#next_search_link");
        if (prev) { prev.className = "r34-pbar-btn r34-pbar-nav"; prev.innerHTML = ICON.prev + "<span>Prev</span>"; left.appendChild(prev); }
        if (next) { next.className = "r34-pbar-btn r34-pbar-nav"; next.innerHTML = "<span>Next</span>" + ICON.next; left.appendChild(next); } // keep prev+next together

        // tags menu (the post's related tags, grouped + colour-coded) + a Details footer
        const tagCount = sidebarGroups.reduce((n, g) => n + g.tags.length, 0);
        if (tagCount) {
            const wrap = el("div", { className: "r34-menu-wrap" });
            const btn = el("button", { type: "button", className: "r34-pbar-btn" }, `${ICON.tag}<span>Tags</span><b>${tagCount}</b>${ICON.chevron}`);
            const panel = el("div", { className: "r34-menu", hidden: true });
            sidebarGroups.forEach((g) => {
                panel.appendChild(el("div", { className: "r34-menu-glabel" }, g.label));
                const chips = el("div", { className: "r34-menu-chips" });
                g.tags.forEach((t) => {
                    const chip = el("a", { className: "r34-tagchip", href: navHref("?page=post&s=list&tags=" + encodeURIComponent(t.name)) });
                    chip.style.setProperty("--tc", TAG_TYPE_COLOR[t.type] || "#9aa0a8");
                    chip.innerHTML = `<span></span>${t.count ? `<i>${fmtCount(t.count)}</i>` : ""}`;
                    chip.firstChild.textContent = (t.label || t.name).replace(/_/g, " ");
                    chips.appendChild(chip);
                });
                panel.appendChild(chips);
            });
            // move the native stats / option blocks into a Details section (keeps Edit/Report/Source/etc. working)
            const detail = allSb("#stats").concat(allSb(".link-list"));
            if (detail.length) {
                panel.appendChild(el("div", { className: "r34-menu-glabel" }, "Details"));
                detail.forEach((d) => panel.appendChild(d));
            }
            btn.addEventListener("click", (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });
            document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) panel.hidden = true; });
            wrap.append(btn, panel);
            left.appendChild(wrap);
        }

        if (voteLink) { voteLink.className = "r34-pbar-btn r34-pbar-vote"; voteLink.innerHTML = `▲ <b>${score || 0}</b>`; voteLink.title = "Upvote"; right.appendChild(voteLink); }
        if (favLink) { favLink.className = "r34-pbar-btn"; favLink.innerHTML = ICON.heart + "<span>Favorite</span>"; right.appendChild(favLink); }
        if (origLink) { origLink.className = "r34-pbar-btn r34-pbar-dl"; origLink.innerHTML = ICON.download + "<span>Original</span>"; right.appendChild(origLink); }

        bar.append(left, right);
        main.insertBefore(bar, main.firstChild);

        // ---------- modern resized banner ----------
        const resized = document.querySelector("#resized_notice");
        if (resized) resized.classList.add("r34-resized");

        // ---------- meta strip under the image ----------
        const findStat = (re) => (statItems.find((s) => re.test(s)) || "").replace(re, "").trim();
        const metaBits = [findStat(/^Rating:\s*/i), findStat(/^Size:\s*/i), findStat(/^Posted:\s*/i).split(" by ")[0]].filter(Boolean);
        if (metaBits.length) {
            const meta = el("div", { className: "r34-pmeta" });
            meta.innerHTML = metaBits.map((b) => `<span>${b}</span>`).join("");
            const mf = media && media.closest(".flexi");          // .flexi is a native flexbox → insert AFTER it, not inside
            if (mf && mf.parentNode) mf.after(meta); else main.appendChild(meta);
        }

        // ---------- comments ----------
        renderComments(document.querySelector("#comment-list"));

        if (sidebar) sidebar.style.display = "none";
    }

    // ===================================================================== //
    //  Reusable modern comment list (post pages + comment pages)            //
    // ===================================================================== //
    function renderComments(listEl) {
        if (!listEl || listEl.dataset.r34done) return;
        const nodes = Array.from(listEl.querySelectorAll('div[id^="c"]')).filter((d) => /^c\d+$/.test(d.id));
        if (!nodes.length) return;
        listEl.dataset.r34done = "1";
        const total = (listEl.textContent.match(/(\d+)\s+comments?/) || [])[1] || nodes.length;

        const wrap = el("div", { className: "r34-comments" });
        wrap.appendChild(el("div", { className: "r34-comments-head" }, `${ICON.chat}<b>${total}</b> comments`));
        const list = el("div", { className: "r34-comment-list" });
        for (const c of nodes) {
            const col1 = c.querySelector(".col1");
            const col2 = c.querySelector(".col2");
            if (!col2) continue;
            const authorA = col1 && col1.querySelector('a[href*="uname="]');
            const author = authorA ? authorA.textContent.trim() : "anon";
            const href = authorA ? authorA.href : "#";
            const date = (((col1 && col1.textContent) || "").match(/Posted on ([\d-]+ [\d:]+)/) || [])[1] || "";
            const score = (c.querySelector('[id^="sc"]')?.textContent || "0").trim();

            const card = el("div", { className: "r34-comment" });
            const ava = el("a", { className: "r34-comment-ava", href }); ava.textContent = (author[0] || "?").toUpperCase();
            const body = el("div", { className: "r34-comment-main" });
            const head = el("div", { className: "r34-comment-head" });
            const au = el("a", { className: "r34-comment-author", href }); au.textContent = author;
            const dt = el("span", { className: "r34-comment-date" }); dt.textContent = date;
            const sc = el("span", { className: "r34-comment-score" }, `▲ ${score}`);
            head.append(au, dt, sc);
            const text = el("div", { className: "r34-comment-text" });
            while (col2.firstChild) text.appendChild(col2.firstChild); // move body (keeps links/formatting)
            const actions = el("div", { className: "r34-comment-actions" });
            const voteA = col1 && Array.from(col1.querySelectorAll("a")).find((a) => /vote\(/.test(a.getAttribute("onclick") || ""));
            const reportA = col1 && col1.querySelector('a[id^="rcl"]');
            if (voteA) { voteA.className = "r34-c-act"; voteA.textContent = "▲ Upvote"; actions.appendChild(voteA); }
            if (reportA) { reportA.className = "r34-c-act"; reportA.textContent = "Report"; actions.appendChild(reportA); }
            body.append(head, text);
            if (actions.children.length) body.appendChild(actions);
            card.append(ava, body);
            list.appendChild(card);
        }
        wrap.appendChild(list);
        listEl.textContent = "";
        listEl.appendChild(wrap);
    }

    // ===================================================================== //
    //  Home — modern search hero (replaces the sparse #static-index)         //
    // ===================================================================== //
    function setupHome() {
        if (document.getElementById("r34-home")) return;
        const idx = document.querySelector("#static-index");
        const logoImg = idx && idx.querySelector(".index-header img");
        const logoSrc = logoImg ? logoImg.src : "";
        const stats = (document.body.textContent.match(/Serving\s+([\d,]+)\s+posts/) || [])[1] || "";
        const hero = el("div", { id: "r34-home" });
        hero.innerHTML = `
            <div class="r34-home-inner">
                ${logoSrc ? `<img class="r34-home-img" src="${logoSrc}" alt="Rule 34">` : `<div class="r34-home-logo">Rule <b>34</b></div>`}
                <div class="r34-home-tag">If it exists, there’s porn of it.</div>
                <div class="r34-home-searchbox">
                    <div class="r34-home-field">${ICON.search}<input class="r34-home-input" type="text" placeholder="Search posts by tag…" autocomplete="off" spellcheck="false"></div>
                    <div class="r34-home-drop" hidden></div>
                </div>
                <div class="r34-home-chips"></div>
                <div class="r34-home-links">
                    <a href="${navHref("?page=post&s=list&tags=all")}">${ICON.grid}<span>All posts</span></a>
                    <a href="${navHref("?page=post&s=random")}">${ICON.dice}<span>Random</span></a>
                    <a href="${navHref("?page=post&s=list&tags=video")}">${ICON.video}<span>Videos</span></a>
                    <a href="${navHref("?page=comment&s=list")}">${ICON.chat}<span>Comments</span></a>
                </div>
                ${stats ? `<div class="r34-home-stats">Serving <b>${stats}</b> posts</div>` : ""}
            </div>`;
        if (idx) idx.replaceWith(hero); else document.body.appendChild(hero);

        // Google-style inline autocomplete dropdown (no modal on the home)
        const sbox = hero.querySelector(".r34-home-searchbox");
        const input = hero.querySelector(".r34-home-input");
        const drop = hero.querySelector(".r34-home-drop");
        let opts = [], hsel = -1;
        const homeCommit = (tags) => {
            const u = new URL(location.origin + "/index.php");
            u.searchParams.set("page", "post"); u.searchParams.set("s", "list");
            u.searchParams.set("tags", tags.length ? tags.join(" ") : "all");
            location.href = u.href;
        };
        const acceptTag = (tag) => { const t = input.value.split(/\s+/).filter(Boolean); if (t.length) t[t.length - 1] = tag; else t.push(tag); homeCommit(t); };
        const renderDrop = () => {
            const q = ((input.value.match(/(\S*)$/) || [])[1] || "").toLowerCase().replace(/\s+/g, "_");
            opts = []; hsel = -1;
            if (q.length >= 1) {
                const starts = [], incl = [];
                for (const t of tagStore.all()) { const lt = t.toLowerCase(); if (lt.startsWith(q)) starts.push(t); else if (lt.includes(q)) incl.push(t); }
                opts = [...starts, ...incl].slice(0, 10).map((t) => ({ tag: t }));
            } else {
                try { opts = JSON.parse(localStorage.getItem("r34-recent") || "[]").filter((e) => e && e.q && e.url).slice(0, 8).map((e) => ({ recent: true, q: e.q, url: e.url })); } catch (e) {}
            }
            if (!opts.length) { drop.hidden = true; return; }
            drop.innerHTML = "";
            opts.forEach((o) => {
                const row = el("button", { type: "button", className: "r34-home-opt" }, `${ICON.search}<span></span>`);
                row.querySelector("span").textContent = (o.recent ? o.q : o.tag).replace(/_/g, " ");
                if (o.tag) row.style.setProperty("--tc", tagColor(o.tag));
                drop.appendChild(row);
            });
            drop.hidden = false;
        };
        const moveSel = (d) => { if (drop.hidden || !opts.length) return; hsel = (hsel + d + opts.length) % opts.length; [...drop.children].forEach((c, i) => c.classList.toggle("sel", i === hsel)); };
        input.addEventListener("input", renderDrop);
        input.addEventListener("focus", renderDrop);
        drop.addEventListener("mousedown", (e) => { const b = e.target.closest(".r34-home-opt"); if (!b) return; e.preventDefault(); const o = opts[[...drop.children].indexOf(b)]; if (!o) return; if (o.recent) location.href = o.url; else acceptTag(o.tag); });
        input.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); moveSel(1); }
            else if (e.key === "ArrowUp") { e.preventDefault(); moveSel(-1); }
            else if (e.key === "Escape") { drop.hidden = true; }
            else if (e.key === "Enter") {
                e.preventDefault();
                const o = hsel >= 0 ? opts[hsel] : null;
                if (o && o.recent) location.href = o.url;
                else if (o) acceptTag(o.tag);
                else homeCommit(input.value.split(/\s+/).filter(Boolean));
            }
        });
        document.addEventListener("click", (e) => { if (!sbox.contains(e.target)) drop.hidden = true; });
        setTimeout(() => input.focus(), 80);

        const chips = hero.querySelector(".r34-home-chips");
        let recents = [];
        try { recents = JSON.parse(localStorage.getItem("r34-recent") || "[]").filter((e) => e && e.url).slice(0, 7); } catch (e) {}
        const quick = recents.length
            ? recents.map((r) => ({ label: (r.q || "all").replace(/_/g, " "), url: r.url }))
            : ["video", "animated", "ai_generated", "comic", "1girls", "1boy"].map((t) => ({ label: t.replace(/_/g, " "), url: navHref("?page=post&s=list&tags=" + encodeURIComponent(t)) }));
        if (quick.length) {
            chips.append(el("span", { className: "r34-home-chips-lbl" }, recents.length ? "Recent searches" : "Popular"));
            quick.forEach((q) => { const c = el("a", { className: "r34-home-chip", href: q.url }); c.textContent = q.label; chips.append(c); });
        }
    }

    // generic infinite scroll for native paginated pages (tags / artists / comments)
    function listInfinite(appendFromDoc, parent) {
        let url = nextFrom(location.href, document);
        let loading = false, done = false;
        const status = makeStatus();
        const sentinel = el("div", { id: "r34-sentinel" });
        (parent || document.querySelector("#content") || document.body).append(status, sentinel);
        const nearBottom = () => sentinel.getBoundingClientRect().top <= window.innerHeight + 1600;
        async function loadMore() {
            if (loading || done || !url) return;
            loading = true; setStatus(status, "loading", "Loading more…");
            try {
                while (!done && nearBottom()) {
                    const res = await fetch(url, { credentials: "include" });
                    if (!res.ok) throw new Error(res.status);
                    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
                    const n = appendFromDoc(doc) || 0;
                    if (!n) { done = true; break; }   // empty page = real end
                    url = nextFrom(url, doc);
                }
                setStatus(status, done ? "done" : "", done ? "You’re all caught up" : "");
            } catch (e) { setStatus(status, "error", "Couldn’t load — scroll to retry"); } finally { loading = false; }
        }
        watchScroll(sentinel, loadMore);
    }

    // ===================================================================== //
    //  Comments feed (page=comment&s=list) — grouped by post                 //
    // ===================================================================== //
    function buildCommentCard(g) {
        const thumbA = g.querySelector(".col1 a");
        const img = g.querySelector(".col1 img");
        const card = el("div", { className: "r34-rc" });
        if (img) {
            const a = el("a", { className: "r34-rc-thumb", href: thumbA ? thumbA.href : "#" });
            const blur = el("div", { className: "r34-cfeed-blur" });
            blur.style.backgroundImage = `url("${img.src}")`;             // fast thumb for the blur fill
            const im = el("img", { loading: "lazy", alt: "" });
            const sample = sampleUrl(img.src);                             // crisp sample for the actual preview
            let tried = sample === img.src;
            im.addEventListener("error", () => { if (!tried) { tried = true; im.src = img.src; } });
            im.src = sample;
            a.append(blur, im);
            card.appendChild(a);
        }
        const main = el("div", { className: "r34-rc-main" });

        const header = g.querySelector(".col2 .header");
        const rating = ((header && header.textContent.match(/Rating\s*([A-Za-z]+)/)) || [])[1] || "";
        const score = (g.querySelector('[id^="psc"]')?.textContent || "").trim();
        const comments = Array.from(g.querySelectorAll('.response-list .post[id^="c"]'));
        const head = el("div", { className: "r34-rc-head" });
        head.innerHTML =
            (rating ? `<span class="r34-rc-badge">${rating}</span>` : "") +
            (score ? `<span class="r34-rc-score">▲ ${score}</span>` : "") +
            `<span class="r34-rc-count">${ICON.chat}${comments.length}</span>`;
        if (thumbA) { const v = el("a", { className: "r34-rc-view", href: thumbA.href }, "View post →"); head.appendChild(v); }
        main.appendChild(head);

        const tagLinks = Array.from(g.querySelectorAll(".col2 .tags a")).slice(0, 12);
        if (tagLinks.length) {
            const tags = el("div", { className: "r34-rc-tags" });
            tagLinks.forEach((ta) => {
                const li = ta.closest('[class*="tag-type-"]');
                const type = (li && (li.className.match(/tag-type-([a-z]+)/) || [])[1]) || "general";
                const chip = el("a", { className: "r34-rc-tag", href: ta.href });
                chip.style.setProperty("--tc", TAG_TYPE_COLOR[type] || "#9aa0a8");
                chip.textContent = ta.textContent.trim().replace(/_/g, " ");
                tags.appendChild(chip);
            });
            main.appendChild(tags);
        }

        const thread = el("div", { className: "r34-rc-thread" });
        for (const c of comments) {
            const authorA = c.querySelector(".author a[href*='uname='], .author h6 a");
            const author = authorA ? authorA.textContent.trim() : "anon";
            const date = (c.querySelector(".author .date")?.textContent || "").trim();
            const bodyEl = c.querySelector(".content .body, .body");
            const cm = el("div", { className: "r34-rc-comment" });
            const ava = el("div", { className: "r34-rc-ava" }, (author[0] || "?").toUpperCase());
            const cb = el("div", { className: "r34-rc-cbody" });
            const ch = el("div", { className: "r34-rc-chead" });
            const au = el("a", { className: "r34-rc-author", href: authorA ? authorA.href : "#" }); au.textContent = author;
            const dt = el("span", { className: "r34-rc-date" }); dt.textContent = date;
            ch.append(au, dt);
            const tx = el("div", { className: "r34-rc-text" });
            if (bodyEl) while (bodyEl.firstChild) tx.appendChild(bodyEl.firstChild);
            cb.append(ch, tx);
            cm.append(ava, cb);
            thread.appendChild(cm);
        }
        main.appendChild(thread);
        card.appendChild(main);
        return card;
    }

    function setupCommentsPage() {
        if (document.querySelector(".r34-cfeed")) return;
        const list = document.querySelector("#comment-list");
        if (!list) return;
        const groups = Array.from(list.querySelectorAll('.post[id^="p"]'));
        if (!groups.length) return;
        const wrap = el("div", { className: "r34-comments" });
        wrap.appendChild(el("div", { className: "r34-comments-head" }, `${ICON.chat}<b>Recent</b> comments`));
        const feed = el("div", { className: "r34-cfeed" });
        groups.forEach((g) => feed.appendChild(buildCommentCard(g)));
        wrap.appendChild(feed);
        list.textContent = "";
        list.appendChild(wrap);
        listInfinite((doc) => {
            const more = Array.from(doc.querySelectorAll('#comment-list .post[id^="p"]'));
            more.forEach((g) => feed.appendChild(buildCommentCard(g)));
            return more.length;
        }, document.querySelector("#content"));
    }

    // ===================================================================== //
    //  Table pages (tags / artists / aliases / pools) — infinite scroll      //
    // ===================================================================== //
    function setupTablePage() {
        if (document.getElementById("r34-sentinel")) return;
        const tbody = document.querySelector("table.highlightable tbody");
        if (!tbody) return;
        listInfinite((doc) => {
            const rows = Array.from(doc.querySelectorAll("table.highlightable tbody tr")).filter((tr) => !tr.querySelector("th"));
            rows.forEach((tr) => tbody.appendChild(tr));   // appendChild adopts the row from the parsed doc
            return rows.length;
        }, document.querySelector("#content"));
    }

    // ===================================================================== //
    //  Styles                                                               //
    // ===================================================================== //
    function injectCss() {
        return `
        :root { --r34-accent: ${ACCENT}; --r34-grad: linear-gradient(135deg, #4f9a30, ${ACCENT}); }

        /* ---------------- dark base ---------------- */
        html.r34, html.r34 body { background: #0f0f12 !important; color: #d9d9de !important; }
        html.r34 body { max-width: none !important; width: auto !important; }
        html.r34 a, html.r34 a:link { color: #9bb8ff; text-decoration: none; }
        html.r34 a:hover { color: var(--r34-accent); }
        html.r34 input, html.r34 select, html.r34 textarea { background: #202027 !important; color: #e7e7ec !important; border: 1px solid #34343e !important; border-radius: 8px; }
        html.r34 input:focus, html.r34 textarea:focus, html.r34 select:focus { outline: none; border-color: var(--r34-accent) !important; }
        html.r34 input[type="radio"], html.r34 input[type="checkbox"] { accent-color: var(--r34-accent); width: 16px; height: 16px; background: none !important; border: none !important; vertical-align: middle; }
        html.r34 ::-webkit-scrollbar { width: 12px; height: 12px; }
        html.r34 ::-webkit-scrollbar-thumb { background: #2c2c35; border-radius: 8px; border: 3px solid #0f0f12; }
        html.r34 ::-webkit-scrollbar-thumb:hover { background: #3a3a45; }

        /* ---------------- header → grouped topbar ---------------- */
        html.r34 #header { position: sticky; top: 0; z-index: 900; margin: 0 !important; padding: 0 !important;
            background: rgba(14,14,17,.92); backdrop-filter: blur(14px) saturate(160%); -webkit-backdrop-filter: blur(14px) saturate(160%); border-bottom: 1px solid #24242c; }
        html.r34 #site-title, html.r34 #navbar, html.r34 #subnavbar, html.r34 #header .tlabel,
        html.r34 #displayOptsLink, html.r34 #displayOptions { display: none !important; }
        #r34-bar { display: flex; align-items: center; gap: 12px; width: 90%; max-width: 90%; margin: 0 auto; box-sizing: border-box; padding: 9px 0; flex-wrap: wrap; }
        .r34-logo { flex: 0 0 auto; font: 800 19px/1 system-ui, sans-serif; color: #f0f0f4 !important; text-decoration: none !important; }
        .r34-logo b { color: var(--r34-accent); }
        .r34-nav { display: flex; align-items: center; gap: 2px; flex: 1 1 auto; flex-wrap: wrap; }
        .r34-nav-top { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: none; background: none; border-radius: 10px; cursor: pointer; font: 600 13px system-ui, sans-serif; color: #c8c8d0 !important; text-decoration: none !important; white-space: nowrap; transition: background .14s, color .14s; }
        .r34-nav-top:hover, .r34-nav-top:hover:visited { background: #24242c; color: #fff !important; }
        .r34-nav-top:visited { color: #c8c8d0 !important; }
        .r34-nav-top svg { width: 15px; height: 15px; opacity: .75; }
        .r34-nav-top .r34-caret svg { width: 13px; height: 13px; opacity: .6; transition: transform .18s; }
        .r34-nav-top.is-current { background: color-mix(in srgb, var(--r34-accent) 15%, #1c1c22); color: #fff !important; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--r34-accent) 42%, transparent); }
        .r34-nav-top.is-current svg { color: var(--r34-accent); opacity: 1; }
        .r34-nav-group { position: relative; }
        .r34-nav-group:hover > .r34-nav-top, .r34-nav-group.open > .r34-nav-top { background: #24242c; color: #fff !important; }
        .r34-nav-group:hover > .r34-nav-top .r34-caret svg, .r34-nav-group.open > .r34-nav-top .r34-caret svg { transform: rotate(180deg); }
        .r34-nav-group::after { content: ""; position: absolute; top: 100%; left: 0; right: 0; height: 10px; }
        .r34-nav-panel { position: absolute; top: calc(100% + 8px); left: 0; min-width: 232px; padding: 8px; background: #16161c; border: 1px solid #2a2a33; border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,.6); display: none; flex-direction: column; gap: 2px; z-index: 50; animation: r34pop .16s ease; }
        .r34-nav-group:hover .r34-nav-panel, .r34-nav-group.open .r34-nav-panel { display: flex; }
        .r34-nav-group:last-of-type .r34-nav-panel { left: auto; right: 0; }
        @keyframes r34pop { from { opacity: 0; transform: translateY(-6px); } }
        .r34-nav-item { display: flex; align-items: center; gap: 11px; padding: 8px 10px; border-radius: 10px; text-decoration: none !important; color: #ededf2 !important; transition: background .12s; }
        .r34-nav-item:visited { color: #ededf2 !important; }
        .r34-nav-item:hover { background: #23232c; color: #fff !important; }
        .r34-nav-ico { flex: 0 0 auto; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 9px; background: #20202a; border: 1px solid #2e2e38; color: #c9c9d2; }
        .r34-nav-ico svg { width: 16px; height: 16px; }
        .r34-nav-item:hover .r34-nav-ico { background: color-mix(in srgb, var(--r34-accent) 22%, #20202a); border-color: color-mix(in srgb, var(--r34-accent) 50%, #2e2e38); color: #fff; }
        .r34-nav-item b { font: 600 13px system-ui, sans-serif; }
        .r34-nav-sep { height: 1px; background: #24242c; margin: 5px 4px; }
        .r34-bar-right { margin-left: auto; flex: 0 0 auto; display: flex; align-items: center; gap: 8px; }
        .r34-search { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid #2a2a33; background: #1a1a20; color: #c8c8d0; border-radius: 11px; cursor: pointer; font: 600 13px system-ui, sans-serif; }
        .r34-search:hover { border-color: var(--r34-accent); color: #fff; }
        .r34-search svg { width: 16px; height: 16px; }
        .r34-search kbd { font: 600 11px system-ui, sans-serif; background: #2a2a33; border-radius: 5px; padding: 1px 6px; color: #9a9aa2; }
        .r34-acct { display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border-radius: 10px; color: #c8c8d0 !important; text-decoration: none !important; font: 600 13px system-ui, sans-serif; }
        .r34-acct:visited { color: #c8c8d0 !important; }
        .r34-acct:hover { background: #24242c; color: #fff !important; }
        .r34-acct svg { width: 16px; height: 16px; }

        /* ---------------- curated tag-search modal ---------------- */
        #r34-search { position: fixed; inset: 0; z-index: 2147483061; display: flex; align-items: flex-start; justify-content: center; padding: 9vh 16px 16px; background: rgba(0,0,0,.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
        #r34-search[hidden] { display: none; }
        .r34-s-box { width: min(820px, 95vw); max-height: 86vh; display: flex; flex-direction: column; background: #16161c; border: 1px solid #2a2a33; border-radius: 18px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,.65); animation: r34pop .16s ease; }
        .r34-s-head { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-bottom: 1px solid #24242c; }
        .r34-s-field-wrap { display: flex; align-items: center; gap: 10px; padding: 11px 14px; background: #0e0e12; border: 1px solid #2c2c35; border-radius: 12px; transition: border-color .14s ease, box-shadow .14s ease; }
        .r34-s-field-wrap:focus-within { border-color: color-mix(in srgb, var(--r34-accent) 60%, #2c2c35); box-shadow: 0 0 0 3px color-mix(in srgb, var(--r34-accent) 16%, transparent); }
        .r34-s-field-wrap > svg { width: 19px; height: 19px; color: #8a8a92; flex: 0 0 auto; }
        /* high-specificity so it beats the global "html.r34 input" border/bg (the inner ring) */
        html.r34 .r34-s-field, html.r34 .r34-s-field:focus { flex: 1; min-width: 0; background: none !important; border: 0 !important; outline: none !important; box-shadow: none !important; border-radius: 0 !important; color: #f0f0f4 !important; font-size: 15px !important; padding: 0 !important; }
        .r34-s-field::placeholder { color: #6a6a72; }
        .r34-s-kbd { flex: 0 0 auto; font: 600 11px system-ui, sans-serif; background: #2a2a33; color: #9a9aa2; border-radius: 5px; padding: 2px 7px; }
        .r34-s-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 0 2px; }
        .r34-lg { display: inline-flex; align-items: center; gap: 6px; font: 600 11px system-ui, sans-serif; color: #7a7a82; }
        .r34-lg i { width: 17px; height: 17px; display: inline-flex; align-items: center; justify-content: center; border-radius: 5px; font-style: normal; font-weight: 700; font-size: 11px; background: #20202a; color: #c8c8d0; }
        .r34-lg-i { background: color-mix(in srgb, var(--r34-accent) 22%, #20202a) !important; color: var(--r34-accent) !important; }
        .r34-lg-e { background: rgba(192,57,74,.22) !important; color: #ff8a96 !important; }
        .r34-lg-note { margin-left: auto; font: 500 11px system-ui, sans-serif; color: #56565e; }
        .r34-s-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 16px; border-bottom: 1px solid #24242c; }
        .r34-s-chips[hidden] { display: none; }
        .r34-s-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 4px 4px 11px; border-radius: 999px; font: 600 12px system-ui, sans-serif; color: color-mix(in srgb, var(--tc, #9aa0a8) 84%, #fff); background: color-mix(in srgb, var(--tc, #9aa0a8) 16%, #1c1c22); border: 1px solid color-mix(in srgb, var(--tc, #9aa0a8) 40%, #2c2c34); }
        .r34-s-chip.is-neg { opacity: .8; }
        .r34-s-chipx { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: none; background: none; color: inherit; cursor: pointer; opacity: .65; border-radius: 50%; }
        .r34-s-chipx:hover { opacity: 1; background: rgba(0,0,0,.3); } .r34-s-chipx svg { width: 12px; height: 12px; }
        .r34-s-body { display: flex; flex-direction: column; min-height: 0; padding: 8px 10px 12px; overflow: hidden; }
        .r34-s-tags { overflow-y: auto; min-height: 0; max-height: 46vh; }   /* tags scroll internally so recents stay visible */
        .r34-s-recents { flex: 0 0 auto; border-top: 1px solid #24242c; margin-top: 6px; padding-top: 4px; }
        .r34-s-run { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 12px; margin-bottom: 6px; border: 1px solid color-mix(in srgb, var(--r34-accent) 35%, #2c2c34); border-radius: 11px; background: color-mix(in srgb, var(--r34-accent) 12%, #16161c); color: #e7e7ec; cursor: pointer; font: 600 14px system-ui, sans-serif; text-align: left; }
        .r34-s-run svg { width: 16px; height: 16px; color: var(--r34-accent); } .r34-s-run b { color: var(--r34-accent); }
        .r34-tg-glabel { font: 700 10px system-ui, sans-serif; text-transform: uppercase; letter-spacing: .08em; color: #6a6a72; padding: 12px 8px 6px; }
        .r34-tg-list { display: flex; flex-direction: column; }
        .r34-tg { display: flex; align-items: center; gap: 9px; padding: 6px 10px; border-radius: 10px; transition: background .12s; }
        .r34-tg:hover { background: #1e1e26; }
        .r34-tg::before { content: ""; flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; background: var(--tc, #9aa0a8); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tc, #9aa0a8) 18%, transparent); }
        .r34-tg-acts { display: inline-flex; gap: 4px; flex: 0 0 auto; opacity: .42; transition: opacity .12s; }
        .r34-tg:hover .r34-tg-acts { opacity: 1; }
        .r34-tg-act { flex: 0 0 auto; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 7px; background: #22222b; color: #9a9aa2 !important; font: 700 12px system-ui, sans-serif; cursor: pointer; text-decoration: none !important; transition: background .12s, color .12s, transform .1s; }
        .r34-tg-act:hover { transform: translateY(-1px); }
        .r34-tg-act svg { width: 12px; height: 12px; }
        .r34-tg-wiki:hover { background: #34343e; color: #fff !important; }
        .r34-tg-inc:hover { background: var(--r34-accent); color: #06250a !important; }
        .r34-tg-exc:hover { background: #c0394a; color: #fff !important; }
        .r34-tg-name { flex: 1; min-width: 0; border: none; background: none; cursor: pointer; text-align: left; font: 600 14px system-ui, sans-serif; color: color-mix(in srgb, var(--tc, #9aa0a8) 82%, #fff); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color .1s; }
        .r34-tg-name:hover { color: #fff; text-decoration: underline; text-decoration-color: var(--tc, var(--r34-accent)); text-underline-offset: 3px; }
        .r34-tg-count { flex: 0 0 auto; font: 600 11px system-ui, sans-serif; color: #7a7a82; background: #18181e; padding: 3px 9px; border-radius: 999px; font-variant-numeric: tabular-nums; }
        .r34-s-empty { color: #8a8a92; font-size: 13px; padding: 16px 10px; }
        .r34-s-rhead { display: flex; align-items: center; justify-content: space-between; font: 700 10px system-ui, sans-serif; text-transform: uppercase; letter-spacing: .07em; color: #6a6a72; padding: 14px 8px 6px; }
        .r34-s-rclear { background: none; border: none; color: #8a8a92; cursor: pointer; font: 600 11px system-ui, sans-serif; }
        .r34-s-rclear:hover { color: var(--r34-accent); }
        .r34-s-rlist { display: flex; flex-direction: column; gap: 4px; max-height: 24vh; overflow-y: auto; }
        .r34-s-recent { display: flex; align-items: center; gap: 9px; width: 100%; padding: 8px 11px; border: 1px solid #24242c; border-radius: 10px; background: #1c1c22; color: #d9d9de; cursor: pointer; text-align: left; }
        .r34-s-recent:hover { border-color: #34343e; }
        .r34-s-recent svg { width: 14px; height: 14px; color: #7a7a82; flex: 0 0 auto; }
        .r34-s-recent-q { flex: 1; min-width: 0; font: 600 13px system-ui, sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .r34-s-foot { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-top: 1px solid #24242c; }
        .r34-s-hint { color: #6a6a72; font: 500 12px system-ui, sans-serif; }
        .r34-s-go { background: var(--r34-grad); color: #06250a; border: none; border-radius: 10px; padding: 9px 22px; font: 800 13px system-ui, sans-serif; cursor: pointer; }
        .r34-s-go:hover { filter: brightness(1.08); }
        .r34-s-reset { background: #202027; color: #e7e7ec; border: 1px solid #34343e; border-radius: 10px; padding: 9px 18px; font: 700 13px system-ui, sans-serif; cursor: pointer; }
        .r34-s-reset:hover { border-color: var(--r34-accent); }
        @media (max-width: 768px) {
            #r34-search { align-items: flex-end; padding: 0; }
            .r34-s-box { width: 100%; max-width: 100%; max-height: 90vh; border-radius: 18px 18px 0 0; animation: r34sheet .24s cubic-bezier(.2,.8,.3,1); }
            .r34-s-hint { display: none; }
        }
        @keyframes r34sheet { from { transform: translateY(100%); } }

        /* ---------------- layout (no sidebar on listing) ---------------- */
        html.r34-list #content { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
        html.r34-list #post-list { display: block; width: 90%; max-width: 90%; margin: 0 auto; box-sizing: border-box; padding: 16px 0 60px; }
        html.r34-list #post-list > .content { width: 100%; margin: 0 !important; padding: 0 !important; }
        html.r34-list #post-list > .sidebar { display: none !important; }
        html.r34 .postListSidebarRight { display: none !important; }
        html.r34 #top, html.r34 .a_list, html.r34 #pv_leaderboard, html.r34 ins[class^="eas"], html.r34 [id$="leaderboard"], html.r34 #prevLinkTmpl, html.r34 #nextLinkTmpl, html.r34 .postViewSidebarRight, html.r34 .postListSidebarRight, html.r34 .horizontalFlexWithMargins, html.r34 .verticalFlexWithMargins { display: none !important; }  /* ad bands/columns + prev/next preview templates */

        /* ---------------- masonry grid (per-page blocks, natural proportions) ---------------- */
        #r34-grid { display: block; }                 /* container: stacks one masonry grid per page */
        .r34-pagegrid { display: grid; grid-template-columns: repeat(var(--r34-cols, 3), minmax(0, 1fr)); column-gap: ${GAP}px; grid-auto-rows: 1px; align-items: start; }
        .r34-page-sec { margin: 0; }
        .r34-divider { display: flex; align-items: center; gap: 16px; margin: 26px 2px 22px; }
        .r34-divider-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, #2a2a33 18%, #2a2a33 82%, transparent); }
        .r34-divider-lbl { flex: 0 0 auto; font: 800 11px system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #8a8a92; background: #15151a; border: 1px solid #24242c; padding: 6px 14px; border-radius: 999px; white-space: nowrap; }
        .r34-card { position: relative; display: block; border-radius: 14px; overflow: hidden; background: #16161c; border: 1px solid #20202a; box-shadow: 0 6px 16px rgba(0,0,0,.35); transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
        .r34-card.r34-ld .r34-thumb { min-height: 200px; }
        .r34-card:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(0,0,0,.6); border-color: color-mix(in srgb, var(--r34-accent) 55%, #20202a); z-index: 2; }
        .r34-thumb { position: relative; overflow: hidden; line-height: 0; background: #0c0c0f; }
        .r34-thumb img { width: 100%; height: auto; display: block; transition: transform .3s ease; }
        .r34-card:hover .r34-thumb img { transform: scale(1.04); }
        .r34-badge-vid { position: absolute; top: 8px; left: 8px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(0,0,0,.6); color: #fff; backdrop-filter: blur(4px); }
        .r34-badge-vid svg { width: 13px; height: 13px; margin-left: 1px; }
        .r34-cmeta { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 6px; padding: 22px 10px 8px; background: linear-gradient(to top, rgba(0,0,0,.8), transparent); pointer-events: none; }
        .r34-cscore { display: inline-flex; align-items: center; gap: 3px; font: 700 12px system-ui, sans-serif; color: #fff; }
        .r34-cscore svg { width: 13px; height: 13px; color: var(--r34-accent); fill: var(--r34-accent); }
        .r34-crate { margin-left: auto; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 6px; font: 800 10px/1 system-ui, sans-serif; color: #fff; }
        .r34-rate-s { background: #3a9a4a; } .r34-rate-q { background: #c8902a; } .r34-rate-e { background: #c0394a; }

        /* ---------------- toolbar ---------------- */
        #r34-toolbar { display: flex; flex-direction: column; gap: 12px; padding: 2px 0 16px; text-align: left; }
        .r34-tb-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .r34-count { color: #9a9aa0; font-size: 13px; margin-right: auto; }
        .r34-count b { color: #e7e7ec; } .r34-count-q { color: color-mix(in srgb, var(--r34-accent) 80%, #fff); font-weight: 700; }
        .r34-sort { padding: 8px 10px !important; font-size: 13px; font-weight: 600; cursor: pointer; }
        .r34-seg { display: inline-flex; background: #1a1a20; border: 1px solid #2a2a33; border-radius: 10px; padding: 2px; }
        .r34-seg button { width: 34px; height: 30px; display: flex; align-items: center; justify-content: center; border: none; background: none; border-radius: 8px; color: #9a9aa2; cursor: pointer; }
        .r34-seg button svg { width: 16px; height: 16px; }
        .r34-seg button:hover { color: #fff; } .r34-seg button.on { background: var(--r34-grad); color: #06250a; }
        .r34-switch { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font: 600 13px system-ui, sans-serif; color: #c8c8d0; position: relative; }
        .r34-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
        .r34-switch-track { position: relative; width: 38px; height: 22px; border-radius: 999px; background: #33333d; transition: background .16s; flex: 0 0 auto; }
        .r34-switch-track::after { content: ""; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #c8c8d0; transition: transform .16s, background .16s; }
        .r34-switch input:checked + .r34-switch-track { background: var(--r34-accent); }
        .r34-switch input:checked + .r34-switch-track::after { transform: translateX(16px); background: #06250a; }
        .r34-tagrow { display: flex; flex-wrap: wrap; gap: 6px; }
        .r34-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 4px 4px 11px; border-radius: 999px; font: 600 12px system-ui, sans-serif; color: color-mix(in srgb, var(--tc, #9aa0a8) 84%, #fff); background: color-mix(in srgb, var(--tc, #9aa0a8) 16%, #1c1c22); border: 1px solid color-mix(in srgb, var(--tc, #9aa0a8) 40%, #2c2c34); }
        .r34-chip.is-neg { opacity: .82; }
        .r34-chipx { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: none; background: none; color: inherit; cursor: pointer; opacity: .65; border-radius: 50%; }
        .r34-chipx:hover { opacity: 1; background: rgba(0,0,0,.3); } .r34-chipx svg { width: 12px; height: 12px; }
        #r34-sentinel { height: 1px; }
        .r34-loadmore { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0; color: #9a9aa2; font: 600 13px system-ui, sans-serif; opacity: 0; height: 0; overflow: hidden; transition: opacity .18s ease; }
        .r34-loadmore.is-loading, .r34-loadmore.is-done, .r34-loadmore.is-error { opacity: 1; height: auto; padding: 28px 0; }
        .r34-spin { display: none; width: 20px; height: 20px; border: 2.5px solid #2c2c35; border-top-color: var(--r34-accent); border-radius: 50%; animation: r34spin .8s linear infinite; }
        .r34-loadmore.is-loading .r34-spin { display: inline-block; }
        .r34-loadmore.is-done { flex-direction: column; gap: 8px; padding: 46px 0 56px; }
        .r34-loadmore.is-done::before { content: "✓"; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; background: color-mix(in srgb, var(--r34-accent) 16%, #18181e); border: 1px solid color-mix(in srgb, var(--r34-accent) 40%, #2a2a33); color: var(--r34-accent); font: 700 23px system-ui, sans-serif; }
        .r34-loadmore.is-done .r34-loadmore-txt { font: 800 19px system-ui, sans-serif; color: #e0e0e6; }
        .r34-loadmore.is-done .r34-loadmore-txt::after { content: "That’s everything — you’ve reached the end"; display: block; margin-top: 5px; font: 500 13px system-ui, sans-serif; color: #6a6a72; }
        .r34-loadmore.is-error .r34-loadmore-txt { color: #e08a92; }

        /* ---------------- viewer ---------------- */
        #r34-viewer { position: fixed; inset: 0; z-index: 2147483000; display: none; overflow: hidden; background: rgba(8,8,10,.96); }
        #r34-viewer.open { display: block; }
        .r34-v-stage { position: absolute; top: 0; left: 0; right: 0; bottom: 96px; display: flex; align-items: center; justify-content: center; padding: 24px; }
        #r34-viewer.r34-nostrip .r34-v-stage { bottom: 0; }
        #r34-viewer.r34-nostrip .r34-v-strip { display: none; }
        .r34-v-media { max-width: 100%; max-height: 100%; display: flex; align-items: center; justify-content: center; }
        .r34-v-img, .r34-v-vid { max-width: calc(100vw - 48px); max-height: calc(100vh - 120px); width: auto; height: auto; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
        #r34-viewer.r34-nostrip .r34-v-img, #r34-viewer.r34-nostrip .r34-v-vid { max-height: calc(100vh - 48px); }
        .r34-v-fail { color: #c8c8d0; font: 600 15px system-ui, sans-serif; }
        .r34-v-spinner { position: absolute; width: 42px; height: 42px; border: 3px solid #2c2c35; border-top-color: var(--r34-accent); border-radius: 50%; animation: r34spin 1s linear infinite; opacity: 0; }
        #r34-viewer.loading .r34-v-spinner { opacity: 1; }
        @keyframes r34spin { to { transform: rotate(360deg); } }
        .r34-v-counter { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 5; color: #e7e7ec; font: 700 13px system-ui, sans-serif; background: rgba(0,0,0,.45); padding: 6px 12px; border-radius: 999px; }
        .r34-v-close, .r34-v-strip-btn, .r34-v-open, .r34-v-dl { position: absolute; top: 12px; z-index: 6; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border: 1px solid #2a2a33; background: rgba(20,20,26,.7); color: #d9d9de !important; border-radius: 50%; cursor: pointer; }
        .r34-v-close { right: 14px; } .r34-v-strip-btn { right: 62px; } .r34-v-dl { right: 110px; } .r34-v-open { right: 158px; }
        .r34-v-close:hover, .r34-v-strip-btn:hover, .r34-v-open:hover, .r34-v-dl:hover { border-color: var(--r34-accent); color: #fff !important; }
        .r34-v-strip-btn.is-active { color: var(--r34-accent) !important; border-color: var(--r34-accent); }
        .r34-v-close svg, .r34-v-strip-btn svg, .r34-v-open svg, .r34-v-dl svg { width: 18px; height: 18px; }
        .r34-v-nav { position: absolute; top: calc(50% - 48px); transform: translateY(-50%); z-index: 6; width: 48px; height: 64px; display: flex; align-items: center; justify-content: center; border: none; background: rgba(20,20,26,.55); color: #fff; border-radius: 12px; cursor: pointer; }
        .r34-v-nav:hover { background: var(--r34-grad); color: #06250a; } .r34-v-prev { left: 14px; } .r34-v-next { right: 14px; }
        .r34-v-strip { position: absolute; left: 0; right: 0; bottom: 0; height: 96px; display: flex; gap: 6px; align-items: center; padding: 8px 12px 12px; overflow-x: auto; overflow-y: hidden; background: rgba(12,12,15,.85); border-top: 1px solid #20202a; scrollbar-width: thin; scrollbar-color: #3a3a45 transparent; }
        .r34-v-strip::-webkit-scrollbar { height: 8px; }
        .r34-v-strip::-webkit-scrollbar-track { background: transparent; }
        .r34-v-strip::-webkit-scrollbar-thumb { background: #3a3a45; border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
        .r34-v-strip::-webkit-scrollbar-thumb:hover { background: #4a4a55; background-clip: padding-box; }
        .r34-strip-cell { flex: 0 0 auto; width: 72px; height: 72px; padding: 0; border: 2px solid transparent; border-radius: 8px; overflow: hidden; background: #0c0c0f; cursor: pointer; opacity: .55; transition: opacity .12s; }
        .r34-strip-cell img { width: 100%; height: 100%; object-fit: cover; }
        .r34-strip-cell:hover { opacity: .85; }
        .r34-strip-cell.active { opacity: 1; border-color: var(--r34-accent); }

        /* ---------------- post view (s=view): full-width image + action bar ---------------- */
        html.r34-view #content { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
        html.r34-view #content > .sidebar { display: none !important; }
        html.r34-view #content > .content, html.r34-view #right-col { width: 90% !important; max-width: 90% !important; margin: 0 auto !important; padding: 14px 0 70px !important; box-sizing: border-box; float: none !important; }
        html.r34-view .postListSidebarRight, html.r34-view #navlinksContainer { display: none !important; }
        /* media full-width, centred */
        html.r34-view #fit-to-screen, html.r34-view .flexi, html.r34-view #note-container { display: block !important; width: 100% !important; max-width: 100% !important; text-align: center; margin: 0 auto; }
        html.r34-view .r34-pv-media, html.r34-view #image { max-width: 100% !important; max-height: 85vh; height: auto !important; width: auto !important; border-radius: 12px; box-shadow: 0 16px 50px rgba(0,0,0,.5); }
        html.r34-view .fluid_video_wrapper { max-width: 100% !important; max-height: 85vh; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 16px 50px rgba(0,0,0,.5); }
        /* blurred backdrop fills the side gaps around the image */
        html.r34-view .r34-pv-stage { position: relative; overflow: hidden; border-radius: 14px; }
        html.r34-view .r34-pv-blur { position: absolute; inset: 0; z-index: 0; background-size: cover; background-position: center; filter: blur(48px) brightness(.42) saturate(1.25); transform: scale(1.18); pointer-events: none; }
        html.r34-view .r34-pv-stage > :not(.r34-pv-blur) { position: relative; z-index: 1; }
        /* action bar */
        #r34-pbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
        .r34-pbar-grp { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .r34-pbar-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border: 1px solid #2a2a33; background: #1a1a20; color: #d9d9de !important; border-radius: 11px; font: 600 13px system-ui, sans-serif; cursor: pointer; text-decoration: none !important; transition: border-color .12s, color .12s, background .12s; }
        .r34-pbar-btn:visited { color: #d9d9de !important; }
        .r34-pbar-btn:hover { border-color: var(--r34-accent); color: #fff !important; }
        .r34-pbar-btn svg { width: 16px; height: 16px; }
        .r34-pbar-btn b { color: var(--r34-accent); }
        .r34-pbar-vote b { color: #fff; }
        .r34-pbar-dl { background: var(--r34-grad); color: #06250a !important; border: none; font-weight: 800; }
        .r34-pbar-dl:hover, .r34-pbar-dl:visited { filter: brightness(1.08); color: #06250a !important; }
        /* tags menu (the post's related tags) + Details footer */
        .r34-menu-wrap { position: relative; }
        .r34-menu { position: absolute; top: calc(100% + 8px); left: 0; z-index: 60; width: min(540px, 92vw); max-height: 64vh; overflow-y: auto; padding: 12px; background: #16161c; border: 1px solid #2a2a33; border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,.6); animation: r34pop .16s ease; scrollbar-width: thin; }
        .r34-menu[hidden] { display: none; }
        .r34-menu-glabel { font: 700 10px system-ui, sans-serif; text-transform: uppercase; letter-spacing: .08em; color: #6a6a72; margin: 12px 2px 7px; }
        .r34-menu-glabel:first-child { margin-top: 2px; }
        .r34-menu-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .r34-tagchip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px; font: 600 12px system-ui, sans-serif; text-decoration: none !important; color: color-mix(in srgb, var(--tc, #9aa0a8) 84%, #fff); background: color-mix(in srgb, var(--tc, #9aa0a8) 15%, #1c1c22); border: 1px solid color-mix(in srgb, var(--tc, #9aa0a8) 38%, #2c2c34); transition: transform .1s ease, filter .1s ease; }
        .r34-tagchip:hover { transform: translateY(-1px); filter: brightness(1.12); }
        .r34-tagchip i { font-style: normal; font-size: 10px; color: #7a7a82; }
        .r34-menu #stats, .r34-menu .link-list { background: none !important; border: none !important; padding: 0 !important; margin: 0 0 6px !important; }
        .r34-menu h5 { font: 700 10px system-ui, sans-serif; text-transform: uppercase; letter-spacing: .08em; color: #6a6a72; margin: 10px 2px 5px; }
        .r34-menu #stats ul, .r34-menu .link-list ul { list-style: none; margin: 0; padding: 0; }
        .r34-menu #stats li, .r34-menu .link-list li { padding: 3px 2px; color: #c8c8d0; font-size: 13px; }
        .r34-menu [id^="psc"] { color: var(--r34-accent); font-weight: 800; }
        /* modern resized / status banner */
        html.r34-view .r34-resized, html.r34-view .status-notice { background: #15151a !important; border: 1px solid #24242c !important; border-radius: 11px !important; padding: 9px 14px !important; color: #9a9aa2 !important; font: 500 13px system-ui, sans-serif !important; text-align: center; margin: 0 0 12px !important; }
        html.r34-view .status-notice a { color: var(--r34-accent) !important; font-weight: 600; }
        html.r34-view .r34-pv-original { display: inline-flex !important; }
        html.r34-view .r34-pv-original svg { width: 16px; height: 16px; }
        /* meta strip under the image */
        .r34-pmeta { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; margin-top: 14px; }
        .r34-pmeta span { font: 600 12px system-ui, sans-serif; color: #c8c8d0; background: #1a1a20; border: 1px solid #24242c; padding: 4px 11px; border-radius: 999px; }

        /* ---------------- reusable comments ---------------- */
        html.r34-view #post-comments, html.r34-view #comment-list { width: 100% !important; max-width: none !important; margin: 0 !important; }
        .r34-comments { max-width: none; margin: 30px 0 0; }
        .r34-comments-head { display: flex; align-items: center; gap: 8px; font: 700 15px system-ui, sans-serif; color: #e7e7ec; margin-bottom: 14px; }
        .r34-comments-head svg { width: 18px; height: 18px; color: var(--r34-accent); } .r34-comments-head b { color: var(--r34-accent); }
        .r34-comment-list { display: flex; flex-direction: column; gap: 10px; }
        .r34-comment { display: flex; gap: 12px; padding: 14px; background: #15151a; border: 1px solid #20202a; border-radius: 14px; }
        .r34-comment-ava { flex: 0 0 auto; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--r34-grad); color: #06250a !important; font: 800 16px system-ui, sans-serif; text-decoration: none !important; }
        .r34-comment-main { flex: 1; min-width: 0; }
        .r34-comment-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 5px; }
        .r34-comment-author { font: 700 13px system-ui, sans-serif; color: #9bb8ff !important; text-decoration: none !important; }
        .r34-comment-author:hover { color: var(--r34-accent) !important; }
        .r34-comment-date { font: 500 12px system-ui, sans-serif; color: #6a6a72; }
        .r34-comment-score { margin-left: auto; font: 700 12px system-ui, sans-serif; color: #8a8a92; background: #1c1c22; border: 1px solid #2a2a33; padding: 2px 9px; border-radius: 999px; }
        .r34-comment-text { color: #d4d4d9; font: 400 14px/1.55 system-ui, sans-serif; overflow-wrap: anywhere; }
        .r34-comment-text a { color: #9bb8ff; }
        .r34-comment-actions { display: flex; gap: 16px; margin-top: 9px; }
        .r34-c-act { font: 600 12px system-ui, sans-serif; color: #7a7a82 !important; text-decoration: none !important; cursor: pointer; }
        .r34-c-act:hover { color: var(--r34-accent) !important; }
        @media (max-width: 768px) {
            html.r34-view #content > .content, html.r34-view #right-col { width: 94% !important; max-width: 94% !important; padding: 12px 0 90px !important; }
            .r34-menu { width: min(92vw, 540px); }
        }

        /* ---------------- home: modern search hero ---------------- */
        html.r34-home #static-index { display: none !important; }
        #r34-home { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px 20px 90px; position: relative; overflow: visible; }
        #r34-home::before { content: ""; position: absolute; inset: 0; background: radial-gradient(ellipse 70% 55% at 50% -5%, color-mix(in srgb, var(--r34-accent) 16%, transparent), transparent 70%); pointer-events: none; }
        .r34-home-inner { position: relative; width: 100%; max-width: 680px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; }
        .r34-home-logo { font: 900 64px/1 system-ui, sans-serif; letter-spacing: -.02em; color: #f0f0f4; }
        .r34-home-logo b { color: var(--r34-accent); }
        .r34-home-img { width: auto; max-width: min(560px, 92%); height: auto; margin: 0 auto 2px; display: block; }
        .r34-home-tag { color: #9a9aa2; font: 500 16px system-ui, sans-serif; margin-top: -6px; }
        .r34-home-search { width: 100%; display: flex; align-items: center; gap: 12px; padding: 17px 20px; margin-top: 12px; background: #16161c; border: 1px solid #2c2c35; border-radius: 16px; color: #8a8a92; cursor: pointer; font: 600 16px system-ui, sans-serif; box-shadow: 0 12px 40px rgba(0,0,0,.4); transition: border-color .14s, box-shadow .14s, transform .1s; }
        .r34-home-search:hover { border-color: color-mix(in srgb, var(--r34-accent) 55%, #2c2c35); box-shadow: 0 16px 48px rgba(0,0,0,.5); transform: translateY(-1px); }
        .r34-home-search svg { width: 22px; height: 22px; color: var(--r34-accent); flex: 0 0 auto; }
        .r34-home-search span { flex: 1; text-align: left; }
        .r34-home-search kbd { font: 600 12px system-ui, sans-serif; background: #2a2a33; color: #9a9aa2; border-radius: 6px; padding: 3px 8px; }
        /* home inline search + Google-style dropdown */
        .r34-home-searchbox { position: relative; width: 100%; margin-top: 12px; z-index: 5; text-align: left; }
        .r34-home-field { display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: #16161c; border: 1px solid #2c2c35; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.4); transition: border-color .14s ease, box-shadow .14s ease; }
        .r34-home-field:focus-within { border-color: color-mix(in srgb, var(--r34-accent) 55%, #2c2c35); box-shadow: 0 16px 48px rgba(0,0,0,.5), 0 0 0 3px color-mix(in srgb, var(--r34-accent) 14%, transparent); }
        .r34-home-field > svg { width: 22px; height: 22px; color: var(--r34-accent); flex: 0 0 auto; }
        html.r34 .r34-home-input { flex: 1; min-width: 0; background: none !important; border: 0 !important; outline: none !important; box-shadow: none !important; border-radius: 0 !important; color: #f0f0f4 !important; font-size: 17px !important; padding: 0 !important; }
        .r34-home-input::placeholder { color: #6a6a72; }
        .r34-home-drop { position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 20; padding: 6px; background: #16161c; border: 1px solid #2a2a33; border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,.6); animation: r34pop .16s ease; }
        .r34-home-drop[hidden] { display: none; }
        .r34-home-opt { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 14px; border: none; background: none; border-radius: 10px; cursor: pointer; text-align: left; }
        .r34-home-opt svg { width: 16px; height: 16px; color: #6a6a72; flex: 0 0 auto; }
        .r34-home-opt span { color: color-mix(in srgb, var(--tc, #d9d9de) 88%, #fff); font: 500 15px system-ui, sans-serif; }
        .r34-home-opt:hover, .r34-home-opt.sel { background: #23232c; }
        .r34-home-chips { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin-top: 6px; }
        .r34-home-chips-lbl { width: 100%; font: 700 10px system-ui, sans-serif; text-transform: uppercase; letter-spacing: .08em; color: #6a6a72; }
        .r34-home-chip { padding: 7px 14px; border-radius: 999px; background: #1c1c22; border: 1px solid #2a2a33; color: #c8c8d0 !important; font: 600 13px system-ui, sans-serif; text-decoration: none !important; transition: border-color .12s, color .12s, transform .1s; }
        .r34-home-chip:hover { border-color: var(--r34-accent); color: #fff !important; transform: translateY(-1px); }
        .r34-home-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 16px; }
        .r34-home-links a { display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border-radius: 12px; background: #16161c; border: 1px solid #24242c; color: #d9d9de !important; text-decoration: none !important; font: 600 14px system-ui, sans-serif; transition: border-color .12s, color .12s; }
        .r34-home-links a:hover { border-color: var(--r34-accent); color: #fff !important; }
        .r34-home-links svg { width: 17px; height: 17px; color: var(--r34-accent); }
        .r34-home-stats { color: #6a6a72; font: 500 13px system-ui, sans-serif; margin-top: 20px; }
        .r34-home-stats b { color: #9a9aa2; }
        @media (max-width: 768px) { .r34-home-logo { font-size: 46px; } #r34-home { min-height: calc(100vh - 120px); padding: 30px 16px 80px; } }

        /* ---------------- generic list/table pages (tags · artists · aliases · pools · comments · account) ---------------- */
        html.r34-listpage #content { width: 90%; max-width: 90%; margin: 0 auto; padding: 18px 0 70px; box-sizing: border-box; }
        html.r34-listpage h1, html.r34-listpage h2, html.r34-listpage h3 { color: #f0f0f4; }
        html.r34-table-page input[type="submit"], html.r34-table-page input[type="button"] { background: var(--r34-grad) !important; color: #06250a !important; border: none !important; border-radius: 9px !important; padding: 9px 20px !important; font: 800 13px system-ui, sans-serif; cursor: pointer; }
        html.r34-table-page input[type="submit"]:hover { filter: brightness(1.08); }
        /* search forms */
        html.r34-table-page #search-form { background: #15151a; border: 1px solid #24242c; border-radius: 14px; padding: 12px 14px; margin-bottom: 16px !important; }
        html.r34-table-page #search-form form { display: flex; gap: 10px; width: 100%; }
        html.r34-table-page #search-form input[type="text"] { flex: 1; }
        html.r34-table-page table.form .awesomplete { display: block; width: 100%; }
        html.r34-table-page table.form input[type="text"] { width: 100%; min-width: 0; box-sizing: border-box; }
        html.r34-table-page table.form th { color: #c8c8d0; font-weight: 700; text-align: right; padding-right: 14px; vertical-align: top; }
        html.r34-table-page table.form th p { font-weight: 400; color: #6a6a72; font-size: 11px; margin: 2px 0 0; }
        /* tag directory grid (page=tags) */
        .r34-taggrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
        .r34-tagcard { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 14px; background: #15151a; border: 1px solid #20202a; border-radius: 12px; text-decoration: none !important; transition: border-color .12s ease, transform .1s ease; }
        .r34-tagcard:hover { border-color: color-mix(in srgb, var(--tc, #9aa0a8) 55%, #20202a); transform: translateY(-2px); }
        .r34-tagcard-name { font: 700 14px system-ui, sans-serif; color: color-mix(in srgb, var(--tc, #9aa0a8) 82%, #fff); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .r34-tagcard-meta { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
        .r34-tagcard-meta i { font-style: normal; font-size: 10px; color: #6a6a72; text-transform: uppercase; letter-spacing: .04em; }
        .r34-tagcard-meta b { font: 700 12px system-ui, sans-serif; color: #c8c8d0; background: #1c1c22; border: 1px solid #2a2a33; padding: 2px 8px; border-radius: 999px; min-width: 22px; text-align: center; }
        html.r34-table-page form { width: 100%; }
        html.r34-table-page table.form { width: 100% !important; margin: 0 0 16px; padding: 10px 16px; background: #15151a; border: 1px solid #24242c; border-radius: 14px; color: #c8c8d0; font-size: 13px; border-collapse: separate; border-spacing: 0 4px; }
        html.r34-table-page table.form td { padding: 5px 8px; vertical-align: middle; }
        html.r34-table-page table.form td:first-child { color: #8a8a92; font-weight: 700; text-align: right; white-space: nowrap; }
        html.r34-table-page table.form label { color: #c8c8d0; margin-right: 14px; }
        html.r34-table-page table.form input[type="text"] { min-width: 280px; }
        html.r34-table-page table.highlightable td:first-child { color: #e7e7ec; font-weight: 700; }
        html.r34-table-page table.highlightable tbody tr:hover td:first-child { box-shadow: inset 3px 0 0 var(--r34-accent); }
        /* data table */
        html.r34 table.highlightable { width: 100% !important; border-collapse: collapse !important; background: #14141a; border: 1px solid #24242c !important; border-radius: 14px; overflow: hidden; }
        html.r34 table.highlightable tr, html.r34 table.highlightable td, html.r34 table.highlightable th { border: none !important; }  /* kill the native white separators */
        html.r34 table.highlightable th { background: #1c1c22; color: #8a8a92; font: 700 11px system-ui, sans-serif; text-transform: uppercase; letter-spacing: .06em; text-align: left; padding: 12px 16px; box-shadow: inset 0 -1px 0 #2a2a33; }
        html.r34 table.highlightable td { padding: 12px 16px; color: #d4d4d9; font-size: 14px; vertical-align: middle; }
        html.r34 table.highlightable tbody tr:nth-child(odd) td { background: #15151a; }
        html.r34 table.highlightable tbody tr:nth-child(even) td { background: #121217; }
        html.r34 table.highlightable tbody tr.tableheader td, html.r34 table.highlightable tbody tr.tableheader th { background: #1c1c22; }
        html.r34 table.highlightable tbody tr:hover:not(.tableheader) td { background: #1e1e28; }
        html.r34 table.highlightable tbody tr:hover:not(.tableheader) td:first-child { box-shadow: inset 3px 0 0 var(--r34-accent); }
        html.r34 table.highlightable td:first-child { font-weight: 700; color: #e7e7ec; }
        html.r34 table.highlightable a { color: #9bb8ff; text-decoration: none; }
        html.r34 table.highlightable a:hover { color: var(--r34-accent); }
        /* tag-type colours everywhere (tables, comment tag lists) */
        html.r34 .tag-type-artist a { color: #ff6b6b !important; }
        html.r34 .tag-type-character a { color: #8fd14f !important; }
        html.r34 .tag-type-copyright a { color: #e07ad6 !important; }
        html.r34 .tag-type-general a { color: #9bb8ff !important; }
        html.r34 .tag-type-metadata a, html.r34 .tag-type-meta a { color: #f0b34c !important; }
        /* native pagination (tags/artists/comments use it; the post list uses infinite scroll) */
        html.r34-list #paginator, html.r34-table-page #paginator, html.r34-comments-page #paginator { display: none; }  /* infinite scroll replaces it */
        html.r34 #paginator { margin: 22px 0 6px; }
        html.r34 .pagination { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: center; }
        html.r34 .pagination a, html.r34 .pagination b { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; height: 36px; padding: 0 10px; border-radius: 9px; font: 700 13px system-ui, sans-serif; text-decoration: none !important; }
        html.r34 .pagination a { background: #1a1a20; border: 1px solid #2a2a33; color: #c8c8d0 !important; }
        html.r34 .pagination a:hover { border-color: var(--r34-accent); color: #fff !important; }
        html.r34 .pagination b { background: var(--r34-grad); color: #06250a; }
        html.r34-table-page #footer { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; margin-top: 18px; color: #6a6a72; font: 600 13px system-ui, sans-serif; }
        html.r34-table-page #footer a { color: #c8c8d0 !important; text-decoration: none; }
        html.r34-table-page #footer a:hover { color: var(--r34-accent) !important; }

        /* ---------------- comments feed (page=comment) — Reddit-style cards ---------------- */
        .r34-cfeed { display: flex; flex-direction: column; gap: 14px; }
        .r34-cfeed-blur { position: absolute; inset: 0; background-size: cover; background-position: center; filter: blur(30px) brightness(.5); transform: scale(1.18); }
        .r34-rc { display: flex; background: #15151a; border: 1px solid #20202a; border-radius: 14px; overflow: hidden; }
        .r34-rc-thumb { position: relative; flex: 0 0 210px; align-self: stretch; min-height: 168px; overflow: hidden; background: #0c0c0f; }
        .r34-rc-thumb img { position: relative; z-index: 1; width: 100%; height: 100%; object-fit: contain; }
        .r34-rc-main { flex: 1; min-width: 0; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 11px; }
        .r34-rc-head { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
        .r34-rc-badge { font: 700 11px system-ui, sans-serif; color: #c8c8d0; background: #1c1c22; border: 1px solid #2a2a33; padding: 3px 9px; border-radius: 999px; }
        .r34-rc-score { font: 700 12px system-ui, sans-serif; color: var(--r34-accent); background: color-mix(in srgb, var(--r34-accent) 14%, #1c1c22); border: 1px solid color-mix(in srgb, var(--r34-accent) 35%, #2a2a33); padding: 3px 9px; border-radius: 999px; }
        .r34-rc-count { display: inline-flex; align-items: center; gap: 5px; font: 700 12px system-ui, sans-serif; color: #9a9aa2; }
        .r34-rc-count svg { width: 14px; height: 14px; }
        .r34-rc-view { margin-left: auto; font: 600 12px system-ui, sans-serif; color: #9bb8ff !important; text-decoration: none !important; }
        .r34-rc-view:hover { color: var(--r34-accent) !important; }
        .r34-rc-tags { display: flex; flex-wrap: wrap; gap: 5px; }
        .r34-rc-tag { font: 600 11px system-ui, sans-serif; padding: 3px 9px; border-radius: 999px; text-decoration: none !important; color: color-mix(in srgb, var(--tc, #9aa0a8) 82%, #fff); background: color-mix(in srgb, var(--tc, #9aa0a8) 14%, #1c1c22); border: 1px solid color-mix(in srgb, var(--tc, #9aa0a8) 32%, #2c2c34); }
        .r34-rc-tag:hover { filter: brightness(1.15); }
        .r34-rc-thread { display: flex; flex-direction: column; gap: 11px; margin-top: 1px; padding-top: 12px; border-top: 1px solid #20202a; }
        .r34-rc-comment { display: flex; gap: 10px; }
        .r34-rc-ava { flex: 0 0 auto; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--r34-grad); color: #06250a; font: 800 13px system-ui, sans-serif; }
        .r34-rc-cbody { flex: 1; min-width: 0; }
        .r34-rc-chead { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .r34-rc-author { font: 700 12px system-ui, sans-serif; color: #9bb8ff !important; text-decoration: none !important; }
        .r34-rc-author:hover { color: var(--r34-accent) !important; }
        .r34-rc-date { font: 500 11px system-ui, sans-serif; color: #6a6a72; }
        .r34-rc-text { font: 400 13px/1.5 system-ui, sans-serif; color: #d4d4d9; overflow-wrap: anywhere; margin-top: 2px; }
        @media (max-width: 680px) { .r34-rc { flex-direction: column; } .r34-rc-thumb { flex: none; height: 200px; align-self: auto; } }

        /* ---------------- account / login ---------------- */
        html.r34-account #content { max-width: 560px; }
        html.r34-account #user-index { background: #15151a; border: 1px solid #24242c; border-radius: 16px; padding: 26px 28px 30px; }
        html.r34-account #user-index h2 { margin: 0 0 16px; font: 800 22px system-ui, sans-serif; }
        html.r34-account #user-index h4 { margin: 16px 0 3px; }
        html.r34-account #user-index h4 a { color: var(--r34-accent) !important; font: 700 15px system-ui, sans-serif; text-decoration: none !important; }
        html.r34-account #user-index p { color: #9a9aa2; font: 400 13px/1.55 system-ui, sans-serif; margin: 0; }
        html.r34-account #user-index h1 { margin: 22px 0 0; font: 800 16px system-ui, sans-serif; }
        html.r34-account #user-index h1 a { color: #9bb8ff !important; text-decoration: none !important; }

        /* ---------------- generic content pages (upload · forum · iCame · wiki · static · account sub-pages) ---------------- */
        html.r34-page #content { width: min(92%, 1100px) !important; max-width: 1100px !important; }
        html.r34-page #content, html.r34-page #content p, html.r34-page #content li, html.r34-page #content dd, html.r34-page #content td, html.r34-page #content label { color: #c8c8d0; line-height: 1.55; }
        html.r34-page #content h1, html.r34-page #content h2, html.r34-page #content h3, html.r34-page #content h4, html.r34-page #content h5, html.r34-page #content h6 { color: #f0f0f4; }
        html.r34-page #content a { color: #9bb8ff; text-decoration: none; }
        html.r34-page #content a:hover { color: var(--r34-accent); }
        html.r34-page #content input[type="submit"], html.r34-page #content input[type="button"], html.r34-page #content button[type="submit"] { background: var(--r34-grad) !important; color: #06250a !important; border: none !important; border-radius: 9px !important; padding: 9px 18px !important; font: 800 13px system-ui, sans-serif; cursor: pointer; }
        html.r34-page #content input[type="submit"]:hover { filter: brightness(1.08); }
        html.r34-page #content table { border-collapse: collapse; background: #15151a; border: 1px solid #24242c; border-radius: 12px; overflow: hidden; max-width: 100%; }
        html.r34-page #content table td, html.r34-page #content table th { border: none !important; box-shadow: inset 0 -1px 0 #1f1f26; padding: 9px 13px; }
        html.r34-page #content table th { background: #1c1c22; color: #8a8a92; text-align: left; font: 700 11px system-ui, sans-serif; text-transform: uppercase; letter-spacing: .05em; }
        html.r34-page #content blockquote { border-left: 3px solid #2a2a33; margin: 8px 0; padding: 6px 0 6px 14px; color: #b8b8c0; }
        html.r34-page #content fieldset { border: 1px solid #24242c; border-radius: 12px; padding: 14px; background: #15151a; margin: 0 0 14px; }
        html.r34-page #content fieldset legend { color: #c8c8d0; padding: 0 6px; font-weight: 700; }
        html.r34-page #content hr { border: none; border-top: 1px solid #24242c; }
        html.r34-page #footer { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; margin-top: 18px; color: #6a6a72; font: 600 13px system-ui, sans-serif; }
        html.r34-page #footer a { color: #c8c8d0 !important; text-decoration: none; }
        html.r34-page #footer a:hover { color: var(--r34-accent) !important; }

        /* bottom dock — mobile only */
        #r34-botnav { display: none; }

        /* ---------------- mobile (matches the e-h scheme: slim topbar + bottom dock) ---------------- */
        @media (max-width: 768px) {
            /* topbar collapses to just the logo; primary nav moves to the dock */
            html.r34 #header { position: static; }
            #r34-bar { width: 94%; max-width: 94%; padding: 12px 0 8px; gap: 8px; }
            .r34-nav, .r34-bar-right { display: none; }
            html.r34 body { padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)); }

            #r34-botnav { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147482000; align-items: stretch; justify-content: space-around; height: 58px; padding-bottom: env(safe-area-inset-bottom, 0px); background: rgba(14,14,17,.96); border-top: 1px solid #24242c; backdrop-filter: blur(14px) saturate(160%); -webkit-backdrop-filter: blur(14px) saturate(160%); }
            .r34-botnav-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; border: none; background: none; color: #9a9aa2 !important; text-decoration: none !important; font: 600 10px system-ui, sans-serif; cursor: pointer; }
            .r34-botnav-item:visited { color: #9a9aa2 !important; }
            .r34-botnav-ico { display: inline-flex; align-items: center; justify-content: center; }
            .r34-botnav-ico svg { width: 22px; height: 22px; }
            .r34-botnav-item:active, .r34-botnav-item.is-current { color: #fff !important; }
            .r34-botnav-item.is-current .r34-botnav-ico { color: var(--r34-accent); }
            .r34-botnav-item.center .r34-botnav-ico { width: 46px; height: 46px; margin-top: -22px; border-radius: 50%; background: var(--r34-grad); color: #06250a; box-shadow: 0 6px 18px rgba(79,154,48,.5); }

            /* listing toolbar: heading on line 1; Filter AI + Newest together on line 2; no view selector */
            html.r34-list #post-list { width: 94%; max-width: 94%; padding: 12px 0 40px; }
            .r34-tb-top { gap: 10px 12px; justify-content: flex-start; }
            .r34-count { flex: 1 1 100%; margin-right: 0; text-align: left; }
            .r34-seg { display: none; }

            /* search modal + viewer */
            .r34-v-strip { height: 76px; } .r34-strip-cell { width: 58px; height: 58px; }
        }
        `;
    }
})();
