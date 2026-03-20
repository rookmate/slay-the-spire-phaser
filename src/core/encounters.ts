import { RNG } from './rng'
import type { EncounterTier } from './rewards'

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
    | 'SPIKE_SLIME_S'
    | 'SPIKE_SLIME_M'
    | 'SPIKE_SLIME_L'
    | 'ACID_SLIME_S'
    | 'ACID_SLIME_M'
    | 'ACID_SLIME_L'
    | 'GREMLIN_NOB'
    | 'LAGAVULIN'
    | 'SENTRY'
    | 'THE_GUARDIAN'
    | 'SLIME_BOSS'
    | 'SHELLED_PARASITE'
    | 'SNECKO'
    | 'BOOK_OF_STABBING'
    | 'THE_CHAMP'
    | 'CHOSEN'
    | 'BYRD'
    | 'SPHERIC_GUARDIAN'
    | 'GREMLIN_LEADER'
    | 'RED_SLAVER'
    | 'BLUE_SLAVER'
    | 'TASKMASTER'
    | 'THE_COLLECTOR'
    | 'TORCH_HEAD'
    | 'GREMLIN_MINION'

export function pickWeighted<T>(rng: RNG, items: { item: T; weight: number }[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0)
    let roll = rng.random() * total
    for (const item of items) {
        if ((roll -= item.weight) <= 0) return item.item
    }
    return items[items.length - 1].item
}

export function generateEncounter(rng: RNG, act: 1 | 2, tier: EncounterTier, combatIndex: number): EnemyKey[] {
    if (act === 2) return generateActTwoEncounter(rng, tier)
    if (tier === 'elite') return generateActOneElite(rng)
    if (tier === 'boss') return rng.random() < 0.5 ? ['THE_GUARDIAN'] : ['SLIME_BOSS']
    return generateActOneHallwayEncounter(rng, combatIndex)
}

function generateActOneElite(rng: RNG): EnemyKey[] {
    const pick = rng.int(0, 2)
    if (pick === 0) return ['GREMLIN_NOB']
    if (pick === 1) return ['LAGAVULIN']
    return ['SENTRY', 'SENTRY', 'SENTRY']
}

function generateActTwoEncounter(rng: RNG, tier: EncounterTier): EnemyKey[] {
    if (tier === 'elite') {
        const pick = rng.int(0, 2)
        if (pick === 0) return ['BOOK_OF_STABBING']
        if (pick === 1) return ['GREMLIN_LEADER']
        return ['RED_SLAVER', 'BLUE_SLAVER', 'TASKMASTER']
    }
    if (tier === 'boss') {
        return rng.random() < 0.5
            ? ['THE_CHAMP']
            : ['THE_COLLECTOR', 'TORCH_HEAD', 'TORCH_HEAD']
    }
    const pick = rng.int(0, 7)
    if (pick === 0) return ['CHOSEN']
    if (pick === 1) return ['BYRD']
    if (pick === 2) return ['SPHERIC_GUARDIAN']
    if (pick === 3) return ['CHOSEN', 'BYRD']
    if (pick === 4) return ['SPHERIC_GUARDIAN', 'BYRD']
    if (pick === 5) return ['SHELLED_PARASITE']
    if (pick === 6) return ['SNECKO']
    return ['LOOTER', 'CULTIST']
}

function generateActOneHallwayEncounter(rng: RNG, combatIndex: number): EnemyKey[] {
    if (combatIndex < 3) return firstThree(rng)
    return remaining(rng)
}

function firstThree(rng: RNG): EnemyKey[] {
    const choice = pickWeighted(rng, [
        { item: 'CULTIST' as EnemyKey, weight: 2 },
        { item: 'JAW_WORM' as EnemyKey, weight: 2 },
        { item: 'TWO_LOUSE' as unknown as EnemyKey, weight: 2 },
        { item: 'SMALL_SLIMES' as unknown as EnemyKey, weight: 2 },
    ])

    if (choice === ('TWO_LOUSE' as unknown as EnemyKey)) return [pickLouse(rng), pickLouse(rng)]
    if (choice === ('SMALL_SLIMES' as unknown as EnemyKey)) {
        return rng.random() < 0.5 ? ['SPIKE_SLIME_M', 'ACID_SLIME_S'] : ['ACID_SLIME_M', 'SPIKE_SLIME_S']
    }
    return [choice]
}

function remaining(rng: RNG): EnemyKey[] {
    const choice = pickWeighted(rng, [
        { item: 'GANG_GREMLINS' as unknown as EnemyKey, weight: 1 },
        { item: 'LARGE_SLIME' as unknown as EnemyKey, weight: 2 },
        { item: 'SWARM_SLIMES' as unknown as EnemyKey, weight: 1 },
        { item: 'SLAVER_BLUE' as EnemyKey, weight: 2 },
        { item: 'SLAVER_RED' as EnemyKey, weight: 1 },
        { item: 'THREE_LOUSE' as unknown as EnemyKey, weight: 2 },
        { item: 'FUNGI_PAIR' as unknown as EnemyKey, weight: 2 },
        { item: 'EXOR_THUGS' as unknown as EnemyKey, weight: 1.5 },
        { item: 'EXOR_WILDLIFE' as unknown as EnemyKey, weight: 1.5 },
        { item: 'LOOTER' as EnemyKey, weight: 2 },
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
        const second = pickWeighted(rng, [
            { item: (rng.random() < 0.5 ? 'SLAVER_RED' : 'SLAVER_BLUE') as EnemyKey, weight: 1 },
            { item: 'CULTIST' as EnemyKey, weight: 1 },
            { item: 'LOOTER' as EnemyKey, weight: 1 },
        ])
        return [first, second]
    }
    if (choice === ('EXOR_WILDLIFE' as unknown as EnemyKey)) {
        return [rng.random() < 0.5 ? 'FUNGI_BEAST' : 'JAW_WORM', rng.random() < 0.5 ? pickLouse(rng) : pickMediumSlime(rng)]
    }
    return [choice]
}

function pickLouse(rng: RNG): EnemyKey {
    return rng.random() < 0.5 ? 'RED_LOUSE' : 'GREEN_LOUSE'
}

function pickMediumSlime(rng: RNG): EnemyKey {
    return rng.random() < 0.5 ? 'SPIKE_SLIME_M' : 'ACID_SLIME_M'
}
