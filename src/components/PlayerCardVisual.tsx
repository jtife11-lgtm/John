import React, { useEffect, useState } from 'react';
import { Shield, Sparkles } from 'lucide-react';
import type { StrPlayerCard } from '../types/str';
import { RARITY_STYLES } from '../data/playerCardsCatalog';

const photoMemoryCache = new Map<string, string>();

export function usePlayerHeadshot(searchName?: string) {
  const [photoUrl, setPhotoUrl] = useState<string>(() =>
    searchName ? photoMemoryCache.get(searchName) || '' : ''
  );

  useEffect(() => {
    if (!searchName) return;
    if (photoMemoryCache.has(searchName)) {
      setPhotoUrl(photoMemoryCache.get(searchName) || '');
      return;
    }
    let active = true;
    fetch(`/api/football/players?q=${encodeURIComponent(searchName)}`)
      .then((r) => (r.ok ? r.json() : { players: [] }))
      .then((d) => {
        if (!active) return;
        const hit = Array.isArray(d.players) ? d.players.find((p: any) => p.photo) : null;
        const url = hit?.photo || '';
        photoMemoryCache.set(searchName, url);
        setPhotoUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [searchName]);

  return photoUrl;
}

export function PlayerCardVisual({
  card,
  count,
  compact = false,
  selected = false,
  onClick,
}: {
  card: StrPlayerCard;
  count?: number;
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const style = RARITY_STYLES[card.rarity];
  const photoUrl = usePlayerHeadshot(card.tsdbSearchName);
  const [imgBroken, setImgBroken] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-2xl border-2 bg-gradient-to-b ${style.gradient} ${style.border} ${
        style.glow
      } ${selected ? 'ring-2 ring-[#00E676] scale-[1.02]' : ''} ${
        onClick ? 'cursor-pointer hover:-translate-y-1 transition-all duration-300' : ''
      } overflow-hidden text-white select-none ${compact ? 'p-3 w-52' : 'p-4'}`}
    >
      {/* Animated shimmer for Epic / Legendary / Icon */}
      {(card.rarity === 'Legendary' || card.rarity === 'Icon' || card.rarity === 'Epic') && (
        <div
          className="pointer-events-none absolute -inset-full bg-gradient-to-tr from-transparent via-white/10 to-transparent rotate-12 translate-x-[-60%] group-hover:translate-x-[60%] transition-transform duration-700"
        />
      )}

      {/* Header Row: OVR + POS + Rarity */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="leading-none">
          <div className="font-mono-tabular text-2xl sm:text-3xl font-black tracking-tight text-white">
            {card.overall}
          </div>
          <div className="text-[10px] font-extrabold tracking-wider text-[#00E676] mt-0.5">
            {card.position}
          </div>
          <div className="text-[10px] text-slate-400 font-mono-tabular mt-0.5">
            #{card.jerseyNumber}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide inline-flex items-center gap-1 ${style.badgeBg}`}
          >
            {(card.rarity === 'Icon' || card.rarity === 'Legendary') && (
              <Sparkles className="w-2.5 h-2.5" />
            )}
            {card.rarity}
          </span>
          {typeof count === 'number' && count > 0 && (
            <span className="font-mono-tabular text-[10px] font-bold text-slate-300">
              ×{count} Owned
            </span>
          )}
        </div>
      </div>

      {/* Player Portrait / Jersey Crest */}
      <div
        className={`relative z-10 flex items-center justify-center my-2 ${
          compact ? 'h-24' : 'h-32'
        }`}
      >
        <div
          className="absolute w-24 h-24 rounded-full blur-xl opacity-35"
          style={{
            background: `linear-gradient(135deg, ${card.accentColors[0]}, ${card.accentColors[1]})`,
          }}
        />
        {photoUrl && !imgBroken ? (
          <img
            src={photoUrl}
            alt={card.name}
            referrerPolicy="no-referrer"
            onError={() => setImgBroken(true)}
            className={`relative z-10 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.65)] ${
              compact ? 'h-24' : 'h-32'
            }`}
          />
        ) : (
          <div
            className="relative z-10 w-20 h-20 rounded-2xl border-2 border-white/20 flex flex-col items-center justify-center shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${card.accentColors[0]}44, ${card.accentColors[1]}88)`,
            }}
          >
            <Shield className="w-6 h-6 text-white/80 mb-0.5" />
            <span className="font-display text-lg font-black tracking-tight">
              {card.jerseyNumber}
            </span>
          </div>
        )}
      </div>

      {/* Name & Club/Nation */}
      <div className="relative z-10 text-center border-t border-white/10 pt-2">
        <p className="font-display text-base font-extrabold tracking-tight truncate">{card.name}</p>
        <p className="text-[11px] text-slate-300 truncate">
          {card.club} · {card.nationalTeam}
        </p>
      </div>

      {/* 6 Core Attributes */}
      <div className="relative z-10 grid grid-cols-3 gap-x-2 gap-y-1 mt-2.5 pt-2 border-t border-white/10 text-[11px] font-mono-tabular">
        {[
          { k: 'PAC', v: card.stats.pace },
          { k: 'SHO', v: card.stats.shooting },
          { k: 'PAS', v: card.stats.passing },
          { k: 'DRI', v: card.stats.dribbling },
          { k: 'DEF', v: card.stats.defending },
          { k: 'PHY', v: card.stats.physical },
        ].map((st) => (
          <div key={st.k} className="flex items-center justify-between px-1">
            <span className="text-slate-400 font-semibold">{st.k}</span>
            <span className="font-extrabold text-white">{st.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
