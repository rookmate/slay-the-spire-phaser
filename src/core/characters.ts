import type { RelicId } from './run'

export type CharacterId = 'ironclad' | 'silent' | 'defect' | 'watcher'
export type RunMode = 'standard' | 'seeded' | 'daily' | 'custom'
export interface CharacterDef {
    id: CharacterId
    name: string
    maxHp: number
    starterRelic: RelicId
    starterDeck: readonly [string, number][]
    color: number
    description: string
}
export const CHARACTERS: Record<CharacterId, CharacterDef> = {
    ironclad: { id: 'ironclad', name: 'Ironclad', maxHp: 80, starterRelic: 'BURNING_BLOOD', color: 0xb95043,
        starterDeck: [['STRIKE', 5], ['DEFEND', 4], ['BASH', 1]], description: 'Strength, sacrifice, and cards that burn away.' },
    silent: { id: 'silent', name: 'Silent', maxHp: 70, starterRelic: 'RING_OF_THE_SNAKE', color: 0x7d9e59,
        starterDeck: [['STRIKE_SILENT', 5], ['DEFEND_SILENT', 5], ['NEUTRALIZE', 1], ['SURVIVOR', 1]], description: 'Poison, swift blades, and careful discards.' },
    defect: { id: 'defect', name: 'Defect', maxHp: 75, starterRelic: 'CRACKED_CORE', color: 0x649ba4,
        starterDeck: [['STRIKE_DEFECT', 4], ['DEFEND_DEFECT', 4], ['ZAP', 1], ['DUALCAST', 1]], description: 'Channel orbs, then evoke them at the right moment.' },
    watcher: { id: 'watcher', name: 'Watcher', maxHp: 72, starterRelic: 'PURE_WATER', color: 0xa58abb,
        starterDeck: [['STRIKE_WATCHER', 4], ['DEFEND_WATCHER', 4], ['ERUPTION', 1], ['VIGILANCE', 1]], description: 'Move between Calm and Wrath. Build toward Divinity.' },
}
export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[]
