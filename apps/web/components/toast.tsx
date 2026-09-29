'use client';

import { useEffect } from 'react';
import { useStore } from '../lib/store';

function Toast({ id, kind, text }: { id: number; kind: string; text: string }) {
  const dropToast = useStore((s) => s.dropToast);
  useEffect(() => {
    const t = setTimeout(() => dropToast(id), 3800);
    return () => clearTimeout(t);
  }, [id, dropToast]);

  const bg = kind === 'ok' ? '#123c2e' : kind === 'err' ? '#3f1d28' : '#1c2740';
  const border = kind === 'ok' ? '#34d399' : kind === 'err' ? '#fb7185' : '#3b82f6';
  return (
    <div
      className="rise-in"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: '10px 16px',
        fontSize: 14,
        maxWidth: 340,
        boxShadow: '0 8px 24px rgba(0,0,0,.4)',
      }}
      role="status"
    >
      {text}
    </div>
  );
}

export function ToastHost() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        top: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} {...t} />
      ))}
    </div>
  );
}
