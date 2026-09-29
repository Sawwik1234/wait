'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { post } from '../../lib/api';
import { useStore, type Me } from '../../lib/store';
import { DICT } from '../../lib/i18n';

export default function RegisterPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const setMe = useStore((s) => s.setMe);
  const toast = useStore((s) => s.toast);
  const t = DICT[lang];
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post('/auth/register', { email, username, password });
      const res = await fetch('/api/users/me', { credentials: 'include' });
      const j = await res.json();
      setMe(j.data as Me);
      toast(`${t.welcomeBonus}: 2500 AP 🎉`, 'ok');
      router.push('/cases');
    } catch (err) {
      toast(err instanceof Error ? err.message : t.error, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} className="card rise-in" style={{ width: '100%', maxWidth: 400, padding: 28 }}>
        <div style={{ fontWeight: 900, fontSize: 24, marginBottom: 4 }}>
          <span style={{ color: 'var(--accent)' }}>CASE</span>ARENA
        </div>
        <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 20 }}>
          {t.register} · <span style={{ color: 'var(--accent)' }}>{t.welcomeBonus} 2500 AP</span>
        </div>

        <label style={lbl}>{t.email}</label>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label style={lbl}>{t.username}</label>
        <input className="input" required minLength={3} maxLength={20} value={username} onChange={(e) => setUsername(e.target.value)} />
        <label style={lbl}>{t.password}</label>
        <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />

        <button className="btn btn-primary" disabled={busy} style={{ width: '100%', padding: '12px 0', marginTop: 18, fontSize: 15 }}>
          {busy ? '…' : t.signUp}
        </button>

        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>
          {t.haveAccount}{' '}
          <Link href="/login" style={{ color: 'var(--accent)' }}>
            {t.login}
          </Link>
        </div>
      </form>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-dim)', margin: '12px 0 6px' };
