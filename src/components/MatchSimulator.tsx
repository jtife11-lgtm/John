import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  Check,
  History,
  Play,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import {
  ALL_SIM_PLAYERS_POOL,
  getTeamById,
  SIMULATOR_TEAMS,
  TACTICAL_STYLES,
} from '../data/simulatorTeams';
import { createInitialMatchState, generateMatchReport } from '../lib/matchSimulatorEngine';
import type {
  CustomTournamentState,
  SavedSimRecord,
  SimFormation,
  SimGameMode,
  SimMatchState,
  SimPlayer,
  SimTeam,
  TacticalStyle,
  TournamentMatchSlot,
} from '../types/simulator';
import { SimulatorPitch2D } from './simulator/SimulatorPitch2D';
import { SimulatorTeamBadge } from './simulator/SimulatorTeamBadge';
import { SimulatorMatchCenter } from './simulator/SimulatorMatchCenter';

const LOCAL_HISTORY_KEY = 'str_sim_history_v1';

const GAME_MODES: {
  id: SimGameMode;
  label: string;
  competitionLabel: string;
  defaultHome: string;
  defaultAway: string;
  defaultKnockout: boolean;
  subtitle: string;
}[] = [
  {
    id: 'quick',
    label: 'Quick Match',
    competitionLabel: 'STR International Friendly',
    defaultHome: 'real-madrid',
    defaultAway: 'liverpool',
    defaultKnockout: false,
    subtitle: 'Pick any two clubs or nations and kick off instantly',
  },
  {
    id: 'ucl',
    label: 'Champions League',
    competitionLabel: 'UEFA Champions League',
    defaultHome: 'real-madrid',
    defaultAway: 'man-city',
    defaultKnockout: true,
    subtitle: 'European knockout tie with Extra Time & Penalties',
  },
  {
    id: 'epl',
    label: 'Premier League',
    competitionLabel: 'Premier League',
    defaultHome: 'arsenal',
    defaultAway: 'liverpool',
    defaultKnockout: false,
    subtitle: 'English top-flight matchday tactics & table clash',
  },
  {
    id: 'laliga',
    label: 'La Liga',
    competitionLabel: 'La Liga EA Sports',
    defaultHome: 'real-madrid',
    defaultAway: 'barcelona',
    defaultKnockout: false,
    subtitle: 'El Clásico & Spanish technical possession battle',
  },
  {
    id: 'world_cup',
    label: 'World Cup',
    competitionLabel: 'FIFA World Cup Knockout',
    defaultHome: 'argentina',
    defaultAway: 'france',
    defaultKnockout: true,
    subtitle: 'National teams with Extra Time & Penalty Shootout',
  },
  {
    id: 'tournament',
    label: 'Custom Tournament',
    competitionLabel: 'STR Cup Championship',
    defaultHome: 'real-madrid',
    defaultAway: 'bayern',
    defaultKnockout: true,
    subtitle: 'Playable 4-team or 8-team knockout bracket to lift the trophy',
  },
  {
    id: 'dream',
    label: 'Dream Match',
    competitionLabel: 'STR Dream Exhibition',
    defaultHome: 'str-world-xi',
    defaultAway: 'str-legends-xi',
    defaultKnockout: true,
    subtitle: 'Draft superstars & Icons into custom starting XIs',
  },
];

function createTournamentBracket(size: 4 | 8, selectedIds: string[]): CustomTournamentState {
  const pool = [...selectedIds];
  if (size === 4) {
    const slots: TournamentMatchSlot[] = [
      {
        id: 'sf-1',
        round: 'SF',
        label: 'Semi-Final 1',
        homeTeamId: pool[0] || null,
        awayTeamId: pool[1] || null,
        winnerId: null,
        completed: false,
      },
      {
        id: 'sf-2',
        round: 'SF',
        label: 'Semi-Final 2',
        homeTeamId: pool[2] || null,
        awayTeamId: pool[3] || null,
        winnerId: null,
        completed: false,
      },
      {
        id: 'final',
        round: 'FINAL',
        label: 'Cup Final',
        homeTeamId: null,
        awayTeamId: null,
        winnerId: null,
        completed: false,
      },
    ];
    return {
      name: 'STR Elite Cup',
      size,
      teamIds: pool.slice(0, 4),
      slots,
      championId: null,
    };
  }

  const slots: TournamentMatchSlot[] = [
    { id: 'qf-1', round: 'QF', label: 'Quarter-Final 1', homeTeamId: pool[0], awayTeamId: pool[1], winnerId: null, completed: false },
    { id: 'qf-2', round: 'QF', label: 'Quarter-Final 2', homeTeamId: pool[2], awayTeamId: pool[3], winnerId: null, completed: false },
    { id: 'qf-3', round: 'QF', label: 'Quarter-Final 3', homeTeamId: pool[4], awayTeamId: pool[5], winnerId: null, completed: false },
    { id: 'qf-4', round: 'QF', label: 'Quarter-Final 4', homeTeamId: pool[6], awayTeamId: pool[7], winnerId: null, completed: false },
    { id: 'sf-1', round: 'SF', label: 'Semi-Final 1', homeTeamId: null, awayTeamId: null, winnerId: null, completed: false },
    { id: 'sf-2', round: 'SF', label: 'Semi-Final 2', homeTeamId: null, awayTeamId: null, winnerId: null, completed: false },
    { id: 'final', round: 'FINAL', label: 'Championship Final', homeTeamId: null, awayTeamId: null, winnerId: null, completed: false },
  ];
  return {
    name: 'STR Champions Invitational',
    size,
    teamIds: pool.slice(0, 8),
    slots,
    championId: null,
  };
}

export function MatchSimulator() {
  const { user, addPoints, pushToast } = useApp();

  const [mode, setMode] = useState<SimGameMode>('quick');
  const [viewMode, setViewMode] = useState<'studio' | 'history'>('studio');

  // Pre-match squad configuration
  const [homeTeamId, setHomeTeamId] = useState<string>('real-madrid');
  const [awayTeamId, setAwayTeamId] = useState<string>('liverpool');
  const [formationHome, setFormationHome] = useState<SimFormation>('4-3-3');
  const [formationAway, setFormationAway] = useState<SimFormation>('4-2-3-1');
  const [styleHome, setStyleHome] = useState<TacticalStyle>('Counter-Attack');
  const [styleAway, setStyleAway] = useState<TacticalStyle>('High Press');
  const [knockoutRules, setKnockoutRules] = useState<boolean>(false);

  const [homeStarters, setHomeStarters] = useState<SimPlayer[]>(() => getTeamById('real-madrid').starters);
  const [homeBench, setHomeBench] = useState<SimPlayer[]>(() => getTeamById('real-madrid').bench);
  const [awayStarters, setAwayStarters] = useState<SimPlayer[]>(() => getTeamById('liverpool').starters);
  const [awayBench, setAwayBench] = useState<SimPlayer[]>(() => getTeamById('liverpool').bench);

  // Swap / Dream Match Drafter state
  const [selectedSwap, setSelectedSwap] = useState<{
    side: 'home' | 'away';
    zone: 'starter' | 'bench';
    playerId: string;
  } | null>(null);
  const [dreamPickerTarget, setDreamPickerTarget] = useState<{
    side: 'home' | 'away';
    slotIndex: number;
  } | null>(null);
  const [dreamSearch, setDreamSearch] = useState('');

  // Custom Tournament State
  const [tournamentSize, setTournamentSize] = useState<4 | 8>(8);
  const [tournament, setTournament] = useState<CustomTournamentState>(() =>
    createTournamentBracket(8, [
      'real-madrid',
      'man-city',
      'barcelona',
      'liverpool',
      'bayern',
      'arsenal',
      'psg',
      'inter',
    ])
  );
  const [activeTournamentSlotId, setActiveTournamentSlotId] = useState<string | null>(null);

  // Active Match Center State
  const [activeMatch, setActiveMatch] = useState<SimMatchState | null>(null);
  const [savedCurrent, setSavedCurrent] = useState<boolean>(false);
  const [savingReport, setSavingReport] = useState<boolean>(false);

  // Saved Match History
  const [localHistory, setLocalHistory] = useState<SavedSimRecord[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [cloudHistory, setCloudHistory] = useState<SavedSimRecord[]>([]);

  useEffect(() => {
    if (!user) {
      setCloudHistory([]);
      return;
    }
    const q = query(
      collection(db, 'simMatches'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: SavedSimRecord[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            userId: data.userId,
            mode: data.mode,
            competitionLabel: data.competitionLabel,
            homeTeamId: data.homeTeamId,
            homeName: data.homeName,
            awayTeamId: data.awayTeamId,
            awayName: data.awayName,
            homeScore: data.homeScore,
            awayScore: data.awayScore,
            homePenScore: data.homePenScore,
            awayPenScore: data.awayPenScore,
            wentToExtraTime: Boolean(data.wentToExtraTime),
            wentToPenalties: Boolean(data.wentToPenalties),
            formationHome: data.formationHome,
            formationAway: data.formationAway,
            manOfTheMatch: data.manOfTheMatch,
            motmRating: data.motmRating,
            summaryLine: data.summaryLine,
            possessionHome: data.possessionHome,
            shotsHome: data.shotsHome,
            shotsAway: data.shotsAway,
            keyEvents: Array.isArray(data.keyEvents) ? data.keyEvents : [],
            createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          };
        });
        setCloudHistory(list);
      },
      () => {}
    );
    return () => unsub();
  }, [user]);

  const homeTeam = useMemo(() => getTeamById(homeTeamId), [homeTeamId]);
  const awayTeam = useMemo(() => getTeamById(awayTeamId), [awayTeamId]);

  const modeMeta = useMemo(() => GAME_MODES.find((m) => m.id === mode)!, [mode]);

  const availableTeams = useMemo(() => {
    if (mode === 'epl') return SIMULATOR_TEAMS.filter((t) => t.competitionTag === 'epl');
    if (mode === 'laliga') return SIMULATOR_TEAMS.filter((t) => t.competitionTag === 'laliga');
    if (mode === 'world_cup') return SIMULATOR_TEAMS.filter((t) => t.competitionTag === 'world_cup');
    if (mode === 'ucl')
      return SIMULATOR_TEAMS.filter(
        (t) => t.competitionTag === 'ucl' || t.competitionTag === 'epl' || t.competitionTag === 'laliga'
      );
    return SIMULATOR_TEAMS;
  }, [mode]);

  const applyTeamSelection = (side: 'home' | 'away', teamId: string) => {
    const team = getTeamById(teamId);
    if (side === 'home') {
      setHomeTeamId(team.id);
      setFormationHome(team.defaultFormation);
      setStyleHome(team.tacticalStyle);
      setHomeStarters(team.starters);
      setHomeBench(team.bench);
    } else {
      setAwayTeamId(team.id);
      setFormationAway(team.defaultFormation);
      setStyleAway(team.tacticalStyle);
      setAwayStarters(team.starters);
      setAwayBench(team.bench);
    }
    setSelectedSwap(null);
  };

  const handleModeChange = (nextMode: SimGameMode) => {
    setMode(nextMode);
    setViewMode('studio');
    const meta = GAME_MODES.find((m) => m.id === nextMode)!;
    applyTeamSelection('home', meta.defaultHome);
    applyTeamSelection('away', meta.defaultAway);
    setKnockoutRules(meta.defaultKnockout);
    setDreamPickerTarget(null);
  };

  const handleSwapSides = () => {
    const prevH = homeTeamId;
    const prevA = awayTeamId;
    const fH = formationHome;
    const fA = formationAway;
    const sH = styleHome;
    const sA = styleAway;
    const hs = homeStarters;
    const hb = homeBench;
    const as = awayStarters;
    const ab = awayBench;

    setHomeTeamId(prevA);
    setAwayTeamId(prevH);
    setFormationHome(fA);
    setFormationAway(fH);
    setStyleHome(sA);
    setStyleAway(sH);
    setHomeStarters(as);
    setHomeBench(ab);
    setAwayStarters(hs);
    setAwayBench(hb);
    setSelectedSwap(null);
  };

  const handleRandomDerby = () => {
    const list = availableTeams.length >= 2 ? availableTeams : SIMULATOR_TEAMS;
    const i1 = Math.floor(Math.random() * list.length);
    let i2 = Math.floor(Math.random() * list.length);
    if (i2 === i1) i2 = (i1 + 1) % list.length;
    applyTeamSelection('home', list[i1].id);
    applyTeamSelection('away', list[i2].id);
  };

  const handleLineupClick = (
    side: 'home' | 'away',
    zone: 'starter' | 'bench',
    playerId: string,
    slotIndex?: number
  ) => {
    if (mode === 'dream' && zone === 'starter' && typeof slotIndex === 'number' && !selectedSwap) {
      setDreamPickerTarget({ side, slotIndex });
    }

    if (!selectedSwap) {
      setSelectedSwap({ side, zone, playerId });
      return;
    }

    if (selectedSwap.side !== side || selectedSwap.playerId === playerId) {
      setSelectedSwap(null);
      return;
    }

    const starters = side === 'home' ? [...homeStarters] : [...awayStarters];
    const bench = side === 'home' ? [...homeBench] : [...awayBench];

    const sIdxA = starters.findIndex((p) => p.id === selectedSwap.playerId);
    const bIdxA = bench.findIndex((p) => p.id === selectedSwap.playerId);
    const sIdxB = starters.findIndex((p) => p.id === playerId);
    const bIdxB = bench.findIndex((p) => p.id === playerId);

    if (sIdxA >= 0 && sIdxB >= 0) {
      const tmp = starters[sIdxA];
      starters[sIdxA] = starters[sIdxB];
      starters[sIdxB] = tmp;
    } else if (sIdxA >= 0 && bIdxB >= 0) {
      const tmp = starters[sIdxA];
      starters[sIdxA] = bench[bIdxB];
      bench[bIdxB] = tmp;
    } else if (bIdxA >= 0 && sIdxB >= 0) {
      const tmp = bench[bIdxA];
      bench[bIdxA] = starters[sIdxB];
      starters[sIdxB] = tmp;
    }

    if (side === 'home') {
      setHomeStarters(starters);
      setHomeBench(bench);
    } else {
      setAwayStarters(starters);
      setAwayBench(bench);
    }
    setSelectedSwap(null);
    setDreamPickerTarget(null);
  };

  const handleDraftDreamPlayer = (player: SimPlayer) => {
    if (!dreamPickerTarget) return;
    const { side, slotIndex } = dreamPickerTarget;
    const drafted: SimPlayer = { ...player, id: `dream-${side}-${slotIndex}-${player.id}` };
    if (side === 'home') {
      setHomeStarters((prev) => prev.map((x, idx) => (idx === slotIndex ? drafted : x)));
    } else {
      setAwayStarters((prev) => prev.map((x, idx) => (idx === slotIndex ? drafted : x)));
    }
    setDreamPickerTarget(null);
    setSelectedSwap(null);
    pushToast(`Drafted ${player.name} (${player.overall} OVR)`, 'success');
  };

  const launchMatch = (overrideCfg?: {
    homeTeam: SimTeam;
    awayTeam: SimTeam;
    compLabel: string;
    knockout: boolean;
    slotId?: string;
  }) => {
    const hT = overrideCfg?.homeTeam || homeTeam;
    const aT = overrideCfg?.awayTeam || awayTeam;
    const init = createInitialMatchState({
      mode,
      competitionLabel: overrideCfg?.compLabel || modeMeta.competitionLabel,
      knockoutRules: overrideCfg ? overrideCfg.knockout : knockoutRules,
      homeTeam: hT,
      awayTeam: aT,
      formationHome: overrideCfg ? hT.defaultFormation : formationHome,
      formationAway: overrideCfg ? aT.defaultFormation : formationAway,
      styleHome: overrideCfg ? hT.tacticalStyle : styleHome,
      styleAway: overrideCfg ? aT.tacticalStyle : styleAway,
      homeStarters: overrideCfg ? hT.starters : homeStarters,
      homeBench: overrideCfg ? hT.bench : homeBench,
      awayStarters: overrideCfg ? aT.starters : awayStarters,
      awayBench: overrideCfg ? aT.bench : awayBench,
    });
    setActiveTournamentSlotId(overrideCfg?.slotId || null);
    setSavedCurrent(false);
    setActiveMatch(init);
  };

  const handleSaveReport = async (finalState: SimMatchState) => {
    if (savedCurrent || savingReport) return;
    setSavingReport(true);
    try {
      const report = generateMatchReport(finalState);
      const keyEvents = finalState.events
        .filter((e) => e.isKey)
        .slice(0, 14)
        .map((e) => `${e.minuteLabel} ${e.text}`)
        .reverse();

      const newRecord: SavedSimRecord = {
        id: finalState.matchId,
        userId: user?.uid,
        mode: finalState.mode,
        competitionLabel: finalState.competitionLabel,
        homeTeamId: finalState.homeTeam.id,
        homeName: finalState.homeTeam.name,
        awayTeamId: finalState.awayTeam.id,
        awayName: finalState.awayTeam.name,
        homeScore: finalState.homeScore,
        awayScore: finalState.awayScore,
        homePenScore: finalState.shootoutKicks.length > 0 ? finalState.homePenScore : undefined,
        awayPenScore: finalState.shootoutKicks.length > 0 ? finalState.awayPenScore : undefined,
        wentToExtraTime: report.wentToExtraTime,
        wentToPenalties: report.wentToPenalties,
        formationHome: finalState.formationHome,
        formationAway: finalState.formationAway,
        manOfTheMatch: report.manOfTheMatch.player.name,
        motmRating: report.manOfTheMatch.rating.toFixed(1),
        summaryLine: report.summaryLine.slice(0, 290),
        possessionHome: finalState.stats.possessionHome,
        shotsHome: finalState.stats.shotsHome,
        shotsAway: finalState.stats.shotsAway,
        keyEvents,
        createdAtMs: Date.now(),
      };

      const nextLocal = [newRecord, ...localHistory].slice(0, 30);
      setLocalHistory(nextLocal);
      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(nextLocal));

      if (user) {
        await addDoc(collection(db, 'simMatches'), {
          userId: user.uid,
          mode: newRecord.mode,
          competitionLabel: newRecord.competitionLabel,
          homeTeamId: newRecord.homeTeamId,
          homeName: newRecord.homeName,
          awayTeamId: newRecord.awayTeamId,
          awayName: newRecord.awayName,
          homeScore: newRecord.homeScore,
          awayScore: newRecord.awayScore,
          ...(typeof newRecord.homePenScore === 'number'
            ? { homePenScore: newRecord.homePenScore, awayPenScore: newRecord.awayPenScore }
            : {}),
          wentToExtraTime: newRecord.wentToExtraTime,
          wentToPenalties: newRecord.wentToPenalties,
          formationHome: newRecord.formationHome,
          formationAway: newRecord.formationAway,
          manOfTheMatch: newRecord.manOfTheMatch,
          motmRating: newRecord.motmRating,
          summaryLine: newRecord.summaryLine,
          possessionHome: newRecord.possessionHome,
          shotsHome: newRecord.shotsHome,
          shotsAway: newRecord.shotsAway,
          keyEvents: newRecord.keyEvents.slice(0, 16),
          createdAt: serverTimestamp(),
        });
        await addPoints(15, 'Match Tactician');
      }

      setSavedCurrent(true);
      pushToast('Match saved to History (+15 pts)', 'success');
    } catch {
      pushToast('Saved locally; cloud sync requires verified sign-in.', 'info');
      setSavedCurrent(true);
    } finally {
      setSavingReport(false);
    }
  };

  const handleDeleteHistory = async (rec: SavedSimRecord) => {
    const filtered = localHistory.filter((x) => x.id !== rec.id);
    setLocalHistory(filtered);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(filtered));
    if (user && rec.userId === user.uid) {
      try {
        await deleteDoc(doc(db, 'simMatches', rec.id));
      } catch {}
    }
    pushToast('Removed match from history', 'info');
  };

  // Handle Custom Tournament Advancement
  const handleTournamentSlotComplete = (finalState: SimMatchState) => {
    if (!activeTournamentSlotId) {
      setActiveMatch(null);
      return;
    }
    const report = generateMatchReport(finalState);
    const winnerId =
      report.winnerSide === 'home'
        ? finalState.homeTeam.id
        : finalState.awayTeam.id;

    setTournament((prev) => {
      const updatedSlots = prev.slots.map((s) =>
        s.id === activeTournamentSlotId
          ? {
              ...s,
              homeScore: finalState.homeScore,
              awayScore: finalState.awayScore,
              homePenScore: finalState.shootoutKicks.length > 0 ? finalState.homePenScore : undefined,
              awayPenScore: finalState.shootoutKicks.length > 0 ? finalState.awayPenScore : undefined,
              winnerId,
              completed: true,
            }
          : s
      );

      // Propagate winners into next round slots
      const findSlot = (id: string) => updatedSlots.find((s) => s.id === id);
      if (prev.size === 4) {
        const sf1 = findSlot('sf-1');
        const sf2 = findSlot('sf-2');
        const fin = findSlot('final');
        if (fin) {
          fin.homeTeamId = sf1?.winnerId || fin.homeTeamId;
          fin.awayTeamId = sf2?.winnerId || fin.awayTeamId;
        }
      } else {
        const qf1 = findSlot('qf-1');
        const qf2 = findSlot('qf-2');
        const qf3 = findSlot('qf-3');
        const qf4 = findSlot('qf-4');
        const sf1 = findSlot('sf-1');
        const sf2 = findSlot('sf-2');
        const fin = findSlot('final');
        if (sf1) {
          sf1.homeTeamId = qf1?.winnerId || sf1.homeTeamId;
          sf1.awayTeamId = qf2?.winnerId || sf1.awayTeamId;
        }
        if (sf2) {
          sf2.homeTeamId = qf3?.winnerId || sf2.homeTeamId;
          sf2.awayTeamId = qf4?.winnerId || sf2.awayTeamId;
        }
        if (fin) {
          fin.homeTeamId = sf1?.winnerId || fin.homeTeamId;
          fin.awayTeamId = sf2?.winnerId || fin.awayTeamId;
        }
      }

      const finSlot = updatedSlots.find((s) => s.id === 'final');
      return {
        ...prev,
        slots: updatedSlots,
        championId: finSlot?.completed ? finSlot.winnerId : null,
      };
    });

    handleSaveReport(finalState);
    setActiveMatch(null);
    setActiveTournamentSlotId(null);
  };

  const handleShuffleBracket = (size: 4 | 8) => {
    const shuffled = [...SIMULATOR_TEAMS]
      .filter((t) => !t.id.startsWith('str-'))
      .sort(() => Math.random() - 0.5)
      .slice(0, size)
      .map((t) => t.id);
    setTournamentSize(size);
    setTournament(createTournamentBracket(size, shuffled));
  };

  const mergedHistory = useMemo(() => {
    const map = new Map<string, SavedSimRecord>();
    for (const r of [...cloudHistory, ...localHistory]) {
      if (!map.has(r.id)) map.set(r.id, r);
    }
    return Array.from(map.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [cloudHistory, localHistory]);

  const filteredDreamPool = useMemo(() => {
    const q = dreamSearch.trim().toLowerCase();
    if (!q) return ALL_SIM_PLAYERS_POOL.slice(0, 40);
    return ALL_SIM_PLAYERS_POOL.filter(
      (item) =>
        item.player.name.toLowerCase().includes(q) ||
        item.player.position.toLowerCase().includes(q) ||
        item.teamName.toLowerCase().includes(q)
    ).slice(0, 40);
  }, [dreamSearch]);

  // If currently inside an active simulation match, render SimulatorMatchCenter
  if (activeMatch) {
    return (
      <SimulatorMatchCenter
        initialState={activeMatch}
        onExit={() => {
          setActiveMatch(null);
          setActiveTournamentSlotId(null);
        }}
        onSaveReport={handleSaveReport}
        onRematch={() =>
          launchMatch(
            activeTournamentSlotId
              ? {
                  homeTeam: activeMatch.homeTeam,
                  awayTeam: activeMatch.awayTeam,
                  compLabel: activeMatch.competitionLabel,
                  knockout: true,
                  slotId: activeTournamentSlotId,
                }
              : undefined
          )
        }
        isSaved={savedCurrent}
        saving={savingReport}
        tournamentActionLabel={activeTournamentSlotId ? 'Advance Bracket & Save' : undefined}
        onTournamentFinish={activeTournamentSlotId ? handleTournamentSlotComplete : undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Studio Banner */}
      <div className="rounded-3xl bg-[#07090F] text-white border border-slate-800 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#E11D48]">
            <Swords className="w-3.5 h-3.5" />
            STR SCORES Football Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight">
            Football Match Simulator
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            {modeMeta.subtitle} · 60 FPS animated pitch, VAR reviews, live tactics & player ratings.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setViewMode('studio')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition min-h-[42px] ${
              viewMode === 'studio'
                ? 'bg-[#E11D48] text-white'
                : 'bg-white/10 text-slate-200 hover:bg-white/15'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Match Studio
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition min-h-[42px] ${
              viewMode === 'history'
                ? 'bg-[#E11D48] text-white'
                : 'bg-white/10 text-slate-200 hover:bg-white/15'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            History ({mergedHistory.length})
          </button>
        </div>
      </div>

      {/* SAVED MATCH HISTORY VIEW */}
      {viewMode === 'history' ? (
        <div className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-black">Saved Simulated Matches</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {user ? 'Synced with Cloud & Device' : 'Saved on Device'}
            </span>
          </div>

          {mergedHistory.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Trophy className="w-10 h-10 mx-auto text-slate-400" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                No simulated matches saved yet. Play a match and click "Save Match History" at Full Time!
              </p>
              <button
                onClick={() => setViewMode('studio')}
                className="px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
              >
                Start First Match
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mergedHistory.map((rec) => {
                const hTeam = getTeamById(rec.homeTeamId);
                const aTeam = getTeamById(rec.awayTeamId);
                return (
                  <div
                    key={rec.id}
                    className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      <span className="text-[#E11D48] font-bold">{rec.competitionLabel}</span>
                      <div className="flex items-center gap-2">
                        <span>{new Date(rec.createdAtMs).toLocaleDateString()}</span>
                        <button
                          onClick={() => handleDeleteHistory(rec)}
                          title="Delete saved match"
                          className="p-1 text-slate-400 hover:text-[#E11D48] transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <SimulatorTeamBadge team={hTeam} size="sm" />
                        <span className="font-bold text-sm truncate">{rec.homeName}</span>
                      </div>
                      <div className="px-3 py-1 rounded-xl bg-[#07090F] text-white font-mono-tabular font-black text-base shrink-0">
                        {rec.homeScore} – {rec.awayScore}
                        {rec.wentToPenalties && typeof rec.homePenScore === 'number' && (
                          <span className="text-[10px] text-amber-400 ml-1.5">
                            ({rec.homePenScore}–{rec.awayPenScore}p)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-2 min-w-0 flex-1">
                        <span className="font-bold text-sm truncate">{rec.awayName}</span>
                        <SimulatorTeamBadge team={aTeam} size="sm" />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        🏆 MOTM: <strong className="text-slate-900 dark:text-white">{rec.manOfTheMatch}</strong> ({rec.motmRating})
                      </span>
                      <span className="font-mono-tabular">
                        Poss {rec.possessionHome}% · Shots {rec.shotsHome}–{rec.shotsAway}
                      </span>
                    </div>

                    {rec.keyEvents.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-1 text-[11px] text-slate-600 dark:text-slate-400 max-h-24 overflow-y-auto">
                        {rec.keyEvents.slice(0, 4).map((line, i) => (
                          <p key={i} className="truncate">
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 7 GAME MODES SELECTOR */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {GAME_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition min-h-[42px] border ${
                  mode === m.id
                    ? 'bg-[#E11D48] text-white border-[#E11D48] shadow-md shadow-[#E11D48]/25'
                    : 'bg-white dark:bg-[#0F1219] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-[#E11D48]/50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* CUSTOM TOURNAMENT BRACKET VIEW */}
          {mode === 'tournament' ? (
            <div className="rounded-3xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-display font-black flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    {tournament.name} ({tournament.size}-Team Knockout)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Click any ready tie to play it live. Winners automatically advance to lift the trophy!
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {([4, 8] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => handleShuffleBracket(sz)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        tournamentSize === sz
                          ? 'bg-[#E11D48] text-white border-[#E11D48]'
                          : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10'
                      }`}
                    >
                      {sz}-Team Cup
                    </button>
                  ))}
                  <button
                    onClick={() => handleShuffleBracket(tournamentSize)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white/10 text-white text-xs font-bold hover:bg-[#E11D48] transition"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    New Draw
                  </button>
                </div>
              </div>

              {tournament.championId && (
                <div className="rounded-2xl bg-gradient-to-r from-amber-500/20 via-[#E11D48]/15 to-amber-500/20 border border-amber-400/50 p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <SimulatorTeamBadge team={getTeamById(tournament.championId)} size="lg" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-amber-400">
                        Tournament Champions
                      </p>
                      <h3 className="text-xl font-display font-black">
                        {getTeamById(tournament.championId).name} Lift the Trophy!
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => handleShuffleBracket(tournamentSize)}
                    className="px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold shrink-0"
                  >
                    Start New Cup
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tournament.slots.map((slot) => {
                  const hT = slot.homeTeamId ? getTeamById(slot.homeTeamId) : null;
                  const aT = slot.awayTeamId ? getTeamById(slot.awayTeamId) : null;
                  const ready = Boolean(hT && aT && !slot.completed);

                  return (
                    <div
                      key={slot.id}
                      className={`rounded-2xl p-4 border space-y-3 ${
                        slot.round === 'FINAL'
                          ? 'bg-gradient-to-br from-amber-500/10 to-transparent border-amber-400/40'
                          : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-[#E11D48] uppercase tracking-wider">{slot.label}</span>
                        <span className="text-slate-400">
                          {slot.completed ? 'Completed' : ready ? 'Ready' : 'Awaiting Winner'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            {hT ? (
                              <>
                                <SimulatorTeamBadge team={hT} size="xs" />
                                <span
                                  className={`truncate font-bold ${
                                    slot.winnerId === hT.id ? 'text-emerald-400' : ''
                                  }`}
                                >
                                  {hT.shortName}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-400 italic">TBD</span>
                            )}
                          </div>
                          {slot.completed && (
                            <span className="font-mono-tabular font-black text-sm">
                              {slot.homeScore}
                              {typeof slot.homePenScore === 'number' ? ` (${slot.homePenScore})` : ''}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            {aT ? (
                              <>
                                <SimulatorTeamBadge team={aT} size="xs" />
                                <span
                                  className={`truncate font-bold ${
                                    slot.winnerId === aT.id ? 'text-emerald-400' : ''
                                  }`}
                                >
                                  {aT.shortName}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-400 italic">TBD</span>
                            )}
                          </div>
                          {slot.completed && (
                            <span className="font-mono-tabular font-black text-sm">
                              {slot.awayScore}
                              {typeof slot.awayPenScore === 'number' ? ` (${slot.awayPenScore})` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {ready && hT && aT && (
                        <button
                          onClick={() =>
                            launchMatch({
                              homeTeam: hT,
                              awayTeam: aT,
                              compLabel: `${tournament.name} · ${slot.label}`,
                              knockout: true,
                              slotId: slot.id,
                            })
                          }
                          className="w-full py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Play Tie Live
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* PRE-MATCH SETUP STUDIO */
            <div className="space-y-6">
              {/* Team Selection & Kickoff Bar */}
              <div className="rounded-3xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-5 items-center">
                  {/* Home Setup */}
                  <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#E11D48]">
                        Home Team
                      </span>
                      <span className="font-mono-tabular text-xs font-black text-slate-600 dark:text-slate-300">
                        OVR {homeTeam.ratings.ovr}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <SimulatorTeamBadge team={homeTeam} size="lg" />
                      <select
                        value={homeTeamId}
                        onChange={(e) => applyTeamSelection('home', e.target.value)}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/15 text-sm font-bold"
                      >
                        {availableTeams.map((team) => (
                          <option key={team.id} value={team.id} className="bg-[#0F1219] text-white">
                            {team.name} ({team.league}) — {team.ratings.ovr}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center font-mono-tabular text-xs">
                      <div className="p-1.5 rounded-lg bg-white dark:bg-white/5">
                        <span className="block text-[9px] text-slate-400">ATT</span>
                        <strong>{homeTeam.ratings.att}</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white dark:bg-white/5">
                        <span className="block text-[9px] text-slate-400">MID</span>
                        <strong>{homeTeam.ratings.mid}</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white dark:bg-white/5">
                        <span className="block text-[9px] text-slate-400">DEF</span>
                        <strong>{homeTeam.ratings.def}</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white dark:bg-white/5">
                        <span className="block text-[9px] text-slate-400">GK</span>
                        <strong>{homeTeam.ratings.gk}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Formation
                        </label>
                        <select
                          value={formationHome}
                          onChange={(e) => setFormationHome(e.target.value as SimFormation)}
                          className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs font-bold"
                        >
                          {(['4-3-3', '4-2-3-1', '3-5-2', '4-4-2'] as SimFormation[]).map((f) => (
                            <option key={f} value={f} className="bg-[#0F1219] text-white">
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Playing Style
                        </label>
                        <select
                          value={styleHome}
                          onChange={(e) => setStyleHome(e.target.value as TacticalStyle)}
                          className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs font-bold"
                        >
                          {TACTICAL_STYLES.map((st) => (
                            <option key={st.id} value={st.id} className="bg-[#0F1219] text-white">
                              {st.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* VS Center Actions */}
                  <div className="flex lg:flex-col items-center justify-center gap-2.5">
                    <button
                      onClick={handleSwapSides}
                      title="Swap Home & Away"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold hover:border-[#E11D48]/60 transition"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-[#E11D48]" />
                      Swap
                    </button>

                    <button
                      onClick={() => launchMatch()}
                      className="px-6 py-3.5 rounded-2xl bg-[#E11D48] hover:bg-[#BE123C] text-white font-display font-black text-sm shadow-xl shadow-[#E11D48]/30 flex items-center gap-2 transition hover:scale-[1.02]"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      KICK OFF
                    </button>

                    <button
                      onClick={handleRandomDerby}
                      title="Random Matchup"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold hover:border-[#E11D48]/60 transition"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      Random
                    </button>
                  </div>

                  {/* Away Setup */}
                  <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Away Team
                      </span>
                      <span className="font-mono-tabular text-xs font-black text-slate-600 dark:text-slate-300">
                        OVR {awayTeam.ratings.ovr}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <SimulatorTeamBadge team={awayTeam} size="lg" />
                      <select
                        value={awayTeamId}
                        onChange={(e) => applyTeamSelection('away', e.target.value)}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/15 text-sm font-bold"
                      >
                        {availableTeams.map((team) => (
                          <option key={team.id} value={team.id} className="bg-[#0F1219] text-white">
                            {team.name} ({team.league}) — {team.ratings.ovr}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center font-mono-tabular text-xs">
                      <div className="p-1.5 rounded-lg bg-white dark:bg-white/5">
                        <span className="block text-[9px] text-slate-400">ATT</span>
                        <strong>{awayTeam.ratings.att}</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white dark:bg-white/5">
                        <span className="block text-[9px] text-slate-400">MID</span>
                        <strong>{awayTeam.ratings.mid}</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white dark:bg-white/5">
                        <span className="block text-[9px] text-slate-400">DEF</span>
                        <strong>{awayTeam.ratings.def}</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white dark:bg-white/5">
                        <span className="block text-[9px] text-slate-400">GK</span>
                        <strong>{awayTeam.ratings.gk}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Formation
                        </label>
                        <select
                          value={formationAway}
                          onChange={(e) => setFormationAway(e.target.value as SimFormation)}
                          className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs font-bold"
                        >
                          {(['4-3-3', '4-2-3-1', '3-5-2', '4-4-2'] as SimFormation[]).map((f) => (
                            <option key={f} value={f} className="bg-[#0F1219] text-white">
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Playing Style
                        </label>
                        <select
                          value={styleAway}
                          onChange={(e) => setStyleAway(e.target.value as TacticalStyle)}
                          className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs font-bold"
                        >
                          {TACTICAL_STYLES.map((st) => (
                            <option key={st.id} value={st.id} className="bg-[#0F1219] text-white">
                              {st.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Match Rules Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                  <label className="inline-flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={knockoutRules}
                      onChange={(e) => setKnockoutRules(e.target.checked)}
                      className="w-4 h-4 accent-[#E11D48] rounded"
                    />
                    Knockout Match Rules (Extra Time 91–120' + Penalty Shootout if tied)
                  </label>

                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedSwap
                      ? 'Click any teammate or bench player on that side to complete swap'
                      : mode === 'dream'
                      ? 'Dream Match: Click any starter on the pitch to draft any legend or superstar'
                      : 'Tip: Click any starter on the pitch or bench below to customize lineups'}
                  </span>
                </div>
              </div>

              {/* Dream Match Player Drafter Drawer */}
              {mode === 'dream' && dreamPickerTarget && (
                <div className="rounded-2xl bg-[#0F1219] text-white border-2 border-[#E11D48] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-display font-black">
                      <Sparkles className="w-4 h-4 text-[#E11D48]" />
                      Dream XI Drafter — Replace Slot #{dreamPickerTarget.slotIndex + 1} (
                      {dreamPickerTarget.side === 'home' ? homeTeam.shortName : awayTeam.shortName})
                    </div>
                    <button
                      onClick={() => setDreamPickerTarget(null)}
                      className="text-xs font-bold text-slate-400 hover:text-white"
                    >
                      Close Drafter
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={dreamSearch}
                      onChange={(e) => setDreamSearch(e.target.value)}
                      placeholder="Search any star player, legend, or position (e.g. Messi, Zidane, Mbappe, GK)..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-[#E11D48]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                    {filteredDreamPool.map((item) => (
                      <button
                        key={`${item.player.id}-${item.teamName}`}
                        onClick={() => handleDraftDreamPlayer(item.player)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-[#E11D48] border border-white/10 text-left text-xs transition group"
                      >
                        <div className="min-w-0">
                          <p className="font-bold truncate">{item.player.name}</p>
                          <p className="text-[10px] text-slate-400 group-hover:text-white/80 truncate">
                            {item.player.position} · {item.teamName}
                          </p>
                        </div>
                        <span className="font-mono-tabular font-black text-amber-300 group-hover:text-white ml-2">
                          {item.player.overall}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Visual 2D Tactical Pitch Preview */}
              <SimulatorPitch2D
                mode="prematch"
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                formationHome={formationHome}
                formationAway={formationAway}
                homePlayers={homeStarters}
                awayPlayers={awayStarters}
                selectedSwapKey={selectedSwap ? `${selectedSwap.side}:${selectedSwap.playerId}` : null}
                onSelectPlayer={(side, playerId, slotIdx) =>
                  handleLineupClick(side, 'starter', playerId, slotIdx)
                }
              />

              {/* Interactive Bench & Starting XI Editor */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {[
                  {
                    side: 'home' as const,
                    team: homeTeam,
                    starters: homeStarters,
                    bench: homeBench,
                  },
                  {
                    side: 'away' as const,
                    team: awayTeam,
                    starters: awayStarters,
                    bench: awayBench,
                  },
                ].map((col) => (
                  <div
                    key={col.side}
                    className="rounded-2xl bg-white dark:bg-[#0F1219] border border-slate-200 dark:border-white/10 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SimulatorTeamBadge team={col.team} size="sm" />
                        <h3 className="text-sm font-display font-black">{col.team.name} Squad</h3>
                      </div>
                      <span className="text-[11px] text-slate-400">Tap any 2 players to swap</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {col.starters.map((pl) => {
                        const isSel =
                          selectedSwap?.side === col.side && selectedSwap?.playerId === pl.id;
                        return (
                          <button
                            key={pl.id}
                            onClick={() => handleLineupClick(col.side, 'starter', pl.id)}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-xl border text-xs transition ${
                              isSel
                                ? 'bg-[#E11D48] text-white border-[#E11D48]'
                                : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:border-[#E11D48]/50'
                            }`}
                          >
                            <span className="truncate font-semibold">
                              <span className="font-mono-tabular opacity-60 mr-1">#{pl.jersey}</span>
                              {pl.shortName}
                            </span>
                            <span className="font-mono-tabular font-bold text-[11px] ml-1 shrink-0">
                              {pl.position} · {pl.overall}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Substitutes Bench
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {col.bench.map((pl) => {
                          const isSel =
                            selectedSwap?.side === col.side && selectedSwap?.playerId === pl.id;
                          return (
                            <button
                              key={pl.id}
                              onClick={() => handleLineupClick(col.side, 'bench', pl.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
                                isSel
                                  ? 'bg-[#E11D48] text-white border-[#E11D48]'
                                  : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-[#E11D48]/50'
                              }`}
                            >
                              <span>{pl.shortName}</span>
                              <span className="font-mono-tabular opacity-75">
                                {pl.position} {pl.overall}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
