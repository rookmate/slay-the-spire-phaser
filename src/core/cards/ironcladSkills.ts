import type { CardDef } from '../state'
import { resolveCard, canUpgradeCard } from '../cards'
import { chooseOneCard, isUpgraded } from './helpers'

export const IRONCLAD_SKILLS: Record<string, CardDef> = {
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
                .filter(entry => entry.instanceId !== limboCardId && entry.defId !== 'EXHUME')
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
            engine.enqueue({ kind: 'GainBlock', blockSource: 'card', target: 'player', amount: resolved.baseBlock ?? 0 })
            engine.enqueue({ kind: 'DrawCards', count: 1 })
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
            engine.enqueue({ kind: 'GainBlock', blockSource: 'card', target: 'player', amount: resolved.baseBlock ?? 0 })
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
        exhaust: true,
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
            engine.enqueue({ kind: 'GainBlock', blockSource: 'card', target: 'player', amount: resolveCard(card).baseBlock ?? 0 })
            engine.deferChoice?.(() => {
                const handCards = (engine.getCardsInZone?.('hand') ?? []).filter(canUpgradeCard)
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
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'NO_DRAW', stacks: 1 })
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
            if (!handCards.length) {
                engine.enqueue({ kind: 'DrawCards', count: isUpgraded(card) ? 3 : 2 })
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
                    engine.enqueue({ kind: 'DrawCards', count: isUpgraded(card) ? 3 : 2 })
                },
            })
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
            if (engine.state.player.block > 0) engine.enqueue({ kind: 'GainBlock', blockSource: 'effect', target: 'player', amount: engine.state.player.block })
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
            engine.enqueue({ kind: 'GainBlock', blockSource: 'card', target: 'player', amount: resolved.baseBlock ?? 0 })
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
    INTIMIDATE: {
        id: 'INTIMIDATE',
        name: 'Intimidate',
        type: 'skill',
        cost: 0,
        rarity: 'uncommon',
        exhaust: true,
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
            engine.enqueue({ kind: 'GainBlock', blockSource: 'card', target: 'player', amount: resolveCard(card).baseBlock ?? 0 })
            engine.createCardsInDestination?.('WOUND', 'hand', 2)
        },
    },
    SEEING_RED: {
        id: 'SEEING_RED',
        name: 'Seeing Red',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        exhaust: true,
        upgrade: { cost: 0 },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'GainEnergy', amount: 2 })
        },
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
            const stacks = isUpgraded(card) ? 5 : 3
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
            if (enemy?.intent?.kind === 'attack' || enemy?.intent?.kind === 'multi_attack') {
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
        upgrade: {},
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
        rarity: 'common',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            const amount = isUpgraded(card) ? 4 : 2
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'STRENGTH', stacks: amount })
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'STRENGTH_DOWN_NEXT_TURN', stacks: amount })
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
    SECOND_WIND: {
        id: 'SECOND_WIND',
        name: 'Second Wind',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, card }) => {
            const exhausted = engine.exhaustCardsInHand?.((entry) => resolveCard(entry).type !== 'attack') ?? []
            for (const _card of exhausted) {
                engine.enqueue({ kind: 'GainBlock', blockSource: 'card', target: 'player', amount: isUpgraded(card) ? 7 : 5 })
            }
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
            engine.enqueue({ kind: 'GainBlock', blockSource: 'card', target: 'player', amount: resolveCard(card).baseBlock ?? 0 })
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
    DUAL_WIELD: {
        id: 'DUAL_WIELD',
        name: 'Dual Wield',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
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
}
