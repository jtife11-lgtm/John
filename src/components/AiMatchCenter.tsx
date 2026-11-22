import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  Send,
  Shield,
  Sparkles,
  Target,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../lib/i18n';
import type { AiStructuredReport, MatchItem } from '../types/str';

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  disclaimer?: string;
  verifiedContextTitle?: string;
}

export function AiMatchCenter() {
  const { lang, aiInitialQuestion, setAiInitialQuestion } = useApp();

  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [structuredReport, setStructuredReport] = useState<AiStructuredReport | null>(null);

  useEffect(() => {
    fetch('/api/football/scoreboard?league=all')
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.matches) ? d.matches : [];
        setMatches(list);
        if (list.length > 0 && !selectedMatchId) {
          setSelectedMatchId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const selectedMatch = matches.find((m) => m.id === selectedMatchId) || null;

  const fetchMatchContext = async (match: MatchItem | null) => {
    if (!match) return undefined;
    const detailRes = await fetch(
      `/api/football/match/${encodeURIComponent(match.leagueId)}/${encodeURIComponent(match.id)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    return detailRes
      ? {
          league: detailRes.match?.leagueName,
          status: detailRes.match?.status,
          clock: detailRes.match?.clock,
          venue: detailRes.match?.venue,
          home: detailRes.match?.home,
          away: detailRes.match?.away,
          stats: detailRes.stats,
          events: detailRes.events,
          lineups: detailRes.lineups?.map((l: any) => ({
            teamName: l.teamName,
            formation: l.formation,
            starters: (l.starters || []).map((s: any) => `${s.name} (${s.position})`),
          })),
          h2h: detailRes.h2h,
        }
      : {
          league: match.leagueName,
          status: match.status,
          clock: match.clock,
          venue: match.venue,
          home: match.home,
          away: match.away,
          events: match.events,
        };
  };

  const generateFullReport = async () => {
    if (!selectedMatch) return;
    setError('');
    setReportLoading(true);
    try {
      const matchContext = await fetchMatchContext(selectedMatch);
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Provide a full match analysis report for ${selectedMatch.home.name} vs ${selectedMatch.away.name}.`,
          mode: 'full_report',
          matchContext,
          language: lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Full AI report failed');
      if (data.structuredReport) {
        setStructuredReport(data.structuredReport);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: data.analysis,
            disclaimer: data.disclaimer,
            verifiedContextTitle: `${selectedMatch.home.shortName} vs ${selectedMatch.away.shortName}`,
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate full AI Match Report.');
    } finally {
      setReportLoading(false);
    }
  };

  const runAnalysis = async (
    textPrompt: string,
    mode: 'explain_stats' | 'summarize_events' | 'preview' | 'qa'
  ) => {
    if (!textPrompt.trim()) return;
    setError('');
    setLoading(true);

    const userMsg: AiMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: textPrompt.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');

    try {
      const matchContext = await fetchMatchContext(selectedMatch);
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textPrompt.trim(),
          mode,
          matchContext,
          language: lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'AI analysis failed');

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.analysis,
          disclaimer: data.disclaimer,
          verifiedContextTitle: selectedMatch
            ? `${selectedMatch.home.shortName} vs ${selectedMatch.away.shortName} (${selectedMatch.status})`
            : undefined,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach STR AI Match Analyst.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (aiInitialQuestion) {
      const q = aiInitialQuestion;
      setAiInitialQuestion(null);
      runAnalysis(q, 'qa');
    }
  }, [aiInitialQuestion]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Bot className="w-7 h-7 text-[#00E676]" />
            STR AI Match Analyst
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Grounded strictly in real API match telemetry · Tactical reports, xG honesty, player ratings & simple explanations
          </p>
        </div>

        <div className="text-xs px-3.5 py-2 rounded-xl bg-[#00E676]/10 border border-[#00E676]/30 text-[#00A844] dark:text-[#00E676] font-medium">
          {t(lang, 'aiDisclaimer')}
        </div>
      </div>

      {/* Match Telemetry Selector */}
      <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#00E676]" />
              Verified Match Telemetry Context
            </h2>
            <p className="text-xs text-slate-500">
              Select a real match from today’s scoreboard to generate a complete structured AI Match Analyst report.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedMatchId}
              onChange={(e) => {
                setSelectedMatchId(e.target.value);
                setStructuredReport(null);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-xs font-medium max-w-xs"
            >
              <option value="">General Football Q&A (No match attached)</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.home.shortName} {m.home.score ?? ''} - {m.away.score ?? ''} {m.away.shortName} (
                  {m.leagueName})
                </option>
              ))}
            </select>
            {selectedMatch && (
              <button
                disabled={reportLoading}
                onClick={generateFullReport}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-extrabold hover:brightness-105 disabled:opacity-50"
              >
                {reportLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                {reportLoading ? 'Analyzing...' : 'Generate Full Analyst Report'}
              </button>
            )}
          </div>
        </div>

        {selectedMatch && (
          <div className="rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-900 dark:text-white">
              Real Feed Data: {selectedMatch.home.name} ({selectedMatch.home.score ?? '-'}) vs{' '}
              {selectedMatch.away.name} ({selectedMatch.away.score ?? '-'})
            </span>
            <span className="font-mono-tabular text-slate-500">
              {selectedMatch.leagueName} · {selectedMatch.status} {selectedMatch.clock}
            </span>
          </div>
        )}

        {/* Quick AI Prompts */}
        <div className="flex flex-wrap gap-2">
          {[
            {
              label: 'Explain Match Statistics Simply',
              mode: 'explain_stats' as const,
              q: 'Explain the match statistics in simple language for a casual fan.',
            },
            {
              label: 'Summarize Match Events',
              mode: 'summarize_events' as const,
              q: 'Summarize the key match events, momentum shifts, and standout performers.',
            },
            {
              label: 'Neutral Match Preview & Form',
              mode: 'preview' as const,
              q: 'Provide a neutral match preview comparing both teams, form, and tactical keys.',
            },
          ].map((btn) => (
            <button
              key={btn.label}
              disabled={loading}
              onClick={() => runAnalysis(btn.q, btn.mode)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#060B16] hover:border-[#00E676] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00E676]" />
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Structured Full AI Match Report */}
      {structuredReport && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#0B1324] border border-[#00E676]/40 text-white p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl font-extrabold text-[#00E676] flex items-center gap-2">
                <Activity className="w-5 h-5" />
                AI-Generated Match Analysis Report
              </h2>
              <span className="text-[11px] text-slate-400">{structuredReport.disclaimer}</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">{structuredReport.summary}</p>
            <div className="p-4 rounded-xl bg-[#060B16] border border-slate-800 text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {structuredReport.generatedReport}
            </div>
          </div>

          {/* 4-Panel Stat Breakdown (Possession, Shots, Passing, xG) */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Possession Analysis', body: structuredReport.possessionAnalysis, icon: BarChart3 },
              { title: 'Shots & Shots on Target', body: structuredReport.shotsAnalysis, icon: Target },
              { title: 'Passing Accuracy', body: structuredReport.passingAnalysis, icon: Shield },
              {
                title: `Expected Goals (xG) ${structuredReport.xgAvailable ? '' : '· Unavailable'}`,
                body: structuredReport.xgAnalysis,
                icon: Sparkles,
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                >
                  <h3 className="text-xs font-bold text-[#00A844] dark:text-[#00E676] flex items-center gap-1.5">
                    <Icon className="w-4 h-4" />
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{card.body}</p>
                </div>
              );
            })}
          </div>

          {/* Tactical, Attacking/Defensive, Simple Explanation & Comparison */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-2">
              <h3 className="font-display text-lg font-bold">Attacking & Defensive Breakdown</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {structuredReport.attackingDefensiveAnalysis}
              </p>
              <h4 className="font-display text-base font-bold pt-2">Tactical Shape & Keys</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {structuredReport.tacticalAnalysis}
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-2">
              <h3 className="font-display text-lg font-bold">Team Comparison</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {structuredReport.comparison}
              </p>
              <h4 className="font-display text-base font-bold pt-2 text-[#00A844] dark:text-[#00E676]">
                Simple Language Explanation
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {structuredReport.simpleExplanation}
              </p>
            </div>
          </div>

          {/* Strengths & Weaknesses + Player Performance Ratings */}
          <div className="grid md:grid-cols-2 gap-4">
            {structuredReport.strengthsWeaknesses.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                <h3 className="font-display text-lg font-bold">Strengths & Weaknesses</h3>
                {structuredReport.strengthsWeaknesses.map((sw, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                    <p className="font-bold text-slate-900 dark:text-white">{sw.team}</p>
                    <p className="text-[#00A844] dark:text-[#00E676]">
                      Strengths: {(sw.strengths || []).join(', ')}
                    </p>
                    <p className="text-rose-400">Weaknesses: {(sw.weaknesses || []).join(', ')}</p>
                  </div>
                ))}
              </div>
            )}

            {structuredReport.playerRatings.length > 0 && (
              <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                <h3 className="font-display text-lg font-bold">
                  AI Player Performance Ratings
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {structuredReport.playerRatings.map((pr, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold truncate">
                          {pr.player} ({pr.team})
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{pr.note}</p>
                      </div>
                      <span className="font-mono-tabular font-black text-[#00E676] shrink-0">
                        {pr.rating}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Key Match Events + Verified Facts */}
          {(structuredReport.keyEvents.length > 0 || structuredReport.verifiedDataPoints.length > 0) && (
            <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <h4 className="font-bold text-sm mb-2">Key Match Events</h4>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                  {structuredReport.keyEvents.map((ev, i) => (
                    <li key={i}>• {ev}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-sm mb-2 text-[#00A844] dark:text-[#00E676]">
                  Verified Telemetry Fact Check
                </h4>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                  {structuredReport.verifiedDataPoints.map((dp, i) => (
                    <li key={i}>✓ {dp}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive Analyst Conversation Thread */}
      <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col min-h-[340px]">
        <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[480px]">
          {messages.length === 0 ? (
            <div className="py-10 text-center space-y-2 text-slate-500">
              <Bot className="w-9 h-9 mx-auto text-[#00E676] opacity-80" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Ask STR AI Match Analyst anything about tactics, stats, or generate a Full Analyst Report above
              </p>
              <p className="text-xs max-w-md mx-auto">
                All verified scores and statistics remain strictly separated from AI-generated insights.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-2xl rounded-2xl px-4 py-3 text-sm space-y-2 ${
                    msg.role === 'user'
                      ? 'bg-[#00E676] text-[#060B16] font-medium'
                      : 'bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                      <span className="font-bold text-[#00A844] dark:text-[#00E676]">
                        AI-GENERATED ANALYSIS
                      </span>
                      {msg.verifiedContextTitle && (
                        <span className="text-slate-500">Grounded in: {msg.verifiedContextTitle}</span>
                      )}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                  {msg.disclaimer && <p className="text-[11px] text-slate-500 pt-1">{msg.disclaimer}</p>}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#00E676]" />
              Analyzing football telemetry...
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAnalysis(prompt, 'qa');
          }}
          className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060B16] flex items-center gap-2"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask a football question (e.g., How does a 3-5-2 beat a 4-3-3 high press?)"
            className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-[#00E676]"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="px-4 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-sm hover:brightness-105 transition disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
