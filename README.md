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
- Vitest

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

## Current status

The project already includes core run/combat logic and multiple scenes, and it's still actively being expanded with more cards, encounters, events, and polish.
