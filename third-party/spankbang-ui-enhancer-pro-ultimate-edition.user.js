// ==UserScript==
// @name            SpankBang UI Enhancer Pro (Ultimate Edition)
// @name:de         SpankBang UI Enhancer Pro (Ultimate Edition)
// @name:fr         SpankBang UI Enhancer Pro (Ultimate Edition)
// @name:es         SpankBang UI Enhancer Pro (Ultimate Edition)
// @name:it         SpankBang UI Enhancer Pro (Ultimate Edition)
// @name:pt         SpankBang UI Enhancer Pro (Ultimate Edition)
// @name:ru         SpankBang UI Enhancer Pro (Ultimate Edition)
// @name:zh         SpankBang UI Enhancer Pro (Ultimate Edition)
// @name:ja         SpankBang UI Enhancer Pro (Ultimate Edition)
// @description     Ultimate UI-Cleanup: Removes Overlays, Blur, Lock-Icons, and Hover-Restrictions.
// @description:de  Ultimatives UI-Cleanup: Entfernt Overlays, Blur, Lock-Icons und Hover-Sperren.
// @description:fr  Nettoyage ultime de l'interface : supprime les superpositions, le flou, les icônes de verrouillage et les restrictions de survol.
// @description:es  Limpieza definitiva de la interfaz: elimina superposiciones, desenfoques, iconos de candado y restricciones de desplazamiento.
// @description:it  Pulizia definitiva dell'interfaccia: rimuove sovrapposizioni, sfocature, icone di blocco e restrizioni al passaggio del mouse.
// @description:pt  Limpeza definitiva da interface: remove sobreposições, desfoque, ícones de cadeado e restrições de passagem do mouse.
// @description:ru  Ультимативная очистка интерфейса: удаление наложений, размытия, значков блокировки и ограничений при наведении курсора.
// @description:zh  终极界面清理：移除叠加层、模糊、锁定图标和悬停限制。
// @description:ja  究極のUIクリーンアップ：オーバーレイ、ぼかし、ロックアイコン、ホバー制限を削除します。
// @version         0.1.6
// @author          Wack.3gp (https://sleazyfork.org/users/4792)
// @copyright       2026+, Wack.3gp
// @namespace       https://sleazyfork.org/users/4792/
// @license         CC BY-NC-SA-4.0; https://creativecommons.org/licenses/by-nc-sa/4.0/
// @icon            https://spankbang.com/static/desktop/Images/icons/v3/favicon.ico
//
// @match           *://*.spankbang.com/*
// @match           *://*.spankbang.party/*
//
// @grant           GM_info
// @grant           GM_notification
//
// @run-at          document-start
//
// @supportURL      https://sleazyfork.org/scripts/574330/feedback
// @compatible      Chrome tested with Tampermonkey
// @contributionURL https://www.paypal.com/donate/?hosted_button_id=BYW9D395KJWZ2
// @contributionAmount €1.00
// @downloadURL https://update.sleazyfork.org/scripts/574330/SpankBang%20UI%20Enhancer%20Pro%20%28Ultimate%20Edition%29.user.js
// @updateURL https://update.sleazyfork.org/scripts/574330/SpankBang%20UI%20Enhancer%20Pro%20%28Ultimate%20Edition%29.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const injectStyles = () => {
        if (document.getElementById('sb-ultimate-cleaner')) return;

        const style = document.createElement('style');
        style.id = 'sb-ultimate-cleaner';
        style.innerHTML = `
            /* Remove Blur and Filter effects */
            .strong-blur, .blur, [class*="blur"], 
            .video-list .naughty, .video-item.blur,
            .vjs-blur, .video-player-container.blur,
            img[style*="filter"] {
                filter: none !important;
                -webkit-filter: none !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }

            [aria-label="Explicit content locked"],
            .group-hover\\/media\\:flex,
            [class*="group-hover/media"],
            .bg-surface-black\\/40,
            #av-wrapper, #safety-blur, .js-modal-overlay, 
            .remodal-overlay, [id*="age-verification"], 
            .modal-backdrop, .age-gate-portal,
            .login-wall, .registration-promo {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }

            html, body {
                overflow: auto !important;
                position: static !important;
                height: auto !important;
                pointer-events: auto !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    };

    const performCleanup = () => {
        try {
            document.querySelectorAll('.strong-blur, .blur').forEach(el => {
                el.classList.remove('strong-blur', 'blur');
            });

            if (window.hideExplicitContent !== undefined) window.hideExplicitContent = false;
            if (window.is_logged_in === false) window.is_logged_in = true;
            
            if (document.body && (document.body.classList.contains('overflow-hidden') || document.body.style.overflow === 'hidden')) {
                document.body.style.setProperty('overflow', 'auto', 'important');
                document.body.classList.remove('overflow-hidden', 'fixed');
            }
        } catch (e) {
        }
    };

    const checkUpdate = () => {
        const currentVersion = GM_info.script.version;
        const lastSeenVersion = localStorage.getItem('sb_last_version');
        const donationUrl = GM_info.script.header.match(/@contributionURL\s+(.+)/)[1];

        if (lastSeenVersion !== currentVersion) {
            GM_notification({
                title: `🚀 ${GM_info.script.name} v${currentVersion}`,
                text: `Version ${currentVersion} is live. UI is clean.\nHappy gooning! 💦`,
                image: GM_info.script.icon,
                timeout: 10000,
                onclick: () => {
                    window.open(donationUrl, "_blank");
                }
            });
            localStorage.setItem('sb_last_version', currentVersion);
        }
    };

    injectStyles();

    const observer = new MutationObserver((mutations) => {
        let updateNeeded = false;
        for (let m of mutations) {
            if (m.addedNodes.length || m.attributeName === 'class') {
                updateNeeded = true;
                break;
            }
        }
        if (updateNeeded) performCleanup();
    });

    if (document.documentElement) {
        observer.observe(document.documentElement, { 
            childList: true, 
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    performCleanup();

    window.addEventListener('load', () => {
        injectStyles();
        performCleanup();
        setTimeout(checkUpdate, 2000);
    });

    console.log(`${GM_info.script.name}: Fully Loaded`);
})();