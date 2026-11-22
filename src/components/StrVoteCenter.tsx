import React, { useEffect, useState } from 'react';
import { Check, Plus, Share2, Vote } from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { t } from '../lib/i18n';

const POLL_CATEGORIES = [
  { id: 'all', label: 'All Polls' },
  { id: 'potm', label: 'Player of the Match' },
  { id: 'poty', label: 'Player of the Month' },
  { id: 'gotw', label: 'Goal of the Week' },
  { id: 'best_team', label: 'Best Team' },
  { id: 'young_player', label: 'Best Young Player' },
  { id: 'match_winner', label: 'Match Winner' },
  { id: 'community', label: 'Community Polls' },
] as const;

export function StrVoteCenter() {
  const { user, lang, pushToast, setShowAuthModal, setAuthModalMode } = useApp();

  const [category, setCategory] = useState<string>('all');
  const [polls, setPolls] = useState<any[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [showCreate, setShowCreate] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('community');
  const [newOptionsText, setNewOptionsText] = useState('Option A\nOption B\nOption C');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'polls'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPolls(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'polls')
    );
    return () => unsub();
  }, []);

  // Load current user's votes for visible polls
  useEffect(() => {
    if (!user || polls.length === 0) return;
    polls.forEach(async (p) => {
      try {
        const vSnap = await getDoc(doc(db, 'polls', p.id, 'votes', user.uid));
        if (vSnap.exists()) {
          setUserVotes((prev) => ({ ...prev, [p.id]: vSnap.data().optionIndex }));
        }
      } catch {
        // Ignore single read error
      }
    });
  }, [user, polls.length]);

  const castVote = async (poll: any, optionIndex: number) => {
    if (!user) {
      setAuthModalMode('signin');
      setShowAuthModal(true);
      pushToast('Sign in to cast a verified fan vote (prevents duplicate voting).', 'info');
      return;
    }
    if (!user.emailVerified) {
      pushToast('Verify your email to participate in STR VOTE.', 'info');
      return;
    }
    if (userVotes[poll.id] !== undefined) {
      pushToast('You have already voted in this poll.', 'info');
      return;
    }

    const nextCounts = [...(poll.counts || [])];
    nextCounts[optionIndex] = (nextCounts[optionIndex] || 0) + 1;

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'polls', poll.id, 'votes', user.uid), {
        userId: user.uid,
        optionIndex,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'polls', poll.id), {
        counts: nextCounts,
        totalVotes: (poll.totalVotes || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setUserVotes((prev) => ({ ...prev, [poll.id]: optionIndex }));
      pushToast('Vote recorded!', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `polls/${poll.id}/votes/${user.uid}`);
    }
  };

  const createPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.emailVerified) {
      pushToast('Verified account required to create community polls.', 'info');
      return;
    }
    const opts = newOptionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (newTitle.trim().length < 3 || opts.length < 2) {
      pushToast('Enter a title and at least 2 options (one per line).', 'error');
      return;
    }

    setCreating(true);
    const id = `poll_${Date.now()}`;
    const closes = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    try {
      await setDoc(doc(db, 'polls', id), {
        category: newCategory,
        title: newTitle.trim().slice(0, 160),
        options: opts,
        counts: opts.map(() => 0),
        totalVotes: 0,
        closesAt: closes,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewTitle('');
      setShowCreate(false);
      pushToast('Community poll published!', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `polls/${id}`);
    } finally {
      setCreating(false);
    }
  };

  const seedStarterPolls = async () => {
    if (!user || !user.emailVerified) {
      setAuthModalMode('signin');
      setShowAuthModal(true);
      return;
    }
    const starters = [
      {
        id: `poll_potm_${Date.now()}`,
        category: 'potm',
        title: 'Player of the Matchday — Who stood out most?',
        options: ['Mohamed Salah', 'Kylian Mbappé', 'Lamine Yamal', 'Jude Bellingham'],
      },
      {
        id: `poll_young_${Date.now() + 1}`,
        category: 'young_player',
        title: 'Best Young Player This Season (U21 Fan Vote)',
        options: ['Lamine Yamal', 'Pau Cubarsí', 'Arda Güler', 'Kobbie Mainoo'],
      },
      {
        id: `poll_team_${Date.now() + 2}`,
        category: 'best_team',
        title: 'Most Entertaining Club Attack in Europe Right Now',
        options: ['Liverpool', 'FC Barcelona', 'Real Madrid', 'Bayern Munich'],
      },
    ];
    for (const s of starters) {
      await setDoc(doc(db, 'polls', s.id), {
        category: s.category,
        title: s.title,
        options: s.options,
        counts: s.options.map(() => 0),
        totalVotes: 0,
        closesAt: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    pushToast('Starter fan polls created!', 'success');
  };

  const filtered = polls.filter((p) => category === 'all' || p.category === category);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Vote className="w-7 h-7 text-[#00E676]" />
            STR VOTE — Fan Polls
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">{t(lang, 'fanOpinionNote')}</p>
        </div>

        <button
          onClick={() => {
            if (!user) {
              setAuthModalMode('signin');
              setShowAuthModal(true);
            } else {
              setShowCreate(!showCreate);
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-xs hover:brightness-105 transition self-start"
        >
          <Plus className="w-4 h-4" />
          Create Community Poll
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {POLL_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap transition ${
              category === c.id
                ? 'bg-[#00E676] text-[#060B16] border-[#00E676]'
                : 'bg-white dark:bg-[#0B1324] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {showCreate && (
        <form
          onSubmit={createPoll}
          className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-4 max-w-xl"
        >
          <h2 className="font-display text-xl font-bold">New Community Fan Poll</h2>
          <input
            type="text"
            required
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Poll question (e.g., Who wins the Champions League?)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm"
          >
            {POLL_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <textarea
            rows={4}
            value={newOptionsText}
            onChange={(e) => setNewOptionsText(e.target.value)}
            placeholder="One option per line (2–10 options)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-xs"
            >
              {creating ? 'Publishing...' : 'Publish Poll'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2.5 rounded-xl text-xs text-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No live fan polls in this category yet.
          </p>
          <button
            onClick={seedStarterPolls}
            className="px-5 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] text-xs font-bold"
          >
            Launch Matchday Fan Polls
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((poll) => {
            const total = poll.totalVotes || 0;
            const myChoice = userVotes[poll.id];
            const closesDate = poll.closesAt?.toDate ? poll.closesAt.toDate().toLocaleDateString() : '';

            return (
              <div
                key={poll.id}
                className="rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-[11px] text-slate-500">
                      Fan Opinion · {poll.category} · Closes {closesDate}
                    </p>
                    <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                      {poll.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(`${poll.title} — Vote on STR SCORES`);
                      pushToast('Poll invite copied!', 'success');
                    }}
                    title="Share poll"
                    className="p-2 rounded-lg text-slate-400 hover:text-[#00E676]"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {(poll.options || []).map((opt: string, idx: number) => {
                    const count = poll.counts?.[idx] || 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    const isMine = myChoice === idx;
                    return (
                      <button
                        key={opt}
                        onClick={() => castVote(poll, idx)}
                        className={`w-full relative overflow-hidden rounded-xl border p-3 text-left transition ${
                          isMine
                            ? 'border-[#00E676]'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-400'
                        }`}
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-[#00E676]/15 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="relative z-10 flex items-center justify-between text-xs font-semibold">
                          <span className="flex items-center gap-1.5">
                            {isMine && <Check className="w-3.5 h-3.5 text-[#00E676]" />}
                            {opt}
                          </span>
                          <span className="font-mono-tabular">
                            {pct}% ({count})
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-500 font-mono-tabular">
                  {total} verified votes · Fan opinion poll, not an official award
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
