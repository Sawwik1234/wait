'use client';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>🏆 {t.leaderboard}</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map((x) => (
          <button key={x.id} className={`chip ${tab === x.id ? 'active' : ''}`} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {data.map((r) => (
            <div
              key={`${r.rank}-${r.username}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 16px',
                borderBottom: '1px solid var(--border)',
                background: r.rank <= 3 ? 'rgba(251,191,36,.05)' : undefined,
              }}
            >
              <div style={{ width: 34, fontWeight: 900, fontSize: 15, color: r.rank === 1 ? '#fbbf24' : r.rank === 2 ? '#c0c8d8' : r.rank === 3 ? '#d0925f' : 'var(--text-dim)' }}>
                {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}
              </div>
              <Link href={`/profile/${r.username}`} style={{ fontWeight: 700, fontSize: 14, textDecoration: 'none', color: 'var(--text)' }}>
                {r.username} {r.isBot && <span className="chip" style={{ fontSize: 9, padding: '1px 7px' }}>{t.bot}</span>}
              </Link>
              {r.label && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.label}</span>}
              <div style={{ flex: 1 }} />
              <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{t.level} {r.level}</span>
              <span style={{ color: 'var(--accent)', fontWeight: 800, minWidth: 70, textAlign: 'right' }}>{r.score.toLocaleString('ru')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
