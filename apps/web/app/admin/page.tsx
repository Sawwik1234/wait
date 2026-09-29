'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { patch } from '../../lib/api';
import { usePoll } from '../../lib/hooks';
import { Spinner, StatCard } from '../../components/game';
import { useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

type Tab = 'dashboard' | 'users' | 'cases' | 'tickets' | 'audit';

interface AdminStats {
  users: number;
  bots: number;
  opensToday: number;
  ownedItems: number;
  upgrades: number;
  contracts: number;
  profitByDay: { date: string; burned: number; granted: number; net: number }[];
  totalsByType: { type: string; sum: number }[];
}
interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  isBot: boolean;
  xp: number;
  balance: { amount: number } | null;
}
interface AdminCase {
  id: string;
  slug: string;
  name: string;
  price: number;
  rtp: number;
  isActive: boolean;
  ev: number;
  actualRtp: number;
  items: { id: string; weight: number; item: { name: string; value: number; rarity: string } }[];
}
interface AdminTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  user: { username: string; email: string };
  messages: { id: string; isStaff: boolean; text: string }[];
}
interface AuditRow {
  id: string;
  actorId: string | null;
  action: string;
  entity: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const toast = useStore((s) => s.toast);
  const [tab, setTab] = useState<Tab>('dashboard');

  const isStaff = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';

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
  if (!isStaff) {
    return <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--danger)' }}>403 — {lang === 'ru' ? 'недостаточно прав' : 'insufficient role'}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>🛠 {t.admin}</h1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([
          ['dashboard', t.dashboard],
          ['users', t.users],
          ['cases', t.cases],
          ['tickets', t.tickets],
          ['audit', t.auditLog],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} className={`chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <Dashboard />}
      {tab === 'users' && <Users onToast={toast} />}
      {tab === 'cases' && <Cases onToast={toast} />}
      {tab === 'tickets' && <Tickets onToast={toast} />}
      {tab === 'audit' && <Audit />}
    </div>
  );
}

function Dashboard() {
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const { data } = usePoll<AdminStats>('/admin/stats', 10000);
  if (!data) return <Spinner />;

  const max = Math.max(1, ...data.profitByDay.map((d) => Math.max(d.burned, d.granted)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <StatCard label={t.users} value={data.users} />
        <StatCard label="BOTS" value={data.bots} />
        <StatCard label={`${t.opens} · ${t.today}`} value={data.opensToday} accent="var(--accent)" />
        <StatCard label={lang === 'ru' ? 'Предметов у игроков' : 'Owned items'} value={data.ownedItems} />
        <StatCard label={t.upgrade} value={data.upgrades} />
        <StatCard label={t.contracts} value={data.contracts} />
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>
          {t.houseProfit} · {data.profitByDay.reduce((a, d) => a + d.net, 0).toLocaleString('ru')} AP
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
          {data.profitByDay.map((d) => (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2, height: '100%' }} title={`${d.date}: burned ${d.burned}, granted ${d.granted}, net ${d.net}`}>
              <div style={{ height: `${(d.granted / max) * 100}%`, background: 'var(--danger)', opacity: 0.7, borderRadius: 3 }} />
              <div style={{ height: `${(d.burned / max) * 100}%`, background: 'var(--accent)', borderRadius: 3 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
          <span><span style={{ color: 'var(--accent)' }}>▬</span> {t.burned}</span>
          <span><span style={{ color: 'var(--danger)' }}>▬</span> {t.granted}</span>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>{lang === 'ru' ? 'Итоги по типам операций' : 'Ledger totals by type'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 13 }}>
          {data.totalsByType.map((x) => (
            <div key={x.type} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 10px', background: 'var(--surface-hover)', borderRadius: 8 }}>
              <span style={{ color: 'var(--text-dim)' }}>{x.type}</span>
              <b style={{ color: x.sum >= 0 ? 'var(--success)' : 'var(--danger)' }}>{x.sum.toLocaleString('ru')} AP</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Users({ onToast }: { onToast: (s: string, k?: 'ok' | 'err' | 'info') => void }) {
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const [q, setQ] = useState('');
  const { data, reload } = usePoll<{ rows: AdminUser[]; total: number; pages: number }>(`/admin/users?q=${encodeURIComponent(q)}&page=1`, 0);

  const adjust = async (id: string, amount: number) => {
    try {
      await patch(`/admin/users/${id}`, { adjust: amount });
      onToast(`✅ ${amount > 0 ? '+' : ''}${amount} AP`, 'ok');
      reload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.error, 'err');
    }
  };
  const setRole = async (id: string, role: string) => {
    try {
      await patch(`/admin/users/${id}`, { role });
      onToast(`✅ ${role}`, 'ok');
      reload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.error, 'err');
    }
  };

  if (!data) return <Spinner />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input className="input" style={{ maxWidth: 260 }} placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} />
      {data.rows.map((u) => (
        <div key={u.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <b style={{ minWidth: 130 }}>{u.username} {u.isBot && <span className="chip" style={{ fontSize: 9 }}>{t.bot}</span>}</b>
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{u.email}</span>
          <select className="input" style={{ width: 130 }} value={u.role} onChange={(e) => setRole(u.id, e.target.value)}>
            {['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <div style={{ flex: 1 }} />
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{u.balance?.amount.toLocaleString('ru') ?? 0} AP</span>
          <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => adjust(u.id, 1000)}>+1000</button>
          <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => adjust(u.id, -1000)}>−1000</button>
        </div>
      ))}
    </div>
  );
}

function Cases({ onToast }: { onToast: (s: string, k?: 'ok' | 'err' | 'info') => void }) {
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const { data, reload } = usePoll<AdminCase[]>('/admin/cases', 0);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!data) return <Spinner />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((c) => (
        <div key={c.id} className="card" style={{ padding: '13px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <b>{c.name}</b>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{c.price} AP</span>
            <span style={{ fontSize: 12, color: 'var(--warning)' }}>RTP: {(c.actualRtp * 100).toFixed(1)}% (target {(c.rtp * 100).toFixed(0)}%)</span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>EV {Math.round(c.ev)}</span>
            <div style={{ flex: 1 }} />
            <button
              className={`btn ${c.isActive ? 'btn-danger' : 'btn-primary'}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={async () => {
                await patch(`/admin/cases/${c.id}`, { isActive: !c.isActive });
                reload();
                onToast('✅', 'ok');
              }}
            >
              {c.isActive ? (lang === 'ru' ? 'Выключить' : 'Disable') : lang === 'ru' ? 'Включить' : 'Enable'}
            </button>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setOpenId(openId === c.id ? null : c.id)}>
              ⚖ {lang === 'ru' ? 'Веса' : 'Weights'}
            </button>
          </div>
          {openId === c.id && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {c.items.map((ci) => (
                <div key={ci.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                  <span style={{ minWidth: 140, color: 'var(--text-dim)' }}>{ci.item.name}</span>
                  <span>{ci.item.value} AP</span>
                  <div style={{ flex: 1 }} />
                  <input
                    className="input"
                    style={{ width: 110 }}
                    defaultValue={ci.weight}
                    onBlur={async (e) => {
                      const w = Number(e.target.value);
                      if (!Number.isFinite(w) || w === ci.weight) return;
                      try {
                        await patch(`/admin/cases/${c.id}`, {});
                        await fetch(`/api/admin/cases/${c.id}/weights`, {
                          method: 'PUT',
                          credentials: 'include',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ weights: c.items.map((x) => ({ caseItemId: x.id, weight: x.id === ci.id ? w : x.weight })) }),
                        });
                        onToast(`✅ ${ci.item.name}: w=${w}`, 'ok');
                        reload();
                      } catch {
                        onToast(t.error, 'err');
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Tickets({ onToast }: { onToast: (s: string, k?: 'ok' | 'err' | 'info') => void }) {
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const { data, reload } = usePoll<AdminTicket[]>('/admin/tickets', 8000);
  const [reply, setReply] = useState<Record<string, string>>({});

  if (!data) return <Spinner />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.length === 0 && <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)' }}>{t.empty}</div>}
      {data.map((x) => (
        <div key={x.id} className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <b>{x.subject}</b>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{x.user.username}</span>
            <span className="chip" style={{ fontSize: 10 }}>{x.priority}</span>
            <span className="chip" style={{ fontSize: 10, color: x.status === 'OPEN' ? 'var(--warning)' : 'var(--text-dim)' }}>{x.status}</span>
            <div style={{ flex: 1 }} />
            <select
              className="input"
              style={{ width: 120 }}
              value={x.priority}
              onChange={async (e) => {
                await patch(`/admin/tickets/${x.id}`, { priority: e.target.value });
                reload();
              }}
            >
              {['LOW', 'NORMAL', 'HIGH'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <button
              className="btn btn-ghost"
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={async () => {
                await patch(`/admin/tickets/${x.id}`, { status: x.status === 'CLOSED' ? 'OPEN' : 'CLOSED' });
                reload();
              }}
            >
              {x.status === 'CLOSED' ? (lang === 'ru' ? 'Открыть' : 'Reopen') : t.closeTicket}
            </button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {x.messages.map((m) => (
              <div key={m.id} style={{ fontSize: 12.5, padding: '7px 11px', borderRadius: 8, background: m.isStaff ? 'rgba(52,211,153,.08)' : 'var(--surface-hover)', alignSelf: m.isStaff ? 'flex-start' : 'flex-end', maxWidth: '85%' }}>
                {m.text}
              </div>
            ))}
          </div>
          {x.status !== 'CLOSED' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input className="input" placeholder={t.reply} value={reply[x.id] ?? ''} onChange={(e) => setReply((r) => ({ ...r, [x.id]: e.target.value }))} />
              <button
                className="btn btn-primary"
                style={{ padding: '9px 16px', fontSize: 13 }}
                onClick={async () => {
                  const text = reply[x.id];
                  if (!text?.trim()) return;
                  const res = await fetch(`/api/admin/tickets/${x.id}/messages`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text }),
                  });
                  if (res.ok) {
                    setReply((r) => ({ ...r, [x.id]: '' }));
                    reload();
                    onToast('✅', 'ok');
                  }
                }}
              >
                {t.send}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Audit() {
  const { data } = usePoll<AuditRow[]>('/admin/audit?limit=100', 10000);
  if (!data) return <Spinner />;
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {data.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)' }}>—</div>}
      {data.map((r) => (
        <div key={r.id} style={{ display: 'flex', gap: 12, padding: '9px 14px', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
          <span style={{ color: 'var(--text-dim)', minWidth: 130 }}>{new Date(r.createdAt).toLocaleString('ru')}</span>
          <b style={{ minWidth: 110 }}>{r.action}</b>
          <span style={{ color: 'var(--text-dim)' }}>{r.entity ?? ''}</span>
        </div>
      ))}
    </div>
  );
}
