import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Award,
  BookmarkCheck,
  BookmarkPlus,
  ChevronLeft,
  FastForward,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  advanceMatchMinute,
  generateMatchReport,
  performManualSubstitution,
  simulateToFullTime,
} from '../../lib/matchSimulatorEngine';
import type {
  LivePlayerState,
  SimEvent,
  SimFormation,
  SimMatchState,
  TacticalMentality,
} from '../../types/simulator';
import { usePlayerHeadshot } from '../PlayerCardVisual';
import { SimulatorPitch2D } from './SimulatorPitch2D';
import { SimulatorTeamBadge } from './SimulatorTeamBadge';

type CenterTab = 'pitch' | 'timeline' | 'stats' | 'lineups';

function eventIcon(type: SimEvent['type']): string {
  switch (type) {
    case 'goal':
    case 'penalty_goal':
    case 'var_goal':
      return '⚽';
    case 'penalty_miss':
      return '🧤';
    case 'var_disallowed':
    case 'var_penalty':
      return '📺';
    case 'yellow':
      return '🟨';
    case 'red':
      return '🟥';
    case 'sub':
      return '🔄';
    case 'injury':
      return '🚑';
    case 'halftime':
    case 'fulltime':
    case 'kickoff':
    case 'extratime_start':
      return '📣';
    case 'shootout':
      return '🎯';
    default:
      return '⚡';
  }
}

function MotmSpotlight({ motm, sideLabel }: { motm: LivePlayerState; sideLabel: string }) {
  const headshot = usePlayerHeadshot(motm.player.tsdbSearchName);
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#190910] via-[#0F1219] to-[#0A0D14] border border-[#E11D48]/50 p-4 sm:p-5 flex items-center gap-4">
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-black/50 border border-amber-400/50 overflow-hidden flex items-center justify-center shrink-0">
        {headshot && !imgErr ? (
          <img
            src={headshot}
            alt={motm.player.name}
            referrerPolicy="no-referrer"
            onError={() => setImgErr(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-mono-tabular text-2xl font-black text-amber-300">
            #{motm.player.jersey}
          </span>
        )}
        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono-tabular text-[10px] font-black">
          {motm.rating.toFixed(1)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
          <Award className="w-3.5 h-3.5" />
          Man of the Match
        </div>
        <h4 className="text-lg sm:text-xl font-display font-black text-white truncate mt-0.5">
          {motm.player.name}
        </h4>
        <p className="text-xs text-slate-300 mt-0.5">
          {sideLabel} · {motm.player.position} · OVR {motm.player.overall}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono-tabular text-slate-200">
          {motm.goals > 0 && <span>⚽ {motm.goals} Goal{motm.goals > 1 ? 's' : ''}</span>}
          {motm.assists > 0 && <span>🅰️ {motm.assists} Assist{motm.assists > 1 ? 's' : ''}</span>}
          {motm.saves > 0 && <span>🧤 {motm.saves} Save{motm.saves > 1 ? 's' : ''}</span>}
          {motm.shots > 0 && <span>🎯 {motm.shots} Shots</span>}
          <span>⚡ {Math.round(motm.stamina)}% Stamina</span>
        </div>
      </div>
    </div>
  );
}

export function SimulatorMatchCenter({
  initialState,
  onExit,
  onSaveReport,
  onRematch,
  isSaved,
  saving,
  tournamentActionLabel,
  onTournamentFinish,
}: {
  initialState: SimMatchState;
  onExit: () => void;
  onSaveReport: (state: SimMatchState) => Promise<void> | void;
  onRematch: () => void;
  isSaved: boolean;
  saving: boolean;
  tournamentActionLabel?: string;
  onTournamentFinish?: (state: SimMatchState) => void;
}) {
  const [match, setMatch] = useState<SimMatchState>(initialState);
  const [playing, setPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<1 | 2 | 4>(2);
  const [tab, setTab] = useState<CenterTab>('pitch');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'key'>('all');
  const [subSide, setSubSide] = useState<'home' | 'away' | null>(null);
  const [subOutId, setSubOutId] = useState<string>('');

  useEffect(() => {
    setMatch(initialState);
    setPlaying(true);
    setTab('pitch');
    setSubSide(null);
  }, [initialState]);

  useEffect(() => {
    if (!playing || match.phase === 'FULLTIME') {
      if (match.phase === 'FULLTIME') setPlaying(false);
      return;
    }

    const intervalMs =
      match.phase === 'HALFTIME' || match.phase === 'EXTRA_TIME_HT'
        ? 1100
        : match.phase === 'PENALTY_SHOOTOUT'
        ? 750
        : speed === 4
        ? 110
        : speed === 2
        ? 280
        : 560;

    const timer = setInterval(() => {
      setMatch((prev) => advanceMatchMinute(prev));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [playing, speed, match.phase]);

  const report = useMemo(() => {
    if (match.phase !== 'FULLTIME') return null;
    return generateMatchReport(match);
  }, [match]);

  const goalScorersHome = useMemo(
    () =>
      match.events
        .filter(
          (e) =>
            e.side === 'home' &&
            (e.type === 'goal' || e.type === 'penalty_goal' || e.type === 'var_goal')
        )
        .slice()
        .reverse(),
    [match.events]
  );

  const goalScorersAway = useMemo(
    () =>
      match.events
        .filter(
          (e) =>
            e.side === 'away' &&
            (e.type === 'goal' || e.type === 'penalty_goal' || e.type === 'var_goal')
        )
        .slice()
        .reverse(),
    [match.events]
  );

  const phaseLabel =
    match.phase === 'FIRST_HALF'
      ? '1ST HALF'
      : match.phase === 'HALFTIME'
      ? 'HALF TIME'
      : match.phase === 'SECOND_HALF'
      ? '2ND HALF'
      : match.phase === 'EXTRA_TIME_1'
      ? 'EXTRA TIME 1'
      : match.phase === 'EXTRA_TIME_HT'
      ? 'ET BREAK'
      : match.phase === 'EXTRA_TIME_2'
      ? 'EXTRA TIME 2'
      : match.phase === 'PENALTY_SHOOTOUT'
      ? 'PENALTIES'
      : 'FULL TIME';

  const clockDisplay =
    match.phase === 'FULLTIME'
      ? 'FT'
      : match.phase === 'HALFTIME'
      ? 'HT'
      : match.phase === 'PENALTY_SHOOTOUT'
      ? 'PEN'
      : match.addedTime > 0
      ? `${match.minute}+${match.addedTime}'`
      : `${match.minute}'`;

  const setMentality = (side: 'home' | 'away', m: TacticalMentality) => {
    setMatch((prev) => ({
      ...prev,
      mentalityHome: side === 'home' ? m : prev.mentalityHome,
      mentalityAway: side === 'away' ? m : prev.mentalityAway,
    }));
  };

  const setFormation = (side: 'home' | 'away', f: SimFormation) => {
    setMatch((prev) => ({
      ...prev,
      formationHome: side === 'home' ? f : prev.formationHome,
      formationAway: side === 'away' ? f : prev.formationAway,
    }));
  };

  const handleConfirmSub = (inPlayerId: string) => {
    if (!subSide || !subOutId) return;
    setMatch((prev) => performManualSubstitution(prev, subSide, subOutId, inPlayerId));
    setSubSide(null);
    setSubOutId('');
  };

  const filteredEvents =
    timelineFilter === 'key' ? match.events.filter((e) => e.isKey) : match.events;

  const statRows: {
    label: string;
    home: string | number;
    away: string | number;
    hPct: number;
  }[] = [
    {
      label: 'Possession',
      home: `${match.stats.possessionHome}%`,
      away: `${match.stats.possessionAway}%`,
      hPct: match.stats.possessionHome,
    },
    {
      label: 'Total Shots',
      home: match.stats.shotsHome,
      away: match.stats.shotsAway,
      hPct:
        match.stats.shotsHome + match.stats.shotsAway === 0
          ? 50
          : (match.stats.shotsHome / (match.stats.shotsHome + match.stats.shotsAway)) * 100,
    },
    {
      label: 'Shots on Target',
      home: match.stats.shotsOnTargetHome,
      away: match.stats.shotsOnTargetAway,
      hPct:
        match.stats.shotsOnTargetHome + match.stats.shotsOnTargetAway === 0
          ? 50
          : (match.stats.shotsOnTargetHome /
              (match.stats.shotsOnTargetHome + match.stats.shotsOnTargetAway)) *
            100,
    },
    {
      label: 'Expected Goals (Sim xG)',
      home: match.stats.xgHome.toFixed(2),
      away: match.stats.xgAway.toFixed(2),
      hPct:
        match.stats.xgHome + match.stats.xgAway === 0
          ? 50
          : (match.stats.xgHome / (match.stats.xgHome + match.stats.xgAway)) * 100,
    },
    {
      label: 'Corners',
      home: match.stats.cornersHome,
      away: match.stats.cornersAway,
      hPct:
        match.stats.cornersHome + match.stats.cornersAway === 0
          ? 50
          : (match.stats.cornersHome / (match.stats.cornersHome + match.stats.cornersAway)) * 100,
    },
    {
      label: 'Total Passes (Acc.)',
      home: `${match.stats.passesHome} (${match.stats.passAccHome}%)`,
      away: `${match.stats.passesAway} (${match.stats.passAccAway}%)`,
      hPct:
        match.stats.passesHome + match.stats.passesAway === 0
          ? 50
          : (match.stats.passesHome / (match.stats.passesHome + match.stats.passesAway)) * 100,
    },
    {
      label: 'Goalkeeper Saves',
      home: match.stats.savesHome,
      away: match.stats.savesAway,
      hPct:
        match.stats.savesHome + match.stats.savesAway === 0
          ? 50
          : (match.stats.savesHome / (match.stats.savesHome + match.stats.savesAway)) * 100,
    },
    {
      label: 'Fouls Conceded',
      home: match.stats.foulsHome,
      away: match.stats.foulsAway,
      hPct:
        match.stats.foulsHome + match.stats.foulsAway === 0
          ? 50
          : (match.stats.foulsHome / (match.stats.foulsHome + match.stats.foulsAway)) * 100,
    },
    {
      label: 'Yellow / Red Cards',
      home: `${match.stats.yellowHome}🟨 / ${match.stats.redHome}🟥`,
      away: `${match.stats.yellowAway}🟨 / ${match.stats.redAway}🟥`,
      hPct: 50,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 text-xs font-bold hover:border-[#E11D48]/60 transition min-h-[40px]"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Setup
        </button>

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {match.competitionLabel} · {match.knockoutRules ? 'Knockout Tie (ET & Pens)' : '90 Min Match'}
        </div>
      </div>

      {/* Broadcast Scoreboard Header */}
      <div className="rounded-3xl bg-[#07090F] text-white border border-slate-800 shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[#E11D48] via-white/30 to-[#E11D48]" />

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
            {/* Home Side */}
            <div className="flex flex-col items-center sm:items-end text-center sm:text-right min-w-0">
              <div className="flex flex-col sm:flex-row-reverse items-center gap-3">
                <SimulatorTeamBadge team={match.homeTeam} size="lg" />
                <div className="min-w-0">
                  <h2 className="text-base sm:text-xl font-display font-black truncate">
                    {match.homeTeam.shortName}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {match.formationHome} · {match.styleHome}
                  </p>
                </div>
              </div>
              {goalScorersHome.length > 0 && (
                <div className="mt-2.5 flex flex-wrap justify-center sm:justify-end gap-x-2.5 gap-y-0.5 text-[11px] text-slate-300">
                  {goalScorersHome.map((g) => (
                    <span key={g.id}>
                      ⚽ {g.playerName} {g.minuteLabel}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Score & Clock */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E11D48]/15 border border-[#E11D48]/40 text-[#E11D48] text-[10px] font-black tracking-widest uppercase mb-2">
                {match.phase !== 'FULLTIME' && playing && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] animate-ping" />
                )}
                {phaseLabel}
              </div>

              <div className="flex items-center gap-3 sm:gap-4 font-mono-tabular">
                <span className="text-4xl sm:text-5xl font-black tracking-tight">
                  {match.homeScore}
                </span>
                <span className="text-xl text-slate-500 font-bold">–</span>
                <span className="text-4xl sm:text-5xl font-black tracking-tight">
                  {match.awayScore}
                </span>
              </div>

              {match.shootoutKicks.length > 0 && (
                <div className="mt-1 font-mono-tabular text-xs font-extrabold text-amber-400">
                  PEN ({match.homePenScore} – {match.awayPenScore})
                </div>
              )}

              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 font-mono-tabular text-xs font-extrabold text-white">
                <Timer className="w-3.5 h-3.5 text-[#E11D48]" />
                {clockDisplay}
              </div>
            </div>

            {/* Away Side */}
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <SimulatorTeamBadge team={match.awayTeam} size="lg" />
                <div className="min-w-0">
                  <h2 className="text-base sm:text-xl font-display font-black truncate">
                    {match.awayTeam.shortName}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {match.formationAway} · {match.styleAway}
                  </p>
                </div>
              </div>
              {goalScorersAway.length > 0 && (
                <div className="mt-2.5 flex flex-wrap justify-center sm:justify-start gap-x-2.5 gap-y-0.5 text-[11px] text-slate-300">
                  {goalScorersAway.map((g) => (
                    <span key={g.id}>
                      ⚽ {g.playerName} {g.minuteLabel}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Playback Controls & Mentality Bar */}
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {match.phase !== 'FULLTIME' ? (
                <>
                  <button
                    onClick={() => setPlaying((p) => !p)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold transition min-h-[40px]"
                  >
                    {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {playing ? 'Pause' : 'Play'}
                  </button>

                  <button
                    onClick={() => setMatch((prev) => advanceMatchMinute(prev))}
                    disabled={playing}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 text-xs font-bold transition min-h-[40px]"
                  >
                    +1 Min
                  </button>

                  <div className="inline-flex rounded-xl bg-white/5 border border-white/10 p-0.5">
                    {([1, 2, 4] as const).map((sp) => (
                      <button
                        key={sp}
                        onClick={() => setSpeed(sp)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-tabular font-bold transition ${
                          speed === sp ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setPlaying(false);
                      setMatch((prev) => simulateToFullTime(prev));
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold transition min-h-[40px]"
                  >
                    <FastForward className="w-3.5 h-3.5 text-[#E11D48]" />
                    Sim to FT
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onRematch}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold transition min-h-[40px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Play Rematch
                  </button>
                  <button
                    onClick={() => onSaveReport(match)}
                    disabled={isSaved || saving}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition min-h-[40px] ${
                      isSaved
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white text-slate-950 hover:bg-slate-100'
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <BookmarkCheck className="w-4 h-4" />
                        Saved to History
                      </>
                    ) : saving ? (
                      'Saving...'
                    ) : (
                      <>
                        <BookmarkPlus className="w-4 h-4" />
                        Save Match History
                      </>
                    )}
                  </button>
                  {onTournamentFinish && tournamentActionLabel && (
                    <button
                      onClick={() => onTournamentFinish(match)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-black hover:bg-amber-300 transition min-h-[40px]"
                    >
                      <Trophy className="w-4 h-4" />
                      {tournamentActionLabel}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Live Mentality & Sub Quick Controls */}
            {match.phase !== 'FULLTIME' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2 py-1">
                  <span className="text-[10px] font-bold text-slate-400 mr-1">
                    {match.homeTeam.abbr}:
                  </span>
                  {(['Defensive', 'Balanced', 'Attacking'] as TacticalMentality[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMentality('home', m)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                        match.mentalityHome === m
                          ? 'bg-[#E11D48] text-white'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {m.slice(0, 3)}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setPlaying(false);
                      setSubSide('home');
                      setSubOutId('');
                    }}
                    className="ml-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold"
                  >
                    Sub ({match.subsUsedHome}/5)
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2 py-1">
                  <span className="text-[10px] font-bold text-slate-400 mr-1">
                    {match.awayTeam.abbr}:
                  </span>
                  {(['Defensive', 'Balanced', 'Attacking'] as TacticalMentality[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMentality('away', m)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                        match.mentalityAway === m
                          ? 'bg-[#E11D48] text-white'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {m.slice(0, 3)}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setPlaying(false);
                      setSubSide('away');
                      setSubOutId('');
                    }}
                    className="ml-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold"
                  >
                    Sub ({match.subsUsedAway}/5)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Penalty Shootout Strip */}
      {match.shootoutKicks.length > 0 && (
        <div className="rounded-2xl bg-[#0F1219] border border-amber-500/30 p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Penalty Shootout ({match.homePenScore} – {match.awayPenScore})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-300 w-12">{match.homeTeam.abbr}</span>
              {match.shootoutKicks
                .filter((k) => k.side === 'home')
                .map((k, idx) => (
                  <span
                    key={idx}
                    title={k.takerName}
                    className={`px-2 py-1 rounded-lg font-bold ${
                      k.scored
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-[#E11D48]/20 text-rose-300 border border-[#E11D48]/40'
                    }`}
                  >
                    {k.scored ? '✓' : '✕'} {k.takerName}
                  </span>
                ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-300 w-12">{match.awayTeam.abbr}</span>
              {match.shootoutKicks
                .filter((k) => k.side === 'away')
                .map((k, idx) => (
                  <span
                    key={idx}
                    title={k.takerName}
                    className={`px-2 py-1 rounded-lg font-bold ${
                      k.scored
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-[#E11D48]/20 text-rose-300 border border-[#E11D48]/40'
                    }`}
                  >
                    {k.scored ? '✓' : '✕'} {k.takerName}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Substitution Drawer */}
      {subSide && (
        <div className="rounded-2xl bg-white dark:bg-[#0F1219] border-2 border-[#E11D48] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-black flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-[#E11D48]" />
              Make Substitution — {subSide === 'home' ? match.homeTeam.name : match.awayTeam.name}
            </h3>
            <button
              onClick={() => {
                setSubSide(null);
                setSubOutId('');
              }}
              className="text-xs font-bold text-slate-500 hover:text-[#E11D48]"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                1. Select Player Coming Off
              </p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(subSide === 'home' ? match.homeRoster : match.awayRoster)
                  .filter((r) => r.onPitch && !r.redCard)
                  .map((r) => (
                    <button
                      key={r.player.id}
                      onClick={() => setSubOutId(r.player.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition ${
                        subOutId === r.player.id
                          ? 'bg-[#E11D48] text-white border-[#E11D48]'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-[#E11D48]/50'
                      }`}
                    >
                      <span className="font-semibold">
                        #{r.player.jersey} {r.player.name} ({r.player.position})
                      </span>
                      <span className="font-mono-tabular">
                        {Math.round(r.stamina)}% Stam
                      </span>
                    </button>
                  ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                2. Select Substitute Coming On
              </p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(subSide === 'home' ? match.homeRoster : match.awayRoster)
                  .filter((r) => !r.onPitch && !r.subbedOutAt && !r.redCard)
                  .map((r) => (
                    <button
                      key={r.player.id}
                      disabled={!subOutId}
                      onClick={() => handleConfirmSub(r.player.id)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl border bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-emerald-500 disabled:opacity-45 text-xs transition"
                    >
                      <span className="font-semibold">
                        #{r.player.jersey} {r.player.name} ({r.player.position})
                      </span>
                      <span className="font-mono-tabular font-bold text-emerald-500">
                        OVR {r.player.overall}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Time Final Match Report Banner */}
      {report && (
        <div className="rounded-3xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#E11D48]">
                Official Simulator Match Report
              </span>
              <h3 className="text-xl sm:text-2xl font-display font-black mt-0.5">
                {report.winnerSide === 'draw'
                  ? `Honors Even (${report.scoreline})`
                  : `${report.winnerName} Claim Victory (${report.scoreline})`}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{match.formationHome} vs {match.formationAway}</span>
            </div>
          </div>

          <MotmSpotlight
            motm={report.manOfTheMatch}
            sideLabel={
              report.manOfTheMatch.side === 'home' ? match.homeTeam.name : match.awayTeam.name
            }
          />

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {report.tacticalTakeaway}
          </p>
        </div>
      )}

      {/* Match Center Section Switcher */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
        {(
          [
            { id: 'pitch', label: 'Pitch & Commentary', icon: Activity },
            { id: 'timeline', label: `Timeline (${match.events.length})`, icon: Flame },
            { id: 'stats', label: 'Match Statistics', icon: Swords },
            { id: 'lineups', label: 'Lineups & Ratings', icon: Shield },
          ] as { id: CenterTab; label: string; icon: React.ElementType }[]
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition min-h-[40px] ${
                tab === item.id
                  ? 'bg-[#E11D48] text-white shadow-sm shadow-[#E11D48]/30'
                  : 'bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-[#E11D48]/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Pitch + Live Ticker */}
      {tab === 'pitch' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 space-y-3">
            <SimulatorPitch2D
              mode="live"
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              formationHome={match.formationHome}
              formationAway={match.formationAway}
              homePlayers={match.homeRoster}
              awayPlayers={match.awayRoster}
              ballPos={match.ballPos}
              highlightedPlayerId={match.highlightedPlayerId}
              activeFlash={match.activeFlash}
              playing={playing}
              phase={match.phase}
              latestEvent={match.events[0]}
              mentalityHome={match.mentalityHome}
              mentalityAway={match.mentalityAway}
            />

            {/* Quick Live Telemetry Strip below pitch */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-3 text-center text-xs">
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                  Possession
                </p>
                <p className="font-mono-tabular font-black text-sm mt-0.5">
                  {match.stats.possessionHome}% – {match.stats.possessionAway}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                  Shots (On Target)
                </p>
                <p className="font-mono-tabular font-black text-sm mt-0.5">
                  {match.stats.shotsHome} ({match.stats.shotsOnTargetHome}) – {match.stats.shotsAway} ({match.stats.shotsOnTargetAway})
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                  Simulated xG
                </p>
                <p className="font-mono-tabular font-black text-sm mt-0.5">
                  {match.stats.xgHome.toFixed(2)} – {match.stats.xgAway.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Live Commentary Feed */}
          <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E11D48]" />
                Live Match Ticker
              </h4>
              <span className="font-mono-tabular text-[11px] font-bold text-[#E11D48]">
                {match.events.length} events
              </span>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {match.events.map((ev) => (
                <div
                  key={ev.id}
                  className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                    ev.type === 'goal' || ev.type === 'penalty_goal' || ev.type === 'var_goal'
                      ? 'bg-emerald-500/10 border-emerald-500/30 dark:text-emerald-100'
                      : ev.type === 'red' || ev.type === 'var_disallowed'
                      ? 'bg-[#E11D48]/10 border-[#E11D48]/35'
                      : ev.isKey
                      ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/15'
                      : 'bg-transparent border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-0.5">
                    <span className="font-mono-tabular text-[#E11D48]">{ev.minuteLabel}</span>
                    <span>{eventIcon(ev.type)}</span>
                    {ev.teamName && (
                      <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {ev.teamName}
                      </span>
                    )}
                  </div>
                  <p>{ev.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Full Timeline */}
      {tab === 'timeline' && (
        <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-black">Match Events Timeline</h3>
            <div className="flex gap-1.5">
              <button
                onClick={() => setTimelineFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  timelineFilter === 'all'
                    ? 'bg-[#E11D48] text-white'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                }`}
              >
                All ({match.events.length})
              </button>
              <button
                onClick={() => setTimelineFilter('key')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  timelineFilter === 'key'
                    ? 'bg-[#E11D48] text-white'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                }`}
              >
                Key Moments
              </button>
            </div>
          </div>
          <div className="space-y-2.5">
            {filteredEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10"
              >
                <span className="font-mono-tabular text-xs font-black text-[#E11D48] w-12 shrink-0 pt-0.5">
                  {ev.minuteLabel}
                </span>
                <span className="text-base leading-none pt-0.5">{eventIcon(ev.type)}</span>
                <div className="text-xs sm:text-sm leading-relaxed">
                  {ev.teamName && (
                    <span className="font-bold text-slate-900 dark:text-white mr-1.5">
                      [{ev.teamName}]
                    </span>
                  )}
                  <span className="text-slate-700 dark:text-slate-300">{ev.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Detailed Match Statistics */}
      {tab === 'stats' && (
        <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm">
              <SimulatorTeamBadge team={match.homeTeam} size="sm" />
              {match.homeTeam.shortName}
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Simulated Match Telemetry
            </span>
            <div className="flex items-center gap-2 font-bold text-sm">
              {match.awayTeam.shortName}
              <SimulatorTeamBadge team={match.awayTeam} size="sm" />
            </div>
          </div>

          <div className="space-y-4">
            {statRows.map((row) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono-tabular">
                  <span className="font-bold">{row.home}</span>
                  <span className="font-sans text-slate-500 dark:text-slate-400 font-semibold">
                    {row.label}
                  </span>
                  <span className="font-bold">{row.away}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex">
                  <div
                    className="h-full bg-[#E11D48] transition-all duration-300"
                    style={{ width: `${row.hPct}%` }}
                  />
                  <div
                    className="h-full bg-slate-500 dark:bg-slate-300 transition-all duration-300"
                    style={{ width: `${100 - row.hPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Live Lineups, Formations & Dynamic Player Ratings */}
      {tab === 'lineups' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[
            {
              side: 'home' as const,
              team: match.homeTeam,
              formation: match.formationHome,
              roster: match.homeRoster,
              subsUsed: match.subsUsedHome,
            },
            {
              side: 'away' as const,
              team: match.awayTeam,
              formation: match.formationAway,
              roster: match.awayRoster,
              subsUsed: match.subsUsedAway,
            },
          ].map((panel) => (
            <div
              key={panel.side}
              className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <SimulatorTeamBadge team={panel.team} size="sm" />
                  <div>
                    <h4 className="font-display font-bold text-sm">{panel.team.name}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Subs used: {panel.subsUsed}/5
                    </p>
                  </div>
                </div>
                {match.phase !== 'FULLTIME' ? (
                  <select
                    value={panel.formation}
                    onChange={(e) => setFormation(panel.side, e.target.value as SimFormation)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold"
                  >
                    {(['4-3-3', '4-2-3-1', '3-5-2', '4-4-2'] as SimFormation[]).map((f) => (
                      <option key={f} value={f} className="bg-[#0F1219] text-white">
                        {f}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-mono-tabular text-xs font-bold text-[#E11D48]">
                    {panel.formation}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  On Pitch
                </p>
                {panel.roster
                  .filter((r) => r.onPitch)
                  .map((r) => (
                    <div
                      key={r.player.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono-tabular font-bold text-slate-400 w-6">
                          #{r.player.jersey}
                        </span>
                        <span className="font-semibold truncate">{r.player.name}</span>
                        <span className="text-[10px] text-slate-400">{r.player.position}</span>
                        {r.goals > 0 && <span>⚽{r.goals > 1 ? r.goals : ''}</span>}
                        {r.assists > 0 && <span className="text-emerald-400">🅰️{r.assists}</span>}
                        {r.yellowCards > 0 && <span>🟨</span>}
                        {r.redCard && <span>🟥</span>}
                        {r.injured && <ShieldAlert className="w-3.5 h-3.5 text-[#E11D48]" />}
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 font-mono-tabular">
                        <span className="text-[11px] text-slate-400">
                          {Math.round(r.stamina)}%
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-black text-[11px] ${
                            r.rating >= 8.0
                              ? 'bg-amber-400 text-slate-950'
                              : r.rating >= 7.0
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-200 dark:bg-white/10'
                          }`}
                        >
                          {r.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Substitutes Bench
                </p>
                {panel.roster
                  .filter((r) => !r.onPitch)
                  .map((r) => (
                    <div
                      key={r.player.id}
                      className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/40 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400"
                    >
                      <span className="truncate">
                        #{r.player.jersey} {r.player.name} ({r.player.position}) · OVR {r.player.overall}
                      </span>
                      {r.subbedOutAt ? (
                        <span className="text-[10px] text-amber-400">Off {r.subbedOutAt}'</span>
                      ) : r.redCard ? (
                        <span className="text-[10px] text-[#E11D48]">Red Card</span>
                      ) : (
                        <span className="text-[10px]">Ready</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
