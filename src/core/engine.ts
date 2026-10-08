import { executeEnemyEffect, executeEnemyMove, finishEnemyMove } from './enemyTurns'
import { onCardDrawn, onEndOfPlayerTurn, onPlayerCardPlayed as triggerPlayerCardPowers, onStartOfPlayerTurn } from './powerHooks'
import { blockAmount, damageAmount, HAND_LIMIT, isDebuff, powerAmount } from './combatMath'
import { RNG } from './rng'
import { CARD_DEFS, canUpgradeCard, createCardInstance, createStarterDeck, resolveCard } from './cards'
import { onCardEffectsResolved, onEnemyAttackDamage, onEnemyDamaged, onEnemyHitByPlayerAttack, onPlayerCardPlayed, rollEngineIntentForEnemy } from './enemies'
import { POTION_DEFS, type PotionId } from './potions'
import {
    createRelicCombatContext,
    modifyAttackDamageFromRelics,
    triggerRelicAttackPlayed,
    triggerRelicCardExhausted,
    triggerRelicCombatStart,
    triggerRelicPlayerHpLost,
    triggerRelicPlayerTurnEnd,
    triggerRelicPlayerTurnStart,
    type RelicCombatRuntimeEntry,
} from './relics'
import { obtainCurse, type RelicId, type RunState } from './run'
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
    private doubleTapCharges = 0
    private endTurnRequested = false
    private baseEnergyPerTurn = 3
    private basePlayerThorns = 0
    private temporaryThorns = 0
    private suspendedCards: { limbo: InternalLimboCardState; actions: Action[] }[] = []
    private activeLimbo?: InternalLimboCardState
    private pendingChoice?: InternalPendingChoice
    private run?: RunState
    private relicRuntime: Partial<Record<RelicId, RelicCombatRuntimeEntry>> = {}
    private resolvingCardInstanceId?: string

    constructor(seed: string, player: PlayerState, enemies: EnemyState[], opts?: { asc?: number; run?: RunState }) {
        this.rng = new RNG(seed)
        this.state = {
            player,
            enemies,
            turn: 'player',
            victory: false,
            defeat: false,
            limbo: [],
            cardRuntime: {},
        }
        for (const enemy of enemies) enemy.asc ??= opts?.asc ?? 0
        this.run = opts?.run
    }

    enqueue(a: Action): void {
        if (
            (a.kind === 'DealDamage' || a.kind === 'DealMultiDamage')
            && a.source === this.state.player.id
            && !a.sourceCardInstanceId
            && this.resolvingCardInstanceId
        ) {
            this.queue.push({ ...a, sourceCardInstanceId: this.resolvingCardInstanceId })
            return
        }
        this.queue.push(a)
    }

    setDoubleTapCharges(charges: number): void {
        this.doubleTapCharges += charges
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

    copyCardToHand(instanceId: string, count = 1): CardInstance[] {
        const source = [
            ...this.state.player.hand,
            ...this.state.player.discardPile,
            ...this.state.player.exhaustPile,
            ...(this.activeLimbo ? [this.activeLimbo.card] : []),
        ].find(card => card.instanceId === instanceId)
        if (!source) return []
        const created: CardInstance[] = []
        for (let i = 0; i < count; i++) {
            const copy = createCardInstance(source.defId, source.upgradeLevel)
            this.insertCard(copy, 'hand')
            created.push(copy)
        }
        return created
    }

    exhaustCardsInHand(predicate: (card: CardInstance) => boolean): CardInstance[] {
        const exhausted: CardInstance[] = []
        const kept: CardInstance[] = []
        for (const card of this.state.player.hand) {
            if (predicate(card)) exhausted.push(card)
            else kept.push(card)
        }
        this.state.player.hand = kept
        for (const card of exhausted) this.handleExhaust(card)
        return exhausted
    }

    getCombatCardRuntime(instanceId: string): { bonusDamage?: number; triggered?: boolean } {
        this.state.cardRuntime[instanceId] ??= {}
        return this.state.cardRuntime[instanceId]
    }

    getCardCombatBonusDamage(instanceId: string): number {
        return this.getCombatCardRuntime(instanceId).bonusDamage ?? 0
    }

    modifyCardCombatBonusDamage(instanceId: string, delta: number): number {
        const runtime = this.getCombatCardRuntime(instanceId)
        runtime.bonusDamage = (runtime.bonusDamage ?? 0) + delta
        return runtime.bonusDamage
    }

    spawnEnemies(enemies: EnemyState[]): void {
        const openSlots = Math.max(0, 5 - this.countLivingEnemies())
        if (openSlots <= 0) return
        this.state.enemies = this.state.enemies.filter(enemy => enemy.hp > 0 || enemy.halfDead)
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

    requestEndTurn(): void { this.endTurnRequested = true }
    changeGold(amount: number): number {
        if (!this.run) return 0
        const previous = this.run.gold
        this.run.gold = Math.max(0, previous + amount)
        return this.run.gold - previous
    }
    gainCurse(id: string): void { if (this.run) obtainCurse(this.run, id) }

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
        if (def.target === 'single_enemy') this.state.facingEnemyId = targetIds[0]
        def.use(this, targetIds)
        return this.runUntilIdle()
    }

    step(): EmittedEvent[] {
        const evts: EmittedEvent[] = []
        const action = this.queue.shift()
        if (!action) return evts
        // Consequences of this action resolve before the previously queued actions.
        const remainingActions = this.queue
        this.queue = []

        switch (action.kind) {
            case 'PlayTopCard': {
                if (this.endTurnRequested) break
                const player = this.state.player
                if (!player.drawPile.length) {
                    this.rng.shuffleInPlace(player.discardPile)
                    player.drawPile.push(...player.discardPile.splice(0))
                }
                const card = player.drawPile.shift()
                if (!card) break
                const def = resolveCard(card)
                const living = this.state.enemies.filter(enemy => enemy.hp > 0).map(enemy => enemy.id)
                const targets = def.targeting?.type === 'single_enemy' ? (living.length ? [living[this.rng.int(0, living.length - 1)]] : [])
                    : def.targeting?.type === 'all_enemies' ? living : def.targeting?.type === 'player' ? [player.id] : []
                if (this.normalityBlocksPlay() || def.unplayable || !this.validateTargets(card, targets) || (def.type === 'attack' && powerAmount(player, 'ENTANGLED') > 0)
                    || (def.canPlay && !def.canPlay({ engine: this, source: player.id, targets, card }))) {
                    this.handleExhaust(card)
                    break
                }
                if (this.activeLimbo) this.suspendedCards.push({ limbo: this.activeLimbo, actions: remainingActions.splice(0) })
                this.prepareCardPlay(card, targets, player.energy, def.type !== 'power')
                evts.push({ kind: 'CardPlayed', cardId: card.defId, instanceId: card.instanceId })
                break
            }
            case 'GainEnergy': {
                this.state.player.energy = Math.max(0, this.state.player.energy + action.amount)
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
                this.heal(action.target, action.amount, evts)
                break
            }
            case 'DealDamage': {
                const target = this.getEntity(action.target)
                if (!target || target.hp <= 0) break
                const source = this.getEntity(action.source)
                if (source && source.hp <= 0 && action.damageType !== 'thorns') break
                const damage = this.previewDamage(action.source, action.target, action.amount, action.damageType)
                const blockUsed = Math.min(target.block, damage)
                target.block -= blockUsed
                const cap = 'specId' in target && target.specId === 'CORRUPT_HEART' ? Math.max(0, ((target.asc ?? 0) >= 19 ? 200 : 300) - Number(target.aiState?.damageThisTurn ?? 0)) : Infinity
                const actualDamage = Math.min(target.hp, cap, Math.max(0, damage - blockUsed))
                if (actualDamage > 0) {
                    target.hp = Math.max(0, target.hp - actualDamage)
                    if (target === this.state.player) {
                        this.state.hpLossCount = (this.state.hpLossCount ?? 0) + 1
                        if (action.fromCard) this.triggerRupture()
                        if ((action.damageType ?? 'attack') === 'attack' && powerAmount(target, 'PLATED_ARMOR') > 0) this.setPowerStacks(target, 'PLATED_ARMOR', powerAmount(target, 'PLATED_ARMOR') - 1)

                    }
                    if ('specId' in target && target.specId === 'CORRUPT_HEART') target.aiState = { ...target.aiState, damageThisTurn: Number(target.aiState?.damageThisTurn ?? 0) + actualDamage }
                }

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
                    this.heal(action.lifestealTo, actualDamage, evts)
                }

                if (target === this.state.player && actualDamage > 0 && this.run) {
                    triggerRelicPlayerHpLost(this.getRelicContext(), actualDamage)
                }

                if (source && 'name' in source && target === this.state.player && (action.damageType ?? 'attack') === 'attack') onEnemyAttackDamage(this, source, damage, actualDamage)
                if ('name' in target) onEnemyDamaged(this, target, actualDamage)
                if ('name' in target && source?.id === this.state.player.id && (action.damageType ?? 'attack') === 'attack') {
                    const armor = powerAmount(target, 'PLATED_ARMOR')
                    if (actualDamage > 0 && armor > 0) {
                        this.setPowerStacks(target, 'PLATED_ARMOR', armor - 1)
                        if (armor === 1 && target.specId === 'SHELLED_PARASITE') target.intent = { kind: 'buff', desc: 'Stunned' }
                    }
                    onEnemyHitByPlayerAttack(this, target, actualDamage)
                    if (target.hp <= 0 && action.sourceCardInstanceId) this.onEnemyKilledByCard(action.sourceCardInstanceId, target.id)
                }

                if (source && (action.damageType ?? 'attack') === 'attack') {
                    const thorns = target.powers.find(power => power.id === 'THORNS')?.stacks ?? 0
                    if (thorns > 0 && source.hp > 0 && source.id !== target.id) {
                        this.enqueue({ kind: 'DealDamage', source: target.id, target: source.id, amount: thorns, damageType: 'thorns' })
                    }
                }

                break
            }
            case 'RandomAttack': {
                const living = this.state.enemies.filter(enemy => enemy.hp > 0)
                if (living.length) this.enqueue({ kind: 'DealDamage', source: action.source,
                    target: living[this.rng.int(0, living.length - 1)].id, amount: action.amount,
                    sourceCardInstanceId: action.sourceCardInstanceId })
                break
            }
            case 'DealMultiDamage': {
                for (let i = 0; i < action.hits; i++) {
                    this.enqueue({
                        kind: 'DealDamage',
                        source: action.source,
                        target: action.target,
                        amount: action.amount,
                        damageType: action.damageType,
                        sourceCardInstanceId: action.sourceCardInstanceId,
                    })
                }
                break
            }
            case 'LoseHp': {
                const target = this.getEntity(action.target)
                if (!target) break
                const lost = Math.min(target.hp, Math.max(0, action.amount))
                target.hp = Math.max(0, target.hp - lost)
                if (target === this.state.player && lost > 0) {
                    this.state.hpLossCount = (this.state.hpLossCount ?? 0) + 1
                    if (action.fromCard !== false) this.triggerRupture()
                }
                evts.push({ kind: 'HpLost', target: action.target, amount: action.amount, resultingHp: target.hp })
                if (target === this.state.player && action.amount > 0 && this.run) {
                    triggerRelicPlayerHpLost(this.getRelicContext(), action.amount)
                }
                break
            }
            case 'GainBlock': {
                const target = this.getEntity(action.target)
                if (!target) break
                const amount = blockAmount(action.amount, target, action.blockSource)
                target.block += amount
                evts.push({ kind: 'BlockGained', target: action.target, amount, resultingBlock: target.block })
                if (target === this.state.player) {
                    const juggernaut = this.state.player.powers.find(power => power.id === 'JUGGERNAUT')?.stacks ?? 0
                    if (juggernaut > 0 && amount > 0) {
                        const living = this.state.enemies.filter(enemy => enemy.hp > 0)
                        if (living.length > 0) {
                            const picked = living[this.rng.int(0, living.length - 1)]
                            this.enqueue({ kind: 'DealDamage', source: this.state.player.id, target: picked.id, amount: juggernaut, damageType: 'effect' })
                        }
                    }
                }
                break
            }
            case 'ApplyPower': {
                const target = this.getEntity(action.target)
                if (!target) break
                if (isDebuff(action.powerId, action.stacks) && powerAmount(target, 'ARTIFACT') > 0) {
                    this.setPowerStacks(target, 'ARTIFACT', powerAmount(target, 'ARTIFACT') - 1)
                    break
                }
                const current = target.powers.find(power => power.id === action.powerId)
                if (current) current.stacks += action.stacks
                else target.powers.push({ id: action.powerId, stacks: action.stacks, fresh: this.state.turn === 'enemy' })
                if (current && current.stacks === 0) target.powers = target.powers.filter(power => power !== current)
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
                this.state.player.discardPile.push(...this.state.player.hand.filter(card => !resolveCard(card).retain))
                this.state.player.hand = this.state.player.hand.filter(card => resolveCard(card).retain)
                for (const card of [...this.state.player.hand, ...this.state.player.drawPile, ...this.state.player.discardPile, ...this.state.player.exhaustPile]) card.costForTurn = undefined
                break
            }
            case 'StartEnemyTurn': {
                this.state.turn = 'enemy'
                evts.push({ kind: 'TurnChanged', turn: 'enemy' })
                for (const enemy of this.state.enemies) if (powerAmount(enemy, 'BARRICADE') === 0) enemy.block = 0
                for (const enemy of [...this.state.enemies]) this.enqueue({ kind: 'EnemyMove', enemyId: enemy.id })

                this.enqueue({ kind: 'EndTurn' })
                break
            }
            case 'EnemyMove':
            case 'EnemyEffect':
            case 'EnemyMoveFinished': {
                const enemy = this.state.enemies.find(e => e.id === action.enemyId)
                if (!enemy) break
                if (action.kind === 'EnemyMove') executeEnemyMove(this, enemy)
                else if (action.kind === 'EnemyEffect') executeEnemyEffect(this, enemy, action.effect)
                else finishEnemyMove(this, enemy)
                break
            }
            case 'EndTurn': {
                if (this.state.turn === 'player') {
                    onEndOfPlayerTurn(this)
                    if (this.run) triggerRelicPlayerTurnEnd(this.getRelicContext())
                    this.processEndOfTurnHand(evts)
                    this.enqueue({ kind: 'DiscardHand' })
                    this.doubleTapCharges = 0
                    this.enqueue({ kind: 'StartEnemyTurn' })
                } else {
                    this.tickTemporaryDebuffs(this.state.player)
                    for (const enemy of this.state.enemies) this.tickTemporaryDebuffs(enemy)
                    this.state.turn = 'player'
                    this.state.cardsPlayed = 0
                    this.setPowerStacks(this.state.player, 'NO_DRAW', 0)
                    this.state.player.energy = this.baseEnergyPerTurn
                    const hasBarricade = this.state.player.powers.find(power => power.id === 'BARRICADE')?.stacks ?? 0
                    if (hasBarricade === 0) this.state.player.block = 0
                    this.normalizePlayerThorns()
                    onStartOfPlayerTurn(this)
                    if (this.run) triggerRelicPlayerTurnStart(this.getRelicContext())
                    for (const enemy of this.state.enemies) {
                        if (enemy.hp <= 0 && !enemy.halfDead) continue
                        enemy.intent = rollEngineIntentForEnemy(this.rng, enemy, this.state)
                    }
                    const reducedDraw = powerAmount(this.state.player, 'DRAW_REDUCTION') > 0 ? 1 : 0
                    this.enqueue({ kind: 'DrawCards', count: 5 - reducedDraw })
                    this.setPowerStacks(this.state.player, 'DRAW_REDUCTION', Math.max(0, powerAmount(this.state.player, 'DRAW_REDUCTION') - 1))
                    evts.push({ kind: 'TurnChanged', turn: 'player' })
                }
                break
            }
        }

        this.queue.push(...remainingActions)
        this.checkWinLose(evts)
        return evts
    }

    runUntilIdle(): EmittedEvent[] {
        const all: EmittedEvent[] = []
        if (this.state.victory || this.state.defeat || this.pendingChoice) return all
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

            if (this.activeLimbo) {
                this.resolveActiveLimbo()
                continue
            }
            if (this.endTurnRequested && this.state.turn === 'player') {
                this.endTurnRequested = false
                this.enqueue({ kind: 'EndTurn' })
                continue
            }
            return all
        }
    }

    private normalityBlocksPlay(): boolean { return (this.state.cardsPlayed ?? 0) >= 3 && this.state.player.hand.some(c => c.defId === 'NORMALITY') }

    getCardCost(card: CardInstance): number {
        const def = resolveCard(card)
        if (def.type === 'skill' && powerAmount(this.state.player, 'CORRUPTION') > 0) return 0
        if (def.xCost) return this.state.player.energy
        return card.costForTurn ?? card.costForCombat ?? card.confusedCost ?? (card.defId === 'BLOOD_FOR_BLOOD' ? Math.max(0, def.cost - (this.state.hpLossCount ?? 0)) : def.cost)
    }

    playCard(card: CardInstance, targetIds: EntityId[]): EmittedEvent[] {
        const def = CARD_DEFS[card.defId]
        if (!def || !this.canAcceptInput()) return []
        const resolved = resolveCard(card)
        if (resolved.type === 'attack' && powerAmount(this.state.player, 'ENTANGLED') > 0) return []
        if (this.normalityBlocksPlay() || resolved.unplayable || !this.validateTargets(card, targetIds)) return []

        const effectiveCost = this.getCardCost(card)
        if (this.state.player.energy < effectiveCost) return []

        if (def.canPlay) {
            const canPlay = def.canPlay({ engine: this, source: this.state.player.id, targets: targetIds, card })
            if (!canPlay) return []
        }

        const handIndex = this.state.player.hand.findIndex(entry => entry.instanceId === card.instanceId)
        if (handIndex < 0) return []

        this.state.player.energy -= effectiveCost
        const [playedCard] = this.state.player.hand.splice(handIndex, 1)
        this.prepareCardPlay(playedCard, targetIds, effectiveCost)

        const events: EmittedEvent[] = [
            { kind: 'EnergyChanged', energy: this.state.player.energy },
            { kind: 'CardPlayed', cardId: playedCard.defId, instanceId: playedCard.instanceId },
        ]

        this.resolveActiveLimbo()
        return events
    }

    private prepareCardPlay(card: CardInstance, targetIds: EntityId[], spentEnergy: number, forceExhaust = false): void {
        const def = resolveCard(card)
        this.getCombatCardRuntime(card.instanceId).triggered = false
        if (def.targeting?.type === 'single_enemy') this.state.facingEnemyId = targetIds[0]
        const repeat = def.type === 'attack' && this.doubleTapCharges > 0
        if (repeat) this.doubleTapCharges -= 1
        this.activeLimbo = {
            card, targetIds, spentEnergy,
            exhaustOnResolve: forceExhaust || def.exhaust || (def.type === 'skill' && powerAmount(this.state.player, 'CORRUPTION') > 0),
            remainingRepeats: repeat ? 2 : 1,
        }
        this.syncLimboState()
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
        if (feelNoPain > 0) this.enqueue({ kind: 'GainBlock', target: this.state.player.id, amount: feelNoPain })
        const darkEmbrace = this.state.player.powers.find(power => power.id === 'DARK_EMBRACE')?.stacks ?? 0
        if (darkEmbrace > 0) this.enqueue({ kind: 'DrawCards', count: darkEmbrace })
        if (this.run) triggerRelicCardExhausted(this.getRelicContext(), card.instanceId)
    }

    previewDamage(sourceId: EntityId, targetId: EntityId | undefined, base: number, type: import('./actions').DamageType = 'attack'): number {
        const target = targetId ? this.getEntity(targetId) : undefined
        const multiplier = target && 'name' in target && this.run?.relics.includes('PAPER_FROG') ? 1.75 : 1.5
        const surrounded = target === this.state.player && this.state.enemies.filter(enemy => enemy.hp > 0 && (enemy.specId === 'SPIRE_SHIELD' || enemy.specId === 'SPIRE_SPEAR')).length === 2
        const backAttack = surrounded && sourceId !== (this.state.facingEnemyId ?? this.state.enemies[0].id) ? 1.5 : 1
        return damageAmount(base, this.getEntity(sourceId), target, type, multiplier, backAttack)
    }

    previewEnemyAttack(enemy: EnemyState): number {
        if (enemy.intent?.kind !== 'attack' && enemy.intent?.kind !== 'multi_attack') return 0
        const base = Math.max(0, (enemy.intent.amount + powerAmount(enemy, 'STRENGTH')))
        return this.previewDamage(enemy.id, this.state.player.id, base)
    }

    computeDamage(target: EntityId, base: number): number {
        return this.previewDamage(this.state.player.id, target, base)
    }

    modifyOutgoingAttackDamageFromPlayer(base: number, cardInstanceId?: string): number {
        let amount = base
        if (cardInstanceId) amount += this.getCardCombatBonusDamage(cardInstanceId)
        const strength = this.state.player.powers.find(power => power.id === 'STRENGTH')?.stacks ?? 0
        amount += strength
        if (this.run && cardInstanceId) amount = modifyAttackDamageFromRelics(this.getRelicContext(), amount, cardInstanceId)
        return Math.max(0, amount)
    }

    private triggerRupture(): void {
        const stacks = powerAmount(this.state.player, 'RUPTURE')
        if (stacks > 0) this.enqueue({ kind: 'ApplyPower', target: this.state.player.id, powerId: 'STRENGTH', stacks })
    }

    private heal(targetId: EntityId, amount: number, events: EmittedEvent[]): void {
        const target = this.getEntity(targetId)
        if (!target || (targetId === this.state.player.id && this.run?.relics.includes('MARK_OF_THE_BLOOM'))) return
        target.hp = Math.min(target.maxHp, target.hp + amount)
        events.push({ kind: 'Healed', target: targetId, amount, resultingHp: target.hp })
    }

    private resolveActiveLimbo(): void {
        if (this.queue.length > 0) return
        for (const enemy of this.state.enemies) onCardEffectsResolved(this, enemy)
        if (this.queue.length > 0) return
        while (this.activeLimbo && !this.pendingChoice) {
            if (this.endTurnRequested || this.normalityBlocksPlay()) this.activeLimbo.remainingRepeats = 0
            if (this.activeLimbo.remainingRepeats <= 0) {
                if (!this.activeLimbo.pendingChoiceStarter) this.finalizeActiveLimbo()
                return
            }

            const limbo = this.activeLimbo
            limbo.remainingRepeats -= 1
            this.state.cardsPlayed = (this.state.cardsPlayed ?? 0) + 1
            limbo.pendingChoiceStarter = undefined
            const def = CARD_DEFS[limbo.card.defId]
            const resolved = resolveCard(limbo.card)
            this.resolvingCardInstanceId = limbo.card.instanceId
            for (const pain of this.state.player.hand.filter(card => card.defId === 'PAIN')) {
                this.enqueue({ kind: 'LoseHp', target: this.state.player.id, amount: 1, fromCard: true })
                void pain
            }
            if (resolved.type === 'attack' && this.run) triggerRelicAttackPlayed(this.getRelicContext(), limbo.card.instanceId)
            triggerPlayerCardPowers(this, resolved.type)

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
                    this.enqueue({ kind: 'GainBlock', target: this.state.player.id, amount: resolved.baseBlock, blockSource: 'card' })
                }
            }
            for (const enemy of this.state.enemies) onPlayerCardPlayed(this, enemy, resolved.type)
            this.resolvingCardInstanceId = undefined

            return
        }
    }

    private finalizeActiveLimbo(): void {
        if (!this.activeLimbo) return
        const card = this.activeLimbo.card
        if (this.activeLimbo.exhaustOnResolve) this.handleExhaust(card)
        else if (resolveCard(card).type !== 'power') this.state.player.discardPile.push(card)
        const parent = this.suspendedCards.pop()
        this.activeLimbo = parent?.limbo
        if (parent) this.queue.push(...parent.actions)
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
            if (card.defId === 'DOUBT' || card.defId === 'SHAME') this.enqueue({ kind: 'ApplyPower', target: this.state.player.id, powerId: card.defId === 'DOUBT' ? 'WEAK' : 'FRAIL', stacks: 1 })
            if (card.defId === 'DECAY') this.enqueue({ kind: 'DealDamage', source: this.state.player.id, target: this.state.player.id, amount: 2, damageType: 'effect', fromCard: true })
            if (card.defId === 'BURN') this.enqueue({ kind: 'DealDamage', source: this.state.player.id, target: this.state.player.id, amount: card.upgradeLevel > 0 ? 4 : 2, damageType: 'effect', fromCard: true })
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
        if (player.hand.length >= HAND_LIMIT || powerAmount(player, 'NO_DRAW') > 0) return false
        if (player.drawPile.length === 0) {
            if (player.discardPile.length === 0) return false
            this.rng.shuffleInPlace(player.discardPile)
            player.drawPile.push(...player.discardPile)
            player.discardPile = []
        }
        const card = player.drawPile.shift()
        if (!card) return false
        player.hand.push(card)
        if (powerAmount(player, 'CONFUSION') > 0 && !resolveCard(card).unplayable && !resolveCard(card).xCost) card.confusedCost = this.rng.int(0, 3)
        onCardDrawn(this, card)
        return true
    }

    private insertCard(card: CardInstance, destination: CardDestination): void {
        if (destination === 'hand') {
            const pile = this.state.player.hand.length < HAND_LIMIT ? this.state.player.hand : this.state.player.discardPile
            pile.push(card)
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
        const threats = this.state.enemies.filter(enemy => !enemy.tags?.includes('minion'))
        if ((threats.length > 0 ? threats : this.state.enemies).every(enemy => enemy.hp <= 0 && !(enemy.halfDead && enemy.specId === 'AWAKENED_ONE'))) {
            for (const enemy of this.state.enemies) { if (enemy.tags?.includes('minion')) enemy.hp = 0 }
            // Finish effects of the killing action, including retaliation, without
            // starting another move or turn after the encounter has ended.
            this.queue = this.queue.filter(action => !['StartEnemyTurn', 'EndTurn', 'EnemyMove', 'EnemyEffect', 'EnemyMoveFinished'].includes(action.kind))
            if (this.queue.length) return
            this.state.victory = true
            events.push({ kind: 'Victory' })
        }
    }

    private tickTemporaryDebuffs(target: PlayerState | EnemyState): void {
        for (let i = target.powers.length - 1; i >= 0; i--) {
            const power = target.powers[i]
            if (power.id !== 'WEAK' && power.id !== 'VULNERABLE' && power.id !== 'FRAIL' && power.id !== 'ENTANGLED') continue
            if (power.fresh) { power.fresh = false; continue }
            power.stacks -= 1
            if (power.stacks <= 0) target.powers.splice(i, 1)
        }
    }

    private onEnemyKilledByCard(cardInstanceId: string, _enemyId: EntityId): void {
        const runtime = this.getCombatCardRuntime(cardInstanceId)
        if (runtime.triggered) return
        const card = [
            ...this.state.player.hand,
            ...this.state.player.drawPile,
            ...this.state.player.discardPile,
            ...this.state.player.exhaustPile,
            ...(this.activeLimbo ? [this.activeLimbo.card] : []),
            ...this.state.player.deck,
        ].find(entry => entry.instanceId === cardInstanceId)
        const victim = this.state.enemies.find(enemy => enemy.id === _enemyId)
        const regrowing = victim?.halfDead && !(victim.specId === 'DARKLING' && !this.state.enemies.some(enemy => enemy.hp > 0))
        if (!card || card.defId !== 'FEED' || regrowing || victim?.tags?.includes('minion')) return
        runtime.triggered = true
        const gain = card.upgradeLevel > 0 ? 4 : 3
        this.state.player.maxHp += gain
        if (!this.run?.relics.includes('MARK_OF_THE_BLOOM')) this.state.player.hp += gain
    }

    private getRelicContext() {
        if (!this.run) throw new Error('Relic context requested without run state')
        return createRelicCombatContext(this, this.run, this.relicRuntime)
    }

    private normalizePlayerThorns(): void {
        this.temporaryThorns = 0
        this.setPowerStacks(this.state.player, 'THORNS', this.basePlayerThorns)
    }

    setPowerStacks(target: PlayerState | EnemyState, powerId: PowerInstance['id'], stacks: number): void {
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
    const combatDeck = deck.map(card => ({ ...card }))
    const fullDeck = [...combatDeck]
    rng.shuffleInPlace(fullDeck)
    fullDeck.sort((a, b) => Number(Boolean(resolveCard(b).innate)) - Number(Boolean(resolveCard(a).innate)))
    return {
        id: 'player',
        maxHp,
        hp,
        block: 0,
        energy: 3,
        deck: combatDeck,
        drawPile: [...fullDeck],
        discardPile: [],
        exhaustPile: [],
        hand: [],
        powers: [],
    }
}
