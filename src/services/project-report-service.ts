import type {
  AppSettings,
  MidiProfile,
  PlaybackPreviewMode,
  ProjectReport,
  Song,
  ValidationSummary,
} from '@/types/engine';
import { buildValidationSummary } from './validation-service';

export function buildProjectReport(
  song: Song,
  settings: AppSettings,
  options?: {
    previewMode?: PlaybackPreviewMode;
    validation?: ValidationSummary;
    midiProfiles?: MidiProfile[];
  }
): ProjectReport {
  const validation = options?.validation ?? buildValidationSummary(song, settings);
  const previewMode = options?.previewMode ?? 'full-song';
  const midiProfiles = options?.midiProfiles ?? [];

  return {
    generatedAt: new Date().toISOString(),
    songName: song.name,
    mode: settings.mode,
    bpm: song.bpm,
    previewMode,
    trackCount: song.tracks.length,
    markers: song.arrangement.sectionMarkers.map((marker) => ({
      label: marker.label,
      role: marker.role,
      startTick: marker.startTick,
    })),
    midiProfiles: midiProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      bindingCount: profile.bindings.length,
    })),
    bindings: song.midiProjectBindings.map((binding) => ({
      label: binding.label,
      target: binding.target,
      trackId: binding.trackId,
    })),
    validation,
    exportNotes: [
      `Preview mode: ${previewMode}`,
      `Validation issues: ${validation.errorCount} errors, ${validation.warningCount} warnings, ${validation.infoCount} info.`,
      settings.mode === 'strict'
        ? 'Strict NES mode is active. Keep an eye on polyphony and channel roles.'
        : 'Modern mode is active. Expanded engines and channels are available.',
    ],
  };
}

export function formatProjectReportMarkdown(report: ProjectReport): string {
  const lines = [
    `# ${report.songName} Project Report`,
    '',
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `BPM: ${report.bpm}`,
    `Preview Mode: ${report.previewMode}`,
    `Track Count: ${report.trackCount}`,
    '',
    '## Markers',
    ...report.markers.map((marker) => `- ${marker.label} (${marker.role ?? 'custom'}) @ ${marker.startTick}`),
    '',
    '## MIDI Profiles',
    ...(report.midiProfiles.length > 0
      ? report.midiProfiles.map((profile) => `- ${profile.name}: ${profile.bindingCount} bindings`)
      : ['- None']),
    '',
    '## Project Bindings',
    ...(report.bindings.length > 0
      ? report.bindings.map((binding) => `- ${binding.label} -> ${binding.target}`)
      : ['- None']),
    '',
    `## Validation Summary`,
    `- Errors: ${report.validation.errorCount}`,
    `- Warnings: ${report.validation.warningCount}`,
    `- Info: ${report.validation.infoCount}`,
    ...report.validation.issues.map((issue) => `- [${issue.severity}] ${issue.message}`),
    '',
    '## Notes',
    ...report.exportNotes.map((note) => `- ${note}`),
    '',
  ];

  return lines.join('\n');
}

export function formatProjectReportHtml(report: ProjectReport): string {
  const escape = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(report.songName)} Report</title>
    <style>
      body { font-family: sans-serif; margin: 24px; background: #0b1020; color: #eef3ff; }
      h1, h2 { color: #9ae6b4; }
      .card { background: #121833; border: 1px solid #2d3f72; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
      ul { padding-left: 20px; }
    </style>
  </head>
  <body>
    <h1>${escape(report.songName)} Project Report</h1>
    <div class="card">
      <p>Generated: ${escape(report.generatedAt)}</p>
      <p>Mode: ${escape(report.mode)}</p>
      <p>BPM: ${report.bpm}</p>
      <p>Preview Mode: ${escape(report.previewMode)}</p>
      <p>Track Count: ${report.trackCount}</p>
    </div>
    <div class="card">
      <h2>Validation</h2>
      <ul>${report.validation.issues
        .map((issue) => `<li>[${escape(issue.severity)}] ${escape(issue.message)}</li>`)
        .join('')}</ul>
    </div>
  </body>
</html>`;
}
