import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Heart,
  Loader2,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react';
import { LEAGUES_CATALOG } from '../data/footballCatalog';
import { useApp } from '../context/AppContext';
import { t } from '../lib/i18n';
import type { MatchItem } from '../types/str';
import { TeamCrest } from './MatchDetailModal';

function formatEspnDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function ScoresCenter() {
  const {
    lang,
    userProfile,
    guestPrefs,
    savePreferences,
    setSelectedMatchForDetail,
  } = useApp();

  const favoriteTeams = userProfile?.favoriteTeams || guestPrefs.favoriteTeams || [];

  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [dateOffset, setDateOffset] = useState<number>(0);
  const [customDate, setCustomDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'UPCOMING' | 'FT'>('ALL');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const targetDateStr = React.useMemo(() => {
    if (customDate) return customDate.replace(/-/g, '');
    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    return formatEspnDate(d);
  }, [dateOffset, customDate]);

  const loadScoreboard = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch(
        `/api/football/scoreboard?league=${encodeURIComponent(selectedLeague)}&date=${encodeURIComponent(
          targetDateStr
        )}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Scoreboard request failed');
      setMatches(Array.isArray(data.matches) ? data.matches : []);
      setErrors(Array.isArray(data.errors) ? data.errors : []);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Unable to reach live football scoreboard.');
    } finally {
      setLoading(false);
    }
  }, [selectedLeague, targetDateStr]);

  useEffect(() => {
    loadScoreboard();
    const timer = setInterval(loadScoreboard, 30_000);
    return () => clearInterval(timer);
  }, [loadScoreboard]);

  const toggleFavoriteClub = async (clubName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const exists = favoriteTeams.includes(clubName);
    const updated = exists
      ? favoriteTeams.filter((c) => c !== clubName)
      : [...favoriteTeams, clubName];
    const basePrefs = userProfile
      ? {
          favoriteTeams: updated,
          favoriteNationalTeams: userProfile.favoriteNationalTeams || [],
          favoriteLeagues: userProfile.favoriteLeagues || [],
          favoritePlayers: userProfile.favoritePlayers || [],
          favoriteCountry: userProfile.favoriteCountry || '',
          favoriteCity: userProfile.favoriteCity || '',
          favoritePosition: userProfile.favoritePosition || '',
        }
      : { ...guestPrefs, favoriteTeams: updated };
    await savePreferences(basePrefs);
  };

  const filteredMatches = matches.filter((m) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'LIVE' && m.status !== 'LIVE' && m.status !== 'HT') return false;
      if (statusFilter === 'UPCOMING' && m.status !== 'UPCOMING') return false;
      if (statusFilter === 'FT' && m.status !== 'FT') return false;
    }
    if (onlyFavorites) {
      const isFav =
        favoriteTeams.some(
          (f) =>
            m.home.name.toLowerCase().includes(f.toLowerCase()) ||
            m.away.name.toLowerCase().includes(f.toLowerCase())
        );
      if (!isFav) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.home.name.toLowerCase().includes(q) ||
        m.away.name.toLowerCase().includes(q) ||
        m.leagueName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by league
  const grouped = filteredMatches.reduce<Record<string, MatchItem[]>>((acc, m) => {
    const key = m.leagueName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            Live Football Scoreboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Verified upstream match feeds · Auto-refreshes every 30s
            {lastUpdated ? ` · Last sync ${lastUpdated}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
              onlyFavorites
                ? 'bg-[#00E676] text-[#060B16] border-[#00E676]'
                : 'bg-white dark:bg-[#0B1324] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            Favorites Only
          </button>

          <button
            onClick={loadScoreboard}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#00E676] transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date Selector & Search */}
      <div className="grid md:grid-cols-12 gap-3">
        <div className="md:col-span-7 flex flex-wrap items-center gap-1.5 bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5">
          {[
            { offset: -1, label: 'Yesterday' },
            { offset: 0, label: 'Today' },
            { offset: 1, label: 'Tomorrow' },
            { offset: 2, label: '+2 Days' },
          ].map((d) => {
            const active = !customDate && dateOffset === d.offset;
            return (
              <button
                key={d.offset}
                onClick={() => {
                  setCustomDate('');
                  setDateOffset(d.offset);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                  active
                    ? 'bg-[#00E676] text-[#060B16]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {d.label}
              </button>
            );
          })}
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-500 cursor-pointer">
            <Calendar className="w-3.5 h-3.5" />
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="bg-transparent text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
            />
          </label>
        </div>

        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter teams or competitions..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-[#00E676]"
          />
        </div>
      </div>

      {/* Status + League Filter Strips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedLeague('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition ${
              selectedLeague === 'all'
                ? 'bg-[#00E676] text-[#060B16] border-[#00E676]'
                : 'bg-white dark:bg-[#0B1324] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            {t(lang, 'allLeagues')}
          </button>
          {LEAGUES_CATALOG.map((lg) => (
            <button
              key={lg.id}
              onClick={() => setSelectedLeague(lg.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition ${
                selectedLeague === lg.id
                  ? 'bg-[#00E676] text-[#060B16] border-[#00E676]'
                  : 'bg-white dark:bg-[#0B1324] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
              }`}
            >
              {lg.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 rounded-xl p-1 shrink-0">
          {(['ALL', 'LIVE', 'UPCOMING', 'FT'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-[#060B16]'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Partial Upstream Warning */}
      {errors.length > 0 && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          Some competition feeds reported temporary unavailability: {errors.slice(0, 2).join(' · ')}
        </div>
      )}

      {/* States */}
      {loading && matches.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-[#00E676]" />
          <p className="text-sm">{t(lang, 'loadingScores')}</p>
        </div>
      ) : fetchError ? (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-8 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{fetchError}</p>
          <button
            onClick={loadScoreboard}
            className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold"
          >
            Retry Feed
          </button>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
          <p className="font-semibold text-slate-900 dark:text-white">{t(lang, 'noMatches')}</p>
          <p className="text-xs text-slate-500">
            Try switching the competition filter to All Competitions or selecting another matchday date.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([leagueName, leagueMatches]) => (
            <section
              key={leagueName}
              className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="px-4 py-3 bg-slate-50 dark:bg-[#060B16]/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {leagueMatches[0]?.leagueLogo && (
                    <img
                      src={leagueMatches[0].leagueLogo}
                      alt={leagueName}
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 object-contain"
                    />
                  )}
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {leagueName}
                  </h2>
                  <span className="text-xs text-slate-500">· {leagueMatches[0]?.leagueCountry}</span>
                </div>
                <span className="font-mono-tabular text-xs text-slate-500">
                  {leagueMatches.length} fixtures
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {leagueMatches.map((m) => {
                  const isLive = m.status === 'LIVE' || m.status === 'HT';
                  const kickoff = m.date
                    ? new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';
                  const isHomeFav = favoriteTeams.includes(m.home.name);
                  const isAwayFav = favoriteTeams.includes(m.away.name);

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMatchForDetail({ leagueId: m.leagueId, eventId: m.id })}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setSelectedMatchForDetail({ leagueId: m.leagueId, eventId: m.id });
                        }
                      }}
                      className="px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer grid grid-cols-12 items-center gap-3"
                    >
                      {/* Status / Clock */}
                      <div className="col-span-3 sm:col-span-2 flex items-center gap-2">
                        {isLive ? (
                          <span className="inline-flex items-center gap-1.5 font-mono-tabular text-xs font-bold text-[#00A844] dark:text-[#00E676]">
                            <span className="w-2 h-2 rounded-full bg-[#00E676] live-ring" />
                            {m.status === 'HT' ? 'HT' : m.clock || 'LIVE'}
                          </span>
                        ) : m.status === 'FT' ? (
                          <span className="font-mono-tabular text-xs font-semibold text-slate-500">
                            FT
                          </span>
                        ) : (
                          <span className="font-mono-tabular text-xs text-slate-500">
                            {kickoff || 'TBD'}
                          </span>
                        )}
                      </div>

                      {/* Teams & Scores */}
                      <div className="col-span-7 sm:col-span-8 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <TeamCrest logo={m.home.logo} abbr={m.home.abbreviation} size="sm" />
                            <span
                              className={`text-sm truncate ${
                                m.home.winner
                                  ? 'font-bold text-slate-900 dark:text-white'
                                  : 'font-medium text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {m.home.name}
                            </span>
                            {isHomeFav && <Heart className="w-3 h-3 text-[#00E676] fill-[#00E676] shrink-0" />}
                          </div>
                          <span className="font-mono-tabular text-sm font-bold text-slate-900 dark:text-white">
                            {m.home.score !== null ? m.home.score : '-'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <TeamCrest logo={m.away.logo} abbr={m.away.abbreviation} size="sm" />
                            <span
                              className={`text-sm truncate ${
                                m.away.winner
                                  ? 'font-bold text-slate-900 dark:text-white'
                                  : 'font-medium text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {m.away.name}
                            </span>
                            {isAwayFav && <Heart className="w-3 h-3 text-[#00E676] fill-[#00E676] shrink-0" />}
                          </div>
                          <span className="font-mono-tabular text-sm font-bold text-slate-900 dark:text-white">
                            {m.away.score !== null ? m.away.score : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Favorite quick toggle */}
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => toggleFavoriteClub(m.home.name, e)}
                          title={`Follow ${m.home.shortName}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-[#00E676] hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              isHomeFav || isAwayFav ? 'text-[#00E676] fill-[#00E676]' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
