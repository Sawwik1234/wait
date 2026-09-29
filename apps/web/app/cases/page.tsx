'use client';

/**
 * Case catalogue (spec §2): sticky filter bar (search + categories + sort),
 * responsive grid of tilt cards with hover glow. Desktop & mobile share
 * the horizontal sticky filter (per spec), grid adapts by auto-fill.
 */

import { useMemo, useState } from 'react';
import { usePoll } from '../../lib/hooks';
import { CaseCard, Spinner, type CaseLike } from '../../components/game';
import { Tilt, Reveal } from '../../components/effects';
import { useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

export default function CasesPage() {
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const { data, error } = usePoll<CaseLike[]>('/cases', 0);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('default');

  const cats = useMemo(() => {
    const set = new Set((data ?? []).map((c) => c.category ?? 'standard'));
    return ['all', ...set];
  }, [data]);

  const list = useMemo(() => {
    let l = [...(data ?? [])];
    if (cat !== 'all') l = l.filter((c) => (c.category ?? 'standard') === cat);
    if (q.trim()) l = l.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (sort === 'price_asc') l.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') l.sort((a, b) => b.price - a.price);
    else if (sort === 'items') l.sort((a, b) => (b.items?.length ?? 0) - (a.items?.length ?? 0));
    else l.sort((a, b) => b.price - a.price); // popular = by price desc (most valuable first)
    return l;
  }, [data, q, cat, sort]);

  if (error) return <div style={{ color: 'var(--danger)' }}>{t.error}: {error}</div>;
  if (!data) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="rise-in">
        <span className="eyebrow">casearena catalogue</span>
        <h1 className="h-display" style={{ fontSize: 'clamp(24px, 3.4vw, 36px)', margin: '10px 0 0' }}>
          {t.cases} <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 500 }}>· {list.length}</span>
        </h1>
      </div>

      {/* sticky filter bar */}
      <div
        className="glass"
        style={{
          position: 'sticky', top: 58, zIndex: 40,
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          padding: '10px 12px', borderRadius: 14,
        }}
      >
        <input className="input" style={{ maxWidth: 230 }} placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
        {cats.map((c) => (
          <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
            {c === 'all' ? t.all : c}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="default">{t.popular}</option>
          <option value="price_asc">{t.priceAsc}</option>
          <option value="price_desc">{t.priceDesc}</option>
          <option value="items">{t.byItems}</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16 }}>
        {list.map((c, i) => (
          <Reveal key={c.slug} delay={Math.min(i * 50, 300)}>
            <Tilt>
              <CaseCard c={c} />
            </Tilt>
          </Reveal>
        ))}
      </div>

      {list.length === 0 && (
        <div className="card" style={{ padding: 34, textAlign: 'center', color: 'var(--text-dim)' }}>{t.search}: 0</div>
      )}
    </div>
  );
}
