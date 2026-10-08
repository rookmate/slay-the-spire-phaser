import type { Engine } from '../engine'
import type { CardInstance } from '../state'
import { resolveCard } from '../cards'
import { powerAmount } from '../combatMath'
import { getRelicState } from '../relics'

export function relicAllowsUnplayable(engine: Engine, card: CardInstance): boolean {
    const type = resolveCard(card).type
    return type === 'curse' && !!engine.run?.relics.includes('BLUE_CANDLE') || type === 'status' && !!engine.run?.relics.includes('MEDICAL_KIT')
}
export function relicCardDamage(engine: Engine, amount: number, cardInstanceId: string): number {
    const run = engine.run
    if (!run) return amount
    const card = engine.getLimboCard()?.instanceId === cardInstanceId ? engine.getLimboCard() : engine.state.player.hand.find(c => c.instanceId === cardInstanceId)
    if (card) {
        if (run.relics.includes('STRIKE_DUMMY') && resolveCard(card).name.includes('Strike')) amount += 3
        if (run.relics.includes('WRIST_BLADE') && engine.isCardFreeToPlay(card)) amount += 4
    }
    if (run.relics.includes('PEN_NIB') && (engine.getLimboCard() ? engine.getRelicContext().runtime.PEN_NIB?.used : getRelicState(run, 'PEN_NIB').counter === 9)) amount *= 2
    return amount
}
export function syncConditionalRelics(engine: Engine): void {
    if (!engine.run?.relics.includes('RED_SKULL')) return
    const { runtime } = engine.getRelicContext(), player = engine.state.player
    const previous = runtime.RED_SKULL?.count ?? 0
    const next = player.hp <= player.maxHp / 2 ? 3 : 0
    runtime.RED_SKULL = { count: next }
    if (next !== previous) engine.setPowerStacks(player, 'STRENGTH', powerAmount(player, 'STRENGTH') + next - previous)
}
export function refillEmptyHand(engine: Engine): boolean {
    const p = engine.state.player
    if (!engine.run?.relics.includes('UNCEASING_TOP') || p.hand.length || engine.state.turn !== 'player' || powerAmount(p, 'NO_DRAW') > 0 || !(p.drawPile.length || p.discardPile.length)) return false
    engine.enqueue({ kind: 'DrawCards', count: 1 }); return true
}
