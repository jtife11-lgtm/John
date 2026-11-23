(function () {
  var appState = {
    view: 'home',
    theme: localStorage.getItem('str_standalone_theme') || 'dark',
    lang: localStorage.getItem('str_standalone_lang') || 'en',
    entered: localStorage.getItem('str_standalone_entered') === 'true',
    favClubs: JSON.parse(localStorage.getItem('str_standalone_fav_clubs') || '["Real Madrid","Liverpool","Al Ansar FC"]'),
    scoresLeague: 'all',
    scoresFilter: 'all', // all | live | upcoming | ft | fav
    scoresDateOffset: 0,
    matches: [],
    matchesLoading: false,
    matchesError: '',
    newsTab: 'football', // football | gaming | saved
    newsCat: 'all',
    newsArticles: [],
    localSavedNews: JSON.parse(localStorage.getItem('str_standalone_saved_news') || '[]'),
    standingsLeague: 'eng.1',
    standingsData: [],
    playerQuery: 'Messi',
    playerResults: [],
    aiHistory: [],
    aiLoading: false,
    fantasyFormation: '4-3-3',
    fantasyName: 'Beirut Reds XI',
    fantasyIds: ['fp-alisson', 'fp-saliba', 'fp-vandijk', 'fp-hakimi', 'fp-bellingham', 'fp-rodri', 'fp-pedri', 'fp-mbappe', 'fp-salah', 'fp-vinicius', 'fp-maatouk'],
    localVotes: JSON.parse(localStorage.getItem('str_standalone_votes') || '{}'),
    localPolls: [
      { id: 'local-potm', category: 'potm', title: 'STR Player of the Month', options: ['Kylian Mbappé', 'Lamine Yamal', 'Mohamed Salah', 'Jude Bellingham'], counts: [42, 38, 35, 29], totalVotes: 144 },
      { id: 'local-ucl', category: 'best_team', title: 'Who wins this season Champions League?', options: ['Real Madrid', 'Liverpool', 'FC Barcelona', 'Manchester City'], counts: [51, 33, 27, 24], totalVotes: 135 }
    ],
    localPreds: JSON.parse(localStorage.getItem('str_standalone_preds') || '[]'),
    localMessages: [
      { senderName: 'Tariq_99', text: 'Matchday thread is open! Who wins tonight in the Champions League?' },
      { senderName: 'Layla_STR', text: 'Real Madrid midfield pace is looking sharp today 🔥⚽' }
    ]
  };

  function toast(msg, type) {
    var root = document.getElementById('toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast-item ' + (type || '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3400);
  }
  window.STR_TOAST = toast;

  function openModal(html) {
    var root = document.getElementById('modal-root');
    var card = document.getElementById('modal-card');
    if (!root || !card) return;
    card.innerHTML = html;
    root.classList.remove('hidden');
  }
  function closeModal() {
    var root = document.getElementById('modal-root');
    if (root) root.classList.add('hidden');
  }

  function esc(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function compactDate(offsetDays) {
    var d = new Date(Date.now() + offsetDays * 86400000);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return '' + y + m + day;
  }

  function applyThemeAndLang() {
    var html = document.documentElement;
    if (appState.theme === 'light') {
      html.classList.add('light');
      html.classList.remove('dark');
    } else {
      html.classList.add('dark');
      html.classList.remove('light');
    }
    html.lang = appState.lang;
    html.dir = appState.lang === 'ar' ? 'rtl' : 'ltr';
    var themeIcon = document.getElementById('theme-icon');
    var langLbl = document.getElementById('lang-label');
    if (themeIcon) themeIcon.textContent = appState.theme === 'dark' ? '☀️' : '🌙';
    if (langLbl) langLbl.textContent = appState.lang === 'en' ? 'AR' : 'EN';
    var dict = window.STR_I18N[appState.lang] || window.STR_I18N.en;
    document.querySelectorAll('[data-i18n]').forEach(function (n) {
      var k = n.getAttribute('data-i18n');
      if (dict[k]) n.textContent = dict[k];
    });
  }

  function updateHeaderAuth() {
    var fb = window.STR_FB && window.STR_FB.getState();
    var dot = document.getElementById('header-auth-dot');
    var lbl = document.getElementById('header-user-label');
    if (fb && fb.user) {
      if (dot) dot.classList.add('online');
      if (lbl) lbl.textContent = (fb.profile && fb.profile.displayName) || fb.user.displayName || 'Supporter';
    } else {
      if (dot) dot.classList.remove('online');
      if (lbl) lbl.textContent = 'Sign In';
    }
  }

  function crestHTML(team) {
    if (team && team.logo) {
      return '<img src="' + esc(team.logo) + '" alt="' + esc(team.shortName || team.name) + '" class="team-crest-img" onerror="this.style.display=\'none\'">';
    }
    var abbr = (team && team.abbreviation) || (team && team.name ? team.name.slice(0, 3).toUpperCase() : 'STR');
    return '<span class="team-crest-fallback" style="background:rgba(225,29,72,0.16)">' + esc(abbr) + '</span>';
  }

  function renderMatchCard(m) {
    var liveBadge = (m.status === 'LIVE' || m.status === 'HT')
      ? '<span class="badge-accent" style="display:inline-flex;align-items:center;gap:5px"><span class="live-dot"></span> ' + esc(m.clock || m.status) + '</span>'
      : '<span class="text-muted" style="font-size:0.72rem;font-weight:700">' + esc(m.status === 'FT' ? 'FT' : (m.clock || 'Upcoming')) + '</span>';
    var hScore = m.home.score === null || m.home.score === undefined ? '—' : m.home.score;
    var aScore = m.away.score === null || m.away.score === undefined ? '—' : m.away.score;
    return '<button class="match-card" data-match-league="' + esc(m.leagueId) + '" data-match-id="' + esc(m.id) + '">' +
      '<div class="flex-between"><span class="text-muted" style="font-size:0.72rem;font-weight:700">' + esc(m.leagueName) + '</span>' + liveBadge + '</div>' +
      '<div class="match-row">' +
      '<div class="flex-wrap" style="justify-content:flex-end;text-align:right"><strong>' + esc(m.home.shortName || m.home.name) + '</strong>' + crestHTML(m.home) + '</div>' +
      '<div class="font-display font-mono-tabular" style="font-size:1.55rem;font-weight:800;padding:0 8px">' + esc(hScore) + ' : ' + esc(aScore) + '</div>' +
      '<div class="flex-wrap">' + crestHTML(m.away) + '<strong>' + esc(m.away.shortName || m.away.name) + '</strong></div>' +
      '</div></button>';
  }

  async function openMatchModal(leagueId, eventId) {
    openModal('<div class="stack-md"><h3>Loading Match Center...</h3><p class="text-muted">Fetching live stats, events, and lineups from official sports feed.</p></div>');
    try {
      var detail = await window.STR_API.fetchMatchDetail(leagueId, eventId);
      var m = detail.match;
      var statsHTML = (detail.stats && detail.stats.length)
        ? detail.stats.slice(0, 10).map(function (s) {
            return '<div class="card-subtle flex-between"><strong>' + esc(s.homeValue) + '</strong><span class="text-muted" style="font-size:0.76rem">' + esc(s.label) + '</span><strong>' + esc(s.awayValue) + '</strong></div>';
          }).join('')
        : '<p class="text-muted">Match statistics are published once kickoff begins.</p>';
      var evHTML = (detail.events && detail.events.length)
        ? detail.events.map(function (ev) {
            return '<div class="card-subtle" style="font-size:0.8rem"><span class="badge-accent" style="margin-right:8px">' + esc(ev.minute) + '</span><strong>' + esc(ev.playerName) + '</strong> — ' + esc(ev.detail) + '</div>';
          }).join('')
        : '<p class="text-muted">No match events logged yet.</p>';

      openModal(
        '<div class="stack-md">' +
        '<div class="flex-between"><span class="badge-accent">' + esc(m.leagueName) + ' · ' + esc(m.clock || m.status) + '</span><button class="btn-secondary btn-sm" id="modal-close-btn">✕ Close</button></div>' +
        '<div class="card-subtle flex-between" style="text-align:center">' +
        '<div style="flex:1">' + crestHTML(m.home) + '<div style="font-weight:800;margin-top:4px">' + esc(m.home.name) + '</div></div>' +
        '<div class="font-display font-mono-tabular" style="font-size:2.4rem;font-weight:800;padding:0 16px">' + (m.home.score !== null ? m.home.score : '—') + ' - ' + (m.away.score !== null ? m.away.score : '—') + '</div>' +
        '<div style="flex:1">' + crestHTML(m.away) + '<div style="font-weight:800;margin-top:4px">' + esc(m.away.name) + '</div></div></div>' +
        '<div class="grid-2"><div class="stack-sm"><h4>Match Events</h4>' + evHTML + '</div><div class="stack-sm"><h4>Team Statistics</h4>' + statsHTML + '</div></div></div>'
      );
      var cb = document.getElementById('modal-close-btn');
      if (cb) cb.onclick = closeModal;
    } catch (e) {
      openModal('<div class="stack-md"><h3>Match Detail Unavailable</h3><p class="text-muted">' + esc(e.message) + '</p><button class="btn-secondary btn-sm" id="modal-close-btn">Close</button></div>');
      var cb2 = document.getElementById('modal-close-btn');
      if (cb2) cb2.onclick = closeModal;
    }
  }

  function openAuthModal(defaultMode) {
    var mode = defaultMode || 'signin';
    var renderAuth = function () {
      openModal(
        '<div class="stack-md">' +
        '<div class="flex-between"><div><span class="badge-accent">STR ACCOUNT SYNC</span><h2 class="font-display" style="margin:2px 0 0">' + (mode === 'signup' ? 'Create STR Account' : 'Sign In to STR SCORES') + '</h2></div>' +
        '<button class="btn-secondary btn-sm" id="modal-close-btn">✕</button></div>' +
        '<form id="auth-form" class="stack-sm">' +
        (mode === 'signup' ? '<input class="input" id="auth-name" placeholder="Display Name (e.g. Karim_9)" required>' : '') +
        '<input class="input" id="auth-email" type="email" placeholder="Email Address" required>' +
        '<input class="input" id="auth-pass" type="password" placeholder="Password (min 6 chars)" required>' +
        '<button class="btn-primary" type="submit">' + (mode === 'signup' ? 'Create Account' : 'Sign In') + '</button></form>' +
        '<div class="flex-between"><button class="btn-secondary btn-sm" id="auth-google">Continue with Google</button>' +
        '<button class="btn-secondary btn-sm" id="auth-switch">' + (mode === 'signup' ? 'Already have an account? Sign In' : 'Need an account? Sign Up') + '</button></div></div>'
      );
      document.getElementById('modal-close-btn').onclick = closeModal;
      document.getElementById('auth-switch').onclick = function () { mode = mode === 'signup' ? 'signin' : 'signup'; renderAuth(); };
      document.getElementById('auth-google').onclick = async function () {
        try { await window.STR_FB.signInGoogle(); toast('Signed in with Google!', 'success'); closeModal(); navigate(appState.view); }
        catch (err) { toast(err.message || 'Google sign-in unavailable', 'error'); }
      };
      document.getElementById('auth-form').onsubmit = async function (e) {
        e.preventDefault();
        var em = document.getElementById('auth-email').value;
        var pw = document.getElementById('auth-pass').value;
        var nm = document.getElementById('auth-name') ? document.getElementById('auth-name').value : '';
        try {
          if (mode === 'signup') await window.STR_FB.signUpEmail(em, pw, nm);
          else await window.STR_FB.signInEmail(em, pw);
          toast('Welcome to STR SCORES!', 'success');
          closeModal();
          navigate(appState.view);
        } catch (err) {
          toast(err.message || 'Authentication failed', 'error');
        }
      };
    };
    renderAuth();
  }

  function openFavClubsModal() {
    var clubs = window.STR_DATA.CLUBS_CATALOG || [];
    var renderFav = function () {
      openModal(
        '<div class="stack-md"><div class="flex-between"><div><span class="badge-accent">PERSONALIZATION</span><h2 style="margin:2px 0 0">Favorite Football Clubs</h2></div><button class="btn-primary btn-sm" id="fav-done">Done</button></div>' +
        '<div class="grid-3" style="max-height:360px;overflow-y:auto">' +
        clubs.map(function (c) {
          var active = appState.favClubs.indexOf(c.name) >= 0;
          return '<button class="card-subtle flex-between" style="cursor:pointer;border-color:' + (active ? 'var(--crimson)' : 'var(--border)') + '" data-fav-club="' + esc(c.name) + '"><span>' + esc(c.name) + '<br><small class="text-muted">' + esc(c.league) + '</small></span><span>' + (active ? '❤️' : '+') + '</span></button>';
        }).join('') +
        '</div></div>'
      );
      document.getElementById('fav-done').onclick = function () {
        localStorage.setItem('str_standalone_fav_clubs', JSON.stringify(appState.favClubs));
        closeModal();
        renderCurrentView();
      };
      document.querySelectorAll('[data-fav-club]').forEach(function (b) {
        b.onclick = function () {
          var name = b.getAttribute('data-fav-club');
          var idx = appState.favClubs.indexOf(name);
          if (idx >= 0) appState.favClubs.splice(idx, 1); else appState.favClubs.push(name);
          renderFav();
        };
      });
    };
    renderFav();
  }

  function openSearchModal() {
    openModal(
      '<div class="stack-md"><div class="flex-between"><h3>Search Matches, Teams, Players &amp; Clubs</h3><button class="btn-secondary btn-sm" id="modal-close-btn">✕</button></div>' +
      '<input class="input" id="global-search-in" placeholder="Search Arsenal, Mbappé, Champions League, Al Ansar...">' +
      '<div id="global-search-out" class="stack-sm"></div></div>'
    );
    document.getElementById('modal-close-btn').onclick = closeModal;
    var input = document.getElementById('global-search-in');
    var out = document.getElementById('global-search-out');
    input.focus();
    input.oninput = function () {
      var q = input.value.trim().toLowerCase();
      if (!q) { out.innerHTML = '<p class="text-muted">Type at least 2 characters to search...</p>'; return; }
      var matches = appState.matches.filter(function (m) {
        return (m.home.name + ' ' + m.away.name + ' ' + m.leagueName).toLowerCase().indexOf(q) >= 0;
      }).slice(0, 5);
      var clubs = (window.STR_DATA.CLUBS_CATALOG || []).filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 5);
      var html = '';
      matches.forEach(function (m) {
        html += '<div class="card-subtle flex-between"><span>⚽ ' + esc(m.home.name) + ' vs ' + esc(m.away.name) + '</span><button class="btn-secondary btn-sm" data-gs-match="' + esc(m.leagueId) + ':' + esc(m.id) + '">Open</button></div>';
      });
      clubs.forEach(function (c) {
        html += '<div class="card-subtle flex-between"><span>🛡️ ' + esc(c.name) + ' (' + esc(c.league) + ')</span><button class="btn-secondary btn-sm" data-gs-sim="' + esc(c.id) + '">Simulate</button></div>';
      });
      out.innerHTML = html || '<p class="text-muted">No instant matches found. Try searching in the Players view for TheSportsDB lookup.</p>';
      out.querySelectorAll('[data-gs-match]').forEach(function (b) {
        b.onclick = function () { var p = b.getAttribute('data-gs-match').split(':'); openMatchModal(p[0], p[1]); };
      });
      out.querySelectorAll('[data-gs-sim]').forEach(function (b) {
        b.onclick = function () { closeModal(); navigate('simulator'); };
      });
    };
  }

  async function loadScores() {
    appState.matchesLoading = true;
    appState.matchesError = '';
    if (appState.view === 'scores' || appState.view === 'home') renderCurrentView();
    try {
      var dc = appState.scoresDateOffset === 0 ? '' : compactDate(appState.scoresDateOffset);
      var res = await window.STR_API.fetchScoreboard(appState.scoresLeague, dc);
      appState.matches = res.matches || [];
    } catch (e) {
      appState.matchesError = e.message || 'Unable to load scoreboard feed.';
    } finally {
      appState.matchesLoading = false;
      if (appState.view === 'scores' || appState.view === 'home') renderCurrentView();
    }
  }

  async function loadNews() {
    var el = document.getElementById('app-main');
    try {
      var data = appState.newsTab === 'gaming'
        ? await window.STR_API.fetchGamingNews('all')
        : await window.STR_API.fetchFootballNews(appState.newsCat);
      appState.newsArticles = data.articles || [];
    } catch (e) {
      appState.newsArticles = [];
    }
    if (appState.view === 'news' && el) renderNews(el);
  }

  async function loadStandings() {
    try {
      var res = await window.STR_API.fetchStandings(appState.standingsLeague);
      appState.standingsData = res.standings || [];
    } catch (e) {
      appState.standingsData = [];
    }
    if (appState.view === 'stats') renderCurrentView();
  }

  async function runPlayerSearch(q) {
    try {
      appState.playerResults = await window.STR_API.searchPlayers(q);
    } catch (e) {
      appState.playerResults = [];
    }
    if (appState.view === 'players') renderCurrentView();
  }

  function renderHome(el) {
    var live = appState.matches.filter(function (m) { return m.status === 'LIVE' || m.status === 'HT'; });
    var featured = (live.length ? live : appState.matches).slice(0, 4);
    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="hero-banner"><img src="' + window.STR_CONFIG.HERO_IMG + '" alt="STR SCORES Stadium" class="hero-bg-img"><div class="hero-overlay"></div>' +
      '<div class="hero-inner">' +
      '<div class="stack-md"><span class="badge-accent">LIVE FOOTBALL &amp; GAMING HUB</span>' +
      '<h1 class="font-display" style="margin:0;font-size:2.8rem;line-height:1">Every Kick, Every Stat, <span class="text-crimson">Zero Delay.</span></h1>' +
      '<p style="color:#cbd5e1;margin:0;max-width:560px">Real-time scores from Premier League, La Liga, UCL &amp; Lebanese Premier League, a 7-mode tactical Match Simulator, 10 mini-games, Player Cards, and Fantasy XI.</p>' +
      '<div class="flex-wrap">' +
      '<button class="btn-primary" data-jump="scores">⚽ Live Scores</button>' +
      '<button class="btn-secondary" data-jump="simulator" style="background:rgba(255,255,255,0.1);color:#fff">⚔️ Match Simulator</button>' +
      '<button class="btn-secondary" data-jump="games" style="background:rgba(255,255,255,0.1);color:#fff">🎮 Mini-Games</button>' +
      '</div></div>' +
      '<div class="card-subtle" style="background:rgba(7,9,15,0.85)"><div class="flex-between"><span class="badge-accent">YOUR CLUBS</span><button class="btn-secondary btn-sm" id="home-edit-clubs">Customize</button></div>' +
      '<div class="flex-wrap" style="margin-top:10px">' + appState.favClubs.map(function (c) { return '<span class="tab-chip active">' + esc(c) + '</span>'; }).join('') + '</div></div>' +
      '</div></div>' +
      '<div class="stack-md"><div class="flex-between"><h2>' + (live.length ? '🔴 Live &amp; Active Matches' : '📅 Matchday Schedule') + '</h2>' +
      '<button class="btn-secondary btn-sm" data-jump="scores">Full Scoreboard →</button></div>' +
      (appState.matchesLoading ? '<div class="card">Fetching real-time ESPN &amp; TheSportsDB feeds...</div>' :
        featured.length ? '<div class="grid-2">' + featured.map(renderMatchCard).join('') + '</div>' :
        '<div class="card">No fixtures listed right now. Try switching dates in Live Scores or run a Match Simulation.</div>') +
      '</div>' +
      '<div class="grid-3">' +
      '<div class="card stack-sm"><span class="badge-accent">7 MODES · 32 CLUBS</span><h3>Football Match Simulator</h3><p class="text-muted">Play minute-by-minute 0–90+ with VAR, injuries, 2D pitch, penalties &amp; knockout brackets.</p><button class="btn-primary btn-sm" data-jump="simulator">Launch Simulator</button></div>' +
      '<div class="card stack-sm"><span class="badge-accent">10 PLAYABLE CHALLENGES</span><h3>Gaming &amp; Card Packs</h3><p class="text-muted">Score penalties, referee VAR offside calls, and collect Icon/Gold player cards.</p><button class="btn-primary btn-sm" data-jump="games">Open Arcade</button></div>' +
      '<div class="card stack-sm"><span class="badge-accent">SUPPORTER HUB</span><h3>Fantasy XI &amp; STR VOTE</h3><p class="text-muted">Build your 100M budget squad, submit score predictions &amp; vote in community polls.</p><button class="btn-primary btn-sm" data-jump="fantasy">Build Fantasy XI</button></div>' +
      '</div></div>';

    el.querySelectorAll('[data-jump]').forEach(function (b) { b.onclick = function () { navigate(b.getAttribute('data-jump')); }; });
    el.querySelectorAll('[data-match-id]').forEach(function (b) { b.onclick = function () { openMatchModal(b.getAttribute('data-match-league'), b.getAttribute('data-match-id')); }; });
    var hec = document.getElementById('home-edit-clubs'); if (hec) hec.onclick = openFavClubsModal;
  }

  function renderScores(el) {
    var list = appState.matches.filter(function (m) {
      if (appState.scoresFilter === 'live') return m.status === 'LIVE' || m.status === 'HT';
      if (appState.scoresFilter === 'upcoming') return m.status === 'UPCOMING';
      if (appState.scoresFilter === 'ft') return m.status === 'FT';
      if (appState.scoresFilter === 'fav') {
        var txt = (m.home.name + ' ' + m.away.name).toLowerCase();
        return appState.favClubs.some(function (fc) { return txt.indexOf(fc.toLowerCase()) >= 0; });
      }
      return true;
    });

    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="flex-between"><div><span class="badge-accent">REAL-TIME SPORTS FEEDS</span><h1 class="font-display" style="margin:2px 0 0;font-size:2rem">Live Football Scoreboard</h1></div>' +
      '<div class="flex-wrap">' +
      [[-1, 'Yesterday'], [0, 'Today'], [1, 'Tomorrow']].map(function (d) {
        return '<button class="tab-chip ' + (appState.scoresDateOffset === d[0] ? 'active' : '') + '" data-sc-date="' + d[0] + '">' + d[1] + '</button>';
      }).join('') +
      '<button class="btn-secondary btn-sm" id="sc-refresh">↻ Refresh</button></div></div>' +
      '<div class="filter-row"><button class="tab-chip ' + (appState.scoresLeague === 'all' ? 'active' : '') + '" data-sc-lg="all">All Leagues</button>' +
      window.STR_DATA.LEAGUES_CATALOG.map(function (l) {
        return '<button class="tab-chip ' + (appState.scoresLeague === l.id ? 'active' : '') + '" data-sc-lg="' + l.id + '">' + esc(l.name) + '</button>';
      }).join('') + '</div>' +
      '<div class="flex-wrap">' +
      [['all', 'All (' + appState.matches.length + ')'], ['live', 'Live / HT'], ['upcoming', 'Upcoming'], ['ft', 'Finished'], ['fav', 'Favorite Clubs']].map(function (f) {
        return '<button class="tab-chip ' + (appState.scoresFilter === f[0] ? 'active' : '') + '" data-sc-flt="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div>' +
      (appState.matchesError ? '<div class="card text-crimson">' + esc(appState.matchesError) + '</div>' : '') +
      (appState.matchesLoading ? '<div class="card">Loading verified match data...</div>' :
        list.length ? '<div class="grid-2">' + list.map(renderMatchCard).join('') + '</div>' :
        '<div class="card"><p class="text-muted">No fixtures matched this filter or date. Select All Leagues or switch to Yesterday/Tomorrow.</p></div>') +
      '</div>';

    el.querySelectorAll('[data-sc-date]').forEach(function (b) { b.onclick = function () { appState.scoresDateOffset = Number(b.getAttribute('data-sc-date')); loadScores(); }; });
    el.querySelectorAll('[data-sc-lg]').forEach(function (b) { b.onclick = function () { appState.scoresLeague = b.getAttribute('data-sc-lg'); loadScores(); }; });
    el.querySelectorAll('[data-sc-flt]').forEach(function (b) { b.onclick = function () { appState.scoresFilter = b.getAttribute('data-sc-flt'); renderScores(el); }; });
    el.querySelectorAll('[data-match-id]').forEach(function (b) { b.onclick = function () { openMatchModal(b.getAttribute('data-match-league'), b.getAttribute('data-match-id')); }; });
    var rf = document.getElementById('sc-refresh'); if (rf) rf.onclick = loadScores;
  }

  function renderPlayers(el) {
    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="card stack-md"><div class="flex-between"><div><span class="badge-accent">THESPORTSDB PLAYER REGISTRY</span><h1 class="font-display" style="margin:2px 0 0;font-size:2rem">Player Search &amp; Profiles</h1></div></div>' +
      '<div class="flex-wrap"><input class="input" style="max-width:360px" id="pl-search-in" value="' + esc(appState.playerQuery) + '" placeholder="Search Messi, Ronaldo, Yamal, Bellingham...">' +
      '<button class="btn-primary" id="pl-search-go">Search</button></div>' +
      '<div class="flex-wrap">' + ['Lionel Messi', 'Kylian Mbappé', 'Lamine Yamal', 'Mohamed Salah', 'Hassan Maatouk'].map(function (n) {
        return '<button class="tab-chip" data-pl-quick="' + esc(n) + '">' + esc(n) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="grid-3">' +
      (appState.playerResults.length ? appState.playerResults.map(function (p) {
        return '<div class="card-sm stack-sm"><div class="flex-wrap">' +
          (p.photo ? '<img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" style="width:52px;height:52px;border-radius:12px;object-fit:cover;background:#07090f">' : '<div class="team-crest-fallback">⚽</div>') +
          '<div><strong>' + esc(p.name) + '</strong><div class="text-muted" style="font-size:0.75rem">' + esc(p.currentClub) + ' · ' + esc(p.position) + '</div></div></div>' +
          '<button class="btn-secondary btn-sm" data-pl-detail="' + esc(p.id) + '">View Bio &amp; Career</button></div>';
      }).join('') : '<div class="card">Search any international footballer to inspect verified club &amp; bio details.</div>') +
      '</div></div>';

    var go = document.getElementById('pl-search-go');
    var inp = document.getElementById('pl-search-in');
    if (go && inp) go.onclick = function () { appState.playerQuery = inp.value; runPlayerSearch(inp.value); };
    el.querySelectorAll('[data-pl-quick]').forEach(function (b) {
      b.onclick = function () { appState.playerQuery = b.getAttribute('data-pl-quick'); runPlayerSearch(appState.playerQuery); };
    });
    el.querySelectorAll('[data-pl-detail]').forEach(function (b) {
      b.onclick = async function () {
        var pid = b.getAttribute('data-pl-detail');
        openModal('<div class="stack-md"><h3>Loading Player Profile...</h3></div>');
        try {
          var p = await window.STR_API.fetchPlayerDetail(pid);
          openModal('<div class="stack-md"><div class="flex-between"><h2>' + esc(p.name) + '</h2><button class="btn-secondary btn-sm" id="modal-close-btn">✕</button></div>' +
            '<div class="flex-wrap">' + (p.photo ? '<img src="' + esc(p.photo) + '" style="width:84px;height:84px;border-radius:16px;object-fit:cover">' : '') +
            '<div><div class="badge-accent">' + esc(p.currentClub) + '</div><div>Nationality: ' + esc(p.nationality) + ' · Position: ' + esc(p.position) + '</div>' +
            (p.shirtNumber ? '<div class="text-muted">Shirt #' + esc(p.shirtNumber) + ' · Height: ' + esc(p.height) + '</div>' : '') + '</div></div>' +
            '<p style="font-size:0.84rem;line-height:1.6">' + esc((p.description || 'Verified player profile from TheSportsDB.').slice(0, 700)) + '</p></div>');
          document.getElementById('modal-close-btn').onclick = closeModal;
        } catch (e) {
          openModal('<div class="stack-md"><h3>Profile Unavailable</h3><p>' + esc(e.message) + '</p><button class="btn-secondary btn-sm" id="modal-close-btn">Close</button></div>');
          document.getElementById('modal-close-btn').onclick = closeModal;
        }
      };
    });
  }

  function renderAiCenter(el) {
    var apiBase = (window.STR_CONFIG && window.STR_CONFIG.API_BASE) || '';
    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="card stack-md"><span class="badge-accent">TACTICAL &amp; MATCH ASSISTANT</span><h1 class="font-display" style="margin:2px 0 0;font-size:2rem">STR AI Match Analyst</h1>' +
      '<p class="text-muted" style="margin:0">Connects securely to your STR SCORES server-side proxy (<code>/api/ai/analyze</code>) so your Gemini API key never leaks into static client files.</p>' +
      '<div class="flex-wrap"><input class="input" style="max-width:380px" id="ai-base-in" placeholder="Optional Backend URL (e.g. https://your-str-server.run.app)" value="' + esc(apiBase) + '">' +
      '<button class="btn-secondary btn-sm" id="ai-save-base">Save Backend URL</button></div>' +
      '<div class="flex-wrap"><input class="input" id="ai-prompt-in" placeholder="Ask about formation counters, pressing intensity, xG matchups...">' +
      '<button class="btn-primary" id="ai-ask-btn">' + (appState.aiLoading ? 'Analyzing...' : 'Analyze with STR AI') + '</button></div></div>' +
      '<div class="stack-md">' +
      (appState.aiHistory.length ? appState.aiHistory.map(function (item) {
        return '<div class="card stack-sm"><div class="badge-accent">QUERY: ' + esc(item.q) + '</div><div style="white-space:pre-wrap;font-size:0.86rem;line-height:1.55">' + esc(item.a) + '</div></div>';
      }).join('') : '<div class="card">Submit any tactical or match question above. If hosted on pure static storage without a Node server, set your STR Backend URL above or open this site via your Node/Express host.</div>') +
      '</div></div>';

    document.getElementById('ai-save-base').onclick = function () {
      var val = document.getElementById('ai-base-in').value.trim().replace(/\/+$/, '');
      window.STR_CONFIG.API_BASE = val;
      localStorage.setItem('str_standalone_api_base', val);
      toast('Backend URL saved!', 'success');
    };
    document.getElementById('ai-ask-btn').onclick = async function () {
      var q = document.getElementById('ai-prompt-in').value.trim();
      if (!q) return;
      appState.aiLoading = true;
      renderAiCenter(el);
      try {
        var res = await window.STR_API.askAiAnalyst({ prompt: q, question: q, lang: appState.lang });
        var ans = res.summary || res.answer || res.tacticalAnalysis || JSON.stringify(res, null, 2);
        appState.aiHistory.unshift({ q: q, a: ans });
      } catch (err) {
        appState.aiHistory.unshift({ q: q, a: 'Backend /api/ai/analyze unreachable from current origin (' + err.message + '). Configure your STR Server URL above to enable Gemini AI analysis without exposing API keys.' });
      } finally {
        appState.aiLoading = false;
        renderAiCenter(el);
      }
    };
  }

  function renderNews(el) {
    var fb = window.STR_FB && window.STR_FB.getState();
    var savedList = (fb && fb.user && fb.savedArticles.length) ? fb.savedArticles : appState.localSavedNews;
    var list = appState.newsTab === 'saved' ? savedList : appState.newsArticles;

    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="flex-between"><div><span class="badge-accent">GLOBAL NEWSWIRE</span><h1 class="font-display" style="margin:2px 0 0;font-size:2rem">Football &amp; Gaming News</h1></div>' +
      '<div class="flex-wrap">' +
      [['football', '⚽ Football'], ['gaming', '🎮 Gaming'], ['saved', '🔖 Saved (' + savedList.length + ')']].map(function (t) {
        return '<button class="tab-chip ' + (appState.newsTab === t[0] ? 'active' : '') + '" data-ntab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div></div>' +
      (appState.newsTab === 'football' ? '<div class="flex-wrap">' +
        ['all', 'Breaking', 'Transfers', 'International'].map(function (c) {
          return '<button class="tab-chip ' + (appState.newsCat === c ? 'active' : '') + '" data-ncat="' + c + '">' + c + '</button>';
        }).join('') + '</div>' : '') +
      '<div class="grid-3">' +
      (list.length ? list.map(function (a, i) {
        var img = a.imageUrl || window.STR_CONFIG.NEWS_FALLBACK_IMG;
        return '<div class="card-sm stack-sm"><img src="' + esc(img) + '" alt="' + esc(a.title) + '" style="width:100%;height:150px;object-fit:cover;border-radius:12px" onerror="this.src=\'' + window.STR_CONFIG.NEWS_FALLBACK_IMG + '\'">' +
          '<div class="badge-accent">' + esc(a.source || 'News') + '</div>' +
          '<h4 style="margin:0">' + esc(a.title) + '</h4>' +
          '<p class="text-muted" style="font-size:0.78rem;margin:0">' + esc((a.description || '').slice(0, 120)) + '</p>' +
          '<div class="flex-between"><a href="' + esc(a.url) + '" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm">Read Story ↗</a>' +
          '<button class="btn-primary btn-sm" data-save-news="' + i + '">🔖 Save</button></div></div>';
      }).join('') : '<div class="card">Loading or no stories found for this filter.</div>') +
      '</div></div>';

    el.querySelectorAll('[data-ntab]').forEach(function (b) {
      b.onclick = function () { appState.newsTab = b.getAttribute('data-ntab'); if (appState.newsTab === 'saved') renderNews(el); else loadNews(); };
    });
    el.querySelectorAll('[data-ncat]').forEach(function (b) {
      b.onclick = function () { appState.newsCat = b.getAttribute('data-ncat'); loadNews(); };
    });
    el.querySelectorAll('[data-save-news]').forEach(function (b) {
      b.onclick = async function () {
        var art = list[Number(b.getAttribute('data-save-news'))];
        if (!art) return;
        if (window.STR_FB && window.STR_FB.getState().user) {
          await window.STR_FB.toggleSavedArticle(art);
        } else {
          var exists = appState.localSavedNews.some(function (s) { return s.title === art.title; });
          if (!exists) appState.localSavedNews.unshift(art);
          localStorage.setItem('str_standalone_saved_news', JSON.stringify(appState.localSavedNews));
        }
        toast('Bookmark updated!', 'success');
        renderNews(el);
      };
    });
  }

  function renderCommunity(el) {
    var fb = window.STR_FB && window.STR_FB.getState();
    var signedIn = Boolean(fb && fb.user);
    var msgs = signedIn ? fb.messages : appState.localMessages;
    var rooms = (signedIn && fb.chats.length) ? fb.chats : [
      { id: 'channel_global', name: 'STR Matchday Lounge', type: 'channel' },
      { id: 'channel_realmadrid', name: 'Real Madrid Supporters', type: 'channel' },
      { id: 'channel_lebanon', name: 'Lebanese Football & Cedars', type: 'channel' }
    ];
    var activeRoom = (fb && fb.activeChatId) || 'channel_global';

    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="card flex-between"><div><span class="badge-accent">REAL-TIME STR CHAT &amp; FRIENDS</span><h1 class="font-display" style="margin:2px 0 0;font-size:2rem">Supporter Community</h1></div>' +
      (!signedIn ? '<button class="btn-primary btn-sm" id="comm-signin">Sign In for Cloud Chat &amp; Friends</button>' : '<span class="text-emerald" style="font-weight:700">● Connected as ' + esc((fb.profile && fb.profile.displayName) || fb.user.email) + '</span>') + '</div>' +
      '<div class="grid-2">' +
      '<div class="card stack-md"><h3>Channels &amp; Direct Chats</h3>' +
      '<div class="stack-sm">' + rooms.map(function (r) {
        return '<button class="card-subtle flex-between" style="cursor:pointer;border-color:' + (activeRoom === r.id ? 'var(--crimson)' : 'var(--border)') + '" data-chat-room="' + esc(r.id) + '"><strong>💬 ' + esc(r.name) + '</strong><span class="badge-accent">' + esc(r.type) + '</span></button>';
      }).join('') + '</div>' +
      '<hr style="border:0;border-top:1px solid var(--border)">' +
      '<h4>Find Friends</h4><div class="flex-wrap"><input class="input" id="fr-search-in" placeholder="Search username..."><button class="btn-secondary btn-sm" id="fr-search-btn">Search</button></div><div id="fr-results" class="stack-sm"></div>' +
      (signedIn && fb.requests.length ? '<h4>Incoming Friend Requests</h4>' + fb.requests.map(function (req) {
        return '<div class="card-subtle flex-between"><span>' + esc(req.fromName) + '</span><div class="flex-wrap"><button class="btn-primary btn-sm" data-req-acc="' + esc(req.id) + ':' + esc(req.fromUid) + ':' + esc(req.fromName) + '">Accept</button><button class="btn-secondary btn-sm" data-req-rej="' + esc(req.id) + '">Reject</button></div></div>';
      }).join('') : '') +
      '</div>' +
      '<div class="card stack-md"><h3>Messages · ' + esc(activeRoom) + '</h3>' +
      '<div class="stack-sm" style="max-height:320px;overflow-y:auto">' +
      (msgs.length ? msgs.map(function (m) {
        return '<div class="card-subtle"><strong>' + esc(m.senderName || 'Fan') + ':</strong> <span>' + esc(m.text) + '</span></div>';
      }).join('') : '<p class="text-muted">No messages yet in this room. Say hello!</p>') +
      '</div>' +
      '<form id="chat-send-form" class="flex-wrap"><input class="input" id="chat-msg-in" placeholder="Write a message..." required><button class="btn-primary" type="submit">Send</button></form>' +
      '</div></div></div>';

    var cs = document.getElementById('comm-signin'); if (cs) cs.onclick = function () { openAuthModal('signin'); };
    el.querySelectorAll('[data-chat-room]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-chat-room');
        if (window.STR_FB) window.STR_FB.subscribeChatMessages(id);
        renderCommunity(el);
      };
    });
    var cform = document.getElementById('chat-send-form');
    if (cform) cform.onsubmit = async function (e) {
      e.preventDefault();
      var txt = document.getElementById('chat-msg-in').value.trim();
      if (!txt) return;
      if (signedIn && window.STR_FB) {
        try { await window.STR_FB.sendMessage(activeRoom, txt); document.getElementById('chat-msg-in').value = ''; }
        catch (err) { toast(err.message, 'error'); }
      } else {
        appState.localMessages.push({ senderName: 'Guest Fan', text: txt });
        document.getElementById('chat-msg-in').value = '';
        renderCommunity(el);
      }
    };
    var fsb = document.getElementById('fr-search-btn');
    if (fsb) fsb.onclick = async function () {
      if (!signedIn) { toast('Sign in first to search users & send friend requests.', 'error'); return; }
      var q = document.getElementById('fr-search-in').value;
      var users = await window.STR_FB.searchUsers(q);
      var out = document.getElementById('fr-results');
      out.innerHTML = users.slice(0, 5).map(function (u) {
        return '<div class="card-subtle flex-between"><span>' + esc(u.displayName) + ' (@' + esc(u.username) + ')</span><button class="btn-primary btn-sm" data-add-uid="' + esc(u.uid) + '" data-add-name="' + esc(u.displayName) + '">Add Friend</button></div>';
      }).join('') || '<span class="text-muted">No matching supporters found.</span>';
      out.querySelectorAll('[data-add-uid]').forEach(function (btn) {
        btn.onclick = async function () {
          await window.STR_FB.sendFriendRequest({ uid: btn.getAttribute('data-add-uid'), displayName: btn.getAttribute('data-add-name') });
          toast('Friend request sent!', 'success');
        };
      });
    };
    el.querySelectorAll('[data-req-acc]').forEach(function (b) {
      b.onclick = async function () {
        var p = b.getAttribute('data-req-acc').split(':');
        await window.STR_FB.respondFriendRequest(p[0], 'accepted', p[1], p[2]);
        toast('Friend request accepted!', 'success');
      };
    });
    el.querySelectorAll('[data-req-rej]').forEach(function (b) {
      b.onclick = async function () {
        await window.STR_FB.respondFriendRequest(b.getAttribute('data-req-rej'), 'rejected');
        toast('Request declined', 'info');
      };
    });
  }

  function renderStats(el) {
    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="flex-between"><div><span class="badge-accent">OFFICIAL LEAGUE TABLES</span><h1 class="font-display" style="margin:2px 0 0;font-size:2rem">League Standings &amp; Statistics</h1></div></div>' +
      '<div class="filter-row">' + window.STR_DATA.LEAGUES_CATALOG.map(function (l) {
        return '<button class="tab-chip ' + (appState.standingsLeague === l.id ? 'active' : '') + '" data-st-lg="' + l.id + '">' + esc(l.name) + '</button>';
      }).join('') + '</div>' +
      '<div class="card table-wrap">' +
      (appState.standingsData.length
        ? '<table class="str-table"><thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>PTS</th></tr></thead><tbody>' +
          appState.standingsData.map(function (r) {
            return '<tr><td class="font-mono-tabular"><strong>' + r.rank + '</strong></td><td><div class="flex-wrap">' + (r.teamLogo ? '<img src="' + esc(r.teamLogo) + '" style="width:20px;height:20px;object-fit:contain">' : '') + '<span>' + esc(r.teamName) + '</span></div></td><td class="font-mono-tabular">' + r.played + '</td><td class="font-mono-tabular">' + r.wins + '</td><td class="font-mono-tabular">' + r.draws + '</td><td class="font-mono-tabular">' + r.losses + '</td><td class="font-mono-tabular">' + r.goalDiff + '</td><td class="font-mono-tabular"><strong>' + r.points + '</strong></td></tr>';
          }).join('') + '</tbody></table>'
        : '<p class="text-muted">Loading official standings from ESPN / TheSportsDB...</p>') +
      '</div></div>';
    el.querySelectorAll('[data-st-lg]').forEach(function (b) {
      b.onclick = function () { appState.standingsLeague = b.getAttribute('data-st-lg'); loadStandings(); };
    });
  }

  function renderFantasy(el) {
    var pool = window.STR_DATA.FANTASY_POOL || [];
    var picked = appState.fantasyIds.map(function (id) { return pool.find(function (p) { return p.id === id; }); }).filter(Boolean);
    var cost = picked.reduce(function (s, p) { return s + Number(p.price || 0); }, 0);
    var pts = picked.reduce(function (s, p) { return s + Number(p.formPts || 0); }, 0);
    var upcoming = appState.matches.filter(function (m) { return m.status === 'UPCOMING'; }).slice(0, 4);

    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="grid-2">' +
      '<div class="card stack-md"><div class="flex-between"><div><span class="badge-accent">STR FANTASY SQUAD</span><h2 style="margin:2px 0 0">' + esc(appState.fantasyName) + '</h2></div>' +
      '<div class="font-mono-tabular"><strong>€' + cost.toFixed(1) + 'M / €100M</strong> · <span class="text-emerald">' + pts + ' Pts</span></div></div>' +
      '<div class="flex-wrap"><input class="input" style="max-width:220px" id="fan-name" value="' + esc(appState.fantasyName) + '">' +
      '<select class="select" style="max-width:130px" id="fan-form">' + ['4-3-3', '4-4-2', '3-5-2'].map(function (f) { return '<option' + (appState.fantasyFormation === f ? ' selected' : '') + '>' + f + '</option>'; }).join('') + '</select>' +
      '<button class="btn-primary btn-sm" id="fan-save">Save XI</button></div>' +
      '<div class="grid-2" style="max-height:320px;overflow-y:auto">' +
      pool.map(function (p) {
        var on = appState.fantasyIds.indexOf(p.id) >= 0;
        return '<button class="card-subtle flex-between" style="cursor:pointer;border-color:' + (on ? 'var(--crimson)' : 'var(--border)') + '" data-fan-pick="' + esc(p.id) + '">' +
          '<span style="text-align:left"><strong>' + esc(p.name) + '</strong><br><small class="text-muted">' + esc(p.position) + ' · ' + esc(p.club) + '</small></span>' +
          '<strong class="font-mono-tabular">€' + p.price + 'M</strong></button>';
      }).join('') + '</div></div>' +
      '<div class="card stack-md"><h3>Match Score Predictions</h3><p class="text-muted">Submit exact-score predictions for upcoming fixtures.</p>' +
      (upcoming.length ? upcoming.map(function (m) {
        return '<div class="card-subtle stack-sm"><strong>' + esc(m.home.shortName) + ' vs ' + esc(m.away.shortName) + '</strong>' +
          '<div class="flex-wrap"><input type="number" min="0" max="15" value="2" class="input" style="width:68px" id="pr-h-' + esc(m.id) + '">' +
          '<span>:</span><input type="number" min="0" max="15" value="1" class="input" style="width:68px" id="pr-a-' + esc(m.id) + '">' +
          '<button class="btn-primary btn-sm" data-pred-id="' + esc(m.id) + '" data-pred-title="' + esc(m.home.shortName + ' vs ' + m.away.shortName) + '">Predict</button></div></div>';
      }).join('') : '<p class="text-muted">Visit Scores and select Tomorrow to load upcoming fixtures for predictions.</p>') +
      '<h4>Recent Predictions</h4>' +
      appState.localPreds.slice(0, 5).map(function (pr) {
        return '<div class="card-subtle flex-between"><span>' + esc(pr.title) + '</span><strong class="font-mono-tabular">' + pr.homeScore + ' - ' + pr.awayScore + '</strong></div>';
      }).join('') + '</div></div></div>';

    el.querySelectorAll('[data-fan-pick]').forEach(function (b) {
      b.onclick = function () {
        var pid = b.getAttribute('data-fan-pick');
        var i = appState.fantasyIds.indexOf(pid);
        if (i >= 0) appState.fantasyIds.splice(i, 1);
        else if (appState.fantasyIds.length < 15) appState.fantasyIds.push(pid);
        else toast('Maximum 15 squad players.', 'error');
        renderFantasy(el);
      };
    });
    document.getElementById('fan-save').onclick = async function () {
      appState.fantasyName = document.getElementById('fan-name').value || 'STR XI';
      appState.fantasyFormation = document.getElementById('fan-form').value;
      if (window.STR_FB && window.STR_FB.getState().user) {
        await window.STR_FB.saveFantasy(appState.fantasyName, appState.fantasyFormation, appState.fantasyIds, pts);
      }
      toast('Fantasy squad saved!', 'success');
    };
    el.querySelectorAll('[data-pred-id]').forEach(function (b) {
      b.onclick = async function () {
        var id = b.getAttribute('data-pred-id');
        var title = b.getAttribute('data-pred-title');
        var hs = Number(document.getElementById('pr-h-' + id).value || 0);
        var as = Number(document.getElementById('pr-a-' + id).value || 0);
        appState.localPreds.unshift({ matchId: id, title: title, homeScore: hs, awayScore: as });
        localStorage.setItem('str_standalone_preds', JSON.stringify(appState.localPreds));
        if (window.STR_FB && window.STR_FB.getState().user) await window.STR_FB.savePrediction(id, title, hs, as);
        toast('Prediction locked in!', 'success');
        renderFantasy(el);
      };
    });
  }

  function renderVote(el) {
    var fb = window.STR_FB && window.STR_FB.getState();
    var polls = (fb && fb.polls.length) ? fb.polls : appState.localPolls;
    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="card flex-between"><div><span class="badge-accent">STR VOTE · FAN POLLS</span><h1 class="font-display" style="margin:2px 0 0;font-size:2rem">Community Voting Arena</h1></div></div>' +
      '<div class="card stack-sm"><h4>Create New Fan Poll</h4><div class="flex-wrap">' +
      '<input class="input" id="poll-title-in" placeholder="Poll question (e.g. Best Midfielder in Europe?)">' +
      '<input class="input" id="poll-opts-in" placeholder="Comma-separated options (Pedri, Bellingham, Wirtz, Vitinha)">' +
      '<button class="btn-primary btn-sm" id="poll-create-btn">Publish Poll</button></div></div>' +
      '<div class="grid-2">' + polls.map(function (p) {
        var votedIdx = appState.localVotes[p.id];
        return '<div class="card stack-sm"><div class="flex-between"><span class="badge-accent">' + esc(p.category) + '</span><span class="text-muted font-mono-tabular">' + (p.totalVotes || 0) + ' votes</span></div>' +
          '<h3 style="margin:0">' + esc(p.title) + '</h3>' +
          p.options.map(function (opt, i) {
            var c = (p.counts && p.counts[i]) || 0;
            var pct = p.totalVotes ? Math.round((c / p.totalVotes) * 100) : 0;
            return '<button class="card-subtle flex-between" style="cursor:pointer;border-color:' + (votedIdx === i ? 'var(--crimson)' : 'var(--border)') + '" data-vote-poll="' + esc(p.id) + '" data-vote-idx="' + i + '">' +
              '<span>' + esc(opt) + '</span><strong class="font-mono-tabular">' + pct + '%</strong></button>';
          }).join('') + '</div>';
      }).join('') + '</div></div>';

    document.getElementById('poll-create-btn').onclick = async function () {
      var title = document.getElementById('poll-title-in').value.trim();
      var opts = document.getElementById('poll-opts-in').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (title.length < 3 || opts.length < 2) { toast('Enter a title and at least 2 options.', 'error'); return; }
      if (fb && fb.user) {
        try { await window.STR_FB.createPoll(title, 'community', opts); toast('Poll published to cloud!', 'success'); }
        catch (err) { toast(err.message, 'error'); }
      } else {
        appState.localPolls.unshift({ id: 'lp-' + Date.now(), category: 'community', title: title, options: opts, counts: opts.map(function () { return 0; }), totalVotes: 0 });
        toast('Poll published locally!', 'success');
        renderVote(el);
      }
    };
    el.querySelectorAll('[data-vote-poll]').forEach(function (b) {
      b.onclick = async function () {
        var pid = b.getAttribute('data-vote-poll');
        var idx = Number(b.getAttribute('data-vote-idx'));
        if (fb && fb.user && fb.polls.some(function (x) { return x.id === pid; })) {
          try { await window.STR_FB.votePoll(pid, idx); toast('Vote recorded!', 'success'); }
          catch (err) { toast(err.message, 'error'); }
        } else {
          if (appState.localVotes[pid] !== undefined) { toast('Already voted on this poll.', 'error'); return; }
          var tgt = appState.localPolls.find(function (x) { return x.id === pid; });
          if (tgt) { tgt.counts[idx]++; tgt.totalVotes++; }
          appState.localVotes[pid] = idx;
          localStorage.setItem('str_standalone_votes', JSON.stringify(appState.localVotes));
          toast('Vote counted!', 'success');
          renderVote(el);
        }
      };
    });
  }

  function renderExplore(el) {
    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="card"><span class="badge-accent">FOOTBALL ENCYCLOPEDIA</span><h1 class="font-display" style="margin:2px 0 0;font-size:2rem">Tactics Glossary &amp; World Stadiums</h1></div>' +
      '<div class="grid-2">' +
      '<div class="card stack-sm"><h3>Tactical &amp; Analytics Glossary</h3>' +
      window.STR_DATA.FOOTBALL_GLOSSARY.map(function (g) {
        return '<div class="card-subtle"><div class="badge-accent">' + esc(g.category) + '</div><strong>' + esc(g.term) + '</strong><p class="text-muted" style="font-size:0.78rem;margin:4px 0 0">' + esc(g.definition) + '</p></div>';
      }).join('') + '</div>' +
      '<div class="card stack-sm"><h3>Iconic Football Stadiums</h3>' +
      window.STR_DATA.STADIUMS_DIRECTORY.map(function (s) {
        return '<div class="card-subtle"><strong>' + esc(s.name) + '</strong> · <span class="badge-accent">' + esc(s.capacity) + '</span><div class="text-muted" style="font-size:0.78rem">' + esc(s.city) + ' — ' + esc(s.clubs) + '</div></div>';
      }).join('') + '</div></div></div>';
  }

  function renderProfile(el) {
    var fb = window.STR_FB && window.STR_FB.getState();
    var user = fb && fb.user;
    var prof = fb && fb.profile;
    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="card flex-between"><div class="flex-wrap"><img src="' + window.STR_CONFIG.AVATAR_DEFAULT_IMG + '" alt="Profile" style="width:64px;height:64px;border-radius:16px;object-fit:cover">' +
      '<div><h1 class="font-display" style="margin:0">' + esc(user ? ((prof && prof.displayName) || user.displayName || 'STR Supporter') : 'Guest Supporter') + '</h1>' +
      '<div class="text-muted" style="font-size:0.82rem">' + esc(user ? user.email : 'Local Browser Storage Mode — Sign In for Cloud Sync') + '</div></div></div>' +
      (user ? '<button class="btn-secondary" id="prof-signout">Sign Out</button>' : '<button class="btn-primary" id="prof-signin">Sign In / Create Account</button>') + '</div>' +
      '<div class="grid-2">' +
      '<div class="card stack-md"><h3>Preferences &amp; Favorite Clubs</h3>' +
      '<div class="flex-wrap">' + appState.favClubs.map(function (c) { return '<span class="tab-chip active">' + esc(c) + '</span>'; }).join('') + '</div>' +
      '<button class="btn-secondary btn-sm" id="prof-favs">Edit Favorite Clubs</button>' +
      (user ? '<form id="prof-form" class="stack-sm"><input class="input" id="prof-name" value="' + esc((prof && prof.displayName) || '') + '" placeholder="Display Name"><textarea class="textarea" id="prof-bio" rows="2" placeholder="Bio">' + esc((prof && prof.bio) || '') + '</textarea><button class="btn-primary btn-sm" type="submit">Save Cloud Profile</button></form>' : '') +
      '</div>' +
      '<div class="card stack-md"><h3>Display &amp; Standalone Settings</h3>' +
      '<div class="flex-wrap"><button class="btn-secondary btn-sm" id="prof-theme">Switch to ' + (appState.theme === 'dark' ? 'Light' : 'Dark') + ' Mode</button>' +
      '<button class="btn-secondary btn-sm" id="prof-lang">Switch Language (' + (appState.lang === 'en' ? 'Arabic' : 'English') + ')</button></div>' +
      '<p class="text-muted" style="font-size:0.78rem">STR SCORES Standalone Edition runs on any static web server (Netlify, Vercel, GitHub Pages, Cloudflare Pages) or Node/Express backend.</p>' +
      '</div></div></div>';

    var psi = document.getElementById('prof-signin'); if (psi) psi.onclick = function () { openAuthModal('signin'); };
    var pso = document.getElementById('prof-signout'); if (pso) pso.onclick = async function () { await window.STR_FB.signOut(); renderProfile(el); };
    var pfv = document.getElementById('prof-favs'); if (pfv) pfv.onclick = openFavClubsModal;
    var pth = document.getElementById('prof-theme'); if (pth) pth.onclick = function () { document.getElementById('btn-toggle-theme').click(); renderProfile(el); };
    var plg = document.getElementById('prof-lang'); if (plg) plg.onclick = function () { document.getElementById('btn-toggle-lang').click(); renderProfile(el); };
    var pfm = document.getElementById('prof-form');
    if (pfm) pfm.onsubmit = async function (e) {
      e.preventDefault();
      await window.STR_FB.updateProfile(document.getElementById('prof-name').value, document.getElementById('prof-bio').value, appState.favClubs);
      toast('Cloud profile saved!', 'success');
    };
  }

  function renderCurrentView() {
    var el = document.getElementById('app-main');
    if (!el) return;
    window.STR_CURRENT_VIEW = appState.view;
    if (appState.view !== 'simulator' && window.STR_SIMULATOR && window.STR_SIMULATOR.stop) {
      window.STR_SIMULATOR.stop();
    }
    document.querySelectorAll('[data-nav]').forEach(function (n) {
      n.classList.toggle('active', n.getAttribute('data-nav') === appState.view);
    });
    updateHeaderAuth();

    if (appState.view === 'home') renderHome(el);
    else if (appState.view === 'scores') renderScores(el);
    else if (appState.view === 'simulator' && window.STR_SIMULATOR) window.STR_SIMULATOR.render(el);
    else if (appState.view === 'games' && window.STR_GAMES) window.STR_GAMES.render(el);
    else if (appState.view === 'cards' && window.STR_CARDS) window.STR_CARDS.render(el);
    else if (appState.view === 'players') renderPlayers(el);
    else if (appState.view === 'ai') renderAiCenter(el);
    else if (appState.view === 'news') renderNews(el);
    else if (appState.view === 'community') renderCommunity(el);
    else if (appState.view === 'stats') renderStats(el);
    else if (appState.view === 'fantasy') renderFantasy(el);
    else if (appState.view === 'vote') renderVote(el);
    else if (appState.view === 'extra') renderExplore(el);
    else if (appState.view === 'profile') renderProfile(el);
  }

  function navigate(view) {
    appState.view = view || 'home';
    location.hash = '#' + appState.view;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderCurrentView();
    if (appState.view === 'news' && !appState.newsArticles.length) loadNews();
    if (appState.view === 'stats' && !appState.standingsData.length) loadStandings();
    if (appState.view === 'players' && !appState.playerResults.length) runPlayerSearch(appState.playerQuery);
  }

  function init() {
    applyThemeAndLang();
    var ws = document.getElementById('welcome-screen');
    var shell = document.getElementById('app-shell');
    if (appState.entered) {
      if (ws) ws.classList.add('hidden');
      if (shell) shell.classList.remove('hidden');
    } else {
      if (ws) ws.classList.remove('hidden');
      if (shell) shell.classList.add('hidden');
    }

    document.getElementById('btn-enter-guest').onclick = function () {
      appState.entered = true;
      localStorage.setItem('str_standalone_entered', 'true');
      ws.classList.add('hidden');
      shell.classList.remove('hidden');
      navigate('home');
    };
    document.getElementById('btn-welcome-signin').onclick = function () {
      appState.entered = true;
      localStorage.setItem('str_standalone_entered', 'true');
      ws.classList.add('hidden');
      shell.classList.remove('hidden');
      navigate('home');
      openAuthModal('signin');
    };

    document.querySelectorAll('[data-nav]').forEach(function (n) {
      n.onclick = function () { navigate(n.getAttribute('data-nav')); };
    });
    document.getElementById('btn-toggle-theme').onclick = function () {
      appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('str_standalone_theme', appState.theme);
      applyThemeAndLang();
    };
    document.getElementById('btn-toggle-lang').onclick = function () {
      appState.lang = appState.lang === 'en' ? 'ar' : 'en';
      localStorage.setItem('str_standalone_lang', appState.lang);
      applyThemeAndLang();
    };
    document.getElementById('btn-open-search').onclick = openSearchModal;
    document.getElementById('modal-root').onclick = function (e) {
      if (e.target && e.target.id === 'modal-root') closeModal();
    };

    window.addEventListener('str:fb-update', function () {
      updateHeaderAuth();
      if (['community', 'vote', 'profile', 'news', 'fantasy'].indexOf(appState.view) >= 0) renderCurrentView();
    });

    var hashView = (location.hash || '#home').replace('#', '');
    if (['home', 'scores', 'simulator', 'community', 'games', 'news', 'cards', 'players', 'ai', 'stats', 'fantasy', 'vote', 'extra', 'profile'].indexOf(hashView) >= 0) {
      appState.view = hashView;
    }
    loadScores();
    renderCurrentView();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
