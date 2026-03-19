import type { PowerId } from './state'

export type EntityId = string

export type Action =
    | { kind: 'GainEnergy'; amount: number }
    | { kind: 'DrawCards'; count: number }
    | { kind: 'DealDamage'; source: EntityId; target: EntityId; amount: number; damageType?: 'attack' | 'thorns'; lifestealTo?: EntityId }
    | { kind: 'Heal'; target: EntityId; amount: number }
    | { kind: 'GainBlock'; target: EntityId; amount: number }
    | { kind: 'DiscardHand' }
    | { kind: 'EndTurn' }
    | { kind: 'ApplyPower'; target: EntityId; powerId: PowerId; stacks: number }
    | { kind: 'LoseHp'; target: EntityId; amount: number }
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
