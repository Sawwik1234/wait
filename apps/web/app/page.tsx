'use client';

import Link from 'next/link';
import { usePoll } from '../lib/hooks';
import { CaseCard, LiveDrops, StatCard, type CaseLike, type DropRow } from '../components/game';
import { useStore } from '../lib/store';
import { DICT } from '../lib/i18n';

export default function HomePage() {
  const lang = useStore((s) => s.lang);
  const me = useStore((s) => s.me);
  const t = DICT[lang];
  const { data: cases } = usePoll<CaseLike[]>('/cases', 0);
  const { data: drops } = usePoll<DropRow[]>('/drops?limit=18', 7000);
  const { data: stats } = usePoll<{ users: number; opens: number; drops: number }>('/stats/overview', 15000);

  const top = (cases ?? []).slice().sort((a, b) => b.price - a.price).slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* hero */}
      <section
        className="card rise-in"
        style={{
          padding: '40px 32px',
          background: 'radial-gradient(1200px 400px at 20% -10%, rgba(34,211,238,.14), transparent), radial-gradient(800px 300px at 90% 0%, rgba(168,85,247,.12), transparent), var(--surface)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <h1 style={{ fontSize: 'clamp(26px, 4.5vw, 42px)', fontWeight: 900, lineHeight: 1.1, margin: 0 }}>
          {lang === 'ru' ? (
            <>Открывай кейсы. <span style={{ color: 'var(--accent)' }}>Апгрейди.</span> Собирай коллекцию.</>
          ) : (
            <>Open cases. <span style={{ color: 'var(--accent)' }}>Upgrade.</span> Collect.</>
          )}
        </h1>
        <p style={{ color: 'var(--text-dim)', maxWidth: 560, marginTop: 12, fontSize: 15 }}>{t.economyNote}</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
          <Link href="/cases" className="btn btn-primary" style={{ padding: '12px 26px', fontSize: 15 }}>
            🎁 {t.cases}
          </Link>
          <Link href="/upgrade" className="btn btn-ghost" style={{ padding: '12px 26px', fontSize: 15 }}>
            ⚡ {t.upgrade}
          </Link>
          <Link href="/contracts" className="btn btn-ghost" style={{ padding: '12px 26px', fontSize: 15 }}>
            📜 {t.contracts}
          </Link>
        </div>
        {stats && (
          <div style={{ display: 'flex', gap: 22, marginTop: 26, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-dim)' }}>
            <span>👥 {stats.users} {lang === 'ru' ? 'игроков' : 'players'}</span>
            <span>🎁 {stats.opens.toLocaleString('ru')} {t.opens.toLowerCase()}</span>
            <span>✨ {stats.drops.toLocaleString('ru')} {lang === 'ru' ? 'предметов выдано' : 'items dropped'}</span>
          </div>
        )}
      </section>

      {/* live drops */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className="pulse-glow" style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--success)', display: 'inline-block' }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{t.liveDrops}</h2>
        </div>
        <LiveDrops rows={drops ?? []} />
      </section>

      {/* cases */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{t.topCases}</h2>
          <Link href="/cases" style={{ color: 'var(--accent)', fontSize: 13 }}>{t.cases} →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
          {top.map((c) => (
            <CaseCard key={c.slug} c={c} />
          ))}
        </div>
      </section>

      {/* how it works */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{t.howItWorks}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {[
            { icon: '🎁', t: t.how1t, d: t.how1d },
            { icon: '⚡', t: t.how2t, d: t.how2d },
            { icon: '📜', t: t.how3t, d: t.how3d },
          ].map((x) => (
            <div key={x.t} className="card card-hover" style={{ padding: 20 }}>
              <div style={{ fontSize: 28 }}>{x.icon}</div>
              <div style={{ fontWeight: 800, marginTop: 8 }}>{x.t}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{x.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* quick stats for the user */}
      {me && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <StatCard label={t.balance} value={`${me.balance?.amount.toLocaleString('ru') ?? 0} AP`} accent="var(--accent)" />
          <StatCard label={t.level} value={me.level.level} />
          <StatCard label={t.xp} value={me.xp} />
          <StatCard label={t.streak} value={`${me.streak} 🔥`} />
        </section>
      )}
    </div>
  );
}
