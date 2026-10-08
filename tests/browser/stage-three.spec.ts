import { test, expect } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { createProfileRun } from '../../src/core/modes/setup'
import { createDefaultMeta } from '../../src/core/meta'
import { createCardInstance } from '../../src/core/cards'
import { initializeEvent } from '../../src/core/events'
import { boot, clickCard, clickPoint, clickText, dragCard, expectScene, inspect, reloadRun } from './driver'

for (const character of ['silent', 'defect', 'watcher'] as const) test(`${character} combat shows its resources and plays a character card`, async ({ page }) => {
    const run = createNewRun({ character, seed: `ui-${character}` }); run.neowCompleted = true
    run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    const id = character === 'silent' ? 'DEADLY_POISON' : character === 'defect' ? 'ZAP' : 'ERUPTION'
    run.deck = [id, ...Array(4).fill(`DEFEND_${character.toUpperCase()}`)].map(id => createCardInstance(id))
    const errors = await boot(page, run), before = await inspect(page)
    const card = before.state!.player.hand.find(c => c.defId === id)!
    await dragCard(page, card.instanceId, character === 'defect' ? undefined : 0)
    const ui = await inspect(page)
    expect(ui.state!.player.hand.some(c => c.instanceId === card.instanceId)).toBe(false)
    if (character === 'silent') expect(ui.state!.enemies[0].powers).toContainEqual(expect.objectContaining({ id: 'POISON', stacks: 5 }))
    if (character === 'defect') { expect(ui.state!.player.orbs).toHaveLength(2); expect(ui.texts.some(t => t.text.includes('L 3/8'))).toBe(true) }
    if (character === 'watcher') { expect(ui.state!.player.stance).toBe('wrath'); expect(ui.texts.some(t => t.text.includes('WRATH'))).toBe(true) }
    expect(errors).toEqual([])
})

test('draft selections survive reload and enter the map after the fifteenth pick', async ({ page }) => {
    const run = createProfileRun(createDefaultMeta(), { mode: 'custom', seed: 'draft-ui', modifiers: ['DRAFT'] })
    const errors = await boot(page, run)
    await expectScene(page, 'StartingDeck')
    for (let i = 0; i < 15; i++) {
        if (i === 7) await reloadRun(page, 'StartingDeck')
        const ui = await inspect(page); expect(ui.run!.deck).toHaveLength(i)
        await clickCard(page, ui.cards.find(c => c.enabled)!.id)
    }
    await expectScene(page, 'Map'); expect((await inspect(page)).run!.deck).toHaveLength(15)
    expect(errors).toEqual([])
})

test('leaving a chest closed avoids the Cursed Key cost across reload', async ({ page }) => {
    const run = createNewRun({ seed: 'closed-chest' }); run.neowCompleted = true; run.relics.push('CURSED_KEY')
    run.pendingRoom = { scene: 'Chest', rewardSeed: 'closed' }
    const errors = await boot(page, run); await reloadRun(page, 'Chest'); await clickText(page, 'Leave it closed')
    await expectScene(page, 'Map'); const after = (await inspect(page)).run!
    expect(after.deck).toEqual(run.deck); expect(after.relics).toEqual(run.relics); expect(after.floor).toBe(2)
    expect(errors).toEqual([])
})

test('the fifth potion replacement remains reachable and saved', async ({ page }) => {
    const run = createNewRun({ seed: 'belt-ui' }); run.neowCompleted = true; run.maxPotionSlots = 5; run.relics.push('POTION_BELT')
    run.potions = ['BLOCK_POTION', 'STRENGTH_POTION', 'DEXTERITY_POTION', 'FIRE_POTION', 'ENERGY_POTION']
    run.pendingRoom = { scene: 'Rewards', rewards: { tier: 'hallway', items: [{ kind: 'potion', potionId: 'FRUIT_JUICE' }] } }
    const errors = await boot(page, run)
    const button = (await inspect(page)).texts.find(t => t.enabled && t.text === 'Energy Potion')!
    expect(button.x + button.width).toBeLessThanOrEqual(800); expect(button.y + button.height).toBeLessThan(400)
    await clickText(page, 'Energy Potion'); await reloadRun(page, 'Rewards')
    expect((await inspect(page)).run!.potions.at(-1)).toBe('FRUIT_JUICE')
    await clickText(page, 'Continue'); await expectScene(page, 'Map'); expect(errors).toEqual([])
})

test('Match and Keep saves a revealed card and completes five attempts', async ({ page }) => {
    const run = createNewRun({ seed: 'matching-ui' }); run.neowCompleted = true; run.pendingRoom = { scene: 'Event' }
    initializeEvent(run, createDefaultMeta(), 'MATCH_AND_KEEP')
    const errors = await boot(page, run)
    await clickPoint(page, 79, 186); await reloadRun(page, 'Event')
    expect((await inspect(page)).run!.eventState!.matching!.revealed).toEqual([0])
    for (let flips = 0; flips < 12 && !(await inspect(page)).run!.eventState!.resolved; flips++) {
        const board = (await inspect(page)).run!.eventState!.matching!, revealed = board.revealed.length === 2 ? [] : board.revealed
        const index = board.cards.findIndex((_, i) => !board.matched.includes(i) && !revealed.includes(i))
        await clickPoint(page, 79 + index % 6 * 125, 186 + Math.floor(index / 6) * 89)
    }
    await clickText(page, 'Continue'); await expectScene(page, 'Map'); expect(errors).toEqual([])
})

test('settings, daily entry, library, and run history remain reachable from the menu', async ({ page }) => {
    const errors = await boot(page)
    await clickText(page, 'Settings'); await clickText(page, 'Reduced motion: off'); await clickText(page, 'Back')
    await clickText(page, 'Card Library'); await expectScene(page, 'DeckBuilder'); await clickText(page, 'Back')
    await clickText(page, 'Run History'); await expectScene(page, 'RunHistory'); await clickText(page, 'Back')
    await clickText(page, 'Daily'); await clickText(page, 'New Run')
    const daily = (await inspect(page)).run!
    expect(daily.mode).toBe('daily'); expect(daily.modifiers).toHaveLength(3)
    await page.reload(); await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    const ui = await inspect(page)
    expect(ui.texts.some(t => t.enabled && t.text === 'Custom')).toBe(true)
    await clickText(page, 'Settings'); expect((await inspect(page)).texts.some(t => t.text === 'Reduced motion: on')).toBe(true)
    expect(errors).toEqual([])
})

test('choosing a potion replaces a keyboard-selected card target', async ({ page }) => {
    const run = createNewRun({ seed: 'input-potion' }); run.neowCompleted = true
    run.deck = Array.from({ length: 5 }, () => createCardInstance('STRIKE'))
    run.potions = ['FIRE_POTION']; run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    const errors = await boot(page, run), initial = await inspect(page)
    await page.keyboard.press('1'); await clickText(page, 'Fire'); await clickText(page, 'Use')
    await clickPoint(page, initial.enemies[0].x, initial.enemies[0].y)
    const after = await inspect(page)
    expect(after.run!.potions).toEqual([]); expect(after.state!.player.energy).toBe(initial.state!.player.energy)
    expect(after.state!.player.hand).toEqual(initial.state!.player.hand)
    expect(errors).toEqual([])
})

test('keyboard input during a drag cannot change the card being played', async ({ page }) => {
    const run = createNewRun({ seed: 'input-drag' }); run.neowCompleted = true
    run.deck = ['DEFEND', 'DEFEND', 'STRIKE', 'STRIKE', 'BASH'].map(id => createCardInstance(id))
    run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    const errors = await boot(page, run), ui = await inspect(page)
    const strike = ui.cards.find(c => c.defId === 'STRIKE')!, index = ui.state!.player.hand.findIndex(c => c.defId === 'DEFEND')
    await page.mouse.move(ui.canvas.x + (strike.x + 8) * ui.canvas.scaleX, ui.canvas.y + (strike.y + 45) * ui.canvas.scaleY)
    await page.waitForTimeout(120); await page.mouse.down(); await page.keyboard.press(String(index + 1))
    const enemy = ui.enemies[0]
    await page.mouse.move(ui.canvas.x + enemy.x * ui.canvas.scaleX, ui.canvas.y + enemy.y * ui.canvas.scaleY, { steps: 4 }); await page.mouse.up()
    await expect.poll(async () => (await inspect(page)).state!.player.hand.some(c => c.instanceId === strike.id)).toBe(false)
    const after = (await inspect(page)).state!
    expect(after.player.energy).toBe(ui.state!.player.energy - 1); expect(after.player.block).toBe(0)
    expect(after.player.hand.some(c => c.defId === 'BASH')).toBe(true)
    expect(errors).toEqual([])
})
