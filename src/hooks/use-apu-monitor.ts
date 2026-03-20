'use client';

import { useEffect, useState } from 'react';
import { nesEngine } from '@/audio/nes-engine';
import { useDAWStore } from '@/store/daw-store';
import type { APUMonitorSnapshot } from '@/types/engine';

export function useAPUMonitor() {
  const transportState = useDAWStore((state) => state.transportState);
  const visible = useDAWStore((state) => state.settings.uiConfig.monitorDockVisible);
  const [snapshot, setSnapshot] = useState<APUMonitorSnapshot | null>(null);

  useEffect(() => {
    if (!visible) return;

    const frame = () => {
      setSnapshot(nesEngine.getMonitorSnapshot(transportState));
    };

    frame();
    const interval = window.setInterval(frame, 90);
    return () => window.clearInterval(interval);
  }, [transportState, visible]);

  return snapshot;
}
