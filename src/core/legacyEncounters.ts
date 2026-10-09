// Frozen pre-history selector: only used to preserve unfinished fights from older saves.
import type { Act } from './acts'
import { RNG } from './rng'

import { type EnemyKey, type Encounter, type EncounterId, pickWeighted } from './encounters'

export function generateLegacyEncounter(rng: RNG, act: Act, tier: 'hallway' | 'elite', combatIndex: number): Encounter {
    if (act === 4) return { id: 'SHIELD_SPEAR', enemies: ['SPIRE_SHIELD', 'SPIRE_SPEAR'] }
    if (act === 3) {
        if (tier === 'elite') return pick(rng, [['GIANT_HEAD', ['GIANT_HEAD']], ['NEMESIS', ['NEMESIS']], ['REPTOMANCER', ['REPTOMANCER', 'DAGGER', 'DAGGER']]])
        if (combatIndex < 2) return pick(rng, [['THREE_DARKLINGS', ['DARKLING', 'DARKLING', 'DARKLING']], ['ORB_WALKER', ['ORB_WALKER']], ['THREE_SHAPES', ['SPIKER', 'REPULSOR', 'EXPLODER']]])
        return pick(rng, [['FOUR_SHAPES', ['SPIKER', 'SPIKER', 'REPULSOR', 'EXPLODER']], ['THREE_DARKLINGS', ['DARKLING', 'DARKLING', 'DARKLING']], ['SPIRE_GROWTH', ['SPIRE_GROWTH']], ['MAW', ['MAW']], ['TRANSIENT', ['TRANSIENT']], ['WRITHING_MASS', ['WRITHING_MASS']], ['JAW_WORM_HORDE', ['JAW_WORM', 'JAW_WORM', 'JAW_WORM']]])
    }
    if (act === 2) {
        if (tier === 'elite') return pick(rng, [['BOOK_OF_STABBING', ['BOOK_OF_STABBING']], ['GREMLIN_LEADER', ['GREMLIN_LEADER', 'SNEAKY_GREMLIN', 'FAT_GREMLIN']], ['SLAVERS', ['RED_SLAVER', 'TASKMASTER', 'BLUE_SLAVER']]])
        if (combatIndex < 2) return pick(rng, [['CHOSEN', ['CHOSEN']], ['THREE_BYRDS', ['BYRD', 'BYRD', 'BYRD']], ['SPHERIC_GUARDIAN', ['SPHERIC_GUARDIAN']], ['SHELLED_PARASITE', ['SHELLED_PARASITE']], ['TWO_THIEVES', ['LOOTER', 'MUGGER']]])
        return pick(rng, [['CHOSEN_BYRD', ['CHOSEN', 'BYRD']], ['CHOSEN_CULTIST', ['CHOSEN', 'CULTIST']], ['SENTRY_GUARDIAN', ['SENTRY', 'SPHERIC_GUARDIAN']], ['PARASITE_FUNGI', ['SHELLED_PARASITE', 'FUNGI_BEAST']], ['SNAKE_PLANT', ['SNAKE_PLANT']], ['SNECKO', ['SNECKO']], ['CENTURION_MYSTIC', ['CENTURION', 'MYSTIC']], ['THREE_CULTISTS', ['CULTIST', 'CULTIST', 'CULTIST']]])
    }
    if (tier === 'elite') return pick(rng, [['GREMLIN_NOB', ['GREMLIN_NOB']], ['LAGAVULIN', ['LAGAVULIN']], ['THREE_SENTRIES', ['SENTRY', 'SENTRY', 'SENTRY']]])
    return generateActOneHallwayEncounter(rng, combatIndex)
}

function pick(rng: RNG, pool: [EncounterId, EnemyKey[]][]): Encounter {
    const [id, enemies] = pool[rng.int(0, pool.length - 1)]
    return { id, enemies }
}
function encounter(choice: string, enemies: EnemyKey[]): Encounter {
    const id = choice === 'SLAVER_RED' ? 'RED_SLAVER' : choice === 'SLAVER_BLUE' ? 'BLUE_SLAVER' : choice as EncounterId
    return { id, enemies }
}

function generateActOneHallwayEncounter(rng: RNG, combatIndex: number): Encounter {
    if (combatIndex < 3) return firstThree(rng)
    return remaining(rng)
}

function firstThree(rng: RNG): Encounter {
    const choice = pickWeighted<string>(rng, [
        { item: 'CULTIST' as EnemyKey, weight: 2 },
        { item: 'JAW_WORM' as EnemyKey, weight: 2 },
        { item: 'TWO_LOUSE' as const, weight: 2 },
        { item: 'SMALL_SLIMES' as const, weight: 2 },
    ])

    if (choice === ('TWO_LOUSE' as const)) return encounter(choice, [pickLouse(rng), pickLouse(rng)])
    if (choice === ('SMALL_SLIMES' as const)) {
        return encounter(choice, rng.random() < 0.5 ? ['SPIKE_SLIME_M', 'ACID_SLIME_S'] : ['ACID_SLIME_M', 'SPIKE_SLIME_S'])
    }
    return encounter(choice, [choice as EnemyKey])
}

function remaining(rng: RNG): Encounter {
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
        return encounter(choice, picks)
    }
    if (choice === ('LARGE_SLIME' as const)) return encounter(choice, [rng.random() < 0.5 ? 'SPIKE_SLIME_L' : 'ACID_SLIME_L'])
    if (choice === ('SWARM_SLIMES' as const)) return encounter(choice, ['SPIKE_SLIME_S', 'SPIKE_SLIME_S', 'SPIKE_SLIME_S', 'ACID_SLIME_S', 'ACID_SLIME_S'])
    if (choice === ('THREE_LOUSE' as const)) return encounter(choice, [pickLouse(rng), pickLouse(rng), pickLouse(rng)])
    if (choice === ('FUNGI_PAIR' as const)) return encounter(choice, ['FUNGI_BEAST', 'FUNGI_BEAST'])
    if (choice === ('EXOR_THUGS' as const)) {
        const first = rng.random() < 0.5 ? pickLouse(rng) : pickMediumSlime(rng)
        const second = pickWeighted<string>(rng, [
            { item: (rng.random() < 0.5 ? 'SLAVER_RED' : 'SLAVER_BLUE') as EnemyKey, weight: 1 },
            { item: 'CULTIST' as EnemyKey, weight: 1 },
            { item: 'LOOTER' as EnemyKey, weight: 1 },
        ])
        return encounter(choice, [first, second as EnemyKey])
    }
    if (choice === ('EXOR_WILDLIFE' as const)) {
        return encounter(choice, [rng.random() < 0.5 ? 'FUNGI_BEAST' : 'JAW_WORM', rng.random() < 0.5 ? pickLouse(rng) : pickMediumSlime(rng)])
    }
    return encounter(choice, [choice as EnemyKey])
}

function pickLouse(rng: RNG): EnemyKey {
    return rng.random() < 0.5 ? 'RED_LOUSE' : 'GREEN_LOUSE'
}

function pickMediumSlime(rng: RNG): EnemyKey {
    return rng.random() < 0.5 ? 'SPIKE_SLIME_M' : 'ACID_SLIME_M'
}
