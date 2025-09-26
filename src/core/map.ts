import { RNG } from './rng'

export type RoomKind = 'start' | 'monster' | 'elite' | 'rest' | 'shop' | 'unknown' | 'chest' | 'boss'

export interface MapNode {
    id: string
    row: number
    col: number
    kind: RoomKind
    edgesTo: string[]
}

export interface GeneratedMap {
    rows: number
    cols: number
    nodes: MapNode[]
    byId: Record<string, MapNode>
    startIds: string[]
}

function nodeId(row: number, col: number): string {
    return `${row}:${col}`
}

export function generateMap(seed: string, act: number = 1, rows = 15, cols = 7): GeneratedMap {
    const rng = new RNG(`${seed}-act-${act}`)
    const grid: (MapNode | null)[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null))

    // 1) Seed several lanes from bottom row up to top
    const laneCount = rng.int(3, 5)
    const usedCols: number[] = []
    function pickDistinctCol(): number {
        let c = rng.int(0, cols - 1)
        let tries = 0
        while (usedCols.includes(c) && tries++ < 10) c = rng.int(0, cols - 1)
        usedCols.push(c)
        return c
    }
    const starts = Array.from({ length: laneCount }, () => pickDistinctCol())
    for (const c0 of starts) {
        let c = c0
        for (let r = rows - 1; r >= 0; r--) {
            grid[r][c] ||= { id: nodeId(r, c), row: r, col: c, kind: 'unknown', edgesTo: [] }
            if (r > 0) {
                const nc = Math.max(0, Math.min(cols - 1, c + rng.int(-1, 1)))
                grid[r - 1][nc] ||= { id: nodeId(r - 1, nc), row: r - 1, col: nc, kind: 'unknown', edgesTo: [] }
                grid[r][c]!.edgesTo.push(grid[r - 1][nc]!.id)
                c = nc
            }
        }
    }

    // 2) Bridges for branching
    for (let r = rows - 2; r >= 1; r--) {
        for (let c = 0; c < cols - 1; c++) {
            if (rng.random() < 0.25 && grid[r][c] && grid[r - 1][c + 1]) {
                grid[r][c]!.edgesTo.push(grid[r - 1][c + 1]!.id)
            }
            if (rng.random() < 0.25 && grid[r][c + 1] && grid[r - 1][c]) {
                grid[r][c + 1]!.edgesTo.push(grid[r - 1][c]!.id)
            }
        }
    }

    // Collect nodes
    const nodes = grid.flat().filter(Boolean) as MapNode[]
    const byId: Record<string, MapNode> = {}
    for (const n of nodes) byId[n.id] = n

    // 3) Assign kinds with simple quotas and constraints
    // Reserve top row as pre-boss rest and boss
    for (let c = 0; c < cols; c++) {
        if (grid[0][c]) grid[0][c]!.kind = 'boss'
        if (rows > 1 && grid[1][c] && grid[1][c]!.kind === 'unknown') grid[1][c]!.kind = 'rest'
    }
    // Mid chest
    const chestRow = Math.floor(rows / 2)
    for (let c = 0; c < cols; c++) {
        if (grid[chestRow][c] && grid[chestRow][c]!.kind === 'unknown') {
            grid[chestRow][c]!.kind = 'chest'; break
        }
    }
    // Place elites spaced out
    let elitesToPlace = 2
    for (let r = rows - 2; r >= 2 && elitesToPlace > 0; r--) {
        if (rng.random() < 0.15) {
            const colsHere = grid[r].map((n, i) => ({ n, i })).filter(x => x.n)
            if (colsHere.length > 0) {
                const pick = colsHere[rng.int(0, colsHere.length - 1)].n!
                if (pick.kind === 'unknown') { pick.kind = 'elite'; elitesToPlace-- }
            }
        }
    }
    // Place rests (3–4)
    let restsToPlace = rng.int(3, 4)
    for (let r = rows - 2; r >= 2 && restsToPlace > 0; r--) {
        if (rng.random() < 0.25) {
            const colsHere = grid[r].map((n, i) => ({ n, i })).filter(x => x.n)
            if (colsHere.length > 0) {
                const pick = colsHere[rng.int(0, colsHere.length - 1)].n!
                if (pick.kind === 'unknown') { pick.kind = 'rest'; restsToPlace-- }
            }
        }
    }
    // Place shops (2–3)
    let shopsToPlace = rng.int(2, 3)
    for (let r = rows - 2; r >= 2 && shopsToPlace > 0; r--) {
        if (rng.random() < 0.15) {
            const colsHere = grid[r].map((n, i) => ({ n, i })).filter(x => x.n)
            if (colsHere.length > 0) {
                const pick = colsHere[rng.int(0, colsHere.length - 1)].n!
                if (pick.kind === 'unknown') { pick.kind = 'shop'; shopsToPlace-- }
            }
        }
    }
    // Fill remaining unknowns with monsters vs unknown based on ratio
    for (const n of nodes) {
        if (n.kind === 'unknown' && rng.random() < 0.6) n.kind = 'monster'
    }

    // Start nodes: bottom row entries
    const startIds: string[] = []
    for (let c = 0; c < cols; c++) {
        if (grid[rows - 1][c]) {
            grid[rows - 1][c]!.kind = 'start'
            startIds.push(grid[rows - 1][c]!.id)
        }
    }

    return { rows, cols, nodes, byId, startIds }
}

export type UnknownOutcome = 'event' | 'monster' | 'shop' | 'chest'

export interface UnknownWeights {
    event: number
    monster: number
    shop: number
    chest: number
}

export function defaultUnknownWeights(): UnknownWeights {
    return { event: 0.4, monster: 0.4, shop: 0.1, chest: 0.1 }
}

export function resolveUnknown(rng: RNG, w: UnknownWeights): UnknownOutcome {
    const total = w.event + w.monster + w.shop + w.chest
    let r = rng.random() * total
    if ((r -= w.event) <= 0) return 'event'
    if ((r -= w.monster) <= 0) return 'monster'
    if ((r -= w.shop) <= 0) return 'shop'
    return 'chest'
}

export function updateUnknownWeights(w: UnknownWeights, picked: UnknownOutcome): UnknownWeights {
    const dec = 0.15
    const inc = 0.05
    const next: UnknownWeights = { event: w.event, monster: w.monster, shop: w.shop, chest: w.chest }
    next[picked] = Math.max(0.05, next[picked] - dec)
    const keys: Array<keyof UnknownWeights> = ['event', 'monster', 'shop', 'chest']
    for (const k of keys) {
        if (k !== picked) next[k] = next[k] + inc
    }
    return next
}


