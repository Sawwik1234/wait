'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { get, postIdem } from '../../lib/api';
import { usePoll } from '../../lib/hooks';
import { Spinner } from '../../components/game';
import { useStore } from '../../lib/store';

interface BattleRow {
  id: string;
  status: string;
  maxPlayers: number;
  rounds: number;
  cases: string[];
  totalCost: number;
  hasInvite: boolean;
  creator: { username: string };
  players: { username: string; isBot: boolean; totalValue: number }[];
  winner: string | null;
}

interface CaseRow {
  slug: string;
  name: string;
  price: number;
}

export default function BattlesPage() {
  const router = useRouter();
  const lang = useStore((s) => s.lang);
  const me = useStore((s) => s.me);
  const setBalance = useStore((s) => s.setBalance);
  const toast = useStore((s) => s.toast);

  const { data: battles } = usePoll<BattleRow[]>('/battles?status=ALL', 5000);
  const { data: cases } = usePoll<CaseRow[]>('/cases', 0);

  const [creating, setCreating] = useState(false);
  const [players, setPlayers] = useState(2);
  const [rounds, setRounds] = useState(3);
  const [picked, setPicked] = useState<string[]>(['starter-crate']);
  const [isPrivate, setIsPrivate] = useState(false);
  const [invite, setInvite] = useState('');
  const [filter, setFilter] = useState('ALL');

  const pickedCost = (picked.reduce((sum, slug) => sum + (cases?.find((c) => c.slug === slug)?.price ?? 0), 0)) * rounds;

  const create = async () => {
    if (!me) {
      toast(lang === 'ru' ? 'Войди через Steam' : 'Sign in via Steam', 'err');
      router.push('/login');
      return;
    }
    try {
      const res = await postIdem<{ id: string }>('/battles', {
        maxPlayers: players,
        rounds,
        caseSlugs: picked,
        isPrivate,
        inviteCode: isPrivate ? invite.toUpperCase() : undefined,
      });
      router.push(`/battles/${res.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'err');
    }
  };

  const join = async (id: string, hasInvite: boolean) => {
    if (!me) {
      router.push('/login');
      return;
    }
    let inviteCode: string | undefined;
    if (hasInvite) {
      inviteCode = window.prompt(lang === 'ru' ? 'Код приглашения:' : 'Invite code:')?.toUpperCase() ?? undefined;
      if (!inviteCode) return;
    }
    try {
      const res = await postIdem<{ started: boolean }>(`/battles/${id}/join`, { inviteCode });
      if (res.started) {
        const d = await get<{ balance: { amount: number } | null }>('/users/me').catch(() => null);
        if (d?.balance) setBalance(d.balance.amount);
      }
      router.push(`/battles/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'err');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">VIRTUAL COMPETITIVE ARENA · NO REAL MONEY</div>
          <h1 className="h-display" style={{ fontSize: 'clamp(26px, 4vw, 38px)', margin: '4px 0 0' }}>⚔ {lang === 'ru' ? 'Бои кейсами' : 'Case Battles'}</h1>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" style={{ padding: '10px 22px' }} onClick={() => setCreating(!creating)}>
          + {lang === 'ru' ? 'Создать бой' : 'Create battle'}
        </button>
      </div>

      {creating && (
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={fLabel}>{lang === 'ru' ? 'Игроков' : 'Players'}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[2, 4].map((n) => (
                  <button key={n} className={`chip ${players === n ? 'active' : ''}`} onClick={() => setPlayers(n)}>{n}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={fLabel}>{lang === 'ru' ? 'Раундов' : 'Rounds'}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[1, 2, 3, 5, 10].map((n) => (
                  <button key={n} className={`chip ${rounds === n ? 'active' : ''}`} onClick={() => setRounds(n)}>{n}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={fLabel}>{lang === 'ru' ? 'Приватный' : 'Private'}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className={`chip ${isPrivate ? 'active' : ''}`} onClick={() => setIsPrivate(!isPrivate)}>
                  {isPrivate ? '🔒 да' : '🌐 нет'}
                </button>
                {isPrivate && (
                  <input className="input" style={{ width: 110 }} placeholder="КОД" value={invite} maxLength={8} onChange={(e) => setInvite(e.target.value.toUpperCase())} />
                )}
              </div>
            </div>
          </div>

          <div>
            <div style={fLabel}>{lang === 'ru' ? `Кейсы (${picked.length}/5) — раунд ${rounds === 1 ? 'единственный' : ''} использует их по очереди` : `Cases (${picked.length}/5), cycled per round`}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {(cases ?? []).map((c) => {
                const sel = picked.includes(c.slug);
                return (
                  <button
                    key={c.slug}
                    className={`chip ${sel ? 'active' : ''}`}
                    onClick={() => setPicked((p) => (p.includes(c.slug) ? p.filter((x) => x !== c.slug) : p.length >= 5 ? p : [...p, c.slug]))}
                  >
                    {c.name} · {c.price} AP
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              {lang === 'ru' ? 'Взнос с игрока' : 'Entry per player'}: <b style={{ color: 'var(--accent)' }}>{pickedCost} AP</b>
              {' · '}{lang === 'ru' ? 'банк' : 'pot'}: <b style={{ color: 'var(--warning)' }}>{pickedCost * players} AP</b>
            </div>
            <div style={{ flex: 1 }} />
            <button className="btn btn-primary" style={{ padding: '11px 30px' }} disabled={picked.length === 0 || (isPrivate && !/^[A-Z0-9]{4,8}$/.test(invite))} onClick={create}>
              ⚔ {lang === 'ru' ? 'Создать' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {[
          ['WAITING', lang === 'ru' ? 'Открытые' : 'Open'],
          ['RUNNING', lang === 'ru' ? 'Идут' : 'Live'],
          ['FINISHED', lang === 'ru' ? 'Завершённые' : 'Finished'],
          ['ALL', lang === 'ru' ? 'Все' : 'All'],
        ].map(([id, label]) => (
          <button key={id} className={`chip ${filter === id ? 'active' : ''}`} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      {!battles ? (
        <Spinner />
      ) : battles.length === 0 ? (
        <div className="card" style={{ padding: 34, textAlign: 'center', color: 'var(--text-dim)' }}>
          {lang === 'ru' ? 'Пока пусто — создай первый бой!' : 'Empty — create the first battle!'}
        </div>
      ) : (
        <div className="arena" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10 }}>
          {battles.filter((b) => filter === 'ALL' || b.status === filter).map((b, i) => (
            <div key={b.id} className="card card-hover reveal" style={{ animationDelay: `${i * 45}ms`, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => router.push(`/battles/${b.id}`)}>
              <b style={{ fontSize: 14 }}>{b.cases.join('+')} × {b.rounds}</b>
              <span className="chip" style={{ fontSize: 10.5, color: b.status === 'WAITING' ? 'var(--warning)' : b.status === 'RUNNING' ? 'var(--accent)' : 'var(--text-dim)' }}>
                {b.status}
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{b.totalCost} AP · {b.players.length}/{b.maxPlayers}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {b.players.map((p) => (
                  <span key={p.username} style={{ fontSize: 11, color: 'var(--text-dim)' }}>{p.username}{p.isBot ? '🤖' : ''}</span>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              {b.status === 'WAITING' && (
                <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 12.5 }} onClick={(e) => { e.stopPropagation(); void join(b.id, b.hasInvite); }}>
                  {lang === 'ru' ? 'Войти' : 'Join'}
                </button>
              )}
              {b.status === 'FINISHED' && b.winner && (
                <span style={{ fontSize: 11.5, color: 'var(--warning)' }}>🏆 {b.winner}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
        ℹ {lang === 'ru'
          ? 'Победитель по сумме ценностей забирает ВСЕ выпавшие предметы. Виртуальные очки, без реальных денег.'
          : 'The player with the highest total value takes ALL dropped items. Virtual points only, no real money.'}
      </div>
    </div>
  );
}

const fLabel: React.CSSProperties = { fontSize: 11.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 };
