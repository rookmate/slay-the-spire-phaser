import { emitStorageChange, META_CHANGED } from './storageEvents'
import { persistence, META_KEY } from './persistence'
export { META_KEY } from './persistence'
import { clampAscension, MAX_ASCENSION } from './ascension'
import { CHARACTERS, CHARACTER_IDS, type CharacterId } from './characters'
import type { CardInstance } from './state'
import type { RelicId, RunState } from './run'
import { getBaseUnlockedCardIds, getBaseUnlockedRelicIds, UNLOCK_TRACKS, UNLOCK_XP, type UnlockBundle } from './unlocks'
export { clampAscension, getBaseUnlockedCardIds, getBaseUnlockedRelicIds }

export interface CharacterProgress {
    unlocked: boolean
    ascension: number
    unlockTier: number
    xp: number
    act3Cleared: boolean
    previousRunReachedBoss: boolean
}
export interface RunHistoryEntry {
    id: string; date: string; character: CharacterId; mode: RunState['mode']; seed: string; ascension: number
    result: 'victory' | 'defeat'; floor: number; actsCleared: number[]; score: number; elapsedSeconds: number
    deck: { id: string; upgrade: number }[]; relics: RelicId[]
}
export interface MetaState {
    achievements?: Partial<Record<import('./achievements/catalog').AchievementId, string>>
    notifications?: import('./achievements/catalog').UnlockNotice[]
    customUnlocked?: boolean
    version?: 3
    characters?: Record<CharacterId, CharacterProgress>
    history?: RunHistoryEntry[]
    noteCard?: Pick<CardInstance, 'defId' | 'upgradeLevel' | 'permanentDamage' | 'permanentBlock'>
    previousRunReachedBoss?: boolean
    lastRecordedRunId?: string
    bestAscensionUnlocked: number
    totalWins: number
    totalRuns: number
    ironcladUnlockTier: number
    unlockedCardIds: string[]
    unlockedRelicIds: RelicId[]
}
export function createDefaultMeta(): MetaState {
    return { version: 3, bestAscensionUnlocked: 0, totalWins: 0, totalRuns: 0, ironcladUnlockTier: 0, unlockedCardIds: [], unlockedRelicIds: [], history: [] }
}
function progressDefaults(): CharacterProgress {
    return { unlocked: true, ascension: 0, unlockTier: 0, xp: 0, act3Cleared: false, previousRunReachedBoss: false }
}
export function getCharacterProgress(meta: MetaState, character: CharacterId): CharacterProgress {
    if (!meta.characters) {
        meta.characters = Object.fromEntries(CHARACTER_IDS.map(id => [id, progressDefaults()])) as Record<CharacterId, CharacterProgress>
        Object.assign(meta.characters.ironclad, { ascension: clampAscension(meta.bestAscensionUnlocked), unlockTier: Math.min(5, meta.ironcladUnlockTier), previousRunReachedBoss: !!meta.previousRunReachedBoss, act3Cleared: meta.totalWins > 0 })
    }
    const progress = meta.characters[character] ??= progressDefaults()
    progress.unlocked = true
    return progress
}
export function loadMeta(): MetaState {
    const raw = persistence().read(META_KEY)
    try {
        const parsed = JSON.parse(raw ?? 'null') as Partial<MetaState> | null
        if (!parsed || typeof parsed !== 'object') return createDefaultMeta()
        const meta = { ...createDefaultMeta(), ...parsed, unlockedCardIds: parsed.unlockedCardIds ?? [], unlockedRelicIds: parsed.unlockedRelicIds ?? [] }
        for (const id of CHARACTER_IDS) {
            const progress = getCharacterProgress(meta, id)
            meta.characters![id] = { ...progressDefaults(), ...progress, ascension: clampAscension(progress?.ascension ?? 0), unlockTier: Math.max(0, Math.min(5, progress?.unlockTier ?? 0)), xp: Math.max(0, progress?.xp ?? 0) }
        }
        meta.notifications = meta.notifications?.flatMap(notice => {
            if (notice.id.startsWith('character:')) return []
            const character = CHARACTER_IDS.find(id => notice.id.startsWith(`bundle:${id}:`))
            const bundle = character && UNLOCK_TRACKS[character][Number(notice.id.split(':')[2]) - 1]
            if (bundle && !bundle.relics.length) return []
            return [bundle ? { ...notice, title: `${CHARACTERS[character!].name}: new relics` } : notice]
        })
        meta.version = 3
        return meta
    } catch { return createDefaultMeta() }
}
export function saveMeta(meta: MetaState): void {
    persistence().commit({ [META_KEY]: JSON.stringify(meta) })
    emitStorageChange(META_CHANGED)
}
export function getSelectableAscensions(meta: MetaState, character: CharacterId = 'ironclad'): number[] {
    return Array.from({ length: getCharacterProgress(meta, character).ascension + 1 }, (_, index) => index)
}
export function unlockNextAscension(meta: MetaState, clearedAscension: number, character: CharacterId = 'ironclad'): boolean {
    const progress = getCharacterProgress(meta, character)
    const cleared = clampAscension(clearedAscension)
    if (cleared !== progress.ascension || progress.ascension >= MAX_ASCENSION) return false
    progress.ascension++
    if (character === 'ironclad') meta.bestAscensionUnlocked = progress.ascension
    return true
}
function earnedBundles(meta: MetaState): UnlockBundle[] {
    return CHARACTER_IDS.flatMap(id => UNLOCK_TRACKS[id].slice(0, getCharacterProgress(meta, id).unlockTier))
}
export function getEffectiveUnlockedCardIds(meta: MetaState): Set<string> {
    return new Set([...getBaseUnlockedCardIds(), ...meta.unlockedCardIds])
}
export function getEffectiveUnlockedRelicIds(meta: MetaState): Set<RelicId> {
    return new Set([...getBaseUnlockedRelicIds(), ...meta.unlockedRelicIds, ...earnedBundles(meta).flatMap(bundle => bundle.relics)])
}
export function grantNextUnlock(meta: MetaState, character: CharacterId): UnlockBundle | undefined {
    const progress = getCharacterProgress(meta, character)
    const bundle = UNLOCK_TRACKS[character][progress.unlockTier]
    if (!bundle) return undefined
    progress.unlockTier++
    if (character === 'ironclad') meta.ironcladUnlockTier = progress.unlockTier
    meta.unlockedCardIds = [...new Set([...meta.unlockedCardIds, ...bundle.cards])]
    meta.unlockedRelicIds = [...new Set([...meta.unlockedRelicIds, ...bundle.relics])]
    return bundle
}
export function grantNextIroncladUnlock(meta: MetaState): UnlockBundle | undefined { return grantNextUnlock(meta, 'ironclad') }
export function awardUnlockXp(meta: MetaState, character: CharacterId, score: number): UnlockBundle | undefined {
    const progress = getCharacterProgress(meta, character)
    const cost = UNLOCK_XP[progress.unlockTier]
    if (!cost) return undefined
    progress.xp += Math.max(0, Math.floor(score))
    if (progress.xp < cost) return undefined
    progress.xp -= cost
    const bundle = grantNextUnlock(meta, character)
    const nextCost = UNLOCK_XP[progress.unlockTier]
    if (nextCost && progress.xp > nextCost) progress.xp = nextCost - 1
    return bundle
}
export function keysUnlocked(meta: MetaState): boolean {
    return (['ironclad', 'silent', 'defect'] as const).every(id => getCharacterProgress(meta, id).act3Cleared)
}
export function getDailySeed(date = new Date()): string { return `daily-${date.toISOString().slice(0, 10)}` }
