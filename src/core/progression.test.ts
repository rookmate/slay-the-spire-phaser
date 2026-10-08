import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateMap } from './map'
import { completeRoom, getRunDestination, type PendingRoom } from './progression'
import { createNewRun, loadRun, saveRun } from './run'

beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
    })
})
afterEach(() => vi.unstubAllGlobals())

describe('run checkpoints', () => {
    const rooms: PendingRoom[] = [
        { scene: 'Combat', roomKind: 'monster' },
        { scene: 'Combat', roomKind: 'elite' },
        { scene: 'Combat', roomKind: 'boss' },
        { scene: 'Campfire' },
        { scene: 'Event' },
        { scene: 'Shop', inventory: { cards: ['STRIKE'], potions: ['FIRE_POTION'], relic: 'ANCHOR' } },
        { scene: 'Rewards', rewards: { tier: 'hallway', items: [{ kind: 'gold', amount: 15 }, { kind: 'cards', choices: ['STRIKE'] }] } },
    ]
    it.each(rooms)('resumes $scene from its saved room checkpoint', pendingRoom => {
        const run = createNewRun('resume')
        run.neowCompleted = true
        run.pendingRoom = pendingRoom
        run.mapProgress = { currentNodeId: '13:3' }
        saveRun(run)
        const loaded = loadRun()!
        expect(getRunDestination(loaded)).toEqual({ scene: pendingRoom.scene, data: { run: loaded, ...pendingRoom } })

        completeRoom(loaded)
        saveRun(loaded)
        expect(loadRun()?.floor).toBe(2)
        expect(getRunDestination(loadRun()!).scene).toBe('Map')
    })

    it('restarts combat with checkpoint resources instead of a partially saved potion use', () => {
        const run = createNewRun('combat-checkpoint')
        run.neowCompleted = true
        run.potions = ['FIRE_POTION']
        run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
        saveRun(run)
        run.potions.pop()
        run.relicState = { HAPPY_FLOWER: { counter: 2 } }

        const loaded = loadRun()!
        expect(loaded.potions).toEqual(['FIRE_POTION'])
        expect(loaded.relicState).toEqual({})
        expect(getRunDestination(loaded).scene).toBe('Combat')
    })

    it('does not duplicate rewards when restarting an unfinished choice screen', () => {
        const run = createNewRun('reward-checkpoint')
        run.neowCompleted = true
        run.pendingRoom = { scene: 'Rewards', rewards: { tier: 'chest', items: [{ kind: 'gold', amount: 30 }] } }
        saveRun(run)
        run.gold += 30
        const loaded = loadRun()!
        expect(loaded.gold).toBe(99)
        expect(loaded.pendingRoom).toEqual(run.pendingRoom)
        loaded.gold += 30
        completeRoom(loaded)
        saveRun(loaded)
        expect(loadRun()?.gold).toBe(129)
        expect(getRunDestination(loadRun()!).scene).toBe('Map')
    })

    it('persists purchases together with remaining shop stock', () => {
        const run = createNewRun('shop-checkpoint')
        run.neowCompleted = true
        const inventory = { cards: ['STRIKE', 'DEFEND'], potions: [], relic: 'ANCHOR' as const }
        run.pendingRoom = { scene: 'Shop', inventory }
        inventory.cards.splice(0, 1)
        run.gold -= 50
        saveRun(run)
        expect(loadRun()?.gold).toBe(49)
        expect(loadRun()?.pendingRoom).toEqual({ scene: 'Shop', inventory: { ...inventory, cards: ['DEFEND'] } })
    })

    it('recovers a legacy save stranded at a boss and prioritizes a won boss relic choice', () => {
        const run = createNewRun('legacy-boss')
        run.neowCompleted = true
        const boss = generateMap(run.seed).nodes.find(node => node.kind === 'boss')!
        run.mapProgress = { currentNodeId: boss.id }
        expect(getRunDestination(run)).toEqual({ scene: 'Combat', data: { run, roomKind: 'boss' } })
        run.bossRelicChoicePending = { sourceBossId: 'SLIME_BOSS', choices: ['SOZU'] }
        expect(getRunDestination(run).scene).toBe('BossRelic')
    })

    it('keeps the starting bonus and completed map as resume destinations', () => {
        const run = createNewRun('resume-defaults')
        expect(getRunDestination(run).scene).toBe('Neow')
        run.neowCompleted = true
        expect(getRunDestination(run).scene).toBe('Map')
    })
})
