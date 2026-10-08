import type { CardDef } from '../state'
import { isUpgraded } from './helpers'

export const POWER_CARDS: Record<string, CardDef> = {
    BARRICADE: {
        id: 'BARRICADE',
        name: 'Barricade',
        type: 'power',
        cost: 3,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: { cost: 2 },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'BARRICADE', stacks: 1 })
        },
    },
    METALLICIZE: {
        id: 'METALLICIZE',
        name: 'Metallicize',
        type: 'power',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'METALLICIZE', stacks: isUpgraded(card) ? 4 : 3 })
        },
    },
    DEMON_FORM: {
        id: 'DEMON_FORM',
        name: 'Demon Form',
        type: 'power',
        cost: 3,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'DEMON_FORM', stacks: isUpgraded(card) ? 3 : 2 })
        },
    },
    CORRUPTION: {
        id: 'CORRUPTION',
        name: 'Corruption',
        type: 'power',
        cost: 3,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: { cost: 2 },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'CORRUPTION', stacks: 1 })
        },
    },
    FEEL_NO_PAIN: {
        id: 'FEEL_NO_PAIN',
        name: 'Feel No Pain',
        type: 'power',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'FEEL_NO_PAIN', stacks: isUpgraded(card) ? 4 : 3 })
        },
    },
    JUGGERNAUT: {
        id: 'JUGGERNAUT',
        name: 'Juggernaut',
        type: 'power',
        cost: 2,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'JUGGERNAUT', stacks: isUpgraded(card) ? 7 : 5 })
        },
    },
    DARK_EMBRACE: {
        id: 'DARK_EMBRACE',
        name: 'Dark Embrace',
        type: 'power',
        cost: 2,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: { cost: 1 },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'DARK_EMBRACE', stacks: 1 })
        },
    },
    BRUTALITY: {
        id: 'BRUTALITY',
        name: 'Brutality',
        type: 'power',
        cost: 0,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: { innate: true },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'BRUTALITY', stacks: 1 })
        },
    },
    BERSERK: {
        id: 'BERSERK',
        name: 'Berserk',
        type: 'power',
        cost: 0,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'VULNERABLE', stacks: isUpgraded(card) ? 1 : 2 })
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'BERSERK', stacks: 1 })
        },
    },
    EVOLVE: {
        id: 'EVOLVE',
        name: 'Evolve',
        type: 'power',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'EVOLVE', stacks: isUpgraded(card) ? 2 : 1 })
        },
    },
    COMBUST: {
        id: 'COMBUST',
        name: 'Combust',
        type: 'power',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'COMBUST_HP_LOSS', stacks: 1 })
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'COMBUST', stacks: isUpgraded(card) ? 7 : 5 })
        },
    },
    FIRE_BREATHING: {
        id: 'FIRE_BREATHING',
        name: 'Fire Breathing',
        type: 'power',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'FIRE_BREATHING', stacks: isUpgraded(card) ? 10 : 6 })
        },
    },
}
