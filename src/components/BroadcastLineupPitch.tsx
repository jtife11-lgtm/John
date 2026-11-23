import React, { useMemo, useState } from 'react';
import { LayoutGrid, List, Shirt, Users } from 'lucide-react';
import type { LineupPlayer, TeamLineup } from '../types/str';
import { useApp } from '../context/AppContext';

interface PositionedPlayer {
  player: LineupPlayer;
  xPct: number;
  yPct: number;
}

function getShortDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  if (parts[parts.length - 1].length <= 2 && parts.length >= 2) {
    return `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
  }
  return parts[parts.length - 1];
}

function classifyRole(pos: string): 'GK' | 'DEF' | 'MID' | 'FWD' {
  const u = (pos || '').toUpperCase();
  if (u === 'G' || u.includes('GK') || u.includes('GOALKEEPER')) return 'GK';
  if (
    u === 'D' ||
    u.includes('DEF') ||
    u.includes('CB') ||
    u.includes('LB') ||
    u.includes('RB') ||
    u.includes('WB') ||
    u.includes('BACK')
  ) {
    return 'DEF';
  }
  if (
    u === 'F' ||
    u.includes('FW') ||
    u.includes('ST') ||
    u.includes('CF') ||
    u.includes('LW') ||
    u.includes('RW') ||
    u.includes('ATT')
  ) {
    return 'FWD';
  }
  return 'MID';
}

function parseFormationRows(formation: string, starters: LineupPlayer[]): LineupPlayer[][] {
  if (!starters.length) return [];

  // Sort starters by formationPlace when provided, else by role order GK -> DEF -> MID -> FWD
  const roleWeight: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
  const sorted = [...starters].sort((a, b) => {
    const aPlace = Number(a.formationPlace || 0);
    const bPlace = Number(b.formationPlace || 0);
    if (aPlace > 0 && bPlace > 0) return aPlace - bPlace;
    return roleWeight[classifyRole(a.position)] - roleWeight[classifyRole(b.position)];
  });

  // Pull GK first
  let gkIdx = sorted.findIndex((p) => classifyRole(p.position) === 'GK');
  if (gkIdx === -1) gkIdx = 0;
  const gk = sorted[gkIdx];
  const outfield = sorted.filter((_, i) => i !== gkIdx);

  // Extract digits like "4-2-3-1" -> [4, 2, 3, 1]
  const parsedNums = (formation || '')
    .split(/[^0-9]+/)
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n) && n > 0 && n <= 6);

  const sumParsed = parsedNums.reduce((acc, n) => acc + n, 0);

  if (parsedNums.length >= 2 && sumParsed === outfield.length) {
    const rows: LineupPlayer[][] = [[gk]];
    let cursor = 0;
    for (const count of parsedNums) {
      rows.push(outfield.slice(cursor, cursor + count));
      cursor += count;
    }
    return rows;
  }

  // Fallback by positional lines
  const defs = outfield.filter((p) => classifyRole(p.position) === 'DEF');
  const mids = outfield.filter((p) => classifyRole(p.position) === 'MID');
  const fwds = outfield.filter((p) => classifyRole(p.position) === 'FWD');

  const rows: LineupPlayer[][] = [[gk]];
  if (defs.length > 0) rows.push(defs);
  if (mids.length > 4) {
    rows.push(mids.slice(0, Math.ceil(mids.length / 2)));
    rows.push(mids.slice(Math.ceil(mids.length / 2)));
  } else if (mids.length > 0) {
    rows.push(mids);
  }
  if (fwds.length > 0) rows.push(fwds);

  // If everything landed on GK + 1 row, chunk cleanly
  if (rows.length <= 2 && outfield.length >= 9) {
    return [
      [gk],
      outfield.slice(0, 4),
      outfield.slice(4, 7),
      outfield.slice(7),
    ];
  }

  return rows;
}

function buildPitchPositions(team: TeamLineup): PositionedPlayer[] {
  const rows = parseFormationRows(team.formation, team.starters);
  if (!rows.length) return [];

  const result: PositionedPlayer[] = [];
  const totalRows = rows.length;

  rows.forEach((rowPlayers, rowIdx) => {
    // rowIdx 0 is GK at bottom (87%), last row is Attackers at top (14%)
    const yPct = totalRows === 1 ? 50 : 87 - (rowIdx / (totalRows - 1)) * 73;
    const count = rowPlayers.length;

    rowPlayers.forEach((player, colIdx) => {
      let xPct = 50;
      if (count > 1) {
        const margin = count >= 5 ? 10 : count === 4 ? 14 : count === 3 ? 20 : 30;
        const span = 100 - margin * 2;
        xPct = margin + (colIdx / (count - 1)) * span;
      }
      result.push({ player, xPct, yPct });
    });
  });

  return result;
}

function PlayerPitchAvatar({
  player,
  isHome,
  onSelect,
}: {
  player: LineupPlayer;
  isHome: boolean;
  onSelect: (playerName: string) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(player.name)}
      title={`${player.name} (#${player.jersey || '-'}) · ${player.position}`}
      className="group flex flex-col items-center -translate-x-1/2 -translate-y-1/2 focus:outline-none"
    >
      <div className="relative">
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110 ${
            isHome
              ? 'bg-[#0F1219] border-2 border-[#E11D48] shadow-rose-950/50'
              : 'bg-white border-2 border-slate-900 shadow-black/40'
          }`}
        >
          {player.photo && !imgFailed ? (
            <img
              src={player.photo}
              alt={player.name}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <span
              className={`font-mono-tabular text-xs sm:text-sm font-black ${
                isHome ? 'text-white' : 'text-slate-900'
              }`}
            >
              {player.jersey || getShortDisplayName(player.name).slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {/* Jersey number badge */}
        <span
          className={`absolute -bottom-1 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-md font-mono-tabular text-[10px] font-black flex items-center justify-center border shadow ${
            isHome
              ? 'bg-[#E11D48] text-white border-[#07090F]'
              : 'bg-[#07090F] text-white border-white/80'
          }`}
        >
          {player.jersey || '-'}
        </span>
      </div>

      {/* Player surname pill */}
      <div className="mt-1 px-1.5 py-0.5 rounded-md bg-[#07090F]/92 border border-white/15 shadow-md max-w-[82px] sm:max-w-[96px] text-center">
        <p className="text-[10px] sm:text-[11px] font-bold text-white truncate leading-tight">
          {getShortDisplayName(player.name)}
        </p>
        {player.position && (
          <p className="text-[8px] font-mono-tabular font-semibold text-rose-300 uppercase leading-none mt-0.5">
            {player.position}
          </p>
        )}
      </div>
    </button>
  );
}

function SubAvatar({
  player,
  onSelect,
}: {
  player: LineupPlayer;
  onSelect: (playerName: string) => void;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(player.name)}
      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 hover:border-[#E11D48] transition text-left"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#141923] border border-slate-300 dark:border-white/15 overflow-hidden flex items-center justify-center shrink-0">
          {player.photo && !failed ? (
            <img
              src={player.photo}
              alt={player.name}
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <span className="font-mono-tabular text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {player.jersey || '-'}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{player.name}</p>
          <p className="text-[10px] font-mono-tabular text-slate-500 dark:text-slate-400">
            #{player.jersey || '-'} · {player.position || 'SUB'}
          </p>
        </div>
      </div>
    </button>
  );
}

function TeamCrestMini({ logo, name }: { logo?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return (
      <img
        src={logo}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-6 h-6 object-contain shrink-0"
      />
    );
  }
  return (
    <span className="w-6 h-6 rounded-md bg-[#E11D48]/15 border border-[#E11D48]/30 flex items-center justify-center text-[10px] font-black text-[#E11D48] shrink-0">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function BroadcastLineupPitch({
  lineups,
  homeLogo,
  awayLogo,
}: {
  lineups: TeamLineup[];
  homeLogo?: string;
  awayLogo?: string;
}) {
  const { setSelectedPlayerKey, setSelectedMatchForDetail, setActiveTab } = useApp();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'pitch' | 'list'>('pitch');

  const safeIdx = Math.min(selectedIdx, Math.max(0, lineups.length - 1));
  const activeTeam = lineups[safeIdx];

  const positioned = useMemo(
    () => (activeTeam ? buildPitchPositions(activeTeam) : []),
    [activeTeam]
  );

  if (!lineups || lineups.length === 0) {
    return (
      <div className="py-10 px-4 rounded-2xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-center space-y-2">
        <Users className="w-7 h-7 mx-auto text-slate-400" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Confirmed Starting XI Not Yet Published
        </p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Tactical pitch formations and player headshots appear automatically once official matchday squads are released by the league feed.
        </p>
      </div>
    );
  }

  const handleOpenPlayer = (name: string) => {
    setSelectedPlayerKey(name);
    setSelectedMatchForDetail(null);
    setActiveTab('players');
  };

  const activeLogo = activeTeam.teamLogo || (safeIdx === 0 ? homeLogo : awayLogo);

  return (
    <div className="space-y-4">
      {/* Team Switcher & Pitch/List Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {lineups.map((team, idx) => {
            const logo = team.teamLogo || (idx === 0 ? homeLogo : awayLogo);
            const isSelected = idx === safeIdx;
            return (
              <button
                key={team.teamId || team.teamName}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition ${
                  isSelected
                    ? 'bg-[#E11D48] text-white border-[#E11D48] shadow-md shadow-rose-950/30'
                    : 'bg-slate-50 dark:bg-[#07090F] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-[#E11D48]'
                }`}
              >
                <TeamCrestMini logo={logo} name={team.teamName} />
                <span>{team.teamName}</span>
                <span
                  className={`font-mono-tabular px-1.5 py-0.5 rounded text-[10px] ${
                    isSelected ? 'bg-black/25 text-white' : 'bg-slate-200 dark:bg-white/10'
                  }`}
                >
                  {team.formation || 'XI'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#07090F] border border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => setViewMode('pitch')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'pitch'
                ? 'bg-[#E11D48] text-white'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Pitch
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'list'
                ? 'bg-[#E11D48] text-white'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
        </div>
      </div>

      {/* Active Team Pitch View */}
      {viewMode === 'pitch' ? (
        <div className="space-y-4">
          <div className="relative w-full rounded-2xl overflow-hidden border border-white/15 bg-[#092e1a] shadow-2xl">
            {/* Broadcast Top Strip */}
            <div className="relative z-10 px-4 py-2.5 bg-[#07090F]/90 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <TeamCrestMini logo={activeLogo} name={activeTeam.teamName} />
                <span className="font-display text-base font-extrabold text-white truncate">
                  {activeTeam.teamName}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Formation
                </span>
                <span className="font-mono-tabular px-2.5 py-0.5 rounded-lg bg-[#E11D48] text-white text-xs font-black">
                  {activeTeam.formation || 'Confirmed XI'}
                </span>
              </div>
            </div>

            {/* 2D Football Pitch Canvas */}
            <div className="relative w-full aspect-[4/4.7] sm:aspect-[16/15] max-h-[540px] select-none overflow-hidden">
              {/* SVG Tactical Pitch Turf & Markings */}
              <svg
                viewBox="0 0 400 440"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full"
              >
                <defs>
                  <linearGradient id="strTurf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0e4a2b" />
                    <stop offset="50%" stopColor="#0a3b22" />
                    <stop offset="100%" stopColor="#0e4a2b" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="400" height="440" fill="url(#strTurf)" />

                {/* Alternating mowed turf stripes */}
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <rect
                    key={i}
                    x="0"
                    y={i * 55}
                    width="400"
                    height="27.5"
                    fill="rgba(255,255,255,0.03)"
                  />
                ))}

                {/* Outer touchline */}
                <rect
                  x="16"
                  y="14"
                  width="368"
                  height="412"
                  fill="none"
                  stroke="rgba(255,255,255,0.42)"
                  strokeWidth="2"
                />

                {/* Halfway line + top attacking center circle arc */}
                <line
                  x1="16"
                  y1="38"
                  x2="384"
                  y2="38"
                  stroke="rgba(255,255,255,0.32)"
                  strokeWidth="1.5"
                />
                <circle
                  cx="200"
                  cy="38"
                  r="42"
                  fill="none"
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="1.5"
                />
                <circle cx="200" cy="38" r="3" fill="rgba(255,255,255,0.45)" />

                {/* Bottom Goalkeeper Penalty Box */}
                <rect
                  x="96"
                  y="334"
                  width="208"
                  height="92"
                  fill="none"
                  stroke="rgba(255,255,255,0.42)"
                  strokeWidth="2"
                />
                {/* 6-yard box */}
                <rect
                  x="146"
                  y="386"
                  width="108"
                  height="40"
                  fill="none"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="1.8"
                />
                {/* Penalty spot */}
                <circle cx="200" cy="364" r="3" fill="rgba(255,255,255,0.5)" />
                {/* Penalty arc */}
                <path
                  d="M 155 334 A 48 48 0 0 1 245 334"
                  fill="none"
                  stroke="rgba(255,255,255,0.36)"
                  strokeWidth="1.6"
                />
                {/* Corner arcs */}
                <path d="M 16 414 A 12 12 0 0 1 28 426" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
                <path d="M 372 426 A 12 12 0 0 1 384 414" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
              </svg>

              {/* Players Plotted in Formation */}
              {positioned.map(({ player, xPct, yPct }) => (
                <div
                  key={player.id || `${player.name}-${player.jersey}`}
                  className="absolute z-10"
                  style={{ left: `${xPct}%`, top: `${yPct}%` }}
                >
                  <PlayerPitchAvatar
                    player={player}
                    isHome={safeIdx === 0}
                    onSelect={handleOpenPlayer}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Substitutes Bench */}
          {activeTeam.subs.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-[#E11D48]" />
                  Substitutes Bench ({activeTeam.subs.length})
                </p>
                <span className="text-[11px] text-slate-400">Tap any player for full profile</span>
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                {activeTeam.subs.map((p) => (
                  <SubAvatar key={p.id || p.name} player={p} onSelect={handleOpenPlayer} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Clean Broadcast List View */
        <div className="grid sm:grid-cols-2 gap-4">
          {lineups.map((team, idx) => (
            <div
              key={team.teamId || team.teamName}
              className="rounded-2xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <TeamCrestMini
                    logo={team.teamLogo || (idx === 0 ? homeLogo : awayLogo)}
                    name={team.teamName}
                  />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {team.teamName}
                  </h4>
                </div>
                <span className="font-mono-tabular text-xs font-bold px-2 py-0.5 rounded bg-[#E11D48]/15 text-[#E11D48]">
                  {team.formation}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Starting XI
                </p>
                {team.starters.map((p) => (
                  <button
                    key={p.id || p.name}
                    type="button"
                    onClick={() => handleOpenPlayer(p.name)}
                    className="w-full flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono-tabular w-6 text-[#E11D48] font-bold text-left">
                        #{p.jersey || '-'}
                      </span>
                      <span className="text-slate-900 dark:text-white font-semibold truncate">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-slate-500 font-mono-tabular text-[11px]">{p.position}</span>
                  </button>
                ))}
              </div>

              {team.subs.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-white/10">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Shirt className="w-3 h-3 text-[#E11D48]" /> Substitutes
                  </p>
                  {team.subs.map((p) => (
                    <button
                      key={p.id || p.name}
                      type="button"
                      onClick={() => handleOpenPlayer(p.name)}
                      className="w-full flex items-center justify-between text-xs text-slate-500 py-1 px-2 rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/5 transition"
                    >
                      <span className="truncate text-left">
                        #{p.jersey || '-'} {p.name}
                      </span>
                      <span className="font-mono-tabular text-[11px]">{p.position}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
