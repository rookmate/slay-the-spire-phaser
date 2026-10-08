import { expect, test } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { createCardInstance } from '../../src/core/cards'
import { boot, clickCard, clickPoint, clickText, dragCard, expectScene, inspect, reloadRun } from './driver'

test('draws the whole hand, plays by dragging, ends a turn, and resumes combat', async ({ page }) => {
    const run = createNewRun({ seed: 'browser-combat' })
    run.neowCompleted = true
    run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    const errors = await boot(page, run)
    await expectScene(page, 'Combat')
    const initial = await inspect(page)
    for (const card of initial.cards) {
        expect(card.x).toBeGreaterThanOrEqual(0)
        expect(card.x + card.width).toBeLessThanOrEqual(800)
        expect(card.y + card.height).toBeLessThan(404)
    }
    const strike = initial.state!.player.hand.find(card => card.defId === 'STRIKE')!
    await dragCard(page, strike.instanceId, 0)
    await expect.poll(async () => (await inspect(page)).state!.player.hand.some(card => card.instanceId === strike.instanceId)).toBe(false)
    expect((await inspect(page)).state!.enemies[0].hp).toBeLessThan(initial.state!.enemies[0].hp)
    await clickText(page, 'End Turn')
    expect((await inspect(page)).state!.player.hand.map(card => card.instanceId)).not.toEqual(initial.state!.player.hand.map(card => card.instanceId))
    expect((await inspect(page)).state!.player.energy).toBe(3)
    await reloadRun(page, 'Combat')
    expect((await inspect(page)).state!.player.hp).toBe(initial.state!.player.hp)
    expect(errors).toEqual([])
})

test('can select the last card of a large deck at a campfire', async ({ page }) => {
    const run = createNewRun({ seed: 'browser-pages' })
    run.neowCompleted = true
    run.pendingRoom = { scene: 'Campfire' }
    run.deck = Array.from({ length: 16 }, () => createCardInstance('STRIKE'))
    const last = run.deck.at(-1)!
    const errors = await boot(page, run)
    await clickText(page, 'Smith · upgrade a card')
    for (let pageIndex = 0; pageIndex < 3; pageIndex++) await clickText(page, 'Next')
    await clickCard(page, last.instanceId)
    await expectScene(page, 'Map')
    expect((await inspect(page)).run!.deck.find(card => card.instanceId === last.instanceId)!.upgradeLevel).toBe(1)
    expect(errors).toEqual([])
})

test('can leave a campfire when Coffee Dripper and an upgraded deck block both services', async ({ page }) => {
    const run = createNewRun({ seed: 'browser-campfire' })
    run.neowCompleted = true
    run.pendingRoom = { scene: 'Campfire' }
    run.relics.push('COFFEE_DRIPPER')
    run.deck = run.deck.map(card => ({ ...card, upgradeLevel: 1 }))
    const errors = await boot(page, run)
    const ui = await inspect(page)
    expect(ui.texts.filter(t => t.enabled).map(t => t.text)).toEqual(['Recall · obtain Ruby Key', 'Skip', 'Bag', 'Menu'])
    await clickText(page, 'Skip')
    await expectScene(page, 'Map')
    expect((await inspect(page)).run!.floor).toBe(2)
    expect(errors).toEqual([])
})

test('combat card choices can reach the second page and resolve through a card click', async ({ page }) => {
    const run = createNewRun({ seed: 'browser-choice' })
    run.neowCompleted = true
    run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    run.relics.push('BAG_OF_PREPARATION')
    run.deck = Array.from({ length: 16 }, (_, index) => createCardInstance(index < 8 ? 'BURNING_PACT' : 'DEFEND'))
    const errors = await boot(page, run)
    const initial = await inspect(page)
    const pact = initial.state!.player.hand.find(card => card.defId === 'BURNING_PACT')!
    await dragCard(page, pact.instanceId)
    const choice = (await inspect(page)).choice!
    expect(choice.eligibleInstanceIds.length).toBeGreaterThan(5)
    await clickText(page, 'Next')
    const card = (await inspect(page)).cards.find(card => card.enabled && card.depth === 7000)!
    await clickCard(page, card.id)
    expect((await inspect(page)).choice).toBeUndefined()
    expect((await inspect(page)).state!.player.exhaustPile.some(entry => entry.instanceId === card.id)).toBe(true)
    expect(errors).toEqual([])
})

test('defeat clears the save and records the result only once across reload', async ({ page }) => {
    const run = createNewRun({ seed: 'browser-defeat' })
    run.neowCompleted = true
    run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    run.player.hp = 1
    const errors = await boot(page, run)
    for (let turn = 0; turn < 5 && (await inspect(page)).scene === 'Combat'; turn++) await clickText(page, 'End Turn')
    await expectScene(page, 'RunSummary')
    expect((await inspect(page)).texts.some(t => t.text === 'Ironclad · DEFEAT')).toBe(true)
    const before = await page.evaluate(() => ({ run: localStorage.getItem('sts_run_v7'), meta: JSON.parse(localStorage.getItem('sts_meta_v2')!) }))
    expect(before.run).toBeNull()
    expect(before.meta.totalRuns).toBe(1)
    expect(before.meta.totalWins).toBe(0)
    await page.reload()
    await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sts_meta_v2')!))).toEqual(before.meta)
    expect(errors).toEqual([])
})

test('five enemies and multiple effects stay above the hand; hover shows every effect', async ({ page }) => {
    const run = createNewRun({ seed: 'crowd-21' })
    run.neowCompleted = true
    run.combatCount = 4
    run.hallwayCount = 4
    run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    run.relics.push('BAG_OF_MARBLES', 'PHILOSOPHERS_STONE', 'VAJRA')
    run.deck = ['DEMON_FORM', 'METALLICIZE', 'DEFEND', 'STRIKE', 'STRIKE'].map(id => createCardInstance(id))
    run.potions = ['WEAK_POTION', 'FIRE_POTION', 'DEXTERITY_POTION']
    const errors = await boot(page, run)
    const ui = await inspect(page)
    expect(ui.enemies).toHaveLength(5)
    const controls = ui.texts.filter(text => text.enabled && (['Weak', 'Fire', 'Dexterity'].includes(text.text) || ['Discard', 'Exhaust', 'End Turn'].includes(text.text)))
    expect(controls).toHaveLength(6)
    for (const [index, a] of controls.entries()) {
        for (const b of controls.slice(index + 1)) {
            const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
            expect(overlaps, `${a.text} overlaps ${b.text}`).toBe(false)
        }
    }
    await clickText(page, 'Exhaust')
    expect((await inspect(page)).texts.some(text => text.text === 'Exhaust Pile')).toBe(true)
    await clickText(page, 'Close')
    for (const [index, enemy] of ui.enemies.entries()) {
        expect(enemy.bounds.x).toBeGreaterThan(240)
        expect(enemy.bounds.x + enemy.bounds.width).toBeLessThan(800)
        expect(enemy.bounds.y + enemy.bounds.height).toBeLessThan(196)
        if (index > 0) expect(enemy.bounds.x).toBeGreaterThan(ui.enemies[index - 1].bounds.x + ui.enemies[index - 1].bounds.width)
    }
    for (const id of ['DEMON_FORM', 'METALLICIZE']) {
        await dragCard(page, (await inspect(page)).state!.player.hand.find(card => card.defId === id)!.instanceId)
    }
    await clickText(page, 'Dexterity'); await clickText(page, 'Use')
    await clickText(page, 'Weak'); await clickText(page, 'Use')
    await clickPoint(page, ui.enemies[4].x, ui.enemies[4].y)
    const buffed = await inspect(page)
    const labels = buffed.texts.filter(text => text.depth === 0 && text.y >= 174 && text.y < 196 && text.text)
    expect(labels).toHaveLength(6)
    for (const label of labels) expect(label.y + label.height).toBeLessThan(194)
    const details = buffed.texts.find(text => text.depth === 6000)!
    expect(details.text).toContain('VULNERABLE:1')
    expect(details.text).toContain('STRENGTH:1')
    expect(details.text).toContain('WEAK:3')
    await clickText(page, 'Fire'); await clickText(page, 'Use')
    await clickPoint(page, ui.enemies[4].x, ui.enemies[4].y)
    expect((await inspect(page)).state!.enemies[4].hp).toBe(0)
    expect((await inspect(page)).run!.potions).toEqual([])
    expect(errors).toEqual([])
})

test('card and potion rewards have separate controls and survive reload without duplicate gold', async ({ page }) => {
    const run = createNewRun({ seed: 'browser-rewards' })
    run.neowCompleted = true
    run.potions = ['BLOCK_POTION', 'STRENGTH_POTION', 'DEXTERITY_POTION']
    run.pendingRoom = { scene: 'Rewards', rewards: { tier: 'hallway', items: [
        { kind: 'gold', amount: 15 },
        { kind: 'cards', choices: ['CLEAVE', 'POMMEL_STRIKE', 'SHRUG_IT_OFF'] },
        { kind: 'potion', potionId: 'FIRE_POTION' },
    ] } }
    const errors = await boot(page, run)
    await reloadRun(page, 'Rewards')
    const ui = await inspect(page)
    expect(ui.run!.gold).toBe(run.gold + 15)
    for (const card of ui.cards) expect(card.y + card.height).toBeLessThan(340)
    await clickCard(page, 'SHRUG_IT_OFF')
    await clickText(page, 'Block Potion')
    await clickText(page, 'Continue')
    await expectScene(page, 'Map')
    expect((await inspect(page)).run!.deck).toHaveLength(run.deck.length + 1)
    expect((await inspect(page)).run!.potions).toEqual(['FIRE_POTION', 'STRENGTH_POTION', 'DEXTERITY_POTION'])
    expect(errors).toEqual([])
})

test('unknown-room probabilities survive reload as part of the run', async ({ page }) => {
    const run = createNewRun({ seed: 'weights-5' })
    run.mapRows = 15
    run.neowCompleted = true
    run.floor = 5
    run.mapProgress = { currentNodeId: '12:1' }
    run.unknownWeights = { event: 0.05, monster: 1, shop: 0.05, chest: 0.05 }
    const errors = await boot(page, run)
    await reloadRun(page, 'Map')
    // The only outgoing node is 11:0. With the saved weights it resolves to a
    // monster; resetting weights at reload incorrectly produces an event.
    await clickText(page, '?')
    await expectScene(page, 'Combat')
    expect((await inspect(page)).run!.unknownWeights).toEqual({ event: 0.75, monster: 0.1, shop: 0.08, chest: 0.07 })
    expect(errors).toEqual([])
})
