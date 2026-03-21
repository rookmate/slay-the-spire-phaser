import type { RelicId } from './run'
import { getBaseUnlockedCardIds as getBaseUnlockedCardIdsFromTrack, getBaseUnlockedRelicIds as getBaseUnlockedRelicIdsFromTrack, IRONCLAD_UNLOCK_TRACK, type UnlockBundle } from './unlocks'

export interface MetaState {
    bestAscensionUnlocked: number
    totalWins: number
    totalRuns: number
    ironcladUnlockTier: number
    unlockedCardIds: string[]
    unlockedRelicIds: RelicId[]
}

const MAX_ASCENSION = 10

const META_KEY = 'sts_meta_v2'

function createDefaultMeta(): MetaState {
    return {
        bestAscensionUnlocked: 0,
        totalWins: 0,
        totalRuns: 0,
        ironcladUnlockTier: 0,
        unlockedCardIds: [],
        unlockedRelicIds: [],
    }
}

export function loadMeta(): MetaState {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return createDefaultMeta()
    try {
        const parsed = JSON.parse(raw) as Partial<MetaState>
        return {
            ...createDefaultMeta(),
            ...parsed,
            ironcladUnlockTier: Math.max(0, Math.min(IRONCLAD_UNLOCK_TRACK.length, Math.floor(parsed.ironcladUnlockTier ?? 0))),
            unlockedCardIds: parsed.unlockedCardIds ?? [],
            unlockedRelicIds: parsed.unlockedRelicIds ?? [],
        }
    } catch {
        return createDefaultMeta()
    }
}

export function saveMeta(meta: MetaState): void {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
}

export function clampAscension(level: number): number {
    return Math.max(0, Math.min(MAX_ASCENSION, Math.floor(level)))
}

export function getSelectableAscensions(meta: MetaState): number[] {
    const max = clampAscension(meta.bestAscensionUnlocked)
    return Array.from({ length: max + 1 }, (_, index) => index)
}

export function unlockNextAscension(meta: MetaState, clearedAscension: number): boolean {
    const cleared = clampAscension(clearedAscension)
    const current = clampAscension(meta.bestAscensionUnlocked)
    if (cleared !== current || current >= MAX_ASCENSION) return false
    meta.bestAscensionUnlocked = current + 1
    return true
}

export function getEffectiveUnlockedCardIds(meta: MetaState): Set<string> {
    return new Set([...getBaseUnlockedCardIds(), ...meta.unlockedCardIds])
}

export function getEffectiveUnlockedRelicIds(meta: MetaState): Set<RelicId> {
    return new Set([...getBaseUnlockedRelicIds(), ...meta.unlockedRelicIds])
}

export function getNextIroncladUnlockBundle(meta: MetaState): UnlockBundle | undefined {
    return IRONCLAD_UNLOCK_TRACK[meta.ironcladUnlockTier]
}

export function grantNextIroncladUnlock(meta: MetaState): UnlockBundle | undefined {
    const bundle = getNextIroncladUnlockBundle(meta)
    if (!bundle) return undefined
    meta.ironcladUnlockTier = Math.min(IRONCLAD_UNLOCK_TRACK.length, meta.ironcladUnlockTier + 1)
    for (const cardId of bundle.cards) {
        if (!meta.unlockedCardIds.includes(cardId)) meta.unlockedCardIds.push(cardId)
    }
    for (const relicId of bundle.relics) {
        if (!meta.unlockedRelicIds.includes(relicId)) meta.unlockedRelicIds.push(relicId)
    }
    return bundle
}

export function getBaseUnlockedCardIds(): string[] {
    return getBaseUnlockedCardIdsFromTrack()
}

export function getBaseUnlockedRelicIds(): RelicId[] {
    return getBaseUnlockedRelicIdsFromTrack()
}

export function getDailySeed(): string {
    const d = new Date()
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return `daily-${yyyy}-${mm}-${dd}`
}
