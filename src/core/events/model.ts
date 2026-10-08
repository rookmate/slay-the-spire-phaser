import type { CardInstance } from '../state'
import type { RunState, RelicId } from '../run'
import type { EnemyKey } from '../encounters'
import type { RewardBundle } from '../rewards'

export type EventId = 'WING_STATUE' | 'SHINING_LIGHT' | 'MUSHROOMS' | 'DEAD_ADVENTURER' | 'AUGMENTER' | 'COUNCIL_OF_GHOSTS' | 'VAMPIRES' | 'CURSED_TOME' | 'THE_NEST' | 'MASKED_BANDITS' | 'COLOSSEUM' | 'PLEADING_VAGRANT' | 'PURIFIER' | 'DIVINE_FOUNTAIN' | 'BONFIRE_SPIRITS' | 'OMINOUS_FORGE' | 'LAB' | 'WOMAN_IN_BLUE' | 'FACE_TRADER' | 'KNOWING_SKULL' | 'NLOTH' | 'DESIGNER' | 'WE_MEET_AGAIN' | 'NOTE_FOR_YOURSELF' | 'MATCH_AND_KEEP' | 'WORLD_OF_GOOP' | 'CLERIC' | 'UPGRADE_SHRINE' | 'GOLDEN_IDOL' | 'BIG_FISH' | 'THE_JOUST' | 'SCRAP_OOZE' | 'LIVING_WALL' | 'THE_SSSSERPENT' | 'FORGOTTEN_ALTAR' | 'THE_MAUSOLEUM' | 'BEGGAR' | 'ANCIENT_WRITING' | 'THE_LIBRARY' | 'GOLDEN_SHRINE' | 'TRANSMOGRIFIER' | 'DUPLICATOR' | 'WHEEL_OF_CHANGE' | 'FALLING' | 'WINDING_HALLS' | 'MIND_BLOOM' | 'THE_MOAI_HEAD' | 'MYSTERIOUS_SPHERE' | 'SECRET_PORTAL' | 'SENSORY_STONE' | 'RED_MASK_TOMB'
export interface EventCheckpoint {
    id: EventId
    counts?: Record<string, number>
    relics?: RelicId[]
    potionId?: import('../potions').PotionId
    transformEligibleIds?: string[]
    gold?: number
    noteCard?: Pick<CardInstance, 'defId' | 'upgradeLevel' | 'permanentDamage' | 'permanentBlock'>
    matching?: { cards: string[]; matched: number[]; revealed: number[]; attempts: number }
    step?: string
    attempts?: number
    resolved?: boolean
    notes?: string[]
    cards?: string[]
}
export interface EventCombat { enemies: EnemyKey[]; resumeEvent?: boolean; awakeLagavulin?: boolean; rewards: RewardBundle }
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
