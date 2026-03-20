import { createDefaultSong } from '@/lib/song-utils';
import type { AppSettings, StarterTemplate } from '@/types/engine';

export function loadStarterTemplate(templateId: StarterTemplate, settings: AppSettings) {
  if (templateId === 'modern') {
    const nextSettings: AppSettings = {
      ...settings,
      mode: 'modern',
    };
    return {
      song: createDefaultSong(nextSettings),
      settings: nextSettings,
      label: 'Modern Starter',
    };
  }

  if (templateId === 'strict-nes') {
    const nextSettings: AppSettings = {
      ...settings,
      mode: 'strict',
    };
    return {
      song: createDefaultSong(nextSettings),
      settings: nextSettings,
      label: 'Strict NES Starter',
    };
  }

  return {
    song: createDefaultSong(settings),
    settings,
    label: 'Test Song Starter',
  };
}
