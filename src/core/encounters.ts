import { RNG } from './rng'

export type EnemyKey =
    | 'CULTIST'
    | 'JAW_WORM'
    | 'RED_LOUSE'
    | 'GREEN_LOUSE'
    | 'FUNGI_BEAST'
    | 'SNEAKY_GREMLIN'
    | 'MAD_GREMLIN'
    | 'FAT_GREMLIN'
    | 'SHIELD_GREMLIN'
    | 'WIZARD_GREMLIN'
    | 'SLAVER_RED'
    | 'SLAVER_BLUE'
    | 'LOOTER'
    | 'SPIKE_SLIME_S' | 'SPIKE_SLIME_M' | 'SPIKE_SLIME_L'
    | 'ACID_SLIME_S' | 'ACID_SLIME_M' | 'ACID_SLIME_L'

export function pickWeighted<T>(rng: RNG, items: { item: T; weight: number }[]): T {
    const total = items.reduce((s, it) => s + it.weight, 0)
    let r = rng.random() * total
    for (const it of items) {
        if ((r -= it.weight) <= 0) return it.item
    }
    return items[items.length - 1].item
}

export function generateEncounter(rng: RNG, combatIndex: number): EnemyKey[] {
    if (combatIndex < 3) return firstThree(rng)
    return remaining(rng)
}

function firstThree(rng: RNG): EnemyKey[] {
    const choice = pickWeighted(rng, [
        { item: 'CULTIST', weight: 2 },
        { item: 'JAW_WORM', weight: 2 },
        { item: 'TWO_LOUSE' as unknown as EnemyKey, weight: 2 },
        { item: 'SMALL_SLIMES' as unknown as EnemyKey, weight: 2 },
    ])
    if (choice === ('TWO_LOUSE' as unknown as EnemyKey)) return [rng.random() < 0.5 ? 'RED_LOUSE' : 'GREEN_LOUSE', rng.random() < 0.5 ? 'RED_LOUSE' : 'GREEN_LOUSE']
    if (choice === ('SMALL_SLIMES' as unknown as EnemyKey)) {
        if (rng.random() < 0.5) return ['SPIKE_SLIME_M', 'ACID_SLIME_S']
        return ['ACID_SLIME_M', 'SPIKE_SLIME_S']
    }
    return [choice as EnemyKey]
}

function remaining(rng: RNG): EnemyKey[] {
    const choice = pickWeighted(rng, [
        { item: 'GANG_GREMLINS' as unknown as EnemyKey, weight: 1 },
        { item: 'LARGE_SLIME' as unknown as EnemyKey, weight: 2 },
        { item: 'SWARM_SLIMES' as unknown as EnemyKey, weight: 1 },
        { item: 'SLAVER_BLUE', weight: 2 },
        { item: 'SLAVER_RED', weight: 1 },
        { item: 'THREE_LOUSE' as unknown as EnemyKey, weight: 2 },
        { item: 'FUNGI_PAIR' as unknown as EnemyKey, weight: 2 },
        { item: 'EXOR_THUGS' as unknown as EnemyKey, weight: 1.5 },
        { item: 'EXOR_WILDLIFE' as unknown as EnemyKey, weight: 1.5 },
        { item: 'LOOTER', weight: 2 },
    ])
    if (choice === ('GANG_GREMLINS' as unknown as EnemyKey)) {
        const pool: EnemyKey[] = ['FAT_GREMLIN', 'FAT_GREMLIN', 'SNEAKY_GREMLIN', 'SNEAKY_GREMLIN', 'MAD_GREMLIN', 'MAD_GREMLIN', 'SHIELD_GREMLIN', 'WIZARD_GREMLIN']
        const picks: EnemyKey[] = []
        for (let i = 0; i < 4 && pool.length > 0; i++) {
            const idx = rng.int(0, pool.length - 1)
            picks.push(pool[idx])
            pool.splice(idx, 1)
        }
        return picks
    }
    if (choice === ('LARGE_SLIME' as unknown as EnemyKey)) return [rng.random() < 0.5 ? 'SPIKE_SLIME_L' : 'ACID_SLIME_L']
    if (choice === ('SWARM_SLIMES' as unknown as EnemyKey)) return ['SPIKE_SLIME_S', 'SPIKE_SLIME_S', 'SPIKE_SLIME_S', 'ACID_SLIME_S', 'ACID_SLIME_S']
    if (choice === ('THREE_LOUSE' as unknown as EnemyKey)) return [pickLouse(rng), pickLouse(rng), pickLouse(rng)]
    if (choice === ('FUNGI_PAIR' as unknown as EnemyKey)) return ['FUNGI_BEAST', 'FUNGI_BEAST']
    if (choice === ('EXOR_THUGS' as unknown as EnemyKey)) {
        const first = rng.random() < 0.5 ? pickLouse(rng) : pickMediumSlime(rng)
        const second = pickWeighted<EnemyKey>(rng, [
            { item: (rng.random() < 0.5 ? 'SLAVER_RED' : 'SLAVER_BLUE') as EnemyKey, weight: 1 },
            { item: 'CULTIST' as EnemyKey, weight: 1 },
            { item: 'LOOTER' as EnemyKey, weight: 1 },
        ])
        return [first, second]
    }
    if (choice === ('EXOR_WILDLIFE' as unknown as EnemyKey)) {
        const first = rng.random() < 0.5 ? 'FUNGI_BEAST' : 'JAW_WORM'
        const second = rng.random() < 0.5 ? pickLouse(rng) : pickMediumSlime(rng)
        return [first as EnemyKey, second]
    }
    return [choice as EnemyKey]
}

function pickLouse(rng: RNG): EnemyKey { return rng.random() < 0.5 ? 'RED_LOUSE' : 'GREEN_LOUSE' }
function pickMediumSlime(rng: RNG): EnemyKey { return rng.random() < 0.5 ? 'SPIKE_SLIME_M' : 'ACID_SLIME_M' }


