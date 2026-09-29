'use client';

/**
 * Daily rewards (spec §9): a lo-fi calendar wall — every day is a small
 * taped object on the wall; claimable day glows calmly, claimed days get
 * a check mark. Same API contract as before (/daily + /daily/claim).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { post } from '../../lib/api';
import { usePoll } from '../../lib/hooks';
import { Spinner } from '../../components/game';
import { Magnetic } from '../../components/effects';
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

const DAY_OBJECT = (type: string, day: number) =>
  type === 'POINTS' ? '🪙' : day === 7 ? '💎' : day >= 5 ? '📼' : '🎁';

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
      toast(res.reward.type === 'POINTS' ? `+${res.amount} AP` : lang === 'ru' ? 'Предмет дня' : 'Item of the day', 'ok');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t.error, 'err');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">LO-FI CALENDAR WALL</div>
          <h1 className="h-display" style={{ fontSize: 'clamp(26px, 4vw, 38px)', margin: '4px 0 0' }}>{t.daily}</h1>
        </div>
        <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          {t.streak}: <b style={{ color: 'var(--warning)' }}>{data.streak} ›</b>
        </span>
      </header>

      {!me ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>
          {t.authNeeded} ·{' '}
          <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={() => router.push('/login')}>
            {t.login}
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: '26px 20px', textAlign: 'center' }}>
          {data.canClaim ? (
            <Magnetic>
              <button className="btn btn-primary" style={{ padding: '15px 44px', fontSize: 15.5 }} disabled={busy} onClick={claim}>
                {busy ? '…' : `▸ ${t.claim} · ${
                  data.nextReward.type === 'POINTS'
                    ? `${data.nextReward.amount} AP`
                    : `${lang === 'ru' ? 'предмет' : 'item'} (${data.nextReward.rarityPool})`
                }`}
              </button>
            </Magnetic>
          ) : (
            <div style={{ color: 'var(--text-dim)', padding: 12, fontSize: 14 }}>{t.comeTomorrow} 🌙</div>
          )}
        </div>
      )}

      <div className="cal-wall">
        {data.table.map((r, i) => {
          const done = r.day < data.nextCycleDay || (!data.canClaim && r.day === data.nextCycleDay);
          const today = r.day === data.nextCycleDay && data.canClaim;
          return (
            <div
              key={r.day}
              className={`cal-tile rise-in ${done ? 'done' : ''} ${today ? 'today' : ''}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.16em' }}>
                DAY {String(r.day).padStart(2, '0')}
              </div>
              <div style={{ fontSize: 24, margin: '8px 0 6px' }}>{DAY_OBJECT(r.type, r.day)}</div>
              <div style={{ fontWeight: 700, fontSize: 12.5 }}>
                {r.type === 'POINTS' ? `${r.amount} AP` : r.rarityPool}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
