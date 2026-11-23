(function () {
  var SIM_MODES = [
    { id: 'quick', label: 'Quick Match', comp: 'STR Friendly', knockout: false },
    { id: 'ucl', label: 'Champions League', comp: 'UEFA Champions League', knockout: true },
    { id: 'epl', label: 'Premier League', comp: 'Premier League', knockout: false },
    { id: 'laliga', label: 'La Liga', comp: 'La Liga', knockout: false },
    { id: 'world_cup', label: 'World Cup', comp: 'FIFA World Cup', knockout: true },
    { id: 'tournament', label: 'Custom Tournament', comp: 'STR Knockout Cup', knockout: true },
    { id: 'dream', label: 'Dream Match', comp: 'STR Legends Showcase', knockout: true }
  ];

  var FORMATIONS = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2'];
  var MENTALITIES = ['Defensive', 'Balanced', 'Attacking', 'All-Out Attack'];

  var ui = {
    mode: 'quick',
    homeId: 'real-madrid',
    awayId: 'man-city',
    formationHome: '4-3-3',
    formationAway: '4-3-3',
    styleHome: 'High Press',
    styleAway: 'Tiki-Taka',
    knockout: false,
    speed: 1,
    playing: false,
    timerId: null,
    subTab: 'pitch', // pitch | timeline | stats | lineups | ratings | report | history
    editingSide: 'home',
    selectedStarterIdx: null,
    dreamHomeIds: [],
    dreamAwayIds: [],
    dreamSide: 'home',
    tournamentSize: 4,
    tournamentBracket: null,
    activeBracketMatch: null, // { roundIdx, matchIdx }
    state: null,
    history: []
  };

  function uid(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 9);
  }
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }
  function pickWeighted(items, weightFn) {
    if (!items || !items.length) return null;
    var total = 0;
    var weights = items.map(function (it) {
      var w = Math.max(0.05, weightFn(it));
      total += w;
      return w;
    });
    var r = Math.random() * total;
    for (var i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem('str_standalone_sim_history');
      ui.history = raw ? JSON.parse(raw) : [];
    } catch (e) {
      ui.history = [];
    }
  }
  loadHistory();

  function saveMatchToHistory(st, report) {
    var entry = {
      id: st.matchId,
      mode: st.mode,
      competitionLabel: st.competitionLabel,
      homeTeamId: st.homeTeam.id,
      homeName: st.homeTeam.name,
      awayTeamId: st.awayTeam.id,
      awayName: st.awayTeam.name,
      homeScore: st.homeScore,
      awayScore: st.awayScore,
      homePenScore: st.homePenScore,
      awayPenScore: st.awayPenScore,
      wentToExtraTime: st.minute > 90,
      wentToPenalties: st.shootoutKicks.length > 0,
      formationHome: st.formationHome,
      formationAway: st.formationAway,
      manOfTheMatch: report.motmName,
      motmRating: report.motmRating.toFixed(1),
      summaryLine: report.headline,
      possessionHome: st.stats.possessionHome,
      shotsHome: st.stats.shotsHome,
      shotsAway: st.stats.shotsAway,
      keyEvents: st.events.filter(function (e) { return e.isKey; }).slice(0, 10).map(function (e) { return e.minuteLabel + ' ' + e.text; }),
      createdAt: new Date().toISOString()
    };
    ui.history = [entry].concat(ui.history.filter(function (h) { return h.id !== entry.id; })).slice(0, 25);
    try {
      localStorage.setItem('str_standalone_sim_history', JSON.stringify(ui.history));
    } catch (e) {}
    if (window.STR_FB && window.STR_FB.saveSimMatch) {
      window.STR_FB.saveSimMatch(entry);
    }
    // If inside custom tournament, advance winner
    if (ui.activeBracketMatch && ui.tournamentBracket) {
      advanceBracketWinner(entry);
    }
  }

  function buildTeamOverrides(teamId, isDreamSide) {
    var base = window.STR_DATA.getTeamById(teamId) || window.STR_DATA.SIMULATOR_TEAMS[0];
    if (ui.mode === 'dream') {
      var ids = isDreamSide === 'home' ? ui.dreamHomeIds : ui.dreamAwayIds;
      if (ids.length === 11) {
        var pool = window.STR_DATA.ALL_SIM_PLAYERS_POOL;
        var chosen = ids.map(function (pid) {
          return pool.find(function (p) { return p.id === pid; });
        }).filter(Boolean);
        if (chosen.length === 11) {
          return Object.assign({}, base, {
            name: isDreamSide === 'home' ? 'Dream XI Home' : 'Dream XI Away',
            shortName: isDreamSide === 'home' ? 'Dream Home' : 'Dream Away',
            starters: chosen
          });
        }
      }
    }
    return JSON.parse(JSON.stringify(base));
  }

  function ensureDreamDefaults() {
    if (ui.dreamHomeIds.length !== 11) {
      ui.dreamHomeIds = window.STR_DATA.getTeamById('real-madrid').starters.slice(0, 11).map(function (p) { return p.id; });
    }
    if (ui.dreamAwayIds.length !== 11) {
      ui.dreamAwayIds = window.STR_DATA.getTeamById('man-city').starters.slice(0, 11).map(function (p) { return p.id; });
    }
  }
  ensureDreamDefaults();

  function cloneRoster(players, side, onPitch) {
    return (players || []).map(function (pl) {
      return {
        player: pl,
        side: side,
        onPitch: onPitch,
        stamina: 100,
        rating: 6.4,
        goals: 0,
        assists: 0,
        saves: 0,
        shots: 0,
        tackles: 0,
        yellowCards: 0,
        redCard: false,
        injured: false
      };
    });
  }

  function createInitialMatchState(cfg) {
    return {
      matchId: uid('sim'),
      mode: cfg.mode,
      competitionLabel: cfg.competitionLabel,
      knockoutRules: cfg.knockoutRules,
      phase: 'FIRST_HALF',
      minute: 0,
      addedTime: 0,
      stoppageTarget1: Math.floor(rand(1, 4)),
      stoppageTarget2: Math.floor(rand(2, 6)),
      homeTeam: cfg.homeTeam,
      awayTeam: cfg.awayTeam,
      formationHome: cfg.formationHome,
      formationAway: cfg.formationAway,
      styleHome: cfg.styleHome,
      styleAway: cfg.styleAway,
      mentalityHome: 'Balanced',
      mentalityAway: 'Balanced',
      homeScore: 0,
      awayScore: 0,
      homePenScore: 0,
      awayPenScore: 0,
      shootoutKicks: [],
      subsUsedHome: 0,
      subsUsedAway: 0,
      stats: {
        possessionHome: 50,
        possessionAway: 50,
        shotsHome: 0,
        shotsAway: 0,
        shotsOnTargetHome: 0,
        shotsOnTargetAway: 0,
        xgHome: 0,
        xgAway: 0,
        cornersHome: 0,
        cornersAway: 0,
        foulsHome: 0,
        foulsAway: 0,
        passesHome: 0,
        passesAway: 0,
        passAccHome: 84,
        passAccAway: 84,
        savesHome: 0,
        savesAway: 0,
        yellowHome: 0,
        yellowAway: 0,
        redHome: 0,
        redAway: 0
      },
      events: [
        {
          id: uid('ev'),
          minute: 0,
          minuteLabel: "0'",
          type: 'kickoff',
          side: 'neutral',
          text: 'Kick-off! ' + cfg.homeTeam.name + ' (' + cfg.formationHome + ', ' + cfg.styleHome + ') vs ' + cfg.awayTeam.name + ' (' + cfg.formationAway + ', ' + cfg.styleAway + ') in ' + cfg.competitionLabel + '.',
          isKey: true
        }
      ],
      homeRoster: cloneRoster(cfg.homeTeam.starters.slice(0, 11), 'home', true).concat(cloneRoster(cfg.homeTeam.bench || [], 'home', false)),
      awayRoster: cloneRoster(cfg.awayTeam.starters.slice(0, 11), 'away', true).concat(cloneRoster(cfg.awayTeam.bench || [], 'away', false)),
      ballPos: { x: 50, y: 50 },
      momentumHome: 0,
      activeFlash: null,
      highlightedPlayerId: null,
      savedToHistory: false
    };
  }

  function computeSideStrength(roster, formation, style, mentality, isHome) {
    var active = roster.filter(function (p) { return p.onPitch && !p.redCard; });
    var redPenalty = Math.max(0.45, 1 - (11 - active.length) * 0.14);
    var sumAtt = 0, cntAtt = 0, sumMid = 0, cntMid = 0, sumDef = 0, cntDef = 0, gkVal = 76;

    active.forEach(function (ls) {
      var stFactor = 0.72 + (ls.stamina / 100) * 0.28;
      var eff = ls.player.overall * stFactor;
      if (ls.player.roleGroup === 'ATT') { sumAtt += eff; cntAtt++; }
      else if (ls.player.roleGroup === 'MID') { sumMid += eff; cntMid++; }
      else if (ls.player.roleGroup === 'DEF') { sumDef += eff; cntDef++; }
      else gkVal = eff;
    });

    var att = cntAtt ? sumAtt / cntAtt : 74;
    var mid = cntMid ? sumMid / cntMid : 75;
    var def = cntDef ? sumDef / cntDef : 75;

    if (formation === '4-3-3') { att += 2.2; mid += 0.8; }
    else if (formation === '4-2-3-1') { mid += 2.4; def += 1.0; }
    else if (formation === '3-5-2') { mid += 3.0; att += 1.2; def -= 1.2; }
    else { def += 1.8; att += 1.0; }

    var passBias = 0, pressDrain = 1.0, counterBonus = 0, wideBonus = 0;
    if (style === 'Tiki-Taka') { mid += 3.5; passBias = 7; }
    else if (style === 'High Press') { att += 2.2; pressDrain = 1.32; }
    else if (style === 'Counter-Attack') { def += 2.6; counterBonus = 2.5; }
    else if (style === 'Wing Play') { att += 1.8; wideBonus = 3.0; }

    if (mentality === 'Defensive') { def += 4; att -= 3.5; }
    else if (mentality === 'Attacking') { att += 4; def -= 2.8; }
    else if (mentality === 'All-Out Attack') { att += 7.5; def -= 6.5; }

    if (isHome) { att += 1.5; mid += 1.2; def += 1.0; }
    return {
      att: att * redPenalty,
      mid: mid * redPenalty,
      def: def * redPenalty,
      gk: gkVal,
      passBias: passBias,
      pressDrain: pressDrain,
      counterBonus: counterBonus,
      wideBonus: wideBonus
    };
  }

  function advanceMinute(prev) {
    var st = JSON.parse(JSON.stringify(prev));
    if (st.phase === 'FINISHED') return st;

    if (st.phase === 'HALFTIME') {
      st.phase = 'SECOND_HALF';
      st.minute = 46;
      st.addedTime = 0;
      st.activeFlash = { title: '2ND HALF', subtitle: 'Play resumes', side: 'neutral' };
      st.ballPos = { x: 50, y: 50 };
      st.events.unshift({ id: uid('ev'), minute: 46, minuteLabel: "46'", type: 'whistle', side: 'neutral', text: 'Second half underway!', isKey: true });
      return st;
    }

    if (st.phase === 'EXTRA_TIME_BREAK') {
      st.phase = 'EXTRA_TIME_2';
      st.minute = 106;
      st.events.unshift({ id: uid('ev'), minute: 106, minuteLabel: "106'", type: 'whistle', side: 'neutral', text: 'Second period of Extra Time begins!', isKey: true });
      return st;
    }

    if (st.phase === 'PENALTIES') {
      var round = Math.floor(st.shootoutKicks.length / 2) + 1;
      var kickSide = st.shootoutKicks.length % 2 === 0 ? 'home' : 'away';
      var kickerRoster = kickSide === 'home' ? st.homeRoster : st.awayRoster;
      var oppRoster = kickSide === 'home' ? st.awayRoster : st.homeRoster;
      var takers = kickerRoster.filter(function (r) { return r.onPitch && !r.redCard; }).sort(function (a, b) { return b.player.stats.sho - a.player.stats.sho; });
      var taker = takers[(round - 1) % Math.max(1, takers.length)];
      var oppGk = oppRoster.find(function (r) { return r.onPitch && r.player.roleGroup === 'GK'; });
      var prob = clamp(0.75 + ((taker ? taker.player.stats.sho : 78) - (oppGk ? oppGk.player.overall : 80)) * 0.008, 0.55, 0.91);
      var scored = Math.random() < prob;
      if (scored) {
        if (kickSide === 'home') st.homePenScore++; else st.awayPenScore++;
      } else if (oppGk) {
        oppGk.rating = clamp(oppGk.rating + 0.45, 5, 10);
      }
      st.shootoutKicks.push({ round: round, side: kickSide, takerName: taker ? taker.player.shortName : 'Player', scored: scored });
      st.ballPos = { x: kickSide === 'home' ? 92 : 8, y: rand(44, 56) };
      st.activeFlash = { title: scored ? 'PEN SCORED!' : 'SAVED!', subtitle: (taker ? taker.player.shortName : '') + ' (' + st.homePenScore + '-' + st.awayPenScore + ')', side: kickSide };
      st.events.unshift({
        id: uid('ev'),
        minute: 120,
        minuteLabel: 'P' + round,
        type: scored ? 'goal' : 'save',
        side: kickSide,
        text: (scored ? '⚽ Penalty Scored! ' : '🧤 Penalty Saved! ') + (taker ? taker.player.name : 'Taker') + ' (' + st.homePenScore + '-' + st.awayPenScore + ')',
        isKey: true
      });
      var hk = st.shootoutKicks.filter(function (k) { return k.side === 'home'; }).length;
      var ak = st.shootoutKicks.filter(function (k) { return k.side === 'away'; }).length;
      var decided = false;
      if (hk <= 5 && ak <= 5) {
        if (st.homePenScore > st.awayPenScore + (5 - ak) || st.awayPenScore > st.homePenScore + (5 - hk)) decided = true;
      } else if (hk === ak && st.homePenScore !== st.awayPenScore) decided = true;
      if (decided) {
        st.phase = 'FINISHED';
        var penWinner = st.homePenScore > st.awayPenScore ? st.homeTeam.name : st.awayTeam.name;
        st.events.unshift({ id: uid('ev'), minute: 120, minuteLabel: 'PEN FT', type: 'fulltime', side: st.homePenScore > st.awayPenScore ? 'home' : 'away', text: penWinner + ' wins on penalties (' + st.homePenScore + '-' + st.awayPenScore + ')!', isKey: true });
      }
      return st;
    }

    // Advance match clock
    if (st.phase === 'FIRST_HALF') {
      if (st.minute < 45) st.minute++;
      else if (st.addedTime < st.stoppageTarget1) st.addedTime++;
      else {
        st.phase = 'HALFTIME';
        st.activeFlash = { title: 'HALF-TIME', subtitle: st.homeTeam.abbr + ' ' + st.homeScore + ' - ' + st.awayScore + ' ' + st.awayTeam.abbr, side: 'neutral' };
        st.events.unshift({ id: uid('ev'), minute: 45, minuteLabel: 'HT', type: 'halftime', side: 'neutral', text: 'Half-Time: ' + st.homeTeam.name + ' ' + st.homeScore + ' - ' + st.awayScore + ' ' + st.awayTeam.name, isKey: true });
        return st;
      }
    } else if (st.phase === 'SECOND_HALF') {
      if (st.minute < 90) st.minute++;
      else if (st.addedTime < st.stoppageTarget2) st.addedTime++;
      else {
        if (st.knockoutRules && st.homeScore === st.awayScore) {
          st.phase = 'EXTRA_TIME_1';
          st.minute = 91;
          st.addedTime = 0;
          st.events.unshift({ id: uid('ev'), minute: 91, minuteLabel: "91'", type: 'whistle', side: 'neutral', text: 'Level at 90 minutes — Extra Time begins!', isKey: true });
        } else {
          st.phase = 'FINISHED';
          st.activeFlash = { title: 'FULL TIME', subtitle: st.homeTeam.abbr + ' ' + st.homeScore + ' - ' + st.awayScore + ' ' + st.awayTeam.abbr, side: 'neutral' };
          st.events.unshift({ id: uid('ev'), minute: 90, minuteLabel: 'FT', type: 'fulltime', side: 'neutral', text: 'Full-Time: ' + st.homeTeam.name + ' ' + st.homeScore + ' - ' + st.awayScore + ' ' + st.awayTeam.name, isKey: true });
        }
        return st;
      }
    } else if (st.phase === 'EXTRA_TIME_1') {
      if (st.minute < 105) st.minute++;
      else { st.phase = 'EXTRA_TIME_BREAK'; return st; }
    } else if (st.phase === 'EXTRA_TIME_2') {
      if (st.minute < 120) st.minute++;
      else {
        if (st.homeScore === st.awayScore) {
          st.phase = 'PENALTIES';
          st.events.unshift({ id: uid('ev'), minute: 120, minuteLabel: 'PEN', type: 'whistle', side: 'neutral', text: 'Still level after Extra Time — Penalty Shootout!', isKey: true });
        } else {
          st.phase = 'FINISHED';
          st.events.unshift({ id: uid('ev'), minute: 120, minuteLabel: 'AET', type: 'fulltime', side: 'neutral', text: 'Full-Time AET: ' + st.homeTeam.name + ' ' + st.homeScore + ' - ' + st.awayScore + ' ' + st.awayTeam.name, isKey: true });
        }
        return st;
      }
    }

    var mLabel = st.addedTime > 0 ? st.minute + '+' + st.addedTime + "'" : st.minute + "'";
    st.activeFlash = null;
    st.highlightedPlayerId = null;

    var hs = computeSideStrength(st.homeRoster, st.formationHome, st.styleHome, st.mentalityHome, true);
    var as = computeSideStrength(st.awayRoster, st.formationAway, st.styleAway, st.mentalityAway, false);

    // Stamina drain
    st.homeRoster.forEach(function (ls) {
      if (ls.onPitch && !ls.redCard) {
        var mult = ls.player.roleGroup === 'GK' ? 0.14 : hs.pressDrain;
        ls.stamina = clamp(ls.stamina - rand(0.45, 0.85) * mult, 18, 100);
      }
    });
    st.awayRoster.forEach(function (ls) {
      if (ls.onPitch && !ls.redCard) {
        var mult = ls.player.roleGroup === 'GK' ? 0.14 : as.pressDrain;
        ls.stamina = clamp(ls.stamina - rand(0.45, 0.85) * mult, 18, 100);
      }
    });

    // Possession & passes
    var targetHomePoss = clamp(50 + (hs.mid - as.mid) * 1.65 + (hs.passBias - as.passBias), 27, 73);
    st.stats.possessionHome = Math.round(st.stats.possessionHome * 0.9 + targetHomePoss * 0.1);
    st.stats.possessionAway = 100 - st.stats.possessionHome;
    st.stats.passesHome += Math.round((st.stats.possessionHome / 100) * rand(8, 14));
    st.stats.passesAway += Math.round((st.stats.possessionAway / 100) * rand(8, 14));
    st.stats.passAccHome = clamp(Math.round(80 + hs.passBias * 0.5 + (hs.mid - 80) * 0.35), 72, 94);
    st.stats.passAccAway = clamp(Math.round(80 + as.passBias * 0.5 + (as.mid - 80) * 0.35), 72, 94);

    // AI auto substitutions in second half
    if (st.minute >= 60 && st.subsUsedAway < 5 && Math.random() < 0.08) {
      var tired = st.awayRoster.filter(function (r) { return r.onPitch && r.player.roleGroup !== 'GK' && r.stamina < 66; }).sort(function (a, b) { return a.stamina - b.stamina; })[0];
      var subIn = st.awayRoster.filter(function (r) { return !r.onPitch && !r.redCard && !r.injured && r.player.roleGroup !== 'GK'; })[0];
      if (tired && subIn) {
        tired.onPitch = false; subIn.onPitch = true; st.subsUsedAway++;
        st.events.unshift({ id: uid('ev'), minute: st.minute, minuteLabel: mLabel, type: 'sub', side: 'away', text: 'Sub (' + st.awayTeam.abbr + '): ' + subIn.player.shortName + ' replaces ' + tired.player.shortName + '.', isKey: false });
      }
    }

    var attRoll = Math.random();
    var side = attRoll < (st.stats.possessionHome / 100 + (hs.att - as.att) * 0.005) ? 'home' : 'away';
    var attSide = side === 'home' ? hs : as;
    var defSide = side === 'home' ? as : hs;
    var attTeam = side === 'home' ? st.homeTeam : st.awayTeam;
    var defTeam = side === 'home' ? st.awayTeam : st.homeTeam;
    var attRoster = side === 'home' ? st.homeRoster : st.awayRoster;
    var defRoster = side === 'home' ? st.awayRoster : st.homeRoster;

    st.ballPos = {
      x: side === 'home' ? clamp(52 + rand(5, 36), 52, 93) : clamp(48 - rand(5, 36), 7, 48),
      y: clamp(20 + Math.random() * 60, 14, 86)
    };

    // Shot creation probability
    var shotChance = clamp(0.24 + (attSide.att - defSide.def) * 0.012 + attSide.counterBonus * 0.01, 0.14, 0.44);
    if (Math.random() < shotChance) {
      var activeOutfield = attRoster.filter(function (r) { return r.onPitch && !r.redCard && r.player.roleGroup !== 'GK'; });
      var shooter = pickWeighted(activeOutfield, function (r) {
        return r.player.roleGroup === 'ATT' ? r.player.stats.sho * 2.3 : r.player.roleGroup === 'MID' ? r.player.stats.sho * 1.15 : r.player.stats.sho * 0.3;
      });
      var assister = pickWeighted(activeOutfield.filter(function (r) { return shooter && r.player.id !== shooter.player.id; }), function (r) {
        return r.player.stats.pas * (r.player.roleGroup === 'MID' ? 1.7 : 1.0);
      });
      var gk = defRoster.find(function (r) { return r.onPitch && r.player.roleGroup === 'GK'; });

      var isPen = Math.random() < 0.032;
      var xg = isPen ? 0.78 : clamp(0.06 + (attSide.att - defSide.def) * 0.006 + Math.random() * 0.19, 0.04, 0.48);

      if (side === 'home') { st.stats.shotsHome++; st.stats.xgHome += xg; }
      else { st.stats.shotsAway++; st.stats.xgAway += xg; }
      if (shooter) shooter.shots++;

      // Corner chance
      if (!isPen && Math.random() < 0.25 + attSide.wideBonus * 0.03) {
        if (side === 'home') st.stats.cornersHome++; else st.stats.cornersAway++;
      }

      var gkSave = (defSide.gk - 76) * 0.008;
      var scoreProb = isPen ? 0.77 : clamp(xg * 1.18 - gkSave + ((shooter ? shooter.player.stats.sho : 78) - 78) * 0.004, 0.06, 0.79);
      var isGoal = Math.random() < scoreProb;
      var onTarget = isGoal || Math.random() < 0.56;

      if (onTarget) {
        if (side === 'home') st.stats.shotsOnTargetHome++; else st.stats.shotsOnTargetAway++;
      }

      if (isGoal && shooter) {
        // Occasional VAR Disallowed Goal check!
        if (!isPen && Math.random() < 0.09) {
          st.ballPos = { x: side === 'home' ? 91 : 9, y: 50 };
          st.activeFlash = { title: 'VAR CHECK', subtitle: 'Goal Disallowed (Offside)', side: side };
          st.events.unshift({ id: uid('ev'), minute: st.minute, minuteLabel: mLabel, type: 'var', side: side, text: '📺 VAR Check: ' + shooter.player.name + ' finishes for ' + attTeam.name + ', but the goal is disallowed for offside!', isKey: true });
        } else {
          if (side === 'home') st.homeScore++; else st.awayScore++;
          shooter.goals++;
          shooter.rating = clamp(shooter.rating + 1.1, 5, 10);
          if (assister && !isPen) {
            assister.assists++;
            assister.rating = clamp(assister.rating + 0.65, 5, 10);
          }
          st.ballPos = { x: side === 'home' ? 96 : 4, y: 50 };
          st.highlightedPlayerId = shooter.player.id;
          st.activeFlash = { title: isPen ? 'PENALTY GOAL!' : 'GOAL!', subtitle: shooter.player.shortName + ' · ' + attTeam.abbr, side: side };
          var assistTxt = assister && !isPen ? ' (Assist: ' + assister.player.shortName + ')' : isPen ? ' (Penalty)' : '';
          st.events.unshift({ id: uid('ev'), minute: st.minute, minuteLabel: mLabel, type: isPen ? 'penalty' : 'goal', side: side, text: '⚽ GOAL! ' + shooter.player.name + ' scores for ' + attTeam.name + '!' + assistTxt, isKey: true });
        }
      } else if (onTarget && gk) {
        gk.saves++;
        gk.rating = clamp(gk.rating + 0.32, 5, 10);
        if (side === 'home') st.stats.savesAway++; else st.stats.savesHome++;
        st.ballPos = { x: side === 'home' ? 92 : 8, y: rand(42, 58) };
        st.events.unshift({ id: uid('ev'), minute: st.minute, minuteLabel: mLabel, type: 'save', side: side === 'home' ? 'away' : 'home', text: '🧤 Save by ' + gk.player.shortName + ' (' + defTeam.abbr + ') denying ' + (shooter ? shooter.player.shortName : 'attacker') + '.', isKey: false });
      }
    } else if (Math.random() < 0.17) {
      // Foul / card / injury
      var foulSide = Math.random() < 0.5 ? 'home' : 'away';
      var fRoster = foulSide === 'home' ? st.homeRoster : st.awayRoster;
      var fTeam = foulSide === 'home' ? st.homeTeam : st.awayTeam;
      if (foulSide === 'home') st.stats.foulsHome++; else st.stats.foulsAway++;
      var offender = pickWeighted(fRoster.filter(function (r) { return r.onPitch && !r.redCard && r.player.roleGroup !== 'GK'; }), function (r) { return 110 - r.player.stats.def * 0.4; });
      if (offender && Math.random() < 0.24) {
        offender.yellowCards++;
        offender.rating = clamp(offender.rating - 0.35, 5, 10);
        if (offender.yellowCards >= 2 || Math.random() < 0.05) {
          offender.redCard = true;
          if (foulSide === 'home') st.stats.redHome++; else st.stats.redAway++;
          st.activeFlash = { title: 'RED CARD', subtitle: offender.player.shortName + ' sent off!', side: foulSide };
          st.events.unshift({ id: uid('ev'), minute: st.minute, minuteLabel: mLabel, type: 'red', side: foulSide, text: '🟥 RED CARD! ' + offender.player.name + ' (' + fTeam.abbr + ') is sent off!', isKey: true });
        } else {
          if (foulSide === 'home') st.stats.yellowHome++; else st.stats.yellowAway++;
          st.events.unshift({ id: uid('ev'), minute: st.minute, minuteLabel: mLabel, type: 'yellow', side: foulSide, text: '🟨 Yellow card for ' + offender.player.name + ' (' + fTeam.abbr + ').', isKey: false });
        }
      } else if (offender && Math.random() < 0.035) {
        offender.injured = true;
        var benchSub = fRoster.find(function (r) { return !r.onPitch && !r.redCard && !r.injured && r.player.roleGroup !== 'GK'; });
        if (benchSub) {
          offender.onPitch = false;
          benchSub.onPitch = true;
          if (foulSide === 'home') st.subsUsedHome++; else st.subsUsedAway++;
          st.events.unshift({ id: uid('ev'), minute: st.minute, minuteLabel: mLabel, type: 'injury', side: foulSide, text: '🏥 Injury: ' + offender.player.name + ' forces a substitution — ' + benchSub.player.shortName + ' comes on.', isKey: true });
        }
      }
    }

    return st;
  }

  function generateReport(st) {
    var all = st.homeRoster.concat(st.awayRoster);
    var best = all.slice().sort(function (a, b) { return (b.rating + b.goals * 0.5) - (a.rating + a.goals * 0.5); })[0];
    var winner = st.homeScore > st.awayScore ? st.homeTeam.name : st.awayScore > st.homeScore ? st.awayTeam.name : st.homePenScore > st.awayPenScore ? st.homeTeam.name : st.awayPenScore > st.homePenScore ? st.awayTeam.name : 'Draw';
    return {
      motmName: best ? best.player.name : st.homeTeam.starters[0].name,
      motmTeam: best ? (best.side === 'home' ? st.homeTeam.name : st.awayTeam.name) : st.homeTeam.name,
      motmRating: best ? best.rating : 8.2,
      winner: winner,
      headline: winner === 'Draw'
        ? 'Honors even between ' + st.homeTeam.name + ' and ' + st.awayTeam.name + ' (' + st.homeScore + '-' + st.awayScore + ').'
        : winner + ' claims victory in ' + st.competitionLabel + ' (' + st.homeScore + '-' + st.awayScore + ').'
    };
  }

  function stopPlayback() {
    ui.playing = false;
    if (ui.timerId) {
      clearInterval(ui.timerId);
      ui.timerId = null;
    }
  }

  function startMatch() {
    stopPlayback();
    var modeMeta = SIM_MODES.find(function (m) { return m.id === ui.mode; }) || SIM_MODES[0];
    var homeTeam = buildTeamOverrides(ui.homeId, 'home');
    var awayTeam = buildTeamOverrides(ui.awayId, 'away');
    ui.state = createInitialMatchState({
      mode: ui.mode,
      competitionLabel: modeMeta.comp,
      knockoutRules: ui.knockout || modeMeta.knockout,
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      formationHome: ui.formationHome,
      formationAway: ui.formationAway,
      styleHome: ui.styleHome,
      styleAway: ui.styleAway
    });
    ui.subTab = 'pitch';
    render();
  }

  function togglePlay() {
    if (!ui.state) startMatch();
    if (ui.state.phase === 'FINISHED') return;
    if (ui.playing) {
      stopPlayback();
      render();
      return;
    }
    ui.playing = true;
    var intervalMs = ui.speed === 4 ? 140 : ui.speed === 2 ? 280 : 520;
    ui.timerId = setInterval(function () {
      if (!ui.state || ui.state.phase === 'FINISHED') {
        stopPlayback();
        if (ui.state && !ui.state.savedToHistory) {
          ui.state.savedToHistory = true;
          saveMatchToHistory(ui.state, generateReport(ui.state));
        }
        render();
        return;
      }
      ui.state = advanceMinute(ui.state);
      if (ui.state.phase === 'FINISHED' && !ui.state.savedToHistory) {
        stopPlayback();
        ui.state.savedToHistory = true;
        saveMatchToHistory(ui.state, generateReport(ui.state));
      }
      render();
    }, intervalMs);
    render();
  }

  function stepOneMinute() {
    if (!ui.state) startMatch();
    if (ui.state.phase === 'FINISHED') return;
    ui.state = advanceMinute(ui.state);
    if (ui.state.phase === 'FINISHED' && !ui.state.savedToHistory) {
      ui.state.savedToHistory = true;
      saveMatchToHistory(ui.state, generateReport(ui.state));
    }
    render();
  }

  function simulateToFullTime() {
    stopPlayback();
    if (!ui.state) startMatch();
    var guard = 0;
    while (ui.state.phase !== 'FINISHED' && guard < 240) {
      ui.state = advanceMinute(ui.state);
      guard++;
    }
    if (!ui.state.savedToHistory) {
      ui.state.savedToHistory = true;
      saveMatchToHistory(ui.state, generateReport(ui.state));
    }
    render();
  }

  // Custom Tournament Bracket helpers
  function createTournamentBracket(size) {
    var teams = window.STR_DATA.SIMULATOR_TEAMS.slice().sort(function () { return Math.random() - 0.5; }).slice(0, size);
    var round1 = [];
    for (var i = 0; i < teams.length; i += 2) {
      round1.push({ home: teams[i], away: teams[i + 1], homeScore: null, awayScore: null, winner: null });
    }
    var rounds = [round1];
    if (size === 8) rounds.push([{ home: null, away: null, homeScore: null, awayScore: null, winner: null }, { home: null, away: null, homeScore: null, awayScore: null, winner: null }]);
    rounds.push([{ home: null, away: null, homeScore: null, awayScore: null, winner: null }]);
    ui.tournamentBracket = rounds;
    ui.activeBracketMatch = null;
  }

  function advanceBracketWinner(entry) {
    var pos = ui.activeBracketMatch;
    if (!pos || !ui.tournamentBracket) return;
    var match = ui.tournamentBracket[pos.roundIdx] && ui.tournamentBracket[pos.roundIdx][pos.matchIdx];
    if (!match) return;
    match.homeScore = entry.homeScore;
    match.awayScore = entry.awayScore;
    var winTeam = (entry.homeScore > entry.awayScore || entry.homePenScore > entry.awayPenScore) ? match.home : match.away;
    match.winner = winTeam;
    var nextRound = ui.tournamentBracket[pos.roundIdx + 1];
    if (nextRound) {
      var nextMatch = nextRound[Math.floor(pos.matchIdx / 2)];
      if (pos.matchIdx % 2 === 0) nextMatch.home = winTeam; else nextMatch.away = winTeam;
    }
    ui.activeBracketMatch = null;
    if (window.STR_TOAST) window.STR_TOAST(winTeam.shortName + ' advances in tournament!', 'success');
  }

  function renderPitchHTML(st) {
    var slotsH = window.STR_DATA.FORMATION_SLOTS[st.formationHome] || window.STR_DATA.FORMATION_SLOTS['4-3-3'];
    var slotsA = window.STR_DATA.FORMATION_SLOTS[st.formationAway] || window.STR_DATA.FORMATION_SLOTS['4-3-3'];
    var activeH = st.homeRoster.filter(function (r) { return r.onPitch && !r.redCard; });
    var activeA = st.awayRoster.filter(function (r) { return r.onPitch && !r.redCard; });

    var nodes = '';
    activeH.slice(0, 11).forEach(function (ls, i) {
      var sl = slotsH[i] || slotsH[slotsH.length - 1];
      var left = (sl.x * 0.88).toFixed(1);
      var top = sl.y.toFixed(1);
      var bg = st.homeTeam.primaryColor || '#e11d48';
      var fg = st.homeTeam.secondaryColor || '#ffffff';
      nodes += '<button class="pitch-node" data-sim-player="' + ls.player.id + '" style="left:' + left + '%;top:' + top + '%" title="' + ls.player.name + ' (' + ls.rating.toFixed(1) + ')">' +
        '<div class="pitch-shirt" style="background:' + bg + ';color:' + fg + ';">' + ls.player.jersey +
        '<span class="pitch-rating ' + (ls.rating >= 7.5 ? 'high' : '') + '">' + ls.rating.toFixed(1) + '</span></div>' +
        '<div class="pitch-stamina"><div style="width:' + Math.round(ls.stamina) + '%"></div></div>' +
        '<span class="pitch-name">' + ls.player.shortName + '</span></button>';
    });

    activeA.slice(0, 11).forEach(function (ls, i) {
      var sl = slotsA[i] || slotsA[slotsA.length - 1];
      var left = (100 - sl.x * 0.88).toFixed(1);
      var top = (100 - sl.y).toFixed(1);
      var bg = st.awayTeam.primaryColor || '#38bdf8';
      var fg = st.awayTeam.secondaryColor || '#0f172a';
      nodes += '<button class="pitch-node" data-sim-player="' + ls.player.id + '" style="left:' + left + '%;top:' + top + '%" title="' + ls.player.name + ' (' + ls.rating.toFixed(1) + ')">' +
        '<div class="pitch-shirt" style="background:' + bg + ';color:' + fg + ';">' + ls.player.jersey +
        '<span class="pitch-rating ' + (ls.rating >= 7.5 ? 'high' : '') + '">' + ls.rating.toFixed(1) + '</span></div>' +
        '<div class="pitch-stamina"><div style="width:' + Math.round(ls.stamina) + '%"></div></div>' +
        '<span class="pitch-name">' + ls.player.shortName + '</span></button>';
    });

    var flash = st.activeFlash
      ? '<div class="pitch-flash"><div class="badge-accent">' + st.activeFlash.title + '</div><div style="font-size:0.82rem;font-weight:700">' + st.activeFlash.subtitle + '</div></div>'
      : '';

    return '<div class="sim-pitch">' +
      '<svg class="pitch-svg" viewBox="0 0 100 64" preserveAspectRatio="none">' +
      '<rect x="2" y="2" width="96" height="60" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="0.45"/>' +
      '<line x1="50" y1="2" x2="50" y2="62" stroke="rgba(255,255,255,0.4)" stroke-width="0.4"/>' +
      '<circle cx="50" cy="32" r="7.5" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.4"/>' +
      '<circle cx="50" cy="32" r="0.6" fill="rgba(255,255,255,0.7)"/>' +
      '<rect x="2" y="16" width="13" height="32" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.4"/>' +
      '<rect x="85" y="16" width="13" height="32" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.4"/>' +
      '<rect x="2" y="24" width="5" height="16" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="0.35"/>' +
      '<rect x="93" y="24" width="5" height="16" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="0.35"/>' +
      '</svg>' +
      nodes +
      '<div class="pitch-ball" style="left:' + st.ballPos.x + '%;top:' + st.ballPos.y + '%"></div>' +
      flash +
      '</div>';
  }

  function renderStatBar(label, hv, av, hNum, aNum) {
    var tot = Math.max(1, hNum + aNum);
    var hp = Math.round((hNum / tot) * 100);
    return '<div class="stack-sm" style="margin-bottom:10px">' +
      '<div class="flex-between" style="font-size:0.78rem;font-weight:700">' +
      '<span class="font-mono-tabular">' + hv + '</span>' +
      '<span class="text-muted">' + label + '</span>' +
      '<span class="font-mono-tabular">' + av + '</span></div>' +
      '<div class="stat-bar-track"><div class="stat-bar-home" style="width:' + hp + '%"></div><div class="stat-bar-away" style="width:' + (100 - hp) + '%"></div></div>' +
      '</div>';
  }

  function render(container) {
    var el = container || document.getElementById('app-main');
    if (!el || window.STR_CURRENT_VIEW !== 'simulator') return;
    if (!ui.state) startMatch();
    var st = ui.state;
    var report = generateReport(st);
    var teams = window.STR_DATA.SIMULATOR_TEAMS;
    var styles = window.STR_DATA.TACTICAL_STYLES;

    var modeChips = SIM_MODES.map(function (m) {
      return '<button class="tab-chip ' + (ui.mode === m.id ? 'active' : '') + '" data-sim-mode="' + m.id + '">' + m.label + '</button>';
    }).join('');

    var teamOpts = function (selectedId) {
      return teams.map(function (t) {
        return '<option value="' + t.id + '"' + (t.id === selectedId ? ' selected' : '') + '>' + t.name + ' (' + t.ratings.ovr + ')</option>';
      }).join('');
    };

    var styleOpts = function (selectedStyle) {
      return styles.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === selectedStyle ? ' selected' : '') + '>' + s.label + '</option>';
      }).join('');
    };

    var formOpts = function (selectedForm) {
      return FORMATIONS.map(function (f) {
        return '<option value="' + f + '"' + (f === selectedForm ? ' selected' : '') + '>' + f + '</option>';
      }).join('');
    };

    var subContent = '';
    if (ui.subTab === 'pitch') {
      subContent = '<div class="stack-md">' +
        renderPitchHTML(st) +
        '<div class="card-sm flex-between">' +
        '<div class="flex-wrap">' +
        '<button class="btn-primary btn-sm" id="sim-play-btn">' + (ui.playing ? '⏸ Pause' : st.phase === 'FINISHED' ? 'Match Finished' : '▶ Play Live') + '</button>' +
        '<button class="btn-secondary btn-sm" id="sim-step-btn">+1 Min</button>' +
        '<button class="btn-secondary btn-sm" id="sim-ft-btn">Sim to FT</button>' +
        '<button class="btn-secondary btn-sm" id="sim-reset-btn">↻ Kick-Off</button>' +
        '</div>' +
        '<div class="flex-wrap">' +
        '<span class="text-muted" style="font-size:0.75rem">Speed:</span>' +
        [1, 2, 4].map(function (sp) {
          return '<button class="tab-chip ' + (ui.speed === sp ? 'active' : '') + '" data-sim-speed="' + sp + '">' + sp + 'x</button>';
        }).join('') +
        '</div></div>' +
        '<div class="card-sm">' +
        '<div class="flex-between" style="margin-bottom:8px"><strong>Live Tactical Mentality (' + st.homeTeam.shortName + ')</strong>' +
        '<span class="text-muted" style="font-size:0.74rem">Subs used: ' + st.subsUsedHome + '/5</span></div>' +
        '<div class="flex-wrap">' +
        MENTALITIES.map(function (m) {
          return '<button class="tab-chip ' + (st.mentalityHome === m ? 'active' : '') + '" data-sim-mentality="' + m + '">' + m + '</button>';
        }).join('') +
        '</div></div>' +
        '<div class="card-sm stack-sm"><strong>Latest Commentary</strong>' +
        st.events.slice(0, 6).map(function (ev) {
          return '<div class="card-subtle" style="padding:8px 12px;font-size:0.8rem"><span class="badge-accent" style="margin-right:8px">' + ev.minuteLabel + '</span>' + ev.text + '</div>';
        }).join('') +
        '</div></div>';
    } else if (ui.subTab === 'timeline') {
      subContent = '<div class="card stack-sm"><h3>Full Match Timeline</h3>' +
        st.events.map(function (ev) {
          return '<div class="card-subtle flex-between" style="padding:10px 14px"><div><span class="badge-accent" style="margin-right:8px">' + ev.minuteLabel + '</span><span style="font-size:0.84rem">' + ev.text + '</span></div><span class="text-muted" style="font-size:0.7rem;text-transform:uppercase">' + ev.type + '</span></div>';
        }).join('') +
        '</div>';
    } else if (ui.subTab === 'stats') {
      subContent = '<div class="card"><h3>Live Match Telemetry</h3>' +
        renderStatBar('Possession', st.stats.possessionHome + '%', st.stats.possessionAway + '%', st.stats.possessionHome, st.stats.possessionAway) +
        renderStatBar('Total Shots', st.stats.shotsHome, st.stats.shotsAway, st.stats.shotsHome, st.stats.shotsAway) +
        renderStatBar('Shots on Target', st.stats.shotsOnTargetHome, st.stats.shotsOnTargetAway, st.stats.shotsOnTargetHome, st.stats.shotsOnTargetAway) +
        renderStatBar('Expected Goals (xG)', st.stats.xgHome.toFixed(2), st.stats.xgAway.toFixed(2), st.stats.xgHome, st.stats.xgAway) +
        renderStatBar('Pass Accuracy', st.stats.passAccHome + '%', st.stats.passAccAway + '%', st.stats.passAccHome, st.stats.passAccAway) +
        renderStatBar('Corners', st.stats.cornersHome, st.stats.cornersAway, st.stats.cornersHome, st.stats.cornersAway) +
        renderStatBar('Fouls', st.stats.foulsHome, st.stats.foulsAway, st.stats.foulsHome, st.stats.foulsAway) +
        renderStatBar('Yellow Cards', st.stats.yellowHome, st.stats.yellowAway, st.stats.yellowHome, st.stats.yellowAway) +
        '</div>';
    } else if (ui.subTab === 'lineups') {
      var roster = ui.editingSide === 'home' ? st.homeRoster : st.awayRoster;
      var starters = roster.filter(function (r) { return r.onPitch; });
      var bench = roster.filter(function (r) { return !r.onPitch; });
      subContent = '<div class="card stack-md">' +
        '<div class="flex-between"><h3>Lineup & Live Substitutions</h3>' +
        '<div class="flex-wrap">' +
        '<button class="tab-chip ' + (ui.editingSide === 'home' ? 'active' : '') + '" data-sim-side="home">' + st.homeTeam.shortName + '</button>' +
        '<button class="tab-chip ' + (ui.editingSide === 'away' ? 'active' : '') + '" data-sim-side="away">' + st.awayTeam.shortName + '</button>' +
        '</div></div>' +
        '<p class="text-muted" style="font-size:0.78rem;margin:0">Click a Starter, then click a Bench player to make an immediate substitution.</p>' +
        '<div class="grid-2">' +
        '<div class="stack-sm"><strong>On Pitch (11)</strong>' +
        starters.map(function (r, idx) {
          return '<button class="card-subtle flex-between" style="width:100%;cursor:pointer;border-color:' + (ui.selectedStarterIdx === idx ? 'var(--crimson)' : 'var(--border)') + '" data-sim-starter="' + idx + '">' +
            '<span>#' + r.player.jersey + ' <strong>' + r.player.name + '</strong> <small class="text-muted">(' + r.player.position + ')</small></span>' +
            '<span class="font-mono-tabular">' + Math.round(r.stamina) + '% ⚡</span></button>';
        }).join('') +
        '</div>' +
        '<div class="stack-sm"><strong>Substitutes Bench</strong>' +
        bench.map(function (r, idx) {
          return '<button class="card-subtle flex-between" style="width:100%;cursor:pointer" data-sim-bench="' + idx + '">' +
            '<span>#' + r.player.jersey + ' <strong>' + r.player.name + '</strong> <small class="text-muted">(' + r.player.position + ')</small></span>' +
            '<span class="text-emerald font-mono-tabular">' + r.player.overall + ' OVR</span></button>';
        }).join('') +
        '</div></div></div>';
    } else if (ui.subTab === 'ratings') {
      var renderRates = function (title, roster) {
        return '<div class="card stack-sm"><h4>' + title + '</h4>' +
          roster.filter(function (r) { return r.onPitch || r.goals > 0 || r.assists > 0; }).sort(function (a, b) { return b.rating - a.rating; }).map(function (r) {
            return '<div class="flex-between" style="font-size:0.8rem;padding:6px 0;border-bottom:1px solid var(--border)">' +
              '<span>' + r.player.name + ' <small class="text-muted">(' + r.player.position + ')</small>' + (r.goals ? ' ⚽x' + r.goals : '') + (r.assists ? ' 🅰️x' + r.assists : '') + '</span>' +
              '<strong class="font-mono-tabular ' + (r.rating >= 7.5 ? 'text-amber' : 'text-emerald') + '">' + r.rating.toFixed(1) + '</strong></div>';
          }).join('') + '</div>';
      };
      subContent = '<div class="grid-2">' + renderRates(st.homeTeam.name, st.homeRoster) + renderRates(st.awayTeam.name, st.awayRoster) + '</div>';
    } else if (ui.subTab === 'report') {
      subContent = '<div class="card stack-md">' +
        '<div class="badge-accent">FINAL MATCH REPORT · ' + st.competitionLabel + '</div>' +
        '<h2 class="font-display" style="margin:0;font-size:1.9rem">' + report.headline + '</h2>' +
        '<div class="grid-3">' +
        '<div class="card-subtle"><span class="text-muted" style="font-size:0.74rem">Man of the Match</span><div style="font-weight:800;font-size:1.05rem;margin-top:4px">⭐ ' + report.motmName + '</div><div class="text-amber font-mono-tabular">' + report.motmRating.toFixed(1) + ' Rating · ' + report.motmTeam + '</div></div>' +
        '<div class="card-subtle"><span class="text-muted" style="font-size:0.74rem">Expected Goals (xG)</span><div style="font-weight:800;font-size:1.05rem;margin-top:4px" class="font-mono-tabular">' + st.stats.xgHome.toFixed(2) + ' vs ' + st.stats.xgAway.toFixed(2) + '</div><div class="text-muted" style="font-size:0.76rem">Shots: ' + st.stats.shotsHome + ' vs ' + st.stats.shotsAway + '</div></div>' +
        '<div class="card-subtle"><span class="text-muted" style="font-size:0.74rem">Result Status</span><div style="font-weight:800;font-size:1.05rem;margin-top:4px">' + st.phase + '</div><div class="text-muted" style="font-size:0.76rem">' + (st.shootoutKicks.length ? 'Penalties ' + st.homePenScore + '-' + st.awayPenScore : st.minute + "'") + '</div></div>' +
        '</div></div>';
    } else if (ui.subTab === 'history') {
      subContent = '<div class="card stack-sm"><div class="flex-between"><h3>Saved Simulation History</h3>' +
        '<button class="btn-secondary btn-sm" id="sim-clear-hist">Clear Local</button></div>' +
        (!ui.history.length ? '<p class="text-muted">Finish or Sim-to-FT any match to record it in history.</p>' : ui.history.map(function (h) {
          return '<div class="card-subtle flex-between"><div><div class="badge-accent">' + h.competitionLabel + '</div><strong>' + h.homeName + ' ' + h.homeScore + ' - ' + h.awayScore + ' ' + h.awayName + '</strong>' + (h.wentToPenalties ? ' <small>(PEN ' + h.homePenScore + '-' + h.awayPenScore + ')</small>' : '') + '<div class="text-muted" style="font-size:0.75rem">MOTM: ' + h.manOfTheMatch + ' (' + h.motmRating + ')</div></div><span class="text-muted" style="font-size:0.72rem">' + new Date(h.createdAt).toLocaleDateString() + '</span></div>';
        }).join('')) + '</div>';
    }

    var specialModePanel = '';
    if (ui.mode === 'tournament') {
      if (!ui.tournamentBracket) createTournamentBracket(ui.tournamentSize);
      specialModePanel = '<div class="card stack-md"><div class="flex-between"><div><span class="badge-accent">CUSTOM KNOCKOUT TOURNAMENT</span><h3 style="margin:2px 0 0">Playable Knockout Bracket</h3></div>' +
        '<div class="flex-wrap"><button class="tab-chip ' + (ui.tournamentSize === 4 ? 'active' : '') + '" data-sim-tsize="4">4 Teams</button><button class="tab-chip ' + (ui.tournamentSize === 8 ? 'active' : '') + '" data-sim-tsize="8">8 Teams</button><button class="btn-secondary btn-sm" id="sim-new-bracket">New Draw</button></div></div>' +
        '<div class="grid-3">' + ui.tournamentBracket.map(function (rnd, rIdx) {
          return '<div class="stack-sm"><strong>' + (rIdx === ui.tournamentBracket.length - 1 ? 'FINAL' : 'Round ' + (rIdx + 1)) + '</strong>' +
            rnd.map(function (m, mIdx) {
              return '<div class="card-subtle stack-sm"><div>' + (m.home ? m.home.shortName : 'TBD') + ' vs ' + (m.away ? m.away.shortName : 'TBD') + '</div>' +
                (m.winner ? '<div class="text-emerald" style="font-size:0.76rem;font-weight:700">Winner: ' + m.winner.shortName + ' (' + m.homeScore + '-' + m.awayScore + ')</div>' : (m.home && m.away ? '<button class="btn-primary btn-sm" data-sim-play-tie="' + rIdx + ':' + mIdx + '">Load &amp; Play Tie</button>' : '')) + '</div>';
            }).join('') + '</div>';
        }).join('') + '</div></div>';
    } else if (ui.mode === 'dream') {
      var activeIds = ui.dreamSide === 'home' ? ui.dreamHomeIds : ui.dreamAwayIds;
      specialModePanel = '<div class="card stack-md"><div class="flex-between"><div><span class="badge-accent">DREAM MATCH DRAFTER</span><h3 style="margin:2px 0 0">Draft Custom 11-Player Squads (' + activeIds.length + '/11)</h3></div>' +
        '<div class="flex-wrap"><button class="tab-chip ' + (ui.dreamSide === 'home' ? 'active' : '') + '" data-sim-dside="home">Home XI</button><button class="tab-chip ' + (ui.dreamSide === 'away' ? 'active' : '') + '" data-sim-dside="away">Away XI</button><button class="btn-primary btn-sm" id="sim-apply-dream">Apply Dream Squads</button></div></div>' +
        '<div class="grid-4" style="max-height:240px;overflow-y:auto">' +
        window.STR_DATA.ALL_SIM_PLAYERS_POOL.slice(0, 48).map(function (pl) {
          var picked = activeIds.indexOf(pl.id) >= 0;
          return '<button class="card-subtle flex-between" style="cursor:pointer;border-color:' + (picked ? 'var(--crimson)' : 'var(--border)') + '" data-sim-pick="' + pl.id + '">' +
            '<span style="font-size:0.76rem;font-weight:700;text-align:left">' + pl.shortName + '<br><small class="text-muted">' + pl.position + '</small></span>' +
            '<strong class="text-crimson font-mono-tabular">' + pl.overall + '</strong></button>';
        }).join('') + '</div></div>';
    }

    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="card stack-md">' +
      '<div class="flex-between"><div><span class="badge-accent">STR PRO ENGINE · 0–90+ MIN</span><h1 class="font-display" style="margin:2px 0 0;font-size:2rem">Football Match Simulator</h1></div>' +
      '<div class="flex-wrap">' + modeChips + '</div></div>' +
      '<div class="grid-2">' +
      '<div class="card-subtle stack-sm"><div class="flex-between"><strong>HOME SIDE</strong><span class="badge-accent">' + st.homeTeam.ratings.ovr + ' OVR</span></div>' +
      '<select class="select" id="sim-home-team">' + teamOpts(ui.homeId) + '</select>' +
      '<div class="grid-2"><select class="select" id="sim-home-form">' + formOpts(ui.formationHome) + '</select><select class="select" id="sim-home-style">' + styleOpts(ui.styleHome) + '</select></div></div>' +
      '<div class="card-subtle stack-sm"><div class="flex-between"><strong>AWAY SIDE</strong><span class="badge-accent">' + st.awayTeam.ratings.ovr + ' OVR</span></div>' +
      '<select class="select" id="sim-away-team">' + teamOpts(ui.awayId) + '</select>' +
      '<div class="grid-2"><select class="select" id="sim-away-form">' + formOpts(ui.formationAway) + '</select><select class="select" id="sim-away-style">' + styleOpts(ui.styleAway) + '</select></div></div>' +
      '</div></div>' +
      specialModePanel +
      '<div class="card" style="background:linear-gradient(120deg,#0f1219,#17111b);color:#fff">' +
      '<div class="match-row" style="margin-top:0">' +
      '<div style="text-align:right"><div class="font-display" style="font-size:1.55rem;font-weight:800">' + st.homeTeam.name + '</div><div class="text-muted" style="font-size:0.75rem">' + st.formationHome + ' · ' + st.styleHome + '</div></div>' +
      '<div style="text-align:center;min-width:130px"><div class="badge-accent">' + st.competitionLabel + ' · ' + (st.phase === 'FINISHED' ? 'FINAL' : st.minute + "'") + '</div><div class="font-display font-mono-tabular" style="font-size:2.6rem;font-weight:800;line-height:1.1">' + st.homeScore + ' - ' + st.awayScore + '</div>' + (st.shootoutKicks.length ? '<div class="text-amber" style="font-size:0.78rem;font-weight:700">PEN ' + st.homePenScore + ' - ' + st.awayPenScore + '</div>' : '') + '</div>' +
      '<div style="text-align:left"><div class="font-display" style="font-size:1.55rem;font-weight:800">' + st.awayTeam.name + '</div><div class="text-muted" style="font-size:0.75rem">' + st.formationAway + ' · ' + st.styleAway + '</div></div>' +
      '</div></div>' +
      '<div class="filter-row">' +
      [['pitch', '2D Pitch & Live'], ['timeline', 'Timeline (' + st.events.length + ')'], ['stats', 'Statistics'], ['lineups', 'Lineups & Subs'], ['ratings', 'Player Ratings'], ['report', 'Match Report'], ['history', 'Saved History (' + ui.history.length + ')']].map(function (t) {
        return '<button class="tab-chip ' + (ui.subTab === t[0] ? 'active' : '') + '" data-sim-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') +
      '</div>' + subContent + '</div>';

    // Wire events
    el.querySelectorAll('[data-sim-mode]').forEach(function (b) {
      b.onclick = function () {
        ui.mode = b.getAttribute('data-sim-mode');
        var mm = SIM_MODES.find(function (m) { return m.id === ui.mode; });
        ui.knockout = mm ? mm.knockout : false;
        startMatch();
      };
    });
    el.querySelectorAll('[data-sim-tab]').forEach(function (b) {
      b.onclick = function () { ui.subTab = b.getAttribute('data-sim-tab'); render(); };
    });
    el.querySelectorAll('[data-sim-speed]').forEach(function (b) {
      b.onclick = function () {
        ui.speed = Number(b.getAttribute('data-sim-speed'));
        if (ui.playing) { stopPlayback(); togglePlay(); } else render();
      };
    });
    el.querySelectorAll('[data-sim-mentality]').forEach(function (b) {
      b.onclick = function () { ui.state.mentalityHome = b.getAttribute('data-sim-mentality'); render(); };
    });
    el.querySelectorAll('[data-sim-side]').forEach(function (b) {
      b.onclick = function () { ui.editingSide = b.getAttribute('data-sim-side'); ui.selectedStarterIdx = null; render(); };
    });
    el.querySelectorAll('[data-sim-starter]').forEach(function (b) {
      b.onclick = function () { ui.selectedStarterIdx = Number(b.getAttribute('data-sim-starter')); render(); };
    });
    el.querySelectorAll('[data-sim-bench]').forEach(function (b) {
      b.onclick = function () {
        if (ui.selectedStarterIdx === null) {
          if (window.STR_TOAST) window.STR_TOAST('Select a starter first, then click a bench player.', 'error');
          return;
        }
        var roster = ui.editingSide === 'home' ? ui.state.homeRoster : ui.state.awayRoster;
        var starters = roster.filter(function (r) { return r.onPitch; });
        var bench = roster.filter(function (r) { return !r.onPitch; });
        var s = starters[ui.selectedStarterIdx];
        var bn = bench[Number(b.getAttribute('data-sim-bench'))];
        if (s && bn) {
          s.onPitch = false;
          bn.onPitch = true;
          if (ui.editingSide === 'home') ui.state.subsUsedHome++; else ui.state.subsUsedAway++;
          ui.state.events.unshift({ id: uid('ev'), minute: ui.state.minute, minuteLabel: ui.state.minute + "'", type: 'sub', side: ui.editingSide, text: 'Manual Sub: ' + bn.player.shortName + ' replaces ' + s.player.shortName + '.', isKey: true });
          ui.selectedStarterIdx = null;
          render();
        }
      };
    });
    el.querySelectorAll('[data-sim-tsize]').forEach(function (b) {
      b.onclick = function () { ui.tournamentSize = Number(b.getAttribute('data-sim-tsize')); createTournamentBracket(ui.tournamentSize); render(); };
    });
    el.querySelectorAll('[data-sim-play-tie]').forEach(function (b) {
      b.onclick = function () {
        var parts = b.getAttribute('data-sim-play-tie').split(':');
        var rIdx = Number(parts[0]), mIdx = Number(parts[1]);
        var match = ui.tournamentBracket[rIdx][mIdx];
        if (match && match.home && match.away) {
          ui.activeBracketMatch = { roundIdx: rIdx, matchIdx: mIdx };
          ui.homeId = match.home.id;
          ui.awayId = match.away.id;
          ui.knockout = true;
          startMatch();
        }
      };
    });
    el.querySelectorAll('[data-sim-dside]').forEach(function (b) {
      b.onclick = function () { ui.dreamSide = b.getAttribute('data-sim-dside'); render(); };
    });
    el.querySelectorAll('[data-sim-pick]').forEach(function (b) {
      b.onclick = function () {
        var pid = b.getAttribute('data-sim-pick');
        var arr = ui.dreamSide === 'home' ? ui.dreamHomeIds : ui.dreamAwayIds;
        var idx = arr.indexOf(pid);
        if (idx >= 0) arr.splice(idx, 1);
        else if (arr.length < 11) arr.push(pid);
        else if (window.STR_TOAST) window.STR_TOAST('11 starters maximum. Remove a player first.', 'error');
        render();
      };
    });

    var bindSel = function (id, prop, restart) {
      var s = document.getElementById(id);
      if (s) s.onchange = function () { ui[prop] = s.value; if (restart) startMatch(); else render(); };
    };
    bindSel('sim-home-team', 'homeId', true);
    bindSel('sim-away-team', 'awayId', true);
    bindSel('sim-home-form', 'formationHome', true);
    bindSel('sim-away-form', 'formationAway', true);
    bindSel('sim-home-style', 'styleHome', true);
    bindSel('sim-away-style', 'styleAway', true);

    var byId = function (id, fn) { var n = document.getElementById(id); if (n) n.onclick = fn; };
    byId('sim-play-btn', togglePlay);
    byId('sim-step-btn', stepOneMinute);
    byId('sim-ft-btn', simulateToFullTime);
    byId('sim-reset-btn', startMatch);
    byId('sim-new-bracket', function () { createTournamentBracket(ui.tournamentSize); render(); });
    byId('sim-apply-dream', startMatch);
    byId('sim-clear-hist', function () {
      ui.history = [];
      localStorage.removeItem('str_standalone_sim_history');
      render();
    });
  }

  window.STR_SIMULATOR = {
    render: render,
    stop: stopPlayback
  };
})();
