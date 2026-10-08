import type { RelicDef, RelicCombatContext } from '../relics'
import { resolveCard } from '../cards'
import { isDebuff } from '../combatMath'
import { scry } from '../combat/scry'
import { advanceCounter, damageAll } from './helpers'
const thirdAttack = ({ engine }: RelicCombatContext) => ((engine.state.attacksThisTurn ?? 0) + 1) % 3 === 0
export const COMBAT_CARD_RELICS = {
    NUNCHAKU: { id: 'NUNCHAKU', name: 'Nunchaku', rarity: 'common', description: 'Gain 1 Energy every 10 Attacks.', onAttackPlayed: ctx => { if (advanceCounter(ctx, 'NUNCHAKU', 10)) ctx.engine.enqueue({ kind: 'GainEnergy', amount: 1 }) } },
    PEN_NIB: { id: 'PEN_NIB', name: 'Pen Nib', rarity: 'common', description: 'Every 10th Attack deals double damage.', onAttackPlayed: ctx => { ctx.runtime.PEN_NIB = { used: advanceCounter(ctx, 'PEN_NIB', 10) } } },
    KUNAI: { id: 'KUNAI', name: 'Kunai', rarity: 'uncommon', description: 'Gain 1 Dexterity every 3 Attacks played in a turn.', onAttackPlayed: ctx => { if (thirdAttack(ctx)) ctx.engine.applyPowerToPlayer('DEXTERITY', 1) } },
    SHURIKEN: { id: 'SHURIKEN', name: 'Shuriken', rarity: 'uncommon', description: 'Gain 1 Strength every 3 Attacks played in a turn.', onAttackPlayed: ctx => { if (thirdAttack(ctx)) ctx.engine.applyPowerToPlayer('STRENGTH', 1) } },
    ORNAMENTAL_FAN: { id: 'ORNAMENTAL_FAN', name: 'Ornamental Fan', rarity: 'uncommon', description: 'Gain 4 Block every 3 Attacks played in a turn.', onAttackPlayed: ctx => { if (thirdAttack(ctx)) ctx.engine.gainBlock(ctx.engine.state.player.id, 4) } },
    DUALITY: { id: 'DUALITY', name: 'Duality', rarity: 'uncommon', character: 'watcher', description: 'Gain 1 temporary Dexterity whenever you play an Attack.', onAttackPlayed: ({ engine }) => { engine.applyPowerToPlayer('DEXTERITY', 1); engine.applyPowerToPlayer('DEXTERITY_DOWN', 1) } },
    INK_BOTTLE: { id: 'INK_BOTTLE', name: 'Ink Bottle', rarity: 'uncommon', description: 'Draw 1 every 10 cards played.', onCardPlayed: ctx => { if (advanceCounter(ctx, 'INK_BOTTLE', 10)) ctx.engine.enqueue({ kind: 'DrawCards', count: 1 }) } },
    LETTER_OPENER: { id: 'LETTER_OPENER', name: 'Letter Opener', rarity: 'uncommon', description: 'Every 3 Skills in a turn, deal 5 damage to all enemies.', onPlayerTurnStart: ({ runtime }) => { runtime.LETTER_OPENER = { count: 0 } }, onCardPlayed: (ctx, card) => {
        if (resolveCard(card).type !== 'skill') return
        const entry = ctx.runtime.LETTER_OPENER ??= {}; entry.count = (entry.count ?? 0) + 1
        if (entry.count % 3 === 0) damageAll(ctx, 5)
    } },
    BIRD_FACED_URN: { id: 'BIRD_FACED_URN', name: 'Bird-Faced Urn', rarity: 'rare', description: 'Heal 2 HP whenever you play a Power.', onCardPlayed: ({ engine }, card) => { if (resolveCard(card).type === 'power') engine.enqueue({ kind: 'Heal', target: engine.state.player.id, amount: 2 }) } },
    MUMMIFIED_HAND: { id: 'MUMMIFIED_HAND', name: 'Mummified Hand', rarity: 'uncommon', description: 'Playing a Power makes a random card in hand cost 0 this turn.', onCardPlayed: ({ engine }, card) => {
        if (resolveCard(card).type !== 'power') return
        const cards = engine.state.player.hand.filter(c => !resolveCard(c).xCost && !resolveCard(c).unplayable && engine.getCardCost(c) > 0)
        if (cards.length) cards[engine.rng.int(0, cards.length - 1)].costForTurn = 0
    } },
    ORANGE_PELLETS: { id: 'ORANGE_PELLETS', name: 'Orange Pellets', rarity: 'shop', description: 'Playing an Attack, Skill, and Power in one turn removes your debuffs.', onPlayerTurnStart: ({ runtime }) => { runtime.ORANGE_PELLETS = { types: [] } }, onCardResolved: ({ engine, runtime }, card) => {
        const entry = runtime.ORANGE_PELLETS ??= { types: [] }; entry.types ??= []; const type = resolveCard(card).type
        if (!entry.types.includes(type)) entry.types.push(type)
        if (['attack', 'skill', 'power'].every(t => entry.types!.includes(t))) {
            engine.state.player.powers = engine.state.player.powers.filter(p => !isDebuff(p.id, p.stacks)); entry.types = []
        }
    } },
    HOVERING_KITE: { id: 'HOVERING_KITE', name: 'Hovering Kite', rarity: 'boss', character: 'silent', description: 'The first time you discard each turn, gain 1 Energy.', onCardDiscarded: ({ engine }) => { if (engine.state.discardsThisTurn === 1) engine.enqueue({ kind: 'GainEnergy', amount: 1 }) } },
    TOUGH_BANDAGES: { id: 'TOUGH_BANDAGES', name: 'Tough Bandages', rarity: 'rare', character: 'silent', description: 'Gain 3 Block for each card discarded during your turn.', onCardDiscarded: ({ engine }) => engine.gainBlock(engine.state.player.id, 3) },
    TINGSHA: { id: 'TINGSHA', name: 'Tingsha', rarity: 'rare', character: 'silent', description: 'Deal 3 damage to a random enemy for each card discarded during your turn.', onCardDiscarded: ({ engine }) => {
        const enemies = engine.state.enemies.filter(e => e.hp > 0); if (enemies.length) engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: enemies[engine.rng.int(0, enemies.length - 1)].id, amount: 3, damageType: 'effect', origin: 'relic' })
    } },
    SUNDIAL: { id: 'SUNDIAL', name: 'Sundial', rarity: 'uncommon', description: 'Gain 2 Energy every 3 shuffles.', onShuffle: ctx => { if (advanceCounter(ctx, 'SUNDIAL', 3)) ctx.engine.enqueue({ kind: 'GainEnergy', amount: 2 }) } },
    THE_ABACUS: { id: 'THE_ABACUS', name: 'The Abacus', rarity: 'shop', description: 'Gain 6 Block whenever you shuffle.', onShuffle: ({ engine }) => engine.gainBlock(engine.state.player.id, 6) },
    MELANGE: { id: 'MELANGE', name: 'Melange', rarity: 'shop', character: 'watcher', description: 'Scry 3 whenever you shuffle.', onShuffle: ({ engine }) => engine.afterQueuedEffects(() => scry(engine, 3, 'melange')) },
} satisfies Record<string, RelicDef>
