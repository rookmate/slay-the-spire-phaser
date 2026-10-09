import { expect, test, type CDPSession, type Page } from '@playwright/test'
import type Phaser from 'phaser'
import type { Engine } from '../../src/core/engine'
import { createCardInstance } from '../../src/core/cards'
import { createNewRun, type RunState } from '../../src/core/run'
import { boot, expectScene, inspect } from './driver'

test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const portrait = { width: 390, height: 844 }, landscape = { width: 844, height: 390 }

async function tapText(page: Page, label: string) {
    const ui = await inspect(page), text = ui.texts.filter(text => text.enabled && text.text === label).sort((a, b) => b.depth - a.depth)[0]
    expect(text, `${label} in ${ui.scene}`).toBeDefined()
    await page.touchscreen.tap(ui.canvas.x + (text.x + text.width / 2) * ui.canvas.scaleX, ui.canvas.y + (text.y + text.height / 2) * ui.canvas.scaleY)
}
async function tapCard(page: Page, id: string) {
    const ui = await inspect(page), card = ui.cards.filter(card => card.id === id && card.enabled).sort((a, b) => b.depth - a.depth)[0]
    await page.touchscreen.tap(ui.canvas.x + (card.x + card.width / 2) * ui.canvas.scaleX, ui.canvas.y + (card.y + card.height / 2) * ui.canvas.scaleY)
}
async function drag(page: Page, cdp: CDPSession, id: string, enemyIndex?: number) {
    const ui = await inspect(page), card = ui.cards.find(card => card.id === id)!
    const from = { x: ui.canvas.x + (card.x + 20) * ui.canvas.scaleX, y: ui.canvas.y + (card.y + 50) * ui.canvas.scaleY }
    const target = enemyIndex === undefined ? { x: 190, y: 110 } : ui.enemies[enemyIndex]
    const to = { x: ui.canvas.x + target.x * ui.canvas.scaleX, y: ui.canvas.y + target.y * ui.canvas.scaleY }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 0 }] })
    for (let step = 1; step <= 5; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 5, y: from.y + (to.y - from.y) * step / 5, id: 0 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(async () => { const after = await inspect(page); return after.scene !== 'Combat' || !after.state!.player.hand.some(card => card.instanceId === id) }).toBe(true)
}
const liveCombat = (page: Page) => page.evaluate(() => {
    const scene = window.__testGame.scene.getScene('Combat') as Phaser.Scene & { engine: Engine; run: RunState }
    return { state: scene.engine.state, choice: scene.engine.getPendingChoice(), elapsed: scene.run.elapsedSeconds }
})

test('portrait startup waits for rotation without hiding the prompt or losing the menu', async ({ page }) => {
    await page.setViewportSize(portrait)
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
    await page.goto('/tests/browser/')
    await expect(page.getByRole('dialog', { name: 'Rotate to play' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.__testGame?.scene.isPaused('MainMenu') ?? false)).toBe(true)
    await expect(page.locator('#app')).toHaveAttribute('inert', '')
    await page.setViewportSize(landscape)
    await expect(page.getByRole('dialog', { name: 'Rotate to play' })).toBeHidden()
    await expectScene(page, 'MainMenu')
    await tapText(page, 'Settings'); await expectScene(page, 'Settings'); await tapText(page, 'Back')
    expect(errors).toEqual([])
})

test('a phone completes a fight and rewards by touch, including menu and settings', async ({ page }) => {
    const run = createNewRun({ seed: 'phone-fight' }); run.neowCompleted = true
    run.deck = Array.from({ length: 5 }, () => createCardInstance('STRIKE'))
    run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    const errors = await boot(page, run), cdp = await page.context().newCDPSession(page)
    const initial = await inspect(page)
    await drag(page, cdp, initial.state!.player.hand[0].instanceId, 0)
    const played = (await inspect(page)).state
    await tapText(page, 'Menu'); await expectScene(page, 'CombatMenu')
    await tapText(page, 'Settings'); await expectScene(page, 'Settings')
    await tapText(page, 'Reduced motion: off'); await tapText(page, 'Back'); await tapText(page, 'Resume')
    await expectScene(page, 'Combat'); expect((await inspect(page)).state).toEqual(played)
    for (let step = 0; step < 30; step++) {
        const ui = await inspect(page)
        if (ui.scene !== 'Combat') break
        const play = ui.legalPlays![0]
        if (play) await drag(page, cdp, play.card.instanceId, ui.state!.enemies.findIndex(enemy => enemy.id === play.targets[0]))
        else await tapText(page, 'End Turn')
    }
    await expectScene(page, 'Rewards')
    await tapText(page, 'Skip')
    if ((await inspect(page)).texts.some(text => text.enabled && text.text === 'Skip Potion')) await tapText(page, 'Skip Potion')
    await tapText(page, 'Continue'); await expectScene(page, 'Map')
    expect((await inspect(page)).run!.player.hp).toBeGreaterThan(0)
    const bounds = await page.locator('canvas').boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(landscape.width + 1)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(landscape.height + 1)
    expect(errors).toEqual([])
})

test('rotating during a partial card choice freezes combat and preserves menu pause ownership', async ({ page }) => {
    const run = createNewRun({ character: 'silent', seed: 'phone-retain' }); run.neowCompleted = true
    const plans = createCardInstance('WELL_LAID_PLANS', 1); plans.bottled = 'BOTTLED_TORNADO'
    run.deck = [plans, ...Array.from({ length: 11 }, () => createCardInstance('DEFEND_SILENT'))]
    run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    const errors = await boot(page, run), cdp = await page.context().newCDPSession(page)
    await drag(page, cdp, plans.instanceId); await tapText(page, 'End Turn')
    const choice = (await inspect(page)).choice!, selected = choice.eligibleInstanceIds.slice(0, 2)
    await tapCard(page, selected[0])
    await page.setViewportSize(portrait)
    await expect(page.getByRole('dialog', { name: 'Rotate to play' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.__testGame.scene.isPaused('Combat'))).toBe(true)
    const paused = await liveCombat(page)
    await page.keyboard.press('e'); await page.waitForTimeout(300)
    expect(await liveCombat(page)).toEqual(paused)
    await page.setViewportSize(landscape); await expectScene(page, 'Combat')
    expect((await inspect(page)).choice).toEqual(choice)
    await tapText(page, 'Menu'); await expectScene(page, 'CombatMenu')
    await page.setViewportSize(portrait); await expect(page.getByRole('dialog', { name: 'Rotate to play' })).toBeVisible()
    await page.setViewportSize(landscape); await expectScene(page, 'CombatMenu')
    expect(await page.evaluate(() => window.__testGame.scene.isPaused('Combat'))).toBe(true)
    await tapText(page, 'Resume'); await tapCard(page, selected[1]); await tapText(page, 'Confirm')
    const after = await inspect(page)
    expect(after.choice).toBeUndefined()
    for (const id of choice.eligibleInstanceIds) expect(after.state!.player.hand.some(card => card.instanceId === id)).toBe(selected.includes(id))
    expect(errors).toEqual([])
})
