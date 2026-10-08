import { CARD_DEFS, canUpgradeCard, createCardInstance, getUnlockedCollectibleCards } from './cards'
import { transformCard } from './events'
import { changeMaxHp, gainGold } from './health'
import type { MetaState } from './meta'
import { applyRelicAcquisition } from './relics'
import { cardChoices, drawBossRelics, drawPotion, drawRelic } from './rewardPools'
import type { RewardItem } from './rewards'
import { RNG } from './rng'
import { obtainCurse, removeCardByInstanceId, type RunState } from './run'

export type NeowReward = 'REMOVE_CARD' | 'TRANSFORM_CARD' | 'UPGRADE_CARD' | 'CHOOSE_CARD' | 'COLORLESS_CARD' | 'RANDOM_RARE' | 'MAX_HP' | 'LAMENT' | 'COMMON_RELIC' | 'GAIN_100_GOLD' | 'THREE_POTIONS' | 'REMOVE_TWO' | 'TRANSFORM_TWO' | 'GAIN_250_GOLD' | 'RARE_CARD' | 'RARE_COLORLESS' | 'RARE_RELIC' | 'LARGE_MAX_HP' | 'BOSS_SWAP'
export type NeowDrawback = 'MAX_HP' | 'DAMAGE' | 'CURSE' | 'GOLD'
export interface NeowOption {
    id: NeowReward
    label: string
    description: string
    category: 'card' | 'blessing' | 'tradeoff' | 'swap'
    drawback?: NeowDrawback
    requiresSelection?: 'remove' | 'upgrade' | 'transform'
    selectionCount?: number
}
const rewards: Record<NeowReward, string> = {
    REMOVE_CARD: 'Remove 1 card', TRANSFORM_CARD: 'Transform 1 card', UPGRADE_CARD: 'Upgrade 1 card', CHOOSE_CARD: 'Choose a card', COLORLESS_CARD: 'Choose an uncommon colorless card', RANDOM_RARE: 'Obtain a random rare card', MAX_HP: 'Gain 10% max HP', LAMENT: "Obtain Neow's Lament", COMMON_RELIC: 'Obtain a common relic', GAIN_100_GOLD: 'Gain 100 Gold', THREE_POTIONS: 'Obtain 3 potions', REMOVE_TWO: 'Remove 2 cards', TRANSFORM_TWO: 'Transform 2 cards', GAIN_250_GOLD: 'Gain 250 Gold', RARE_CARD: 'Choose a rare card', RARE_COLORLESS: 'Choose a rare colorless card', RARE_RELIC: 'Obtain a rare relic', LARGE_MAX_HP: 'Gain 20% max HP', BOSS_SWAP: 'Exchange your starter relic',
}
const drawbackText: Record<NeowDrawback, string> = { MAX_HP: 'Lose 10% max HP.', DAMAGE: 'Lose roughly 30% of current HP.', CURSE: 'Obtain a random curse.', GOLD: 'Lose all Gold.' }
function option(id: NeowReward, category: NeowOption['category'], drawback?: NeowDrawback): NeowOption {
    const selection = id.startsWith('REMOVE') ? 'remove' : id.startsWith('TRANSFORM') ? 'transform' : id === 'UPGRADE_CARD' ? 'upgrade' : undefined
    return { id, label: rewards[id], description: [drawback ? drawbackText[drawback] : '', id === 'BOSS_SWAP' ? 'Lose your starter relic. Obtain a random boss relic.' : id === 'LAMENT' ? 'Enemies in the next 3 combats have 1 HP.' : ''].filter(Boolean).join(' '), category, drawback, requiresSelection: selection, selectionCount: id.endsWith('_TWO') ? 2 : 1 }
}
export function rollNeowOptions(seed: string, full = true): NeowOption[] {
    if (!full) return [option('MAX_HP', 'blessing'), option('LAMENT', 'blessing')]
    const rng = new RNG(seed)
    const pick = <T>(pool: T[]) => pool[rng.int(0, pool.length - 1)]
    const first = pick<NeowReward>(['REMOVE_CARD', 'TRANSFORM_CARD', 'UPGRADE_CARD', 'CHOOSE_CARD', 'COLORLESS_CARD', 'RANDOM_RARE'])
    const second = pick<NeowReward>(['MAX_HP', 'LAMENT', 'COMMON_RELIC', 'GAIN_100_GOLD', 'THREE_POTIONS'])
    const drawback = pick<NeowDrawback>(['MAX_HP', 'DAMAGE', 'CURSE', 'GOLD'])
    const third = pick<NeowReward>((['REMOVE_TWO', 'TRANSFORM_TWO', 'GAIN_250_GOLD', 'RARE_CARD', 'RARE_COLORLESS', 'RARE_RELIC', 'LARGE_MAX_HP'] as NeowReward[]).filter(id => !(id === 'REMOVE_TWO' && drawback === 'CURSE') && !(id === 'GAIN_250_GOLD' && drawback === 'GOLD') && !(id === 'LARGE_MAX_HP' && (drawback === 'MAX_HP' || drawback === 'DAMAGE'))))
    return [option(first, 'card'), option(second, 'blessing'), option(third, 'tradeoff', drawback), option('BOSS_SWAP', 'swap')]
}
/** Apply the drawback and reward once. Selection is validated before any mutation. */
export function applyNeowOption(run: RunState, meta: MetaState, selected: NeowOption, instanceIds: string[] = []): boolean {
    if (run.neowCompleted) return false
    const offered = rollNeowOptions(run.neowSeed, run.neowFull ?? true).find(o => o.id === selected.id)
    if (!offered) return false
    selected = offered
    if (selected.requiresSelection) {
        if (new Set(instanceIds).size !== selected.selectionCount) return false
        for (const id of instanceIds) {
            const card = run.deck.find(c => c.instanceId === id)
            if (!card || card.defId === 'ASCENDERS_BANE' || (selected.requiresSelection === 'upgrade' && !canUpgradeCard(card))) return false
        }
    }
    const rng = new RNG(`${run.neowSeed}-${selected.id}`)
    if (selected.drawback === 'GOLD') run.gold = 0
    if (selected.drawback === 'MAX_HP') changeMaxHp(run, -Math.floor(run.player.maxHp * 0.1))
    if (selected.drawback === 'DAMAGE') run.player.hp -= Math.floor(run.player.hp / 10) * 3
    if (selected.drawback === 'CURSE') {
        const pool = Object.values(CARD_DEFS).filter(c => c.type === 'curse' && c.id !== 'ASCENDERS_BANE')
        obtainCurse(run, pool[rng.int(0, pool.length - 1)].id)
    }
    const items: RewardItem[] = []
    const id = selected.id
    if (selected.requiresSelection) for (const [index, instanceId] of instanceIds.entries()) {
        if (selected.requiresSelection === 'remove') removeCardByInstanceId(run, instanceId)
        else if (selected.requiresSelection === 'transform') transformCard(run, meta, instanceId, `${run.neowSeed}-transform-${index}`)
        else run.deck.find(c => c.instanceId === instanceId)!.upgradeLevel++
    }
    if (id === 'GAIN_100_GOLD' || id === 'GAIN_250_GOLD') gainGold(run, id === 'GAIN_100_GOLD' ? 100 : 250)
    if (id === 'MAX_HP' || id === 'LARGE_MAX_HP') changeMaxHp(run, Math.floor(run.player.maxHp * (id === 'MAX_HP' ? 0.1 : 0.2)))
    if (id === 'LAMENT') applyRelicAcquisition(run, 'NEOWS_LAMENT')
    if (id === 'COMMON_RELIC' || id === 'RARE_RELIC') applyRelicAcquisition(run, drawRelic(rng, meta, run.relics, id === 'COMMON_RELIC' ? 'common' : 'rare'))
    if (id === 'RANDOM_RARE') { const pool = getUnlockedCollectibleCards(meta, 'rare'); run.deck.push(createCardInstance(pool[rng.int(0, pool.length - 1)])) }
    if (id === 'THREE_POTIONS') for (let i = 0; i < 3; i++) items.push({ kind: 'potion', potionId: drawPotion(rng) })
    if (id === 'BOSS_SWAP') {
        run.relics = run.relics.filter(relic => relic !== 'BURNING_BLOOD')
        applyRelicAcquisition(run, drawBossRelics(rng, run.relics)[0])
    }
    if (id === 'CHOOSE_CARD' || id === 'RARE_CARD') items.push({ kind: 'cards', choices: cardChoices(rng, meta, 3, run, id === 'RARE_CARD' ? 'boss' : 'hallway') })
    if (id === 'COLORLESS_CARD' || id === 'RARE_COLORLESS') {
        const pool = Object.values(CARD_DEFS).filter(c => c.color === 'colorless' && c.poolEnabled && c.rarity === (id === 'RARE_COLORLESS' ? 'rare' : 'uncommon')).map(c => c.id)
        rng.shuffleInPlace(pool); items.push({ kind: 'cards', choices: pool.slice(0, 3) })
    }
    run.neowCompleted = true; run.neowChoiceId = id
    if (items.length) run.pendingRoom = { scene: 'Rewards', rewards: { tier: 'hallway', advanceFloor: false, items } }
    return true
}
