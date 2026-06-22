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
