import type { OrbState, OrbType, StanceId } from './combat/resources'
import type { PowerId } from './state'

export type EntityId = string
export type DamageType = 'attack' | 'effect' | 'thorns'
export type BlockSource = 'card' | 'effect'

export type Action =
    | { kind: 'SetHp'; target: EntityId; hp: number }
    | { kind: 'StartPlayerTurn'; extra?: boolean }
    | { kind: 'AutoPlayCard'; cardInstanceId: string; zone: import('./state').ChoiceZone; repeats?: number; exhaust?: boolean; allowPendingTurnEnd?: boolean }
    | { kind: 'CardEffect'; resolve: () => void }
    | { kind: 'OrbPassives'; phase: 'start' | 'end' }
    | { kind: 'ChannelOrb'; orbType: OrbType; storedDamage?: number }
    | { kind: 'EvokeOrb'; repeats?: number; remove?: boolean }
    | { kind: 'TriggerOrb'; orb: OrbState; mode: 'passive' | 'evoke' }
    | { kind: 'ChangeOrbSlots'; amount: number }
    | { kind: 'ChangeStance'; stance: StanceId }
    | { kind: 'GainEnergy'; amount: number }
    | { kind: 'DrawCards'; count: number }
    | { kind: 'DealDamage'; origin?: 'card' | 'orb' | 'poison' | 'relic' | 'power'; source: EntityId; target: EntityId; amount: number; damageType?: DamageType; lifestealTo?: EntityId; blockOnDamage?: boolean; fromCard?: boolean; sourceCardInstanceId?: string }
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
    | { kind: 'PlayTopCard'; exhaust?: boolean }
    | { kind: 'ApplyPower'; target: EntityId; powerId: PowerId; stacks: number }
    | { kind: 'LoseHp'; target: EntityId; amount: number; fromCard?: boolean }
    | { kind: 'ExhaustCard'; owner: EntityId; cardInstanceId?: string }

export type EmittedEvent =
    | { kind: 'OrbChanneled'; orbType: OrbType }
    | { kind: 'StanceChanged'; stance: StanceId }
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
