import { STORAGE_KEYS } from '@/lib/constants';
import type { AppSettings, Song } from '@/types/engine';

export interface DraftState {
  song: Song;
  settings: AppSettings;
  savedAt: string;
}

export function saveDraft(song: Song, settings: AppSettings): void {
  if (typeof window === 'undefined') return;

  const payload: DraftState = {
    song,
    settings,
    savedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(payload));
}

export function loadDraft(): DraftState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.draft);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftState;
    if (!parsed.song || !parsed.settings) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEYS.draft);
}
