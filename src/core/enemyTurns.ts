import { createCardInstance } from './cards'
import type { Engine } from './engine'
import type { EnemyEffect, EnemyState } from './state'
import { isDebuff, powerAmount } from './combatMath'
import { onEnemyIntentResolved } from './enemies'

export function executeEnemyMove(engine: Engine, enemy: EnemyState): void {
    if ((enemy.hp <= 0 && !enemy.halfDead) || enemy.escaped) return
    const intent = enemy.intent
    if (intent?.kind === 'attack' || intent?.kind === 'multi_attack') {
        const amount = Math.max(0, intent.amount + powerAmount(enemy, 'STRENGTH'))
        engine.enqueue(intent.kind === 'attack'
            ? { kind: 'DealDamage', source: enemy.id, target: 'player', amount }
            : { kind: 'DealMultiDamage', source: enemy.id, target: 'player', amount, hits: intent.hits })
    } else if (intent?.kind === 'block') engine.gainBlock(enemy.id, intent.amount)
    else if (intent?.kind === 'debuff') engine.applyPowerToPlayer(intent.debuff, intent.stacks)
    else if (intent?.kind === 'status') engine.createCardsInDestination(intent.createdDefId, intent.destination, intent.count)
    for (const effect of intent?.effects ?? []) engine.enqueue({ kind: 'EnemyEffect', enemyId: enemy.id, effect })
    engine.enqueue({ kind: 'EnemyMoveFinished', enemyId: enemy.id })
}

export function executeEnemyEffect(engine: Engine, enemy: EnemyState, effect: EnemyEffect): void {
    if (enemy.hp <= 0 && !enemy.halfDead) return
    switch (effect.kind) {
        case 'power': {
            const targets = effect.target === 'player' ? [engine.state.player] : effect.target === 'allies' ? engine.state.enemies.filter(e => e.hp > 0) : [enemy]
            for (const target of targets) engine.enqueue({ kind: 'ApplyPower', target: target.id, powerId: effect.id, stacks: effect.amount })
            return
        }
        case 'block':
        case 'heal': {
            const allies = engine.state.enemies.filter(e => e.hp > 0 && e.id !== enemy.id)
            const targets = effect.target === 'allies' ? engine.state.enemies.filter(e => e.hp > 0) : effect.target === 'ally' ? (allies.length ? [allies[engine.rng.int(0, allies.length - 1)]] : []) : [enemy]
            for (const target of targets) engine.enqueue({ kind: effect.kind === 'block' ? 'GainBlock' : 'Heal', target: target.id, amount: effect.amount })
            return
        }
        case 'cards': {
            if (effect.destination === 'drawPileTop') {
                for (let i = 0; i < effect.count; i++) engine.state.player.drawPile.unshift(createCardInstance(effect.id, effect.upgradeLevel ?? 0))
            } else engine.createCardsInDestination(effect.id, effect.destination, effect.count, effect.upgradeLevel)
            return
        }
        case 'cleanse': enemy.powers = enemy.powers.filter(p => !isDebuff(p.id, p.stacks)); return
        case 'steal': {
            const stolen = -engine.changeGold(-effect.amount)
            enemy.aiState = { ...enemy.aiState, stolenGold: Number(enemy.aiState?.stolenGold ?? 0) + stolen }
            return
        }
        case 'escape': enemy.hp = 0; enemy.escaped = true; return
    }
}

export function finishEnemyMove(engine: Engine, enemy: EnemyState): void {
    if (enemy.hp <= 0 && !enemy.halfDead) return
    onEnemyIntentResolved(engine, enemy)
    const ritual = enemy.powers.find(p => p.id === 'RITUAL')
    if (ritual?.fresh) ritual.fresh = false
    else if (ritual?.stacks) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: ritual.stacks })
    if (powerAmount(enemy, 'METALLICIZE') > 0) engine.gainBlock(enemy.id, powerAmount(enemy, 'METALLICIZE'))
    if (powerAmount(enemy, 'PLATED_ARMOR') > 0) engine.gainBlock(enemy.id, powerAmount(enemy, 'PLATED_ARMOR'))
    if (powerAmount(enemy, 'REGENERATE') > 0) engine.enqueue({ kind: 'Heal', target: enemy.id, amount: powerAmount(enemy, 'REGENERATE') })
}
