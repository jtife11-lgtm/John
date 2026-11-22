import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Gamepad2,
  Loader2,
  Newspaper,
  Search,
  Share2,
  X,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import type { NewsArticle } from '../types/str';

const FALLBACK_IMG = '/src/assets/images/news_transfer_spotlight_1795349597558.jpg';

export function NewsCenter() {
  const { user, pushToast, setShowAuthModal, setAuthModalMode } = useApp();

  const [section, setSection] = useState<'football' | 'gaming' | 'saved'>('football');
  const [footballCat, setFootballCat] = useState<string>('all');
  const [gamingFilter, setGamingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [customNews, setCustomNews] = useState<NewsArticle[]>([]);
  const [savedArticles, setSavedArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);

  useEffect(() => {
    const unsubCustom = onSnapshot(
      query(collection(db, 'customNews'), orderBy('createdAt', 'desc')),
      (snap) => {
        setCustomNews(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: `custom-${d.id}`,
              title: data.title,
              description: data.summary,
              url: '#str-editorial',
              imageUrl: data.imageUrl || FALLBACK_IMG,
              publishedAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
              source: 'STR SCORES Editorial',
              category: data.category || 'Breaking',
            };
          })
        );
      },
      () => {}
    );
    return () => unsubCustom();
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedArticles([]);
      return;
    }
    const q = query(collection(db, 'savedArticles'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSavedArticles(snap.docs.map((d) => ({ docId: d.id, ...d.data() })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'savedArticles')
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (section === 'saved') {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    const endpoint =
      section === 'football'
        ? `/api/news/football?category=${encodeURIComponent(footballCat)}`
        : `/api/news/gaming?game=${encodeURIComponent(gamingFilter)}`;

    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setArticles(Array.isArray(data.articles) ? data.articles : []);
      })
      .catch(() => {
        if (active) setError('Unable to load upstream news feed right now.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [section, footballCat, gamingFilter]);

  const isSaved = (id: string) => savedArticles.some((s) => s.articleId === id);

  const toggleSaveArticle = async (art: NewsArticle, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setAuthModalMode('signin');
      setShowAuthModal(true);
      pushToast('Sign in to bookmark articles to your profile.', 'info');
      return;
    }
    if (!user.emailVerified) {
      pushToast('Verify your email to save articles.', 'info');
      return;
    }
    const existing = savedArticles.find((s) => s.articleId === art.id);
    if (existing) {
      await deleteDoc(doc(db, 'savedArticles', existing.docId));
      pushToast('Removed from saved articles', 'info');
    } else {
      const safeDocId = `${user.uid.slice(0, 10)}_${art.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60)}`;
      await setDoc(doc(db, 'savedArticles', safeDocId), {
        userId: user.uid,
        articleId: art.id.slice(0, 128),
        title: art.title.slice(0, 240),
        url: art.url.slice(0, 512),
        source: art.source.slice(0, 80),
        imageUrl: (art.imageUrl || '').slice(0, 512),
        publishedAt: (art.publishedAt || '').slice(0, 64),
        savedAt: serverTimestamp(),
      });
      pushToast('Article saved to your library', 'success');
    }
  };

  const shareArticle = async (art: NewsArticle, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({ title: art.title, url: art.url });
      } else {
        await navigator.clipboard.writeText(`${art.title} — ${art.url}`);
        pushToast('Article link copied to clipboard', 'success');
      }
    } catch {
      // Cancelled share
    }
  };

  const combinedArticles =
    section === 'saved'
      ? savedArticles.map((s) => ({
          id: s.articleId,
          title: s.title,
          description: '',
          url: s.url,
          imageUrl: s.imageUrl,
          publishedAt: s.publishedAt,
          source: s.source || 'Saved',
          category: 'Saved',
        }))
      : section === 'football'
      ? [...customNews.filter((c) => footballCat === 'all' || c.category.toLowerCase() === footballCat), ...articles]
      : articles;

  const displayed = combinedArticles.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.source.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            STR Newsroom & Gaming Press
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Verified headlines with full publisher attribution and original links
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 rounded-xl p-1">
          {[
            { id: 'football' as const, label: 'Football News', icon: Newspaper },
            { id: 'gaming' as const, label: 'Gaming News', icon: Gamepad2 },
            { id: 'saved' as const, label: `Saved (${savedArticles.length})`, icon: Bookmark },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  section === s.id
                    ? 'bg-[#00E676] text-[#060B16]'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Filter + Search */}
      <div className="flex flex-col md:flex-row gap-3 justify-between">
        {section === 'football' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {['all', 'Breaking', 'Transfers', 'Clubs', 'International', 'Lebanese'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFootballCat(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap transition ${
                  footballCat === cat
                    ? 'bg-[#00E676] text-[#060B16] border-[#00E676]'
                    : 'bg-white dark:bg-[#0B1324] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                {cat === 'all' ? 'All Football' : cat === 'Lebanese' ? 'Lebanese Football' : cat}
              </button>
            ))}
          </div>
        )}

        {section === 'gaming' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Games' },
              { id: 'minecraft', label: 'Minecraft' },
              { id: 'roblox', label: 'Roblox' },
              { id: 'gta', label: 'GTA' },
              { id: 'rocket-league', label: 'Rocket League' },
              { id: 'fortnite', label: 'Fortnite' },
              { id: 'pubg', label: 'PUBG' },
            ].map((g) => (
              <button
                key={g.id}
                onClick={() => setGamingFilter(g.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap transition ${
                  gamingFilter === g.id
                    ? 'bg-[#00E676] text-[#060B16] border-[#00E676]'
                    : 'bg-white dark:bg-[#0B1324] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}

        <div className="relative md:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search headlines..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:border-[#00E676]"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-7 h-7 animate-spin text-[#00E676]" />
          <p className="text-sm">Loading verified headlines...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-500 text-center">
          {error}
        </div>
      ) : displayed.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
          No articles matched your filter.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayed.map((art) => {
            const saved = isSaved(art.id);
            return (
              <article
                key={art.id}
                onClick={() => setActiveArticle(art)}
                className="group cursor-pointer rounded-2xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 hover:border-[#00E676] overflow-hidden flex flex-col justify-between transition"
              >
                <div>
                  <div className="h-44 bg-slate-900 overflow-hidden">
                    <img
                      src={art.imageUrl || FALLBACK_IMG}
                      alt={art.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-[11px] text-slate-500">
                      {art.source} · {art.category} ·{' '}
                      {art.publishedAt ? new Date(art.publishedAt).toLocaleDateString() : ''}
                    </p>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                      {art.title}
                    </h2>
                    {art.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {art.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#00A844] dark:text-[#00E676]">
                    Read Story
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => toggleSaveArticle(art, e)}
                      aria-label="Save article"
                      className="p-2 rounded-lg text-slate-500 hover:text-[#00E676]"
                    >
                      {saved ? (
                        <BookmarkCheck className="w-4 h-4 text-[#00E676]" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => shareArticle(art, e)}
                      aria-label="Share article"
                      className="p-2 rounded-lg text-slate-500 hover:text-[#00E676]"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Article Reader Modal */}
      {activeArticle && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl">
            <div className="relative h-56 bg-slate-900">
              <img
                src={activeArticle.imageUrl || FALLBACK_IMG}
                alt={activeArticle.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                }}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setActiveArticle(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                Source: <span className="font-semibold text-slate-800 dark:text-slate-200">{activeArticle.source}</span> ·{' '}
                {activeArticle.category} ·{' '}
                {activeArticle.publishedAt ? new Date(activeArticle.publishedAt).toLocaleString() : ''}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {activeArticle.title}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeArticle.description || 'Open the publisher article below to read the full report.'}
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                {activeArticle.url !== '#str-editorial' && (
                  <a
                    href={activeArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00E676] text-[#060B16] font-bold text-xs hover:brightness-105"
                  >
                    Read Original Article on {activeArticle.source}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={(e) => shareArticle(activeArticle, e)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
