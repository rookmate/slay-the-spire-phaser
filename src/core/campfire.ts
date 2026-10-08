import { hasModifier } from './modes/modifiers'
import { getAscensionRestHealFraction } from './ascension'
import { canRemoveCard, canUpgradeCard } from './cards'
import { changeMaxHp, healRun } from './health'
import { completeRoom } from './progression'
import { canRestAtCampfire, getRelicState } from './relics'
import { queueAcquisition, queueCardRewards } from './relics/acquisitions'
import type { RunState } from './run'
export type CampfireAction = 'rest' | 'smith' | 'recall' | 'toke' | 'dig' | 'lift' | 'skip'
export function canUseCampfire(run: RunState, action: CampfireAction): boolean {
    switch (action) {
        case 'rest': return canRestAtCampfire(run)
        case 'smith': return !hasModifier(run, 'MIDAS') && !run.relics.includes('FUSION_HAMMER') && run.deck.some(canUpgradeCard)
        case 'recall': return run.keysEnabled !== false && !run.keys.ruby
        case 'toke': return run.relics.includes('PEACE_PIPE') && run.deck.some(canRemoveCard)
        case 'dig': return run.relics.includes('SHOVEL')
        case 'lift': return run.relics.includes('GIRYA') && (run.relicState?.GIRYA?.counter ?? 0) < 3
        case 'skip': return true
    }
}
export function useCampfire(run: RunState, action: CampfireAction, cardId?: string): boolean {
    if (run.pendingRoom?.scene !== 'Campfire' || !canUseCampfire(run, action)) return false
    if (action === 'smith') {
        const card = run.deck.find(c => c.instanceId === cardId)
        if (!card || !canUpgradeCard(card)) return false
        card.upgradeLevel++
    }
    if (action === 'rest') {
        healRun(run, Math.floor(run.player.maxHp * getAscensionRestHealFraction(run.asc)) + (run.relics.includes('REGAL_PILLOW') ? 15 : 0))
        if (hasModifier(run, 'NIGHT_TERRORS')) { healRun(run, run.player.maxHp); changeMaxHp(run, -5) }
        if (run.relics.includes('DREAM_CATCHER')) queueCardRewards(run, 'DREAM_CATCHER', 1)
    }
    if (action === 'recall') run.keys.ruby = true
    if (action === 'toke') queueAcquisition(run, { source: 'PEACE_PIPE', kind: 'select', operation: 'remove', count: 1 })
    if (action === 'dig') queueAcquisition(run, { source: 'SHOVEL', kind: 'relic' })
    if (action === 'lift') { const state = getRelicState(run, 'GIRYA'); state.counter = (state.counter ?? 0) + 1 }
    completeRoom(run)
    return true
}
