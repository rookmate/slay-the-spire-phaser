import { startSharedTurn, endSharedTurn, onSharedCardPlayed } from './sharedHooks'
import { createCombatCard } from './cardCreation'
import { startWatcherTurn, endWatcherTurn } from './watcherHooks'
import { startDefectTurn, onDefectPowerPlayed } from './defectHooks'
import type { Engine } from '../engine'
import type { CardInstance, PowerId } from '../state'
import { resolveCard } from '../cards'
import { powerAmount } from '../combatMath'
import { chooseDiscard } from './choices'

export function startEnemyPoison(engine: Engine): void {
    // Snapshot all ticks before deaths can transfer poison to another target.
    for (const enemy of engine.state.enemies.filter(e => e.hp > 0)) {
        const amount = powerAmount(enemy, 'POISON')
        if (amount <= 0) continue
        engine.enqueue({ kind: 'LoseHp', target: enemy.id, amount, fromCard: false, origin: 'poison' })
        engine.afterQueuedEffects(() => engine.setPowerStacks(enemy, 'POISON', Math.max(0, powerAmount(enemy, 'POISON') - 1)))
    }
}
export function finishRoundPowers(engine: Engine): void {
    const player = engine.state.player
    for (const id of ['INTANGIBLE', 'DOUBLE_DAMAGE', 'LOCK_ON', 'NO_BLOCK'] as const)
        engine.setPowerStacks(player, id, Math.max(0, powerAmount(player, id) - 1))
    for (const enemy of engine.state.enemies) {
        const strength = powerAmount(enemy, 'STRENGTH_UP_NEXT_TURN')
        if (strength > 0 && enemy.hp > 0) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: strength })
        engine.setPowerStacks(enemy, 'STRENGTH_UP_NEXT_TURN', 0)
        engine.setPowerStacks(enemy, 'CHOKE', 0)
        engine.setPowerStacks(enemy, 'INTANGIBLE', Math.max(0, powerAmount(enemy, 'INTANGIBLE') - 1))
        engine.setPowerStacks(enemy, 'LOCK_ON', Math.max(0, powerAmount(enemy, 'LOCK_ON') - 1))
    }
}
export function startCharacterTurn(engine: Engine): void {
    startSharedTurn(engine)
    startWatcherTurn(engine)
    startDefectTurn(engine)
    const player = engine.state.player
    const consume = (id: PowerId): number => { const value = powerAmount(player, id); engine.setPowerStacks(player, id, 0); return value }
    const energy = consume('ENERGY_NEXT_TURN'), draw = consume('DRAW_NEXT_TURN'), block = consume('BLOCK_NEXT_TURN')
    if (energy) engine.enqueue({ kind: 'GainEnergy', amount: energy })
    if (draw) engine.enqueue({ kind: 'DrawCards', count: draw })
    if (block) engine.enqueue({ kind: 'GainBlock', target: player.id, amount: block })
    const doubleDamage = consume('PHANTASMAL_KILLER')
    if (doubleDamage) engine.applyPowerToPlayer('DOUBLE_DAMAGE', doubleDamage)
    const shivs = powerAmount(player, 'INFINITE_BLADES')
    if (shivs) engine.createCardsInDestination('SHIV', 'hand', shivs)
    const fumes = powerAmount(player, 'NOXIOUS_FUMES')
    if (fumes) for (const enemy of engine.state.enemies.filter(e => e.hp > 0)) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'POISON', stacks: fumes })
    for (const source of engine.state.nextTurnCopies ?? []) engine.insertCard(createCombatCard(engine, source), 'hand')
    engine.state.nextTurnCopies = []
    const tools = powerAmount(player, 'TOOLS_OF_THE_TRADE')
    if (tools) {
        engine.enqueue({ kind: 'DrawCards', count: tools })
        engine.afterQueuedEffects(() => chooseDiscard(engine, tools, 'tools-of-the-trade'))
    }
}
export function endCharacterTurn(engine: Engine): void {
    endSharedTurn(engine)
    endWatcherTurn(engine)
    const player = engine.state.player
    const dexterityLoss = powerAmount(player, 'WRAITH_FORM') + powerAmount(player, 'DEXTERITY_DOWN')
    if (dexterityLoss) engine.applyPowerToPlayer('DEXTERITY', -dexterityLoss)
    engine.setPowerStacks(player, 'DEXTERITY_DOWN', 0)
    engine.setPowerStacks(player, 'DUPLICATION', 0)
    engine.setPowerStacks(player, 'BURST', 0)
    engine.setPowerStacks(player, 'AMPLIFY', 0)
    engine.setPowerStacks(player, 'REBOUND', 0)
    const ritual = powerAmount(player, 'RITUAL')
    if (ritual > 0) engine.applyPowerToPlayer('STRENGTH', ritual)
    const regen = powerAmount(player, 'REGENERATION')
    if (regen > 0) { engine.enqueue({ kind: 'Heal', target: player.id, amount: regen }); engine.setPowerStacks(player, 'REGENERATION', regen - 1) }
}
export function onCharacterCardPlayed(engine: Engine, card: CardInstance): void {
    onSharedCardPlayed(engine)
    const player = engine.state.player
    const type = resolveCard(card).type
    const image = powerAmount(player, 'AFTER_IMAGE'), cuts = powerAmount(player, 'THOUSAND_CUTS')
    if (image) engine.enqueue({ kind: 'GainBlock', target: player.id, amount: image })
    for (const enemy of engine.state.enemies.filter(e => e.hp > 0)) {
        if (cuts) engine.enqueue({ kind: 'DealDamage', source: player.id, target: enemy.id, amount: cuts, damageType: 'effect', origin: 'power' })
        const choke = powerAmount(enemy, 'CHOKE')
        if (choke) engine.enqueue({ kind: 'LoseHp', target: enemy.id, amount: choke, fromCard: false })
    }
    if (type === 'attack') engine.state.attacksThisTurn = (engine.state.attacksThisTurn ?? 0) + 1
    if (type === 'power') { engine.state.powersPlayed = (engine.state.powersPlayed ?? 0) + 1; onDefectPowerPlayed(engine) }
}
