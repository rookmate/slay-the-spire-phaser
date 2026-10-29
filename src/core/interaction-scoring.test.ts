import { expect, it } from 'vitest'
import { createCardInstance } from './cards'
import { CHARACTER_IDS } from './characters'
import { Engine, createDummyEnemy, createPlayerFromDeck } from './engine'
import { createDefaultMeta } from './meta'
import { createProfileRun } from './modes/setup'
import { recordCombatStats, calculateScore } from './score'
import { RNG } from './rng'

it.each(CHARACTER_IDS)('scores seeded %s combats at A0–20 without counting self-payments as enemy damage', character => {
    for (let asc = 0; asc <= 20; asc++) {
        const seed = `score-v1-${character}-${asc}`, rng = new RNG(seed)
        const run = createProfileRun(createDefaultMeta(), { seed, character, ascension: asc, mode: 'custom', modifiers: ['DIVERSE', 'MIDAS', 'BINARY'] })
        run.floor = 5
        run.deck = [createCardInstance('BODY_SLAM')]
        const player = createPlayerFromDeck(seed, run.deck, run.player.hp, run.player.maxHp)
        player.hand = player.drawPile.splice(0); player.block = 100
        const enemy = createDummyEnemy('enemy'), engine = new Engine(seed, player, [enemy], { run })
        // An HP payment must leave Champion/Perfect available. Enemy damage must not.
        engine.enqueue({ kind: 'LoseHp', target: player.id, amount: 6 })
        engine.runUntilIdle()
        const enemyHit = rng.int(0, 1) === 1
        if (enemyHit) {
            player.block = 0
            engine.enqueue({ kind: 'DealDamage', source: enemy.id, target: player.id, amount: 3 })
            engine.runUntilIdle(); player.block = 100
        }
        engine.playCard(player.hand[0], [enemy.id]); engine.runUntilIdle()
        expect(engine.state.victory, seed).toBe(true)
        const room = asc % 2 ? 'elite' : 'boss'
        recordCombatStats(run, engine, room)
        const stats = JSON.parse(JSON.stringify(run.stats))
        expect(stats.overkill, seed).toBe(true)
        expect(room === 'elite' ? stats.elites[1] : stats.bosses, seed).toBe(1)
        expect(room === 'elite' ? stats.perfectElites ?? 0 : stats.perfectBosses ?? 0, seed).toBe(Number(!enemyHit))
        const score = calculateScore(run, false), lines = Object.fromEntries(score.lines.map(line => [line.label, line.points]))
        const base = 25 + (room === 'elite' ? 10 : 50) + 25 + (enemyHit ? 0 : room === 'elite' ? 25 : 50)
        expect(lines.Ascension ?? 0, seed).toBe(Math.floor(base * asc * 0.05))
        expect(lines.Overkill, seed).toBe(25)
        expect(lines[room === 'elite' ? 'Champion' : 'Perfect'] ?? 0, seed).toBe(enemyHit ? 0 : room === 'elite' ? 25 : 50)
        expect(calculateScore(JSON.parse(JSON.stringify(run)), false), seed).toEqual(score)
        expect(run.stats).toEqual(stats)
    }
})
