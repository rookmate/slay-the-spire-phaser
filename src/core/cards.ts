import type { CardDef } from './state'

export const CARD_DEFS: Record<string, CardDef> = {
    STRIKE: { id: 'STRIKE', name: 'Strike', type: 'attack', cost: 1, baseDamage: 6, rarity: 'basic' },
    DEFEND: { id: 'DEFEND', name: 'Defend', type: 'skill', cost: 1, baseBlock: 5, rarity: 'basic' },
    BASH: {
        id: 'BASH',
        name: 'Bash',
        type: 'attack',
        cost: 2,
        rarity: 'basic',
        baseDamage: 8,
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const str = engine.state.player.powers.find(p => p.id === 'STRENGTH')?.stacks ?? 0
            engine.enqueue({ kind: 'DealDamage', source, target, amount: 8 + str })
            engine.enqueue({ kind: 'ApplyPower', target, powerId: 'VULNERABLE', stacks: 2 })
        },
    },
    CLEAVE: {
        id: 'CLEAVE',
        name: 'Cleave',
        type: 'attack',
        cost: 1,
        rarity: 'common',
        baseDamage: 8,
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
        onPlay: ({ engine, source, targets }) => {
            const target = targets[0]
            const amount = engine.state.player.block
            if (amount > 0) engine.enqueue({ kind: 'DealDamage', source, target, amount })
        },
    },
    IRON_WAVE: { id: 'IRON_WAVE', name: 'Iron Wave', type: 'attack', cost: 1, baseDamage: 5, baseBlock: 5, rarity: 'common' },
    ANGER: {
        id: 'ANGER',
        name: 'Anger',
        type: 'attack',
        cost: 0,
        rarity: 'common',
        baseDamage: 6,
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
                engine.state.player.exhaustPile.push(c)
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
            engine.state.player.hp = Math.max(0, engine.state.player.hp - 3)
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
                engine.state.player.exhaustPile.push(c)
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
            engine.state.player.hp = Math.max(0, engine.state.player.hp - 2)
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
            engine.state.player.hp = Math.max(0, engine.state.player.hp - 6)
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


