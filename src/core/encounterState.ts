import { getEncounterActSeed } from './acts'
import { selectEncounter, type Encounter } from './encounters'
import { generateLegacyEncounter } from './legacyEncounters'
import { RNG } from './rng'
import type { RunState } from './run'

/** Migrate only the unfinished fight. Earlier encounter families were never saved. */
export function migrateEncounterState(run: RunState): void {
    if (run.encounterHistory) return
    run.hallwayCount ??= run.combatCount ?? 0
    const room = run.pendingRoom
    if (room?.scene === 'Combat' && room.roomKind !== 'boss' && !run.eventCombat && !room.encounter) {
        const tier = room.roomKind === 'monster' ? 'hallway' : 'elite'
        const index = tier === 'hallway' ? run.hallwayCount : run.combatCount ?? 0
        room.encounter = generateLegacyEncounter(new RNG(getEncounterActSeed(run.seed, run.act, tier, index)), run.act, tier, index)
    }
    run.encounterHistory = { hallway: [] }
}

/** The checkpoint owns the rolled composition; engine construction does not advance history. */
export function prepareEncounter(run: RunState, roomKind: 'monster' | 'elite'): Encounter {
    const room = run.pendingRoom
    if (room?.scene === 'Combat' && room.roomKind === roomKind && room.encounter) return room.encounter
    const tier = roomKind === 'monster' ? 'hallway' : 'elite'
    const index = tier === 'hallway' ? run.hallwayCount ?? 0 : run.combatCount ?? 0
    const encounter = selectEncounter(new RNG(getEncounterActSeed(run.seed, run.act, tier, index)), run.act, tier, run.hallwayCount ?? 0, run.encounterHistory)
    if (room?.scene === 'Combat' && room.roomKind === roomKind) room.encounter = encounter
    return encounter
}

export function recordEncounter(run: RunState): void {
    const room = run.pendingRoom
    if (run.eventCombat || room?.scene !== 'Combat' || room.roomKind === 'boss' || !room.encounter) return
    const history = run.encounterHistory ??= { hallway: [] }
    if (room.roomKind === 'monster') history.hallway = [...history.hallway, room.encounter.id].slice(-2)
    else history.elite = room.encounter.id
}
