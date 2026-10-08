import type { RNG } from '../rng'
import type { EnemyEffect, EnemyIntent, EnemyState, PowerId } from '../state'

export function asc(enemy: EnemyState, threshold: number, normal: number, harder: number): number {
    return (enemy.asc ?? 0) >= threshold ? harder : normal
}
export function turn(enemy: EnemyState): number {
    const value = Number(enemy.aiState?.turn ?? 0)
    enemy.aiState = { ...enemy.aiState, turn: value + 1 }
    return value
}
export function attack(enemy: EnemyState, normal: number, harder = normal, hits = 1, effects: EnemyEffect[] = []): EnemyIntent {
    const threshold = enemy.tags?.includes('boss') ? 4 : enemy.tags?.includes('elite') ? 3 : 2
    const amount = asc(enemy, threshold, normal, harder)
    return hits === 1 ? { kind: 'attack', amount, effects } : { kind: 'multi_attack', amount, hits, effects }
}
export function power(id: PowerId, amount: number, target: 'self' | 'player' | 'allies' = 'self'): EnemyEffect {
    return { kind: 'power', id, amount, target }
}
export function block(amount: number, target: 'self' | 'allies' | 'ally' = 'self'): EnemyEffect { return { kind: 'block', amount, target } }
export function cards(id: string, count: number, destination: 'discardPile' | 'drawPile' = 'discardPile'): Extract<EnemyEffect, { kind: 'cards' }> {
    return { kind: 'cards', id, count, destination }
}
export function buff(desc: string, effects: EnemyEffect[] = []): EnemyIntent { return { kind: 'buff', desc, effects } }
export function setPower(enemy: EnemyState, id: PowerId, amount: number): void {
    const found = enemy.powers.find(p => p.id === id)
    if (found) found.stacks = amount
    else enemy.powers.push({ id, stacks: amount })
}

/** Select a weighted move while respecting its repeat limit. History belongs to this enemy. */
export function chooseMove(rng: RNG, enemy: EnemyState, moves: { id: string; weight: number; limit: number; intent: () => EnemyIntent }[]): EnemyIntent {
    const last = String(enemy.aiState?.lastMove ?? '')
    const repeats = Number(enemy.aiState?.repeats ?? 0)
    const available = moves.filter(move => move.id !== last || repeats < move.limit)
    let roll = rng.random() * available.reduce((sum, move) => sum + move.weight, 0)
    const picked = available.find(move => (roll -= move.weight) < 0) ?? available[available.length - 1]
    enemy.aiState = { ...enemy.aiState, lastMove: picked.id, repeats: last === picked.id ? repeats + 1 : 1 }
    return { ...picked.intent(), move: picked.id }
}
