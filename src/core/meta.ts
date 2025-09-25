export interface MetaState {
    bestAscensionUnlocked: number
    totalWins: number
    totalRuns: number
}

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

export function getDailySeed(): string {
    const d = new Date()
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return `daily-${yyyy}-${mm}-${dd}`
}


