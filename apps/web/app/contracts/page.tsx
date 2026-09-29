'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { get, postIdem, post } from '../../lib/api';
import { usePoll } from '../../lib/hooks';
import { ItemCard, Spinner } from '../../components/game';
import { RARITY_COLOR, useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

interface InvItem {
  id: string;
  item: { id: string; slug: string; name: string; image: string; rarity: string; value: number };
}
interface PoolEntry {
  item: { id: string; slug: string; name: string; image: string; rarity: string; value: number };
  chance: number;
}
interface RunRes {
  inputCost: number;
  output: { id: string; slug: string; name: string; image: string; rarity: string; value: number };
  outputInventoryId: string;
}

export default function ContractsPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const toast = useStore((s) => s.toast);

  const { data } = usePoll<{ items: InvItem[] }>('/inventory', 0);
  const [selected, setSelected] = useState<string[]>([]);
  const [pool, setPool] = useState<PoolEntry[] | null>(null);
  const [phase, setPhase] = useState<'idle' | 'spin' | 'done'>('idle');
  const [outcome, setOutcome] = useState<RunRes | null>(null);

  const items = data?.items ?? [];
  const selItems = items.filter((x) => selected.includes(x.id));
  const sum = selItems.reduce((a, x) => a + x.item.value, 0);

  useEffect(() => {
    if (sum <= 0) {
      setPool(null);
      return;
    }
    let stop = false;
    post<{ pool: PoolEntry[]; targetEv: number }>('/contracts/preview', { inputCost: sum })
      .then((r) => {
        if (!stop) setPool(r.pool);
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [sum]);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 5 ? s : [...s, id]));
    setPhase('idle');
    setOutcome(null);
  };

  const ev = useMemo(() => (pool ?? []).reduce((a, p) => a + p.item.value * p.chance, 0), [pool]);

  const run = async () => {
    if (!me) {
      toast(t.authNeeded, 'err');
      router.push('/login');
      return;
    }
    if (selected.length < 3) return;
    setPhase('spin');
    try {
      const res = await postIdem<RunRes>('/contracts/run', { inventoryIds: selected });
      setTimeout(() => {
        setOutcome(res);
        setPhase('done');
        setSelected([]);
        toast(`${res.output.name}: ${res.output.value} AP`, 'ok');
      }, 1800);
    } catch (e) {
      toast(e instanceof Error ? e.message : t.error, 'err');
      setPhase('idle');
    }
  };

  if (!data && items.length === 0) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>📜 {t.contracts}</h1>
      <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>{t.contractHint}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 1fr)', gap: 16, alignItems: 'start' }} className="contract-grid">
        {/* picker */}
        <section className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
            {t.inventory} · {selected.length}/5 · {t.sum}: <span style={{ color: 'var(--accent)' }}>{sum} AP</span>
          </div>
          {items.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: 20, textAlign: 'center' }}>{t.emptyInventory}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, maxHeight: 430, overflowY: 'auto' }}>
              {items.map((x) => {
                const sel = selected.includes(x.id);
                const c = RARITY_COLOR[x.item.rarity];
                return (
                  <div
                    key={x.id}
                    onClick={() => toggle(x.id)}
                    style={{
                      cursor: 'pointer',
                      textAlign: 'center',
                      padding: 6,
                      borderRadius: 10,
                      border: `1px solid ${sel ? c : 'var(--border)'}`,
                      background: sel ? 'rgba(34,211,238,.08)' : 'transparent',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.item.image} alt="" style={{ width: 60, height: 44, objectFit: 'contain' }} />
                    <div style={{ fontSize: 9.5, color: c, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.item.name}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>{x.item.value}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* center: cube + outcomes */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 20, textAlign: 'center' }}>
            <div
              className={phase === 'spin' ? 'cube-shake' : ''}
              style={{
                width: 92,
                height: 92,
                margin: '0 auto',
                borderRadius: 18,
                background: 'linear-gradient(135deg, #1c2740, #0e1424)',
                border: '2px solid var(--accent)',
                boxShadow: '0 0 30px -8px var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 34,
              }}
            >
              {phase === 'done' && outcome ? '✨' : '📦'}
            </div>

            {outcome && phase === 'done' ? (
              <div className="pop-in" style={{ marginTop: 12 }}>
                <ItemCard item={outcome.output} glow />
              </div>
            ) : (
              <>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-dim)' }}>
                  {selected.length < 3 ? `${t.selectItems} 3–5 (${selected.length})` : `${t.sum}: ${sum} AP`}
                </div>
                {pool && (
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    {lang === 'ru' ? 'Ожидаемая ценность' : 'Expected value'}: <b style={{ color: 'var(--warning)' }}>{Math.round(ev)} AP</b>
                    <span style={{ color: 'var(--text-dim)' }}> ({sum > 0 ? Math.round((ev / sum) * 100) : 81}%)</span>
                  </div>
                )}
                <button className="btn btn-primary" style={{ marginTop: 12, padding: '12px 30px', fontSize: 15 }} disabled={selected.length < 3 || phase === 'spin'} onClick={run}>
                  {phase === 'spin' ? '…' : `📜 ${t.contractMake}`}
                </button>
              </>
            )}
          </div>

          {/* outcomes */}
          {pool && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{t.possibleOutcomes}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                {pool.map((p) => {
                  const c = RARITY_COLOR[p.item.rarity];
                  return (
                    <div key={p.item.id} style={{ textAlign: 'center', padding: 5, borderRadius: 8, border: '1px solid var(--border)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.item.image} alt="" style={{ width: 46, height: 34, objectFit: 'contain' }} />
                      <div style={{ fontSize: 9, color: c, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.item.name}</div>
                      <div style={{ fontSize: 9.5, color: 'var(--accent)', fontWeight: 700 }}>{(p.chance * 100).toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      <style jsx global>{`
        @media (max-width: 980px) {
          .contract-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
