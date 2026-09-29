'use client';

/**
 * Support (spec §15): control-terminal interface. Hero "NEED HELP?",
 * category tiles ACCOUNT / COLLECTION / CASES / TECHNICAL / MODERATION
 * (no payments — the platform has no money), glass chat for tickets.
 */

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

const CATS = [
  { id: 'ACCOUNT', icon: '👤' },
  { id: 'COLLECTION', icon: '🗂' },
  { id: 'CASES', icon: '📦' },
  { id: 'TECHNICAL', icon: '🛠' },
  { id: 'MODERATION', icon: '🛡' },
] as const;
const CAT_KEY: Record<string, 'catAccount' | 'catCollection' | 'catCases' | 'catTechnical' | 'catModeration'> = {
  ACCOUNT: 'catAccount',
  COLLECTION: 'catCollection',
  CASES: 'catCases',
  TECHNICAL: 'catTechnical',
  MODERATION: 'catModeration',
};

export default function SupportPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const toast = useStore((s) => s.toast);

  const { data, reload } = usePoll<Ticket[]>('/support/tickets', 8000);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<string>('ACCOUNT');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* terminal header */}
      <div className="card term" style={{ overflow: 'hidden' }}>
        <div className="term-head"><i /><i /><i /></div>
        <div style={{ padding: '26px 22px', textAlign: 'center' }}>
          <div className="eyebrow">SUPPORT TERMINAL</div>
          <h1 className="h-display" style={{ fontSize: 'clamp(28px, 5vw, 44px)', margin: '6px 0 10px' }}>{t.needHelp}</h1>
          <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
            {lang === 'ru'
              ? 'Ответим в тикете — уведомление придёт в раздел «Уведомления».'
              : 'We reply in the ticket — you will get a notification.'}
          </div>
        </div>
      </div>

      {/* category tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {CATS.map((c) => (
          <div
            key={c.id}
            className="term-cat"
            style={{ borderColor: category === c.id && creating ? 'var(--accent)' : undefined }}
            onClick={() => {
              setCategory(c.id);
              setCreating(true);
            }}
          >
            <div style={{ fontSize: 20 }}>{c.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 12.5, marginTop: 4, letterSpacing: '.08em' }}>{t[CAT_KEY[c.id]]}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{c.id}</div>
          </div>
        ))}
      </div>

      {creating && (
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{t.newTicket} · {t[CAT_KEY[category]]}</div>
          <input className="input" placeholder={t.ticketSubject} value={subject} onChange={(e) => setSubject(e.target.value)} />
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
                  toast('✓', 'ok');
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
            <span className="chip" style={{ fontSize: 10 }}>{open.category}</span>
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
              <div key={m.id} className={`chat-b ${m.isStaff ? 'chat-op' : 'chat-me'}`}>
                {m.text}
                <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 4 }}>
                  {new Date(m.createdAt).toLocaleString(lang === 'ru' ? 'ru' : 'en')}
                </div>
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
