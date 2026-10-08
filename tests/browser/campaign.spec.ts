import { expect, test } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { createCardInstance } from '../../src/core/cards'
import { boot, clickCard, clickText, dragCard, expectScene, inspect, reloadRun } from './driver'

test('plays an untargeted power and colorless skill by dragging', async ({ page }) => {
    const run = createNewRun({ seed: 'untargeted' }); run.neowCompleted = true
    run.potions = ['BLOCK_POTION']
    run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    run.deck = ['INFLAME', 'FINESSE', 'DEFEND', 'DEFEND', 'STRIKE'].map(id => createCardInstance(id))
    const errors = await boot(page, run)
    for (const id of ['INFLAME', 'FINESSE']) {
        const card = (await inspect(page)).state!.player.hand.find(card => card.defId === id)!
        await dragCard(page, card.instanceId)
        expect((await inspect(page)).state!.player.hand.some(entry => entry.instanceId === card.instanceId)).toBe(false)
    }
    expect((await inspect(page)).state!.player.powers).toContainEqual(expect.objectContaining({ id: 'STRENGTH', stacks: 2 }))
    expect((await inspect(page)).state!.player.block).toBe(2)
    await clickText(page, 'Block'); await clickText(page, 'Use')
    expect((await inspect(page)).run!.potions).toEqual([])
    await expect.poll(async () => (await inspect(page)).run!.elapsedSeconds!).toBeGreaterThan(1)
    await reloadRun(page, 'Combat')
    expect((await inspect(page)).run!.elapsedSeconds).toBeGreaterThan(1)
    expect((await inspect(page)).run!.potions).toEqual(['BLOCK_POTION'])
    expect(errors).toEqual([])
})

test('records an Act 4 loss once and offers full Neow on ordinary New Run', async ({ page }) => {
    const run = createNewRun({ seed: 'act-four-loss', mode: 'standard' }); run.neowCompleted = true
    run.act = 4; run.actsCleared = [1, 2, 3]; run.floor = 55; run.player.hp = 1
    run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    const errors = await boot(page, run)
    for (let i = 0; i < 5 && (await inspect(page)).scene === 'Combat'; i++) await clickText(page, 'End Turn')
    await expectScene(page, 'RunSummary')
    const meta = await page.evaluate(() => JSON.parse(localStorage.getItem('sts_meta_v2')!))
    expect(meta).toMatchObject({ bestAscensionUnlocked: 1, totalRuns: 1, totalWins: 0 })
    await page.reload()
    await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sts_meta_v2')!))).toEqual(meta)
    await clickText(page, 'Card Library')
    await expectScene(page, 'DeckBuilder')
    expect(await page.evaluate(() => localStorage.getItem('sts_run_v7'))).toBeNull()
    await clickText(page, 'Back')
    await clickText(page, 'New Run')
    await expectScene(page, 'Neow')
    expect((await inspect(page)).options).toHaveLength(4)
    expect(errors).toEqual([])
})

test('resumes every Orrery reward and returns to the original shop', async ({ page }) => {
    const run = createNewRun({ seed: 'orrery-ui' }); run.neowCompleted = true; run.gold = 1000
    run.relics.push('BUSTED_CROWN')
    run.pendingRoom = { scene: 'Shop', inventory: { cards: [], potions: [], relics: ['ORRERY'], relicPrices: [150] } }
    const errors = await boot(page, run)
    await clickText(page, 'Orrery · 150 G')
    await expectScene(page, 'RelicAcquisition')
    for (let i = 0; i < 5; i++) {
        await reloadRun(page, 'RelicAcquisition')
        const ui = await inspect(page)
        expect(ui.run!.deck).toHaveLength(run.deck.length + i)
        expect(ui.cards.filter(card => card.enabled)).toHaveLength(1)
        await clickCard(page, ui.cards.find(card => card.enabled)!.id)
    }
    await reloadRun(page, 'Shop')
    const ui = await inspect(page)
    expect(ui.run!.gold).toBe(850); expect(ui.run!.floor).toBe(1)
    expect(ui.run!.deck).toHaveLength(run.deck.length + 5)
    expect(ui.inventory!.relics).toEqual([])
    await clickText(page, 'Leave')
    await expectScene(page, 'Map')
    expect((await inspect(page)).run!.floor).toBe(2)
    expect(errors).toEqual([])
})

test('persists the Golden Idol trap and applies its cost only once', async ({ page }) => {
    const run = createNewRun({ seed: 'idol-ui' }); run.neowCompleted = true
    run.pendingRoom = { scene: 'Event' }; run.eventState = { id: 'GOLDEN_IDOL' }
    const errors = await boot(page, run)
    await clickText(page, 'Take the idol')
    await reloadRun(page, 'Event')
    expect((await inspect(page)).run!.relics.filter(id => id === 'GOLDEN_IDOL')).toHaveLength(1)
    await clickText(page, 'Smash through')
    await reloadRun(page, 'Event')
    expect((await inspect(page)).run!.player.hp).toBe(60)
    await clickText(page, 'Continue')
    await expectScene(page, 'Map')
    expect((await inspect(page)).run!.floor).toBe(2)
    expect(errors).toEqual([])
})

test('resumes event combat and returns its rewards without advancing an act', async ({ page }) => {
    const run = createNewRun({ seed: 'sphere-ui' }); run.neowCompleted = true; run.act = 3; run.floor = 40
    run.player = { hp: 1000, maxHp: 1000 }
    run.deck = Array.from({ length: 5 }, () => createCardInstance('SEARING_BLOW', 30))
    run.pendingRoom = { scene: 'Event' }; run.eventState = { id: 'MYSTERIOUS_SPHERE' }
    const errors = await boot(page, run)
    await clickText(page, 'Fight')
    await expectScene(page, 'Combat')
    const before = (await inspect(page)).state!.enemies.map(enemy => enemy.specId)
    await reloadRun(page, 'Combat')
    expect((await inspect(page)).state!.enemies.map(enemy => enemy.specId)).toEqual(before)
    for (let turn = 0; turn < 8 && (await inspect(page)).scene === 'Combat'; turn++) {
        const ui = await inspect(page)
        const card = ui.state!.player.hand.find(card => card.defId === 'SEARING_BLOW')
        if (ui.state!.player.energy >= 2 && card) {
            await dragCard(page, card.instanceId, ui.state!.enemies.findIndex(enemy => enemy.hp > 0))
            const after = await inspect(page)
            expect(after.scene !== 'Combat' || !after.state!.player.hand.some(entry => entry.instanceId === card.instanceId)).toBe(true)
        }
        else await clickText(page, 'End Turn')
    }
    await expectScene(page, 'Rewards')
    const gold = (await inspect(page)).run!.gold
    await reloadRun(page, 'Rewards')
    expect((await inspect(page)).run!.gold).toBe(gold)
    await clickText(page, 'Skip')
    await clickText(page, 'Continue')
    await expectScene(page, 'Map')
    const completed = (await inspect(page)).run!
    expect(completed).toMatchObject({ act: 3, floor: 41 })
    expect(completed.eventCombat).toBeUndefined()
    expect(errors).toEqual([])
})

test('chains the A20 bosses, resumes the second, and follows the key route through the Heart', async ({ page }) => {
    test.setTimeout(90_000)
    const run = createNewRun({ seed: 'heart-route-ui', ascension: 20 }); run.neowCompleted = true
    run.act = 3; run.floor = 50; run.actsCleared = [1, 2]
    run.keys = { ruby: true, emerald: true, sapphire: true }
    run.player = { hp: 1000, maxHp: 1000 }
    run.deck = Array.from({ length: 10 }, () => createCardInstance('SEARING_BLOW', 50))
    run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    const errors = await boot(page, run)
    const first = (await inspect(page)).state!.enemies.find(enemy => enemy.tags?.includes('boss'))!.specId
    let secondResumed = false
    let heartResumed = false
    const actFourRooms: string[] = []
    for (let step = 0; step < 150; step++) {
        const ui = await inspect(page)
        if (ui.scene === 'RunSummary') break
        if (ui.scene === 'Combat') {
            if (ui.run!.act === 3 && ui.run!.secondBoss && !secondResumed) {
                const second = ui.state!.enemies.find(enemy => enemy.tags?.includes('boss'))!.specId
                expect(second).not.toBe(first)
                await reloadRun(page, 'Combat')
                expect((await inspect(page)).state!.enemies.some(enemy => enemy.specId === second)).toBe(true)
                secondResumed = true; continue
            }
            if (ui.run!.act === 4 && ui.state!.enemies.some(enemy => enemy.specId === 'CORRUPT_HEART') && !heartResumed) {
                await reloadRun(page, 'Combat'); heartResumed = true; continue
            }
            const target = ui.state!.enemies.findIndex(enemy => enemy.hp > 0)
            const card = ui.state!.player.hand.find(card => card.defId === 'SEARING_BLOW')
            if (card && ui.state!.player.energy >= 2 && target >= 0) await dragCard(page, card.instanceId, target)
            else await clickText(page, 'End Turn')
        } else if (ui.scene === 'Map') {
            expect(ui.run!.act).toBe(4)
            const node = ui.map!.byId[ui.run!.mapProgress?.currentNodeId ? ui.map!.byId[ui.run!.mapProgress.currentNodeId].edgesTo[0] : ui.map!.startIds[0]]
            actFourRooms.push(node.kind)
            await clickText(page, ui.texts.find(text => text.enabled && ['R', '$', 'E', 'B'].includes(text.text))!.text)
        } else if (ui.scene === 'Campfire') await clickText(page, ui.texts.find(t => t.enabled && t.text.startsWith('Rest'))!.text)
        else if (ui.scene === 'Shop') await clickText(page, 'Leave')
        else if (ui.scene === 'Rewards') {
            if (ui.cards.some(card => card.enabled)) await clickText(page, 'Skip')
            if ((await inspect(page)).texts.some(t => t.enabled && t.text === 'Skip Potion')) await clickText(page, 'Skip Potion')
            await clickText(page, 'Continue')
        } else throw Error(`Unexpected ${ui.scene}`)
    }
    await expectScene(page, 'RunSummary')
    expect((await inspect(page)).texts.some(t => t.text === 'Ironclad · VICTORY')).toBe(true)
    expect(actFourRooms).toEqual(['rest', 'shop', 'elite', 'boss'])
    expect(secondResumed && heartResumed).toBe(true)
    expect(errors).toEqual([])
})
