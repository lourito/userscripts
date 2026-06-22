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
