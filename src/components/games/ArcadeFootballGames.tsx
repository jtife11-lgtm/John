import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Flame, ShieldAlert, Timer, Trophy, Zap } from 'lucide-react';
import {
  DIFFICULTY_CONFIG,
  OFFSIDE_SCENARIOS,
  type GameDifficulty,
} from '../../data/expandedGamesData';

export interface GameArcadeProps {
  difficulty: GameDifficulty;
  onScore: (basePts: number, label: string, achievement?: string) => void;
}

function DifficultyHeader({
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
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
            {title}
          </h2>
          <span className="px-2 py-0.5 rounded-md bg-[#E11D48]/15 border border-[#E11D48]/30 text-[10px] font-bold uppercase text-[#E11D48]">
            {difficulty} · {cfg.multiplier}x XP
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
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
        <span className="font-mono-tabular text-sm font-black text-[#E11D48]">{rightText}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. PENALTY SHOOTOUT                                                        */
/* -------------------------------------------------------------------------- */
export function PenaltyShootoutGame({ difficulty, onScore }: GameArcadeProps) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
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
  const [shotClock, setShotClock] = useState(Math.max(5, Math.round(cfg.timerSec / 2)));

  const finished = kickNum > 5;

  useEffect(() => {
    if (busy || finished) return;
    const t = setInterval(() => {
      setShotClock((s) => {
        if (s <= 1) {
          // Timed out: AI scores automatically & kick misses
          setPlayerGoals((pg) => pg);
          setAiGoals((ag) => ag + 1);
          setResultText('Shot clock expired! Striker hesitated · AI scored.');
          setKickNum((k) => k + 1);
          return Math.max(5, Math.round(cfg.timerSec / 2));
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [busy, finished, cfg.timerSec]);

  const takeKick = (zone: (typeof zones)[number]) => {
    if (busy || finished) return;
    setBusy(true);

    // Difficulty scales keeper prediction accuracy
    const smartPredict = Math.random() < cfg.keeperAiSkill * 0.45;
    const keeperChoice = smartPredict
      ? zone
      : zones[Math.floor(Math.random() * zones.length)];
    const saved = keeperChoice.id === zone.id;

    setBallPos({ x: zone.x, y: zone.y });
    setKeeperPos({ x: keeperChoice.x, y: keeperChoice.y });

    setTimeout(() => {
      const nextPlayerGoals = saved ? playerGoals : playerGoals + 1;
      const aiScored = Math.random() < 0.48 + cfg.keeperAiSkill * 0.35;
      const nextAiGoals = aiScored ? aiGoals + 1 : aiGoals;

      setPlayerGoals(nextPlayerGoals);
      setAiGoals(nextAiGoals);
      setResultText(
        `${saved ? 'SAVED by Keeper!' : 'GOAL!'} · AI striker ${aiScored ? 'scored' : 'missed'}`
      );

      if (kickNum === 5 && nextPlayerGoals > nextAiGoals) {
        onScore(25, 'Penalty Shootout Victory', 'Penalty Ace');
      }
      setKickNum((k) => k + 1);
      setShotClock(Math.max(5, Math.round(cfg.timerSec / 2)));

      setTimeout(() => {
        setBallPos({ x: 180, y: 195 });
        setKeeperPos({ x: 180, y: 105 });
        setBusy(false);
      }, 850);
    }, 420);
  };

  const reset = () => {
    setKickNum(1);
    setPlayerGoals(0);
    setAiGoals(0);
    setBallPos({ x: 180, y: 195 });
    setKeeperPos({ x: 180, y: 105 });
    setShotClock(Math.max(5, Math.round(cfg.timerSec / 2)));
    setResultText('Choose a corner to strike!');
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 sm:p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <DifficultyHeader
        title="STR Penalty Shootout"
        difficulty={difficulty}
        secondsLeft={!finished ? shotClock : undefined}
        rightText={`YOU ${playerGoals} - ${aiGoals} AI · Kick ${Math.min(kickNum, 5)}/5`}
      />

      <div className="rounded-2xl bg-[#092e1a] border border-white/10 p-4 flex justify-center">
        <svg viewBox="0 0 360 220" className="w-full max-w-md">
          <rect x="0" y="0" width="360" height="220" fill="#0a3b22" rx="12" />
          <rect x="45" y="28" width="270" height="110" fill="rgba(255,255,255,0.06)" stroke="#ffffff" strokeWidth="4" />
          <rect x="20" y="138" width="320" height="72" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
          <g style={{ transition: 'transform 0.35s ease' }} transform={`translate(${keeperPos.x - 180}, ${keeperPos.y - 105})`}>
            <circle cx="180" cy="92" r="10" fill="#fde047" />
            <rect x="166" y="102" width="28" height="28" rx="6" fill="#E11D48" />
          </g>
          <circle
            cx={ballPos.x}
            cy={ballPos.y}
            r="11"
            fill="#ffffff"
            stroke="#07090F"
            strokeWidth="2.5"
            style={{ transition: 'all 0.36s cubic-bezier(0.16, 1, 0.3, 1)' }}
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
          className="w-full py-3 rounded-xl bg-[#E11D48] hover:bg-[#be123c] text-white font-bold text-sm transition"
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
              className="py-2.5 px-2 rounded-xl bg-slate-100 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 hover:border-[#E11D48] text-xs font-bold transition disabled:opacity-50"
            >
              {z.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. FREE KICK CHALLENGE                                                     */
/* -------------------------------------------------------------------------- */
export function FreeKickChallengeGame({ difficulty, onScore }: GameArcadeProps) {
  const speed = difficulty === 'Expert' ? 14 : difficulty === 'Hard' ? 20 : difficulty === 'Medium' ? 26 : 34;
  const [power, setPower] = useState(50);
  const [dir, setDir] = useState(1);
  const [aimSide, setAimSide] = useState<'left' | 'center' | 'right'>('left');
  const [attempts, setAttempts] = useState(5);
  const [goals, setGoals] = useState(0);
  const [locked, setLocked] = useState(false);
  const [status, setStatus] = useState('Lock your curl power inside the red sweet spot (65–88%) to bend it over the wall!');

  useEffect(() => {
    if (locked || attempts <= 0) return;
    const t = setInterval(() => {
      setPower((p) => {
        if (p >= 98) {
          setDir(-1);
          return 96;
        }
        if (p <= 2) {
          setDir(1);
          return 4;
        }
        return p + dir * 3;
      });
    }, speed);
    return () => clearInterval(t);
  }, [dir, speed, locked, attempts]);

  const strike = () => {
    if (locked || attempts <= 0) return;
    setLocked(true);
    const sweetMin = difficulty === 'Expert' ? 72 : difficulty === 'Hard' ? 68 : 60;
    const sweetMax = difficulty === 'Expert' ? 85 : difficulty === 'Hard' ? 88 : 90;

    const keeperCoveredCenter = aimSide === 'center' && Math.random() < 0.65;
    const scored = power >= sweetMin && power <= sweetMax && !keeperCoveredCenter;

    const nextAttempts = attempts - 1;
    const nextGoals = scored ? goals + 1 : goals;
    setAttempts(nextAttempts);
    setGoals(nextGoals);
    setStatus(
      power > sweetMax
        ? `Over the bar! (${power}% power)`
        : power < sweetMin
        ? `Into the 4-man wall! (${power}% power)`
        : keeperCoveredCenter
        ? 'Tipped onto the post by the keeper! Aim top corner.'
        : `TOP BINS GOLAZO! (${power}% curl over the wall!)`
    );

    if (scored) {
      onScore(18, 'Free Kick Screamer', 'Set-Piece Specialist');
    }

    setTimeout(() => {
      setLocked(false);
    }, 800);
  };

  const reset = () => {
    setAttempts(5);
    setGoals(0);
    setLocked(false);
    setStatus('Aim around the wall and hit the sweet spot!');
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 sm:p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <DifficultyHeader
        title="Free Kick Challenge"
        difficulty={difficulty}
        rightText={`Goals: ${goals} · Kicks Left: ${attempts}`}
      />

      {/* Interactive Pitch Frame */}
      <div className="rounded-2xl bg-[#092e1a] border border-white/10 p-4 space-y-3">
        <svg viewBox="0 0 360 175" className="w-full max-w-md mx-auto">
          <rect x="0" y="0" width="360" height="175" rx="10" fill="#0a3b22" />
          <rect x="60" y="20" width="240" height="82" fill="rgba(255,255,255,0.05)" stroke="#ffffff" strokeWidth="3.5" />
          {/* 4-man defensive wall */}
          {[142, 162, 182, 202].map((wx) => (
            <rect key={wx} x={wx} y="92" width="12" height="24" rx="4" fill="#ffffff" stroke="#07090F" strokeWidth="1.5" />
          ))}
          {/* Keeper */}
          <rect x={aimSide === 'left' ? 225 : aimSide === 'right' ? 110 : 170} y="65" width="22" height="28" rx="5" fill="#E11D48" />
          {/* Target reticle */}
          <circle
            cx={aimSide === 'left' ? 88 : aimSide === 'right' ? 272 : 180}
            cy="42"
            r="14"
            fill="rgba(225,29,72,0.28)"
            stroke="#E11D48"
            strokeWidth="2.5"
            strokeDasharray="4 3"
          />
          {/* Football */}
          <circle cx="180" cy="152" r="9" fill="#ffffff" stroke="#07090F" strokeWidth="2" />
        </svg>

        {/* Aim corner */}
        <div className="flex justify-center gap-2">
          {(['left', 'center', 'right'] as const).map((side) => (
            <button
              key={side}
              onClick={() => setAimSide(side)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize border transition ${
                aimSide === side
                  ? 'bg-[#E11D48] text-white border-[#E11D48]'
                  : 'bg-[#07090F] text-slate-300 border-white/10'
              }`}
            >
              Aim {side}
            </button>
          ))}
        </div>
      </div>

      {/* Live Curl Power Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-slate-500">Strike Power & Curl Meter</span>
          <span className="font-mono-tabular text-[#E11D48] font-bold">{power}%</span>
        </div>
        <div className="relative h-6 rounded-xl bg-slate-200 dark:bg-[#07090F] border border-slate-300 dark:border-white/10 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 bg-[#E11D48]/35 border-x-2 border-[#E11D48]"
            style={{
              left: `${difficulty === 'Expert' ? 72 : difficulty === 'Hard' ? 68 : 60}%`,
              width: `${difficulty === 'Expert' ? 13 : difficulty === 'Hard' ? 20 : 30}%`,
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-2 bg-white shadow-[0_0_8px_#fff]"
            style={{ left: `calc(${power}% - 4px)` }}
          />
        </div>
      </div>

      <p className="text-center text-sm font-semibold text-slate-800 dark:text-slate-100">{status}</p>

      {attempts > 0 ? (
        <button
          disabled={locked}
          onClick={strike}
          className="w-full py-3 rounded-xl bg-[#E11D48] hover:bg-[#be123c] text-white font-bold text-sm transition disabled:opacity-50"
        >
          Strike Free Kick!
        </button>
      ) : (
        <button
          onClick={reset}
          className="w-full py-3 rounded-xl bg-[#E11D48] hover:bg-[#be123c] text-white font-bold text-sm transition"
        >
          Restart 5-Kick Session ({goals}/5 Scored)
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. GOALKEEPER REFLEX SAVE                                                  */
/* -------------------------------------------------------------------------- */
export function GoalkeeperReflexSaveGame({ difficulty, onScore }: GameArcadeProps) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const zones = [
    { id: 0, label: 'Top Left' },
    { id: 1, label: 'Top Center' },
    { id: 2, label: 'Top Right' },
    { id: 3, label: 'Low Left' },
    { id: 4, label: 'Low Center' },
    { id: 5, label: 'Low Right' },
  ];

  const [active, setActive] = useState(false);
  const [shotsLeft, setShotsLeft] = useState(8);
  const [saves, setSaves] = useState(0);
  const [incomingZone, setIncomingZone] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('Tap the incoming crimson shot zone before the ball crosses the line!');
  const timeoutRef = useRef<number | null>(null);

  const spawnShot = (remaining: number) => {
    if (remaining <= 0) {
      setActive(false);
      setIncomingZone(null);
      return;
    }
    const z = Math.floor(Math.random() * 6);
    setIncomingZone(z);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIncomingZone(null);
      setFeedback('Too slow! Striker buried it into the net.');
      setShotsLeft((s) => {
        const next = s - 1;
        setTimeout(() => spawnShot(next), 350);
        return next;
      });
    }, cfg.reflexWindowMs);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const start = () => {
    setSaves(0);
    setShotsLeft(8);
    setActive(true);
    setFeedback('Stay sharp! Shots incoming...');
    setTimeout(() => spawnShot(8), 450);
  };

  const dive = (zId: number) => {
    if (!active || incomingZone === null) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    if (zId === incomingZone) {
      const nextSaves = saves + 1;
      setSaves(nextSaves);
      setFeedback('SENSATIONAL SAVE! Finger-tip stop!');
      if (nextSaves === 5) onScore(25, 'Goalkeeper Reflex Wall', 'Clean Sheet Reflex');
      else onScore(5, 'Shot Stopped');
    } else {
      setFeedback('Wrong corner! Ball flew past!');
    }

    setIncomingZone(null);
    setShotsLeft((s) => {
      const next = s - 1;
      setTimeout(() => spawnShot(next), 350);
      return next;
    });
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 sm:p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <DifficultyHeader
        title="Goalkeeper Reflex Save"
        difficulty={difficulty}
        rightText={`Saves: ${saves} · Shots Left: ${shotsLeft}`}
      />

      <div className="grid grid-cols-3 gap-2.5 p-4 rounded-2xl bg-[#092e1a] border-4 border-white/80">
        {zones.map((z) => {
          const isTarget = incomingZone === z.id;
          return (
            <button
              key={z.id}
              onClick={() => dive(z.id)}
              disabled={!active}
              className={`h-20 rounded-xl border font-bold text-xs transition flex flex-col items-center justify-center gap-1 ${
                isTarget
                  ? 'bg-[#E11D48] text-white border-white scale-[1.03] shadow-lg shadow-rose-900/60 animate-pulse'
                  : 'bg-[#07090F]/70 text-slate-300 border-white/15 hover:border-white/40'
              }`}
            >
              <span>{isTarget ? '⚽ INCOMING!' : z.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-sm font-semibold text-slate-700 dark:text-slate-200">{feedback}</p>

      {!active && (
        <button
          onClick={start}
          className="w-full py-3 rounded-xl bg-[#E11D48] hover:bg-[#be123c] text-white font-bold text-sm transition"
        >
          {shotsLeft === 0 ? `Play Again (${saves}/8 Saved)` : 'Start Reflex Drill'}
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. CROSSBAR CHALLENGE                                                      */
/* -------------------------------------------------------------------------- */
export function CrossbarChallengeGame({ difficulty, onScore }: GameArcadeProps) {
  const targetWidth = difficulty === 'Expert' ? 8 : difficulty === 'Hard' ? 12 : difficulty === 'Medium' ? 17 : 24;
  const speed = difficulty === 'Expert' ? 12 : difficulty === 'Hard' ? 16 : difficulty === 'Medium' ? 22 : 30;
  const [pos, setPos] = useState(10);
  const [dir, setDir] = useState(1);
  const [hits, setHits] = useState(0);
  const [attempts, setAttempts] = useState(5);
  const [msg, setMsg] = useState('Lock the moving indicator directly onto the white crossbar zone!');

  useEffect(() => {
    if (attempts <= 0) return;
    const id = setInterval(() => {
      setPos((p) => {
        if (p >= 98) {
          setDir(-1);
          return 96;
        }
        if (p <= 2) {
          setDir(1);
          return 4;
        }
        return p + dir * 2.5;
      });
    }, speed);
    return () => clearInterval(id);
  }, [dir, speed, attempts]);

  const strike = () => {
    if (attempts <= 0) return;
    const min = 50 - targetWidth / 2;
    const max = 50 + targetWidth / 2;
    const hit = pos >= min && pos <= max;
    setAttempts((a) => a - 1);
    if (hit) {
      setHits((h) => h + 1);
      setMsg('CLANG! Direct hit on the crossbar!');
      onScore(20, 'Crossbar Ping', 'Crossbar Sniper');
    } else {
      setMsg(pos < min ? 'Underneath the bar—no ping!' : 'Blazed over the stadium roof!');
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 sm:p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <DifficultyHeader
        title="Crossbar Challenge"
        difficulty={difficulty}
        rightText={`Hits: ${hits} · Tries: ${attempts}`}
      />

      <div className="p-6 rounded-2xl bg-[#07090F] border border-white/10 space-y-4">
        <div className="relative h-8 rounded-xl bg-slate-900 border border-white/15 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 bg-[#E11D48]/35 border-x-2 border-white flex items-center justify-center text-[10px] font-black text-white"
            style={{ left: `${50 - targetWidth / 2}%`, width: `${targetWidth}%` }}
          >
            BAR
          </div>
          <div
            className="absolute top-0 bottom-0 w-2 bg-white shadow-[0_0_12px_#E11D48]"
            style={{ left: `calc(${pos}% - 4px)` }}
          />
        </div>
        <p className="text-center text-sm font-semibold text-white">{msg}</p>
      </div>

      {attempts > 0 ? (
        <button
          onClick={strike}
          className="w-full py-3 rounded-xl bg-[#E11D48] hover:bg-[#be123c] text-white font-bold text-sm"
        >
          PING CROSSBAR!
        </button>
      ) : (
        <button
          onClick={() => {
            setHits(0);
            setAttempts(5);
            setMsg('Aim at the crossbar sweet spot!');
          }}
          className="w-full py-3 rounded-xl bg-[#E11D48] text-white font-bold text-sm"
        >
          Play Again ({hits}/5 Hits)
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. OFFSIDE TRAP REFEREE (VAR CALL)                                         */
/* -------------------------------------------------------------------------- */
export function OffsideTrapRefereeGame({ difficulty, onScore }: GameArcadeProps) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [seconds, setSeconds] = useState(cfg.timerSec);
  const scenario = OFFSIDE_SCENARIOS[idx % OFFSIDE_SCENARIOS.length];

  useEffect(() => {
    setSeconds(cfg.timerSec);
  }, [idx, cfg.timerSec]);

  useEffect(() => {
    if (picked !== null) return;
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setPicked(!scenario.isOffside); // force timeout miss
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [picked, scenario.isOffside]);

  const callVar = (callOffside: boolean) => {
    if (picked !== null) return;
    setPicked(callOffside);
    if (callOffside === scenario.isOffside) {
      onScore(20, 'VAR Correct Decision', 'Eagle-Eye Referee');
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 sm:p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <DifficultyHeader
        title="Offside Trap VAR Referee"
        difficulty={difficulty}
        secondsLeft={picked === null ? seconds : undefined}
        rightText={`Clip ${(idx % OFFSIDE_SCENARIOS.length) + 1}/${OFFSIDE_SCENARIOS.length}`}
      />

      <p className="text-sm font-bold text-slate-900 dark:text-white">{scenario.title}</p>

      {/* 2D Offside Line Pitch */}
      <div className="rounded-2xl bg-[#092e1a] border border-white/15 p-3">
        <svg viewBox="0 0 400 160" className="w-full">
          <rect x="0" y="0" width="400" height="160" rx="8" fill="#0a3b22" />
          {/* Halfway line */}
          <line x1="200" y1="8" x2="200" y2="152" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
          <text x="192" y="20" fill="rgba(255,255,255,0.6)" fontSize="9">HALF</text>
          {/* Goal on right */}
          <rect x="360" y="45" width="32" height="70" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
          {/* VAR Offside Line at 2nd-last defender */}
          <line
            x1={scenario.defenderX * 4}
            y1="6"
            x2={scenario.defenderX * 4}
            y2="154"
            stroke="#E11D48"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
          {/* Goalkeeper */}
          <circle cx={382} cy={80} r="7" fill="#facc15" />
          {/* Last & 2nd-last defender (blue/white) */}
          <circle cx={scenario.defenderX * 4} cy={52} r="8" fill="#ffffff" stroke="#07090F" strokeWidth="2" />
          <circle cx={scenario.defender2X * 4} cy={112} r="8" fill="#ffffff" stroke="#07090F" strokeWidth="2" />
          {/* Passer + Ball */}
          <circle cx={scenario.ballX * 4 - 8} cy={95} r="8" fill="#E11D48" stroke="#ffffff" strokeWidth="2" />
          <circle cx={scenario.ballX * 4} cy={95} r="4.5" fill="#ffffff" />
          {/* Target Attacker */}
          <circle cx={scenario.attackerX * 4} cy={66} r="9" fill="#E11D48" stroke="#ffffff" strokeWidth="2.5" />
          <text x={scenario.attackerX * 4 - 11} y={48} fill="#ffffff" fontSize="9" fontWeight="bold">FWD</text>
        </svg>
        <div className="flex items-center justify-between text-[11px] text-slate-300 mt-1 px-1">
          <span>Red: Attacking Team (Attacking → Right)</span>
          <span>White: Defending Team · Dashed Red: Defender Line</span>
        </div>
      </div>

      {picked === null ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => callVar(false)}
            className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm"
          >
            ONSIDE · Play On
          </button>
          <button
            onClick={() => callVar(true)}
            className="py-3 rounded-xl bg-[#E11D48] hover:bg-[#be123c] text-white font-bold text-sm"
          >
            OFFSIDE · Raise Flag
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 space-y-3">
          <p className={`font-bold text-sm ${picked === scenario.isOffside ? 'text-emerald-500' : 'text-[#E11D48]'}`}>
            {picked === scenario.isOffside ? 'Correct VAR Call!' : 'Incorrect Decision!'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{scenario.explanation}</p>
          <button
            onClick={() => {
              setIdx((v) => v + 1);
              setPicked(null);
            }}
            className="px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
          >
            Next VAR Clip
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. TACTICAL PASSING SEQUENCE                                               */
/* -------------------------------------------------------------------------- */
export function TacticalPassingSequenceGame({ difficulty, onScore }: GameArcadeProps) {
  const seqLength = difficulty === 'Expert' ? 6 : difficulty === 'Hard' ? 5 : difficulty === 'Medium' ? 4 : 3;
  const players = [
    { num: 4, role: 'CB' },
    { num: 6, role: 'CDM' },
    { num: 8, role: 'CM' },
    { num: 10, role: 'CAM' },
    { num: 7, role: 'RW' },
    { num: 11, role: 'LW' },
    { num: 9, role: 'ST' },
  ];

  const [sequence, setSequence] = useState<number[]>([]);
  const [phase, setPhase] = useState<'idle' | 'showing' | 'input' | 'won' | 'lost'>('idle');
  const [activeFlash, setActiveFlash] = useState<number | null>(null);
  const [userStep, setUserStep] = useState(0);

  const startRound = () => {
    const seq: number[] = [];
    for (let i = 0; i < seqLength; i++) {
      seq.push(players[Math.floor(Math.random() * players.length)].num);
    }
    setSequence(seq);
    setUserStep(0);
    setPhase('showing');

    const stepMs = difficulty === 'Expert' ? 420 : difficulty === 'Hard' ? 520 : 650;
    seq.forEach((num, idx) => {
      setTimeout(() => setActiveFlash(num), idx * stepMs);
      setTimeout(() => setActiveFlash(null), idx * stepMs + stepMs * 0.65);
    });
    setTimeout(() => {
      setPhase('input');
    }, seq.length * stepMs + 120);
  };

  const tapPlayer = (num: number) => {
    if (phase !== 'input') return;
    if (sequence[userStep] === num) {
      const next = userStep + 1;
      if (next === sequence.length) {
        setPhase('won');
        onScore(22, 'Tiki-Taka Sequence Completed', 'Tactical Maestro');
      } else {
        setUserStep(next);
      }
    } else {
      setPhase('lost');
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 sm:p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <DifficultyHeader
        title="Tiki-Taka Passing Memory"
        difficulty={difficulty}
        rightText={`Sequence: ${seqLength} Passes`}
      />

      <p className="text-xs text-slate-500">
        Watch the highlighted midfield/attack shirt sequence, then repeat the exact passing pattern!
      </p>

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5 p-4 rounded-2xl bg-[#092e1a] border border-white/10">
        {players.map((p) => {
          const lit = activeFlash === p.num;
          return (
            <button
              key={p.num}
              disabled={phase !== 'input'}
              onClick={() => tapPlayer(p.num)}
              className={`py-4 rounded-xl border flex flex-col items-center justify-center transition ${
                lit
                  ? 'bg-[#E11D48] text-white border-white scale-105 shadow-lg'
                  : 'bg-[#07090F]/85 text-white border-white/15 hover:border-[#E11D48]'
              }`}
            >
              <span className="font-mono-tabular text-lg font-black">#{p.num}</span>
              <span className="text-[10px] text-slate-300">{p.role}</span>
            </button>
          );
        })}
      </div>

      {phase === 'idle' || phase === 'won' || phase === 'lost' ? (
        <div className="space-y-2 text-center">
          {phase === 'won' && <p className="text-sm font-bold text-emerald-500">Crisp tiki-taka combination! Goal scored!</p>}
          {phase === 'lost' && <p className="text-sm font-bold text-[#E11D48]">Pass intercepted! Sequence was {sequence.map((n) => `#${n}`).join(' → ')}</p>}
          <button
            onClick={startRound}
            className="w-full py-3 rounded-xl bg-[#E11D48] hover:bg-[#be123c] text-white font-bold text-sm"
          >
            {phase === 'idle' ? 'Start Passing Sequence' : 'Play Next Combination'}
          </button>
        </div>
      ) : (
        <p className="text-center text-xs font-bold uppercase tracking-wider text-[#E11D48]">
          {phase === 'showing'
            ? 'Watch the passing sequence...'
            : `Your turn! Tap pass ${userStep + 1} of ${sequence.length}`}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. GOLDEN BOOT ARCADE SHOOTER                                              */
/* -------------------------------------------------------------------------- */
export function GoldenBootRaceGame({ difficulty, onScore }: GameArcadeProps) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(cfg.timerSec);
  const [goals, setGoals] = useState(0);
  const [targetIdx, setTargetIdx] = useState(0);

  useEffect(() => {
    if (!running) return;
    const clock = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setRunning(false);
          if (goals >= 8) {
            onScore(24, `Golden Boot Arcade (${goals} goals)`, 'Golden Boot Winner');
          } else if (goals > 0) {
            onScore(goals * 2, `Golden Boot Arcade (${goals} goals)`);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    const mover = setInterval(() => {
      setTargetIdx(Math.floor(Math.random() * 9));
    }, Math.max(420, cfg.reflexWindowMs));

    return () => {
      clearInterval(clock);
      clearInterval(mover);
    };
  }, [running, cfg.reflexWindowMs, goals, onScore]);

  const start = () => {
    setGoals(0);
    setTimeLeft(cfg.timerSec);
    setTargetIdx(Math.floor(Math.random() * 9));
    setRunning(true);
  };

  const shootCell = (idx: number) => {
    if (!running) return;
    if (idx === targetIdx) {
      setGoals((g) => g + 1);
      setTargetIdx((prev) => (prev + 1 + Math.floor(Math.random() * 7)) % 9);
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 sm:p-6 max-w-2xl mx-auto space-y-5 shadow-xl">
      <DifficultyHeader
        title="Golden Boot Blitz"
        difficulty={difficulty}
        secondsLeft={running ? timeLeft : undefined}
        rightText={`Goals: ${goals}`}
      />

      <div className="grid grid-cols-3 gap-2.5 p-4 rounded-2xl bg-[#07090F] border border-white/10">
        {Array.from({ length: 9 }).map((_, idx) => {
          const hit = running && idx === targetIdx;
          return (
            <button
              key={idx}
              onClick={() => shootCell(idx)}
              className={`h-20 rounded-xl border font-bold text-xs flex items-center justify-center transition ${
                hit
                  ? 'bg-[#E11D48] text-white border-white shadow-lg scale-[1.03]'
                  : 'bg-[#0F1219] text-slate-600 border-white/10'
              }`}
            >
              {hit ? <Crosshair className="w-6 h-6 animate-spin" /> : <span className="text-[10px]">ZONE {idx + 1}</span>}
            </button>
          );
        })}
      </div>

      {!running && (
        <button
          onClick={start}
          className="w-full py-3 rounded-xl bg-[#E11D48] hover:bg-[#be123c] text-white font-bold text-sm"
        >
          {timeLeft === 0 ? `Play Again (${goals} Goals Scored)` : 'Start Golden Boot Blitz'}
        </button>
      )}
    </div>
  );
}
