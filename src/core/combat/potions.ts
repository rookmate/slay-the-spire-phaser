import { combatHealingAmount } from '../health'
import type { Engine } from '../engine'
import type { EmittedEvent } from '../actions'
import { POTION_DEFS, potionMultiplier } from '../potions'
import { getRelicState } from '../relics'

/** Revival resolves before the next hit, so multi-hit attacks can consume multiple Fairies. */
export function revivePlayer(engine: Engine, events: EmittedEvent[]): boolean {
    const { run } = engine, player = engine.state.player
    if (!run || run.relics.includes('MARK_OF_THE_BLOOM')) return false
    const fairy = run.potions.findIndex(id => POTION_DEFS[id].autoRevivePercent !== undefined)
    let fraction = 0
    if (fairy >= 0) {
        const id = run.potions[fairy]
        fraction = POTION_DEFS[id].autoRevivePercent! * potionMultiplier(run, id)
        run.potions.splice(fairy, 1)
    } else if (run.relics.includes('LIZARD_TAIL')) {
        const state = getRelicState(run, 'LIZARD_TAIL')
        if (state.charges === 0) return false
        state.charges = 0; fraction = 0.5
    }
    if (!fraction) return false
    player.hp = Math.min(player.maxHp, combatHealingAmount(run, Math.max(1, Math.floor(player.maxHp * fraction))))
    events.push({ kind: 'Healed', target: player.id, amount: player.hp, resultingHp: player.hp })
    return true
}
