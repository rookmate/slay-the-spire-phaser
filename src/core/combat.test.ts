import { getEnemyActSeed } from './acts'
import { getRunBoss } from './campaign'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCardInstance } from './cards'
import { applyCombatVictory, createCombatEngine } from './combat'
import { createEnemyState, rollEngineIntentForEnemy } from './enemies'
import { createDummyEnemy, createPlayerFromDeck, Engine } from './engine'
import { RNG } from './rng'
import { createNewRun, loadRun, saveRun } from './run'

afterEach(() => vi.unstubAllGlobals())

describe('encounter setup and completion', () => {
    it('starts the Guardian at its first move and advances once per turn', () => {
        const run = Array.from({ length: 30 }, (_, i) => createNewRun(`guardian-${i}`)).find(run => getRunBoss(run) === 'THE_GUARDIAN')!
        const engine = createCombatEngine(run, 'boss')
        const enemy = engine.state.enemies[0]
        expect(enemy.specId).toBe('THE_GUARDIAN')
        expect(enemy.intent).toMatchObject({ kind: 'buff', desc: 'Charging Up', effects: [{ kind: 'block', amount: 9, target: 'self' }] })
        expect(enemy.aiState?.turn).toBe(1)
        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()
        expect(enemy.intent).toMatchObject({ kind: 'attack', amount: 32 })
        expect(enemy.aiState?.turn).toBe(2)
    })

    it.each([3, 7])('starts fresh enemies at their scaled maximum on ascension %i', asc => {
        const run = createNewRun('scaled-enemies', asc)
        const engine = createCombatEngine(run, 'monster')
        for (const [index, enemy] of engine.state.enemies.entries()) {
            const base = createEnemyState(enemy.specId!, enemy.id, run.asc, new RNG(getEnemyActSeed(run.seed, run.act, 0, index)))
            expect(enemy.maxHp).toBe(base.maxHp)
            expect(enemy.hp).toBe(enemy.maxHp)
            if (enemy.aiState?.turn !== undefined) expect(enemy.aiState.turn).toBe(1)
        }
    })

    it('applies Preserved Insect to both current and maximum elite health', () => {
        const run = createNewRun('insect')
        run.relics.push('PRESERVED_INSECT')
        for (const [index, enemy] of createCombatEngine(run, 'elite').state.enemies.entries()) {
            expect(enemy.maxHp).toBe(Math.round(createEnemyState(enemy.specId!, enemy.id, run.asc, new RNG(getEnemyActSeed(run.seed, run.act, 0, index))).maxHp * 0.75))
            expect(enemy.hp).toBe(enemy.maxHp)
        }
    })

    it('samples the ascension opening without advancing AI twice', () => {
        const run = createNewRun('act-two-opening', 7)
        run.act = 2
        const engine = createCombatEngine(run, 'monster')
        for (const [index, enemy] of engine.state.enemies.entries()) {
            if (enemy.aiState?.turn !== undefined) expect(enemy.aiState.turn).toBe(1)
            const fresh = createEnemyState(enemy.specId!, enemy.id, run.asc, new RNG(getEnemyActSeed(run.seed, run.act, 0, index)))
            rollEngineIntentForEnemy(new RNG('opening'), fresh, engine.state)
            expect(enemy.aiState?.turn).toBe(fresh.aiState?.turn)
        }
    })

    it('persists Feed health before post-combat healing and through save/load', () => {
        let saved: string | null = null
        vi.stubGlobal('localStorage', {
            setItem: (_key: string, value: string) => { saved = value },
            getItem: () => saved,
        })
        const run = createNewRun('feed-persistence')
        run.deck = [createCardInstance('FEED')]
        const player = createPlayerFromDeck(run.seed, run.deck, 78, 80)
        player.hand = player.drawPile.splice(0)
        const enemy = createDummyEnemy('enemy')
        enemy.hp = 10
        const engine = new Engine(run.seed, player, [enemy])
        engine.playCard(player.hand[0], [enemy.id])
        engine.runUntilIdle()
        applyCombatVictory(run, player)
        saveRun(run)

        expect(loadRun()?.player).toEqual({ hp: 83, maxHp: 83 })
        const next = createCombatEngine(loadRun()!, 'monster')
        expect(next.state.player.maxHp).toBe(83)
        expect(next.state.player.hp).toBe(83)
        expect(run.combatCount).toBe(1)
    })
})
