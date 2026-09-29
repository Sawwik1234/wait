'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { post } from '../../lib/api';
import { usePoll } from '../../lib/hooks';
import { Spinner } from '../../components/game';
import { useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

interface Msg {
  id: string;
  isStaff: boolean;
  text: string;
  createdAt: string;
}
interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  messages: Msg[];
}

export default function SupportPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const toast = useStore((s) => s.toast);

  const { data, reload } = usePoll<Ticket[]>('/support/tickets', 8000);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [text, setText] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  if (!me) {
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

  const open = data.find((x) => x.id === openId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>🎧 {t.support}</h1>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" style={{ padding: '9px 18px', fontSize: 13 }} onClick={() => setCreating(true)}>
          + {t.newTicket}
        </button>
      </div>

      {creating && (
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="input" placeholder={t.ticketSubject} value={subject} onChange={(e) => setSubject(e.target.value)} />
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="BUG">BUG</option>
            <option value="ACCOUNT">ACCOUNT</option>
            <option value="IDEA">IDEA</option>
            <option value="OTHER">OTHER</option>
          </select>
          <textarea className="input" rows={4} placeholder={t.ticketMessage} value={text} onChange={(e) => setText(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ padding: '10px 22px' }}
              onClick={async () => {
                try {
                  await post('/support/tickets', { subject, category, text });
                  setCreating(false);
                  setSubject('');
                  setText('');
                  reload();
                  toast('✅', 'ok');
                } catch (e) {
                  toast(e instanceof Error ? e.message : t.error, 'err');
                }
              }}
            >
              {t.send}
            </button>
            <button className="btn btn-ghost" style={{ padding: '10px 22px' }} onClick={() => setCreating(false)}>
              ✕
            </button>
          </div>
        </div>
      )}

      {open ? (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setOpenId(null)}>←</button>
            <b>{open.subject}</b>
            <span className="chip" style={{ fontSize: 10 }}>{open.status}</span>
            <div style={{ flex: 1 }} />
            {open.status !== 'CLOSED' && (
              <button
                className="btn btn-ghost"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={async () => {
                  await post(`/support/tickets/${open.id}/close`);
                  reload();
                  setOpenId(null);
                }}
              >
                {t.closeTicket}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {open.messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.isStaff ? 'flex-start' : 'flex-end',
                  maxWidth: '80%',
                  background: m.isStaff ? 'var(--surface-hover)' : 'rgba(34,211,238,.1)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '9px 13px',
                  fontSize: 13,
                }}
              >
                {m.text}
                <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 4 }}>{new Date(m.createdAt).toLocaleString(lang === 'ru' ? 'ru' : 'en')}</div>
              </div>
            ))}
          </div>
          {open.status !== 'CLOSED' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" placeholder={t.reply} value={reply} onChange={(e) => setReply(e.target.value)} />
              <button
                className="btn btn-primary"
                style={{ padding: '10px 18px' }}
                onClick={async () => {
                  if (!reply.trim()) return;
                  await post(`/support/tickets/${open.id}/messages`, { text: reply });
                  setReply('');
                  reload();
                }}
              >
                {t.send}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>{t.empty}</div>
          ) : (
            data.map((x) => (
              <div key={x.id} className="card card-hover" style={{ padding: '13px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => setOpenId(x.id)}>
                <b style={{ fontSize: 14 }}>{x.subject}</b>
                <span className="chip" style={{ fontSize: 10 }}>{x.category}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: x.status === 'ANSWERED' ? 'var(--success)' : x.status === 'CLOSED' ? 'var(--text-dim)' : 'var(--warning)' }}>{x.status}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{x.messages.length} 💬</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
