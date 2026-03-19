import type { CardType, CombatState, EnemyState } from './state'
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
    initialize?: (enemy: EnemyState) => void
    nextIntent: (rng: RNG, enemy: EnemyState, combat: CombatState) => Intent
    onPlayerCardPlayed?: (enemy: EnemyState, cardType: CardType) => void
    onDamageTaken?: (enemy: EnemyState, damage: number) => void
}

function simpleIntent(rng: RNG, _self: EnemyState, attackMin: number, attackMax: number, blockMin: number, blockMax: number): Intent {
    return rng.random() < 0.7
        ? { kind: 'attack', amount: rng.int(attackMin, attackMax) }
        : { kind: 'block', amount: rng.int(blockMin, blockMax) }
}

export const ENEMIES: Record<string, EnemySpec> = {
    SLIME: {
        id: 'SLIME',
        name: 'Slime',
        maxHp: 40,
        nextIntent: (rng, enemy) => simpleIntent(rng, enemy, 5, 10, 5, 8),
    },
    JAW_WORM: {
        id: 'JAW_WORM',
        name: 'Jaw Worm',
        maxHp: 48,
        nextIntent: (rng) => {
            const roll = rng.random()
            if (roll < 0.5) return { kind: 'attack', amount: rng.int(7, 11) }
            if (roll < 0.75) return { kind: 'block', amount: rng.int(6, 9) }
            return { kind: 'buff', desc: 'Strength Up' }
        },
    },
    RED_LOUSE: {
        id: 'RED_LOUSE',
        name: 'Red Louse',
        maxHp: 30,
        nextIntent: (rng, enemy) => simpleIntent(rng, enemy, 4, 7, 5, 7),
    },
    GREEN_LOUSE: {
        id: 'GREEN_LOUSE',
        name: 'Green Louse',
        maxHp: 28,
        nextIntent: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(3, 6) } : { kind: 'debuff', debuff: 'WEAK', stacks: 1 }),
    },
    CULTIST: {
        id: 'CULTIST',
        name: 'Cultist',
        maxHp: 48,
        nextIntent: (rng) => (rng.random() < 0.5 ? { kind: 'attack', amount: rng.int(5, 8) } : { kind: 'buff', desc: 'Ritual' }),
    },
    LOOTER: {
        id: 'LOOTER',
        name: 'Looter',
        maxHp: 44,
        nextIntent: (rng) => {
            const roll = rng.random()
            if (roll < 0.5) return { kind: 'attack', amount: rng.int(7, 10) }
            if (roll < 0.75) return { kind: 'block', amount: rng.int(6, 9) }
            return { kind: 'buff', desc: 'Steal' }
        },
    },
    SPIKE_SLIME_S: {
        id: 'SPIKE_SLIME_S',
        name: 'Spike Slime (S)',
        maxHp: 12,
        nextIntent: (rng, enemy) => simpleIntent(rng, enemy, 3, 6, 3, 5),
    },
    SPIKE_SLIME_M: {
        id: 'SPIKE_SLIME_M',
        name: 'Spike Slime (M)',
        maxHp: 28,
        nextIntent: (rng, enemy) => simpleIntent(rng, enemy, 6, 9, 5, 8),
    },
    SPIKE_SLIME_L: {
        id: 'SPIKE_SLIME_L',
        name: 'Spike Slime (L)',
        maxHp: 50,
        nextIntent: (rng, enemy) => simpleIntent(rng, enemy, 10, 14, 8, 12),
    },
    ACID_SLIME_S: {
        id: 'ACID_SLIME_S',
        name: 'Acid Slime (S)',
        maxHp: 11,
        nextIntent: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(3, 6) } : { kind: 'debuff', debuff: 'WEAK', stacks: 1 }),
    },
    ACID_SLIME_M: {
        id: 'ACID_SLIME_M',
        name: 'Acid Slime (M)',
        maxHp: 28,
        nextIntent: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(6, 9) } : { kind: 'debuff', debuff: 'WEAK', stacks: 1 }),
    },
    ACID_SLIME_L: {
        id: 'ACID_SLIME_L',
        name: 'Acid Slime (L)',
        maxHp: 48,
        nextIntent: (rng) => (rng.random() < 0.6 ? { kind: 'attack', amount: rng.int(9, 13) } : { kind: 'debuff', debuff: 'WEAK', stacks: 1 }),
    },
    FUNGI_BEAST: {
        id: 'FUNGI_BEAST',
        name: 'Fungi Beast',
        maxHp: 43,
        nextIntent: (rng, enemy) => simpleIntent(rng, enemy, 6, 9, 5, 8),
    },
    SNEAKY_GREMLIN: {
        id: 'SNEAKY_GREMLIN',
        name: 'Sneaky Gremlin',
        maxHp: 25,
        nextIntent: (rng) => ({ kind: 'attack', amount: rng.int(5, 8) }),
    },
    MAD_GREMLIN: {
        id: 'MAD_GREMLIN',
        name: 'Mad Gremlin',
        maxHp: 25,
        nextIntent: (rng) => ({ kind: 'attack', amount: rng.int(6, 10) }),
    },
    FAT_GREMLIN: {
        id: 'FAT_GREMLIN',
        name: 'Fat Gremlin',
        maxHp: 32,
        nextIntent: (rng) => ({ kind: 'block', amount: rng.int(7, 10) }),
    },
    SHIELD_GREMLIN: {
        id: 'SHIELD_GREMLIN',
        name: 'Shield Gremlin',
        maxHp: 28,
        nextIntent: (rng) => ({ kind: 'block', amount: rng.int(9, 12) }),
    },
    WIZARD_GREMLIN: {
        id: 'WIZARD_GREMLIN',
        name: 'Gremlin Wizard',
        maxHp: 30,
        nextIntent: (rng) => (rng.random() < 0.5 ? { kind: 'buff', desc: 'Charging' } : { kind: 'attack', amount: rng.int(9, 14) }),
    },
    SLAVER_RED: {
        id: 'SLAVER_RED',
        name: 'Slaver (Red)',
        maxHp: 46,
        nextIntent: (rng) => (rng.random() < 0.7 ? { kind: 'attack', amount: rng.int(7, 11) } : { kind: 'debuff', debuff: 'WEAK', stacks: 1 }),
    },
    SLAVER_BLUE: {
        id: 'SLAVER_BLUE',
        name: 'Slaver (Blue)',
        maxHp: 46,
        nextIntent: (rng) => (rng.random() < 0.7 ? { kind: 'attack', amount: rng.int(7, 11) } : { kind: 'debuff', debuff: 'VULNERABLE', stacks: 1 }),
    },
    GREMLIN_NOB: {
        id: 'GREMLIN_NOB',
        name: 'Gremlin Nob',
        maxHp: 90,
        initialize: (enemy) => {
            enemy.aiState = { turn: 0 }
        },
        nextIntent: (_rng, enemy) => {
            const turn = Number(enemy.aiState?.turn ?? 0)
            enemy.aiState = { ...(enemy.aiState ?? {}), turn: turn + 1 }
            if (turn === 0) return { kind: 'buff', desc: 'Bellow' }
            return turn % 2 === 1 ? { kind: 'attack', amount: 16 } : { kind: 'debuff', debuff: 'VULNERABLE', stacks: 2 }
        },
        onPlayerCardPlayed: (enemy, cardType) => {
            if (cardType !== 'skill') return
            const current = enemy.powers.find(power => power.id === 'STRENGTH')
            if (current) current.stacks += 2
            else enemy.powers.push({ id: 'STRENGTH', stacks: 2 })
        },
    },
    LAGAVULIN: {
        id: 'LAGAVULIN',
        name: 'Lagavulin',
        maxHp: 112,
        initialize: (enemy) => {
            enemy.aiState = { asleep: true, sleepTurns: 2, turn: 0 }
        },
        nextIntent: (_rng, enemy) => {
            const asleep = Boolean(enemy.aiState?.asleep)
            if (asleep) {
                const remaining = Number(enemy.aiState?.sleepTurns ?? 0)
                enemy.aiState = {
                    ...(enemy.aiState ?? {}),
                    sleepTurns: Math.max(remaining - 1, 0),
                    asleep: remaining - 1 > 0,
                }
                return remaining > 1 ? { kind: 'buff', desc: 'Sleep' } : { kind: 'attack', amount: 18 }
            }

            const turn = Number(enemy.aiState?.turn ?? 0)
            enemy.aiState = { ...(enemy.aiState ?? {}), turn: turn + 1, asleep: false }
            return turn % 2 === 0 ? { kind: 'attack', amount: 18 } : { kind: 'debuff', debuff: 'WEAK', stacks: 2 }
        },
        onDamageTaken: (enemy, damage) => {
            if (damage <= 0) return
            if (enemy.aiState?.asleep) enemy.aiState = { ...(enemy.aiState ?? {}), asleep: false, sleepTurns: 0 }
        },
    },
    THE_GUARDIAN: {
        id: 'THE_GUARDIAN',
        name: 'The Guardian',
        maxHp: 250,
        initialize: (enemy) => {
            enemy.aiState = { mode: 'offense', modeShift: 30, cycle: 0 }
            enemy.powers.push({ id: 'THORNS', stacks: 0 })
        },
        nextIntent: (_rng, enemy) => {
            const mode = String(enemy.aiState?.mode ?? 'offense')
            const cycle = Number(enemy.aiState?.cycle ?? 0)
            if (mode === 'defense') {
                enemy.aiState = { ...(enemy.aiState ?? {}), mode: 'offense', modeShift: 30, cycle: 0 }
                const thorns = enemy.powers.find(power => power.id === 'THORNS')
                if (thorns) thorns.stacks = 0
                return { kind: 'attack', amount: 18 }
            }

            enemy.aiState = { ...(enemy.aiState ?? {}), cycle: cycle + 1 }
            const step = cycle % 4
            if (step === 0) return { kind: 'block', amount: 9 }
            if (step === 1) return { kind: 'attack', amount: 30 }
            if (step === 2) return { kind: 'debuff', debuff: 'WEAK', stacks: 2 }
            return { kind: 'attack', amount: 20 }
        },
        onDamageTaken: (enemy, damage) => {
            if (damage <= 0) return
            if (String(enemy.aiState?.mode ?? 'offense') !== 'offense') return
            const next = Number(enemy.aiState?.modeShift ?? 30) - damage
            enemy.aiState = { ...(enemy.aiState ?? {}), modeShift: next }
            if (next > 0) return
            enemy.aiState = { ...(enemy.aiState ?? {}), mode: 'defense', cycle: 0, modeShift: 30 }
            const thorns = enemy.powers.find(power => power.id === 'THORNS')
            if (thorns) thorns.stacks = 4
            else enemy.powers.push({ id: 'THORNS', stacks: 4 })
            enemy.block += 20
            enemy.intent = { kind: 'block', amount: 20 }
        },
    },
}

export function createEnemyFromSpec(rng: RNG, key: keyof typeof ENEMIES, id: string): EnemyState {
    const spec = ENEMIES[key]
    const enemy: EnemyState = {
        id,
        name: spec.name,
        maxHp: spec.maxHp,
        hp: spec.maxHp,
        block: 0,
        powers: [],
        intent: { kind: 'attack', amount: 0 },
        specId: spec.id,
        aiState: {},
    }
    spec.initialize?.(enemy)
    enemy.intent = toEngineIntent(spec.nextIntent(rng, enemy, {
        player: undefined as never,
        enemies: [enemy],
        turn: 'player',
        victory: false,
        defeat: false,
        limbo: [],
    }))
    return enemy
}

export function rollEngineIntentForEnemy(rng: RNG, enemy: EnemyState, combat: CombatState): EnemyState['intent'] {
    const spec = enemy.specId ? ENEMIES[enemy.specId as keyof typeof ENEMIES] : undefined
    if (!spec) return rng.random() < 0.7 ? { kind: 'attack', amount: rng.int(5, 10) } : { kind: 'block', amount: rng.int(5, 8) }
    return toEngineIntent(spec.nextIntent(rng, enemy, combat))
}

export function onEnemyDamaged(enemy: EnemyState, damage: number): void {
    const spec = enemy.specId ? ENEMIES[enemy.specId as keyof typeof ENEMIES] : undefined
    spec?.onDamageTaken?.(enemy, damage)
}

export function onPlayerCardPlayed(enemy: EnemyState, cardType: CardType): void {
    const spec = enemy.specId ? ENEMIES[enemy.specId as keyof typeof ENEMIES] : undefined
    spec?.onPlayerCardPlayed?.(enemy, cardType)
}

export function toEngineIntent(intent: Intent): EnemyState['intent'] {
    if (intent.kind === 'attack') return { kind: 'attack', amount: intent.amount }
    if (intent.kind === 'block') return { kind: 'block', amount: intent.amount }
    if (intent.kind === 'buff') return { kind: 'buff', desc: intent.desc }
    return { kind: 'debuff', debuff: intent.debuff, stacks: intent.stacks }
}
