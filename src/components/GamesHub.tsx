import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  Award,
  Camera,
  CheckCircle2,
  Coins,
  Crosshair,
  Flame,
  Gamepad2,
  HelpCircle,
  Layers,
  MapPin,
  Shield,
  ShieldAlert,
  Shirt,
  Sparkles,
  Swords,
  Target,
  Timer,
  Trophy,
  Type,
  Users,
  Zap,
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
import { useApp } from '../context/AppContext';
import { DIFFICULTY_CONFIG, type GameDifficulty } from '../data/expandedGamesData';
import {
  CrossbarChallengeGame,
  FreeKickChallengeGame,
  GoalkeeperReflexSaveGame,
  GoldenBootRaceGame,
  OffsideTrapRefereeGame,
  PenaltyShootoutGame,
  TacticalPassingSequenceGame,
} from './games/ArcadeFootballGames';
import {
  BuildBestXIGame,
  ClubLogoQuiz,
  DailyChallengeGame,
  DerbyRivalryGame,
  GuessPlayerPhotoGame,
  HigherLowerGame,
  JerseyNumberMatchGame,
  PlayerCluesGame,
  QuickCardBattleGame,
  StadiumSpotterGame,
  TransferFeeGuesserGame,
  TriviaBlitzGame,
  TriviaGame,
  WordScrambleGame,
} from './games/QuizAndCardGames';

type GameMode =
  | 'menu'
  | 'penalty'
  | 'free_kick'
  | 'gk_reflex'
  | 'crossbar'
  | 'offside_var'
  | 'passing_seq'
  | 'golden_boot'
  | 'photo_guess'
  | 'club'
  | 'whoami'
  | 'higher_lower'
  | 'card_battle'
  | 'best_xi'
  | 'trivia'
  | 'trivia_blitz'
  | 'transfer_fees'
  | 'jersey_num'
  | 'stadiums'
  | 'derbies'
  | 'word_scramble'
  | 'daily'
  | 'multiplayer';

type GameCategory = 'All' | 'Arcade' | 'Quizzes' | 'Tactics & Cards' | 'Multiplayer';

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
  const [category, setCategory] = useState<GameCategory>('All');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('Medium');
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
  }, [pendingChallengeId, challenges, setPendingChallengeId]);

  const handleGameScore = (basePts: number, label: string, achievement?: string) => {
    const mult = DIFFICULTY_CONFIG[difficulty].multiplier;
    const awarded = Math.round(basePts * mult);
    addPoints(awarded, achievement);
    pushToast(`${label} (${difficulty}): +${awarded} XP!`, 'success');
  };

  const activeChallengesCount = challenges.filter(
    (c) => c.status !== 'completed' && c.status !== 'declined'
  ).length;

  const GAMES_CATALOG = useMemo(
    () => [
      {
        id: 'penalty' as const,
        cat: 'Arcade' as const,
        title: 'Penalty Shootout',
        desc: '5-kick shootout vs reactive AI keeper with a live shot clock.',
        pts: '+25 Base XP',
        icon: Trophy,
      },
      {
        id: 'free_kick' as const,
        cat: 'Arcade' as const,
        title: 'Free Kick Challenge',
        desc: 'Bend the ball over a 4-man wall using the live curl meter.',
        pts: '+18 Base XP',
        icon: Target,
      },
      {
        id: 'gk_reflex' as const,
        cat: 'Arcade' as const,
        title: 'Goalkeeper Reflex Save',
        desc: 'Dive fast to parry incoming crimson shots across 6 goal zones.',
        pts: '+25 Base XP',
        icon: Zap,
      },
      {
        id: 'crossbar' as const,
        cat: 'Arcade' as const,
        title: 'Crossbar Challenge',
        desc: 'Time the oscillating gauge directly on the narrow crossbar zone.',
        pts: '+20 Base XP',
        icon: Crosshair,
      },
      {
        id: 'offside_var' as const,
        cat: 'Arcade' as const,
        title: 'Offside Trap VAR Referee',
        desc: 'Read 2D defensive lines & call Onside or Offside before VAR ticks out.',
        pts: '+20 Base XP',
        icon: ShieldAlert,
      },
      {
        id: 'passing_seq' as const,
        cat: 'Arcade' as const,
        title: 'Tiki-Taka Passing Memory',
        desc: 'Memorize and recreate midfield-to-striker passing triangles.',
        pts: '+22 Base XP',
        icon: Sparkles,
      },
      {
        id: 'golden_boot' as const,
        cat: 'Arcade' as const,
        title: 'Golden Boot Blitz',
        desc: 'Rapid-fire target grid arcade shooter against the countdown.',
        pts: '+24 Base XP',
        icon: Flame,
      },
      {
        id: 'photo_guess' as const,
        cat: 'Quizzes' as const,
        title: 'Guess the Player Photo',
        desc: 'Identify real footballers from their cutout portraits on the clock.',
        pts: '+20 Base XP',
        icon: Camera,
      },
      {
        id: 'club' as const,
        cat: 'Quizzes' as const,
        title: 'Guess the Club Crest',
        desc: 'Match club colors, cities & iconic crest hints across world leagues.',
        pts: '+15 Base XP',
        icon: Shield,
      },
      {
        id: 'whoami' as const,
        cat: 'Quizzes' as const,
        title: 'Who Am I? Mystery Career',
        desc: 'Decode progressive career clues to uncover legends & modern stars.',
        pts: '+22 Base XP',
        icon: Users,
      },
      {
        id: 'trivia' as const,
        cat: 'Quizzes' as const,
        title: 'Football Quiz Championship',
        desc: 'Beginner, Tactical & Legend trivia tiers with matchday facts.',
        pts: '+15 Base XP',
        icon: HelpCircle,
      },
      {
        id: 'trivia_blitz' as const,
        cat: 'Quizzes' as const,
        title: 'Speed Trivia Blitz',
        desc: 'Answer as many rapid-fire football questions as possible before 0s.',
        pts: '+6 XP/Q',
        icon: Timer,
      },
      {
        id: 'jersey_num' as const,
        cat: 'Quizzes' as const,
        title: 'Iconic Shirt Numbers',
        desc: 'Match elite stars to their signature club or national jersey numbers.',
        pts: '+15 Base XP',
        icon: Shirt,
      },
      {
        id: 'stadiums' as const,
        cat: 'Quizzes' as const,
        title: 'Stadium Spotter Quiz',
        desc: 'Identify historic football arenas from capacities, cities & stands.',
        pts: '+16 Base XP',
        icon: MapPin,
      },
      {
        id: 'derbies' as const,
        cat: 'Quizzes' as const,
        title: 'World Derby Rivalries',
        desc: 'Test your knowledge of El Clásico, Beirut Derby, Klassiker & more.',
        pts: '+16 Base XP',
        icon: Swords,
      },
      {
        id: 'word_scramble' as const,
        cat: 'Quizzes' as const,
        title: 'Footballer Word Scramble',
        desc: 'Unscramble shuffled superstar surnames under pressure.',
        pts: '+20 Base XP',
        icon: Type,
      },
      {
        id: 'higher_lower' as const,
        cat: 'Tactics & Cards' as const,
        title: 'Higher or Lower Player Stats',
        desc: 'Predict which footballer holds higher Pace, Shooting, or Passing.',
        pts: '+15 Base XP',
        icon: ArrowUp,
      },
      {
        id: 'transfer_fees' as const,
        cat: 'Tactics & Cards' as const,
        title: 'Transfer Fee Duels',
        desc: 'Compare landmark European & global transfers to spot the bigger fee.',
        pts: '+16 Base XP',
        icon: Coins,
      },
      {
        id: 'card_battle' as const,
        cat: 'Tactics & Cards' as const,
        title: 'Football Card Battles',
        desc: 'Pit your STR player card stats head-to-head against challenger cards.',
        pts: '+20 Base XP',
        icon: Swords,
      },
      {
        id: 'best_xi' as const,
        cat: 'Tactics & Cards' as const,
        title: 'Build Your Best XI',
        desc: 'Draft 11 stars including 1 GK to hit your difficulty’s OVR target.',
        pts: '+35 Base XP',
        icon: Users,
      },
      {
        id: 'daily' as const,
        cat: 'Tactics & Cards' as const,
        title: 'Daily Football Challenge',
        desc: 'Today’s 3-stage matchday challenge for big bonus XP.',
        pts: '+50 Base XP',
        icon: Award,
      },
      {
        id: 'multiplayer' as const,
        cat: 'Multiplayer' as const,
        title: 'Multiplayer Friend Challenges',
        desc: `Play & resolve friend invites (${activeChallengesCount} active).`,
        pts: '+40 XP/win',
        icon: Layers,
      },
    ],
    [activeChallengesCount]
  );

  const visibleGames = GAMES_CATALOG.filter(
    (g) => category === 'All' || g.cat === category
  );

  const tier = xpTier(userProfile?.points || 0);
  const diffCfg = DIFFICULTY_CONFIG[difficulty];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-[#0F1219] border border-white/10 text-white p-6 sm:p-8 shadow-2xl">
        <img
          src="/src/assets/images/games_hub_banner_1795349597794.jpg"
          alt="STR Games Arena"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07090F] via-[#07090F]/90 to-[#E11D48]/25" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-black text-[#E11D48] tracking-widest uppercase">
              STR ARENA · {GAMES_CATALOG.length} PLAYABLE MODES
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold">
              Football Mini-Games, Trivia & Multiplayer Duels
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Choose your difficulty tier (Easy to Expert for up to 3x XP), sharpen your reflexes on the pitch, dominate quizzes, and challenge friends.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {userProfile && (
              <div className="px-4 py-2.5 rounded-2xl bg-[#07090F]/90 border border-white/10 text-right">
                <p className="text-[11px] text-slate-400">
                  Lv.{tier.level} · {tier.title}
                </p>
                <p className="font-mono-tabular text-xl font-black text-[#E11D48]">
                  {userProfile.points} XP
                </p>
              </div>
            )}
            <button
              onClick={() => setActiveTab('simulator')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-xs font-extrabold whitespace-nowrap transition shadow-lg"
            >
              <Swords className="w-4 h-4 text-[#E11D48]" />
              Match Simulator
            </button>
            <button
              onClick={() => setActiveTab('cards')}
              className="px-4 py-2.5 rounded-xl bg-[#E11D48] hover:bg-[#be123c] text-white text-xs font-bold whitespace-nowrap transition shadow-lg shadow-rose-950/30"
            >
              Open STR Player Cards
            </button>
          </div>
        </div>
      </div>

      {/* Difficulty Bar + Category Tabs */}
      <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
            Difficulty:
          </span>
          {(['Easy', 'Medium', 'Hard', 'Expert'] as GameDifficulty[]).map((lv) => {
            const c = DIFFICULTY_CONFIG[lv];
            const active = difficulty === lv;
            return (
              <button
                key={lv}
                onClick={() => setDifficulty(lv)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                  active
                    ? 'bg-[#E11D48] text-white border-[#E11D48] shadow-md shadow-rose-950/30'
                    : 'bg-slate-50 dark:bg-[#07090F] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-[#E11D48]'
                }`}
              >
                {c.label} · {c.multiplier}x XP
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">{diffCfg.desc}</p>
      </div>

      {mode !== 'menu' && (
        <button
          onClick={() => setMode('menu')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 text-xs font-bold hover:border-[#E11D48] transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to {GAMES_CATALOG.length} Games Hub
        </button>
      )}

      {mode === 'menu' && (
        <div className="space-y-5">
          {/* Category Filters */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {(['All', 'Arcade', 'Quizzes', 'Tactics & Cards', 'Multiplayer'] as GameCategory[]).map(
              (cat) => {
                const count =
                  cat === 'All'
                    ? GAMES_CATALOG.length
                    : GAMES_CATALOG.filter((g) => g.cat === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition ${
                      category === cat
                        ? 'bg-[#E11D48] text-white border-[#E11D48]'
                        : 'bg-white dark:bg-[#0F1219] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-[#E11D48]'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              }
            )}
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 grid sm:grid-cols-2 gap-4">
              {visibleGames.map((game) => {
                const Icon = game.icon;
                return (
                  <button
                    key={game.id}
                    onClick={() => setMode(game.id)}
                    className="group text-left rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 hover:border-[#E11D48] p-5 space-y-3 transition shadow-sm hover:shadow-xl hover:shadow-rose-950/15"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-[#E11D48]/15 flex items-center justify-center text-[#E11D48] group-hover:bg-[#E11D48] group-hover:text-white transition">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-right">
                        <span className="font-mono-tabular text-xs font-black text-[#E11D48] block">
                          {game.pts}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                          {game.cat}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white group-hover:text-[#E11D48] transition">
                        {game.title}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {game.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Leaderboard & Achievements */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-3">
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-[#E11D48]" />
                  XP Leaderboard
                </h3>
                {!user ? (
                  <p className="text-xs text-slate-500">
                    Play any of the {GAMES_CATALOG.length} mini-games right now as a guest! Sign in to sync XP points and climb the live global leaderboard.
                  </p>
                ) : leaders.length === 0 ? (
                  <p className="text-xs text-slate-500">Loading supporter standings...</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/10">
                    {leaders.map((u, idx) => (
                      <div key={u.uid} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`font-mono-tabular font-black w-5 ${
                              idx === 0 ? 'text-[#E11D48]' : 'text-slate-400'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {u.displayName}
                          </span>
                        </div>
                        <span className="font-mono-tabular font-bold text-[#E11D48]">
                          {u.points} XP
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {userProfile?.achievements && userProfile.achievements.length > 0 && (
                <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-2.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Unlocked Achievements ({userProfile.achievements.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {userProfile.achievements.map((ach) => (
                      <span
                        key={ach}
                        className="px-2.5 py-1 rounded-lg bg-[#E11D48]/10 border border-[#E11D48]/25 text-[11px] font-bold text-[#E11D48] inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {ach}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Game View */}
      {mode === 'penalty' && <PenaltyShootoutGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'free_kick' && <FreeKickChallengeGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'gk_reflex' && <GoalkeeperReflexSaveGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'crossbar' && <CrossbarChallengeGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'offside_var' && <OffsideTrapRefereeGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'passing_seq' && <TacticalPassingSequenceGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'golden_boot' && <GoldenBootRaceGame difficulty={difficulty} onScore={handleGameScore} />}

      {mode === 'photo_guess' && <GuessPlayerPhotoGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'club' && <ClubLogoQuiz difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'whoami' && <PlayerCluesGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'trivia' && <TriviaGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'trivia_blitz' && <TriviaBlitzGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'jersey_num' && <JerseyNumberMatchGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'stadiums' && <StadiumSpotterGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'derbies' && <DerbyRivalryGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'word_scramble' && <WordScrambleGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'higher_lower' && <HigherLowerGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'transfer_fees' && <TransferFeeGuesserGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'card_battle' && <QuickCardBattleGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'best_xi' && <BuildBestXIGame difficulty={difficulty} onScore={handleGameScore} />}
      {mode === 'daily' && <DailyChallengeGame difficulty={difficulty} onScore={handleGameScore} />}

      {mode === 'multiplayer' && (
        <MultiplayerChallengesPanel
          challenges={challenges}
          activeChallenge={activeChallenge}
          setActiveChallenge={setActiveChallenge}
          onWin={() => handleGameScore(40, 'Friend Duel Victory', 'Friend Duel Champion')}
        />
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
      <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-8 text-center text-sm text-slate-500">
        Sign in to create and accept multiplayer challenges with your STR friends.
      </div>
    );
  }

  const createChallenge = async () => {
    const f = friends.find((x) => x.uid === targetUid);
    if (!f) return;
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
    } else {
      pushToast(`Submitted turn score: ${score} goals/pts!`, 'info');
    }
    setActiveChallenge(null);
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-4">
        <h2 className="font-display text-xl font-bold">Challenge a Friend</h2>
        <select
          value={targetUid}
          onChange={(e) => setTargetUid(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs"
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
          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs"
        >
          <option value="penalty">Penalty Shootout Duel</option>
          <option value="quiz">Who Am I? Quiz Duel</option>
          <option value="higher_lower">Higher or Lower Duel</option>
          <option value="card_battle">Card Battle Duel</option>
        </select>
        <button
          disabled={!targetUid}
          onClick={createChallenge}
          className="w-full py-2.5 rounded-xl bg-[#E11D48] text-white font-bold text-xs disabled:opacity-50"
        >
          Send Challenge Invite
        </button>
      </div>

      <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-3">
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
                      ? 'bg-[#E11D48]/10 border-[#E11D48]'
                      : 'bg-slate-50 dark:bg-[#07090F] border-slate-200 dark:border-white/10'
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
                      className="px-3.5 py-1.5 rounded-lg bg-[#E11D48] text-white font-bold"
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
