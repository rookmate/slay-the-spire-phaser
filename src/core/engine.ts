import { RNG } from './rng'
import { getBossBuffBonus, getAscensionEnemyDamageMultiplier } from './ascension'
import { CARD_DEFS, canUpgradeCard, createCardInstance, createStarterDeck, resolveCard } from './cards'
import { onEnemyDamaged, onEnemyHitByPlayerAttack, onEnemyIntentResolved, onPlayerCardPlayed, rollEngineIntentForEnemy } from './enemies'
import { POTION_DEFS, type PotionId } from './potions'
import {
    createRelicCombatContext,
    modifyAttackDamageFromRelics,
    triggerRelicAttackPlayed,
    triggerRelicCombatStart,
    triggerRelicPlayerHpLost,
    triggerRelicPlayerTurnEnd,
    triggerRelicPlayerTurnStart,
    type RelicCombatRuntimeEntry,
} from './relics'
import type { RelicId, RunState } from './run'
import type { Action, EmittedEvent, EntityId } from './actions'
import type {
    CardChoiceRequest,
    CardDestination,
    CardInstance,
    ChoiceZone,
    CombatState,
    EnemyState,
    LimboCardState,
    PendingChoice,
    PendingChoiceView,
    PlayerState,
    PowerInstance,
} from './state'

interface InternalPendingChoice extends PendingChoice {
    onSubmit: (instanceIds: string[]) => void
    onCancel?: () => void
}

interface InternalLimboCardState extends LimboCardState {
    remainingRepeats: number
    pendingChoiceStarter?: () => void
}

export class Engine {
    readonly rng: RNG
    readonly state: CombatState
    private queue: Action[] = []
    private ascension: number
    private doubleTapCharges = 0
    private baseEnergyPerTurn = 3
    private basePlayerThorns = 0
    private temporaryThorns = 0
    private activeLimbo?: InternalLimboCardState
    private pendingChoice?: InternalPendingChoice
    private run?: RunState
    private relicRuntime: Partial<Record<RelicId, RelicCombatRuntimeEntry>> = {}

    constructor(seed: string, player: PlayerState, enemies: EnemyState[], opts?: { asc?: number; run?: RunState }) {
        this.rng = new RNG(seed)
        this.state = {
            player,
            enemies,
            turn: 'player',
            victory: false,
            defeat: false,
            limbo: [],
        }
        this.ascension = opts?.asc ?? 0
        this.run = opts?.run
    }

    enqueue(a: Action): void {
        this.queue.push(a)
    }

    setDoubleTapCharges(charges: number): void {
        this.doubleTapCharges = charges
    }

    configurePlayerCombatBonuses(opts: { baseThorns?: number; baseEnergyPerTurn?: number } = {}): void {
        this.basePlayerThorns = opts.baseThorns ?? this.basePlayerThorns
        this.baseEnergyPerTurn = opts.baseEnergyPerTurn ?? this.baseEnergyPerTurn
        this.state.player.energy = this.baseEnergyPerTurn
        if (this.basePlayerThorns > 0) this.setPowerStacks(this.state.player, 'THORNS', this.basePlayerThorns + this.temporaryThorns)
    }

    initializeCombat(): void {
        if (!this.run) return
        triggerRelicCombatStart(this.getRelicContext())
        triggerRelicPlayerTurnStart(this.getRelicContext())
    }

    addTemporaryThorns(amount: number): void {
        this.temporaryThorns += amount
        this.setPowerStacks(this.state.player, 'THORNS', this.basePlayerThorns + this.temporaryThorns)
    }

    getBaseThorns(): number {
        return this.basePlayerThorns
    }

    getBaseEnergyPerTurn(): number {
        return this.baseEnergyPerTurn
    }

    canAcceptInput(): boolean {
        return this.state.turn === 'player' && !this.state.victory && !this.state.defeat && !this.pendingChoice
    }

    getPendingChoice(): PendingChoiceView | undefined {
        if (!this.pendingChoice) return undefined
        const { onSubmit: _onSubmit, onCancel: _onCancel, ...view } = this.pendingChoice
        return view
    }

    submitPendingChoice(instanceIds: string[]): EmittedEvent[] {
        if (!this.pendingChoice) return []
        const uniqueIds = [...new Set(instanceIds)]
        const validIds = uniqueIds.filter(id => this.pendingChoice?.eligibleInstanceIds.includes(id))
        if (validIds.length < this.pendingChoice.minSelections || validIds.length > this.pendingChoice.maxSelections) return []

        const choice = this.pendingChoice
        this.pendingChoice = undefined
        choice.onSubmit(validIds)
        if (!this.pendingChoice) this.resolveActiveLimbo()
        return []
    }

    cancelPendingChoice(): EmittedEvent[] {
        if (!this.pendingChoice || !this.pendingChoice.canSkip) return []
        const choice = this.pendingChoice
        this.pendingChoice = undefined
        choice.onCancel?.()
        if (!this.pendingChoice) this.resolveActiveLimbo()
        return []
    }

    beginChoice(choice: CardChoiceRequest): void {
        this.pendingChoice = choice
    }

    deferChoice(startChoice: () => void): void {
        if (!this.activeLimbo) {
            startChoice()
            return
        }
        this.activeLimbo.pendingChoiceStarter = startChoice
    }

    getCardsInZone(zone: ChoiceZone): CardInstance[] {
        if (zone === 'hand') return this.state.player.hand
        if (zone === 'discard') return this.state.player.discardPile
        return this.state.player.exhaustPile
    }

    getLimboCard(): CardInstance | undefined {
        return this.activeLimbo?.card
    }

    moveCardToDestination(instanceId: string, zone: ChoiceZone, destination: CardDestination): CardInstance | undefined {
        const source = this.getCardsInZone(zone)
        const index = source.findIndex(card => card.instanceId === instanceId)
        if (index < 0) return undefined
        const [card] = source.splice(index, 1)
        this.insertCard(card, destination)
        return card
    }

    createCardsInDestination(
        defId: string,
        destination: Exclude<CardDestination, 'drawPileTop' | 'exhaustPile'>,
        count = 1,
        upgradeLevel = 0,
    ): CardInstance[] {
        const created: CardInstance[] = []
        for (let i = 0; i < count; i++) {
            const card = createCardInstance(defId, upgradeLevel)
            created.push(card)
            this.insertCard(card, destination)
        }
        return created
    }

    spawnEnemies(enemies: EnemyState[]): void {
        const openSlots = Math.max(0, 5 - this.countLivingEnemies())
        if (openSlots <= 0) return
        this.state.enemies.push(...enemies.slice(0, openSlots))
    }

    removeEnemy(enemyId: EntityId): void {
        this.state.enemies = this.state.enemies.filter(enemy => enemy.id !== enemyId)
    }

    countLivingEnemies(): number {
        return this.state.enemies.filter(enemy => enemy.hp > 0).length
    }

    countLivingNonMinions(): number {
        return this.state.enemies.filter(enemy => enemy.hp > 0 && !enemy.tags?.includes('minion')).length
    }

    gainBlock(target: EntityId, amount: number): void {
        this.enqueue({ kind: 'GainBlock', target, amount })
    }

    applyPowerToPlayer(powerId: PowerInstance['id'], stacks: number): void {
        this.enqueue({ kind: 'ApplyPower', target: this.state.player.id, powerId, stacks })
    }

    randomInt(min: number, max: number): number {
        return this.rng.int(min, max)
    }

    upgradeCardInstance(instanceId: string, zones: ChoiceZone[] = ['hand', 'discard', 'exhaust']): CardInstance | undefined {
        for (const zone of zones) {
            const card = this.getCardsInZone(zone).find(entry => entry.instanceId === instanceId)
            if (!card || !canUpgradeCard(card)) continue
            if (card.defId === 'SEARING_BLOW') card.upgradeLevel += 1
            else if (card.upgradeLevel === 0) card.upgradeLevel = 1
            return card
        }
        return undefined
    }

    usePotion(potionId: PotionId, targetIds: EntityId[]): EmittedEvent[] {
        if (!this.canAcceptInput()) return []
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
                    const weakStacks = source.powers.find(power => power.id === 'WEAK')?.stacks ?? 0
                    if (weakStacks > 0) damage = Math.round(damage * 0.75)
                }
                damage = this.modifyIncomingDamage(target, damage, action.damageType ?? 'attack')
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

                if (target === this.state.player && actualDamage > 0 && this.run) {
                    triggerRelicPlayerHpLost(this.getRelicContext(), actualDamage)
                }

                if ('name' in target) onEnemyDamaged(this, target, actualDamage)
                if ('name' in target && source?.id === this.state.player.id && (action.damageType ?? 'attack') === 'attack') {
                    onEnemyHitByPlayerAttack(this, target, actualDamage)
                }

                if (source && action.damageType !== 'thorns') {
                    const thorns = target.powers.find(power => power.id === 'THORNS')?.stacks ?? 0
                    if (thorns > 0 && source.hp > 0 && source.id !== target.id) {
                        this.enqueue({ kind: 'DealDamage', source: target.id, target: source.id, amount: thorns, damageType: 'thorns' })
                    }
                }

                this.checkWinLose(evts)
                break
            }
            case 'DealMultiDamage': {
                for (let i = 0; i < action.hits; i++) {
                    this.enqueue({ kind: 'DealDamage', source: action.source, target: action.target, amount: action.amount, damageType: action.damageType })
                }
                break
            }
            case 'LoseHp': {
                const target = this.getEntity(action.target)
                if (!target) break
                target.hp = Math.max(0, target.hp - action.amount)
                evts.push({ kind: 'HpLost', target: action.target, amount: action.amount, resultingHp: target.hp })
                if (target === this.state.player && action.amount > 0 && this.run) {
                    triggerRelicPlayerHpLost(this.getRelicContext(), action.amount)
                }
                this.checkWinLose(evts)
                break
            }
            case 'GainBlock': {
                const target = this.getEntity(action.target)
                if (!target) break
                target.block += action.amount
                evts.push({ kind: 'BlockGained', target: action.target, amount: action.amount, resultingBlock: target.block })
                if (target === this.state.player) {
                    const juggernaut = this.state.player.powers.find(power => power.id === 'JUGGERNAUT')?.stacks ?? 0
                    if (juggernaut > 0) {
                        const living = this.state.enemies.filter(enemy => enemy.hp > 0)
                        if (living.length > 0) {
                            const picked = living[this.rng.int(0, living.length - 1)]
                            this.enqueue({ kind: 'DealDamage', source: this.state.player.id, target: picked.id, amount: 5 * juggernaut })
                        }
                    }
                }
                break
            }
            case 'ApplyPower': {
                const target = this.getEntity(action.target)
                if (!target) break
                const current = target.powers.find(power => power.id === action.powerId)
                if (current) current.stacks += action.stacks
                else target.powers.push({ id: action.powerId, stacks: action.stacks } as PowerInstance)
                evts.push({ kind: 'PowerApplied', target: action.target, powerId: action.powerId, stacks: action.stacks })
                break
            }
            case 'ExhaustCard': {
                if (action.owner !== this.state.player.id) break
                const handIndex = action.cardInstanceId
                    ? this.state.player.hand.findIndex(card => card.instanceId === action.cardInstanceId)
                    : this.state.player.hand.length - 1
                if (handIndex < 0) break
                const [card] = this.state.player.hand.splice(handIndex, 1)
                this.handleExhaust(card)
                evts.push({ kind: 'CardExhausted', owner: this.state.player.id, cardId: card.defId, instanceId: card.instanceId })
                break
            }
            case 'DiscardHand': {
                this.state.player.discardPile.push(...this.state.player.hand)
                this.state.player.hand = []
                break
            }
            case 'EndTurn': {
                if (this.state.turn === 'player') {
                    this.processEndOfTurnHand(evts)
                    this.enqueue({ kind: 'DiscardHand' })
                    this.state.turn = 'enemy'
                    evts.push({ kind: 'TurnChanged', turn: 'enemy' })
                    this.doubleTapCharges = 0
                    this.onEndOfPlayerTurn()
                    this.tickTemporaryDebuffs(this.state.player)

                    for (const enemy of [...this.state.enemies]) {
                        if (enemy.hp <= 0) continue
                        if (enemy.intent?.kind === 'attack') {
                            const enemyStrength = enemy.powers.find(power => power.id === 'STRENGTH')?.stacks ?? 0
                            this.enqueue({
                                kind: 'DealDamage',
                                source: enemy.id,
                                target: this.state.player.id,
                                amount: Math.round((enemy.intent.amount + enemyStrength) * this.getEnemyDamageMultiplier(enemy)),
                            })
                        } else if (enemy.intent?.kind === 'multi_attack') {
                            const enemyStrength = enemy.powers.find(power => power.id === 'STRENGTH')?.stacks ?? 0
                            this.enqueue({
                                kind: 'DealMultiDamage',
                                source: enemy.id,
                                target: this.state.player.id,
                                amount: Math.round((enemy.intent.amount + enemyStrength) * this.getEnemyDamageMultiplier(enemy)),
                                hits: enemy.intent.hits,
                            })
                        } else if (enemy.intent?.kind === 'block') {
                            const scaled = Math.round(enemy.intent.amount * this.enemyBlockMultiplier())
                            this.enqueue({ kind: 'GainBlock', target: enemy.id, amount: scaled })
                        } else if (enemy.intent?.kind === 'debuff') {
                            this.enqueue({ kind: 'ApplyPower', target: this.state.player.id, powerId: enemy.intent.debuff, stacks: enemy.intent.stacks })
                        } else if (enemy.intent?.kind === 'status') {
                            this.createCardsInDestination(enemy.intent.createdDefId, enemy.intent.destination, enemy.intent.count)
                        } else if (enemy.intent?.kind === 'summon') {
                            // Summons are handled by enemy hooks so new units do not act immediately.
                        } else if (enemy.intent?.kind === 'buff') {
                            const strengthGain = this.resolveEnemyBuffStrength(enemy, enemy.intent.desc)
                            if (strengthGain > 0) this.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: strengthGain })
                        }
                        onEnemyIntentResolved(this, enemy, enemy.intent)
                    }

                    this.enqueue({ kind: 'EndTurn' })
                } else {
                    for (const enemy of this.state.enemies) this.tickTemporaryDebuffs(enemy)
                    this.state.turn = 'player'
                    this.state.player.energy = this.baseEnergyPerTurn
                    const hasBarricade = this.state.player.powers.find(power => power.id === 'BARRICADE')?.stacks ?? 0
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
        while (true) {
            while (this.queue.length > 0) {
                all.push(...this.step())
                if (this.state.victory || this.state.defeat || this.pendingChoice) return all
            }

            if (this.activeLimbo?.pendingChoiceStarter && !this.pendingChoice) {
                const startChoice = this.activeLimbo.pendingChoiceStarter
                this.activeLimbo.pendingChoiceStarter = undefined
                startChoice()
                if (this.pendingChoice) return all
                this.resolveActiveLimbo()
                if (this.state.victory || this.state.defeat) return all
                continue
            }

            return all
        }
    }

    playCard(card: CardInstance, targetIds: EntityId[]): EmittedEvent[] {
        const def = CARD_DEFS[card.defId]
        if (!def || !this.canAcceptInput()) return []
        const resolved = resolveCard(card)
        if (resolved.unplayable || !this.validateTargets(card, targetIds)) return []

        const hasCorruption = this.state.player.powers.find(power => power.id === 'CORRUPTION')?.stacks ?? 0
        const effectiveCost = hasCorruption > 0 && resolved.type === 'skill'
            ? 0
            : resolved.xCost
                ? this.state.player.energy
                : resolved.cost
        if (this.state.player.energy < effectiveCost) return []

        if (def.canPlay) {
            const canPlay = def.canPlay({ engine: this, source: this.state.player.id, targets: targetIds, card })
            if (!canPlay) return []
        }

        const handIndex = this.state.player.hand.findIndex(entry => entry.instanceId === card.instanceId)
        if (handIndex < 0) return []

        this.state.player.energy -= effectiveCost
        const [playedCard] = this.state.player.hand.splice(handIndex, 1)
        const repeatAttack = resolved.type === 'attack' && this.doubleTapCharges > 0
        if (repeatAttack) this.doubleTapCharges -= 1

        this.activeLimbo = {
            card: playedCard,
            targetIds,
            exhaustOnResolve: resolved.exhaust || (hasCorruption > 0 && resolved.type === 'skill'),
            spentEnergy: effectiveCost,
            remainingRepeats: repeatAttack ? 2 : 1,
        }
        this.syncLimboState()

        const events: EmittedEvent[] = [
            { kind: 'EnergyChanged', energy: this.state.player.energy },
            { kind: 'CardPlayed', cardId: playedCard.defId, instanceId: playedCard.instanceId },
        ]

        const painCards = this.state.player.hand.filter(entry => entry.defId === 'PAIN').length
        for (let i = 0; i < painCards; i++) {
            this.enqueue({ kind: 'LoseHp', target: this.state.player.id, amount: 1 })
        }

        if (resolved.type === 'attack' && this.run) {
            triggerRelicAttackPlayed(this.getRelicContext(), playedCard.instanceId)
        }

        this.resolveActiveLimbo()
        for (const enemy of this.state.enemies) onPlayerCardPlayed(enemy, resolved.type)
        return events
    }

    handleExhaustFromHand(card: CardInstance): void {
        const index = this.state.player.hand.findIndex(entry => entry.instanceId === card.instanceId)
        if (index >= 0) this.state.player.hand.splice(index, 1)
        this.handleExhaust(card)
    }

    handleExhaust(card: CardInstance): void {
        this.state.player.exhaustPile.push(card)
        CARD_DEFS[card.defId]?.onExhaust?.({ engine: this, card })
        const feelNoPain = this.state.player.powers.find(power => power.id === 'FEEL_NO_PAIN')?.stacks ?? 0
        if (feelNoPain > 0) this.enqueue({ kind: 'GainBlock', target: this.state.player.id, amount: feelNoPain * 3 })
        const darkEmbrace = this.state.player.powers.find(power => power.id === 'DARK_EMBRACE')?.stacks ?? 0
        if (darkEmbrace > 0) this.enqueue({ kind: 'DrawCards', count: darkEmbrace })
    }

    computeDamage(target: EntityId, base: number): number {
        const entity = this.getEntity(target)
        if (!entity) return base
        let amount = base
        const vulnerable = entity.powers.find(power => power.id === 'VULNERABLE')?.stacks ?? 0
        if (vulnerable > 0) amount = Math.round(amount * 1.5)
        return amount
    }

    modifyOutgoingAttackDamageFromPlayer(base: number, cardInstanceId?: string): number {
        let amount = base
        const strength = this.state.player.powers.find(power => power.id === 'STRENGTH')?.stacks ?? 0
        amount += strength
        const weak = this.state.player.powers.find(power => power.id === 'WEAK')?.stacks ?? 0
        if (weak > 0) amount = Math.round(amount * 0.75)
        if (this.run && cardInstanceId) amount = modifyAttackDamageFromRelics(this.getRelicContext(), amount, cardInstanceId)
        return amount
    }

    private resolveActiveLimbo(): void {
        while (this.activeLimbo && !this.pendingChoice) {
            if (this.activeLimbo.remainingRepeats <= 0) {
                if (!this.activeLimbo.pendingChoiceStarter) this.finalizeActiveLimbo()
                return
            }

            const limbo = this.activeLimbo
            limbo.remainingRepeats -= 1
            limbo.pendingChoiceStarter = undefined
            const def = CARD_DEFS[limbo.card.defId]
            const resolved = resolveCard(limbo.card)

            if (def.onPlay) {
                def.onPlay({
                    engine: this,
                    source: this.state.player.id,
                    targets: limbo.targetIds,
                    card: limbo.card,
                    spentEnergy: limbo.spentEnergy,
                })
            } else {
                if (resolved.baseDamage) {
                    this.enqueue({
                        kind: 'DealDamage',
                        source: this.state.player.id,
                        target: limbo.targetIds[0],
                        amount: this.modifyOutgoingAttackDamageFromPlayer(resolved.baseDamage, limbo.card.instanceId),
                    })
                }
                if (resolved.baseBlock) {
                    this.enqueue({ kind: 'GainBlock', target: this.state.player.id, amount: resolved.baseBlock })
                }
            }

            if (this.pendingChoice || limbo.pendingChoiceStarter) return
        }
    }

    private finalizeActiveLimbo(): void {
        if (!this.activeLimbo) return
        const card = this.activeLimbo.card
        if (this.activeLimbo.exhaustOnResolve) this.handleExhaust(card)
        else this.state.player.discardPile.push(card)
        this.activeLimbo = undefined
        this.syncLimboState()
    }

    private processEndOfTurnHand(events: EmittedEvent[]): void {
        const remainingHand = [...this.state.player.hand]
        const regretCards = remainingHand.filter(card => card.defId === 'REGRET').length
        if (regretCards > 0) {
            this.enqueue({ kind: 'LoseHp', target: this.state.player.id, amount: remainingHand.length * regretCards })
        }
        for (const card of remainingHand) {
            const resolved = resolveCard(card)
            if (card.defId === 'BURN') this.enqueue({ kind: 'LoseHp', target: this.state.player.id, amount: 2 })
            if (!(resolved.ethereal || card.defId === 'DAZED')) continue
            const index = this.state.player.hand.findIndex(entry => entry.instanceId === card.instanceId)
            if (index < 0) continue
            const [etherealCard] = this.state.player.hand.splice(index, 1)
            this.handleExhaust(etherealCard)
            events.push({ kind: 'CardExhausted', owner: this.state.player.id, cardId: etherealCard.defId, instanceId: etherealCard.instanceId })
        }
    }

    private validateTargets(card: CardInstance, targetIds: EntityId[]): boolean {
        const resolved = resolveCard(card)
        const livingEnemyIds = this.state.enemies.filter(enemy => enemy.hp > 0).map(enemy => enemy.id)
        const targetType = resolved.targeting?.type ?? 'none'

        if (targetType === 'none') return targetIds.length === 0 || targetIds.every(id => id === this.state.player.id)
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

    private insertCard(card: CardInstance, destination: CardDestination): void {
        if (destination === 'hand') {
            this.state.player.hand.push(card)
            return
        }
        if (destination === 'discardPile') {
            this.state.player.discardPile.push(card)
            return
        }
        if (destination === 'drawPileTop') {
            this.state.player.drawPile.unshift(card)
            return
        }
        if (destination === 'drawPile') {
            const index = this.state.player.drawPile.length === 0 ? 0 : this.rng.int(0, this.state.player.drawPile.length)
            this.state.player.drawPile.splice(index, 0, card)
            return
        }
        this.state.player.exhaustPile.push(card)
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
        if (this.state.enemies.length === 0) return
        if (this.state.enemies.every(enemy => enemy.hp <= 0)) {
            this.state.victory = true
            events.push({ kind: 'Victory' })
        }
    }

    private modifyIncomingDamage(target: PlayerState | EnemyState, amount: number, damageType: 'attack' | 'thorns'): number {
        const vulnerable = target.powers.find(power => power.id === 'VULNERABLE')?.stacks ?? 0
        let next = amount
        if (vulnerable > 0) next = Math.round(next * 1.5)
        if ('name' in target && target.specId === 'BYRD' && damageType === 'attack' && target.aiState?.flying) {
            next = Math.min(next, 3)
        }
        if (target === this.state.player) next = Math.round(next * this.enemyDamageMultiplier())
        return next
    }

    private enemyDamageMultiplier(): number {
        return 1
    }

    private enemyBlockMultiplier(): number {
        return 1
    }

    private resolveEnemyBuffStrength(enemy: EnemyState, desc?: string): number {
        const text = (desc ?? '').toLowerCase()
        const bossBonus = getBossBuffBonus(this.ascension, enemy)
        if (text.includes('ritual') || text.includes('strength') || text.includes('bellow')) return 2 + bossBonus
        if (text.includes('charging')) return 2 + bossBonus
        return 0
    }

    private getEnemyDamageMultiplier(enemy: EnemyState): number {
        return getAscensionEnemyDamageMultiplier(this.ascension, enemy)
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
        if (this.run) triggerRelicPlayerTurnStart(this.getRelicContext())
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
        if (this.run) triggerRelicPlayerTurnEnd(this.getRelicContext())
        const metallicize = this.state.player.powers.find(power => power.id === 'METALLICIZE')?.stacks ?? 0
        if (metallicize > 0) this.enqueue({ kind: 'GainBlock', target: this.state.player.id, amount: metallicize })
    }

    private getRelicContext() {
        if (!this.run) throw new Error('Relic context requested without run state')
        return createRelicCombatContext(this, this.run, this.relicRuntime)
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

    private syncLimboState(): void {
        this.state.limbo = this.activeLimbo ? [{
            card: this.activeLimbo.card,
            targetIds: this.activeLimbo.targetIds,
            exhaustOnResolve: this.activeLimbo.exhaustOnResolve,
            spentEnergy: this.activeLimbo.spentEnergy,
        }] : []
    }
}

export function createSimplePlayer(seed: string): PlayerState {
    const deck = createStarterDeck()
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
        deck: [...deck],
        drawPile: [...fullDeck],
        discardPile: [],
        exhaustPile: [],
        hand: [],
        powers: [],
    }
}
