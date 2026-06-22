// ==UserScript==
// @name         Twitch.tv chat Translation (Optimized Auto)
// @namespace    Magof - twitch-translation-script
// @version      2.2
// @description  Add a button to the Twitch.tv website that opens a menu to translate messages to the Twitch.tv chat. Auto-start translation.
// @author       Magof
// @match        https://www.twitch.tv/*
// @downloadURL https://update.greasyfork.org/scripts/471118/Twitchtv%20chat%20Translation%20%28Optimized%29.user.js
// @updateURL https://update.greasyfork.org/scripts/471118/Twitchtv%20chat%20Translation%20%28Optimized%29.meta.js
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'twitch_translation_config';

    // Carrega configurações salvas
    function loadSettings() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

            // DEFAULTS: sempre começar ligado, idioma padrão pt-br se nada definido
            if (typeof data.enabled === 'undefined') {
                data.enabled = true;
            }
            if (!data.lang) {
                data.lang = 'pt-br';
            }

            return data;
        } catch (e) {
            return { enabled: true, lang: 'pt-br' };
        }
    }

    function saveSettings(settings) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    // Função chamada ao clicar no botão
    function toggleToolbox() {
        const toolbox = document.getElementById('toolbox');
        if (toolbox) {
            toolbox.classList.toggle('visible');
        }
    }

    function addButton() {
        const existingButton = document.getElementById('toggle-toolbox');
        if (existingButton) {
            return;
        }

        const newButton = document.createElement('div');
        newButton.style.display = 'inline-flex';
        newButton.style.alignItems = 'center';

        const btnInner = document.createElement('button');
        btnInner.className = 'Layout-sc-1xcs6mc-0 cMreAt';
        btnInner.style.cssText = 'background: transparent; border: none; color: var(--color-fill-button-icon); cursor: pointer; padding: 4px; display: flex; align-items: center; font-weight: 600; font-size: 13px;';
        btnInner.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
                <path d="M10.5 5h-1v3H6v1h3.5v5.5h1V9H14V8h-3.5z"/>
            </svg>
            <span style="margin-left: 4px; padding-right: 5px;">Translate</span>
        `;

        btnInner.onmouseover = () => {
            btnInner.style.backgroundColor = 'var(--color-background-button-text-hover)';
            btnInner.style.borderRadius = '4px';
        };
        btnInner.onmouseout = () => {
            btnInner.style.backgroundColor = 'transparent';
        };

        newButton.appendChild(btnInner);
        newButton.id = 'toggle-toolbox';

        btnInner.addEventListener('click', (e) => {
            e.preventDefault();
            toggleToolbox();
        });

        const chatButtonsContainer = document.querySelector('.chat-input__buttons-container');
        if (chatButtonsContainer) {
            if (chatButtonsContainer.firstChild) {
                chatButtonsContainer.insertBefore(newButton, chatButtonsContainer.firstChild);
            } else {
                chatButtonsContainer.appendChild(newButton);
            }
        }
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const toolbox = document.getElementById('toolbox');
            if (toolbox && toolbox.classList.contains('visible')) {
                toggleToolbox();
            }
        }
    });

    let observer = null;

    const originalMessages = new Map();
    const translationCache = new Map();

    function translateText(text, destinationLanguage) {
        return new Promise((resolve, reject) => {
            const cacheKey = `${destinationLanguage}:${text}`;
            if (translationCache.has(cacheKey)) {
                resolve(translationCache.get(cacheKey));
                return;
            }

            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${destinationLanguage}&dt=t&q=${encodeURIComponent(text)}`;
            fetch(url)
                .then(response => response.json())
                .then(data => {
                    const translation = data[0].map(item => item[0]).join('');
                    translationCache.set(cacheKey, translation);
                    resolve(translation);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    function translateMessage(messageElement, destinationLanguage) {
        const originalText = originalMessages.get(messageElement);
        if (!originalText) return;

        translateText(originalText, destinationLanguage)
            .then(translation => {
                messageElement.textContent = translation;
                messageElement.title = originalText;
                messageElement.style.color = 'var(--color-text-base)';
                messageElement.style.backgroundColor = 'var(--color-background-alt)';
                messageElement.style.borderRadius = '2px';
                messageElement.style.padding = '0 2px';
            })
            .catch(error => {
                console.error("Error translating message:", error);
            });
    }

    // Flag para evitar recursão infinita
    let pendingEnableRetry = false;

    function updateTranslationState() {
        const checkbox = document.getElementById('real-time-translate');
        const selectElement = document.getElementById('language-select');

        if (!checkbox || !selectElement) return;

        const option = selectElement.value;
        const isEnabled = checkbox.checked;

        saveSettings({ enabled: isEnabled, lang: option });

        if (isEnabled) {
            // Se o chat ainda não carregou, tentar de novo depois
            const chatContainer = document.querySelector('[data-test-selector="chat-scrollable-area__message-container"]');
            if (!chatContainer) {
                if (!pendingEnableRetry) {
                    pendingEnableRetry = true;
                    setTimeout(() => {
                        pendingEnableRetry = false;
                        // Garante que ainda está habilitado antes de tentar de novo
                        const cb = document.getElementById('real-time-translate');
                        if (cb && cb.checked && !observer) {
                            updateTranslationState();
                        }
                    }, 1000);
                }
                return;
            }

            // Já existe observer? então nada a fazer (já está traduzindo)
            if (observer) {
                return;
            }

            // Traduz mensagens já existentes
            const messages = document.querySelectorAll("span.text-fragment");
            messages.forEach(messageElement => {
                if (!originalMessages.has(messageElement)) {
                    const originalText = messageElement.textContent;
                    originalMessages.set(messageElement, originalText);
                    translateMessage(messageElement, option);
                }
            });

            // Cria observer para novas mensagens
            observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    const newMessages = Array.from(mutation.addedNodes).filter(node => node.nodeType === Node.ELEMENT_NODE);
                    newMessages.forEach(node => {
                        const messageElements = node.querySelectorAll ? node.querySelectorAll('span.text-fragment') : [];
                        messageElements.forEach(messageElement => {
                            if (messageElement && !originalMessages.has(messageElement)) {
                                const originalText = messageElement.textContent;
                                originalMessages.set(messageElement, originalText);
                                translateMessage(messageElement, option);
                            }
                        });
                    });
                });
            });

            const observerConfig = { childList: true, subtree: true };
            observer.observe(chatContainer, observerConfig);
        } else {
            if (observer) {
                observer.disconnect();
                observer = null;
            }

            originalMessages.forEach((originalText, messageElement) => {
                messageElement.textContent = originalText;
                messageElement.style.backgroundColor = '';
                messageElement.style.color = '';
            });

            originalMessages.clear();
        }
    }

    // Verifica mudanças no DOM e garante que a config seja aplicada
    function checkDOMChange() {
        addButton();

        const checkbox = document.getElementById('real-time-translate');
        const selectElement = document.getElementById('language-select');

        if (checkbox && selectElement && !checkbox.dataset.restored) {
            const settings = loadSettings();

            // Aplica idioma salvo / padrão
            selectElement.value = settings.lang || 'pt-br';

            // Sempre manter a tradução ligada se o usuário nunca mexeu
            checkbox.checked = !!settings.enabled;

            checkbox.dataset.restored = "true";

            // Tenta já ativar a tradução (se o chat ainda não existir, a função se re-tenta sozinha)
            updateTranslationState();
        }

        setTimeout(checkDOMChange, 2000);
    }

    window.addEventListener('load', () => {
        const css = `
            .tool-box.visible {
              display: block;
              opacity: 1;
              transform: translateY(0);
            }

            .tool-box {
              position: fixed;
              bottom: 60px;
              right: 20px;
              background-color: var(--color-background-base);
              border: 1px solid var(--color-border-base);
              padding: 16px;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
              font-family: Inter, Roobert, "Helvetica Neue", Helvetica, Arial, sans-serif;
              color: var(--color-text-base);
              display: none;
              width: 300px;
              z-index: 9999;
            }

            .tool-box h2 {
              font-size: 18px;
              margin-bottom: 16px;
              text-align: center;
              font-weight: 700;
              border-bottom: 1px solid var(--color-border-base);
              padding-bottom: 8px;
            }

            .tool-box label {
              display: flex;
              align-items: center;
              margin-bottom: 12px;
              cursor: pointer;
              font-size: 14px;
            }

            .tool-box input[type="checkbox"] {
                margin-right: 8px;
                transform: scale(1.2);
            }

            .tool-box select {
              width: 100%;
              padding: 8px;
              margin-bottom: 10px;
              background-color: var(--color-background-input);
              color: var(--color-text-input);
              border: 1px solid var(--color-border-input);
              border-radius: 4px;
              font-size: 14px;
            }
            .tool-box select:focus {
                outline: 2px solid var(--color-fill-brand);
            }

            .tool-box-close {
                position: absolute;
                top: 8px;
                right: 8px;
                background: none;
                border: none;
                color: var(--color-text-alt);
                cursor: pointer;
                font-weight: bold;
            }
        `;
        const style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);

        const toolboxHtml = `
            <div class="tool-box" id="toolbox">
                <button class="tool-box-close" onclick="document.getElementById('toolbox').classList.remove('visible')">✕</button>
                <h2>Translation Settings</h2>
                <label>
                    <input type="checkbox" id="real-time-translate" />
                    <span>Enable Real-Time Translation</span>
                </label>
                <div style="margin-bottom: 4px; font-size:12px; font-weight:600; color:var(--color-text-alt);">Target Language</div>
                <select id="language-select">
                    <option value="af">Afrikaans</option>
                    <option value="sq">Albanian</option>
                    <option value="am">Amharic</option>
                    <option value="ar">Arabic</option>
                    <option value="hy">Armenian</option>
                    <option value="az">Azerbaijani</option>
                    <option value="eu">Basque</option>
                    <option value="be">Belarusian</option>
                    <option value="bn">Bengali</option>
                    <option value="bs">Bosnian</option>
                    <option value="bg">Bulgarian</option>
                    <option value="ca">Catalan</option>
                    <option value="ceb">Cebuano</option>
                    <option value="ny">Chichewa</option>
                    <option value="zh-cn">Chinese (Simplified)</option>
                    <option value="zh-tw">Chinese (Traditional)</option>
                    <option value="co">Corsican</option>
                    <option value="hr">Croatian</option>
                    <option value="cs">Czech</option>
                    <option value="da">Danish</option>
                    <option value="nl">Dutch</option>
                    <option value="en">English</option>
                    <option value="eo">Esperanto</option>
                    <option value="et">Estonian</option>
                    <option value="tl">Filipino</option>
                    <option value="fi">Finnish</option>
                    <option value="fr">French</option>
                    <option value="fy">Frisian</option>
                    <option value="gl">Galician</option>
                    <option value="ka">Georgian</option>
                    <option value="de">German</option>
                    <option value="el">Greek</option>
                    <option value="gu">Gujarati</option>
                    <option value="ht">Haitian Creole</option>
                    <option value="ha">Hausa</option>
                    <option value="haw">Hawaiian</option>
                    <option value="iw">Hebrew</option>
                    <option value="hi">Hindi</option>
                    <option value="hmn">Hmong</option>
                    <option value="hu">Hungarian</option>
                    <option value="is">Icelandic</option>
                    <option value="ig">Igbo</option>
                    <option value="id">Indonesian</option>
                    <option value="ga">Irish</option>
                    <option value="it">Italian</option>
                    <option value="ja">Japanese</option>
                    <option value="jw">Javanese</option>
                    <option value="kn">Kannada</option>
                    <option value="kk">Kazakh</option>
                    <option value="km">Khmer</option>
                    <option value="ko">Korean</option>
                    <option value="ku">Kurdish (Kurmanji)</option>
                    <option value="ky">Kyrgyz</option>
                    <option value="lo">Lao</option>
                    <option value="la">Latin</option>
                    <option value="lv">Latvian</option>
                    <option value="lt">Lithuanian</option>
                    <option value="lb">Luxembourgish</option>
                    <option value="mk">Macedonian</option>
                    <option value="mg">Malagasy</option>
                    <option value="ms">Malay</option>
                    <option value="ml">Malayalam</option>
                    <option value="mt">Maltese</option>
                    <option value="mi">Maori</option>
                    <option value="mr">Marathi</option>
                    <option value="mn">Mongolian</option>
                    <option value="my">Myanmar (Burmese)</option>
                    <option value="ne">Nepali</option>
                    <option value="no">Norwegian</option>
                    <option value="ps">Pashto</option>
                    <option value="fa">Persian</option>
                    <option value="pl">Polish</option>
                    <option value="pt">Portuguese</option>
                    <option value="pt-br">Portuguese (Brazil)</option>
                    <option value="pa">Punjabi</option>
                    <option value="ro">Romanian</option>
                    <option value="ru">Russian</option>
                    <option value="sm">Samoan</option>
                    <option value="gd">Scots Gaelic</option>
                    <option value="sr">Serbian</option>
                    <option value="st">Sesotho</option>
                    <option value="sn">Shona</option>
                    <option value="sd">Sindhi</option>
                    <option value="si">Sinhala</option>
                    <option value="sk">Slovak</option>
                    <option value="sl">Slovenian</option>
                    <option value="so">Somali</option>
                    <option value="es">Spanish</option>
                    <option value="su">Sundanese</option>
                    <option value="sw">Swahili</option>
                    <option value="sv">Swedish</option>
                    <option value="tg">Tajik</option>
                    <option value="ta">Tamil</option>
                    <option value="te">Telugu</option>
                    <option value="th">Thai</option>
                    <option value="tr">Turkish</option>
                    <option value="uk">Ukrainian</option>
                    <option value="ur">Urdu</option>
                    <option value="uz">Uzbek</option>
                    <option value="vi">Vietnamese</option>
                    <option value="cy">Welsh</option>
                    <option value="xh">Xhosa</option>
                    <option value="yi">Yiddish</option>
                    <option value="yo">Yoruba</option>
                    <option value="zu">Zulu</option>
                </select>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = toolboxHtml;
        document.body.appendChild(div);

        document.getElementById('real-time-translate').addEventListener('change', updateTranslationState);
        document.getElementById('language-select').addEventListener('change', updateTranslationState);

        checkDOMChange();
    });
})();
