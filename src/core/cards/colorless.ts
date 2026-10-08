import { canUpgradeCard, resolveCard } from '../cards'
import type { CardDef } from '../state'
import { attackAmount } from './helpers'

const upgraded = (level: number, base: number, plus: number) => level > 0 ? plus : base
export const COLORLESS_CARDS: Record<string, CardDef> = {
    FINESSE: {
        id: 'FINESSE', name: 'Finesse', cost: 0, type: 'skill', rarity: 'uncommon', baseBlock: 2, upgrade: { baseBlock: 4 },
        description: () => 'Draw 1.', onPlay: ({ engine, source, card }) => {
            engine.enqueue({ kind: 'GainBlock', blockSource: 'card', target: source, amount: resolveCard(card).baseBlock! })
            engine.enqueue({ kind: 'DrawCards', count: 1 })
        },
    },
    FLASH_OF_STEEL: {
        id: 'FLASH_OF_STEEL', name: 'Flash of Steel', cost: 0, type: 'attack', rarity: 'uncommon', baseDamage: 3, upgrade: { baseDamage: 6 },
        targeting: { type: 'single_enemy', required: true }, description: () => 'Draw 1.',
        onPlay: ({ engine, source, targets, card }) => {
            engine.enqueue({ kind: 'DealDamage', source, target: targets[0], amount: attackAmount(engine, card, resolveCard(card).baseDamage!) })
            engine.enqueue({ kind: 'DrawCards', count: 1 })
        },
    },
    GOOD_INSTINCTS: { id: 'GOOD_INSTINCTS', name: 'Good Instincts', cost: 0, type: 'skill', rarity: 'uncommon', baseBlock: 6, upgrade: { baseBlock: 9 } },
    SWIFT_STRIKE: { id: 'SWIFT_STRIKE', name: 'Swift Strike', cost: 0, type: 'attack', rarity: 'uncommon', baseDamage: 7, upgrade: { baseDamage: 10 }, targeting: { type: 'single_enemy', required: true } },
    PANACEA: { id: 'PANACEA', name: 'Panacea', cost: 0, type: 'skill', rarity: 'uncommon', exhaust: true, upgrade: {}, description: c => `Gain ${upgraded(c.upgradeLevel, 1, 2)} Artifact.`,
        onPlay: ({ engine, source, card }) => engine.enqueue({ kind: 'ApplyPower', target: source, powerId: 'ARTIFACT', stacks: upgraded(card.upgradeLevel, 1, 2) }) },
    BANDAGE_UP: { id: 'BANDAGE_UP', name: 'Bandage Up', cost: 0, type: 'skill', rarity: 'uncommon', exhaust: true, upgrade: {}, description: c => `Heal ${upgraded(c.upgradeLevel, 4, 6)} HP.`,
        onPlay: ({ engine, source, card }) => engine.enqueue({ kind: 'Heal', target: source, amount: upgraded(card.upgradeLevel, 4, 6) }) },
    MADNESS: { id: 'MADNESS', name: 'Madness', cost: 1, type: 'skill', rarity: 'uncommon', exhaust: true, upgrade: { cost: 0 }, description: () => 'A random card in hand costs 0 for this combat.',
        onPlay: ({ engine }) => {
            const candidates = engine.state.player.hand.filter(card => !resolveCard(card).xCost && (card.costForTurn ?? card.costForCombat ?? card.confusedCost ?? resolveCard(card).cost) > 0)
            const card = candidates[engine.randomInt?.(0, candidates.length - 1) ?? 0]
            if (card) { card.costForCombat = 0; card.costForTurn = 0 }
        } },
    DRAMATIC_ENTRANCE: { id: 'DRAMATIC_ENTRANCE', name: 'Dramatic Entrance', cost: 0, type: 'attack', rarity: 'uncommon', baseDamage: 8, upgrade: { baseDamage: 12 }, innate: true, exhaust: true, targeting: { type: 'all_enemies' }, onPlay: ({ engine, source, targets, card }) => { for (const target of targets) engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolveCard(card).baseDamage!) }) } },
    MASTER_OF_STRATEGY: { id: 'MASTER_OF_STRATEGY', name: 'Master of Strategy', cost: 0, type: 'skill', rarity: 'rare', exhaust: true, upgrade: {}, description: c => `Draw ${upgraded(c.upgradeLevel, 3, 4)}.`,
        onPlay: ({ engine, card }) => engine.enqueue({ kind: 'DrawCards', count: upgraded(card.upgradeLevel, 3, 4) }) },
    APOTHEOSIS: { id: 'APOTHEOSIS', name: 'Apotheosis', cost: 2, type: 'skill', rarity: 'rare', exhaust: true, upgrade: { cost: 1 }, description: () => 'Upgrade all your cards for this combat.',
        onPlay: ({ engine }) => {
            for (const zone of ['hand', 'drawPile', 'discardPile', 'exhaustPile'] as const) {
                for (const card of engine.state.player[zone]) if (canUpgradeCard(card)) card.upgradeLevel++
            }
        } },
}
for (const def of Object.values(COLORLESS_CARDS)) def.color = 'colorless'
