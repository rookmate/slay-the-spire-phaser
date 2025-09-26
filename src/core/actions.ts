export type EntityId = string

export type Action =
    | { kind: 'GainEnergy'; amount: number }
    | { kind: 'DrawCards'; count: number }
    | { kind: 'DealDamage'; source: EntityId; target: EntityId; amount: number }
    | { kind: 'GainBlock'; target: EntityId; amount: number }
    | { kind: 'DiscardHand' }
    | { kind: 'EndTurn' }
    | { kind: 'ApplyPower'; target: EntityId; powerId: 'VULNERABLE' | 'WEAK' | 'STRENGTH'; stacks: number }

export type EmittedEvent =
    | { kind: 'EnergyChanged'; energy: number }
    | { kind: 'CardDrawn' }
    | { kind: 'DamageApplied'; source: EntityId; target: EntityId; amount: number; resultingHp: number; resultingBlock: number }
    | { kind: 'BlockGained'; target: EntityId; amount: number; resultingBlock: number }
    | { kind: 'TurnChanged'; turn: 'player' | 'enemy' }
    | { kind: 'CardPlayed'; cardId: string }
    | { kind: 'Victory' }
    | { kind: 'Defeat' }
    | { kind: 'PowerApplied'; target: EntityId; powerId: 'VULNERABLE' | 'WEAK' | 'STRENGTH'; stacks: number }


