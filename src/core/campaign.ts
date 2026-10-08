import { healRun } from './health'
import { ACT_BOSSES, type EnemyKey } from './encounters'
import { RNG } from './rng'
import type { RunState } from './run'
import { defaultUnknownWeights } from './map'
import { generateRewardBundle } from './rewards'
import type { MetaState } from './meta'

export function getRunBoss(run: RunState): EnemyKey {
    const bosses = [...ACT_BOSSES[run.act]]
    new RNG(`${run.seed}-boss-${run.act}`).shuffleInPlace(bosses)
    return bosses[run.secondBoss ? 1 : 0]
}
export function hasAllKeys(run: RunState): boolean { return Boolean(run.keys.ruby && run.keys.emerald && run.keys.sapphire) }

export function advanceAct(run: RunState): void {
    if (run.act >= 4) return
    healRun(run, Math.round((run.player.maxHp - run.player.hp) * (run.asc >= 5 ? 0.75 : 1)))
    run.act = (run.act + 1) as 2 | 3 | 4
    run.floor += 2
    run.mapRows = 16
    run.mapProgress = {}
    run.eventState = undefined
    run.combatCount = 0
    run.hallwayCount = 0
    run.potionChance = 0.4
    run.secondBoss = false
    run.bossRelicChoicePending = undefined
    run.pendingRoom = undefined
    run.unknownWeights = defaultUnknownWeights()
}

/** Record boss victory once, then choose the next saved campaign checkpoint. */
export function finishBossCombat(run: RunState, meta: MetaState): 'Rewards' | 'Combat' | 'Map' | 'RunSummary' {
    if (run.act === 3 && run.asc >= 20 && !run.secondBoss) {
        run.secondBoss = true
        run.floor += 1
        run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
        return 'Combat'
    }
    run.actsCleared = [...new Set([...(run.actsCleared ?? []), run.act])]
    if (run.act <= 2) {
        const rewards = generateRewardBundle(`${run.seed}-boss-rewards-${run.act}`, 'boss', run, meta)
        run.pendingRoom = { scene: 'Rewards', rewards }
        return 'Rewards'
    }
    if (run.act === 3 && hasAllKeys(run)) { advanceAct(run); return 'Map' }
    run.pendingRoom = undefined
    return 'RunSummary'
}

export function finishRewards(run: RunState): 'BossRelic' | 'Map' | 'Shop' {
    if (run.rewardReturnRoom?.scene === 'Shop') {
        run.pendingRoom = run.rewardReturnRoom; run.rewardReturnRoom = undefined; return 'Shop'
    }
    run.eventState = undefined
    const advanceFloor = run.pendingRoom?.scene !== 'Rewards' || run.pendingRoom.rewards.advanceFloor !== false
    if (run.pendingRoom?.scene === 'Rewards' && run.pendingRoom.rewards.tier === 'boss') {
        const item = run.pendingRoom.rewards.items.find(item => item.kind === 'boss_relics')
        run.bossRelicChoicePending = { sourceBossId: getRunBoss(run), choices: item?.kind === 'boss_relics' ? item.choices : [] }
        run.pendingRoom = undefined
        return 'BossRelic'
    }
    run.pendingRoom = undefined
    if (advanceFloor) run.floor += 1
    return 'Map'
}
