import type { Engine } from '../engine'
import { powerAmount } from '../combatMath'
import { generateCard } from './choices'

export function startSharedTurn(engine: Engine): void {
    const player = engine.state.player
    engine.state.panacheCount = 0
    for (let i = 0; i < powerAmount(player, 'MAGNETISM'); i++) generateCard(engine, { colorless: true })
    for (let i = 0; i < powerAmount(player, 'MAYHEM'); i++) engine.enqueue({ kind: 'PlayTopCard', exhaust: false })
}
export function endSharedTurn(engine: Engine): void {
    for (const bomb of engine.state.bombs ?? []) {
        bomb.turns--
        if (bomb.turns === 0) for (const enemy of engine.state.enemies.filter(e => e.hp > 0))
            engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: enemy.id, amount: bomb.damage, damageType: 'effect', origin: 'power' })
    }
    engine.state.bombs = engine.state.bombs?.filter(bomb => bomb.turns > 0)
}
export function onSharedCardPlayed(engine: Engine): void {
    const panache = powerAmount(engine.state.player, 'PANACHE')
    if (!panache) return
    engine.state.panacheCount = (engine.state.panacheCount ?? 0) + 1
    if (engine.state.panacheCount < 5) return
    engine.state.panacheCount = 0
    for (const enemy of engine.state.enemies.filter(e => e.hp > 0))
        engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: enemy.id, amount: panache, damageType: 'effect', origin: 'power' })
}
