'use client';

/**
 * Item showcase (spec §6): big item presentation with 3D tilt + rarity
 * glow, metadata (rarity / collection / value / obtained), favorite and
 * sell actions. All data comes from the user's inventory (server truth).
 */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { patch, postIdem } from '../../../lib/api';
import { usePoll } from '../../../lib/hooks';
import { RarityBadge, Spinner } from '../../../components/game';
import { Tilt } from '../../../components/effects';
import { RARITY_COLOR, useStore } from '../../../lib/store';
import { DICT } from '../../../lib/i18n';

interface InvRow {
  id: string;
  sourceType: string;
  isFavorite: boolean;
  createdAt: string;
  item: { id: string; slug: string; name: string; image: string; rarity: string; value: number };
}

const SOURCE_LABEL: Record<string, { ru: string; en: string }> = {
  CASE_OPEN: { ru: 'Открытие кейса', en: 'Case opening' },
  BATTLE: { ru: 'Бой', en: 'Battle' },
  CONTRACT: { ru: 'Контракт', en: 'Contract' },
  UPGRADE: { ru: 'Апгрейд', en: 'Upgrade' },
  MISSION: { ru: 'Миссия', en: 'Mission' },
  ACHIEVEMENT: { ru: 'Достижение', en: 'Achievement' },
  WELCOME_BONUS: { ru: 'Приветственный бонус', en: 'Welcome bonus' },
  ADMIN: { ru: 'Администратор', en: 'Administrator' },
};

export default function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const setBalance = useStore((s) => s.setBalance);
  const toast = useStore((s) => s.toast);
  const { data, reload } = usePoll<{ items: InvRow[] }>('/inventory', 0);

  const row = data?.items.find((x) => x.id === id);

  if (!data && !useStore.getState().authReady) return <Spinner />;

  if (!row) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
        {t.itemNotFound}
        <div style={{ marginTop: 14 }}>
          <Link href="/inventory" className="btn btn-ghost" style={{ padding: '9px 18px', textDecoration: 'none' }}>← {t.toInventory}</Link>
        </div>
      </div>
    );
  }

  const c = RARITY_COLOR[row.item.rarity] ?? 'var(--border)';
  const sellPrice = Math.floor(row.item.value * 0.3);
  const day = row.createdAt.slice(0, 10); // ISO date — deterministic on server & client
  const src = SOURCE_LABEL[row.sourceType];
  const source = src ? src[lang] : row.sourceType;

  const doSell = async () => {
    if (!window.confirm(`${t.sellFor} ${sellPrice} AP?`)) return;
    try {
      const res = await postIdem<{ soldCount: number; gained: number; balance: number }>('/inventory/sell', { ids: [row.id] });
      setBalance(res.balance);
      toast(`${t.sold}: ${res.soldCount} · ${t.gained}: ${res.gained} AP`, 'ok');
      router.push('/inventory');
    } catch (e) {
      toast(e instanceof Error ? e.message : t.error, 'err');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Link href="/inventory" style={{ color: 'var(--text-dim)', fontSize: 13, textDecoration: 'none' }}>← {t.toInventory}</Link>

      {/* ===== showcase ===== */}
      <section
        className="card rise-in"
        style={{
          display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(0, 1fr)', gap: 30,
          padding: 32, alignItems: 'center', position: 'relative', overflow: 'hidden',
          background: `radial-gradient(560px 280px at 20% 10%, ${c}16, transparent 65%), var(--surface)`,
        }}
      >
        <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{ position: 'absolute', inset: '8%', borderRadius: 99, background: `radial-gradient(circle, ${c}22, transparent 62%)`, filter: 'blur(10px)' }} />
          <Tilt max={11}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.item.image}
              alt={row.item.name}
              className="floaty"
              style={{ width: '100%', maxWidth: 330, aspectRatio: '1/1', objectFit: 'contain', filter: `drop-shadow(0 26px 50px ${c}33)` }}
            />
          </Tilt>
        </div>

        <div style={{ position: 'relative' }}>
          <RarityBadge rarity={row.item.rarity} />
          <h1 className="h-display" style={{ fontSize: 'clamp(22px, 3vw, 34px)', margin: '10px 0 14px' }}>{row.item.name}</h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
            <Row label="RARITY" value={row.item.rarity} color={c} />
            <Row label={t.collection.toUpperCase()} value={row.item.slug} />
            <Row label="VALUE" value={`${row.item.value.toLocaleString('ru')} AP`} color="var(--accent)" />
            <Row label={t.sellFor.toUpperCase()} value={`${sellPrice.toLocaleString('ru')} AP`} color="var(--text-dim)" />
            <Row label={t.obtained.toUpperCase()} value={day} />
            <Row label={t.sourceLabel.toUpperCase()} value={source} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
            <button
              className="btn btn-ghost"
              style={{ padding: '12px 24px', fontSize: 14, color: row.isFavorite ? 'var(--warning)' : undefined }}
              onClick={async () => {
                await patch(`/inventory/${row.id}/favorite`, { isFavorite: !row.isFavorite }).catch(() => {});
                reload();
              }}
            >
              {row.isFavorite ? '★' : '☆'} {t.favorites}
            </button>
            <button className="btn btn-danger" style={{ padding: '12px 24px', fontSize: 14 }} onClick={doSell}>
              {t.sell} · +{sellPrice} AP
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)', opacity: 0.75, marginTop: 12 }}>ℹ {t.sellHint}</div>
        </div>
      </section>

      {/* ===== history ===== */}
      <div>
        <h2 className="h-display" style={{ fontSize: 18, marginBottom: 10 }}>HISTORY</h2>
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: c, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{day}</span>
            <span><b>{source}</b> → <b>{row.item.name}</b></span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', opacity: 0.7 }}>{t.economyNote}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-soft)', paddingBottom: 7 }}>
      <span style={{ width: 150, fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--text-dim)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 700, color: color ?? 'var(--text)', fontSize: 13.5 }}>{value}</span>
    </div>
  );
}
