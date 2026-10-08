import { cardColors } from './modes/modifiers'
import type { CharacterId } from './characters'
import { selectCardPool } from './contentPools'
import { CARD_DEFS } from './cards'
import type { MetaState } from './meta'
import { POTION_DEFS, type PotionId } from './potions'
export { drawRelic, drawBossRelics } from './relics/pools'
import { RNG } from './rng'
import type { RunState } from './run'

export type CardRarity = 'common' | 'uncommon' | 'rare'
/** Rarity offsets are run state; shop/library previews read them without advancing them. */
export function rollCardRarity(rng: RNG, run: Pick<RunState, 'rareCardOffset'> & Partial<Pick<RunState, 'relics'>>, source: 'hallway' | 'elite' | 'shop', advance = true): CardRarity {
    const baseRare = source === 'elite' ? 10 : source === 'shop' ? 9 : 3
    const uncommon = source === 'elite' ? 40 : 37
    const rare = baseRare * (source !== 'shop' && run.relics?.includes('NLOTHS_GIFT') ? 3 : 1) + (run.rareCardOffset ?? -5)
    const roll = rng.random() * 100
    const rarity = roll < rare ? 'rare' : roll < rare + uncommon ? 'uncommon' : 'common'
    if (advance) {
        if (rarity === 'rare') run.rareCardOffset = -5
        else if (rarity === 'common') run.rareCardOffset = Math.min(40, (run.rareCardOffset ?? -5) + 1)
    }
    return rarity
}
export function cardChoices(rng: RNG, meta: MetaState, count: number, run: Pick<RunState, 'rareCardOffset'> & Partial<Pick<RunState, 'character' | 'relics' | 'unlockedCardIds' | 'modifiers'>>, source: 'hallway' | 'elite' | 'shop' | 'orrery' | 'boss' | 'colorless' = 'hallway'): string[] {
    const all = selectCardPool({ character: run.character ?? 'ironclad', meta, colors: cardColors(run, source !== 'shop'), unlockedIds: run.unlockedCardIds, prismatic: source !== 'shop' && run.relics?.includes('PRISMATIC_SHARD'), source: source === 'colorless' ? 'colorless' : source === 'shop' ? 'shop' : 'reward' })
    const chosen: string[] = []
    for (let i = 0; i < Math.min(count, all.length); i++) {
        const rarity = source === 'boss' ? 'rare' : source === 'colorless' ? rng.random() < 0.3 ? 'rare' : 'uncommon' : rollCardRarity(rng, run, source === 'orrery' ? 'shop' : source, source !== 'shop')
        let pool = all.filter(id => !chosen.includes(id) && CARD_DEFS[id].rarity === rarity)
        if (!pool.length) pool = all.filter(id => !chosen.includes(id))
        if (pool.length) chosen.push(pool[rng.int(0, pool.length - 1)])
    }
    if (source === 'boss') run.rareCardOffset = -5
    return chosen
}
export function drawPotion(rng: RNG, character: CharacterId = 'ironclad', source: 'reward' | 'generated' | 'uniform' = 'reward'): PotionId {
    const roll = rng.random()
    const rarity = roll < 0.65 ? 'common' : roll < 0.9 ? 'uncommon' : 'rare'
    const all = Object.values(POTION_DEFS).filter(p => (!p.character || p.character === character) && (source !== 'generated' || p.id !== 'FRUIT_JUICE'))
    const matching = all.filter(p => p.rarity === rarity)
    const pool = source !== 'uniform' && matching.length ? matching : all
    return pool[rng.int(0, pool.length - 1)].id
}
