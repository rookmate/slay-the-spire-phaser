import type { Engine } from './engine'
import type { CharacterId } from './characters'
import type { OrbState, OrbType, StanceId } from './combat/resources'
import type { Action, EntityId } from './actions'

export type CardType = 'attack' | 'skill' | 'power' | 'status' | 'curse'
export type ChoiceZone = 'hand' | 'discard' | 'exhaust' | 'draw' | 'offer'
export type CardDestination = 'hand' | 'drawPile' | 'drawPileTop' | 'drawPileBottom' | 'discardPile' | 'exhaustPile'

export type PowerId =
    | 'MAGNETISM' | 'MAYHEM' | 'PANACHE' | 'SADISTIC_NATURE' | 'NO_BLOCK'
    | 'BATTLE_HYMN' | 'BLASPHEMER' | 'COLLECT' | 'DEVA_FORM' | 'DEVOTION' | 'FASTING' | 'FORESIGHT'
    | 'LIKE_WATER' | 'MASTER_REALITY' | 'NIRVANA' | 'OMEGA' | 'STUDY' | 'SIMMERING_FURY'
    | 'MARK' | 'TALK_TO_THE_HAND' | 'WAVE_OF_THE_HAND' | 'WREATH_OF_FLAME'
    | 'AMPLIFY' | 'ECHO_FORM' | 'DUPLICATION' | 'REBOUND' | 'BIASED_COGNITION' | 'CREATIVE_AI' | 'HELLO_WORLD'
    | 'LOOP' | 'MACHINE_LEARNING' | 'SELF_REPAIR' | 'STATIC_DISCHARGE' | 'STORM' | 'HEATSINKS'
    | 'ACCURACY' | 'AFTER_IMAGE' | 'THOUSAND_CUTS' | 'ENVENOM' | 'INFINITE_BLADES' | 'NOXIOUS_FUMES'
    | 'TOOLS_OF_THE_TRADE' | 'WELL_LAID_PLANS' | 'WRAITH_FORM' | 'CORPSE_EXPLOSION' | 'CHOKE'
    | 'BLUR' | 'BLOCK_NEXT_TURN' | 'ENERGY_NEXT_TURN' | 'DRAW_NEXT_TURN' | 'BURST'
    | 'PHANTASMAL_KILLER' | 'DOUBLE_DAMAGE' | 'STRENGTH_UP_NEXT_TURN' | 'BUFFER' | 'REGENERATION'
    | 'EQUILIBRIUM' | 'ESTABLISHMENT' | 'DEXTERITY_DOWN' | 'FREE_ATTACK'
    | 'FOCUS' | 'ELECTRODYNAMICS' | 'LOCK_ON' | 'MENTAL_FORTRESS' | 'RUSHDOWN' | 'MANTRA' | 'POISON'
    | 'DOUBLE_TAP'
    | 'SLOW' | 'CONSTRICTED' | 'INVINCIBLE'
    | 'RITUAL' | 'CONFUSION' | 'HEX' | 'ENTANGLED' | 'DRAW_REDUCTION'
    | 'PLATED_ARMOR' | 'REGENERATE' | 'INTANGIBLE' | 'RUPTURE' | 'CURL_UP'
    | 'FRAIL'
    | 'ARTIFACT'
    | 'NO_DRAW'
    | 'COMBUST_HP_LOSS'
    | 'VULNERABLE'
    | 'WEAK'
    | 'STRENGTH'
    | 'DEXTERITY'
    | 'THORNS'
    | 'BARRICADE'
    | 'METALLICIZE'
    | 'DEMON_FORM'
    | 'CORRUPTION'
    | 'FEEL_NO_PAIN'
    | 'JUGGERNAUT'
    | 'DARK_EMBRACE'
    | 'BRUTALITY'
    | 'BERSERK'
    | 'RAGE'
    | 'EVOLVE'
    | 'FIRE_BREATHING'
    | 'COMBUST'
    | 'STRENGTH_DOWN_NEXT_TURN'

export interface PowerInstance {
    id: PowerId
    stacks: number
    fresh?: boolean
}

export interface CombatCardRuntime {
    bonusDamage?: number
    bonusBlock?: number
    triggered?: boolean
    hpLossCount?: number
    confusedCostOffset?: number
}

export interface CardInstance {
    instanceId: string
    defId: string
    upgradeLevel: number
    storedHits?: number
    bottled?: boolean | import('./run').RelicId
    permanentDamage?: number
    permanentBlock?: number
    costUntilPlayed?: number
    retained?: boolean
    costForCombat?: number
    costForTurn?: number
    confusedCost?: number
}

export interface PendingChoiceView {
    id: number
    cards?: CardInstance[]
    prompt: string
    zone: ChoiceZone
    eligibleInstanceIds: string[]
    minSelections: number
    maxSelections: number
    canSkip: boolean
    sourceCardInstanceId: string
}

export interface PendingChoice extends PendingChoiceView {}

export interface LimboCardState {
    card: CardInstance
    targetIds: EntityId[]
    exhaustOnResolve: boolean
    spentEnergy: number
}

export interface CardChoiceRequest extends Omit<PendingChoiceView, 'id'> {
    onSubmit: (instanceIds: string[]) => void
    onCancel?: () => void
}

export type CardEngineApi = Engine

export interface EnemyEngineApi {
    state: CombatState
    enqueue: (a: Action) => void
    spawnEnemies: (enemies: EnemyState[]) => void
    removeEnemy: (enemyId: EntityId) => void
    createCardsInDestination: (defId: string, destination: Exclude<CardDestination, 'drawPileTop' | 'exhaustPile'>, count?: number, upgradeLevel?: number) => CardInstance[]
    countLivingEnemies: () => number
    countLivingNonMinions: () => number
    gainBlock: (target: EntityId, amount: number) => void
    applyPowerToPlayer: (powerId: PowerId, stacks: number) => void
}

export type CardColor = 'ironclad' | 'silent' | 'defect' | 'watcher' | 'colorless'

export interface CardDef {
    color?: CardColor
    id: string
    name: string
    type: CardType
    cost: number
    description?: (card: CardInstance) => string
    damage?: (ctx: { card: CardInstance; player: PlayerState }) => number
    baseDamage?: number
    baseBlock?: number
    // Optional rarity metadata used by UI/builders; not used by engine rules
    rarity?: 'basic' | 'common' | 'uncommon' | 'rare'
    implemented?: boolean
    poolEnabled?: boolean
    exhaust?: boolean
    xCost?: boolean
    unplayable?: boolean
    innate?: boolean
    retain?: boolean
    ethereal?: boolean
    upgrade?: {
        targeting?: CardDef['targeting']
        name?: string
        cost?: number
        baseDamage?: number
        baseBlock?: number
        exhaust?: boolean
        xCost?: boolean
        unplayable?: boolean
        innate?: boolean
        retain?: boolean
        ethereal?: boolean
    }

    targeting?: {
        type: 'none' | 'single_enemy' | 'all_enemies' | 'player' | 'any'
        required?: boolean
        description?: string
    }

    canPlay?: (ctx: {
        engine: CardEngineApi
        source: EntityId
        targets: EntityId[]
        card: CardInstance
    }) => boolean
    onPlay?: (ctx: {
        engine: CardEngineApi
        source: EntityId
        targets: EntityId[]
        card: CardInstance
        spentEnergy: number
    }) => void
    dynamicCostScope?: 'turn'
    dynamicCost?: (ctx: { engine: CardEngineApi; card: CardInstance; cost: number }) => number
    onDraw?: (ctx: { engine: CardEngineApi; card: CardInstance }) => void
    resolveDestination?: CardDestination
    onDiscard?: (ctx: { engine: CardEngineApi; card: CardInstance }) => void
    onRetain?: (ctx: { engine: CardEngineApi; card: CardInstance }) => void
    onFatal?: (ctx: { engine: Engine; card: CardInstance }) => void
    removable?: boolean
    onExhaust?: (ctx: {
        engine: CardEngineApi
        card: CardInstance
    }) => void
}

export interface PlayerState {
    character: CharacterId
    orbs: OrbState[]
    orbSlots: number
    stance: StanceId
    id: EntityId
    maxHp: number
    hp: number
    block: number
    energy: number
    deck: CardInstance[]
    drawPile: CardInstance[]
    discardPile: CardInstance[]
    exhaustPile: CardInstance[]
    hand: CardInstance[]
    powers: PowerInstance[]
}

export type EnemyEffect =
    | { kind: 'power'; target: 'self' | 'player' | 'allies'; id: PowerId; amount: number }
    | { kind: 'block'; target: 'self' | 'allies' | 'ally'; amount: number }
    | { kind: 'cards'; id: string; destination: 'drawPile' | 'discardPile' | 'drawPileTop'; count: number; upgradeLevel?: number }
    | { kind: 'heal'; amount: number; target: 'self' | 'allies' }
    | { kind: 'cleanse' }
    | { kind: 'steal'; amount: number }
    | { kind: 'escape' }

export type EnemyIntent = (
    | { kind: 'attack'; amount: number }
    | { kind: 'multi_attack'; amount: number; hits: number }
    | { kind: 'block'; amount: number }
    | { kind: 'buff'; desc?: string }
    | { kind: 'debuff'; debuff: PowerId; stacks: number }
    | { kind: 'status'; createdDefId: string; destination: 'discardPile' | 'drawPile'; count: number }
    | { kind: 'summon'; desc?: string }
) & { effects?: EnemyEffect[]; move?: string }

export interface EnemyState {
    id: EntityId
    name: string
    maxHp: number
    hp: number
    block: number
    powers: PowerInstance[]
    intent?: EnemyIntent
    asc?: number
    escaped?: boolean
    halfDead?: boolean
    stasisCard?: CardInstance
    // Optional spec reference to drive intent generation
    specId?: string
    aiState?: Record<string, number | boolean | string>
    tags?: string[]
}

export interface CombatState {
    orbsChanneled: Record<OrbType, number>
    panacheCount?: number
    bombs?: { turns: number; damage: number }[]
    extraTurn?: boolean
    mantraGained?: number
    devaEnergy?: number
    previousCardType?: CardType
    lastCardType?: CardType
    echoRepeatsThisTurn?: number
    attacksThisTurn?: number
    powersPlayed?: number
    lastDrawnCard?: CardInstance
    nextTurnCopies?: CardInstance[]
    discardsThisTurn: number
    player: PlayerState
    enemies: EnemyState[]
    turn: 'player' | 'enemy'
    escaped?: boolean
    victory: boolean
    defeat: boolean
    limbo: LimboCardState[]
    cardRuntime: Record<string, CombatCardRuntime>
    facingEnemyId?: string
    hpLossCount?: number
    enemyDamageTaken?: number
    nonCurseCardsPlayed?: number
    scoreCombo?: boolean
    scoreOverkill?: boolean
    cardsPlayed?: number
    turnNumber?: number
}
