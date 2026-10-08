import { choosePotion } from './potions'
import { createNewRun } from '../../src/core/run'
import type { CharacterId } from '../../src/core/characters'
import { createCombatEngine } from '../../src/core/combat'
import { getRunMap } from '../../src/core/map'
import { completeRoom, getRunDestination } from '../../src/core/progression'
import { advanceAct, finishRewards } from '../../src/core/campaign'
import { applyRelicAcquisition } from '../../src/core/relics'
import { generateShop, purchaseShopItem, purchaseRemoval } from '../../src/core/shop'
import { eventSeed, initializeEvent, resolveEventChoice } from '../../src/core/events'
import { applyNeowOption, rollNeowOptions } from '../../src/core/neow'
import { canUseCampfire, useCampfire } from '../../src/core/campfire'
import { prepareAcquisition, chooseAcquisition, acquisitionCandidates } from '../../src/core/relics/acquisitions'
import { flipEventCard } from '../../src/core/events/additionalResolution'
import { enterRoom, openChest, finishCombat } from '../../src/core/rooms'
import { claimReward } from '../../src/core/rewardClaims'
import { choosePlay, chooseRoute } from './policy'
import { bossRelicPick, eventPick, neowPick, rewardPick, shopPick, upgradePick, shouldRest } from './strategy'
import type { Engine } from '../../src/core/engine'
const meta = { bestAscensionUnlocked: 0, totalWins: 0, totalRuns: 0, ironcladUnlockTier: 0, unlockedCardIds: [], unlockedRelicIds: [] }

function playCombat(engine: Engine): void {
    for (let plays = 0; plays < 600 && !engine.state.victory && !engine.state.defeat; plays++) {
        const choice = engine.getPendingChoice()
        if (choice) { engine.submitPendingChoice(choice.eligibleInstanceIds.slice(0, choice.minSelections)); engine.runUntilIdle(); continue }
        const potion = engine.state.player.character === 'watcher' ? choosePotion(engine) : undefined
        if (potion) {
            const before = engine.run!.potions.length
            engine.usePotionAtIndex(potion.index, potion.targets)
            if (engine.run!.potions.length >= before) throw new Error('Potion rejected')
            continue
        }
        const legal = engine.getPlayableCards(), play = choosePlay(engine.state, legal)
        if (play) {
            const action = legal.find(action => action.card.instanceId === play.card.instanceId && (play.enemyIndex === undefined || action.targets.includes(engine.state.enemies[play.enemyIndex].id)))!
            const events = engine.playCard(play.card, action.targets)
            if (!events.some(event => event.kind === 'CardPlayed')) throw new Error(`Rejected ${play.card.defId}`)
            engine.runUntilIdle()
        } else { engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle() }
        const player = engine.state.player
        const cards = [...player.hand, ...player.drawPile, ...player.discardPile, ...player.exhaustPile, ...engine.state.limbo.map(entry => entry.card)]
        if (new Set(cards.map(card => card.instanceId)).size !== cards.length) throw new Error('Duplicate combat card ownership')
    }
    if (!engine.state.victory && !engine.state.defeat) throw new Error('Combat exceeded action limit')
}

export function simulateCampaign(seed: string, character: CharacterId = 'ironclad', recoverCheckpoints = false) {
    let run = createNewRun({ seed, character })
    const history: string[] = []
    applyNeowOption(run, meta, neowPick(rollNeowOptions(run.neowSeed)))
    let scene = getRunDestination(run).scene
    try {
        for (let step = 0; step < 300 && run.player.hp > 0 && scene !== 'RunSummary'; step++) {
            history.push(`${scene}: act ${run.act}, floor ${run.floor}, HP ${run.player.hp}, deck ${run.deck.map(c => c.defId).join(',')}`)
            if (scene === 'Map') {
                if (!enterRoom(run, chooseRoute(getRunMap(run), run.mapProgress?.currentNodeId))) throw new Error('Illegal route')
            } else if (scene === 'Chest') {
                if (!openChest(run, meta)) throw new Error('Chest did not open')
            } else if (scene === 'Combat' && run.pendingRoom?.scene === 'Combat') {
                const kind = run.pendingRoom.roomKind, engine = createCombatEngine(run, kind)
                history.push(`Enemies: ${engine.state.enemies.map(e => e.name).join(', ')}`)
                playCombat(engine)
                const result = finishCombat(run, engine, kind, meta)
                if (result) { scene = 'RunSummary'; break }
            } else if (scene === 'Rewards' && run.pendingRoom?.scene === 'Rewards') {
                const items = run.pendingRoom.rewards.items
                for (let i = 0; i < items.length; i++) {
                    if (run.pendingRoom.rewards.claimed?.includes(i) || items[i].kind === 'boss_relics') continue
                    const item = items[i], cardId = item.kind === 'cards' ? rewardPick(run, item.choices) : undefined
                    if (!claimReward(run, i, item.kind === 'cards' ? cardId ? { cardId } : 'skip' : item.kind === 'potion' && run.potions.length >= run.maxPotionSlots ? 'skip' : undefined)) throw new Error('Reward rejected')
                    if (run.pendingAcquisitions?.length) break
                }
                if (!run.pendingAcquisitions?.length) finishRewards(run)
            } else if (scene === 'BossRelic') { applyRelicAcquisition(run, bossRelicPick(run.bossRelicChoicePending!.choices, run.character)); advanceAct(run) }
            else if (scene === 'Shop') {
                const stock = generateShop(run, meta)
                if (run.character === 'watcher') {
                    const remove = run.deck.find(card => card.defId === 'REGRET') ?? run.deck.find(card => card.defId === 'STRIKE_WATCHER')
                    if (remove) purchaseRemoval(run, stock, remove.instanceId)
                }
                for (let i = 0; i < 8; i++) { const index = shopPick(run, stock); if (index < 0) break; purchaseShopItem(run, meta, stock, 'cards', index) }
                completeRoom(run)
            } else if (scene === 'Campfire') {
                const card = upgradePick(run)
                if (shouldRest(run) && canUseCampfire(run, 'rest')) useCampfire(run, 'rest')
                else if (card && canUseCampfire(run, 'smith')) useCampfire(run, 'smith', card.instanceId)
                else useCampfire(run, 'skip')
            } else if (scene === 'Event') {
                initializeEvent(run, meta)
                if (run.eventState?.resolved) completeRoom(run)
                else if (run.eventState?.matching) {
                    const board = run.eventState.matching
                    if (board.revealed.length === 2) board.revealed = []
                    const index = board.cards.findIndex((_, i) => !board.matched.includes(i) && !board.revealed.includes(i))
                    flipEventCard(run, index)
                } else { const pick = eventPick(run); const result = resolveEventChoice(run, meta, run.eventState!.id, pick.choice.id, eventSeed(run), pick.selection); if (result.nextScene === 'RunSummary') { scene = 'RunSummary'; break } }
            } else if (scene === 'RelicAcquisition') {
                const step = prepareAcquisition(run, meta)
                if (step?.kind === 'select') chooseAcquisition(run, meta, acquisitionCandidates(run, step)[0]?.instanceId)
                else if (step?.kind === 'cards') chooseAcquisition(run, meta, rewardPick(run, step.choices!))
                else if (step?.kind === 'potion') chooseAcquisition(run, meta)
            } else throw new Error(`Unexpected scene ${scene}`)
            if (recoverCheckpoints) run = JSON.parse(JSON.stringify(run))
            if (new Set(run.deck.map(card => card.instanceId)).size !== run.deck.length) throw new Error('Duplicate deck card ownership')
            scene = getRunDestination(run).scene
        }
    } catch (error) { throw new Error(`${character} seed ${seed}\n${history.slice(-5).join('\n')}\n${String(error)}`) }
    return { run, scene, history }
}
