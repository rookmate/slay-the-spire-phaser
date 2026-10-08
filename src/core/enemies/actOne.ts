import type { EnemySpec } from './model'
import { asc, attack, block, buff, cards, chooseMove, power, setPower, turn } from './helpers'
import { createEnemyState } from '../enemies'

function slime(id: string, name: string, hp: readonly [number, number], highHp: readonly [number, number], acid: boolean, size: 'S' | 'M' | 'L'): EnemySpec {
    return {
        id, name, hp, highHp,
        nextIntent: (rng, enemy) => {
            turn(enemy)
            if (enemy.aiState?.splitting) return { kind: 'summon', desc: 'Split', move: 'split' }
            if (size === 'S') return acid && rng.random() < 0.5
                ? buff('Lick', [power('WEAK', 1, 'player')]) : attack(enemy, acid ? 3 : 5, acid ? 4 : 6)
            return chooseMove(rng, enemy, [
                { id: 'tackle', weight: acid ? 40 : 70, limit: 2, intent: () => attack(enemy, size === 'L' ? (acid ? 16 : 16) : 10, size === 'L' ? 18 : 12, 1, acid ? [] : [cards('SLIMED', size === 'L' ? 2 : 1)]) },
                { id: 'lick', weight: 30, limit: acid ? 2 : 1, intent: () => buff('Lick', [power(acid ? 'WEAK' : 'FRAIL', size === 'L' ? 2 : 1, 'player')]) },
                ...(acid ? [{ id: 'spit', weight: 30, limit: 2, intent: () => attack(enemy, size === 'L' ? 11 : 7, size === 'L' ? 12 : 8, 1, [cards('SLIMED', size === 'L' ? 2 : 1)]) }] : []),
            ])
        },
        onDamageTaken: (_engine, enemy) => {
            if (size === 'L' && enemy.hp > 0 && enemy.hp <= enemy.maxHp / 2) {
                enemy.aiState = { ...enemy.aiState, splitting: true }
                enemy.intent = { kind: 'summon', desc: 'Split', move: 'split' }
            }
        },
        onIntentResolved: (engine, enemy, intent) => {
            if (intent?.move !== 'split') return
            const key = `${acid ? 'ACID' : 'SPIKE'}_SLIME_M`
            const children = [0, 1].map(i => {
                const child = createEnemyState(key, `${enemy.id}-${i}`, enemy.asc, engine.rng)
                child.maxHp = child.hp = enemy.hp
                return child
            })
            engine.removeEnemy(enemy.id); engine.spawnEnemies(children)
        },
    }
}
function louse(id: string, green: boolean): EnemySpec {
    return {
        id, name: `${green ? 'Green' : 'Red'} Louse`, hp: green ? [11, 17] : [10, 15], highHp: green ? [12, 18] : [11, 16],
        initialize: (enemy, rng) => { setPower(enemy, 'CURL_UP', (enemy.asc ?? 0) >= 17 ? rng.int(9, 12) : (enemy.asc ?? 0) >= 7 ? rng.int(4, 8) : rng.int(3, 7)); enemy.aiState = { bite: rng.int(5, 7) } },
        nextIntent: (rng, enemy) => chooseMove(rng, enemy, [
            { id: 'bite', weight: 75, limit: 2, intent: () => attack(enemy, Number(enemy.aiState?.bite ?? 6), Number(enemy.aiState?.bite ?? 6) + 1) },
            { id: 'grow', weight: 25, limit: asc(enemy, 17, 2, 1), intent: () => buff(green ? 'Spit Web' : 'Grow', [power(green ? 'WEAK' : 'STRENGTH', green ? 2 : asc(enemy, 17, 3, 4), green ? 'player' : 'self')]) },
        ]),
        onHitByPlayerAttack: (_engine, enemy, damage) => {
            const curl = enemy.powers.find(p => p.id === 'CURL_UP')
            if (damage > 0 && curl?.stacks) { enemy.aiState = { ...enemy.aiState, pendingCurl: curl.stacks }; curl.stacks = 0 }
        },
        onCardEffectsResolved: (engine, enemy) => {
            const amount = Number(enemy.aiState?.pendingCurl ?? 0)
            if (amount) { engine.gainBlock(enemy.id, amount); enemy.aiState!.pendingCurl = 0 }
        },
    }
}

export const ACT_ONE_ENEMIES: Record<string, EnemySpec> = {
    CULTIST: { id: 'CULTIST', name: 'Cultist', hp: [48, 54], highHp: [50, 56],
        nextIntent: (_rng, enemy) => turn(enemy) === 0 ? buff('Ritual', [power('RITUAL', asc(enemy, 17, asc(enemy, 2, 3, 4), 5))]) : attack(enemy, 6),
    },
    JAW_WORM: { id: 'JAW_WORM', name: 'Jaw Worm', hp: [40, 44], highHp: [42, 46],
        nextIntent: (rng, enemy) => {
            if (turn(enemy) === 0) return attack(enemy, 11, 12)
            return chooseMove(rng, enemy, [
                { id: 'chomp', weight: 25, limit: 1, intent: () => attack(enemy, 11, 12) },
                { id: 'thrash', weight: 30, limit: 2, intent: () => attack(enemy, 7, 7, 1, [block(5)]) },
                { id: 'bellow', weight: 45, limit: 1, intent: () => buff('Bellow', [power('STRENGTH', asc(enemy, 17, asc(enemy, 2, 3, 4), 5)), block(asc(enemy, 17, 6, 9))]) },
            ])
        },
    },
    RED_LOUSE: louse('RED_LOUSE', false), GREEN_LOUSE: louse('GREEN_LOUSE', true),
    SPIKE_SLIME_S: slime('SPIKE_SLIME_S', 'Spike Slime (S)', [10, 14], [11, 15], false, 'S'),
    SPIKE_SLIME_M: slime('SPIKE_SLIME_M', 'Spike Slime (M)', [28, 32], [29, 34], false, 'M'),
    SPIKE_SLIME_L: slime('SPIKE_SLIME_L', 'Spike Slime (L)', [64, 70], [67, 73], false, 'L'),
    ACID_SLIME_S: slime('ACID_SLIME_S', 'Acid Slime (S)', [8, 12], [9, 13], true, 'S'),
    ACID_SLIME_M: slime('ACID_SLIME_M', 'Acid Slime (M)', [28, 32], [29, 34], true, 'M'),
    ACID_SLIME_L: slime('ACID_SLIME_L', 'Acid Slime (L)', [65, 69], [68, 72], true, 'L'),
    FUNGI_BEAST: { id: 'FUNGI_BEAST', name: 'Fungi Beast', hp: [22, 28], highHp: [24, 28],
        nextIntent: (rng, enemy) => chooseMove(rng, enemy, [
            { id: 'bite', weight: 60, limit: 2, intent: () => attack(enemy, 6) },
            { id: 'grow', weight: 40, limit: 1, intent: () => buff('Grow', [power('STRENGTH', asc(enemy, 17, asc(enemy, 2, 3, 4), 5))]) },
        ]),
        onDamageTaken: (engine, enemy) => { if (enemy.hp <= 0) engine.applyPowerToPlayer('VULNERABLE', 2) },
    },
    SNEAKY_GREMLIN: { id: 'SNEAKY_GREMLIN', name: 'Sneaky Gremlin', hp: [10, 14], highHp: [11, 15], nextIntent: (_rng, enemy) => attack(enemy, 9, 10) },
    MAD_GREMLIN: { id: 'MAD_GREMLIN', name: 'Mad Gremlin', hp: [20, 24], highHp: [21, 25], nextIntent: (_rng, enemy) => attack(enemy, 4, 5),
        onDamageTaken: (engine, enemy, damage) => { if (damage > 0 && enemy.hp > 0) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: asc(enemy, 17, 1, 2) }) },
    },
    FAT_GREMLIN: { id: 'FAT_GREMLIN', name: 'Fat Gremlin', hp: [13, 17], highHp: [14, 18], nextIntent: (_rng, enemy) => attack(enemy, 4, 5, 1, [power('WEAK', 1, 'player'), ...(asc(enemy, 17, 0, 1) ? [power('FRAIL', 1, 'player')] : [])]) },
    SHIELD_GREMLIN: { id: 'SHIELD_GREMLIN', name: 'Shield Gremlin', hp: [12, 15], highHp: [13, 17], nextIntent: (_rng, enemy, combat) => combat.enemies.filter(e => e.hp > 0).length === 1 ? attack(enemy, 6, 8) : buff('Protect', [block(asc(enemy, 17, 7, 11), 'ally')]) },
    WIZARD_GREMLIN: { id: 'WIZARD_GREMLIN', name: 'Gremlin Wizard', hp: [23, 25], highHp: [22, 26], nextIntent: (_rng, enemy) => { const n = turn(enemy); return n < 2 || ((enemy.asc ?? 0) < 17 && (n - 2) % 4 !== 0) ? buff('Charging') : attack(enemy, 25, 30) } },
    GREMLIN_NOB: { id: 'GREMLIN_NOB', name: 'Gremlin Nob', hp: [82, 86], highHp: [85, 90], tags: ['elite'],
        nextIntent: (rng, enemy) => {
            const n = turn(enemy)
            if (n === 0) return buff('Bellow')
            if ((enemy.asc ?? 0) >= 18) return n % 3 === 1 ? attack(enemy, 6, 8, 1, [power('VULNERABLE', 2, 'player')]) : attack(enemy, 14, 16)
            return chooseMove(rng, enemy, [{ id: 'bash', weight: 33, limit: 99, intent: () => attack(enemy, 6, 8, 1, [power('VULNERABLE', 2, 'player')]) }, { id: 'rush', weight: 67, limit: 2, intent: () => attack(enemy, 14, 16) }])
        },
        onIntentResolved: (_engine, enemy, intent) => { if (intent?.kind === 'buff') enemy.aiState = { ...enemy.aiState, enraged: true } },
        onPlayerCardPlayed: (engine, enemy, type) => { if (type === 'skill' && enemy.aiState?.enraged) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: asc(enemy, 18, 2, 3) }) },
    },
    LAGAVULIN: { id: 'LAGAVULIN', name: 'Lagavulin', hp: [109, 111], highHp: [112, 115], tags: ['elite'],
        initialize: enemy => { enemy.block = 8; enemy.aiState = { asleep: true, sleepTurns: 0 } },
        nextIntent: (_rng, enemy) => {
            if (enemy.aiState?.asleep && Number(enemy.aiState.sleepTurns) < 3) {
                enemy.aiState.sleepTurns = Number(enemy.aiState.sleepTurns) + 1
                return buff('Sleep', [block(8)])
            }
            const n = turn(enemy)
            return n % 3 < 2 ? attack(enemy, 18, 20) : buff('Siphon Soul', [power('STRENGTH', -asc(enemy, 18, 1, 2), 'player'), power('DEXTERITY', -asc(enemy, 18, 1, 2), 'player')])
        },
        onDamageTaken: (_engine, enemy, damage) => { if (damage > 0 && enemy.aiState?.asleep) { enemy.aiState.asleep = false; enemy.intent = buff('Waking') } },
    },
    SENTRY: { id: 'SENTRY', name: 'Sentry', hp: [38, 42], highHp: [39, 45], tags: ['elite'],
        initialize: enemy => { enemy.aiState = { turn: Number(enemy.id.replace(/\D/g, '')) % 2 }; setPower(enemy, 'ARTIFACT', 1) },
        nextIntent: (_rng, enemy) => turn(enemy) % 2 === 0 ? attack(enemy, 9, 10) : { kind: 'status', createdDefId: 'DAZED', destination: 'discardPile', count: asc(enemy, 18, 2, 3) },
    },
    SLIME_BOSS: { id: 'SLIME_BOSS', name: 'Slime Boss', hp: 140, highHp: 150, tags: ['boss'],
        nextIntent: (_rng, enemy) => {
            if (enemy.aiState?.splitting) return { kind: 'summon', desc: 'Split', move: 'split' }
            const n = turn(enemy) % 3
            return n === 0 ? { kind: 'status', createdDefId: 'SLIMED', destination: 'discardPile', count: asc(enemy, 19, 3, 5) } : n === 1 ? buff('Preparing') : attack(enemy, 35, 38)
        },
        onDamageTaken: (_engine, enemy) => { if (enemy.hp > 0 && enemy.hp <= enemy.maxHp / 2) { enemy.aiState = { ...enemy.aiState, splitting: true }; enemy.intent = { kind: 'summon', desc: 'Split', move: 'split' } } },
        onIntentResolved: (engine, enemy, intent) => {
            if (intent?.move !== 'split') return
            const children = ['ACID_SLIME_L', 'SPIKE_SLIME_L'].map((id, index) => {
                const child = createEnemyState(id, `${enemy.id}-${index}`, enemy.asc, engine.rng)
                child.maxHp = child.hp = enemy.hp
                return child
            })
            engine.removeEnemy(enemy.id); engine.spawnEnemies(children)
        },
    },
    HEXAGHOST: { id: 'HEXAGHOST', name: 'Hexaghost', hp: 250, highHp: 264, tags: ['boss'],
        nextIntent: (_rng, enemy, combat) => {
            const n = turn(enemy)
            if (n === 0) return buff('Activate')
            if (n === 1) return { kind: 'multi_attack', amount: Math.floor(combat.player.hp / 12) + 1, hits: 6 }
            const step = (n - 2) % 7
            if (step === 0 || step === 2 || step === 5) return attack(enemy, 6, 6, 1, [{ ...cards('BURN', asc(enemy, 19, 1, 2)), upgradeLevel: enemy.aiState?.inferno ? 1 : 0 }])
            if (step === 1 || step === 4) return attack(enemy, 5, 6, 2)
            if (step === 3) return buff('Inflame', [power('STRENGTH', asc(enemy, 19, 2, 3)), block(12)])
            return { ...attack(enemy, 2, 3, 6, [{ ...cards('BURN', 3), upgradeLevel: 1 }]), move: 'inferno' }
        },
        onIntentResolved: (engine, enemy, intent) => {
            if (intent?.move !== 'inferno') return
            enemy.aiState = { ...enemy.aiState, inferno: true }
            for (const card of [...engine.state.player.drawPile, ...engine.state.player.discardPile]) if (card.defId === 'BURN') card.upgradeLevel = 1
        },
    },
    THE_GUARDIAN: { id: 'THE_GUARDIAN', name: 'The Guardian', hp: 240, highHp: 250, tags: ['boss'],
        initialize: enemy => { enemy.aiState = { modeShift: asc(enemy, 19, 30, 40), threshold: asc(enemy, 19, 30, 40), defensive: false, turn: 0 } },
        nextIntent: (_rng, enemy) => {
            const n = turn(enemy)
            if (enemy.aiState?.defensive) {
                if (n === 0) return buff('Defensive Mode')
                if (n === 1) return attack(enemy, 9, 10)
                return { ...attack(enemy, 8, 8, 2), move: 'leave-defense' }
            }
            return [buff('Charging Up', [block(9)]), attack(enemy, 32, 36), buff('Vent Steam', [power('WEAK', 2, 'player'), power('VULNERABLE', 2, 'player')]), attack(enemy, 5, 5, 4)][n % 4]
        },
        onDamageTaken: (_engine, enemy, damage) => {
            if (enemy.aiState?.defensive || enemy.hp <= 0) return
            enemy.aiState = { ...enemy.aiState, modeShift: Number(enemy.aiState?.modeShift ?? 30) - damage }
            if (Number(enemy.aiState.modeShift) > 0) return
            enemy.aiState.defensive = true; enemy.aiState.turn = 1
            enemy.block += 20; enemy.intent = buff('Defensive Mode')
        },
        onPlayerCardPlayed: (engine, enemy, type) => { if (type === 'attack' && enemy.aiState?.defensive) engine.enqueue({ kind: 'DealDamage', source: enemy.id, target: 'player', amount: asc(enemy, 19, 3, 4), damageType: 'thorns' }) },
        onIntentResolved: (_engine, enemy, intent) => {
            if (intent?.move !== 'leave-defense') return
            const threshold = Number(enemy.aiState?.threshold ?? 30) + 10
            enemy.aiState = { ...enemy.aiState, defensive: false, threshold, modeShift: threshold, turn: 3 }
        },
    },
}
