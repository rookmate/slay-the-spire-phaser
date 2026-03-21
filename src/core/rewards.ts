import { RNG } from './rng'
import { getAscensionHallwayGoldMultiplier } from './ascension'
import { getUnlockedCollectibleCards } from './cards'
import type { RoomKind } from './map'
import type { MetaState } from './meta'
import type { RelicId, RunState } from './run'
import { BOSS_RELIC_POOL, blocksPotionGain, getCardRewardChoiceCount, getUnlockedRelicPool } from './relics'
import type { PotionId } from './potions'

export type EncounterTier = 'hallway' | 'elite' | 'boss' | 'chest'

export type RewardItem =
    | { kind: 'gold'; amount: number }
    | { kind: 'cards'; choices: string[] }
    | { kind: 'relic'; relicId: RelicId }
    | { kind: 'potion'; potionId: PotionId }
    | { kind: 'boss_relics'; choices: RelicId[] }

export interface RewardBundle {
    tier: EncounterTier
    items: RewardItem[]
}

const RARITY_ORDER: Array<'common' | 'uncommon' | 'rare'> = ['common', 'common', 'common', 'common', 'common', 'common', 'uncommon', 'uncommon', 'uncommon', 'rare']
const POTION_POOL: PotionId[] = [
    'FIRE_POTION',
    'BLOCK_POTION',
    'STRENGTH_POTION',
    'ENERGY_POTION',
    'DEXTERITY_POTION',
    'WEAK_POTION',
    'EXPLOSIVE_POTION',
]

export function generateRewardBundle(
    seed: string,
    tier: EncounterTier,
    run: Pick<RunState, 'relics' | 'potions' | 'maxPotionSlots'> | RelicId[],
    meta: MetaState,
    opts?: { roomKind?: RoomKind; asc?: number },
): RewardBundle {
    const rng = new RNG(seed)
    const items: RewardItem[] = []
    const runView = Array.isArray(run)
        ? { relics: run, potions: [], maxPotionSlots: 3 }
        : run
    const cardChoiceCount = getCardRewardChoiceCount(runView)
    const canGainPotion = !blocksPotionGain(runView)

    if (tier === 'hallway') {
        const baseGold = rng.int(10, 20)
        const asc = Array.isArray(run) ? (opts?.asc ?? 0) : (run as RunState).asc
        const roomKind = opts?.roomKind ?? 'monster'
        const amount = roomKind === 'monster'
            ? Math.floor(baseGold * getAscensionHallwayGoldMultiplier(asc))
            : baseGold
        items.push({ kind: 'gold', amount })
        items.push({ kind: 'cards', choices: drawCardChoices(rng, meta, cardChoiceCount) })
        if (canGainPotion && rng.random() < 0.4) items.push({ kind: 'potion', potionId: POTION_POOL[rng.int(0, POTION_POOL.length - 1)] })
    } else if (tier === 'elite') {
        items.push({ kind: 'gold', amount: rng.int(25, 35) })
        items.push({ kind: 'cards', choices: drawCardChoices(rng, meta, cardChoiceCount) })
        items.push({ kind: 'relic', relicId: drawRelic(rng, meta, runView.relics) })
        if (canGainPotion && rng.random() < 0.6) items.push({ kind: 'potion', potionId: POTION_POOL[rng.int(0, POTION_POOL.length - 1)] })
    } else if (tier === 'boss') {
        items.push({ kind: 'boss_relics', choices: drawBossRelics(rng, runView.relics) })
    } else if (tier === 'chest') {
        items.push({ kind: 'relic', relicId: drawRelic(rng, meta, runView.relics) })
        items.push({ kind: 'gold', amount: rng.int(25, 35) })
    }

    return { tier, items }
}

function drawCardChoices(rng: RNG, meta: MetaState, count: number): string[] {
    const chosen = new Set<string>()
    const allByRarity = {
        common: getUnlockedCollectibleCards(meta, 'common'),
        uncommon: getUnlockedCollectibleCards(meta, 'uncommon'),
        rare: getUnlockedCollectibleCards(meta, 'rare'),
    }
    const fallback = [...new Set([...allByRarity.common, ...allByRarity.uncommon, ...allByRarity.rare])]

    while (chosen.size < count) {
        const rarity = RARITY_ORDER[rng.int(0, RARITY_ORDER.length - 1)]
        const pool = allByRarity[rarity].length > 0 ? allByRarity[rarity] : fallback
        if (pool.length === 0) continue
        chosen.add(pool[rng.int(0, pool.length - 1)])
    }

    return [...chosen]
}

function drawRelic(rng: RNG, meta: MetaState, ownedRelics: RelicId[]): RelicId {
    const unlocked = getUnlockedRelicPool(meta).filter(id => !ownedRelics.includes(id))
    const fallback = getUnlockedRelicPool(meta)
    const pool = unlocked.length > 0 ? unlocked : fallback
    if (pool.length === 0) return 'ANCHOR'
    return pool[rng.int(0, pool.length - 1)]
}

function drawBossRelics(rng: RNG, ownedRelics: RelicId[]): RelicId[] {
    const pool = BOSS_RELIC_POOL.filter(id => !ownedRelics.includes(id))
    const source = pool.length > 0 ? pool : BOSS_RELIC_POOL
    const chosen = new Set<RelicId>()
    while (chosen.size < Math.min(3, source.length)) {
        chosen.add(source[rng.int(0, source.length - 1)])
    }
    return [...chosen]
}
