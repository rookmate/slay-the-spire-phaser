import { RNG } from './rng'
import { CARD_DEFS, createCardInstance, createStarterDeck } from './cards'
import type { CardInstance } from './state'
import type { PotionId } from './potions'

export type RelicId =
    | 'BURNING_BLOOD'
    | 'BLACK_BLOOD'
    | 'SOZU'
    | 'BUSTED_CROWN'
    | 'ANCHOR'
    | 'LANTERN'
    | 'VAJRA'
    | 'BAG_OF_PREPARATION'
    | 'BRONZE_SCALES'
    | 'STRAWBERRY'
    | 'PRESERVED_INSECT'

export interface RunState {
    seed: string
    act: 1 | 2
    floor: number
    gold: number
    player: { maxHp: number; hp: number }
    relics: RelicId[]
    potions: PotionId[]
    maxPotionSlots: number
    merchantRemoveCost: number
    deck: CardInstance[]
    neowCompleted: boolean
    neowSeed: string
    neowChoiceId?: string
    bossRelicChoicePending?: { sourceBossId: string; choices: RelicId[] }
    cardsSeen?: number
    actsCleared?: number[]
    cursesObtained?: number
    cardsRemoved?: number
    runFlags?: Record<string, boolean>
    asc?: number
    mapProgress?: { currentNodeId?: string }
    combatCount?: number
}

export function createNewRun(seed?: string): RunState {
    const s = seed ?? Math.random().toString(36).slice(2)
    const rng = new RNG(s)
    const deck: CardInstance[] = createStarterDeck()
    rng.shuffleInPlace(deck)
    return {
        seed: s,
        act: 1,
        floor: 1,
        gold: 99,
        player: { maxHp: 80, hp: 80 },
        relics: ['BURNING_BLOOD'],
        potions: [],
        maxPotionSlots: 3,
        merchantRemoveCost: 75,
        deck,
        neowCompleted: false,
        neowSeed: `${s}-neow`,
        neowChoiceId: undefined,
        mapProgress: {},
        combatCount: 0,
        cardsSeen: 0,
        actsCleared: [],
        cursesObtained: 0,
        cardsRemoved: 0,
        runFlags: {},
    }
}

const STORAGE_KEY = 'sts_run_v4'

export function obtainCard(run: RunState, defId: string, destination: 'deck' = 'deck', upgradeLevel = 0): CardInstance {
    const card = createCardInstance(defId, upgradeLevel)
    if (destination === 'deck') run.deck.push(card)
    return card
}

export function obtainCurse(run: RunState, curseId: string): CardInstance {
    const card = obtainCard(run, curseId)
    run.cursesObtained = (run.cursesObtained ?? 0) + 1
    if (curseId === 'PARASITE') {
        run.player.maxHp = Math.max(1, run.player.maxHp - 3)
        run.player.hp = Math.min(run.player.hp, run.player.maxHp)
    }
    return card
}

export function removeCardByInstanceId(run: RunState, instanceId: string): CardInstance | undefined {
    const index = run.deck.findIndex(card => card.instanceId === instanceId)
    if (index < 0) return undefined
    const [removed] = run.deck.splice(index, 1)
    run.cardsRemoved = (run.cardsRemoved ?? 0) + 1
    return removed
}

export function getCurseCards(run: RunState): CardInstance[] {
    return run.deck.filter(card => CARD_DEFS[card.defId]?.type === 'curse')
}

export function saveRun(run: RunState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(run))
}

export function loadRun(): RunState | undefined {
    const s = localStorage.getItem(STORAGE_KEY)
    if (!s) return undefined
    try {
        return JSON.parse(s) as RunState
    } catch {
        return undefined
    }
}

export function clearSavedRun(): void {
    localStorage.removeItem(STORAGE_KEY)
}
