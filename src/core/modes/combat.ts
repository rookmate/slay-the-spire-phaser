import { blightStacks } from './endless'
import type { Engine } from '../engine'
import { createCombatCard } from '../combat/cardCreation'
import { selectCombatCardPool } from '../contentPools'
import { hasModifier } from './modifiers'

export function initializeModifiedCombat(engine: Engine): void {
    if (hasModifier(engine.run, 'LETHALITY')) {
        engine.applyPowerToPlayer('STRENGTH', 3)
        for (const enemy of engine.state.enemies) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: 3 })
    }
    if (hasModifier(engine.run, 'TERMINAL')) engine.applyPowerToPlayer('PLATED_ARMOR', 5)
    if (hasModifier(engine.run, 'TIME_DILATION')) for (const enemy of engine.state.enemies) if (enemy.specId !== 'GIANT_HEAD')
        engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'SLOW', stacks: 1 })
}
export function startModifiedTurn(engine: Engine): void {
    if (hasModifier(engine.run, 'CONTROLLED_CHAOS')) {
        const pool = selectCombatCardPool(engine, { source: 'any_generated', unlockedIds: engine.run?.unlockedCardIds })
        for (let i = 0; i < 10; i++) engine.insertCard(createCombatCard(engine, pool[engine.rng.int(0, pool.length - 1)]), 'drawPileBottom')
    }
}

export function endModifiedTurn(engine: Engine): void {
    const ids = ['WOUND', 'BURN', 'DAZED', 'SLIMED', 'VOID']
    for (let i = 0; i < blightStacks(engine.run, 'TWISTING_MIND'); i++) engine.insertCard(createCombatCard(engine, ids[engine.rng.int(0, ids.length - 1)]), 'drawPileTop')
}
