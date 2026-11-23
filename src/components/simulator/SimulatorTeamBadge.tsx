import React, { useEffect, useState } from 'react';
import type { SimTeam } from '../../types/simulator';

const logoLookupCache = new Map<string, string>();

export function SimulatorTeamBadge({
  team,
  size = 'md',
}: {
  team: Pick<SimTeam, 'id' | 'name' | 'abbr' | 'logoUrl' | 'primaryColor' | 'secondaryColor'>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string>(
    () => team.logoUrl || logoLookupCache.get(team.id) || ''
  );
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
    if (team.logoUrl) {
      setResolvedUrl(team.logoUrl);
      return;
    }
    if (logoLookupCache.has(team.id)) {
      setResolvedUrl(logoLookupCache.get(team.id) || '');
      return;
    }
    if (team.id.startsWith('str-')) return;

    let active = true;
    fetch(`/api/football/search?q=${encodeURIComponent(team.name)}`)
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => {
        if (!active) return;
        const hit = Array.isArray(d.results)
          ? d.results.find((r: any) => r.type === 'team' && r.imageUrl)
          : null;
        const url = hit?.imageUrl || '';
        logoLookupCache.set(team.id, url);
        setResolvedUrl(url);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [team.id, team.logoUrl, team.name]);

  const sizeClass =
    size === 'xl'
      ? 'w-16 h-16 text-base'
      : size === 'lg'
      ? 'w-12 h-12 text-xs'
      : size === 'md'
      ? 'w-9 h-9 text-[11px]'
      : size === 'sm'
      ? 'w-7 h-7 text-[10px]'
      : 'w-5 h-5 text-[9px]';

  if (resolvedUrl && !broken) {
    return (
      <img
        src={resolvedUrl}
        alt={team.name}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`${sizeClass} object-contain shrink-0 drop-shadow-sm`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-xl border border-white/20 flex items-center justify-center font-black tracking-tight shrink-0 shadow-inner`}
      style={{
        background: `linear-gradient(135deg, ${team.primaryColor || '#E11D48'}, ${
          team.secondaryColor || '#0F1219'
        })`,
        color:
          team.primaryColor === '#FFFFFF' || team.primaryColor === '#FDE100' || team.primaryColor === '#F9D616' || team.primaryColor === '#FFDF00'
            ? '#0B0F17'
            : '#FFFFFF',
      }}
    >
      {team.abbr.slice(0, 3)}
    </div>
  );
}
