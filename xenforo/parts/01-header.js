// ==UserScript==
// @name         Modern SimpCity/SocialMediagirls
// @namespace    http://tampermonkey.net/
// @version      2.50.0
// @author       claudiogepeto
// @description  Topbar + dock + filter bar redesign · grid/list thread view w/ placeholders · full images + portrait grid · turbo/saint/redgifs embeds · pixeldrain/bunkr link cards · auto-expand spoilers · media feed · post media download · skip link warning · reveal like-gated posts
// @match        https://simpcity.cr/*
// @match        https://simpcity.su/*
// @match        https://forums.socialmediagirls.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      turbo.cr
// @connect      saint.su
// @connect      saint2.su
// @connect      api.redgifs.com
// @connect      media.redgifs.com
// @connect      redgifs.com
// @connect      *
// @run-at       document-start
// @license      MIT
// ==/UserScript==

// ⚠️ ARQUIVO GERADO por userscripts/xenforo/build.js — NÃO edite este script.js direto.
//    Edite os fontes em userscripts/xenforo/parts/*.js e rode:  node userscripts/xenforo/build.js
//
// ============================================================================
//  MODERN SIMPCITY / SOCIALMEDIAGIRLS  ·  userscript único (Tampermonkey)
// ============================================================================
//  Navegar: Cmd/Ctrl+F num nome de função (`function rgBuild`) ou num banner de
//  seção (`// FEATURE: turbo`). O índice "ONDE ESTÁ CADA COISA" está em ORDEM DE ARQUIVO.
//
// ── COMO FUNCIONA (modelo mental — leia ANTES de mexer) ─────────────────────
//  2 FÓRUNS, 1 SCRIPT. No boot detecta o site e marca <html> com smg-sc (SimpCity)
//  ou smg-smg (SocialMediaGirls). ~96% do código é comum; o que diverge por fórum
//  é gated por essas classes. A CSS inteira é temática via variáveis --smg-*.
//
//  CICLO DE VIDA (o coração de tudo):
//    boot() → processAll() roda TODAS as features 1× e instala um MutationObserver
//    no body. QUALQUER mutação do DOM → scheduleRun() → requestAnimationFrame →
//    processAll() DE NOVO (no máx 1×/frame). Como o próprio processAll muta o DOM,
//    ele roda quase todo frame enquanto a página muda/scrolla.
//    ⇒ REGRA DE OURO: todo pass PRECISA sair BARATO quando não há nada novo.
//      Padrão: seletor com `:not([data-marcador])` + SETAR o marcador ANTES de
//      qualquer return. Esquecer = re-escaneia o documento inteiro todo frame = trava.
//
//  PIPELINE DE VÍDEO (redgifs · turbo · saint) — espalhado por 3 trechos físicos:
//    1) acha o embed: link <a> (processTurboLinks/processSaintLinks), iframe nativo
//       (processTurboNativeEmbeds, Simp) ou loader do fórum (applyRedgifsPlayer).
//    2) resolve o mp4: redgifs = API (rgVideo); turbo = /api/sign (turboApi).
//    3) monta NOSSO <video> + controles próprios (rgBuild/buildNativeVideo → rgControls).
//    4) lazy: rgLoadIO carrega perto da viewport (fila rgPump, máx 3 juntos);
//       rgPlayIO toca mudo ao ficar ≥40% visível e pausa ao sair.
//    5) carga: streaming DIRETO (no-referrer) → se der erro, BLOB (Referer forjado).
//    6) à prova de falha: qualquer erro → rgRestore() recoloca o iframe nativo.
//
//  MASONRY do post: collectGalleryBlocks() junta imgs+embeds; buildPostGallery()
//    distribui em N colunas por JS (coluna mais curta = Pinterest, sem recarregar o
//    que já está posto). O visualizador cheio (tiktok/zoom/slides) = openMediaFeed().
//
//  GOTCHAS que já queimaram (memória do projeto · [[script-passes-traps]]):
//    • CSS vive num template `…` (backtick) em injectStyles → NUNCA backtick dentro
//      de comentário/conteúdo da CSS. Validar: node --check + contador de chaves {}.
//    • esconder via JS algo com `!important` na CSS → setProperty('…','…','important').
//    • iframe com display:none CONTINUA tocando áudio → REMOVER, não esconder.
//    • marcar o nó ANTES do early-return (ver REGRA DE OURO acima).
//
// ── ONDE ESTÁ CADA COISA (ordem de arquivo) ─────────────────────────────────
//  CONFIG ............ DEFAULT_FEATURES, FEATURES, gmGet/gmSet, saveFeatures, SETTINGS_META
//  i18n .............. IS_PT, I18N_PT, i18n(), i18nDom(), navHref()
//  ÍCONES ............ ICONS{}, SMG_LOGO_HTML, SMG_PH_MARK/SC_PH_MARK, SMG_FAVICON
//  CSS ............... injectStyles()  ← ~2640 linhas; tem sub-índice próprio no topo dela
//  HELP texto/url .... getBigUrl, cleanText, smgIsWatching, waitForElement
//  HELP UI ........... makeDockButton/makeDockLink, setBtnIcon/Label, makeDivider/Group, readPageJump
//  POST filtro ....... applyAuthorFilter
//  POST teclado ...... setupKeyboardShortcuts
//  POST scroll-inf ... setupInfiniteScroll
//  IMG + MASONRY ..... getThumbIO/getFullIO, processImages, collectGalleryBlocks,
//                      blockRelH, buildPostGallery, buildPostGalleries
//  TURBO embeds ...... getTurboIO, processTurboLinks, buildEmbedWrapper, buildTurboIframe/Error, turboCheck
//  REDGIFS + PLAYER .. GMX, rgIdFrom, rgToken, rgVideo, rgBlob, getRgLoadIO/getRgPlayIO,
//                      rgPump(fila), rgPlayIfVisible, rgLoad, rgViaDirect/rgViaBlob, rgRestore,
//                      rgBuild, rgControls, rgStart, buildNativeVideo, rgLoadUrl/rgStartUrl,
//                      turboResolve/turboApi/turboUrlFromJson, processTurboNativeEmbeds (Simp),
//                      rgHidePlaceholder, applyRedgifsPlayer
//  autoload/spoiler .. autoLoadRedgifs, autoExpandSpoilers
//  DOCK (nav post) ... setupPostNavigation()  ← GRANDE: pager, goto, filtro de lista, view-toggle,
//                      download, sheet mobile, e a BUSCA (history/chips/doSearch)
//  busca títulos ..... enableSearchTitlesOnly
//  FEED + LIGHTBOX ... setupImageClickFeed, collectMediaFrom, gal* (galeria paginada),
//                      openMediaFeed()  ← visualizador cheio (slides/zoom/mute)
//  LISTAGEM .......... markThreadGridContainer, badges reativos, styleArticleCards, markGridPlaceholders
//  HOME (forum_list) . mergeSmallHomeSections, relocateSimpcityNodes/relocateSmgNodes, expandSubForums,
//                      splitTransSection, sort/reorderHomeSections, makeHomeCardsClickable,
//                      buildHomeFeed, layoutHomeSidebar
//  THREAD filter bar . smgBarBtn/Pop/Jump/Pager/Sort/Primary/More, buildFilterBars, fetchXfList
//  ALERTAS ........... markAlertRead, cleanAlertRow, groupAlerts, cleanAlertList
//  TOPBAR ............ buildTopbar()  ← GRANDE: logo, nav, popovers, sheets mobile
//  HOVER preview ..... dcThumbUrl, setupThumbPreview
//  — daqui pra baixo: features definidas tarde no arquivo + o INIT —
//  favicon (SMG) ..... setFavicon
//  REDIRECT unwrap ... b64decode, decodeProxyHref, bindProxyClick, unwrapRedirectLinks, handleRedirectPage
//  REVEAL liked(SMG) . revealLikedPosts, revealPost, markRevealing
//  SAINT embeds ...... processSaintLinks  (reusa buildEmbedWrapper + buildTurboIframe do turbo)
//  DOWNLOAD .......... smgDownload, collectPostMedia, downloadAllMedia, dockBadge
//  DIRECT media ...... processDirectMedia  (.mp4/img direto → <video>/<img>)
//  GROUP links ....... linkLabel, groupPostLinks  (file-hosts → chips)
//  INIT .............. safe(), processAll(), scheduleRun(), detectPageClasses(), boot()
// ============================================================================

(function () {
    'use strict';
