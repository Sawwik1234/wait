'use client';

/**
 * Full-screen cinematic case opening (spec §4).
 * Calm by design: no countdowns, no urgency — the reel spins once,
 * the reveal intensity follows item rarity, honest odds stay visible.
 */

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { postIdem } from '../../../../lib/api';
import { usePoll } from '../../../../lib/hooks';
import { ItemCard, Spinner, type ItemLike } from '../../../../components/game';
import { Magnetic } from '../../../../components/effects';
import { RARITY_COLOR, useStore } from '../../../../lib/store';
import { DICT } from '../../../../lib/i18n';

interface CaseData {
  slug: string;
  name: string;
  image: string;
  price: number;
  rtp: number;
  items: { weight: number; item: ItemLike }[];
}
interface OpenResult {
  results: { inventoryItemId: string; item: ItemLike; roll: number; seed: string }[];
  balance: number;
  xp: number;
}

const CELL = 124;
const RARITY_ORDER = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'MYTHIC'];

export default function CaseOpenPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <OpenScreen />
    </Suspense>
  );
}

function OpenScreen() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const setBalance = useStore((s) => s.setBalance);
  const toast = useStore((s) => s.toast);

  const initialCount = search.get('count') === '5' ? 5 : 1;
  const { data: c, error } = usePoll<CaseData>(`/cases/${slug}`, 0);

  const [count, setCount] = useState(initialCount);
  const [fast, setFast] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'spin' | 'reveal'>('idle');
  const [reel, setReel] = useState<ItemLike[]>([]);
  const [offset, setOffset] = useState(0);
  const [duration, setDuration] = useState(0);
  const [results, setResults] = useState<OpenResult['results']>([]);
  const [resultIdx, setResultIdx] = useState(0);
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

  const pickFiller = useCallback(
    () => fillers[Math.floor(Math.random() * fillers.length)] ?? c!.items[0]!.item,
    [fillers, c],
  );

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
    async (n: number) => {
      if (!c) return;
      setCount(n);
      setResults([]);
      setPhase('spin');
      try {
        const res = await postIdem<OpenResult>(`/cases/${slug}/open`, { count: n });
        setBalance(res.balance);
        setResults(res.results);
        if (n === 1 || fast) {
          if (n === 1) {
            await animateReel(res.results[0]!.item, 0);
          }
          setPhase('reveal');
        } else {
          for (let i = 0; i < res.results.length; i++) {
            await animateReel(res.results[i]!.item, i);
          }
          setPhase('reveal');
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : t.error, 'err');
        setPhase('idle');
      }
    },
    [c, slug, animateReel, setBalance, toast, t, fast],
  );

  if (error) return <div style={{ color: 'var(--danger)', padding: 30 }}>{t.error}</div>;
  if (!c) return <Spinner />;

  const best = results.length
    ? results.reduce((a, r) => (r.item.value > a.item.value ? r : a), results[0]!).item
    : null;
  const glowColor = best ? RARITY_COLOR[best.rarity] ?? 'var(--accent)' : 'var(--accent)';
  const glowAlpha = best ? 0.1 + RARITY_ORDER.indexOf(best.rarity) * 0.05 : 0.12;
  const sum = results.reduce((a, r) => a + r.item.value, 0);

  return (
    <div className="open-screen" style={{ ['--open-glow' as string]: `rgba(34,211,238,${glowAlpha})` }}>
      <div className="grid-bg" style={{ position: 'fixed', inset: 0 }} />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 980, margin: '0 auto', padding: '26px 20px 60px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href={`/cases/${slug}`} style={{ color: 'var(--text-dim)', fontSize: 13, textDecoration: 'none' }}>
            ← {t.goBack}
          </Link>
          <div style={{ flex: 1 }} />
          <button className={`chip ${fast ? 'active' : ''}`} onClick={() => setFast(!fast)}>
            ⚡ {t.fastMode}
          </button>
        </div>

        {/* case identity */}
        <div style={{ textAlign: 'center' }}>
          <div className="h-display" style={{ fontSize: 'clamp(20px, 3vw, 30px)' }}>
            {c.name}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: 12.5, marginTop: 4 }}>
            {c.price.toLocaleString('ru')} AP · {c.items.length} {t.itemsUnit} · RTP {Math.round(c.rtp)}%
          </div>
        </div>

        {/* stage */}
        {phase === 'idle' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: '30px 0' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image} alt={c.name} className="floaty" style={{ width: 230, height: 230, objectFit: 'contain', filter: 'drop-shadow(0 24px 50px rgba(34,211,238,.25))' }} />
            <Magnetic>
              <button className="btn btn-primary" onClick={() => doOpen(1)} style={{ padding: '18px 46px', fontSize: 17, letterSpacing: '0.1em', boxShadow: '0 0 44px -10px rgba(34,211,238,.55)' }}>
                {t.poolOpenCta} · {c.price} AP
              </button>
            </Magnetic>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ padding: '10px 22px', fontSize: 13 }} onClick={() => doOpen(5)}>
                {t.openX5} · {c.price * 5} AP
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', opacity: 0.75, maxWidth: 420, textAlign: 'center' }}>{t.noRealMoney}</div>
          </div>
        )}

        {(phase === 'spin' || (phase === 'reveal' && reel.length > 0 && results.length === count)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, letterSpacing: '0.14em' }}>
              {count > 1 && phase === 'spin' ? `${t.open} ×${count} — ${resultIdx + 1}/${count}` : `${t.open} ×${count}`}
            </div>
            <div className="reel-window scanlines" ref={stripRef} style={{ height: CELL + 24 }}>
              <div className="reel-marker" />
              <div
                className="roulette-track"
                style={{ display: 'flex', alignItems: 'center', gap: 0, transform: `translateX(${offset}px)`, transition: `transform ${duration}s`, height: '100%' }}
              >
                {reel.map((it, i) => (
                  <div
                    key={i}
                    style={{
                      width: CELL, height: CELL, flexShrink: 0, margin: '0 6px', borderRadius: 14,
                      border: `1px solid ${RARITY_COLOR[it.rarity] ?? 'var(--border)'}`,
                      background: 'rgba(14,17,23,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.image} alt={it.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* reveal */}
        {phase === 'reveal' && results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
            <h2 className="pop-in h-display text-glow" style={{ fontSize: 22, margin: 0, color: glowColor }}>
              {count > 1 ? `${t.open} ×${count} — ${sum.toLocaleString('ru')} AP` : t.yourBest}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14, width: '100%', justifyItems: 'center' }}>
              {results.map((r) => (
                <div key={r.inventoryItemId} style={{ minWidth: 150 }}>
                  <ItemCard item={r.item} glow />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
              <button className="btn btn-primary" style={{ padding: '12px 26px', fontSize: 14 }} onClick={() => doOpen(count)}>
                {t.openAgain}
              </button>
              <button className="btn btn-ghost" style={{ padding: '12px 26px', fontSize: 14 }} onClick={() => router.push('/inventory')}>
                🎒 {t.toInventory}
              </button>
              <Link href={`/cases/${slug}`} className="btn btn-ghost" style={{ padding: '12px 26px', fontSize: 14, textDecoration: 'none' }}>
                ← {t.goBack}
              </Link>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', opacity: 0.7 }}>{t.economyNote}</div>
          </div>
        )}
      </div>
    </div>
  );
}

