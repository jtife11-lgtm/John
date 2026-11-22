import React, { useEffect, useState } from 'react';
import { BookOpen, Calendar, Heart, MapPin, Smartphone } from 'lucide-react';
import { FOOTBALL_GLOSSARY, STADIUMS_DIRECTORY } from '../data/footballCatalog';
import { useApp } from '../context/AppContext';
import type { MatchItem } from '../types/str';

export function ExtraFeatures() {
  const { userProfile, guestPrefs, setShowOnboarding, setSelectedMatchForDetail } = useApp();
  const [subTab, setSubTab] = useState<'glossary' | 'stadiums' | 'calendar' | 'clubs'>('glossary');
  const [calendarMatches, setCalendarMatches] = useState<MatchItem[]>([]);

  const favTeams = userProfile?.favoriteTeams || guestPrefs.favoriteTeams || [];

  useEffect(() => {
    if (subTab === 'calendar' && calendarMatches.length === 0) {
      fetch('/api/football/scoreboard?league=all')
        .then((r) => r.json())
        .then((d) => setCalendarMatches(Array.isArray(d.matches) ? d.matches : []))
        .catch(() => {});
    }
  }, [subTab, calendarMatches.length]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Explore Football Knowledge & Tools
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Tactical glossary, iconic stadiums, matchday calendar, favorite clubs & Android APK build info
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 rounded-xl p-1 w-fit">
        {[
          { id: 'glossary' as const, label: 'Football Glossary', icon: BookOpen },
          { id: 'stadiums' as const, label: 'Stadiums Guide', icon: MapPin },
          { id: 'calendar' as const, label: 'Football Calendar', icon: Calendar },
          { id: 'clubs' as const, label: 'My Clubs Dashboard', icon: Heart },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setSubTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                subTab === item.id
                  ? 'bg-[#00E676] text-[#060B16]'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {subTab === 'glossary' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FOOTBALL_GLOSSARY.map((item) => (
            <div
              key={item.term}
              className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-2"
            >
              <p className="text-[11px] font-semibold text-[#00A844] dark:text-[#00E676]">
                {item.category}
              </p>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {item.term}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {item.definition}
              </p>
            </div>
          ))}
        </div>
      )}

      {subTab === 'stadiums' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STADIUMS_DIRECTORY.map((st) => (
            <div
              key={st.name}
              className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-2.5"
            >
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {st.name}
              </h2>
              <p className="text-xs text-slate-500">{st.city}</p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                <p>
                  <span className="text-slate-500">Home: </span>
                  <span className="font-semibold">{st.clubs}</span>
                </p>
                <p>
                  <span className="text-slate-500">Capacity: </span>
                  <span className="font-mono-tabular font-semibold">{st.capacity}</span>
                </p>
                <p>
                  <span className="text-slate-500">Opened: </span>
                  <span className="font-semibold">{st.opened}</span>
                </p>
                <p>
                  <span className="text-slate-500">Pitch: </span>
                  <span className="font-semibold">{st.surface}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === 'calendar' && (
        <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {calendarMatches.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Loading current matchday calendar...
            </p>
          ) : (
            calendarMatches.slice(0, 20).map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedMatchForDetail({ leagueId: m.leagueId, eventId: m.id })}
                className="px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer flex items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">
                    {m.home.name} vs {m.away.name}
                  </p>
                  <p className="text-slate-500">
                    {m.leagueName} · {m.venue || 'Venue TBD'}
                  </p>
                </div>
                <span className="font-mono-tabular font-semibold text-[#00A844] dark:text-[#00E676] shrink-0">
                  {m.date ? new Date(m.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : m.clock}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === 'clubs' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Followed Clubs ({favTeams.length})</h2>
              <button
                onClick={() => setShowOnboarding(true)}
                className="px-4 py-2 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold"
              >
                Edit Selections
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {favTeams.map((team) => (
                <span
                  key={team}
                  className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-xs font-semibold"
                >
                  {team}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-[#00E676] shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-slate-900 dark:text-white">
                Android APK Ready (Capacitor Configured)
              </p>
              <p className="text-slate-500 leading-relaxed">
                This project includes <code className="font-mono-tabular">capacitor.config.ts</code> configured for <code className="font-mono-tabular">com.strscores.app</code>. Build with <code className="font-mono-tabular">npm run build</code> and sync to Android Studio via <code className="font-mono-tabular">npx cap sync android</code> to package an APK.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
