# NES DAW Extended Suite

Browser-based DAW for NES-inspired music with two production modes:
- **Strict NES**: pulse1/pulse2/triangle/noise/dpcm constraints.
- **Modern**: extra synth engines and flexible tracks.

Built with Next.js + React + TypeScript + Zustand + Web Audio API.

## Current Feature Set

### Audio & Transport
- Unified transport command bus (`play/pause/stop/record/seek`)
- Stable scheduler sync across UI, shortcuts, and playback state
- NES channels + DPCM-like channel path + modern synth engines
- Looping, quantize, BPM control, arrangement-aware playback

### Composition
- Piano roll editing: add/move/resize/delete notes
- Pattern arrangement sequencer with section markers
- Track management: mute/solo/volume, engine/instrument selection
- Editor quick tools: duplicate, quantize selected, nudge, transpose

### Input
- Computer keyboard performance mode
- Web MIDI device input with record capture
- MIDI controller mapping with learn/detect flow (CC, pitch bend, aftertouch, transport realtime)
- Routing modes: Selected Track / Omni / Channel Map (1-16 manual routing)
- Per-device profile bindings + project-level MIDI binding overrides
- Virtual keyboard
- Customizable shortcut map with conflict detection and persistence

### Import / Export / Persistence
- Advanced MIDI file import wizard (track mapping, transpose, quantize, clamp, velocity scale)
- MIDI export
- WAV offline bounce
- Project JSON save/load with schema migration support
- Auto-draft persistence in local storage with restore prompt
- Bundled test song loader for Mega Man 2/3/4 templates via local MIDI pack

### Bundled Mega Man Test MIDI Pack

To bundle and load the three test songs, add authorized MIDI files to:

- `public/midi/megaman/mega-man-2.mid`
- `public/midi/megaman/mega-man-3.mid`
- `public/midi/megaman/mega-man-4-title.mid`

Then use the **Test Songs** button in the transport or startup screen.

### UX & Accessibility
- Settings panel with tabs (Audio, Constraints, Channels, MIDI, Shortcuts, UI, Accessibility)
- Help dialog and shortcut cheat-sheet
- Toast feedback + error boundary
- Desktop/tablet responsive layout + companion banner on narrow screens
- Reduced-motion and high-contrast focus toggles

## Keyboard Shortcuts (Defaults)

- `Space`: Play/Pause
- `Shift+Space`: Stop
- `Shift+R`: Record
- `Shift+L`: Loop toggle
- `Shift+Q`: Quantize grid cycle
- `Delete`: Delete selected notes
- `Ctrl+D`: Duplicate selected notes
- `Alt+ArrowLeft/Right`: Nudge selected notes
- `Alt+ArrowUp/Down`: Transpose selected notes
- `Ctrl+Z`: Undo
- `Ctrl+Shift+Z`: Redo
- `,`: Toggle settings
- `/`: Toggle help

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Zustand 5
- Tailwind CSS 4 (global CSS tokenized design system)
- @tonejs/midi (MIDI file parse/export)

## Development

### Prerequisites
- Node.js 18+
- npm or bun

### Install

```bash
npm install
# or
bun install
```

### Run

```bash
npm run dev
# or
bun run dev
```

### Quality Gates

```bash
npm run lint
npm run test
npm run build
npm run verify
```

`verify` runs lint + tests + production build.

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs:
- lint
- tests
- build

## Project Structure

```text
src/
  app/                     # app shell + global styles
  audio/                   # engine, scheduler, transport controller, note scheduling
  components/
    arrangement/           # pattern timeline
    common/                # toasts, error boundary, help dialog
    editor/                # editor quick actions
    import/                # MIDI import wizard
    instruments/           # virtual keyboard
    piano-roll/            # main note editor
    settings/              # settings UI
    tracks/                # track/channel controls
    transport/             # transport + file operations bar
  hooks/                   # UI-engine integration hooks
  lib/                     # constants, shortcut utilities, song utilities
  services/                # import/export, project IO, draft storage, wav export
  store/                   # Zustand DAW state/actions
  types/                   # core contracts
```

## Browser Notes

- Web Audio API required for playback.
- Web MIDI API availability varies by browser/platform.
- When MIDI API is unavailable, app still works with keyboard + mouse input.

## License

MIT
