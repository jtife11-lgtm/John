export type MatchStatus = 'LIVE' | 'HT' | 'FT' | 'UPCOMING' | 'POSTPONED';

export interface MatchEvent {
  id: string;
  minute: string;
  type: 'goal' | 'yellow' | 'red' | 'sub' | 'var' | 'other';
  teamId: string;
  teamName: string;
  playerName: string;
  assistName?: string;
  detail?: string;
}

export interface TeamSide {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo: string;
  score: number | null;
  form?: string;
  winner?: boolean;
}

export interface MatchItem {
  id: string;
  leagueId: string;
  leagueName: string;
  leagueCountry: string;
  leagueLogo: string;
  date: string;
  status: MatchStatus;
  clock: string;
  venue: string;
  city?: string;
  home: TeamSide;
  away: TeamSide;
  events: MatchEvent[];
  source: string;
}

export interface MatchStatRow {
  label: string;
  homeValue: string;
  awayValue: string;
  homeNum: number;
  awayNum: number;
}

export interface LineupPlayer {
  id: string;
  name: string;
  jersey: string;
  position: string;
  starter: boolean;
  formationPlace?: number;
  photo?: string;
  statsSummary?: string;
}

export interface TeamLineup {
  teamId: string;
  teamName: string;
  teamLogo?: string;
  formation: string;
  starters: LineupPlayer[];
  subs: LineupPlayer[];
}

export interface H2HMatch {
  date: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export interface MatchDetail {
  match: MatchItem;
  stats: MatchStatRow[];
  events: MatchEvent[];
  lineups: TeamLineup[];
  h2h: H2HMatch[];
  unavailableReason?: string;
}

export interface StandingRow {
  rank: number;
  teamId: string;
  teamName: string;
  teamLogo: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form?: string;
}

export interface PlayerLeader {
  id: string;
  name: string;
  teamName: string;
  teamLogo?: string;
  photo?: string;
  value: number;
  statLabel: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  source: string;
  category: string;
}

export interface SearchEntityResult {
  id: string;
  type: 'team' | 'player';
  name: string;
  subtitle: string;
  imageUrl?: string;
  country?: string;
  league?: string;
  position?: string;
  stats?: Record<string, string | number>;
}

export interface PlayerCareerClub {
  team: string;
  season: string;
  moveType?: string;
  badge?: string;
}

export interface PlayerHonourItem {
  trophy: string;
  season: string;
}

export interface PlayerProfileDetail {
  id: string;
  tsdbId?: string;
  name: string;
  nationality: string;
  birthDate?: string;
  age?: number | null;
  position: string;
  currentClub: string;
  shirtNumber?: string;
  height?: string;
  weight?: string;
  preferredFoot?: string;
  photo?: string;
  bannerUrl?: string;
  description?: string;
  careerHistory: PlayerCareerClub[];
  honours: PlayerHonourItem[];
  milestones: { title: string; season: string }[];
  verifiedMetrics: { label: string; value: string }[];
  unavailableMetrics: string[];
  source: string;
}

export type CardRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Icon';

export interface StrPlayerCard {
  id: string;
  name: string;
  shortName: string;
  club: string;
  nationalTeam: string;
  countryCode: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  roleTag: string;
  jerseyNumber: number;
  overall: number;
  stats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
  };
  rarity: CardRarity;
  era: 'Modern' | 'Classic';
  accentColors: [string, string];
  tsdbSearchName: string;
  summary: string;
}

export interface AiStructuredReport {
  summary: string;
  possessionAnalysis: string;
  shotsAnalysis: string;
  passingAnalysis: string;
  xgAnalysis: string;
  xgAvailable: boolean;
  playerRatings: { player: string; team: string; rating: string; note: string }[];
  attackingDefensiveAnalysis: string;
  keyEvents: string[];
  tacticalAnalysis: string;
  strengthsWeaknesses: { team: string; strengths: string[]; weaknesses: string[] }[];
  comparison: string;
  simpleExplanation: string;
  generatedReport: string;
  verifiedDataPoints: string[];
  disclaimer: string;
}
