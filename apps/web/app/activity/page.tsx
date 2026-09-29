'use client';

/**
 * Activity (spec §21): vertical personal timeline — recent case pulls,
 * upgrades and notifications merged into one chronological feed.
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePoll } from '../../lib/hooks';
import { Spinner } from '../../components/game';
import { RARITY_COLOR, useStore } from '../../lib/store';
import { DICT } from '../../lib/i18n';

interface Recent {
  id: string;
  createdAt: string;
  item: { name: string; image: string; rarity: string; value: number };
  case?: { name: string };
}
interface UpRecent {
  id?: string;
  createdAt?: string;
  success?: boolean;
  target?: { name: string; value: number };
}
interface Notif {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}
interface Entry {
  key: string;
  at: number;
  time: string;
  icon: string;
  color: string;
  text: string;
}

export default function ActivityPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const authReady = useStore((s) => s.authReady);

  const { data: pf } = usePoll<{ recent: Recent[] }>(me ? `/users/${me.username}` : null, 0);
  const { data: ups } = usePoll<UpRecent[]>(me ? '/upgrade/recent' : null, 0);
  const { data: notifs } = usePoll<Notif[]>(me ? '/notifications' : null, 0);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const r of pf?.recent ?? []) {
      const c = RARITY_COLOR[r.item.rarity] ?? 'var(--accent)';
      out.push({
        key: `d-${r.id}`,
        at: Date.parse(r.createdAt),
        time: r.createdAt,
        icon: '📦',
        color: c,
        text: lang === 'ru'
          ? `${r.item.name} из «${r.case?.name ?? '—'}» · ${r.item.value} AP`
          : `${r.item.name} from "${r.case?.name ?? '—'}" · ${r.item.value} AP`,
      });
    }
    for (const u of ups ?? []) {
      if (!u.createdAt || !u.target) continue;
      out.push({
        key: `u-${u.createdAt}-${u.target.name}`,
        at: Date.parse(u.createdAt),
        time: u.createdAt,
        icon: u.success ? '⚡' : '✖',
        color: u.success ? 'var(--success)' : 'var(--danger)',
        text: u.success
          ? lang === 'ru' ? `Апгрейд удался: ${u.target.name} · ${u.target.value} AP` : `Upgrade won: ${u.target.name} · ${u.target.value} AP`
          : lang === 'ru' ? `Апгрейд не прошёл (цель: ${u.target.name})` : `Upgrade failed (target: ${u.target.name})`,
      });
    }
    for (const n of notifs ?? []) {
      out.push({
        key: `n-${n.id}`,
        at: Date.parse(n.createdAt),
        time: n.createdAt,
        icon: n.type === 'REWARD' ? '🎁' : '🔔',
        color: 'var(--accent)',
        text: n.title,
      });
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 40);
  }, [pf, ups, notifs, lang]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <div className="eyebrow">TIMELINE</div>
        <h1 className="h-display" style={{ fontSize: 'clamp(26px, 4vw, 38px)', margin: '4px 0 0' }}>🕐 {t.activity}</h1>
      </header>

      {entries.length === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>{t.empty}</div>
      ) : (
        <div className="tl">
          {entries.map((e, i) => (
            <div key={e.key} className="tl-item card reveal" style={{ animationDelay: `${i * 35}ms`, padding: '11px 14px', display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, width: 86 }}>
                {new Date(e.time).toLocaleTimeString(lang === 'ru' ? 'ru' : 'en', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ fontSize: 15 }}>{e.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: e.color }}>{e.text}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>{e.time.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
