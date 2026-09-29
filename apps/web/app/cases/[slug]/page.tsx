'use client';

/**
 * Cinematic case presentation (spec §3): huge case on the left,
 * details + honest odds + OPEN on the right, item pool as a collection
 * (rare items render larger) with a floating preview on hover.
 * The opening itself lives on the full-screen /cases/[slug]/open route.
 */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { usePoll } from '../../../lib/hooks';
import { RarityBadge, Spinner, type ItemLike } from '../../../components/game';
import { Tilt, Reveal, Magnetic } from '../../../components/effects';
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

export default function CasePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);

  const { data: c, error } = usePoll<CaseData>(`/cases/${slug}`, 0);
  const { data: odds } = usePoll<Odds>(`/cases/${slug}/odds`, 0);

  // chance % aligned to items order
  const chanceById = useMemo(() => {
    const m = new Map<string, number>();
    if (c && odds?.chances) c.items.forEach((ci, i) => m.set(ci.id, odds.chances[i] ?? 0));
    return m;
  }, [c, odds]);

  if (error) return <div style={{ color: 'var(--danger)', padding: 20 }}>{t.error}</div>;
  if (!c) return <Spinner />;

  const sorted = [...c.items].sort((a, b) => b.item.value - a.item.value);
  const best = sorted[0]?.item;
  const bestColor = best ? RARITY_COLOR[best.rarity] ?? 'var(--accent)' : 'var(--accent)';

  const open = (count: number) => {
    if (!me) {
      router.push('/login');
      return;
    }
    router.push(`/cases/${slug}/open?count=${count}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <Link href="/cases" style={{ color: 'var(--text-dim)', fontSize: 13, textDecoration: 'none' }}>← {t.cases}</Link>

      {/* ===== cinematic hero ===== */}
      <section
        className="card rise-in"
        style={{
          display: 'grid', gridTemplateColumns: 'minmax(220px, 380px) minmax(0, 1fr)', gap: 28,
          padding: 30, alignItems: 'center', overflow: 'hidden', position: 'relative',
          background: `radial-gradient(560px 260px at 18% 0%, ${bestColor}14, transparent 65%), var(--surface)`,
        }}
      >
        <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.6 }} />
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{ position: 'absolute', inset: '12%', borderRadius: 99, background: `radial-gradient(circle, ${bestColor}22, transparent 65%)`, filter: 'blur(8px)' }} />
          <Tilt max={10}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image} alt={c.name} style={{ width: '100%', maxWidth: 300, aspectRatio: '1/1', objectFit: 'contain', filter: `drop-shadow(0 26px 46px ${bestColor}33)` }} />
          </Tilt>
        </div>

        <div style={{ position: 'relative' }}>
          <span className="eyebrow">{c.category || 'standard'}</span>
          <h1 className="h-display" style={{ fontSize: 'clamp(24px, 3.4vw, 38px)', margin: '12px 0 8px' }}>{c.name}</h1>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 12 }}>
            <span>📦 {c.items.length} {t.itemsUnit}</span>
            <span>📊 RTP {Math.round(c.rtp)}%</span>
            {odds && <span>💎 {t.avgValue}: {Math.round(odds.ev).toLocaleString('ru')} AP</span>}
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6, maxWidth: 520 }}>{c.description}</p>

          <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
            <Magnetic>
              <button className="btn btn-primary" style={{ padding: '15px 34px', fontSize: 15, letterSpacing: '0.08em' }} onClick={() => open(1)}>
                {t.poolOpenCta} · {c.price.toLocaleString('ru')} AP
              </button>
            </Magnetic>
            <button className="btn btn-ghost glass" style={{ padding: '15px 26px', fontSize: 14 }} onClick={() => open(5)}>
              {t.openX5} · {(c.price * 5).toLocaleString('ru')} AP
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)', opacity: 0.75, marginTop: 12 }}>{t.noRealMoney}</div>
        </div>
      </section>

      {/* ===== item pool ===== */}
      <Reveal>
        <h2 className="h-display" style={{ fontSize: 20, marginBottom: 14 }}>{t.itemPool}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
          {sorted.map((ci) => {
            const color = RARITY_COLOR[ci.item.rarity] ?? 'var(--border)';
            const big = ci.item.rarity === 'EPIC' || ci.item.rarity === 'MYTHIC';
            const chance = chanceById.get(ci.id);
            return (
              <div
                key={ci.id}
                className="card card-hover pool-item"
                style={{
                  gridColumn: big ? 'span 2' : undefined,
                  overflow: 'visible',
                  borderColor: 'var(--border)',
                  textAlign: 'center',
                  padding: '16px 12px 12px',
                }}
              >
                {/* floating preview (spec §3) */}
                <div className="pool-preview" style={{ borderColor: color }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800 }}>{ci.item.name}</div>
                  <div style={{ fontSize: 10.5, marginTop: 4, color }}>RARITY · <b>{ci.item.rarity}</b></div>
                  <div style={{ fontSize: 10.5, marginTop: 2, color: 'var(--accent)' }}>VALUE · <b>{ci.item.value.toLocaleString('ru')} AP</b></div>
                  <div style={{ fontSize: 10.5, marginTop: 2, color: 'var(--text-dim)' }}>{t.collection} · <b>{c.name}</b></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="item-img"
                    src={ci.item.image}
                    alt={ci.item.name}
                    loading="lazy"
                    style={{ width: big ? 150 : 110, aspectRatio: '4/3', objectFit: 'contain', filter: `drop-shadow(0 8px 18px ${color}22)` }}
                  />
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ci.item.name}</div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  <RarityBadge rarity={ci.item.rarity} />
                  {chance !== undefined && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{t.chance} {chance.toFixed(2)}%</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>{ci.item.value.toLocaleString('ru')} AP</div>
              </div>
            );
          })}
        </div>
      </Reveal>
    </div>
  );
}
