import type { Engine } from './engine'
import type { CardInstance } from './state'
import { CARD_DEFS, resolveCard } from './cards'
import { powerAmount } from './combatMath'

export function onStartOfPlayerTurn(engine: Engine): void {
    const player = engine.state.player
    const demonForm = player.powers.find(power => power.id === 'DEMON_FORM')?.stacks ?? 0
    if (demonForm > 0) engine.enqueue({ kind: 'ApplyPower', target: player.id, powerId: 'STRENGTH', stacks: demonForm })

    const brutality = player.powers.find(power => power.id === 'BRUTALITY')?.stacks ?? 0
    if (brutality > 0) {
        engine.enqueue({ kind: 'LoseHp', target: player.id, amount: brutality })
        engine.enqueue({ kind: 'DrawCards', count: brutality })
    }

    const berserk = player.powers.find(power => power.id === 'BERSERK')?.stacks ?? 0
    if (berserk > 0) engine.enqueue({ kind: 'GainEnergy', amount: berserk })
}

export function onEndOfPlayerTurn(engine: Engine): void {
    const constricted = powerAmount(engine.state.player, 'CONSTRICTED')
    if (constricted > 0) engine.enqueue({ kind: 'DealDamage', source: 'player', target: 'player', amount: constricted, damageType: 'effect' })
    const strengthDown = engine.state.player.powers.find(power => power.id === 'STRENGTH_DOWN_NEXT_TURN')?.stacks ?? 0
    if (strengthDown > 0) {
        engine.enqueue({ kind: 'ApplyPower', target: engine.state.player.id, powerId: 'STRENGTH', stacks: -strengthDown })
        engine.setPowerStacks(engine.state.player, 'STRENGTH_DOWN_NEXT_TURN', 0)
    }
    engine.setPowerStacks(engine.state.player, 'RAGE', 0)
    const combust = engine.state.player.powers.find(power => power.id === 'COMBUST')?.stacks ?? 0
    if (combust > 0) {
        engine.enqueue({ kind: 'LoseHp', target: engine.state.player.id, amount: powerAmount(engine.state.player, 'COMBUST_HP_LOSS') || 1 })
        for (const enemy of engine.state.enemies) {
            if (enemy.hp > 0) engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: enemy.id, amount: combust, damageType: 'effect' })
        }
    }
    const armor = powerAmount(engine.state.player, 'PLATED_ARMOR')
    if (armor > 0) engine.enqueue({ kind: 'GainBlock', target: engine.state.player.id, amount: armor })
    const metallicize = engine.state.player.powers.find(power => power.id === 'METALLICIZE')?.stacks ?? 0
    if (metallicize > 0) engine.enqueue({ kind: 'GainBlock', target: engine.state.player.id, amount: metallicize })
}

export function onCardDrawn(engine: Engine, card: CardInstance): void {
    CARD_DEFS[card.defId].onDraw?.({ engine, card })
    if (card.defId === 'VOID') engine.enqueue({ kind: 'GainEnergy', amount: -Math.min(1, engine.state.player.energy) })
    const resolved = resolveCard(card)
    if (resolved.type !== 'status' && resolved.type !== 'curse') return
    const evolve = engine.state.player.powers.find(power => power.id === 'EVOLVE')?.stacks ?? 0
    if (evolve > 0 && resolved.type === 'status') engine.enqueue({ kind: 'DrawCards', count: evolve })
    const fireBreathing = engine.state.player.powers.find(power => power.id === 'FIRE_BREATHING')?.stacks ?? 0
    if (fireBreathing > 0) {
        for (const enemy of engine.state.enemies) {
            if (enemy.hp > 0) engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: enemy.id, amount: fireBreathing, damageType: 'effect' })
        }
    }
}

export function onPlayerCardPlayed(engine: Engine, type: string): void {
    if (type !== 'attack') {
        if (powerAmount(engine.state.player, 'HEX') > 0) engine.createCardsInDestination('DAZED', 'drawPile')
        return
    }
    const rage = engine.state.player.powers.find(power => power.id === 'RAGE')?.stacks ?? 0
    if (rage > 0) engine.enqueue({ kind: 'GainBlock', target: engine.state.player.id, amount: rage })
}

