// ==UserScript==
// @name         Scribd Bypass
// @description  Skip Scribd for its free counterpart and download any file.
// @author       573dave
// @version      3.0.4
// @license      MIT
// @match        *://*.scribd.com/*
// @match        *://*.vdownloaders.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        unsafeWindow
// @namespace    https://greasyfork.org/users/1241821
// @downloadURL https://update.greasyfork.org/scripts/513303/Scribd%20Bypass.user.js
// @updateURL https://update.greasyfork.org/scripts/513303/Scribd%20Bypass.meta.js
// ==/UserScript==

(() => {
  "use strict";

  const host = location.hostname;
  const isScribd = /(^|\.)scribd\.com$/i.test(host);
  const isVdl = /(^|\.)vdownloaders\.com$/i.test(host);
  const SKIP_KEY = "sb_skip_embed_once";

  const ready = (fn) =>
    document.body ? fn() : addEventListener("DOMContentLoaded", fn, { once: true });

  const css = (s) =>
    typeof GM_addStyle === "function"
      ? GM_addStyle(s)
      : document.documentElement.appendChild(
          Object.assign(document.createElement("style"), { textContent: s })
        );

  if (isVdl) cleanVdl();
  if (isScribd) ready(embedScribd);

  function embedScribd() {
    const url = location.href;

    if (sessionStorage.getItem(SKIP_KEY) === url) {
      sessionStorage.removeItem(SKIP_KEY);
      return;
    }

    const m = url.match(/\/(?:doc|document|presentation)\/(\d+)(?:\/|$)/i);
    if (!m) return;

    const id = encodeURIComponent(m[1]);

    css(`
      .sbm{position:fixed;top:0;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:2147483647;background:#ffffffe8;padding:6px 10px;border-radius:0 0 6px 6px;box-shadow:0 2px 6px #0003}
      .sbb{font:12px/1 sans-serif;padding:6px 10px;background:#FFC017;color:#000;border:0;border-radius:5px;cursor:pointer}
      .sbb:hover{background:#E6AC15}
      .sbe{position:relative;width:100%;min-height:100vh;padding-top:45px}
      .sbi{position:absolute;inset:45px 0 0;width:100%;height:calc(100vh - 45px);border:0}
    `);

    document.body.innerHTML = `
      <div class="sbe">
        <iframe class="sbi" src="https://www.scribd.com/embeds/${id}/content" allowfullscreen></iframe>
      </div>
    `;

    const menu = document.createElement("div");
    menu.className = "sbm";
    document.body.prepend(menu);

    menu.append(btn("Download", () => postPreview(url)));
    menu.append(btn("Original Page", () => {
      sessionStorage.setItem(SKIP_KEY, url);
      location.reload();
    }));
  }

  function btn(text, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sbb";
    b.textContent = text;
    b.onclick = fn;
    return b;
  }

  function postPreview(url) {
    const f = Object.assign(document.createElement("form"), {
      method: "post",
      action: "https://scribd.vdownloaders.com/check/",
      target: "_blank"
    });

    f.append(Object.assign(document.createElement("input"), {
      type: "hidden",
      name: "url",
      value: url
    }));

    document.body.append(f);
    f.submit();
    f.remove();
  }

  function cleanVdl() {
    const pageWin = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

    const fake = {
      runBanner() {},
      runPop() {},
      runInterstitial() {}
    };

    try {
      Object.defineProperty(pageWin, "aclib", {
        configurable: true,
        get: () => fake,
        set: () => true
      });
    } catch {
      pageWin.aclib = fake;
    }

    css(`
      a[href*="adexchangerapid"],
      img[src*="crcdn.org"],
      iframe[src*="adexchangerapid"],
      iframe[src*="crcdn.org"],
      [width="728"][height="90"],
      [style*="width: 728px"][style*="height: 90px"],
      [style*="width:728px"][style*="height:90px"]{
        display:none!important;
        visibility:hidden!important;
        opacity:0!important;
        pointer-events:none!important;
        width:0!important;
        height:0!important;
        max-width:0!important;
        max-height:0!important;
        margin:0!important;
        padding:0!important;
        overflow:hidden!important;
      }
    `);

    const adNodeSel = [
      "a[href*='adexchangerapid']",
      "img[src*='crcdn.org']",
      "iframe[src*='adexchangerapid']",
      "iframe[src*='crcdn.org']",
      "[width='728'][height='90']",
      "script"
    ].join(",");

    const isAdNode = (el) => {
      if (!el || el.nodeType !== 1) return false;

      const href = el.getAttribute("href") || "";
      const src = el.getAttribute("src") || "";
      const txt = el.textContent || "";
      const st = el.getAttribute("style") || "";
      const w = el.getAttribute("width") || "";
      const h = el.getAttribute("height") || "";

      return (
        href.includes("adexchangerapid") ||
        src.includes("crcdn.org") ||
        src.includes("adexchangerapid") ||
        txt.includes("aclib.runBanner") ||
        txt.includes("6699022") ||
        (w === "728" && h === "90") ||
        (st.includes("728px") && st.includes("90px"))
      );
    };

    const adContainer = (el) => {
      if (!el || el === document.body || el === document.documentElement) return null;

      const anchor = el.closest?.("a[href*='adexchangerapid']");
      const img = el.closest?.("img[src*='crcdn.org']");
      const base = anchor || img || el;

      let box = base.closest?.("div") || base;

      const center = box.closest?.("center");
      if (center && center !== document.body && center !== document.documentElement) {
        box = center;
      }

      const outer = box.parentElement?.closest?.("div");
      const outerStyle = outer?.getAttribute("style") || "";

      if (
        outer &&
        outer !== document.body &&
        outer !== document.documentElement &&
        (
          outerStyle.includes("margin: 15px") ||
          outer.querySelector?.("a[href*='adexchangerapid'],img[src*='crcdn.org']")
        )
      ) {
        box = outer;
      }

      return box;
    };

    const removeAd = (el) => {
      const box = adContainer(el);
      if (!box || box === document.body || box === document.documentElement) return;
      box.remove();
    };

    const sweep = (root = document) => {
      root.querySelectorAll?.(adNodeSel).forEach((el) => {
        if (isAdNode(el)) removeAd(el);
      });

      root.querySelectorAll?.("div,center").forEach((el) => {
        if (el.querySelector?.("a[href*='adexchangerapid'],img[src*='crcdn.org']")) {
          removeAd(el);
        }
      });
    };

    addEventListener("click", (e) => {
      const a = e.target.closest?.("a[href*='adexchangerapid']");
      if (!a) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      removeAd(a);
    }, true);

    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;

          if (isAdNode(node)) {
            removeAd(node);
          } else {
            sweep(node);
          }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });

    sweep();
    ready(sweep);
    addEventListener("load", sweep);
    setTimeout(sweep, 50);
    setTimeout(sweep, 250);
    setTimeout(sweep, 750);
    setInterval(sweep, 1000);
  }
})();