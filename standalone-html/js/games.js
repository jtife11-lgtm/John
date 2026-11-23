(function () {
  var gState = {
    activeGame: 'penalty',
    difficulty: 'Medium',
    xp: Number(localStorage.getItem('str_standalone_xp') || 0),
    pen: { shots: 0, goals: 0, msg: 'Aim Left, Center, or Right and strike!' },
    fk: { attempts: 0, goals: 0, curve: 'Top Corner', msg: 'Pick curve & beat the defensive wall.' },
    gk: { saves: 0, attempts: 0, promptDir: null, msg: 'Click Start Shot to test goalkeeper reflexes!' },
    triviaIdx: 0,
    triviaScore: 0,
    triviaPicked: null,
    clueIdx: 0,
    clueStep: 1,
    clueGuess: '',
    clueMsg: '',
    clubIdx: 0,
    clubPicked: null,
    offIdx: 0,
    offMsg: '',
    txIdx: 0,
    txMsg: '',
    scramIdx: 0,
    scramGuess: '',
    scramMsg: '',
    jerseyIdx: 0,
    jerseyPicked: null
  };

  function addXp(basePts) {
    var cfg = window.STR_DATA.DIFFICULTY_CONFIG[gState.difficulty] || window.STR_DATA.DIFFICULTY_CONFIG.Medium;
    var pts = Math.round(basePts * cfg.multiplier);
    gState.xp += pts;
    try { localStorage.setItem('str_standalone_xp', String(gState.xp)); } catch (e) {}
    if (window.STR_FB && window.STR_FB.addUserPoints) window.STR_FB.addUserPoints(pts);
    if (window.STR_TOAST) window.STR_TOAST('+' + pts + ' XP (' + gState.difficulty + ')', 'success');
  }

  function renderGames(container) {
    var el = container || document.getElementById('app-main');
    if (!el || window.STR_CURRENT_VIEW !== 'games') return;
    var d = window.STR_DATA;
    var diffCfg = d.DIFFICULTY_CONFIG[gState.difficulty];
    var allTrivia = d.TRIVIA_QUESTIONS.concat(d.EXTRA_TRIVIA_QUESTIONS || []);

    var GAMES_LIST = [
      { id: 'penalty', name: 'Penalty Shootout' },
      { id: 'freekick', name: 'Free Kick Challenge' },
      { id: 'reflex', name: 'GK Reflex Save' },
      { id: 'trivia', name: 'Football Trivia (' + allTrivia.length + ')' },
      { id: 'whoami', name: 'Who Am I?' },
      { id: 'clubquiz', name: 'Club Crest Quiz' },
      { id: 'offside', name: 'VAR Offside Referee' },
      { id: 'transfer', name: 'Transfer Fee Duels' },
      { id: 'scramble', name: 'Word Scramble' },
      { id: 'jersey', name: 'Jersey Number Quiz' }
    ];

    var stage = '';
    if (gState.activeGame === 'penalty') {
      stage = '<div class="card stack-md"><h3>⚽ Penalty Shootout</h3><p class="text-muted">' + gState.pen.msg + '</p>' +
        '<div class="flex-between"><strong>Score: ' + gState.pen.goals + ' / ' + gState.pen.shots + '</strong><button class="btn-secondary btn-sm" id="pen-reset">Reset</button></div>' +
        '<div class="grid-3">' +
        ['Left Post', 'Center', 'Right Post'].map(function (zone, idx) {
          return '<button class="btn-primary" data-pen-zone="' + idx + '">' + zone + '</button>';
        }).join('') + '</div></div>';
    } else if (gState.activeGame === 'freekick') {
      stage = '<div class="card stack-md"><h3>🎯 Free Kick Challenge</h3><p class="text-muted">' + gState.fk.msg + '</p>' +
        '<div class="flex-between"><strong>Goals: ' + gState.fk.goals + ' / ' + gState.fk.attempts + '</strong>' +
        '<div class="flex-wrap">' + ['Top Left', 'Dipping Center', 'Top Right'].map(function (c) {
          return '<button class="tab-chip ' + (gState.fk.curve === c ? 'active' : '') + '" data-fk-curve="' + c + '">' + c + '</button>';
        }).join('') + '</div></div>' +
        '<button class="btn-primary" id="fk-shoot">Strike Free Kick (' + gState.fk.curve + ')</button></div>';
    } else if (gState.activeGame === 'reflex') {
      stage = '<div class="card stack-md"><h3>🧤 Goalkeeper Reflex Save</h3><p class="text-muted">' + gState.gk.msg + '</p>' +
        '<div class="flex-between"><strong>Saves: ' + gState.gk.saves + ' / ' + gState.gk.attempts + '</strong><span class="badge-accent">' + diffCfg.reflexWindowMs + 'ms window</span></div>' +
        '<button class="btn-primary" id="gk-start">Launch AI Shot</button>' +
        '<div class="grid-3">' +
        ['Dive Left', 'Stand Center', 'Dive Right'].map(function (lbl, idx) {
          return '<button class="btn-secondary" data-gk-dive="' + idx + '">' + lbl + '</button>';
        }).join('') + '</div></div>';
    } else if (gState.activeGame === 'trivia') {
      var q = allTrivia[gState.triviaIdx % allTrivia.length];
      stage = '<div class="card stack-md"><div class="flex-between"><h3>🧠 Football Trivia</h3><span class="badge-accent">Score: ' + gState.triviaScore + '</span></div>' +
        '<p style="font-weight:700;font-size:1.02rem">' + q.question + '</p>' +
        '<div class="grid-2">' + q.options.map(function (opt, i) {
          var cls = 'btn-secondary';
          if (gState.triviaPicked !== null) {
            if (i === q.answerIndex) cls = 'btn-primary';
          }
          return '<button class="' + cls + '" data-triv-opt="' + i + '">' + opt + '</button>';
        }).join('') + '</div>' +
        (gState.triviaPicked !== null ? '<div class="card-subtle">' + q.fact + '</div><button class="btn-primary btn-sm" id="triv-next">Next Question</button>' : '') +
        '</div>';
    } else if (gState.activeGame === 'whoami') {
      var item = d.PLAYER_CLUES_GAME[gState.clueIdx % d.PLAYER_CLUES_GAME.length];
      stage = '<div class="card stack-md"><h3>🕵️ Who Am I? Mystery Player</h3>' +
        item.clues.slice(0, gState.clueStep).map(function (c, i) {
          return '<div class="card-subtle"><strong>Clue ' + (i + 1) + ':</strong> ' + c + '</div>';
        }).join('') +
        '<div class="flex-wrap">' +
        (gState.clueStep < item.clues.length ? '<button class="btn-secondary btn-sm" id="clue-more">Reveal Next Clue</button>' : '') +
        '<input class="input" style="max-width:260px" id="clue-input" placeholder="Type player name..." value="' + gState.clueGuess.replace(/"/g, '&quot;') + '">' +
        '<button class="btn-primary btn-sm" id="clue-submit">Check</button>' +
        '<button class="btn-secondary btn-sm" id="clue-skip">Next Player</button></div>' +
        (gState.clueMsg ? '<div class="badge-accent">' + gState.clueMsg + '</div>' : '') + '</div>';
    } else if (gState.activeGame === 'clubquiz') {
      var cq = d.CLUB_LOGO_QUIZ[gState.clubIdx % d.CLUB_LOGO_QUIZ.length];
      stage = '<div class="card stack-md"><h3>🛡️ Guess the Club</h3>' +
        '<div class="card-subtle flex-between"><div><div style="font-weight:800">' + cq.symbolHint + '</div><div class="text-muted" style="font-size:0.78rem">' + cq.league + ' · ' + cq.city + '</div></div>' +
        '<div style="display:flex;gap:6px">' + cq.colors.map(function (c) { return '<span style="width:24px;height:24px;border-radius:6px;background:' + c + ';border:1px solid #fff"></span>'; }).join('') + '</div></div>' +
        '<div class="grid-2">' + cq.options.map(function (opt) {
          return '<button class="' + (gState.clubPicked === opt && opt === cq.club ? 'btn-primary' : 'btn-secondary') + '" data-club-opt="' + opt + '">' + opt + '</button>';
        }).join('') + '</div>' +
        (gState.clubPicked ? '<button class="btn-primary btn-sm" id="club-next">Next Club</button>' : '') + '</div>';
    } else if (gState.activeGame === 'offside') {
      var os = d.OFFSIDE_SCENARIOS[gState.offIdx % d.OFFSIDE_SCENARIOS.length];
      stage = '<div class="card stack-md"><h3>📺 VAR Offside Referee</h3><p><strong>' + os.title + '</strong></p>' +
        '<div class="card-subtle font-mono-tabular">Ball x=' + os.ballX + ' | 2nd-last Defender x=' + os.defenderX + ' | Attacker x=' + os.attackerX + '</div>' +
        '<div class="flex-wrap"><button class="btn-primary" id="off-yes">OFFSIDE</button><button class="btn-secondary" id="off-no">ONSIDE</button><button class="btn-secondary btn-sm" id="off-next">Next Scenario</button></div>' +
        (gState.offMsg ? '<div class="card-subtle">' + gState.offMsg + '</div>' : '') + '</div>';
    } else if (gState.activeGame === 'transfer') {
      var td = d.TRANSFER_FEE_DUELS[gState.txIdx % d.TRANSFER_FEE_DUELS.length];
      stage = '<div class="card stack-md"><h3>💶 Transfer Fee Duel — Which Fee Was Higher?</h3>' +
        '<div class="grid-2">' +
        '<button class="card-subtle" style="cursor:pointer;text-align:left" id="tx-a"><strong>' + td.playerA + '</strong><div class="text-muted">' + td.moveA + '</div></button>' +
        '<button class="card-subtle" style="cursor:pointer;text-align:left" id="tx-b"><strong>' + td.playerB + '</strong><div class="text-muted">' + td.moveB + '</div></button>' +
        '</div>' + (gState.txMsg ? '<div class="card-subtle">' + gState.txMsg + '</div>' : '') +
        '<button class="btn-primary btn-sm" id="tx-next">Next Duel</button></div>';
    } else if (gState.activeGame === 'scramble') {
      var sc = d.WORD_SCRAMBLE_PLAYERS[gState.scramIdx % d.WORD_SCRAMBLE_PLAYERS.length];
      var scrambled = sc.name.split('').sort(function (a, b) { return a.charCodeAt(0) - b.charCodeAt(0); }).join(' ');
      stage = '<div class="card stack-md"><h3>🔤 Football Word Scramble</h3>' +
        '<div class="font-display font-mono-tabular" style="font-size:2rem;letter-spacing:0.15em">' + scrambled + '</div>' +
        '<p class="text-muted">Hint: ' + sc.hint + '</p>' +
        '<div class="flex-wrap"><input class="input" style="max-width:240px" id="scram-in" placeholder="Unscramble name..." value="' + gState.scramGuess + '">' +
        '<button class="btn-primary btn-sm" id="scram-go">Submit</button><button class="btn-secondary btn-sm" id="scram-next">Skip</button></div>' +
        (gState.scramMsg ? '<div class="badge-accent">' + gState.scramMsg + '</div>' : '') + '</div>';
    } else if (gState.activeGame === 'jersey') {
      var jq = d.JERSEY_NUMBER_QUIZ[gState.jerseyIdx % d.JERSEY_NUMBER_QUIZ.length];
      stage = '<div class="card stack-md"><h3>👕 Iconic Jersey Number Quiz</h3>' +
        '<p><strong>' + jq.player + '</strong> — <span class="text-muted">' + jq.context + '</span></p>' +
        '<div class="grid-4">' + jq.options.map(function (o) {
          return '<button class="' + (gState.jerseyPicked === o && o === jq.answer ? 'btn-primary' : 'btn-secondary') + '" data-jq-opt="' + o + '">' + o + '</button>';
        }).join('') + '</div>' +
        (gState.jerseyPicked ? '<button class="btn-primary btn-sm" id="jq-next">Next Player</button>' : '') + '</div>';
    }

    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="hero-banner"><img src="' + window.STR_CONFIG.GAMES_BANNER_IMG + '" alt="STR Games" class="hero-bg-img"><div class="hero-overlay"></div>' +
      '<div class="hero-inner"><div><span class="badge-accent">STR GAMING ARENA</span><h1 class="font-display" style="margin:4px 0;font-size:2.4rem">Playable Football Mini-Games</h1><p style="color:#cbd5e1;margin:0">' + GAMES_LIST.length + ' interactive challenges with 4 difficulty tiers.</p></div>' +
      '<div class="card-subtle" style="background:rgba(15,18,25,0.85)"><div class="text-muted" style="font-size:0.75rem">Total Arcade XP</div><div class="font-display font-mono-tabular text-amber" style="font-size:2.2rem;font-weight:800">' + gState.xp + ' XP</div><div class="badge-accent">' + diffCfg.badge + '</div></div></div></div>' +
      '<div class="flex-between"><div class="filter-row">' +
      GAMES_LIST.map(function (gm) {
        return '<button class="tab-chip ' + (gState.activeGame === gm.id ? 'active' : '') + '" data-game-id="' + gm.id + '">' + gm.name + '</button>';
      }).join('') +
      '</div><div class="flex-wrap">' +
      Object.keys(d.DIFFICULTY_CONFIG).map(function (df) {
        return '<button class="tab-chip ' + (gState.difficulty === df ? 'active' : '') + '" data-game-diff="' + df + '">' + df + '</button>';
      }).join('') + '</div></div>' + stage + '</div>';

    el.querySelectorAll('[data-game-id]').forEach(function (b) { b.onclick = function () { gState.activeGame = b.getAttribute('data-game-id'); renderGames(); }; });
    el.querySelectorAll('[data-game-diff]').forEach(function (b) { b.onclick = function () { gState.difficulty = b.getAttribute('data-game-diff'); renderGames(); }; });

    el.querySelectorAll('[data-pen-zone]').forEach(function (b) {
      b.onclick = function () {
        var zone = Number(b.getAttribute('data-pen-zone'));
        var gkZone = Math.random() < diffCfg.keeperAiSkill ? zone : Math.floor(Math.random() * 3);
        gState.pen.shots++;
        if (zone !== gkZone) {
          gState.pen.goals++;
          gState.pen.msg = '⚽ GOAL! Beat the keeper cleanly!';
          addXp(25);
        } else {
          gState.pen.msg = '🧤 Saved! The goalkeeper guessed right!';
        }
        renderGames();
      };
    });
    var pr = document.getElementById('pen-reset'); if (pr) pr.onclick = function () { gState.pen = { shots: 0, goals: 0, msg: 'Aim Left, Center, or Right and strike!' }; renderGames(); };

    el.querySelectorAll('[data-fk-curve]').forEach(function (b) { b.onclick = function () { gState.fk.curve = b.getAttribute('data-fk-curve'); renderGames(); }; });
    var fkBtn = document.getElementById('fk-shoot');
    if (fkBtn) fkBtn.onclick = function () {
      gState.fk.attempts++;
      var hit = Math.random() > diffCfg.keeperAiSkill * 0.72;
      if (hit) { gState.fk.goals++; gState.fk.msg = '🎯 TOP BINS! Curled past the wall!'; addXp(30); }
      else gState.fk.msg = '🧱 Blocked by wall or tipped over the bar!';
      renderGames();
    };

    var gkStart = document.getElementById('gk-start');
    if (gkStart) gkStart.onclick = function () {
      var target = Math.floor(Math.random() * 3);
      var lbls = ['LEFT', 'CENTER', 'RIGHT'];
      gState.gk.promptDir = { target: target, expires: Date.now() + diffCfg.reflexWindowMs };
      gState.gk.msg = '⚡ SHOT COMING TO ' + lbls[target] + '! React within ' + diffCfg.reflexWindowMs + 'ms!';
      renderGames();
    };
    el.querySelectorAll('[data-gk-dive]').forEach(function (b) {
      b.onclick = function () {
        if (!gState.gk.promptDir) { gState.gk.msg = 'Click Launch AI Shot first!'; renderGames(); return; }
        gState.gk.attempts++;
        var dive = Number(b.getAttribute('data-gk-dive'));
        var inTime = Date.now() <= gState.gk.promptDir.expires;
        if (dive === gState.gk.promptDir.target && inTime) { gState.gk.saves++; gState.gk.msg = '🧤 WORLD CLASS SAVE!'; addXp(35); }
        else gState.gk.msg = inTime ? '⚽ Wrong corner!' : '⏱️ Too slow — ball hit the net!';
        gState.gk.promptDir = null;
        renderGames();
      };
    });

    el.querySelectorAll('[data-triv-opt]').forEach(function (b) {
      b.onclick = function () {
        if (gState.triviaPicked !== null) return;
        var opt = Number(b.getAttribute('data-triv-opt'));
        gState.triviaPicked = opt;
        if (opt === allTrivia[gState.triviaIdx % allTrivia.length].answerIndex) { gState.triviaScore++; addXp(25); }
        renderGames();
      };
    });
    var tn = document.getElementById('triv-next'); if (tn) tn.onclick = function () { gState.triviaIdx++; gState.triviaPicked = null; renderGames(); };

    var cm = document.getElementById('clue-more'); if (cm) cm.onclick = function () { gState.clueStep++; renderGames(); };
    var cs = document.getElementById('clue-submit'); if (cs) cs.onclick = function () {
      var val = (document.getElementById('clue-input').value || '').trim();
      var ans = d.PLAYER_CLUES_GAME[gState.clueIdx % d.PLAYER_CLUES_GAME.length].answer;
      if (val && ans.toLowerCase().indexOf(val.toLowerCase()) >= 0) {
        gState.clueMsg = '✅ Correct! ' + ans;
        addXp(40);
      } else gState.clueMsg = '❌ Not quite — try another clue!';
      gState.clueGuess = val;
      renderGames();
    };
    var csk = document.getElementById('clue-skip'); if (csk) csk.onclick = function () { gState.clueIdx++; gState.clueStep = 1; gState.clueGuess = ''; gState.clueMsg = ''; renderGames(); };

    el.querySelectorAll('[data-club-opt]').forEach(function (b) {
      b.onclick = function () {
        var opt = b.getAttribute('data-club-opt');
        gState.clubPicked = opt;
        if (opt === d.CLUB_LOGO_QUIZ[gState.clubIdx % d.CLUB_LOGO_QUIZ.length].club) addXp(20);
        renderGames();
      };
    });
    var cn = document.getElementById('club-next'); if (cn) cn.onclick = function () { gState.clubIdx++; gState.clubPicked = null; renderGames(); };

    var oy = document.getElementById('off-yes'), on = document.getElementById('off-no'), onx = document.getElementById('off-next');
    var checkOff = function (call) {
      var os = d.OFFSIDE_SCENARIOS[gState.offIdx % d.OFFSIDE_SCENARIOS.length];
      gState.offMsg = (call === os.isOffside ? '✅ Correct VAR Decision! ' : '❌ Incorrect call. ') + os.explanation;
      if (call === os.isOffside) addXp(25);
      renderGames();
    };
    if (oy) oy.onclick = function () { checkOff(true); };
    if (on) on.onclick = function () { checkOff(false); };
    if (onx) onx.onclick = function () { gState.offIdx++; gState.offMsg = ''; renderGames(); };

    var txa = document.getElementById('tx-a'), txb = document.getElementById('tx-b'), txn = document.getElementById('tx-next');
    var checkTx = function (pick) {
      var td = d.TRANSFER_FEE_DUELS[gState.txIdx % d.TRANSFER_FEE_DUELS.length];
      var correct = pick === 'A' ? td.feeA >= td.feeB : td.feeB >= td.feeA;
      gState.txMsg = (correct ? '✅ Spot on! ' : '❌ Missed! ') + td.playerA + ' (€' + td.feeA + 'M) vs ' + td.playerB + ' (€' + td.feeB + 'M)';
      if (correct) addXp(25);
      renderGames();
    };
    if (txa) txa.onclick = function () { checkTx('A'); };
    if (txb) txb.onclick = function () { checkTx('B'); };
    if (txn) txn.onclick = function () { gState.txIdx++; gState.txMsg = ''; renderGames(); };

    var sg = document.getElementById('scram-go'), sn = document.getElementById('scram-next');
    if (sg) sg.onclick = function () {
      var val = (document.getElementById('scram-in').value || '').trim().toUpperCase();
      var ans = d.WORD_SCRAMBLE_PLAYERS[gState.scramIdx % d.WORD_SCRAMBLE_PLAYERS.length].name.toUpperCase();
      gState.scramGuess = val;
      if (val === ans) { gState.scramMsg = '✅ Correct: ' + ans; addXp(30); }
      else gState.scramMsg = '❌ Try again!';
      renderGames();
    };
    if (sn) sn.onclick = function () { gState.scramIdx++; gState.scramGuess = ''; gState.scramMsg = ''; renderGames(); };

    el.querySelectorAll('[data-jq-opt]').forEach(function (b) {
      b.onclick = function () {
        var o = b.getAttribute('data-jq-opt');
        gState.jerseyPicked = o;
        if (o === d.JERSEY_NUMBER_QUIZ[gState.jerseyIdx % d.JERSEY_NUMBER_QUIZ.length].answer) addXp(20);
        renderGames();
      };
    });
    var jqn = document.getElementById('jq-next'); if (jqn) jqn.onclick = function () { gState.jerseyIdx++; gState.jerseyPicked = null; renderGames(); };
  }

  // STR Player Cards Module
  var cardState = {
    tab: 'catalog',
    rarity: 'All',
    owned: JSON.parse(localStorage.getItem('str_standalone_cards') || '["ronaldo-icon","messi-icon","mbappe-gold","bellingham-gold"]'),
    packsOpened: Number(localStorage.getItem('str_standalone_packs') || 0),
    lastPack: []
  };

  function saveCards() {
    try {
      localStorage.setItem('str_standalone_cards', JSON.stringify(cardState.owned));
      localStorage.setItem('str_standalone_packs', String(cardState.packsOpened));
    } catch (e) {}
  }

  function renderCards(container) {
    var el = container || document.getElementById('app-main');
    if (!el || window.STR_CURRENT_VIEW !== 'cards') return;
    var cards = window.STR_DATA.PLAYER_CARDS_CATALOG || [];
    var filtered = cardState.rarity === 'All' ? cards : cards.filter(function (c) { return c.rarity === cardState.rarity; });

    var body = '';
    if (cardState.tab === 'packs') {
      body = '<div class="card stack-md"><div class="flex-between"><div><h3>Open STR Player Pack (3 Cards)</h3><p class="text-muted">Collect Icons, Legends, Gold, and Rising Stars.</p></div>' +
        '<button class="btn-primary" id="open-pack-btn">Open Pack Now</button></div>' +
        (cardState.lastPack.length ? '<div class="grid-3">' + cardState.lastPack.map(function (c) {
          return '<div class="card-subtle" style="border-color:' + c.accentColors[0] + '"><span class="badge-accent">' + c.rarity + ' · ' + c.overall + ' OVR</span><h4>' + c.name + '</h4><div class="text-muted" style="font-size:0.78rem">' + c.club + ' · ' + c.roleTag + '</div></div>';
        }).join('') + '</div>' : '') + '</div>';
    } else {
      body = '<div class="filter-row">' +
        ['All', 'Icon', 'Legend', 'Gold', 'Silver', 'Rising Star'].map(function (r) {
          return '<button class="tab-chip ' + (cardState.rarity === r ? 'active' : '') + '" data-card-rarity="' + r + '">' + r + '</button>';
        }).join('') +
        '</div><div class="grid-4">' +
        filtered.map(function (c) {
          var isOwned = cardState.owned.indexOf(c.id) >= 0;
          return '<div class="card-sm stack-sm" style="border-color:' + (isOwned ? c.accentColors[0] : 'var(--border)') + '">' +
            '<div class="flex-between"><span class="badge-accent">' + c.rarity + '</span><strong class="font-display font-mono-tabular" style="font-size:1.3rem">' + c.overall + '</strong></div>' +
            '<div><strong>' + c.name + '</strong><div class="text-muted" style="font-size:0.74rem">' + c.club + ' · #' + c.jerseyNumber + ' ' + c.position + '</div></div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;font-size:0.7rem" class="font-mono-tabular">' +
            '<span>PAC ' + c.stats.pace + '</span><span>SHO ' + c.stats.shooting + '</span><span>PAS ' + c.stats.passing + '</span>' +
            '<span>DRI ' + c.stats.dribbling + '</span><span>DEF ' + c.stats.defending + '</span><span>PHY ' + c.stats.physical + '</span>' +
            '</div><div class="text-muted" style="font-size:0.72rem">' + (isOwned ? '✅ In Collection' : '🔒 Open Packs to unlock') + '</div></div>';
        }).join('') + '</div>';
    }

    el.innerHTML = '<div class="stack-lg fade-in">' +
      '<div class="card flex-between"><div><span class="badge-accent">STR PLAYER CARDS</span><h1 class="font-display" style="margin:2px 0 0;font-size:2rem">Card Vault &amp; Pack Opener</h1><div class="text-muted" style="font-size:0.8rem">Unlocked: ' + cardState.owned.length + ' / ' + cards.length + ' · Packs opened: ' + cardState.packsOpened + '</div></div>' +
      '<div class="flex-wrap"><button class="tab-chip ' + (cardState.tab === 'catalog' ? 'active' : '') + '" data-ctab="catalog">Collection Catalog</button><button class="tab-chip ' + (cardState.tab === 'packs' ? 'active' : '') + '" data-ctab="packs">Pack Opener</button></div></div>' +
      body + '</div>';

    el.querySelectorAll('[data-ctab]').forEach(function (b) { b.onclick = function () { cardState.tab = b.getAttribute('data-ctab'); renderCards(); }; });
    el.querySelectorAll('[data-card-rarity]').forEach(function (b) { b.onclick = function () { cardState.rarity = b.getAttribute('data-card-rarity'); renderCards(); }; });
    var op = document.getElementById('open-pack-btn');
    if (op) op.onclick = function () {
      var pull = [];
      for (var i = 0; i < 3; i++) {
        var c = cards[Math.floor(Math.random() * cards.length)];
        pull.push(c);
        if (cardState.owned.indexOf(c.id) < 0) cardState.owned.push(c.id);
      }
      cardState.packsOpened++;
      cardState.lastPack = pull;
      saveCards();
      addXp(40);
      renderCards();
    };
  }

  window.STR_GAMES = { render: renderGames };
  window.STR_CARDS = { render: renderCards };
})();
