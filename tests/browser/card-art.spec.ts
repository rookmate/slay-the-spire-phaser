import { test, expect } from '@playwright/test'
import type Phaser from 'phaser'
import type { Card } from '../../src/ui/Card'
import { createNewRun } from '../../src/core/run'
import { createCardInstance } from '../../src/core/cards'
import { ILLUSTRATED_CARDS } from '../../src/ui/art/cards'
import { boot, clickText, inspect } from './driver'

test('all illustrated cards use distinct cropped frames, including after refresh, at phone size', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    const errors = await boot(page)
    const rendered = await page.evaluate(async ids => {
        const cardPath = '/src/ui/Card.ts', corePath = '/src/core/cards.ts'
        const { Card } = await import(cardPath), { createCardInstance } = await import(corePath)
        const scene = window.__testGame.scene.getScene('MainMenu'), texture = scene.textures.get('art:cards')
        const frames = ids.map(id => {
            const view = new Card(scene, createCardInstance(id), { x: 0, y: 0 }) as Card
            const art = view.list.find(child => child.type === 'Image') as Phaser.GameObjects.Image
            const frame = { id, name: art.frame.name, x: art.frame.cutX, y: art.frame.cutY, width: art.frame.cutWidth, height: art.frame.cutHeight }
            view.destroy(); return frame
        })
        const view = new Card(scene, createCardInstance('ZAP'), { x: 0, y: 0 }) as Card
        view.refresh(createCardInstance('FORESIGHT', 1))
        const art = view.list.find(child => child.type === 'Image') as Phaser.GameObjects.Image
        const refreshed = { frame: art.frame.name, width: art.displayWidth, height: art.displayHeight, label: view.accessLabel() }
        view.destroy()
        return { frames, refreshed, width: texture.getSourceImage().width, height: texture.getSourceImage().height }
    }, [...ILLUSTRATED_CARDS])
    expect(new Set(rendered.frames.map(f => f.name)).size).toBe(32)
    expect(rendered.width * rendered.height * 4).toBe(4_718_592)
    for (const f of rendered.frames) { expect(f.x + f.width).toBeLessThan(rendered.width); expect(f.y + f.height).toBeLessThan(rendered.height) }
    expect(String(rendered.refreshed.frame)).toBe('31')
    expect(rendered.refreshed.width).toBeCloseTo(112); expect(rendered.refreshed.height).toBeCloseTo(112)
    expect(rendered.refreshed.label).toContain('Foresight+')
    await clickText(page, 'Card Library')
    await page.screenshot({ path: 'test-results/card-art-phone.png' })
    expect(errors).toEqual([])
})

test('missing card atlas leaves card rules, inspection, and gameplay usable', async ({ page }) => {
    await page.route('**/art/cards-detailed.webp', route => route.abort())
    const run = createNewRun({ seed: 'missing-card-art' }); run.neowCompleted = true; run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    run.deck = Array.from({ length: 5 }, () => createCardInstance('DEFEND'))
    const errors = await boot(page, run)
    expect(await page.evaluate(() => window.__testGame.textures.exists('art:cards'))).toBe(false)
    await page.getByRole('button', { name: /^Inspect Defend\./ }).first().press('Enter')
    expect((await inspect(page)).texts.some(t => t.depth === 5900 && t.text === '5 Block.')).toBe(true)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^Play Defend\./ }).first().press('Enter')
    await expect.poll(async () => (await inspect(page)).state!.player.block).toBe(5)
    expect(errors).toEqual([])
})
