# Release validation

The development regression suite covers the complete campaign and detailed
interactions in Chromium. The release smoke suite serves `dist/` through Vite
preview and uses the shipped page, canvas and semantic controls. It neither
ships nor reads the `window.__testGame` test bridge.

```bash
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run test:release
```

`test:release` builds the app first. To run one engine, append
`-- --project=webkit`, `-- --project=firefox`, or `-- --project=chromium`.
Each CI engine runs in its own job, with no retries. Reports and screenshots
are uploaded as `release-<browser>` artifacts for seven days.

## Automated checks

- All four characters start a seeded run through Neow and the map, play a card,
  end a turn, and reload the saved combat entry.
- Production scripts, fonts and card-art requests load without HTTP errors.
- Keyboard navigation reaches the guide, searches rules, and restores focus.
- Settings persist, profile JSON downloads, and the exported profile imports.
- Native touch taps open settings, export a profile and end turns. A dispatched
  DOM touch-drag sequence plays a targeted card through the canvas input handler.
  Portrait blocks play until rotation to landscape, both at startup and during
  combat. The canvas fits the landscape viewport.
- A user gesture unlocks an actual Web Audio context in each browser engine.

These are correctness checks, not loading, FPS or battery benchmarks. A running
audio context does not establish that output is audible on a physical device.
Touch emulation and desktop WebKit do not establish iPhone Safari compatibility.

## Checks requiring a device or deployment

Record the browser/OS, build commit and outcome when completing these checks.
Do not mark them complete from the automated results above.

- [ ] Physical iPhone Safari: rotate before and during combat, target an enemy,
  inspect a long card, open/close menus, and continue after app switching.
- [ ] Physical iPhone: hear audio after the first gesture, mute/unmute, and test
  interruptions from device lock and another audio app.
- [ ] Physical iPhone: save an exported profile to Files, reload the game, then
  select that file and restore its checkpoint.
- [ ] VoiceOver or another screen reader: reach character selection, hear full
  card rules and enemy intent, select a target, hear the changed combat status,
  and close a modal with focus restored. Check recovery dialogs too.
- [ ] Hosted HTTPS build: verify asset paths, response compression and caching,
  cold loading, failed requests, reloads, and profile ownership between tabs.
- [ ] Foreground physical-device profiling: loading, responsiveness, sustained
  frame rate and battery use. Use the in-app browser or computer use for these
  measurements, as requested for this project.

There is no deployment yet. Agent device access is disabled in the current
environment, and no actual screen-reader session has been verified.
