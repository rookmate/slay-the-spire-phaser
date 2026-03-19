import type { CardDef, CardInstance } from './state'

function playerStrength(engine: { state: { player: { powers: Array<{ id: string; stacks: number }> } } }): number {
    return engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
}

const DEFERRED_CARD_IDS = new Set([
    'EXHUME',
    'HEADBUTT',
    'TRUE_GRIT',
    'WARCRY',
    'WILD_STRIKE',
    'ARMAMENTS',
    'BURNING_PACT',
    'POWER_THROUGH',
    'GHOSTLY_ARMOR',
    'SEARING_BLOW',
    'SENTINEL',
    'WHIRLWIND',
])

export interface ResolvedCardDef extends CardDef {
    name: string
    cost: number
    exhaust: boolean
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
        rarity: 'basic',
        baseDamage: 8,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 10 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'DealDamage', source, target, amount: (resolved.baseDamage ?? 0) + playerStrength(engine) })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'VULNERABLE', stacks: card.upgraded ? 3 : 2 })
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
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'METALLICIZE', stacks: card.upgraded ? 4 : 3 })
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
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'DEMON_FORM', stacks: card.upgraded ? 3 : 2 })
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
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'FEEL_NO_PAIN', stacks: card.upgraded ? 2 : 1 })
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
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'JUGGERNAUT', stacks: card.upgraded ? 2 : 1 })
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
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'DARK_EMBRACE', stacks: card.upgraded ? 2 : 1 })
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
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'BRUTALITY', stacks: card.upgraded ? 2 : 1 })
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
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'BERSERK', stacks: card.upgraded ? 2 : 1 })
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
            engine.setDoubleTapCharges?.(card.upgraded ? 2 : 1)
        },
    },
    EXHUME: {
        id: 'EXHUME',
        name: 'Exhume',
        type: 'skill',
        cost: 1,
        rarity: 'rare',
        targeting: { type: 'none' },
        onPlay: ({ engine }) => {
            const ex = engine.state.player.exhaustPile
            if (ex.length > 0) {
                const next = ex.pop()
                if (next) engine.state.player.hand.push(next)
            }
        },
    },
    FIEND_FIRE: {
        id: 'FIEND_FIRE',
        name: 'Fiend Fire',
        type: 'attack',
        cost: 2,
        rarity: 'rare',
        exhaust: true,
        targeting: { type: 'single_enemy', required: true },
        upgrade: { baseDamage: 10 },
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            const hitDamage = (resolveCard(card).baseDamage ?? 0) + playerStrength(engine)
            const toExhaust = [...engine.state.player.hand]
            for (const c of toExhaust) engine.handleExhaustFromHand?.(c)
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
                if (enemy.hp > 0) engine.enqueue({ kind: 'DealDamage', source, target: enemy.id, amount: (resolved.baseDamage ?? 0) + playerStrength(engine) })
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
            engine.enqueue({ kind: 'DealDamage', source, target, amount: (resolved.baseDamage ?? 0) + playerStrength(engine) })
            engine.enqueue({ kind: 'DrawCards', count: card.upgraded ? 2 : 1 })
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
            const amount = (resolved.baseDamage ?? 0) + playerStrength(engine)
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
            engine.enqueue({ kind: 'DealDamage', source, target, amount: (resolved.baseDamage ?? 0) + playerStrength(engine) })
            engine.state.player.discardPile.push({ defId: 'ANGER', upgraded: card.upgraded })
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
            engine.enqueue({ kind: 'DealDamage', source, target, amount: (resolved.baseDamage ?? 0) + playerStrength(engine) })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'WEAK', stacks: card.upgraded ? 3 : 2 })
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
            const stacks = card.upgraded ? 2 : 1
            engine.enqueue({ kind: 'DealDamage', source, target, amount: (resolved.baseDamage ?? 0) + playerStrength(engine) })
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
            const amount = (card.upgraded ? 4 : 3) + playerStrength(engine)
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
                engine.enqueue({ kind: 'DealDamage', source, target: enemy.id, amount: (resolved.baseDamage ?? 0) + playerStrength(engine) })
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
            const multiplier = card.upgraded ? 5 : 3
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 14 + strength * multiplier })
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
            const strikeCount = engine.state.player.deck.filter(c => CARD_DEFS[c.defId]?.name.toLowerCase().includes('strike')).length
            const perStrike = card.upgraded ? 3 : 2
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 6 + strikeCount * perStrike + playerStrength(engine) })
        },
    },
    TRUE_GRIT: {
        id: 'TRUE_GRIT',
        name: 'True Grit',
        type: 'skill',
        cost: 1,
        rarity: 'common',
        targeting: { type: 'none' },
    },
    WARCRY: {
        id: 'WARCRY',
        name: 'Warcry',
        type: 'skill',
        cost: 0,
        rarity: 'common',
        targeting: { type: 'none' },
    },
    WILD_STRIKE: {
        id: 'WILD_STRIKE',
        name: 'Wild Strike',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
    },
    CLASH: {
        id: 'CLASH',
        name: 'Clash',
        type: 'attack',
        cost: 0,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        upgrade: {},
        canPlay: ({ engine }) => engine.state.player.hand.every(c => CARD_DEFS[c.defId]?.type === 'attack'),
        onPlay: ({ engine, source, targets, card }) => {
            const target = targets[0]
            engine.enqueue({ kind: 'DealDamage', source, target, amount: (card.upgraded ? 18 : 14) + playerStrength(engine) })
        },
    },
    ARMAMENTS: {
        id: 'ARMAMENTS',
        name: 'Armaments',
        type: 'skill',
        cost: 1,
        rarity: 'common',
        targeting: { type: 'none' },
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
            engine.enqueue({ kind: 'DrawCards', count: card.upgraded ? 4 : 3 })
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
            engine.enqueue({ kind: 'GainEnergy', amount: card.upgraded ? 3 : 2 })
        },
    },
    BURNING_PACT: {
        id: 'BURNING_PACT',
        name: 'Burning Pact',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
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
            engine.enqueue({ kind: 'DealDamage', source, target, amount: (resolved.baseDamage ?? 0) + playerStrength(engine) })
            const enemy = engine.state.enemies.find(e => e.id === target)
            if (enemy?.powers.find(p => p.id === 'VULNERABLE')?.stacks) {
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
            if (engine.state.player.block > 0) {
                engine.enqueue({ kind: 'GainBlock', target: 'player', amount: engine.state.player.block })
            }
        },
    },
    FLAME_BARRIER: {
        id: 'FLAME_BARRIER',
        name: 'Flame Barrier',
        type: 'skill',
        cost: 2,
        rarity: 'uncommon',
        targeting: { type: 'none' },
        upgrade: { baseBlock: 16 },
        baseBlock: 12,
        onPlay: ({ engine, card }) => {
            const resolved = resolveCard(card)
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: resolved.baseBlock ?? 0 })
            engine.addTemporaryThorns?.(card.upgraded ? 6 : 4)
        },
    },
    GHOSTLY_ARMOR: {
        id: 'GHOSTLY_ARMOR',
        name: 'Ghostly Armor',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
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
            engine.enqueue({ kind: 'DealDamage', source, target, amount: (card.upgraded ? 20 : 15) + playerStrength(engine) })
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
                if (enemy.hp > 0) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'WEAK', stacks: card.upgraded ? 2 : 1 })
            }
        },
    },
    POWER_THROUGH: {
        id: 'POWER_THROUGH',
        name: 'Power Through',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
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
            const amount = 2 + playerStrength(engine)
            const hits = card.upgraded ? 5 : 4
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
        targeting: { type: 'single_enemy', required: true },
    },
    SENTINEL: {
        id: 'SENTINEL',
        name: 'Sentinel',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        targeting: { type: 'none' },
    },
    SHOCKWAVE: {
        id: 'SHOCKWAVE',
        name: 'Shockwave',
        type: 'skill',
        cost: 2,
        rarity: 'uncommon',
        targeting: { type: 'all_enemies', required: true },
        exhaust: true,
        upgrade: {},
        onPlay: ({ engine, card }) => {
            const stacks = card.upgraded ? 3 : 2
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
            const enemy = engine.state.enemies.find(e => e.id === target)
            if (enemy?.intent?.kind === 'attack') {
                engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'STRENGTH', stacks: card.upgraded ? 4 : 3 })
            }
        },
    },
    WHIRLWIND: {
        id: 'WHIRLWIND',
        name: 'Whirlwind',
        type: 'attack',
        cost: 2,
        rarity: 'uncommon',
        targeting: { type: 'all_enemies', required: true },
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
            engine.enqueue({ kind: 'DealDamage', source, target, amount: (card.upgraded ? 42 : 32) + playerStrength(engine) })
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
            engine.enqueue({ kind: 'DrawCards', count: card.upgraded ? 5 : 3 })
        },
    },
    IMPERVIOUS: {
        id: 'IMPERVIOUS',
        name: 'Impervious',
        type: 'skill',
        cost: 2,
        rarity: 'rare',
        targeting: { type: 'none' },
        exhaust: true,
        baseBlock: 30,
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
        targeting: { type: 'none' },
        exhaust: true,
        upgrade: { exhaust: false },
        onPlay: ({ engine }) => {
            const st = engine.state.player.powers.find(p => p.id === 'STRENGTH')
            if (st && st.stacks > 0) engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'STRENGTH', stacks: st.stacks })
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
                        amount: (resolved.baseDamage ?? 0) + playerStrength(engine),
                        lifestealTo: engine.state.player.id,
                    })
                }
            }
        },
    },
}

for (const [id, def] of Object.entries(CARD_DEFS)) {
    def.implemented ??= true
    def.poolEnabled ??= !DEFERRED_CARD_IDS.has(id)
}

export function resolveCard(card: CardInstance): ResolvedCardDef {
    const def = CARD_DEFS[card.defId]
    if (!card.upgraded || !def.upgrade) {
        return {
            ...def,
            name: def.name,
            cost: def.cost,
            exhaust: def.exhaust ?? false,
            baseDamage: def.baseDamage,
            baseBlock: def.baseBlock,
        }
    }

    return {
        ...def,
        name: def.upgrade.name ?? `${def.name}+`,
        cost: def.upgrade.cost ?? def.cost,
        exhaust: def.upgrade.exhaust ?? def.exhaust ?? false,
        baseDamage: def.upgrade.baseDamage ?? def.baseDamage,
        baseBlock: def.upgrade.baseBlock ?? def.baseBlock,
    }
}
