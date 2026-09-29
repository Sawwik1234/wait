'use client';

import { useParams } from 'next/navigation';
import { usePoll } from '../../../lib/hooks';
import { ItemCard, Spinner, StatCard } from '../../../components/game';
import { Avatar } from '../../../components/shell';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section className="card" style={{ padding: 24, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <Avatar name={p.username} size={72} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>
            {p.username} {p.isBot && <span className="chip" style={{ fontSize: 10 }}>{t.bot}</span>}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ flex: 1, maxWidth: 300, height: 8, background: '#0e1219', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(p.level.progress * 100)}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {t.level} {p.level.level} · {p.xp} XP
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
            {t.memberSince} {new Date(p.createdAt).toLocaleDateString(lang === 'ru' ? 'ru' : 'en')}
          </div>
        </div>
        {p.bestItem && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{t.bestItem}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.bestItem.image} alt="" style={{ width: 90, height: 64, objectFit: 'contain' }} />
            <div style={{ fontSize: 12, fontWeight: 700 }}>{p.bestItem.name}</div>
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <StatCard label={t.collection} value={p.stats.collectionCount} />
        <StatCard label={t.collection} value={`${p.stats.collectionValue.toLocaleString('ru')} AP`} accent="var(--accent)" />
        <StatCard label={t.opens} value={p.stats.opens} />
        <StatCard label={t.wins} value={p.stats.upgradeWins} accent="var(--success)" />
      </section>

      <section>
        <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>🏆 {lang === 'ru' ? 'Ачивки' : 'Achievements'}</h2>
        {p.achievements.length === 0 ? (
          <div className="card" style={{ padding: 18, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
            {lang === 'ru' ? 'Пока нет ачивок — открывай кейсы и апгрейди!' : 'No achievements yet — open cases and upgrade!'}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {p.achievements.map((a) => (
              <div key={a.code} className="card" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, borderColor: 'var(--warning)' }}>
                <span style={{ fontSize: 18 }}>{a.icon}</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{a.title}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>{t.recentPulls}</h2>
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
