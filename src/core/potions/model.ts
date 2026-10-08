import type { Engine } from '../engine'
import type { EntityId } from '../actions'
import type { CharacterId } from '../characters'
import type { RunState } from '../run'
export type PotionId =
    | 'AMBROSIA' | 'ANCIENT_POTION' | 'ATTACK_POTION' | 'BLESSING_OF_THE_FORGE' | 'BLOCK_POTION'
    | 'BLOOD_POTION' | 'BOTTLED_MIRACLE' | 'COLORLESS_POTION' | 'CULTIST_POTION' | 'CUNNING_POTION'
    | 'DEXTERITY_POTION' | 'DISTILLED_CHAOS' | 'DUPLICATION_POTION' | 'ELIXIR' | 'ENERGY_POTION'
    | 'ENTROPIC_BREW' | 'ESSENCE_OF_DARKNESS' | 'ESSENCE_OF_STEEL' | 'EXPLOSIVE_POTION' | 'FAIRY_IN_A_BOTTLE'
    | 'FEAR_POTION' | 'FIRE_POTION' | 'FLEX_POTION' | 'FOCUS_POTION' | 'FRUIT_JUICE' | 'GAMBLERS_BREW'
    | 'GHOST_IN_A_JAR' | 'HEART_OF_IRON' | 'LIQUID_BRONZE' | 'LIQUID_MEMORIES' | 'POISON_POTION'
    | 'POTION_OF_CAPACITY' | 'POWER_POTION' | 'REGEN_POTION' | 'SKILL_POTION' | 'SMOKE_BOMB'
    | 'SNECKO_OIL' | 'SPEED_POTION' | 'STANCE_POTION' | 'STRENGTH_POTION' | 'SWIFT_POTION' | 'WEAK_POTION'
export interface PotionDef {
    id: PotionId
    name: string
    rarity: 'common' | 'uncommon' | 'rare'
    character?: CharacterId
    target: 'none' | 'player' | 'single_enemy'
    description: string
    scalable?: boolean
    autoRevivePercent?: number
    canUse?: (engine: Engine) => boolean
    use: (engine: Engine, targets: EntityId[], multiplier: number) => void
    useOutsideCombat?: (run: RunState, multiplier: number) => void
}
