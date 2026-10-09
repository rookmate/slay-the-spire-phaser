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
- Weighted act-specific encounters, hallway and elite repeat restrictions, variable
  enemy groups, branching maps, burning elites, three keys,
  A20's second Act 3 boss, and the final rest/shop/elite/Heart sequence.
- Merchant stock, discounts, removal, Courier restocking, Orrery, campfire relic
  actions, and a choice to leave chests closed.
- All four characters and their complete card collections are available immediately,
  including in existing saves and imported profiles. Relic XP tiers and Ascension
  progression remain per character, with a card library,
  score breakdowns, and the last 500 runs in local history.
- Standard, seeded, local daily, and custom runs. Custom modifiers include
  Draft, Sealed Deck, mixed card pools, Endless, and Blight Chests.
- Character portraits, orb and stance displays, keyboard card selection, potion
  descriptions and discard controls, inventory, sound cues, and reduced motion.

Drag cards upward or onto an enemy. Keys 1–0 select cards, E ends the turn, and
Escape cancels targeting. Targeted cards and potions require an enemy selection.
In combat, Menu or Escape with no open overlay pauses the fight. Resume keeps
the current turn and any card choice; Settings returns to the paused fight.
Leaving to the main menu preserves the room-entry save, so Continue restarts
that fight. The run timer stops while the menu or its settings are open.
Use **Bag** between fights to inspect your deck and relics, discard potions, or
use potions that work outside combat.

On phones, play in landscape. Portrait mode shows a rotate prompt and pauses
the current screen, including the run timer and any pending card choice.
Rotating back resumes that screen; it does not dismiss an open combat menu.
The canvas leaves room for device safe areas and adapts to the browser's visible height.

## Saves and progression

Runs are saved at room entry and completion. Continue restarts an unfinished
fight from its entry checkpoint, including its original potions and relic
counters. Active play time is saved separately so the timer cannot overwrite a
combat checkpoint. Enemy lineups are fixed at room entry. Older saves preserve
the unfinished fight and begin tracking encounter history from that point. Won fights and outstanding reward choices save without
duplicating gold or relics. Shops save purchases and stock together.

XP is earned across run modes and continues relic progression. Cards do not
require XP unlocks. Standard runs advance Ascension and key
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
A seeded starter-deck run uses keyboard card controls, earns its cards and relics,
and plays all three acts;
its route and result are attached to the Playwright report. Smaller tests use
explicit saved-run fixtures to exercise edge cases quickly.

The long campaign has a 15-minute limit and no automatic retry. Its trace keeps
actions and source references without capturing a screenshot or DOM snapshot on
every action; failure screenshots and the route log remain enabled. Dedicated
drag, targeting, and animation tests retain full traces.

`tests/browser/index.html` starts the production game factory and scenes with a
read-only inspector. That entry is excluded from the production build. Tests
prepare local-storage fixtures before Continue; subsequent gameplay uses the UI.
GitHub Actions runs core tests, the build, and browser checks on PRs and pushes to
master. Failed checks upload screenshots, traces, and an HTML report.

## Performance checks

`npm run test:performance` builds the shipping app and a separate minified combat
fixture, then serves both with Vite preview. It records three cold starts at
10 Mbps download, 40 ms latency and 4× CPU slowdown, and three ten-card fights
against five enemies at 844×390. Cold loading is measured separately with gzip
JavaScript/CSS and uncompressed delivery. Vite preview supplies gzip
locally; configure compression on the actual deployment host as well.

The opt-in benchmark requires one final UI refresh per card play and no
replacement of unchanged hand views. CI limits font downloads to 130 KB, gzip startup resources to
2 MB, uncompressed resources to 3.2 MB, and named artwork texture backing to
32 MiB. Texture bytes estimate RGBA backing, excluding text, CPU copies and
driver overhead. CI checks gameplay, allocations, lifecycle, and built asset
sizes. Browser timing measurements are an opt-in local check; JSON samples are
written to `performance-results`.
`PERFORMANCE_TIMING=1 npm run test:performance` also enforces p95 interaction
samples ≤200 ms, p95 application frame work ≤10 ms, p95 discrete UI refresh
work ≤50 ms, and p75 cold menu readiness ≤2.5 seconds with gzip delivery. Run timing comparisons on the same idle machine; shared CI runner
speeds vary. The reference host is an Intel Core i7-12700H running Chromium with
4× CPU throttling. `PERFORMANCE_BASELINE=1` records the pre-optimization allocation
counts without enforcing the new allocation limits.

The interaction and frame targets follow [Web Vitals](https://web.dev/articles/vitals)
and [rendering guidance](https://web.dev/articles/rendering-performance). The
`spire:menu-ready` mark records the first rendered menu in the shipping build.
It is a custom canvas readiness metric, not LCP. Vite preview compresses its
JavaScript by default; earlier notes describing it as uncompressed were incorrect. Event Timing samples are lab
interaction measurements, not field INP; actual frame intervals and long tasks
are reported separately. Software graphics, CPU throttling and automation do
not establish physical-phone FPS, battery use or field Core Web Vitals compliance.

Idle work is event-driven: settings are cached as independent snapshots and refresh on saves, imports, and cross-tab changes; notifications have no polling timer. The active run clock checkpoints every five seconds and flushes when paused, hidden, or leaving the page. A sudden process crash can lose up to five seconds of elapsed time. Clock checkpoints preserve the room-entry inventory, stop during profile recovery, and reject stale writers after a foreign replacement. Browser regressions check zero idle storage reads and stable view, texture, and listener counts across repeated combat entry.

Measured improvements on the original three-fight lab profile: survivor view
replacement fell from 90 to 0 per fight, UI refresh p95 from 33.1 ms to about
11 ms, and observed interaction p95 from 104 ms to 64 ms. Font assets fell from
321,844 to 119,708 bytes. Shared portrait frames remove 6,290,064 bytes of named
RGBA texture backing. These figures are measurements, not device-independent
promises. The in-app preview confirms shared textures and downloaded asset sizes;
its background/focus throttling prevents a reliable desktop FPS claim.

## Remaining differences

The original artwork and audio, official daily leaderboards, platform
integrations, and cloud saves are not reproduced. Enemy portraits are simplified,
and every one of the 372 card definitions has its own illustration. Upgrades retain their base card artwork. Scores, rare event eligibility, and modifier combinations
still need broader comparison with the original. The test suite covers many
interactions, not every possible card/relic/enemy combination.

Rules were checked against original-game references for
[Ascension](https://slaythespire.wiki.gg/wiki/Ascension),
[map generation](https://slaythespire.wiki.gg/wiki/Map_Generation),
[encounter pools and repeat rules](https://slaythespire.wiki.gg/wiki/Monsters),
[Neow](https://slaythespire.wiki.gg/wiki/Neow),
[card rewards](https://slay-the-spire.fandom.com/wiki/Card_Rewards),
[events](https://slaythespire.wiki.gg/wiki/Events),
[potions](https://slaythespire.wiki.gg/wiki/Potions), and
[custom modes](https://slaythespire.wiki.gg/wiki/Custom_Mode).

Presentation uses painted backgrounds, character portraits, and 372 distinct card illustrations loaded on demand, with SVG portraits for all 68 enemy IDs. The map uses room symbols and a scrollable route. Barlow fonts ship as WOFF2, converted losslessly with `ttf2woff2@8.0.1`, under the SIL Open Font License in `public/fonts/OFL.txt`; generated artwork and its prompts are recorded in [`public/art/sources.json`](public/art/sources.json). Each act has a synthesized musical theme. Settings control master, music, and effects volume separately. Audio starts after a click or keypress and pauses in hidden tabs.

Targeted cards stay lifted in the hand while a curved arrow marks the selected enemy. Keyboard selection uses the same aiming display. Release over an enemy to play, or press Escape to cancel. Untargeted cards follow your drag and show when they are ready to play. Reduced motion removes card travel, shakes, flashes, and impact motion.

Card titles and rules use measured font sizing to fit their available space without truncation. Rules use 10–12 px across the base and upgraded catalog; extreme combat values can shrink further. Hover a card, tap its `?`, or press Alt+1–0 in combat for a larger view of its complete rules. Escape closes hand inspection. The inspection button also works on locked cards and inside card-choice dialogs.

Achievements are local to this browser profile. The 46-entry catalog is available from the main menu. Standard runs qualify; the Daily win achievement is the exception. Seeded and custom runs do not earn the other achievements. Combat milestones persist when earned, and unlock notices appear once. The achievement browser shows earned dates, filter counts, and explicit locked states. Run History includes the recorded date, mode, Ascension, cleared acts, exact play time, seed, upgraded deck, and relic descriptions. Existing run history is not used to infer old combat achievements. The catalog follows the [Steam achievement list](https://steamcommunity.com/stats/646570/achievements?l=english).

Settings → Profile backup exports a versioned JSON file containing progress, achievements, settings, and the saved room checkpoint. Import validates content IDs and nested checkpoints, shows a preview, and requires Replace profile. It keeps the previous profile as a local backup. A failed replacement rolls back; an interrupted replacement recovers before gameplay starts. If storage prevents recovery, the recovery screen offers a journal download and retry. Importing a profile does not replay its old unlock notices. Files are limited to 2 MB. Keep exported files outside the browser if you need protection against cleared site data. Cloud saves and leaderboards are not connected.

Game guide: open Help from the main menu or a room, or Game guide from Settings or the combat pause menu. The searchable guide explains turns, piles, routes, character mechanics and status effects. Combatant Effects controls show current rules, orb values and boss counters without revealing hidden intents. Help pauses its calling scene and preserves pending choices.

Keyboard and assistive controls: Tab or Shift+Tab moves between semantic actions, Enter/Space activates them, and the gold outline shows the focused game control. Selecting a targeted card or potion focuses an enemy. Card rules remain available for disabled choices; modal inspectors restore focus when closed. Screen readers receive room text, card rules, concealed-intent-aware targets and one combat update after resolution. Native seed and profile file inputs remain available. The semantic controls update on actions, scene changes and resize, without frame polling.

Card artwork loads only when a card is displayed. Each definition maps to a unique painted cell, including colorless, generated, Curse, and Status cards. Concurrent requests share a sheet decode; the decoded bitmap closes after extraction. The cache targets 64 card textures at 128×128 (4 MiB), evicting unused cards while keeping every displayed card alive. Card names, rules, inspection, and play remain available if an image fails; later acquisitions can retry after a backoff. The existing 2 MB compressed startup and 32 MiB named-texture budgets remain. The complete optional card collection has a separate 6 MB asset-size budget; cumulative traffic can exceed that if evicted artwork needs another sheet fetch. Browser regression tests render every definition and reject duplicate pixels or excess cached textures.
