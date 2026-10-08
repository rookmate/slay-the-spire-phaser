import { expect, test } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { createDefaultMeta, getCharacterProgress } from '../../src/core/meta'
import { getRunMap } from '../../src/core/map'
import { boot, clickMapNode, clickPoint, clickText, expectScene, inspect, reloadRun } from './driver'

test('character and seeded setup survive rerenders, and replacing a run needs confirmation', async ({ page }) => {
    const errors = await boot(page)
    const original = createNewRun({ seed: 'keep-this-run' }), meta = createDefaultMeta()
    Object.assign(getCharacterProgress(meta, 'silent'), { unlocked: true, ascension: 2 })
    await page.evaluate(({ original, meta }) => {
        localStorage.setItem('sts_run_v7', JSON.stringify(original))
        localStorage.setItem('sts_meta_v2', JSON.stringify(meta))
    }, { original, meta })
    await page.reload(); await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    await clickText(page, 'Silent'); await clickText(page, 'Seeded')
    await page.getByRole('textbox', { name: 'Run seed' }).fill('redesigned-seed')
    await clickText(page, '+')
    await expect(page.getByRole('textbox', { name: 'Run seed' })).toHaveValue('redesigned-seed')
    await expect(page.getByRole('textbox', { name: 'Run seed' })).toHaveCount(1)
    await clickText(page, 'New Run')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sts_run_v7')!).runId)).toBe(original.runId)
    await clickText(page, 'Abandon saved run and start')
    await expectScene(page, 'Neow')
    await expect(page.getByRole('textbox', { name: 'Run seed' })).toHaveCount(0)
    expect((await inspect(page)).run).toMatchObject({ character: 'silent', seed: 'redesigned-seed', mode: 'seeded', asc: 1 })
    expect(errors).toEqual([])
})

test('the map scrolls inside its viewport, ignores drags as selections, and resumes clickable routes', async ({ page }) => {
    const run = createNewRun({ seed: 'ui-map-scroll' }); run.neowCompleted = true
    const errors = await boot(page, run)
    await expectScene(page, 'Map')
    const first = await inspect(page), viewport = first.mapViewport!
    const available = first.mapNodes.find(node => node.enabled && node.y >= viewport.y && node.y + node.height < viewport.y + viewport.height)!
    expect(available).toBeDefined()
    const client = (x: number, y: number) => ({ x: first.canvas.x + x * first.canvas.scaleX, y: first.canvas.y + y * first.canvas.scaleY })
    const start = client(available.x + available.width / 2, available.y + available.height / 2)
    const sidebar = client(70, available.y + available.height / 2)
    await page.mouse.move(sidebar.x, sidebar.y); await page.mouse.down(); await page.mouse.move(start.x, start.y, { steps: 5 }); await page.mouse.up()
    await expectScene(page, 'Map')
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x + 25, start.y, { steps: 3 }); await page.mouse.move(start.x, start.y, { steps: 3 }); await page.mouse.up()
    await expectScene(page, 'Map')
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x, start.y + 45 * first.canvas.scaleY, { steps: 5 }); await page.mouse.up()
    await expectScene(page, 'Map')
    const dragged = await inspect(page)
    expect(dragged.mapNodes.find(node => node.id === available.id)!.y).toBeGreaterThan(available.y)
    await page.mouse.move(first.canvas.x + 70 * first.canvas.scaleX, first.canvas.y + 170 * first.canvas.scaleY)
    await page.mouse.wheel(0, -150); await page.waitForTimeout(80)
    expect((await inspect(page)).mapNodes).toEqual(dragged.mapNodes)
    await reloadRun(page, 'Map')
    const restored = await inspect(page), target = restored.mapNodes.find(node => node.id === available.id)!
    await clickPoint(page, target.x + target.width / 2, target.y + target.height / 2)
    await expectScene(page, 'Combat')
    expect((await inspect(page)).run!.mapProgress?.currentNodeId).toBe(available.id)
    expect(errors).toEqual([])
})

test('the menu fits a small landscape screen and loads its local fonts and artwork', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 416 })
    const errors = await boot(page)
    const display = await page.evaluate(() => {
        const game = window.__testGame, bounds = game.canvas.getBoundingClientRect()
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
            fonts: document.fonts.check('400 16px Barlow') && document.fonts.check('600 32px "Barlow Condensed"'),
            art: ['art:spire', 'art:battle', 'art:cards', 'player:ironclad', 'player:silent', 'player:defect', 'player:watcher'].every(key => game.textures.exists(key)) }
    })
    expect(display.fonts && display.art).toBe(true)
    expect(display.left).toBeGreaterThanOrEqual(0); expect(display.right).toBeLessThanOrEqual(740)
    expect(display.top).toBeGreaterThanOrEqual(0); expect(display.bottom).toBeLessThanOrEqual(416)
    const ui = await inspect(page)
    for (const text of ui.texts.filter(text => text.enabled)) {
        expect(text.x).toBeGreaterThanOrEqual(0); expect(text.x + text.width).toBeLessThanOrEqual(800)
        expect(text.y).toBeGreaterThanOrEqual(0); expect(text.y + text.height).toBeLessThanOrEqual(450)
    }
    await clickText(page, 'Settings'); await expectScene(page, 'Settings')
    expect(errors).toEqual([])
})

test('a route partly clipped at the bottom can be scrolled into view and entered', async ({ page }) => {
    const run = createNewRun({ seed: 'partial-map-node' }); run.neowCompleted = true; run.floor = 6
    const previous = getRunMap(run).nodes.find(node => node.row === 10 && node.edgesTo.length)!
    run.mapProgress = { currentNodeId: previous.id }
    const errors = await boot(page, run), initial = await inspect(page), viewport = initial.mapViewport!
    const target = initial.mapNodes.find(node => node.id === previous.edgesTo[0])!
    await page.mouse.move(initial.canvas.x + (viewport.x + 30) * initial.canvas.scaleX, initial.canvas.y + (viewport.y + 20) * initial.canvas.scaleY)
    await page.mouse.wheel(0, target.y - (viewport.y + viewport.height - 10)); await page.waitForTimeout(100)
    const clipped = (await inspect(page)).mapNodes.find(node => node.id === target.id)!
    expect(clipped.y).toBeLessThan(viewport.y + viewport.height)
    expect(clipped.y + clipped.height).toBeGreaterThan(viewport.y + viewport.height)
    await clickMapNode(page, target.id)
    expect((await inspect(page)).scene).not.toBe('Map')
    expect((await inspect(page)).run!.mapProgress?.currentNodeId).toBe(target.id)
    expect(errors).toEqual([])
})
