import type { Engine } from '../engine'
import { powerAmount } from '../combatMath'
import { scry } from './scry'

export function startWatcherTurn(engine: Engine): void {
    const player = engine.state.player
    if (powerAmount(player, 'BLASPHEMER') > 0) {
        engine.setPowerStacks(player, 'BLASPHEMER', 0)
        engine.enqueue({ kind: 'LoseHp', target: player.id, amount: 99999, fromCard: false })
    }
    const deva = powerAmount(player, 'DEVA_FORM')
    if (deva) {
        const gain = engine.state.devaEnergy ?? deva
        engine.enqueue({ kind: 'GainEnergy', amount: gain }); engine.state.devaEnergy = gain + deva
    }
    const devotion = powerAmount(player, 'DEVOTION')
    if (devotion) engine.applyPowerToPlayer('MANTRA', devotion)
    const hymn = powerAmount(player, 'BATTLE_HYMN')
    if (hymn) engine.createCardsInDestination('SMITE', 'hand', hymn)
    const collect = powerAmount(player, 'COLLECT')
    if (collect) { engine.createCardsInDestination('MIRACLE', 'hand', 1, 1); engine.setPowerStacks(player, 'COLLECT', collect - 1) }
    const fury = powerAmount(player, 'SIMMERING_FURY')
    if (fury) { engine.enqueue({ kind: 'ChangeStance', stance: 'wrath' }); engine.enqueue({ kind: 'DrawCards', count: fury }); engine.setPowerStacks(player, 'SIMMERING_FURY', 0) }
    const foresight = powerAmount(player, 'FORESIGHT')
    if (foresight) engine.afterQueuedEffects(() => scry(engine, foresight, 'foresight'))
}
export function endWatcherTurn(engine: Engine): void {
    const player = engine.state.player
    const water = powerAmount(player, 'LIKE_WATER')
    if (water && player.stance === 'calm') engine.enqueue({ kind: 'GainBlock', target: player.id, amount: water })
    const omega = powerAmount(player, 'OMEGA')
    if (omega) for (const enemy of engine.state.enemies.filter(e => e.hp > 0)) engine.enqueue({ kind: 'DealDamage', source: player.id, target: enemy.id, amount: omega, damageType: 'effect', origin: 'power' })
    const study = powerAmount(player, 'STUDY')
    if (study) engine.createCardsInDestination('INSIGHT', 'drawPile', study)
}
