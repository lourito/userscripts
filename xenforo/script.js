// ==UserScript==
// @name         SimpCity & SocialMediaGirls — Full Redesign
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

    // =========================================================
    // CONFIG
    // =========================================================

    const DEFAULT_FEATURES = {
        autoFullImages: true,       // "Grade de imagens nos posts": qualidade média + grade masonry por post (off = thumbs nativas)
        turboEmbeds: true,          // converte links turbo.cr em iframe (com pré-check de 404)
        turboNativePlayer: true,    // tenta extrair o mp4 do turbo e montar nosso <video> (controles próprios); fallback pro iframe
        autoLoadRedgifs: true,      // auto-click nos placeholders de redgifs
        redgifsPlayer: true,        // troca o iframe do redgifs por <video> nativo (mp4 da API); à prova de falha (restaura o iframe)
        autoExpandSpoilers: true,   // abre os spoilers automaticamente
        sidebarNavigation: true,    // dock de navegação (desligar esconde a barra inteira)
        topBar: true,               // topbar reformulada (ícones + popovers agrupados; esconde a nav nativa)
        autoSearchTitleOnly: true,  // marca "Search titles only" no quick search
        imageLightbox: true,        // clique na imagem abre o modo feed
        mediaFeed: true,            // botão "modo feed" (tiktok) com a mídia da thread
        keyboardShortcuts: true,    // atalhos de teclado (j/k/[/]/g/v/f//)
        infiniteScroll: true,       // carrega as próximas páginas da thread ao rolar
        thumbPlaceholders: true,    // marca no lugar de thumb ausente/quebrada (grid/lista)
        hoverPreview: true,         // preview maior da thumb ao passar o mouse (desktop)
        homeRemake: true,           // reformula a home (cards/atalhos/sidebar pro topo) — off = home original
        customFavicon: true,        // troca a favicon pela marca SMG (SMG only)
        headerNotices: true,        // recolhe os avisos (.notices--block) num iconezinho dentro da página
        lazyEmbeds: true,           // só monta o embed do turbo perto da viewport
        unwrapLinks: true,          // pula o aviso de link externo (goto/redirect → URL real)
        revealLikedPosts: true,     // SMG: recarrega o post escondido após reagir (like/medalha)
        saintEmbeds: true,          // converte links saint.su/saint2.su em player (igual turbo)
        imagepondEmbeds: true,      // SMG: troca o iframe do imagepond.net/videos pelo nosso player (scrape do mp4)
        directMedia: true,          // embeda mídia DIRETA (susercontent/Shopee, .mp4/.webm/.webp em link cru)
        fileHostCards: true,        // links de file-host (pixeldrain/bunkr/gofile/mega/cyberdrop/…) → card estilizado (thumb/logo + host + tipo)
        groupLinks: true,           // agrupa os links de file-host (GoFile/Bunkr/…) numa barra de chips no post
        mediaDownload: true,        // botão "baixar toda a mídia do post" na action bar
        bookmarksFeed: true,        // /account/bookmarks: substitui a lista nativa por um feed com os posts salvos (igual o feed da home)
    };

    // persistência (engrenagem na dock) — GM_*Value com fallback p/ localStorage
    const FEATURES_KEY = 'smg-features';
    const gmGet = (k, d) => { try { return typeof GM_getValue === 'function' ? GM_getValue(k, d) : (localStorage.getItem(k) ?? d); } catch { return d; } };
    const gmSet = (k, v) => { try { if (typeof GM_setValue === 'function') GM_setValue(k, v); else localStorage.setItem(k, v); } catch {} };
    // kill-switch global: se o site quebrar com o mod, rode gmSet('smg-off','1') (ou localStorage) e recarregue.
    const smgDisabled = gmGet('smg-off', '0') === '1';

    const FEATURES = (() => {
        let stored = {};
        try { stored = JSON.parse(gmGet(FEATURES_KEY, '{}')) || {}; } catch {}
        return { ...DEFAULT_FEATURES, ...stored };
    })();

    function saveFeatures() { gmSet(FEATURES_KEY, JSON.stringify(FEATURES)); }

    // sempre ligadas: não aparecem no painel e ignoram qualquer valor salvo antigo
    ['imageLightbox', 'mediaFeed', 'lazyEmbeds'].forEach(k => { FEATURES[k] = true; });

    // toggles do painel de settings — agrupados por categoria, cada um com descrição do impacto.
    // desc é bilíngue inline ({en,pt}); o label é traduzido pelo i18nDom (dicionário).
    const SETTINGS_META = [
        { section: 'Appearance', items: [
            { key: 'topBar', label: 'Redesigned top bar', desc: { en: "Replaces the original header with a lean bar that gathers search, discover, watched, alerts and account into icons.", pt: 'Substitui o cabeçalho original por uma barra enxuta, com busca, descobrir, seguindo, alertas e conta reunidos em ícones.' } },
            { key: 'homeRemake', label: 'Reworked homepage', desc: { en: 'Reorganizes the home into clickable cards, moves the sidebar to the top and merges the smaller sections.', pt: 'Reorganiza a home em cards clicáveis, leva a barra lateral para o topo e agrupa as seções menores.' } },
            { key: 'headerNotices', label: 'Notices tucked into an icon', desc: { en: 'Hides the page notices behind a small in-page icon, freeing up space. Click it to read them.', pt: 'Recolhe os avisos da página atrás de um ícone pequeno, liberando espaço. Clique nele para ler.' } },
            { key: 'customFavicon', label: 'Custom tab icon', desc: { en: "Swaps the icon shown on the browser tab for the site's identity (SocialMediaGirls only).", pt: 'Troca o ícone exibido na aba do navegador pela identidade do site (somente no SocialMediaGirls).' } },
        ] },
        { section: 'Images', items: [
            { key: 'autoFullImages', label: 'Image grid in posts', desc: { en: "Lays each post's images out in a masonry mosaic and loads them at medium quality to save data. Off, it keeps the original thumbnails, with no grid.", pt: 'Dispõe as imagens de cada post num mosaico (masonry) e as carrega em qualidade média, para poupar dados. Desligado, mantém as miniaturas originais, sem grade.' } },
            { key: 'hoverPreview', label: 'Enlarged preview on hover', desc: { en: 'Shows a larger version of the thumbnail when the cursor rests over it (desktop only).', pt: 'Mostra uma versão maior da miniatura quando o cursor para sobre ela (apenas no desktop).' } },
            { key: 'thumbPlaceholders', label: 'Placeholder for missing thumbnails', desc: { en: 'Puts a branded badge in place of thumbnails that are missing or failed to load.', pt: 'Coloca um selo com a identidade do site no lugar de miniaturas que faltam ou falharam ao carregar.' } },
        ] },
        { section: 'Videos', items: [
            { key: 'autoLoadRedgifs', label: 'RedGifs — load automatically', desc: { en: 'Opens RedGifs players on their own, without requiring a click on the load prompt.', pt: 'Abre os players do RedGifs sozinho, sem exigir o clique no aviso de carregamento.' } },
            { key: 'redgifsPlayer', label: 'RedGifs — built-in player', desc: { en: "Replaces the default RedGifs player with a native one — true aspect ratio, mute and scrubbing. Falls back to the original if the API doesn't respond.", pt: 'Troca o player padrão do RedGifs por um nativo, com proporção real, mudo e controle de tempo. Retorna ao original caso a API não responda.' } },
            { key: 'turboEmbeds', label: 'Turbo.cr — show videos', desc: { en: 'Turns turbo.cr links into an embedded video player, with a prior dead-link check.', pt: 'Converte os links do turbo.cr num player embutido, com verificação prévia de link quebrado.' } },
            { key: 'turboNativePlayer', label: 'Turbo.cr — built-in player', desc: { en: "Extracts the turbo.cr video and plays it in the native player, with its own controls, instead of the embed. Falls back to the original when it can't.", pt: 'Extrai o vídeo do turbo.cr e o reproduz no player nativo, com controles próprios, no lugar do embutido. Recorre ao original quando não consegue.' } },
            { key: 'saintEmbeds', label: 'Saint.su — show videos', desc: { en: 'Turns saint.su / saint2.su links into an embedded video player.', pt: 'Converte os links do saint.su / saint2.su num player de vídeo embutido.' } },
            { key: 'imagepondEmbeds', label: 'ImagePond — built-in player', desc: { en: 'Replaces the imagepond.net video iframe with the native player (own controls + download). Falls back to the original when it can\'t.', pt: 'Troca o iframe de vídeo do imagepond.net pelo player nativo (controles próprios + download). Recorre ao original quando não consegue.' } },
        ] },
        { section: 'Links & files', items: [
            { key: 'directMedia', label: 'Direct media from CDNs', desc: { en: 'Embeds standalone files (.mp4/.webm and images from CDNs like Shopee) in place of the raw link.', pt: 'Incorpora arquivos avulsos (.mp4/.webm e imagens de CDNs como o Shopee) no lugar do link cru.' } },
            { key: 'fileHostCards', label: 'File-host link cards', desc: { en: 'Turns file-host links (Pixeldrain, Bunkr, GoFile, MEGA, Cyberdrop…) into a clear card: thumbnail or host logo on the left, plus type and item count for galleries.', pt: 'Transforma links de hospedagem (Pixeldrain, Bunkr, GoFile, MEGA, Cyberdrop…) num card claro: miniatura ou logo do host à esquerda, com o tipo e a contagem de itens nas galerias.' } },
            { key: 'unwrapLinks', label: 'Skip external link warning', desc: { en: 'Skips the warning page when leaving the forum (goto/redirect); the click goes straight to the destination.', pt: 'Ignora a página de alerta ao sair do fórum (goto/redirect); o clique segue direto ao destino.' } },
            { key: 'groupLinks', label: 'Gather download links', desc: { en: 'Gathers file-host links (GoFile, Bunkr, Pixeldrain…) into a shortcut bar at the end of the post, without touching the text.', pt: 'Agrupa os links de hospedagem (GoFile, Bunkr, Pixeldrain…) numa barra de atalhos ao fim do post, sem mexer no texto.' } },
        ] },
        { section: 'Thread & reading', items: [
            { key: 'infiniteScroll', label: 'Infinite scroll in thread', desc: { en: 'Loads the next page automatically when you reach the bottom; the more you scroll, the more requests.', pt: 'Carrega a próxima página automaticamente ao chegar ao fim; quanto mais você rola, mais requisições.' } },
            { key: 'mediaDownload', label: 'Download all media on the page', desc: { en: 'Adds a button (in the thread header) that downloads every image and video on the current page at once.', pt: 'Adiciona um botão (no header da thread) que baixa de uma vez todas as imagens e vídeos da página atual.' } },
            { key: 'revealLikedPosts', label: 'Reveal locked posts on reacting', desc: { en: 'On SMG, reloads a like/medal-locked post on its own as soon as you react — no manual refresh.', pt: 'No SMG, recarrega sozinho o post liberado por curtida/medalha assim que você reage, sem atualizar na mão.' } },
            { key: 'autoExpandSpoilers', label: 'Open spoilers automatically', desc: { en: 'Expands spoilers without requiring a click.', pt: 'Expande os spoilers sem exigir clique.' } },
            { key: 'keyboardShortcuts', label: 'Keyboard shortcuts', desc: { en: 'j / k posts · [ ] pages · g go to page · v grid/list · f feed mode · / search.', pt: 'j / k posts · [ ] páginas · g ir para página · v grade/lista · f modo feed · / buscar.' } },
            { key: 'bookmarksFeed', label: 'Bookmarks as a feed', desc: { en: 'Replaces the bookmarks page with a feed of your saved posts (media inline), just like the home feed.', pt: 'Substitui a página de salvos por um feed dos seus posts salvos (mídia inline), igual ao feed da home.' } },
        ] },
    ];

    // =========================================================
    // i18n: traduz a UI QUE A GENTE INJETA conforme o idioma do site (<html lang>).
    // Default = inglês (as próprias chaves). PT-BR quando o XF está em pt-*.
    // i18n(str)      → traduz uma string (usada nos helpers de botão + textos dinâmicos)
    // i18nDom(root)  → varre os text nodes + placeholder/title/aria-label/data-label de um
    //                  widget NOSSO e troca pelo PT. Só casa chaves exatas em inglês, então
    //                  conteúdo nativo do site (já em PT) e nomes próprios passam intactos.
    // =========================================================
    const IS_PT = /^pt/i.test((document.documentElement.getAttribute('lang') || navigator.language || '').trim());
    const I18N_PT = {
        // settings — seções (painel + sheet mobile do dock)
        'Media': 'Mídia', 'Images': 'Imagens', 'General': 'Geral', 'Post': 'Post', 'Navigation': 'Navegação', 'Page': 'Página',
        'Appearance': 'Aparência', 'Videos': 'Vídeos', 'Links & files': 'Links e arquivos', 'Thread & reading': 'Thread e leitura',
        // settings — labels dos toggles (a descrição é inline no SETTINGS_META)
        'Redesigned top bar': 'Barra superior redesenhada', 'Reworked homepage': 'Página inicial reformulada',
        'Notices tucked into an icon': 'Avisos recolhidos num ícone', 'Custom tab icon': 'Ícone da aba personalizado',
        'Image grid in posts': 'Grade de imagens nos posts',
        'Enlarged preview on hover': 'Prévia ampliada ao passar o mouse', 'Placeholder for missing thumbnails': 'Marcador para miniatura ausente',
        'RedGifs — load automatically': 'RedGifs — carregar automaticamente', 'RedGifs — built-in player': 'RedGifs — player próprio',
        'Turbo.cr — show videos': 'Turbo.cr — exibir vídeos', 'Turbo.cr — built-in player': 'Turbo.cr — player próprio',
        'Saint.su — show videos': 'Saint.su — exibir vídeos', 'Direct media from CDNs': 'Mídia direta de CDNs',
        'Skip external link warning': 'Pular aviso de link externo', 'Gather download links': 'Reunir links de download',
        'Infinite scroll in thread': 'Rolagem infinita no tópico', 'Download all media on the page': 'Baixar toda a mídia da página',
        'Reveal locked posts on reacting': 'Revelar posts bloqueados ao reagir', 'Open spoilers automatically': 'Abrir spoilers automaticamente',
        'Keyboard shortcuts': 'Atalhos de teclado', 'Gallery': 'Galeria', 'Expand': 'Maximizar',
        // download + saint
        'Download': 'Baixar', 'Download media': 'Baixar mídia', 'Open on saint': 'Abrir no saint', 'Open on turbo.cr': 'Abrir no turbo.cr',
        // download modal
        'Scanning thread…': 'Varrendo a thread…', 'images': 'imagens', 'videos': 'vídeos', 'external links': 'links externos',
        'item': 'item', 'items': 'itens', 'Show gallery': 'Ver galeria', 'Open gallery': 'Abrir galeria', 'File': 'Arquivo', 'Image': 'Imagem', 'Copy link': 'Copiar link', 'Open': 'Abrir',
        'Nothing to download': 'Nada pra baixar', 'Scan failed': 'Falha ao varrer', 'Download ZIP': 'Baixar ZIP', 'Download files': 'Baixar arquivos',
        'Downloading…': 'Baixando…', 'Resolving…': 'Resolvendo…', 'Resolving videos…': 'Resolvendo vídeos…', 'Fetching…': 'Buscando…', 'Zipping…': 'Zipando…', 'Done': 'Pronto',
        'Download failed': 'Falha no download', 'files': 'arquivos', 'Many files — ZIP may be heavy; "Download files" is lighter.': 'Muitos arquivos — o ZIP pode pesar; "Baixar arquivos" é mais leve.',
        'Copied!': 'Copiado!', 'Filtering': 'Filtrando', 'Decrease': 'Diminuir', 'Increase': 'Aumentar', 'Go': 'Ir', 'Remove': 'Remover',
        'author': 'autor', 'titles only': 'só títulos', 'Nothing here yet.': 'Nada aqui ainda.', 'Couldn’t load.': 'Não foi possível carregar.',
        // dock — thread
        'Search': 'Buscar', 'Copy post': 'Copiar post', 'Save post': 'Salvar post',
        // post card (reddit) — action bar
        'Share': 'Compartilhar', 'Save': 'Salvar', 'Reply': 'Responder', 'Comment': 'Comentar', 'Comments': 'Comentários',
        'Watch thread': 'Seguir tópico', 'Unwatch thread': 'Deixar de seguir',
        'Sort by date': 'Ordenar por data', 'Sort by reactions': 'Ordenar por reações',
        'Date': 'Data', 'Reactions': 'Reações',   // labels curtos do botão de sort (pílula)
        'Prev page': 'Página anterior', 'Next page': 'Próxima página', 'Go to page': 'Ir para página',
        'Prev post': 'Post anterior', 'Next post': 'Próximo post',
        'Filter': 'Filtrar', 'Filter by author': 'Filtrar por autor',
        'List view': 'Ver em lista', 'Grid view': 'Ver em grade',
        // dock — navegação + geral
        'Home': 'Início', 'Alerts': 'Alertas', 'Watched': 'Seguindo', 'Discover': 'Descobrir', 'Explore': 'Explorar',
        'Account': 'Conta', 'Feed mode': 'Modo feed', 'Settings': 'Configurações', 'Options': 'Opções',
        'Hide dock': 'Esconder dock', 'Show dock': 'Mostrar dock', 'Reload to apply': 'Recarregar para aplicar',
        'Search setting…': 'Buscar ajuste…', 'No settings found': 'Nenhum ajuste encontrado', 'Restore defaults': 'Restaurar padrões', 'Reload': 'Recarregar', 'Restore default settings?': 'Restaurar as configurações padrão?',
        'Search window (days)': 'Janela de busca (dias)', 'Keep posts for (days)': 'Guardar posts por (dias)', 'Threads on first load': 'Threads no 1º carregamento', 'Deep re-scan every (h)': 'Re-varredura completa a cada (h)',
        // busca
        'Search the forum…': 'Buscar no fórum…', 'Search in': 'Buscar em', 'Everywhere': 'Em tudo',
        'Search the forum': 'Buscar no fórum', 'Type at least 3 characters to see results': 'Digite ao menos 3 caracteres para ver resultados',
        // feed (river de posts na /watched/threads)
        'Feed': 'Feed', 'List': 'Lista', 'Open in thread': 'Abrir no tópico', 'Load more': 'Carregar mais', 'post by': 'postado por',
        'No watched threads yet': 'Você ainda não segue nenhum tópico', 'No recent posts': 'Nenhum post recente',
        'Setting up your feed': 'Configurando seu feed', 'Reading the threads you follow…': 'Lendo as threads que você segue…',
        'threads': 'tópicos', 'posts': 'posts', 'Gathering posts…': 'Reunindo posts…', 'Remove from saved': 'Remover dos salvos',
        'new post': 'post novo', 'new posts': 'novos posts', 'Home': 'Início', 'Download': 'Baixar',
        'Threads': 'Tópicos', 'This forum': 'Este fórum', 'This thread': 'Este tópico',
        'Filters': 'Filtros', 'Titles only': 'Só títulos', 'Author (optional)': 'Autor (opcional)',
        'Recent searches': 'Buscas recentes', 'Show all': 'Ver todas', 'Show less': 'Ver menos',
        'Clear': 'Limpar', 'Advanced': 'Avançado', 'Enter to search': 'Enter para buscar',
        'Close': 'Fechar', 'Press Esc to close': 'Pressione Esc para fechar',
        'Search thread titles only (ignores post text)': 'Busca só nos títulos dos tópicos (ignora o texto dos posts)',
        'Clear all recent searches?': 'Limpar todas as buscas recentes?',
        // filtro por autor + filtro da listagem
        'Filter posts by author': 'Filtrar posts por autor', 'Username…': 'Usuário…', 'Username': 'Usuário',
        'Started by': 'Iniciado por', 'Last updated': 'Última atualização', 'Sort by': 'Ordenar por',
        'Error building the filter.': 'Erro ao montar o filtro.', 'Filter unavailable.': 'Filtro indisponível.',
        'Error loading the filter.': 'Erro ao carregar o filtro.',
        // estados
        'Loading…': 'Carregando…', 'Error loading.': 'Erro ao carregar.',
        // topbar — Discover
        'Trending': 'Em alta', 'Most popular right now': 'Mais populares agora',
        "What's new": 'Novidades', 'Recently posted': 'Postado recentemente',
        'New posts': 'Novos posts', 'Latest messages': 'Últimas mensagens',
        'Featured': 'Destaques', 'Featured content': 'Conteúdo em destaque',
        'Activity': 'Atividade', 'Activity feed': 'Feed de atividades',
        'Find threads': 'Buscar tópicos', 'Browse threads': 'Navegar pelos tópicos',
        'Unanswered': 'Sem resposta', 'Awaiting a reply': 'Aguardando resposta',
        'Members': 'Membros', 'Member list': 'Lista de membros',
        'Online now': 'Online agora', "Who's online": 'Quem está online',
        // topbar — conta
        'Profile': 'Perfil', 'Your account': 'Sua conta', 'Post thread': 'Criar tópico',
        'Messages': 'Mensagens', 'Your threads': 'Seus tópicos', 'Contributed': 'Participações',
        'Your tickets': 'Seus tickets', 'Bookmarks': 'Salvos', 'Watched forums': 'Fóruns seguidos',
        'Preferences': 'Preferências', 'History': 'Histórico', 'Log out': 'Sair',
        // topbar — misc
        'See all': 'Ver tudo', 'Mark read': 'Marcar como lido', 'Notices': 'Avisos',
        // home feed
        'Latest posts': 'Últimos posts', 'Following': 'Seguindo', 'Categories': 'Categorias',
        // barras (smgBarBtn)
        'Previous': 'Anterior', 'Next': 'Próximo', 'Go to new': 'Ir para os novos',
        'Watch': 'Seguir', 'Unwatch': 'Deixar de seguir', 'Translate': 'Traduzir', 'More': 'Mais',
        'Reactions': 'Reações', 'Date': 'Data', 'Order by': 'Ordenar por', 'click to toggle': 'clique para alternar',
        'Relevance': 'Relevância', 'by date': 'por data',
        // feed de mídia
        'No media on this page': 'Sem mídia nesta página', 'Filter media': 'Filtrar mídia',
        'Thumbnails': 'Miniaturas', 'Sound': 'Som', 'Download': 'Baixar', 'Mute': 'Mudo', 'Unmute': 'Ativar som',
        'Play/Pause': 'Tocar/Pausar', 'Fullscreen': 'Tela cheia', 'Volume': 'Volume', 'Back 5s': 'Voltar 5s', 'Forward 5s': 'Avançar 5s',
        'Open in new tab': 'Abrir em nova guia', 'Open in viewer': 'Abrir no visualizador', 'RedGifs unavailable': 'RedGifs indisponível',
        'Edit in search bar': 'Editar na barra de busca', 'Search on': 'Buscar no',
        'No results': 'Sem resultados', 'See all results': 'Ver todos os resultados', 'Search failed': 'Busca falhou',
        'Clear': 'Limpar', 'Search commands': 'Comandos de busca', 'search post text': 'buscar no texto do post', 'Thread': 'Tópico', 'Forum': 'Fórum', 'Search in this thread': 'Buscar neste tópico',
        'Search defaults': 'Padrões da busca', 'Titles only by default': 'Só títulos por padrão', 'Newest first by default': 'Mais recentes primeiro', 'Match partial words': 'Buscar por parte da palavra', 'Commands (Tab)': 'Comandos (Tab)',
        'Search by name…': 'Buscar por nome…', 'Search by username…': 'Buscar por @usuário…', 'Search by thread…': 'Buscar por tópico…',
        // aviso único da galeria/feed (navegação própria)
        'Gallery and Feed': 'Galeria e Feed', 'Got it': 'Entendi',
        'Gallery and Feed browse the whole thread with their own pagination — they start at page 1 and page through all the media, independently of where you are reading. Use their own pager and sort.':
            'A Galeria e o Feed percorrem a thread inteira com paginação própria — começam na página 1 e passam por toda a mídia, independente de onde você está lendo. Use o paginador e a ordenação próprios deles.',
        'Filter: all': 'Filtro: tudo', 'Filter: images': 'Filtro: imagens', 'Filter: videos': 'Filtro: vídeos',
        // turbo + misc
        '⚠ turbo.cr unavailable (404) — use the link below': '⚠ turbo.cr indisponível (404) — use o link abaixo',
    };
    function i18n(s) {
        if (!IS_PT || s == null) return s;
        return Object.prototype.hasOwnProperty.call(I18N_PT, s) ? I18N_PT[s] : s;
    }
    function i18nDom(root) {
        if (!IS_PT || !root) return;
        const ATTRS = ['placeholder', 'title', 'aria-label', 'data-label'];
        root.querySelectorAll('[placeholder],[title],[aria-label],[data-label]').forEach(el => {
            ATTRS.forEach(a => {
                const v = el.getAttribute(a);
                if (v == null) return;
                const core = v.trim();
                const t = i18n(core);
                if (t !== core) el.setAttribute(a, v.replace(core, t));
            });
        });
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const nodes = [];
        while (w.nextNode()) nodes.push(w.currentNode);
        nodes.forEach(n => {
            const raw = n.nodeValue;
            if (!raw) return;
            const core = raw.trim();
            if (!core) return;
            const t = i18n(core);
            if (t === core) return;
            const lead = (raw.match(/^\s*/) || [''])[0], tail = (raw.match(/\s*$/) || [''])[0];
            n.nodeValue = lead + t + tail;
        });
    }

    // lê o href REAL de um item da nav nativa (data-nav-id) → funciona no simpcity e no smg.
    // usado pela topbar e pelo feed da home (1ª id válida ganha; ignora '#'/javascript:).
    function navHref(...ids) {
        for (const id of ids) {
            const a = document.querySelector('a[data-nav-id="' + id + '"]');
            const h = a && a.getAttribute('href');
            if (h && h !== '#' && !/^javascript/i.test(h)) return h;
        }
        return null;
    }

    // ícones SVG monocromáticos (Lucide-style, traço bold), herdam currentColor.
    // tamanho via font-size do botão (width/height em em).
    // =========================================================
    // ÍCONES: svgIcon() (wrapper SVG) + ICONS{} (todos os ícones inline)
    // =========================================================
    const svgIcon = inner =>
        `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block">${inner}</svg>`;

    const ICONS = {
        share: svgIcon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>'),   /* glifo de share (nós, estilo fa-share-alt) — usado em copiar/compartilhar (post, link, feed) */
        shareDone: svgIcon('<path d="M20 6 9 17l-5-5"/>'),
        search: svgIcon('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
        home: svgIcon('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
        alerts: svgIcon('<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/><circle cx="19" cy="5" r="2.7" fill="currentColor" stroke="none"/>'),
        watched: svgIcon('<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/><path d="m9 10 2 2 4-4"/>'),   /* bookmark-check = "threads que sigo" (o olho parecia show/hide) */
        feed: svgIcon('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 8 6 4-6 4Z"/>'),
        save: svgIcon('<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="9" y1="10" x2="15" y2="10"/>'),
        bookmarkRemove: svgIcon('<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/><line x1="9" y1="10" x2="15" y2="10"/>'),   /* bookmark com "−" = remover dos salvos */
        rss: svgIcon('<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.4" fill="currentColor" stroke="none"/>'),   /* RSS = inscrito nas atualizações (Seguindo / threads acompanhadas) */
        comment: svgIcon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
        masonry: svgIcon('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
        link: svgIcon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
        close: svgIcon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),   // X — reusar SEMPRE (estava inline em ~6 lugares)
        arrowRight: svgIcon('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
        newPost: svgIcon('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>'),
        bookmarks: svgIcon('<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>'),
        watch: svgIcon('<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>'),
        unwatch: svgIcon('<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742"/><path d="m2 2 20 20"/><path d="M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05"/>'),
        sortDate: svgIcon('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'),
        pagePrev: svgIcon('<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>'),
        pageNext: svgIcon('<path d="m13 17 5-5-5-5"/><path d="m6 17 5-5-5-5"/>'),
        goto: svgIcon('<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>'),
        postUp: svgIcon('<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>'),
        postDown: svgIcon('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'),
        scrollTop: svgIcon('<path d="M5 4h14"/><path d="M12 20V9"/><path d="m6 15 6-6 6 6"/>'),     // seta pro topo (barra + ↑)
        scrollBottom: svgIcon('<path d="M5 20h14"/><path d="M12 4v11"/><path d="m6 9 6 6 6-6"/>'),    // seta pro fundo (barra + ↓)
        hide: svgIcon('<path d="m6 9 6 6 6-6"/>'),
        show: svgIcon('<path d="m18 15-6-6-6 6"/>'),
        settings: svgIcon('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
        filter: svgIcon('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'),
        download: svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
        volume: svgIcon('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'),
        volumeMute: svgIcon('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'),
        rgPlay: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="display:block"><path d="M7 4.5v15a1 1 0 0 0 1.52.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
        rgPause: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="display:block"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
        rgExpand: svgIcon('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),   /* tela cheia (cantos) */
        rgMaximize: svgIcon('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3 14 10"/><path d="M3 21 10 14"/>'),   /* abrir no visualizador/overlay (setas diagonais) */
        /* setas CURVAS (undo/redo) = voltar/avançar — claramente setas, sem virar bola nem dar sensação de próximo/anterior */
        rgBack: svgIcon('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-2"/>'),
        rgFwd: svgIcon('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h2"/>'),
        rgExternal: svgIcon('<path d="M7 17 17 7"/><path d="M8 7h9v9"/>'),   /* seta ↗ limpa ("abrir externo") — o external-link caixa+seta ficava poluído no rail */
        gallery: svgIcon('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
        typeImage: svgIcon('<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
        typeVideo: svgIcon('<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/>'),
        user: svgIcon('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
        layers: svgIcon('<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.57 3.9a2 2 0 0 0 1.66 0l8.57-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 12.81-9.17 4.16a2 2 0 0 1-1.66 0L2 12.81"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>'),
        playCircle: svgIcon('<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>'),
        feedPlay: svgIcon('<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none"/>'),   // play PREENCHIDO (contraste) dentro do círculo
        thumbs: svgIcon('<rect x="3" y="8" width="4.5" height="8" rx="1"/><rect x="9.75" y="8" width="4.5" height="8" rx="1"/><rect x="16.5" y="8" width="4.5" height="8" rx="1"/>'),
        sliders: svgIcon('<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>'),
        list: svgIcon('<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>'),
        compass: svgIcon('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>'),
        flame: svgIcon('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
        users: svgIcon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
        mail: svgIcon('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
        plus: svgIcon('<path d="M5 12h14"/><path d="M12 5v14"/>'),
        star: svgIcon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
        sparkles: svgIcon('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/>'),
        activity: svgIcon('<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>'),
        chat: svgIcon('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
        help: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
        megaphone: svgIcon('<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>'),
    };

    // logo do SMG: wordmark "SMG" (G rosa = acento da marca)
    const SMG_LOGO_HTML = '<span class="smg-logo"><span class="smg-logo-word">SM<span class="smg-logo-accent">G</span></span></span>';
    // marca usada no placeholder de cards sem thumb — mesma cara do logo (SM + G rosa), só que apagada
    const SMG_PH_MARK = '<span class="smg-ph-word">SM<span class="smg-ph-g">G</span></span>';
    // favicon SVG (data-URI, nada hospedado): quadrado arredondado rosa + "S" branca (legível a 16px)
    const SMG_FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff62a8"/><stop offset="1" stop-color="#ff2e74"/></linearGradient></defs>' +
        '<rect width="64" height="64" rx="15" fill="url(#g)"/>' +
        '<text x="32" y="45" font-family="Arial,Helvetica,sans-serif" font-size="40" font-weight="800" fill="#fff" text-anchor="middle">S</text>' +
        '</svg>');
    // SimpCity (e fallback): marca "SC" (mesmo estilo do "SMG", só que sem o acento rosa)
    const SC_PH_MARK = '<span class="smg-ph-word">SC</span>';

    // =========================================================
    // STYLES
    // =========================================================

    function injectStyles() {
        const CSS_BASE = `
            /* ===== ÍNDICE DO CSS (grep os rótulos abaixo) =====
               paleta (--smg-*) · image grids · images · turbo embeds · redgifs
               · site a 80% (largura) · header das páginas
               · SMG: remove sidebar+breadcrumb fora da home (conteúdo a 100%)
               · HOME (forum_list) reformulada · TOPBAR REFORMULADA
               · dock (container/botões/sheets/goto) · search dialog · modo feed
               · mobile (navbar) · settings/filtros · backdrop dos popovers
               · SMG: BARRA ÚNICA SEGMENTADA (filter bar: pager·ordenar·ações) → buildFilterBars
               · THREAD (header simpcity nativo) · listas (thumb/grid) · hover preview */
            /* ===== paleta do tema: cores CHAPADAS derivadas da cor da topbar de cada site,
               com pequenos degraus de claridade pra dar legibilidade (sem gradiente) ===== */
            html.smg-sc, html.smg-smg {
                --smg-bg: hsl(0 0% 9%);            /* base = cor da topbar (simpcity) */
                --smg-s1: hsl(0 0% 12.5%);         /* superfície: popovers, sheets, dock, cards */
                --smg-s2: hsl(0 0% 16%);           /* hover / inputs / header de card */
                --smg-s3: hsl(0 0% 21%);           /* ativo / selecionado / botão primário / switch on */
                --smg-s3-hover: hsl(0 0% 26%);     /* hover do estado ativo */
                --smg-bd: rgba(255,255,255,0.10);  /* borda padrão */
                --smg-bd2: rgba(255,255,255,0.17); /* borda em destaque/ativo */
                --smg-card: rgba(255,255,255,0.035); /* superfície sutil sobre o bg do site (cards) */
                --smg-card-head: rgba(255,255,255,0.06);
                --smg-scrim: rgba(0,0,0,0.66);      /* backdrop de overlays */
                --smg-media-h: 70vh;                /* altura MÁX de imagem/vídeo/skeleton no post (teto p/ não estourar o viewport, inclusive no masonry) */
            }
            html.smg-smg {
                --smg-bg: #1a1a1a;                  /* cor da topbar do socialmediagirls */
                --smg-s1: hsl(0 0% 13.5%);
                --smg-s2: hsl(0 0% 17%);
                --smg-s3: hsl(0 0% 22%);
                --smg-s3-hover: hsl(0 0% 27%);
            }
            /* ACENTO do tema, POR SITE: VERDE no SimpCity, ROSA no SocialMediaGirls. Usa o linkColor real do
               fórum quando exposto; senão cai no fallback da marca. Todo var(--smg-link, ...) passa a seguir isto. */
            html.smg-sc  { --smg-link: hsl(var(--xf-linkColor--h, 145), var(--xf-linkColor--s, 58%), var(--xf-linkColor--l, 50%)); --smg-link-soft: hsla(var(--xf-linkColor--h, 145), var(--xf-linkColor--s, 58%), var(--xf-linkColor--l, 50%), 0.10); --smg-link-strong: hsl(var(--xf-linkColor--h, 145), var(--xf-linkColor--s, 58%), 38%); }
            /* SMG: saturação CONTROLADA (a do fórum era neon demais) — hue do fórum, s/l fixos mais suaves */
            html.smg-smg { --smg-link: hsl(var(--xf-linkColor--h, 334), 76%, 70%); --smg-link-soft: hsla(var(--xf-linkColor--h, 334), 76%, 70%, 0.10); --smg-link-strong: hsl(var(--xf-linkColor--h, 334), 64%, 48%); }
            /* --smg-link-strong = acento mais FUNDO p/ fundos preenchidos (texto branco lê bem nos 2 sites) */
            /* largura do conteúdo (e da topbar): 80% no desktop, 75% em telas >= 3xl (1920px).
               no mobile NÃO se aplica (a regra que usa isto fica num @media min-width:800px) */
            html.smg-sc, html.smg-smg { --smg-cw: 80%; }
            @media (min-width: 1920px) { html.smg-sc, html.smg-smg { --smg-cw: 75%; } }

            /* ---- image grids ---- */
            .auto-image-grid {
                display: grid !important;
                grid-template-columns: 1fr !important;
                gap: 10px !important;
                margin: 12px 0 !important;
            }
            .auto-image-grid.portrait-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                align-items: start !important;
            }
            /* modo GALERIA por post (html.smg-masonry-on): MASONRY de verdade (Pinterest) — flexbox de N colunas,
               cada item vai pra coluna mais curta (distribuição no JS). column-count multicol renderizava nº errado; grid alinhava por linha. */
            html.smg-masonry-on .auto-image-grid {
                display: grid !important;
                grid-template-columns: repeat(var(--smg-mcols, 3), minmax(0, 1fr)) !important;   /* nº de colunas vem do JS (--smg-mcols): 1 mobile, 1/2 em pares, 3 padrão */
                grid-auto-rows: 8px !important; grid-auto-flow: row dense !important; gap: 8px !important; align-items: start !important;   /* linhas finas + row-span (JS) = masonry; dense preenche os buracos. !important: a CSS do fórum no .auto-image-grid sobrescrevia → virava linhas normais (gaps) */
                column-count: auto !important; column-width: auto !important;   /* limpa multicol legado */
            }
            html.smg-masonry-on .auto-image-grid > * { width: 100% !important; max-width: none !important; margin: 0 !important; align-self: start; display: block; }   /* align-self:start = item fica na altura natural (não estica pro span) */
            html.smg-masonry-on .auto-image-grid img.bbImage { width: 100% !important; height: auto !important; max-height: var(--smg-media-h) !important; object-fit: contain !important; }   /* TETO: não estoura o viewport; contain = imagem alta cabe sem distorcer */
            html.smg-masonry-on .auto-image-grid .generic2wide-iframe-div iframe:not(.saint-iframe),
            html.smg-masonry-on .auto-image-grid > iframe { width: 100% !important; height: auto !important; aspect-ratio: 16 / 9 !important; position: static !important; border: 0 !important; border-radius: 8px !important; }
            html.smg-masonry-on .auto-image-grid .smg-dm-wrap > .smg-dm-video,
            html.smg-masonry-on .auto-image-grid .smg-dm-wrap > img.bbImage { max-height: var(--smg-media-h) !important; width: 100% !important; object-fit: contain !important; }
            html.smg-masonry-on .auto-image-grid .smg-rg { width: 100% !important; max-width: none !important; max-height: var(--smg-media-h) !important; margin: 0 !important; }   /* player: preenche a coluna mas NÃO passa do teto (o .smg-rg-v já é contain) */
            /* GRID de verdade: sem cantos arredondados nos itens (foto/vídeo/iframe/player); os controles do player (.smg-rgc-*) mantêm o raio */
            html.smg-masonry-on .auto-image-grid > *,
            html.smg-masonry-on .auto-image-grid img.bbImage,
            html.smg-masonry-on .auto-image-grid .smg-dm-wrap,
            html.smg-masonry-on .auto-image-grid .smg-dm-wrap > img.bbImage,
            html.smg-masonry-on .auto-image-grid .smg-dm-wrap > .smg-dm-video,
            html.smg-masonry-on .auto-image-grid > iframe,
            html.smg-masonry-on .auto-image-grid .generic2wide-iframe-div iframe,
            html.smg-masonry-on .auto-image-grid .smg-rg,
            html.smg-masonry-on .auto-image-grid .smg-rg-v { border-radius: 0 !important; }
            /* PAR vertical/misto (2 itens, 2 colunas lado a lado): ocupam o máximo de espaço, mas com altura máx de 75vh (pedido). O par horizontal cai em 1 coluna (full width) pela lógica do JS. */
            html.smg-masonry-on .auto-image-grid.smg-grid-pair-port img.bbImage,
            html.smg-masonry-on .auto-image-grid.smg-grid-pair-port .smg-dm-wrap > .smg-dm-video,
            html.smg-masonry-on .auto-image-grid.smg-grid-pair-port .smg-dm-wrap > img.bbImage,
            html.smg-masonry-on .auto-image-grid.smg-grid-pair-port .smg-rg { max-height: 75vh !important; }
            /* GALERIA: overlay (igual o feed) com a mídia da thread numa grade masonry de POUCAS colunas + scroll infinito */
            #smg-gallery { position: fixed; inset: 0; z-index: 2147483600; display: none; flex-direction: column; background: var(--smg-bg); }
            #smg-gallery.open { display: flex; }
            #smg-gallery svg { fill: none !important; }   /* o CSS do fórum preenche svgs — força outline */
            #smg-gallery .smg-rg svg[fill="currentColor"] { fill: currentColor !important; }   /* EXCEÇÃO: ícones PREENCHIDOS do player (play/pause) — senão o fill:none acima apaga o triângulo de play */
            /* stepper "ir pra página" da galeria — MESMO visual do #smg-goto-pop da thread (filhos .smg-goto-* já são classes compartilhadas) */
            .smg-gallery-goto-pop {
                position: absolute; bottom: calc(100% + 12px); left: 50%; transform: translateX(-50%) translateY(6px);
                display: flex; flex-direction: column; align-items: center; gap: 11px;
                min-width: 232px; padding: 16px 18px; border-radius: 18px;
                background: var(--smg-s1); border: 1px solid rgba(255,255,255,0.1);
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 44px rgba(0,0,0,0.62);
                -webkit-backdrop-filter: blur(20px) saturate(170%); backdrop-filter: blur(20px) saturate(170%);
                visibility: hidden; opacity: 0; pointer-events: none;
                transition: opacity .18s ease, transform .18s ease, visibility .18s; z-index: 11;
            }
            .smg-gallery-dock.goto-open .smg-gallery-goto-pop { visibility: visible; opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
            /* DOCK da galeria: IDÊNTICA à dock da thread — mesma pílula do #smg-post-nav-panel + botões .smg-nav-btn (makeDockButton) */
            .smg-gallery-dock { position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 6; }
            .smg-gallery-dock-panel {
                position: relative; z-index: 12;   /* (= #smg-post-nav-panel) acima do goto-pop (z 11) p/ os tooltips do hover aparecerem */
                display: flex; flex-direction: row; align-items: center; gap: 6px; padding: 8px;
                border-radius: 999px; background: rgba(26,26,26,0.95); border: 1px solid rgba(255,255,255,0.09);   /* PERF: sem backdrop-filter (dock flutua sobre o scroller mais pesado do script) */
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 34px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.35);
            }
            /* botão fechar = .smg-nav-btn com label VISÍVEL (vira pílula, não círculo) */
            .smg-gallery-close { width: auto !important; border-radius: 20px !important; padding: 0 15px !important; gap: 8px; }
            .smg-gallery-close-label { font-size: 13.5px; font-weight: 600; white-space: nowrap; }
            .smg-gallery-close:hover { background: var(--smg-link, #ff77b2) !important; border-color: var(--smg-link, #ff77b2) !important; }
            /* SCROLLER vertical · as colunas crescem pra baixo (altura auto) — sem scroll horizontal */
            /* SCROLLER vertical · cada PÁGINA é uma seção com seu próprio masonry (anexar não reembaralha as outras) */
            .smg-gallery-grid { flex: 1 1 auto; overflow-y: auto; overflow-x: hidden; padding: 8px 14px 96px; }   /* 96px embaixo: conteúdo passa por trás da dock flutuante */
            /* separador de página "PAGE N" — NÃO sticky (rola junto); linha divisória mais grossa */
            .smg-gallery-pagehdr {
                display: flex; align-items: center; gap: 16px;
                padding: 16px 2px 11px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
                color: rgba(255,255,255,0.6);
            }
            .smg-gallery-pagehdr::after { content: ""; flex: 1 1 auto; height: 3px; border-radius: 3px; background: var(--smg-bd2); }
            .smg-gallery-page.is-skel .smg-gallery-pagehdr { opacity: 0.55; }
            .smg-gallery-cols { column-width: 440px; column-gap: 12px; }   /* 1 coluna a menos (tiles maiores) */
            @media (max-width: 700px) { .smg-gallery-grid { padding: 8px 10px 92px; } .smg-gallery-cols { column-width: 46vw; column-gap: 8px; } }
            .smg-gallery-tile { position: relative; display: block; width: 100%; margin: 0 0 12px; padding: 0; border: 0; background: var(--smg-s2); border-radius: 10px; overflow: hidden; cursor: pointer; break-inside: avoid; -webkit-column-break-inside: avoid; }
            .smg-gallery-tile img { display: block; width: 100%; height: auto; }
            .smg-gallery-tile--embed { aspect-ratio: 16 / 9; background: #000; }
            .smg-gallery-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
            .smg-gallery-play svg { width: 42px; height: 42px; color: rgba(255,255,255,0.9); fill: currentColor !important; }
            .smg-gallery-tile--embed .saint-iframe { position: absolute; inset: 0; width: 100% !important; height: 100% !important; aspect-ratio: auto !important; max-width: none !important; border: 0 !important; border-radius: 0 !important; }
            /* NOSSO player no tile da galeria: preenche o tile (o iframe antigo tinha isso; sem a regra o .smg-rg colapsa = tile preto) */
            .smg-gallery-tile--embed .smg-rg { position: absolute; inset: 0; width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; margin: 0 !important; border-radius: 0 !important; aspect-ratio: auto !important; }
            .smg-gallery-max { position: absolute; top: 6px; right: 6px; z-index: 3; width: 30px; height: 30px; border: 0; border-radius: 8px; background: rgba(0,0,0,0.55); color: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .15s ease; }
            .smg-gallery-max svg { width: 16px; height: 16px; }
            .smg-gallery-max:hover { background: rgba(0,0,0,0.82); }
            .smg-gallery-tile--embed:hover .smg-gallery-max { opacity: 1; }
            @media (hover: none) { .smg-gallery-max { opacity: 1; } }
            .smg-gallery-tile:hover { outline: 2px solid var(--smg-link, #ff77b2); outline-offset: -2px; }
            .smg-gallery-empty { padding: 44px; text-align: center; color: rgba(255,255,255,0.5); }
            /* skeleton da galeria: tiles-fantasma (shimmer) reservam espaço durante o fetch → menos "pulo" da página */
            .smg-gallery-skel { position: relative; width: 100%; margin: 0 0 12px; border-radius: 10px; overflow: hidden; background: var(--smg-s2); break-inside: avoid; -webkit-column-break-inside: avoid; }
            .smg-gallery-skel::after, .smg-gallery-tile.is-loading::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent); animation: smg-skel-shimmer 1.3s ease-in-out infinite; }
            .smg-gallery-tile--image.is-loading { min-height: 150px; background: var(--smg-s2); }
            .smg-gallery-tile--image.is-loading img { opacity: 0; }
            .smg-gallery-tile--image img { transition: opacity .25s ease; }

            /* ---- images ---- */
            img.bbImage {
                width: auto !important;
                height: auto !important;
                max-width: 100% !important;
                max-height: var(--smg-media-h) !important;
                display: block !important;
                margin: 0 auto !important;
                border-radius: 8px !important;
                cursor: pointer !important;
            }
            /* verticais: NÃO força largura da coluna (era o que estourava a altura). Capa pela
               altura (width:auto) → a vertical nunca passa de --smg-media-h, centrada na coluna. */
            .portrait-grid img.bbImage {
                width: auto !important;
                max-width: 100% !important;
                max-height: var(--smg-media-h) !important;
                object-fit: contain !important;
            }
            /* skeleton: shimmer enquanto a imagem do post não pintou (sem DOM extra — é o bg da própria <img>).
               aspect-ratio (não min-height fixo!) → o box escala com a largura, batendo com a maioria das
               imagens (paisagem). a thumb fica visível e fixa o tamanho real; o JS troca pra inline aspect-ratio
               no load. some no .smg-img-ready. Anti-CLS: a faixa antiga de 160px fixos estourava ao carregar. */
            /* PERF: pulso de OPACITY (composita na GPU) em vez do shimmer por background-position (que repintava
               a caixa INTEIRA a cada frame × dezenas de imgs carregando ao mesmo tempo no burst do scroll infinito).
               O keyframes smg-img-shimmer continua existindo pros consumidores pequenos (fhcard 72px). */
            img.bbImage:not(.smg-img-ready) {
                width: 100% !important;
                aspect-ratio: 16 / 10;
                object-fit: cover;
                background-color: var(--smg-s2);
                animation: smg-img-pulse 1.25s ease-in-out infinite;
            }
            @keyframes smg-img-pulse { 0%, 100% { opacity: .55; } 50% { opacity: .95; } }
            @keyframes smg-img-shimmer { 0% { background-position: 160% 0; } 100% { background-position: -160% 0; } }
            /* host de imagem (jpg6/cuckcapital) lento/intermitente: o FÓRUM faz .lazyload/.lazyloading{opacity:0} até carregar. Quando o host pendura, a img some (opacity 0). Força visível p/ estas (têm data-smg-link) → aparece o shimmer e depois a img; se travar de vez, o JS troca por link. */
            img.bbImage[data-smg-link] { opacity: 1 !important; }
            /* fallback de imagem que não renderiza (jpg6.su/jpg5 & afins fora do ar) → chip de link clicável */
            .smg-imglink-fallback { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; margin: 2px 0; padding: 9px 13px; border: 1px solid var(--smg-bd, rgba(255,255,255,0.12)); border-radius: 10px; background: var(--smg-s1, #16171b); color: var(--smg-link, #ff77b2) !important; font-size: 13px; font-weight: 600; word-break: break-all; text-decoration: none !important; }
            .smg-imglink-fallback::before { content: "🔗"; font-size: 13px; flex: 0 0 auto; }
            .smg-imglink-fallback:hover { background: var(--smg-s2, rgba(255,255,255,0.06)); border-color: var(--smg-bd2, rgba(255,255,255,0.2)); }

            /* card de link de file-host (pixeldrain/bunkr): thumb(s) à ESQUERDA + host + sub (galeria/contagem) + ↗. O card é o próprio <a>. */
            .smg-fhcard { display: flex; align-items: center; gap: 4px; width: 100%; box-sizing: border-box; margin: 10px 0; padding: 8px; border: 1px solid var(--smg-bd, rgba(255,255,255,0.12)); border-radius: 14px; background: var(--smg-s1, #16171b); transition: border-color .15s ease, box-shadow .15s ease, transform .12s ease; }
            .smg-fhcard:hover { border-color: var(--smg-bd2, rgba(255,255,255,0.22)); box-shadow: 0 6px 20px rgba(0,0,0,0.32); }
            .smg-fhcard-main { display: flex; align-items: center; gap: 14px; flex: 1 1 auto; min-width: 0; padding: 4px; border-radius: 10px; text-decoration: none !important; color: var(--smg-tx, #e7e7ea) !important; }
            .smg-fhcard-main:hover { background: var(--smg-s2, rgba(255,255,255,0.06)); }
            .smg-fhcard-btn { flex: 0 0 auto; align-self: center; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 0; border-radius: 9px; background: transparent; color: var(--smg-link, #ff77b2); cursor: pointer; text-decoration: none !important; transition: background .14s ease; }
            .smg-fhcard-btn:hover { background: var(--smg-s2, rgba(255,255,255,0.08)); }
            .smg-fhcard-btn svg { width: 17px; height: 17px; }
            .smg-fhcard-copied { color: #46d369 !important; }
            /* preview RICO: mosaico de até 4 thumbs + badge de contagem + "+N" no último */
            .smg-fhcard-thumb { position: relative; flex: 0 0 auto; width: 96px; height: 96px; border-radius: 11px; overflow: hidden; background: var(--smg-s2, rgba(255,255,255,0.06)); }
            .smg-fhcard-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
            .smg-fhcard-thumb--multi { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 2px; }
            .smg-fhcard-cell { position: relative; overflow: hidden; background: var(--smg-s2, rgba(255,255,255,0.06)); }
            .smg-fhcard-more { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.56); color: #fff; font-size: 16px; font-weight: 800; }
            .smg-fhcard-count { position: absolute; left: 6px; bottom: 6px; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px 2px 6px; border-radius: 999px; background: rgba(0,0,0,0.66); color: #fff; font: 700 11.5px/1 -apple-system, system-ui, sans-serif; }
            .smg-fhcard-count svg { width: 12px; height: 12px; fill: none !important; }
            /* skeleton enquanto a thumb carrega (some no load); reusa o @keyframes smg-img-shimmer */
            .smg-fhcard-thumb--loading { background-image: linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 50%, transparent); background-size: 220% 100%; background-repeat: no-repeat; animation: smg-img-shimmer 1.25s ease-in-out infinite; }
            /* sem thumb → logo grande do host centralizado no tile */
            .smg-fhcard-thumb--logo { display: flex; align-items: center; justify-content: center; }
            .smg-fhcard-thumb--logo img.smg-fhcard-logo { width: 52px; height: 52px; object-fit: contain; }
            /* fallback final (sem foto nem logo): tile com a inicial do host — nunca ícone genérico/quebrado */
            .smg-fhcard-thumb--letter { display: flex; align-items: center; justify-content: center; font: 800 36px/1 -apple-system, system-ui, "Segoe UI", sans-serif; color: #fff; background: linear-gradient(135deg, var(--smg-link-strong, #d14d8f), var(--smg-link, #ff77b2)); }
            .smg-fhcard-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1 1 auto; }
            .smg-fhcard-host { font-size: 15px; font-weight: 800; color: var(--smg-tx, #e7e7ea); }
            .smg-fhcard-sub { font-size: 12.5px; color: var(--smg-tx2, rgba(255,255,255,0.55)); }

            /* ---- socialmediagirls width fix ---- */
            /* PERF: era .bbWrapper:has(.generic2wide-iframe-div) etc — :has é reavaliado pelo engine a cada mutação
               de subtree, e o processAll muta quase todo frame. markG2wWrappers (JS) marca .smg-has-g2w no
               wrapper-pai 1× por embed → casa classe estática. */
            .smg-has-g2w,
            .bbCodeBlock {
                width: 100% !important;
                max-width: none !important;
            }

            /* ---- turbo embeds ---- */
            .generic2wide-iframe-div {
                width: 100% !important;
                max-width: min(1400px, calc(var(--smg-media-h) * 16 / 9)) !important;  /* 16:9 não passa de --smg-media-h de altura */
                margin: 16px auto !important;
                display: block !important;
                /* ⚠️ O SITE (css.php, @media min-width:900px) força aspect-ratio:16/9 + overflow:hidden NESTE container —
                   era o que cortava o vídeo vertical (o player mais alto era recortado num pedaço 16:9). Soltamos os dois. */
                aspect-ratio: auto !important;
                overflow: visible !important;
            }
            iframe.saint-iframe {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                aspect-ratio: 16 / 9 !important;
                border: none !important;
                border-radius: 10px !important;
                background: #000 !important;
            }

            /* ---- turbo: slot (loading), fallback link, error card ---- */
            .smg-turbo-slot {
                position: relative;
                display: block;
                width: 100%;
                aspect-ratio: 16 / 9;
                border-radius: 10px;
                overflow: hidden;
                background: #000;
            }
            .smg-turbo-slot .saint-iframe,
            .smg-turbo-slot .smg-turbo-error {
                position: absolute !important;
                inset: 0 !important;
                width: 100% !important;
                height: 100% !important;
                aspect-ratio: auto !important;
                max-width: none !important;
                border-radius: 0 !important;
                margin: 0 !important;
            }
            .smg-loading {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2;
            }
            .smg-loading::after {
                content: "";
                width: 42px;
                height: 42px;
                border-radius: 50%;
                border: 3px solid rgba(255,255,255,0.15);
                border-top-color: rgba(255,255,255,0.85);
                animation: smg-spin 0.8s linear infinite;
            }
            @keyframes smg-spin {
                to { transform: rotate(360deg); }
            }
            .smg-turbo-fallback {
                display: block;
                margin: 8px auto 0;
                text-align: center;
                font-size: 13px;
                color: #9aa7b3;
                text-decoration: none;
                opacity: 0.85;
            }
            .smg-turbo-fallback:hover {
                opacity: 1;
                text-decoration: underline;
            }
            .smg-turbo-error {
                display: flex;
                align-items: center;
                justify-content: center;
                background: #111;
                color: #d98a8a;
                font-size: 14px;
                text-align: center;
                padding: 0 16px;
                box-sizing: border-box;
                border: 1px dashed rgba(255,255,255,0.15);
            }
            /* ---- reveal: spinner do post travado por like/medalha (in-flow, não overlay) ---- */
            .smg-reveal-spin { position: static !important; inset: auto !important; min-height: 56px; margin: 14px auto; }
            /* ---- download: botão central da dock (estado ocupado) ---- */
            .smg-nav-btn.smg-dl-busy { opacity: 0.6; pointer-events: none; }
            /* ---- mídia direta (susercontent/Shopee, .mp4/.webm/.webp em link cru) ---- */
            .smg-dm-wrap { margin: 14px auto; max-width: min(1100px, 100%); }
            .smg-dm-wrap img.bbImage { border-radius: 10px; }
            .smg-dm-video {
                display: block; width: 100%;
                max-width: min(1400px, calc(var(--smg-media-h) * 16 / 9));
                max-height: var(--smg-media-h);
                margin: 0 auto; border-radius: 10px; background: #000;
            }
            /* ---- barra de chips dos links de file-host (GoFile/Bunkr/…) no fim do post ---- */
            .smg-post-links { display: flex; flex-wrap: wrap; gap: 7px; margin: 12px 0 2px; padding-top: 11px; border-top: 1px solid var(--smg-bd); }
            .smg-link-chip {
                display: inline-flex; align-items: center; gap: 6px; max-width: 100%;
                padding: 6px 11px; border-radius: 8px; background: var(--smg-s2); border: 1px solid var(--smg-bd);
                color: rgba(255,255,255,0.82) !important; font-size: 12.5px; font-weight: 600; text-decoration: none;
            }
            .smg-link-chip svg { width: 14px; height: 14px; flex: 0 0 auto; opacity: 0.65; }
            .smg-link-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .smg-link-chip:hover { background: var(--smg-s3); color: #fff !important; border-color: var(--smg-bd2); }

            /* ---- imagepond videos: full width igual aos outros ---- */
            iframe[src*="imagepond.net"] {
                display: block !important;
                width: 100% !important;
                max-width: min(1400px, calc(var(--smg-media-h) * 16 / 9)) !important;  /* 16:9 não passa de --smg-media-h de altura */
                height: auto !important;
                aspect-ratio: 16 / 9 !important;
                margin: 16px auto !important;
                border: none !important;
                border-radius: 10px !important;
                background: #000 !important;
            }

            /* ---- redgifs / gifs / youtube: full width igual aos outros ---- */
            span[data-s9e-mediaembed="youtube"],
            span[data-s9e-mediaembed="gifs"],
            span[data-s9e-mediaembed="redgifs"] {
                display: block !important;
                width: 100% !important;
                max-width: min(1400px, calc(var(--smg-media-h) * 16 / 9)) !important;  /* 16:9 não passa de --smg-media-h de altura */
                margin: 16px auto !important;
            }
            span[data-s9e-mediaembed="youtube"] > span,
            span[data-s9e-mediaembed="gifs"] > span,
            span[data-s9e-mediaembed="redgifs"] > span {
                display: block !important;
                width: 100% !important;
                height: auto !important;
                padding: 0 !important;
            }
            span[data-s9e-mediaembed="youtube"] iframe,
            span[data-s9e-mediaembed="gifs"] iframe,
            span[data-s9e-mediaembed="redgifs"] iframe {
                position: static !important;
                display: block !important;
                width: 100% !important;
                height: auto !important;
                aspect-ratio: 16 / 9 !important;
                border: none !important;
                border-radius: 10px !important;
                background: #000 !important;
            }
            /* loadMedia (redgifs etc.) às vezes injeta o iframe direto na div */
            .generic2wide-iframe-div > iframe:not(.saint-iframe) {
                display: block !important;
                width: 100% !important;
                height: auto !important;
                aspect-ratio: 16 / 9 !important;
                border: none !important;
                border-radius: 10px !important;
                background: #000 !important;
            }

            /* defensivo: o conteúdo do embed NUNCA passa da largura do container.
               alguns players (ex.: redgifs) injetam iframe/wrapper aninhado com
               largura fixa que escapava dos seletores acima e estourava a página
               no mobile (scroll horizontal). */
            .generic2wide-iframe-div,
            span[data-s9e-mediaembed] {
                overflow: hidden !important;
            }
            .generic2wide-iframe-div *,
            span[data-s9e-mediaembed] * {
                max-width: 100% !important;
            }

            /* ---- player nativo de redgifs (.smg-rg substitui o iframe; mp4 da API num <video>) ---- */
            .smg-rg {
                position: relative;
                display: block;
                width: 100%;
                max-width: min(1400px, calc(var(--smg-media-h) * 16 / 9));
                max-height: var(--smg-media-h);   /* TETO: não estoura o viewport (vale no masonry) */
                margin: 16px auto;
                aspect-ratio: 16 / 9;             /* placeholder; o JS troca pelo aspect REAL (videoWidth/Height ou API do redgifs) e MANTÉM (não some no clearSkel) */
                background: #000;
                border-radius: 10px;
                overflow: hidden;
                /* CRO antigo NÃO volta: o site forçava aspect/overflow no .generic2wide-iframe-div (já destravado); e o vídeo é
                   position:absolute+inset:0 (preenche a caixa SEM depender de %-height resolver). object-fit:contain = nunca corta. */
            }
            span[data-s9e-mediaembed] .smg-rg,
            .generic2wide-iframe-div .smg-rg { margin: 0 !important; }   /* container já dá a margem → não dobra */
            .smg-rg-fail {   /* gif morto: placeholder discreto no lugar do iframe de erro do redgifs */
                display: flex; align-items: center; justify-content: center;
                width: 100%; aspect-ratio: 16 / 9; max-height: var(--smg-media-h);
                background: #161616; color: rgba(255,255,255,0.45);
                border-radius: 10px; font-size: 13px; text-align: center; padding: 8px;
            }
            .smg-rg-v {
                position: absolute; inset: 0;    /* preenche a CAIXA (aspect-ratio do .smg-rg); inset:0 evita o bug de %-height não resolver com max-height */
                display: block; width: 100%; height: 100%;
                object-fit: contain;             /* nunca corta — letterbox só se o teto (max-height) mudar o aspect da caixa */
                background: #000;
                cursor: pointer;
            }
            /* SKELETON de verdade: enquanto carrega, a caixa (com aspect-ratio = altura reservada) mostra SÓ
               shimmer + spinner; o player (vídeo + controles + badge) fica ESCONDIDO até o vídeo ter um frame
               real (o JS tira .smg-rg-loading no 'loadeddata'). */
            .smg-rg.smg-rg-loading { background: #141414; overflow: hidden; }   /* overflow: clipa o shimmer transladado (abaixo) */
            .smg-rg.smg-rg-loading > .smg-rg-v,
            .smg-rg.smg-rg-loading > .smg-rgc-flash,
            .smg-rg.smg-rg-loading > .smg-rgc-bottom,
            .smg-rg.smg-rg-loading > .smg-rgc-src { opacity: 0 !important; pointer-events: none !important; }   /* skeleton esconde o vídeo+controles; a caixa (aspect-ratio do .smg-rg) já reserva o espaço */
            .smg-rg.smg-rg-loading::before {
                content: ""; position: absolute; inset: 0; z-index: 1;
                /* PERF: shimmer por TRANSFORM (composita; mesmo padrão do .smg-gallery-skel) — bg-position repintava o skeleton inteiro (até 1400px) por frame */
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 50%, transparent);
                transform: translateX(-100%);
                animation: smg-skel-shimmer 1.25s ease-in-out infinite;
            }
            .smg-rg.smg-rg-loading::after {
                content: "";
                position: absolute;
                top: 50%; left: 50%;
                width: 42px; height: 42px;
                margin: -21px 0 0 -21px;
                border-radius: 50%;
                border: 3px solid rgba(255,255,255,0.15);
                border-top-color: rgba(255,255,255,0.85);
                animation: smg-spin 0.8s linear infinite;
                z-index: 2;
            }
            /* PRONTO (defer de host-blob, autoplay-off): sem spinner, play central FIXO ("clique pra tocar").
               poster (redgifs) ou fundo preto (turbo/saint) atrás → NUNCA caixa preta sem affordance (era o bug do deferBlob desligado). */
            .smg-rg.smg-rg-ready .smg-rgc-flash { opacity: 1; }
            .smg-rg.smg-rg-ready .smg-rgc-play { pointer-events: auto; }
            /* ---- controles estilo YouTube: play CENTRAL (no pausado) + BARRA INFERIOR com gradiente:
               scrubber em cima e linha [play · volume · tempo ··· download · visualizador · tela cheia]. Accent = tema. ---- */
            /* CENTRO: play grande — só no pausado/pronto (tocando, o controle é a barra). Seek = duplo-clique no vídeo. */
            .smg-rgc-flash {
                position: absolute; inset: 0; z-index: 2;
                display: flex; align-items: center; justify-content: center;
                opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
            }
            .smg-rg:hover:not(.smg-rg-loading):not(.smg-rg-buffering):not(.smg-rgc-playing) .smg-rgc-flash { opacity: 1; }
            .smg-rgc-flash button {
                border: 0; border-radius: 50%; cursor: pointer; padding: 0;
                background: rgba(0,0,0,0.55); color: #fff;
                display: flex; align-items: center; justify-content: center;
                transition: transform 0.12s ease, background 0.12s ease; pointer-events: none;   /* só interativo quando o flash aparece (regras abaixo) — senão capturaria cliques invisível */
            }
            .smg-rgc-flash button:hover { transform: scale(1.08); background: rgba(0,0,0,0.72); }
            .smg-rg:hover:not(.smg-rg-loading):not(.smg-rg-buffering):not(.smg-rgc-playing) .smg-rgc-flash button { pointer-events: auto; }
            .smg-rgc-play { width: 64px; height: 64px; }
            .smg-rgc-play svg { width: 30px; height: 30px; display: block; margin-left: 3px; }
            @media (max-width: 600px) { .smg-rgc-play { width: 54px; height: 54px; } .smg-rgc-play svg { width: 26px; height: 26px; } }
            /* BARRA INFERIOR: gradiente; some fora do hover; visível no pausado-carregado e no touch (NÃO no pronto/poster) */
            .smg-rgc-bottom {
                position: absolute; left: 0; right: 0; bottom: 0; z-index: 3;
                padding: 8px 4px 2px;
                background: linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.30) 62%, transparent 100%);
                opacity: 0; pointer-events: none; transition: opacity 0.18s ease;
            }
            .smg-rg:hover:not(.smg-rg-loading):not(.smg-rg-ready) .smg-rgc-bottom,
            .smg-rg:not(.smg-rgc-playing):not(.smg-rg-ready):not(.smg-rg-loading):not(.smg-rg-buffering) .smg-rgc-bottom { opacity: 1; pointer-events: auto; }
            @media (hover: none) { .smg-rg:not(.smg-rg-loading):not(.smg-rg-ready) .smg-rgc-bottom { opacity: 1; pointer-events: auto; } }
            /* SCRUBBER (no topo da barra) */
            .smg-rgc-prog { position: relative; width: 100%; height: 14px; display: flex; align-items: center; cursor: pointer; touch-action: none; }
            .smg-rgc-bar { position: relative; width: 100%; height: 3px; background: rgba(255,255,255,0.28); border-radius: 3px; transition: height 0.1s ease; }
            .smg-rgc-prog:hover .smg-rgc-bar { height: 5px; }
            .smg-rgc-buf { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: rgba(255,255,255,0.30); border-radius: 3px; pointer-events: none; }
            .smg-rgc-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: var(--smg-link, #ff77b2); border-radius: 3px; pointer-events: none; }
            .smg-rgc-knob { position: absolute; right: -6px; top: 50%; width: 12px; height: 12px; border-radius: 50%; background: var(--smg-link, #ff77b2); transform: translateY(-50%) scale(0); transition: transform 0.1s ease; }
            .smg-rgc-prog:hover .smg-rgc-knob { transform: translateY(-50%) scale(1); }
            /* LINHA de controles */
            .smg-rgc-row { display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 1px 4px 2px; }
            .smg-rgc-left, .smg-rgc-right { display: flex; align-items: center; gap: 1px; }
            .smg-rgc-act {
                width: 34px; height: 34px; border: 0; border-radius: 50%; cursor: pointer; padding: 0;
                background: transparent; color: #fff;
                display: flex; align-items: center; justify-content: center;
                transition: background 0.12s ease, transform 0.12s ease;
            }
            .smg-rgc-act:hover { background: rgba(255,255,255,0.16); }
            .smg-rgc-act:active { transform: scale(0.9); }
            .smg-rgc-act svg { width: 21px; height: 21px; display: block; }
            /* PADRONIZA os ícones do player = OUTLINE limpo, igual ao visualizador (o CSS do fórum PREENCHE svg → vira blob; o #smg-feed já se protege, o inline não). Play/pause é a exceção (preenchido). */
            .smg-rg .smg-rgc-act svg, .smg-rg .smg-rgc-src svg { fill: none !important; }
            .smg-rg .smg-rgc-play svg, .smg-rg .smg-rgc-barplay svg { fill: currentColor !important; }
            /* VOLUME: mute + barra que expande no hover (YouTube) */
            .smg-rgc-vol { display: flex; align-items: center; }
            .smg-rgc-volbar { position: relative; width: 0; height: 4px; border-radius: 3px; background: rgba(255,255,255,0.35); cursor: pointer; opacity: 0; transition: width 0.18s ease, opacity 0.18s ease, margin 0.18s ease; touch-action: none; }
            .smg-rgc-vol:hover .smg-rgc-volbar { width: 60px; opacity: 1; margin: 0 6px 0 2px; }
            .smg-rgc-volbar::before { content: ""; position: absolute; left: 0; right: 0; top: -9px; bottom: -9px; }   /* área de clique alta */
            .smg-rgc-volfill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: #fff; border-radius: 3px; pointer-events: none; }
            /* TEMPO (atual / duração) */
            .smg-rgc-time { color: #fff; font: 600 12px/1 -apple-system, system-ui, sans-serif; font-variant-numeric: tabular-nums; padding: 0 6px; white-space: nowrap; flex: 0 0 auto; }
            @media (max-width: 600px) { .smg-rgc-act { width: 30px; height: 30px; } .smg-rgc-act svg { width: 19px; height: 19px; } .smg-rgc-time { font-size: 11px; padding: 0 4px; } }
            /* indicador "« 5s" / "5s »" no duplo-clique p/ voltar/avançar */
            .smg-rgc-seekflash {
                position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 3;
                color: #fff; font: 700 15px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                background: rgba(0,0,0,0.55); padding: 9px 15px; border-radius: 999px;
                opacity: 0; transition: opacity 0.15s ease; pointer-events: none; white-space: nowrap;
            }
            .smg-rgc-seekflash.on { opacity: 1; }
            /* WATERMARK de fonte (badge flutuante no canto sup-direito da mídia, só no hover — posicionado por JS, position:fixed) */
            .smg-src-wm {
                position: fixed; z-index: 90; transform: translateX(-100%);   /* watermark de hover: acima do conteúdo (maior fixed de conteúdo = river-pill z 60), ABAIXO da topbar (z 100) e dos overlays — não cobre a chrome */
                padding: 3px 9px; border-radius: 7px;
                background: rgba(0,0,0,0.62); color: #fff; text-decoration: none;
                font: 700 11px/1.4 -apple-system, system-ui, "Segoe UI", sans-serif; letter-spacing: 0.02em;
                pointer-events: auto; cursor: pointer; box-shadow: 0 1px 5px rgba(0,0,0,0.45); white-space: nowrap;
                transition: background 0.15s ease;   /* CLICÁVEL: abre a imagem no host (igual o badge de fonte do vídeo) */
            }
            a.smg-src-wm:hover { background: rgba(0,0,0,0.82); color: #fff; }
            a.smg-src-wm:active { transform: translateX(-100%) scale(0.96); }
            /* FONTE + abrir EXTERNO num só: badge clicável no canto SUP-DIREITO do player ("Turbo ↗"). É a marca-dágua da fonte E o "abrir no host" (substituiu o ↗ do rail). */
            .smg-rgc-src {
                position: absolute; top: 10px; right: 10px; z-index: 4;
                display: inline-flex; align-items: center; gap: 5px; max-width: calc(100% - 20px);
                padding: 4px 9px; border-radius: 8px;
                background: rgba(0,0,0,0.6); color: #fff; text-decoration: none;
                font: 800 12px/1.2 -apple-system, system-ui, "Segoe UI", sans-serif; letter-spacing: 0.01em;
                cursor: pointer; opacity: 0; pointer-events: none;
                transition: opacity 0.15s ease, background 0.15s ease; box-shadow: 0 1px 5px rgba(0,0,0,0.45);
            }
            .smg-rg:hover .smg-rgc-src { opacity: 1; pointer-events: auto; }
            .smg-rgc-src:hover { background: rgba(0,0,0,0.82); }
            .smg-rgc-src:active { transform: scale(0.96); }
            .smg-rgc-src .smg-rgc-src-t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .smg-rgc-src svg { width: 13px; height: 13px; display: block; flex: 0 0 auto; }
            @media (hover: none) { .smg-rgc-src { opacity: 0.72; pointer-events: auto; } }
            /* BUFFERING (loading ao avançar/voltar): spinner por cima, SEM esconder o vídeo (diferente do skeleton) */
            .smg-rg.smg-rg-buffering::after {
                content: ""; position: absolute; top: 50%; left: 50%; width: 42px; height: 42px; margin: -21px 0 0 -21px;
                border-radius: 50%; border: 3px solid rgba(255,255,255,0.22); border-top-color: rgba(255,255,255,0.9);
                animation: smg-spin 0.8s linear infinite; z-index: 4; pointer-events: none;
            }
            .smg-rg:fullscreen { width: 100vw; height: 100vh; max-width: none; max-height: none; aspect-ratio: auto; margin: 0; background: #000; }
            .smg-rg:fullscreen .smg-rg-v { height: 100%; }
            /* turbo/saint: quando o slot recebe NOSSO player, ele NÃO pode forçar 16:9 nem cortar — a altura
               vem do aspect REAL do .smg-rg (vídeo vertical não vira faixa horizontal). A classe .smg-turbo-slot--filled
               é setada no JS ao montar o player (robusto: não depende do :has, que às vezes não solta o 16:9 a tempo
               e o overflow:hidden do slot recorta o player vertical num pedaço horizontal). */
            /* ⚠️ REGRAS SEPARADAS de propósito: agrupar com :has(...) faz o browser DESCARTAR a regra
               inteira se o :has falhar no contexto (era o bug — o --filled vinha no DOM mas sem efeito,
               o vídeo vertical continuava cortado). A classe .smg-turbo-slot--filled é setada no JS e
               NÃO depende de :has, então sempre vale. */
            .smg-turbo-slot--filled {
                aspect-ratio: auto !important; overflow: visible !important; background: transparent !important;
            }
            /* (o fallback .smg-turbo-slot:has(.smg-rg) foi REMOVIDO: todo caminho que põe .smg-rg num slot chama
               fillSlot() → a classe acima sempre vale, e o :has custava re-validação upward a cada mutação) */
            .smg-turbo-slot > .smg-rg { margin: 0 !important; }

            /* ---- site a 80% da largura disponível (desktop), CENTRALIZADO ---- */
            @media (min-width: 800px) {
                .p-header-inner,
                .p-nav-inner,
                .p-sectionLinks-inner,
                .p-body-inner,
                .p-footer-inner {
                    max-width: var(--smg-cw) !important;
                    margin-left: auto !important;
                    margin-right: auto !important;
                }
                /* o socialmediagirls usa .pageContent (fora do .p-body-inner) no header/breadcrumb;
                   alinha com o conteúdo (mesma largura) pra não ficar torto */
                .p-body-header > .pageContent,
                .breadcrumb > .pageContent {
                    max-width: var(--smg-cw) !important;
                    margin-left: auto !important;
                    margin-right: auto !important;
                }
            }

            /* ---- header das páginas: maior + alinhado à esquerda ---- */
            /* mata o padding-top: 20px que o tema põe em todo filho direto do .p-body */
            .p-body > * { padding-top: 0 !important; }
            /* respiro abaixo da topbar FIXA: o título não cola na barra (era 10px → colava no desktop, onde
               body=topbar=76px e o gap é zero). 26px = mesmo valor já usado nas threads (.smg-thread). */
            .p-body-header { padding-top: 26px !important; padding-bottom: 10px !important; }
            @media (max-width: 600px) { .p-body-header { padding-top: 16px !important; } }   /* mobile já tem gap (topbar 52 < body 76) → não empilha demais */
            .p-body-header .p-title { text-align: left !important; }
            .p-body-header .p-title-value { font-size: 30px !important; font-weight: 800 !important; line-height: 1.2 !important; }

            /* ---- remove banners de anúncio (striply etc.) ---- */
            a[href*="striply.com"],
            body > a[href*="striply"] { display: none !important; }

            /* ---- SMG: REMOVE a sidebar fora da home · conteúdo a 100% ----
               na home a sidebar é reaproveitada (realocada pro topo — ver bloco HOME);
               nas demais páginas (threads, /forums, busca, whats-new) some de vez e o
               .p-body-content passa a ocupar todo o espaço (mata grid/flex/float de 2 colunas).
               EXCEÇÃO: páginas com .p-body-sideNav (conta/settings) usam um menu LATERAL legítimo —
               ali NÃO mexemos na largura do conteúdo (senão o layout de 2 colunas quebra/empilha). */
            html:not(.smg-home-page) .p-body-sidebar,
            html:not(.smg-home-page) .p-body-sidebarCol { display: none !important; }
            /* PERF: html.smg-has-sidenav (setado 1× no detectPageClasses) no lugar de :not(:has(.p-body-sideNav)):
               o :has ancorado no .p-body-main (ancestral da stream de posts INTEIRA) re-validava a cada
               mutação de subtree — e o processAll muta quase todo frame. Mesmo padrão do smg-has-g2w. */
            html:not(.smg-home-page):not(.smg-has-sidenav) .p-body-main--withSidebar {
                display: block !important; grid-template-columns: none !important; gap: 0 !important;
            }
            html:not(.smg-home-page):not(.smg-has-sidenav) .p-body-main .p-body-content,
            html:not(.smg-home-page):not(.smg-has-sidenav) .p-body-main .p-body-contentCol {
                width: 100% !important; max-width: 100% !important; min-width: 0 !important;
                flex: 1 1 100% !important; grid-column: 1 / -1 !important; float: none !important;
            }
            /* ---- breadcrumb some por completo nos 2 sites (fórum · thread · busca…) ----
               só esconde (não remove do DOM): o JS ainda lê o link /forums/ pra achar o fórum pai */
            html.smg-sc .breadcrumb, html.smg-smg .breadcrumb,
            html.smg-sc .p-breadcrumbs, html.smg-smg .p-breadcrumbs { display: none !important; }

            `;
        const CSS_HOME = `/* ================= HOME (forum_list) reformulada ================= */
            /* sidebar vai pro topo · conteúdo em coluna única, FULL WIDTH (nada na lateral) */
            html.smg-home .p-body-main--withSidebar {
                display: flex !important; flex-direction: column !important; align-items: stretch !important;
                grid-template-columns: none !important; gap: 0 !important;
            }
            html.smg-home .p-body-contentCol, html.smg-home .p-body-sidebarCol { display: none !important; }
            html.smg-home .p-body-content,
            html.smg-home .p-body-sidebar {
                width: 100% !important; max-width: 100% !important; min-width: 0 !important;
                flex: 0 0 auto !important; float: none !important; position: static !important;
                grid-column: auto !important; grid-area: auto !important; min-height: 0 !important;
                box-sizing: border-box !important;
            }
            html.smg-home .p-body-content { order: 2 !important; padding-left: 0 !important; padding-right: 0 !important; }   /* mata o padding-right:20px do tema (.p-body-main--withSidebar) que desalinhava a home */
            html.smg-home .p-body-sidebar { order: 1 !important; margin: 0 0 22px !important; padding: 0 !important; }
            html.smg-home .p-body-sidebar .block { margin: 0 !important; }
            html.smg-home .p-body-sidebar .uix_sidebarInner { margin: 0 !important; }
            /* todo widget da sidebar vira card rounded com destaque */
            html.smg-home .p-body-sidebar .block .block-container {
                background: rgba(255,255,255,0.035) !important; border: 1px solid rgba(255,255,255,0.09) !important;
                border-radius: 16px !important; overflow: hidden;
            }
            html.smg-home .p-body-sidebar .block-minorHeader,
            html.smg-home .p-body-sidebar .block-header {
                background: rgba(255,255,255,0.03) !important; border-bottom: 1px solid rgba(255,255,255,0.07) !important;
                padding: 12px 16px !important; font-size: 14px !important; font-weight: 700 !important;
            }
            /* ---- home: FEED com abas (Latest posts · Trending) — scroll horizontal, painel em DESTAQUE ---- */
            /* hero shelf: surface elevada NEUTRA (sem tingir de rosa) → destaca das sections (transparentes) só pela elevação */
            html.smg-home .smg-feed-block { margin: 8px 0 40px !important; padding: 14px 18px 20px; background: var(--smg-s1, #16171b); border: 1px solid var(--smg-bd); border-radius: 20px; box-shadow: 0 10px 34px rgba(0,0,0,0.34); overflow: visible; }
            @media (max-width: 600px) { html.smg-home .smg-feed-block { padding: 10px 12px 14px; border-radius: 16px; margin-bottom: 30px !important; } }
            /* tabbar = "header" da section (pills + borda inferior, igual às outras sections) */
            html.smg-home .smg-feed-tabs { display: flex; align-items: center; gap: 8px; padding: 0 2px; margin: 0 0 18px; background: transparent; border-bottom: 1px solid var(--smg-bd); }
            /* tabs scrollam aqui; o "See all" + notices ficam fora desse scroll, à direita */
            html.smg-home .smg-feed-tablist { display: flex; gap: 2px; flex: 1 1 auto; min-width: 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
            html.smg-home .smg-feed-tablist::-webkit-scrollbar { display: none; }
            /* abas = sublinhado-accent (mesma linguagem do header do Feed): chrome neutro, rosa SÓ no item ativo */
            html.smg-home .smg-feed-tab {
                position: relative;
                display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto; height: 44px; padding: 0 13px;
                border: 0; background: transparent; color: rgba(255,255,255,0.5);
                font-size: 14px; font-weight: 700; letter-spacing: .005em; cursor: pointer; white-space: nowrap; transition: color .15s ease;
            }
            html.smg-home .smg-feed-tab:hover { color: rgba(255,255,255,0.86); }
            html.smg-home .smg-feed-tab.is-active { color: #fff; }
            html.smg-home .smg-feed-tab::after { content: ""; position: absolute; left: 11px; right: 11px; bottom: -1px; height: 2.5px; border-radius: 3px 3px 0 0; background: var(--smg-link, #ff77b2); transform: scaleX(0); transition: transform .2s ease; }
            html.smg-home .smg-feed-tab.is-active::after { transform: scaleX(1); }
            html.smg-home .smg-feed-tab-ic { display: inline-flex; }
            html.smg-home .smg-feed-tab-ic svg { width: 16px; height: 16px; fill: none !important; }
            /* "See all" → empurrado pra direita da tabbar; vai pra página da aba ativa */
            html.smg-home .smg-feed-seeall { flex: 0 0 auto; align-self: center; display: inline-flex; align-items: center; gap: 5px; padding: 0 2px 0 8px; color: rgba(255,255,255,0.6); font-size: 12.5px; font-weight: 600; text-decoration: none; white-space: nowrap; transition: color .14s ease; }
            html.smg-home .smg-feed-seeall:hover { color: #fff; }
            html.smg-home .smg-feed-seeall svg { display: block; }
            /* corpo: scroll horizontal de cards (mobile-friendly), com setas ‹ › no desktop */
            html.smg-home .smg-feed-scroll { position: relative; }
            html.smg-home .smg-feed-panel { display: none; }
            html.smg-home .smg-feed-panel.is-active { display: flex; gap: 14px; padding: 2px; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x proximity; scrollbar-width: none; -ms-overflow-style: none; }
            html.smg-home .smg-feed-panel::-webkit-scrollbar { display: none; }
            /* CARD IMERSIVO: a imagem preenche o tile (3:4); título/meta flutuam no rodapé sobre um scrim. Imagem em 1º plano, menos chrome. */
            html.smg-home .smg-feed-card {
                position: relative; flex: 0 0 230px; width: 230px; aspect-ratio: 3 / 4; scroll-snap-align: start;
                display: block; border-radius: 16px; overflow: hidden;
                background: var(--smg-s2); border: 1px solid var(--smg-bd); text-decoration: none;
                transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
            }
            html.smg-home .smg-feed-card:hover { transform: translateY(-4px); border-color: var(--smg-bd2); box-shadow: 0 16px 36px rgba(0,0,0,0.5); }
            html.smg-home .smg-feed-card-thumb { position: absolute; inset: 0; width: 100%; height: 100%; background: var(--smg-s2); overflow: hidden; display: block; }
            html.smg-home .smg-feed-card-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .45s cubic-bezier(.2,.7,.3,1); }
            html.smg-home .smg-feed-card:hover .smg-feed-card-thumb img { transform: scale(1.07); }   /* zoom suave da mídia no hover */
            html.smg-home .smg-feed-card-thumb.smg-feed-noimg { display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 38%, var(--smg-s3), var(--smg-s1)); }
            html.smg-home .smg-feed-card-thumb.smg-feed-noimg .smg-ph-word { font-size: 32px; opacity: .5; }
            html.smg-home .smg-feed-card-body { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 28px 13px 13px; display: flex; flex-direction: column; gap: 5px; min-width: 0; background: linear-gradient(to top, rgba(0,0,0,0.94) 6%, rgba(0,0,0,0.7) 38%, rgba(0,0,0,0.18) 78%, transparent 100%); }
            html.smg-home .smg-feed-skel .smg-feed-card-body { background: none; }
            html.smg-home .smg-feed-card-title { font-size: 13.5px; font-weight: 600; color: #fff; line-height: 1.32; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-shadow: 0 1px 3px rgba(0,0,0,0.55); }
            html.smg-home .smg-feed-card-title .label, html.smg-home .smg-feed-card-title .prefix { margin-right: 3px; }
            html.smg-home .smg-feed-card-meta { font-size: 11.5px; color: rgba(255,255,255,0.78); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
            html.smg-home .smg-feed-loading { width: 100%; padding: 40px; text-align: center; color: rgba(255,255,255,0.45); font-size: 13px; }
            /* skeletons de loading (cards-fantasma com shimmer) */
            html.smg-home .smg-feed-skel { pointer-events: none; }
            html.smg-home .smg-skel-box, html.smg-home .smg-skel-line { position: relative; overflow: hidden; background: var(--smg-s2); }
            html.smg-home .smg-feed-skel .smg-feed-card-thumb { background: var(--smg-s2); }
            html.smg-home .smg-skel-line { height: 11px; border-radius: 5px; margin-bottom: 7px; }
            html.smg-home .smg-skel-line--short { width: 60%; }
            html.smg-home .smg-skel-line--meta { width: 45%; height: 9px; margin-top: 5px; margin-bottom: 0; }
            html.smg-home .smg-skel-box::after, html.smg-home .smg-skel-line::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent); animation: smg-skel-shimmer 1.3s ease-in-out infinite; }
            @keyframes smg-skel-shimmer { 100% { transform: translateX(100%); } }
            html.smg-home .smg-feed-nav { position: absolute; top: 50%; transform: translateY(-50%); z-index: 4; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; color: #fff; line-height: 0; border: 1px solid var(--smg-bd2); background: rgba(20,20,20,0.94); box-shadow: 0 6px 18px rgba(0,0,0,0.5); transition: background .15s ease, transform .12s ease, opacity .18s ease, visibility .18s; }   /* PERF: removido backdrop-filter blur(8px) — botão flutua sobre o carrossel que rola; bg 0.94 já é legível sem o blur */
            html.smg-home .smg-feed-nav:hover { background: rgba(46,46,46,0.96); }
            html.smg-home .smg-feed-nav:active { transform: translateY(-50%) scale(0.9); }
            html.smg-home .smg-feed-nav svg { width: 18px; height: 18px; fill: none !important; }
            html.smg-home .smg-feed-prev { left: -7px; }
            html.smg-home .smg-feed-next { right: -7px; }
            html.smg-home .smg-feed-nav.smg-nav-hidden { opacity: 0; visibility: hidden; pointer-events: none; }
            @media (max-width: 600px) {
                html.smg-home .smg-feed-card { flex-basis: 210px; width: 210px; }
                html.smg-home .smg-feed-nav { display: none; }
            }

            /* sections: minimalistas — grupo transparente, sem caixa pesada (cards é que têm presença) */
            html.smg-home .block--category {
                margin-bottom: 34px !important; border-radius: 0 !important;
                background: transparent !important;
                border: 0 !important; box-shadow: none !important; overflow: visible !important;
            }
            html.smg-home .block--category .block-container,
            html.smg-home .block--category > .block-container,
            html.smg-home .block--category .uix_block-body--outer {
                background: transparent !important; border: 0 !important; box-shadow: none !important;
            }
            html.smg-home .block--category .block-header {
                display: flex !important; align-items: center; justify-content: flex-start; position: relative;
                background: transparent !important;
                padding: 0 2px 12px !important; margin: 0 0 16px !important;
                font-size: 12.5px !important; font-weight: 700 !important; letter-spacing: .14em; text-transform: uppercase;
                color: rgba(255,255,255,0.55) !important;
                border: 0 !important; border-bottom: 1px solid var(--smg-bd) !important;
            }
            html.smg-home .block--category .block-header a,
            html.smg-home .block--category .uix_categoryTitle { color: #fff !important; }
            html.smg-home .block--category .categoryCollapse--trigger { position: absolute !important; right: 16px; top: 50%; transform: translateY(-50%); margin: 0 !important; }
            html.smg-home .block--category .block-body {
                display: grid !important;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)) !important;
                gap: 14px !important; padding: 0 !important; background: transparent !important; border: 0 !important;
            }
            /* SMG: 5 colunas (igual SimpCity), caindo de 1 em 1 por breakpoint */
            html.smg-smg.smg-home .block--category .block-body { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
            @media (max-width: 1180px) { html.smg-smg.smg-home .block--category .block-body { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }
            @media (max-width: 820px)  { html.smg-smg.smg-home .block--category .block-body { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } }
            /* mobile: 2 colunas nas sections (os dois sites) */
            @media (max-width: 600px) {
                html.smg-home .block--category .block-body,
                html.smg-smg.smg-home .block--category .block-body {
                    grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 9px !important; padding: 10px !important;
                }
                /* divider: dá um respiro no texto pra alinhar com os cards (inset de 10px no mobile) */
                html.smg-home .block--category .block-header { padding-left: 12px !important; }
                html.smg-home .node-body { padding: 14px 10px !important; gap: 7px !important; }
                html.smg-home .node-icon { width: 50px !important; height: 50px !important; padding: 7px !important; }
                html.smg-home .node-title { font-size: 13.5px !important; }
            }
            /* home: remove a linha do header da página (título + New Posts/Post Thread) — vai pro botão "Novo" da topbar */
            html.smg-home .p-body-header { display: none !important; }
            html.smg-home .block--category .node {
                border: 1px solid var(--smg-bd) !important;
                border-radius: 14px !important;
                background: var(--smg-s1) !important;
                overflow: visible !important;
                transition: background .16s ease, border-color .16s ease, transform .16s ease, box-shadow .16s ease;
            }
            /* SMG: cards da home na MESMA cor/rounding do SimpCity (o tema SMG deixava mais claro e o --smg-s1 é 13.5%). Especificidade alta + !important. */
            /* XADREZ (igual SimpCity): card sim/card não. ímpar = 12.5%, par = 9.5%. 5 colunas (ímpar) → alterna em 2D.
               node-body transparente → o bg do node aparece; overflow:hidden corta o vazamento do canto arredondado. */
            html.smg-smg.smg-home .block--category .node { background-color: hsl(0 0% 12.5%) !important; border-radius: 14px !important; overflow: hidden !important; }
            html.smg-smg.smg-home .block--category .block-body > .node:nth-child(even) { background-color: hsl(0 0% 11%) !important; }
            html.smg-smg.smg-home .block--category .node-body { background: transparent !important; }
            html.smg-smg.smg-home .block--category .block-body > .node:hover { background-color: hsl(0 0% 16%) !important; }
            /* nada de truncar/cortar conteúdo dentro do card */
            html.smg-home .node-title, html.smg-home .node-title a,
            html.smg-home .node-description, html.smg-home .node-extra-title {
                white-space: normal !important; overflow: visible !important; text-overflow: clip !important;
            }
            html.smg-home .block--category .node:hover {
                background: var(--smg-s2) !important;
                border-color: var(--smg-bd2) !important; transform: translateY(-3px);
                box-shadow: 0 12px 28px rgba(0,0,0,0.42) !important;   /* elevação no hover (best-practice dark: profundidade na interação, não só borda) */
            }
            /* card centralizado: ÍCONE / NOME / subtítulo · card inteiro clicável */
            html.smg-home .block--category .node { display: flex !important; cursor: pointer; }
            html.smg-home .node-body {
                flex: 1 1 auto !important;
                display: flex !important; flex-direction: column !important;
                align-items: center !important; justify-content: center !important;
                text-align: center !important; gap: 9px !important; padding: 16px 12px !important;   /* densificado: menos espaço morto, card mais "app tile" */
            }
            html.smg-home .node-icon {
                width: 60px !important; height: 60px !important; margin: 0 0 2px !important; padding: 8px !important; box-sizing: border-box !important;
                display: flex !important; align-items: center; justify-content: center;
                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
                transition: transform .18s ease, border-color .18s ease, background .18s ease;
            }
            html.smg-home .block--category .node:hover .node-icon { transform: scale(1.08) translateY(-1px); background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.16); }   /* microinteração: ícone "salta" no hover */
            html.smg-home .node-icon img { width: auto !important; height: auto !important; max-width: 100% !important; max-height: 100% !important; border-radius: 9px !important; object-fit: contain !important; }
            html.smg-home .node-icon i { font-size: 28px; display: inline-flex; }
            html.smg-home .node-icon i svg, html.smg-home .node-icon > svg { width: 28px !important; height: 28px !important; color: rgba(255,255,255,0.75); }
            html.smg-home .node-icon .node-icon-fix-verti { width: auto !important; height: auto !important; }
            html.smg-home .node-icon .node-icon-fix-verti img { width: 46px !important; height: 46px !important; max-width: 46px !important; max-height: 46px !important; }
            html.smg-home .node-main { min-width: 0 !important; width: 100% !important; }
            html.smg-home .node-title { font-size: 15px !important; font-weight: 700 !important; justify-content: center !important; line-height: 1.3 !important; }
            html.smg-home .node-title a { color: #fff !important; }
            html.smg-home .node-description { font-size: 12.5px !important; color: rgba(255,255,255,0.5) !important; margin-top: 3px; }
            /* tira último post, estatísticas e a lista de subitems (viram cards próprios) */
            html.smg-home .node-meta,
            html.smg-home .node-stats,
            html.smg-home .node-extra,
            html.smg-home .node-subNodesFlat { display: none !important; }

            /* remove ads/links promocionais e blocos de anúncio na home
               PERF: .smg-ad-block é marcado pelo JS (markHomeAdBlocks, 16-home) — substitui o
               :has(> .block-container > .block-body > .node--link), reavaliado a cada mutação da home */
            html.smg-home .node--link { display: none !important; }
            html.smg-home .block.smg-ad-block { display: none !important; }
            html.smg-home .samLinkUnit, html.smg-home .samCodeUnit { display: none !important; }

            /* daily login streak (SMG): o bloco é REMOVIDO pelo JS (layoutHomeSidebar) — as regras
               :has(.streakStats) que estilizavam o flash pré-boot foram deletadas (custavam invalidação
               por mutação na home inteira p/ um bloco que some no DOMContentLoaded). */
            html.smg-home .streakStats { display: flex !important; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 26px !important; }
            html.smg-home .streakStats > .pairs { text-align: center; margin: 0 !important; }
            html.smg-home .streakStats > .pairs dd strong { font-size: 23px !important; font-weight: 800 !important; line-height: 1; }
            html.smg-home .streakStats > .pairs dt { font-size: 11.5px !important; color: rgba(255,255,255,0.55) !important; margin-top: 3px; }
            html.smg-home .streakCounters { display: flex !important; gap: 6px !important; margin: 0 !important; }
            html.smg-home .streakCounters .pairs {
                display: flex !important; flex-direction: column; align-items: center; justify-content: center;
                width: 40px; height: 48px; margin: 0 !important;
                border-radius: 11px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            }
            html.smg-home .streakCounters .pairs dt { font-size: 11px !important; color: rgba(255,255,255,0.6) !important; }
            html.smg-home .dailyLogin-burningStreak { color: #ff8a3d !important; }
            html.smg-home .dailyLogin-bestStreak { color: #ffd24a !important; }

            /* ===== páginas de FÓRUM (forum_view) que listam SUB-FÓRUNS: mesmos cards da home ===== */
            /* escopado em .block--category → só pega o bloco de sub-fóruns; a lista de threads é estilizada à parte */
            html.smg-threadlist .block--category {
                margin-bottom: 28px !important; border: 0 !important; background: transparent !important;
                box-shadow: none !important; border-radius: 0 !important; overflow: visible !important;
            }
            html.smg-threadlist .block--category .block-container,
            html.smg-threadlist .block--category .uix_block-body--outer {
                background: transparent !important; border: 0 !important; box-shadow: none !important;
            }
            html.smg-threadlist .block--category .block-header {
                display: flex !important; align-items: center; position: relative;
                background: transparent !important; padding: 0 2px 12px !important; margin: 0 0 16px !important;
                font-size: 12.5px !important; font-weight: 700 !important; letter-spacing: .14em; text-transform: uppercase;
                color: rgba(255,255,255,0.55) !important; border: 0 !important; border-bottom: 1px solid var(--smg-bd) !important;
            }
            html.smg-threadlist .block--category .block-header a,
            html.smg-threadlist .block--category .uix_categoryTitle { color: #fff !important; }
            html.smg-threadlist .block--category .categoryCollapse--trigger { position: absolute !important; right: 16px; top: 50%; transform: translateY(-50%); margin: 0 !important; }
            /* .smg-has-nodes marcado pelo JS (markCategoryNodeBlocks, 15-listing) no lugar do :has(.node) */
            html.smg-threadlist .block--category.smg-has-nodes .block-body {
                display: grid !important; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
                gap: 14px !important; padding: 0 !important; background: transparent !important; border: 0 !important;
            }
            html.smg-threadlist .block--category .node {
                display: flex !important; cursor: pointer; border: 1px solid var(--smg-bd) !important;
                border-radius: 14px !important; background: var(--smg-s1) !important; overflow: visible !important;
                transition: background .16s ease, border-color .16s ease, transform .14s ease;
            }
            html.smg-threadlist .block--category .node:hover {
                background: var(--smg-s2) !important; border-color: var(--smg-bd2) !important; transform: translateY(-2px);
            }
            html.smg-threadlist .block--category .node-body {
                flex: 1 1 auto !important; display: flex !important; flex-direction: column !important;
                align-items: center !important; justify-content: center !important; text-align: center !important;
                gap: 9px !important; padding: 20px 14px !important;
            }
            html.smg-threadlist .block--category .node-icon {
                width: 66px !important; height: 66px !important; margin: 0 0 2px !important; padding: 9px !important; box-sizing: border-box !important;
                display: flex !important; align-items: center; justify-content: center;
                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px;
            }
            html.smg-threadlist .block--category .node-icon img { width: auto !important; height: auto !important; max-width: 100% !important; max-height: 100% !important; border-radius: 9px !important; object-fit: contain !important; }
            html.smg-threadlist .block--category .node-icon i { font-size: 28px; display: inline-flex; }
            html.smg-threadlist .block--category .node-icon i svg,
            html.smg-threadlist .block--category .node-icon > svg { width: 28px !important; height: 28px !important; color: rgba(255,255,255,0.75); }
            html.smg-threadlist .block--category .node-main { min-width: 0 !important; width: 100% !important; }
            html.smg-threadlist .block--category .node-title { font-size: 15px !important; font-weight: 700 !important; justify-content: center !important; line-height: 1.3 !important; white-space: normal !important; }
            html.smg-threadlist .block--category .node-title a { color: #fff !important; }
            html.smg-threadlist .block--category .node-description { font-size: 12.5px !important; color: rgba(255,255,255,0.5) !important; margin-top: 3px; white-space: normal !important; }
            html.smg-threadlist .block--category .node-meta,
            html.smg-threadlist .block--category .node-stats,
            html.smg-threadlist .block--category .node-extra,
            html.smg-threadlist .block--category .node-subNodesFlat { display: none !important; }
            @media (max-width: 600px) {
                html.smg-threadlist .block--category.smg-has-nodes .block-body { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 9px !important; }
                html.smg-threadlist .block--category .node-body { padding: 14px 10px !important; gap: 7px !important; }
                html.smg-threadlist .block--category .node-icon { width: 50px !important; height: 50px !important; padding: 7px !important; }
                html.smg-threadlist .block--category .node-title { font-size: 13.5px !important; }
            }

            `;
        const CSS_TOPBAR = `/* ================= TOPBAR REFORMULADA ================= */
            /* esconde a nav/header nativos e abre espaço pra nossa barra fixa */
            html.smg-topbar-on .p-header,
            html.smg-topbar-on .p-navSticky { display: none !important; }
            .u-scrollButtons, .js-scrollButtons { display: none !important; }   /* esconde os botões de scroll nativos do XF (a dock provê scroll topo/fundo) */
            html.smg-topbar-on body { padding-top: 76px !important; }   /* casa com a altura padrão da topbar (encolhe no scroll, mas o padding fica no topo → sem pulo) */
            /* deep-link (#post-X / âncora): cai ABAIXO da topbar fixa, não atrás dela (vale p/ o scroll do browser E o nosso pin) */
            html.smg-topbar-on :target { scroll-margin-top: 90px; }
            @media (max-width: 800px) { html.smg-topbar-on :target { scroll-margin-top: 66px; } }

            /* TOPBAR estilo ehentai: barra FIXA FULL-WIDTH (bg/borda de ponta a ponta),
               com o inner alinhado à MESMA largura do conteúdo (.p-body-inner) via margin:auto. */
            #smg-topbar-wrap {
                position: fixed; top: 0; left: 0; right: 0; width: 100%; z-index: 100;  /* nível de header (XF/UIX) → toasts/overlays ficam ACIMA */
            }
            #smg-topbar {
                position: relative; width: 100%; box-sizing: border-box;
                background: var(--smg-bg);
                border: 0; border-bottom: 1px solid rgba(255,255,255,0.08);
                box-shadow: 0 1px 0 rgba(255,255,255,0.02);
                transition: box-shadow .2s ease, background .2s ease;
            }
            /* leve sombra ao rolar */
            #smg-topbar-wrap.floating #smg-topbar { box-shadow: 0 6px 22px rgba(0,0,0,0.45); border-bottom-color: rgba(255,255,255,0.06); }
            /* inner = largura do conteúdo (80% no desktop), centralizado igual ao .p-body-inner */
            /* 3 zonas (flex: os lados NUNCA cortam): esquerda fit-content · centro cresce (search capada
               e centralizada no espaço livre) · direita fit-content. A search encolhe sozinha conforme
               sobra espaço entre logo/Discover e os ícones → não corta o resto em nenhuma resolução. */
            #smg-tb-inner {
                display: flex; align-items: center; gap: 16px;
                height: 76px; max-width: var(--smg-cw); margin: 0 auto; padding: 0; box-sizing: border-box;
                position: relative;   /* âncora do overlay de busca (ocupa a topbar) */
                transition: height .22s ease;
            }
            @media (min-width: 801px) { #smg-topbar-wrap.floating #smg-tb-inner { height: 56px; } }   /* encolhe no scroll down (.floating = scrollY>40); desktop só (mobile já é compacto) */
            @media (max-width: 800px) { #smg-tb-inner { max-width: calc(100% - 24px); height: 52px; } }
            /* SMG: cor da topbar #1a1a1a */
            html.smg-smg #smg-topbar { background: #1a1a1a; }
            .smg-tb-left { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; }
            .smg-tb-center { flex: 1 1 auto; min-width: 0; display: flex; justify-content: center; }
            .smg-tb-logo { display: flex; align-items: center; height: 36px; flex: 0 0 auto; margin-right: 6px; text-decoration: none; color: #fff; font-weight: 800; }
            .smg-tb-logo img { height: 30px; width: auto; max-width: 150px; object-fit: contain; display: block; }
            /* logo custom do SMG: wordmark "SMG" (G em rosa = acento da marca) */
            .smg-logo { display: inline-flex; align-items: center; }
            .smg-logo-word { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; color: #fff; line-height: 1; }
            .smg-logo-accent { color: #ff3d84; }
            .smg-tb-nav { display: flex; align-items: center; gap: 2px; }
            .smg-tb-item {
                position: relative;
                display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 12px;
                border-radius: 10px; border: none; background: transparent; color: rgba(255,255,255,0.82);
                font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; white-space: nowrap;
                transition: background .14s ease, color .14s ease;
            }
            .smg-tb-item:hover, .smg-tb-item.active { background: var(--smg-link-soft, rgba(255,255,255,0.09)); color: #fff; }
            /* badge inline (notificações como item do nav) */
            .smg-tb-badge--inline { position: static; top: auto; right: auto; margin-left: 1px; }
            .smg-tb-ico { display: flex; align-items: center; }
            .smg-tb-ico svg { width: 18px; height: 18px; fill: none !important; }
            .smg-tb-caret { display: flex; align-items: center; margin-left: -2px; }
            .smg-tb-caret svg { width: 14px; height: 14px; opacity: .55; fill: none !important; }
            .smg-tb-item.active .smg-tb-caret { transform: rotate(180deg); }

            .smg-tb-actions { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; }
            .smg-tb-act {
                position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
                border-radius: 10px; border: none; background: transparent; color: rgba(255,255,255,0.85);
                cursor: pointer; text-decoration: none; transition: background .14s ease, color .14s ease;
            }
            .smg-tb-act:hover { background: var(--smg-link-soft, rgba(255,255,255,0.1)); color: #fff; }
            .smg-tb-act svg { width: 20px; height: 20px; fill: none !important; }
            /* search bar CENTRAL: cresce com a zona do meio mas capa em 600px e centraliza */
            .smg-tb-search {
                display: flex; align-items: center; gap: 11px; width: 100%; max-width: 720px; height: 46px; padding: 0 16px; margin: 0;
                box-sizing: border-box; border-radius: 13px;
                border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);
                color: rgba(255,255,255,0.5); font-size: 15px; font-weight: 500; cursor: text; white-space: nowrap; text-align: left;
                transition: background .15s ease, border-color .15s ease;
            }
            .smg-tb-search:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }
            .smg-tb-search:focus-within { background: rgba(255,255,255,0.09); border-color: var(--smg-link, #ff77b2); }   /* foco na cor do tema */
            /* ===== experimento: nav CENTRAL + search como OVERLAY que ocupa a topbar ===== */
            .smg-tb-center--nav { justify-content: center; }
            .smg-tb-center--nav .smg-tb-nav { gap: 4px; }
            .smg-tb-search--overlay {
                position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%) scale(0.99);
                width: auto; max-width: none; margin: 0; z-index: 20;
                opacity: 0; pointer-events: none;   /* SEM visibility:hidden → o input continua focável p/ JS (visibility bloqueava o focus()) */
                transition: opacity .16s ease, transform .16s ease;
            }
            html.smg-search-open .smg-tb-search--overlay { opacity: 1; pointer-events: auto; transform: translateY(-50%) scale(1); }
            /* ao abrir a busca, recolhe logo/nav/ações atrás do overlay (busca toma a topbar) */
            html.smg-search-open .smg-tb-left,
            html.smg-search-open .smg-tb-center--nav,
            html.smg-search-open .smg-tb-actions { opacity: 0; pointer-events: none; transition: opacity .14s ease; }
            .smg-tb-search-close { flex: 0 0 auto; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; margin: 0 -6px 0 4px; border: 0; border-radius: 8px; background: transparent; color: rgba(255,255,255,0.55); cursor: pointer; transition: background .14s ease, color .14s ease; }
            .smg-tb-search-close:hover { background: rgba(255,255,255,0.12); color: #fff; }
            .smg-tb-search-close svg { width: 17px; height: 17px; fill: none !important; }
            /* SEARCH: chip de contexto (Reddit-style) + tooltip de comandos — valem na barra da topbar E no modal da dock */
            .smg-tb-search-chip, .smg-search-chip { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 5px; max-width: 42%; margin-right: 2px; padding: 4px 5px 4px 11px; border: 0; border-radius: 9px; background: var(--smg-link-soft, rgba(255,119,178,0.16)); color: var(--smg-link, #ff77b2); font: inherit; font-size: 13px; font-weight: 700; cursor: default; }
            .smg-tb-search-chip[hidden], .smg-search-chip[hidden] { display: none !important; }   /* o display:inline-flex de autor vencia o [hidden] do browser → chip vazio aparecia fora de tópico/fórum */
            .smg-search-chip-k { flex: 0 0 auto; padding: 1px 6px; border-radius: 5px; background: rgba(255,255,255,0.16); color: rgba(255,255,255,0.78); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; }   /* tag TÓPICO/FÓRUM antes do nome */
            .smg-search-chip-t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .smg-search-chip-x { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; cursor: pointer; opacity: 0.75; }
            .smg-search-chip-x:hover { background: rgba(255,255,255,0.2); opacity: 1; }
            .smg-search-chip-x svg { width: 12px; height: 12px; fill: none !important; }
            /* trio uniforme à direita da barra: ajuda (?) · busca avançada · config — mesmos tamanho/estilo */
            .smg-search-cmdbtn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; height: 24px; min-width: 26px; padding: 0 7px; margin: 0 2px 0 1px; border: 1px solid rgba(255,255,255,0.14); border-radius: 7px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.5); font: 600 13px/1 -apple-system, system-ui, sans-serif; cursor: pointer; transition: background .14s ease, color .14s ease, border-color .14s ease; }
            .smg-search-cmdbtn:hover { background: var(--smg-link-soft, rgba(255,119,178,0.16)); border-color: var(--smg-link, #ff77b2); color: var(--smg-link, #ff77b2); }
            .smg-search-tabkey { flex: 0 0 auto; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.55); font: 600 12px/1.4 -apple-system, system-ui, sans-serif; }
            .smg-search-adv, .smg-search-cfg { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; margin: 0 1px; border: 0; border-radius: 8px; background: transparent; color: rgba(255,255,255,0.55); cursor: pointer; text-decoration: none; transition: background .14s ease, color .14s ease; }
            .smg-search-adv:hover, .smg-search-cfg:hover { background: rgba(255,255,255,0.1); color: #fff; }
            .smg-search-adv svg, .smg-search-cfg svg { width: 18px; height: 18px; fill: none !important; }
            .smg-search-cfg.open { background: var(--smg-link-soft, rgba(255,119,178,0.18)); color: var(--smg-link, #ff77b2); }
            /* paleta de comandos (Tab) */
            .smg-search-cmd { position: fixed; z-index: 2147483647; display: none; flex-direction: column; gap: 1px; max-width: 360px; padding: 6px; border-radius: 12px; background: var(--smg-s1, #1c1d22); border: 1px solid var(--smg-bd, rgba(255,255,255,0.12)); box-shadow: 0 12px 34px rgba(0,0,0,0.6); }
            .smg-search-cmd.open { display: flex; }
            .smg-search-cmd-head { padding: 4px 8px 6px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); }
            .smg-search-cmd-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--smg-tx, #e7e7ea); font: inherit; font-size: 13.5px; text-align: left; cursor: pointer; }
            .smg-search-cmd-item:hover, .smg-search-cmd-item.sel { background: var(--smg-link-soft, rgba(255,119,178,0.14)); }
            .smg-search-cmd-item code { flex: 0 0 auto; min-width: 46px; padding: 2px 7px; border-radius: 6px; background: rgba(255,255,255,0.08); color: var(--smg-link, #ff77b2); font: 600 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; text-align: center; }
            .smg-search-cfg-portal { position: fixed; z-index: 2147483647; display: none; flex-direction: column; gap: 1px; min-width: 244px; max-width: 320px; padding: 7px; border-radius: 12px; background: var(--smg-s1, #1c1d22); border: 1px solid var(--smg-bd, rgba(255,255,255,0.12)); box-shadow: 0 12px 34px rgba(0,0,0,0.6); }
            .smg-search-cfg-portal.open { display: flex; }
            .smg-search-cfg-head { padding: 4px 8px 6px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); }
            .smg-search-cfg-row { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; font-size: 13.5px; color: var(--smg-tx, #e7e7ea); cursor: pointer; }
            .smg-search-cfg-row:hover { background: rgba(255,255,255,0.06); }
            .smg-search-cfg-row input { flex: 0 0 auto; width: 16px; height: 16px; accent-color: var(--smg-link, #ff77b2); cursor: pointer; }
            @media (max-width: 600px) { .smg-search-bar { gap: 6px; } .smg-search-kbd { display: none; } }   /* mobile: sem o badge "esc" (touch) + barra mais apertada com os ícones */
            @media (max-width: 600px) { .smg-tb-search--overlay { display: none !important; } }   /* mobile usa o modal da dock, não o overlay da topbar */
            .smg-tb-search-ico { display: inline-flex; align-items: center; flex: 0 0 auto; }
            .smg-tb-search-ico svg { width: 18px; height: 18px; opacity: 0.7; fill: none !important; }
            .smg-tb-search-input {
                flex: 1 1 auto; min-width: 0; height: 100%;
                border: 0; background: transparent; outline: none; padding: 0; margin: 0;
                color: #fff; font: inherit;
            }
            .smg-tb-search-input::placeholder { color: rgba(255,255,255,0.5); }
            .smg-tb-search-ph { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }
            .smg-tb-search-scan { display: inline-flex; align-items: center; flex: 0 0 auto; opacity: 0.4; }
            .smg-tb-search-scan svg { width: 17px; height: 17px; fill: none !important; }
            /* botão Buscar DENTRO do input — só aparece com o dropdown aberto (substitui o scan) */
            .smg-tb-search-go {
                flex: 0 0 auto; display: none; align-items: center; gap: 6px;
                height: 30px; padding: 0 13px; box-sizing: border-box; margin-right: -4px;
                border: 0; border-radius: 8px; background: #fff; color: #141414;
                font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
                transition: filter .15s ease, transform .12s ease;
            }
            .smg-tb-search-go-ic { display: inline-flex; }
            .smg-tb-search-go-ic svg { width: 15px; height: 15px; fill: none !important; stroke-width: 2.4; }
            .smg-tb-search-go:hover { filter: brightness(0.9); }
            .smg-tb-search-go:active { transform: scale(0.96); }
            html.smg-search-open .smg-tb-search-go { display: inline-flex; }
            html.smg-search-open .smg-tb-search-scan { display: none; }
            .smg-tb-badge {
                position: absolute; top: 3px; right: 3px; min-width: 16px; height: 16px; padding: 0 4px;
                border-radius: 999px; background: #e0245e; color: #fff; font-size: 10px; font-weight: 700;
                display: flex; align-items: center; justify-content: center; box-sizing: border-box;
                font-variant-numeric: tabular-nums;
            }
            /* badge de NOTICES: menor e neutro (cinza) — o vermelho fixo dava aparência de erro */
            .smg-tb-notices .smg-tb-badge {
                background: rgba(255,255,255,0.24); color: rgba(255,255,255,0.92);
                min-width: 13px; height: 13px; padding: 0 3px; font-size: 8.5px; top: 1px; right: 1px;
            }
            .smg-tb-divider { width: 1px; height: 26px; background: rgba(255,255,255,0.14); margin: 0 6px; flex: 0 0 auto; }
            .smg-tb-account {
                width: 38px; height: 38px; flex: 0 0 auto; border-radius: 50%; overflow: hidden; cursor: pointer; padding: 0;
                border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06);
                display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 15px;
                transition: border-color .14s ease;
            }
            .smg-tb-account:hover { border-color: rgba(255,255,255,0.4); }
            .smg-tb-account img { width: 100%; height: 100%; object-fit: cover; }
            .smg-tb-account .avatar { width: 100% !important; height: 100% !important; margin: 0 !important; border-radius: 50% !important; display: block; }
            .smg-tb-account .avatar > span { width: 100% !important; height: 100% !important; display: flex !important; align-items: center; justify-content: center; font-size: 15px; line-height: 1; }
            .smg-tb-cta {
                display: flex; align-items: center; gap: 7px; height: 40px; padding: 0 16px; margin-left: 5px; flex: 0 0 auto;
                border-radius: 11px; background: var(--smg-s3); color: #fff;
                font-size: 14px; font-weight: 700; text-decoration: none; border: 1px solid var(--smg-bd2);
                transition: filter .14s ease, transform .12s ease;
            }
            .smg-tb-cta:hover { filter: brightness(1.08); }
            .smg-tb-cta:active { transform: scale(0.97); }
            .smg-tb-cta svg { width: 17px; height: 17px; fill: none !important; }

            /* popovers agrupados */
            .smg-tb-pop {
                position: absolute; top: calc(100% + 8px); left: 0; min-width: 290px; max-width: 340px;
                padding: 8px; border-radius: 16px;
                background: var(--smg-s1);
                border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 22px 55px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.06);
                opacity: 0; visibility: hidden; transform: translateY(6px);
                transition: opacity .16s ease, transform .16s ease, visibility .16s;
                z-index: 5;
            }
            .smg-tb-pop.open { opacity: 1; visibility: visible; transform: translateY(0); }
            .smg-tb-pop--account { min-width: 230px; max-width: 280px; }
            .smg-tb-acchead { padding: 8px 10px 8px; font-size: 13px; font-weight: 700; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.07); margin-bottom: 4px; }
            .smg-tb-poprow { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 11px; text-decoration: none; color: #fff; transition: background .12s ease; }
            .smg-tb-poprow:hover { background: var(--smg-link-soft, rgba(255,255,255,0.08)); }
            .smg-tb-poprow--sm { gap: 11px; padding: 8px 10px; }
            .smg-tb-popico { flex: 0 0 auto; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.85); }
            .smg-tb-poprow--sm .smg-tb-popico { width: 28px; height: 28px; border-radius: 8px; }
            .smg-tb-popico svg { width: 18px; height: 18px; fill: none !important; }
            .smg-tb-poprow--sm .smg-tb-popico svg { width: 16px; height: 16px; }
            .smg-tb-poptext { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
            .smg-tb-poptitle { font-size: 14px; font-weight: 600; color: #fff; }
            .smg-tb-popdesc { font-size: 12px; color: rgba(255,255,255,0.5); }
            .smg-tb-popdiv { height: 1px; background: rgba(255,255,255,0.08); margin: 5px 8px; }
            /* ===== mega-menu do Discover (grid 2-col + painel destacado, estilo Vimeo) ===== */
            .smg-tb-pop--mega { min-width: 660px; max-width: 720px; padding: 18px; }
            .smg-tb-mega-cols { display: flex; gap: 18px; align-items: stretch; }
            .smg-tb-mega-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
            .smg-tb-mega-label { font-size: 11px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: rgba(255,255,255,0.38); padding: 0 8px 9px; }
            .smg-tb-mega-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px; }
            .smg-tb-megaitem { display: flex; align-items: center; gap: 11px; padding: 9px 10px; border-radius: 11px; text-decoration: none; color: #fff; transition: background .12s ease; }
            .smg-tb-megaitem:hover { background: var(--smg-link-soft, rgba(255,255,255,0.07)); }
            .smg-tb-megaico { flex: 0 0 auto; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.82); transition: background .14s ease, color .14s ease, transform .14s ease; }
            .smg-tb-megaitem:hover .smg-tb-megaico { background: var(--smg-link, #ff77b2); color: #fff; transform: translateY(-1px); }
            .smg-tb-megaico svg { width: 18px; height: 18px; fill: none !important; }
            .smg-tb-megatext { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
            .smg-tb-megatitle { font-size: 13.5px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .smg-tb-megadesc { font-size: 11.5px; color: rgba(255,255,255,0.42); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            /* painel destacado à direita (promove a Timeline) */
            .smg-tb-mega-feat { flex: 0 0 226px; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; text-decoration: none; background: var(--smg-s2); border: 1px solid var(--smg-bd); transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease; }
            .smg-tb-mega-feat:hover { border-color: var(--smg-bd2); transform: translateY(-2px); box-shadow: 0 14px 30px rgba(0,0,0,0.4); }
            .smg-tb-mega-feat-art { height: 112px; display: flex; align-items: center; justify-content: center; color: #fff; background: radial-gradient(120% 110% at 28% 18%, var(--smg-link, #ff77b2), transparent 62%), linear-gradient(155deg, var(--smg-s3), var(--smg-s1)); }
            .smg-tb-mega-feat-art svg { width: 34px; height: 34px; fill: none !important; opacity: .95; }
            .smg-tb-mega-feat-body { padding: 13px 15px 16px; display: flex; flex-direction: column; gap: 5px; }
            .smg-tb-mega-feat-title { font-size: 15px; font-weight: 800; color: #fff; }
            .smg-tb-mega-feat-desc { font-size: 12px; line-height: 1.45; color: rgba(255,255,255,0.5); }
            .smg-tb-mega-feat-cta { margin-top: 3px; display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; color: var(--smg-link, #ff77b2); }
            .smg-tb-mega-feat-cta svg { width: 14px; height: 14px; fill: none !important; }
            @media (max-width: 760px) {
                .smg-tb-pop--mega { min-width: 0; width: calc(100vw - 16px); max-width: calc(100vw - 16px); padding: 14px; }
                .smg-tb-mega-cols { flex-direction: column; gap: 14px; }
                .smg-tb-mega-feat { flex-basis: auto; }
                .smg-tb-mega-feat-art { height: 92px; }
                .smg-tb-mega-grid { grid-template-columns: 1fr; }
            }

            /* dropdown de listas (alertas / mensagens) — conteúdo nativo do XF embutido */
            .smg-tb-pop--list { min-width: 380px; max-width: 420px; padding: 6px; }
            .smg-tb-listbody { max-height: 62vh; overflow-y: auto; margin: 2px 0; }
            .smg-tb-listbody::-webkit-scrollbar { width: 8px; }
            .smg-tb-listbody::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 4px; }
            .smg-tb-loading { padding: 26px; text-align: center; color: rgba(255,255,255,0.5); font-size: 13px; }
            .smg-tb-listbody .listPlain { list-style: none; margin: 0; padding: 0; }
            .smg-tb-listbody .menu-row { display: block; padding: 9px 8px; border: none !important; border-radius: 10px; }
            .smg-tb-listbody .menu-row + .menu-row { border-top: 1px solid rgba(255,255,255,0.06) !important; }
            .smg-tb-listbody .menu-row:hover { background: rgba(255,255,255,0.06); }
            .smg-tb-listbody .contentRow { display: flex; gap: 10px; align-items: flex-start; }
            .smg-tb-listbody .contentRow-main { min-width: 0; font-size: 13px; line-height: 1.45; color: rgba(255,255,255,0.88); }
            .smg-tb-listbody .contentRow-minor { font-size: 11.5px; color: rgba(255,255,255,0.45); margin-top: 2px; }
            .smg-tb-listbody a { color: #cdd6e3; }
            .smg-tb-listbody .fauxBlockLink-blockLink { color: #fff; font-weight: 600; }
            /* notificações/mensagens no DESKTOP (dropdown): itens maiores e mais espaçados */
            .smg-tb-pop--list { min-width: 420px; max-width: 460px; }
            .smg-tb-pop--list .smg-tb-listbody .menu-row { padding: 13px 11px; }
            .smg-tb-pop--list .smg-tb-listbody .contentRow { gap: 13px; }
            .smg-tb-pop--list .smg-tb-listbody .contentRow-figure .avatar,
            .smg-tb-pop--list .smg-tb-listbody .contentRow-figure img { width: 42px !important; height: 42px !important; }
            .smg-tb-pop--list .smg-tb-listbody .contentRow-figure .avatar > span,
            .smg-tb-pop--list .smg-tb-listbody .contentRow-figure .avatar > img { width: 42px !important; height: 42px !important; font-size: 18px !important; line-height: 42px !important; }
            .smg-tb-pop--list .smg-tb-listbody .contentRow-main { font-size: 15px; line-height: 1.5; }
            .smg-tb-pop--list .smg-tb-listbody .contentRow-minor { font-size: 12.5px; margin-top: 3px; }
            .smg-tb-pop--list .smg-tb-acchead { font-size: 15px; padding: 10px 12px; }
            .smg-tb-popfoot { display: flex; justify-content: space-between; align-items: center; padding: 7px 6px 3px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.07); }
            .smg-tb-popfoot a { color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; text-decoration: none; padding: 5px 9px; border-radius: 8px; }
            .smg-tb-popfoot a:hover { background: rgba(255,255,255,0.09); color: #fff; }
            /* popover de NOTICES (avisos do header recolhidos no megafone) */
            .smg-tb-pop--notices { min-width: 340px; max-width: 380px; }
            .smg-notice-body { padding: 4px; }
            .smg-notice-item { padding: 12px 14px; border-radius: 11px; background: var(--smg-s1); border: 1px solid var(--smg-bd); color: rgba(255,255,255,0.85); font-size: 13.5px; line-height: 1.55; }
            .smg-notice-item + .smg-notice-item { margin-top: 8px; }
            .smg-notice-item a { color: var(--smg-link, #ff77b2); text-decoration: none; }
            .smg-notice-item a:hover { text-decoration: underline; }
            .smg-notice-item b, .smg-notice-item strong { color: #fff; }
            .smg-notice-item font[color="red"], .smg-notice-item [style*="color: red"], .smg-notice-item [style*="color:red"] { color: #ff7a7a !important; }
            .smg-notice-item img { max-width: 100%; height: auto; border-radius: 6px; }
            /* NOTICES recolhidos num iconezinho INLINE, à DIREITA do título do post (ou na barra de abas da home) + popover */
            .smg-notices { position: relative; display: inline-flex; align-items: center; vertical-align: middle; margin: 0 0 0 10px; }
            .smg-notices-btn {
                position: relative; display: inline-flex; align-items: center; justify-content: center;
                width: 30px; height: 30px; border-radius: 9px; box-sizing: border-box; flex: 0 0 auto;
                border: 1px solid var(--smg-bd2); background: var(--smg-s1); color: rgba(255,255,255,0.82);
                font-size: 17px; cursor: pointer; transition: background .15s ease, color .15s ease, border-color .15s ease;
            }
            .smg-notices-btn:hover { background: var(--smg-s2); color: #fff; border-color: var(--smg-link, #ff77b2); }
            .smg-notices-btn svg { fill: none !important; }
            .smg-notices-ico { display: inline-flex; }
            .smg-notices-badge {
                position: absolute; top: -6px; right: -6px; min-width: 17px; height: 17px; padding: 0 4px; box-sizing: border-box;
                border-radius: 999px; background: var(--smg-s3); color: rgba(255,255,255,0.82); border: 1px solid var(--smg-bd2);
                font-size: 10.5px; font-weight: 700; line-height: 1;
                display: flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums;
            }
            .smg-notices-pop {
                position: absolute; top: calc(100% + 8px); left: 0; z-index: 100;
                min-width: 300px; max-width: min(460px, 92vw); max-height: 60vh; overflow-y: auto; padding: 10px;
                background: var(--smg-s2); border: 1px solid var(--smg-bd2); border-radius: 14px;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 44px rgba(0,0,0,0.55);
                display: none;
            }
            .smg-notices.open .smg-notices-pop { display: block; }
            .smg-notices-head { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,0.5); padding: 4px 6px 10px; }
            /* na barra de abas da home: espaçamento vem do gap da barra · popover abre p/ a ESQUERDA (ícone fica à direita) */
            .smg-notices--bar { margin: 0; }
            /* na barra de seção (abas da home / header do Feed): megafone vira ícone-fantasma igual aos da topbar → integrado */
            .smg-notices--bar .smg-notices-btn { width: 38px; height: 38px; border-radius: 10px; border: 0; background: transparent; font-size: 19px; color: rgba(255,255,255,0.55); }
            .smg-notices--bar .smg-notices-btn:hover { background: var(--smg-link-soft, rgba(255,255,255,0.1)); color: #fff; border-color: transparent; }
            .smg-notices--bar .smg-notices-pop { left: auto; right: 0; }

            /* bottom sheets (mobile) — alertas / discover / conta. mesmo conteúdo dos dropdowns da topbar */
            .smg-sheet { position: fixed; inset: 0; z-index: 1000000; display: none; opacity: 0; background: rgba(0,0,0,0.5); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); transition: opacity .2s ease; }
            .smg-sheet.open { display: block; opacity: 1; }
            .smg-sheet .smg-csheet-panel {
                position: absolute; left: 0; right: 0; bottom: 0;
                padding: 8px 14px calc(14px + env(safe-area-inset-bottom));
                max-height: 80vh; display: flex; flex-direction: column;
                background: var(--smg-s1);
                border-radius: 20px 20px 0 0; border-top: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 -12px 44px rgba(0,0,0,0.62);
                transform: translateY(100%); transition: transform .28s cubic-bezier(.2,.8,.3,1);
            }
            .smg-sheet.open .smg-csheet-panel { transform: translateY(0); }
            .smg-csheet-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px 8px; font-size: 15px; font-weight: 700; color: #fff; }
            .smg-csheet-head a { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.6); text-decoration: none; }
            .smg-csheet-body { overflow-y: auto; }
            .smg-csheet-user { padding: 2px 4px 10px; font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.55); }
            /* alertas dentro do sheet (mobile): fonte e respiro bem maiores que o dropdown do desktop */
            .smg-sheet .smg-csheet-head { font-size: 18px; padding: 6px 6px 12px; }
            .smg-sheet .smg-csheet-head a { font-size: 14px; }
            .smg-sheet .smg-tb-listbody .menu-row { padding: 15px 12px; border-radius: 14px; }
            .smg-sheet .smg-tb-listbody .contentRow { gap: 14px; align-items: flex-start; }
            .smg-sheet .smg-tb-listbody .contentRow-figure .avatar,
            .smg-sheet .smg-tb-listbody .contentRow-figure img { width: 44px !important; height: 44px !important; }
            .smg-sheet .smg-tb-listbody .contentRow-figure .avatar > span,
            .smg-sheet .smg-tb-listbody .contentRow-figure .avatar > img { width: 44px !important; height: 44px !important; font-size: 19px !important; line-height: 44px !important; }
            .smg-sheet .smg-tb-listbody .contentRow-main { font-size: 16px !important; line-height: 1.5; }
            .smg-sheet .smg-tb-listbody .contentRow-main .label { font-size: 13px; }
            .smg-sheet .smg-tb-listbody .contentRow-minor { font-size: 13px !important; margin-top: 4px; }

            /* ===== alertas "Limpo" (estilo FB): seções Novas/Anteriores · nome · tags · autor+data · dot ===== */
            /* cor de link do tema do XF (cada fórum tem a sua) — composta dos componentes H/S/L do XF */
            .smg-tb-listbody .smg-alert-clean { --smg-link: hsl(var(--xf-linkColor--h, 330), var(--xf-linkColor--s, 70%), var(--xf-linkColor--l, 60%)); }
            .smg-tb-listbody .smg-alert-clean .contentRow-figure { display: none !important; }   /* a foto é do user, não do tópico */
            /* ícone de tipo à esquerda: publicação (cinza, foto) vs comentário (cor do site, balão) */
            .smg-tb-listbody .smg-alert-clean .smg-al-icon {
                flex: 0 0 auto; width: 30px; height: 30px; margin-top: 1px;
                display: flex; align-items: center; justify-content: center;
                border-radius: 8px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
            }
            .smg-tb-listbody .smg-alert-clean .smg-al-icon svg { width: 16px; height: 16px; }
            .smg-tb-listbody .smg-alert-clean .smg-al-icon--comment { color: var(--smg-link, #ff77b2); }
            .smg-sheet .smg-alert-clean .smg-al-icon { width: 38px; height: 38px; }
            .smg-sheet .smg-alert-clean .smg-al-icon svg { width: 20px; height: 20px; }
            .smg-tb-listbody .smg-alert-clean .contentRow-main { display: flex; flex-direction: column; gap: 4px; position: relative; padding-right: 24px; }
            /* cabeçalho de seção (Unread / Read) — discreto, em maiúsculas */
            .smg-tb-listbody .smg-alert-clean .smg-al-section {
                list-style: none; border: 0 !important; background: transparent !important;
                padding: 13px 12px 5px; font-size: 11px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: rgba(255,255,255,0.45);
            }
            .smg-tb-listbody .smg-alert-clean .smg-al-section:first-child { padding-top: 6px; }
            .smg-tb-listbody .smg-alert-clean .smg-al-section:hover { background: transparent !important; }
            /* linha do alerta: COMPACTA + conectada — hover na linha toda · não-lida com tinta do tema · divisória sutil */
            .smg-tb-listbody .smg-alert-clean li.alert { position: relative; padding: 11px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background .12s ease; }
            .smg-tb-listbody .smg-alert-clean li.alert .fauxBlockLink { position: static !important; }
            .smg-tb-listbody .smg-alert-clean li.alert,
            .smg-tb-listbody .smg-alert-clean li.alert .contentRow { background: transparent !important; box-shadow: none !important; }
            .smg-tb-listbody .smg-alert-clean li.alert:hover { background: rgba(255,255,255,0.045) !important; }
            .smg-tb-listbody .smg-alert-clean li.alert.is-unread { background: var(--smg-link-soft, rgba(255,255,255,0.05)) !important; }   /* não-lida = tinta do tema (agrupa visualmente) */
            .smg-tb-listbody .smg-alert-clean li.alert.is-unread:hover { box-shadow: inset 0 0 0 999px rgba(255,255,255,0.045) !important; }
            /* "Read" (lidas) levemente apagadas — hover devolve o contraste */
            .smg-tb-listbody .smg-alert-clean li.smg-al-old { opacity: 0.55; transition: opacity .15s ease; }
            .smg-tb-listbody .smg-alert-clean li.smg-al-old:hover { opacity: 1; }
            /* nome do tópico */
            .smg-tb-listbody .smg-alert-clean .smg-al-title {
                font-weight: 700; color: #fff !important; line-height: 1.3; font-size: 14px;
                display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
            }
            /* tags: chips nativos coloridos (cor da plataforma) — menores */
            .smg-al-tags { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
            .smg-al-tags .smg-al-chip {
                font-size: 10px !important; font-weight: 700 !important; letter-spacing: normal !important;
                padding: 2px 7px !important; margin: 0 !important; border-radius: 5px !important;
                line-height: 1.5 !important; white-space: nowrap;
            }
            .smg-al-tags .label-append { display: none !important; }
            /* publicado por @autor · data */
            .smg-al-by { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 11.5px; color: rgba(255,255,255,0.42); }
            .smg-al-by .smg-al-user { color: rgba(255,255,255,0.68) !important; font-weight: 600; text-decoration: none; white-space: nowrap; }
            .smg-al-by .smg-al-user:hover { color: #fff !important; text-decoration: underline; }
            .smg-al-time { margin-left: auto; white-space: nowrap; color: rgba(255,255,255,0.38) !important; font-size: 11px; }
            /* botão "marcar como lido" — SEMPRE visível nas não-lidas: dot rosa que vira ✓ no hover · clique persiste */
            .smg-al-read {
                position: absolute; right: 1px; top: 50%; transform: translateY(-50%); z-index: 2;
                width: 28px; height: 28px; padding: 0; border: 0; border-radius: 999px;
                background: transparent; cursor: pointer; -webkit-appearance: none; appearance: none;
                display: inline-flex; align-items: center; justify-content: center; transition: background .15s ease;
            }
            .smg-al-read::before {
                content: ""; width: 11px; height: 11px; border-radius: 50%; background: var(--smg-link, #ff77b2);
                line-height: 1; font-size: 0; font-weight: 800; transition: background .12s ease;
            }
            .smg-al-read:hover { background: rgba(255,255,255,0.12); }
            .smg-al-read:hover::before { content: "✓"; width: auto; height: auto; background: transparent; font-size: 17px; color: var(--smg-link, #ff77b2); }
            .smg-al-read:active { transform: translateY(-50%) scale(0.88); }
            .smg-al-read-txt { display: none; }   /* texto só no mobile (sheet) */
            html.smg-smg .smg-al-read::before { width: 8px; height: 8px; }   /* badge um pouco menor no socialmediagirls */
            html.smg-smg .smg-al-read:hover::before { font-size: 15px; }
            /* mobile (sheet): tudo um tico maior */
            .smg-sheet .smg-alert-clean li.alert { padding: 16px 40px 16px 14px; }
            .smg-sheet .smg-alert-clean .smg-al-section { font-size: 15px; }
            .smg-sheet .smg-al-title { font-size: 16px; }
            .smg-sheet .smg-al-by { font-size: 13.5px; }
            .smg-sheet .smg-al-time { font-size: 13px; }
            .smg-sheet .smg-al-tags .smg-al-chip { font-size: 12px !important; padding: 3px 10px !important; }
            /* mobile (sheet): vira pílula com o texto "Marcar como lido" — mais fácil de tocar */
            .smg-sheet .smg-alert-clean .contentRow-main { padding-right: 14px; }   /* no mobile o botão é pílula em fluxo, não precisa de gutter */
            .smg-sheet .smg-al-read {
                position: static; transform: none; width: auto; height: auto; right: auto;
                margin-top: 4px; padding: 9px 16px; border-radius: 10px;
                background: rgba(255,255,255,0.08); align-self: flex-start;
            }
            .smg-sheet .smg-al-read::before { display: none; }
            .smg-sheet .smg-al-read:active { transform: scale(0.96); }
            .smg-sheet .smg-al-read-txt { display: inline; color: var(--smg-link, #ff77b2); font-weight: 700; font-size: 14px; }

            @media (max-width: 992px) {
                /* tablet: some o Discover do canto, search central continua */
                .smg-tb-nav, .smg-tb-cta { display: none; }
                html.smg-topbar-on body { padding-top: 52px !important; }
            }
            /* mobile: topbar NÃO fixa; logo à esquerda + botão de notices à direita (busca/nav vivem na navbar inferior) */
            @media (max-width: 600px) {
                #smg-topbar-wrap { position: relative; }   /* não-fixa, mas ancora o popover de notices */
                #smg-topbar { border-bottom-color: rgba(255,255,255,0.06); }
                #smg-tb-inner { display: flex; max-width: calc(100% - 28px); height: 66px; justify-content: space-between; }
                .smg-tb-center { display: none; }
                /* header maior + logo maior */
                .smg-tb-logo { height: 48px; }
                .smg-tb-logo img { height: 40px; max-width: 62vw; }
                .smg-logo-word { font-size: 27px; }
                /* ações: mostra SÓ o botão de notices (avisos), alinhado à direita */
                .smg-tb-actions { display: flex !important; gap: 0; }
                .smg-tb-actions > * { display: none !important; }
                .smg-tb-actions > .smg-tb-notices { display: inline-flex !important; }
                .smg-tb-notices .smg-tb-ico { font-size: 23px; }
                html.smg-topbar-on body { padding-top: 0 !important; }
            }
            @media (max-width: 480px) {
                .smg-tb-pop--list { min-width: 0; width: calc(100vw - 16px); max-width: calc(100vw - 16px); }
            }

            /* no desktop a navegação principal vive na topbar; some da dock (mantém engrenagem + ações).
               no mobile esses botões continuam (viram a navbar inferior) */
            @media (min-width: 601px) {
                #smg-nav-home, #smg-nav-discover, #smg-nav-timeline, #smg-thread-search,
                #smg-nav-watched, #smg-nav-alerts, #smg-nav-user { display: none !important; }
                /* a engrenagem foi pra ESQUERDA → o grupo central (só nav, escondida no desktop) fica vazio: some ele + o divisor seguinte */
                #smg-post-nav-panel > .smg-nav-center,
                #smg-post-nav-panel > .smg-nav-center + .smg-nav-divider { display: none !important; }
                /* páginas sem ações (sobraria só a engrenagem): esconde a dock inteira no desktop */
                #smg-post-nav-wrapper.smg-dock-baronly { display: none !important; }
                #smg-post-nav-wrapper.smg-dock-baronly.smg-dock-show { display: block !important; }   /* reaberta pelo FAB */
            }
            /* FAB de configurações (canto inferior direito) — só é criado nas páginas baronly (JS),
               então é inline-flex por padrão; escondemos no mobile (navbar já tem a engrenagem) e quando a dock é reaberta */
            #smg-settings-fab {
                position: fixed; right: 18px; bottom: 18px; z-index: 999990;
                width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--smg-bd);
                background: var(--smg-s1); color: rgba(255,255,255,0.72); cursor: pointer;
                display: inline-flex; align-items: center; justify-content: center;
                box-shadow: 0 6px 20px rgba(0,0,0,0.45); transition: color .14s ease, background .14s ease, transform .12s ease;
            }
            #smg-settings-fab .smg-nav-ico { font-size: 21px; }   /* o svg é 1em → gear de 21px, igual a dock (com fill:none) */
            #smg-settings-fab:hover { color: #fff; background: var(--smg-s2); }
            #smg-settings-fab:active { transform: scale(0.92); }
            #smg-post-nav-wrapper.smg-dock-show ~ #smg-settings-fab { display: none !important; }
            @media (max-width: 600px) { #smg-settings-fab { display: none !important; } }   /* mobile: a navbar inferior já tem a engrenagem */

            /* ---- dock: container ---- */
            #smg-post-nav-wrapper {
                position: fixed;
                left: 50%;
                bottom: 20px;
                transform: translateX(-50%);
                z-index: 999999;
            }
            #smg-post-nav-panel {
                position: relative;
                z-index: 12; /* acima dos popovers (z 11) p/ os tooltips do hover aparecerem */
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 6px;
                padding: 8px;
                border-radius: 999px;
                background: rgba(26, 26, 26, 0.95); /* PERF: bg quase-opaco no lugar do backdrop-filter (blur 22px re-amostrava a página a CADA frame de scroll — dock fixa sobre a thread; mesmo fix já aplicado na topbar/feed) */
                border: 1px solid rgba(255,255,255,0.09);
                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,0.08),
                    0 12px 34px rgba(0,0,0,0.5),
                    0 2px 8px rgba(0,0,0,0.35);
                transition: transform .3s cubic-bezier(.2,.8,.3,1), opacity .3s ease;
            }
            #smg-post-nav-wrapper.manual-hidden #smg-post-nav-panel {
                transform: translateY(230%);
                opacity: 0;
                pointer-events: none;
            }
            .smg-nav-group {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 6px;
            }
            .smg-nav-divider {
                width: 1px;
                height: 26px;
                margin: 0 13px;
                flex: 0 0 auto;
                background: linear-gradient(180deg, transparent, rgba(255,255,255,0.22) 50%, transparent);
            }

            /* botão que abre o sheet — escondido no desktop, aparece no mobile */
            #smg-dock-sheet-btn { display: none; }

            /* ---- bottom sheet de opções (mobile) ---- */
            #smg-sheet { position: fixed; inset: 0; z-index: 1000000; display: none; opacity: 0; background: rgba(0,0,0,0.5); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); transition: opacity .2s ease; }
            #smg-sheet.open { display: block; opacity: 1; }
            .smg-sheet-panel {
                position: absolute; left: 0; right: 0; bottom: 0;
                padding: 10px 16px calc(20px + env(safe-area-inset-bottom));
                max-height: 82vh; overflow-y: auto;
                background: var(--smg-s1);
                border-radius: 20px 20px 0 0;
                border-top: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 -12px 44px rgba(0,0,0,0.62);
                transform: translateY(100%);
                transition: transform .28s cubic-bezier(.2,.8,.3,1);
            }
            #smg-sheet.open .smg-sheet-panel { transform: translateY(0); }
            .smg-sheet-grip { width: 40px; height: 5px; border-radius: 999px; background: rgba(255,255,255,0.25); margin: 4px auto 14px; }
            .smg-sheet-title { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,0.45); margin: 18px 4px 12px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.07); }
            .smg-sheet-body > .smg-sheet-title:first-child { margin-top: 2px; padding-top: 0; border-top: none; }
            .smg-sheet-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px 6px; }
            /* item = coluna transparente: botão CIRCULAR (mesma linguagem do dock desktop) + label embaixo */
            .smg-sheet-item { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 0; border: 0; background: transparent; color: #fff; cursor: pointer; -webkit-tap-highlight-color: transparent; }
            .smg-sheet-item.smg-sheet-disabled { opacity: .32; pointer-events: none; }
            .smg-sheet-ico {
                width: 46px; height: 46px; border-radius: 50%; box-sizing: border-box;
                display: flex; align-items: center; justify-content: center;
                border: 1px solid rgba(255,255,255,0.09); background: rgba(255,255,255,0.05);
                color: rgba(255,255,255,0.95); font-size: 20px; line-height: 1;
                transition: background .15s ease, border-color .15s ease, transform .12s ease;
            }
            .smg-sheet-ico svg { width: 1em; height: 1em; fill: none !important; }
            .smg-sheet-item:active .smg-sheet-ico { transform: scale(0.9); background: rgba(255,255,255,0.14); }
            /* estado ativo — espelha o .smg-active do dock (watch on, filtro on, etc.) */
            .smg-sheet-item.smg-active .smg-sheet-ico { background: var(--smg-link-strong, #d14d8f); border-color: var(--smg-link-strong, #d14d8f); color: #fff; }
            .smg-sheet-lbl { font-size: 10.5px; line-height: 1.2; text-align: center; color: rgba(255,255,255,0.7); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

            /* ---- dock: botões circulares (icon-only) ---- */
            .smg-nav-btn {
                position: relative;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                border: 1px solid rgba(255,255,255,0.07);
                background: rgba(255,255,255,0.045);
                color: rgba(255,255,255,0.95);
                box-sizing: border-box;
                text-decoration: none;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
                transition: transform .18s cubic-bezier(.2,.8,.3,1), background .16s ease, color .16s ease, border-color .16s ease, box-shadow .16s ease;
            }
            .smg-nav-ico {
                position: relative;   /* âncora do badge reativo (alertas) */
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: var(--smg-btn-fs, 19px);
                line-height: 1;
                filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));
            }
            /* badge reativo na dock/navbar (contador de alertas) */
            .smg-nav-badge {
                position: absolute; top: -6px; right: -9px; z-index: 2;
                min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box;
                border-radius: 999px; background: #e0245e; color: #fff;
                font-size: 10px; font-weight: 700; line-height: 1;
                display: flex; align-items: center; justify-content: center;
                font-variant-numeric: tabular-nums; pointer-events: none;
            }
            /* o CSS do fórum sobrescreve o atributo fill="none" e "enche" os SVGs;
               força outline em todos (o ponto do sino tem fill próprio e sobrevive) */
            .smg-nav-ico svg {
                fill: none !important;
            }
            .smg-nav-btn:not(:disabled):hover {
                background: rgba(255,255,255,0.13);
                color: #fff;
                border-color: rgba(255,255,255,0.2);
                transform: translateY(-4px) scale(1.07);
                box-shadow: 0 10px 20px rgba(0,0,0,0.45);
            }
            .smg-nav-btn:not(:disabled):active {
                transform: translateY(-1px) scale(0.96);
            }
            .smg-nav-btn:disabled {
                opacity: 0.3;
                cursor: default;
            }

            /* ---- dock: tooltip (label só no hover) ---- */
            .smg-nav-btn[data-label]::after {
                content: attr(data-label);
                position: absolute;
                bottom: calc(100% + 12px);
                left: 50%;
                transform: translateX(-50%) translateY(5px);
                padding: 5px 9px;
                border-radius: 8px;
                background: rgba(20,21,25,0.97);
                color: #fff;
                font-size: 12px;
                font-weight: 500;
                line-height: 1;
                white-space: nowrap;
                border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 8px 22px rgba(0,0,0,0.5);
                opacity: 0;
                pointer-events: none;
                transition: opacity .15s ease, transform .15s ease;
                z-index: 20;
            }
            .smg-nav-btn[data-label]:not(:disabled):hover::after {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            /* ---- dock: botão com label VISÍVEL (pílula) — ex.: sort mostrando "Data"/"Reações" nas 2 docks ---- */
            .smg-nav-btn.smg-nav-labeled { width: auto !important; border-radius: 20px !important; padding: 0 14px 0 12px !important; gap: 7px; }
            .smg-nav-btn.smg-nav-labeled::after { content: none !important; }   /* tem texto visível → não mostra o tooltip do hover */
            .smg-nav-btn-text { font-size: 13px; font-weight: 600; white-space: nowrap; letter-spacing: .01em; line-height: 1; }

            /* ---- dock: botão Ocultar (secundário, mais discreto) ---- */
            #smg-dock-hide {
                background: rgba(255,255,255,0.02);
                color: rgba(255,255,255,0.5);
            }
            #smg-dock-hide:not(:disabled):hover {
                background: rgba(255,255,255,0.13);
                color: #fff;
            }

            /* ---- dock: handle/aba pra reabrir quando oculta ---- */
            #smg-dock-handle {
                display: none;
                position: absolute;
                left: 50%;
                bottom: 0;
                transform: translateX(-50%);
                width: 60px;
                height: 28px;
                align-items: center;
                justify-content: center;
                border-radius: 999px;
                border: 1px solid rgba(255,255,255,0.12);
                background: var(--smg-s2);
                color: rgba(255,255,255,0.9);
                font-size: 16px;
                cursor: pointer;
                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,0.1),
                    0 10px 26px rgba(0,0,0,0.55);
                transition: transform .2s cubic-bezier(.2,.8,.3,1), color .15s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease;
            }
            #smg-dock-handle:hover {
                color: #fff;
                background: var(--smg-s3);
                border-color: rgba(255,255,255,0.22);
                transform: translateX(-50%) translateY(-3px);
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 14px 30px rgba(0,0,0,0.6);
            }
            #smg-dock-handle:active {
                transform: translateX(-50%) translateY(-1px) scale(0.97);
            }
            #smg-post-nav-wrapper.manual-hidden #smg-dock-handle {
                display: flex;
            }

            /* ---- goto: número da página dentro do botão (thread + galeria) ---- */
            #smg-post-goto .smg-nav-ico,
            #smg-gal-goto .smg-nav-ico {
                font-size: 15px;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                letter-spacing: -0.02em;
            }

            /* ---- goto: popover de pular pra uma página ---- */
            #smg-goto-pop {
                position: absolute;
                bottom: calc(100% + 12px);
                left: 50%;
                transform: translateX(-50%) translateY(6px);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 11px;
                min-width: 232px;
                padding: 16px 18px;
                border-radius: 18px;
                background: var(--smg-s1);
                border: 1px solid rgba(255,255,255,0.1);
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 44px rgba(0,0,0,0.62);
                backdrop-filter: blur(20px) saturate(170%);
                -webkit-backdrop-filter: blur(20px) saturate(170%);
                visibility: hidden;
                opacity: 0;
                pointer-events: none;
                transition: opacity .18s ease, transform .18s ease, visibility .18s;
                z-index: 11;
            }
            #smg-post-nav-wrapper.goto-open #smg-goto-pop {
                visibility: visible;
                opacity: 1;
                pointer-events: auto;
                transform: translateX(-50%) translateY(0);
            }
            .smg-goto-title {
                font-size: 11px;
                font-weight: 600;
                letter-spacing: .06em;
                text-transform: uppercase;
                color: rgba(255,255,255,0.55);
            }
            .smg-goto-stepper {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .smg-goto-step {
                flex: 0 0 auto;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 11px;
                border: 1px solid rgba(255,255,255,0.14);
                background: rgba(255,255,255,0.07);
                color: #fff;
                font-size: 22px;
                line-height: 1;
                cursor: pointer;
                user-select: none;
                transition: background .15s ease, border-color .15s ease, transform .12s ease;
            }
            .smg-goto-step:hover {
                background: rgba(255,255,255,0.16);
                border-color: rgba(255,255,255,0.28);
            }
            .smg-goto-step:active {
                transform: scale(0.9);
            }
            .smg-goto-input {
                width: 78px;
                height: 40px;
                padding: 0 8px;
                border-radius: 11px;
                border: 1px solid rgba(255,255,255,0.16);
                background: rgba(255,255,255,0.07);
                color: #fff;
                font-size: 19px;
                font-weight: 700;
                text-align: center;
                outline: none;
                font-variant-numeric: tabular-nums;
                -moz-appearance: textfield;
                appearance: textfield;
                transition: border-color .15s ease, background .15s ease;
            }
            /* esconde os spinners nativos (usamos os botões − / +) */
            .smg-goto-input::-webkit-outer-spin-button,
            .smg-goto-input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            .smg-goto-input:focus {
                border-color: rgba(255,255,255,0.45);
                background: rgba(255,255,255,0.1);
            }
            .smg-goto-max {
                font-size: 12px;
                color: rgba(255,255,255,0.5);
                white-space: nowrap;
            }
            .smg-goto-btn {
                width: 100%;
                padding: 10px 0;
                border-radius: 11px;
                border: 1px solid rgba(255,255,255,0.16);
                background: rgba(255,255,255,0.13);
                color: #fff;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: background .15s ease, border-color .15s ease, transform .12s ease;
            }
            .smg-goto-btn:hover {
                background: rgba(255,255,255,0.22);
                border-color: rgba(255,255,255,0.3);
            }
            .smg-goto-btn:active {
                transform: scale(0.98);
            }

            /* ---- search: dialog modal (command palette) + backdrop escuro ---- */
            #smg-search-overlay {
                position: fixed;
                inset: 0;
                z-index: 1000001;
                display: none;
                opacity: 0;
                background: var(--smg-scrim);
                -webkit-backdrop-filter: blur(6px) saturate(120%);
                backdrop-filter: blur(6px) saturate(120%);
                transition: opacity .2s ease;
            }
            #smg-search-overlay.open { display: block; opacity: 1; }
            #smg-search-pop {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 720px;
                max-width: calc(100vw - 32px);
                max-height: 86vh;
                overflow-y: auto;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                gap: 18px;
                padding: 24px 26px 26px;
                border-radius: 22px;
                background: var(--smg-s1);
                border: 1px solid rgba(255,255,255,0.12);
                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,0.10),
                    0 40px 90px rgba(0,0,0,0.72);
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.96);
                transition: opacity .22s ease, transform .26s cubic-bezier(.2,.9,.3,1);
            }
            #smg-search-overlay.open #smg-search-pop {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
            #smg-search-pop::-webkit-scrollbar { width: 8px; }
            #smg-search-pop::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 4px; }
            /* topbar: lupa + input + atalho + fechar (command palette, sem botão) */
            .smg-search-bar {
                display: flex; align-items: center; gap: 12px;
                height: 56px; padding: 0 8px 0 16px;
                border-radius: 14px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                transition: border-color .15s ease, background .15s ease;
            }
            .smg-search-bar:focus-within { border-color: var(--smg-link, #ff77b2); background: rgba(255,255,255,0.07); }   /* foco na cor do tema = mesmo focus da pílula da topbar */
            .smg-search-lupa { flex: 0 0 auto; display: flex; align-items: center; color: rgba(255,255,255,0.5); }
            .smg-search-lupa svg { width: 20px; height: 20px; fill: none; }
            .smg-search-input {
                flex: 1 1 auto; min-width: 0; height: 100%;
                border: none; background: transparent; outline: none;
                color: #fff; font-size: 17px; padding: 0;
            }
            .smg-search-input::placeholder { color: rgba(255,255,255,0.36); }
            .smg-search-kbd {
                flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
                min-width: 24px; height: 24px; padding: 0 7px;
                border-radius: 7px; border: 1px solid rgba(255,255,255,0.12);
                background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.45);
                font-size: 13px; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            }
            .smg-search-close {
                flex: 0 0 auto; width: 30px; height: 30px;
                display: flex; align-items: center; justify-content: center;
                border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);
                background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6); cursor: pointer;
                transition: background .15s ease, color .15s ease, transform .12s ease;
            }
            .smg-search-close:hover { background: rgba(255,255,255,0.13); color: #fff; }
            .smg-search-close:active { transform: scale(0.92); }
            .smg-search-close svg { width: 16px; height: 16px; fill: none; }

            /* filtros: label + chips de escopo + toggle "só títulos" + autor */
            /* seções separadas com header em maiúsculas (estilo command palette) */
            .smg-search-section { display: flex; flex-direction: column; gap: 11px; }
            .smg-search-shead { font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: rgba(255,255,255,0.4); }
            /* "Search in" / Filters: row único com scroll horizontal (não quebra linha) */
            .smg-search-scopes, .smg-search-toggles {
                display: flex; align-items: center; gap: 8px;
                flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden;
                scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch;
                margin: 0 -2px; padding: 2px;
            }
            .smg-search-scopes::-webkit-scrollbar, .smg-search-toggles::-webkit-scrollbar { display: none; }
            .smg-search-scopes .smg-chip, .smg-search-toggles .smg-chip { flex: 0 0 auto; }
            .smg-chip {
                display: inline-flex; align-items: center; gap: 7px;
                height: 40px; padding: 0 18px; box-sizing: border-box;
                border-radius: 999px; border: 1px solid rgba(255,255,255,0.1);
                background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.72);
                font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;
                transition: background .15s ease, border-color .15s ease, color .15s ease, transform .12s ease;
            }
            .smg-chip:hover { background: rgba(255,255,255,0.08); color: #fff; }
            .smg-chip:active { transform: scale(0.96); }
            .smg-chip.active {
                background: rgba(255,255,255,0.16);
                border-color: rgba(255,255,255,0.32); color: #fff;
            }
            .smg-chip-check { display: none; align-items: center; }
            .smg-chip-check svg { width: 15px; height: 15px; fill: none; }
            .smg-chip-toggle.active .smg-chip-check { display: inline-flex; }
            .smg-search-by {
                flex: 0 0 auto; width: 100%; min-width: 0; height: 44px; padding: 0 16px; box-sizing: border-box;
                border-radius: 12px; border: 1px solid rgba(255,255,255,0.14);
                background: rgba(255,255,255,0.05); color: #fff; font-size: 14px; outline: none;
                transition: border-color .15s ease, background .15s ease;
            }
            .smg-search-by::placeholder { color: rgba(255,255,255,0.38); }
            .smg-search-by:focus { border-color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.08); }
            /* toolbar de filtros (1 linha): escopo (menu) · só-títulos (switch) · autor (ícone) */
            .smg-search-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
            /* ESCOPO — botão + menu dropdown */
            .smg-search-scope { position: relative; }
            .smg-search-scope-btn {
                display: inline-flex; align-items: center; gap: 6px;
                height: 36px; padding: 0 10px 0 13px; box-sizing: border-box;
                border-radius: 10px; border: 1px solid rgba(255,255,255,0.14);
                background: rgba(255,255,255,0.05); color: #fff;
                font-size: 13.5px; font-weight: 600; cursor: pointer; white-space: nowrap;
                transition: background .15s ease, border-color .15s ease;
            }
            .smg-search-scope-btn:hover { background: rgba(255,255,255,0.09); }
            .smg-search-scope-btn.open { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.28); }
            .smg-search-scope-chev { display: inline-flex; opacity: 0.55; transition: transform .18s ease; }
            .smg-search-scope-chev svg { width: 14px; height: 14px; fill: none; }
            .smg-search-scope-btn.open .smg-search-scope-chev { transform: rotate(180deg); }
            #smg-search-pop.smg-scope-open { overflow: visible; }   /* menu de escopo aberto → pop não corta o dropdown (overflow do scroll cortava) */
            .smg-search-scope-list {
                position: absolute; top: calc(100% + 6px); left: 0; z-index: 50;
                min-width: 180px; padding: 6px;
                display: flex; flex-direction: column; gap: 2px;
                background: var(--smg-s1); border: 1px solid rgba(255,255,255,0.14); border-radius: 12px;
                box-shadow: 0 20px 48px rgba(0,0,0,0.6);
            }
            .smg-search-scope-list[hidden] { display: none; }
            .smg-search-scope-list button {
                display: flex; align-items: center; height: 36px; padding: 0 12px;
                border: 0; border-radius: 8px; background: transparent; color: rgba(255,255,255,0.78);
                font-size: 13.5px; font-weight: 500; cursor: pointer; text-align: left; white-space: nowrap;
                transition: background .12s ease, color .12s ease;
            }
            .smg-search-scope-list button:hover { background: rgba(255,255,255,0.08); color: #fff; }
            .smg-search-scope-list button.active { background: rgba(255,255,255,0.15); color: #fff; }
            /* ORDENAR — chip-toggle relevância ⇄ data (padrão do sort da thread: mostra o critério ATUAL, clique alterna).
               Vira order=date no POST da busca (= &o=date na URL de resultados). */
            .smg-search-order-btn {
                display: inline-flex; align-items: center; gap: 7px;
                height: 36px; padding: 0 12px; box-sizing: border-box;
                border-radius: 10px; border: 1px solid rgba(255,255,255,0.14);
                background: rgba(255,255,255,0.05); color: #fff;
                font-size: 13.5px; font-weight: 600; cursor: pointer; white-space: nowrap;
                transition: background .15s ease, border-color .15s ease;
            }
            .smg-search-order-btn:hover { background: rgba(255,255,255,0.09); }
            .smg-search-order-ic { display: inline-flex; opacity: 0.7; }
            .smg-search-order-ic svg { width: 15px; height: 15px; fill: none; }
            .smg-search-pop--drop .smg-search-toolbar { gap: 8px; }   /* dropdown (480px): toolbar ganhou o chip de ordenar → gap menor pra caber numa linha */
            /* SÓ TÍTULOS — switch */
            .smg-search-switch {
                display: inline-flex; align-items: center; gap: 9px; margin-left: auto;   /* empurra Só-títulos + autor pra DIREITA (escopo fica na esquerda) */
                height: 36px; padding: 0 4px; border: 0; background: transparent;
                color: rgba(255,255,255,0.82); font-size: 13.5px; font-weight: 600; cursor: pointer;
                transition: color .15s ease;
            }
            .smg-search-switch:hover { color: #fff; }
            .smg-search-switch-track {
                position: relative; flex: 0 0 auto; width: 38px; height: 22px; border-radius: 999px;
                background: rgba(255,255,255,0.18); transition: background .18s ease;
            }
            .smg-search-switch-thumb {
                position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%;
                background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.4);
                transition: transform .18s cubic-bezier(.3,.8,.3,1);
            }
            .smg-search-switch.on .smg-search-switch-track { background: #34c759; }
            .smg-search-switch.on .smg-search-switch-thumb { transform: translateX(16px); }
            /* AUTOR — ícone que revela o campo (.smg-search-by reusa o estilo existente) */
            .smg-search-author-btn {
                display: inline-flex; align-items: center; justify-content: center;
                width: 36px; height: 36px; box-sizing: border-box;
                border-radius: 10px; border: 1px solid rgba(255,255,255,0.14);
                background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.72); cursor: pointer;
                transition: background .15s ease, color .15s ease, border-color .15s ease;
            }
            .smg-search-author-btn:hover { background: rgba(255,255,255,0.09); color: #fff; }
            .smg-search-author-btn.open { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.28); color: #fff; }
            .smg-search-author-btn.has-value { background: #fff; color: #141414; border-color: #fff; }
            .smg-search-author-btn svg { width: 17px; height: 17px; fill: none; }
            .smg-search-author-wrap[hidden] { display: none; }
            /* footer: busca avançada (esq) · dica · botão Buscar primário (branco) */
            .smg-search-foot {
                display: flex; align-items: center; gap: 12px;
                margin-top: 2px; padding-top: 16px; border-top: 1px solid var(--smg-bd);
            }
            /* Avançado: agora é um ÍCONE na toolbar (ao lado do autor), com tooltip */
            .smg-search-adv {
                flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
                width: 36px; height: 36px; box-sizing: border-box;
                border-radius: 10px; border: 1px solid rgba(255,255,255,0.14);
                background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.72); cursor: pointer; text-decoration: none;
                transition: background .15s ease, color .15s ease, border-color .15s ease;
            }
            .smg-search-adv:hover { background: rgba(255,255,255,0.09); color: #fff; border-color: rgba(255,255,255,0.26); }
            .smg-search-adv svg { width: 16px; height: 16px; fill: none; }
            .smg-search-foot { display: none; }   /* rodapé (botão "Search") removido: digitar já busca (debounce) + "See all results" + Enter; o botão é redundante. Desktop já escondia; agora some no mobile tb. */
            .smg-search-hint { font-size: 12.5px; color: rgba(255,255,255,0.4); white-space: nowrap; margin-right: auto; }
            .smg-search-go {
                flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px;
                height: 42px; padding: 0 18px; box-sizing: border-box;
                border-radius: 12px; border: none;
                background: #fff; color: #141414;
                font-size: 14px; font-weight: 700; cursor: pointer;
                transition: filter .15s ease, transform .12s ease;
            }
            .smg-search-go-ic { display: inline-flex; }
            .smg-search-go-ic svg { width: 17px; height: 17px; fill: none; stroke-width: 2.4; }
            .smg-search-go:hover { filter: brightness(0.9); }
            .smg-search-go:active { transform: scale(0.97); }

            /* ---- painel de busca INLINE na página de RESULTADOS (search_results): input pra edição
               rápida da query + filtros (escopo · ordenar · só-títulos · autor) direto no header.
               Reusa os componentes do dialog (.smg-search-bar/-toolbar/-scope/-switch/-author).
               Largura TOTAL do conteúdo (alinha com a lista de resultados abaixo). ---- */
            #smg-rs-panel { display: flex; flex-direction: column; gap: 10px; margin: 14px 0 2px; }
            #smg-rs-panel .smg-search-bar { height: 50px; }
            #smg-rs-panel .smg-search-go { height: 36px; padding: 0 15px; border-radius: 9px; font-size: 13px; }
            #smg-rs-panel .smg-search-toolbar { gap: 8px; }
            @media (max-width: 600px) {
                #smg-rs-panel { margin-top: 10px; }
                #smg-rs-panel .smg-search-bar { height: 48px; }
            }

            /* ===== página de RESULTADOS da busca: lista nativa re-tematizada (cards no padrão do tema) =====
               Os .contentRow do XF (avatar · título · snippet · meta) seguem server-render — só a CASCA muda:
               o painelão nativo (.block-container) vira transparente e cada linha vira um card --smg-s1,
               mesma linguagem dos cards do resto do script. Vale pro scroll infinito (CSS pega as linhas novas).
               Seletores ancorados em .block-row → vencem as regras genéricas de .contentRow do smg-threadlist
               (que vêm DEPOIS na folha) por especificidade, não por ordem. */
            html.smg-search-page .p-body-pageContent .block .block-container { background: transparent !important; border: 0 !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; }
            html.smg-search-page .p-body-pageContent .block .block-body { display: flex; flex-direction: column; gap: 10px; padding: 0 !important; background: transparent !important; border: 0 !important; }
            html.smg-search-page .block-row.block-row--separated {
                margin: 0 !important; padding: 15px 18px !important;
                background: var(--smg-s1) !important; border: 1px solid var(--smg-bd) !important; border-radius: 14px !important;
                transition: border-color .14s ease, box-shadow .14s ease;
            }
            html.smg-smg.smg-search-page .block-row.block-row--separated { --smg-s1: hsl(0 0% 12.5%); }   /* SMG: mesma superfície dos cards de post (.smg-pc) */
            html.smg-search-page .block-row.block-row--separated:hover { border-color: var(--smg-bd2) !important; box-shadow: 0 6px 18px rgba(0,0,0,0.3); }
            html.smg-search-page .block-row .contentRow { align-items: flex-start !important; gap: 13px !important; }
            html.smg-search-page .block-row .contentRow-figure { flex: 0 0 auto; }
            html.smg-search-page .block-row .contentRow-main { min-width: 0 !important; }
            /* título: branco + bold; o termo buscado (em.textHighlight) ganha o ACENTO do tema */
            html.smg-search-page .block-row .contentRow-title { font-size: 15.5px !important; font-weight: 700 !important; line-height: 1.35 !important; margin: 1px 0 3px !important; }
            html.smg-search-page .block-row .contentRow-title a { color: #fff !important; text-decoration: none !important; }
            html.smg-search-page .block-row .contentRow-title a:hover { color: var(--smg-link, #ff77b2) !important; }
            html.smg-search-page .block-row .textHighlight { color: var(--smg-link, #ff77b2) !important; font-style: normal !important; background: none !important; }
            /* snippet: no máx 2 linhas, texto suave (URL crua não estoura o card) */
            html.smg-search-page .block-row .contentRow-snippet {
                font-size: 13px !important; line-height: 1.5 !important; color: rgba(255,255,255,0.62) !important;
                display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;
                margin: 0 0 7px !important;
            }
            /* meta (autor · nº do post · data · fórum/tópico): discreto, links sutis */
            html.smg-search-page .block-row .contentRow-minor { font-size: 12px !important; color: rgba(255,255,255,0.42) !important; margin-top: 5px !important; }
            html.smg-search-page .block-row .contentRow-minor a { color: rgba(255,255,255,0.62) !important; text-decoration: none !important; }
            html.smg-search-page .block-row .contentRow-minor a:hover { color: #fff !important; text-decoration: underline !important; }
            html.smg-search-page .block-row .contentRow-minor time { color: rgba(255,255,255,0.55); }
            html.smg-search-page .block-row .contentRow-minor .tagItem { font-size: 10.5px !important; padding: 2px 7px !important; border-radius: 5px !important; }
            @media (max-width: 600px) {
                html.smg-search-page .block-row.block-row--separated { padding: 12px 13px !important; border-radius: 12px !important; }
                html.smg-search-page .block-row .contentRow { gap: 10px !important; }
            }

            /* ===== página de BUSCA AVANÇADA (search_form): form nativo re-tematizado =====
               Só a CASCA muda (CSS) — os widgets do XF (tagify, autocomplete, datas, abas, sticky submit)
               seguem 100% nativos, sem JS nosso. Card único, labels EMPILHADOS (acima do campo, como nos
               nossos sheets), abas com sublinhado-accent (linguagem das abas da home), inputs no padrão. */
            html.smg-search-form form.block { color-scheme: dark; }   /* date picker/ícones nativos em claro */
            html.smg-search-form form.block .block-container {
                background: var(--smg-s1) !important; border: 1px solid var(--smg-bd) !important;
                border-radius: 18px !important; box-shadow: none !important; overflow: hidden;
            }
            html.smg-smg.smg-search-form form.block .block-container { --smg-s1: hsl(0 0% 12.5%); --smg-s2: hsl(0 0% 16%); --smg-s3: hsl(0 0% 21%); }   /* mesma superfície dos cards (.smg-pc) */
            /* abas (Search everything / threads / …): texto neutro + sublinhado-accent no ativo */
            html.smg-search-form .block-tabHeader {
                margin: 0 !important; padding: 4px 12px 0 !important;
                background: transparent !important; border: 0 !important; border-bottom: 1px solid var(--smg-bd) !important; box-shadow: none !important;
            }
            html.smg-search-form .block-tabHeader .hScroller-action { display: none !important; }   /* setas com gradiente do tema destoam do card; as abas rolam por swipe/scroll */
            html.smg-search-form .block-tabHeader .tabs-tab {
                position: relative; display: inline-flex; align-items: center; height: 48px; padding: 0 13px;
                background: transparent !important; border: 0 !important; box-shadow: none !important;
                color: rgba(255,255,255,0.55) !important; font-size: 14px !important; font-weight: 600 !important;
                text-decoration: none !important; white-space: nowrap; transition: color .15s ease;
            }
            html.smg-search-form .block-tabHeader .tabs-tab:hover { color: #fff !important; }
            html.smg-search-form .block-tabHeader .tabs-tab.is-active { color: #fff !important; font-weight: 700 !important; }
            html.smg-search-form .block-tabHeader .tabs-tab::before { content: none !important; }
            html.smg-search-form .block-tabHeader .tabs-tab::after {   /* substitui QUALQUER indicador nativo pelo nosso sublinhado */
                content: "" !important; position: absolute; left: 11px; right: 11px; bottom: -1px; height: 2.5px;
                border-radius: 3px 3px 0 0; background: var(--smg-link, #ff77b2); border: 0 !important; box-shadow: none !important;
                transform: scaleX(0); transition: transform .2s ease;
            }
            html.smg-search-form .block-tabHeader .tabs-tab.is-active::after { transform: scaleX(1); }
            /* corpo: form na LARGURA TOTAL do conteúdo — GRID de 2 colunas no desktop (Keywords, a 1ª
               row, atravessa as duas = campo principal); 1 coluna no estreito. Vale pra qualquer aba
               (threads/profile/DMs): a 1ª row é sempre Keywords e o resto flui no grid. */
            html.smg-search-form form.block .block-body {
                display: grid; grid-template-columns: 1fr; gap: 20px;
                padding: 22px 24px 24px !important; background: transparent !important; border: 0 !important;
            }
            @media (min-width: 901px) {
                html.smg-search-form form.block .block-body { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 40px; padding: 26px 30px 28px !important; }
                html.smg-search-form form.block .block-body > .formRow:first-child { grid-column: 1 / -1; }
            }
            html.smg-search-form form.block .block-body > .formRow {
                display: flex !important; flex-direction: column !important; gap: 8px;
                margin: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important;
            }
            html.smg-search-form form.block .block-body > .formRow > dt {
                display: block !important; width: auto !important; max-width: none !important;
                padding: 0 !important; margin: 0 !important; text-align: left !important; border: 0 !important; background: transparent !important;
            }
            html.smg-search-form form.block .formRow-labelWrapper { padding: 0 !important; margin: 0 !important; }
            html.smg-search-form form.block .formRow-label { font-size: 11.5px !important; font-weight: 700 !important; letter-spacing: .07em; text-transform: uppercase; color: rgba(255,255,255,0.5) !important; }
            html.smg-search-form form.block .block-body > .formRow > dd { display: block !important; width: auto !important; padding: 0 !important; margin: 0 !important; border: 0 !important; background: transparent !important; }
            html.smg-search-form form.block .formRow-explain { font-size: 12px !important; color: rgba(255,255,255,0.4) !important; margin-top: 6px !important; }
            /* inputs (texto, busca, data, select, tagify — todos têm .input) no padrão do tema */
            html.smg-search-form form.block .input {
                min-height: 44px; padding: 9px 14px; box-sizing: border-box;
                background: rgba(255,255,255,0.05) !important; border: 1px solid rgba(255,255,255,0.14) !important;
                border-radius: 11px !important; color: #fff !important; font-size: 14.5px !important; box-shadow: none !important;
            }
            html.smg-search-form form.block .input:focus, html.smg-search-form form.block .input:focus-within {
                border-color: var(--smg-link, #ff77b2) !important; background: rgba(255,255,255,0.07) !important; outline: none !important;
            }
            html.smg-search-form form.block select.input option { background: #1b1c20; color: #fff; }
            /* tagify (Tags / Without tags): chips no padrão (o tile do chip nativo vem de um ::before com box-shadow) */
            html.smg-search-form form.block .tagify__input { color: #fff; }
            html.smg-search-form form.block .tagify__tag > div::before { box-shadow: none !important; background: var(--smg-s3) !important; border-radius: 7px; }
            html.smg-search-form form.block .tagify__tag-text { color: #fff !important; }
            /* datas (Newer/Older than): linha flex limpa, rótulo do meio vira label pequeno */
            html.smg-search-form form.block .inputGroup { display: flex !important; align-items: center; gap: 10px; flex-wrap: wrap; }
            html.smg-search-form form.block .inputGroup .input--date { flex: 0 1 190px; width: auto !important; }
            html.smg-search-form form.block .inputGroup-text {
                display: inline-flex; padding: 0 !important; background: transparent !important; border: 0 !important; box-shadow: none !important;
                color: rgba(255,255,255,0.5) !important; font-size: 11.5px !important; font-weight: 700 !important; letter-spacing: .07em; text-transform: uppercase;
            }
            html.smg-search-form form.block .inputGroup-splitter { display: none !important; }
            /* lista do campo Keywords (input + 2 checkboxes) com respiro */
            html.smg-search-form form.block .inputList { display: flex; flex-direction: column; gap: 11px; margin: 0 !important; }
            html.smg-search-form form.block .inputList > li { margin: 0 !important; }
            /* checkboxes/radios (.iconic): caixinha própria + ACENTO quando marcado (o glifo nativo do XF é mantido) */
            html.smg-search-form form.block label.iconic {
                display: inline-flex !important; align-items: center; gap: 9px; padding: 0 !important; margin: 0 !important;
                color: rgba(255,255,255,0.78) !important; font-size: 13.5px !important; cursor: pointer;
            }
            html.smg-search-form form.block label.iconic > i {
                position: static !important; flex: 0 0 auto; width: 19px; height: 19px; margin: 0 !important; box-sizing: border-box;
                display: inline-flex !important; align-items: center; justify-content: center;
                border: 1px solid rgba(255,255,255,0.24) !important; border-radius: 6px !important;
                background: rgba(255,255,255,0.05) !important; box-shadow: none !important;
                transition: background .14s ease, border-color .14s ease;
            }
            html.smg-search-form form.block label.iconic--radio > i { border-radius: 50% !important; }
            html.smg-search-form form.block label.iconic > i::after { position: static !important; margin: 0 !important; font-size: 11px !important; line-height: 1 !important; }
            html.smg-search-form form.block label.iconic input:checked + i { background: var(--smg-link-strong, #d14d8f) !important; border-color: var(--smg-link-strong, #d14d8f) !important; }
            html.smg-search-form form.block label.iconic input:checked + i::after { color: #fff !important; }
            /* Order by (Relevance/Date): radios na HORIZONTAL */
            html.smg-search-form form.block .inputChoices { display: flex !important; flex-wrap: wrap; gap: 8px 22px; margin: 0 !important; padding: 0 !important; }
            html.smg-search-form form.block .inputChoices-choice { margin: 0 !important; padding: 0 !important; }
            /* rodapé (sticky submit): faixa integrada ao card + botão Search no acento, à direita */
            html.smg-search-form form.block .formSubmitRow { display: block !important; margin: 0 !important; border: 0 !important; }
            html.smg-search-form form.block .formSubmitRow > dt { display: none !important; }
            html.smg-search-form form.block .formSubmitRow > dd { display: block !important; padding: 0 !important; margin: 0 !important; }
            html.smg-search-form form.block .formSubmitRow-bar { background: var(--smg-s1) !important; border-top: 1px solid var(--smg-bd) !important; box-shadow: none !important; }
            html.smg-smg.smg-search-form form.block .formSubmitRow-bar { background: hsl(0 0% 12.5%) !important; }
            html.smg-search-form form.block .formSubmitRow-controls { display: flex; justify-content: flex-end; padding: 12px 24px !important; }
            html.smg-search-form form.block .formSubmitRow .button--primary {
                display: inline-flex !important; align-items: center; gap: 8px; height: 44px; padding: 0 24px !important;
                border: 0 !important; border-radius: 11px !important; box-shadow: none !important;
                background: var(--smg-link-strong, #d14d8f) !important; color: #fff !important;
                font-size: 14px !important; font-weight: 700 !important;
                transition: filter .14s ease, transform .12s ease;
            }
            html.smg-search-form form.block .formSubmitRow .button--primary:hover { filter: brightness(1.1); }
            html.smg-search-form form.block .formSubmitRow .button--primary:active { transform: scale(0.97); }
            @media (max-width: 600px) {
                html.smg-search-form form.block .block-body { padding: 16px 15px 18px !important; gap: 18px; }
                html.smg-search-form .block-tabHeader { padding: 2px 6px 0 !important; }
                html.smg-search-form .block-tabHeader .tabs-tab { height: 44px; padding: 0 10px; font-size: 13px !important; }
                html.smg-search-form form.block .formSubmitRow-controls { padding: 12px 15px !important; }
                html.smg-search-form form.block .formSubmitRow .button--primary { flex: 1 1 auto; justify-content: center; }   /* botão full-width (alvo de toque) */
            }

            /* ---- search em modo DROPDOWN (desktop): ancorado abaixo do input REAL da topbar, sem backdrop escuro ---- */
            #smg-search-overlay.smg-search-overlay--drop {
                background: transparent; -webkit-backdrop-filter: none; backdrop-filter: none; pointer-events: none;   /* não bloqueia a página nem o input da topbar */
            }
            #smg-search-pop.smg-search-pop--drop {
                position: fixed; transform: none; margin: 0;   /* top/left/width vêm inline do JS (ancorado ao input) */
                width: 480px; max-width: calc(100vw - 16px); max-height: min(70vh, 600px);
                padding: 16px 18px 0; gap: 14px; border-radius: 16px;   /* sem padding-bottom: o footer "Ver todos" cola no fundo (sticky) */
                pointer-events: auto;
            }
            #smg-search-overlay.open #smg-search-pop.smg-search-pop--drop { transform: none; }   /* sem o scale do modal; só o fade de opacity */
            .smg-search-pop--drop .smg-search-bar { display: none; }   /* no dropdown o input fica na topbar, não no pop */
            .smg-search-pop--drop .smg-search-go { display: none; }    /* o Buscar foi pro input da topbar (sobra Avançado + dica no rodapé) */

            /* histórico de buscas */
            .smg-search-history { display: flex; flex-direction: column; gap: 6px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); }
            .smg-search-history[hidden] { display: none; }
            /* estado vazio (sem histórico): evita o dropdown virar um toco só com a toolbar */
            .smg-search-empty { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 30px 16px 34px; text-align: center; }
            .smg-search-empty[hidden] { display: none; }
            .smg-search-empty-ic { display: flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 14px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); margin-bottom: 2px; }
            .smg-search-empty-ic svg { width: 22px; height: 22px; fill: none; }
            .smg-search-empty-t { font-size: 14.5px; font-weight: 600; color: rgba(255,255,255,0.72); }
            .smg-search-empty-s { font-size: 12.5px; color: rgba(255,255,255,0.4); }
            .smg-search-empty-hint { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }
            .smg-search-empty-hint code { padding: 3px 8px; border-radius: 6px; background: rgba(255,255,255,0.07); color: var(--smg-link, #ff77b2); font: 600 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
            .smg-search-hist-head { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
            .smg-search-hist-title { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.42); }
            .smg-search-hist-badge { color: rgba(255,255,255,0.4); font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
            .smg-search-hist-toggle, .smg-search-hist-clear {
                padding: 5px 10px; border-radius: 8px; border: none;
                background: transparent; color: rgba(255,255,255,0.55); font-size: 12px; font-weight: 600; cursor: pointer;
                transition: background .15s ease, color .15s ease;
            }
            .smg-search-hist-toggle { margin-left: auto; }
            .smg-search-hist-clear:hover, .smg-search-hist-toggle:hover { background: rgba(255,255,255,0.08); color: #fff; }
            .smg-search-hist-list { display: flex; flex-direction: column; gap: 1px; }
            .smg-search-hist-item {
                display: flex; align-items: center; gap: 12px; width: 100%;
                padding: 8px 10px; border-radius: 11px; border: none; cursor: pointer; text-align: left;
                background: transparent; color: #fff; transition: background .12s ease;
            }
            .smg-search-hist-item:hover { background: rgba(255,255,255,0.07); }
            .smg-search-hist-ico {
                flex: 0 0 auto; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
                border-radius: 9px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.55);
            }
            .smg-search-hist-ico svg { width: 16px; height: 16px; fill: none; }
            .smg-search-hist-q { flex: 1 1 auto; min-width: 0; font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .smg-search-hist-meta { flex: 0 0 auto; font-size: 11.5px; color: rgba(255,255,255,0.4); white-space: nowrap; }
            .smg-search-hist-remove {
                flex: 0 0 auto; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
                border-radius: 7px; border: none; background: transparent; color: rgba(255,255,255,0.4); cursor: pointer;
                opacity: 0; transition: opacity .12s ease, background .12s ease, color .12s ease;
            }
            .smg-search-hist-item:hover .smg-search-hist-remove { opacity: 1; }
            .smg-search-hist-remove:hover { background: rgba(255,255,255,0.14); color: #fff; }
            .smg-search-hist-remove svg { width: 14px; height: 14px; fill: none; }
            /* ações por linha do histórico: ↖ mandar pra barra · ↗ abrir no outro fórum · × remover (aparecem no hover da linha) */
            .smg-search-hist-acts { flex: 0 0 auto; display: flex; align-items: center; gap: 2px; }
            .smg-search-hist-act {
                flex: 0 0 auto; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
                border-radius: 7px; border: none; background: transparent; color: rgba(255,255,255,0.4); cursor: pointer;
                opacity: 0; transition: opacity .12s ease, background .12s ease, color .12s ease;
            }
            .smg-search-hist-item:hover .smg-search-hist-act { opacity: 1; }
            .smg-search-hist-act:hover { background: rgba(255,255,255,0.14); color: #fff; }
            .smg-search-hist-act svg { width: 14px; height: 14px; fill: none; }
            /* resultados da busca INLINE (mostrados no próprio dropdown) */
            .smg-search-results { display: flex; flex-direction: column; gap: 2px; }
            .smg-search-rloading { display: flex; align-items: center; justify-content: center; padding: 28px 0; }
            .smg-search-noresults { padding: 18px 4px; text-align: center; font-size: 13.5px; color: rgba(255,255,255,0.45); }
            .smg-search-result {
                display: flex; flex-direction: row; align-items: flex-start; gap: 11px;
                padding: 9px 11px; border-radius: 11px; text-decoration: none; color: #fff;
                transition: background .12s ease;
            }
            .smg-search-result:hover { background: rgba(255,255,255,0.08); }
            /* mata o underline FEIO do hover: o XF tem a:hover{text-decoration:underline} global → vazava na linha
               inteira do resultado E nos itens da nav central (Timeline/Following também são <a>). Escopado aos 2 containers. */
            #smg-topbar-wrap a, #smg-topbar-wrap a:hover, #smg-topbar-wrap a:focus,
            #smg-search-pop a, #smg-search-pop a:hover, #smg-search-pop a:focus { text-decoration: none !important; }
            .smg-search-result-fig { flex: 0 0 auto; width: 110px; height: 74px; border-radius: 9px; overflow: hidden; background: rgba(255,255,255,0.06); }
            .smg-search-result-fig img { width: 100% !important; height: 100% !important; object-fit: cover; display: block; transition: transform .3s cubic-bezier(.2,.7,.3,1); }
            .smg-search-result:hover .smg-search-result-fig img { transform: scale(1.06); }   /* zoom sutil da thumb no hover (igual aos cards da home) */
            .smg-search-result-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
            .smg-search-result-titlerow { display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap; }
            .smg-search-result-title { font-size: 15.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
            .smg-search-result-snippet { font-size: 14px; line-height: 1.45; color: rgba(255,255,255,0.72); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .smg-search-result-meta { font-size: 12.5px; color: rgba(255,255,255,0.42); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            /* highlight do termo buscado (title + snippet) */
            .smg-search-result mark.smg-search-hl { background: rgba(255,205,70,0.30); color: #fff; border-radius: 3px; padding: 0 1px; font-weight: 700; }
            /* "Ver todos" = FOOTER FIXO (sticky no fundo do dropdown; resultados rolam atrás) */
            .smg-search-result-all {
                position: sticky; bottom: 0; z-index: 3;
                display: flex; align-items: center; justify-content: center; gap: 7px;
                margin: 6px -18px 0; padding: 13px 18px;
                background: var(--smg-s1); border-top: 1px solid var(--smg-bd);
                font-size: 13px; font-weight: 700; text-decoration: none; color: rgba(255,255,255,0.82);
                transition: color .14s ease, gap .14s ease;
            }
            .smg-search-result-all:hover { color: #fff; gap: 11px; }
            .smg-search-result-all svg { width: 15px; height: 15px; fill: none; }
            .smg-search-pop--drop .smg-search-history { padding-bottom: 12px; }   /* sem footer (mostrando histórico) → respiro no fundo */
            /* expandido: lista SCROLLÁVEL (substituiu a paginação ‹ ›) — chunks renderizam conforme rola */
            .smg-search-hist-list--scroll {
                max-height: min(48vh, 400px); overflow-y: auto;
                overscroll-behavior: contain;   /* o fim da lista não rola a página/pop por trás */
                padding-right: 4px; margin-right: -4px;   /* scrollbar não come a largura das linhas */
            }
            .smg-search-hist-list--scroll::-webkit-scrollbar { width: 8px; }
            .smg-search-hist-list--scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 4px; }
            /* lupa: ringue um tico mais fino + garante sem preenchimento */
            #smg-thread-search .smg-nav-ico svg {
                fill: none;
                stroke-width: 2;
            }

            /* ---- modo feed (tiktok) ---- */
            #smg-feed {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100vh;
                z-index: 2147483601;
                display: none;
                background: #000;
            }
            #smg-feed.open { display: block; }

            /* aviso único: galeria/feed têm navegação própria. z-index ACIMA do feed/galeria (scrim cobre tudo). */
            #smg-navnotice { position: fixed; inset: 0; z-index: 2147483646; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(0,0,0,0.62); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); }
            .smg-navnotice-card { max-width: 420px; width: 100%; background: var(--smg-s1); border: 1px solid var(--smg-bd); border-radius: 16px; padding: 22px 22px 18px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
            .smg-navnotice-title { font-size: 17px; font-weight: 700; color: rgba(255,255,255,0.95); margin: 0 0 9px; }
            .smg-navnotice-text { font-size: 14px; line-height: 1.5; color: rgba(255,255,255,0.62); margin: 0 0 18px; }
            .smg-navnotice-ok { display: block; width: 100%; padding: 11px; border: 0; border-radius: 10px; background: var(--smg-link, #ff77b2); color: #fff; font-size: 14px; font-weight: 650; cursor: pointer; }
            .smg-navnotice-ok:hover { filter: brightness(1.06); }
            .smg-feed-track {
                height: 100%;
                width: 100%;
                overflow: hidden;
                position: relative;
                touch-action: none;
            }
            .smg-feed-reel {
                display: flex;
                flex-direction: column;
                will-change: transform;
            }
            .smg-feed-slide {
                height: 100vh;
                width: 100%;
                flex: 0 0 auto;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .smg-feed-media {
                max-width: 100vw;
                max-height: 100vh;
                object-fit: contain;
                user-select: none;
                -webkit-user-drag: none;
                cursor: zoom-in;
            }
            .smg-feed-media.smg-zoomed { cursor: grab; }
            .smg-feed-media.smg-grabbing { cursor: grabbing; }
            .smg-feed-embed {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .smg-feed-embed iframe {
                width: 95vw;
                max-width: 95vw;
                aspect-ratio: 16 / 9;
                max-height: 95vh;
                border: 0;
                border-radius: 8px;
                background: #000;
                pointer-events: none; /* deixa wheel/touch passarem pro feed (senão o iframe engole o scroll) */
            }
            .smg-feed-embed.is-live iframe { pointer-events: auto; } /* tap/click libera os controles do player */
            /* redgifs no feed = nosso <video> (mesmo padrão de pointer-events do iframe) */
            .smg-feed-embed .smg-rg {
                height: 90vh !important;
                width: auto !important;
                max-width: 95vw !important;
                max-height: 90vh !important;
                margin: 0 !important;
                pointer-events: none;
            }
            .smg-feed-embed.is-live .smg-rg { pointer-events: auto; }
            /* no feed, os CONTROLES sempre clicáveis (mesmo sem is-live) — senão os botões não funcionam lá */
            .smg-feed-embed .smg-rgc-bottom, .smg-feed-embed .smg-rgc-flash button, .smg-feed-embed .smg-rgc-src { pointer-events: auto; }
            .smg-feed-embed .smg-rgc-over { display: none; }   /* no feed já é o visualizador → esconde o botão "abrir no visualizador" */
            /* no feed o player enche a caixa de 90vh (sizing por ALTURA) — sobrepõe o height:auto/max-height do inline */
            .smg-feed-embed .smg-rg-v { height: 100% !important; max-height: none !important; }
            .smg-feed-empty {
                color: rgba(255,255,255,0.6);
                font-size: 16px;
            }
            .smg-feed-nav {
                position: absolute;
                right: 18px;
                z-index: 5;
                width: 48px;
                height: 48px;
                font-size: 22px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                cursor: pointer;
                color: #fff;
                border: 1px solid rgba(255,255,255,0.15);
                background: rgba(20,20,24,0.82);   /* PERF: era backdrop-filter blur(6px) (repintava a cada frame de scroll do reel) — sólido semi-opaco fica visualmente igual sobre mídia escura */
                transition: background .15s ease, transform .12s ease;
            }
            .smg-feed-nav:hover { background: rgba(42,42,50,0.85); }
            .smg-feed-nav:active { transform: scale(0.9); }
            .smg-feed-nav svg { width: 1em; height: 1em; display: block; }
            .smg-feed-prev { top: calc(50% - 56px); }
            .smg-feed-next { top: calc(50% + 8px); }
            .smg-feed-close {
                position: absolute;
                top: 16px;
                right: 18px;
                z-index: 5;
                width: 54px;
                height: 54px;
                font-size: 27px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                cursor: pointer;
                color: #fff;
                border: 1px solid rgba(255,255,255,0.15);
                background: rgba(20,20,24,0.82);   /* PERF: era backdrop-filter blur(6px) (repintava a cada frame de scroll do reel) — sólido semi-opaco fica visualmente igual sobre mídia escura */
                transition: background .15s ease, transform .12s ease;
            }
            .smg-feed-close:hover { background: rgba(42,42,50,0.85); }
            .smg-feed-close:active { transform: scale(0.92); }
            .smg-feed-close svg { width: 1em; height: 1em; display: block; }
            .smg-feed-counter {
                position: absolute;
                top: 20px;
                left: 18px;
                z-index: 5;
                padding: 6px 14px;
                border-radius: 999px;
                background: rgba(20,20,24,0.82);   /* PERF: sem backdrop-filter (repintava no scroll do reel) */
                border: 1px solid rgba(255,255,255,0.12);
                color: #fff;
                font-size: 13px;
                font-weight: 600;
            }

            /* ---- mobile: a dock vira uma navbar full-width colada embaixo ---- */
            @media (max-width: 600px) {
                #smg-post-nav-wrapper {
                    left: 0;
                    right: 0;
                    bottom: 0;
                    transform: none;
                    width: 100%;
                }
                /* respiro pra navbar fixa não cobrir o fim do conteúdo */
                body { padding-bottom: calc(60px + env(safe-area-inset-bottom)) !important; }
                /* rede de segurança: conteúdo largo (embed/tabela) no post não vira scroll horizontal da página */
                .bbWrapper, .message-userContent { overflow-x: hidden; }
                /* navbar flat estilo Instagram: barra sólida, sem chips nos ícones */
                #smg-post-nav-panel {
                    width: 100%;
                    max-width: none;
                    box-sizing: border-box;
                    flex-wrap: nowrap;
                    overflow: visible;
                    gap: 0;
                    padding: 7px 10px;   /* respiro lateral ≈ inner da topbar (os ícones não colam na borda) */
                    padding-bottom: calc(7px + env(safe-area-inset-bottom));
                    border: none;
                    border-top: 1px solid rgba(255,255,255,0.06);   /* mesmo tom da borda da topbar */
                    border-radius: 0;
                    background: var(--smg-bg); /* mesma cor da topbar */
                    box-shadow: none;
                    justify-content: space-around;
                }
                /* navbar = 5 itens (espelha a topbar c/ Timeline): Discover/Watched saem da barra mas
                   FICAM no DOM — o sheet de opções (Explore) e o wireSheet do Discover dependem deles */
                #smg-nav-discover, #smg-nav-watched { display: none !important; }
                #smg-post-nav-panel::-webkit-scrollbar {
                    display: none;
                }
                .smg-nav-group {
                    gap: 4px;
                    flex: 0 0 auto;
                }
                .smg-nav-divider {
                    margin: 0 9px;
                }
                /* ícones flat estilo Instagram: sem fundo/borda; cada item ocupa fatia igual da barra */
                .smg-nav-btn {
                    flex: 1 1 0;
                    width: auto;
                    min-width: 0;
                    height: 46px;
                    padding: 0;
                    background: transparent;
                    border: none;
                    border-radius: 0;
                    box-shadow: none;
                }
                .smg-nav-btn:not(:disabled):hover {
                    background: transparent;
                    border-color: transparent;
                    box-shadow: none;
                    transform: none;
                    color: #fff;
                }
                .smg-nav-btn:not(:disabled):active {
                    transform: scale(0.86);
                }
                .smg-nav-ico {
                    font-size: 26px;
                    filter: none;
                    color: #fff;                             /* ícones brancos (ativo = preenchido, inativo = contorno) */
                    transition: transform .12s ease;
                }
                .smg-nav-ico svg { stroke-width: 1.9; }       /* traço mais leve na navbar */
                /* item da página atual: ícone na COR DO TEMA (verde/rosa), em CONTORNO (sem preencher → sem "blob"/gradiente) */
                .smg-nav-btn.smg-nav-active .smg-nav-ico { color: var(--smg-link, #ff77b2); }
                /* profile = avatar circular, MAIOR que os ícones, com borda fixa; anel branco quando ativo */
                .smg-nav-ico--avatar { width: 31px; height: 31px; border-radius: 50%; overflow: visible; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.5); }
                .smg-nav-ico--avatar .avatar,
                .smg-nav-ico--avatar img,
                .smg-nav-ico--avatar .avatar > img,
                .smg-nav-ico--avatar .avatar > span {
                    width: 31px !important; height: 31px !important; min-width: 0 !important;
                    border-radius: 50% !important; overflow: hidden; display: block;
                    font-size: 14px !important; line-height: 31px !important; text-align: center;
                }
                .smg-nav-active .smg-nav-ico--avatar { box-shadow: 0 0 0 2px var(--smg-bg), 0 0 0 4px var(--smg-link, #ff77b2); }
                .smg-nav-btn[data-label]::after {
                    display: none;
                }
                #smg-dock-handle {
                    width: 56px;
                    height: 26px;
                    font-size: 15px;
                }
                /* search no mobile */
                #smg-search-pop { gap: 14px; padding: 16px; border-radius: 18px; }
                .smg-search-bar { height: 48px; gap: 11px; border-radius: 13px; }   /* = pílula da busca da topbar (.smg-tb-search): mesma altura/raio/gap */
                .smg-search-input { font-size: 16px; }
                .smg-search-kbd { display: none; }
                .smg-search-hint { display: none; } /* no touch, Enter/botão basta */
                .smg-search-go { height: 46px; padding: 0 22px; } /* compacto (não ocupa a linha toda) */
                .smg-search-hist-remove, .smg-search-hist-act { opacity: 1; } /* sem hover no touch */
                .smg-feed-tools { right: 70px; gap: 7px; }
                .smg-feed-tool { width: 40px; height: 40px; font-size: 18px; }
                /* lados, divisores e config saem da navbar (config volta pro sheet) */
                #smg-post-nav-panel .smg-side,
                #smg-post-nav-panel .smg-nav-divider,
                /* engrenagem some do navbar (vive no sheet de opções no mobile) */
                #smg-nav-settings { display: none; }
                /* central vira a navbar: seus filhos viram itens diretos da barra, espaçados
                   (ordem vem do DOM: início · salvos · buscar · seguidas · alertas) */
                #smg-post-nav-panel > .smg-nav-center { display: contents; }
                /* o botão de opções do post vira um FAB flutuante acima da navbar, à direita —
                   MENOR e na MESMA linguagem da navbar/topbar (mesmo bg/borda, sombra leve) em vez
                   do cinza próprio com sombra pesada que destoava do resto */
                #smg-dock-sheet-btn {
                    position: fixed;
                    right: 12px;
                    bottom: calc(64px + env(safe-area-inset-bottom));
                    z-index: 13;
                    display: flex;
                    width: 36px;
                    height: 36px;
                    min-width: 0;
                    padding: 0;
                    border-radius: 50%;
                    background: var(--smg-bg);
                    border: 1px solid rgba(255,255,255,0.1);
                    box-shadow: 0 3px 10px rgba(0,0,0,0.4);
                }
                #smg-dock-sheet-btn .smg-nav-ico { font-size: 17px; color: rgba(255,255,255,0.85); }
            }

            /* ---- settings / filtro por autor / filtro da listagem: popovers (padrão do search) ---- */
            #smg-settings-pop, #smg-filter-pop, #smg-listfilter-pop {
                position: absolute;
                bottom: calc(100% + 12px);
                left: 50%;
                width: 420px;
                max-width: calc(100vw - 20px);
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 16px 18px;
                border-radius: 16px;
                background: var(--smg-s1);
                border: 1px solid rgba(255,255,255,0.1);
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 44px rgba(0,0,0,0.62);
                backdrop-filter: blur(20px) saturate(170%);
                -webkit-backdrop-filter: blur(20px) saturate(170%);
                visibility: hidden;   /* PERF: fechado SAI da render tree (opacity:0 sozinho mantinha a camada de blur viva em toda thread/lista — o #smg-goto-pop já fazia certo) */
                opacity: 0;
                pointer-events: none;
                transform: translateX(-50%) translateY(6px);
                transition: opacity .18s ease, transform .18s ease, visibility .18s;
                z-index: 11;
            }
            #smg-post-nav-wrapper.settings-open #smg-settings-pop,
            #smg-post-nav-wrapper.filter-open #smg-filter-pop,
            #smg-post-nav-wrapper.listfilter-open #smg-listfilter-pop {
                visibility: visible;
                opacity: 1;
                pointer-events: auto;
                transform: translateX(-50%) translateY(0);
            }
            /* ---- filtro da listagem (fórum) ---- */
            #smg-listfilter-pop { width: 470px; max-height: 72vh; overflow-y: auto; }
            #smg-listfilter-pop::-webkit-scrollbar { width: 8px; }
            #smg-listfilter-pop::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 4px; }
            .smg-lf-body { display: flex; flex-direction: column; gap: 14px; }
            .smg-lf-row { display: flex; flex-direction: column; gap: 7px; }
            .smg-lf-label { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); }
            .smg-lf-chips { display: flex; flex-wrap: wrap; gap: 7px; }
            .smg-lf-group { width: 100%; margin-top: 4px; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,0.35); }
            .smg-lf-prefix { padding: 0 9px; height: 30px; }
            .smg-lf-prefix .label { font-size: 12px; }
            .smg-lf-select, .smg-lf-input {
                height: 38px; padding: 0 12px; box-sizing: border-box;
                border-radius: 10px; border: 1px solid rgba(255,255,255,0.16);
                background: rgba(255,255,255,0.06); color: #fff; font-size: 14px; outline: none;
            }
            .smg-lf-select { cursor: pointer; width: 100%; }
            .smg-lf-select option { background: #1b1c20; color: #fff; }
            .smg-lf-input:focus, .smg-lf-select:focus { border-color: rgba(255,255,255,0.45); }
            .smg-lf-sort { display: flex; gap: 8px; }
            .smg-lf-sort .smg-lf-select { flex: 1; }
            .smg-lf-apply {
                margin-top: 2px; width: 100%; padding: 11px; border-radius: 11px;
                border: 1px solid var(--smg-bd2); background: var(--smg-s3);
                color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
                transition: filter .15s ease, transform .12s ease;
            }
            .smg-lf-apply:hover { filter: brightness(1.08); }
            .smg-lf-apply:active { transform: scale(0.98); }
            .smg-pop-title {
                font-size: 11px;
                font-weight: 600;
                letter-spacing: .06em;
                text-transform: uppercase;
                color: rgba(255,255,255,0.55);
            }
            /* ===== painel de settings (estilo painel do Twitter): header + busca + rail de categorias + seções + footer ===== */
            #smg-settings-pop { width: 460px; max-height: 86vh; padding: 0 !important; gap: 0 !important; overflow: hidden; }
            #smg-settings-pop .smg-set-body { min-height: 0; }
            .smg-set-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
            .smg-set-logo { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 9px; background: var(--smg-link, #ff77b2); display: flex; align-items: center; justify-content: center; }
            .smg-set-logo svg { width: 17px; height: 17px; fill: none !important; color: #fff; }
            .smg-set-title { flex: 1; min-width: 0; font-size: 16px; font-weight: 800; color: #fff; }
            .smg-set-x { flex: 0 0 auto; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: rgba(255,255,255,0.55); cursor: pointer; }
            .smg-set-x:hover { background: rgba(255,255,255,0.12); color: #fff; }
            .smg-set-x svg { width: 16px; height: 16px; fill: none !important; }
            .smg-set-search { display: flex; align-items: center; gap: 8px; margin: 11px 14px; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); }
            .smg-set-search:focus-within { border-color: var(--smg-link, #ff77b2); }
            .smg-set-searchic { flex: 0 0 auto; display: inline-flex; color: rgba(255,255,255,0.5); }
            .smg-set-searchic svg { width: 16px; height: 16px; fill: none !important; }
            .smg-set-q { flex: 1; min-width: 0; border: 0; background: transparent; outline: none; color: #fff; font: inherit; font-size: 14px; }
            .smg-set-q::placeholder { color: rgba(255,255,255,0.45); }
            .smg-set-body { display: flex; min-height: 0; flex: 1; }
            .smg-set-rail { display: flex; flex-direction: column; gap: 4px; padding: 10px 8px; border-right: 1px solid rgba(255,255,255,0.08); flex: 0 0 auto; }
            .smg-set-tab { width: 40px; height: 40px; border: 0; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: rgba(255,255,255,0.5); cursor: pointer; transition: background .14s ease, color .14s ease; }
            .smg-set-tab svg { width: 20px; height: 20px; fill: none !important; }
            .smg-set-tab:hover { background: rgba(255,255,255,0.07); color: #fff; }
            .smg-set-tab.active { background: var(--smg-link-soft, rgba(255,119,178,0.16)); color: var(--smg-link, #ff77b2); }
            .smg-set-content { flex: 1; min-width: 0; overflow-y: auto; max-height: 58vh; padding: 2px 10px 12px; }
            .smg-set-sectitle { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,0.45); padding: 12px 6px 6px; }
            .smg-set-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 9px 6px; border-radius: 9px; cursor: pointer; }
            .smg-set-row:hover { background: rgba(255,255,255,0.05); }
            .smg-set-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
            .smg-set-label { font-size: 13.5px; font-weight: 600; color: rgba(255,255,255,0.92); line-height: 1.3; }
            .smg-set-desc { font-size: 11.5px; color: rgba(255,255,255,0.5); line-height: 1.4; }
            .smg-set-row .smg-switch { margin-top: 1px; }
            .smg-switch { position: relative; flex: 0 0 auto; width: 40px; height: 23px; border-radius: 999px; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.12); transition: background .16s ease; }
            .smg-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 50%; background: #fff; transition: transform .18s cubic-bezier(.2,.8,.3,1); box-shadow: 0 1px 3px rgba(0,0,0,.4); }
            .smg-set-row input { position: absolute; opacity: 0; pointer-events: none; }
            .smg-set-row input:checked + .smg-switch { background: var(--smg-link, #ff77b2); border-color: var(--smg-link, #ff77b2); }
            .smg-set-row input:checked + .smg-switch::after { transform: translateX(17px); }
            .smg-set-slider { display: flex; flex-direction: column; gap: 9px; padding: 11px 6px; }
            .smg-set-slidertop { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
            .smg-set-val { flex: 0 0 auto; color: var(--smg-link, #ff77b2); font-weight: 700; background: var(--smg-link-soft, rgba(255,119,178,0.12)); border-radius: 6px; padding: 1px 8px; font-size: 13px; min-width: 38px; text-align: center; font-variant-numeric: tabular-nums; }
            .smg-set-slider input[type=range] { width: 100%; accent-color: var(--smg-link, #ff77b2); cursor: pointer; }
            .smg-set-empty { padding: 30px 16px; text-align: center; color: rgba(255,255,255,0.45); font-size: 13.5px; }
            .smg-set-foot { display: flex; align-items: center; gap: 10px; padding: 11px 16px; border-top: 1px solid rgba(255,255,255,0.08); }
            .smg-set-reset { border: 0; background: transparent; color: rgba(255,255,255,0.55); font: inherit; font-size: 13px; font-weight: 600; padding: 5px 9px; border-radius: 7px; cursor: pointer; }
            .smg-set-reset:hover { color: #fb7185; background: rgba(244,63,94,0.1); }
            .smg-set-reload { border: 1px solid var(--smg-bd2); background: var(--smg-s3); color: #fff; font: inherit; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 9px; cursor: pointer; }
            .smg-set-reload:hover { filter: brightness(1.12); }
            .smg-set-ver { margin-left: auto; color: rgba(255,255,255,0.35); font-size: 12px; }
            /* filtro por autor */
            .smg-filter-quick { display: flex; flex-wrap: wrap; gap: 8px; }
            .smg-filter-chip { padding: 7px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.07); color: #fff; font-size: 13px; cursor: pointer; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .smg-filter-chip:hover { background: rgba(255,255,255,0.16); }
            .smg-filter-chip.active { background: var(--smg-s3); border-color: var(--smg-bd2); }
            .smg-filter-row { display: flex; gap: 8px; }
            .smg-filter-input { flex: 1 1 auto; min-width: 0; height: 38px; padding: 0 12px; box-sizing: border-box; border-radius: 10px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.07); color: #fff; font-size: 14px; outline: none; }
            .smg-filter-input:focus { border-color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.1); }
            .smg-filter-apply, .smg-filter-clear { flex: 0 0 auto; height: 38px; padding: 0 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.13); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
            .smg-filter-apply:hover, .smg-filter-clear:hover { background: rgba(255,255,255,0.22); }
            .smg-filter-clear { width: 100%; }

            /* ---- backdrop dos popovers do dock (vira o scrim do bottom sheet no mobile) ---- */
            .smg-dock-backdrop {
                position: fixed; inset: 0; z-index: 15;
                background: var(--smg-scrim);
                -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
                opacity: 0; visibility: hidden; pointer-events: none;
                transition: opacity .22s ease, visibility .22s;
            }

            `;
        const CSS_MOBILE = `/* ============================================================
               MOBILE: search + filtros viram BOTTOM SHEETS (modernos)
               ============================================================ */
            @media (max-width: 600px) {
                /* scrim aparece quando um popover do dock está aberto */
                #smg-post-nav-wrapper.settings-open .smg-dock-backdrop,
                #smg-post-nav-wrapper.filter-open .smg-dock-backdrop,
                #smg-post-nav-wrapper.listfilter-open .smg-dock-backdrop {
                    opacity: 1; visibility: visible; pointer-events: auto;
                }

                /* config / filtro por autor / filtro da listagem: ancorados embaixo, full-width.
                   opacity fixa em 1 → slide puro (sem fade ao fechar); show/hide via transform + pointer-events */
                #smg-settings-pop, #smg-filter-pop, #smg-listfilter-pop {
                    position: fixed; left: 0; right: 0; bottom: 0; top: auto;
                    width: 100%; max-width: 100%; max-height: 86vh; z-index: 20;
                    border: none; border-top: 1px solid rgba(255,255,255,0.1);
                    border-radius: 24px 24px 0 0;
                    padding: 10px 18px calc(20px + env(safe-area-inset-bottom));
                    gap: 14px; opacity: 1;
                    transform: translateY(100%);
                    transition: transform .32s cubic-bezier(.2,.85,.25,1);
                    box-shadow: 0 -16px 50px rgba(0,0,0,0.6);
                }
                #smg-post-nav-wrapper.settings-open #smg-settings-pop,
                #smg-post-nav-wrapper.filter-open #smg-filter-pop,
                #smg-post-nav-wrapper.listfilter-open #smg-listfilter-pop {
                    transform: translateY(0);
                }

                /* search: vira bottom sheet (mantém o #smg-search-overlay como scrim) */
                #smg-search-pop {
                    top: auto; bottom: 0; left: 0; right: 0;
                    width: 100%; max-width: 100%; max-height: 88vh;
                    padding: 10px 18px calc(20px + env(safe-area-inset-bottom));
                    border: none; border-top: 1px solid rgba(255,255,255,0.1);
                    border-radius: 24px 24px 0 0;
                    transform: translateY(100%);
                    transition: transform .32s cubic-bezier(.2,.85,.25,1), opacity .2s ease;
                }
                #smg-search-overlay.open #smg-search-pop { opacity: 1; transform: translateY(0); }

                /* grip (puxador) no topo de cada sheet */
                #smg-search-pop::before, #smg-settings-pop::before,
                #smg-filter-pop::before, #smg-listfilter-pop::before {
                    content: ''; flex: 0 0 auto; width: 40px; height: 5px;
                    border-radius: 999px; background: rgba(255,255,255,0.25);
                    margin: 2px auto 10px;
                }

                /* alvos de toque maiores + cantos mais macios */
                .smg-lf-select, .smg-lf-input { height: 48px; font-size: 16px; border-radius: 13px; }
                .smg-lf-apply { padding: 15px; font-size: 16px; border-radius: 14px; }
                .smg-filter-input { height: 48px; font-size: 16px; border-radius: 13px; }
                .smg-filter-apply, .smg-filter-clear { height: 48px; font-size: 15px; border-radius: 13px; }
                .smg-chip, .smg-filter-chip { height: 40px; font-size: 14px; }
                .smg-set-list { max-height: 60vh; }
            }
            /* botão da dock "ativo" (filtro/escolha ligada) */
            .smg-nav-btn.smg-active { background: var(--smg-link-strong, #d14d8f); border-color: var(--smg-link-strong, #d14d8f); color: #fff; }   /* toggle ativo (watch/filtro): acento fundo + texto branco */

            /* ---- scroll infinito: separador de página ---- */
            .smg-inf-sep { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 10px 0; color: rgba(127,127,127,0.85); font-size: 12px; letter-spacing: .05em; text-transform: uppercase; }
            .smg-inf-sep::before, .smg-inf-sep::after { content: ""; height: 1px; flex: 1; background: linear-gradient(90deg, transparent, rgba(127,127,127,.4), transparent); }

            /* ---- listas (fórum / seguidas / busca): thumb maior + alinhamento ---- */
            html.smg-threadlist .structItem--thread,
            html.smg-threadlist .contentRow {
                display: flex !important;
                align-items: center !important;
                gap: 14px !important;
            }
            /* .dcThumbnail = simpcity (bg-image) · .dtt-thread-thumbnail = socialmediagirls (<img> real) */
            html.smg-threadlist .dcThumbnail,
            html.smg-threadlist .dtt-thread-thumbnail { width: 210px !important; height: 132px !important; border-radius: 8px !important; flex: 0 0 auto !important; overflow: hidden !important; }
            html.smg-threadlist .dtt-thread-thumbnail img,
            html.smg-threadlist .dcThumbnail img { width: 100% !important; height: 100% !important; object-fit: cover !important; }
            html.smg-threadlist .structItem-cell--icon:not(.structItem-cell--iconEnd) { flex: 0 0 auto !important; width: auto !important; height: auto !important; }
            html.smg-threadlist .structItem-cell--main,
            html.smg-threadlist .contentRow-main { flex: 1 1 auto !important; min-width: 0 !important; text-align: left !important; }
            html.smg-threadlist .structItem-title,
            html.smg-threadlist .contentRow-title { font-size: 16px !important; line-height: 1.3 !important; }
            /* divisores internos das células (verticais) sem cor — mantém só o divisor entre os cards */
            html.smg-threadlist .structItem--thread .structItem-cell { border-color: transparent !important; }
            /* MOBILE: lista compacta — thumb menor, esconde a coluna de "último post" (espremia o título a ~0) */
            @media (max-width: 600px) {
                html.smg-threadlist .structItem--thread,
                html.smg-threadlist .contentRow { gap: 11px !important; align-items: flex-start !important; }
                html.smg-threadlist .dcThumbnail,
                html.smg-threadlist .dtt-thread-thumbnail { width: 92px !important; height: 70px !important; }
                html.smg-threadlist .structItem-cell--latest { display: none !important; }
                html.smg-threadlist .structItem-cell--main,
                html.smg-threadlist .contentRow-main { flex: 1 1 auto !important; min-width: 0 !important; width: auto !important; }
                html.smg-threadlist .structItem-title,
                html.smg-threadlist .structItem-title a,
                html.smg-threadlist .contentRow-title {
                    font-size: 14.5px !important; white-space: normal !important;
                    word-break: normal !important; overflow-wrap: break-word !important;
                }
            }

            /* ---- barra de paginação + ações: 1 linha, justify-between, no nosso estilo ---- */
            html.smg-threadlist .block-outer {
                display: flex !important; align-items: center !important;
                justify-content: space-between !important; flex-wrap: wrap !important; gap: 10px !important;
                margin-bottom: 12px !important;
            }
            html.smg-threadlist .block-outer-main { flex: 1 1 auto !important; min-width: 0 !important; }
            html.smg-threadlist .block-outer-opposite { flex: 0 0 auto !important; margin: 0 !important; }
            /* mobile: quebra em 2 linhas (paginação em cima, ações tipo "Mark Forums Read" embaixo) */
            @media (max-width: 600px) {
                html.smg-threadlist .block-outer { row-gap: 12px !important; }
                html.smg-threadlist .block-outer-main,
                html.smg-threadlist .block-outer-opposite {
                    flex: 1 1 100% !important; width: 100% !important; min-width: 0 !important;
                    display: flex !important; flex-wrap: wrap !important; justify-content: flex-start !important;
                }
                /* paginador: esconde o completo, mostra só o simples (evita duplicação) */
                html.smg-threadlist .pageNavWrapper .pageNav { display: none !important; }
                html.smg-threadlist .pageNavWrapper .pageNavSimple { display: flex !important; }
            }
            /* pager encostado à esquerda (o XF centraliza por padrão) */
            html.smg-threadlist .pageNavWrapper,
            html.smg-threadlist .pageNav,
            html.smg-threadlist .pageNavSimple { justify-content: flex-start !important; margin: 0 !important; }
            html.smg-threadlist .pageNav { display: flex !important; align-items: center; gap: 6px; }
            /* mostra só UM paginador (completo no desktop) — evita o pager completo + o "1 of N" juntos */
            html.smg-threadlist .pageNavWrapper .pageNavSimple { display: none !important; }
            html.smg-threadlist .pageNav-main {
                display: flex !important; flex-wrap: wrap; align-items: center;
                gap: 6px !important; margin: 0 !important; padding: 0 !important; list-style: none !important;
            }
            html.smg-threadlist .pageNav-page, html.smg-threadlist .pageNav-jump { margin: 0 !important; }
            /* pílulas no nosso estilo */
            html.smg-threadlist .pageNav-page > a,
            html.smg-threadlist .pageNav-jump,
            html.smg-threadlist .pageNavSimple-el {
                display: inline-flex !important; align-items: center; justify-content: center;
                min-width: 34px; height: 34px; padding: 0 11px; box-sizing: border-box;
                border-radius: 9px !important; border: 1px solid rgba(255,255,255,0.08) !important;
                background: rgba(255,255,255,0.05) !important; color: rgba(255,255,255,0.85) !important;
                font-size: 14px; font-weight: 600; text-decoration: none !important; line-height: 1;
                transition: background .14s ease, color .14s ease, border-color .14s ease;
            }
            html.smg-threadlist .pageNav-page > a:hover,
            html.smg-threadlist .pageNav-jump:hover,
            html.smg-threadlist .pageNavSimple-el:hover {
                background: rgba(255,255,255,0.12) !important; color: #fff !important; border-color: rgba(255,255,255,0.2) !important;
            }
            html.smg-threadlist .pageNav-page--current > a {
                background: var(--smg-s3) !important;
                border-color: var(--smg-bd2) !important; color: #fff !important;
            }
            html.smg-threadlist .pageNav-page--skip > a { background: transparent !important; border-color: transparent !important; }
            /* mata o "tracinho/indicador verde" do tema na página atual (fica no <li>, ::after e/ou borda) */
            html.smg-threadlist .pageNavWrapper .pageNav-page,
            html.smg-threadlist .pageNavWrapper .pageNav-page--current,
            html.smg-threadlist .pageNavWrapper .pageNav-page > a,
            html.smg-threadlist .pageNavWrapper .pageNav-page--current > a { box-shadow: none !important; }
            html.smg-threadlist .pageNavWrapper .pageNav-page--current { border: 0 !important; background: none !important; }
            html.smg-threadlist .pageNavWrapper .pageNav-page::before,
            html.smg-threadlist .pageNavWrapper .pageNav-page::after,
            html.smg-threadlist .pageNavWrapper .pageNav-page--current::before,
            html.smg-threadlist .pageNavWrapper .pageNav-page--current::after,
            html.smg-threadlist .pageNavWrapper .pageNav-page > a::before,
            html.smg-threadlist .pageNavWrapper .pageNav-page > a::after,
            html.smg-threadlist .pageNavWrapper .pageNav-page--current > a::before,
            html.smg-threadlist .pageNavWrapper .pageNav-page--current > a::after { content: none !important; display: none !important; border: 0 !important; background: none !important; }
            /* botões de ação (Mark Read / Watch / Manage…) no nosso estilo */
            html.smg-threadlist .block-outer-opposite .buttonGroup { display: flex !important; gap: 6px !important; }
            html.smg-threadlist .block-outer-opposite .button {
                border-radius: 9px !important; border: 1px solid rgba(255,255,255,0.1) !important;
                background: rgba(255,255,255,0.05) !important; color: rgba(255,255,255,0.85) !important; box-shadow: none !important;
                min-height: 34px;
            }
            html.smg-threadlist .block-outer-opposite .button:hover { background: rgba(255,255,255,0.12) !important; color: #fff !important; border-color: rgba(255,255,255,0.2) !important; }

            /* ---- SMG: paginador/barra do fórum = MESMO visual da thread ----
               (pílula 36/raio 10 · página atual BRANCA · setas viram ícone · números alinhados)
               scoped em .smg-smg (3 classes) → vence o .smg-threadlist genérico sem mexer no simpcity */
            html.smg-threadlist .pageNav-page > a,
            html.smg-threadlist .pageNav-jump,
            html.smg-threadlist .pageNavSimple-el {
                min-width: 36px !important; height: 36px !important; min-height: 36px !important; padding: 0 13px !important;
                border-radius: 10px !important; border: 1px solid var(--smg-bd) !important;
                background: var(--smg-s1) !important; color: rgba(255,255,255,0.85) !important; font-size: 14px !important;
            }
            html.smg-threadlist .pageNav-page > a:hover,
            html.smg-threadlist .pageNav-jump:hover,
            html.smg-threadlist .pageNavSimple-el:hover {
                background: var(--smg-s2) !important; border-color: var(--smg-bd2) !important; color: #fff !important;
            }
            html.smg-threadlist .pageNav-page--current > a {
                background: #fff !important; color: #141414 !important; border-color: #fff !important;
            }
            html.smg-threadlist .pageNav-page--skip > a { background: var(--smg-s1) !important; border-color: var(--smg-bd) !important; }
            /* alinhamento vertical: números e seta centrados na mesma linha (mata o offset do <li>/<ul>) */
            html.smg-threadlist .pageNav { align-items: center !important; }
            html.smg-threadlist .pageNav-page { display: flex !important; align-items: center !important; margin: 0 !important; padding: 0 !important; line-height: 1 !important; }
            /* setas ‹ › em ícone (igual thread): quadrado 36, esconde texto/ícone nativo */
            html.smg-threadlist .smg-iconified {
                width: 36px !important; min-width: 36px !important; max-width: 36px !important; flex: 0 0 36px !important;
                height: 36px !important; min-height: 36px !important; padding: 0 !important; gap: 0 !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
            }
            html.smg-threadlist .smg-iconified .smg-ic { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; }
            html.smg-threadlist .smg-iconified .smg-ic svg { width: 18px !important; height: 18px !important; display: block; fill: none !important; }
            html.smg-threadlist .smg-iconified .button-text,
            html.smg-threadlist .smg-iconified > i { display: none !important; }
            /* botões de ação (Mark read / Watch) no MESMO tamanho/raio da thread */
            html.smg-threadlist .block-outer-opposite .button {
                min-height: 36px !important; border-radius: 10px !important;
                border: 1px solid var(--smg-bd) !important; background: var(--smg-s1) !important;
            }
            html.smg-threadlist .block-outer-opposite .button:hover { background: var(--smg-s2) !important; border-color: var(--smg-bd2) !important; }
            @media (max-width: 600px) {
                /* mobile: pager simples sem primeiro/último (evita pílula vazia do «/») */
                html.smg-threadlist .pageNavSimple-el--first,
                html.smg-threadlist .pageNavSimple-el--last { display: none !important; }
            }

            `;
        const CSS_FILTERBAR = `/* ============================================================
               BARRA ÚNICA SEGMENTADA (filter bar) — SMG · thread + fórum
               pager · ordenar · ações numa superfície só, grupos com divisor.
               Substitui o .block-outer nativo (escondido = fonte de dados/proxy-click).
               ============================================================ */
            .smg-bar {
                display: inline-flex; align-items: stretch; flex-wrap: nowrap; vertical-align: middle;
                height: 40px; box-sizing: border-box; margin: 0 0 0 auto; max-width: 100%;  /* margin-left:auto = alinha à DIREITA */
                background: var(--smg-s1); border: 1px solid var(--smg-bd); border-radius: 12px; overflow: hidden;
            }
            .smg-bar-group { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; min-width: 0; }
            .smg-bar-div { flex: 0 0 1px; width: 1px; align-self: stretch; margin: 7px 0; background: var(--smg-bd2); }
            /* botão base: pílula interna SEM borda própria (a borda é da barra) */
            .smg-bar-btn {
                display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box;
                height: 30px; min-width: 30px; padding: 0 9px;
                border: 0; border-radius: 8px; background: transparent; color: rgba(255,255,255,0.74);
                font-size: 13.5px; font-weight: 600; line-height: 1; text-decoration: none; cursor: pointer; white-space: nowrap;
                transition: background .14s ease, color .14s ease;
            }
            .smg-bar-btn:hover { background: var(--smg-s3); color: #fff; }
            /* ícones: mais brilho (o sino tava quase invisível) + traço mais grosso */
            .smg-bar-btn--icon { padding: 0; width: 32px; color: rgba(255,255,255,0.9); }
            .smg-bar-btn--current { background: #fff !important; color: #141414 !important; cursor: default; }
            /* watch ATIVO (seguindo): destaque pra mostrar o estado atual */
            .smg-bar-btn--on { background: var(--smg-s3) !important; color: #fff !important; }
            /* HIDE/SHOW DISCUSSIONS (addon do site) — virou ícone na filter bar (smgPrimaryActions). Esconde o nativo por CSS
               (não inline): pega TODAS as instâncias (topo/rodapé) e as que o addon re-renderiza depois. O proxy lê o estado
               (.fa-eye-slash) e dá .click() no nó escondido normalmente. Escopo = só onde a barra existe (thread/threadlist). */
            html.smg-thread .smg-discussion-toggle-container, html.smg-thread .smg-discussion-toggle,
            html.smg-threadlist .smg-discussion-toggle-container, html.smg-threadlist .smg-discussion-toggle { display: none !important; }
            /* tooltip dos ícones (fixed → escapa o overflow da barra) */
            .smg-bar-tip {
                position: fixed; transform: translate(-50%, -100%); z-index: 1000004;
                padding: 5px 9px; border-radius: 8px; background: rgba(20,21,25,0.97); color: #fff;
                font-size: 12px; font-weight: 500; line-height: 1; white-space: nowrap; pointer-events: none;
                border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 22px rgba(0,0,0,0.5);
                opacity: 0; transition: opacity .14s ease;
            }
            .smg-bar-tip.show { opacity: 1; }
            .smg-bar-ic { display: inline-flex; align-items: center; justify-content: center; }
            .smg-bar-btn svg, .smg-bar-ic svg { width: 18px; height: 18px; display: block; fill: none; stroke-width: 2.1; }
            .smg-bar-pages { display: inline-flex; align-items: center; gap: 4px; }
            .smg-bar-compact { display: none; align-items: center; height: 30px; padding: 0 6px; color: rgba(255,255,255,0.85); font-size: 13.5px; font-weight: 700; }
            .smg-bar-jump { letter-spacing: 1px; font-weight: 700; }
            /* popover (ir pra página / mais): position FIXED — escapa o overflow:hidden da barra
               (era por isso que o •••/… não apareciam). Coords setadas no JS (acima do botão). */
            .smg-bar-pophost { display: inline-flex; }
            .smg-bar-pop {
                position: fixed; transform: translate(-50%, -100%);
                display: none; flex-direction: column; gap: 4px; z-index: 1000003; min-width: 160px; padding: 6px;
                background: var(--smg-s2); border: 1px solid var(--smg-bd2); border-radius: 12px; box-shadow: 0 14px 38px rgba(0,0,0,0.55);
            }
            .smg-bar-pophost.open .smg-bar-pop { display: flex; }
            .smg-bar-pop--jump { flex-direction: row; align-items: center; gap: 6px; min-width: 0; }
            .smg-bar-pop input { width: 66px; height: 34px; box-sizing: border-box; text-align: center; border-radius: 8px; border: 1px solid var(--smg-bd2); background: var(--smg-s1); color: #fff; font-size: 14px; font-weight: 600; }
            .smg-bar-go { height: 34px; padding: 0 13px; border-radius: 8px; border: 0; background: #fff; color: #141414; font-weight: 700; cursor: pointer; }
            .smg-bar-poprow { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 10px; border-radius: 8px; border: 0; background: transparent; color: rgba(255,255,255,0.85); font-size: 13.5px; font-weight: 600; text-align: left; text-decoration: none; cursor: pointer; white-space: nowrap; }
            .smg-bar-poprow:hover { background: var(--smg-s3); color: #fff; }
            /* mobile: barra full-width · números viram compacto cur/max · ações à direita
               rola na horizontal se não couber (não clipa botão em tela estreita) */
            @media (max-width: 600px) {
                /* pílula AGRUPADA (sem justify-between): encolhe pro conteúdo, à ESQUERDA, rola na horizontal se não couber */
                .smg-bar { display: flex; width: max-content; max-width: 100%; height: 38px; margin: 0 !important; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
                .smg-bar::-webkit-scrollbar { display: none; }
                /* NÃO espremer os grupos (era o que clipava "3/39" → "/"): mantêm o tamanho e a barra ROLA */
                .smg-bar > * { flex: 0 0 auto; }
                .smg-bar-pages { display: none; }
                .smg-bar-compact { display: inline-flex; white-space: nowrap; }
                .smg-bar-btn { height: 28px; font-size: 12.5px; gap: 4px; }
            }

            `;
        const CSS_THREAD = `/* ============================================================
               THREAD: header no nosso modelo (sem breadcrumb · botões de ação)
               ============================================================ */
            /* breadcrumb removido por completo */
            html.smg-thread .breadcrumb,
            html.smg-thread .p-breadcrumbs,
            html.smg-thread .smg-thread-back { display: none !important; }
            /* tags da thread (tamanho médio) */
            html.smg-thread .p-description .tagList .tagItem,
            html.smg-thread .p-description .tagItem {
                font-size: 13px !important; padding: 4px 9px !important; line-height: 1.1 !important;
                border-radius: 7px !important;
            }
            /* título da thread + prefixos (ASMR/Twitch/…) */
            html.smg-thread .p-body-header .p-title-value { font-size: 25px !important; }
            html.smg-thread .p-title-value .label { font-size: 13px !important; padding: 3px 8px !important; }
            /* AÇÕES (feed · galeria · download) NA LINHA DO TÍTULO, fixas à direita (dentro do .p-title centralizado).
               Segmented control: UM bloco coeso (borda/fundo únicos) com divisores entre os ícones — junta os 3 num só. */
            html.smg-thread .p-body-header .p-title { display: flex !important; align-items: center !important; gap: 14px !important; flex-wrap: wrap !important; }
            .smg-thead-actions {
                display: inline-flex; align-items: stretch; margin-left: auto;
                border: 1px solid var(--smg-bd2); border-radius: 13px; overflow: hidden;
                background: linear-gradient(180deg, var(--smg-s2), var(--smg-s1));
                box-shadow: 0 4px 16px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06);
            }
            .smg-thead-btn {
                width: 48px; height: 42px; font-size: 21px; padding: 0; cursor: pointer;
                display: inline-flex; align-items: center; justify-content: center;
                border: 0; background: transparent; color: rgba(255,255,255,0.94);
                transition: background .16s ease, color .16s ease, transform .12s ease;
            }
            .smg-thead-btn svg { fill: none !important; }   /* ícones outline (o CSS do fórum tentava preencher → play virava blob/sumia) */
            .smg-thead-ic { display: inline-flex; align-items: center; justify-content: center; }
            .smg-thead-lbl { display: none; }   /* desktop: só ícone (compacto na linha do título); label aparece no mobile */
            .smg-thead-btn + .smg-thead-btn { border-left: 1px solid var(--smg-bd); }   /* divisor entre os segmentos */
            .smg-thead-btn:hover { background: var(--smg-link, #ff77b2); color: #fff; }   /* hover de marca: destaca o propósito “maior” */
            .smg-thead-btn:active { transform: scale(0.9); }
            /* título + descrição alinhados à esquerda (sem centralizar nada) */
            html.smg-thread .p-body-header .p-title,
            html.smg-thread .p-body-header .p-description,
            html.smg-thread .uix_headerInner,
            html.smg-thread .uix_headerInner--opposite { text-align: left !important; }
            html.smg-thread .uix_headerInner--opposite { justify-content: flex-start !important; align-items: flex-start !important; }
            html.smg-thread .p-title-pageAction { display: none !important; }   /* botão Quote/responder do header — removido */
            /* MOBILE: header UNIFICADO — título → tags (coladas, mesmo bloco visual) → ações full-width →
               barra de navegação esticada. O JS (buildThreadHeader) move a barra de ações pra DEPOIS das
               tags no mobile; antes ela entrava no meio e as tags ficavam órfãs depois dos botões. */
            @media (max-width: 600px) {
                html.smg-thread .p-body-header { padding-top: 16px !important; }
                html.smg-thread .p-body-header .p-title { gap: 9px !important; }
                html.smg-thread .p-body-header .p-title-value { font-size: 22px !important; }
                /* tags = subtítulo do título: coladas (6px), chips menores e discretos */
                html.smg-thread .p-body-header .p-description { margin: 6px 0 0 !important; }
                html.smg-thread .p-description .tagList .tagItem,
                html.smg-thread .p-description .tagItem { font-size: 12px !important; padding: 3px 8px !important; }
                .smg-thead-actions { width: 100%; margin: 12px 0 0; border-radius: 12px; }
                .smg-thead-btn { flex: 1 1 0; height: 44px; gap: 8px; font-size: 19px; }   /* ícone 19px + label ao lado → não fica gigante/vazio */
                .smg-thead-lbl { display: inline-block; font-size: 13.5px; font-weight: 600; letter-spacing: .01em; }
                /* barra (pager · sino · sort) estica e distribui — mesma largura das ações = um bloco só */
                html.smg-thread .smg-bar { width: 100%; justify-content: space-between; }
                html.smg-thread .block-outer { margin-top: 8px !important; }
            }

            /* barra de navegação/ações: paginação colada à ESQUERDA, ações/ordenação empurradas
               pra DIREITA (preenche a largura toda); mobile = empilhado */
            html.smg-thread .block-outer {
                display: flex !important; align-items: center !important; justify-content: flex-start !important;
                flex-wrap: wrap !important; gap: 0 !important; margin: 0 !important; padding-bottom: 0 !important;
            }
            /* espaçamento vertical enxuto: cola título→barra→posts */
            html.smg-thread .p-body-header { padding-top: 26px !important; padding-bottom: 4px !important; margin-bottom: 0 !important; }
            html.smg-thread .p-body-header .p-description { margin-bottom: 0 !important; }
            html.smg-thread .block-outer + * { margin-top: 4px !important; }
            html.smg-thread .block.block--messages,
            html.smg-thread .block-body--messages,
            html.smg-thread .js-replyNewMessageContainer { margin-top: 4px !important; }
            html.smg-thread .block-outer-main { flex: 0 1 auto !important; margin: 0 auto 0 0 !important; min-width: 0 !important; }
            html.smg-thread .block-outer-opposite { flex: 0 0 auto !important; margin: 0 !important; }
            /* mata o centramento nativo do pager (era o que indentava a paginação) */
            html.smg-thread .pageNavWrapper { justify-content: flex-start !important; align-items: center !important; text-align: left !important; margin: 0 !important; }
            html.smg-thread .pageNav { display: flex !important; align-items: center !important; justify-content: flex-start !important; margin: 0 !important; gap: 6px !important; }
            html.smg-thread .pageNav-main { display: flex !important; align-items: center; gap: 6px !important; flex-wrap: wrap; margin: 0 !important; padding: 0 !important; }
            /* o <li> (pageNav-page) era o que deslocava os números pra baixo: zera padding/line-height e centra */
            html.smg-thread .pageNav-page { display: flex !important; align-items: center !important; margin: 0 !important; padding: 0 !important; line-height: 1 !important; }
            html.smg-thread .pageNavSimple { justify-content: flex-start !important; margin: 0 !important; gap: 6px !important; align-items: center; }
            /* mostra só UM paginador (evita o pager completo + o "1 of N" juntos): completo no desktop */
            html.smg-thread .pageNavWrapper .pageNavSimple { display: none !important; }
            /* === BARRA ÚNICA: MESMO estilo de botão pra TODOS (pager · ações · ordenar) === */
            html.smg-thread .block-outer-opposite .buttonGroup { display: flex !important; gap: 6px !important; flex-wrap: wrap !important; align-items: center; }
            html.smg-thread .block-outer-opposite .tabs { justify-content: flex-start !important; border: 0 !important; box-shadow: none !important; gap: 6px !important; display: flex !important; }
            html.smg-thread .pageNavSimple-el,
            html.smg-thread .pageNav-jump,
            html.smg-thread .pageNav-page > a,
            html.smg-thread .block-outer-opposite .button,
            html.smg-thread .block-outer-opposite .button--link,
            html.smg-thread .block-outer-opposite .smgTranslator-globalBtn,
            html.smg-thread .block-outer-opposite .tabs-tab {
                border-radius: 10px !important; border: 1px solid var(--smg-bd) !important;
                background: var(--smg-s1) !important; color: rgba(255,255,255,0.85) !important; box-shadow: none !important;
                min-height: 36px !important; padding: 0 14px !important; margin: 0 !important;
                font-weight: 600; display: inline-flex !important; align-items: center; justify-content: center;
            }
            html.smg-thread .pageNavSimple-el:hover,
            html.smg-thread .pageNav-jump:hover,
            html.smg-thread .pageNav-page > a:hover,
            html.smg-thread .block-outer-opposite .button:hover,
            html.smg-thread .block-outer-opposite .button--link:hover,
            html.smg-thread .block-outer-opposite .smgTranslator-globalBtn:hover,
            html.smg-thread .block-outer-opposite .tabs-tab:hover {
                background: var(--smg-s2) !important; border-color: var(--smg-bd2) !important; color: #fff !important;
            }
            /* SELECIONADO (página atual · ordenação ativa) = BRANCO */
            html.smg-thread .pageNav-page--current > a,
            html.smg-thread .block-outer-opposite .tabs-tab.is-active {
                background: #fff !important; color: #141414 !important; border-color: #fff !important; box-shadow: none !important;
            }
            /* mata TODOS os pseudos nativos do pager: a SETA dupla (XF desenha ‹ › via ::before/::after
               no .pageNav-jump — meu ícone vinha por cima) e o INDICADOR VERDE da página atual */
            html.smg-thread .pageNavWrapper::before, html.smg-thread .pageNavWrapper::after,
            html.smg-thread .pageNav::before, html.smg-thread .pageNav::after,
            html.smg-thread .pageNav-main::before, html.smg-thread .pageNav-main::after,
            html.smg-thread .pageNav-jump::before, html.smg-thread .pageNav-jump::after,
            html.smg-thread .pageNavSimple::before, html.smg-thread .pageNavSimple::after,
            html.smg-thread .pageNavSimple-el::before, html.smg-thread .pageNavSimple-el::after,
            html.smg-thread .pageNav-page::before, html.smg-thread .pageNav-page::after,
            html.smg-thread .pageNav-page > a::before, html.smg-thread .pageNav-page > a::after,
            html.smg-thread .pageNav-page--current::before, html.smg-thread .pageNav-page--current::after,
            html.smg-thread .pageNav-page--current > a::before, html.smg-thread .pageNav-page--current > a::after { content: none !important; display: none !important; border: 0 !important; background: none !important; box-shadow: none !important; }
            /* o "verde abaixo" pode vir das bordas/box-shadow nativos dos containers e do <li> current */
            html.smg-thread .pageNavWrapper, html.smg-thread .pageNav, html.smg-thread .pageNav-main,
            html.smg-thread .pageNav-page, html.smg-thread .pageNav-page--current { border: 0 !important; box-shadow: none !important; background: none !important; }
            html.smg-thread .pageNav-page--current > a { text-decoration: none !important; }
            html.smg-thread .block-outer a:focus, html.smg-thread .block-outer a:focus-visible,
            html.smg-thread .block-outer button:focus, html.smg-thread .block-outer button:focus-visible { outline: none !important; box-shadow: none !important; }
            /* CTA de responder (SMG) em destaque (botão branco) */
            html.smg-thread .p-title-pageAction .button--cta {
                border-radius: 10px !important; border: none !important;
                background: #fff !important; color: #141414 !important;
            }
            /* PADRONIZA botões de ÍCONE (sino · calendário · estrela): quadrados idênticos, ícone 18px centralizado */
            html.smg-thread .smg-iconified {
                width: 36px !important; min-width: 36px !important; max-width: 36px !important; flex: 0 0 36px !important;
                height: 36px !important; min-height: 36px !important; padding: 0 !important; gap: 0 !important;
                display: inline-flex !important; align-items: center !important; justify-content: center !important;
            }
            html.smg-thread .smg-iconified .smg-ic { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; }
            html.smg-thread .smg-iconified .smg-ic svg { width: 18px !important; height: 18px !important; display: block; fill: none !important; }
            html.smg-thread .smg-iconified .button-text { display: none !important; }
            /* mata baseline/borda/pseudo nativos das tabs (o "1px fantasma" na barra) */
            html.smg-thread .block-outer-opposite .tabs { border: 0 !important; box-shadow: none !important; background: transparent !important; padding: 0 !important; margin: 0 !important; }
            html.smg-thread .block-outer-opposite .tabs::before,
            html.smg-thread .block-outer-opposite .tabs::after,
            html.smg-thread .block-outer-opposite .tabs-tab::before,
            html.smg-thread .block-outer-opposite .tabs-tab::after { content: none !important; display: none !important; border: 0 !important; }

            /* ORDENAR (data ⇄ reações): SWITCH segmentado — container = pílula; opção ATIVA = knob
               branco (o "indicador q dá pra mudar"); cada opção tem ícone + label (não é só ícone).
               scoped com .block-outer-opposite p/ vencer o estilo de pílula genérico das .tabs-tab */
            html.smg-thread .block-outer-opposite .smg-sortseg {
                display: inline-flex !important; align-items: center !important; gap: 3px !important;
                height: 36px !important; min-height: 36px !important; box-sizing: border-box !important;
                padding: 3px !important; margin: 0 !important;
                background: var(--smg-s1) !important; border: 1px solid var(--smg-bd) !important;
                border-radius: 10px !important; box-shadow: none !important;
            }
            html.smg-thread .block-outer-opposite .smg-sortseg .tabs-tab {
                display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 6px !important;
                height: 28px !important; min-height: 28px !important; padding: 0 12px !important; margin: 0 !important;
                border: 0 !important; border-radius: 7px !important; background: transparent !important;
                color: rgba(255,255,255,0.6) !important; font-size: 13px !important; font-weight: 600 !important;
                box-shadow: none !important; transition: background .15s ease, color .15s ease;
            }
            html.smg-thread .block-outer-opposite .smg-sortseg .tabs-tab:hover { color: #fff !important; background: var(--smg-s3) !important; }
            html.smg-thread .block-outer-opposite .smg-sortseg .tabs-tab.is-active { background: #fff !important; color: #141414 !important; }
            html.smg-thread .smg-sortseg .smg-ic { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; }
            html.smg-thread .smg-sortseg .smg-ic svg { width: 15px !important; height: 15px !important; display: block; fill: none !important; }
            html.smg-thread .smg-sortseg .smg-seg-label { line-height: 1; white-space: nowrap; }

            /* mobile: TUDO numa linha só, alinhado à direita; paginador compacto */
            @media (max-width: 600px) {
                html.smg-thread .block-outer {
                    flex-direction: row !important; flex-wrap: nowrap !important;
                    justify-content: flex-end !important; align-items: center !important;
                    gap: 0 !important; overflow-x: auto; -webkit-overflow-scrolling: touch;
                }
                html.smg-thread .block-outer::-webkit-scrollbar { display: none; }
                html.smg-thread .block-outer-main { margin: 0 !important; flex: 0 0 auto !important; }
                html.smg-thread .block-outer-opposite { width: auto !important; flex: 0 0 auto !important; }
                html.smg-thread .block-outer-opposite .tabs { width: auto !important; overflow: visible; }
                html.smg-thread .smg-thread-back { display: inline-flex; }
                /* paginador: só o simples e SEM ‹‹ ›› (primeiro/último), bem compacto */
                html.smg-thread .pageNavWrapper .pageNav { display: none !important; }
                html.smg-thread .pageNavWrapper .pageNavSimple { display: flex !important; }
                html.smg-thread .pageNavSimple-el--first, html.smg-thread .pageNavSimple-el--last { display: none !important; }
                /* todos os botões da barra com o MESMO tamanho compacto no mobile */
                html.smg-thread .pageNavSimple-el,
                html.smg-thread .pageNav-jump,
                html.smg-thread .block-outer-opposite .button,
                html.smg-thread .block-outer-opposite .button--link,
                html.smg-thread .block-outer-opposite .smgTranslator-globalBtn,
                html.smg-thread .block-outer-opposite .tabs-tab { min-height: 34px !important; padding: 0 11px !important; font-size: 13px !important; }
                /* botões de ícone quadrados 34x34 (mesmo tamanho dos demais) */
                html.smg-thread .smg-iconified { width: 34px !important; min-width: 34px !important; max-width: 34px !important; flex: 0 0 34px !important; height: 34px !important; min-height: 34px !important; padding: 0 !important; }
                /* switch de ordenação: 34px (bate com os outros) */
                html.smg-thread .block-outer-opposite .smg-sortseg { height: 34px !important; min-height: 34px !important; }
                html.smg-thread .block-outer-opposite .smg-sortseg .tabs-tab { height: 26px !important; min-height: 26px !important; padding: 0 10px !important; font-size: 12.5px !important; }
            }

            /* ---- preview da thumbnail no hover ---- */
            #smg-thumb-pop {
                position: fixed; z-index: 1000002; display: none; pointer-events: none;
                border-radius: 12px; overflow: hidden; background: #0d0e12;
                border: 1px solid rgba(255,255,255,0.18);
                box-shadow: 0 20px 55px rgba(0,0,0,0.65);
            }
            #smg-thumb-pop img { display: block; max-width: min(620px, 46vw); max-height: 84vh; object-fit: contain; }

            /* ---- modo grade (cards, máx 6 colunas) — .smg-tl-grid é marcado via JS no
               container real dos itens (varia entre fórum e watched) ---- */
            html.smg-threadlist.smg-tv-grid .smg-tl-grid {
                display: grid !important;
                grid-template-columns: repeat(auto-fill, minmax(max(170px, calc((100% - 56px) / 5)), 1fr)) !important;
                gap: 14px !important;
                padding: 14px !important;
                align-items: start !important;
            }
            html.smg-threadlist.smg-tv-grid .smg-tl-grid > .smg-inf-sep { grid-column: 1 / -1 !important; }
            html.smg-threadlist.smg-tv-grid .stickySeparatortop,
            html.smg-threadlist.smg-tv-grid .stickySeparatorbottom { display: none !important; }
            html.smg-threadlist.smg-tv-grid .structItem--thread {
                display: flex !important;
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 0 !important;
                padding: 0 !important;
                border: 1px solid rgba(127,127,127,0.18) !important;
                border-radius: 12px !important;
                overflow: hidden !important;
                background: rgba(127,127,127,0.06) !important;
                /* PERF: pula layout+paint dos cards de thread fora da viewport (grids de fórum longos, sem
                   virtualização própria). 'auto' faz o browser lembrar a altura real após medir 1× → CLS mínimo.
                   NÃO nos posts da thread (deep-link/masonry medem offscreen) nem no feed (riverFreeze já poda).
                   Firefox ignora a prop: sem efeito, sem quebra. */
                content-visibility: auto;
                contain-intrinsic-size: auto 320px;
            }
            /* mesma poda nos outros 2 modos de listagem (também infinite-scrollam às centenas):
               lista (linha ~112px) e article cards (~360px). 'auto' lembra a altura real após pintar 1×. */
            html.smg-threadlist:not(.smg-tv-grid) .structItem--thread { content-visibility: auto; contain-intrinsic-size: auto 112px; }
            html.smg-threadlist .message--articlePreview { content-visibility: auto; contain-intrinsic-size: auto 360px; }
            html.smg-threadlist.smg-tv-grid .structItem--thread .structItem-cell--icon:not(.structItem-cell--iconEnd) { width: 100% !important; height: auto !important; }
            html.smg-threadlist.smg-tv-grid .structItem--thread .dcThumbnail,
            html.smg-threadlist.smg-tv-grid .structItem--thread .dtt-thread-thumbnail { width: 100% !important; aspect-ratio: 1 / 1 !important; height: auto !important; border-radius: 0 !important; }
            html.smg-threadlist.smg-tv-grid .structItem--thread .structItem-cell--main { width: 100% !important; box-sizing: border-box !important; padding: 9px 12px 12px !important; }
            html.smg-threadlist.smg-tv-grid .structItem--thread .structItem-title { font-size: 15px !important; }
            html.smg-threadlist.smg-tv-grid .structItem--thread .structItem-cell--meta,
            html.smg-threadlist.smg-tv-grid .structItem--thread .structItem-cell--latest,
            html.smg-threadlist.smg-tv-grid .structItem--thread .structItem-cell--iconEnd { display: none !important; }
            /* ads injetados na lista (samUnitWrapper) são .structItem--thread → viram célula VAZIA
               no grid. Some de vez (no grid e na lista) — corrige os "buracos" do grid. */
            html.smg-threadlist .structItem--thread.samUnitWrapper { display: none !important; }
            /* PLACEHOLDER (marca SMG) nos cards sem thumb real — no lugar do avatar/thumb-quebrada/vazio.
               esconde avatar + thumb (quebrada) em QUALQUER modo; o tamanho do placeholder muda por modo. */
            .smg-thumb-ph { display: none; }
            html.smg-threadlist .structItem--thread.smg-no-thumb .structItem-cell--icon:not(.structItem-cell--iconEnd) .avatar,
            html.smg-threadlist .structItem--thread.smg-no-thumb .dcThumbnail,
            html.smg-threadlist .structItem--thread.smg-no-thumb .dtt-thread-thumbnail { display: none !important; }
            .smg-thumb-ph { align-items: center; justify-content: center; box-sizing: border-box;
                background: radial-gradient(circle at 50% 40%, var(--smg-s3), var(--smg-s1)); }
            /* GRID: quadrado, ocupa a célula toda */
            html.smg-threadlist.smg-tv-grid .structItem--thread.smg-no-thumb .smg-thumb-ph {
                display: flex !important; width: 100% !important; aspect-ratio: 1 / 1;
            }
            /* LISTA (sem grid): no tamanho do thumb da lista (210×132 desktop) */
            html.smg-threadlist:not(.smg-tv-grid) .structItem--thread.smg-no-thumb .smg-thumb-ph {
                display: flex !important; width: 210px; height: 132px; flex: 0 0 auto; border-radius: 8px;
            }
            @media (max-width: 600px) {
                /* LISTA mobile: thumb 92×70 + marca menor */
                html.smg-threadlist:not(.smg-tv-grid) .structItem--thread.smg-no-thumb .smg-thumb-ph { width: 92px; height: 70px; border-radius: 7px; }
                html.smg-threadlist:not(.smg-tv-grid) .structItem--thread.smg-no-thumb .smg-ph-word { font-size: 15px; letter-spacing: 1px; }
            }
            .smg-ph-word { font-size: 34px; font-weight: 800; letter-spacing: 2px; color: rgba(255,255,255,0.2); line-height: 1; user-select: none; }
            .smg-ph-g { color: rgba(255,77,141,0.45); }

            /* ===== forum_view_type_article (ex.: /forums/games.91/): threads = .message--articlePreview (NÃO .structItem--thread).
               Vira o MESMO grid de cards das outras páginas (imagem 1:1 + título + meta), sem o excerpt.
               .smg-article-grid é marcado via JS no container (pega sticky/featured fora do .block-body). ===== */
            /* GRADE (modo grade): gated em smg-tv-grid → o toggle lista/grade da dock vale aqui também */
            html.smg-threadlist.smg-tv-grid .smg-article-grid {
                display: grid !important;
                grid-template-columns: repeat(auto-fill, minmax(max(170px, calc((100% - 56px) / 5)), 1fr)) !important;
                gap: 14px !important; padding: 14px !important; background: transparent !important; align-items: start !important;
            }
            html.smg-threadlist.smg-tv-grid .smg-article-grid > .smg-inf-sep { grid-column: 1 / -1 !important; }
            /* LISTA (modo lista): card horizontal (imagem à esquerda + texto à direita) */
            html.smg-threadlist:not(.smg-tv-grid) .smg-article-grid { display: flex !important; flex-direction: column !important; gap: 10px !important; padding: 12px 0 !important; }
            html.smg-threadlist:not(.smg-tv-grid) .smg-article-grid .message--articlePreview { flex-direction: row !important; }
            html.smg-threadlist:not(.smg-tv-grid) .smg-article-grid .articlePreview-main { flex-direction: row !important; align-items: stretch !important; gap: 0 !important; }
            html.smg-threadlist:not(.smg-tv-grid) .smg-article-grid .articlePreview-image,
            html.smg-threadlist:not(.smg-tv-grid) .smg-article-grid .smg-art-ph { flex: 0 0 210px !important; width: 210px !important; aspect-ratio: 16 / 10 !important; }
            html.smg-threadlist:not(.smg-tv-grid) .smg-article-grid .articlePreview-text { flex: 1 1 auto !important; justify-content: center !important; padding: 10px 16px !important; }
            @media (max-width: 600px) {
                html.smg-threadlist:not(.smg-tv-grid) .smg-article-grid .articlePreview-image,
                html.smg-threadlist:not(.smg-tv-grid) .smg-article-grid .smg-art-ph { flex-basis: 116px !important; width: 116px !important; }
            }
            html.smg-threadlist .message--articlePreview {
                display: flex !important; flex-direction: column !important; margin: 0 !important; padding: 0 !important;
                width: auto !important; max-width: none !important; min-width: 0 !important; float: none !important;   /* item de grid limpo */
                background: var(--smg-s1) !important; border: 1px solid var(--smg-bd) !important;
                border-radius: 12px !important; overflow: hidden !important;
                transition: border-color .14s ease, transform .14s ease;
            }
            html.smg-threadlist .message--articlePreview:hover { border-color: var(--smg-bd2) !important; transform: translateY(-2px); }
            html.smg-threadlist .articlePreview-main { display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 0 !important; padding: 0 !important; }
            /* imagem (ou placeholder) 1:1 no topo — igual ao grid de structItem.
               img em position:absolute → quebra a dependência circular (height:auto + img 100%) que fazia
               o aspect-ratio ser ignorado (imagem gigante/colapsada → grid torto) */
            html.smg-threadlist .articlePreview-image,
            html.smg-threadlist .message--articlePreview .smg-art-ph {
                position: relative !important; display: block !important;
                width: 100% !important; aspect-ratio: 1 / 1 !important; height: auto !important; margin: 0 !important;
                overflow: hidden !important; background: var(--smg-s2); border-radius: 0 !important; box-sizing: border-box;
            }
            html.smg-threadlist .articlePreview-image img {
                position: absolute !important; inset: 0 !important;
                width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important;
                object-fit: cover !important; display: block !important; border-radius: 0 !important;
            }
            html.smg-threadlist .message--articlePreview .smg-art-ph {
                display: flex !important; align-items: center !important; justify-content: center !important;
                background: radial-gradient(circle at 50% 40%, var(--smg-s3), var(--smg-s1)) !important; text-decoration: none;
            }
            /* embeds/jogos do trecho que escapam (ex.: Virtualfem) — NÃO renderiza dentro do card */
            html.smg-threadlist .message--articlePreview iframe,
            html.smg-threadlist .message--articlePreview .generic2wide-iframe-div,
            html.smg-threadlist .message--articlePreview .smg-turbo-slot,
            html.smg-threadlist .message--articlePreview [data-s9e-mediaembed],
            html.smg-threadlist .message--articlePreview .bbImageWrapper { display: none !important; }
            html.smg-threadlist .articlePreview-text { display: flex !important; flex-direction: column !important; gap: 6px !important; padding: 9px 12px 0 !important; min-width: 0 !important; }
            html.smg-threadlist .articlePreview-headline { margin: 0 !important; }
            html.smg-threadlist .articlePreview-title { font-size: 14.5px !important; font-weight: 600 !important; line-height: 1.3 !important; margin: 0 !important; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            html.smg-threadlist .articlePreview-title a { color: #fff !important; }
            html.smg-threadlist .articlePreview-title .label { font-size: 11px !important; }
            /* excerpt + "view full article" saem (igual ao grid de structItem = só thumb+título+meta) */
            html.smg-threadlist .articlePreview-content,
            html.smg-threadlist .articlePreview-links { display: none !important; }
            /* rodapé enxuto: avatar · autor · data · respostas (sem share/embed) */
            html.smg-threadlist .articlePreview-footer { margin-top: auto !important; padding: 7px 12px 11px !important; border: 0 !important; background: transparent !important; }
            html.smg-threadlist .articlePreview-meta { display: flex !important; align-items: center !important; gap: 7px !important; flex-wrap: nowrap !important; margin: 0 !important; padding: 0 !important; list-style: none !important; font-size: 11.5px !important; color: rgba(255,255,255,0.5) !important; overflow: hidden; }
            html.smg-threadlist .articlePreview-meta > li { display: inline-flex !important; align-items: center; margin: 0 !important; min-width: 0; }
            html.smg-threadlist .articlePreview-meta > li.js-embedCopy,
            /* (li do "share" no meta dos article cards: escondido pelo JS no styleArticleCards — era o último :has por-li em grid com infinite scroll) */
            html.smg-threadlist .articlePreview-by { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            html.smg-threadlist .articlePreview-by a { color: rgba(255,255,255,0.72) !important; }
            html.smg-threadlist .articlePreview-meta .simp-avatar-border-wrap, html.smg-threadlist .articlePreview-meta .avatar { width: 20px !important; height: 20px !important; flex: 0 0 auto; }
            html.smg-threadlist .articlePreview-meta .avatar { border-radius: 50% !important; overflow: hidden; }
            html.smg-threadlist .articlePreview-meta .avatar img, html.smg-threadlist .articlePreview-meta .avatar span { width: 20px !important; height: 20px !important; font-size: 10px !important; line-height: 20px !important; }
            html.smg-threadlist .articlePreview-meta .simp-avatar-border { display: none !important; }   /* tira a moldura decorativa */
            html.smg-threadlist .articlePreview-replies { margin-left: auto !important; flex: 0 0 auto; }
            html.smg-threadlist .articlePreview-replies a { color: rgba(255,255,255,0.6) !important; }
            @media (max-width: 600px) {
                html.smg-threadlist .block--articles .block-body,
                html.smg-threadlist .smg-article-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; padding: 11px !important; }
                html.smg-threadlist .articlePreview-title { font-size: 13px !important; }
            }

            /* ---- feed: barra de ferramentas (download / galeria / filtro / mudo) ---- */
            .smg-feed-tools { position: absolute; top: 18px; right: 84px; z-index: 6; display: flex; gap: 10px; }
            .smg-feed-tool {
                width: 46px; height: 46px; font-size: 21px;
                display: flex; align-items: center; justify-content: center;
                border-radius: 50%; cursor: pointer; color: #fff;
                border: 1px solid rgba(255,255,255,0.15);
                background: rgba(20,20,24,0.82);   /* PERF: sem backdrop-filter (repintava no scroll do reel) */
                transition: background .15s ease, transform .12s ease;
            }
            .smg-feed-tool:hover { background: rgba(42,42,50,0.85); }
            .smg-feed-tool:active { transform: scale(0.9); }
            .smg-feed-tool.smg-active { background: var(--smg-link-strong, #d14d8f); border-color: var(--smg-link-strong, #d14d8f); color: #fff; }
            .smg-feed-tool svg { width: 1em; height: 1em; display: block; }
            /* o CSS do fórum enche os SVGs (fill); força outline em tudo dentro do feed */
            #smg-feed svg { fill: none !important; }
            #smg-feed .smg-rgc-play svg, #smg-feed .smg-rgc-barplay svg, #smg-feed .smg-gallery-play svg { fill: currentColor !important; }   /* play/pause + play da galeria são PREENCHIDOS (não outline) → re-afirma o fill, senão somem com a regra acima */

            /* ---- feed: filmstrip (tira de thumbnails) ---- */
            .smg-feed-media { transform-origin: center center; }
            .smg-feed-strip {
                position: absolute; left: 0; right: 0; bottom: 0; height: 92px;
                display: flex; align-items: center; gap: 8px;
                padding: 10px 14px; overflow-x: auto; overflow-y: hidden; z-index: 6;
                background: linear-gradient(0deg, rgba(0,0,0,0.88), rgba(0,0,0,0));
                transform: translateY(110%);
                transition: transform .26s cubic-bezier(.2,.8,.3,1);
                scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) transparent;
            }
            .smg-feed-strip::-webkit-scrollbar { height: 7px; }
            .smg-feed-strip::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 4px; }
            #smg-feed.strip-open .smg-feed-strip { transform: translateY(0); }
            /* setas < > de navegação do filmstrip (sobre as pontas, com gradiente; somem nas extremidades) */
            .smg-feed-striparrow {
                position: absolute; bottom: 0; height: 92px; width: 54px; z-index: 7;
                display: none; align-items: center; border: 0; color: #fff; cursor: pointer; padding: 0;
                transition: opacity .2s ease;
            }
            #smg-feed.strip-open .smg-feed-striparrow { display: flex; }
            #smg-feed.strip-open .smg-feed-striparrow.is-hidden { opacity: 0; pointer-events: none; }
            .smg-feed-striparrow--prev { left: 0; justify-content: flex-start; padding-left: 10px; background: linear-gradient(90deg, rgba(0,0,0,0.92), rgba(0,0,0,0)); }
            .smg-feed-striparrow--next { right: 0; justify-content: flex-end; padding-right: 10px; background: linear-gradient(270deg, rgba(0,0,0,0.92), rgba(0,0,0,0)); }
            .smg-feed-striparrow svg { width: 26px; height: 26px; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.8)); transition: transform .12s ease; }
            .smg-feed-striparrow:hover svg { transform: scale(1.18); }
            @media (max-width: 600px) { .smg-feed-striparrow { display: none !important; } }   /* mobile: rola por swipe */
            /* thumbs SEMPRE abertas → imagem/iframe/player sobem ~92px pra não ficar atrás do filmstrip */
            #smg-feed.strip-open .smg-feed-media,
            #smg-feed.strip-open .smg-feed-embed iframe { max-height: calc(100vh - 104px); margin-bottom: 92px; }
            #smg-feed.strip-open .smg-feed-embed .smg-rg { max-height: calc(100vh - 104px) !important; margin-bottom: 92px !important; }
            .smg-feed-thumb {
                flex: 0 0 auto; width: 64px; height: 64px; border-radius: 8px; overflow: hidden;
                border: 2px solid transparent; background: #1c1c22; cursor: pointer; padding: 0;
                position: relative; opacity: .6;
                transition: opacity .15s ease, border-color .15s ease, transform .12s ease;
            }
            .smg-feed-thumb:hover { opacity: 1; transform: translateY(-2px); }
            .smg-feed-thumb.active { opacity: 1; border-color: rgba(255,255,255,0.7); }
            .smg-feed-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
            .smg-feed-thumb-embed { display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.8); font-size: 22px; }
            .smg-feed-thumb-embed svg { width: 1em; height: 1em; }

            /* ITENS ativos/atuais/primários seguem o ACENTO do tema (eram BRANCOS nos 2 sites → agora verde/rosa por site) */
            /* (a aba ativa da home saiu daqui: agora é sublinhado-accent, não fill — ver .smg-feed-tab::after) */
            .smg-tb-search-go,
            .smg-search-go,
            .smg-search-author-btn.has-value,
            .smg-bar-btn--current,
            .smg-bar-go,
            html.smg-thread .pageNav-page--current > a,
            html.smg-threadlist .pageNav-page--current > a,
            html.smg-thread .block-outer-opposite .smg-sortseg .tabs-tab.is-active {
                background: var(--smg-link-strong, #d14d8f) !important;
                color: #fff !important;
                border-color: var(--smg-link-strong, #d14d8f) !important;
            }

            /* ===== modal de DOWNLOAD ===== */
            #smg-dl-modal [hidden] { display: none !important; }   /* nossas seções têm display próprio → [hidden] precisa vencer (era o "tudo junto") */
            #smg-dl-modal { position: fixed; inset: 0; z-index: 2147483640; display: flex; align-items: center; justify-content: center; padding: 16px; background: var(--smg-scrim, rgba(0,0,0,0.66)); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
            .smg-dl-card { width: min(440px, 100%); max-height: 86vh; display: flex; flex-direction: column; background: var(--smg-s1); border: 1px solid var(--smg-bd2); border-radius: 16px; box-shadow: 0 24px 64px rgba(0,0,0,0.62); overflow: hidden; }
            .smg-dl-head { display: flex; align-items: center; justify-content: space-between; padding: 15px 18px; border-bottom: 1px solid var(--smg-bd); }
            .smg-dl-title { font-size: 16px; font-weight: 800; color: #fff; }
            .smg-dl-x { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 9px; background: transparent; color: rgba(255,255,255,0.65); cursor: pointer; font-size: 18px; }
            .smg-dl-x:hover { background: var(--smg-s2); color: #fff; }
            .smg-dl-x svg { fill: none !important; }
            .smg-dl-body { padding: 18px; overflow-y: auto; }
            .smg-dl-scan { display: flex; align-items: center; gap: 11px; color: rgba(255,255,255,0.82); font-size: 14px; }
            .smg-dl-spin { flex: 0 0 auto; width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,0.18); border-top-color: var(--smg-link, #ff77b2); animation: smg-dl-spin .7s linear infinite; }
            @keyframes smg-dl-spin { to { transform: rotate(360deg); } }
            .smg-dl-summary { display: flex; flex-direction: column; gap: 9px; }
            .smg-dl-stat { font-size: 14px; color: rgba(255,255,255,0.78); }
            .smg-dl-stat b { color: #fff; font-size: 19px; font-weight: 800; margin-right: 5px; }
            .smg-dl-hosts { color: rgba(255,255,255,0.5); font-size: 12px; }
            .smg-dl-warn { margin-top: 4px; font-size: 12px; color: rgba(255,200,120,0.85); }
            .smg-dl-empty { color: rgba(255,255,255,0.6); font-size: 14px; }
            .smg-dl-progress { display: flex; flex-direction: column; gap: 9px; }
            .smg-dl-bar { height: 8px; border-radius: 999px; background: var(--smg-s3); overflow: hidden; }
            .smg-dl-bar span { display: block; height: 100%; width: 0; background: var(--smg-link-strong, var(--smg-link, #ff77b2)); transition: width .2s ease; }
            .smg-dl-progtxt { font-size: 12.5px; color: rgba(255,255,255,0.6); font-variant-numeric: tabular-nums; }
            .smg-dl-foot { display: flex; gap: 10px; padding: 14px 18px; border-top: 1px solid var(--smg-bd); }
            .smg-dl-btn { flex: 1; padding: 11px; border: 1px solid var(--smg-bd2); border-radius: 11px; background: var(--smg-s2); color: #fff; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background .14s ease, filter .14s ease; }
            .smg-dl-btn:hover { background: var(--smg-s3); }
            .smg-dl-btn.smg-dl-zip { background: var(--smg-link-strong, #d14d8f); border-color: var(--smg-link-strong, #d14d8f); }
            .smg-dl-btn.smg-dl-zip:hover { background: var(--smg-link-strong, #d14d8f); filter: brightness(1.1); }

            /* ============================================================
               POST estilo REDDIT (.smg-pc no <article>): 1 coluna · header · conteúdo · action bar.
               O JS moveu os nativos pro card; aqui esconde os containers esvaziados e estiliza.
               ============================================================ */
            /* contain layout+style (SEM paint/size): mutação intra-post (player montando, masonry, smg-img-ready)
               não invalida o layout dos outros N posts. abs/fixed: nada dentro do post ancora fora dele
               (morepop é absolute no morewrap relative); medidas via getBoundingClientRect seguem normais. */
            html.smg-thread .smg-pc { background: var(--smg-s1, #16171b) !important; border: 1px solid rgba(255,255,255,0.11) !important; border-radius: 18px !important; margin: 0 0 14px; overflow: visible; transition: border-color .16s ease, box-shadow .16s ease; contain: layout style; }
            html.smg-thread .smg-pc:hover { border-color: rgba(255,255,255,0.22) !important; box-shadow: 0 4px 18px rgba(0,0,0,0.35) !important; }   /* realce no hover (estilo Reddit) — !important p/ vencer o tema do SMG */
            /* SMG: o card usa as superfícies (cinzas) do SimpCity — mais escuras que o tema SMG (s1 12.5 vs 13.5 etc.). Escopo .smg-pc → só os cards/posts; o resto do SMG mantém o tema dele. (escolha do user) */
            html.smg-smg .smg-pc { --smg-s1: hsl(0 0% 12.5%); --smg-s2: hsl(0 0% 16%); --smg-s3: hsl(0 0% 21%); }
            /* QUOTES / unfurl dentro do post: inset escuro (recuado) + border + rounded — !important p/ vencer o cinza claro do tema */
            html.smg-thread .smg-pc .bbCodeBlock { background: rgba(0,0,0,0.22) !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 12px !important; }
            html.smg-thread .smg-pc .bbCodeBlock .contentRow, html.smg-thread .smg-pc .bbCodeBlock-content { background: transparent !important; }
            html.smg-thread .smg-pc .message-inner, html.smg-thread .smg-pc .message-cell--main, html.smg-thread .smg-pc .message-main { background: transparent !important; }   /* sem bg quadrado do tema cobrindo os cantos arredondados */
            html.smg-thread .smg-pc .message-inner { display: block; }                                  /* mata o flex de 2 colunas */
            html.smg-thread .smg-pc .message-cell--user { display: none !important; }                   /* avatar/nome/título/stats movidos pro header */
            html.smg-thread .smg-pc .message-cell--main { width: 100%; max-width: none; border: 0 !important; padding: 0 !important; }
            html.smg-thread .smg-pc .message-attribution { display: none !important; }                  /* tempo/#/share/bookmark movidos */
            html.smg-thread .smg-pc .message-actionBar { display: none !important; }                    /* react/comentar/quote/report movidos */
            html.smg-thread .smg-pc .message-content { padding: 18px 22px 10px; }
            /* HEADER (com divisor border-b) */
            html.smg-thread .smg-pc-head { display: flex; align-items: flex-start; gap: 12px; padding: 18px 22px 14px; border-bottom: 1px solid var(--smg-bd, rgba(255,255,255,0.08)); }
            html.smg-thread .smg-pc-avatar { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 50%; overflow: hidden; }
            html.smg-thread .smg-pc-avatar img, html.smg-thread .smg-pc-avatar span { width: 100% !important; height: 100% !important; object-fit: cover; display: flex; align-items: center; justify-content: center; }
            html.smg-thread .smg-pc-meta { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
            html.smg-thread .smg-pc-row1 { display: flex; align-items: center; gap: 8px; }
            html.smg-thread .smg-pc-idline { display: flex; align-items: baseline; gap: 6px; min-width: 0; flex-wrap: wrap; }
            html.smg-thread .smg-pc-name { margin: 0; font-size: 14px; font-weight: 700; }
            html.smg-thread .smg-pc-name a { text-decoration: none; }                                   /* mantém a cor nativa do username (identidade) */
            html.smg-thread .smg-pc-name a:hover { text-decoration: underline; }
            html.smg-thread .smg-pc-dot { color: rgba(255,255,255,0.35); }
            html.smg-thread .smg-pc-time { color: rgba(255,255,255,0.5); font-size: 12.5px; }
            html.smg-thread .smg-pc-num { margin-left: auto; flex: 0 0 auto; color: rgba(255,255,255,0.4); font-size: 12.5px; text-decoration: none; }
            html.smg-thread .smg-pc-num:hover { color: rgba(255,255,255,0.75); }
            html.smg-thread .smg-pc-row2 { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; }
            html.smg-thread .smg-pc-utitle { margin: 0; font-size: 11.5px; color: rgba(255,255,255,0.42); font-weight: 500; }
            html.smg-thread .smg-pc-row2 .userBanner { margin: 0; font-size: 10px; padding: 1px 6px; }
            html.smg-thread .smg-pc-row2 .featuredBadges { display: inline-flex; flex-wrap: wrap; gap: 3px; margin: 0; }
            html.smg-thread .smg-pc-row2 .badgeIcon { width: 16px; height: 16px; }
            html.smg-thread .smg-pc-stats { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 4px 0 0; }
            html.smg-thread .smg-pc-stats dl { display: inline-flex; align-items: center; gap: 4px; margin: 0; padding: 0; font-size: 11px; color: rgba(255,255,255,0.38); }
            html.smg-thread .smg-pc-stats dt, html.smg-thread .smg-pc-stats dd { margin: 0; }
            html.smg-thread .smg-pc-stats svg, html.smg-thread .smg-pc-stats .fa--xf { width: 11px; height: 11px; opacity: 0.55; }
            /* ACTION BAR */
            html.smg-thread .smg-pc-actions { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 12px 18px 14px; margin-top: 8px; border-top: 1px solid var(--smg-bd, rgba(255,255,255,0.07)); }
            html.smg-thread .smg-pc-act { display: inline-flex !important; align-items: center; gap: 7px; height: 34px; margin: 0 !important; padding: 0 13px !important; border-radius: 9px; border: 0; background: transparent; color: rgba(255,255,255,0.72); font-size: 13px; font-weight: 600; line-height: 1; cursor: pointer; text-decoration: none; white-space: nowrap; transition: background .12s ease, color .12s ease; }
            html.smg-thread .smg-pc-act:hover { background: var(--smg-s3, rgba(255,255,255,0.08)); color: #fff; }
            html.smg-thread .smg-pc-act > i, html.smg-thread .smg-pc-act > .fa--xf { font-size: 15px; }
            html.smg-thread .smg-pc-act svg { width: 16px; height: 16px; }
            html.smg-thread .smg-pc-act .reaction-sprite, html.smg-thread .smg-pc-act .reaction-image { width: 18px; height: 18px; }
            html.smg-thread .smg-pc-act--save .js-bookmarkText { display: none; }   /* texto nativo "Adicionar aos favoritos" fica escondido → o rótulo "Salvar" (smg-pc-act-lbl) é o visível (sem duplicar) */
            html.smg-thread .smg-pc-react-n { font-weight: 600; font-variant-numeric: tabular-nums; }
            /* ESTADO ATIVO (#3): salvo = bookmark (is-bookmarked, nativo) · reagido = classe do XF (is-reacted/reaction--active) → cor do tema + fundinho */
            html.smg-thread .smg-pc-act--save.is-bookmarked { color: var(--smg-link, #ff77b2) !important; background: var(--smg-link-soft, rgba(255,119,178,0.13)); }
            html.smg-thread .smg-pc-act--react.is-reacted, html.smg-thread .smg-pc-act--react.reaction--active, html.smg-thread .smg-cc-act--react.is-reacted, html.smg-thread .smg-cc-act--react.reaction--active { color: var(--smg-link, #ff77b2) !important; background: var(--smg-link-soft, rgba(255,119,178,0.13)); }
            /* REACT: cor NEUTRA (ícone + número + texto iguais aos outros) — o azul nativo fazia parecer "já reagi" */
            html.smg-thread .smg-pc-act--react { color: rgba(255,255,255,0.72) !important; }
            html.smg-thread .smg-cc-act--react { color: rgba(255,255,255,0.65) !important; }
            html.smg-thread .smg-pc-act--react *, html.smg-thread .smg-cc-act--react * { color: inherit !important; }
            html.smg-thread .smg-pc-act--react:hover, html.smg-thread .smg-cc-act--react:hover { color: #fff !important; }
            /* react = CONTADOR: esconde o visual nativo (sprite/<i>/emoji/"React" = a "asa" torta), usa ícone limpo + "N reações" */
            html.smg-thread .smg-pc-act--react > i, html.smg-thread .smg-pc-act--react .reaction-sprite, html.smg-thread .smg-pc-act--react .reaction-image, html.smg-thread .smg-pc-act--react .reaction-text,
            html.smg-thread .smg-cc-act--react > i, html.smg-thread .smg-cc-act--react .reaction-sprite, html.smg-thread .smg-cc-act--react .reaction-image, html.smg-thread .smg-cc-act--react .reaction-text { display: none !important; }
            html.smg-thread .smg-pc-react-ic, html.smg-thread .smg-cc-react-ic { display: inline-flex; align-items: center; }
            html.smg-thread .smg-pc-react-ic svg, html.smg-thread .smg-cc-react-ic svg { width: 16px; height: 16px; }
            /* CONTENT: texto maior que a action bar (hierarquia) */
            html.smg-thread .smg-pc .message-content, html.smg-thread .smg-pc .message-content .bbWrapper { font-size: 15px; line-height: 1.55; }
            /* PILLS de reação ESCONDIDAS (escolha do user): misturam joypixels + emojione (medal) = impossível alinhar a arte.
               O contador "N reações" na action bar já mostra o total (lê as contagens do DOM, que continua aqui em display:none). */
            html.smg-thread .smg-pc .reactionsBar, html.smg-thread .smg-pc .comment-reactions { display: none !important; }
            /* PILLS de reação (addon do site, post E comentário): chip limpo, emoji + contagem CENTRALIZADOS (estavam tortos: img inline na baseline) */
            html.smg-thread .smg-pc :is(.reactionsBar, .comment-reactions) .smgReactionPills { display: flex !important; flex-wrap: wrap; align-items: center !important; gap: 6px !important; margin: 0 !important; }
            html.smg-thread .smg-pc :is(.reactionsBar, .comment-reactions) .smgReactionPill { display: inline-flex !important; align-items: center !important; gap: 5px !important; margin: 0 !important; height: 26px !important; padding: 0 10px !important; border-radius: 999px !important; background: var(--smg-s3, rgba(255,255,255,0.08)) !important; text-decoration: none !important; line-height: 1 !important; box-sizing: border-box !important; }
            html.smg-thread .smg-pc :is(.reactionsBar, .comment-reactions) .smgReactionPill:hover { background: var(--smg-s2, rgba(255,255,255,0.16)) !important; }
            html.smg-thread .smg-pc :is(.reactionsBar, .comment-reactions) .smgReactionPill-img { width: 18px !important; height: 18px !important; min-width: 18px !important; max-width: 18px !important; display: block !important; flex: 0 0 auto !important; margin: 0 !important; padding: 0 !important; object-fit: contain !important; vertical-align: middle !important; }
            html.smg-thread .smg-pc :is(.reactionsBar, .comment-reactions) .smgReactionPill-count { font-size: 12px !important; font-weight: 700 !important; color: rgba(255,255,255,0.85) !important; font-variant-numeric: tabular-nums; line-height: 1 !important; }
            /* ⋯ overflow */
            html.smg-thread .smg-pc-morewrap { position: relative; margin-left: auto; }
            html.smg-thread .smg-pc-act--more { font-size: 18px; padding: 0 12px; }
            html.smg-thread .smg-pc-morepop { position: absolute; right: 0; bottom: calc(100% + 6px); display: none; flex-direction: column; gap: 2px; min-width: 168px; padding: 6px; z-index: 50; background: var(--smg-s2, #1c1d22); border: 1px solid var(--smg-bd2, rgba(255,255,255,0.12)); border-radius: 12px; box-shadow: 0 14px 38px rgba(0,0,0,0.55); }
            html.smg-thread .smg-pc-morewrap.open .smg-pc-morepop { display: flex; }
            html.smg-thread .smg-pc-morerow { display: flex !important; align-items: center; gap: 8px; height: 36px; padding: 0 10px; border-radius: 8px; background: transparent; color: rgba(255,255,255,0.85); font-size: 13.5px; font-weight: 600; text-align: left; text-decoration: none; white-space: nowrap; cursor: pointer; }
            html.smg-thread .smg-pc-morerow:hover { background: var(--smg-s3, rgba(255,255,255,0.08)); color: #fff; }
            /* DISCUSSÃO (social): badge + indicador "silent" no header do post */
            html.smg-thread .smg-pc-idline .smg-discussion-badge { font-size: 10px; font-weight: 800; letter-spacing: .04em; padding: 1px 6px; border-radius: 5px; background: var(--smg-link-soft, rgba(255,119,178,0.18)); color: var(--smg-link, #ff77b2); }
            html.smg-thread .smg-pc-idline .smg-silent-indicator { font-size: 11px; color: rgba(255,255,255,0.4); display: inline-flex; align-items: center; gap: 3px; }

            /* ============================================================
               COMENTÁRIOS (uw_fcs, SMG): modernos, indentados sob o post (thread-line). Mesmo modelo do card.
               ============================================================ */
            html.smg-thread .smg-pc .message-responses { margin-top: 4px; padding: 4px 22px 18px; }
            /* HEADER da seção de comentários: faixa destacada (full-width via margin negativa que cancela o padding da section) + dividers em cima/embaixo.
               !important + escopo .smg-pc → ganha do neutralize/tema. align-items:center + line-height:1 centralizam ícone · nº · "Comments". */
            html.smg-thread .smg-pc .uw-comment-count { display: flex !important; flex-wrap: wrap; align-items: center !important; gap: 8px; margin: 6px -22px 12px !important; padding: 13px 22px !important; font-size: 14px; font-weight: 800; line-height: 1; color: #fff; background: var(--smg-s2, rgba(255,255,255,0.05)) !important; border-top: 1px solid var(--smg-bd2, rgba(255,255,255,0.12)) !important; border-bottom: 1px solid var(--smg-bd2, rgba(255,255,255,0.12)) !important; }
            html.smg-thread .smg-pc .uw-comment-count .mdi { font-size: 16px; line-height: 1; display: inline-flex; align-items: center; opacity: 0.85; }
            html.smg-thread .smg-pc .uw-comment-count .comment-count { color: var(--smg-link, #ff77b2); line-height: 1; }   /* nº em destaque (cor do tema) */
            html.smg-thread .smg-pc .uw-fcs-sort-toggle { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }   /* sort no canto DIREITO do header */
            html.smg-thread .smg-pc .uw-fcs-sort-sep { display: none; }   /* tira o "|" separador */
            html.smg-thread .smg-pc .smg-cbar-sortlbl { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); white-space: nowrap; }   /* label "Sort:" antes do chip */
            /* "Top reacted" → chip de sort à direita */
            html.smg-thread .smg-pc .uw-fcs-sort-btn { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border: 1px solid var(--smg-bd2, rgba(255,255,255,0.14)); border-radius: 999px; background: var(--smg-s1, #16171b); color: rgba(255,255,255,0.78); font-size: 12px; font-weight: 700; line-height: 1; text-decoration: none !important; white-space: nowrap; }
            html.smg-thread .smg-pc .uw-fcs-sort-btn:hover { background: var(--smg-s3, rgba(255,255,255,0.08)); color: #fff; border-color: var(--smg-bd2, rgba(255,255,255,0.25)); }
            html.smg-thread .smg-pc .uw-fcs-sort-btn i { font-size: 12px; opacity: .85; }
            /* "Previous comments" → botão paginador (linha própria, full-width — flex-basis 100% quebra a linha) */
            html.smg-thread .smg-pc .uw_load_prev { flex: 0 0 100%; display: block; box-sizing: border-box; margin: 11px 0 1px; padding: 9px; border: 1px solid var(--smg-bd2, rgba(255,255,255,0.12)); border-radius: 10px; background: var(--smg-s1, #16171b); color: var(--smg-link, #ff77b2); font-size: 13px; font-weight: 700; text-align: center; text-decoration: none !important; }
            html.smg-thread .smg-pc .uw_load_prev:hover { background: var(--smg-s3, rgba(255,255,255,0.08)); border-color: var(--smg-bd2, rgba(255,255,255,0.22)); }
            html.smg-thread .smg-cc { position: relative; margin: 0; padding: 13px 0 13px 16px; border-left: 2px solid var(--smg-bd2, rgba(255,255,255,0.12)); border-bottom: 1px solid var(--smg-bd, rgba(255,255,255,0.07)); }
            html.smg-thread .smg-cc .comment-inner { display: block; }
            html.smg-thread .smg-cc .comment-avatar { display: none; }                              /* movido pro head */
            html.smg-thread .smg-cc .comment-content { display: none; }                             /* user/tempo/# movidos */
            html.smg-thread .smg-cc .comment-footer .comment-actionBar { display: none; }            /* movido p/ smg-cc-actions (pills .comment-reactions ficam) */
            html.smg-thread .smg-cc .comment-footer .js-historyTarget { display: none; }
            html.smg-thread .smg-cc-head { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
            html.smg-thread .smg-cc-avatar { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; flex: 0 0 auto; }
            html.smg-thread .smg-cc-avatar img, html.smg-thread .smg-cc-avatar span { width: 100% !important; height: 100% !important; object-fit: cover; display: flex; align-items: center; justify-content: center; }
            html.smg-thread .smg-cc-idline { display: flex; align-items: baseline; gap: 6px; min-width: 0; flex-wrap: wrap; flex: 1 1 auto; }
            html.smg-thread .smg-cc-name { font-size: 13px; font-weight: 700; text-decoration: none; }
            html.smg-thread .smg-cc-name:hover { text-decoration: underline; }
            html.smg-thread .smg-cc-time { color: rgba(255,255,255,0.5); font-size: 12px; }
            html.smg-thread .smg-cc-num { margin-left: auto; color: rgba(255,255,255,0.4); font-size: 12px; text-decoration: none; }
            html.smg-thread .smg-cc-num:hover { color: rgba(255,255,255,0.72); }
            html.smg-thread .smg-cc .comment-body { font-size: 14px; line-height: 1.5; }
            html.smg-thread .smg-cc-actions { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; margin-top: 6px; }
            html.smg-thread .smg-cc-act { display: inline-flex !important; align-items: center; gap: 6px; height: 30px; margin: 0 !important; padding: 0 10px !important; border-radius: 8px; background: transparent; border: 0; color: rgba(255,255,255,0.65); font-size: 12.5px; font-weight: 600; line-height: 1; cursor: pointer; text-decoration: none; white-space: nowrap; transition: background .12s ease, color .12s ease; }
            html.smg-thread .smg-cc-act:hover { background: var(--smg-s3, rgba(255,255,255,0.08)); color: #fff; }
            html.smg-thread .smg-cc-act svg { width: 14px; height: 14px; }
            html.smg-thread .smg-cc-act > i { font-size: 14px; }
            html.smg-thread .smg-cc-act .reaction-image, html.smg-thread .smg-cc-act .reaction-sprite { width: 16px; height: 16px; }
            html.smg-thread .smg-cc-act--more { margin-left: auto; font-size: 16px; }
            html.smg-thread .smg-cc-react-n { font-weight: 600; font-variant-numeric: tabular-nums; }
            html.smg-thread .smg-cc .comment-reactions { margin-top: 7px; }
            /* matar o "quadrado cinza" do tema nos comentários → integra no card; mantém só o thread-line do .smg-cc */
            html.smg-thread .smg-pc .message-responses, html.smg-thread .smg-pc .message-responseRow:not(.uw-comment-count), html.smg-thread .smg-pc .uw_fcs_comment_section,
            html.smg-thread .smg-cc, html.smg-thread .smg-cc .comment-inner, html.smg-thread .smg-cc .comment-main, html.smg-thread .smg-cc .comment-content { background: transparent !important; box-shadow: none !important; }
            html.smg-thread .smg-pc .message-responseRow:not(.uw-comment-count), html.smg-thread .smg-cc .comment-inner, html.smg-thread .smg-cc .comment-main, html.smg-thread .smg-cc .comment-content { border: 0 !important; }
            /* editor "escrever comentário": blend escuro (era um quadrado claro do tema) */
            html.smg-thread .smg-pc .editorPlaceholder-placeholder .input { background: var(--smg-s2, #1c1d22) !important; border: 1px solid var(--smg-bd2, rgba(255,255,255,0.1)) !important; border-radius: 10px !important; color: rgba(255,255,255,0.6) !important; }
            /* ---- editor Froala (reply / comentário / conversa): vinha CLARO (destoava do tema escuro) → escurece toolbar, área de edição e dropdowns ---- */
            /* RING ÚNICO: a borda do editor vive SÓ no .fr-box (filhos com border 0) — o tema desenhava
               border-top azul no toolbar + border-bottom azul no second-toolbar, parecendo um anel quebrado.
               SEM overflow:hidden no box (clipava os dropdowns absolutos do toolbar) → cantos arredondados
               explícitos nos filhos das pontas. */
            :is(html.smg-sc, html.smg-smg) .fr-box.fr-basic {
                border: 1px solid var(--smg-bd2, rgba(255,255,255,0.14)) !important;
                border-radius: 12px !important; box-shadow: none !important;
                transition: border-color .15s ease;
            }
            :is(html.smg-sc, html.smg-smg) .fr-box.fr-basic .fr-toolbar {
                background: var(--smg-s2, #1c1d22) !important; color: var(--smg-tx, #e7e7ea) !important;
                border: 0 !important; border-bottom: 1px solid var(--smg-bd, rgba(255,255,255,0.1)) !important;
                border-radius: 11px 11px 0 0 !important; box-shadow: none !important;
            }
            :is(html.smg-sc, html.smg-smg) .fr-box.fr-basic .fr-toolbar .fr-more-toolbar { background: var(--smg-s2, #1c1d22) !important; border: 0 !important; box-shadow: none !important; }
            :is(html.smg-sc, html.smg-smg) .fr-box.fr-basic .fr-second-toolbar {
                background: var(--smg-s2, #1c1d22) !important; color: var(--smg-tx, #e7e7ea) !important;
                border: 0 !important; border-radius: 0 0 11px 11px !important; box-shadow: none !important;
            }
            :is(html.smg-sc, html.smg-smg) .fr-box.fr-basic .fr-wrapper { background: var(--smg-s1, #16171b) !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
            :is(html.smg-sc, html.smg-smg) .fr-box.fr-basic .fr-element.fr-view { color: var(--smg-tx, #e7e7ea) !important; }
            :is(html.smg-sc, html.smg-smg) .fr-box.fr-basic .fr-placeholder { color: rgba(255,255,255,0.38) !important; }
            :is(html.smg-sc, html.smg-smg) .fr-toolbar .fr-btn, :is(html.smg-sc, html.smg-smg) .fr-toolbar .fr-btn i, :is(html.smg-sc, html.smg-smg) .fr-toolbar .fr-btn svg { color: rgba(255,255,255,0.72) !important; }
            :is(html.smg-sc, html.smg-smg) .fr-toolbar .fr-btn.fr-disabled, :is(html.smg-sc, html.smg-smg) .fr-toolbar .fr-btn.fr-disabled i { color: rgba(255,255,255,0.28) !important; }
            :is(html.smg-sc, html.smg-smg) .fr-toolbar .fr-btn:not(.fr-disabled):hover { background: var(--smg-s3, rgba(255,255,255,0.08)) !important; }
            :is(html.smg-sc, html.smg-smg) .fr-toolbar .fr-btn.fr-active { color: var(--smg-link, #ff77b2) !important; }
            :is(html.smg-sc, html.smg-smg) .fr-dropdown-menu { background: var(--smg-s1, #16171b) !important; box-shadow: 0 6px 20px rgba(0,0,0,0.45) !important; }
            :is(html.smg-sc, html.smg-smg) .fr-dropdown-menu .fr-dropdown-wrapper { background: transparent !important; }
            :is(html.smg-sc, html.smg-smg) .fr-dropdown-menu .fr-dropdown-list a, :is(html.smg-sc, html.smg-smg) .fr-dropdown-menu .fr-dropdown-list a * { color: var(--smg-tx, #e7e7ea) !important; }
            :is(html.smg-sc, html.smg-smg) .fr-dropdown-menu .fr-dropdown-list a:hover { background: var(--smg-s3, rgba(255,255,255,0.08)) !important; }
            /* foco no editor: o RING (borda do .fr-box) acende no acento — mesma linguagem dos inputs */
            :is(html.smg-sc, html.smg-smg) .fr-box.fr-basic:focus-within { border-color: var(--smg-link, #ff77b2) !important; }
            /* QUOTE dentro do EDITOR (blockquote do Froala ao citar um post): mesmo visual dos quotes
               renderizados no post (.smg-pc .bbCodeBlock) — inset escuro + filete no ACENTO. O caixote
               azul-claro com borda azul era o estilo nativo do editor do XF. */
            :is(html.smg-sc, html.smg-smg) .fr-element blockquote {
                background: rgba(0,0,0,0.22) !important;
                border: 1px solid rgba(255,255,255,0.08) !important;
                border-left: 3px solid var(--smg-link, #ff77b2) !important;
                border-radius: 12px !important;
                margin: 10px 0 !important; padding: 11px 15px !important;
                color: rgba(255,255,255,0.85) !important;
            }
            /* nome do autor citado (o XF desenha via ::before com attr(data-quote)) → acento + peso */
            :is(html.smg-sc, html.smg-smg) .fr-element blockquote::before {
                color: var(--smg-link, #ff77b2) !important;
                font-weight: 700 !important; font-size: 12.5px !important; opacity: 1 !important;
            }
            :is(html.smg-sc, html.smg-smg) .fr-element blockquote img { border-radius: 8px; }
            /* PREVIEW do editor (aba de pré-visualização): quote renderizado ganha o MESMO inset dos posts
               (o .smg-pc não alcança aqui — o preview vive dentro do form, fora do card de post) */
            :is(html.smg-sc, html.smg-smg) .xfPreview .bbCodeBlock {
                background: rgba(0,0,0,0.22) !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 12px !important;
            }
            :is(html.smg-sc, html.smg-smg) .xfPreview .bbCodeBlock .contentRow, :is(html.smg-sc, html.smg-smg) .xfPreview .bbCodeBlock-content { background: transparent !important; }

            /* ===== QUICK REPLY (rodapé da thread): card no padrão dos posts (.smg-pc) =====
               Sai a coluna cinza do avatar (decoração — é o seu próprio), o editor ocupa o card todo
               e a botoeira entra no tema: Post Content = acento · Add Discussion = secundário ·
               extras (.button--link, ex. ImagePond) = chip fantasma à ESQUERDA. */
            html.smg-thread form.js-quickReply .block-container {
                background: var(--smg-s1, #16171b) !important; border: 1px solid rgba(255,255,255,0.11) !important;
                border-radius: 18px !important; box-shadow: none !important; overflow: hidden;
            }
            html.smg-smg.smg-thread form.js-quickReply .block-container { --smg-s1: hsl(0 0% 12.5%); --smg-s2: hsl(0 0% 16%); --smg-s3: hsl(0 0% 21%); }   /* mesmas superfícies dos cards (.smg-pc) */
            html.smg-thread form.js-quickReply .block-body { background: transparent !important; border: 0 !important; padding: 0 !important; }
            html.smg-thread .message--quickReply { background: transparent !important; border: 0 !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
            html.smg-thread .message--quickReply .message-inner { display: block !important; }
            html.smg-thread .message--quickReply .message-cell--user { display: none !important; }
            html.smg-thread .message--quickReply .message-cell--main {
                width: 100% !important; max-width: none !important; padding: 16px 18px !important;
                border: 0 !important; background: transparent !important;
            }
            /* botoeira: extras à esquerda, ações primárias empurradas pra DIREITA */
            html.smg-thread form.js-quickReply .formButtonGroup { display: flex !important; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px; float: none !important; }
            html.smg-thread form.js-quickReply .formButtonGroup-primary { display: flex !important; gap: 8px; order: 9; margin-left: auto; float: none !important; }
            html.smg-thread form.js-quickReply .formButtonGroup .button {
                min-height: 40px; padding: 0 18px; margin: 0 !important;
                border-radius: 11px !important; box-shadow: none !important;
                font-size: 13.5px !important; font-weight: 600 !important;
                display: inline-flex !important; align-items: center; gap: 7px;
                background: var(--smg-s2) !important; border: 1px solid var(--smg-bd2) !important; color: rgba(255,255,255,0.85) !important;
                transition: background .14s ease, color .14s ease, filter .14s ease, transform .12s ease;
            }
            html.smg-thread form.js-quickReply .formButtonGroup .button:hover { background: var(--smg-s3) !important; color: #fff !important; }
            html.smg-thread form.js-quickReply .formButtonGroup .button:active { transform: scale(0.97); }
            html.smg-thread form.js-quickReply .formButtonGroup .button--primary {
                background: var(--smg-link-strong, #d14d8f) !important; border: 0 !important; color: #fff !important; font-weight: 700 !important; padding: 0 22px;
            }
            html.smg-thread form.js-quickReply .formButtonGroup .button--primary:hover { background: var(--smg-link-strong, #d14d8f) !important; filter: brightness(1.12); }
            html.smg-thread form.js-quickReply .formButtonGroup .button--link {
                background: transparent !important; border: 1px solid var(--smg-bd) !important; color: rgba(255,255,255,0.55) !important;
            }
            html.smg-thread form.js-quickReply .formButtonGroup .button--link:hover { background: var(--smg-s2) !important; color: #fff !important; }
            @media (max-width: 600px) {
                html.smg-thread form.js-quickReply .block-container { border-radius: 14px !important; }
                html.smg-thread .message--quickReply .message-cell--main { padding: 12px 13px !important; }
            }
        `;

        const CSS_FEED = `/* ============ river de posts (modo Feed da /watched/threads) ============ */
            /* modo feed: o JS marca .smg-river-hide nos irmãos do river (lista nativa + filtro + paginação) → robusto, independe da classe do bloco do tema */
            .smg-river-hide { display: none !important; }
            html.smg-watched-feed .structItemContainer { display: none !important; }   /* flash-kill: a lista some já no document-start, antes do JS rodar (no-op na home) */
            html.smg-watched-feed .p-body-sidebar { display: none !important; }   /* feed limpo (sem sidebar de stats/online) */
            html.smg-watched-feed .notices--block { display: none !important; }   /* flash-kill: banner nativo de avisos some já; o JS recoloca o megafone no header do river */
            #smg-river { display: none; }
            html.smg-watched-feed #smg-river { display: block; }
            /* header do feed: título grande "Feed" + slot de ações (ícone de notices) à direita. Substitui a antiga tabbar. */
            .smg-river-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 26px 0 18px; padding: 0 0 14px; border-bottom: 1px solid var(--smg-bd, rgba(255,255,255,0.10)); }   /* margin-top 26px = respiro abaixo da topbar (casa com .p-body-header) */
            @media (max-width: 600px) { .smg-river-head { margin-top: 16px; } }
            .smg-river-title { margin: 0; padding: 0; font-size: 26px; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; color: #fff; }
            .smg-river-head-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
            .smg-fp-list { display: flex; flex-direction: column; gap: 14px; }
            .smg-fp-loading { position: relative; min-height: 120px; display: flex; align-items: center; justify-content: center; padding: 60px 0; }   /* position:relative → o .smg-loading (absolute/inset:0) centraliza AQUI, não na viewport */
            .smg-fp-empty { padding: 60px 16px; text-align: center; font-size: 14.5px; color: rgba(255,255,255,0.45); }
            /* 1ª configuração do feed (cache vazio): estado rico (spinner rosa + título + subtítulo) em vez de spinner mudo */
            .smg-fp-setup { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; padding: 76px 24px; text-align: center; }
            .smg-fp-setup-spin { width: 42px; height: 42px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.13); border-top-color: var(--smg-link, #ff77b2); animation: smg-spin 0.8s linear infinite; }
            .smg-fp-setup-title { font-size: 18px; font-weight: 800; letter-spacing: -0.01em; color: #fff; }
            .smg-fp-setup-sub { font-size: 13.5px; line-height: 1.45; color: rgba(255,255,255,0.5); max-width: 340px; font-variant-numeric: tabular-nums; }
            .smg-fp-setup-bar { width: 220px; max-width: 70vw; height: 5px; border-radius: 3px; background: rgba(255,255,255,0.1); overflow: hidden; }
            .smg-fp-setup-barfill { display: block; width: 0; height: 100%; border-radius: 3px; background: var(--smg-link, #ff77b2); transition: width .3s ease; }
            /* BOOKMARKS como feed (replace total da lista nativa): some a sidebar da conta + conteúdo a 100% (mata o layout de 2 colunas) */
            html.smg-bm-feed-on .p-body-sideNav,
            html.smg-bm-feed-on .p-body-sideNavCol { display: none !important; width: 0 !important; }   /* a COLUNA (.p-body-sideNavCol{width:250px}) é quem reservava o espaço */
            html.smg-bm-feed-on .p-body-main--withSideNav { display: block !important; grid-template-columns: none !important; gap: 0 !important; }
            html.smg-bm-feed-on .p-body-main--withSideNav .p-body-content,
            html.smg-bm-feed-on .p-body-main--withSideNav .p-body-contentCol,
            html.smg-bm-feed-on .p-body-pageContent {
                width: 100% !important; max-width: 100% !important; min-width: 0 !important;
                flex: 1 1 100% !important; grid-column: 1 / -1 !important; float: none !important; padding-left: 0 !important; margin-left: 0 !important;
            }
            #smg-bm-feed { width: 100%; margin-top: 2px; }
            #smg-bm-feed .smg-fp-list { width: 100%; }
            .smg-bm-remove { flex: 0 0 auto; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; margin: -2px 0 0 0; border: 0; border-radius: 9px; background: transparent; color: rgba(255,255,255,0.45); cursor: pointer; transition: background .14s ease, color .14s ease, opacity .14s ease; }
            .smg-bm-remove:hover { background: rgba(244,63,94,0.14); color: #fb7185; }
            .smg-bm-remove svg { width: 18px; height: 18px; fill: none !important; }
            .smg-bm-remove.is-busy { opacity: 0.5; pointer-events: none; }
            .smg-fp-card.smg-bm-leaving { opacity: 0; transform: scale(0.97); transition: opacity .24s ease, transform .24s ease; }
            .smg-bm-note { margin: 0 0 10px; padding: 8px 12px; border-left: 3px solid var(--smg-link, #ff77b2); background: var(--smg-link-soft, rgba(255,119,178,0.10)); border-radius: 6px; font-size: 13.5px; line-height: 1.4; color: var(--smg-tx, #e7e7ea); }
            .smg-bm-skel { width: 100%; min-height: 180px; margin: 0 0 14px; border-radius: 12px; background: var(--smg-s2, rgba(255,255,255,0.05)); position: relative; overflow: hidden; }
            .smg-bm-skel::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent); animation: smg-skel-shimmer 1.3s ease-in-out infinite; }
            .smg-river-more { position: relative; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 22px; margin: 6px 0 0; padding: 14px 0; border: 1px solid var(--smg-bd, rgba(255,255,255,0.1)); border-radius: 12px; background: var(--smg-s1, #16171b); color: rgba(255,255,255,0.72); font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: background .15s ease, color .15s ease; }
            .smg-river-more:hover { color: #fff; background: var(--smg-s2, rgba(255,255,255,0.06)); }
            .smg-river-more .smg-loading { position: static; inset: auto; display: none; }   /* dentro do botão o spinner é INLINE (não overlay), oculto até is-loading */
            .smg-river-more .smg-loading::after { width: 18px; height: 18px; border-width: 2px; }   /* menor: cabe no botão */
            .smg-river-more.is-loading { cursor: default; }
            .smg-river-more.is-loading .smg-loading { display: flex; }
            .smg-river-more.is-loading .smg-river-more-t { display: none; }
            /* pílula "N novos posts" (flutua no topo, estilo Twitter) */
            .smg-river-pill { position: fixed; top: 72px; left: 50%; transform: translateX(-50%); z-index: 60; display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px 8px 12px; border: 0; border-radius: 999px; background: var(--smg-link, #ff77b2); color: #fff; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,0.45); }
            .smg-river-pill[hidden] { display: none; }
            .smg-river-pill:hover { filter: brightness(1.08); }
            .smg-river-pill svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
            /* card = mesmo visual do post (.smg-pc): coluna, surface s1, rounded 18, hover com sombra */
            .smg-fp-card { background: var(--smg-s1, #16171b); border: 1px solid rgba(255,255,255,0.11); border-radius: 18px; overflow: hidden; transition: border-color .16s ease, box-shadow .16s ease; }
            .smg-fp-card:hover { border-color: rgba(255,255,255,0.22); box-shadow: 0 4px 18px rgba(0,0,0,0.35); }
            .smg-fp-card.is-unread { border-color: var(--smg-link, #ff77b2); }
            /* ENTRADA dos posts novos (insertFreshPosts): fade + slide + glow rosa que esvai → não "pisam do nada" */
            @keyframes smg-fp-in { from { opacity: 0; transform: translateY(-10px) scale(.99); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes smg-fp-glow { 0% { box-shadow: 0 0 0 1px var(--smg-link, #ff77b2), 0 6px 26px rgba(255,119,178,0.28); } 100% { box-shadow: 0 0 0 0 rgba(255,119,178,0); } }
            .smg-fp-card.smg-fp-enter { animation: smg-fp-in .42s cubic-bezier(.2,.7,.3,1) both, smg-fp-glow 1.2s ease-out; }
            @media (prefers-reduced-motion: reduce) { .smg-fp-card.smg-fp-enter { animation: none; } }
            html.smg-smg .smg-fp-card { --smg-s1: hsl(0 0% 12.5%); }   /* SMG: mesma superfície do SimpCity (igual o post card) */
            /* HEADER: [foto da thread]  ·  tags / nome do tópico / postado por — divisor border-b */
            .smg-fp-head { display: flex; align-items: flex-start; gap: 14px; padding: 16px 22px 14px; border-bottom: 1px solid var(--smg-bd, rgba(255,255,255,0.08)); }
            .smg-fp-thumb { flex: 0 0 auto; width: 54px; height: 54px; border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.06); display: block; }
            .smg-fp-thumb img { width: 100% !important; height: 100% !important; object-fit: cover; display: block; }
            .smg-fp-thumb--letter { display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #fff; background: linear-gradient(135deg, #7c5cff, #c54b8c); }   /* sem thumb / .su morto → inicial do tópico */
            .smg-fp-meta { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
            .smg-fp-tags { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
            .smg-fp-tags:empty { display: none; }
            .smg-fp-tags > * { font-size: 11px !important; line-height: 1; vertical-align: middle; }   /* prefixo = chip (mantém a cor nativa do label, injetado via innerHTML) */
            .smg-fp-tname { font-size: 15.5px; font-weight: 700; color: #fff; text-decoration: none; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .smg-fp-tname:hover { text-decoration: underline; }
            .smg-fp-by { font-size: 12.5px; color: rgba(255,255,255,0.45); }
            .smg-fp-share { flex: 0 0 auto; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; margin: -2px -6px 0 4px; border: 0; border-radius: 9px; background: transparent; color: rgba(255,255,255,0.45); cursor: pointer; transition: background .14s ease, color .14s ease; }
            .smg-fp-share:hover { background: var(--smg-link-soft, rgba(255,255,255,0.1)); color: #fff; }
            .smg-fp-share.is-done { color: var(--smg-link, #ff77b2); }
            .smg-fp-share svg { width: 17px; height: 17px; fill: none !important; }
            .smg-fp-byname { color: rgba(255,255,255,0.7); font-weight: 600; text-decoration: none; }
            .smg-fp-byname:hover { color: #fff; text-decoration: underline; }
            .smg-fp-dot { color: rgba(255,255,255,0.3); }
            .smg-fp-time { white-space: nowrap; }
            /* CONTEÚDO: full-width, sem caixa escura, texto 15px (= .smg-pc .message-content) */
            .smg-fp-content { padding: 16px 22px 10px; font-size: 15px; line-height: 1.55; color: rgba(255,255,255,0.9); word-break: break-word; }
            .smg-fp-content--empty { padding: 16px 22px; color: rgba(255,255,255,0.4); font-style: italic; }
            .smg-fp-content img { max-width: 100% !important; height: auto; border-radius: 8px; }
            .smg-fp-cloading { display: flex; align-items: center; justify-content: center; padding: 24px 0; }
            /* FOOTER: "abrir no tópico" com divisor em cima (= action bar do post) */
            .smg-fp-open { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; padding: 12px 22px 14px; border-top: 1px solid var(--smg-bd, rgba(255,255,255,0.07)); font-size: 13px; font-weight: 600; text-decoration: none; color: var(--smg-link, #ff77b2); transition: gap .14s ease; }
            .smg-fp-open:hover { gap: 10px; }
            .smg-fp-open svg { width: 15px; height: 15px; fill: none; }
            @media (max-width: 600px) {
                .smg-fp-card { border-radius: 14px; }
                .smg-fp-head { padding: 13px 16px 11px; }
                .smg-fp-content { padding: 14px 16px 8px; }
                .smg-fp-open { padding: 11px 16px 13px; }
                .smg-river-title { font-size: 22px; }
            }
        `;

        const css = CSS_BASE + CSS_HOME + CSS_TOPBAR + CSS_MOBILE + CSS_FILTERBAR + CSS_THREAD + CSS_FEED;
        const style = document.createElement('style');
        style.textContent = css;

        // document-start: <head> pode ainda não existir → cai pro documentElement (o <style> aplica igual)
        (document.head || document.documentElement).appendChild(style);
    }

    // =========================================================
    // HELPERS: text / url
    // =========================================================

    function getBigUrl(url) {
        // imgbox NÃO segue a convenção .md/.th: thumb = thumbs2.imgbox.com/.../HASH_t.jpg,
        // original = images2.imgbox.com/.../HASH_o.jpg (o `_b` é um CROP quadrado, não serve). Sobe pro original.
        if (/\bimgbox\.com\//i.test(url) && /_t\.(?:jpe?g|png|gif|webp)(?:$|[?#])/i.test(url))
            return url.replace(/\/\/thumbs(\d*)\.imgbox\.com\//i, '//images$1.imgbox.com/').replace(/_t(\.(?:jpe?g|png|gif|webp))(?=$|[?#])/i, '_o$1');
        // pixhost: thumb = t{N}.pixhost.to/thumbs/{gal}/{file}  →  full = img{N}.pixhost.to/images/{gal}/{file}
        if (/\/\/t\d*\.pixhost\.to\/thumbs\//i.test(url))
            return url.replace(/\/\/t(\d*)\.pixhost\.to\/thumbs\//i, '//img$1.pixhost.to/images/');
        return url.replace('.md.', '.').replace('.th.', '.');
    }
    function isImgboxThumb(url) { return /\bimgbox\.com\//i.test(url) && /_t\.(?:jpe?g|png|gif|webp)(?:$|[?#])/i.test(url); }

    // inverso do getBigUrl: insere `.md.` antes da extensão → tier MÉDIO dos hosts que seguem a convenção
    // (imgbox/pixhost/…). Usado nos previews da galeria (tile = médio, perf; o feed abre o full no clique).
    // URL sem extensão de imagem reconhecida (ou que já é .md./.th.) volta intacta → quem usa cai no full por fallback.
    function getMedUrl(url) {
        if (!url || /\.(?:md|th)\./i.test(url)) return url;
        return url.replace(/(\.(?:jpe?g|png|gif|webp|avif|bmp))(\?|#|$)/i, '.md$1$2');
    }

    function cleanText(text) {
        return text.replace('.md', '').replace('.th', '');
    }

    // =========================================================
    // HELPERS: dom
    // =========================================================

    // estado de "seguindo" SEM depender de idioma: a label atual === data-sk-unwatch ⇒ seguindo
    // (o XF alterna o texto do botão entre data-sk-watch e data-sk-unwatch; comparamos com o attr)
    function smgIsWatching(w) {
        if (!w) return false;
        const label = ((w.querySelector('.button-text') || w).textContent || '').trim().toLowerCase();
        const un = (w.getAttribute('data-sk-unwatch') || '').trim().toLowerCase();
        return !!un && label === un;
    }

    function waitForElement(selector, timeout = 5000) {
        return new Promise(resolve => {
            const existing = document.querySelector(selector);

            if (existing) {
                resolve(existing);
                return;
            }

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);

                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    // GET same-origin → parseia a resposta HTML num Document. `opts` passam direto pro fetch:
    // alguns callers OMITEM X-Requested-With de propósito (querem a página inteira, não o parcial
    // AJAX do XF); outros mandam (querem o parcial). O .text()→parse é que era repetido em toda parte.
    function fetchDoc(url, opts) {
        return fetch(url, opts)
            .then(r => r.text())
            .then(html => new DOMParser().parseFromString(html, 'text/html'));
    }

    // monta um <form> POST oculto com os campos [nome, valor] e submete (navega p/ o resultado).
    // usado pela busca e pelo filtro da listagem — ambos POSTam pro endpoint nativo do XenForo.
    function postForm(action, fields) {
        const f = document.createElement('form');
        f.method = 'post';
        f.action = action;
        f.style.display = 'none';
        fields.forEach(([n, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); });
        document.body.appendChild(f);
        f.submit();
    }

    // href "seguro": neutraliza esquemas perigosos (javascript:/data:/vbscript:) vindos de href lidos
    // da página, deixando passar http(s)/relativo/âncora. Defesa contra href poisoned (servidor comprometido/XSS armazenado).
    function safeHref(url) {
        return /^\s*(javascript|data|vbscript):/i.test(url || '') ? '#' : (url || '#');
    }

    // roda fn em cada elemento que casa `selector` DENTRO dos roots dados (incluindo cada root, se ele
    // mesmo casar). No boot roots=[body] → varre o doc todo; numa mutação roots = subtrees recém-adicionados,
    // então os passes de conteúdo escapam do querySelectorAll no documento inteiro a cada frame.
    // fn DEVE ser idempotente (marca o nó) → dedup garantido mesmo se um nó casar por 2 roots.
    function eachIn(roots, selector, fn) {
        for (const root of roots) {
            if (!root || root.nodeType !== 1) continue;
            if (root.matches(selector)) fn(root);
            root.querySelectorAll(selector).forEach(fn);
        }
    }

    // listener de scroll throttled por requestAnimationFrame (no máx 1 fn por frame; passive).
    // o flag de "já agendado" fica encapsulado aqui (era repetido na dock/topbar/scroll infinito).
    function onScrollRaf(fn) {
        let tick = false;
        window.addEventListener('scroll', () => {
            if (tick) return;
            tick = true;
            requestAnimationFrame(() => { tick = false; fn(); });
        }, { passive: true });
    }

    // =========================================================
    // HELPERS: ui builders
    // =========================================================

    // base dos botões da dock: <button> ou <a> com o MESMO visual (id · classe · tamanho · ícone · tooltip).
    function makeDockEl(tag, { id, icon, label = '', fontSize = 20 }) {
        const el = document.createElement(tag);
        el.id = id;
        if (tag === 'button') el.type = 'button';
        el.className = 'smg-nav-btn';
        el.style.setProperty('--smg-btn-fs', fontSize + 'px');

        // icon-only: label vira tooltip (data-label) + aria-label
        if (label) {
            label = i18n(label);
            el.dataset.label = label;
            el.setAttribute('aria-label', label);
        }

        const ico = document.createElement('span');
        ico.className = 'smg-nav-ico';
        ico.innerHTML = icon;
        el.appendChild(ico);

        return el;
    }
    function makeDockButton(opts) { return makeDockEl('button', opts); }
    // botão que é link de navegação (mesmo visual da dock, mas <a>)
    function makeDockLink(opts) { const a = makeDockEl('a', opts); a.href = opts.href; return a; }

    function setBtnIcon(btn, icon) {
        const ico = btn.querySelector('.smg-nav-ico');
        if (ico) ico.innerHTML = icon;
    }

    // atualiza o tooltip/aria (label não é mais visível)
    function setBtnLabel(btn, label) {
        label = i18n(label);
        btn.dataset.label = label;
        btn.setAttribute('aria-label', label);
    }

    function makeDivider() {
        const divider = document.createElement('div');
        divider.className = 'smg-nav-divider';
        return divider;
    }

    function makeGroup(...buttons) {
        const group = document.createElement('div');
        group.className = 'smg-nav-group';
        buttons.filter(Boolean).forEach(btn => group.appendChild(btn));
        return group;
    }

    // arrastar pra baixo fecha (bottom sheets / modais mobile). Engata SÓ no topo (~64px = grip/header) → não
    // conflita com o scroll do conteúdo. isActive() opcional gate (ex.: só quando o sheet está aberto + mobile).
    function addSwipeClose(panel, closeFn, isActive) {
        if (!panel || typeof closeFn !== 'function') return;
        let y0 = 0, dy = 0, drag = false;
        panel.addEventListener('touchstart', e => {
            drag = false;
            if (e.touches.length !== 1) return;
            if (isActive && !isActive()) return;
            const r = panel.getBoundingClientRect();
            if (e.touches[0].clientY - r.top > 64) return;   // toque fora da zona do grip/header → deixa o scroll rolar
            drag = true; y0 = e.touches[0].clientY; dy = 0;
            panel.style.transition = 'none';
        }, { passive: true });
        panel.addEventListener('touchmove', e => {
            if (!drag) return;
            dy = e.touches[0].clientY - y0;
            if (dy > 0) panel.style.transform = 'translateY(' + dy + 'px)';
        }, { passive: true });
        panel.addEventListener('touchend', () => {
            if (!drag) return;
            drag = false;
            panel.style.transition = '';
            panel.style.transform = '';
            if (dy > 90) closeFn();   // passou do limiar → fecha (a transição do CSS leva pro translateY(100%))
        });
    }

    // =========================================================
    // HELPERS: paginação + estado compartilhado entre features
    // =========================================================

    // template de URL + página atual/total (dock goto, scroll infinito da thread e do feed).
    // A página atual vem da URL (/page-N) — confiável; o input do page-jump costuma vir
    // vazio/errado no document-end, o que bagunçava a dock e o ponto de partida do scroll.
    // Retorna null em thread de página única.
    function readPageJump() {
        const row = document.querySelector('[data-xf-init="page-jump"][data-page-url]');
        let tpl = row ? row.getAttribute('data-page-url') : null; // .../page-%page%
        if (!tpl) {
            // tema sem o menu page-jump: deriva o template de um link de paginação
            const href = Array.from(document.querySelectorAll('.pageNav a[href], .pageNavSimple a[href]'))
                .map(a => a.getAttribute('href') || '')
                .find(h => /\/page-\d+/.test(h));
            if (href) tpl = href.replace(/\/page-\d+/, '/page-%page%');
        }
        if (!tpl) return null; // página única

        const um = location.pathname.match(/\/page-(\d+)/);
        let cur = um ? parseInt(um[1], 10) : 1;

        // total: a maior página vista (links de paginação + "X of Y" + atributo max do input)
        let max = cur;
        document.querySelectorAll('.pageNav a[href], .pageNavSimple a[href]').forEach(a => {
            const m = (a.getAttribute('href') || '').match(/\/page-(\d+)/);
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        const simple = document.querySelector('.pageNavSimple-el--current')?.textContent.match(/(\d+)\s*of\s*(\d+)/i);
        if (simple) max = Math.max(max, parseInt(simple[2], 10) || 0);
        const im = parseInt(row?.querySelector('input[type="number"]')?.getAttribute('max') || '', 10);
        if (im) max = Math.max(max, im);

        return { tpl, cur: cur || 1, max: max || 1 };
    }

    // IntersectionObserver "once": ao entrar na viewport (rootMargin/threshold em opts), des-observa o
    // alvo e roda onEnter(alvo) UMA vez. Centraliza o padrão repetido (thumb/full/turbo/galeria/redgifs-load).
    // Retorna null se o browser não tiver IO → o caller cai no fallback de carregar na hora.
    function makeLazyIO(onEnter, opts) {
        if (!('IntersectionObserver' in window)) return null;
        return new IntersectionObserver((entries, obs) => {
            entries.forEach(en => { if (en.isIntersecting) { obs.unobserve(en.target); onEnter(en.target); } });
        }, opts || {});
    }

    // ── part 07-posts-misc: filtro por autor · atalhos de teclado · scroll infinito ──
    // =========================================================
    // FEATURE: filtrar posts por autor
    // =========================================================

    let authorFilter = null; // username em minúsculas, ou null = mostrar todos

    // setado pela dock; o scroll infinito chama pra atualizar o número da página exibido
    let smgUpdateDockPage = null;

    function applyAuthorFilter(full) {
        // por frame (scroll infinito) processa só os posts NOVOS; full=true (ao TROCAR o filtro) re-avalia todos
        const sel = full ? '.message--post' : '.message--post:not([data-smg-filt])';
        document.querySelectorAll(sel).forEach(p => {
            p.dataset.smgFilt = '1';
            const a = (p.getAttribute('data-author') || '').toLowerCase();
            p.style.display = (!authorFilter || a === authorFilter) ? '' : 'none';
        });
    }

    // =========================================================
    // FEATURE: atalhos de teclado (j/k navegação · g goto · / busca · f feed)
    // =========================================================

    let kbBound = false;

    function setupKeyboardShortcuts() {
        if (kbBound) return;
        kbBound = true;

        document.addEventListener('keydown', e => {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            // feed aberto tem os próprios atalhos (setas/espaço/esc)
            if (document.getElementById('smg-feed')?.classList.contains('open')) return;

            const click = id => document.getElementById(id)?.click();

            switch (e.key) {
                case 'j': click('smg-post-nav-down'); break;   // próximo post
                case 'k': click('smg-post-nav-up'); break;     // post anterior
                case 'g': click('smg-post-goto'); break;       // ir pra página
                case 'f': if (FEATURES.mediaFeed) openMediaFeed(null, null, { fromStart: true }); break;   // modo feed (navegação própria, página 1)
                case 'v': click('smg-view-toggle'); break;     // alterna lista/grade
                case '[': click('smg-post-page-prev'); break;  // página anterior
                case ']': click('smg-post-page-next'); break;  // próxima página
                case '/': e.preventDefault(); click('smg-thread-search'); break; // busca
                default: return;
            }
        });
    }

    // =========================================================
    // FEATURE: scroll infinito na thread (anexa as próximas páginas)
    // =========================================================

    let infScrollBound = false;

    // pager-sync do scroll infinito: espelha a página visível na URL + dock + paginadores (nativo e SMG).
    // Fábrica: encapsula shownPage; devolve a função chamada no listener de scroll do setupInfiniteScroll.
    function makePagerSync(startPage, originalUrl) {
        let shownPage = startPage;

        const currentSep = () => {
            const refY = 120; // linha de referência perto do topo
            const seps = document.querySelectorAll('.smg-inf-sep[data-page]');
            let sep = null;
            for (let i = 0; i < seps.length; i++) {   // separadores em ordem do DOM → tops monotônicos
                if (seps[i].getBoundingClientRect().top <= refY) sep = seps[i];
                else break;                            // 1º abaixo da linha → o resto também está → encerra
            }
            return sep;
        };

        const syncPage = () => {
            const sep = currentSep();
            const p = sep ? parseInt(sep.dataset.page, 10) : startPage;
            if (p === shownPage) return;
            shownPage = p;
            try { history.replaceState(history.state, '', sep ? sep.dataset.url : originalUrl); } catch {}
            if (typeof smgUpdateDockPage === 'function') smgUpdateDockPage(p);

            // "X of Y" do paginador simples (topo e rodapé)
            document.querySelectorAll('.pageNavSimple-el--current').forEach(el => {
                el.textContent = el.textContent.replace(/(\d+)(\s*of\s*\d+)/i, p + '$2');
            });

            // destaque "current" do paginador janelado — move o .pageNav-page--current
            // só se a página estiver na janela visível do pager (links têm /page-N; o "1" é a base)
            document.querySelectorAll('.pageNav-main').forEach(ul => {
                let target = null;
                ul.querySelectorAll('li.pageNav-page > a[href]').forEach(a => {
                    const m = (a.getAttribute('href') || '').match(/\/page-(\d+)/);
                    if ((m ? parseInt(m[1], 10) : 1) === p) target = a.parentElement;
                });
                if (!target) return; // página fora da janela do pager
                ul.querySelectorAll('.pageNav-page--current').forEach(li => li.classList.remove('pageNav-page--current'));
                target.classList.add('pageNav-page--current');
            });

            // espelha o "current" + o compacto cur/max na nossa barra única (SMG)
            document.querySelectorAll('.smg-bar-pages').forEach(pages => {
                let target = null;
                pages.querySelectorAll('a[href]').forEach(a => {
                    const m = (a.getAttribute('href') || '').match(/\/page-(\d+)/);
                    if ((m ? parseInt(m[1], 10) : 1) === p) target = a;
                });
                if (!target) return;
                pages.querySelectorAll('.smg-bar-btn--current').forEach(a => a.classList.remove('smg-bar-btn--current'));
                target.classList.add('smg-bar-btn--current');
            });
            document.querySelectorAll('.smg-bar-compact').forEach(c => { c.textContent = c.textContent.replace(/^\s*\d+/, p); });
        };
        return syncPage;
    }

    function setupInfiniteScroll() {
        if (infScrollBound) return;
        // página SEM paginação não ganha uma depois do load: marca como "resolvido" senão a detecção
        // inteira (querySelectors + readPageJump) re-roda TODO frame de processAll, pra sempre
        const settle = () => { if (document.readyState === 'complete') infScrollBound = true; };

        // contexto detectado por DOM (URLs de fórum do socialmediagirls não têm /forums/, ex.: /youtubers/)
        let container, itemSelector, fetchScope, keyOf = null;   // keyOf: dedup por thread (article view repete sticky por página)
        if (document.querySelector('.message--post')) {
            // thread (posts)
            container = document.querySelector('.message--post').parentElement;
            itemSelector = '.message--post';
            fetchScope = doc => doc;
        } else if (document.querySelector('.structItem--thread')) {
            // listagem de fórum/seguidas — container real (evita o grupo sticky, que repete em toda página)
            const pick = root => root.querySelector('.structItemContainer-group.js-threadList')
                || root.querySelector('.structItemContainer-group:not(.structItemContainer-group--sticky)')
                || (root.querySelector('.structItem--thread') || {}).parentElement
                || null;
            container = pick(document);
            itemSelector = '.structItem--thread';
            fetchScope = doc => pick(doc) || doc;
        } else if (document.querySelector('.smg-article-grid')) {
            // article view (forum_view_type_article): cards já movidos pro nosso grid; anexa os da próxima página nele
            container = document.querySelector('.smg-article-grid');
            itemSelector = '.message--articlePreview';
            fetchScope = doc => doc.querySelector('.block--articles') || doc;   // artigos da próxima página (no .block-body nativo do XF)
            keyOf = el => { const a = el.querySelector('.articlePreview-title a[href*="/threads/"]'); return a ? a.getAttribute('href').replace(/\/(unread|latest|page-\d+|post-\d+).*$/, '').replace(/\/$/, '') : null; };
        } else if (document.documentElement.getAttribute('data-template') === 'search_results') {
            // resultados de busca — só o conteúdo principal (evita o block-row da sidebar)
            const pick = root => {
                const scope = root.querySelector('.p-body-pageContent') || root;
                const r = scope.querySelector('.block-body > .block-row');
                return r ? r.parentElement : null;
            };
            container = pick(document);
            itemSelector = '.block-row';
            fetchScope = doc => pick(doc) || doc;
        } else {
            settle(); return;
        }
        if (!container) { settle(); return; }

        // segue o link "Next" REAL de cada página (robusto a qualquer formato de
        // paginação — /page-N, ?page=N, etc.); evita repetir a mesma página
        const nextLink = root => {
            const a = root.querySelector('.pageNav-jump--next, .pageNavSimple-el--next');
            return a ? a.getAttribute('href') : null;
        };
        const pageNumOf = url => {
            const m = (url || '').match(/(?:\/page-|[?&]page=)(\d+)/);
            return m ? parseInt(m[1], 10) : null;
        };

        let nextUrl = nextLink(document);
        if (!nextUrl) { settle(); return; } // página única ou já na última

        const pj = readPageJump();
        const startPage = pj ? pj.cur : 1;
        const originalUrl = location.pathname + location.search;

        infScrollBound = true;
        let loading = false;
        let done = false;
        let lastNum = startPage;
        // dedup (article view): registra as threads já presentes pra não repetir os sticky em cada página
        const seen = new Set();
        if (keyOf) container.querySelectorAll(itemSelector).forEach(el => { const k = keyOf(el); if (k) seen.add(k); });

        const check = () => {
            if (!FEATURES.infiniteScroll) return;   // desligar no settings para na hora (o observer fica, mas não carrega mais)
            if (loading || done || !nextUrl) return;
            if (document.getElementById('smg-feed')?.classList.contains('open')) return; // feed tem o seu próprio
            const rest = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
            if (rest > 1400) return;

            loading = true;
            const url = nextUrl;
            const num = pageNumOf(url) || (lastNum + 1);

            fetchDoc(url, { credentials: 'same-origin' })
                .then(doc => {
                    const items = fetchScope(doc).querySelectorAll(itemSelector);
                    if (!items.length) { done = true; nextUrl = null; return; }

                    // separador como <li> se o container for lista (ol/ul), senão <div>
                    const sep = document.createElement(/^(OL|UL)$/.test(container.tagName) ? 'li' : 'div');
                    sep.className = 'smg-inf-sep';
                    sep.dataset.page = num;  // p/ sincronizar o paginador
                    sep.dataset.url = url;   // URL real dessa página (p/ replaceState)
                    sep.textContent = i18n('Page') + ' ' + num;
                    container.appendChild(sep);

                    items.forEach(p => {
                        if (keyOf) { const k = keyOf(p); if (k && seen.has(k)) return; if (k) seen.add(k); }  // pula thread repetida (sticky)
                        container.appendChild(document.importNode(p, true));
                    });
                    lastNum = num;
                    nextUrl = nextLink(doc); // segue o "Next" da página recém-buscada
                    if (!nextUrl) done = true;
                    if (authorFilter) applyAuthorFilter();
                })
                .catch(() => {})
                .finally(() => { loading = false; });
        };

        // ---- sincroniza o paginador com o que está na tela (URL + número da dock + "X of Y") ----
        const syncPage = makePagerSync(startPage, originalUrl);

        onScrollRaf(() => { check(); syncPage(); });

        check();
    }

    // =========================================================
    // FEATURE: auto full images + portrait grid
    // =========================================================

    // 2 tiers de preload (anti-CLS no scroll rápido):
    //  · thumbIO (alcance GRANDE, 3000px): força a THUMB a carregar bem antes da viewport. Thumb é
    //    pequena/barata → fixa o tamanho da caixa cedo, então mesmo num fling a imagem já entra dimensionada.
    //  · fullIO (alcance médio, 1800px): troca pra full mais perto (qualidade). Como a thumb já carregou
    //    e tem a MESMA proporção, o swap não mexe no layout.
    let thumbIO = null, medIO = null;
    function getThumbIO() {   // tira a THUMB do lazy nativo (loading=eager) bem antes da viewport (3000px)
        return thumbIO || (thumbIO = makeLazyIO(el => { el.loading = 'eager'; }, { rootMargin: '3000px 0px' }));
    }
    function getMedIO() {     // troca pra MÉDIA (.md.) mais perto da tela (thumb já dá o tamanho → swap sem flash)
        return medIO || (medIO = makeLazyIO(img => {
            const med = img.dataset.smgMed;
            if (med && img.getAttribute('src') !== med) img.src = med;
        }, { rootMargin: '800px 0px' }));   // 800px: troca só perto (não compete com o redgifs)
    }

    // remove os <br> (+ whitespace) que separam DOIS chips de link adjacentes — post que é só lista de links (jpg6/jpg5 &
    // afins, sem img renderizável) ficava com um <br> entre cada → cascata de linhas vazias. Conservador: só colapsa o <br>
    // que tem um chip dos DOIS lados (não encosta em <br> que separa chip de TEXTO real). Cada chip limpa as próprias bordas →
    // a run inteira colapsa conforme os chips nascem (sync no unlazy, async no onerror): a borda comum é removida pelo chip mais tardio do par.
    function dropChipBreaks(chip) {
        if (!chip || !chip.parentNode) return;
        const isChip = n => n && n.nodeType === 1 && n.classList && n.classList.contains('smg-imglink-fallback');
        const skipWs = (n, dir) => { while (n && n.nodeType === 3 && !n.textContent.trim()) n = n[dir]; return n; };
        ['nextSibling', 'previousSibling'].forEach(dir => {
            for (;;) {
                const br = skipWs(chip[dir], dir);
                if (!(br && br.nodeType === 1 && br.tagName === 'BR')) break;
                if (!isChip(skipWs(br[dir], dir))) break;   // só remove <br> com chip dos dois lados
                let w = chip[dir];                          // do chip até o <br>: tira whitespace + o próprio <br>
                while (w && w !== br) { const nx = w[dir]; if (w.nodeType === 3 && !w.textContent.trim()) w.remove(); w = nx; }
                br.remove();
            }
        });
    }
    // se o href é um proxy do fórum (/goto/link-confirmation?url=.. ou /redirect/?to=..) → devolve o DESTINO real decodificado; senão devolve igual. decodeProxyHref vem do 21 (escopo compartilhado).
    function resolveProxyHref(h) { const r = decodeProxyHref(h || ''); return (r && /^https?:/i.test(r)) ? r : (h || ''); }
    // imagem que NÃO renderiza (host fora / hotlink / 404) → troca por um chip de link clicável (jpg6.su/jpg5 & afins)
    function imgFailLink(img) {
        if (!img || img.dataset.smgFailed || !img.parentNode) return;
        img.dataset.smgFailed = '1';
        const raw = img.dataset.smgLink || img.currentSrc || img.getAttribute('src') || '';
        if (!raw || /^data:/.test(raw)) { img.classList.add('smg-img-ready'); return; }   // sem destino útil → só tira o shimmer
        const href = resolveProxyHref(raw);   // mostra/abre a URL final, não o /goto/...&s=hash
        // se a img é o ÚNICO conteúdo do <a> wrapper (jpg6) → o próprio <a> vira o chip (evita <a> aninhado inválido e deixa o dropChipBreaks enxergar o chip); senão troca só a img
        const wrap = img.parentNode;
        let chip;
        if (wrap.tagName === 'A' && wrap.childElementCount === 1 && !(wrap.textContent || '').trim()) {
            wrap.innerHTML = ''; wrap.classList.add('link', 'link--external', 'smg-imglink-fallback');
            wrap.href = href; wrap.target = '_blank'; wrap.rel = 'noopener noreferrer'; wrap.textContent = href;
            chip = wrap;
        } else {
            chip = document.createElement('a');
            chip.href = href; chip.target = '_blank'; chip.rel = 'noopener noreferrer';
            chip.className = 'link link--external smg-imglink-fallback'; chip.textContent = href;
            img.replaceWith(chip);
        }
        dropChipBreaks(chip);
    }
    function processOneImage(img) {
        // guarda o link do host (jpg6.su/jpg5/…) ENQUANTO a img ainda está no <a> — ANTES do lazy-swap e da masonry mover (depois closest('a') falha) → fallback de link
        if (!img.dataset.smgLink) { const la = img.closest('a.link--external[href]'); if (la) img.dataset.smgLink = la.getAttribute('href') || ''; }
        const src = img.currentSrc || img.src || '';
        if (!/^https?:/i.test(src)) {                // placeholder lazy ainda sem URL real
            // tira da varredura por-mutação (data-smg-lazy-wait) e re-processa SÓ esta imagem quando o
            // lazy-loader setar o src (load/error). Antes ficava no loop, re-escaneada a cada mutação.
            // SEM timeout especulativo: espera o load nativo (loading=lazy), igual ao site padrão.
            if (!img.dataset.smgLazyWait) {
                img.dataset.smgLazyWait = '1';
                const reproc = () => { if (!img.dataset.smgLazyWait) return; delete img.dataset.smgLazyWait; processOneImage(img); };
                img.addEventListener('load', reproc, { once: true });
                img.addEventListener('error', reproc, { once: true });
            }
            return;
        }
        delete img.dataset.smgLazyWait;
        img.dataset.fullProcessed = 'true';          // EXAMINADA → fora das próximas varreduras
        img.decoding = 'async';                      // decode fora da thread principal (menos jank)
        img.classList.remove('lazyload', 'lazyloading');   // o FÓRUM faz .lazyload/.lazyloading{opacity:0} até revelar; a img já tem src http → tira senão fica invisível esperando o reveal
        // NADA de timeout-de-link: a img carrega nativa igual ao site padrão (que carrega de boa). Link de fallback SÓ em erro real (onerror) ou complete sem dimensão (404/hotlink) — abaixo. O timeout de 7s trocava imagem offscreen (naturalWidth 0 pq ainda não rolou até ela) por chip de link → "imagem não aparece" no nosso mod.

        // ao ganhar dimensão (thumb ou full), trava a proporção e tira o shimmer → caixa estável
        const onReady = () => {
            if (img.complete && !img.naturalWidth) { imgFailLink(img); return; }   // completou QUEBRADA (404/hotlink/host fora) → mostra o link no lugar
            if (img.naturalWidth && img.naturalHeight && !img.style.aspectRatio)
                img.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
            img.classList.add('smg-img-ready');
        };
        if (img.complete) onReady();                 // já resolvida (ok ou quebrada) → sem shimmer preso
        else {
            img.addEventListener('load', onReady, { once: true });
            img.addEventListener('error', () => imgFailLink(img), { once: true });   // não renderizou → link clicável (pedido do user)
        }

        // ANTI-PULO: NÃO troca a thumb pela full na hora. Mantém a thumb (carrega rápido e fixa
        // o tamanho) e só troca pra full perto da viewport (IO). Como a full tem a MESMA proporção,
        // subir/descer um thread enorme não reflui o layout — era o swap imediato + lazy que blankava
        // a imagem e fazia ela "estourar" de tamanho ao carregar.
        const imgbox = isImgboxThumb(src);   // imgbox: thumb `_t` → original `_o` (sem tier médio próprio → exibe o original no post)
        const big = getBigUrl(src);          // sobe pra FULL nos hosts conhecidos (.md/.th, imgbox, pixhost, …)
        const convMd = src.includes('.md.'), convTh = src.includes('.th.');
        // ANTES só entrava .md/.th/imgbox → hosts com padrão próprio de thumb (pixhost & cia) ficavam na BAIXA.
        // Agora qualquer host que o getBigUrl saiba subir (big !== src) também entra no upgrade.
        if (convMd || convTh || imgbox || big !== src) {
            const full = big;
            const med = convMd ? src : (convTh ? src.replace('.th.', '.md.') : full);   // tier MÉDIO só p/ convenção .md/.th; resto (pixhost/imgbox) exibe o FULL direto
            img.dataset.smgFull = full;
            img.dataset.smgMed = med;
            img.removeAttribute('srcset');
            const link = img.closest('a');
            if (link) link.href = full;              // maximizar (feed/lightbox) abre o FULL (alta)
            if (img.title) img.title = cleanText(img.title);
            if (img.alt) img.alt = cleanText(img.alt);
            const tio = getThumbIO(); if (tio) tio.observe(img);   // thumb carrega bem cedo → tamanho fixo antes de aparecer
            if (med !== src) {                       // src é .th. → sobe pra .md. perto da viewport; .md. já exibido FICA (nunca vai pro full no post)
                const mio = getMedIO();
                if (mio) mio.observe(img); else img.src = med;     // sem IO → troca direto (fallback)
            }
        }
    }
    function processImages(roots) {
        // o seletor exclui examinadas (data-full-processed) E placeholders sem src (data-smg-lazy-wait,
        // que voltam via seu próprio load). Scope: no boot roots=[body] (full), numa mutação só os subtrees novos.
        eachIn(roots, 'img.bbImage:not([data-full-processed]):not([data-smg-lazy-wait])', processOneImage);
    }

    // hosts de imagem estilo chevereto (jpg6.su / jpg5.su / jpg.church & afins): a página /img/{slug} "cozinha" a URL real
    // (data-src = base64 de hex, XOR com uma CHAVE ESTÁTICA branded — anti-scraper). Recuperei a chave por criptanálise
    // (2 amostras, crib "https://" + prefixo comum) → decode puro, sem depender de estado do browser. A imagem é do mesmo
    // CDN cuckcapital que os jpg6 EMBEDADOS já carregam, então um <img> normal exibe inline (sem 403 de hotlink).
    function cheveretoViewer(url) {
        let u; try { u = new URL(url); } catch (e) { return null; }
        if (!/^(?:jpg\d*\.\w{2,}|host\.church)$/i.test(u.hostname)) return null;   // jpg6.su / jpg.church / jpg5.fish / host.church …
        if (!/\/(?:img|image|i|a|album)\//i.test(u.pathname)) return null;          // só páginas de viewer/galeria (não imagem direta)
        return { host: u.hostname, gallery: /\/(?:a|album)\//i.test(u.pathname) };
    }
    const CHV_KEY = 'seltilovessimpcity@simpcityhatesscrapers';   // chave XOR estática (período 40) do "cooked" do chevereto
    function cheveretoDecode(b64) {
        let hex; try { hex = atob(b64); } catch (e) { return ''; }
        if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2) return '';
        let out = '';
        for (let i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ CHV_KEY.charCodeAt((i / 2) % CHV_KEY.length));
        return /^https?:\/\/\S+\.(?:jpe?g|png|webp|gif|avif)/i.test(out) ? out : '';
    }
    const chvCache = new Map();      // viewerUrl → directUrl|null (1× por sessão)
    const chvInflight = new Map();   // dedup de fetches simultâneos do mesmo viewer
    let chvActive = 0; const chvQueue = [];   // throttle (galeria de N links pelados não estoura a rede)
    function chvPump() { while (chvActive < 4 && chvQueue.length) { const fn = chvQueue.shift(); chvActive++; fn(() => { chvActive--; chvPump(); }); } }
    // busca a página de viewer (GMX, fura CORS), extrai o data-src cooked e decodifica → URL direta da imagem. cb(url|null).
    function cheveretoResolve(viewerUrl, cb) {
        if (chvCache.has(viewerUrl)) { cb(chvCache.get(viewerUrl)); return; }
        if (chvInflight.has(viewerUrl)) { chvInflight.get(viewerUrl).push(cb); return; }
        if (!GMX) { cb(null); return; }
        chvInflight.set(viewerUrl, [cb]);
        const done = url => { chvCache.set(viewerUrl, url || null); const cbs = chvInflight.get(viewerUrl) || []; chvInflight.delete(viewerUrl); cbs.forEach(f => { try { f(url || null); } catch (e) {} }); };
        chvQueue.push(release => {
            GMX({ method: 'GET', url: viewerUrl, timeout: 12000, headers: { Referer: location.origin + '/', Accept: 'text/html,*/*' },
                onload: r => { const t = r.responseText || ''; const m = t.match(/<img[^>]*\bcooked="true"[^>]*\bdata-src="([A-Za-z0-9+/=]+)"/i) || t.match(/\bdata-src="([A-Za-z0-9+/=]{40,})"/i); done(m ? cheveretoDecode(m[1]) : ''); release(); },
                onerror: () => { done(''); release(); }, ontimeout: () => { done(''); release(); } });
        });
        chvPump();
    }
    // link pelado de viewer → card (estado de loading) → resolve a imagem → troca por <img bbImage> (masonry/lightbox pegam).
    // Falha (rede/decode/host fora) → o card fica. Galeria (/a/): só card (resolver N imagens é outra fase).
    function cheveretoEmbed(linkEl, href, chv) {
        // fhCard recebe um OBJETO {label,href,sub,logo} — a chamada posicional antiga deixava o.label=undefined ("?")
        // e o.sub caía no String.prototype.sub ("function sub() { [native code] }").
        let card; try { card = fhCard({ label: chv.host, href: href, sub: i18n(chv.gallery ? 'Gallery' : 'Image'), logo: fhLogoChain({ key: 'chevereto' }, href, null) }); } catch (e) { return; }
        linkEl.replaceWith(card);
        if (chv.gallery) { cheveretoGallery(card, href, chv.host); return; }   // galeria → embeda TODAS as imagens (1 fetch por página)
        cheveretoResolve(href, url => {
            if (!url || !card.isConnected) return;   // falhou → fica o card
            const full = getBigUrl(url);   // a viewer do chevereto serve a versão .md (MÉDIA) → sobe pro ORIGINAL (resolução cheia)
            const img = document.createElement('img'); img.className = 'bbImage'; img.loading = 'lazy'; img.alt = ''; img.dataset.smgLink = href; img.dataset.smgFull = full;
            img.addEventListener('load', () => { if (typeof scheduleRun === 'function') scheduleRun(); }, { once: true });   // tem dimensões → masonry re-grida
            img.addEventListener('error', () => {}, { once: true });   // CDN fora → deixa o que estiver (card já foi removido; vira img quebrada rara)
            const link = document.createElement('a'); link.href = full; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.appendChild(img);
            card.replaceWith(link);
            img.src = full;
        });
    }
    // GALERIA chevereto (/a/ /album/): embeda TODAS as imagens. 1 fetch por PÁGINA (não por imagem) — extrai os thumbs
    // da listagem e sobe pro ORIGINAL com getBigUrl (os thumbs seguem a convenção .md). Teto de páginas + nº de imagens
    // p/ não martelar o host (≠ gofile: aqui é 1 request por página, throttle de 4, e sem token/anti-bot).
    const CHV_GAL_MAX_PAGES = 12, CHV_GAL_MAX_IMGS = 600;
    function chvImgUrlsFrom(doc, host) {
        const out = [];
        // itens da listagem chevereto: <a href=".../img/{slug}"><img src="...md.jpg" data-src="..."></a>
        doc.querySelectorAll('.list-item-image img, .image-container img, a[href*="/img/"] img, [class*="list-item"] img').forEach(im => {
            let s = im.getAttribute('data-src') || im.getAttribute('src') || '';
            if (!s) return;
            if (/^[A-Za-z0-9+/=]{40,}$/.test(s) && s.indexOf('/') === -1) s = cheveretoDecode(s);   // thumb "cooked" (base64) → decodifica
            try { s = new URL(s, 'https://' + host).href; } catch (e) { return; }
            if (!/\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i.test(s)) return;
            if (/avatar|\/logo|favicon|placeholder|\/cover|loading/i.test(s)) return;   // descarta UI
            out.push(getBigUrl(s));   // .md/.th → ORIGINAL
        });
        return out;
    }
    function chvNextPageHref(doc, curUrl) {
        const a = doc.querySelector('[data-pagination="next"], a[rel="next"], .pagination-next a, li.pagination-next a, a[href*="?page="][rel~="next"]');
        let h = a && a.getAttribute('href'); if (!h) return '';
        try { return new URL(h, curUrl).href; } catch (e) { return ''; }
    }
    function cheveretoGallery(card, href, host) {
        if (!GMX) return;   // sem GMX → fica o card
        const all = [], seen = new Set(); let pages = 0, finished = false;
        const finish = () => {
            if (finished) return; finished = true;
            if (!card.isConnected || !all.length) return;   // nada extraído → fica o card
            const frag = document.createDocumentFragment();
            all.forEach(u => {
                const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
                const img = document.createElement('img'); img.className = 'bbImage'; img.loading = 'lazy'; img.alt = ''; img.dataset.smgLink = href; img.dataset.smgFull = u;
                img.addEventListener('load', () => { if (typeof scheduleRun === 'function') scheduleRun(); }, { once: true });
                a.appendChild(img); img.src = u; frag.appendChild(a);
            });
            card.replaceWith(frag);
            if (typeof scheduleRun === 'function') scheduleRun();
        };
        const fetchPage = url => {
            chvQueue.push(release => {
                GMX({ method: 'GET', url: url, timeout: 15000, headers: { Referer: location.origin + '/', Accept: 'text/html,*/*' },
                    onload: r => {
                        let doc; try { doc = new DOMParser().parseFromString(r.responseText || '', 'text/html'); } catch (e) { release(); finish(); return; }
                        chvImgUrlsFrom(doc, host).forEach(u => { if (!seen.has(u) && all.length < CHV_GAL_MAX_IMGS) { seen.add(u); all.push(u); } });
                        pages++;
                        const next = chvNextPageHref(doc, url);
                        release();
                        if (next && pages < CHV_GAL_MAX_PAGES && all.length < CHV_GAL_MAX_IMGS) fetchPage(next);
                        else finish();
                    },
                    onerror: () => { release(); finish(); }, ontimeout: () => { release(); finish(); } });
            });
            chvPump();
        };
        fetchPage(href);
    }
    // LINKS de imagem (jpg6.su / jpg5 / jpg.church & afins): a img mora SÓ no <noscript> (inerte com JS) → o <a> fica
    // vazio e a limpeza de "espaço fantasma" o removia (sumia tudo). Materializa a img do noscript pro <a> (vira bbImage →
    // a masonry grida). Se a img falhar (host caiu/hotlink) OU não houver URL → mostra o LINK clicável no lugar.
    function unlazyImageLinks(roots) {
        eachIn(roots, 'a.link--external[href]:not([data-smg-imglink])', a => {
            a.dataset.smgImglink = '1';
            if (a.closest('.generic2wide-iframe-div, .smg-rg')) return;   // virou player (turbo/saint/imagepond) → não mexe
            // pula SÓ se já existe uma img REAL (fora de <noscript>). ⚠️ o querySelector('img') cru casava com a img INERTE
            // do <noscript> (no XF via AJAX o noscript vira DOM) e abortava → o <a> ficava vazio e a masonry o removia.
            if ([].some.call(a.querySelectorAll('img'), im => !im.closest('noscript'))) return;
            const href = resolveProxyHref(a.getAttribute('href') || '');   // chip/fallback mostra a URL final, não o /goto/ redirect
            // mostra o LINK como texto clicável DENTRO do próprio <a href> (usado quando não há img OU a img falha) → nunca fica vazio
            const showLink = () => { if (!a.isConnected) return; a.innerHTML = ''; a.classList.add('smg-imglink-fallback'); a.textContent = href || a.href; dropChipBreaks(a); };
            const linkChip = () => { const lk = document.createElement('a'); lk.href = href; lk.target = '_blank'; lk.rel = 'noopener noreferrer'; lk.className = 'link link--external smg-imglink-fallback'; lk.textContent = href; return lk; };
            // URL da img: do <noscript> — seja ele DOM (querySelector) ou texto cru (regex)
            const ns = a.querySelector('noscript');
            let url = '';
            if (ns) {
                const ni = ns.querySelector && ns.querySelector('img');
                if (ni) url = ni.getAttribute('data-url') || ni.getAttribute('data-src') || ni.getAttribute('src') || '';
                if (!url || /^data:/.test(url)) (ns.textContent || '').replace(/(?:data-url|data-src|src)\s*=\s*["']([^"']+)["']/gi, (m, u) => { if ((!url || /^data:/.test(url)) && !/^data:/.test(u)) url = u; return m; });
            }
            if (!url || /^data:/.test(url)) {   // sem URL extraível
                const chv = cheveretoViewer(href);   // jpg6.su & afins → resolve a imagem REAL (decode do cooked) e exibe inline; fallback = card
                if (chv) { cheveretoEmbed(a, href, chv); return; }
                showLink(); return;   // resto → link em texto
            }
            const img = document.createElement('img');
            img.className = 'bbImage'; img.src = url; img.loading = 'eager'; img.alt = '';   // EAGER: força resolver (lazy + sem aspect-ratio = célula vazia, e o onerror nunca dispara)
            img.dataset.smgLink = href;
            img.addEventListener('error', () => {
                if (a.isConnected) showLink();                          // img ainda no <a> → vira texto-link
                else if (img.parentNode) { const c = linkChip(); img.replaceWith(c); dropChipBreaks(c); }   // a masonry moveu pro grid → chip de link no lugar
            }, { once: true });
            a.innerHTML = '';   // limpa o noscript + whitespace
            a.appendChild(img);
        });
    }

    // GALERIA NO POST (html.smg-masonry-on): agrupa TODA a mídia do post — imagens E vídeos/embeds —
    // num .auto-image-grid (masonry por CSS). Roda DEPOIS dos passes de embed (turbo/saint/redgifs/direta)
    // pra os wrappers já existirem. Incremental: embed lazy que aparecer depois entra no grid já existente.
    function collectGalleryBlocks(scope) {
        const out = [];
        // imagens + TODOS os embeds: wrappers conhecidos (turbo/saint/redgifs/s9e/mídia direta) + iframe/video SOLTOS (imagepond, vídeo nativo, outros hosts)
        scope.querySelectorAll('img.bbImage, .generic2wide-iframe-div, .smg-dm-wrap, span[data-s9e-mediaembed], iframe[src*="imagepond.net"]').forEach(el => {   // só tipos conhecidos + imagepond (bare video/iframe puxava vídeo nativo preto/thumb quebrada)
            // NÃO excluir .bbCodeBlock geral: o turbo/saint do XF vive DENTRO de .bbCodeBlock--unfurl (card de link). Só pula citação/chips/assinatura.
            if (el.closest('.bbCodeQuote, .smg-post-links, .message-signature')) return;
            // img/iframe/video que JÁ está dentro de um wrapper coletado → representado por ele (evita duplicar)
            if (/^(IMG|IFRAME|VIDEO)$/.test(el.tagName) && el.closest('.generic2wide-iframe-div, .smg-dm-wrap, span[data-s9e-mediaembed]')) return;
            // s9e dentro de um .generic2wide-iframe-div (redgifs do Simp) → o DIV pai é o bloco (senão conta 2x: o span + o div)
            if (el.matches('span[data-s9e-mediaembed]') && el.closest('.generic2wide-iframe-div')) return;
            // s9e CONSUMIDO (saint/turbo/redgifs tiraram o iframe e montaram o player num generic2wide-iframe-div IRMÃO →
            // sobrou só o .url-below vazio): FANTASMA. Sem isto ele virava um bloco a mais → grid com coluna(s) vazia(s).
            if (el.matches('span[data-s9e-mediaembed]') && !el.querySelector('iframe, video, img')) return;
            // .generic2wide-iframe-div VAZIO NÃO conta como mídia (loader pós-autoload esvazia: iframe vai pra s9e separado).
            // basta o teste de conteúdo: o loader que ASSUMIMOS tem .smg-rg>video → entra; o esvaziado (sem iframe/slot/video) → sai.
            if (el.matches('.generic2wide-iframe-div') && !el.querySelector('iframe, .smg-turbo-slot, video, .smg-rg-fail')) return;
            out.push(el);
        });
        return out;
    }
    function blockRelH(b) {   // altura relativa (h/w) p/ distribuir no masonry, SEM reflow (usa o aspect-ratio já conhecido)
        if (b.tagName === 'IMG') {
            const m = (b.style.aspectRatio || '').match(/([\d.]+)\D+([\d.]+)/);
            if (m && +m[1]) return (+m[2]) / (+m[1]);
            if (b.naturalWidth) return b.naturalHeight / b.naturalWidth;
            return 1.3;
        }
        // embed: usa o aspect-ratio REAL se o player já souber (redgifs/turbo setam no .smg-rg após carregar — muitos são retrato, não 16:9)
        const rg = (b.matches && b.matches('.smg-rg')) ? b : (b.querySelector && b.querySelector('.smg-rg'));
        const am = rg && rg.style.aspectRatio && rg.style.aspectRatio.match(/([\d.]+)\D+([\d.]+)/);
        if (am && +am[1]) return (+am[2]) / (+am[1]);
        return 0.5625;   // embeds/vídeo 16:9 (default até o player saber a proporção)
    }
    function gridCols() { return window.innerWidth < 600 ? 1 : 3; }   // faixa (p/ detectar a troca mobile↔desktop no resize)
    // nº de colunas pela quantidade E orientação:
    //   · mobile → 1 · 2 itens ambos HORIZONTAIS → 1 (cada um full width) · 2 itens vertical/misto → 2 (lado a lado, cap 75vh) · resto → 3
    function gridColsFor(blocks) {
        if (window.innerWidth < 600) return 1;
        if (blocks.length === 2) return blocks.every(b => blockRelH(b) < 1) ? 1 : 2;
        return 3;
    }
    // ===== MASONRY via CSS Grid (row-span) =====
    // grid `display:grid` com colunas iguais e linhas FINAS (MASONRY_ROW); cada item reserva N linhas (gridRowEnd: span N) → empacotamento
    // estilo Pinterest E um item pode ATRAVESSAR colunas (gridColumn: span 2) — o que o flex de colunas não permitia.
    //   · row-span = nº de linhas finas que cobrem a ALTURA REAL do item; medido por ResizeObserver (sempre certo, mesmo quando a imagem/
    //     o player resolve o tamanho depois) — só um provisório por aspecto é posto na 1ª pintura p/ evitar flash.
    //   · item HORIZONTAL (imagem OU vídeo, h/w < 0.9) num grid de ≥2 colunas → gridColumn span 2.
    const MASONRY_ROW = 8, MASONRY_GAP = 8;   // px — DEVE casar com grid-auto-rows + gap da .auto-image-grid na CSS
    function spanForHeight(h) { return Math.max(1, Math.ceil((h + MASONRY_GAP) / (MASONRY_ROW + MASONRY_GAP))); }
    let masonryRO = null, masonryDirty = new Set(), masonryRaf = 0;
    function scheduleRelayout(grid) {
        masonryDirty.add(grid);
        if (masonryRaf) return;
        masonryRaf = requestAnimationFrame(() => { masonryRaf = 0; const gs = masonryDirty; masonryDirty = new Set(); gs.forEach(g => { if (g.isConnected) relayoutGrid(g); }); });
    }
    function getMasonryRO() {
        if (masonryRO) return masonryRO;
        if (typeof ResizeObserver === 'undefined') return null;
        masonryRO = new ResizeObserver(entries => {
            for (const e of entries) {
                const grid = e.target.parentElement;   // o tamanho de um item mudou (img/player resolveu) → recalcula spans/colunas do grid
                if (grid && grid.classList && grid.classList.contains('auto-image-grid')) scheduleRelayout(grid);
            }
        });
        return masonryRO;
    }
    // embed lazy (turbo/saint): ativa AGORA se perto da viewport; senão re-observa na posição nova
    function activateLazyEmbed(b) {
        const slot = b.querySelector && b.querySelector('.smg-turbo-slot');
        if (!(slot && slot._smgActivate && !slot.querySelector('iframe, .smg-turbo-error'))) return;
        const rect = slot.getBoundingClientRect();
        const near = rect.top < (window.innerHeight || 0) + 800 && rect.bottom > -800;
        if (near || !turboIO) { const fn = slot._smgActivate; slot._smgActivate = null; turboIO && turboIO.unobserve(slot); fn(); }
        else { turboIO.unobserve(slot); turboIO.observe(slot); }
    }
    // row-span (nº de linhas finas) pela ALTURA estimada do item na largura w — determinístico (aspecto + teto), sem medir.
    function rowSpanFor(b, w) {
        let h = w * blockRelH(b); const cap = (window.innerHeight || 800) * 0.75; if (h > cap) h = cap;
        return 'span ' + spanForHeight(h);
    }
    // (re)faz o layout: nº de colunas + col-span (horizontal = 2 colunas) + row-span (aspecto). Determinístico → idempotente.
    function relayoutGrid(grid) {
        const items = Array.prototype.filter.call(grid.children, c => c.nodeType === 1);
        if (!items.length) return;
        const N = gridColsFor(items);
        grid.style.setProperty('--smg-mcols', N);
        grid.classList.toggle('smg-grid-pair-port', items.length === 2 && N === 2);   // par vertical/misto → cap 75vh (CSS)
        const colW = Math.max(40, (grid.clientWidth - (N - 1) * MASONRY_GAP) / N);
        items.forEach(b => {
            const span2 = (N >= 2 && blockRelH(b) < 0.9) ? Math.min(2, N) : 1;   // QUALQUER item HORIZONTAL (imagem ou vídeo) → 2 colunas
            const cs = span2 > 1 ? ('span ' + span2) : '';
            if (b.style.gridColumn !== cs) b.style.gridColumn = cs;
            const rs = rowSpanFor(b, colW * span2 + MASONRY_GAP * (span2 - 1));
            if (b.style.gridRowEnd !== rs) b.style.gridRowEnd = rs;
        });
        if (N >= 3) expandLonelyWides(grid, N, colW);   // item de 2 colunas SOZINHO (sem mídia ao lado) → ocupa as 3
    }
    // mede o layout denso atual e, se um item de 2 colunas não tem NADA ao lado na faixa vertical dele, expande pra largura cheia (3 col).
    function expandLonelyWides(grid, N, colW) {
        const all = Array.prototype.filter.call(grid.children, c => c.nodeType === 1);
        const wides = all.filter(c => /span 2/.test(c.style.gridColumn || ''));
        if (!wides.length) return;
        const gr = grid.getBoundingClientRect();   // força o layout denso atual → mede
        const rects = all.map(el => ({ el: el, r: el.getBoundingClientRect() }));
        const tol = 4;
        wides.forEach(w => {
            const wr = w.getBoundingClientRect();
            const band = rr => rr.bottom > wr.top + tol && rr.top < wr.bottom - tol;   // sobrepõe verticalmente o item largo
            const rightGap = (gr.right - wr.right) > colW * 0.5, leftGap = (wr.left - gr.left) > colW * 0.5;   // sobra ≈1 coluna de um lado
            const someoneRight = rects.some(o => o.el !== w && band(o.r) && o.r.left >= wr.right - tol);
            const someoneLeft = rects.some(o => o.el !== w && band(o.r) && o.r.right <= wr.left + tol);
            if ((rightGap && !someoneRight) || (leftGap && !someoneLeft)) {
                w.style.gridColumn = '1 / -1';   // nada ao lado → ocupa as 3 colunas
                w.style.gridRowEnd = rowSpanFor(w, grid.clientWidth);
            }
        });
    }
    // move os novos blocos pra serem filhos DIRETOS do grid (sem colunas .smg-mcol), observa o tamanho e faz o layout.
    function fillGrid(grid, newBlocks) {
        grid.style.removeProperty('grid-template-columns'); grid.style.columnCount = '';   // limpa modos antigos (multicol / template inline)
        const ro = getMasonryRO();
        newBlocks.forEach(b => {
            if (b.parentNode === grid) return;
            const unfurl = b.closest('.bbCodeBlock--unfurl');   // ANTES de mover: o card de link vira caixa vazia → esconde
            grid.appendChild(b); b.dataset.smgGridded = '1';
            if (unfurl) unfurl.style.display = 'none';
            if (ro) ro.observe(b);
            activateLazyEmbed(b);
        });
        relayoutGrid(grid);
    }
    // remove os <a> esvaziados (a img foi pro grid) + os <br> separadores, no PARENT do grid — sem tocar em texto/links reais.
    function cleanupGhosts(grid) {
        const parent = grid.parentNode; if (!parent) return;
        parent.querySelectorAll(':scope > a').forEach(a => {
            let real = false;   // conteúdo PRÓPRIO do <a> (ignora <noscript>, que vaza como texto OU vira DOM dependendo do parse)
            a.childNodes.forEach(n => { if (n.nodeType === 1 && n.tagName !== 'NOSCRIPT') real = true; else if (n.nodeType === 3 && n.textContent.trim()) real = true; });
            if (real) return;   // <a> com texto/mídia real → mantém SEMPRE
            let sib = a.nextSibling; a.remove();
            while (sib && sib.nodeType === 3 && !sib.textContent.trim()) { const nx = sib.nextSibling; sib.remove(); sib = nx; }
            if (sib && sib.nodeName === 'BR') sib.remove();   // o <br> que separava esta imagem da próxima
        });
        let p = grid.previousSibling;   // <br>/ws colado ANTES do grid (sobra dos breaks das imagens movidas) → senão empurra o grid pra baixo
        while (p && (p.nodeName === 'BR' || (p.nodeType === 3 && !p.textContent.trim()))) { const pv = p.previousSibling; p.remove(); p = pv; }
    }
    // GALERIA EM CONTEXTO (era: UM grid no fim do post → quebrava o contexto quando havia texto entre as mídias). Agora agrupa
    // só RUNS de mídia CONTÍGUA (separadas apenas por <br>/espaço); texto OU card/elemento não-mídia entre mídias QUEBRA a run →
    // vira um grid à parte NO LUGAR de origem, então o texto fica junto da mídia a que se refere. Run de 1 mídia → fica inline.
    function buildPostGallery(scope) {
        const byParent = new Map();   // parent-do-fluxo → Map(flowEl → [blocks]); flowEl = o nó que senta no fluxo (o <a> da img, ou o próprio wrapper)
        collectGalleryBlocks(scope).forEach(b => {
            if (b.dataset.smgGridded) return;   // já gridada (filho direto do grid)
            const flow = (b.tagName === 'IMG') ? (b.closest('a') || b) : b;
            const parent = flow.parentNode; if (!parent) return;
            if (!byParent.has(parent)) byParent.set(parent, new Map());
            const m = byParent.get(parent); if (!m.has(flow)) m.set(flow, []); m.get(flow).push(b);
        });
        byParent.forEach((flowMap, parent) => {
            let run = [];   // itens contíguos: {flow,blocks} (mídia nova) | {grid} (grid já existente → mídia nova adjacente entra nele)
            const flush = () => {
                const items = run; run = [];
                const ungridded = []; items.forEach(it => { if (it.blocks) ungridded.push.apply(ungridded, it.blocks); });
                if (!ungridded.length) return;   // run sem mídia nova → nada a fazer (resize é tratado à parte)
                let grid = (items.find(it => it.grid) || {}).grid;
                const have = grid ? grid.children.length : 0;   // itens já no grid (filhos diretos)
                if (ungridded.length + have < 2) return;   // run de 1 mídia → inline (sem grid)
                if (!grid) {
                    const firstFlow = (items.find(it => it.flow) || {}).flow;
                    if (!firstFlow || !firstFlow.parentNode) return;
                    grid = document.createElement('div'); grid.className = 'auto-image-grid';
                    firstFlow.parentNode.insertBefore(grid, firstFlow);   // grid NO LUGAR (antes da 1ª mídia da run)
                }
                fillGrid(grid, ungridded);
                cleanupGhosts(grid);
            };
            Array.from(parent.childNodes).forEach(node => {
                if (node.nodeType === 3) { if (node.textContent.trim()) flush(); return; }   // texto real → quebra a run; whitespace → mantém
                if (node.nodeType !== 1) return;
                if (node.tagName === 'BR') return;   // separador → mantém a run
                if (node.classList && node.classList.contains('auto-image-grid')) { run.push({ grid: node }); return; }   // grid existente
                if (flowMap.has(node)) { run.push({ flow: node, blocks: flowMap.get(node) }); return; }   // mídia ainda não gridada
                flush();   // card/parágrafo/qualquer outro elemento → quebra a run (preserva o contexto texto↔mídia)
            });
            flush();
        });
    }
    // resize/rotação: a LARGURA das colunas muda sozinha (grid fluido) → o ResizeObserver re-mede e corrige o row-span.
    // Só ao CRUZAR a faixa mobile↔desktop o NÚMERO de colunas muda → reaplica o layout (N + col-span) nas grids existentes.
    let masonryResizeBound = false, masonryBucket = -1;
    function bindMasonryResize() {
        if (masonryResizeBound) return;
        masonryResizeBound = true;
        masonryBucket = gridCols();
        let t;
        window.addEventListener('resize', () => {
            clearTimeout(t);
            t = setTimeout(() => {
                const b = gridCols();
                if (b === masonryBucket) return;   // mesma faixa → o RO já cuida da largura
                masonryBucket = b;
                document.querySelectorAll('.auto-image-grid').forEach(relayoutGrid);   // recalcula nº de colunas + col-span
            }, 200);
        }, { passive: true });
    }
    function buildPostGalleries(roots) {
        if (!document.documentElement.classList.contains('smg-masonry-on')) return;   // só com a Galeria ligada
        bindMasonryResize();
        // gate barato (data-smg-galseen marca cada item 1x → steady-state ~0). Escopo = CORPO do post (.message-userContent)
        // inteiro, NÃO só dentro do .bbWrapper: no SMG nosso embed às vezes entra como IRMÃO do .bbWrapper (fora dele) e ficava de fora.
        // corpo do post = .message-userContent · comentário (profile post / SMG) = .comment-body
        const types = ['img.bbImage', '.generic2wide-iframe-div', '.smg-dm-wrap', 'span[data-s9e-mediaembed]', 'iframe[src*="imagepond.net"]'];
        const sel = [];
        ['.message-userContent', '.comment-body'].forEach(root => types.forEach(t => sel.push(root + ' ' + t + ':not([data-smg-galseen])')));
        const bodies = new Set();
        eachIn(roots, sel.join(','), el => {
            el.dataset.smgGalseen = '1';
            if (el.closest('.bbCodeQuote, .message-signature')) return;   // não agrupa citação/assinatura (unfurl com embed PODE entrar)
            const b = el.closest('.message-userContent, .comment-body');
            if (b) bodies.add(b);
        });
        bodies.forEach(buildPostGallery);
    }

    // =========================================================
    // FEATURE: turbo embeds
    // =========================================================

    // helper: IntersectionObserver p/ montar embeds só perto da viewport (lazy)
    let turboIO = null;
    function getTurboIO() {   // monta o embed (slot._smgActivate) só perto da viewport (lazy) — ~1 tela à frente, igual ao redgifs ("pronto quando chega"; o blob fica adiado pro play)
        return turboIO || (turboIO = makeLazyIO(el => { if (el._smgActivate) el._smgActivate(); }, { rootMargin: '100% 0px' }));
    }

    // tira o <a> CRU do turbo da página depois que ele virou player (ou já existe um pro mesmo id). Sem isto, link de
    // texto (ex.: 2 URLs na MESMA linha — o XF não auto-embeda, fica <a>texto</a>) aparece VISÍVEL acima do player.
    // Remove tbm o <br> imediatamente seguinte (senão sobra linha em branco). wrapper = âncora p/ achar o <br> (foi
    // inserido entre o link e o <br>); no dedup (sem wrapper) o <br> está direto após o link.
    function retireTurboLink(link, wrapper) {
        const br = (wrapper || link).nextElementSibling;
        if (br && br.tagName === 'BR') br.remove();
        link.remove();
    }

    function processTurboLinks(roots) {
        // :not(.smg-turbo-fallback) → não re-processa o nosso próprio link de
        // fallback (que aponta pro turbo.cr), senão vira loop infinito de wrappers.
        eachIn(roots, 'a[href*="turbo.cr/"]:not(.smg-turbo-fallback):not([data-turbo-iframe-processed])', link => {

            // turbo.cr/a/{id} = ÁLBUM (galeria de vários itens), não um vídeo único → o /embed/ não serve.
            // marca como processado e deixa o link cru (o groupLinks pega como chip de file-host).
            if (/turbo\.cr\/a\//i.test(link.href)) { link.dataset.turboIframeProcessed = 'true'; return; }

            // pega o ÚLTIMO segmento do path, seja qual for o prefixo:
            // /{id}, /e/{id}, /v/{id}, /embed/{id}, etc. id pode ter _ e -.
            const match = link.href.match(/turbo\.cr\/(?:[^/?#]+\/)*([a-zA-Z0-9_-]+)/i);
            if (!match) return;

            link.dataset.turboIframeProcessed = 'true';

            const id = match[1];
            const originalHref = link.href;
            const embedUrl = `https://turbo.cr/embed/${id}`;

            // card de preview do xenforo: esconde
            const previewBlock = link.closest('.contentRow') || link.closest('.block-row');
            if (previewBlock) previewBlock.style.display = 'none';

            // DEDUP: o MESMO turbo já embedado nesse corpo? (XF às vezes deixa o link cru + o card unfurl pro mesmo vídeo → 2 players)
            const bodyEl = link.closest('.message-userContent, .comment-body') || link.closest('.bbWrapper');
            if (bodyEl && bodyEl.querySelector('.generic2wide-iframe-div[data-tb-id="' + id + '"]')) { retireTurboLink(link); return; }   // já tem player desse id → só tira o <a> cru

            // wrapper já com o link original SEMPRE clicável (mesmo se der 404)
            const wrapper = buildEmbedWrapper(originalHref, id);   // default = turbo
            wrapper.dataset.tbId = id;   // marca p/ o dedup acima
            (previewBlock || link).insertAdjacentElement('afterend', wrapper);
            if (!previewBlock) retireTurboLink(link, wrapper);   // tira o <a> cru (a URL crua na página): o player + o fallback embutido já cobrem o "abrir no turbo"

            const slot = wrapper.querySelector('.smg-turbo-slot');

            // FALLBACK: o iframe clássico (pré-check de 404; spinner fica até carregar/dar erro)
            const iframeFallback = () => turboCheck(embedUrl, ok => {
                wrapper.querySelector('.smg-turbo-fallback')?.style.removeProperty('display');   // scrape falhou → revela o link de escape ("Open on turbo")
                if (slot.querySelector('iframe')) { slot.querySelector('.smg-loading')?.remove(); return; }   // já tem iframe → não duplica
                slot.querySelectorAll('.smg-rg').forEach(e => e.remove());   // ANTI-DUP: se sobrou nosso player, tira antes do iframe
                unfillSlot(slot);   // player nativo pode ter montado e falhado → volta o slot ao 16:9 p/ o iframe (absoluto) não colapsar
                const loading = slot.querySelector('.smg-loading');
                if (!ok) { loading?.remove(); slot.appendChild(buildTurboError()); return; }
                const iframe = buildTurboIframe(embedUrl);
                const stopLoading = () => loading?.remove();
                iframe.addEventListener('load', stopLoading, { once: true });
                setTimeout(stopLoading, 15000);
                slot.appendChild(iframe);
            });

            // monta o embed: 1º tenta o PLAYER NOSSO (extrai o mp4 do turbo) → controles próprios; se não achar/falhar, cai pro iframe.
            const activate = () => {
                if (slot.dataset.tbActivated) return;   // run-once (turboIO E o masonry podem chamar) → sem scrape/vídeo duplicado
                slot.dataset.tbActivated = '1'; slot._smgActivate = null;
                if (!(FEATURES.turboNativePlayer && GMX)) { iframeFallback(); return; }
                turboResolve(embedUrl, mp4 => {
                    if (slot.querySelector('.smg-rg')) return;        // já tem nosso player → nada a fazer
                    if (!mp4) { iframeFallback(); return; }            // sem url → iframe
                    slot.querySelectorAll('iframe, .smg-loading, .smg-turbo-error').forEach(e => e.remove());   // ANTI-DUP: tira iframe/spinner ANTES do nosso player
                    const poster = turboPoster(mp4);   // poster igual ao player do turbo — sem request extra
                    const { wrap, video } = buildNativeVideo(mp4, 'https://turbo.cr/', iframeFallback, 'Turbo');
                    video._rgExt = originalHref;   // botão "abrir em nova guia" → turbo
                    video._rgFeed = embedUrl;      // botão "abrir no visualizador" (bate com collectMediaFrom)
                    slot.parentElement && slot.parentElement.querySelector('.smg-turbo-fallback')?.remove();   // tira o link de baixo (o botão dos controles substitui)
                    slot.appendChild(wrap);
                    fillSlot(slot);   // solta o 16:9/overflow do slot → não corta vídeo vertical
                    rgPrepareUrl(video, mp4, wrap, poster);   // poster + estado pronto; stream só no play (preload none) → first-paint instantâneo, sem contenção no feed
                });
            };

            // lazy: só dispara o precheck/iframe quando o embed chega perto da tela
            const io = FEATURES.lazyEmbeds ? getTurboIO() : null;
            if (io) {
                slot._smgActivate = activate;
                io.observe(slot);
            } else {
                activate();
            }
        });
    }

    // wrapper GENÉRICO de embed (turbo E saint — eram 2 funções byte-idênticas): .generic2wide-iframe-div
    // > .smg-turbo-slot (recebe o player/iframe, com spinner) + link de fallback sempre clicável.
    // opts.label = texto do fallback · opts.doneAttr = data-attr que marca o fallback p/ não re-processar.
    function buildEmbedWrapper(originalHref, id, opts) {
        opts = opts || {};
        const wrapper = document.createElement('div');
        wrapper.className = 'generic2wide-iframe-div';

        const slot = document.createElement('div');
        slot.className = 'smg-turbo-slot';

        // spinner enquanto o precheck/scrape roda e o player monta
        const loading = document.createElement('div');
        loading.className = 'smg-loading';
        slot.appendChild(loading);

        const fallback = document.createElement('a');
        fallback.className = 'smg-turbo-fallback';
        fallback.dataset[opts.doneAttr || 'turboIframeProcessed'] = opts.doneVal || 'true';   // :not([data-…]) não re-processa o próprio fallback (evita loop)
        fallback.href = originalHref;
        fallback.target = '_blank';
        fallback.rel = 'noopener noreferrer';
        fallback.textContent = '↗ ' + i18n(opts.label || 'Open on turbo.cr') + ' (' + id + ')';
        fallback.style.display = 'none';   // escondido enquanto faz o scrape → SÓ aparece se cair pro iframe/erro (sem o flash do "Open on…" antes do player)

        wrapper.append(slot, fallback);
        return wrapper;
    }

    // PERF: substitui os seletores `.bbWrapper:has(.generic2wide-iframe-div)` do CSS (o engine reavalia :has a cada
    // mutação de subtree — e o processAll muta quase todo frame). Marca o wrapper-pai com .smg-has-g2w 1× por embed
    // (guard por dataset, escopado via roots) → o CSS casa a classe estática em vez do :has dinâmico. Cobre tanto os
    // embeds que NÓS criamos (buildEmbedWrapper) quanto os nativos do Simp (auto-load redgifs já vem no HTML).
    function markG2wWrappers(roots) {
        eachIn(roots, '.generic2wide-iframe-div:not([data-g2w-up])', div => {
            div.dataset.g2wUp = '1';
            const w = div.closest('.bbWrapper, .message-userContent, .message-content');
            if (w) w.classList.add('smg-has-g2w');
        });
    }

    function buildTurboIframe(embedUrl) {
        const iframe = document.createElement('iframe');
        iframe.className = 'saint-iframe';
        iframe.src = embedUrl;

        // força um viewport interno grande
        iframe.width = '1280';
        iframe.height = '720';
        iframe.loading = 'lazy';
        iframe.allowFullscreen = true;
        iframe.setAttribute(
            'allow',
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen'
        );

        return iframe;
    }

    function buildTurboError() {
        const box = document.createElement('div');
        box.className = 'smg-turbo-error';
        box.textContent = i18n('⚠ turbo.cr unavailable (404) — use the link below');
        return box;
    }

    // Decide se monta o iframe. Estratégia OTIMISTA: só mostra o card de erro
    // num 404/410 confirmado por GET. Qualquer ambiguidade (403, 5xx, bloqueio,
    // timeout, erro de rede, HEAD tratado diferente) → mostra o iframe mesmo
    // assim — o link de fallback já cobre o caso de estar de fato quebrado.
    // Sem GM_xmlhttpRequest, assume ok.
    function turboCheck(url, cb) {
        if (typeof GM_xmlhttpRequest !== 'function') {
            cb(true);
            return;
        }

        const decide = status => {
            if (isOkStatus(status)) cb(true);
            else if (status === 404 || status === 410) cb(false); // morto confirmado
            else cb(true);                                         // na dúvida, mostra
        };

        // GET (com Range) confirma — muitos servidores tratam HEAD diferente do GET
        const getConfirm = () => GM_xmlhttpRequest({
            method: 'GET',
            url,
            timeout: 8000,
            headers: { Range: 'bytes=0-1024' },
            onload: res => decide(res.status),
            onerror: () => cb(true),
            ontimeout: () => cb(true),
        });

        GM_xmlhttpRequest({
            method: 'HEAD',
            url,
            timeout: 8000,
            onload: res => {
                if (isOkStatus(res.status)) cb(true);
                else getConfirm(); // qualquer não-ok no HEAD → confirma com GET
            },
            onerror: getConfirm,
            ontimeout: getConfirm,
        });
    }

    function isOkStatus(status) {
        return status === 206 || (status >= 200 && status < 400);
    }

    // =========================================================
    // FEATURE: player nativo de RedGifs (substitui o iframe por <video> com o mp4 da API — reaproveitado do reddit.js)
    // À PROVA DE FALHA: qualquer erro (sem GM / API / blob) RESTAURA o embed nativo (iframe). Nunca deixa buraco.
    //
    // Mapa interno (ver "PIPELINE DE VÍDEO" no índice do topo do arquivo):
    //   API redgifs .. GMX · rgIdFrom · gmGetJSON · rgToken · rgVideo (id → urls.hd/sd + poster)
    //   infra ........ rgBlob · getRgLoadIO/getRgPlayIO · rgPump (fila máx 3) · rgHost/rgDirect
    //   carga ........ rgLoad → rgViaDirect (streaming) | rgViaBlob (download) · rgRestore (falha → iframe)
    //   player UI .... rgBuild · rgControls (controles próprios) · rgStart · buildNativeVideo
    //   turbo ........ turboResolve/turboApi/turboUrlFromJson · processTurboNativeEmbeds (Simp)
    //   aplica ....... applyRedgifsPlayer (loaders/iframes do fórum → nosso player) · rgHidePlaceholder
    // =========================================================
    const GMX = (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest
              : (typeof GM !== 'undefined' && GM.xmlHttpRequest ? GM.xmlHttpRequest.bind(GM) : null);

    function rgIdFrom(s) {   // id do redgifs em qualquer url (/ifr/ /watch/ /gifs/ /i/)
        const m = (s || '').match(/redgifs\.com\/(?:ifr|watch|gifs|i)\/([A-Za-z0-9]+)/i);
        return m ? m[1] : null;
    }
    function gmGetJSON(url, headers) {
        return new Promise((resolve, reject) => {
            if (!GMX) { reject(new Error('no GM_xmlhttpRequest')); return; }
            GMX({ method: 'GET', url, headers: headers || {}, timeout: 12000,
                onload: r => { if (r.status >= 200 && r.status < 300) { try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(e); } } else reject(new Error('HTTP ' + r.status)); },
                onerror: () => reject(new Error('neterror')), ontimeout: () => reject(new Error('timeout')) });
        });
    }
    let rgTok = null, rgTokAt = 0, rgTokP = null;
    function rgToken() {   // token temporário (~reuso 50min). Dedup: N redgifs ao mesmo tempo reusam UM fetch (evita rate-limit)
        if (rgTok && (Date.now() - rgTokAt) < 3e6) return Promise.resolve(rgTok);
        if (rgTokP) return rgTokP;
        rgTokP = gmGetJSON('https://api.redgifs.com/v2/auth/temporary').then(j => {
            rgTokP = null; rgTok = j && j.token; rgTokAt = Date.now();
            if (!rgTok) throw new Error('no token');
            return rgTok;
        }, e => { rgTokP = null; throw e; });
        return rgTokP;
    }
    const rgCache = new Map();
    async function rgVideo(id) {
        const key = id.toLowerCase();
        if (rgCache.has(key)) return rgCache.get(key);
        const tok = await rgToken();
        const j = await gmGetJSON('https://api.redgifs.com/v2/gifs/' + key, { Authorization: 'Bearer ' + tok });
        const gif = j && j.gif, u = gif && gif.urls;
        if (!u || !(u.hd || u.sd)) throw new Error('no urls');
        // poster SEMPRE: api → senão constrói do id em CamelCase (gif.id) — padrão media.redgifs.com/{Id}-poster.jpg
        const poster = u.poster || u.thumbnail || (gif.id ? 'https://media.redgifs.com/' + gif.id + '-poster.jpg' : '');
        const out = { hd: u.hd || u.sd, sd: u.sd || u.hd, poster: poster, w: gif.width || 0, h: gif.height || 0 };
        rgCache.set(key, out);
        return out;
    }
    function rgBlob(url, referer) {   // baixa o mp4 forjando o Referer do host → fura hotlink/CORS (<video> direto às vezes dá tela preta)
        const ref = referer || 'https://www.redgifs.com/';
        return new Promise((resolve, reject) => {
            if (!GMX) { reject(new Error('no GMX')); return; }
            GMX({ method: 'GET', url, responseType: 'blob', timeout: 30000, headers: { Referer: ref, Origin: ref.replace(/\/$/, '') },
                onload: r => { if (r.status >= 200 && r.status < 300 && r.response) resolve(r.response); else reject(new Error('HTTP ' + r.status)); },
                onerror: () => reject(new Error('neterror')), ontimeout: () => reject(new Error('timeout')) });
        });
    }

    const rgBlobs = [];   // LRU dos objectURLs (libera memória; o vídeo recarrega ao revisitar)
    const rgLiveVideos = new Set();   // todos os <video> smg-rg-v vivos — rgSolo muta os outros sem varrer o doc
    let rgLoadIO = null, rgPlayIO = null, rgFreeIO = null;
    function getRgLoadIO() {   // PREPARO: ~1 tela antes da viewport, enfileira (rgPump, máx 3) só o POSTER do redgifs (rgPrepare — sem baixar vídeo). O play (rgLoad) é no clique.
        return rgLoadIO || (rgLoadIO = makeLazyIO(el => { if (!el.dataset.rgLoaded && !el.dataset.rgPrepared) rgEnqueue(() => rgPrepare(el)); }, { rootMargin: '100% 0px' }));
    }
    function rgAutoOK(v) { return !(v.duration > 60) || v._rgUserPlayed; }   // vídeo >1min NÃO toca sozinho (só no clique); curto (gif/loop) autoplay normal
    function getRgPlayIO() {   // PLAY: toca mudo quando ≥40% visível, pausa fora
        if (rgPlayIO || !('IntersectionObserver' in window)) return rgPlayIO;
        rgPlayIO = new IntersectionObserver(es => es.forEach(e => {
            const v = e.target;
            // AUTOPLAY OFF (req): inline NÃO toca ao entrar na viewport — só PAUSA ao sair (se o usuário tinha dado play).
            if (!(e.isIntersecting && e.intersectionRatio >= 0.4)) { try { v.pause(); } catch (x) {} }
        }), { threshold: [0, 0.4] });
        return rgPlayIO;
    }
    // FAR offscreen (>2000px): solta o src do redgifs → libera memória/decoder (numa thread longa com
    // muitos vídeos, sem isso N players ficam bufferizados ao mesmo tempo). Recarrega via rgLoadIO ao voltar.
    function getRgFreeIO() {
        if (rgFreeIO || !('IntersectionObserver' in window)) return rgFreeIO;
        rgFreeIO = new IntersectionObserver(es => es.forEach(e => {
            if (e.isIntersecting) return;   // ainda perto (≤2000px) → mantém carregado
            const v = e.target;
            if (!v.dataset.rgid || !v.dataset.rgLoaded || !v.getAttribute('src')) return;   // só redgifs JÁ carregado (turbo tem URL que expira → nunca solta; src ausente = ainda buscando, não mexe)
            try { v.pause(); } catch (x) {}
            v.removeAttribute('src'); try { v.load(); } catch (x) {}   // descarta o buffer/decoder (libera memória/decoder)
            v.dataset.rgLoaded = '';
            const w = v.closest('.smg-rg'); if (w) { w.classList.remove('smg-rg-loading', 'smg-rg-buffering'); w.classList.add('smg-rg-ready'); }   // volta ao PRONTO (poster ainda setado + play central): clicar recarrega e toca (autoplay off → não recarrega sozinho ao voltar)
        }), { rootMargin: '2000px 0px' });
        return rgFreeIO;
    }
    // só um com áudio: muta os OUTROS players vivos. O Set self-poda nós detached → sem querySelectorAll no doc a cada play/unmute.
    function rgSolo(video) { rgLiveVideos.forEach(o => { if (!o.isConnected) rgLiveVideos.delete(o); else if (o !== video) o.muted = true; }); }
    // libera os objectURLs dos vídeos que saíram do DOM (ex.: ao fechar o feed) — senão os ≤6 blobs ficam até a próxima evicção da LRU.
    function rgReleaseDetachedBlobs() {
        for (let i = rgBlobs.length - 1; i >= 0; i--) {
            const e = rgBlobs[i];
            if (!e.video || !e.video.isConnected) { try { URL.revokeObjectURL(e.url); } catch (x) {} rgBlobs.splice(i, 1); }
        }
    }

    // FILA: serializa o carregamento (rgLoad/rgLoadUrl) em máx RG_MAX_CONCURRENT. O streaming direto libera o slot no
    // metadata (rápido); o blob segura o slot o download inteiro — por isso o inline-autoplay-off adia o blob (deferBlob).
    let rgActive = 0; const rgQueue = [];
    const RG_MAX_CONCURRENT = 3;   // máx de vídeos carregando ao mesmo tempo (2 serializava demais a fila → "demora muito no próximo lote")
    function rgPump() { while (rgActive < RG_MAX_CONCURRENT && rgQueue.length) { const fn = rgQueue.shift(); rgActive++; Promise.resolve().then(fn).finally(() => { rgActive--; rgPump(); }); } }
    function rgEnqueue(fn) { rgQueue.push(fn); rgPump(); }

    function rgPlayIfVisible(video, wrap) {
        // NÃO tira o skeleton aqui (isso é no 'loadeddata', quando há frame). Aqui só decide o autoplay.
        if (!video._rgInFeed && !video._rgUserPlayed) return;   // INLINE não-clicado: só prepara, NÃO toca (autoplay off). Feed (_rgInFeed) ou já-clicado (_rgUserPlayed) → toca.
        if (!rgAutoOK(video)) return;   // >1min → não autoplay
        const rect = video.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < (window.innerHeight || 0)) { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
    }

    // O reddit.js baixa o mp4 INTEIRO em blob só pra DE-TAINT (normalizar áudio via Web Audio) — feature que NÃO temos.
    // Logo: streaming DIRETO (toca enquanto baixa = instantâneo). Os hosts bloqueiam hotlink por Referer → usamos
    // referrerPolicy=no-referrer. Se der tela-preta/erro, cai pro blob (Referer forjado). rgDirect memoriza POR HOST
    // (redgifs e turbo têm hotlink diferente → não pode ser um flag só).
    const rgDirect = {};   // host → true (streaming direto funciona) | false (precisa de blob) | undefined (desconhecido)
    function rgHost(url) { try { return new URL(url, location.href).hostname.split('.').slice(-2).join('.'); } catch (e) { return '?'; } }

    // INLINE com autoplay off (não-feed, não-clicado): NÃO baixa o blob (mp4 INTEIRO) à toa — isso segurava o slot da
    // fila (rgPump) o download todo e fazia o "próximo lote demorar muito" + pesava a página. Guarda a URL e adia pro
    // play; mostra o estado PRONTO (.smg-rg-ready = poster/preto + play central fixo, SEM spinner). No play, o toggle()
    // baixa via rgViaBlob com a URL guardada. (O bug antigo da "caixa preta" era faltar o .smg-rg-ready: tirava o
    // skeleton e ficava preto sem affordance — agora mostra o play. Feed e tiles clicados baixam de verdade na hora.)
    function deferBlob(video, url, wrap) {
        if (video._rgInFeed || video._rgUserPlayed) return false;   // feed / já clicado → baixa o blob de verdade agora
        video._rgDeferUrl = url;                                     // guarda a URL; o toggle() baixa no clique
        if (wrap) { wrap.classList.remove('smg-rg-loading'); wrap.classList.add('smg-rg-ready'); }
        return true;
    }

    // INLINE (autoplay-off): PREPARA só o poster + aspect REAL via API — SEM baixar nenhum byte de vídeo. O <video> fica
    // sem src até o clique (toggle → rgLoad). RedGifs tem poster + dimensões na API → preview rico e aspect certo (zero
    // CLS) de graça, e nenhum stream de metadata por vídeo na tela. (turbo/saint NÃO têm dimensões na API → seguem no
    // metadata leve, senão a caixa viria 16:9 e pularia pro aspect real no play.)
    // POSTER do redgifs via GM (blob): o media.redgifs.com/{Id}-poster.jpg é referer-locked (403 com o referer do fórum) E o
    // <video poster> NÃO respeita o referrerPolicy do elemento → buscamos o poster com Referer redgifs e setamos via blob (mesma-origem).
    function rgSetPoster(video, url) {
        if (!video || !url || video.poster) return;   // já tem poster (rgPrepare setou) → rgLoad não re-baixa nem cria 2º objectURL órfão
        if (!GMX) { video.poster = url; return; }   // sem GM → direto (pode 403, mas é o que dá)
        rgBlob(url).then(b => {
            if (!video.isConnected || video.poster) return;
            try { video.poster = video._rgPosterUrl = URL.createObjectURL(b); } catch (e) { video.poster = url; }   // _rgPosterUrl → rgDispose revoga
        }, () => { if (video.isConnected && !video.poster) video.poster = url; });   // GM falhou → tenta direto
    }
    async function rgPrepare(video) {
        if (!video || video.dataset.rgLoaded || video.dataset.rgPrepared || !video.dataset.rgid) return;
        video.dataset.rgPrepared = '1';
        const wrap = video.closest('.smg-rg');
        let r;
        try { r = await rgVideo(video.dataset.rgid); }
        catch (e) {
            // gif MORTO (sem urls / 404 / 410 / 403) → "RedGifs unavailable" NA HORA (não fica em spinner pra sempre).
            // transiente (rede / 429 / 5xx / timeout) → re-tenta com backoff; após 3 falhas, desiste e mostra o erro.
            const msg = (e && e.message) || '';
            const tries = (+video.dataset.rgTries || 0) + 1; video.dataset.rgTries = String(tries);
            if (/no urls|HTTP 4(0[34]|10)/i.test(msg) || tries >= 3) { rgRestore(video, true); return; }
            video.dataset.rgPrepared = '';
            setTimeout(() => { if (video.isConnected && !video.dataset.rgPrepared && !video.dataset.rgLoaded) rgEnqueue(() => rgPrepare(video)); }, 1500 * tries);
            return;
        }
        if (!video.isConnected) return;
        if (r.poster) rgSetPoster(video, r.poster);            // poster = preview (é um frame do gif) — via GM blob (referer-locked)
        if (r.w && r.h && wrap) wrap.style.aspectRatio = r.w + ' / ' + r.h;
        if (wrap) { wrap.classList.remove('smg-rg-loading'); wrap.classList.add('smg-rg-ready'); }   // poster + play central, sem spinner
    }

    async function rgLoad(video) {
        if (!video || video.dataset.rgLoaded || !video.dataset.rgid) return;
        video.dataset.rgLoaded = '1';
        const wrap = video.closest('.smg-rg');
        if (wrap) wrap.classList.add('smg-rg-loading');
        let r;
        try { r = await rgVideo(video.dataset.rgid); }
        catch (e) {
            const msg = (e && e.message) || '';
            console.warn('[smg-rg] API redgifs falhou:', video.dataset.rgid, msg);
            // gif MORTO (API sem urls, ou 404/410/403) → placeholder limpo (o iframe do redgifs só mostraria "Error loading this gif").
            // erro transitório (rede/429/5xx) → iframe nativo (pode recuperar).
            rgRestore(video, /no urls|HTTP 4(0[34]|10)/i.test(msg));
            return;
        }
        if (!video.isConnected) return;   // removido (ex.: navegou no feed) durante o fetch da API → não monta src/blob num nó detached
        if (r.poster) rgSetPoster(video, r.poster);   // poster aparece já (some a caixa preta) — via GM blob (referer-locked)
        if (r.w && r.h && wrap) wrap.style.aspectRatio = r.w + ' / ' + r.h;   // proporção REAL
        const pick = video._rgSd ? r.sd : r.hd;   // post = SD (menor/rápido); feed = HD
        video._rgUrl = pick;   // guarda a URL resolvida → botão de download
        if (rgDirect[rgHost(pick)] === false) {   // host precisa de blob (download inteiro, pesado)
            if (deferBlob(video, pick, wrap)) return;   // INLINE autoplay-off: adia pro play (não trava a fila baixando o mp4 inteiro à toa)
            return rgViaBlob(video, pick, wrap);
        }
        return rgViaDirect(video, pick, wrap);                                        // streaming direto (rápido)
    }

    function rgViaDirect(video, url, wrap) {   // STREAMING progressivo (no-referrer) — começa a tocar em ~1s, sem baixar tudo
        const host = rgHost(url);
        return new Promise(resolve => {
            let settled = false;
            const cleanup = () => { video.removeEventListener('loadedmetadata', onData); video.removeEventListener('error', onErr); clearTimeout(wd); };
            const ok = () => { if (settled) return; settled = true; rgDirect[host] = true; cleanup(); rgPlayIfVisible(video, wrap); resolve(); };
            // hard = falha REAL (erro/0x0) → memoriza que o host precisa de blob (próximos vão direto pro blob, sem perder tempo no probe).
            // soft = só timeout de rede lenta → cai pro blob SÓ neste vídeo, sem condenar o host inteiro: 1 vídeo lento não vira sessão toda em full-download.
            const toBlob = hard => { if (settled) return; settled = true; if (hard) rgDirect[host] = false; cleanup(); try { video.removeAttribute('src'); video.load(); } catch (x) {} if (deferBlob(video, url, wrap)) { resolve(); return; } rgViaBlob(video, url, wrap).then(resolve); };
            const onData = () => { if (video.videoWidth > 0) ok(); else toBlob(true); };
            const onErr = () => toBlob(true);
            video.addEventListener('loadedmetadata', onData, { once: true });   // metadata basta p/ confirmar acesso + pegar duração/proporção
            video.addEventListener('error', onErr, { once: true });
            const wd = setTimeout(() => { if (video.readyState < 1) toBlob(false); }, rgDirect[host] === true ? 15000 : 8000);   // tolerante: o 206 funciona; só cai pro blob (que é + lento) em lentidão EXTREMA. Erro real cai na hora pelo onErr.
            video.referrerPolicy = video._rgKeepRef || 'no-referrer';   // host referer-locked (imagepond): preserva o referer da origem (senão 403); resto = no-referrer
            video.preload = 'metadata';   // só metadata (não baixa o vídeo inteiro à toa — economiza banda em vídeo longo); toca/bufferiza no play
            video.src = url;
        });
    }

    function rgViaBlob(video, url, wrap) {   // baixa o mp4 inteiro (Referer forjado) — confiável mas sem streaming. Já roda DENTRO do slot do rgLoad (não enfileira de novo: daria deadlock).
        if (wrap) wrap.classList.add('smg-rg-loading');
        return rgBlob(url, video._rgRef).then(blob => {
            if (!video.isConnected) return;   // detached durante o download (ex.: navegou no feed) → não cria objectURL órfão
            const u = URL.createObjectURL(blob);
            rgBlobs.push({ url: u, video });
            // LRU: evicta o objectURL mais antigo que NÃO está tocando — revogar/limpar um vídeo em loop visível o apagaria na cara do usuário
            while (rgBlobs.length > 6) {
                const idx = rgBlobs.findIndex(e => e.video !== video && (!e.video || e.video.paused));
                if (idx < 0) break;   // todos os outros estão tocando → deixa passar de 6 por ora (eviccionam quando pausarem)
                const old = rgBlobs.splice(idx, 1)[0];
                try { URL.revokeObjectURL(old.url); } catch (x) {}
                if (old.video) { old.video.removeAttribute('src'); old.video.load(); old.video.dataset.rgLoaded = ''; }
            }
            video.referrerPolicy = '';
            video.src = u;
            rgPlayIfVisible(video, wrap);
        }).catch(() => {   // blob tbm falhou → último recurso: mp4 direto no-referrer; se falhar, volta o iframe
            video.addEventListener('error', () => rgRestore(video), { once: true });
            video.referrerPolicy = 'no-referrer';
            video.src = url;
            rgPlayIfVisible(video, wrap);
        });
    }
    // teardown COMPLETO de um player que vai sair do DOM (feed troca de slide / fecha / fallback):
    // pausa, solta o src (decoder/buffer), revoga poster blob + mp4 blob, desregistra dos 3 IOs e
    // tira do rgLiveVideos. Sem isto o feed acumulava um <video> ZUMBI por slide visitado (o Set só
    // se auto-podava dentro do rgSolo, que roda apenas em play COM som — sessão muda nunca podava).
    function rgDispose(video) {
        if (!video) return;
        try { video.pause(); } catch (e) {}
        if (rgPlayIO) rgPlayIO.unobserve(video);
        if (rgFreeIO) rgFreeIO.unobserve(video);
        if (rgLoadIO) rgLoadIO.unobserve(video);
        if (video._rgPosterUrl) { try { URL.revokeObjectURL(video._rgPosterUrl); } catch (e) {} video._rgPosterUrl = null; }
        for (let i = rgBlobs.length - 1; i >= 0; i--) if (rgBlobs[i].video === video) { try { URL.revokeObjectURL(rgBlobs[i].url); } catch (e) {} rgBlobs.splice(i, 1); }
        if (video.getAttribute('src')) { video.removeAttribute('src'); try { video.load(); } catch (e) {} }
        rgLiveVideos.delete(video);
    }
    function rgRestore(video, dead) {
        const wrap = video.closest('.smg-rg'); if (!wrap) return;
        // todo branch abaixo tira o <video> do DOM → teardown completo primeiro,
        // senão o IO/Set retém o nó detached (vaza o elemento + decoder).
        rgDispose(video);
        // gif MORTO (redgifs): em vez do iframe que mostra "Error loading this gif", um placeholder discreto
        if (dead && video.dataset.rgid && !wrap._rgFallback) {
            const ph = document.createElement('div'); ph.className = 'smg-rg-fail'; ph.textContent = i18n('RedGifs unavailable');
            if (wrap.parentNode) wrap.parentNode.insertBefore(ph, wrap);
            wrap.remove(); return;
        }
        if (wrap._rgFallback) { const fb = wrap._rgFallback; wrap.remove(); fb(); return; }   // turbo/saint → monta o iframe nativo
        if (wrap._rgIframe) { if (wrap.parentNode) wrap.parentNode.insertBefore(wrap._rgIframe, wrap); wrap._rgIframe.style.display = ''; wrap.remove(); return; }   // tínhamos REMOVIDO o iframe (parar o áudio) → recoloca no lugar
        const id = video.dataset.rgid;
        if (wrap._rgFeedHost && id) {   // feed/overlay → volta o iframe nativo do feed (com autoplay)
            const f = document.createElement('iframe');
            f.src = feedEmbedUrl('https://www.redgifs.com/ifr/' + id, true);
            f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
            f.allowFullscreen = true;
            wrap._rgFeedHost.appendChild(f);
            wrap.remove(); return;
        }
        const host = wrap._rgLoader;   // veio de um loader (sem iframe) → monta o iframe nativo do redgifs no lugar
        if (host && id) {
            const ifr = document.createElement('iframe');
            ifr.src = 'https://www.redgifs.com/ifr/' + id;
            ifr.setAttribute('allow', 'autoplay; fullscreen');
            ifr.allowFullscreen = true; ifr.loading = 'lazy';
            ifr.dataset.rgDone = '1';   // não re-processar
            host.appendChild(ifr);
        }
        wrap.remove();
    }
    function rgBuild(rgid) {   // <video> mudo+loop com NOSSOS controles (não o nativo do HTML5); autoplay só em vista; object-fit:contain
        const wrap = document.createElement('div'); wrap.className = 'smg-rg smg-rg-loading';   // skeleton já no build (escondido até o frame chegar)
        const video = document.createElement('video');
        video.className = 'smg-rg-v';
        video.loop = true; video.muted = true; video.playsInline = true; video.preload = 'none';   // SEM controls nativo
        video.referrerPolicy = 'no-referrer';   // o POSTER do redgifs (media.redgifs.com/{Id}-poster.jpg) é referer-locked: 403 com o referer do fórum, 200 sem → precisa estar setado ANTES de setar o poster (rgPrepare/rgLoad)
        video.dataset.rgid = rgid;
        video._rgSource = 'RedGifs';   // marca dágua da fonte (watermark no hover)
        rgLiveVideos.add(video);
        video._rgExt = 'https://www.redgifs.com/watch/' + rgid;   // botão "abrir em nova guia"
        video._rgFeed = 'https://www.redgifs.com/ifr/' + rgid;    // botão "abrir no visualizador" (bate com collectMediaFrom)
        wrap.appendChild(video);
        rgControls(wrap, video);   // play/pause + flash · progresso seekável · volume flyout · tempo · externo · visualizador · auto-hide
        return { wrap, video };
    }
    function rgFmt(t) {   // M:SS; ≥ 1h vira H:MM:SS (vídeo longo mostrava "160:19" em vez de "2:40:19")
        t = Math.max(0, t | 0);
        const h = t / 3600 | 0, m = (t / 60 | 0) % 60, s = t % 60, ss = (s < 10 ? '0' : '') + s;
        return h ? h + ':' + (m < 10 ? '0' : '') + m + ':' + ss : m + ':' + ss;
    }
    // nome do arquivo p/ o download: usa o ?fn= (turbo) ou o último segmento; senão genérico
    function rgDownloadName(url, source) {
        try { const u = new URL(url, location.href); const fn = u.searchParams.get('fn'); if (fn) return fn.replace(/[\\/:*?"<>|]+/g, '_'); const seg = decodeURIComponent((u.pathname.split('/').pop() || '')); if (/\.\w{2,5}$/.test(seg)) return seg; } catch (e) {}
        return (source || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '') + '.mp4';
    }
    function rgControls(wrap, video) {   // controles próprios: play central + progresso embaixo + rail vertical (volume · overlay · tela cheia · externo)
        const mkAct = (icon, label, on) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'smg-rgc-act'; b.innerHTML = icon; b.title = i18n(label); b.setAttribute('aria-label', i18n(label)); b.addEventListener('click', on); return b; };
        const toggle = () => {
            if (!video.paused) { video.pause(); return; }
            video._rgUserPlayed = true;
            if (video._rgDeferUrl) {   // o blob foi adiado (inline autoplay-off) → baixa AGORA + toca (rgViaBlob → rgPlayIfVisible; _rgUserPlayed já é true)
                const u = video._rgDeferUrl; video._rgDeferUrl = null;
                wrap.classList.remove('smg-rg-ready'); wrap.classList.add('smg-rg-loading');
                rgViaBlob(video, u, wrap);
                return;
            }
            if (video._rgUrl && !video.dataset.rgLoaded) {   // turbo/saint preparado (só poster) → AGORA faz o stream + toca
                wrap.classList.remove('smg-rg-ready'); wrap.classList.add('smg-rg-loading');
                rgLoadUrl(video, video._rgUrl, wrap);
                return;
            }
            if (video.dataset.rgid && !video.dataset.rgLoaded) {   // redgifs preparado (só poster) → AGORA baixa o vídeo de verdade + toca (rgLoad → rgViaDirect/Blob → rgPlayIfVisible; _rgUserPlayed já é true)
                wrap.classList.remove('smg-rg-ready'); wrap.classList.add('smg-rg-loading');
                rgLoad(video);
                return;
            }
            const p = video.play(); if (p && p.catch) p.catch(() => {});
        };
        // SEEK ±5s + flash "« 5s" / "5s »"
        const sflash = document.createElement('div'); sflash.className = 'smg-rgc-seekflash';
        let sflashT;
        const seek = d => {
            if (!video.duration) return;
            video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + d));
            sflash.textContent = d < 0 ? '« 5s' : '5s »';
            sflash.classList.add('on'); clearTimeout(sflashT); sflashT = setTimeout(() => sflash.classList.remove('on'), 480);
        };
        // CLIQUE no vídeo: 1× = play/pause · 2× = ±5s (metade esquerda/direita). timer separa single de double-click.
        let clickT = null;
        video.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            if (clickT) return;   // já há um clique pendente → este é o 2º (o dblclick cuida do seek)
            clickT = setTimeout(() => { clickT = null; toggle(); }, 230);
        });
        video.addEventListener('dblclick', e => {
            e.preventDefault(); e.stopPropagation();
            if (clickT) { clearTimeout(clickT); clickT = null; }   // cancela o play/pause pendente
            const r = video.getBoundingClientRect();
            seek((e.clientX - r.left) < r.width / 2 ? -5 : 5);
        });
        // CENTRO: play grande (só no pausado/pronto) — seek é por DUPLO-CLIQUE no vídeo (estilo YouTube)
        const flash = document.createElement('div'); flash.className = 'smg-rgc-flash';
        const playBtn = document.createElement('button'); playBtn.type = 'button'; playBtn.className = 'smg-rgc-play'; playBtn.setAttribute('aria-label', i18n('Play/Pause')); playBtn.innerHTML = ICONS.rgPlay;
        playBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggle(); });
        flash.appendChild(playBtn);
        // SCRUBBER (no topo da barra): buffer + preenchido + knob; seekável por drag
        const buf = document.createElement('div'); buf.className = 'smg-rgc-buf';
        const fill = document.createElement('div'); fill.className = 'smg-rgc-fill';
        const knob = document.createElement('div'); knob.className = 'smg-rgc-knob'; fill.appendChild(knob);
        const bar = document.createElement('div'); bar.className = 'smg-rgc-bar'; bar.append(buf, fill);
        const prog = document.createElement('div'); prog.className = 'smg-rgc-prog'; prog.appendChild(bar);
        // rect CACHEADO no pointerdown (não muda durante o drag): getBoundingClientRect por pointermove
        // forçava layout síncrono a cada move (o write do 'seeking'/fill suja o layout entre moves)
        const seekTo = (cx, r) => { if (!video.duration || !r.width) return; video.currentTime = Math.max(0, Math.min(1, (cx - r.left) / r.width)) * video.duration; };
        prog.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const r = bar.getBoundingClientRect(); seekTo(e.clientX, r); const mv = ev => seekTo(ev.clientX, r); const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); }; document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); });
        // TEMPO (atual / duração)
        const tEl = document.createElement('span'); tEl.className = 'smg-rgc-time'; tEl.textContent = '0:00';
        // PERF: escreve no text node (.data = characterData, que o observer global NÃO escuta). textContent
        // recriava o text node a cada timeupdate (~4Hz/vídeo) → mutação childList → processAll com dirtyRoots
        // vazio = FULL-SCAN do body a cada tick. Skip-if-same corta os ticks dentro do mesmo segundo.
        const syncTime = () => { const s = rgFmt(video.currentTime) + (video.duration ? ' / ' + rgFmt(video.duration) : ''); if (tEl.firstChild.data !== s) tEl.firstChild.data = s; };
        video.addEventListener('timeupdate', () => { if (video.duration) fill.style.width = (video.currentTime / video.duration * 100) + '%'; syncTime(); });
        video.addEventListener('loadedmetadata', syncTime);
        video.addEventListener('progress', () => { try { if (video.buffered.length && video.duration) buf.style.width = (video.buffered.end(video.buffered.length - 1) / video.duration * 100) + '%'; } catch (x) {} });
        // VOLUME: barra DIV (igual a de progresso, que SEMPRE renderiza — o <input range> vinha só como um PONTO).
        // Linha no canto inferior-ESQUERDO [mudo][======barra======], sempre visível no hover (sem flyout).
        const mute = mkAct(ICONS.volumeMute, 'Mute', e => { e.stopPropagation(); video.muted = !video.muted; if (!video.muted) { if (!video.volume) video.volume = 1; rgSolo(video); } syncVol(); });
        const volfill = document.createElement('div'); volfill.className = 'smg-rgc-volfill';
        const volbar = document.createElement('div'); volbar.className = 'smg-rgc-volbar'; volbar.setAttribute('role', 'slider'); volbar.setAttribute('aria-label', i18n('Volume')); volbar.appendChild(volfill);
        const syncVol = () => { mute.innerHTML = (video.muted || !video.volume) ? ICONS.volumeMute : ICONS.volume; volfill.style.width = ((video.muted ? 0 : video.volume) * 100) + '%'; };
        const setVolFromX = (cx, r) => { if (!r.width) return; const v = Math.max(0, Math.min(1, (cx - r.left) / r.width)); video.volume = v; video.muted = (v === 0); if (v > 0) rgSolo(video); syncVol(); };
        volbar.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const r = volbar.getBoundingClientRect(); setVolFromX(e.clientX, r); const mv = ev => setVolFromX(ev.clientX, r); const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); }; document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); });
        const volgrp = document.createElement('div'); volgrp.className = 'smg-rgc-vol'; volgrp.append(mute, volbar);   // volume na barra (slider expande no hover)
        // rail (2 botões): (1) abrir no NOSSO visualizador (feed) · (2) TELA CHEIA real. O "abrir EXTERNO" virou o badge da FONTE (.smg-rgc-src), canto sup-direito.
        const over = mkAct(ICONS.gallery, 'Open in viewer', e => { e.stopPropagation(); document.querySelectorAll('video.smg-rg-v').forEach(v => { try { v.pause(); } catch (x) {} }); if (video._rgFeed) { try { openMediaFeed(video._rgFeed); } catch (x) {} } });   // grid (galeria) ≠ cantos (fullscreen)
        over.classList.add('smg-rgc-over');   // escondido no feed (lá já É o visualizador) — ver CSS
        const fs = mkAct(ICONS.rgExpand, 'Fullscreen', e => { e.stopPropagation(); try { document.fullscreenElement ? document.exitFullscreen() : wrap.requestFullscreen(); } catch (x) {} });
        const dl = mkAct(ICONS.download, 'Download', e => { e.stopPropagation(); const u = video._rgUrl; if (u) smgDownload(u, rgDownloadName(u, video._rgSource)); else if (video._rgExt) window.open(video._rgExt, '_blank', 'noopener'); });
        // BARRA INFERIOR (YouTube): scrubber em cima + linha [play · volume · tempo ··· download · visualizador · tela cheia]
        const barPlay = mkAct(ICONS.rgPlay, 'Play/Pause', e => { e.stopPropagation(); toggle(); }); barPlay.classList.add('smg-rgc-barplay');   // ícone PREENCHIDO → isenta do fill:none do #smg-feed
        const bottom = document.createElement('div'); bottom.className = 'smg-rgc-bottom';
        const row = document.createElement('div'); row.className = 'smg-rgc-row';
        const leftc = document.createElement('div'); leftc.className = 'smg-rgc-left'; leftc.append(barPlay, volgrp, tEl);
        const rightc = document.createElement('div'); rightc.className = 'smg-rgc-right'; rightc.append(dl, over, fs);
        row.append(leftc, rightc);
        bottom.append(prog, row);
        // FONTE + abrir EXTERNO num só: badge clicável no canto SUP-DIREITO ("Turbo ↗"). É a marca-dágua da fonte E o "abrir no host".
        const src = document.createElement('a'); src.className = 'smg-rgc-src'; src.target = '_blank'; src.rel = 'noopener noreferrer'; src.title = i18n('Open in new tab');
        src.innerHTML = '<span class="smg-rgc-src-t">' + (video._rgSource || '') + '</span>' + ICONS.rgExternal;
        const syncSrcHref = () => { if (video._rgExt) src.href = video._rgExt; };   // redgifs já tem _rgExt aqui; turbo/saint setam logo após o build → sincroniza no hover
        syncSrcHref(); src.addEventListener('pointerenter', syncSrcHref);
        src.addEventListener('click', e => { e.stopPropagation(); if (!video._rgExt) e.preventDefault(); });   // não dispara o play/pause do player; sem _rgExt → não navega
        // estado play/pause → classe (o CSS mostra/esconde o play central)
        video.addEventListener('play', () => { wrap.classList.add('smg-rgc-playing'); playBtn.innerHTML = ICONS.rgPause; barPlay.innerHTML = ICONS.rgPause; if (!video.muted) rgSolo(video); });
        video.addEventListener('pause', () => { wrap.classList.remove('smg-rgc-playing'); playBtn.innerHTML = ICONS.rgPlay; barPlay.innerHTML = ICONS.rgPlay; });
        video.addEventListener('volumechange', syncVol);
        // LOADING ao avançar/voltar: spinner por cima SÓ no SEEK do usuário (era o pedido). NÃO usa 'waiting':
        // vídeo PAUSADO + preload=metadata (inline, autoplay off) dispara 'waiting' no load mas NUNCA 'canplay'/'playing'
        // → dava spinner ETERNO. 'seeking' NÃO dispara no load (só quando o usuário muda o currentTime). Remoção redundante p/ garantir.
        video.addEventListener('seeking', () => wrap.classList.add('smg-rg-buffering'));
        ['seeked', 'canplay', 'playing', 'loadeddata', 'pause', 'suspend', 'error', 'abort'].forEach(ev => video.addEventListener(ev, () => wrap.classList.remove('smg-rg-buffering')));
        // SKELETON: revela o player só quando o vídeo TEM frame de verdade (loadeddata/canplay). Persistente (não 'once').
        const clearSkel = () => wrap.classList.remove('smg-rg-loading', 'smg-rg-ready');   // carregou de verdade → tira skeleton E o estado "pronto". MANTÉM o aspect-ratio: a caixa fica no aspect REAL (setado no metadata/API) → revela já no tamanho certo, sem "ajustar no play"
        video.addEventListener('loadeddata', clearSkel);
        video.addEventListener('canplay', () => { clearSkel(); wrap.classList.remove('smg-rg-buffering'); });
        wrap.append(flash, sflash, bottom, src);
        syncVol(); syncTime();
    }
    function rgStart(video, preferSd) {   // preferSd: post = SD (rápido); feed = HD
        video._rgSd = !!preferSd;
        const lio = getRgLoadIO(), pio = getRgPlayIO(), fio = getRgFreeIO();
        if (lio) lio.observe(video); else rgLoad(video);   // sem IO → carrega já
        if (pio) pio.observe(video);
        if (fio) fio.observe(video);   // libera o src se o vídeo ficar muito longe da viewport (memória)
    }

    // ---- player nativo p/ um mp4 JÁ conhecido (turbo/saint via scrape): reusa rgControls + streaming direto→blob ----
    function buildNativeVideo(mp4Url, blobReferer, fallback, source) {
        const wrap = document.createElement('div'); wrap.className = 'smg-rg smg-rg-loading';   // skeleton já no build (escondido até o frame chegar)
        const video = document.createElement('video'); video.className = 'smg-rg-v';
        video.loop = true; video.muted = true; video.playsInline = true; video.preload = 'none';
        video._rgRef = blobReferer || '';                 // Referer p/ o blob (host hotlink-protected)
        if (source) video._rgSource = source;             // marca dágua da fonte (watermark no hover)
        rgLiveVideos.add(video);
        if (fallback) wrap._rgFallback = fallback;         // falha total do vídeo → volta o iframe
        video.addEventListener('loadedmetadata', () => { if (video.videoWidth && video.videoHeight) wrap.style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight; }, { once: true });
        wrap.appendChild(video);
        rgControls(wrap, video);
        return { wrap, video };
    }
    function rgLoadUrl(video, url, wrap) {   // = rgLoad, mas com a URL pronta (sem a API do redgifs)
        if (!video || video.dataset.rgLoaded) return;
        video.dataset.rgLoaded = '1';
        if (wrap) wrap.classList.add('smg-rg-loading');
        if (rgDirect[rgHost(url)] === false) {   // host conhecido-blob
            if (deferBlob(video, url, wrap)) return;   // inline autoplay-off → adia o blob pro play
            return rgViaBlob(video, url, wrap);
        }
        return rgViaDirect(video, url, wrap);
    }
    function rgStartUrl(video, url, wrap) {   // toca quando visível + carrega já (na fila, máx 3, junto do redgifs)
        const pio = getRgPlayIO(); if (pio) pio.observe(video);
        rgEnqueue(() => rgLoadUrl(video, url, wrap));
    }
    // PREPARO p/ URL conhecida (turbo): mostra o poster + estado PRONTO, SEM baixar nenhum byte de vídeo. O stream
    // acontece só no PLAY (toggle → rgLoadUrl). Igual ao player do turbo (preload=none + poster) → first-paint
    // instantâneo e zero contenção de banda no feed (antes: rgStartUrl baixava metadata de CADA turbo adiantado).
    function rgPrepareUrl(video, url, wrap, poster) {
        video._rgUrl = url;
        if (poster) {
            video.poster = poster;
            const im = new Image();   // pré-carrega o poster (warm cache) E pega as dimensões → seta o aspect-ratio da caixa (sem isso a caixa colapsa: turbo não tem dims na API)
            im.onload = () => { if (im.naturalWidth && im.naturalHeight && wrap) wrap.style.aspectRatio = im.naturalWidth + ' / ' + im.naturalHeight; };
            im.src = poster;
        }
        if (wrap) { wrap.classList.remove('smg-rg-loading'); wrap.classList.add('smg-rg-ready'); }
        const pio = getRgPlayIO(); if (pio) pio.observe(video);   // pausa ao sair da viewport (se o usuário tiver dado play)
    }

    // libera o slot do turbo/saint do aspect 16:9 + overflow:hidden quando montamos NOSSO player dentro dele.
    // INLINE (setProperty important) de propósito: à prova de :has não-aplicado/cascata → vídeo vertical NUNCA é cortado.
    function fillSlot(slot) {
        if (!slot) return;
        slot.classList.add('smg-turbo-slot--filled');
        slot.style.setProperty('aspect-ratio', 'auto', 'important');
        slot.style.setProperty('overflow', 'visible', 'important');
    }
    // desfaz o fillSlot: volta o slot ao 16:9. Necessário se o player nativo MONTOU e depois FALHOU (cai pro iframe):
    // o iframe é position:absolute → precisa do slot com altura (16:9), senão colapsa (altura 0) e some.
    function unfillSlot(slot) {
        if (!slot) return;
        slot.classList.remove('smg-turbo-slot--filled');
        slot.style.removeProperty('aspect-ratio');
        slot.style.removeProperty('overflow');
    }

    // o embed do turbo é um PLAYER JS que pega o vídeo via /api/sign — então NÃO baixamos a página-player (25KB = o "2º player"
    // desnecessário, já que o nosso é o player). Resolvemos DIRETO pela API (só precisa do id + Referer). Bem mais rápido.
    // poster do turbo/saint a partir do mp4 resolvido (dl*.turbocdn.st/data/{id}.mp4 → cdn.turbo.cr/thumbs/{id}.jpg). Sem request extra.
    function turboPoster(mp4) { const m = (mp4 || '').match(/\/data\/([^/?#.]+)\.[a-z0-9]+/i); return m ? 'https://cdn.turbo.cr/thumbs/' + m[1] + '.jpg' : ''; }
    function turboResolve(embedUrl, cb) {
        const id = (embedUrl.match(/\/embed\/([^/?#]+)/) || [])[1] || '';
        if (!GMX || !id) { cb(null); return; }
        turboApi(id, embedUrl, cb);
    }
    // pega a URL do vídeo pela API do turbo: GET /api/sign?v={id} → { success, url } (mp4/mov assinado em dl*.turbocdn.st, com exp/token)
    function turboApi(id, embedUrl, cb) {
        if (!GMX || !id) { cb(null); return; }
        GMX({ method: 'GET', url: 'https://turbo.cr/api/sign?v=' + encodeURIComponent(id), timeout: 12000,
            headers: { Referer: embedUrl, 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json, text/plain, */*' },
            onload: r => {
                const t = r.responseText || '';
                let url = null;
                try { url = turboUrlFromJson(JSON.parse(t)); } catch (e) { const m = t.match(/https?:[^"'\s\\]+\.(?:mp4|mov|webm|m3u8)[^"'\s\\]*/i); if (m) url = m[0].replace(/\\\//g, '/'); }
                if (url && /\.m3u8(\?|$)/i.test(url)) { console.warn('[smg-turbo] HLS (.m3u8) precisa de hls.js → iframe:', id); cb(null); return; }
                cb(url || null);
            },
            onerror: () => { cb(null); },
            ontimeout: () => { cb(null); } });
    }
    function turboUrlFromJson(j) {   // procura a URL do vídeo em formatos comuns de resposta
        if (!j) return null;
        if (typeof j === 'string') return /\.(mp4|m3u8)/i.test(j) ? j : null;
        const direct = j.url || j.file || j.src || j.video || j.source || j.link || (j.data && (j.data.url || j.data.file || j.data.src || j.data.video));
        if (direct && typeof direct === 'string') return direct;
        if (Array.isArray(j) && j.length) return turboUrlFromJson(j[0]);
        if (Array.isArray(j.sources) && j.sources.length) return turboUrlFromJson(j.sources[0]);
        if (Array.isArray(j.files) && j.files.length) return turboUrlFromJson(j.files[0]);
        const m = JSON.stringify(j).match(/https?:[^"'\s\\]+\.(?:mp4|m3u8)[^"'\s\\]*/i);   // varredura geral
        return m ? m[0].replace(/\\\//g, '/') : null;
    }

    // SIMP: o turbo já vem como IFRAME nativo (.generic2wide-iframe-div > iframe[src*=turbo], NÃO como link) → troca pelo nosso player.
    // (o nosso fallback é .generic2wide-iframe-div > .smg-turbo-slot > iframe, ou seja NETO — o seletor `>` direto só pega o nativo.)
    function processTurboNativeEmbeds(roots) {
        if (!(FEATURES.turboNativePlayer && GMX)) return;
        eachIn(roots, '.generic2wide-iframe-div > iframe[src*="turbo.cr/embed/"]:not([data-tb-done])', ifr => {
            ifr.dataset.tbDone = '1';
            const id = (ifr.getAttribute('src').match(/\/embed\/([^/?#]+)/) || [])[1];
            const div = ifr.parentElement;
            if (!id || !div || div.querySelector('.smg-rg, .smg-turbo-slot')) return;   // já temos player/slot aqui
            // DEDUP cross-pass: o processTurboLinks (link → nosso wrapper) já montou esse MESMO turbo nesse corpo?
            // (no SMG o XF às vezes emite o turbo como LINK + iframe nativo p/ o mesmo id → dava 2 players).
            const body = div.closest('.message-userContent, .comment-body') || div.closest('.bbWrapper');
            if (body && body.querySelector('[data-tb-id="' + id + '"]')) { ifr.remove(); return; }   // já tem o nosso → só mata o iframe velho
            div.dataset.tbId = id;   // reconcilia: o link pass pula se ver esse id
            const embedUrl = 'https://turbo.cr/embed/' + id;
            // PARA O PLAYER VELHO JÁ: detacha o iframe nativo (mata rede/áudio do turbo antigo) e põe spinner no lugar.
            // Sem isto o iframe ficava CARREGANDO/TOCANDO durante todo o scrape async = "old turbo carrega primeiro, depois o nosso".
            const slot = document.createElement('div'); slot.className = 'smg-turbo-slot';
            const loading = document.createElement('div'); loading.className = 'smg-loading';
            slot.appendChild(loading);
            div.insertBefore(slot, ifr);
            ifr.remove();
            const restoreIframe = () => { if (slot.querySelector('iframe')) return; unfillSlot(slot); loading.remove(); ifr.classList.add('saint-iframe'); ifr.removeAttribute('style'); slot.appendChild(ifr); };   // iframe nativo PREENCHE o slot 16:9 (saint-iframe + tira o style inline height:360px que quebrava na coluna)
            turboResolve(embedUrl, mp4 => {
                if (div.querySelector('.smg-rg')) return;
                if (!mp4) { restoreIframe(); return; }            // sem url → volta o iframe nativo
                const { wrap, video } = buildNativeVideo(mp4, 'https://turbo.cr/', restoreIframe, 'Turbo');
                video._rgExt = embedUrl; video._rgFeed = embedUrl;
                loading.remove();
                slot.appendChild(wrap);
                fillSlot(slot);   // solta o 16:9/overflow do slot → não corta vídeo vertical
                rgPrepareUrl(video, mp4, wrap, turboPoster(mp4));   // poster + pronto; stream só no play
            });
        });
    }

    // SMG: imagepond vem como IFRAME nativo (iframe[src*=imagepond.net/videos/{id}], solto no .bbWrapper) → troca pelo nosso player.
    // O mp4 (referer-locked à ORIGEM do fórum: 403 sem Referer, 206 com) sai do scrape da página /videos/{id} (a id do iframe
    // não mapeia direto pro nome do arquivo). Tocamos DIRETO (streaming, referer preservado via _rgKeepRef), blob como rede de segurança.
    function imagepondPoster(mp4) { return (mp4 || '').replace(/\.(?:mp4|mov|m4v|webm)(\?.*)?$/i, '_thumb.jpg'); }   // media/videos/{nome}.{ext} → {nome}_thumb.jpg (não é referer-locked)
    // → { mp4, img }: a página /videos/{id} do imagepond pode ser VÍDEO ou IMAGEM. O ARQUIVO de vídeo (media.imagepond.net/media/videos/…)
    // NÃO está no HTML estático da /videos/{id} (carrega por JS) — ele aparece na página /i/{slug} que a /videos/ LINKA. Então: tenta achar
    // a mídia direta nesta página; se não, segue UMA vez pro link /i/ e procura lá. `mp4` pode ser .mp4/.mov/.m4v/.webm (o player nativo toca todos).
    function imagepondResolve(pageUrl, cb) {
        if (!GMX || !pageUrl) { cb(null); return; }
        const VEXT = '(?:mp4|mov|m4v|webm)';
        const grabVid = t => {
            let m = t.match(new RegExp('<source[^>]+src=["\']([^"\']+\\.' + VEXT + '[^"\']*)["\']', 'i'));   // <source> direto (não HLS .m3u8)
            let v = m ? m[1] : null;
            if (!v) { const g = t.match(new RegExp('https?://[^"\'\\s)]*media\\.imagepond\\.net/media/videos/[^"\'\\s)]+\\.' + VEXT + '[^"\'\\s)]*', 'i')); v = g ? g[0] : null; }
            return v ? v.replace(/&amp;/g, '&') : null;
        };
        const grabImg = t => {   // imagem de CONTEÚDO (/media/images/) EXCLUINDO ícones do site (android-chrome/favicon/apple-touch/mstile/logo)
            const re = /https?:\/\/[^"'\s)]*media\.imagepond\.net\/media\/images\/[^"'\s)]+\.(?:jpe?g|png|webp|gif|avif)[^"'\s)]*/ig;
            for (let mm; (mm = re.exec(t));) { if (!/android-chrome|apple-touch-icon|favicon|mstile|safari-pinned-tab|site[-_]?icon|app[-_]?icon|(?:^|[/_-])logo(?:[/_.-]|$)/i.test(mm[0])) return mm[0].replace(/&amp;/g, '&'); }
            return null;
        };
        GMX({ method: 'GET', url: pageUrl, timeout: 12000,
            headers: { Referer: location.origin + '/', Accept: 'text/html,application/xhtml+xml,*/*' },
            onload: r => {
                const t = r.responseText || '';
                const vid = grabVid(t);
                if (vid) { cb({ mp4: vid, img: null }); return; }
                const img = grabImg(t);
                if (img) { cb({ mp4: null, img }); return; }
                // /videos/{id}: o arquivo mora na página /i/{slug} (linkada aqui). Segue UMA vez (não a partir de uma /i/, evita loop), pulando o /i/{id}/download.
                if (!/\/i\//.test(pageUrl)) {
                    const re = /https?:\/\/[^"'\s)]*imagepond\.net\/i\/[^"'\s)]+/ig;
                    for (let mm; (mm = re.exec(t));) { const u = mm[0].replace(/&amp;/g, '&'); if (!/\/download\b/i.test(u)) { imagepondResolve(u, cb); return; } }
                }
                cb(null);
            },
            onerror: () => cb(null), ontimeout: () => cb(null) });
    }
    function processImagepondNativeEmbeds(roots) {
        if (!(FEATURES.imagepondEmbeds && GMX)) return;
        eachIn(roots, 'iframe[src*="imagepond.net/videos/"]:not([data-ip-done]), iframe[src*="imagepond.net/video/"]:not([data-ip-done])', ifr => {
            ifr.dataset.ipDone = '1';
            if (ifr.closest('.smg-rg')) return;   // já é o iframe de fallback que NÓS montamos
            const pageUrl = ifr.getAttribute('src') || '';
            const id = (pageUrl.match(/\/videos?\/([^/?#]+)/) || [])[1];
            if (!id) return;
            // PARA O PLAYER VELHO JÁ: detacha o iframe nativo (mata rede/áudio do imagepond) e põe spinner no lugar.
            const wrapper = document.createElement('div'); wrapper.className = 'generic2wide-iframe-div'; wrapper.dataset.ipId = id;
            const slot = document.createElement('div'); slot.className = 'smg-turbo-slot';
            const loading = document.createElement('div'); loading.className = 'smg-loading';
            slot.appendChild(loading);
            wrapper.appendChild(slot);
            ifr.replaceWith(wrapper);
            const restoreIframe = () => { if (slot.querySelector('iframe')) return; unfillSlot(slot); loading.remove(); ifr.classList.add('saint-iframe'); ifr.removeAttribute('style'); slot.appendChild(ifr); };   // falha total → iframe nativo PREENCHENDO o slot 16:9 (saint-iframe + tira o style inline height:360px que quebrava na coluna)
            const activate = () => {
                if (slot.dataset.ipActivated) return;   // run-once (turboIO E o masonry podem chamar)
                slot.dataset.ipActivated = '1'; slot._smgActivate = null;
                imagepondResolve(pageUrl, res => {
                    if (wrapper.querySelector('.smg-rg')) return;
                    if (res && res.mp4) {                                   // VÍDEO → nosso player
                        const { wrap, video } = buildNativeVideo(res.mp4, location.origin + '/', restoreIframe, 'ImagePond');
                        video._rgKeepRef = 'origin';                        // mp4 referer-locked → streaming direto PRESERVANDO o referer (senão 403); blob (com _rgRef) é o backup
                        video._rgExt = pageUrl; video._rgFeed = pageUrl;
                        loading.remove();
                        slot.appendChild(wrap);
                        fillSlot(slot);                                    // solta o 16:9/overflow do slot → não corta vídeo vertical
                        rgPrepareUrl(video, res.mp4, wrap, imagepondPoster(res.mp4));   // poster + pronto; stream só no play
                        return;
                    }
                    if (res && res.img) {                                   // IMAGEM (o /videos/ do imagepond às vezes é foto) → troca o embed por <img> (entra no pipeline de img + masonry)
                        const a = document.createElement('a'); a.href = res.img; a.target = '_blank'; a.rel = 'noopener noreferrer';
                        const img = document.createElement('img'); img.className = 'bbImage'; img.src = res.img; img.loading = 'lazy'; img.alt = ''; img.dataset.smgLink = pageUrl;
                        a.appendChild(img);
                        wrapper.replaceWith(a);
                        scheduleRun();
                        return;
                    }
                    restoreIframe();                                        // sem mp4 nem img → iframe nativo
                });
            };
            const io = FEATURES.lazyEmbeds ? getTurboIO() : null;
            if (io) { slot._smgActivate = activate; io.observe(slot); } else activate();
        });
        // LINK direto do imagepond: <a href="imagepond.net/video/{numId}.{hash}"><div>media.imagepond.net/media/{numId}.mp4</div></a>
        // o mp4 vem no texto (ou é derivável do href) e NÃO é referer-locked → toca direto. Vira nosso player no lugar do link.
        eachIn(roots, 'a[href*="imagepond.net/video/"]:not([data-ip-done])', link => {
            link.dataset.ipDone = '1';
            if (link.closest('.smg-rg, .smg-turbo-slot')) return;
            const href = link.getAttribute('href') || '';
            let mp4 = (link.textContent.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i) || [])[0];
            if (!mp4) { const m = href.match(/\/video\/(\d+)/); if (m) mp4 = 'https://media.imagepond.net/media/' + m[1] + '.mp4'; }
            if (!mp4) return;
            const wrapper = document.createElement('div'); wrapper.className = 'generic2wide-iframe-div';
            const slot = document.createElement('div'); slot.className = 'smg-turbo-slot';
            wrapper.appendChild(slot);
            link.replaceWith(wrapper);
            const { wrap, video } = buildNativeVideo(mp4, location.origin + '/', null, 'ImagePond');
            video._rgExt = href || mp4;
            slot.appendChild(wrap);
            fillSlot(slot);
            rgPrepareUrl(video, mp4, wrap, imagepondPoster(mp4));   // poster = {id}_thumb.jpg (mesmo padrão do /videos/; não é referer-locked)
        });
    }

    // esconde o placeholder nativo ("Click here to load redgifs media" / botão de expand) ao montar o player num .generic2wide-iframe-div (Simp)
    // ⚠️ setProperty(...,'important'): a CSS tem `span[data-s9e-mediaembed=redgifs]{display:block !important}` → display:none inline NÃO vence sem o !important.
    function rgHidePlaceholder(wrap) {
        const div = wrap.closest('.generic2wide-iframe-div');
        if (div) Array.from(div.children).forEach(c => { if (!c.classList.contains('smg-rg')) c.style.setProperty('display', 'none', 'important'); });
    }

    function applyRedgifsPlayer(roots) {
        if (!GMX) return;   // sem GM_xmlhttpRequest não dá pra furar o CORS da API → deixa o iframe nativo (autoLoadRedgifs cuida)
        // 1) LOADER ainda sem iframe → monta direto pelo id do onclick (não chega a baixar o iframe nativo)
        eachIn(roots, 'div.generic2wide-iframe-div[onclick*="redgifs"]:not([data-rg-done])', div => {
            // já virou iframe → o caso 2 assume. MARCA: sem isso o div ficava no loop (re-checado todo
            // full-scan) e, depois que o caso 2 trocava o iframe pelo player, voltava aqui SEM iframe e
            // montava um SEGUNDO player pelo onclick remanescente (vídeo duplicado).
            if (div.querySelector('iframe')) { div.dataset.rgDone = '1'; return; }
            const id = rgIdFrom(div.getAttribute('onclick') || '');
            if (!id) return;
            div.dataset.rgDone = '1';
            div.dataset.redgifsAutoloaded = 'true';   // autoLoadRedgifs não clica mais nele
            div.removeAttribute('onclick');            // mata o loadMedia nativo (clique no nosso player não injeta iframe duplicado)
            const { wrap, video } = rgBuild(id);
            wrap._rgLoader = div;
            div.appendChild(wrap);
            rgHidePlaceholder(wrap);   // esconde o placeholder nativo ("Click here to load…") — Simp
            rgStart(video, true);   // post = SD
        });
        // 2) IFRAME de redgifs (s9e OU já injetado) → troca por <video>, REMOVE o iframe (restaura na falha).
        // ⚠️ REMOVE, não esconde: iframe com display:none CONTINUA TOCANDO (o áudio do "duplicado" que tocava 20s).
        eachIn(roots, 'iframe[src*="redgifs.com"]:not([data-rg-done]), iframe[data-src*="redgifs.com"]:not([data-rg-done])', ifr => {
            ifr.dataset.rgDone = '1';
            if (ifr.closest('.smg-rg')) return;   // é o iframe de fallback que NÓS montamos → não mexer
            // ANTI-DUP: já existe player nesse embed (loader assumido no caso 1, ou 2ª injeção do site) → REMOVE o iframe (parar áudio), sem 2º player
            const box = ifr.closest('span[data-s9e-mediaembed], .generic2wide-iframe-div') || ifr.parentNode;
            if (box && box.querySelector('.smg-rg')) { ifr.remove(); return; }
            const id = rgIdFrom(ifr.getAttribute('src') || ifr.getAttribute('data-src') || '');
            if (!id) return;
            const { wrap, video } = rgBuild(id);
            wrap._rgIframe = ifr;
            ifr.parentNode.insertBefore(wrap, ifr);   // wrap entra no lugar do iframe
            ifr.remove();                              // mata o iframe (e o áudio) — guardado em wrap._rgIframe p/ restaurar na falha
            rgHidePlaceholder(wrap);   // Simp: se o site auto-carregou o redgifs como iframe DENTRO do .generic2wide-iframe-div, esconde o placeholder ("Click here to load…")
            rgStart(video, true);   // post = SD
        });
        // 3) CATCH-ALL (Simp): assim que um .generic2wide-iframe-div ganha nosso player/fail, esconde o placeholder nativo
        //    ("Click here to load redgifs media"), seja qual for a estrutura/timing. MARCA O DIV (não o placeholder):
        //    antes o seletor varria TODO span[data-s9e-mediaembed] do doc a cada frame e nunca marcava os sem player (leak).
        //    Agora só os divs SEM player ainda (conjunto pequeno) são re-checados; o div com player é marcado e sai do loop.
        eachIn(roots, '.generic2wide-iframe-div:not([data-rg-ph])', div => {
            if (!div.querySelector('.smg-rg, .smg-rg-fail')) {
                // div SEM traço de redgifs (turbo/saint/iframe-fallback) nunca vai ganhar este placeholder →
                // marca e sai do loop. Antes ficava re-checado em TODO full-scan pra sempre (centenas de
                // querySelector à toa em thread grande). Só continua re-checando quem é redgifs pendente.
                if (!/redgifs/i.test(div.getAttribute('onclick') || '') && !div.querySelector('span[data-s9e-mediaembed="redgifs"], .iframe-wrapper-redgifs, iframe[src*="redgifs"], iframe[data-src*="redgifs"]')) div.dataset.rgPh = '1';
                return;   // redgifs ainda sem player → re-checa no próximo frame (não marca)
            }
            div.dataset.rgPh = '1';
            div.querySelectorAll('span[data-s9e-mediaembed], .iframe-wrapper-redgifs').forEach(ph => {
                if (!ph.querySelector('.smg-rg, .smg-rg-fail')) ph.style.setProperty('display', 'none', 'important');   // !important vence a CSS `display:block !important` do s9e
            });
        });
    }

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

    // =========================================================
    // DOCK — navegação (setupPostNavigation): a barra flutuante + busca + filtros + sheet mobile.
    // É a MAIOR função do arquivo. Mapa interno (Cmd+F no texto "// ----"):
    //   layout ....... links da página · page jump · botões · navegação global · navbar mobile · montagem
    //   estado ....... estado da dock · bottom sheet (mobile)
    //   popovers ..... goto · search (+ histórico compartilhado) · settings · filtro por autor · filtro da listagem
    //   posts ........ helpers de post · navegação entre posts · share · save · watch thread · paginação · sort
    //   init ......... estado inicial + atualização dos botões no scroll
    // =========================================================

    function setupPostNavigation() {
        // já montado: sai cedo (não re-escaneia posts a cada mutação)
        if (document.getElementById('smg-post-nav-wrapper')) return;

        // anchors de cada post (ignora respostas em quote)
        let posts = Array.from(
            document.querySelectorAll('span.u-anchorTarget[id^="post-"]')
        ).filter(el => !el.closest('.message-responseRow'));

        // fallback
        if (posts.length === 0) {
            posts = Array.from(document.querySelectorAll('.message'));
        }

        // dock é global: monta em qualquer página. Os grupos de navegação/ação
        // (e a fiação deles) só fazem sentido numa thread.
        const onThreadUrl = /\/threads\//.test(location.pathname);
        if (onThreadUrl && posts.length === 0) return; // espera os posts da thread carregarem
        const isThread = onThreadUrl && posts.length > 0;

        posts.forEach(el => {
            if (el instanceof HTMLElement) el.style.scrollMarginTop = '0px';
        });

        // ---- links da página (casados por CLASSE/HREF, não por texto → funcionam em PT, EN, etc.) ----
        const prevPageLink = document.querySelector('.pageNav-jump--prev, .pageNavSimple-el--prev');
        const nextPageLink = document.querySelector('.pageNav-jump--next, .pageNavSimple-el--next');
        // sort tabs: a de reação tem ?order=reaction_score no href; a de data é a sem order=
        let sortDateLink = null, sortReactionLink = null;
        document.querySelectorAll('.tabs--standalone .tabs-tab, .block-outer-opposite--postSortFilter .tabs-tab').forEach(t => {
            const h = t.getAttribute('href') || '';
            if (/order=reaction/i.test(h)) sortReactionLink = t;
            else if (!/order=/i.test(h)) sortDateLink = t;
        });

        let sortIsDate = !/reaction/i.test(window.location.search || '');

        // ---- page jump (goto): página atual (URL) + total, via readPageJump ----
        const pageJump = (() => {
            const pj = readPageJump();
            return pj ? { tpl: pj.tpl, current: pj.cur, max: pj.max } : null;
        })();

        // ---- botões ----
        const btnSearch = makeDockButton({ id: 'smg-thread-search', icon: ICONS.search, label: 'Search' });
        const btnShare = makeDockButton({ id: 'smg-post-share', icon: ICONS.share, label: 'Copy post' });
        const btnSave = makeDockButton({ id: 'smg-post-save', icon: ICONS.save, label: 'Save post' });
        const btnWatch = makeDockButton({ id: 'smg-thread-watch', icon: ICONS.watch, label: 'Watch thread' });
        const btnSort = makeDockButton({ id: 'smg-post-sort-toggle', icon: ICONS.sortDate, label: 'Sort by date' });
        btnSort.classList.add('smg-nav-labeled');   // pílula com o critério escrito (Data/Reações) — deixa claro pelo quê ordena
        btnSort.appendChild(Object.assign(document.createElement('span'), { className: 'smg-nav-btn-text' }));
        const btnPagePrev = makeDockButton({ id: 'smg-post-page-prev', icon: ICONS.pagePrev, label: 'Prev page' });
        const btnPageNext = makeDockButton({ id: 'smg-post-page-next', icon: ICONS.pageNext, label: 'Next page' });
        const btnGoto = makeDockButton({
            id: 'smg-post-goto',
            icon: pageJump ? String(pageJump.current) : ICONS.goto, // mostra a página atual
            label: 'Go to page',
        });
        // o scroll infinito chama isto pra refletir a página que está na tela
        if (pageJump) smgUpdateDockPage = n => { pageJump.current = n; setBtnIcon(btnGoto, String(n)); };
        const btnUp = makeDockButton({ id: 'smg-scroll-top', icon: ICONS.scrollTop, label: 'Scroll to top' });        // (era "Prev post") → rola pro topo
        const btnDown = makeDockButton({ id: 'smg-scroll-bottom', icon: ICONS.scrollBottom, label: 'Scroll to bottom' }); // (era "Next post") → rola pro fim

        // listagem (fórum/busca): paginação na dock + botão que abre o filtro nativo do XenForo
        const onListUrl = !!document.querySelector('.structItem--thread')
            || !!document.querySelector('.message--articlePreview')                      // article view (forum_view_type_article)
            || /\/forums\/[^/]+/.test(location.pathname)                                  // qualquer página de fórum
            || /^forum_view/.test(document.documentElement.getAttribute('data-template') || '')
            || document.documentElement.getAttribute('data-template') === 'search_results'
            || /\/search\//.test(location.pathname);
        const btnListFilter = (onListUrl && document.querySelector('.filterBar-menuTrigger'))
            ? makeDockButton({ id: 'smg-list-filter', icon: ICONS.filter, label: 'Filter' })
            : null;

        // alternar lista/grade (onde há .structItem--thread: fórum e threads seguidas)
        let viewMode = gmGet('smg-threadview', 'grid');   // grid é o default (toggle lista/grade segue existindo)
        const btnViewToggle = (onListUrl && (document.querySelector('.structItem--thread') || document.querySelector('.message--articlePreview')))
            ? makeDockButton({ id: 'smg-view-toggle', icon: viewMode === 'grid' ? ICONS.list : ICONS.gallery, label: viewMode === 'grid' ? 'List view' : 'Grid view' })
            : null;
        if (btnViewToggle) btnViewToggle.addEventListener('click', () => {
            viewMode = viewMode === 'grid' ? 'list' : 'grid';
            gmSet('smg-threadview', viewMode);
            document.documentElement.classList.toggle('smg-tv-grid', viewMode === 'grid');
            setBtnIcon(btnViewToggle, viewMode === 'grid' ? ICONS.list : ICONS.gallery);
            setBtnLabel(btnViewToggle, viewMode === 'grid' ? 'List view' : 'Grid view');
        });

        const isList = !isThread && onListUrl && (!!pageJump || !!btnListFilter || !!btnViewToggle);

        // ---- navegação global (links) — base do fórum via quick-search (vale em qualquer página) ----
        const boardBase = (() => {
            const qs = document.querySelector('form[data-xf-init="quick-search"]');
            const act = qs?.getAttribute('action') || '/search/search';
            return act.replace(/search\/search\/?$/, '') || '/'; // '/' ou '/community/'
        })();
        const btnHome = makeDockLink({ id: 'smg-nav-home', icon: ICONS.home, label: 'Home', href: boardBase });
        const btnAlerts = makeDockLink({ id: 'smg-nav-alerts', icon: ICONS.alerts, label: 'Alerts', href: boardBase + 'account/alerts' });
        const btnWatched = makeDockLink({ id: 'smg-nav-watched', icon: ICONS.watched, label: 'Watched', href: boardBase + 'watched/threads' });
        const btnTimeline = makeDockLink({ id: 'smg-nav-timeline', icon: ICONS.feed, label: 'Timeline', href: boardBase + '?view=feed' });   // espelha o item central da topbar (river das seguidas)
        // discover/user: só na navbar inferior (mobile); abrem bottom sheets montados no buildTopbar.
        // são links (fallback caso a topbar esteja off); com a topbar, o wireSheet faz preventDefault e abre o sheet.
        const btnDiscover = makeDockLink({ id: 'smg-nav-discover', icon: ICONS.compass, label: 'Discover', href: boardBase + 'whats-new/' });
        const btnUser = makeDockLink({ id: 'smg-nav-user', icon: ICONS.user, label: 'Account', href: boardBase + 'account/' });
        // modo feed · galeria · baixar mídia: MOVIDOS pro header da thread (smg-bar, ver 17-thread-filterbar.js).
        const btnSettings = makeDockButton({ id: 'smg-nav-settings', icon: ICONS.settings, label: 'Settings' });
        const btnFilter = isThread ? makeDockButton({ id: 'smg-post-filter', icon: ICONS.filter, label: 'Filter by author' }) : null;

        // ---- navbar mobile estilo Instagram: profile vira avatar circular + item da página atual fica "ativo" (ícone preenchido) ----
        // (só visível no mobile — no desktop a nav central some e sobra a engrenagem; aqui é inofensivo)
        const navAvatar = document.querySelector('.p-navgroup-link--user .avatar');
        if (navAvatar) {
            const ico = btnUser.querySelector('.smg-nav-ico');
            if (ico) { ico.innerHTML = ''; ico.appendChild(navAvatar.cloneNode(true)); ico.classList.add('smg-nav-ico--avatar'); }
        }
        (function markActiveNav() {
            const path = location.pathname;
            // só MARCA a classe — o "preenchido" é feito via CSS no próprio ícone de contorno (que já renderiza).
            // (trocar innerHTML por um <svg fill> separado falhava no render → o ícone sumia)
            const on = btn => btn.classList.add('smg-nav-active');
            if (/[?&]view=feed/.test(location.search)) on(btnTimeline);   // ANTES do home: o feed mora NA home (?view=feed)
            else if (document.documentElement.classList.contains('smg-home-page') || path === boardBase || path === '/') on(btnHome);
            else if (/\/watched\//.test(path)) on(btnWatched);
            else if (/\/account\/alerts/.test(path)) on(btnAlerts);
            else if (/\/account(\/|$)/.test(path)) on(btnUser);                 // avatar ganha o anel
            else if (/\/whats-new(\/|$)/.test(path)) on(btnDiscover);
        })();

        // ---- montagem (esquerda: navegação · centro: global · direita: ações) ----
        const panel = document.createElement('div');
        panel.id = 'smg-post-nav-panel';

        // navegação principal (+config) — no desktop só sobra a engrenagem; no mobile vira a navbar inferior
        // navbar mobile = 5 itens (espelha a topbar, que tem a Timeline): início · timeline · buscar · notificações · user.
        // Discover e Watched ficam no DOM (escondidos via CSS) → o wireSheet/sheet de opções ainda os alcançam.
        // (a engrenagem fica escondida no mobile e some atrás do FAB de opções; no desktop tudo some e sobra ela)
        const centralBtns = [btnHome, btnTimeline, btnDiscover, btnWatched, btnSearch, btnAlerts, btnUser];   // engrenagem saiu daqui → vai pra ESQUERDA da dock (não fica sozinha no centro)
        const centralGroup = makeGroup(...centralBtns);
        centralGroup.classList.add('smg-nav-center');

        // botão que abre o bottom sheet de opções (só aparece no mobile)
        const btnSheet = makeDockButton({ id: 'smg-dock-sheet-btn', icon: ICONS.sliders, label: 'Options' });

        if (isThread) {
            // desktop: ações (esq.) · navegação principal (centro) · navegação de página (dir.)
            // mobile: navbar central + botão de opções à direita (os lados vão pro sheet)
            const actionsGroup = makeGroup(btnFilter, btnShare, btnSave, btnWatch);   // feed saiu daqui → foi pra central
            actionsGroup.classList.add('smg-side');
            const pagenavGroup = makeGroup(btnSort, btnPagePrev, btnGoto, btnPageNext);
            pagenavGroup.classList.add('smg-side');
            const scrollGroup = makeGroup(btnUp, btnDown);   // scroll topo/fundo num grupo próprio
            scrollGroup.classList.add('smg-side');
            panel.append(
                btnSettings, makeDivider(),   // engrenagem à ESQUERDA
                actionsGroup, makeDivider(),
                centralGroup, makeDivider(),  // nav (navbar no mobile; escondido no desktop)
                pagenavGroup, makeDivider(),  // divider à ESQUERDA do scroll topo/fundo
                scrollGroup,
                btnSheet
            );
        } else if (isList) {
            // listagem (fórum/busca): central · paginação + filtro · opções
            // (o grupo é .smg-side → some da navbar no mobile e vai pro sheet)
            const listBtns = [];
            if (pageJump) listBtns.push(btnPagePrev, btnGoto, btnPageNext);
            if (btnListFilter) listBtns.push(btnListFilter);
            if (btnViewToggle) listBtns.push(btnViewToggle);
            const listGroup = makeGroup(...listBtns);
            listGroup.classList.add('smg-side');
            panel.append(btnSettings, makeDivider(), centralGroup, makeDivider(), listGroup, btnSheet);   // engrenagem à ESQUERDA
        } else {
            // fora de thread: navbar central + botão de opções (geral)
            panel.append(centralGroup, btnSheet);
        }

        const navWrapper = document.createElement('div');
        navWrapper.id = 'smg-post-nav-wrapper';
        // sem ações de thread/lista, no desktop sobraria só a engrenagem → marca p/ esconder a dock
        if (!isThread && !isList) navWrapper.classList.add('smg-dock-baronly');

        // handle pra reabrir quando a dock for ocultada manualmente
        const handle = document.createElement('button');
        handle.id = 'smg-dock-handle';
        handle.type = 'button';
        handle.title = i18n('Show dock');
        handle.innerHTML = ICONS.show;

        // popover do goto (fora do panel pra não ser cortado pelo overflow no mobile)
        const gotoPop = document.createElement('div');
        gotoPop.id = 'smg-goto-pop';
        gotoPop.innerHTML =
            '<span class="smg-goto-title">Go to page</span>' +
            '<div class="smg-goto-stepper">' +
                '<button type="button" class="smg-goto-step" data-dir="-1" aria-label="Decrease">−</button>' +
                '<input type="number" class="smg-goto-input" min="1" value="1">' +
                '<button type="button" class="smg-goto-step" data-dir="1" aria-label="Increase">+</button>' +
            '</div>' +
            '<span class="smg-goto-max"></span>' +
            '<button type="button" class="smg-goto-btn">Go</button>';

        // busca: dialog modal (montado no body, dentro de um overlay com backdrop escuro)
        const searchPop = document.createElement('div');
        searchPop.id = 'smg-search-pop';
        searchPop.innerHTML =
            '<div class="smg-search-bar">' +
                '<span class="smg-search-lupa">' + ICONS.search + '</span>' +
                '<button type="button" class="smg-search-chip" hidden><span class="smg-search-chip-t"></span><span class="smg-search-chip-x" aria-label="' + i18n('Clear') + '">' + ICONS.close + '</span></button>' +
                '<input type="text" class="smg-search-input" placeholder="Search the forum…" enterkeyhint="search" autocapitalize="off" autocomplete="off" spellcheck="false">' +
                '<button type="button" class="smg-search-cmdbtn" aria-label="' + i18n('Commands (Tab)') + '" title="' + i18n('Commands (Tab)') + '">⇥</button>' +
                '<a class="smg-search-adv" target="_blank" rel="noopener" aria-label="' + i18n('Advanced') + '">' + ICONS.filter + '</a>' +
                '<button type="button" class="smg-search-cfg" aria-label="' + i18n('Search defaults') + '">' + ICONS.sliders + '</button>' +
                '<span class="smg-search-kbd" title="Press Esc to close">esc</span>' +
                '<button type="button" class="smg-search-close" aria-label="Close">' + ICONS.close + '</button>' +
            '</div>' +
            // filtros vêm de COMANDOS na barra (by:/sort:/posts:/title:). `by` fica oculto (ref interna p/ c[users]).
            '<input type="text" class="smg-search-by" hidden>' +
            '<div class="smg-search-results" hidden></div>' +
            '<div class="smg-search-history" hidden>' +
                '<div class="smg-search-hist-head">' +
                    '<span class="smg-search-hist-title">Recent searches</span>' +
                    '<span class="smg-search-hist-badge"></span>' +
                    '<button type="button" class="smg-search-hist-toggle">Show all</button>' +
                    '<button type="button" class="smg-search-hist-clear">Clear</button>' +
                '</div>' +
                '<div class="smg-search-hist-list"></div>' +
            '</div>' +
            '<div class="smg-search-empty" hidden>' +
                '<span class="smg-search-empty-ic">' + ICONS.search + '</span>' +
                '<span class="smg-search-empty-t">Search the forum</span>' +
                '<span class="smg-search-empty-s">Type at least 3 characters to see results</span>' +
                '<span class="smg-search-empty-hint"><span class="smg-search-tabkey">⇥ Tab</span><code>!t</code><code>!i</code><code>!a</code><code>!sn</code></span>' +
            '</div>' +
            '<div class="smg-search-foot">' +
                '<span class="smg-search-hint">Enter to search</span>' +
                '<button type="button" class="smg-search-go"><span class="smg-search-go-ic">' + ICONS.search + '</span>Search</button>' +
            '</div>';

        // backdrop (portal escuro) + dialog, fora da dock (o transform da dock no desktop quebraria o position:fixed)
        const searchOverlay = document.createElement('div');
        searchOverlay.id = 'smg-search-overlay';
        searchOverlay.appendChild(searchPop);
        document.body.appendChild(searchOverlay);
        i18nDom(searchOverlay);

        // popover de configurações (engrenagem) — toggles persistidos via GM_setValue
        const settingsPop = document.createElement('div');
        settingsPop.id = 'smg-settings-pop';
        // ícone por categoria (rail à esquerda) + sliders dos tunables do feed (gmGet/gmSet)
        const SET_ICONS = { 'Appearance': ICONS.sliders, 'Images': ICONS.typeImage, 'Videos': ICONS.typeVideo, 'Links & files': ICONS.link, 'Thread & reading': ICONS.list, 'Feed': ICONS.feed };
        const SET_TUNABLES = [
            { key: 'smg-feed-window-days', label: i18n('Search window (days)'), min: 3, max: 30, def: 14 },
            { key: 'smg-feed-retention-days', label: i18n('Keep posts for (days)'), min: 7, max: 90, def: 30 },
            { key: 'smg-feed-cold-threads', label: i18n('Threads on first load'), min: 40, max: 300, step: 10, def: 120 },
            { key: 'smg-feed-deep-ttl', label: i18n('Deep re-scan every (h)'), min: 1, max: 48, def: 6 },
        ];
        const qAttr = s => (s || '').toLowerCase().replace(/["<>]/g, '');
        const setToggleRow = it =>
            '<label class="smg-set-row" data-q="' + qAttr(it.label + ' ' + ((it.desc && (IS_PT ? it.desc.pt : it.desc.en)) || '')) + '">' +
                '<span class="smg-set-text">' +
                    '<span class="smg-set-label">' + it.label + '</span>' +
                    (it.desc ? '<span class="smg-set-desc">' + (IS_PT ? it.desc.pt : it.desc.en) + '</span>' : '') +
                '</span>' +
                '<input type="checkbox" data-feat="' + it.key + '"' + (FEATURES[it.key] ? ' checked' : '') + '>' +
                '<span class="smg-switch"></span>' +
            '</label>';
        const setSliderRow = it => {
            const v = parseInt(gmGet(it.key, ''), 10) || it.def;
            return '<div class="smg-set-slider" data-q="' + qAttr(it.label) + '">' +
                '<div class="smg-set-slidertop"><span class="smg-set-label">' + it.label + '</span><span class="smg-set-val">' + v + '</span></div>' +
                '<input type="range" data-tune="' + it.key + '" min="' + it.min + '" max="' + it.max + '" step="' + (it.step || 1) + '" value="' + v + '">' +
            '</div>';
        };
        const SET_SECTIONS = SETTINGS_META.concat([{ section: 'Feed', sliders: SET_TUNABLES }]);
        const setRail = SET_SECTIONS.map((s, i) => '<button type="button" class="smg-set-tab' + (i === 0 ? ' active' : '') + '" data-i="' + i + '" title="' + s.section + '" aria-label="' + s.section + '">' + (SET_ICONS[s.section] || ICONS.settings) + '</button>').join('');
        const setContent = SET_SECTIONS.map((s, i) =>
            '<div class="smg-set-sec" data-i="' + i + '"' + (i === 0 ? '' : ' hidden') + '>' +
                '<div class="smg-set-sectitle">' + s.section + '</div>' +
                (s.items ? s.items.map(setToggleRow).join('') : '') +
                (s.sliders ? s.sliders.map(setSliderRow).join('') : '') +
            '</div>').join('');
        settingsPop.innerHTML =
            '<div class="smg-set-head"><span class="smg-set-logo">' + ICONS.settings + '</span><b class="smg-set-title">' + i18n('Settings') + '</b><button type="button" class="smg-set-x" aria-label="' + i18n('Close') + '">' + ICONS.close + '</button></div>' +
            '<div class="smg-set-search"><span class="smg-set-searchic">' + ICONS.search + '</span><input type="text" class="smg-set-q" placeholder="' + i18n('Search setting…') + '" spellcheck="false" autocomplete="off"></div>' +
            '<div class="smg-set-body">' +
                '<div class="smg-set-rail">' + setRail + '</div>' +
                '<div class="smg-set-content">' + setContent + '<div class="smg-set-empty" hidden>' + i18n('No settings found') + '</div></div>' +
            '</div>' +
            '<div class="smg-set-foot">' +
                '<button type="button" class="smg-set-reset">' + i18n('Restore defaults') + '</button>' +
                '<button type="button" class="smg-set-reload">' + i18n('Reload') + '</button>' +
                '<span class="smg-set-ver"></span>' +
            '</div>';

        // popover de filtro por autor (só em thread)
        const filterPop = isThread ? document.createElement('div') : null;
        if (filterPop) {
            filterPop.id = 'smg-filter-pop';
            filterPop.innerHTML =
                '<span class="smg-pop-title">Filter posts by author</span>' +
                '<div class="smg-filter-quick"></div>' +
                '<div class="smg-filter-row">' +
                    '<input type="text" class="smg-filter-input" placeholder="Username…">' +
                    '<button type="button" class="smg-filter-apply">Filter</button>' +
                '</div>' +
                '<button type="button" class="smg-filter-clear">Show all</button>';
        }

        // popover do filtro da listagem (fórum) — conteúdo carregado sob demanda
        const listFilterPop = (isList && btnListFilter) ? document.createElement('div') : null;
        if (listFilterPop) {
            listFilterPop.id = 'smg-listfilter-pop';
            listFilterPop.innerHTML = '<span class="smg-pop-title">Filter</span><div class="smg-lf-body">Loading…</div>';
        }

        // backdrop dos popovers do dock (settings/filtro) — vira o scrim do bottom sheet no mobile.
        // clicar nele fecha via o handler de clique-fora (não está dentro de nenhum pop/botão).
        const dockBackdrop = document.createElement('div');
        dockBackdrop.className = 'smg-dock-backdrop';
        navWrapper.append(panel, handle, gotoPop, settingsPop, dockBackdrop);
        if (filterPop) navWrapper.append(filterPop);
        if (listFilterPop) navWrapper.append(listFilterPop);
        document.body.appendChild(navWrapper);
        i18nDom(navWrapper);

        // ---- estado da dock (só ocultar manual; sem auto-hide no scroll) ----

        const DOCK_HIDDEN_KEY = 'smg-dock-hidden';
        let manualHidden = localStorage.getItem(DOCK_HIDDEN_KEY) === '1';

        function applyManualHidden() {
            navWrapper.classList.toggle('manual-hidden', manualHidden);
        }

        // ocultar agora vem de dentro das Settings
        function hideDock() {
            manualHidden = true;
            localStorage.setItem(DOCK_HIDDEN_KEY, '1');
            applyManualHidden();
        }

        handle.addEventListener('click', () => {
            manualHidden = false;
            localStorage.setItem(DOCK_HIDDEN_KEY, '0');
            applyManualHidden();
        });

        applyManualHidden();

        // ---- bottom sheet de opções (mobile): o botão à direita abre tudo aqui ----
        const setupOptionsSheet = () => {
            const sheet = document.createElement('div');
            sheet.id = 'smg-sheet';
            sheet.innerHTML =
                '<div class="smg-sheet-panel">' +
                    '<div class="smg-sheet-grip"></div>' +
                    '<div class="smg-sheet-body"></div>' +
                '</div>';
            document.body.appendChild(sheet);

            const sheetPanel = sheet.querySelector('.smg-sheet-panel');
            const sheetBody = sheet.querySelector('.smg-sheet-body');

            const closeSheet = () => sheet.classList.remove('open');

            const sheetItem = (iconHtml, label, onClick, disabled) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'smg-sheet-item' + (disabled ? ' smg-sheet-disabled' : '');
                const ico = document.createElement('span'); ico.className = 'smg-sheet-ico'; ico.innerHTML = iconHtml;   // iconHtml = SVG controlado pelo script
                const lbl = document.createElement('span'); lbl.className = 'smg-sheet-lbl'; lbl.textContent = label;   // label pode ser username (filtro por autor) → textContent, NUNCA innerHTML
                b.append(ico, lbl);
                // stopPropagation: senão o clique borbulha até o handler de "fora" e fecha
                // o popover que acabamos de abrir (config/goto/filtro)
                b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
                return b;
            };
            // lê ícone+label+ESTADO atuais do botão da dock e delega o clique (mantém estado sincronizado)
            const fromBtn = btn => {
                const item = sheetItem(
                    btn.querySelector('.smg-nav-ico')?.innerHTML || '',
                    btn.dataset.label || '',
                    () => { if (btn.disabled) return; closeSheet(); btn.click(); },
                    btn.disabled
                );
                // espelha o estado ativo (watch seguindo, filtro aplicado, etc.) — lido a cada abertura do sheet
                if (btn.classList.contains('smg-active')) item.classList.add('smg-active');
                return item;
            };

            function rebuildSheet() {
                sheetBody.innerHTML = '';

                const addSection = (title, items) => {
                    items = items.filter(Boolean);
                    if (!items.length) return;
                    const h = document.createElement('div');
                    h.className = 'smg-sheet-title';
                    h.textContent = title;
                    const grid = document.createElement('div');
                    grid.className = 'smg-sheet-grid';
                    items.forEach(it => grid.appendChild(it));
                    sheetBody.append(h, grid);
                };

                // General no TOPO
                addSection('General', [
                    fromBtn(btnSettings),
                    sheetItem(ICONS.hide, 'Hide dock', () => { closeSheet(); hideDock(); }),
                ]);
                // Discover/Watched saíram da navbar (5 itens) → continuam alcançáveis por aqui
                // (fromBtn delega o click: Discover abre o sheet do wireSheet; Watched navega pelo href)
                addSection('Explore', [fromBtn(btnDiscover), fromBtn(btnWatched)]);
                if (isThread) {
                    addSection('Post', [btnShare, btnSave, btnWatch, btnFilter].map(b => b && fromBtn(b)));
                    // Sort by date entra DEPOIS de Next page
                    addSection('Navigation', [btnUp, btnDown, btnPagePrev, btnGoto, btnPageNext, btnSort].map(b => b && fromBtn(b)));
                } else if (isList) {
                    const listItems = [];
                    if (pageJump) listItems.push(btnPagePrev, btnGoto, btnPageNext);
                    if (btnListFilter) listItems.push(btnListFilter);
                    if (btnViewToggle) listItems.push(btnViewToggle);
                    addSection('Page', listItems.map(b => b && fromBtn(b)));
                }
                i18nDom(sheetBody);
            }

            btnSheet.addEventListener('click', () => { rebuildSheet(); sheet.classList.add('open'); });
            sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); }); // toca no fundo fecha

            // arrastar o sheet pra baixo fecha (só quando já está no topo do scroll)
            let shY = 0, shDy = 0, shDrag = false;
            sheetPanel.addEventListener('touchstart', e => {
                if (e.touches.length !== 1) { shDrag = false; return; }
                shDrag = sheetPanel.scrollTop <= 0;
                shY = e.touches[0].clientY;
                shDy = 0;
                sheetPanel.style.transition = 'none';
            }, { passive: true });
            sheetPanel.addEventListener('touchmove', e => {
                if (!shDrag) return;
                shDy = e.touches[0].clientY - shY;
                if (shDy > 0) sheetPanel.style.transform = 'translateY(' + shDy + 'px)';
            }, { passive: true });
            sheetPanel.addEventListener('touchend', () => {
                if (!shDrag) return;
                shDrag = false;
                sheetPanel.style.transition = '';
                sheetPanel.style.transform = '';
                if (shDy > 90) closeSheet();
            });
        };
        setupOptionsSheet();

        // ---- goto: popover pra pular pra uma página ----
        const gotoInput = gotoPop.querySelector('.smg-goto-input');
        const gotoMax = gotoPop.querySelector('.smg-goto-max');
        const gotoGoBtn = gotoPop.querySelector('.smg-goto-btn');

        function clampPage(n) {
            if (!n || n < 1) n = 1;
            if (pageJump && pageJump.max && n > pageJump.max) n = pageJump.max;
            return n;
        }

        function closePopovers() {
            navWrapper.classList.remove('goto-open', 'settings-open', 'filter-open', 'listfilter-open', 'smg-dock-show');
            searchOverlay.classList.remove('open');
        }
        // arrastar pra baixo fecha os sheets/modais mobile (settings · filtro têm grip = bottom sheet; goto é popover pequeno → fora)
        const isMobileSheet = () => window.innerWidth <= 600;
        addSwipeClose(settingsPop, closePopovers, () => isMobileSheet() && navWrapper.classList.contains('settings-open'));
        if (filterPop) addSwipeClose(filterPop, closePopovers, () => isMobileSheet() && navWrapper.classList.contains('filter-open'));

        function openGoto() {
            if (!pageJump) return;
            closePopovers();
            gotoInput.max = pageJump.max || '';
            gotoInput.value = pageJump.current;
            gotoMax.textContent = pageJump.max ? 'of ' + pageJump.max + ' pages' : '';
            navWrapper.classList.add('goto-open');
            setTimeout(() => { gotoInput.focus(); gotoInput.select(); }, 0);
        }

        function doGoto() {
            if (!pageJump) return;
            window.location.href = pageJump.tpl.replace('%page%', clampPage(parseInt(gotoInput.value, 10)));
        }

        btnGoto.addEventListener('click', e => {
            e.stopPropagation();
            if (navWrapper.classList.contains('goto-open')) closePopovers();
            else openGoto();
        });

        // botões − / + (sempre visíveis)
        gotoPop.querySelectorAll('.smg-goto-step').forEach(b => {
            b.addEventListener('click', () => {
                gotoInput.value = clampPage((parseInt(gotoInput.value, 10) || 1) + parseInt(b.dataset.dir, 10));
            });
        });

        gotoInput.addEventListener('change', () => {
            gotoInput.value = clampPage(parseInt(gotoInput.value, 10));
        });

        gotoGoBtn.addEventListener('click', doGoto);

        gotoInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); doGoto(); }
            else if (e.key === 'Escape') closePopovers();
        });

        // ---- search: popover de busca (XenForo /search/search) ----
        const setupSearch = () => {
            const threadId = (location.pathname.match(/threads\/[^/]+\.(\d+)/) || [])[1] || '';
            // node id do fórum pai: último link /forums/slug.ID/ do breadcrumb
            const forumId = (() => {
                let id = '';
                document.querySelectorAll('.p-breadcrumbs a[href*="/forums/"], .breadcrumbs a[href*="/forums/"]').forEach(a => {
                    const m = (a.getAttribute('href') || '').match(/\/forums\/[^/]+\.(\d+)/);
                    if (m) id = m[1];
                });
                return id;
            })();

            const searchInput = searchPop.querySelector('.smg-search-input');
            // input ATIVO: desktop usa o input REAL da topbar (dropdown); mobile usa o input do próprio modal.
            const getSearchInput = () => (window.innerWidth > 600 && document.querySelector('.smg-tb-search-input')) || searchInput;
            const searchResultsEl = searchPop.querySelector('.smg-search-results');
            const searchBy = searchPop.querySelector('.smg-search-by');   // oculto — preenchido pelo comando by:
            const searchAdv = searchPop.querySelector('.smg-search-adv');
            const searchHistEl = searchPop.querySelector('.smg-search-history');
            const searchHistList = searchPop.querySelector('.smg-search-hist-list');
            const searchHistToggle = searchPop.querySelector('.smg-search-hist-toggle');
            const searchHistClear = searchPop.querySelector('.smg-search-hist-clear');
            const searchHistBadge = searchPop.querySelector('.smg-search-hist-badge');
            const searchEmptyEl = searchPop.querySelector('.smg-search-empty');

            // action + token do quick-search da própria página (robusto a subdiretório)
            const qsForm = document.querySelector('form[data-xf-init="quick-search"]');
            const searchAction = qsForm?.getAttribute('action') || '/search/search';
            if (searchAdv) searchAdv.href = searchAction.replace(/search\/?$/, ''); // /search/search -> /search/

            let applyingEntry = false;   // true durante fillFromEntry → segura o re-search por filtro

            // ===== ESCOPO estilo Reddit: começa no CONTEXTO (tópico/fórum atual); chip com × na barra → "em tudo" =====
            // título da página SEM o que injetamos/o XF cola dentro do h1 (botão de notices, prefixos/labels)
            const pageTitle = (() => {
                const el = document.querySelector('h1.p-title-value, .p-title-value'); if (!el) return '';
                const c = el.cloneNode(true);
                c.querySelectorAll('.smg-notices, .label, .labelLink, [class*="label--"], .prefix, [class*="prefix"]').forEach(x => x.remove());
                return (c.textContent || '').replace(/\s+/g, ' ').trim();
            })();
            const ctxLabel = threadId
                ? pageTitle
                : forumId
                    ? (() => { let n = ''; document.querySelectorAll('.p-breadcrumbs a[href*="/forums/"], .breadcrumbs a[href*="/forums/"]').forEach(a => { const t = a.textContent.trim(); if (t) n = t; }); return n || pageTitle; })()
                    : '';
            let currentScope = threadId ? 'thread' : (forumId && ctxLabel ? 'forum' : 'everywhere');
            let titlesOn = true, orderDate = false;   // (re)setados pelos comandos a cada busca

            function applyScopeUI() {
                const isThread = currentScope === 'thread';
                const scoped = isThread || (currentScope === 'forum' && !!ctxLabel);   // tópico vale pelo threadId (mesmo sem título); fórum precisa do nome
                document.documentElement.classList.toggle('smg-search-scoped', scoped);
                const chipText = isThread ? i18n('This thread') : ctxLabel;   // TÓPICO: rótulo curto fixo (nomes de tópico podem ser enormes); FÓRUM: nome
                const kind = isThread ? '' : i18n('Forum');                   // tópico não precisa de tag — o rótulo já diz
                Array.prototype.forEach.call(document.querySelectorAll('.smg-tb-search-chip, .smg-search-chip'), ch => {
                    ch.hidden = !scoped;
                    const t = ch.querySelector('.smg-search-chip-t'); if (t) t.textContent = chipText;
                    let k = ch.querySelector('.smg-search-chip-k');
                    if (scoped && kind) { if (!k) { k = document.createElement('span'); k.className = 'smg-search-chip-k'; ch.insertBefore(k, t); } k.textContent = kind; }
                    else if (k) k.remove();
                });
                const ph = isThread ? i18n('Search in this thread') : (scoped ? (i18n('Search in') + ' ' + ctxLabel) : i18n('Search the forum…'));
                if (searchInput) searchInput.placeholder = ph;
                const tb = document.querySelector('.smg-tb-search-input'); if (tb) tb.placeholder = ph;
            }
            function unscope() { currentScope = 'everywhere'; applyScopeUI(); researchOnFilter(); try { getSearchInput().focus(); } catch (e) {} }
            // × do chip (delegado → cobre o chip da topbar E o do modal)
            document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.smg-search-chip-x')) { e.preventDefault(); e.stopPropagation(); unscope(); } });
            applyScopeUI();

            // defaults configuráveis (engrenagem da barra) — DECLARADOS AQUI (antes do bloco que os usa no setup); comando explícito sempre vence
            const CFG_TITLES = 'smg-search-def-titles', CFG_ORDER = 'smg-search-def-order', CFG_LIKE = 'smg-search-like';
            let cfgTitles = localStorage.getItem(CFG_TITLES) === '1';                 // só-títulos por padrão (busca global/fórum)
            let cfgOrder = localStorage.getItem(CFG_ORDER) === '1';                   // por data por padrão
            let cfgLike = (localStorage.getItem(CFG_LIKE) ?? '1') === '1';            // wildcard de parte da palavra

            // BUSCA AVANÇADA (na barra): com query → abre os RESULTADOS NATIVOS numa nova aba (POST, igual o inline → garantido),
            // já com o escopo/filtros atuais; a página de resultados tem o painel pra refinar. Sem query → o form de busca avançada.
            const advUrl = searchAction.replace(/search\/?$/, '');   // /search/search → /search/
            Array.prototype.forEach.call(document.querySelectorAll('.smg-search-adv'), a => { a.href = advUrl; a.title = i18n('Advanced'); });   // href base (ctrl/middle-click)
            function openAdvanced() {
                const p = parseCommands(getSearchInput().value);
                if (!p.keywords && !p.by) { window.open(advUrl, '_blank', 'noopener'); return; }   // sem query → form avançado
                const token = qsForm?.querySelector('input[name="_xfToken"]')?.value || document.querySelector('input[name="_xfToken"]')?.value || '';
                const fields = [['keywords', likeify(p.keywords)], ['_xfToken', token]];
                if (currentScope === 'thread' && threadId) fields.push(['c[thread]', threadId], ['search_type', 'post']);   // search_type=post é OBRIGATÓRIO p/ restringir À thread (senão o XF busca threads no global e ignora c[thread])
                else if (currentScope === 'forum' && forumId) fields.push(['c[nodes][0]', forumId], ['c[child_nodes]', '1']);
                const titles = (p.titles != null) ? p.titles : (currentScope !== 'thread' && cfgTitles);
                if (titles && currentScope !== 'thread') fields.push(['c[title_only]', '1']);
                if (p.by) fields.push(['c[users]', p.by]);
                const order = p.order ? (p.order === 'date') : cfgOrder;
                if (order) fields.push(['order', 'date']);
                const f = document.createElement('form'); f.method = 'post'; f.action = searchAction; f.target = '_blank'; f.style.display = 'none';
                fields.forEach(kv => { const i = document.createElement('input'); i.type = 'hidden'; i.name = kv[0]; i.value = kv[1]; f.appendChild(i); });
                document.body.appendChild(f); f.submit(); setTimeout(() => f.remove(), 0);
            }
            document.addEventListener('click', e => { const adv = e.target.closest && e.target.closest('.smg-search-adv'); if (adv) { e.preventDefault(); openAdvanced(); } });

            // CONFIG de defaults da busca (engrenagem na barra) — portalizada no body, igual o tooltip
            const cfgPortal = document.createElement('div'); cfgPortal.className = 'smg-search-cfg-portal';
            const cfgRow = (key, label, on) => '<label class="smg-search-cfg-row"><input type="checkbox" data-cfg="' + key + '"' + (on ? ' checked' : '') + '><span>' + label + '</span></label>';
            cfgPortal.innerHTML = '<div class="smg-search-cfg-head">' + i18n('Search defaults') + '</div>' +
                cfgRow(CFG_TITLES, i18n('Titles only by default'), cfgTitles) +
                cfgRow(CFG_ORDER, i18n('Newest first by default'), cfgOrder) +
                cfgRow(CFG_LIKE, i18n('Match partial words'), cfgLike);
            document.body.appendChild(cfgPortal);
            cfgPortal.addEventListener('change', e => {
                const k = e.target.getAttribute && e.target.getAttribute('data-cfg'); if (!k) return;
                const on = !!e.target.checked; localStorage.setItem(k, on ? '1' : '0');
                if (k === CFG_TITLES) cfgTitles = on; else if (k === CFG_ORDER) cfgOrder = on; else if (k === CFG_LIKE) cfgLike = on;
                researchOnFilter();   // re-busca com o novo default (se já tem query)
            });
            function closeCfg() { cfgPortal.classList.remove('open'); document.querySelectorAll('.smg-search-cfg').forEach(b => b.classList.remove('open')); }
            document.addEventListener('click', e => {
                const g = e.target.closest && e.target.closest('.smg-search-cfg');
                if (g) {
                    e.preventDefault(); e.stopPropagation();
                    const willOpen = !cfgPortal.classList.contains('open');
                    closeCfg();
                    if (willOpen) { const r = g.getBoundingClientRect(); cfgPortal.classList.add('open'); g.classList.add('open'); const w = cfgPortal.offsetWidth || 240; let left = r.right - w; if (left < 8) left = 8; cfgPortal.style.left = left + 'px'; cfgPortal.style.top = (r.bottom + 8) + 'px'; }
                    return;
                }
                if (!e.target.closest('.smg-search-cfg-portal')) closeCfg();
            });

            // TECLADO: Backspace no input VAZIO remove o chip de contexto ("Neste tópico") → vira "em tudo"
            document.addEventListener('keydown', e => {
                if (e.key !== 'Backspace') return;
                const inp = e.target; if (!inp.matches || !inp.matches('.smg-tb-search-input, .smg-search-input')) return;
                if (currentScope !== 'everywhere' && inp.value === '' && (inp.selectionStart || 0) === 0) { e.preventDefault(); unscope(); }
            });

            // MENU DE COMANDOS (Tab): paleta pra escolher !a/!sn/!st/!t/!i com teclado ou clique — descobrível sem decorar
            const CMD_ITEMS = [
                { code: '!t', ins: '!t ', label: i18n('titles only') },
                { code: '!i', ins: '!i ', label: i18n('search post text') },
                { code: '!a', ins: '!a ', label: i18n('author') },
                { code: '!sn', ins: '!sn ', label: i18n('by date') },
                { code: '!st', ins: '!st ', label: i18n('Relevance') },
            ];
            const cmdMenu = document.createElement('div'); cmdMenu.className = 'smg-search-cmd';
            cmdMenu.innerHTML = '<div class="smg-search-cmd-head">' + i18n('Search commands') + '</div>' +
                CMD_ITEMS.map((c, i) => '<button type="button" class="smg-search-cmd-item" data-i="' + i + '"><code>' + c.code + '</code><span>' + c.label + '</span></button>').join('');
            document.body.appendChild(cmdMenu);
            let cmdSel = -1;
            function cmdOpen() {
                const bar = (window.innerWidth > 600 && document.querySelector('.smg-tb-search')) || searchPop.querySelector('.smg-search-bar'); if (!bar) return;
                const r = bar.getBoundingClientRect();
                cmdMenu.classList.add('open');
                cmdMenu.style.left = Math.max(8, r.left) + 'px';
                cmdMenu.style.top = (r.bottom + 8) + 'px';
                cmdMenu.style.minWidth = Math.min(340, Math.max(240, r.width)) + 'px';
                cmdSetSel(0);
            }
            function cmdClose() { cmdMenu.classList.remove('open'); cmdSel = -1; }
            function cmdSetSel(i) {
                const items = cmdMenu.querySelectorAll('.smg-search-cmd-item'); if (!items.length) return;
                cmdSel = (i + items.length) % items.length;
                items.forEach((el, j) => el.classList.toggle('sel', j === cmdSel));
            }
            function cmdInsert(i) {
                const c = CMD_ITEMS[i]; if (!c) return;
                const inp = getSearchInput(); const v = inp.value.replace(/\s+$/, '');
                inp.value = (v ? v + ' ' : '') + c.ins;
                cmdClose(); inp.focus();
                try { const L = inp.value.length; inp.setSelectionRange(L, L); } catch (e) {}
                inp.dispatchEvent(new Event('input', { bubbles: true }));   // re-avalia (flags re-buscam; !a espera o nome)
            }
            cmdMenu.addEventListener('mousedown', e => { const it = e.target.closest && e.target.closest('.smg-search-cmd-item'); if (it) { e.preventDefault(); cmdInsert(+it.dataset.i); } });
            // CAPTURE: roda ANTES dos handlers de Enter→buscar; com o menu aberto, intercepta a navegação/seleção
            document.addEventListener('keydown', e => {
                if (!e.target.matches || !e.target.matches('.smg-tb-search-input, .smg-search-input')) return;
                const open = cmdMenu.classList.contains('open');
                if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); if (!open) cmdOpen(); else cmdSetSel(cmdSel + (e.shiftKey ? -1 : 1)); return; }
                if (!open) return;
                if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); cmdSetSel(cmdSel + 1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); cmdSetSel(cmdSel - 1); }
                else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); cmdInsert(cmdSel); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cmdClose(); }
                else cmdClose();   // qualquer outra tecla → fecha e segue digitando
            }, true);
            document.addEventListener('mousedown', e => { if (cmdMenu.classList.contains('open') && !(e.target.closest && (e.target.closest('.smg-search-cmd') || e.target.closest('.smg-tb-search-input, .smg-search-input')))) cmdClose(); });
            // botão ⇥ (indica que o Tab existe + abre a paleta no clique → também serve no mobile, que não tem Tab)
            document.addEventListener('click', e => {
                const b = e.target.closest && e.target.closest('.smg-search-cmdbtn'); if (!b) return;
                e.preventDefault(); e.stopPropagation();
                if (cmdMenu.classList.contains('open')) cmdClose(); else { cmdOpen(); try { getSearchInput().focus(); } catch (x) {} }
            });

            // ===== COMANDOS na barra: by:/from: (autor) · sort:new|top (data|relevância) · posts:/body: (corpo) · title: (só título) =====
            // devolve { keywords, by, order(bool=data), titles(null=auto | true | false) } e tira os comandos do texto buscado.
            // comandos com prefixo "!": !a <user> (autor) · !sn (data) · !st (relevância) · !t (só títulos) · !i (inclui o corpo).
            // \b evita falso-positivo (ex.: "!important" fica na busca). order: null=padrão | 'date' | 'rel'; titles: null=padrão | true | false.
            function parseCommands(raw) {
                let by = '', order = null, titles = null;
                const kw = (raw || '')
                    .replace(/(?:^|\s)!a\b\s+("[^"]+"|\S+)/gi, (m, v) => { by = v.replace(/^"|"$/g, ''); return ' '; })
                    .replace(/(?:^|\s)!sn\b/gi, () => { order = 'date'; return ' '; })
                    .replace(/(?:^|\s)!st\b/gi, () => { order = 'rel'; return ' '; })
                    .replace(/(?:^|\s)!t\b/gi, () => { titles = true; return ' '; })
                    .replace(/(?:^|\s)!i\b/gi, () => { titles = false; return ' '; })
                    .replace(/\s+/g, ' ').trim();
                return { keywords: kw, by: by, order: order, titles: titles };
            }
            // aplica o parse no estado. DEFAULT (sem comando) vem da config; `title:`/`posts:`/`sort:` sobrescrevem.
            function applyParsed(p) {
                if (searchBy) searchBy.value = p.by || '';
                orderDate = p.order ? (p.order === 'date') : cfgOrder;
                titlesOn = (p.titles != null) ? p.titles : (currentScope !== 'thread' && cfgTitles);   // em tópico nunca é só-título
            }
            // %LIKE%: a busca (MySQL fulltext) não acha por parte da palavra → wildcard de PREFIXO (termo* = LIKE 'termo%').
            // Infix real (%termo%) o fulltext não suporta; respeita aspas/operadores (+ - " *) do usuário. Liga/desliga na config.
            function likeify(q) {
                if (!cfgLike || !q || /[*"+\-]/.test(q)) return q;
                return q.split(/\s+/).map(w => (w.length >= 3 && /^[\wÀ-ſ]+$/.test(w)) ? w + '*' : w).join(' ');
            }

            // ---- histórico (últimos 1000, COMPARTILHADO entre os fóruns via GM storage) ----
            const SEARCH_HISTORY_KEY = 'smg-search-history';
            const HIST_CHUNK = 30;   // linhas por lote: expandido renderiza incremental no scroll (nunca monta as 1000 de uma vez)
            const HIST_MAX = 1000;
            const SCOPE_LABEL = { everywhere: 'Everywhere', threads: 'Threads', forum: 'This forum', thread: 'This thread' };
            let histExpanded = false;
            let histShown = 0;       // linhas já renderizadas na lista (índice do próximo lote)

            // gmGet/gmSet usam GM_*Value (mesmo storage do script em todos os domínios), com fallback localStorage
            // PERF: parse 1× por sessão (cache) — o JSON.parse de até 1000 entradas (~100KB) rodava a CADA
            // keystroke <3 chars (clearResults→renderHistory). Outra aba gravar não invalida o cache: staleness
            // aceitável (resolve no F5); esta aba sempre escreve via saveHistory, que atualiza o cache.
            let histCache = null;
            const loadHistory = () => { if (histCache) return histCache; try { histCache = JSON.parse(gmGet(SEARCH_HISTORY_KEY, '[]')) || []; } catch { histCache = []; } return histCache; };
            const saveHistory = arr => { histCache = arr; gmSet(SEARCH_HISTORY_KEY, JSON.stringify(arr)); };

            const histKey = e => (e.q || '') + '|' + (e.by || '') + '|' + (e.scope || '') + '|' + (e.titles ? 1 : 0) + '|' + (e.order || '');

            function addHistory(entry) {
                if (!entry.q && !entry.by) return;
                const k = histKey(entry);
                const arr = loadHistory().filter(e => histKey(e) !== k); // dedupe: move pro topo
                arr.unshift(entry);
                saveHistory(arr.slice(0, HIST_MAX));
            }

            function removeHistory(entry) {   // só persiste — a linha sai do DOM no handler do × (sem re-render → scroll preservado)
                const k = histKey(entry);
                saveHistory(loadHistory().filter(e => histKey(e) !== k));
            }

            // reconstrói o TEXTO da barra (keywords + comandos) a partir de uma entrada do histórico
            function entryToBar(e) {
                let s = e.q || '';
                if (e.by) s += ' !a ' + (/\s/.test(e.by) ? '"' + e.by + '"' : e.by);
                if (e.order === 'date') s += ' !sn';
                if (e.titles) s += ' !t';   // default é tudo → só recompõe o comando quando era só-títulos
                return s.trim();
            }
            function fillFromEntry(e) {
                applyingEntry = true;
                getSearchInput().value = entryToBar(e);
                currentScope = ((e.scope === 'thread' && threadId) || (e.scope === 'forum' && forumId)) ? e.scope : 'everywhere';   // só reusa o escopo se existe NESTA página
                applyScopeUI();
                applyingEntry = false;
            }
            function applyHistoryEntry(e) { fillFromEntry(e); doSearch(true); }            // clique na linha: busca direto (grava)
            function sendToBar(e) { fillFromEntry(e); getSearchInput().focus(); }       // ↖ manda pra barra SEM buscar (ajusta filtros e busca depois)
            function openOnOther(e) {                                                   // ↗ abre a MESMA busca no OUTRO fórum (simpcity ↔ smg)
                const other = /socialmediagirls/i.test(location.hostname) ? 'https://simpcity.cr/' : 'https://forums.socialmediagirls.com/';
                const payload = { q: e.q || '', by: e.by || '', titles: !!e.titles, threads: e.scope === 'threads', order: e.order || '' };
                window.open(other + '#smg-xsearch=' + encodeURIComponent(JSON.stringify(payload)), '_blank', 'noopener');
            }

            function buildHistRow(e) {
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'smg-search-hist-item';
                const tags = [];
                if (e.scope && e.scope !== 'everywhere') tags.push(i18n(SCOPE_LABEL[e.scope] || e.scope));
                if (e.q && e.by) tags.push(i18n('author') + ': ' + e.by);
                if (e.titles) tags.push(i18n('titles only'));
                if (e.order === 'date') tags.push(i18n('by date'));
                const otherLabel = /socialmediagirls/i.test(location.hostname) ? 'SimpCity' : 'SocialMediaGirls';
                row.innerHTML =
                    '<span class="smg-search-hist-ico">' + ICONS.search + '</span>' +
                    '<span class="smg-search-hist-q"></span>' +
                    (tags.length ? '<span class="smg-search-hist-meta"></span>' : '') +
                    '<span class="smg-search-hist-acts">' +
                        '<span class="smg-search-hist-act smg-search-hist-edit" role="button" aria-label="' + i18n('Edit in search bar') + '" title="' + i18n('Edit in search bar') + '">' + svgIcon('<line x1="17" y1="17" x2="7" y2="7"/><polyline points="7 17 7 7 17 7"/>') + '</span>' +
                        '<span class="smg-search-hist-act smg-search-hist-cross" role="button" aria-label="' + i18n('Search on') + ' ' + otherLabel + '" title="' + i18n('Search on') + ' ' + otherLabel + '">' + svgIcon('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>') + '</span>' +
                        '<span class="smg-search-hist-act smg-search-hist-remove" role="button" aria-label="' + i18n('Remove') + '">' + ICONS.close + '</span>' +
                    '</span>';
                row.querySelector('.smg-search-hist-q').textContent = e.q || (i18n('author') + ': ' + e.by);
                if (tags.length) row.querySelector('.smg-search-hist-meta').textContent = tags.join(' · ');
                row.addEventListener('click', () => applyHistoryEntry(e));
                row.querySelector('.smg-search-hist-edit').addEventListener('click', ev => { ev.stopPropagation(); sendToBar(e); });
                row.querySelector('.smg-search-hist-cross').addEventListener('click', ev => { ev.stopPropagation(); openOnOther(e); });
                row.querySelector('.smg-search-hist-remove').addEventListener('click', ev => {
                    ev.stopPropagation();
                    removeHistory(e);                       // persiste
                    row.remove();                           // tira SÓ a linha (sem re-render → o scroll fica onde está)
                    histShown = Math.max(0, histShown - 1);
                    const all = loadHistory();
                    searchHistBadge.textContent = all.length;
                    searchHistToggle.hidden = all.length <= 5;
                    if (!all.length) { renderHistory(); return; }   // zerou → estado vazio
                    if (histShown < all.length) {
                        if (!histExpanded && histShown < 5) appendHistChunk(all, 1);   // recolhido: repõe a 5ª linha
                        else if (histExpanded && searchHistList.scrollHeight - searchHistList.scrollTop - searchHistList.clientHeight < 220) appendHistChunk(all, 1);   // lista ficou curta → repõe
                    }
                });
                return row;
            }
            // anexa as próximas n linhas a partir de histShown (render incremental — as ~1000 nunca montam de uma vez)
            function appendHistChunk(all, n) {
                const end = Math.min(all.length, histShown + n);
                for (let i = histShown; i < end; i++) { const row = buildHistRow(all[i]); searchHistList.appendChild(row); i18nDom(row); }
                histShown = end;
            }
            function renderHistory() {
                const all = loadHistory();
                if (!all.length) { searchHistEl.hidden = true; searchEmptyEl.hidden = false; return; }   // sem histórico → estado vazio (não um toco só com a toolbar)
                searchEmptyEl.hidden = true;
                searchHistEl.hidden = false;
                searchHistBadge.textContent = all.length;
                // fechado: 5 mais recentes · aberto: lista SCROLLÁVEL (chunks de HIST_CHUNK conforme rola — substituiu a paginação ‹ ›)
                searchHistList.classList.toggle('smg-search-hist-list--scroll', histExpanded);
                searchHistList.scrollTop = 0;
                searchHistList.innerHTML = '';
                histShown = 0;
                appendHistChunk(all, histExpanded ? HIST_CHUNK : 5);
                searchHistToggle.hidden = all.length <= 5;
                searchHistToggle.textContent = histExpanded ? i18n('Show less') : i18n('Show all');
            }
            // perto do fundo → próximo lote (rAF-throttled, passive — padrão onScrollRaf, mas no scroll DA LISTA)
            let histScrollTick = false;
            searchHistList.addEventListener('scroll', () => {
                if (!histExpanded || histScrollTick) return;
                histScrollTick = true;
                requestAnimationFrame(() => {
                    histScrollTick = false;
                    if (searchHistList.scrollHeight - searchHistList.scrollTop - searchHistList.clientHeight >= 220) return;
                    const all = loadHistory();
                    if (histShown < all.length) appendHistChunk(all, HIST_CHUNK);
                });
            }, { passive: true });

            searchHistToggle.addEventListener('click', () => { histExpanded = !histExpanded; renderHistory(); });
            searchHistClear.addEventListener('click', () => {
                if (!confirm(i18n('Clear all recent searches?'))) return;   // confirma antes de apagar
                saveHistory([]); histExpanded = false; renderHistory();
            });

            // mobile: mantém o sheet ACIMA do teclado e sem passar do topo da tela (visualViewport)
            const vv = window.visualViewport;
            function syncSearchKeyboard() {
                if (!vv || !searchOverlay.classList.contains('open')) return;
                if (window.innerWidth > 600) { searchPop.style.bottom = ''; searchPop.style.maxHeight = ''; return; }
                const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));  // altura do teclado
                searchPop.style.bottom = kb + 'px';                            // encosta acima do teclado
                searchPop.style.maxHeight = Math.round(vv.height - 8) + 'px';  // nunca ultrapassa o topo visível
            }
            if (vv) { vv.addEventListener('resize', syncSearchKeyboard); vv.addEventListener('scroll', syncSearchKeyboard); }

            // DROPDOWN (desktop): ancora o pop abaixo do input REAL da topbar. MODAL (mobile/sem topbar): centralizado, como antes.
            const isDrop = () => window.innerWidth > 600 && !!document.querySelector('.smg-tb-search-input');
            function positionDrop() {
                const bar = document.querySelector('.smg-tb-search'); if (!bar) return;
                const r = bar.getBoundingClientRect();
                const w = Math.min(Math.max(r.width, 460), window.innerWidth - 16);
                let left = r.left; if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w; if (left < 8) left = 8;
                // writes guardados: o followDrop roda por frame — só escreve quando a âncora moveu de fato
                const t = (r.bottom + 8) + 'px', l = left + 'px', ww = w + 'px';
                if (searchPop.style.top !== t) searchPop.style.top = t;
                if (searchPop.style.left !== l) searchPop.style.left = l;
                if (searchPop.style.width !== ww) searchPop.style.width = ww;
            }
            // a topbar tem 2 alturas (76 ↔ 56 no .floating, com transição de 220ms) → enquanto o dropdown
            // está aberto, SEGUE a âncora a cada frame (1 rect + writes guardados num único elemento; o
            // loop morre sozinho ao fechar). Posicionar só no open deixava o pop descolado/sobreposto
            // quando a topbar encolhia/voltava com a busca aberta.
            let dropFollow = 0;
            function followDrop() {
                if (!searchOverlay.classList.contains('open') || !searchPop.classList.contains('smg-search-pop--drop')) { dropFollow = 0; return; }
                positionDrop();
                dropFollow = requestAnimationFrame(followDrop);
            }
            function openSearch() {
                closePopovers();
                histExpanded = false; // sempre abre recolhido (5 recentes)
                clearResults();   // some com os resultados da busca anterior + re-renderiza o histórico
                if (searchHistList.classList.contains('smg-search-hist-list--scroll')) renderHistory();   // fechou expandido → o clearResults pulou o render (histórico visível); força voltar pros 5
                applyScopeUI();   // reflete o chip de contexto + placeholder ao abrir
                const drop = isDrop();
                searchOverlay.classList.toggle('smg-search-overlay--drop', drop);
                searchPop.classList.toggle('smg-search-pop--drop', drop);
                if (drop) { positionDrop(); if (!dropFollow) dropFollow = requestAnimationFrame(followDrop); }
                else { searchPop.style.top = ''; searchPop.style.left = ''; searchPop.style.width = ''; }
                searchOverlay.classList.add('open');
                document.documentElement.classList.add('smg-search-open');   // mostra o botão Buscar dentro do input da topbar (CSS)
                // foco síncrono mantém o gesto p/ abrir o teclado no mobile (no desktop o input já é o da topbar, foco é no-op)
                getSearchInput().focus({ preventScroll: true });
                if (!drop) { syncSearchKeyboard(); setTimeout(syncSearchKeyboard, 260); }   // mobile: ajusta acima do teclado
            }

            function closeSearch() {
                searchOverlay.classList.remove('open');
                document.documentElement.classList.remove('smg-search-open');
                searchPop.style.bottom = ''; searchPop.style.maxHeight = '';   // limpa pra animação de saída
                searchPop.style.top = ''; searchPop.style.left = ''; searchPop.style.width = '';   // limpa o posicionamento do dropdown
            }

            function doSearch(addToHistory) {
                const p = parseCommands(getSearchInput().value);
                applyParsed(p);                          // by:/sort:/posts: → estado (searchBy/orderDate/titlesOn)
                const q = p.keywords, by = p.by;
                if (!q && !by) return;

                if (addToHistory) addHistory({ q, by, scope: currentScope, titles: titlesOn, order: orderDate ? 'date' : '', t: Date.now() });   // grava as KEYWORDS limpas + filtros (reconstrói os comandos ao reabrir)

                const token = qsForm?.querySelector('input[name="_xfToken"]')?.value
                    || document.querySelector('input[name="_xfToken"]')?.value || '';

                const fields = [['keywords', likeify(q)], ['_xfToken', token]];   // wildcard de prefixo p/ achar por parte da palavra (ambos os fóruns)
                // ESCOPO: dentro do tópico busca POSTS (c[thread]); no fórum, posts dos nós (com filhos). title_only só faz sentido fora do tópico.
                if (currentScope === 'thread' && threadId) fields.push(['c[thread]', threadId], ['search_type', 'post']);   // search_type=post é OBRIGATÓRIO p/ restringir À thread (senão o XF busca threads no global e ignora c[thread])
                else if (currentScope === 'forum' && forumId) fields.push(['c[nodes][0]', forumId], ['c[child_nodes]', '1']);
                if (titlesOn && currentScope !== 'thread') fields.push(['c[title_only]', '1']);
                if (by) fields.push(['c[users]', by]);
                if (orderDate) fields.push(['order', 'date']);   // omitido = relevance (default do XF)

                runSearchInline(fields);
            }
            // === busca INLINE: faz o fetch dos resultados e mostra NO PRÓPRIO dropdown (em vez de navegar) ===
            let searchSeq = 0, searchAbort = null;
            function runSearchInline(fields) {
                const seq = ++searchSeq;
                if (searchAbort) searchAbort.abort();   // mata o POST anterior (full-text é caro no servidor; o seq só descartava a RESPOSTA — a request continuava rodando)
                const ctrl = searchAbort = (typeof AbortController === 'function') ? new AbortController() : null;
                searchHistEl.hidden = true;   // esconde o histórico enquanto mostra resultados
                searchEmptyEl.hidden = true;
                searchResultsEl.hidden = false;
                searchResultsEl.innerHTML = '<div class="smg-search-rloading"><span class="smg-loading"></span></div>';
                const body = fields.map(f => encodeURIComponent(f[0]) + '=' + encodeURIComponent(f[1])).join('&');
                fetch(searchAction, { method: 'POST', body: body, credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl ? ctrl.signal : undefined })
                    .then(r => r.text().then(html => ({ html: html, url: r.url })))
                    .then(o => { if (seq === searchSeq) paintResults(parseSearchResults(new DOMParser().parseFromString(o.html, 'text/html')), o.url); })
                    .catch(err => { if (seq === searchSeq && !(err && err.name === 'AbortError')) searchResultsEl.innerHTML = '<div class="smg-search-noresults">' + i18n('Search failed') + '</div>'; });
            }
            function parseSearchResults(doc) {
                const out = [];
                doc.querySelectorAll('.block-body .contentRow').forEach(row => {
                    const a = row.querySelector('.contentRow-title a[href], h3 a[href], .contentRow-main a[href]');
                    if (!a) return;
                    let href = a.getAttribute('href') || '';
                    try { href = new URL(href, location.href).href; } catch (e) {}
                    const snip = row.querySelector('.contentRow-snippet');
                    const minor = row.querySelector('.contentRow-minor');
                    // prefixos/tags: SimpCity usa .label; SMG usa .prefix (mesma divergência dos alertas) → seletor cobre os dois, senão a tag vaza no título ("YoutubersGals Of Gurk")
                    const LABEL_SEL = '.label, .label-append, [class*="label--"], .prefix, [class*="prefix"]';
                    const titleEl = a.closest('.contentRow-title') || a.parentElement;
                    const labels = titleEl ? Array.from(titleEl.querySelectorAll(LABEL_SEL)) : [];
                    const aClone = a.cloneNode(true);   // tags vêm DENTRO do <a> → tira do texto do título (senão duplica/cola)
                    aClone.querySelectorAll(LABEL_SEL).forEach(l => l.remove());
                    // FOTO = thumbnail do tópico (.structItem-cell--icon > .dcThumbnail; a URL real está no background-image do <img>). Reusa o dcThumbUrl.
                    const thumbEl = row.querySelector('.dcThumbnail');
                    let photo = thumbEl ? dcThumbUrl(thumbEl) : '';
                    if (/no_image|defaultThumbnail/i.test(photo)) photo = '';   // placeholder "sem imagem" → ignora
                    out.push({
                        href: href,
                        title: aClone.textContent.replace(/\s+/g, ' ').trim(),
                        snippet: snip ? snip.textContent.replace(/\s+/g, ' ').trim() : '',
                        meta: minor ? minor.textContent.replace(/\s+/g, ' ').trim() : '',
                        photo: photo,   // URL do thumbnail (string) — img limpa no paint (sem clonar <a> aninhado)
                        labels: labels.map(l => document.importNode(l, true)),  // tags/prefixos originais
                    });
                });
                return out;
            }
            // clicar num resultado (ou "Ver todos") TAMBÉM grava a busca no histórico — antes só Enter/Buscar gravava, então type→clica-link se perdia
            function commitCurrentSearch() {
                const p = parseCommands(getSearchInput().value);
                addHistory({ q: p.keywords, by: p.by, scope: currentScope, titles: (p.titles === true), order: p.order ? 'date' : '', t: Date.now() });
            }
            // termos p/ highlight = keywords digitadas (sem comandos/aspas/wildcard), ≥2 chars
            function hlTerms() {
                const kw = (parseCommands(getSearchInput().value).keywords || '');
                return kw.split(/\s+/).map(s => s.replace(/["*]/g, '').trim()).filter(s => s.length >= 2);
            }
            // escreve `text` em `el` envolvendo as ocorrências dos termos em <mark> (text nodes → SEM injeção de HTML).
            // como a busca usa wildcard de prefixo, o termo "fileste" destaca a palavra inteira "filester" ([\w] após o termo).
            function setHL(el, text, terms) {
                el.textContent = '';
                if (!terms.length || !text) { el.textContent = text || ''; return; }
                const esc = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\w]*');
                let re; try { re = new RegExp('(' + esc.join('|') + ')', 'ig'); } catch (e) { el.textContent = text; return; }
                let last = 0, m;
                while ((m = re.exec(text))) {
                    if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
                    const mk = document.createElement('mark'); mk.className = 'smg-search-hl'; mk.textContent = m[0];
                    el.appendChild(mk);
                    last = m.index + m[0].length;
                    if (re.lastIndex === m.index) re.lastIndex++;   // guarda contra match vazio
                }
                if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
            }
            function paintResults(results, finalUrl) {
                searchResultsEl.innerHTML = '';
                const terms = hlTerms();
                if (!results.length) {
                    const e = document.createElement('div'); e.className = 'smg-search-noresults'; e.textContent = i18n('No results');
                    searchResultsEl.appendChild(e);
                } else {
                    results.slice(0, 20).forEach(r => {
                        const a = document.createElement('a');
                        a.className = 'smg-search-result'; a.href = r.href;
                        if (r.photo) {   // foto = thumbnail do tópico (esquerda)
                            const f = document.createElement('span'); f.className = 'smg-search-result-fig';
                            const img = document.createElement('img'); img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.alt = '';
                            img.src = r.photo;
                            img.addEventListener('error', () => f.remove(), { once: true });   // falhou/mixed-content → some (sem broken-img)
                            f.appendChild(img); a.appendChild(f);
                        }
                        const main = document.createElement('span'); main.className = 'smg-search-result-main';
                        const tr = document.createElement('span'); tr.className = 'smg-search-result-titlerow';
                        (r.labels || []).forEach(l => tr.appendChild(l));   // tags/prefixos originais (antes do título, estilo do fórum)
                        const t = document.createElement('span'); t.className = 'smg-search-result-title'; setHL(t, r.title, terms); tr.appendChild(t);
                        main.appendChild(tr);
                        if (r.snippet) { const s = document.createElement('span'); s.className = 'smg-search-result-snippet'; setHL(s, r.snippet, terms); main.appendChild(s); }
                        if (r.meta) { const m = document.createElement('span'); m.className = 'smg-search-result-meta'; m.textContent = r.meta; main.appendChild(m); }
                        a.appendChild(main);
                        a.addEventListener('click', commitCurrentSearch);   // grava a busca ao abrir o resultado
                        searchResultsEl.appendChild(a);
                    });
                }
                if (finalUrl && /\/search\//.test(finalUrl)) {
                    const all = document.createElement('a');
                    all.className = 'smg-search-result-all'; all.href = finalUrl;
                    all.innerHTML = '<span class="smg-search-all-t"></span>' + ICONS.arrowRight;
                    all.querySelector('.smg-search-all-t').textContent = i18n('See all results');
                    all.addEventListener('click', commitCurrentSearch);   // "Ver todos" também grava
                    searchResultsEl.appendChild(all);
                }
                searchResultsEl.hidden = false;
            }
            function clearResults() {   // volta pro histórico — sem re-render se ele JÁ está na tela (era rebuild por keystroke)
                if (!searchResultsEl.hidden) { searchResultsEl.hidden = true; searchResultsEl.innerHTML = ''; }
                if (searchHistEl.hidden && searchEmptyEl.hidden) renderHistory();
            }
            // DEBOUNCE: busca enquanto digita (não grava histórico; só Enter/Buscar grava). Delegado: vale pro input da topbar E do modal + autor.
            let searchDebounce = null;
            function onSearchInput() {
                clearTimeout(searchDebounce);
                const p = parseCommands(getSearchInput().value);
                if (p.keywords.length < 3 && !p.by) { clearResults(); return; }   // vazio/curto demais → histórico (XF tem mínimo de caracteres)
                searchDebounce = setTimeout(() => doSearch(false), 420);
            }
            document.addEventListener('input', e => { if (e.target && e.target.matches && e.target.matches('.smg-tb-search-input, .smg-search-input')) onSearchInput(); });
            // mudança de FILTRO (escopo via chip) re-busca JÁ (sem debounce) se já existe query. Hoisted → ok no init.
            function researchOnFilter() {
                if (applyingEntry) return;
                const p = parseCommands(getSearchInput().value);
                if (p.keywords.length < 3 && !p.by) return;
                clearTimeout(searchDebounce);
                doSearch(false);
            }

            searchInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); clearTimeout(searchDebounce); doSearch(true); }
                else if (e.key === 'Escape') closePopovers();
            });
            searchPop.querySelector('.smg-search-go').addEventListener('click', () => { clearTimeout(searchDebounce); doSearch(true); });

            btnSearch.addEventListener('click', e => {
                e.stopPropagation();
                if (searchOverlay.classList.contains('open')) closeSearch();
                else openSearch();
            });

            // fechar: botão X, clique no backdrop (modal), Esc
            searchPop.querySelector('.smg-search-close').addEventListener('click', closeSearch);
            searchOverlay.addEventListener('click', e => { if (e.target === searchOverlay) closeSearch(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && searchOverlay.classList.contains('open')) closeSearch(); });

            // abrir/fechar disparado pela topbar (input real) via eventos custom — desacopla do escopo do dock
            document.addEventListener('smg-search-open', openSearch);
            document.addEventListener('smg-search-close', closeSearch);
            // DROPDOWN (desktop): o overlay é pointer-events:none, então o clique-no-backdrop não vale — fecha ao clicar FORA do pop e da search bar
            document.addEventListener('pointerdown', e => {
                if (!searchOverlay.classList.contains('open') || !searchPop.classList.contains('smg-search-pop--drop')) return;
                if (searchPop.contains(e.target) || (e.target.closest && e.target.closest('.smg-tb-search, .smg-search-cmd, .smg-search-cfg-portal'))) return;   // portais (paleta/config) ficam no body → não contam como "fora"
                closeSearch();
            }, true);
            window.addEventListener('resize', () => { if (searchOverlay.classList.contains('open') && searchPop.classList.contains('smg-search-pop--drop')) positionDrop(); });
            // arrastar pra baixo fecha o modal de busca (mobile; não no dropdown do desktop)
            addSwipeClose(searchPop, closeSearch, () => searchOverlay.classList.contains('open') && !searchPop.classList.contains('smg-search-pop--drop'));
        };
        setupSearch();

        // ---- settings (engrenagem) ----
        const setupSettings = () => {
            btnSettings.addEventListener('click', e => {
                e.stopPropagation();
                if (navWrapper.classList.contains('settings-open')) closePopovers();
                else { closePopovers(); navWrapper.classList.add('settings-open'); }
            });
            // toggles (FEATURES)
            settingsPop.querySelectorAll('input[data-feat]').forEach(inp => {
                inp.addEventListener('change', () => { FEATURES[inp.dataset.feat] = inp.checked; saveFeatures(); });
            });
            // sliders (tunables do feed → gmSet; aplicam na próxima abertura do feed)
            settingsPop.querySelectorAll('input[data-tune]').forEach(inp => {
                inp.addEventListener('input', () => {
                    gmSet(inp.dataset.tune, String(inp.value));
                    const badge = inp.parentElement.querySelector('.smg-set-val'); if (badge) badge.textContent = inp.value;
                });
            });
            // versão (do gerenciador de userscript)
            const verEl = settingsPop.querySelector('.smg-set-ver');
            if (verEl) verEl.textContent = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? 'v' + GM_info.script.version : '';
            // fechar (×) + recarregar
            settingsPop.querySelector('.smg-set-x').addEventListener('click', e => { e.stopPropagation(); closePopovers(); });
            settingsPop.querySelector('.smg-set-reload').addEventListener('click', () => location.reload());
            // restaurar padrões: zera FEATURES + tunables e recarrega
            settingsPop.querySelector('.smg-set-reset').addEventListener('click', () => {
                if (!confirm(i18n('Restore default settings?'))) return;
                Object.assign(FEATURES, DEFAULT_FEATURES); saveFeatures();
                SET_TUNABLES.forEach(t => gmSet(t.key, ''));   // limpa → volta ao default no código
                location.reload();
            });
            // rail de categorias + busca (filtra entre todas)
            const setTabs = Array.prototype.slice.call(settingsPop.querySelectorAll('.smg-set-tab'));
            const setSecs = Array.prototype.slice.call(settingsPop.querySelectorAll('.smg-set-sec'));
            const setEmpty = settingsPop.querySelector('.smg-set-empty');
            const setQ = settingsPop.querySelector('.smg-set-q');
            const setContentEl = settingsPop.querySelector('.smg-set-content');
            let setActive = 0;
            function setShowTab(i) {
                setActive = i; if (setQ) setQ.value = ''; settingsPop.classList.remove('searching'); if (setEmpty) setEmpty.hidden = true;
                setSecs.forEach((s, j) => { s.hidden = j !== i; s.querySelectorAll('[data-q]').forEach(r => { r.style.display = ''; }); });
                setTabs.forEach((t, j) => t.classList.toggle('active', j === i));
                if (setContentEl) setContentEl.scrollTop = 0;
            }
            setTabs.forEach((t, i) => t.addEventListener('click', e => { e.stopPropagation(); setShowTab(i); }));
            if (setQ) {
                setQ.addEventListener('keydown', e => e.stopPropagation());
                setQ.addEventListener('input', () => {
                    const term = setQ.value.trim().toLowerCase();
                    if (!term) { setShowTab(setActive); return; }
                    settingsPop.classList.add('searching'); setTabs.forEach(t => t.classList.remove('active'));
                    let any = false;
                    setSecs.forEach(s => {
                        let vis = false;
                        s.querySelectorAll('[data-q]').forEach(r => { const m = r.getAttribute('data-q').indexOf(term) !== -1; r.style.display = m ? '' : 'none'; if (m) { vis = true; any = true; } });
                        s.hidden = !vis;
                    });
                    if (setEmpty) setEmpty.hidden = any;
                });
            }

            // FAB de configurações: nas páginas onde a dock fica escondida (baronly no desktop), garante
            // acesso ao mod. Clique → revela a dock (só a engrenagem) + abre o settings. O closePopovers reseta.
            if (navWrapper.classList.contains('smg-dock-baronly') && !document.getElementById('smg-settings-fab')) {
                const fab = document.createElement('button');
                fab.id = 'smg-settings-fab';
                fab.type = 'button';
                fab.title = i18n('Settings');
                fab.setAttribute('aria-label', i18n('Settings'));
                fab.innerHTML = '<span class="smg-nav-ico">' + ICONS.settings + '</span>';   // mesmo wrapper da dock (fill:none → outline, não blob)
                fab.addEventListener('click', e => {
                    e.stopPropagation();
                    if (navWrapper.classList.contains('settings-open')) { closePopovers(); return; }
                    closePopovers();
                    navWrapper.classList.add('smg-dock-show', 'settings-open');
                });
                document.body.appendChild(fab);
            }
        };
        setupSettings();

        // ---- filtro por autor ----
        const setupAuthorFilter = () => {
            if (!filterPop) return;
            const opAuthor = (document.querySelector('.message--post')?.getAttribute('data-author') || '').trim();
            const curAuthorOf = () => (getPostElement(getCurrentPostIndex())?.getAttribute('data-author') || '').trim();
            const filterInput = filterPop.querySelector('.smg-filter-input');
            const quick = filterPop.querySelector('.smg-filter-quick');

            const syncChips = () => quick.querySelectorAll('.smg-filter-chip').forEach(c =>
                c.classList.toggle('active', !!authorFilter && c.dataset.author?.toLowerCase() === authorFilter));

            const setFilter = name => {
                authorFilter = name ? name.toLowerCase() : null;
                applyAuthorFilter(true);   // troca de filtro → re-avalia TODOS os posts (não só os novos)
                btnFilter.classList.toggle('smg-active', !!authorFilter);
                setBtnLabel(btnFilter, name ? (i18n('Filtering') + ': ' + name) : 'Filter by author');
                syncChips();
                closePopovers();
            };

            const addChip = (name, label) => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'smg-filter-chip';
                chip.dataset.author = name;
                chip.textContent = label || name;
                chip.addEventListener('click', () => setFilter(name));
                quick.appendChild(chip);
            };

            btnFilter.addEventListener('click', e => {
                e.stopPropagation();
                if (navWrapper.classList.contains('filter-open')) { closePopovers(); return; }
                closePopovers();
                // chips rápidos: OP + autor do post em foco
                quick.innerHTML = '';
                if (opAuthor) addChip(opAuthor, opAuthor + ' (OP)');
                const cur = curAuthorOf();
                if (cur && cur.toLowerCase() !== opAuthor.toLowerCase()) addChip(cur);
                syncChips();
                filterInput.value = '';
                navWrapper.classList.add('filter-open');
                setTimeout(() => filterInput.focus({ preventScroll: true }), 0);
            });

            filterPop.querySelector('.smg-filter-apply').addEventListener('click', () => {
                const v = filterInput.value.trim();
                if (v) setFilter(v);
            });
            filterInput.addEventListener('keydown', ev => {
                if (ev.key === 'Enter') { ev.preventDefault(); const v = filterInput.value.trim(); if (v) setFilter(v); }
                else if (ev.key === 'Escape') closePopovers();
            });
            filterPop.querySelector('.smg-filter-clear').addEventListener('click', () => setFilter(null));
        };
        setupAuthorFilter();

        // ---- filtro da listagem (fórum): popover reimplementada no nosso estilo ----
        const setupListFilter = () => {
            if (!listFilterPop) return;
            const lfBody = listFilterPop.querySelector('.smg-lf-body');
            let lfLoaded = false, lfData = null;

            const lfRow = label => {
                const row = document.createElement('div');
                row.className = 'smg-lf-row';
                if (label) { const l = document.createElement('div'); l.className = 'smg-lf-label'; l.textContent = label; row.appendChild(l); }
                return row;
            };
            const cloneSel = orig => { const s = document.importNode(orig, true); s.className = 'smg-lf-select'; s.removeAttribute('id'); s.removeAttribute('aria-labelledby'); return s; };

            function buildListFilter(form) {
                lfData = { action: form.getAttribute('action') || location.pathname, token: form.querySelector('input[name="_xfToken"]')?.value || '' };
                lfBody.innerHTML = '';

                // Em destaque (toggle)
                const featOrig = form.querySelector('input[name="featured"]');
                let featChip = null;
                if (featOrig) {
                    const row = lfRow('');
                    featChip = document.createElement('button');
                    featChip.type = 'button';
                    featChip.className = 'smg-chip smg-chip-toggle' + (featOrig.checked ? ' active' : '');
                    featChip.dataset.on = featOrig.checked ? '1' : '0';
                    featChip.innerHTML = '<span class="smg-chip-check">' + svgIcon('<path d="M20 6 9 17l-5-5"/>') + '</span>Apenas em destaque';
                    featChip.addEventListener('click', () => { const on = featChip.dataset.on !== '1'; featChip.dataset.on = on ? '1' : '0'; featChip.classList.toggle('active', on); });
                    row.appendChild(featChip);
                    lfBody.appendChild(row);
                }

                // Prefixos (chips com a cor do label do fórum)
                const prefixSelect = form.querySelector('select[name="prefix_id[]"]');
                let chipsWrap = null;
                if (prefixSelect) {
                    const row = lfRow('Prefixo');
                    chipsWrap = document.createElement('div');
                    chipsWrap.className = 'smg-lf-chips';
                    const makeChip = opt => {
                        const chip = document.createElement('button');
                        chip.type = 'button';
                        chip.className = 'smg-chip smg-lf-prefix' + (opt.selected ? ' active' : '');
                        chip.dataset.value = opt.value;
                        chip.dataset.on = opt.selected ? '1' : '0';
                        const lc = opt.getAttribute('data-label-class');
                        if (lc) { const s = document.createElement('span'); s.className = lc; s.textContent = opt.textContent.trim(); chip.appendChild(s); }
                        else chip.textContent = opt.textContent.trim();
                        chip.addEventListener('click', () => { const on = chip.dataset.on !== '1'; chip.dataset.on = on ? '1' : '0'; chip.classList.toggle('active', on); });
                        return chip;
                    };
                    Array.from(prefixSelect.children).forEach(node => {
                        if (node.tagName === 'OPTGROUP') {
                            const h = document.createElement('div'); h.className = 'smg-lf-group'; h.textContent = node.label;
                            chipsWrap.appendChild(h);
                            Array.from(node.children).forEach(opt => chipsWrap.appendChild(makeChip(opt)));
                        } else if (node.tagName === 'OPTION' && node.value !== '-1') { // (Any) = nenhum selecionado
                            chipsWrap.appendChild(makeChip(node));
                        }
                    });
                    row.appendChild(chipsWrap);
                    lfBody.appendChild(row);
                }

                // Iniciado por
                const starterOrig = form.querySelector('input[name="starter"]');
                let starterInput = null;
                if (starterOrig) {
                    const row = lfRow('Started by');
                    starterInput = document.createElement('input');
                    starterInput.type = 'text';
                    starterInput.className = 'smg-lf-input';
                    starterInput.placeholder = 'Username';
                    starterInput.value = starterOrig.value || '';
                    row.appendChild(starterInput);
                    lfBody.appendChild(row);
                }

                // Última atualização
                const lastOrig = form.querySelector('select[name="last_days"]');
                let lastClone = null;
                if (lastOrig) { const row = lfRow('Last updated'); lastClone = cloneSel(lastOrig); row.appendChild(lastClone); lfBody.appendChild(row); }

                // Ordenar por + direção
                const orderOrig = form.querySelector('select[name="order"]');
                const dirOrig = form.querySelector('select[name="direction"]');
                let orderClone = null, dirClone = null;
                if (orderOrig && dirOrig) {
                    const row = lfRow('Sort by');
                    const sort = document.createElement('div'); sort.className = 'smg-lf-sort';
                    orderClone = cloneSel(orderOrig); dirClone = cloneSel(dirOrig);
                    sort.append(orderClone, dirClone);
                    row.appendChild(sort);
                    lfBody.appendChild(row);
                }

                // Filtrar
                const apply = document.createElement('button');
                apply.type = 'button';
                apply.className = 'smg-lf-apply';
                apply.textContent = 'Filter';
                apply.addEventListener('click', () => {
                    const fields = [['_xfToken', lfData.token], ['apply', '1']];
                    if (featChip && featChip.dataset.on === '1') fields.push(['featured', '1']);
                    if (chipsWrap) chipsWrap.querySelectorAll('.smg-lf-prefix[data-on="1"]').forEach(c => fields.push(['prefix_id[]', c.dataset.value]));
                    const sv = starterInput ? starterInput.value.trim() : '';
                    if (sv) fields.push(['starter', sv]);
                    if (lastClone) fields.push(['last_days', lastClone.value]);
                    if (orderClone) fields.push(['order', orderClone.value]);
                    if (dirClone) fields.push(['direction', dirClone.value]);
                    postForm(lfData.action, fields);
                });
                lfBody.appendChild(apply);
                i18nDom(lfBody);
            }

            const tryBuild = form => {
                if (!form) return false;
                try { buildListFilter(form); } catch (err) { console.warn('[smg] erro ao montar filtro', err); lfBody.textContent = i18n('Error building the filter.'); }
                return true;
            };

            // fallback: usa o loader nativo do XenForo (carrega o form em .js-filterMenuBody, escondido)
            const loadViaNative = () => {
                const trigger = document.querySelector('.filterBar-menuTrigger');
                const menuBody = document.querySelector('.filterBar .js-filterMenuBody');
                if (!trigger || !menuBody) { lfBody.textContent = i18n('Filter unavailable.'); return; }
                if (tryBuild(menuBody.querySelector('form'))) return; // já carregado antes

                // esconde o menu nativo onde quer que o XF o posicione (pode reparentar pro body)
                const closeNative = () => document.querySelectorAll('.menu[data-href*="filters"]').forEach(m => {
                    m.classList.remove('is-active');
                    m.setAttribute('aria-hidden', 'true');
                });
                const hide = document.createElement('style');
                hide.textContent = '.menu[data-href*="filters"]{opacity:0!important;pointer-events:none!important}';
                document.head.appendChild(hide);
                const sy = window.scrollY;
                trigger.click(); // dispara só o AJAX nativo (o menu fica invisível)

                let tries = 0;
                const poll = setInterval(() => {
                    const f = menuBody.querySelector('form');
                    if (f) {
                        clearInterval(poll);
                        tryBuild(f);            // lê os valores do form nativo
                        closeNative();          // fecha o menu nativo de vez
                        window.scrollTo(0, sy); // desfaz o scroll do autofocus
                        setTimeout(() => hide.remove(), 60);
                    } else if (++tries > 60) {
                        clearInterval(poll);
                        closeNative();
                        hide.remove();
                        lfLoaded = false;
                        lfBody.textContent = i18n('Error loading the filter.');
                    }
                }, 100);
            };

            function loadListFilter() {
                if (lfLoaded) return;
                lfLoaded = true;
                const url = document.querySelector('.filterBar .menu[data-href]')?.getAttribute('data-href');
                if (!url) { loadViaNative(); return; }
                const tok = (document.documentElement.getAttribute('data-csrf') || '').trim();
                fetch(url + (url.includes('?') ? '&' : '?') + '_xfResponseType=json&_xfWithData=1' + (tok ? '&_xfToken=' + encodeURIComponent(tok) : ''), { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
                    .then(r => r.text())
                    .then(text => {
                        let h = text;
                        try {
                            const j = JSON.parse(text);
                            if (j && j.html && typeof j.html === 'object' && j.html.content) h = j.html.content;
                            else if (j && typeof j.html === 'string') h = j.html;
                        } catch {}
                        const form = new DOMParser().parseFromString(h, 'text/html').querySelector('form');
                        if (!tryBuild(form)) loadViaNative(); // fetch sem form → fallback nativo
                    })
                    .catch(err => { console.warn('[smg] erro no fetch do filtro', err); loadViaNative(); });
            }

            btnListFilter.addEventListener('click', e => {
                e.stopPropagation();
                if (navWrapper.classList.contains('listfilter-open')) { closePopovers(); return; }
                closePopovers();
                navWrapper.classList.add('listfilter-open');
                loadListFilter();
            });
        };
        setupListFilter();

        // fecha os popovers da dock (goto/config/filtro) ao clicar fora — o search tem backdrop próprio
        document.addEventListener('click', e => {
            if (!navWrapper.classList.contains('goto-open') && !navWrapper.classList.contains('settings-open')
                && !navWrapper.classList.contains('filter-open') && !navWrapper.classList.contains('listfilter-open')) return;
            const inside = gotoPop.contains(e.target)
                || settingsPop.contains(e.target) || (filterPop && filterPop.contains(e.target))
                || (listFilterPop && listFilterPop.contains(e.target))
                || btnGoto.contains(e.target)
                || btnSettings.contains(e.target) || (btnFilter && btnFilter.contains(e.target))
                || (btnListFilter && btnListFilter.contains(e.target))
                || (e.target.closest && e.target.closest('.filterBar')); // não fecha ao usar o loader nativo
            if (!inside) closePopovers();
        });

        // ---- helpers de post ----
        let lastPostScan = 0, lastScanHeight = 0;
        function refreshPosts() {   // scroll infinito anexa posts DEPOIS do build → re-materializa a lista (só quando cresce)
            const h = document.documentElement.scrollHeight;
            if (h === lastScanHeight) return;   // nada anexado desde o último scan → poupa o qSA doc-wide + closest por anchor
            lastScanHeight = h;
            let p = Array.from(document.querySelectorAll('span.u-anchorTarget[id^="post-"]')).filter(el => !el.closest('.message-responseRow'));
            if (!p.length) p = Array.from(document.querySelectorAll('.message'));
            if (p.length > posts.length) posts = p;
        }
        function getCurrentPostIndex() {
            const refY = 100;

            let closestIndex = 0;
            let closestDist = Infinity;

            for (let i = 0; i < posts.length; i++) {
                const top = posts[i].getBoundingClientRect().top;
                const dist = Math.abs(top - refY);
                if (dist < closestDist) { closestDist = dist; closestIndex = i; }
                if (top > refY) break;   // posts em ordem do DOM → tops monotônicos; daqui pra frente só aumenta a distância
            }

            return closestIndex;
        }

        function scrollToPost(index) {
            if (index < 0 || index >= posts.length) return;

            const el = posts[index];
            if (el instanceof HTMLElement) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        function getPostElement(index) {
            const anchor = posts[index];
            if (!anchor) return null;
            return anchor.closest('.message') || anchor.parentElement;
        }

        // estado dos botões prev/next/goto: depende só de constantes capturadas no mount → seta 1× (não no scroll)
        function updatePostButtonsState() {
            btnPagePrev.disabled = !prevPageLink;
            btnPageNext.disabled = !nextPageLink;
            btnGoto.disabled = !pageJump;
        }
        // sondagem "cheguei no fim da lista?" (scroll infinito anexou posts) — throttled 800ms.
        // ANTES: updatePostButtonsState rodava getCurrentPostIndex() (loop de getBoundingClientRect sobre
        // TODOS os posts) a CADA frame de scroll só pra gatear isto. Agora o rect-loop só roda quando o
        // throttle libera; o estado dos botões (constante) saiu do caminho do scroll.
        function pollEndOfList() {
            const now = Date.now();
            if (now - lastPostScan <= 800) return;
            lastPostScan = now;
            // "perto do fim?" só precisa do ÚLTIMO anchor (1 rect) — getCurrentPostIndex() lia o rect de
            // TODOS os posts até o atual (O(N) num thread fundo) só pra gatear este refresh
            const last = posts[posts.length - 1];
            if (last && last.getBoundingClientRect().top < window.innerHeight * 2) refreshPosts();
        }

        // ---- scroll topo / fundo (substituem o nav de post) ----
        btnUp.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        btnDown.addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));

        // ---- share ----
        btnShare.addEventListener('click', async () => {
            const anchor = posts[getCurrentPostIndex()];
            if (!anchor?.id) return;

            const url = window.location.origin + window.location.pathname + '#' + anchor.id;

            try {
                await navigator.clipboard.writeText(url);
                setBtnIcon(btnShare, ICONS.shareDone);
                setBtnLabel(btnShare, 'Copied!');
                setTimeout(() => {
                    setBtnIcon(btnShare, ICONS.share);
                    setBtnLabel(btnShare, 'Copy post');
                }, 900);
            } catch {}
        });

        // ---- save (bookmark) ----
        btnSave.addEventListener('click', () => {
            const postEl = getPostElement(getCurrentPostIndex());
            if (!postEl) return;

            let bookmarkLink = postEl.querySelector('a[data-xf-click="bookmark"]');

            if (!bookmarkLink) {
                bookmarkLink = Array.from(postEl.querySelectorAll('a[href]'))
                    .find(a => a.textContent?.trim() === 'Add bookmark');
            }

            bookmarkLink?.click();
        });

        // ---- watch thread ----
        function getWatchButton() {
            return document.querySelector('.buttonGroup a[data-sk-watch][data-sk-unwatch]');
        }

        const paintWatch = on => {
            setBtnIcon(btnWatch, on ? ICONS.unwatch : ICONS.watch);
            setBtnLabel(btnWatch, on ? 'Unwatch thread' : 'Watch thread');
            btnWatch.classList.toggle('smg-active', on);   // destaca quando seguindo
        };
        function updateWatchIcon() { paintWatch(smgIsWatching(getWatchButton())); }

        btnWatch.addEventListener('click', async () => {
            const watchBtn = getWatchButton();
            if (!watchBtn) return;
            const wasWatching = smgIsWatching(watchBtn);
            paintWatch(!wasWatching);   // REATIVO: vira o estado na hora (otimista)
            watchBtn.click();
            const confirmBtn = await waitForElement('.overlay button[type="submit"].button--primary');
            confirmBtn?.click();
            setTimeout(() => {
                updateWatchIcon();                  // re-sincroniza com o real (corrige se errou)
                const nowWatching = smgIsWatching(getWatchButton());
                // sincroniza o NOSSO banco do feed com a mudança: passou a seguir → adiciona a thread (puxa posts já); deixou de seguir → remove
                if (nowWatching && !wasWatching) safe(feedAddCurrentThread);
                else if (!nowWatching && wasWatching) safe(feedRemoveCurrentThread);
            }, 1500);
        });

        updateWatchIcon();

        // ---- paginação ----
        btnPagePrev.addEventListener('click', () => prevPageLink?.click());
        btnPageNext.addEventListener('click', () => nextPageLink?.click());

        // ---- sort ----
        function updateSortIcon() {
            setBtnIcon(btnSort, sortIsDate ? ICONS.sortDate : ICONS.star);
            setBtnLabel(btnSort, sortIsDate ? 'Sort by date' : 'Sort by reactions');   // data-label segue p/ o sheet (mobile) + aria
            const t = btnSort.querySelector('.smg-nav-btn-text'); if (t) t.textContent = i18n(sortIsDate ? 'Date' : 'Reactions');
        }

        btnSort.addEventListener('click', () => {
            sortIsDate = !sortIsDate;
            updateSortIcon();

            if (sortIsDate) sortDateLink?.click();
            else sortReactionLink?.click();
        });

        updateSortIcon();

        // ---- estado inicial dos botões (1×) + sondagem de fim-de-lista no scroll ----
        updatePostButtonsState();

        onScrollRaf(pollEndOfList);
    }

    // ── part 13: "search titles only" (enableSearchTitlesOnly) + painel inline na página de resultados (buildSearchResultsPanel) + clique na imagem abre o feed (setupImageClickFeed) ──
    // =========================================================
    // FEATURE: auto "search titles only"
    // =========================================================

    // PERF: roda em todo processAll. Antes fazia um querySelectorAll global a CADA frame mesmo depois de
    // aplicar (o form do quick-search persiste no DOM, então sempre casava). Agora marca 'done' assim que
    // processa ao menos um form → o qSA global para de rodar após o boot. Enquanto nenhum form existe ainda
    // (boot cedo), segue tentando no próximo frame; raríssimo form injetado via AJAX depois é o único caso perdido.
    let searchTitlesDone = false;
    function enableSearchTitlesOnly() {
        if (searchTitlesDone) return;
        const forms = document.querySelectorAll('form[data-xf-init="quick-search"]');
        // sem form e DOM completo (guest/tema sem quick-search) → desiste de vez; senão este qSA global rodava TODO frame pra sempre
        if (!forms.length) { if (document.readyState === 'complete') searchTitlesDone = true; return; }
        forms.forEach(form => {
            if (form.dataset.titleOnlyApplied) return;
            form.dataset.titleOnlyApplied = 'true';

            const checkbox = form.querySelector('input[name="c[title_only]"]');

            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                // dispara change caso o XenForo escute
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        searchTitlesDone = true;
    }

    // =========================================================
    // FEATURE: painel de busca INLINE na página de RESULTADOS (search_results)
    // Input pré-preenchido (edição rápida da query) + filtros direto no header: escopo · ordenar
    // (relevância ⇄ data) · só-títulos · autor · link pro form avançado pré-preenchido (?searchform=1).
    // A URL canônica do XF carrega TODOS os params da busca (q / t / o / g / c[...]) — é o que deixa
    // o link re-executável quando o cache expira — então dá pra reconstruir os campos e re-POSTar
    // /search/search (mesmo caminho do quick-search; mexer no GET não re-roda confiável). Params sem
    // UI própria (c[newer_than], prefixos, grouped…) PASSAM DIRETO → editar não perde restrição nenhuma.
    // Filtros (escopo/ordenar/só-títulos) aplicam NA HORA (navega); query/autor aplicam no Enter/Buscar.
    // =========================================================
    let rsPanelDone = false;
    function buildSearchResultsPanel() {
        if (rsPanelDone) return;
        if ((document.documentElement.getAttribute('data-template') || '') !== 'search_results') { rsPanelDone = true; return; }
        const header = document.querySelector('.p-body-header');
        if (!header) { if (document.readyState === 'complete') rsPanelDone = true; return; }   // header ainda não parseado → tenta no próximo frame
        rsPanelDone = true;

        const sp = new URLSearchParams(location.search);
        const q0 = sp.get('q') || '';
        const by0 = sp.get('c[users]') || '';
        if (!q0 && !by0) return;   // busca sem params reconstruíveis (ex.: /search/member) → não monta

        // estado atual lido da URL
        let titlesOn = sp.get('c[title_only]') === '1';
        let orderDate = (sp.get('o') || '') === 'date';
        const nodeIds = [];
        sp.forEach((v, k) => { if (/^c\[nodes\]/.test(k) && v) nodeIds.push(v); });
        const inThread = sp.get('c[thread]') || '';
        const tParam = sp.get('t') || '';
        let scope = inThread ? 'thread' : nodeIds.length ? 'forum' : tParam === 'thread' ? 'threads' : tParam ? 'type' : 'everywhere';
        const SCOPES = [{ v: 'everywhere', label: i18n('Everywhere') }, { v: 'threads', label: i18n('Threads') }];
        if (nodeIds.length) SCOPES.push({ v: 'forum', label: i18n('This forum') });
        if (inThread) SCOPES.push({ v: 'thread', label: i18n('This thread') });
        if (scope === 'type') SCOPES.push({ v: 'type', label: tParam });   // tipo sem UI própria (profile_post…) — preserva como veio

        const panel = document.createElement('div');
        panel.id = 'smg-rs-panel';
        panel.innerHTML =
            '<div class="smg-search-bar">' +
                '<span class="smg-search-lupa">' + ICONS.search + '</span>' +
                '<input type="text" class="smg-search-input smg-rs-q" placeholder="Search the forum…" enterkeyhint="search" autocapitalize="off" autocomplete="off" spellcheck="false">' +
                '<button type="button" class="smg-search-go"><span class="smg-search-go-ic">' + ICONS.search + '</span>' + i18n('Search') + '</button>' +
            '</div>' +
            '<div class="smg-search-toolbar">' +
                '<div class="smg-search-scope">' +
                    '<button type="button" class="smg-search-scope-btn">' +
                        '<span class="smg-search-scope-cur"></span>' +
                        '<span class="smg-search-scope-chev">' + svgIcon('<path d="m6 9 6 6 6-6"/>') + '</span>' +
                    '</button>' +
                    '<div class="smg-search-scope-list" hidden></div>' +
                '</div>' +
                '<button type="button" class="smg-search-order-btn">' +
                    '<span class="smg-search-order-ic">' + svgIcon('<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>') + '</span>' +
                    '<span class="smg-search-order-cur"></span>' +
                '</button>' +
                '<button type="button" class="smg-search-switch" role="switch" title="Search thread titles only (ignores post text)">' +
                    '<span class="smg-search-switch-track"><span class="smg-search-switch-thumb"></span></span>' +
                    '<span class="smg-search-switch-lbl">Titles only</span>' +
                '</button>' +
                '<button type="button" class="smg-search-author-btn" aria-label="Author" title="Filter by author">' + svgIcon('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>') + '</button>' +
                '<a class="smg-search-adv" title="Advanced" aria-label="Advanced">' + ICONS.sliders + '</a>' +
            '</div>' +
            '<div class="smg-search-author-wrap" hidden>' +
                '<input type="text" class="smg-search-by" placeholder="Author (optional)">' +
            '</div>';

        const qInput = panel.querySelector('.smg-rs-q');
        const byInput = panel.querySelector('.smg-search-by');
        const authorWrap = panel.querySelector('.smg-search-author-wrap');
        const authorBtn = panel.querySelector('.smg-search-author-btn');
        const titlesSw = panel.querySelector('.smg-search-switch');
        const orderBtn = panel.querySelector('.smg-search-order-btn');
        const orderCur = panel.querySelector('.smg-search-order-cur');
        const scopeBtn = panel.querySelector('.smg-search-scope-btn');
        const scopeCur = panel.querySelector('.smg-search-scope-cur');
        const scopeList = panel.querySelector('.smg-search-scope-list');

        qInput.value = q0;
        byInput.value = by0;
        // form avançado PRÉ-PREENCHIDO com esta busca (mesmo link que o XF usa no título)
        panel.querySelector('.smg-search-adv').href = location.pathname + (location.search ? location.search + '&' : '?') + 'searchform=1';

        function submit() {
            const q = qInput.value.trim(), by = byInput.value.trim();
            if (!q && !by) { qInput.focus(); return; }
            const fields = [['keywords', q]];
            if (scope === 'threads') fields.push(['search_type', 'thread']);
            else if (scope === 'type' && tParam) fields.push(['search_type', tParam]);
            else if (scope === 'thread' && inThread) fields.push(['c[thread]', inThread]);
            else if (scope === 'forum') {
                nodeIds.forEach((id, i) => fields.push(['c[nodes][' + i + ']', id]));
                const cn = sp.get('c[child_nodes]'); if (cn) fields.push(['c[child_nodes]', cn]);
            }
            if (titlesOn) fields.push(['c[title_only]', '1']);
            if (by) fields.push(['c[users]', by]);
            if (orderDate) fields.push(['order', 'date']);   // omitido = relevance (default do XF)
            // o resto da URL passa direto (newer_than/prefixos/…) — só ficam de fora as chaves com UI própria acima
            sp.forEach((v, k) => {
                if (k === 'q' || k === 't' || k === 'o' || k === 'g' || k === 'page' || k === 'searchform'
                    || k === 'c[users]' || k === 'c[title_only]' || k === 'c[thread]' || k === 'c[child_nodes]' || /^c\[nodes\]/.test(k)) return;
                fields.push([k, v]);
            });
            if (sp.get('g')) fields.push(['grouped', sp.get('g')]);   // g (URL) ⇄ grouped (form)
            const qsForm = document.querySelector('form[data-xf-init="quick-search"]');
            const action = qsForm?.getAttribute('action') || '/search/search';
            const token = qsForm?.querySelector('input[name="_xfToken"]')?.value
                || document.querySelector('input[name="_xfToken"]')?.value
                || document.documentElement.getAttribute('data-csrf') || '';
            fields.push(['_xfToken', token]);
            postForm(action, fields);
        }

        // ESCOPO — menu dropdown (mesmo componente do dialog); trocar aplica na hora
        function closeScope() { scopeList.hidden = true; scopeBtn.classList.remove('open'); }
        function paintScope() {
            const s = SCOPES.find(x => x.v === scope) || SCOPES[0];
            scopeCur.textContent = s.label;
            scopeList.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.scope === scope));
        }
        SCOPES.forEach(s => {
            const opt = document.createElement('button');
            opt.type = 'button';
            opt.dataset.scope = s.v;
            opt.textContent = s.label;
            opt.addEventListener('click', () => { closeScope(); if (scope !== s.v) { scope = s.v; paintScope(); submit(); } });
            scopeList.appendChild(opt);
        });
        scopeBtn.addEventListener('click', e => {
            e.stopPropagation();
            const willOpen = scopeList.hidden;
            scopeList.hidden = !willOpen;
            scopeBtn.classList.toggle('open', willOpen);
        });
        document.addEventListener('click', e => { if (!e.target.closest || !e.target.closest('#smg-rs-panel .smg-search-scope')) closeScope(); });

        // ORDENAR — chip-toggle relevância ⇄ data; trocar aplica na hora (é o &o=date da URL)
        function paintOrder() {
            const lbl = i18n(orderDate ? 'Date' : 'Relevance');
            orderCur.textContent = lbl;
            const tip = i18n('Order by') + ' ' + lbl.toLowerCase() + ' — ' + i18n('click to toggle');
            orderBtn.title = tip; orderBtn.setAttribute('aria-label', tip);
        }
        orderBtn.addEventListener('click', () => { orderDate = !orderDate; paintOrder(); submit(); });

        // SÓ TÍTULOS — switch; trocar aplica na hora
        function paintTitles() { titlesSw.classList.toggle('on', titlesOn); titlesSw.setAttribute('aria-checked', titlesOn ? 'true' : 'false'); }
        titlesSw.addEventListener('click', () => { titlesOn = !titlesOn; paintTitles(); submit(); });

        // AUTOR — ícone 👤 revela o campo (aplica no Enter/Buscar)
        function syncAuthor() { authorBtn.classList.toggle('has-value', !!byInput.value.trim()); }
        authorBtn.addEventListener('click', () => {
            const willOpen = authorWrap.hidden;
            authorWrap.hidden = !willOpen;
            authorBtn.classList.toggle('open', willOpen);
            if (willOpen) byInput.focus();
        });
        byInput.addEventListener('input', syncAuthor);
        if (by0) { authorWrap.hidden = false; authorBtn.classList.add('open'); }

        [qInput, byInput].forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }));
        panel.querySelector('.smg-search-go').addEventListener('click', submit);

        paintScope(); paintOrder(); paintTitles(); syncAuthor();

        // monta logo abaixo da linha de termos do header (ou do título, se ela não existir)
        const anchor = header.querySelector('.p-description') || header.querySelector('.p-title');
        if (anchor) anchor.insertAdjacentElement('afterend', panel);
        else header.appendChild(panel);
        i18nDom(panel);
    }

    // =========================================================
    // FEATURE: clicar na imagem abre o modo feed naquela imagem
    // =========================================================

    const absUrl = u => { try { return new URL(u, location.href).href; } catch { return u; } };

    // URL da imagem em resolução cheia: href do <a> (se for imagem) senão o src
    function imageUrlOf(img) {
        const a = img.closest('a');
        const href = a ? (a.getAttribute('href') || '') : '';
        if (/\.(jpe?g|png|gif|webp|avif|bmp)(\?|#|$)/i.test(href)) return absUrl(href);
        // src pode ser um placeholder lazy (data:image/gif base64 1x1) → usa a URL real do data-*
        let src = img.getAttribute('src') || img.src || '';
        if (/^data:/i.test(src)) src = img.getAttribute('data-src') || img.getAttribute('data-url') || img.getAttribute('data-original') || src;
        return absUrl(getBigUrl(src));
    }

    let imageClickBound = false;
    function setupImageClickFeed() {
        if (imageClickBound) return;
        imageClickBound = true;
        // intercepta o clique nas imagens (capture, pra ganhar do lightbox nativo do XenForo)
        document.addEventListener('click', e => {
            if (!e.target.closest) return;
            let img = e.target.closest('img.bbImage');
            if (!img) {
                // imagem ÚNICA (inline) fica dentro de <a href=imagem target=_blank>; o <a> é block e mais largo que a img
                // (centralizada) → clicar na área do <a> ao lado da imagem abria o link. Pega o <a> que embrulha uma bbImage.
                const a = e.target.closest('a');
                if (a && !a.classList.contains('smg-imglink-fallback')) img = a.querySelector('img.bbImage');
                if (!img) return;
            }
            e.preventDefault();
            e.stopPropagation();
            openMediaFeed(imageUrlOf(img));
        }, true);
    }

    // =========================================================
    // FEATURE: modo feed (tiktok) — mídia da thread em tela cheia, snap vertical
    //
    // Mapa interno:
    //   coleta ....... feedEmbedUrl · collectMediaFrom (acha imgs/vídeos/embeds num root)
    //   galeria ...... gal* (galPageUrl/Observe/Tile/Fetch/RenderPage/JumpTo/…) + openGallery/closeGallery
    //   visualizador . openMediaFeed() ← GRANDE: slides, zoom, nav (nextVisible/goTo/advance),
    //                  buildSlide, loadNextPage, mute/filtro, downloadCurrent
    // =========================================================

    // autoplay + mudo nos players suportados (param na URL; o iframe já tem allow="autoplay")
    function feedEmbedUrl(url, muted) {
        try {
            const u = new URL(url);
            const q = new URLSearchParams(u.search);
            if (/redgifs/i.test(u.hostname)) { q.set('autoplay', '1'); q.set('muted', muted ? '1' : '0'); }
            else if (/turbo\.cr/i.test(u.hostname)) { q.set('autoplay', '1'); }      // mute: sem param conhecido
            else if (/imagepond\.net/i.test(u.hostname)) { q.set('autoplay', '1'); } // mute: sem param conhecido
            else if (/youtube|youtu\.be/i.test(u.hostname)) { q.set('autoplay', '1'); q.set('mute', muted ? '1' : '0'); }
            else return url;
            u.search = q.toString();
            return u.toString();
        } catch { return url; }
    }

    // normaliza turbo/saint p/ a URL de embed do TURBO (saint redireciona pro turbo; o Referer da API /sign tem que ser turbo.cr).
    function resolveUrlFor(url) {
        const m = (url || '').match(/(?:turbo\.cr|saint2?\.(?:su|cr))\/embed\/([a-zA-Z0-9_-]+)/i);
        return m ? 'https://turbo.cr/embed/' + m[1] : url;
    }

    // extrai mídia (imagens + embeds) de um documento/elemento — vale na página viva e em páginas buscadas
    function collectMediaFrom(root) {
        const items = [];
        const local = new Set();
        const add = (type, url) => { if (url && !local.has(url)) { local.add(url); items.push({ type, url }); } };

        root.querySelectorAll('img.bbImage, video.smg-rg-v, iframe.saint-iframe, iframe[src*="imagepond.net"], span[data-s9e-mediaembed] iframe, span[data-s9e-mediaembed-iframe], .generic2wide-iframe-div iframe, .generic2wide-iframe-div[onclick*="redgifs"], .bbCodeBlock--unfurl[data-url], a[href*="turbo.cr/"]:not(.smg-turbo-fallback), a[href*="saint.su/"]:not(.smg-turbo-fallback), a[href*="saint2.su/"]:not(.smg-turbo-fallback), a[href*="saint.cr/"]:not(.smg-turbo-fallback), a[href*="saint2.cr/"]:not(.smg-turbo-fallback)').forEach(el => {
            // FORMA CRUA (a galeria re-busca a página do servidor, SEM nosso processamento):
            if (el.matches('span[data-s9e-mediaembed-iframe]')) {   // redgifs = <span data-s9e-mediaembed-iframe='[...,"src","https:\/\/…/ifr/ID"]'> (sem <iframe> nem .generic2wide)
                let arr; try { arr = JSON.parse(el.getAttribute('data-s9e-mediaembed-iframe') || '[]'); } catch (e) { return; }
                const si = arr.indexOf('src'); const src = si >= 0 ? arr[si + 1] : '';
                if (/redgifs\.com\/ifr\/|turbo\.cr\/embed\/|saint2?\.(?:su|cr)/i.test(src)) add('embed', src);
                return;
            }
            if (el.matches('.bbCodeBlock--unfurl[data-url]')) {   // turbo/saint = card unfurl com data-url REAL (o <a> é um /goto base64). bunkr/pixeldrain caem aqui e são IGNORADOS (regex só turbo/saint).
                const u = el.getAttribute('data-url') || '';
                const t = u.match(/turbo\.cr\/embed\/([a-zA-Z0-9_-]+)/i);
                if (t) { add('embed', 'https://turbo.cr/embed/' + t[1]); return; }
                const s = u.match(/(saint2?\.(?:su|cr))\/(?:embed\/)?([a-zA-Z0-9_-]+)/i);
                if (s) add('embed', 'https://' + s[1] + '/embed/' + s[2]);
                return;
            }
            if (el.tagName === 'IMG') {
                add('image', imageUrlOf(el));
            } else if (el.tagName === 'VIDEO') {   // nosso player já montado: redgifs pelo id; turbo (Simp nativo) pelo _rgFeed
                if (el.dataset.rgid) add('embed', 'https://www.redgifs.com/ifr/' + el.dataset.rgid);
                else if (el._rgFeed) add('embed', el._rgFeed);
            } else if (el.tagName === 'IFRAME') {
                add('embed', absUrl(el.getAttribute('src') || ''));
            } else if (el.tagName === 'A') {   // link cru de turbo/saint (ex.: páginas buscadas pela galeria, onde o iframe ainda não foi montado)
                const href = el.getAttribute('href') || '';
                if (/turbo\.cr\/a\//i.test(href)) return;   // turbo.cr/a/ = álbum (galeria), não vídeo único → não embeda
                const t = href.match(/turbo\.cr\/(?:[^/?#]+\/)*([a-zA-Z0-9_-]+)/i);
                if (t) { add('embed', 'https://turbo.cr/embed/' + t[1]); return; }
                const s = href.match(/(saint2?\.(?:su|cr))\/(?:[^/?#]+\/)*([a-zA-Z0-9_-]+)/i);
                if (s) add('embed', 'https://' + s[1] + '/embed/' + s[2]);
            } else { // div de redgifs ainda não carregado: pega o id do onclick
                if (el.querySelector('iframe')) return;
                const m = (el.getAttribute('onclick') || '').match(/redgifs\.com\/ifr\/([a-zA-Z0-9_-]+)/i);
                if (m) add('embed', 'https://www.redgifs.com/ifr/' + m[1]);
            }
        });
        return items;
    }

    // AVISO ÚNICO (1ª vez que abre galeria/feed pela dock/header): esses modos têm navegação PRÓPRIA —
    // começam na página 1 da thread e paginam toda a mídia, separados de onde você está lendo.
    // Salva a flag no GM/localStorage → nunca mais reaparece.
    function showNavModeNotice() {
        if (gmGet('smg-navmode-notice', '0') === '1') return;
        if (document.getElementById('smg-navnotice')) return;
        const ov = document.createElement('div');
        ov.id = 'smg-navnotice';
        ov.innerHTML =
            '<div class="smg-navnotice-card">' +
                '<div class="smg-navnotice-title">' + i18n('Gallery and Feed') + '</div>' +
                '<div class="smg-navnotice-text">' + i18n('Gallery and Feed browse the whole thread with their own pagination — they start at page 1 and page through all the media, independently of where you are reading. Use their own pager and sort.') + '</div>' +
                '<button type="button" class="smg-navnotice-ok">' + i18n('Got it') + '</button>' +
            '</div>';
        document.body.appendChild(ov);
        const close = () => { gmSet('smg-navmode-notice', '1'); ov.remove(); };
        ov.querySelector('.smg-navnotice-ok').addEventListener('click', close);
        ov.addEventListener('click', e => { if (e.target === ov) close(); });   // clicar no scrim também fecha
    }

    // GALERIA: overlay (igual o feed) com a mídia da thread numa grade masonry + SCROLL INFINITO próprio
    // (puxa as próximas páginas da thread) + header com "ir ao topo" e ordenar (data/reações).
    // Clicar num tile abre o feed naquele item (por cima). Reusa collectMediaFrom + openMediaFeed.
    let galState = null;
    let galDockSortBtn = null, galDockGotoBtn = null;   // botões da dock da galeria (criados 1x) — re-sincronizados a cada abertura
    // sort = UM botão toggle, IGUAL ao btnSort da thread: o ícone alterna data⇄reações conforme galState.order
    function galSyncSortBtn() {
        if (!galDockSortBtn || !galState) return;
        const isDate = galState.order === 'date';
        setBtnIcon(galDockSortBtn, isDate ? ICONS.sortDate : ICONS.star);
        setBtnLabel(galDockSortBtn, isDate ? 'Sort by date' : 'Sort by reactions');
        const t = galDockSortBtn.querySelector('.smg-nav-btn-text');   // texto visível: deixa claro PELO QUÊ está ordenado
        if (t) t.textContent = i18n(isDate ? 'Date' : 'Reactions');
    }
    // PERSISTÊNCIA do modo na URL (query param) → F5 reabre galeria/feed em vez de cair na thread.
    // replaceState (não polui o histórico). Params: view=gallery|feed · order=date|reaction (sort da galeria).
    // SEM página: a galeria sempre reabre na página 1 (restaurar página quebrava a paginação no F5).
    function smgSetNavParam(view, order) {
        try {
            const u = new URL(location.href);
            if (view) {
                u.searchParams.set('view', view);
                if (order) u.searchParams.set('order', order); else u.searchParams.delete('order');
            } else {
                u.searchParams.delete('view'); u.searchParams.delete('order');
            }
            history.replaceState(history.state, '', u.toString());
        } catch (e) {}
    }
    // no boot (e em cada pass até a thread montar): se a URL pede um modo, reabre. Roda 1x só.
    let smgNavRestored = false;
    function restoreNavMode() {
        if (smgNavRestored || !document.documentElement.classList.contains('smg-thread')) return;
        smgNavRestored = true;
        const p = new URLSearchParams(location.search);
        const v = p.get('view');
        if (v === 'gallery') openGallery(p.get('order'));
        else if (v === 'feed') openMediaFeed(null, null, { fromStart: true });
    }
    function galPageUrl(n, order) {
        let b = location.pathname.replace(/\/page-\d+/, '').replace(/\/(unread|latest)$/, '');
        if (!b.endsWith('/')) b += '/';
        return b + (n > 1 ? 'page-' + n : '') + (order === 'reaction' ? '?order=reaction_score' : '');
    }
    let galIO = null;
    function galObserve(tile) {   // carrega o preview do tile (iframe c/ poster) só quando entra na viewport
        if (!galIO) galIO = makeLazyIO(el => { if (el._galLoad) el._galLoad(); }, { rootMargin: '600px 0px' });
        if (galIO) galIO.observe(tile); else if (tile._galLoad) tile._galLoad();   // sem IO no browser → carrega na hora
    }
    function galTile(it, page) {
        const tile = document.createElement('div');
        tile.className = 'smg-gallery-tile smg-gallery-tile--' + it.type;
        tile.dataset.page = page;
        if (it.type === 'image') {
            tile.classList.add('is-loading');   // shimmer até a imagem pintar (some no load/erro)
            const img = document.createElement('img');
            img.loading = 'lazy'; img.alt = '';
            const full = it.url, med = getMedUrl(full);   // TILE = médio (perf); o feed abre o FULL no clique (alta)
            const done = () => tile.classList.remove('is-loading');
            img.addEventListener('load', done);
            img.addEventListener('error', () => { if (med !== full && img.src !== full) img.src = full; else done(); });   // médio 404 → tenta o full; full falhou → tira o shimmer
            img.src = med;
            if (img.complete && img.naturalWidth) done();   // já em cache → sem shimmer preso
            tile.appendChild(img);
            tile.addEventListener('click', () => openMediaFeed(full, galState && galState.items));
        } else {
            // vídeo: placeholder → carrega o player (preview/poster) ao entrar na viewport · toca inline · botão maximizar abre no feed
            tile.innerHTML = '<span class="smg-gallery-play">' + svgIcon('<polygon points="6 3 20 12 6 21 6 3"/>') + '</span>';
            const maxBtn = document.createElement('button');
            maxBtn.type = 'button'; maxBtn.className = 'smg-gallery-max';
            maxBtn.title = i18n('Expand'); maxBtn.setAttribute('aria-label', i18n('Expand'));
            maxBtn.innerHTML = svgIcon('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>');
            maxBtn.addEventListener('click', e => { e.stopPropagation(); openMediaFeed(it.url, galState && galState.items); });
            tile.appendChild(maxBtn);
            tile._galLoad = () => {
                if (tile.dataset.loaded) return;
                tile.dataset.loaded = '1';
                const ph = tile.querySelector('.smg-gallery-play'); if (ph) ph.remove();
                const toIframe = () => { if (!tile.isConnected || tile.querySelector('.smg-rg, iframe')) return; tile.insertBefore(buildTurboIframe(it.url), maxBtn); };
                // tile ganha o aspect REAL do vídeo (vertical = tile alto, não esmagado em 16:9)
                const fitTile = video => video.addEventListener('loadedmetadata', () => { if (video.videoWidth && video.videoHeight) tile.style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight; }, { once: true });
                const rid = (FEATURES.redgifsPlayer && GMX) ? rgIdFrom(it.url) : null;
                if (rid) {   // redgifs → NOSSO player (autoplay-off, igual ao inline)
                    const { wrap, video } = rgBuild(rid);
                    tile.insertBefore(wrap, maxBtn);
                    fitTile(video);
                    rgStart(video, true);
                } else if (GMX && FEATURES.turboNativePlayer && /turbo\.cr|saint2?\.(?:su|cr)/i.test(it.url)) {   // turbo/saint → resolve mp4 → NOSSO player; falha → iframe
                    turboResolve(resolveUrlFor(it.url), mp4 => {
                        if (!tile.isConnected || tile.querySelector('.smg-rg, iframe')) return;
                        if (!mp4) { toIframe(); return; }
                        const { wrap, video } = buildNativeVideo(mp4, 'https://turbo.cr/', toIframe, /saint/i.test(it.url) ? 'Saint' : 'Turbo');
                        video._rgExt = it.url; video._rgFeed = it.url;
                        tile.insertBefore(wrap, maxBtn);
                        fitTile(video);   // fallback: aspect REAL no metadata (dispara no play)
                        // POSTER-ONLY (igual ao inline): zero bytes de vídeo até o play. rgStartUrl streamava
                        // metadata de CADA tile que cruzava o IO — rolar 200 tiles enfileirava 200 loads que
                        // nunca eram liberados (turbo não solta o src). O aspect do tile vem do poster.
                        const poster = turboPoster(mp4);
                        if (poster) { const pi = new Image(); pi.onload = () => { if (pi.naturalWidth && tile.isConnected) tile.style.aspectRatio = pi.naturalWidth + ' / ' + pi.naturalHeight; }; pi.src = poster; }
                        rgPrepareUrl(video, mp4, wrap, poster);
                    });
                } else {   // imagepond/youtube/etc → iframe (não temos player nativo)
                    toIframe();
                }
            };
            galObserve(tile);
        }
        return tile;
    }
    // tiles-fantasma (shimmer) com alturas variadas — reservam espaço enquanto a página carrega
    const GAL_SKEL_H = [115, 70, 145, 95, 62, 128, 88, 108, 78];
    function galSkelTile(i) {
        const t = document.createElement('div');
        t.className = 'smg-gallery-skel';
        t.style.paddingTop = GAL_SKEL_H[i % GAL_SKEL_H.length] + '%';   // altura via padding-% (relativo à largura da coluna)
        return t;
    }
    function galMakeSection(n, skel) {
        const sec = document.createElement('div');
        sec.className = 'smg-gallery-page' + (skel ? ' is-skel' : '');
        sec.dataset.page = n;
        sec.innerHTML = '<div class="smg-gallery-pagehdr"><span>' + i18n('Page') + ' ' + n + '</span></div>';   // separador "Page N" — rola junto (NÃO é sticky)
        const cols = document.createElement('div');
        cols.className = 'smg-gallery-cols';
        sec.appendChild(cols);
        return sec;
    }
    // muta o scroller mantendo `keep` visualmente fixo (corrige scrollTop pela variação de altura acima dele) → sem "pulo"
    function galKeepStable(keep, mutate) {
        const sc = galState.scroller;
        if (!keep || !keep.isConnected) { mutate(); return; }
        const before = keep.getBoundingClientRect().top;
        mutate();
        sc.scrollTop += keep.getBoundingClientRect().top - before;
    }
    // retorna true se ADICIONOU mídia nova (o galFetch usa isso: página vazia → pula direto pra próxima)
    function galRenderPage(doc, n, where, sec) {
        if (!galState || !sec || !sec.isConnected) return false;   // jump/close cancelou esta busca
        const fresh = collectMediaFrom(doc).filter(it => !galState.seen.has(it.url));
        fresh.forEach(it => galState.seen.add(it.url));
        if (!fresh.length) {   // página sem mídia nova → tira o skeleton (preservando a posição)
            galKeepStable(where === 'prepend' ? sec.nextElementSibling : null, () => sec.remove());
            if (!galState.scroller.querySelector('.smg-gallery-page'))
                galState.scroller.innerHTML = '<div class="smg-gallery-empty">' + i18n('No media on this page') + '</div>';
            return false;
        }
        const cols = sec.querySelector('.smg-gallery-cols');
        const frag = document.createDocumentFragment();
        fresh.forEach(it => frag.appendChild(galTile(it, n)));
        // troca skeleton → real sem "pulo": no append ancora no topo da própria seção (preenche p/ baixo);
        // no prepend a seção está ACIMA da viewport → ancora no que vem ABAIXO dela (o que se está lendo)
        const keep = where === 'prepend' ? sec.nextElementSibling : sec;
        galKeepStable(keep, () => { cols.innerHTML = ''; cols.appendChild(frag); sec.classList.remove('is-skel'); });
        galState.items = where === 'prepend' ? fresh.concat(galState.items) : galState.items.concat(fresh);
        return true;
    }
    // carrega a PRÓXIMA página enquanto o paginador disser que tem (hasMore). Encadeado no .then do galFetch →
    // percorre TODAS as páginas da thread automaticamente (páginas vazias no meio são atravessadas). Sem piso por
    // itens nem por altura (heurísticas que travavam): a fonte de verdade é o "Next" do paginador.
    function galEnsureFilledDown() {
        if (!galState || galState.loading || !galState.hasMore || galState.hi >= 300) return;   // 300 = backstop anti-runaway
        galFetch(galState.hi + 1, 'append');
    }
    // ainda não há ~3 telas de conteúdo abaixo do ponto de leitura → vale pré-buscar a próxima página
    function galNeedMoreBelow() {
        const sc = galState && galState.scroller;
        return !!sc && (sc.scrollHeight - sc.scrollTop - sc.clientHeight) < sc.clientHeight * 3;
    }
    // tem próxima página? segue o link "Next" do paginador (IGUAL ao infinite scroll da thread) — presente em
    // toda página menos a última. É a fonte de verdade pra "pode buscar mais": NÃO depende de parsear o total
    // (que vinha errado e travava). Funciona em /page-N, ?page=N, etc.
    function galHasNext(doc) {
        return !!doc.querySelector('.pageNav-jump--next, .pageNavSimple-el--next');
    }
    // total de páginas (SÓ pro display do goto "of N pages") — duas fontes; não trava mais o fetch.
    function galMaxFromDoc(doc) {
        let max = 0;
        doc.querySelectorAll('.pageNav a[href], .pageNavSimple a[href]').forEach(a => {
            const m = (a.getAttribute('href') || '').match(/\/page-(\d+)/);
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        const cur = doc.querySelector('.pageNavSimple-el--current');
        const sm = cur && cur.textContent.match(/(\d+)\D+(\d+)/);   // "1 of 30" / "1 de 30" / "1 / 30" → pega o 2º nº
        if (sm) max = Math.max(max, parseInt(sm[2], 10) || 0);
        const inp = doc.querySelector('[data-xf-init="page-jump"] input[type="number"]');
        const im = inp && parseInt(inp.getAttribute('max') || '', 10);
        if (im) max = Math.max(max, im);
        return max;
    }
    function galFetch(n, where) {
        if (!galState || galState.loading || n < 1) return;   // sem teto por max: quem decide "tem mais" é o paginador (hasMore)
        galState.loading = true;
        const gen = galState.gen;
        const sc = galState.scroller;
        const empty = sc.querySelector('.smg-gallery-empty'); if (empty) empty.remove();
        // skeleton imediato, na MESMA posição da seção real → reserva espaço + dá feedback durante o fetch
        const sec = galMakeSection(n, true);
        const cols = sec.querySelector('.smg-gallery-cols');
        for (let i = 0; i < 9; i++) cols.appendChild(galSkelTile(i));
        if (where === 'prepend') { galKeepStable(sc.firstElementChild, () => sc.insertBefore(sec, sc.firstChild)); galState.lo = n; }
        else { sc.appendChild(sec); galState.hi = Math.max(galState.hi, n); }
        galUpdatePager();
        fetchDoc(galPageUrl(n, galState.order), { credentials: 'same-origin' })   // SEM X-Requested-With: garante a página COMPLETA (com paginador), igual ao infinite scroll
            .then(doc => {
                if (!galState || galState.gen !== gen) return;   // jump/close no meio do caminho
                galState.hasMore = galHasNext(doc);   // FONTE DE VERDADE: o paginador desta página tem "Next"?
                // max é só pro display do goto: o maior entre paginação do doc, DOM vivo e a página atual descoberta.
                galState.max = Math.max(galState.max, galMaxFromDoc(doc) || 0, (readPageJump() || {}).max || 0, galState.hi + (galState.hasMore ? 1 : 0));
                const added = galRenderPage(doc, n, where, sec);   // renderiza (ou remove a seção se a página não tiver mídia nova)
                galState.loading = false;
                galUpdatePager();
                // append → encadeia a PRÓXIMA: SEMPRE através de página vazia (não adiciona altura, o scroll
                // não retomaria), e com mídia só enquanto faltar ~3 telas abaixo — o handler de scroll (<900px)
                // retoma sob demanda. Antes encadeava INCONDICIONAL: abrir a galeria baixava+parseava a thread
                // INTEIRA (até 300 fetches sequenciais, centenas de MB), com o usuário parado na página 1.
                if (where === 'append' && (!added || galNeedMoreBelow())) galEnsureFilledDown();
            })
            .catch(() => {
                if (!galState || galState.gen !== gen) return;
                galState.loading = false;
                if (sec.isConnected) galKeepStable(where === 'prepend' ? sec.nextElementSibling : null, () => sec.remove());
                if (where === 'prepend') galState.lo = n + 1; else if (galState.hi === n) galState.hi = n - 1;   // libera p/ tentar de novo no próximo scroll
            });
    }
    function galJumpTo(n) {
        if (!galState) return;
        n = Math.max(1, Math.min(galState.max, n));
        if (galIO) galIO.disconnect();   // larga os tiles de vídeo observados (evita refs presas a nós removidos)
        galState.gen++; galState.seen = new Set(); galState.items = []; galState.loading = false; galState.hasMore = true;
        galState.scroller.innerHTML = ''; galState.scroller.scrollTop = 0;
        galState.lo = n; galState.hi = n - 1;   // hi = n-1 → galFetch(n,'append') seta hi=n
        galFetch(n, 'append');
    }
    function galUpdatePager() {
        if (!galState) return;
        // página real = a última seção cujo cabeçalho está no topo (ou acima) da viewport
        const ref = galState.scroller.getBoundingClientRect().top + 56;
        let page = galState.lo;
        // seções em ordem no DOM (top crescente) → a 1ª cujo top passa de ref fixa a página: corta cedo
        // em vez de medir as seções abaixo da viewport a cada frame de scroll da galeria.
        const secs = galState.scroller.querySelectorAll('.smg-gallery-page');
        for (let i = 0; i < secs.length; i++) {
            if (secs[i].getBoundingClientRect().top <= ref) page = parseInt(secs[i].dataset.page, 10) || page;
            else break;
        }
        galState.viewPage = page;
        if (galDockGotoBtn) setBtnIcon(galDockGotoBtn, String(page));   // nº da página DENTRO do botão goto (igual à thread)
    }
    function galSetOrder(order) {
        if (!galState || galState.order === order) return;
        galState.order = order;
        galSyncSortBtn();   // troca o ícone/label do botão toggle (data⇄reações)
        smgSetNavParam('gallery', order);   // persiste a ordem na URL (F5 mantém)
        galJumpTo(1);   // nova ordem → volta pra página 1 e pro topo (não faz sentido manter a página atual numa ordem diferente)
    }
    function closeGallery() {
        const gal = document.getElementById('smg-gallery');
        if (gal) gal.classList.remove('open');
        smgSetNavParam(null);   // saiu pro thread → limpa a URL
        if (galIO) galIO.disconnect();   // solta os tiles de vídeo observados (sem isso, nós removidos ficam presos no IO)
        // esvazia a grade AGORA (reabrir reconstrói da pág. 1 de qualquer jeito): manter milhares de tiles +
        // <video> com src vivo num DOM display:none segurava dezenas/centenas de MB até a próxima abertura
        const grid = gal && gal.querySelector('.smg-gallery-grid');
        if (grid) { grid.querySelectorAll('video.smg-rg-v').forEach(rgDispose); grid.innerHTML = ''; }
        rgReleaseDetachedBlobs();
        galState = null;
        const feed = document.getElementById('smg-feed');
        if (!(feed && feed.classList.contains('open'))) document.documentElement.style.overflow = '';
    }
    function openGallery(order) {
        showNavModeNotice();   // aviso único: galeria/feed têm navegação própria (página 1, sort próprio)
        let gal = document.getElementById('smg-gallery');
        if (!gal) {
            gal = document.createElement('div');
            gal.id = 'smg-gallery';
            // SEM barra superior: a grade ocupa tudo. Controles numa DOCK flutuante embaixo, IDÊNTICA à da thread:
            // mesmos botões (makeDockButton/.smg-nav-btn), MESMO sort TOGGLE (data⇄reações no MESMO botão),
            // MESMA paginação (prev · goto-com-nº · next, ícones ICONS.pagePrev/pageNext) e MESMO stepper de "ir pra página".
            // + um botão Fechar à direita (label visível). Só a fiação muda: pagina/ordena a GALERIA, não a thread.
            gal.innerHTML = '<div class="smg-gallery-grid"></div>';
            const gdock = document.createElement('div'); gdock.className = 'smg-gallery-dock';
            const gpanel = document.createElement('div'); gpanel.className = 'smg-gallery-dock-panel';

            const gSort = makeDockButton({ id: 'smg-gal-sort', icon: ICONS.sortDate, label: 'Sort by date' });   // 1 botão toggle (= btnSort), pílula com texto do critério
            gSort.classList.add('smg-nav-labeled');
            gSort.appendChild(Object.assign(document.createElement('span'), { className: 'smg-nav-btn-text' }));
            const gPrev = makeDockButton({ id: 'smg-gal-prev', icon: ICONS.pagePrev, label: 'Prev page' });
            const gGoto = makeDockButton({ id: 'smg-gal-goto', icon: '1', label: 'Go to page' });                // mostra o nº da página (= btnGoto)
            const gNext = makeDockButton({ id: 'smg-gal-next', icon: ICONS.pageNext, label: 'Next page' });
            galDockSortBtn = gSort; galDockGotoBtn = gGoto;

            const gClose = makeDockButton({ id: 'smg-gal-close', icon: ICONS.close, label: 'Close' });
            gClose.classList.add('smg-gallery-close'); gClose.removeAttribute('data-label');   // label fica VISÍVEL (não tooltip)
            gClose.appendChild(Object.assign(document.createElement('span'), { className: 'smg-gallery-close-label', textContent: i18n('Close') }));

            const gnav = makeGroup(gSort, gPrev, gGoto, gNext);   // MESMO grupo único da thread (sort + pagenav juntos, 6px)
            gpanel.append(gnav, makeDivider(), gClose);

            // stepper "ir pra página" — MESMA estrutura/classes do #smg-goto-pop da thread (só o container é próprio)
            const gGotoPop = document.createElement('div');
            gGotoPop.className = 'smg-gallery-goto-pop';
            gGotoPop.innerHTML =
                '<span class="smg-goto-title">Go to page</span>' +
                '<div class="smg-goto-stepper">' +
                    '<button type="button" class="smg-goto-step" data-dir="-1" aria-label="Decrease">−</button>' +
                    '<input type="number" class="smg-goto-input" min="1" value="1">' +
                    '<button type="button" class="smg-goto-step" data-dir="1" aria-label="Increase">+</button>' +
                '</div>' +
                '<span class="smg-goto-max"></span>' +
                '<button type="button" class="smg-goto-btn">Go</button>';

            gdock.append(gpanel, gGotoPop);
            gal.appendChild(gdock);
            document.body.appendChild(gal);
            i18nDom(gal);

            // sort: alterna data⇄reações (galSetOrder recarrega na nova ordem; galSyncSortBtn troca o ícone)
            gSort.addEventListener('click', () => { if (galState) galSetOrder(galState.order === 'date' ? 'reaction' : 'date'); });
            // paginação: prev/next pulam 1 página
            gPrev.addEventListener('click', () => galJumpTo((galState ? (galState.viewPage || galState.lo) : 1) - 1));
            gNext.addEventListener('click', () => galJumpTo((galState ? (galState.viewPage || galState.lo) : 1) + 1));

            // goto stepper (idêntico ao da thread; pula via galJumpTo na própria galeria)
            const gIn = gGotoPop.querySelector('.smg-goto-input');
            const gMax = gGotoPop.querySelector('.smg-goto-max');
            const galClamp = n => { if (!n || n < 1) n = 1; const mx = galState ? galState.max : 1; if (mx && n > mx) n = mx; return n; };
            const galCloseGoto = () => gdock.classList.remove('goto-open');
            const galOpenGoto = () => {
                const mx = galState ? galState.max : 1;
                gIn.max = mx || '';
                gIn.value = galState ? (galState.viewPage || galState.lo) : 1;
                gMax.textContent = mx ? 'of ' + mx + ' pages' : '';
                gdock.classList.add('goto-open');
                setTimeout(() => { gIn.focus(); gIn.select(); }, 0);
            };
            const galDoGoto = () => { galJumpTo(galClamp(parseInt(gIn.value, 10))); galCloseGoto(); };
            gGoto.addEventListener('click', e => { e.stopPropagation(); if (gdock.classList.contains('goto-open')) galCloseGoto(); else galOpenGoto(); });
            gGotoPop.querySelectorAll('.smg-goto-step').forEach(b => b.addEventListener('click', () => { gIn.value = galClamp((parseInt(gIn.value, 10) || 1) + parseInt(b.dataset.dir, 10)); }));
            gIn.addEventListener('change', () => { gIn.value = galClamp(parseInt(gIn.value, 10)); });
            gGotoPop.querySelector('.smg-goto-btn').addEventListener('click', galDoGoto);
            gIn.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); galDoGoto(); }
                else if (e.key === 'Escape') { e.stopPropagation(); galCloseGoto(); }
            });
            document.addEventListener('click', e => {   // clique-fora fecha o goto
                if (!gdock.classList.contains('goto-open')) return;
                if (gGotoPop.contains(e.target) || gGoto.contains(e.target)) return;
                galCloseGoto();
            });

            gClose.addEventListener('click', closeGallery);
            document.addEventListener('keydown', e => {   // Esc: fecha o goto primeiro; senão a galeria (se o feed estiver POR CIMA, ele trata)
                if (e.key !== 'Escape' || !gal.classList.contains('open')) return;
                const fd = document.getElementById('smg-feed');
                if (fd && fd.classList.contains('open')) return;
                if (gdock.classList.contains('goto-open')) { galCloseGoto(); return; }
                closeGallery();
            });
            const sc = gal.querySelector('.smg-gallery-grid');
            let galRaf = 0;
            sc.addEventListener('scroll', () => {
                if (galRaf) return;
                galRaf = requestAnimationFrame(() => {
                    galRaf = 0;
                    if (!galState) return;
                    if (galState.hasMore && sc.scrollHeight - (sc.scrollTop + sc.clientHeight) < 900) galFetch(galState.hi + 1, 'append');   // desce → próxima (se houver)
                    if (sc.scrollTop < 500 && galState.lo > 1) galFetch(galState.lo - 1, 'prepend');                     // sobe → anterior
                    galUpdatePager();
                });
            }, { passive: true });
        }
        const scroller = gal.querySelector('.smg-gallery-grid');
        const head = gal.querySelector('.smg-gallery-dock-panel');
        scroller.innerHTML = '';   // o galFetch insere o skeleton na hora (sem flash de "sem mídia")
        const pj = readPageJump();
        order = (order === 'reaction') ? 'reaction' : 'date';   // sort PRÓPRIO ('date' default); restaurado do ?order= no F5
        const cur = 1;             // SEMPRE página 1 (restaurar a página quebrava a paginação no F5 → percorre tudo desde o começo)
        const max = pj ? pj.max : 1;   // galMaxFromDoc + readPageJump corrigem no 1º fetch
        galState = { scroller, head, seen: new Set(), items: [], loading: false, hasMore: true, order, lo: cur, hi: cur - 1, max, viewPage: cur, gen: 0 };
        galSyncSortBtn();          // a dock é criada 1x → sincroniza o toggle com a ordem (data/reações) a cada abertura
        if (galDockGotoBtn) setBtnIcon(galDockGotoBtn, String(cur));
        galFetch(cur, 'append');   // página 1; o scroll/ensure puxam as próximas (pra baixo)
        gal.classList.add('open');
        document.documentElement.style.overflow = 'hidden';
        smgSetNavParam('gallery', order);   // F5 reabre a galeria com a mesma ordem
    }

    // baixa a mídia de um slide do feed (imagem via GM_download c/ fallback de aba; embed = abre o player externo).
    // separado do controller porque só depende do elemento do slide.
    function downloadSlide(s) {
        if (!s) return;
        const img = s.querySelector('.smg-feed-media');
        const emb = s.querySelector('.smg-feed-embed');
        if (img) {
            const url = img.dataset.src || img.src;
            if (!url) return;
            const name = (url.split('/').pop() || 'image').split(/[?#]/)[0] || 'image';
            if (typeof GM_download === 'function') {
                try {
                    GM_download({ url, name, onerror: () => window.open(url, '_blank', 'noopener'), ontimeout: () => window.open(url, '_blank', 'noopener') });
                    return;
                } catch {}
            }
            window.open(url, '_blank', 'noopener');
        } else if (emb) {
            window.open(emb.dataset.src, '_blank', 'noopener'); // player externo: baixe de lá
        }
    }

    function openMediaFeed(startUrl, mediaList, opts) {
        opts = opts || {};
        // DOCK/HEADER → feed com navegação PRÓPRIA: começa da página 1 da thread (não de onde você está lendo).
        // Se não estamos na página 1, busca-a antes e reabre semeando com ela (paginando daí pra frente).
        if (opts.fromStart && !mediaList && !opts.seed) {
            smgSetNavParam('feed');   // F5 reabre o feed (dock/header). Feed por clique em imagem é transitório (não persiste).
            showNavModeNotice();
            const pj0 = readPageJump();
            if (pj0 && pj0.cur > 1) {
                fetchDoc(pj0.tpl.replace('%page%', '1'), { credentials: 'same-origin' })
                    .then(doc => openMediaFeed(null, null, { seed: collectMediaFrom(doc), startPage: 1 }))
                    .catch(() => openMediaFeed(null, null, { seed: collectMediaFrom(document), startPage: pj0.cur }));
                return;
            }
            opts.startPage = 1;   // já na página 1 (ou thread de página única) → segue normal
        }
        // shell criado uma vez; os listeners persistentes falam com feed._ctrl (setado a cada abertura)
        let feed = document.getElementById('smg-feed');
        if (!feed) {
            feed = document.createElement('div');
            feed.id = 'smg-feed';
            feed.innerHTML =
                '<button class="smg-feed-close" type="button" aria-label="Close">' + ICONS.close + '</button>' +
                '<div class="smg-feed-tools">' +
                    '<button class="smg-feed-tool smg-feed-filter" type="button" aria-label="Filter media">' + ICONS.layers + '</button>' +
                    '<button class="smg-feed-tool smg-feed-mute" type="button" aria-label="Sound">' + ICONS.volumeMute + '</button>' +
                    '<button class="smg-feed-tool smg-feed-download" type="button" aria-label="Download" title="Download">' + ICONS.download + '</button>' +
                '</div>' +
                '<button class="smg-feed-nav smg-feed-prev" type="button" aria-label="Previous">' + svgIcon('<path d="m18 15-6-6-6 6"/>') + '</button>' +
                '<button class="smg-feed-nav smg-feed-next" type="button" aria-label="Next">' + svgIcon('<path d="m6 9 6 6 6-6"/>') + '</button>' +
                '<div class="smg-feed-counter"></div>' +
                '<div class="smg-feed-track"><div class="smg-feed-reel"></div></div>' +
                '<button class="smg-feed-striparrow smg-feed-striparrow--prev" type="button" aria-label="Previous">' + svgIcon('<path d="m15 18-6-6 6-6"/>') + '</button>' +
                '<div class="smg-feed-strip"></div>' +
                '<button class="smg-feed-striparrow smg-feed-striparrow--next" type="button" aria-label="Next">' + svgIcon('<path d="m9 18 6-6-6-6"/>') + '</button>';
            document.body.appendChild(feed);
            i18nDom(feed);

            const trackEl = feed.querySelector('.smg-feed-track');

            const closeFeed = () => {
                feed.classList.remove('open');
                const galOpen = document.getElementById('smg-gallery') && document.getElementById('smg-gallery').classList.contains('open');
                if (!galOpen) document.documentElement.style.overflow = '';   // galeria por baixo (feed aberto via tile) continua fullscreen
                const reelEl = feed.querySelector('.smg-feed-reel');
                reelEl.querySelectorAll('video.smg-rg-v').forEach(rgDispose);   // teardown completo dos players antes do wipe
                reelEl.innerHTML = '';
                feed.querySelector('.smg-feed-strip').innerHTML = '';
                feed._ctrl = null;
                rgReleaseDetachedBlobs();   // os <video> do feed saíram do DOM → libera os objectURLs de blob agora
                smgSetNavParam(galOpen ? 'gallery' : null, galOpen && galState ? galState.order : null);   // volta o param pra gallery (se aberta) ou limpa
            };
            feed.querySelector('.smg-feed-close').addEventListener('click', closeFeed);
            feed.querySelector('.smg-feed-prev').addEventListener('click', () => feed._ctrl && feed._ctrl.step(-1));
            feed.querySelector('.smg-feed-next').addEventListener('click', () => feed._ctrl && feed._ctrl.step(1));
            feed.querySelector('.smg-feed-download').addEventListener('click', () => feed._ctrl && feed._ctrl.download());
            feed.querySelector('.smg-feed-mute').addEventListener('click', () => feed._ctrl && feed._ctrl.toggleMute());
            feed.querySelector('.smg-feed-filter').addEventListener('click', () => feed._ctrl && feed._ctrl.cycleFilter());

            // filmstrip (miniaturas) SEMPRE visível por padrão (toggle removido)
            feed.classList.add('strip-open');

            // setas < > de navegação do filmstrip: rolam a fita ~70% da largura; somem nas pontas
            const stripEl = feed.querySelector('.smg-feed-strip');
            const stripPrev = feed.querySelector('.smg-feed-striparrow--prev');
            const stripNext = feed.querySelector('.smg-feed-striparrow--next');
            const updateStripArrows = () => {
                const max = stripEl.scrollWidth - stripEl.clientWidth;
                stripPrev.classList.toggle('is-hidden', stripEl.scrollLeft <= 2);
                stripNext.classList.toggle('is-hidden', max <= 2 || stripEl.scrollLeft >= max - 2);
            };
            feed._updateStripArrows = updateStripArrows;   // o per-open chama após montar os thumbs (setActive)
            stripPrev.addEventListener('click', () => stripEl.scrollBy({ left: -stripEl.clientWidth * 0.7, behavior: 'smooth' }));
            stripNext.addEventListener('click', () => stripEl.scrollBy({ left: stripEl.clientWidth * 0.7, behavior: 'smooth' }));
            let stripRaf = 0;
            stripEl.addEventListener('scroll', () => { if (stripRaf) return; stripRaf = requestAnimationFrame(() => { stripRaf = 0; updateStripArrows(); }); }, { passive: true });

            // roda do mouse → 1 slide por vez, suave
            trackEl.addEventListener('wheel', e => {
                if (!feed._ctrl) return;
                e.preventDefault();
                if (Math.abs(e.deltaY) < 6) return;
                feed._ctrl.step(e.deltaY > 0 ? 1 : -1);
            }, { passive: false });

            document.addEventListener('keydown', e => {
                if (!feed.classList.contains('open')) return;
                if (e.key === 'Escape') closeFeed();
                else if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); feed._ctrl && feed._ctrl.step(1); }
                else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); feed._ctrl && feed._ctrl.step(-1); }
                else if (e.key === 'm') { feed._ctrl && feed._ctrl.toggleMute(); }
                else if (e.key === 'd') { feed._ctrl && feed._ctrl.download(); }
            });

            const setupFeedGestures = () => {
                // gestos touch: pinça (zoom em imagem) · arrasto p/ pan quando ampliada ·
                // swipe vertical p/ navegar · puxar pra baixo no topo fecha
                const dist2 = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
                let mode = null, dragStartY = 0, dragDy = 0, moved = false;
                let pinchStart = 0, pinchBase = 1, panSX = 0, panSY = 0, panBX = 0, panBY = 0;
                const applyZoom = (img, z) => { img.style.transform = 'translate(' + z.x + 'px,' + z.y + 'px) scale(' + z.scale + ')'; };

                trackEl.addEventListener('touchstart', e => {
                    if (!feed._ctrl) return;
                    const img = feed._ctrl.activeImg();
                    const z = img && (img._zoom || (img._zoom = { scale: 1, x: 0, y: 0 }));
                    if (img) img.style.transition = 'none';   // pinch/pan em tempo real (sem o ease do clique)
                    if (e.touches.length === 2 && img) {
                        mode = 'pinch';
                        pinchStart = dist2(e.touches);
                        pinchBase = z.scale;
                    } else if (e.touches.length === 1 && img && z.scale > 1) {
                        mode = 'pan';
                        panSX = e.touches[0].clientX; panSY = e.touches[0].clientY;
                        panBX = z.x; panBY = z.y;
                    } else if (e.touches.length === 1) {
                        mode = 'nav';
                        dragStartY = e.touches[0].clientY; dragDy = 0; moved = false;
                        feed._ctrl.reel.style.transition = 'none';
                    } else {
                        mode = null;
                    }
                }, { passive: true });

                trackEl.addEventListener('touchmove', e => {
                    if (!feed._ctrl || !mode) return;
                    const c = feed._ctrl;
                    if (mode === 'pinch') {
                        const img = c.activeImg();
                        if (!img || e.touches.length < 2) return;
                        const z = img._zoom;
                        z.scale = Math.max(1, Math.min(5, pinchBase * dist2(e.touches) / (pinchStart || 1)));
                        applyZoom(img, z);
                        e.preventDefault();
                    } else if (mode === 'pan') {
                        const img = c.activeImg();
                        if (!img) return;
                        const z = img._zoom;
                        z.x = panBX + (e.touches[0].clientX - panSX);
                        z.y = panBY + (e.touches[0].clientY - panSY);
                        applyZoom(img, z);
                        e.preventDefault();
                    } else { // nav
                        dragDy = e.touches[0].clientY - dragStartY;
                        if (Math.abs(dragDy) > 8) moved = true;
                        let dy = dragDy;
                        if ((c.cur() === 0 && dy > 0) || (c.cur() === c.len() - 1 && dy < 0)) dy *= 0.3; // resistência nas pontas
                        c.reel.style.transform = 'translateY(calc(' + (-c.cur() * 100) + 'vh + ' + dy + 'px))';
                        e.preventDefault();
                    }
                }, { passive: false });

                trackEl.addEventListener('touchend', e => {
                    if (!feed._ctrl) return;
                    const c = feed._ctrl;
                    if (mode === 'pinch' || mode === 'pan') {
                        const img = c.activeImg();
                        if (img && img._zoom && img._zoom.scale <= 1.02) { img._zoom = { scale: 1, x: 0, y: 0 }; img.style.transform = ''; }
                        if (e.touches.length === 0) mode = null;
                        return;
                    }
                    if (mode === 'nav') {
                        mode = null;
                        if (c.cur() === 0 && dragDy >= 110) { closeFeed(); return; } // puxar pra baixo no topo → fecha
                        if (dragDy <= -45) c.advance(1);
                        else if (dragDy >= 45) c.advance(-1);
                        else c.goTo(c.cur());
                    }
                });

                // GRAB (desktop): arrasta a imagem AMPLIADA pra deslizar. Limiar distingue drag de clique → não togla zoom no fim do arrasto.
                let grabbing = false, gMoved = false, gSX = 0, gSY = 0, gBX = 0, gBY = 0, suppressClick = false;
                trackEl.addEventListener('mousedown', e => {
                    if (e.button !== 0) return;
                    suppressClick = false;
                    if (!feed._ctrl) return;
                    const img = feed._ctrl.activeImg(), z = img && img._zoom;
                    if (!img || !z || z.scale <= 1.02) return;   // só desliza quando ampliada
                    grabbing = true; gMoved = false; gSX = e.clientX; gSY = e.clientY; gBX = z.x; gBY = z.y;
                    img.style.transition = 'none'; img.classList.add('smg-grabbing');
                    e.preventDefault();
                });
                window.addEventListener('mousemove', e => {
                    if (!grabbing || !feed._ctrl) return;
                    const img = feed._ctrl.activeImg(), z = img && img._zoom;
                    if (!img || !z) return;
                    const dx = e.clientX - gSX, dy = e.clientY - gSY;
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) gMoved = true;
                    z.x = gBX + dx; z.y = gBY + dy;
                    img.style.transform = 'translate(' + z.x + 'px,' + z.y + 'px) scale(' + z.scale + ')';
                });
                window.addEventListener('mouseup', () => {
                    if (!grabbing) return;
                    grabbing = false;
                    const img = feed._ctrl && feed._ctrl.activeImg();
                    if (img) img.classList.remove('smg-grabbing');
                    if (gMoved) suppressClick = true;   // arrastou → o click seguinte é ignorado (não togla zoom)
                });

                // tap/click: IMAGEM → cicla zoom no ponto clicado · VÍDEO → libera os controles do player
                trackEl.addEventListener('click', e => {
                    if (!feed._ctrl) return;
                    if (moved) { moved = false; return; }                   // foi swipe (touch)
                    if (suppressClick) { suppressClick = false; return; }   // foi grab (mouse)
                    if (!feed._ctrl.toggleZoom(e.clientX, e.clientY)) feed._ctrl.toggleLive();
                });
            };
            setupFeedGestures();
        }

        const reel = feed.querySelector('.smg-feed-reel');
        const counter = feed.querySelector('.smg-feed-counter');
        const prevBtn = feed.querySelector('.smg-feed-prev');
        const strip = feed.querySelector('.smg-feed-strip');
        const muteBtn = feed.querySelector('.smg-feed-mute');
        const filterBtn = feed.querySelector('.smg-feed-filter');

        reel.innerHTML = '';
        strip.innerHTML = '';
        reel.style.transition = 'none';
        reel.style.transform = 'translateY(0)';

        let muted = gmGet('smg-feed-muted', '1') === '1';
        let filterMode = 'all'; // all | image | embed
        const FILTERS = ['all', 'image', 'embed'];
        const FILTER_ICON = { all: ICONS.layers, image: ICONS.typeImage, embed: ICONS.playCircle };
        const FILTER_LABEL = { all: i18n('Filter: all'), image: i18n('Filter: images'), embed: i18n('Filter: videos') };
        setMuteIcon();
        setFilterIcon();

        const initial = mediaList || opts.seed || collectMediaFrom(document);   // galeria → lista própria · dock/header(fromStart) → página 1 buscada · maximizar → página atual
        if (!initial.length) {
            reel.innerHTML = '<div class="smg-feed-slide"><div class="smg-feed-empty">' + i18n('No media on this page') + '</div></div>';
            feed.classList.add('open');
            document.documentElement.style.overflow = 'hidden';
            feed._ctrl = null;
            return;
        }

        const seen = new Set();
        const slides = [];
        const thumbs = [];
        let startSlideIdx = -1;   // índice do startUrl, capturado no buildSlide
        let current = 0;
        let lastActive = -1;   // último slide ativado: setActive só mexe nele + no novo + vizinhos (não em todos os N)
        let animating = false;
        let navTimer;

        // paginação p/ scroll infinito (busca as próximas páginas da thread)
        const pj = readPageJump();
        let loadedPage = opts.startPage || (pj ? pj.cur : 1);   // dock/header(fromStart)=1 · maximizar=página atual
        const maxPage = pj ? pj.max : loadedPage;
        let loadingPage = false;
        const myGen = (feed._gen = (feed._gen || 0) + 1);   // geração desta abertura; loadNextPage abandona fetch de sessão antiga (close+reopen rápido)

        // ---- filtro de mídia (tudo / imagens / vídeos) ----
        const mtypeOf = idx => slides[idx] && slides[idx].dataset.mtype; // 'image' | 'embed'
        const isVisible = idx => filterMode === 'all' || mtypeOf(idx) === filterMode;
        function nextVisible(from, dir) {
            for (let i = from + dir; i >= 0 && i < slides.length; i += dir) if (isVisible(i)) return i;
            return -1;
        }
        function firstVisible() {
            for (let i = 0; i < slides.length; i++) if (isVisible(i)) return i;
            return -1;
        }
        function visibleCount() { let n = 0; for (let i = 0; i < slides.length; i++) if (isVisible(i)) n++; return n; }
        function visiblePos(idx) { let n = 0; for (let i = 0; i <= idx; i++) if (isVisible(i)) n++; return n; }

        // só o slide ativo tem o iframe (perf + autoplay/stop); imagens carregam ±1 slide.
        // toca SÓ os slides afetados — o anterior (limpa embed/is-live/zoom) + o novo + vizinhos do novo —
        // em vez de iterar os N slides a cada navegação. Invariante: só o slide ativo tem conteúdo no embed.
        function setActive(idx) {
            current = Math.max(0, Math.min(slides.length - 1, idx));
            const prev = lastActive;
            lastActive = current;
            [prev, current - 1, current, current + 1].forEach((j, k, arr) => {
                if (j < 0 || j >= slides.length || arr.indexOf(j) !== k) return;   // fora do range, ou índice repetido (já tratado)
                const s = slides[j];
                const emb = s.querySelector('.smg-feed-embed');
                const img = s.querySelector('.smg-feed-media');
                if (emb) {
                    emb.classList.remove('is-live'); // ao navegar, volta pro modo swipe
                    if (j === current && !emb.firstChild) {
                        const rid = (FEATURES.redgifsPlayer && GMX) ? rgIdFrom(emb.dataset.src) : null;
                        if (rid) {   // redgifs → player NOSSO (mp4 HD da API), não o iframe; fallback p/ iframe na falha (rgRestore via _rgFeedHost)
                            const { wrap, video } = rgBuild(rid);
                            wrap._rgFeedHost = emb;
                            video._rgSd = false;   // feed = HD
                            video._rgInFeed = true;   // feed = slide ativo TOCA (autoplay off vale só pro inline)
                            video.muted = muted;
                            emb.appendChild(wrap);
                            rgLoad(video);   // slide ativo → carrega e toca já (sem IO)
                        } else if (GMX && FEATURES.turboNativePlayer && /turbo\.cr|saint2?\.(?:su|cr)/i.test(emb.dataset.src)) {   // turbo/saint → NOSSO player (resolve mp4 async; fallback iframe na falha)
                            const src = emb.dataset.src;
                            const { wrap, video } = buildNativeVideo(src, 'https://turbo.cr/', null, /saint/i.test(src) ? 'Saint' : 'Turbo');
                            wrap._rgFeedHost = emb;
                            video._rgSd = false; video._rgInFeed = true; video.muted = muted;
                            video._rgExt = src; video._rgFeed = src;
                            const toIframe = () => { if (!wrap.isConnected) return; const host = wrap.parentElement; wrap.remove(); const f = document.createElement('iframe'); f.src = feedEmbedUrl(src, muted); f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen'; f.allowFullscreen = true; host.appendChild(f); };
                            wrap._rgFallback = toIframe;
                            emb.appendChild(wrap);   // monta SINCRONO (sem corrida no setActive)
                            turboResolve(resolveUrlFor(src), mp4 => {
                                if (!wrap.isConnected) return;   // navegou → emb foi limpo
                                if (!mp4) { toIframe(); return; }
                                rgLoadUrl(video, mp4, wrap);
                                const play = () => video.play().catch(() => {});
                                video.addEventListener('loadeddata', play, { once: true });
                                video.addEventListener('canplay', play, { once: true });
                            });
                        } else {
                            const f = document.createElement('iframe');
                            f.src = feedEmbedUrl(emb.dataset.src, muted);
                            f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
                            f.allowFullscreen = true;
                            emb.appendChild(f);
                        }
                    } else if (j !== current && emb.firstChild) {
                        emb.querySelectorAll('video.smg-rg-v').forEach(rgDispose);   // teardown (pausa/solta src/poster blob/IOs/Set) ANTES de descartar — senão cada slide visitado deixava um <video> zumbi retido a sessão toda
                        emb.innerHTML = '';
                    }
                }
                if (img) {
                    if (!img.src && Math.abs(j - current) <= 1) img.src = img.dataset.src;
                    if (j !== current && img._zoom) { img._zoom = { scale: 1, x: 0, y: 0 }; img.style.transform = ''; } // reseta zoom ao sair
                }
            });
            if (thumbs[prev]) thumbs[prev].classList.remove('active');
            if (thumbs[current]) thumbs[current].classList.add('active');
            revealActiveThumb();
            if (feed._updateStripArrows) feed._updateStripArrows();   // atualiza as setas < > do filmstrip
            const vc = visibleCount();
            counter.textContent = vc ? (visiblePos(current) + ' / ' + vc) : '0 / 0';
            prevBtn.style.visibility = nextVisible(current, -1) >= 0 ? '' : 'hidden';
            if (current >= slides.length - 3) loadNextPage();
        }

        function revealActiveThumb() {
            const t = thumbs[current];
            if (t && feed.classList.contains('strip-open')) t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        }

        function buildSlide(it) {
            if (seen.has(it.url)) return;
            seen.add(it.url);
            const idx = slides.length;
            if (startUrl && startSlideIdx < 0 && it.url === startUrl) startSlideIdx = idx;   // captura aqui → sem o findIndex+querySelector por slide depois (galeria pode semear MILHARES)

            const slide = document.createElement('div');
            slide.className = 'smg-feed-slide';
            slide.dataset.mtype = it.type; // 'image' | 'embed'

            const thumb = document.createElement('button');
            thumb.type = 'button';
            thumb.className = 'smg-feed-thumb';
            thumb.addEventListener('click', () => goTo(idx));

            if (it.type === 'image') {
                const img = document.createElement('img');
                img.className = 'smg-feed-media';
                img.dataset.src = it.url; // lazy: src setado no setActive
                slide.appendChild(img);

                const ti = document.createElement('img');
                ti.loading = 'lazy';
                ti.src = getMedUrl(it.url);   // tier MÉDIO num tile de 64px (igual galTile): full-res aqui baixava+decodificava MBs por thumb, no meio da transição de slide
                ti.addEventListener('error', () => { if (ti.src !== it.url) ti.src = it.url; }, { once: true });   // host sem .md. → full
                thumb.appendChild(ti);
            } else {
                const emb = document.createElement('div');
                emb.className = 'smg-feed-embed';
                emb.dataset.src = it.url;
                slide.appendChild(emb);

                const badge = document.createElement('span');
                badge.className = 'smg-feed-thumb-embed';
                badge.innerHTML = ICONS.typeVideo;
                thumb.appendChild(badge);
            }

            reel.appendChild(slide);
            slides.push(slide);
            strip.appendChild(thumb);
            thumbs.push(thumb);
            thumb.style.display = isVisible(idx) ? '' : 'none';
        }

        function loadNextPage() {
            if (mediaList || loadingPage || !pj || loadedPage >= maxPage) return;   // seedado pela galeria → não pagina sozinho
            loadingPage = true;
            const next = loadedPage + 1;
            fetchDoc(pj.tpl.replace('%page%', next), { credentials: 'same-origin' })
                .then(doc => {
                    if (feed._gen !== myGen) return;   // feed fechado/reaberto durante o fetch → essa sessão é obsoleta (closure velha)
                    if (!feed.classList.contains('open')) { loadingPage = false; return; }   // usuário fechou no meio → não monta slide órfão
                    collectMediaFrom(doc).forEach(buildSlide);
                    loadedPage = next;
                    loadingPage = false;
                })
                .catch(() => { loadingPage = false; });
        }

        function goTo(i) {
            current = Math.max(0, Math.min(slides.length - 1, i));
            reel.style.transition = 'transform .34s cubic-bezier(.22,.61,.36,1)';
            reel.style.transform = 'translateY(' + (-current * 100) + 'vh)';
            setActive(current);
        }

        // avança respeitando o filtro (usado por swipe/wheel/teclado)
        function advance(d) {
            const t = nextVisible(current, d);
            goTo(t < 0 ? current : t);
        }

        function step(d) {
            if (animating) return;
            const t = nextVisible(current, d);
            if (t < 0) return;
            animating = true;
            goTo(t);
            clearTimeout(navTimer);
            navTimer = setTimeout(() => { animating = false; }, 380);
        }

        function toggleLive() {
            const emb = slides[current] && slides[current].querySelector('.smg-feed-embed');
            if (emb) emb.classList.toggle('is-live');
        }

        function activeImg() {
            return slides[current] ? slides[current].querySelector('.smg-feed-media') : null;
        }

        // ZOOM por clique (desktop): 2 níveis (2× → 3.5×) e o 3º clique reseta. Sempre mira o ponto clicado (mantém-no
        // sob o cursor, mesmo subindo de nível). Reusa img._zoom (mesmo objeto do pinch). Retorna false se o slide NÃO
        // for imagem → o caller cai no toggleLive (vídeo).
        const ZOOM_STEPS = [2, 3.5];   // até 2 níveis
        function applyZoomTransform(img, z) { img.style.transform = 'translate(' + z.x + 'px,' + z.y + 'px) scale(' + z.scale + ')'; }
        function toggleZoom(clientX, clientY) {
            const img = activeImg();
            if (!img) return false;
            const z = img._zoom || (img._zoom = { scale: 1, x: 0, y: 0, level: 0 });
            if (z.level == null) z.level = z.scale > 1.02 ? 1 : 0;   // compat com estado vindo do pinch
            img.style.transition = 'transform .22s ease';            // suave no clique (o pinch/drag zera isso)
            z.level = (z.level + 1) % 3;                             // 0 → 1 → 2 → 0
            if (z.level === 0) {                                    // 3º clique → reseta
                img._zoom = { scale: 1, x: 0, y: 0, level: 0 };
                img.style.transform = '';
                img.classList.remove('smg-zoomed');
                return true;
            }
            const s = ZOOM_STEPS[z.level - 1];
            const r = img.getBoundingClientRect();                  // box JÁ transformado → mantém o ponto fixo mesmo ampliando de novo
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            z.x += (clientX - cx) * (1 - s / z.scale);
            z.y += (clientY - cy) * (1 - s / z.scale);
            z.scale = s;
            applyZoomTransform(img, z);
            img.classList.add('smg-zoomed');
            return true;
        }

        // ---- download da mídia em foco (lógica em downloadSlide, module-level) ----
        function downloadCurrent() { downloadSlide(slides[current]); }

        // ---- mudo (redgifs/youtube; turbo/imagepond não têm param conhecido) ----
        function setMuteIcon() {
            muteBtn.innerHTML = muted ? ICONS.volumeMute : ICONS.volume;
            muteBtn.title = muted ? i18n('Unmute') : i18n('Mute');
            muteBtn.classList.toggle('smg-active', !muted);
        }
        function toggleMute() {
            muted = !muted;
            gmSet('smg-feed-muted', muted ? '1' : '0');
            setMuteIcon();
            const emb = slides[current] && slides[current].querySelector('.smg-feed-embed');
            if (emb) { emb.innerHTML = ''; setActive(current); } // recarrega o player com o novo parâmetro
        }

        // ---- filtro de mídia ----
        function setFilterIcon() {
            filterBtn.innerHTML = FILTER_ICON[filterMode];
            filterBtn.title = FILTER_LABEL[filterMode];
            filterBtn.classList.toggle('smg-active', filterMode !== 'all');
        }
        function cycleFilter() {
            filterMode = FILTERS[(FILTERS.indexOf(filterMode) + 1) % FILTERS.length];
            setFilterIcon();
            thumbs.forEach((t, j) => t.style.display = isVisible(j) ? '' : 'none');
            if (!isVisible(current)) {
                const v = firstVisible();
                if (v >= 0) goTo(v);
                else { counter.textContent = '0 / 0'; } // nada nesse filtro
            } else {
                setActive(current);
            }
        }

        feed._ctrl = {
            cur: () => current, len: () => slides.length, reel,
            goTo, step, advance, toggleLive, toggleZoom, activeImg, revealActiveThumb,
            download: downloadCurrent, toggleMute, cycleFilter,
        };

        initial.forEach(buildSlide);

        // começa na imagem clicada (índice capturado durante o próprio build — ver buildSlide)
        const startIndex = startSlideIdx >= 0 ? startSlideIdx : 0;

        feed.classList.add('open');
        document.documentElement.style.overflow = 'hidden';
        current = startIndex;
        reel.style.transition = 'none';
        reel.style.transform = 'translateY(' + (-current * 100) + 'vh)';
        setActive(current);
    }

    // =========================================================
    // LISTAGEM (modo lista/grade): marca o container REAL dos itens (.structItem--thread)
    // que o modo grade transforma em grid (o toggle lista/grade vive no dock)
    // =========================================================

    function markThreadGridContainer(roots) {
        if (!document.documentElement.classList.contains('smg-threadlist')) return;   // structItem só existe em listagem; evita varrer o DOM em toda página/tick
        eachIn(roots, '.structItem--thread:not([data-smg-tl])', it => {
            it.dataset.smgTl = '1';   // guard: NodeList vazia uma vez marcados (não varre todo frame)
            if (it.parentElement) it.parentElement.classList.add('smg-tl-grid');
        });
    }

    // marca .smg-has-nodes no .block--category que lista sub-fóruns — o CSS casa a classe estática
    // no lugar de .block--category:has(.node) (re-validado a cada mutação da listagem)
    function markCategoryNodeBlocks(roots) {
        if (!document.documentElement.classList.contains('smg-threadlist')) return;
        eachIn(roots, '.block--category:not([data-smg-nodechk])', b => {
            b.dataset.smgNodechk = '1';
            if (b.querySelector('.node')) b.classList.add('smg-has-nodes');
        });
    }

    // ===== badges REATIVOS: topbar + dock acompanham o contador nativo do XF (alertas) AO VIVO =====
    // o XF muda data-badge em .p-navgroup-link--alerts ao marcar lido / chegar alerta; observamos e re-sincronizamos
    // os badges da topbar e da dock — sem precisar de F5.
    let badgeObsBound = false;
    function nativeBadgeCount(sel) {
        const el = document.querySelector(sel);
        const n = el ? parseInt(el.getAttribute('data-badge') || '0', 10) : 0;
        return n > 0 ? n : 0;
    }
    function setReactiveBadge(host, n, cls) {
        if (!host) return;
        let b = host.querySelector(':scope > .' + cls);
        if (n > 0) {
            const t = n > 99 ? '99+' : String(n);
            if (!b) { b = document.createElement('span'); b.className = cls; host.appendChild(b); }
            if (b.textContent !== t) b.textContent = t;   // só muta se mudou (senão o observer entra em loop)
        } else if (b) { b.remove(); }
    }
    function syncReactiveBadges() {
        const alerts = nativeBadgeCount('.p-navgroup-link--alerts');
        setReactiveBadge(document.querySelector('#smg-topbar .smg-rt-alerts'), alerts, 'smg-tb-badge');     // topbar (ícone do sino)
        setReactiveBadge(document.querySelector('#smg-nav-alerts .smg-nav-ico'), alerts, 'smg-nav-badge');  // dock / navbar mobile
    }
    function watchNativeBadges() {
        if (badgeObsBound) return;   // o MutationObserver já mantém os badges em sync ao vivo — não varre todo frame
        const targets = ['.p-navgroup-link--alerts', '.p-navgroup-link--conversations']
            .map(s => document.querySelector(s)).filter(Boolean);
        if (!targets.length) return;     // sem nav nativa (logout/página sem nav) → nem sincroniza badge à toa todo frame
        syncReactiveBadges();
        badgeObsBound = true;
        const obs = new MutationObserver(syncReactiveBadges);
        targets.forEach(el => obs.observe(el, { attributes: true, attributeFilter: ['data-badge'] }));
    }

    // SMG: cards sem thumb real (XF mostra o avatar do autor, ou nada) ganham um PLACEHOLDER
    // com a marca SMG. Vale no grid E na lista (o CSS ajusta o tamanho por modo). Idempotente.
    // forum_view_type_article (ex.: games.91): marca o container dos .message--articlePreview como grid
    // (pega também sticky/featured que ficam fora do .block-body) + placeholder nos cards sem imagem.
    function styleArticleCards() {
        if (!document.documentElement.classList.contains('smg-threadlist')) return;
        const arts = document.querySelectorAll('.message--articlePreview:not([data-smg-art])');   // guard no seletor: idle = NodeList vazia
        if (!arts.length) return;
        const mark = document.documentElement.classList.contains('smg-smg') ? SMG_PH_MARK : SC_PH_MARK;
        const wantPh = FEATURES.thumbPlaceholders;

        // RECONSTRÓI: o XF (article view) usa um grid "magazine" com grid-template-areas + grid-area por
        // :nth-of-type (o 1º card ocupa a linha toda). Trocar grid-template-columns não resolve. Solução:
        // mover os cards pra um container NOSSO (.smg-article-grid), onde aquelas regras :nth-of-type NÃO casam.
        // O grid/lista é controlado por CSS (gated em smg-tv-grid) → o toggle lista/grade da dock funciona aqui também.
        const origs = new Set();
        arts.forEach(a => { const p = a.parentElement; if (p && !p.classList.contains('smg-article-grid')) origs.add(p); });
        origs.forEach(orig => {
            if (!orig.parentElement) return;
            const grid = document.createElement('div');
            grid.className = 'smg-article-grid';
            orig.parentElement.insertBefore(grid, orig.nextSibling);
            orig.querySelectorAll(':scope > .message--articlePreview').forEach(a => grid.appendChild(a));
            orig.style.setProperty('display', 'none', 'important');   // esconde o container original (vazio)
        });

        arts.forEach(art => {
            if (art.dataset.smgArt) return;
            art.dataset.smgArt = '1';
            // meta: esconde o li do "share" aqui (substitui o li:has(.fa-share-alt) do CSS — era por-li em todo recalc)
            const shareIco = art.querySelector('.articlePreview-meta .fa-share-alt');
            const shareLi = shareIco && shareIco.closest('li');
            if (shareLi) shareLi.style.setProperty('display', 'none', 'important');
            if (!wantPh) return;
            const main = art.querySelector('.articlePreview-main');
            if (!main) return;
            const imgLink = art.querySelector('.articlePreview-image');
            const img = imgLink && imgLink.querySelector('img');
            const addPh = () => {
                if (main.querySelector('.smg-art-ph')) return;
                const ph = document.createElement('a');
                ph.className = 'smg-art-ph';
                const tl = art.querySelector('.articlePreview-title a[href*="/threads/"]');
                if (tl) ph.href = tl.getAttribute('href');
                ph.innerHTML = mark;
                main.insertBefore(ph, main.firstChild);
                if (imgLink) imgLink.style.setProperty('display', 'none', 'important');
            };
            if (!img) { addPh(); return; }
            const verify = () => { if (img.naturalWidth === 0) addPh(); };   // carregou mas veio vazio/quebrado
            if (img.complete) verify();
            else { img.addEventListener('load', verify, { once: true }); img.addEventListener('error', addPh, { once: true }); }
        });
    }

    function markGridPlaceholders(roots) {
        if (!document.documentElement.classList.contains('smg-threadlist')) return;  // os 2 sites
        const mark = document.documentElement.classList.contains('smg-smg') ? SMG_PH_MARK : SC_PH_MARK;
        eachIn(roots, '.structItem--thread:not([data-smg-ph])', it => {
            it.setAttribute('data-smg-ph', '1');   // marca ANTES dos guards (REGRA DE OURO): ad/linha sem ícone ficava fora da marca e era re-varrida em todo full-scan
            if (it.classList.contains('samUnitWrapper')) return; // ad: nem mexe (some via CSS)
            const cell = it.querySelector('.structItem-cell--icon:not(.structItem-cell--iconEnd)');
            if (!cell) return;
            const addPh = () => {
                if (it.classList.contains('smg-no-thumb')) return;
                it.classList.add('smg-no-thumb');
                const ph = document.createElement('div');
                ph.className = 'smg-thumb-ph';
                ph.innerHTML = mark;
                cell.insertBefore(ph, cell.firstChild);
            };
            const thumb = cell.querySelector('.dcThumbnail, .dtt-thread-thumbnail');
            if (!thumb) { addPh(); return; }              // sem thumb (avatar/vazio) → placeholder
            const img = thumb.querySelector('img');
            if (!img) { addPh(); return; }
            // simpcity (.dcThumbnail): o thumb REAL vem no background-image do <img> (src é 1x1).
            if (thumb.classList.contains('dcThumbnail')) {
                const m = (img.style.backgroundImage || '').match(/url\(\s*["']?([^"')]+)/i);
                const url = m && m[1];
                if (!url || /^data:/i.test(url)) { addPh(); return; }   // sem bg real → placeholder
                // bg-image não tem onerror → testa o carregamento (ex.: thumbs do domínio .su morto → 404)
                const probe = new Image();
                probe.onerror = addPh;
                probe.onload = () => { if (!probe.naturalWidth) addPh(); };
                probe.src = url;
                return;
            }
            // SMG (.dtt-thread-thumbnail): <img src> real → placeholder se quebrar
            if (img.complete && img.naturalWidth === 0) addPh();
            else img.addEventListener('error', addPh, { once: true });
        });
    }

    // =========================================================
    // HOME (forum_list): cards · sections · sub-fóruns · atalhos · sidebar
    // (obs: buildFilterBars=THREAD/barra e buildTopbar=TOPBAR ficam logo abaixo deste grupo)
    //
    // Mapa: mergeSmallHomeSections · relocateSimpcityNodes(SC)/relocateSmgNodes(SMG) · expandSubForums ·
    //   splitTransSection(SC) · sortHomeCards · reorderHomeSections · makeHomeCardsClickable ·
    //   buildHomeFeed (+feedThumbUrl/feedCard/loadFeed) · layoutHomeSidebar
    // =========================================================

    // home: junta sections pequenas (≤3 cards reais) consecutivas numa só
    // (ex.: Info/Promoção/Requests do simpcity, cada uma com 1 card → 1 section)
    let homeMerged = false;
    function mergeSmallHomeSections() {
        if (homeMerged || !document.documentElement.classList.contains('smg-home')) return;
        const cats = Array.prototype.slice.call(
            document.querySelectorAll('.p-body-content .block--category'));
        if (cats.length < 2) return;
        homeMerged = true;
        // conta só nós "reais" (fórum/categoria), ignora os .node--link (ads, já escondidos)
        const realCount = b => b.querySelectorAll('.block-body .node:not(.node--link)').length;
        let i = 0;
        while (i < cats.length) {
            if (realCount(cats[i]) > 3) { i++; continue; }
            const baseBody = cats[i].querySelector('.block-body');
            let j = i + 1;
            while (j < cats.length && realCount(cats[j]) <= 3) {
                const body = cats[j].querySelector('.block-body');
                if (baseBody && body) while (body.firstChild) baseBody.appendChild(body.firstChild);
                cats[j].remove();
                j++;
            }
            i = j;
        }
        // remove categorias que sobraram sem cards (ex.: esvaziadas pela realocação)
        document.querySelectorAll('.p-body-content .block--category').forEach(c => {
            if (!c.querySelector('.block-body .node:not(.node--link)')) c.remove();
        });
    }

    // simpcity: move OnlyFans / Patreon / ManyVids pra dentro da section "Social Media"
    let scRelocated = false;
    function relocateSimpcityNodes() {
        if (scRelocated
            || !document.documentElement.classList.contains('smg-sc')
            || !document.documentElement.classList.contains('smg-home')) return;
        const cats = document.querySelectorAll('.p-body-content .block--category');
        if (!cats.length) return;
        let social = null;
        cats.forEach(c => {
            const h = c.querySelector('.block-header');
            if (h && /social\s*media/i.test(h.textContent || '')) social = c;
        });
        if (!social) return;
        const socialBody = social.querySelector('.block-body');
        if (!socialBody) return;
        scRelocated = true;
        document.querySelectorAll('.p-body-content .block--category .node').forEach(node => {
            if (social.contains(node)) return;
            const a = node.querySelector('.node-title a') || node.querySelector('a[href]');
            const href = a ? (a.getAttribute('href') || '') : '';
            if (/onlyfans|patreon|manyvids/i.test(href)) socialBody.appendChild(node);
        });
    }

    // home: promove sub-fóruns (node-subNodesFlat) a cards próprios na grade (SMG + simpcity)
    let subForumsExpanded = false;
    function expandSubForums() {
        if (subForumsExpanded || !document.documentElement.classList.contains('smg-home')) return;
        const flats = document.querySelectorAll('.p-body-content .block--category .node .node-subNodesFlat');
        if (!flats.length) return;
        subForumsExpanded = true;
        const isSc = document.documentElement.classList.contains('smg-sc');
        // svg de fallback (balão) — inline, sempre renderiza (o <i> da FA usa <use> externo e falhava)
        const fallbackSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
        flats.forEach(flat => {
            const parentNode = flat.closest('.node');
            if (!parentNode || !parentNode.parentElement) return;
            const parentTitleEl = parentNode.querySelector('.node-title');
            const parentTitle = parentTitleEl ? (parentTitleEl.textContent || '').trim() : '';
            let anchor = parentNode;
            flat.querySelectorAll('.subNodeLink').forEach(link => {
                const href = link.getAttribute('href') || '';
                const img = link.querySelector('img');
                // só o texto do sub-fórum (sem o ícone)
                let text = '';
                link.childNodes.forEach(n => { if (n.nodeType === 3) text += n.textContent; });
                text = (text || link.textContent || '').trim();
                const card = document.createElement('div');
                card.className = 'node node--forum smg-subcard';
                card.dataset.smgParentTitle = parentTitle; // origem (p/ split trans/brasil)
                card.innerHTML = '<div class="node-body"><span class="node-icon" aria-hidden="true"></span>'
                    + '<div class="node-main"><h3 class="node-title"></h3></div></div>';
                // ícone: logo real (img) · no simpcity tenta o ícone do nó (/static/icons/nodes/ID.png) · fallback balão
                const iconSpan = card.querySelector('.node-icon');
                const setFallback = () => { iconSpan.innerHTML = fallbackSvg; };
                const addImg = src => { const im = document.createElement('img'); im.alt = ''; im.onerror = setFallback; im.src = src; iconSpan.appendChild(im); };
                const imgSrc = img ? (img.getAttribute('data-src') || img.getAttribute('src') || '') : '';
                const idMatch = href.match(/\.(\d+)\/?(?:[?#]|$)/);
                if (imgSrc) addImg(imgSrc);
                else if (isSc && idMatch) addImg('/static/icons/nodes/' + idMatch[1] + '.png');
                else setFallback();
                const a = document.createElement('a');
                a.href = href; a.textContent = text;
                card.querySelector('.node-title').appendChild(a);
                anchor.insertAdjacentElement('afterend', card);
                anchor = card;
            });
            flat.remove(); // tira a lista de subitems do card pai
        });
    }

    // simpcity: separa a section "Transgender" por ORIGEM →
    //   fica: o nó Transgender + os sub-fóruns DELE
    //   vai pro "Brasil": o nó Brasileiras + sub-fóruns dele (inclui "Trans" e "Trans (Área de Pedidos)")
    let transSplit = false;
    function splitTransSection() {
        if (transSplit
            || !document.documentElement.classList.contains('smg-sc')
            || !document.documentElement.classList.contains('smg-home')) return;
        const cats = document.querySelectorAll('.p-body-content .block--category');
        let transCat = null;
        cats.forEach(c => {
            const h = c.querySelector('.block-header');
            if (h && /trans(gender)?/i.test(h.textContent || '')) transCat = c;
        });
        if (!transCat) return;
        const body = transCat.querySelector('.block-body');
        if (!body) return;
        const allNodes = Array.prototype.slice.call(body.querySelectorAll('.node'));
        // nó pai "Transgender" (real, não subcard)
        const transNode = allNodes.find(n => !n.classList.contains('smg-subcard')
            && /transgender/i.test((n.querySelector('.node-title') || {}).textContent || ''));
        const keepTitle = transNode ? (transNode.querySelector('.node-title').textContent || '').trim() : '';
        const nonTrans = allNodes.filter(n => {
            if (n === transNode) return false;                                   // mantém o nó Transgender
            if (n.classList.contains('smg-subcard')) return n.dataset.smgParentTitle !== keepTitle; // mantém sub-fóruns do Transgender
            return true;                                                          // outros nós reais (Brasileiras) → Brasil
        });
        if (!nonTrans.length) return;
        transSplit = true;
        const brasil = document.createElement('div');
        brasil.className = 'block block--category';
        brasil.innerHTML = '<h2 class="block-header"><div class="uix_categoryStrip-content">'
            + '<span class="uix_categoryTitle">Brasil</span></div></h2>'
            + '<div class="block-container"><div class="block-body"></div></div>';
        const brasilBody = brasil.querySelector('.block-body');
        nonTrans.forEach(n => brasilBody.appendChild(n));
        transCat.insertAdjacentElement('afterend', brasil);
    }

    // home: ordena os cards de cada section em ordem alfabética
    let cardsSorted = false;
    function sortHomeCards() {
        if (cardsSorted || !document.documentElement.classList.contains('smg-home')) return;
        const bodies = document.querySelectorAll('.p-body-content .block--category .block-body');
        if (!bodies.length) return;
        cardsSorted = true;
        const key = n => ((n.querySelector('.node-title') || {}).textContent || '').trim().toLowerCase();
        bodies.forEach(body => {
            const nodes = Array.prototype.slice.call(body.querySelectorAll(':scope > .node'));
            if (nodes.length < 2) return;
            nodes.sort((a, b) => key(a).localeCompare(key(b), 'pt', { numeric: true, sensitivity: 'base' }));
            nodes.forEach(n => body.appendChild(n));
        });
    }

    // home: manda "Info and Links" e "Announcements" pro fim (penúltimas sections)
    let sectionsReordered = false;
    function reorderHomeSections() {
        if (sectionsReordered || !document.documentElement.classList.contains('smg-home')) return;
        const cats = Array.prototype.slice.call(document.querySelectorAll('.p-body-content .block--category'));
        if (cats.length < 2) return;
        const titleOf = c => ((c.querySelector('.block-header') || {}).textContent || '').trim();
        const moveRe = /info and links|announcements|informações e links|anúncios/i;
        const toMove = cats.filter(c => moveRe.test(titleOf(c)));
        const keep = cats.filter(c => !moveRe.test(titleOf(c)));
        if (!toMove.length || !keep.length) return;
        sectionsReordered = true;
        // manda as sections "Info and links / Announcements" pro FIM (depois da última section normal),
        // preservando a ordem entre elas — o anchor avança a cada inserção.
        let anchor = keep[keep.length - 1]; // âncora: última section "normal"
        toMove.forEach(m => { anchor.insertAdjacentElement('afterend', m); anchor = m; });
    }

    // home: card inteiro clicável (navega pro link do título)
    function makeHomeCardsClickable() {
        if (!document.documentElement.classList.contains('smg-home')) return;
        document.querySelectorAll('.p-body-content .block--category .node:not([data-smg-click])').forEach(node => {
            node.dataset.smgClick = '1';   // guard no seletor: NodeList vazia uma vez processados
            const a = node.querySelector('.node-title a');
            const href = a ? a.getAttribute('href') : '';
            if (!href) return;
            node.addEventListener('click', e => {
                if (e.target.closest('a')) return; // links reais funcionam normal
                window.location.href = href;
            });
        });
    }

    let homeSidebarDone = false;

    // home: FEED com abas (Latest posts · Trending). Cada aba busca sua fonte
    // (/whats-new/posts/, trending), parseia .structItem--thread e monta
    // um grid de cards verticais (thumb + título + último autor · data). Lazy: só busca a aba ativa.
    let homeFeedDone = false;
    // URL da thumbnail da THREAD (não do avatar): dcThumbnail tem em background-image; dtt no src.
    function feedThumbUrl(it) {
        const ic = it.querySelector('.structItem-cell--icon:not(.structItem-cell--iconEnd)');
        if (!ic) return '';
        const img = ic.querySelector('.dcThumbnail img, .dtt-thread-thumbnail img, img');
        if (!img) return '';
        const bg = (img.style.backgroundImage || '').match(/url\(['"]?([^'")]+)['"]?\)/i);
        const u = (bg && bg[1]) || img.getAttribute('data-src') || img.getAttribute('src') || '';
        return /^data:/.test(u) ? '' : u;
    }
    // monta 1 card vertical a partir de um .structItem--thread
    function feedCard(it, phMark) {
        const titleCell = it.querySelector('.structItem-title');
        const titleLink = titleCell && titleCell.querySelector('a[href*="/threads/"]');
        if (!titleLink) return null;
        const card = document.createElement('a');
        card.className = 'smg-feed-card';
        // href → último post (newest) p/ cair na última página da thread; cai pro /latest se não achar o link da data
        const lastA = it.querySelector('a.structItem-latestDate[href], .structItem-cell--latest a[href*="/post-"]');
        card.href = safeHref((lastA && lastA.getAttribute('href'))
            || (titleLink.getAttribute('href').replace(/\/(unread|latest|page-\d+|post-\d+).*$/, '').replace(/\/$/, '') + '/latest'));
        // thumb: imagem real (com onerror → placeholder da marca, p/ cobrir .su morto)
        const thumb = document.createElement('div'); thumb.className = 'smg-feed-card-thumb';
        const url = feedThumbUrl(it);
        if (url) {
            const im = document.createElement('img'); im.loading = 'lazy'; im.src = url;
            im.addEventListener('error', () => { thumb.classList.add('smg-feed-noimg'); thumb.innerHTML = phMark; });
            thumb.appendChild(im);
        } else { thumb.classList.add('smg-feed-noimg'); thumb.innerHTML = phMark; }
        // título: prefixos (spans) + texto
        const body = document.createElement('div'); body.className = 'smg-feed-card-body';
        const title = document.createElement('div'); title.className = 'smg-feed-card-title';
        titleCell.querySelectorAll('.label, .prefix').forEach(s => { title.appendChild(s.cloneNode(true)); title.appendChild(document.createTextNode(' ')); });
        title.appendChild(document.createTextNode(titleLink.textContent.trim()));
        body.appendChild(title);
        // meta: último autor · data (.structItem-latestDate mantém o texto PT do site)
        const lastUser = it.querySelector('.structItem-cell--latest .username');
        const time = it.querySelector('.structItem-latestDate') || it.querySelector('.structItem-cell--latest time');
        const metaTxt = [lastUser && lastUser.textContent.trim(), time && time.textContent.trim()].filter(Boolean).join(' · ');
        if (metaTxt) { const meta = document.createElement('div'); meta.className = 'smg-feed-card-meta'; meta.textContent = metaTxt; body.appendChild(meta); }
        card.append(thumb, body);
        return card;
    }
    // threads "ruído" p/ um carrossel VISUAL: chat/bate-papo, guias, pedidos de identificação, discussões, perguntas (sem mídia própria).
    // Filtra pelo PREFIXO (chip do título) OU pelo FÓRUM de origem — nunca pelo texto do título (senão tira post legítimo).
    function isIgnoredThread(it) {
        if (!it) return false;
        // \bchat\b casa "Simp Chat" mas NÃO "Chaturbate"; bate-papo = chat em PT; guide(s); identi(fy/ty); discuss(ion); question(s); tool(s)
        const IGNORE_RE = /\bchat\b|bate[-\s]?papo|\bguides?\b|\bidenti|\bdiscuss|\bquestions?\b|\btools?\b/i;
        const titleCell = it.querySelector('.structItem-title');
        if (titleCell) {
            const labels = titleCell.querySelectorAll('.label, .labelLink, .prefix, [class*="label--"]');
            for (let i = 0; i < labels.length; i++) if (IGNORE_RE.test(labels[i].textContent || '')) return true;
        }
        const forumA = it.querySelector('a[href*="/forums/"]');   // link do fórum de origem (onde quer que o tema o ponha)
        if (forumA && IGNORE_RE.test((forumA.textContent || '') + ' ' + (forumA.getAttribute('href') || ''))) return true;
        return false;
    }
    // ---- carrossel: 1ª carga + PAGINAÇÃO por scroll (busca a próxima página ao chegar perto da borda direita) ----
    const FEED_SKEL_CARD = '<div class="smg-feed-card smg-feed-skel"><div class="smg-feed-card-thumb smg-skel-box"></div><div class="smg-feed-card-body"><div class="smg-skel-line"></div><div class="smg-skel-line"></div><div class="smg-skel-line smg-skel-line--short"></div><div class="smg-skel-line smg-skel-line--meta"></div></div></div>';
    const FEED_MAX = 120;   // teto de cards por aba (evita DOM/imagens crescendo sem fim)
    const feedKeyOf = a => (a.getAttribute('href') || '').replace(/\/(unread|latest|post-\d+|page-\d+).*$/, '').replace(/\/$/, '');
    // URL da PRÓXIMA página (paginação XF): rel=next no <head> ou o anchor "próxima" do pageNav. Absolutiza.
    function feedNextUrl(doc) {
        const ln = doc.querySelector('link[rel="next"]');
        let href = ln ? ln.getAttribute('href') : '';
        if (!href) { const nx = doc.querySelector('.pageNav-jump--next'); href = nx ? nx.getAttribute('href') : ''; }
        if (!href) return '';
        try { return new URL(href, location.href).href; } catch (e) { return ''; }
    }
    // renderiza UMA página de structItems no painel (dedup por feed._seen, sem chat). append=false limpa antes.
    // devolve o nº de cards ADICIONADOS nesta página.
    function feedRenderPage(doc, feed, panel, phMark, append) {
        const frag = document.createDocumentFragment();
        let n = 0;
        doc.querySelectorAll('.structItem--thread').forEach(it => {
            const tl = it.querySelector('.structItem-title a[href*="/threads/"]');
            if (!tl) return;
            if (isIgnoredThread(it)) return;   // pula chat/bate-papo, guia, identify, discussão
            const k = feedKeyOf(tl); if (feed._seen.has(k)) return; feed._seen.add(k);
            const c = feedCard(it, phMark); if (c) { frag.appendChild(c); n++; }
        });
        if (!append) panel.innerHTML = '';
        if (n) panel.appendChild(frag);
        return n;
    }
    // 1ª carga da aba: skeletons → página 1 → renderiza + guarda a próxima URL. Idempotente.
    function loadFeed(feed, panel, phMark, onDone) {
        if (panel.dataset.loaded) { if (onDone) onDone(); return; }
        panel.dataset.loaded = '1';
        feed._seen = new Set(); feed._nextUrl = ''; feed._loadingMore = false;
        panel.innerHTML = FEED_SKEL_CARD.repeat(8);
        if (onDone) onDone();
        fetchDoc(feed.url, { credentials: 'same-origin' })
            .then(doc => {
                const n = feedRenderPage(doc, feed, panel, phMark, false);
                feed._nextUrl = n ? feedNextUrl(doc) : '';
                if (!n) panel.innerHTML = '<div class="smg-feed-loading">' + i18n('Nothing here yet.') + '</div>';
                if (onDone) onDone();
            })
            .catch(() => { panel.dataset.loaded = ''; panel.innerHTML = '<div class="smg-feed-loading">' + i18n('Couldn’t load.') + '</div>'; if (onDone) onDone(); });
    }
    // PAGINAÇÃO: busca a próxima página e dá APPEND (chamada ao chegar perto da borda direita do scroll).
    function loadMoreFeed(feed, panel, phMark, onDone) {
        if (!feed || !feed._nextUrl || feed._loadingMore) return;
        if (panel.querySelectorAll('.smg-feed-card:not(.smg-feed-skel)').length >= FEED_MAX) { feed._nextUrl = ''; return; }   // teto: para de paginar
        feed._loadingMore = true;
        const url = feed._nextUrl;
        const skels = [];   // skeletons à direita enquanto busca
        for (let i = 0; i < 4; i++) { const d = document.createElement('div'); d.innerHTML = FEED_SKEL_CARD; const el = d.firstChild; panel.appendChild(el); skels.push(el); }
        fetchDoc(url, { credentials: 'same-origin' }).then(doc => {
            skels.forEach(s => s.remove());
            const n = feedRenderPage(doc, feed, panel, phMark, true);
            feed._nextUrl = n ? feedNextUrl(doc) : '';   // página sem itens novos → para (anti-loop)
            feed._loadingMore = false;
            if (onDone) onDone();
        }, () => { skels.forEach(s => s.remove()); feed._loadingMore = false; if (onDone) onDone(); });
    }
    // cria o bloco (abas + painéis), insere antes das categorias e carrega a 1ª aba
    function buildHomeFeed(parent, ref) {
        if (homeFeedDone) return;
        const feeds = [
            { key: 'latest', label: 'Latest posts', icon: ICONS.layers, url: navHref('whatsNewPosts', 'newPosts', 'whatsNewPosts2') || '/whats-new/posts/' },
            { key: 'trending', label: 'Trending', icon: ICONS.flame, url: navHref('trending', 'smgtrending', 'trending2') },
            // "Following" REMOVIDO daqui: a Timeline (topbar → ?view=feed) já é o feed das seguidas.
        ].filter(f => f.url);
        if (!feeds.length) return;
        homeFeedDone = true;
        const phMark = document.documentElement.classList.contains('smg-smg') ? SMG_PH_MARK : SC_PH_MARK;
        const block = document.createElement('div'); block.className = 'smg-feed-block';
        const tabsEl = document.createElement('div'); tabsEl.className = 'smg-feed-tabs';
        const tablist = document.createElement('div'); tablist.className = 'smg-feed-tablist';
        const scrollWrap = document.createElement('div'); scrollWrap.className = 'smg-feed-scroll';
        const panelsEl = document.createElement('div'); panelsEl.className = 'smg-feed-panels';
        scrollWrap.appendChild(panelsEl);

        // setas ‹ › (desktop) — rolam o painel ATIVO; somem nas bordas
        const chevron = dir => '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="' + (dir < 0 ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6') + '"/></svg>';
        const navBtns = {};
        const activePanel = () => panelsEl.querySelector('.smg-feed-panel.is-active');
        const updateNav = () => {
            const p = activePanel(); if (!p) return;
            const max = p.scrollWidth - p.clientWidth - 2;
            navBtns[-1].classList.toggle('smg-nav-hidden', p.scrollLeft <= 2);
            navBtns[1].classList.toggle('smg-nav-hidden', p.scrollLeft >= max || max <= 0);
        };
        // scroll do painel: atualiza as setas E, perto da borda direita, pré-busca a próxima página (append).
        // SÓ aqui (não no updateNav, que roda pós-load) → sem loop: o append cresce o scrollWidth e a condição volta a ser falsa.
        const onPanelScroll = () => {
            updateNav();
            const p = activePanel(); if (!p || !p._feed) return;
            if (p.scrollWidth - p.clientWidth - p.scrollLeft <= 700) loadMoreFeed(p._feed, p, phMark, updateNav);
        };
        [-1, 1].forEach(dir => {
            const b = document.createElement('button'); b.type = 'button';
            b.className = 'smg-feed-nav ' + (dir < 0 ? 'smg-feed-prev' : 'smg-feed-next');
            b.setAttribute('aria-label', dir < 0 ? 'Previous' : 'Next');
            b.innerHTML = chevron(dir);
            b.addEventListener('click', () => { const p = activePanel(); if (p) p.scrollBy({ left: dir * Math.round(p.clientWidth * 0.85), behavior: 'smooth' }); });
            scrollWrap.appendChild(b); navBtns[dir] = b;
        });
        let feedNavRaf = 0;   // rAF-throttle: updateNav lê scrollWidth/clientWidth (layout) — não roda por evento de resize
        window.addEventListener('resize', () => { if (feedNavRaf) return; feedNavRaf = requestAnimationFrame(() => { feedNavRaf = 0; updateNav(); }); }, { passive: true });

        // link "See all" → leva direto pra página da aba ATIVA (atualiza ao trocar de aba)
        const seeAll = document.createElement('a');
        seeAll.className = 'smg-feed-seeall';
        seeAll.innerHTML = 'See all <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';

        feeds.forEach((f, i) => {
            const tab = document.createElement('button'); tab.type = 'button';
            tab.className = 'smg-feed-tab' + (i === 0 ? ' is-active' : '');
            tab.innerHTML = '<span class="smg-feed-tab-ic">' + f.icon + '</span><span>' + f.label + '</span>';
            const panel = document.createElement('div'); panel.className = 'smg-feed-panel' + (i === 0 ? ' is-active' : '');
            panel.addEventListener('scroll', onPanelScroll, { passive: true });
            f._panel = panel; panel._feed = f;   // panel→feed: o onPanelScroll sabe qual fonte paginar
            tab.addEventListener('click', () => {
                tabsEl.querySelectorAll('.smg-feed-tab').forEach(t => t.classList.remove('is-active'));
                panelsEl.querySelectorAll('.smg-feed-panel').forEach(p => p.classList.remove('is-active'));
                tab.classList.add('is-active'); panel.classList.add('is-active');
                seeAll.href = f.url;
                loadFeed(f, panel, phMark, updateNav);
                updateNav();
            });
            tablist.appendChild(tab); panelsEl.appendChild(panel);
        });
        tabsEl.append(tablist, seeAll);   // tabs (scrolláveis) + See all fixado à direita
        seeAll.href = feeds[0].url;
        block.append(tabsEl, scrollWrap);
        i18nDom(block);
        parent.insertBefore(block, ref);
        loadFeed(feeds[0], feeds[0]._panel, phMark, updateNav);
    }

    function layoutHomeSidebar() {
        if (homeSidebarDone || !document.documentElement.classList.contains('smg-home')) return;
        const content = document.querySelector('.p-body-content .p-body-pageContent')
            || document.querySelector('.p-body-content');
        if (!content) return;
        homeSidebarDone = true;
        const firstCat = content.querySelector('.block--category');
        const parent = firstCat ? firstCat.parentElement : content;
        const ref = firstCat || null; // insere ANTES da primeira section (mesmo pai)
        // FEED com abas (Latest posts · Trending) no topo da home.
        // (substitui o antigo carousel do widget new_posts + a linha de atalhos; widget fica oculto na sidebar.)
        buildHomeFeed(parent, ref);
        // streak (SMG): REMOVIDO. Ao mover pra dentro do .uix_nodeList (que tem class "block"),
        // o seletor .block:has(.streakStats) pintava o nodeList inteiro de laranja. Removendo, some o laranja.
        const streak = document.querySelector('.streakStats');
        const streakBlock = streak ? streak.closest('.block') : null;
        if (streakBlock) streakBlock.remove();
        // esconde a sidebar inteira (sobra só a linha de widgets que não queremos)
        const sidebar = document.querySelector('.p-body-sidebar');
        if (sidebar) sidebar.style.setProperty('display', 'none', 'important');
    }

    // marca .smg-ad-block no bloco promocional (só .node--link dentro) — o CSS esconde pela classe
    // estática no lugar do :has(> .block-container > .block-body > .node--link), reavaliado por mutação.
    // Guard por data-attr: steady-state a NodeList volta vazia.
    function markHomeAdBlocks() {
        document.querySelectorAll('.block:not(.block--category):not([data-smg-adchk])').forEach(b => {
            b.dataset.smgAdchk = '1';
            if (b.querySelector(':scope > .block-container > .block-body > .node--link')) b.classList.add('smg-ad-block');
        });
    }

    // SMG home: move "ASMR" de "Social Media" para "More Categories" e renomeia a section pra "Categories"
    let smgRelocated = false;
    function relocateSmgNodes() {
        if (smgRelocated
            || !document.documentElement.classList.contains('smg-smg')
            || !document.documentElement.classList.contains('smg-home')) return;
        const cats = document.querySelectorAll('.p-body-content .block--category');
        if (!cats.length) return;
        let moreCat = null;
        cats.forEach(c => {
            const h = c.querySelector('.block-header');
            if (h && /more\s*categories/i.test(h.textContent || '')) moreCat = c;
        });
        if (!moreCat) return;
        const moreBody = moreCat.querySelector('.block-body');
        if (!moreBody) return;
        smgRelocated = true;
        // move ASMR (de qualquer outra section) pra "More Categories"
        document.querySelectorAll('.p-body-content .block--category .node').forEach(node => {
            if (moreCat.contains(node)) return;
            const title = ((node.querySelector('.node-title') || {}).textContent || '').trim();
            const a = node.querySelector('.node-title a') || node.querySelector('a[href]');
            const href = a ? (a.getAttribute('href') || '') : '';
            if (/\basmr\b/i.test(title) || /asmr/i.test(href)) moreBody.appendChild(node);
        });
        // renomeia "More Categories" -> "Categories" (preservando o trigger de collapse)
        const head = moreCat.querySelector('.block-header');
        if (head) {
            const titleEl = head.querySelector('a, .uix_categoryTitle, .block-header-title');
            if (titleEl) titleEl.textContent = i18n('Categories');
            else {
                let done = false;
                head.childNodes.forEach(n => { if (!done && n.nodeType === 3 && n.textContent.trim()) { n.textContent = i18n('Categories'); done = true; } });
                if (!done) head.insertBefore(document.createTextNode(i18n('Categories')), head.firstChild);
            }
        }
    }

    // =========================================================
    // BARRA ÚNICA SEGMENTADA (filter bar) — SMG · thread + fórum
    // Um componente só (pager · ordenar · ações). Espelha os links do XF e
    // PROXY-CLICA os botões nativos (que ficam escondidos no DOM, igual a dock faz):
    // watch/mark-read/translate/jump-to-new/menu seguem com o comportamento AJAX do XF.
    // O .block-outer nativo é escondido (fonte de dados pro scroll infinito + page-jump).
    // Mapa: smgBarBtn/smgPopHost/smgJumpHost (blocos) · smgPagerGroup/smgSortGroup/smgPrimaryActions/smgMoreButton (grupos) · buildFilterBars (monta tudo) · fetchXfList (AJAX da listagem).
    // =========================================================
    const SMG_CHEVRON = dir => svgIcon(dir < 0 ? '<path d="m15 18-6-6 6-6"/>' : '<path d="m9 18 6-6-6-6"/>');
    const SMG_ICO = {   // ⚠️ ícones SÓ do filtro-bar (paths crus p/ svgIcon()). check saiu → usar ICONS.shareDone (era idêntico)
        globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
        eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
        thumb: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    };

    // tooltip estilo dock, mas position:FIXED (escapa o overflow:hidden da barra). um elemento só, reposicionado.
    let smgTipEl = null;
    function smgShowTip(btn, text) {
        if (!smgTipEl) { smgTipEl = document.createElement('div'); smgTipEl.className = 'smg-bar-tip'; document.body.appendChild(smgTipEl); }
        smgTipEl.textContent = text;
        const r = btn.getBoundingClientRect();
        smgTipEl.style.left = Math.round(r.left + r.width / 2) + 'px';
        smgTipEl.style.top = Math.round(r.top - 8) + 'px';
        smgTipEl.classList.add('show');
    }
    function smgHideTip() { if (smgTipEl) smgTipEl.classList.remove('show'); }

    function smgBarBtn({ icon, label, title, href, current, onClick, cls }) {
        title = i18n(title); label = i18n(label);
        const el = document.createElement(href ? 'a' : 'button');
        if (href) el.href = href; else el.type = 'button';
        el.className = 'smg-bar-btn' + (icon && !label ? ' smg-bar-btn--icon' : '') + (current ? ' smg-bar-btn--current' : '') + (cls ? ' ' + cls : '');
        if (title) { el.title = title; el.setAttribute('aria-label', title); }
        el.innerHTML = (icon ? '<span class="smg-bar-ic">' + icon + '</span>' : '') + (label ? '<span>' + label + '</span>' : '');
        if (onClick) el.addEventListener('click', onClick);
        // ícones (sem label visível) ganham o tooltip custom no hover (lê el.title VIVO → watch atualiza)
        if (title && icon && !label) {
            el.addEventListener('mouseenter', () => smgShowTip(el, el.title || title));
            el.addEventListener('mouseleave', smgHideTip);
            el.addEventListener('click', smgHideTip);
        }
        return el;
    }

    // popover ancorado num botão (abre no clique, fecha clicando fora). pop é position:fixed →
    // posiciono acima do botão na hora de abrir (escapa o overflow:hidden da barra).
    function smgPopHost(triggerBtn, popEl) {
        const host = document.createElement('span');
        host.className = 'smg-bar-pophost';
        const place = () => {
            const r = triggerBtn.getBoundingClientRect();
            popEl.style.left = Math.round(r.left + r.width / 2) + 'px';
            popEl.style.top = Math.round(r.top - 8) + 'px';
        };
        triggerBtn.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            const open = host.classList.toggle('open');
            if (open) { place(); setTimeout(() => { const i = popEl.querySelector('input'); if (i) i.focus(); }, 0); }
        });
        document.addEventListener('click', e => { if (!host.contains(e.target)) host.classList.remove('open'); });
        host.append(triggerBtn, popEl);
        return host;
    }

    // "ir pra página" (template /page-%page%): input + Go
    function smgJumpHost(tpl, max, label, cls) {
        const btn = smgBarBtn({ label, title: 'Go to page', cls });
        const pop = document.createElement('div'); pop.className = 'smg-bar-pop smg-bar-pop--jump';
        const input = document.createElement('input'); input.type = 'number'; input.min = '1';
        if (max) { input.max = String(max); input.placeholder = '1–' + max; }
        const go = document.createElement('button'); go.type = 'button'; go.className = 'smg-bar-go'; go.textContent = i18n('Go');
        const nav = () => {
            const n = parseInt(input.value, 10);
            if (!n || n < 1 || !tpl || (max && n > +max)) return;
            let url = (n === 1) ? tpl.replace(/\/page-%page%/, '/') : tpl.replace('%page%', String(n));
            if (location.search && url.indexOf('?') < 0 && /[?&]order=/.test(location.search)) url += location.search;
            window.location.href = url;
        };
        go.addEventListener('click', nav);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nav(); } });
        pop.append(input, go);
        return smgPopHost(btn, pop);
    }

    function smgPageUrlTpl(wrap) {
        const row = wrap.querySelector('[data-page-url]');
        if (row) return row.getAttribute('data-page-url');                 // .../page-%page%
        const any = wrap.querySelector('.pageNav-page > a[href*="/page-"]');
        return any ? any.getAttribute('href').replace(/\/page-\d+/, '/page-%page%') : null;
    }
    function smgCurPage(wrap) {
        const cur = wrap.querySelector('.pageNav-page--current');
        if (cur) return (cur.textContent || '').trim();
        const simp = wrap.querySelector('.pageNavSimple-el--current');
        const m = simp && (simp.textContent || '').match(/(\d+)\s*of/i);
        return m ? m[1] : '1';
    }

    // GRUPO 1 — pager (números no desktop · cur/max no mobile · prev/next · jump)
    function smgPagerGroup(wrap) {
        const main = wrap.querySelector('.pageNav-main');
        if (!main) return null;
        const g = document.createElement('div'); g.className = 'smg-bar-group smg-bar-pager';
        const prev = wrap.querySelector('.pageNav-jump--prev');
        const next = wrap.querySelector('.pageNav-jump--next');
        const tpl = smgPageUrlTpl(wrap);
        const pjInput = wrap.querySelector('.js-pageJumpPage');
        const max = pjInput ? pjInput.getAttribute('max') : null;
        if (prev) g.appendChild(smgBarBtn({ icon: SMG_CHEVRON(-1), title: 'Previous', href: prev.getAttribute('href') }));
        // compacto (mobile): cur / max
        const compact = document.createElement('span'); compact.className = 'smg-bar-compact';
        compact.textContent = smgCurPage(wrap) + (max ? ' / ' + max : '');
        g.appendChild(compact);
        // números (desktop) — espelha os <li> que o XF mostra
        const pages = document.createElement('span'); pages.className = 'smg-bar-pages';
        main.querySelectorAll(':scope > li').forEach(li => {
            if (li.classList.contains('pageNav-page--skip')) { if (tpl) pages.appendChild(smgJumpHost(tpl, max, '…', 'smg-bar-jump')); return; }
            const a0 = li.querySelector('a'); if (!a0) return;
            pages.appendChild(smgBarBtn({ label: (a0.textContent || '').trim(), href: a0.getAttribute('href'), current: li.classList.contains('pageNav-page--current') }));
        });
        g.appendChild(pages);
        if (next) g.appendChild(smgBarBtn({ icon: SMG_CHEVRON(1), title: 'Next', href: next.getAttribute('href') }));
        return g;
    }

    // GRUPO 2 — ordenar (data ⇄ reações): dois <a> reais, ativo = knob branco. só thread.
    function smgSortGroup(bo) {
        const wrap = bo.querySelector('.tabs--standalone');
        if (!wrap) return null;
        // acha os 2 links por HREF (independe de idioma): reação tem ?order=reaction_score; data é a sem order=
        let dateLink = null, reactLink = null;
        wrap.querySelectorAll('.tabs-tab').forEach(t => {
            const h = t.getAttribute('href') || '';
            if (/order=reaction/i.test(h)) reactLink = t;
            else if (!/order=/i.test(h)) dateLink = t;
        });
        if (!dateLink || !reactLink) return null;
        const onReactions = /[?&]order=reaction/i.test(location.search) || reactLink.classList.contains('is-active');
        // TOGGLE ÚNICO (igual a dock): ícone de ORDENAÇÃO (⇅) + critério atual; clicar leva pro outro
        const curLabel = onReactions ? i18n('Reactions') : i18n('Date');
        const orderIcon = svgIcon('<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>');
        const g = document.createElement('div'); g.className = 'smg-bar-group smg-bar-sort';
        const btn = smgBarBtn({
            icon: orderIcon,
            label: curLabel,
            href: (onReactions ? dateLink : reactLink).getAttribute('href'),
            cls: 'smg-bar-sorttoggle',
        });
        // tooltip (botão tem label, então o auto-tooltip não pega → adiciono manual)
        const tip = i18n('Order by') + ' ' + curLabel.toLowerCase() + ' — ' + i18n('click to toggle');
        btn.title = tip; btn.setAttribute('aria-label', tip);
        btn.addEventListener('mouseenter', () => smgShowTip(btn, tip));
        btn.addEventListener('mouseleave', smgHideTip);
        btn.addEventListener('click', smgHideTip);
        g.appendChild(btn);
        return g;
    }

    // GRUPO 3 — ações (ícones que PROXY-CLICAM o nativo escondido)
    function smgProxyConfirm(nativeEl) { // watch/mark-read: clica + auto-confirma o overlay
        nativeEl.click();
        waitForElement('.overlay button[type="submit"].button--primary, .overlay .button--cta', 4000).then(c => c && c.click());
    }

    // GRUPO 3 — ações PRIMÁRIAS (ícones que PROXY-CLICAM o nativo): ir-pra-nova · seguir · marcar lido · traduzir
    function smgPrimaryActions(bo) {
        const g = document.createElement('div'); g.className = 'smg-bar-group smg-bar-actions';
        let n = 0;
        const jumpNew = bo.querySelector('[data-xf-click="scroll-to"]');
        if (jumpNew) { g.appendChild(smgBarBtn({ icon: svgIcon('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'), title: 'Go to new', onClick: () => jumpNew.click() })); n++; }
        const watch = bo.querySelector('[data-sk-watch]');
        if (watch) {
            // ICONS.watch/unwatch JÁ são <svg> completos → usar direto. Estado por idioma-neutro + destaque.
            const b = smgBarBtn({ icon: ICONS.watch, title: 'Watch' });
            const paint = on => {
                b.querySelector('.smg-bar-ic').innerHTML = on ? ICONS.unwatch : ICONS.watch;
                b.title = on ? 'Unwatch' : 'Watch';
                b.classList.toggle('smg-bar-btn--on', on);   // destaca quando seguindo
            };
            paint(smgIsWatching(watch));
            b.addEventListener('click', () => {
                paint(!smgIsWatching(watch));                // REATIVO: vira na hora (otimista)
                smgProxyConfirm(watch);
                setTimeout(() => paint(smgIsWatching(watch)), 1500);  // re-sincroniza
            });
            g.appendChild(b); n++;
        }
        const markRead = bo.querySelector('a[href*="mark-read"]');
        if (markRead) { g.appendChild(smgBarBtn({ icon: ICONS.shareDone, title: 'Mark read', onClick: () => smgProxyConfirm(markRead) })); n++; }
        const tr = bo.querySelector('.smgTranslator-globalBtn');
        if (tr) { g.appendChild(smgBarBtn({ icon: svgIcon(SMG_ICO.globe), title: 'Translate', onClick: () => tr.click() })); n++; }
        // HIDE/SHOW DISCUSSIONS (addon do site): vira ícone na barra (proxy-click no nativo escondido), junto do translate.
        // ESPELHA o nativo: ícone eye/eye-slash + texto + contagem vêm dele (sem assumir semântica/idioma). bo.querySelector
        // primeiro (1 nativo por block-outer, igual translate); fallback no document se vier solto. Guard 1×/elemento:
        // 2 barras (topo+rodapé) compartilhando UM nativo → 1 proxy só (evita dessincronizar); natives por-barra → 1 cada.
        const disc = bo.querySelector('.smg-discussion-toggle') || document.querySelector('.smg-discussion-toggle');
        if (disc && !disc.dataset.smgDiscProxied) {
            disc.dataset.smgDiscProxied = '1';
            const txtEl = disc.querySelector('.smg-toggle-text');
            const cntEl = disc.querySelector('.smg-discussion-count');
            const b = smgBarBtn({ icon: svgIcon(SMG_ICO.eyeOff), title: 'Hide Discussions' });
            const paint = () => {
                const slash = !!disc.querySelector('.fa-eye-slash');   // espelha o ícone nativo (eye-slash = mostrando → clicar esconde)
                b.querySelector('.smg-bar-ic').innerHTML = svgIcon(slash ? SMG_ICO.eyeOff : SMG_ICO.eye);
                const txt = (txtEl && txtEl.textContent.trim()) || i18n('Discussions');
                const cnt = (cntEl && cntEl.textContent.trim()) || '';
                const lbl = txt + (cnt ? ' ' + cnt : '');
                b.title = lbl; b.setAttribute('aria-label', lbl);   // tooltip = texto+contagem vivos do nativo
                b.classList.toggle('smg-bar-btn--on', !slash);   // destaca quando as discussões estão ESCONDIDAS
            };
            paint();
            b.addEventListener('click', () => { disc.click(); setTimeout(paint, 60); });   // proxy-click + re-sincroniza
            g.appendChild(b); n++;   // o nativo é escondido por CSS (.smg-discussion-toggle-container, em 05) — robusto a múltiplas instâncias + re-render do addon
        }
        return n ? g : null;
    }

    // GRUPO 4 — "Mais" (•••): menu nativo + botões diretos não-primários (ex.: Bump), deduplicados.
    // Cada linha PROXY-CLICA o nativo (preserva overlay/menu do XF) → nada some.
    function smgMoreButton(bo) {
        const moreTrigger = bo.querySelector('.menuTrigger, button[data-xf-click="menu"]');
        const moreMenu = moreTrigger && (moreTrigger.parentElement?.querySelector('.menu .menu-content')
            || (moreTrigger.closest('.buttonGroup-buttonWrapper') || {}).querySelector?.('.menu-content'));
        const items = [], seen = new Set();
        const push = (el, label) => {
            const key = (label || '').toLowerCase().replace(/\s+/g, ' ').trim();
            if (!key || seen.has(key)) return; seen.add(key);
            items.push({ label: (label || '').trim(), el });
        };
        if (moreMenu) moreMenu.querySelectorAll('.menu-linkRow').forEach(r => push(r, r.textContent));
        bo.querySelectorAll('.buttonGroup .button--link, .buttonGroup a.button, .buttonGroup button.button').forEach(b => {
            if (b.classList.contains('menuTrigger') || b.hasAttribute('data-sk-watch') || b.classList.contains('smgTranslator-globalBtn')
                || b.getAttribute('data-xf-click') === 'scroll-to' || (b.getAttribute('href') || '').indexOf('mark-read') >= 0) return;
            push(b, (b.querySelector('.button-text') || b).textContent);
        });
        if (!items.length) return null;
        const g = document.createElement('div'); g.className = 'smg-bar-group smg-bar-more';
        const btn = smgBarBtn({ label: '⋯', title: 'More' });
        const pop = document.createElement('div'); pop.className = 'smg-bar-pop';
        items.forEach(it => {
            const row = document.createElement('button'); row.type = 'button'; row.className = 'smg-bar-poprow'; row.textContent = it.label;
            row.addEventListener('click', e => { e.stopPropagation(); btn.closest('.smg-bar-pophost').classList.remove('open'); it.el.click(); });
            pop.appendChild(row);
        });
        g.appendChild(smgPopHost(btn, pop));
        return g;
    }

    function smgDivider() { const d = document.createElement('span'); d.className = 'smg-bar-div'; return d; }

    // HEADER DA THREAD (.p-body-header): linha de ações (feed · galeria · download, maiores) ACIMA do título,
    // e remove autor + data da linha de descrição (mantém as tags). Roda 1× no boot (header é server-render, estático).
    function buildThreadHeader() {
        if (!document.documentElement.classList.contains('smg-thread')) return;   // só em thread (fórum tem .p-body-header também)
        const header = document.querySelector('.p-body-header:not([data-smg-thead])');
        if (!header) return;
        header.setAttribute('data-smg-thead', '1');
        // tira autor + data da .p-description (mantém as tags)
        const desc = header.querySelector('.p-description');
        if (desc) {
            const u = desc.querySelector('a.username'); const ul = u && u.closest('li'); if (ul) ul.remove();
            const t = desc.querySelector('time'); const tl = t && t.closest('li'); if (tl) tl.remove();
        }
        // linha de ações no topo do header (feed/galeria/download), com navegação própria (página 1)
        const bar = document.createElement('div'); bar.className = 'smg-thead-actions';
        const mk = (icon, title, label, onClick) => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'smg-thead-btn';
            b.title = i18n(title); b.setAttribute('aria-label', i18n(title));
            b.innerHTML = '<span class="smg-thead-ic">' + icon + '</span>';
            const l = document.createElement('span'); l.className = 'smg-thead-lbl'; l.textContent = i18n(label);   // visível só no mobile (CSS)
            b.appendChild(l);
            if (onClick) b.addEventListener('click', onClick);
            b.addEventListener('mouseenter', () => smgShowTip(b, b.title));   // reusa o tooltip fixed da barra
            b.addEventListener('mouseleave', smgHideTip); b.addEventListener('click', smgHideTip);
            return b;
        };
        // ícones outline limpos (sem depender de fill): feed = play · galeria = grade · download = seta. Label só no mobile.
        if (FEATURES.mediaFeed) bar.appendChild(mk(svgIcon('<polygon points="6 3 20 12 6 21 6 3"/>'), 'Feed mode', 'Feed', () => openMediaFeed(null, null, { fromStart: true })));
        bar.appendChild(mk(ICONS.gallery, 'Gallery', 'Gallery', () => openGallery()));
        if (FEATURES.mediaDownload) { const d = mk(ICONS.download, 'Download media', 'Download', null); d.addEventListener('click', () => openDownloadModal()); bar.appendChild(d); }
        // DESKTOP: na linha do título, fixo à direita (dentro do .p-title → coluna centralizada).
        // MOBILE: a barra DESCE pra depois das tags → ordem unificada título → tags → ações
        // (antes a barra full-width entrava no meio e as tags ficavam órfãs DEPOIS dos botões).
        // matchMedia move o nó só ao cruzar o breakpoint (1 listener, zero custo no scroll/resize comum).
        const title = header.querySelector('.p-title');
        const placeBar = mobile => {
            if (mobile && desc && desc.parentNode) desc.insertAdjacentElement('afterend', bar);
            else if (title) title.appendChild(bar);
            else header.insertBefore(bar, header.firstChild);
        };
        const mqMob = window.matchMedia ? window.matchMedia('(max-width: 600px)') : null;
        placeBar(!!(mqMob && mqMob.matches));
        if (mqMob) { const onMq = e => placeBar(e.matches); if (mqMob.addEventListener) mqMob.addEventListener('change', onMq); else if (mqMob.addListener) mqMob.addListener(onMq); }
    }

    function buildFilterBars() {
        const cl = document.documentElement.classList;
        if (!cl.contains('smg-thread') && !cl.contains('smg-threadlist')) return;   // os 2 sites (SMG + simpcity)
        document.querySelectorAll('.block-outer:not([data-smg-bar])').forEach(bo => {
            const wrap = bo.querySelector('.pageNavWrapper');
            const bar = document.createElement('div'); bar.className = 'smg-bar';
            const add = g => { if (!g) return; if (bar.children.length) bar.appendChild(smgDivider()); bar.appendChild(g); };
            // ordem: pager · ações(…sino…traduzir) · ORDENAR · mais(•••)
            add(wrap ? smgPagerGroup(wrap) : null);
            add(smgPrimaryActions(bo));
            add(smgSortGroup(bo));
            add(smgMoreButton(bo));
            bo.setAttribute('data-smg-bar', '1');      // marca SEMPRE (mesmo barra vazia) → não re-varre/reconstrói todo frame
            if (!bar.children.length) return;          // nada útil nessa barra → deixa o nativo
            // esconde os nativos (ficam no DOM: proxy-click + scroll infinito leem deles)
            Array.from(bo.children).forEach(c => c.style.setProperty('display', 'none', 'important'));
            bo.insertBefore(bar, bo.firstChild);
        });
    }

    // =========================================================
    // POST estilo REDDIT: card de 1 coluna — header (avatar · nome · tempo · #N + título/banners/stats),
    // conteúdo (inalterado) e action bar (React · Comentar · Compartilhar · Salvar · Traduzir · ⋯).
    // MOVE os botões NATIVOS pro card (preserva o AJAX/tooltip/picker do XF — os relative-selectors do XF
    // resolvem porque tudo continua DENTRO do mesmo <article>); o CSS (.smg-pc) esconde os containers vazios
    // (coluna do usuário, attribution, actionBar nativa). Escopado (buildPostCards no processAll) → pega posts
    // do scroll infinito. 1×/post via data-smg-card.
    // =========================================================
    function smgRelTime(tsSec) {   // epoch s → "há 4 meses" / "4mo ago"
        let s = Math.floor(Date.now() / 1000) - tsSec;
        if (s < 45) return IS_PT ? 'agora' : 'now';
        const U = IS_PT
            ? [[31536000, 'ano', 'anos'], [2592000, 'mês', 'meses'], [604800, 'semana', 'semanas'], [86400, 'dia', 'dias'], [3600, 'hora', 'horas'], [60, 'minuto', 'minutos']]
            : [[31536000, 'y', 'y'], [2592000, 'mo', 'mo'], [604800, 'w', 'w'], [86400, 'd', 'd'], [3600, 'h', 'h'], [60, 'm', 'm']];
        for (const [sec, one, many] of U) {
            const n = Math.floor(s / sec);
            if (n >= 1) return IS_PT ? ('há ' + n + ' ' + (n === 1 ? one : many)) : (n + many + ' ago');
        }
        return IS_PT ? 'agora' : 'now';
    }
    function smgKNum(n) { return n >= 1000 ? (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '') + 'k' : String(n); }
    function smgReactionLabel(n) {   // o react é um CONTADOR: "1 reação" / "6 reações" (PT) · "1 reaction" / "6 reactions" (EN)
        const w = IS_PT ? (n === 1 ? 'reação' : 'reações') : (n === 1 ? 'reaction' : 'reactions');
        return smgKNum(n) + ' ' + w;
    }
    function smgPostReactionCount(post) {   // SÓ as reações do POST: a .reactionsBar dele. NÃO somar comentários (usam .comment-reactions) — era o "React 6"
        const bar = post.querySelector('.message-cell--main .reactionsBar');
        let n = 0; if (bar) bar.querySelectorAll('.smgReactionPill-count').forEach(c => n += parseInt(c.textContent, 10) || 0);
        if (n) return n;
        const md = post.querySelector('.message-footer .message-microdata meta[itemprop="userInteractionCount"]');
        if (md && +md.getAttribute('content')) return +md.getAttribute('content');
        if (bar) { const names = bar.querySelectorAll('.reactionsBar-link bdi').length; const m = (bar.textContent || '').match(/(\d[\d.,]*)\s*(?:outros|others)/i); return names + (m ? (parseInt(m[1].replace(/[.,]/g, ''), 10) || 0) : 0); }
        return 0;
    }
    function smgActLabel(el, text) {   // garante rótulo de texto no botão movido (share/save são só ícone)
        if (el.querySelector('.smg-pc-act-lbl')) return;
        const s = document.createElement('span'); s.className = 'smg-pc-act-lbl'; s.textContent = i18n(text);
        el.appendChild(s);
    }
    // popover ⋯ : UM listener de document p/ TODOS os cards (antes era 1 por post/comentário —
    // centenas acumulados no scroll infinito, cada clique na página rodava N contains()).
    // Só um popover fica aberto por vez → fechar é O(1) via referência.
    let openMoreWrap = null, moreCloseBound = false;
    function smgToggleMore(wrap) {
        if (openMoreWrap && openMoreWrap !== wrap) { openMoreWrap.classList.remove('open'); openMoreWrap = null; }
        const on = wrap.classList.toggle('open');
        openMoreWrap = on ? wrap : null;
        if (!moreCloseBound) {
            moreCloseBound = true;
            document.addEventListener('click', e => {
                if (openMoreWrap && !openMoreWrap.contains(e.target)) { openMoreWrap.classList.remove('open'); openMoreWrap = null; }
            });
        }
    }
    function buildPostCard(post) {
        post.dataset.smgCard = '1';   // marca ANTES do guard (REGRA DE OURO): post deletado/placeholder sem marca era re-varrido em todo full-scan
        const inner = post.querySelector(':scope > .message-inner');
        const main = inner && inner.querySelector(':scope > .message-cell--main');
        if (!inner || !main) return;   // não é um post padrão (deletado/placeholder) → deixa nativo
        post.classList.add('smg-pc');
        const messageMain = main.querySelector('.message-main') || main;
        const userCell = inner.querySelector(':scope > .message-cell--user');
        const attribution = messageMain.querySelector('.message-attribution');
        const footerBar = messageMain.querySelector('.message-actionBar');

        // ---------- HEADER ----------
        const head = document.createElement('div'); head.className = 'smg-pc-head';
        const avatar = userCell && userCell.querySelector('.message-avatar a.avatar, .message-avatar .avatar');
        if (avatar) { avatar.classList.add('smg-pc-avatar'); head.appendChild(avatar); }
        const meta = document.createElement('div'); meta.className = 'smg-pc-meta';
        const row1 = document.createElement('div'); row1.className = 'smg-pc-row1';
        const idline = document.createElement('div'); idline.className = 'smg-pc-idline';
        const name = userCell && userCell.querySelector('.message-name');
        if (name) { name.classList.add('smg-pc-name'); idline.appendChild(name); }
        const timeEl = attribution && attribution.querySelector('time');
        if (timeEl) {
            const ts = +(timeEl.getAttribute('data-timestamp') || 0);
            const dot = document.createElement('span'); dot.className = 'smg-pc-dot'; dot.textContent = '·';
            const t = document.createElement('span'); t.className = 'smg-pc-time';
            t.textContent = ts ? smgRelTime(ts) : (timeEl.textContent || '').trim();
            t.title = timeEl.getAttribute('title') || (timeEl.textContent || '').trim();
            idline.append(dot, t);
        }
        // DISCUSSÃO (social): badge "DISCUSSION" + indicador "silent" (vivem no attribution) → entram na idline após o tempo
        const discBadge = attribution && attribution.querySelector('.smg-discussion-badge');
        if (discBadge) idline.appendChild(discBadge);
        const silent = attribution && attribution.querySelector('.smg-silent-indicator');
        if (silent) idline.appendChild(silent);
        row1.appendChild(idline);
        let postNum = null;
        if (attribution) attribution.querySelectorAll('a').forEach(a => { if (!postNum && /^D?#\d/.test((a.textContent || '').trim())) postNum = a; });   // #398 (post) ou D#1 (discussão, .smg-discussion-number)
        if (postNum) { postNum.classList.add('smg-pc-num'); row1.appendChild(postNum); }
        meta.appendChild(row1);
        const row2 = document.createElement('div'); row2.className = 'smg-pc-row2';
        const title = userCell && userCell.querySelector('.userTitle');
        if (title) { title.classList.add('smg-pc-utitle'); row2.appendChild(title); }
        if (userCell) userCell.querySelectorAll('.userBanner').forEach(b => row2.appendChild(b));
        const badges = userCell && userCell.querySelector('.featuredBadges');
        if (badges) row2.appendChild(badges);
        if (row2.childNodes.length) meta.appendChild(row2);
        // 3ª linha (stats do usuário: cadastro · mensagens · pontos) removida a pedido — não anexa o .message-userExtras
        head.appendChild(meta);
        messageMain.insertBefore(head, messageMain.firstChild);

        // ---------- ACTION BAR ----------
        const bar = document.createElement('div'); bar.className = 'smg-pc-actions';
        const react = footerBar && footerBar.querySelector('.actionBar-action--reaction');
        if (react) {
            react.classList.add('smg-pc-act', 'smg-pc-act--react');
            // CONTADOR: ícone limpo (thumbs-up) + "N reações". O visual nativo (sprite/<i>/emoji/"React" = a "asa" torta) fica escondido via CSS.
            const ic = document.createElement('span'); ic.className = 'smg-pc-react-ic'; ic.innerHTML = svgIcon(SMG_ICO.thumb);
            const lbl = document.createElement('span'); lbl.className = 'smg-pc-react-n'; lbl.textContent = smgReactionLabel(smgPostReactionCount(post));
            react.insertBefore(lbl, react.firstChild); react.insertBefore(ic, react.firstChild);
            bar.appendChild(react);
        }
        const comment = footerBar && footerBar.querySelector('.uw_fcs_post_comment');   // social = comentário; simp não tem
        const reply = footerBar && footerBar.querySelector('.actionBar-action--reply');
        const commentBtn = comment || reply;   // sem comentário (simp) → Responder vira o "Comentar". Já tem TEXTO nativo (Comment/Responder/Reply) → NÃO adiciona rótulo (senão duplica: "Responder Reply")
        if (commentBtn) { commentBtn.classList.add('smg-pc-act', 'smg-pc-act--comment'); bar.appendChild(commentBtn); }
        const save = attribution && attribution.querySelector('a.bookmarkLink');
        if (save) { save.classList.add('smg-pc-act', 'smg-pc-act--save'); smgActLabel(save, 'Save'); bar.appendChild(save); }
        const translate = footerBar && footerBar.querySelector('.smgTranslator-btn');
        if (translate) { translate.classList.add('smg-pc-act', 'smg-pc-act--translate'); bar.appendChild(translate); }
        const share = attribution && attribution.querySelector('a.message-attribution-gadget[data-xf-init="share-tooltip"]');   // Share = ÚLTIMO (depois do translate)
        if (share) { share.classList.add('smg-pc-act', 'smg-pc-act--share'); smgActLabel(share, 'Share'); bar.appendChild(share); }
        // ⋯ overflow: multiquote · (reply, se Comentar veio do comentário) · denunciar
        const moreItems = [];
        const mq = footerBar && footerBar.querySelector('.js-multiQuote'); if (mq) moreItems.push(mq);
        if (comment && reply) moreItems.push(reply);
        const report = footerBar && footerBar.querySelector('.actionBar-action--report'); if (report) moreItems.push(report);
        if (moreItems.length) {
            const moreWrap = document.createElement('div'); moreWrap.className = 'smg-pc-morewrap';
            const moreBtn = document.createElement('button'); moreBtn.type = 'button'; moreBtn.className = 'smg-pc-act smg-pc-act--more'; moreBtn.setAttribute('aria-label', i18n('More')); moreBtn.textContent = '⋯';
            const pop = document.createElement('div'); pop.className = 'smg-pc-morepop';
            moreItems.forEach(el => { el.classList.add('smg-pc-morerow'); pop.appendChild(el); });
            moreBtn.addEventListener('click', e => { e.stopPropagation(); smgToggleMore(moreWrap); });
            moreWrap.append(moreBtn, pop); bar.appendChild(moreWrap);
        }
        const content = messageMain.querySelector('.message-content');
        if (content) content.insertAdjacentElement('afterend', bar); else messageMain.appendChild(bar);
    }
    function buildPostCards(roots) {
        if (!document.documentElement.classList.contains('smg-thread')) return;   // só em thread (onde há posts)
        eachIn(roots, 'article.message:not([data-smg-card])', buildPostCard);
    }

    // COMENTÁRIOS (uw_fcs, só no SMG): mesmo modelo do post — header compacto (avatar · user · tempo · #N),
    // body, action bar leve (react · responder · ⋯ citar/denunciar/traduzir/share). Indentação (thread-line) via CSS.
    // MOVE os nativos (preserva AJAX); reusa o popover ⋯ do post (smg-pc-more*). 1×/comentário via data-smg-cc.
    function buildCommentCard(comment) {
        comment.dataset.smgCc = '1';   // marca ANTES do guard (REGRA DE OURO)
        const cinner = comment.querySelector(':scope > .comment-inner');
        if (!cinner) return;
        comment.classList.add('smg-cc');
        const cmain = cinner.querySelector(':scope > .comment-main');
        const cwrap = cmain && cmain.querySelector('.comment-contentWrapper');
        const footerBar = comment.querySelector('.comment-footer .comment-actionBar');

        const head = document.createElement('div'); head.className = 'smg-cc-head';
        const avatar = cinner.querySelector(':scope > .comment-avatar a.avatar, :scope > .comment-avatar .avatar');
        if (avatar) { avatar.classList.add('smg-cc-avatar'); head.appendChild(avatar); }
        const idline = document.createElement('div'); idline.className = 'smg-cc-idline';
        const userLink = cwrap && cwrap.querySelector('a.comment-user');
        if (userLink) { userLink.classList.add('smg-cc-name'); idline.appendChild(userLink); }
        const timeEl = cwrap && cwrap.querySelector('time');
        if (timeEl) {
            const ts = +(timeEl.getAttribute('data-timestamp') || 0);
            const dot = document.createElement('span'); dot.className = 'smg-pc-dot'; dot.textContent = '·';
            const t = document.createElement('span'); t.className = 'smg-cc-time';
            t.textContent = ts ? smgRelTime(ts) : (timeEl.textContent || '').trim();
            t.title = timeEl.getAttribute('title') || '';
            idline.append(dot, t);
        }
        let numA = null;
        const opp = cwrap && cwrap.querySelector('.message-attribution-opposite');
        if (opp) opp.querySelectorAll('a').forEach(a => { if (!numA && /#[\d.]/.test((a.textContent || '').trim())) numA = a; });
        if (numA) { numA.classList.add('smg-cc-num'); idline.appendChild(numA); }
        head.appendChild(idline);
        cinner.insertBefore(head, cinner.firstChild);

        const bar = document.createElement('div'); bar.className = 'smg-cc-actions';
        const react = footerBar && footerBar.querySelector('.actionBar-action--reaction');
        if (react) {
            react.classList.add('smg-cc-act', 'smg-cc-act--react');
            let n = 0; comment.querySelectorAll('.comment-reactions .smgReactionPill-count').forEach(c => n += parseInt(c.textContent, 10) || 0);
            const ic = document.createElement('span'); ic.className = 'smg-cc-react-ic'; ic.innerHTML = svgIcon(SMG_ICO.thumb);
            const lbl = document.createElement('span'); lbl.className = 'smg-cc-react-n'; lbl.textContent = smgReactionLabel(n);
            react.insertBefore(lbl, react.firstChild); react.insertBefore(ic, react.firstChild);
            bar.appendChild(react);
        }
        const cReply = footerBar && footerBar.querySelector('.uw_cq_btn');   // "Comment" = responder AO comentário (já tem texto nativo)
        if (cReply) { cReply.classList.add('smg-cc-act', 'smg-cc-act--comment'); bar.appendChild(cReply); }
        // ⋯ : compartilhar · citar · denunciar · traduzir
        const moreItems = [];
        const cShare = cwrap && cwrap.querySelector('.uw_fcs_comment_share'); if (cShare) moreItems.push(cShare);
        [footerBar && footerBar.querySelector('.actionBar-action--reply'), footerBar && footerBar.querySelector('.actionBar-action--report'), footerBar && footerBar.querySelector('.smgTranslator-btn')].forEach(el => { if (el) moreItems.push(el); });
        if (moreItems.length) {
            const mw = document.createElement('div'); mw.className = 'smg-pc-morewrap';
            const mb = document.createElement('button'); mb.type = 'button'; mb.className = 'smg-cc-act smg-cc-act--more'; mb.setAttribute('aria-label', i18n('More')); mb.textContent = '⋯';
            const pop = document.createElement('div'); pop.className = 'smg-pc-morepop';
            moreItems.forEach(el => { el.classList.add('smg-pc-morerow'); pop.appendChild(el); });
            mb.addEventListener('click', e => { e.stopPropagation(); smgToggleMore(mw); });
            mw.append(mb, pop); bar.appendChild(mw);
        }
        const body = comment.querySelector('.comment-body');
        if (body) body.insertAdjacentElement('afterend', bar); else (comment.querySelector('.js-quickEditTargetComment') || cinner).appendChild(bar);
    }
    function buildCommentCards(roots) {
        if (!document.documentElement.classList.contains('smg-thread')) return;
        eachIn(roots, '.message-responses .comment:not([data-smg-cc])', buildCommentCard);
    }
    // header da seção de comentários (SMG/uw_fcs): label "Sort:" antes do chip + "Previous comments" → "Load more"
    function buildCommentBar(roots) {
        if (!document.documentElement.classList.contains('smg-thread')) return;
        eachIn(roots, '.uw-comment-count .uw-fcs-sort-toggle:not([data-smg-sortlbl])', t => {
            t.dataset.smgSortlbl = '1';
            const lbl = document.createElement('span'); lbl.className = 'smg-cbar-sortlbl'; lbl.textContent = i18n('Sort:');
            t.insertBefore(lbl, t.firstChild);
        });
        eachIn(roots, '.uw_load_prev:not([data-smg-lm])', a => { a.dataset.smgLm = '1'; a.textContent = i18n('Load more'); });   // re-aparece após cada load → pass por-elemento
    }

    // (THREAD header restyle removido — era dead code, nunca chamado; buildFilterBars cobre pager/ordenar/ações nos 2 sites)

    // carrega um popup de lista do XF (alertas/mensagens) e devolve o nó da lista;
    // _xfResponseType=json → só o conteúdo já preenchido · _xfToken → evita "Security error"
    function fetchXfList(fetchUrl) {
        const csrf = document.documentElement.getAttribute('data-csrf')
            || (document.querySelector('input[name="_xfToken"]') || {}).value || '';
        const url = fetchUrl + (fetchUrl.indexOf('?') >= 0 ? '&' : '?') + '_xfResponseType=json'
            + (csrf ? '&_xfToken=' + encodeURIComponent(csrf) : '');
        return fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            .then(r => r.text())
            .then(t => {
                let html = t;
                try { const j = JSON.parse(t); html = (j.html && (j.html.content || j.html)) || j.content || t; } catch (e) {}
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                return tmp.querySelector('.listPlain') || tmp.querySelector('.js-alertsMenuBody') || tmp.querySelector('.js-convMenuBody') || tmp;
            });
    }

    // =========================================================
    // FEATURE: alertas "Limpo" — tira ruído do HTML nativo do XF
    // nativo: "<autor> postou no/replied to <chips> <título>. Podem haver/There may be… · hora · marcar-lido"
    // limpo : 3 linhas → (1) tags coloridas  (2) nome do tópico  (3) publicado por @autor · data + botão marcar-lido
    // Simp usa <span class="label label--x">, SMG usa <span class="prefix prefixx"> — pegamos os dois.
    // estratégia: extrai as peças nativas (move = preserva handlers AJAX) e remonta o .contentRow-main do zero.
    // =========================================================

    // marca um alerta como lido NO SERVIDOR (XF) e atualiza o estado local + o contador do sino
    function markAlertRead(li, btn, href) {
        if (!href || btn.dataset.busy) return;
        btn.dataset.busy = '1';
        const csrf = document.documentElement.getAttribute('data-csrf')
            || (document.querySelector('input[name="_xfToken"]') || {}).value || '';
        // XF valida CSRF de POST pelo CORPO (form-urlencoded), não pela query — replicamos o XF.ajax
        fetch(href, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: '_xfToken=' + encodeURIComponent(csrf) + '&_xfResponseType=json&_xfWithData=1'
        })
            .then(r => r.text().then(txt => ({ ok: r.ok, txt })))
            .then(({ ok, txt }) => {
                let j = null; try { j = JSON.parse(txt); } catch (e) {}
                if (!ok || (j && (j.errors || j.errorHtml))) throw new Error('xf');   // falhou no servidor → NÃO marca local
                if (li && li.classList) { li.classList.remove('is-unread'); li.classList.add('smg-al-old'); }   // some o dot + esmaece na hora (virou lida)
                btn.remove();
                const nav = document.querySelector('.p-navgroup-link--alerts');   // baixa o contador → o observer sincroniza topbar/dock
                if (nav) {
                    const n = Math.max(0, (parseInt(nav.getAttribute('data-badge') || '0', 10) || 0) - 1);
                    if (n > 0) nav.setAttribute('data-badge', String(n)); else nav.removeAttribute('data-badge');
                }
            })
            .catch(() => { delete btn.dataset.busy; });   // falhou → permite tentar de novo
    }
    function cleanAlertRow(main) {
        if (!main || main.dataset.smgAlert) return;
        // título = nome do tópico. Em alerta de COMENTÁRIO o .fauxBlockLink-blockLink é a palavra "commented"
        // e o tópico vem num <a href="/threads/…"> separado → preferimos o link de thread quando existe.
        const title = main.querySelector('a[href*="/threads/"]') || main.querySelector('.fauxBlockLink-blockLink');
        main.dataset.smgAlert = '1';                                    // marca ANTES do guard → alerta sem tópico não é re-escaneado a cada refresh
        if (!title) return;                                             // tipo de alerta sem tópico: deixa nativo (só i18n)
        const isComment = !!main.querySelector('a[href*="/comments/"]');
        // ícone de tipo à ESQUERDA (comentário vs publicação) — diferencia rápido, no lugar da foto removida
        const row = main.parentElement;
        if (row && row.classList.contains('contentRow') && !row.querySelector(':scope > .smg-al-icon')) {
            const ico = document.createElement('span');
            ico.className = 'smg-al-icon ' + (isComment ? 'smg-al-icon--comment' : 'smg-al-icon--post');
            ico.innerHTML = isComment ? ICONS.comment : ICONS.newPost;
            row.insertBefore(ico, row.firstChild);
        }

        const minor = main.querySelector('.contentRow-minor');
        const chips = Array.from(main.querySelectorAll('.label, .prefix'));   // Simp = .label · SMG = .prefix
        const userLink = main.querySelector('a.username, a[href*="/members/"]');

        // linha 3 — tags: move os chips nativos (com a cor da plataforma) pra fora do título
        const tags = document.createElement('div');
        tags.className = 'smg-al-tags';
        chips.forEach(c => { if (c !== title && !c.contains(title)) { c.classList.add('smg-al-chip'); tags.appendChild(c); } });

        // título: chips já saíram → textContent é só o NOME; separadores ( | / ) viram vírgula
        title.textContent = (title.textContent || '')
            .replace(/[|/]/g, ',').replace(/\s*,\s*/g, ', ')
            .replace(/(?:,\s*)+$/, '').replace(/^\s*,\s*/, '')
            .replace(/\s{2,}/g, ' ').trim();
        title.classList.add('smg-al-title');

        // linha 2 — publicado por @autor · hora · ✕
        const by = document.createElement('div');
        by.className = 'smg-al-by';
        if (userLink && userLink !== title) {
            const uname = (userLink.textContent || '').trim().replace(/^@/, '');
            if (uname) {
                userLink.textContent = '@' + uname;
                userLink.classList.add('smg-al-user');
                by.appendChild(document.createTextNode(isComment ? (IS_PT ? 'comentário de ' : 'commented by ') : (IS_PT ? 'publicado por ' : 'posted by ')));
                by.appendChild(userLink);
            }
        }
        let markHref = null;
        if (minor) {
            const timeEl = minor.querySelector('time');
            if (timeEl) { timeEl.classList.add('smg-al-time'); by.appendChild(timeEl); }
            const markRead = Array.from(minor.querySelectorAll('a')).find(a => {
                const href = a.getAttribute('href') || '', cls = a.className || '', txt = (a.textContent || '').trim();
                return /alert-toggle|\/alert\/\d+\/(?:un)?read|mark-read|mark_read/i.test(href)
                    || /alert--mark|alertToggle|alertToggler/i.test(cls)
                    || /^(?:mark read|mark unread|marcar como lido|marcar como não lida|unread|não lida)$/i.test(txt);
            });
            markHref = markRead && markRead.getAttribute('href');
        }

        // remonta do zero: (1) tags · (2) nome · (3) publicado-por+data — verbo, boilerplate e foto não voltam
        main.textContent = '';
        if (tags.children.length) main.appendChild(tags);
        main.appendChild(title);
        if (by.childNodes.length) main.appendChild(by);

        // botão "marcar como lido" SEMPRE visível nas não-lidas — persiste no servidor + atualiza o estado
        const li = main.closest('li.alert') || main.closest('li');
        if (markHref && li && li.classList && li.classList.contains('is-unread')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'smg-al-read';
            btn.title = i18n('Mark read');
            btn.setAttribute('aria-label', i18n('Mark read'));
            const lbl = document.createElement('span');     // texto "Marcar como lido" — só aparece no mobile (CSS)
            lbl.className = 'smg-al-read-txt';
            lbl.textContent = i18n('Mark read');
            btn.appendChild(lbl);
            btn.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); markAlertRead(li, btn, markHref); });
            main.appendChild(btn);
        }
    }

    // agrupa em "Novas" (não lidas) e "Anteriores" (lidas) — estilo Facebook, com cabeçalho de seção
    function groupAlerts(list) {
        const ol = (list.matches && list.matches('ol, ul')) ? list
                 : (list.querySelector && list.querySelector('ol.listPlain, ul.listPlain, ol, ul'));
        if (!ol || ol.dataset.smgGrouped) return;
        const rows = Array.from(ol.children).filter(li => li.querySelector && li.querySelector('.contentRow-main'));
        if (!rows.length) return;
        ol.dataset.smgGrouped = '1';
        const unread = rows.filter(li => li.classList && li.classList.contains('is-unread'));
        const read = rows.filter(li => unread.indexOf(li) < 0);
        const mkHeader = txt => { const li = document.createElement('li'); li.className = 'smg-al-section'; li.textContent = txt; return li; };
        ol.textContent = '';   // limpa rows + separador nativo + espaços em branco
        if (unread.length) { ol.appendChild(mkHeader(IS_PT ? 'Não lidas' : 'Unread')); unread.forEach(li => ol.appendChild(li)); }
        if (read.length) { ol.appendChild(mkHeader(IS_PT ? 'Lidas' : 'Read')); read.forEach(li => { li.classList.add('smg-al-old'); ol.appendChild(li); }); }
    }

    function cleanAlertList(list) {
        if (!list) return;
        try {
            if (list.classList) list.classList.add('smg-alert-clean');
            list.querySelectorAll('.contentRow-main:not([data-smg-alert])').forEach(main => {
                try { cleanAlertRow(main); } catch (e) {}
            });
            groupAlerts(list);
        } catch (e) {}
        i18nDom(list);   // "Mark read" → "Marcar como lido" + qualquer resíduo EN do HTML buscado
    }

    // =========================================================
    // FEATURE: topbar reformulada (ícones + popovers agrupados)
    // lê os links REAIS da nav nativa via data-nav-id → funciona no simpcity e no smg
    //
    // buildTopbar() é uma função só; mapa interno (Cmd+F): ZONA ESQUERDA (logo+Discover) ·
    //   ZONA CENTRAL (search bar) · ZONA DIREITA (notices/seguindo/alertas/conta) ·
    //   "// ----" abrir/fechar popovers · docked→flutuante · sheets mobile (sino/Discover/User)
    // =========================================================
    let topbarBuilt = false;
    function buildTopbar() {
        if (topbarBuilt || document.getElementById('smg-topbar-wrap')) return;
        if (!document.querySelector('.p-nav')) return; // sem nav nativa = nada a fazer
        topbarBuilt = true;

        const badgeOf = sel => {
            const el = document.querySelector(sel);
            const n = el ? parseInt(el.getAttribute('data-badge') || '0', 10) : 0;
            return n > 0 ? n : 0;
        };
        const postThreadHref = (() => {
            const e = document.querySelector('.p-title-pageAction a[href*="post-thread"], .p-title-pageAction a[href*="create-thread"], .p-title-pageAction a[href*="add-thread"]');
            return e ? e.getAttribute('href') : null;
        })();

        // carrega a lista nativa do XF (alertas/etc) dentro de `body`: conteúdo → erro.
        // rethrow no catch p/ quem chamou resetar seu próprio flag de "já carregou".
        const loadXfListInto = (body, url, cleanAlerts) =>
            fetchXfList(url)
                .then(node => { body.innerHTML = ''; body.appendChild(node); if (cleanAlerts) cleanAlertList(node); })
                .catch(err => { body.innerHTML = '<div class="smg-tb-loading">' + i18n('Error loading.') + '</div>'; throw err; });

        // topbar em 3 zonas: ESQUERDA (logo + Discover) · CENTRO (search bar) · DIREITA (Seguindo · Notificações · User)
        // a navbar inferior (mobile) segue com os mesmos destinos via dock
        const discoverItems = [
            { section: 'Explore' },
            { label: 'Trending', desc: 'Most popular right now', icon: ICONS.flame, href: navHref('trending', 'smgtrending', 'trending2') },
            { label: 'What\'s new', desc: 'Recently posted', icon: ICONS.sparkles, href: navHref('whatsNew', 'whatsNew2') || '/whats-new/' },
            { label: 'New posts', desc: 'Latest messages', icon: ICONS.layers, href: navHref('whatsNewPosts', 'newPosts', 'whatsNewPosts2') || '/whats-new/posts/' },
            { label: 'Featured', desc: 'Featured content', icon: ICONS.star, href: navHref('featured') },
            { label: 'Activity', desc: 'Activity feed', icon: ICONS.activity, href: navHref('latestActivity') },
            { section: 'Threads' },
            { label: 'Find threads', desc: 'Browse threads', icon: ICONS.search, href: navHref('findThreads') || '/find-threads/started' },
            { label: 'Unanswered', desc: 'Awaiting a reply', icon: ICONS.help, href: navHref('unansweredThreads') || '/find-threads/unanswered' },
            { section: 'Community' },
            { label: 'Members', desc: 'Member list', icon: ICONS.users, href: navHref('members') || '/members/' },
            { label: 'Online now', desc: 'Who\'s online', icon: ICONS.user, href: navHref('currentVisitors') || '/online/' },
        ];
        // esquerda = só o Discover (dropdown). Seguindo/Notificações/User viram ícones à DIREITA.
        const watchedHref = navHref('watchedThreads', 'watched', 'watchedThreads2') || '/watched/threads';
        const groups = [
            { label: 'Discover', mega: true, icon: ICONS.compass, items: discoverItems, featured: {   // mega-menu (grid 2-col + ícones em tile + painel destacado), estilo Vimeo
                title: 'Timeline', desc: 'Posts from the threads you follow, newest first.', cta: 'Open Timeline',
                href: '/?view=feed', icon: ICONS.feed,
            } },
            { label: 'Timeline', icon: ICONS.feed, href: '/?view=feed' },   // ex-"Feed": river de posts das threads seguidas; mora SÓ na home (ver 22-feed.js)
            { label: 'Following', icon: ICONS.rss, href: watchedHref },     // threads que você segue (watched) — RSS ("inscrito nas atualizações"), distinto do bookmark de Salvos
        ];

        const wrap = document.createElement('div');
        wrap.id = 'smg-topbar-wrap';
        const bar = document.createElement('div');
        bar.id = 'smg-topbar';
        // inner alinhado à largura do conteúdo (ehentai): barra é full-width, inner é centralizado
        const inner = document.createElement('div');
        inner.id = 'smg-tb-inner';

        // logo (lido da nav nativa antes de escondê-la)
        const logoImg = document.querySelector('.p-header-logo img, .uix_logo img');
        const logoA = document.createElement('a');
        logoA.className = 'smg-tb-logo';
        logoA.href = '/';
        if (document.documentElement.classList.contains('smg-smg')) { logoA.innerHTML = SMG_LOGO_HTML; logoA.classList.add('smg-tb-logo--custom'); }
        else if (logoImg) { const im = document.createElement('img'); im.src = logoImg.getAttribute('src') || ''; im.alt = ''; logoA.appendChild(im); }
        else logoA.textContent = 'Home';
        // ZONA ESQUERDA: logo + Discover (o logo já é o "Início")
        const left = document.createElement('div');
        left.className = 'smg-tb-left';
        left.appendChild(logoA);

        const popovers = [];

        // navegação (esquerda) = só o Discover
        const nav = document.createElement('div');
        nav.className = 'smg-tb-nav';

        const cleanDiv = arr => { // remove divisores duplicados/nas pontas
            const out = [];
            arr.forEach(it => { if (it.divider) { if (out.length && !out[out.length - 1].divider) out.push(it); } else out.push(it); });
            while (out.length && out[out.length - 1].divider) out.pop();
            return out;
        };
        // mega-menu (Discover): agrupa em seções → grid de 2 colunas (ícone em tile + label + desc) + painel destacado à direita (estilo Vimeo)
        const arrowR = ICONS.arrowRight;
        const buildMegaPop = (items, feat) => {
            const secs = [];
            items.forEach(it => {
                if (it.section) { secs.push({ title: it.section, rows: [] }); return; }
                if (!it.href) return;                         // item sem destino (navHref vazio) → pula
                if (!secs.length) secs.push({ title: '', rows: [] });
                secs[secs.length - 1].rows.push(it);
            });
            const main = secs.filter(s => s.rows.length).map(s =>
                '<div class="smg-tb-mega-sec">' +
                (s.title ? '<div class="smg-tb-mega-label">' + s.title + '</div>' : '') +
                '<div class="smg-tb-mega-grid">' +
                s.rows.map(it =>
                    '<a class="smg-tb-megaitem" href="' + safeHref(it.href) + '">' +
                        '<span class="smg-tb-megaico">' + it.icon + '</span>' +
                        '<span class="smg-tb-megatext"><span class="smg-tb-megatitle">' + it.label + '</span>' +
                        (it.desc ? '<span class="smg-tb-megadesc">' + it.desc + '</span>' : '') + '</span>' +
                    '</a>'
                ).join('') +
                '</div></div>'
            ).join('');
            let html = '<div class="smg-tb-mega-cols"><div class="smg-tb-mega-main">' + main + '</div>';
            if (feat) html += '<a class="smg-tb-mega-feat" href="' + safeHref(feat.href) + '">' +
                '<div class="smg-tb-mega-feat-art">' + (feat.icon || '') + '</div>' +
                '<div class="smg-tb-mega-feat-body">' +
                    '<div class="smg-tb-mega-feat-title">' + feat.title + '</div>' +
                    '<div class="smg-tb-mega-feat-desc">' + feat.desc + '</div>' +
                    '<div class="smg-tb-mega-feat-cta">' + feat.cta + arrowR + '</div>' +
                '</div></a>';
            return html + '</div>';
        };
        groups.forEach(g => {
            if (g.href) { // atalho = link direto (sem dropdown)
                const a = document.createElement('a');
                a.className = 'smg-tb-item';
                a.href = g.href;
                a.innerHTML = (g.icon ? '<span class="smg-tb-ico">' + g.icon + '</span>' : '') + '<span>' + g.label + '</span>';
                nav.appendChild(a);
                return;
            }
            if (g.mega) {   // Discover → mega-menu (grid + painel destacado), não a lista simples
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'smg-tb-item smg-tb-trigger';
                btn.innerHTML = (g.icon ? '<span class="smg-tb-ico">' + g.icon + '</span>' : '') + '<span>' + g.label + '</span><span class="smg-tb-caret">' + ICONS.hide + '</span>';
                const pop = document.createElement('div');
                pop.className = 'smg-tb-pop smg-tb-pop--mega';
                pop.innerHTML = buildMegaPop(g.items, g.featured);
                nav.appendChild(btn);
                wrap.appendChild(pop);
                popovers.push({ btn, pop });
                return;
            }
            const items = cleanDiv(g.items.filter(it => it.divider || it.href));
            if (!items.some(it => !it.divider)) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'smg-tb-item smg-tb-trigger';
            btn.innerHTML = (g.icon ? '<span class="smg-tb-ico">' + g.icon + '</span>' : '') + '<span>' + g.label + '</span><span class="smg-tb-caret">' + ICONS.hide + '</span>';
            const pop = document.createElement('div');
            pop.className = 'smg-tb-pop';
            pop.innerHTML = items.map(it => it.divider
                ? '<div class="smg-tb-popdiv"></div>'
                : '<a class="smg-tb-poprow" href="' + safeHref(it.href) + '">' +
                    '<span class="smg-tb-popico">' + it.icon + '</span>' +
                    '<span class="smg-tb-poptext"><span class="smg-tb-poptitle">' + it.label + '</span><span class="smg-tb-popdesc">' + it.desc + '</span></span>' +
                '</a>'
            ).join('');
            nav.appendChild(btn);
            wrap.appendChild(pop);
            popovers.push({ btn, pop });
        });
        inner.appendChild(left);   // ESQUERDA = só o logo (a nav foi pro centro)

        // ZONA CENTRAL: navegação (Discover · Timeline · Following), centralizada — estilo Spellbook
        const center = document.createElement('div');
        center.className = 'smg-tb-center smg-tb-center--nav';
        center.appendChild(nav);
        inner.appendChild(center);

        // SEARCH vira OVERLAY que OCUPA a topbar quando aberto (disparado pelo ícone de busca na direita; reusa toda a engine do setupSearch)
        const searchBar = document.createElement('div');
        searchBar.className = 'smg-tb-search smg-tb-search--overlay';
        const tbInput = document.createElement('input');
        tbInput.type = 'text';
        tbInput.className = 'smg-tb-search-input';
        tbInput.placeholder = i18n('Search the forum…');
        tbInput.setAttribute('aria-label', i18n('Search'));
        tbInput.setAttribute('enterkeyhint', 'search');
        tbInput.autocapitalize = 'off'; tbInput.autocomplete = 'off'; tbInput.spellcheck = false;
        searchBar.innerHTML = '<span class="smg-tb-search-ico">' + ICONS.search + '</span>';
        // chip de contexto (Reddit-style): "Buscar em <tópico/fórum>" com × — preenchido/mostrado/escondido pelo setupSearch
        const tbChip = document.createElement('button');
        tbChip.type = 'button'; tbChip.className = 'smg-tb-search-chip smg-search-chip'; tbChip.hidden = true;
        tbChip.innerHTML = '<span class="smg-search-chip-t"></span><span class="smg-search-chip-x" aria-label="' + i18n('Clear') + '">' + ICONS.close + '</span>';
        searchBar.appendChild(tbChip);
        searchBar.appendChild(tbInput);
        // botão ⇥ — indica/abre a paleta de comandos (Tab)
        const tbCmd = document.createElement('button');
        tbCmd.type = 'button'; tbCmd.className = 'smg-search-cmdbtn'; tbCmd.title = i18n('Commands (Tab)'); tbCmd.setAttribute('aria-label', i18n('Commands (Tab)'));
        tbCmd.textContent = '⇥'; searchBar.appendChild(tbCmd);   // a própria paleta (Tab/⇥) lista os comandos → dispensa o "?" separado
        // busca avançada (link) + config de defaults (engrenagem); href setado já aqui (o setupSearch roda antes do topbar existir)
        const tbAdv = document.createElement('a');
        tbAdv.className = 'smg-search-adv'; tbAdv.target = '_blank'; tbAdv.rel = 'noopener'; tbAdv.setAttribute('aria-label', i18n('Advanced'));
        tbAdv.href = ((document.querySelector('form[data-xf-init="quick-search"]') || {}).getAttribute && document.querySelector('form[data-xf-init="quick-search"]').getAttribute('action') || '/search/search').replace(/search\/?$/, '');
        tbAdv.innerHTML = ICONS.filter; searchBar.appendChild(tbAdv);   // funil = busca avançada (distinto da config)
        const tbCfg = document.createElement('button');
        tbCfg.type = 'button'; tbCfg.className = 'smg-search-cfg'; tbCfg.setAttribute('aria-label', i18n('Search defaults'));
        tbCfg.innerHTML = ICONS.sliders; searchBar.appendChild(tbCfg);   // sliders = ajustar defaults (distinto da engrenagem do dock)
        // (sem botão "Buscar": digitar já busca via debounce; Enter força + grava; "Ver todos" abre a página cheia)
        // foco/clique → abre o dropdown (setupSearch decide drop vs modal) · Enter → busca · Esc → fecha. Eventos custom desacoplam do escopo da dock.
        const tbOpenSearch = () => document.dispatchEvent(new CustomEvent('smg-search-open'));
        tbInput.addEventListener('focus', tbOpenSearch);
        tbInput.addEventListener('click', tbOpenSearch);
        tbInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); document.querySelector('#smg-search-pop .smg-search-go')?.click(); }
            else if (e.key === 'Escape') { e.preventDefault(); document.dispatchEvent(new CustomEvent('smg-search-close')); tbInput.blur(); }
        });
        // placeholder ROTATIVO — alterna a cada 3s (pausa enquanto você digita/foca). Edite SEARCH_HINTS com os termos que quiser.
        const SEARCH_HINTS = [
            i18n('Search the forum…'),
            'Lana Rhoades', 'Mia Khalifa', 'Brandi Love', 'Riley Reid', 'Abella Danger',
            'Angela White', 'Eva Elfie', 'Sweetie Fox', 'Liya Silver', 'Gabbie Carter',
            'Pokimane', 'Amouranth', 'Emiru', 'Kyedae', 'Valkyrae',
            'Alinity', 'Loserfruit', 'Chica', 'QuarterJade', 'LilyPichu',
        ];
        if (SEARCH_HINTS.length > 1) {
            let hintI = 0;
            setInterval(() => {
                if (document.hidden || !tbInput.offsetParent) return;   // aba em background / busca fechada → não gira placeholder que ninguém vê
                if (tbInput.value || document.activeElement === tbInput) return;
                if (document.documentElement.classList.contains('smg-search-scoped')) return;   // chip de contexto ativo → placeholder fixo "Buscar em X"
                hintI = (hintI + 1) % SEARCH_HINTS.length;
                tbInput.placeholder = SEARCH_HINTS[hintI];
            }, 3000);
        }
        // botão de fechar o overlay de busca (X à direita do input)
        const searchClose = document.createElement('button');
        searchClose.type = 'button'; searchClose.className = 'smg-tb-search-close'; searchClose.setAttribute('aria-label', 'Close');
        searchClose.innerHTML = ICONS.close;
        searchClose.addEventListener('click', () => document.dispatchEvent(new CustomEvent('smg-search-close')));
        searchBar.appendChild(searchClose);
        inner.appendChild(searchBar);

        // ações (direita)
        const actions = document.createElement('div');
        actions.className = 'smg-tb-actions';
        const iconAct = (icon, label, href, badge) => {
            const a = document.createElement(href ? 'a' : 'button');
            if (href) a.href = href; else a.type = 'button';
            a.className = 'smg-tb-act';
            a.setAttribute('aria-label', label);
            a.title = label;
            a.innerHTML = '<span class="smg-tb-ico">' + icon + '</span>' + (badge ? '<span class="smg-tb-badge">' + (badge > 99 ? '99+' : badge) + '</span>' : '');
            return a;
        };

        // dropdown de lista (alertas) — agora ÍCONE à direita, conteúdo nativo do XF sob demanda
        const listPopover = (icon, label, badge, fetchUrl, allHref, markHref, iconOnly) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = (iconOnly ? 'smg-tb-act' : 'smg-tb-item') + ' smg-tb-trigger';
            btn.setAttribute('aria-label', label);
            btn.title = label;
            btn.innerHTML = iconOnly
                ? '<span class="smg-tb-ico">' + icon + '</span>'
                    + (badge ? '<span class="smg-tb-badge">' + (badge > 99 ? '99+' : badge) + '</span>' : '')
                : '<span class="smg-tb-ico">' + icon + '</span><span>' + label + '</span>'
                    + (badge ? '<span class="smg-tb-badge smg-tb-badge--inline">' + (badge > 99 ? '99+' : badge) + '</span>' : '');
            const pop = document.createElement('div');
            pop.className = 'smg-tb-pop smg-tb-pop--list';
            pop.innerHTML =
                '<div class="smg-tb-acchead">' + label + '</div>' +
                '<div class="smg-tb-listbody"><div class="smg-tb-loading">Loading…</div></div>' +
                '<div class="smg-tb-popfoot"><a href="' + allHref + '">See all</a>' + (markHref ? '<a href="' + markHref + '">Mark read</a>' : '') + '</div>';
            let loaded = false;
            const load = () => {
                if (loaded) return;
                loaded = true;
                loadXfListInto(pop.querySelector('.smg-tb-listbody'), fetchUrl, /alert/i.test(fetchUrl)).catch(() => { loaded = false; });
            };
            return { btn, pop, noSwitch: true, onOpen: load };
        };

        // NOTICES: ficam no banner nativo DENTRO da página (.notices--block) — não são mais recolhidos pra topbar.

        // ZONA DIREITA, ícone 1 — Search: abre o overlay que ocupa a topbar (Following saiu daqui → virou nav central)
        const searchBtn = iconAct(ICONS.search, 'Search');
        searchBtn.classList.add('smg-tb-searchbtn');
        searchBtn.addEventListener('click', e => {
            e.stopPropagation();   // não borbulha pro handler de clique-fora (capture pointerdown) que reverteria
            document.dispatchEvent(new CustomEvent('smg-search-open'));
            // foco robusto: agora + próximo frame + fallback (query fresca; o overlay precisa estar focável)
            const f = () => { const inp = document.querySelector('.smg-tb-search-input'); if (inp) try { inp.focus({ preventScroll: true }); } catch (x) {} };
            f(); requestAnimationFrame(f); setTimeout(f, 80);
        });
        actions.appendChild(searchBtn);

        // ZONA DIREITA, ícone 2 — Notificações (ícone + badge, dropdown à direita)
        const alertsPop = listPopover(ICONS.alerts, 'Alerts', badgeOf('.p-navgroup-link--alerts'), '/account/alerts-popup', '/account/alerts', '/account/alerts/mark-read', true);
        alertsPop.btn.classList.add('smg-rt-alerts');   // alvo do sync reativo de badge
        actions.appendChild(alertsPop.btn); wrap.appendChild(alertsPop.pop); popovers.push({ ...alertsPop, right: true });

        // ZONA DIREITA, ícone 3 — conta (avatar + popover)
        const accBtn = document.createElement('button');
        accBtn.type = 'button';
        accBtn.className = 'smg-tb-account';
        const userLink = document.querySelector('.p-navgroup-link--user');
        const uname = (userLink && userLink.getAttribute('title')) || 'Account';
        accBtn.setAttribute('aria-label', 'Account');
        // clona o avatar nativo do XF — foto onde existe, ou o avatar-letra colorido
        const navAv = document.querySelector('.p-navgroup-link--user .avatar') || document.querySelector('.p-account .avatar');
        if (navAv) accBtn.appendChild(navAv.cloneNode(true));
        else accBtn.textContent = (uname[0] || '?').toUpperCase();

        const accPop = document.createElement('div');
        accPop.className = 'smg-tb-pop smg-tb-pop--account';
        const accSections = [
            [ // conta
                { label: 'Profile', icon: ICONS.user, href: navHref('profile', 'defaultYourProfile') || '/account/' },
                { label: 'Your account', icon: ICONS.settings, href: navHref('defaultYourAccount') || '/account/' },
            ],
            [ // salvos + assistidos — logo abaixo da conta (pedido)
                { label: 'Bookmarks', icon: ICONS.bookmarks, href: navHref('bookmarks') || '/account/bookmarks' },
                { label: 'Watched forums', icon: ICONS.alerts, href: navHref('watchedForums', 'watchedForums2') || '/watched/forums' },
            ],
            [ // criar / comunicação
                { label: 'Post thread', icon: ICONS.plus, href: postThreadHref },
                { label: 'Messages', icon: ICONS.mail, href: navHref('directMessages', 'conversations') || '/direct-messages/' },
            ],
            [ // "Meus" — itens pessoais que estavam espalhados em outros menus
                { label: 'Your threads', icon: ICONS.layers, href: navHref('yourThreads') || '/find-threads/started' },
                { label: 'Contributed', icon: ICONS.chat, href: navHref('contributedThreads') || '/find-threads/contributed' },
                { label: 'Your tickets', icon: ICONS.help, href: navHref('YourTickets') },
            ],
            [ // ações
                { label: 'Preferences', icon: ICONS.sliders, href: navHref('settings') || '/account/preferences' },
                { label: 'History', icon: ICONS.sortDate, href: navHref('history') },
                { label: 'Log out', icon: ICONS.postUp, href: navHref('defaultLogOut') || '/logout/' },
            ],
        ];
        const accRow = it => '<a class="smg-tb-poprow smg-tb-poprow--sm" href="' + safeHref(it.href) + '"><span class="smg-tb-popico">' + it.icon + '</span><span class="smg-tb-poptitle">' + it.label + '</span></a>';
        accPop.innerHTML = '<div class="smg-tb-acchead"></div>' +
            accSections.map(sec => sec.filter(it => it.href)).filter(sec => sec.length)
                .map(sec => sec.map(accRow).join('')).join('<div class="smg-tb-popdiv"></div>');
        accPop.querySelector('.smg-tb-acchead').textContent = uname;   // nome do user via textContent (não interpola HTML)
        actions.appendChild(accBtn);
        wrap.appendChild(accPop);
        popovers.push({ btn: accBtn, pop: accPop, right: true });   // sem noSwitch → abre no HOVER (igual Discover)

        inner.appendChild(actions);
        bar.appendChild(inner);
        wrap.appendChild(bar);
        // prepend (não append): no desktop é fixed (tanto faz), mas no mobile a barra é position:static
        // e precisa ser o 1º elemento do body pra renderizar no TOPO (senão cai pro fim da página)
        document.body.insertBefore(wrap, document.body.firstChild);
        document.documentElement.classList.add('smg-topbar-on');

        // ---- abrir/fechar popovers (megamenu: hover troca, clique abre/fecha) ----
        const wirePopovers = () => {
            let openIdx = -1;
            const place = (btn, pop) => {
                const br = btn.getBoundingClientRect();
                const center = (br.left - bar.getBoundingClientRect().left) + br.width / 2;   // centro do botão relativo à barra
                const left = center - pop.offsetWidth / 2;                                     // centraliza o pop sob o item
                const maxLeft = bar.offsetWidth - pop.offsetWidth - 8;
                pop.style.right = 'auto';
                pop.style.left = Math.max(8, Math.min(left, maxLeft)) + 'px';
            };
            const closeAll = () => {
                popovers.forEach(p => { p.pop.classList.remove('open'); p.btn.classList.remove('active'); });
                openIdx = -1;
            };
            const openAt = i => {
                closeAll();
                const p = popovers[i];
                p.btn.classList.add('active');
                if (p.right) { // alinha pela direita do botão (barra é full-width)
                    const r = p.btn.getBoundingClientRect();
                    p.pop.style.left = 'auto';
                    p.pop.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
                } else place(p.btn, p.pop);
                p.pop.classList.add('open');
                if (p.onOpen) p.onOpen();
                openIdx = i;
            };
            // hover: os menus "hoveráveis" (Discover) abrem ao passar o mouse e fecham ao sair
            // (com ponte pelo próprio popover). Alerts/Conta (noSwitch) seguem só no clique.
            let hoverTimer = null;
            const cancelHoverClose = () => { if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; } };
            const scheduleHoverClose = i => { cancelHoverClose(); hoverTimer = setTimeout(() => { if (openIdx === i) closeAll(); }, 180); };
            popovers.forEach((p, i) => {
                p.btn.addEventListener('click', e => { e.stopPropagation(); cancelHoverClose(); if (openIdx === i) closeAll(); else openAt(i); });
                if (!p.noSwitch) {
                    p.btn.addEventListener('mouseenter', () => { cancelHoverClose(); openAt(i); });
                    p.btn.addEventListener('mouseleave', () => scheduleHoverClose(i));
                    p.pop.addEventListener('mouseenter', cancelHoverClose);
                    p.pop.addEventListener('mouseleave', () => scheduleHoverClose(i));
                }
            });
            document.addEventListener('click', e => { if (!wrap.contains(e.target)) closeAll(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
        };
        wirePopovers();

        // ---- docked no topo → flutuante após rolar ----
        const syncDock = () => { wrap.classList.toggle('floating', window.scrollY > 40); };
        onScrollRaf(syncDock);
        syncDock();

        // ---- mobile: bottom sheets (sino/Discover/User) — concern separada do topbar desktop ----
        const buildMobileSheets = () => {
            // o sino da navbar inferior abre um SHEET com os alertas
            const aSheet = document.createElement('div');
            aSheet.id = 'smg-alerts-sheet';
            aSheet.className = 'smg-sheet';
            aSheet.innerHTML =
                '<div class="smg-csheet-panel">' +
                    '<div class="smg-sheet-grip"></div>' +
                    '<div class="smg-csheet-head"><span>Alerts</span><a href="/account/alerts">See all</a></div>' +
                    '<div class="smg-csheet-body smg-tb-listbody"><div class="smg-tb-loading">Loading…</div></div>' +
                '</div>';
            document.body.appendChild(aSheet);
            let aSheetLoaded = false;
            const openAlertsSheet = () => {
                aSheet.classList.add('open');
                if (aSheetLoaded) return;
                aSheetLoaded = true;
                loadXfListInto(aSheet.querySelector('.smg-csheet-body'), '/account/alerts-popup', true).catch(() => { aSheetLoaded = false; });
            };
            aSheet.addEventListener('click', e => { if (e.target === aSheet) aSheet.classList.remove('open'); });
            const navBell = document.getElementById('smg-nav-alerts');
            if (navBell) navBell.addEventListener('click', e => {
                if (window.matchMedia('(max-width: 600px)').matches) { e.preventDefault(); openAlertsSheet(); }
            });

            // helper genérico de bottom sheet (Discover / User)
            const makeSheet = (id, title, bodyHTML) => {
                const s = document.createElement('div');
                s.id = id;
                s.className = 'smg-sheet';
                s.innerHTML =
                    '<div class="smg-csheet-panel">' +
                        '<div class="smg-sheet-grip"></div>' +
                        '<div class="smg-csheet-head"><span>' + title + '</span></div>' +
                        '<div class="smg-csheet-body">' + bodyHTML + '</div>' +
                    '</div>';
                document.body.appendChild(s);
                s.addEventListener('click', e => { if (e.target === s) s.classList.remove('open'); });
                return s;
            };
            const sheetRow = it => it.divider
                ? '<div class="smg-tb-popdiv"></div>'
                : '<a class="smg-tb-poprow" href="' + safeHref(it.href) + '">' +
                    '<span class="smg-tb-popico">' + it.icon + '</span>' +
                    '<span class="smg-tb-poptext"><span class="smg-tb-poptitle">' + it.label + '</span>' +
                    (it.desc ? '<span class="smg-tb-popdesc">' + it.desc + '</span>' : '') + '</span>' +
                '</a>';
            const wireSheet = (btnId, sheet) => {
                const b = document.getElementById(btnId);
                if (b) b.addEventListener('click', e => { e.preventDefault(); sheet.classList.add('open'); });
            };

            // Discover → sheet com os mesmos itens do dropdown da topbar
            const dSheet = makeSheet('smg-discover-sheet', 'Discover',
                cleanDiv(discoverItems.filter(it => it.divider || it.href)).map(sheetRow).join(''));
            wireSheet('smg-nav-discover', dSheet);

            // User → sheet com as seções do menu de conta (Salvos mora aqui agora)
            const uBody = '<div class="smg-csheet-user"></div>' +
                accSections.map(sec => sec.filter(it => it.href)).filter(sec => sec.length)
                    .map(sec => sec.map(sheetRow).join('')).join('<div class="smg-tb-popdiv"></div>');
            const uSheet = makeSheet('smg-user-sheet', 'Account', uBody);
            uSheet.querySelector('.smg-csheet-user').textContent = uname;   // nome do user via textContent
            wireSheet('smg-nav-user', uSheet);

            return { aSheet, dSheet, uSheet };
        };
        const { aSheet, dSheet, uSheet } = buildMobileSheets();
        // arrastar pra baixo fecha os sheets mobile de alerts / profile / discover (mesmo gesto do modal de busca)
        [aSheet, uSheet, dSheet].filter(Boolean).forEach(s =>
            addSwipeClose(s.querySelector('.smg-csheet-panel'), () => s.classList.remove('open'), () => s.classList.contains('open')));

        // traduz TODA a UI da topbar + sheets mobile (Discover/User/Alertas) de uma vez.
        // só casa chaves em inglês → nome de usuário e conteúdo nativo passam intactos.
        i18nDom(wrap); i18nDom(aSheet); i18nDom(dSheet); i18nDom(uSheet);
    }

    // NOTICES recolhidos: esconde o banner nativo (.notices--block) e deixa só um iconezinho (megafone + contagem)
    // NO LUGAR dele, DENTRO da página. Clicar abre um popover com os avisos. Roda em qualquer página que tenha avisos.
    let smgNoticesDone = false;
    function setupHeaderNotices() {
        // na HOME, espera a barra de abas (latest/trending/following) montar — o ícone vai PRA ELA, não pro banner
        if (document.documentElement.classList.contains('smg-home') && FEATURES.homeRemake && !document.documentElement.classList.contains('smg-watched-feed') && !document.querySelector('.smg-feed-tabs')) return;   // home normal: espera as abas; modo feed: não espera (a tab não vem — vai pro header do river)
        if (document.documentElement.classList.contains('smg-watched-feed') && !document.querySelector('.smg-river-head')) return;   // modo feed: espera o header do river montar (o ícone mora nele) — re-tenta no próximo pass
        const blocks = document.querySelectorAll('.notices--block:not([data-smg-noticed])');
        if (!blocks.length) return;
        const seen = new Set();
        const notices = [];
        let firstBlock = null;
        blocks.forEach(b => {
            if (!firstBlock) firstBlock = b;
            b.setAttribute('data-smg-noticed', '1');
            b.querySelectorAll('.notice').forEach(n => {
                const c = n.querySelector('.notice-content');
                const txt = c && (c.textContent || '').trim();
                if (!txt) return;                                   // caixa vazia (bug do XF) → ignora
                const id = n.getAttribute('data-notice-id') || txt.slice(0, 60);
                if (seen.has(id)) return; seen.add(id);             // dedupe (o scroller do XF clona o <li>)
                notices.push(c.cloneNode(true));                    // clona já (o banner vai ser escondido)
            });
            b.style.setProperty('display', 'none', 'important');    // esconde o banner nativo
        });
        if (smgNoticesDone || !notices.length || !firstBlock) return;   // launcher 1x; sem texto → fica só escondido
        smgNoticesDone = true;

        const w = document.createElement('div');
        w.className = 'smg-notices';
        w.innerHTML =
            '<button type="button" class="smg-notices-btn" aria-label="' + i18n('Notices') + '" title="' + i18n('Notices') + '">' +
                '<span class="smg-notices-ico">' + ICONS.megaphone + '</span>' +
                '<span class="smg-notices-badge">' + notices.length + '</span>' +
            '</button>' +
            '<div class="smg-notices-pop"><div class="smg-notices-head">' + i18n('Notices') + '</div><div class="smg-notices-body"></div></div>';
        const body = w.querySelector('.smg-notices-body');
        notices.forEach(c => { const it = document.createElement('div'); it.className = 'smg-notice-item'; it.appendChild(c); body.appendChild(it); });
        const riverHead = document.documentElement.classList.contains('smg-watched-feed')
            ? (document.querySelector('.smg-river-head-actions') || document.querySelector('.smg-river-head')) : null;
        const homeTabs = document.querySelector('.smg-feed-tabs');
        const titleVal = document.querySelector('.p-body-header .p-title-value');
        if (riverHead) {   // MODO FEED (home): ícone no header do river ("Feed" + ações) — banner nativo já escondido
            w.classList.add('smg-notices--bar');
            riverHead.appendChild(w);
        } else if (homeTabs) {   // HOME: na barra de abas, à direita (antes do "See all")
            w.classList.add('smg-notices--bar');
            const seeAll = homeTabs.querySelector('.smg-feed-seeall');
            if (seeAll) homeTabs.insertBefore(w, seeAll); else homeTabs.appendChild(w);
        } else if (titleVal) {
            titleVal.appendChild(w);   // THREAD: inline, à DIREITA do título
        } else {
            firstBlock.parentNode.insertBefore(w, firstBlock);   // fallback (página sem título/abas): no lugar do banner
        }
        i18nDom(w);
        const btn = w.querySelector('.smg-notices-btn');
        btn.addEventListener('click', e => { e.stopPropagation(); w.classList.toggle('open'); });
        document.addEventListener('click', e => { if (!w.contains(e.target)) w.classList.remove('open'); });   // clique-fora fecha
        document.addEventListener('keydown', e => { if (e.key === 'Escape') w.classList.remove('open'); });
    }

    // =========================================================
    // WATERMARK de fonte das IMAGENS: badge flutuante no canto sup-direito da img sob o cursor (SÓ no hover).
    //   imagem → host da URL (sourceLabel). Os PLAYERS têm o PRÓPRIO badge clicável embutido (.smg-rgc-src, "Fonte ↗").
    //   1 badge flutuante (não embrulha a img → não mexe no masonry). Esconde no scroll/saída.
    // =========================================================
    function sourceLabel(url) {
        let host; try { host = new URL(url, location.href).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; }
        if (/redgifs/.test(host)) return 'RedGifs';
        if (/turbo|turbocdn/.test(host)) return 'Turbo';
        if (/saint/.test(host)) return 'Saint';
        if (/imagepond/.test(host)) return 'ImagePond';
        if (/imgbox/.test(host)) return 'imgbox';
        if (/imagebam/.test(host)) return 'ImageBam';
        const sld = host.split('.').slice(-2)[0] || '';
        return sld ? sld.charAt(0).toUpperCase() + sld.slice(1) : '';
    }
    let srcWmBound = false;
    function setupSourceWatermark() {
        if (srcWmBound) return; srcWmBound = true;
        // <a> (não <div>): o badge da FONTE é CLICÁVEL → abre a imagem no host (igual o .smg-rgc-src do player de vídeo).
        const badge = document.createElement('a'); badge.className = 'smg-src-wm'; badge.style.display = 'none';
        badge.target = '_blank'; badge.rel = 'noopener noreferrer';
        (document.body || document.documentElement).appendChild(badge);
        let cur = null;
        const hide = () => { if (cur) { badge.style.display = 'none'; badge.removeAttribute('href'); cur = null; } };
        const show = media => {
            const raw = media.currentSrc || media.getAttribute('src') || '';
            const name = sourceLabel(raw);
            if (!name) { hide(); return; }
            const r = media.getBoundingClientRect();
            if (r.width < 70 || r.height < 50) { hide(); return; }   // muito pequeno → não mostra
            badge.textContent = name;
            badge.href = safeHref(media.dataset.smgFull || getBigUrl(raw));   // clicar → abre a imagem original no host
            badge.style.top = (r.top + 8) + 'px';
            badge.style.left = (r.right - 8) + 'px';
            badge.style.display = 'block';
            cur = media;
        };
        document.addEventListener('mouseover', e => {
            const media = e.target.closest && e.target.closest('img.bbImage');
            if (media && media !== cur) show(media);
        }, true);
        document.addEventListener('mouseout', e => {
            if (!cur) return;
            const to = e.relatedTarget;
            if (to === badge || (to && badge.contains(to))) return;   // indo PRO badge → mantém (senão somia antes do clique)
            if (!to || !(to.closest && to.closest('img.bbImage') === cur)) hide();
        }, true);
        badge.addEventListener('click', e => { e.stopPropagation(); if (!badge.getAttribute('href')) e.preventDefault(); });   // não dispara o clique-pro-feed da imagem
        window.addEventListener('scroll', hide, { passive: true });
    }

    // =========================================================
    // HOVER preview: popover com a imagem maior ao passar o mouse na thumb (lista/grade)
    // =========================================================
    let thumbPreviewBound = false;
    function dcThumbUrl(thumb) {
        const im = thumb.querySelector('img');
        if (!im) return '';
        const bg = (im.style && im.style.backgroundImage) || '';
        const m = bg.match(/url\(["']?(.*?)["']?\)/i);
        const url = m ? m[1] : (im.getAttribute('src') || '');
        if (!url || url.startsWith('data:')) return '';
        return getBigUrl(url); // tenta a versão maior (.md/.th → full)
    }
    function setupThumbPreview() {
        if (thumbPreviewBound) return;
        if (!window.matchMedia || !matchMedia('(hover: hover)').matches) return; // só em desktop
        thumbPreviewBound = true;

        const pop = document.createElement('div');
        pop.id = 'smg-thumb-pop';
        const img = document.createElement('img');
        pop.appendChild(img);
        document.body.appendChild(pop);

        let cur = null, timer = null;
        const place = () => {
            if (!cur) return;
            const r = cur.getBoundingClientRect();
            const pw = pop.offsetWidth || 400, ph = pop.offsetHeight || 300;
            let left = r.right + 12;
            if (left + pw > window.innerWidth - 8) left = r.left - pw - 12; // sem espaço à direita → esquerda
            if (left < 8) left = 8;
            let top = Math.max(8, Math.min(r.top + r.height / 2 - ph / 2, window.innerHeight - ph - 8));
            pop.style.left = left + 'px';
            pop.style.top = top + 'px';
        };
        const hide = () => { clearTimeout(timer); cur = null; pop.style.display = 'none'; };

        document.addEventListener('mouseover', e => {
            if (!document.documentElement.classList.contains('smg-threadlist')) return;   // bailout barato ANTES do closest (numa thread não há thumb de lista)
            const thumb = e.target.closest && e.target.closest('.dcThumbnail, .dtt-thread-thumbnail');
            if (!thumb || thumb === cur) return;
            const url = dcThumbUrl(thumb);
            if (!url) return;
            cur = thumb;
            clearTimeout(timer);
            timer = setTimeout(() => { // só mostra depois de ~300ms parado sobre a thumb
                if (cur !== thumb) return;
                pop.style.display = 'none'; // esconde enquanto a nova carrega (evita flash da imagem anterior)
                const show = () => {
                    if (cur !== thumb) return; // trocou de thumb durante o carregamento → ignora
                    pop.style.display = 'block';
                    place();
                };
                img.onload = show;
                img.onerror = () => { if (cur === thumb) hide(); };
                if (img.src !== url) img.src = url; else if (img.complete) show();
                if (img.complete && img.naturalWidth) show(); // cache: onload pode não disparar
            }, 300);
        });
        document.addEventListener('mouseout', e => {
            if (!cur) return;   // preview nem está aberto → não paga o closest() em todo mouseout da página
            const thumb = e.target.closest && e.target.closest('.dcThumbnail, .dtt-thread-thumbnail');
            if (thumb && thumb === cur && !thumb.contains(e.relatedTarget)) hide();
        });
        window.addEventListener('scroll', hide, { passive: true });
    }

    // =========================================================
    // FEED DB (IndexedDB) — cache local dos posts das threads seguidas. O RENDER lê daqui
    // (ordenado por ts desc, paginação por cursor = instantânea); o SYNC (22-feed-sync.js)
    // escreve aqui. Stores: posts (key postId, índice ts/threadId) · threads (key threadId) · meta.
    // Tudo LAZY (só abre quando o feed abre) e por origem do fórum. Sem dependência externa.
    //   ⚠️ só guardamos dados serializáveis (strings/números) — nada de nós do DOM (não clonáveis).
    // =========================================================
    const FDB_NAME = 'smg-feed';
    const FDB_VERSION = 2;   // v2: store 'bookmarks' (posts salvos cacheados — feed de /account/bookmarks)
    let fdbPromise = null;
    function fdbOpen() {
        if (fdbPromise) return fdbPromise;
        fdbPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') { reject(new Error('no-indexeddb')); return; }
            const req = indexedDB.open(FDB_NAME, FDB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('posts')) {
                    const s = db.createObjectStore('posts', { keyPath: 'postId' });
                    s.createIndex('ts', 'ts');
                    s.createIndex('threadId', 'threadId');
                }
                if (!db.objectStoreNames.contains('threads')) db.createObjectStore('threads', { keyPath: 'threadId' });
                if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
                if (!db.objectStoreNames.contains('bookmarks')) db.createObjectStore('bookmarks', { keyPath: 'postId' });   // posts salvos cacheados (não passa pelo prune do river)
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return fdbPromise;
    }
    function fdbReq(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
    function fdbStore(name, mode) { return fdbOpen().then(db => db.transaction(name, mode).objectStore(name)); }

    // bulk upsert de posts numa transação só
    function fdbPutPosts(posts) {
        if (!posts || !posts.length) return Promise.resolve(0);
        return fdbOpen().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction('posts', 'readwrite');
            const st = tx.objectStore('posts');
            posts.forEach(p => { if (p && p.postId) st.put(p); });
            tx.oncomplete = () => resolve(posts.length);
            tx.onerror = () => reject(tx.error);
        }));
    }
    // até `limit` posts com ts <= beforeTs (desc), pulando os já vistos (Set de postIds) → cursor da paginação local.
    // afterTs (opcional): limite INFERIOR exclusivo do índice ts → o cursor SÓ visita a faixa ts > afterTs, em vez de
    // começar no topo e pular O(|seen|) posts já-vistos (usado pelo poll de novidades, que só quer a janela acima do floor).
    function fdbGetPostsDesc(limit, beforeTs, seen, afterTs) {
        return fdbOpen().then(db => new Promise((resolve, reject) => {
            const out = [];
            const idx = db.transaction('posts', 'readonly').objectStore('posts').index('ts');
            const hasBefore = beforeTs != null, hasAfter = afterTs != null;
            const range = hasBefore && hasAfter ? IDBKeyRange.bound(afterTs, beforeTs, true, false)   // afterTs < ts <= beforeTs
                : hasBefore ? IDBKeyRange.upperBound(beforeTs)
                : hasAfter ? IDBKeyRange.lowerBound(afterTs, true)                                     // ts > afterTs
                : null;
            const cur = idx.openCursor(range, 'prev');
            cur.onsuccess = () => {
                const c = cur.result;
                if (!c || out.length >= limit) { resolve(out); return; }
                if (!(seen && seen.has(c.value.postId))) out.push(c.value);
                c.continue();
            };
            cur.onerror = () => reject(cur.error);
        }));
    }
    function fdbCountPosts() { return fdbStore('posts', 'readonly').then(st => fdbReq(st.count())); }
    function fdbCountPostsAfter(ts) { return fdbStore('posts', 'readonly').then(st => fdbReq(st.index('ts').count(IDBKeyRange.lowerBound(ts, true)))).catch(() => 0); }   // > ts (pílula "novos")
    function fdbGetThread(id) { return fdbStore('threads', 'readonly').then(st => fdbReq(st.get(id))).catch(() => null); }
    function fdbPutThread(t) { return fdbStore('threads', 'readwrite').then(st => fdbReq(st.put(t))).catch(() => {}); }
    // remove uma thread do cache: o registro + TODOS os posts dela (via índice threadId). Usado ao DEIXAR DE SEGUIR.
    function fdbDeleteThread(tid) {
        const id = String(tid);
        return fdbOpen().then(db => new Promise(resolve => {
            const tx = db.transaction(['posts', 'threads'], 'readwrite');
            const cur = tx.objectStore('posts').index('threadId').openCursor(IDBKeyRange.only(id));
            cur.onsuccess = () => { const c = cur.result; if (!c) return; c.delete(); c.continue(); };
            tx.objectStore('threads').delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        })).catch(() => {});
    }
    function fdbGetMeta(key) { return fdbStore('meta', 'readonly').then(st => fdbReq(st.get(key))).then(r => r ? r.val : undefined).catch(() => undefined); }
    function fdbSetMeta(key, val) { return fdbStore('meta', 'readwrite').then(st => fdbReq(st.put({ key: key, val: val }))).catch(() => {}); }
    // poda posts com ts < cutoff (mantém o banco na janela)
    function fdbPrune(cutoff) {
        return fdbOpen().then(db => new Promise(resolve => {
            const tx = db.transaction('posts', 'readwrite');
            const cur = tx.objectStore('posts').index('ts').openCursor(IDBKeyRange.upperBound(cutoff, true));
            cur.onsuccess = () => { const c = cur.result; if (!c) return; c.delete(); c.continue(); };
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        })).catch(() => {});
    }
    // zera os dados do feed (posts+threads) e os marcadores de sync — força um sweep FUNDO na sequência. Preserva o schema (sem migração de versão do IDB).
    function fdbClearData() {
        return fdbOpen().then(db => new Promise(resolve => {
            const tx = db.transaction(['posts', 'threads', 'meta'], 'readwrite');
            tx.objectStore('posts').clear();
            tx.objectStore('threads').clear();
            ['lastSync', 'lastDeepSync'].forEach(k => tx.objectStore('meta').delete(k));   // o dataVersion é (re)escrito pelo fdbEnsureVersion logo após
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        })).catch(() => {});
    }
    // ---- bookmarks (posts salvos) — cache do feed de /account/bookmarks; rec = { postId, obj (riverParsePost), note, bmTs } ----
    function fdbGetBookmarks() {
        return fdbOpen().then(db => new Promise((res, rej) => {
            const out = [];
            const cur = db.transaction('bookmarks', 'readonly').objectStore('bookmarks').openCursor();
            cur.onsuccess = () => { const c = cur.result; if (!c) { res(out); return; } out.push(c.value); c.continue(); };
            cur.onerror = () => rej(cur.error);
        })).catch(() => []);
    }
    function fdbPutBookmark(rec) { return fdbStore('bookmarks', 'readwrite').then(st => fdbReq(st.put(rec))).catch(() => {}); }
    function fdbDeleteBookmark(postId) { return fdbStore('bookmarks', 'readwrite').then(st => fdbReq(st.delete(String(postId)))).catch(() => {}); }
    // SELF-HEAL: se o dataVersion guardado != versão atual do código, descarta o cache (formato/lógica mudou) e
    // regrava a versão → a página se auto-cura na próxima abertura, sem o usuário limpar nada. Resolve true se resetou.
    function fdbEnsureVersion(version) {
        return fdbGetMeta('dataVersion').then(v => {
            if (v === version) return false;
            return fdbClearData().then(() => fdbSetMeta('dataVersion', version)).then(() => true);
        }).catch(() => false);
    }

    // =========================================================
    // FEATURES definidas tarde no arquivo + safe(). O INIT de verdade
    // (processAll / scheduleRun / boot) está logo abaixo, no part 22-init.
    //
    // Mapa: safe · setFavicon(SMG) · redirect-unwrap (b64decode/decodeProxyHref/bindProxyClick) ·
    //   reveal-liked(SMG) · saint embeds · download (smgDownload/downloadAllMedia) ·
    //   direct-media (processDirectMedia) · group-links (groupPostLinks)
    // =========================================================
    // RESILIÊNCIA: roda um passo sem deixar um erro de UMA feature derrubar as outras
    // (se o XF/UIX mudar um seletor, só aquela feature falha — o resto da página segue de pé).
    function safe(fn, roots) { try { fn(roots); } catch (e) { if (window.console && console.warn) console.warn('[smg] feature error:', (fn && fn.name) || '', e); } }

    // troca a favicon nativa pela marca SMG (remove os <link rel=icon> nativos e põe o nosso).
    // idempotente + auto-cura: se sumir o nosso, recoloca (e tira os nativos de novo).
    function setFavicon() {
        if (!document.documentElement.classList.contains('smg-smg')) return; // SMG only por enquanto
        if (!document.head || document.getElementById('smg-favicon')) return;
        document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach(l => l.remove());
        const link = document.createElement('link');
        link.id = 'smg-favicon'; link.rel = 'icon'; link.type = 'image/svg+xml'; link.href = SMG_FAVICON;
        document.head.appendChild(link);
    }

    // =========================================================
    // FEATURE: pular o aviso de link externo (URL real direto)
    // SMG: /goto/link-confirmation?url=<base64> · Simp: /redirect/?to=<base64url>&m=b64
    // =========================================================
    // base64 std OU url-safe → string (tolerante); e leitura de query SEM o +→espaço do URLSearchParams
    function b64decode(s) {
        if (!s) return null;
        for (const t of [s, s.replace(/-/g, '+').replace(/_/g, '/')]) { try { const r = atob(t); if (r) return r; } catch (e) {} }
        return null;
    }
    function rawParam(href, key) {
        const m = (href || '').match(new RegExp('[?&]' + key + '=([^&]+)'));
        if (!m) return null;
        try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
    }
    function decodeProxyHref(href) {
        if (/\/goto\/link-confirmation/.test(href)) return b64decode(rawParam(href, 'url'));
        let to = rawParam(href, 'to');
        if (to && /[?&]m=b64/.test(href)) to = b64decode(to);
        return to;
    }
    // VISUAL: no TEXTO mostrado (título de unfurl / link cru), troca a URL-proxy (/goto/link-confirmation?url=.. ou
    // /redirect/?to=..) pelo DESTINO real. O unwrap só reescrevia o href; o texto continuava com o /goto/...&s=hash feio.
    // Decodifica CADA ocorrência (decodeProxyHref) → vários links no mesmo nó OK; o que não decodifica fica intacto.
    function unproxyText(root) {
        if (!root || root.nodeType !== 1) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const hits = [];
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const v = n.nodeValue || '';
            if (v.indexOf('/goto/link-confirmation?url=') >= 0 || v.indexOf('/redirect/?to=') >= 0) hits.push(n);
        }
        if (!hits.length) return;
        const rx = /(?:https?:\/\/[^\s"'<>]*)?\/(?:goto\/link-confirmation\?url=|redirect\/\?to=)[^\s"'<>]+/g;
        hits.forEach(t => { t.nodeValue = t.nodeValue.replace(rx, m => { const r = decodeProxyHref(m); return (r && /^https?:/i.test(r)) ? r : m; }); });
    }
    // clique em CAPTURE phase: roda ANTES do handler do XF (link proxy) e força a navegação com
    // stopImmediatePropagation → o handler do XF que matava o clique nunca dispara. Não depende de
    // remover attrs/listener (frágil); o reescrever do href abaixo é só pro hover/"copiar link".
    let proxyClickBound = false;
    function bindProxyClick() {
        if (proxyClickBound) return;
        proxyClickBound = true;
        // no WINDOW em capture: roda ANTES de qualquer listener de document (o XF tem um handler de
        // capture no document que dá preventDefault e matava o clique). NÃO checamos e.defaultPrevented
        // de propósito — navegamos mesmo que o XF já tenha dado preventDefault.
        window.addEventListener('click', e => {
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;  // deixa ctrl/⌘/middle-clique abrir aba nativamente
            const a = e.target.closest && e.target.closest('a[data-smg-unwrap], a[href*="/goto/link-confirmation?url="], a[href*="/redirect/?to="]');
            if (!a) return;
            const real = a.dataset.smgUnwrap ? a.href : decodeProxyHref(a.getAttribute('href') || '');  // já reescrito → href é o real
            if (!real || !/^https?:/i.test(real)) return;
            // garante o href real e MATA o handler do XF — mas NÃO damos preventDefault: a navegação NATIVA
            // do link segue (abre target=_blank sem popup-block, que era o que travava no SMG).
            if (a.getAttribute('href') !== real) a.setAttribute('href', real);
            a.dataset.smgUnwrap = '1';
            e.stopImmediatePropagation();
            if (e.defaultPrevented) {   // se algo já barrou o default antes de nós, aí sim navega na mão
                if (a.target === '_blank') window.open(real, '_blank', 'noopener'); else location.assign(real);
            }
        }, true);
    }
    function unwrapRedirectLinks(roots) {
        bindProxyClick();
        // PERF: `a[href*=...]` é seletor de substring de atributo (NÃO indexado) → varrer o doc inteiro todo frame
        // percorre TODOS os <a>. Escopado nos subtrees mutados (eachIn) sai ~0 no steady-state. O clique em link
        // não-reescrito ainda é garantido pelo capture do bindProxyClick; o full-scan periódico pega o que faltar.
        eachIn(roots, 'a[href*="/goto/link-confirmation?url="]:not([data-smg-unwrap]), a[href*="/redirect/?to="]:not([data-smg-unwrap])', a => {
            a.dataset.smgUnwrap = '1';
            const real = decodeProxyHref(a.getAttribute('href') || '');
            if (real && /^https?:/i.test(real)) a.href = real;   // hover/"copiar link" mostram a URL real; o clique é garantido pelo capture
            unproxyText(a);   // VISUAL: título do unfurl / texto = /goto/...&s=hash → mostra a URL real decodificada
        });
    }
    // se o usuário CAIR direto na página de aviso, pula pro destino na hora
    function handleRedirectPage() {
        try {
            if (/\/redirect\//.test(location.pathname)) {
                const t = document.querySelector('.simpLinkProxy-targetLink');
                if (t && t.href) { location.replace(t.href); return; }
            }
            if (/\/goto\/link-confirmation/.test(location.pathname)) {
                const real = b64decode(rawParam(location.search, 'url'));
                if (real && /^https?:/i.test(real)) location.replace(real);
            }
        } catch (e) {}
    }

    // =========================================================
    // FEATURE (SMG): posts travados por "React with Like/Medal" — após reagir, re-busca a
    // página e troca o conteúdo escondido pelo real. Espera a reação registrar (retry curto)
    // → corrige o race do setTimeout(1,...) do script original + match de texto frágil.
    // =========================================================
    function mainBody(scope) {
        return scope && (scope.querySelector('.message-userContent .bbWrapper') || scope.querySelector('.message-body .bbWrapper') || scope.querySelector('.bbWrapper'));
    }
    function revealLikedPosts(roots) {
        if (!document.documentElement.classList.contains('smg-smg')) return;   // padrão é do SMG
        eachIn(roots, '.message[data-content]:not([data-smg-reveal])', post => {
            post.dataset.smgReveal = '1';   // marca ANTES dos checks (REGRA DE OURO): post sem .hidethanks (maioria) saía sem marca e era re-varrido em todo full-scan
            const hide = post.querySelector('.hidethanks');
            if (!hide || !/react|like|medal|refresh/i.test(hide.textContent || '')) return;
            const reaction = post.querySelector('.message-actionBar .reaction, .actionBar-action.reaction');
            if (!reaction) return;
            reaction.addEventListener('click', () => revealPost(post, 0));
        });
    }
    function revealPost(post, attempt) {
        if (attempt === 0) {
            if (post.dataset.smgRevealing) return;
            post.dataset.smgRevealing = '1';
            markRevealing(post, true);
        }
        const dc = post.getAttribute('data-content') || '';
        const sel = '[data-content="' + (window.CSS && CSS.escape ? CSS.escape(dc) : dc) + '"]';
        setTimeout(() => {
            if (!post.isConnected) return;   // usuário navegou / o post sumiu durante a espera → não busca a página (já é outra) nem re-tenta
            fetchDoc(location.href, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
                .then(doc => {
                    const fresh = mainBody(doc.querySelector(sel));
                    const stillHidden = !fresh || fresh.querySelector('.hidethanks');
                    if (!stillHidden) {
                        const cur = mainBody(post);
                        if (cur) { cur.replaceWith(fresh); scheduleRun(); }   // reprocessa imagens/embeds do conteúdo novo
                        markRevealing(post, false); delete post.dataset.smgRevealing;
                    } else if (attempt < 3) {
                        revealPost(post, attempt + 1);
                    } else {
                        markRevealing(post, false); delete post.dataset.smgRevealing;
                    }
                })
                .catch(() => { markRevealing(post, false); delete post.dataset.smgRevealing; });
        }, 1400);
    }
    function markRevealing(post, on) {
        const host = post.querySelector('.hidethanks') || mainBody(post) || post;
        let s = post.querySelector('.smg-reveal-spin');
        if (on && !s) { s = document.createElement('div'); s.className = 'smg-loading smg-reveal-spin'; host.appendChild(s); }
        else if (!on && s) s.remove();
    }

    // =========================================================
    // CROSS-SITE search: ao abrir o outro fórum com #smg-xsearch={json}, roda a MESMA busca aqui (POST com o token DESTE site).
    //   (o botão ↗ de cada linha do histórico abre simpcity ↔ socialmediagirls passando esse hash)
    // =========================================================
    function handleCrossSiteSearch() {
        const m = (location.hash || '').match(/[#&]smg-xsearch=([^&]+)/);
        if (!m) return;
        let p; try { p = JSON.parse(decodeURIComponent(m[1])); } catch (e) { return; }
        if (!p || (!p.q && !p.by)) return;
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}   // limpa o hash da URL
        const qsForm = document.querySelector('form[data-xf-init="quick-search"]');
        const action = qsForm?.getAttribute('action') || '/search/search';
        const token = qsForm?.querySelector('input[name="_xfToken"]')?.value
            || document.querySelector('input[name="_xfToken"]')?.value || '';
        const fields = [['keywords', p.q || ''], ['_xfToken', token]];
        if (p.threads) fields.push(['search_type', 'thread']);
        if (p.titles) fields.push(['c[title_only]', '1']);
        if (p.by) fields.push(['c[users]', p.by]);
        if (p.order === 'date') fields.push(['order', 'date']);
        postForm(action, fields);
    }

    // =========================================================
    // FEATURE: embed do saint.su/saint2.su (reusa a infra do turbo: .saint-iframe + lazy IO)
    // =========================================================
    function processSaintLinks(roots) {
        eachIn(roots, 'a[href*="saint.su/"]:not(.smg-turbo-fallback):not([data-saint-processed]), a[href*="saint2.su/"]:not(.smg-turbo-fallback):not([data-saint-processed]), a[href*="saint.cr/"]:not(.smg-turbo-fallback):not([data-saint-processed]), a[href*="saint2.cr/"]:not(.smg-turbo-fallback):not([data-saint-processed])', link => {
            const m = link.href.match(/saint2?\.(?:su|cr)\/(?:[^/?#]+\/)*([a-zA-Z0-9_-]+)/i);   // saint migrou pro TLD .cr (saint2.cr) — os ids resolvem pela MESMA API do turbo
            if (!m) return;
            link.dataset.saintProcessed = '1';
            const id = m[1];
            const host = (link.href.match(/(saint2?\.(?:su|cr))/i) || [, 'saint2.cr'])[1];
            const embedUrl = 'https://' + host + '/embed/' + id;
            const previewBlock = link.closest('.contentRow') || link.closest('.block-row');
            if (previewBlock) previewBlock.style.display = 'none';
            const wrapper = buildEmbedWrapper(link.href, id, { label: 'Open on saint', doneAttr: 'saintProcessed', doneVal: '1' });
            // iça o wrapper pro nível do .bbWrapper (igual o turbo, que insere após o card de preview).
            // sem isso, um link inline insere o embed dentro de um <p>/inline e ele não pega 100% da largura.
            let anchor = previewBlock;
            if (!anchor) {
                const bb = link.closest('.bbWrapper');
                anchor = link;
                if (bb) while (anchor.parentElement && anchor.parentElement !== bb) anchor = anchor.parentElement;
            }
            (anchor || link).insertAdjacentElement('afterend', wrapper);
            if (!previewBlock) retireTurboLink(link, wrapper);   // tira o <a> cru do saint (reusa o helper do turbo) — senão a URL crua fica visível acima do player
            const slot = wrapper.querySelector('.smg-turbo-slot');
            // iframe nativo do saint (fallback): usado quando o scrape do mp4 não acha nada
            const showIframe = () => {
                if (slot.querySelector('iframe, .smg-rg')) return;   // já tem player/iframe → não duplica
                unfillSlot(slot);   // se o player nativo tinha montado e falhou, volta o slot ao 16:9 p/ o iframe (absoluto) não colapsar
                wrapper.querySelector('.smg-turbo-fallback')?.style.removeProperty('display');   // sem player nativo → revela o link de escape
                const loading = slot.querySelector('.smg-loading');
                const iframe = buildTurboIframe(embedUrl);
                iframe.addEventListener('load', () => loading && loading.remove(), { once: true });
                setTimeout(() => loading && loading.remove(), 15000);
                slot.appendChild(iframe);
            };
            // saint2.su/embed/{id} faz 301 → turbo.cr/embed/{id} (saint virou redirect pro turbo).
            // Logo: resolvemos pela MESMA API do turbo (turbo.cr/api/sign) com o mesmo id → player nativo igual ao turbo.
            const turboEmbedUrl = 'https://turbo.cr/embed/' + id;
            const activate = () => {
                if (slot.dataset.saintActivated) return;   // run-once (turboIO E o masonry podem chamar)
                slot.dataset.saintActivated = '1'; slot._smgActivate = null;
                // 1º tenta o PLAYER NOSSO (mp4 via API do turbo) → controles próprios + ASPECT REAL (sem o 16:9 cortado do iframe); senão cai pro iframe.
                if (!(FEATURES.turboNativePlayer && GMX)) { showIframe(); return; }
                turboResolve(turboEmbedUrl, mp4 => {
                    if (slot.querySelector('.smg-rg')) return;                    // já tem nosso player
                    if (!mp4) { showIframe(); return; }                          // API não achou → iframe (saint embed, que redireciona)
                    slot.querySelectorAll('iframe, .smg-loading, .smg-turbo-error').forEach(e => e.remove());
                    const { wrap, video } = buildNativeVideo(mp4, 'https://turbo.cr/', showIframe, 'Saint');
                    video._rgExt = link.href; video._rgFeed = turboEmbedUrl;
                    slot.appendChild(wrap);
                    fillSlot(slot);   // solta o 16:9/overflow do slot → vídeo vertical não é cortado
                    rgPrepareUrl(video, mp4, wrap, turboPoster(mp4));   // poster + pronto; stream só no play (= turbo; saint resolve pelo turbocdn)
                });
            };
            const io = FEATURES.lazyEmbeds ? getTurboIO() : null;
            if (io) { slot._smgActivate = activate; io.observe(slot); } else activate();
        });
    }
    // (buildSaintWrapper foi unificado em buildEmbedWrapper — ver a seção TURBO embeds)

    // =========================================================
    // FEATURE: botão "baixar toda a mídia do post" na action bar (GM_download + fallback)
    // =========================================================
    function smgDownload(url, name) {
        if (typeof GM_download === 'function') {
            try { GM_download({ url, name, onerror: () => window.open(url, '_blank', 'noopener'), ontimeout: () => window.open(url, '_blank', 'noopener') }); return; } catch (e) {}
        }
        window.open(url, '_blank', 'noopener');
    }
    function collectPostMedia(body) {
        const urls = new Set();
        body.querySelectorAll('img.bbImage').forEach(img => {
            const a = img.closest('a[href]');
            const linkUrl = a && a.getAttribute('href');
            const u = (linkUrl && /\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i.test(linkUrl)) ? a.href : (img.dataset.smgFull || img.currentSrc || img.src);
            if (u && /^https?:/i.test(u)) urls.add(getBigUrl(u));
        });
        body.querySelectorAll('video[src], video source[src]').forEach(v => {
            const u = v.src || v.getAttribute('src');
            if (u && /^https?:/i.test(u)) urls.add(u);
        });
        return [...urls];
    }
    function filenameFromUrl(url) {
        let n = (url.split('/').pop() || 'media').split(/[?#]/)[0] || 'media';
        try { n = decodeURIComponent(n); } catch (e) {}
        if (!/\.[a-z0-9]{2,4}$/i.test(n)) n += '.jpg';
        return n;
    }
    // baixa TODA a mídia carregada na página (todos os posts) — acionado pelo botão central da dock
    function downloadAllMedia(btn) {
        if (btn.dataset.busy) return;
        const urls = collectPostMedia(document.body);
        if (!urls.length) { dockBadge(btn, '0'); setTimeout(() => dockBadge(btn, ''), 1500); return; }
        const list = urls.slice(0, 100);   // cap p/ não martelar o host
        if (list.length > 30 && !confirm(i18n('Download media') + ' (' + list.length + ')?')) return;
        btn.dataset.busy = '1'; btn.classList.add('smg-dl-busy');
        let i = 0;
        const step = () => {
            if (i >= list.length) { btn.classList.remove('smg-dl-busy'); delete btn.dataset.busy; dockBadge(btn, '✓'); setTimeout(() => dockBadge(btn, ''), 2200); return; }
            smgDownload(list[i], filenameFromUrl(list[i]));
            i++;
            dockBadge(btn, String(list.length - i));   // contagem regressiva do que falta
            setTimeout(step, 350);   // ~3/s
        };
        step();
    }
    function dockBadge(btn, text) {
        const host = btn.querySelector('.smg-nav-ico') || btn;
        let b = host.querySelector(':scope > .smg-nav-badge');
        if (!text) { if (b) b.remove(); return; }
        if (!b) { b = document.createElement('span'); b.className = 'smg-nav-badge'; host.appendChild(b); }
        b.textContent = text;
    }

    // =========================================================
    // DOWNLOADER: modal de confirmação · varre a THREAD INTEIRA (segue o "Next" do paginador) · ZIP (JS puro) ·
    // resolve pixeldrain pela API · gofile/bunkr/cyberdrop/etc. vão num links.txt (resolver por host = próximo passo).
    // =========================================================
    function dlGmGet(opts) {   // GM_xmlhttpRequest → Promise, com BACKSTOP manual (nunca deixa um worker travar)
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('GMX off')); return; }
            const tmo = opts.timeout || 30000;
            let settled = false;
            const ok = r => { if (settled) return; settled = true; clearTimeout(guard); resolve(r); };
            const bad = m => { if (settled) return; settled = true; clearTimeout(guard); reject(new Error(m)); };
            const guard = setTimeout(() => bad('stall'), tmo + 3000);   // se o GMX não disparar callback nenhum (CDN gotejando), aborta aqui
            try { GM_xmlhttpRequest(Object.assign({ method: 'GET', timeout: tmo }, opts, { onload: ok, onerror: () => bad('net'), ontimeout: () => bad('timeout') })); }
            catch (e) { bad((e && e.message) || 'err'); }
        });
    }
    // Referer correto por host (hotlink): redgifs/turbo precisam do próprio; imagem do fórum usa o fórum
    function dlReferer(url) {
        if (/redgifs/i.test(url)) return 'https://www.redgifs.com/';
        if (/turbo|turbocdn|saint/i.test(url)) return 'https://turbo.cr/';
        return location.origin + '/';
    }
    // ZIP em JS PURO (STORE, sem compressão) — o generateAsync do JSZip travava no sandbox do Tampermonkey.
    const DL_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
    function dlCrc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = DL_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
    function dlBuildZip(entries) {   // entries: [{ name, bytes:Uint8Array }] → Blob (síncrono)
        const enc = new TextEncoder();
        const u16 = n => [n & 255, (n >>> 8) & 255];
        const u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
        const parts = [], central = []; let offset = 0; const FLAGS = 0x0800;   // nome UTF-8
        entries.forEach(e => {
            const nm = enc.encode(e.name), crc = dlCrc32(e.bytes), sz = e.bytes.length;
            const lfh = new Uint8Array([].concat(u32(0x04034b50), u16(20), u16(FLAGS), u16(0), u16(0), u16(0x21), u32(crc), u32(sz), u32(sz), u16(nm.length), u16(0)));
            parts.push(lfh, nm, e.bytes);
            central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(FLAGS), u16(0), u16(0), u16(0x21), u32(crc), u32(sz), u32(sz), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), nm);
            offset += lfh.length + nm.length + sz;
        });
        let cdSize = 0; central.forEach(c => cdSize += c.length);
        const eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cdSize), u32(offset), u16(0)));
        return new Blob(parts.concat(central, [eocd]), { type: 'application/zip' });
    }
    // hosts de arquivo/galeria reconhecidos (casa o host EM QUALQUER LUGAR da URL decodificada — robusto a parse)
    const DL_EXT = [
        { key: 'pixeldrain', label: 'Pixeldrain', re: /\/\/(?:[a-z0-9-]+\.)?pixeldrain\.com\b/i },
        { key: 'gofile', label: 'GoFile', re: /\/\/(?:[a-z0-9-]+\.)?gofile\.io\b/i },
        { key: 'filester', label: 'Filester', re: /\/\/(?:[a-z0-9-]+\.)?filester\.[a-z]+\b/i },
        { key: 'bunkr', label: 'Bunkr', re: /\/\/(?:[a-z0-9-]+\.)?bunkr[a-z]*\.[a-z]+\b/i },
        { key: 'cyberdrop', label: 'Cyberdrop', re: /\/\/(?:[a-z0-9-]+\.)?cyberdrop\.[a-z]+\b/i },
        { key: 'cyberfile', label: 'Cyberfile', re: /\/\/(?:[a-z0-9-]+\.)?cyberfile\.[a-z]+\b/i },
        { key: 'saint', label: 'Saint/Turbo', re: /\/\/(?:[a-z0-9-]+\.)?(saint2?\.(su|to)|turbo\.cr)\b/i },
        { key: 'erome', label: 'Erome', re: /\/\/(?:[a-z0-9-]+\.)?erome\.com\b/i },
        { key: 'jpghost', label: 'JPG host', re: /\/\/(?:[a-z0-9-]+\.)?(jpg\d?\.(church|su|fish|pet|fishing|homes)|jpeg\.pet|host\.church)\b/i },
        { key: 'imgbox', label: 'ImgBox', re: /\/\/(?:[a-z0-9-]+\.)?imgbox\.com\b/i },
        { key: 'pixhost', label: 'PixHost', re: /\/\/(?:[a-z0-9-]+\.)?pixhost\.to\b/i },
        { key: 'imagebam', label: 'ImageBam', re: /\/\/(?:[a-z0-9-]+\.)?imagebam\.com\b/i },
        { key: 'ibb', label: 'ImgBB', re: /\/\/(?:[a-z0-9-]+\.)?ibb\.co\b/i },
        { key: 'pixl', label: 'Pixl', re: /\/\/(?:[a-z0-9-]+\.)?pixl\.(is|li)\b/i },
        { key: 'imgkiwi', label: 'Img.Kiwi', re: /\/\/(?:[a-z0-9-]+\.)?img\.kiwi\b/i },
        { key: 'mega', label: 'MEGA', re: /\/\/(?:[a-z0-9-]+\.)?mega\.(nz|io)\b/i },
    ];
    // links que NÃO são arquivo (socials/nav) → ignora no balde "Outros"
    const DL_SKIP = /(^|\.)(onlyfans\.com|fansly\.com|fans\.ly|twitter\.com|x\.com|instagram\.com|tiktok\.com|reddit\.com|youtube\.com|youtu\.be|patreon\.com|t\.me|telegram\.me|telegram\.org|discord\.(gg|com)|google\.com|facebook\.com|linktr\.ee|beacons\.ai|throne\.com|amazon\.|wikipedia\.org|imdb\.com)$/i;
    function dlScanDoc(doc, acc, seen) {
        const skip = el => el.closest('.bbCodeQuote, .message-signature');
        const fh = location.hostname.toLowerCase();
        const isMedia = u => /\.(jpe?g|png|gif|webp|avif|bmp|mp4|webm|mov|m4v|mkv)(\?|#|$)/i.test(u);
        const addImg = u => { u = getBigUrl(absUrl(u)); if (/^https?:/i.test(u) && !seen.has(u)) { seen.add(u); acc.images.push(u); } };
        const addVid = u => { u = absUrl(u); if (/^https?:/i.test(u) && !seen.has(u)) { seen.add(u); acc.videos.push(u); } };
        const addLink = raw => {
            const u = absUrl(decodeProxyHref(raw) || raw);   // DECODIFICA o proxy do fórum (/goto, /redirect) → URL real
            if (!/^https?:/i.test(u)) return;
            let host; try { host = new URL(u).hostname.toLowerCase(); } catch (e) { return; }
            if (host && (host === fh || host.endsWith('.' + fh) || fh.endsWith('.' + host))) return;   // link interno do fórum
            if (isMedia(u)) return;                                                            // imagem/vídeo DIRETO → já entra como mídia
            if (seen.has(u)) return;
            const k = DL_EXT.find(h => h.re.test(u));                                          // casa o host de arquivo na URL TODA
            if (!k && (!host || DL_SKIP.test(host))) return;                                   // social/nav OU host inválido → ignora
            seen.add(u);
            acc.links.push({ host: k ? k.key : 'other', label: k ? k.label : (IS_PT ? 'Outros' : 'Other'), url: u });
        };
        doc.querySelectorAll('img.bbImage').forEach(img => {
            if (skip(img)) return;
            const a = img.closest('a[href]'); const href = a && a.getAttribute('href');
            if (href && /\.(jpe?g|png|gif|webp|avif|bmp)(\?|#|$)/i.test(href)) addImg(href);
            else addImg(img.getAttribute('data-src') || img.getAttribute('data-url') || img.getAttribute('src') || '');
        });
        doc.querySelectorAll('video[src], video source[src]').forEach(el => { if (!skip(el)) addVid(el.getAttribute('src')); });
        doc.querySelectorAll('a[href$=".mp4"], a[href$=".webm"], a[href$=".mov"]').forEach(el => { if (!skip(el)) addVid(el.getAttribute('href')); });
        // links externos: cards unfurl (data-url REAL) + TODAS as âncoras (decodificando o proxy)
        doc.querySelectorAll('.bbCodeBlock--unfurl[data-url]').forEach(c => { if (!skip(c)) addLink(c.getAttribute('data-url') || ''); });
        doc.querySelectorAll('a[href]').forEach(a => { if (!skip(a)) addLink(a.getAttribute('href') || ''); });
        // embeds de vídeo (redgifs/turbo/saint): NÓS já resolvemos pro player → dá pra baixar o mp4. Reusa collectMediaFrom.
        try { collectMediaFrom(doc).forEach(it => { if (it.type === 'embed' && /redgifs\.com|turbo\.cr|saint2?\.su/i.test(it.url) && !seen.has(it.url)) { seen.add(it.url); acc.embeds.push(it.url); } }); } catch (e) {}
    }
    async function dlScanThread(onProgress) {
        const acc = { images: [], videos: [], links: [], embeds: [] };
        const seen = new Set();
        const pj = readPageJump();
        if (!pj) { dlScanDoc(document, acc, seen); return acc; }   // thread de página única
        let url = pj.tpl.replace('%page%', '1'), guard = 0;        // começa da pág. 1 e segue o Next (robusto)
        while (url && guard++ < 600) {
            let doc;
            try { doc = await fetchDoc(url, { credentials: 'same-origin' }); } catch (e) { break; }
            dlScanDoc(doc, acc, seen);
            if (onProgress) onProgress(guard, pj.max || guard);
            const nx = doc.querySelector('.pageNav-jump--next, .pageNavSimple-el--next');
            url = nx ? absUrl(nx.getAttribute('href')) : null;
        }
        return acc;
    }
    async function dlResolvePixeldrain(link) {   // lista (/l/, /api/list/) ou arquivo (/u/ /d/ /file/ /api/file/ ou id solto) → [{url, name}]
        const l = link.match(/pixeldrain\.com\/(?:l|api\/list)\/([a-z0-9]+)/i);
        if (l) { try { const r = await dlGmGet({ url: 'https://pixeldrain.com/api/list/' + l[1] }); const j = JSON.parse(r.responseText || '{}'); const fs = (j.files || []).map(x => ({ url: 'https://pixeldrain.com/api/file/' + x.id + '?download', name: x.name || null })); if (fs.length) return fs; } catch (e) {} }
        const f = link.match(/pixeldrain\.com\/(?:u|d|file|api\/file)\/([a-z0-9]+)/i) || link.match(/pixeldrain\.com\/([a-z0-9]{6,})(?:[/?#]|$)/i);
        if (f) return [{ url: 'https://pixeldrain.com/api/file/' + f[1] + '?download', name: null }];
        return [];
    }
    function dlThreadName() {
        const t = ((document.querySelector('.p-title-value') || {}).textContent || document.title || 'thread');
        return (t.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)) || 'thread';
    }
    function dlSaveBlob(blob, name) {
        try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
            document.body.appendChild(a); a.click();
            setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 20000);   // NÃO remover/revogar na hora (cancela o download)
        } catch (e) {
            try { window.open(URL.createObjectURL(blob), '_blank'); } catch (e2) {}   // fallback: abre o blob (salva manual)
        }
    }
    async function dlRunZip(files, unresolved, setProg) {
        const used = new Set();
        const nameFor = (url, name) => { let n = name || filenameFromUrl(url); const base = n; let i = 1; while (used.has(n)) n = base.replace(/(\.[^.]+)?$/, '_' + (i++) + '$1'); used.add(n); return n; };
        const entries = []; let done = 0, added = 0; const total = files.length; const queue = files.slice();
        const worker = async () => { while (queue.length) { const it = queue.shift(); try { const r = await dlGmGet({ url: it.url, responseType: 'arraybuffer', headers: { Referer: dlReferer(it.url) } }); const buf = r.response; if (buf && buf.byteLength > 200) { entries.push({ name: nameFor(it.url, it.name), bytes: new Uint8Array(buf) }); added++; } } catch (e) {} setProg(++done, total, i18n('Fetching…')); } };
        await Promise.all(Array.from({ length: 4 }, worker));
        if (unresolved.length) entries.push({ name: 'links.txt', bytes: new TextEncoder().encode(unresolved.join('\n')) });
        if (!entries.length) throw new Error('0 baixados (fetch falhou)');
        setProg(total, total, i18n('Zipping…'));
        dlSaveBlob(dlBuildZip(entries), dlThreadName() + '.zip');   // monta o zip SÍNCRONO (sem JSZip) + baixa
        return added;
    }
    async function dlRunFiles(files, unresolved, setProg) {
        let done = 0; const total = files.length;
        for (const it of files) { smgDownload(it.url, it.name || filenameFromUrl(it.url)); setProg(++done, total); await new Promise(r => setTimeout(r, 400)); }
        if (unresolved.length) dlSaveBlob(new Blob([unresolved.join('\n')], { type: 'text/plain' }), dlThreadName() + '_links.txt');
        return total;
    }
    function openDownloadModal() {
        if (document.getElementById('smg-dl-modal')) return;
        const ov = document.createElement('div'); ov.id = 'smg-dl-modal';
        ov.innerHTML =
            '<div class="smg-dl-card">' +
                '<div class="smg-dl-head"><span class="smg-dl-title">' + i18n('Download media') + '</span>' +
                    '<button type="button" class="smg-dl-x" aria-label="Close">' + ICONS.close + '</button></div>' +
                '<div class="smg-dl-body">' +
                    '<div class="smg-dl-scan"><span class="smg-dl-spin"></span><span class="smg-dl-scantxt">' + i18n('Scanning thread…') + '</span></div>' +
                    '<div class="smg-dl-summary" hidden></div>' +
                    '<div class="smg-dl-progress" hidden><div class="smg-dl-bar"><span></span></div><div class="smg-dl-progtxt"></div></div>' +
                '</div>' +
                '<div class="smg-dl-foot" hidden>' +
                    '<button type="button" class="smg-dl-btn smg-dl-files">' + i18n('Download files') + '</button>' +
                    '<button type="button" class="smg-dl-btn smg-dl-zip">' + i18n('Download ZIP') + '</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(ov);
        const close = () => ov.remove();
        ov.querySelector('.smg-dl-x').addEventListener('click', close);
        ov.addEventListener('click', e => { if (e.target === ov) close(); });
        document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { if (document.getElementById('smg-dl-modal')) close(); document.removeEventListener('keydown', esc); } });

        const $ = s => ov.querySelector(s);
        let media = null;
        dlScanThread((page, total) => { $('.smg-dl-scantxt').textContent = i18n('Scanning thread…') + ' (' + page + '/' + total + ')'; })
            .then(acc => {
                media = acc; $('.smg-dl-scan').hidden = true;
                const byHost = {}; acc.links.forEach(l => { byHost[l.label] = (byHost[l.label] || 0) + 1; });
                const hostStr = Object.keys(byHost).map(k => k + ': ' + byHost[k]).join(' · ');
                const sum = $('.smg-dl-summary'); sum.hidden = false;
                const nVid = acc.videos.length + acc.embeds.length;   // vídeos diretos + embeds (redgifs/turbo/saint) que resolvemos
                if (!acc.images.length && !nVid && !acc.links.length) { sum.innerHTML = '<div class="smg-dl-empty">' + i18n('Nothing to download') + '</div>'; return; }
                sum.innerHTML =
                    '<div class="smg-dl-stat"><b>' + acc.images.length + '</b> ' + i18n('images') + '</div>' +
                    '<div class="smg-dl-stat"><b>' + nVid + '</b> ' + i18n('videos') + '</div>' +
                    (acc.links.length ? '<div class="smg-dl-stat"><b>' + acc.links.length + '</b> ' + i18n('external links') + (hostStr ? ' <span class="smg-dl-hosts">(' + hostStr + ')</span>' : '') + '</div>' : '') +
                    (acc.images.length + nVid > 350 ? '<div class="smg-dl-warn">' + i18n('Many files — ZIP may be heavy; "Download files" is lighter.') + '</div>' : '');
                $('.smg-dl-foot').hidden = false;
            })
            .catch(() => { $('.smg-dl-scan').hidden = true; const sum = $('.smg-dl-summary'); sum.hidden = false; sum.innerHTML = '<div class="smg-dl-empty">' + i18n('Scan failed') + '</div>'; });

        const run = async asZip => {
            if (!media) return;
            $('.smg-dl-foot').hidden = true; $('.smg-dl-summary').hidden = true; $('.smg-dl-progress').hidden = false;
            const bar = $('.smg-dl-bar span'), txt = $('.smg-dl-progtxt');
            const setProg = (done, total, label) => { bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%'; txt.textContent = (label || i18n('Downloading…')) + ' ' + done + '/' + total; };
            txt.textContent = i18n('Resolving…');
            const files = []; const unresolved = [];
            media.images.forEach(u => files.push({ url: u, name: null }));
            media.videos.forEach(u => files.push({ url: u, name: null }));
            // resolve os embeds (redgifs/turbo/saint) pro mp4 — reusa os resolvers do nosso player
            for (let i = 0; i < media.embeds.length; i++) {
                txt.textContent = i18n('Resolving videos…') + ' ' + (i + 1) + '/' + media.embeds.length;
                const emb = media.embeds[i];
                try {
                    let mp4 = null;
                    if (/redgifs/i.test(emb)) { const id = rgIdFrom(emb); if (id) { const r = await rgVideo(id); mp4 = r && (r.hd || r.sd); } }
                    else { mp4 = await new Promise(res => { try { turboResolve(resolveUrlFor(emb), res); } catch (e) { res(null); } }); }
                    if (mp4) { const id = (/redgifs/i.test(emb) ? rgIdFrom(emb) : (emb.match(/\/embed\/([^/?#]+)/) || [])[1]) || 'video'; files.push({ url: mp4, name: id + '.mp4' }); }
                    else unresolved.push(emb);
                } catch (e) { unresolved.push(emb); }
            }
            for (const l of media.links) {
                if (l.host === 'pixeldrain') { const r = await dlResolvePixeldrain(l.url); if (r.length) r.forEach(x => files.push(x)); else unresolved.push(l.url); }
                else unresolved.push(l.url);
            }
            try {
                const n = asZip ? await dlRunZip(files, unresolved, setProg) : await dlRunFiles(files, unresolved, setProg);
                txt.textContent = i18n('Done') + ' ✓ — ' + (n != null ? n : files.length) + ' ' + i18n('files');
            } catch (e) { txt.textContent = i18n('Download failed') + (e && e.message ? ' — ' + e.message : ''); $('.smg-dl-foot').hidden = false; }
        };
        $('.smg-dl-zip').addEventListener('click', () => run(true));
        $('.smg-dl-files').addEventListener('click', () => run(false));
    }

    // =========================================================
    // FEATURE: embed de mídia DIRETA (susercontent/Shopee e afins). .mp4/.webm → <video>; imagem → <img>.
    // São URLs diretas (sem página) → só envolve no elemento certo. Imagem entra no pipeline.
    // =========================================================
    // Fileditch: a URL .mp4 (fileditchfiles.me/file.php?f=… ou /beta3/…) é uma PÁGINA "File Viewer" (HTML), NÃO o vídeo —
    // por isso o player direto nunca carregava. A página contém o <source> com o link temp ASSINADO real
    // (…donotsharethesetemplinksyouidiot.st/…?md5=…&expires=…), tocável (206 + range, sem bloqueio de referer).
    // Fetch (GMX, fura CORS) → extrai o <source>. cb(url|null). O link expira → resolve no activate (fresco), não cacheia.
    function fileditchResolve(pageUrl, cb) {
        if (!GMX || !pageUrl) { cb(null); return; }
        GMX({ method: 'GET', url: pageUrl, timeout: 15000, headers: { Referer: location.origin + '/', Accept: 'text/html,*/*' },
            onload: r => {
                const t = r.responseText || '';
                let m = t.match(/<source[^>]+src=["']([^"']+\.(?:mp4|webm|m4v|mov)[^"']*)["']/i);
                let u = m ? m[1] : null;
                if (!u) { const g = t.match(/https?:\/\/[^"'\s)]+\.(?:mp4|webm|m4v|mov)\?[^"'\s)]*/i); u = g ? g[0] : null; }
                cb(u ? u.replace(/&amp;/g, '&') : null);
            },
            onerror: () => cb(null), ontimeout: () => cb(null) });
    }
    // Fileditch → NOSSO player (igual saint/turbo): buildEmbedWrapper (slot + spinner + link de escape) → no activate
    // resolve o <source> temp e monta buildNativeVideo (controles próprios, 1º frame, stream só no play). Lazy via turboIO.
    function processFileditchLinks(roots) {
        if (!(FEATURES.directMedia && GMX)) return;
        eachIn(roots, 'a[href*="fileditch"]:not([data-fd-done])', link => {
            link.dataset.fdDone = '1';
            if (link.closest('.bbCodeQuote, .message-signature')) return;
            const href = link.href;
            if (!/\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(href)) return;   // só vídeo (outros tipos → deixa o link)
            const id = (href.match(/([^/?#=]+\.(?:mp4|webm|m4v|mov))(?:\?|#|$)/i) || [, 'Fileditch'])[1];
            const wrapper = buildEmbedWrapper(href, id, { label: 'Open on Fileditch', doneAttr: 'fdDone', doneVal: '1' });
            const bb = link.closest('.bbWrapper'); let anchor = link;
            if (bb) while (anchor.parentElement && anchor.parentElement !== bb) anchor = anchor.parentElement;
            anchor.insertAdjacentElement('afterend', wrapper);
            retireTurboLink(link, wrapper);   // tira o <a> cru (o player + o link de escape embutido cobrem o "abrir")
            const slot = wrapper.querySelector('.smg-turbo-slot');
            const fail = () => { slot.querySelector('.smg-loading')?.remove(); wrapper.querySelector('.smg-turbo-fallback')?.style.removeProperty('display'); };   // não resolveu/tocou → revela "Open on Fileditch"
            const activate = () => {
                if (slot.dataset.fdActivated) return;   // run-once (turboIO E o masonry podem chamar)
                slot.dataset.fdActivated = '1'; slot._smgActivate = null;
                fileditchResolve(href, mp4 => {
                    if (slot.querySelector('.smg-rg')) return;
                    if (!mp4) { fail(); return; }
                    slot.querySelectorAll('.smg-loading, iframe, .smg-turbo-error').forEach(e => e.remove());
                    const { wrap, video } = buildNativeVideo(mp4, location.origin + '/', fail, 'Fileditch');
                    video._rgExt = href;
                    slot.appendChild(wrap);
                    fillSlot(slot);                       // solta o 16:9/overflow → vídeo vertical não é cortado
                    rgPrepareUrl(video, mp4, wrap, '');   // 1º frame + pronto; stream só no play (sem poster fácil do Fileditch)
                });
            };
            const io = FEATURES.lazyEmbeds ? getTurboIO() : null;
            if (io) { slot._smgActivate = activate; io.observe(slot); } else activate();
        });
    }
    function processDirectMedia(roots) {
        eachIn(roots, 'a[href*="susercontent.com"]:not([data-dm-processed]), a[href$=".mp4"]:not([data-dm-processed]), a[href$=".webm"]:not([data-dm-processed]), a[href$=".mov"]:not([data-dm-processed])', link => {
            link.dataset.dmProcessed = '1';   // marca ANTES de qualquer return (senão re-scaneia o link todo frame)
            if (link.closest('.bbCodeQuote, .message-signature')) return;   // não embeda mídia citada / de assinatura (igual o groupPostLinks faz)
            const href = link.href;
            // bunkr/pixeldrain REMOVIDOS: o vídeo do bunkr vem como .mp4 DIRETO do CDN (ex.: cdn9.bunkr.ru/…​.mp4) e caía aqui pelo a[href$=".mp4"].
            // NÃO embeda esses hosts — fica como link/card (era o "ainda processando" reclamado).
            let dmHost = ''; try { dmHost = new URL(href).hostname.toLowerCase(); } catch (e) {}
            if (/(^|\.)(bunkr|pixeldrain)\./i.test(dmHost)) return;
            const isVideo = /\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(href);
            const isImg = /\.(webp|jpe?g|png|gif|avif)(\?|#|$)/i.test(href);
            if (!isVideo && !isImg) return;
            // LIMITE (evita players quebrados em hosts novos): só ARQUIVO direto de verdade — o PATHNAME termina na
            // extensão. Páginas-viewer com a ext só na QUERY (ex.: fileditch file.php?f=…mp4) NÃO entram aqui — quem
            // resolve o <source> real desses é um pass dedicado (processFileditchLinks). Exceção: host allowlisted.
            let pathMedia = false; try { pathMedia = /\.(mp4|webm|m4v|mov|webp|jpe?g|png|gif|avif)$/i.test(new URL(href).pathname); } catch (e) {}
            if (!pathMedia && !/susercontent\.com/i.test(dmHost)) return;
            const wrap = document.createElement('div');
            wrap.className = 'smg-dm-wrap';
            if (isVideo) {
                const v = document.createElement('video');
                // PERF: nasce preload=none e só vira 'metadata' (1º frame) a ~1 tela da viewport (via turboIO, one-shot).
                // Sem isto, o pass no boot (roots=[body]) puxava metadata de TODO .mp4 da página de uma vez (o "pesado").
                v.src = href; v.controls = true; v.preload = 'none'; v.playsInline = true; v.className = 'smg-dm-video';
                v._smgActivate = () => { v._smgActivate = null; v.preload = 'metadata'; };
                const dio = (FEATURES.lazyEmbeds && typeof getTurboIO === 'function') ? getTurboIO() : null;
                if (dio) dio.observe(v); else v.preload = 'metadata';
                wrap.appendChild(v);
            } else {
                const a = document.createElement('a');
                a.href = href; a.target = '_blank'; a.rel = 'noopener';
                const img = document.createElement('img');
                img.className = 'bbImage'; img.src = href; img.alt = ''; img.loading = 'lazy';
                a.appendChild(img);
                wrap.appendChild(a);
            }
            const bb = link.closest('.bbWrapper');   // iça pro nível do bbWrapper
            let anchor = link;
            if (bb) while (anchor.parentElement && anchor.parentElement !== bb) anchor = anchor.parentElement;
            anchor.insertAdjacentElement('afterend', wrap);
            link.style.display = 'none';   // some com a URL crua (a mídia a substitui)
            if (isImg) scheduleRun();
        });
    }

    // =========================================================
    // FEATURE: cards de link p/ FILE-HOSTS (Pixeldrain, Bunkr, GoFile, Cyberdrop, MEGA, …) — SEM player inline. Card CLARO e
    // CONSISTENTE: thumb/logo à ESQUERDA + host + tipo (Arquivo/Galeria, com contagem onde dá) + ↗. Clicar abre no host.
    // Provider casado por SUBSTRING do host (robusto ao TLD que muda, ex.: bunkr). Substitui o link cru OU o unfurl do XF.
    //   Pixeldrain: API → galeria (contagem + cluster de thumbs) / arquivo (thumbnail). Bunkr: foto do figure do unfurl.
    //   Demais: logo do host (favicon do unfurl, senão {origin}/favicon.ico) + tipo pelo padrão da URL.
    // =========================================================
    const FH_PROVIDERS = [
        { key: 'pixeldrain', label: 'Pixeldrain', sub: 'pixeldrain.com', re: /pixeldrain\.com/i, logo: 'https://pixeldrain.com/res/img/pixeldrain_128.png', gallery: /\/(?:l|api\/list)\//i },
        { key: 'bunkr', label: 'Bunkr', sub: 'bunkr', re: /bunkr/i, gallery: /\/a\//i },
        { key: 'gofile', label: 'GoFile', sub: 'gofile.io', re: /gofile\.io/i, gallery: /\/d\//i, logo: 'https://gofile.io/dist/img/favicon96.png' },   // favicon oficial do gofile (não tem /favicon.ico)
        { key: 'filester', label: 'Filester', sub: 'filester', re: /filester\./i, gallery: /\/f\//i, logo: 'https://filester.me/img/favicon.ico' },   // favicon mora em /img/ (NÃO /favicon.ico); /f/ = galeria, /d/ = arquivo (fhFilester)
        { key: 'turbo', label: 'Turbo', sub: 'turbo.cr/a/', re: /turbo\.cr\/a\//i, gallery: /\/a\//i },   // ÁLBUM do turbo (galeria) — o vídeo único já vai pro player (09-turbo)
        { key: 'cyberdrop', label: 'Cyberdrop', sub: 'cyberdrop', re: /cyberdrop\./i, gallery: /\/a\//i },
        { key: 'cyberfile', label: 'Cyberfile', sub: 'cyberfile', re: /cyberfile\./i, gallery: /\/folder\//i },
        { key: 'mega', label: 'MEGA', sub: 'mega.', re: /(?:^|[/.])mega\.(?:nz|io)/i, gallery: /\/folder\//i },
        { key: 'mediafire', label: 'MediaFire', sub: 'mediafire', re: /mediafire\.com/i, gallery: /\/folder\//i },
        { key: 'k2s', label: 'K2S', sub: 'k2s.cc', re: /k2s\.cc|keep2share/i },
        { key: 'rapidgator', label: 'Rapidgator', sub: 'rapidgator', re: /rapidgator\./i },
        { key: 'fikper', label: 'Fikper', sub: 'fikper', re: /fikper\./i },
    ];
    const FH_BARE_SEL = FH_PROVIDERS.map(p => 'a[href*="' + p.sub + '"]:not([data-fh-done])').join(', ');
    function fhProvider(url, dataHost) { const s = (url || '') + ' ' + (dataHost || ''); return FH_PROVIDERS.find(p => p.re.test(s)) || null; }
    function pdPlace(node, card) {   // troca o link/card cru (o unfurl inteiro, se houver) pelo nosso card, no nível do .bbWrapper
        const host = node.closest('.bbCodeBlock--unfurl') || node;
        const bb = host.closest('.bbWrapper');
        let anchor = host;
        if (bb) while (anchor.parentElement && anchor.parentElement !== bb) anchor = anchor.parentElement;
        anchor.insertAdjacentElement('afterend', card);
        host.style.display = 'none';   // some o cru → groupPostLinks pula (filtra display:none + .bbCodeBlock)
    }
    // CADEIA de logo: tenta cada URL e, no erro, vai pra próxima → NUNCA fica sem ícone. (favicon do host falha às vezes;
    // o serviço DDG/Google quase sempre devolve algo.) O serviço some o host (não o arquivo) — leak mínimo.
    function fhLogoChain(prov, url, unfurlEl) {
        const out = []; if (prov.logo) out.push(prov.logo);
        let host = ''; try { host = new URL(url).hostname; } catch (e) {}
        if (prov.key === 'bunkr' && host) out.push('https://' + host + '/images/fav.ico');   // logo roxo do bunkr
        if (unfurlEl) { const fav = unfurlEl.querySelector('.js-unfurl-favicon img, .bbCodeBlockUnfurl-icon'); const s = fav && fav.getAttribute('src'); if (s) out.push(s); }
        if (host) out.push('https://' + host + '/favicon.ico');
        // NÃO usamos icons.duckduckgo.com / google s2: p/ hosts que eles não conhecem devolvem um ícone GENÉRICO
        // (globo/play) que carrega com sucesso → a cadeia TRAVA nele e nunca chega no tile com a inicial. Sem eles,
        // favicon real (provider/host) quando existe; senão → fhLetterTile (tile colorido com a inicial do host).
        return out;
    }
    function fhLetterTile(th, label) {   // fallback final: tile colorido com a inicial do host (nunca fica ícone genérico/quebrado)
        th.className = 'smg-fhcard-thumb smg-fhcard-thumb--letter';
        th.textContent = ((label || '?').trim().charAt(0) || '?').toUpperCase();
    }
    function fhFillLogo(th, chain, label) {   // sem foto de conteúdo → logo do host (contain). Cadeia até carregar; exausta → tile com a inicial.
        th.className = 'smg-fhcard-thumb smg-fhcard-thumb--logo';
        chain = (chain || []).filter(Boolean);
        if (!chain.length) { fhLetterTile(th, label); return; }
        const im = document.createElement('img'); im.className = 'smg-fhcard-logo'; im.alt = ''; im.loading = 'eager';
        let i = 0;
        const next = () => { if (i >= chain.length) { im.remove(); fhLetterTile(th, label); return; } im.src = chain[i++]; };
        im.addEventListener('error', next);   // SEM once: cada falha tenta a próxima da cadeia
        th.appendChild(im); next();
    }
    function fhCopyFallback(text, done) {
        try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); ta.remove(); done(); } catch (e) {}
    }
    function fhCopy(text, btn) {   // copia o link + feedback visual (✓ por ~1.4s) — usa o par share/shareDone que já existe
        const done = () => { btn.classList.add('smg-fhcard-copied'); btn.innerHTML = ICONS.shareDone; setTimeout(() => { btn.classList.remove('smg-fhcard-copied'); btn.innerHTML = ICONS.share; }, 1400); };
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, () => fhCopyFallback(text, done)); return; }
        fhCopyFallback(text, done);
    }
    // contagem → texto "Galeria · N itens" / "Arquivo"
    function fhSub(kind, count) { return count > 1 ? (i18n('Gallery') + ' · ' + count + ' ' + i18n(count === 1 ? 'item' : 'items')) : kind; }
    // card RICO: [mosaico de thumbs (até 4) c/ badge de contagem + "+N" no último | logo do host] + host + sub | [copiar] [abrir↗].
    // o = { label, href, sub, thumbs:[], logo:[], count:0 }
    function fhCard(o) {
        const href = o.href, logoChain = o.logo || [];
        const thumbs = (o.thumbs || []).filter(Boolean).slice(0, 4);
        const count = o.count || 0;
        const card = document.createElement('div'); card.className = 'smg-fhcard'; card.dataset.fhDone = '1';
        const main = document.createElement('a'); main.className = 'smg-fhcard-main'; main.href = href; main.target = '_blank'; main.rel = 'noopener noreferrer'; main.dataset.fhDone = '1';
        const th = document.createElement('div');
        th.className = 'smg-fhcard-thumb smg-fhcard-thumb--loading' + (thumbs.length > 1 ? ' smg-fhcard-thumb--multi' : '');
        if (thumbs.length) {
            let pending = thumbs.length;
            thumbs.forEach((u, i) => {
                const cell = document.createElement('span'); cell.className = 'smg-fhcard-cell';
                const im = document.createElement('img'); im.loading = 'eager'; im.src = u; im.alt = ''; im.referrerPolicy = 'no-referrer';
                im.addEventListener('load', () => th.classList.remove('smg-fhcard-thumb--loading'), { once: true });
                im.addEventListener('error', () => { cell.remove(); if (!--pending && !th.querySelector('img')) fhFillLogo(th, logoChain, o.label); }, { once: true });
                cell.appendChild(im);
                if (i === thumbs.length - 1 && count > thumbs.length) { const more = document.createElement('span'); more.className = 'smg-fhcard-more'; more.textContent = '+' + (count - thumbs.length); cell.appendChild(more); }
                th.appendChild(cell);
            });
        } else { fhFillLogo(th, logoChain, o.label); }
        if (count > 1) { const b = document.createElement('span'); b.className = 'smg-fhcard-count'; b.innerHTML = ICONS.layers + '<b>' + count + '</b>'; th.appendChild(b); }
        main.appendChild(th);
        const body = document.createElement('div'); body.className = 'smg-fhcard-body';
        const t = document.createElement('span'); t.className = 'smg-fhcard-host'; t.textContent = o.label;
        const s = document.createElement('span'); s.className = 'smg-fhcard-sub'; s.textContent = o.sub;
        body.append(t, s);
        main.appendChild(body);
        const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'smg-fhcard-btn smg-fhcard-copy'; copy.title = i18n('Copy link'); copy.setAttribute('aria-label', i18n('Copy link')); copy.innerHTML = ICONS.share;
        copy.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fhCopy(href, copy); });
        const open = document.createElement('a'); open.className = 'smg-fhcard-btn smg-fhcard-open'; open.href = href; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.dataset.fhDone = '1'; open.title = i18n('Open'); open.setAttribute('aria-label', i18n('Open')); open.innerHTML = ICONS.rgExternal;
        card.append(main, copy, open);
        return card;
    }
    function fhPixeldrain(node, url) {   // API: galeria (contagem + cluster) / arquivo (thumbnail)
        const logo = ['https://pixeldrain.com/res/img/pixeldrain_128.png'];   // sem DDG (devolve genérico que trava); falha → tile "P"
        const lid = url.match(/pixeldrain\.com\/(?:l|api\/list)\/([a-z0-9]+)/i);
        if (lid) {
            if (!GMX) { pdPlace(node, fhCard({ label: 'Pixeldrain', href: url, sub: i18n('Gallery'), logo: logo })); return; }
            gmGetJSON('https://pixeldrain.com/api/list/' + lid[1]).then(j => {
                const files = (j && j.files) || [];
                pdPlace(node, fhCard({ label: 'Pixeldrain', href: url, sub: fhSub(i18n('Gallery'), files.length), count: files.length, logo: logo, thumbs: files.slice(0, 4).map(f => 'https://pixeldrain.com/api/file/' + f.id + '/thumbnail') }));
            }, () => pdPlace(node, fhCard({ label: 'Pixeldrain', href: url, sub: i18n('Gallery'), logo: logo })));
            return;
        }
        const fid = url.match(/pixeldrain\.com\/(?:u|d|file|api\/file)\/([a-z0-9]+)/i) || url.match(/pixeldrain\.com\/([a-z0-9]{6,})(?:[/?#]|$)/i);
        pdPlace(node, fhCard({ label: 'Pixeldrain', href: url, sub: i18n('File'), logo: logo, thumbs: fid ? ['https://pixeldrain.com/api/file/' + fid[1] + '/thumbnail'] : [] }));
    }
    // GOFILE: NÃO fazemos NENHUM request (a API/token/wt do gofile dá rate-limit e bloqueio temporário).
    // Cai no card genérico do fhBuildCard (label + logo + "Gallery"), zero chamadas → impossível tomar rate limit.
    // BUNKR: álbum (/a/) → raspa a página por thumbs + contagem. Arquivo único → foto do figure do unfurl.
    function fhBunkr(node, url, unfurlEl) {
        const logo = fhLogoChain({ key: 'bunkr' }, url, unfurlEl);
        const unfurlThumb = () => { const fig = unfurlEl && unfurlEl.querySelector('.js-unfurl-figure img, .bbCodeBlockUnfurl-image'); const s = fig && fig.getAttribute('src'); return s ? [s] : []; };
        const fallback = () => pdPlace(node, fhCard({ label: 'Bunkr', href: url, sub: /\/a\//i.test(url) ? i18n('Gallery') : i18n('File'), logo: logo, thumbs: unfurlThumb() }));
        if (!GMX || !/\/a\//i.test(url)) { fallback(); return; }
        // GMX (não fetchDoc): a página do bunkr é cross-origin → o fetch normal bate no CORS; GM_xmlhttpRequest fura.
        GMX({ method: 'GET', url: url, timeout: 12000, onload: r => {
            let doc; try { doc = new DOMParser().parseFromString(r.responseText || '', 'text/html'); } catch (e) { fallback(); return; }
            const seen = new Set(), thumbs = [];
            doc.querySelectorAll('img[src*="thumb"], img[data-src*="thumb"], [class*="grid"] img').forEach(im => {
                let s = im.getAttribute('data-src') || im.getAttribute('src') || ''; if (!s || /^data:|\.svg|sprite|logo|fav/i.test(s)) return;
                try { s = new URL(s, url).href; } catch (e) { return; } if (!seen.has(s)) { seen.add(s); thumbs.push(s); }
            });
            const count = doc.querySelectorAll('[class*="grid"] a[href*="/f/"], a[href*="/f/"], a[href*="/i/"], a[href*="/v/"]').length || thumbs.length;
            if (!thumbs.length) { fallback(); return; }
            pdPlace(node, fhCard({ label: 'Bunkr', href: url, sub: fhSub(i18n('Gallery'), count), count: count, logo: logo, thumbs: thumbs.slice(0, 4) }));
        }, onerror: fallback, ontimeout: fallback });
    }
    // FILESTER: arquivo único (/d/{slug}). A página HTML toma Cloudflare 403, MAS a API pública JSON responde —
    // POST /api/public/view {file_slug} → view_url; mp4 = https://cn1.filester.me{view_url} (mesma engine do site).
    // VÍDEO → embeda o player nativo (igual saint/turbo); imagem/galeria/falha → card. (galeria = /f/, arquivo = /d/)
    function fhFilester(node, url, prov, unfurlEl) {
        const logo = fhLogoChain(prov, url, unfurlEl);
        const isFile = /\/d\//i.test(url);
        const slug = (url.match(/\/d\/([^/?#]+)/i) || [])[1];
        const card = () => pdPlace(node, fhCard({ label: 'Filester', href: url, sub: isFile ? i18n('File') : i18n('Gallery'), logo: logo }));
        if (!isFile || !slug || !GMX || !FEATURES.turboNativePlayer) { card(); return; }   // galeria/sem player → card
        let host = 'filester.me'; try { host = new URL(url).hostname; } catch (e) {}
        GMX({ method: 'POST', url: location.protocol + '//' + host + '/api/public/view', headers: { 'Content-Type': 'application/json' }, data: JSON.stringify({ file_slug: slug }), timeout: 12000,
            onload: r => {
                let vu = ''; try { vu = (JSON.parse(r.responseText || '{}') || {}).view_url || ''; } catch (e) {}
                const mp4 = vu ? ('https://cn1.filester.me' + vu) : '';
                if (!mp4 || !/\.(mp4|m4v|mov|webm|mkv|avi|ts|flv)(\?|#|$)/i.test(mp4)) { card(); return; }   // não-vídeo → card
                const wrapper = buildEmbedWrapper(url, slug, { label: 'Open on filester', doneAttr: 'filesterEmbed', doneVal: '1' });
                const slot = wrapper.querySelector('.smg-turbo-slot');
                const activate = () => {
                    if (slot.dataset.flAct) return; slot.dataset.flAct = '1'; slot._smgActivate = null;
                    const { wrap, video } = buildNativeVideo(mp4, location.protocol + '//' + host + '/', null, 'Filester');
                    video._rgExt = url;
                    slot.querySelectorAll('.smg-loading, iframe').forEach(e => e.remove());
                    slot.appendChild(wrap); fillSlot(slot);
                    rgPrepareUrl(video, mp4, wrap, '');   // sem poster (o /d/ não expõe o uuid p/ /t/{uuid}); stream só no play
                };
                pdPlace(node, wrapper);
                const io = FEATURES.lazyEmbeds ? getTurboIO() : null;
                if (io) { slot._smgActivate = activate; io.observe(slot); } else activate();
            },
            onerror: card, ontimeout: card });
    }
    function fhBuildCard(node, url, prov, unfurlEl) {
        if (prov.key === 'pixeldrain') { fhPixeldrain(node, url); return; }
        if (prov.key === 'bunkr') { fhBunkr(node, url, unfurlEl); return; }   // gofile cai no card genérico abaixo (ZERO requests → sem rate limit)
        if (prov.key === 'filester') { fhFilester(node, url, prov, unfurlEl); return; }
        const sub = (prov.gallery && prov.gallery.test(url)) ? i18n('Gallery') : i18n('File');
        pdPlace(node, fhCard({ label: prov.label, href: url, sub: sub, logo: fhLogoChain(prov, url, unfurlEl) }));
    }
    function processFileHostCards(roots) {
        if (!FEATURES.fileHostCards) return;
        // UNFURLS do XF (têm favicon/figure de graça) → card consistente. Marca TODOS (mesmo os não-provider) p/ não re-checar.
        eachIn(roots, '.bbCodeBlock--unfurl[data-url]:not([data-fh-done])', card => {
            card.dataset.fhDone = '1';   // marca ANTES de qualquer return (REGRA DE OURO)
            if (card.closest('.bbCodeQuote, .message-signature')) return;
            const url = card.getAttribute('data-url') || '';
            const prov = fhProvider(url, card.getAttribute('data-host'));
            if (prov) fhBuildCard(card, url, prov, card);
        });
        // LINKS crus (sem unfurl) dos providers
        eachIn(roots, FH_BARE_SEL, a => {
            a.dataset.fhDone = '1';
            if (a.closest('.bbCodeQuote, .message-signature, .smg-post-links, .smg-fhcard, .generic2wide-iframe-div, .smg-dm-wrap, .bbCodeBlock--unfurl')) return;
            if (a.querySelector('img.bbImage')) return;   // link de imagem (lightbox)
            const url = absUrl(decodeProxyHref(a.getAttribute('href') || '') || a.href);
            const prov = fhProvider(url);
            if (prov) fhBuildCard(a, url, prov, null);
        });
    }

    // =========================================================
    // FEATURE: agrupa os links NÃO-embedados (file hosts: GoFile/Bunkr/Pixeldrain/…) numa barra de chips
    // no fim do post, SEM tirar nada do texto. Pula internos (menção/thread/quote), imagens e embeds.
    // =========================================================
    const LINK_HOST_LABEL = {
        gofile: 'GoFile', bunkr: 'Bunkr', pixeldrain: 'Pixeldrain', cyberdrop: 'Cyberdrop',
        cyberfile: 'Cyberfile', filester: 'Filester', 'mega.nz': 'MEGA', mediafire: 'MediaFire',
        k2s: 'K2S', keep2share: 'K2S', fikper: 'Fikper', rapidgator: 'Rapidgator',
        saint: 'Saint', 'turbo.cr': 'Turbo', imagebam: 'ImageBam', imgbox: 'imgbox',
        pixhost: 'PixHost', jpg: 'jpg.su', redgifs: 'RedGIFs',
    };
    function linkLabel(a) {
        const txt = (a.textContent || '').trim();   // texto descritivo do link ("Filester - Part 1") é melhor que o host
        if (txt && txt.length <= 30 && !/^https?:\/\//i.test(txt) && !/^[a-z0-9.-]+\.[a-z]{2,}\/?$/i.test(txt)) return txt;
        const host = (a.hostname || '').toLowerCase().replace(/^www\./, '');
        for (const k in LINK_HOST_LABEL) if (host.indexOf(k) >= 0) return LINK_HOST_LABEL[k];
        return host.split('.')[0] || 'link';
    }
    function groupPostLinks(roots) {
        if (!document.documentElement.classList.contains('smg-thread')) return;   // só em thread (classList em vez de querySelector todo frame)
        const forumHost = location.hostname;
        eachIn(roots, '.message--post .message-body > .bbWrapper:not([data-smg-links])', bb => {   // .bbWrapper fica em article.message-body (não é filho direto de .message-userContent)
            bb.dataset.smgLinks = '1';
            const links = Array.from(bb.querySelectorAll('a[href^="http"]')).filter(a =>
                a.hostname !== forumHost                              // externo (pula menção/thread/quote do fórum)
                && !a.querySelector('img')                           // não é link de imagem (lightbox)
                && !a.classList.contains('smg-turbo-fallback')       // não é o fallback de embed
                && a.style.display !== 'none'                        // não foi escondido pelo directMedia
                && !a.closest('.bbCodeBlock, .bbCodeQuote, .smg-post-links, .generic2wide-iframe-div, .smg-dm-wrap'));
            if (links.length < 2) return;   // só agrupa quando há vários pra juntar
            const bar = document.createElement('div');
            bar.className = 'smg-post-links';
            const seen = new Set();
            links.forEach(a => {
                if (seen.has(a.href)) return;
                seen.add(a.href);
                const chip = document.createElement('a');
                chip.className = 'smg-link-chip';
                chip.href = a.href; chip.target = '_blank'; chip.rel = 'noopener noreferrer';
                chip.innerHTML = ICONS.link;
                const lbl = document.createElement('span');
                lbl.textContent = linkLabel(a);
                chip.appendChild(lbl);
                bar.appendChild(chip);
            });
            if (bar.children.length >= 2) bb.appendChild(bar);
        });
    }

    // =========================================================
    // BOOKMARKS como FEED — a página /account/bookmarks lista POSTS salvos (.contentRow → /posts/{id}/).
    // REPLACE TOTAL: esconde a visão nativa e mostra um feed com EXATAMENTE esses posts — parseia a lista (todas as
    // páginas), busca o conteúdo de cada post e renderiza com riverCard (mesmo visual do feed da home) + a nota do
    // bookmark. Reusa riverParsePost/riverThreadMeta/riverCard/riverEnqueue/fetchDoc (escopo do IIFE).
    // =========================================================
    function isBookmarksPage() {
        return (document.documentElement.getAttribute('data-template') || '') === 'account_bookmarks';
    }
    function bmNextLink(doc) {
        const a = doc.querySelector('a.pageNav-jump--next[href], link[rel="next"][href], a[rel="next"][href]');
        const h = a && a.getAttribute('href');
        if (!h) return null;
        try { return new URL(h, location.href).href; } catch (e) { return null; }
    }
    // parseia as linhas de bookmark de um doc → [{postId, postUrl, title, author, authorHref, thumb, note}]
    function bmParseRows(doc) {
        const out = [], seen = new Set();
        doc.querySelectorAll('.contentRow').forEach(row => {
            const titleA = row.querySelector('.contentRow-title a[href*="/posts/"]');
            // fallback do link: o menu "Copy link / Edit" também aponta /posts/{id}/...
            const href = (titleA && titleA.getAttribute('href')) || (row.querySelector('a[href*="/posts/"]') || {}).href || '';
            const m = href.match(/\/posts\/(\d+)/);
            if (!m) return;
            const postId = m[1]; if (seen.has(postId)) return; seen.add(postId);
            let title = ((titleA && titleA.textContent) || '').replace(/\s+/g, ' ').trim();
            title = title.replace(/^Post in thread\s*/i, '').replace(/^['"‘’“”]+|['"‘’“”]+$/g, '').trim();
            const av = row.querySelector('.contentRow-figure .avatar img, .contentRow-figure img');
            const thumb = (av && (av.getAttribute('src') || '')) || '';
            const authorA = row.querySelector('.contentRow-minor a.username, .contentRow-minor a[href*="/members/"]');
            const author = (authorA && authorA.textContent.trim()) || (row.querySelector('.contentRow-figure .avatar[title]') || {}).title || '';
            let note = ((row.querySelector('.contentRow-snippet') || {}).textContent || '').replace(/\s+/g, ' ').trim();
            if (/^no bookmark note\.?$/i.test(note)) note = '';
            const te = row.querySelector('.contentRow-minor time, time');   // data do bookmark → ordenação (desc) e diff
            let bmTs = te ? (parseInt(te.getAttribute('data-timestamp') || '0', 10) || 0) : 0;
            if (!bmTs && te) { const dt = te.getAttribute('datetime'); if (dt) { const ms = Date.parse(dt); if (!isNaN(ms)) bmTs = Math.floor(ms / 1000); } }
            let postUrl; try { postUrl = new URL(href, location.href).href; } catch (e) { return; }
            out.push({ postId: postId, postUrl: postUrl, title: title, author: author, authorHref: authorA ? authorA.getAttribute('href') : '', thumb: /^data:/.test(thumb) ? '' : thumb, note: note, bmTs: bmTs });
        });
        return out;
    }
    // lista COMPLETA de bookmarks: página atual (document) + segue a paginação (sequencial)
    function bmFetchAllRows() {
        const rows = bmParseRows(document);
        const next = bmNextLink(document);
        if (!next) return Promise.resolve(rows);
        const seen = new Set(rows.map(r => r.postId));
        const walk = (url, depth) => fetchDoc(url, { credentials: 'same-origin' }).then(doc => {
            bmParseRows(doc).forEach(r => { if (!seen.has(r.postId)) { seen.add(r.postId); rows.push(r); } });
            const n = bmNextLink(doc);
            return (n && depth < 40) ? walk(n, depth + 1) : rows;
        }, () => rows);
        return walk(next, 1);
    }
    // busca o conteúdo do post salvo → objeto serializável do riverParsePost (null se sumiu/erro)
    function bmFetchPost(row) {
        return fetchDoc(row.postUrl, { credentials: 'same-origin' }).then(doc => {
            const postEl = doc.querySelector('article[data-content="post-' + row.postId + '"]') || doc.getElementById('js-post-' + row.postId)
                || doc.querySelector('article.message--post');   // fallback: o /posts/{id}/ cai na página posicionada nesse post
            if (!postEl) return null;
            const meta = riverThreadMeta(doc, { fallbackTitle: row.title, thumb: row.thumb });
            return riverParsePost(postEl, meta, row.postUrl);
        }, () => null);
    }
    // REMOVE dos salvos: busca o form de confirmação (/posts/{id}/bookmark?delete=1, sem AJAX → HTML) e submete via POST.
    // 2 passos = robusto ao contrato exato do XF (pega _xfToken + campos do próprio form). Resolve true no sucesso.
    function bmUnsave(postId) {
        return fetchDoc('/posts/' + postId + '/bookmark?delete=1', { credentials: 'same-origin' }).then(doc => {
            const form = doc.querySelector('form[action*="/bookmark"]') || doc.querySelector('form.block, form');
            if (!form) return false;
            const fd = new FormData();
            form.querySelectorAll('input[name], textarea[name], select[name]').forEach(i => { if (i.type !== 'submit' && i.name) fd.append(i.name, i.value); });
            if (!fd.has('delete')) fd.append('delete', '1');
            fd.set('_xfResponseType', 'json'); fd.append('_xfWithData', '1');
            let action; try { action = new URL(form.getAttribute('action') || ('/posts/' + postId + '/bookmark'), location.href).href; } catch (e) { action = '/posts/' + postId + '/bookmark'; }
            return fetch(action, { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: fd })
                .then(r => r.ok ? r.json().catch(() => ({})) : null)
                .then(j => !!j && !(j.errors && j.errors.length));
        }, () => false).catch(() => false);
    }
    // card do feed (riverCard) + a nota do bookmark por cima do conteúdo + botão "remover dos salvos"
    function bmCard(obj, row) {
        const card = riverCard(obj, 0);   // wm=0 → nunca marca "novo"
        card.dataset.bmId = row.postId; card.dataset.bmTs = String(row.bmTs || 0);
        if (row.note) {
            const n = document.createElement('div'); n.className = 'smg-bm-note'; n.textContent = row.note;
            const c = card.querySelector('.smg-fp-content');
            if (c) card.insertBefore(n, c); else card.appendChild(n);
        }
        const rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'smg-bm-remove'; rm.title = i18n('Remove from saved'); rm.setAttribute('aria-label', i18n('Remove from saved'));
        rm.innerHTML = ICONS.bookmarkRemove;
        rm.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            if (rm.disabled) return; rm.disabled = true; rm.classList.add('is-busy');
            bmUnsave(row.postId).then(ok => {
                if (!ok) { rm.disabled = false; rm.classList.remove('is-busy'); return; }
                fdbDeleteBookmark(row.postId);   // tira do cache → não volta na próxima abertura
                card.classList.add('smg-bm-leaving');   // some com animação e tira do DOM
                setTimeout(() => card.remove(), 260);
            });
        });
        const share = card.querySelector('.smg-fp-share');
        if (share && share.parentNode) share.parentNode.insertBefore(rm, share);   // antes do compartilhar (que fica na borda)
        else (card.querySelector('.smg-fp-head') || card).appendChild(rm);
        return card;
    }
    function bmCardFromRec(rec) { return bmCard(rec.obj, { postId: rec.postId, note: rec.note, bmTs: rec.bmTs }); }
    // insere `node` (tem data-bm-ts) na lista mantendo ordem por bmTs DESC
    function bmPlaceByTs(list, node) {
        const ts = +(node.dataset.bmTs || 0);
        const kids = list.children;
        for (let i = 0; i < kids.length; i++) { if (ts > +(kids[i].dataset.bmTs || 0)) { list.insertBefore(node, kids[i]); return; } }
        list.appendChild(node);
    }
    let bmRendered = false;
    // RENDER: pinta do CACHE na hora (sem "configurando"), depois revalida pela rede e faz o DIFF (remove os que saíram,
    // busca só os NOVOS, atualiza nota/ordem). Sem IndexedDB, fdbGetBookmarks→[] e os put/delete viram no-op → cai no
    // comportamento antigo (busca tudo). O "Configurando…" só aparece quando NÃO há nada em cache (1ª vez).
    function renderBookmarksFeed(list) {
        if (bmRendered) return; bmRendered = true;
        fdbGetBookmarks().then(cached => {
            if (!list.isConnected) return;
            const byId = Object.create(null); cached.forEach(c => { byId[c.postId] = c; });
            const hadCache = cached.length > 0;
            if (hadCache) {
                list.innerHTML = '';
                cached.slice().sort((a, b) => (b.bmTs || 0) - (a.bmTs || 0)).forEach(rec => { try { list.appendChild(bmCardFromRec(rec)); } catch (e) {} });
            } else {
                list.innerHTML = '<div class="smg-fp-setup"><span class="smg-fp-setup-spin"></span><div class="smg-fp-setup-title">' + i18n('Setting up your feed') + '</div><div class="smg-fp-setup-sub">' + i18n('Gathering posts…') + '</div></div>';
            }
            bmFetchAllRows().then(rows => {
                if (!list.isConnected) return;
                const live = Object.create(null); rows.forEach(r => { live[r.postId] = r; });
                // removidos dos salvos (em outro dispositivo/aba) → tira do cache e da tela
                cached.forEach(c => { if (!live[c.postId]) { fdbDeleteBookmark(c.postId); const el = list.querySelector('[data-bm-id="' + c.postId + '"]'); if (el) el.remove(); } });
                // atualiza nota/ordem dos já cacheados (barato)
                rows.forEach(r => { const c = byId[r.postId]; if (c && (c.note !== r.note || c.bmTs !== r.bmTs)) { c.note = r.note; c.bmTs = r.bmTs; fdbPutBookmark(c); } });
                const fresh = rows.filter(r => !byId[r.postId]);
                if (!hadCache) { if (!rows.length) { list.innerHTML = '<div class="smg-fp-empty">' + i18n('No recent posts') + '</div>'; return; } list.innerHTML = ''; }
                if (!hadCache && !fresh.length) { list.innerHTML = '<div class="smg-fp-empty">' + i18n('No recent posts') + '</div>'; return; }
                fresh.forEach(r => {
                    const ph = document.createElement('div'); ph.className = 'smg-bm-skel'; ph.dataset.bmId = r.postId; ph.dataset.bmTs = String(r.bmTs || 0);
                    bmPlaceByTs(list, ph);   // posição certa por bmTs (novos salvos = topo)
                    riverEnqueue(() => bmFetchPost(r).then(obj => {
                        if (!ph.isConnected) return;
                        if (!obj) { ph.remove(); return; }
                        const rec = { postId: r.postId, obj: obj, note: r.note, bmTs: r.bmTs };
                        fdbPutBookmark(rec);
                        try { ph.replaceWith(bmCardFromRec(rec)); } catch (e) { ph.remove(); }
                    }));
                });
            }, () => { if (!hadCache && list.isConnected) list.innerHTML = '<div class="smg-fp-empty">' + i18n('No recent posts') + '</div>'; });
        });
    }
    let bmBuilt = false;
    function setupBookmarksFeed() {
        if (!FEATURES.bookmarksFeed || bmBuilt || !isBookmarksPage()) return;
        const blockBody = document.querySelector('.p-body-pageContent .block-body') || document.querySelector('.block-body');
        if (!blockBody || !blockBody.parentNode) return;
        bmBuilt = true;
        // REPLACE TOTAL: esconde a visão nativa inteira (barra de filtros + lista) e renderiza o feed no lugar dela.
        document.documentElement.classList.add('smg-bm-feed-on');   // CSS esconde a sidebar da conta + dá largura cheia
        const nativeBlock = blockBody.closest('.block') || blockBody;
        const feed = document.createElement('div'); feed.id = 'smg-bm-feed';
        const list = document.createElement('div'); list.className = 'smg-fp-list'; feed.appendChild(list);
        nativeBlock.parentNode.insertBefore(feed, nativeBlock);
        nativeBlock.style.setProperty('display', 'none', 'important');
        renderBookmarksFeed(list);
    }

    // =========================================================
    // FEED SYNC — enche o IndexedDB a partir das threads seguidas. RASO (1 página/thread, não
    // estoura requests) e INCREMENTAL (pula thread cujo último post já está no banco). Throttle
    // herda riverEnqueue (22-feed.js). Reusa riverWatchedThreads/riverFetchThread (parse).
    // =========================================================
    const FEED_SYNC_PAGES = 1;   // sweep raso: só a última página por thread (aprofundar = fase futura)
    let feedSyncRunning = false;

    // id numérico da thread a partir do base (.../threads/slug.123456)
    function threadIdFromBase(base) {
        const m = (base || '').match(/\.(\d+)$/) || (base || '').match(/\/threads\/(\d+)/);
        return m ? m[1] : (base || '');
    }

    const FEED_FRESH_WINDOW = 2 * 3600;   // 2h: threads ativas nesse intervalo ignoram o delta (lastTs da lista pode vir stale e o delta perdia post novo)
    const FEED_RECHECK_COOLDOWN = 300;    // PERF: mas a rebusca "cega" das recentes respeita um cooldown de 5min por thread — com o poll de 60s,
                                          // refetchar ~20 threads/min (HTML inteiro + parse + rewrite no IDB) era o custo dominante do feed parado,
                                          // com ZERO post novo. Delta detectando post novo continua furando o cooldown (busca na hora).
    function syncOneThread(t, cutoff, pages) {
        const tid = threadIdFromBase(t.base);
        const now = Math.floor(Date.now() / 1000);
        const recent = t.lastTs && (now - t.lastTs) < FEED_FRESH_WINDOW;
        return fdbGetThread(tid).then(stored => {
            // delta: pula se o cache já cobre o último post DO ITEM — exceto thread recente FORA do cooldown
            // (a recheck cega existe pro caso do lastTs stale; ≤5min de atraso nesse caso raro é aceitável).
            const covered = stored && t.lastTs && stored.lastPostTs && stored.lastPostTs >= t.lastTs;
            const recheckDue = !stored || !stored.updatedAt || (now - stored.updatedAt) > FEED_RECHECK_COOLDOWN;
            if (covered && !(recent && recheckDue)) return 0;
            return riverFetchThread(t, cutoff, pages || FEED_SYNC_PAGES).then(posts => {   // pages: cold start vasculha mais páginas/thread (riverFetchThread já para na janela)
                // lastPostTs PARTE do que já tínhamos (NÃO de t.lastTs!): avançar p/ o horário-da-lista sem ter
                // capturado o post fazia o delta pular a thread pra sempre (= "pegou só 1 de 3"). Agora só avança
                // pelo que FOI capturado → se perdeu o mais novo (cache stale do /latest), rebusca na próxima.
                const rec = { threadId: tid, title: t.fallbackTitle, thumb: t.thumb, base: t.base,
                    lastPostTs: (stored && stored.lastPostTs) || 0, updatedAt: now };
                if (!posts || !posts.length) { rec.lastPostTs = Math.max(rec.lastPostTs, t.lastTs || 0); return fdbPutThread(rec).then(() => 0); }   // 0 posts parseáveis (thread degenerada) → bumpa p/ não loopar
                posts.forEach(p => { p.threadId = tid; });
                rec.lastPostTs = posts.reduce((mx, p) => Math.max(mx, p.ts || 0), rec.lastPostTs);   // só o que capturou
                return fdbPutPosts(posts).then(() => fdbPutThread(rec)).then(() => posts.length);
            });
        }).catch(() => 0);
    }

    // URL da lista de seguidas (via nav nativa → respeita o board base; fallback /watched/threads)
    function feedWatchedUrl() {
        return (typeof navHref === 'function' && navHref('watchedThreads', 'watched', 'watchedThreads2')) || '/watched/threads';
    }
    const FEED_WATCHED_MAX_PAGES = 12;   // teto de páginas da lista de seguidas varridas num sync FUNDO (~20 threads/página → ~240 threads)
    // busca a lista de seguidas FRESCA e parseia, PAGINANDO enquanto:
    //   · minThreads (1º contato): ainda não juntou o alvo de threads (~120) — independe da janela, garante um backfill robusto; OU
    //   · cutoff (deep warm): a página inteira ainda está DENTRO da janela (lista ordenada por última atividade DESC → para quando o mais antigo caiu fora).
    //   cutoff FALSY + sem minThreads (poll raso) = só a página 1 — post novo SEMPRE borbulha a thread pro topo da pág 1.
    //   Segue o link "próxima" REAL do paginador (robusto ao esquema /page-N vs ?page=N). Fallback: DOM da página.
    function feedFetchWatchedThreads(cutoff, minThreads) {
        const out = [], seen = new Set();
        const absNext = doc => {
            const a = doc.querySelector('a.pageNav-jump--next[href], link[rel="next"][href], a[rel="next"][href]');
            const h = a && a.getAttribute('href');
            if (!h) return null;
            try { return new URL(h, location.href).href; } catch (e) { return null; }
        };
        const page = (url, depth) => fetchDoc(url, { credentials: 'same-origin' }).then(doc => {
            let oldest = Infinity, added = 0;
            riverWatchedThreads(doc).forEach(t => { if (seen.has(t.base)) return; seen.add(t.base); out.push(t); added++; if (t.lastTs) oldest = Math.min(oldest, t.lastTs); });
            const next = absNext(doc);
            const wantMore = (minThreads && out.length < minThreads)                       // 1º contato: persegue o alvo de threads
                || (cutoff && oldest !== Infinity && oldest >= cutoff);                     // deep: página ainda na janela
            if (next && added && depth < FEED_WATCHED_MAX_PAGES && wantMore)
                return page(next, depth + 1);
            return out;
        });
        let start; try { start = new URL(feedWatchedUrl(), location.href).href; } catch (e) { start = feedWatchedUrl(); }
        return page(start, 1).then(t => t.length ? t : riverWatchedThreads(document), () => out.length ? out : riverWatchedThreads(document));
    }
    // sync das seguidas (FUNDO: opts.deep pagina a lista até a janela; RASO/poll: só a pág 1). Resolve com nº de posts novos.
    function feedSync(cutoff, opts) {
        opts = opts || {};
        if (feedSyncRunning) return Promise.resolve(0);
        feedSyncRunning = true;
        let added = 0;
        return feedFetchWatchedThreads(opts.deep ? cutoff : 0, opts.minThreads).then(threads => {
            const total = threads.length; let done = 0;
            if (opts.onProgress) { try { opts.onProgress({ added: 0, done: 0, total: total }); } catch (e) {} }   // já mostra "0/total" assim que a lista chega
            return Promise.all(threads.map(t => riverEnqueue(() => syncOneThread(t, cutoff, opts.pagesPerThread).then(n => {
                added += n; done++;
                if (opts.onProgress) { try { opts.onProgress({ added: added, done: done, total: total }); } catch (e) {} }
                if (n && opts.onBatch) { try { opts.onBatch(added); } catch (e) {} }
            }))))
                .then(() => fdbSetMeta('lastSync', Math.floor(Date.now() / 1000)))
                .then(() => opts.deep ? fdbSetMeta('lastDeepSync', Math.floor(Date.now() / 1000)) : null)   // marca o último sweep FUNDO → o próximo open pula o re-pagina enquanto estiver fresco (TTL no kickSync)
                .then(() => fdbPrune(Math.floor(Date.now() / 1000) - RIVER_RETENTION_DAYS * 86400));   // poda por RETENÇÃO (≠ janela de busca): mantém o que já buscamos, só limpa o realmente antigo
        }).then(() => { feedSyncRunning = false; return added; }, () => { feedSyncRunning = false; return added; });
    }

    // =========================================================
    // FEED (river de posts) — modo "feed" da /watched/threads (?view=feed).
    // Arquitetura em 3 camadas: 21-feed-db.js (IndexedDB) · 22-feed-sync.js (busca/escreve) ·
    // ESTE (parse serializável + render). O render LÊ DO BANCO (cursor por ts desc, instantâneo)
    // e dispara o sync no fundo; o sync busca raso/incremental e escreve no banco.
    //   ⚠️ riverParsePost devolve só strings/números (vai pro IndexedDB → nada de nós do DOM).
    // =========================================================
    function isHomePage() { return (document.documentElement.getAttribute('data-template') || '') === 'forum_list' || document.documentElement.classList.contains('smg-home-page'); }
    // o feed mora SÓ na HOME agora (removido o modo da /watched/threads). Acesso exclusivo pela topbar (?view=feed).
    function feedContext() {
        return isHomePage() ? { key: 'smg-homeview' } : null;
    }
    // modo feed: ligado só com ?view=feed na URL (sem sticky — o caminho de entrada é sempre o link da topbar).
    function feedViewWanted() {
        return !!feedContext() && new URLSearchParams(location.search).get('view') === 'feed';
    }

    // janela de BUSCA: até quantos dias atrás paginamos por thread (≠ o que fica guardado). 14d → 1º contato traz mais história;
    // quem acessa sempre cai no delta (só o último dia, barato). Tunável: gmSet('smg-feed-window-days','21').
    const RIVER_WINDOW_DAYS = (parseInt(gmGet('smg-feed-window-days', ''), 10) || 14);
    const RIVER_MAX_PAGES = 4;     // máx páginas voltadas por thread (default; o sync usa 1 = raso)
    // RETENÇÃO (≠ janela de busca): quanto tempo o post FICA no banco. Maior que a janela → não joga fora o que já buscamos
    // (posts > 1 semana que vieram de brinde nas páginas recentes ficam visíveis no feed, scroll abaixo). Tunável: gmSet('smg-feed-retention-days','60').
    const RIVER_RETENTION_DAYS = (parseInt(gmGet('smg-feed-retention-days', ''), 10) || 30);
    // horas entre sweeps FUNDOS da lista de seguidas (re-descobre thread parada em pág 2+). Default 6h; ajuste com gmSet('smg-feed-deep-ttl','12').
    const FEED_DEEP_TTL = (parseInt(gmGet('smg-feed-deep-ttl', ''), 10) || 6) * 3600;
    const FEED_COLD_THREADS = (parseInt(gmGet('smg-feed-cold-threads', ''), 10) || 120);   // 1º contato: foreground busca AO MENOS esse tanto de threads (não para na janela)
    const FEED_BACKFILL_TTL = 24 * 3600;          // o drain de fundo re-varre TUDO no máx 1×/dia
    const FEED_BACKFILL_PAGE_DELAY = 1500;        // respiro entre páginas da lista no drain (fundo, sem pressa)
    const FEED_BACKFILL_MAX_PAGES = 50;           // teto de páginas do drain (~1000 threads)
    // SELF-HEAL do cache: BUMP isto sempre que o formato do post serializado (riverParsePost) ou a lógica de sync mudar.
    // Na próxima abertura, dataVersion != FEED_DATA_VERSION → o IDB é descartado e reconstruído sozinho (o usuário NÃO precisa limpar cache na mão).
    const FEED_DATA_VERSION = 6;

    // fila throttled p/ as buscas (não estoura o flood control do fórum) — usada pelo sync
    const RIVER_CONCURRENCY = 3;
    let riverActive = 0; const riverQueue = [];
    function riverPump() {
        while (riverActive < RIVER_CONCURRENCY && riverQueue.length) {
            const job = riverQueue.shift();
            riverActive++;
            Promise.resolve().then(job).then(() => { riverActive--; riverPump(); }, () => { riverActive--; riverPump(); });
        }
    }
    function riverEnqueue(job) {
        return new Promise(resolve => { riverQueue.push(() => job().then(resolve, () => resolve(null))); riverPump(); });
    }

    // watermark por host: na próxima visita só os posts mais novos que ISSO ganham o destaque "novo"
    const RIVER_WM_KEY = 'smg-river-wm-' + location.hostname;
    function riverWatermark() { return parseInt(gmGet(RIVER_WM_KEY, '0'), 10) || 0; }
    function riverSetWatermark(ts) { if (ts) gmSet(RIVER_WM_KEY, String(ts)); }

    // timestamp do último post de um item da lista (p/ ordenar/decidir delta)
    function structItemTs(it) {
        const t = it.querySelector('.structItem-cell--latest time, .structItem-latestDate time, time.structItem-latestDate, .structItem-latestDate, time');
        if (!t) return 0;
        let ts = parseInt(t.getAttribute('data-timestamp') || t.getAttribute('data-time') || '0', 10) || 0;
        if (!ts) { const dt = t.getAttribute('datetime'); if (dt) { const ms = Date.parse(dt); if (!isNaN(ms)) ts = Math.floor(ms / 1000); } }
        return ts;
    }
    // lê as threads seguidas de um doc (página da lista de seguidas) e ordena por recência real.
    // root = o doc buscado pelo sync (fresco) ou document (fallback). NUNCA confiar só no DOM da página: fica estagnado.
    function riverWatchedThreads(root) {
        const out = [];
        (root || document).querySelectorAll('.structItem--thread').forEach(it => {
            const titleA = it.querySelector('.structItem-title a[href*="/threads/"]');
            if (!titleA) return;
            const base = (titleA.getAttribute('href') || '').replace(/\/(unread|latest|page-\d+|post-\d+).*$/, '').replace(/[#?].*$/, '').replace(/\/$/, '');
            if (!base) return;
            out.push({ base: base, href: base + '/latest', fallbackTitle: (titleA.textContent || '').trim(), thumb: feedThumbUrl(it), lastTs: structItemTs(it) });
        });
        out.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
        return out;
    }

    // título = h1 SEM os prefixos (senão "ASMR OnlyFans" cola no nome); prefixos viram HTML de chips à parte
    const PREFIX_SEL = '.label, .labelLink, [class*="label--"], .prefix, [class*="prefix"]';
    function riverThreadMeta(doc, t) {
        const titleEl = doc.querySelector('h1.p-title-value, .p-title-value');
        let title = t.fallbackTitle || '', prefixesHtml = '';
        if (titleEl) {
            const clone = titleEl.cloneNode(true);
            const labels = Array.from(clone.querySelectorAll(PREFIX_SEL));
            prefixesHtml = labels.map(l => l.outerHTML).join('');
            labels.forEach(l => l.remove());
            title = (clone.textContent || '').replace(/\s+/g, ' ').trim() || t.fallbackTitle || '';
        }
        return { title: title, prefixesHtml: prefixesHtml, thumb: t.thumb || '' };
    }
    // busca uma thread: última página (/latest) e volta página a página enquanto o post mais antigo da página ainda
    // estiver na janela de BUSCA (cutoff, máx maxPages). ARMAZENA TUDO das páginas que tocou — inclusive posts > 1 semana
    // que dividem a página com os recentes (já buscamos, não joga fora). O cutoff controla só ATÉ ONDE paginar, não o que guardar;
    // a retenção (fdbPrune por RIVER_RETENTION_DAYS) é quem limpa o antigo de verdade. maxPages=1 = raso (sync).
    function riverFetchThread(t, cutoffTs, maxPages) {
        const collected = [];
        let pagesLeft = maxPages || RIVER_MAX_PAGES;
        function grab(url) {
            return fetchDoc(url, { credentials: 'same-origin' }).then(doc => {
                pagesLeft--;
                const meta = riverThreadMeta(doc, t);
                const parsed = Array.from(doc.querySelectorAll('article.message--post, article.message[data-content^="post-"]'))
                    .filter(p => p.querySelector('.message-userContent'))
                    .map(p => riverParsePost(p, meta, url)).filter(Boolean);
                let oldest = Infinity;
                parsed.forEach(p => { if (p.ts) oldest = Math.min(oldest, p.ts); collected.push(p); });   // guarda TODOS (já buscamos a página); cutoff só decide se vale buscar a página anterior
                if (pagesLeft > 0 && oldest !== Infinity && oldest >= cutoffTs) {
                    const canon = doc.querySelector('link[rel="canonical"]');
                    const ch = canon && canon.getAttribute('href');
                    const pm = ch && ch.match(/\/page-(\d+)/);
                    const cur = pm ? parseInt(pm[1], 10) : 1;
                    if (cur > 1) return grab(ch.replace(/\/page-\d+.*$/, '').replace(/[#?].*$/, '') + '/page-' + (cur - 1));
                }
                return null;
            });
        }
        let start; try { start = new URL(t.href, location.href).href; } catch (e) { return Promise.resolve([]); }
        return grab(start).then(() => collected, () => collected);
    }
    // des-lazya as imagens do conteúdo (SMG usa lazyload: data-src + <noscript>). A JS de lazyload do fórum NÃO
    // roda no feed → sem isso as imagens ficam placeholder. Roda no doc PARSEADO (scripting off → o img do
    // <noscript> é DOM real) ANTES de serializar; injetado na página viva, o noscript viraria TEXTO e a img sumiria.
    function riverUnlazy(root) {
        if (!root || !root.querySelectorAll) return;
        const realOf = el => { const u = (el.getAttribute('data-src') || el.getAttribute('data-url') || el.getAttribute('data-original') || el.getAttribute('src') || ''); return /^data:/.test(u) ? '' : u; };
        root.querySelectorAll('img').forEach(img => {
            const cur = img.getAttribute('src') || '';
            const real = img.getAttribute('data-src') || img.getAttribute('data-url') || img.getAttribute('data-original') || '';
            if (real && !/^data:/.test(real) && (!cur || /^data:/.test(cur))) img.setAttribute('src', real);
            const ss = img.getAttribute('data-srcset'); if (ss) img.setAttribute('srcset', ss);
            // loading=lazy NATIVO (não depende da JS de lazyload do fórum, que é o que não roda aqui):
            // difere o fetch das offscreen. Remover o attr deixava TODA img do chunk eager — baixava/decodificava
            // mídia que o freeze (±1500px) descartava logo em seguida.
            img.setAttribute('loading', 'lazy'); img.classList.remove('lazyload', 'lazyloading', 'lazyloaded');
        });
        root.querySelectorAll('noscript').forEach(ns => {
            let inner = ns.querySelector && ns.querySelector('img');   // captura (DOMParser): noscript é DOM
            if (!inner && ns.textContent && /<img/i.test(ns.textContent)) {   // render (página viva): noscript virou TEXTO → re-parseia o HTML
                try { inner = new DOMParser().parseFromString(ns.textContent, 'text/html').querySelector('img'); } catch (e) {}
            }
            if (!inner) { ns.remove(); return; }   // noscript sem img → remove (senão vira texto no inject)
            const real = (ns.ownerDocument || document).importNode(inner, true);
            const r = realOf(real); if (r) real.setAttribute('src', r);
            real.setAttribute('loading', 'lazy'); real.classList.remove('lazyload', 'lazyloading', 'lazyloaded');
            const prev = ns.previousElementSibling;
            if (prev && prev.tagName === 'IMG') { prev.replaceWith(real); ns.remove(); } else ns.replaceWith(real);
        });
        // WRAPPERS lazyload (ex.: .bbImageWrapper do SMG): o CSS do fórum faz `.lazyload{opacity:0}` até a JS
        // de lazyload marcar `lazyloaded` — JS que NÃO roda no feed. Tirar a classe de TODO elemento (não só
        // img) revela o pixel; sem isso a img tem src real mas o wrapper fica opacity:0 e some.
        if (root.classList) root.classList.remove('lazyload', 'lazyloading');
        root.querySelectorAll('.lazyload, .lazyloading').forEach(el => el.classList.remove('lazyload', 'lazyloading'));
    }
    // extrai um post → objeto SERIALIZÁVEL (vai pro IndexedDB): nada de nós do DOM, só strings/números
    function riverParsePost(post, meta, threadUrl) {
        const body = post.querySelector('.message-userContent .bbWrapper') || post.querySelector('.message-userContent');
        if (!body) return null;
        riverUnlazy(body);   // resolve as imagens lazy ANTES de serializar (senão somem no feed do SMG)
        const dc = post.getAttribute('data-content') || '';
        const m = dc.match(/post-(\d+)/) || (post.id || '').match(/(\d+)/);
        const postId = m ? m[1] : '';
        if (!postId) return null;
        let ts = 0;
        const times = post.querySelectorAll('.message-attribution time, time');
        for (let i = 0; i < times.length && !ts; i++) {
            const te = times[i];
            ts = parseInt(te.getAttribute('data-timestamp') || te.getAttribute('data-time') || '0', 10) || 0;
            if (!ts) { const dt = te.getAttribute('datetime'); if (dt) { const ms = Date.parse(dt); if (!isNaN(ms)) ts = Math.floor(ms / 1000); } }
        }
        const author = (post.getAttribute('data-author') || '').trim()
            || (((post.querySelector('.message-name .username, .message-name') || {}).textContent) || '').trim();
        const authorA = post.querySelector('.message-name a[href*="/members/"], .message-avatar a[href*="/members/"]');
        let permalink = threadUrl;
        const permA = post.querySelector('.message-attribution a[href*="/post-"], a.message-attribution-gadget[href*="/post-"]');
        if (permA) { try { permalink = new URL(permA.getAttribute('href'), location.href).href; } catch (e) {} }
        else permalink = threadUrl.replace(/[#?].*$/, '').replace(/\/(latest|unread|page-\d+|post-\d+)$/, '') + '#post-' + postId;
        return {
            postId: postId, ts: ts, author: author, authorHref: authorA ? authorA.getAttribute('href') : '',
            threadTitle: meta.title, prefixesHtml: meta.prefixesHtml || '', threadThumb: meta.thumb || '',
            permalink: permalink, contentHtml: body.outerHTML || ''
        };
    }

    function buildFeedOpen(href) {
        const a = document.createElement('a');
        a.className = 'smg-fp-open'; a.href = href;
        const t = document.createElement('span'); t.textContent = i18n('Open in thread');
        a.appendChild(t);
        a.insertAdjacentHTML('beforeend', ICONS.arrowRight);
        return a;
    }
    // card: [foto da thread] · tags / nome do tópico / postado por autor · tempo · conteúdo · footer
    function riverCard(p, wm) {
        const card = document.createElement('div');
        card.className = 'smg-fp-card' + (p.ts && p.ts > wm ? ' is-unread' : '');
        card.dataset.ts = String(p.ts || 0);
        card._html = p.contentHtml || '';   // p/ a poda "descongelar" o conteúdo depois

        const head = document.createElement('div'); head.className = 'smg-fp-head';
        const thumbA = document.createElement('a'); thumbA.className = 'smg-fp-thumb'; thumbA.href = p.permalink || '#';
        const tLetter = ((p.threadTitle || '?').trim().charAt(0) || '?').toUpperCase();
        if (p.threadThumb) {
            const im = document.createElement('img'); im.src = p.threadThumb; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; im.alt = '';
            im.addEventListener('error', () => { im.remove(); thumbA.classList.add('smg-fp-thumb--letter'); thumbA.textContent = tLetter; });
            thumbA.appendChild(im);
        } else { thumbA.classList.add('smg-fp-thumb--letter'); thumbA.textContent = tLetter; }
        head.appendChild(thumbA);

        const meta = document.createElement('div'); meta.className = 'smg-fp-meta';
        if (p.prefixesHtml) { const tags = document.createElement('div'); tags.className = 'smg-fp-tags'; tags.innerHTML = p.prefixesHtml; meta.appendChild(tags); }
        const tname = document.createElement('a'); tname.className = 'smg-fp-tname'; tname.href = p.permalink || '#'; tname.textContent = p.threadTitle || ''; meta.appendChild(tname);
        const by = document.createElement('div'); by.className = 'smg-fp-by';
        by.appendChild(document.createTextNode(i18n('post by') + ' '));
        if (p.author) { const au = document.createElement(p.authorHref ? 'a' : 'span'); au.className = 'smg-fp-byname'; if (p.authorHref) au.href = p.authorHref; au.textContent = p.author; by.appendChild(au); }
        if (p.ts) { const dot = document.createElement('span'); dot.className = 'smg-fp-dot'; dot.textContent = ' · '; by.appendChild(dot); const tm = document.createElement('span'); tm.className = 'smg-fp-time'; tm.textContent = smgRelTime(p.ts); by.appendChild(tm); }
        meta.appendChild(by);
        head.appendChild(meta);
        // botão de compartilhar (copia o permalink do post) — canto sup-direito do card
        const share = document.createElement('button');
        share.type = 'button'; share.className = 'smg-fp-share'; share.setAttribute('aria-label', 'Share'); share.title = i18n('Copy link');
        share.innerHTML = ICONS.share;
        share.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            const url = p.permalink || location.href;
            const done = () => { share.innerHTML = ICONS.shareDone; share.classList.add('is-done'); setTimeout(() => { share.innerHTML = ICONS.share; share.classList.remove('is-done'); }, 1400); };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy link:', url));
            else window.prompt('Copy link:', url);
        });
        head.appendChild(share);
        card.appendChild(head);

        const c = document.createElement('div'); c.className = 'smg-fp-content message-userContent';
        if (p.contentHtml) { c.innerHTML = p.contentHtml; riverUnlazy(c); }   // injeta + des-lazya (cache velho/noscript-virou-texto) → o observer global embeda mídia + masonry
        card.appendChild(c);

        card.appendChild(buildFeedOpen(p.permalink || '#'));
        return card;
    }

    // container onde o river mora = o PAI do bloco da lista (ancorado no .structItem--thread → robusto). Cacheado.
    let riverHost = null;
    function riverContainer() {
        if (riverHost && riverHost.isConnected) return riverHost;
        const item = document.querySelector('.structItem--thread');
        const block = item && item.closest('.block');
        riverHost = (block && block.parentElement)
            || document.querySelector('.p-body-main') || document.querySelector('.p-body-content')
            || document.querySelector('.p-body-inner') || document.querySelector('.p-body') || document.body;
        return riverHost;
    }

    // ---- RENDER (lê do banco; o sync enche em background) ----
    const RIVER_CHUNK = 15;   // posts pintados por bloco (scroll)
    let riverBuilt = false, riverList = null, riverSeen = null, riverLastTs = null, riverOldWm = 0,
        riverMoreEl = null, riverMoreIO = null, riverNoMore = false, riverRendering = false,
        riverPill = null, riverFreezeIO = null, riverFirstPainted = false;

    // PODA: card a >1500px da viewport tem o conteúdo "congelado" (altura travada, innerHTML limpo →
    // descarrega imagens/vídeos, para o áudio). Ao voltar pra perto, descongela do _html guardado.
    // Mantém o DOM/memória limitados num scroll longo sem mexer no scroll (altura preservada).
    function riverFreeze(card, preH) {   // preH: altura pré-lida em lote pelo IO (evita reflow forçado por card)
        if (card._frozen) return;
        const c = card.querySelector('.smg-fp-content');
        if (!c) return;
        const h = preH != null ? preH : c.offsetHeight;
        if (!h) return;
        c.style.height = h + 'px';
        c.innerHTML = '';
        card._frozen = true;
    }
    function riverThaw(card) {
        if (!card._frozen) return;
        const c = card.querySelector('.smg-fp-content');
        if (c) { c.innerHTML = card._html || ''; riverUnlazy(c); c.style.height = ''; }   // des-lazya de novo ao descongelar
        card._frozen = false;
    }
    function riverObserveCard(card) {
        if (!riverFreezeIO) {
            if (typeof IntersectionObserver === 'undefined') return;
            riverFreezeIO = new IntersectionObserver(ents => {
                // 2 FASES (lê todas as alturas → depois escreve): offsetHeight intercalado com innerHTML=''
                // forçava um reflow da página inteira POR card no mesmo callback (vários cards cruzam o
                // limiar num batch de scroll rápido)
                const toFreeze = [], toThaw = [];
                ents.forEach(e => { if (e.isIntersecting) toThaw.push(e.target); else if (!e.target._frozen) toFreeze.push(e.target); });
                const hs = toFreeze.map(card => { const c = card.querySelector('.smg-fp-content'); return c ? c.offsetHeight : 0; });
                toFreeze.forEach((card, i) => riverFreeze(card, hs[i]));
                toThaw.forEach(riverThaw);
            }, { rootMargin: '1500px 0px' });
        }
        riverFreezeIO.observe(card);
    }

    // pílula "N novos posts" (estilo Twitter): aparece quando o sync traz coisa nova e você NÃO está no topo
    function riverNearTop() { return (window.scrollY || document.documentElement.scrollTop || 0) <= 600; }
    function showPill(n) {
        if (!riverPill || !n) return;
        riverPill.querySelector('.smg-river-pill-t').textContent = n + ' ' + i18n(n === 1 ? 'new post' : 'new posts');
        riverPill.hidden = false;
    }
    function hidePill() { if (riverPill) riverPill.hidden = true; }

    function riverEmptyState(msg) {
        if (riverMoreIO) { riverMoreIO.disconnect(); riverMoreIO = null; }
        if (riverMoreEl) { riverMoreEl.remove(); riverMoreEl = null; }
        if (riverList) riverList.innerHTML = '<div class="smg-fp-empty">' + msg + '</div>';
    }
    // 1ª pintura real: troca o spinner grande (.smg-fp-loading) pela lista + monta a sentinela. Idempotente.
    // Enquanto não há post pra mostrar (cache frio + sync na rede), o spinner FICA — sem isso a lista some.
    function firstPaint() {
        if (riverFirstPainted || !riverList) return;
        riverFirstPainted = true;
        riverList.innerHTML = '';   // remove o .smg-fp-loading
        mountSentinel();
    }
    // pinta o próximo bloco do BANCO. >0 = pintou; 0 = banco esgotado; -1 = pulado (já renderizando/fim)
    function renderNextChunk() {
        if (riverRendering || riverNoMore || !riverList) return Promise.resolve(-1);
        riverRendering = true;
        return fdbGetPostsDesc(RIVER_CHUNK, riverLastTs, riverSeen).then(posts => {
            riverRendering = false;
            if (!posts.length) return 0;
            firstPaint();   // só limpa o loader QUANDO há conteúdo de fato (senão o spinner segue girando)
            const frag = document.createDocumentFragment();
            const cards = [];
            posts.forEach(p => { riverSeen.add(p.postId); try { const card = riverCard(p, riverOldWm); cards.push(card); frag.appendChild(card); } catch (e) {} });
            if (riverMoreEl) riverList.insertBefore(frag, riverMoreEl); else riverList.appendChild(frag);
            cards.forEach(riverObserveCard);   // poda: começa a vigiar cada card novo
            riverLastTs = posts[posts.length - 1].ts;
            return posts.length;
        }, () => { riverRendering = false; return 0; });
    }
    // NOVIDADES (otimização de novos itens): pega os posts UNSEEN que pertencem à janela já renderizada —
    // ts ACIMA do cursor de baixo (riverLastTs). NÃO usa "ts > topo": o sync pode capturar um post FORA DE ORDEM
    // (mais novo que a base, porém MAIS VELHO que um topo pintado num poll anterior — ex.: thread veio stale e só
    // entrou no poll seguinte). Com "ts > topo" esse post sumia. Aqui pega tudo que é unseen e cai dentro/acima da janela.
    function fetchFreshPosts() {
        if (!riverList || !riverSeen) return Promise.resolve([]);
        const floor = riverLastTs || 0;
        // PERF: passa o floor (riverLastTs = ts do card MAIS ANTIGO pintado) como limite inferior do cursor IDB →
        // ele só varre a faixa acima da janela renderizada, em vez de começar no topo e pular O(|seen|) já-vistos a
        // cada poll de 60s. Cobre captura fora de ordem (post entre floor e o topo entra: ts > floor). O filtro JS
        // abaixo vira redundante-seguro (garante o caso floor=0, em que afterTs=null = comportamento original).
        return fdbGetPostsDesc(80, null, riverSeen, floor || null).then(
            posts => posts.filter(p => !floor || (p.ts || 0) > floor),
            () => []
        );
    }
    // insere cada post novo na POSIÇÃO CERTA (ts desc), não só no topo → respeita captura fora de ordem.
    // Preserva scroll e os cards já pintados; o observer global embeda a mídia dos novos.
    function insertFreshPosts(posts) {
        // materializa a lista 1× (não por post): os novos chegam em ts-desc e entram entre cards
        // ORIGINAIS, então o ref de inserção é sempre um card pré-existente → cachear evita o qSA O(n·m)/post.
        const existing = riverList.querySelectorAll('.smg-fp-card');
        posts.forEach(p => {
            if (riverSeen.has(p.postId)) return;
            riverSeen.add(p.postId);
            let card; try { card = riverCard(p, riverOldWm); } catch (e) { return; }
            card.classList.add('smg-fp-enter');   // entrada animada (só os recém-chegados; some após a animação)
            setTimeout(() => card.classList.remove('smg-fp-enter'), 1300);
            let ref = null;
            for (let i = 0; i < existing.length; i++) { if ((+existing[i].dataset.ts || 0) < (p.ts || 0)) { ref = existing[i]; break; } }
            if (ref) riverList.insertBefore(card, ref);
            else if (riverMoreEl) riverList.insertBefore(card, riverMoreEl);
            else riverList.appendChild(card);
            riverObserveCard(card);
        });
    }
    function renderMore() {
        renderNextChunk().then(n => {
            if (n === 0) {
                if (!feedSyncRunning) { riverNoMore = true; if (riverMoreIO) { riverMoreIO.disconnect(); riverMoreIO = null; } if (riverMoreEl) { riverMoreEl.remove(); riverMoreEl = null; } }
            } else if (n > 0 && riverMoreEl && riverMoreIO) {
                riverMoreIO.unobserve(riverMoreEl); riverMoreIO.observe(riverMoreEl);   // re-observa: enche até passar a viewport (render local = barato)
            }
        });
    }
    function mountSentinel() {
        riverMoreEl = document.createElement('button'); riverMoreEl.type = 'button'; riverMoreEl.className = 'smg-river-more';
        riverMoreEl.innerHTML = '<span class="smg-loading"></span><span class="smg-river-more-t">' + i18n('Load more') + '</span>';
        if (feedSyncRunning) riverMoreEl.classList.add('is-loading');   // montou DURANTE o sync (firstPaint roda após o kickSync) → já nasce girando
        riverMoreEl.addEventListener('click', renderMore);
        riverList.appendChild(riverMoreEl);
        riverMoreIO = new IntersectionObserver(ents => { ents.forEach(e => { if (e.isIntersecting) renderMore(); }); }, { rootMargin: '600px 0px' });
        riverMoreIO.observe(riverMoreEl);
    }
    // recarrega o topo do banco (após o sync trazer novidades) — só se o usuário está perto do topo
    function refreshTop(force) {
        if (!riverList || (!force && (window.scrollY || document.documentElement.scrollTop || 0) > 600)) return;
        if (riverFreezeIO) riverFreezeIO.disconnect();   // os cards atuais vão embora → para de vigiá-los (os novos re-observam)
        Array.prototype.slice.call(riverList.querySelectorAll('.smg-fp-card')).forEach(el => el.remove());
        riverSeen = new Set(); riverLastTs = null; riverNoMore = false;
        hidePill();
        if (!riverMoreEl) mountSentinel();
        renderMore();
        saveNewestWatermark();   // o usuário está vendo o topo → marca os novos como vistos
    }
    // 1ª vez (cache vazio): em vez de um spinner mudo, mostra "Configurando seu feed" + progresso enquanto o sync
    // varre TODAS as threads seguidas pela rede. FICA na tela até o sync inteiro terminar (não some no 1º batch) —
    // aí pinta tudo de uma vez (afterSync→renderMore). O setupProgress atualiza a contagem/barra ao vivo.
    function showSetupState() {
        if (!riverList || riverFirstPainted) return;
        riverList.innerHTML =
            '<div class="smg-fp-setup">' +
                '<span class="smg-fp-setup-spin"></span>' +
                '<div class="smg-fp-setup-title">' + i18n('Setting up your feed') + '</div>' +
                '<div class="smg-fp-setup-sub">' + i18n('Reading the threads you follow…') + '</div>' +
                '<div class="smg-fp-setup-bar"><span class="smg-fp-setup-barfill"></span></div>' +
            '</div>';
    }
    // atualiza o aviso de setup ao vivo: "{done}/{total} tópicos · {added} posts" + barra de progresso. No-op após a 1ª pintura.
    function setupProgress(p) {
        if (!riverList || riverFirstPainted || !p) return;
        const sub = riverList.querySelector('.smg-fp-setup-sub');
        const fill = riverList.querySelector('.smg-fp-setup-barfill');
        if (!sub) return;
        if (!p.total) { sub.textContent = i18n('Reading the threads you follow…'); return; }
        sub.textContent = p.done + '/' + p.total + ' ' + i18n('threads') + ' · ' + p.added + ' ' + i18n('posts');
        if (fill) fill.style.width = Math.round((p.done / p.total) * 100) + '%';
    }
    function buildRiver() {
        if (riverBuilt || document.getElementById('smg-river')) return;
        riverBuilt = true;

        const wrap = document.createElement('div'); wrap.id = 'smg-river';
        // header do feed (título + slot p/ o ícone de notices) — substitui a antiga tabbar como "barra" do feed
        const fhead = document.createElement('div'); fhead.className = 'smg-river-head';
        fhead.innerHTML = '<h1 class="smg-river-title">Timeline</h1><div class="smg-river-head-actions"></div>';
        wrap.appendChild(fhead);
        riverList = document.createElement('div'); riverList.className = 'smg-fp-list';
        riverList.innerHTML = '<div class="smg-fp-loading"><span class="smg-loading"></span></div>';
        wrap.appendChild(riverList);
        // pílula "novos posts" (fixed, flutua no topo) — clicar recarrega o topo e sobe
        riverPill = document.createElement('button'); riverPill.type = 'button'; riverPill.className = 'smg-river-pill'; riverPill.hidden = true;
        riverPill.innerHTML = ICONS.show + '<span class="smg-river-pill-t"></span>';   // chevron-up (reusa o registry; era inline igual ao ICONS.show)
        riverPill.addEventListener('click', () => { refreshTop(true); window.scrollTo(0, 0); });
        wrap.appendChild(riverPill);
        const host = riverContainer();
        host.appendChild(wrap);

        riverSeen = new Set(); riverLastTs = null; riverNoMore = false; riverOldWm = riverWatermark();
        const cutoff = Math.floor(Date.now() / 1000) - RIVER_WINDOW_DAYS * 86400;

        // SELF-HEAL: se o formato do cache mudou (FEED_DATA_VERSION bumpado), descarta e reconstrói ANTES de ler → a mudança reflete sozinha
        fdbEnsureVersion(FEED_DATA_VERSION).then(() => fdbCountPosts()).then(count => {
            if (count) renderMore();          // cache existe → pinta na hora (firstPaint troca o spinner pelo conteúdo)
            else showSetupState();            // cache vazio = 1ª vez (ou pós-reset) → "Configurando seu feed" FICA até o sync inteiro terminar
            kickSync(cutoff, !count);         // cold = cache vazio → varre fundo (+ páginas/thread) e só pinta no fim
        }, () => { firstPaint(); kickSync(cutoff, true); });   // sem IndexedDB → degrada (só sync, sem cache)
    }
    function saveNewestWatermark() { fdbGetPostsDesc(1, null, null).then(top => { if (top.length) riverSetWatermark(top[0].ts || 0); }); }
    // depois de cada sync: pinta o cache se estava vazio; senão detecta NOVIDADES (unseen dentro/acima da janela,
    // não "ts > topo" — captura fora de ordem!) e insere em ordem (perto do topo) ou mostra a pílula.
    function afterSync() {
        return fdbCountPosts().catch(() => 0).then(count => {
            if (!count) { riverEmptyState(i18n('No recent posts')); return; }
            if (!riverSeen.size) { renderMore(); saveNewestWatermark(); return; }   // cache vazio na abertura → pinta agora
            return fetchFreshPosts().then(fresh => {
                if (!fresh.length) return;
                if (riverNearTop()) { insertFreshPosts(fresh); saveNewestWatermark(); }   // insere em ordem (preserva scroll + cards de baixo)
                else showPill(fresh.length);   // longe do topo → pílula (não marca visto → highlight preservado)
            });
        });
    }
    // base canônica + título da thread ABERTA (página de thread). '' se não for uma thread.
    function feedCurrentThread() {
        if (!/\/threads\//.test(location.pathname)) return null;
        const canon = document.querySelector('link[rel="canonical"]');
        let base = (canon && canon.getAttribute('href')) || location.href;
        base = base.replace(/\/(unread|latest|page-\d+|post-\d+).*$/, '').replace(/[#?].*$/, '').replace(/\/$/, '');
        if (!base) return null;
        const titleEl = document.querySelector('h1.p-title-value, .p-title-value');
        const title = titleEl ? (titleEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
        return { base: base, title: title };
    }
    // SEGUIR thread → joga ela no nosso banco NA HORA (puxa os posts recentes), sem esperar o sync da home.
    // Reusa o pipeline do sync (syncOneThread) → mesmo parse/dedupe/janela. Surfacing se o feed estiver aberto.
    function feedAddThread(base, title, thumb) {
        if (!base) return Promise.resolve(0);
        const cutoff = Math.floor(Date.now() / 1000) - RIVER_WINDOW_DAYS * 86400;
        const t = { base: base, href: base + '/latest', fallbackTitle: title || '', thumb: thumb || '', lastTs: Math.floor(Date.now() / 1000) };
        return fdbEnsureVersion(FEED_DATA_VERSION)   // garante o schema/versão certo mesmo se o feed nunca foi aberto nesta sessão
            .then(() => syncOneThread(t, cutoff, RIVER_MAX_PAGES))
            .then(n => { if (n && riverList && riverList.isConnected) afterSync(); return n; })
            .catch(() => 0);
    }
    function feedAddCurrentThread() { const c = feedCurrentThread(); return c ? feedAddThread(c.base, c.title, '') : Promise.resolve(0); }
    // DEIXAR DE SEGUIR → tira a thread (e os posts dela) do banco, pra não vazar no feed depois.
    function feedRemoveCurrentThread() {
        const c = feedCurrentThread(); if (!c) return Promise.resolve();
        return fdbDeleteThread(threadIdFromBase(c.base));
    }
    function kickSync(cutoff, cold) {
        if (riverMoreEl) riverMoreEl.classList.add('is-loading');
        // COLD (1ª vez / pós-reset, com a mensagem na tela): varre FUNDO + MAIS páginas por thread e mostra progresso ao vivo;
        //   NÃO pinta incremental — afterSync pinta TUDO de uma vez quando o sync inteiro termina (a msg fica até lá).
        // WARM: DEEP só quando o cache está VELHO (> TTL) — aí re-pagina a lista (acha thread em pág 2+); senão RASO (page 1).
        //   Pro propósito do banco: não re-paginar 12 páginas a cada abertura. WARM pinta do IDB e o afterSync insere as novidades.
        const go = deep => {
            const opts = { deep: deep };
            if (cold) { opts.pagesPerThread = RIVER_MAX_PAGES; opts.minThreads = FEED_COLD_THREADS; opts.onProgress = setupProgress; }   // cold: 120 threads no mín + mais páginas/thread + barra de progresso
            else opts.onBatch = () => { if (riverList && riverSeen && !riverSeen.size) renderMore(); };
            feedSync(cutoff, opts)
                .then(() => { if (riverMoreEl) riverMoreEl.classList.remove('is-loading'); return afterSync(); })
                .then(() => feedBackfill(cutoff));   // FUNDO: depois do foreground, continua varrendo o resto das seguidas de pouco em pouco até o banco ter tudo
        };
        if (cold) { go(true); return; }   // cold sempre fundo
        fdbGetMeta('lastDeepSync').then(
            last => go(!last || (Math.floor(Date.now() / 1000) - last) > FEED_DEEP_TTL),
            () => go(true));   // sem meta/IDB → deep
    }
    // DRAIN de FUNDO: depois do foreground (120 threads), continua varrendo a lista de seguidas INTEIRA, página a página,
    // sincronizando cada thread no banco — de pouco em pouco, throttle compartilhado (riverEnqueue), respiro entre páginas
    // e PAUSA quando a aba some. As recentes já vieram no foreground → o delta do syncOneThread as pula barato. Marca
    // 'backfillDone' ao completar (re-varre no máx 1×/dia); se cancelado (saiu do feed), NÃO marca → retoma no próximo open.
    let feedBackfillRunning = false, feedBackfillStop = false;
    function feedWhenVisible() {
        if (!document.hidden) return Promise.resolve();
        return new Promise(resolve => {
            const on = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', on); resolve(); } };
            document.addEventListener('visibilitychange', on);
        });
    }
    function feedBackfillNext(doc) {
        const a = doc.querySelector('a.pageNav-jump--next[href], link[rel="next"][href], a[rel="next"][href]');
        const h = a && a.getAttribute('href');
        if (!h) return null;
        try { return new URL(h, location.href).href; } catch (e) { return null; }
    }
    function feedBackfill(cutoff) {
        if (feedBackfillRunning) return Promise.resolve();
        feedBackfillRunning = true; feedBackfillStop = false;
        return fdbGetMeta('backfillDone').then(done => {
            if (done && (Math.floor(Date.now() / 1000) - done) < FEED_BACKFILL_TTL) return null;   // já completou no último dia → nada
            let added = 0; const seen = new Set();
            const walk = (url, depth) => {
                if (feedBackfillStop || !url || !riverList || !riverList.isConnected) return Promise.resolve();
                return feedWhenVisible()
                    .then(() => fetchDoc(url, { credentials: 'same-origin' }))
                    .then(doc => {
                        const threads = riverWatchedThreads(doc).filter(t => { if (seen.has(t.base)) return false; seen.add(t.base); return true; });
                        const next = feedBackfillNext(doc);
                        return Promise.all(threads.map(t => riverEnqueue(() => syncOneThread(t, cutoff, 1).then(n => { added += n; }))))
                            .then(() => {
                                if (feedBackfillStop || !next || depth >= FEED_BACKFILL_MAX_PAGES) return;
                                return new Promise(res => setTimeout(res, FEED_BACKFILL_PAGE_DELAY)).then(() => walk(next, depth + 1));
                            });
                    }, () => {});   // página falhou → encerra o drain (retoma depois)
            };
            let start; try { start = new URL(feedWatchedUrl(), location.href).href; } catch (e) { start = feedWatchedUrl(); }
            return walk(start, 1).then(() => {
                if (feedBackfillStop) return;   // cancelado → não marca completo (retoma no próximo open)
                return fdbSetMeta('backfillDone', Math.floor(Date.now() / 1000)).then(() => { if (added) afterSync(); });   // completou → surfacing das novidades acumuladas
            });
        }).then(() => { feedBackfillRunning = false; }, () => { feedBackfillRunning = false; });
    }
    // POLLING: enquanto o feed está visível, re-sincroniza (lista FRESCA + delta) → posts novos aparecem via
    // pílula sem recarregar a página. Resolve o "saiu há 2 min e não atualizou". Para ao sair do feed / aba oculta.
    let feedPollTimer = null;
    function feedPoll() {
        if (document.hidden || !riverList || !riverList.isConnected) return;
        feedSync(Math.floor(Date.now() / 1000) - RIVER_WINDOW_DAYS * 86400, {}).then(() => afterSync());
    }
    function feedVisPoll() { if (!document.hidden) feedPoll(); }
    function feedStartPoll() {
        if (feedPollTimer) return;
        feedPollTimer = setInterval(feedPoll, 60000);
        document.addEventListener('visibilitychange', feedVisPoll);
    }
    function feedStopPoll() {
        if (feedPollTimer) { clearInterval(feedPollTimer); feedPollTimer = null; }
        document.removeEventListener('visibilitychange', feedVisPoll);
        feedBackfillStop = true;   // saiu do feed → cancela o drain de fundo (retoma no próximo open)
    }

    // ---- ativa o modo feed (home ?view=feed) ----  (sem tabbar: a saída é o logo/Home da topbar)
    function applyRiverMode(mode) {
        const feed = mode === 'feed';
        document.documentElement.classList.toggle('smg-watched-feed', feed);
        const host = riverContainer();
        Array.prototype.forEach.call(host.children, ch => {
            if (ch.id === 'smg-river') return;
            ch.classList.toggle('smg-river-hide', feed);
        });
        if (feed) { buildRiver(); feedStartPoll(); } else feedStopPoll();
    }
    let riverSetupDone = false;
    function setupFeedView() {
        if (riverSetupDone) return;
        if (!feedContext()) return;
        riverSetupDone = true;
        if (feedViewWanted()) applyRiverMode('feed');   // home + ?view=feed → monta o river; senão home normal (nada)
    }

    // =========================================================
    // INIT: processAll() roda TODAS as features · scheduleRun (coalesce rAF do observer) ·
    //       detectPageClasses (smg-sc/smg-smg/home/threadlist/thread) · boot() + MutationObserver.
    //       ⇒ processAll roda quase TODO frame: cada pass tem que sair barato (REGRA DE OURO, ver topo).
    // =========================================================
    function processAll(roots) {
        if (smgDisabled) return;   // kill-switch global (gmSet('smg-off','1') p/ desligar tudo)

        if (FEATURES.customFavicon) safe(setFavicon);

        if (FEATURES.autoFullImages) safe(unlazyImageLinks, roots);   // jpg6.su/jpg5 & afins: materializa a img do noscript (ou mostra o link) ANTES do processImages/masonry
        if (FEATURES.autoFullImages) safe(processImages, roots);
        if (FEATURES.imageLightbox) safe(setupImageClickFeed);
        if (FEATURES.unwrapLinks) safe(unwrapRedirectLinks, roots);   // PRIMEIRO: revela a URL real (goto/redirect) p/ os embeds verem o link verdadeiro
        if (FEATURES.fileHostCards) safe(processFileHostCards, roots);   // CEDO (logo após o unwrap): card de file-host (pixeldrain/bunkr/gofile/…) já aparece com skeleton, sem esperar o pipeline de imagens; ANTES do groupLinks
        if (FEATURES.turboEmbeds) safe(processTurboLinks, roots);
        if (FEATURES.turboEmbeds) safe(processTurboNativeEmbeds, roots);   // Simp: turbo nativo (iframe) → nosso player
        if (FEATURES.saintEmbeds) safe(processSaintLinks, roots);
        if (FEATURES.imagepondEmbeds) safe(processImagepondNativeEmbeds, roots);   // SMG: imagepond nativo (iframe) → nosso player
        if (FEATURES.directMedia) safe(processFileditchLinks, roots);   // Fileditch: página-viewer → resolve o <source> temp → nosso player (ANTES do directMedia, que não toca file.php)
        if (FEATURES.directMedia) safe(processDirectMedia, roots);
        if (FEATURES.groupLinks) safe(groupPostLinks, roots);
        if (FEATURES.revealLikedPosts) safe(revealLikedPosts, roots);
        if (FEATURES.redgifsPlayer) safe(applyRedgifsPlayer, roots);   // ANTES do autoLoad: reivindica os loaders e troca o iframe por <video> (à prova de falha)
        if (FEATURES.autoLoadRedgifs) safe(autoLoadRedgifs, roots);
        safe(markG2wWrappers, roots);   // marca .smg-has-g2w no wrapper-pai dos embeds → CSS casa classe estática em vez do :has(.generic2wide-iframe-div)
        if (FEATURES.autoExpandSpoilers) safe(autoExpandSpoilers, roots);
        // POR ÚLTIMO: agrupa imagens+vídeos/embeds no masonry do post, DEPOIS de redgifs/spoilers/reveal materializarem a mídia (não move o placeholder do redgifs antes do autoload clicar)
        if (FEATURES.autoFullImages) safe(buildPostGalleries, roots);
        if (FEATURES.sidebarNavigation) safe(setupPostNavigation);
        if (FEATURES.autoSearchTitleOnly) safe(enableSearchTitlesOnly);
        safe(buildSearchResultsPanel);   // página de resultados da busca: input + filtros inline no header (1×, guard interno)
        if (FEATURES.keyboardShortcuts) safe(setupKeyboardShortcuts);

        safe(markThreadGridContainer, roots);
        safe(markCategoryNodeBlocks, roots);   // classe estática no lugar do .block--category:has(.node)
        if (FEATURES.thumbPlaceholders) safe(markGridPlaceholders, roots);
        safe(styleArticleCards);   // article view: monta o .smg-article-grid ANTES do infinite scroll
        if (FEATURES.infiniteScroll) safe(setupInfiniteScroll);
        if (cls.contains('smg-home') && !cls.contains('smg-watched-feed')) {   // as passes de home SÓ rodam com smg-home (pula thread/lista) — e NÃO no modo feed (a home está escondida; rodar o remake só ressuscitaria nós escondidos)
            safe(markHomeAdBlocks);   // classe estática no lugar do :has() de bloco-de-anúncio
            safe(relocateSimpcityNodes);
            safe(mergeSmallHomeSections);
            safe(expandSubForums);
            safe(relocateSmgNodes);
            safe(splitTransSection);
            safe(sortHomeCards);
            safe(reorderHomeSections);
            safe(makeHomeCardsClickable);
            safe(layoutHomeSidebar);
        }
        safe(buildFilterBars);       // barra única segmentada nos 2 sites (substitui o .block-outer nativo)
        safe(buildThreadHeader);     // .p-body-header da thread: ações (feed/galeria/download) + tira autor/data
        safe(buildPostCards, roots); // posts → card estilo Reddit (header + conteúdo + action bar); escopado, 1×/post
        safe(buildCommentCards, roots); // comentários (uw_fcs/SMG) → mesmo modelo, indentados; escopado, 1×/comentário
        safe(buildCommentBar, roots);   // header dos comentários: label "Sort:" + "Previous comments" → "Load more"
        safe(restoreNavMode);        // F5 com ?view=gallery|feed (+ ?order=) → reabre o modo (1x)
        if (FEATURES.bookmarksFeed) safe(setupBookmarksFeed);   // /account/bookmarks: toggle Lista↔Feed (posts salvos como river)
        if (FEATURES.hoverPreview) safe(setupThumbPreview);
        safe(setupSourceWatermark);  // marca dágua da fonte no hover de cada mídia (1× bound)

        if (FEATURES.topBar) safe(buildTopbar);
        if (FEATURES.headerNotices) safe(setupHeaderNotices);   // avisos da página recolhidos num iconezinho
        safe(watchNativeBadges);   // mantém os badges (alertas) da topbar/dock em sincronia com o XF, ao vivo

        // reaplica o filtro de autor em posts recém-carregados (scroll infinito)
        if (authorFilter) safe(applyAuthorFilter);
    }

    // O observer dispara em QUALQUER mutação do DOM. Como o próprio processAll
    // muta o DOM, sem coalescer ele se re-dispara num flood de microtasks que
    // não cede pro render e trava a aba. Solução: no máximo 1 execução por frame.
    // Coleta os subtrees ADICIONADOS → os passes de conteúdo varrem só eles (scope), não o documento
    // inteiro a cada frame. A cada FULL_SCAN_EVERY runs (ou quando não houve adição) faz 1 full-scan de
    // segurança — pega nós que o scope não enxergou (ex.: match por atributo que mudou depois).
    let scheduled = false, dirtyRoots = new Set(), runCount = 0, fullPending = false, fullT = 0;
    const FULL_SCAN_EVERY = 20;   // PERF: full-scan (todos os passes no body inteiro) a cada 20 runs em vez de 10 — os passes escopados já pegam tudo que é ADICIONADO; o full-scan é só backstop p/ match por atributo (raro), então 20 frames de atraso é imperceptível e corta o custo pela metade

    function scheduleRun(mutations) {
        if (mutations) for (const m of mutations) for (const n of m.addedNodes) if (n.nodeType === 1) dirtyRoots.add(n);
        if (scheduled) return;
        scheduled = true;

        requestAnimationFrame(() => {
            scheduled = false;
            const full = (++runCount % FULL_SCAN_EVERY === 0) || fullPending;
            // frame SEM nó adicionado (remoção pura — spinner/freeze do feed — ou troca de text node):
            // não há nada novo pra processar; o full-scan imediato aqui varria o body INTEIRO a cada
            // tick (ex.: scroll no feed congelando cards = vários full-scans/s). Backstop preservado:
            // agenda UM full-scan coalescido (máx 1 a cada ~600ms) p/ os casos raros de match por atributo.
            if (!full && !dirtyRoots.size) {
                if (!fullT) fullT = setTimeout(() => { fullT = 0; fullPending = true; scheduleRun(); }, 600);
                return;
            }
            fullPending = false;
            const roots = full ? [document.body] : [...dirtyRoots];
            dirtyRoots = new Set();
            processAll(roots);
        });
    }

    if (smgDisabled) return;   // kill-switch: não injeta CSS nem roda nada

    const cls = document.documentElement.classList;

    // detecta as classes de página (smg-home/thread/threadlist/tv-grid). Roda 2x: cedo (URL+
    // data-template, no document-start) e de novo no DOM-ready (aí o .structItem--thread já existe).
    function detectPageClasses() {
        const tpl = document.documentElement.getAttribute('data-template') || '';
        const path = location.pathname;
        if (tpl === 'forum_list') { cls.add('smg-home-page'); if (FEATURES.homeRemake) cls.add('smg-home'); }  // smg-home (remake) gated; smg-home-page sempre (marcador)
        if (tpl === 'thread_view' || /\/threads\//.test(path)) cls.add('smg-thread');
        const isList = !!document.querySelector('.structItem--thread')
            || /\/whats-new(\/|$)/i.test(path) || /\/forums\/[^/]+/i.test(path)   // qualquer página de fórum (mesmo só com sub-fóruns)
            || tpl === 'search_results' || tpl === 'forum_view';
        if (isList) cls.add('smg-threadlist');
        if (tpl === 'search_results') cls.add('smg-search-page');   // página de resultados: painel inline + lista re-tematizada (CSS)
        if (tpl === 'search_form') cls.add('smg-search-form');      // form de busca avançada: re-tematizado (CSS; widgets do XF intactos)
        if (cls.contains('smg-threadlist') && gmGet('smg-threadview', 'grid') === 'grid') cls.add('smg-tv-grid');
        // página com menu lateral legítimo (conta/settings) → flag estática p/ o CSS (substitui o
        // :not(:has(.p-body-sideNav)) ancorado no .p-body-main, que re-validava a cada mutação da thread)
        if (/^account/i.test(tpl) || document.querySelector('.p-body-sideNav')) cls.add('smg-has-sidenav');
    }

    // ===== FASE 1 (document-start): tematiza ANTES da 1ª pintura → mata o flash do site antigo =====
    cls.add(/socialmediagirls/i.test(location.hostname) ? 'smg-smg' : 'smg-sc');  // site
    if (feedViewWanted()) cls.add('smg-watched-feed');   // feed ligado (home ?view=feed) → CSS esconde o conteúdo nativo JÁ, sem flash (smg-watched-feed = "feed on")
    if (FEATURES.autoFullImages) cls.add('smg-masonry-on');   // "Galeria" (full-res + masonry por post) — masonry atrelado à galeria
    if (FEATURES.unwrapLinks) { bindProxyClick(); handleRedirectPage(); }   // liga o intercept de clique JÁ no document-start (antes do XF) + pula página de aviso
    detectPageClasses();                                  // 1ª passada (o que dá pra saber sem o DOM)
    injectStyles();                                       // CSS já vale enquanto o HTML é parseado
    if (FEATURES.topBar) cls.add('smg-topbar-on');        // esconde o header nativo já (reserva o espaço)

    // DEEP-LINK (notificação/permalink → #post-X): ao cair fundo na thread, o conteúdo ACIMA (imagens/embeds/masonry)
    // carrega depois e EMPURRAVA pra baixo o post que você está vendo (ele era o último a assentar). Aqui:
    //   (1) processa o post-alvo PRIMEIRO → a mídia dele monta antes do scan completo do body;
    //   (2) scroll-anchor MANUAL: a cada reflow contra-rola a diferença (ANTES do paint, via ResizeObserver) pra ele
    //       ficar PARADO. Embeds já são lazy (turboIO), então o de cima nem baixa vídeo.
    //   JANELA ADAPTATIVA: segura enquanto AINDA HOUVER reflow (thread pesada assenta devagar — fixo 6s soltava no meio),
    //       2s sem nenhum mexido → solta; teto absoluto 30s. SOLTA na 1ª rolagem REAL do usuário (wheel/seta/PageUp-Down/
    //       Home-End/Space ou touchMOVE) — NÃO num toque solto (touchstart sozinho desancorava no mobile a cada tap).
    function pinDeepLinkPost() {
        const h = (location.hash || '').replace(/^#/, '');
        if (!h || !/^(?:js-)?(?:post|comment|post-comment)-\d+$/.test(h)) return;
        const el = document.getElementById(h) || document.querySelector('[data-content="' + h.replace(/^js-/, '') + '"]');
        const target = el && (el.closest('article.message, .message--post, .comment, .message-responseRow') || el);
        if (!target) return;
        safe(processAll, [target]);   // a mídia do post VISÍVEL monta antes do scan completo
        if (typeof ResizeObserver === 'undefined') return;
        let done = false, iv = 0, idle = 0, cap = 0, want = 0;
        const RELEASE = ['wheel', 'touchmove', 'keydown'];
        const SCROLL_KEYS = { ArrowUp: 1, ArrowDown: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1, ' ': 1, Spacebar: 1 };
        const stop = () => { if (done) return; done = true; ro.disconnect(); if (iv) clearInterval(iv); if (idle) clearTimeout(idle); if (cap) clearTimeout(cap); RELEASE.forEach(ev => window.removeEventListener(ev, onUser)); };
        const bump = () => { if (done) return; if (idle) clearTimeout(idle); idle = setTimeout(stop, 2000); };   // renova a janela a cada reflow; 2s parado → solta
        const keep = () => { if (done || !target.isConnected) return; const d = target.getBoundingClientRect().top - want; if (d > 0.5 || d < -0.5) { window.scrollBy(0, d); bump(); } };   // reflow ACIMA moveu o alvo → contra-rola + renova
        const onUser = e => { if (e.type === 'keydown' && !SCROLL_KEYS[e.key]) return; stop(); };   // só gesto de ROLAGEM solta (tecla normal/tap não)
        const ro = new ResizeObserver(keep);
        try { target.scrollIntoView(); } catch (e) {}   // posiciona via scroll-margin-top (abaixo da topbar)
        want = target.getBoundingClientRect().top;       // âncora = posição logo após o scroll
        ro.observe(document.body);
        iv = setInterval(keep, 100);
        cap = setTimeout(stop, 30000);                    // teto absoluto
        bump();                                           // arma a janela ociosa (solta sozinho se nada reflow em 2s)
        RELEASE.forEach(ev => window.addEventListener(ev, onUser, { passive: true }));
        window.addEventListener('load', keep, { once: true });
    }
    // ===== FASE 2 (DOM pronto): re-detecta (DOM) + monta os componentes (topbar/dock/filter bar) =====
    function boot() {
        safe(handleCrossSiteSearch);   // chegou com #smg-xsearch (botão "abrir no outro fórum")? roda a busca e já navega pro resultado
        if (FEATURES.unwrapLinks) handleRedirectPage();   // página de aviso do simp (precisa do DOM p/ achar o .simpLinkProxy-targetLink)
        detectPageClasses();   // agora o DOM existe (.structItem--thread dos fóruns do SMG, etc.)
        if (FEATURES.topBar && !document.querySelector('.p-nav')) cls.remove('smg-topbar-on');  // sem nav → restaura header
        if (feedContext()) safe(setupFeedView);   // home: monta o river se ?view=feed; o observer abaixo embeda a mídia do conteúdo injetado
        safe(pinDeepLinkPost);   // deep-link (#post-X): processa o alvo + segura ele no lugar ANTES do scan completo empurrar tudo
        processAll([document.body]);
        new MutationObserver(scheduleRun).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();
