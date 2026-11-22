import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bot,
  ChevronRight,
  Flame,
  Gamepad2,
  Layers,
  Newspaper,
  Settings2,
  Sparkles,
  Trophy,
  Users,
  Vote,
} from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { t } from '../lib/i18n';
import type { MatchItem, NewsArticle } from '../types/str';
import { TeamCrest } from './MatchDetailModal';

export function HomeFeed() {
  const {
    user,
    userProfile,
    guestPrefs,
    setActiveTab,
    setShowOnboarding,
    setShowAuthModal,
    setAuthModalMode,
    setSelectedMatchForDetail,
    resendVerification,
    lang,
  } = useApp();

  const prefs = userProfile || guestPrefs;
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetch('/api/football/scoreboard?league=all').then((r) => r.json()).catch(() => ({ matches: [] })),
      fetch('/api/news/football?category=all').then((r) => r.json()).catch(() => ({ articles: [] })),
    ])
      .then(([scoreData, newsData]) => {
        if (!active) return;
        setMatches(Array.isArray(scoreData.matches) ? scoreData.matches : []);
        setNews(Array.isArray(newsData.articles) ? newsData.articles : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubPolls = onSnapshot(
      query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(3)),
      (snap) => {
        setPolls(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {}
    );

    return () => {
      active = false;
      unsubPolls();
    };
  }, []);

  const favTeams = prefs.favoriteTeams || [];
  const favMatches = matches.filter((m) =>
    favTeams.some(
      (f) =>
        m.home.name.toLowerCase().includes(f.toLowerCase()) ||
        m.away.name.toLowerCase().includes(f.toLowerCase())
    )
  );
  const spotlightMatches = favMatches.length > 0 ? favMatches.slice(0, 4) : matches.slice(0, 4);
  const liveCount = matches.filter((m) => m.status === 'LIVE' || m.status === 'HT').length;
  const featuredNews = news.slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Guest or Unverified Account Notice */}
      {!user ? (
        <div className="rounded-2xl bg-[#0B1324] text-white border border-slate-800 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#00E676]">STR SCORES Guest Mode</p>
            <p className="text-xs text-slate-300 leading-relaxed">{t(lang, 'guestBanner')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowOnboarding(true)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold transition whitespace-nowrap"
            >
              Personalize Teams
            </button>
            <button
              onClick={() => {
                setAuthModalMode('signup');
                setShowAuthModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold hover:brightness-105 transition whitespace-nowrap"
            >
              {t(lang, 'createAccount')}
            </button>
          </div>
        </div>
      ) : !user.emailVerified ? (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
              {t(lang, 'verifyEmailTitle')}
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-200/80">
              {t(lang, 'verifyEmailDesc')}
            </p>
          </div>
          <button
            onClick={resendVerification}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0"
          >
            {t(lang, 'resendVerification')}
          </button>
        </div>
      ) : null}

      {/* Hero Matchday Banner */}
      <section className="relative rounded-3xl overflow-hidden bg-[#0B1324] border border-slate-800 text-white">
        <img
          src="/src/assets/images/hero_stadium_night_1795349596580.jpg"
          alt="Stadium Matchday"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060B16]/95 via-[#060B16]/85 to-[#060B16]/60" />

        <div className="relative z-10 p-6 sm:p-8 grid lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs font-semibold text-[#00E676] tracking-wide">
              {liveCount > 0
                ? `${liveCount} Live Matches Underway · ${matches.length} Fixtures Tracked`
                : `${matches.length} Official Fixtures Today`}
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold leading-tight text-balance">
              {userProfile
                ? `Welcome back, ${userProfile.displayName}`
                : 'Your Personalized Matchday Command'}
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Following{' '}
              <span className="text-white font-semibold">
                {favTeams.slice(0, 3).join(', ') || 'global football'}
              </span>{' '}
              and tracking {prefs.favoritePlayers?.slice(0, 2).join(' & ') || 'top stars'}.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                onClick={() => setActiveTab('scores')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-xs hover:brightness-105 transition"
              >
                Open Live Scores
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold transition"
              >
                <Bot className="w-4 h-4 text-[#00E676]" />
                STR AI Match Center
              </button>
              <button
                onClick={() => setShowOnboarding(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold transition"
              >
                <Settings2 className="w-4 h-4" />
                Edit Clubs
              </button>
            </div>
          </div>

          {/* Daily Challenge Quick Tile */}
          <div className="lg:col-span-5 rounded-2xl bg-[#060B16]/90 border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#00E676] flex items-center gap-1.5">
                <Flame className="w-4 h-4" />
                {t(lang, 'dailyChallenge')}
              </span>
              <span className="font-mono-tabular text-xs text-slate-400">
                {new Date().toLocaleDateString()}
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold">
              Matchday Penalty Shootout & Tactical Trivia
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Earn leaderboard points in our live 2D Penalty Shootout, Guess the Player from career clues, or build your Fantasy XI.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setActiveTab('games')}
                className="flex-1 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold hover:brightness-105 transition"
              >
                Play Games Hub
              </button>
              <button
                onClick={() => setActiveTab('fantasy')}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition"
              >
                Fantasy XI
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Personalized Matches Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {favMatches.length > 0 ? 'Your Clubs & Key Matchups' : 'Featured Matchday Fixtures'}
            </h2>
            <p className="text-xs text-slate-500">Tap any match for lineups, stats & AI analysis</p>
          </div>
          <button
            onClick={() => setActiveTab('scores')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#00A844] dark:text-[#00E676] hover:underline"
          >
            All Matches <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loading && spotlightMatches.length === 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 rounded-2xl bg-slate-200/70 dark:bg-[#0B1324] animate-pulse border border-slate-200 dark:border-slate-800"
              />
            ))}
          </div>
        ) : spotlightMatches.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500">
            No fixtures returned for today yet. Open the Live Scoreboard to check yesterday or tomorrow.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {spotlightMatches.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMatchForDetail({ leagueId: m.leagueId, eventId: m.id })}
                className="text-left rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 hover:border-[#00E676] p-4 space-y-3 transition"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="truncate font-medium">{m.leagueName}</span>
                  <span
                    className={`font-mono-tabular font-bold shrink-0 ${
                      m.status === 'LIVE' || m.status === 'HT'
                        ? 'text-[#00A844] dark:text-[#00E676]'
                        : ''
                    }`}
                  >
                    {m.status === 'LIVE' ? `LIVE ${m.clock}` : m.clock || m.status}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamCrest logo={m.home.logo} abbr={m.home.abbreviation} size="sm" />
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {m.home.shortName}
                      </span>
                    </div>
                    <span className="font-mono-tabular text-sm font-bold text-slate-900 dark:text-white">
                      {m.home.score ?? '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamCrest logo={m.away.logo} abbr={m.away.abbreviation} size="sm" />
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {m.away.shortName}
                      </span>
                    </div>
                    <span className="font-mono-tabular text-sm font-bold text-slate-900 dark:text-white">
                      {m.away.score ?? '-'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Two-Column Split: Personalized News + Trending Polls & Quick Hub */}
      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-[#00E676]" />
              Latest Football Headlines
            </h2>
            <button
              onClick={() => setActiveTab('news')}
              className="text-xs font-semibold text-[#00A844] dark:text-[#00E676] hover:underline"
            >
              Full Newsroom
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {featuredNews.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 hover:border-[#00E676] overflow-hidden flex flex-col transition"
              >
                <div className="h-36 bg-slate-900 overflow-hidden">
                  <img
                    src={item.imageUrl || '/src/assets/images/news_transfer_spotlight_1795349597558.jpg'}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        '/src/assets/images/news_transfer_spotlight_1795349597558.jpg';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                </div>
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-500">
                      {item.source} · {item.category}
                    </p>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {new Date(item.publishedAt).toLocaleDateString()}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Right Column: STR VOTE + Recommended Mini-Games */}
        <section className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Vote className="w-5 h-5 text-[#00E676]" />
                {t(lang, 'trendingVotes')}
              </h2>
              <button
                onClick={() => setActiveTab('vote')}
                className="text-xs font-semibold text-[#00A844] dark:text-[#00E676] hover:underline"
              >
                Vote Now
              </button>
            </div>
            {polls.length === 0 ? (
              <p className="text-xs text-slate-500">
                Open STR VOTE to cast your vote on Player of the Match, Goal of the Week, or create a fan poll.
              </p>
            ) : (
              <div className="space-y-3">
                {polls.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setActiveTab('vote')}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 hover:border-[#00E676] cursor-pointer transition space-y-1"
                  >
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{p.title}</p>
                    <p className="text-[11px] text-slate-500 font-mono-tabular">
                      {p.totalVotes || 0} fan votes · Community opinion poll
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#00E676]" />
              Quick Matchday Shortcuts
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'STR Player Cards', tab: 'cards' as const, icon: Layers },
                { label: 'Player Profiles', tab: 'players' as const, icon: Users },
                { label: 'STR Chat & Streaks', tab: 'community' as const, icon: Flame },
                { label: 'STR AI Analyst', tab: 'ai' as const, icon: Bot },
                { label: 'Mini Games Arena', tab: 'games' as const, icon: Gamepad2 },
                { label: 'League Tables', tab: 'stats' as const, icon: Trophy },
              ].map((sc) => {
                const Icon = sc.icon;
                return (
                  <button
                    key={sc.label}
                    onClick={() => setActiveTab(sc.tab)}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 hover:border-[#00E676] text-left space-y-1 transition"
                  >
                    <Icon className="w-4 h-4 text-[#00E676]" />
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{sc.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
