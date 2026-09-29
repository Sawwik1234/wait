'use client';

import Link from 'next/link';
import { usePoll } from '../lib/hooks';
import { CaseCard, LiveDrops, StatCard, type CaseLike, type DropRow } from '../components/game';
import { LofiRoom } from '../components/lofi-room';
import { Tilt, Reveal, useScrollShift, Magnetic } from '../components/effects';
import { useStore } from '../lib/store';
import { DICT } from '../lib/i18n';

interface LbRow { rank: number; username: string; score: number; level: number; isBot: boolean; label?: string }

export default function HomePage() {
  const lang = useStore((s) => s.lang);
  const me = useStore((s) => s.me);
  const t = DICT[lang];
  const { data: cases } = usePoll<CaseLike[]>('/cases', 0);
  const { data: drops } = usePoll<DropRow[]>('/drops?limit=18', 7000);
  const { data: stats } = usePoll<{ users: number; opens: number; drops: number }>('/stats/overview', 15000);
  const { data: lb } = usePoll<LbRow[]>('/leaderboard?tab=xp', 15000);

  const featured = (cases ?? []).slice().sort((a, b) => b.price - a.price).slice(0, 6);
  const top3 = (lb ?? []).filter((r) => !r.isBot).slice(0, 3);
  const heroShift = useScrollShift(0.1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
      {/* ================= HERO ================= */}
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.02fr) minmax(0, 1fr)', gap: 28, alignItems: 'center' }} className="hero-grid">
        <div className="rise-in">
          <span className="eyebrow">lo-fi cyber arcade</span>
          <h1 className="h-display" style={{ fontSize: 'clamp(30px, 4.6vw, 52px)', margin: '14px 0 0' }}>
            {t.heroLine1}
            <br />
            <span className="text-glow" style={{ color: 'var(--accent)' }}>{t.heroLine2}</span>
          </h1>
          <p style={{ color: 'var(--text-dim)', maxWidth: 520, marginTop: 14, fontSize: 15, lineHeight: 1.6 }}>
            {t.heroSub}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            <Magnetic>
              <Link href="/cases" className="btn btn-primary" style={{ padding: '14px 30px', fontSize: 15, letterSpacing: '0.08em' }}>
                {t.explore} →
              </Link>
            </Magnetic>
            <Magnetic strength={0.18}>
              <Link href="/inventory" className="btn btn-ghost glass" style={{ padding: '14px 26px', fontSize: 15, letterSpacing: '0.06em' }}>
                🎒 {t.myInventory}
              </Link>
            </Magnetic>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', opacity: 0.8, marginTop: 16, maxWidth: 480 }}>
            {t.economyNote}
          </div>
          {stats && (
            <div style={{ display: 'flex', gap: 22, marginTop: 20, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-dim)' }}>
              <span>👥 {stats.users} {lang === 'ru' ? 'игроков' : 'players'}</span>
              <span>🎁 {stats.opens.toLocaleString('ru')} {t.opens.toLowerCase()}</span>
              <span>✨ {stats.drops.toLocaleString('ru')} {lang === 'ru' ? 'предметов выдано' : 'items dropped'}</span>
            </div>
          )}
        </div>

        {/* right: interactive lo-fi room (parallax on hover, drifts on scroll) */}
        <div ref={heroShift} style={{ position: 'relative' }}>
          <LofiRoom height={400} style={{ boxShadow: '0 30px 80px -30px rgba(0,0,0,.8), 0 0 60px -20px rgba(34,211,238,.15)' }} />
          <div style={{ position: 'absolute', left: 14, bottom: 12, fontSize: 10, letterSpacing: '0.2em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            © casearena · virtual only
          </div>
        </div>
      </section>

      {/* ================= FEATURED CASES ================= */}
      <Reveal>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h2 className="h-display" style={{ fontSize: 22, margin: 0 }}>{t.topCases}</h2>
          <Link href="/cases" style={{ color: 'var(--accent)', fontSize: 13 }}>{t.allCases} →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16 }}>
          {featured.map((c, i) => (
            <Reveal key={c.slug} delay={i * 60}>
              <Tilt>
                <CaseCard c={c} />
              </Tilt>
            </Reveal>
          ))}
        </div>
      </Reveal>

      {/* ================= LIVE ACTIVITY ================= */}
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className="pulse-glow" style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--success)', display: 'inline-block' }} />
          <h2 className="h-display" style={{ fontSize: 22, margin: 0 }}>{t.liveActivity}</h2>
        </div>
        <LiveDrops rows={drops ?? []} />
      </Reveal>

      {/* ================= GAME MODES ================= */}
      <Reveal>
        <h2 className="h-display" style={{ fontSize: 22, marginBottom: 14 }}>{t.gameModes}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
          {([
            { href: '/cases', icon: '🎁', title: t.cases, desc: t.modeCasesD },
            { href: '/battles', icon: '⚔️', title: t.battles, desc: t.modeBattlesD },
            { href: '/upgrade', icon: '⚡', title: t.upgrade, desc: t.modeUpgradeD },
            { href: '/contracts', icon: '📜', title: t.contracts, desc: t.modeContractsD },
          ] as const).map((m, i) => (
            <Reveal key={m.href} delay={i * 70}>
              <Tilt max={6}>
                <Link href={m.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="card card-hover" style={{ padding: 22, height: '100%', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ fontSize: 30, filter: 'drop-shadow(0 6px 16px rgba(34,211,238,.25))' }}>{m.icon}</div>
                    <div className="h-display" style={{ fontSize: 16, marginTop: 10 }}>{m.title}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 6, lineHeight: 1.55 }}>{m.desc}</div>
                    <div style={{ marginTop: 14, fontSize: 12, color: 'var(--accent)', letterSpacing: '0.14em' }}>GO →</div>
                  </div>
                </Link>
              </Tilt>
            </Reveal>
          ))}
        </div>
      </Reveal>

      {/* ================= LEADERBOARD TEASER ================= */}
      {top3.length > 0 && (
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h2 className="h-display" style={{ fontSize: 22, margin: 0 }}>🏆 {t.leaderboard}</h2>
            <Link href="/leaderboard" style={{ color: 'var(--accent)', fontSize: 13 }}>{t.leaderboard} →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'end' }}>
            {top3.map((r, i) => (
              <Reveal key={r.username} delay={i * 90}>
                <Tilt max={7}>
                  <div
                    className="card"
                    style={{
                      padding: '22px 16px', textAlign: 'center', height: '100%',
                      borderColor: i === 0 ? 'rgba(251,191,36,.45)' : 'var(--border)',
                      boxShadow: i === 0 ? '0 0 40px -12px rgba(251,191,36,.35)' : undefined,
                    }}
                  >
                    <div className="h-display" style={{ fontSize: i === 0 ? 30 : 24, color: i === 0 ? 'var(--warning)' : 'var(--text-dim)' }}>
                      #{r.rank}
                    </div>
                    <div style={{ margin: '10px auto', width: 46, height: 46, borderRadius: 99, background: 'linear-gradient(135deg, #171a21, #2a475e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: 'var(--accent)' }}>
                      {r.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.username}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 3 }}>
                      {r.score.toLocaleString('ru')} · {t.level} {r.level}
                    </div>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </Reveal>
      )}

      {/* ================= CTA BANNER ================= */}
      <Reveal>
        <div className="card glass" style={{ padding: '30px 28px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
          <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
          <div style={{ position: 'relative' }}>
            <div className="h-display" style={{ fontSize: 20 }}>{t.readyT}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 6 }}>{t.readyD}</div>
          </div>
          <Magnetic>
            <Link href="/cases" className="btn btn-primary" style={{ padding: '13px 28px', fontSize: 15, position: 'relative' }}>
              {t.readyCta} →
            </Link>
          </Magnetic>
        </div>
      </Reveal>

      {/* quick stats for the logged-in user */}
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
