import type { EnemySpec } from './model'
import { asc, attack, block, buff, cards, chooseMove, power, setPower, turn } from './helpers'
import { createEnemyState } from '../enemies'

export const ACT_THREE_ENEMIES: Record<string, EnemySpec> = {
    SPIKER: { id: 'SPIKER', name: 'Spiker', hp: [42, 56], highHp: [44, 60], initialize: enemy => setPower(enemy, 'THORNS', asc(enemy, 17, 3, 7)),
        nextIntent: (rng, enemy) => turn(enemy) < 6 && rng.random() < 0.5 ? buff('Spike', [power('THORNS', 2)]) : attack(enemy, 7, 9) },
    REPULSOR: { id: 'REPULSOR', name: 'Repulsor', hp: [29, 35], highHp: [31, 38], nextIntent: (rng, enemy) => rng.random() < 0.2 ? attack(enemy, 11, 13) : buff('Repulse', [cards('DAZED', 2, 'drawPile')]) },
    EXPLODER: { id: 'EXPLODER', name: 'Exploder', hp: [30, 35], highHp: [32, 40],
        nextIntent: (_rng, enemy) => turn(enemy) < 2 ? attack(enemy, 9, 11) : { ...attack(enemy, 30), move: 'explode' },
        onIntentResolved: (_engine, enemy, intent) => { if (intent?.move === 'explode') { enemy.hp = 0; enemy.escaped = true } },
    },
    ORB_WALKER: { id: 'ORB_WALKER', name: 'Orb Walker', hp: [90, 96], highHp: [92, 102],
        nextIntent: (rng, enemy) => chooseMove(rng, enemy, [
            { id: 'laser', weight: 60, limit: 2, intent: () => attack(enemy, 10, 11, 1, [cards('BURN', 1, 'drawPile'), cards('BURN', 1)]) },
            { id: 'claw', weight: 40, limit: 2, intent: () => attack(enemy, 15, 16) },
        ]),
        onIntentResolved: (engine, enemy) => engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: asc(enemy, 17, 3, 5) }),
    },
    DARKLING: { id: 'DARKLING', name: 'Darkling', hp: [48, 56], highHp: [50, 59],
        initialize: (enemy, rng) => { enemy.aiState = { nip: rng.int(7, 11) } },
        nextIntent: (rng, enemy, combat) => {
            if (enemy.halfDead) return { ...buff('Reincarnate'), move: 'revive' }
            const first = turn(enemy) === 0
            const middle = combat.enemies.filter(e => e.specId === 'DARKLING').indexOf(enemy) === 1
            return chooseMove(rng, enemy, [
                { id: 'nip', weight: first || middle ? 50 : 30, limit: 2, intent: () => attack(enemy, Number(enemy.aiState?.nip ?? 9), Number(enemy.aiState?.nip ?? 9) + 2) },
                { id: 'chomp', weight: first || middle ? 0 : 40, limit: 1, intent: () => attack(enemy, 8, 9, 2) },
                { id: 'harden', weight: first || middle ? 50 : 30, limit: 1, intent: () => buff('Harden', [block(12), ...(asc(enemy, 17, 0, 1) ? [power('STRENGTH', 2)] : [])]) },
            ])
        },
        onDamageTaken: (_engine, enemy) => { if (enemy.hp <= 0) { enemy.halfDead = true; enemy.powers = []; enemy.intent = buff('Regrow') } },
        onIntentResolved: (_engine, enemy, intent) => { if (intent?.move === 'revive') { enemy.hp = Math.floor(enemy.maxHp / 2); enemy.halfDead = false } },
    },
    SPIRE_GROWTH: { id: 'SPIRE_GROWTH', name: 'Spire Growth', hp: 170, highHp: 190,
        nextIntent: (rng, enemy, combat) => {
            const canConstrict = !combat.player.powers.some(p => p.id === 'CONSTRICTED' && p.stacks > 0) && enemy.aiState?.lastMove !== 'constrict'
            if (canConstrict && ((enemy.asc ?? 0) >= 17 || rng.random() < 0.5)) { enemy.aiState = { ...enemy.aiState, lastMove: 'constrict', repeats: 1 }; return buff('Constrict', [power('CONSTRICTED', asc(enemy, 17, 10, 12), 'player')]) }
            return chooseMove(rng, enemy, [
                { id: 'quick', weight: 50, limit: 2, intent: () => attack(enemy, 16, 18) },
                { id: 'smash', weight: canConstrict ? 0 : 50, limit: 2, intent: () => attack(enemy, 22, 25) },
            ])
        } },
    MAW: { id: 'MAW', name: 'The Maw', hp: 300,
        nextIntent: (rng, enemy) => {
            const n = turn(enemy)
            if (n === 0) { enemy.aiState = { ...enemy.aiState, lastMove: 'roar' }; return buff('Roar', [power('WEAK', asc(enemy, 17, 3, 5), 'player'), power('FRAIL', asc(enemy, 17, 3, 5), 'player')]) }
            const last = enemy.aiState?.lastMove
            return chooseMove(rng, enemy, [
                { id: 'slam', weight: last === 'roar' || last === 'drool' ? 50 : 0, limit: 1, intent: () => attack(enemy, 25, 30) },
                { id: 'nom', weight: last === 'nom' ? 0 : 50, limit: 1, intent: () => attack(enemy, 5, 5, Math.ceil((n + 1) / 2)) },
                { id: 'drool', weight: last === 'nom' ? 100 : last === 'slam' ? 50 : 0, limit: 1, intent: () => buff('Drool', [power('STRENGTH', asc(enemy, 17, 3, 5))]) },
            ])
        },
    },
    TRANSIENT: { id: 'TRANSIENT', name: 'Transient', hp: 999,
        nextIntent: (_rng, enemy) => turn(enemy) >= asc(enemy, 17, 5, 6) ? buff('Fade', [{ kind: 'escape' }]) : attack(enemy, 20 + Number(enemy.aiState?.turn ?? 1) * 10, 30 + Number(enemy.aiState?.turn ?? 1) * 10),
        onDamageTaken: (engine, enemy, damage) => { if (damage > 0) { engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: -damage }); enemy.aiState = { ...enemy.aiState, shifted: Number(enemy.aiState?.shifted ?? 0) + damage } } },
        onIntentResolved: (engine, enemy) => { engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: Number(enemy.aiState?.shifted ?? 0) }); enemy.aiState = { ...enemy.aiState, shifted: 0 } },
    },
    WRITHING_MASS: { id: 'WRITHING_MASS', name: 'Writhing Mass', hp: 160, highHp: 175,
        nextIntent: (rng, enemy) => {
            const first = !enemy.aiState?.lastMove
            return chooseMove(rng, enemy, [
                { id: 'multi', weight: first ? 25 : 30, limit: 1, intent: () => attack(enemy, 7, 9, 3) },
                { id: 'strong', weight: first ? 25 : 10, limit: 1, intent: () => attack(enemy, 32, 38) },
                { id: 'flail', weight: first ? 25 : 30, limit: 1, intent: () => attack(enemy, 15, 16, 1, [block(asc(enemy, 2, 16, 18))]) },
                { id: 'wither', weight: first ? 25 : 20, limit: 1, intent: () => attack(enemy, 10, 12, 1, [power('WEAK', 2, 'player'), power('VULNERABLE', 2, 'player')]) },
                { id: 'implant', weight: first || enemy.aiState?.implanted ? 0 : 10, limit: 1, intent: () => buff('Implant') },
            ])
        },
        onHitByPlayerAttack: (engine, enemy, damage) => {
            if (enemy.hp <= 0) return
            if (damage > 0) {
                const amount = Number(enemy.aiState?.malleable ?? 3)
                engine.gainBlock(enemy.id, amount); enemy.aiState = { ...enemy.aiState, malleable: amount + 1 }
            }
            enemy.intent = ACT_THREE_ENEMIES.WRITHING_MASS.nextIntent(engine.rng, enemy, engine.state)
        },
        onIntentResolved: (engine, enemy, intent) => { enemy.aiState = { ...enemy.aiState, malleable: 3 }; if (intent?.move === 'implant') { engine.gainCurse('PARASITE'); enemy.aiState = { ...enemy.aiState, implanted: true } } },
    },
    DAGGER: { id: 'DAGGER', name: 'Dagger', hp: [20, 25], highHp: [25, 30], tags: ['minion'],
        nextIntent: (_rng, enemy) => turn(enemy) === 0 ? attack(enemy, 9, 9, 1, [cards('WOUND', 1)]) : { ...attack(enemy, 25), move: 'explode' },
        onIntentResolved: (_engine, enemy, intent) => { if (intent?.move === 'explode') { enemy.hp = 0; enemy.escaped = true } },
    },
    REPTOMANCER: { id: 'REPTOMANCER', name: 'Reptomancer', hp: [180, 190], highHp: [190, 200], tags: ['elite'],
        nextIntent: (rng, enemy, combat) => {
            const n = turn(enemy)
            if (combat.enemies.filter(e => e.hp > 0 && e.specId === 'DAGGER').length < 4 && (n === 0 || rng.random() < 0.33)) return { kind: 'summon', desc: 'Summon Daggers' }
            return rng.random() < 0.5 ? attack(enemy, 13, 16, 2, [power('WEAK', 1, 'player')]) : attack(enemy, 30, 34)
        },
        onIntentResolved: (engine, enemy, intent) => { if (intent?.kind === 'summon') engine.spawnEnemies(Array.from({ length: asc(enemy, 18, 1, 2) }, (_, i) => createEnemyState('DAGGER', `${enemy.id}-${enemy.aiState?.turn}-${i}`, enemy.asc, engine.rng))) },
    },
    NEMESIS: { id: 'NEMESIS', name: 'Nemesis', hp: 185, highHp: 200, tags: ['elite'],
        nextIntent: (rng, enemy) => chooseMove(rng, enemy, [
            { id: 'debuff', weight: 35, limit: 1, intent: () => buff('Debilitate', [cards('BURN', asc(enemy, 18, 3, 5))]) },
            { id: 'multi', weight: 35, limit: 2, intent: () => attack(enemy, 6, 7, 3) },
            { id: 'scythe', weight: enemy.aiState?.lastMove ? 30 : 0, limit: 1, intent: () => attack(enemy, 45) },
        ]),
        onIntentResolved: (_engine, enemy) => { setPower(enemy, 'INTANGIBLE', turn(enemy) % 2 === 0 ? 1 : 0) },
    },
    GIANT_HEAD: { id: 'GIANT_HEAD', name: 'Giant Head', hp: 500, highHp: 520, tags: ['elite'],
        initialize: enemy => { enemy.aiState = { slow: 0 } },
        nextIntent: (rng, enemy) => {
            const n = turn(enemy); enemy.aiState = { ...enemy.aiState, slow: 0 }
            const start = asc(enemy, 18, 4, 3)
            if (n >= start) return attack(enemy, 30 + Math.min(30, (n - start) * 5), 40 + Math.min(30, (n - start) * 5))
            return rng.random() < 0.5 ? attack(enemy, 13) : buff('Glare', [power('WEAK', 1, 'player')])
        },
        onPlayerCardPlayed: (_engine, enemy) => { enemy.aiState = { ...enemy.aiState, slow: Number(enemy.aiState?.slow ?? 0) + 1 } },
    },
    DONU: { id: 'DONU', name: 'Donu', hp: 250, highHp: 265, tags: ['boss'], initialize: enemy => setPower(enemy, 'ARTIFACT', asc(enemy, 19, 2, 3)),
        nextIntent: (_rng, enemy) => turn(enemy) % 2 === 0 ? buff('Circle of Power', [power('STRENGTH', 3, 'allies')]) : attack(enemy, 10, 12, 2) },
    DECA: { id: 'DECA', name: 'Deca', hp: 250, highHp: 265, tags: ['boss'], initialize: enemy => setPower(enemy, 'ARTIFACT', asc(enemy, 19, 2, 3)),
        nextIntent: (_rng, enemy) => turn(enemy) % 2 === 0 ? attack(enemy, 10, 12, 2, [cards('DAZED', 2)]) : buff('Square of Protection', [block(16, 'allies'), ...(asc(enemy, 19, 0, 1) ? [power('PLATED_ARMOR', 3, 'allies')] : [])]) },
    TIME_EATER: { id: 'TIME_EATER', name: 'Time Eater', hp: 456, highHp: 480, tags: ['boss'],
        nextIntent: (rng, enemy) => {
            if (enemy.hp < enemy.maxHp / 2 && !enemy.aiState?.hasted) {
                enemy.aiState = { ...enemy.aiState, hasted: true }
                return buff('Haste', [{ kind: 'cleanse' }, { kind: 'heal', amount: Math.floor(enemy.maxHp / 2) - enemy.hp, target: 'self' }, block(asc(enemy, 19, 0, 32))])
            }
            return chooseMove(rng, enemy, [
                { id: 'reverberate', weight: 45, limit: 2, intent: () => attack(enemy, 7, 8, 3) },
                { id: 'slam', weight: 35, limit: 1, intent: () => attack(enemy, 26, 32, 1, [power('DRAW_REDUCTION', 1, 'player'), ...(asc(enemy, 19, 0, 1) ? [cards('SLIMED', 2)] : [])]) },
                { id: 'ripple', weight: 20, limit: 1, intent: () => buff('Ripple', [block(20), power('VULNERABLE', 1, 'player'), power('WEAK', 1, 'player'), ...(asc(enemy, 19, 0, 1) ? [power('FRAIL', 1, 'player')] : [])]) },
            ])
        },
        onPlayerCardPlayed: (engine, enemy) => {
            const count = Number(enemy.aiState?.cards ?? 0) + 1
            enemy.aiState = { ...enemy.aiState, cards: count % 12 }
            if (count === 12) { engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: 2 }); engine.requestEndTurn() }
        },
    },
    AWAKENED_ONE: { id: 'AWAKENED_ONE', name: 'Awakened One', hp: 300, highHp: 320, tags: ['boss'],
        initialize: enemy => { setPower(enemy, 'REGENERATE', asc(enemy, 19, 10, 15)); if ((enemy.asc ?? 0) >= 4) setPower(enemy, 'STRENGTH', 2) },
        nextIntent: (rng, enemy) => {
            if (enemy.halfDead) return { ...buff('Rebirth'), move: 'rebirth' }
            const n = turn(enemy)
            if (!enemy.aiState?.awakened) return n === 0 ? attack(enemy, 20) : chooseMove(rng, enemy, [
                { id: 'slash', weight: 75, limit: 2, intent: () => attack(enemy, 20) },
                { id: 'soul', weight: 25, limit: 1, intent: () => attack(enemy, 6, 6, 4) },
            ])
            if (n === 0) return attack(enemy, 40)
            return chooseMove(rng, enemy, [
                { id: 'sludge', weight: 50, limit: 2, intent: () => attack(enemy, 18, 18, 1, [cards('VOID', 1, 'drawPile')]) },
                { id: 'tackle', weight: 50, limit: 2, intent: () => attack(enemy, 10, 10, 3) },
            ])
        },
        onDamageTaken: (_engine, enemy) => { if (enemy.hp <= 0 && !enemy.aiState?.awakened) { enemy.halfDead = true; enemy.intent = { ...buff('Rebirth'), move: 'rebirth' } } },
        onIntentResolved: (_engine, enemy, intent) => {
            if (intent?.move !== 'rebirth') return
            enemy.halfDead = false; enemy.hp = enemy.maxHp; enemy.aiState = { ...enemy.aiState, awakened: true, turn: 0 }
            enemy.powers = enemy.powers.filter(p => ['STRENGTH', 'REGENERATE'].includes(p.id) && p.stacks > 0)
        },
        onPlayerCardPlayed: (engine, enemy, type) => { if (type === 'power' && !enemy.halfDead && !enemy.aiState?.awakened) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: asc(enemy, 19, 1, 2) }) },
    },
}
