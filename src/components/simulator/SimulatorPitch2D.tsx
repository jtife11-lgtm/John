import React from 'react';
import { FORMATION_SLOTS } from '../../data/simulatorTeams';
import type { LivePlayerState, SimFormation, SimMatchState, SimPlayer, SimTeam } from '../../types/simulator';

interface PitchNodeItem {
  key: string;
  x: number;
  y: number;
  side: 'home' | 'away';
  player: SimPlayer;
  live?: LivePlayerState;
  slotLabel: string;
  primaryColor: string;
  secondaryColor: string;
}

function contrastText(hex: string): string {
  const c = (hex || '#111111').toUpperCase();
  if (['#FFFFFF', '#FDE100', '#F9D616', '#FFDF00', '#FACC15', '#75AADB', '#6CABDD'].includes(c)) {
    return '#090D16';
  }
  return '#FFFFFF';
}

export function SimulatorPitch2D({
  mode,
  homeTeam,
  awayTeam,
  formationHome,
  formationAway,
  homePlayers,
  awayPlayers,
  ballPos = { x: 50, y: 50 },
  highlightedPlayerId,
  activeFlash,
  selectedSwapKey,
  onSelectPlayer,
}: {
  mode: 'prematch' | 'live';
  homeTeam: SimTeam;
  awayTeam: SimTeam;
  formationHome: SimFormation;
  formationAway: SimFormation;
  homePlayers: LivePlayerState[] | SimPlayer[];
  awayPlayers: LivePlayerState[] | SimPlayer[];
  ballPos?: { x: number; y: number };
  highlightedPlayerId?: string | null;
  activeFlash?: SimMatchState['activeFlash'];
  selectedSwapKey?: string | null;
  onSelectPlayer?: (side: 'home' | 'away', playerId: string, slotIndex: number) => void;
}) {
  const slotsHome = FORMATION_SLOTS[formationHome];
  const slotsAway = FORMATION_SLOTS[formationAway];

  const extractList = (
    raw: LivePlayerState[] | SimPlayer[],
    side: 'home' | 'away',
    team: SimTeam,
    slots: typeof slotsHome
  ): PitchNodeItem[] => {
    const isLiveArr = raw.length > 0 && 'player' in raw[0];
    const activeItems = isLiveArr
      ? (raw as LivePlayerState[]).filter((r) => r.onPitch)
      : (raw as SimPlayer[]).slice(0, 11);

    return slots.map((slot, idx) => {
      const entry = activeItems[idx];
      if (!entry) {
        return null;
      }
      const pl = isLiveArr ? (entry as LivePlayerState).player : (entry as SimPlayer);
      const live = isLiveArr ? (entry as LivePlayerState) : undefined;
      return {
        key: `${side}-${pl.id}`,
        x: side === 'home' ? slot.x : 100 - slot.x,
        y: side === 'home' ? slot.y : 100 - slot.y,
        side,
        player: pl,
        live,
        slotLabel: slot.label,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor,
      };
    }).filter(Boolean) as PitchNodeItem[];
  };

  const nodes = [
    ...extractList(homePlayers, 'home', homeTeam, slotsHome),
    ...extractList(awayPlayers, 'away', awayTeam, slotsAway),
  ];

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-emerald-500/25 bg-[#082419] shadow-2xl select-none">
      {/* Aspect Container: Taller on mobile for comfortable finger taps, crisp 16:9 on desktop */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/9]">
        {/* Alternating Broadcast Grass Stripes */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(16,185,129,0.11) 0%, rgba(16,185,129,0.11) 8.333%, rgba(6,78,59,0.22) 8.333%, rgba(6,78,59,0.22) 16.666%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />

        {/* crisp Pitch Markings SVG */}
        <svg
          viewBox="0 0 1000 620"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {/* Outer Boundary */}
          <rect
            x="24"
            y="24"
            width="952"
            height="572"
            fill="none"
            stroke="rgba(255,255,255,0.42)"
            strokeWidth="2.5"
          />
          {/* Halfway Line & Center Circle */}
          <line x1="500" y1="24" x2="500" y2="596" stroke="rgba(255,255,255,0.42)" strokeWidth="2.5" />
          <circle cx="500" cy="310" r="78" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="2.5" />
          <circle cx="500" cy="310" r="4.5" fill="rgba(255,255,255,0.75)" />

          {/* Left Penalty Area & 6-Yard Box */}
          <rect x="24" y="135" width="142" height="350" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="2.5" />
          <rect x="24" y="220" width="52" height="180" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="2.5" />
          <circle cx="122" cy="310" r="3.5" fill="rgba(255,255,255,0.75)" />
          <path d="M 166 248 A 74 74 0 0 1 166 372" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="2.5" />
          {/* Left Goal Net */}
          <rect x="10" y="264" width="14" height="92" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />

          {/* Right Penalty Area & 6-Yard Box */}
          <rect x="834" y="135" width="142" height="350" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="2.5" />
          <rect x="924" y="220" width="52" height="180" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="2.5" />
          <circle cx="878" cy="310" r="3.5" fill="rgba(255,255,255,0.75)" />
          <path d="M 834 248 A 74 74 0 0 0 834 372" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="2.5" />
          {/* Right Goal Net */}
          <rect x="976" y="264" width="14" height="92" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
        </svg>

        {/* Subtle Home / Away Direction Labels */}
        <div className="absolute top-2.5 left-4 z-10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/35 px-2.5 py-1 rounded-md backdrop-blur-xs">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: homeTeam.primaryColor }}
          />
          {homeTeam.abbr} · {formationHome}
        </div>
        <div className="absolute top-2.5 right-4 z-10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/35 px-2.5 py-1 rounded-md backdrop-blur-xs">
          {awayTeam.abbr} · {formationAway}
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: awayTeam.primaryColor }}
          />
        </div>

        {/* 22 Players on Pitch */}
        {nodes.map((node, idx) => {
          const isHighlighted = highlightedPlayerId === node.player.id;
          const isSelectedSwap = selectedSwapKey === `${node.side}:${node.player.id}`;
          const textCol = contrastText(node.primaryColor);
          const rating = node.live?.rating;
          const stamina = node.live?.stamina ?? 100;

          return (
            <button
              key={node.key}
              type="button"
              onClick={() => onSelectPlayer?.(node.side, node.player.id, idx % 11)}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group transition-all duration-300 ${
                onSelectPlayer ? 'cursor-pointer hover:scale-110' : 'cursor-default'
              }`}
              title={`${node.player.name} (${node.player.position}) · OVR ${node.player.overall}`}
            >
              {/* Token Circle */}
              <div className="relative">
                <div
                  className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-mono-tabular font-black text-[10px] sm:text-xs shadow-lg border-2 transition-transform ${
                    isSelectedSwap
                      ? 'ring-3 ring-[#E11D48] scale-115'
                      : isHighlighted
                      ? 'ring-3 ring-amber-400 scale-115'
                      : ''
                  }`}
                  style={{
                    backgroundColor: node.primaryColor,
                    borderColor: node.secondaryColor || '#FFFFFF',
                    color: textCol,
                  }}
                >
                  {node.player.jersey}
                </div>

                {/* Live Rating Pill */}
                {mode === 'live' && typeof rating === 'number' && (
                  <span
                    className={`absolute -top-2 -right-2.5 px-1 py-0 rounded text-[8px] sm:text-[9px] font-mono-tabular font-extrabold border shadow ${
                      rating >= 8.0
                        ? 'bg-amber-400 text-slate-950 border-amber-200'
                        : rating >= 7.0
                        ? 'bg-emerald-500 text-white border-emerald-300'
                        : 'bg-[#0B0F17] text-slate-100 border-white/25'
                    }`}
                  >
                    {rating.toFixed(1)}
                  </span>
                )}

                {/* Goal / Card Markers */}
                {node.live && node.live.goals > 0 && (
                  <span className="absolute -bottom-1 -left-2 bg-white text-slate-950 text-[8px] font-black px-1 rounded shadow">
                    ⚽{node.live.goals > 1 ? node.live.goals : ''}
                  </span>
                )}
                {node.live && node.live.yellowCards > 0 && !node.live.redCard && (
                  <span className="absolute -top-1.5 -left-1.5 w-2 h-3 rounded-[1px] bg-yellow-400 border border-yellow-200 shadow" />
                )}
                {node.live?.injured && (
                  <span className="absolute -bottom-1 -right-1.5 bg-[#E11D48] text-white text-[8px] font-bold px-1 rounded">
                    +
                  </span>
                )}
              </div>

              {/* Stamina Micro-Bar (Live Mode) */}
              {mode === 'live' && (
                <div className="w-7 sm:w-9 h-1 bg-black/60 rounded-full overflow-hidden mt-0.5 border border-white/10">
                  <div
                    className={`h-full transition-all duration-300 ${
                      stamina > 65 ? 'bg-emerald-400' : stamina > 40 ? 'bg-amber-400' : 'bg-[#E11D48]'
                    }`}
                    style={{ width: `${Math.round(stamina)}%` }}
                  />
                </div>
              )}

              {/* Player Short Name */}
              <span className="mt-0.5 px-1.5 py-0.2 rounded bg-black/70 text-white text-[8px] sm:text-[10px] font-semibold tracking-tight whitespace-nowrap max-w-[66px] sm:max-w-[82px] truncate border border-white/10">
                {node.player.shortName}
              </span>
            </button>
          );
        })}

        {/* Animated 60 FPS Football Sprite */}
        {mode === 'live' && (
          <div
            style={{
              left: `${ballPos.x}%`,
              top: `${ballPos.y}%`,
              transition: 'left 420ms cubic-bezier(0.22, 1, 0.36, 1), top 420ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
          >
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white border-2 border-slate-900 shadow-[0_0_14px_rgba(255,255,255,0.95)] flex items-center justify-center animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
            </div>
          </div>
        )}

        {/* Broadcast Event Flash Overlay */}
        {activeFlash && (
          <div className="absolute inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none">
            <div className="bg-[#07090F]/95 border-2 border-[#E11D48] text-white px-5 py-2.5 rounded-2xl shadow-2xl shadow-[#E11D48]/35 text-center backdrop-blur-md animate-fadeIn">
              <p className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#E11D48]">
                {activeFlash.headline}
              </p>
              <p className="text-xs sm:text-sm font-semibold text-white mt-0.5">
                {activeFlash.subline}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
