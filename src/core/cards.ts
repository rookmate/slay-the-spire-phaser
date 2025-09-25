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
}


