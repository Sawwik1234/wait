'use client';

import { useMemo, useState } from 'react';
import { usePoll } from '../../lib/hooks';
import { CaseCard, Spinner, type CaseLike } from '../../components/game';
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
    if (sort === 'price_desc') l.sort((a, b) => b.price - a.price);
    return l;
  }, [data, q, cat, sort]);

  if (error) return <div style={{ color: 'var(--danger)' }}>{t.error}: {error}</div>;
  if (!data) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{t.cases}</h1>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" style={{ maxWidth: 240 }} placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
        {cats.map((c) => (
          <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
            {c === 'all' ? t.all : c}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="default">{t.sort}</option>
          <option value="price_asc">{t.priceAsc}</option>
          <option value="price_desc">{t.priceDesc}</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
        {list.map((c) => (
          <CaseCard key={c.slug} c={c} />
        ))}
      </div>
    </div>
  );
}
