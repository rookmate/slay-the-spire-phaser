import type { MetaState } from './meta'
import { getEffectiveUnlockedCardIds } from './meta'
import type { CardDef, CardEngineApi, CardInstance, ChoiceZone } from './state'

function playerStrength(engine: { state: { player: { powers: Array<{ id: string; stacks: number }> } } }): number {
    return engine.state.player.powers.find(power => power.id === 'STRENGTH')?.stacks ?? 0
}

function attackAmount(engine: CardEngineApi, card: CardInstance, base: number): number {
    return engine.modifyOutgoingAttackDamageFromPlayer?.(base, card.instanceId) ?? (base + playerStrength(engine))
}

function isUpgraded(card: CardInstance): boolean {
    return card.upgradeLevel > 0
}

let fallbackCardInstanceId = 0

function createInstanceId(defId: string): string {
    const randomId = globalThis.crypto?.randomUUID?.()
    if (randomId) return `${defId.toLowerCase()}-${randomId}`
    fallbackCardInstanceId += 1
    return `${defId.toLowerCase()}-${fallbackCardInstanceId}`
}

export function createCardInstance(defId: string, upgradeLevel = 0): CardInstance {
    return {
        instanceId: createInstanceId(defId),
        defId,
        upgradeLevel,
    }
}

export function createCardCopy(card: CardInstance): CardInstance {
    return createCardInstance(card.defId, card.upgradeLevel)
}

export function createStarterDeck(): CardInstance[] {
    const deck: CardInstance[] = []
    for (let i = 0; i < 5; i++) deck.push(createCardInstance('STRIKE'))
    for (let i = 0; i < 4; i++) deck.push(createCardInstance('DEFEND'))
    deck.push(createCardInstance('BASH'))
    return deck
}

export function canUpgradeCard(card: CardInstance): boolean {
    return card.defId === 'SEARING_BLOW' || card.upgradeLevel === 0
}

export function getCardCombatBonusDamage(engine: CardEngineApi, instanceId: string): number {
    return engine.getCardCombatBonusDamage?.(instanceId) ?? 0
}

export function modifyCardCombatBonusDamage(engine: CardEngineApi, instanceId: string, delta: number): number {
    return engine.modifyCardCombatBonusDamage?.(instanceId, delta) ?? 0
}

function chooseOneCard(engine: CardEngineApi, opts: {
    card: CardInstance
    prompt: string
    zone: ChoiceZone
    eligibleInstanceIds: string[]
    canSkip?: boolean
    onSubmit: (instanceId: string) => void
}): void {
    if (opts.eligibleInstanceIds.length === 0) return
    engine.beginChoice?.({
        prompt: opts.prompt,
        zone: opts.zone,
        eligibleInstanceIds: opts.eligibleInstanceIds,
        minSelections: 1,
        maxSelections: 1,
        canSkip: opts.canSkip ?? false,
        sourceCardInstanceId: opts.card.instanceId,
        onSubmit: (instanceIds) => {
            const instanceId = instanceIds[0]
            if (!instanceId) return
            opts.onSubmit(instanceId)
        },
    })
}

function searingBlowDamage(upgradeLevel: number): number {
    return 12 + (upgradeLevel * (upgradeLevel + 7)) / 2
}

export interface ResolvedCardDef extends CardDef {
    name: string
    cost: number
    exhaust: boolean
    xCost: boolean
    unplayable: boolean
    ethereal: boolean
    baseDamage?: number
    baseBlock?: number
}

export const CARD_DEFS: Record<string, CardDef> = {
    STRIKE: {
        id: 'STRIKE',
        name: 'Strike',
        type: 'attack',
        cost: 1,
        baseDamage: 6,
        rarity: 'basic',
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 9 },
    },
    DEFEND: {
        id: 'DEFEND',
        name: 'Defend',
        type: 'skill',
        cost: 1,
        baseBlock: 5,
        rarity: 'basic',
        targeting: { type: 'none' },
        upgrade: { baseBlock: 8 },
    },
    BASH: {
        id: 'BASH',
        name: 'Bash',
        type: 'attack',
        cost: 2,
        baseDamage: 8,
        rarity: 'basic',
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 10 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'VULNERABLE', stacks: isUpgraded(card) ? 3 : 2 })
        },
    },
    BARRICADE: {
        id: 'BARRICADE',
        name: 'Barricade',
        type: 'power',
        cost: 3,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: { cost: 2 },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'BARRICADE', stacks: 1 })
        },
    },
    METALLICIZE: {
        id: 'METALLICIZE',
        name: 'Metallicize',
        type: 'power',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'METALLICIZE', stacks: isUpgraded(card) ? 4 : 3 })
        },
    },
    DEMON_FORM: {
        id: 'DEMON_FORM',
        name: 'Demon Form',
        type: 'power',
        cost: 3,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'DEMON_FORM', stacks: isUpgraded(card) ? 3 : 2 })
        },
    },
    CORRUPTION: {
        id: 'CORRUPTION',
        name: 'Corruption',
        type: 'power',
        cost: 3,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: { cost: 2 },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'CORRUPTION', stacks: 1 })
        },
    },
    FEEL_NO_PAIN: {
        id: 'FEEL_NO_PAIN',
        name: 'Feel No Pain',
        type: 'power',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'FEEL_NO_PAIN', stacks: isUpgraded(card) ? 2 : 1 })
        },
    },
    JUGGERNAUT: {
        id: 'JUGGERNAUT',
        name: 'Juggernaut',
        type: 'power',
        cost: 2,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'JUGGERNAUT', stacks: isUpgraded(card) ? 2 : 1 })
        },
    },
    DARK_EMBRACE: {
        id: 'DARK_EMBRACE',
        name: 'Dark Embrace',
        type: 'power',
        cost: 2,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: { cost: 1 },
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'DARK_EMBRACE', stacks: isUpgraded(card) ? 2 : 1 })
        },
    },
    BRUTALITY: {
        id: 'BRUTALITY',
        name: 'Brutality',
        type: 'power',
        cost: 0,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'BRUTALITY', stacks: isUpgraded(card) ? 2 : 1 })
        },
    },
    BERSERK: {
        id: 'BERSERK',
        name: 'Berserk',
        type: 'power',
        cost: 0,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'BERSERK', stacks: isUpgraded(card) ? 2 : 1 })
        },
    },
    DOUBLE_TAP: {
        id: 'DOUBLE_TAP',
        name: 'Double Tap',
        type: 'skill',
        cost: 1,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.setDoubleTapCharges?.(isUpgraded(card) ? 2 : 1)
        },
    },
    EXHUME: {
        id: 'EXHUME',
        name: 'Exhume',
        type: 'skill',
        cost: 1,
        rarity: 'rare',
        exhaust: true,
        targeting: { type: 'none' },
        upgrade: { cost: 0 },
        onPlay: ({ engine, card }) => {
            const limboCardId = engine.getLimboCard?.()?.instanceId
            const eligible = (engine.getCardsInZone?.('exhaust') ?? [])
                .filter(entry => entry.instanceId !== limboCardId)
                .map(entry => entry.instanceId)

            chooseOneCard(engine, {
                card,
                prompt: 'Choose a card to return to your hand',
                zone: 'exhaust',
                eligibleInstanceIds: eligible,
                onSubmit: (instanceId) => engine.moveCardToDestination?.(instanceId, 'exhaust', 'hand'),
            })
        },
    },
    FIEND_FIRE: {
        id: 'FIEND_FIRE',
        name: 'Fiend Fire',
        type: 'attack',
        cost: 2,
        rarity: 'rare',
        baseDamage: 7,
        exhaust: true,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 10 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const hitDamage = attackAmount(engine, card, resolveCard(card).baseDamage ?? 0)
            const toExhaust = [...engine.state.player.hand]
            for (const next of toExhaust) engine.handleExhaustFromHand?.(next)
            for (let i = 0; i < toExhaust.length; i++) {
                engine.enqueue({ kind: 'DealDamage', source, target, amount: hitDamage })
            }
        },
    },
    CLEAVE: {
        id: 'CLEAVE',
        name: 'Cleave',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        baseDamage: 8,
        targeting: { type: 'all_enemies', required: true },
        upgrade: { baseDamage: 11 },
        onPlay: ({ engine, source, card }) => {
            const resolved = resolveCard(card)
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) engine.enqueue({ kind: 'DealDamage', source, target: enemy.id, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
            }
        },
    },
    POMMEL_STRIKE: {
        id: 'POMMEL_STRIKE',
        name: 'Pommel Strike',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        baseDamage: 9,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 10 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
            engine.enqueue({ kind: 'DrawCards', count: isUpgraded(card) ? 2 : 1 })
        },
    },
    SHRUG_IT_OFF: {
        id: 'SHRUG_IT_OFF',
        name: 'Shrug It Off',
        type: 'skill',
        cost: 1,
        rarity: 'common',
        baseBlock: 8,
        targeting: { type: 'none' },
        upgrade: { baseBlock: 11 },
        onPlay: ({ engine, card }) => {
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: resolved.baseBlock ?? 0 })
            engine.enqueue({ kind: 'DrawCards', count: 1 })
        },
    },
    TWIN_STRIKE: {
        id: 'TWIN_STRIKE',
        name: 'Twin Strike',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        baseDamage: 5,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 7 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            const amount = attackAmount(engine, card, resolved.baseDamage ?? 0)
            engine.enqueue({ kind: 'DealDamage', source, target, amount })
            engine.enqueue({ kind: 'DealDamage', source, target, amount })
        },
    },
    BODY_SLAM: {
        id: 'BODY_SLAM',
        name: 'Body Slam',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        upgrade: { cost: 0 },
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            if (engine.state.player.block > 0) {
                engine.enqueue({ kind: 'DealDamage', source, target, amount: engine.state.player.block })
            }
        },
    },
    IRON_WAVE: {
        id: 'IRON_WAVE',
        name: 'Iron Wave',
        type: 'attack',
        cost: 1,
        baseDamage: 5,
        baseBlock: 5,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 7, baseBlock: 7 },
    },
    ANGER: {
        id: 'ANGER',
        name: 'Anger',
        type: 'attack',
        cost: 0,
        rarity: 'common',
        baseDamage: 6,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 8 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
            engine.createCardsInDestination?.('ANGER', 'discardPile', 1, card.upgradeLevel)
        },
    },
    CLOTHESLINE: {
        id: 'CLOTHESLINE',
        name: 'Clothesline',
        type: 'attack',
        cost: 2,
        rarity: 'common',
        baseDamage: 12,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 14 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'WEAK', stacks: isUpgraded(card) ? 3 : 2 })
        },
    },
    UPPERCUT: {
        id: 'UPPERCUT',
        name: 'Uppercut',
        type: 'attack',
        cost: 2,
        rarity: 'uncommon',
        baseDamage: 13,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 16 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            const stacks = isUpgraded(card) ? 2 : 1
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'VULNERABLE', stacks })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'WEAK', stacks })
        },
    },
    SWORD_BOOMERANG: {
        id: 'SWORD_BOOMERANG',
        name: 'Sword Boomerang',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        upgrade: {},
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const amount = attackAmount(engine, card, isUpgraded(card) ? 4 : 3)
            for (let i = 0; i < 3; i++) engine.enqueue({ kind: 'DealDamage', source, target, amount })
        },
    },
    THUNDERCLAP: {
        id: 'THUNDERCLAP',
        name: 'Thunderclap',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        baseDamage: 4,
        targeting: { type: 'all_enemies', required: true },
        upgrade: { baseDamage: 7 },
        onPlay: ({ engine, source, card }) => {
            const resolved = resolveCard(card)
            for (const enemy of engine.state.enemies) {
                if (enemy.hp <= 0) continue
                engine.enqueue({ kind: 'DealDamage', source, target: enemy.id, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
                engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'VULNERABLE', stacks: 1 })
            }
        },
    },
    HEADBUTT: {
        id: 'HEADBUTT',
        name: 'Headbutt',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        baseDamage: 9,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 12 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
            engine.deferChoice?.(() => {
                chooseOneCard(engine, {
                    card,
                    prompt: 'Choose a card to place on top of your draw pile',
                    zone: 'discard',
                    eligibleInstanceIds: (engine.getCardsInZone?.('discard') ?? []).map(entry => entry.instanceId),
                    onSubmit: (instanceId) => engine.moveCardToDestination?.(instanceId, 'discard', 'drawPileTop'),
                })
            })
        },
    },
    HEAVY_BLADE: {
        id: 'HEAVY_BLADE',
        name: 'Heavy Blade',
        type: 'attack',
        cost: 2,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        upgrade: {},
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const strength = playerStrength(engine)
            const multiplier = isUpgraded(card) ? 5 : 3
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, 14 + strength * (multiplier - 1)) })
        },
    },
    PERFECTED_STRIKE: {
        id: 'PERFECTED_STRIKE',
        name: 'Perfected Strike',
        type: 'attack',
        cost: 2,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        upgrade: {},
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const strikeCount = engine.state.player.deck.filter(entry => CARD_DEFS[entry.defId]?.name.toLowerCase().includes('strike')).length
            const perStrike = isUpgraded(card) ? 3 : 2
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, 6 + strikeCount * perStrike) })
        },
    },
    TRUE_GRIT: {
        id: 'TRUE_GRIT',
        name: 'True Grit',
        type: 'skill',
        cost: 1,
        rarity: 'common',
        baseBlock: 7,
        targeting: { type: 'none' },
        upgrade: { baseBlock: 9 },
        onPlay: ({ engine, card }) => {
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: resolved.baseBlock ?? 0 })
            engine.deferChoice?.(() => {
                const handCards = engine.getCardsInZone?.('hand') ?? []
                if (handCards.length === 0) return
                if (!isUpgraded(card)) {
                    const picked = handCards[engine.randomInt?.(0, handCards.length - 1) ?? 0]
                    if (picked) engine.handleExhaustFromHand?.(picked)
                    return
                }
                chooseOneCard(engine, {
                    card,
                    prompt: 'Choose a card to exhaust',
                    zone: 'hand',
                    eligibleInstanceIds: handCards.map(entry => entry.instanceId),
                    onSubmit: (instanceId) => {
                        const picked = handCards.find(entry => entry.instanceId === instanceId)
                        if (picked) engine.handleExhaustFromHand?.(picked)
                    },
                })
            })
        },
    },
    WARCRY: {
        id: 'WARCRY',
        name: 'Warcry',
        type: 'skill',
        cost: 0,
        rarity: 'common',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'DrawCards', count: isUpgraded(card) ? 2 : 1 })
            engine.deferChoice?.(() => {
                chooseOneCard(engine, {
                    card,
                    prompt: 'Choose a card to place on top of your draw pile',
                    zone: 'hand',
                    eligibleInstanceIds: (engine.getCardsInZone?.('hand') ?? []).map(entry => entry.instanceId),
                    onSubmit: (instanceId) => engine.moveCardToDestination?.(instanceId, 'hand', 'drawPileTop'),
                })
            })
        },
    },
    WILD_STRIKE: {
        id: 'WILD_STRIKE',
        name: 'Wild Strike',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        baseDamage: 12,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 17 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
            engine.createCardsInDestination?.('WOUND', 'drawPile', 1)
        },
    },
    CLASH: {
        id: 'CLASH',
        name: 'Clash',
        type: 'attack',
        cost: 0,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        upgrade: {},
        canPlay: ({ engine }) => engine.state.player.hand.every(entry => CARD_DEFS[entry.defId]?.type === 'attack'),
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, isUpgraded(card) ? 18 : 14) })
        },
    },
    ARMAMENTS: {
        id: 'ARMAMENTS',
        name: 'Armaments',
        type: 'skill',
        cost: 1,
        rarity: 'common',
        baseBlock: 5,
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: resolveCard(card).baseBlock ?? 0 })
            engine.deferChoice?.(() => {
                const handCards = engine.getCardsInZone?.('hand') ?? []
                if (handCards.length === 0) return
                if (isUpgraded(card)) {
                    for (const entry of handCards) engine.upgradeCardInstance?.(entry.instanceId, ['hand'])
                    return
                }
                chooseOneCard(engine, {
                    card,
                    prompt: 'Choose a card to upgrade',
                    zone: 'hand',
                    eligibleInstanceIds: handCards.map(entry => entry.instanceId),
                    onSubmit: (instanceId) => engine.upgradeCardInstance?.(instanceId, ['hand']),
                })
            })
        },
    },
    BATTLE_TRANCE: {
        id: 'BATTLE_TRANCE',
        name: 'Battle Trance',
        type: 'skill',
        cost: 0,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'DrawCards', count: isUpgraded(card) ? 4 : 3 })
        },
    },
    BLOODLETTING: {
        id: 'BLOODLETTING',
        name: 'Bloodletting',
        type: 'skill',
        cost: 0,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 3 })
            engine.enqueue({ kind: 'GainEnergy', amount: isUpgraded(card) ? 3 : 2 })
        },
    },
    BURNING_PACT: {
        id: 'BURNING_PACT',
        name: 'Burning Pact',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            const handCards = engine.getCardsInZone?.('hand') ?? []
            chooseOneCard(engine, {
                card,
                prompt: 'Choose a card to exhaust',
                zone: 'hand',
                eligibleInstanceIds: handCards.map(entry => entry.instanceId),
                onSubmit: (instanceId) => {
                    const picked = handCards.find(entry => entry.instanceId === instanceId)
                    if (picked) engine.handleExhaustFromHand?.(picked)
                    engine.enqueue({ kind: 'DrawCards', count: isUpgraded(card) ? 3 : 2 })
                },
            })
        },
    },
    DROPKICK: {
        id: 'DROPKICK',
        name: 'Dropkick',
        type: 'attack',
        cost: 1,
        rarity: 'uncommon',
        baseDamage: 5,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 8 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
            const enemy = engine.state.enemies.find(entry => entry.id === target)
            if (enemy?.powers.find(power => power.id === 'VULNERABLE')?.stacks) {
                engine.enqueue({ kind: 'GainEnergy', amount: 1 })
                engine.enqueue({ kind: 'DrawCards', count: 1 })
            }
        },
    },
    ENTRENCH: {
        id: 'ENTRENCH',
        name: 'Entrench',
        type: 'skill',
        cost: 2,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: { cost: 1 },
        onPlay: ({ engine }) => {
            if (engine.state.player.block > 0) engine.enqueue({ kind: 'GainBlock', target: 'player', amount: engine.state.player.block })
        },
    },
    FLAME_BARRIER: {
        id: 'FLAME_BARRIER',
        name: 'Flame Barrier',
        type: 'skill',
        cost: 2,
        rarity: 'uncommon',
        baseBlock: 12,
        targeting: { type: 'none' },
        upgrade: { baseBlock: 16 },
        onPlay: ({ engine, card }) => {
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: resolved.baseBlock ?? 0 })
            engine.addTemporaryThorns?.(isUpgraded(card) ? 6 : 4)
        },
    },
    GHOSTLY_ARMOR: {
        id: 'GHOSTLY_ARMOR',
        name: 'Ghostly Armor',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        baseBlock: 10,
        ethereal: true,
        targeting: { type: 'none' },
        upgrade: { baseBlock: 13 },
    },
    HEMOKINESIS: {
        id: 'HEMOKINESIS',
        name: 'Hemokinesis',
        type: 'attack',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'single_enemy', required: true },
        upgrade: {},
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 2 })
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, isUpgraded(card) ? 20 : 15) })
        },
    },
    INTIMIDATE: {
        id: 'INTIMIDATE',
        name: 'Intimidate',
        type: 'skill',
        cost: 0,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'WEAK', stacks: isUpgraded(card) ? 2 : 1 })
            }
        },
    },
    POWER_THROUGH: {
        id: 'POWER_THROUGH',
        name: 'Power Through',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        baseBlock: 15,
        targeting: { type: 'none' },
        upgrade: { baseBlock: 20 },
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: resolveCard(card).baseBlock ?? 0 })
            engine.createCardsInDestination?.('WOUND', 'hand', 2)
        },
    },
    PUMMEL: {
        id: 'PUMMEL',
        name: 'Pummel',
        type: 'attack',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'single_enemy', required: true },
        upgrade: {},
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const amount = attackAmount(engine, card, 2)
            const hits = isUpgraded(card) ? 5 : 4
            for (let i = 0; i < hits; i++) engine.enqueue({ kind: 'DealDamage', source, target, amount })
        },
    },
    SEEING_RED: {
        id: 'SEEING_RED',
        name: 'Seeing Red',
        type: 'skill',
        cost: 0,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        exhaust: true,
        upgrade: { exhaust: false },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'GainEnergy', amount: 2 })
        },
    },
    SEARING_BLOW: {
        id: 'SEARING_BLOW',
        name: 'Searing Blow',
        type: 'attack',
        cost: 2,
        rarity: 'uncommon',
        baseDamage: 12,
        targeting: { type: 'single_enemy', required: true },
    },
    SENTINEL: {
        id: 'SENTINEL',
        name: 'Sentinel',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        baseBlock: 5,
        targeting: { type: 'none' },
        upgrade: { baseBlock: 8 },
        onExhaust: ({ engine, card }) => {
            engine.enqueue({ kind: 'GainEnergy', amount: isUpgraded(card) ? 3 : 2 })
        },
    },
    SHOCKWAVE: {
        id: 'SHOCKWAVE',
        name: 'Shockwave',
        type: 'skill',
        cost: 2,
        rarity: 'uncommon',
        exhaust: true,
        targeting: { type: 'all_enemies', required: true },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            const stacks = isUpgraded(card) ? 3 : 2
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) {
                    engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'WEAK', stacks })
                    engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'VULNERABLE', stacks })
                }
            }
        },
    },
    SPOT_WEAKNESS: {
        id: 'SPOT_WEAKNESS',
        name: 'Spot Weakness',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'single_enemy', required: true },
        upgrade: {},
        onPlay: ({ engine, targets, card }) => {
            const target = targets[0]
            const enemy = engine.state.enemies.find(entry => entry.id === target)
            if (enemy?.intent?.kind === 'attack') {
                engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'STRENGTH', stacks: isUpgraded(card) ? 4 : 3 })
            }
        },
    },
    DISARM: {
        id: 'DISARM',
        name: 'Disarm',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        exhaust: true,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { exhaust: false },
        onPlay: ({ engine, targets, card }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'STRENGTH', stacks: isUpgraded(card) ? -3 : -2 })
        },
    },
    FLEX: {
        id: 'FLEX',
        name: 'Flex',
        type: 'skill',
        cost: 0,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            const amount = isUpgraded(card) ? 4 : 2
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'STRENGTH', stacks: amount })
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'STRENGTH_DOWN_NEXT_TURN', stacks: amount })
        },
    },
    RECKLESS_CHARGE: {
        id: 'RECKLESS_CHARGE',
        name: 'Reckless Charge',
        type: 'attack',
        cost: 0,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 10 },
        baseDamage: 7,
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
            engine.createCardsInDestination?.('DAZED', 'drawPile', 1)
        },
    },
    RAGE: {
        id: 'RAGE',
        name: 'Rage',
        type: 'skill',
        cost: 0,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'RAGE', stacks: isUpgraded(card) ? 5 : 3 })
        },
    },
    EVOLVE: {
        id: 'EVOLVE',
        name: 'Evolve',
        type: 'power',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'EVOLVE', stacks: isUpgraded(card) ? 2 : 1 })
        },
    },
    SECOND_WIND: {
        id: 'SECOND_WIND',
        name: 'Second Wind',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        exhaust: true,
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            const exhausted = engine.exhaustCardsInHand?.((entry) => resolveCard(entry).type !== 'attack') ?? []
            if (exhausted.length > 0) {
                engine.enqueue({ kind: 'GainBlock', target: 'player', amount: exhausted.length * (isUpgraded(card) ? 7 : 5) })
            }
        },
    },
    WHIRLWIND: {
        id: 'WHIRLWIND',
        name: 'Whirlwind',
        type: 'attack',
        cost: 0,
        xCost: true,
        rarity: 'uncommon',
        baseDamage: 5,
        targeting: { type: 'all_enemies', required: true },
        upgrade: { baseDamage: 8 },
        onPlay: ({ engine, source, card, spentEnergy }) => {
            const hitAmount = attackAmount(engine, card, resolveCard(card).baseDamage ?? 0)
            for (let i = 0; i < spentEnergy; i++) {
                for (const enemy of engine.state.enemies) {
                    if (enemy.hp > 0) engine.enqueue({ kind: 'DealDamage', source, target: enemy.id, amount: hitAmount })
                }
            }
        },
    },
    BLUDGEON: {
        id: 'BLUDGEON',
        name: 'Bludgeon',
        type: 'attack',
        cost: 3,
        rarity: 'rare',
        targeting: { type: 'single_enemy', required: true },
        upgrade: {},
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, isUpgraded(card) ? 42 : 32) })
        },
    },
    OFFERING: {
        id: 'OFFERING',
        name: 'Offering',
        type: 'skill',
        cost: 0,
        rarity: 'rare',
        exhaust: true,
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 6 })
            engine.enqueue({ kind: 'GainEnergy', amount: 2 })
            engine.enqueue({ kind: 'DrawCards', count: isUpgraded(card) ? 5 : 3 })
        },
    },
    IMPERVIOUS: {
        id: 'IMPERVIOUS',
        name: 'Impervious',
        type: 'skill',
        cost: 2,
        rarity: 'rare',
        exhaust: true,
        baseBlock: 30,
        targeting: { type: 'none' },
        upgrade: { baseBlock: 40 },
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: resolveCard(card).baseBlock ?? 0 })
        },
    },
    LIMIT_BREAK: {
        id: 'LIMIT_BREAK',
        name: 'Limit Break',
        type: 'skill',
        cost: 1,
        rarity: 'rare',
        exhaust: true,
        targeting: { type: 'none' },
        upgrade: { exhaust: false },
        onPlay: ({ engine }) => {
            const strength = engine.state.player.powers.find(power => power.id === 'STRENGTH')
            if (strength && strength.stacks > 0) engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'STRENGTH', stacks: strength.stacks })
        },
    },
    REAPER: {
        id: 'REAPER',
        name: 'Reaper',
        type: 'attack',
        cost: 2,
        rarity: 'rare',
        baseDamage: 4,
        targeting: { type: 'all_enemies', required: true },
        upgrade: { baseDamage: 5 },
        onPlay: ({ engine, source, card }) => {
            const resolved = resolveCard(card)
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) {
                    engine.enqueue({
                        kind: 'DealDamage',
                        source,
                        target: enemy.id,
                        amount: attackAmount(engine, card, resolved.baseDamage ?? 0),
                        lifestealTo: engine.state.player.id,
                    })
                }
            }
        },
    },
    COMBUST: {
        id: 'COMBUST',
        name: 'Combust',
        type: 'power',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'COMBUST', stacks: isUpgraded(card) ? 7 : 5 })
        },
    },
    FIRE_BREATHING: {
        id: 'FIRE_BREATHING',
        name: 'Fire Breathing',
        type: 'power',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'FIRE_BREATHING', stacks: isUpgraded(card) ? 10 : 6 })
        },
    },
    RAMPAGE: {
        id: 'RAMPAGE',
        name: 'Rampage',
        type: 'attack',
        cost: 1,
        rarity: 'uncommon',
        baseDamage: 8,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 11 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            engine.enqueue({
                kind: 'DealDamage',
                source,
                target,
                amount: attackAmount(engine, card, resolved.baseDamage ?? 0),
            })
            modifyCardCombatBonusDamage(engine, card.instanceId, isUpgraded(card) ? 8 : 5)
        },
    },
    IMMOLATE: {
        id: 'IMMOLATE',
        name: 'Immolate',
        type: 'attack',
        cost: 2,
        rarity: 'rare',
        baseDamage: 21,
        targeting: { type: 'all_enemies', required: true },
        upgrade: { baseDamage: 28 },
        onPlay: ({ engine, source, card }) => {
            const resolved = resolveCard(card)
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) {
                    engine.enqueue({ kind: 'DealDamage', source, target: enemy.id, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
                }
            }
            engine.createCardsInDestination?.('BURN', 'discardPile', 1)
        },
    },
    FEED: {
        id: 'FEED',
        name: 'Feed',
        type: 'attack',
        cost: 1,
        rarity: 'rare',
        baseDamage: 10,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 12 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
        },
    },
    DUAL_WIELD: {
        id: 'DUAL_WIELD',
        name: 'Dual Wield',
        type: 'skill',
        cost: 1,
        rarity: 'rare',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            const eligible = (engine.getCardsInZone?.('hand') ?? [])
                .filter(entry => {
                    const type = resolveCard(entry).type
                    return type === 'attack' || type === 'power'
                })
                .map(entry => entry.instanceId)
            chooseOneCard(engine, {
                card,
                prompt: 'Choose an Attack or Power to copy',
                zone: 'hand',
                eligibleInstanceIds: eligible,
                onSubmit: (instanceId) => {
                    engine.copyCardToHand?.(instanceId, isUpgraded(card) ? 2 : 1)
                },
            })
        },
    },
    WOUND: {
        id: 'WOUND',
        name: 'Wound',
        type: 'status',
        cost: 0,
        unplayable: true,
        poolEnabled: false,
        targeting: { type: 'none' },
    },
    DAZED: {
        id: 'DAZED',
        name: 'Dazed',
        type: 'status',
        cost: 0,
        unplayable: true,
        ethereal: true,
        poolEnabled: false,
        targeting: { type: 'none' },
    },
    BURN: {
        id: 'BURN',
        name: 'Burn',
        type: 'status',
        cost: 0,
        unplayable: true,
        poolEnabled: false,
        targeting: { type: 'none' },
    },
    SLIMED: {
        id: 'SLIMED',
        name: 'Slimed',
        type: 'status',
        cost: 1,
        exhaust: true,
        poolEnabled: false,
        targeting: { type: 'none' },
    },
    INJURY: {
        id: 'INJURY',
        name: 'Injury',
        type: 'curse',
        cost: 0,
        unplayable: true,
        poolEnabled: false,
        targeting: { type: 'none' },
    },
    CLUMSY: {
        id: 'CLUMSY',
        name: 'Clumsy',
        type: 'curse',
        cost: 0,
        unplayable: true,
        ethereal: true,
        poolEnabled: false,
        targeting: { type: 'none' },
    },
    REGRET: {
        id: 'REGRET',
        name: 'Regret',
        type: 'curse',
        cost: 0,
        unplayable: true,
        poolEnabled: false,
        targeting: { type: 'none' },
    },
    PAIN: {
        id: 'PAIN',
        name: 'Pain',
        type: 'curse',
        cost: 0,
        unplayable: true,
        poolEnabled: false,
        targeting: { type: 'none' },
    },
    PARASITE: {
        id: 'PARASITE',
        name: 'Parasite',
        type: 'curse',
        cost: 0,
        unplayable: true,
        poolEnabled: false,
        targeting: { type: 'none' },
    },
}

for (const def of Object.values(CARD_DEFS)) {
    def.implemented ??= true
    def.poolEnabled ??= def.type !== 'status' && def.type !== 'curse'
}

export function resolveCard(card: CardInstance): ResolvedCardDef {
    const def = CARD_DEFS[card.defId]
    const upgradeLevel = card.upgradeLevel
    const name = upgradeLevel <= 0
        ? def.name
        : card.defId === 'SEARING_BLOW'
            ? `${def.name}+${upgradeLevel}`
            : (def.upgrade?.name ?? `${def.name}+`)

    const baseDamage = card.defId === 'SEARING_BLOW'
        ? searingBlowDamage(upgradeLevel)
        : upgradeLevel > 0
            ? (def.upgrade?.baseDamage ?? def.baseDamage)
            : def.baseDamage

    const baseBlock = upgradeLevel > 0 ? (def.upgrade?.baseBlock ?? def.baseBlock) : def.baseBlock
    const cost = upgradeLevel > 0 ? (def.upgrade?.cost ?? def.cost) : def.cost
    const exhaust = upgradeLevel > 0 ? (def.upgrade?.exhaust ?? def.exhaust ?? false) : (def.exhaust ?? false)
    const xCost = upgradeLevel > 0 ? (def.upgrade?.xCost ?? def.xCost ?? false) : (def.xCost ?? false)
    const unplayable = upgradeLevel > 0 ? (def.upgrade?.unplayable ?? def.unplayable ?? false) : (def.unplayable ?? false)
    const ethereal = upgradeLevel > 0 ? (def.upgrade?.ethereal ?? def.ethereal ?? false) : (def.ethereal ?? false)

    return {
        ...def,
        name,
        cost,
        exhaust,
        xCost,
        unplayable,
        ethereal,
        baseDamage,
        baseBlock,
    }
}

export function isCurseCard(card: CardInstance | { defId: string }): boolean {
    return CARD_DEFS[card.defId]?.type === 'curse'
}

export function isCollectibleCard(id: string): boolean {
    const card = CARD_DEFS[id]
    return Boolean(card?.poolEnabled && card.type !== 'status' && card.type !== 'curse')
}

export function getUnlockedCollectibleCards(meta: MetaState, rarity?: 'basic' | 'common' | 'uncommon' | 'rare'): string[] {
    const unlocked = getEffectiveUnlockedCardIds(meta)
    return Object.values(CARD_DEFS)
        .filter(card => isCollectibleCard(card.id))
        .filter(card => unlocked.has(card.id))
        .filter(card => !rarity || card.rarity === rarity)
        .map(card => card.id)
}
