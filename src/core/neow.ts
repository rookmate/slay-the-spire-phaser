import { CARD_DEFS, canUpgradeCard, createCardInstance } from './cards'
import { MVP_RELIC_POOL, applyRelicAcquisition } from './relics'
import { RNG } from './rng'
import type { RelicId, RunState } from './run'

export type NeowOptionId =
    | 'GAIN_100_GOLD'
    | 'REMOVE_CARD'
    | 'UPGRADE_CARD'
    | 'GAIN_7_MAX_HP'
    | 'GAIN_COMMON_RELIC'
    | 'GAIN_COMMON_CARD'

export interface NeowOption {
    id: NeowOptionId
    label: string
    description: string
}

export const NEOW_OPTIONS: Record<NeowOptionId, NeowOption> = {
    GAIN_100_GOLD: { id: 'GAIN_100_GOLD', label: 'Gain 100 Gold', description: 'Obtain 100 gold.' },
    REMOVE_CARD: { id: 'REMOVE_CARD', label: 'Remove a Card', description: 'Remove 1 card from your deck.' },
    UPGRADE_CARD: { id: 'UPGRADE_CARD', label: 'Upgrade a Card', description: 'Upgrade 1 card.' },
    GAIN_7_MAX_HP: { id: 'GAIN_7_MAX_HP', label: 'Gain 7 Max HP', description: 'Increase max HP by 7.' },
    GAIN_COMMON_RELIC: { id: 'GAIN_COMMON_RELIC', label: 'Gain a Common Relic', description: 'Obtain a random common relic.' },
    GAIN_COMMON_CARD: { id: 'GAIN_COMMON_CARD', label: 'Gain a Common Card', description: 'Add a random common card to your deck.' },
}

export function rollNeowOptions(seed: string): NeowOption[] {
    const rng = new RNG(seed)
    const ids = Object.keys(NEOW_OPTIONS) as NeowOptionId[]
    const chosen = new Set<NeowOptionId>()
    while (chosen.size < 4) {
        chosen.add(ids[rng.int(0, ids.length - 1)])
    }
    return [...chosen].map(id => NEOW_OPTIONS[id])
}

export function getRandomNeowRelic(seed: string, run: RunState): RelicId {
    const rng = new RNG(`${seed}-relic`)
    const pool = MVP_RELIC_POOL.filter(id => !run.relics.includes(id))
    const source = pool.length > 0 ? pool : MVP_RELIC_POOL
    return source[rng.int(0, source.length - 1)]
}

export function getRandomNeowCommonCard(seed: string): string {
    const rng = new RNG(`${seed}-card`)
    const pool = Object.values(CARD_DEFS).filter(card => card.poolEnabled && card.rarity === 'common').map(card => card.id)
    return pool[rng.int(0, pool.length - 1)]
}

export function applyNeowOption(run: RunState, optionId: NeowOptionId, args?: { removeIndex?: number; upgradeIndex?: number; rewardCardId?: string; rewardRelicId?: RelicId }): void {
    if (optionId === 'GAIN_100_GOLD') {
        run.gold += 100
    } else if (optionId === 'GAIN_7_MAX_HP') {
        run.player.maxHp += 7
        run.player.hp += 7
    } else if (optionId === 'GAIN_COMMON_RELIC') {
        if (args?.rewardRelicId) applyRelicAcquisition(run, args.rewardRelicId)
    } else if (optionId === 'GAIN_COMMON_CARD') {
        if (args?.rewardCardId) run.deck.push(createCardInstance(args.rewardCardId))
    } else if (optionId === 'REMOVE_CARD') {
        if (typeof args?.removeIndex === 'number') run.deck.splice(args.removeIndex, 1)
    } else if (optionId === 'UPGRADE_CARD') {
        if (typeof args?.upgradeIndex === 'number') {
            const card = run.deck[args.upgradeIndex]
            if (card && canUpgradeCard(card)) {
                run.deck[args.upgradeIndex] = {
                    ...card,
                    upgradeLevel: card.defId === 'SEARING_BLOW' ? card.upgradeLevel + 1 : 1,
                }
            }
        }
    }

    run.neowCompleted = true
}
