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