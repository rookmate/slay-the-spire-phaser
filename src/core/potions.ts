import type { Engine } from './engine'
import type { EntityId } from './actions'

export type PotionId =
    | 'FIRE_POTION'
    | 'BLOCK_POTION'
    | 'STRENGTH_POTION'
    | 'ENERGY_POTION'
    | 'DEXTERITY_POTION'
    | 'WEAK_POTION'
    | 'EXPLOSIVE_POTION'

export interface PotionDef {
    id: PotionId
    name: string
    target: 'none' | 'player' | 'single_enemy'
    description: string
    use: (engine: Engine, targets: EntityId[]) => void
}

export const POTION_DEFS: Record<PotionId, PotionDef> = {
    FIRE_POTION: {
        id: 'FIRE_POTION',
        name: 'Fire Potion',
        target: 'single_enemy',
        description: 'Deal 20 damage.',
        use: (engine, targets) => {
            const target = targets[0]
            if (!target) return
            engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target, amount: 20 })
        },
    },
    BLOCK_POTION: {
        id: 'BLOCK_POTION',
        name: 'Block Potion',
        target: 'player',
        description: 'Gain 12 Block.',
        use: (engine) => {
            engine.enqueue({ kind: 'GainBlock', target: engine.state.player.id, amount: 12 })
        },
    },
    STRENGTH_POTION: {
        id: 'STRENGTH_POTION',
        name: 'Strength Potion',
        target: 'player',
        description: 'Gain 2 Strength.',
        use: (engine) => {
            engine.enqueue({ kind: 'ApplyPower', target: engine.state.player.id, powerId: 'STRENGTH', stacks: 2 })
        },
    },
    ENERGY_POTION: {
        id: 'ENERGY_POTION',
        name: 'Energy Potion',
        target: 'player',
        description: 'Gain 2 Energy.',
        use: (engine) => {
            engine.enqueue({ kind: 'GainEnergy', amount: 2 })
        },
    },
    DEXTERITY_POTION: {
        id: 'DEXTERITY_POTION',
        name: 'Dexterity Potion',
        target: 'player',
        description: 'Gain 2 Dexterity.',
        use: (engine) => {
            engine.enqueue({ kind: 'ApplyPower', target: engine.state.player.id, powerId: 'DEXTERITY', stacks: 2 })
        },
    },
    WEAK_POTION: {
        id: 'WEAK_POTION',
        name: 'Weak Potion',
        target: 'single_enemy',
        description: 'Apply 3 Weak.',
        use: (engine, targets) => {
            const target = targets[0]
            if (!target) return
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'WEAK', stacks: 3 })
        },
    },
    EXPLOSIVE_POTION: {
        id: 'EXPLOSIVE_POTION',
        name: 'Explosive Potion',
        target: 'none',
        description: 'Deal 10 damage to all enemies.',
        use: (engine) => {
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: enemy.id, amount: 10 })
            }
        },
    },
}
