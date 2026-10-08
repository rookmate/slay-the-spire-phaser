import type { Action, EntityId } from './actions'

export type CardType = 'attack' | 'skill' | 'power' | 'status' | 'curse'
export type ChoiceZone = 'hand' | 'discard' | 'exhaust'
export type CardDestination = 'hand' | 'drawPile' | 'drawPileTop' | 'discardPile' | 'exhaustPile'

export type PowerId =
    | 'CONSTRICTED' | 'INVINCIBLE'
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

export interface CardInstance {
    instanceId: string
    defId: string
    upgradeLevel: number
    costForCombat?: number
    costForTurn?: number
    confusedCost?: number
}

export interface PendingChoiceView {
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

export interface CardChoiceRequest extends PendingChoiceView {
    onSubmit: (instanceIds: string[]) => void
    onCancel?: () => void
}

export interface CardEngineApi {
    state: CombatState
    enqueue: (a: Action) => void
    playTopCard?: () => void
    setDoubleTapCharges?: (charges: number) => void
    modifyOutgoingAttackDamageFromPlayer?: (base: number, cardInstanceId?: string) => number
    handleExhaustFromHand?: (card: CardInstance) => void
    handleExhaust?: (card: CardInstance) => void
    addTemporaryThorns?: (amount: number) => void
    beginChoice?: (choice: CardChoiceRequest) => void
    deferChoice?: (startChoice: () => void) => void
    getCardsInZone?: (zone: ChoiceZone) => CardInstance[]
    moveCardToDestination?: (instanceId: string, zone: ChoiceZone, destination: CardDestination) => CardInstance | undefined
    createCardsInDestination?: (defId: string, destination: Exclude<CardDestination, 'drawPileTop' | 'exhaustPile'>, count?: number, upgradeLevel?: number) => CardInstance[]
    upgradeCardInstance?: (instanceId: string, zones?: ChoiceZone[]) => CardInstance | undefined
    getLimboCard?: () => CardInstance | undefined
    randomInt?: (min: number, max: number) => number
    copyCardToHand?: (instanceId: string, count?: number) => CardInstance[]
    exhaustCardsInHand?: (predicate: (card: CardInstance) => boolean) => CardInstance[]
    getCardCombatBonusDamage?: (instanceId: string) => number
    modifyCardCombatBonusDamage?: (instanceId: string, delta: number) => number
}

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
    onExhaust?: (ctx: {
        engine: CardEngineApi
        card: CardInstance
    }) => void
}

export interface PlayerState {
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
    player: PlayerState
    enemies: EnemyState[]
    turn: 'player' | 'enemy'
    victory: boolean
    defeat: boolean
    limbo: LimboCardState[]
    cardRuntime: Record<string, { bonusDamage?: number; triggered?: boolean }>
    facingEnemyId?: string
    hpLossCount?: number
    cardsPlayed?: number
    turnNumber?: number
}
