# slay-the-spire

A TypeScript/Phaser fan recreation of the original Slay the Spire. Play Ironclad,
Silent, Defect, or Watcher through three acts, Ascension 0–20, and the key route to
the Heart. The rules and content are implemented locally; this is an independent
recreation, not a replacement for the commercial game.

## Running locally

Use Node.js 22.12+ on the 22.x line, Node.js 24.x, or Node.js 26+.

```bash
npm install
npm run dev
npm test
npm run build
```

## Playable content

- 75 cards per character, 35 reward-pool colorless cards, and event, status, Curse,
  and generated cards. Includes poison, discard, orbs, Focus, stances, Mantra,
  Scry, Retain, and queued card choices and repeats.
- Character and shared relics, all 42 potions, and 51 random events. Multi-step
  acquisitions, bottles, transformations, event combat, and Match and Keep save
  their outstanding choices.
- Act-specific encounters and bosses, branching maps, burning elites, three keys,
  A20's second Act 3 boss, and the final rest/shop/elite/Heart sequence.
- Merchant stock, discounts, removal, Courier restocking, Orrery, campfire relic
  actions, and a choice to leave chests closed.
- Five XP unlock tiers and Ascension progression for each character, card library,
  score breakdowns, and the last 500 runs in local history.
- Standard, seeded, local daily, and custom runs. Custom modifiers include
  Draft, Sealed Deck, mixed card pools, Endless, and Blight Chests.
- Character portraits, orb and stance displays, keyboard card selection, potion
  descriptions and discard controls, inventory, sound cues, and reduced motion.

Drag cards upward or onto an enemy. Keys 1–0 select cards, E ends the turn, and
Escape cancels targeting. Targeted cards and potions require an enemy selection.
Use **Bag** between fights to inspect your deck and relics, discard potions, or
use potions that work outside combat.

## Saves and progression

Runs are saved at room entry and completion. Continue restarts an unfinished
fight from its entry checkpoint, including its original potions and relic
counters. Active play time is saved separately so the timer cannot overwrite a
combat checkpoint. Won fights and outstanding reward choices save without
duplicating gold or relics. Shops save purchases and stock together.

Content XP is earned across run modes. Standard runs advance Ascension and key
progression. Seeded runs reproduce this implementation's rules and RNG; a seed
from the commercial game will produce a different run. Daily challenges use a
UTC date and save scores on this device. Saves and profiles use browser local
storage; clearing browser data removes them.

## Campaign regression checks

Core tests replay fixed three-act victories for Ironclad, Silent, Defect, and
Watcher from their normal starter decks and Neow options. The player acquires
cards, relics, and potions through game actions. Room entry, chest opening,
combat outcomes, and reward claims use the same core functions as the scenes.
Every room checkpoint is serialized and restored; tests check legal actions,
unique card ownership, score statistics, and finite progress. The strategies
live in `tests/support` and are deliberately limited test players.

## Browser checks

```bash
npx playwright install chromium
npm run test:browser
```

The suite starts Vite on port 5174 and drives the game through mouse clicks and
drags. It covers combat, all characters, card-selection pages, crowded encounters,
potion replacement, draft selections, events, the A20/Heart route, and reloads.
A seeded starter-deck run earns its cards and relics and plays all three acts;
its route and result are attached to the Playwright report. Smaller tests use
explicit saved-run fixtures to exercise edge cases quickly.

`tests/browser/index.html` starts the production game factory and scenes with a
read-only inspector. That entry is excluded from the production build. Tests
prepare local-storage fixtures before Continue; subsequent gameplay uses the UI.
GitHub Actions runs core tests, the build, and browser checks on PRs and pushes to
master. Failed checks upload screenshots, traces, and an HTML report.

## Remaining differences

The original artwork, animations, music, achievement system, official daily
leaderboards, platform integrations, and cloud saves are not reproduced. Some
enemies share portraits or use generated placeholders; character art and sound
cues are simplified. Scores, rare event eligibility, and modifier combinations
still need broader comparison with the original. The test suite covers many
interactions, not every possible card/relic/enemy combination.

Rules were checked against original-game references for
[Ascension](https://slaythespire.wiki.gg/wiki/Ascension),
[map generation](https://slaythespire.wiki.gg/wiki/Map_Generation),
[Neow](https://slaythespire.wiki.gg/wiki/Neow),
[card rewards](https://slay-the-spire.fandom.com/wiki/Card_Rewards),
[events](https://slaythespire.wiki.gg/wiki/Events),
[potions](https://slaythespire.wiki.gg/wiki/Potions), and
[custom modes](https://slaythespire.wiki.gg/wiki/Custom_Mode).

Presentation uses original SVG portraits for all four characters and all 68 enemy IDs. Each act has its own combat backdrop and synthesized musical theme. Settings control master, music, and effects volume separately; reduced motion disables shakes, flashes, and impact motion. Audio starts after a click or keypress and pauses in hidden tabs.

Hover a card, tap its `?`, or press Alt+1–0 in combat to read its complete rules. Escape closes hand inspection. The inspection button also works on locked cards and inside card-choice dialogs.
