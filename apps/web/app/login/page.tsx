'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { post } from '../../lib/api';
import { useStore, type Me } from '../../lib/store';
import { DICT } from '../../lib/i18n';
import { LofiRoom } from '../../components/lofi-room';

export default function LoginPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const setMe = useStore((s) => s.setMe);
  const toast = useStore((s) => s.toast);
  const t = DICT[lang];

  const [showAdmin, setShowAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  // Read the query param in an effect, NOT during render: `window` does not exist
  // during SSR, and branching on it produces a server/client hydration mismatch.
  const [steamFailed, setSteamFailed] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('steam') === 'failed') setSteamFailed(true);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post('/auth/login', { email, password, code });
      const res = await fetch('/api/users/me', { credentials: 'include' });
      const j = await res.json();
      setMe(j.data as Me);
      toast(`${t.signIn}: ${j.data.username} ✅`, 'ok');
      router.push('/admin');
    } catch (err) {
      toast(err instanceof Error ? err.message : t.error, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ---- left: lo-fi scene (desktop) ---- */}
      <div className="login-scene" style={{ flex: 1, position: 'relative', minHeight: '100vh', padding: 26 }}>
        <LofiRoom height="100%" style={{ height: '100%' }} />
        <div style={{ position: 'absolute', left: 44, top: 40 }}>
          <div className="h-display" style={{ fontSize: 24 }}>
            <span style={{ color: 'var(--accent)' }}>CASE</span>ARENA
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 4 }}>
            lo-fi cyber arcade
          </div>
        </div>
      </div>

      {/* ---- right: form ---- */}
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '34px 30px' }}>
        {/* mobile mini scene */}
        <div className="login-mini-scene" style={{ marginBottom: 22 }}>
          <LofiRoom height={130} />
        </div>

        <div className="rise-in">
          <span className="eyebrow">casearena</span>
          <h1 className="h-display" style={{ fontSize: 'clamp(24px, 3vw, 32px)', margin: '12px 0 4px' }}>
            {t.welcomeTitle}
          </h1>
          <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>{t.welcomeSub}</div>
        </div>

        <div className="card glass rise-in" style={{ padding: 24, marginTop: 20 }}>
          {steamFailed && (
            <div style={{ background: '#3f1d28', border: '1px solid var(--danger)', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, marginBottom: 16 }}>
              {lang === 'ru'
                ? 'Steam-вход не удался (точная причина — в консоли API). Попробуй ещё раз или войди как тестовый игрок.'
                : 'Steam sign-in failed (exact reason is in the API console). Try again or use the dev sign-in.'}
            </div>
          )}

          {/* Steam — main entry */}
          <a
            href="/api/auth/steam"
            className="btn"
            style={{
              width: '100%',
              padding: '15px 0',
              fontSize: 15,
              background: 'linear-gradient(135deg, #171a21 0%, #2a475e 100%)',
              color: '#c7d5e0',
              border: '1px solid #3b5a72',
              textDecoration: 'none',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 2 }}>
              <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5l2.7-4.43a3.9 3.9 0 0 1-1.54.32A3.9 3.9 0 1 1 13.9 13.5l4.45-2.72A6.4 6.4 0 0 0 12 2zm-1.6 15.9a2.3 2.3 0 1 1-2.3-2.3l1.03.02 1.72-2.82a3.9 3.9 0 0 1 2.35-.02l-2.8 5.12z"/>
            </svg>
            {lang === 'ru' ? 'Войти через Steam' : 'Sign in via Steam'}
          </a>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', marginTop: 8 }}>
            {lang === 'ru'
              ? 'Все игроки входят через Steam. Аккаунт создаётся автоматически (+2500 AP).'
              : 'All players sign in via Steam. Account is created automatically (+2500 AP).'}
          </div>

          {/* DEV ONLY: stripped from production builds at compile time. */}
          {process.env.NODE_ENV === 'development' && (
            <a
              href="/api/auth/steam/dev?name=DevPlayer"
              className="btn btn-ghost"
              style={{ width: '100%', padding: '10px 0', fontSize: 12.5, marginTop: 10, borderStyle: 'dashed' }}
            >
              🧪 {lang === 'ru' ? 'DEV: войти без Steam (локальный тест)' : 'DEV: sign in without Steam (local test)'}
            </a>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 14px', color: 'var(--text-dim)', fontSize: 11 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            {lang === 'ru' ? 'персонал' : 'staff'}
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {!showAdmin ? (
            <button className="btn btn-ghost" style={{ width: '100%', padding: '11px 0', fontSize: 13 }} onClick={() => setShowAdmin(true)}>
              🛠 {lang === 'ru' ? 'Вход для администратора' : 'Administrator login'}
            </button>
          ) : (
            <form onSubmit={submit}>
              <label style={lbl}>{t.email}</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@casearena.local" />
              <label style={lbl}>{t.password}</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <label style={lbl}>{lang === 'ru' ? 'Секретный код' : 'Secret code'}</label>
              <input className="input" type="password" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="•••••••" />
              <button className="btn btn-primary" disabled={busy} style={{ width: '100%', padding: '12px 0', marginTop: 16, fontSize: 15 }}>
                {busy ? '…' : t.signIn}
              </button>
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', opacity: 0.7 }}>
                {lang === 'ru' ? 'Требуются email, пароль и секретный код.' : 'Email, password and secret code required.'}
              </div>
            </form>
          )}

          <div style={{ marginTop: 18, fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'center', opacity: 0.7 }}>
            {t.noRealMoney}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .login-scene { display: none; }
          .login-mini-scene { display: block; }
        }
        @media (min-width: 901px) {
          .login-mini-scene { display: none; }
        }
      `}</style>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-dim)', margin: '12px 0 6px' };
