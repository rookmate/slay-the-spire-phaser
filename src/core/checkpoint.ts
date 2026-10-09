import type { MetaState } from './meta'
import type { RunState } from './run'
import { META_KEY, RUN_KEY, persistence } from './persistence'
import { emitStorageChange, META_CHANGED } from './storageEvents'

/** Run replacement/completion and its history must become durable together. */
export function saveCheckpoint(meta: MetaState, run?: RunState): void {
    persistence().commit({ [META_KEY]: JSON.stringify(meta), [RUN_KEY]: run ? JSON.stringify(run) : null })
    emitStorageChange(META_CHANGED)
}
