import { expect, test } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { createCardInstance } from '../../src/core/cards'
import { boot, clickPoint, clickText, inspect } from './driver'

for (const reducedMotion of [false, true]) test(`aiming, cancellation and release preserve card ownership with reduced motion ${reducedMotion}`, async ({ page }) => {
    const run = createNewRun({ seed: 'targeting-motion' }); run.neowCompleted = true
    run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    run.deck = ['STRIKE', 'STRIKE', 'DEFEND', 'DEFEND', 'BASH'].map(id => createCardInstance(id))
    run.eventCombat = { enemies: ['ACID_SLIME_M', 'SPIKE_SLIME_M'], rewards: { tier: 'hallway', items: [] } }
    await page.addInitScript(value => localStorage.setItem('sts_settings_v1', JSON.stringify({ reducedMotion: value })), reducedMotion)
    const errors = await boot(page, run), before = await inspect(page)
    const strike = before.cards.find(card => card.defId === 'STRIKE')!
    const client = (x: number, y: number) => ({ x: before.canvas.x + x * before.canvas.scaleX, y: before.canvas.y + y * before.canvas.scaleY })
    const move = async (x: number, y: number) => { const point = client(x, y); await page.mouse.move(point.x, point.y, { steps: 5 }) }
    const pickUp = async () => { await move(strike.x + 8, strike.y + 45); await page.waitForTimeout(180); await page.mouse.down() }
    await pickUp()
    await move(before.enemies[0].x, before.enemies[0].y)
    const aimed = await inspect(page), held = aimed.cards.find(card => card.id === strike.id)!
    // The lifted card stays readable in the hand, outside the enemy's hit box.
    expect(held.x).toBeCloseTo(strike.x, 0)
    expect(held.y).toBeGreaterThan(before.enemies[0].bounds.y + before.enemies[0].bounds.height)
    expect(aimed.texts.some(text => text.text.includes(`Release to play on ${before.state!.enemies[0].name}`))).toBe(true)
    expect(aimed.state).toEqual(before.state)
    await move(before.enemies[1].x, before.enemies[1].y)
    expect((await inspect(page)).texts.some(text => text.text.includes(`Release to play on ${before.state!.enemies[1].name}`))).toBe(true)
    await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(180)
    expect((await inspect(page)).state).toEqual(before.state)
    expect((await inspect(page)).cards.find(card => card.id === strike.id)!.y).toBeCloseTo(strike.y, 0)

    await pickUp(); await move(220, 70); await page.mouse.up(); await page.waitForTimeout(180)
    expect((await inspect(page)).state).toEqual(before.state)
    await pickUp(); await move(before.enemies[1].x, before.enemies[1].y); await page.mouse.up()
    const played = await inspect(page)
    expect(played.state!.player.hand.some(card => card.instanceId === strike.id)).toBe(false)
    expect(played.state!.player.discardPile.filter(card => card.instanceId === strike.id)).toHaveLength(1)
    expect(played.state!.player.energy).toBe(before.state!.player.energy - 1)
    expect(played.state!.enemies[0].hp).toBe(before.state!.enemies[0].hp)
    expect(played.state!.enemies[1].hp).toBeLessThan(before.state!.enemies[1].hp)
    if (reducedMotion) expect(await page.evaluate(() => window.__testGame.scene.getScenes(true)[0].children.getByName('played-card'))).toBeNull()
    await page.waitForTimeout(250)
    expect(await page.evaluate(() => !!window.__testGame.scene.getScenes(true)[0].children.getByName('played-card'))).toBe(false)

    const keyboardCard = played.state!.player.hand.findIndex(card => card.defId === 'STRIKE')
    await page.keyboard.press(String(keyboardCard + 1))
    await move(before.enemies[0].x, before.enemies[0].y)
    expect((await inspect(page)).texts.some(text => text.text.includes('Click to play on'))).toBe(true)
    await clickPoint(page, before.enemies[0].x, before.enemies[0].y)
    expect((await inspect(page)).state!.player.energy).toBe(before.state!.player.energy - 2)
    await clickText(page, 'End Turn')
    expect((await inspect(page)).state!.player.energy).toBe(3)
    expect(errors).toEqual([])
})

test('release outside the canvas cancels targeting and leaves the next card playable', async ({ page }) => {
    const run = createNewRun({ seed: 'outside-release' }); run.neowCompleted = true
    run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    run.deck = Array.from({ length: 5 }, () => createCardInstance('STRIKE'))
    const errors = await boot(page, run), ui = await inspect(page), card = ui.cards[0]
    await page.mouse.move(ui.canvas.x + (card.x + 8) * ui.canvas.scaleX, ui.canvas.y + (card.y + 45) * ui.canvas.scaleY)
    await page.waitForTimeout(180); await page.mouse.down(); await page.mouse.move(0, 0); await page.mouse.up()
    expect((await inspect(page)).state).toEqual(ui.state)
    expect((await inspect(page)).texts.some(text => text.text.includes('Esc to cancel'))).toBe(false)
    await page.keyboard.press('1'); await clickPoint(page, ui.enemies[0].x, ui.enemies[0].y)
    expect((await inspect(page)).state!.player.energy).toBe(2)
    expect(errors).toEqual([])
})

test('opening any card pile clears targeting and inspection without playing the selected card', async ({ page }) => {
    const run = createNewRun({ seed: 'targeting-pile-overlays' }); run.neowCompleted = true
    run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    run.deck = Array.from({ length: 5 }, () => createCardInstance('STRIKE'))
    const errors = await boot(page, run), before = await inspect(page)
    for (const label of ['Draw', 'Discard', 'Exhaust']) {
        await page.keyboard.press('1')
        expect((await inspect(page)).texts.some(text => text.text.includes('Esc to cancel'))).toBe(true)
        await clickText(page, label)
        const pile = await inspect(page)
        expect(pile.texts.some(text => text.text.includes('Esc to cancel'))).toBe(false)
        expect(pile.texts.filter(text => text.depth === 5900)).toHaveLength(0)
        expect(pile.state).toEqual(before.state)
        await clickText(page, 'Close')
    }
    await page.keyboard.press('Alt+1')
    expect((await inspect(page)).texts.some(text => text.depth === 5900)).toBe(true)
    await clickText(page, 'Discard')
    expect((await inspect(page)).texts.filter(text => text.depth === 5900)).toHaveLength(0)
    await clickText(page, 'Close')
    await page.keyboard.press('1'); await clickPoint(page, before.enemies[0].x, before.enemies[0].y)
    expect((await inspect(page)).state!.player.energy).toBe(2)
    expect(errors).toEqual([])
})
