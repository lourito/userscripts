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
