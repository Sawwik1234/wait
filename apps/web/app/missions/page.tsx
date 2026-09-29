'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { post } from '../../lib/api';
import { usePoll } from '../../lib/hooks';
import { Spinner } from '../../components/game';
import { useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

interface MissionRow {
  id: string;
  code: string;
  title: string;
  description: string;
  target: number;
  rewardAp: number;
  rewardItemRarity: string | null;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export default function MissionsPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const setBalance = useStore((s) => s.setBalance);
  const toast = useStore((s) => s.toast);
  const { data, reload } = usePoll<MissionRow[]>('/missions', 0);
  const [busy, setBusy] = useState<string | null>(null);

  const claim = async (id: string) => {
    setBusy(id);
    try {
      const res = await post<{ rewardAp: number; itemId: string | null }>(`/missions/${id}/claim`, {});
      const meRes = await fetch('/api/users/me', { credentials: 'include' }).then((r) => r.json());
      if (meRes?.data?.balance) setBalance(meRes.data.balance.amount);
      toast(res.itemId ? `🎉 +предмет и ${res.rewardAp} AP` : `🎉 +${res.rewardAp} AP`, 'ok');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t.error, 'err');
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>🎯 {t.missions}</h1>

      {!me ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>
          {t.authNeeded} · <a href="/api/auth/steam" style={{ color: 'var(--accent)' }}>{t.login}</a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {data.map((m) => {
            const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
            const canClaim = m.completed && !m.claimed;
            return (
              <div
                key={m.id}
                className="card card-hover"
                style={{
                  padding: 16,
                  borderColor: canClaim ? 'var(--success)' : 'var(--border)',
                  boxShadow: canClaim ? '0 0 20px -8px var(--success)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <b style={{ fontSize: 14.5 }}>{m.title}</b>
                  <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>
                    +{m.rewardAp} AP{m.rewardItemRarity ? ' 🎁' : ''}
                  </span>
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: 12.5, marginTop: 4, minHeight: 32 }}>{m.description}</div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ height: 7, background: '#0e1219', borderRadius: 99, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        borderRadius: 99,
                        background: m.claimed ? 'var(--text-dim)' : 'linear-gradient(90deg, var(--accent), var(--success))',
                        transition: 'width .4s ease',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                    <span>{m.progress} / {m.target}</span>
                    {m.claimed ? (
                      <span style={{ color: 'var(--text-dim)' }}>✓ {t.claimed}</span>
                    ) : canClaim ? (
                      <button className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 11.5 }} disabled={busy === m.id} onClick={() => claim(m.id)}>
                        {t.claim}
                      </button>
                    ) : (
                      <span>{pct}%</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
