'use client';

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

export default function NotificationsPage() {
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const { data, reload } = usePoll<N[]>('/notifications', 10000);

  const readAll = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
    reload();
  };

  if (!data) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>🔔</h1>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }} onClick={readAll}>
          {lang === 'ru' ? 'Прочитать всё' : 'Read all'}
        </button>
      </div>
      {data.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>{t.empty}</div>
      ) : (
        data.map((n) => (
          <div
            key={n.id}
            className="card"
            style={{ padding: '13px 16px', borderColor: n.readAt ? 'var(--border)' : 'var(--accent)', opacity: n.readAt ? 0.75 : 1 }}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>{n.title}</div>
            {n.body && <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 3 }}>{n.body}</div>}
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 5 }}>{new Date(n.createdAt).toLocaleString(lang === 'ru' ? 'ru' : 'en')}</div>
          </div>
        ))
      )}
    </div>
  );
}
