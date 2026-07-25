/**
 * File: src/components/Toasts.tsx
 * Purpose: React toast system that listens for 'sider-toast' CustomEvent and displays toasts.
 */

import React, { useEffect, useState } from 'react';

/**
 * Interface: Toast
 * Represents a single toast notification.
 */
interface Toast {
  /** Unique id for the toast */
  id: string;
  /** Message text */
  message: string;
  /** Visual type */
  type: 'info' | 'success' | 'error';
  /** Duration in ms before auto-dismiss */
  timeout: number;
}

/**
 * Component: Toasts
 * Renders a stack of toasts at top-right. Listens to window 'sider-toast' events.
 *
 * Usage:
 * - From non-React code: window.dispatchEvent(new CustomEvent('sider-toast', { detail: { message, type, timeout } }));
 */
export default function Toasts(): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  /**
   * Add a toast to state and schedule its removal.
   * @param message - text to show
   * @param type - one of 'info'|'success'|'error'
   * @param timeout - milliseconds before auto-remove
   */
  function pushToast(message: string, type: Toast['type'] = 'info', timeout = 3000) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const t: Toast = { id, message, type, timeout };
    setToasts((s) => [t, ...s]);
    window.setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== id));
    }, timeout);
  }

  useEffect(() => {
    /**
     * Event handler for 'sider-toast' events emitted from non-React code.
     * Expects event.detail = { message, type, timeout }
     */
    const handler = (e: Event) => {
      try {
        const ev = e as CustomEvent;
        const d = ev.detail || {};
        const message = String(d.message || '');
        const type = d.type === 'success' || d.type === 'error' ? d.type : 'info';
        const timeout = typeof d.timeout === 'number' ? d.timeout : 3000;
        if (message.length) pushToast(message, type, timeout);
      } catch (err) {
        // swallow
      }
    };

    window.addEventListener('sider-toast', handler as EventListener);
    return () => window.removeEventListener('sider-toast', handler as EventListener);
  }, []);

  return (
    <div className="fixed right-4 top-4 z-[9999] flex flex-col gap-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`max-w-xs w-full rounded-lg shadow-lg px-4 py-3 text-sm text-white transform transition-all duration-220 ease-in-out
            ${t.type === 'success' ? 'bg-gradient-to-b from-emerald-600 to-emerald-700' : ''}
            ${t.type === 'error' ? 'bg-gradient-to-b from-rose-600 to-rose-700' : ''}
            ${t.type === 'info' ? 'bg-gradient-to-b from-sky-600 to-sky-700' : ''}
          `}
          onClick={() => setToasts((s) => s.filter((x) => x.id !== t.id))}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 leading-tight">{t.message}</div>
            <div className="opacity-80 text-xs">{Math.ceil(t.timeout / 1000)}s</div>
          </div>
        </div>
      ))}
    </div>
  );
}
