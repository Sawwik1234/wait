'use client';

/**
 * Notifications (spec §14): minimal two-pane layout — filter rail on the
 * left (ALL / SYSTEM / REWARDS / ACTIVITY, built from real types), cards
 * on the right. Unread cards keep the accent edge.
 */

import { useMemo, useState } from 'react';
import { usePoll } from '../../lib/hooks';
import { Spinner } from '../../components/game';
import { useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

interface N {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, { ru: string; en: string }> = {
  SYSTEM: { ru: 'Системные', en: 'System' },
  REWARD: { ru: 'Награды', en: 'Rewards' },
  ACTIVITY: { ru: 'Активность', en: 'Activity' },
};

export default function NotificationsPage() {
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const { data, reload } = usePoll<N[]>('/notifications', 10000);
  const [filter, setFilter] = useState<string>('ALL');

  const types = useMemo(() => Array.from(new Set((data ?? []).map((n) => n.type))), [data]);
  const list = (data ?? []).filter((n) => filter === 'ALL' || n.type === filter);

  const readAll = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
    reload();
  };

  if (!data) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">INBOX</div>
          <h1 className="h-display" style={{ fontSize: 'clamp(24px, 3.4vw, 32px)', margin: '4px 0 0' }}>🔔 {t.notifications}</h1>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }} onClick={readAll}>
          {lang === 'ru' ? 'Прочитать всё' : 'Read all'}
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: 16, alignItems: 'start' }} className="notif-grid">
        <aside className="card" style={{ padding: 8, position: 'sticky', top: 58 }}>
          {['ALL', ...types].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="chip"
              style={{
                display: 'block', width: '100%', textAlign: 'left', marginBottom: 4,
                borderColor: filter === f ? 'var(--accent)' : 'transparent',
                color: filter === f ? 'var(--accent)' : 'var(--text-dim)',
              }}
            >
              {f === 'ALL' ? (lang === 'ru' ? 'Все' : 'All') : TYPE_LABEL[f]?.[lang] ?? f}
            </button>
          ))}
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>{t.empty}</div>
          ) : (
            list.map((n, i) => (
              <div
                key={n.id}
                className="card reveal"
                style={{
                  animationDelay: `${i * 40}ms`,
                  padding: '13px 16px',
                  borderColor: n.readAt ? 'var(--border)' : 'var(--accent)',
                  opacity: n.readAt ? 0.72 : 1,
                  borderLeftWidth: n.readAt ? 1 : 3,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{n.title}</div>
                  <span className="chip" style={{ fontSize: 9, padding: '1px 8px', marginLeft: 'auto' }}>{n.type}</span>
                </div>
                {n.body && <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 3 }}>{n.body}</div>}
                <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 5 }}>{new Date(n.createdAt).toLocaleString(lang === 'ru' ? 'ru' : 'en')}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 760px) {
          .notif-grid { grid-template-columns: 1fr !important; }
          .notif-grid aside { position: static !important; display: flex; flex-wrap: wrap; gap: 4px; }
          .notif-grid aside .chip { width: auto !important; margin-bottom: 0 !important; }
        }
      `}</style>
    </div>
  );
}
