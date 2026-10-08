import type { EventCheckpoint, EventCombat } from './events/model'
import type { Act } from './acts'
import { RNG } from './rng'
import { CARD_DEFS, createCardInstance, createStarterDeck } from './cards'
import { clampAscension as clampAscensionLevel, getAscensionStartingMaxHp } from './ascension'
import { tryPreventCurse } from './relics'
import type { CardInstance } from './state'
import type { PotionId } from './potions'
import type { UnknownWeights } from './map'
import type { PendingRoom } from './progression'

export type RelicId =
    | 'MANGO' | 'OLD_COIN' | 'THREAD_AND_NEEDLE'
    | 'CIRCLET' | 'MEMBERSHIP_CARD' | 'SMILING_MASK' | 'COURIER' | 'ORRERY'
    | 'GOLDEN_IDOL' | 'BLOODY_IDOL' | 'MARK_OF_THE_BLOOM' | 'RED_MASK' | 'NEOWS_LAMENT'
    | 'BURNING_BLOOD'
    | 'BLACK_BLOOD'
    | 'SOZU'
    | 'BUSTED_CROWN'
    | 'COFFEE_DRIPPER'
    | 'MARK_OF_PAIN'
    | 'PHILOSOPHERS_STONE'
    | 'ANCHOR'
    | 'LANTERN'
    | 'VAJRA'
    | 'BAG_OF_PREPARATION'
    | 'BRONZE_SCALES'
    | 'STRAWBERRY'
    | 'PRESERVED_INSECT'
    | 'OMAMORI'
    | 'AKABEKO'
    | 'ORICHALCUM'
    | 'CENTENNIAL_PUZZLE'
    | 'BAG_OF_MARBLES'
    | 'HORN_CLEAT'
    | 'HAPPY_FLOWER'
    | 'PAPER_FROG'
    | 'MERCURY_HOURGLASS'
    | 'CHARONS_ASHES'

export interface RelicStateEntry {
    charges?: number
    counter?: number
}

export interface RunState {
    runId?: string
    rareCardOffset?: number
    potionChance?: number
    elapsedSeconds?: number
    keys: { ruby: boolean; emerald: boolean; sapphire: boolean }
    burningEliteActive?: boolean
    secondBoss?: boolean
    hallwayCount?: number
    mapRows?: number
    seed: string
    act: Act
    floor: number
    gold: number
    player: { maxHp: number; hp: number }
    relics: RelicId[]
    potions: PotionId[]
    maxPotionSlots: number
    merchantRemoveCost: number
    deck: CardInstance[]
    neowFull?: boolean
    neowCompleted: boolean
    neowSeed: string
    neowChoiceId?: string
    bossRelicChoicePending?: { sourceBossId: string; choices: RelicId[] }
    cardsSeen?: number
    actsCleared?: number[]
    cursesObtained?: number
    cardsRemoved?: number
    relicState?: Partial<Record<RelicId, RelicStateEntry>>
    eventState?: EventCheckpoint
    eventCombat?: EventCombat
    eventHistory?: Partial<Record<string, boolean>>
    runFlags?: Record<string, boolean>
    asc: number
    mapProgress?: { currentNodeId?: string }
    unknownWeights?: UnknownWeights
    rewardReturnRoom?: PendingRoom
    pendingRoom?: PendingRoom
    combatCount?: number
}

export function createNewRun(seed?: string, asc = 0, previousRunReachedBoss = false): RunState {
    const s = seed ?? Math.random().toString(36).slice(2)
    const rng = new RNG(s)
    const deck: CardInstance[] = createStarterDeck()
    rng.shuffleInPlace(deck)
    const normalizedAsc = clampAscensionLevel(asc)
    const startingMaxHp = getAscensionStartingMaxHp(normalizedAsc, 80)
    if (normalizedAsc >= 10) deck.push(createCardInstance('ASCENDERS_BANE'))
    return {
        runId: crypto.randomUUID(),
        elapsedSeconds: 0,
        keys: { ruby: false, emerald: false, sapphire: false },
        hallwayCount: 0,
        mapRows: 16,
        seed: s,
        act: 1,
        floor: 1,
        gold: 99,
        player: { maxHp: startingMaxHp, hp: normalizedAsc >= 6 ? Math.round(startingMaxHp * 0.9) : startingMaxHp },
        relics: ['BURNING_BLOOD'],
        potions: [],
        maxPotionSlots: normalizedAsc >= 11 ? 2 : 3,
        merchantRemoveCost: 75,
        deck,
        neowFull: seed !== undefined || previousRunReachedBoss,
        neowCompleted: false,
        neowSeed: `${s}-neow`,
        neowChoiceId: undefined,
        mapProgress: {},
        combatCount: 0,
        cardsSeen: 0,
        actsCleared: [],
        cursesObtained: 0,
        cardsRemoved: 0,
        relicState: {},
        eventHistory: {},
        runFlags: {},
        asc: normalizedAsc,
    }
}

const STORAGE_KEY = 'sts_run_v7'

export function obtainCard(run: RunState, defId: string, destination: 'deck' = 'deck', upgradeLevel = 0): CardInstance {
    const card = createCardInstance(defId, upgradeLevel)
    if (destination === 'deck') run.deck.push(card)
    return card
}

export function obtainCurse(run: RunState, curseId: string): CardInstance {
    if (tryPreventCurse(run, curseId)) {
        return createCardInstance(curseId)
    }
    const card = obtainCard(run, curseId)
    run.cursesObtained = (run.cursesObtained ?? 0) + 1
    return card
}

export function removeCardByInstanceId(run: RunState, instanceId: string): CardInstance | undefined {
    const index = run.deck.findIndex(card => card.instanceId === instanceId)
    if (index < 0 || run.deck[index].defId === 'ASCENDERS_BANE') return undefined
    const [removed] = run.deck.splice(index, 1)
    run.cardsRemoved = (run.cardsRemoved ?? 0) + 1
    if (removed.defId === 'PARASITE') {
        run.player.maxHp = Math.max(1, run.player.maxHp - 3)
        run.player.hp = Math.min(run.player.hp, run.player.maxHp)
    }
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
        const parsed: unknown = JSON.parse(s)
        if (!parsed || typeof parsed !== 'object') return undefined
        const run = parsed as RunState
        if (typeof run.seed !== 'string' || ![1, 2, 3, 4].includes(run.act) || !Number.isFinite(run.gold)
            || !run.player || !Number.isFinite(run.player.hp) || !Number.isFinite(run.player.maxHp)
            || !Array.isArray(run.deck) || run.deck.some(card => !card || !CARD_DEFS[card.defId] || typeof card.instanceId !== 'string')
            || !Array.isArray(run.relics) || !Array.isArray(run.potions)) return undefined
        run.keys ??= { ruby: false, emerald: false, sapphire: false }
        run.mapRows ??= 15
        run.asc = clampAscensionLevel(run.asc)
        run.hallwayCount ??= run.combatCount ?? 0
        return run
    } catch {
        return undefined
    }
}

export function clearSavedRun(): void {
    localStorage.removeItem(STORAGE_KEY)
}
