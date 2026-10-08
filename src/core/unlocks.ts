import { CARD_DEFS } from './cards'
import type { CharacterId } from './characters'
import { RELIC_DEFS } from './relics'
import type { RelicId } from './run'

export interface UnlockBundle { tier: number; label: string; cards: string[]; relics: RelicId[] }
const cards = (tier: number, ...ids: string[]): UnlockBundle => ({ tier, label: `Card unlock ${tier}`, cards: ids, relics: [] })
const relics = (tier: number, ...ids: RelicId[]): UnlockBundle => ({ tier, label: `Relic unlock ${tier}`, cards: [], relics: ids })
export const UNLOCK_XP = [300, 750, 1000, 1500, 2000] as const
export const UNLOCK_TRACKS: Record<CharacterId, UnlockBundle[]> = {
    ironclad: [cards(1, 'HEAVY_BLADE', 'SPOT_WEAKNESS', 'LIMIT_BREAK'), relics(2, 'OMAMORI', 'PRAYER_WHEEL', 'SHOVEL'), cards(3, 'WILD_STRIKE', 'EVOLVE', 'IMMOLATE'), cards(4, 'HAVOC', 'SENTINEL', 'EXHUME'), relics(5, 'BLUE_CANDLE', 'DEAD_BRANCH', 'SINGING_BOWL')],
    silent: [cards(1, 'BANE', 'CATALYST', 'CORPSE_EXPLOSION'), relics(2, 'DU_VU_DOLL', 'SMILING_MASK', 'TINY_CHEST'), cards(3, 'CLOAK_AND_DAGGER', 'ACCURACY', 'STORM_OF_STEEL'), relics(4, 'ART_OF_WAR', 'COURIER', 'PANDORAS_BOX'), cards(5, 'CONCENTRATE', 'SETUP', 'GRAND_FINALE')],
    defect: [cards(1, 'REBOUND', 'EQUILIBRIUM', 'ECHO_FORM'), cards(2, 'TURBO', 'SUNDER', 'METEOR_STRIKE'), cards(3, 'HYPERBEAM', 'RECYCLE', 'CORE_SURGE'), relics(4, 'GOLD_PLATED_CABLES', 'TURNIP', 'RUNIC_CAPACITOR'), relics(5, 'EMOTION_CHIP', 'SYMBIOTIC_VIRUS', 'DATA_DISK')],
    watcher: [cards(1, 'PROSTRATE', 'BLASPHEMY', 'DEVOTION'), cards(2, 'FOREIGN_INFLUENCE', 'ALPHA', 'MENTAL_FORTRESS'), cards(3, 'SPIRIT_SHIELD', 'WISH', 'FORESIGHT'), relics(4, 'AKABEKO', 'DUALITY', 'CERAMIC_FISH'), relics(5, 'STRIKE_DUMMY', 'TEARDROP_LOCKET', 'CLOAK_CLASP')],
}
export const IRONCLAD_UNLOCK_TRACK = UNLOCK_TRACKS.ironclad
export function getBaseUnlockedCardIds(): string[] {
    return Object.keys(CARD_DEFS)
}
export function getBaseUnlockedRelicIds(): RelicId[] {
    const locked = new Set(Object.values(UNLOCK_TRACKS).flatMap(track => track.flatMap(bundle => bundle.relics)))
    return (Object.keys(RELIC_DEFS) as RelicId[]).filter(id => !locked.has(id))
}
