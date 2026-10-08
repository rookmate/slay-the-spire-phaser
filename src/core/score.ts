import { CARD_DEFS } from './cards'
import { CHARACTERS } from './characters'
import type { Engine } from './engine'
import type { RoomKind } from './map'
import type { RunState } from './run'

export interface RunStats {
    hallwayWins?: number
    elites?: Partial<Record<1 | 2 | 3 | 4, number>>
    bosses?: number
    perfectElites?: number
    perfectBosses?: number
    unknownRooms?: number
    goldEarned?: number
    overkill?: boolean
    combo?: boolean
}
export function recordCombatStats(run: RunState, engine: Engine, room: RoomKind): void {
    const stats = run.stats ??= {}
    stats.combo ||= engine.state.scoreCombo
    stats.overkill ||= engine.state.scoreOverkill
    if (!engine.state.victory || engine.state.escaped || run.eventCombat) return
    const perfect = !(engine.state.enemyDamageTaken ?? 0)
    if (room === 'monster') stats.hallwayWins = (stats.hallwayWins ?? 0) + 1
    if (room === 'elite') {
        stats.elites ??= {}; stats.elites[run.act] = (stats.elites[run.act] ?? 0) + 1
        if (perfect) stats.perfectElites = (stats.perfectElites ?? 0) + 1
    }
    if (room === 'boss') {
        stats.bosses = (stats.bosses ?? 0) + 1
        if (perfect) stats.perfectBosses = (stats.perfectBosses ?? 0) + 1
    }
}
export interface ScoreLine { label: string; points: number }
export function calculateScore(run: RunState, victory: boolean): { total: number; lines: ScoreLine[] } {
    const stats = run.stats ?? {}, lines: ScoreLine[] = []
    const add = (label: string, points: number) => { if (points) lines.push({ label, points }) }
    add('Floors climbed', run.neowCompleted ? run.floor * 5 : 0)
    add('Enemies slain', (stats.hallwayWins ?? run.hallwayCount ?? 0) * 2)
    for (const act of [1, 2, 3] as const) add(`Act ${act} elites`, (stats.elites?.[act] ?? 0) * 10 * act)
    const bosses = stats.bosses ?? run.actsCleared?.length ?? 0
    add('Bosses slain', 25 * bosses * (bosses + 1))
    add('Champion', (stats.perfectElites ?? 0) * 25)
    const perfect = stats.perfectBosses ?? 0
    add(perfect >= 3 ? 'Beyond perfect' : 'Perfect', perfect >= 3 ? 200 : 50 * perfect)
    add('Overkill', stats.overkill ? 25 : 0)
    add('C-c-c-combo', stats.combo ? 25 : 0)
    add('Ascension', Math.floor(lines.reduce((sum, line) => sum + line.points, 0) * run.asc * 0.05))
    if (run.actsCleared?.includes(4)) add('Heartbreaker', 250)
    const counts = new Map<string, number>()
    for (const card of run.deck) if (CARD_DEFS[card.defId].rarity !== 'basic') counts.set(card.defId, (counts.get(card.defId) ?? 0) + 1)
    add('Collector', [...counts.values()].filter(count => count >= 4).length * 25)
    if (victory) {
        if ([...counts.values()].every(count => count === 1)) add('Highlander', 100)
        if (!run.deck.some(card => CARD_DEFS[card.defId].rarity === 'rare')) add('Pauper', 50)
        const seconds = run.elapsedSeconds ?? 0
        if (seconds < 3600) add(seconds < 2700 ? 'Light speed' : 'Speedster', seconds < 2700 ? 50 : 25)
    }
    if (run.relics.length >= 25) add('I like shiny', 50)
    if (run.deck.filter(card => CARD_DEFS[card.defId].type === 'curse').length >= 5) add('Curses!', 100)
    if (run.deck.length >= 35) add(run.deck.length >= 50 ? 'Encyclopedian' : 'Librarian', run.deck.length >= 50 ? 50 : 25)
    const hpGained = run.player.maxHp - (run.initialMaxHp ?? CHARACTERS[run.character].maxHp)
    if (hpGained >= 15) add(hpGained >= 30 ? 'Stuffed' : 'Well fed', hpGained >= 30 ? 50 : 25)
    const gold = stats.goldEarned ?? 0
    if (gold >= 1000) add(gold >= 3000 ? 'I like gold' : gold >= 2000 ? 'Raining money' : 'Money money', Math.min(3, Math.floor(gold / 1000)) * 25)
    if ((stats.unknownRooms ?? 0) >= 15) add('Mystery machine', 25)
    if (run.relics.includes('SPIRIT_POOP')) add('Poopy', -1)
    return { total: Math.max(0, lines.reduce((sum, line) => sum + line.points, 0)), lines }
}
