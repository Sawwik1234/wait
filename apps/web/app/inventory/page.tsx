'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { patch, post } from '../../lib/api';
import { usePoll } from '../../lib/hooks';
import { Spinner } from '../../components/game';
import { RARITY_COLOR, useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

interface InvRow {
  id: string;
  sourceType: string;
  isFavorite: boolean;
  createdAt: string;
  item: { id: string; slug: string; name: string; image: string; rarity: string; value: number };
}

const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'MYTHIC'];

export default function InventoryPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const setBalance = useStore((s) => s.setBalance);
  const toast = useStore((s) => s.toast);

  const { data, reload } = usePoll<{ items: InvRow[]; stats: { count: number; shownValue: number; sellSum: number } }>('/inventory', 0);
  const [rar, setRar] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('value_desc');
  const [fav, setFav] = useState(false);
  const [sel, setSel] = useState<string[]>([]);

  const rows = useMemo(() => {
    let l = [...(data?.items ?? [])];
    if (rar !== 'all') l = l.filter((x) => x.item.rarity === rar);
    if (q.trim()) l = l.filter((x) => x.item.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (fav) l = l.filter((x) => x.isFavorite);
    if (sort === 'value_asc') l.sort((a, b) => a.item.value - b.item.value);
    else if (sort === 'new') l.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    else l.sort((a, b) => b.item.value - a.item.value);
    return l;
  }, [data, rar, q, fav, sort]);

  const selSum = rows.filter((x) => sel.includes(x.id)).reduce((a, x) => a + Math.floor(x.item.value * 0.3), 0);

  const sell = async () => {
    if (sel.length === 0) return;
    try {
      const res = await post<{ soldCount: number; gained: number; balance: number }>('/inventory/sell', { ids: sel });
      setBalance(res.balance);
      toast(`${t.sold}: ${res.soldCount} · ${t.gained}: ${res.gained} AP`, 'ok');
      setSel([]);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t.error, 'err');
    }
  };

  if (!data && !useStore.getState().authReady) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>🎒 {t.inventory}</h1>
        {data && (
          <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            {data.stats.count} · <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{data.stats.shownValue.toLocaleString('ru')} AP</span>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" style={{ maxWidth: 200 }} placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={`chip ${rar === 'all' ? 'active' : ''}`} onClick={() => setRar('all')}>{t.all}</button>
        {RARITIES.map((r) => (
          <button key={r} className={`chip ${rar === r ? 'active' : ''}`} onClick={() => setRar(r)} style={rar === r ? { color: RARITY_COLOR[r], borderColor: RARITY_COLOR[r] } : {}}>
            {r}
          </button>
        ))}
        <button className={`chip ${fav ? 'active' : ''}`} onClick={() => setFav(!fav)}>★ {t.favorites}</button>
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="value_desc">{t.valueDesc}</option>
          <option value="value_asc">{t.sort} AP ↑</option>
          <option value="new">{t.newest}</option>
        </select>
        <div style={{ flex: 1 }} />
        {me && sel.length > 0 && (
          <button className="btn btn-danger" style={{ padding: '9px 18px', fontSize: 13 }} onClick={sell}>
            {t.sellSelected} ({sel.length}) · +{selSum} AP
          </button>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>ℹ {t.sellHint}</div>

      {!me ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>
          {t.authNeeded} · <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={() => router.push('/login')}>{t.login}</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>{t.emptyInventory}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {rows.map((x) => {
            const c = RARITY_COLOR[x.item.rarity];
            const checked = sel.includes(x.id);
            return (
              <div key={x.id} className="card card-hover" style={{ overflow: 'hidden', border: `1px solid ${checked ? c : 'var(--border)'}`, position: 'relative' }}>
                <div style={{ height: 3, background: c }} />
                <div
                  style={{ position: 'absolute', top: 8, right: 8, cursor: 'pointer', fontSize: 15, color: x.isFavorite ? 'var(--warning)' : 'var(--text-dim)', zIndex: 2 }}
                  onClick={async () => {
                    await patch(`/inventory/${x.id}/favorite`, { isFavorite: !x.isFavorite }).catch(() => {});
                    reload();
                  }}
                >
                  {x.isFavorite ? '★' : '☆'}
                </div>
                <div
                  style={{ cursor: 'pointer', textAlign: 'center', padding: '12px 10px 10px' }}
                  onClick={() => setSel((s) => (s.includes(x.id) ? s.filter((y) => y !== x.id) : [...s, x.id]))}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.item.image} alt="" loading="lazy" style={{ width: 96, height: 66, objectFit: 'contain' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.item.name}</div>
                  <div style={{ fontSize: 10.5, color: c, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{x.item.rarity}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>{x.item.value} AP</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {t.sell}: {Math.floor(x.item.value * 0.3)} AP
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
