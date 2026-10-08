export type Act = 1 | 2 | 3 | 4
import type { EnemyKey } from './encounters'
import type { EncounterTier } from './rewards'

export interface ActEncounterPools {
    hallwayBosses: EnemyKey[]
    elites: EnemyKey[]
    bosses: EnemyKey[]
}

export function getEncounterActSeed(seed: string, act: Act, tier: EncounterTier, combatIndex: number): string {
    return `${seed}-act-${act}-encounter-${combatIndex}-${tier}`
}

export function getEnemyActSeed(seed: string, act: Act, combatIndex: number, enemyIndex: number): string {
    return `${seed}-act-${act}-enemy-${combatIndex}-${enemyIndex}`
}

export function getActMapSeed(seed: string, act: Act): string {
    return `${seed}-act-${act}`
}

export function getActEncounterPools(act: Act): ActEncounterPools {
    if (act === 4) return { hallwayBosses: [], elites: ['SPIRE_SHIELD', 'SPIRE_SPEAR'], bosses: ['CORRUPT_HEART'] }
    if (act === 3) return { hallwayBosses: ['MAW', 'WRITHING_MASS', 'SPIRE_GROWTH', 'TRANSIENT'], elites: ['GIANT_HEAD', 'NEMESIS', 'REPTOMANCER'], bosses: ['TIME_EATER', 'AWAKENED_ONE', 'DONU'] }
    if (act === 2) return { hallwayBosses: ['CHOSEN', 'BYRD', 'SNECKO'], elites: ['BOOK_OF_STABBING', 'GREMLIN_LEADER', 'TASKMASTER'], bosses: ['THE_CHAMP', 'THE_COLLECTOR', 'BRONZE_AUTOMATON'] }
    return { hallwayBosses: ['LOOTER', 'SLAVER_RED', 'SLAVER_BLUE'], elites: ['GREMLIN_NOB', 'LAGAVULIN', 'SENTRY'], bosses: ['THE_GUARDIAN', 'SLIME_BOSS', 'HEXAGHOST'] }
}
