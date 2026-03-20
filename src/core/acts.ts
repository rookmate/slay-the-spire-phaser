import type { EnemyKey } from './encounters'
import type { EncounterTier } from './rewards'

export interface ActEncounterPools {
    hallwayBosses: EnemyKey[]
    elites: EnemyKey[]
    bosses: EnemyKey[]
}

export function getEncounterActSeed(seed: string, act: 1 | 2, tier: EncounterTier, combatIndex: number): string {
    return `${seed}-act-${act}-encounter-${combatIndex}-${tier}`
}

export function getEnemyActSeed(seed: string, act: 1 | 2, combatIndex: number, enemyIndex: number): string {
    return `${seed}-act-${act}-enemy-${combatIndex}-${enemyIndex}`
}

export function getActMapSeed(seed: string, act: 1 | 2): string {
    return `${seed}-act-${act}`
}

export function getActEncounterPools(act: 1 | 2): ActEncounterPools {
    if (act === 2) {
        return {
            hallwayBosses: ['SHELLED_PARASITE', 'SNECKO', 'LOOTER', 'CULTIST'],
            elites: ['BOOK_OF_STABBING'],
            bosses: ['THE_CHAMP'],
        }
    }

    return {
        hallwayBosses: ['GREMLIN_NOB', 'LAGAVULIN', 'SENTRY'],
        elites: ['GREMLIN_NOB', 'LAGAVULIN', 'SENTRY'],
        bosses: ['THE_GUARDIAN', 'SLIME_BOSS'],
    }
}
