export type SimFormation = '4-3-3' | '4-2-3-1' | '3-5-2' | '4-4-2';

export type TacticalStyle =
  | 'High Press'
  | 'Tiki-Taka'
  | 'Counter-Attack'
  | 'Wing Play'
  | 'Balanced';

export type TacticalMentality = 'Defensive' | 'Balanced' | 'Attacking';

export type SimGameMode =
  | 'quick'
  | 'ucl'
  | 'epl'
  | 'laliga'
  | 'world_cup'
  | 'tournament'
  | 'dream';

export type RoleGroup = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface SimPlayer {
  id: string;
  name: string;
  shortName: string;
  jersey: number;
  position: string;
  roleGroup: RoleGroup;
  overall: number;
  stats: {
    pac: number;
    sho: number;
    pas: number;
    dri: number;
    def: number;
    phy: number;
  };
  nationality?: string;
  tsdbSearchName?: string;
}

export interface SimTeam {
  id: string;
  name: string;
  shortName: string;
  abbr: string;
  league: string;
  competitionTag: 'epl' | 'laliga' | 'ucl' | 'world_cup' | 'ksa' | 'lbn' | 'dream';
  isNational?: boolean;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  defaultFormation: SimFormation;
  tacticalStyle: TacticalStyle;
  ratings: {
    att: number;
    mid: number;
    def: number;
    gk: number;
    ovr: number;
  };
  starters: SimPlayer[];
  bench: SimPlayer[];
}

export type SimEventType =
  | 'kickoff'
  | 'goal'
  | 'penalty_goal'
  | 'penalty_miss'
  | 'var_goal'
  | 'var_disallowed'
  | 'var_penalty'
  | 'yellow'
  | 'red'
  | 'sub'
  | 'injury'
  | 'save'
  | 'halftime'
  | 'extratime_start'
  | 'fulltime'
  | 'shootout';

export interface SimEvent {
  id: string;
  minute: number;
  addedTime?: number;
  minuteLabel: string;
  type: SimEventType;
  side: 'home' | 'away' | 'neutral';
  teamName?: string;
  playerId?: string;
  playerName?: string;
  assistPlayerName?: string;
  secondaryPlayerName?: string;
  text: string;
  isKey: boolean;
}

export interface LivePlayerState {
  player: SimPlayer;
  side: 'home' | 'away';
  onPitch: boolean;
  subbedInAt?: number;
  subbedOutAt?: number;
  stamina: number;
  rating: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  tackles: number;
  yellowCards: number;
  redCard: boolean;
  injured: boolean;
}

export interface ShootoutKick {
  round: number;
  side: 'home' | 'away';
  takerName: string;
  scored: boolean;
}

export interface SimMatchStats {
  possessionHome: number;
  possessionAway: number;
  shotsHome: number;
  shotsAway: number;
  shotsOnTargetHome: number;
  shotsOnTargetAway: number;
  xgHome: number;
  xgAway: number;
  cornersHome: number;
  cornersAway: number;
  foulsHome: number;
  foulsAway: number;
  passesHome: number;
  passesAway: number;
  passAccHome: number;
  passAccAway: number;
  savesHome: number;
  savesAway: number;
  yellowHome: number;
  yellowAway: number;
  redHome: number;
  redAway: number;
}

export type MatchPhase =
  | 'PREMATCH'
  | 'FIRST_HALF'
  | 'HALFTIME'
  | 'SECOND_HALF'
  | 'EXTRA_TIME_1'
  | 'EXTRA_TIME_HT'
  | 'EXTRA_TIME_2'
  | 'PENALTY_SHOOTOUT'
  | 'FULLTIME';

export interface SimMatchState {
  matchId: string;
  mode: SimGameMode;
  competitionLabel: string;
  knockoutRules: boolean;
  phase: MatchPhase;
  minute: number;
  addedTime: number;
  stoppageTarget1: number;
  stoppageTarget2: number;
  homeTeam: SimTeam;
  awayTeam: SimTeam;
  formationHome: SimFormation;
  formationAway: SimFormation;
  styleHome: TacticalStyle;
  styleAway: TacticalStyle;
  mentalityHome: TacticalMentality;
  mentalityAway: TacticalMentality;
  homeScore: number;
  awayScore: number;
  homePenScore: number;
  awayPenScore: number;
  shootoutKicks: ShootoutKick[];
  subsUsedHome: number;
  subsUsedAway: number;
  stats: SimMatchStats;
  events: SimEvent[];
  homeRoster: LivePlayerState[];
  awayRoster: LivePlayerState[];
  ballPos: { x: number; y: number };
  momentumHome: number; // -50 to +50
  activeFlash?: {
    side: 'home' | 'away' | 'neutral';
    type: SimEventType;
    headline: string;
    subline: string;
  } | null;
  highlightedPlayerId?: string | null;
}

export interface SimMatchReport {
  winnerSide: 'home' | 'away' | 'draw';
  winnerName: string;
  scoreline: string;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
  manOfTheMatch: LivePlayerState;
  summaryLine: string;
  tacticalTakeaway: string;
}

export interface SavedSimRecord {
  id: string;
  userId?: string;
  mode: SimGameMode;
  competitionLabel: string;
  homeTeamId: string;
  homeName: string;
  awayTeamId: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  homePenScore?: number;
  awayPenScore?: number;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
  formationHome: SimFormation;
  formationAway: SimFormation;
  manOfTheMatch: string;
  motmRating: string;
  summaryLine: string;
  possessionHome: number;
  shotsHome: number;
  shotsAway: number;
  keyEvents: string[];
  createdAtMs: number;
}

export interface TournamentMatchSlot {
  id: string;
  round: 'QF' | 'SF' | 'FINAL';
  label: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore?: number;
  awayScore?: number;
  homePenScore?: number;
  awayPenScore?: number;
  winnerId: string | null;
  completed: boolean;
}

export interface CustomTournamentState {
  name: string;
  size: 4 | 8;
  teamIds: string[];
  slots: TournamentMatchSlot[];
  championId: string | null;
}
