(function () {
  var memCache = {};

  function getCached(key) {
    var item = memCache[key];
    if (item && item.expires > Date.now()) return item.data;
    return null;
  }

  function setCached(key, data, ttlMs) {
    memCache[key] = { data: data, expires: Date.now() + ttlMs };
  }

  function fetchJson(url, timeoutMs) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000) : null;
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function mapEspnStatus(state, detail) {
    var d = String(detail || '').toUpperCase();
    if (d.indexOf('HT') >= 0 || d.indexOf('HALFTIME') >= 0) return 'HT';
    if (state === 'in') return 'LIVE';
    if (state === 'post') return d.indexOf('POSTPONED') >= 0 ? 'POSTPONED' : 'FT';
    return 'UPCOMING';
  }

  function parseEspnScoreboard(raw, leagueMeta) {
    var leagueObj = raw && raw.leagues && raw.leagues[0];
    var leagueLogo = leagueObj && leagueObj.logos && leagueObj.logos[0] ? leagueObj.logos[0].href : '';
    var events = Array.isArray(raw && raw.events) ? raw.events : [];

    return events.map(function (ev) {
      var comp = (ev.competitions && ev.competitions[0]) || {};
      var competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
      var homeRaw = competitors.find(function (c) { return c.homeAway === 'home'; }) || competitors[0] || {};
      var awayRaw = competitors.find(function (c) { return c.homeAway === 'away'; }) || competitors[1] || {};
      var statusObj = comp.status || ev.status || {};
      var statusType = statusObj.type || {};
      var status = mapEspnStatus(statusType.state, statusType.shortDetail || statusType.description);
      var parseScore = function (v) {
        if (status === 'UPCOMING') return null;
        var n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      return {
        id: String(ev.id),
        leagueId: leagueMeta.id,
        leagueName: (leagueObj && leagueObj.name) || leagueMeta.name,
        leagueCountry: leagueMeta.country || '',
        leagueLogo: leagueLogo,
        date: ev.date || '',
        status: status,
        clock: statusObj.displayClock || statusType.shortDetail || '',
        venue: (comp.venue && comp.venue.fullName) || '',
        city: (comp.venue && comp.venue.address && comp.venue.address.city) || '',
        home: {
          id: String((homeRaw.team && homeRaw.team.id) || ''),
          name: (homeRaw.team && (homeRaw.team.displayName || homeRaw.team.name)) || 'Home',
          shortName: (homeRaw.team && (homeRaw.team.shortDisplayName || homeRaw.team.name)) || 'Home',
          abbreviation: (homeRaw.team && homeRaw.team.abbreviation) || 'HOM',
          logo: (homeRaw.team && homeRaw.team.logo) || '',
          score: parseScore(homeRaw.score),
          winner: Boolean(homeRaw.winner)
        },
        away: {
          id: String((awayRaw.team && awayRaw.team.id) || ''),
          name: (awayRaw.team && (awayRaw.team.displayName || awayRaw.team.name)) || 'Away',
          shortName: (awayRaw.team && (awayRaw.team.shortDisplayName || awayRaw.team.name)) || 'Away',
          abbreviation: (awayRaw.team && awayRaw.team.abbreviation) || 'AWY',
          logo: (awayRaw.team && awayRaw.team.logo) || '',
          score: parseScore(awayRaw.score),
          winner: Boolean(awayRaw.winner)
        },
        source: 'ESPN Soccer Feed'
      };
    });
  }

  function apiBase() {
    var cfg = window.STR_CONFIG || {};
    if (cfg.API_BASE) return cfg.API_BASE.replace(/\/+$/, '');
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      return '';
    }
    return '';
  }

  async function fetchScoreboard(leagueId, dateCompact) {
    var key = 'sb:' + leagueId + ':' + (dateCompact || 'today');
    var cached = getCached(key);
    if (cached) return cached;

    var base = apiBase();
    if (base || location.pathname.indexOf('/standalone') === 0 || location.port === '3000') {
      try {
        var r = await fetchJson(base + '/api/football/scoreboard?league=' + encodeURIComponent(leagueId) + '&date=' + encodeURIComponent(dateCompact || ''), 5500);
        if (r && Array.isArray(r.matches)) {
          setCached(key, r, 30000);
          return r;
        }
      } catch (e) {}
    }

    var leagues = window.STR_DATA.LEAGUES_CATALOG;
    var targets = leagueId === 'all'
      ? leagues.filter(function (l) { return l.id !== 'lbn.1'; })
      : leagues.filter(function (l) { return l.id === leagueId && l.id !== 'lbn.1'; });

    var dq = dateCompact ? '?dates=' + dateCompact : '';
    var errors = [];
    var batches = await Promise.all(
      targets.map(function (lg) {
        return fetchJson('https://site.api.espn.com/apis/site/v2/sports/soccer/' + encodeURIComponent(lg.id) + '/scoreboard' + dq, 7000)
          .then(function (data) { return parseEspnScoreboard(data, lg); })
          .catch(function (err) {
            errors.push(lg.name + ': ' + err.message);
            return [];
          });
      })
    );

    var matches = [].concat.apply([], batches);

    if (leagueId === 'all' || leagueId === 'lbn.1') {
      try {
        var lbnPast = await fetchJson('https://www.thesportsdb.com/api/v1/json/123/eventspastleague.php?id=4702', 6500);
        var lbnNext = await fetchJson('https://www.thesportsdb.com/api/v1/json/123/eventsnextleague.php?id=4702', 6500);
        var lbnList = (lbnPast.events || []).slice(0, 5).concat((lbnNext.events || []).slice(0, 5));
        lbnList.forEach(function (ev) {
          var hasScore = ev.intHomeScore !== null && ev.intHomeScore !== undefined && ev.intHomeScore !== '';
          matches.push({
            id: 'tsdb-' + ev.idEvent,
            leagueId: 'lbn.1',
            leagueName: ev.strLeague || 'Lebanese Premier League',
            leagueCountry: 'Lebanon',
            date: ev.strTimestamp || ev.dateEvent || '',
            status: hasScore ? 'FT' : 'UPCOMING',
            clock: hasScore ? 'FT' : (ev.strTime || 'TBD').slice(0, 5),
            venue: ev.strVenue || 'Lebanon Stadium',
            city: ev.strCity || 'Beirut',
            home: {
              id: String(ev.idHomeTeam || ''),
              name: ev.strHomeTeam || 'Home',
              shortName: ev.strHomeTeam || 'Home',
              abbreviation: (ev.strHomeTeam || 'HOM').slice(0, 3).toUpperCase(),
              logo: ev.strHomeTeamBadge || '',
              score: hasScore ? Number(ev.intHomeScore) : null
            },
            away: {
              id: String(ev.idAwayTeam || ''),
              name: ev.strAwayTeam || 'Away',
              shortName: ev.strAwayTeam || 'Away',
              abbreviation: (ev.strAwayTeam || 'AWY').slice(0, 3).toUpperCase(),
              logo: ev.strAwayTeamBadge || '',
              score: hasScore ? Number(ev.intAwayScore) : null
            },
            source: 'TheSportsDB'
          });
        });
      } catch (e) {}
    }

    var rank = { LIVE: 0, HT: 1, UPCOMING: 2, POSTPONED: 3, FT: 4 };
    matches.sort(function (a, b) {
      return (rank[a.status] - rank[b.status]) || String(a.date).localeCompare(String(b.date));
    });

    var payload = { matches: matches, errors: errors, fetchedAt: new Date().toISOString() };
    setCached(key, payload, 30000);
    return payload;
  }

  async function fetchMatchDetail(leagueId, eventId) {
    var key = 'md:' + leagueId + ':' + eventId;
    var cached = getCached(key);
    if (cached) return cached;

    var base = apiBase();
    if (base || location.pathname.indexOf('/standalone') === 0 || location.port === '3000') {
      try {
        var r = await fetchJson(base + '/api/football/match/' + encodeURIComponent(leagueId) + '/' + encodeURIComponent(eventId), 6500);
        if (r && r.match) {
          setCached(key, r, 30000);
          return r;
        }
      } catch (e) {}
    }

    var raw = await fetchJson('https://site.api.espn.com/apis/site/v2/sports/soccer/' + encodeURIComponent(leagueId) + '/summary?event=' + encodeURIComponent(eventId), 7500);
    var headerComp = (raw.header && raw.header.competitions && raw.header.competitions[0]) || {};
    var comps = Array.isArray(headerComp.competitors) ? headerComp.competitors : [];
    var homeRaw = comps.find(function (c) { return c.homeAway === 'home'; }) || comps[0] || {};
    var awayRaw = comps.find(function (c) { return c.homeAway === 'away'; }) || comps[1] || {};
    var st = headerComp.status || {};
    var stType = st.type || {};
    var status = mapEspnStatus(stType.state, stType.shortDetail || stType.description);

    var match = {
      id: eventId,
      leagueId: leagueId,
      leagueName: (raw.header && raw.header.league && raw.header.league.name) || leagueId,
      status: status,
      clock: st.displayClock || stType.shortDetail || '',
      venue: (raw.gameInfo && raw.gameInfo.venue && raw.gameInfo.venue.fullName) || '',
      home: {
        id: String((homeRaw.team && homeRaw.team.id) || ''),
        name: (homeRaw.team && homeRaw.team.displayName) || 'Home',
        shortName: (homeRaw.team && (homeRaw.team.shortDisplayName || homeRaw.team.name)) || 'Home',
        abbreviation: (homeRaw.team && homeRaw.team.abbreviation) || 'HOM',
        logo: (homeRaw.team && homeRaw.team.logos && homeRaw.team.logos[0] && homeRaw.team.logos[0].href) || '',
        score: status === 'UPCOMING' ? null : Number(homeRaw.score || 0)
      },
      away: {
        id: String((awayRaw.team && awayRaw.team.id) || ''),
        name: (awayRaw.team && awayRaw.team.displayName) || 'Away',
        shortName: (awayRaw.team && (awayRaw.team.shortDisplayName || awayRaw.team.name)) || 'Away',
        abbreviation: (awayRaw.team && awayRaw.team.abbreviation) || 'AWY',
        logo: (awayRaw.team && awayRaw.team.logos && awayRaw.team.logos[0] && awayRaw.team.logos[0].href) || '',
        score: status === 'UPCOMING' ? null : Number(awayRaw.score || 0)
      }
    };

    var boxTeams = (raw.boxscore && Array.isArray(raw.boxscore.teams) && raw.boxscore.teams) || [];
    var homeBox = boxTeams.find(function (t) { return String(t.team && t.team.id) === match.home.id; }) || boxTeams[0];
    var awayBox = boxTeams.find(function (t) { return String(t.team && t.team.id) === match.away.id; }) || boxTeams[1];
    var stats = [];
    if (homeBox && homeBox.statistics && awayBox && awayBox.statistics) {
      homeBox.statistics.forEach(function (s) {
        var aw = awayBox.statistics.find(function (a) { return a.name === s.name || a.label === s.label; });
        if (aw) {
          stats.push({
            label: s.label || s.name,
            homeValue: String(s.displayValue || '0'),
            awayValue: String(aw.displayValue || '0')
          });
        }
      });
    }

    var events = (Array.isArray(raw.keyEvents) ? raw.keyEvents : []).map(function (ke, idx) {
      var parts = Array.isArray(ke.participants) ? ke.participants : [];
      return {
        id: eventId + '-ke-' + idx,
        minute: (ke.clock && ke.clock.displayValue) || '',
        teamName: (ke.team && ke.team.displayName) || '',
        playerName: (parts[0] && parts[0].athlete && parts[0].athlete.displayName) || ke.shortText || ke.text || 'Event',
        detail: (ke.type && ke.type.text) || ke.text || ''
      };
    });

    var detail = { match: match, stats: stats, events: events };
    setCached(key, detail, 30000);
    return detail;
  }

  async function fetchStandings(leagueId) {
    var key = 'st:' + leagueId;
    var cached = getCached(key);
    if (cached) return cached;

    var base = apiBase();
    if (base || location.pathname.indexOf('/standalone') === 0 || location.port === '3000') {
      try {
        var r = await fetchJson(base + '/api/football/standings/' + encodeURIComponent(leagueId), 6500);
        if (r && Array.isArray(r.standings)) {
          setCached(key, r, 180000);
          return r;
        }
      } catch (e) {}
    }

    if (leagueId === 'lbn.1') {
      var tsdb = await fetchJson('https://www.thesportsdb.com/api/v1/json/123/lookuptable.php?l=4702&s=2025-2026', 6500).catch(function () { return { table: [] }; });
      var rows = (tsdb.table || []).map(function (t) {
        return {
          rank: Number(t.intRank || 0),
          teamName: t.strTeam || '',
          teamLogo: t.strBadge || '',
          played: Number(t.intPlayed || 0),
          wins: Number(t.intWin || 0),
          draws: Number(t.intDraw || 0),
          losses: Number(t.intLoss || 0),
          goalDiff: Number(t.intGoalDifference || 0),
          points: Number(t.intPoints || 0)
        };
      });
      var lbnPayload = { standings: rows, scorers: [], assists: [] };
      setCached(key, lbnPayload, 180000);
      return lbnPayload;
    }

    var raw = await fetchJson('https://site.api.espn.com/apis/v2/sports/soccer/' + encodeURIComponent(leagueId) + '/standings', 7000);
    var entries = (raw.children && raw.children[0] && raw.children[0].standings && raw.children[0].standings.entries) || (raw.standings && raw.standings.entries) || [];
    var getStat = function (list, name) {
      var found = (list || []).find(function (s) { return s.name === name; });
      return Number(found ? found.value : 0);
    };
    var standings = entries.map(function (e, i) {
      var st = e.stats || [];
      return {
        rank: getStat(st, 'rank') || i + 1,
        teamName: (e.team && (e.team.displayName || e.team.name)) || 'Team',
        teamLogo: (e.team && e.team.logos && e.team.logos[0] && e.team.logos[0].href) || '',
        played: getStat(st, 'gamesPlayed'),
        wins: getStat(st, 'wins'),
        draws: getStat(st, 'ties'),
        losses: getStat(st, 'losses'),
        goalDiff: getStat(st, 'pointDifferential'),
        points: getStat(st, 'points')
      };
    }).sort(function (a, b) { return a.rank - b.rank; });

    var res = { standings: standings, scorers: [], assists: [] };
    setCached(key, res, 180000);
    return res;
  }

  async function fetchFootballNews(category) {
    var key = 'news:fb:' + (category || 'all');
    var cached = getCached(key);
    if (cached) return cached;

    var base = apiBase();
    if (base || location.pathname.indexOf('/standalone') === 0 || location.port === '3000') {
      try {
        var r = await fetchJson(base + '/api/news/football?category=' + encodeURIComponent(category || 'all'), 6500);
        if (r && Array.isArray(r.articles)) {
          setCached(key, r, 180000);
          return r;
        }
      } catch (e) {}
    }

    var espn = await fetchJson('https://site.api.espn.com/apis/site/v2/sports/soccer/all/news?limit=20', 7000);
    var articles = (espn.articles || []).map(function (a) {
      var hl = a.headline || '';
      var cat = /transfer|rumor|deal|sign/i.test(hl) ? 'Transfers' : /world cup|national|fifa/i.test(hl) ? 'International' : 'Breaking';
      return {
        id: String(a.dataSourceIdentifier || a.id || Math.random()),
        title: hl,
        description: a.description || '',
        url: (a.links && a.links.web && a.links.web.href) || 'https://www.espn.com/soccer/',
        imageUrl: (a.images && a.images[0] && a.images[0].url) || '',
        publishedAt: a.published || new Date().toISOString(),
        source: 'ESPN Soccer',
        category: cat
      };
    });
    if (category && category !== 'all') {
      articles = articles.filter(function (a) { return a.category.toLowerCase() === category.toLowerCase(); });
    }
    var out = { articles: articles };
    setCached(key, out, 180000);
    return out;
  }

  async function fetchGamingNews(game) {
    var key = 'news:gm:' + (game || 'all');
    var cached = getCached(key);
    if (cached) return cached;

    var base = apiBase();
    if (base || location.pathname.indexOf('/standalone') === 0 || location.port === '3000') {
      try {
        var r = await fetchJson(base + '/api/news/gaming?game=' + encodeURIComponent(game || 'all'), 6500);
        if (r && Array.isArray(r.articles)) {
          setCached(key, r, 180000);
          return r;
        }
      } catch (e) {}
    }

    // Public Reddit JSON / FreeToGame clean fallback when pure static
    var feed = await fetchJson('https://www.reddit.com/r/gaming/hot.json?limit=15', 7000).catch(function () { return null; });
    var posts = (feed && feed.data && feed.data.children ? feed.data.children : []).map(function (c) {
      var d = c.data || {};
      return {
        id: 'rd-' + d.id,
        title: d.title || 'Gaming Update',
        description: (d.selftext || '').slice(0, 220) || 'Community gaming headline from r/gaming.',
        url: d.url || ('https://www.reddit.com' + d.permalink),
        imageUrl: d.thumbnail && d.thumbnail.indexOf('http') === 0 ? d.thumbnail : '',
        publishedAt: new Date((d.created_utc || Date.now() / 1000) * 1000).toISOString(),
        source: 'Gaming Community Feed',
        category: 'Gaming'
      };
    });
    var res = { articles: posts };
    setCached(key, res, 180000);
    return res;
  }

  async function searchPlayers(q) {
    var base = apiBase();
    if (base || location.pathname.indexOf('/standalone') === 0 || location.port === '3000') {
      try {
        var r = await fetchJson(base + '/api/football/players?q=' + encodeURIComponent(q), 6500);
        if (r && Array.isArray(r.players)) return r.players;
      } catch (e) {}
    }
    var raw = await fetchJson('https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=' + encodeURIComponent(q), 7500);
    return (raw.player || [])
      .filter(function (p) { return String(p.strSport || '').toLowerCase() === 'soccer'; })
      .slice(0, 14)
      .map(function (p) {
        return {
          id: String(p.idPlayer),
          name: p.strPlayer,
          nationality: p.strNationality || 'Unknown',
          currentClub: p.strTeam || 'Free Agent / Retired',
          position: p.strPosition || 'Footballer',
          photo: p.strCutout || p.strThumb || p.strRender || '',
          birthDate: p.dateBorn || '',
          shirtNumber: p.strNumber || ''
        };
      });
  }

  async function fetchPlayerDetail(playerKey) {
    var base = apiBase();
    if (base || location.pathname.indexOf('/standalone') === 0 || location.port === '3000') {
      try {
        var r = await fetchJson(base + '/api/football/player/' + encodeURIComponent(playerKey), 6500);
        if (r && r.name) return r;
      } catch (e) {}
    }
    var lookup = /^\d+$/.test(playerKey)
      ? await fetchJson('https://www.thesportsdb.com/api/v1/json/123/lookupplayer.php?id=' + encodeURIComponent(playerKey), 7500)
      : await fetchJson('https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=' + encodeURIComponent(playerKey), 7500);
    var p = (lookup.players && lookup.players[0]) || (lookup.player && lookup.player[0]);
    if (!p) throw new Error('Player not found');
    return {
      id: String(p.idPlayer),
      name: p.strPlayer,
      nationality: p.strNationality || 'Unavailable',
      position: p.strPosition || 'Footballer',
      currentClub: p.strTeam || 'Free Agent',
      shirtNumber: p.strNumber || '',
      height: p.strHeight || '',
      weight: p.strWeight || '',
      photo: p.strCutout || p.strThumb || '',
      description: p.strDescriptionEN || '',
      source: 'TheSportsDB Verified Player Registry'
    };
  }

  async function askAiAnalyst(payload) {
    var base = apiBase();
    var endpoint = (base || '') + '/api/ai/analyze';
    var res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI Analyst endpoint unavailable');
    return data;
  }

  window.STR_API = {
    fetchScoreboard: fetchScoreboard,
    fetchMatchDetail: fetchMatchDetail,
    fetchStandings: fetchStandings,
    fetchFootballNews: fetchFootballNews,
    fetchGamingNews: fetchGamingNews,
    searchPlayers: searchPlayers,
    fetchPlayerDetail: fetchPlayerDetail,
    askAiAnalyst: askAiAnalyst
  };
})();
