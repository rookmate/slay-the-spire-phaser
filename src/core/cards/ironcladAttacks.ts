import type { CardDef } from '../state'
import { CARD_DEFS, resolveCard, modifyCardCombatBonusDamage } from '../cards'
import { attackAmount, chooseOneCard, isUpgraded } from './helpers'

export const IRONCLAD_ATTACKS: Record<string, CardDef> = {
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
        damage: ({ player }) => player.block,
        cost: 1,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        upgrade: { cost: 0 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            {
                engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, engine.state.player.block) })
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
        upgrade: {},
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
        baseDamage: 3,
        targeting: { type: 'none' },
        upgrade: {},
        onPlay: ({ engine, source, card }) => {
            const amount = attackAmount(engine, card, 3)
            for (let i = 0; i < (isUpgraded(card) ? 4 : 3); i++) {
                engine.enqueue({ kind: 'RandomAttack', source, amount, sourceCardInstanceId: card.instanceId })
            }
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
        baseDamage: 14,
        damage: ({ player, card }) => 14 + (player.powers.find(power => power.id === 'STRENGTH')?.stacks ?? 0) * (isUpgraded(card) ? 4 : 2),
        cost: 2,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 14 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolveCard(card).damage!({ player: engine.state.player, card })) })
        },
    },
    PERFECTED_STRIKE: {
        id: 'PERFECTED_STRIKE',
        name: 'Perfected Strike',
        type: 'attack',
        baseDamage: 6,
        damage: ({ player, card }) => 6 + [...player.hand, ...player.drawPile, ...player.discardPile, card].filter((entry, index, all) => all.findIndex(other => other.instanceId === entry.instanceId) === index && CARD_DEFS[entry.defId]?.name.toLowerCase().includes('strike')).length * (isUpgraded(card) ? 3 : 2),
        cost: 2,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 6 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolveCard(card).damage!({ player: engine.state.player, card })) })
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
        baseDamage: 14,
        cost: 0,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 18 },
        canPlay: ({ engine }) => engine.state.player.hand.every(entry => CARD_DEFS[entry.defId]?.type === 'attack'),
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolveCard(card).baseDamage ?? 0) })
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
    HEMOKINESIS: {
        id: 'HEMOKINESIS',
        name: 'Hemokinesis',
        type: 'attack',
        baseDamage: 15,
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 20 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 2 })
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolveCard(card).baseDamage ?? 0) })
        },
    },
    PUMMEL: {
        id: 'PUMMEL',
        name: 'Pummel',
        type: 'attack',
        baseDamage: 2,
        cost: 1,
        rarity: 'uncommon',
        exhaust: true,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 2 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const amount = attackAmount(engine, card, 2)
            const hits = isUpgraded(card) ? 5 : 4
            for (let i = 0; i < hits; i++) engine.enqueue({ kind: 'DealDamage', source, target, amount })
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
    RECKLESS_CHARGE: {
        id: 'RECKLESS_CHARGE',
        name: 'Reckless Charge',
        type: 'attack',
        cost: 0,
        rarity: 'uncommon',
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
        baseDamage: 32,
        cost: 3,
        rarity: 'rare',
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 42 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolveCard(card).baseDamage ?? 0) })
        },
    },
    REAPER: {
        id: 'REAPER',
        name: 'Reaper',
        type: 'attack',
        cost: 2,
        rarity: 'rare',
        baseDamage: 4,
        exhaust: true,
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
    RAMPAGE: {
        id: 'RAMPAGE',
        name: 'Rampage',
        type: 'attack',
        cost: 1,
        rarity: 'uncommon',
        baseDamage: 8,
        targeting: { type: 'single_enemy', required: true },
        upgrade: {},
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
        exhaust: true,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 12 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'DealDamage', source, target, amount: attackAmount(engine, card, resolved.baseDamage ?? 0) })
        },
    },
}
