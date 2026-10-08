# slay-the-spire

This is a personal project where I'm playing around with game dev ideas by building a small deckbuilder / roguelike prototype inspired by *Slay the Spire*.

It's not meant to be a polished or production-ready clone. The goal is to experiment with systems like:

- turn-based combat
- cards, relics, events, and map flow
- run state and progression
- scene management and UI in Phaser

## Disclaimer

This repo is just me tinkering with game dev stuff, testing mechanics, and learning as I go.

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
fight from its entry checkpoint, including its original potions and relic counters.
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
deck, earns its cards and relics, and plays through both acts. Its route and result
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

The project already includes core run/combat logic and multiple scenes, and it's still actively being expanded with more cards, encounters, events, and polish.
