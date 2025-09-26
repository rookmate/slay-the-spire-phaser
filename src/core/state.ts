import type { EntityId } from './actions'

export type CardType = 'attack' | 'skill' | 'power'

export type PowerId = 'VULNERABLE' | 'WEAK'

export interface PowerInstance {
    id: PowerId
    stacks: number
}

export interface CardDef {
    id: string
    name: string
    type: CardType
    cost: number
    baseDamage?: number
    baseBlock?: number
    onPlay?: (ctx: {
        engine: { enqueue: (a: any) => void; state: CombatState }
        source: EntityId
        targets: EntityId[]
        card: CardInstance
    }) => void
}

export interface CardInstance {
    defId: string
    upgraded: boolean
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

export interface EnemyState {
    id: EntityId
    name: string
    maxHp: number
    hp: number
    block: number
    powers: PowerInstance[]
    intent?: { kind: 'attack' | 'block'; amount: number }
}

export interface CombatState {
    player: PlayerState
    enemies: EnemyState[]
    turn: 'player' | 'enemy'
    victory: boolean
    defeat: boolean
}


