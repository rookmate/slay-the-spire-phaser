import { EVENT_CARDS } from './cards/eventCards'
import { WATCHER_ATTACKS } from './cards/watcherAttacks'
import { WATCHER_SKILLS } from './cards/watcherSkills'
import { WATCHER_POWERS } from './cards/watcherPowers'
import { WATCHER_TOKENS } from './cards/watcherTokens'
import { DEFECT_ATTACKS } from './cards/defectAttacks'
import { DEFECT_SKILLS } from './cards/defectSkills'
import { DEFECT_POWERS } from './cards/defectPowers'
import { SILENT_ATTACKS } from './cards/silentAttacks'
import { SILENT_SKILLS } from './cards/silentSkills'
import { SILENT_POWERS } from './cards/silentPowers'
import { selectCardPool } from './contentPools'
import { STARTER_CARDS } from './cards/starters'
import { CHARACTERS, type CharacterId } from './characters'
import { COLORLESS_CARDS } from './cards/colorless'
import { IRONCLAD_CARDS } from './cards/ironclad'
import { STATUS_CARDS } from './cards/status'
import type { MetaState } from './meta'
import type { CardDef, CardEngineApi, CardInstance } from './state'

let fallbackCardInstanceId = 0

function createInstanceId(defId: string): string {
    const randomId = globalThis.crypto?.randomUUID?.()
    if (randomId) return `${defId.toLowerCase()}-${randomId}`
    fallbackCardInstanceId += 1
    return `${defId.toLowerCase()}-${fallbackCardInstanceId}`
}

export function createCardInstance(defId: string, upgradeLevel = 0): CardInstance {
    return {
        instanceId: createInstanceId(defId),
        defId,
        upgradeLevel,
    }
}

export function createCardCopy(card: CardInstance): CardInstance {
    return { ...createCardInstance(card.defId, card.upgradeLevel), permanentBlock: card.permanentBlock, permanentDamage: card.permanentDamage, storedHits: card.storedHits }
}

export function createStarterDeck(character: CharacterId = 'ironclad'): CardInstance[] {
    return CHARACTERS[character].starterDeck.flatMap(([id, count]) => Array.from({ length: count }, () => createCardInstance(id)))
}

export function canUpgradeCard(card: CardInstance): boolean {
    const def = CARD_DEFS[card.defId]
    return Boolean(def && def.type !== 'curse' && def.type !== 'status' && (card.defId === 'SEARING_BLOW' || card.upgradeLevel === 0))
}

export function getCardCombatBonusDamage(engine: CardEngineApi, instanceId: string): number {
    return engine.getCardCombatBonusDamage?.(instanceId) ?? 0
}

export function modifyCardCombatBonusDamage(engine: CardEngineApi, instanceId: string, delta: number): number {
    return engine.modifyCardCombatBonusDamage?.(instanceId, delta) ?? 0
}

export function searingBlowDamage(upgradeLevel: number): number {
    return 12 + (upgradeLevel * (upgradeLevel + 7)) / 2
}

export interface ResolvedCardDef extends CardDef {
    name: string
    cost: number
    exhaust: boolean
    xCost: boolean
    unplayable: boolean
    ethereal: boolean
    baseDamage?: number
    baseBlock?: number
}

function register(cards: Record<string, CardDef>, color: NonNullable<CardDef['color']>): Record<string, CardDef> {
    return Object.fromEntries(Object.entries(cards).map(([id, def]) => [id, {
        ...def, color: def.color ?? color, implemented: def.implemented ?? true,
        poolEnabled: def.poolEnabled ?? (def.type !== 'status' && def.type !== 'curse' && def.rarity !== 'basic'),
    }]))
}
export const CARD_DEFS: Record<string, CardDef> = {
    ...register(IRONCLAD_CARDS, 'ironclad'),
    ...register(SILENT_ATTACKS, 'silent'),
    ...register(SILENT_SKILLS, 'silent'),
    ...register(SILENT_POWERS, 'silent'),
    ...register(DEFECT_ATTACKS, 'defect'),
    ...register(DEFECT_SKILLS, 'defect'),
    ...register(DEFECT_POWERS, 'defect'),
    ...register(WATCHER_ATTACKS, 'watcher'),
    ...register(WATCHER_SKILLS, 'watcher'),
    ...register(WATCHER_POWERS, 'watcher'),
    ...register(WATCHER_TOKENS, 'colorless'),
    ...register(COLORLESS_CARDS, 'colorless'),
    ...register(STATUS_CARDS, 'colorless'),
    ...register(EVENT_CARDS, 'colorless'),
    ...register(STARTER_CARDS, 'colorless'),
}

export function resolveCard(card: CardInstance): ResolvedCardDef {
    const def = CARD_DEFS[card.defId]
    const upgradeLevel = card.upgradeLevel
    const name = upgradeLevel <= 0
        ? def.name
        : card.defId === 'SEARING_BLOW'
            ? `${def.name}+${upgradeLevel}`
            : (def.upgrade?.name ?? `${def.name}+`)

    const baseDamage = card.defId === 'SEARING_BLOW'
        ? searingBlowDamage(upgradeLevel)
        : upgradeLevel > 0
            ? (def.upgrade?.baseDamage ?? def.baseDamage)
            : def.baseDamage

    const baseBlock = upgradeLevel > 0 ? (def.upgrade?.baseBlock ?? def.baseBlock) : def.baseBlock
    const cost = upgradeLevel > 0 ? (def.upgrade?.cost ?? def.cost) : def.cost
    const exhaust = upgradeLevel > 0 ? (def.upgrade?.exhaust ?? def.exhaust ?? false) : (def.exhaust ?? false)
    const xCost = upgradeLevel > 0 ? (def.upgrade?.xCost ?? def.xCost ?? false) : (def.xCost ?? false)
    const unplayable = upgradeLevel > 0 ? (def.upgrade?.unplayable ?? def.unplayable ?? false) : (def.unplayable ?? false)
    const ethereal = upgradeLevel > 0 ? (def.upgrade?.ethereal ?? def.ethereal ?? false) : (def.ethereal ?? false)

    return {
        ...def,
        targeting: (upgradeLevel > 0 ? def.upgrade?.targeting : undefined) ?? def.targeting ?? { type: 'none' },
        name,
        cost,
        exhaust,
        xCost,
        unplayable,
        ethereal,
        innate: !!card.bottled || (upgradeLevel > 0 ? (def.upgrade?.innate ?? def.innate) : def.innate),
        retain: upgradeLevel > 0 ? (def.upgrade?.retain ?? def.retain) : def.retain,
        baseDamage: card.permanentDamage ?? baseDamage,
        baseBlock,
    }
}

export function isCurseCard(card: CardInstance | { defId: string }): boolean {
    return CARD_DEFS[card.defId]?.type === 'curse'
}

export function isCollectibleCard(id: string): boolean {
    const card = CARD_DEFS[id]
    return Boolean(card?.poolEnabled && card.type !== 'status' && card.type !== 'curse')
}

export function getUnlockedCollectibleCards(meta: MetaState, rarity?: CardDef['rarity'], character: CharacterId = 'ironclad'): string[] {
    return selectCardPool({ character, meta, rarity, source: 'reward' })
}

export function canRemoveCard(card: CardInstance): boolean {
    return !card.bottled && CARD_DEFS[card.defId]?.removable !== false
}

export const RANDOM_CURSE_IDS = ['CLUMSY', 'DECAY', 'DOUBT', 'INJURY', 'NORMALITY', 'PAIN', 'PARASITE', 'REGRET', 'SHAME', 'WRITHE']
