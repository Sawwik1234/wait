'use client';

/**
 * Profile showcase (spec §12): banner hero with independent parallax for
 * background and avatar, level progress, stat cards, trophy chips and
 * recent pulls. Data: public profile endpoint only.
 */

import { useParams } from 'next/navigation';
import { usePoll } from '../../../lib/hooks';
import { ItemCard, Spinner, StatCard } from '../../../components/game';
import { Avatar } from '../../../components/shell';
import { Parallax } from '../../../components/effects';
import { useStore } from '../../../lib/store';
import { DICT } from '../../../lib/i18n';

interface Profile {
  username: string;
  isBot: boolean;
  xp: number;
  createdAt: string;
  level: { level: number; progress: number };
  stats: { collectionCount: number; collectionValue: number; opens: number; upgradeWins: number };
  achievements: { code: string; title: string; icon: string }[];
  recent: { id: string; item: { slug: string; name: string; image: string; rarity: string; value: number } }[];
  bestItem: { slug: string; name: string; image: string; rarity: string; value: number } | null;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const { data: p } = usePoll<Profile>(`/users/${username}`, 10000);

  if (!p) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* ===== banner hero ===== */}
      <section className="pf-banner rise-in" style={{ padding: '54px 26px 22px' }}>
        <div className="grid-bg" aria-hidden />
        <Parallax>
          <div
            aria-hidden
            style={{
              position: 'absolute', top: -60, right: -40, width: 380, height: 380, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(34,211,238,.14), transparent 62%)', filter: 'blur(8px)',
            }}
          />
        </Parallax>
        <div style={{ position: 'relative', display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="floaty" style={{ marginBottom: -6 }}>
            <Avatar name={p.username} size={92} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="eyebrow">{t.level} {p.level.level} · {p.xp} XP{p.isBot ? ` · ${t.bot}` : ''}</div>
            <h1 className="h-display" style={{ fontSize: 'clamp(24px, 4vw, 38px)', margin: '4px 0 10px' }}>{p.username}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 380 }}>
              <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,.07)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(p.level.progress * 100)}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{Math.round(p.level.progress * 100)}%</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
              {t.memberSince} {new Date(p.createdAt).toLocaleDateString(lang === 'ru' ? 'ru' : 'en')}
            </div>
          </div>
          {p.bestItem && (
            <div style={{ textAlign: 'center' }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>{t.bestItem}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.bestItem.image} alt="" className="floaty" style={{ width: 100, height: 72, objectFit: 'contain', filter: 'drop-shadow(0 14px 30px rgba(0,0,0,.5))' }} />
              <div style={{ fontSize: 12, fontWeight: 700 }}>{p.bestItem.name}</div>
            </div>
          )}
        </div>
      </section>

      {/* ===== stats ===== */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <StatCard label={t.casesOpened} value={p.stats.opens} />
        <StatCard label={t.itemsCollected} value={p.stats.collectionCount} />
        <StatCard label={t.collectionValue} value={`${p.stats.collectionValue.toLocaleString('ru')} AP`} accent="var(--accent)" />
        <StatCard label={t.upgradesWon} value={p.stats.upgradeWins} accent="var(--success)" />
      </section>

      {/* ===== trophies ===== */}
      <section>
        <h2 className="h-display" style={{ fontSize: 18, marginBottom: 12 }}>🏆 {t.achievementsPage}</h2>
        {p.achievements.length === 0 ? (
          <div className="card" style={{ padding: 18, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
            {lang === 'ru' ? 'Пока нет ачивок — открывай кейсы и апгрейди!' : 'No achievements yet — open cases and upgrade!'}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {p.achievements.map((a) => (
              <div key={a.code} className="card" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, borderColor: 'var(--warning)' }}>
                <span style={{ fontSize: 18 }}>{a.icon}</span>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{a.title}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== recent pulls ===== */}
      <section>
        <h2 className="h-display" style={{ fontSize: 18, marginBottom: 12 }}>{t.recentPulls}</h2>
        {p.recent.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)' }}>{t.empty}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {p.recent.map((r) => (
              <ItemCard key={r.id} item={r.item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
