import type { Engine } from './engine'
import { cardColors } from './modes/modifiers'
import { CARD_DEFS } from './cards'
import type { CharacterId } from './characters'
import { getEffectiveUnlockedCardIds, type MetaState } from './meta'
import type { CardColor, CardDef, CardType } from './state'

export interface CardPoolOptions {
    character: CharacterId
    source: 'reward' | 'shop' | 'transform' | 'generated' | 'colorless' | 'foreign' | 'any_generated'
    meta?: MetaState
    unlockedIds?: readonly string[]
    colors?: readonly CardColor[]
    prismatic?: boolean
    type?: CardType
    rarity?: CardDef['rarity']
}
const cannotGenerate = new Set(['FEED', 'REAPER', 'BANDAGE_UP', 'SELF_REPAIR', 'LESSON_LEARNED', 'ALCHEMIZE', 'WISH'])

/** Character and source determine eligibility; reward generation owns rarity rolls. */
export function selectCardPool(options: CardPoolOptions): string[] {
    const unlocked = options.unlockedIds ? new Set(options.unlockedIds)
        : options.meta ? getEffectiveUnlockedCardIds(options.meta) : undefined
    const colors: readonly string[] = options.colors ?? [options.character]
    return Object.values(CARD_DEFS).filter(card => {
        if (!card.poolEnabled || card.rarity === 'basic' || card.type === 'status' || card.type === 'curse') return false
        if (options.type && card.type !== options.type) return false
        if (options.rarity && card.rarity !== options.rarity) return false
        if (options.source === 'colorless') return card.color === 'colorless'
        if (unlocked && card.color !== 'colorless' && !unlocked.has(card.id)) return false
        if (options.source === 'any_generated') return !cannotGenerate.has(card.id)
        if (options.source === 'foreign') return card.color !== 'colorless' && card.color !== options.character
        if (options.source === 'generated' && cannotGenerate.has(card.id)) return false
        if (options.source === 'reward' && options.prismatic) return card.color === 'colorless' || !unlocked || unlocked.has(card.id)
        if (!colors.includes(card.color ?? '')) return false
        return !unlocked || unlocked.has(card.id)
    }).map(card => card.id)
}

export function selectCombatCardPool(engine: Engine, options: Omit<CardPoolOptions, 'character'>): string[] {
    return selectCardPool({ character: engine.state.player.character, unlockedIds: engine.run?.unlockedCardIds, colors: cardColors(engine.run ?? { character: engine.state.player.character }), ...options })
}
