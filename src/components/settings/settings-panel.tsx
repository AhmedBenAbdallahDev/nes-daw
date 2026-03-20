'use client';

import { useMemo, useState } from 'react';
import {
  SHORTCUT_COMMAND_LABELS,
  eventToShortcutCombo,
  normalizeShortcutCombo,
} from '@/lib/shortcuts';
import { useDAWStore } from '@/store/daw-store';
import type { MidiBindingTarget, ShortcutCommand } from '@/types/engine';

const TABS = [
  'Audio',
  'Constraints',
  'Channels',
  'MIDI',
  'Shortcuts',
  'UI',
  'Accessibility',
] as const;

type TabKey = (typeof TABS)[number];

const MIDI_TARGETS: { key: MidiBindingTarget; label: string; trackScoped?: boolean }[] = [
  { key: 'transport.play', label: 'Transport Play' },
  { key: 'transport.stop', label: 'Transport Stop' },
  { key: 'transport.record', label: 'Transport Record' },
  { key: 'global.masterVolume', label: 'Master Volume' },
  { key: 'global.tempo', label: 'Tempo' },
  { key: 'track.volume', label: 'Track Volume', trackScoped: true },
  { key: 'track.mute', label: 'Track Mute', trackScoped: true },
  { key: 'track.solo', label: 'Track Solo', trackScoped: true },
  { key: 'selectedTrack.macro1', label: 'Selected Track Macro 1' },
  { key: 'selectedTrack.macro2', label: 'Selected Track Macro 2' },
  { key: 'selectedTrack.macro3', label: 'Selected Track Macro 3' },
  { key: 'selectedTrack.macro4', label: 'Selected Track Macro 4' },
];

export function SettingsPanel() {
  const [tab, setTab] = useState<TabKey>('Constraints');
  const [captureCommand, setCaptureCommand] = useState<ShortcutCommand | null>(null);

  const settingsOpen = useDAWStore((state) => state.settingsOpen);
  const setSettingsOpen = useDAWStore((state) => state.setSettingsOpen);
  const settings = useDAWStore((state) => state.settings);
  const setMode = useDAWStore((state) => state.setMode);
  const updateStrictConfig = useDAWStore((state) => state.updateStrictConfig);
  const updateModernConfig = useDAWStore((state) => state.updateModernConfig);
  const updateAudioConfig = useDAWStore((state) => state.updateAudioConfig);
  const updateMidiSettings = useDAWStore((state) => state.updateMidiSettings);
  const updateUISettings = useDAWStore((state) => state.updateUISettings);
  const updateAccessibilitySettings = useDAWStore((state) => state.updateAccessibilitySettings);
  const updateShortcutBinding = useDAWStore((state) => state.updateShortcutBinding);
  const resetShortcutBindings = useDAWStore((state) => state.resetShortcutBindings);
  const setTrackEngineType = useDAWStore((state) => state.setTrackEngineType);
  const startMidiLearn = useDAWStore((state) => state.startMidiLearn);
  const cancelMidiLearn = useDAWStore((state) => state.cancelMidiLearn);
  const confirmMidiLearnBinding = useDAWStore((state) => state.confirmMidiLearnBinding);
  const removeMidiBinding = useDAWStore((state) => state.removeMidiBinding);
  const setMidiChannelMap = useDAWStore((state) => state.setMidiChannelMap);
  const updateMidiProfileName = useDAWStore((state) => state.updateMidiProfileName);
  const getEffectiveMidiBindings = useDAWStore((state) => state.getEffectiveMidiBindings);
  const midiLearnSession = useDAWStore((state) => state.midiLearnSession);
  const midiLastMessage = useDAWStore((state) => state.midiLastMessage);
  const midiProfiles = useDAWStore((state) => state.midiProfiles);
  const selectedTrackId = useDAWStore((state) => state.selectedTrackId);
  const song = useDAWStore((state) => state.song);

  const effectiveMidiBindings = getEffectiveMidiBindings();
  const midiBindingConflicts = useMemo(() => {
    const map = new Map<string, number>();
    effectiveMidiBindings.forEach((binding) => {
      const sourceKey = `${binding.source.deviceId ?? '*'}:${binding.source.messageType}:${binding.source.channel}:${binding.source.controllerOrNote}`;
      map.set(sourceKey, (map.get(sourceKey) ?? 0) + 1);
    });
    return map;
  }, [effectiveMidiBindings]);

  const shortcutRows = useMemo(
    () =>
      (Object.keys(settings.shortcutConfig.bindings) as ShortcutCommand[]).map((command) => ({
        command,
        label: SHORTCUT_COMMAND_LABELS[command],
        value: settings.shortcutConfig.bindings[command],
      })),
    [settings.shortcutConfig.bindings]
  );

  if (!settingsOpen) return null;

  return (
    <aside className="settings-panel" role="dialog" aria-label="DAW Settings">
      <header className="settings-header">
        <h2>Settings</h2>
        <button type="button" className="btn btn-ghost" onClick={() => setSettingsOpen(false)}>
          Close
        </button>
      </header>

      <div className="settings-tabs" role="tablist">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={`settings-tab ${tab === name ? 'is-active' : ''}`}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {tab === 'Audio' && (
          <section className="settings-grid">
            <label className="field">
              <span>Master Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.audioConfig.masterVolume}
                onChange={(event) =>
                  updateAudioConfig({ masterVolume: parseFloat(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Latency Hint</span>
              <select
                value={settings.audioConfig.latencyHint}
                onChange={(event) =>
                  updateAudioConfig({ latencyHint: event.target.value as AudioContextLatencyCategory })
                }
              >
                <option value="interactive">Interactive</option>
                <option value="balanced">Balanced</option>
                <option value="playback">Playback</option>
              </select>
            </label>
          </section>
        )}

        {tab === 'Constraints' && (
          <section className="settings-grid">
            <div className="field-inline">
              <span>Mode</span>
              <div className="segmented">
                <button
                  type="button"
                  className={settings.mode === 'strict' ? 'is-active' : ''}
                  onClick={() => setMode('strict')}
                >
                  Strict NES
                </button>
                <button
                  type="button"
                  className={settings.mode === 'modern' ? 'is-active' : ''}
                  onClick={() => setMode('modern')}
                >
                  Modern
                </button>
              </div>
            </div>

            <label className="field-toggle">
              <input
                type="checkbox"
                checked={settings.strictConfig.enableAuthenticLimits}
                onChange={(event) =>
                  updateStrictConfig({ enableAuthenticLimits: event.target.checked })
                }
              />
              <span>Enable authentic strict limits</span>
            </label>

            <label className="field-toggle">
              <input
                type="checkbox"
                checked={settings.strictConfig.enableDpcm}
                onChange={(event) => updateStrictConfig({ enableDpcm: event.target.checked })}
              />
              <span>Enable DPCM channel in strict mode</span>
            </label>

            <label className="field">
              <span>Max polyphony per channel</span>
              <input
                type="number"
                min={1}
                max={8}
                value={settings.strictConfig.maxPolyphonyPerChannel}
                onChange={(event) =>
                  updateStrictConfig({ maxPolyphonyPerChannel: Number(event.target.value) })
                }
              />
            </label>

            <label className="field-toggle">
              <input
                type="checkbox"
                checked={settings.strictConfig.enforceChannelUniqueness}
                onChange={(event) =>
                  updateStrictConfig({ enforceChannelUniqueness: event.target.checked })
                }
              />
              <span>Enforce unique strict channels</span>
            </label>

            <label className="field">
              <span>Modern mode max tracks</span>
              <input
                type="number"
                min={5}
                max={64}
                value={settings.modernConfig.maxTracks}
                onChange={(event) =>
                  updateModernConfig({
                    maxTracks: Math.max(5, Math.min(64, Number(event.target.value))),
                  })
                }
              />
            </label>
          </section>
        )}

        {tab === 'Channels' && (
          <section className="settings-grid">
            <p className="muted">
              Strict tracks are channel-locked. In Modern mode, set modern track synth engines from here.
            </p>
            {song.tracks.map((track) => (
              <label key={track.id} className="field">
                <span>{track.name}</span>
                <select
                  disabled={track.channel !== 'modern'}
                  value={track.engineType}
                  onChange={(event) => setTrackEngineType(track.id, event.target.value as typeof track.engineType)}
                >
                  <option value="saw">Saw</option>
                  <option value="sine">Sine</option>
                  <option value="fm-lite">FM-lite</option>
                  <option value="modern-noise">Modern Noise</option>
                </select>
              </label>
            ))}
          </section>
        )}

        {tab === 'MIDI' && (
          <section className="settings-grid">
            <label className="field">
              <span>Default MIDI Quantize</span>
              <select
                value={settings.midiConfig.defaultQuantize}
                onChange={(event) =>
                  updateMidiSettings({ defaultQuantize: event.target.value as typeof settings.midiConfig.defaultQuantize })
                }
              >
                <option value="1/4">1/4</option>
                <option value="1/8">1/8</option>
                <option value="1/16">1/16</option>
                <option value="1/32">1/32</option>
              </select>
            </label>

            <label className="field">
              <span>Input Routing Mode</span>
              <select
                value={settings.midiConfig.routingMode}
                onChange={(event) =>
                  updateMidiSettings({
                    routingMode: event.target.value as typeof settings.midiConfig.routingMode,
                  })
                }
              >
                <option value="selected-track">Selected Track</option>
                <option value="omni">Omni</option>
                <option value="channel-map">Channel Map</option>
              </select>
            </label>

            <label className="field">
              <span>Default Transpose</span>
              <input
                type="number"
                min={-24}
                max={24}
                value={settings.midiConfig.defaultTranspose}
                onChange={(event) => updateMidiSettings({ defaultTranspose: Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>MIDI Learn Timeout (ms)</span>
              <input
                type="number"
                min={1500}
                max={30000}
                step={250}
                value={settings.midiConfig.learnTimeoutMs}
                onChange={(event) =>
                  updateMidiSettings({
                    learnTimeoutMs: Math.max(1500, Number(event.target.value)),
                  })
                }
              />
            </label>
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={settings.midiConfig.autoMapPercussionToNoise}
                onChange={(event) =>
                  updateMidiSettings({ autoMapPercussionToNoise: event.target.checked })
                }
              />
              <span>Auto-map percussion tracks to noise channel</span>
            </label>
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={settings.midiConfig.transportRealtimeEnabled}
                onChange={(event) =>
                  updateMidiSettings({ transportRealtimeEnabled: event.target.checked })
                }
              />
              <span>Enable MIDI realtime Start/Stop/Continue</span>
            </label>
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={settings.midiConfig.writeAutomationOnRecord}
                onChange={(event) =>
                  updateMidiSettings({ writeAutomationOnRecord: event.target.checked })
                }
              />
              <span>Write mapped controls as automation while recording</span>
            </label>

            <label className="field">
              <span>Profile Preference</span>
              <select
                value={settings.midiConfig.profilePreference}
                onChange={(event) =>
                  updateMidiSettings({
                    profilePreference: event.target.value as typeof settings.midiConfig.profilePreference,
                  })
                }
              >
                <option value="project-first">Project overrides first</option>
                <option value="device-first">Device profile first</option>
              </select>
            </label>

            {midiProfiles.length > 0 && (
              <>
                <label className="field">
                  <span>Selected Device Profile</span>
                  <select
                    value={settings.midiConfig.selectedProfileId ?? ''}
                    onChange={(event) =>
                      updateMidiSettings({
                        selectedProfileId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">Auto by connected device</option>
                    {midiProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="profile-list">
                  {midiProfiles.map((profile) => (
                    <label key={profile.id} className="field">
                      <span>Profile Name ({profile.bindings.length} bindings)</span>
                      <input
                        className="input"
                        value={profile.name}
                        onChange={(event) => updateMidiProfileName(profile.id, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </>
            )}

            <div className="midi-live-monitor">
              <h3>Incoming MIDI Monitor</h3>
              {midiLastMessage ? (
                <p className="muted">
                  {midiLastMessage.deviceName ?? 'Unknown device'} | {midiLastMessage.messageType} | ch{' '}
                  {midiLastMessage.channel ?? '-'} | ctl/note{' '}
                  {midiLastMessage.controller ?? midiLastMessage.note ?? '-'} | value{' '}
                  {midiLastMessage.value}
                </p>
              ) : (
                <p className="muted">Move a knob, wheel, key, or button to inspect live MIDI input.</p>
              )}
            </div>

            <div className="midi-learn-grid">
              {MIDI_TARGETS.map((target) => {
                const active = midiLearnSession.target === target.key;
                const binding = effectiveMidiBindings.find(
                  (item) =>
                    item.target === target.key &&
                    ((item.trackId ?? null) === (target.trackScoped ? selectedTrackId : null))
                );
                const sourceKey = binding
                  ? `${binding.source.deviceId ?? '*'}:${binding.source.messageType}:${binding.source.channel}:${binding.source.controllerOrNote}`
                  : '';
                const conflictCount = binding ? midiBindingConflicts.get(sourceKey) ?? 0 : 0;

                return (
                  <div key={target.key} className="midi-learn-row">
                    <div>
                      <strong>{target.label}</strong>
                      <p className="muted">
                        {binding
                          ? `${binding.source.messageType} ${binding.source.controllerOrNote ?? ''} (ch ${binding.source.channel})`
                          : 'Unmapped'}
                        {conflictCount > 1 ? ` | conflict x${conflictCount}` : ''}
                      </p>
                    </div>
                    <div className="midi-learn-actions">
                      <button
                        type="button"
                        className={`btn btn-ghost ${active && midiLearnSession.state === 'listening' ? 'is-capturing' : ''}`}
                        onClick={() =>
                          startMidiLearn(target.key, target.trackScoped ? selectedTrackId : null)
                        }
                      >
                        {active && midiLearnSession.state === 'listening'
                          ? 'Listening...'
                          : 'Detect'}
                      </button>
                      {binding && (
                        <button
                          type="button"
                          className="btn btn-ghost danger"
                          onClick={() => removeMidiBinding(binding.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {midiLearnSession.state === 'captured' && midiLearnSession.captured && (
                <div className="midi-capture-panel">
                  <p className="muted">
                    Captured {midiLearnSession.captured.messageType} from channel{' '}
                    {midiLearnSession.captured.channel ?? '-'}.
                  </p>
                  <div className="midi-learn-actions">
                    <button type="button" className="btn" onClick={confirmMidiLearnBinding}>
                      Confirm Mapping
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={cancelMidiLearn}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {midiLearnSession.state === 'timeout' && (
                <div className="shortcut-warning">
                  <span>{midiLearnSession.error ?? 'MIDI learn timed out.'}</span>
                </div>
              )}
            </div>

            <div className="channel-map-grid">
              <h3>MIDI Channel Map</h3>
              <p className="muted">Used in Channel Map/Omni modes to route incoming MIDI channels to tracks.</p>
              {Array.from({ length: 16 }, (_, index) => {
                const channel = index + 1;
                const mapped = song.midiChannelMap[channel] ?? '';
                return (
                  <label key={channel} className="field-inline">
                    <span>CH {channel}</span>
                    <select
                      value={mapped}
                      onChange={(event) =>
                        setMidiChannelMap(channel, event.target.value || null)
                      }
                    >
                      <option value="">Unmapped</option>
                      {song.tracks.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.name} ({track.channel})
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {tab === 'Shortcuts' && (
          <section className="settings-grid">
            <div className="shortcut-warning">
              {settings.shortcutConfig.conflicts.length > 0 ? (
                <span>
                  Conflicts:{' '}
                  {settings.shortcutConfig.conflicts
                    .map((conflict) => `${conflict.combo} (${conflict.commands.join(', ')})`)
                    .join(' | ')}
                </span>
              ) : (
                <span>No shortcut conflicts detected.</span>
              )}
            </div>

            {shortcutRows.map((row) => (
              <div key={row.command} className="shortcut-row">
                <span>{row.label}</span>
                <button
                  type="button"
                  className={`btn btn-ghost ${captureCommand === row.command ? 'is-capturing' : ''}`}
                  onClick={() => setCaptureCommand(row.command)}
                  onKeyDown={(event) => {
                    if (captureCommand !== row.command) return;
                    event.preventDefault();
                    if (event.key === 'Escape') {
                      setCaptureCommand(null);
                      return;
                    }
                    const combo = normalizeShortcutCombo(eventToShortcutCombo(event.nativeEvent));
                    if (!combo) return;
                    updateShortcutBinding(row.command, combo);
                    setCaptureCommand(null);
                  }}
                >
                  {captureCommand === row.command ? 'Press keys...' : row.value}
                </button>
              </div>
            ))}

            <button type="button" className="btn" onClick={resetShortcutBindings}>
              Reset to defaults
            </button>
          </section>
        )}

        {tab === 'UI' && (
          <section className="settings-grid">
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={settings.uiConfig.motionEnabled}
                onChange={(event) => updateUISettings({ motionEnabled: event.target.checked })}
              />
              <span>Enable micro-interactions and animations</span>
            </label>
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={settings.uiConfig.showOnboardingChecklist}
                onChange={(event) =>
                  updateUISettings({ showOnboardingChecklist: event.target.checked })
                }
              />
              <span>Show Start Here checklist</span>
            </label>
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={settings.uiConfig.monitorDockVisible}
                onChange={(event) =>
                  updateUISettings({ monitorDockVisible: event.target.checked })
                }
              />
              <span>Show APU monitor dock</span>
            </label>
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={settings.uiConfig.validationPanelVisible}
                onChange={(event) =>
                  updateUISettings({ validationPanelVisible: event.target.checked })
                }
              />
              <span>Show constraint inspector</span>
            </label>
            <label className="field">
              <span>Density</span>
              <select
                value={settings.uiConfig.density}
                onChange={(event) =>
                  updateUISettings({ density: event.target.value as typeof settings.uiConfig.density })
                }
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label className="field">
              <span>Report Format</span>
              <select
                value={settings.uiConfig.reportFormatDefault}
                onChange={(event) =>
                  updateUISettings({
                    reportFormatDefault: event.target.value as typeof settings.uiConfig.reportFormatDefault,
                  })
                }
              >
                <option value="markdown">Markdown + JSON</option>
                <option value="html">HTML + JSON</option>
              </select>
            </label>
          </section>
        )}

        {tab === 'Accessibility' && (
          <section className="settings-grid">
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={settings.accessibilityConfig.reducedMotion}
                onChange={(event) =>
                  updateAccessibilitySettings({ reducedMotion: event.target.checked })
                }
              />
              <span>Prefer reduced motion</span>
            </label>
            <label className="field-toggle">
              <input
                type="checkbox"
                checked={settings.accessibilityConfig.highContrastFocus}
                onChange={(event) =>
                  updateAccessibilitySettings({ highContrastFocus: event.target.checked })
                }
              />
              <span>High-contrast focus rings</span>
            </label>
          </section>
        )}
      </div>
    </aside>
  );
}
