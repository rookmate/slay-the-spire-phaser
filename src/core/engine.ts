import { gainGold } from './health'
import { dynamicCostOffset } from './combat/cardCosts'
import { blightStacks, endlessAttackMultiplier, modifyEndlessEnemy } from './modes/endless'
import { startModifiedTurn, endModifiedTurn } from './modes/combat'
import { relicAllowsUnplayable, relicCardDamage, syncConditionalRelics, refillEmptyHand } from './combat/relicRules'
import { revivePlayer } from './combat/potions'
import { prepareRepeats } from './combat/repeats'
import { prepareRetainChoice, discardEndTurnHand } from './combat/retain'
import { startEnemyPoison, finishRoundPowers, startCharacterTurn, endCharacterTurn, onCharacterCardPlayed } from './combat/characterHooks'
import * as piles from './combat/piles'
import { channelOrb, evokeOrb, changeOrbSlots, triggerOrb, triggerOrbPassives } from './combat/orbs'
import { changeStance } from './combat/stances'
import { resolveCombatEffect } from './combat/effects'
import { executeEnemyEffect, executeEnemyMove, finishEnemyMove } from './enemyTurns'
import { onEndOfPlayerTurn, onPlayerCardPlayed as triggerPlayerCardPowers, onStartOfPlayerTurn } from './powerHooks'
import { damageAmount, powerAmount } from './combatMath'
import { RNG } from './rng'
import { CARD_DEFS, canUpgradeCard, createStarterDeck, resolveCard } from './cards'
import { onCardEffectsResolved, onPlayerCardPlayed, rollEngineIntentForEnemy } from './enemies'
import { POTION_DEFS, potionMultiplier, type PotionId } from './potions'
import {
    createRelicCombatContext,
    triggerRelicCardPlayed,
    triggerRelicCardResolved,
    triggerRelicHandReady,
    modifyAttackDamageFromRelics,
    triggerRelicAttackPlayed,
    triggerRelicCardExhausted,
    triggerRelicCombatStart,
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
    CombatCardRuntime,
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
    freeToPlay: boolean
    freeRepeat?: boolean
    remainingPlays: ('original' | 'echo' | 'other')[]
    rebound: boolean
    started?: boolean
    allowedTurnEndSequence?: number
}

export class Engine {
    readonly rng: RNG
    readonly state: CombatState
    private queue: Action[] = []
    private endTurnRequested = false
    private turnEndSequence = 0
    private baseEnergyPerTurn = 3
    private basePlayerThorns = 0
    private temporaryThorns = 0
    private suspendedCards: { limbo: InternalLimboCardState; actions: Action[] }[] = []
    private activeLimbo?: InternalLimboCardState
    private choiceSequence = 0
    private pendingChoice?: InternalPendingChoice
    readonly run?: RunState
    private relicRuntime: Partial<Record<RelicId, RelicCombatRuntimeEntry>> = {}
    private resolvingCardInstanceId?: string

    constructor(seed: string, player: PlayerState, enemies: EnemyState[], opts?: { asc?: number; run?: RunState }) {
        this.rng = new RNG(seed)
        this.state = {
            player,
            enemies,
            turn: 'player',
            turnNumber: 1,
            victory: false,
            defeat: false,
            limbo: [],
            cardRuntime: {},
            discardsThisTurn: 0,
            orbsChanneled: { lightning: 0, frost: 0, dark: 0, plasma: 0 },
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
        this.setPowerStacks(this.state.player, 'DOUBLE_TAP', powerAmount(this.state.player, 'DOUBLE_TAP') + charges)
    }

    configurePlayerCombatBonuses(opts: { baseThorns?: number; baseEnergyPerTurn?: number } = {}): void {
        this.basePlayerThorns = opts.baseThorns ?? this.basePlayerThorns
        this.baseEnergyPerTurn = opts.baseEnergyPerTurn ?? this.baseEnergyPerTurn
        if (opts.baseEnergyPerTurn !== undefined) this.state.player.energy = this.baseEnergyPerTurn
        if (this.basePlayerThorns > 0) this.setPowerStacks(this.state.player, 'THORNS', this.basePlayerThorns + this.temporaryThorns)
    }

    initializeCombat(): void {
        if (!this.run) return
        syncConditionalRelics(this)
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
        const remaining = this.queue; this.queue = []
        choice.onSubmit(validIds)
        this.queue.push(...remaining)
        if (!this.pendingChoice) this.resolveActiveLimbo()
        return []
    }

    cancelPendingChoice(): EmittedEvent[] {
        if (!this.pendingChoice || !this.pendingChoice.canSkip) return []
        const choice = this.pendingChoice
        this.pendingChoice = undefined
        const remaining = this.queue; this.queue = []
        choice.onCancel?.()
        this.queue.push(...remaining)
        if (!this.pendingChoice) this.resolveActiveLimbo()
        return []
    }

    beginChoice(choice: CardChoiceRequest): void {
        this.pendingChoice = { ...choice, id: ++this.choiceSequence }
    }

    deferChoice(startChoice: () => void): void {
        this.afterQueuedEffects(startChoice)
    }

    afterQueuedEffects(resolve: () => void): void { this.enqueue({ kind: 'CardEffect', resolve }) }

    getCardsInZone(zone: ChoiceZone): CardInstance[] { return piles.getCardsInZone(this, zone) }

    discardCards(instanceIds: string[], reason: 'manual' | 'end_turn' = 'manual'): void { return piles.discardCards(this, instanceIds, reason) }

    isCardFreeToPlay(card: CardInstance): boolean {
        if (this.activeLimbo?.card.instanceId === card.instanceId) return this.activeLimbo.freeToPlay || !!this.activeLimbo.freeRepeat
        return !resolveCard(card).xCost && this.getCardCost(card) === 0
    }

    getLimboCard(): CardInstance | undefined {
        return this.activeLimbo?.card
    }

    moveCardToDestination(instanceId: string, zone: ChoiceZone, destination: CardDestination): CardInstance | undefined { return piles.moveCardToDestination(this, instanceId, zone, destination) }

    createCardsInDestination(defId: string, destination: Exclude<CardDestination, 'drawPileTop' | 'exhaustPile'>, count = 1, upgradeLevel = 0): CardInstance[] { return piles.createCardsInDestination(this, defId, destination, count, upgradeLevel) }

    copyCardToHand(instanceId: string, count = 1): CardInstance[] { return piles.copyCardToHand(this, instanceId, count) }

    exhaustCardsInHand(predicate: (card: CardInstance) => boolean): CardInstance[] { return piles.exhaustCardsInHand(this, predicate) }

    getCombatCardRuntime(instanceId: string): CombatCardRuntime {
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
        for (const enemy of enemies.slice(0, openSlots)) { modifyEndlessEnemy(this.run, enemy); this.state.enemies.push(enemy) }
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

    requestEndTurn(): void { this.endTurnRequested = true; this.turnEndSequence++ }
    changeGold(amount: number): number {
        if (!this.run) return 0
        const previous = this.run.gold
        if (amount > 0) gainGold(this.run, amount, heal => this.enqueue({ kind: 'Heal', target: this.state.player.id, amount: heal }))
        else this.run.gold = Math.max(0, previous + amount)
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

    canUsePotion(potionId: PotionId, targetIds: EntityId[]): boolean {
        if (!this.canAcceptInput()) return false
        const def = POTION_DEFS[potionId]
        if (!def || (def.canUse && !def.canUse(this))) return false
        if (def.target === 'player') return targetIds.length === 1 && targetIds[0] === this.state.player.id
        if (def.target === 'single_enemy') return targetIds.length === 1 && this.state.enemies.some(enemy => enemy.id === targetIds[0] && enemy.hp > 0 && !enemy.halfDead)
        return targetIds.length === 0
    }

    usePotionAtIndex(index: number, targetIds: EntityId[]): EmittedEvent[] {
        const id = this.run?.potions[index]
        if (!id || !this.canUsePotion(id, targetIds)) return []
        // Release the slot before Entropic Brew generates its replacement potions.
        this.run!.potions.splice(index, 1)
        return this.usePotion(id, targetIds)
    }

    usePotion(potionId: PotionId, targetIds: EntityId[]): EmittedEvent[] {
        if (!this.canUsePotion(potionId, targetIds)) return []
        const def = POTION_DEFS[potionId]
        if (def.target === 'single_enemy') this.state.facingEnemyId = targetIds[0]
        def.use(this, targetIds, potionMultiplier(this.run, potionId))
        if (this.run?.relics.includes('TOY_ORNITHOPTER')) this.enqueue({ kind: 'Heal', target: this.state.player.id, amount: 5 })
        if (this.state.escaped) this.afterQueuedEffects(() => { this.state.victory = true })
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
            case 'StartPlayerTurn': this.startPlayerTurn(evts, action.extra); break
            case 'CardEffect': action.resolve(); break
            case 'OrbPassives': triggerOrbPassives(this, action.phase); break
            case 'ChannelOrb': channelOrb(this, action.orbType, action.storedDamage); break
            case 'EvokeOrb': evokeOrb(this, action.repeats, action.remove); break
            case 'ChangeOrbSlots': changeOrbSlots(this, action.amount); break
            case 'TriggerOrb': triggerOrb(this, action.orb, action.mode); break
            case 'ChangeStance': changeStance(this, action.stance); break
            case 'PlayTopCard':
            case 'AutoPlayCard': {
                if (this.endTurnRequested && !(action.kind === 'AutoPlayCard' && action.allowPendingTurnEnd)) break
                const player = this.state.player
                if (action.kind === 'PlayTopCard' && !piles.ensureDrawPile(this)) break
                const pile = action.kind === 'PlayTopCard' ? player.drawPile : this.getCardsInZone(action.zone)
                const index = action.kind === 'PlayTopCard' ? 0 : pile.findIndex(c => c.instanceId === action.cardInstanceId)
                const card = index < 0 ? undefined : pile.splice(index, 1)[0]
                if (!card) break
                const def = resolveCard(card)
                const living = this.state.enemies.filter(enemy => enemy.hp > 0).map(enemy => enemy.id)
                const targets = def.targeting?.type === 'single_enemy' ? (living.length ? [living[this.rng.int(0, living.length - 1)]] : [])
                    : def.targeting?.type === 'all_enemies' ? living : def.targeting?.type === 'player' ? [player.id] : []
                if (this.playLimitReached(card) || (def.unplayable && !relicAllowsUnplayable(this, card)) || !this.validateTargets(card, targets) || (def.type === 'attack' && powerAmount(player, 'ENTANGLED') > 0)
                    || (def.canPlay && !def.canPlay({ engine: this, source: player.id, targets, card }))) {
                    if (action.exhaust ?? action.kind === 'PlayTopCard') this.handleExhaust(card)
                    else this.insertCard(card, 'discardPile')
                    break
                }
                if (this.activeLimbo) this.suspendedCards.push({ limbo: this.activeLimbo, actions: remainingActions.splice(0) })
                this.prepareCardPlay(card, targets, { playCost: this.getCardCost(card), freeToPlay: true, forceExhaust: (action.exhaust ?? action.kind === 'PlayTopCard') && def.type !== 'power' })
                if (action.kind === 'AutoPlayCard' && this.activeLimbo) {
                    this.activeLimbo.allowedTurnEndSequence = action.allowPendingTurnEnd ? this.turnEndSequence : undefined
                    for (let i = 1; i < (action.repeats ?? 1); i++) this.activeLimbo.remainingPlays.push('other')
                }
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
                discardEndTurnHand(this)
                break
            }
            case 'StartEnemyTurn': {
                this.setPowerStacks(this.state.player, 'WAVE_OF_THE_HAND', 0)
                this.state.turn = 'enemy'
                evts.push({ kind: 'TurnChanged', turn: 'enemy' })
                for (const enemy of this.state.enemies) if (powerAmount(enemy, 'BARRICADE') === 0) enemy.block = 0
                startEnemyPoison(this)
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
                    endCharacterTurn(this)
                    endModifiedTurn(this)
                    if (this.run) triggerRelicPlayerTurnEnd(this.getRelicContext())
                    this.processEndOfTurnHand(evts)
                    this.enqueue({ kind: 'OrbPassives', phase: 'end' })
                    this.afterQueuedEffects(() => prepareRetainChoice(this))
                    this.enqueue({ kind: 'DiscardHand' })
                    this.setPowerStacks(this.state.player, 'DOUBLE_TAP', 0)
                    this.enqueue(this.state.extraTurn ? { kind: 'StartPlayerTurn', extra: true } : { kind: 'StartEnemyTurn' })
                    this.state.extraTurn = false
                } else {
                    this.enqueue({ kind: 'StartPlayerTurn' })
                }
                break
            }
            default: resolveCombatEffect(this, action, evts)

        }

        this.queue.push(...remainingActions)
        this.checkWinLose(evts)
        return evts
    }

    private startPlayerTurn(evts: EmittedEvent[], extra = false): void {
        this.setPowerStacks(this.state.player, 'WAVE_OF_THE_HAND', 0)
        if (!extra) {
            finishRoundPowers(this)
            this.tickTemporaryDebuffs(this.state.player)
            for (const enemy of this.state.enemies) this.tickTemporaryDebuffs(enemy)
        }
        this.state.turn = 'player'
        this.state.turnNumber = (this.state.turnNumber ?? 1) + 1
        this.state.nonCurseCardsPlayed = 0
        this.state.cardsPlayed = 0
        this.state.attacksThisTurn = 0
        this.state.echoRepeatsThisTurn = 0
        this.state.discardsThisTurn = 0
        this.setPowerStacks(this.state.player, 'NO_DRAW', 0)
        this.state.player.energy = (this.run?.relics.includes('ICE_CREAM') ? this.state.player.energy : 0) + Math.max(0, this.baseEnergyPerTurn - powerAmount(this.state.player, 'FASTING'))
        const hasBarricade = this.state.player.powers.find(power => power.id === 'BARRICADE')?.stacks ?? 0
        if (hasBarricade === 0 && powerAmount(this.state.player, 'BLUR') === 0) this.state.player.block = this.run?.relics.includes('CALIPERS') ? Math.max(0, this.state.player.block - 15) : 0
        if (!extra) this.setPowerStacks(this.state.player, 'BLUR', powerAmount(this.state.player, 'BLUR') - 1)
        this.normalizePlayerThorns()
        if (this.state.player.stance === 'divinity') changeStance(this, 'neutral')
        this.enqueue({ kind: 'OrbPassives', phase: 'start' })
        onStartOfPlayerTurn(this)
        startCharacterTurn(this)
        if (this.run) triggerRelicPlayerTurnStart(this.getRelicContext())
        if (!extra) for (const enemy of this.state.enemies) {
            if (enemy.hp <= 0 && !enemy.halfDead) continue
            enemy.intent = rollEngineIntentForEnemy(this.rng, enemy, this.state)
        }
        startModifiedTurn(this)
        for (const enemy of this.state.enemies) if (powerAmount(enemy, 'SLOW') > 0) enemy.aiState = { ...enemy.aiState, slow: 0 }
        const reducedDraw = powerAmount(this.state.player, 'DRAW_REDUCTION') > 0 ? 1 : 0
        this.enqueue({ kind: 'DrawCards', count: Math.max(0, 5 - reducedDraw - blightStacks(this.run, 'SCATTERBRAIN')) })
        if (this.run) triggerRelicHandReady(this.getRelicContext())
        if (!extra) this.setPowerStacks(this.state.player, 'DRAW_REDUCTION', Math.max(0, powerAmount(this.state.player, 'DRAW_REDUCTION') - 1))
        evts.push({ kind: 'TurnChanged', turn: 'player' })
    }

    runUntilIdle(): EmittedEvent[] {
        const all: EmittedEvent[] = []
        if (this.state.victory || this.state.defeat || this.pendingChoice) return all
        while (true) {
            while (this.queue.length > 0) {
                all.push(...this.step())
                if (this.state.victory || this.state.defeat || this.pendingChoice) return all
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
            if (refillEmptyHand(this)) continue
            return all
        }
    }

    private playLimitReached(card?: CardInstance): boolean { return ((this.run?.endlessLoop ?? 0) >= 2 && (this.state.nonCurseCardsPlayed ?? 0) >= 15 && (!card || resolveCard(card).type !== 'curse')) || (this.state.cardsPlayed ?? 0) >= (this.run?.relics.includes('VELVET_CHOKER') ? 6 : Infinity) || (this.state.cardsPlayed ?? 0) >= 3 && this.state.player.hand.some(c => c.defId === 'NORMALITY') }

    getCardCost(card: CardInstance): number {
        const def = resolveCard(card)
        if (def.unplayable && relicAllowsUnplayable(this, card)) return 0
        if (def.type === 'skill' && powerAmount(this.state.player, 'CORRUPTION') > 0) return 0
        if (def.type === 'attack' && powerAmount(this.state.player, 'FREE_ATTACK') > 0 && !def.xCost) return 0
        if (def.xCost) return this.state.player.energy
        const offset = dynamicCostOffset(this, card)
        const cost = card.confusedCost === undefined ? def.cost + offset
            : card.confusedCost + offset - (this.getCombatCardRuntime(card.instanceId).confusedCostOffset ?? 0)
        return Math.max(0, card.costForTurn ?? card.costUntilPlayed ?? card.costForCombat ?? cost)
    }

    getPlayableCards(): { card: CardInstance; targets: EntityId[]; cost: number }[] {
        return this.state.player.hand.flatMap(card => {
            const targeting = resolveCard(card).targeting?.type
            const living = this.state.enemies.filter(enemy => enemy.hp > 0).map(enemy => enemy.id)
            const candidates = targeting === 'single_enemy' ? living.map(id => [id])
                : [targeting === 'all_enemies' ? living : targeting === 'player' ? [this.state.player.id] : []]
            return candidates.filter(targets => this.canPlayCard(card, targets)).map(targets => ({ card, targets, cost: this.getCardCost(card) }))
        })
    }

    canPlayCard(card: CardInstance, targetIds: EntityId[]): boolean {
        const def = CARD_DEFS[card.defId]
        if (!def || !this.canAcceptInput()) return false
        const resolved = resolveCard(card)
        if (resolved.type === 'attack' && powerAmount(this.state.player, 'ENTANGLED') > 0) return false
        if (this.playLimitReached(card) || (resolved.unplayable && !relicAllowsUnplayable(this, card)) || !this.validateTargets(card, targetIds)) return false
        if (this.state.player.energy < this.getCardCost(card)) return false
        if (def.canPlay && !def.canPlay({ engine: this, source: this.state.player.id, targets: targetIds, card })) return false
        return this.state.player.hand.some(entry => entry.instanceId === card.instanceId)
    }

    playCard(card: CardInstance, targetIds: EntityId[]): EmittedEvent[] {
        if (!this.canPlayCard(card, targetIds)) return []
        const resolved = resolveCard(card)
        const effectiveCost = this.getCardCost(card)
        const handIndex = this.state.player.hand.findIndex(entry => entry.instanceId === card.instanceId)

        const freeAttack = resolved.type === 'attack' && powerAmount(this.state.player, 'FREE_ATTACK') > 0
        if (freeAttack) this.setPowerStacks(this.state.player, 'FREE_ATTACK', powerAmount(this.state.player, 'FREE_ATTACK') - 1)
        if (!freeAttack) this.state.player.energy -= effectiveCost
        const [playedCard] = this.state.player.hand.splice(handIndex, 1)
        this.prepareCardPlay(playedCard, targetIds, { playCost: effectiveCost, freeToPlay: freeAttack })

        const events: EmittedEvent[] = [
            { kind: 'EnergyChanged', energy: this.state.player.energy },
            { kind: 'CardPlayed', cardId: playedCard.defId, instanceId: playedCard.instanceId },
        ]

        this.resolveActiveLimbo()
        return events
    }

    private prepareCardPlay(card: CardInstance, targetIds: EntityId[], options: { playCost: number; freeToPlay?: boolean; forceExhaust?: boolean }): void {
        const def = resolveCard(card)
        card.costUntilPlayed = undefined
        this.getCombatCardRuntime(card.instanceId).triggered = false
        if (def.targeting?.type === 'single_enemy') this.state.facingEnemyId = targetIds[0]
        const remainingPlays = prepareRepeats(this, card, options.playCost)
        const rebound = powerAmount(this.state.player, 'REBOUND') > 0
        if (rebound) this.setPowerStacks(this.state.player, 'REBOUND', powerAmount(this.state.player, 'REBOUND') - 1)
        this.activeLimbo = {
            card, targetIds, freeToPlay: !!options.freeToPlay || (!def.xCost && options.playCost === 0), spentEnergy: options.playCost + (def.xCost && this.run?.relics.includes('CHEMICAL_X') ? 2 : 0),
            exhaustOnResolve: !!options.forceExhaust || def.exhaust || (def.unplayable && relicAllowsUnplayable(this, card)) || (def.type === 'skill' && powerAmount(this.state.player, 'CORRUPTION') > 0),
            remainingPlays, rebound,
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
        const multiplier = target === this.state.player && this.run?.relics.includes('ODD_MUSHROOM') ? 1.25 : target && 'name' in target && this.run?.relics.includes('PAPER_FROG') ? 1.75 : 1.5
        const surrounded = target === this.state.player && this.state.enemies.filter(enemy => enemy.hp > 0 && (enemy.specId === 'SPIRE_SHIELD' || enemy.specId === 'SPIRE_SPEAR')).length === 2
        const backAttack = surrounded && sourceId !== (this.state.facingEnemyId ?? this.state.enemies[0].id) ? 1.5 : 1
        return damageAmount(base, this.getEntity(sourceId), target, type, multiplier, backAttack * (target === this.state.player ? endlessAttackMultiplier(this.run) : 1), target === this.state.player && this.run?.relics.includes('PAPER_KRANE') ? 0.6 : 0.75)
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
        amount += strength + powerAmount(this.state.player, 'WREATH_OF_FLAME')
        if (this.run && cardInstanceId) amount = modifyAttackDamageFromRelics(this.getRelicContext(), amount, cardInstanceId)
        if (cardInstanceId) amount = relicCardDamage(this, amount, cardInstanceId)
        return Math.max(0, amount)
    }

    private resolveActiveLimbo(): void {
        if (this.queue.length > 0) return
        for (const enemy of this.state.enemies) onCardEffectsResolved(this, enemy)
        if (this.queue.length > 0) return
        while (this.activeLimbo && !this.pendingChoice) {
            if (this.endTurnRequested && this.activeLimbo.allowedTurnEndSequence !== this.turnEndSequence || this.playLimitReached(this.activeLimbo.card)) this.activeLimbo.remainingPlays = []
            if (this.activeLimbo.remainingPlays.length === 0) {
                this.finalizeActiveLimbo()
                return
            }

            const limbo = this.activeLimbo
            const playKind = limbo.remainingPlays.shift()!
            limbo.freeRepeat = playKind !== 'original'
            if (limbo.started && resolveCard(limbo.card).targeting?.type === 'single_enemy' && !this.state.enemies.some(e => e.id === limbo.targetIds[0] && e.hp > 0)) continue
            limbo.started = true
            if (playKind === 'echo') this.state.echoRepeatsThisTurn = (this.state.echoRepeatsThisTurn ?? 0) + 1
            this.state.previousCardType = this.state.lastCardType
            this.state.lastCardType = resolveCard(limbo.card).type
            this.state.cardsPlayed = (this.state.cardsPlayed ?? 0) + 1
            if (this.state.cardsPlayed >= 20) this.state.scoreCombo = true
            const def = CARD_DEFS[limbo.card.defId]
            const resolved = resolveCard(limbo.card)
            this.resolvingCardInstanceId = limbo.card.instanceId
            for (const pain of this.state.player.hand.filter(card => card.defId === 'PAIN')) {
                this.enqueue({ kind: 'LoseHp', target: this.state.player.id, amount: 1, fromCard: true })
                void pain
            }
            if (resolved.type === 'attack' && this.run) triggerRelicAttackPlayed(this.getRelicContext(), limbo.card.instanceId)
            if (this.run) triggerRelicCardPlayed(this.getRelicContext(), limbo.card)
            if (resolved.type === 'curse' && this.run?.relics.includes('BLUE_CANDLE')) this.enqueue({ kind: 'LoseHp', target: this.state.player.id, amount: 1 })
            triggerPlayerCardPowers(this, resolved.type)
            onCharacterCardPlayed(this, limbo.card)
            if (resolved.type !== 'curse') {
                this.state.nonCurseCardsPlayed = (this.state.nonCurseCardsPlayed ?? 0) + 1
            }

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
            if (this.run) this.afterQueuedEffects(() => triggerRelicCardResolved(this.getRelicContext(), limbo.card))
            if (resolved.type === 'attack') this.setPowerStacks(this.state.player, 'WREATH_OF_FLAME', 0)
            for (const enemy of this.state.enemies) onPlayerCardPlayed(this, enemy, resolved.type)
            this.resolvingCardInstanceId = undefined

            return
        }
    }

    private finalizeActiveLimbo(): void {
        if (!this.activeLimbo) return
        const card = this.activeLimbo.card
        if (this.activeLimbo.exhaustOnResolve && this.run?.relics.includes('STRANGE_SPOON') && this.rng.random() < 0.5) this.insertCard(card, 'discardPile')
        else if (this.activeLimbo.exhaustOnResolve) this.handleExhaust(card)
        else if (resolveCard(card).type !== 'power') this.insertCard(card, resolveCard(card).resolveDestination ?? (this.activeLimbo.rebound ? 'drawPileTop' : 'discardPile'))
        const parent = this.suspendedCards.pop()
        this.activeLimbo = parent?.limbo
        if (parent) this.queue.push(...parent.actions)
        this.syncLimboState()
    }

    processEndOfTurnHand(events: EmittedEvent[]): void { return piles.processEndOfTurnHand(this, events) }

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

    drawOne(): boolean { return piles.drawOne(this) }

    insertCard(card: CardInstance, destination: CardDestination): void { return piles.insertCard(this, card, destination) }

    getEntity(id: EntityId): PlayerState | EnemyState | undefined {
        if (id === this.state.player.id) return this.state.player
        return this.state.enemies.find(enemy => enemy.id === id)
    }

    private checkWinLose(events: EmittedEvent[]): void {
        if (this.state.player.hp <= 0 && !revivePlayer(this, events)) {
            this.state.defeat = true
            events.push({ kind: 'Defeat' })
            return
        }
        syncConditionalRelics(this)
        if (this.state.enemies.length === 0) return
        const threats = this.state.enemies.filter(enemy => !enemy.tags?.includes('minion'))
        if ((threats.length > 0 ? threats : this.state.enemies).every(enemy => enemy.hp <= 0 && !(enemy.halfDead && enemy.specId === 'AWAKENED_ONE'))) {
            for (const enemy of this.state.enemies) { if (enemy.tags?.includes('minion')) enemy.hp = 0 }
            // Finish effects of the killing action, including retaliation, without
            // starting another move or turn after the encounter has ended.
            this.queue = this.queue.filter(action => !['StartPlayerTurn', 'StartEnemyTurn', 'EndTurn', 'EnemyMove', 'EnemyEffect', 'EnemyMoveFinished'].includes(action.kind))
            if (this.queue.length) return
            const repair = powerAmount(this.state.player, 'SELF_REPAIR')
            if (repair > 0) {
                this.setPowerStacks(this.state.player, 'SELF_REPAIR', 0)
                this.enqueue({ kind: 'Heal', target: this.state.player.id, amount: repair })
                return
            }
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

    getRelicContext() {
        if (!this.run) throw new Error('Relic context requested without run state')
        return createRelicCombatContext(this, this.run, this.relicRuntime)
    }

    private normalizePlayerThorns(): void {
        this.temporaryThorns = 0
        this.setPowerStacks(this.state.player, 'THORNS', this.basePlayerThorns)
    }

    setPowerStacks(target: PlayerState | EnemyState, powerId: PowerInstance['id'], stacks: number): void {
        const current = target.powers.find(power => power.id === powerId)
        if (stacks === 0 || (stacks < 0 && !['STRENGTH', 'DEXTERITY', 'FOCUS'].includes(powerId))) {
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
        id: 'player', character: 'ironclad', orbs: [], orbSlots: 0, stance: 'neutral',
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
        id: 'player', character: 'ironclad', orbs: [], orbSlots: 0, stance: 'neutral',
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
