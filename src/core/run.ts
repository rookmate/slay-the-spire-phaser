import { RNG } from './rng'
import type { CardInstance } from './state'
import type { PotionId } from './potions'

export type RelicId =
    | 'BURNING_BLOOD'
    | 'ANCHOR'
    | 'LANTERN'
    | 'VAJRA'
    | 'BAG_OF_PREPARATION'
    | 'BRONZE_SCALES'
    | 'STRAWBERRY'
    | 'PRESERVED_INSECT'

export interface RunState {
    seed: string
    floor: number
    gold: number
    player: { maxHp: number; hp: number }
    relics: RelicId[]
    potions: PotionId[]
    maxPotionSlots: number
    merchantRemoveCost: number
    deck: CardInstance[]
    asc?: number
    mapProgress?: { act: number; currentNodeId?: string }
    combatCount?: number
}

export function createNewRun(seed?: string): RunState {
    const s = seed ?? Math.random().toString(36).slice(2)
    const rng = new RNG(s)
    // Starter deck similar to Ironclad-ish
    const deck: CardInstance[] = []
    for (let i = 0; i < 5; i++) deck.push({ defId: 'STRIKE', upgraded: false })
    for (let i = 0; i < 4; i++) deck.push({ defId: 'DEFEND', upgraded: false })
    deck.push({ defId: 'BASH', upgraded: false })
    rng.shuffleInPlace(deck)
    return {
        seed: s,
        floor: 1,
        gold: 99,
        player: { maxHp: 80, hp: 80 },
        relics: ['BURNING_BLOOD'],
        potions: [],
        maxPotionSlots: 3,
        merchantRemoveCost: 75,
        deck,
        mapProgress: { act: 1 },
        combatCount: 0,
    }
}

const STORAGE_KEY = 'sts_run_v1'

export function saveRun(run: RunState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(run))
}

export function loadRun(): RunState | undefined {
    const s = localStorage.getItem(STORAGE_KEY)
    if (!s) return undefined
    try {
        const parsed = JSON.parse(s) as Partial<RunState>
        return {
            seed: parsed.seed ?? 'seedless',
            floor: parsed.floor ?? 1,
            gold: parsed.gold ?? 99,
            player: parsed.player ?? { maxHp: 80, hp: 80 },
            relics: parsed.relics ?? ['BURNING_BLOOD'],
            potions: parsed.potions ?? [],
            maxPotionSlots: parsed.maxPotionSlots ?? 3,
            merchantRemoveCost: parsed.merchantRemoveCost ?? 75,
            deck: parsed.deck ?? [],
            asc: parsed.asc,
            mapProgress: parsed.mapProgress ?? { act: 1 },
            combatCount: parsed.combatCount ?? 0,
        }
    } catch {
        return undefined
    }
}

export function clearSavedRun(): void {
    localStorage.removeItem(STORAGE_KEY)
}

