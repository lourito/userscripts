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
