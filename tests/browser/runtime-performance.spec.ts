import { expect, test } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { boot, clickText, expectScene, inspect } from './driver'

test('an unlocked idle menu performs no storage polling', async ({ page }) => {
    const errors = await boot(page)
    await clickText(page, 'Settings'); await clickText(page, 'Back')
    const reads = await page.evaluate(async () => {
        let reads = 0
        const getItem = Storage.prototype.getItem
        Storage.prototype.getItem = function (key) { reads++; return getItem.call(this, key) }
        try { await new Promise(resolve => setTimeout(resolve, 1300)); return reads }
        finally { Storage.prototype.getItem = getItem }
    })
    expect(reads).toBe(0); expect(errors).toEqual([])
})

test('foreign settings writes and clear refresh the cached preferences immediately', async ({ page, context }) => {
    await boot(page)
    const other = await context.newPage(); await other.goto('/tests/browser/')
    await other.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    const volume = () => page.evaluate(async () => {
        const path = '/src/core/settings.ts'
        return (await import(path)).loadSettings().volume as number
    })
    expect(await volume()).toBe(0.3)
    await other.evaluate(() => localStorage.setItem('sts_settings_v1', JSON.stringify({ volume: 0.7 })))
    await expect.poll(volume).toBe(0.7)
    await other.evaluate(() => localStorage.clear())
    await expect.poll(volume).toBe(0.3)
    await other.close()
})

test('repeated Continue cycles release combat views, listeners and animation objects', async ({ page }) => {
    const run = createNewRun({ seed: 'runtime-lifetime' }); run.neowCompleted = true
    run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    const errors = await boot(page, run)
    // The game-owned art cache survives scene changes; include its opening-hand
    // textures in the baseline only after their asynchronous extraction finishes.
    const openingHand = (await inspect(page)).state!.player.hand.map(card => card.defId)
    await page.waitForFunction(ids => ids.every(id => window.__testGame.textures.exists(`card-art:${id}`)), openingHand)
    const counts = () => page.evaluate(() => {
        const game = window.__testGame, scene = game.scene.getScene('Combat')
        return {
            destroy: scene.events.listenerCount('destroy'), shutdown: scene.events.listenerCount('shutdown'),
            keyboard: scene.input.keyboard!.eventNames().reduce((sum, event) => sum + scene.input.keyboard!.listenerCount(event), 0),
            game: game.events.eventNames().reduce((sum, event) => sum + game.events.listenerCount(event), 0),
            children: scene.children.length, textures: game.textures.getTextureKeys().length,
        }
    })
    const initial = await counts()
    for (let repeat = 0; repeat < 6; repeat++) {
        await clickText(page, 'Menu'); await clickText(page, 'Main menu'); await expectScene(page, 'MainMenu')
        expect(await page.evaluate(() => window.__testGame.scene.getScene('Combat').children.length)).toBe(0)
        await clickText(page, 'Continue'); await expectScene(page, 'Combat')
        expect(await counts()).toEqual(initial)
    }
    expect(errors).toEqual([])
})
