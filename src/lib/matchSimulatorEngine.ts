import type {
  LivePlayerState,
  MatchPhase,
  ShootoutKick,
  SimEvent,
  SimFormation,
  SimGameMode,
  SimMatchReport,
  SimMatchState,
  SimPlayer,
  SimTeam,
  TacticalMentality,
  TacticalStyle,
} from '../types/simulator';

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickWeighted<T>(items: T[], weightFn: (item: T) => number): T | null {
  if (items.length === 0) return null;
  let total = 0;
  const weights = items.map((item) => {
    const w = Math.max(0.05, weightFn(item));
    total += w;
    return w;
  });
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function cloneRoster(players: SimPlayer[], side: 'home' | 'away', onPitch: boolean): LivePlayerState[] {
  return players.map((pl) => ({
    player: pl,
    side,
    onPitch,
    stamina: 100,
    rating: 6.4,
    goals: 0,
    assists: 0,
    saves: 0,
    shots: 0,
    tackles: 0,
    yellowCards: 0,
    redCard: false,
    injured: false,
  }));
}

export interface InitMatchConfig {
  mode: SimGameMode;
  competitionLabel: string;
  knockoutRules: boolean;
  homeTeam: SimTeam;
  awayTeam: SimTeam;
  formationHome: SimFormation;
  formationAway: SimFormation;
  styleHome: TacticalStyle;
  styleAway: TacticalStyle;
  homeStarters: SimPlayer[];
  homeBench: SimPlayer[];
  awayStarters: SimPlayer[];
  awayBench: SimPlayer[];
}

export function createInitialMatchState(cfg: InitMatchConfig): SimMatchState {
  return {
    matchId: uid('sim'),
    mode: cfg.mode,
    competitionLabel: cfg.competitionLabel,
    knockoutRules: cfg.knockoutRules,
    phase: 'FIRST_HALF',
    minute: 0,
    addedTime: 0,
    stoppageTarget1: Math.floor(randRange(1, 4)),
    stoppageTarget2: Math.floor(randRange(2, 6)),
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
      redAway: 0,
    },
    events: [
      {
        id: uid('ev'),
        minute: 0,
        minuteLabel: "0'",
        type: 'kickoff',
        side: 'neutral',
        text: `Kick-off! ${cfg.homeTeam.name} (${cfg.formationHome}, ${cfg.styleHome}) vs ${cfg.awayTeam.name} (${cfg.formationAway}, ${cfg.styleAway}) in ${cfg.competitionLabel}.`,
        isKey: true,
      },
    ],
    homeRoster: [
      ...cloneRoster(cfg.homeStarters.slice(0, 11), 'home', true),
      ...cloneRoster(cfg.homeBench, 'home', false),
    ],
    awayRoster: [
      ...cloneRoster(cfg.awayStarters.slice(0, 11), 'away', true),
      ...cloneRoster(cfg.awayBench, 'away', false),
    ],
    ballPos: { x: 50, y: 50 },
    momentumHome: 0,
    activeFlash: null,
    highlightedPlayerId: null,
  };
}

function computeSideStrength(
  roster: LivePlayerState[],
  formation: SimFormation,
  style: TacticalStyle,
  mentality: TacticalMentality,
  isHome: boolean
) {
  const onPitch = roster.filter((r) => r.onPitch && !r.redCard);
  const redCards = roster.filter((r) => r.redCard).length;
  const numericFactor = Math.max(0.68, 1 - redCards * 0.13);

  const avgStamina =
    onPitch.length > 0
      ? onPitch.reduce((s, p) => s + p.stamina, 0) / onPitch.length
      : 75;
  const staminaFactor = 0.84 + (avgStamina / 100) * 0.16;

  const byGroup = (g: 'GK' | 'DEF' | 'MID' | 'FWD') =>
    onPitch.filter((p) => p.player.roleGroup === g);

  const avgStat = (arr: LivePlayerState[], fallback: number) =>
    arr.length > 0
      ? arr.reduce((s, p) => s + p.player.overall, 0) / arr.length
      : fallback;

  let att = avgStat(byGroup('FWD'), 80);
  let mid = avgStat(byGroup('MID'), 80);
  let def = avgStat(byGroup('DEF'), 79);
  const gkList = byGroup('GK');
  const gk = gkList.length > 0 ? gkList[0].player.overall : 72;

  // Formation modifiers
  if (formation === '4-3-3') {
    att += 2;
    mid += 0.5;
  } else if (formation === '4-2-3-1') {
    mid += 2;
    def += 1.5;
  } else if (formation === '3-5-2') {
    mid += 3;
    att += 1;
    def -= 1;
  } else if (formation === '4-4-2') {
    att += 1.5;
    def += 1.5;
  }

  // Playing style modifiers
  if (style === 'High Press') {
    mid += 2.2;
    att += 1.5;
    def -= 0.8;
  } else if (style === 'Tiki-Taka') {
    mid += 3.5;
  } else if (style === 'Counter-Attack') {
    att += 2.2;
    def += 2;
    mid -= 1.5;
  } else if (style === 'Wing Play') {
    att += 2;
  }

  // Live mentality modifiers
  if (mentality === 'Attacking') {
    att += 4.5;
    def -= 4;
  } else if (mentality === 'Defensive') {
    def += 4.5;
    att -= 4;
  }

  const homeBonus = isHome ? 1.8 : 0;

  return {
    att: (att + homeBonus) * numericFactor * staminaFactor,
    mid: (mid + homeBonus) * numericFactor * staminaFactor,
    def: (def + homeBonus) * numericFactor * staminaFactor,
    gk: gk * staminaFactor,
    onPitch,
    avgStamina,
  };
}

function tryAutoSubstitution(
  roster: LivePlayerState[],
  subsUsed: number,
  minute: number,
  side: 'home' | 'away',
  teamName: string,
  forcedOutId?: string
): { roster: LivePlayerState[]; subsUsed: number; event: SimEvent | null } {
  if (subsUsed >= 5) return { roster, subsUsed, event: null };
  const onPitch = roster.filter((r) => r.onPitch && !r.redCard && r.player.roleGroup !== 'GK');
  const bench = roster.filter((r) => !r.onPitch && !r.redCard && !r.injured && !r.subbedOutAt);
  if (onPitch.length === 0 || bench.length === 0) {
    return { roster, subsUsed, event: null };
  }

  let candidateOut: LivePlayerState | undefined;
  if (forcedOutId) {
    candidateOut = onPitch.find((p) => p.player.id === forcedOutId);
  }
  if (!candidateOut) {
    // Pick lowest stamina or yellow-carded tired midfielder/forward
    const sorted = [...onPitch].sort((a, b) => {
      const aScore = a.stamina - a.yellowCards * 12;
      const bScore = b.stamina - b.yellowCards * 12;
      return aScore - bScore;
    });
    candidateOut = sorted[0];
  }
  if (!candidateOut) return { roster, subsUsed, event: null };

  const outGroup = candidateOut.player.roleGroup;
  const sameRoleBench = bench.filter((b) => b.player.roleGroup === outGroup);
  const nonGkBench = bench.filter((b) => b.player.roleGroup !== 'GK');
  const pool = sameRoleBench.length > 0 ? sameRoleBench : nonGkBench.length > 0 ? nonGkBench : bench;
  const candidateIn = [...pool].sort((a, b) => b.player.overall - a.player.overall)[0];
  if (!candidateIn) return { roster, subsUsed, event: null };

  const updated = roster.map((r) => {
    if (r.player.id === candidateOut!.player.id) {
      return { ...r, onPitch: false, subbedOutAt: minute };
    }
    if (r.player.id === candidateIn.player.id) {
      return { ...r, onPitch: true, subbedInAt: minute, stamina: 100 };
    }
    return r;
  });

  return {
    roster: updated,
    subsUsed: subsUsed + 1,
    event: {
      id: uid('ev'),
      minute,
      minuteLabel: `${minute}'`,
      type: 'sub',
      side,
      teamName,
      playerId: candidateIn.player.id,
      playerName: candidateIn.player.shortName,
      secondaryPlayerName: candidateOut.player.shortName,
      text: `Substitution (${teamName}): ${candidateIn.player.name} comes on for ${candidateOut.player.name}.`,
      isKey: false,
    },
  };
}

export function performManualSubstitution(
  state: SimMatchState,
  side: 'home' | 'away',
  outPlayerId: string,
  inPlayerId: string
): SimMatchState {
  const maxSubs = state.phase === 'EXTRA_TIME_1' || state.phase === 'EXTRA_TIME_2' ? 6 : 5;
  const subsUsed = side === 'home' ? state.subsUsedHome : state.subsUsedAway;
  if (subsUsed >= maxSubs) return state;

  const roster = side === 'home' ? state.homeRoster : state.awayRoster;
  const outP = roster.find((r) => r.player.id === outPlayerId && r.onPitch);
  const inP = roster.find((r) => r.player.id === inPlayerId && !r.onPitch && !r.subbedOutAt && !r.redCard);
  if (!outP || !inP) return state;

  const updated = roster.map((r) => {
    if (r.player.id === outPlayerId) {
      return { ...r, onPitch: false, subbedOutAt: state.minute };
    }
    if (r.player.id === inPlayerId) {
      return { ...r, onPitch: true, subbedInAt: state.minute, stamina: 100 };
    }
    return r;
  });

  const teamName = side === 'home' ? state.homeTeam.shortName : state.awayTeam.shortName;
  const minLabel =
    state.addedTime > 0 ? `${state.minute}+${state.addedTime}'` : `${state.minute}'`;

  const subEvent: SimEvent = {
    id: uid('ev'),
    minute: state.minute,
    addedTime: state.addedTime || undefined,
    minuteLabel: minLabel,
    type: 'sub',
    side,
    teamName,
    playerId: inP.player.id,
    playerName: inP.player.shortName,
    secondaryPlayerName: outP.player.shortName,
    text: `Manager Sub (${teamName}): ${inP.player.name} replaces ${outP.player.name}.`,
    isKey: true,
  };

  return {
    ...state,
    homeRoster: side === 'home' ? updated : state.homeRoster,
    awayRoster: side === 'away' ? updated : state.awayRoster,
    subsUsedHome: side === 'home' ? state.subsUsedHome + 1 : state.subsUsedHome,
    subsUsedAway: side === 'away' ? state.subsUsedAway + 1 : state.subsUsedAway,
    events: [subEvent, ...state.events],
    activeFlash: {
      side,
      type: 'sub',
      headline: `SUB · ${teamName}`,
      subline: `${inP.player.shortName} ON ↔ ${outP.player.shortName} OFF`,
    },
  };
}

const GOAL_FLAVORS = [
  'curls a sublime strike into the top corner!',
  'rifles a thunderous finish inside the far post!',
  'ghosts into the six-yard box to nod home a clinical header!',
  'races clear on goal and slots calmly past the keeper!',
  'unleashes a blistering half-volley that flies into the net!',
  'finishes off a razor-sharp passing move with ice-cold precision!',
];

function formatMinute(min: number, added: number): string {
  return added > 0 ? `${min}+${added}'` : `${min}'`;
}

function advancePenaltyShootoutStep(state: SimMatchState): SimMatchState {
  const kicks = [...state.shootoutKicks];
  const homeKicks = kicks.filter((k) => k.side === 'home');
  const awayKicks = kicks.filter((k) => k.side === 'away');

  // Check if shootout already decided cleanly
  const checkWinner = (): 'home' | 'away' | null => {
    const hDone = homeKicks.length;
    const aDone = awayKicks.length;
    const hScore = state.homePenScore;
    const aScore = state.awayPenScore;
    if (hDone <= 5 && aDone <= 5) {
      const hRem = 5 - hDone;
      const aRem = 5 - aDone;
      if (hScore > aScore + aRem) return 'home';
      if (aScore > hScore + hRem) return 'away';
    } else if (hDone === aDone && hScore !== aScore) {
      return hScore > aScore ? 'home' : 'away';
    }
    return null;
  };

  const preWinner = checkWinner();
  if (preWinner) {
    const winTeam = preWinner === 'home' ? state.homeTeam.name : state.awayTeam.name;
    const ftEvent: SimEvent = {
      id: uid('ev'),
      minute: 120,
      minuteLabel: 'PEN',
      type: 'fulltime',
      side: preWinner,
      teamName: winTeam,
      text: `FULL TIME (Penalties ${state.homePenScore}–${state.awayPenScore})! ${winTeam} win the shootout!`,
      isKey: true,
    };
    return {
      ...state,
      phase: 'FULLTIME',
      events: [ftEvent, ...state.events],
      activeFlash: {
        side: preWinner,
        type: 'fulltime',
        headline: `${winTeam} WIN ON PENALTIES`,
        subline: `${state.homePenScore} – ${state.awayPenScore} Shootout Triumph`,
      },
    };
  }

  const nextSide: 'home' | 'away' = homeKicks.length <= awayKicks.length ? 'home' : 'away';
  const round = nextSide === 'home' ? homeKicks.length + 1 : awayKicks.length + 1;

  const takersPool = (nextSide === 'home' ? state.homeRoster : state.awayRoster)
    .filter((r) => r.onPitch && !r.redCard && r.player.roleGroup !== 'GK')
    .sort((a, b) => b.player.stats.sho - a.player.stats.sho);

  const oppGk = (nextSide === 'home' ? state.awayRoster : state.homeRoster).find(
    (r) => r.onPitch && r.player.roleGroup === 'GK'
  );

  const takerIdx = ((round - 1) % Math.max(1, takersPool.length));
  const taker = takersPool[takerIdx] || (nextSide === 'home' ? state.homeRoster[0] : state.awayRoster[0]);

  const conversionProb = clamp(
    0.74 + (taker.player.stats.sho - (oppGk?.player.overall || 82)) * 0.006,
    0.58,
    0.89
  );
  const scored = Math.random() < conversionProb;

  const newKick: ShootoutKick = {
    round,
    side: nextSide,
    takerName: taker.player.shortName,
    scored,
  };

  const nextHomePen = state.homePenScore + (nextSide === 'home' && scored ? 1 : 0);
  const nextAwayPen = state.awayPenScore + (nextSide === 'away' && scored ? 1 : 0);
  const teamName = nextSide === 'home' ? state.homeTeam.shortName : state.awayTeam.shortName;

  const ev: SimEvent = {
    id: uid('ev'),
    minute: 120,
    minuteLabel: `P${round}`,
    type: 'shootout',
    side: nextSide,
    teamName,
    playerId: taker.player.id,
    playerName: taker.player.shortName,
    text: scored
      ? `Penalty Goal (${teamName}): ${taker.player.name} buries it! (${nextHomePen}–${nextAwayPen})`
      : `Saved/Missed (${teamName}): ${taker.player.name} is denied by ${oppGk?.player.shortName || 'the keeper'}!`,
    isKey: true,
  };

  const updatedKicks = [...kicks, newKick];
  const hK = updatedKicks.filter((k) => k.side === 'home');
  const aK = updatedKicks.filter((k) => k.side === 'away');

  let finalPhase: MatchPhase = 'PENALTY_SHOOTOUT';
  const extraEvents: SimEvent[] = [ev];
  let flash = {
    side: nextSide,
    type: 'shootout' as const,
    headline: scored ? `PENALTY SCORED · ${taker.player.shortName}` : `SAVED · ${oppGk?.player.shortName || 'GK'}`,
    subline: `${state.homeTeam.abbr} ${nextHomePen} – ${nextAwayPen} ${state.awayTeam.abbr}`,
  };

  let decided: 'home' | 'away' | null = null;
  if (hK.length <= 5 && aK.length <= 5) {
    if (nextHomePen > nextAwayPen + (5 - aK.length)) decided = 'home';
    else if (nextAwayPen > nextHomePen + (5 - hK.length)) decided = 'away';
  } else if (hK.length === aK.length && nextHomePen !== nextAwayPen) {
    decided = nextHomePen > nextAwayPen ? 'home' : 'away';
  }

  if (decided) {
    finalPhase = 'FULLTIME';
    const winTeam = decided === 'home' ? state.homeTeam.name : state.awayTeam.name;
    extraEvents.unshift({
      id: uid('ev'),
      minute: 120,
      minuteLabel: 'PEN',
      type: 'fulltime',
      side: decided,
      teamName: winTeam,
      text: `FULL TIME! ${winTeam} clinch the penalty shootout ${nextHomePen}–${nextAwayPen}!`,
      isKey: true,
    });
    flash = {
      side: decided,
      type: 'shootout',
      headline: `${winTeam} WIN!`,
      subline: `Penalties ${nextHomePen} – ${nextAwayPen}`,
    };
  }

  return {
    ...state,
    phase: finalPhase,
    homePenScore: nextHomePen,
    awayPenScore: nextAwayPen,
    shootoutKicks: updatedKicks,
    ballPos: { x: nextSide === 'home' ? 89 : 11, y: 50 },
    events: [...extraEvents, ...state.events],
    highlightedPlayerId: taker.player.id,
    activeFlash: flash,
  };
}

export function advanceMatchMinute(prevState: SimMatchState): SimMatchState {
  if (prevState.phase === 'FULLTIME') return prevState;

  if (prevState.phase === 'PENALTY_SHOOTOUT') {
    return advancePenaltyShootoutStep(prevState);
  }

  // Handle Halftime break resume
  if (prevState.phase === 'HALFTIME') {
    const recover = (r: LivePlayerState[]) =>
      r.map((p) => (p.onPitch ? { ...p, stamina: clamp(p.stamina + 7, 15, 100) } : p));
    return {
      ...prevState,
      phase: 'SECOND_HALF',
      minute: 46,
      addedTime: 0,
      homeRoster: recover(prevState.homeRoster),
      awayRoster: recover(prevState.awayRoster),
      ballPos: { x: 50, y: 50 },
      activeFlash: {
        side: 'neutral',
        type: 'kickoff',
        headline: 'SECOND HALF UNDERWAY',
        subline: `${prevState.homeTeam.shortName} ${prevState.homeScore} – ${prevState.awayScore} ${prevState.awayTeam.shortName}`,
      },
      events: [
        {
          id: uid('ev'),
          minute: 46,
          minuteLabel: "46'",
          type: 'kickoff',
          side: 'neutral',
          text: 'Second half kicks off!',
          isKey: false,
        },
        ...prevState.events,
      ],
    };
  }

  if (prevState.phase === 'EXTRA_TIME_HT') {
    return {
      ...prevState,
      phase: 'EXTRA_TIME_2',
      minute: 106,
      addedTime: 0,
      ballPos: { x: 50, y: 50 },
      activeFlash: null,
      events: [
        {
          id: uid('ev'),
          minute: 106,
          minuteLabel: "106'",
          type: 'extratime_start',
          side: 'neutral',
          text: 'Second period of Extra Time begins!',
          isKey: false,
        },
        ...prevState.events,
      ],
    };
  }

  // Compute next clock position
  let nextMinute = prevState.minute;
  let nextAdded = prevState.addedTime;
  let nextPhase: MatchPhase = prevState.phase;

  if (prevState.phase === 'FIRST_HALF') {
    if (prevState.minute < 45) {
      nextMinute += 1;
    } else if (prevState.addedTime < prevState.stoppageTarget1) {
      nextAdded += 1;
    } else {
      // Transition to Half-time
      return {
        ...prevState,
        phase: 'HALFTIME',
        ballPos: { x: 50, y: 50 },
        activeFlash: {
          side: 'neutral',
          type: 'halftime',
          headline: 'HALF TIME',
          subline: `${prevState.homeTeam.shortName} ${prevState.homeScore} – ${prevState.awayScore} ${prevState.awayTeam.shortName}`,
        },
        events: [
          {
            id: uid('ev'),
            minute: 45,
            addedTime: prevState.stoppageTarget1,
            minuteLabel: 'HT',
            type: 'halftime',
            side: 'neutral',
            text: `Half-time whistle! ${prevState.homeTeam.shortName} ${prevState.homeScore}–${prevState.awayScore} ${prevState.awayTeam.shortName}.`,
            isKey: true,
          },
          ...prevState.events,
        ],
      };
    }
  } else if (prevState.phase === 'SECOND_HALF') {
    if (prevState.minute < 90) {
      nextMinute += 1;
    } else if (prevState.addedTime < prevState.stoppageTarget2) {
      nextAdded += 1;
    } else {
      // Check knockout tie -> Extra Time
      if (prevState.knockoutRules && prevState.homeScore === prevState.awayScore) {
        const recover = (r: LivePlayerState[]) =>
          r.map((p) => (p.onPitch ? { ...p, stamina: clamp(p.stamina + 6, 15, 100) } : p));
        return {
          ...prevState,
          phase: 'EXTRA_TIME_1',
          minute: 91,
          addedTime: 0,
          homeRoster: recover(prevState.homeRoster),
          awayRoster: recover(prevState.awayRoster),
          ballPos: { x: 50, y: 50 },
          activeFlash: {
            side: 'neutral',
            type: 'extratime_start',
            headline: 'EXTRA TIME',
            subline: `All square ${prevState.homeScore}–${prevState.awayScore} — 30 extra minutes!`,
          },
          events: [
            {
              id: uid('ev'),
              minute: 90,
              minuteLabel: "90'",
              type: 'extratime_start',
              side: 'neutral',
              text: `90 minutes played and it finishes ${prevState.homeScore}–${prevState.awayScore}. Extra Time awaits!`,
              isKey: true,
            },
            ...prevState.events,
          ],
        };
      }

      const winSide =
        prevState.homeScore > prevState.awayScore
          ? 'home'
          : prevState.awayScore > prevState.homeScore
          ? 'away'
          : 'neutral';
      const ftHeadline =
        winSide === 'neutral'
          ? 'FULL TIME · DRAW'
          : `FULL TIME · ${winSide === 'home' ? prevState.homeTeam.shortName : prevState.awayTeam.shortName} WIN`;
      return {
        ...prevState,
        phase: 'FULLTIME',
        ballPos: { x: 50, y: 50 },
        activeFlash: {
          side: winSide,
          type: 'fulltime',
          headline: ftHeadline,
          subline: `${prevState.homeTeam.shortName} ${prevState.homeScore} – ${prevState.awayScore} ${prevState.awayTeam.shortName}`,
        },
        events: [
          {
            id: uid('ev'),
            minute: 90,
            addedTime: prevState.stoppageTarget2,
            minuteLabel: 'FT',
            type: 'fulltime',
            side: winSide,
            text: `Full-time whistle! Final Score: ${prevState.homeTeam.name} ${prevState.homeScore}–${prevState.awayScore} ${prevState.awayTeam.name}.`,
            isKey: true,
          },
          ...prevState.events,
        ],
      };
    }
  } else if (prevState.phase === 'EXTRA_TIME_1') {
    if (prevState.minute < 105) {
      nextMinute += 1;
    } else {
      return {
        ...prevState,
        phase: 'EXTRA_TIME_HT',
        ballPos: { x: 50, y: 50 },
        activeFlash: {
          side: 'neutral',
          type: 'halftime',
          headline: 'ET HALF TIME',
          subline: `${prevState.homeTeam.shortName} ${prevState.homeScore} – ${prevState.awayScore} ${prevState.awayTeam.shortName}`,
        },
        events: [
          {
            id: uid('ev'),
            minute: 105,
            minuteLabel: 'ET HT',
            type: 'halftime',
            side: 'neutral',
            text: 'End of the first period of Extra Time.',
            isKey: false,
          },
          ...prevState.events,
        ],
      };
    }
  } else if (prevState.phase === 'EXTRA_TIME_2') {
    if (prevState.minute < 120) {
      nextMinute += 1;
    } else if (prevState.homeScore === prevState.awayScore) {
      return {
        ...prevState,
        phase: 'PENALTY_SHOOTOUT',
        ballPos: { x: 89, y: 50 },
        activeFlash: {
          side: 'neutral',
          type: 'shootout',
          headline: 'PENALTY SHOOTOUT',
          subline: `${prevState.homeTeam.shortName} vs ${prevState.awayTeam.shortName}`,
        },
        events: [
          {
            id: uid('ev'),
            minute: 120,
            minuteLabel: '120\'',
            type: 'shootout',
            side: 'neutral',
            text: `Still level ${prevState.homeScore}–${prevState.awayScore} after Extra Time! We are heading to a Penalty Shootout!`,
            isKey: true,
          },
          ...prevState.events,
        ],
      };
    } else {
      const winSide = prevState.homeScore > prevState.awayScore ? 'home' : 'away';
      return {
        ...prevState,
        phase: 'FULLTIME',
        ballPos: { x: 50, y: 50 },
        activeFlash: {
          side: winSide,
          type: 'fulltime',
          headline: 'FULL TIME (AET)',
          subline: `${prevState.homeTeam.shortName} ${prevState.homeScore} – ${prevState.awayScore} ${prevState.awayTeam.shortName}`,
        },
        events: [
          {
            id: uid('ev'),
            minute: 120,
            minuteLabel: 'AET',
            type: 'fulltime',
            side: winSide,
            text: `Full time after Extra Time! ${prevState.homeTeam.name} ${prevState.homeScore}–${prevState.awayScore} ${prevState.awayTeam.name}.`,
            isKey: true,
          },
          ...prevState.events,
        ],
      };
    }
  }

  // Simulate active football minute
  const minLabel = formatMinute(nextMinute, nextAdded);
  const homeStr = computeSideStrength(
    prevState.homeRoster,
    prevState.formationHome,
    prevState.styleHome,
    prevState.mentalityHome,
    true
  );
  const awayStr = computeSideStrength(
    prevState.awayRoster,
    prevState.formationAway,
    prevState.styleAway,
    prevState.mentalityAway,
    false
  );

  // Midfield control dictates minute possession & pass share
  const midDiff = clamp((homeStr.mid - awayStr.mid) * 1.45, -24, 24);
  const targetHomePoss = clamp(50 + midDiff + randRange(-5, 5), 26, 74);
  const elapsedMins = Math.max(1, nextMinute + nextAdded);
  const nextPossHome = Math.round(
    (prevState.stats.possessionHome * (elapsedMins - 1) + targetHomePoss) / elapsedMins
  );
  const nextPossAway = 100 - nextPossHome;

  const homePassesTick = Math.round((targetHomePoss / 100) * randRange(7, 13) + (prevState.styleHome === 'Tiki-Taka' ? 2 : 0));
  const awayPassesTick = Math.round(((100 - targetHomePoss) / 100) * randRange(7, 13) + (prevState.styleAway === 'Tiki-Taka' ? 2 : 0));

  // Drain stamina
  const drainRoster = (roster: LivePlayerState[], style: TacticalStyle, mentality: TacticalMentality) =>
    roster.map((r) => {
      if (!r.onPitch || r.redCard) return r;
      const roleDrain =
        r.player.roleGroup === 'GK' ? 0.1 : r.player.roleGroup === 'MID' ? 0.54 : 0.46;
      const styleMult = style === 'High Press' ? 1.24 : style === 'Balanced' ? 0.9 : 1.0;
      const mentMult = mentality === 'Attacking' ? 1.12 : mentality === 'Defensive' ? 0.92 : 1.0;
      const phySave = (r.player.stats.phy - 75) * 0.004;
      const nextStam = clamp(r.stamina - Math.max(0.08, (roleDrain * styleMult * mentMult) - phySave), 18, 100);
      return { ...r, stamina: nextStam };
    });

  let homeRoster = drainRoster(prevState.homeRoster, prevState.styleHome, prevState.mentalityHome);
  let awayRoster = drainRoster(prevState.awayRoster, prevState.styleAway, prevState.mentalityAway);
  let stats = {
    ...prevState.stats,
    possessionHome: nextPossHome,
    possessionAway: nextPossAway,
    passesHome: prevState.stats.passesHome + homePassesTick,
    passesAway: prevState.stats.passesAway + awayPassesTick,
    passAccHome: clamp(
      Math.round(78 + (homeStr.mid - 70) * 0.35 + (prevState.styleHome === 'Tiki-Taka' ? 4 : 0)),
      68,
      94
    ),
    passAccAway: clamp(
      Math.round(78 + (awayStr.mid - 70) * 0.35 + (prevState.styleAway === 'Tiki-Taka' ? 4 : 0)),
      68,
      94
    ),
  };

  let homeScore = prevState.homeScore;
  let awayScore = prevState.awayScore;
  let subsUsedHome = prevState.subsUsedHome;
  let subsUsedAway = prevState.subsUsedAway;
  const newEvents: SimEvent[] = [];
  let activeFlash: SimMatchState['activeFlash'] = null;
  let highlightedPlayerId: string | null = null;

  // Determine ball zone progression naturally
  const homeHasBall = Math.random() * 100 < targetHomePoss;
  let nextBallPos = {
    x: homeHasBall ? randRange(52, 86) : randRange(14, 48),
    y: randRange(16, 84),
  };

  // Evaluate attacking opportunity (calibrated for realistic ~10-16 shots & ~1.1-2.4 xG per side)
  const homeChanceProb = clamp(
    0.098 + (homeStr.att - awayStr.def) * 0.0045 + (prevState.mentalityHome === 'Attacking' ? 0.03 : prevState.mentalityHome === 'Defensive' ? -0.025 : 0),
    0.05,
    0.19
  );
  const awayChanceProb = clamp(
    0.092 + (awayStr.att - homeStr.def) * 0.0045 + (prevState.mentalityAway === 'Attacking' ? 0.03 : prevState.mentalityAway === 'Defensive' ? -0.025 : 0),
    0.045,
    0.18
  );

  const roll = Math.random();
  let chanceSide: 'home' | 'away' | null = null;
  if (roll < homeChanceProb) chanceSide = 'home';
  else if (roll < homeChanceProb + awayChanceProb) chanceSide = 'away';

  if (chanceSide) {
    const isHomeChance = chanceSide === 'home';
    const attTeam = isHomeChance ? prevState.homeTeam : prevState.awayTeam;
    const defTeam = isHomeChance ? prevState.awayTeam : prevState.homeTeam;
    const attStr = isHomeChance ? homeStr : awayStr;
    const defStr = isHomeChance ? awayStr : homeStr;
    const attStyle = isHomeChance ? prevState.styleHome : prevState.styleAway;
    const attRoster = isHomeChance ? homeRoster : awayRoster;
    const defRoster = isHomeChance ? awayRoster : homeRoster;

    nextBallPos = {
      x: isHomeChance ? randRange(82, 95) : randRange(5, 18),
      y: randRange(28, 72),
    };

    const shooter = pickWeighted(
      attRoster.filter((r) => r.onPitch && !r.redCard && r.player.roleGroup !== 'GK'),
      (r) =>
        r.player.roleGroup === 'FWD'
          ? r.player.stats.sho * 2.1
          : r.player.roleGroup === 'MID'
          ? r.player.stats.sho * 0.85
          : 15
    );
    const assister = pickWeighted(
      attRoster.filter(
        (r) =>
          r.onPitch &&
          !r.redCard &&
          r.player.roleGroup !== 'GK' &&
          r.player.id !== shooter?.player.id
      ),
      (r) =>
        r.player.roleGroup === 'MID'
          ? r.player.stats.pas * 1.8
          : r.player.roleGroup === 'FWD'
          ? r.player.stats.pas * 1.1
          : r.player.stats.pas * 0.55
    );
    const gk = defRoster.find((r) => r.onPitch && r.player.roleGroup === 'GK');

    // Update shot & xG telemetry
    const shotQuality = clamp(
      0.085 + (attStr.att - defStr.def) * 0.003 + randRange(-0.03, 0.11),
      0.02,
      0.34
    );

    if (isHomeChance) {
      stats.shotsHome += 1;
      stats.xgHome = Number((stats.xgHome + shotQuality).toFixed(2));
    } else {
      stats.shotsAway += 1;
      stats.xgAway = Number((stats.xgAway + shotQuality).toFixed(2));
    }

    if (shooter) {
      const incShot = (arr: LivePlayerState[]) =>
        arr.map((r) => (r.player.id === shooter.player.id ? { ...r, shots: r.shots + 1 } : r));
      if (isHomeChance) homeRoster = incShot(homeRoster);
      else awayRoster = incShot(awayRoster);
      highlightedPlayerId = shooter.player.id;
    }

    // Check corner from Wing Play or deflected strike
    if (Math.random() < (attStyle === 'Wing Play' ? 0.42 : 0.28)) {
      if (isHomeChance) stats.cornersHome += 1;
      else stats.cornersAway += 1;
    }

    // Check Penalty Decision (~6.5% of box entries)
    if (Math.random() < 0.068 && shooter) {
      const varTriggered = Math.random() < 0.35;
      if (varTriggered) {
        newEvents.push({
          id: uid('ev'),
          minute: nextMinute,
          addedTime: nextAdded || undefined,
          minuteLabel: minLabel,
          type: 'var_penalty',
          side: chanceSide,
          teamName: attTeam.shortName,
          playerId: shooter.player.id,
          playerName: shooter.player.shortName,
          text: `VAR Check: Referee inspects monitor and awards a PENALTY to ${attTeam.shortName}!`,
          isKey: true,
        });
      }

      const penaltyXg = 0.78;
      if (isHomeChance) {
        stats.shotsOnTargetHome += 1;
        stats.xgHome = Number((stats.xgHome + penaltyXg).toFixed(2));
      } else {
        stats.shotsOnTargetAway += 1;
        stats.xgAway = Number((stats.xgAway + penaltyXg).toFixed(2));
      }

      const pkConv = clamp(0.77 + (shooter.player.stats.sho - (gk?.player.overall || 82)) * 0.006, 0.62, 0.9);
      if (Math.random() < pkConv) {
        if (isHomeChance) homeScore += 1;
        else awayScore += 1;

        const updateScorer = (arr: LivePlayerState[]) =>
          arr.map((r) =>
            r.player.id === shooter.player.id
              ? { ...r, goals: r.goals + 1, rating: clamp(Number((r.rating + 1.05).toFixed(1)), 4.5, 10) }
              : r
          );
        if (isHomeChance) homeRoster = updateScorer(homeRoster);
        else awayRoster = updateScorer(awayRoster);

        newEvents.push({
          id: uid('ev'),
          minute: nextMinute,
          addedTime: nextAdded || undefined,
          minuteLabel: minLabel,
          type: 'penalty_goal',
          side: chanceSide,
          teamName: attTeam.shortName,
          playerId: shooter.player.id,
          playerName: shooter.player.shortName,
          text: `PENALTY GOAL (${attTeam.shortName})! ${shooter.player.name} steps up and dispatches it past ${gk?.player.shortName || 'the keeper'}!`,
          isKey: true,
        });
        activeFlash = {
          side: chanceSide,
          type: 'penalty_goal',
          headline: `PENALTY GOAL · ${attTeam.shortName.toUpperCase()}`,
          subline: `${shooter.player.name} (${minLabel})`,
        };
      } else {
        if (isHomeChance) stats.savesAway += 1;
        else stats.savesHome += 1;
        if (gk) {
          const boostGk = (arr: LivePlayerState[]) =>
            arr.map((r) =>
              r.player.id === gk.player.id
                ? { ...r, saves: r.saves + 1, rating: clamp(Number((r.rating + 0.85).toFixed(1)), 4.5, 10) }
                : r
            );
          if (isHomeChance) awayRoster = boostGk(awayRoster);
          else homeRoster = boostGk(homeRoster);
        }
        newEvents.push({
          id: uid('ev'),
          minute: nextMinute,
          addedTime: nextAdded || undefined,
          minuteLabel: minLabel,
          type: 'penalty_miss',
          side: chanceSide,
          teamName: attTeam.shortName,
          playerId: shooter.player.id,
          playerName: shooter.player.shortName,
          text: `PENALTY SAVED! ${gk?.player.name || 'The goalkeeper'} guesses right and denies ${shooter.player.name}!`,
          isKey: true,
        });
        activeFlash = {
          side: isHomeChance ? 'away' : 'home',
          type: 'penalty_miss',
          headline: `PENALTY SAVED · ${gk?.player.shortName || 'GK'}`,
          subline: `Denied ${shooter.player.shortName} at ${minLabel}`,
        };
      }
    } else {
      // Normal open-play shot outcome
      const onTargetProb = clamp(0.45 + ((shooter?.player.stats.sho || 78) - 75) * 0.01, 0.34, 0.66);
      if (Math.random() < onTargetProb && shooter) {
        if (isHomeChance) stats.shotsOnTargetHome += 1;
        else stats.shotsOnTargetAway += 1;

        const goalProb = clamp(
          0.24 + (shooter.player.stats.sho - defStr.gk) * 0.0085 + (attStyle === 'Counter-Attack' ? 0.03 : 0),
          0.12,
          0.42
        );

        if (Math.random() < goalProb) {
          // Check dramatic VAR offside (~11%)
          if (Math.random() < 0.11) {
            newEvents.push({
              id: uid('ev'),
              minute: nextMinute,
              addedTime: nextAdded || undefined,
              minuteLabel: minLabel,
              type: 'var_disallowed',
              side: chanceSide,
              teamName: attTeam.shortName,
              playerId: shooter.player.id,
              playerName: shooter.player.shortName,
              text: `VAR: GOAL DISALLOWED! ${shooter.player.name} put the ball in the net for ${attTeam.shortName}, but VAR flags a narrow offside.`,
              isKey: true,
            });
            activeFlash = {
              side: 'neutral',
              type: 'var_disallowed',
              headline: 'VAR · NO GOAL (OFFSIDE)',
              subline: `${shooter.player.shortName}'s finish ruled out`,
            };
          } else {
            // Valid Goal!
            if (isHomeChance) homeScore += 1;
            else awayScore += 1;

            const isVarConfirm = Math.random() < 0.12;
            const flavor = GOAL_FLAVORS[Math.floor(Math.random() * GOAL_FLAVORS.length)];

            const updateAttStats = (arr: LivePlayerState[]) =>
              arr.map((r) => {
                if (r.player.id === shooter.player.id) {
                  return {
                    ...r,
                    goals: r.goals + 1,
                    rating: clamp(Number((r.rating + 1.15).toFixed(1)), 4.5, 10),
                  };
                }
                if (assister && r.player.id === assister.player.id) {
                  return {
                    ...r,
                    assists: r.assists + 1,
                    rating: clamp(Number((r.rating + 0.65).toFixed(1)), 4.5, 10),
                  };
                }
                return r;
              });

            const penalizeDef = (arr: LivePlayerState[]) =>
              arr.map((r) =>
                r.onPitch && (r.player.roleGroup === 'DEF' || r.player.roleGroup === 'GK')
                  ? { ...r, rating: clamp(Number((r.rating - 0.18).toFixed(1)), 4.5, 10) }
                  : r
              );

            if (isHomeChance) {
              homeRoster = updateAttStats(homeRoster);
              awayRoster = penalizeDef(awayRoster);
            } else {
              awayRoster = updateAttStats(awayRoster);
              homeRoster = penalizeDef(homeRoster);
            }

            newEvents.push({
              id: uid('ev'),
              minute: nextMinute,
              addedTime: nextAdded || undefined,
              minuteLabel: minLabel,
              type: isVarConfirm ? 'var_goal' : 'goal',
              side: chanceSide,
              teamName: attTeam.shortName,
              playerId: shooter.player.id,
              playerName: shooter.player.shortName,
              assistPlayerName: assister?.player.shortName,
              text: `${isVarConfirm ? 'VAR CONFIRMS GOAL! ' : 'GOAL! '}${shooter.player.name} (${attTeam.shortName}) ${flavor}${assister ? ` Assist: ${assister.player.shortName}.` : ''}`,
              isKey: true,
            });
            activeFlash = {
              side: chanceSide,
              type: isVarConfirm ? 'var_goal' : 'goal',
              headline: `GOAL · ${attTeam.shortName.toUpperCase()}`,
              subline: `${shooter.player.name}${assister ? ` (Ast: ${assister.player.shortName})` : ''} · ${minLabel}`,
            };
          }
        } else {
          // Great save by Goalkeeper
          if (isHomeChance) stats.savesAway += 1;
          else stats.savesHome += 1;
          if (gk) {
            const boostGk = (arr: LivePlayerState[]) =>
              arr.map((r) =>
                r.player.id === gk.player.id
                  ? { ...r, saves: r.saves + 1, rating: clamp(Number((r.rating + 0.14).toFixed(1)), 4.5, 9.2) }
                  : r
              );
            if (isHomeChance) awayRoster = boostGk(awayRoster);
            else homeRoster = boostGk(homeRoster);
          }
          if (Math.random() < 0.35) {
            newEvents.push({
              id: uid('ev'),
              minute: nextMinute,
              addedTime: nextAdded || undefined,
              minuteLabel: minLabel,
              type: 'save',
              side: isHomeChance ? 'away' : 'home',
              teamName: defTeam.shortName,
              playerId: gk?.player.id,
              playerName: gk?.player.shortName,
              text: `Big save by ${gk?.player.name || 'the keeper'} (${defTeam.shortName}) to parry away ${shooter.player.shortName}'s fierce effort!`,
              isKey: false,
            });
          }
        }
      }
    }
  }

  // Evaluate fouls, yellow & red cards, and injuries
  const foulRoll = Math.random();
  if (foulRoll < 0.22) {
    const foulSide: 'home' | 'away' = Math.random() < 0.5 ? 'home' : 'away';
    const isHomeFoul = foulSide === 'home';
    if (isHomeFoul) stats.foulsHome += 1;
    else stats.foulsAway += 1;

    const foulPool = (isHomeFoul ? homeRoster : awayRoster).filter(
      (r) => r.onPitch && !r.redCard && r.player.roleGroup !== 'GK'
    );
    const culprit = pickWeighted(foulPool, (r) =>
      r.player.roleGroup === 'DEF' ? 2.2 : r.player.roleGroup === 'MID' ? 1.5 : 0.7
    );

    if (culprit) {
      // Card probability
      const cardRoll = Math.random();
      const staminaRisk = culprit.stamina < 55 ? 0.06 : 0;
      if (cardRoll < 0.015) {
        // Straight Red Card
        if (isHomeFoul) stats.redHome += 1;
        else stats.redAway += 1;
        const sendOff = (arr: LivePlayerState[]) =>
          arr.map((r) =>
            r.player.id === culprit.player.id
              ? { ...r, redCard: true, onPitch: false, rating: clamp(Number((r.rating - 1.5).toFixed(1)), 3.5, 10) }
              : r
          );
        if (isHomeFoul) homeRoster = sendOff(homeRoster);
        else awayRoster = sendOff(awayRoster);

        const tName = isHomeFoul ? prevState.homeTeam.shortName : prevState.awayTeam.shortName;
        newEvents.push({
          id: uid('ev'),
          minute: nextMinute,
          addedTime: nextAdded || undefined,
          minuteLabel: minLabel,
          type: 'red',
          side: foulSide,
          teamName: tName,
          playerId: culprit.player.id,
          playerName: culprit.player.shortName,
          text: `RED CARD (${tName})! ${culprit.player.name} is sent off for a reckless challenge!`,
          isKey: true,
        });
        activeFlash = {
          side: foulSide,
          type: 'red',
          headline: `RED CARD · ${tName.toUpperCase()}`,
          subline: `${culprit.player.name} Sent Off (${minLabel})`,
        };
      } else if (cardRoll < 0.16 + staminaRisk) {
        const alreadyBooked = culprit.yellowCards >= 1;
        const tName = isHomeFoul ? prevState.homeTeam.shortName : prevState.awayTeam.shortName;
        if (alreadyBooked) {
          if (isHomeFoul) {
            stats.yellowHome += 1;
            stats.redHome += 1;
          } else {
            stats.yellowAway += 1;
            stats.redAway += 1;
          }
          const sendOff2 = (arr: LivePlayerState[]) =>
            arr.map((r) =>
              r.player.id === culprit.player.id
                ? {
                    ...r,
                    yellowCards: 2,
                    redCard: true,
                    onPitch: false,
                    rating: clamp(Number((r.rating - 1.3).toFixed(1)), 3.5, 10),
                  }
                : r
            );
          if (isHomeFoul) homeRoster = sendOff2(homeRoster);
          else awayRoster = sendOff2(awayRoster);

          newEvents.push({
            id: uid('ev'),
            minute: nextMinute,
            addedTime: nextAdded || undefined,
            minuteLabel: minLabel,
            type: 'red',
            side: foulSide,
            teamName: tName,
            playerId: culprit.player.id,
            playerName: culprit.player.shortName,
            text: `SECOND YELLOW -> RED CARD (${tName})! ${culprit.player.name} gets his marching orders!`,
            isKey: true,
          });
          activeFlash = {
            side: foulSide,
            type: 'red',
            headline: `SENT OFF · ${culprit.player.shortName}`,
            subline: `Second yellow card (${minLabel})`,
          };
        } else {
          if (isHomeFoul) stats.yellowHome += 1;
          else stats.yellowAway += 1;
          const book = (arr: LivePlayerState[]) =>
            arr.map((r) =>
              r.player.id === culprit.player.id
                ? { ...r, yellowCards: 1, rating: clamp(Number((r.rating - 0.35).toFixed(1)), 4.0, 10) }
                : r
            );
          if (isHomeFoul) homeRoster = book(homeRoster);
          else awayRoster = book(awayRoster);

          newEvents.push({
            id: uid('ev'),
            minute: nextMinute,
            addedTime: nextAdded || undefined,
            minuteLabel: minLabel,
            type: 'yellow',
            side: foulSide,
            teamName: tName,
            playerId: culprit.player.id,
            playerName: culprit.player.shortName,
            text: `Yellow Card (${tName}): ${culprit.player.name} goes into the referee's book.`,
            isKey: false,
          });
        }
      }
    }
  }

  // Occasional Injury check (~1.1% per minute, max 2 injuries typical)
  if (Math.random() < 0.011 && nextMinute > 12) {
    const injSide: 'home' | 'away' = Math.random() < 0.5 ? 'home' : 'away';
    const isHomeInj = injSide === 'home';
    const injPool = (isHomeInj ? homeRoster : awayRoster).filter(
      (r) => r.onPitch && !r.redCard && !r.injured && r.player.roleGroup !== 'GK'
    );
    const victim = injPool[Math.floor(Math.random() * injPool.length)];
    if (victim) {
      const markInj = (arr: LivePlayerState[]) =>
        arr.map((r) => (r.player.id === victim.player.id ? { ...r, injured: true, stamina: Math.min(r.stamina, 32) } : r));
      if (isHomeInj) homeRoster = markInj(homeRoster);
      else awayRoster = markInj(awayRoster);

      const tName = isHomeInj ? prevState.homeTeam.shortName : prevState.awayTeam.shortName;
      newEvents.push({
        id: uid('ev'),
        minute: nextMinute,
        addedTime: nextAdded || undefined,
        minuteLabel: minLabel,
        type: 'injury',
        side: injSide,
        teamName: tName,
        playerId: victim.player.id,
        playerName: victim.player.shortName,
        text: `Injury Worry (${tName}): ${victim.player.name} goes down clutching his hamstring and needs treatment.`,
        isKey: true,
      });

      const subRes = tryAutoSubstitution(
        isHomeInj ? homeRoster : awayRoster,
        isHomeInj ? subsUsedHome : subsUsedAway,
        nextMinute,
        injSide,
        tName,
        victim.player.id
      );
      if (subRes.event) {
        if (isHomeInj) {
          homeRoster = subRes.roster;
          subsUsedHome = subRes.subsUsed;
        } else {
          awayRoster = subRes.roster;
          subsUsedAway = subRes.subsUsed;
        }
        newEvents.push(subRes.event);
      }
    }
  }

  // Natural AI tactical substitutions between 58' and 86'
  if (nextMinute >= 58 && nextMinute <= 86 && nextAdded === 0) {
    if (subsUsedHome < 4 && Math.random() < (nextMinute > 70 ? 0.14 : 0.075)) {
      const res = tryAutoSubstitution(
        homeRoster,
        subsUsedHome,
        nextMinute,
        'home',
        prevState.homeTeam.shortName
      );
      homeRoster = res.roster;
      subsUsedHome = res.subsUsed;
      if (res.event) newEvents.push(res.event);
    }
    if (subsUsedAway < 4 && Math.random() < (nextMinute > 70 ? 0.14 : 0.075)) {
      const res = tryAutoSubstitution(
        awayRoster,
        subsUsedAway,
        nextMinute,
        'away',
        prevState.awayTeam.shortName
      );
      awayRoster = res.roster;
      subsUsedAway = res.subsUsed;
      if (res.event) newEvents.push(res.event);
    }
  }

  // Subtle positive rating drift for steady midfield/defensive play every 10 mins
  if (nextMinute > 0 && nextMinute % 10 === 0 && nextAdded === 0) {
    const gentleUpdate = (arr: LivePlayerState[]) =>
      arr.map((r) => {
        if (!r.onPitch || r.redCard) return r;
        const delta = (r.player.overall - 78) * 0.008 + randRange(-0.04, 0.09);
        return {
          ...r,
          tackles: r.player.roleGroup === 'DEF' || r.player.roleGroup === 'MID' ? r.tackles + (Math.random() < 0.45 ? 1 : 0) : r.tackles,
          rating: clamp(Number((r.rating + delta).toFixed(1)), 4.5, 10),
        };
      });
    homeRoster = gentleUpdate(homeRoster);
    awayRoster = gentleUpdate(awayRoster);
  }

  const momentumHome = clamp(Math.round((targetHomePoss - 50) * 1.4 + (homeScore - awayScore) * 10), -50, 50);

  return {
    ...prevState,
    phase: nextPhase,
    minute: nextMinute,
    addedTime: nextAdded,
    homeScore,
    awayScore,
    subsUsedHome,
    subsUsedAway,
    stats,
    homeRoster,
    awayRoster,
    ballPos: nextBallPos,
    momentumHome,
    highlightedPlayerId,
    activeFlash: activeFlash ?? null,
    events: newEvents.length > 0 ? [...newEvents, ...prevState.events] : prevState.events,
  };
}

export function simulateToFullTime(startState: SimMatchState): SimMatchState {
  let current = startState;
  let safety = 0;
  while (current.phase !== 'FULLTIME' && safety < 260) {
    current = advanceMatchMinute(current);
    safety += 1;
  }
  return current;
}

export function generateMatchReport(state: SimMatchState): SimMatchReport {
  const allPlayers = [...state.homeRoster, ...state.awayRoster].filter(
    (p) => p.onPitch || p.subbedOutAt || p.subbedInAt
  );

  let winnerSide: 'home' | 'away' | 'draw' = 'draw';
  if (state.homeScore > state.awayScore) winnerSide = 'home';
  else if (state.awayScore > state.homeScore) winnerSide = 'away';
  else if (state.homePenScore > state.awayPenScore) winnerSide = 'home';
  else if (state.awayPenScore > state.homePenScore) winnerSide = 'away';

  const winnerName =
    winnerSide === 'home'
      ? state.homeTeam.name
      : winnerSide === 'away'
      ? state.awayTeam.name
      : 'Draw';

  const sortedMotm = [...allPlayers].sort((a, b) => {
    const aWinnerBoost = a.side === winnerSide ? 0.35 : 0;
    const bWinnerBoost = b.side === winnerSide ? 0.35 : 0;
    const aScore = a.rating + a.goals * 0.4 + a.assists * 0.25 + aWinnerBoost;
    const bScore = b.rating + b.goals * 0.4 + b.assists * 0.25 + bWinnerBoost;
    return bScore - aScore;
  });

  const motm = sortedMotm[0] || state.homeRoster[0];
  const wentToExtraTime = state.minute > 90 || state.events.some((e) => e.type === 'extratime_start');
  const wentToPenalties = state.shootoutKicks.length > 0;

  const scoreline = wentToPenalties
    ? `${state.homeScore}–${state.awayScore} (${state.homePenScore}–${state.awayPenScore} PEN)`
    : wentToExtraTime
    ? `${state.homeScore}–${state.awayScore} (AET)`
    : `${state.homeScore}–${state.awayScore}`;

  const summaryLine =
    winnerSide === 'draw'
      ? `${state.homeTeam.shortName} & ${state.awayTeam.shortName} shared the spoils (${scoreline}) — MOTM: ${motm.player.shortName} (${motm.rating.toFixed(1)}).`
      : `${winnerName} triumphed ${scoreline} in ${state.competitionLabel} — MOTM: ${motm.player.shortName} (${motm.rating.toFixed(1)}).`;

  const domTeam =
    state.stats.possessionHome >= 56
      ? `${state.homeTeam.shortName} controlled the tempo (${state.stats.possessionHome}% possession, ${state.stats.passesHome} passes)`
      : state.stats.possessionAway >= 56
      ? `${state.awayTeam.shortName} dictated possession (${state.stats.possessionAway}% ball share, ${state.stats.passesAway} passes)`
      : `A balanced tactical battle across midfield (${state.stats.possessionHome}% vs ${state.stats.possessionAway}% possession)`;

  const xGNote = `Sim xG: ${state.stats.xgHome.toFixed(2)} – ${state.stats.xgAway.toFixed(2)}, Shots on target: ${state.stats.shotsOnTargetHome} – ${state.stats.shotsOnTargetAway}.`;

  return {
    winnerSide,
    winnerName,
    scoreline,
    wentToExtraTime,
    wentToPenalties,
    manOfTheMatch: motm,
    summaryLine,
    tacticalTakeaway: `${domTeam}. ${xGNote}`,
  };
}
