import type { CardDef } from '../state'
import { CARD_DEFS, resolveCard } from '../cards'
import { attackAmount } from './helpers'

/** The remaining Ironclad cards; callbacks resolve against the shared combat engine. */
export const REMAINING_IRONCLAD_CARDS: Record<string, CardDef> = {
    BLOOD_FOR_BLOOD: {
        id: 'BLOOD_FOR_BLOOD', name: 'Blood for Blood', type: 'attack', rarity: 'uncommon', cost: 4,
        baseDamage: 18, upgrade: { cost: 3, baseDamage: 22 }, targeting: { type: 'single_enemy', required: true },
    },
    CARNAGE: {
        id: 'CARNAGE', name: 'Carnage', type: 'attack', rarity: 'uncommon', cost: 2,
        baseDamage: 20, upgrade: { baseDamage: 28 }, ethereal: true, targeting: { type: 'single_enemy', required: true },
    },
    HAVOC: {
        id: 'HAVOC', name: 'Havoc', type: 'skill', rarity: 'common', cost: 1, upgrade: { cost: 0 },
        onPlay: ({ engine }) => engine.enqueue({ kind: 'PlayTopCard' }),
    },
    INFERNAL_BLADE: {
        id: 'INFERNAL_BLADE', name: 'Infernal Blade', type: 'skill', rarity: 'uncommon', cost: 1,
        upgrade: { cost: 0 }, exhaust: true,
        onPlay: ({ engine }) => {
            const attacks = Object.values(CARD_DEFS).filter(def => def.color === 'ironclad' && def.type === 'attack' && def.rarity !== 'basic' && def.poolEnabled)
            const id = attacks[engine.randomInt?.(0, attacks.length - 1) ?? 0].id
            for (const card of engine.createCardsInDestination?.(id, 'hand') ?? []) card.costForTurn = 0
        },
    },
    INFLAME: {
        id: 'INFLAME', name: 'Inflame', type: 'power', rarity: 'uncommon', cost: 1, upgrade: {},
        onPlay: ({ engine, source, card }) => engine.enqueue({ kind: 'ApplyPower', target: source, powerId: 'STRENGTH', stacks: card.upgradeLevel > 0 ? 3 : 2 }),
    },
    RUPTURE: {
        id: 'RUPTURE', name: 'Rupture', type: 'power', rarity: 'uncommon', cost: 1, upgrade: {},
        onPlay: ({ engine, source, card }) => engine.enqueue({ kind: 'ApplyPower', target: source, powerId: 'RUPTURE', stacks: card.upgradeLevel > 0 ? 2 : 1 }),
    },
    SEVER_SOUL: {
        id: 'SEVER_SOUL', name: 'Sever Soul', type: 'attack', rarity: 'uncommon', cost: 2,
        baseDamage: 16, upgrade: { baseDamage: 22 }, targeting: { type: 'single_enemy', required: true },
        onPlay: ({ engine, source, card, targets }) => {
            engine.exhaustCardsInHand?.(entry => resolveCard(entry).type !== 'attack')
            engine.enqueue({ kind: 'DealDamage', source, target: targets[0], amount: attackAmount(engine, card, card.upgradeLevel > 0 ? 22 : 16) })
        },
    },
}
