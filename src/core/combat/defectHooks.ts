import type { Engine } from '../engine'
import { powerAmount } from '../combatMath'
import { generateCard } from './choices'

export function startDefectTurn(engine: Engine): void {
    const player = engine.state.player
    const bias = powerAmount(player, 'BIASED_COGNITION')
    if (bias) engine.applyPowerToPlayer('FOCUS', -bias)
    // Trigger after Focus loss has resolved.
    engine.afterQueuedEffects(() => {
        const orb = player.orbs[0]
        if (orb) for (let i = 0; i < powerAmount(player, 'LOOP'); i++) engine.enqueue({ kind: 'TriggerOrb', orb, mode: 'passive' })
    })
    const learning = powerAmount(player, 'MACHINE_LEARNING')
    if (learning) engine.enqueue({ kind: 'DrawCards', count: learning })
    for (let i = 0; i < powerAmount(player, 'CREATIVE_AI'); i++) generateCard(engine, { type: 'power' })
    for (let i = 0; i < powerAmount(player, 'HELLO_WORLD'); i++) generateCard(engine, { rarity: 'common' })
}
export function onDefectPowerPlayed(engine: Engine): void {
    const player = engine.state.player
    const draw = powerAmount(player, 'HEATSINKS')
    if (draw) engine.enqueue({ kind: 'DrawCards', count: draw })
    for (let i = 0; i < powerAmount(player, 'STORM'); i++) engine.enqueue({ kind: 'ChannelOrb', orbType: 'lightning' })
}
