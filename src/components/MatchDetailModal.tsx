import React, { useEffect, useState } from 'react';
import { Bot, Clock, Loader2, MapPin, ShieldAlert, Shirt, Users, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { MatchDetail } from '../types/str';

export function TeamCrest({
  logo,
  abbr,
  size = 'md',
}: {
  logo?: string;
  abbr: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const dims =
    size === 'lg' ? 'w-14 h-14 text-sm' : size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-9 h-9 text-xs';

  if (logo && !failed) {
    return (
      <img
        src={logo}
        alt={abbr}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${dims} object-contain shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dims} rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 shrink-0`}
    >
      {abbr.slice(0, 3)}
    </div>
  );
}

export function MatchDetailModal() {
  const {
    selectedMatchForDetail,
    setSelectedMatchForDetail,
    setActiveTab,
    setAiInitialQuestion,
  } = useApp();

  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'events' | 'stats' | 'lineups' | 'h2h'>('events');

  useEffect(() => {
    if (!selectedMatchForDetail) return;
    let active = true;
    setLoading(true);
    setError('');
    setDetail(null);
    setTab('events');

    fetch(
      `/api/football/match/${encodeURIComponent(selectedMatchForDetail.leagueId)}/${encodeURIComponent(
        selectedMatchForDetail.eventId
      )}`
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load match details');
        return data as MatchDetail;
      })
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load match telemetry.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedMatchForDetail]);

  if (!selectedMatchForDetail) return null;

  const openAiForMatch = () => {
    if (!detail) return;
    const m = detail.match;
    const summaryPrompt = `Analyze ${m.home.name} vs ${m.away.name} (${m.leagueName}, status: ${m.status}, score: ${m.home.score ?? '-'} - ${m.away.score ?? '-'}). Explain key stats and match flow clearly.`;
    setAiInitialQuestion(summaryPrompt);
    setSelectedMatchForDetail(null);
    setActiveTab('ai');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-3xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {detail?.match.leagueLogo && (
              <img
                src={detail.match.leagueLogo}
                alt={detail.match.leagueName}
                referrerPolicy="no-referrer"
                className="w-6 h-6 object-contain shrink-0"
              />
            )}
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
              {detail?.match.leagueName || 'Match Center'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {detail && (
              <button
                onClick={openAiForMatch}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold hover:brightness-105 transition"
              >
                <Bot className="w-3.5 h-3.5" />
                Ask STR AI
              </button>
            )}
            <button
              onClick={() => setSelectedMatchForDetail(null)}
              aria-label="Close match details"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-[#00E676]" />
              <p className="text-sm">Loading official match details, lineups & statistics...</p>
            </div>
          )}

          {error && (
            <div className="py-12 px-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-2">
              <ShieldAlert className="w-7 h-7 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{error}</p>
            </div>
          )}

          {detail && (
            <>
              {/* Scoreboard Banner */}
              <div className="rounded-2xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {detail.match.venue || 'Stadium TBD'}
                  </span>
                  <span
                    className={`font-mono-tabular font-bold ${
                      detail.match.status === 'LIVE'
                        ? 'text-[#00A844] dark:text-[#00E676]'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {detail.match.status === 'LIVE'
                      ? `LIVE · ${detail.match.clock}`
                      : detail.match.clock || detail.match.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 items-center gap-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <TeamCrest
                      logo={detail.match.home.logo}
                      abbr={detail.match.home.abbreviation}
                      size="lg"
                    />
                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                      {detail.match.home.name}
                    </span>
                  </div>

                  <div className="font-mono-tabular text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
                    {detail.match.status === 'UPCOMING'
                      ? 'vs'
                      : `${detail.match.home.score ?? 0} : ${detail.match.away.score ?? 0}`}
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <TeamCrest
                      logo={detail.match.away.logo}
                      abbr={detail.match.away.abbreviation}
                      size="lg"
                    />
                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                      {detail.match.away.name}
                    </span>
                  </div>
                </div>

                {detail.unavailableReason && (
                  <p className="text-xs text-amber-600 dark:text-amber-300 text-center">
                    {detail.unavailableReason}
                  </p>
                )}
              </div>

              {/* Sub-navigation tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800">
                {[
                  { id: 'events' as const, label: 'Match Events' },
                  { id: 'stats' as const, label: 'Statistics' },
                  { id: 'lineups' as const, label: 'Lineups' },
                  { id: 'h2h' as const, label: 'Head-to-Head' },
                ].map((tItem) => (
                  <button
                    key={tItem.id}
                    onClick={() => setTab(tItem.id)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                      tab === tItem.id
                        ? 'bg-[#00E676] text-[#060B16]'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tItem.label}
                  </button>
                ))}
              </div>

              {/* Events Tab */}
              {tab === 'events' && (
                <div className="space-y-2.5">
                  {detail.events.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      <Clock className="w-6 h-6 mx-auto mb-2 opacity-60" />
                      No match events recorded yet for this fixture.
                    </div>
                  ) : (
                    detail.events.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono-tabular text-xs font-bold text-[#00A844] dark:text-[#00E676] w-10 shrink-0">
                            {ev.minute || '-'}
                          </span>
                          <span className="text-xs font-bold uppercase text-slate-500 w-14 shrink-0">
                            {ev.type === 'goal'
                              ? 'GOAL'
                              : ev.type === 'yellow'
                              ? 'YELLOW'
                              : ev.type === 'red'
                              ? 'RED'
                              : ev.type === 'sub'
                              ? 'SUB'
                              : 'EVENT'}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {ev.playerName}
                            </p>
                            {ev.assistName && (
                              <p className="text-xs text-slate-500 truncate">Assist: {ev.assistName}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">{ev.teamName}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Stats Tab */}
              {tab === 'stats' && (
                <div className="space-y-3">
                  {detail.stats.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                      Match statistics will appear once kickoff data is published by the feed.
                    </p>
                  ) : (
                    detail.stats.map((st) => {
                      const total = st.homeNum + st.awayNum || 1;
                      const homePct = Math.round((st.homeNum / total) * 100);
                      return (
                        <div key={st.label} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="font-mono-tabular font-bold text-slate-900 dark:text-white">
                              {st.homeValue}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">{st.label}</span>
                            <span className="font-mono-tabular font-bold text-slate-900 dark:text-white">
                              {st.awayValue}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                            <div
                              className="bg-[#00E676] h-full transition-all"
                              style={{ width: `${homePct}%` }}
                            />
                            <div
                              className="bg-sky-500 h-full transition-all"
                              style={{ width: `${100 - homePct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Lineups Tab */}
              {tab === 'lineups' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {detail.lineups.length === 0 ? (
                    <div className="sm:col-span-2 py-8 text-center text-sm text-slate-500">
                      <Users className="w-6 h-6 mx-auto mb-2 opacity-60" />
                      Confirmed starting lineups are not yet published for this match.
                    </div>
                  ) : (
                    detail.lineups.map((team) => (
                      <div
                        key={team.teamId || team.teamName}
                        className="rounded-2xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {team.teamName}
                          </h4>
                          <span className="font-mono-tabular text-xs font-semibold text-[#00A844] dark:text-[#00E676]">
                            {team.formation}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold text-slate-400">Starting XI</p>
                          {team.starters.map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-xs py-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono-tabular w-6 text-slate-400 font-bold">
                                  #{p.jersey || '-'}
                                </span>
                                <span className="text-slate-900 dark:text-slate-100 font-medium truncate">
                                  {p.name}
                                </span>
                              </div>
                              <span className="text-slate-500 font-mono-tabular">{p.position}</span>
                            </div>
                          ))}
                        </div>
                        {team.subs.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                            <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                              <Shirt className="w-3 h-3" /> Substitutes
                            </p>
                            {team.subs.map((p) => (
                              <div key={p.id} className="flex items-center justify-between text-xs text-slate-500">
                                <span className="truncate">
                                  #{p.jersey || '-'} {p.name}
                                </span>
                                <span>{p.position}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* H2H Tab */}
              {tab === 'h2h' && (
                <div className="space-y-2.5">
                  {detail.h2h.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                      No head-to-head history returned for this matchup.
                    </p>
                  ) : (
                    detail.h2h.map((g, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-xs"
                      >
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {g.homeTeam} vs {g.awayTeam}
                          </p>
                          <p className="text-slate-500">
                            {g.competition} · {g.date ? new Date(g.date).toLocaleDateString() : ''}
                          </p>
                        </div>
                        <span className="font-mono-tabular text-sm font-bold text-slate-900 dark:text-white">
                          {g.homeScore} - {g.awayScore}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
