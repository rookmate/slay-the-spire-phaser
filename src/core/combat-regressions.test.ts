import { describe, expect, it } from 'vitest'
import { createCardInstance } from './cards'
import { Engine, createDummyEnemy, createPlayerFromDeck } from './engine'

function combat(cardIds: string[] = []) {
    const player = createPlayerFromDeck('regression', cardIds.map(id => createCardInstance(id)), 80, 80)
    player.hand = player.drawPile.splice(0)
    const enemy = createDummyEnemy('enemy')
    return new Engine('regression', player, [enemy])
}

describe('combat action ordering', () => {
    it('finishes nested end-of-turn effects before clearing enemy block', () => {
        const engine = combat()
        engine.state.player.powers.push({ id: 'METALLICIZE', stacks: 3 }, { id: 'JUGGERNAUT', stacks: 1 })
        const enemy = engine.state.enemies[0]
        enemy.block = 15
        enemy.intent = { kind: 'buff', desc: 'Idle' }
        engine.enqueue({ kind: 'EndTurn' })
        const events = engine.runUntilIdle()

        expect(enemy.hp).toBe(40)
        expect(enemy.block).toBe(0)
        const damageIndex = events.findIndex(event => event.kind === 'DamageApplied')
        const turnIndex = events.findIndex(event => event.kind === 'TurnChanged' && event.turn === 'enemy')
        expect(damageIndex).toBeLessThan(turnIndex)
    })

    it('resolves player end-of-turn damage before the enemy turn clears block', () => {
        const engine = combat()
        engine.state.player.powers.push({ id: 'COMBUST', stacks: 5 })
        const enemy = engine.state.enemies[0]
        enemy.block = 15
        enemy.intent = { kind: 'buff', desc: 'Idle' }
        engine.enqueue({ kind: 'EndTurn' })
        const events = engine.runUntilIdle()

        expect(enemy.hp).toBe(40)
        expect(enemy.block).toBe(0)
        const damageIndex = events.findIndex(event => event.kind === 'DamageApplied')
        const turnIndex = events.findIndex(event => event.kind === 'TurnChanged' && event.turn === 'enemy')
        expect(damageIndex).toBeLessThan(turnIndex)
    })

    it.each([[20, 80], [7, 77]])('uses %i block before enemy multiattacks finish', (block, hp) => {
        const engine = combat()
        engine.state.player.block = block
        engine.state.enemies[0].intent = { kind: 'multi_attack', amount: 5, hits: 2 }
        engine.enqueue({ kind: 'EndTurn' })
        const events = engine.runUntilIdle()

        expect(engine.state.player.hp).toBe(hp)
        const nextTurn = events.findIndex(event => event.kind === 'TurnChanged' && event.turn === 'player')
        expect(events.slice(0, nextTurn).filter(event => event.kind === 'DamageApplied')).toHaveLength(2)
    })

    it('retains Weak and temporary thorns through every enemy hit', () => {
        const engine = combat()
        engine.addTemporaryThorns(4)
        engine.state.enemies[0].powers.push({ id: 'WEAK', stacks: 1 })
        engine.state.enemies[0].intent = { kind: 'multi_attack', amount: 8, hits: 2 }
        engine.enqueue({ kind: 'EndTurn' })
        const events = engine.runUntilIdle()

        expect(engine.state.player.hp).toBe(68)
        expect(engine.state.enemies[0].hp).toBe(32)
        const nextTurn = events.findIndex(event => event.kind === 'TurnChanged' && event.turn === 'player')
        expect(events.slice(0, nextTurn).filter(event => event.kind === 'DamageApplied')).toHaveLength(4)
        expect(engine.state.player.powers.find(power => power.id === 'THORNS')).toBeUndefined()
    })

    it('stops remaining hits when thorns kills the attacker', () => {
        const engine = combat()
        engine.addTemporaryThorns(4)
        engine.state.enemies[0].hp = 4
        engine.state.enemies[0].intent = { kind: 'multi_attack', amount: 5, hits: 3 }
        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()
        engine.runUntilIdle()

        expect(engine.state.victory).toBe(true)
        expect(engine.state.player.hp).toBe(75)
    })

    it('keeps enemy block for the player turn and expires it on the enemy turn', () => {
        const engine = combat(['STRIKE'])
        const enemy = engine.state.enemies[0]
        enemy.intent = { kind: 'block', amount: 15 }
        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()
        expect(enemy.block).toBe(15)

        engine.playCard(engine.state.player.hand[0], [enemy.id])
        engine.runUntilIdle()
        expect(enemy.hp).toBe(40)
        expect(enemy.block).toBe(9)

        enemy.intent = { kind: 'buff', desc: 'Idle' }
        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()
        expect(enemy.block).toBe(0)
    })
})

describe('card damage and combat isolation', () => {
    it.each([['STRIKE', 4], ['HEAVY_BLADE', 10], ['TWIN_STRIKE', 6]])('applies Weak once to %s', (cardId, damage) => {
        const engine = combat([cardId])
        engine.state.player.powers.push({ id: 'WEAK', stacks: 1 })
        engine.playCard(engine.state.player.hand[0], ['enemy'])
        engine.runUntilIdle()
        expect(engine.state.enemies[0].hp).toBe(40 - damage)
    })

    it('keeps Armaments upgrades in combat across reshuffles', () => {
        const deck = ['ARMAMENTS', 'STRIKE', 'DEFEND'].map(id => createCardInstance(id))
        deck[2].upgradeLevel = 1
        const player = createPlayerFromDeck('upgrades', deck, 80, 80)
        player.hand = player.drawPile.splice(0)
        const engine = new Engine('upgrades', player, [createDummyEnemy('enemy')])
        const armaments = player.hand.find(card => card.defId === 'ARMAMENTS')!
        engine.playCard(armaments, [])
        engine.runUntilIdle()
        engine.submitPendingChoice([deck[1].instanceId])
        engine.runUntilIdle()
        engine.enqueue({ kind: 'DiscardHand' })
        engine.enqueue({ kind: 'DrawCards', count: 3 })
        engine.runUntilIdle()

        expect(player.hand.find(card => card.defId === 'STRIKE')?.upgradeLevel).toBe(1)
        expect(deck.map(card => card.upgradeLevel)).toEqual([0, 0, 1])
        const nextPlayer = createPlayerFromDeck('next', deck, 80, 80)
        expect(nextPlayer.deck.map(card => card.upgradeLevel)).toEqual([0, 0, 1])
    })

    it('heals Reaper from all enemies, including the final kill, before victory', () => {
        const engine = combat(['REAPER'])
        engine.state.player.hp = 10
        engine.state.enemies[0].hp = 4
        const second = createDummyEnemy('second')
        second.hp = 1
        second.block = 3
        engine.state.enemies.push(second)
        engine.playCard(engine.state.player.hand[0], ['enemy', 'second'])
        const events = engine.runUntilIdle()

        expect(engine.state.victory).toBe(true)
        expect(engine.state.player.hp).toBe(15)
        expect(events.at(-1)?.kind).toBe('Victory')
    })

    it('does not heal Reaper for overkill or blocked damage', () => {
        const engine = combat(['REAPER'])
        engine.state.player.hp = 10
        engine.state.enemies[0].hp = 1
        engine.playCard(engine.state.player.hand[0], ['enemy'])
        engine.runUntilIdle()
        expect(engine.state.player.hp).toBe(11)
    })
})
