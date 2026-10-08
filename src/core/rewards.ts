import { RNG } from './rng'
import { cardChoices, drawRelic, drawBossRelics, drawPotion } from './rewardPools'
import type { RoomKind } from './map'
import type { MetaState } from './meta'
import type { RelicId, RunState } from './run'
import { blocksPotionGain, getCardRewardChoiceCount } from './relics'
import type { PotionId } from './potions'

export type EncounterTier = 'hallway' | 'elite' | 'boss' | 'chest'

export type RewardItem =
    | { kind: 'gold'; amount: number }
    | { kind: 'cards'; choices: string[]; upgrades?: number[] }
    | { kind: 'relic'; relicId: RelicId }
    | { kind: 'potion'; potionId: PotionId }
    | { kind: 'boss_relics'; choices: RelicId[] }

export interface RewardBundle {
    advanceFloor?: boolean
    claimed?: number[]
    tier: EncounterTier
    items: RewardItem[]
}

export function generateRewardBundle(
    seed: string,
    tier: EncounterTier,
    run: Pick<RunState, 'relics' | 'potions' | 'maxPotionSlots'> & Partial<RunState> | RelicId[],
    meta: MetaState,
    opts?: { roomKind?: RoomKind; asc?: number },
): RewardBundle {
    const rng = new RNG(seed)
    const items: RewardItem[] = []
    const runView = Array.isArray(run)
        ? { relics: run, potions: [], maxPotionSlots: 3 } as Partial<RunState> & Pick<RunState, 'relics' | 'potions' | 'maxPotionSlots'>
        : run
    const cardChoiceCount = getCardRewardChoiceCount(runView)
    const canGainPotion = !blocksPotionGain(runView)

    if (tier === 'hallway') {
        const baseGold = rng.int(10, 20)
        const amount = baseGold
        items.push({ kind: 'gold', amount })
        items.push({ kind: 'cards', choices: cardChoices(rng, meta, cardChoiceCount, runView, 'hallway') })
    } else if (tier === 'elite') {
        items.push({ kind: 'gold', amount: rng.int(25, 35) })
        items.push({ kind: 'cards', choices: cardChoices(rng, meta, cardChoiceCount, runView, tier === 'elite' ? 'elite' : 'hallway') })
        items.push({ kind: 'relic', relicId: drawRelic(rng, meta, runView.relics) })
    } else if (tier === 'boss') {
        const asc = opts?.asc ?? (Array.isArray(run) ? 0 : (run as RunState).asc)
        items.push({ kind: 'gold', amount: Math.round(rng.int(95, 105) * (asc >= 13 ? 0.75 : 1)) })
        items.push({ kind: 'cards', choices: cardChoices(rng, meta, cardChoiceCount, runView, 'boss') })
        items.push({ kind: 'boss_relics', choices: drawBossRelics(rng, runView.relics) })
    } else if (tier === 'chest') {
        const sizeRoll = rng.random()
        const size = sizeRoll < 0.5 ? 'small' : sizeRoll < 0.83 ? 'medium' : 'large'
        const table = {
            small: { common: 0.75, uncommon: 1, goldChance: 0.5, goldMin: 23, goldMax: 27 },
            medium: { common: 0.35, uncommon: 0.85, goldChance: 0.35, goldMin: 45, goldMax: 55 },
            large: { common: 0, uncommon: 0.75, goldChance: 0.5, goldMin: 68, goldMax: 82 },
        }[size]
        const rarityRoll = rng.random()
        const rarity = rarityRoll < table.common ? 'common' : rarityRoll < table.uncommon ? 'uncommon' : 'rare'
        items.push({ kind: 'relic', relicId: drawRelic(rng, meta, runView.relics, rarity) })
        if (rng.random() < table.goldChance) items.push({ kind: 'gold', amount: rng.int(table.goldMin, table.goldMax) })
    }

    if (tier !== 'chest') {
        const chance = runView.potionChance ?? 0.4
        const dropped = rng.random() < chance
        runView.potionChance = Math.max(0, Math.min(1, chance + (dropped ? -0.1 : 0.1)))
        if (canGainPotion && dropped) items.push({ kind: 'potion', potionId: drawPotion(rng) })
        if (runView.relics.includes('GOLDEN_IDOL')) for (const item of items) if (item.kind === 'gold') item.amount = Math.floor(item.amount * 1.25)
    }
    const act = Array.isArray(run) ? 1 : ((run as RunState).act ?? 1)
    const asc = opts?.asc ?? (Array.isArray(run) ? 0 : (run as RunState).asc)
    for (const item of items) if (item.kind === 'cards') item.upgrades = item.choices.map(() => tier === 'boss' ? 0 : Number(rng.random() < Math.max(0, act - 1) * (asc >= 12 ? 0.125 : 0.25)))
    return { tier, items }
}
