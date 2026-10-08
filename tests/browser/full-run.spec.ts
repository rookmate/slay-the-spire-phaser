import { expect, test, type Page } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { canUpgradeCard } from '../../src/core/cards'
import { RELIC_DEFS } from '../../src/core/relics'
import { boot, clickCard, clickPoint, clickText, dragCard, expectScene, inspect, readSavedProgress, reloadRun } from './driver'
import { cardPriority, choosePlay, chooseRoute } from '../support/policy'
import { bossRelicPick, eventPick, neowPick, rewardPick, shopPick } from '../support/strategy'

async function selectFromPages(page: Page, id: string) {
    for (let attempt = 0; attempt < 20; attempt++) {
        const ui = await inspect(page)
        if (ui.cards.some(card => card.enabled && card.id === id)) return clickCard(page, id)
        await clickText(page, 'Next')
    }
    throw new Error(`Could not reach card ${id}`)
}

test('plays a seeded starter-deck run through all three acts and records victory', async ({ page }, testInfo) => {
    test.setTimeout(process.env.CI ? 900_000 : 300_000)
    const errors = await boot(page, createNewRun({ seed: process.env.PLAYTHROUGH_SEED ?? 'fidelity-ironclad-377' }))
    await expectScene(page, 'Neow')
    const history: string[] = []
    let lastCombat = ''
    let reloadedReward = false
    let reloadedBossRelic = false
    let reloadedActTwo = false
    try {
        await clickText(page, neowPick((await inspect(page)).options!).label)
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
                const play = choosePlay(state, ui.legalPlays!)
                if (play) {
                    await dragCard(page, play.card.instanceId, play.enemyIndex)
                    await expect.poll(async () => {
                        const after = await inspect(page)
                        return after.scene !== 'Combat' || !after.state!.player.hand.some(card => card.instanceId === play.card.instanceId)
                    }, { message: `Play ${play.card.defId}` }).toBe(true)
                } else await clickText(page, 'End Turn')
            } else if (ui.scene === 'Chest') {
                await clickText(page, 'Open chest')
            } else if (ui.scene === 'RelicAcquisition') {
                const step = ui.run!.pendingAcquisitions![0]
                if (step.kind === 'select') await clickCard(page, ui.cards.find(c => c.enabled)!.id)
                else if (step.kind === 'cards') { const id = rewardPick(ui.run!, step.choices!); if (id) await clickCard(page, id); else await clickText(page, 'Skip') }
                else await clickText(page, 'Skip')
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
                    const id = rewardPick(ui.run!, candidates.map(card => card.defId))
                    if (id) await clickCard(page, id)
                    else await clickText(page, 'Skip')
                }
                if ((await inspect(page)).texts.some(t => t.enabled && t.text === 'Skip Potion')) await clickText(page, 'Skip Potion')
                const remaining = await inspect(page)
                const relic = remaining.texts.find(t => t.enabled && t.text.startsWith('Take ') && !t.text.includes('Sapphire'))
                if (relic) await clickText(page, relic.text)
                if ((await inspect(page)).texts.some(t => t.enabled && t.text === 'Continue')) await clickText(page, 'Continue')
            } else if (ui.scene === 'Campfire') {
                const upgrades = ui.run!.deck.filter(canUpgradeCard).sort((a, b) => cardPriority(b.defId) - cardPriority(a.defId))
                if (ui.run!.player.hp < ui.run!.player.maxHp * 0.8 && ui.texts.some(t => t.enabled && t.text.startsWith('Rest'))) {
                    await clickText(page, ui.texts.find(t => t.enabled && t.text.startsWith('Rest'))!.text)
                } else if (upgrades.length && ui.texts.some(t => t.enabled && t.text === 'Smith · upgrade a card')) {
                    await clickText(page, 'Smith · upgrade a card')
                    await selectFromPages(page, upgrades[0].instanceId)
                } else await clickText(page, 'Skip')
            } else if (ui.scene === 'Shop') {
                const index = shopPick(ui.run!, ui.inventory!)
                if (index >= 0) {
                    const label = ui.texts.find(t => t.enabled && t.y === 190 && t.x === 18 + index * 109)!
                    await clickPoint(page, label.x + label.width / 2, label.y + label.height / 2)
                } else await clickText(page, 'Leave')
            } else if (ui.scene === 'Event') {
                if (ui.run!.eventState?.resolved) await clickText(page, 'Continue')
                else if (ui.run!.eventState?.matching) {
                    const board = ui.run!.eventState.matching, revealed = board.revealed.length === 2 ? [] : board.revealed
                    const index = board.cards.findIndex((_, i) => !board.matched.includes(i) && !revealed.includes(i))
                    await clickPoint(page, 24 + index % 6 * 125 + 55, 148 + Math.floor(index / 6) * 89 + 38)
                } else {
                    const pick = eventPick(ui.run!)
                    await clickText(page, pick.choice.label)
                    if (pick.choice.requiresSelection === 'reward') await clickCard(page, pick.selection.cardId!)
                    else if (pick.choice.requiresSelection) await selectFromPages(page, pick.selection.cardInstanceId!)
                }
            } else if (ui.scene === 'BossRelic') {
                const pending = ui.run!.bossRelicChoicePending!
                await reloadRun(page, 'BossRelic')
                expect((await inspect(page)).run!.bossRelicChoicePending).toEqual(pending)
                reloadedBossRelic = true
                const pick = bossRelicPick(pending.choices)
                history.push(`Boss relic: ${RELIC_DEFS[pick].name}`)
                const index = pending.choices.indexOf(pick)
                const button = ui.texts.filter(t => t.enabled && t.text === 'Take Relic')[index]
                await clickPoint(page, button.x + button.width / 2, button.y + button.height / 2)
            } else throw new Error(`Unexpected scene ${ui.scene}`)
        }
        await expectScene(page, 'RunSummary')
        const summary = await inspect(page)
        history.push(...summary.texts.map(text => text.text))
        expect(summary.texts.some(t => t.text === 'Ironclad · VICTORY'), history.join('\n')).toBe(true)
        expect(history.some(line => line.startsWith('Act 3'))).toBe(true)
        expect(reloadedReward && reloadedBossRelic && reloadedActTwo).toBe(true)
        const saved = await readSavedProgress(page)
        expect(saved.run).toBeNull()
        expect(saved.meta).toMatchObject({ totalRuns: 1, totalWins: 1, bestAscensionUnlocked: 0, ironcladUnlockTier: 1 })
        await page.reload()
        await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
        expect(await readSavedProgress(page)).toEqual(saved)
        expect(errors).toEqual([])
    } finally {
        await testInfo.attach('playthrough-log', { body: history.join('\n'), contentType: 'text/plain' })
    }
})
