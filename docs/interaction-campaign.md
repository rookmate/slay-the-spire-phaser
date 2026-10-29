# Interaction campaign

Run the fixed campaign with:

```bash
npm run test:interactions
```

Expand the combat seed range without changing the fixtures:

```bash
INTERACTION_SEEDS=1200 npm run test:interactions
```

`INTERACTION_SEEDS` accepts 1–10000 combat cases. The default is 96. A failing
combat reports its seed, fixture index, and ordered plays, targets, selections,
and skips. Replay a single default case with, for example:

```bash
npx vitest run src/core/interaction-campaign.test.ts -t 'fixture 17 within'
```

For an expanded case, also supply a seed count that includes its index. The
fixture and action RNGs are separate. UUIDs are excluded from replay comparisons;
card definitions, upgrades, effective costs, piles, powers, HP, energy, enemy
HP/powers, and action traces must agree across two independent executions.

The campaign uses artificial fixtures to reach interactions quickly:

- 96 combat seeds rotate through all four characters, A0–20, all four acts,
  hallway/elite fights, and the Heart. Six packages combine exhaust, discard,
  repeats, stances, queued choices, Curses, and Status cards with relevant relics.
  Each adds twelve seeded cards from the collectible pool. Each execution stops
  after 100 actions, ten turns, victory, or defeat. Reaching the action/turn budget
  is allowed; these are interaction probes, not winning campaign players.
- Every one of the 51 event definitions gets eight seeded walks at A0/A20, with
  Hoarder or Diverse and payment/acquisition relics. Each walk allows at most
  twelve choices and reloads JSON checkpoints between actions. The first variant
  keeps taking the first enabled option to reach multi-step payments and
  transformations. Other variants vary their branch. Event combats are stopping
  points; the existing campaign and event tests cover combat returns.
- Eight custom modifier combinations across four characters complete Draft or
  Sealed Deck choices when present and check the resulting inventory and score.
- 84 scoring fixtures cover every character at A0–20. They distinguish self HP
  payments from enemy damage, then verify Overkill, Champion/Perfect, Ascension
  points, combat counters, and score stability across serialization.

Combat checks reject duplicate card ownership, lost original non-Power cards,
oversized hands, impossible queued choices, non-finite resources, invalid HP,
Block or energy, contradictory outcomes, and rejected advertised legal plays.
Event checks reject disabled-choice mutations, repeated resolved-event effects,
invalid inventory/resources, and mutable or inconsistent score calculations.

These checks establish local invariants, not agreement with the commercial game.
They do not cover all card/relic combinations or all event eligibility and score
rules. The normal three-act players remain in `tests/support/campaign.ts`.

## Reduced failures

`src/core/interaction-regressions.test.ts` keeps the short action sequences:

1. Play After Image, Rage, then Body Slam. Rage's play grants 1 Block. Body Slam's
   triggers bring it to 5 before damage resolves. Previously the hit used the old
   value and dealt 1 instead of 5.
2. Play After Image, then Entrench. After Image grants 1 Block before Entrench's
   effect, so doubling yields 2. Previously Entrench read zero and left 1 Block.
3. Start with Hoarder, acquire Astrolabe, and choose three original cards, with
   reloads between picks. All nine transformed acquisitions must be upgraded.
   Previously only the first card in each group of three was upgraded.

Each regression failed on the original implementation. Block-dependent effects
now read Block after queued triggers. Astrolabe upgrades its transformation
before the normal acquisition path creates Hoarder copies. A follow-up regression
keeps Wreath of Flame available until deferred attack effects resolve, then
checks that the next Attack no longer receives its bonus.
