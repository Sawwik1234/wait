'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { get } from '../../../lib/api';
import { usePoll } from '../../../lib/hooks';
import { Spinner } from '../../../components/game';
import { RARITY_COLOR, useStore } from '../../../lib/store';
import { DICT } from '../../../lib/i18n';

interface RoundDrop {
  roundNo: number;
  item: { name: string; image: string; rarity: string; value: number };
}
interface BattleData {
  id: string;
  status: string;
  rounds: number;
  maxPlayers: number;
  cases: string[];
  totalCost: number;
  players: { username: string; isBot: boolean; totalValue: number; rounds: RoundDrop[] }[];
  winnerUsername: string | null;
}

export default function BattleRoomPage() {
  const { id } = useParams<{ id: string }>();
  const lang = useStore((s) => s.lang);
  const t = DICT[lang];
  const me = useStore((s) => s.me);
  const toast = useStore((s) => s.toast);

  const { data, reload } = usePoll<BattleData>(`/battles/${id}`, 0);
  const [live, setLive] = useState<BattleData | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [seenLen, setSeenLen] = useState(0);
  const [shaking, setShaking] = useState(false);
  const roundsPlayed = live?.players[0]?.rounds.length ?? 0;

  useEffect(() => {
    if (roundsPlayed > seenLen) {
      setSeenLen(roundsPlayed);
      setShaking(true);
      const tm = setTimeout(() => setShaking(false), 420);
      return () => clearTimeout(tm);
    }
  }, [roundsPlayed, seenLen]);

  // merge server data as baseline
  useEffect(() => {
    if (data && !live) setLive(data);
  }, [data, live]);

  // realtime with polling fallback
  useEffect(() => {
    if (!id) return;
    let disposed = false;

    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        try {
          const d = await get<BattleData>(`/battles/${id}`);
          if (!disposed) setLive(d);
        } catch {}
      }, 1500);
    };

    try {
      const socketBase = process.env.NEXT_PUBLIC_SOCKET_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
      const socket = io(`${socketBase}/realtime`, { query: { battleId: id }, transports: ['websocket', 'polling'], reconnectionAttempts: 3, timeout: 3000 });
      socketRef.current = socket;
      socket.on('connect', () => setConnected(true));
      socket.on('connect_error', () => {
        setConnected(false);
        startPolling();
      });
      socket.on('disconnect', () => setConnected(false));
      socket.on('battle:joined', () => {
        get<BattleData>(`/battles/${id}`).then(setLive).catch(() => {});
      });
      socket.on('battle:starting', () => {
        get<BattleData>(`/battles/${id}`).then(setLive).catch(() => {});
      });
      socket.on('battle:finished', () => {
        get<BattleData>(`/battles/${id}`).then(setLive).catch(() => {});
      });
      socket.on('battle:cancelled', () => {
        get<BattleData>(`/battles/${id}`).then(setLive).catch(() => {});
      });
      // poll on a slow cadence even when connected (round-by-round visuals)
      socket.on('connect', () => {
        get<BattleData>(`/battles/${id}`).then(setLive).catch(() => {});
      });
    } catch {
      startPolling();
    }
    // light polling during active battle for round updates
    const slow = setInterval(async () => {
      try {
        const d = await get<BattleData>(`/battles/${id}`);
        if (!disposed) setLive(d);
      } catch {}
    }, 2500);

    return () => {
      disposed = true;
      clearInterval(slow);
      if (pollRef.current) clearInterval(pollRef.current);
      socketRef.current?.disconnect();
    };
  }, [id]);

  if (!live) return <Spinner />;

  const b = live;
  const isCreator = me?.username === b.players[0]?.username && b.players[0];
  const joined = me ? b.players.some((p) => p.username === me.username) : false;
  const canJoin = b.status === 'WAITING' && !joined && b.players.length < b.maxPlayers && me;
  const curRound = Math.min(b.rounds, roundsPlayed + (b.status === 'RUNNING' ? 1 : 0));
  const lastDrops = b.players.map((p) => p.rounds[p.rounds.length - 1]).filter(Boolean);

  return (
    <div className={`arena ${shaking ? 'shake' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 18 }}>
      <Link href="/battles" style={{ color: 'var(--text-dim)', fontSize: 13, position: 'relative', zIndex: 1 }}>← Бои</Link>

      {/* round header */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div className="eyebrow">{b.cases.join(' + ')} × {b.rounds}</div>
        <div className="h-display" style={{ fontSize: 'clamp(30px, 5vw, 46px)', margin: '2px 0 0', letterSpacing: '.06em' }}>
          ROUND {String(Math.max(1, curRound)).padStart(2, '0')}
        </div>
      </div>

      <section className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 17 }}>⚔ {b.cases.join(' + ')} × {b.rounds}</b>
        <span className="chip" style={{ color: b.status === 'WAITING' ? 'var(--warning)' : b.status === 'RUNNING' ? 'var(--accent)' : 'var(--text-dim)' }}>
          {b.status === 'WAITING' ? '⏳ ожидание' : b.status === 'RUNNING' ? '🔴 идёт' : b.status === 'FINISHED' ? '🏁 завершён' : '✖ отменён'}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>
          вход {b.totalCost} AP · {b.players.length}/{b.maxPlayers}
        </span>
        <span style={{ fontSize: 10.5, color: connected ? 'var(--success)' : 'var(--text-dim)' }}>
          {connected ? '● realtime' : '◌ polling'}
        </span>
        <div style={{ flex: 1 }} />
        {canJoin && (
          <button
            className="btn btn-primary"
            style={{ padding: '10px 22px' }}
            onClick={async () => {
              try {
                await get(`/battles/${b.id}`); // warm
                await fetch(`/api/battles/${b.id}/join`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                const d = await get<BattleData>(`/battles/${b.id}`);
                setLive(d);
              } catch (e) {
                toast(e instanceof Error ? e.message : t.error, 'err');
              }
            }}
          >
            Войти · {b.totalCost} AP
          </button>
        )}
        {joined && b.status === 'WAITING' && b.players.length < b.maxPlayers && (
          <button
            className="btn btn-ghost"
            style={{ padding: '10px 22px' }}
            onClick={async () => {
              try {
                await fetch(`/api/battles/${b.id}/fill-bots`, { method: 'POST', credentials: 'include' });
                const d = await get<BattleData>(`/battles/${b.id}`);
                setLive(d);
                toast('🤖 Боты добавлены', 'ok');
              } catch (e) {
                toast(e instanceof Error ? e.message : t.error, 'err');
              }
            }}
          >
            🤖 Заполнить ботами
          </button>
        )}
        {joined && b.status === 'WAITING' && !isCreator && (
          <button className="btn btn-ghost" style={{ padding: '10px 22px' }} onClick={async () => {
            await fetch(`/api/battles/${b.id}/leave`, { method: 'POST', credentials: 'include' });
            location.reload();
          }}>Выйти</button>
        )}
        {isCreator && b.status === 'WAITING' && (
          <button className="btn btn-danger" style={{ padding: '10px 22px' }} onClick={async () => {
            await fetch(`/api/battles/${b.id}/cancel`, { method: 'POST', credentials: 'include' });
            location.href = '/battles';
          }}>Отменить</button>
        )}
      </section>

      {b.status === 'FINISHED' && b.winnerUsername && (
        <section className="card pop-in" style={{ padding: 22, textAlign: 'center', borderColor: 'var(--warning)', background: 'radial-gradient(500px 150px at 50% 0%, rgba(251,191,36,.12), transparent), var(--surface)' }}>
          <div style={{ fontSize: 26, fontWeight: 900 }}>
            🏆 {b.winnerUsername} {lang === 'ru' ? 'забирает весь банк!' : 'takes the pot!'}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>
            {lang === 'ru' ? 'Все выпавшие предметы перешли победителю — смотри инвентарь.' : 'All dropped items went to the winner — check the inventory.'}
          </div>
        </section>
      )}

      {/* item reveal — latest round */}
      {b.status !== 'WAITING' && lastDrops.length > 0 && (
        <section key={roundsPlayed} className="round-reveal" style={{ textAlign: 'center', position: 'relative', zIndex: 1, padding: '14px 0 6px' }}>
          <div className="eyebrow">ITEM REVEAL · ROUND {String(roundsPlayed).padStart(2, '0')}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 10, flexWrap: 'wrap' }}>
            {lastDrops.map((d, i) => {
              const c = RARITY_COLOR[d.item.rarity] ?? '#888';
              return (
                <div key={i} style={{ textAlign: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.item.image} alt="" className="floaty" style={{ width: 86, height: 64, objectFit: 'contain', filter: `drop-shadow(0 10px 24px ${c}44)` }} />
                  <div style={{ color: c, fontWeight: 800, fontSize: 12.5, marginTop: 4 }}>{d.item.name}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 10.5 }}>{d.item.value} AP</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* players grid */}
      <section style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: 12, position: 'relative', zIndex: 1 }}>
        {b.players.map((p) => {
          const isWinner = b.winnerUsername === p.username;
          return (
            <div
              key={p.username}
              className="card"
              style={{
                padding: 14,
                borderColor: isWinner ? 'var(--warning)' : 'var(--border)',
                boxShadow: isWinner ? '0 0 24px -8px var(--warning)' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <b style={{ fontSize: 14 }}>{p.username}</b>
                {p.isBot && <span className="chip" style={{ fontSize: 9 }}>BOT</span>}
                <div style={{ flex: 1 }} />
                <span style={{ color: 'var(--accent)', fontWeight: 900, fontSize: 16 }}>{p.totalValue}</span>
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap', minHeight: 40 }}>
                {p.rounds.map((r, i) => {
                  const c = RARITY_COLOR[r.item.rarity] ?? '#888';
                  return (
                    <div key={i} className="round-reveal" style={{ textAlign: 'center', padding: 5, borderRadius: 8, border: `1px solid ${c}`, width: 52 }} title={`${r.item.name} · ${r.item.value} AP`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.item.image} alt="" style={{ width: 40, height: 30, objectFit: 'contain' }} />
                      <div style={{ fontSize: 9.5, color: c, fontWeight: 700 }}>{r.item.value}</div>
                    </div>
                  );
                })}
                {Array.from({ length: Math.max(0, b.rounds - p.rounds.length) }).map((_, i) => (
                  <div key={`e${i}`} style={{ width: 52, height: 42, borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 10 }}>
                    R{p.rounds.length + i + 1}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {b.status === 'WAITING' &&
          Array.from({ length: b.maxPlayers - b.players.length }).map((_, i) => (
            <div key={`slot${i}`} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13, borderStyle: 'dashed', minHeight: 110 }}>
              {lang === 'ru' ? 'Ожидание игрока…' : 'Waiting for player…'}
            </div>
          ))}
      </section>
    </div>
  );
}
