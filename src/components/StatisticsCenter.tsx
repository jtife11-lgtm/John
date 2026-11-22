import React, { useEffect, useState } from 'react';
import { BarChart3, Loader2, Search, Trophy } from 'lucide-react';
import { LEAGUES_CATALOG } from '../data/footballCatalog';
import type { PlayerLeader, SearchEntityResult, StandingRow } from '../types/str';
import { TeamCrest } from './MatchDetailModal';

export function StatisticsCenter() {
  const [leagueId, setLeagueId] = useState('eng.1');
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [scorers, setScorers] = useState<PlayerLeader[]>([]);
  const [assists, setAssists] = useState<PlayerLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Compare tool state
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [resultsA, setResultsA] = useState<SearchEntityResult[]>([]);
  const [resultsB, setResultsB] = useState<SearchEntityResult[]>([]);
  const [compareA, setCompareA] = useState<SearchEntityResult | null>(null);
  const [compareB, setCompareB] = useState<SearchEntityResult | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetch(`/api/football/standings/${encodeURIComponent(leagueId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setStandings(Array.isArray(data.standings) ? data.standings : []);
        setScorers(Array.isArray(data.scorers) ? data.scorers : []);
        setAssists(Array.isArray(data.assists) ? data.assists : []);
      })
      .catch(() => {
        if (active) setError('Unable to fetch league standings from upstream API.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [leagueId]);

  const runEntitySearch = async (q: string, setter: (r: SearchEntityResult[]) => void) => {
    if (q.trim().length < 2) return;
    const res = await fetch(`/api/football/search?q=${encodeURIComponent(q.trim())}`).then((r) =>
      r.json()
    );
    setter(Array.isArray(res.results) ? res.results : []);
  };

  const topSix = standings.slice(0, 6);
  const maxPts = Math.max(...topSix.map((r) => r.points), 1);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-[#00E676]" />
            STR Statistics Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Official league tables, goal/assist leaders, visual charts & team/player comparisons
          </p>
        </div>

        <select
          value={leagueId}
          onChange={(e) => setLeagueId(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 text-sm font-semibold"
        >
          {LEAGUES_CATALOG.map((lg) => (
            <option key={lg.id} value={lg.id}>
              {lg.name} ({lg.country})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-[#00E676]" />
          <p className="text-sm">Loading standings and player leaders...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-500 text-center">
          {error}
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* League Table */}
          <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                League Table
              </h2>
              <span className="text-xs text-slate-500 font-mono-tabular">
                {standings.length} clubs
              </span>
            </div>
            {standings.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                Table data is not currently available from the upstream feed for this competition.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-[#060B16] text-slate-500 text-[11px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3 text-left">#</th>
                      <th className="py-2.5 px-3 text-left">Club</th>
                      <th className="py-2.5 px-2 text-right">P</th>
                      <th className="py-2.5 px-2 text-right">W</th>
                      <th className="py-2.5 px-2 text-right">D</th>
                      <th className="py-2.5 px-2 text-right">L</th>
                      <th className="py-2.5 px-2 text-right">GF:GA</th>
                      <th className="py-2.5 px-2 text-right">GD</th>
                      <th className="py-2.5 px-3 text-right font-bold">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono-tabular">
                    {standings.map((row) => (
                      <tr key={row.teamId || row.teamName} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-bold text-slate-500">{row.rank}</td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="flex items-center gap-2 min-w-[140px]">
                            <TeamCrest logo={row.teamLogo} abbr={row.teamName.slice(0, 3)} size="sm" />
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {row.teamName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right">{row.played}</td>
                        <td className="py-2.5 px-2 text-right">{row.wins}</td>
                        <td className="py-2.5 px-2 text-right">{row.draws}</td>
                        <td className="py-2.5 px-2 text-right">{row.losses}</td>
                        <td className="py-2.5 px-2 text-right text-slate-500">
                          {row.goalsFor}:{row.goalsAgainst}
                        </td>
                        <td className="py-2.5 px-2 text-right">{row.goalDiff}</td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-[#00A844] dark:text-[#00E676]">
                          {row.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column: Visual Points Chart + Top Scorers/Assists */}
          <div className="lg:col-span-4 space-y-5">
            {topSix.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Title Race Points Distribution
                </h3>
                <div className="space-y-2.5">
                  {topSix.map((row) => (
                    <div key={row.teamName} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium truncate max-w-[170px]">{row.teamName}</span>
                        <span className="font-mono-tabular font-bold text-[#00A844] dark:text-[#00E676]">
                          {row.points} pts
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-[#00E676] rounded-full"
                          style={{ width: `${Math.round((row.points / maxPts) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#00E676]" />
                Top Goalscorers
              </h3>
              {scorers.length === 0 ? (
                <p className="text-xs text-slate-500">Top scorer telemetry unavailable for this league.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {scorers.slice(0, 6).map((p, i) => (
                    <div key={p.id || i} className="py-2 flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                          {i + 1}. {p.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{p.teamName}</p>
                      </div>
                      <span className="font-mono-tabular font-bold text-[#00A844] dark:text-[#00E676]">
                        {p.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {assists.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Top Assists
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {assists.slice(0, 5).map((p, i) => (
                    <div key={p.id || i} className="py-2 flex items-center justify-between text-xs">
                      <span className="font-medium truncate">
                        {i + 1}. {p.name}
                      </span>
                      <span className="font-mono-tabular font-bold text-sky-500">{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compare Teams or Players */}
      <section className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Compare Teams or Players (Real Database Lookup)
          </h2>
          <p className="text-xs text-slate-500">
            Search any football club or player from TheSportsDB to compare profiles side-by-side.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            {
              label: 'Side A',
              val: searchA,
              setVal: setSearchA,
              list: resultsA,
              setList: setResultsA,
              chosen: compareA,
              setChosen: setCompareA,
            },
            {
              label: 'Side B',
              val: searchB,
              setVal: setSearchB,
              list: resultsB,
              setList: setResultsB,
              chosen: compareB,
              setChosen: setCompareB,
            },
          ].map((slot) => (
            <div key={slot.label} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={slot.val}
                  onChange={(e) => slot.setVal(e.target.value)}
                  placeholder={`Search team or player (${slot.label})...`}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-xs"
                />
                <button
                  type="button"
                  onClick={() => runEntitySearch(slot.val, slot.setList)}
                  className="px-4 py-2 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold inline-flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  Find
                </button>
              </div>
              {slot.list.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {slot.list.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        slot.setChosen(item);
                        slot.setList([]);
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
                    >
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-slate-500">{item.subtitle}</span>
                    </button>
                  ))}
                </div>
              )}
              {slot.chosen && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-3">
                    {slot.chosen.imageUrl && (
                      <img
                        src={slot.chosen.imageUrl}
                        alt={slot.chosen.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 object-contain rounded-lg"
                      />
                    )}
                    <div>
                      <p className="font-bold text-sm">{slot.chosen.name}</p>
                      <p className="text-xs text-slate-500">{slot.chosen.subtitle}</p>
                    </div>
                  </div>
                  {slot.chosen.stats && (
                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                      {Object.entries(slot.chosen.stats).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-slate-500">{k}: </span>
                          <span className="font-semibold">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
