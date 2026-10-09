import type { Act } from './acts'
import { RNG } from './rng'

export type EnemyKey = 'POINTY' | 'ROMEO' | 'BEAR' | 'SLAVER_BLUE' | 'BLUE_SLAVER' | 'MUGGER' | 'GREEN_LOUSE' | 'SPIRE_SHIELD' | 'SPIRE_SPEAR' | 'CORRUPT_HEART' | 'SPIKER' | 'REPULSOR' | 'EXPLODER' | 'ORB_WALKER' | 'DARKLING' | 'SPIRE_GROWTH' | 'MAW' | 'TRANSIENT' | 'WRITHING_MASS' | 'DAGGER' | 'REPTOMANCER' | 'NEMESIS' | 'GIANT_HEAD' | 'DONU' | 'DECA' | 'TIME_EATER' | 'AWAKENED_ONE' | 'CULTIST' | 'JAW_WORM' | 'RED_LOUSE' | 'SPIKE_SLIME_S' | 'SPIKE_SLIME_M' | 'SPIKE_SLIME_L' | 'ACID_SLIME_S' | 'ACID_SLIME_M' | 'ACID_SLIME_L' | 'FUNGI_BEAST' | 'SNEAKY_GREMLIN' | 'MAD_GREMLIN' | 'FAT_GREMLIN' | 'SHIELD_GREMLIN' | 'WIZARD_GREMLIN' | 'GREMLIN_NOB' | 'LAGAVULIN' | 'SENTRY' | 'SLIME_BOSS' | 'HEXAGHOST' | 'THE_GUARDIAN' | 'LOOTER' | 'SLAVER_RED' | 'RED_SLAVER' | 'SNECKO' | 'CHOSEN' | 'BYRD' | 'SPHERIC_GUARDIAN' | 'SHELLED_PARASITE' | 'SNAKE_PLANT' | 'CENTURION' | 'MYSTIC' | 'BOOK_OF_STABBING' | 'GREMLIN_MINION' | 'GREMLIN_LEADER' | 'TASKMASTER' | 'TORCH_HEAD' | 'THE_COLLECTOR' | 'THE_CHAMP' | 'BRONZE_ORB' | 'BRONZE_AUTOMATON'

export function pickWeighted<T>(rng: RNG, items: { item: T; weight: number }[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0)
    let roll = rng.random() * total
    for (const item of items) {
        if ((roll -= item.weight) <= 0) return item.item
    }
    return items[items.length - 1].item
}

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


interface EncounterDefinition {
    act: Act
    tier: 'hallway' | 'elite'
    pool?: 'easy' | 'hard' | 'both'
    weight: number
    enemies: (rng: RNG) => EnemyKey[]
}
const fixed = (...keys: EnemyKey[]) => () => [...keys]
const louse = (rng: RNG): EnemyKey => rng.random() < 0.5 ? 'RED_LOUSE' : 'GREEN_LOUSE'
const mediumSlime = (rng: RNG): EnemyKey => rng.random() < 0.5 ? 'SPIKE_SLIME_M' : 'ACID_SLIME_M'
const shapes: EnemyKey[] = ['REPULSOR', 'EXPLODER', 'SPIKER']
function sample(rng: RNG, pool: EnemyKey[], count: number): EnemyKey[] {
    const remaining = [...pool]
    return Array.from({ length: count }, () => remaining.splice(rng.int(0, remaining.length - 1), 1)[0])
}
const hallway = (act: Act, pool: 'easy' | 'hard' | 'both', weight: number, enemies: EncounterDefinition['enemies']): EncounterDefinition => ({ act, tier: 'hallway', pool, weight, enemies })
const elite = (act: Act, ...keys: EnemyKey[]): EncounterDefinition => ({ act, tier: 'elite', weight: 1, enemies: fixed(...keys) })

// Families, weights and compositions: https://slaythespire.wiki.gg/wiki/Monsters
// A family keeps the same ID regardless of the colors/species rolled within it.
export const ENCOUNTERS = {
    CULTIST: hallway(1, 'easy', 2, fixed('CULTIST')),
    JAW_WORM: hallway(1, 'easy', 2, fixed('JAW_WORM')),
    TWO_LOUSE: hallway(1, 'easy', 2, rng => [louse(rng), louse(rng)]),
    SMALL_SLIMES: hallway(1, 'easy', 2, rng => rng.random() < 0.5 ? ['SPIKE_SLIME_M', 'ACID_SLIME_S'] : ['ACID_SLIME_M', 'SPIKE_SLIME_S']),
    GANG_GREMLINS: hallway(1, 'hard', 1, rng => sample(rng, ['FAT_GREMLIN', 'FAT_GREMLIN', 'SNEAKY_GREMLIN', 'SNEAKY_GREMLIN', 'MAD_GREMLIN', 'MAD_GREMLIN', 'SHIELD_GREMLIN', 'WIZARD_GREMLIN'], 4)),
    LARGE_SLIME: hallway(1, 'hard', 2, rng => [rng.random() < 0.5 ? 'SPIKE_SLIME_L' : 'ACID_SLIME_L']),
    SWARM_SLIMES: hallway(1, 'hard', 1, fixed('SPIKE_SLIME_S', 'SPIKE_SLIME_S', 'SPIKE_SLIME_S', 'ACID_SLIME_S', 'ACID_SLIME_S')),
    BLUE_SLAVER: hallway(1, 'hard', 2, fixed('SLAVER_BLUE')),
    RED_SLAVER: hallway(1, 'hard', 1, fixed('SLAVER_RED')),
    THREE_LOUSE: hallway(1, 'hard', 2, rng => [louse(rng), louse(rng), louse(rng)]),
    FUNGI_PAIR: hallway(1, 'hard', 2, fixed('FUNGI_BEAST', 'FUNGI_BEAST')),
    EXOR_THUGS: hallway(1, 'hard', 1.5, rng => {
        const first = rng.random() < 0.5 ? louse(rng) : mediumSlime(rng)
        const second = pickWeighted<EnemyKey>(rng, [
            { item: rng.random() < 0.5 ? 'SLAVER_RED' : 'SLAVER_BLUE', weight: 1 },
            { item: 'CULTIST', weight: 1 }, { item: 'LOOTER', weight: 1 },
        ])
        return [first, second]
    }),
    EXOR_WILDLIFE: hallway(1, 'hard', 1.5, rng => [rng.random() < 0.5 ? 'FUNGI_BEAST' : 'JAW_WORM', rng.random() < 0.5 ? louse(rng) : mediumSlime(rng)]),
    LOOTER: hallway(1, 'hard', 2, fixed('LOOTER')),
    GREMLIN_NOB: elite(1, 'GREMLIN_NOB'),
    LAGAVULIN: elite(1, 'LAGAVULIN'),
    THREE_SENTRIES: elite(1, 'SENTRY', 'SENTRY', 'SENTRY'),
    CHOSEN: hallway(2, 'easy', 2, fixed('CHOSEN')),
    THREE_BYRDS: hallway(2, 'easy', 2, fixed('BYRD', 'BYRD', 'BYRD')),
    SPHERIC_GUARDIAN: hallway(2, 'easy', 2, fixed('SPHERIC_GUARDIAN')),
    SHELLED_PARASITE: hallway(2, 'easy', 2, fixed('SHELLED_PARASITE')),
    TWO_THIEVES: hallway(2, 'easy', 2, fixed('LOOTER', 'MUGGER')),
    CHOSEN_BYRD: hallway(2, 'hard', 2, fixed('CHOSEN', 'BYRD')),
    CHOSEN_CULTIST: hallway(2, 'hard', 3, fixed('CHOSEN', 'CULTIST')),
    SENTRY_GUARDIAN: hallway(2, 'hard', 2, fixed('SENTRY', 'SPHERIC_GUARDIAN')),
    SNAKE_PLANT: hallway(2, 'hard', 6, fixed('SNAKE_PLANT')),
    SNECKO: hallway(2, 'hard', 4, fixed('SNECKO')),
    CENTURION_MYSTIC: hallway(2, 'hard', 6, fixed('CENTURION', 'MYSTIC')),
    THREE_CULTISTS: hallway(2, 'hard', 3, fixed('CULTIST', 'CULTIST', 'CULTIST')),
    PARASITE_FUNGI: hallway(2, 'hard', 3, fixed('SHELLED_PARASITE', 'FUNGI_BEAST')),
    BOOK_OF_STABBING: elite(2, 'BOOK_OF_STABBING'),
    GREMLIN_LEADER: elite(2, 'GREMLIN_LEADER', 'SNEAKY_GREMLIN', 'FAT_GREMLIN'),
    SLAVERS: elite(2, 'RED_SLAVER', 'TASKMASTER', 'BLUE_SLAVER'),
    THREE_DARKLINGS: hallway(3, 'both', 1, fixed('DARKLING', 'DARKLING', 'DARKLING')),
    ORB_WALKER: hallway(3, 'easy', 1, fixed('ORB_WALKER')),
    THREE_SHAPES: hallway(3, 'easy', 1, rng => sample(rng, [...shapes, ...shapes], 3)),
    FOUR_SHAPES: hallway(3, 'hard', 1, rng => sample(rng, [...shapes, ...shapes], 4)),
    MAW: hallway(3, 'hard', 1, fixed('MAW')),
    GUARDIAN_SHAPES: hallway(3, 'hard', 1, rng => [shapes[rng.int(0, 2)], shapes[rng.int(0, 2)], 'SPHERIC_GUARDIAN']),
    SPIRE_GROWTH: hallway(3, 'hard', 1, fixed('SPIRE_GROWTH')),
    TRANSIENT: hallway(3, 'hard', 1, fixed('TRANSIENT')),
    JAW_WORM_HORDE: hallway(3, 'hard', 1, fixed('JAW_WORM', 'JAW_WORM', 'JAW_WORM')),
    WRITHING_MASS: hallway(3, 'hard', 1, fixed('WRITHING_MASS')),
    GIANT_HEAD: elite(3, 'GIANT_HEAD'),
    NEMESIS: elite(3, 'NEMESIS'),
    REPTOMANCER: elite(3, 'REPTOMANCER', 'DAGGER', 'DAGGER'),
    SHIELD_SPEAR: elite(4, 'SPIRE_SHIELD', 'SPIRE_SPEAR'),
} satisfies Record<string, EncounterDefinition>

export type EncounterId = keyof typeof ENCOUNTERS
export interface Encounter { id: EncounterId; enemies: EnemyKey[] }
export interface EncounterHistory { hallway: EncounterId[]; elite?: EncounterId }

const firstHardExclusions: Partial<Record<EncounterId, EncounterId[]>> = {
    TWO_LOUSE: ['THREE_LOUSE'], SMALL_SLIMES: ['SWARM_SLIMES', 'LARGE_SLIME'],
    LOOTER: ['EXOR_THUGS'], BLUE_SLAVER: ['RED_SLAVER', 'EXOR_THUGS'],
}
export function selectEncounter(rng: RNG, act: Act, tier: 'hallway' | 'elite', hallwayCount: number, history: EncounterHistory = { hallway: [] }): Encounter {
    if (act === 4) return { id: 'SHIELD_SPEAR', enemies: ENCOUNTERS.SHIELD_SPEAR.enemies(rng) }
    const pool = hallwayCount < (act === 1 ? 3 : 2) ? 'easy' : 'hard'
    const excluded = tier === 'hallway' ? [...history.hallway.slice(-2)] : history.elite ? [history.elite] : []
    const previous = history.hallway.at(-1)
    if (act === 1 && tier === 'hallway' && hallwayCount === 3 && previous) excluded.push(...(firstHardExclusions[previous] ?? []))
    const candidates = (Object.keys(ENCOUNTERS) as EncounterId[]).filter(id => {
        const entry = ENCOUNTERS[id]
        return entry.act === act && entry.tier === tier && !excluded.includes(id)
            && (tier === 'elite' || entry.pool === pool || entry.pool === 'both')
    })
    const id = pickWeighted(rng, candidates.map(item => ({ item, weight: ENCOUNTERS[item].weight })))
    return { id, enemies: ENCOUNTERS[id].enemies(rng) }
}

export function generateEncounter(rng: RNG, act: Act, tier: 'hallway' | 'elite' | 'boss', combatIndex: number): EnemyKey[] {
    return tier === 'boss' ? bossEncounter(getActBoss(rng, act)) : selectEncounter(rng, act, tier, combatIndex).enemies
}
