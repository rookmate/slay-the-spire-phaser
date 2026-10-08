import type { EnemySpec } from './model'
import { asc, attack, block, buff, cards, power, setPower, turn } from './helpers'

export const ACT_FOUR_ENEMIES: Record<string, EnemySpec> = {
    SPIRE_SHIELD: { id: 'SPIRE_SHIELD', name: 'Spire Shield', hp: 110, highHp: 125, tags: ['elite'],
        initialize: enemy => setPower(enemy, 'ARTIFACT', asc(enemy, 18, 1, 2)),
        nextIntent: (rng, enemy) => {
            const n = turn(enemy) % 3
            if (n === 2) return { ...attack(enemy, 34, 38), move: 'smash' }
            if (n === 0) enemy.aiState = { ...enemy.aiState, bashFirst: rng.random() < 0.5 }
            return Boolean(enemy.aiState?.bashFirst) === (n === 0) ? attack(enemy, 12, 14, 1, [power('STRENGTH', -1, 'player')]) : buff('Fortify', [block(30, 'allies')])
        },
        onAttackDamage: (engine, enemy, damage) => { if (enemy.intent?.move === 'smash') engine.gainBlock(enemy.id, asc(enemy, 18, damage, 99)) },
    },
    SPIRE_SPEAR: { id: 'SPIRE_SPEAR', name: 'Spire Spear', hp: 160, highHp: 180, tags: ['elite'],
        initialize: enemy => setPower(enemy, 'ARTIFACT', asc(enemy, 18, 1, 2)),
        nextIntent: (rng, enemy) => {
            const n = turn(enemy)
            if (n % 3 === 1) return attack(enemy, 10, 10, asc(enemy, 3, 3, 4))
            if (n % 3 === 2) enemy.aiState = { ...enemy.aiState, burnFirst: rng.random() < 0.5 }
            const burn = n === 0 || Boolean(enemy.aiState?.burnFirst) === (n % 3 === 2)
            return burn ? attack(enemy, 5, 6, 2, [{ kind: 'cards', id: 'BURN', count: 2, destination: (enemy.asc ?? 0) >= 18 ? 'drawPileTop' : 'discardPile' }]) : buff('Piercer', [power('STRENGTH', 2, 'allies')])
        },
    },
    CORRUPT_HEART: { id: 'CORRUPT_HEART', name: 'Corrupt Heart', hp: 750, highHp: 800, tags: ['boss'],
        initialize: enemy => { enemy.aiState = { damageThisTurn: 0, buffs: 0 } },
        nextIntent: (rng, enemy) => {
            const n = turn(enemy)
            enemy.aiState = { ...enemy.aiState, damageThisTurn: 0 }
            if (n === 0) return buff('Debilitate', [power('VULNERABLE', 2, 'player'), power('WEAK', 2, 'player'), power('FRAIL', 2, 'player'), ...['DAZED', 'SLIMED', 'WOUND', 'BURN', 'VOID'].map(id => cards(id, 1, 'drawPile'))])
            if (n % 3 === 0) {
                const count = Number(enemy.aiState.buffs ?? 0) + 1
                const extra = count === 1 ? [power('ARTIFACT', 2)] : count >= 4 ? [power('STRENGTH', count === 4 ? 10 : 50)] : []
                return { ...buff('Buff', [power('STRENGTH', 2 - Math.min(0, enemy.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0)), ...extra]), move: 'buff' }
            }
            if (n % 3 === 1) enemy.aiState.multiFirst = rng.random() < 0.5
            const multi = Boolean(enemy.aiState.multiFirst) === (n % 3 === 1)
            return multi ? attack(enemy, 2, 2, asc(enemy, 4, 12, 15)) : attack(enemy, 40, 45)
        },
        onIntentResolved: (_engine, enemy, intent) => { if (intent?.move === 'buff') enemy.aiState = { ...enemy.aiState, buffs: Number(enemy.aiState?.buffs ?? 0) + 1 } },
        onAttackDamage: (engine, enemy, _damage, hpLoss) => { if (hpLoss > 0 && Number(enemy.aiState?.buffs ?? 0) >= 3) engine.createCardsInDestination('WOUND', 'discardPile') },
        onPlayerCardPlayed: (engine, enemy) => engine.enqueue({ kind: 'DealDamage', source: enemy.id, target: 'player', amount: asc(enemy, 19, 1, 2) + (Number(enemy.aiState?.buffs ?? 0) >= 2 ? 1 : 0), damageType: 'thorns' }),
    },
}
