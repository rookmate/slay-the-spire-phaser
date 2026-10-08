# slay-the-spire

A TypeScript/Phaser implementation of the original Slay the Spire's deckbuilding
and campaign rules. The current playable character is Ironclad. The campaign
includes all three acts, Ascension 0–20, and the key route to Act 4.

This remains a work in progress. Character selection, the remaining characters,
and the complete shared item/event catalog are the next stage. Enemy portraits
and the interface still use prototype artwork.

## Stack

- TypeScript
- Phaser
- Vite
- Vitest and Playwright

## Running locally

Use Node.js 22.12+ on the 22.x line, Node.js 24.x, or Node.js 26+.

```bash
npm install
npm run dev
```

## Other useful commands

```bash
npm run build
npm run test
npm run preview
```

Runs are saved at room entry and completion. Continue restarts an unfinished
fight from its entry checkpoint, including its original potions and relic counters. Active play time is saved
separately so the timer does not overwrite a combat checkpoint.
Won fights save before reward selection; unfinished reward choices restart without
duplicating gold or relics. Shops save purchases and remaining stock together.

## Browser checks

```bash
npx playwright install chromium
npm run test:browser
```

The browser suite starts Vite on port 5174 and uses real mouse clicks and drags.
It covers combat, card selection across pages, crowded encounters, campfire exits,
rewards, defeat, and saved-run reloads. A seeded run starts with the normal starter
deck, earns its cards and relics, and plays through all three acts. Its route and result
are attached to the Playwright report. Smaller scenarios use explicit saved-run
fixtures to exercise edge cases quickly.

`tests/browser/index.html` starts the same game factory and scenes as the app.
The test entry exposes the game for read-only inspection; it is excluded from the
production build. Tests set up saved runs before pressing Continue and make all
subsequent gameplay choices through the UI.

GitHub Actions runs unit tests, the production build, and browser checks on pull
requests and pushes to master. Failed browser checks upload screenshots, traces,
and the HTML report. Open a local report with `npx playwright show-report`.

## Current status

- 75 Ironclad cards, plus the colorless cards needed by the current shops/events.
- Act-specific encounters and bosses, including phase changes, summons, Stasis,
  Time Warp, Surrounded, and the Heart's damage cap.
- Branching act maps, burning elites, three keys, A20's second Act 3 boss, and
  the final rest/shop/elite/Heart sequence.
- Merchant stock, discounts, removal, Courier restocking, and Orrery rewards.
- Neow blessings, 26 events, event combat, and saved multi-step choices.
- Ascension thresholds, card rarity offsets, potion drop chances, chest sizes,
  and reward claiming across reloads.

The progression/unlock track is still the earlier prototype's track. The next
stage replaces it with per-character progression and adds the remaining cards,
relics, potions, events, run modes, history, settings, sound, and presentation.
This is not yet full content parity with the original game.

Rules were checked against the original-game references for
[Ascension](https://slaythespire.wiki.gg/wiki/Ascension),
[map generation](https://slaythespire.wiki.gg/wiki/Map_Generation),
[Neow](https://slaythespire.wiki.gg/wiki/Neow),
[card rewards](https://slay-the-spire.fandom.com/wiki/Card_Rewards),
[the merchant](https://slay-the-spire.fandom.com/wiki/Merchant), and
[chests](https://slaythespire.wiki.gg/wiki/Chests).
Seeds reproduce this implementation's runs; they do not reproduce the original
game's RNG stream.
