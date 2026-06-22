#!/usr/bin/env node
/* eslint-disable */
// =============================================================================
//  build-once.js — BOOTSTRAP (roda UMA vez): fatia o script.js monolítico atual
//  nos arquivos de parts/, cortando exatamente nos banners de seção.
//
//  SEGURANÇA: é puro slice de ranges de linha contíguos (1..EOF, sem buraco nem
//  sobreposição). Ao final RE-LÊ os parts, junta com '\n' e compara BYTE A BYTE
//  com o original — se não bater, aborta e diz onde divergiu. Logo: ou os parts
//  reconstroem o arquivo idêntico, ou o script falha barulhento (nunca silencioso).
//
//  Uso:  node userscripts/xenforo/build-once.js
//  Depois disso o fonte vira parts/*.js; o monólito é gerado por build.js.
// =============================================================================
const fs = require('fs');
const path = require('path');

// ⚠️ JÁ RODADO (jun/2026, bootstrap histórico). Os números em STARTS são daquele
//    estado; o script.js MUDOU desde então (aviso GERADO + sub-headers). O self-check
//    garante round-trip lossless, mas as FRONTEIRAS podem cair fora dos banners se as
//    linhas dériftaram → re-confira/atualize STARTS antes de re-rodar. Pra split novo,
//    normalmente é mais simples cortar o part na mão.
const SRC = path.join(__dirname, 'script.js');   // monólito gerado (nesta pasta)
const PARTS = path.join(__dirname, 'parts');

// [linha-de-início (1-based), nome-do-part]. Cada part vai de seu início até a
// linha ANTES do próximo início. O último vai até o fim do arquivo (o `})();`).
// Os inícios caem nos banners "// ====" de cada seção (ver índice no topo do script).
const STARTS = [
    [1,    '01-header'],            // ==UserScript== + índice/modelo mental + abertura do IIFE + 'use strict'
    [109,  '02-config'],           // DEFAULT_FEATURES, FEATURES, gmGet/gmSet, SETTINGS_META
    [194,  '03-i18n'],             // IS_PT, I18N_PT, i18n(), i18nDom(), navHref()
    [329,  '04-icons'],            // ICONS{}, SMG_LOGO/PH_MARK, SMG_FAVICON
    [405,  '05-styles'],           // injectStyles() — a CSS inteira (template ` `)
    [3052, '06-helpers'],          // texto/url + UI builders (makeDock*) + paginação
    [3216, '07-posts-misc'],       // dedupeImagesPass, applyAuthorFilter, teclado, scroll infinito
    [3465, '08-images-masonry'],   // getThumbIO/getFullIO, processImages, collectGalleryBlocks, buildPostGallery(ies)
    [3652, '09-turbo'],            // getTurboIO, processTurboLinks, buildEmbedWrapper, buildTurboIframe/Error, turboCheck
    [3846, '10-redgifs-player'],   // GMX + pipeline redgifs/turbo (rg*, buildNativeVideo, turboApi, processTurboNativeEmbeds, applyRedgifsPlayer)
    [4236, '11-autoload-spoiler'], // autoLoadRedgifs, autoExpandSpoilers
    [4274, '12-dock-postnav'],     // setupPostNavigation() — dock + busca (GRANDE)
    [5458, '13-search-imageclick'],// enableSearchTitlesOnly, setupImageClickFeed
    [5505, '14-feed-lightbox'],    // collectMediaFrom, gal* (galeria), openMediaFeed()
    [6190, '15-listing'],          // markThreadGridContainer, badges reativos, styleArticleCards, markGridPlaceholders
    [6326, '16-home'],             // home (forum_list): merge/relocate/expand/sort/reorder + buildHomeFeed + sidebar
    [6728, '17-thread-filterbar'], // smg*(Bar/Pop/Jump/Pager/Sort/Primary/More), buildFilterBars, fetchXfList
    [6993, '18-alerts'],           // markAlertRead, cleanAlertRow, groupAlerts, cleanAlertList
    [7137, '19-topbar'],           // buildTopbar() (GRANDE)
    [7519, '20-hover-preview'],    // dcThumbUrl, setupThumbPreview
    [7586, '21-init-features'],    // safe, setFavicon, redirect-unwrap, reveal-liked, saint, download, direct-media, group-links
    [7903, '22-init'],             // processAll(), scheduleRun(), detectPageClasses(), boot() + fechamento `})();`
];

const original = fs.readFileSync(SRC, 'utf8');
const lines = original.split('\n');

// sanidade: inícios estritamente crescentes e dentro do arquivo
for (let i = 1; i < STARTS.length; i++) {
    if (STARTS[i][0] <= STARTS[i - 1][0]) { console.error('ERRO: STARTS fora de ordem em', STARTS[i]); process.exit(1); }
}
if (STARTS[STARTS.length - 1][0] > lines.length) { console.error('ERRO: último início além do EOF'); process.exit(1); }

fs.mkdirSync(PARTS, { recursive: true });
const written = [];
for (let i = 0; i < STARTS.length; i++) {
    const from = STARTS[i][0] - 1;                                       // 0-based, inclusivo
    const to = (i + 1 < STARTS.length) ? STARTS[i + 1][0] - 1 : lines.length;   // exclusivo
    const chunk = lines.slice(from, to).join('\n');                     // SEM '\n' extra (ver prova no build.js)
    const file = path.join(PARTS, STARTS[i][1] + '.js');
    fs.writeFileSync(file, chunk);
    written.push(file);
}

// ---- AUTO-VERIFICAÇÃO: re-lê os parts na ordem, junta com '\n', compara com o original ----
const rebuilt = written.map(f => fs.readFileSync(f, 'utf8')).join('\n');
if (rebuilt === original) {
    console.log('OK — ' + written.length + ' parts escritos; round-trip BYTE-IDÊNTICO ao script.js atual.');
} else {
    // acha a 1ª divergência pra debugar
    let k = 0; while (k < rebuilt.length && k < original.length && rebuilt[k] === original[k]) k++;
    const lineNo = original.slice(0, k).split('\n').length;
    console.error('FALHA — reconstrução DIVERGE do original perto da linha ' + lineNo + ' (char ' + k + ').');
    console.error('  original: ' + JSON.stringify(original.slice(k, k + 60)));
    console.error('  rebuilt : ' + JSON.stringify(rebuilt.slice(k, k + 60)));
    process.exit(1);
}
