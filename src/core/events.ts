import { CARD_DEFS, canUpgradeCard, createCardInstance, getUnlockedCollectibleCards } from './cards'
import type { MetaState } from './meta'
import { getUnlockedRelicPool, applyRelicAcquisition } from './relics'
import { RNG } from './rng'
import type { CardInstance } from './state'
import type { RelicId, RunState } from './run'
import { obtainCurse, removeCardByInstanceId } from './run'

export type EventId =
    | 'WORLD_OF_GOOP'
    | 'CLERIC'
    | 'UPGRADE_SHRINE'
    | 'GOLDEN_IDOL'
    | 'BIG_FISH'
    | 'THE_JOUST'
    | 'SCRAP_OOZE'
    | 'LIVING_WALL'
    | 'THE_SSSSERPENT'
    | 'FORGOTTEN_ALTAR'
    | 'THE_MAUSOLEUM'
    | 'BEGGAR'

export type EventChoiceId =
    | 'WORLD_OF_GOOP_REACH'
    | 'WORLD_OF_GOOP_LEAVE'
    | 'CLERIC_HEAL'
    | 'CLERIC_PURGE'
    | 'CLERIC_LEAVE'
    | 'UPGRADE_SHRINE_UPGRADE'
    | 'UPGRADE_SHRINE_MAX_HP'
    | 'GOLDEN_IDOL_TAKE'
    | 'GOLDEN_IDOL_LEAVE'
    | 'BIG_FISH_BANANA'
    | 'BIG_FISH_DONUT'
    | 'BIG_FISH_BOX'
    | 'THE_JOUST_OWNER'
    | 'THE_JOUST_MURDERER'
    | 'THE_JOUST_LEAVE'
    | 'SCRAP_OOZE_SEARCH'
    | 'SCRAP_OOZE_LEAVE'
    | 'LIVING_WALL_FORGET'
    | 'LIVING_WALL_CHANGE'
    | 'LIVING_WALL_GROW'
    | 'THE_SSSSERPENT_AGREE'
    | 'THE_SSSSERPENT_IGNORE'
    | 'FORGOTTEN_ALTAR_BLOOD'
    | 'FORGOTTEN_ALTAR_DESECRATE'
    | 'FORGOTTEN_ALTAR_LEAVE'
    | 'THE_MAUSOLEUM_OPEN'
    | 'THE_MAUSOLEUM_LEAVE'
    | 'BEGGAR_GIVE'
    | 'BEGGAR_LEAVE'

export interface EventChoiceDef {
    id: EventChoiceId
    label: string
    description?: string
    disabled?: (run: RunState) => boolean
    requiresSelection?: 'remove' | 'upgrade' | 'transform'
}

export interface EventDef {
    id: EventId
    title: string
    body: string
    note?: string
    choices: EventChoiceDef[]
}

export interface EventResolution {
    removedCardInstanceId?: string
    upgradedCardInstanceId?: string
    transformedFromInstanceId?: string
    transformedCard?: CardInstance
    grantedRelicId?: RelicId
    notes?: string[]
}

const ACT_ONE_EVENT_POOL: EventId[] = [
    'WORLD_OF_GOOP',
    'CLERIC',
    'UPGRADE_SHRINE',
    'GOLDEN_IDOL',
    'BIG_FISH',
    'THE_JOUST',
    'SCRAP_OOZE',
    'LIVING_WALL',
    'THE_SSSSERPENT',
]

const ACT_TWO_EVENT_POOL: EventId[] = [
    'CLERIC',
    'UPGRADE_SHRINE',
    'FORGOTTEN_ALTAR',
    'THE_MAUSOLEUM',
    'BEGGAR',
]

export const EVENT_DEFS: Record<EventId, EventDef> = {
    WORLD_OF_GOOP: {
        id: 'WORLD_OF_GOOP',
        title: 'World of Goop',
        body: 'Sticky gold bubbles up from the floor.',
        choices: [
            { id: 'WORLD_OF_GOOP_REACH', label: 'Reach in', description: 'Lose 11 HP. Gain 75 gold.' },
            { id: 'WORLD_OF_GOOP_LEAVE', label: 'Leave' },
        ],
    },
    CLERIC: {
        id: 'CLERIC',
        title: 'Cleric',
        body: 'A hooded cleric offers services for a price.',
        choices: [
            { id: 'CLERIC_HEAL', label: 'Heal', description: 'Pay 35 gold. Heal 25% max HP.', disabled: run => run.gold < 35 },
            { id: 'CLERIC_PURGE', label: 'Purge', description: 'Pay 50 gold. Remove 1 card from your deck.', disabled: run => run.gold < 50 || run.deck.length === 0, requiresSelection: 'remove' },
            { id: 'CLERIC_LEAVE', label: 'Leave' },
        ],
    },
    UPGRADE_SHRINE: {
        id: 'UPGRADE_SHRINE',
        title: 'Upgrade Shrine',
        body: 'A quiet shrine hums with focused energy.',
        choices: [
            { id: 'UPGRADE_SHRINE_UPGRADE', label: 'Upgrade', description: 'Upgrade 1 card.', disabled: run => !run.deck.some(card => canUpgradeCard(card)), requiresSelection: 'upgrade' },
            { id: 'UPGRADE_SHRINE_MAX_HP', label: 'Embrace', description: 'Gain 15 max HP.' },
        ],
    },
    GOLDEN_IDOL: {
        id: 'GOLDEN_IDOL',
        title: 'Golden Idol',
        body: 'A small idol gleams in the dark, heavy with promise.',
        note: 'Taking the idol adds Injury to your deck.',
        choices: [
            { id: 'GOLDEN_IDOL_TAKE', label: 'Take Idol', description: 'Gain 100 gold. Obtain Injury.' },
            { id: 'GOLDEN_IDOL_LEAVE', label: 'Leave' },
        ],
    },
    BIG_FISH: {
        id: 'BIG_FISH',
        title: 'Big Fish',
        body: 'A grinning fish offers a simple meal, a rich dessert, or a sealed box.',
        note: 'The box trades deck quality for a relic.',
        choices: [
            { id: 'BIG_FISH_BANANA', label: 'Banana', description: 'Heal 33% of max HP.' },
            { id: 'BIG_FISH_DONUT', label: 'Donut', description: 'Gain 5 max HP.' },
            { id: 'BIG_FISH_BOX', label: 'Box', description: 'Obtain a random common relic. Obtain Regret.' },
        ],
    },
    THE_JOUST: {
        id: 'THE_JOUST',
        title: 'The Joust',
        body: 'Two arguments circle the room. One is about truth. The other is about your gold.',
        note: 'The wager is deterministic from this node seed.',
        choices: [
            { id: 'THE_JOUST_OWNER', label: 'Bet on Owner', description: 'Pay 50 gold. Seeded 30% chance to win 100 gold.', disabled: run => run.gold < 50 },
            { id: 'THE_JOUST_MURDERER', label: 'Bet on Murderer', description: 'Pay 50 gold. Seeded 70% chance to win 100 gold.', disabled: run => run.gold < 50 },
            { id: 'THE_JOUST_LEAVE', label: 'Leave' },
        ],
    },
    SCRAP_OOZE: {
        id: 'SCRAP_OOZE',
        title: 'Scrap Ooze',
        body: 'The ooze shifts around a buried shape, as if waiting for you to commit.',
        choices: [
            { id: 'SCRAP_OOZE_SEARCH', label: 'Search', description: 'Lose 5 HP. Obtain a random common relic.' },
            { id: 'SCRAP_OOZE_LEAVE', label: 'Leave' },
        ],
    },
    LIVING_WALL: {
        id: 'LIVING_WALL',
        title: 'Living Wall',
        body: 'Faces in the stone offer to alter your deck in one precise way.',
        choices: [
            { id: 'LIVING_WALL_FORGET', label: 'Forget', description: 'Remove 1 card.', requiresSelection: 'remove' },
            { id: 'LIVING_WALL_CHANGE', label: 'Change', description: 'Transform 1 card.', requiresSelection: 'transform' },
            { id: 'LIVING_WALL_GROW', label: 'Grow', description: 'Upgrade 1 card.', requiresSelection: 'upgrade' },
        ],
    },
    THE_SSSSERPENT: {
        id: 'THE_SSSSERPENT',
        title: 'The Ssserpent',
        body: 'A merchant with too many teeth offers instant wealth on terms you will regret later.',
        note: 'Omamori can block the curse if it still has charges.',
        choices: [
            { id: 'THE_SSSSERPENT_AGREE', label: 'Agree', description: 'Gain 175 gold. Obtain Regret.' },
            { id: 'THE_SSSSERPENT_IGNORE', label: 'Ignore' },
        ],
    },
    FORGOTTEN_ALTAR: {
        id: 'FORGOTTEN_ALTAR',
        title: 'Forgotten Altar',
        body: 'The altar demands either blood or reverence.',
        choices: [
            { id: 'FORGOTTEN_ALTAR_BLOOD', label: 'Offer Blood', description: 'Lose 7 HP. Remove 1 card.', disabled: run => run.deck.length === 0, requiresSelection: 'remove' },
            { id: 'FORGOTTEN_ALTAR_DESECRATE', label: 'Desecrate', description: 'Gain 5 max HP.' },
            { id: 'FORGOTTEN_ALTAR_LEAVE', label: 'Leave' },
        ],
    },
    THE_MAUSOLEUM: {
        id: 'THE_MAUSOLEUM',
        title: 'The Mausoleum',
        body: 'An open coffin promises value if you are willing to risk what comes attached.',
        note: 'Open Coffin has a seeded 50% chance to add Parasite.',
        choices: [
            { id: 'THE_MAUSOLEUM_OPEN', label: 'Open Coffin', description: 'Obtain a random common relic. 50% seeded chance to obtain Parasite.' },
            { id: 'THE_MAUSOLEUM_LEAVE', label: 'Leave' },
        ],
    },
    BEGGAR: {
        id: 'BEGGAR',
        title: 'Beggar',
        body: 'A beggar offers to take your gold and one burden from your deck.',
        choices: [
            { id: 'BEGGAR_GIVE', label: 'Give 75 Gold', description: 'Pay 75 gold. Remove 1 card.', disabled: run => run.gold < 75 || run.deck.length === 0, requiresSelection: 'remove' },
            { id: 'BEGGAR_LEAVE', label: 'Leave' },
        ],
    },
}

export function getEventPool(act: 1 | 2): EventId[] {
    return act === 1 ? ACT_ONE_EVENT_POOL : ACT_TWO_EVENT_POOL
}

export function generateEvent(act: 1 | 2, seed: string): EventId {
    const rng = new RNG(seed)
    const pool = getEventPool(act)
    return pool[rng.int(0, pool.length - 1)]
}

function drawCommonRelic(run: RunState, meta: MetaState, seed: string): RelicId {
    const rng = new RNG(`${seed}-relic`)
    const commonPool = getUnlockedRelicPool(meta, 'common')
    const available = commonPool.filter(id => !run.relics.includes(id))
    const pool = available.length > 0 ? available : commonPool
    return pool[rng.int(0, pool.length - 1)]
}

export function transformCard(run: RunState, meta: MetaState, instanceId: string, seed: string): CardInstance | undefined {
    const existing = run.deck.find(card => card.instanceId === instanceId)
    if (!existing) return undefined
    const rarity = CARD_DEFS[existing.defId]?.rarity
    const collectible = getUnlockedCollectibleCards(meta)
    const sameRarity = getUnlockedCollectibleCards(meta, rarity).filter(cardId => cardId !== existing.defId)
    const pool = sameRarity.length > 0 ? sameRarity : collectible.filter(cardId => cardId !== existing.defId)
    if (pool.length === 0) return undefined
    const rng = new RNG(`${seed}-transform`)
    const replacement = pool[rng.int(0, pool.length - 1)]
    const index = run.deck.findIndex(card => card.instanceId === instanceId)
    if (index < 0) return undefined
    const transformed = createCardInstance(replacement)
    run.deck[index] = transformed
    return transformed
}

export function resolveEventChoice(
    run: RunState,
    meta: MetaState,
    eventId: EventId,
    choiceId: EventChoiceId,
    seed: string,
    selection?: { cardInstanceId?: string },
): EventResolution {
    const rng = new RNG(seed)
    const notes: string[] = []
    run.eventHistory ??= {}
    run.eventHistory[eventId] = true

    if (choiceId === 'WORLD_OF_GOOP_REACH') {
        run.player.hp = Math.max(1, run.player.hp - 11)
        run.gold += 75
        notes.push('Lost 11 HP.', 'Gained 75 gold.')
        return { notes }
    }
    if (choiceId === 'CLERIC_HEAL' && run.gold >= 35) {
        run.gold -= 35
        run.player.hp = Math.min(run.player.maxHp, run.player.hp + Math.round(run.player.maxHp * 0.25))
        notes.push('Paid 35 gold.', 'Recovered health.')
        return { notes }
    }
    if (choiceId === 'CLERIC_PURGE' && run.gold >= 50 && selection?.cardInstanceId) {
        run.gold -= 50
        removeCardByInstanceId(run, selection.cardInstanceId)
        notes.push('Paid 50 gold.', 'Removed a card.')
        return { removedCardInstanceId: selection.cardInstanceId, notes }
    }
    if (choiceId === 'UPGRADE_SHRINE_UPGRADE' && selection?.cardInstanceId) {
        const card = run.deck.find(entry => entry.instanceId === selection.cardInstanceId)
        if (card && canUpgradeCard(card)) {
            card.upgradeLevel = card.defId === 'SEARING_BLOW' ? card.upgradeLevel + 1 : 1
            notes.push('Upgraded a card.')
        }
        return { upgradedCardInstanceId: selection.cardInstanceId, notes }
    }
    if (choiceId === 'UPGRADE_SHRINE_MAX_HP') {
        run.player.maxHp += 15
        run.player.hp += 15
        notes.push('Gained 15 max HP.')
        return { notes }
    }
    if (choiceId === 'GOLDEN_IDOL_TAKE') {
        run.gold += 100
        obtainCurse(run, 'INJURY')
        notes.push('Gained 100 gold.', 'Obtained Injury.')
        return { notes }
    }
    if (choiceId === 'BIG_FISH_BANANA') {
        run.player.hp = Math.min(run.player.maxHp, run.player.hp + Math.round(run.player.maxHp * 0.33))
        notes.push('Recovered health.')
        return { notes }
    }
    if (choiceId === 'BIG_FISH_DONUT') {
        run.player.maxHp += 5
        run.player.hp += 5
        notes.push('Gained 5 max HP.')
        return { notes }
    }
    if (choiceId === 'BIG_FISH_BOX') {
        const relicId = drawCommonRelic(run, meta, seed)
        applyRelicAcquisition(run, relicId)
        obtainCurse(run, 'REGRET')
        notes.push(`Obtained ${relicId}.`, 'Obtained Regret.')
        return { grantedRelicId: relicId, notes }
    }
    if (choiceId === 'THE_JOUST_OWNER' || choiceId === 'THE_JOUST_MURDERER') {
        if (run.gold < 50) return { notes }
        run.gold -= 50
        const won = rng.random() < (choiceId === 'THE_JOUST_MURDERER' ? 0.7 : 0.3)
        if (won) {
            run.gold += 100
            notes.push('Your bet paid out. Gained 100 gold.')
        } else {
            notes.push('The bet failed. Gained nothing.')
        }
        return { notes }
    }
    if (choiceId === 'SCRAP_OOZE_SEARCH') {
        run.player.hp = Math.max(1, run.player.hp - 5)
        const relicId = drawCommonRelic(run, meta, seed)
        applyRelicAcquisition(run, relicId)
        notes.push('Lost 5 HP.', `Obtained ${relicId}.`)
        return { grantedRelicId: relicId, notes }
    }
    if (choiceId === 'LIVING_WALL_FORGET' && selection?.cardInstanceId) {
        removeCardByInstanceId(run, selection.cardInstanceId)
        notes.push('Removed a card.')
        return { removedCardInstanceId: selection.cardInstanceId, notes }
    }
    if (choiceId === 'LIVING_WALL_CHANGE' && selection?.cardInstanceId) {
        const transformed = transformCard(run, meta, selection.cardInstanceId, seed)
        if (transformed) notes.push(`Transformed into ${transformed.defId}.`)
        return { transformedFromInstanceId: selection.cardInstanceId, transformedCard: transformed, notes }
    }
    if (choiceId === 'LIVING_WALL_GROW' && selection?.cardInstanceId) {
        const card = run.deck.find(entry => entry.instanceId === selection.cardInstanceId)
        if (card && canUpgradeCard(card)) {
            card.upgradeLevel = card.defId === 'SEARING_BLOW' ? card.upgradeLevel + 1 : 1
            notes.push('Upgraded a card.')
        }
        return { upgradedCardInstanceId: selection.cardInstanceId, notes }
    }
    if (choiceId === 'THE_SSSSERPENT_AGREE') {
        run.gold += 175
        obtainCurse(run, 'REGRET')
        notes.push('Gained 175 gold.', 'Regret was offered to your deck.')
        return { notes }
    }
    if (choiceId === 'FORGOTTEN_ALTAR_BLOOD' && selection?.cardInstanceId) {
        run.player.hp = Math.max(1, run.player.hp - 7)
        removeCardByInstanceId(run, selection.cardInstanceId)
        notes.push('Lost 7 HP.', 'Removed a card.')
        return { removedCardInstanceId: selection.cardInstanceId, notes }
    }
    if (choiceId === 'FORGOTTEN_ALTAR_DESECRATE') {
        run.player.maxHp += 5
        run.player.hp += 5
        notes.push('Gained 5 max HP.')
        return { notes }
    }
    if (choiceId === 'THE_MAUSOLEUM_OPEN') {
        const relicId = drawCommonRelic(run, meta, seed)
        applyRelicAcquisition(run, relicId)
        notes.push(`Obtained ${relicId}.`)
        if (rng.random() < 0.5) {
            obtainCurse(run, 'PARASITE')
            notes.push('Parasite tried to attach itself.')
        } else {
            notes.push('No curse followed.')
        }
        return { grantedRelicId: relicId, notes }
    }
    if (choiceId === 'BEGGAR_GIVE' && selection?.cardInstanceId && run.gold >= 75) {
        run.gold -= 75
        removeCardByInstanceId(run, selection.cardInstanceId)
        notes.push('Paid 75 gold.', 'Removed a card.')
        return { removedCardInstanceId: selection.cardInstanceId, notes }
    }
    return { notes }
}
