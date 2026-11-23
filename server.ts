import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import type {
  AiStructuredReport,
  H2HMatch,
  LineupPlayer,
  MatchDetail,
  MatchEvent,
  MatchItem,
  MatchStatRow,
  MatchStatus,
  NewsArticle,
  PlayerLeader,
  PlayerProfileDetail,
  SearchEntityResult,
  StandingRow,
  TeamLineup,
} from './src/types/str.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '1mb' }));

// Simple in-memory TTL cache for upstream sports & news feeds
const cache = new Map<string, { expiresAt: number; data: unknown }>();
function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}
function setCached(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, data });
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'STR-SCORES/1.0',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Upstream HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'STR-SCORES/1.0',
        Accept: 'application/xml, text/xml, application/rss+xml, text/plain',
      },
    });
    if (!res.ok) {
      throw new Error(`Upstream HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

const LEAGUES = [
  { id: 'eng.1', name: 'Premier League', country: 'England', tsdbId: '4328' },
  { id: 'esp.1', name: 'La Liga', country: 'Spain', tsdbId: '4335' },
  { id: 'uefa.champions', name: 'UEFA Champions League', country: 'Europe', tsdbId: '4480' },
  { id: 'uefa.europa', name: 'UEFA Europa League', country: 'Europe', tsdbId: '4481' },
  { id: 'ita.1', name: 'Serie A', country: 'Italy', tsdbId: '4332' },
  { id: 'ger.1', name: 'Bundesliga', country: 'Germany', tsdbId: '4331' },
  { id: 'fra.1', name: 'Ligue 1', country: 'France', tsdbId: '4334' },
  { id: 'ksa.1', name: 'Saudi Pro League', country: 'Saudi Arabia', tsdbId: '4668' },
  { id: 'lbn.1', name: 'Lebanese Premier League', country: 'Lebanon', tsdbId: '4702' },
  { id: 'fifa.world', name: 'World Cup & International', country: 'International', tsdbId: '4429' },
  { id: 'uefa.nations', name: 'UEFA Nations League', country: 'Europe', tsdbId: '4568' },
];

function mapEspnStatus(state?: string, detail?: string): MatchStatus {
  const d = (detail || '').toUpperCase();
  if (d.includes('HT') || d.includes('HALFTIME')) return 'HT';
  if (state === 'in') return 'LIVE';
  if (state === 'post') return d.includes('POSTPONED') ? 'POSTPONED' : 'FT';
  return 'UPCOMING';
}

function parseEspnScoreboard(raw: any, leagueMeta: { id: string; name: string; country: string }): MatchItem[] {
  const leagueObj = raw?.leagues?.[0];
  const leagueLogo = leagueObj?.logos?.[0]?.href || '';
  const events: any[] = Array.isArray(raw?.events) ? raw.events : [];

  return events.map((ev): MatchItem => {
    const comp = ev?.competitions?.[0] || {};
    const competitors: any[] = Array.isArray(comp.competitors) ? comp.competitors : [];
    const homeRaw = competitors.find((c) => c.homeAway === 'home') || competitors[0] || {};
    const awayRaw = competitors.find((c) => c.homeAway === 'away') || competitors[1] || {};
    const statusObj = comp.status || ev.status || {};
    const statusType = statusObj.type || {};
    const mappedStatus = mapEspnStatus(statusType.state, statusType.shortDetail || statusType.description);

    const matchEvents: MatchEvent[] = (Array.isArray(comp.details) ? comp.details : []).map((d: any, idx: number) => {
      const typeText = (d?.type?.text || '').toLowerCase();
      let type: MatchEvent['type'] = 'other';
      if (d?.scoringPlay || typeText.includes('goal')) type = 'goal';
      else if (d?.redCard || typeText.includes('red')) type = 'red';
      else if (d?.yellowCard || typeText.includes('yellow')) type = 'yellow';
      else if (typeText.includes('sub')) type = 'sub';

      const athletes = Array.isArray(d?.athletesInvolved) ? d.athletesInvolved : [];
      return {
        id: `${ev.id}-ev-${idx}`,
        minute: d?.clock?.displayValue || '',
        type,
        teamId: String(d?.team?.id || ''),
        teamName: '',
        playerName: athletes[0]?.displayName || athletes[0]?.shortName || d?.type?.text || 'Event',
        assistName: athletes[1]?.displayName || undefined,
        detail: d?.type?.text || '',
      };
    });

    const parseScore = (val: unknown) => {
      if (mappedStatus === 'UPCOMING') return null;
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    };

    return {
      id: String(ev.id),
      leagueId: leagueMeta.id,
      leagueName: leagueObj?.name || leagueMeta.name,
      leagueCountry: leagueMeta.country,
      leagueLogo,
      date: ev.date || '',
      status: mappedStatus,
      clock: statusObj.displayClock || statusType.shortDetail || '',
      venue: comp?.venue?.fullName || '',
      city: comp?.venue?.address?.city || '',
      home: {
        id: String(homeRaw?.team?.id || ''),
        name: homeRaw?.team?.displayName || homeRaw?.team?.name || 'Home',
        shortName: homeRaw?.team?.shortDisplayName || homeRaw?.team?.name || 'Home',
        abbreviation: homeRaw?.team?.abbreviation || 'HOM',
        logo: homeRaw?.team?.logo || '',
        score: parseScore(homeRaw?.score),
        form: homeRaw?.form || '',
        winner: Boolean(homeRaw?.winner),
      },
      away: {
        id: String(awayRaw?.team?.id || ''),
        name: awayRaw?.team?.displayName || awayRaw?.team?.name || 'Away',
        shortName: awayRaw?.team?.shortDisplayName || awayRaw?.team?.name || 'Away',
        abbreviation: awayRaw?.team?.abbreviation || 'AWY',
        logo: awayRaw?.team?.logo || '',
        score: parseScore(awayRaw?.score),
        form: awayRaw?.form || '',
        winner: Boolean(awayRaw?.winner),
      },
      events: matchEvents,
      source: 'ESPN Soccer Feed',
    };
  });
}

async function fetchLebaneseLeagueMatches(dateDashed?: string): Promise<MatchItem[]> {
  try {
    const data = await fetchJsonWithTimeout<{ events?: any[] }>(
      'https://www.thesportsdb.com/api/v1/json/123/eventsnextleague.php?id=4702'
    );
    const past = await fetchJsonWithTimeout<{ events?: any[] }>(
      'https://www.thesportsdb.com/api/v1/json/123/eventspastleague.php?id=4702'
    );
    const combined = [...(past.events || []), ...(data.events || [])];
    const filtered = dateDashed
      ? combined.filter((e) => !dateDashed || e.dateEvent === dateDashed)
      : combined.slice(0, 12);

    const list = filtered.length > 0 ? filtered : combined.slice(0, 10);
    return list.map((ev): MatchItem => {
      const hasScore = ev.intHomeScore !== null && ev.intHomeScore !== undefined && ev.intHomeScore !== '';
      const statusStr = String(ev.strStatus || '').toUpperCase();
      let status: MatchStatus = 'UPCOMING';
      if (statusStr.includes('FT') || statusStr.includes('FINISHED') || (hasScore && !statusStr.includes('LIVE'))) {
        status = 'FT';
      } else if (statusStr.includes('LIVE') || statusStr.includes('1H') || statusStr.includes('2H')) {
        status = 'LIVE';
      } else if (statusStr.includes('HT')) {
        status = 'HT';
      }

      return {
        id: `tsdb-${ev.idEvent}`,
        leagueId: 'lbn.1',
        leagueName: ev.strLeague || 'Lebanese Premier League',
        leagueCountry: 'Lebanon',
        leagueLogo: ev.strLeagueBadge || '',
        date: ev.strTimestamp || `${ev.dateEvent}T${ev.strTime || '14:00:00'}Z`,
        status,
        clock: status === 'FT' ? 'FT' : ev.strProgress || ev.strTime?.slice(0, 5) || 'TBD',
        venue: ev.strVenue || 'Lebanon Stadium',
        city: ev.strCity || 'Beirut',
        home: {
          id: String(ev.idHomeTeam || ''),
          name: ev.strHomeTeam || 'Home Club',
          shortName: ev.strHomeTeam || 'Home',
          abbreviation: (ev.strHomeTeam || 'HOM').slice(0, 3).toUpperCase(),
          logo: ev.strHomeTeamBadge || '',
          score: hasScore ? Number(ev.intHomeScore) : null,
        },
        away: {
          id: String(ev.idAwayTeam || ''),
          name: ev.strAwayTeam || 'Away Club',
          shortName: ev.strAwayTeam || 'Away',
          abbreviation: (ev.strAwayTeam || 'AWY').slice(0, 3).toUpperCase(),
          logo: ev.strAwayTeamBadge || '',
          score: hasScore ? Number(ev.intAwayScore) : null,
        },
        events: [],
        source: 'TheSportsDB',
      };
    });
  } catch {
    return [];
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'STR SCORES API' });
});

app.get('/api/football/leagues', (_req, res) => {
  res.json({ leagues: LEAGUES });
});

app.get('/api/football/scoreboard', async (req, res) => {
  try {
    const rawDate = typeof req.query.date === 'string' ? req.query.date.replace(/[^0-9]/g, '') : '';
    const leagueParam = typeof req.query.league === 'string' ? req.query.league : 'all';
    const cacheKey = `scoreboard:${leagueParam}:${rawDate || 'today'}`;
    const cached = getCached<{ matches: MatchItem[]; errors: string[]; fetchedAt: string }>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const targetLeagues =
      leagueParam === 'all'
        ? LEAGUES.filter((l) => l.id !== 'lbn.1')
        : LEAGUES.filter((l) => l.id === leagueParam && l.id !== 'lbn.1');

    const dateQuery = rawDate ? `?dates=${rawDate}` : '';
    const dashedDate =
      rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : undefined;

    const errors: string[] = [];
    const results = await Promise.all(
      targetLeagues.map(async (league) => {
        try {
          const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(league.id)}/scoreboard${dateQuery}`;
          const data = await fetchJsonWithTimeout<any>(url, 7000);
          return parseEspnScoreboard(data, league);
        } catch (err) {
          errors.push(`${league.name}: ${err instanceof Error ? err.message : 'unavailable'}`);
          return [];
        }
      })
    );

    let allMatches = results.flat();
    if (leagueParam === 'all' || leagueParam === 'lbn.1') {
      const lbnMatches = await fetchLebaneseLeagueMatches(leagueParam === 'lbn.1' ? undefined : dashedDate);
      allMatches = [...allMatches, ...lbnMatches];
    }

    // Sort: LIVE/HT first, then UPCOMING, then FT
    const rankOrder: Record<MatchStatus, number> = { LIVE: 0, HT: 1, UPCOMING: 2, POSTPONED: 3, FT: 4 };
    allMatches.sort((a, b) => rankOrder[a.status] - rankOrder[b.status] || a.date.localeCompare(b.date));

    const payload = {
      matches: allMatches,
      errors,
      fetchedAt: new Date().toISOString(),
    };
    setCached(cacheKey, payload, 30_000);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({
      matches: [],
      errors: [error instanceof Error ? error.message : 'Failed to fetch live scoreboard'],
      fetchedAt: new Date().toISOString(),
    });
  }
});

app.get('/api/football/match/:leagueId/:eventId', async (req, res) => {
  try {
    const leagueId = req.params.leagueId;
    const eventId = req.params.eventId;

    if (!/^[a-z0-9.]+$/i.test(leagueId) || !/^[a-zA-Z0-9_-]+$/.test(eventId)) {
      return res.status(400).json({ error: 'Invalid match identifier' });
    }

    const cacheKey = `match:${leagueId}:${eventId}`;
    const cached = getCached<MatchDetail>(cacheKey);
    if (cached) return res.json(cached);

    if (eventId.startsWith('tsdb-')) {
      const realId = eventId.replace('tsdb-', '');
      const tsdb = await fetchJsonWithTimeout<{ events?: any[] }>(
        `https://www.thesportsdb.com/api/v1/json/123/lookupevent.php?id=${encodeURIComponent(realId)}`
      );
      const ev = tsdb.events?.[0];
      if (!ev) return res.status(404).json({ error: 'Match not found' });

      const hasScore = ev.intHomeScore !== null && ev.intHomeScore !== undefined && ev.intHomeScore !== '';
      const detail: MatchDetail = {
        match: {
          id: eventId,
          leagueId: 'lbn.1',
          leagueName: ev.strLeague || 'Lebanese Premier League',
          leagueCountry: 'Lebanon',
          leagueLogo: ev.strLeagueBadge || '',
          date: ev.strTimestamp || ev.dateEvent || '',
          status: hasScore ? 'FT' : 'UPCOMING',
          clock: hasScore ? 'FT' : ev.strTime?.slice(0, 5) || 'TBD',
          venue: ev.strVenue || 'Lebanon Stadium',
          city: ev.strCity || 'Beirut',
          home: {
            id: String(ev.idHomeTeam || ''),
            name: ev.strHomeTeam || 'Home',
            shortName: ev.strHomeTeam || 'Home',
            abbreviation: (ev.strHomeTeam || 'HOM').slice(0, 3).toUpperCase(),
            logo: ev.strHomeTeamBadge || '',
            score: hasScore ? Number(ev.intHomeScore) : null,
          },
          away: {
            id: String(ev.idAwayTeam || ''),
            name: ev.strAwayTeam || 'Away',
            shortName: ev.strAwayTeam || 'Away',
            abbreviation: (ev.strAwayTeam || 'AWY').slice(0, 3).toUpperCase(),
            logo: ev.strAwayTeamBadge || '',
            score: hasScore ? Number(ev.intAwayScore) : null,
          },
          events: [],
          source: 'TheSportsDB',
        },
        stats: [],
        events: [],
        lineups: [],
        h2h: [],
        unavailableReason: 'Detailed minute-by-minute telemetry and lineups are not provided by the upstream feed for this fixture.',
      };
      setCached(cacheKey, detail, 60_000);
      return res.json(detail);
    }

    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(leagueId)}/summary?event=${encodeURIComponent(eventId)}`;
    const raw = await fetchJsonWithTimeout<any>(url, 8000);

    const headerComp = raw?.header?.competitions?.[0] || {};
    const leagueMeta = LEAGUES.find((l) => l.id === leagueId) || { id: leagueId, name: raw?.header?.league?.name || leagueId, country: '' };
    const competitors: any[] = Array.isArray(headerComp.competitors) ? headerComp.competitors : [];
    const homeRaw = competitors.find((c) => c.homeAway === 'home') || competitors[0] || {};
    const awayRaw = competitors.find((c) => c.homeAway === 'away') || competitors[1] || {};
    const statusObj = headerComp.status || {};
    const statusType = statusObj.type || {};
    const status = mapEspnStatus(statusType.state, statusType.shortDetail || statusType.description);

    const parseScore = (val: unknown) => {
      if (status === 'UPCOMING') return null;
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    };

    const match: MatchItem = {
      id: eventId,
      leagueId,
      leagueName: raw?.header?.league?.name || leagueMeta.name,
      leagueCountry: leagueMeta.country,
      leagueLogo: raw?.header?.league?.logos?.[0]?.href || '',
      date: headerComp.date || '',
      status,
      clock: statusObj.displayClock || statusType.shortDetail || '',
      venue: raw?.gameInfo?.venue?.fullName || '',
      city: raw?.gameInfo?.venue?.address?.city || '',
      home: {
        id: String(homeRaw?.team?.id || ''),
        name: homeRaw?.team?.displayName || 'Home',
        shortName: homeRaw?.team?.shortDisplayName || homeRaw?.team?.name || 'Home',
        abbreviation: homeRaw?.team?.abbreviation || 'HOM',
        logo: homeRaw?.team?.logos?.[0]?.href || '',
        score: parseScore(homeRaw?.score),
        winner: Boolean(homeRaw?.winner),
      },
      away: {
        id: String(awayRaw?.team?.id || ''),
        name: awayRaw?.team?.displayName || 'Away',
        shortName: awayRaw?.team?.shortDisplayName || awayRaw?.team?.name || 'Away',
        abbreviation: awayRaw?.team?.abbreviation || 'AWY',
        logo: awayRaw?.team?.logos?.[0]?.href || '',
        score: parseScore(awayRaw?.score),
        winner: Boolean(awayRaw?.winner),
      },
      events: [],
      source: 'ESPN Match Center',
    };

    // Team Statistics
    const boxTeams: any[] = Array.isArray(raw?.boxscore?.teams) ? raw.boxscore.teams : [];
    const homeBox = boxTeams.find((t) => String(t?.team?.id) === match.home.id) || boxTeams[0];
    const awayBox = boxTeams.find((t) => String(t?.team?.id) === match.away.id) || boxTeams[1];
    const stats: MatchStatRow[] = [];
    if (homeBox?.statistics && awayBox?.statistics) {
      for (const s of homeBox.statistics) {
        const awayStat = awayBox.statistics.find((a: any) => a.name === s.name || a.label === s.label);
        if (awayStat) {
          const hVal = String(s.displayValue ?? '0');
          const aVal = String(awayStat.displayValue ?? '0');
          stats.push({
            label: s.label || s.name,
            homeValue: hVal,
            awayValue: aVal,
            homeNum: parseFloat(hVal.replace('%', '')) || 0,
            awayNum: parseFloat(aVal.replace('%', '')) || 0,
          });
        }
      }
    }

    // Events (Goals, Cards, Subs)
    const keyEvents: any[] = Array.isArray(raw?.keyEvents) ? raw.keyEvents : [];
    const events: MatchEvent[] = keyEvents.map((ke, idx) => {
      const txt = (ke?.type?.text || ke?.text || '').toLowerCase();
      let type: MatchEvent['type'] = 'other';
      if (ke?.scoringPlay || txt.includes('goal')) type = 'goal';
      else if (txt.includes('red card')) type = 'red';
      else if (txt.includes('yellow card')) type = 'yellow';
      else if (txt.includes('substitution')) type = 'sub';

      const parts = Array.isArray(ke?.participants) ? ke.participants : [];
      return {
        id: `${eventId}-ke-${idx}`,
        minute: ke?.clock?.displayValue || '',
        type,
        teamId: String(ke?.team?.id || ''),
        teamName: ke?.team?.displayName || '',
        playerName: parts[0]?.athlete?.displayName || ke?.shortText || ke?.text || 'Event',
        assistName: parts[1]?.athlete?.displayName || undefined,
        detail: ke?.type?.text || ke?.text || '',
      };
    });

    // Lineups & Formations
    const rosters: any[] = Array.isArray(raw?.rosters) ? raw.rosters : [];
    const lineups: TeamLineup[] = rosters.map((r) => {
      const entries: any[] = Array.isArray(r.roster) ? r.roster : [];
      const mapped: LineupPlayer[] = entries.map((p) => {
        const fp = Number(p?.formationPlace || 0);
        return {
          id: String(p?.athlete?.id || p?.athlete?.displayName || ''),
          name: p?.athlete?.displayName || 'Player',
          jersey: String(p?.jersey || ''),
          position: p?.position?.abbreviation || p?.position?.name || '',
          starter: Boolean(p?.starter),
          formationPlace: Number.isFinite(fp) && fp > 0 ? fp : undefined,
          photo: p?.athlete?.headshot?.href || '',
        };
      });
      const rTeamId = String(r?.team?.id || '');
      const resolvedLogo =
        r?.team?.logo ||
        r?.team?.logos?.[0]?.href ||
        (rTeamId === match.home.id ? match.home.logo : match.away.logo) ||
        '';
      return {
        teamId: rTeamId,
        teamName: r?.team?.displayName || '',
        teamLogo: resolvedLogo,
        formation: r?.formation || 'Formation unavailable',
        starters: mapped.filter((p) => p.starter),
        subs: mapped.filter((p) => !p.starter),
      };
    });

    // Head-to-head
    const h2hRaw: any[] = Array.isArray(raw?.headToHeadGames?.[0]?.events) ? raw.headToHeadGames[0].events : [];
    const h2h: H2HMatch[] = h2hRaw.slice(0, 6).map((g) => ({
      date: g?.gameDate || '',
      competition: g?.leagueName || leagueMeta.name,
      homeTeam: g?.homeTeam?.displayName || g?.opponent?.displayName || 'Home',
      awayTeam: g?.awayTeam?.displayName || 'Away',
      homeScore: Number(g?.homeTeamScore ?? 0),
      awayScore: Number(g?.awayTeamScore ?? 0),
    }));

    const detail: MatchDetail = {
      match,
      stats,
      events,
      lineups,
      h2h,
    };
    setCached(cacheKey, detail, 30_000);
    return res.json(detail);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Unable to retrieve match summary from upstream API',
    });
  }
});

app.get('/api/football/standings/:leagueId', async (req, res) => {
  try {
    const leagueId = req.params.leagueId;
    if (!/^[a-z0-9.]+$/i.test(leagueId)) {
      return res.status(400).json({ error: 'Invalid league ID' });
    }
    const cacheKey = `standings:${leagueId}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return res.json(cached);

    if (leagueId === 'lbn.1') {
      const tsdb = await fetchJsonWithTimeout<{ table?: any[] }>(
        'https://www.thesportsdb.com/api/v1/json/123/lookuptable.php?l=4702&s=2025-2026'
      ).catch(() => ({ table: [] }));
      const rows: StandingRow[] = (tsdb.table || []).map((t) => ({
        rank: Number(t.intRank || 0),
        teamId: String(t.idTeam || ''),
        teamName: t.strTeam || '',
        teamLogo: t.strBadge || '',
        played: Number(t.intPlayed || 0),
        wins: Number(t.intWin || 0),
        draws: Number(t.intDraw || 0),
        losses: Number(t.intLoss || 0),
        goalsFor: Number(t.intGoalsFor || 0),
        goalsAgainst: Number(t.intGoalsAgainst || 0),
        goalDiff: Number(t.intGoalDifference || 0),
        points: Number(t.intPoints || 0),
        form: t.strForm || '',
      }));
      const payload = { leagueId, standings: rows, scorers: [], assists: [], source: 'TheSportsDB' };
      setCached(cacheKey, payload, 300_000);
      return res.json(payload);
    }

    const [standingsRaw, leadersRaw] = await Promise.all([
      fetchJsonWithTimeout<any>(`https://site.api.espn.com/apis/v2/sports/soccer/${encodeURIComponent(leagueId)}/standings`).catch(() => null),
      fetchJsonWithTimeout<any>(`https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(leagueId)}/leaders`).catch(() => null),
    ]);

    const entries: any[] =
      standingsRaw?.children?.[0]?.standings?.entries ||
      standingsRaw?.standings?.entries ||
      [];

    const getStat = (statsList: any[], name: string) => {
      const found = statsList?.find((s: any) => s.name === name);
      return Number(found?.value ?? 0);
    };

    const standings: StandingRow[] = entries.map((e, idx) => {
      const st = Array.isArray(e.stats) ? e.stats : [];
      return {
        rank: getStat(st, 'rank') || idx + 1,
        teamId: String(e?.team?.id || ''),
        teamName: e?.team?.displayName || e?.team?.name || 'Team',
        teamLogo: e?.team?.logos?.[0]?.href || '',
        played: getStat(st, 'gamesPlayed'),
        wins: getStat(st, 'wins'),
        draws: getStat(st, 'ties'),
        losses: getStat(st, 'losses'),
        goalsFor: getStat(st, 'pointsFor'),
        goalsAgainst: getStat(st, 'pointsAgainst'),
        goalDiff: getStat(st, 'pointDifferential'),
        points: getStat(st, 'points'),
      };
    });

    standings.sort((a, b) => a.rank - b.rank);

    const categories: any[] = Array.isArray(leadersRaw?.leaders) ? leadersRaw.leaders : [];
    const mapLeaders = (catName: string, label: string): PlayerLeader[] => {
      const cat = categories.find((c) => (c.name || '').toLowerCase().includes(catName));
      const list: any[] = Array.isArray(cat?.leaders) ? cat.leaders : [];
      return list.slice(0, 10).map((l) => ({
        id: String(l?.athlete?.id || l?.athlete?.displayName || ''),
        name: l?.athlete?.displayName || 'Player',
        teamName: l?.team?.displayName || '',
        teamLogo: l?.team?.logos?.[0]?.href || '',
        photo: l?.athlete?.headshot?.href || '',
        value: Number(l?.value ?? 0),
        statLabel: label,
      }));
    };

    const scorers = mapLeaders('goal', 'Goals');
    const assists = mapLeaders('assist', 'Assists');

    const payload = {
      leagueId,
      standings,
      scorers,
      assists,
      source: 'ESPN Standings & Leaders',
    };
    setCached(cacheKey, payload, 180_000);
    return res.json(payload);
  } catch (error) {
    return res.status(502).json({
      leagueId: req.params.leagueId,
      standings: [],
      scorers: [],
      assists: [],
      error: error instanceof Error ? error.message : 'Standings unavailable',
    });
  }
});

app.get('/api/football/search', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }
    const cacheKey = `search:${q.toLowerCase()}`;
    const cached = getCached<{ results: SearchEntityResult[] }>(cacheKey);
    if (cached) return res.json(cached);

    const [teamsRes, playersRes] = await Promise.all([
      fetchJsonWithTimeout<{ teams?: any[] }>(
        `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(q)}`
      ).catch(() => ({ teams: [] })),
      fetchJsonWithTimeout<{ player?: any[] }>(
        `https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${encodeURIComponent(q)}`
      ).catch(() => ({ player: [] })),
    ]);

    const teamResults: SearchEntityResult[] = (teamsRes.teams || [])
      .filter((t) => (t.strSport || '').toLowerCase() === 'soccer')
      .slice(0, 8)
      .map((t) => ({
        id: `team-${t.idTeam}`,
        type: 'team',
        name: t.strTeam,
        subtitle: `${t.strLeague || 'Football Club'} · ${t.strCountry || ''}`,
        imageUrl: t.strBadge || t.strLogo || '',
        country: t.strCountry || '',
        league: t.strLeague || '',
        stats: {
          Formed: t.intFormedYear || 'N/A',
          Stadium: t.strStadium || 'N/A',
          Capacity: t.intStadiumCapacity || 'N/A',
        },
      }));

    const playerResults: SearchEntityResult[] = (playersRes.player || [])
      .filter((p) => (p.strSport || '').toLowerCase() === 'soccer')
      .slice(0, 8)
      .map((p) => ({
        id: `player-${p.idPlayer}`,
        type: 'player',
        name: p.strPlayer,
        subtitle: `${p.strTeam || 'Free Agent'} · ${p.strPosition || 'Footballer'}`,
        imageUrl: p.strCutout || p.strThumb || '',
        country: p.strNationality || '',
        position: p.strPosition || '',
        stats: {
          Club: p.strTeam || 'N/A',
          Nationality: p.strNationality || 'N/A',
          Height: p.strHeight || 'N/A',
          Weight: p.strWeight || 'N/A',
          Foot: p.strSide || 'N/A',
        },
      }));

    const payload = { results: [...teamResults, ...playerResults] };
    setCached(cacheKey, payload, 300_000);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ results: [], error: 'Search failed' });
  }
});

// Live Football Player Directory Search (TheSportsDB)
app.get('/api/football/players', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length < 2) {
      return res.json({ players: [] });
    }
    const cacheKey = `players:list:${q.toLowerCase()}`;
    const cached = getCached<{ players: any[] }>(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchJsonWithTimeout<{ player?: any[] }>(
      `https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${encodeURIComponent(q)}`,
      8000
    ).catch(() => ({ player: [] }));

    const players = (data.player || [])
      .filter((p) => (p.strSport || '').toLowerCase() === 'soccer')
      .slice(0, 16)
      .map((p) => ({
        id: String(p.idPlayer),
        name: p.strPlayer,
        nationality: p.strNationality || 'Unknown',
        currentClub: p.strTeam || 'Free Agent / Retired',
        position: p.strPosition || 'Footballer',
        photo: p.strCutout || p.strThumb || p.strRender || '',
        birthDate: p.dateBorn || '',
        shirtNumber: p.strNumber || '',
      }));

    const payload = { players };
    setCached(cacheKey, payload, 300_000);
    return res.json(payload);
  } catch {
    return res.status(500).json({ players: [], error: 'Player search unavailable' });
  }
});

// Full Verified Player Profile Lookup (Bio, Career History, Honours, Milestones)
app.get('/api/football/player/:playerKey', async (req, res) => {
  try {
    const rawKey = decodeURIComponent(req.params.playerKey || '').trim();
    if (!rawKey) {
      return res.status(400).json({ error: 'Player identifier required' });
    }

    const cacheKey = `player:detail:${rawKey.toLowerCase()}`;
    const cached = getCached<PlayerProfileDetail>(cacheKey);
    if (cached) return res.json(cached);

    let playerObj: any = null;
    if (/^\d+$/.test(rawKey)) {
      const lookup = await fetchJsonWithTimeout<{ players?: any[] }>(
        `https://www.thesportsdb.com/api/v1/json/123/lookupplayer.php?id=${encodeURIComponent(rawKey)}`,
        8000
      ).catch(() => ({ players: [] }));
      playerObj = lookup.players?.[0] || null;
    } else {
      const cleanName = rawKey.replace(/^name:/i, '').trim();
      const search = await fetchJsonWithTimeout<{ player?: any[] }>(
        `https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${encodeURIComponent(cleanName)}`,
        8000
      ).catch(() => ({ player: [] }));
      const soccerMatches = (search.player || []).filter(
        (p) => (p.strSport || '').toLowerCase() === 'soccer'
      );
      playerObj =
        soccerMatches.find((p) => String(p.strPlayer).toLowerCase() === cleanName.toLowerCase()) ||
        soccerMatches[0] ||
        null;
    }

    if (!playerObj) {
      return res.status(404).json({ error: 'Player profile not found in upstream sports directory.' });
    }

    const tsdbId = String(playerObj.idPlayer);
    const [formerRes, honoursRes, milestonesRes] = await Promise.all([
      fetchJsonWithTimeout<{ formertems?: any[]; formerteams?: any[] }>(
        `https://www.thesportsdb.com/api/v1/json/123/lookupformerteams.php?id=${encodeURIComponent(tsdbId)}`,
        7000
      ).catch(() => ({ formerteams: [] })),
      fetchJsonWithTimeout<{ honours?: any[] }>(
        `https://www.thesportsdb.com/api/v1/json/123/lookuphonours.php?id=${encodeURIComponent(tsdbId)}`,
        7000
      ).catch(() => ({ honours: [] })),
      fetchJsonWithTimeout<{ milestones?: any[] }>(
        `https://www.thesportsdb.com/api/v1/json/123/lookupmilestones.php?id=${encodeURIComponent(tsdbId)}`,
        7000
      ).catch(() => ({ milestones: [] })),
    ]);

    let age: number | null = null;
    if (playerObj.dateBorn) {
      const birth = new Date(playerObj.dateBorn);
      if (!Number.isNaN(birth.getTime())) {
        const diff = Date.now() - birth.getTime();
        age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
      }
    }

    const formerList = (formerRes as any).formertems || formerRes.formerteams || [];
    const careerHistory = formerList.map((t: any) => ({
      team: t.strFormerTeam || 'Club',
      season: [t.strJoined, t.strDeparted].filter(Boolean).join(' – ') || 'Former spell',
      moveType: t.strMoveType || '',
      badge: t.strTeamBadge || '',
    }));

    const honours = (honoursRes.honours || []).slice(0, 20).map((h: any) => ({
      trophy: h.strHonour || 'Honour',
      season: h.strSeason || '',
    }));

    const milestones = (milestonesRes.milestones || []).slice(0, 12).map((m: any) => ({
      title: m.strMilestone || 'Career Milestone',
      season: m.dateMilestone || '',
    }));

    const verifiedMetrics: { label: string; value: string }[] = [];
    if (playerObj.strNationality) verifiedMetrics.push({ label: 'Nationality', value: playerObj.strNationality });
    if (playerObj.strPosition) verifiedMetrics.push({ label: 'Position', value: playerObj.strPosition });
    if (playerObj.strTeam) verifiedMetrics.push({ label: 'Current Club', value: playerObj.strTeam });
    if (playerObj.strNumber) verifiedMetrics.push({ label: 'Shirt Number', value: `#${playerObj.strNumber}` });
    if (playerObj.strHeight) verifiedMetrics.push({ label: 'Height', value: playerObj.strHeight });
    if (playerObj.strWeight) verifiedMetrics.push({ label: 'Weight', value: playerObj.strWeight });
    if (playerObj.strSide) verifiedMetrics.push({ label: 'Preferred Foot', value: playerObj.strSide });
    if (playerObj.dateBorn) verifiedMetrics.push({ label: 'Born', value: playerObj.dateBorn });

    const profile: PlayerProfileDetail = {
      id: tsdbId,
      tsdbId,
      name: playerObj.strPlayer || rawKey,
      nationality: playerObj.strNationality || 'Unavailable',
      birthDate: playerObj.dateBorn || undefined,
      age,
      position: playerObj.strPosition || 'Footballer',
      currentClub: playerObj.strTeam || 'Free Agent / Retired',
      shirtNumber: playerObj.strNumber || undefined,
      height: playerObj.strHeight || undefined,
      weight: playerObj.strWeight || undefined,
      preferredFoot: playerObj.strSide || undefined,
      photo: playerObj.strCutout || playerObj.strThumb || playerObj.strRender || '',
      bannerUrl: playerObj.strFanart1 || playerObj.strBanner || '',
      description: playerObj.strDescriptionEN || '',
      careerHistory,
      honours,
      milestones,
      verifiedMetrics,
      unavailableMetrics: [
        'Live per-90 xG & progressive passes require opt-in match-level tracking feeds and are not synthesized.',
      ],
      source: 'TheSportsDB Verified Player Registry',
    };

    setCached(cacheKey, profile, 300_000);
    return res.json(profile);
  } catch {
    return res.status(502).json({ error: 'Unable to load player profile right now.' });
  }
});

// Server-controlled fair trading validator for STR Player Cards
app.post('/api/cards/validate-trade', (req, res) => {
  const { offeredRarity, offeredOvr, requestedRarity, requestedOvr } = req.body as {
    offeredRarity?: string;
    offeredOvr?: number;
    requestedRarity?: string;
    requestedOvr?: number;
  };
  const rankMap: Record<string, number> = {
    Common: 1,
    Rare: 2,
    Epic: 3,
    Legendary: 4,
    Icon: 5,
  };
  const r1 = rankMap[offeredRarity || ''] || 0;
  const r2 = rankMap[requestedRarity || ''] || 0;
  if (!r1 || !r2 || typeof offeredOvr !== 'number' || typeof requestedOvr !== 'number') {
    return res.status(400).json({ fair: false, reason: 'Invalid card attributes for trade validation.' });
  }
  const rarityDiff = Math.abs(r1 - r2);
  const ovrDiff = Math.abs(offeredOvr - requestedOvr);
  const fair = rarityDiff <= 1 && ovrDiff <= 7;
  const fairnessScore = Math.max(10, Math.min(100, 100 - rarityDiff * 25 - ovrDiff * 4));
  return res.json({
    fair,
    fairnessScore,
    reason: fair
      ? `Fair swap verified (${offeredOvr} OVR ${offeredRarity} ↔ ${requestedOvr} OVR ${requestedRarity}).`
      : `Unbalanced trade blocked by fair-play rules: rarity gap (${rarityDiff} tiers) or OVR gap (${ovrDiff}) exceeds limit (max 1 tier & 7 OVR).`,
  });
});

// Helper to parse RSS XML safely without external heavy deps
function parseRssItems(xml: string, sourceName: string, category: string): NewsArticle[] {
  const items: NewsArticle[] = [];
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (let i = 0; i < Math.min(itemMatches.length, 14); i++) {
    const block = itemMatches[i];
    const extractTag = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      if (!m) return '';
      return m[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };
    const title = extractTag('title');
    const url = extractTag('link');
    const description = extractTag('description') || title;
    const pubDate = extractTag('pubDate') || new Date().toISOString();
    const mediaMatch =
      block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) ||
      block.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
      block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
    if (title && url) {
      items.push({
        id: `${sourceName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${i}-${Buffer.from(url).toString('base64').slice(0, 12)}`,
        title,
        description: description.slice(0, 260),
        url,
        imageUrl: mediaMatch?.[1] || '',
        publishedAt: pubDate,
        source: sourceName,
        category,
      });
    }
  }
  return items;
}

app.get('/api/news/football', async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';
    const cacheKey = `news:football:${category}`;
    const cached = getCached<{ articles: NewsArticle[]; errors: string[] }>(cacheKey);
    if (cached) return res.json(cached);

    const errors: string[] = [];
    const articles: NewsArticle[] = [];

    const [espnRes, bbcRes, lebaneseRes] = await Promise.all([
      fetchJsonWithTimeout<any>('https://site.api.espn.com/apis/site/v2/sports/soccer/all/news?limit=20').catch((e) => {
        errors.push(`ESPN News: ${e.message}`);
        return null;
      }),
      fetchTextWithTimeout('https://feeds.bbci.co.uk/sport/football/rss.xml').catch((e) => {
        errors.push(`BBC Sport: ${e.message}`);
        return '';
      }),
      fetchTextWithTimeout(
        'https://news.google.com/rss/search?q=Lebanese+football+OR+Al+Ahed+OR+Al+Ansar+OR+Nejmeh+SC&hl=en-US&gl=US&ceid=US:en'
      ).catch((e) => {
        errors.push(`Lebanese Football Feed: ${e.message}`);
        return '';
      }),
    ]);

    if (espnRes?.articles) {
      for (const a of espnRes.articles) {
        const headline = a.headline || '';
        const cat =
          /transfer|rumour|rumor|deal|sign/i.test(headline)
            ? 'Transfers'
            : /world cup|national|fifa|uefa nations/i.test(headline)
            ? 'International'
            : 'Breaking';
        articles.push({
          id: `espn-${a.dataSourceIdentifier || a.id || Math.random().toString(36).slice(2)}`,
          title: headline,
          description: a.description || '',
          url: a?.links?.web?.href || 'https://www.espn.com/soccer/',
          imageUrl: a?.images?.[0]?.url || '',
          publishedAt: a.published || new Date().toISOString(),
          source: 'ESPN Soccer',
          category: cat,
        });
      }
    }

    if (bbcRes) {
      articles.push(...parseRssItems(bbcRes, 'BBC Sport Football', 'Clubs'));
    }

    if (lebaneseRes) {
      articles.push(...parseRssItems(lebaneseRes, 'Google News · Lebanon Football', 'Lebanese'));
    }

    const filtered =
      category === 'all'
        ? articles
        : articles.filter((a) => a.category.toLowerCase() === category.toLowerCase());

    const payload = { articles: filtered, errors };
    setCached(cacheKey, payload, 180_000);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ articles: [], errors: ['Failed to load football news'] });
  }
});

app.get('/api/news/gaming', async (req, res) => {
  try {
    const game = typeof req.query.game === 'string' ? req.query.game : 'all';
    const cacheKey = `news:gaming:${game}`;
    const cached = getCached<{ articles: NewsArticle[]; errors: string[] }>(cacheKey);
    if (cached) return res.json(cached);

    const gameQueries: Record<string, string> = {
      all: 'Minecraft OR Roblox OR "GTA 6" OR "Rocket League" OR Fortnite OR PUBG',
      minecraft: 'Minecraft update news',
      roblox: 'Roblox update news',
      gta: '"GTA 6" OR "Grand Theft Auto"',
      'rocket-league': '"Rocket League" esports OR update',
      fortnite: 'Fortnite update news',
      pubg: 'PUBG update OR esports',
    };

    const queryStr = gameQueries[game] || gameQueries.all;
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(queryStr)}&hl=en-US&gl=US&ceid=US:en`;
    const errors: string[] = [];
    let articles: NewsArticle[] = [];

    try {
      const xml = await fetchTextWithTimeout(rssUrl, 8000);
      articles = parseRssItems(xml, 'Gaming Press Feed', game === 'all' ? 'Gaming' : game).map((a) => {
        const lower = a.title.toLowerCase();
        let detected = 'Gaming';
        if (lower.includes('minecraft')) detected = 'Minecraft';
        else if (lower.includes('roblox')) detected = 'Roblox';
        else if (lower.includes('gta') || lower.includes('grand theft')) detected = 'GTA';
        else if (lower.includes('rocket league')) detected = 'Rocket League';
        else if (lower.includes('fortnite')) detected = 'Fortnite';
        else if (lower.includes('pubg')) detected = 'PUBG';
        return { ...a, category: detected };
      });
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Gaming news feed unavailable');
    }

    const payload = { articles, errors };
    setCached(cacheKey, payload, 300_000);
    return res.json(payload);
  } catch {
    return res.status(500).json({ articles: [], errors: ['Failed to fetch gaming news'] });
  }
});

// STR AI Match Center & Analyst Endpoint (Server-Side Gemini API)
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({
        error: 'Gemini API key is not configured on the server.',
      });
    }

    const { prompt, mode, matchContext, language } = req.body as {
      prompt?: string;
      mode?: 'explain_stats' | 'summarize_events' | 'preview' | 'qa' | 'full_report';
      matchContext?: Record<string, unknown>;
      language?: 'en' | 'ar';
    };

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 2 || prompt.length > 2000) {
      return res.status(400).json({ error: 'Please provide a valid football question (2–2000 characters).' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const langInstruction =
      language === 'ar'
        ? 'Respond in clear, natural Arabic suitable for football fans.'
        : 'Respond in clear, concise, accessible English.';

    if (mode === 'full_report') {
      const reportSystem = [
        'You are the STR AI Match Analyst inside STR SCORES.',
        langInstruction,
        'Strictly analyze ONLY the real football API telemetry provided in matchContext.',
        'NEVER invent match scores, shots, passing percentages, or Expected Goals (xG) numbers if they are not present in matchContext.',
        'If xG or passing accuracy is missing from matchContext.stats, explicitly state that it is unavailable in the upstream live feed.',
        'Return ONLY a valid JSON object matching the exact keys requested, no markdown code fences.',
      ].join(' ');

      const schemaPrompt = `Analyze this real match telemetry and return ONLY valid JSON with these exact keys:
{
  "summary": "2-3 sentence executive match summary strictly based on facts",
  "possessionAnalysis": "Possession breakdown from real stats or note if unavailable",
  "shotsAnalysis": "Shots & shots on target breakdown from real stats or note if unavailable",
  "passingAnalysis": "Passing accuracy & distribution note based on real stats or mark unavailable",
  "xgAnalysis": "Expected Goals (xG) ONLY if present in telemetry; otherwise explicitly write 'Expected Goals (xG) is unavailable in the current upstream feed for this match.'",
  "xgAvailable": false,
  "playerRatings": [{"player": "Name from lineups/events", "team": "Club", "rating": "AI 7.8/10", "note": "Why based on real events/lineup"}],
  "attackingDefensiveAnalysis": "Team attacking and defensive shape analysis",
  "keyEvents": ["Minute + real event summary from matchContext.events"],
  "tacticalAnalysis": "Formations & tactical battle overview",
  "strengthsWeaknesses": [{"team": "Home Team", "strengths": ["..."], "weaknesses": ["..."]}, {"team": "Away Team", "strengths": ["..."], "weaknesses": ["..."]}],
  "comparison": "Side-by-side team comparison",
  "simpleExplanation": "Plain-language explanation of what the stats mean for casual fans",
  "generatedReport": "Polished 2-paragraph editorial match report",
  "verifiedDataPoints": ["Bullet list of exact verified numbers from matchContext"]
}

Verified Match Telemetry JSON:
${JSON.stringify(matchContext || {}).slice(0, 7500)}

Additional User Focus:
${prompt.trim()}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: schemaPrompt,
        config: {
          systemInstruction: reportSystem,
          responseMimeType: 'application/json',
        },
      });

      const rawText = (response.text || '{}').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      let structured: AiStructuredReport | null = null;
      try {
        const parsed = JSON.parse(rawText);
        structured = {
          summary: String(parsed.summary || ''),
          possessionAnalysis: String(parsed.possessionAnalysis || 'Unavailable in current feed.'),
          shotsAnalysis: String(parsed.shotsAnalysis || 'Unavailable in current feed.'),
          passingAnalysis: String(parsed.passingAnalysis || 'Unavailable in current feed.'),
          xgAnalysis: String(parsed.xgAnalysis || 'Expected Goals (xG) unavailable in upstream feed.'),
          xgAvailable: Boolean(parsed.xgAvailable),
          playerRatings: Array.isArray(parsed.playerRatings) ? parsed.playerRatings.slice(0, 12) : [],
          attackingDefensiveAnalysis: String(parsed.attackingDefensiveAnalysis || ''),
          keyEvents: Array.isArray(parsed.keyEvents) ? parsed.keyEvents.slice(0, 15) : [],
          tacticalAnalysis: String(parsed.tacticalAnalysis || ''),
          strengthsWeaknesses: Array.isArray(parsed.strengthsWeaknesses) ? parsed.strengthsWeaknesses.slice(0, 2) : [],
          comparison: String(parsed.comparison || ''),
          simpleExplanation: String(parsed.simpleExplanation || ''),
          generatedReport: String(parsed.generatedReport || ''),
          verifiedDataPoints: Array.isArray(parsed.verifiedDataPoints) ? parsed.verifiedDataPoints.slice(0, 12) : [],
          disclaimer:
            language === 'ar'
              ? 'تقرير وتحليلات وتقييمات مولّدة بالذكاء الاصطناعي استناداً فقط إلى البيانات الموثّقة المتاحة.'
              : 'AI-Generated Match Report & Ratings — Strictly separated from verified official API telemetry.',
        };
      } catch {
        structured = null;
      }

      return res.json({
        analysis: structured?.generatedReport || rawText,
        structuredReport: structured,
        model: 'gemini-4-hydrogen',
        disclaimer:
          language === 'ar'
            ? 'تحليل مولّد بالذكاء الاصطناعي — يعتمد فقط على البيانات الموثّقة المعروضة ولا يمثّل إحصاءً رسمياً.'
            : 'AI-Generated Analysis — Clearly distinct from verified live match telemetry.',
      });
    }

    const systemInstruction = [
      'You are the STR AI Match Analyst inside STR SCORES.',
      langInstruction,
      'Be neutral, accurate, and insightful. Never invent live scores, player transfers, or stats not present in the provided match context.',
      'If matchContext is provided, clearly separate VERIFIED DATA FACTS from AI-GENERATED ANALYSIS.',
      'Keep explanations crisp and easy to read with short paragraphs or bullet points.',
    ].join(' ');

    const fullContents = matchContext
      ? `Task Mode: ${mode || 'qa'}\nVerified Match/Team Context (Real Telemetry):\n${JSON.stringify(matchContext).slice(0, 7000)}\n\nUser Question / Request:\n${prompt.trim()}`
      : prompt.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: fullContents,
      config: {
        systemInstruction,
      },
    });

    return res.json({
      analysis: response.text || 'No analysis generated.',
      model: 'gemini-4-hydrogen',
      disclaimer:
        language === 'ar'
          ? 'تحليل مولّد بالذكاء الاصطناعي — يعتمد فقط على البيانات الموثّقة المعروضة ولا يمثّل إحصاءً رسمياً.'
          : 'AI-Generated Analysis — Clearly distinct from verified live match telemetry.',
    });
  } catch (error: any) {
    const status = error?.status === 403 || error?.status === 400 ? error.status : 500;
    return res.status(status).json({
      error: error?.message || 'Unable to generate AI match analysis right now.',
    });
  }
});

// HTTP + WebSocket Server for Real-Time Presence, Typing & WebRTC Signaling
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

interface ClientMeta {
  ws: WebSocket;
  uid?: string;
  roomId?: string;
  displayName?: string;
}
const wsClients = new Map<WebSocket, ClientMeta>();

function broadcastRoom(roomId: string, payload: unknown, exclude?: WebSocket) {
  const raw = JSON.stringify(payload);
  for (const [sock, meta] of wsClients.entries()) {
    if (sock !== exclude && sock.readyState === WebSocket.OPEN && meta.roomId === roomId) {
      sock.send(raw);
    }
  }
}

function sendToUser(targetUid: string, payload: unknown) {
  const raw = JSON.stringify(payload);
  for (const [sock, meta] of wsClients.entries()) {
    if (sock.readyState === WebSocket.OPEN && meta.uid === targetUid) {
      sock.send(raw);
    }
  }
}

wss.on('connection', (ws) => {
  wsClients.set(ws, { ws });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const meta = wsClients.get(ws);
      if (!meta) return;

      if (msg.type === 'auth') {
        meta.uid = typeof msg.uid === 'string' ? msg.uid.slice(0, 128) : undefined;
        meta.displayName = typeof msg.displayName === 'string' ? msg.displayName.slice(0, 64) : 'Supporter';
        return;
      }

      if (msg.type === 'join_room' && typeof msg.roomId === 'string') {
        meta.roomId = msg.roomId.slice(0, 128);
        return;
      }

      if (msg.type === 'typing' && meta.roomId && meta.uid) {
        broadcastRoom(
          meta.roomId,
          {
            type: 'typing',
            roomId: meta.roomId,
            uid: meta.uid,
            displayName: meta.displayName || 'User',
            isTyping: Boolean(msg.isTyping),
          },
          ws
        );
        return;
      }

      if (msg.type === 'read_receipt' && meta.roomId && meta.uid) {
        broadcastRoom(
          meta.roomId,
          {
            type: 'read_receipt',
            roomId: meta.roomId,
            uid: meta.uid,
            displayName: meta.displayName || 'User',
            at: new Date().toISOString(),
          },
          ws
        );
        return;
      }

      if (msg.type === 'chat_message' && meta.uid) {
        const roomId = typeof msg.roomId === 'string' ? msg.roomId.slice(0, 128) : meta.roomId;
        const targetUid = typeof msg.targetUid === 'string' ? msg.targetUid.slice(0, 128) : '';
        const rawText = typeof msg.preview === 'string' ? msg.preview : typeof msg.text === 'string' ? msg.text : 'New message';
        const relayPayload = JSON.stringify({
          type: 'chat_message',
          roomId,
          fromUid: meta.uid,
          fromName: meta.displayName || 'Supporter',
          preview: rawText.slice(0, 140),
          at: new Date().toISOString(),
        });
        for (const [clientWs, clientMeta] of wsClients.entries()) {
          if (clientWs === ws || clientWs.readyState !== WebSocket.OPEN) continue;
          const inRoom = Boolean(roomId && clientMeta.roomId === roomId);
          const isTarget = Boolean(targetUid && clientMeta.uid === targetUid);
          if (inRoom || isTarget) {
            clientWs.send(relayPayload);
          }
        }
        return;
      }

      if (
        (msg.type === 'call_offer' ||
          msg.type === 'call_answer' ||
          msg.type === 'call_ice' ||
          msg.type === 'call_end' ||
          msg.type === 'call_ring' ||
          msg.type === 'game_invite' ||
          msg.type === 'streak_milestone') &&
        typeof msg.targetUid === 'string' &&
        meta.uid
      ) {
        sendToUser(msg.targetUid, {
          ...msg,
          fromUid: meta.uid,
          fromName: meta.displayName || 'Supporter',
        });
      }
    } catch {
      // Ignore malformed frames
    }
  });

  ws.on('close', () => {
    const meta = wsClients.get(ws);
    if (meta?.roomId && meta.uid) {
      broadcastRoom(meta.roomId, {
        type: 'typing',
        roomId: meta.roomId,
        uid: meta.uid,
        displayName: meta.displayName || 'User',
        isTyping: false,
      });
    }
    wsClients.delete(ws);
  });
});

async function startServer() {
  const downloadsDir = path.resolve(__dirname, 'public/downloads');
  const standaloneDir = path.resolve(__dirname, 'standalone-html');
  const standaloneZipPath = path.join(downloadsDir, 'str-scores-standalone-html.zip');

  app.get('/api/export/standalone-zip', (_req, res) => {
    res.download(standaloneZipPath, 'str-scores-standalone-html.zip', (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: 'Standalone ZIP package not found.' });
      }
    });
  });
  app.use('/downloads', express.static(downloadsDir));
  app.use('/standalone', express.static(standaloneDir));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`STR SCORES server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
