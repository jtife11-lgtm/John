import React, { useEffect, useState } from 'react';
import { Bot, Clock, Loader2, MapPin, ShieldAlert, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { MatchDetail } from '../types/str';
import { BroadcastLineupPitch } from './BroadcastLineupPitch';

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
      className={`${dims} rounded-xl bg-slate-200 dark:bg-[#141923] border border-slate-300 dark:border-white/10 flex items-center justify-center font-bold text-slate-700 dark:text-white shrink-0`}
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-4xl max-h-[92vh] rounded-3xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-[#07090F]">
          <div className="flex items-center gap-2.5 min-w-0">
            {detail?.match.leagueLogo && (
              <img
                src={detail.match.leagueLogo}
                alt={detail.match.leagueName}
                referrerPolicy="no-referrer"
                className="w-6 h-6 object-contain shrink-0"
              />
            )}
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
              {detail?.match.leagueName || 'Match Center'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {detail && (
              <button
                onClick={openAiForMatch}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#E11D48] hover:bg-[#be123c] text-white text-xs font-bold transition shadow-md shadow-rose-950/30"
              >
                <Bot className="w-3.5 h-3.5" />
                Ask STR AI
              </button>
            )}
            <button
              onClick={() => setSelectedMatchForDetail(null)}
              aria-label="Close match details"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 dark:text-slate-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-6">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-[#E11D48]" />
              <p className="text-sm font-medium">Loading official match details, lineups & statistics...</p>
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
              <div className="rounded-2xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 p-5 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#E11D48]" />
                    {detail.match.venue || 'Stadium TBD'}
                  </span>
                  <span
                    className={`font-mono-tabular font-bold px-2.5 py-0.5 rounded-lg ${
                      detail.match.status === 'LIVE'
                        ? 'bg-[#E11D48]/15 text-[#E11D48]'
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

                  <div className="font-mono-tabular text-3xl sm:text-5xl font-black text-slate-900 dark:text-white">
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
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#07090F] border border-slate-200 dark:border-white/10">
                {[
                  { id: 'events' as const, label: 'Match Events' },
                  { id: 'stats' as const, label: 'Statistics' },
                  { id: 'lineups' as const, label: 'Lineups' },
                  { id: 'h2h' as const, label: 'Head-to-Head' },
                ].map((tItem) => (
                  <button
                    key={tItem.id}
                    onClick={() => setTab(tItem.id)}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                      tab === tItem.id
                        ? 'bg-[#E11D48] text-white shadow-sm'
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
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono-tabular text-xs font-bold text-[#E11D48] w-10 shrink-0">
                            {ev.minute || '-'}
                          </span>
                          <span
                            className={`text-[11px] font-black uppercase w-14 shrink-0 ${
                              ev.type === 'red'
                                ? 'text-rose-500'
                                : ev.type === 'yellow'
                                ? 'text-amber-400'
                                : ev.type === 'goal'
                                ? 'text-white bg-[#E11D48] px-1.5 py-0.5 rounded text-center'
                                : 'text-slate-400'
                            }`}
                          >
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
                        <span className="text-xs font-medium text-slate-500 shrink-0">{ev.teamName}</span>
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
                          <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden flex">
                            <div
                              className="bg-[#E11D48] h-full transition-all"
                              style={{ width: `${homePct}%` }}
                            />
                            <div
                              className="bg-white/80 dark:bg-slate-300 h-full transition-all"
                              style={{ width: `${100 - homePct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Broadcast 2D Pitch Lineups Tab */}
              {tab === 'lineups' && (
                <BroadcastLineupPitch
                  lineups={detail.lineups}
                  homeLogo={detail.match.home.logo}
                  awayLogo={detail.match.away.logo}
                />
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
                        className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs"
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
