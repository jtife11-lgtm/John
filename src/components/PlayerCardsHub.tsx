import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  CheckCircle2,
  GitCompare,
  Layers,
  PackageOpen,
  Shield,
  Sparkles,
  Swords,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import {
  PACK_TYPES,
  PLAYER_CARDS_CATALOG,
  RARITY_ORDER,
} from '../data/playerCardsCatalog';
import type { CardRarity, StrPlayerCard } from '../types/str';
import { PlayerCardVisual } from './PlayerCardVisual';

type CardsTab = 'collection' | 'packs' | 'dream_team' | 'compare' | 'battle' | 'trades' | 'achievements';

const FORMATIONS: Record<'4-3-3' | '4-4-2' | '3-5-2' | '4-2-3-1', ('GK' | 'DEF' | 'MID' | 'FWD')[]> = {
  '4-3-3': ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'],
  '4-4-2': ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'],
  '3-5-2': ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'],
  '4-2-3-1': ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD'],
};

const STARTER_CARDS: Record<string, number> = {
  'pedri-common': 1,
  'gvardiol-common': 1,
  'maatouk-common': 1,
  'alisson-rare': 1,
  'saliba-rare': 1,
  'palmer-common': 1,
  'salah-leg': 1,
};

function drawPackCards(packId: 'starter' | 'elite' | 'icon'): StrPlayerCard[] {
  const byRarity = (r: CardRarity) => PLAYER_CARDS_CATALOG.filter((c) => c.rarity === r);
  const pickRandom = (arr: StrPlayerCard[]) => arr[Math.floor(Math.random() * arr.length)] || PLAYER_CARDS_CATALOG[0];

  const count = packId === 'starter' ? 3 : packId === 'elite' ? 4 : 5;
  const pulled: StrPlayerCard[] = [];

  for (let i = 0; i < count; i++) {
    const roll = Math.random() * 100;
    let rarity: CardRarity = 'Common';
    if (packId === 'starter') {
      if (i === 0) rarity = roll < 15 ? 'Epic' : 'Rare';
      else if (roll < 1) rarity = 'Icon';
      else if (roll < 4) rarity = 'Legendary';
      else if (roll < 15) rarity = 'Epic';
      else if (roll < 50) rarity = 'Rare';
      else rarity = 'Common';
    } else if (packId === 'elite') {
      if (i === 0) rarity = roll < 25 ? 'Legendary' : 'Epic';
      else if (roll < 5) rarity = 'Icon';
      else if (roll < 20) rarity = 'Legendary';
      else if (roll < 55) rarity = 'Epic';
      else rarity = 'Rare';
    } else {
      if (i === 0) rarity = roll < 30 ? 'Icon' : 'Legendary';
      else if (roll < 15) rarity = 'Icon';
      else if (roll < 55) rarity = 'Legendary';
      else rarity = 'Epic';
    }
    const pool = byRarity(rarity);
    pulled.push(pickRandom(pool.length > 0 ? pool : PLAYER_CARDS_CATALOG));
  }
  return pulled;
}

export function PlayerCardsHub() {
  const {
    user,
    userProfile,
    addPoints,
    pushToast,
    setActiveTab,
    setSelectedPlayerKey,
    setShowAuthModal,
    setAuthModalMode,
  } = useApp();

  const [subTab, setSubTab] = useState<CardsTab>('collection');
  const [cardCounts, setCardCounts] = useState<Record<string, number>>(() => {
    try {
      const local = localStorage.getItem('str_guest_cards');
      return local ? JSON.parse(local) : STARTER_CARDS;
    } catch {
      return STARTER_CARDS;
    }
  });
  const [dreamFormation, setDreamFormation] = useState<'4-3-3' | '4-4-2' | '3-5-2' | '4-2-3-1'>('4-3-3');
  const [dreamSlots, setDreamSlots] = useState<string[]>([]);
  const [packsOpened, setPacksOpened] = useState(0);
  const [collectionAchievements, setCollectionAchievements] = useState<string[]>([]);
  const [guestPoints, setGuestPoints] = useState<number>(() => {
    const saved = Number(localStorage.getItem('str_guest_card_pts') || '250');
    return Number.isFinite(saved) ? saved : 250;
  });

  // Filters & modals
  const [rarityFilter, setRarityFilter] = useState<CardRarity | 'All'>('All');
  const [posFilter, setPosFilter] = useState<'All' | 'GK' | 'DEF' | 'MID' | 'FWD'>('All');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [inspectCard, setInspectCard] = useState<StrPlayerCard | null>(null);
  const [revealedPack, setRevealedPack] = useState<StrPlayerCard[] | null>(null);
  const [openingPack, setOpeningPack] = useState(false);

  // Compare
  const [compareA, setCompareA] = useState<string>('ronaldo-icon');
  const [compareB, setCompareB] = useState<string>('messi-icon');

  // Card Battle
  const [battleCardId, setBattleCardId] = useState<string>('salah-leg');
  const [battleResult, setBattleResult] = useState<{
    opponent: StrPlayerCard;
    statKey: keyof StrPlayerCard['stats'];
    myVal: number;
    oppVal: number;
    won: boolean;
    draw: boolean;
  } | null>(null);

  // Trading
  const [friends, setFriends] = useState<{ uid: string; name: string }[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [tradeTargetUid, setTradeTargetUid] = useState('');
  const [tradeOfferCardId, setTradeOfferCardId] = useState('pedri-common');
  const [tradeReqCardId, setTradeReqCardId] = useState('palmer-common');
  const [tradeValidation, setTradeValidation] = useState<{ fair: boolean; reason: string; fairnessScore?: number } | null>(
    null
  );

  const currentPoints = userProfile ? userProfile.points : guestPoints;

  // Load Firestore collection + friends + trades
  useEffect(() => {
    if (!user) return;
    const colRef = doc(db, 'cardCollections', user.uid);
    const unsubCol = onSnapshot(
      colRef,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCardCounts(data.cardCounts || STARTER_CARDS);
          setDreamFormation(data.dreamFormation || '4-3-3');
          setDreamSlots(Array.isArray(data.dreamSlots) ? data.dreamSlots : []);
          setPacksOpened(Number(data.packsOpened || 0));
          setCollectionAchievements(Array.isArray(data.achievements) ? data.achievements : []);
        } else if (user.emailVerified) {
          await setDoc(colRef, {
            userId: user.uid,
            cardCounts: STARTER_CARDS,
            dreamFormation: '4-3-3',
            dreamSlots: [],
            packsOpened: 0,
            achievements: ['Starter Squad Claimed'],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `cardCollections/${user.uid}`)
    );

    const unsubReqsA = onSnapshot(
      query(collection(db, 'friendRequests'), where('fromUid', '==', user.uid), where('status', '==', 'accepted')),
      (snap) => {
        const list = snap.docs.map((d) => ({ uid: d.data().toUid, name: d.data().toName }));
        setFriends((prev) => {
          const others = prev.filter((p) => !list.some((l) => l.uid === p.uid));
          return [...others, ...list];
        });
      },
      () => {}
    );
    const unsubReqsB = onSnapshot(
      query(collection(db, 'friendRequests'), where('toUid', '==', user.uid), where('status', '==', 'accepted')),
      (snap) => {
        const list = snap.docs.map((d) => ({ uid: d.data().fromUid, name: d.data().fromName }));
        setFriends((prev) => {
          const others = prev.filter((p) => !list.some((l) => l.uid === p.uid));
          return [...others, ...list];
        });
      },
      () => {}
    );

    const unsubTradesFrom = onSnapshot(
      query(collection(db, 'cardTrades'), where('fromUid', '==', user.uid), limit(20)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTrades((prev) => [...prev.filter((t) => t.fromUid !== user.uid), ...list]);
      },
      () => {}
    );
    const unsubTradesTo = onSnapshot(
      query(collection(db, 'cardTrades'), where('toUid', '==', user.uid), limit(20)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTrades((prev) => [...prev.filter((t) => t.toUid !== user.uid), ...list]);
      },
      () => {}
    );

    return () => {
      unsubCol();
      unsubReqsA();
      unsubReqsB();
      unsubTradesFrom();
      unsubTradesTo();
    };
  }, [user]);

  // Settle accepted outgoing trades cleanly into sender's own collection
  useEffect(() => {
    if (!user || !user.emailVerified) return;
    const unsettled = trades.filter(
      (t) => t.fromUid === user.uid && t.status === 'accepted' && t.fromSettled === false
    );
    unsettled.forEach(async (tr) => {
      const updated = { ...cardCounts };
      if ((updated[tr.offeredCardId] || 0) > 0) {
        updated[tr.offeredCardId] = updated[tr.offeredCardId] - 1;
        if (updated[tr.offeredCardId] <= 0) delete updated[tr.offeredCardId];
      }
      updated[tr.requestedCardId] = (updated[tr.requestedCardId] || 0) + 1;
      await persistCollection(updated, dreamFormation, dreamSlots, packsOpened, [
        ...collectionAchievements,
        'Fair Trader',
      ]);
      await updateDoc(doc(db, 'cardTrades', tr.id), {
        fromSettled: true,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      pushToast('Accepted card trade settled into your binder!', 'success');
    });
  }, [trades, user?.uid]);

  const persistCollection = async (
    nextCounts: Record<string, number>,
    nextFormation: '4-3-3' | '4-4-2' | '3-5-2' | '4-2-3-1',
    nextSlots: string[],
    nextPacks: number,
    nextAch: string[]
  ) => {
    const uniqueAch = Array.from(new Set(nextAch)).slice(0, 30);
    setCardCounts(nextCounts);
    setDreamFormation(nextFormation);
    setDreamSlots(nextSlots);
    setPacksOpened(nextPacks);
    setCollectionAchievements(uniqueAch);

    if (!user) {
      localStorage.setItem('str_guest_cards', JSON.stringify(nextCounts));
      return;
    }
    if (!user.emailVerified) return;

    await setDoc(
      doc(db, 'cardCollections', user.uid),
      {
        userId: user.uid,
        cardCounts: nextCounts,
        dreamFormation: nextFormation,
        dreamSlots: nextSlots.slice(0, 11),
        packsOpened: nextPacks,
        achievements: uniqueAch,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `cardCollections/${user.uid}`));
  };

  const ownedIds = Object.keys(cardCounts).filter((id) => (cardCounts[id] || 0) > 0);
  const ownedCards = PLAYER_CARDS_CATALOG.filter((c) => ownedIds.includes(c.id));

  const handleOpenPack = async (packId: 'starter' | 'elite' | 'icon', cost: number) => {
    if (currentPoints < cost) {
      pushToast(`Need ${cost} pts to open this pack (earn points in Mini-Games!).`, 'error');
      return;
    }
    setOpeningPack(true);
    setRevealedPack(null);
    const pulled = drawPackCards(packId);

    setTimeout(async () => {
      const nextCounts = { ...cardCounts };
      pulled.forEach((c) => {
        nextCounts[c.id] = (nextCounts[c.id] || 0) + 1;
      });
      const nextAch = [...collectionAchievements];
      if (pulled.some((c) => c.rarity === 'Icon' || c.rarity === 'Legendary')) {
        nextAch.push('Galáctico Pull');
      }
      if (Object.keys(nextCounts).length >= 10) {
        nextAch.push('10+ Unique Stars');
      }

      if (user) {
        await addPoints(-cost);
      } else {
        const nextGuest = Math.max(0, guestPoints - cost);
        setGuestPoints(nextGuest);
        localStorage.setItem('str_guest_card_pts', String(nextGuest));
      }

      await persistCollection(nextCounts, dreamFormation, dreamSlots, packsOpened + 1, nextAch);
      setOpeningPack(false);
      setRevealedPack(pulled);
      pushToast(`Pack opened! Added ${pulled.length} cards to your club.`, 'success');
    }, 650);
  };

  const filteredCatalog = useMemo(() => {
    return PLAYER_CARDS_CATALOG.filter((c) => {
      if (rarityFilter !== 'All' && c.rarity !== rarityFilter) return false;
      if (posFilter !== 'All' && c.position !== posFilter) return false;
      if (ownedOnly && !(cardCounts[c.id] > 0)) return false;
      return true;
    }).sort((a, b) => b.overall - a.overall);
  }, [rarityFilter, posFilter, ownedOnly, cardCounts]);

  const toggleDreamSlot = async (cardId: string) => {
    let next = [...dreamSlots];
    if (next.includes(cardId)) {
      next = next.filter((id) => id !== cardId);
    } else if (next.length < 11) {
      next.push(cardId);
    } else {
      pushToast('Starting XI already has 11 cards. Remove one first.', 'info');
      return;
    }
    await persistCollection(cardCounts, dreamFormation, next, packsOpened, collectionAchievements);
  };

  const dreamCards = dreamSlots
    .map((id) => PLAYER_CARDS_CATALOG.find((c) => c.id === id))
    .filter(Boolean) as StrPlayerCard[];
  const dreamAvgOvr =
    dreamCards.length > 0
      ? Math.round(dreamCards.reduce((acc, c) => acc + c.overall, 0) / dreamCards.length)
      : 0;

  const playCardBattle = async (statKey: keyof StrPlayerCard['stats']) => {
    const mine = PLAYER_CARDS_CATALOG.find((c) => c.id === battleCardId) || ownedCards[0] || PLAYER_CARDS_CATALOG[0];
    const opp = PLAYER_CARDS_CATALOG[Math.floor(Math.random() * PLAYER_CARDS_CATALOG.length)];
    const myVal = mine.stats[statKey];
    const oppVal = opp.stats[statKey];
    const won = myVal > oppVal;
    const draw = myVal === oppVal;
    setBattleResult({ opponent: opp, statKey, myVal, oppVal, won, draw });
    if (won) {
      if (user) await addPoints(20, 'Card Duel Winner');
      else {
        const nextGuest = guestPoints + 20;
        setGuestPoints(nextGuest);
        localStorage.setItem('str_guest_card_pts', String(nextGuest));
      }
      pushToast(`Card Battle Won! ${mine.shortName} (${myVal}) beat ${opp.shortName} (${oppVal})! +20 pts`, 'success');
    }
  };

  // Validate trade whenever selections change
  useEffect(() => {
    const c1 = PLAYER_CARDS_CATALOG.find((c) => c.id === tradeOfferCardId);
    const c2 = PLAYER_CARDS_CATALOG.find((c) => c.id === tradeReqCardId);
    if (!c1 || !c2) return;
    fetch('/api/cards/validate-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offeredRarity: c1.rarity,
        offeredOvr: c1.overall,
        requestedRarity: c2.rarity,
        requestedOvr: c2.overall,
      }),
    })
      .then((r) => r.json())
      .then((d) => setTradeValidation(d))
      .catch(() => {});
  }, [tradeOfferCardId, tradeReqCardId]);

  const sendTradeOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified) {
      pushToast('Sign in with a verified email to trade cards with friends.', 'info');
      return;
    }
    const target = friends.find((f) => f.uid === tradeTargetUid);
    if (!target) {
      pushToast('Select a friend to propose this trade.', 'error');
      return;
    }
    if ((cardCounts[tradeOfferCardId] || 0) < 1) {
      pushToast('You do not own the offered card.', 'error');
      return;
    }
    if (!tradeValidation?.fair) {
      pushToast(tradeValidation?.reason || 'Trade rejected by fairness rules.', 'error');
      return;
    }
    await addDoc(collection(db, 'cardTrades'), {
      fromUid: user.uid,
      toUid: target.uid,
      fromName: userProfile?.displayName || 'Supporter',
      toName: target.name,
      offeredCardId: tradeOfferCardId,
      requestedCardId: tradeReqCardId,
      fairnessNote: tradeValidation.reason.slice(0, 200),
      status: 'pending',
      fromSettled: false,
      toSettled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    pushToast(`Fair trade proposal sent to ${target.name}!`, 'success');
  };

  const respondTrade = async (trade: any, decision: 'accepted' | 'rejected' | 'cancelled') => {
    if (!user) return;
    if (decision === 'accepted') {
      if ((cardCounts[trade.requestedCardId] || 0) < 1) {
        pushToast('You do not currently own the requested card to complete this swap.', 'error');
        return;
      }
      const next = { ...cardCounts };
      next[trade.requestedCardId] = next[trade.requestedCardId] - 1;
      if (next[trade.requestedCardId] <= 0) delete next[trade.requestedCardId];
      next[trade.offeredCardId] = (next[trade.offeredCardId] || 0) + 1;
      await persistCollection(next, dreamFormation, dreamSlots, packsOpened, [
        ...collectionAchievements,
        'Fair Trader',
      ]);
      await updateDoc(doc(db, 'cardTrades', trade.id), {
        status: 'accepted',
        toSettled: true,
        updatedAt: serverTimestamp(),
      });
      pushToast('Trade accepted! Cards swapped safely.', 'success');
    } else {
      await updateDoc(doc(db, 'cardTrades', trade.id), {
        status: decision,
        updatedAt: serverTimestamp(),
      });
      pushToast(`Trade ${decision}.`, 'info');
    }
  };

  const compCardA = PLAYER_CARDS_CATALOG.find((c) => c.id === compareA) || PLAYER_CARDS_CATALOG[0];
  const compCardB = PLAYER_CARDS_CATALOG.find((c) => c.id === compareB) || PLAYER_CARDS_CATALOG[1];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-[#0B1324] border border-slate-800 text-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-bold text-[#00E676] tracking-wider">STR PLAYER CARDS</p>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold">
            Collectible Football Cards, Packs & Dream XI
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Open packs with earned STR points, collect Icons & Legends, construct your Dream XI formation, duel friends, and swap fairly under server-validated rules.
          </p>
          <p className="text-[11px] text-slate-400">
            Note: Card OVR & 6-stat ratings are original game-balance ratings; verified real-world career data lives in Player Profiles.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-2xl bg-[#060B16] border border-slate-800 text-right">
            <p className="text-[11px] text-slate-400">Points Balance</p>
            <p className="font-mono-tabular text-xl font-black text-[#00E676]">{currentPoints}</p>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-[#060B16] border border-slate-800 text-right">
            <p className="text-[11px] text-slate-400">Collected</p>
            <p className="font-mono-tabular text-xl font-black text-white">
              {ownedIds.length}/{PLAYER_CARDS_CATALOG.length}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'collection' as const, label: 'My Binder', icon: Layers },
          { id: 'packs' as const, label: 'Open Packs', icon: PackageOpen },
          { id: 'dream_team' as const, label: 'Dream XI', icon: Users },
          { id: 'compare' as const, label: 'Compare Cards', icon: GitCompare },
          { id: 'battle' as const, label: 'Card Battle', icon: Swords },
          { id: 'trades' as const, label: 'Fair Trading', icon: ArrowLeftRight },
          { id: 'achievements' as const, label: 'Achievements', icon: Award },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
                subTab === t.id
                  ? 'bg-[#00E676] text-[#060B16]'
                  : 'bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#00E676]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* COLLECTION BINDER */}
      {subTab === 'collection' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['All', 'Icon', 'Legendary', 'Epic', 'Rare', 'Common'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRarityFilter(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    rarityFilter === r
                      ? 'bg-[#00E676] text-[#060B16]'
                      : 'bg-slate-100 dark:bg-[#060B16] text-slate-500'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['All', 'GK', 'DEF', 'MID', 'FWD'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                    posFilter === pos
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-[#060B16]'
                      : 'bg-slate-100 dark:bg-[#060B16] text-slate-500'
                  }`}
                >
                  {pos}
                </button>
              ))}
              <button
                onClick={() => setOwnedOnly((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                  ownedOnly
                    ? 'border-[#00E676] text-[#00A844] dark:text-[#00E676]'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500'
                }`}
              >
                {ownedOnly ? 'Owned Only ✓' : 'Show All'}
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCatalog.map((card) => (
              <div key={card.id} className={cardCounts[card.id] > 0 ? '' : 'opacity-65'}>
                <PlayerCardVisual
                  card={card}
                  count={cardCounts[card.id] || 0}
                  onClick={() => setInspectCard(card)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PACK OPENER */}
      {subTab === 'packs' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {PACK_TYPES.map((pk) => (
              <div
                key={pk.id}
                className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="w-11 h-11 rounded-2xl bg-[#00E676]/15 flex items-center justify-center text-[#00A844] dark:text-[#00E676]">
                    <PackageOpen className="w-6 h-6" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                    {pk.name}
                  </h2>
                  <p className="text-xs text-slate-500">{pk.description}</p>
                  <p className="text-[11px] text-slate-400">{pk.oddsText}</p>
                </div>
                <button
                  disabled={openingPack}
                  onClick={() => handleOpenPack(pk.id, pk.cost)}
                  className="w-full py-3 rounded-xl bg-[#00E676] text-[#060B16] font-extrabold text-xs hover:brightness-105 transition disabled:opacity-50"
                >
                  {openingPack ? 'Opening Pack...' : `Open Pack · ${pk.cost} pts`}
                </button>
              </div>
            ))}
          </div>

          {revealedPack && (
            <div className="rounded-3xl bg-[#0B1324] border-2 border-[#00E676] p-6 space-y-4 text-white">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold flex items-center gap-2 text-[#00E676]">
                  <Sparkles className="w-5 h-5" />
                  Pack Walkout Reveal!
                </h3>
                <button
                  onClick={() => setRevealedPack(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close Reveal
                </button>
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {revealedPack.map((c, idx) => (
                  <PlayerCardVisual key={`${c.id}-${idx}`} card={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DREAM TEAM FORMATION BUILDER */}
      {subTab === 'dream_team' && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl bg-emerald-950 border border-emerald-800 p-5 text-white space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold">Dream Team Builder</h2>
                <p className="text-xs text-emerald-200/80">
                  {dreamCards.length}/11 Selected · Average Squad Rating:{' '}
                  <span className="font-mono-tabular font-bold text-[#00E676]">{dreamAvgOvr || '-'}</span>
                </p>
              </div>
              <div className="flex gap-1.5">
                {(['4-3-3', '4-4-2', '3-5-2', '4-2-3-1'] as const).map((fm) => (
                  <button
                    key={fm}
                    onClick={() => persistCollection(cardCounts, fm, dreamSlots, packsOpened, collectionAchievements)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      dreamFormation === fm
                        ? 'bg-[#00E676] text-[#060B16]'
                        : 'bg-[#060B16]/70 text-emerald-100 border border-emerald-800'
                    }`}
                  >
                    {fm}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {FORMATIONS[dreamFormation].map((slotPos, idx) => {
                const c = dreamCards[idx];
                return (
                  <div
                    key={idx}
                    onClick={() => c && toggleDreamSlot(c.id)}
                    className={`p-3 rounded-xl border ${
                      c
                        ? 'bg-[#060B16]/90 border-[#00E676]/60 cursor-pointer hover:border-rose-400'
                        : 'bg-[#060B16]/40 border-dashed border-emerald-700/70'
                    }`}
                  >
                    <p className="text-[10px] font-bold text-[#00E676]">
                      Slot {idx + 1} · Target {slotPos}
                    </p>
                    {c ? (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold truncate">{c.shortName}</span>
                        <span className="font-mono-tabular text-xs font-black text-amber-300">
                          {c.overall}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-300/60 mt-1">Select card →</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Owned Cards (Tap to Add/Remove)
            </h3>
            <div className="max-h-[420px] overflow-y-auto space-y-2">
              {ownedCards.map((c) => {
                const inSquad = dreamSlots.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleDreamSlot(c.id)}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                      inSquad
                        ? 'bg-[#00E676]/15 border-[#00E676] text-[#00A844] dark:text-[#00E676]'
                        : 'bg-slate-50 dark:bg-[#060B16] border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="text-left">
                      <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {c.position} · {c.club} · {c.rarity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 font-mono-tabular">
                      <span className="font-black text-sm">{c.overall}</span>
                      <span>{inSquad ? '✓' : '+'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* COMPARE CARDS */}
      {subTab === 'compare' && (
        <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <select
              value={compareA}
              onChange={(e) => setCompareA(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm font-semibold"
            >
              {PLAYER_CARDS_CATALOG.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.overall} OVR · {c.rarity})
                </option>
              ))}
            </select>
            <select
              value={compareB}
              onChange={(e) => setCompareB(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm font-semibold"
            >
              {PLAYER_CARDS_CATALOG.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.overall} OVR · {c.rarity})
                </option>
              ))}
            </select>
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-4">
              <PlayerCardVisual card={compCardA} />
            </div>
            <div className="lg:col-span-4 space-y-3">
              {(['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const).map((statKey) => {
                const v1 = compCardA.stats[statKey];
                const v2 = compCardB.stats[statKey];
                return (
                  <div key={statKey} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono-tabular font-bold">
                      <span className={v1 >= v2 ? 'text-[#00A844] dark:text-[#00E676]' : 'text-slate-400'}>
                        {v1}
                      </span>
                      <span className="uppercase text-slate-500">{statKey}</span>
                      <span className={v2 >= v1 ? 'text-[#00A844] dark:text-[#00E676]' : 'text-slate-400'}>
                        {v2}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 h-2">
                      <div className="bg-slate-200 dark:bg-slate-800 rounded-l-full overflow-hidden flex justify-end">
                        <div
                          className="h-full bg-[#00E676]"
                          style={{ width: `${v1}%` }}
                        />
                      </div>
                      <div className="bg-slate-200 dark:bg-slate-800 rounded-r-full overflow-hidden">
                        <div
                          className="h-full bg-sky-400"
                          style={{ width: `${v2}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="lg:col-span-4">
              <PlayerCardVisual card={compCardB} />
            </div>
          </div>
        </div>
      )}

      {/* CARD BATTLE */}
      {subTab === 'battle' && (
        <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                STR Card Battle Duel
              </h2>
              <p className="text-xs text-slate-500">
                Choose one of your cards and pick a signature attribute to outscore the challenger (+20 pts per victory).
              </p>
            </div>
            <select
              value={battleCardId}
              onChange={(e) => setBattleCardId(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-xs font-bold"
            >
              {(ownedCards.length > 0 ? ownedCards : PLAYER_CARDS_CATALOG).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.overall} OVR)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const).map((sk) => (
              <button
                key={sk}
                onClick={() => playCardBattle(sk)}
                className="py-2.5 px-3 rounded-xl bg-[#00E676] text-[#060B16] font-extrabold text-xs uppercase hover:brightness-105 transition"
              >
                Battle {sk}
              </button>
            ))}
          </div>

          {battleResult && (
            <div className="grid md:grid-cols-2 gap-4 items-center pt-2">
              <PlayerCardVisual
                card={PLAYER_CARDS_CATALOG.find((c) => c.id === battleCardId) || PLAYER_CARDS_CATALOG[0]}
              />
              <div className="space-y-3">
                <div
                  className={`p-4 rounded-xl border text-center font-bold text-sm ${
                    battleResult.won
                      ? 'bg-emerald-500/15 border-[#00E676] text-[#00A844] dark:text-[#00E676]'
                      : battleResult.draw
                      ? 'bg-amber-500/15 border-amber-400 text-amber-400'
                      : 'bg-rose-500/15 border-rose-500 text-rose-400'
                  }`}
                >
                  {battleResult.won ? 'VICTORY!' : battleResult.draw ? 'DRAW!' : 'DEFEAT'} ·{' '}
                  {battleResult.statKey.toUpperCase()}: {battleResult.myVal} vs {battleResult.oppVal}
                </div>
                <PlayerCardVisual card={battleResult.opponent} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* FAIR SERVER-CONTROLLED TRADING */}
      {subTab === 'trades' && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#00E676]" />
              Safe Card Trading
            </h2>
            <p className="text-xs text-slate-500">
              Trades are validated server-side: cards must be within 1 rarity tier and 7 OVR points to guarantee fair swaps.
            </p>
            {!user ? (
              <button
                onClick={() => {
                  setAuthModalMode('signin');
                  setShowAuthModal(true);
                }}
                className="w-full py-2.5 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-xs"
              >
                Sign In to Trade with Friends
              </button>
            ) : (
              <form onSubmit={sendTradeOffer} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Friend Recipient</label>
                  <select
                    value={tradeTargetUid}
                    onChange={(e) => setTradeTargetUid(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800"
                  >
                    <option value="">Select accepted friend...</option>
                    {friends.map((f) => (
                      <option key={f.uid} value={f.uid}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Card You Offer</label>
                  <select
                    value={tradeOfferCardId}
                    onChange={(e) => setTradeOfferCardId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800"
                  >
                    {ownedCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.overall} OVR · {c.rarity})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Card You Request</label>
                  <select
                    value={tradeReqCardId}
                    onChange={(e) => setTradeReqCardId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800"
                  >
                    {PLAYER_CARDS_CATALOG.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.overall} OVR · {c.rarity})
                      </option>
                    ))}
                  </select>
                </div>
                {tradeValidation && (
                  <div
                    className={`p-3 rounded-xl border text-[11px] ${
                      tradeValidation.fair
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-[#00A844] dark:text-[#00E676]'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                    }`}
                  >
                    {tradeValidation.reason}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={!tradeValidation?.fair || friends.length === 0}
                  className="w-full py-2.5 rounded-xl bg-[#00E676] text-[#060B16] font-bold disabled:opacity-50"
                >
                  Send Fair Trade Offer
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Active & Past Trades
            </h3>
            {trades.length === 0 ? (
              <p className="text-xs text-slate-500">No active trade offers yet.</p>
            ) : (
              <div className="space-y-2.5">
                {trades.map((tr) => {
                  const off = PLAYER_CARDS_CATALOG.find((c) => c.id === tr.offeredCardId);
                  const req = PLAYER_CARDS_CATALOG.find((c) => c.id === tr.requestedCardId);
                  const isIncoming = user?.uid === tr.toUid;
                  return (
                    <div
                      key={tr.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {tr.fromName} offers {off?.name || tr.offeredCardId} ↔ {req?.name || tr.requestedCardId}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Status: <span className="uppercase font-bold">{tr.status}</span>
                        </p>
                      </div>
                      {tr.status === 'pending' && (
                        <div className="flex gap-2">
                          {isIncoming ? (
                            <>
                              <button
                                onClick={() => respondTrade(tr, 'accepted')}
                                className="px-3 py-1.5 rounded-lg bg-[#00E676] text-[#060B16] font-bold"
                              >
                                Accept Swap
                              </button>
                              <button
                                onClick={() => respondTrade(tr, 'rejected')}
                                className="px-3 py-1.5 rounded-lg bg-slate-700 text-white"
                              >
                                Decline
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => respondTrade(tr, 'cancelled')}
                              className="px-3 py-1.5 rounded-lg bg-slate-700 text-white"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACHIEVEMENTS */}
      {subTab === 'achievements' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'Starter Squad Claimed', desc: 'Begin your STR Player Cards collection', unlocked: ownedIds.length >= 1 },
            { title: 'Pack Opener', desc: 'Open your first virtual card pack', unlocked: packsOpened >= 1 },
            { title: 'Galáctico Pull', desc: 'Pull or own a Legendary or Icon card', unlocked: ownedCards.some((c) => RARITY_ORDER[c.rarity] >= 4) },
            { title: '10+ Unique Stars', desc: 'Collect at least 10 unique player cards', unlocked: ownedIds.length >= 10 },
            { title: 'Dream XI Tactician', desc: 'Assign a full 11-player starting formation', unlocked: dreamSlots.length === 11 },
            { title: 'Fair Trader', desc: 'Complete a server-validated friend swap', unlocked: collectionAchievements.includes('Fair Trader') },
          ].map((ach) => (
            <div
              key={ach.title}
              className={`rounded-2xl p-5 border space-y-2 ${
                ach.unlocked
                  ? 'bg-emerald-500/10 border-[#00E676]/50'
                  : 'bg-white dark:bg-[#0B1324] border-slate-200 dark:border-slate-800 opacity-65'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {ach.title}
                </span>
                {ach.unlocked ? (
                  <CheckCircle2 className="w-5 h-5 text-[#00E676]" />
                ) : (
                  <UserCheck className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <p className="text-xs text-slate-500">{ach.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Card Detail Modal */}
      {inspectCard && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0B1324] border border-slate-800 p-6 text-white space-y-4">
            <PlayerCardVisual card={inspectCard} count={cardCounts[inspectCard.id] || 0} />
            <p className="text-xs text-slate-300 leading-relaxed">{inspectCard.summary}</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const key = inspectCard.tsdbSearchName;
                  setInspectCard(null);
                  setSelectedPlayerKey(key);
                  setActiveTab('players');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-xs"
              >
                Open Real Player Profile
              </button>
              <button
                onClick={() => setInspectCard(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
