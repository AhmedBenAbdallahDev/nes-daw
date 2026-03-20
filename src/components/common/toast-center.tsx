'use client';

import { useEffect } from 'react';
import { useDAWStore } from '@/store/daw-store';

export function ToastCenter() {
  const toasts = useDAWStore((state) => state.toasts);
  const dismissToast = useDAWStore((state) => state.dismissToast);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        dismissToast(toast.id);
      }, 4200)
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, dismissToast]);

  return (
    <div className="toast-center" aria-live="polite">
      {toasts.map((toast) => (
        <button
          type="button"
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => dismissToast(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
