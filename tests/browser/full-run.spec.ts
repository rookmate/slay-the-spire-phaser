import { expect, test, type Page } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { canUpgradeCard } from '../../src/core/cards'
import { POTION_DEFS } from '../../src/core/potions'
import { RELIC_DEFS } from '../../src/core/relics'
import { boot, clickCard, clickPoint, clickText, dragCard, expectScene, inspect, reloadRun } from './driver'
import { cardPriority, choosePlay, chooseRoute, incomingDamage } from './policy'

async function selectFromPages(page: Page, id: string) {
    for (let attempt = 0; attempt < 20; attempt++) {
        const ui = await inspect(page)
        if (ui.cards.some(card => card.enabled && card.id === id)) return clickCard(page, id)
        await clickText(page, 'Next')
    }
    throw new Error(`Could not reach card ${id}`)
}

test('plays a seeded starter-deck run through both acts and records victory', async ({ page }, testInfo) => {
    test.setTimeout(300_000)
    const errors = await boot(page, createNewRun(process.env.PLAYTHROUGH_SEED ?? 'two-act-2'))
    await expectScene(page, 'Neow')
    const history: string[] = []
    let lastCombat = ''
    let reloadedReward = false
    let reloadedBossRelic = false
    let reloadedActTwo = false
    try {
        await clickText(page, 'Choose a Rare Card')
        await clickCard(page, 'DEMON_FORM')
        for (let step = 0; step < 1500; step++) {
            const ui = await inspect(page)
            if (ui.scene === 'RunSummary') break
            if (ui.scene === 'Map') {
                if (ui.run!.act === 2 && !reloadedActTwo) {
                    await reloadRun(page, 'Map')
                    reloadedActTwo = true
                }
                const node = chooseRoute(ui.map!, ui.run!.mapProgress?.currentNodeId)
                history.push(`Act ${ui.run!.act} floor ${ui.run!.floor}: ${node.kind} ${node.id}, HP ${ui.run!.player.hp}, gold ${ui.run!.gold}`)
                console.log(history.at(-1))
                for (let scroll = 0; scroll < 10; scroll++) {
                    const current = await inspect(page)
                    const target = current.texts.find(t => t.enabled && Math.abs(t.x - (20 + node.col * 90)) < 10)
                    expect(target).toBeDefined()
                    if (target!.y >= 0 && target!.y + target!.height < 430) {
                        await clickPoint(page, target!.x + target!.width / 2, target!.y + target!.height / 2)
                        break
                    }
                    await page.mouse.move(current.canvas.x + 400 * current.canvas.scaleX, current.canvas.y + 300 * current.canvas.scaleY)
                    await page.mouse.wheel(0, target!.y > 400 ? 180 : -180)
                    await page.waitForTimeout(60)
                }
            } else if (ui.scene === 'Combat') {
                const combatKey = `${ui.run!.act}:${ui.run!.floor}`
                if (lastCombat !== combatKey) {
                    history.push(`Enemies: ${ui.state!.enemies.map(enemy => enemy.name).join(', ')}`)
                    lastCombat = combatKey
                }
                if (ui.choice) {
                    await selectFromPages(page, ui.choice.eligibleInstanceIds[0])
                    if (ui.choice.maxSelections > 1) await clickText(page, 'Confirm')
                    continue
                }
                const state = ui.state!
                const threat = state.enemies.reduce((sum, enemy) => sum + incomingDamage(enemy), 0)
                const potion = ui.run!.potions.find(id =>
                    id === 'STRENGTH_POTION' || id === 'DEXTERITY_POTION' ||
                    (id === 'BLOCK_POTION' && threat - state.player.block >= 10) ||
                    (id === 'ENERGY_POTION' && state.player.energy === 0 && state.player.hand.some(c => cardPriority(c.defId) > 0)) ||
                    (id === 'EXPLOSIVE_POTION' && state.enemies.filter(e => e.hp > 0).length > 1) ||
                    (id === 'FIRE_POTION' && state.enemies.some(e => e.hp > 0 && e.hp <= 20)) ||
                    (id === 'WEAK_POTION' && threat > 12),
                )
                if (potion) {
                    await clickText(page, POTION_DEFS[potion].name)
                    if (POTION_DEFS[potion].target === 'single_enemy') {
                        const index = state.enemies.findIndex(e => e.hp > 0 && (potion !== 'FIRE_POTION' || e.hp <= 20))
                        await clickPoint(page, ui.enemies[index].x, ui.enemies[index].y)
                    }
                    continue
                }
                const play = choosePlay(state)
                if (play) {
                    await dragCard(page, play.card.instanceId, play.enemyIndex)
                    await expect.poll(async () => {
                        const after = await inspect(page)
                        return after.scene !== 'Combat' || !after.state!.player.hand.some(card => card.instanceId === play.card.instanceId)
                    }, { message: `Play ${play.card.defId}` }).toBe(true)
                } else await clickText(page, 'End Turn')
            } else if (ui.scene === 'Rewards') {
                if (!reloadedReward) {
                    const before = ui.run!.gold
                    await reloadRun(page, 'Rewards')
                    expect((await inspect(page)).run!.gold).toBe(before)
                    reloadedReward = true
                    continue
                }
                const candidates = ui.cards.filter(card => card.enabled).sort((a, b) => cardPriority(b.defId) - cardPriority(a.defId))
                if (candidates.length) {
                    const pick = candidates.find(card => cardPriority(card.defId) >= 50 && (ui.run!.deck.filter(c => c.defId === card.defId).length < (card.defId === 'SHRUG_IT_OFF' || card.defId === 'TWIN_STRIKE' ? 3 : 1)))
                    if (pick) await clickCard(page, pick.id)
                    else await clickText(page, 'Skip')
                }
                if ((await inspect(page)).texts.some(t => t.enabled && t.text === 'Skip Potion')) await clickText(page, 'Skip Potion')
                await clickText(page, 'Continue')
            } else if (ui.scene === 'Campfire') {
                const upgrades = ui.run!.deck.filter(canUpgradeCard).sort((a, b) => cardPriority(b.defId) - cardPriority(a.defId))
                if (ui.run!.player.hp < ui.run!.player.maxHp * 0.8 && ui.texts.some(t => t.enabled && t.text.startsWith('Rest'))) {
                    await clickText(page, ui.texts.find(t => t.enabled && t.text.startsWith('Rest'))!.text)
                } else if (upgrades.length) {
                    await clickText(page, 'Smith (upgrade a card)')
                    await selectFromPages(page, upgrades[0].instanceId)
                } else await clickText(page, 'Skip')
            } else if (ui.scene === 'Shop') {
                const pain = ui.run!.deck.find(card => card.defId === 'PAIN')
                if (pain && ui.run!.gold >= ui.run!.merchantRemoveCost) {
                    await clickText(page, `Remove a card (${ui.run!.merchantRemoveCost})`)
                    await selectFromPages(page, pain.instanceId)
                    continue
                }
                const candidates = ui.inventory!.cards.map((id, index) => ({ id, index })).filter(({ id }) => cardPriority(id) >= 60 && !ui.run!.deck.some(card => card.defId === id)).sort((a, b) => cardPriority(b.id) - cardPriority(a.id))
                const affordable = candidates.find(({ index }) => {
                    const label = ui.texts.find(t => t.enabled && t.text.startsWith('Buy (') && t.x === 20 + index * 130)
                    return label && Number(label.text.match(/\d+/)![0]) <= ui.run!.gold
                })
                if (affordable) {
                    const label = ui.texts.find(t => t.enabled && t.text.startsWith('Buy (') && t.x === 20 + affordable.index * 130)!
                    await clickPoint(page, label.x + label.width / 2, label.y + label.height / 2)
                } else await clickText(page, 'Leave')
            } else if (ui.scene === 'Event') {
                await clickText(page, 'Leave')
            } else if (ui.scene === 'BossRelic') {
                const pending = ui.run!.bossRelicChoicePending!
                await reloadRun(page, 'BossRelic')
                expect((await inspect(page)).run!.bossRelicChoicePending).toEqual(pending)
                reloadedBossRelic = true
                const preference = ['SOZU', 'BLACK_BLOOD', 'BUSTED_CROWN', 'MARK_OF_PAIN', 'PHILOSOPHERS_STONE', 'COFFEE_DRIPPER']
                const pick = [...pending.choices].sort((a, b) => preference.indexOf(a) - preference.indexOf(b))[0]
                history.push(`Boss relic: ${RELIC_DEFS[pick].name}`)
                const index = pending.choices.indexOf(pick)
                const button = ui.texts.filter(t => t.enabled && t.text === 'Take Relic')[index]
                await clickPoint(page, button.x + button.width / 2, button.y + button.height / 2)
            } else throw new Error(`Unexpected scene ${ui.scene}`)
        }
        await expectScene(page, 'RunSummary')
        const summary = await inspect(page)
        history.push(...summary.texts.map(text => text.text))
        expect(summary.texts.some(t => t.text === 'Run VICTORY!'), history.join('\n')).toBe(true)
        expect(summary.texts.some(t => t.text === 'Acts cleared: 1, 2')).toBe(true)
        expect(reloadedReward && reloadedBossRelic && reloadedActTwo).toBe(true)
        const saved = await page.evaluate(() => ({ run: localStorage.getItem('sts_run_v7'), meta: JSON.parse(localStorage.getItem('sts_meta_v2')!) }))
        expect(saved.run).toBeNull()
        expect(saved.meta).toMatchObject({ totalRuns: 1, totalWins: 1, bestAscensionUnlocked: 1, ironcladUnlockTier: 1 })
        await page.reload()
        await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sts_meta_v2')!))).toEqual(saved.meta)
        expect(errors).toEqual([])
    } finally {
        await testInfo.attach('playthrough-log', { body: history.join('\n'), contentType: 'text/plain' })
    }
})
