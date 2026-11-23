import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Flame, Timer } from 'lucide-react';
import {
  CLUB_LOGO_QUIZ,
  PLAYER_CLUES_GAME,
  TRIVIA_QUESTIONS,
} from '../../data/footballCatalog';
import { PLAYER_CARDS_CATALOG } from '../../data/playerCardsCatalog';
import {
  DERBY_MATCHES_QUIZ,
  DIFFICULTY_CONFIG,
  EXTRA_TRIVIA_QUESTIONS,
  JERSEY_NUMBER_QUIZ,
  STADIUM_SPOTTER_QUIZ,
  TRANSFER_FEE_DUELS,
  WORD_SCRAMBLE_PLAYERS,
  type GameDifficulty,
} from '../../data/expandedGamesData';
import { usePlayerHeadshot } from '../PlayerCardVisual';
import type { GameArcadeProps } from './ArcadeFootballGames';

function QuizHeader({
  title,
  difficulty,
  rightText,
  secondsLeft,
}: {
  title: string;
  difficulty: GameDifficulty;
  rightText: string;
  secondsLeft?: number;
}) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
          {title}
        </h2>
        <span className="px-2 py-0.5 rounded-md bg-[#E11D48]/15 border border-[#E11D48]/30 text-[10px] font-bold uppercase text-[#E11D48]">
          {difficulty} · {cfg.multiplier}x XP
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        {typeof secondsLeft === 'number' && (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono-tabular text-xs font-bold border ${
              secondsLeft <= 4
                ? 'bg-[#E11D48] text-white border-[#E11D48] animate-pulse'
                : 'bg-slate-100 dark:bg-[#07090F] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            {secondsLeft}s
          </span>
        )}
        <span className="font-mono-tabular text-xs font-black text-[#E11D48]">{rightText}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. GUESS PLAYER FROM PHOTO                                                 */
/* -------------------------------------------------------------------------- */
export function GuessPlayerPhotoGame({ difficulty, onScore }: GameArcadeProps) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [sec, setSec] = useState(cfg.timerSec);

  const pool = PLAYER_CARDS_CATALOG;
  const target = pool[round % pool.length];
  const photoUrl = usePlayerHeadshot(target.tsdbSearchName);

  const distractors = pool
    .filter((c) => c.id !== target.id)
    .slice(round % 6, (round % 6) + 3)
    .map((c) => c.name);
  const options = [target.name, ...distractors].sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    setSec(cfg.timerSec);
  }, [round, cfg.timerSec]);

  useEffect(() => {
    if (picked) return;
    const t = setInterval(() => {
      setSec((s) => {
        if (s <= 1) {
          setPicked('__TIMEOUT__');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [picked]);

  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (opt === target.name) onScore(20, 'Photo Quiz Correct', 'Sharp Eye');
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <QuizHeader
        title="Guess the Player Photo"
        difficulty={difficulty}
        secondsLeft={!picked ? sec : undefined}
        rightText={`Round ${round + 1}`}
      />

      <div className="p-6 rounded-2xl bg-[#07090F] border border-white/10 flex flex-col items-center gap-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Mystery Footballer"
            referrerPolicy="no-referrer"
            className="h-44 object-contain drop-shadow-2xl"
          />
        ) : (
          <div className="h-44 w-44 rounded-full bg-[#141923] border border-white/10 flex items-center justify-center text-sm text-slate-400">
            Portrait Loading...
          </div>
        )}
        {difficulty !== 'Expert' && (
          <p className="text-xs text-slate-400">
            Hint: {target.position} · {target.nationalTeam} {difficulty === 'Easy' ? `· #${target.jerseyNumber}` : ''}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => choose(opt)}
            className={`py-3 px-4 rounded-xl border text-sm font-semibold transition ${
              !picked
                ? 'bg-slate-50 dark:bg-[#07090F] border-slate-200 dark:border-white/10 hover:border-[#E11D48]'
                : opt === target.name
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500'
                : picked === opt
                ? 'bg-[#E11D48]/20 border-[#E11D48] text-[#E11D48]'
                : 'opacity-50 border-slate-200 dark:border-white/10'
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
          className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
        >
          Next Photo
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 9. CLUB LOGO QUIZ                                                          */
/* -------------------------------------------------------------------------- */
export function ClubLogoQuiz({ difficulty, onScore }: GameArcadeProps) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [sec, setSec] = useState(cfg.timerSec);
  const item = CLUB_LOGO_QUIZ[idx % CLUB_LOGO_QUIZ.length];

  useEffect(() => {
    setSec(cfg.timerSec);
  }, [idx, cfg.timerSec]);

  useEffect(() => {
    if (picked) return;
    const t = setInterval(() => {
      setSec((s) => {
        if (s <= 1) {
          setPicked('__TIMEOUT__');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [picked]);

  const handlePick = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (opt === item.club) onScore(15, 'Club Crest Solved', 'Crest Collector');
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <QuizHeader
        title="Guess the Club Crest & Colors"
        difficulty={difficulty}
        secondsLeft={!picked ? sec : undefined}
        rightText={`Crest ${(idx % CLUB_LOGO_QUIZ.length) + 1}/${CLUB_LOGO_QUIZ.length}`}
      />
      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 flex flex-col items-center gap-3 text-center">
        <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-slate-300 dark:border-white/20 grid grid-cols-2 shadow-lg">
          <div style={{ backgroundColor: item.colors[0] }} />
          <div style={{ backgroundColor: item.colors[1] }} />
        </div>
        <p className="text-sm font-bold text-slate-900 dark:text-white">{item.symbolHint}</p>
        {difficulty !== 'Expert' && (
          <p className="text-xs text-slate-500">
            {item.league} · {item.city}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {item.options.map((opt) => (
          <button
            key={opt}
            onClick={() => handlePick(opt)}
            className={`py-3 px-4 rounded-xl border text-sm font-semibold transition ${
              !picked
                ? 'bg-slate-50 dark:bg-[#07090F] border-slate-200 dark:border-white/10 hover:border-[#E11D48]'
                : opt === item.club
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500'
                : picked === opt
                ? 'bg-[#E11D48]/20 border-[#E11D48] text-[#E11D48]'
                : 'opacity-50 border-slate-200 dark:border-white/10'
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
          className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
        >
          Next Crest
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 10. WHO AM I?                                                              */
/* -------------------------------------------------------------------------- */
export function PlayerCluesGame({ difficulty, onScore }: GameArcadeProps) {
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
      onScore(22, 'Who Am I? Solved', 'Scout Master');
    } else if (revealed < item.clues.length) {
      setRevealed((r) => r + 1);
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <QuizHeader
        title="Who Am I? Mystery Career"
        difficulty={difficulty}
        rightText={`Clue ${revealed}/${item.clues.length}`}
      />
      <div className="space-y-2.5">
        {item.clues.slice(0, revealed).map((c, i) => (
          <div
            key={i}
            className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-sm"
          >
            <span className="font-bold text-[#E11D48] mr-2">Clue {i + 1}:</span>
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
            className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-sm outline-none focus:border-[#E11D48]"
          />
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-white font-bold text-xs">
            Submit Guess
          </button>
          {revealed < item.clues.length && (
            <button
              type="button"
              onClick={() => setRevealed((r) => r + 1)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-semibold"
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
        <div className="p-4 rounded-xl bg-[#E11D48]/10 border border-[#E11D48]/30 flex items-center justify-between">
          <span className="font-bold text-sm">Answer: {item.answer}</span>
          <button
            onClick={() => {
              setIdx((v) => v + 1);
              setRevealed(1);
              setGuess('');
              setStatus('playing');
            }}
            className="px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
          >
            Next Player
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 11. FOOTBALL TRIVIA LEVELS                                                 */
/* -------------------------------------------------------------------------- */
export function TriviaGame({ difficulty, onScore }: GameArcadeProps) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const allQuestions = useMemo(() => [...TRIVIA_QUESTIONS, ...EXTRA_TRIVIA_QUESTIONS], []);
  const [level, setLevel] = useState<'All' | 'Beginner' | 'Tactical' | 'Legend'>('All');
  const pool = allQuestions.filter((q) => level === 'All' || q.level === level);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [sec, setSec] = useState(cfg.timerSec);
  const q = pool[idx % pool.length];

  useEffect(() => {
    setSec(cfg.timerSec);
  }, [idx, level, cfg.timerSec]);

  useEffect(() => {
    if (picked !== null) return;
    const t = setInterval(() => {
      setSec((s) => {
        if (s <= 1) {
          setPicked(-1);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [picked]);

  const selectOption = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answerIndex) onScore(15, 'Football Trivia Correct', 'Tactical Mind');
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <QuizHeader
        title="Football Quiz Championship"
        difficulty={difficulty}
        secondsLeft={picked === null ? sec : undefined}
        rightText={`Q ${(idx % pool.length) + 1}/${pool.length}`}
      />

      <div className="flex items-center gap-1.5 flex-wrap">
        {(['All', 'Beginner', 'Tactical', 'Legend'] as const).map((lv) => (
          <button
            key={lv}
            onClick={() => {
              setLevel(lv);
              setIdx(0);
              setPicked(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              level === lv
                ? 'bg-[#E11D48] text-white'
                : 'bg-slate-100 dark:bg-[#07090F] text-slate-500'
            }`}
          >
            {lv}
          </button>
        ))}
      </div>

      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{q.question}</h3>

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
                  ? 'bg-slate-50 dark:bg-[#07090F] border-slate-200 dark:border-white/10 hover:border-[#E11D48]'
                  : isCorrect
                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-500 font-bold'
                  : isPicked
                  ? 'bg-[#E11D48]/15 border-[#E11D48] text-[#E11D48]'
                  : 'bg-slate-50 dark:bg-[#07090F] border-slate-200 dark:border-white/10 opacity-60'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300">{q.fact}</p>
          <button
            onClick={() => {
              setIdx((v) => v + 1);
              setPicked(null);
            }}
            className="px-5 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
          >
            Next Question
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 12. RAPID TRIVIA BLITZ                                                     */
/* -------------------------------------------------------------------------- */
export function TriviaBlitzGame({ difficulty, onScore }: GameArcadeProps) {
  const startClock = difficulty === 'Expert' ? 18 : difficulty === 'Hard' ? 25 : difficulty === 'Medium' ? 35 : 45;
  const allQuestions = useMemo(() => [...TRIVIA_QUESTIONS, ...EXTRA_TRIVIA_QUESTIONS], []);
  const [active, setActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(startClock);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          setActive(false);
          if (score > 0) onScore(score * 6, `Trivia Blitz (${score} answered)`, 'Blitz Champion');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [active, score, onScore]);

  const q = allQuestions[idx % allQuestions.length];

  const answer = (i: number) => {
    if (!active) return;
    if (i === q.answerIndex) setScore((s) => s + 1);
    setIdx((v) => v + 1);
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <QuizHeader
        title="60-Second Speed Trivia Blitz"
        difficulty={difficulty}
        secondsLeft={active ? timeLeft : undefined}
        rightText={`Score: ${score}`}
      />

      {!active ? (
        <div className="p-6 rounded-2xl bg-[#07090F] border border-white/10 text-center space-y-4">
          <p className="text-sm text-slate-300">
            {timeLeft === 0
              ? `Time's Up! Final Blitz Score: ${score} correct answers.`
              : `Answer as many rapid-fire questions as possible in ${startClock}s!`}
          </p>
          <button
            onClick={() => {
              setScore(0);
              setIdx(Math.floor(Math.random() * allQuestions.length));
              setTimeLeft(startClock);
              setActive(true);
            }}
            className="px-6 py-3 rounded-xl bg-[#E11D48] text-white font-bold text-sm"
          >
            {timeLeft === 0 ? 'Play Blitz Again' : 'Start Blitz Clock'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{q.question}</h3>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {q.options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => answer(i)}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 hover:border-[#E11D48] text-left text-xs font-bold transition"
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

/* -------------------------------------------------------------------------- */
/* 13. HIGHER OR LOWER STATS                                                  */
/* -------------------------------------------------------------------------- */
export function HigherLowerGame({ difficulty, onScore }: GameArcadeProps) {
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
      setStreak((s) => s + 1);
      setFeedback(`Correct! ${cardB.shortName} has ${valB} ${statKey.toUpperCase()} vs ${cardA.shortName}'s ${valA}.`);
      onScore(15, 'Higher or Lower Correct', 'Stats Analyst');
    } else {
      setStreak(0);
      setFeedback(`Wrong! ${cardB.shortName} has ${valB} ${statKey.toUpperCase()} vs ${cardA.shortName}'s ${valA}.`);
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <QuizHeader
        title={`Higher or Lower: ${statKey.toUpperCase()}`}
        difficulty={difficulty}
        rightText={`Streak: ${streak}`}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-[#07090F] border border-white/10 text-white text-center space-y-2">
          <p className="text-xs text-slate-400">{cardA.club}</p>
          <p className="font-display text-2xl font-extrabold">{cardA.name}</p>
          <p className="font-mono-tabular text-4xl font-black text-[#E11D48]">{valA}</p>
          <p className="text-[11px] uppercase text-slate-400">{statKey}</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#07090F] border border-white/10 text-white text-center space-y-2">
          <p className="text-xs text-slate-400">{cardB.club}</p>
          <p className="font-display text-2xl font-extrabold">{cardB.name}</p>
          <p className="font-mono-tabular text-4xl font-black text-white">
            {feedback ? valB : '??'}
          </p>
          <p className="text-[11px] uppercase text-slate-400">{statKey}</p>
        </div>
      </div>

      {!feedback ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => guess('higher')}
            className="py-3 rounded-xl bg-white text-[#07090F] font-bold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-slate-200"
          >
            <ArrowUp className="w-4 h-4" />
            {cardB.shortName} is Higher
          </button>
          <button
            onClick={() => guess('lower')}
            className="py-3 rounded-xl bg-[#E11D48] text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#be123c]"
          >
            <ArrowDown className="w-4 h-4" />
            {cardB.shortName} is Lower
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-center">{feedback}</p>
          <button
            onClick={() => {
              setFeedback(null);
              setIdxA(idxB);
              setIdxB((prev) => (prev + 3) % PLAYER_CARDS_CATALOG.length === idxB ? prev + 4 : prev + 3);
              setStatIdx((s) => s + 1);
            }}
            className="w-full py-3 rounded-xl bg-[#E11D48] text-white font-bold text-xs"
          >
            Next Matchup
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 14. QUICK CARD BATTLE                                                      */
/* -------------------------------------------------------------------------- */
export function QuickCardBattleGame({ difficulty, onScore }: GameArcadeProps) {
  const [myIdx, setMyIdx] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const myCard = PLAYER_CARDS_CATALOG[myIdx % PLAYER_CARDS_CATALOG.length];

  const duel = (statKey: keyof (typeof myCard)['stats']) => {
    const elitePool =
      difficulty === 'Expert' || difficulty === 'Hard'
        ? PLAYER_CARDS_CATALOG.filter((c) => c.overall >= 88)
        : PLAYER_CARDS_CATALOG;
    const opp = elitePool[Math.floor(Math.random() * elitePool.length)];
    const m = myCard.stats[statKey];
    const o = opp.stats[statKey];
    if (m > o) {
      setResult(`WIN! Your ${myCard.shortName} (${m} ${statKey.toUpperCase()}) defeated ${opp.shortName} (${o})!`);
      onScore(20, 'Card Duel Win', 'Card Duelist');
    } else if (m === o) {
      setResult(`DRAW! Both ${myCard.shortName} and ${opp.shortName} tied at ${m}.`);
    } else {
      setResult(`LOSS! ${opp.shortName} (${o} ${statKey.toUpperCase()}) edged out ${myCard.shortName} (${m}).`);
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <QuizHeader
        title="Football Card Battle"
        difficulty={difficulty}
        rightText={`${myCard.overall} OVR`}
      />

      <div className="flex items-center justify-between gap-3">
        <select
          value={myIdx}
          onChange={(e) => {
            setMyIdx(Number(e.target.value));
            setResult(null);
          }}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs font-bold"
        >
          {PLAYER_CARDS_CATALOG.map((c, idx) => (
            <option key={c.id} value={idx}>
              {c.name} ({c.overall} OVR · {c.club})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const).map((k) => (
          <button
            key={k}
            onClick={() => duel(k)}
            className="py-3 rounded-xl bg-[#E11D48] hover:bg-[#be123c] text-white font-bold text-xs uppercase transition"
          >
            {k}: {myCard.stats[k]}
          </button>
        ))}
      </div>
      {result && <p className="text-sm font-bold text-center text-slate-900 dark:text-white">{result}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 15. BUILD YOUR BEST XI                                                     */
/* -------------------------------------------------------------------------- */
export function BuildBestXIGame({ difficulty, onScore }: GameArcadeProps) {
  const targetOvr = DIFFICULTY_CONFIG[difficulty].bestXiTarget;
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
    if (avg >= targetOvr) onScore(35, 'Dream Best XI Target Cleared', 'Master Tactician');
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-xl">
      <QuizHeader
        title={`Draft Best XI (Target ${targetOvr}+ OVR)`}
        difficulty={difficulty}
        rightText={`${selectedIds.length}/11 · Avg ${avg} OVR`}
      />

      <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[340px] overflow-y-auto">
        {PLAYER_CARDS_CATALOG.map((c) => {
          const on = selectedIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={`p-3 rounded-xl border text-left text-xs transition ${
                on
                  ? 'bg-[#E11D48]/15 border-[#E11D48]'
                  : 'bg-slate-50 dark:bg-[#07090F] border-slate-200 dark:border-white/10'
              }`}
            >
              <div className="flex justify-between font-bold">
                <span className="truncate">{c.shortName}</span>
                <span className="text-[#E11D48] font-mono-tabular">{c.overall}</span>
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
          className="w-full py-3 rounded-xl bg-[#E11D48] text-white font-bold text-xs disabled:opacity-50"
        >
          {selectedIds.length < 11
            ? `Pick ${11 - selectedIds.length} more players`
            : !hasGk
            ? 'Include at least 1 GK'
            : `Lock In Best XI (Goal: ${targetOvr}+ OVR)`}
        </button>
      ) : (
        <div className="p-4 rounded-xl bg-[#E11D48]/10 border border-[#E11D48] text-center space-y-2">
          <p className="font-bold text-sm">
            Best XI Locked at {avg} OVR!{' '}
            {avg >= targetOvr ? 'Target Cleared!' : `Need ${targetOvr}+ OVR on ${difficulty}!`}
          </p>
          <button
            onClick={() => {
              setSelectedIds([]);
              setSubmitted(false);
            }}
            className="px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
          >
            Rebuild Squad
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 16. TRANSFER FEE DUELS                                                     */
/* -------------------------------------------------------------------------- */
export function TransferFeeGuesserGame({ difficulty, onScore }: GameArcadeProps) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<'A' | 'B' | null>(null);
  const duel = TRANSFER_FEE_DUELS[idx % TRANSFER_FEE_DUELS.length];

  const pick = (side: 'A' | 'B') => {
    if (picked) return;
    setPicked(side);
    const aWins = duel.feeA >= duel.feeB;
    if ((side === 'A' && aWins) || (side === 'B' && !aWins)) {
      onScore(16, 'Transfer Fee Analyst', 'Transfer Guru');
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <QuizHeader
        title="Which Transfer Cost More?"
        difficulty={difficulty}
        rightText={`Duel ${(idx % TRANSFER_FEE_DUELS.length) + 1}/${TRANSFER_FEE_DUELS.length}`}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { side: 'A' as const, name: duel.playerA, move: duel.moveA, fee: duel.feeA },
          { side: 'B' as const, name: duel.playerB, move: duel.moveB, fee: duel.feeB },
        ].map((card) => (
          <button
            key={card.side}
            onClick={() => pick(card.side)}
            className={`p-5 rounded-2xl border text-left space-y-2 transition ${
              !picked
                ? 'bg-slate-50 dark:bg-[#07090F] border-slate-200 dark:border-white/10 hover:border-[#E11D48]'
                : picked === card.side
                ? 'border-[#E11D48] bg-[#E11D48]/10'
                : 'border-slate-200 dark:border-white/10'
            }`}
          >
            <p className="text-xs text-slate-500">{card.move}</p>
            <p className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
              {card.name}
            </p>
            <p className="font-mono-tabular text-2xl font-black text-[#E11D48]">
              {picked ? `€${card.fee}M` : '€???M'}
            </p>
          </button>
        ))}
      </div>

      {picked && (
        <button
          onClick={() => {
            setIdx((v) => v + 1);
            setPicked(null);
          }}
          className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
        >
          Next Transfer Duel
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 17. JERSEY NUMBER QUIZ                                                     */
/* -------------------------------------------------------------------------- */
export function JerseyNumberMatchGame({ difficulty, onScore }: GameArcadeProps) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const q = JERSEY_NUMBER_QUIZ[idx % JERSEY_NUMBER_QUIZ.length];

  const select = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (opt === q.answer) onScore(15, 'Shirt Number Solved', 'Kit Collector');
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <QuizHeader
        title="Iconic Shirt Numbers"
        difficulty={difficulty}
        rightText={`Player ${(idx % JERSEY_NUMBER_QUIZ.length) + 1}/${JERSEY_NUMBER_QUIZ.length}`}
      />
      <div className="p-5 rounded-2xl bg-[#07090F] border border-white/10 text-center space-y-1">
        <p className="font-display text-3xl font-extrabold text-white">{q.player}</p>
        <p className="text-xs text-slate-400">{q.context}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {q.options.map((opt) => (
          <button
            key={opt}
            onClick={() => select(opt)}
            className={`py-4 rounded-xl border font-mono-tabular text-lg font-black transition ${
              !picked
                ? 'bg-slate-50 dark:bg-[#07090F] border-slate-200 dark:border-white/10 hover:border-[#E11D48]'
                : opt === q.answer
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500'
                : picked === opt
                ? 'bg-[#E11D48]/20 border-[#E11D48] text-[#E11D48]'
                : 'opacity-50'
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
          className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
        >
          Next Shirt
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 18. STADIUM SPOTTER                                                        */
/* -------------------------------------------------------------------------- */
export function StadiumSpotterGame({ difficulty, onScore }: GameArcadeProps) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const item = STADIUM_SPOTTER_QUIZ[idx % STADIUM_SPOTTER_QUIZ.length];

  const pick = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (opt === item.answer) onScore(16, 'Stadium Identified', 'Ground Hopper');
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <QuizHeader
        title="Stadium Spotter Quiz"
        difficulty={difficulty}
        rightText={`Arena ${(idx % STADIUM_SPOTTER_QUIZ.length) + 1}/${STADIUM_SPOTTER_QUIZ.length}`}
      />
      <div className="p-5 rounded-2xl bg-[#07090F] border border-white/10 text-white text-center text-sm font-semibold">
        {item.clues}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {item.options.map((opt) => (
          <button
            key={opt}
            onClick={() => pick(opt)}
            className={`py-3 px-4 rounded-xl border text-xs font-bold transition ${
              !picked
                ? 'bg-slate-50 dark:bg-[#07090F] border-slate-200 dark:border-white/10 hover:border-[#E11D48]'
                : opt === item.answer
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500'
                : picked === opt
                ? 'bg-[#E11D48]/20 border-[#E11D48] text-[#E11D48]'
                : 'opacity-50'
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
          className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
        >
          Next Stadium
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 19. DERBY RIVALRIES QUIZ                                                   */
/* -------------------------------------------------------------------------- */
export function DerbyRivalryGame({ difficulty, onScore }: GameArcadeProps) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const item = DERBY_MATCHES_QUIZ[idx % DERBY_MATCHES_QUIZ.length];

  const pick = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    if (opt === item.answer) onScore(16, 'Derby Matchup Solved', 'Derby Historian');
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <QuizHeader
        title="World Derby Rivalries"
        difficulty={difficulty}
        rightText={item.derby}
      />
      <p className="text-base font-bold text-slate-900 dark:text-white">{item.prompt}</p>
      <div className="space-y-2.5">
        {item.options.map((opt) => (
          <button
            key={opt}
            onClick={() => pick(opt)}
            className={`w-full text-left py-3 px-4 rounded-xl border text-xs font-bold transition ${
              !picked
                ? 'bg-slate-50 dark:bg-[#07090F] border-slate-200 dark:border-white/10 hover:border-[#E11D48]'
                : opt === item.answer
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500'
                : picked === opt
                ? 'bg-[#E11D48]/20 border-[#E11D48] text-[#E11D48]'
                : 'opacity-50'
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
          className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
        >
          Next Rivalry
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 20. FOOTBALLER WORD SCRAMBLE                                               */
/* -------------------------------------------------------------------------- */
export function WordScrambleGame({ difficulty, onScore }: GameArcadeProps) {
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [solved, setSolved] = useState(false);

  const item = WORD_SCRAMBLE_PLAYERS[idx % WORD_SCRAMBLE_PLAYERS.length];
  const scrambled = useMemo(() => {
    const arr = item.name.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (i * 7 + idx) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const res = arr.join(' ');
    return res === item.name.split('').join(' ') ? arr.reverse().join(' ') : res;
  }, [item.name, idx]);

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    if (solved) return;
    if (input.trim().toUpperCase() === item.name) {
      setSolved(true);
      onScore(20, 'Word Scramble Unscrambled', 'Word Striker');
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <QuizHeader
        title="Footballer Name Scramble"
        difficulty={difficulty}
        rightText={`Word ${(idx % WORD_SCRAMBLE_PLAYERS.length) + 1}/${WORD_SCRAMBLE_PLAYERS.length}`}
      />
      <div className="p-6 rounded-2xl bg-[#07090F] border border-white/10 text-center space-y-2">
        <p className="font-mono-tabular text-3xl font-black tracking-[0.25em] text-[#E11D48]">
          {scrambled}
        </p>
        {difficulty !== 'Expert' && <p className="text-xs text-slate-400">Hint: {item.hint}</p>}
      </div>

      {!solved ? (
        <form onSubmit={check} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type unscrambled surname..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-sm uppercase font-bold outline-none focus:border-[#E11D48]"
          />
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#E11D48] text-white font-bold text-xs">
            Solve
          </button>
        </form>
      ) : (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-between">
          <span className="font-bold text-sm text-emerald-500">Unscrambled: {item.name}!</span>
          <button
            onClick={() => {
              setIdx((v) => v + 1);
              setInput('');
              setSolved(false);
            }}
            className="px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
          >
            Next Scramble
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 21. DAILY FOOTBALL CHALLENGE                                               */
/* -------------------------------------------------------------------------- */
export function DailyChallengeGame({ difficulty, onScore }: GameArcadeProps) {
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
        onScore(50, 'Daily Challenge Cleared', 'Daily Champion');
      }
    }, 650);
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 max-w-2xl mx-auto space-y-4 shadow-xl">
      <QuizHeader
        title={`Daily Challenge · ${todayKey}`}
        difficulty={difficulty}
        rightText="+50 Base XP"
      />
      {done ? (
        <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
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
                className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 hover:border-[#E11D48] text-sm font-medium"
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
