// ==UserScript==
// @name         Nhentai - Infinite Scroll 2.0 (Svelte Rebirth)
// @version      2.0.5
// @description  Completely replaces DyKx0V's original script due to Nhentai rebuilding their site using Svelte.
// @author       taetae123
// @namespace    Violentmonkey Scripts
// @icon         https://i.postimg.cc/SRgX3gqv/nhentai.png
// @match        *://nhentai.net/*
// @match        *://*.nhentai.net/*
// @run-at       document-idle
// @grant        none
// @license      MIT
// @downloadURL https://update.sleazyfork.org/scripts/525276/Nhentai%20-%20Infinite%20Scroll%2020%20%28Svelte%20Rebirth%29.user.js
// @updateURL https://update.sleazyfork.org/scripts/525276/Nhentai%20-%20Infinite%20Scroll%2020%20%28Svelte%20Rebirth%29.meta.js
// ==/UserScript==


(function () {
"use strict";
 
let currentUrl = null;
 
function init() {
 
let thumbnailContainer = document.getElementById("thumbnail-container");
let gallerythumb = document.getElementsByClassName("gallerythumb");
 
if (!thumbnailContainer || !gallerythumb || gallerythumb.length === 0) return false;
 
// Already processed this page.
 
if (document.getElementById("webtoon-scroll")) return true;
 
let formats = [];
let mid = null;
let cdnHost = "i1.nhentai.net";
 
for (let a of gallerythumb) {
let img = a.querySelector("img");
if (!img || !img.src) continue;
let s = img.src.split("/");
if (s[2] && s[2].startsWith("t")) cdnHost = "i" + s[2].substring(1);
mid = s[4];
formats.push(s[5].split(".").pop());}
 
if (!mid || formats.length === 0) return false;
 
thumbnailContainer.querySelectorAll(".thumbs, .thumb-container").forEach(function (el) {
el.style.display = "none";});
 
if (!document.getElementById("webtoon-style")) {
let style = document.createElement("style");
style.id = "webtoon-style";
style.textContent = `
#webtoon-scroll {display: flex; flex-direction: column; align-items: center; gap: 16px;}
.webtoon-slot {width: 100%; max-width: 900px; display: block; background: #1a1a1a; position: relative;}
.webtoon-slot::before {content: ""; display: block; padding-top: 141%;}
.webtoon-slot img {position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; display: block; opacity: 0; transition: opacity 0.25s ease;}
.webtoon-slot img.loaded {opacity: 1; position: static; height: auto;}
.webtoon-slot.done::before {display: none;}
.webtoon-slot .page-num {position: absolute; bottom: 6px; right: 10px; background: rgba(0,0,0,0.55); color: #fff; font: 11px/1 monospace; padding: 2px 6px; border-radius: 3px; pointer-events: none; z-index: 2;}
`;
document.head.appendChild(style);}
 
let scroll = document.createElement("div");
scroll.id = "webtoon-scroll";
thumbnailContainer.appendChild(scroll);
 
let slots = [];
 
for (let i = 0; i < formats.length; i++) {
let slot = document.createElement("div");
slot.className = "webtoon-slot";
slot.dataset.src = "https://" + cdnHost + "/galleries/" + mid + "/" + (i + 1) + "." + formats[i];
slot.dataset.index = i;
 
let badge = document.createElement("span");
badge.className = "page-num";
badge.textContent = (i + 1) + " / " + formats.length;
slot.appendChild(badge);
 
scroll.appendChild(slot);
slots.push(slot);}
 
const FORMAT_FALLBACKS = ["webp", "jpg", "png", "gif"];
 
function loadSlot(index, retries) {
 
if (!document.getElementById("webtoon-scroll") || index >= slots.length) return;
 
let slot = slots[index];
let baseUrl = slot.dataset.src.replace(/\.[^.]+$/, "");
let originalExt = slot.dataset.src.split(".").pop();
let tryOrder = [originalExt, ...FORMAT_FALLBACKS.filter(f => f !== originalExt)];
 
let attemptIndex = retries % tryOrder.length;
let currentUrl = baseUrl + "." + tryOrder[attemptIndex];
 
let img = new Image();
img.src = currentUrl;
 
img.onload = function () {
let badge = slot.querySelector(".page-num");
if (badge) badge.remove();
slot.appendChild(img);
img.classList.add("loaded");
slot.classList.add("done");
loadSlot(index + 1, 0);};
 
img.onerror = function () {
let totalTries = FORMAT_FALLBACKS.length * 3;
if (retries < totalTries) {
setTimeout(function () {loadSlot(index, retries + 1);}, 1000);}
else {
slot.style.background = "#2a0a0a";
slot.style.minHeight = "60px";
let err = document.createElement("span");
err.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#888;font:12px monospace";
err.textContent = "Page " + (index + 1) + " failed to load";
slot.appendChild(err);
slot.classList.add("done");
loadSlot(index + 1, 0);}};
 
}
 
// Kick off the sequential loader starting at image 0
loadSlot(0, 0);
 
return true;
 
}
 
function tryInit() {
setTimeout(function () {init();}, 800);}
 
// Watch for SPA navigation by intercepting history API.
 
let origPush = history.pushState;
let origReplace = history.replaceState;
 
history.pushState = function () {
origPush.apply(this, arguments);
onNavigate();};
 
history.replaceState = function () {
origReplace.apply(this, arguments);
onNavigate();};
 
window.addEventListener("popstate", onNavigate);
 
function onNavigate() {
let newUrl = location.href;
if (newUrl !== currentUrl) {
currentUrl = newUrl;
tryInit();}}
 
// Also watch DOM for late-rendered content.
 
let obs = new MutationObserver(function () {
if (document.getElementById("thumbnail-container") &&
!document.getElementById("webtoon-scroll") &&
document.getElementsByClassName("gallerythumb").length > 0) {
tryInit();}});
obs.observe(document.body, {childList: true, subtree: true});
 
// Initial run.
 
currentUrl = location.href;
tryInit();
 
})();