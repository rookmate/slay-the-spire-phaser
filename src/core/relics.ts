import { hasModifier } from './modes/modifiers'
import { RUN_EFFECT_RELICS } from './relics/runEffects'
import { changeMaxHp } from './health'
import { COMBAT_RULE_RELICS } from './relics/combatRules'
import { COMBAT_CARD_RELICS } from './relics/combatCards'
import { COMBAT_TURN_RELICS } from './relics/combatTurns'
import { COMBAT_START_RELICS } from './relics/combatStart'
import { UTILITY_RELICS } from './relics/utility'
import { STARTER_RELICS } from './relics/starters'
import { CAMPAIGN_RELICS } from './relics/campaign'
import type { RoomKind } from './map'
import type { Engine } from './engine'
import type { MetaState } from './meta'
import { getEffectiveUnlockedRelicIds } from './meta'
import type { CharacterId } from './characters'
import type { CardInstance, CombatState } from './state'
import { getAscensionMerchantRemoveBaseCost, getAscensionShopPriceMultiplier } from './ascension'
import type { RelicId, RelicStateEntry, RunState } from './run'

export interface RelicDef {
    id: RelicId
    name: string
    description: string
    rarity: 'starter' | 'common' | 'uncommon' | 'rare' | 'shop' | 'event' | 'boss'
    character?: CharacterId
    replaces?: RelicId
    onPlayerHandReady?: (ctx: RelicCombatContext) => void
    onOpeningHand?: (ctx: RelicCombatContext) => void
    onCardResolved?: (ctx: RelicCombatContext, card: CardInstance) => void
    onCardPlayed?: (ctx: RelicCombatContext, card: CardInstance) => void
    onCardDiscarded?: (ctx: RelicCombatContext) => void
    onShuffle?: (ctx: RelicCombatContext) => void
    energyPerTurn?: number
    postCombatHeal?: number
    blocksPotionGain?: boolean
    cardRewardChoiceDelta?: number
    eliteHpMultiplier?: number
    onAcquire?: (run: RunState) => void
    onCombatStart?: (ctx: RelicCombatContext) => void
    onPlayerTurnStart?: (ctx: RelicCombatContext) => void
    onPlayerTurnEnd?: (ctx: RelicCombatContext) => void
    onPlayerHpLost?: (ctx: RelicCombatContext, amount: number) => void
    onAttackPlayed?: (ctx: RelicCombatContext, cardInstanceId: string) => void
    onCardExhausted?: (ctx: RelicCombatContext, cardInstanceId: string) => void
    modifyOutgoingAttackDamage?: (ctx: RelicCombatContext, amount: number, cardInstanceId: string) => number
    preventCurseGain?: (run: RunState, curseId: string) => boolean
}

export interface RelicCombatRuntimeEntry {
    count?: number
    types?: string[]
    used?: boolean
    attackConsumed?: boolean
    turnCounter?: number
    markedCardInstanceId?: string
}

export interface RelicCombatContext {
    engine: Engine
    run: RunState
    combatState: CombatState
    runtime: Partial<Record<RelicId, RelicCombatRuntimeEntry>>
}

export interface CombatRelicBonuses {
    drawBonus: number
    energyBonus: number
    startingBlock: number
    startingStrength: number
    startingThorns: number
    eliteHpMultiplier: number
}

const COMMON_RELICS: RelicId[] = [
    'ANCHOR',
    'LANTERN',
    'VAJRA',
    'BAG_OF_PREPARATION',
    'BRONZE_SCALES',
    'STRAWBERRY',
    'OMAMORI',
    'AKABEKO',
    'ORICHALCUM',
    'CENTENNIAL_PUZZLE',
    'BAG_OF_MARBLES',
    'HAPPY_FLOWER',
    'PAPER_FROG',
    'MERCURY_HOURGLASS',
    'CHARONS_ASHES',
]

const UNCOMMON_RELICS: RelicId[] = [
    'PRESERVED_INSECT',
    'HORN_CLEAT',
]

export const RELIC_DEFS: Record<RelicId, RelicDef> = {
    ...COMBAT_START_RELICS,
    ...COMBAT_TURN_RELICS,
    ...COMBAT_CARD_RELICS,
    ...COMBAT_RULE_RELICS,
    ...RUN_EFFECT_RELICS,
    ...UTILITY_RELICS,
    ...CAMPAIGN_RELICS,
    ...STARTER_RELICS,
    BURNING_BLOOD: {
        id: 'BURNING_BLOOD', character: 'ironclad',
        name: 'Burning Blood',
        description: 'Heal 6 HP after combat.',
        rarity: 'starter',
        postCombatHeal: 6,
    },
    BLACK_BLOOD: {
        id: 'BLACK_BLOOD', character: 'ironclad', replaces: 'BURNING_BLOOD',
        name: 'Black Blood',
        description: 'Heal 12 HP after combat.',
        rarity: 'boss',
        postCombatHeal: 12,
    },
    SOZU: {
        id: 'SOZU',
        name: 'Sozu',
        description: 'Gain 1 Energy at the start of each turn. You can no longer obtain Potions.',
        rarity: 'boss',
        energyPerTurn: 1,
        blocksPotionGain: true,
    },
    BUSTED_CROWN: {
        id: 'BUSTED_CROWN',
        name: 'Busted Crown',
        description: 'Gain 1 Energy at the start of each turn. Future card rewards have 2 fewer choices.',
        rarity: 'boss',
        energyPerTurn: 1,
        cardRewardChoiceDelta: -2,
    },
    COFFEE_DRIPPER: {
        id: 'COFFEE_DRIPPER',
        name: 'Coffee Dripper',
        description: 'Gain 1 Energy at the start of each turn. You can no longer Rest at campfires.',
        rarity: 'boss',
        energyPerTurn: 1,
    },
    MARK_OF_PAIN: {
        id: 'MARK_OF_PAIN', character: 'ironclad',
        name: 'Mark of Pain',
        description: 'Gain 1 Energy at the start of each turn. At the start of combat, shuffle 2 Wounds into your draw pile.',
        rarity: 'boss',
        energyPerTurn: 1,
        onCombatStart: ({ engine }) => {
            engine.createCardsInDestination('WOUND', 'drawPile', 2)
        },
    },
    PHILOSOPHERS_STONE: {
        id: 'PHILOSOPHERS_STONE',
        name: "Philosopher's Stone",
        description: 'Gain 1 Energy at the start of each turn. All enemies start combat with 1 Strength.',
        rarity: 'boss',
        energyPerTurn: 1,
        onCombatStart: ({ engine }) => {
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: 1 })
            }
        },
    },
    ANCHOR: {
        id: 'ANCHOR',
        name: 'Anchor',
        description: 'Start each combat with 10 Block.',
        rarity: 'common',
        onCombatStart: ({ engine }) => engine.enqueue({ kind: 'GainBlock', target: engine.state.player.id, amount: 10 }),
    },
    LANTERN: {
        id: 'LANTERN',
        name: 'Lantern',
        description: 'Gain 1 Energy on turn 1.',
        rarity: 'common',
        onCombatStart: ({ engine }) => engine.enqueue({ kind: 'GainEnergy', amount: 1 }),
    },
    VAJRA: {
        id: 'VAJRA',
        name: 'Vajra',
        description: 'Start combat with 1 Strength.',
        rarity: 'common',
        onCombatStart: ({ engine }) => engine.enqueue({ kind: 'ApplyPower', target: engine.state.player.id, powerId: 'STRENGTH', stacks: 1 }),
    },
    BAG_OF_PREPARATION: {
        id: 'BAG_OF_PREPARATION',
        name: 'Bag of Preparation',
        description: 'Draw 2 additional cards at the start of combat.',
        rarity: 'common',
        onCombatStart: ({ engine }) => engine.enqueue({ kind: 'DrawCards', count: 2 }),
    },
    BRONZE_SCALES: {
        id: 'BRONZE_SCALES',
        name: 'Bronze Scales',
        description: 'Start combat with 3 Thorns.',
        rarity: 'common',
        onCombatStart: ({ engine }) => engine.configurePlayerCombatBonuses({ baseThorns: 3 + engine.getBaseThorns() }),
    },
    STRAWBERRY: {
        id: 'STRAWBERRY',
        name: 'Strawberry',
        description: 'Gain 7 Max HP.',
        rarity: 'common',
        onAcquire: (run) => {
            changeMaxHp(run, 7)
        },
    },
    PRESERVED_INSECT: {
        id: 'PRESERVED_INSECT',
        name: 'Preserved Insect',
        description: 'Elites have 25% less HP.',
        rarity: 'common',
        eliteHpMultiplier: 0.75,
    },
    OMAMORI: {
        id: 'OMAMORI',
        name: 'Omamori',
        description: 'Negate the next 2 curses you obtain.',
        rarity: 'common',
        onAcquire: (run) => setRelicCharges(run, 'OMAMORI', 2),
        preventCurseGain: (run) => {
            const charges = getRelicState(run, 'OMAMORI').charges ?? 0
            if (charges <= 0) return false
            setRelicCharges(run, 'OMAMORI', charges - 1)
            return true
        },
    },
    AKABEKO: {
        id: 'AKABEKO',
        name: 'Akabeko',
        description: 'Your first Attack each combat deals 8 additional damage.',
        rarity: 'common',
        onAttackPlayed: ({ runtime }, cardInstanceId) => {
            const entry = runtime.AKABEKO ?? (runtime.AKABEKO = {})
            if (entry.attackConsumed) { entry.markedCardInstanceId = undefined; return }
            entry.attackConsumed = true
            entry.markedCardInstanceId = cardInstanceId
        },
        modifyOutgoingAttackDamage: ({ runtime }, amount, cardInstanceId) => {
            const entry = runtime.AKABEKO
            if (!entry || entry.markedCardInstanceId !== cardInstanceId) return amount
            return amount + 8
        },
    },
    ORICHALCUM: {
        id: 'ORICHALCUM',
        name: 'Orichalcum',
        description: 'If you end your turn without Block, gain 6 Block.',
        rarity: 'common',
        onPlayerTurnEnd: ({ engine }) => {
            if (engine.state.player.block === 0) engine.enqueue({ kind: 'GainBlock', target: engine.state.player.id, amount: 6 })
        },
    },
    CENTENNIAL_PUZZLE: {
        id: 'CENTENNIAL_PUZZLE',
        name: 'Centennial Puzzle',
        description: 'The first time you lose HP each combat, draw 3 cards.',
        rarity: 'common',
        onPlayerHpLost: ({ engine, runtime }, amount) => {
            if (amount <= 0) return
            const entry = runtime.CENTENNIAL_PUZZLE ?? (runtime.CENTENNIAL_PUZZLE = {})
            if (entry.used) return
            entry.used = true
            engine.enqueue({ kind: 'DrawCards', count: 3 })
        },
    },
    BAG_OF_MARBLES: {
        id: 'BAG_OF_MARBLES',
        name: 'Bag of Marbles',
        description: 'At the start of combat, apply 1 Vulnerable to all enemies.',
        rarity: 'common',
        onCombatStart: ({ engine }) => {
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'VULNERABLE', stacks: 1 })
            }
        },
    },
    HORN_CLEAT: {
        id: 'HORN_CLEAT',
        name: 'Horn Cleat',
        description: 'At the start of turn 2, gain 14 Block.',
        rarity: 'uncommon',
        onPlayerTurnStart: ({ engine, runtime }) => {
            const entry = runtime.HORN_CLEAT ?? (runtime.HORN_CLEAT = {})
            const turn = (entry.turnCounter ?? 0) + 1
            entry.turnCounter = turn
            if (turn === 2) engine.enqueue({ kind: 'GainBlock', target: engine.state.player.id, amount: 14 })
        },
    },
    HAPPY_FLOWER: {
        id: 'HAPPY_FLOWER',
        name: 'Happy Flower',
        description: 'Every 3 turns, gain 1 Energy.',
        rarity: 'common',
        onPlayerTurnStart: ({ engine }) => {
            const entry = getRelicState(engine.run!, 'HAPPY_FLOWER')
            entry.counter = ((entry.counter ?? 0) + 1) % 3
            if (entry.counter === 0) engine.enqueue({ kind: 'GainEnergy', amount: 1 })
        },
    },
    PAPER_FROG: {
        id: 'PAPER_FROG', character: 'ironclad',
        name: 'Paper Frog',
        description: 'Enemies with Vulnerable take 75% more attack damage rather than 50%.',
        rarity: 'uncommon',
    },
    MERCURY_HOURGLASS: {
        id: 'MERCURY_HOURGLASS',
        name: 'Mercury Hourglass',
        description: 'At the start of each turn, deal 3 damage to all enemies.',
        rarity: 'uncommon',
        onPlayerTurnStart: ({ engine }) => {
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: enemy.id, amount: 3, damageType: 'effect' })
            }
        },
    },
    CHARONS_ASHES: {
        id: 'CHARONS_ASHES', character: 'ironclad',
        name: "Charon's Ashes",
        description: 'Whenever you exhaust a card, deal 3 damage to all enemies.',
        rarity: 'rare',
        onCardExhausted: ({ engine }) => {
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: enemy.id, amount: 3, damageType: 'effect' })
            }
        },
    },
}

export const MVP_RELIC_POOL: RelicId[] = [...COMMON_RELICS, ...UNCOMMON_RELICS]

export const BOSS_RELIC_POOL = (Object.keys(RELIC_DEFS) as RelicId[]).filter(id => RELIC_DEFS[id].rarity === 'boss')

export function getRelicState(run: RunState, relicId: RelicId): RelicStateEntry {
    run.relicState ??= {}
    run.relicState[relicId] ??= {}
    return run.relicState[relicId] as RelicStateEntry
}

export function setRelicCharges(run: RunState, relicId: RelicId, charges: number): void {
    const state = getRelicState(run, relicId)
    state.charges = Math.max(0, charges)
}

export function applyRelicAcquisition(run: RunState, relicId: RelicId): void {
    const replaces = RELIC_DEFS[relicId].replaces
    if (replaces) run.relics = run.relics.filter(id => id !== replaces)
    if (relicId === 'CIRCLET' && run.relics.includes(relicId)) { getRelicState(run, relicId).counter = (getRelicState(run, relicId).counter ?? 1) + 1; return }
    if (run.relics.includes(relicId)) return
    run.relics.push(relicId)
    RELIC_DEFS[relicId].onAcquire?.(run)
}

export function tryPreventCurse(run: RunState, curseId: string): boolean {
    for (const relicId of run.relics) {
        const prevented = RELIC_DEFS[relicId]?.preventCurseGain?.(run, curseId)
        if (prevented) return true
    }
    return false
}

export function createRelicCombatContext(
    engine: Engine,
    run: RunState,
    runtime: Partial<Record<RelicId, RelicCombatRuntimeEntry>>,
): RelicCombatContext {
    return { engine, run, combatState: engine.state, runtime }
}

export function triggerRelicOpeningHand(ctx: RelicCombatContext): void {
    for (const id of ctx.run.relics) if (RELIC_DEFS[id].onOpeningHand) ctx.engine.afterQueuedEffects(() => RELIC_DEFS[id].onOpeningHand!(ctx))
}
export function triggerRelicHandReady(ctx: RelicCombatContext): void {
    for (const id of ctx.run.relics) if (RELIC_DEFS[id].onPlayerHandReady) ctx.engine.afterQueuedEffects(() => RELIC_DEFS[id].onPlayerHandReady!(ctx))
}
export function triggerRelicCardResolved(ctx: RelicCombatContext, card: CardInstance): void {
    for (const id of ctx.run.relics) RELIC_DEFS[id].onCardResolved?.(ctx, card)
}
export function triggerRelicCardPlayed(ctx: RelicCombatContext, card: CardInstance): void {
    for (const id of ctx.run.relics) RELIC_DEFS[id].onCardPlayed?.(ctx, card)
}
export function triggerRelicDiscard(ctx: RelicCombatContext): void {
    for (const id of ctx.run.relics) RELIC_DEFS[id].onCardDiscarded?.(ctx)
}
export function triggerRelicShuffle(ctx: RelicCombatContext): void {
    for (const id of ctx.run.relics) RELIC_DEFS[id].onShuffle?.(ctx)
}

export function triggerRelicCombatStart(ctx: RelicCombatContext): void {
    for (const relicId of ctx.run.relics) RELIC_DEFS[relicId]?.onCombatStart?.(ctx)
}

export function triggerRelicPlayerTurnStart(ctx: RelicCombatContext): void {
    for (const relicId of ctx.run.relics) RELIC_DEFS[relicId]?.onPlayerTurnStart?.(ctx)
}

export function triggerRelicPlayerTurnEnd(ctx: RelicCombatContext): void {
    for (const relicId of ctx.run.relics) RELIC_DEFS[relicId]?.onPlayerTurnEnd?.(ctx)
}

export function triggerRelicPlayerHpLost(ctx: RelicCombatContext, amount: number): void {
    for (const relicId of ctx.run.relics) RELIC_DEFS[relicId]?.onPlayerHpLost?.(ctx, amount)
}

export function triggerRelicAttackPlayed(ctx: RelicCombatContext, cardInstanceId: string): void {
    for (const relicId of ctx.run.relics) RELIC_DEFS[relicId]?.onAttackPlayed?.(ctx, cardInstanceId)
}

export function triggerRelicCardExhausted(ctx: RelicCombatContext, cardInstanceId: string): void {
    for (const relicId of ctx.run.relics) RELIC_DEFS[relicId]?.onCardExhausted?.(ctx, cardInstanceId)
}

export function modifyAttackDamageFromRelics(ctx: RelicCombatContext, amount: number, cardInstanceId: string): number {
    let next = amount
    for (const relicId of ctx.run.relics) {
        const def = RELIC_DEFS[relicId]
        if (def?.modifyOutgoingAttackDamage) next = def.modifyOutgoingAttackDamage(ctx, next, cardInstanceId)
    }
    return next
}

export function getEncounterEliteHpMultiplier(run: RunState, roomKind: RoomKind): number {
    if (roomKind !== 'elite') return 1
    return run.relics.reduce((multiplier, relicId) => multiplier * (RELIC_DEFS[relicId]?.eliteHpMultiplier ?? 1), 1)
}

export function getCombatRelicBonuses(relics: RelicId[], roomKind: RoomKind): CombatRelicBonuses {
    return {
        drawBonus: relics.includes('BAG_OF_PREPARATION') ? 2 : 0,
        energyBonus: relics.includes('LANTERN') ? 1 : 0,
        startingBlock: relics.includes('ANCHOR') ? 10 : 0,
        startingStrength: relics.includes('VAJRA') ? 1 : 0,
        startingThorns: relics.includes('BRONZE_SCALES') ? 3 : 0,
        eliteHpMultiplier: roomKind === 'elite' && relics.includes('PRESERVED_INSECT') ? 0.75 : 1,
    }
}

export function getPostCombatHeal(run: Pick<RunState, 'relics'> | RelicId[]): number {
    const relics = Array.isArray(run) ? run : run.relics
    if (relics.includes('MARK_OF_THE_BLOOM')) return 0
    return relics.reduce((highest, relicId) => Math.max(highest, RELIC_DEFS[relicId]?.postCombatHeal ?? 0), 0)
}

export function canObtainPotion(run: Pick<RunState, 'relics' | 'potions' | 'maxPotionSlots'>): boolean {
    return !blocksPotionGain(run) && run.potions.length < run.maxPotionSlots
}

export function getRelicEnergyBonus(run: Pick<RunState, 'relics'> | RelicId[]): number {
    const relics = Array.isArray(run) ? run : run.relics
    return relics.reduce((sum, relicId) => sum + (RELIC_DEFS[relicId]?.energyPerTurn ?? 0), 0)
}

export function blocksPotionGain(run: Pick<RunState, 'relics'> | RelicId[]): boolean {
    const relics = Array.isArray(run) ? run : run.relics
    return relics.some(relicId => RELIC_DEFS[relicId]?.blocksPotionGain)
}

export function getCardRewardChoiceCount(run: Pick<RunState, 'relics'> & Partial<Pick<RunState, 'modifiers'>> | RelicId[], baseChoices = 3): number {
    const relics = Array.isArray(run) ? run : run.relics
    const delta = relics.reduce((sum, relicId) => sum + (RELIC_DEFS[relicId]?.cardRewardChoiceDelta ?? 0), 0)
    return Math.max(0, baseChoices + delta - (!Array.isArray(run) && hasModifier(run, 'BINARY') ? 1 : 0))
}

export function getShopPriceMultiplier(run: Pick<RunState, 'asc'> & Partial<Pick<RunState, 'relics'>>): number {
    return getAscensionShopPriceMultiplier(run.asc) * (run.relics?.includes('MEMBERSHIP_CARD') ? 0.5 : 1) * (run.relics?.includes('COURIER') ? 0.8 : 1)
}

export function getMerchantRemoveBaseCost(run: Pick<RunState, 'asc'>): number {
    return getAscensionMerchantRemoveBaseCost(run.asc)
}

export function canRestAtCampfire(run: Pick<RunState, 'relics'> | RelicId[]): boolean {
    const relics = Array.isArray(run) ? run : run.relics
    return !relics.includes('COFFEE_DRIPPER')
}

export function getRelicDisplayName(run: Pick<RunState, 'relicState'>, relicId: RelicId): string {
    const def = RELIC_DEFS[relicId]
    const charges = run.relicState?.[relicId]?.charges
    if (typeof charges === 'number') return `${def.name} (${charges})`
    return def.name
}

export function isRelicUnlocked(meta: MetaState, relicId: RelicId): boolean {
    return getEffectiveUnlockedRelicIds(meta).has(relicId)
}

export function getUnlockedRelicPool(meta: MetaState, rarity?: RelicDef['rarity']): RelicId[] {
    const unlocked = getEffectiveUnlockedRelicIds(meta)
    return Object.keys(RELIC_DEFS)
        .map(id => id as RelicId)
        .filter(id => RELIC_DEFS[id].rarity !== 'starter')
        .filter(id => rarity ? RELIC_DEFS[id].rarity === rarity : ['common', 'uncommon', 'rare'].includes(RELIC_DEFS[id].rarity))
        .filter(id => unlocked.has(id))
}
