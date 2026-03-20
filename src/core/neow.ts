import { CARD_DEFS, canUpgradeCard, createCardInstance } from './cards'
import { MVP_RELIC_POOL, applyRelicAcquisition } from './relics'
import { RNG } from './rng'
import type { RelicId, RunState } from './run'
import { obtainCurse, removeCardByInstanceId } from './run'

export type NeowOptionId =
    | 'GAIN_100_GOLD'
    | 'REMOVE_CARD'
    | 'UPGRADE_CARD'
    | 'GAIN_7_MAX_HP'
    | 'GAIN_250_GOLD_INJURY'
    | 'GAIN_COMMON_RELIC_REGRET'
    | 'GAIN_RARE_CARD_PAIN'
    | 'GAIN_10_MAX_HP_CLUMSY'

export interface NeowOption {
    id: NeowOptionId
    label: string
    description: string
    category: 'benefit' | 'tradeoff'
    requiresSelection?: 'remove' | 'upgrade' | 'rare_card'
    preview?: { gold?: number; maxHp?: number; curseId?: string; relicId?: RelicId; cardId?: string }
}

const BENEFIT_OPTIONS: NeowOption[] = [
    { id: 'GAIN_100_GOLD', label: 'Gain 100 Gold', description: 'Obtain 100 gold.', category: 'benefit', preview: { gold: 100 } },
    { id: 'REMOVE_CARD', label: 'Remove a Card', description: 'Remove 1 card from your deck.', category: 'benefit', requiresSelection: 'remove' },
    { id: 'UPGRADE_CARD', label: 'Upgrade a Card', description: 'Upgrade 1 card.', category: 'benefit', requiresSelection: 'upgrade' },
    { id: 'GAIN_7_MAX_HP', label: 'Gain 7 Max HP', description: 'Increase max HP by 7.', category: 'benefit', preview: { maxHp: 7 } },
]

const TRADEOFF_OPTIONS: NeowOption[] = [
    { id: 'GAIN_250_GOLD_INJURY', label: 'Gain 250 Gold', description: 'Obtain 250 gold. Obtain Injury.', category: 'tradeoff', preview: { gold: 250, curseId: 'INJURY' } },
    { id: 'GAIN_COMMON_RELIC_REGRET', label: 'Gain a Common Relic', description: 'Obtain a random common relic. Obtain Regret.', category: 'tradeoff', preview: { curseId: 'REGRET' } },
    { id: 'GAIN_RARE_CARD_PAIN', label: 'Choose a Rare Card', description: 'Choose 1 rare card. Obtain Pain.', category: 'tradeoff', requiresSelection: 'rare_card', preview: { curseId: 'PAIN' } },
    { id: 'GAIN_10_MAX_HP_CLUMSY', label: 'Gain 10 Max HP', description: 'Increase max HP by 10. Obtain Clumsy.', category: 'tradeoff', preview: { maxHp: 10, curseId: 'CLUMSY' } },
]

export function rollNeowOptions(seed: string): NeowOption[] {
    const rng = new RNG(seed)
    const benefits = [...BENEFIT_OPTIONS]
    const tradeoffs = [...TRADEOFF_OPTIONS]
    rng.shuffleInPlace(benefits)
    rng.shuffleInPlace(tradeoffs)
    return [...benefits.slice(0, 2), ...tradeoffs.slice(0, 2)]
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

export function getNeowRareCardChoices(seed: string): string[] {
    const rng = new RNG(`${seed}-rare`)
    const pool = Object.values(CARD_DEFS)
        .filter(card => card.poolEnabled && card.rarity === 'rare')
        .map(card => card.id)
    rng.shuffleInPlace(pool)
    return pool.slice(0, Math.min(3, pool.length))
}

export function getNeowOptionById(id: NeowOptionId): NeowOption {
    return [...BENEFIT_OPTIONS, ...TRADEOFF_OPTIONS].find(option => option.id === id) ?? BENEFIT_OPTIONS[0]
}

export function applyNeowOption(
    run: RunState,
    optionId: NeowOptionId,
    args?: { removeInstanceId?: string; upgradeInstanceId?: string; rewardCardId?: string; rewardRelicId?: RelicId },
): void {
    if (optionId === 'GAIN_100_GOLD') {
        run.gold += 100
    } else if (optionId === 'REMOVE_CARD') {
        if (args?.removeInstanceId) removeCardByInstanceId(run, args.removeInstanceId)
    } else if (optionId === 'UPGRADE_CARD') {
        const card = run.deck.find(entry => entry.instanceId === args?.upgradeInstanceId)
        if (card && canUpgradeCard(card)) {
            card.upgradeLevel = card.defId === 'SEARING_BLOW' ? card.upgradeLevel + 1 : 1
        }
    } else if (optionId === 'GAIN_7_MAX_HP') {
        run.player.maxHp += 7
        run.player.hp += 7
    } else if (optionId === 'GAIN_250_GOLD_INJURY') {
        run.gold += 250
        obtainCurse(run, 'INJURY')
    } else if (optionId === 'GAIN_COMMON_RELIC_REGRET') {
        if (args?.rewardRelicId) applyRelicAcquisition(run, args.rewardRelicId)
        obtainCurse(run, 'REGRET')
    } else if (optionId === 'GAIN_RARE_CARD_PAIN') {
        if (args?.rewardCardId) run.deck.push(createCardInstance(args.rewardCardId))
        obtainCurse(run, 'PAIN')
    } else if (optionId === 'GAIN_10_MAX_HP_CLUMSY') {
        run.player.maxHp += 10
        run.player.hp += 10
        obtainCurse(run, 'CLUMSY')
    }

    run.neowCompleted = true
    run.neowChoiceId = optionId
}
