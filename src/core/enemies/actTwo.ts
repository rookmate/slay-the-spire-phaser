import { CARD_DEFS } from '../cards'
import type { EnemySpec } from './model'
import { asc, attack, block, buff, cards, chooseMove, power, setPower, turn } from './helpers'
import { createEnemyState } from '../enemies'

function thief(id: string, name: string): EnemySpec {
    return { id, name, hp: id === 'LOOTER' ? [44, 48] : [48, 52], highHp: id === 'LOOTER' ? [46, 50] : [50, 54],
        nextIntent: (_rng, enemy) => {
            const n = turn(enemy)
            if (n < 2) return attack(enemy, 10, 11, 1, [{ kind: 'steal', amount: asc(enemy, 17, 15, 20) }])
            if (n === 2) return buff('Smoke Bomb', [block(id === 'LOOTER' ? 6 : 11)])
            return buff('Escape', [{ kind: 'escape' }])
        },
        onDamageTaken: (engine, enemy) => {
            if (enemy.hp <= 0 && !enemy.escaped) {
                engine.changeGold(Number(enemy.aiState?.stolenGold ?? 0))
                enemy.aiState = { ...enemy.aiState, stolenGold: 0 }
            }
        },
    }
}
function slaver(id: string, red: boolean): EnemySpec {
    return { id, name: `${red ? 'Red' : 'Blue'} Slaver`, hp: [46, 50], highHp: [48, 52],
        nextIntent: (rng, enemy) => {
            const n = turn(enemy)
            if (n === 0) return attack(enemy, red ? 13 : 12, red ? 14 : 13)
            if (red && !enemy.aiState?.entangled && rng.random() < 0.25) {
                enemy.aiState = { ...enemy.aiState, entangled: true }
                return buff('Entangle', [power('ENTANGLED', 1, 'player')])
            }
            return chooseMove(rng, enemy, [
                { id: 'stab', weight: 50, limit: 2, intent: () => attack(enemy, red ? 13 : 12, red ? 14 : 13) },
                { id: 'rake', weight: 50, limit: 1, intent: () => attack(enemy, red ? 8 : 7, red ? 9 : 8, 1, [power(red ? 'VULNERABLE' : 'WEAK', asc(enemy, 17, 1, 2), 'player')]) },
            ])
        },
    }
}

export const ACT_TWO_ENEMIES: Record<string, EnemySpec> = {
    LOOTER: thief('LOOTER', 'Looter'), MUGGER: thief('MUGGER', 'Mugger'),
    SLAVER_RED: slaver('SLAVER_RED', true), SLAVER_BLUE: slaver('SLAVER_BLUE', false),
    RED_SLAVER: slaver('RED_SLAVER', true), BLUE_SLAVER: slaver('BLUE_SLAVER', false),
    SNECKO: { id: 'SNECKO', name: 'Snecko', hp: [114, 120], highHp: [120, 125],
        nextIntent: (rng, enemy) => turn(enemy) === 0 ? buff('Perplexing Glare', [power('CONFUSION', 1, 'player')]) : chooseMove(rng, enemy, [
            { id: 'bite', weight: 60, limit: 2, intent: () => attack(enemy, 15, 18) },
            { id: 'tail', weight: 40, limit: 1, intent: () => attack(enemy, 8, 10, 1, [power('VULNERABLE', 2, 'player'), ...(asc(enemy, 17, 0, 1) ? [power('WEAK', 2, 'player')] : [])]) },
        ]),
    },
    CHOSEN: { id: 'CHOSEN', name: 'Chosen', hp: [95, 99], highHp: [98, 103],
        nextIntent: (rng, enemy) => {
            const n = turn(enemy)
            if (n === asc(enemy, 17, 1, 0)) return buff('Hex', [power('HEX', 1, 'player')])
            if (n === 0) return attack(enemy, 5, 6, 2)
            return chooseMove(rng, enemy, [
                { id: 'poke', weight: 35, limit: 1, intent: () => attack(enemy, 5, 6, 2) },
                { id: 'zap', weight: 35, limit: 1, intent: () => attack(enemy, 18, 21) },
                { id: 'drain', weight: 30, limit: 1, intent: () => buff('Drain', [power('WEAK', 3, 'player'), power('STRENGTH', 3)]) },
            ])
        },
    },
    BYRD: { id: 'BYRD', name: 'Byrd', hp: [25, 31], highHp: [26, 33], tags: ['flying'],
        initialize: enemy => { enemy.aiState = { flying: true, hitsTaken: 0, downed: false } },
        nextIntent: (rng, enemy) => {
            if (!enemy.aiState?.flying) {
                const n = Number(enemy.aiState?.downTurns ?? 0)
                enemy.aiState = { ...enemy.aiState, downTurns: n + 1 }
                return n === 0 ? attack(enemy, 3) : { ...buff('Fly'), move: 'fly' }
            }
            return chooseMove(rng, enemy, [
                { id: 'peck', weight: 50, limit: 2, intent: () => attack(enemy, 1, 1, asc(enemy, 2, 5, 6)) },
                { id: 'swoop', weight: 20, limit: 1, intent: () => attack(enemy, 12, 14) },
                { id: 'caw', weight: 30, limit: 1, intent: () => buff('Caw', [power('STRENGTH', 1)]) },
            ])
        },
        onHitByPlayerAttack: (_engine, enemy) => {
            if (!enemy.aiState?.flying) return
            const hits = Number(enemy.aiState.hitsTaken ?? 0) + 1
            enemy.aiState.hitsTaken = hits
            if (hits >= asc(enemy, 17, 3, 4)) {
                enemy.aiState = { ...enemy.aiState, flying: false, downed: true, downTurns: 0 }
                enemy.intent = buff('Stunned')
            }
        },
        onIntentResolved: (_engine, enemy, intent) => { if (intent?.move === 'fly') enemy.aiState = { ...enemy.aiState, flying: true, downed: false, hitsTaken: 0 } },
    },
    SPHERIC_GUARDIAN: { id: 'SPHERIC_GUARDIAN', name: 'Spheric Guardian', hp: 20,
        initialize: enemy => { enemy.block = 40; setPower(enemy, 'BARRICADE', 1); setPower(enemy, 'ARTIFACT', 3) },
        nextIntent: (_rng, enemy) => {
            const n = turn(enemy)
            if (n === 0) return buff('Activate', [block(asc(enemy, 17, 25, 35))])
            if (n === 1) return attack(enemy, 10, 11, 1, [power('FRAIL', 5, 'player')])
            return n % 2 === 0 ? attack(enemy, 10, 11, 2) : attack(enemy, 10, 11, 1, [block(15)])
        },
    },
    SHELLED_PARASITE: { id: 'SHELLED_PARASITE', name: 'Shelled Parasite', hp: [68, 72], highHp: [70, 75],
        initialize: enemy => setPower(enemy, 'PLATED_ARMOR', 14),
        nextIntent: (rng, enemy) => chooseMove(rng, enemy, [
            { id: 'double', weight: 40, limit: 2, intent: () => attack(enemy, 6, 7, 2) },
            { id: 'suck', weight: 40, limit: 2, intent: () => ({ ...attack(enemy, 10, 12), move: 'suck' }) },
            { id: 'fell', weight: 20, limit: 1, intent: () => attack(enemy, 18, 21, 1, [power('FRAIL', 2, 'player')]) },
        ]),
        onAttackDamage: (engine, enemy, _damage, hpLoss) => {
            if (enemy.intent?.move === 'suck' && hpLoss > 0) engine.enqueue({ kind: 'Heal', target: enemy.id, amount: hpLoss })
        },
    },
    SNAKE_PLANT: { id: 'SNAKE_PLANT', name: 'Snake Plant', hp: [75, 79], highHp: [78, 82],
        nextIntent: (rng, enemy) => chooseMove(rng, enemy, [
            { id: 'chomp', weight: 65, limit: 2, intent: () => attack(enemy, 7, 8, 3) },
            { id: 'spores', weight: 35, limit: 1, intent: () => buff('Enfeebling Spores', [power('FRAIL', 2, 'player'), power('WEAK', 2, 'player')]) },
        ]),
        onHitByPlayerAttack: (engine, enemy, damage) => { if (damage > 0) { const amount = Number(enemy.aiState?.malleable ?? 3); engine.gainBlock(enemy.id, amount); enemy.aiState = { ...enemy.aiState, malleable: amount + 1 } } },
        onIntentResolved: (_engine, enemy) => { enemy.aiState = { ...enemy.aiState, malleable: 3 } },
    },
    CENTURION: { id: 'CENTURION', name: 'Centurion', hp: [76, 80], highHp: [78, 83],
        nextIntent: (rng, enemy, combat) => rng.random() < 0.65 ? attack(enemy, 12, 14) : combat.enemies.some(e => e.specId === 'MYSTIC' && e.hp > 0) ? buff('Defend', [block(15, 'ally')]) : attack(enemy, 6, 7, 3),
    },
    MYSTIC: { id: 'MYSTIC', name: 'Mystic', hp: [48, 56], highHp: [50, 58],
        nextIntent: (rng, enemy, combat) => combat.enemies.some(e => e.hp > 0 && e.maxHp - e.hp >= 16) ? buff('Heal', [{ kind: 'heal', amount: asc(enemy, 17, 16, 20), target: 'allies' }]) : rng.random() < 0.4 ? attack(enemy, 8, 9, 1, [power('FRAIL', 2, 'player')]) : buff('Buff', [power('STRENGTH', asc(enemy, 17, 2, 4), 'allies')]),
    },
    BOOK_OF_STABBING: { id: 'BOOK_OF_STABBING', name: 'Book of Stabbing', hp: [160, 162], highHp: [168, 172], tags: ['elite'],
        onAttackDamage: (engine, _enemy, _damage, hpLoss) => { if (hpLoss > 0) engine.createCardsInDestination('WOUND', 'discardPile') },
        nextIntent: (rng, enemy) => {
            return chooseMove(rng, enemy, [
                { id: 'multi', weight: 85, limit: 2, intent: () => attack(enemy, 6, 7, Number(enemy.aiState?.stabs ?? 2)) },
                { id: 'single', weight: 15, limit: 1, intent: () => attack(enemy, 21, 24) },
            ])
        },
        onIntentResolved: (_engine, enemy, intent) => { if (intent?.move === 'multi' || (enemy.asc ?? 0) >= 18) enemy.aiState = { ...enemy.aiState, stabs: Number(enemy.aiState?.stabs ?? 2) + 1 } },
    },
    GREMLIN_MINION: { id: 'GREMLIN_MINION', name: 'Gremlin', hp: [20, 24], highHp: [21, 25], tags: ['minion'], nextIntent: (_rng, enemy) => attack(enemy, 6, 7) },
    GREMLIN_LEADER: { id: 'GREMLIN_LEADER', name: 'Gremlin Leader', hp: [140, 148], highHp: [145, 155], tags: ['elite'],
        nextIntent: (rng, enemy, combat) => {
            const allies = combat.enemies.filter(e => e.hp > 0 && e.id !== enemy.id)
            const n = turn(enemy)
            if (allies.length < 2 && (n === 0 || rng.random() < 0.75)) return { kind: 'summon', desc: 'Rally' }
            return rng.random() < 0.5 ? attack(enemy, 6, 6, 3) : buff('Encourage', [power('STRENGTH', asc(enemy, 18, asc(enemy, 3, 3, 4), 5), 'allies'), block(asc(enemy, 18, 6, 10), 'allies')])
        },
        onIntentResolved: (engine, enemy, intent) => {
            if (intent?.kind !== 'summon') return
            const pool = ['SNEAKY_GREMLIN', 'MAD_GREMLIN', 'FAT_GREMLIN', 'SHIELD_GREMLIN', 'WIZARD_GREMLIN']
            const count = Math.min(2, 3 - engine.countLivingEnemies())
            const spawned = Array.from({ length: count }, (_, i) => {
                const child = createEnemyState(pool[engine.rng.int(0, pool.length - 1)], `${enemy.id}-${enemy.aiState?.turn}-${i}`, enemy.asc, engine.rng)
                child.tags?.push('minion'); return child
            })
            engine.spawnEnemies(spawned)
        },
    },
    TASKMASTER: { id: 'TASKMASTER', name: 'Taskmaster', hp: 54, highHp: 60, tags: ['elite'],
        nextIntent: (_rng, enemy) => attack(enemy, 7, 7, 1, [cards('WOUND', asc(enemy, 18, asc(enemy, 3, 1, 2), 3)), ...(asc(enemy, 18, 0, 1) ? [power('STRENGTH', 1)] : [])]),
    },
    TORCH_HEAD: { id: 'TORCH_HEAD', name: 'Torch Head', hp: [38, 40], highHp: [40, 45], tags: ['minion'], nextIntent: (_rng, enemy) => attack(enemy, 7, 7) },
    THE_COLLECTOR: { id: 'THE_COLLECTOR', name: 'The Collector', hp: 282, highHp: 300, tags: ['boss'],
        nextIntent: (rng, enemy, combat) => {
            const n = turn(enemy)
            if (n === 3) return buff('Mega Debuff', [power('WEAK', asc(enemy, 19, 3, 5), 'player'), power('VULNERABLE', asc(enemy, 19, 3, 5), 'player'), power('FRAIL', asc(enemy, 19, 3, 5), 'player')])
            if (n === 0 || (combat.enemies.filter(e => e.hp > 0 && e.specId === 'TORCH_HEAD').length < 2 && rng.random() < 0.25)) return { kind: 'summon', desc: 'Raise Torch Heads' }
            return chooseMove(rng, enemy, [
                { id: 'fireball', weight: 70, limit: 2, intent: () => attack(enemy, 18, 21) },
                { id: 'buff', weight: 30, limit: 1, intent: () => buff('Buff', [power('STRENGTH', asc(enemy, 19, asc(enemy, 4, 3, 4), 5), 'allies'), block(asc(enemy, 19, 15, 18))]) },
            ])
        },
        onIntentResolved: (engine, enemy, intent) => {
            if (intent?.kind !== 'summon') return
            const count = 2 - engine.state.enemies.filter(e => e.hp > 0 && e.specId === 'TORCH_HEAD').length
            engine.spawnEnemies(Array.from({ length: count }, (_, i) => createEnemyState('TORCH_HEAD', `${enemy.id}-${enemy.aiState?.turn}-${i}`, enemy.asc, engine.rng)))
        },
    },
    THE_CHAMP: { id: 'THE_CHAMP', name: 'The Champ', hp: 420, highHp: 440, tags: ['boss'],
        nextIntent: (rng, enemy) => {
            const n = turn(enemy)
            if (enemy.hp <= enemy.maxHp / 2 && !enemy.aiState?.enraged) {
                enemy.aiState = { ...enemy.aiState, enraged: true, phaseTurn: 0 }
                return buff('Anger', [{ kind: 'cleanse' }, power('STRENGTH', asc(enemy, 19, asc(enemy, 4, 6, 9), 12))])
            }
            if (enemy.aiState?.enraged) {
                const phase = Number(enemy.aiState.phaseTurn ?? 0)
                enemy.aiState.phaseTurn = phase + 1
                if (phase % 3 === 0) return attack(enemy, 10, 10, 2)
            }
            if (n > 0 && n % 4 === 0) return buff('Taunt', [power('WEAK', 2, 'player'), power('VULNERABLE', 2, 'player')])
            return chooseMove(rng, enemy, [
                { id: 'heavy', weight: 45, limit: 2, intent: () => attack(enemy, 16, 18) },
                { id: 'slap', weight: 30, limit: 1, intent: () => attack(enemy, 12, 14, 1, [power('FRAIL', 2, 'player'), power('VULNERABLE', 2, 'player')]) },
                { id: 'defense', weight: 25, limit: 1, intent: () => buff('Defensive Stance', [block(asc(enemy, 9, 15, 18)), power('PLATED_ARMOR', asc(enemy, 19, 5, 7))]) },
            ])
        },
    },
    BRONZE_ORB: { id: 'BRONZE_ORB', name: 'Bronze Orb', hp: [52, 58], highHp: [54, 60], tags: ['minion'],
        nextIntent: (rng, enemy) => {
            if (!enemy.aiState?.stasisUsed && rng.random() < 0.75) return { ...buff('Stasis'), move: 'stasis' }
            return chooseMove(rng, enemy, [
                { id: 'support', weight: 70, limit: 2, intent: () => buff('Support Beam') },
                { id: 'beam', weight: 30, limit: 2, intent: () => attack(enemy, 8) },
            ])
        },
        onIntentResolved: (engine, enemy, intent) => {
            if (intent?.move === 'support') {
                const boss = engine.state.enemies.find(e => e.specId === 'BRONZE_AUTOMATON' && e.hp > 0)
                if (boss) engine.gainBlock(boss.id, 12)
            }
            if (intent?.move !== 'stasis') return
            enemy.aiState = { ...enemy.aiState, stasisUsed: true }
            const pile = engine.state.player.drawPile.length ? engine.state.player.drawPile : engine.state.player.discardPile
            const rank = (id: string) => ['basic', 'common', 'uncommon', 'rare'].indexOf(CARD_DEFS[id].rarity ?? 'basic')
            const best = Math.max(...pile.map(card => rank(card.defId)))
            const candidates = pile.filter(card => rank(card.defId) === best)
            const card = candidates[engine.rng.int(0, candidates.length - 1)]
            if (card) { pile.splice(pile.indexOf(card), 1); enemy.stasisCard = card }
        },
        onDamageTaken: (engine, enemy) => {
            if (enemy.hp > 0 || !enemy.stasisCard) return
            const player = engine.state.player
            ;(player.hand.length < 10 ? player.hand : player.discardPile).push(enemy.stasisCard)
            enemy.stasisCard = undefined
        },
    },
    BRONZE_AUTOMATON: { id: 'BRONZE_AUTOMATON', name: 'Bronze Automaton', hp: 300, highHp: 320, tags: ['boss'],
        initialize: enemy => setPower(enemy, 'ARTIFACT', 3),
        nextIntent: (_rng, enemy) => {
            const n = turn(enemy)
            if (n === 0) return { kind: 'summon', desc: 'Spawn Orbs' }
            const step = (n - 1) % 6
            if (step === 0 || step === 2) return attack(enemy, 7, 8, 2)
            if (step === 1 || step === 3) return buff('Boost', [power('STRENGTH', asc(enemy, 19, 3, 4)), block(asc(enemy, 9, 9, 12))])
            if (step === 4) return attack(enemy, 45, 50)
            return (enemy.asc ?? 0) >= 19 ? buff('Boost', [power('STRENGTH', 4), block(12)]) : buff('Stunned')
        },
        onIntentResolved: (engine, enemy, intent) => { if (intent?.kind === 'summon') engine.spawnEnemies([0, 1].map(i => createEnemyState('BRONZE_ORB', `${enemy.id}-orb-${i}`, enemy.asc, engine.rng))) },
    },
}
