import { RNG } from './rng'
import { CARD_DEFS } from './cards'
import type { RelicId } from './run'
import { BOSS_RELIC_POOL, MVP_RELIC_POOL, blocksPotionGain, getCardRewardChoiceCount } from './relics'
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
const POTION_POOL: PotionId[] = ['FIRE_POTION', 'BLOCK_POTION', 'STRENGTH_POTION']

export function generateRewardBundle(seed: string, tier: EncounterTier, ownedRelics: RelicId[]): RewardBundle {
    const rng = new RNG(seed)
    const items: RewardItem[] = []
    const cardChoiceCount = getCardRewardChoiceCount(ownedRelics)
    const canGainPotion = !blocksPotionGain(ownedRelics)

    if (tier === 'hallway') {
        items.push({ kind: 'gold', amount: rng.int(10, 20) })
        items.push({ kind: 'cards', choices: drawCardChoices(rng, cardChoiceCount) })
        if (canGainPotion && rng.random() < 0.4) items.push({ kind: 'potion', potionId: POTION_POOL[rng.int(0, POTION_POOL.length - 1)] })
    } else if (tier === 'elite') {
        items.push({ kind: 'gold', amount: rng.int(25, 35) })
        items.push({ kind: 'cards', choices: drawCardChoices(rng, cardChoiceCount) })
        items.push({ kind: 'relic', relicId: drawRelic(rng, ownedRelics) })
        if (canGainPotion && rng.random() < 0.6) items.push({ kind: 'potion', potionId: POTION_POOL[rng.int(0, POTION_POOL.length - 1)] })
    } else if (tier === 'boss') {
        items.push({ kind: 'boss_relics', choices: drawBossRelics(rng, ownedRelics) })
    } else if (tier === 'chest') {
        items.push({ kind: 'relic', relicId: drawRelic(rng, ownedRelics) })
        items.push({ kind: 'gold', amount: rng.int(25, 35) })
    }

    return { tier, items }
}

function drawCardChoices(rng: RNG, count: number): string[] {
    const chosen = new Set<string>()
    const allByRarity = {
        common: Object.values(CARD_DEFS).filter(card => card.poolEnabled && card.rarity === 'common').map(card => card.id),
        uncommon: Object.values(CARD_DEFS).filter(card => card.poolEnabled && card.rarity === 'uncommon').map(card => card.id),
        rare: Object.values(CARD_DEFS).filter(card => card.poolEnabled && card.rarity === 'rare').map(card => card.id),
    }

    while (chosen.size < count) {
        const rarity = RARITY_ORDER[rng.int(0, RARITY_ORDER.length - 1)]
        const pool = allByRarity[rarity]
        if (pool.length === 0) continue
        chosen.add(pool[rng.int(0, pool.length - 1)])
    }

    return [...chosen]
}

function drawRelic(rng: RNG, ownedRelics: RelicId[]): RelicId {
    const pool = MVP_RELIC_POOL.filter(id => !ownedRelics.includes(id))
    if (pool.length === 0) return MVP_RELIC_POOL[rng.int(0, MVP_RELIC_POOL.length - 1)]
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
