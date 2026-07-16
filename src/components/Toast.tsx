'use client';
import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onDismiss?: () => void;
}

export default function Toast({ message, type = 'info', duration = 3000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDismiss?.(); }, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  if (!visible) return null;

  const icons: Record<string, string> = { success: '✓', error: '✕', info: 'ℹ' };
  const cls = type === 'success' ? 'toast toast-success' : type === 'error' ? 'toast toast-error' : 'toast';

  return (
    <div className={cls} role="alert" aria-live="polite">
      <span style={{ color: type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--error)' : 'var(--text-muted)', fontWeight: 600 }}>
        {icons[type]}
      </span>
      {message}
    </div>
  );
}
