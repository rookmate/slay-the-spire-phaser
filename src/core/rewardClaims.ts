import { changeMaxHp, gainGold } from './health'
import { applyRelicAcquisition, blocksPotionGain } from './relics'
import { obtainCard, type RunState } from './run'

export type RewardSelection = { cardId: string } | { replacePotion: number } | 'skip' | 'sapphire' | 'bowl'

/** Claim one saved reward once; invalid or incomplete selections leave it untouched. */
export function claimReward(run: RunState, index: number, selection?: RewardSelection): boolean {
    if (run.pendingRoom?.scene !== 'Rewards') return false
    const rewards = run.pendingRoom.rewards, item = rewards.items[index]
    if (!item || rewards.claimed?.includes(index) || item.kind === 'boss_relics') return false
    if (selection !== 'skip') {
        if (item.kind === 'gold') gainGold(run, item.amount)
        else if (item.kind === 'relic') {
            if (selection === 'sapphire') {
                if (rewards.tier !== 'chest' || run.keysEnabled === false || run.keys.sapphire || index !== rewards.items.findIndex(item => item.kind === 'relic')) return false
                run.keys.sapphire = true
            } else applyRelicAcquisition(run, item.relicId)
        } else if (item.kind === 'cards') {
            if (selection === 'bowl' && run.relics.includes('SINGING_BOWL')) changeMaxHp(run, 2)
            else if (typeof selection === 'object' && 'cardId' in selection && item.choices.includes(selection.cardId)) {
                obtainCard(run, selection.cardId, 'deck', item.upgrades?.[item.choices.indexOf(selection.cardId)] ?? 0)
                run.cardsSeen = (run.cardsSeen ?? 0) + item.choices.length
            } else return false
        } else if (item.kind === 'potion' && !blocksPotionGain(run)) {
            if (run.potions.length < run.maxPotionSlots) run.potions.push(item.potionId)
            else if (typeof selection === 'object' && 'replacePotion' in selection && Number.isInteger(selection.replacePotion) && run.potions[selection.replacePotion]) run.potions[selection.replacePotion] = item.potionId
            else return false
        }
    }
    ;(rewards.claimed ??= []).push(index)
    return true
}
