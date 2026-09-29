'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { post } from '../lib/api';
import { DICT } from '../lib/i18n';
import { useStore } from '../lib/store';

function Coin({ size = 16 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/coin.png" alt="AP" width={size} height={size * 0.55} style={{ objectFit: 'contain' }} />
  );
}

function BalanceChip() {
  const me = useStore((s) => s.me);
  const t = DICT[useStore((s) => s.lang)];
  return (
    <div
      className="card"
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', fontWeight: 700, fontSize: 14 }}
      title={t.balance}
    >
      <Coin />
      <span style={{ color: 'var(--accent)' }}>{me?.balance ? me.balance.amount.toLocaleString('ru') : '—'}</span>
      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>AP</span>
    </div>
  );
}

const NAV: { href: string; key: keyof typeof DICT.ru; icon: string }[] = [
  { href: '/cases', key: 'cases', icon: '🎁' },
  { href: '/upgrade', key: 'upgrade', icon: '⚡' },
  { href: '/contracts', key: 'contracts', icon: '📜' },
  { href: '/inventory', key: 'inventory', icon: '🎒' },
  { href: '/daily', key: 'daily', icon: '📅' },
  { href: '/leaderboard', key: 'leaderboard', icon: '🏆' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { me, lang, unread } = useStore();
  const setMe = useStore((s) => s.setMe);
  const t = DICT[lang];

  // poll unread notifications
  useEffect(() => {
    if (!me) return;
    let stop = false;
    const ping = () => {
      fetch('/api/notifications/unread-count', { credentials: 'include' })
        .then((r) => r.json())
        .then((j) => {
          if (!stop && j.success) useStore.getState().setUnread(j.data);
        })
        .catch(() => {});
    };
    ping();
    const iv = setInterval(ping, 30_000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [me, path]);

  const isAuthPage = path === '/login' || path === '/register';
  if (isAuthPage) return <main style={{ minHeight: '100vh' }}>{children}</main>;

  const active = (href: string) => path.startsWith(href);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ---- sidebar (desktop) ---- */}
      <aside
        className="sidebar"
        style={{
          width: 220,
          borderRight: '1px solid var(--border)',
          padding: '20px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          position: 'sticky',
          top: 0,
          height: '100vh',
          flexShrink: 0,
        }}
      >
        <Link href="/" style={{ display: 'block', marginBottom: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: 0.5 }}>
            <span style={{ color: 'var(--accent)' }}>CASE</span>ARENA
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.tagline}</div>
        </Link>

        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="nav-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: active(n.href) ? 700 : 500,
              background: active(n.href) ? 'var(--surface-hover)' : 'transparent',
              color: active(n.href) ? 'var(--accent)' : 'var(--text)',
            }}
          >
            <span style={{ fontSize: 16 }}>{n.icon}</span> {t[n.key]}
          </Link>
        ))}

        <div style={{ flex: 1 }} />

        {me ? (
          <>
            <Link
              href={`/profile/${me.username}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--surface)' }}
            >
              <Avatar name={me.username} size={30} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {me.username}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {t.level} {me.level?.level} · {me.xp} XP
                </div>
              </div>
            </Link>
            {me.role === 'ADMIN' || me.role === 'SUPER_ADMIN' ? (
              <Link href="/admin" className="nav-item" style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, fontSize: 14, color: active('/admin') ? 'var(--accent)' : 'var(--text)' }}>
                🛠 {t.admin}
              </Link>
            ) : null}
            <button
              className="btn btn-ghost"
              style={{ padding: '8px 12px', fontSize: 13 }}
              onClick={async () => {
                await post('/auth/logout').catch(() => {});
                setMe(null);
                router.push('/login');
              }}
            >
              {t.logout}
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/login" className="btn btn-ghost" style={{ padding: '9px 12px', fontSize: 13 }}>
              {t.login}
            </Link>
            <Link href="/register" className="btn btn-primary" style={{ padding: '9px 12px', fontSize: 13 }}>
              {t.register}
            </Link>
          </div>
        )}
      </aside>

      {/* ---- main ---- */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* topbar */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(11,14,20,.85)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Link href="/" style={{ fontWeight: 900, fontSize: 17, display: 'none' }} className="mobile-logo">
            <span style={{ color: 'var(--accent)' }}>CASE</span>ARENA
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/notifications" style={{ position: 'relative', fontSize: 18, textDecoration: 'none' }} title="🔔">
            🔔
            {unread > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -7,
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: 10,
                  borderRadius: 999,
                  padding: '1px 5px',
                  fontWeight: 700,
                }}
              >
                {unread}
              </span>
            )}
          </Link>
          <BalanceChip />
          <LangToggle />
        </header>

        <main style={{ flex: 1, padding: '20px 20px 90px', maxWidth: 1280, width: '100%', margin: '0 auto' }}>
          {children}
        </main>

        <footer
          style={{
            borderTop: '1px solid var(--border)',
            padding: '16px 20px 20px',
            color: 'var(--text-dim)',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--warning)', fontWeight: 600, marginBottom: 4 }}>⚠ {t.noRealMoney}</div>
          <div>{t.economyNote}</div>
          <div style={{ marginTop: 6, opacity: 0.6 }}>CaseArena © 2026 · 18+ · simulate responsibly</div>
        </footer>
      </div>

      {/* ---- bottom nav (mobile) ---- */}
      <nav
        className="bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          display: 'flex',
          justifyContent: 'space-around',
          borderTop: '1px solid var(--border)',
          background: 'rgba(13,16,24,.97)',
          padding: '6px 4px 8px',
        }}
      >
        {NAV.slice(0, 5).map((n) => (
          <Link
            key={n.href}
            href={n.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              fontSize: 10,
              color: active(n.href) ? 'var(--accent)' : 'var(--text-dim)',
              textDecoration: 'none',
              flex: 1,
            }}
          >
            <span style={{ fontSize: 18 }}>{n.icon}</span>
            {t[n.key]}
          </Link>
        ))}
      </nav>

      <style jsx global>{`
        @media (max-width: 900px) {
          .sidebar { display: none; }
          .mobile-logo { display: block !important; }
        }
        @media (min-width: 901px) {
          .bottom-nav { display: none !important; }
          main { padding-bottom: 40px !important; }
        }
      `}</style>
    </div>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  const letter = name.slice(0, 1).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        flexShrink: 0,
        background: `linear-gradient(135deg, hsl(${hue} 70% 40%), hsl(${(hue + 60) % 360} 70% 30%))`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: size * 0.5,
        color: '#fff',
      }}
    >
      {letter}
    </div>
  );
}

function LangToggle() {
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  return (
    <button
      className="chip"
      onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
      style={{ fontWeight: 700, cursor: 'pointer' }}
      aria-label="language"
    >
      {lang === 'ru' ? 'RU' : 'EN'}
    </button>
  );
}
