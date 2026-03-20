import { canUpgradeCard } from './cards'
import { MVP_RELIC_POOL, applyRelicAcquisition } from './relics'
import { RNG } from './rng'
import type { RelicId, RunState } from './run'
import { obtainCurse, removeCardByInstanceId } from './run'

export type EventId =
    | 'WORLD_OF_GOOP'
    | 'CLERIC'
    | 'UPGRADE_SHRINE'
    | 'GOLDEN_IDOL'
    | 'BIG_FISH'
    | 'THE_JOUST'

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

export interface EventChoiceDef {
    id: EventChoiceId
    label: string
    description?: string
    disabled?: (run: RunState) => boolean
    requiresSelection?: 'remove' | 'upgrade'
}

export interface EventDef {
    id: EventId
    title: string
    body: string
    choices: EventChoiceDef[]
}

export interface EventResolution {
    removedCardInstanceId?: string
    upgradedCardInstanceId?: string
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
        choices: [
            { id: 'GOLDEN_IDOL_TAKE', label: 'Take Idol', description: 'Gain 100 gold. Obtain Injury.' },
            { id: 'GOLDEN_IDOL_LEAVE', label: 'Leave' },
        ],
    },
    BIG_FISH: {
        id: 'BIG_FISH',
        title: 'Big Fish',
        body: 'A grinning fish offers a simple meal, a rich dessert, or a sealed box.',
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
        choices: [
            { id: 'THE_JOUST_OWNER', label: 'Bet on Owner', description: 'Pay 50 gold. Seeded 30% chance to win 100 gold.', disabled: run => run.gold < 50 },
            { id: 'THE_JOUST_MURDERER', label: 'Bet on Murderer', description: 'Pay 50 gold. Seeded 70% chance to win 100 gold.', disabled: run => run.gold < 50 },
            { id: 'THE_JOUST_LEAVE', label: 'Leave' },
        ],
    },
}

export function generateEvent(act: 1 | 2, seed: string): EventId {
    const rng = new RNG(seed)
    const pool: EventId[] = act === 1 ? ACT_ONE_EVENT_POOL : ['WORLD_OF_GOOP', 'CLERIC', 'UPGRADE_SHRINE']
    return pool[rng.int(0, pool.length - 1)]
}

export function resolveEventChoice(
    run: RunState,
    eventId: EventId,
    choiceId: EventChoiceId,
    seed: string,
    selection?: { cardInstanceId?: string },
): EventResolution {
    const rng = new RNG(seed)
    const notes: string[] = []

    if (eventId === 'WORLD_OF_GOOP') {
        if (choiceId === 'WORLD_OF_GOOP_REACH') {
            run.player.hp = Math.max(1, run.player.hp - 11)
            run.gold += 75
            notes.push('Lost 11 HP.', 'Gained 75 gold.')
        }
        return { notes }
    }

    if (eventId === 'CLERIC') {
        if (choiceId === 'CLERIC_HEAL' && run.gold >= 35) {
            run.gold -= 35
            run.player.hp = Math.min(run.player.maxHp, run.player.hp + Math.round(run.player.maxHp * 0.25))
            notes.push('Paid 35 gold.', 'Recovered health.')
        } else if (choiceId === 'CLERIC_PURGE' && run.gold >= 50 && selection?.cardInstanceId) {
            run.gold -= 50
            removeCardByInstanceId(run, selection.cardInstanceId)
            notes.push('Paid 50 gold.', 'Removed a card.')
            return { removedCardInstanceId: selection.cardInstanceId, notes }
        }
        return { notes }
    }

    if (eventId === 'UPGRADE_SHRINE') {
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
        }
        return { notes }
    }

    if (eventId === 'GOLDEN_IDOL') {
        if (choiceId === 'GOLDEN_IDOL_TAKE') {
            run.gold += 100
            obtainCurse(run, 'INJURY')
            notes.push('Gained 100 gold.', 'Obtained Injury.')
        }
        return { notes }
    }

    if (eventId === 'BIG_FISH') {
        if (choiceId === 'BIG_FISH_BANANA') {
            run.player.hp = Math.min(run.player.maxHp, run.player.hp + Math.round(run.player.maxHp * 0.33))
            notes.push('Recovered health.')
        } else if (choiceId === 'BIG_FISH_DONUT') {
            run.player.maxHp += 5
            run.player.hp += 5
            notes.push('Gained 5 max HP.')
        } else if (choiceId === 'BIG_FISH_BOX') {
            const pool = MVP_RELIC_POOL.filter(id => !run.relics.includes(id))
            const source = pool.length > 0 ? pool : MVP_RELIC_POOL
            const relicId = source[rng.int(0, source.length - 1)]
            applyRelicAcquisition(run, relicId)
            obtainCurse(run, 'REGRET')
            notes.push(`Obtained ${relicId}.`, 'Obtained Regret.')
            return { grantedRelicId: relicId, notes }
        }
        return { notes }
    }

    if (eventId === 'THE_JOUST') {
        const isBet = choiceId === 'THE_JOUST_OWNER' || choiceId === 'THE_JOUST_MURDERER'
        if (!isBet || run.gold < 50) return { notes }
        run.gold -= 50
        const winThreshold = choiceId === 'THE_JOUST_MURDERER' ? 0.7 : 0.3
        const won = rng.random() < winThreshold
        if (won) {
            run.gold += 100
            notes.push('Your bet paid out. Gained 100 gold.')
        } else {
            notes.push('The bet failed. Gained nothing.')
        }
        return { notes }
    }

    return { notes }
}
