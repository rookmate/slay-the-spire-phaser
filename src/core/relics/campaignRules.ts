import { hasModifier } from '../modes/modifiers'
import { changeMaxHp, gainGold, healRun } from '../health'
import { defaultUnknownWeights, resolveUnknown, updateUnknownWeights, type GeneratedMap, type MapNode, type RoomKind, type UnknownOutcome } from '../map'
import { getRelicState } from '../relics'
import type { RNG } from '../rng'
import type { RunState } from '../run'

export function canEnterMapNode(run: RunState, map: GeneratedMap, node: MapNode): boolean {
    const current = run.mapProgress?.currentNodeId
    if (!current) return map.startIds.includes(node.id)
    const from = map.byId[current]
    return !!from && (from.edgesTo.includes(node.id) || ((hasModifier(run, 'FLIGHT') || (run.relicState?.WING_BOOTS?.charges ?? 0) > 0) && node.row === from.row - 1))
}
export function enterMapNode(run: RunState, map: GeneratedMap, node: MapNode, rng: RNG): RoomKind | UnknownOutcome {
    const from = run.mapProgress?.currentNodeId ? map.byId[run.mapProgress.currentNodeId] : undefined
    if (from && !from.edgesTo.includes(node.id) && !hasModifier(run, 'FLIGHT')) getRelicState(run, 'WING_BOOTS').charges!--
    if (run.relics.includes('MAW_BANK') && (run.relicState?.MAW_BANK?.charges ?? 0) > 0) gainGold(run, 12)
    if (hasModifier(run, 'TERMINAL')) changeMaxHp(run, -1)
    let kind: RoomKind | UnknownOutcome = node.kind
    if (kind === 'unknown') {
        run.stats ??= {}; run.stats.unknownRooms = (run.stats.unknownRooms ?? 0) + 1
        if (run.relics.includes('SSSERPENT_HEAD')) gainGold(run, 50)
        const weights = run.unknownWeights ?? defaultUnknownWeights()
        const deadly = hasModifier(run, 'DEADLY_EVENTS'), eligibleElite = deadly && run.floor >= 6
        kind = resolveUnknown(rng, { ...weights, elite: eligibleElite ? weights.elite ?? 0.2 : 0, monster: run.relics.includes('JUZU_BRACELET') ? 0 : weights.monster })
        if (run.relics.includes('TINY_CHEST')) {
            const state = getRelicState(run, 'TINY_CHEST'); state.counter = ((state.counter ?? 0) + 1) % 4
            if (state.counter === 0) kind = 'chest'
        }
        run.unknownWeights = updateUnknownWeights(weights, kind as UnknownOutcome, deadly)
        if (deadly && !eligibleElite) run.unknownWeights.elite = weights.elite ?? 0.2
        if (kind === 'chest' && (run.endlessLoop ?? 0) > 0 && (run.act >= 2 || (run.endlessLoop ?? 0) > 1)) kind = 'elite'
    }
    if (kind === 'shop' && run.relics.includes('MEAL_TICKET')) healRun(run, 15)
    if (kind === 'rest') {
        if (run.relics.includes('ETERNAL_FEATHER')) healRun(run, 3 * Math.floor(run.deck.length / 5))
        if (run.relics.includes('ANCIENT_TEA_SET')) getRelicState(run, 'ANCIENT_TEA_SET').charges = 1
    }
    run.mapProgress = { currentNodeId: node.id }
    return kind
}
export function spendAtShop(run: RunState, amount: number): void {
    run.gold -= amount
    if (amount > 0 && run.relics.includes('MAW_BANK')) getRelicState(run, 'MAW_BANK').charges = 0
}
