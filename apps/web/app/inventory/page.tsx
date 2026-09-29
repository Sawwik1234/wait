'use client';

/**
 * Inventory as a personal collection (spec §5): MY COLLECTION header,
 * search / rarity / favorites / sort, GRID-COMPACT-LIST switcher.
 * Clicking a card opens the item showcase (/inventory/[id]);
 * the small checkbox selects items for bulk sell.
 */

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
  const [view, setView] = useState<'grid' | 'compact' | 'list'>('grid');

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

  const toggleSel = (id: string) => setSel((s) => (s.includes(id) ? s.filter((y) => y !== id) : [...s, id]));
  const toggleFav = async (x: InvRow) => {
    await patch(`/inventory/${x.id}/favorite`, { isFavorite: !x.isFavorite }).catch(() => {});
    reload();
  };

  if (!data && !useStore.getState().authReady) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ===== collection hero ===== */}
      <div className="rise-in" style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <span className="eyebrow">{t.myCollection}</span>
          <h1 className="h-display" style={{ fontSize: 'clamp(24px, 3.2vw, 34px)', margin: '10px 0 2px' }}>🎒 {t.inventory}</h1>
        </div>
        <div style={{ flex: 1 }} />
        {data && (
          <div style={{ display: 'flex', gap: 18, fontSize: 12.5, color: 'var(--text-dim)', paddingBottom: 4, flexWrap: 'wrap' }}>
            <span><b style={{ color: 'var(--text)', fontSize: 15 }}>{data.stats.count}</b> {t.itemsUnit}</span>
            <span><b style={{ color: 'var(--accent)', fontSize: 15 }}>{data.stats.shownValue.toLocaleString('ru')}</b> AP</span>
            {me && <span>{t.level} <b style={{ color: 'var(--text)', fontSize: 15 }}>{me.level.level}</b></span>}
          </div>
        )}
      </div>

      {/* ===== controls ===== */}
      <div className="glass" style={{ position: 'sticky', top: 58, zIndex: 40, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '10px 12px', borderRadius: 14 }}>
        <input className="input" style={{ maxWidth: 190 }} placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
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
        {/* GRID / COMPACT / LIST (spec §5) */}
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t.view}:</span>
        {([['grid', '▦'], ['compact', '▥'], ['list', '☰']] as const).map(([v, icon]) => (
          <button key={v} className={`chip ${view === v ? 'active' : ''}`} onClick={() => setView(v)} title={v} style={{ padding: '4px 9px', fontSize: 13 }}>
            {icon}
          </button>
        ))}
        {me && sel.length > 0 && (
          <button className="btn btn-danger" style={{ padding: '9px 16px', fontSize: 13 }} onClick={sell}>
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
      ) : view === 'list' ? (
        /* ===== LIST ===== */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((x) => {
            const c = RARITY_COLOR[x.item.rarity];
            const checked = sel.includes(x.id);
            return (
              <div key={x.id} className="card item-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 14px', border: `1px solid ${checked ? c : 'var(--border)'}` }}>
                <button
                  onClick={() => toggleSel(x.id)}
                  style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${checked ? c : 'var(--border)'}`, background: checked ? c : 'transparent', cursor: 'pointer', flexShrink: 0 }}
                  aria-label="select"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="item-img" src={x.item.image} alt="" loading="lazy" style={{ width: 46, height: 36, objectFit: 'contain', cursor: 'pointer' }} onClick={() => router.push(`/inventory/${x.id}`)} />
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/inventory/${x.id}`)}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.item.name}</div>
                  <div style={{ fontSize: 10.5, color: c, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{x.item.rarity}</div>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>{x.item.value} AP</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{t.sellFor} {Math.floor(x.item.value * 0.3)}</div>
                <button onClick={() => toggleFav(x)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: x.isFavorite ? 'var(--warning)' : 'var(--text-dim)' }}>
                  {x.isFavorite ? '★' : '☆'}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* ===== GRID / COMPACT ===== */
        <div style={{ display: 'grid', gridTemplateColumns: view === 'compact' ? 'repeat(auto-fill, minmax(110px, 1fr))' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: view === 'compact' ? 10 : 12 }}>
          {rows.map((x) => {
            const c = RARITY_COLOR[x.item.rarity];
            const checked = sel.includes(x.id);
            return (
              <div key={x.id} className="card card-hover item-card" style={{ overflow: 'hidden', border: `1px solid ${checked ? c : 'var(--border)'}`, position: 'relative' }}>
                <div style={{ height: 3, background: c }} />
                {/* selection checkbox */}
                <button
                  onClick={() => toggleSel(x.id)}
                  style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${checked ? c : 'var(--border)'}`, background: checked ? c : 'rgba(0,0,0,.35)', cursor: 'pointer', zIndex: 2 }}
                  aria-label="select"
                />
                {/* favorite star */}
                <div style={{ position: 'absolute', top: 7, right: 8, cursor: 'pointer', fontSize: 15, color: x.isFavorite ? 'var(--warning)' : 'var(--text-dim)', zIndex: 2 }} onClick={() => toggleFav(x)}>
                  {x.isFavorite ? '★' : '☆'}
                </div>
                <div style={{ cursor: 'pointer', textAlign: 'center', padding: view === 'compact' ? '12px 8px 8px' : '14px 10px 10px' }} onClick={() => router.push(`/inventory/${x.id}`)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="item-img" src={x.item.image} alt="" loading="lazy" style={{ width: view === 'compact' ? 64 : 96, height: view === 'compact' ? 46 : 66, objectFit: 'contain' }} />
                  <div style={{ fontSize: view === 'compact' ? 11 : 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.item.name}</div>
                  <div style={{ fontSize: 10, color: c, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{x.item.rarity}</div>
                  <div style={{ fontSize: view === 'compact' ? 10.5 : 11.5, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>{x.item.value} AP</div>
                  {view !== 'compact' && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      {t.sellFor}: {Math.floor(x.item.value * 0.3)} AP
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
