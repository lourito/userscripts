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
