import type { Engine } from './engine'
import type { EntityId } from './actions'

export type PotionId = 'FIRE_POTION' | 'BLOCK_POTION' | 'STRENGTH_POTION'

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
}
