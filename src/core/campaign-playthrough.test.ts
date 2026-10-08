import { expect, it } from 'vitest'
import { createNewRun } from './run'
import { canUpgradeCard, createCardInstance, resolveCard } from './cards'
import { createCombatEngine, applyCombatVictory } from './combat'
import { generateMap, defaultUnknownWeights, resolveUnknown, updateUnknownWeights } from './map'
import { completeRoom, getRunDestination } from './progression'
import { RNG } from './rng'
import { generateRewardBundle } from './rewards'
import { advanceAct, finishBossCombat, finishRewards } from './campaign'
import { applyRelicAcquisition, canRestAtCampfire } from './relics'
import { generateShop, purchaseShopItem } from './shop'
import { eventSeed, initializeEvent, resolveEventChoice } from './events'
import { applyNeowOption, rollNeowOptions } from './neow'
import { healRun } from './health'
import { choosePlay, chooseRoute } from '../../tests/browser/policy'
import { bossRelicPick, eventPick, neowPick, rewardPick, shopPick, upgradePick } from '../../tests/browser/strategy'
const meta = { bestAscensionUnlocked: 0, totalWins: 0, totalRuns: 0, ironcladUnlockTier: 0, unlockedCardIds: [], unlockedRelicIds: [] }
it('plays a legal seeded starter deck through all three acts', () => {
    const run = createNewRun('campaign-312')
    applyNeowOption(run, meta, neowPick(rollNeowOptions(run.neowSeed)))
    let scene = getRunDestination(run).scene
    for (let step = 0; step < 250 && run.player.hp > 0 && scene !== 'RunSummary'; step++) {
        if (scene === 'Map') {
            const node = chooseRoute(generateMap(run.seed, run.act), run.mapProgress?.currentNodeId)
            run.mapProgress = { currentNodeId: node.id }; run.burningEliteActive = !!node.burning && !run.keys.emerald
            let kind: string = node.kind
            if (kind === 'unknown') { const weights = run.unknownWeights ?? defaultUnknownWeights(); kind = resolveUnknown(new RNG(`${run.seed}-unknown-${run.floor}`), weights); run.unknownWeights = updateUnknownWeights(weights, kind as 'event') }
            if (kind === 'monster' || kind === 'elite' || kind === 'boss') run.pendingRoom = { scene: 'Combat', roomKind: kind }
            else if (kind === 'rest') run.pendingRoom = { scene: 'Campfire' }
            else if (kind === 'shop') run.pendingRoom = { scene: 'Shop' }
            else if (kind === 'chest') run.pendingRoom = { scene: 'Rewards', rewards: generateRewardBundle(`${run.seed}-reward-${node.id}-${node.kind === 'unknown' ? 'unknown-chest' : 'chest'}`, 'chest', run, meta) }
            else run.pendingRoom = { scene: 'Event' }
        } else if (scene === 'Combat' && run.pendingRoom?.scene === 'Combat') {
            const kind = run.pendingRoom.roomKind
            const engine = createCombatEngine(run, kind)
            for (let plays = 0; plays < 600 && !engine.state.victory && !engine.state.defeat; plays++) {
                const choice = engine.getPendingChoice()
                if (choice) { engine.submitPendingChoice(choice.eligibleInstanceIds.slice(0, choice.minSelections)); engine.runUntilIdle(); continue }
                const play = choosePlay(engine.state)
                if (play) {
                    const def = resolveCard(play.card)
                    const targets = def.targeting?.type === 'single_enemy' ? [engine.state.enemies[play.enemyIndex!].id] : def.targeting?.type === 'all_enemies' ? engine.state.enemies.filter(e => e.hp > 0).map(e => e.id) : def.targeting?.type === 'player' ? ['player'] : []
                    engine.playCard(play.card, targets); engine.runUntilIdle()
                } else { engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle() }
            }
            if (!engine.state.victory) { run.player.hp = 0; break }
            applyCombatVictory(run, engine.state.player); run.pendingRoom = undefined
            if (kind === 'elite' && run.burningEliteActive) run.keys.emerald = true
            run.burningEliteActive = false
            if (run.eventCombat) { run.pendingRoom = { scene: 'Rewards', rewards: run.eventCombat.rewards }; run.eventCombat = undefined; run.eventState = undefined }
            else if (kind === 'boss') { const next = finishBossCombat(run, meta); if (next === 'RunSummary') { scene = next; break } }
            else { if (kind === 'monster') run.hallwayCount = (run.hallwayCount ?? 0) + 1; run.pendingRoom = { scene: 'Rewards', rewards: generateRewardBundle(`${run.seed}-reward-${run.mapProgress?.currentNodeId}-${kind}`, kind === 'elite' ? 'elite' : 'hallway', run, meta) } }
        } else if (scene === 'Rewards' && run.pendingRoom?.scene === 'Rewards') {
            for (const item of run.pendingRoom.rewards.items) {
                if (item.kind === 'gold') run.gold += item.amount
                if (item.kind === 'relic') applyRelicAcquisition(run, item.relicId)
                if (item.kind === 'cards') { const id = rewardPick(run, item.choices); if (id) run.deck.push(createCardInstance(id, item.upgrades?.[item.choices.indexOf(id)] ?? 0)) }
            }
            finishRewards(run)
        } else if (scene === 'BossRelic') { applyRelicAcquisition(run, bossRelicPick(run.bossRelicChoicePending!.choices)); advanceAct(run) }
        else if (scene === 'Shop') {
            const stock = generateShop(run, meta)
            for (let i = 0; i < 8; i++) { const index = shopPick(run, stock); if (index < 0) break; purchaseShopItem(run, meta, stock, 'cards', index) }
            completeRoom(run)
        } else if (scene === 'Campfire') {
            const card = upgradePick(run)
            if (run.player.hp < run.player.maxHp * 0.8 && canRestAtCampfire(run)) healRun(run, Math.floor(run.player.maxHp * 0.3))
            else if (card && canUpgradeCard(card)) card.upgradeLevel++
            completeRoom(run)
        } else if (scene === 'Event') {
            initializeEvent(run, meta)
            if (run.eventState?.resolved) completeRoom(run)
            else { const pick = eventPick(run); const result = resolveEventChoice(run, meta, run.eventState!.id, pick.choice.id, eventSeed(run), pick.selection); if (result.nextScene === 'RunSummary') break }
        }
        scene = getRunDestination(run).scene
    }
    expect(scene).toBe('RunSummary')
    expect(run.player.hp).toBeGreaterThan(0)
    expect(run.actsCleared).toEqual([1, 2, 3])
})
