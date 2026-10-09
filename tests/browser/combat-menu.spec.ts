import { expect, test, type Page } from '@playwright/test'
import type Phaser from 'phaser'
import type { Engine } from '../../src/core/engine'
import { createCardInstance } from '../../src/core/cards'
import { createNewRun, type RunState } from '../../src/core/run'
import { boot, clickCard, clickText, expectScene, inspect, playCardWithKeyboard } from './driver'

test.use({ hasTouch: true })

const pausedCombat = (page: Page) => page.evaluate(() => {
    const scene = window.__testGame.scene.getScene('Combat') as Phaser.Scene & { engine: Engine; run: RunState }
    return { state: scene.engine.state, elapsed: scene.run.elapsedSeconds, choice: scene.engine.getPendingChoice() }
})
function fixture() {
    const run = createNewRun({ seed: 'combat-menu' })
    run.neowCompleted = true
    run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    run.deck = Array.from({ length: 5 }, () => createCardInstance('STRIKE'))
    return run
}

test('menu pauses input and the clock, settings return to the same fight, and Escape cancels before pausing', async ({ page }) => {
    const errors = await boot(page, fixture()), initial = await inspect(page)
    await page.keyboard.press('1'); await page.keyboard.press('Escape')
    await expectScene(page, 'Combat')
    await page.keyboard.press('Escape'); await expectScene(page, 'CombatMenu')
    const paused = await pausedCombat(page)
    await page.keyboard.press('1'); await page.keyboard.press('e'); await page.waitForTimeout(300)
    expect(await pausedCombat(page)).toEqual(paused)
    expect(paused.state).toEqual(initial.state)
    await clickText(page, 'Settings'); await expectScene(page, 'Settings')
    expect((await inspect(page)).texts.some(text => text.text === 'Profile backup')).toBe(false)
    await clickText(page, 'Reduced motion: off')
    await page.keyboard.press('Escape'); await expectScene(page, 'CombatMenu')
    await clickText(page, 'Resume'); await expectScene(page, 'Combat')
    expect((await inspect(page)).state).toEqual(initial.state)
    for (let i = 0; i < 2; i++) {
        await clickText(page, 'Menu'); await expectScene(page, 'CombatMenu')
        await page.keyboard.press('Escape'); await expectScene(page, 'Combat')
    }
    await playCardWithKeyboard(page, initial.state!.player.hand[0].instanceId, 0)
    expect((await inspect(page)).state!.player.energy).toBe(2)
    await clickText(page, 'Menu'); await clickText(page, 'Settings')
    expect((await inspect(page)).texts.some(text => text.text === 'Reduced motion: on')).toBe(true)
    expect(errors).toEqual([])
})

test('pause preserves a pending retain choice and its partially selected cards', async ({ page }) => {
    const run = createNewRun({ character: 'silent', seed: 'retain-menu' })
    run.neowCompleted = true; run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    run.deck = ['WELL_LAID_PLANS', ...Array<string>(11).fill('DEFEND_SILENT')].map(id => createCardInstance(id))
    run.deck[0].upgradeLevel = 1; run.deck[0].bottled = 'BOTTLED_TORNADO'
    const errors = await boot(page, run), initial = await inspect(page)
    await playCardWithKeyboard(page, initial.state!.player.hand.find(card => card.defId === 'WELL_LAID_PLANS')!.instanceId)
    await clickText(page, 'End Turn')
    const choice = (await inspect(page)).choice!, selected = choice.eligibleInstanceIds.slice(0, 2)
    await clickCard(page, selected[0])
    const inspectChoiceCard = async () => {
        const ui = await inspect(page), card = ui.cards.find(card => card.id === selected[1] && card.depth === 7000)!
        await page.touchscreen.tap(ui.canvas.x + (card.x + 110) * ui.canvas.scaleX, ui.canvas.y + (card.y + 170) * ui.canvas.scaleY)
        expect((await inspect(page)).texts.some(text => text.depth === 7001)).toBe(true)
    }
    await inspectChoiceCard(); await page.keyboard.press('Escape'); await expectScene(page, 'Combat')
    expect((await inspect(page)).texts.some(text => text.depth === 7001)).toBe(false)
    expect((await inspect(page)).choice).toEqual(choice)
    await page.keyboard.press('Escape'); await expectScene(page, 'CombatMenu'); await clickText(page, 'Resume')
    await inspectChoiceCard(); await clickText(page, 'Menu'); await expectScene(page, 'CombatMenu')
    expect((await pausedCombat(page)).choice).toEqual(choice)
    await clickText(page, 'Settings'); await clickText(page, 'Game guide'); await expectScene(page, 'Help')
    await page.keyboard.press('Escape'); await expectScene(page, 'Settings')
    await clickText(page, 'Back'); await clickText(page, 'Resume')
    expect((await inspect(page)).choice).toEqual(choice)
    expect((await inspect(page)).texts.some(text => text.depth === 7001)).toBe(false)
    await clickCard(page, selected[1]); await clickText(page, 'Confirm')
    const after = await inspect(page)
    expect(after.choice).toBeUndefined()
    expect(after.state!.turnNumber).toBe(initial.state!.turnNumber! + 1)
    for (const id of selected) expect(after.state!.player.hand.some(card => card.instanceId === id)).toBe(true)
    for (const id of choice.eligibleInstanceIds.filter(id => !selected.includes(id)))
        expect(after.state!.player.discardPile.some(card => card.instanceId === id)).toBe(true)
    expect(errors).toEqual([])
})

test('leaving combat preserves entry potions and relic counters for Continue', async ({ page }) => {
    const run = fixture(); run.relics.push('PEN_NIB'); run.relicState = { PEN_NIB: { counter: 4 } }; run.potions = ['BLOCK_POTION']
    const errors = await boot(page, run), initial = await inspect(page)
    await clickText(page, 'Block'); await clickText(page, 'Use')
    await playCardWithKeyboard(page, initial.state!.player.hand[0].instanceId, 0)
    const played = await inspect(page)
    expect(played.run!.potions).toEqual([])
    expect(played.run!.relicState!.PEN_NIB!.counter).toBe(5)
    await clickText(page, 'Menu'); await clickText(page, 'Main menu'); await expectScene(page, 'MainMenu')
    expect(await page.evaluate(() => window.__testGame.scene.isPaused('Combat'))).toBe(false)
    await clickText(page, 'Continue'); await expectScene(page, 'Combat')
    const restored = await inspect(page)
    expect(restored.state).toEqual(initial.state)
    expect(restored.run!.potions).toEqual(run.potions)
    expect(restored.run!.relicState).toEqual(run.relicState)
    await clickText(page, 'Menu'); await clickText(page, 'Main menu'); await clickText(page, 'Settings')
    expect((await inspect(page)).texts.some(text => text.text === 'Profile backup')).toBe(true)
    await clickText(page, 'Back'); await expectScene(page, 'MainMenu')
    expect(errors).toEqual([])
})
