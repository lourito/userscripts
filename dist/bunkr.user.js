// ==UserScript==
// @name         Bunkr — player grande estilo YouTube
// @namespace    bunkr-youtube-player
// @version      2.5.2
// @updateURL    https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/bunkr.user.js
// @downloadURL  https://raw.githubusercontent.com/claudiogepeto/userscripts/main/dist/bunkr.user.js
// @description  Camada visual sobre as páginas de arquivo do Bunkr (vídeo · foto · galeria), aproximando do YouTube. (1) PLAYER GRANDE: tira o cap de 1000px e usa o maior 16:9 que cabe na largura E na altura da viewport (theater), centralizado/arredondado. (2) Player, título e header na MESMA coluna → o título alinha com o vídeo (flush-left). (3) Topbar menor e simples: logo → balbums.st, à direita só Status + Upload (sem Albums/FAQ/tema/menu-mobile). (4) Respiro maior no rodapé. @include por regex (o TLD do Bunkr muda toda hora). v2.0 (port das melhorias do pixeldrain): PLAYER PRÓPRIO estilo YouTube (play central, scrubber arrastável c/ buffer, volume flyout, tempo, velocidade 0.25→5x, ±5s, tela cheia, atalhos de teclado) SUBSTITUINDO o Plyr — lê o mp4 assinado que o Bunkr expõe e toca num <video> próprio (com fallback: se não achar o src, deixa o Plyr). FOTO: zoom em níveis (1x→2x→4x no clique) + DRAG pra navegar (transform/clamp, sem scroll). MIRROR: o botão ganha spinner de "testando" enquanto o probe sonda o domínio atual. v2.1: a página de arquivo (vídeo/imagem) vira um STAGE estilo pixeldrain — overlay fixed cobrindo a página com (a) VROW de info no topo (Galeria/nome/tamanho/tipo + Download/Copiar/Tela cheia/Mirror/Report), (b) a mídia FIXA no meio (player/imagem), (c) STRIP collapsável no rodapé com os outros arquivos do álbum (clonados do #related-files-grid, cada thumb linka pro /f/ → navegação) + ◀▶ pra rolar. O Plyr/engine de anúncio continuam vivos ATRÁS do overlay (não removo, só cubro). v2.2: força o tema .dark do bunkr (+observer p/ não cair no claro) e escurece a página de GALERIA/álbum pra AMOLED. v2.3: o álbum força a "Advanced View" do bunkr (redirect ?advanced=1 = TODOS os arquivos sem paginador), esconde os 2 toggles (advanced view/filters) + o paginador, e tira o filtro do collapse → busca fica SEMPRE na página (redesenhada); álbum usa quase toda a largura (mais colunas). E a bottombar de álbum (pixeldrain E bunkr) some quando o item é avulso (0 outros arquivos). v2.3.1: remove a msg "Advanced mode" + a toolbar vazia + a dica do Shift, e TIRA o outline do painel → busca/filtros direto na página, espaçamento ajustado. v2.4: a strip do vídeo agora mostra o ÁLBUM INTEIRO (fetch /a/{id}?advanced=1 → extrai window.albumFiles, cache em sessionStorage) em vez dos poucos do #related-files-grid; FILTRO de texto estilo pixeldrain — persiste no ?q= (espelha a busca nativa do álbum), filtra a strip do vídeo, marca+centraliza o atual, e se propaga no clique (todo /f/ leva o ?q= adiante). Navegação ainda é por página (reload), mas o álbum vem do cache. v2.4.1: item atual SELECIONADO na strip + setas ◀▶ sobre a mídia (navega no álbum filtrado, wrap, leva o ?q=). v2.5 (EARLY PAINT/perf): placeholder PRETO via CSS `html.bunkr-file::before` no document-start cobre a interface nativa (Plyr/ads/header) na hora — não pisca; o stage cobre por cima e monta JÁ no DOMContentLoaded (1º tick imediato, sem esperar 400ms); poll só continua se a mídia não montou no 1º tick (não-mídia: ~6.4s → fallback remove placeholder+stage e mostra a página nativa).
// @author       claudiogepeto
// @match        *://bunkr.cr/*
// @match        *://*.bunkr.cr/*
// @match        *://bunkr.ph/*
// @match        *://*.bunkr.ph/*
// @match        *://bunkr.ru/*
// @match        *://*.bunkr.ru/*
// @match        *://bunkr.si/*
// @match        *://*.bunkr.si/*
// @match        *://bunkr.fi/*
// @match        *://*.bunkr.fi/*
// @match        *://bunkr.ws/*
// @match        *://*.bunkr.ws/*
// @match        *://bunkr.ax/*
// @match        *://*.bunkr.ax/*
// @match        *://bunkr.black/*
// @match        *://*.bunkr.black/*
// @match        *://bunkr.media/*
// @match        *://*.bunkr.media/*
// @match        *://bunkr.site/*
// @match        *://*.bunkr.site/*
// @match        *://bunkr.pk/*
// @match        *://*.bunkr.pk/*
// @match        *://bunkr.la/*
// @match        *://*.bunkr.la/*
// @match        *://bunkr.su/*
// @match        *://*.bunkr.su/*
// @match        *://bunkr.ci/*
// @match        *://*.bunkr.ci/*
// @match        *://bunkr.is/*
// @match        *://*.bunkr.is/*
// @match        *://bunkrr.su/*
// @match        *://*.bunkrr.su/*
// @noframes
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==
(function () {
    "use strict";

    if (window.top !== window.self) return;   // ignora iframes (players/embeds)

    // ÁLBUM: força a "Advanced View" do bunkr (carrega TODOS os arquivos de uma vez, SEM paginador). Redireciona 1× se ainda não estiver nela (guard evita loop).
    if (/\/a\//.test(location.pathname) && !/[?&]advanced=1\b/.test(location.search)) {
        location.replace(location.pathname + (location.search ? location.search + "&" : "?") + "advanced=1" + location.hash);
        return;
    }

    // tipo de página pela URL (já no document-start → sem flash): /a/ = ÁLBUM (grade larga); resto = ARQUIVO (vídeo/foto)
    document.documentElement.classList.add(/\/a\//.test(location.pathname) ? "bunkr-album" : "bunkr-file");

    // força o tema ESCURO do bunkr (.dark) e MANTÉM forçado — a página pode vir no claro / o JS do bunkr re-aplica o tema
    (function () {
        const c = document.documentElement.classList;
        const forceDark = () => { if (!c.contains("dark") || c.contains("light")) { c.add("dark"); c.remove("light"); } };   // idempotente → o observer converge (não loopa)
        forceDark();
        try { new MutationObserver(forceDark).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); } catch {}
    })();

    /* ====================================================================
     * FILOSOFIA — só ESTILO + um reorder/limpeza leve do header. NÃO toco na
     * engine do Bunkr (o Plyr é montado por id #video-wrapper → continua intacto)
     * nem nos scripts de anúncio/anti-adblock (WASM) → não quebra a página.
     * ==================================================================== */

    const COL = "min(100% - 32px, 1800px, calc((100vh - 120px) * 16 / 9))";   // coluna = maior 16:9 que cabe (mais larga; sobra p/ topbar+gap)

    const CSS = `
        /* ===== COLUNA COMPARTILHADA: player + título (info) na MESMA largura/posição → alinhados ===== */
        html.bunkr-file main.cont,
        .rounded-lg section > div.mx-auto,
        .rounded-lg section > div[class*="max-w"],
        .rounded-lg section > div:has(#video-container) {
            max-width: ${COL} !important;
            max-height: none !important;
            margin-left: auto !important;
            margin-right: auto !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
        }
        /* ÁLBUM: conteúdo LARGO e ALINHADO com a topbar (mesma largura 1800) + respiro maior pra topbar */
        html.bunkr-album main.cont { max-width: min(100% - 24px, 2560px) !important; padding-top: 28px !important; margin-left: auto !important; margin-right: auto !important; }   /* v2.3: usa quase toda a largura (mais colunas no grid) */
        /* header alinhado (mesmo cap) */
        header .cont { max-width: min(100% - 24px, 2560px) !important; margin-inline: auto !important; }
        #video-container { max-width: 100% !important; }

        /* ===== PLAYER: enche a coluna, 16:9, arredondado (sem o cap de 1000px nem o height:100% do tema) ===== */
        #video-wrapper .plyr,
        #video-wrapper .plyr--video,
        #video-container .plyr {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            border-radius: 14px;
            overflow: hidden;
        }
        .plyr__video-wrapper, .plyr__video-wrapper--fixed-ratio { aspect-ratio: 16 / 9 !important; max-height: none !important; }
        #loading-background { max-height: none !important; }

        /* ===== PÁGINA DE FOTO — imagem grande/centralizada ===== */
        .rounded-lg img:not(.grid-images_box-img) {
            display: block;
            max-width: 100% !important;
            max-height: calc(100vh - 120px);
            width: auto;
            margin-inline: auto;
            border-radius: 14px;
        }
        /* (grade de arquivos estilizada lá embaixo, vale pro álbum E a section "More files") */

        /* ===== TÍTULO/INFO = barra de título do YouTube, flush-left (escondo o círculo de tipo) ===== */
        main.cont { padding-top: 16px !important; }
        main span.icon.w-12, main .flex.items-center.gap-3 > span.icon { display: none !important; }
        main h1 { font-size: 1.35rem !important; line-height: 1.3 !important; }
        @media (min-width: 768px) { main h1 { font-size: 1.6rem !important; } }

        /* ===== TOPBAR: ALTURA FIXA pequena (o problema era o min-h-16 dos FILHOS esticando a barra) ===== */
        header .cont { padding-top: 4px !important; padding-bottom: 4px !important; }
        header .cont > .flex.items-center { min-height: 44px !important; height: auto !important; align-items: center !important; gap: 14px !important; }
        /* zera as alturas-mínimas grandes (min-h-16, py-4, btn-lg…) de TODO filho do header → nada estica a barra */
        header .cont > .flex.items-center :where(figure, a, button, nav, ul, li, span, .btn) { min-height: 0 !important; }
        header figure { padding: 0 !important; }
        header figure img { width: 30px !important; height: auto !important; }
        /* nav: Status + Upload à DIREITA, compacto */
        header #menu-box { justify-content: flex-end !important; gap: 10px !important; align-items: center !important; }
        header #menu-box ul { gap: 8px !important; margin: 0 !important; padding: 0 !important; flex-direction: row !important; }
        header #menu-box ul a.btn { padding: 7px !important; border-radius: 10px !important; }
        header #menu-box ul a.btn [class*="ic-"] { font-size: 19px !important; }
        header #menu-box > a.btn-seco-outline { padding: 6px 16px !important; font-size: 14px !important; }

        /* ===== SEARCH: UM input nativo e único (a master.css do Bunkr estilizava o input → caixa separada/torta) ===== */
        header .cont > .flex.items-center > figure { flex: 0 0 auto !important; }
        header #menu-box { flex: 0 0 auto !important; }
        input.bunkr-search {
            flex: 0 1 640px !important; min-width: 0 !important; margin: 0 auto !important; align-self: center !important;
            height: 40px !important; box-sizing: border-box !important; padding: 0 18px 0 42px !important;
            border-radius: 999px !important; border: 1px solid rgba(255,255,255,0.14) !important;
            background-color: rgba(255,255,255,0.07) !important;
            background-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%23a3a3ad'%20stroke-width='2.2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Ccircle%20cx='11'%20cy='11'%20r='7'/%3E%3Cpath%20d='m21%2021-4.3-4.3'/%3E%3C/svg%3E") !important;
            background-repeat: no-repeat !important; background-position: 16px center !important; background-size: 17px 17px !important;
            color: #fff !important; font-size: 14.5px !important; line-height: normal !important; box-shadow: none !important;
            outline: none !important; -webkit-appearance: none !important; appearance: none !important;
        }
        input.bunkr-search::placeholder { color: rgba(255,255,255,0.45) !important; }
        input.bunkr-search:focus { background-color: rgba(255,255,255,0.11) !important; border-color: rgba(255,255,255,0.34) !important; }
        @media (max-width: 600px) { input.bunkr-search { display: none !important; } }

        /* ===== ESPAÇAMENTO: player↔título PEQUENO (YouTube); respiro só no fim ===== */
        .rounded-lg section > div.mx-auto { padding-top: 6px !important; padding-bottom: 6px !important; }   /* era py-8 (32px) → gap enorme até o título */
        .bunkr-player-block { margin-top: 18px !important; padding-bottom: 0 !important; }                    /* respiro ABAIXO da topbar + zera o respiro que caía entre player e título (pós-reorder) */
        main.cont { padding-top: 12px !important; padding-bottom: 64px !important; }                          /* título colado no player + respiro no fim da página */
        body { padding-bottom: 40px !important; }
        footer { padding-top: 28px !important; }

        /* ===== banner VERMELHO de troca de domínio → fora (fallback; o JS remove de fato) ===== */
        body > div[style*="red"] { display: none !important; }

        /* ===== BOTÃO DE MIRROR (canto sup-direito do player) — VISÍVEL SÓ NO HOVER do player (igual controles do YT) ===== */
        .bunkr-mirror { position: absolute; top: 12px; right: 12px; z-index: 50; font-family: Inter, system-ui, sans-serif; opacity: 0; pointer-events: none; transition: opacity .18s ease; }
        .bunkr-has-mirror:hover .bunkr-mirror, .bunkr-mirror.is-open { opacity: 1; pointer-events: auto; }   /* hover do player OU menu aberto */
        .bunkr-mirror-btn { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 14px; border: 1px solid rgba(255,255,255,0.2); border-radius: 11px; background: rgba(14,14,19,0.8); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); box-shadow: 0 4px 16px rgba(0,0,0,0.42); transition: background .14s ease, border-color .14s ease, color .14s ease; }
        .bunkr-mirror-btn svg { width: 16px; height: 16px; }
        .bunkr-mirror-btn:hover, .bunkr-mirror.is-open .bunkr-mirror-btn { background: #a78bfa; border-color: #a78bfa; color: #160f24; }
        /* DROPDOWN em GRID 2-colunas (compacto, em vez da lista alta) */
        .bunkr-mirror-menu { position: absolute; top: calc(100% + 8px); right: 0; width: 300px; max-width: 78vw; max-height: 60vh; overflow-y: auto; padding: 10px; border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; background: rgba(18,19,24,0.97); box-shadow: 0 18px 46px rgba(0,0,0,0.62); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
        .bunkr-mirror-menu[hidden] { display: none; }
        .bunkr-mirror-head { padding: 2px 4px 9px; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: rgba(255,255,255,0.45); }
        .bunkr-mirror-head b { color: #a78bfa; font-weight: 700; }
        .bunkr-mirror-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
        .bunkr-mirror-item { display: flex; align-items: center; justify-content: center; padding: 10px 8px; border-radius: 10px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.86); font-size: 12.5px; font-weight: 600; text-decoration: none; white-space: nowrap; transition: background .12s ease, color .12s ease; }
        .bunkr-mirror-item:hover { background: #a78bfa; color: #160f24; }
        .bunkr-mirror-item.is-current { background: rgba(167,139,250,0.18); color: #a78bfa; cursor: default; }
        .bunkr-mirror-item.is-current:hover { background: rgba(167,139,250,0.18); color: #a78bfa; }

        /* ===== aviso "mirror pode estar fora" (overlay no topo do player, após o teste falhar) ===== */
        .bunkr-mirror-warn { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); z-index: 55; display: flex; align-items: center; gap: 14px; max-width: calc(100% - 24px); padding: 10px 16px; border-radius: 12px; background: rgba(176,32,32,0.94); color: #fff; font: 600 13.5px/1.3 Inter, system-ui, sans-serif; box-shadow: 0 12px 34px rgba(0,0,0,0.55); }
        .bunkr-mirror-warn span { font-weight: 400; opacity: .85; }
        .bunkr-mirror-warn-btn { flex: 0 0 auto; padding: 7px 12px; border-radius: 9px; background: #fff; color: #b02020; font-weight: 700; text-decoration: none; white-space: nowrap; }
        .bunkr-mirror-warn-btn:hover { filter: brightness(0.94); }
        .bunkr-mirror-warn-x { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 8px; background: rgba(255,255,255,0.16); color: #fff; cursor: pointer; transition: background .12s ease; }
        .bunkr-mirror-warn-x:hover { background: rgba(255,255,255,0.3); }
        .bunkr-mirror-warn-x svg { width: 16px; height: 16px; }

        /* ===== GRADE DE ARQUIVOS — vale pro ÁLBUM e pra section "More files in this album" do fim do ARQUIVO ===== */
        .grid-images, #galleryGrid, #related-files-grid { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)) !important; gap: 18px !important; }
        .theItem { border-radius: 14px !important; border-color: rgba(255,255,255,0.08) !important; background: rgba(255,255,255,0.025) !important; padding: 10px !important; transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease; }
        .theItem:hover { transform: translateY(-3px); border-color: rgba(167,139,250,0.55) !important; box-shadow: 0 16px 38px rgba(0,0,0,0.5); }
        .grid-images_box-img { aspect-ratio: 16 / 9 !important; height: auto !important; width: 100% !important; object-fit: cover !important; border-radius: 10px; }
        .theItem .theName { font-size: 13.5px !important; }
        html.bunkr-album .album-toolbar, html.bunkr-album .album-adv { margin-left: 0 !important; margin-right: 0 !important; }
        /* heading "More files…" + botão Load More (cards no fim do arquivo) */
        .files-album { font-size: 1.2rem !important; margin: 6px 0 14px !important; }
        #load-more-btn, .ld-more { display: block !important; width: 100% !important; margin: 22px 0 0 !important; padding: 13px !important; border-radius: 12px !important; border: 1px solid rgba(167,139,250,0.5) !important; background: rgba(167,139,250,0.08) !important; color: #c9b8ff !important; font-weight: 700 !important; transition: background .14s ease, color .14s ease; }
        #load-more-btn:hover, .ld-more:hover { background: rgba(167,139,250,0.18) !important; color: #fff !important; }
        /* a section "More files" do ARQUIVO alinha com a coluna do player/título + respiro */
        html.bunkr-file .cont:has(#related-files-grid) { max-width: ${COL} !important; margin-left: auto !important; margin-right: auto !important; padding-top: 8px !important; }

        /* ===== v2.0 — NOSSO PLAYER (porta do pixeldrain/xenforo, accent roxo) substitui o Plyr ===== */
        :root { --bunkr-accent: #a78bfa; }
        .bunkr-host { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: 14px; overflow: hidden; }
        .bunkr-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #000; outline: none; cursor: pointer; display: block; }
        .bunkr-plc-flash { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity .2s ease; }
        .bunkr-pl:not(.is-playing):not(.is-buffering) .bunkr-plc-flash { opacity: 1; }
        .bunkr-plc-flash button { border: 0; border-radius: 50%; cursor: pointer; padding: 0; background: rgba(0,0,0,.55); color: #fff; display: flex; align-items: center; justify-content: center; transition: transform .12s ease, background .12s ease; pointer-events: none; }
        .bunkr-plc-flash button:hover { transform: scale(1.08); background: rgba(0,0,0,.72); }
        .bunkr-pl:not(.is-playing) .bunkr-plc-flash button { pointer-events: auto; }
        .bunkr-plc-play { width: 64px; height: 64px; } .bunkr-plc-play svg { width: 30px; height: 30px; display: block; margin-left: 3px; }
        @media (max-width: 600px) { .bunkr-plc-play { width: 54px; height: 54px; } .bunkr-plc-play svg { width: 26px; height: 26px; } }
        .bunkr-plc-bottom { position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; padding: 8px 6px 3px; background: linear-gradient(to top, rgba(0,0,0,.8) 0%, rgba(0,0,0,.3) 62%, transparent 100%); opacity: 0; pointer-events: none; transition: opacity .18s ease; }
        .bunkr-pl:hover .bunkr-plc-bottom, .bunkr-pl:not(.is-playing) .bunkr-plc-bottom { opacity: 1; pointer-events: auto; }
        @media (hover: none) { .bunkr-plc-bottom { opacity: 1; pointer-events: auto; } }
        .bunkr-plc-prog { position: relative; width: 100%; height: 14px; display: flex; align-items: center; cursor: pointer; touch-action: none; }
        .bunkr-plc-bar { position: relative; width: 100%; height: 3px; background: rgba(255,255,255,.28); border-radius: 3px; transition: height .1s ease; }
        .bunkr-plc-prog:hover .bunkr-plc-bar { height: 5px; }
        .bunkr-plc-buf { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: rgba(255,255,255,.30); border-radius: 3px; pointer-events: none; }
        .bunkr-plc-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: var(--bunkr-accent, #a78bfa); border-radius: 3px; pointer-events: none; }
        .bunkr-plc-knob { position: absolute; right: -6px; top: 50%; width: 12px; height: 12px; border-radius: 50%; background: var(--bunkr-accent, #a78bfa); transform: translateY(-50%) scale(0); transition: transform .1s ease; }
        .bunkr-plc-prog:hover .bunkr-plc-knob { transform: translateY(-50%) scale(1); }
        .bunkr-plc-row { display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 1px 4px 2px; }
        .bunkr-plc-left, .bunkr-plc-right { display: flex; align-items: center; gap: 1px; }
        .bunkr-plc-act { width: 40px; height: 40px; border: 0; border-radius: 50%; cursor: pointer; padding: 0; background: transparent; color: #fff; opacity: .92; display: flex; align-items: center; justify-content: center; transition: opacity .1s ease, transform .1s ease; }
        .bunkr-plc-act:hover { opacity: 1; } .bunkr-plc-act:active { transform: scale(.86); }
        .bunkr-plc-act svg { width: 24px; height: 24px; display: block; filter: drop-shadow(0 0 1px rgba(0,0,0,.45)); }
        .bunkr-pl .bunkr-plc-act svg { fill: none; } .bunkr-pl .bunkr-plc-play svg, .bunkr-pl .bunkr-plc-barplay svg { fill: currentColor; }
        .bunkr-plc-vol { display: flex; align-items: center; }
        .bunkr-plc-volbar { position: relative; width: 0; height: 4px; border-radius: 3px; background: rgba(255,255,255,.35); cursor: pointer; opacity: 0; transition: width .18s ease, opacity .18s ease, margin .18s ease; touch-action: none; }
        .bunkr-plc-vol:hover .bunkr-plc-volbar { width: 60px; opacity: 1; margin: 0 6px 0 2px; }
        .bunkr-plc-volfill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: #fff; border-radius: 3px; pointer-events: none; }
        .bunkr-plc-time { color: #fff; font: 600 12px/1 Inter, system-ui, sans-serif; font-variant-numeric: tabular-nums; padding: 0 6px; white-space: nowrap; flex: 0 0 auto; }
        @media (max-width: 600px) { .bunkr-plc-act { width: 30px; height: 30px; } .bunkr-plc-act svg { width: 19px; height: 19px; } .bunkr-plc-time { font-size: 11px; padding: 0 4px; } }
        .bunkr-plc-seekflash { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); z-index: 3; color: #fff; font: 700 15px/1 Inter, system-ui, sans-serif; background: rgba(0,0,0,.55); padding: 9px 15px; border-radius: 999px; opacity: 0; transition: opacity .15s ease; pointer-events: none; white-space: nowrap; }
        .bunkr-plc-seekflash.on { opacity: 1; }
        .bunkr-pl.is-buffering::after { content: ""; position: absolute; top: 50%; left: 50%; width: 42px; height: 42px; margin: -21px 0 0 -21px; border-radius: 50%; border: 3px solid rgba(255,255,255,.22); border-top-color: rgba(255,255,255,.9); animation: bunkr-spin .8s linear infinite; z-index: 4; pointer-events: none; }
        @keyframes bunkr-spin { to { transform: rotate(360deg); } }
        .bunkr-plc-speed { width: auto; min-width: 40px; padding: 0 10px; color: #fff; font: 800 13px/1 Inter, system-ui, sans-serif; font-variant-numeric: tabular-nums; }
        .bunkr-plc-skip { position: relative; }
        .bunkr-plc-skip .bunkr-plc-skipn { position: absolute; left: 0; right: 0; top: 53%; transform: translateY(-50%); text-align: center; font: 800 8.5px/1 Inter, system-ui, sans-serif; color: #fff; pointer-events: none; text-shadow: 0 0 2px rgba(0,0,0,.5); }
        .bunkr-plc-speedwrap { position: relative; display: flex; align-items: center; }
        .bunkr-plc-speedmenu { position: absolute; bottom: calc(100% + 8px); right: 0; z-index: 5; display: none; flex-direction: column; gap: 2px; padding: 6px; max-height: 240px; overflow: auto; background: rgba(18,19,24,.97); border: 1px solid rgba(255,255,255,.12); border-radius: 9px; box-shadow: 0 8px 24px rgba(0,0,0,.55); }
        .bunkr-plc-speedmenu.open { display: flex; }
        .bunkr-plc-speeditem { border: 0; background: transparent; color: #fff; font: 600 13px/1 Inter, system-ui, sans-serif; padding: 7px 16px; border-radius: 6px; cursor: pointer; text-align: right; white-space: nowrap; }
        .bunkr-plc-speeditem:hover { background: rgba(255,255,255,.12); }
        .bunkr-plc-speeditem.on { color: var(--bunkr-accent, #a78bfa); font-weight: 800; }

        /* ===== v2.0 — FOTO: zoom em níveis (1x→2x→4x) + drag pan (só a imagem é transformada; host clipa) ===== */
        .bunkr-img-host { position: relative; display: block; width: -moz-fit-content; width: fit-content; max-width: 100%; margin-inline: auto; overflow: hidden; border-radius: 14px; }
        .bunkr-image { display: block; max-width: 100%; max-height: calc(100vh - 120px); width: auto; height: auto; background: #000; cursor: zoom-in; user-select: none; -webkit-user-drag: none; transform-origin: center center; will-change: transform; touch-action: none; }
        .bunkr-img-host.is-zoomed .bunkr-image { cursor: grab; }
        .bunkr-img-host.is-zoomed .bunkr-image:active { cursor: grabbing; }

        /* ===== v2.0 — spinner de "testando" no botão de mirror ===== */
        .bunkr-mirror.is-testing { opacity: 1 !important; pointer-events: auto !important; }
        .bunkr-mirror-spin { display: none; width: 15px; height: 15px; flex: 0 0 auto; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); border-top-color: var(--bunkr-accent, #a78bfa); animation: bunkr-spin .7s linear infinite; }
        .bunkr-mirror.is-testing .bunkr-mirror-btn svg { display: none; }
        .bunkr-mirror.is-testing .bunkr-mirror-spin { display: inline-block; }

        /* ===== v2.1 — STAGE estilo pixeldrain (página de vídeo/imagem): topbar info + mídia FIXA + strip collapsável do álbum ===== */
        html.bunkr-has-stage, html.bunkr-has-stage body { overflow: hidden !important; }
        /* EARLY PAINT: placeholder PRETO já no document-start (CSS puro, sem JS) cobre a interface NATIVA enquanto o stage não montou → não pisca o Plyr/ads/header. O stage (z-index 99000) cobre por cima; no fallback (bunkr-fallback) some e a página nativa aparece. */
        html.bunkr-file::before { content: ""; position: fixed; inset: 0; background: #0b0c0f; z-index: 98000; pointer-events: none; }
        html.bunkr-file.bunkr-fallback::before { display: none; }
        .bunkr-stage { position: fixed; inset: 0; z-index: 99000; display: flex; flex-direction: column; background: #0b0c0f; color: #fff; font-family: Inter, system-ui, sans-serif; }
        .bunkr-stage * { box-sizing: border-box; }
        .bunkr-stage-mid { position: relative; flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 10px 12px; overflow: hidden; }
        .bunkr-stage.is-video .bunkr-stage-mid > .bunkr-host { width: 100%; height: 100%; aspect-ratio: auto; border-radius: 12px; }
        .bunkr-stage-mid > .bunkr-img-host { max-height: 100%; margin: 0; }
        .bunkr-stage-mid > .bunkr-img-host > .bunkr-image { max-height: calc(100dvh - 150px); }

        /* vrow (topbar info) */
        .bunkr-vrow { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #0e0f13; border-bottom: 1px solid rgba(255,255,255,.08); overflow-x: auto; overflow-y: hidden; white-space: nowrap; scrollbar-width: thin; }
        .bunkr-vrow::-webkit-scrollbar { height: 6px; } .bunkr-vrow::-webkit-scrollbar-thumb { background: #a78bfa55; border-radius: 4px; }
        .bunkr-vrow .b-name { flex: 0 1 auto; min-width: 60px; max-width: 34vw; display: inline-flex; align-items: center; gap: 8px; padding: 0 4px; font-weight: 600; }
        .bunkr-vrow .b-name svg { color: var(--bunkr-accent, #a78bfa); flex: 0 0 auto; }
        .bunkr-vrow .b-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bunkr-stats { display: flex; align-items: center; gap: 14px; padding: 0 8px; flex: 0 0 auto; }
        .bunkr-stat { font-size: 12px; color: rgba(255,255,255,.62); font-weight: 600; }
        .b-spacer { flex: 1 1 auto; min-width: 8px; }
        .bunkr-item { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; padding: 7px 11px; border: 1px solid rgba(255,255,255,.1); border-radius: 9px; background: rgba(255,255,255,.05); color: #fff; font: 13px/1 Inter, system-ui, sans-serif; cursor: pointer; text-decoration: none; transition: background .12s, border-color .12s; }
        .bunkr-item:hover { background: rgba(255,255,255,.1); border-color: #a78bfa66; }
        .bunkr-item svg { width: 18px; height: 18px; color: var(--bunkr-accent, #a78bfa); }
        .bunkr-item.b-primary { background: var(--bunkr-accent, #a78bfa); border-color: var(--bunkr-accent, #a78bfa); color: #160f24; font-weight: 700; }
        .bunkr-item.b-primary svg { color: #160f24; } .bunkr-item.b-primary:hover { filter: brightness(1.07); }
        .bunkr-item.b-info { cursor: default; } .bunkr-item.b-info:hover { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); }
        .b-vsep { flex: 0 0 auto; width: 1px; height: 22px; margin: 0 3px; background: rgba(255,255,255,.1); }

        /* mirror inline (no vrow) + dropdown de domínios */
        .bunkr-mirror-vrow { position: relative; flex: 0 0 auto; }
        .bunkr-mirror-vrow.is-testing .bunkr-item svg { display: none; }
        .bunkr-mirror-vrow.is-testing .bunkr-mirror-spin { display: inline-block; }
        .bunkr-mirror-vrow .bunkr-mirror-menu { position: fixed; z-index: 100002; }   /* fixed → não é cortado pelo overflow da vrow; left/top calculados no JS */

        /* strip (bottombar collapsável) */
        .bunkr-stripwrap { flex: 0 0 auto; display: flex; flex-direction: column; background: #0e0f13; border-top: 1px solid rgba(255,255,255,.08); }
        .bunkr-stripbar { display: flex; align-items: center; gap: 8px; padding: 5px 10px; }
        .b-striplabel { font-size: 12px; font-weight: 600; color: rgba(255,255,255,.55); white-space: nowrap; }
        .b-sbtn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 28px; padding: 0; flex: 0 0 auto; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; background: rgba(255,255,255,.05); color: #fff; cursor: pointer; transition: background .12s, border-color .12s; }
        .b-sbtn:hover { background: rgba(255,255,255,.1); border-color: #a78bfa66; } .b-sbtn svg { width: 18px; height: 18px; color: var(--bunkr-accent, #a78bfa); }
        .bunkr-stripwrap.is-collapsed .bunkr-strip { display: none; }
        .bunkr-stripwrap.is-collapsed .b-collapse svg { transform: rotate(180deg); }
        .bunkr-strip { display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; padding: 4px 10px 10px; scrollbar-width: none; }
        .bunkr-strip::-webkit-scrollbar { display: none; height: 0; }
        .bunkr-strip-item { flex: 0 0 auto; width: 150px; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,.08); border-radius: 9px; overflow: hidden; background: rgba(255,255,255,.03); color: #fff; text-decoration: none; transition: border-color .12s, transform .12s; }
        .bunkr-strip-item:hover { border-color: #a78bfa88; transform: translateY(-2px); }
        .bunkr-strip-item.is-current { border-color: var(--bunkr-accent, #a78bfa) !important; box-shadow: 0 0 0 2px var(--bunkr-accent, #a78bfa), 0 0 14px -2px var(--bunkr-accent, #a78bfa); }
        .bunkr-strip-item.is-current .bunkr-strip-name { color: #fff; font-weight: 700; }
        /* setas prev/próxima mídia sobre o vídeo/imagem (aparecem no hover; só quando há +1 no álbum filtrado) */
        .bunkr-nav-side { position: absolute; top: 50%; transform: translateY(-50%); z-index: 6; width: 46px; height: 46px; border: 0; border-radius: 50%; background: rgba(0,0,0,.5); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity .18s ease, background .12s ease; }
        .bunkr-nav-prev { left: 16px; } .bunkr-nav-next { right: 16px; }
        .bunkr-stage.has-nav .bunkr-stage-mid:hover .bunkr-nav-side { opacity: 1; pointer-events: auto; }
        @media (hover: none) { .bunkr-stage.has-nav .bunkr-nav-side { opacity: .85; pointer-events: auto; } }
        .bunkr-nav-side:hover { background: rgba(0,0,0,.74); } .bunkr-nav-side:active { transform: translateY(-50%) scale(.92); }
        .bunkr-nav-side svg { width: 26px; height: 26px; display: block; }
        .bunkr-strip-thumb { width: 100%; height: 84px; object-fit: cover; background: #000; display: block; }
        .bunkr-strip-meta { display: flex; align-items: center; gap: 5px; padding: 6px 7px; }
        .bunkr-strip-meta svg { width: 13px; height: 13px; flex: 0 0 auto; color: var(--bunkr-accent, #a78bfa); }
        .bunkr-strip-name { font-size: 11px; line-height: 1.25; color: rgba(255,255,255,.82); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
        @media (max-width: 600px) { .bunkr-strip-item { width: 116px; } .bunkr-strip-thumb { height: 66px; } .bunkr-vrow .b-name { max-width: 50vw; } }

        /* ===== v2.2 — GALERIA (álbum) DARK: ativa o tema .dark do bunkr + AMOLED do stage + alinha a toolbar (override do <style> inline por especificidade html.bunkr-album .x) ===== */
        html.dark { --color-body: 11 12 15; --color-fore: 14 15 19; --color-mute: 16 18 23; --color-soft: 22 24 30; --color-line: 34 38 48; --color-main: 167 139 250; --color-lead: 255 255 255; --color-subs: 226 226 232; }
        html.bunkr-album, html.bunkr-album body { background: #0b0c0f !important; }
        html.bunkr-album header { background: #0e0f13 !important; border-bottom: 1px solid rgba(255,255,255,.08) !important; }
        html.bunkr-album main h1 { color: #fff !important; }
        html.bunkr-album .ic-albums { background: rgba(167,139,250,.14) !important; color: #a78bfa !important; }
        html.bunkr-album .visitors, html.bunkr-album .text-xs { color: rgba(255,255,255,.62) !important; }
        html.bunkr-album .pagination a, html.bunkr-album .pagination span { background: #14161a !important; border-color: rgba(167,139,250,.3) !important; color: #cbbaf5 !important; }
        html.bunkr-album .pagination .active, html.bunkr-album .pagination a:hover { background: #a78bfa !important; color: #160f24 !important; }
        html.bunkr-album .album-adv .filter-input { background: #14161a !important; color: #fff !important; border-color: rgba(167,139,250,.3) !important; }
        html.bunkr-album .floating-detailed-thumb { background: #0e0f13 !important; border-color: rgba(167,139,250,.3) !important; }

        /* ===== v2.3 — só ADVANCED VIEW: mata toggles + paginador + toolbar vazia + a msg "Advanced mode"; busca/filtros SEM outline, direto na página ===== */
        html.bunkr-album .mode-toggle-btn, html.bunkr-album #advToggle, html.bunkr-album .adv-btn, html.bunkr-album .pagination,
        html.bunkr-album .album-toolbar, html.bunkr-album .advanced-notice { display: none !important; }
        html.bunkr-album .album-adv { display: block !important; background: transparent !important; border: 0 !important; border-radius: 0 !important; padding: 0 !important; margin: 4px 0 16px !important; }   /* SEM box/outline */
        html.bunkr-album .album-adv > div:not(.row) { display: none !important; }   /* dica "hold Shift…" fora */
        html.bunkr-album .album-adv .row { gap: 10px !important; align-items: center !important; }
        html.bunkr-album .album-adv .input-wrap { flex: 1 1 640px !important; }
        html.bunkr-album .album-adv .actions { display: flex !important; gap: 8px !important; flex-wrap: wrap !important; }
        html.bunkr-album .album-adv .filter-input { height: 2.85rem !important; border-radius: 12px !important; background: #14161a !important; border: 1px solid rgba(167,139,250,.3) !important; color: #fff !important; font-size: 15px !important; padding-left: 2.6rem !important; }
        html.bunkr-album .album-adv .filter-input:focus { border-color: #a78bfa !important; box-shadow: 0 0 0 3px rgba(167,139,250,.16) !important; }
        html.bunkr-album .album-adv .btn { height: 2.85rem !important; border-radius: 12px !important; background: #14161a !important; border: 1px solid rgba(167,139,250,.3) !important; color: #cbbaf5 !important; }
        html.bunkr-album .album-adv .btn:hover { background: rgba(167,139,250,.16) !important; border-color: #a78bfa !important; color: #fff !important; }

        /* toast (feedback de copiar etc.) — acima do stage */
        .bunkr-toast { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%) translateY(12px); z-index: 100001; padding: 10px 18px; border-radius: 20px; background: #14161a; border: 1px solid #a78bfa66; color: #fff; font: 13px Inter, system-ui, sans-serif; box-shadow: 0 6px 22px rgba(0,0,0,.6); opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s; }
        .bunkr-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    `;

    function addCSS(css) {
        if (typeof GM_addStyle === "function") { GM_addStyle(css); return; }
        const s = document.createElement("style"); s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    }
    addCSS(CSS);   // document-start → sem flash do layout antigo

    /* ====================================================================
     * v2.0 — PORT do pixeldrain: PLAYER PRÓPRIO (substitui o Plyr), ZOOM+PAN na
     * foto, e LOADING no botão de mirror. Helpers + ícones + builders abaixo.
     * ==================================================================== */
    const PREFS_KEY = "bunkr_prefs";
    const prefs = Object.assign({ volume: 1, muted: false, rate: 1 },
        (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } })());
    let saveT; const saveP = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {} }, 250); };
    function el(tag, props, ...kids) {
        const n = document.createElement(tag);
        if (props) for (const [k, v] of Object.entries(props)) {
            if (v == null) continue;
            if (k === "class") n.className = v;
            else if (k === "html") n.innerHTML = v;
            else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
            else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
            else n.setAttribute(k, v);
        }
        for (const kid of kids) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
        return n;
    }
    const svgi = inner => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block">${inner}</svg>`;
    const PL_ICONS = {
        play: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="display:block"><path d="M7 4.5v15a1 1 0 0 0 1.52.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="display:block"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
        volume: svgi('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>'),
        mute: svgi('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'),
        expand: svgi('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
        download: svgi('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
        skipBack: svgi('<path d="M3 2v6h6"/><path d="M21 12A9 9 0 0 0 6 5.3L3 8"/>'),
        skipFwd: svgi('<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>'),
        chevL: svgi('<path d="m15 18-6-6 6-6"/>'),
        chevR: svgi('<path d="m9 18 6-6-6-6"/>'),
        chevDown: svgi('<path d="m6 9 6 6 6-6"/>'),
        grid: svgi('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
        image: svgi('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
        video: svgi('<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4V8z"/>'),
        copy: svgi('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
        flag: svgi('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'),
        dns: svgi('<rect x="2" y="3" width="20" height="6" rx="1"/><rect x="2" y="15" width="20" height="6" rx="1"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>'),
    };
    const fmtT = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; const p = n => String(n).padStart(2, "0"); return h ? h + ":" + p(m) + ":" + p(ss) : m + ":" + p(ss); };

    /* controles estilo YouTube (port fiel do pixeldrain buildPlayerControls) */
    function buildPlayerControls(wrap, video, src, ac) {
        const on = (e, ev, fn) => e.addEventListener(ev, fn, ac ? { signal: ac.signal } : undefined);
        const mkAct = (ic, label, cb) => { const b = el("button", { type: "button", class: "bunkr-plc-act", title: label, "aria-label": label }); b.innerHTML = ic; b.addEventListener("click", cb); return b; };
        const toggle = () => { if (!video.paused) { video.pause(); return; } const p = video.play(); if (p && p.catch) p.catch(() => {}); };
        const sflash = el("div", { class: "bunkr-plc-seekflash" }); let sft;
        const seek = d => { if (!video.duration) return; video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + d)); sflash.textContent = d < 0 ? "« 5s" : "5s »"; sflash.classList.add("on"); clearTimeout(sft); sft = setTimeout(() => sflash.classList.remove("on"), 480); };
        let clickT = null;
        on(video, "click", e => { e.preventDefault(); e.stopPropagation(); if (clickT) return; clickT = setTimeout(() => { clickT = null; toggle(); }, 230); });
        on(video, "dblclick", e => { e.preventDefault(); e.stopPropagation(); if (clickT) { clearTimeout(clickT); clickT = null; } const r = video.getBoundingClientRect(); seek((e.clientX - r.left) < r.width / 2 ? -5 : 5); });
        const playBtn = el("button", { type: "button", class: "bunkr-plc-play", "aria-label": "Play/Pause" }); playBtn.innerHTML = PL_ICONS.play;
        playBtn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); toggle(); });
        const flash = el("div", { class: "bunkr-plc-flash" }, playBtn);
        const buf = el("div", { class: "bunkr-plc-buf" });
        const knob = el("div", { class: "bunkr-plc-knob" });
        const fill = el("div", { class: "bunkr-plc-fill" }, knob);
        const bar = el("div", { class: "bunkr-plc-bar" }, buf, fill);
        const prog = el("div", { class: "bunkr-plc-prog" }, bar);
        const seekTo = (cx, r) => { if (!video.duration || !r.width) return; video.currentTime = Math.max(0, Math.min(1, (cx - r.left) / r.width)) * video.duration; };
        prog.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); const r = bar.getBoundingClientRect(); seekTo(e.clientX, r); const mv = ev => seekTo(ev.clientX, r); const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); }; document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); });
        const tEl = el("span", { class: "bunkr-plc-time" }, "0:00");
        const syncTime = () => { const s = fmtT(video.currentTime) + (video.duration ? " / " + fmtT(video.duration) : ""); if (tEl.firstChild.data !== s) tEl.firstChild.data = s; };
        on(video, "timeupdate", () => { if (video.duration) fill.style.width = (video.currentTime / video.duration * 100) + "%"; syncTime(); });
        on(video, "loadedmetadata", syncTime);
        on(video, "progress", () => { try { if (video.buffered.length && video.duration) buf.style.width = (video.buffered.end(video.buffered.length - 1) / video.duration * 100) + "%"; } catch {} });
        const mute = mkAct(PL_ICONS.mute, "Mudo (m)", e => { e.stopPropagation(); video.muted = !video.muted; if (!video.muted && !video.volume) video.volume = 1; syncVol(); });
        const volfill = el("div", { class: "bunkr-plc-volfill" });
        const volbar = el("div", { class: "bunkr-plc-volbar", role: "slider", "aria-label": "Volume" }, volfill);
        const syncVol = () => { mute.innerHTML = (video.muted || !video.volume) ? PL_ICONS.mute : PL_ICONS.volume; volfill.style.width = ((video.muted ? 0 : video.volume) * 100) + "%"; };
        const setVolX = (cx, r) => { if (!r.width) return; const v = Math.max(0, Math.min(1, (cx - r.left) / r.width)); video.volume = v; video.muted = (v === 0); syncVol(); };
        volbar.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); const r = volbar.getBoundingClientRect(); setVolX(e.clientX, r); const mv = ev => setVolX(ev.clientX, r); const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); }; document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); });
        const volgrp = el("div", { class: "bunkr-plc-vol" }, mute, volbar);
        const goFs = () => { try { document.fullscreenElement ? document.exitFullscreen() : wrap.requestFullscreen(); } catch {} };
        const dlb = mkAct(PL_ICONS.download, "Baixar", e => { e.stopPropagation(); window.open(src, "_blank"); });
        const fsb = mkAct(PL_ICONS.expand, "Tela cheia (f)", e => { e.stopPropagation(); goFs(); });
        const barPlay = mkAct(PL_ICONS.play, "Play/Pause (espaço)", e => { e.stopPropagation(); toggle(); }); barPlay.classList.add("bunkr-plc-barplay");
        const mkSkip = (ic, label, cb) => { const b = el("button", { type: "button", class: "bunkr-plc-act bunkr-plc-skip", title: label, "aria-label": label }); b.innerHTML = ic; b.appendChild(el("span", { class: "bunkr-plc-skipn" }, "5")); b.addEventListener("click", cb); return b; };
        const skipBack = mkSkip(PL_ICONS.skipBack, "Voltar 5s (←)", e => { e.stopPropagation(); seek(-5); });
        const skipFwd = mkSkip(PL_ICONS.skipFwd, "Avançar 5s (→)", e => { e.stopPropagation(); seek(5); });
        const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
        const speedMenu = el("div", { class: "bunkr-plc-speedmenu" });
        const speedBtn = el("button", { type: "button", class: "bunkr-plc-act bunkr-plc-speed", title: "Velocidade", "aria-label": "Velocidade" }, "1x");
        const speedWrap = el("div", { class: "bunkr-plc-speedwrap" }, speedMenu, speedBtn);
        let speedCloser = null;
        const closeSpeed = () => { speedMenu.classList.remove("open"); if (speedCloser) { document.removeEventListener("pointerdown", speedCloser, true); speedCloser = null; } };
        const openSpeed = () => { speedMenu.classList.add("open"); speedCloser = ev => { if (!speedWrap.contains(ev.target)) closeSpeed(); }; document.addEventListener("pointerdown", speedCloser, true); };
        RATES.forEach(r => { const it = el("button", { type: "button", class: "bunkr-plc-speeditem" }, r + "x"); it.dataset.r = r; it.addEventListener("click", e => { e.stopPropagation(); try { video.playbackRate = r; } catch {} closeSpeed(); }); speedMenu.appendChild(it); });
        speedBtn.addEventListener("click", e => { e.stopPropagation(); speedMenu.classList.contains("open") ? closeSpeed() : openSpeed(); });
        const syncSpeed = () => { const r = video.playbackRate; speedBtn.textContent = r + "x"; speedMenu.querySelectorAll(".bunkr-plc-speeditem").forEach(it => it.classList.toggle("on", +it.dataset.r === r)); };
        on(video, "ratechange", () => { prefs.rate = video.playbackRate; saveP(); syncSpeed(); });
        on(video, "loadedmetadata", () => { try { video.playbackRate = prefs.rate || 1; } catch {} });
        const leftc = el("div", { class: "bunkr-plc-left" }, barPlay, skipBack, skipFwd, volgrp, tEl);
        const rightc = el("div", { class: "bunkr-plc-right" }, speedWrap, dlb, fsb);
        const row = el("div", { class: "bunkr-plc-row" }, leftc, rightc);
        const bottom = el("div", { class: "bunkr-plc-bottom" }, prog, row);
        on(video, "play", () => { wrap.classList.add("is-playing"); playBtn.innerHTML = PL_ICONS.pause; barPlay.innerHTML = PL_ICONS.pause; });
        on(video, "pause", () => { wrap.classList.remove("is-playing"); playBtn.innerHTML = PL_ICONS.play; barPlay.innerHTML = PL_ICONS.play; });
        on(video, "volumechange", syncVol);
        on(video, "seeking", () => wrap.classList.add("is-buffering"));
        ["seeked", "canplay", "playing", "loadeddata", "pause", "suspend", "error", "abort"].forEach(ev => on(video, ev, () => wrap.classList.remove("is-buffering")));
        const setRate = dir => { const i = RATES.indexOf(video.playbackRate); const ni = Math.max(0, Math.min(RATES.length - 1, (i < 0 ? 3 : i) + dir)); try { video.playbackRate = RATES[ni]; } catch {} };
        const onKey = e => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
            const k = e.key; let h = true;
            if (k === " " || k === "k") toggle();
            else if (k === "ArrowLeft") seek(-5);
            else if (k === "ArrowRight") seek(5);
            else if (k === "j") seek(-10);
            else if (k === "l") seek(10);
            else if (k === "ArrowUp") { video.muted = false; video.volume = Math.min(1, video.volume + 0.05); }
            else if (k === "ArrowDown") video.volume = Math.max(0, video.volume - 0.05);
            else if (k === "m") { video.muted = !video.muted; if (!video.muted && !video.volume) video.volume = 1; }
            else if (k === "f") goFs();
            else if (k === "<") setRate(-1);
            else if (k === ">") setRate(1);
            else if (k >= "0" && k <= "9" && video.duration) video.currentTime = video.duration * (+k) / 10;
            else h = false;
            if (h) { e.preventDefault(); e.stopPropagation(); }
        };
        if (ac) document.addEventListener("keydown", onKey, { capture: true, signal: ac.signal });
        wrap.append(flash, sflash, bottom);
        try { video.playbackRate = prefs.rate || 1; } catch {}
        syncVol(); syncTime(); syncSpeed();
    }

    /* substitui o Plyr pelo nosso player (lê o mp4 assinado que o Bunkr expõe; fallback: sem src, mantém o Plyr) */
    function getSrc() { const e = document.querySelector("#video-wrapper video source[src], #player source[src], #video-wrapper video[src], #player[src], #video-wrapper source[src]"); return (e && (e.getAttribute("src") || e.src)) || ""; }
    let playerMounted = false, mediaMounted = false;
    function mountOwnPlayer() {
        if (playerMounted) return;
        const mid = document.querySelector(".bunkr-stage.is-video > .bunkr-stage-mid");
        if (!mid) return;                              // stage ainda não montado
        const src = getSrc();
        if (!src) return;                              // Plyr ainda não expôs o src (async) → tenta de novo no poll
        playerMounted = true; mediaMounted = true;
        const plyrV = document.querySelector("#video-wrapper video, #player");
        if (plyrV) { try { plyrV.pause(); plyrV.muted = true; } catch {} }   // mata o áudio do Plyr (engine vivo, atrás do stage)
        const ac = new AbortController();
        const video = el("video", { class: "bunkr-video", playsinline: "", preload: "metadata" });
        video.volume = prefs.volume; video.muted = prefs.muted;
        video.addEventListener("volumechange", () => { prefs.volume = video.volume; prefs.muted = video.muted; saveP(); }, { signal: ac.signal });
        video.addEventListener("error", () => suggestMirror("erro ao reproduzir"), { once: true });
        const host = el("div", { class: "bunkr-host bunkr-pl" }, video);
        buildPlayerControls(host, video, src, ac);
        mid.appendChild(host);
        video.src = src; try { video.load(); } catch {}
    }

    /* foto: zoom em níveis (1x→2x→4x no clique) + drag pan (só a <img> é transformada; host clipa) */
    let zoomMounted = false;
    function mountPhotoZoom() {
        if (zoomMounted) return;
        const mid = document.querySelector(".bunkr-stage.is-image > .bunkr-stage-mid");
        if (!mid) return;                              // stage de imagem ainda não montado
        const img = document.querySelector(".rounded-lg img:not(.grid-images_box-img)");
        if (!img) return;
        zoomMounted = true; mediaMounted = true;
        const host = el("div", { class: "bunkr-img-host" });
        mid.appendChild(host);
        img.classList.add("bunkr-image");
        host.appendChild(img);                         // MOVE a <img> da página pro stage
        const ZOOMS = [1, 2, 4]; let zi = 0, z = 1, tx = 0, ty = 0;
        const clampPan = () => { const mx = Math.max(0, (img.clientWidth * z - host.clientWidth) / 2), my = Math.max(0, (img.clientHeight * z - host.clientHeight) / 2); tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty)); };
        const applyTf = () => { img.style.transform = z === 1 ? "" : `translate(${tx}px,${ty}px) scale(${z})`; host.classList.toggle("is-zoomed", z !== 1); };
        const setZoomIdx = i => { zi = ((i % ZOOMS.length) + ZOOMS.length) % ZOOMS.length; z = ZOOMS[zi]; if (z === 1) { tx = ty = 0; } else clampPan(); applyTf(); };
        let drag = null;
        img.addEventListener("pointerdown", e => { if (e.button) return; e.preventDefault(); drag = { x: e.clientX, y: e.clientY, tx, ty, moved: false }; try { img.setPointerCapture(e.pointerId); } catch {} });
        img.addEventListener("pointermove", e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true; if (z !== 1 && drag.moved) { tx = drag.tx + dx; ty = drag.ty + dy; clampPan(); applyTf(); } });
        const end = e => { if (!drag) return; const click = !drag.moved; drag = null; try { img.releasePointerCapture(e.pointerId); } catch {} if (click) setZoomIdx(zi + 1); };   // clique sem arrasto = próximo nível
        img.addEventListener("pointerup", end); img.addEventListener("pointercancel", end);
    }

    function setMirrorTesting(on) { document.querySelectorAll(".bunkr-mirror, .bunkr-mirror-vrow").forEach(w => w.classList.toggle("is-testing", !!on)); }   // spinner "testando" no(s) botão(ões) de mirror

    let toastT;
    function toast(msg) {
        let t = document.querySelector(".bunkr-toast");
        if (!t) { t = el("div", { class: "bunkr-toast" }); (document.body || document.documentElement).appendChild(t); }
        t.textContent = msg; t.classList.add("show");
        clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800);
    }
    function fallbackCopy(s) { try { const t = el("textarea", { style: { position: "fixed", opacity: "0", left: "-9999px" } }); t.value = s; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; } catch { return false; } }
    function copyText(s) {   // clipboard API (assíncrono) com fallback p/ execCommand; resolve booleano de sucesso
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s).then(() => true, () => fallbackCopy(s));
        return Promise.resolve(fallbackCopy(s));
    }

    /* ====================================================================
     * v2.1 — STAGE estilo pixeldrain p/ página de vídeo/imagem: vrow (info) +
     * mídia FIXA no meio + strip collapsável dos outros arquivos do álbum.
     * ==================================================================== */
    // mirror inline no vrow (mesmo dropdown de domínios, agora como botão da topbar)
    function buildMirrorControl() {
        const cur = location.hostname.replace(/^www\./, "");
        const wrap = el("div", { class: "bunkr-mirror-vrow" });
        const btn = el("button", { type: "button", class: "bunkr-item", title: "Trocar de mirror (domínio)" }, el("span", { class: "bunkr-mirror-spin", "aria-hidden": "true" }));
        btn.insertAdjacentHTML("beforeend", PL_ICONS.dns); btn.append(el("span", null, "Mirror"));
        const menu = el("div", { class: "bunkr-mirror-menu", hidden: "" });
        menu.innerHTML = '<div class="bunkr-mirror-head">Trocar de mirror · <b>' + cur + '</b></div><div class="bunkr-mirror-grid"></div>';
        const grid = menu.querySelector(".bunkr-mirror-grid");
        MIRRORS.forEach(d => {
            const a = el("a", { class: "bunkr-mirror-item" + (d === cur ? " is-current" : "") }, d);
            if (d === cur) a.addEventListener("click", e => e.preventDefault());
            else a.href = location.protocol + "//" + d + location.pathname + location.search;
            grid.appendChild(a);
        });
        const setOpen = open => {   // menu em position:FIXED → calcula a posição no open (a vrow tem overflow:hidden, absolute era CORTADO)
            menu.hidden = !open;
            if (!open) return;
            const r = btn.getBoundingClientRect(), w = menu.offsetWidth || 300;
            menu.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + "px";
            const mh = menu.offsetHeight;
            menu.style.top = ((r.bottom + 8 + mh > window.innerHeight) ? Math.max(8, r.top - 8 - mh) : r.bottom + 8) + "px";
        };
        btn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); setOpen(menu.hidden); });
        document.addEventListener("click", e => { if (!wrap.contains(e.target)) setOpen(false); });
        wrap.append(btn, menu);
        return wrap;
    }
    // monta o stage 1× (precisa do <main h1> server-rendered). Cobre a página (fixed) como o pixeldrain.
    function buildStage() {
        const existing = document.querySelector(".bunkr-stage");
        if (existing) return existing;
        const h1 = document.querySelector("main h1");
        if (!h1) return null;                          // main ainda não pronto
        const name = (h1.textContent || "").trim();
        const sizeEl = document.querySelector("main p.text-xs");
        const size = sizeEl ? (sizeEl.textContent || "").replace(/\s+/g, " ").trim() : "";
        const dlA = document.querySelector('main a[href*="/file/"]') || document.querySelector('a[href*="dl.bunkr"]');
        const reportA = document.querySelector('main a[href*="abuse"]');
        const albumA = document.querySelector('a[href*="/a/"]');
        const isVid = !!document.querySelector("#video-container, #video-wrapper");

        const stage = el("div", { class: "bunkr-stage " + (isVid ? "is-video" : "is-image") });
        const vrow = el("div", { class: "bunkr-vrow" });
        if (albumA) { const b = el("a", { class: "bunkr-item", href: albumA.href, title: "Voltar pra galeria" }); b.insertAdjacentHTML("beforeend", PL_ICONS.grid); b.append(el("span", null, "Galeria")); vrow.append(b, el("div", { class: "b-vsep" })); }
        const nameEl = el("div", { class: "b-name", title: name }); nameEl.insertAdjacentHTML("beforeend", isVid ? PL_ICONS.video : PL_ICONS.image); nameEl.append(el("span", null, name)); vrow.append(nameEl);
        const stats = el("div", { class: "bunkr-stats" });
        if (size) stats.append(el("span", { class: "bunkr-stat" }, size));
        stats.append(el("span", { class: "bunkr-stat" }, isVid ? "Vídeo" : "Imagem"));
        vrow.append(stats, el("div", { class: "b-spacer" }));
        if (dlA) { const b = el("a", { class: "bunkr-item b-primary", href: dlA.href, download: name, rel: "noopener", title: "Baixar (download direto)" }); b.insertAdjacentHTML("beforeend", PL_ICONS.download); b.append(el("span", null, "Download")); vrow.append(b); }   // SEM target=_blank + download attr → o dl.bunkr.cr/file/{id} (attachment) baixa direto, sem abrir aba
        const copyBtn = el("button", { class: "bunkr-item", title: "Copiar link desta página", onClick: () => copyText(location.href).then(ok => toast(ok ? "Link copiado" : "Falha ao copiar")) }); copyBtn.insertAdjacentHTML("beforeend", PL_ICONS.copy); copyBtn.append(el("span", null, "Copiar")); vrow.append(copyBtn);
        const fsBtn = el("button", { class: "bunkr-item", title: "Tela cheia", onClick: () => { try { document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen(); } catch {} } }); fsBtn.insertAdjacentHTML("beforeend", PL_ICONS.expand); vrow.append(fsBtn);
        vrow.append(el("div", { class: "b-vsep" }), buildMirrorControl());
        if (reportA) { const b = el("a", { class: "bunkr-item", href: reportA.href, title: "Reportar" }); b.insertAdjacentHTML("beforeend", PL_ICONS.flag); vrow.append(b); }

        const mid = el("div", { class: "bunkr-stage-mid" });
        const navPrev = el("button", { class: "bunkr-nav-side bunkr-nav-prev", title: "Anterior no álbum", "aria-label": "Anterior", onClick: e => { e.stopPropagation(); navFile(-1); } }); navPrev.insertAdjacentHTML("beforeend", PL_ICONS.chevL);
        const navNext = el("button", { class: "bunkr-nav-side bunkr-nav-next", title: "Próximo no álbum", "aria-label": "Próximo", onClick: e => { e.stopPropagation(); navFile(1); } }); navNext.insertAdjacentHTML("beforeend", PL_ICONS.chevR);
        mid.append(navPrev, navNext);   // a mídia (host/img) é anexada depois; as setas ficam absolutas por cima (z-index)
        const stripwrap = el("div", { class: "bunkr-stripwrap" });
        const strip = el("div", { class: "bunkr-strip" });
        if (localStorage.getItem("bunkr_strip_collapsed") === "1") stripwrap.classList.add("is-collapsed");
        const collapseBtn = el("button", { class: "b-sbtn b-collapse", title: "Recolher / expandir a tira", onClick: () => { stripwrap.classList.toggle("is-collapsed"); try { localStorage.setItem("bunkr_strip_collapsed", stripwrap.classList.contains("is-collapsed") ? "1" : "0"); } catch {} } }); collapseBtn.insertAdjacentHTML("beforeend", PL_ICONS.chevDown);
        const prevBtn = el("button", { class: "b-sbtn", title: "Rolar p/ trás", onClick: () => strip.scrollBy({ left: -strip.clientWidth * 0.8, behavior: "smooth" }) }); prevBtn.insertAdjacentHTML("beforeend", PL_ICONS.chevL);
        const nextBtn = el("button", { class: "b-sbtn", title: "Rolar p/ frente", onClick: () => strip.scrollBy({ left: strip.clientWidth * 0.8, behavior: "smooth" }) }); nextBtn.insertAdjacentHTML("beforeend", PL_ICONS.chevR);
        stripwrap.append(el("div", { class: "bunkr-stripbar" }, collapseBtn, el("span", { class: "b-striplabel" }, "Arquivos do álbum"), el("div", { class: "b-spacer" }), prevBtn, nextBtn), strip);
        stage._strip = strip;
        stage.append(vrow, mid, stripwrap);
        document.body.insertBefore(stage, document.body.firstChild);
        document.documentElement.classList.add("bunkr-has-stage");
        populateStrip(strip);   // related-grid agora (fallback rápido) + busca o álbum INTEIRO (async) e re-renderiza a strip completa
        const grid = document.querySelector("#related-files-grid");
        if (grid) { try { new MutationObserver(() => renderRelated(strip)).observe(grid, { childList: true }); } catch {} }
        return stage;
    }
    /* ---- FILTRO via ?q= (igual pixeldrain): persiste na URL, filtra a galeria do álbum E a strip do vídeo, e se propaga no clique ---- */
    function getQ() { try { return (new URLSearchParams(location.search).get("q") || "").trim(); } catch { return ""; } }
    function setQ(q) { try { const u = new URL(location.href); if (q) u.searchParams.set("q", q); else u.searchParams.delete("q"); history.replaceState(history.state, "", u.pathname + u.search + u.hash); } catch {} }
    function fileSlug() { return (location.pathname.match(/\/f\/([^/?#]+)/) || [])[1] || ""; }
    function isVidFile(f) { return /video/i.test((f.extension || "") + " " + (f.type || "")); }

    /* a página de ARQUIVO só tem o #related-files-grid (poucos). Pra strip INTEIRA: fetch /a/{id}?advanced=1 → extrai window.albumFiles (array literal da própria bunkr). Cache em sessionStorage por álbum (navegação fica rápida). */
    let albumFilesCache = null;
    async function loadAlbumFiles() {
        if (albumFilesCache) return albumFilesCache;
        const a = document.querySelector('a[href*="/a/"]'); if (!a) return null;
        const id = (a.href.match(/\/a\/([A-Za-z0-9]+)/) || [])[1]; if (!id) return null;
        const ck = "bunkr_album_" + id;
        try { const c = sessionStorage.getItem(ck); if (c) { albumFilesCache = JSON.parse(c); return albumFilesCache; } } catch {}
        try {
            const base = a.href.split("#")[0].split("?")[0];
            const html = await (await fetch(base + "?advanced=1", { credentials: "include" })).text();
            const m = html.match(/window\.albumFiles\s*=\s*(\[[\s\S]*?\n\]);/);   // âncora no \n]; (fim do array) — os NOMES contêm ] (ex.: [uuid]), então não dá pra parar no 1º ]
            if (!m) return null;
            const files = (new Function("return " + m[1]))();   // eval do array literal da PRÓPRIA bunkr (mesmo trust da página; só os dados, não os scripts dela)
            if (!Array.isArray(files) || !files.length) return null;
            const slim = files.map(f => ({ slug: f.slug, original: f.original || f.name || "", thumbnail: f.thumbnail || "", extension: f.extension || "", type: f.type || "" }));
            albumFilesCache = slim; try { sessionStorage.setItem(ck, JSON.stringify(slim)); } catch {}
            return slim;
        } catch { return null; }
    }

    function stripCard(name, href, thumb, isV, current) {
        const card = el("a", { class: "bunkr-strip-item" + (current ? " is-current" : ""), href, title: name });
        card.append(el("img", { class: "bunkr-strip-thumb", src: thumb || "", alt: "", loading: "lazy" }));
        const meta = el("div", { class: "bunkr-strip-meta" }); meta.insertAdjacentHTML("beforeend", isV ? PL_ICONS.video : PL_ICONS.image); meta.append(el("span", { class: "bunkr-strip-name" }, name));
        card.append(meta); return card;
    }
    let stripFull = false;
    /* strip COMPLETA do álbum buscado (filtrada por ?q=; item atual marcado + centralizado; cada link leva o ?q= adiante) */
    function renderStrip(strip, files) {
        if (!strip || !files) return;
        const q = getQ().toLowerCase(), cur = fileSlug();
        strip.textContent = ""; let curBtn = null;
        files.forEach(f => {
            const name = (f.original || "").trim();
            if (q && name.toLowerCase().indexOf(q) === -1) return;
            const href = "/f/" + f.slug + (getQ() ? "?q=" + encodeURIComponent(getQ()) : "");
            const card = stripCard(name, href, f.thumbnail, isVidFile(f), f.slug === cur);
            strip.appendChild(card);
            if (f.slug === cur) curBtn = card;
        });
        const wrap = strip.closest(".bunkr-stripwrap"); if (wrap) wrap.style.display = strip.children.length ? "" : "none";
        const stage = strip.closest(".bunkr-stage"); if (stage) stage.classList.toggle("has-nav", strip.children.length > 1);   // só mostra as setas se há +1 no álbum (filtrado)
        if (curBtn) setTimeout(() => { try { const br = curBtn.getBoundingClientRect(), sr = strip.getBoundingClientRect(); strip.scrollBy({ left: (br.left + br.width / 2) - (sr.left + sr.width / 2), behavior: "smooth" }); } catch {} }, 80);
    }
    /* fallback rápido enquanto o álbum não baixou: a partir do #related-files-grid (poucos), também filtrado por ?q= */
    function renderRelated(strip) {
        if (!strip || stripFull) return;
        const grid = document.querySelector("#related-files-grid");
        const items = grid ? Array.from(grid.querySelectorAll(":scope > .theItem")) : [];
        const wrap = strip.closest(".bunkr-stripwrap"); if (wrap && !items.length) wrap.style.display = "none";
        const sig = items.length + "|" + getQ();
        if (strip.dataset.sig === sig) return; strip.dataset.sig = sig;
        const q = getQ().toLowerCase();
        strip.textContent = "";
        items.forEach(it => {
            const a = it.querySelector("a[href]"), thumb = it.querySelector(".grid-images_box-img"), theName = it.querySelector(".theName");
            const nm = (it.getAttribute("title") || (theName ? theName.textContent : "") || "").trim();
            if (q && nm.toLowerCase().indexOf(q) === -1) return;
            const isV = !!(it.querySelector(".type-Video") || it.querySelector('img[src*="video.svg"]'));
            let href = a ? a.href : "#"; if (getQ() && a) { try { const u = new URL(a.href); u.searchParams.set("q", getQ()); href = u.toString(); } catch {} }
            strip.appendChild(stripCard(nm, href, thumb ? (thumb.getAttribute("src") || thumb.src) : "", isV, false));
        });
        if (wrap) wrap.style.display = strip.children.length ? "" : "none";
    }
    function populateStrip(strip) {
        renderRelated(strip);
        loadAlbumFiles().then(files => { if (files && files.length) { stripFull = true; renderStrip(strip, files); } });
    }
    /* prev/próxima mídia DENTRO do álbum filtrado (navega por página: /f/{slug}?q=). Lê albumFilesCache no clique (carrega async). */
    function navFile(dir) {
        const files = albumFilesCache; if (!files || !files.length) return;
        const q = getQ().toLowerCase();
        const list = q ? files.filter(f => (f.original || "").toLowerCase().indexOf(q) !== -1) : files;
        if (list.length < 2) return;
        const cur = fileSlug();
        let i = list.findIndex(f => f.slug === cur);
        if (i === -1) i = dir > 0 ? -1 : 0;   // atual fora do filtro → começa do vizinho na direção
        const f = list[((i + dir) % list.length + list.length) % list.length];
        if (f) location.href = "/f/" + f.slug + (getQ() ? "?q=" + encodeURIComponent(getQ()) : "");
    }
    /* liga o filtro ?q=: clique em qualquer /f/ leva o ?q= adiante; no ÁLBUM, espelha a busca nativa no ?q= (persiste + reaplica no F5) */
    function initFilter() {
        document.addEventListener("click", e => {
            const q = getQ(); if (!q) return;
            const a = e.target.closest && e.target.closest('a[href*="/f/"]'); if (!a) return;
            try { const u = new URL(a.href); if (!u.searchParams.get("q")) { u.searchParams.set("q", q); a.href = u.toString(); } } catch {}
        }, true);
        if (document.documentElement.classList.contains("bunkr-file")) return;   // resto é só no álbum
        const hook = () => {
            const inp = document.querySelector("#advFilterInput"); if (!inp || inp.dataset.qHook) return !!inp;
            inp.dataset.qHook = "1";
            const q = getQ(); if (q && !inp.value) { inp.value = q; inp.dispatchEvent(new Event("input", { bubbles: true })); }
            let t; inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => setQ(inp.value.trim()), 200); });
            return true;
        };
        if (!hook()) { let n = 0; const id = setInterval(() => { if (hook() || ++n > 40) clearInterval(id); }, 250); }   // o input do advanced view aparece com o JS da bunkr
    }

    // ===== TOPBAR: logo → balbums.st · direita só Status (ícone) + Upload · fora Albums/FAQ/tema/menu-mobile =====
    function simplifyHeader() {
        const h = document.querySelector("header");
        if (!h || h.dataset.bunkrDone) return;
        h.dataset.bunkrDone = "1";
        const logo = h.querySelector("figure a");
        if (logo) logo.href = "https://balbums.st";                                   // home → álbuns (novo domínio)
        h.querySelectorAll(".btn-viewport, .btn-mode, #menu-box-overlay").forEach(el => el.remove());   // menu-mobile, toggle de tema, overlay
        const nav = h.querySelector("#menu-box");
        if (nav) nav.querySelectorAll("ul li").forEach(li => {
            const a = li.querySelector("a"), href = (a && a.getAttribute("href")) || "", txt = (a && a.textContent) || "";
            if (/status/i.test(href) || /status/i.test(txt)) {                        // mantém Status, mas só o ícone
                if (a) Array.from(a.childNodes).forEach(n => { if (n.nodeType === 3) n.remove(); });
                return;
            }
            li.remove();                                                              // Albums, FAQ fora
        });
    }

    // ===== ORDEM DO YOUTUBE: o bloco do player/mídia sobe pra CIMA do <main> (título/tamanho/download). Só em arquivo. =====
    function reorder() {
        try {
            const main = document.querySelector("main.cont") || document.querySelector("main");
            if (!main || !main.parentNode) return;
            const media = document.querySelector("#video-container") || document.querySelector("#video-wrapper");
            let block = media ? media.closest(".rounded-lg") : null;
            if (!block) block = [...document.querySelectorAll(".rounded-lg")].find(b => !b.closest("header") && b.querySelector("img, video, #video-container"));   // foto: o bloco com a mídia (NÃO a nav do header, que tbm é .rounded-lg)
            if (!block || block === main || block.contains(main) || main.contains(block)) return;
            block.classList.add("bunkr-player-block");   // pega o margin-top (respiro abaixo da topbar)
            if (main.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) main.parentNode.insertBefore(block, main);
        } catch (e) {}
    }

    // remove o banner vermelho de troca de domínio (é uma <div> curta com fundo vermelho / texto "balbums")
    function killBanner() {
        document.querySelectorAll("body > div").forEach(d => {
            const st = (d.getAttribute("style") || "").toLowerCase();
            if (/background:\s*(red|#f|rgb\(2)/.test(st) || (/balbums\.st|old domain|isn.?t working/i.test(d.textContent || "") && d.children.length <= 2)) d.remove();
        });
    }

    // ===== TROCAR MIRROR = trocar de DOMÍNIO (pós-migração do Bunkr, cada domínio aponta pra um mirror diferente:
    // às vezes o arquivo falha num e funciona noutro). Botão no canto sup-direito do player → menu de domínios →
    // abre o MESMO caminho/arquivo no domínio escolhido. Edite MIRRORS conforme os domínios ativos do Bunkr. =====
    const MIRRORS = ["bunkr.cr", "bunkr.ph", "bunkr.ru", "bunkr.si", "bunkr.fi", "bunkr.ws", "bunkr.ax", "bunkr.black", "bunkr.media", "bunkr.site", "bunkr.pk", "bunkr.la", "bunkr.su", "bunkr.ci"];
    function mediaBox() {
        return document.querySelector("#video-container")
            || document.querySelector(".rounded-lg section > div.mx-auto")
            || [...document.querySelectorAll(".rounded-lg")].find(b => !b.closest("header"));   // ignora a nav do header (tbm é .rounded-lg)
    }
    function addMirrorSwitch() {
        const box = mediaBox();
        if (!box || box.querySelector(":scope > .bunkr-mirror")) return;
        if (getComputedStyle(box).position === "static") box.style.position = "relative";
        box.classList.add("bunkr-has-mirror");   // o hover dele revela o botão
        const cur = location.hostname.replace(/^www\./, "");
        const wrap = document.createElement("div"); wrap.className = "bunkr-mirror";
        const btn = document.createElement("button"); btn.type = "button"; btn.className = "bunkr-mirror-btn";
        btn.innerHTML = '<span class="bunkr-mirror-spin" aria-hidden="true"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 6h18"/><path d="m7 22-4-4 4-4"/><path d="M21 18H3"/></svg><span>Mirror</span>';
        const menu = document.createElement("div"); menu.className = "bunkr-mirror-menu"; menu.hidden = true;
        menu.innerHTML = '<div class="bunkr-mirror-head">Trocar de mirror · <b>' + cur + '</b></div><div class="bunkr-mirror-grid"></div>';
        const grid = menu.querySelector(".bunkr-mirror-grid");
        MIRRORS.forEach(d => {
            const a = document.createElement("a"); a.className = "bunkr-mirror-item" + (d === cur ? " is-current" : "");
            a.textContent = d;
            if (d === cur) a.addEventListener("click", e => e.preventDefault());   // já estou nele
            else a.href = location.protocol + "//" + d + location.pathname + location.search;
            grid.appendChild(a);
        });
        const setOpen = open => { menu.hidden = !open; wrap.classList.toggle("is-open", open); };   // is-open mantém o botão visível mesmo saindo do hover
        btn.addEventListener("click", e => { e.preventDefault(); setOpen(menu.hidden); });
        document.addEventListener("click", e => { if (!wrap.contains(e.target)) setOpen(false); });   // fecha clicando FORA
        wrap.append(btn, menu);
        box.appendChild(wrap);
    }

    function nextMirror() {
        const cur = location.hostname.replace(/^www\./, "");
        const i = MIRRORS.indexOf(cur);
        return MIRRORS[((i >= 0 ? i : -1) + 1) % MIRRORS.length] || MIRRORS[0];
    }
    // aviso "mirror fora" no topo do player + botão pro próximo mirror
    function suggestMirror(reason) {
        const box = document.querySelector(".bunkr-stage .bunkr-stage-mid") || mediaBox();   // no stage o aviso vai sobre a mídia; senão, no box antigo
        if (!box || box.querySelector(".bunkr-mirror-warn")) return;
        if (getComputedStyle(box).position === "static") box.style.position = "relative";
        const nd = nextMirror();
        const warn = document.createElement("div"); warn.className = "bunkr-mirror-warn";
        warn.innerHTML = "<div><b>⚠ Esse mirror pode estar fora</b> " + (reason ? "<span>· " + reason + "</span>" : "") + "</div>";
        const a = document.createElement("a"); a.className = "bunkr-mirror-warn-btn"; a.textContent = "Tentar " + nd + " →";
        a.href = location.protocol + "//" + nd + location.pathname + location.search;
        warn.appendChild(a);
        const x = document.createElement("button"); x.className = "bunkr-mirror-warn-x"; x.type = "button";
        x.setAttribute("aria-label", "Dispensar"); x.title = "Dispensar"; x.innerHTML = svgi('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');
        x.addEventListener("click", () => warn.remove());
        warn.appendChild(x);
        box.appendChild(warn);
    }
    // TESTE DO PLAYER: probe ESCONDIDO do mp4 que o Bunkr assinou (sem CORS — <video> toca cross-origin; testa rede E
    // decode). loadedmetadata = vai rodar; error/timeout = mirror fora → sugere trocar. + escuta erro no player real.
    let probed = false;
    function testMirror() {
        if (probed) return;
        const el = document.querySelector("#video-wrapper video source[src], #player source[src], #video-wrapper video[src], #player[src]");
        const src = el && (el.getAttribute("src") || el.src);
        if (!src) return;   // o Bunkr ainda não montou o player → tenta de novo
        probed = true;
        setMirrorTesting(true);   // spinner "testando" no botão de mirror enquanto o probe roda
        const real = document.querySelector("#video-wrapper video, #player");
        if (real) real.addEventListener("error", () => suggestMirror("erro ao reproduzir"), { once: true });
        const v = document.createElement("video");
        v.muted = true; v.preload = "metadata"; v.playsInline = true;
        v.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none";
        let done = false;
        const finish = ok => { if (done) return; done = true; clearTimeout(to); v.removeAttribute("src"); v.load && v.load(); v.remove(); setMirrorTesting(false); if (!ok) suggestMirror("o vídeo não carregou"); };
        v.addEventListener("loadedmetadata", () => finish(true), { once: true });
        v.addEventListener("error", () => finish(false), { once: true });
        const to = setTimeout(() => finish(false), 10000);   // lento demais → trata como fora
        v.src = src; (document.body || document.documentElement).appendChild(v); v.load();
    }

    // ===== SEARCH GRANDE na topbar → busca no NOVO domínio (balbums.st) com o texto digitado =====
    function addSearch() {
        const bar = document.querySelector("header .cont > .flex.items-center");
        const figure = bar && bar.querySelector("figure");
        if (!bar || !figure || bar.querySelector(".bunkr-search")) return;
        const input = document.createElement("input");
        input.type = "text"; input.className = "bunkr-search";   // type=text (não search) → zero decoração nativa
        input.placeholder = "Buscar em balbums.st…"; input.autocomplete = "off"; input.spellcheck = false; input.setAttribute("aria-label", "Buscar em balbums.st");
        input.addEventListener("keydown", e => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const q = input.value.trim();
            if (q) location.href = "https://balbums.st/?search=" + encodeURIComponent(q) + "&mode=broad&per=20&sort=latest";
        });
        figure.insertAdjacentElement("afterend", input);   // logo | INPUT | nav (Status + Upload)
    }

    const isFile = document.documentElement.classList.contains("bunkr-file");
    function apply() {
        simplifyHeader(); addSearch(); killBanner();   // header/busca valem pro ÁLBUM; na página de arquivo o stage cobre por cima
    }
    function onReady(fn) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
        else fn();
    }
    onReady(() => {
        apply(); setTimeout(apply, 700); initFilter();
        if (isFile) {   // página de arquivo: monta o STAGE (vrow + mídia fixa + strip do álbum) e a mídia assim que o src/img aparecer
            let n = 0, done = false, id = null;
            const stop = () => { done = true; if (id) clearInterval(id); };
            const tick = () => {
                const stage = buildStage();
                if (stage) {
                    if (stage.classList.contains("is-video")) mountOwnPlayer(); else mountPhotoZoom();
                    if (stage._strip) renderRelated(stage._strip);   // mantém o fallback fresco até o álbum baixar (renderStrip assume quando stripFull)
                    testMirror();
                }
                const noProbe = !document.querySelector("#video-container, #video-wrapper");   // imagem/não-vídeo → não há probe de mirror (probed nunca vira true)
                if (mediaMounted && (probed || noProbe)) stop();
                else if (++n > 16) {   // ~6.4s: a mídia (src/img server-rendered) monta no 1º tick; só não-mídia (pdf/zip) chega aqui → tira o stage e o placeholder, mostra a página nativa
                    stop();
                    if (!mediaMounted) { document.documentElement.classList.add("bunkr-fallback"); const st = document.querySelector(".bunkr-stage"); if (st) st.remove(); document.documentElement.classList.remove("bunkr-has-stage"); }
                }
            };
            tick();   // JÁ no DOMContentLoaded (não espera o 1º intervalo de 400ms) → o stage cobre o placeholder ASAP, sem flash da interface antiga
            if (!done) id = setInterval(tick, 400);
        }
    });
})();
