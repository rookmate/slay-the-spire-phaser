import { expect, test, type Page } from '@playwright/test'
import type Phaser from 'phaser'
import { createCardInstance } from '../../src/core/cards'
import { createNewRun } from '../../src/core/run'
import type { Card } from '../../src/ui/Card'
import { boot, clickPoint, inspect, playCardWithKeyboard } from './driver'

type HandScene = Phaser.Scene & { ui: { handManager: { getHandCards(): Card[] } } }
declare global { interface Window { __rememberedHand: Map<string, Card> } }
async function rememberHand(page: Page) {
    await page.evaluate(() => {
        const cards = (window.__testGame.scene.getScene('Combat') as HandScene).ui.handManager.getHandCards()
        window.__rememberedHand = new Map(cards.map(card => [card.getCardInstance().instanceId, card]))
    })
}
async function handViews(page: Page) {
    return page.evaluate(() => (window.__testGame.scene.getScene('Combat') as HandScene).ui.handManager.getHandCards().map(view => ({
        card: view.getCardInstance(), retained: window.__rememberedHand.get(view.getCardInstance().instanceId) === view,
        texts: view.list.filter(child => child.type === 'Text').map(child => (child as Phaser.GameObjects.Text).text),
    })))
}
function fixture(ids: string[]) {
    const run = createNewRun({ seed: 'hand-reuse' }); run.neowCompleted = true
    run.deck = ids.map(id => createCardInstance(id)); run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    return run
}

for (const power of ['APOTHEOSIS', 'CORRUPTION']) test(`retained hand views update after ${power} changes upgrades or costs`, async ({ page }) => {
    const errors = await boot(page, fixture([power, 'BODY_SLAM', 'DEFEND', 'SHRUG_IT_OFF', 'STRIKE']))
    await rememberHand(page)
    const first = await inspect(page), card = first.state!.player.hand.find(card => card.defId === power)!
    await playCardWithKeyboard(page, card.instanceId)
    const after = await handViews(page)
    expect(after).toHaveLength(4); expect(after.every(view => view.retained)).toBe(true)
    const defend = after.find(view => view.card.defId === 'DEFEND')!
    expect(defend.texts).toContain(power === 'APOTHEOSIS' ? 'Defend+' : 'Defend')
    expect(defend.texts).toContain(power === 'APOTHEOSIS' ? '1' : '0')
    if (power === 'APOTHEOSIS') {
        expect(defend.texts.some(text => text.includes('8 Block'))).toBe(true)
        expect(after.find(view => view.card.defId === 'BODY_SLAM')!.texts).toContain('0')
    }
    const index = after.indexOf(defend)
    await page.keyboard.press(`Alt+${index + 1}`)
    expect((await inspect(page)).texts.some(text => text.depth >= 5900 && text.text.includes(power === 'APOTHEOSIS' ? '8 Block' : '5 Block'))).toBe(true)
    await page.keyboard.press('Escape')
    expect((await handViews(page)).every(view => view.retained)).toBe(true)
    expect(errors).toEqual([])
})

test('a redrawn card gets a new hand view while its played view finishes flying', async ({ page }) => {
    const run = fixture(['FLASH_OF_STEEL']); run.relics = ['UNCEASING_TOP']
    const errors = await boot(page, run)
    await rememberHand(page)
    const initial = await inspect(page), id = initial.state!.player.hand[0].instanceId, hp = initial.state!.enemies[0].hp
    await page.keyboard.press('1'); await clickPoint(page, initial.enemies[0].x, initial.enemies[0].y)
    const after = await inspect(page)
    expect(after.state!.enemies[0].hp).toBeLessThan(hp)
    expect(after.state!.player.hand.map(card => card.instanceId)).toEqual([id])
    expect(await handViews(page)).toMatchObject([{ retained: false, card: { instanceId: id } }])
    await page.waitForTimeout(250)
    const next = await inspect(page)
    await page.keyboard.press('1'); await clickPoint(page, next.enemies[0].x, next.enemies[0].y)
    expect((await inspect(page)).state!.enemies[0].hp).toBeLessThan(after.state!.enemies[0].hp)
    expect(errors).toEqual([])
})

test('generated cards join a retained hand and consumed cards leave without replacing survivors', async ({ page }) => {
    const errors = await boot(page, fixture(['BLADE_DANCE', 'DEFEND', 'DEFEND', 'STRIKE', 'STRIKE']))
    await rememberHand(page)
    const first = await inspect(page), dance = first.state!.player.hand.find(card => card.defId === 'BLADE_DANCE')!
    await playCardWithKeyboard(page, dance.instanceId)
    let cards = await handViews(page)
    expect(cards.filter(view => view.card.defId !== 'SHIV').every(view => view.retained)).toBe(true)
    expect(cards.filter(view => view.card.defId === 'SHIV')).toHaveLength(3)
    await rememberHand(page)
    await playCardWithKeyboard(page, cards.find(view => view.card.defId === 'SHIV')!.card.instanceId, 0)
    cards = await handViews(page)
    expect(cards).toHaveLength(6); expect(cards.every(view => view.retained)).toBe(true)
    expect(errors).toEqual([])
})
