import type { CardDef } from './state'

export const CARD_DEFS: Record<string, CardDef> = {
    STRIKE: {
        id: 'STRIKE',
        name: 'Strike',
        type: 'attack',
        cost: 1,
        baseDamage: 6,
        rarity: 'basic',
        targeting: { type: 'single_enemy', required: true }
    },
    DEFEND: {
        id: 'DEFEND',
        name: 'Defend',
        type: 'skill',
        cost: 1,
        baseBlock: 5,
        rarity: 'basic',
        targeting: { type: 'none' }
    },
    BASH: {
        id: 'BASH',
        name: 'Bash',
        type: 'attack',
        cost: 2,
        rarity: 'basic',
        baseDamage: 8,
        targeting: { type: 'single_enemy', required: true },
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 8 + str })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'VULNERABLE', stacks: 2 })
        },
    },
    // Powers and advanced cards
    BARRICADE: {
        id: 'BARRICADE',
        name: 'Barricade',
        type: 'power',
        cost: 3,
        rarity: 'rare',
        targeting: { type: 'none' },
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
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'METALLICIZE', stacks: 3 })
        },
    },
    DEMON_FORM: {
        id: 'DEMON_FORM',
        name: 'Demon Form',
        type: 'power',
        cost: 3,
        rarity: 'rare',
        targeting: { type: 'none' },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'DEMON_FORM', stacks: 1 })
        },
    },
    CORRUPTION: {
        id: 'CORRUPTION',
        name: 'Corruption',
        type: 'power',
        cost: 3,
        rarity: 'rare',
        targeting: { type: 'none' },
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
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'FEEL_NO_PAIN', stacks: 1 })
        },
    },
    JUGGERNAUT: {
        id: 'JUGGERNAUT',
        name: 'Juggernaut',
        type: 'power',
        cost: 2,
        rarity: 'rare',
        targeting: { type: 'none' },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'JUGGERNAUT', stacks: 1 })
        },
    },
    DARK_EMBRACE: {
        id: 'DARK_EMBRACE',
        name: 'Dark Embrace',
        type: 'power',
        cost: 2,
        rarity: 'rare',
        targeting: { type: 'none' },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'DARK_EMBRACE', stacks: 1 })
        },
    },
    BRUTALITY: {
        id: 'BRUTALITY',
        name: 'Brutality',
        type: 'power',
        cost: 0,
        rarity: 'rare',
        targeting: { type: 'none' },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'BRUTALITY', stacks: 1 })
        },
    },
    BERSERK: {
        id: 'BERSERK',
        name: 'Berserk',
        type: 'power',
        cost: 0,
        rarity: 'rare',
        targeting: { type: 'none' },
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'BERSERK', stacks: 1 })
        },
    },
    DOUBLE_TAP: {
        id: 'DOUBLE_TAP',
        name: 'Double Tap',
        type: 'skill',
        cost: 1,
        rarity: 'rare',
        onPlay: ({ engine }) => {
            // Next ATTACK this turn plays twice. Simple modeling: apply a temporary power.
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'STRENGTH', stacks: 0 })
                ; (engine as any)._doubleTap = true
        },
    },
    EXHUME: {
        id: 'EXHUME',
        name: 'Exhume',
        type: 'skill',
        cost: 1,
        rarity: 'rare',
        onPlay: ({ engine }) => {
            const ex = engine.state.player.exhaustPile
            if (ex.length > 0) {
                const card = ex.pop()!
                engine.state.player.hand.push(card)
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
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const toExhaust = [...engine.state.player.hand]
            let hits = 0
            for (const c of toExhaust) {
                ; (engine as any).handleExhaust(c)
                hits += 1
            }
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            for (let i = 0; i < hits; i++) engine.enqueue({ kind: 'DealDamage', source, target, amount: 7 + str })
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
        onPlay: ({ engine, source }) => {
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) engine.enqueue({ kind: 'DealDamage', source, target: enemy.id, amount: 8 + str })
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
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 9 + str })
            engine.enqueue({ kind: 'DrawCards', count: 1 })
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
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: 8 })
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
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 5 + str })
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 5 + str })
        },
    },
    BODY_SLAM: {
        id: 'BODY_SLAM',
        name: 'Body Slam',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        targeting: { type: 'single_enemy', required: true },
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const amount = engine.state.player.block
            if (amount > 0) engine.enqueue({ kind: 'DealDamage', source, target, amount })
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
        targeting: { type: 'single_enemy', required: true }
    },
    ANGER: {
        id: 'ANGER',
        name: 'Anger',
        type: 'attack',
        cost: 0,
        rarity: 'common',
        baseDamage: 6,
        targeting: { type: 'single_enemy', required: true },
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 6 + str })
            engine.state.player.discardPile.push({ defId: 'ANGER', upgraded: false })
        },
    },
    CLOTHESLINE: {
        id: 'CLOTHESLINE',
        name: 'Clothesline',
        type: 'attack',
        cost: 2,
        rarity: 'common',
        baseDamage: 12,
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 12 + str })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'WEAK', stacks: 2 })
        },
    },
    UPPERCUT: {
        id: 'UPPERCUT',
        name: 'Uppercut',
        type: 'attack',
        cost: 2,
        rarity: 'uncommon',
        baseDamage: 13,
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 13 + str })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'VULNERABLE', stacks: 1 })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'WEAK', stacks: 1 })
        },
    },
    SWORD_BOOMERANG: {
        id: 'SWORD_BOOMERANG',
        name: 'Sword Boomerang',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            for (let i = 0; i < 3; i++) engine.enqueue({ kind: 'DealDamage', source, target, amount: 3 + str })
        },
    },
    THUNDERCLAP: {
        id: 'THUNDERCLAP',
        name: 'Thunderclap',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        onPlay: ({ engine, source }) => {
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) {
                    engine.enqueue({ kind: 'DealDamage', source, target: enemy.id, amount: 4 + str })
                    engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'VULNERABLE', stacks: 1 })
                }
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
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 9 + str })
            const dp = engine.state.player.discardPile
            if (dp.length > 0) {
                const c = dp.pop()!
                engine.state.player.drawPile.unshift(c)
            }
        },
    },
    HEAVY_BLADE: {
        id: 'HEAVY_BLADE',
        name: 'Heavy Blade',
        type: 'attack',
        cost: 2,
        rarity: 'common',
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const strength = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            const amount = 14 + strength * 3
            engine.enqueue({ kind: 'DealDamage', source, target, amount })
        },
    },
    PERFECTED_STRIKE: {
        id: 'PERFECTED_STRIKE',
        name: 'Perfected Strike',
        type: 'attack',
        cost: 2,
        rarity: 'common',
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const fullDeck = engine.state.player.deck
            let strikeCount = 0
            for (const c of fullDeck) {
                const def = (CARD_DEFS as any)[c.defId] as CardDef
                if (def?.name?.toLowerCase().includes('strike')) strikeCount += 1
            }
            const strength = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            const amount = 6 + strikeCount * 2 + strength
            engine.enqueue({ kind: 'DealDamage', source, target, amount })
        },
    },
    TRUE_GRIT: {
        id: 'TRUE_GRIT',
        name: 'True Grit',
        type: 'skill',
        cost: 1,
        rarity: 'common',
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: 7 })
            const hand = engine.state.player.hand
            if (hand.length > 0) {
                const idx = Math.floor((engine as any).rng.random() * hand.length)
                const [c] = hand.splice(idx, 1)
                    ; (engine as any).handleExhaust(c)
            }
        },
    },
    WARCRY: {
        id: 'WARCRY',
        name: 'Warcry',
        type: 'skill',
        cost: 0,
        rarity: 'common',
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'DrawCards', count: 2 })
            // place last card in hand on top of draw pile
            const hand = engine.state.player.hand
            if (hand.length > 0) {
                const c = hand.pop()!
                engine.state.player.drawPile.unshift(c)
            }
        },
    },
    WILD_STRIKE: {
        id: 'WILD_STRIKE',
        name: 'Wild Strike',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const strength = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 12 + strength })
        },
    },
    CLASH: {
        id: 'CLASH',
        name: 'Clash',
        type: 'attack',
        cost: 0,
        rarity: 'common',
        canPlay: ({ engine }) => {
            // Can only play if every card in hand is an attack
            return engine.state.player.hand.every(c => (CARD_DEFS as any)[c.defId]?.type === 'attack')
        },
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 14 + str })
        },
    },
    ARMAMENTS: {
        id: 'ARMAMENTS',
        name: 'Armaments',
        type: 'skill',
        cost: 1,
        rarity: 'common',
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: 5 })
        },
    },
    // Uncommon
    BATTLE_TRANCE: {
        id: 'BATTLE_TRANCE',
        name: 'Battle Trance',
        type: 'skill',
        cost: 0,
        rarity: 'uncommon',
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'DrawCards', count: 3 })
        },
    },
    BLOODLETTING: {
        id: 'BLOODLETTING',
        name: 'Bloodletting',
        type: 'skill',
        cost: 0,
        rarity: 'uncommon',
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 3 })
            engine.enqueue({ kind: 'GainEnergy', amount: 2 })
        },
    },
    BURNING_PACT: {
        id: 'BURNING_PACT',
        name: 'Burning Pact',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        onPlay: ({ engine }) => {
            const hand = engine.state.player.hand
            if (hand.length > 0) {
                const idx = Math.floor((engine as any).rng.random() * hand.length)
                const [c] = hand.splice(idx, 1)
                    ; (engine as any).handleExhaust(c)
            }
            engine.enqueue({ kind: 'DrawCards', count: 2 })
        },
    },
    DROPKICK: {
        id: 'DROPKICK',
        name: 'Dropkick',
        type: 'attack',
        cost: 1,
        rarity: 'uncommon',
        baseDamage: 5,
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 5 + str })
            const t = engine.state.enemies.find(e => e.id === target)
            if (t && t.powers.find(p => p.id === 'VULNERABLE')?.stacks) {
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
        onPlay: ({ engine }) => {
            const b = engine.state.player.block
            if (b > 0) engine.enqueue({ kind: 'GainBlock', target: 'player', amount: b })
        },
    },
    FLAME_BARRIER: {
        id: 'FLAME_BARRIER',
        name: 'Flame Barrier',
        type: 'skill',
        cost: 2,
        rarity: 'uncommon',
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: 12 })
        },
    },
    GHOSTLY_ARMOR: {
        id: 'GHOSTLY_ARMOR',
        name: 'Ghostly Armor',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: 10 })
        },
    },
    HEMOKINESIS: {
        id: 'HEMOKINESIS',
        name: 'Hemokinesis',
        type: 'attack',
        cost: 1,
        rarity: 'uncommon',
        onPlay: ({ engine, source, targets }) => {
            engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 2 })
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 15 + str })
        },
    },
    INTIMIDATE: {
        id: 'INTIMIDATE',
        name: 'Intimidate',
        type: 'skill',
        cost: 0,
        rarity: 'uncommon',
        onPlay: ({ engine }) => {
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'WEAK', stacks: 1 })
            }
        },
    },
    POWER_THROUGH: {
        id: 'POWER_THROUGH',
        name: 'Power Through',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: 15 })
        },
    },
    PUMMEL: {
        id: 'PUMMEL',
        name: 'Pummel',
        type: 'attack',
        cost: 1,
        rarity: 'uncommon',
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            for (let i = 0; i < 4; i++) engine.enqueue({ kind: 'DealDamage', source, target, amount: 2 + str })
        },
    },
    SEEING_RED: {
        id: 'SEEING_RED',
        name: 'Seeing Red',
        type: 'skill',
        cost: 0,
        rarity: 'uncommon',
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
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 16 + str })
        },
    },
    SENTINEL: {
        id: 'SENTINEL',
        name: 'Sentinel',
        type: 'skill',
        cost: 1,
        rarity: 'uncommon',
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: 5 })
        },
    },
    SHOCKWAVE: {
        id: 'SHOCKWAVE',
        name: 'Shockwave',
        type: 'skill',
        cost: 2,
        rarity: 'uncommon',
        onPlay: ({ engine }) => {
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) {
                    engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'WEAK', stacks: 2 })
                    engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'VULNERABLE', stacks: 2 })
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
        onPlay: ({ engine }) => {
            const anyAttacking = engine.state.enemies.some(e => e.intent?.kind === 'attack')
            if (anyAttacking) engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'STRENGTH', stacks: 3 })
        },
    },
    WHIRLWIND: {
        id: 'WHIRLWIND',
        name: 'Whirlwind',
        type: 'attack',
        cost: 2,
        rarity: 'uncommon',
        onPlay: ({ engine, source }) => {
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) engine.enqueue({ kind: 'DealDamage', source, target: enemy.id, amount: 5 + str })
            }
        },
    },
    // Rare
    BLUDGEON: {
        id: 'BLUDGEON',
        name: 'Bludgeon',
        type: 'attack',
        cost: 3,
        rarity: 'rare',
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 32 + str })
        },
    },
    OFFERING: {
        id: 'OFFERING',
        name: 'Offering',
        type: 'skill',
        cost: 0,
        rarity: 'rare',
        exhaust: true,
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 6 })
            engine.enqueue({ kind: 'GainEnergy', amount: 2 })
            engine.enqueue({ kind: 'DrawCards', count: 3 })
        },
    },
    IMPERVIOUS: {
        id: 'IMPERVIOUS',
        name: 'Impervious',
        type: 'skill',
        cost: 2,
        rarity: 'rare',
        onPlay: ({ engine }) => {
            engine.enqueue({ kind: 'GainBlock', target: 'player', amount: 30 })
        },
    },
    LIMIT_BREAK: {
        id: 'LIMIT_BREAK',
        name: 'Limit Break',
        type: 'skill',
        cost: 1,
        rarity: 'rare',
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
        onPlay: ({ engine, source }) => {
            let totalHeal = 0
            const base = 4
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            for (const enemy of engine.state.enemies) {
                if (enemy.hp > 0) {
                    const amount = base + str
                    engine.enqueue({ kind: 'DealDamage', source, target: enemy.id, amount })
                    totalHeal += amount
                }
            }
            engine.state.player.hp = Math.min(engine.state.player.maxHp, engine.state.player.hp + totalHeal)
        },
    },
}


