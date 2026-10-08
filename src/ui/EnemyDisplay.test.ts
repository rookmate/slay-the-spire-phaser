import type Phaser from 'phaser'
import { describe, expect, it, vi } from 'vitest'
import { createEnemyFromSpec } from '../core/enemies'
import { createSimplePlayer, Engine } from '../core/engine'
import { RNG } from '../core/rng'
import { EnemyDisplay } from './EnemyDisplay'

class View {
    events = new Map<string, () => void>()
    destroyed = false
    width = 160
    height = 160
    readonly x: number
    readonly y: number
    readonly texture: string
    constructor(x: number, y: number, texture: string) {
        this.x = x
        this.y = y
        this.texture = texture
    }
    setScale() { return this }
    setInteractive() { return this }
    setOrigin() { return this }
    setAlpha() { return this }
    setDepth() { return this }
    setText() { return this }
    on(event: string, callback: () => void) { this.events.set(event, callback); return this }
    destroy() { this.destroyed = true }
    getBounds() { return { x: this.x - 20, y: this.y - 20, width: 40, height: 40 } }
}

function displayFor(specId: 'GREMLIN_LEADER' | 'SLIME_BOSS') {
    const scene = {
        cameras: { main: { width: 800, height: 450 } },
        add: {
            image: (x: number, y: number, texture: string) => new View(x, y, texture),
            text: (x: number, y: number, text: string) => new View(x, y, text),
        },
    } as unknown as Phaser.Scene
    const enemy = createEnemyFromSpec(new RNG('display'), specId, 'enemy')
    const engine = new Engine('display', createSimplePlayer('display'), [enemy])
    const display = new EnemyDisplay(scene, engine)
    const clicked = vi.fn()
    display.setOnEnemyClick(clicked)
    return { engine, display, clicked }
}

function checkTargets(display: EnemyDisplay, clicked: ReturnType<typeof vi.fn>) {
    const views = display.getEnemySprites() as unknown as View[]
    views.forEach((view, index) => {
        expect(display.getEnemyAtPoint(view.x, view.y)).toBe(index)
        view.events.get('pointerdown')!()
        expect(clicked).toHaveBeenLastCalledWith(index)
    })
}

describe('enemy roster display', () => {
    it('adds targets when Gremlin Leader summons', () => {
        const { engine, display, clicked } = displayFor('GREMLIN_LEADER')
        engine.state.enemies[0].intent = { kind: 'summon' }
        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()
        display.update()
        expect(display.getEnemySprites()).toHaveLength(3)
        checkTargets(display, clicked)
    })

    it('replaces Slime Boss with the split enemies and updates hit testing', () => {
        const { engine, display, clicked } = displayFor('SLIME_BOSS')
        const original = display.getEnemySprites()[0] as unknown as View
        engine.enqueue({ kind: 'DealDamage', source: 'player', target: 'enemy', amount: 80 })
        engine.runUntilIdle()
        display.update()
        expect(original.destroyed).toBe(false)
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle(); display.update()
        expect(original.destroyed).toBe(true)
        expect((display.getEnemySprites() as unknown as View[]).map(view => view.texture))
            .toEqual(['enemy:ACID_SLIME_L', 'enemy:SPIKE_SLIME_L'])
        checkTargets(display, clicked)

        engine.state.enemies[0].hp = 0
        const dead = display.getEnemySprites()[0] as unknown as View
        clicked.mockClear()
        dead.events.get('pointerdown')!()
        expect(clicked).not.toHaveBeenCalled()
        expect(display.getEnemyAtPoint(dead.x, dead.y)).toBe(-1)
    })

    it('rebuilds when identities change without changing the roster size', () => {
        const { engine, display } = displayFor('SLIME_BOSS')
        engine.state.enemies = [createEnemyFromSpec(new RNG('replacement'), 'ACID_SLIME_M', 'replacement')]
        display.update()
        expect((display.getEnemySprites()[0] as unknown as View).texture).toBe('enemy:ACID_SLIME_M')
    })
})
