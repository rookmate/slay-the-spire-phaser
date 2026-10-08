import { CARD_DEFS, getUnlockedCollectibleCards } from './cards'
import type { MetaState } from './meta'
import { POTION_DEFS, type PotionId } from './potions'
import { BOSS_RELIC_POOL, getUnlockedRelicPool, type RelicDef } from './relics'
import { RNG } from './rng'
import type { RelicId, RunState } from './run'

export type CardRarity = 'common' | 'uncommon' | 'rare'
/** Rarity offsets are run state; shop/library previews read them without advancing them. */
export function rollCardRarity(rng: RNG, run: Pick<RunState, 'rareCardOffset'>, source: 'hallway' | 'elite' | 'shop', advance = true): CardRarity {
    const baseRare = source === 'elite' ? 10 : source === 'shop' ? 9 : 3
    const uncommon = source === 'elite' ? 40 : 37
    const rare = baseRare + (run.rareCardOffset ?? -5)
    const roll = rng.random() * 100
    const rarity = roll < rare ? 'rare' : roll < rare + uncommon ? 'uncommon' : 'common'
    if (advance) {
        if (rarity === 'rare') run.rareCardOffset = -5
        else if (rarity === 'common') run.rareCardOffset = Math.min(40, (run.rareCardOffset ?? -5) + 1)
    }
    return rarity
}
export function cardChoices(rng: RNG, meta: MetaState, count: number, run: Pick<RunState, 'rareCardOffset'>, source: 'hallway' | 'elite' | 'shop' | 'boss' | 'colorless' = 'hallway'): string[] {
    const all = source === 'colorless' ? Object.values(CARD_DEFS).filter(c => c.color === 'colorless' && c.poolEnabled && c.rarity).map(c => c.id) : getUnlockedCollectibleCards(meta)
    const chosen: string[] = []
    for (let i = 0; i < Math.min(count, all.length); i++) {
        const rarity = source === 'boss' ? 'rare' : source === 'colorless' ? rng.random() < 0.3 ? 'rare' : 'uncommon' : rollCardRarity(rng, run, source, source !== 'shop')
        let pool = all.filter(id => !chosen.includes(id) && CARD_DEFS[id].rarity === rarity)
        if (!pool.length) pool = all.filter(id => !chosen.includes(id))
        if (pool.length) chosen.push(pool[rng.int(0, pool.length - 1)])
    }
    if (source === 'boss') run.rareCardOffset = -5
    return chosen
}
export function drawRelic(rng: RNG, meta: MetaState, owned: RelicId[], rarity?: RelicDef['rarity']): RelicId {
    const roll = rng.random()
    const selected = rarity ?? (roll < 0.5 ? 'common' : roll < 0.83 ? 'uncommon' : 'rare')
    let pool = getUnlockedRelicPool(meta, selected).filter(id => !owned.includes(id))
    if (!pool.length && !rarity) pool = getUnlockedRelicPool(meta).filter(id => !owned.includes(id))
    return pool.length ? pool[rng.int(0, pool.length - 1)] : 'CIRCLET'
}
export function drawBossRelics(rng: RNG, owned: RelicId[]): RelicId[] {
    const pool = BOSS_RELIC_POOL.filter(id => !owned.includes(id) && (id !== 'BLACK_BLOOD' || owned.includes('BURNING_BLOOD')))
    rng.shuffleInPlace(pool)
    return pool.length ? pool.slice(0, 3) : ['CIRCLET']
}
export function drawPotion(rng: RNG): PotionId {
    const roll = rng.random()
    const rarity = roll < 0.65 ? 'common' : roll < 0.9 ? 'uncommon' : 'rare'
    const all = Object.values(POTION_DEFS)
    const matching = all.filter(p => p.rarity === rarity)
    const pool = matching.length ? matching : all
    return pool[rng.int(0, pool.length - 1)].id
}
