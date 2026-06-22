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
