export interface MetaState {
    bestAscensionUnlocked: number
    totalWins: number
    totalRuns: number
}

const MAX_ASCENSION = 10

const META_KEY = 'sts_meta_v1'

export function loadMeta(): MetaState {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return { bestAscensionUnlocked: 0, totalWins: 0, totalRuns: 0 }
    try {
        const parsed = JSON.parse(raw) as MetaState
        return parsed
    } catch {
        return { bestAscensionUnlocked: 0, totalWins: 0, totalRuns: 0 }
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

export function getDailySeed(): string {
    const d = new Date()
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return `daily-${yyyy}-${mm}-${dd}`
}

