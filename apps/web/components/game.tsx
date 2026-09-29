'use client';

import Link from 'next/link';
import { RARITY_COLOR, fmt, useStore } from '../lib/store';

export function useT() {
  const lang = useStore((s) => s.lang);
  return DICT_CACHE[lang];
}

// avoid circular import cost; dict is static
import { DICT } from '../lib/i18n';
const DICT_CACHE = DICT;

export function RarityDot({ rarity }: { rarity: string }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 99, background: RARITY_COLOR[rarity] ?? '#888' }} />;
}

export function RarityBadge({ rarity }: { rarity: string }) {
  return (
    <span style={{ color: RARITY_COLOR[rarity] ?? '#888', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
      {rarity}
    </span>
  );
}

export interface ItemLike {
  id?: string;
  slug: string;
  name: string;
  image: string;
  rarity: string;
  value: number;
}

export function ItemCard({ item, footer, selected, onClick, glow }: { item: ItemLike; footer?: React.ReactNode; selected?: boolean; onClick?: () => void; glow?: boolean }) {
  const c = RARITY_COLOR[item.rarity] ?? '#888';
  return (
    <div
      onClick={onClick}
      className={`card item-card ${onClick ? 'card-hover' : ''}`}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        border: `1px solid ${selected ? c : 'var(--border)'}`,
        boxShadow: glow ? `0 0 22px -8px ${c}` : selected ? `0 0 16px -6px ${c}` : undefined,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div style={{ height: 3, background: c, opacity: 0.9 }} />
      <div style={{ padding: '12px 12px 8px', textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="item-img" src={item.image} alt={item.name} loading="lazy" style={{ width: '100%', maxWidth: 130, aspectRatio: '4/3', objectFit: 'contain' }} />
      </div>
      <div style={{ padding: '0 12px 10px', textAlign: 'center' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 3 }}>
          <RarityBadge rarity={item.rarity} />
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{item.value.toLocaleString('ru')} AP</span>
        </div>
        {footer}
      </div>
    </div>
  );
}

export interface CaseLike {
  slug: string;
  name: string;
  image: string;
  price: number;
  category?: string;
  items?: { weight: number; item: ItemLike }[];
}

export function CaseCard({ c }: { c: CaseLike }) {
  const t = useT();
  const best = c.items?.length
    ? c.items.reduce((a, x) => (x.item.value > a.item.value ? x : a), c.items[0]!).item
    : null;
  return (
    <Link href={`/cases/${c.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card card-hover case-card" style={{ overflow: 'hidden', height: '100%', position: 'relative' }}>
        <div style={{ padding: '18px 16px 8px', textAlign: 'center', position: 'relative' }}>
          {best && <RarityBadge rarity={best.rarity} />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="case-img" src={c.image} alt={c.name} loading="lazy" style={{ width: '100%', maxWidth: 150, aspectRatio: '1/1', objectFit: 'contain' }} />
        </div>
        <div style={{ padding: '4px 14px 14px', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
          {c.items && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{c.items.length} {t.cases.toLowerCase() === 'кейсы' ? 'предметов' : 'items'}</div>}
          <div
            className="btn btn-primary"
            style={{ marginTop: 10, width: '100%', padding: '8px 0', fontSize: 13, pointerEvents: 'none' }}
          >
            <CoinSm /> {c.price.toLocaleString('ru')} AP
          </div>
        </div>
      </div>
    </Link>
  );
}

function CoinSm() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/coin.png" alt="" width={16} height={9} style={{ objectFit: 'contain' }} />
  );
}

export interface DropRow {
  id: string;
  user: { username: string; isBot: boolean };
  item: ItemLike;
  case?: { slug: string; name: string };
  createdAt: string;
}

export function LiveDrops({ rows }: { rows: DropRow[] }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {rows.map((d) => {
        const c = RARITY_COLOR[d.item.rarity] ?? '#888';
        return (
          <div key={d.id} className="card pop-in" style={{ minWidth: 108, width: 108, textAlign: 'center', padding: 8, borderColor: c, flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.item.image} alt="" style={{ width: 64, height: 48, objectFit: 'contain' }} />
            <div style={{ fontSize: 10.5, color: c, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {d.user.username}{d.user.isBot ? ' 🤖' : ''}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.item.name}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 34, height: 34, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? 'var(--text)', marginTop: 2 }}>{value}</div>
    </div>
  );
}
