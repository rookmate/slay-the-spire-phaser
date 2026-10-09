import type { Engine } from '../engine'
import { powerAmount } from '../combatMath'
import type { OrbState, OrbType } from './resources'

export function orbValues(orb: OrbState, focus: number): { passive: number; evoke: number } {
    return {
        passive: orb.type === 'plasma' ? 1 : Math.max(0, (orb.type === 'frost' ? 2 : orb.type === 'dark' ? 6 : 3) + focus),
        evoke: orb.type === 'dark' ? orb.storedDamage : orb.type === 'plasma' ? 2 : Math.max(0, (orb.type === 'frost' ? 5 : 8) + focus),
    }
}

export function channelOrb(engine: Engine, type: OrbType, storedDamage?: number): void {
    const player = engine.state.player
    if (player.orbSlots <= 0) return
    if (player.orbs.length >= player.orbSlots) evokeOrb(engine)
    player.orbs.push({ type, storedDamage: storedDamage ?? (type === 'dark' ? 6 : 0) })
    engine.state.orbsChanneled[type]++
}
export function evokeOrb(engine: Engine, repeats = 1, remove = true): void {
    const orb = engine.state.player.orbs[0]
    if (!orb) return
    if (remove) engine.state.player.orbs.shift()
    for (let i = 0; i < repeats; i++) engine.enqueue({ kind: 'TriggerOrb', orb, mode: 'evoke' })
}
export function changeOrbSlots(engine: Engine, amount: number): void {
    const player = engine.state.player
    player.orbSlots = Math.max(0, Math.min(10, player.orbSlots + amount))
    player.orbs.splice(player.orbSlots)
}
export function triggerOrb(engine: Engine, orb: OrbState, mode: 'passive' | 'evoke'): void {
    const player = engine.state.player
    const focus = powerAmount(player, 'FOCUS')
    const evoke = mode === 'evoke'
    const values = orbValues(orb, focus)
    if (orb.type === 'plasma') { engine.enqueue({ kind: 'GainEnergy', amount: values[mode] }); return }
    if (orb.type === 'frost') { engine.enqueue({ kind: 'GainBlock', target: player.id, amount: values[mode] }); return }
    if (orb.type === 'dark' && !evoke) { orb.storedDamage += values.passive; return }
    const living = engine.state.enemies.filter(enemy => enemy.hp > 0)
    if (!living.length) return
    const amount = values[mode]
    const targets = orb.type === 'dark' ? [living.reduce((lowest, enemy) => enemy.hp < lowest.hp ? enemy : lowest)]
        : powerAmount(player, 'ELECTRODYNAMICS') > 0 ? living : [living[engine.randomInt(0, living.length - 1)]]
    for (const target of targets) engine.enqueue({ kind: 'DealDamage', source: player.id, target: target.id,
        amount: amount * (powerAmount(target, 'LOCK_ON') > 0 ? 1.5 : 1), damageType: 'effect', origin: 'orb' })
}
export function triggerOrbPassives(engine: Engine, phase: 'start' | 'end'): void {
    for (const [index, orb] of engine.state.player.orbs.entries()) if ((orb.type === 'plasma') === (phase === 'start')) {
        engine.enqueue({ kind: 'TriggerOrb', orb, mode: 'passive' })
        if (index === 0 && engine.run?.relics.includes('GOLD_PLATED_CABLES')) engine.enqueue({ kind: 'TriggerOrb', orb, mode: 'passive' })
    }
}
