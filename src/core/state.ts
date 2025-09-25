import type { EntityId } from './actions'

export type CardType = 'attack' | 'skill' | 'power'

export interface CardDef {
    id: string
    name: string
    type: CardType
    cost: number
    baseDamage?: number
    baseBlock?: number
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
}

export interface EnemyState {
    id: EntityId
    name: string
    maxHp: number
    hp: number
    block: number
}

export interface CombatState {
    player: PlayerState
    enemies: EnemyState[]
    turn: 'player' | 'enemy'
    victory: boolean
    defeat: boolean
}


