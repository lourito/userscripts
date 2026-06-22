// ==UserScript==
// @name         E-Hentai Dark + Full-Width Gallery
// @namespace    ehentai-dark-gallery
// @version      3.54.0
// @updateURL    https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/ehentai.user.js
// @downloadURL  https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/ehentai.user.js
// @description  Modern dark theme, full-width masonry/list gallery, infinite scroll, fixed icon topbar, floating dock, fullscreen viewer with filmstrip and max-quality downloads for E-Hentai / ExHentai
// @match        https://e-hentai.org/*
// @match        https://exhentai.org/*
// @match        https://upload.e-hentai.org/*
// @run-at       document-start
// @require      https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.8.23/dist/zip.min.js
// @require      https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
// @connect      *
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// ==/UserScript==
(function () {
    "use strict";

    // ---- layout config ----
    const MAX_COLS = 6;
    const TILE_BASE = 200;
    const TILE_FIT = 230;
    const GAP = 16;
    const MAX_COL_W = 320;
    const MAX_W = 2000;
    const WIDTH_PCT = 0.9;
    // gallery origin for building nav URLs — on the upload.* subdomain, point back to the main host
    const homeOrigin = location.origin.replace(/\/\/upload\./, "//");
    const THREADS = 4;

    // ---- helpers ----
    const addStyle = (css) => {
        if (typeof GM_addStyle === "function") return GM_addStyle(css);
        const s = document.createElement("style");
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    };
    const debounce = (fn, ms) => {
        let t;
        return (...a) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...a), ms);
        };
    };
    // update a URL query param without reloading (so view/sort survive a refresh)
    const setUrlParam = (k, v) => {
        try {
            const u = new URL(location.href);
            if (v) u.searchParams.set(k, v);
            else u.searchParams.delete(k);
            history.replaceState(null, "", u.href);
        } catch (e) {}
    };
    const el = (tag, props = {}, html) => {
        const n = Object.assign(document.createElement(tag), props);
        if (html != null) n.innerHTML = html;
        return n;
    };
    const gmGet = (url, responseType, headers) =>
        new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url,
                responseType,
                headers: Object.assign({ Referer: location.href }, headers),
                timeout: 600000,
                onload: (r) => (r.status >= 200 && r.status < 400 ? resolve(r) : reject(new Error("HTTP " + r.status))),
                onerror: () => reject(new Error("network error")),
                ontimeout: () => reject(new Error("timeout")),
            });
        });

    // ---- icons ----
    const svg = (inner) =>
        `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
    const ICON = {
        home: svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>'),
        eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
        external: svg('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>'),
        fire: svg('<path d="M12 3c1 3-1 4-1 6a3 3 0 0 0 6 0c0-1 0-2-.5-3 2 2 3.5 4.5 3.5 7a8 8 0 0 1-16 0c0-3 2-5 3-7 .5 2 2 2 2 0 0-1.5 1-2.5 3-3Z"/>'),
        heart: svg('<path d="M12 20s-7-4.5-9.5-9A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9.5 5C19 15.5 12 20 12 20Z"/>'),
        magnet: svg('<path d="M6 4v7a6 6 0 0 0 12 0V4"/><path d="M3 4h6M15 4h6M3 11h6M15 11h6"/>'),
        search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
        download: svg('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>'),
        grid: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
        list: svg('<rect x="4" y="4" width="16" height="5" rx="1"/><rect x="4" y="12" width="16" height="8" rx="1"/>'),
        close: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
        prev: svg('<path d="m15 18-6-6 6-6"/>'),
        next: svg('<path d="m9 18 6-6-6-6"/>'),
        up: svg('<path d="m18 15-6-6-6 6"/>'),
        down: svg('<path d="m6 9 6 6 6-6"/>'),
        film: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 14h4M17 9h4M17 14h4"/>'),
        vote: svg('<path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Z"/><path d="M7 10l4.5-7a2 2 0 0 1 2 2.2L13 9h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17 20H7"/>'),
        clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
        sparkle: svg('<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3L12 3Z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/>'),
        user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6.5 8-6.5s8 2.5 8 6.5"/>'),
        upload: svg('<path d="M12 19V8"/><path d="m7 12 5-5 5 5"/><path d="M5 21h14"/>'),
        trophy: svg('<path d="M8 4h8v6a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3"/><path d="M9 20h6M12 14v6"/>'),
        rows: svg('<rect x="3" y="4" width="18" height="5" rx="1.5"/><rect x="3" y="12" width="18" height="5" rx="1.5"/>'),
        square: svg('<rect x="4" y="4" width="16" height="16" rx="2"/>'),
        lines: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
        back: svg('<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>'),
        chevron: svg('<path d="m6 9 6 6 6-6"/>'),
        chat: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>'),
        book: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>'),
        gift: svg('<path d="M20 12v9H4v-9"/><rect x="2" y="7" width="20" height="5" rx="1"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z"/>'),
        news: svg('<path d="M4 4h13v16H6a2 2 0 0 1-2-2Z"/><path d="M17 8h3v10a2 2 0 0 1-4 0V4"/><path d="M8 8h5M8 12h5M8 16h3"/>'),
        game: svg('<path d="M6 11h4M8 9v4"/><circle cx="15" cy="11" r="1"/><circle cx="17.5" cy="13.5" r="1"/><path d="M17.5 5H6.5A4.5 4.5 0 0 0 2 9.5v5A4.5 4.5 0 0 0 6.5 19c1.6 0 2.2-.6 3.2-1.6l.8-.9h3l.8.9c1 1 1.6 1.6 3.2 1.6a4.5 4.5 0 0 0 4.5-4.5v-5A4.5 4.5 0 0 0 17.5 5Z"/>'),
        plus: svg('<path d="M12 5v14M5 12h14"/>'),
        controls: svg('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'),
        // filled brand mark (stacked gallery tiles) — tinted to the accent via currentColor
        logo: '<svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor"><rect x="5" y="5" width="15" height="15" rx="4.5" opacity=".4"/><rect x="12" y="12" width="15" height="15" rx="4.5"/></svg>',
    };

    // shared filter data (used by both the search modal and the listing filter bar)
    const EH_CATS = [
        [8, "Artist CG", "#e6e64c"], [128, "Asian Porn", "#e66ae6"], [64, "Cosplay", "#b46ae6"],
        [2, "Doujinshi", "#fb6e6e"], [16, "Game CG", "#94e44c"], [32, "Image Set", "#4c8ae6"],
        [4, "Manga", "#ffa84c"], [1, "Misc", "#9b9b9b"], [256, "Non-H", "#4cc3e6"], [512, "Western", "#5ad65a"],
    ];
    const EH_ALL_CATS = 1023; // sum of every category bit
    const EH_LANGS = ["english", "japanese", "chinese", "korean", "spanish", "french", "german", "russian", "portuguese"];

    // chips shown in both filters: the 10 native categories (toggle f_cats bits) + an
    // "Artbook" chip that injects the real `other:artbook$` tag into f_search instead.
    const catChips = () =>
        [
            ...EH_CATS.map(([bit, label, color]) => ({ label, color, bits: [bit] })),
            { label: "Artbook", color: "#e0a92e", tag: 'other:artbook$' },
        ].sort((a, b) => a.label.localeCompare(b.label));

    // ---- shared image-page parsing ----
    const RE_ORIGINAL = /<a href="((?:https?:\/\/[^\/]*)?\/fullimg[^"\\]*)">/;
    const RE_NORMAL = /<img id="img" src="(.*?)"/;
    const RE_NL = /<a\s+href="#"\s+id="loadfail"\s+onclick="return\s+nl\('(.*?)'\)"/;
    const fatal = (msg) => Object.assign(new Error(msg), { fatal: true });

    const urlCache = new Map();
    async function resolveUrl(href, original) {
        const key = (original ? "o:" : "r:") + href;
        if (urlCache.has(key)) return urlCache.get(key);
        const html = (await gmGet(href)).responseText;
        let url = null;
        if (original) url = RE_ORIGINAL.exec(html)?.[1]?.replace(/&amp;/g, "&") || null;
        if (!url) url = RE_NORMAL.exec(html)?.[1] || null;
        urlCache.set(key, url);
        return url;
    }

    let listPromise = null;
    let searchOpener = null; // set in init() from buildSearch; lets the Search CTA / bottom-nav open the modal
    let accountOpener = null; // set in init() from buildAccountMenu; opens the avatar popover / mobile sheet
    let listingResort = null; // set by the listing toolbar; re-applied after each infinite-scroll batch
    let cardSeq = 0; // stable original-order index stamped on each listing card

    // numeric rating (0–5) parsed from e-h's .ir sprite — used only for client-side sorting
    function parseRatingNum(irHtml) {
        if (!irHtml) return 0;
        const m = irHtml.match(/background-position:\s*(-?\d+)px\s+(-?\d+)px/);
        if (!m) return 0;
        const x = +m[1], y = +m[2];
        let r = 5 + x / 16; // whole-star part (x is 0,-16,…)
        if (x % 16 !== 0) r -= 0.5;
        if (y < -1) r -= 0.5; // lower sprite row = half star
        return Math.max(0, Math.min(5, r));
    }

    // learned tag pool for search autocomplete: a seed list + every tag seen while browsing
    const TAG_SEED = [
        "language:english", "language:japanese", "language:chinese", "language:korean",
        "female:sole female", "female:big breasts", "female:nakadashi", "female:blowjob", "female:stockings",
        "female:bondage", "female:ahegao", "female:netorare", "female:schoolgirl uniform", "female:lolicon",
        "male:sole male", "male:yaoi", "other:ai generated", "other:full color", "other:uncensored", "other:western imageset",
    ];
    // a usable tag needs a namespace AND a value (namespace:value) — bare "female:" breaks searches
    const isUsableTag = (t) => { const i = (t || "").indexOf(":"); return i > 0 && i < t.length - 1; };
    const tagStore = (() => {
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem("ig-tags") || "[]"); } catch (e) {}
        const set = new Set(arr);
        let dirty = false;
        const persist = debounce(() => {
            if (!dirty) return;
            try { localStorage.setItem("ig-tags", JSON.stringify([...set].slice(-4000))); dirty = false; } catch (e) {}
        }, 1500);
        return {
            add: (t) => { t = (t || "").trim(); if (isUsableTag(t) && !set.has(t)) { set.add(t); dirty = true; persist(); } },
            all: () => [...new Set([...TAG_SEED, ...set])].filter(isUsableTag),
        };
    })();

    // e-h-style colour coding for tag chips, keyed by namespace
    const TAG_NS_COLOR = {
        female: "#f0709a", male: "#6aa8ff", mixed: "#b07cff", artist: "#ffb454", group: "#f6cf5a",
        parody: "#c084fc", character: "#4cc3e6", cosplayer: "#f078d8", language: "#8f96a3",
        other: "#9aa0a8", reclass: "#e0709a", temp: "#9aa0a8",
    };
    const tagColor = (ns) => TAG_NS_COLOR[ns] || "#8f96a3";
    // "female:sole female" → female:"sole female"$ (e-h exact-tag search token)
    const tagToQuery = (full) => {
        const c = full.indexOf(":");
        if (c < 0) return full + "$";
        const ns = full.slice(0, c), val = full.slice(c + 1);
        return ns + ":" + (/\s/.test(val) ? `"${val}"` : val) + "$";
    };
    const tagLabel = (t) => t.replace(/\$$/, "").replace(/"/g, ""); // token → readable label
    // matches namespaced search tokens: female:"x"$, parody:y$, -other:"z"$, language:english$ …
    const TAG_TOKEN_RE = /-?[a-z]+:(?:"[^"]+"|\S+?)\$/gi;
    const isSpecialTag = (t) => /^language:/i.test(t) || t === '-other:"ai generated"$' || t === "other:artbook$";

    // favourites: optimistic local state + POST to e-h's favorite endpoint (own account)
    const favStore = (() => {
        let set = new Set();
        try { set = new Set(JSON.parse(localStorage.getItem("ig-favs") || "[]")); } catch (e) {}
        return {
            has: (gid) => set.has(gid),
            set: (gid, on) => {
                on ? set.add(gid) : set.delete(gid);
                try { localStorage.setItem("ig-favs", JSON.stringify([...set])); } catch (e) {}
            },
        };
    })();
    function postFavorite(gid, token, on) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: `${location.origin}/gallerypopups.php?gid=${gid}&t=${token}&act=addfav`,
                headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: location.href },
                data: `favcat=${on ? "0" : "favdel"}&favnote=&apply=Apply&update=1`,
                onload: (r) => (r.status >= 200 && r.status < 400 ? resolve() : reject(new Error("HTTP " + r.status))),
                onerror: () => reject(new Error("network")),
            });
        });
    }

    // reorder the already-rendered listing cards in place (keeps original order for "default")
    function sortGrid(grid, key) {
        const cards = Array.from(grid.querySelectorAll(".ig-lcard"));
        const num = (c, k) => +c.dataset[k] || 0;
        const cmps = {
            default: (a, b) => num(a, "idx") - num(b, "idx"),
            rating: (a, b) => num(b, "rating") - num(a, "rating"),
            pages: (a, b) => num(b, "pages") - num(a, "pages"),
            title: (a, b) => (a.dataset.title || "").toLowerCase().localeCompare((b.dataset.title || "").toLowerCase()),
        };
        const cmp = cmps[key] || cmps.default;
        cards.sort(cmp).forEach((c) => grid.appendChild(c));
    }
    function ensureFullList() {
        if (!listPromise) listPromise = discoverImagePages(readGpc(), () => {});
        return listPromise;
    }
    async function discoverImagePages(gpc, onProgress) {
        const base = new URL(location.href);
        base.searchParams.delete("p");
        const last = Number.isFinite(gpc.pages) ? gpc.pages : 1;
        const out = [];
        for (let p = 0; p < last; p++) {
            const u = new URL(base.href);
            if (p > 0) u.searchParams.set("p", p);
            onProgress && onProgress(`Listing… ${p + 1}/${last}`);
            const res = await gmGet(u.href);
            const doc = new DOMParser().parseFromString(res.responseText, "text/html");
            for (const a of doc.querySelectorAll("#gdt > a")) {
                const div = a.querySelector("div[title]");
                const title = (div?.getAttribute("title") || "").replace(/^Page\s+\d+:\s*/i, "").trim();
                out.push({ href: a.href, title, thumb: div ? div.outerHTML : "" });
            }
        }
        return out;
    }

    // OPT-IN: upgrade in-view thumbnails from the 200px sprite to the resampled image
    // (~1280px). Resampled costs image-view quota but NO GP. Deliberately gentle (2 at a
    // time, viewport-only, throttled) so it never floods requests/decodes and jams the tab.
    // HQ upgrader: ONE-SHOT, per-screen. A button sharpens only the thumbnails currently
    // in view (resampled → no GP, but image-view quota), never persists, never runs on its
    // own. Reports progress so the button + tiles can show they're working.
    function createHqUpgrader() {
        const observed = new Set();
        const queue = [];
        let active = 0;
        let progressCb = null;
        const MAX = 2;
        const report = () => progressCb && progressCb(queue.length + active);
        function pump() {
            while (active < MAX && queue.length) {
                const a = queue.shift();
                if (a.dataset.hq) continue;
                active++;
                upgrade(a).finally(() => { active--; setTimeout(() => { pump(); report(); }, 140); });
            }
            report();
        }
        async function upgrade(a) {
            a.classList.add("ig-hq-loading");
            try {
                const url = await resolveUrl(a.href, false); // resampled — no GP
                if (!url) return;
                await new Promise((res) => { const im = new Image(); im.onload = im.onerror = res; im.src = url; });
                const div = a.querySelector("div");
                if (!div) return;
                a.dataset.hq = "1";
                a.classList.add("ig-hq");
                div.style.transform = "none";
                div.style.width = "100%";
                div.style.height = "100%";
                div.style.backgroundImage = 'url("' + url + '")';
                div.style.backgroundSize = "cover";
                div.style.backgroundPosition = "center";
                div.style.backgroundRepeat = "no-repeat";
            } catch (e) {} finally {
                a.classList.remove("ig-hq-loading");
            }
        }
        return {
            observe: (a) => observed.add(a),
            onProgress: (cb) => { progressCb = cb; },
            // sharpen only the tiles currently in (or near) the viewport — one shot
            runVisible: () => {
                const vh = window.innerHeight;
                const vis = [...observed].filter((a) => {
                    if (a.dataset.hq || queue.includes(a)) return false;
                    const r = a.getBoundingClientRect();
                    return r.bottom > -200 && r.top < vh + 200;
                });
                if (!vis.length) { report(); return 0; }
                queue.push(...vis);
                report();
                pump();
                return vis.length;
            },
        };
    }

    injectStyles();
    fixViewport();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        // run on the next tick so the rest of this IIFE (later top-level consts) has
        // finished initializing before init() touches anything — avoids TDZ crashes
        // when @require delays execution past document-start.
        setTimeout(init, 0);
    }

    // E-Hentai ships no responsive viewport meta, so phones render the page at desktop
    // width and zoom out (everything tiny). Inject one so device-width layout kicks in.
    function fixViewport() {
        const set = () => {
            let m = document.querySelector('meta[name="viewport"]');
            if (!m) {
                m = document.createElement("meta");
                m.name = "viewport";
                (document.head || document.documentElement).appendChild(m);
            }
            m.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
        };
        set();
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", set);
    }

    function init() {
        modernizeTopbar();
        const sr = buildSearch(); // command-palette modal — powers the Search CTA + ⌘K everywhere
        searchOpener = sr.open;
        buildAccountMenu(); // unified account popover/sheet (avatar + bottom-nav "Me")
        buildBottomNav(); // fixed bottom nav (shown only on mobile via CSS)

        const onUpload = /^upload\./.test(location.host);   // upload.e-hentai.org (My Uploads / upload forms)
        const gdt = document.getElementById("gdt");
        const isGallery = !!(gdt && gdt.classList.contains("gt200"));

        let masonry = null;
        let listView = null;
        if (onUpload) {
            /* upload.e-hentai.org — utility subdomain: dark theme + topbar only, no page handler */
        } else if (isGallery) {
            document.documentElement.classList.add("ig-gallery");
            rebuildHeader();
            masonry = createMasonry(gdt);
            masonry.init();
            setupInfiniteScroll(gdt, masonry, readGpc());
            setupModal(gdt, masonry);
            listView = createListView(gdt);
            setupGalleryFab(masonry, listView); // floating action button (gallery only)
        } else if (/^\/toplist/.test(location.pathname) || document.querySelector(".tdo")) {
            setupToplist();
        } else if (/^\/torrents/.test(location.pathname) || document.getElementById("torrentform")) {
            setupTorrents();
        } else if (/^\/favorites/.test(location.pathname)) {
            setupFavorites();
        } else if (/^\/home/.test(location.pathname) || document.getElementById("lb")) {
            setupHome();
        } else if (document.querySelector(".itg") || document.getElementById("searchbox")) {
            setupListing();   // front / watched / search / tag — even with 0 results
        }

        // single-image page (/s/…) → standalone back-to-gallery button
        const gurl = galleryUrlFromImagePage();
        if (gurl) addBackFab(gurl);
    }

    // ===================================================================== //
    //  Fixed icon topbar (built fresh; original #nb hidden)                 //
    // ===================================================================== //
    // does this href point at the page we're currently on? (used for active highlighting)
    function isCurrentPath(href) {
        try {
            const u = new URL(href, location.href);
            if (u.host !== location.host) return false;
            const norm = (p) => p.replace(/\.php$/, "").replace(/\/+$/, "") || "/";
            return norm(u.pathname) === norm(location.pathname);
        } catch (e) { return false; }
    }
    // best-effort logged-in username (gallery site rarely exposes it; avoid nav labels).
    // regex stays inline (not a module-level const) so it can never land in the temporal
    // dead zone — init() can run synchronously, before later top-level consts initialize.
    function getMemberName() {
        const navWords = /^(overview|my\s|home|account|watched|popular|favorites?|front page|toplists?|torrents?|stats|settings|tags|hentai@home|donations?|hath|gp exchange|credit log|karma log|bounties|news|forums|wiki|hentaiverse)/i;
        for (const a of document.querySelectorAll('a[href*="home.php"]')) {
            const t = (a.textContent || "").trim();
            if (t && !navWords.test(t) && t.length <= 24) return t;
        }
        return "";
    }
    function getLogoutHref() {
        const a = document.querySelector('a[href*="CODE=03"]');
        return a ? a.href : "";
    }
    // logged-in detection (gallery site rarely exposes the username, but the member
    // cookie / account-only links confirm the session exists)
    function isLoggedIn() {
        try { if (/\bipb_member_id=\d/.test(document.cookie)) return true; } catch (e) {}
        return (
            !!getLogoutHref() ||
            !!document.getElementById("lb") ||
            !!document.querySelector('a[href*="uconfig.php"], a[href*="hentaiathome.php"], a[href*="exchange.php"]')
        );
    }

    // Unified account menu: avatar popover on desktop, bottom sheet on mobile.
    // Concentrates the user's items; on mobile it also carries Browse/Community
    // (the .ig-account-extra sections, hidden on desktop where the topbar has them).
    function buildAccountMenu() {
        const o = homeOrigin;
        const name = getMemberName();
        const loggedIn = isLoggedIn();
        const logoutHref = getLogoutHref();
        const SECTIONS = [
            { label: "Account", items: [
                { icon: ICON.user, title: "My Home", sub: "Account & GP", href: o + "/home.php" },
                { icon: ICON.eye, title: "Watched", sub: "Your subscriptions", href: o + "/watched" },
                { icon: ICON.heart, title: "Favorites", sub: "Galleries you saved", href: o + "/favorites.php" },
                { icon: ICON.upload, title: "My Uploads", sub: "Manage your uploads", href: "https://upload.e-hentai.org/manage" },
                { icon: ICON.controls, title: "Settings", sub: "Preferences", href: o + "/uconfig.php" },
            ] },
            { label: "Browse", extra: true, items: [
                { icon: ICON.home, title: "Front Page", sub: "All galleries", href: o + "/" },
                { icon: ICON.fire, title: "Popular", sub: "Trending right now", href: o + "/popular" },
                { icon: ICON.trophy, title: "Toplists", sub: "Top ranked galleries", href: o + "/toplist.php" },
                { icon: ICON.magnet, title: "Torrents", sub: "Gallery torrents", href: o + "/torrents.php" },
            ] },
            { label: "Community", extra: true, items: [
                { icon: ICON.chat, title: "Forums", sub: "Discussion boards", href: "https://forums.e-hentai.org/" },
                { icon: ICON.book, title: "Wiki", sub: "EH Wiki", href: "https://ehwiki.org/" },
                { icon: ICON.gift, title: "Bounties", sub: "Request galleries", href: o + "/bounty.php" },
                { icon: ICON.news, title: "News", sub: "Announcements", href: o + "/news.php" },
                { icon: ICON.game, title: "HentaiVerse", sub: "Play the game", href: "https://hentaiverse.org/" },
            ] },
        ];

        const backdrop = el("div", { id: "ig-account-backdrop", hidden: true });
        const panel = el("div", { id: "ig-account", hidden: true });

        const head = el("div", { className: "ig-account-head" });
        const ava = el("span", { className: "ig-account-ava" });
        if (name) ava.textContent = name[0].toUpperCase();
        else ava.innerHTML = ICON.user;
        const who = el("a", { className: "ig-account-who", href: o + "/home.php" }, `<b></b><small></small>`);
        who.querySelector("b").textContent = name || (loggedIn ? "My Account" : "Account");
        who.querySelector("small").textContent = name ? "View profile" : (loggedIn ? "View your profile · GP" : "Not signed in");
        head.append(ava, who);
        panel.append(head);

        for (const sec of SECTIONS) {
            const s = el("div", { className: "ig-account-sec" + (sec.extra ? " ig-account-extra" : "") });
            const lbl = el("div", { className: "ig-account-lbl" });
            lbl.textContent = sec.label;
            s.append(lbl);
            for (const it of sec.items) {
                const row = el("a", { className: "ig-nav-item", href: it.href });
                if (isCurrentPath(it.href)) row.classList.add("is-current");
                row.innerHTML = `<span class="ig-nav-ico">${it.icon}</span><span class="ig-nav-txt"><b></b><small></small></span>`;
                row.querySelector("b").textContent = it.title;
                row.querySelector("small").textContent = it.sub;
                s.append(row);
            }
            panel.append(s);
        }
        if (logoutHref) {
            const lo = el("a", { className: "ig-account-logout", href: logoutHref }, ICON.back + "<span>Log out</span>");
            panel.append(lo);
        }
        document.body.append(backdrop, panel);

        const setOpen = (on) => {
            panel.hidden = !on;
            backdrop.hidden = !on;
            document.documentElement.classList.toggle("ig-account-open", on);
        };
        backdrop.addEventListener("click", () => setOpen(false));
        document.addEventListener("click", (e) => {
            if (panel.hidden) return;
            if (!panel.contains(e.target) && !e.target.closest(".ig-acct-btn, .ig-botnav-me")) setOpen(false);
        });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) setOpen(false); });
        accountOpener = () => setOpen(panel.hidden);
    }

    function modernizeTopbar() {
        const nb = document.getElementById("nb");
        if (nb) nb.style.display = "none";
        const o = homeOrigin;

        // grouped navigation: top-level triggers, each opening a dropdown of related items
        const GROUPS = [
            { label: "Browse", items: [
                { icon: ICON.fire, title: "Popular", sub: "Trending right now", href: o + "/popular" },
                { icon: ICON.trophy, title: "Toplists", sub: "Top ranked galleries", href: o + "/toplist.php" },
                { icon: ICON.magnet, title: "Torrents", sub: "Gallery torrents", href: o + "/torrents.php" },
            ] },
            { label: "Library", items: [
                { icon: ICON.heart, title: "Favorites", sub: "Galleries you saved", href: o + "/favorites.php" },
                { icon: ICON.eye, title: "Watched", sub: "Your subscriptions", href: o + "/watched" },
                { icon: ICON.upload, title: "My Uploads", sub: "Manage your uploads", href: "https://upload.e-hentai.org/manage" },
            ] },
            { label: "Community", items: [
                { icon: ICON.chat, title: "Forums", sub: "Discussion boards", href: "https://forums.e-hentai.org/" },
                { icon: ICON.book, title: "Wiki", sub: "EH Wiki", href: "https://ehwiki.org/" },
                { icon: ICON.gift, title: "Bounties", sub: "Request galleries", href: o + "/bounty.php" },
                { icon: ICON.news, title: "News", sub: "Announcements", href: o + "/news.php" },
                { icon: ICON.game, title: "HentaiVerse", sub: "Play the game", href: "https://hentaiverse.org/" },
            ] },
        ];

        const bar = el("div", { id: "ig-topbar" });
        const wrap = el("div", { className: "ig-topbar-wrap" });

        // logo
        const logo = el("a", { href: o + "/", className: "ig-topbar-logo", title: "Front Page" });
        const mark = el("span", { className: "ig-topbar-mark" }, ICON.logo); // tinted to accent via CSS
        const word = el("span", { className: "ig-topbar-word" });
        word.textContent = /exhentai/i.test(location.host) ? "ExHentai" : "E‑Hentai";
        logo.append(mark, word);

        // grouped nav
        const nav = el("nav", { className: "ig-nav" });
        const closeAll = () => nav.querySelectorAll(".ig-nav-group.open").forEach((g) => g.classList.remove("open"));
        for (const g of GROUPS) {
            if (!g.items) {
                const a = el("a", { className: "ig-nav-top", href: g.href }, `<span>${g.label}</span>`);
                if (isCurrentPath(g.href)) a.classList.add("is-current");
                nav.append(a);
                continue;
            }
            const group = el("div", { className: "ig-nav-group" });
            const trigger = el("button", { type: "button", className: "ig-nav-top ig-nav-trigger" }, `<span>${g.label}</span>` + ICON.chevron);
            const panel = el("div", { className: "ig-nav-panel" });
            let groupActive = false;
            for (const it of g.items) {
                const row = el(it.href ? "a" : "button", { className: "ig-nav-item" });
                if (it.href) row.href = it.href;
                else row.type = "button";
                row.innerHTML = `<span class="ig-nav-ico">${it.icon}</span><span class="ig-nav-txt"><b></b><small></small></span>`;
                row.querySelector("b").textContent = it.title;
                row.querySelector("small").textContent = it.sub;
                if (it.href && isCurrentPath(it.href)) { row.classList.add("is-current"); groupActive = true; }
                if (it.action === "search") row.addEventListener("click", (e) => { e.preventDefault(); closeAll(); searchOpener && searchOpener(); });
                panel.append(row);
            }
            if (groupActive) group.classList.add("is-current");
            trigger.addEventListener("click", (e) => {
                e.stopPropagation();
                const wasOpen = group.classList.contains("open");
                closeAll();
                if (!wasOpen) group.classList.add("open");
            });
            group.append(trigger, panel);
            nav.append(group);
        }
        document.addEventListener("click", (e) => { if (!nav.contains(e.target)) closeAll(); });

        // right cluster: primary Search CTA + account avatar (opens the unified menu)
        const right = el("div", { className: "ig-topbar-right" });
        const name = getMemberName();
        const cta = el("button", { type: "button", className: "ig-topbar-cta" }, ICON.search + `<span>Search</span><kbd>⌘K</kbd>`);
        cta.addEventListener("click", () => searchOpener && searchOpener());
        const divider = el("span", { className: "ig-topbar-div" });
        const acctBtn = el("button", { type: "button", className: "ig-topbar-icon ig-acct-btn", title: name || "Account" });
        if (name) { acctBtn.textContent = name[0].toUpperCase(); acctBtn.classList.add("ig-acct-named"); }
        else acctBtn.innerHTML = ICON.user;
        acctBtn.addEventListener("click", (e) => { e.stopPropagation(); accountOpener && accountOpener(acctBtn); });
        right.append(cta, divider, acctBtn);

        wrap.append(logo, nav, right);
        bar.append(wrap);
        const host = document.body || document.documentElement;
        host.insertBefore(bar, host.firstChild);
    }

    // ===================================================================== //
    //  Listing pages (home / search results) → full-width thumbnail grid    //
    // ===================================================================== //
    // Trim e-hentai's verbose page headings down to a single word where possible.
    function shortenTitle(t) {
        const s = (t || "").trim();
        const map = {
            "Currently Popular Recent Galleries": "Popular",
            "Watched Tag Galleries": "Watched",
            "Favorites Gallery List": "Favorites",
        };
        if (map[s]) return map[s];
        // generic fallback: strip the "… Recent Galleries"/"… Galleries"/"… Gallery List" tail
        const short = s
            .replace(/\s+Recent Galleries$/i, "")
            .replace(/\s+Gallery List$/i, "")
            .replace(/\s+Galleries$/i, "")
            .trim();
        return short || s;
    }

    // Title + one-line context for the listing header, derived from the page (not the verbose native h1).
    function listingHead(nativeTitle) {
        const p = location.pathname;
        const q = (new URLSearchParams(location.search).get("f_search") || "").trim();
        if (/^\/watched/.test(p))   return { title: "Watched",   sub: "Galleries from your watched tags", icon: ICON.eye };
        if (/^\/popular/.test(p))   return { title: "Popular",   sub: "Trending right now", icon: ICON.fire };
        if (/^\/favorites/.test(p)) return { title: "Favorites", sub: "Your saved galleries", icon: ICON.heart };
        if (/^\/tag\//.test(p)) {
            let t = "";
            try { t = decodeURIComponent(p.replace(/^\/tag\//, "")).replace(/\+/g, " "); } catch (e) {}
            return { title: "Tag", sub: t || "", icon: ICON.tag };
        }
        if (q) return { title: "Search", sub: "Results for “" + q + "”", icon: ICON.search };
        if (p === "/" || p === "") return { title: "Latest", sub: "Newest galleries", icon: ICON.clock };
        const generic = /^(E-Hentai Galleries|ExHentai)/i.test((nativeTitle || "").trim());
        return { title: generic ? "" : shortenTitle(nativeTitle || ""), sub: "", icon: ICON.grid };
    }

    // ---- reusable page header (icon chip + title + context line) ----
    function headCount(str) {
        return ((str || "").match(/[\d,]+/g) || []).map((s) => +s.replace(/,/g, "")).filter((n) => n > 0).sort((a, b) => b - a)[0] || 0;
    }
    function withCount(sub, countStr, unit) {
        const n = headCount(countStr);
        const bits = [];
        if (sub) bits.push(sub);
        if (n) bits.push(n.toLocaleString("en-US") + " " + (unit || "galleries"));
        return bits.join(" · ");
    }
    function buildHeadEl(head) {
        const headEl = el("div", { className: "ig-list-head" });
        if (!head || !head.title) return headEl;
        if (head.icon) {
            const ic = el("div", { className: "ig-list-icon" });
            ic.innerHTML = head.icon;
            headEl.appendChild(ic);
        }
        const titles = el("div", { className: "ig-list-titles" });
        const h1 = el("h1", { className: "ig-list-h1" });
        h1.textContent = head.title;
        titles.appendChild(h1);
        if (head.sub) {
            const sub = el("div", { className: "ig-list-sub" });
            sub.textContent = head.sub;
            titles.appendChild(sub);
        }
        headEl.appendChild(titles);
        return headEl;
    }
    // standalone header block (for pages that aren't the search/listing toolbar)
    function pageHeader(head) {
        const row = el("div", { className: "ig-page-head" });
        row.appendChild(buildHeadEl(head));
        return row;
    }

    function setupListing() {
        const ido = document.querySelector(".ido");
        const table = document.querySelector("table.itg") || document.querySelector(".itg.gld") || document.querySelector(".itg");
        // a gallery-listing page (front / watched / search / tag) — keep handling it even when
        // it has 0 results, so empty pages get the modern toolbar instead of the native search box
        const isListing = !!(table || document.getElementById("searchbox") || /^\/(watched|tag)\b/.test(location.pathname) || location.pathname === "/");
        const anchor = ido || table;
        if (!isListing || !anchor) return;

        const seen = new Set();
        const items = extractListing(document, seen);
        document.documentElement.classList.add("ig-listing");

        const count = (document.querySelector(".searchtext p") || document.querySelector(".searchtext"))?.textContent.trim() || "";
        const nextUrl = document.querySelector("a#unext, a#dnext")?.getAttribute("href") || "";

        // Build our own full-width container in the body, then hide the native listing.
        const wrap = el("div", { id: "ig-listwrap" });
        // hide e-h's verbose native heading — we render our own short title inside the toolbar
        const nativeTitle = document.querySelector("h1.ih");
        if (nativeTitle) nativeTitle.style.display = "none";
        const head = listingHead(nativeTitle ? nativeTitle.textContent : "");
        const grid = el("div", { id: "ig-listgrid" });
        const toolbar = buildListingToolbar(grid, count, head);
        for (const it of items) grid.appendChild(listingCard(it));
        if (listingResort) listingResort(); // apply a sort restored from the URL to the first batch
        const status = el("div", { id: "ig-list-status" });
        wrap.append(toolbar, grid, status);
        if (!items.length) {
            const empty = el("div", { className: "ig-empty" });
            const warn = document.querySelector(".searchwarn");
            if (warn) empty.appendChild(warn);   // keep native note + link (e.g. "no watched tags · My Tags")
            else empty.textContent = "No galleries found.";
            wrap.insertBefore(empty, status);
        }

        anchor.before(wrap);
        anchor.style.display = "none";

        if (items.length) setupListingScroll(grid, status, nextUrl, seen);
    }

    // Cursor-paginated (?next=) infinite scroll for the listing.
    function setupListingScroll(grid, status, nextUrl, seen) {
        let url = nextUrl;
        if (!url) {
            status.textContent = "— end —";
            return;
        }
        let loading = false;
        let done = false;
        const sentinel = el("div", { id: "ig-list-sentinel" });
        grid.after(sentinel);
        const nearBottom = () => sentinel.getBoundingClientRect().top <= window.innerHeight + 1200;

        async function loadMore() {
            if (loading || done) return;
            loading = true;
            status.textContent = "Loading…";
            try {
                while (!done && url && nearBottom()) {
                    const res = await fetch(url, { credentials: "include" });
                    if (!res.ok) throw new Error(res.status);
                    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
                    const more = extractListing(doc, seen);
                    for (const it of more) grid.appendChild(listingCard(it));
                    if (listingResort) listingResort(); // keep the chosen sort applied to new cards
                    url = doc.querySelector("a#unext, a#dnext")?.getAttribute("href") || "";
                    if (!url || !more.length) done = true;
                }
                status.textContent = done ? "— end —" : "";
            } catch (e) {
                status.textContent = "Failed to load — scroll to retry.";
            } finally {
                loading = false;
            }
        }
        new IntersectionObserver(() => loadMore(), { rootMargin: "1200px 0px" }).observe(sentinel);
    }

    // Pull each gallery's data from the listing rows — works in any display mode that
    // includes thumbnails (Compact/Extended/Thumbnail all carry the ehgt.org/w/ thumb).
    function extractListing(root, seen) {
        const items = [];
        seen = seen || new Set();
        for (const a of root.querySelectorAll('a[href*="/g/"]')) {
            const glink = a.querySelector(".glink");
            if (!glink) continue; // only the main gallery anchor carries .glink
            const m = a.href.match(/\/g\/(\d+)\//);
            if (!m || seen.has(m[1])) continue;
            seen.add(m[1]);

            const row = a.closest("tr, .gl1t, .id1, .id2, .id3") || a.parentElement;
            const img = row && row.querySelector('img[src*="ehgt.org/w/"], img[data-src*="ehgt.org/w/"]');
            const thumb = img ? img.getAttribute("data-src") || img.getAttribute("src") || "" : "";
            const catEl = row && row.querySelector(".cn, .cs");
            const cat = catEl ? catEl.textContent.trim() : "";
            const catClass = catEl ? (catEl.className.match(/\bct\d+\b|\bcta\b/) || [""])[0] : "";
            const gtEls = row ? Array.from(row.querySelectorAll(".gt")) : [];
            gtEls.forEach((t) => tagStore.add(t.getAttribute("title") || t.textContent)); // learn full namespaced tags
            const tags = gtEls.map((t) => {
                const full = (t.getAttribute("title") || t.textContent || "").trim();
                const c = full.indexOf(":");
                const ns = c > 0 ? full.slice(0, c) : "";
                const val = c > 0 ? full.slice(c + 1) : full;
                const q = (ns ? `${ns}:${/\s/.test(val) ? `"${val}"` : val}` : full) + "$"; // exact-tag search piece
                return { text: val, ns, q };
            });
            let pages = "";
            if (row) {
                for (const d of row.querySelectorAll("div")) {
                    if (/^\s*\d[\d,]*\s+pages\s*$/i.test(d.textContent)) {
                        pages = d.textContent.trim();
                        break;
                    }
                }
            }
            // extra metadata present in every native listing mode
            const dateEl =
                (row && row.querySelector('[id^="posted_"]')) ||
                (row && Array.from(row.querySelectorAll("div,td")).find((d) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(d.textContent.trim())));
            const date = dateEl ? dateEl.textContent.trim() : "";
            const irEl = row && row.querySelector(".ir");
            const rating = irEl ? irEl.outerHTML : ""; // clone e-h's star sprite as-is
            const upEl = row && row.querySelector('a[href*="/uploader/"]');
            const uploader = upEl ? upEl.textContent.trim() : "";
            items.push({ href: a.href, title: glink.textContent.trim(), thumb, cat, catClass, tags, pages, date, rating, uploader });
        }
        return items;
    }

    function listingCard(it) {
        const card = el("div", { className: "ig-lcard" });
        card.dataset.idx = String(cardSeq++);
        card.dataset.title = it.title || "";
        card.dataset.date = it.date || "";
        card.dataset.pages = String((((it.pages || "").match(/\d[\d,]*/) || [""])[0] || "0").replace(/,/g, ""));
        card.dataset.rating = String(parseRatingNum(it.rating));

        // whole-card click → open the gallery. A stretched overlay link sits beneath the
        // raised tag chips, so clicking a tag searches that tag instead of opening the card.
        const stretch = el("a", { className: "ig-lstretch", href: it.href });
        stretch.setAttribute("aria-label", it.title || "gallery");
        card.appendChild(stretch);

        const thumb = el("div", { className: "ig-lthumb" });
        if (it.thumb && !/^data:/.test(it.thumb)) {
            // blurred backdrop of the same image fills the box; the sharp image is shown
            // whole (object-fit:contain) so odd ratios (16:9, etc.) aren't cropped
            const bg = el("div", { className: "ig-lthumb-bg" });
            bg.style.backgroundImage = `url("${it.thumb}")`;
            const img = el("img", { loading: "lazy", alt: "" });
            img.src = it.thumb;
            thumb.append(bg, img);
        }
        if (it.cat) {
            const badge = el("span", { className: "ig-lcat " + it.catClass });
            badge.textContent = it.cat;
            thumb.appendChild(badge);
        }
        // quick favourite toggle (hover) — hits the e-h favorite endpoint on your account
        const gt = it.href.match(/\/g\/(\d+)\/([0-9a-f]+)/);
        if (gt) {
            const fav = el("button", { type: "button", className: "ig-fav", title: "Favorite" }, ICON.heart);
            if (favStore.has(gt[1])) fav.classList.add("is-fav");
            fav.addEventListener("click", async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (fav.classList.contains("is-busy")) return;
                const want = !fav.classList.contains("is-fav");
                fav.classList.add("is-busy");
                try {
                    await postFavorite(gt[1], gt[2], want);
                    fav.classList.toggle("is-fav", want);
                    favStore.set(gt[1], want);
                } catch (err) {
                    fav.classList.add("is-error");
                    setTimeout(() => fav.classList.remove("is-error"), 1200);
                } finally {
                    fav.classList.remove("is-busy");
                }
            });
            thumb.appendChild(fav);
        }
        card.appendChild(thumb);

        const body = el("div", { className: "ig-lbody" });
        const title = el("div", { className: "ig-ltitle" });
        title.textContent = it.title;
        body.appendChild(title);
        if (it.tags && it.tags.length) {
            const tagsEl = el("div", { className: "ig-ltags" }); // below the title in every view
            for (const t of it.tags) {
                const chip = el("a", { className: "ig-ltag", href: location.origin + "/?f_search=" + encodeURIComponent(t.q) });
                chip.style.setProperty("--tc", tagColor(t.ns));
                chip.textContent = t.text;
                if (t.ns) chip.title = t.ns + ":" + t.text;
                tagsEl.appendChild(chip);
            }
            body.appendChild(tagsEl);
        }
        // footer: rating + date, then uploader + pages
        const foot = el("div", { className: "ig-lfoot" });
        if (it.rating || it.date) {
            const r1 = el("div", { className: "ig-lmrow" });
            if (it.rating) {
                const rr = el("span", { className: "ig-lrating" });
                rr.innerHTML = it.rating;
                r1.appendChild(rr);
            }
            if (it.date) {
                const dd = el("span", { className: "ig-ldate" });
                dd.textContent = it.date;
                r1.appendChild(dd);
            }
            foot.appendChild(r1);
        }
        if (it.uploader || it.pages) {
            const r2 = el("div", { className: "ig-lmrow ig-lmrow-sub" });
            if (it.uploader) {
                const u = el("span", { className: "ig-luploader" }, ICON.user);
                const un = el("span", {});
                un.textContent = it.uploader;
                u.appendChild(un);
                r2.appendChild(u);
            }
            if (it.pages) {
                const p = el("span", { className: "ig-lpages" });
                p.textContent = it.pages;
                r2.appendChild(p);
            }
            foot.appendChild(r2);
        }
        if (foot.children.length) body.appendChild(foot);
        card.appendChild(body);
        return card;
    }

    // listing toolbar: result count + view modes (Grid/Large/List) + inline filters
    function buildListingToolbar(grid, count, head) {
        const params = new URLSearchParams(location.search);
        const fcats = +(params.get("f_cats") || "0");
        const fsearch = params.get("f_search") || "";
        const preIncluded = fcats ? EH_CATS.filter(([bit]) => !(fcats & bit)).map(([bit]) => bit) : [];
        // tolerant of a missing $ (e-h sometimes normalizes the search and drops it)
        const preLang = ((fsearch.match(/language:([a-z]+)\$?/i) || [])[1] || "").toLowerCase();
        const preAI = /-other:"ai generated"\$?/i.test(fsearch);
        const selectedTags = new Set();
        if (/other:artbook\$?/i.test(fsearch)) selectedTags.add("other:artbook$");
        // pull out the "special" tokens (handled by their own controls), then split the rest
        // into active tag chips (namespaced) and free keywords
        const rest = fsearch
            .replace(/-?other:"ai generated"\$?/gi, "")
            .replace(/language:[a-z]+\$?/gi, "")
            .replace(/other:artbook\$?/gi, "");
        const activeTags = new Set(rest.match(TAG_TOKEN_RE) || []);
        const baseKeywords = rest.replace(TAG_TOKEN_RE, "").replace(/\s+/g, " ").trim();
        // /tag/<namespace>:<value> pages carry the active tag in the PATH, not in f_search
        const pathTag = location.pathname.match(/^\/tag\/(.+)$/);
        if (pathTag) {
            try {
                const raw = decodeURIComponent(pathTag[1]).replace(/\+/g, " ");
                if (raw.includes(":")) activeTags.add(tagToQuery(raw));
            } catch (e) {}
        }

        const tb = el("div", { className: "ig-list-toolbar" });

        // top row: page title + context on the left, sort/filter/view controls on the right
        const top = el("div", { className: "ig-list-toprow" });
        const headEl = buildHeadEl(head ? { title: head.title, icon: head.icon, sub: withCount(head.sub, count, "galleries") } : null);
        const views = el("div", { className: "ig-seg ig-view-seg" });
        const MODES = [["grid", ICON.grid, "Grid"], ["large", ICON.square, "Large"], ["list", ICON.rows, "List"], ["compact", ICON.lines, "Compact"]];
        const applyMode = (m) => {
            grid.classList.remove("mode-grid", "mode-large", "mode-list", "mode-compact");
            grid.classList.add("mode-" + m);
            views.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.m === m));
            try { localStorage.setItem("ig-listmode2", m); } catch (e) {}
            setUrlParam("ig_view", m === "grid" ? "" : m); // remembered across reloads via the URL
        };
        for (const [m, icon, label] of MODES) {
            const b = el("button", { type: "button", title: label });
            b.dataset.m = m;
            b.innerHTML = icon;
            b.addEventListener("click", () => applyMode(m));
            views.appendChild(b);
        }
        // client-side sort of the loaded results (re-applied after each scroll batch); persisted in the URL
        const preSort = params.get("ig_sort") || "default";
        const sortSel = el("select", { className: "ig-list-sort" });
        sortSel.innerHTML =
            `<option value="default">Newest</option>` +
            `<option value="rating">Top rated</option>` +
            `<option value="pages">Most pages</option>` +
            `<option value="title">Title A–Z</option>`;
        sortSel.value = preSort;
        sortSel.addEventListener("change", () => {
            const v = sortSel.value;
            listingResort = v === "default" ? null : () => sortGrid(grid, v);
            sortGrid(grid, v);
            setUrlParam("ig_sort", v === "default" ? "" : v);
        });
        if (preSort !== "default") listingResort = () => sortGrid(grid, preSort); // applied once cards load
        // "Filters" button + backdrop — on mobile the filter row becomes a bottom sheet
        const filterBtn = el("button", { type: "button", className: "ig-list-filterbtn" }, ICON.controls + "<span>Filters</span>");
        const backdrop = el("div", { className: "ig-sheet-backdrop", hidden: true });
        const openFilters = (on) => { filters.classList.toggle("open", on); backdrop.hidden = !on; };
        filterBtn.addEventListener("click", () => openFilters(!filters.classList.contains("open")));
        backdrop.addEventListener("click", () => openFilters(false));
        const actions = el("div", { className: "ig-list-actions" });
        actions.append(sortSel, filterBtn, views);
        top.append(headEl, actions);

        // filter row: category include chips + language + min-rating + AI + apply
        const filters = el("div", { className: "ig-list-filters" });
        const sheetHead = el("div", { className: "ig-sheet-head" }, `<span>Filters</span>`);
        const sheetClose = el("button", { type: "button", className: "ig-sheet-close" }, ICON.close);
        sheetClose.addEventListener("click", () => openFilters(false));
        sheetHead.append(sheetClose);
        const selected = new Set(preIncluded);
        const catsBox = el("div", { className: "ig-list-cats" });
        const catChipEls = [];
        const isOn = (c) => (c.tag ? selectedTags.has(c.tag) : c.bits.every((b) => selected.has(b)));
        const refreshCats = () => catChipEls.forEach((x) => x.node.classList.toggle("is-on", isOn(x.c)));
        for (const c of catChips()) {
            const chip = el("button", { type: "button", className: "ig-cat" }, c.label);
            chip.style.setProperty("--c", c.color);
            catChipEls.push({ node: chip, c });
            chip.addEventListener("click", () => {
                if (c.tag) {
                    selectedTags.has(c.tag) ? selectedTags.delete(c.tag) : selectedTags.add(c.tag);
                } else {
                    const allOn = c.bits.every((b) => selected.has(b));
                    c.bits.forEach((b) => (allOn ? selected.delete(b) : selected.add(b)));
                }
                refreshCats();
                scheduleApply();
            });
            catsBox.appendChild(chip);
        }
        refreshCats(); // reflect any pre-selected categories/tags from the URL
        // "+ Tag" opens a tag picker (popover/sheet) — sits after the last category chip
        const addTagBtn = el("button", { type: "button", className: "ig-cat ig-list-addtag" }, ICON.plus + "<span>Tag</span>");
        addTagBtn.style.setProperty("--c", "#8a8a92");
        addTagBtn.addEventListener("click", (e) => { e.stopPropagation(); openTagPick(); });
        catsBox.appendChild(addTagBtn);
        const langSel = el("select", { className: "ig-list-lang" });
        langSel.innerHTML =
            `<option value="">Any language</option>` +
            EH_LANGS.map((l) => `<option value="${l}"${l === preLang ? " selected" : ""}>${l[0].toUpperCase() + l.slice(1)}</option>`).join("");
        const preRating = +(params.get("f_srdd") || "0");
        const ratingSel = el("select", { className: "ig-list-lang ig-list-minrating" });
        ratingSel.innerHTML =
            `<option value="0">Any rating</option>` +
            [2, 3, 4, 5].map((n) => `<option value="${n}"${n === preRating ? " selected" : ""}>${n}★ or more</option>`).join("");
        const aiLabel = el("label", { className: "ig-switch" });
        aiLabel.innerHTML = `<input type="checkbox"${preAI ? " checked" : ""}><span class="ig-switch-track"></span><span class="ig-switch-lbl">Exclude AI</span>`;

        // no Apply button — server filters apply automatically (debounced so multi-toggle batches).
        // ig_view / ig_sort already in the URL are preserved (not deleted), so view/sort survive.
        const applyServer = () => {
            // on a /tag/ path the active tag now lives in activeTags → search from "/" instead,
            // carrying over the view/sort params (otherwise the path tag would double-filter)
            const onTag = /^\/tag\//.test(location.pathname);
            const url = new URL(onTag ? location.origin + "/" : location.href);
            if (onTag) {
                const cur = new URLSearchParams(location.search);
                ["ig_view", "ig_sort"].forEach((k) => cur.get(k) && url.searchParams.set(k, cur.get(k)));
            }
            ["f_cats", "f_search", "next", "prev", "f_sr", "f_srdd"].forEach((k) => url.searchParams.delete(k));
            const lang = langSel.value;
            const ai = aiLabel.querySelector("input").checked;
            const kw = [baseKeywords, lang ? `language:${lang}$` : "", ai ? `-other:"ai generated"$` : "", ...selectedTags, ...activeTags].filter(Boolean).join(" ");
            if (kw) url.searchParams.set("f_search", kw);
            const inc = [...selected];
            if (inc.length) url.searchParams.set("f_cats", EH_ALL_CATS - inc.reduce((s, b) => s + b, 0));
            const minR = +ratingSel.value;
            if (minR) {
                url.searchParams.set("advsearch", "1"); // min-rating only takes effect in advanced search
                url.searchParams.set("f_sr", "on");
                url.searchParams.set("f_srdd", minR);
            }
            location.href = url.href;
        };
        const isSheet = () => window.matchMedia("(max-width: 768px)").matches;   // mobile = bottom sheet
        const scheduleApply = debounce(() => { if (!isSheet()) applyServer(); }, 550);   // desktop applies live; mobile stages until "Apply"
        langSel.addEventListener("change", scheduleApply);
        ratingSel.addEventListener("change", scheduleApply);
        aiLabel.querySelector("input").addEventListener("change", scheduleApply);

        // active tag chips (removable) — reflect the tags currently filtering the page
        const tagRow = el("div", { className: "ig-list-tagrow" });
        const renderActiveTags = () => {
            tagRow.innerHTML = "";
            tagRow.style.display = activeTags.size ? "flex" : "none";
            for (const t of activeTags) {
                const ns = (t.match(/^-?([a-z]+):/i) || [])[1] || "";
                const chip = el("span", { className: "ig-list-tagchip" });
                chip.style.setProperty("--tc", tagColor(ns));
                const lbl = el("span", {});
                lbl.textContent = tagLabel(t);
                const x = el("button", { type: "button", className: "ig-list-tagx", "aria-label": "Remove" }, ICON.close);
                x.addEventListener("click", () => { activeTags.delete(t); renderActiveTags(); scheduleApply(); });
                chip.append(lbl, x);
                tagRow.append(chip);
            }
        };
        renderActiveTags();

        // tag picker — popover (desktop) / bottom sheet (mobile) with every known tag
        const pick = el("div", { id: "ig-tagpick", hidden: true });
        pick.innerHTML = `<div class="ig-tagpick-box"><div class="ig-tagpick-head">${ICON.search}<input class="ig-tagpick-input" type="text" placeholder="Filter tags…" autocomplete="off"></div><div class="ig-tagpick-list"></div></div>`;
        document.body.appendChild(pick);
        const pickInput = pick.querySelector(".ig-tagpick-input");
        const pickList = pick.querySelector(".ig-tagpick-list");
        const renderPick = () => {
            const q = pickInput.value.trim().toLowerCase();
            const out = (q ? tagStore.all().filter((t) => t.toLowerCase().includes(q)) : tagStore.all()).slice(0, 80);
            pickList.innerHTML = "";
            for (const full of out) {
                const row = el("button", { type: "button", className: "ig-tagpick-item" });
                row.style.setProperty("--tc", tagColor(full.split(":")[0] || ""));
                row.textContent = full;
                row.addEventListener("click", () => { activeTags.add(tagToQuery(full)); renderActiveTags(); closeTagPick(); scheduleApply(); });
                pickList.append(row);
            }
            if (!out.length) {
                const none = el("div", { className: "ig-tagpick-empty" });
                none.textContent = "No matching tags yet — they fill in as you browse.";
                pickList.append(none);
            }
        };
        const openTagPick = () => { pick.hidden = false; pickInput.value = ""; renderPick(); setTimeout(() => pickInput.focus(), 30); };
        const closeTagPick = () => { pick.hidden = true; };
        pickInput.addEventListener("input", renderPick);
        pick.addEventListener("click", (e) => { if (e.target === pick) closeTagPick(); });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pick.hidden) closeTagPick(); });

        // mobile sheet footer: Apply commits the staged filters, Reset clears them
        const resetFilters = () => {
            selected.clear(); selectedTags.clear(); activeTags.clear();
            langSel.value = ""; ratingSel.value = "0"; aiLabel.querySelector("input").checked = false;
            refreshCats(); renderActiveTags();
            if (!isSheet()) applyServer();
        };
        const sheetFoot = el("div", { className: "ig-sheet-foot" });
        const resetBtn = el("button", { type: "button", className: "ig-sheet-reset" }, "Reset");
        const applyBtn = el("button", { type: "button", className: "ig-sheet-apply" }, "Apply filters");
        resetBtn.addEventListener("click", resetFilters);
        applyBtn.addEventListener("click", () => applyServer());
        sheetFoot.append(resetBtn, applyBtn);
        filters.append(sheetHead, tagRow, catsBox, langSel, ratingSel, aiLabel, sheetFoot);

        tb.append(top, filters, backdrop);
        const preView = params.get("ig_view") || (() => { try { return localStorage.getItem("ig-listmode2"); } catch (e) { return null; } })() || "grid";
        applyMode(preView);
        return tb;
    }

    // compact toolbar (sort + view modes) without the search-page filters — the page title
    // and result count live in the page header above, so this row is controls-only.
    function buildViewBar(grid) {
        const params = new URLSearchParams(location.search);
        const top = el("div", { className: "ig-list-toprow" });
        const preSort = params.get("ig_sort") || "default";
        const sortSel = el("select", { className: "ig-list-sort" });
        sortSel.innerHTML = `<option value="default">Newest</option><option value="rating">Top rated</option><option value="pages">Most pages</option><option value="title">Title A–Z</option>`;
        sortSel.value = preSort;
        sortSel.addEventListener("change", () => {
            const v = sortSel.value;
            listingResort = v === "default" ? null : () => sortGrid(grid, v);
            sortGrid(grid, v);
            setUrlParam("ig_sort", v === "default" ? "" : v);
        });
        if (preSort !== "default") listingResort = () => sortGrid(grid, preSort);
        const views = el("div", { className: "ig-seg ig-view-seg" });
        const MODES = [["grid", ICON.grid, "Grid"], ["large", ICON.square, "Large"], ["list", ICON.rows, "List"], ["compact", ICON.lines, "Compact"]];
        const applyMode = (m) => {
            grid.classList.remove("mode-grid", "mode-large", "mode-list", "mode-compact");
            grid.classList.add("mode-" + m);
            views.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.m === m));
            try { localStorage.setItem("ig-listmode2", m); } catch (e) {}
            setUrlParam("ig_view", m === "grid" ? "" : m);
        };
        for (const [m, icon, label] of MODES) {
            const b = el("button", { type: "button", title: label });
            b.dataset.m = m; b.innerHTML = icon;
            b.addEventListener("click", () => applyMode(m));
            views.appendChild(b);
        }
        const actions = el("div", { className: "ig-list-actions" });
        actions.style.marginLeft = "auto"; // no left content here → push controls to the right
        actions.append(sortSel, views);
        top.append(actions);
        const preView = params.get("ig_view") || (() => { try { return localStorage.getItem("ig-listmode2"); } catch (e) { return null; } })() || "grid";
        applyMode(preView);
        return top;
    }

    // ===================================================================== //
    //  Favorites (favorites.php) → category tabs + card grid                //
    // ===================================================================== //
    function setupFavorites() {
        const ido = document.querySelector(".ido");
        if (!ido) return;
        document.documentElement.classList.add("ig-listing");
        const params = new URLSearchParams(location.search);
        const curCat = params.has("favcat") ? params.get("favcat") : "all";

        const wrap = el("div", { id: "ig-listwrap" });

        // category tabs (rebuilt from the native .fp boxes). e-h gives every account 10
        // favorite slots (Favorites 0–9); hide the empty ones (keep the active slot + "All
        // Favorites") so the row only shows categories actually in use.
        const tabs = el("div", { className: "ig-fav-tabs" });
        let hiddenEmpty = 0;
        for (const fp of ido.querySelectorAll(".fp")) {
            const href = (/document\.location='([^']+)'/.exec(fp.getAttribute("onclick") || "") || [])[1] || "#";
            const isAll = fp.classList.contains("fps");
            const favcatN = (href.match(/favcat=(\d+)/) || [])[1];
            const divs = fp.querySelectorAll("div");
            const count = isAll ? "" : (divs[0]?.textContent || "").trim();
            const name = isAll ? "All Favorites" : (divs[divs.length - 1]?.textContent || "").trim();
            const active = isAll ? curCat === "all" : favcatN === curCat;
            if (!isAll && !active && (parseInt(count, 10) || 0) === 0) { hiddenEmpty++; continue; } // skip empty slot
            const tab = el("a", { className: "ig-fav-tab" + (active ? " is-current" : ""), href });
            const nm = el("span", { className: "ig-fav-name" });
            nm.textContent = name;
            tab.append(nm);
            if (count) {
                const c = el("span", { className: "ig-fav-count" });
                c.textContent = count;
                tab.append(c);
            }
            tabs.append(tab);
        }
        // discoverability: those 10 categories are named / colored / sorted in Settings
        const manage = el(
            "a",
            {
                className: "ig-fav-manage",
                href: homeOrigin + "/uconfig.php",
                target: "_blank",
                rel: "noopener",
                title: "You have 10 favorite categories (Favorites 0–9)" + (hiddenEmpty ? ` — ${hiddenEmpty} empty hidden` : "") + ". Name, color & sort them in Settings.",
            },
            ICON.controls + "<span>Manage categories</span>"
        );
        tabs.append(manage);

        // keyword search (stays within the current category)
        const form = el("form", { className: "ig-fav-search", method: "get" });
        form.action = location.pathname;
        const hid = el("input", { type: "hidden", name: "favcat" });
        hid.value = curCat;
        const input = el("input", { className: "ig-tor-input", type: "text", name: "f_search", placeholder: "Search favorites…", autocomplete: "off" });
        input.value = params.get("f_search") || "";
        const go = el("button", { type: "submit", className: "ig-tor-go" }, ICON.search + "<span>Search</span>");
        form.append(hid, input, go);

        // gallery grid (reuses the listing card + infinite scroll machinery)
        const seen = new Set();
        const items = extractListing(document, seen);
        const grid = el("div", { id: "ig-listgrid" });
        const count = (document.querySelector(".searchtext p") || document.querySelector(".searchtext"))?.textContent.trim() || (items.length ? items.length + " shown" : "");
        const header = pageHeader({ title: "Favorites", sub: withCount("Your saved galleries", count, "galleries"), icon: ICON.heart });
        const viewbar = buildViewBar(grid);
        for (const it of items) grid.appendChild(listingCard(it));
        if (listingResort) listingResort();
        const status = el("div", { id: "ig-list-status" });

        wrap.append(header, tabs, form, viewbar, grid, status);
        if (!items.length) {
            const empty = el("div", { className: "ig-empty" });
            empty.textContent = "No favorites here yet.";
            wrap.append(empty);
        }
        ido.before(wrap);
        ido.style.display = "none";

        const nextUrl = document.querySelector("a#unext, a#dnext")?.getAttribute("href") || "";
        setupListingScroll(grid, status, nextUrl, seen);
    }

    // ===================================================================== //
    //  My Home (home.php etc.) → modern tabs + restyled account cards       //
    // ===================================================================== //
    function setupHome() {
        const lb = document.getElementById("lb");
        const stuff = document.querySelector(".stuffbox");
        if (!lb && !stuff) return;
        document.documentElement.classList.add("ig-listing");

        const wrap = el("div", { id: "ig-home" });
        const tabs = el("div", { className: "ig-home-tabs" });
        if (lb) {
            for (const a of lb.querySelectorAll("a")) {
                const t = el("a", { className: "ig-home-tab", href: a.href });
                t.textContent = a.textContent.trim();
                if (isCurrentPath(a.href)) t.classList.add("is-current");
                tabs.append(t);
            }
        }
        wrap.append(pageHeader({ title: "My Home", sub: "Account overview & settings", icon: ICON.user }), tabs);

        // move the whole native content block (works for any account sub-page, not just
        // /home.php — settings, hath perks, stats… all sit between #lb and the footer)
        const content = el("div", { className: "ig-home-content" });
        const skip = (n) =>
            n.tagName === "SCRIPT" ||
            n.tagName === "STYLE" ||
            n.id === "lb" ||
            n.id === "ig-topbar" ||
            n.id === "ig-search" ||
            n.id === "ig-botnav" ||
            (n.classList && (n.classList.contains("dp") || n.classList.contains("dc")));
        const anchor = lb || stuff;
        anchor.before(wrap);
        if (lb) lb.style.display = "none";
        const toMove = [];
        for (const n of Array.from(document.body.children)) {
            if (n === wrap || skip(n)) continue;
            // only pull content that comes after where the nav was (i.e. the page body)
            if (wrap.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) toMove.push(n);
        }
        for (const n of toMove) content.append(n);
        wrap.append(content);
    }

    // ===================================================================== //
    //  Toplists (toplist.php) → sectioned ranked cards                      //
    // ===================================================================== //
    function setupToplist() {
        const ido = document.querySelector(".ido");
        if (!ido) return;
        const h1 = ido.querySelector("h1")?.textContent.trim() || "Toplists";

        const wrap = el("div", { id: "ig-toplists" });
        wrap.append(pageHeader({ title: shortenTitle(h1) || "Toplists", sub: "Top galleries by votes", icon: ICON.trophy }));

        let built = 0;
        for (const block of Array.from(ido.children)) {
            if (!block.querySelectorAll) continue;
            const tdos = Array.from(block.querySelectorAll(".tdo"));
            if (!tdos.length) continue;

            const sec = el("div", { className: "ig-tl-section" });
            const secTitle = block.querySelector("h2")?.textContent.trim() || "";
            if (secTitle) {
                const h2 = el("h2", { className: "ig-tl-sectitle" });
                h2.textContent = secTitle;
                sec.append(h2);
            }
            const grid = el("div", { className: "ig-tl-grid" });
            for (const tdo of tdos) {
                const a = tdo.querySelector("p a");
                const card = el("div", { className: "ig-tl-card" });
                const cardHead = el("a", { className: "ig-tl-card-head" });
                cardHead.href = a ? a.href : "#";
                const ttl = el("span", { className: "ig-tl-card-title" });
                ttl.textContent = a ? a.textContent.trim() : "";
                const arr = el("span", { className: "ig-tl-card-arrow" });
                arr.innerHTML = ICON.next;
                cardHead.append(ttl, arr);

                const ol = el("ol", { className: "ig-tl-list" });
                for (const tr of tdo.querySelectorAll("table tr")) {
                    const link = tr.querySelector(".tun a");
                    if (!link) continue;
                    const rank = (tr.querySelector(".pso")?.textContent || "").replace(/[^\d]/g, "");
                    const li = el("li", { className: "ig-tl-item" });
                    const rk = el("span", { className: "ig-tl-rank" + (+rank <= 3 ? " top r" + rank : "") });
                    rk.textContent = rank || "•";
                    const la = el("a", { className: "ig-tl-link" });
                    la.href = link.href;
                    la.textContent = link.textContent.trim();
                    li.append(rk, la);
                    ol.append(li);
                }
                card.append(cardHead, ol);
                grid.append(card);
            }
            sec.append(grid);
            wrap.append(sec);
            built++;
        }
        if (!built) return; // not a toplist page after all — leave it native

        document.documentElement.classList.add("ig-listing");
        ido.before(wrap);
        ido.style.display = "none";
    }

    // ===================================================================== //
    //  Torrents (torrents.php) → modern search + rows + infinite scroll     //
    // ===================================================================== //
    function torrentRow(tr) {
        const tds = tr.querySelectorAll("td");
        const nameA = tr.querySelector('a[href*="gallerytorrents.php"]');
        if (!nameA) return null;
        const galleryA = tr.querySelector('a[href*="/g/"]');
        const uploaderA = tr.querySelector('a[href*="torrents.php?u="]');
        const date = tds[0]?.textContent.trim() || "";
        const size = tds[3]?.textContent.trim() || "";
        const seeds = tds[4]?.textContent.trim() || "0";
        const peers = tds[5]?.textContent.trim() || "0";
        const dls = tds[6]?.textContent.trim() || "0";

        const row = el("div", { className: "ig-tor-row" });
        const main = el("div", { className: "ig-tor-main" });

        // name links to the gallery's torrent list — open a real foreground tab
        // (native used popUp() which the browser parks in the background)
        const name = el("a", { className: "ig-tor-name", target: "_blank", rel: "noopener" });
        name.href = nameA.href;
        name.textContent = nameA.textContent.trim();
        main.append(name);

        const meta = el("div", { className: "ig-tor-meta" });
        const chip = (cls, icon, text, href) => {
            const c = el(href ? "a" : "span", { className: "ig-tor-chip " + cls });
            if (href) { c.href = href; c.target = "_blank"; c.rel = "noopener"; }
            if (icon) c.innerHTML = icon;
            const t = el("span", {});
            t.textContent = text;
            c.append(t);
            return c;
        };
        if (date) meta.append(chip("date", ICON.clock, date));
        if (size) meta.append(chip("size", "", size));
        if (galleryA) meta.append(chip("gal", ICON.grid, "Gallery", galleryA.href));
        if (uploaderA) meta.append(chip("up", ICON.user, uploaderA.textContent.trim(), uploaderA.href));
        main.append(meta);

        const stats = el("div", { className: "ig-tor-stats" });
        const stat = (cls, label, val) => {
            const s = el("div", { className: "ig-tor-stat " + cls });
            const v = el("b", {}); v.textContent = val;
            const l = el("small", {}); l.textContent = label;
            s.append(v, l);
            return s;
        };
        stats.append(stat("seed", "seeds", seeds), stat("peer", "peers", peers), stat("dl", "DLs", dls));

        row.append(main, stats);
        return row;
    }

    function setupTorrents() {
        const ido = document.querySelector(".ido");
        if (!ido) return;
        const table = ido.querySelector("table.itg");
        const rows = table ? Array.from(table.querySelectorAll("tr")).map(torrentRow).filter(Boolean) : [];

        const params = new URLSearchParams(location.search);
        const wrap = el("div", { id: "ig-torrents" });

        // search bar (keeps the native ?search= behaviour)
        const toolbar = el("div", { className: "ig-tor-toolbar" });
        const form = el("form", { className: "ig-tor-search", method: "get" });
        form.action = location.pathname;
        const input = el("input", { className: "ig-tor-input", type: "text", name: "search", placeholder: "Search torrents…", autocomplete: "off" });
        input.value = params.get("search") || "";
        const go = el("button", { type: "submit", className: "ig-tor-go" });
        go.innerHTML = ICON.search + "<span>Search</span>";
        form.append(input, go);
        toolbar.append(form);
        const cntStr = (ido.querySelector("p.ip")?.textContent || "").trim();
        const header = pageHeader({ title: "Torrents", sub: withCount("Browse and download torrents", cntStr, "torrents"), icon: ICON.download });

        const list = el("div", { className: "ig-tor-list" });
        for (const r of rows) list.append(r);
        const status = el("div", { id: "ig-list-status" });
        wrap.append(header, toolbar, list, status);

        if (!rows.length) return; // search with no results etc. — keep native

        document.documentElement.classList.add("ig-listing");
        ido.before(wrap);
        ido.style.display = "none";
        setupTorrentScroll(list, status);
    }

    function setupTorrentScroll(list, status) {
        let page = +(new URLSearchParams(location.search).get("page") || "0");
        let loading = false, done = false;
        const sentinel = el("div", { id: "ig-list-sentinel" });
        list.after(sentinel);
        const nearBottom = () => sentinel.getBoundingClientRect().top <= window.innerHeight + 1200;

        async function loadMore() {
            if (loading || done) return;
            loading = true;
            status.textContent = "Loading…";
            try {
                while (!done && nearBottom()) {
                    if (page >= 99) { done = true; break; } // site caps at 100 pages
                    page++;
                    const u = new URL(location.href);
                    u.searchParams.set("page", page);
                    const res = await fetch(u.href, { credentials: "include" });
                    if (!res.ok) throw new Error(res.status);
                    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
                    const trs = Array.from(doc.querySelectorAll("table.itg tr")).map(torrentRow).filter(Boolean);
                    if (!trs.length) { done = true; break; }
                    for (const r of trs) list.append(r);
                }
                status.textContent = done ? "— end —" : "";
            } catch (e) {
                status.textContent = "Failed to load — scroll to retry.";
            } finally {
                loading = false;
            }
        }
        new IntersectionObserver(() => loadMore(), { rootMargin: "1200px 0px" }).observe(sentinel);
    }

    // ===================================================================== //
    //  Header rebuild                                                       //
    // ===================================================================== //
    // Turn the gallery taglist into filter links by default (click → that tag's page).
    // A "Vote on tags" toggle restores e-hentai's native voting/new-tag UI on demand.
    function setupTagFilterMode(sec) {
        const taglist = sec.querySelector("#taglist");
        if (!taglist) return;
        const links = Array.from(taglist.querySelectorAll("a[onclick]"));
        if (!links.length) return;
        for (const a of links) {
            a.dataset.igVote = a.getAttribute("onclick") || ""; // stash native handler
            a.removeAttribute("onclick"); // filter mode: the href (/tag/…) navigates
        }
        // native voting chrome (new-tags input + vote action bar) — hidden until "Vote" is on
        const voteUI = ["#tagmenu_new", "#tagmenu_act"].map((s) => sec.querySelector(s)).filter(Boolean);
        voteUI.forEach((n) => (n.style.display = "none"));

        let voteMode = false;
        const head = el("div", { className: "ig-tags-head" }, `<span class="ig-tags-title">Tags</span>`);
        const btn = el("button", { type: "button", className: "ig-tag-votebtn" }, ICON.vote + "<span></span>");
        const setMode = (on) => {
            voteMode = on;
            btn.classList.toggle("is-active", on);
            btn.querySelector("span").textContent = on ? "Done" : "Vote on tags";
            for (const a of links) {
                if (on) a.setAttribute("onclick", a.dataset.igVote);
                else a.removeAttribute("onclick");
            }
            voteUI.forEach((n) => (n.style.display = on ? "" : "none"));
            sec.classList.toggle("ig-votemode", on);
        };
        setMode(false);
        btn.addEventListener("click", () => setMode(!voteMode));
        head.append(btn);
        sec.insertBefore(head, sec.firstChild);
    }

    function rebuildHeader() {
        const get = (id) => document.getElementById(id);
        const gm = document.querySelector(".gm");
        if (!gm) return;

        const cover = get("gd1");
        const parts = ["gdc", "gn", "gj", "gdn", "gdd", "gdr"].map(get);
        const tags = get("gd4");
        const actions = get("gd5");
        const fav = get("gdf");

        const header = el("div", { id: "ig-header" });
        const top = el("div", { className: "ig-head-top" });
        const coverWrap = el("div", { className: "ig-cover" });
        const info = el("div", { className: "ig-info" });

        if (cover) coverWrap.append(cover);
        for (const n of parts) if (n) info.append(n);
        top.append(coverWrap, info);
        header.append(top);

        if (tags) {
            const sec = el("div", { className: "ig-tags" });
            sec.append(tags);
            header.append(sec);
            setupTagFilterMode(sec);
        }
        const act = el("div", { className: "ig-actions" });
        if (actions) {
            actions.querySelectorAll("a").forEach((a) => {
                // Archive/Torrent use e-hentai's popUp() which opens a popup window that
                // the browser parks in the background. Rewrite to a plain foreground tab.
                const m = /popUp\(\s*['"]([^'"]+)['"]/.exec(a.getAttribute("onclick") || "");
                if (m) {
                    a.removeAttribute("onclick");
                    a.setAttribute("href", m[1]);
                    a.setAttribute("target", "_blank");
                    a.setAttribute("rel", "noopener");
                }
                act.append(a);
            });
        }
        if (fav) act.append(fav);
        if (act.children.length) header.append(act);

        gm.before(header);
        gm.style.display = "none";
    }

    // ===================================================================== //
    //  Masonry grid                                                         //
    // ===================================================================== //
    function createMasonry(gdt) {
        const tiles = [];
        let root = null;
        let metrics = null;
        let lastCols = 0;
        let lastW = 0;

        const measure = () => {
            // deterministic: 90% of the viewport (matches #gdt width:90vw); avoids the
            // element-measure race that overflowed/cut the grid.
            const vw = document.documentElement.clientWidth;
            const fit = vw < 600 ? 150 : TILE_FIT; // denser (~2 cols) on phones, bigger tiles on desktop
            const avail = Math.min(vw * WIDTH_PCT, MAX_W);
            const cols = Math.max(1, Math.min(MAX_COLS, Math.floor((avail + GAP) / (fit + GAP))));
            const colW = Math.min(MAX_COL_W, Math.floor((avail - (cols - 1) * GAP) / cols) - 1); // floor + 1px slack
            return { cols, colW, scale: colW / TILE_BASE };
        };
        const nativeHeight = (a) => {
            const div = a.querySelector("div[style]");
            const m = div && /height:\s*(\d+)px/.exec(div.getAttribute("style") || "");
            return m ? +m[1] : 283;
        };
        const styleTile = (a, h) => {
            a.style.width = metrics.colW + "px";
            a.style.height = Math.round(h * metrics.scale) + "px";
            const div = a.querySelector("div");
            if (!div) return;
            if (a.dataset.hq) {
                // upgraded to a full resampled image — fill the tile box, no sprite transform
                div.style.transform = "none";
                div.style.width = "100%";
                div.style.height = "100%";
            } else {
                div.style.transformOrigin = "top left";
                div.style.transform = "scale(" + metrics.scale + ")";
            }
        };
        const hq = createHqUpgrader();
        const applyGridTemplate = () => {
            // fixed-width columns; CSS grid auto-flow places tiles row-major
            root.style.gridTemplateColumns = `repeat(${metrics.cols}, ${metrics.colW}px)`;
        };
        // Order-preserving: tiles flow row-major in the exact order they appear in the
        // gallery, so pages stay 1,2,3… in reading order. (The old shortest-column
        // masonry packed tighter but reshuffled the sequence.)
        const place = ({ a, h }) => {
            styleTile(a, h);
            root.appendChild(a);
        };
        const relayout = () => {
            metrics = measure();
            lastCols = metrics.cols;
            lastW = metrics.colW;
            applyGridTemplate();
            // tiles are already in document order in the DOM — just re-size them
            for (const t of tiles) styleTile(t.a, t.h);
        };

        return {
            init() {
                const initial = Array.from(gdt.querySelectorAll(":scope > a"));
                root = el("div", { id: "ig-masonry" });
                gdt.textContent = "";
                gdt.appendChild(root);
                metrics = measure();
                lastCols = metrics.cols;
                lastW = metrics.colW;
                applyGridTemplate();
                this.add(initial);

                // re-measure from the real container whenever its width settles/changes
                const ro = new ResizeObserver(
                    debounce(() => {
                        const m = measure();
                        if (m.cols !== lastCols || Math.abs(m.colW - lastW) > 1) relayout();
                    }, 120),
                );
                ro.observe(gdt);
            },
            add(newTiles) {
                for (const a of newTiles) {
                    // capture native height + original sprite thumb BEFORE any HQ upgrade
                    const t = { a, h: nativeHeight(a), thumb: a.querySelector("div")?.outerHTML || "" };
                    tiles.push(t);
                    place(t);
                    hq.observe(a); // lazily upgrade to resampled quality when in view
                }
            },
            count() {
                return tiles.length;
            },
            items() {
                return tiles.map((t) => ({ href: t.a.href, thumb: t.thumb }));
            },
            hqRun() {
                return hq.runVisible();
            },
            hqOnProgress(cb) {
                hq.onProgress(cb);
            },
        };
    }

    function readGpc() {
        const els = Array.from(document.querySelectorAll(".gpc"));
        const text = els[0] ? els[0].textContent : "";
        const total = +(/(of)\s+([\d,]+)\s+images/i.exec(text)?.[2] || "0").replace(/,/g, "");
        const range = /([\d,]+)\s*-\s*([\d,]+)/.exec(text);
        const per = range ? +range[2].replace(/,/g, "") - +range[1].replace(/,/g, "") + 1 : 0;
        return {
            total,
            pages: total && per ? Math.ceil(total / per) : Infinity,
            update(loaded) {
                if (!total) return;
                for (const e of els) e.textContent = `Showing 1 - ${loaded} of ${total} images`;
            },
        };
    }

    function setupInfiniteScroll(gdt, masonry, gpc) {
        const sentinel = el("div", { id: "ig-sentinel" });
        const status = el("div", { id: "ig-status" });
        gdt.after(status);
        gdt.after(sentinel);

        let page = +(new URL(location.href).searchParams.get("p") || "0");
        const lastPage = gpc.pages - 1;
        let loading = false;
        let done = false;

        const nearBottom = () => sentinel.getBoundingClientRect().top <= window.innerHeight + 1500;
        const finish = (msg) => {
            done = true;
            observer.disconnect();
            status.textContent = msg;
        };
        async function loadPage() {
            if (page >= lastPage) {
                finish("— end of gallery —");
                return false;
            }
            page += 1;
            status.textContent = "Loading…";
            const url = new URL(location.href);
            url.searchParams.set("p", page);
            try {
                const res = await fetch(url.href, { credentials: "include" });
                if (!res.ok) throw new Error(res.status);
                const doc = new DOMParser().parseFromString(await res.text(), "text/html");
                const t = Array.from(doc.querySelectorAll("#gdt > a")).map((a) => document.importNode(a, true));
                if (!t.length) {
                    finish("— end of gallery —");
                    return false;
                }
                masonry.add(t);
                gpc.update(masonry.count());
                status.textContent = "";
                return true;
            } catch (e) {
                page -= 1;
                status.textContent = "Failed to load — scroll to retry.";
                return false;
            }
        }
        async function loadNext() {
            if (loading || done) return;
            loading = true;
            try {
                while (!done && nearBottom() && (await loadPage())) {
                    /* keep filling */
                }
            } finally {
                loading = false;
            }
        }
        const observer = new IntersectionObserver(() => loadNext(), { rootMargin: "1500px 0px" });
        observer.observe(sentinel);
    }

    // ===================================================================== //
    //  List view — vertical reader, full-size, original quality, lazy       //
    // ===================================================================== //
    function createListView(gdt) {
        const list = el("div", { id: "ig-list" });
        gdt.after(list);
        let built = false;
        let io = null;

        const loadItem = async (item) => {
            if (item.dataset.loaded) return;
            item.dataset.loaded = "1";
            const href = item.dataset.href;
            const img = item.querySelector("img");
            try {
                const url = await resolveUrl(href, false); // resampled — fast, loads directly, no quota burn
                if (!url) throw new Error("no url");
                img.onerror = async () => {
                    img.onerror = null;
                    try {
                        const blob = (await gmGet(url, "blob", { Referer: href })).response;
                        img.src = URL.createObjectURL(blob);
                    } catch (e) {
                        item.classList.add("ig-list-err");
                    }
                };
                img.onload = () => item.classList.add("ig-list-ok");
                img.src = url;
            } catch (e) {
                item.classList.add("ig-list-err");
            }
        };

        return {
            el: list,
            async ensure() {
                if (built) return;
                built = true;
                const all = await ensureFullList();
                io = new IntersectionObserver(
                    (entries) => {
                        for (const e of entries) if (e.isIntersecting) loadItem(e.target);
                    },
                    { rootMargin: "1200px 0px" },
                );
                for (const it of all) {
                    const row = el("div", { className: "ig-list-item" });
                    row.dataset.href = it.href;
                    row.append(el("img", { alt: "", loading: "lazy" }));
                    list.appendChild(row);
                    io.observe(row);
                }
            },
        };
    }

    // ===================================================================== //
    //  Fullscreen viewer (modal) + filmstrip + resolution                   //
    // ===================================================================== //
    function setupModal(gdt, masonry) {
        let items = [];
        let idx = 0;
        let open = false;
        let expanded = false;                  // whether the full image list has been fetched
        const gpcTotal = readGpc().total;      // total images in the gallery (0 if unknown)

        // resume reading: remember the last page viewed in this gallery
        const gid = (location.pathname.match(/\/g\/(\d+)\//) || [])[1] || "";
        const resumeKey = gid ? "ig-resume-" + gid : "";
        const saveResume = (i) => {
            if (!resumeKey) return;
            try { localStorage.setItem(resumeKey, String(i)); } catch (e) {}
        };
        const getResume = () => {
            if (!resumeKey) return 0;
            try { return +localStorage.getItem(resumeKey) || 0; } catch (e) { return 0; }
        };

        const modal = el("div", { id: "ig-modal" });
        modal.innerHTML =
            `<div class="ig-modal-counter"></div>` +
            `<button class="ig-modal-close" type="button" aria-label="Close">${ICON.close}</button>` +
            `<button class="ig-modal-stripbtn" type="button" aria-label="Toggle thumbnails">${ICON.film}</button>` +
            `<a class="ig-modal-open" target="_blank" rel="noopener" aria-label="Open image page in a new tab">${ICON.external}</a>` +
            `<button class="ig-modal-nav ig-modal-prev" type="button" aria-label="Previous">${ICON.up}</button>` +
            `<button class="ig-modal-nav ig-modal-next" type="button" aria-label="Next">${ICON.down}</button>` +
            `<div class="ig-modal-stage"><div class="ig-modal-spinner"></div><img class="ig-modal-img" alt=""><div class="ig-modal-res"></div></div>` +
            `<div class="ig-modal-strip"></div>`;
        document.body.appendChild(modal);

        const imgEl = modal.querySelector(".ig-modal-img");
        const counter = modal.querySelector(".ig-modal-counter");
        const resLabel = modal.querySelector(".ig-modal-res");
        const stage = modal.querySelector(".ig-modal-stage");
        const strip = modal.querySelector(".ig-modal-strip");
        const openLink = modal.querySelector(".ig-modal-open");

        const buildStrip = () => {
            strip.textContent = "";
            items.forEach((it, i) => {
                const cell = el("div", { className: "ig-strip-item" });
                cell.dataset.i = i;
                if (it.thumb) {
                    cell.innerHTML = it.thumb;
                    const div = cell.firstElementChild;
                    const h = +(/(height):\s*(\d+)px/.exec(div.getAttribute("style") || "")?.[2] || 283);
                    const scale = 52 / h;
                    div.style.transformOrigin = "top left";
                    div.style.transform = "scale(" + scale + ")";
                    cell.style.width = Math.round(TILE_BASE * scale) + "px";
                }
                strip.appendChild(cell);
            });
        };
        const markStrip = () => {
            strip.querySelectorAll(".ig-strip-item").forEach((c) => c.classList.toggle("active", +c.dataset.i === idx));
            const active = strip.querySelector(".ig-strip-item.active");
            if (active) active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
        };

        const preload = async (i) => {
            if (i < 0 || i >= items.length) return;
            try {
                const u = await resolveUrl(items[i].href, false);
                if (u) new Image().src = u;
            } catch (e) {}
        };
        async function show(i) {
            if (!items.length) return;
            idx = (i + items.length) % items.length;
            if (!expanded && gpcTotal && items.length < gpcTotal && idx >= items.length - 3) expandOnce();
            openLink.href = items[idx].href;
            counter.textContent = `${idx + 1} / ${gpcTotal || items.length}`;
            resLabel.textContent = "";
            saveResume(idx);
            hideResumePill();
            markStrip();
            modal.classList.add("loading");
            imgEl.style.opacity = "0";
            const href = items[idx].href;
            let url;
            try {
                url = await resolveUrl(href, false);
            } catch (e) {}
            if (!open || items[idx].href !== href) return;
            if (!url) {
                modal.classList.remove("loading");
                return;
            }
            imgEl.onload = () => {
                modal.classList.remove("loading");
                imgEl.style.opacity = "1";
                if (imgEl.naturalWidth) resLabel.textContent = `${imgEl.naturalWidth} × ${imgEl.naturalHeight}`;
            };
            imgEl.onerror = async () => {
                imgEl.onerror = null;
                try {
                    const blob = (await gmGet(url, "blob", { Referer: href })).response;
                    imgEl.src = URL.createObjectURL(blob);
                } catch (e) {
                    modal.classList.remove("loading");
                }
            };
            imgEl.src = url;
            preload(idx + 1);
        }
        const step = (d) => show(idx + d);
        const close = () => {
            open = false;
            modal.classList.remove("open");
            document.documentElement.style.overflow = "";
            imgEl.removeAttribute("src");
        };

        modal.querySelector(".ig-modal-close").addEventListener("click", close);
        modal.querySelector(".ig-modal-prev").addEventListener("click", () => step(-1));
        modal.querySelector(".ig-modal-next").addEventListener("click", () => step(1));

        // show/hide the thumbnail filmstrip (remembered)
        const stripBtn = modal.querySelector(".ig-modal-stripbtn");
        const setStrip = (show) => {
            modal.classList.toggle("ig-nostrip", !show);
            stripBtn.classList.toggle("is-active", show);
            stripBtn.title = show ? "Hide thumbnails" : "Show thumbnails";
            try { localStorage.setItem("ig-modal-strip", show ? "1" : "0"); } catch (e) {}
        };
        stripBtn.addEventListener("click", () => setStrip(modal.classList.contains("ig-nostrip")));
        setStrip((() => { try { return localStorage.getItem("ig-modal-strip") !== "0"; } catch (e) { return true; } })());
        stage.addEventListener("click", (e) => {
            if (e.target === stage) close();
        });
        strip.addEventListener("click", (e) => {
            const cell = e.target.closest(".ig-strip-item");
            if (cell) show(+cell.dataset.i);
        });

        // wheel = vertical paging (down → next, up → prev), with a short cooldown so a
        // single trackpad gesture advances one image
        let wheelLock = false;
        stage.addEventListener("wheel", (e) => {
            if (Math.abs(e.deltaY) < 4) return;
            e.preventDefault();
            if (wheelLock) return;
            wheelLock = true;
            setTimeout(() => (wheelLock = false), 320);
            step(e.deltaY > 0 ? 1 : -1);
        }, { passive: false });

        // swipe up/down on the image to navigate (mobile)
        let tsx = 0, tsy = 0;
        stage.addEventListener("touchstart", (e) => {
            if (e.touches.length === 1) { tsx = e.touches[0].clientX; tsy = e.touches[0].clientY; }
        }, { passive: true });
        stage.addEventListener("touchend", (e) => {
            const t = e.changedTouches[0];
            const dx = t.clientX - tsx, dy = t.clientY - tsy;
            if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx) * 1.3) step(dy < 0 ? 1 : -1);
        }, { passive: true });

        // grab-to-scroll the filmstrip (desktop); touch scroll is native via overflow-x
        let gDown = false, gx = 0, gScroll = 0, gMoved = 0;
        strip.addEventListener("mousedown", (e) => { gDown = true; gx = e.pageX; gScroll = strip.scrollLeft; gMoved = 0; strip.classList.add("grabbing"); });
        window.addEventListener("mousemove", (e) => { if (gDown) { const d = e.pageX - gx; gMoved = Math.max(gMoved, Math.abs(d)); strip.scrollLeft = gScroll - d; } });
        window.addEventListener("mouseup", () => { gDown = false; strip.classList.remove("grabbing"); });
        strip.addEventListener("click", (e) => { if (gMoved > 6) { e.stopPropagation(); e.preventDefault(); } }, true); // ignore click after a drag

        document.addEventListener("keydown", (e) => {
            if (!open) return;
            if (e.key === "Escape") close();
            else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                step(1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                step(-1);
            }
        });

        // fetch the full image list only when needed (near the end of the loaded thumbs),
        // instead of fetching every gallery thumb-page the moment the viewer opens
        function expandOnce() {
            if (expanded) return;
            expanded = true;
            ensureFullList().then((full) => {
                if (!open || !full.length) return;
                const cur = items[idx]?.href;
                items = full;
                const ni = full.findIndex((x) => x.href === cur);
                if (ni >= 0) idx = ni;
                buildStrip();
                counter.textContent = `${idx + 1} / ${items.length}`;
                markStrip();
            });
        }

        const openFrom = (href) => {
            items = masonry.items();
            idx = Math.max(0, items.findIndex((x) => x.href === href));
            open = true;
            modal.classList.add("open");
            document.documentElement.style.overflow = "hidden";
            buildStrip();
            show(idx);
        };

        // open straight at a page index (used by the "continue reading" pill)
        const openAt = (pageIndex) => {
            open = true;
            expanded = true;   // resume jumps to an arbitrary page → needs the full list now
            modal.classList.add("open");
            document.documentElement.style.overflow = "hidden";
            items = masonry.items();
            buildStrip();
            show(Math.min(pageIndex, Math.max(0, items.length - 1)));
            ensureFullList().then((full) => {
                if (!open || !full.length) return;
                items = full;
                buildStrip();
                show(Math.min(pageIndex, items.length - 1));
            });
        };

        // "continue reading" pill — appears if a previous page was remembered
        let resumePill = null;
        function hideResumePill() {
            if (resumePill) { resumePill.remove(); resumePill = null; }
        }
        (function maybeShowResume() {
            const r = getResume();
            if (!r) return;
            resumePill = el("button", { type: "button", className: "ig-resume" }, ICON.clock + `<span>Continue · page ${r + 1}</span>`);
            resumePill.addEventListener("click", () => { hideResumePill(); openAt(r); });
            document.body.appendChild(resumePill);
        })();

        gdt.addEventListener("click", (e) => {
            const a = e.target.closest("a");
            if (!a || !/\/s\//.test(a.href)) return;
            e.preventDefault();
            openFrom(a.href);
        });
        // list-view rows open the modal too
        document.addEventListener("click", (e) => {
            const row = e.target.closest("#ig-list .ig-list-item");
            if (row && row.dataset.href) openFrom(row.dataset.href);
        });
    }

    // ===================================================================== //
    //  Download engine                                                      //
    // ===================================================================== //
    async function fetchImage(pageHref, original, attempt, nlState) {
        let pageUrl = pageHref;
        if (attempt > 0 && nlState.token) pageUrl += (pageUrl.includes("?") ? "&" : "?") + "nl=" + nlState.token;
        const html = (await gmGet(pageUrl)).responseText;
        nlState.token = RE_NL.exec(html)?.[1] || nlState.token;
        let src = null;
        if (original) {
            src = RE_ORIGINAL.exec(html)?.[1]?.replace(/&amp;/g, "&");
            if (src && pageUrl.includes("?")) src += (src.includes("?") ? "&" : "?") + pageUrl.split("?").pop();
        }
        if (!src) src = RE_NORMAL.exec(html)?.[1];
        if (!src) throw new Error("no image URL");
        if (src.endsWith("509.gif")) throw fatal("509 — image/bandwidth quota exceeded. Reset your quota and retry.");
        const blob = (await gmGet(src, "blob", { Referer: pageUrl })).response;
        if (blob.type.startsWith("text")) {
            if (blob.size === 1329) throw fatal("Original downloads require being logged in.");
            const body = await blob.text();
            if (body.startsWith("Downloading original")) throw fatal(body.trim());
            throw new Error("unexpected text response");
        }
        const ext = (src.split("?")[0].match(/\.(\w{2,4})$/)?.[1] || "jpg").toLowerCase();
        return { blob, ext };
    }

    async function downloadGallery(original, gpc, note) {
        const list = await discoverImagePages(gpc, note);
        if (!list.length) throw new Error("no images found");
        const msg = original
            ? `Download ${list.length} images in ORIGINAL quality?\n\nOriginals require being logged in and consume your image quota.`
            : `Download ${list.length} images (resampled)?`;
        if (!confirm(msg)) {
            note("Cancelled.");
            return;
        }
        const results = new Array(list.length);
        let done = 0;
        let stopped = null;
        let cursor = 0;
        async function worker() {
            while (cursor < list.length && !stopped) {
                const i = cursor++;
                const { href, title } = list[i];
                const nlState = { token: null };
                let saved = null;
                for (let attempt = 0; attempt < 3 && !stopped; attempt++) {
                    try {
                        saved = await fetchImage(href, original, attempt, nlState);
                        break;
                    } catch (e) {
                        if (e.fatal) {
                            stopped = e;
                            break;
                        }
                    }
                }
                results[i] = saved ? { ...saved, title, i } : null;
                done++;
                note(`Downloading… ${done}/${list.length}`);
            }
        }
        await Promise.all(Array.from({ length: Math.min(THREADS, list.length) }, worker));
        if (stopped) throw stopped;
        note("Zipping…");
        if (typeof zip === "undefined" || typeof saveAs === "undefined") throw new Error("zip.js / FileSaver not loaded");
        zip.configure({ useWebWorkers: false });
        const writer = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
        const used = new Set();
        let ok = 0;
        for (const r of results) {
            if (!r) continue;
            const pad = String(r.i + 1).padStart(4, "0");
            let name = r.title ? sanitize(r.title) : `${pad}.${r.ext}`;
            if (!/\.\w{2,4}$/.test(name)) name += "." + r.ext;
            if (used.has(name)) name = `${pad}_${name}`;
            used.add(name);
            await writer.add(name, new zip.BlobReader(r.blob));
            ok++;
        }
        const outBlob = await writer.close();
        saveAs(outBlob, galleryTitle() + ".zip");
        const failed = list.length - ok;
        note(`Done — ${ok} images${failed ? `, ${failed} failed` : ""}.`);
    }

    const sanitize = (s) => s.replace(/[\\/:*?"<>|\n\t]/g, "_").slice(0, 120);
    const galleryTitle = () =>
        sanitize(document.querySelector("#gn")?.textContent || document.querySelector("#gj")?.textContent || document.title || "gallery");

    // The gallery's "File Size" row is the ORIGINAL total download size.
    const galleryFileSize = () => {
        for (const tr of document.querySelectorAll("#gdd tr")) {
            if (/file size/i.test(tr.querySelector(".gdt1")?.textContent || "")) {
                return (tr.querySelector(".gdt2")?.textContent || "").trim();
            }
        }
        return "";
    };

    // ===================================================================== //
    //  Floating dock                                                        //
    // ===================================================================== //
    // On a single-image page (/s/<key>/<gid>-<page>) find the link back to its gallery.
    function galleryUrlFromImagePage() {
        const m = location.pathname.match(/^\/s\/[^/]+\/(\d+)-\d+/);
        if (!m) return null;
        const gid = m[1];
        const exact = document.querySelector(`a[href*="/g/${gid}/"]`);
        if (exact) return exact.href;
        const any = document.querySelector('a[href*="/g/"]');
        return any ? any.href : null;
    }

    // Fixed bottom navigation — shown only on mobile (CSS), replaces the topbar there.
    function buildBottomNav() {
        const o = homeOrigin;
        // mirrors the topbar: browse destinations + Search + the account menu ("Me")
        const items = [
            { icon: ICON.home, label: "Home", href: o + "/" },
            { icon: ICON.fire, label: "Popular", href: o + "/popular" },
            { icon: ICON.search, label: "Search", action: "search", center: true },
            { icon: ICON.heart, label: "Favorites", href: o + "/favorites.php" },
            { icon: ICON.user, label: "Me", action: "account" },
        ];
        const nav = el("nav", { id: "ig-botnav" });
        for (const it of items) {
            const a = el(it.href ? "a" : "button", { className: "ig-botnav-item" + (it.center ? " center" : "") + (it.action === "account" ? " ig-botnav-me" : "") });
            if (it.href) a.href = it.href;
            else a.type = "button";
            if (it.href && isCurrentPath(it.href)) a.classList.add("is-current");
            a.innerHTML = `<span class="ig-botnav-ico">${it.icon}</span><span class="ig-botnav-lbl"></span>`;
            a.querySelector(".ig-botnav-lbl").textContent = it.label;
            if (it.action === "search") a.addEventListener("click", (e) => { e.preventDefault(); searchOpener && searchOpener(); });
            if (it.action === "account") a.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); accountOpener && accountOpener(); });
            nav.append(a);
        }
        document.body.appendChild(nav);
    }

    // Standalone "back to gallery" pill on /s/ image pages (the dock is gallery-only now).
    function addBackFab(href) {
        const b = el("a", { id: "ig-backfab", href, title: "Back to gallery" }, ICON.back + `<span>Gallery</span>`);
        document.body.appendChild(b);
    }

    // Gallery-only floating action button: expands to view-toggle / HQ / download.
    function setupGalleryFab(masonry, listView) {
        const fab = el("div", { id: "ig-fab" });
        const mkAction = (act, icon, label) => {
            const b = el("button", { type: "button", className: "ig-fab-action", title: label }, icon);
            b.dataset.act = act;
            b.dataset.label = label;
            return b;
        };
        const viewBtn = mkAction("view", ICON.list, "List view");
        const hqBtn = mkAction("hq", ICON.sparkle, "HQ thumbnails");
        const dlBtn = mkAction("download", ICON.download, "Download");
        const actions = el("div", { className: "ig-fab-actions" });
        actions.append(viewBtn, hqBtn, dlBtn);
        const main = el("button", { id: "ig-fab-main", type: "button", title: "Tools" }, ICON.controls);
        fab.append(actions, main); // actions stack above; hidden until open
        document.body.appendChild(fab);

        // download popover (anchored near the FAB)
        const dlPop = el("div", { className: "ig-pop", id: "ig-pop-dl", hidden: true });
        const note = el("div", { className: "ig-pop-note" });
        const gpc = readGpc();
        const size = galleryFileSize();
        let busy = false;
        const run = async (original) => {
            if (busy) return;
            busy = true;
            fab.classList.add("is-busy");
            dlPop.querySelectorAll(".ig-pop-opt").forEach((x) => (x.disabled = true));
            try {
                await downloadGallery(original, gpc, (t) => (note.textContent = t));
            } catch (e) {
                note.textContent = "Error: " + e.message;
            } finally {
                busy = false;
                fab.classList.remove("is-busy");
                dlPop.querySelectorAll(".ig-pop-opt").forEach((x) => (x.disabled = false));
            }
        };
        const a = el("button", { type: "button", className: "ig-pop-opt" });
        a.innerHTML = `<span>⬇ Original <small>max quality</small></span>${size ? `<span class="ig-pop-size">${size}</span>` : ""}`;
        const b = el("button", { type: "button", className: "ig-pop-opt" });
        b.innerHTML = `<span>⬇ Resampled <small>saves quota</small></span>${size ? `<span class="ig-pop-size">&lt; ${size}</span>` : ""}`;
        a.addEventListener("click", () => run(true));
        b.addEventListener("click", () => run(false));
        dlPop.append(a, b, note);
        document.body.append(dlPop);

        let isOpen = false;
        const setOpen = (on) => {
            isOpen = on;
            fab.classList.toggle("open", on);
            main.innerHTML = on ? ICON.close : ICON.controls;
            if (!on) dlPop.hidden = true;
        };

        // grid <-> list view toggle — class-based so it beats #gdt's display:block !important
        let mode = "grid";
        const setMode = async (m) => {
            mode = m;
            if (m === "list") {
                viewBtn.innerHTML = ICON.grid;
                viewBtn.dataset.label = "Grid view";
                document.documentElement.classList.add("ig-listmode");
                await listView.ensure();
            } else {
                viewBtn.innerHTML = ICON.list;
                viewBtn.dataset.label = "List view";
                document.documentElement.classList.remove("ig-listmode");
            }
        };

        // HQ thumbnails — one-shot per screen (never persisted, never auto-on, to protect quota)
        if (masonry && masonry.hqOnProgress) masonry.hqOnProgress((n) => hqBtn.classList.toggle("is-working", n > 0));

        main.addEventListener("click", (e) => {
            e.stopPropagation();
            setOpen(!isOpen);
        });
        actions.addEventListener("click", (e) => {
            const btn = e.target.closest(".ig-fab-action");
            if (!btn) return;
            const act = btn.dataset.act;
            if (act === "view") setMode(mode === "grid" ? "list" : "grid");
            else if (act === "hq") { if (masonry) masonry.hqRun(); }
            else if (act === "download") dlPop.hidden = !dlPop.hidden;
        });
        document.addEventListener("click", (e) => {
            if (!fab.contains(e.target) && !e.target.closest(".ig-pop")) setOpen(false);
        });
    }

    // ===================================================================== //
    //  Search modal (command-palette portal): keywords + category chips     //
    // ===================================================================== //
    function buildSearch() {
        const CATS = EH_CATS;
        const ALL_CATS = EH_ALL_CATS;
        const LANGS = EH_LANGS;
        // ---- search history (paged, removable; modelled on the SMG overhaul script) ----
        const RECENT_KEY = "ig-eh-recent";
        const HIST_PAGE = 10;
        const HIST_MAX = 1000;
        let histExpanded = false;
        let histPage = 0;
        const loadHist = () => {
            try {
                const a = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
                // migrate legacy entries (plain strings) → {q,url}
                return (Array.isArray(a) ? a : []).map((e) => (typeof e === "string" ? { q: e, url: homeOrigin + "/?f_search=" + encodeURIComponent(e) } : e)).filter((e) => e && e.url);
            } catch (e) {
                return [];
            }
        };
        const saveHist = (a) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(a.slice(0, HIST_MAX))); } catch (e) {} };
        const addHist = (entry) => {
            if (!entry || !entry.url) return;
            const a = loadHist().filter((e) => e.url !== entry.url);
            a.unshift(entry);
            saveHist(a);
        };
        const removeHist = (url) => { saveHist(loadHist().filter((e) => e.url !== url)); renderRecent(); };
        const clearHist = () => {
            if (!confirm("Clear your search history?")) return;
            saveHist([]); histExpanded = false; histPage = 0; renderRecent();
        };
        const sw = (cls, label) =>
            `<label class="ig-switch"><input type="checkbox" class="ig-adv-${cls}"><span class="ig-switch-track"></span><span class="ig-switch-lbl">${label}</span></label>`;
        const swForm = (name, label, checked) =>
            `<label class="ig-switch"><input type="checkbox" name="${name}" value="on"${checked ? " checked" : ""}><span class="ig-switch-track"></span><span class="ig-switch-lbl">${label}</span></label>`;

        const overlay = el("div", { id: "ig-search", hidden: true });
        overlay.innerHTML = `
            <div class="ig-search-box" role="dialog">
                <div class="ig-search-head">
                    ${ICON.search}
                    <input class="ig-search-field" type="text" placeholder="Search galleries…" autocomplete="off">
                    <kbd class="ig-search-kbd">esc</kbd>
                </div>
                <div class="ig-ac" hidden></div>
                <div class="ig-sec">
                    <div class="ig-sec-label">Categories <span>· click to include (none = all)</span></div>
                    <div class="ig-search-cats"></div>
                </div>
                <div class="ig-sec">
                    <div class="ig-sec-label">Language</div>
                    <div class="ig-search-langs"></div>
                </div>
                <button class="ig-adv-toggle" type="button">${ICON.sparkle}<span>Advanced</span><span class="ig-adv-caret">▾</span></button>
                <div class="ig-search-adv" hidden>
                    <div class="ig-adv-grid">
                        <div class="ig-adv-field">
                            <span class="ig-adv-cap">Pages</span>
                            <span class="ig-adv-pages"><input type="number" class="ig-adv-pmin" min="0" placeholder="min"><i>–</i><input type="number" class="ig-adv-pmax" min="0" placeholder="max"></span>
                        </div>
                        <div class="ig-adv-field">
                            <span class="ig-adv-cap">Min rating</span>
                            <div class="ig-seg" data-val="0">
                                <button type="button" data-v="0" class="on">Any</button><button type="button" data-v="2">2★</button><button type="button" data-v="3">3★</button><button type="button" data-v="4">4★</button><button type="button" data-v="5">5★</button>
                            </div>
                        </div>
                    </div>
                    <div class="ig-switches">
                        ${sw("ai", "Exclude AI-generated")}
                        ${sw("exp", "Browse expunged")}
                        ${sw("tor", "Require torrent")}
                        ${sw("fl", "Ignore my language filter")}
                        ${sw("fu", "Ignore my uploader filter")}
                        ${sw("ft", "Ignore my tag filter")}
                    </div>
                    <form class="ig-fs" method="post" enctype="multipart/form-data" action="https://upload.e-hentai.org/image_lookup.php">
                        <div class="ig-sec-label">File search <span>· find galleries containing an image</span></div>
                        <div class="ig-fs-row">
                            <label class="ig-fs-file"><input type="file" name="sfile" accept="image/*">${ICON.search}<span class="ig-fs-name">Choose image…</span></label>
                            <button class="ig-fs-go" type="submit" name="f_sfile" value="File Search">File Search</button>
                        </div>
                        <div class="ig-switches">
                            ${swForm("fs_similar", "Similarity scan", true)}
                            ${swForm("fs_covers", "Only covers", false)}
                        </div>
                    </form>
                </div>
                <div class="ig-search-recent"></div>
                <div class="ig-search-foot">
                    <span class="ig-search-hint">Enter to search · ⌘K to toggle</span>
                    <button class="ig-search-go2" type="button">Search</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const $ = (sel) => overlay.querySelector(sel);
        const field = $(".ig-search-field");
        const catsBox = $(".ig-search-cats");

        // ---- tag autocomplete ----
        const acBox = $(".ig-ac");
        let acItems = [];
        let acSel = -1;
        const acToken = () => {
            const v = field.value;
            const end = field.selectionStart ?? v.length;
            const start = v.lastIndexOf(" ", end - 1) + 1;
            return { start, end, token: v.slice(start, end) };
        };
        const acHide = () => { acBox.hidden = true; acItems = []; acSel = -1; };
        const acRender = () => {
            const q = acToken().token.trim().toLowerCase();
            if (q.length < 2) return acHide();
            const starts = [], incl = [];
            for (const t of tagStore.all()) {
                const lt = t.toLowerCase();
                if (lt.startsWith(q)) starts.push(t);
                else if (lt.includes(q)) incl.push(t);
            }
            acItems = [...starts, ...incl].slice(0, 8);
            if (!acItems.length) return acHide();
            acSel = -1;
            acBox.innerHTML = acItems
                .map((t, i) => `<button type="button" class="ig-ac-item" data-i="${i}">${ICON.search}<span></span></button>`)
                .join("");
            acBox.querySelectorAll(".ig-ac-item span").forEach((s, i) => (s.textContent = acItems[i]));
            acBox.hidden = false;
        };
        const acAccept = (t) => {
            const { start, end } = acToken();
            const v = field.value;
            const piece = (t.includes(" ") ? t.replace(/^([a-z]+):(.+)$/, '$1:"$2"') : t) + "$ ";
            field.value = v.slice(0, start) + piece + v.slice(end);
            const pos = start + piece.length;
            field.setSelectionRange(pos, pos);
            acHide();
            field.focus();
        };
        const acMove = (d) => {
            if (acBox.hidden || !acItems.length) return;
            acSel = (acSel + d + acItems.length) % acItems.length;
            acBox.querySelectorAll(".ig-ac-item").forEach((b, i) => b.classList.toggle("sel", i === acSel));
        };
        field.addEventListener("input", acRender);
        acBox.addEventListener("mousedown", (e) => {
            const b = e.target.closest(".ig-ac-item");
            if (!b) return;
            e.preventDefault(); // beat the field blur
            acAccept(acItems[+b.dataset.i]);
        });
        const langsBox = $(".ig-search-langs");
        const recentBox = $(".ig-search-recent");

        // category INCLUDE chips (none selected = all categories) + the Artbook tag chip
        const selected = new Set();
        const selectedTags = new Set();
        const catChipEls = [];
        const isOn = (c) => (c.tag ? selectedTags.has(c.tag) : c.bits.every((b) => selected.has(b)));
        const refreshCats = () => catChipEls.forEach((x) => x.node.classList.toggle("is-on", isOn(x.c)));
        for (const c of catChips()) {
            const chip = el("button", { type: "button", className: "ig-cat" }, c.label);
            chip.style.setProperty("--c", c.color);
            catChipEls.push({ node: chip, c });
            chip.addEventListener("click", () => {
                if (c.tag) {
                    selectedTags.has(c.tag) ? selectedTags.delete(c.tag) : selectedTags.add(c.tag);
                } else {
                    const allOn = c.bits.every((b) => selected.has(b));
                    c.bits.forEach((b) => (allOn ? selected.delete(b) : selected.add(b)));
                }
                refreshCats();
            });
            catsBox.appendChild(chip);
        }

        // language chips (single-select → adds a language:X$ tag)
        let langSel = null;
        for (const lang of LANGS) {
            const chip = el("button", { type: "button", className: "ig-lang" }, lang[0].toUpperCase() + lang.slice(1));
            chip.addEventListener("click", () => {
                if (langSel === lang) {
                    langSel = null;
                    chip.classList.remove("is-on");
                } else {
                    langSel = lang;
                    langsBox.querySelectorAll(".ig-lang").forEach((c) => c.classList.remove("is-on"));
                    chip.classList.add("is-on");
                }
            });
            langsBox.appendChild(chip);
        }

        // advanced toggle
        const advToggle = $(".ig-adv-toggle");
        const advBox = $(".ig-search-adv");
        advToggle.addEventListener("click", () => {
            advBox.hidden = !advBox.hidden;
            advToggle.classList.toggle("is-open", !advBox.hidden);
        });

        // segmented rating
        const seg = $(".ig-seg");
        seg.addEventListener("click", (e) => {
            const b = e.target.closest("button");
            if (!b) return;
            seg.dataset.val = b.dataset.v;
            seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
        });

        // file picker label
        const fileInput = $(".ig-fs input[type=file]");
        fileInput.addEventListener("change", () => {
            $(".ig-fs-name").textContent = fileInput.files[0]?.name || "Choose image…";
        });

        const submit = () => {
            const text = field.value.trim();
            const parts = [text];
            if (langSel) parts.push("language:" + langSel + "$");
            for (const t of selectedTags) parts.push(t); // e.g. Artbook → other:artbook$
            if ($(".ig-adv-ai").checked) parts.push('-other:"ai generated"$');
            const q = parts.filter(Boolean).join(" ");

            const p = new URLSearchParams();
            p.set("f_search", q);
            const inc = [...selected];
            if (inc.length) p.set("f_cats", ALL_CATS - inc.reduce((s, b) => s + b, 0)); // exclude everything not included

            let adv = false;
            const pmin = $(".ig-adv-pmin").value.trim();
            const pmax = $(".ig-adv-pmax").value.trim();
            const rating = seg.dataset.val;
            if (pmin) { p.set("f_spf", pmin); adv = true; }
            if (pmax) { p.set("f_spt", pmax); adv = true; }
            if (rating !== "0") { p.set("f_sr", "on"); p.set("f_srdd", rating); adv = true; }
            if ($(".ig-adv-exp").checked) { p.set("f_sh", "on"); adv = true; }
            if ($(".ig-adv-tor").checked) { p.set("f_sto", "on"); adv = true; }
            if ($(".ig-adv-fl").checked) { p.set("f_sfl", "on"); adv = true; }
            if ($(".ig-adv-fu").checked) { p.set("f_sfu", "on"); adv = true; }
            if ($(".ig-adv-ft").checked) { p.set("f_sft", "on"); adv = true; }
            if (adv) p.set("advsearch", "1");

            const url = homeOrigin + "/?" + p.toString();
            addHist({ q: text, url });
            location.href = url;
        };

        function renderRecent() {
            const all = loadHist();
            if (!all.length) { recentBox.hidden = true; recentBox.innerHTML = ""; return; }
            recentBox.hidden = false;
            const pages = Math.max(1, Math.ceil(all.length / HIST_PAGE));
            if (histPage >= pages) histPage = pages - 1;
            if (histPage < 0) histPage = 0;
            const items = histExpanded ? all.slice(histPage * HIST_PAGE, histPage * HIST_PAGE + HIST_PAGE) : all.slice(0, 5);

            recentBox.innerHTML = "";
            const head = el("div", { className: "ig-hist-head" });
            head.innerHTML = `<span class="ig-hist-title">Recent</span><span class="ig-hist-badge"></span>`;
            head.querySelector(".ig-hist-badge").textContent = all.length;
            const toggle = el("button", { type: "button", className: "ig-hist-toggle" });
            toggle.textContent = histExpanded ? "Show less" : "Show all";
            toggle.hidden = all.length <= 5;
            toggle.addEventListener("click", () => { histExpanded = !histExpanded; histPage = 0; renderRecent(); });
            const clear = el("button", { type: "button", className: "ig-hist-clear", title: "Clear history" }, ICON.close);
            clear.addEventListener("click", clearHist);
            head.append(toggle, clear);
            recentBox.append(head);

            const list = el("div", { className: "ig-hist-list" });
            for (const e of items) {
                const row = el("button", { type: "button", className: "ig-search-recent-item" }, `${ICON.clock}<span class="ig-hist-q"></span><span class="ig-hist-x" role="button" aria-label="Remove">${ICON.close}</span>`);
                row.querySelector(".ig-hist-q").textContent = e.q || "Filtered search";
                row.addEventListener("click", () => { location.href = e.url; });
                row.querySelector(".ig-hist-x").addEventListener("click", (ev) => { ev.stopPropagation(); removeHist(e.url); });
                list.append(row);
            }
            recentBox.append(list);

            if (histExpanded && pages > 1) {
                const pager = el("div", { className: "ig-hist-pager" });
                pager.innerHTML = `<button type="button" class="ig-hist-pg" data-d="-1" aria-label="Prev">‹</button><span class="ig-hist-count">${histPage + 1} / ${pages}</span><button type="button" class="ig-hist-pg" data-d="1" aria-label="Next">›</button>`;
                const pgs = pager.querySelectorAll(".ig-hist-pg");
                pgs[0].disabled = histPage <= 0;
                pgs[1].disabled = histPage >= pages - 1;
                pgs.forEach((b) => b.addEventListener("click", () => { histPage += +b.dataset.d; renderRecent(); }));
                recentBox.append(pager);
            }
        }

        const close = () => (overlay.hidden = true);
        const open = () => {
            overlay.hidden = false;
            renderRecent();
            setTimeout(() => field.focus(), 30);
        };

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) close();
        });
        $(".ig-search-go2").addEventListener("click", submit);
        field.addEventListener("keydown", (e) => {
            if (!acBox.hidden && acItems.length) {
                if (e.key === "ArrowDown") { e.preventDefault(); acMove(1); return; }
                if (e.key === "ArrowUp") { e.preventDefault(); acMove(-1); return; }
                if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); acHide(); return; }
                if ((e.key === "Enter" || e.key === "Tab") && acSel >= 0) { e.preventDefault(); acAccept(acItems[acSel]); return; }
            }
            if (e.key === "Enter") submit();
        });
        document.addEventListener("keydown", (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                overlay.hidden ? open() : close();
            } else if (e.key === "Escape" && !overlay.hidden) {
                close();
            }
        });

        return { open, close };
    }

    // ===================================================================== //
    //  Styles                                                               //
    // ===================================================================== //
    function injectStyles() {
        addStyle(`
            :root { --ig-w: ${WIDTH_PCT * 100}vw; --ig-max: ${MAX_W}px; --ig-accent: #e0414e; --ig-grad: linear-gradient(135deg, #c0263a, #e0414e); }

            /* ---------------- dark theme ---------------- */
            html { --bg-color: #0f0f12 !important; }
            html, body { background: #0f0f12 !important; color: #d9d9de !important; }
            a, a:link { color: #8ab4ff !important; }
            a:visited { color: #cda7ac !important; }
            a:hover, a:active { color: #b6d0ff !important; }
            a:visited .glink { color: #cda7ac !important; }
            .glname a :not(.glink), a .glname :not(.glink) { color: #d9d9de !important; }
            a.tdn { color: #ff6b6b !important; }
            #eventpane { display: none !important; } /* hide HentaiVerse "you encountered a monster" banner */
            .gm, #gmid, #gd2, #gd3, #asm, #cdiv, .stuffbox, div.ido, div.d, div.ds, div.sni, #tagpopup, #agegate, #rangebar {
                background: #17171c !important; color: #d9d9de !important; border-color: #2a2a31 !important;
            }
            #gdd, #gdd td, #gd3, #gd4, .gdt2 { color: #d9d9de !important; }
            .gdt1 { color: #97979e !important; }
            input, select, option, optgroup, textarea { background: #202027 !important; color: #d9d9de !important; border-color: #3a3a43 !important; }
            input[type="radio"], input[type="checkbox"] { accent-color: var(--ig-accent); width: 16px; height: 16px; background: none !important; border: none !important; }
            input:enabled:hover, input:enabled:focus, textarea:enabled:hover, textarea:enabled:focus, select:enabled:hover, select:enabled:focus { background: #2a2a32 !important; }
            table.ptt, table.ptb { color: #d9d9de !important; }
            table.ptt td, table.ptb td { background: #17171c !important; border-color: #2a2a31 !important; }
            table.ptt td:hover, table.ptb td:hover { background: #2a2a32 !important; color: #b6d0ff !important; }
            td.ptds { background: #2a2a32 !important; color: #fff !important; }
            table.ptt span, table.ptb span { color: #67676e !important; }
            table.itg > tbody > tr > th, table.mt > tbody > tr > th { background: #1e1e24 !important; }
            table.itg > tbody > tr:nth-child(2n+1), table.mt > tbody > tr:nth-child(2n+1), .gl1t:nth-child(2n+1) { background: #17171c !important; }
            table.itg > tbody > tr:nth-child(2n+2), table.mt > tbody > tr:nth-child(2n+2), .gl1t:nth-child(2n+2) { background: #1c1c22 !important; }
            tr.gtr, table.mt > tbody > tr:first-child { background: #1e1e24 !important; }
            div.c2 { background: #1e1e24 !important; border-color: #2a2a31 !important; }
            div.c6, div.c7, div.c8 { color: #d9d9de !important; }

            /* ---------------- topbar (not fixed; logo aligned to content container) ---------------- */
            #ig-topbar {
                position: fixed; top: 0; left: 0; right: 0; z-index: 1000; box-sizing: border-box; width: 100%;
                padding: 11px 0; background: rgba(14,14,17,.92); backdrop-filter: blur(14px) saturate(160%); -webkit-backdrop-filter: blur(14px) saturate(160%);
                border-bottom: 1px solid #24242c; box-shadow: 0 1px 0 rgba(255,255,255,.03);
            }
            html body { padding-top: 66px; } /* room for the fixed bar */
            .ig-topbar-wrap { width: var(--ig-w); max-width: var(--ig-max); margin: 0 auto; display: flex; align-items: center; gap: 8px; min-height: 42px; }
            .ig-topbar-logo { flex: 0 0 auto; display: flex; align-items: center; gap: 9px; margin-right: 8px; text-decoration: none !important; }
            .ig-topbar-mark { display: inline-flex; align-items: center; color: var(--ig-accent); }
            .ig-topbar-mark svg { width: 30px; height: 30px; display: block; }
            .ig-topbar-logo:hover .ig-topbar-mark { filter: brightness(1.1); }
            .ig-topbar-word { font: 800 17px/1 system-ui, sans-serif; letter-spacing: -.01em; color: #f0f0f4 !important; }

            /* grouped nav + dropdowns */
            .ig-nav { display: flex; align-items: center; gap: 2px; }
            .ig-nav-group { position: relative; }
            .ig-nav-top { display: inline-flex; align-items: center; gap: 5px; padding: 9px 13px; border: none; background: none; border-radius: 10px; cursor: pointer; font: 600 14px system-ui, sans-serif; color: #c8c8d0 !important; text-decoration: none !important; white-space: nowrap; transition: background .14s ease, color .14s ease; }
            .ig-nav-top:visited { color: #c8c8d0 !important; }
            .ig-nav-top:hover, .ig-nav-top:hover:visited { background: #24242c; color: #fff !important; }
            .ig-nav-top svg { width: 15px; height: 15px; opacity: .7; transition: transform .18s ease; }
            .ig-nav-group:hover .ig-nav-top, .ig-nav-group.open .ig-nav-top { background: #24242c; color: #fff !important; }
            .ig-nav-group:hover .ig-nav-top svg, .ig-nav-group.open .ig-nav-top svg { transform: rotate(180deg); }
            .ig-nav-group::after { content: ""; position: absolute; top: 100%; left: 0; right: 0; height: 12px; } /* hover bridge */
            .ig-nav-panel { position: absolute; top: calc(100% + 10px); left: 0; min-width: 290px; padding: 8px; background: #16161c; border: 1px solid #2a2a33; border-radius: 16px; box-shadow: 0 24px 60px rgba(0,0,0,.6); display: none; flex-direction: column; gap: 2px; z-index: 50; animation: ig-navpop .16s ease; }
            .ig-nav-group:hover .ig-nav-panel, .ig-nav-group.open .ig-nav-panel { display: flex; }
            .ig-nav-group:last-of-type .ig-nav-panel { left: auto; right: 0; } /* rightmost group opens leftward */
            @keyframes ig-navpop { from { opacity: 0; transform: translateY(-6px); } }
            .ig-nav-item { box-sizing: border-box; display: flex; align-items: center; gap: 12px; width: 100%; padding: 9px 11px; border: none; background: none; border-radius: 11px; cursor: pointer; text-align: left; text-decoration: none !important; transition: background .12s ease; }
            .ig-nav-item:hover { background: #23232c; }
            .ig-nav-ico { flex: 0 0 auto; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: #20202a; border: 1px solid #2e2e38; color: #c9c9d2; }
            .ig-nav-ico svg { width: 18px; height: 18px; }
            .ig-nav-item:hover .ig-nav-ico { background: color-mix(in srgb, var(--ig-accent) 22%, #20202a); border-color: color-mix(in srgb, var(--ig-accent) 50%, #2e2e38); color: #fff; }
            .ig-nav-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
            .ig-nav-txt b { font: 650 14px system-ui, sans-serif; color: #ededf2 !important; }
            .ig-nav-txt small { font-size: 12px; color: #8a8a93; }

            /* right cluster */
            .ig-topbar-right { margin-left: auto; flex: 0 0 auto; display: flex; align-items: center; gap: 10px; }
            .ig-topbar-icon { width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #c8c8d0 !important; background: #1d1d24; border: 1px solid #2a2a33; text-decoration: none !important; transition: border-color .14s ease, color .14s ease; }
            .ig-topbar-icon:visited { color: #c8c8d0 !important; }
            .ig-topbar-icon:hover, .ig-topbar-icon:hover:visited { color: #fff !important; border-color: var(--ig-accent); }
            .ig-topbar-icon svg { width: 18px; height: 18px; }
            .ig-topbar-div { width: 1px; height: 26px; background: #2c2c35; }
            .ig-topbar-cta { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border: none; border-radius: 11px; cursor: pointer; background: var(--ig-grad); color: #fff; font: 700 14px system-ui, sans-serif; box-shadow: 0 4px 14px rgba(192,38,58,.4); transition: filter .14s ease, transform .1s ease; }
            .ig-topbar-cta:hover { filter: brightness(1.08); transform: translateY(-1px); }
            .ig-topbar-cta svg { width: 16px; height: 16px; }
            .ig-topbar-cta kbd { font: 600 11px system-ui, sans-serif; background: rgba(255,255,255,.18); border-radius: 5px; padding: 1px 6px; }

            /* account avatar button */
            .ig-acct-btn { cursor: pointer; }
            .ig-acct-named { background: var(--ig-grad) !important; border: none !important; color: #fff !important; font: 800 16px/1 system-ui, sans-serif; }

            /* unified account menu — popover (desktop) / bottom sheet (mobile) */
            #ig-account-backdrop { position: fixed; inset: 0; z-index: 2147483055; background: rgba(0,0,0,.5); }
            #ig-account-backdrop[hidden] { display: none; }
            #ig-account { position: fixed; top: 60px; right: max(5vw, 16px); z-index: 2147483056; width: 290px; max-height: calc(100vh - 80px); overflow-y: auto; padding: 10px; background: #16161c; border: 1px solid #2a2a33; border-radius: 16px; box-shadow: 0 24px 60px rgba(0,0,0,.65); animation: ig-navpop .16s ease; scrollbar-width: thin; }
            #ig-account[hidden] { display: none; }
            .ig-account-head { display: flex; align-items: center; gap: 11px; padding: 8px 10px 12px; border-bottom: 1px solid #24242c; margin-bottom: 6px; }
            .ig-account-ava { flex: 0 0 auto; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--ig-grad); color: #fff; font: 800 17px/1 system-ui, sans-serif; }
            .ig-account-ava svg { width: 20px; height: 20px; }
            .ig-account-who { display: flex; flex-direction: column; gap: 1px; min-width: 0; text-decoration: none !important; }
            .ig-account-who b { font: 700 14px system-ui, sans-serif; color: #f0f0f4 !important; }
            .ig-account-who small { font-size: 12px; color: #8a8a93; }
            .ig-account-lbl { font: 700 10px/1 system-ui, sans-serif; text-transform: uppercase; letter-spacing: .07em; color: #6a6a72; padding: 12px 11px 6px; }
            .ig-account-logout { display: flex; align-items: center; gap: 9px; margin-top: 6px; padding: 11px; border-top: 1px solid #24242c; color: #e08a92 !important; text-decoration: none !important; font: 600 13px system-ui, sans-serif; }
            .ig-account-logout:hover { color: var(--ig-accent) !important; }
            .ig-account-logout svg { width: 16px; height: 16px; }
            .ig-account-extra { display: none; } /* desktop: Browse/Community live in the topbar */

            /* bottom-nav "Me" reflects the open state */
            html.ig-account-open .ig-botnav-me { color: var(--ig-accent) !important; }

            /* active-section highlighting */
            .ig-nav-top.is-current, .ig-nav-group.is-current > .ig-nav-top { background: color-mix(in srgb, var(--ig-accent) 16%, transparent); color: #fff !important; }
            .ig-nav-item.is-current { background: color-mix(in srgb, var(--ig-accent) 12%, transparent); }
            .ig-nav-item.is-current .ig-nav-ico { background: color-mix(in srgb, var(--ig-accent) 28%, #20202a); border-color: var(--ig-accent); color: #fff; }
            .ig-nav-item.is-current .ig-nav-txt b { color: var(--ig-accent) !important; }
            .ig-botnav-item.is-current { color: var(--ig-accent) !important; }
            .ig-botnav-item.is-current .ig-botnav-ico { color: var(--ig-accent); }

            /* ---------------- listing pages (home / search results) ---------------- */
            html.ig-listing { overflow-x: hidden; }
            html.ig-listing body { max-width: 100% !important; overflow-x: hidden !important; }
            #ig-listwrap { width: 90vw; max-width: var(--ig-max); margin: 0 auto; padding: 16px 0 80px; box-sizing: border-box; }
            /* listing toolbar */
            .ig-list-toolbar { display: flex; flex-direction: column; gap: 14px; padding: 8px 0 20px; }
            .ig-list-toprow { display: flex; align-items: center; justify-content: space-between; gap: 14px 18px; flex-wrap: wrap; }
            .ig-list-count { color: #9a9aa0; font-size: 14px; font-weight: 600; margin-right: auto; }
            .ig-list-head { min-width: 0; display: flex; align-items: center; gap: 13px; margin-right: auto; }
            .ig-list-icon { flex-shrink: 0; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; background: rgba(224,65,78,.12); border: 1px solid rgba(224,65,78,.30); color: #e0414e; }
            .ig-list-icon svg { width: 22px; height: 22px; }
            .ig-list-titles { min-width: 0; display: flex; flex-direction: column; gap: 2px; text-align: left; }
            .ig-list-h1 { font: 700 27px/1.12 system-ui, sans-serif; color: #f4f4f7; margin: 0; padding: 0; letter-spacing: -.02em; text-align: left; }
            .ig-list-sub { font-size: 13px; line-height: 1.3; color: #8a8a92; font-weight: 500; text-align: left; }
            .ig-list-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
            .ig-page-head { margin: 2px 0 18px; }
            .ig-list-sort { background: #202027 !important; color: #e7e7ec !important; border: 1px solid #34343e !important; border-radius: 9px; padding: 7px 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
            .ig-view-seg button svg { width: 16px; height: 16px; }
            .ig-list-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 14px; background: #15151a; border: 1px solid #24242c; border-radius: 14px; }
            .ig-list-cats { display: flex; flex-wrap: wrap; gap: 7px; flex: 1; min-width: 200px; }
            .ig-list-lang { background: #202027 !important; color: #e7e7ec !important; border: 1px solid #34343e !important; border-radius: 9px; padding: 7px 10px; font-size: 13px; }
            .ig-list-apply { background: var(--ig-grad); color: #fff; border: none; border-radius: 10px; padding: 8px 20px; font-weight: 700; font-size: 13px; cursor: pointer; }
            .ig-list-apply:hover { filter: brightness(1.1); }
            /* filter button + bottom-sheet chrome (button/head/close/backdrop hidden on desktop) */
            .ig-list-filterbtn { display: none; align-items: center; gap: 7px; background: #202027; color: #e7e7ec; border: 1px solid #34343e; border-radius: 10px; padding: 8px 14px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
            .ig-list-filterbtn svg { width: 15px; height: 15px; }
            .ig-sheet-head { display: none; align-items: center; justify-content: space-between; font: 700 15px system-ui, sans-serif; color: #f0f0f4; padding-bottom: 4px; }
            .ig-sheet-foot { display: none; gap: 10px; }
            .ig-sheet-reset { padding: 11px 18px; border-radius: 11px; border: 1px solid #34343e; background: #202027; color: #e7e7ec; font: 700 14px system-ui, sans-serif; cursor: pointer; }
            .ig-sheet-reset:hover { border-color: var(--ig-accent); }
            .ig-sheet-apply { flex: 1; padding: 11px 18px; border-radius: 11px; border: none; background: var(--ig-grad); color: #fff; font: 800 14px system-ui, sans-serif; cursor: pointer; }
            .ig-sheet-apply:hover { filter: brightness(1.08); }
            .ig-sheet-close { background: none; border: none; color: #9a9aa2; cursor: pointer; padding: 4px; }
            .ig-sheet-close svg { width: 20px; height: 20px; }
            .ig-sheet-backdrop { position: fixed; inset: 0; z-index: 2147483049; background: rgba(0,0,0,.55); backdrop-filter: blur(3px); }
            .ig-sheet-backdrop[hidden] { display: none; }

            /* "+ Tag" button + active-tag chips + tag picker */
            .ig-list-addtag { display: inline-flex; align-items: center; gap: 5px; border-style: dashed; }
            .ig-list-addtag svg { width: 13px; height: 13px; }
            .ig-list-tagrow { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; }
            .ig-list-tagchip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 4px 4px 11px; border-radius: 999px; font-size: 12px; font-weight: 600; color: color-mix(in srgb, var(--tc, #8f96a3) 82%, #fff); background: color-mix(in srgb, var(--tc, #8f96a3) 16%, #1c1c22); border: 1px solid color-mix(in srgb, var(--tc, #8f96a3) 40%, #2c2c34); }
            .ig-list-tagx { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: none; background: none; color: inherit; cursor: pointer; opacity: .65; border-radius: 50%; }
            .ig-list-tagx:hover { opacity: 1; background: rgba(0,0,0,.3); }
            .ig-list-tagx svg { width: 12px; height: 12px; }
            #ig-tagpick { position: fixed; inset: 0; z-index: 2147483060; display: flex; align-items: flex-start; justify-content: center; padding: 12vh 16px 16px; background: rgba(0,0,0,.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
            #ig-tagpick[hidden] { display: none; }
            .ig-tagpick-box { width: min(480px, 96vw); max-height: 64vh; display: flex; flex-direction: column; background: #16161c; border: 1px solid #2a2a33; border-radius: 16px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,.6); animation: ig-pop .16s ease; }
            .ig-tagpick-head { display: flex; align-items: center; gap: 10px; padding: 13px 16px; border-bottom: 1px solid #24242c; }
            .ig-tagpick-head svg { width: 18px; height: 18px; color: #8a8a92; flex: 0 0 auto; }
            .ig-tagpick-input { flex: 1; min-width: 0; background: none !important; border: none !important; outline: none !important; color: #f0f0f4 !important; font-size: 15px !important; padding: 0 !important; }
            .ig-tagpick-list { overflow-y: auto; padding: 10px; display: flex; flex-wrap: wrap; gap: 6px; align-content: flex-start; }
            .ig-tagpick-item { display: inline-flex; align-items: center; font-size: 12px; font-weight: 600; cursor: pointer; line-height: 1; padding: 6px 11px; border-radius: 999px; color: color-mix(in srgb, var(--tc, #8f96a3) 82%, #fff); background: color-mix(in srgb, var(--tc, #8f96a3) 14%, #1c1c22); border: 1px solid color-mix(in srgb, var(--tc, #8f96a3) 36%, #2c2c34); transition: background .12s ease, transform .1s ease; }
            .ig-tagpick-item:hover { background: var(--tc, #8f96a3); color: #0d0d10; transform: translateY(-1px); }
            .ig-tagpick-empty { color: #8a8a92; font-size: 13px; padding: 12px; }

            /* favorites: category tabs + search */
            .ig-fav-tabs { display: flex; flex-wrap: nowrap; overflow-x: auto; gap: 7px; padding: 4px 0 14px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
            .ig-fav-tabs::-webkit-scrollbar { display: none; }
            a.ig-fav-tab { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 999px; background: #15151a; border: 1px solid #24242c; color: #c8c8d0 !important; text-decoration: none !important; white-space: nowrap; font: 600 13px system-ui, sans-serif; }
            .ig-fav-tab:visited { color: #c8c8d0 !important; }
            .ig-fav-tab:hover, .ig-fav-tab:hover:visited { border-color: #3a3a44; color: #fff !important; }
            .ig-fav-tab.is-current { background: var(--ig-grad); border-color: transparent; color: #fff !important; }
            .ig-fav-count { font-size: 11px; font-weight: 700; min-width: 18px; text-align: center; padding: 1px 6px; border-radius: 999px; background: rgba(0,0,0,.28); color: inherit; }
            .ig-fav-tab:not(.is-current) .ig-fav-count { background: #25252d; color: #9a9aa2; }
            a.ig-fav-manage { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; margin-left: 4px; padding: 8px 14px; border-radius: 999px; background: transparent; border: 1px dashed #3a3a44; color: #c8c8d0 !important; text-decoration: none !important; white-space: nowrap; font: 600 13px system-ui, sans-serif; }
            a.ig-fav-manage:hover, a.ig-fav-manage:hover:visited { border-color: #e0414e; color: #fff !important; background: rgba(224,65,78,.10); }
            a.ig-fav-manage:visited { color: #c8c8d0 !important; }
            .ig-fav-manage svg { width: 15px; height: 15px; }
            .ig-fav-search { display: flex; max-width: 560px; margin: 0 0 16px; background: #15151a; border: 1px solid #2a2a31; border-radius: 12px; overflow: hidden; }
            .ig-empty { text-align: center; padding: 60px 20px; color: #8a8a92; font-size: 15px; }
            #ig-listwrap > h1.ih { font: 700 21px/1.2 system-ui, sans-serif; color: #f0f0f4; margin: 0 0 10px; padding: 0; text-align: left; }
            /* native footer link bar floats over our layout on some pages — we have our own nav */
            .dp { display: none !important; }

            /* my home: tabs + restyled native account boxes */
            #ig-home { width: 90vw; max-width: var(--ig-max); margin: 0 auto; padding: 18px 0 90px; box-sizing: border-box; }
            .ig-home-tabs { display: flex; flex-wrap: nowrap; overflow-x: auto; gap: 7px; margin-bottom: 22px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
            .ig-home-tabs::-webkit-scrollbar { display: none; }
            a.ig-home-tab { flex: 0 0 auto; padding: 8px 14px; border-radius: 999px; background: #15151a; border: 1px solid #24242c; color: #c8c8d0 !important; text-decoration: none !important; font: 600 13px system-ui, sans-serif; white-space: nowrap; }
            .ig-home-tab:visited { color: #c8c8d0 !important; }
            .ig-home-tab:hover, .ig-home-tab:hover:visited { border-color: #3a3a44; color: #fff !important; }
            .ig-home-tab.is-current { background: var(--ig-grad); border-color: transparent; color: #fff !important; }
            #ig-home .stuffbox { min-width: 0 !important; max-width: none !important; width: auto !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; font-size: 13px; }
            #ig-home h1, #ig-home h2 { text-align: left !important; font: 700 12px/1 system-ui, sans-serif !important; text-transform: uppercase; letter-spacing: .07em; color: #8a8a92 !important; margin: 22px 0 12px !important; }
            #ig-home .homebox { width: auto !important; min-width: 0 !important; max-width: none !important; margin: 0 !important; padding: 18px !important; background: #15151a !important; border: 1px solid #24242c !important; border-radius: 14px; color: #d9d9de; }
            #ig-home .homebox td { color: #d9d9de; }
            #ig-home .homebox input[type="submit"] { background: #25252d; color: #e7e7ec; border: 1px solid #3a3a45; border-radius: 9px; padding: 7px 12px; cursor: pointer; }
            #ig-home .homebox input[type="submit"]:hover { border-color: var(--ig-accent); }
            /* generic account-page content (settings form, hath perks tables, etc.) */
            #ig-home .ig-home-content { color: #d9d9de; line-height: 1.5; }
            #ig-home .ig-home-content > *, #ig-home .ig-home-content table { max-width: 100% !important; box-sizing: border-box; }
            #ig-home .ig-home-content h3 { font: 700 12px/1 system-ui, sans-serif; text-transform: uppercase; letter-spacing: .06em; color: #8a8a92; margin: 22px 0 10px; }
            #ig-home .ig-home-content > form, #ig-home .ig-home-content > table, #ig-home .ig-home-content > .gltm, #ig-home .ig-home-content > .optionbox { background: #15151a; border: 1px solid #24242c; border-radius: 14px; padding: 18px; margin: 0 0 16px; }
            #ig-home .ig-home-content input[type="submit"], #ig-home .ig-home-content button { background: #25252d; color: #e7e7ec; border: 1px solid #3a3a45; border-radius: 9px; padding: 7px 12px; cursor: pointer; }
            #ig-home .ig-home-content input[type="submit"]:hover, #ig-home .ig-home-content button:hover { border-color: var(--ig-accent); }
            #ig-home .ig-home-content label { color: #cfcfd6; }

            #ig-listgrid { display: grid; gap: 18px; }
            #ig-listgrid.mode-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
            #ig-listgrid.mode-large { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
            /* list + compact: horizontal rows, left-aligned, with tags */
            #ig-listgrid.mode-list, #ig-listgrid.mode-compact { display: flex; flex-direction: column; }
            #ig-listgrid.mode-list { gap: 10px; }
            #ig-listgrid.mode-compact { gap: 6px; }
            #ig-listgrid.mode-list .ig-lcard, #ig-listgrid.mode-compact .ig-lcard { flex-direction: row; align-items: stretch; text-align: left; }
            #ig-listgrid.mode-list .ig-lbody, #ig-listgrid.mode-compact .ig-lbody { flex: 1; justify-content: center; align-items: flex-start; text-align: left; }
            #ig-listgrid.mode-list .ig-ltags, #ig-listgrid.mode-compact .ig-ltags { display: flex; }
            #ig-listgrid.mode-list .ig-lthumb { flex: 0 0 120px; width: 120px; aspect-ratio: auto; }
            #ig-listgrid.mode-list .ig-lbody { padding: 12px 16px; }
            #ig-listgrid.mode-list .ig-ltitle { font-size: 15px; -webkit-line-clamp: 2; }
            #ig-listgrid.mode-compact .ig-lcard { border-radius: 10px; }
            #ig-listgrid.mode-compact .ig-lthumb { flex: 0 0 64px; width: 64px; aspect-ratio: auto; }
            #ig-listgrid.mode-compact .ig-lbody { padding: 7px 12px; gap: 4px; }
            #ig-listgrid.mode-compact .ig-ltitle { font-size: 13px; -webkit-line-clamp: 1; }
            #ig-listgrid.mode-compact .ig-lcat { font-size: 9px; padding: 2px 6px; top: 5px; left: 5px; }
            #ig-listgrid.mode-compact .ig-lmeta { font-size: 10px; }
            #ig-listgrid.mode-compact .ig-lfoot { gap: 2px; padding-top: 2px; }
            #ig-listgrid.mode-compact .ig-ldate, #ig-listgrid.mode-compact .ig-lmrow-sub { font-size: 10px; }
            #ig-list-status { text-align: center; padding: 30px; color: #97979e; font-size: 14px; }
            #ig-list-sentinel { height: 1px; }
            .ig-lcard { position: relative; display: flex; flex-direction: column; background: #17171c; border: 1px solid #2a2a31; border-radius: 16px; overflow: hidden; text-decoration: none !important; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
            .ig-lcard:hover { transform: translateY(-4px); box-shadow: 0 16px 34px rgba(0,0,0,.62); border-color: var(--ig-accent); }
            .ig-lstretch { position: absolute; inset: 0; z-index: 1; }
            .ig-lthumb { position: relative; aspect-ratio: 5 / 7; background: #0f0f12; overflow: hidden; }
            .ig-lthumb-bg { position: absolute; inset: 0; background-size: cover; background-position: center; filter: blur(16px) saturate(1.15); transform: scale(1.18); opacity: .5; pointer-events: none; }
            .ig-lthumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; display: block; z-index: 1; pointer-events: none; transition: transform .3s ease; }
            .ig-lcard:hover .ig-lthumb img { transform: scale(1.05); }
            .ig-lcat { position: absolute; top: 8px; left: 8px; z-index: 2; pointer-events: none; font-size: 10px; font-weight: 800; letter-spacing: .02em; padding: 3px 9px; border-radius: 7px; color: #0d0d10; box-shadow: 0 2px 6px rgba(0,0,0,.4); }
            .ig-lcat.ct1 { background: #b9b9b9; } .ig-lcat.ct2 { background: #fb6e6e; } .ig-lcat.ct3 { background: #ffa84c; }
            .ig-lcat.ct4 { background: #e6e64c; } .ig-lcat.ct5 { background: #94e44c; } .ig-lcat.ct6 { background: #6aa8ff; }
            .ig-lcat.ct7 { background: #c084fc; } .ig-lcat.ct8 { background: #f078d8; } .ig-lcat.ct9 { background: #4cc3e6; } .ig-lcat.cta { background: #5ad65a; }
            .ig-fav { position: absolute; top: 7px; right: 7px; z-index: 3; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 50%; cursor: pointer; background: rgba(15,15,18,.6); color: #fff; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); opacity: 0; transform: scale(.85); transition: opacity .15s ease, transform .15s ease, background .15s ease; }
            .ig-lcard:hover .ig-fav { opacity: 1; transform: scale(1); }
            .ig-fav svg { width: 14px; height: 14px; }
            .ig-fav:hover { background: rgba(224,65,78,.85); }
            .ig-fav.is-fav { opacity: 1; transform: scale(1); background: var(--ig-accent); }
            .ig-fav.is-fav svg { fill: #fff; }
            .ig-fav.is-busy { opacity: .6; cursor: default; }
            .ig-fav.is-error { background: #b3232f; }
            #ig-listgrid.mode-compact .ig-fav, #ig-listgrid.mode-list .ig-fav { width: 24px; height: 24px; top: 4px; right: 4px; }
            .ig-lbody { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 6px; flex: 1; text-align: left; }
            .ig-ltitle { position: relative; font-size: 14px; font-weight: 650; color: #ececf1; line-height: 1.36; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .ig-lmeta { font-size: 11px; color: #8f8f97; margin-top: auto; }
            /* card footer: rating/date + uploader/pages */
            .ig-lfoot { margin-top: auto; display: flex; flex-direction: column; gap: 4px; padding-top: 6px; }
            .ig-lmrow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
            .ig-lmrow-sub { font-size: 11px; color: #8f8f97; }
            .ig-lrating { display: inline-flex; align-items: center; flex: 0 0 auto; }
            .ig-lrating .ir { vertical-align: middle; }
            .ig-ldate { font-size: 11px; color: #8f8f97; }
            .ig-luploader { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ig-luploader svg { width: 12px; height: 12px; opacity: .75; flex: 0 0 auto; }
            .ig-lpages { margin-left: auto; flex: 0 0 auto; }
            .ig-ltags { display: flex; flex-wrap: wrap; gap: 6px; margin: 5px 0; }
            .ig-ltag {
                position: relative; z-index: 2; display: inline-flex; align-items: center; line-height: 1;
                font-size: 11.5px; font-weight: 600; letter-spacing: .01em; text-decoration: none !important; cursor: pointer;
                color: color-mix(in srgb, var(--tc, #8f96a3) 82%, #fff) !important;
                background: color-mix(in srgb, var(--tc, #8f96a3) 15%, #1c1c22);
                border: 1px solid color-mix(in srgb, var(--tc, #8f96a3) 38%, #2c2c34);
                border-radius: 999px; padding: 5px 11px;
                transition: background .12s ease, border-color .12s ease, color .12s ease, transform .1s ease;
            }
            .ig-ltag:visited { color: color-mix(in srgb, var(--tc, #8f96a3) 82%, #fff) !important; }
            .ig-ltag:hover, .ig-ltag:hover:visited { background: var(--tc, #8f96a3); border-color: var(--tc, #8f96a3); color: #0d0d10 !important; transform: translateY(-1px); }
            /* grid/large/list show every tag (no row cap); compact stays to one row */
            #ig-listgrid.mode-compact .ig-ltags { max-height: 20px; overflow: hidden; }

            /* ---------------- toplists ---------------- */
            #ig-toplists { width: 90vw; max-width: var(--ig-max); margin: 0 auto; padding: 20px 0 90px; box-sizing: border-box; }
            .ig-tl-head h1 { font: 800 26px/1 system-ui, sans-serif; color: #f0f0f4; margin: 8px 0 24px; letter-spacing: -.02em; }
            .ig-tl-section { margin: 0 0 36px; }
            .ig-tl-sectitle { font: 700 13px/1 system-ui, sans-serif; text-transform: uppercase; letter-spacing: .08em; color: #8a8a92; margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid #24242c; }
            .ig-tl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
            .ig-tl-card { background: #15151a; border: 1px solid #24242c; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; transition: border-color .15s ease, transform .15s ease; }
            .ig-tl-card:hover { border-color: #33333c; transform: translateY(-2px); }
            .ig-tl-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 16px; background: #1b1b21; border-bottom: 1px solid #24242c; text-decoration: none !important; }
            .ig-tl-card-title { font: 700 14px system-ui, sans-serif; color: #ededf2 !important; }
            .ig-tl-card-arrow { display: inline-flex; color: var(--ig-accent); opacity: .8; transition: transform .15s ease; }
            .ig-tl-card-arrow svg { width: 16px; height: 16px; }
            .ig-tl-card:hover .ig-tl-card-arrow { opacity: 1; transform: translateX(3px); }
            .ig-tl-list { list-style: none; margin: 0; padding: 6px; display: flex; flex-direction: column; }
            .ig-tl-item { display: flex; align-items: center; gap: 11px; padding: 7px 10px; border-radius: 9px; transition: background .12s ease; }
            .ig-tl-item:hover { background: rgba(255,255,255,.04); }
            .ig-tl-rank { flex: 0 0 26px; text-align: center; font: 700 12px system-ui, sans-serif; color: #6a6a72; }
            .ig-tl-rank.top { color: #d9d9de; }
            .ig-tl-rank.r1 { color: #ffce54; } .ig-tl-rank.r2 { color: #cfd2da; } .ig-tl-rank.r3 { color: #e0935a; }
            .ig-tl-link { flex: 1; min-width: 0; font-size: 13px; color: #cfcfd6 !important; text-decoration: none !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .ig-tl-link:hover { color: var(--ig-accent) !important; }

            /* ---------------- torrents ---------------- */
            #ig-torrents { width: 90vw; max-width: var(--ig-max); margin: 0 auto; padding: 20px 0 90px; box-sizing: border-box; }
            .ig-tor-toolbar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
            .ig-tor-search { display: flex; flex: 1; min-width: 260px; max-width: 560px; background: #15151a; border: 1px solid #2a2a31; border-radius: 12px; overflow: hidden; }
            .ig-tor-input { flex: 1; min-width: 0; background: transparent !important; border: none !important; color: #e7e7ec !important; font-size: 14px; padding: 12px 16px !important; }
            .ig-tor-go { display: inline-flex; align-items: center; gap: 7px; background: var(--ig-grad); color: #fff; border: none; padding: 0 18px; font-weight: 700; font-size: 13px; cursor: pointer; }
            .ig-tor-go svg { width: 16px; height: 16px; }
            .ig-tor-go:hover { filter: brightness(1.08); }
            .ig-tor-count { color: #9a9aa0; font-size: 13px; font-weight: 600; }
            .ig-tor-list { display: flex; flex-direction: column; gap: 8px; }
            .ig-tor-row { display: flex; align-items: center; gap: 16px; padding: 14px 18px; background: #15151a; border: 1px solid #23232a; border-radius: 13px; transition: border-color .14s ease, transform .14s ease; }
            .ig-tor-row:hover { border-color: #34343e; transform: translateY(-1px); }
            .ig-tor-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
            .ig-tor-name { font-size: 14.5px; font-weight: 600; color: #e9e9ef !important; text-decoration: none !important; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
            .ig-tor-name:hover { color: var(--ig-accent) !important; }
            .ig-tor-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
            .ig-tor-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: #9a9aa2 !important; background: #1d1d23; border: 1px solid #2c2c34; border-radius: 999px; padding: 3px 10px; text-decoration: none !important; white-space: nowrap; }
            .ig-tor-chip svg { width: 13px; height: 13px; opacity: .8; }
            a.ig-tor-chip:hover { border-color: var(--ig-accent); color: #d9d9de !important; }
            .ig-tor-chip.size { color: #c8c8d0 !important; }
            .ig-tor-stats { display: flex; gap: 8px; flex: 0 0 auto; }
            .ig-tor-stat { min-width: 52px; text-align: center; background: #1b1b21; border: 1px solid #2a2a31; border-radius: 10px; padding: 7px 6px; display: flex; flex-direction: column; gap: 1px; }
            .ig-tor-stat b { font-size: 15px; font-weight: 700; color: #d9d9de; }
            .ig-tor-stat small { font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #74747c; }
            .ig-tor-stat.seed b { color: #5ad67a; }
            .ig-tor-stat.peer b { color: #6aa8ff; }
            @media (max-width: 768px) {
                #ig-toplists, #ig-torrents { width: 92vw; }
                .ig-tl-grid { grid-template-columns: 1fr; }
                .ig-tor-row { flex-direction: column; align-items: stretch; gap: 12px; }
                .ig-tor-stats { justify-content: flex-start; }
            }

            /* ---------------- gallery page ---------------- */
            html.ig-gallery { overflow-x: hidden; overflow-y: scroll; }
            html.ig-gallery, html.ig-gallery body { margin: 0 !important; }
            /* Cap the body to the viewport. An overflowing ad/element was widening the
               body, so #gdt's margin:0 auto centered it in that too-wide body and pushed
               it right -> the grid got cut on the right. This keeps centering correct. */
            html.ig-gallery body { max-width: 100% !important; overflow-x: hidden !important; }

            #ig-header {
                width: var(--ig-w); max-width: var(--ig-max); box-sizing: border-box;
                margin: 26px auto 8px; padding: 26px; text-align: left;
                background: #17171c; border: 1px solid #2a2a31; border-radius: 20px; box-shadow: 0 12px 44px rgba(0,0,0,.5);
            }
            #ig-header .ig-head-top { display: flex; gap: 30px; align-items: flex-start; }
            #ig-header .ig-cover { flex: 0 0 auto; }
            #ig-header .ig-cover #gd1 { position: static !important; float: none !important; margin: 0 !important; width: auto !important; height: auto !important; display: block !important; }
            #ig-header .ig-cover #gd1 > div { border-radius: 14px; box-shadow: 0 8px 24px rgba(0,0,0,.55); margin: 0 !important; }
            #ig-header .ig-info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
            #ig-header .ig-info, #ig-header .ig-info * { text-align: left !important; }
            #ig-header #gdc, #ig-header #gdn, #ig-header #gdd, #ig-header #gdr {
                position: static !important; float: none !important; margin: 0 !important; width: auto !important; height: auto !important; max-height: none !important; overflow: visible !important;
            }
            /* the real fix: the inner tables had width:170px;margin:auto (centered) */
            #ig-header #gdd table, #ig-header #gdr table { width: auto !important; margin: 0 !important; }
            #ig-header #gn { font-size: 23px; line-height: 1.3; font-weight: 700; }
            #ig-header #gj { color: #97979e; font-size: 15px; }
            #ig-header #gdc .cs { border-radius: 8px; height: auto; line-height: 1.6; padding: 3px 12px; width: auto; display: inline-block; }
            #ig-header #gdd td { padding: 2px 10px 2px 0; }

            #ig-header .ig-tags { margin-top: 20px; padding-top: 18px; border-top: 1px solid #24242a; }
            .ig-tags-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
            .ig-tags-title { font: 700 12px/1 system-ui, sans-serif; text-transform: uppercase; letter-spacing: .06em; color: #8a8a92; }
            .ig-tag-votebtn { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 10px; background: #25252d; border: 1px solid #3a3a45; color: #cfcfd6; font: 600 12px system-ui, sans-serif; cursor: pointer; transition: background .14s ease, border-color .14s ease, color .14s ease; }
            .ig-tag-votebtn svg { width: 15px; height: 15px; }
            .ig-tag-votebtn:hover { border-color: var(--ig-accent); color: #fff; }
            .ig-tag-votebtn.is-active { background: var(--ig-grad); border-color: transparent; color: #fff; box-shadow: 0 2px 10px rgba(192,38,58,.4); }
            #ig-header .ig-tags.ig-votemode #taglist a { cursor: default; }
            #ig-header #gd4, #ig-header #taglist { position: static !important; float: none !important; width: auto !important; height: auto !important; max-height: none !important; overflow: visible !important; margin: 0 !important; }
            #ig-header #tagmenu_act, #ig-header #tagmenu_new { float: none !important; width: auto !important; display: inline-block; }
            #ig-header .tc { color: #97979e; font-weight: 600; padding-right: 10px; vertical-align: top; }
            html.ig-gallery div.gt, html.ig-gallery div.gtl, html.ig-gallery div.gtw {
                background: #25252d !important; border: 1px solid #3a3a45 !important; border-radius: 999px !important;
                padding: 3px 12px !important; margin: 0 6px 7px 0 !important; font-weight: 500 !important;
                transition: background .15s ease, border-color .15s ease, transform .1s ease;
            }
            html.ig-gallery div.gt:hover, html.ig-gallery div.gtl:hover, html.ig-gallery div.gtw:hover { background: #31313b !important; border-color: var(--ig-accent) !important; transform: translateY(-1px); }

            #ig-header .ig-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; padding-top: 18px; border-top: 1px solid #24242a; }
            #ig-header .ig-actions > a, #ig-header .ig-actions > #gdf {
                position: static !important; float: none !important; margin: 0 !important; width: auto !important; cursor: pointer;
                display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 11px;
                background: #25252d; border: 1px solid #3a3a45; color: #dcdce2 !important; text-decoration: none !important; font-weight: 600; font-size: 13px;
                transition: background .15s ease, border-color .15s ease, transform .1s ease;
            }
            #ig-header .ig-actions > a:hover, #ig-header .ig-actions > #gdf:hover { background: #31313b; border-color: var(--ig-accent); transform: translateY(-1px); }
            #ig-header .ig-actions img { display: none; }
            #ig-header .ig-actions #gdf { padding-top: 9px !important; padding-left: 16px !important; }
            #ig-header .ig-actions #gdf > div { float: none !important; display: inline; }

            /* grid */
            html.ig-gallery #gdt.gt200 {
                display: block !important; width: var(--ig-w) !important; max-width: var(--ig-max) !important; min-width: 0 !important;
                margin: 0 auto !important; padding: 0 0 60px !important; box-sizing: border-box; text-align: left !important;
                background: transparent !important; border: none !important; border-radius: 0 !important;
            }
            /* row-major grid → tiles keep the gallery's original page order */
            html.ig-gallery #ig-masonry { display: grid; gap: ${GAP}px; justify-content: flex-start; align-items: start; }
            html.ig-gallery #ig-masonry .ig-col { display: contents; }
            /* e-hentai's ".gt200 div>div:last-child { max-width:200px; overflow:hidden; padding-top:2px }"
               caps the last child; neutralize it on the masonry container */
            html.ig-gallery #gdt.gt200 #ig-masonry {
                max-width: none !important; min-width: 0 !important; padding-top: 0 !important; overflow: visible !important; text-align: left !important;
            }
            html.ig-gallery #ig-masonry a {
                display: block; overflow: hidden; border-radius: 14px; border: 1px solid #24242a; background: #17171c; cursor: pointer;
                box-shadow: 0 2px 10px rgba(0,0,0,.45); transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
            }
            html.ig-gallery #ig-masonry a:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 16px 34px rgba(0,0,0,.7); border-color: var(--ig-accent); position: relative; z-index: 3; }
            html.ig-gallery #ig-masonry a > div { display: block !important; border: none !important; }
            html.ig-gallery div.gtb table.ptt, html.ig-gallery div.gtb table.ptb { display: none !important; }
            html.ig-gallery #ig-status { text-align: center; padding: 30px; color: #97979e; font-size: 14px; }
            html.ig-gallery #ig-sentinel { height: 1px; }
            /* "Showing 1 - N of M images" — center it */
            html.ig-gallery div.gtb { text-align: center !important; min-width: 0 !important; width: auto !important; }
            html.ig-gallery .gpc { text-align: center !important; float: none !important; margin: 8px auto !important; color: #97979e; font-size: 13px; }

            /* list view (vertical reader) */
            #ig-list { display: none; width: min(1400px, 92vw); margin: 0 auto; padding: 0 0 80px; flex-direction: column; gap: 8px; }
            html.ig-listmode #ig-list { display: flex; }
            html.ig-listmode #gdt.gt200, html.ig-listmode #ig-status, html.ig-listmode #ig-sentinel { display: none !important; }
            .ig-list-item { min-height: 320px; display: flex; align-items: center; justify-content: center; border-radius: 8px; overflow: hidden; }
            .ig-list-item:not(.ig-list-ok) { background: linear-gradient(100deg, #161620 30%, #20202c 50%, #161620 70%); background-size: 200% 100%; animation: ig-shimmer 1.3s ease-in-out infinite; }
            .ig-list-item img { width: 100%; height: auto; display: block; border-radius: 8px; }
            .ig-list-item.ig-list-err { background: #161620; }
            .ig-list-item.ig-list-err::after { content: "failed to load"; color: #ff6b6b; font-size: 13px; }
            @keyframes ig-shimmer { to { background-position: -200% 0; } }

            /* ---------------- gallery floating action button (speed dial) ---------------- */
            #ig-fab { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; display: flex; flex-direction: column; align-items: center; gap: 12px; }
            #ig-fab-main { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: none; cursor: pointer; background: var(--ig-grad); color: #fff; box-shadow: 0 10px 28px rgba(0,0,0,.5), 0 4px 12px rgba(192,38,58,.4); transition: transform .18s cubic-bezier(.2,.8,.3,1), filter .16s ease; }
            #ig-fab-main:hover { filter: brightness(1.08); transform: scale(1.05); }
            #ig-fab-main svg { width: 24px; height: 24px; }
            .ig-fab-actions { display: none; flex-direction: column; align-items: center; gap: 12px; }
            #ig-fab.open .ig-fab-actions { display: flex; }
            .ig-fab-action { position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid rgba(255,255,255,.1); background: rgba(28,29,34,.95); color: #fff; cursor: pointer; box-shadow: 0 8px 20px rgba(0,0,0,.45); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); animation: ig-fabpop .18s cubic-bezier(.2,.8,.3,1) backwards; transition: border-color .15s ease, transform .15s ease, background .15s ease; }
            .ig-fab-action:nth-child(3) { animation-delay: .02s; } .ig-fab-action:nth-child(2) { animation-delay: .05s; } .ig-fab-action:nth-child(1) { animation-delay: .08s; }
            @keyframes ig-fabpop { from { opacity: 0; transform: translateY(16px) scale(.6); } }
            .ig-fab-action:hover { border-color: var(--ig-accent); transform: scale(1.08); }
            .ig-fab-action svg { width: 20px; height: 20px; }
            .ig-fab-action.is-active { background: rgba(224,65,78,.3); border-color: var(--ig-accent); color: #f3c7cd; }
            #ig-fab.is-busy .ig-fab-action[data-act="download"] { animation: ig-pulse 1.2s ease-in-out infinite; }
            .ig-fab-action[data-label]::after { content: attr(data-label); position: absolute; right: calc(100% + 12px); top: 50%; transform: translateY(-50%) translateX(6px); padding: 5px 10px; border-radius: 8px; background: rgba(20,21,25,.97); color: #fff; font: 500 12px system-ui, sans-serif; white-space: nowrap; border: 1px solid rgba(255,255,255,.1); box-shadow: 0 8px 22px rgba(0,0,0,.5); opacity: 0; pointer-events: none; transition: opacity .15s ease, transform .15s ease; }
            #ig-fab.open .ig-fab-action[data-label]:hover::after { opacity: 1; transform: translateY(-50%) translateX(0); }
            @keyframes ig-pulse { 50% { box-shadow: 0 6px 22px rgba(224,65,78,.9); } }

            /* continue-reading pill */
            .ig-resume { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2147482999; display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 999px; background: var(--ig-grad); color: #fff; border: none; font: 700 13px system-ui, sans-serif; cursor: pointer; box-shadow: 0 10px 30px rgba(0,0,0,.55); }
            .ig-resume svg { width: 16px; height: 16px; }
            .ig-resume:hover { filter: brightness(1.08); transform: translateX(-50%) translateY(-2px); }

            /* back-to-gallery pill on /s/ pages */
            #ig-backfab { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; border-radius: 999px; background: var(--ig-grad); color: #fff !important; text-decoration: none !important; font: 700 13px system-ui, sans-serif; box-shadow: 0 10px 28px rgba(0,0,0,.5); transition: filter .14s ease, transform .1s ease; }
            #ig-backfab:visited { color: #fff !important; }
            #ig-backfab:hover { filter: brightness(1.08); transform: translateY(-2px); }
            #ig-backfab svg { width: 17px; height: 17px; }

            /* ---------------- fixed bottom nav (mobile only) ---------------- */
            #ig-botnav { display: none; }

            .ig-pop {
                position: fixed; left: 50%; bottom: 86px; transform: translateX(-50%); z-index: 2147483000;
                display: flex; flex-direction: column; gap: 9px; padding: 14px;
                background: rgba(23,23,28,.92); border: 1px solid #2e2e36; border-radius: 16px; box-shadow: 0 18px 48px rgba(0,0,0,.6); min-width: 290px;
                backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
            }
            .ig-pop[hidden] { display: none; }
            /* download popover anchors to the bottom-right FAB instead of centre */
            #ig-pop-dl { left: auto; right: 20px; transform: none; bottom: 92px; }
            .ig-search-form { display: flex; gap: 8px; }
            .ig-search-input { flex: 1; padding: 10px 12px; border-radius: 10px; font-size: 14px; }
            .ig-pop-opt { display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left; padding: 11px 14px; border-radius: 11px; cursor: pointer; background: #25252d; color: #e7e7ec; border: 1px solid #3a3a45; font-size: 13px; font-weight: 600; transition: background .15s ease, border-color .15s ease; }
            .ig-pop-opt small { font-weight: 500; color: #8f8f97; margin-left: 6px; }
            .ig-pop-size { font-size: 12px; font-weight: 700; color: #f1a9b0; background: #3a2125; border: 1px solid #6b3a40; border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
            .ig-pop-opt:hover { background: #31313b; border-color: var(--ig-accent); }
            .ig-pop-opt:disabled { opacity: .5; cursor: default; }
            .ig-search-go { flex: 0 0 auto; }
            .ig-pop-note { font-size: 12px; color: #97979e; min-height: 15px; padding: 0 2px; }

            /* ---------------- search modal (command-palette portal) ---------------- */
            #ig-search { position: fixed; inset: 0; z-index: 2147483602; display: flex; align-items: flex-start; justify-content: center; padding: 10vh 16px 16px; background: rgba(0,0,0,.6); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
            #ig-search[hidden] { display: none; }
            .ig-search-box { width: min(660px, 96vw); max-height: 84vh; overflow-y: auto; text-align: left; background: #16161c; border: 1px solid #2f2f3a; border-radius: 20px; box-shadow: 0 30px 90px rgba(0,0,0,.72); animation: ig-pop .16s ease; scrollbar-width: thin; scrollbar-color: #3a3a44 transparent; }
            .ig-search-box::-webkit-scrollbar { width: 8px; }
            .ig-search-box::-webkit-scrollbar-thumb { background: #34343e; border-radius: 999px; }
            @keyframes ig-pop { from { transform: translateY(-10px) scale(.98); opacity: 0; } }
            .ig-search-head { display: flex; align-items: center; gap: 12px; padding: 17px 20px; border-bottom: 1px solid #24242c; position: sticky; top: 0; background: #16161c; z-index: 2; }
            .ig-search-head > svg { width: 20px; height: 20px; color: #9a9aa0; flex: 0 0 auto; }
            .ig-search-field { flex: 1; min-width: 0; background: none !important; border: none !important; outline: none !important; color: #f0f0f4 !important; font-size: 17px !important; padding: 0 !important; }
            /* id-scoped so they beat the global input:focus/hover background (which outranks a bare class) */
            #ig-search .ig-search-field, #ig-search .ig-search-field:hover, #ig-search .ig-search-field:focus { background: none !important; }
            #ig-torrents .ig-tor-input, #ig-listwrap .ig-tor-input { background: transparent !important; }
            .ig-search-kbd { font-size: 11px; color: #8a8a92; border: 1px solid #3a3a44; border-radius: 6px; padding: 2px 7px; flex: 0 0 auto; }
            /* tag autocomplete dropdown */
            .ig-ac { display: flex; flex-direction: column; padding: 6px; border-bottom: 1px solid #24242c; max-height: 280px; overflow-y: auto; }
            .ig-ac[hidden] { display: none; }
            .ig-ac-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 8px 12px; border: none; border-radius: 9px; background: none; color: #d4d4da; font-size: 14px; cursor: pointer; }
            .ig-ac-item svg { width: 14px; height: 14px; color: #6a6a72; flex: 0 0 auto; }
            .ig-ac-item:hover, .ig-ac-item.sel { background: #24242c; color: #fff; }
            .ig-ac-item.sel svg { color: var(--ig-accent); }

            .ig-sec { padding: 14px 20px 0; }
            .ig-sec-label { text-align: left; font-size: 13px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #82828c; margin: 0 0 11px; }
            .ig-sec-label span { text-transform: none; letter-spacing: 0; color: #82828c; font-weight: 500; }
            .ig-search-cats, .ig-search-langs { display: flex; flex-wrap: wrap; gap: 8px; }

            .ig-cat { --c: #888; cursor: pointer; border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 700; border: 1px solid color-mix(in srgb, var(--c) 60%, #3a3a44); color: color-mix(in srgb, var(--c) 80%, #fff); background: color-mix(in srgb, var(--c) 14%, #1b1b21); opacity: 1; transition: all .14s ease; }
            .ig-cat:hover { border-color: var(--c); background: color-mix(in srgb, var(--c) 26%, #1b1b21); color: #fff; }
            .ig-cat.is-on { background: var(--c); color: #0d0d10; box-shadow: 0 2px 10px color-mix(in srgb, var(--c) 40%, transparent); }

            .ig-lang { cursor: pointer; border-radius: 999px; padding: 6px 13px; font-size: 12px; font-weight: 600; border: 1px solid #3a3a44; color: #bcbcc4; background: #20202733; transition: all .14s ease; }
            .ig-lang:hover { border-color: #555; color: #e7e7ec; }
            .ig-lang.is-on { background: var(--ig-accent); border-color: var(--ig-accent); color: #fff; }

            /* advanced */
            .ig-adv-toggle { display: flex; align-items: center; gap: 8px; width: calc(100% - 40px); margin: 16px 20px 0; padding: 10px 0; background: none; border: none; border-top: 1px solid #24242c; color: #b6b6be; font-size: 13px; font-weight: 600; cursor: pointer; }
            .ig-adv-toggle:hover { color: #fff; }
            .ig-adv-toggle > svg { width: 16px; height: 16px; color: var(--ig-accent); }
            .ig-adv-toggle > span:first-of-type { flex: 1; text-align: left; }
            .ig-adv-caret { transition: transform .15s ease; }
            .ig-adv-toggle.is-open .ig-adv-caret { transform: rotate(180deg); }
            .ig-search-adv { padding: 8px 20px 16px; display: flex; flex-direction: column; gap: 14px; }
            .ig-search-adv[hidden] { display: none; }
            .ig-adv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            /* Pages / Min rating each in a grouped card */
            .ig-adv-field { display: flex; flex-direction: column; gap: 11px; min-width: 0; background: #15151b; border: 1px solid #25252e; border-radius: 14px; padding: 13px 14px; }
            .ig-adv-cap { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #7a7a84; }
            .ig-adv-pages { display: flex; align-items: center; gap: 10px; }
            .ig-adv-pages i { color: #6a6a72; font-style: normal; }
            .ig-search-adv input[type="number"] { flex: 1; min-width: 0; width: auto; background: #202027 !important; color: #e7e7ec !important; border: 1px solid #34343e !important; border-radius: 9px; padding: 9px 10px !important; font-size: 13px; }
            .ig-search-adv input[type="number"]:focus { border-color: var(--ig-accent) !important; }
            .ig-seg { display: inline-flex; background: #202027; border: 1px solid #34343e; border-radius: 10px; padding: 3px; gap: 2px; }
            .ig-seg button { background: none; border: none; color: #b6b6be; font-size: 13px; font-weight: 600; padding: 6px 11px; border-radius: 7px; cursor: pointer; transition: all .12s ease; }
            .ig-seg button:hover { color: #fff; background: rgba(255,255,255,.05); }
            .ig-seg button.on { background: var(--ig-grad); color: #fff; box-shadow: 0 2px 8px rgba(192,38,58,.4); }
            /* rating segmented fills its card */
            .ig-adv-field .ig-seg { display: flex; flex-wrap: wrap; }
            .ig-adv-field .ig-seg button { flex: 1; min-width: 38px; }

            /* toggles as settings rows (highlight when on) */
            .ig-switches { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .ig-switch { display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 13px; color: #cfcfd6; user-select: none; padding: 11px 13px; border-radius: 12px; background: #15151b; border: 1px solid #25252e; transition: border-color .14s ease, background .14s ease; }
            .ig-switch:hover { border-color: #3a3a44; background: #1b1b22; }
            .ig-switch:has(input:checked) { border-color: color-mix(in srgb, var(--ig-accent) 55%, #25252e); background: color-mix(in srgb, var(--ig-accent) 10%, #15151b); }
            .ig-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
            .ig-switch-track { position: relative; flex: 0 0 auto; width: 42px; height: 24px; border-radius: 999px; background: #34343e; transition: background .18s ease; box-shadow: inset 0 1px 2px rgba(0,0,0,.3); }
            .ig-switch-track::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #d4d4dc; box-shadow: 0 1px 3px rgba(0,0,0,.5); transition: transform .2s cubic-bezier(.2,.8,.3,1), background .18s ease; }
            .ig-switch input:checked + .ig-switch-track { background: var(--ig-accent); }
            .ig-switch input:checked + .ig-switch-track::after { transform: translateX(18px); background: #fff; }
            .ig-switch-lbl { line-height: 1.3; }

            /* file search */
            .ig-fs { border-top: 1px solid #24242c; padding-top: 14px; display: flex; flex-direction: column; gap: 12px; }
            .ig-fs-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
            .ig-fs-file { display: inline-flex; align-items: center; gap: 9px; padding: 9px 14px; border-radius: 10px; background: #202027; border: 1px dashed #3a3a44; color: #b6b6be; font-size: 13px; cursor: pointer; max-width: 100%; }
            .ig-fs-file:hover { border-color: var(--ig-accent); color: #e7e7ec; }
            .ig-fs-file input[type=file] { display: none; }
            .ig-fs-file svg { width: 15px; height: 15px; flex: 0 0 auto; }
            .ig-fs-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ig-fs-go { background: #2a2a33; color: #e7e7ec; border: 1px solid #3a3a44; border-radius: 10px; padding: 9px 16px; font-weight: 600; font-size: 13px; cursor: pointer; }
            .ig-fs-go:hover { border-color: var(--ig-accent); }

            .ig-search-recent { padding: 14px 20px 4px; }
            .ig-search-recent[hidden] { display: none; }
            .ig-hist-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
            .ig-hist-title { font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: #6a6a72; }
            .ig-hist-badge { font-size: 11px; font-weight: 700; color: #8a8a92; font-variant-numeric: tabular-nums; }
            .ig-hist-toggle { margin-left: auto; background: none; border: none; color: #9a9aa2; font-size: 12px; font-weight: 600; cursor: pointer; padding: 4px 7px; border-radius: 7px; }
            .ig-hist-toggle:hover { color: #fff; background: #23232c; }
            .ig-hist-clear { display: flex; background: none; border: none; color: #7a7a82; cursor: pointer; padding: 4px; border-radius: 7px; }
            .ig-hist-clear:hover { color: var(--ig-accent); background: #23232c; }
            .ig-hist-clear svg { width: 15px; height: 15px; }
            .ig-hist-list { display: flex; flex-direction: column; gap: 1px; }
            .ig-search-recent-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 9px 10px; border-radius: 10px; background: none; border: none; color: #d4d4da; cursor: pointer; font-size: 14px; }
            .ig-search-recent-item:hover { background: #24242c; }
            .ig-search-recent-item > svg { width: 15px; height: 15px; color: #7a7a82; flex: 0 0 auto; }
            .ig-hist-q { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .ig-hist-x { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; color: #6a6a72; opacity: 0; transition: opacity .12s ease, color .12s ease, background .12s ease; }
            .ig-hist-x svg { width: 13px; height: 13px; }
            .ig-search-recent-item:hover .ig-hist-x { opacity: 1; }
            .ig-hist-x:hover { color: var(--ig-accent); background: rgba(224,65,78,.15); }
            .ig-hist-pager { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 10px 0 2px; }
            .ig-hist-pg { background: #202027; border: 1px solid #34343e; color: #c8c8d0; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 15px; line-height: 1; }
            .ig-hist-pg:disabled { opacity: .4; cursor: default; }
            .ig-hist-pg:not(:disabled):hover { border-color: var(--ig-accent); color: #fff; }
            .ig-hist-count { font-size: 12px; color: #8a8a92; font-variant-numeric: tabular-nums; }

            .ig-search-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; margin-top: 8px; border-top: 1px solid #24242c; position: sticky; bottom: 0; background: #16161c; }
            .ig-search-hint { font-size: 12px; color: #7a7a82; }
            .ig-search-go2 { background: var(--ig-grad); color: #fff; border: none; border-radius: 11px; padding: 10px 26px; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 4px 14px rgba(192,38,58,.45); }
            .ig-search-go2:hover { filter: brightness(1.1); }

            /* ---------------- fullscreen viewer ---------------- */
            #ig-modal { position: fixed; inset: 0; z-index: 2147483601; display: none; background: rgba(0,0,0,.97); }
            #ig-modal.open { display: block; }
            .ig-modal-stage { position: absolute; inset: 0 0 78px; display: flex; align-items: center; justify-content: center; }
            .ig-modal-img { max-width: 98vw; max-height: 100%; object-fit: contain; border-radius: 6px; opacity: 0; transition: opacity .2s ease; user-select: none; -webkit-user-drag: none; }
            .ig-modal-nav, .ig-modal-close, .ig-modal-stripbtn, .ig-modal-open {
                position: absolute; z-index: 5; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; color: #fff;
                border: 1px solid rgba(255,255,255,.15); background: rgba(20,20,24,.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); transition: background .15s ease, border-color .15s ease, color .15s ease, transform .12s ease;
            }
            .ig-modal-stripbtn { width: 54px; height: 54px; top: 18px; right: 84px; }
            .ig-modal-stripbtn svg { width: 22px; height: 22px; }
            .ig-modal-stripbtn:hover { background: rgba(42,42,50,.85); }
            .ig-modal-stripbtn.is-active { color: var(--ig-accent); border-color: color-mix(in srgb, var(--ig-accent) 55%, transparent); }
            .ig-modal-open { width: 54px; height: 54px; top: 18px; right: 148px; text-decoration: none !important; }
            .ig-modal-open svg { width: 22px; height: 22px; }
            .ig-modal-open:hover { background: rgba(42,42,50,.85); color: var(--ig-accent); }
            #ig-modal.ig-nostrip .ig-modal-strip { display: none; }
            #ig-modal.ig-nostrip .ig-modal-stage { inset: 0; }
            /* vertical paging — stacked on the right */
            .ig-modal-nav { width: 50px; height: 50px; right: 22px; left: auto; }
            .ig-modal-nav:hover { background: rgba(42,42,50,.85); }
            .ig-modal-prev { top: calc(50% - 56px); }
            .ig-modal-next { top: calc(50% + 6px); }
            .ig-modal-close { width: 54px; height: 54px; top: 18px; right: 20px; }
            .ig-modal-close:hover { background: rgba(42,42,50,.85); }
            .ig-modal-nav svg, .ig-modal-close svg { width: 24px; height: 24px; }
            .ig-modal-counter, .ig-modal-res {
                position: absolute; z-index: 5; padding: 7px 15px; border-radius: 999px;
                background: rgba(20,20,24,.6); border: 1px solid rgba(255,255,255,.12); color: #fff; font: 600 13px system-ui, sans-serif;
                backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
            }
            .ig-modal-counter { top: 22px; left: 20px; }
            /* resolution indicator: bottom of the image, only on hover */
            .ig-modal-res { bottom: 16px; left: 50%; transform: translateX(-50%); color: #dcdce2; font-weight: 600; opacity: 0; pointer-events: none; transition: opacity .15s ease; }
            .ig-modal-stage:hover .ig-modal-res { opacity: 1; }
            .ig-modal-res:empty { display: none; }
            .ig-modal-spinner { position: absolute; width: 46px; height: 46px; border-radius: 50%; border: 3px solid rgba(255,255,255,.2); border-top-color: #fff; animation: ig-spin .8s linear infinite; opacity: 0; }
            #ig-modal.loading .ig-modal-spinner { opacity: 1; }
            @keyframes ig-spin { to { transform: rotate(360deg); } }
            /* HQ upgrader feedback: spinner on each tile being sharpened + a working FAB button */
            #gdt a.ig-hq-loading { position: relative; }
            #gdt a.ig-hq-loading::after { content: ""; position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; border: 2px solid rgba(255,255,255,.25); border-top-color: var(--ig-accent); border-radius: 50%; animation: ig-spin .8s linear infinite; z-index: 4; pointer-events: none; }
            .ig-fab-action.is-working { color: var(--ig-accent); border-color: color-mix(in srgb, var(--ig-accent) 55%, transparent); }
            .ig-fab-action.is-working svg { animation: ig-spin .9s linear infinite; }
            .ig-modal-strip {
                position: absolute; left: 0; right: 0; bottom: 0; height: 78px; display: flex; align-items: center; gap: 6px;
                padding: 8px 12px; overflow-x: auto; overflow-y: hidden; background: rgba(10,10,12,.7); border-top: 1px solid rgba(255,255,255,.08);
                scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.22) transparent;
                cursor: grab; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain;
            }
            .ig-modal-strip.grabbing { cursor: grabbing; }
            .ig-modal-strip.grabbing .ig-strip-item { pointer-events: none; }
            .ig-modal-strip::-webkit-scrollbar { height: 8px; }
            .ig-modal-strip::-webkit-scrollbar-track { background: transparent; }
            .ig-modal-strip::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 999px; }
            .ig-modal-strip::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.32); }
            .ig-strip-item { flex: 0 0 auto; height: 52px; border-radius: 5px; overflow: hidden; cursor: pointer; opacity: .55; border: 2px solid transparent; transition: opacity .15s ease, border-color .15s ease; background: #17171c; }
            .ig-strip-item:hover { opacity: .85; }
            .ig-strip-item.active { opacity: 1; border-color: var(--ig-accent); }
            .ig-strip-item > div { border: none !important; }

            /* ---------------- mobile ---------------- */
            @media (max-width: 768px) {
                #ig-header { padding: 16px; margin: 14px auto; border-radius: 16px; }
                #ig-header .ig-head-top { flex-direction: column; gap: 16px; align-items: center; }
                #ig-header .ig-info { width: 100%; }
                #ig-header #gn { font-size: 19px; }
                #ig-header .ig-actions { gap: 8px; }
                #ig-header .ig-actions > a, #ig-header .ig-actions > #gdf { padding: 8px 12px; font-size: 12px; }
                /* mobile: minimal non-fixed brand bar (logo only) up top; nav lives in the bottom bar */
                #ig-topbar { display: block; position: static; padding: 12px 0 6px; background: transparent; border-bottom: none; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
                .ig-topbar-wrap { width: 92vw; }
                .ig-topbar-logo { margin-right: 0; }
                .ig-topbar-word { display: block; }
                .ig-nav, .ig-topbar-right { display: none; }
                html body { padding-top: 0; padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)); }
                #ig-botnav { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147482000; align-items: stretch; justify-content: space-around; height: 58px; padding-bottom: env(safe-area-inset-bottom, 0px); background: rgba(14,14,17,.96); border-top: 1px solid #24242c; backdrop-filter: blur(14px) saturate(160%); -webkit-backdrop-filter: blur(14px) saturate(160%); }
                .ig-botnav-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; border: none; background: none; color: #9a9aa2 !important; text-decoration: none !important; font: 600 10px system-ui, sans-serif; cursor: pointer; }
                .ig-botnav-item:visited { color: #9a9aa2 !important; }
                .ig-botnav-ico { display: inline-flex; align-items: center; justify-content: center; }
                .ig-botnav-ico svg { width: 22px; height: 22px; }
                .ig-botnav-item:active { color: #fff !important; }
                .ig-botnav-item.center { color: #fff !important; }
                .ig-botnav-item.center .ig-botnav-ico { width: 46px; height: 46px; margin-top: -22px; border-radius: 50%; background: var(--ig-grad); color: #fff; box-shadow: 0 6px 18px rgba(192,38,58,.5); }

                /* account menu becomes a full bottom sheet (with Browse/Community sections) */
                #ig-account { top: auto; bottom: 0; left: 0; right: 0; width: auto; max-height: 86vh; border-radius: 20px 20px 0 0; padding: 10px 10px calc(14px + env(safe-area-inset-bottom, 0px)); animation: ig-sheet-up .24s cubic-bezier(.2,.8,.3,1); }
                .ig-account-extra { display: block; }

                /* page filter + toolbar: stack everything full-width */
                #ig-listwrap { width: 92vw; }
                #ig-home { width: 92vw; }
                /* fav/home tabbar sticks to the top while scrolling (full-bleed) */
                .ig-fav-tabs, .ig-home-tabs { position: sticky; top: 0; z-index: 45; margin: 0 -4vw 14px; padding: 11px 4vw; background: rgba(15,15,18,.96); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
                .ig-fav { opacity: .92; transform: none; } /* no hover on touch → keep it visible */
                .ig-view-seg { flex: 1; justify-content: space-between; }
                .ig-view-seg button { flex: 1; }
                .ig-list-actions { width: 100%; flex-wrap: wrap; }

                /* filters become a "Filters" button that opens a bottom sheet */
                .ig-list-filterbtn { display: inline-flex; }
                .ig-list-filters { display: none; }
                .ig-list-filters.open {
                    display: flex; flex-direction: column; align-items: stretch; gap: 12px;
                    position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483050;
                    max-height: 82vh; overflow-y: auto; border-radius: 18px 18px 0 0;
                    padding: 16px 16px calc(20px + env(safe-area-inset-bottom, 0px));
                    animation: ig-sheet-up .22s cubic-bezier(.2,.8,.3,1);
                }
                .ig-sheet-head { display: flex; }
                .ig-list-filters.open .ig-sheet-foot { display: flex; position: sticky; bottom: calc(-20px - env(safe-area-inset-bottom, 0px)); margin: 6px -16px calc(-20px - env(safe-area-inset-bottom, 0px)); padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px)); background: rgba(20,20,26,.97); border-top: 1px solid #2a2a31; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
                .ig-list-cats { min-width: 0; }
                .ig-list-lang, .ig-list-apply { width: 100%; }
                @keyframes ig-sheet-up { from { transform: translateY(100%); } }

                /* keep any non-transformed native page within the viewport */
                body { max-width: 100vw; overflow-x: hidden; }
                .ido, .stuffbox, .homebox { min-width: 0 !important; max-width: 100% !important; }
                ins, iframe[src*="juicyads"], .adsbyjuicy, table.itg, table.ptt, table.ptb { max-width: 100% !important; }

                /* float gallery controls clear of the bottom nav */
                #ig-fab { right: 16px; bottom: 74px; }
                #ig-backfab { right: 16px; bottom: 74px; }
                .ig-resume { bottom: 74px; }
                #ig-pop-dl { left: 4vw; right: 4vw; bottom: 140px; }
                .ig-modal-nav { display: none; } /* mobile navigates by swipe/scroll */
                .ig-modal-close { width: 44px; height: 44px; top: 12px; right: 12px; }
                .ig-modal-stripbtn { width: 44px; height: 44px; top: 12px; right: 66px; }
                .ig-modal-open { width: 44px; height: 44px; top: 12px; right: 120px; }
                .ig-modal-img { max-width: 98vw; }
                .ig-pop { min-width: 0; }

                /* search modal + tag picker become bottom sheets */
                #ig-search, #ig-tagpick { align-items: flex-end; padding: 0; }
                .ig-search-box { width: 100%; max-width: none; max-height: 90vh; border-radius: 20px 20px 0 0; animation: ig-sheet-up .24s cubic-bezier(.2,.8,.3,1); }
                .ig-tagpick-box { width: 100%; max-width: none; max-height: 80vh; border-radius: 20px 20px 0 0; animation: ig-sheet-up .24s cubic-bezier(.2,.8,.3,1); }
                .ig-search-foot { padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
            }
        `);
    }
})();
