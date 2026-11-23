import React, { useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Loader2,
  Search,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PLAYER_CARDS_CATALOG } from '../data/playerCardsCatalog';
import type { PlayerProfileDetail } from '../types/str';
import { PlayerCardVisual } from './PlayerCardVisual';

const FEATURED_PLAYER_NAMES = [
  'Lionel Messi',
  'Cristiano Ronaldo',
  'Kylian Mbappe',
  'Erling Haaland',
  'Vinicius Junior',
  'Jude Bellingham',
  'Mohamed Salah',
  'Lamine Yamal',
  'Kevin De Bruyne',
  'Neymar',
  'Hassan Maatouk',
  'Zinedine Zidane',
];

export function PlayerProfiles() {
  const { selectedPlayerKey, setSelectedPlayerKey, setActiveTab } = useApp();

  const [queryText, setQueryText] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [profile, setProfile] = useState<PlayerProfileDetail | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState('');

  const loadPlayerProfile = async (playerKey: string) => {
    if (!playerKey) return;
    setLoadingProfile(true);
    setError('');
    try {
      const res = await fetch(`/api/football/player/${encodeURIComponent(playerKey)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Player profile unavailable');
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load player profile.');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    const initial = selectedPlayerKey || 'Lionel Messi';
    loadPlayerProfile(initial);
    if (selectedPlayerKey) setSelectedPlayerKey(null);
  }, [selectedPlayerKey]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (queryText.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/football/players?q=${encodeURIComponent(queryText.trim())}`);
      const d = await res.json();
      setSearchResults(Array.isArray(d.players) ? d.players : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const linkedCard = profile
    ? PLAYER_CARDS_CATALOG.find(
        (c) =>
          c.name.toLowerCase() === profile.name.toLowerCase() ||
          profile.name.toLowerCase().includes(c.tsdbSearchName.toLowerCase()) ||
          c.tsdbSearchName.toLowerCase().includes(profile.name.toLowerCase())
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="rounded-3xl bg-[#0F1219] border border-slate-800 text-white p-6 sm:p-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-[#E11D48] tracking-wider">STR PLAYER PROFILES</p>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold">
              Global Footballer Encyclopedia & Career Telemetry
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Search active stars and football icons across leagues and generations. Verified registry data only.
            </p>
          </div>
          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-96">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Search any footballer (e.g., Saka, Rodri, Zidane)..."
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[#07090F] border border-slate-700 text-sm text-white focus:outline-none focus:border-[#E11D48]"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2.5 rounded-xl bg-[#E11D48] text-white font-bold text-xs shrink-0"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {/* Quick Featured Player Selector */}
        <div className="flex flex-wrap gap-1.5">
          {FEATURED_PLAYER_NAMES.map((name) => (
            <button
              key={name}
              onClick={() => loadPlayerProfile(name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                profile?.name.toLowerCase().includes(name.toLowerCase().split(' ')[1] || name.toLowerCase())
                  ? 'bg-[#E11D48] text-white border-[#E11D48]'
                  : 'bg-[#07090F]/80 border-slate-700 text-slate-300 hover:border-[#E11D48]'
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Live Search Results Strip */}
        {searchResults.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => loadPlayerProfile(p.id)}
                className="p-2.5 rounded-xl bg-[#07090F] border border-slate-700 hover:border-[#E11D48] flex items-center gap-3 text-left transition"
              >
                {p.photo ? (
                  <img
                    src={p.photo}
                    alt={p.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl object-contain bg-slate-900"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {p.currentClub} · {p.nationality}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading / Error */}
      {loadingProfile && (
        <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-10 flex items-center justify-center gap-3 text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-[#E11D48]" />
          Loading verified player profile...
        </div>
      )}

      {error && !loadingProfile && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-6 text-sm text-rose-500">
          {error}
        </div>
      )}

      {/* Player Profile View */}
      {profile && !loadingProfile && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Hero Identity Card */}
            <div className="rounded-3xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="w-32 h-32 rounded-3xl bg-slate-100 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                {profile.photo ? (
                  <img
                    src={profile.photo}
                    alt={profile.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <User className="w-12 h-12 text-slate-400" />
                )}
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="text-xs font-bold text-[#E11D48] dark:text-[#E11D48] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {profile.source}
                  </span>
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
                  {profile.name}{' '}
                  {profile.shirtNumber && (
                    <span className="text-[#E11D48] font-mono-tabular">#{profile.shirtNumber}</span>
                  )}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {profile.currentClub} · {profile.position} · {profile.nationality}
                  {profile.age ? ` · Age ${profile.age}` : ''}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  {profile.verifiedMetrics.slice(0, 8).map((m) => (
                    <div
                      key={m.label}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10"
                    >
                      <p className="text-[10px] text-slate-500">{m.label}</p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bio */}
            {profile.description && (
              <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 space-y-2">
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Biography & Profile Overview
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-6">
                  {profile.description}
                </p>
              </div>
            )}

            {/* Career History */}
            <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 space-y-4">
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#E11D48]" />
                Club & Career Timeline
              </h3>
              {profile.careerHistory.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Current registration: {profile.currentClub}. Historical transfer spells unavailable in upstream feed for this entry.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {profile.careerHistory.map((club, i) => (
                    <div
                      key={`${club.team}-${i}`}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 flex items-center gap-3"
                    >
                      {club.badge ? (
                        <img
                          src={club.badge}
                          alt={club.team}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 object-contain"
                        />
                      ) : (
                        <Shield className="w-7 h-7 text-slate-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {club.team}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {club.season} {club.moveType ? `· ${club.moveType}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Honours & Milestones */}
            <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-6 space-y-4">
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-[#E11D48]" />
                Career Achievements & Honours
              </h3>
              {profile.honours.length === 0 && profile.milestones.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No verified trophy list returned by registry for this player.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {profile.honours.map((h, i) => (
                    <div
                      key={`${h.trophy}-${i}`}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs flex items-center justify-between gap-2"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white truncate">{h.trophy}</span>
                      <span className="font-mono-tabular text-[#E11D48] dark:text-[#E11D48] font-bold shrink-0">
                        {h.season}
                      </span>
                    </div>
                  ))}
                  {profile.milestones.map((m, i) => (
                    <div
                      key={`${m.title}-${i}`}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs flex items-center justify-between gap-2"
                    >
                      <span className="text-slate-700 dark:text-slate-200 truncate">{m.title}</span>
                      <span className="font-mono-tabular text-slate-400 shrink-0">{m.season}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#07090F] text-[11px] text-slate-500">
                Data Transparency: {profile.unavailableMetrics.join(' ')}
              </div>
            </div>
          </div>

          {/* Right Rail: Linked STR Player Card & SVG Attribute Chart */}
          <div className="lg:col-span-4 space-y-5">
            {linkedCard ? (
              <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#E11D48]" />
                    Linked STR Card
                  </h3>
                  <button
                    onClick={() => setActiveTab('cards')}
                    className="text-xs font-bold text-[#E11D48] dark:text-[#E11D48] hover:underline"
                  >
                    Open Cards Hub
                  </button>
                </div>

                <PlayerCardVisual card={linkedCard} />

                {/* SVG Performance Attribute Chart */}
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-[#E11D48]" />
                    Game Attribute Profile (Game Ratings)
                  </p>
                  <svg viewBox="0 0 280 130" className="w-full rounded-xl bg-[#07090F] p-2 border border-slate-800">
                    {[
                      { k: 'PAC', v: linkedCard.stats.pace },
                      { k: 'SHO', v: linkedCard.stats.shooting },
                      { k: 'PAS', v: linkedCard.stats.passing },
                      { k: 'DRI', v: linkedCard.stats.dribbling },
                      { k: 'DEF', v: linkedCard.stats.defending },
                      { k: 'PHY', v: linkedCard.stats.physical },
                    ].map((row, idx) => {
                      const y = 10 + idx * 19;
                      const barW = Math.round((row.v / 100) * 190);
                      return (
                        <g key={row.k}>
                          <text x="8" y={y + 11} fill="#94a3b8" fontSize="10" fontWeight="bold">
                            {row.k}
                          </text>
                          <rect x="44" y={y + 2} width="190" height="10" rx="5" fill="#1e293b" />
                          <rect x="44" y={y + 2} width={barW} height="10" rx="5" fill="#E11D48" />
                          <text x="242" y={y + 11} fill="#ffffff" fontSize="10" fontWeight="bold">
                            {row.v}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-2">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  STR Player Cards Link
                </h3>
                <p className="text-xs text-slate-500">
                  No collectible STR card edition is currently issued for {profile.name}. Explore featured cards in STR Player Cards!
                </p>
                <button
                  onClick={() => setActiveTab('cards')}
                  className="w-full py-2.5 rounded-xl bg-[#E11D48] text-white font-bold text-xs"
                >
                  Browse STR Player Cards
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
