import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  CLUBS_CATALOG,
  LEAGUES_CATALOG,
  NATIONAL_TEAMS_CATALOG,
  PLAYERS_CATALOG,
  POSITIONS_CATALOG,
} from '../data/footballCatalog';
import { useApp, type OnboardingPrefs } from '../context/AppContext';

export function OnboardingModal() {
  const { showOnboarding, setShowOnboarding, userProfile, guestPrefs, savePreferences } = useApp();

  const initial: OnboardingPrefs = userProfile
    ? {
        favoriteTeams: userProfile.favoriteTeams || [],
        favoriteNationalTeams: userProfile.favoriteNationalTeams || [],
        favoriteLeagues: userProfile.favoriteLeagues || [],
        favoritePlayers: userProfile.favoritePlayers || [],
        favoriteCountry: userProfile.favoriteCountry || 'Lebanon',
        favoriteCity: userProfile.favoriteCity || '',
        favoritePosition: userProfile.favoritePosition || 'CAM',
      }
    : guestPrefs;

  const [prefs, setPrefs] = useState<OnboardingPrefs>(initial);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setPrefs(initial);
  }, [showOnboarding]);

  if (!showOnboarding) return null;

  const toggleItem = (
    key: 'favoriteTeams' | 'favoriteNationalTeams' | 'favoriteLeagues' | 'favoritePlayers',
    value: string,
    max: number
  ) => {
    setPrefs((prev) => {
      const list = prev[key];
      if (list.includes(value)) {
        return { ...prev, [key]: list.filter((x) => x !== value) };
      }
      if (list.length >= max) return prev;
      return { ...prev, [key]: [...list, value] };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePreferences(prefs);
      setShowOnboarding(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-3xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Personalize Your Football Universe
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select clubs, leagues, national teams & players to tailor your Home feed and match alerts.
            </p>
          </div>
          <button
            onClick={() => setShowOnboarding(false)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Favorite Leagues */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Favorite Leagues ({prefs.favoriteLeagues.length}/15)
            </h3>
            <div className="flex flex-wrap gap-2">
              {LEAGUES_CATALOG.map((lg) => {
                const active = prefs.favoriteLeagues.includes(lg.id);
                return (
                  <button
                    key={lg.id}
                    type="button"
                    onClick={() => toggleItem('favoriteLeagues', lg.id, 15)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                      active
                        ? 'bg-[#00E676] text-[#060B16] border-[#00E676]'
                        : 'bg-slate-50 dark:bg-[#060B16] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                    {lg.name}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Favorite Clubs */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Favorite Football Clubs ({prefs.favoriteTeams.length}/20)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {CLUBS_CATALOG.map((club) => {
                const active = prefs.favoriteTeams.includes(club.name);
                return (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => toggleItem('favoriteTeams', club.name, 20)}
                    className={`px-3 py-2.5 rounded-xl text-left text-xs font-semibold border transition flex items-center justify-between gap-2 ${
                      active
                        ? 'bg-[#00E676]/15 text-[#00A844] dark:text-[#00E676] border-[#00E676]'
                        : 'bg-slate-50 dark:bg-[#060B16] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-500'
                    }`}
                  >
                    <span className="truncate">{club.name}</span>
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                      style={{ backgroundColor: club.colors[0] }}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          {/* Favorite National Teams */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Favorite National Teams ({prefs.favoriteNationalTeams.length}/10)
            </h3>
            <div className="flex flex-wrap gap-2">
              {NATIONAL_TEAMS_CATALOG.map((nt) => {
                const active = prefs.favoriteNationalTeams.includes(nt);
                return (
                  <button
                    key={nt}
                    type="button"
                    onClick={() => toggleItem('favoriteNationalTeams', nt, 10)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                      active
                        ? 'bg-[#00E676] text-[#060B16] border-[#00E676] font-semibold'
                        : 'bg-slate-50 dark:bg-[#060B16] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {nt}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Favorite Players */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Favorite Players ({prefs.favoritePlayers.length}/20)
            </h3>
            <div className="flex flex-wrap gap-2">
              {PLAYERS_CATALOG.map((pl) => {
                const active = prefs.favoritePlayers.includes(pl);
                return (
                  <button
                    key={pl}
                    type="button"
                    onClick={() => toggleItem('favoritePlayers', pl, 20)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                      active
                        ? 'bg-[#00E676] text-[#060B16] border-[#00E676] font-semibold'
                        : 'bg-slate-50 dark:bg-[#060B16] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {pl}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Country, City, Position */}
          <section className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Favorite Country</label>
              <input
                type="text"
                value={prefs.favoriteCountry}
                onChange={(e) => setPrefs({ ...prefs, favoriteCountry: e.target.value })}
                placeholder="e.g. Lebanon"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">City (optional)</label>
              <input
                type="text"
                value={prefs.favoriteCity}
                onChange={(e) => setPrefs({ ...prefs, favoriteCity: e.target.value })}
                placeholder="e.g. Beirut"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Favorite Position</label>
              <select
                value={prefs.favoritePosition}
                onChange={(e) => setPrefs({ ...prefs, favoritePosition: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm"
              >
                {POSITIONS_CATALOG.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowOnboarding(false)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Skip for now
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-sm hover:brightness-105 transition"
          >
            {saving ? 'Saving...' : 'Save Football Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
