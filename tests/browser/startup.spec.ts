import { expect, test } from '@playwright/test'
import { CHARACTER_IDS } from '../../src/core/characters'
import { createNewRun } from '../../src/core/run'
import { boot, clickText, expectScene } from './driver'

test('character portraits share atlas frames without copied canvas textures', async ({ page }) => {
    const errors = await boot(page)
    const portraits = await page.evaluate(ids => {
        const textures = window.__testGame.textures, atlas = textures.get('art:characters')
        return ids.map((id, index) => {
            const frame = atlas.get(id)
            return { copied: textures.exists(`player:${id}`), x: frame.cutX, y: frame.cutY,
                width: frame.cutWidth, height: frame.cutHeight, source: frame.source === atlas.source[0],
                expectedWidth: atlas.source[0].width / 2, expectedHeight: atlas.source[0].height / 2,
                expectedX: index % 2 * atlas.source[0].width / 2, expectedY: Math.floor(index / 2) * atlas.source[0].height / 2 }
        })
    }, [...CHARACTER_IDS])
    for (const portrait of portraits) {
        expect(portrait.copied).toBe(false); expect(portrait.source).toBe(true)
        expect(portrait.x).toBe(portrait.expectedX); expect(portrait.y).toBe(portrait.expectedY)
        expect(portrait.width).toBe(portrait.expectedWidth); expect(portrait.height).toBe(portrait.expectedHeight)
    }
    expect(await page.evaluate(() => {
        const textures = window.__testGame.textures
        return textures.getTextureKeys().filter(key => /^(art:|enemy:|player:|card-art:)/.test(key)).reduce((sum, key) =>
            sum + textures.get(key).source.reduce((bytes, source) => bytes + source.width * source.height * 4, 0), 0)
    })).toBeLessThanOrEqual(32 * 1024 * 1024)
    expect(errors).toEqual([])
})

test('failed painted portraits and font requests retain playable fallback rendering', async ({ page }) => {
    await page.route('**/art/characters.webp', route => route.abort())
    await page.route('**/fonts/*.woff2', route => route.abort())
    const run = createNewRun({ character: 'watcher', seed: 'fallback-startup' }); run.neowCompleted = true
    run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    const errors = await boot(page, run)
    expect(await page.evaluate(() => {
        const game = window.__testGame
        return !game.textures.exists('art:characters') && ['ironclad', 'silent', 'defect', 'watcher'].every(id => game.textures.exists(`player:${id}`))
    })).toBe(true)
    await clickText(page, 'Menu'); await expectScene(page, 'CombatMenu')
    await clickText(page, 'Resume'); await expectScene(page, 'Combat')
    expect(errors).toEqual([])
})

test('a local HTTP-style context can start a run without randomUUID', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined }))
    const errors = await boot(page)
    await clickText(page, 'New Run'); await expectScene(page, 'Neow')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sts_run_v7')!).runId)).toMatch(/^[0-9a-f]{32}$/)
    expect(errors).toEqual([])
})
