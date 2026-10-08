import type { RoomKind } from './map'
import type { EncounterTier } from './rewards'

export const MAX_ASCENSION = 20
export function clampAscension(level: number): number {
    return Number.isFinite(level) ? Math.max(0, Math.min(MAX_ASCENSION, Math.floor(level))) : 0
}
// Enemy HP, damage, and move changes live in each enemy's specification.
export function getAscensionStartingMaxHp(asc: number, baseMaxHp: number): number {
    return asc >= 14 ? baseMaxHp - (baseMaxHp === 80 ? 5 : 4) : baseMaxHp
}
export function getAscensionShopPriceMultiplier(asc: number): number { return asc >= 16 ? 1.1 : 1 }
export function getAscensionMerchantRemoveBaseCost(_asc: number): number { return 75 }
export function getAscensionRestHealFraction(_asc: number): number { return 0.3 }
export function getAscensionLabel(asc: number): string { return `A${clampAscension(asc)}` }
export function affectsRoomTier(kind: RoomKind): EncounterTier {
    return kind === 'elite' || kind === 'boss' ? kind : 'hallway'
}
