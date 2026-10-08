import { generateMap } from './map'
import type { PotionId } from './potions'
import type { RewardBundle } from './rewards'
import type { RelicId, RunState } from './run'

export interface ShopInventory {
    cards: string[]
    relic: RelicId
    potions: PotionId[]
}

export type PendingRoom =
    | { scene: 'Combat'; roomKind: 'monster' | 'elite' | 'boss' }
    | { scene: 'Rewards'; rewards: RewardBundle }
    | { scene: 'Shop'; inventory?: ShopInventory }
    | { scene: 'Campfire' | 'Event' }

export function getRunDestination(run: RunState) {
    if (run.bossRelicChoicePending) return { scene: 'BossRelic', data: { run } }
    if (!run.neowCompleted) return { scene: 'Neow', data: { run } }
    if (run.pendingRoom) return { scene: run.pendingRoom.scene, data: { run, ...run.pendingRoom } }

    // Old saves had no room checkpoint. A boss node has no outgoing path, so it
    // can only resume at the boss fight unless the relic choice is already saved.
    const nodeId = run.mapProgress?.currentNodeId
    if (nodeId && generateMap(run.seed, run.act, 15, 7, run.asc).byId[nodeId]?.kind === 'boss') {
        return { scene: 'Combat', data: { run, roomKind: 'boss' as const } }
    }
    return { scene: 'Map', data: { run } }
}

export function completeRoom(run: RunState): void {
    run.pendingRoom = undefined
    run.floor += 1
}
