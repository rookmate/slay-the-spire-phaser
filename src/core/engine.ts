import { RNG } from './rng'
import { CARD_DEFS, resolveCard } from './cards'
import { onEnemyDamaged, onPlayerCardPlayed, rollEngineIntentForEnemy } from './enemies'
import { POTION_DEFS, type PotionId } from './potions'
import type { Action, EmittedEvent, EntityId } from './actions'
import type { CombatState, CardInstance, PlayerState, EnemyState, PowerInstance } from './state'

export class Engine {
    readonly rng: RNG
    readonly state: CombatState
    private queue: Action[] = []
    private ascension: number
    private doubleTapCharges = 0
    private basePlayerThorns = 0
    private temporaryThorns = 0

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

    setDoubleTapCharges(charges: number): void {
        this.doubleTapCharges = charges
    }

    configurePlayerCombatBonuses(opts: { baseThorns?: number } = {}): void {
        this.basePlayerThorns = opts.baseThorns ?? this.basePlayerThorns
        if (this.basePlayerThorns > 0) {
            this.setPowerStacks(this.state.player, 'THORNS', this.basePlayerThorns + this.temporaryThorns)
        }
    }

    addTemporaryThorns(amount: number): void {
        this.temporaryThorns += amount
        this.setPowerStacks(this.state.player, 'THORNS', this.basePlayerThorns + this.temporaryThorns)
    }

    usePotion(potionId: PotionId, targetIds: EntityId[]): EmittedEvent[] {
        const def = POTION_DEFS[potionId]
        if (!def) return []
        if (def.target === 'player' && targetIds[0] !== this.state.player.id) return []
        if (def.target === 'single_enemy' && (targetIds.length !== 1 || !this.state.enemies.find(enemy => enemy.id === targetIds[0] && enemy.hp > 0))) return []
        def.use(this, targetIds)
        return this.runUntilIdle()
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
                for (let i = 0; i < action.count; i++) {
                    if (this.drawOne()) evts.push({ kind: 'CardDrawn' })
                }
                break
            }
            case 'Heal': {
                const target = this.getEntity(action.target)
                if (!target) break
                target.hp = Math.min(target.maxHp, target.hp + action.amount)
                evts.push({ kind: 'Healed', target: action.target, amount: action.amount, resultingHp: target.hp })
                break
            }
            case 'DealDamage': {
                const target = this.getEntity(action.target)
                if (!target) break
                const source = this.getEntity(action.source)
                let damage = action.amount
                if (action.damageType !== 'thorns' && source) {
                    const weakStacks = source.powers.find(p => p.id === 'WEAK')?.stacks ?? 0
                    if (weakStacks > 0) damage = Math.round(damage * 0.75)
                }
                damage = this.modifyIncomingDamage(target, damage)
                const blockUsed = Math.min(target.block, damage)
                target.block -= blockUsed
                const actualDamage = Math.max(0, damage - blockUsed)
                if (actualDamage > 0) target.hp = Math.max(0, target.hp - actualDamage)

                evts.push({
                    kind: 'DamageApplied',
                    source: action.source,
                    target: action.target,
                    amount: Math.round(damage),
                    actualDamage,
                    resultingHp: target.hp,
                    resultingBlock: target.block,
                })

                if (action.lifestealTo && actualDamage > 0) {
                    this.enqueue({ kind: 'Heal', target: action.lifestealTo, amount: actualDamage })
                }

                if ('name' in target) onEnemyDamaged(target, actualDamage)

                if (source && action.damageType !== 'thorns') {
                    const thorns = target.powers.find(p => p.id === 'THORNS')?.stacks ?? 0
                    if (thorns > 0 && source.hp > 0 && source.id !== target.id) {
                        this.enqueue({ kind: 'DealDamage', source: target.id, target: source.id, amount: thorns, damageType: 'thorns' })
                    }
                }

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
                        const living = this.state.enemies.filter(enemy => enemy.hp > 0)
                        if (living.length > 0) {
                            const picked = living[this.rng.int(0, living.length - 1)]
                            this.enqueue({ kind: 'DealDamage', source: this.state.player.id, target: picked.id, amount: 5 * jug })
                        }
                    }
                }
                break
            }
            case 'ApplyPower': {
                const target = this.getEntity(action.target)
                if (!target) break
                const current = target.powers.find(p => p.id === action.powerId)
                if (current) current.stacks += action.stacks
                else target.powers.push({ id: action.powerId, stacks: action.stacks } as PowerInstance)
                evts.push({ kind: 'PowerApplied', target: action.target, powerId: action.powerId, stacks: action.stacks })
                break
            }
            case 'ExhaustCard': {
                const owner = this.getEntity(action.owner)
                if (!owner || owner.id !== this.state.player.id) break
                const handIndex = action.cardId ? this.state.player.hand.findIndex(card => card.defId === action.cardId) : this.state.player.hand.length - 1
                if (handIndex < 0) break
                const [card] = this.state.player.hand.splice(handIndex, 1)
                this.handleExhaust(card)
                evts.push({ kind: 'CardExhausted', owner: owner.id, cardId: card.defId })
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
                    this.doubleTapCharges = 0
                    this.onEndOfPlayerTurn()
                    this.tickTemporaryDebuffs(this.state.player)

                    for (const enemy of this.state.enemies) {
                        if (enemy.hp <= 0) continue
                        if (enemy.intent?.kind === 'attack') {
                            const enemyStrength = enemy.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
                            this.enqueue({ kind: 'DealDamage', source: enemy.id, target: this.state.player.id, amount: enemy.intent.amount + enemyStrength })
                        } else if (enemy.intent?.kind === 'block') {
                            const scaled = Math.round(enemy.intent.amount * this.enemyBlockMultiplier())
                            this.enqueue({ kind: 'GainBlock', target: enemy.id, amount: scaled })
                        } else if (enemy.intent?.kind === 'debuff') {
                            this.enqueue({ kind: 'ApplyPower', target: this.state.player.id, powerId: enemy.intent.debuff, stacks: enemy.intent.stacks })
                        } else if (enemy.intent?.kind === 'buff') {
                            const strengthGain = this.resolveEnemyBuffStrength(enemy.intent.desc)
                            if (strengthGain > 0) {
                                this.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: strengthGain })
                            }
                        }
                    }

                    this.enqueue({ kind: 'EndTurn' })
                } else {
                    for (const enemy of this.state.enemies) this.tickTemporaryDebuffs(enemy)
                    this.state.turn = 'player'
                    this.state.player.energy = 3
                    const hasBarricade = this.state.player.powers.find(p => p.id === 'BARRICADE')?.stacks ?? 0
                    if (hasBarricade === 0) this.state.player.block = 0
                    for (const enemy of this.state.enemies) enemy.block = 0
                    this.normalizePlayerThorns()
                    this.onStartOfPlayerTurn()
                    for (const enemy of this.state.enemies) {
                        if (enemy.hp <= 0) continue
                        enemy.intent = rollEngineIntentForEnemy(this.rng, enemy, this.state)
                    }
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
        const resolved = resolveCard(card)
        if (!this.validateTargets(card, targetIds)) return []
        const hasCorruption = this.state.player.powers.find(p => p.id === 'CORRUPTION')?.stacks ?? 0
        const effectiveCost = hasCorruption > 0 && resolved.type === 'skill' ? 0 : resolved.cost
        if (this.state.player.energy < effectiveCost) return []
        if (def.canPlay) {
            const canPlay = def.canPlay({ engine: this as unknown as { state: CombatState }, source: this.state.player.id, targets: targetIds, card })
            if (!canPlay) return []
        }

        this.state.player.energy -= effectiveCost
        const handIndex = this.state.player.hand.findIndex(c => c === card)
        if (handIndex >= 0) this.state.player.hand.splice(handIndex, 1)
        const shouldExhaust = resolved.exhaust || (hasCorruption > 0 && resolved.type === 'skill')
        if (shouldExhaust) this.state.player.exhaustPile.push(card)
        else this.state.player.discardPile.push(card)

        const events: EmittedEvent[] = [
            { kind: 'EnergyChanged', energy: this.state.player.energy },
            { kind: 'CardPlayed', cardId: card.defId },
        ]

        const performPlay = () => {
            if (def.onPlay) {
                def.onPlay({ engine: this as unknown as any, source: this.state.player.id, targets: targetIds, card })
            } else {
                if (resolved.baseDamage) {
                    this.enqueue({ kind: 'DealDamage', source: this.state.player.id, target: targetIds[0], amount: this.modifyOutgoingDamageFromPlayer(resolved.baseDamage) })
                }
                if (resolved.baseBlock) {
                    this.enqueue({ kind: 'GainBlock', target: this.state.player.id, amount: resolved.baseBlock })
                }
            }
        }

        performPlay()
        if (this.doubleTapCharges > 0 && resolved.type === 'attack') {
            this.doubleTapCharges -= 1
            performPlay()
        }

        for (const enemy of this.state.enemies) onPlayerCardPlayed(enemy, resolved.type)
        return events
    }

    handleExhaustFromHand(card: CardInstance): void {
        const index = this.state.player.hand.findIndex(item => item === card)
        if (index >= 0) this.state.player.hand.splice(index, 1)
        this.handleExhaust(card)
    }

    handleExhaust(card: CardInstance): void {
        this.state.player.exhaustPile.push(card)
        const fnp = this.state.player.powers.find(power => power.id === 'FEEL_NO_PAIN')?.stacks ?? 0
        if (fnp > 0) this.enqueue({ kind: 'GainBlock', target: this.state.player.id, amount: fnp * 3 })
        const darkEmbrace = this.state.player.powers.find(power => power.id === 'DARK_EMBRACE')?.stacks ?? 0
        if (darkEmbrace > 0) this.enqueue({ kind: 'DrawCards', count: darkEmbrace })
    }

    computeDamage(target: EntityId, base: number): number {
        const entity = this.getEntity(target)
        if (!entity) return base
        let amount = base
        const vulnerable = entity.powers.find(p => p.id === 'VULNERABLE')?.stacks ?? 0
        if (vulnerable > 0) amount = Math.round(amount * 1.5)
        return amount
    }

    modifyOutgoingDamageFromPlayer(base: number): number {
        let amount = base
        const strength = this.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
        amount += strength
        const weak = this.state.player.powers.find(p => p.id === 'WEAK')?.stacks ?? 0
        if (weak > 0) amount = Math.round(amount * 0.75)
        return amount
    }

    private validateTargets(card: CardInstance, targetIds: EntityId[]): boolean {
        const resolved = resolveCard(card)
        const livingEnemyIds = this.state.enemies.filter(enemy => enemy.hp > 0).map(enemy => enemy.id)
        const targetType = resolved.targeting?.type ?? 'none'

        if (targetType === 'none') return true
        if (targetType === 'player') return targetIds.length === 1 && targetIds[0] === this.state.player.id
        if (targetType === 'single_enemy') return targetIds.length === 1 && livingEnemyIds.includes(targetIds[0])
        if (targetType === 'all_enemies') return targetIds.length === livingEnemyIds.length && targetIds.every(id => livingEnemyIds.includes(id))
        if (targetType === 'any') return targetIds.length === 1 && (targetIds[0] === this.state.player.id || livingEnemyIds.includes(targetIds[0]))
        return false
    }

    private drawOne(): boolean {
        const player = this.state.player
        if (player.drawPile.length === 0) {
            if (player.discardPile.length === 0) return false
            this.rng.shuffleInPlace(player.discardPile)
            player.drawPile.push(...player.discardPile)
            player.discardPile = []
        }
        const card = player.drawPile.shift()
        if (!card) return false
        player.hand.push(card)
        return true
    }

    private getEntity(id: EntityId): PlayerState | EnemyState | undefined {
        if (id === this.state.player.id) return this.state.player
        return this.state.enemies.find(enemy => enemy.id === id)
    }

    private checkWinLose(events: EmittedEvent[]): void {
        if (this.state.player.hp <= 0) {
            this.state.defeat = true
            events.push({ kind: 'Defeat' })
            return
        }
        if (this.state.enemies.every(enemy => enemy.hp <= 0)) {
            this.state.victory = true
            events.push({ kind: 'Victory' })
        }
    }

    private modifyIncomingDamage(target: PlayerState | EnemyState, amount: number): number {
        const vulnerable = target.powers.find(p => p.id === 'VULNERABLE')?.stacks ?? 0
        let next = amount
        if (vulnerable > 0) next = Math.round(next * 1.5)
        if (target === this.state.player) next = Math.round(next * this.enemyDamageMultiplier())
        return next
    }

    private enemyDamageMultiplier(): number {
        return this.ascension >= 1 ? 1.2 : 1
    }

    private enemyBlockMultiplier(): number {
        return this.ascension >= 1 ? 1.2 : 1
    }

    private resolveEnemyBuffStrength(desc?: string): number {
        const text = (desc ?? '').toLowerCase()
        if (text.includes('ritual') || text.includes('strength') || text.includes('bellow')) return 2
        if (text.includes('charging')) return 2
        return 0
    }

    private tickTemporaryDebuffs(target: PlayerState | EnemyState): void {
        for (let i = target.powers.length - 1; i >= 0; i--) {
            const power = target.powers[i]
            if (power.id !== 'WEAK' && power.id !== 'VULNERABLE') continue
            power.stacks -= 1
            if (power.stacks <= 0) target.powers.splice(i, 1)
        }
    }

    private onStartOfPlayerTurn(): void {
        const player = this.state.player
        const demonForm = player.powers.find(power => power.id === 'DEMON_FORM')?.stacks ?? 0
        if (demonForm > 0) this.enqueue({ kind: 'ApplyPower', target: player.id, powerId: 'STRENGTH', stacks: demonForm })

        const brutality = player.powers.find(power => power.id === 'BRUTALITY')?.stacks ?? 0
        if (brutality > 0) {
            this.enqueue({ kind: 'LoseHp', target: player.id, amount: brutality })
            this.enqueue({ kind: 'DrawCards', count: brutality })
        }

        const berserk = player.powers.find(power => power.id === 'BERSERK')?.stacks ?? 0
        if (berserk > 0) this.enqueue({ kind: 'GainEnergy', amount: berserk })
    }

    private onEndOfPlayerTurn(): void {
        const metallicize = this.state.player.powers.find(power => power.id === 'METALLICIZE')?.stacks ?? 0
        if (metallicize > 0) this.enqueue({ kind: 'GainBlock', target: this.state.player.id, amount: metallicize })
    }

    private normalizePlayerThorns(): void {
        this.temporaryThorns = 0
        this.setPowerStacks(this.state.player, 'THORNS', this.basePlayerThorns)
    }

    private setPowerStacks(target: PlayerState | EnemyState, powerId: PowerInstance['id'], stacks: number): void {
        const current = target.powers.find(power => power.id === powerId)
        if (stacks <= 0) {
            if (!current) return
            target.powers = target.powers.filter(power => power.id !== powerId)
            return
        }
        if (current) current.stacks = stacks
        else target.powers.push({ id: powerId, stacks })
    }
}

export function createSimplePlayer(seed: string): PlayerState {
    const deck: CardInstance[] = []
    for (let i = 0; i < 5; i++) deck.push({ defId: 'STRIKE', upgraded: false })
    for (let i = 0; i < 5; i++) deck.push({ defId: 'DEFEND', upgraded: false })
    deck.push({ defId: 'BASH', upgraded: false })
    const rng = new RNG(seed)
    rng.shuffleInPlace(deck)
    return {
        id: 'player',
        maxHp: 80,
        hp: 80,
        block: 0,
        energy: 3,
        deck,
        drawPile: [...deck],
        discardPile: [],
        exhaustPile: [],
        hand: [],
        powers: [],
    }
}

export function createDummyEnemy(id: string): EnemyState {
    return { id, name: 'Slime', maxHp: 40, hp: 40, block: 0, powers: [], intent: { kind: 'attack', amount: 5 } }
}

export function createPlayerFromDeck(seed: string, deck: CardInstance[], hp: number, maxHp: number): PlayerState {
    const rng = new RNG(seed)
    const fullDeck = [...deck]
    rng.shuffleInPlace(fullDeck)
    return {
        id: 'player',
        maxHp,
        hp,
        block: 0,
        energy: 3,
        deck: fullDeck,
        drawPile: [...fullDeck],
        discardPile: [],
        exhaustPile: [],
        hand: [],
        powers: [],
    }
}
