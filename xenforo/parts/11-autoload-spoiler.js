    // =========================================================
    // FEATURE: auto-load redgifs
    // =========================================================

    function autoLoadRedgifs(roots) {
        eachIn(roots, 'div.generic2wide-iframe-div[onclick*="redgifs"]:not([data-redgifs-autoloaded]):not([data-rg-done])', el => {
            // seguro extra: se já tem iframe, já carregou (caso o loadMedia troque o nó).
            // marca ANTES do return (REGRA DE OURO) — senão o div re-entra no scan todo full-scan
            if (el.querySelector('iframe')) { el.dataset.redgifsAutoloaded = 'true'; return; }

            el.dataset.redgifsAutoloaded = 'true';
            // dispara o loadMedia(...) inline do próprio site
            el.click();
        });
    }

    // =========================================================
    // FEATURE: auto-expand spoilers
    // =========================================================

    function autoExpandSpoilers(roots) {
        eachIn(roots, '.bbCodeSpoiler:not([data-auto-expanded])', spoiler => {

            const btn = spoiler.querySelector('.bbCodeSpoiler-button');
            const content = spoiler.querySelector('.bbCodeSpoiler-content');
            if (!btn || !content) return;

            // marca ANTES de clicar → no máximo 1 clique por spoiler, pra sempre.
            // sem isso, um spoiler que não "abre" pelo critério display:none
            // (ex.: aninhado num pai escondido) re-clicava a cada mutação e
            // travava a aba num loop infinito de cliques.
            spoiler.dataset.autoExpanded = 'true';

            if (getComputedStyle(content).display === 'none') {
                btn.click();
            }
        });
    }
