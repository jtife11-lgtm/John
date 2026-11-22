import React, { useEffect, useState } from 'react';
import { Check, Crown, ShieldCheck, Trophy, Users } from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { FANTASY_POOL, type FantasyPlayer } from '../data/footballCatalog';
import { useApp } from '../context/AppContext';
import { t } from '../lib/i18n';
import type { MatchItem } from '../types/str';

export function FantasyPredictions() {
  const { user, lang, pushToast, setShowAuthModal, setAuthModalMode } = useApp();

  const [tab, setTab] = useState<'fantasy' | 'predictions'>('fantasy');
  const [teamName, setTeamName] = useState('STR United XI');
  const [formation, setFormation] = useState<'4-3-3' | '4-4-2' | '3-5-2'>('4-3-3');
  const [selectedIds, setSelectedIds] = useState<string[]>([
    'fp-alisson',
    'fp-saliba',
    'fp-vandijk',
    'fp-hakimi',
    'fp-bastoni',
    'fp-bellingham',
    'fp-salah',
    'fp-palmer',
    'fp-haaland',
    'fp-mbappe',
    'fp-yamal',
  ]);
  const [captainId, setCaptainId] = useState('fp-haaland');
  const [leagueCode, setLeagueCode] = useState('STR-GLOBAL');
  const [leagueTeams, setLeagueTeams] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Match Predictions
  const [upcomingMatches, setUpcomingMatches] = useState<MatchItem[]>([]);
  const [predictions, setPredictions] = useState<Record<string, { home: number; away: number }>>({});
  const [savedPredictions, setSavedPredictions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/football/scoreboard?league=all')
      .then((r) => r.json())
      .then((d) => {
        const list = (Array.isArray(d.matches) ? d.matches : []).slice(0, 10);
        setUpcomingMatches(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubMyTeam = onSnapshot(
      doc(db, 'fantasyTeams', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setTeamName(data.teamName || 'STR United XI');
          setFormation(data.formation || '4-3-3');
          if (Array.isArray(data.playerIds) && data.playerIds.length > 0) {
            setSelectedIds(data.playerIds);
          }
          if (data.captainId) setCaptainId(data.captainId);
          if (data.leagueCode) setLeagueCode(data.leagueCode);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `fantasyTeams/${user.uid}`)
    );

    const unsubLeague = onSnapshot(
      query(collection(db, 'fantasyTeams'), where('leagueCode', '==', leagueCode || 'STR-GLOBAL')),
      (snap) => {
        const rows = snap.docs.map((d) => d.data());
        rows.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
        setLeagueTeams(rows);
      },
      () => {}
    );

    const unsubPreds = onSnapshot(
      query(collection(db, 'predictions'), where('userId', '==', user.uid)),
      (snap) => setSavedPredictions(snap.docs.map((d) => d.data())),
      (err) => handleFirestoreError(err, OperationType.LIST, 'predictions')
    );

    return () => {
      unsubMyTeam();
      unsubLeague();
      unsubPreds();
    };
  }, [user, leagueCode]);

  const selectedPlayers = FANTASY_POOL.filter((p) => selectedIds.includes(p.id));
  const totalCost = selectedPlayers.reduce((sum, p) => sum + p.price, 0);
  const projectedPoints = selectedPlayers.reduce(
    (sum, p) => sum + (p.id === captainId ? p.formPts * 2 : p.formPts),
    0
  );

  const togglePlayer = (player: FantasyPlayer) => {
    if (selectedIds.includes(player.id)) {
      setSelectedIds((prev) => prev.filter((id) => id !== player.id));
      if (captainId === player.id) setCaptainId('');
    } else {
      if (selectedIds.length >= 11) {
        pushToast('Starting squad is limited to 11 players. Deselect one first.', 'info');
        return;
      }
      if (totalCost + player.price > 105) {
        pushToast('Exceeds 105.0M squad budget cap.', 'error');
        return;
      }
      setSelectedIds((prev) => [...prev, player.id]);
    }
  };

  const saveSquad = async () => {
    if (!user) {
      setAuthModalMode('signin');
      setShowAuthModal(true);
      return;
    }
    if (!user.emailVerified) {
      pushToast('Please verify your email to save your Fantasy XI.', 'info');
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'fantasyTeams', user.uid),
        {
          userId: user.uid,
          teamName: teamName.trim().slice(0, 50) || 'STR United XI',
          formation,
          playerIds: selectedIds.slice(0, 15),
          captainId: captainId || selectedIds[0] || '',
          leagueCode: leagueCode.trim().toUpperCase().slice(0, 24) || 'STR-GLOBAL',
          totalPoints: Math.round(projectedPoints),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      pushToast('Fantasy XI saved to private league!', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `fantasyTeams/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const submitPrediction = async (match: MatchItem) => {
    if (!user) {
      setAuthModalMode('signin');
      setShowAuthModal(true);
      return;
    }
    if (!user.emailVerified) {
      pushToast('Verify your email to lock in match predictions.', 'info');
      return;
    }
    const pred = predictions[match.id] || { home: 1, away: 1 };
    const docId = `${user.uid.slice(0, 12)}_${match.id.replace(/[^a-zA-Z0-9_-]/g, '')}`.slice(0, 100);
    try {
      await setDoc(doc(db, 'predictions', docId), {
        userId: user.uid,
        matchId: match.id.replace(/[^a-zA-Z0-9_-]/g, ''),
        matchTitle: `${match.home.shortName} vs ${match.away.shortName}`.slice(0, 120),
        homeScore: Math.max(0, Math.min(30, pred.home)),
        awayScore: Math.max(0, Math.min(30, pred.away)),
        createdAt: serverTimestamp(),
      });
      pushToast('Prediction locked in!', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `predictions/${docId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Trophy className="w-7 h-7 text-[#00E676]" />
            STR Fantasy & Predictions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">{t(lang, 'noGamblingNote')}</p>
        </div>

        <div className="flex items-center gap-1.5 bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 rounded-xl p-1">
          <button
            onClick={() => setTab('fantasy')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              tab === 'fantasy'
                ? 'bg-[#00E676] text-[#060B16]'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Fantasy XI Builder
          </button>
          <button
            onClick={() => setTab('predictions')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              tab === 'predictions'
                ? 'bg-[#00E676] text-[#060B16]'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Match Predictions
          </button>
        </div>
      </div>

      {tab === 'fantasy' ? (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left: Squad Builder & Settings */}
          <div className="lg:col-span-8 space-y-5">
            <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Squad Name
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Formation
                  </label>
                  <select
                    value={formation}
                    onChange={(e) => setFormation(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm font-semibold"
                  >
                    <option value="4-3-3">4-3-3</option>
                    <option value="4-4-2">4-4-2</option>
                    <option value="3-5-2">3-5-2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Private League Code
                  </label>
                  <input
                    type="text"
                    value={leagueCode}
                    onChange={(e) => setLeagueCode(e.target.value.toUpperCase())}
                    placeholder="STR-GLOBAL"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm font-mono-tabular font-semibold"
                  />
                </div>
              </div>

              {/* Squad Summary Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex flex-wrap items-center gap-4 font-mono-tabular">
                  <span>
                    Players: <strong>{selectedIds.length}/11</strong>
                  </span>
                  <span>
                    Budget: <strong>{totalCost.toFixed(1)}M / 105.0M</strong>
                  </span>
                  <span className="text-[#00A844] dark:text-[#00E676] font-bold">
                    Season Form Score: {projectedPoints} pts
                  </span>
                </div>
                <button
                  onClick={saveSquad}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-xs hover:brightness-105 transition"
                >
                  {saving ? 'Saving...' : 'Save Fantasy Squad'}
                </button>
              </div>
            </div>

            {/* Player Pool Selection */}
            <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Select Real Players ({FANTASY_POOL.length} Pool)
              </h2>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {FANTASY_POOL.map((p) => {
                  const picked = selectedIds.includes(p.id);
                  const isCap = captainId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => togglePlayer(p)}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between gap-2 transition ${
                        picked
                          ? 'bg-[#00E676]/10 border-[#00E676]'
                          : 'bg-slate-50 dark:bg-[#060B16] border-slate-200 dark:border-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {p.position} · {p.club}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {picked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCaptainId(p.id);
                            }}
                            title="Set Captain (2x points)"
                            className={`p-1.5 rounded-lg text-[10px] font-bold ${
                              isCap
                                ? 'bg-[#00E676] text-[#060B16]'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            <Crown className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="font-mono-tabular text-xs font-bold">
                          {p.price.toFixed(1)}M
                        </span>
                        {picked && <Check className="w-4 h-4 text-[#00E676]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Private League Standings */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00E676]" />
                League: {leagueCode || 'STR-GLOBAL'}
              </h3>
              <p className="text-xs text-slate-500">
                Share this league code with friends so they can join and compete on the same table.
              </p>
              {!user ? (
                <p className="text-xs text-slate-500">Sign in to view and join private friend leagues.</p>
              ) : leagueTeams.length === 0 ? (
                <p className="text-xs text-slate-500">No squads saved in this league yet. Save yours to lead!</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {leagueTeams.map((tm, idx) => (
                    <div key={tm.userId} className="py-2.5 flex items-center justify-between text-xs">
                      <span className="font-semibold">
                        #{idx + 1} {tm.teamName} ({tm.formation})
                      </span>
                      <span className="font-mono-tabular font-bold text-[#00A844] dark:text-[#00E676]">
                        {tm.totalPoints} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-500 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
              <span>{t(lang, 'noGamblingNote')}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {upcomingMatches.length === 0 ? (
            <div className="md:col-span-2 p-8 rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
              No fixtures loaded right now for score predictions.
            </div>
          ) : (
            upcomingMatches.map((m) => {
              const existing = savedPredictions.find((p) => p.matchId === m.id);
              const val = predictions[m.id] || {
                home: existing?.homeScore ?? 1,
                away: existing?.awayScore ?? 1,
              };
              return (
                <div
                  key={m.id}
                  className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                >
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>{m.leagueName}</span>
                    <span>{m.status}</span>
                  </div>
                  <div className="grid grid-cols-3 items-center gap-2 text-center">
                    <span className="text-xs font-bold truncate">{m.home.shortName}</span>
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={val.home}
                        onChange={(e) =>
                          setPredictions({
                            ...predictions,
                            [m.id]: { ...val, home: Number(e.target.value) },
                          })
                        }
                        className="w-12 py-1.5 text-center rounded-lg bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-700 font-mono-tabular text-sm font-bold"
                      />
                      <span>:</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={val.away}
                        onChange={(e) =>
                          setPredictions({
                            ...predictions,
                            [m.id]: { ...val, away: Number(e.target.value) },
                          })
                        }
                        className="w-12 py-1.5 text-center rounded-lg bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-700 font-mono-tabular text-sm font-bold"
                      />
                    </div>
                    <span className="text-xs font-bold truncate">{m.away.shortName}</span>
                  </div>
                  <button
                    onClick={() => submitPrediction(m)}
                    className="w-full py-2 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold hover:brightness-105 transition"
                  >
                    {existing ? 'Update Prediction' : 'Lock Prediction (For Fun)'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
