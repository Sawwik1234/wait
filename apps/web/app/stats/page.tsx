'use client';

/**
 * Statistics (spec §11): personal data dashboard — big counters,
 * cumulative collection value area chart, activity heatmap (items
 * obtained per day) and rarity bars. Everything is derived from the
 * user's own real data (public profile + inventory); nothing invented.
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePoll } from '../../lib/hooks';
import { Spinner, StatCard } from '../../components/game';
import { RARITY_COLOR, useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

interface InvRow {
  id: string;
  createdAt: string;
  item: { value: number; rarity: string };
}
interface Profile {
  stats: { collectionCount: number; collectionValue: number; opens: number; upgradeWins: number };
}

const DAY = 86400000;
const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'MYTHIC'];

export default function StatsPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const authReady = useStore((s) => s.authReady);

  const { data: inv } = usePoll<{ items: InvRow[] }>(me ? '/inventory' : null, 0);
  const { data: pf } = usePoll<Profile>(me ? `/users/${me.username}` : null, 0);

  const model = useMemo(() => {
    if (!inv) return null;
    const items = inv.items;
    const now = Date.now();
    const days = 91;
    const byDay = new Map<string, { count: number; value: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const key = new Date(now - i * DAY).toISOString().slice(0, 10);
      byDay.set(key, { count: 0, value: 0 });
    }
    for (const x of items) {
      const key = x.createdAt.slice(0, 10);
      const d = byDay.get(key);
      if (d) {
        d.count += 1;
        d.value += x.item.value;
      }
    }
    const series = [...byDay.entries()]; // [date, {count,value}] oldest first
    let acc = 0;
    const cum = series.map(([d, v]) => {
      acc += v.value;
      return { d, v: acc };
    });
    const maxCum = Math.max(1, ...cum.map((c) => c.v));
    const maxCnt = Math.max(1, ...series.map(([, v]) => v.count));
    const rar = RARITIES.map((r) => ({ r, n: items.filter((x) => x.item.rarity === r).length }));
    return { series, cum, maxCum, maxCnt, rar, total: items.length };
  }, [inv]);

  if (!me) {
    if (!authReady) return <Spinner />;
    return (
      <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>
        {t.authNeeded}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={() => router.push('/login')}>{t.login}</button>
        </div>
      </div>
    );
  }
  if (!model || !pf) return <Spinner />;

  // area chart geometry
  const W = 600, H = 120, PAD = 4;
  const pts = model.cum.map((c, i) => {
    const x = PAD + (i / Math.max(1, model.cum.length - 1)) * (W - 2 * PAD);
    const y = H - PAD - (c.v / model.maxCum) * (H - 2 * PAD);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <div className="eyebrow">DATA DASHBOARD</div>
        <h1 className="h-display" style={{ fontSize: 'clamp(26px, 4vw, 38px)', margin: '4px 0 0' }}>📊 {t.stats}</h1>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <StatCard label={t.casesOpened} value={pf.stats.opens} />
        <StatCard label={t.itemsCollected} value={pf.stats.collectionCount} />
        <StatCard label={t.upgradesWon} value={pf.stats.upgradeWins} accent="var(--success)" />
        <StatCard label={t.collectionValue} value={`${pf.stats.collectionValue.toLocaleString('ru')} AP`} accent="var(--accent)" />
      </section>

      <section className="card" style={{ padding: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          {lang === 'ru' ? 'Накопленная ценность коллекции · 90 дней' : 'Cumulative collection value · 90 days'}
        </div>
        {model.total === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: 20, textAlign: 'center' }}>{t.empty}</div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120, display: 'block' }} role="img">
            <defs>
              <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`${PAD},${H - PAD} ${pts.join(' ')} ${W - PAD},${H - PAD}`} fill="url(#areaG)" />
            <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" />
          </svg>
        )}
      </section>

      <section className="card" style={{ padding: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          {lang === 'ru' ? 'Получение предметов · 13 недель' : 'Items obtained · 13 weeks'}
        </div>
        <div className="heatmap">
          {model.series.map(([d, v]) => {
            const lvl = v.count === 0 ? 0 : Math.ceil((v.count / model.maxCnt) * 4);
            return <div key={d} className={`hm-cell ${lvl ? `hm-l${lvl}` : ''}`} title={`${d}: ${v.count}`} />;
          })}
        </div>
      </section>

      <section className="card" style={{ padding: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          {lang === 'ru' ? 'Распределение по редкости' : 'Rarity distribution'}
        </div>
        {model.rar.map(({ r, n }) => {
          const c = RARITY_COLOR[r] ?? 'var(--border)';
          const pct = model.total ? (n / model.total) * 100 : 0;
          return (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ width: 74, fontSize: 10.5, letterSpacing: '.12em', color: c }}>{r}</span>
              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 99, transition: 'width .5s ease' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 54, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {n} · {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
}
