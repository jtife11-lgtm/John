import React, { useEffect, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { FOOTBALL_GLOSSARY } from '../data/footballCatalog';
import { useApp } from '../context/AppContext';
import type { SearchEntityResult } from '../types/str';

export function GlobalSearchModal() {
  const { showSearchModal, setShowSearchModal, setActiveTab, setSelectedPlayerKey } = useApp();
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<SearchEntityResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showSearchModal || queryText.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/football/search?q=${encodeURIComponent(queryText.trim())}`)
        .then((r) => r.json())
        .then((d) => setResults(Array.isArray(d.results) ? d.results : []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 320);
    return () => clearTimeout(timer);
  }, [queryText, showSearchModal]);

  if (!showSearchModal) return null;

  const glossaryMatches = FOOTBALL_GLOSSARY.filter(
    (g) =>
      queryText.trim().length >= 2 &&
      (g.term.toLowerCase().includes(queryText.toLowerCase()) ||
        g.definition.toLowerCase().includes(queryText.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center p-4 pt-16">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#0B1324] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-[#00E676] shrink-0" />
          <input
            type="text"
            autoFocus
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search teams, players, competitions, or football glossary..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
          />
          <button
            onClick={() => setShowSearchModal(false)}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#00E676]" />
              Searching football database...
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase">Teams & Players</p>
              {results.map((r) => (
                <div
                  key={r.id}
                  onClick={() => {
                    setShowSearchModal(false);
                    if (r.type === 'player') {
                      setSelectedPlayerKey(r.id.replace(/^player-/, ''));
                      setActiveTab('players');
                    } else {
                      setActiveTab('stats');
                    }
                  }}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 hover:border-[#00E676] cursor-pointer flex items-center gap-3"
                >
                  {r.imageUrl && (
                    <img
                      src={r.imageUrl}
                      alt={r.name}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 object-contain rounded-lg"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {r.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{r.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {glossaryMatches.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase">Glossary</p>
              {glossaryMatches.map((g) => (
                <div
                  key={g.term}
                  onClick={() => {
                    setShowSearchModal(false);
                    setActiveTab('extra');
                  }}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#060B16] border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  <p className="text-xs font-bold text-[#00E676]">{g.term}</p>
                  <p className="text-xs text-slate-500">{g.definition}</p>
                </div>
              ))}
            </div>
          )}

          {!loading && queryText.trim().length >= 2 && results.length === 0 && glossaryMatches.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-500">
              No matching teams, players, or terms found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
