import type { CharacterId } from '../../src/core/characters'
import { canRemoveCard, canUpgradeCard, CARD_DEFS } from '../../src/core/cards'
import { getEventChoices } from '../../src/core/events'
import type { NeowOption } from '../../src/core/neow'
import type { ShopInventory } from '../../src/core/progression'
import type { RunState, RelicId } from '../../src/core/run'
import { shopPrice } from '../../src/core/shop'
import { cardPriority } from './policy'
export function rewardPick(run: RunState, choices: string[]): string | undefined {
    return [...choices].sort((a, b) => cardPriority(b) - cardPriority(a)).find(id => cardPriority(id) >= 50 && run.deck.filter(c => c.defId === id).length < (['SHRUG_IT_OFF', 'TWIN_STRIKE', 'INFLAME', 'FOOTWORK', 'NOXIOUS_FUMES', 'BACKFLIP', 'GLACIER', 'COOLHEADED', 'DEFRAGMENT', 'LOOP', 'TALK_TO_THE_HAND', 'PROTECT', 'PROSTRATE', 'FLURRY_OF_BLOWS'].includes(id) ? 3 : 1))
}
export function upgradePick(run: RunState) { return run.deck.filter(canUpgradeCard).sort((a, b) => cardPriority(b.defId) - cardPriority(a.defId))[0] }
export function neowPick(options: NeowOption[]) {
    const preference = ['RARE_CARD', 'RANDOM_RARE', 'COMMON_RELIC', 'LAMENT', 'BOSS_SWAP']
    return [...options].sort((a, b) => (preference.indexOf(a.id) < 0 ? 99 : preference.indexOf(a.id)) - (preference.indexOf(b.id) < 0 ? 99 : preference.indexOf(b.id)))[0]
}
export function bossRelicPick(choices: RelicId[], character: CharacterId = 'ironclad') {
    const preference: RelicId[] = character !== 'ironclad' ? ['CURSED_KEY', 'SOZU', 'ECTOPLASM', 'FUSION_HAMMER', 'SLAVERS_COLLAR', 'PHILOSOPHERS_STONE', 'BUSTED_CROWN', 'HOLY_WATER', 'FROZEN_CORE', 'BLACK_STAR', 'VELVET_CHOKER'] : ['SOZU', 'BLACK_BLOOD', 'MARK_OF_PAIN', 'PHILOSOPHERS_STONE', 'BUSTED_CROWN', 'COFFEE_DRIPPER']
    return [...choices].sort((a, b) => (preference.indexOf(a) < 0 ? 99 : preference.indexOf(a)) - (preference.indexOf(b) < 0 ? 99 : preference.indexOf(b)))[0]
}
export function shopPick(run: RunState, stock: ShopInventory): number {
    return stock.cards.map((id, index) => ({ id, index })).filter(({ id, index }) => cardPriority(id) >= 60 && !run.deck.some(c => c.defId === id) && run.gold >= shopPrice(run, stock.cardPrices![index])).sort((a, b) => cardPriority(b.id) - cardPriority(a.id))[0]?.index ?? -1
}
export function eventPick(run: RunState) {
    const choices = getEventChoices(run).filter(c => !c.disabled?.(run))
    const preference = ['LEAVE', 'BIG_FISH_BANANA', 'LIVING_WALL_GROW', 'THE_JOUST_MURDERER', 'FORGOTTEN_ALTAR_BLOOD', 'LIBRARY_SLEEP', 'HALLS_MAX_HP', 'SENSORY_1', 'BLOOM_HEALTHY', 'BLOOM_RICH', 'WORLD_OF_GOOP_REACH']
    const choice = [...choices].sort((a, b) => (preference.indexOf(a.id) < 0 ? 99 : preference.indexOf(a.id)) - (preference.indexOf(b.id) < 0 ? 99 : preference.indexOf(b.id)))[0]
    const card = choice?.requiresSelection === 'upgrade' ? upgradePick(run) : [...run.deck].filter(c => canRemoveCard(c) && (!run.eventState?.transformEligibleIds || run.eventState.transformEligibleIds.includes(c.instanceId))).sort((a, b) => (CARD_DEFS[a.defId].type === 'curse' ? -100 : cardPriority(a.defId)) - (CARD_DEFS[b.defId].type === 'curse' ? -100 : cardPriority(b.defId)))[0]
    return { choice, selection: { cardInstanceId: card?.instanceId, cardId: run.eventState?.cards?.[0] } }
}

export function shouldRest(run: RunState): boolean {
    if (run.character === 'watcher' && run.player.hp > run.player.maxHp * 0.4 && run.deck.some(card => card.defId === 'ERUPTION' && !card.upgradeLevel)) return false
    return run.player.hp < run.player.maxHp * 0.8
}
