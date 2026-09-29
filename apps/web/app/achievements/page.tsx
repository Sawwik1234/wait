'use client';

/**
 * Achievements (spec §13): a virtual trophy wall — every tile is a ◈
 * plaque; earned ones glow, the rest stay dimmed. Data: /achievements.
 */

import { useRouter } from 'next/navigation';
import { usePoll } from '../../lib/hooks';
import { Spinner } from '../../components/game';
import { useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

interface Ach {
  code: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  threshold: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export default function AchievementsPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const authReady = useStore((s) => s.authReady);
  const { data } = usePoll<{ all: Ach[] }>(me ? '/achievements' : null, 0);

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

  const all = data.all;
  const earned = all.filter((a) => a.unlocked).length;
  const pct = all.length ? Math.round((earned / all.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">TROPHY WALL</div>
          <h1 className="h-display" style={{ fontSize: 'clamp(26px, 4vw, 38px)', margin: '4px 0 0' }}>🏆 {t.achievementsPage}</h1>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ minWidth: 180 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 5 }}>
            {earned}/{all.length} · {pct}%
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,.07)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
          </div>
        </div>
      </header>

      <div className="ach-wall">
        {all.map((a, i) => (
          <div key={a.code} className={`ach-tile rise-in ${a.unlocked ? 'earned' : ''}`} style={{ animationDelay: `${i * 50}ms` }}>
            <div className="gem" style={{ fontSize: 28 }}>{a.unlocked ? a.icon : '◈'}</div>
            <div style={{ fontWeight: 800, fontSize: 13, marginTop: 8 }}>{a.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4 }}>{a.description}</div>
            <div className="ach-bar">
              <i style={{ width: a.unlocked ? '100%' : '0%' }} />
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 6, letterSpacing: '.1em' }}>
              {a.unlocked ? `✓ ${a.unlockedAt?.slice(0, 10) ?? ''}` : `+${a.xpReward} XP`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
