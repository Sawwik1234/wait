'use client';

/**
 * Leaderboard (spec §10): podium with big top-3 cards (scale+glow
 * entrance), the rest as compact rows. Ranking tabs use real backend
 * aggregations only — no fabricated numbers.
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePoll } from '../../lib/hooks';
import { Spinner } from '../../components/game';
import { useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

interface Row {
  rank: number;
  username: string;
  score: number;
  level: number;
  isBot: boolean;
  label?: string;
}

const HUES = [190, 262, 330, 24, 150, 210, 285, 60];
const hue = (s: string) => HUES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
const initials = (s: string) => s.slice(0, 2).toUpperCase();

function PodiumCard({ r, place }: { r: Row; place: 1 | 2 | 3 }) {
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const h = hue(r.username);
  const medal = place === 1 ? '#fbbf24' : place === 2 ? '#c0c8d8' : '#d0925f';
  return (
    <div
      className={`podium-card rise-in ${place === 1 ? 'podium-1' : ''}`}
      style={{ animationDelay: `${place * 90}ms` }}
    >
      <div style={{ fontSize: 10, letterSpacing: '.22em', color: medal, fontWeight: 800 }}>#{place}</div>
      <div className="podium-ava" style={{ background: `linear-gradient(135deg, hsl(${h} 70% 62%), hsl(${h + 40} 70% 48%))` }}>
        {initials(r.username)}
      </div>
      <Link href={`/profile/${r.username}`} className="h-display" style={{ fontSize: place === 1 ? 17 : 14.5, textDecoration: 'none', color: 'var(--text)', display: 'block' }}>
        {r.username}
      </Link>
      <div style={{ marginTop: 5, fontWeight: 800, color: place === 1 ? medal : 'var(--accent)', fontSize: place === 1 ? 20 : 15, fontVariantNumeric: 'tabular-nums' }}>
        {r.score.toLocaleString('ru')}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 3 }}>
        {t.level} {r.level}{r.isBot ? ` · ${t.bot}` : ''}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const [tab, setTab] = useState<'xp' | 'collection' | 'opens' | 'profit'>('xp');
  const { data } = usePoll<Row[]>(`/leaderboard?tab=${tab}`, 10000);

  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'xp', label: t.xp },
    { id: 'collection', label: t.collection },
    { id: 'opens', label: t.opens },
    { id: 'profit', label: lang === 'ru' ? 'Рекорды' : 'Records' },
  ];

  const top = data?.slice(0, 3) ?? [];
  const rest = data?.slice(3) ?? [];
  const ordered = top.length === 3 ? [top[1], top[0], top[2]] : top;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <div className="eyebrow">TOP OF THE ARENA</div>
        <h1 className="h-display" style={{ fontSize: 'clamp(26px, 4vw, 38px)', margin: '4px 0 0' }}>{t.leaderboard}</h1>
      </header>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="tablist">
        {tabs.map((x) => (
          <button key={x.id} className={`chip ${tab === x.id ? 'active' : ''}`} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <>
          {ordered.length === 3 && (
            <div className="podium">
              <PodiumCard r={ordered[0]} place={2} />
              <PodiumCard r={ordered[1]} place={1} />
              <PodiumCard r={ordered[2]} place={3} />
            </div>
          )}

          <div className="card" style={{ overflow: 'hidden' }}>
            {rest.map((r, i) => (
              <div
                key={`${r.rank}-${r.username}`}
                className="reveal"
                style={{ animationDelay: `${i * 30}ms`, display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border)' }}
              >
                <div style={{ width: 34, fontWeight: 800, fontSize: 14, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>#{r.rank}</div>
                <Link href={`/profile/${r.username}`} style={{ fontWeight: 700, fontSize: 14, textDecoration: 'none', color: 'var(--text)' }}>
                  {r.username} {r.isBot && <span className="chip" style={{ fontSize: 9, padding: '1px 7px' }}>{t.bot}</span>}
                </Link>
                {r.label && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.label}</span>}
                <div style={{ flex: 1 }} />
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{t.level} {r.level}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 800, minWidth: 70, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.score.toLocaleString('ru')}</span>
              </div>
            ))}
            {rest.length === 0 && ordered.length > 0 && (
              <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12.5 }}>— TOP 3 —</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
