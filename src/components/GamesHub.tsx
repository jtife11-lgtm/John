import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  Camera,
  CheckCircle2,
  Flame,
  Gamepad2,
  HelpCircle,
  Layers,
  Shield,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  CLUB_LOGO_QUIZ,
  PLAYER_CLUES_GAME,
  TRIVIA_QUESTIONS,
} from '../data/footballCatalog';
import { PLAYER_CARDS_CATALOG } from '../data/playerCardsCatalog';
import { useApp } from '../context/AppContext';
import { usePlayerHeadshot } from './PlayerCardVisual';

type GameMode =
  | 'menu'
  | 'penalty'
  | 'photo_guess'
  | 'club'
  | 'whoami'
  | 'higher_lower'
  | 'card_battle'
  | 'best_xi'
  | 'trivia'
  | 'daily'
  | 'multiplayer';

function xpTier(pts: number) {
  const level = Math.floor(pts / 100) + 1;
  const title =
    level >= 15
      ? 'Ballon d’Or Legend'
      : level >= 8
      ? 'UCL Tactician'
      : level >= 4
      ? 'First-Team Pro'
      : 'Academy Prospect';
  return { level, title, nextPct: pts % 100 };
}

export function GamesHub() {
  const {
    user,
    userProfile,
    addPoints,
    pushToast,
    setActiveTab,
    pendingChallengeId,
    setPendingChallengeId,
  } = useApp();

  const [mode, setMode] = useState<GameMode>('menu');
  const [leaders, setLeaders] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, 'users'), orderBy('points', 'desc'), limit(10)),
      (snap) => setLeaders(snap.docs.map((d) => d.data())),
      () => {}
    );

    const unsubFrom = onSnapshot(
      query(collection(db, 'gameChallenges'), where('fromUid', '==', user.uid), limit(15)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setChallenges((prev) => [...prev.filter((c) => c.fromUid !== user.uid), ...list]);
      },
      () => {}
    );

    const unsubTo = onSnapshot(
      query(collection(db, 'gameChallenges'), where('toUid', '==', user.uid), limit(15)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setChallenges((prev) => [...prev.filter((c) => c.toUid !== user.uid), ...list]);
      },
      () => {}
    );

    return () => {
      unsub();
      unsubFrom();
      unsubTo();
    };
  }, [user]);

  useEffect(() => {
    if (pendingChallengeId) {
      const found = challenges.find((c) => c.id === pendingChallengeId);
      if (found) {
        setActiveChallenge(found);
        setMode('multiplayer');
        setPendingChallengeId(null);
      } else {
        setMode('multiplayer');
      }
    }
  }, [pendingChallengeId, challenges]);

  const tier = xpTier(userProfile?.points || 0);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-[#0B1324] border border-slate-800 text-white p-6 sm:p-8">
        <img
          src="/src/assets/images/games_hub_banner_1795349597794.jpg"
          alt="STR Games Arena"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060B16]/95 via-[#060B16]/85 to-[#060B16]/60" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-bold text-[#00E676] tracking-wider">STR MINI GAMES ARENA</p>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold">
              Football Mini-Games, Card Duels & Multiplayer Challenges
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Step up to the penalty spot, identify stars from photos, duel Higher or Lower stats, draft your Best XI, and challenge friends for XP rewards.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {userProfile && (
              <div className="px-4 py-2.5 rounded-2xl bg-[#060B16]/90 border border-slate-700 text-right">
                <p className="text-[11px] text-slate-400">
                  Lv.{tier.level} · {tier.title}
                </p>
                <p className="font-mono-tabular text-xl font-extrabold text-[#00E676]">
                  {userProfile.points} XP
                </p>
              </div>
            )}
            <button
              onClick={() => setActiveTab('cards')}
              className="px-4 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold whitespace-nowrap"
            >
              Open STR Player Cards
            </button>
            <button
              onClick={() => setActiveTab('news')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold whitespace-nowrap"
            >
              Gaming News
            </button>
          </div>
        </div>
      </div>

      {mode !== 'menu' && (
        <button
          onClick={() => setMode('menu')}
          className="px-4 py-2 rounded-xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:border-[#00E676]"
        >
          ← Back to Games Hub
        </button>
      )}

      {mode === 'menu' && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 grid sm:grid-cols-2 gap-4">
            {[
              {
                id: 'penalty' as const,
                title: 'Penalty Shootout',
                desc: '5-kick shootout against a reactive AI goalkeeper. Pick corner & beat the keeper!',
                pts: '+25 XP/win',
                icon: Trophy,
              },
              {
                id: 'photo_guess' as const,
                title: 'Guess the Player from Photo',
                desc: 'Identify real footballers from their cutout portraits across clubs & nations.',
                pts: '+20 XP/solve',
                icon: Camera,
              },
              {
                id: 'club' as const,
                title: 'Guess the Club Logo',
                desc: 'Match club colors, cities & iconic crest hints across world leagues.',
                pts: '+15 XP/solve',
                icon: Shield,
              },
              {
                id: 'whoami' as const,
                title: 'Who Am I? Football Quiz',
                desc: 'Decode progressive career clues to uncover legends & modern stars.',
                pts: '+20 XP/solve',
                icon: Flame,
              },
              {
                id: 'higher_lower' as const,
                title: 'Higher or Lower Player Stats',
                desc: 'Predict which footballer holds the higher Pace, Shooting, Passing, or OVR.',
                pts: '+15 XP/streak',
                icon: ArrowUp,
              },
              {
                id: 'card_battle' as const,
                title: 'Football Card Battles',
                desc: 'Pit your STR card attributes head-to-head against challenger cards.',
                pts: '+20 XP/win',
                icon: Swords,
              },
              {
                id: 'best_xi' as const,
                title: 'Build Your Best XI',
                desc: 'Pick formation & draft 11 stars under chemistry rules to hit 89+ Squad OVR.',
                pts: '+35 XP/clear',
                icon: Users,
              },
              {
                id: 'trivia' as const,
                title: 'Tactical Trivia Levels',
                desc: 'Beginner, Tactical & Legend football quiz tiers with instant facts.',
                pts: '+15 XP/correct',
                icon: HelpCircle,
              },
              {
                id: 'daily' as const,
                title: 'Daily Football Challenge',
                desc: 'Today’s special 3-stage matchday challenge for big XP.',
                pts: '+50 bonus XP',
                icon: Award,
              },
              {
                id: 'multiplayer' as const,
                title: 'Multiplayer Friend Challenges',
                desc: `Play & resolve friend invites (${challenges.filter((c) => c.status !== 'completed' && c.status !== 'declined').length} active).`,
                pts: '+40 XP/duel win',
                icon: Layers,
              },
            ].map((game) => {
              const Icon = game.icon;
              return (
                <button
                  key={game.id}
                  onClick={() => setMode(game.id)}
                  className="text-left rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 hover:border-[#00E676] p-5 space-y-3 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#00E676]/15 flex items-center justify-center text-[#00A844] dark:text-[#00E676]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono-tabular text-xs font-bold text-[#00A844] dark:text-[#00E676]">
                      {game.pts}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                      {game.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{game.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Leaderboard & Achievements */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-[#00E676]" />
                XP Leaderboard
              </h3>
              {!user ? (
                <p className="text-xs text-slate-500">
                  Play any mini-game right now as a guest! Sign in to sync XP points and rank on the live global leaderboard.
                </p>
              ) : leaders.length === 0 ? (
                <p className="text-xs text-slate-500">Loading supporter standings...</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {leaders.map((u, idx) => (
                    <div key={u.uid} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono-tabular font-bold w-5 text-slate-400">
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {u.displayName}
                        </span>
                      </div>
                      <span className="font-mono-tabular font-bold text-[#00A844] dark:text-[#00E676]">
                        {u.points} XP
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {userProfile?.achievements && userProfile.achievements.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-2.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Unlocked Achievements
                </h3>
                <div className="flex flex-wrap gap-2">
                  {userProfile.achievements.map((ach) => (
                    <span
                      key={ach}
                      className="text-xs font-semibold text-[#00A844] dark:text-[#00E676] flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {ach}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'penalty' && (
        <PenaltyShootoutGame
          onWin={() => {
            addPoints(25, 'Penalty Ace');
            pushToast('Victory! +25 XP earned', 'success');
          }}
        />
      )}
      {mode === 'photo_guess' && (
        <GuessPlayerPhotoGame
          onSolve={() => {
            addPoints(20, 'Sharp Eye');
            pushToast('Spot on! +20 XP earned', 'success');
          }}
        />
      )}
      {mode === 'club' && (
        <ClubLogoQuiz
          onSolve={() => {
            addPoints(15, 'Crest Collector');
            pushToast('Correct club! +15 XP', 'success');
          }}
        />
      )}
      {mode === 'whoami' && (
        <PlayerCluesGame
          onSolve={() => {
            addPoints(20, 'Scout Master');
            pushToast('Spot on! +20 XP earned', 'success');
          }}
        />
      )}
      {mode === 'higher_lower' && (
        <HigherLowerGame
          onPoint={(pts) => {
            addPoints(pts, 'Stats Analyst');
            pushToast(`+${pts} XP!`, 'success');
          }}
        />
      )}
      {mode === 'card_battle' && (
        <QuickCardBattleGame
          onWin={() => {
            addPoints(20, 'Card Duelist');
            pushToast('Card Battle Victory! +20 XP', 'success');
          }}
        />
      )}
      {mode === 'best_xi' && (
        <BuildBestXIGame
          onComplete={() => {
            addPoints(35, 'Master Tactician');
            pushToast('Dream Best XI Built! +35 XP', 'success');
          }}
        />
      )}
      {mode === 'trivia' && (
        <TriviaGame
          onScore={(pts) => {
            addPoints(pts, 'Tactical Mind');
            pushToast(`+${pts} XP earned!`, 'success');
          }}
        />
      )}
      {mode === 'daily' && (
        <DailyChallengeGame
          onComplete={() => {
            addPoints(50, 'Daily Champion');
            pushToast('Daily Challenge Completed! +50 XP', 'success');
          }}
        />
      )}
      {mode === 'multiplayer' && (
        <MultiplayerChallengesPanel
          challenges={challenges}
          activeChallenge={activeChallenge}
          setActiveChallenge={setActiveChallenge}
          onWin={() => addPoints(40, 'Friend Duel Champion')}
        />
      )}
    </div>
  );
}

function GuessPlayerPhotoGame({ onSolve }: { onSolve: () => void }) {
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const pool = PLAYER_CARDS_CATALOG;
  const target = pool[round % pool.length];
  const photoUrl = usePlayerHeadshot(target.tsdbSearchName);

  const distractors = pool
    .filter((c) => c.id !== target.id)
    .slice(round % 6, (round % 6) + 3)
    .map((c) => c.name);
  const options = [target.name, ...distractors].sort((a, b) => a.localeCompare(b));

  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (opt === target.name) onSolve();
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Guess the Player from the Photo</h2>
        <span className="font-mono-tabular text-xs text-[#00E676] font-bold">Round {round + 1}</span>
      </div>

      <div className="p-6 rounded-2xl bg-[#060B16] border border-slate-800 flex flex-col items-center gap-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Mystery Footballer"
            referrerPolicy="no-referrer"
            className="h-44 object-contain drop-shadow-2xl"
          />
        ) : (
          <div className="h-44 w-44 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-sm text-slate-400">
            Portrait Loading...
          </div>
        )}
        <p className="text-xs text-slate-400">
          Hint: {target.position} · {target.nationalTeam} · #{target.jerseyNumber}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => choose(opt)}
            className={`py-3 px-4 rounded-xl border text-sm font-semibold transition ${
              !picked
                ? 'bg-slate-50 dark:bg-[#060B16] border-slate-200 dark:border-slate-800 hover:border-[#00E676]'
                : opt === target.name
                ? 'bg-emerald-500/20 border-[#00E676] text-[#00A844] dark:text-[#00E676]'
                : picked === opt
                ? 'bg-rose-500/20 border-rose-500 text-rose-500'
                : 'opacity-50 border-slate-200 dark:border-slate-800'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      {picked && (
        <button
          onClick={() => {
            setRound((r) => r + 1);
            setPicked(null);
          }}
          className="px-5 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold"
        >
          Next Photo
        </button>
      )}
    </div>
  );
}

function HigherLowerGame({ onPoint }: { onPoint: (pts: number) => void }) {
  const statKeys = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const;
  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(1);
  const [statIdx, setStatIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const cardA = PLAYER_CARDS_CATALOG[idxA % PLAYER_CARDS_CATALOG.length];
  const cardB = PLAYER_CARDS_CATALOG[idxB % PLAYER_CARDS_CATALOG.length];
  const statKey = statKeys[statIdx % statKeys.length];

  const valA = cardA.stats[statKey];
  const valB = cardB.stats[statKey];

  const guess = (choice: 'higher' | 'lower') => {
    if (feedback) return;
    const isCorrect =
      (choice === 'higher' && valB >= valA) || (choice === 'lower' && valB <= valA);
    if (isCorrect) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setFeedback(`Correct! ${cardB.shortName} has ${valB} ${statKey.toUpperCase()} vs ${cardA.shortName}'s ${valA}.`);
      onPoint(15);
    } else {
      setStreak(0);
      setFeedback(`Wrong! ${cardB.shortName} has ${valB} ${statKey.toUpperCase()} vs ${cardA.shortName}'s ${valA}.`);
    }
  };

  const nextRound = () => {
    setFeedback(null);
    setIdxA(idxB);
    setIdxB((prev) => (prev + 3) % PLAYER_CARDS_CATALOG.length === idxB ? prev + 4 : prev + 3);
    setStatIdx((s) => s + 1);
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Higher or Lower: {statKey.toUpperCase()}</h2>
        <span className="font-mono-tabular text-xs font-bold text-[#00E676]">
          Active Streak: {streak}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-[#060B16] border border-slate-800 text-white text-center space-y-2">
          <p className="text-xs text-slate-400">{cardA.club}</p>
          <p className="font-display text-2xl font-extrabold">{cardA.name}</p>
          <p className="font-mono-tabular text-4xl font-black text-[#00E676]">{valA}</p>
          <p className="text-[11px] uppercase text-slate-400">{statKey}</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#060B16] border border-slate-800 text-white text-center space-y-2">
          <p className="text-xs text-slate-400">{cardB.club}</p>
          <p className="font-display text-2xl font-extrabold">{cardB.name}</p>
          <p className="font-mono-tabular text-4xl font-black text-amber-400">
            {feedback ? valB : '??'}
          </p>
          <p className="text-[11px] uppercase text-slate-400">{statKey}</p>
        </div>
      </div>

      {!feedback ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => guess('higher')}
            className="py-3 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-sm inline-flex items-center justify-center gap-1.5"
          >
            <ArrowUp className="w-4 h-4" />
            {cardB.shortName} is Higher
          </button>
          <button
            onClick={() => guess('lower')}
            className="py-3 rounded-xl bg-rose-500 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5"
          >
            <ArrowDown className="w-4 h-4" />
            {cardB.shortName} is Lower
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-center">{feedback}</p>
          <button
            onClick={nextRound}
            className="w-full py-3 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-xs"
          >
            Next Matchup
          </button>
        </div>
      )}
    </div>
  );
}

function QuickCardBattleGame({ onWin }: { onWin: () => void }) {
  const [myIdx, setMyIdx] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const myCard = PLAYER_CARDS_CATALOG[myIdx % PLAYER_CARDS_CATALOG.length];

  const duel = (statKey: keyof (typeof myCard)['stats']) => {
    const opp = PLAYER_CARDS_CATALOG[Math.floor(Math.random() * PLAYER_CARDS_CATALOG.length)];
    const m = myCard.stats[statKey];
    const o = opp.stats[statKey];
    if (m > o) {
      setResult(`WIN! Your ${myCard.shortName} (${m} ${statKey.toUpperCase()}) defeated ${opp.shortName} (${o})!`);
      onWin();
    } else if (m === o) {
      setResult(`DRAW! Both ${myCard.shortName} and ${opp.shortName} tied at ${m}.`);
    } else {
      setResult(`LOSS! ${opp.shortName} (${o} ${statKey.toUpperCase()}) edged out ${myCard.shortName} (${m}).`);
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">Football Card Battle</h2>
        <select
          value={myIdx}
          onChange={(e) => {
            setMyIdx(Number(e.target.value));
            setResult(null);
          }}
          className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-xs font-bold"
        >
          {PLAYER_CARDS_CATALOG.map((c, idx) => (
            <option key={c.id} value={idx}>
              {c.name} ({c.overall} OVR)
            </option>
          ))}
        </select>
      </div>
      <div className="p-4 rounded-xl bg-[#060B16] text-white border border-slate-800 flex items-center justify-between">
        <div>
          <p className="font-display text-xl font-bold">{myCard.name}</p>
          <p className="text-xs text-slate-400">
            {myCard.club} · {myCard.rarity}
          </p>
        </div>
        <span className="font-mono-tabular text-3xl font-black text-[#00E676]">{myCard.overall}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const).map((k) => (
          <button
            key={k}
            onClick={() => duel(k)}
            className="py-2.5 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-xs uppercase"
          >
            {k}: {myCard.stats[k]}
          </button>
        ))}
      </div>
      {result && <p className="text-sm font-bold text-center text-[#00E676]">{result}</p>}
    </div>
  );
}

function BuildBestXIGame({ onComplete }: { onComplete: () => void }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const toggle = (id: string) => {
    if (submitted) return;
    if (selectedIds.includes(id)) setSelectedIds((p) => p.filter((x) => x !== id));
    else if (selectedIds.length < 11) setSelectedIds((p) => [...p, id]);
  };

  const chosen = PLAYER_CARDS_CATALOG.filter((c) => selectedIds.includes(c.id));
  const avg = chosen.length
    ? Math.round(chosen.reduce((a, b) => a + b.overall, 0) / chosen.length)
    : 0;
  const hasGk = chosen.some((c) => c.position === 'GK');

  const submitXI = () => {
    if (selectedIds.length !== 11 || !hasGk) return;
    setSubmitted(true);
    if (avg >= 88) onComplete();
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-bold">Build Your Best XI Challenge</h2>
          <p className="text-xs text-slate-500">
            Select 11 players including at least 1 GK and achieve 88+ Squad Average OVR.
          </p>
        </div>
        <div className="font-mono-tabular text-sm font-bold text-[#00E676]">
          {selectedIds.length}/11 · Avg {avg} OVR
        </div>
      </div>

      <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[340px] overflow-y-auto">
        {PLAYER_CARDS_CATALOG.map((c) => {
          const on = selectedIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={`p-3 rounded-xl border text-left text-xs transition ${
                on
                  ? 'bg-[#00E676]/15 border-[#00E676]'
                  : 'bg-slate-50 dark:bg-[#060B16] border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex justify-between font-bold">
                <span className="truncate">{c.shortName}</span>
                <span className="text-[#00E676] font-mono-tabular">{c.overall}</span>
              </div>
              <p className="text-[10px] text-slate-500">
                {c.position} · {c.club}
              </p>
            </button>
          );
        })}
      </div>

      {!submitted ? (
        <button
          disabled={selectedIds.length !== 11 || !hasGk}
          onClick={submitXI}
          className="w-full py-3 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-xs disabled:opacity-50"
        >
          {selectedIds.length < 11
            ? `Pick ${11 - selectedIds.length} more players`
            : !hasGk
            ? 'Include at least 1 GK'
            : 'Lock In Best XI'}
        </button>
      ) : (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-[#00E676] text-center space-y-2">
          <p className="font-bold text-sm">
            Best XI Locked at {avg} OVR! {avg >= 88 ? 'Target Cleared (+35 XP)!' : 'Try higher-rated stars to beat 88 OVR!'}
          </p>
          <button
            onClick={() => {
              setSelectedIds([]);
              setSubmitted(false);
            }}
            className="px-4 py-2 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold"
          >
            Rebuild Squad
          </button>
        </div>
      )}
    </div>
  );
}

function MultiplayerChallengesPanel({
  challenges,
  activeChallenge,
  setActiveChallenge,
  onWin,
}: {
  challenges: any[];
  activeChallenge: any | null;
  setActiveChallenge: (c: any | null) => void;
  onWin: () => void;
}) {
  const { user, userProfile, pushToast } = useApp();
  const [friends, setFriends] = useState<{ uid: string; name: string }[]>([]);
  const [targetUid, setTargetUid] = useState('');
  const [gameType, setGameType] = useState<'penalty' | 'quiz' | 'higher_lower' | 'card_battle'>('penalty');

  useEffect(() => {
    if (!user) return;
    const unsubA = onSnapshot(
      query(collection(db, 'friendRequests'), where('fromUid', '==', user.uid), where('status', '==', 'accepted')),
      (s) =>
        setFriends((p) => {
          const list = s.docs.map((d) => ({ uid: d.data().toUid, name: d.data().toName }));
          return [...p.filter((x) => !list.some((l) => l.uid === x.uid)), ...list];
        }),
      () => {}
    );
    const unsubB = onSnapshot(
      query(collection(db, 'friendRequests'), where('toUid', '==', user.uid), where('status', '==', 'accepted')),
      (s) =>
        setFriends((p) => {
          const list = s.docs.map((d) => ({ uid: d.data().fromUid, name: d.data().fromName }));
          return [...p.filter((x) => !list.some((l) => l.uid === x.uid)), ...list];
        }),
      () => {}
    );
    return () => {
      unsubA();
      unsubB();
    };
  }, [user]);

  if (!user) {
    return (
      <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
        Sign in to create and accept multiplayer challenges with your STR friends.
      </div>
    );
  }

  const createChallenge = async () => {
    const f = friends.find((x) => x.uid === targetUid);
    if (!f || !user.emailVerified) return;
    await addDoc(collection(db, 'gameChallenges'), {
      fromUid: user.uid,
      toUid: f.uid,
      fromName: userProfile?.displayName || 'Supporter',
      toName: f.name,
      gameType,
      status: 'pending',
      fromScore: 0,
      toScore: 0,
      seed: Math.floor(Math.random() * 100000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    pushToast(`Challenge sent to ${f.name}!`, 'success');
  };

  const playTurn = async (ch: any) => {
    const score = Math.floor(Math.random() * 5) + 1;
    const isFrom = ch.fromUid === user.uid;
    const nextFrom = isFrom ? score : ch.fromScore;
    const nextTo = isFrom ? ch.toScore : score;
    const bothDone = nextFrom > 0 && nextTo > 0;
    const winnerUid = bothDone
      ? nextFrom > nextTo
        ? ch.fromUid
        : nextTo > nextFrom
        ? ch.toUid
        : ''
      : '';

    await updateDoc(doc(db, 'gameChallenges', ch.id), {
      status: bothDone ? 'completed' : 'accepted',
      fromScore: nextFrom,
      toScore: nextTo,
      ...(winnerUid ? { winnerUid } : {}),
      updatedAt: serverTimestamp(),
    });

    if (bothDone && winnerUid === user.uid) {
      onWin();
      pushToast(`You won the multiplayer duel ${nextFrom}-${nextTo}! +40 XP`, 'success');
    } else {
      pushToast(`Submitted turn score: ${score} goals/pts!`, 'info');
    }
    setActiveChallenge(null);
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <h2 className="font-display text-xl font-bold">Challenge a Friend</h2>
        <select
          value={targetUid}
          onChange={(e) => setTargetUid(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-xs"
        >
          <option value="">Choose friend...</option>
          {friends.map((f) => (
            <option key={f.uid} value={f.uid}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          value={gameType}
          onChange={(e) => setGameType(e.target.value as any)}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-xs"
        >
          <option value="penalty">Penalty Shootout Duel</option>
          <option value="quiz">Who Am I? Quiz Duel</option>
          <option value="higher_lower">Higher or Lower Duel</option>
          <option value="card_battle">Card Battle Duel</option>
        </select>
        <button
          disabled={!targetUid}
          onClick={createChallenge}
          className="w-full py-2.5 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-xs disabled:opacity-50"
        >
          Send Challenge Invite
        </button>
      </div>

      <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        <h3 className="font-display text-xl font-bold">Your Friend Challenges</h3>
        {challenges.length === 0 ? (
          <p className="text-xs text-slate-500">No active multiplayer challenges yet.</p>
        ) : (
          <div className="space-y-2.5">
            {challenges.map((ch) => {
              const isFrom = ch.fromUid === user.uid;
              const myTurnDone = isFrom ? ch.fromScore > 0 : ch.toScore > 0;
              return (
                <div
                  key={ch.id}
                  className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                    activeChallenge?.id === ch.id
                      ? 'bg-[#00E676]/10 border-[#00E676]'
                      : 'bg-slate-50 dark:bg-[#060B16] border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <p className="font-bold">
                      {ch.fromName} vs {ch.toName} · {ch.gameType.toUpperCase()}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Score: {ch.fromScore} - {ch.toScore} · Status: {ch.status}
                    </p>
                  </div>
                  {ch.status !== 'completed' && !myTurnDone && (
                    <button
                      onClick={() => playTurn(ch)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#00E676] text-[#060B16] font-bold"
                    >
                      Play My Round
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PenaltyShootoutGame({ onWin }: { onWin: () => void }) {
  const zones = [
    { id: 'tl', label: 'Top Left', x: 75, y: 55 },
    { id: 'tc', label: 'Top Center', x: 180, y: 50 },
    { id: 'tr', label: 'Top Right', x: 285, y: 55 },
    { id: 'bl', label: 'Bottom Left', x: 75, y: 120 },
    { id: 'br', label: 'Bottom Right', x: 285, y: 120 },
  ];

  const [kickNum, setKickNum] = useState(1);
  const [playerGoals, setPlayerGoals] = useState(0);
  const [aiGoals, setAiGoals] = useState(0);
  const [ballPos, setBallPos] = useState({ x: 180, y: 195 });
  const [keeperPos, setKeeperPos] = useState({ x: 180, y: 105 });
  const [resultText, setResultText] = useState('Choose a corner to strike!');
  const [busy, setBusy] = useState(false);

  const finished = kickNum > 5;

  const takeKick = (zone: (typeof zones)[number]) => {
    if (busy || finished) return;
    setBusy(true);
    const keeperChoice = zones[Math.floor(Math.random() * zones.length)];
    const saved = keeperChoice.id === zone.id;

    setBallPos({ x: zone.x, y: zone.y });
    setKeeperPos({ x: keeperChoice.x, y: keeperChoice.y });

    setTimeout(() => {
      const nextPlayerGoals = saved ? playerGoals : playerGoals + 1;
      const aiScored = Math.random() > 0.35;
      const nextAiGoals = aiScored ? aiGoals + 1 : aiGoals;

      setPlayerGoals(nextPlayerGoals);
      setAiGoals(nextAiGoals);
      setResultText(
        `${saved ? 'SAVED by Keeper!' : 'GOAL!'} · AI striker ${aiScored ? 'scored' : 'missed'}`
      );

      if (kickNum === 5 && nextPlayerGoals > nextAiGoals) {
        onWin();
      }
      setKickNum((k) => k + 1);
      setTimeout(() => {
        setBallPos({ x: 180, y: 195 });
        setKeeperPos({ x: 180, y: 105 });
        setBusy(false);
      }, 900);
    }, 450);
  };

  const reset = () => {
    setKickNum(1);
    setPlayerGoals(0);
    setAiGoals(0);
    setBallPos({ x: 180, y: 195 });
    setKeeperPos({ x: 180, y: 105 });
    setResultText('Choose a corner to strike!');
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          STR Penalty Shootout
        </h2>
        <div className="font-mono-tabular text-sm font-bold text-[#00A844] dark:text-[#00E676]">
          YOU {playerGoals} - {aiGoals} AI · Round {Math.min(kickNum, 5)}/5
        </div>
      </div>

      <div className="rounded-2xl bg-emerald-950 border border-emerald-800 p-4 flex justify-center">
        <svg viewBox="0 0 360 220" className="w-full max-w-md">
          <rect x="0" y="0" width="360" height="220" fill="#064e3b" rx="12" />
          <rect x="45" y="28" width="270" height="110" fill="rgba(255,255,255,0.06)" stroke="#ffffff" strokeWidth="4" />
          <rect x="20" y="138" width="320" height="72" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
          <g style={{ transition: 'transform 0.35s ease' }} transform={`translate(${keeperPos.x - 180}, ${keeperPos.y - 105})`}>
            <circle cx="180" cy="92" r="10" fill="#facc15" />
            <rect x="166" y="102" width="28" height="28" rx="6" fill="#00E676" />
          </g>
          <circle
            cx={ballPos.x}
            cy={ballPos.y}
            r="11"
            fill="#ffffff"
            stroke="#060B16"
            strokeWidth="2.5"
            style={{ transition: 'all 0.38s cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        </svg>
      </div>

      <p className="text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
        {finished
          ? playerGoals > aiGoals
            ? `Full Time! You won ${playerGoals}-${aiGoals}!`
            : playerGoals === aiGoals
            ? `Draw ${playerGoals}-${aiGoals}! Try again for victory.`
            : `AI Keeper took the shootout ${aiGoals}-${playerGoals}.`
          : resultText}
      </p>

      {finished ? (
        <button
          onClick={reset}
          className="w-full py-3 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-sm"
        >
          Play Another Shootout
        </button>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {zones.map((z) => (
            <button
              key={z.id}
              disabled={busy}
              onClick={() => takeKick(z)}
              className="py-2.5 px-2 rounded-xl bg-slate-100 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 hover:border-[#00E676] text-xs font-semibold transition disabled:opacity-50"
            >
              {z.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TriviaGame({ onScore }: { onScore: (pts: number) => void }) {
  const [level, setLevel] = useState<'All' | 'Beginner' | 'Tactical' | 'Legend'>('All');
  const pool = TRIVIA_QUESTIONS.filter((q) => level === 'All' || q.level === level);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const q = pool[idx % pool.length];

  const selectOption = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answerIndex) onScore(15);
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Football Quiz
        </h2>
        <div className="flex items-center gap-1">
          {(['All', 'Beginner', 'Tactical', 'Legend'] as const).map((lv) => (
            <button
              key={lv}
              onClick={() => {
                setLevel(lv);
                setIdx(0);
                setPicked(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                level === lv
                  ? 'bg-[#00E676] text-[#060B16]'
                  : 'bg-slate-100 dark:bg-[#060B16] text-slate-500'
              }`}
            >
              {lv}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-500">
          Level: {q.level} · Question {(idx % pool.length) + 1} of {pool.length}
        </p>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{q.question}</h3>
      </div>

      <div className="space-y-2.5">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.answerIndex;
          const isPicked = picked === i;
          return (
            <button
              key={opt}
              onClick={() => selectOption(i)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition ${
                picked === null
                  ? 'bg-slate-50 dark:bg-[#060B16] border-slate-200 dark:border-slate-800 hover:border-[#00E676]'
                  : isCorrect
                  ? 'bg-emerald-500/15 border-[#00E676] text-[#00A844] dark:text-[#00E676] font-bold'
                  : isPicked
                  ? 'bg-rose-500/15 border-rose-500 text-rose-500'
                  : 'bg-slate-50 dark:bg-[#060B16] border-slate-200 dark:border-slate-800 opacity-60'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300">{q.fact}</p>
          <button
            onClick={() => {
              setIdx((v) => v + 1);
              setPicked(null);
            }}
            className="px-5 py-2 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold"
          >
            Next Question
          </button>
        </div>
      )}
    </div>
  );
}

function PlayerCluesGame({ onSolve }: { onSolve: () => void }) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(1);
  const [guess, setGuess] = useState('');
  const [status, setStatus] = useState<'playing' | 'won' | 'skipped'>('playing');

  const item = PLAYER_CLUES_GAME[idx % PLAYER_CLUES_GAME.length];

  const submitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim()) return;
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    if (norm(item.answer).includes(norm(guess)) && norm(guess).length >= 4) {
      setStatus('won');
      onSolve();
    } else if (revealed < item.clues.length) {
      setRevealed((r) => r + 1);
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 max-w-2xl mx-auto space-y-5">
      <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
        Who Am I? Football Quiz
      </h2>
      <div className="space-y-2.5">
        {item.clues.slice(0, revealed).map((c, i) => (
          <div
            key={i}
            className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm"
          >
            <span className="font-bold text-[#00A844] dark:text-[#00E676] mr-2">Clue {i + 1}:</span>
            {c}
          </div>
        ))}
      </div>

      {status === 'playing' ? (
        <form onSubmit={submitGuess} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Enter player name..."
            className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm"
          />
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-xs">
            Submit Guess
          </button>
          {revealed < item.clues.length && (
            <button
              type="button"
              onClick={() => setRevealed((r) => r + 1)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
            >
              Next Clue
            </button>
          )}
          <button
            type="button"
            onClick={() => setStatus('skipped')}
            className="px-4 py-2.5 rounded-xl text-xs text-slate-500"
          >
            Reveal
          </button>
        </form>
      ) : (
        <div className="p-4 rounded-xl bg-[#00E676]/10 border border-[#00E676]/30 flex items-center justify-between">
          <span className="font-bold text-sm">Answer: {item.answer}</span>
          <button
            onClick={() => {
              setIdx((v) => v + 1);
              setRevealed(1);
              setGuess('');
              setStatus('playing');
            }}
            className="px-4 py-2 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold"
          >
            Next Player
          </button>
        </div>
      )}
    </div>
  );
}

function ClubLogoQuiz({ onSolve }: { onSolve: () => void }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const item = CLUB_LOGO_QUIZ[idx % CLUB_LOGO_QUIZ.length];

  const handlePick = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (opt === item.club) onSolve();
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 max-w-2xl mx-auto space-y-5">
      <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
        Guess the Club Logo & Colors
      </h2>
      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3 text-center">
        <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-slate-300 dark:border-slate-700 grid grid-cols-2">
          <div style={{ backgroundColor: item.colors[0] }} />
          <div style={{ backgroundColor: item.colors[1] }} />
        </div>
        <p className="text-sm font-semibold">{item.symbolHint}</p>
        <p className="text-xs text-slate-500">
          {item.league} · {item.city}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {item.options.map((opt) => (
          <button
            key={opt}
            onClick={() => handlePick(opt)}
            className={`py-3 px-4 rounded-xl border text-sm font-semibold transition ${
              !picked
                ? 'bg-slate-50 dark:bg-[#060B16] border-slate-200 dark:border-slate-800 hover:border-[#00E676]'
                : opt === item.club
                ? 'bg-emerald-500/20 border-[#00E676] text-[#00A844] dark:text-[#00E676]'
                : picked === opt
                ? 'bg-rose-500/20 border-rose-500 text-rose-500'
                : 'opacity-50 border-slate-200 dark:border-slate-800'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {picked && (
        <button
          onClick={() => {
            setIdx((v) => v + 1);
            setPicked(null);
          }}
          className="px-5 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold"
        >
          Next Crest
        </button>
      )}
    </div>
  );
}

function DailyChallengeGame({ onComplete }: { onComplete: () => void }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const [done, setDone] = useState(() => localStorage.getItem(`str_daily_${todayKey}`) === '1');
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const questions = TRIVIA_QUESTIONS.slice(0, 3);
  const current = questions[step];

  const handleAnswer = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    setTimeout(() => {
      if (step < questions.length - 1) {
        setStep((s) => s + 1);
        setSelected(null);
      } else {
        localStorage.setItem(`str_daily_${todayKey}`, '1');
        setDone(true);
        onComplete();
      }
    }, 650);
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Daily Football Challenge · {todayKey}
        </h2>
        <span className="font-mono-tabular text-xs font-bold text-[#00E676]">+50 XP</span>
      </div>
      {done ? (
        <div className="p-6 rounded-xl bg-emerald-500/10 border border-[#00E676]/40 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-[#00E676] mx-auto" />
          <p className="font-bold text-sm">Today’s Daily Challenge is completed!</p>
          <p className="text-xs text-slate-500">Come back tomorrow for a fresh 3-stage matchday challenge.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Stage {step + 1} of {questions.length}
          </p>
          <h3 className="text-base font-bold">{current.question}</h3>
          <div className="space-y-2">
            {current.options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => handleAnswer(i)}
                className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 hover:border-[#00E676] text-sm font-medium"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
