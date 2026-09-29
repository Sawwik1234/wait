'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { post } from '../../lib/api';
import { usePoll } from '../../lib/hooks';
import { Spinner } from '../../components/game';
import { useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

interface DailyStatus {
  canClaim: boolean;
  streak: number;
  nextCycleDay: number;
  nextReward: { day: number; type: string; amount: number; rarityPool?: string };
  table: { day: number; type: string; amount: number; rarityPool?: string }[];
}
interface ClaimRes {
  day: number;
  streak: number;
  reward: { day: number; type: string; amount: number; rarityPool?: string };
  itemId: string | null;
  amount: number;
}

export default function DailyPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const setBalance = useStore((s) => s.setBalance);
  const toast = useStore((s) => s.toast);

  const { data, reload } = usePoll<DailyStatus>('/daily', 0);
  const [busy, setBusy] = useState(false);

  const claim = async () => {
    setBusy(true);
    try {
      const res = await post<ClaimRes>('/daily/claim');
      const meRes = await fetch('/api/users/me', { credentials: 'include' }).then((r) => r.json());
      if (meRes?.data?.balance) setBalance(meRes.data.balance.amount);
      toast(res.reward.type === 'POINTS' ? `+${res.amount} AP 🎉` : `${lang === 'ru' ? 'Предмет дня' : 'Item of the day'} 🎁`, 'ok');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t.error, 'err');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>📅 {t.daily}</h1>
        <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          {t.streak}: <b style={{ color: 'var(--warning)' }}>{data.streak} 🔥</b>
        </span>
      </div>

      {!me ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>
          {t.authNeeded} · <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={() => router.push('/login')}>{t.login}</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
          {data.canClaim ? (
            <button className="btn btn-primary" style={{ padding: '14px 40px', fontSize: 16 }} disabled={busy} onClick={claim}>
              🎁 {t.claim} · {data.nextReward.type === 'POINTS' ? `${data.nextReward.amount} AP` : `${lang === 'ru' ? 'предмет' : 'item'} (${data.nextReward.rarityPool})`}
            </button>
          ) : (
            <div style={{ color: 'var(--text-dim)', padding: 12 }}>{t.comeTomorrow} 🌙</div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
        {data.table.map((r) => {
          const active = r.day === data.nextCycleDay && data.canClaim;
          return (
            <div
              key={r.day}
              className="card"
              style={{
                padding: 14,
                textAlign: 'center',
                borderColor: active ? 'var(--accent)' : 'var(--border)',
                boxShadow: active ? '0 0 18px -8px var(--accent)' : undefined,
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {t.day} {r.day}
              </div>
              <div style={{ fontSize: 22, margin: '6px 0' }}>{r.type === 'POINTS' ? '🪙' : r.day === 7 ? '💎' : '🎁'}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                {r.type === 'POINTS' ? `${r.amount} AP` : r.rarityPool}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
