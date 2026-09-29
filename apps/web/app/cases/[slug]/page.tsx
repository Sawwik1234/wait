'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { get, post } from '../../../lib/api';
import { usePoll } from '../../../lib/hooks';
import { ItemCard, RarityBadge, Spinner, type ItemLike } from '../../../components/game';
import { RARITY_COLOR, useStore } from '../../../lib/store';
import { DICT } from '../../../lib/i18n';

interface CaseData {
  slug: string;
  name: string;
  description: string;
  image: string;
  price: number;
  rtp: number;
  category: string;
  items: { id: string; weight: number; item: ItemLike }[];
}
interface Odds {
  chances: number[];
  ev: number;
  rtp: number;
}
interface OpenResult {
  results: { inventoryItemId: string; item: ItemLike; roll: number; seed: string }[];
  balance: number;
  xp: number;
}

const CELL = 124;

export default function CasePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const setBalance = useStore((s) => s.setBalance);
  const toast = useStore((s) => s.toast);

  const { data: c, error } = usePoll<CaseData>(`/cases/${slug}`, 0);
  const { data: odds } = usePoll<Odds>(`/cases/${slug}/odds`, 0);

  const [fast, setFast] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'spin' | 'reveal'>('idle');
  const [reel, setReel] = useState<ItemLike[]>([]);
  const [offset, setOffset] = useState(0);
  const [duration, setDuration] = useState(0);
  const [results, setResults] = useState<OpenResult['results']>([]);
  const [resultIdx, setResultIdx] = useState(0);
  const [multiMode, setMultiMode] = useState(1);
  const stripRef = useRef<HTMLDivElement>(null);

  const fillers = useMemo(() => {
    if (!c) return [] as ItemLike[];
    const pool: ItemLike[] = [];
    for (const ci of c.items) {
      const n = Math.max(1, Math.round(ci.weight / 4));
      for (let i = 0; i < n; i++) pool.push(ci.item);
    }
    return pool;
  }, [c]);

  const pickFiller = useCallback(() => {
    return fillers[Math.floor(Math.random() * fillers.length)] ?? c!.items[0]!.item;
  }, [fillers, c]);

  const animateReel = useCallback(
    (target: ItemLike, idx: number) =>
      new Promise<void>((resolve) => {
        const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const cells: ItemLike[] = [];
        const TARGET = 46;
        for (let i = 0; i < 52; i++) cells.push(i === TARGET ? target : pickFiller());
        setReel(cells);

        if (fast || reduce) {
          setOffset(0);
          // instantly show target centered
          setReel([target]);
          setResultIdx(idx);
          setTimeout(resolve, 350);
          return;
        }

        const vw = stripRef.current?.clientWidth ?? 800;
        const jitter = (Math.random() - 0.5) * (CELL * 0.4);
        const dx = -(TARGET * CELL + CELL / 2 - vw / 2 + jitter);
        setOffset(0);
        setResultIdx(idx);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setDuration(4.4 + Math.random() * 0.8);
            setOffset(dx);
          });
        });
        setTimeout(resolve, 5100);
      }),
    [fast, pickFiller],
  );

  const doOpen = useCallback(
    async (count: number) => {
      if (!c) return;
      if (!me) {
        toast(t.authNeeded, 'err');
        router.push('/login');
        return;
      }
      const cost = c.price * count;
      if ((me.balance?.amount ?? 0) < cost) {
        toast(t.notEnough, 'err');
        return;
      }
      setMultiMode(count);
      setResults([]);
      setPhase('spin');
      try {
        const res = await post<OpenResult>(`/cases/${slug}/open`, { count });
        setBalance(res.balance);
        setResults(res.results);
        if (count === 1) {
          await animateReel(res.results[0]!.item, 0);
          setPhase('reveal');
        } else {
          if (fast) {
            setPhase('reveal');
          } else {
            for (let i = 0; i < res.results.length; i++) {
              await animateReel(res.results[i]!.item, i);
            }
            setPhase('reveal');
          }
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : t.error, 'err');
        setPhase('idle');
      }
    },
    [c, me, slug, animateReel, setBalance, toast, t, router],
  );

  if (error) return <div style={{ color: 'var(--danger)' }}>{t.error}</div>;
  if (!c) return <Spinner />;

  const sorted = [...c.items].sort((a, b) => b.item.value - a.item.value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Link href="/cases" style={{ color: 'var(--text-dim)', fontSize: 13 }}>← {t.cases}</Link>

      {/* header */}
      <section className="card rise-in" style={{ display: 'flex', gap: 24, padding: 24, flexWrap: 'wrap', alignItems: 'center', background: 'radial-gradient(600px 200px at 15% 0%, rgba(34,211,238,.1), transparent), var(--surface)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.image} alt={c.name} className="floaty" style={{ width: 170, height: 170, objectFit: 'contain' }} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>{c.name}</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 6 }}>{c.description}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 15 }} onClick={() => doOpen(1)} disabled={phase === 'spin'}>
              {t.openX1} · {c.price} AP
            </button>
            <button className="btn btn-ghost" style={{ padding: '12px 24px', fontSize: 15 }} onClick={() => doOpen(5)} disabled={phase === 'spin'}>
              {t.openX5} · {c.price * 5} AP
            </button>
            <label className="chip" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} style={{ accentColor: '#22d3ee' }} /> {t.fastMode}
            </label>
          </div>
          {odds && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)' }}>
              EV: <b style={{ color: 'var(--text)' }}>{Math.round(odds.ev)} AP</b> · RTP: <b style={{ color: 'var(--warning)' }}>{(odds.rtp * 100).toFixed(1)}%</b>
              <span style={{ marginLeft: 6 }}>({lang === 'ru' ? 'честные шансы, преимущество площадки' : 'honest odds, house edge'})</span>
            </div>
          )}
        </div>
      </section>

      {/* contents */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{t.contents}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {sorted.map((ci) => {
            const chance = odds?.chances[c.items.findIndex((x) => x.id === ci.id)] ?? 0;
            const col = RARITY_COLOR[ci.item.rarity] ?? '#888';
            return (
              <ItemCard
                key={ci.id}
                item={ci.item}
                footer={
                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    <div style={{ background: '#0e1219', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(2, Math.min(100, chance))}%`, height: '100%', background: col }} />
                    </div>
                    <span style={{ color: col, fontWeight: 700 }}>{chance < 0.1 ? '<0.1' : chance.toFixed(1)}%</span>
                    <span style={{ color: 'var(--text-dim)' }}> {t.chance.toLowerCase()}</span>
                  </div>
                }
              />
            );
          })}
        </div>
      </section>

      {/* opening overlay */}
      {phase !== 'idle' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(5,7,12,.92)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          {phase === 'spin' && (
            <>
              <div style={{ marginBottom: 18, fontSize: 13, color: 'var(--text-dim)' }}>
                {c.name} · {multiMode > 1 ? `${resultIdx + 1}/${multiMode}` : ''}
              </div>
              <div
                ref={stripRef}
                style={{ position: 'relative', width: '100%', maxWidth: 900, overflow: 'hidden', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)' }}
              >
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'var(--accent)', zIndex: 2, boxShadow: '0 0 14px var(--accent)' }} />
                {reel.length === 1 ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}>
                    <div className="pop-in" style={{ textAlign: 'center' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={reel[0]!.image} alt="" style={{ width: 180, height: 130, objectFit: 'contain' }} />
                      <div style={{ fontWeight: 800, marginTop: 6 }}>{reel[0]!.name}</div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="roulette-track"
                    style={{
                      display: 'flex',
                      transform: `translateX(${offset}px)`,
                      transitionDuration: `${duration}s`,
                      padding: '14px 0',
                    }}
                  >
                    {reel.map((it, i) => (
                      <div key={i} style={{ width: CELL, flexShrink: 0, textAlign: 'center', padding: '6px 4px', borderRight: '1px solid #1a2030' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.image} alt="" style={{ width: 96, height: 66, objectFit: 'contain' }} />
                        <div style={{ fontSize: 10, color: RARITY_COLOR[it.rarity], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {phase === 'reveal' && (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <h2 className="pop-in" style={{ fontSize: 22, fontWeight: 900, marginBottom: 18 }}>
                {multiMode > 1 ? `${t.open} ×${multiMode} — ${results.reduce((a, r) => a + r.item.value, 0).toLocaleString('ru')} AP` : t.yourBest}
              </h2>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 900 }}>
                {results.map((r) => (
                  <div key={r.inventoryItemId} className="pop-in" style={{ width: 170 }}>
                    <ItemCard item={r.item} glow={r.item.rarity === 'EPIC' || r.item.rarity === 'MYTHIC'} />
                    <button
                      className="btn btn-ghost"
                      style={{ width: '100%', marginTop: 6, padding: '7px 0', fontSize: 12 }}
                      onClick={async () => {
                        try {
                          const res = await post<{ gained: number; balance: number }>('/inventory/sell', { ids: [r.inventoryItemId] });
                          setBalance(res.balance);
                          toast(`${t.sold}: +${res.gained} AP`, 'ok');
                          setResults((rs) => rs.filter((x) => x.inventoryItemId !== r.inventoryItemId));
                        } catch (e) {
                          toast(e instanceof Error ? e.message : t.error, 'err');
                        }
                      }}
                    >
                      {t.sellNow} {Math.floor(r.item.value * 0.3)} AP
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
                <button className="btn btn-primary" style={{ padding: '11px 26px' }} onClick={() => doOpen(multiMode)}>
                  🔄 {t.again}
                </button>
                <button className="btn btn-ghost" style={{ padding: '11px 26px' }} onClick={() => setPhase('idle')}>
                  {t.toCollection}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
