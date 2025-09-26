import { RNG } from './rng'
import { CARD_DEFS } from './cards'
import type { Action, EmittedEvent, EntityId } from './actions'
import type { CombatState, CardInstance, PlayerState, EnemyState, PowerInstance } from './state'

export class Engine {
    readonly rng: RNG
    readonly state: CombatState
    private queue: Action[] = []
    private ascension: number

    constructor(seed: string, player: PlayerState, enemies: EnemyState[], opts?: { asc?: number }) {
        this.rng = new RNG(seed)
        this.state = {
            player,
            enemies,
            turn: 'player',
            victory: false,
            defeat: false,
        }
        this.ascension = opts?.asc ?? 0
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
                let damage = action.amount
                // apply WEAK on source (reduces outgoing damage)
                const src = this.getEntity(action.source)
                if (src) {
                    const weakStacks = src.powers.find(p => p.id === 'WEAK')?.stacks ?? 0
                    if (weakStacks > 0) damage = Math.round(damage * 0.75)
                }
                // apply Vulnerable if target is player? Vulnerable increases damage taken by 50%
                damage = this.modifyIncomingDamage(target, damage)
                let remaining = damage
                const blockUsed = Math.min(target.block, remaining)
                target.block -= blockUsed
                remaining -= blockUsed
                if (remaining > 0) target.hp = Math.max(0, target.hp - remaining)
                evts.push({ kind: 'DamageApplied', source: action.source, target: action.target, amount: Math.round(damage), resultingHp: target.hp, resultingBlock: target.block })
                this.checkWinLose(evts)
                break
            }
            case 'LoseHp': {
                const target = this.getEntity(action.target)
                if (!target) break
                target.hp = Math.max(0, target.hp - action.amount)
                evts.push({ kind: 'HpLost', target: action.target, amount: action.amount, resultingHp: target.hp })
                this.checkWinLose(evts)
                break
            }
            case 'GainBlock': {
                const target = this.getEntity(action.target)
                if (!target) break
                target.block += action.amount
                evts.push({ kind: 'BlockGained', target: action.target, amount: action.amount, resultingBlock: target.block })
                if (target === this.state.player) {
                    const jug = this.state.player.powers.find(p => p.id === 'JUGGERNAUT')?.stacks ?? 0
                    if (jug > 0) {
                        const living = this.state.enemies.filter(e => e.hp > 0)
                        if (living.length > 0) {
                            const pick = living[this.rng.int(0, living.length - 1)]
                            this.enqueue({ kind: 'DealDamage', source: this.state.player.id, target: pick.id, amount: 5 * jug })
                        }
                    }
                }
                break
            }
            case 'ApplyPower': {
                const target = this.getEntity(action.target)
                if (!target) break
                const existing = target.powers.find(p => p.id === action.powerId)
                if (existing) existing.stacks += action.stacks
                else target.powers.push({ id: action.powerId, stacks: action.stacks } as PowerInstance)
                evts.push({ kind: 'PowerApplied', target: action.target, powerId: action.powerId, stacks: action.stacks })
                break
            }
            case 'ExhaustCard': {
                const owner = this.getEntity(action.owner)
                if (!owner || owner.id !== this.state.player.id) break
                const p = this.state.player
                if (action.cardId) {
                    const idx = p.hand.findIndex(c => c.defId === action.cardId)
                    if (idx >= 0) {
                        const [c] = p.hand.splice(idx, 1)
                        this.handleExhaust(c)
                        evts.push({ kind: 'CardExhausted', owner: owner.id, cardId: c.defId })
                    }
                } else if (p.hand.length > 0) {
                    const c = p.hand.pop()!
                    this.handleExhaust(c)
                    evts.push({ kind: 'CardExhausted', owner: owner.id, cardId: c.defId })
                }
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
                    // end of player turn hooks
                    this.onEndOfPlayerTurn()
                    // enemies execute intents
                    for (const enemy of this.state.enemies) {
                        if (enemy.hp > 0) {
                            if (enemy.intent?.kind === 'attack') {
                                const scaled = Math.round(enemy.intent.amount * this.enemyDamageMultiplier())
                                this.enqueue({ kind: 'DealDamage', source: enemy.id, target: this.state.player.id, amount: scaled })
                            } else if (enemy.intent?.kind === 'block') {
                                const scaled = Math.round(enemy.intent.amount * this.enemyBlockMultiplier())
                                this.enqueue({ kind: 'GainBlock', target: enemy.id, amount: scaled })
                            } else {
                                this.enqueue({ kind: 'DealDamage', source: enemy.id, target: this.state.player.id, amount: 5 })
                            }
                        }
                    }
                    // end enemy turn
                    this.enqueue({ kind: 'EndTurn' })
                } else {
                    this.state.turn = 'player'
                    this.state.player.energy = 3
                    // Barricade: keep block; otherwise clear enemy blocks
                    for (const enemy of this.state.enemies) enemy.block = 0
                    // start of player turn hooks
                    this.onStartOfPlayerTurn()
                    // roll next intents (attack 5-10 or block 5-10)
                    for (const enemy of this.state.enemies) {
                        const amt = this.rng.int(5, 10)
                        enemy.intent = this.rng.random() < 0.7 ? { kind: 'attack', amount: amt } : { kind: 'block', amount: amt }
                    }
                    const toDraw = Math.max(0, 5 - this.state.player.hand.length)
                    if (toDraw > 0) this.enqueue({ kind: 'DrawCards', count: toDraw })
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
        const hasCorruption = this.state.player.powers.find(p => p.id === 'CORRUPTION')?.stacks ?? 0
        const isSkill = def.type === 'skill'
        const effectiveCost = hasCorruption > 0 && isSkill ? 0 : def.cost
        if (this.state.player.energy < effectiveCost) return []
        if (def.canPlay) {
            const ok = def.canPlay({ engine: this as unknown as any, source: this.state.player.id, targets: targetIds, card })
            if (!ok) return []
        }
        this.state.player.energy -= effectiveCost
        const events: EmittedEvent[] = [{ kind: 'EnergyChanged', energy: this.state.player.energy }]
        const idx = this.state.player.hand.findIndex(c => c === card)
        if (idx >= 0) this.state.player.hand.splice(idx, 1)
        const shouldExhaust = !!def.exhaust || (hasCorruption > 0 && isSkill)
        if (shouldExhaust) this.state.player.exhaustPile.push(card)
        else this.state.player.discardPile.push(card)
        const perform = () => {
            if (def.onPlay) {
                def.onPlay({ engine: this as unknown as any, source: this.state.player.id, targets: targetIds, card })
            } else {
                if (def.baseDamage) {
                    const target = targetIds[0]
                    const amount = this.applyStrengthToOutgoing(def.baseDamage)
                    this.enqueue({ kind: 'DealDamage', source: this.state.player.id, target, amount })
                }
                if (def.baseBlock) {
                    this.enqueue({ kind: 'GainBlock', target: this.state.player.id, amount: def.baseBlock })
                }
            }
        }
        perform()
        if ((this as any)._doubleTap && def.type === 'attack') {
            perform()
                ; (this as any)._doubleTap = false
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

    computeDamage(target: EntityId, base: number): number {
        const t = this.getEntity(target)
        if (!t) return base
        let amount = base
        const vulnerable = t.powers.find(p => p.id === 'VULNERABLE')?.stacks ?? 0
        if (vulnerable > 0) amount = Math.round(amount * 1.5)
        return amount
    }

    private modifyIncomingDamage(target: PlayerState | EnemyState, amount: number): number {
        const vulnerable = target.powers.find(p => p.id === 'VULNERABLE')?.stacks ?? 0
        let result = amount
        if (vulnerable > 0) result = Math.round(result * 1.5)
        if (target === this.state.player) result = Math.round(result * this.enemyDamageMultiplier())
        return result
    }

    modifyOutgoingDamageFromPlayer(base: number): number {
        let amount = base
        // Strength increases outgoing damage by Strength stacks
        const strength = this.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
        amount += strength
        // WEAK reduces outgoing damage by 25%
        const weak = this.state.player.powers.find(p => p.id === 'WEAK')?.stacks ?? 0
        if (weak > 0) amount = Math.round(amount * 0.75)
        return amount
    }

    private applyStrengthToOutgoing(base: number): number {
        return this.modifyOutgoingDamageFromPlayer(base)
    }

    private enemyDamageMultiplier(): number {
        if (this.ascension >= 1) return 1.2
        return 1
    }

    private enemyBlockMultiplier(): number {
        if (this.ascension >= 1) return 1.2
        return 1
    }

    // Hooks and helpers
    onStartOfPlayerTurn(): void {
        const p = this.state.player
        // Demon Form: gain Strength each turn
        const demonForm = p.powers.find(pr => pr.id === 'DEMON_FORM')?.stacks ?? 0
        if (demonForm > 0) this.enqueue({ kind: 'ApplyPower', target: p.id, powerId: 'STRENGTH', stacks: demonForm })
        // Metallicize: gain Block each end of turn (handled in end-of-turn)
        // Brutality: lose 1 HP and draw 1 card at start of turn
        const brutality = p.powers.find(pr => pr.id === 'BRUTALITY')?.stacks ?? 0
        if (brutality > 0) {
            this.enqueue({ kind: 'LoseHp', target: p.id, amount: brutality })
            this.enqueue({ kind: 'DrawCards', count: brutality })
        }
        // Berserk: gain Energy at start of player turn if active
        const berserk = p.powers.find(pr => pr.id === 'BERSERK')?.stacks ?? 0
        if (berserk > 0) this.enqueue({ kind: 'GainEnergy', amount: berserk })
    }

    onEndOfPlayerTurn(): void {
        const p = this.state.player
        // Metallicize: gain block equal to stacks
        const metallicize = p.powers.find(pr => pr.id === 'METALLICIZE')?.stacks ?? 0
        if (metallicize > 0) this.enqueue({ kind: 'GainBlock', target: p.id, amount: metallicize })
    }

    handleExhaust(card: CardInstance): void {
        const p = this.state.player
        p.exhaustPile.push(card)
        // Feel No Pain: gain block on exhaust
        const fnp = p.powers.find(pr => pr.id === 'FEEL_NO_PAIN')?.stacks ?? 0
        if (fnp > 0) this.enqueue({ kind: 'GainBlock', target: p.id, amount: fnp * 3 })
        // Dark Embrace: draw on exhaust
        const de = p.powers.find(pr => pr.id === 'DARK_EMBRACE')?.stacks ?? 0
        if (de > 0) this.enqueue({ kind: 'DrawCards', count: de })
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
        powers: [],
    }
    return player
}

export function createDummyEnemy(id: string): EnemyState {
    return { id, name: 'Slime', maxHp: 40, hp: 40, block: 0, powers: [], intent: { kind: 'attack', amount: 5 } }
}

export function createPlayerFromDeck(seed: string, deck: CardInstance[], hp: number, maxHp: number): PlayerState {
    const rng = new RNG(seed)
    const fullDeck = [...deck]
    rng.shuffleInPlace(fullDeck)
    const drawPile = [...fullDeck]
    return {
        id: 'player',
        maxHp,
        hp,
        block: 0,
        energy: 3,
        deck: fullDeck,
        drawPile,
        discardPile: [],
        exhaustPile: [],
        hand: [],
        powers: [],
    }
}


