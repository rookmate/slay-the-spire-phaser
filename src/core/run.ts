import { RNG } from './rng'
import type { CardInstance } from './state'

export type RelicId = 'BURNING_BLOOD'

export interface RunState {
    seed: string
    floor: number
    gold: number
    player: { maxHp: number; hp: number }
    relics: RelicId[]
    deck: CardInstance[]
    asc?: number
}

export function createNewRun(seed?: string): RunState {
    const s = seed ?? Math.random().toString(36).slice(2)
    const rng = new RNG(s)
    // Starter deck similar to Ironclad-ish
    const deck: CardInstance[] = []
    for (let i = 0; i < 5; i++) deck.push({ defId: 'STRIKE', upgraded: false })
    for (let i = 0; i < 5; i++) deck.push({ defId: 'DEFEND', upgraded: false })
    deck.push({ defId: 'BASH', upgraded: false })
    rng.shuffleInPlace(deck)
    return {
        seed: s,
        floor: 1,
        gold: 99,
        player: { maxHp: 80, hp: 80 },
        relics: ['BURNING_BLOOD'],
        deck,
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
        return JSON.parse(s) as RunState
    } catch {
        return undefined
    }
}

export function clearSavedRun(): void {
    localStorage.removeItem(STORAGE_KEY)
}


