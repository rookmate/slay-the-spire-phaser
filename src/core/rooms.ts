import { prepareEncounter, recordEncounter } from './encounterState'
import { campaignAchievements, combatAchievements, endingAchievements } from './achievements/progress'
import { affectsRoomTier } from './ascension'
import { finishBossCombat } from './campaign'
import { applyCombatEscape, applyCombatVictory } from './combat'
import type { Engine } from './engine'
import { getRunMap, type MapNode, type RoomKind } from './map'
import type { MetaState } from './meta'
import { canEnterMapNode, enterMapNode } from './relics/campaignRules'
import { generateRewardBundle } from './rewards'
import { RNG } from './rng'
import type { RunState } from './run'
import { recordCombatStats } from './score'

export function enterRoom(run: RunState, node: MapNode): boolean {
    const map = getRunMap(run)
    if (!canEnterMapNode(run, map, node)) return false
    const kind = enterMapNode(run, map, node, new RNG(`${run.seed}-unknown-${run.floor}`))
    run.burningEliteActive = Boolean(run.keysEnabled !== false && node.burning && !run.keys.emerald)
    if (kind === 'monster' || kind === 'elite' || kind === 'boss') {
        run.pendingRoom = { scene: 'Combat', roomKind: kind }
        if (kind !== 'boss') prepareEncounter(run, kind)
    }
    else if (kind === 'rest') run.pendingRoom = { scene: 'Campfire' }
    else if (kind === 'shop') run.pendingRoom = { scene: 'Shop' }
    else if (kind === 'chest') run.pendingRoom = { scene: 'Chest', rewardSeed: `${run.seed}-reward-${node.id}-${node.kind === 'unknown' ? 'unknown-chest' : 'chest'}` }
    else run.pendingRoom = { scene: 'Event' }
    return true
}

export function openChest(run: RunState, meta: MetaState): boolean {
    if (run.pendingRoom?.scene !== 'Chest') return false
    const rewards = generateRewardBundle(run.pendingRoom.rewardSeed, 'chest', run, meta)
    run.pendingRoom = { scene: 'Rewards', rewards }
    return true
}

/** Resolve combat into the same saved checkpoint for the UI and headless playthroughs. */
export function finishCombat(run: RunState, engine: Engine, room: RoomKind, meta: MetaState): 'victory' | 'defeat' | undefined {
    if (!engine.state.victory && !engine.state.defeat) throw new Error('Combat has not ended')
    recordCombatStats(run, engine, room)
    combatAchievements(run, engine)
    if (engine.state.defeat) { run.player.hp = 0; return 'defeat' }
    recordEncounter(run)
    if (engine.state.escaped) { applyCombatEscape(run, engine.state.player, room); return }
    applyCombatVictory(run, engine.state.player)
    run.pendingRoom = undefined
    if (run.eventCombat) {
        const rewards = run.eventCombat.rewards
        if (run.eventCombat.resumeEvent) run.rewardReturnRoom = { scene: 'Event' }
        else run.eventState = undefined
        run.eventCombat = undefined
        run.pendingRoom = { scene: 'Rewards', rewards }
        return
    }
    if (room === 'elite' && run.burningEliteActive) run.keys.emerald = true
    run.burningEliteActive = false
    if (room === 'monster') run.hallwayCount = (run.hallwayCount ?? 0) + 1
    if (room === 'boss') {
        const clearedAct = run.act
        const finished = finishBossCombat(run, meta) === 'RunSummary'
        if (clearedAct === 3) campaignAchievements(run)
        if (clearedAct === 4) endingAchievements(run)
        if (finished) { run.runFlags ??= {}; run.runFlags.victory = true }
        return finished ? 'victory' : undefined
    }
    const nodeId = run.mapProgress?.currentNodeId ?? `floor-${run.floor}`
    const rewards = generateRewardBundle(`${run.seed}-reward-${nodeId}-${room}`, affectsRoomTier(room), run, meta, { roomKind: room, asc: run.asc })
    run.pendingRoom = { scene: 'Rewards', rewards }
}
