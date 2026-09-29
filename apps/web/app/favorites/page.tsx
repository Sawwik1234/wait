'use client';

/**
 * Favorites (spec §18): starred items from the inventory. Empty state is
 * a small lo-fi scene with NOTHING SAVED YET; otherwise a regular grid.
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePoll } from '../../lib/hooks';
import { ItemCard, Spinner } from '../../components/game';
import { LofiRoom } from '../../components/lofi-room';
import { useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

interface InvRow {
  id: string;
  isFavorite: boolean;
  item: { id: string; slug: string; name: string; image: string; rarity: string; value: number };
}

export default function FavoritesPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const authReady = useStore((s) => s.authReady);
  const { data } = usePoll<{ items: InvRow[] }>(me ? '/inventory' : null, 0);

  const favs = useMemo(() => (data?.items ?? []).filter((x) => x.isFavorite), [data]);

  if (!me) {
    if (!authReady) return <Spinner />;
    return (
      <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>
        {t.authNeeded}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={() => router.push('/login')}>{t.login}</button>
        </div>
      </div>
    );
  }
  if (!data) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <div className="eyebrow">SAVED ITEMS</div>
        <h1 className="h-display" style={{ fontSize: 'clamp(26px, 4vw, 38px)', margin: '4px 0 0' }}>★ {t.favorites}</h1>
      </header>

      {favs.length === 0 ? (
        <div className="card fav-empty" style={{ padding: 0, overflow: 'hidden' }}>
          <LofiRoom height={220} />
          <div style={{ padding: '6px 20px 30px' }}>
            <div className="h-display" style={{ fontSize: 'clamp(20px, 3vw, 28px)' }}>{t.nothingSaved}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13, margin: '8px 0 16px' }}>
              {lang === 'ru' ? 'Отмечай предметы звёздой в коллекции — они появятся здесь.' : 'Star items in your collection and they will show up here.'}
            </div>
            <button className="btn btn-primary" style={{ padding: '11px 26px' }} onClick={() => router.push('/cases')}>
              {t.exploreCases}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {favs.map((x, i) => (
            <div key={x.id} className="reveal" style={{ animationDelay: `${i * 40}ms` }}>
              <ItemCard item={x.item} onClick={() => router.push(`/inventory/${x.id}`)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
