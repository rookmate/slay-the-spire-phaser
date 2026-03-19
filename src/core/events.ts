import { RNG } from './rng'

export type EventId = 'WORLD_OF_GOOP' | 'CLERIC' | 'UPGRADE_SHRINE'

export interface EventDef {
    id: EventId
    title: string
    body: string
}

export const EVENT_DEFS: Record<EventId, EventDef> = {
    WORLD_OF_GOOP: {
        id: 'WORLD_OF_GOOP',
        title: 'World of Goop',
        body: 'Sticky gold bubbles up from the floor.',
    },
    CLERIC: {
        id: 'CLERIC',
        title: 'Cleric',
        body: 'A hooded cleric offers services for a price.',
    },
    UPGRADE_SHRINE: {
        id: 'UPGRADE_SHRINE',
        title: 'Upgrade Shrine',
        body: 'A quiet shrine hums with focused energy.',
    },
}

const EVENT_POOL: EventId[] = ['WORLD_OF_GOOP', 'CLERIC', 'UPGRADE_SHRINE']

export function generateEvent(seed: string): EventId {
    const rng = new RNG(seed)
    return EVENT_POOL[rng.int(0, EVENT_POOL.length - 1)]
}
