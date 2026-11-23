import React, { useEffect, useMemo, useRef } from 'react';
import { FORMATION_SLOTS } from '../../data/simulatorTeams';
import type {
  LivePlayerState,
  MatchPhase,
  SimEvent,
  SimFormation,
  SimMatchState,
  SimPlayer,
  SimTeam,
  TacticalMentality,
} from '../../types/simulator';

interface PitchNodeItem {
  key: string;
  slotIndex: number;
  baseX: number;
  baseY: number;
  side: 'home' | 'away';
  player: SimPlayer;
  live?: LivePlayerState;
  slotLabel: string;
  primaryColor: string;
  secondaryColor: string;
}

interface AnimatedCoord {
  x: number;
  y: number;
}

function contrastText(hex: string): string {
  const c = (hex || '#111111').toUpperCase();
  if (['#FFFFFF', '#FDE100', '#F9D616', '#FFDF00', '#FACC15', '#75AADB', '#6CABDD'].includes(c)) {
    return '#090D16';
  }
  return '#FFFFFF';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function mentalityShift(mentality?: TacticalMentality): number {
  if (mentality === 'Defensive') return -5.5;
  if (mentality === 'Attacking') return 6.0;
  return 0;
}

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 360) * 0.01745;
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
  playing = false,
  phase,
  latestEvent,
  mentalityHome,
  mentalityAway,
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
  playing?: boolean;
  phase?: MatchPhase;
  latestEvent?: SimEvent;
  mentalityHome?: TacticalMentality;
  mentalityAway?: TacticalMentality;
}) {
  const slotsHome = FORMATION_SLOTS[formationHome];
  const slotsAway = FORMATION_SLOTS[formationAway];

  const nodes = useMemo<PitchNodeItem[]>(() => {
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

      return slots
        .map((slot, idx) => {
          const entry = activeItems[idx];
          if (!entry) return null;
          const pl = isLiveArr ? (entry as LivePlayerState).player : (entry as SimPlayer);
          const live = isLiveArr ? (entry as LivePlayerState) : undefined;
          return {
            key: `${side}-${pl.id}`,
            slotIndex: idx,
            baseX: side === 'home' ? slot.x : 100 - slot.x,
            baseY: side === 'home' ? slot.y : 100 - slot.y,
            side,
            player: pl,
            live,
            slotLabel: slot.label,
            primaryColor: team.primaryColor,
            secondaryColor: team.secondaryColor,
          };
        })
        .filter(Boolean) as PitchNodeItem[];
    };

    return [
      ...extractList(homePlayers, 'home', homeTeam, slotsHome),
      ...extractList(awayPlayers, 'away', awayTeam, slotsAway),
    ];
  }, [homePlayers, awayPlayers, homeTeam, awayTeam, slotsHome, slotsAway]);

  const nodeElementsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const coordsRef = useRef<Map<string, AnimatedCoord>>(new Map());
  const ballElRef = useRef<HTMLDivElement | null>(null);
  const trailLineRef = useRef<SVGLineElement | null>(null);
  const pulseRingRef = useRef<SVGCircleElement | null>(null);
  const ballCurrentRef = useRef<AnimatedCoord>({ x: ballPos.x, y: ballPos.y });
  const ballPrevRef = useRef<AnimatedCoord>({ x: ballPos.x, y: ballPos.y });

  const simSnapshotRef = useRef({
    mode,
    nodes,
    ballPos,
    highlightedPlayerId,
    playing,
    phase,
    latestEvent,
    mentalityHome,
    mentalityAway,
    activeFlash,
  });
  simSnapshotRef.current = {
    mode,
    nodes,
    ballPos,
    highlightedPlayerId,
    playing,
    phase,
    latestEvent,
    mentalityHome,
    mentalityAway,
    activeFlash,
  };

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let lastTs = performance.now();

    const stepFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTs) / 1000));
      lastTs = now;
      const t = now / 1000;
      const snap = simSnapshotRef.current;

      // Determine active target ball coordinates with lively micro-dribble when running
      const isPauseBreak =
        snap.phase === 'HALFTIME' ||
        snap.phase === 'EXTRA_TIME_HT' ||
        snap.phase === 'FULLTIME';
      const activeMotion = snap.mode === 'live' && !prefersReducedMotion && !isPauseBreak;

      const evType = snap.latestEvent?.type;
      const evSide = snap.latestEvent?.side;
      const isGoalEvent =
        evType === 'goal' ||
        evType === 'penalty_goal' ||
        evType === 'var_goal' ||
        Boolean(snap.activeFlash?.headline?.includes('GOAL'));
      const isSaveEvent = evType === 'save' || evType === 'penalty_miss';
      const isShootout = snap.phase === 'PENALTY_SHOOTOUT' || evType === 'shootout';

      const dribbleX = activeMotion && snap.playing ? Math.sin(t * 2.7) * 1.15 : 0;
      const dribbleY = activeMotion && snap.playing ? Math.cos(t * 3.3) * 1.15 : 0;
      const targetBallX = clamp(snap.ballPos.x + dribbleX, 3.5, 96.5);
      const targetBallY = clamp(snap.ballPos.y + dribbleY, 5, 95);

      const curBall = ballCurrentRef.current;
      const prevBall = ballPrevRef.current;
      const ballAlpha = prefersReducedMotion ? 1 : 1 - Math.exp(-(snap.playing ? 8.5 : 5.5) * dt);
      prevBall.x = curBall.x + (prevBall.x - curBall.x) * Math.exp(-5 * dt);
      prevBall.y = curBall.y + (prevBall.y - curBall.y) * Math.exp(-5 * dt);
      curBall.x += (targetBallX - curBall.x) * ballAlpha;
      curBall.y += (targetBallY - curBall.y) * ballAlpha;

      if (ballElRef.current) {
        ballElRef.current.style.left = `${curBall.x.toFixed(3)}%`;
        ballElRef.current.style.top = `${curBall.y.toFixed(3)}%`;
      }

      if (trailLineRef.current) {
        const dx = curBall.x - prevBall.x;
        const dy = curBall.y - prevBall.y;
        const speedMag = Math.hypot(dx, dy);
        trailLineRef.current.setAttribute('x1', (prevBall.x * 10).toFixed(1));
        trailLineRef.current.setAttribute('y1', (prevBall.y * 6.2).toFixed(1));
        trailLineRef.current.setAttribute('x2', (curBall.x * 10).toFixed(1));
        trailLineRef.current.setAttribute('y2', (curBall.y * 6.2).toFixed(1));
        trailLineRef.current.setAttribute(
          'stroke-opacity',
          snap.mode === 'live' && speedMag > 0.35 ? clamp(speedMag * 0.16, 0.15, 0.72).toFixed(2) : '0'
        );
      }

      if (pulseRingRef.current) {
        if (snap.mode === 'live' && (isGoalEvent || isSaveEvent || evType === 'var_disallowed')) {
          const ringR = 14 + ((t * 48) % 36);
          const ringAlpha = clamp(1 - ((t * 48) % 36) / 36, 0, 0.85);
          pulseRingRef.current.setAttribute('cx', (curBall.x * 10).toFixed(1));
          pulseRingRef.current.setAttribute('cy', (curBall.y * 6.2).toFixed(1));
          pulseRingRef.current.setAttribute('r', ringR.toFixed(1));
          pulseRingRef.current.setAttribute('stroke-opacity', ringAlpha.toFixed(2));
          pulseRingRef.current.setAttribute(
            'stroke',
            isGoalEvent ? '#FACC15' : isSaveEvent ? '#10B981' : '#E11D48'
          );
        } else {
          pulseRingRef.current.setAttribute('stroke-opacity', '0');
        }
      }

      // Find nearest home and away outfielders to the ball for pressing / ball-carrier runs
      let nearestHomeKey = '';
      let nearestAwayKey = '';
      let minHomeDist = Infinity;
      let minAwayDist = Infinity;

      for (const node of snap.nodes) {
        if (node.player.roleGroup === 'GK') continue;
        const dist = Math.hypot(node.baseX - targetBallX, node.baseY - targetBallY);
        if (node.side === 'home' && dist < minHomeDist) {
          minHomeDist = dist;
          nearestHomeKey = node.key;
        } else if (node.side === 'away' && dist < minAwayDist) {
          minAwayDist = dist;
          nearestAwayKey = node.key;
        }
      }

      const highlightNode = snap.highlightedPlayerId
        ? snap.nodes.find((n) => n.player.id === snap.highlightedPlayerId)
        : undefined;

      // Ball zone influence: +1 => deep right (Home attacking), -1 => deep left (Away attacking)
      const zoneShift = (targetBallX - 50) / 50;
      const yShift = targetBallY - 50;
      const homeMentShift = mentalityShift(snap.mentalityHome);
      const awayMentShift = mentalityShift(snap.mentalityAway);

      const celebCornerX = evSide === 'home' ? 91 : 9;
      const celebCornerY = snap.ballPos.y < 50 ? 15 : 85;

      for (const node of snap.nodes) {
        let targetX = node.baseX;
        let targetY = node.baseY;

        if (snap.mode === 'live') {
          const seed = hashSeed(node.key);
          const staminaFactor = clamp((node.live?.stamina ?? 90) / 100, 0.35, 1);
          const runAmp = activeMotion && snap.playing ? 1.35 * staminaFactor : 0.25;

          if (isShootout) {
            if (node.player.roleGroup === 'GK') {
              const defendSide = targetBallX > 50 ? 'away' : 'home';
              if (node.side === defendSide) {
                targetX = defendSide === 'away' ? 95.5 : 4.5;
                targetY = 50 + (activeMotion ? Math.sin(t * 7.2) * 3.4 : 0);
              } else {
                targetX = node.side === 'home' ? 46 : 54;
                targetY = 42 + (node.slotIndex % 3) * 8;
              }
            } else if (
              (targetBallX > 50 && node.key === nearestHomeKey) ||
              (targetBallX <= 50 && node.key === nearestAwayKey)
            ) {
              // Taker approaching penalty spot
              targetX = targetBallX > 50 ? 85 : 15;
              targetY = 50 + (activeMotion ? Math.sin(t * 4) * 1.1 : 0);
            } else {
              // Teammates lined on halfway circle
              targetX = 48 + (node.side === 'home' ? -2.5 : 2.5) + Math.cos(seed) * 1.6;
              targetY = 22 + (node.slotIndex / 10) * 56;
            }
          } else if (isGoalEvent && highlightNode && (evSide === 'home' || evSide === 'away')) {
            if (node.player.id === highlightNode.player.id) {
              targetX = celebCornerX + (activeMotion ? Math.sin(t * 5.2) * 1.2 : 0);
              targetY = celebCornerY + (activeMotion ? Math.cos(t * 5.2) * 1.2 : 0);
            } else if (node.side === evSide && node.player.roleGroup !== 'GK') {
              // Attacking teammates converge toward scorer for goal celebration
              const angle = seed * 2;
              const ringRadius = node.slotIndex % 2 === 0 ? 5.5 : 11;
              targetX = clamp(
                node.baseX * 0.35 + (celebCornerX + Math.cos(angle) * ringRadius) * 0.65,
                6,
                94
              );
              targetY = clamp(
                node.baseY * 0.35 + (celebCornerY + Math.sin(angle) * ringRadius) * 0.65,
                7,
                93
              );
            } else if (node.player.roleGroup === 'GK') {
              targetX = node.side === 'home' ? 5.5 : 94.5;
              targetY = 50;
            } else {
              // Conceding side drops back toward center spot
              targetX = node.baseX * 0.72 + 50 * 0.28;
              targetY = node.baseY * 0.78 + 50 * 0.22;
            }
          } else if (node.player.roleGroup === 'GK') {
            // Sweeper keeper horizontal edge + lateral goal coverage tracking ball Y
            const isHome = node.side === 'home';
            const sweeperPush = isHome
              ? clamp(zoneShift * 3.5, 0, 4.5)
              : clamp(-zoneShift * 3.5, 0, 4.5);
            const saveDive =
              isSaveEvent &&
              ((isHome && targetBallX < 25) || (!isHome && targetBallX > 75))
                ? clamp((targetBallY - 50) * 0.55, -8, 8)
                : 0;
            targetX = isHome ? 5.2 + sweeperPush : 94.8 - sweeperPush;
            targetY = clamp(50 + yShift * 0.22 + saveDive + Math.sin(t * 2 + seed) * 0.6, 40, 60);
          } else {
            // Tactical block displacement by role and team ball possession
            const isHome = node.side === 'home';
            const dir = isHome ? 1 : -1;
            const roleWeight =
              node.player.roleGroup === 'FWD'
                ? 18
                : node.player.roleGroup === 'MID'
                ? 15
                : 11;

            const ballPullX = zoneShift * roleWeight;
            const mentBias = (isHome ? homeMentShift : awayMentShift) * dir;
            const corridorPullY = yShift * (node.player.roleGroup === 'MID' ? 0.34 : 0.24);

            targetX = node.baseX + ballPullX + mentBias;
            targetY = node.baseY + corridorPullY;

            // Ball carrier & closest defender pressing duel
            const homeOwnsBall = targetBallX >= 50 || evSide === 'home';
            if (node.key === nearestHomeKey) {
              const engageRatio = homeOwnsBall ? 0.76 : 0.52;
              const offset = homeOwnsBall ? -1.8 : -4.2;
              targetX = targetX * (1 - engageRatio) + (targetBallX + offset) * engageRatio;
              targetY = targetY * (1 - engageRatio) + targetBallY * engageRatio;
            } else if (node.key === nearestAwayKey) {
              const engageRatio = !homeOwnsBall ? 0.76 : 0.52;
              const offset = !homeOwnsBall ? 1.8 : 4.2;
              targetX = targetX * (1 - engageRatio) + (targetBallX + offset) * engageRatio;
              targetY = targetY * (1 - engageRatio) + targetBallY * engageRatio;
            }

            // Organic dynamic off-ball movement runs
            if (activeMotion) {
              targetX += Math.sin(t * 1.9 + seed) * runAmp + Math.cos(t * 3.1 + seed * 2) * (runAmp * 0.45);
              targetY += Math.cos(t * 2.2 + seed * 1.5) * runAmp;
            }

            targetX = clamp(targetX, 6.5, 93.5);
            targetY = clamp(targetY, 7, 93);
          }
        }

        const prev = coordsRef.current.get(node.key) || { x: targetX, y: targetY };
        const lerpRate =
          prefersReducedMotion || snap.mode === 'prematch'
            ? 14
            : isGoalEvent
            ? 6.2
            : snap.playing
            ? 5.2
            : 4.0;
        const alpha = 1 - Math.exp(-lerpRate * dt);
        const nextX = prev.x + (targetX - prev.x) * alpha;
        const nextY = prev.y + (targetY - prev.y) * alpha;

        coordsRef.current.set(node.key, { x: nextX, y: nextY });

        const el = nodeElementsRef.current.get(node.key);
        if (el) {
          el.style.left = `${nextX.toFixed(3)}%`;
          el.style.top = `${nextY.toFixed(3)}%`;
        }
      }

      rafId = requestAnimationFrame(stepFrame);
    };

    rafId = requestAnimationFrame(stepFrame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="sim-pitch relative w-full overflow-hidden rounded-2xl border border-emerald-500/25 bg-[#082419] shadow-2xl select-none">
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

        {/* Crisp Pitch Markings + Dynamic Pass/Event FX Layer */}
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

          {/* Live Ball Pass/Shot Vector Trail */}
          <line
            ref={trailLineRef}
            x1="500"
            y1="310"
            x2="500"
            y2="310"
            stroke="rgba(255, 255, 255, 0.85)"
            strokeWidth="3.2"
            strokeDasharray="6 4"
            strokeLinecap="round"
            strokeOpacity="0"
          />

          {/* Event Impact Shockwave Ring */}
          <circle
            ref={pulseRingRef}
            cx="500"
            cy="310"
            r="22"
            fill="none"
            stroke="#FACC15"
            strokeWidth="3"
            strokeOpacity="0"
          />
        </svg>

        {/* Subtle Home / Away Direction Labels */}
        <div className="absolute top-2.5 left-4 z-10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/40 px-2.5 py-1 rounded-md backdrop-blur-xs">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: homeTeam.primaryColor }}
          />
          {homeTeam.abbr} · {formationHome}
        </div>
        <div className="absolute top-2.5 right-4 z-10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/40 px-2.5 py-1 rounded-md backdrop-blur-xs">
          {awayTeam.abbr} · {formationAway}
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: awayTeam.primaryColor }}
          />
        </div>

        {/* 22 Players on Pitch (Frame-by-Frame rAF Animated) */}
        {nodes.map((node) => {
          const isHighlighted = highlightedPlayerId === node.player.id;
          const isSelectedSwap = selectedSwapKey === `${node.side}:${node.player.id}`;
          const textCol = contrastText(node.primaryColor);
          const rating = node.live?.rating;
          const stamina = node.live?.stamina ?? 100;
          const initCoord = coordsRef.current.get(node.key) || { x: node.baseX, y: node.baseY };

          return (
            <button
              key={node.key}
              ref={(el) => {
                if (el) nodeElementsRef.current.set(node.key, el);
                else nodeElementsRef.current.delete(node.key);
              }}
              type="button"
              onClick={() => onSelectPlayer?.(node.side, node.player.id, node.slotIndex)}
              style={{
                left: `${initCoord.x}%`,
                top: `${initCoord.y}%`,
                willChange: 'left, top',
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group ${
                onSelectPlayer ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'
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
            ref={ballElRef}
            style={{
              left: `${ballCurrentRef.current.x}%`,
              top: `${ballCurrentRef.current.y}%`,
              willChange: 'left, top',
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
          >
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white border-2 border-slate-900 shadow-[0_0_14px_rgba(255,255,255,0.95)] flex items-center justify-center">
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
