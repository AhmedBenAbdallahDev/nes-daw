'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrangementSequencer } from '@/components/arrangement/arrangement-sequencer';
import { APUMonitorDock } from '@/components/common/apu-monitor-dock';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { HelpDialog } from '@/components/common/help-dialog';
import { OnboardingChecklist } from '@/components/common/onboarding-checklist';
import { TestSongDialog } from '@/components/common/test-song-dialog';
import { ToastCenter } from '@/components/common/toast-center';
import { ValidationPanel } from '@/components/common/validation-panel';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { MIDIImportDialog } from '@/components/import/midi-import-dialog';
import { VirtualKeyboard } from '@/components/instruments/virtual-keyboard';
import PianoRoll from '@/components/piano-roll/piano-roll';
import { SettingsPanel } from '@/components/settings/settings-panel';
import { TrackPanel } from '@/components/tracks/track-panel';
import { TransportBar } from '@/components/transport/transport-bar';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useMIDI } from '@/hooks/use-midi';
import { useNESEngine } from '@/hooks/use-nes-engine';
import { useScheduler } from '@/hooks/use-scheduler';
import { exportMidi } from '@/services/midi-file-service';
import {
  downloadBinaryFile,
  downloadTextFile,
  loadProjectFromFile,
  serializeProject,
} from '@/services/project-io';
import { clearDraft, loadDraft, saveDraft } from '@/services/draft-storage';
import { exportWav } from '@/services/wav-export';
import {
  BundledMidiAssetError,
  loadBundledTestProject,
  type TestProjectTemplateId,
} from '@/services/test-projects';
import { errorMessageFromCode } from '@/services/error-service';
import { buildProjectReport, formatProjectReportHtml, formatProjectReportMarkdown } from '@/services/project-report-service';
import { buildValidationSummary } from '@/services/validation-service';
import { loadStarterTemplate } from '@/services/starter-template-service';
import { useDAWStore } from '@/store/daw-store';

export default function Home() {
  const [started, setStarted] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportingWav, setExportingWav] = useState(false);
  const [isCompanionViewport, setIsCompanionViewport] = useState(false);
  const [testSongDialogOpen, setTestSongDialogOpen] = useState(false);
  const [loadingTestSongId, setLoadingTestSongId] = useState<TestProjectTemplateId | null>(null);

  useNESEngine();
  useMIDI();
  useKeyboard();

  const { play, stop, pause, record } = useScheduler();

  const song = useDAWStore((state) => state.song);
  const settings = useDAWStore((state) => state.settings);
  const playbackPreviewMode = useDAWStore((state) => state.playbackPreviewMode);
  const midiProfiles = useDAWStore((state) => state.midiProfiles);
  const midiConnected = useDAWStore((state) => state.midiConnected);
  const engineReady = useDAWStore((state) => state.engineReady);
  const setSettingsOpen = useDAWStore((state) => state.setSettingsOpen);
  const settingsOpen = useDAWStore((state) => state.settingsOpen);
  const setHelpOpen = useDAWStore((state) => state.setHelpOpen);
  const replaceSong = useDAWStore((state) => state.replaceSong);
  const replaceSettings = useDAWStore((state) => state.replaceSettings);
  const resetProject = useDAWStore((state) => state.resetProject);
  const applyDraftState = useDAWStore((state) => state.applyDraftState);
  const completeOnboardingStep = useDAWStore((state) => state.completeOnboardingStep);
  const pushToast = useDAWStore((state) => state.pushToast);

  const browserSupport = useMemo(
    () => ({
      webAudio: typeof window !== 'undefined' && Boolean(window.AudioContext),
      webMIDI: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
    }),
    []
  );

  const handleStart = useCallback(() => {
    setStarted(true);
    if (!browserSupport.webAudio) {
      pushToast({
        type: 'error',
        message: 'Web Audio API is unavailable in this browser.',
      });
    }
    if (!browserSupport.webMIDI) {
      pushToast({
        type: 'warning',
        message: errorMessageFromCode('midi.unavailable'),
      });
    }

    const draft = loadDraft();
    if (draft) {
      const accepted = window.confirm(
        `Restore unsaved draft from ${new Date(draft.savedAt).toLocaleString()}?`
      );
      if (accepted) {
        applyDraftState({ song: draft.song, settings: draft.settings });
        pushToast({ type: 'success', message: 'Recovered draft project.' });
      }
    }
  }, [applyDraftState, browserSupport.webAudio, browserSupport.webMIDI, pushToast]);

  const handleSaveProject = useCallback(() => {
    const text = serializeProject(song, settings);
    const safeName = song.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'song';
    downloadTextFile(text, `${safeName}.nes-daw.json`, 'application/json');
    pushToast({ type: 'success', message: 'Project saved to file.' });
  }, [settings, song, pushToast]);

  const handleLoadProject = useCallback(
    async (file: File) => {
      try {
        const loaded = await loadProjectFromFile(file);
        replaceSong(loaded.song);
        if (loaded.settings) replaceSettings(loaded.settings);
        pushToast({ type: 'success', message: `Loaded project: ${file.name}` });
      } catch (error) {
        console.error(error);
        pushToast({ type: 'error', message: errorMessageFromCode('project.corrupted') });
      }
    },
    [pushToast, replaceSettings, replaceSong]
  );

  const handleExportMidi = useCallback(() => {
    try {
      const bytes = exportMidi(song);
      const safeName = song.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'song';
      downloadBinaryFile(bytes, `${safeName}.mid`, 'audio/midi');
      pushToast({ type: 'success', message: 'MIDI export completed.' });
    } catch (error) {
      console.error(error);
      pushToast({ type: 'error', message: errorMessageFromCode('export.failed') });
    }
  }, [song, pushToast]);

  const handleExportWav = useCallback(async () => {
    try {
      setExportingWav(true);
      const data = await exportWav(song);
      const safeName = song.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'song';
      downloadBinaryFile(data, `${safeName}.wav`, 'audio/wav');
      pushToast({ type: 'success', message: 'WAV export completed.' });
    } catch (error) {
      console.error(error);
      pushToast({ type: 'error', message: errorMessageFromCode('export.failed') });
    } finally {
      setExportingWav(false);
    }
  }, [song, pushToast]);

  const handleNewProject = useCallback(() => {
    const confirmed = window.confirm('Create a new project? Unsaved changes will be replaced.');
    if (!confirmed) return;
    resetProject();
    clearDraft();
    pushToast({ type: 'info', message: 'New project created.' });
  }, [pushToast, resetProject]);

  const handleLoadStarter = useCallback(
    (templateId: 'strict-nes' | 'modern') => {
      const loaded = loadStarterTemplate(templateId, settings);
      replaceSong(loaded.song);
      replaceSettings(loaded.settings);
      completeOnboardingStep('mode');
      completeOnboardingStep('audio');
      pushToast({
        type: 'success',
        message: `Loaded ${loaded.label}.`,
      });
    },
    [completeOnboardingStep, pushToast, replaceSettings, replaceSong, settings]
  );

  const handleLoadTestSong = useCallback(async (templateId: TestProjectTemplateId) => {
    try {
      setLoadingTestSongId(templateId);
      const loaded = await loadBundledTestProject(templateId, settings);
      replaceSong(loaded.song);
      replaceSettings(loaded.settings);
      pushToast({
        type: 'success',
        message: `Loaded bundled test song: ${loaded.song.name}.`,
      });
      completeOnboardingStep('test-song');
      pushToast({
        type: 'info',
        message: loaded.attribution,
      });
      setTestSongDialogOpen(false);
    } catch (error) {
      console.error(error);
      if (error instanceof BundledMidiAssetError) {
        pushToast({
          type: 'error',
          message: `Missing bundled MIDI: ${error.path}. Add the file and retry.`,
        });
        return;
      }
      pushToast({
        type: 'error',
        message: 'Failed to load test project.',
      });
    } finally {
      setLoadingTestSongId(null);
    }
  }, [completeOnboardingStep, pushToast, replaceSettings, replaceSong, settings]);

  const handleExportReport = useCallback(() => {
    const validation = buildValidationSummary(song, settings);
    const report = buildProjectReport(song, settings, {
      previewMode: playbackPreviewMode,
      validation,
      midiProfiles,
    });
    const safeName =
      song.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'song';

    downloadTextFile(JSON.stringify(report, null, 2), `${safeName}.report.json`, 'application/json');

    if (settings.uiConfig.reportFormatDefault === 'html') {
      downloadTextFile(formatProjectReportHtml(report), `${safeName}.report.html`, 'text/html');
    } else {
      downloadTextFile(formatProjectReportMarkdown(report), `${safeName}.report.md`, 'text/markdown');
    }

    pushToast({
      type: 'success',
      message: 'Project report exported.',
    });
  }, [midiProfiles, playbackPreviewMode, pushToast, settings, song]);

  useEffect(() => {
    document.body.classList.toggle('reduced-motion', settings.accessibilityConfig.reducedMotion);
    document.body.classList.toggle('focus-contrast', settings.accessibilityConfig.highContrastFocus);
    document.body.classList.toggle('motion-off', !settings.uiConfig.motionEnabled);
  }, [
    settings.accessibilityConfig.highContrastFocus,
    settings.accessibilityConfig.reducedMotion,
    settings.uiConfig.motionEnabled,
  ]);

  useEffect(() => {
    if (!started) return;
    const timer = setTimeout(() => {
      saveDraft(song, settings);
    }, 600);

    return () => clearTimeout(timer);
  }, [song, settings, started]);

  useEffect(() => {
    const updateViewportMode = () => {
      setIsCompanionViewport(window.innerWidth < 760);
    };
    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);

  useEffect(() => {
    if (settings.mode) completeOnboardingStep('mode');
  }, [completeOnboardingStep, settings.mode]);

  useEffect(() => {
    if (started && engineReady) completeOnboardingStep('audio');
  }, [completeOnboardingStep, engineReady, started]);

  useEffect(() => {
    if (midiConnected) completeOnboardingStep('midi');
  }, [completeOnboardingStep, midiConnected]);

  useEffect(() => {
    if (song.midiProjectBindings.length > 0 || midiProfiles.some((profile) => profile.bindings.length > 0)) {
      completeOnboardingStep('controller-map');
    }
  }, [completeOnboardingStep, midiProfiles, song.midiProjectBindings.length]);

  useEffect(() => {
    const hasLoopMarkers =
      song.arrangement.sectionMarkers.some((marker) => marker.role === 'loop-start') &&
      song.arrangement.sectionMarkers.some((marker) => marker.role === 'loop-end');
    if (hasLoopMarkers) completeOnboardingStep('first-loop');
  }, [completeOnboardingStep, song.arrangement.sectionMarkers]);

  if (!started) {
    return (
      <main
        className="boot-screen"
        onClick={handleStart}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleStart();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="boot-card">
          <h1>NES DAW</h1>
          <p>Click to initialize audio and open the workstation.</p>
          <div className="boot-play">&gt;</div>
          <div className="boot-actions">
            <button
              type="button"
              className="btn"
              onClick={(event) => {
                event.stopPropagation();
                handleStart();
                handleLoadStarter('strict-nes');
              }}
            >
              Strict NES Starter
            </button>
            <button
              type="button"
              className="btn"
              onClick={(event) => {
                event.stopPropagation();
                handleStart();
                handleLoadStarter('modern');
              }}
            >
              Modern Starter
            </button>
            <button
              type="button"
              className="btn"
              onClick={(event) => {
                event.stopPropagation();
                handleStart();
                setTestSongDialogOpen(true);
              }}
            >
              Open Bundled Test Songs
            </button>
          </div>
          <small>Production Suite: strict NES + modern mode, sequencer, MIDI import/export.</small>
        </div>
      </main>
    );
  }

  return (
    <ErrorBoundary>
      <main className="app-shell">
        <TransportBar
          onPlay={play}
          onPause={pause}
          onStop={stop}
          onRecord={record}
          onNewProject={handleNewProject}
          onOpenMidiImport={() => setImportDialogOpen(true)}
          onLoadTestSong={() => setTestSongDialogOpen(true)}
          onSaveProject={handleSaveProject}
          onLoadProject={(file) => {
            void handleLoadProject(file);
          }}
          onExportMidi={handleExportMidi}
          onExportWav={() => {
            void handleExportWav();
          }}
          onExportReport={handleExportReport}
          onToggleSettings={() => setSettingsOpen(!settingsOpen)}
          onOpenHelp={() => setHelpOpen(true)}
          exportingWav={exportingWav}
        />

        {(!browserSupport.webAudio || !browserSupport.webMIDI) && (
          <div className="companion-banner">
            {!browserSupport.webAudio && 'Web Audio unavailable. Playback is disabled. '}
            {!browserSupport.webMIDI &&
              'Web MIDI unavailable in this browser. Use keyboard and mouse input instead.'}
          </div>
        )}

        {isCompanionViewport && (
          <div className="companion-banner">
            Companion mode: editing is optimized for desktop/tablet. Core playback and quick edits remain available.
          </div>
        )}

        <div className="workspace">
          <TrackPanel />

          <section className="workspace-main">
            <OnboardingChecklist
              onLoadStarter={handleLoadStarter}
              onOpenTestSongs={() => setTestSongDialogOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            <ArrangementSequencer />
            <EditorToolbar />
            <div className="piano-roll-wrap">
              <PianoRoll />
            </div>
          </section>

          <ValidationPanel />
        </div>

        <APUMonitorDock />
        <VirtualKeyboard />

        <MIDIImportDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} />
        <TestSongDialog
          open={testSongDialogOpen}
          loadingTemplateId={loadingTestSongId}
          onClose={() => setTestSongDialogOpen(false)}
          onLoadTemplate={(templateId) => {
            void handleLoadTestSong(templateId);
          }}
        />
        <HelpDialog />
        <SettingsPanel />
        <ToastCenter />

        {exportingWav && <div className="export-overlay">Rendering WAV...</div>}
      </main>
    </ErrorBoundary>
  );
}
