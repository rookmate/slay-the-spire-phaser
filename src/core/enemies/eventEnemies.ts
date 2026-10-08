import type { EnemySpec } from './model'
import { asc, attack, block, buff, power, turn } from './helpers'
export const EVENT_ENEMIES: Record<string, EnemySpec> = {
    POINTY: { id: 'POINTY', name: 'Pointy', hp: 30, highHp: 34, nextIntent: (_rng, enemy) => attack(enemy, 5, 6, 2) },
    ROMEO: { id: 'ROMEO', name: 'Romeo', hp: [35, 39], highHp: [37, 41], nextIntent: (_rng, enemy) => {
        const n = turn(enemy)
        if (!n) return buff('Mock')
        return (n - 1) % asc(enemy, 17, 2, 3) === 0 ? attack(enemy, 10, 12, 1, [power('WEAK', asc(enemy, 17, 2, 3), 'player')]) : attack(enemy, 15, 17)
    } },
    BEAR: { id: 'BEAR', name: 'Bear', hp: [38, 42], highHp: [40, 44], nextIntent: (_rng, enemy) => {
        const n = turn(enemy)
        if (!n) return buff('Bear Hug', [power('DEXTERITY', -asc(enemy, 17, 2, 4), 'player')])
        return n % 2 ? attack(enemy, 9, 10, 1, [block(9)]) : attack(enemy, 18, 20)
    } },
}
