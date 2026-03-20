# Release Checklist

## Functional
- [ ] Transport controls: play/pause/stop/record/seek/loop
- [ ] Keyboard shortcuts: defaults + custom bindings + conflict warnings
- [ ] MIDI device input + MIDI file import mapping
- [ ] MIDI Learn detect/capture/confirm flow for mapped targets
- [ ] MIDI realtime Start/Stop/Continue transport sync
- [ ] MIDI routing modes (Selected / Omni / Channel Map) validated on hardware
- [ ] CC/Aftertouch/Pitch Bend mapped targets verified
- [ ] Automation write from mapped controls during recording
- [ ] Arrangement timeline drag/add/remove behavior
- [ ] Project save/load roundtrip
- [ ] MIDI + WAV export success
- [ ] Load Test Song action loads starter project with expected channel map

## UI/UX
- [ ] Focus states visible with keyboard only navigation
- [ ] Companion mode banner shown on narrow screens
- [ ] Settings panel tabs and controls usable by keyboard
- [ ] MIDI monitor and mapping controls readable on tablet viewport
- [ ] Learn-state animation respects reduced-motion toggle
- [ ] Help dialog content accurate with current shortcuts
- [ ] Reduced-motion and high-contrast toggles applied

## Technical
- [ ] Project schema migration from v1/v2 to v3 verified
- [ ] MIDI profile persistence and project override precedence verified
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] GitHub Actions CI passing
