import type { Act } from './acts'
import { RNG } from './rng'
import type { EncounterTier } from './rewards'

export type EnemyKey = 'POINTY' | 'ROMEO' | 'BEAR' | 'SLAVER_BLUE' | 'BLUE_SLAVER' | 'MUGGER' | 'GREEN_LOUSE' | 'SPIRE_SHIELD' | 'SPIRE_SPEAR' | 'CORRUPT_HEART' | 'SPIKER' | 'REPULSOR' | 'EXPLODER' | 'ORB_WALKER' | 'DARKLING' | 'SPIRE_GROWTH' | 'MAW' | 'TRANSIENT' | 'WRITHING_MASS' | 'DAGGER' | 'REPTOMANCER' | 'NEMESIS' | 'GIANT_HEAD' | 'DONU' | 'DECA' | 'TIME_EATER' | 'AWAKENED_ONE' | 'CULTIST' | 'JAW_WORM' | 'RED_LOUSE' | 'SPIKE_SLIME_S' | 'SPIKE_SLIME_M' | 'SPIKE_SLIME_L' | 'ACID_SLIME_S' | 'ACID_SLIME_M' | 'ACID_SLIME_L' | 'FUNGI_BEAST' | 'SNEAKY_GREMLIN' | 'MAD_GREMLIN' | 'FAT_GREMLIN' | 'SHIELD_GREMLIN' | 'WIZARD_GREMLIN' | 'GREMLIN_NOB' | 'LAGAVULIN' | 'SENTRY' | 'SLIME_BOSS' | 'HEXAGHOST' | 'THE_GUARDIAN' | 'LOOTER' | 'SLAVER_RED' | 'RED_SLAVER' | 'SNECKO' | 'CHOSEN' | 'BYRD' | 'SPHERIC_GUARDIAN' | 'SHELLED_PARASITE' | 'SNAKE_PLANT' | 'CENTURION' | 'MYSTIC' | 'BOOK_OF_STABBING' | 'GREMLIN_MINION' | 'GREMLIN_LEADER' | 'TASKMASTER' | 'TORCH_HEAD' | 'THE_COLLECTOR' | 'THE_CHAMP' | 'BRONZE_ORB' | 'BRONZE_AUTOMATON'

export function pickWeighted<T>(rng: RNG, items: { item: T; weight: number }[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0)
    let roll = rng.random() * total
    for (const item of items) {
        if ((roll -= item.weight) <= 0) return item.item
    }
    return items[items.length - 1].item
}

export function generateEncounter(rng: RNG, act: Act, tier: EncounterTier, combatIndex: number): EnemyKey[] {
    if (act === 4) return tier === 'boss' ? ['CORRUPT_HEART'] : ['SPIRE_SHIELD', 'SPIRE_SPEAR']
    if (tier === 'boss') return bossEncounter(getActBoss(rng, act))
    if (act === 3) {
        if (tier === 'elite') return pick(rng, [['GIANT_HEAD'], ['NEMESIS'], ['REPTOMANCER', 'DAGGER', 'DAGGER']])
        if (combatIndex < 2) return pick(rng, [['DARKLING', 'DARKLING', 'DARKLING'], ['ORB_WALKER'], ['SPIKER', 'REPULSOR', 'EXPLODER']])
        return pick(rng, [['SPIKER', 'SPIKER', 'REPULSOR', 'EXPLODER'], ['DARKLING', 'DARKLING', 'DARKLING'], ['SPIRE_GROWTH'], ['MAW'], ['TRANSIENT'], ['WRITHING_MASS'], ['JAW_WORM', 'JAW_WORM', 'JAW_WORM']])
    }
    if (act === 2) {
        if (tier === 'elite') return pick(rng, [['BOOK_OF_STABBING'], ['GREMLIN_LEADER', 'SNEAKY_GREMLIN', 'FAT_GREMLIN'], ['RED_SLAVER', 'TASKMASTER', 'BLUE_SLAVER']])
        if (combatIndex < 2) return pick(rng, [['CHOSEN'], ['BYRD', 'BYRD', 'BYRD'], ['SPHERIC_GUARDIAN'], ['SHELLED_PARASITE'], ['LOOTER', 'MUGGER']])
        return pick(rng, [['CHOSEN', 'BYRD'], ['CHOSEN', 'CULTIST'], ['SENTRY', 'SPHERIC_GUARDIAN'], ['SHELLED_PARASITE', 'FUNGI_BEAST'], ['SNAKE_PLANT'], ['SNECKO'], ['CENTURION', 'MYSTIC'], ['CULTIST', 'CULTIST', 'CULTIST']])
    }
    if (tier === 'elite') return pick(rng, [['GREMLIN_NOB'], ['LAGAVULIN'], ['SENTRY', 'SENTRY', 'SENTRY']])
    return generateActOneHallwayEncounter(rng, combatIndex)
}

function pick(rng: RNG, pool: EnemyKey[][]): EnemyKey[] { return pool[rng.int(0, pool.length - 1)] }
export const ACT_BOSSES: Record<1 | 2 | 3 | 4, EnemyKey[]> = {
    1: ['THE_GUARDIAN', 'SLIME_BOSS', 'HEXAGHOST'],
    2: ['THE_CHAMP', 'THE_COLLECTOR', 'BRONZE_AUTOMATON'],
    3: ['TIME_EATER', 'AWAKENED_ONE', 'DONU'],
    4: ['CORRUPT_HEART'],
}
export function getActBoss(rng: RNG, act: Act): EnemyKey { return ACT_BOSSES[act][rng.int(0, ACT_BOSSES[act].length - 1)] }
export function bossEncounter(boss: EnemyKey): EnemyKey[] {
    if (boss === 'DONU') return ['DONU', 'DECA']
    if (boss === 'AWAKENED_ONE') return ['CULTIST', 'CULTIST', 'AWAKENED_ONE']
    return [boss]
}

function generateActOneHallwayEncounter(rng: RNG, combatIndex: number): EnemyKey[] {
    if (combatIndex < 3) return firstThree(rng)
    return remaining(rng)
}

function firstThree(rng: RNG): EnemyKey[] {
    const choice = pickWeighted<string>(rng, [
        { item: 'CULTIST' as EnemyKey, weight: 2 },
        { item: 'JAW_WORM' as EnemyKey, weight: 2 },
        { item: 'TWO_LOUSE' as const, weight: 2 },
        { item: 'SMALL_SLIMES' as const, weight: 2 },
    ])

    if (choice === ('TWO_LOUSE' as const)) return [pickLouse(rng), pickLouse(rng)]
    if (choice === ('SMALL_SLIMES' as const)) {
        return rng.random() < 0.5 ? ['SPIKE_SLIME_M', 'ACID_SLIME_S'] : ['ACID_SLIME_M', 'SPIKE_SLIME_S']
    }
    return [choice as EnemyKey]
}

function remaining(rng: RNG): EnemyKey[] {
    const choice = pickWeighted<string>(rng, [
        { item: 'GANG_GREMLINS' as const, weight: 1 },
        { item: 'LARGE_SLIME' as const, weight: 2 },
        { item: 'SWARM_SLIMES' as const, weight: 1 },
        { item: 'SLAVER_BLUE' as EnemyKey, weight: 2 },
        { item: 'SLAVER_RED' as EnemyKey, weight: 1 },
        { item: 'THREE_LOUSE' as const, weight: 2 },
        { item: 'FUNGI_PAIR' as const, weight: 2 },
        { item: 'EXOR_THUGS' as const, weight: 1.5 },
        { item: 'EXOR_WILDLIFE' as const, weight: 1.5 },
        { item: 'LOOTER' as EnemyKey, weight: 2 },
    ])

    if (choice === ('GANG_GREMLINS' as const)) {
        const pool: EnemyKey[] = ['FAT_GREMLIN', 'FAT_GREMLIN', 'SNEAKY_GREMLIN', 'SNEAKY_GREMLIN', 'MAD_GREMLIN', 'MAD_GREMLIN', 'SHIELD_GREMLIN', 'WIZARD_GREMLIN']
        const picks: EnemyKey[] = []
        for (let i = 0; i < 4 && pool.length > 0; i++) {
            const idx = rng.int(0, pool.length - 1)
            picks.push(pool[idx])
            pool.splice(idx, 1)
        }
        return picks
    }
    if (choice === ('LARGE_SLIME' as const)) return [rng.random() < 0.5 ? 'SPIKE_SLIME_L' : 'ACID_SLIME_L']
    if (choice === ('SWARM_SLIMES' as const)) return ['SPIKE_SLIME_S', 'SPIKE_SLIME_S', 'SPIKE_SLIME_S', 'ACID_SLIME_S', 'ACID_SLIME_S']
    if (choice === ('THREE_LOUSE' as const)) return [pickLouse(rng), pickLouse(rng), pickLouse(rng)]
    if (choice === ('FUNGI_PAIR' as const)) return ['FUNGI_BEAST', 'FUNGI_BEAST']
    if (choice === ('EXOR_THUGS' as const)) {
        const first = rng.random() < 0.5 ? pickLouse(rng) : pickMediumSlime(rng)
        const second = pickWeighted<string>(rng, [
            { item: (rng.random() < 0.5 ? 'SLAVER_RED' : 'SLAVER_BLUE') as EnemyKey, weight: 1 },
            { item: 'CULTIST' as EnemyKey, weight: 1 },
            { item: 'LOOTER' as EnemyKey, weight: 1 },
        ])
        return [first, second as EnemyKey]
    }
    if (choice === ('EXOR_WILDLIFE' as const)) {
        return [rng.random() < 0.5 ? 'FUNGI_BEAST' : 'JAW_WORM', rng.random() < 0.5 ? pickLouse(rng) : pickMediumSlime(rng)]
    }
    return [choice as EnemyKey]
}

function pickLouse(rng: RNG): EnemyKey {
    return rng.random() < 0.5 ? 'RED_LOUSE' : 'GREEN_LOUSE'
}

function pickMediumSlime(rng: RNG): EnemyKey {
    return rng.random() < 0.5 ? 'SPIKE_SLIME_M' : 'ACID_SLIME_M'
}
