// ==UserScript==
// @name         Pure Twitter (X) Age Bypass 
// @namespace    X-Age
// @version      8.5
// @license      MIT
// @description  Fastest and lightest age verification bypass for X (Twitter)
// @author       PHR
// @match        https://x.com/*
// @match        https://twitter.com/*
// @icon         https://abs.twimg.com/responsive-web/client-web/icon-ios.77d25eba.png
// @grant        none
// @run-at       document-start
// @downloadURL https://update.greasyfork.org/scripts/576713/Pure%20Twitter%20%28X%29%20Age%20Bypass.user.js
// @updateURL https://update.greasyfork.org/scripts/576713/Pure%20Twitter%20%28X%29%20Age%20Bypass.meta.js
// ==/UserScript==

(() => {
    'use strict';

    const TARGET = "TweetWithVisibilityResults";
    const GQL_PATH = "/graphql/";

    const reviver = (key, value) => {
        if (value && typeof value === 'object') {
            if (value.__typename === TARGET && value.tweet) {
                value.tweet.__typename = "Tweet";
                return value.tweet;
            }
        }
        return value;
    };

    window.fetch = new Proxy(window.fetch, {
        apply: async (target, thisArg, args) => {
            const response = await Reflect.apply(target, thisArg, args);
            const url = args[0] instanceof Request ? args[0].url : String(args[0] || '');

            if (url.includes(GQL_PATH)) {
                const clone = response.clone();
                let cachedObj = null;
                let cachedText = null;

                response.json = async () => {
                    if (cachedObj) return cachedObj;
                    if (cachedText === null) cachedText = await clone.text();
                    
                    if (!cachedText.includes(TARGET)) return JSON.parse(cachedText);
                    
                    cachedObj = JSON.parse(cachedText, reviver);
                    return cachedObj;
                };

                response.text = async () => {
                    if (cachedObj) return JSON.stringify(cachedObj);
                    if (cachedText === null) cachedText = await clone.text();
                    
                    if (!cachedText.includes(TARGET)) return cachedText;
                    
                    cachedObj = JSON.parse(cachedText, reviver);
                    return JSON.stringify(cachedObj);
                };
            }
            return response;
        }
    });

    const XHR = XMLHttpRequest.prototype;
    const orgOpen = XHR.open;
    const xhrCache = new WeakMap();

    XHR.open = function(method, url) {
        this._isGql = typeof url === 'string' && url.includes(GQL_PATH);
        return orgOpen.apply(this, arguments);
    };

    ['responseText', 'response'].forEach(prop => {
        const desc = Object.getOwnPropertyDescriptor(XHR, prop);
        if (!desc) return;

        Object.defineProperty(XHR, prop, {
            ...desc,
            get() {
                let raw;
                try { 
                    raw = desc.get.call(this); 
                } catch (e) { 
                    return undefined; 
                }

                if (!this._isGql || this.readyState !== XMLHttpRequest.DONE || !raw) return raw;

                let cache = xhrCache.get(this);
                if (!cache) {
                    cache = {};
                    xhrCache.set(this, cache);
                }

                if (!(prop in cache)) {
                    try {
                        if (typeof raw === 'string') {
                            if (!raw.includes(TARGET)) {
                                cache[prop] = raw;
                            } else {
                                const parsed = JSON.parse(raw, reviver);
                                cache[prop] = prop === 'responseText' ? JSON.stringify(parsed) : parsed;
                            }
                        } else if (typeof raw === 'object') {
                            cache[prop] = JSON.parse(JSON.stringify(raw), reviver);
                        } else {
                            cache[prop] = raw;
                        }
                    } catch (e) {
                        console.error("[X-Age Bypass] Error:", e);
                        cache[prop] = raw;
                    }
                }
                return cache[prop];
            }
        });
    });
})();