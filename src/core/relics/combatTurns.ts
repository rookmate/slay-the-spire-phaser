import type { RelicDef } from '../relics'
import { canUpgradeCard } from '../cards'
import { generateCard, offerCards } from '../combat/choices'
import { createCombatCard } from '../combat/cardCreation'
import { selectCombatCardPool } from '../contentPools'
import { advanceCounter, damageAll } from './helpers'
export const COMBAT_TURN_RELICS = {
    DAMARU: { id: 'DAMARU', name: 'Damaru', rarity: 'common', character: 'watcher', description: 'Gain 1 Mantra at the start of your turn.', onPlayerTurnStart: ({ engine }) => engine.applyPowerToPlayer('MANTRA', 1) },
    BRIMSTONE: { id: 'BRIMSTONE', name: 'Brimstone', rarity: 'shop', character: 'ironclad', description: 'At turn start, gain 2 Strength and give all enemies 1 Strength.', onPlayerTurnStart: ({ engine }) => { engine.applyPowerToPlayer('STRENGTH', 2); for (const enemy of engine.state.enemies.filter(e => e.hp > 0)) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: 1 }) } },
    CAPTAINS_WHEEL: { id: 'CAPTAINS_WHEEL', name: "Captain's Wheel", rarity: 'rare', description: 'Gain 18 Block at the start of turn 3.', onPlayerTurnStart: ({ engine }) => { if (engine.state.turnNumber === 3) engine.gainBlock(engine.state.player.id, 18) } },
    STONE_CALENDAR: { id: 'STONE_CALENDAR', name: 'Stone Calendar', rarity: 'rare', description: 'Deal 52 damage to all enemies at the end of turn 7.', onPlayerTurnEnd: ctx => { if (ctx.engine.state.turnNumber === 7) damageAll(ctx, 52) } },
    INCENSE_BURNER: { id: 'INCENSE_BURNER', name: 'Incense Burner', rarity: 'rare', description: 'Every 6 turns, gain 1 Intangible.', onPlayerTurnStart: ctx => { if (advanceCounter(ctx, 'INCENSE_BURNER', 6)) ctx.engine.applyPowerToPlayer('INTANGIBLE', 1) } },
    INSERTER: { id: 'INSERTER', name: 'Inserter', rarity: 'boss', character: 'defect', description: 'Every 2 turns, gain an orb slot.', onPlayerTurnStart: ctx => { if (advanceCounter(ctx, 'INSERTER', 2)) ctx.engine.enqueue({ kind: 'ChangeOrbSlots', amount: 1 }) } },
    ART_OF_WAR: { id: 'ART_OF_WAR', name: 'Art of War', rarity: 'common', description: 'If you played no Attacks this turn, gain 1 Energy next turn.', onPlayerTurnEnd: ({ engine }) => { if (!engine.state.attacksThisTurn) engine.applyPowerToPlayer('ENERGY_NEXT_TURN', 1) } },
    POCKETWATCH: { id: 'POCKETWATCH', name: 'Pocketwatch', rarity: 'rare', description: 'If you played at most 3 cards this turn, draw 3 extra cards next turn.', onPlayerTurnEnd: ({ engine }) => { if ((engine.state.cardsPlayed ?? 0) <= 3) engine.applyPowerToPlayer('DRAW_NEXT_TURN', 3) } },
    CLOAK_CLASP: { id: 'CLOAK_CLASP', name: 'Cloak Clasp', rarity: 'rare', character: 'watcher', description: 'At turn end, gain 1 Block per card in hand.', onPlayerTurnEnd: ({ engine }) => engine.gainBlock(engine.state.player.id, engine.state.player.hand.length) },
    EMOTION_CHIP: { id: 'EMOTION_CHIP', name: 'Emotion Chip', rarity: 'rare', character: 'defect', description: 'After losing HP, trigger all orb passives at the start of your next turn.', onPlayerHpLost: ({ runtime }) => { runtime.EMOTION_CHIP ??= {}; runtime.EMOTION_CHIP.used = true }, onPlayerTurnStart: ({ engine, runtime }) => {
        if (!runtime.EMOTION_CHIP?.used) return
        runtime.EMOTION_CHIP.used = false; for (const orb of engine.state.player.orbs) engine.enqueue({ kind: 'TriggerOrb', orb, mode: 'passive' })
    } },
    WARPED_TONGS: { id: 'WARPED_TONGS', name: 'Warped Tongs', rarity: 'event', description: 'Upgrade a random card in hand each turn.', onPlayerHandReady: ({ engine }) => engine.afterQueuedEffects(() => {
        const cards = engine.state.player.hand.filter(canUpgradeCard); if (cards.length) cards[engine.rng.int(0, cards.length - 1)].upgradeLevel++
    }) },
    NILRYS_CODEX: { id: 'NILRYS_CODEX', name: "Nilry's Codex", rarity: 'event', description: 'At turn end, optionally shuffle one of 3 random cards into your draw pile.', onPlayerTurnEnd: ({ engine }) => engine.afterQueuedEffects(() => {
        const pool = selectCombatCardPool(engine, { source: 'generated' }); engine.rng.shuffleInPlace(pool)
        offerCards(engine, pool.slice(0, 3).map(id => createCombatCard(engine, id)), 'nilrys-codex', card => engine.insertCard(card, 'drawPile'))
    }) },
    DEAD_BRANCH: { id: 'DEAD_BRANCH', name: 'Dead Branch', rarity: 'rare', description: 'Add a random card to hand whenever you exhaust a card.', onCardExhausted: ({ engine }) => { generateCard(engine) } },
    RUNIC_CUBE: { id: 'RUNIC_CUBE', name: 'Runic Cube', rarity: 'boss', character: 'ironclad', description: 'Draw 1 whenever you lose HP.', onPlayerHpLost: ({ engine }) => engine.enqueue({ kind: 'DrawCards', count: 1 }) },
    SELF_FORMING_CLAY: { id: 'SELF_FORMING_CLAY', name: 'Self-Forming Clay', rarity: 'uncommon', character: 'ironclad', description: 'Whenever you lose HP, gain 3 Block next turn.', onPlayerHpLost: ({ engine }) => engine.applyPowerToPlayer('BLOCK_NEXT_TURN', 3) },
    SNECKO_EYE: { id: 'SNECKO_EYE', name: 'Snecko Eye', rarity: 'boss', description: 'Draw 2 extra cards each turn. Start combat Confused.', onCombatStart: ({ engine }) => engine.applyPowerToPlayer('CONFUSION', 1), onPlayerTurnStart: ({ engine }) => engine.enqueue({ kind: 'DrawCards', count: 2 }) },
} satisfies Record<string, RelicDef>
