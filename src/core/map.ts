import type { RunState } from './run'
import { hasModifier } from './modes/modifiers'
import { generateLegacyMap } from './legacyMap'
import { RNG } from './rng'

export type RoomKind = 'start' | 'monster' | 'elite' | 'rest' | 'shop' | 'unknown' | 'chest' | 'boss'
export interface MapNode { id: string; row: number; col: number; kind: RoomKind; edgesTo: string[]; burning?: boolean }
export interface GeneratedMap { rows: number; cols: number; nodes: MapNode[]; byId: Record<string, MapNode>; startIds: string[] }

export function generateMap(seed: string, act = 1, rows = 16, cols = 7, asc = 0, options: { singlePath?: boolean; moreElites?: boolean } = {}): GeneratedMap {
    if (act === 4) {
        const kinds: RoomKind[] = ['rest', 'shop', 'elite', 'boss']
        const nodes = kinds.map((kind, i): MapNode => ({ id: `${3 - i}:3`, row: 3 - i, col: 3, kind, edgesTo: i < 3 ? [`${2 - i}:3`] : [] }))
        return { rows: 4, cols: 7, nodes, byId: Object.fromEntries(nodes.map(n => [n.id, n])), startIds: ['3:3'] }
    }
    if (rows === 15) return generateLegacyMap(seed, act, rows, cols, asc)
    const rng = new RNG(`${seed}-act-${act}`)
    const byId: Record<string, MapNode> = {}
    function node(row: number, col: number): MapNode {
        const id = `${row}:${col}`
        return byId[id] ??= { id, row, col, kind: 'unknown', edgesTo: [] }
    }
    const first = rng.int(0, cols - 1)
    const starts = [first, (first + rng.int(1, cols - 1)) % cols, ...Array.from({ length: 4 }, () => rng.int(0, cols - 1))]
    for (const start of options.singlePath ? [first] : starts) {
        let col = start
        for (let row = rows - 1; row > 1; row--) {
            const current = node(row, col)
            let next = Math.max(0, Math.min(cols - 1, col + rng.int(-1, 1)))
            const crosses = Object.values(byId).some(other => other.row === row && other.edgesTo.some(id => {
                const dest = byId[id]
                return (other.col - col) * (dest.col - next) < 0
            }))
            if (crosses) next = col
            const to = node(row - 1, next)
            if (!current.edgesTo.includes(to.id)) current.edgesTo.push(to.id)
            col = next
        }
        node(1, col).edgesTo = [node(0, Math.floor(cols / 2)).id]
    }
    const nodes = Object.values(byId)
    for (const n of [...nodes].sort((a, b) => b.row - a.row)) {
        const floor = rows - n.row
        if (n.row === 0) n.kind = 'boss'
        else if (n.row === 1) n.kind = 'rest'
        else if (floor === 9) n.kind = 'chest'
        else if (floor === 1) n.kind = 'monster'
        else {
            const parents = nodes.filter(parent => parent.edgesTo.includes(n.id))
            const roll = rng.random()
            const eliteChance = (asc >= 1 ? 0.128 : 0.08) * (options.moreElites ? 2.5 : 1)
            const kind: RoomKind = roll < eliteChance ? 'elite' : roll < eliteChance + 0.12 ? 'rest' : roll < eliteChance + 0.17 ? 'shop' : roll < eliteChance + 0.39 ? 'unknown' : 'monster'
            const restricted = kind === 'elite' || kind === 'rest' || kind === 'shop'
            n.kind = ((floor < 6 && (kind === 'elite' || kind === 'rest')) || (floor === 14 && kind === 'rest') || (restricted && parents.some(p => p.kind === kind))) ? 'monster' : kind
        }
    }
    let elites = nodes.filter(n => n.kind === 'elite')
    if (!elites.length) {
        const candidate = nodes.find(n => rows - n.row === 8)
        if (candidate) { candidate.kind = 'elite'; elites = [candidate] }
    }
    if (elites.length) elites[rng.int(0, elites.length - 1)].burning = true
    return { rows, cols, nodes, byId, startIds: nodes.filter(n => n.row === rows - 1).map(n => n.id) }
}

export type UnknownOutcome = 'event' | 'monster' | 'shop' | 'chest' | 'elite'
export interface UnknownWeights { event: number; monster: number; shop: number; chest: number; elite?: number }
export function defaultUnknownWeights(): UnknownWeights { return { event: 0.85, monster: 0.1, shop: 0.03, chest: 0.02 } }
export function resolveUnknown(rng: RNG, weights: UnknownWeights): UnknownOutcome {
    let roll = rng.random()
    for (const kind of ['monster', 'shop', 'chest', 'elite'] as const) if ((roll -= weights[kind] ?? 0) < 0) return kind
    return 'event'
}
export function updateUnknownWeights(weights: UnknownWeights, picked: UnknownOutcome, deadly = false): UnknownWeights {
    const base = defaultUnknownWeights()
    const next = { ...weights }
    for (const kind of ['monster', 'shop', 'chest'] as const) next[kind] = picked === kind ? base[kind] : weights[kind] + base[kind]
    if (deadly) { next.chest = picked === 'chest' ? base.chest : weights.chest + 0.04; next.elite = picked === 'elite' ? 0.2 : (weights.elite ?? 0.2) + 0.2 }
    next.event = Math.max(0, 1 - next.monster - next.shop - next.chest - (next.elite ?? 0))
    return next
}

export function getRunMap(run: RunState): GeneratedMap {
    const seed = run.endlessLoop ? `${run.seed}-loop-${run.endlessLoop}` : run.seed
    const map = generateMap(seed, run.act, run.mapRows ?? 16, 7, run.asc, { singlePath: hasModifier(run, 'CERTAIN_FUTURE'), moreElites: hasModifier(run, 'BIG_GAME_HUNTER') })
    for (const node of map.nodes) {
        if (run.keysEnabled === false) node.burning = false
        if ((run.endlessLoop ?? 0) > 0 && node.kind === 'chest') node.kind = 'elite'
    }
    return map
}
