import { RNG } from './rng'
import { CARD_DEFS } from './cards'
import type { Action, EmittedEvent, EntityId } from './actions'
import type { CombatState, CardInstance, PlayerState, EnemyState } from './state'

export class Engine {
    readonly rng: RNG
    readonly state: CombatState
    private queue: Action[] = []

    constructor(seed: string, player: PlayerState, enemies: EnemyState[]) {
        this.rng = new RNG(seed)
        this.state = {
            player,
            enemies,
            turn: 'player',
            victory: false,
            defeat: false,
        }
    }

    enqueue(a: Action): void {
        this.queue.push(a)
    }

    step(): EmittedEvent[] {
        const evts: EmittedEvent[] = []
        const action = this.queue.shift()
        if (!action) return evts
        switch (action.kind) {
            case 'GainEnergy': {
                this.state.player.energy += action.amount
                evts.push({ kind: 'EnergyChanged', energy: this.state.player.energy })
                break
            }
            case 'DrawCards': {
                for (let i = 0; i < action.count; i++) this.drawOne()
                break
            }
            case 'DealDamage': {
                const target = this.getEntity(action.target)
                if (!target) break
                let remaining = action.amount
                const blockUsed = Math.min(target.block, remaining)
                target.block -= blockUsed
                remaining -= blockUsed
                if (remaining > 0) target.hp = Math.max(0, target.hp - remaining)
                evts.push({ kind: 'DamageApplied', source: action.source, target: action.target, amount: action.amount, resultingHp: target.hp, resultingBlock: target.block })
                this.checkWinLose(evts)
                break
            }
            case 'GainBlock': {
                const target = this.getEntity(action.target)
                if (!target) break
                target.block += action.amount
                evts.push({ kind: 'BlockGained', target: action.target, amount: action.amount, resultingBlock: target.block })
                break
            }
            case 'DiscardHand': {
                this.state.player.discardPile.push(...this.state.player.hand)
                this.state.player.hand = []
                break
            }
            case 'EndTurn': {
                if (this.state.turn === 'player') {
                    this.enqueue({ kind: 'DiscardHand' })
                    this.state.turn = 'enemy'
                    evts.push({ kind: 'TurnChanged', turn: 'enemy' })
                    // simple enemy: all enemies attack for fixed damage if alive
                    for (const enemy of this.state.enemies) {
                        if (enemy.hp > 0) {
                            this.enqueue({ kind: 'DealDamage', source: enemy.id, target: this.state.player.id, amount: 5 })
                        }
                    }
                    // end enemy turn
                    this.enqueue({ kind: 'EndTurn' })
                } else {
                    this.state.turn = 'player'
                    this.state.player.energy = 3
                    for (const enemy of this.state.enemies) enemy.block = 0
                    this.enqueue({ kind: 'DrawCards', count: 5 })
                    evts.push({ kind: 'TurnChanged', turn: 'player' })
                }
                break
            }
        }
        return evts
    }

    runUntilIdle(): EmittedEvent[] {
        const all: EmittedEvent[] = []
        while (this.queue.length > 0) {
            all.push(...this.step())
            if (this.state.victory || this.state.defeat) break
        }
        return all
    }

    playCard(card: CardInstance, targetIds: EntityId[]): EmittedEvent[] {
        const def = CARD_DEFS[card.defId]
        if (!def) return []
        if (this.state.player.energy < def.cost) return []
        this.state.player.energy -= def.cost
        const events: EmittedEvent[] = [{ kind: 'EnergyChanged', energy: this.state.player.energy }]
        // remove card from hand: take first match
        const idx = this.state.player.hand.findIndex(c => c === card)
        if (idx >= 0) this.state.player.hand.splice(idx, 1)
        if (def.baseDamage) {
            const target = targetIds[0]
            this.enqueue({ kind: 'DealDamage', source: this.state.player.id, target, amount: def.baseDamage })
        }
        if (def.baseBlock) {
            this.enqueue({ kind: 'GainBlock', target: this.state.player.id, amount: def.baseBlock })
        }
        return events
    }

    private drawOne(): void {
        const p = this.state.player
        if (p.drawPile.length === 0) {
            if (p.discardPile.length === 0) return
            this.rng.shuffleInPlace(p.discardPile)
            p.drawPile.push(...p.discardPile)
            p.discardPile = []
        }
        const card = p.drawPile.shift()!
        p.hand.push(card)
    }

    private getEntity(id: EntityId): PlayerState | EnemyState | undefined {
        if (id === this.state.player.id) return this.state.player
        return this.state.enemies.find(e => e.id === id)
    }

    private checkWinLose(events: EmittedEvent[]): void {
        if (this.state.player.hp <= 0) {
            this.state.defeat = true
            events.push({ kind: 'Defeat' })
            return
        }
        if (this.state.enemies.every(e => e.hp <= 0)) {
            this.state.victory = true
            events.push({ kind: 'Victory' })
        }
    }
}

export function createSimplePlayer(seed: string): PlayerState {
    const deck: CardInstance[] = []
    for (let i = 0; i < 5; i++) deck.push({ defId: 'STRIKE', upgraded: false })
    for (let i = 0; i < 5; i++) deck.push({ defId: 'DEFEND', upgraded: false })
    deck.push({ defId: 'BASH', upgraded: false })
    const rng = new RNG(seed)
    rng.shuffleInPlace(deck)
    const drawPile = [...deck]
    const player: PlayerState = {
        id: 'player',
        maxHp: 80,
        hp: 80,
        block: 0,
        energy: 3,
        deck,
        drawPile,
        discardPile: [],
        exhaustPile: [],
        hand: [],
    }
    return player
}

export function createDummyEnemy(id: string): EnemyState {
    return { id, name: 'Slime', maxHp: 40, hp: 40, block: 0 }
}


