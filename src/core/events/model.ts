import type { CardInstance } from '../state'
import type { RunState } from '../run'
import type { EnemyKey } from '../encounters'
import type { RewardBundle } from '../rewards'

export type EventId = 'WORLD_OF_GOOP' | 'CLERIC' | 'UPGRADE_SHRINE' | 'GOLDEN_IDOL' | 'BIG_FISH' | 'THE_JOUST' | 'SCRAP_OOZE' | 'LIVING_WALL' | 'THE_SSSSERPENT' | 'FORGOTTEN_ALTAR' | 'THE_MAUSOLEUM' | 'BEGGAR' | 'ANCIENT_WRITING' | 'THE_LIBRARY' | 'GOLDEN_SHRINE' | 'TRANSMOGRIFIER' | 'DUPLICATOR' | 'WHEEL_OF_CHANGE' | 'FALLING' | 'WINDING_HALLS' | 'MIND_BLOOM' | 'THE_MOAI_HEAD' | 'MYSTERIOUS_SPHERE' | 'SECRET_PORTAL' | 'SENSORY_STONE' | 'RED_MASK_TOMB'
export interface EventCheckpoint {
    id: EventId
    step?: string
    attempts?: number
    resolved?: boolean
    notes?: string[]
    cards?: string[]
}
export interface EventCombat { enemies: EnemyKey[]; rewards: RewardBundle }
export interface EventChoiceDef {
    id: string
    label: string
    description?: string
    disabled?: (run: RunState) => boolean
    requiresSelection?: 'remove' | 'upgrade' | 'transform' | 'copy' | 'reward'
    cardType?: 'attack' | 'skill' | 'power'
}
export interface EventDef {
    id: EventId
    title: string
    body: string
    choices: (run: RunState) => EventChoiceDef[]
    eligible?: (run: RunState) => boolean
}
export interface EventResolution {
    notes: string[]
    transformedCard?: CardInstance
    nextScene?: 'Combat' | 'Rewards' | 'RunSummary'
}
