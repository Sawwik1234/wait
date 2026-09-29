'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { post } from '../../lib/api';
import { useStore, type Me } from '../../lib/store';
import { DICT } from '../../lib/i18n';

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
  const steamFailed = typeof window !== 'undefined' && window.location.search.includes('steam=failed');

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card rise-in" style={{ width: '100%', maxWidth: 420, padding: 30 }}>
        <div style={{ fontWeight: 900, fontSize: 26, marginBottom: 4, textAlign: 'center' }}>
          <span style={{ color: 'var(--accent)' }}>CASE</span>ARENA
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24, textAlign: 'center' }}>
          {t.tagline}
        </div>

        {steamFailed && (
          <div style={{ background: '#3f1d28', border: '1px solid var(--danger)', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, marginBottom: 16 }}>
            {lang === 'ru' ? 'Steam-вход не удался. Попробуй ещё раз.' : 'Steam sign-in failed. Try again.'}
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

        <div style={{ marginTop: 22, fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'center', opacity: 0.7 }}>
          {t.noRealMoney}
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-dim)', margin: '12px 0 6px' };
