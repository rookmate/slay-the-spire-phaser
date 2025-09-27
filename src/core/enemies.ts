import type { EnemyState } from './state'
import { RNG } from './rng'

export type Intent =
    | { kind: 'attack'; amount: number }
    | { kind: 'block'; amount: number }
    | { kind: 'buff'; desc: string }
    | { kind: 'debuff'; debuff: 'WEAK' | 'VULNERABLE'; stacks: number }

export interface EnemySpec {
    id: string
    name: string
    maxHp: number
    ai: (rng: RNG, self: EnemyState) => Intent
}

export const ENEMIES: Record<string, EnemySpec> = {
    SLIME: {
        id: 'SLIME', name: 'Slime', maxHp: 40,
        ai: (rng) => (rng.random() < 0.7 ? { kind: 'attack', amount: rng.int(5, 10) } : { kind: 'block', amount: rng.int(5, 8) }),
    },
    JAW_WORM: {
        id: 'JAW_WORM', name: 'Jaw Worm', maxHp: 48,
        ai: (rng) => {
            const roll = rng.random()
            if (roll < 0.5) return { kind: 'attack', amount: rng.int(7, 11) }
            if (roll < 0.75) return { kind: 'block', amount: rng.int(6, 9) }
            return { kind: 'buff', desc: 'Strength Up' }
        },
    },
    RED_LOUSE: {
        id: 'RED_LOUSE', name: 'Red Louse', maxHp: 30,
        ai: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(4, 7) } : { kind: 'block', amount: rng.int(5, 7) }),
    },
    GREEN_LOUSE: {
        id: 'GREEN_LOUSE', name: 'Green Louse', maxHp: 28,
        ai: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(3, 6) } : { kind: 'debuff', debuff: 'WEAK', stacks: 1 }),
    },
    CULTIST: {
        id: 'CULTIST', name: 'Cultist', maxHp: 48,
        ai: (rng) => (rng.random() < 0.5 ? { kind: 'attack', amount: rng.int(5, 8) } : { kind: 'buff', desc: 'Ritual' }),
    },
    LOOTER: {
        id: 'LOOTER', name: 'Looter', maxHp: 44,
        ai: (rng) => {
            const r = rng.random()
            if (r < 0.5) return { kind: 'attack', amount: rng.int(7, 10) }
            if (r < 0.75) return { kind: 'block', amount: rng.int(6, 9) }
            return { kind: 'buff', desc: 'Steal' }
        },
    },
    SPIKE_SLIME_S: { id: 'SPIKE_SLIME_S', name: 'Spike Slime (S)', maxHp: 12, ai: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(3, 6) } : { kind: 'block', amount: rng.int(3, 5) }) },
    SPIKE_SLIME_M: { id: 'SPIKE_SLIME_M', name: 'Spike Slime (M)', maxHp: 28, ai: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(6, 9) } : { kind: 'block', amount: rng.int(5, 8) }) },
    SPIKE_SLIME_L: { id: 'SPIKE_SLIME_L', name: 'Spike Slime (L)', maxHp: 50, ai: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(10, 14) } : { kind: 'block', amount: rng.int(8, 12) }) },
    ACID_SLIME_S: { id: 'ACID_SLIME_S', name: 'Acid Slime (S)', maxHp: 11, ai: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(3, 6) } : { kind: 'debuff', debuff: 'WEAK', stacks: 1 }) },
    ACID_SLIME_M: { id: 'ACID_SLIME_M', name: 'Acid Slime (M)', maxHp: 28, ai: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(6, 9) } : { kind: 'debuff', debuff: 'WEAK', stacks: 1 }) },
    ACID_SLIME_L: { id: 'ACID_SLIME_L', name: 'Acid Slime (L)', maxHp: 48, ai: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(9, 13) } : { kind: 'debuff', debuff: 'WEAK', stacks: 1 }) },
    FUNGI_BEAST: {
        id: 'FUNGI_BEAST', name: 'Fungi Beast', maxHp: 43,
        ai: (rng) => (rng.random() < 0.65 ? { kind: 'attack', amount: rng.int(6, 9) } : { kind: 'block', amount: rng.int(5, 8) }),
    },
    SNEAKY_GREMLIN: {
        id: 'SNEAKY_GREMLIN', name: 'Sneaky Gremlin', maxHp: 25,
        ai: (rng) => ({ kind: 'attack', amount: rng.int(5, 8) }),
    },
    MAD_GREMLIN: {
        id: 'MAD_GREMLIN', name: 'Mad Gremlin', maxHp: 25,
        ai: (rng) => ({ kind: 'attack', amount: rng.int(6, 10) }),
    },
    FAT_GREMLIN: {
        id: 'FAT_GREMLIN', name: 'Fat Gremlin', maxHp: 32,
        ai: (rng) => ({ kind: 'block', amount: rng.int(7, 10) }),
    },
    SHIELD_GREMLIN: {
        id: 'SHIELD_GREMLIN', name: 'Shield Gremlin', maxHp: 28,
        ai: (rng) => ({ kind: 'block', amount: rng.int(9, 12) }),
    },
    WIZARD_GREMLIN: {
        id: 'WIZARD_GREMLIN', name: 'Gremlin Wizard', maxHp: 30,
        ai: (rng) => (rng.random() < 0.5 ? { kind: 'buff', desc: 'Charging' } : { kind: 'attack', amount: rng.int(9, 14) }),
    },
    SLAVER_RED: {
        id: 'SLAVER_RED', name: 'Slaver (Red)', maxHp: 46,
        ai: (rng) => (rng.random() < 0.7 ? { kind: 'attack', amount: rng.int(7, 11) } : { kind: 'debuff', debuff: 'WEAK', stacks: 1 }),
    },
    SLAVER_BLUE: {
        id: 'SLAVER_BLUE', name: 'Slaver (Blue)', maxHp: 46,
        ai: (rng) => (rng.random() < 0.7 ? { kind: 'attack', amount: rng.int(7, 11) } : { kind: 'debuff', debuff: 'VULNERABLE', stacks: 1 }),
    },
    BIRB: {
        id: 'BIRB', name: 'Byrd', maxHp: 35,
        ai: (rng) => (rng.random() < 0.5 ? { kind: 'attack', amount: rng.int(5, 9) } : { kind: 'buff', desc: 'Flap' }),
    },
    SNECKO: {
        id: 'SNECKO', name: 'Snecko', maxHp: 90,
        ai: (rng) => (rng.random() < 0.5 ? { kind: 'attack', amount: rng.int(8, 12) } : { kind: 'debuff', debuff: 'WEAK', stacks: 1 }),
    },
    SNAKE_PLANT: {
        id: 'SNAKE_PLANT', name: 'Snake Plant', maxHp: 75,
        ai: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(7, 11) } : { kind: 'debuff', debuff: 'VULNERABLE', stacks: 1 }),
    },
    SPHERIC_GUARDIAN: {
        id: 'SPHERIC_GUARDIAN', name: 'Spheric Guardian', maxHp: 52,
        ai: (rng) => (rng.random() < 0.6 ? { kind: 'block', amount: rng.int(12, 16) } : { kind: 'attack', amount: rng.int(8, 12) }),
    },
}

export function createEnemyFromSpec(rng: RNG, key: keyof typeof ENEMIES, id: string): EnemyState {
    const spec = ENEMIES[key]
    return {
        id,
        name: spec.name,
        maxHp: spec.maxHp,
        hp: spec.maxHp,
        block: 0,
        powers: [],
        intent: toEngineIntent(spec.ai(rng, undefined as unknown as EnemyState)),
        specId: spec.id,
    }
}

export function rollIntent(rng: RNG, key: keyof typeof ENEMIES): Intent {
    return ENEMIES[key].ai(rng, undefined as unknown as EnemyState)
}

export function toEngineIntent(intent: Intent): EnemyState['intent'] {
    if (intent.kind === 'attack') return { kind: 'attack', amount: intent.amount }
    if (intent.kind === 'block') return { kind: 'block', amount: intent.amount }
    if (intent.kind === 'buff') return { kind: 'buff', desc: intent.desc }
    if (intent.kind === 'debuff') return { kind: 'debuff', debuff: intent.debuff, stacks: intent.stacks }
    return { kind: 'block', amount: 0 }
}


