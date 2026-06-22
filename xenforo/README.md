# xenforo — fonte do userscript Modern SimpCity / SocialMediaGirls

O userscript do Tampermonkey é **um arquivo só** (escopo IIFE compartilhado). Pra
organizar sem virar um monólito de 8 mil linhas, o fonte mora aqui em pedaços
(`parts/`) e um **builder concatena** tudo de volta no `script.js` único —
gerado AQUI na pasta (`userscripts/xenforo/script.js`).

## Fluxo

```bash
# editou um part? regenere o monólito:
node userscripts/xenforo/build.js          # parts/*.js  →  userscripts/xenforo/script.js
node --check userscripts/xenforo/script.js # sanidade
node userscripts/xenforo/test.js           # smoke: build + sintaxe + mount jsdom (sem abrir o Tampermonkey)
# cole o userscripts/xenforo/script.js gerado no Tampermonkey
```

⚠️ **NÃO edite o `script.js` gerado** — ele é GERADO. Edite os `parts/*.js`.

## Por que concatenação e não bundler (esbuild/rollup)?

O script é um `(function(){ … })()` onde tudo enxerga tudo (sem `import`/`export`).
Um bundler de verdade exigiria reescrever pra ES modules = refactor gigante e
arriscado. A concatenação gera saída **byte-idêntica** à de hoje → risco de runtime
zero. Os parts são fragmentos crus que vivem dentro do MESMO IIFE, na ordem dos
prefixos numéricos.

## parts/ (ordem = prefixo numérico)

| part | conteúdo |
|------|----------|
| `01-header` | `==UserScript==` + índice/modelo mental + abertura do IIFE + `'use strict'` |
| `02-config` | `DEFAULT_FEATURES`, `FEATURES`, `gmGet/gmSet`, `SETTINGS_META` |
| `03-i18n` | `IS_PT`, `I18N_PT`, `i18n()`, `i18nDom()`, `navHref()` |
| `04-icons` | `ICONS{}`, logo/placeholder marks, favicon |
| `05-styles` | `injectStyles()` — a CSS inteira, em consts de seção (`CSS_BASE`/`CSS_HOME`/`CSS_TOPBAR`/`CSS_MOBILE`/`CSS_FILTERBAR`/`CSS_THREAD`) concatenadas (templates ` `` `) |
| `06-helpers` | helpers de texto/url + UI builders (`makeDock*`) + paginação + infra compartilhada (`fetchDoc`, `postForm`, `onScrollRaf`, `makeLazyIO`) |
| `07-posts-misc` | filtro por autor, atalhos de teclado, scroll infinito (`makePagerSync`) |
| `08-images-masonry` | `processImages`, `collectGalleryBlocks`, `buildPostGallery(ies)` (grid Pinterest) |
| `09-turbo` | `processTurboLinks`, `buildEmbedWrapper`, `buildTurboIframe/Error`, `turboCheck` |
| `10-redgifs-player` | pipeline redgifs/turbo: `rg*`, `buildNativeVideo`, `turboApi`, `processTurboNativeEmbeds`, `applyRedgifsPlayer` |
| `11-autoload-spoiler` | `autoLoadRedgifs`, `autoExpandSpoilers` |
| `12-dock-postnav` | `setupPostNavigation()` — dock + busca (GRANDE; em `setupOptionsSheet`/`setupSearch`/`setupSettings`/`setupAuthorFilter`/`setupListFilter`) |
| `13-search-imageclick` | `enableSearchTitlesOnly`, `buildSearchResultsPanel` (filtros inline na página de resultados), `setupImageClickFeed` |
| `14-feed-lightbox` | `collectMediaFrom`, galeria (`gal*`), `openMediaFeed()` (+ `setupFeedGestures`, `downloadSlide`) |
| `15-listing` | grade/lista de tópicos, badges reativos, placeholders |
| `16-home` | home (`forum_list`): merge/relocate/expand/sort + `buildHomeFeed` + sidebar |
| `17-thread-filterbar` | barra única segmentada (`smg*`, `buildFilterBars`) |
| `18-alerts` | limpeza/agrupamento de alertas |
| `19-topbar` | `buildTopbar()` (GRANDE; em `buildMobileSheets`/`wirePopovers`) |
| `20-hover-preview` | `setupThumbPreview` |
| `21-init-features` | favicon, redirect-unwrap, reveal-liked, saint, download, direct-media, group-links |
| `22-bookmarks` | `/account/bookmarks` vira feed (replace total da lista) — reusa `riverParsePost`/`riverCard` |
| `22-init` | `processAll()`, `scheduleRun()`, `detectPageClasses()`, `boot()` + fechamento `})();` |

## Mexer na estrutura

- **Editar código**: abra o part certo, edite, `node build.js`. Cada part é um
  fragmento dentro do IIFE — pode usar funções/consts de outros parts (mesmo escopo).
  O lint do editor vai reclamar de "undefined" entre parts; é esperado (só o
  `script.js` final é válido). Valide com `node --check script.js`.
- **Mover uma fronteira / criar um part novo**: ajuste o array `STARTS` no
  `build-once.js` e rode-o de novo (ele re-fatia do `script.js` atual e
  **verifica round-trip byte-a-byte**). Renumere os prefixos se precisar reordenar.
- **Ordem importa**: os `const`/`let` de topo precisam vir antes do uso em runtime;
  o `boot()` (que dispara tudo) é o ÚLTIMO. Não mova o `22-init` pra cima.

## Gotchas (herdados — ver memória do projeto)

- A CSS vive num template ` `` ` em `05-styles` → **nunca** backtick dentro de
  comentário/conteúdo CSS. `build.js` conta as chaves `{}` como checagem rápida.
- Esconder via JS algo com `!important` na CSS → `setProperty('…','…','important')`.
- `processAll` roda quase todo frame: todo pass precisa de bailout barato
  (`:not([data-marcador])`) e setar o marcador ANTES de qualquer `return`.

## Arquivos

- `build.js` — o builder do dia-a-dia (parts → `userscripts/xenforo/script.js`).
- `build-once.js` — bootstrap: re-fatia o `script.js` atual nos parts (com
  auto-verificação). Só precisa rodar se mudar as fronteiras em `STARTS`.
- `test.js` — smoke-test (jsdom): build + `node --check` + carrega o `script.js`
  num DOM sintético (thread + home) e afere mount sem throw (topbar/dock/busca/
  sheet/feed). `node test.js` ou `npm test` (precisa `npm install` aqui uma vez —
  `jsdom` é devDependency; `node_modules/` é gitignored).
