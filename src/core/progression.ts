import type { Encounter } from './encounters'
import { getRunMap } from './map'
import type { PotionId } from './potions'
import type { RewardBundle } from './rewards'
import type { RelicId, RunState } from './run'

export interface ShopInventory {
    cards: string[]
    version?: 2
    relic?: RelicId
    relics?: RelicId[]
    cardPrices?: number[]
    relicPrices?: number[]
    potionPrices?: number[]
    saleIndex?: number
    removalUsed?: boolean
    restockCount?: number
    potions: PotionId[]
}

export type PendingRoom =
    | { scene: 'Chest'; rewardSeed: string }
    | { scene: 'Combat'; roomKind: 'monster' | 'elite' | 'boss'; encounter?: Encounter }
    | { scene: 'Rewards'; rewards: RewardBundle }
    | { scene: 'Shop'; inventory?: ShopInventory }
    | { scene: 'Campfire' | 'Event' }

export function completedRunResult(run: RunState): 'victory' | 'defeat' | undefined {
    return run.player.hp <= 0 ? 'defeat' : run.runFlags?.victory ? 'victory' : undefined
}

export function getRunDestination(run: RunState) {
    const result = completedRunResult(run)
    if (result) return { scene: 'RunSummary', data: { run, result } }
    if (run.pendingAcquisitions?.length) return { scene: 'RelicAcquisition', data: { run } }
    if (run.pendingBlights?.length) return { scene: 'BlightChest', data: { run } }
    if (run.startingDraft) return { scene: 'StartingDeck', data: { run } }
    if (run.bossRelicChoicePending) return { scene: 'BossRelic', data: { run } }
    if (!run.neowCompleted) return { scene: 'Neow', data: { run } }
    if (run.pendingRoom) return { scene: run.pendingRoom.scene, data: { run, ...run.pendingRoom } }

    // Old saves had no room checkpoint. A boss node has no outgoing path, so it
    // can only resume at the boss fight unless the relic choice is already saved.
    const nodeId = run.mapProgress?.currentNodeId
    if (nodeId && getRunMap(run).byId[nodeId]?.kind === 'boss') {
        return { scene: 'Combat', data: { run, roomKind: 'boss' as const } }
    }
    return { scene: 'Map', data: { run } }
}

export function completeRoom(run: RunState): void {
    run.eventState = undefined
    run.pendingRoom = undefined
    run.floor += 1
}
