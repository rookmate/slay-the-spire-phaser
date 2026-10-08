import { expect, type Page } from '@playwright/test'
import type Phaser from 'phaser'
import type { Engine } from '../../src/core/engine'
import type { RunState } from '../../src/core/run'
import type { GeneratedMap } from '../../src/core/map'
import type { Card } from '../../src/ui/Card'
import type { NeowOption } from '../../src/core/neow'
import type { RewardBundle } from '../../src/core/rewards'
import type { ShopInventory } from '../../src/core/progression'
import type { MetaState } from '../../src/core/meta'

type SceneView = Phaser.Scene & {
    engine?: Engine
    run?: RunState
    gmap?: GeneratedMap
    options?: NeowOption[]
    rewards?: RewardBundle
    inventory?: ShopInventory
}

/** The campaign policy needs combat state, not a traversal of every rendered card. */
export async function inspectCombat(page: Page) {
    return page.evaluate(() => {
        const scene = window.__testGame.scene.getScenes(true)[0] as SceneView
        if (scene.scene.key !== 'Combat' || !scene.engine || !scene.run) return null
        return { state: scene.engine.state, legalPlays: scene.engine.getPlayableCards(), choice: scene.engine.getPendingChoice(), act: scene.run.act, floor: scene.run.floor }
    })
}

export async function playCardWithKeyboard(page: Page, id: string, enemyIndex?: number) {
    const input = await page.evaluate(({ id, enemyIndex }) => {
        const game = window.__testGame, scene = game.scene.getScenes(true)[0] as SceneView
        const index = scene.engine!.state.player.hand.findIndex(card => card.instanceId === id)
        const sprites = scene.children.list.filter(object => object.type === 'Image' && (object as Phaser.GameObjects.Image).texture.key.startsWith('enemy:')) as Phaser.GameObjects.Image[]
        const enemy = enemyIndex === undefined ? undefined : sprites[enemyIndex], canvas = game.canvas.getBoundingClientRect()
        return { index, target: enemy && { x: canvas.x + enemy.x * canvas.width / game.scale.width, y: canvas.y + enemy.y * canvas.height / game.scale.height } }
    }, { id, enemyIndex })
    expect(input.index).toBeGreaterThanOrEqual(0)
    expect(input.index).toBeLessThan(10)
    await page.keyboard.press(String((input.index + 1) % 10))
    if (enemyIndex !== undefined) {
        expect(input.target).toBeDefined()
        await page.mouse.click(input.target!.x, input.target!.y)
    }
    await expect.poll(() => page.evaluate(id => {
        const scene = window.__testGame.scene.getScenes(true)[0] as SceneView
        return scene.scene.key !== 'Combat' || !scene.engine!.state.player.hand.some(card => card.instanceId === id)
    }, id), { message: `Play card ${id} through keyboard controls` }).toBe(true)
}

export async function endTurnWithKeyboard(page: Page, turnNumber: number | undefined) {
    await page.keyboard.press('e')
    await expect.poll(() => page.evaluate(before => {
        const scene = window.__testGame.scene.getScenes(true)[0] as SceneView
        return scene.scene.key !== 'Combat' || scene.engine!.state.turnNumber !== before || !!scene.engine!.getPendingChoice()
    }, turnNumber), { message: 'End turn through keyboard controls' }).toBe(true)
}

export async function inspect(page: Page) {
    return page.evaluate(() => {
        const game = window.__testGame
        const scene = game.scene.getScenes(true)[0] as SceneView
        const rect = game.canvas.getBoundingClientRect()
        const texts: Array<{ text: string; x: number; y: number; width: number; height: number; enabled: boolean; depth: number }> = []
        const cards: Array<{ id: string; defId: string; x: number; y: number; width: number; height: number; enabled: boolean; depth: number }> = []
        const mapNodes: Array<{ id: string; x: number; y: number; width: number; height: number; enabled: boolean }> = []
        let mapViewport: { x: number; y: number; width: number; height: number } | undefined
        function visit(objects: Phaser.GameObjects.GameObject[], depth = 0) {
            for (const object of objects) {
                if (object.name === 'played-card') continue
                const view = object as Phaser.GameObjects.Container
                if (!view.visible || view.alpha === 0) continue
                const currentDepth = Math.max(depth, view.depth)
                const bounds = view.getBounds?.()
                if (!bounds) continue
                const position = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
                if (object.getData('mapNodeId')) mapNodes.push({ ...position, id: object.getData('mapNodeId'), enabled: !!object.input?.enabled })
                if (object.getData('mapViewport')) mapViewport = position
                if ('getCardInstance' in object) {
                    const card = (object as Card).getCardInstance()
                    cards.push({ ...position, id: card.instanceId, defId: card.defId, enabled: !!object.input?.enabled, depth: currentDepth })
                } else if (object.type === 'Text') {
                    texts.push({ ...position, text: (object as Phaser.GameObjects.Text).text, enabled: !!object.input?.enabled, depth: currentDepth })
                }
                if (object.type === 'Container') visit(view.list, currentDepth)
            }
        }
        visit(scene.children.list)
        const sprites = scene.children.list.filter(object => object.type === 'Image') as Phaser.GameObjects.Image[]
        return {
            scene: scene.scene.key,
            run: scene.run,
            state: scene.engine?.state,
            legalPlays: scene.engine?.getPlayableCards(),
            choice: scene.engine?.getPendingChoice(),
            map: scene.gmap,
            options: scene.options,
            rewards: scene.rewards,
            inventory: scene.inventory,
            texts, cards, mapNodes, mapViewport,
            enemies: sprites.filter(sprite => sprite.texture.key.startsWith('enemy:')).map(sprite => ({ x: sprite.x, y: sprite.y, bounds: sprite.getBounds() })),
            canvas: { x: rect.x, y: rect.y, scaleX: rect.width / game.scale.width, scaleY: rect.height / game.scale.height },
        }
    })
}

export async function clickPoint(page: Page, x: number, y: number) {
    const { canvas } = await inspect(page)
    await page.mouse.click(canvas.x + x * canvas.scaleX, canvas.y + y * canvas.scaleY)
    await page.waitForTimeout(40)
}

export async function clickText(page: Page, text: string) {
    const ui = await inspect(page)
    const target = ui.texts.filter(t => t.enabled && t.text === text).sort((a, b) => b.depth - a.depth)[0]
    expect(target, `interactive text ${JSON.stringify(text)} in ${ui.scene}`).toBeDefined()
    await clickPoint(page, target.x + target.width / 2, target.y + target.height / 2)
}

export async function clickMapNode(page: Page, id: string) {
    for (let attempt = 0; attempt < 20; attempt++) {
        const ui = await inspect(page), node = ui.mapNodes.find(node => node.id === id), viewport = ui.mapViewport!
        expect(node, `Map node ${id}`).toBeDefined()
        expect(node!.enabled).toBe(true)
        if (node!.y >= viewport.y && node!.y + node!.height < viewport.y + viewport.height) {
            await clickPoint(page, node!.x + node!.width / 2, node!.y + node!.height / 2)
            return
        }
        await page.mouse.move(ui.canvas.x + (viewport.x + viewport.width / 2) * ui.canvas.scaleX, ui.canvas.y + (viewport.y + viewport.height / 2) * ui.canvas.scaleY)
        await page.mouse.wheel(0, node!.y + node!.height >= viewport.y + viewport.height ? 180 : -180)
        await page.waitForTimeout(60)
    }
    throw new Error(`Map node ${id} did not scroll into view`)
}

export async function clickCard(page: Page, id: string) {
    const ui = await inspect(page)
    const target = ui.cards.filter(c => c.enabled && (c.id === id || c.defId === id)).sort((a, b) => b.depth - a.depth)[0]
    expect(target, `interactive card ${id} in ${ui.scene}`).toBeDefined()
    await clickPoint(page, target.x + target.width / 2, target.y + target.height / 2)
}

export async function dragCard(page: Page, id: string, enemyIndex?: number) {
    const ui = await inspect(page)
    const card = ui.cards.find(c => c.id === id)!
    // Start on the exposed left strip even when the hand is crowded.
    const start = { x: card.x + 8, y: card.y + 45 }
    const target = enemyIndex === undefined ? { x: 190, y: 110 } : ui.enemies[enemyIndex]
    const client = (point: { x: number; y: number }) => ({ x: ui.canvas.x + point.x * ui.canvas.scaleX, y: ui.canvas.y + point.y * ui.canvas.scaleY })
    const from = client(start)
    const to = client(target)
    await page.mouse.move(from.x, from.y)
    // Mouse movement lifts the hovered card, so let its layout settle before pressing.
    await page.waitForTimeout(120)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 4 })
    await page.mouse.up()
    await page.waitForTimeout(40)
}

export async function expectScene(page: Page, name: string) {
    await expect.poll(async () => (await inspect(page)).scene).toBe(name)
}

export async function readSavedProgress(page: Page) {
    return page.evaluate(() => {
        // Displaying a notice drains its queue independently of saved progression.
        const { notifications: _notifications, ...meta } = JSON.parse(localStorage.getItem('sts_meta_v2')!) as MetaState
        return { run: localStorage.getItem('sts_run_v7'), meta }
    })
}

export async function boot(page: Page, run?: RunState) {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/tests/browser/')
    await expect.poll(async () => errors.length ? errors.join('; ') : page.evaluate(() => window.__testGame?.scene.isActive('MainMenu') ?? false), { timeout: 15_000 }).toBe(true)
    if (run) {
        await page.evaluate(saved => localStorage.setItem('sts_run_v7', JSON.stringify(saved)), run)
        await page.reload()
        await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
        await clickText(page, 'Continue')
    }
    return errors
}

export async function reloadRun(page: Page, scene: string) {
    await page.reload()
    await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    await clickText(page, 'Continue')
    await expectScene(page, scene)
}
