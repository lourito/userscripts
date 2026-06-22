// ==UserScript==
// @name         Spankbang AV Bypass
// @namespace    gm.cat-ling
// @version      1.3.1
// @description  Overwrites cookies for Spankbang domains to make it think you're from the United States. Bypassing verification of all types, including challenges and real ID verification.
// @author       Cat-Ling
// @license      GPL-3.0-or-later
// @match        https://spankbang.party/*
// @match        https://spankbang.com/*
// @grant        none
// @downloadURL https://update.sleazyfork.org/scripts/554258/Spankbang%20AV%20Bypass.user.js
// @updateURL https://update.sleazyfork.org/scripts/554258/Spankbang%20AV%20Bypass.meta.js
// ==/UserScript==

// Copyright (C) 2025 Cat-Ling | Licensed under GPL-3.0-or-later

(function() {
    'use strict';

    const host = window.location.hostname;
    const baseDomain = host.includes("spankbang.party") ? "spankbang.party" : "spankbang.com";

    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const setCookie = (name, value, prefix = '') => {
        document.cookie = `${name}=${value}; expires=${expiryDate.toUTCString()}; path=/; domain=${prefix}${baseDomain};`;
    };

    setCookie('media_layout', 'four-col');
    setCookie('coc', 'US', '.'); 
    setCookie('cor', 'NV', '.'); 
    setCookie('coe', 'us');

})();