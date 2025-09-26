import type { CardDef } from './state'

export const CARD_DEFS: Record<string, CardDef> = {
    STRIKE: { id: 'STRIKE', name: 'Strike', type: 'attack', cost: 1, baseDamage: 6 },
    DEFEND: { id: 'DEFEND', name: 'Defend', type: 'skill', cost: 1, baseBlock: 5 },
    BASH: {
        id: 'BASH',
        name: 'Bash',
        type: 'attack',
        cost: 2,
        baseDamage: 8,
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 8 })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'VULNERABLE', stacks: 2 })
        },
    },
    CLEAVE: {
        id: 'CLEAVE',
        name: 'Cleave',
        type: 'attack',
        cost: 1,
        baseDamage: 8,
        onPlay: ({ engine, source }) => {
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) engine.enqueue({ kind: 'DealDamage', source, target: enemy.id, amount: 8 })
            }
        },
    },
    POMMEL_STRIKE: {
        id: 'POMMEL_STRIKE',
        name: 'Pommel Strike',
        type: 'attack',
        cost: 1,
        baseDamage: 9,
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 9 })
            engine.enqueue({ kind: 'DrawCards', count: 1 })
        },
    },
    SHRUG_IT_OFF: {
        id: 'SHRUG_IT_OFF',
        name: 'Shrug It Off',
        type: 'skill',
        cost: 1,
        baseBlock: 8,
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: 8 })
            engine.enqueue({ kind: 'DrawCards', count: 1 })
        },
    },
    TWIN_STRIKE: {
        id: 'TWIN_STRIKE',
        name: 'Twin Strike',
        type: 'attack',
        cost: 1,
        baseDamage: 5,
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 5 })
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 5 })
        },
    },
    BODY_SLAM: {
        id: 'BODY_SLAM',
        name: 'Body Slam',
        type: 'attack',
        cost: 1,
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const amount = engine.state.player.block
            if (amount > 0) engine.enqueue({ kind: 'DealDamage', source, target, amount })
        },
    },
    IRON_WAVE: { id: 'IRON_WAVE', name: 'Iron Wave', type: 'attack', cost: 1, baseDamage: 5, baseBlock: 5 },
    ANGER: {
        id: 'ANGER',
        name: 'Anger',
        type: 'attack',
        cost: 0,
        baseDamage: 6,
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 6 })
            engine.state.player.discardPile.push({ defId: 'ANGER', upgraded: false })
        },
    },
    CLOTHESLINE: {
        id: 'CLOTHESLINE',
        name: 'Clothesline',
        type: 'attack',
        cost: 2,
        baseDamage: 12,
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 12 })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'WEAK', stacks: 2 })
        },
    },
    UPPERCUT: {
        id: 'UPPERCUT',
        name: 'Uppercut',
        type: 'attack',
        cost: 2,
        baseDamage: 13,
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 13 })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'VULNERABLE', stacks: 1 })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'WEAK', stacks: 1 })
        },
    },
    SWORD_BOOMERANG: {
        id: 'SWORD_BOOMERANG',
        name: 'Sword Boomerang',
        type: 'attack',
        cost: 1,
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            for (let i = 0; i < 3; i++) engine.enqueue({ kind: 'DealDamage', source, target, amount: 3 })
        },
    },
}


