import type { PowerId } from './state'

export type EntityId = string
export type DamageType = 'attack' | 'effect' | 'thorns'
export type BlockSource = 'card' | 'effect'

export type Action =
    | { kind: 'GainEnergy'; amount: number }
    | { kind: 'DrawCards'; count: number }
    | { kind: 'DealDamage'; source: EntityId; target: EntityId; amount: number; damageType?: DamageType; lifestealTo?: EntityId; fromCard?: boolean; sourceCardInstanceId?: string }
    | { kind: 'RandomAttack'; source: EntityId; amount: number; sourceCardInstanceId: string }
    | { kind: 'DealMultiDamage'; source: EntityId; target: EntityId; amount: number; hits: number; damageType?: DamageType; sourceCardInstanceId?: string }
    | { kind: 'Heal'; target: EntityId; amount: number }
    | { kind: 'GainBlock'; target: EntityId; amount: number; blockSource?: BlockSource }
    | { kind: 'DiscardHand' }
    | { kind: 'EndTurn' }
    | { kind: 'StartEnemyTurn' }
    | { kind: 'EnemyMove'; enemyId: EntityId }
    | { kind: 'EnemyMoveFinished'; enemyId: EntityId }
    | { kind: 'EnemyEffect'; enemyId: EntityId; effect: import('./state').EnemyEffect }
    | { kind: 'PlayTopCard' }
    | { kind: 'ApplyPower'; target: EntityId; powerId: PowerId; stacks: number }
    | { kind: 'LoseHp'; target: EntityId; amount: number; fromCard?: boolean }
    | { kind: 'ExhaustCard'; owner: EntityId; cardInstanceId?: string }

export type EmittedEvent =
    | { kind: 'EnergyChanged'; energy: number }
    | { kind: 'CardDrawn' }
    | { kind: 'DamageApplied'; source: EntityId; target: EntityId; amount: number; actualDamage: number; resultingHp: number; resultingBlock: number }
    | { kind: 'Healed'; target: EntityId; amount: number; resultingHp: number }
    | { kind: 'BlockGained'; target: EntityId; amount: number; resultingBlock: number }
    | { kind: 'TurnChanged'; turn: 'player' | 'enemy' }
    | { kind: 'CardPlayed'; cardId: string; instanceId: string }
    | { kind: 'Victory' }
    | { kind: 'Defeat' }
    | { kind: 'PowerApplied'; target: EntityId; powerId: PowerId; stacks: number }
    | { kind: 'HpLost'; target: EntityId; amount: number; resultingHp: number }
    | { kind: 'CardExhausted'; owner: EntityId; cardId: string; instanceId: string }
