import { test, expect } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { createCardInstance } from '../../src/core/cards'
import { ENEMIES } from '../../src/core/enemies'
import { boot, clickText, dragCard, inspect } from './driver'

test.use({ hasTouch: true })

test('all enemy portraits load and a crowded combat keeps the inspector and targets usable', async ({ page }) => {
    const run = createNewRun({ seed: 'art-inspection', character: 'defect' }); run.neowCompleted = true; run.act = 3
    run.deck = ['ELECTRODYNAMICS', 'ZAP', 'DEFEND_DEFECT', 'DEFEND_DEFECT', 'DEFEND_DEFECT'].map(id => createCardInstance(id))
    run.pendingRoom = { scene: 'Combat', roomKind: 'elite' }
    run.eventCombat = { enemies: ['NEMESIS', 'GIANT_HEAD', 'DARKLING', 'SPIKER', 'REPULSOR'], rewards: { tier: 'elite', items: [] } }
    const errors = await boot(page, run), ui = await inspect(page)
    const missing = await page.evaluate(ids => ids.filter(id => !window.__testGame.textures.exists(`enemy:${id}`)), Object.keys(ENEMIES))
    expect(missing).toEqual([]); expect(ui.enemies).toHaveLength(5)
    for (const enemy of ui.enemies) expect(enemy.bounds.y + enemy.bounds.height).toBeLessThan(ui.cards[0].y)
    const card = ui.cards.find(c => c.defId === 'ELECTRODYNAMICS')!
    await page.mouse.move(ui.canvas.x + (card.x + 8) * ui.canvas.scaleX, ui.canvas.y + (card.y + 45) * ui.canvas.scaleY)
    await expect.poll(async () => (await inspect(page)).texts.some(t => t.depth === 5900 && t.text === 'Electrodynamics')).toBe(true)
    const detail = (await inspect(page)).texts.filter(t => t.depth === 5900)
    expect(detail.some(t => t.text.includes('Channel 2 Lightning'))).toBe(true)
    for (const text of detail) { expect(text.y).toBeGreaterThan(0); expect(text.y + text.height).toBeLessThan(450) }
    await dragCard(page, card.id)
    const after = await inspect(page)
    expect(after.state!.player.hand.some(c => c.instanceId === card.id)).toBe(false)
    expect(after.texts.filter(t => t.depth === 5900)).toHaveLength(0)
    expect(errors).toEqual([])
})

test('music and effects settings are independent and survive reload', async ({ page }) => {
    const errors = await boot(page); await clickText(page, 'Settings')
    await clickText(page, 'Music: on'); await clickText(page, 'Music +'); await clickText(page, 'FX -')
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sts_settings_v1')!))
    expect(saved.music).toBe(false); expect(saved.musicVolume).toBeCloseTo(0.55); expect(saved.effectsVolume).toBeCloseTo(0.9)
    await page.reload(); await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    await clickText(page, 'Settings'); expect((await inspect(page)).texts.some(t => t.text === 'Music: off')).toBe(true)
    expect(errors).toEqual([])
})

test('touch and keyboard inspection do not play cards and stay above pending choices', async ({ page }) => {
    const run = createNewRun({ seed: 'inspection-access' }); run.neowCompleted = true
    run.deck = ['ARMAMENTS', 'LESSON_LEARNED', 'DEFEND', 'STRIKE', 'STRIKE'].map(id => createCardInstance(id, id === 'LESSON_LEARNED' ? 1 : 0))
    run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    const errors = await boot(page, run), ui = await inspect(page)
    const lesson = ui.cards.find(c => c.defId === 'LESSON_LEARNED')!, index = ui.state!.player.hand.findIndex(c => c.defId === 'LESSON_LEARNED')
    await page.keyboard.press(`Alt+${index + 1}`)
    expect((await inspect(page)).texts.some(t => t.depth === 5900 && t.text.includes('Exhaust'))).toBe(true)
    await page.keyboard.press('Escape')
    await page.touchscreen.tap(ui.canvas.x + (lesson.x + 110) * ui.canvas.scaleX, ui.canvas.y + (lesson.y + 170) * ui.canvas.scaleY)
    expect((await inspect(page)).texts.some(t => t.depth === 5900 && t.text.includes('Exhaust'))).toBe(true)
    expect((await inspect(page)).state!.player.hand).toEqual(ui.state!.player.hand)
    await page.keyboard.press('Escape'); await dragCard(page, ui.cards.find(c => c.defId === 'ARMAMENTS')!.id)
    const choice = await inspect(page), locked = choice.cards.find(c => c.defId === 'LESSON_LEARNED' && c.depth === 7000)!
    expect(locked.enabled).toBe(false)
    await page.touchscreen.tap(choice.canvas.x + (locked.x + 110) * choice.canvas.scaleX, choice.canvas.y + (locked.y + 170) * choice.canvas.scaleY)
    const after = await inspect(page)
    expect(after.texts.some(t => t.depth > 7000 && t.text.includes('Exhaust'))).toBe(true)
    expect(after.choice!.id).toBe(choice.choice!.id); expect(after.state!.player.hand).toEqual(choice.state!.player.hand)
    expect(errors).toEqual([])
})
