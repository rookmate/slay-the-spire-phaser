import { createNewRun, obtainCurse, removeCardByInstanceId } from './run'
import { applyRelicAcquisition } from './relics'
import { describe, expect, it } from 'vitest'
import { Engine, createDummyEnemy, createPlayerFromDeck } from './engine'
import { CARD_DEFS, canUpgradeCard, createCardInstance, resolveCard } from './cards'
import { cardDescription } from './cardText'
import { powerAmount } from './combatMath'

function combat(ids: string[] = [], upgrade = 0) {
    const player = createPlayerFromDeck('parity', ids.map(id => createCardInstance(id, upgrade)), 80, 80)
    player.hand = player.drawPile.splice(0)
    player.energy = 20
    const enemy = createDummyEnemy('enemy')
    enemy.hp = enemy.maxHp = 300
    enemy.intent = { kind: 'buff', desc: 'Idle' }
    return new Engine('parity', player, [enemy])
}
function play(engine: Engine, id: string) {
    const card = engine.state.player.hand.find(card => card.defId === id)!
    const target = resolveCard(card).targeting?.type
    engine.playCard(card, target === 'single_enemy' || target === 'all_enemies' ? ['enemy'] : [])
    return engine.runUntilIdle()
}
function end(engine: Engine) { engine.enqueue({ kind: 'EndTurn' }); return engine.runUntilIdle() }

describe('original combat rules', () => {
    it('Power cards leave combat without exhausting or redrawing themselves', () => {
        const engine = combat(['DEMON_FORM', 'FEEL_NO_PAIN', 'DARK_EMBRACE'])
        play(engine, 'FEEL_NO_PAIN'); play(engine, 'DARK_EMBRACE'); play(engine, 'DEMON_FORM')
        const player = engine.state.player
        expect([player.hand, player.drawPile, player.discardPile, player.exhaustPile].flat()).toEqual([])
        expect(player.block).toBe(0)
        expect(powerAmount(player, 'DEMON_FORM')).toBe(2)
        end(engine)
        expect(powerAmount(player, 'STRENGTH')).toBe(2)
    })
    it('a resolving draw card cannot draw itself from an otherwise empty deck', () => {
        const engine = combat(['POMMEL_STRIKE'])
        play(engine, 'POMMEL_STRIKE')
        expect(engine.state.player.hand).toEqual([])
        expect(engine.state.player.discardPile.map(card => card.defId)).toEqual(['POMMEL_STRIKE'])
    })
    it('draw stops at ten without reshuffling; generated overflow goes to discard', () => {
        const engine = combat(Array(10).fill('STRIKE'))
        const discarded = createCardInstance('DEFEND')
        engine.state.player.discardPile = [discarded]
        engine.enqueue({ kind: 'DrawCards', count: 15 }); engine.runUntilIdle()
        expect(engine.state.player.hand).toHaveLength(10)
        expect(engine.state.player.discardPile).toEqual([discarded])
        engine.createCardsInDestination('WOUND', 'hand', 2)
        engine.copyCardToHand(engine.state.player.hand[0].instanceId)
        expect(engine.state.player.hand).toHaveLength(10)
        expect(engine.state.player.discardPile.map(card => card.defId)).toEqual(['DEFEND', 'WOUND', 'WOUND', 'STRIKE'])
    })
    it('Battle Trance prevents further draws until next turn', () => {
        const engine = combat(['BATTLE_TRANCE'])
        engine.createCardsInDestination('STRIKE', 'drawPile', 10)
        play(engine, 'BATTLE_TRANCE')
        expect(engine.state.player.hand).toHaveLength(3)
        engine.enqueue({ kind: 'DrawCards', count: 2 }); engine.runUntilIdle()
        expect(engine.state.player.hand).toHaveLength(3)
        end(engine)
        expect(engine.state.player.hand).toHaveLength(5)
    })
    it('Artifact blocks a debuff application, including No Draw and Strength loss', () => {
        const engine = combat(['BATTLE_TRANCE', 'DISARM'])
        engine.state.player.powers.push({ id: 'ARTIFACT', stacks: 1 })
        engine.state.enemies[0].powers.push({ id: 'ARTIFACT', stacks: 1 })
        play(engine, 'BATTLE_TRANCE'); play(engine, 'DISARM')
        expect(powerAmount(engine.state.player, 'NO_DRAW')).toBe(0)
        expect(powerAmount(engine.state.enemies[0], 'STRENGTH')).toBe(0)
        expect(powerAmount(engine.state.player, 'ARTIFACT')).toBe(0)
    })
    it('rounds attack modifiers down once and uses identical preview math', () => {
        const engine = combat(['STRIKE'])
        engine.state.player.powers.push({ id: 'WEAK', stacks: 1 })
        engine.state.enemies[0].powers.push({ id: 'VULNERABLE', stacks: 2 })
        expect(cardDescription(engine.state.player.hand[0], engine, 'enemy')).toContain('6 damage')
        play(engine, 'STRIKE')
        expect(engine.state.enemies[0].hp).toBe(294)
    })
    it('potions ignore attack modifiers and do not trigger retaliation', () => {
        const engine = combat()
        engine.state.player.powers.push({ id: 'WEAK', stacks: 1 }, { id: 'DEXTERITY', stacks: 2 }, { id: 'FRAIL', stacks: 1 })
        engine.state.enemies[0].powers.push({ id: 'VULNERABLE', stacks: 1 }, { id: 'THORNS', stacks: 5 })
        engine.usePotion('FIRE_POTION', ['enemy']); engine.usePotion('BLOCK_POTION', ['player'])
        expect(engine.state.enemies[0].hp).toBe(280)
        expect(engine.state.player.hp).toBe(80)
        expect(engine.state.player.block).toBe(12)
    })
    it('Dexterity and Frail affect card block but not Entrench', () => {
        const engine = combat(['DEFEND', 'ENTRENCH'])
        engine.state.player.powers.push({ id: 'DEXTERITY', stacks: 2 }, { id: 'FRAIL', stacks: 1 })
        play(engine, 'DEFEND'); expect(engine.state.player.block).toBe(5)
        play(engine, 'ENTRENCH'); expect(engine.state.player.block).toBe(10)
    })
    it('Metallicize blocks Burn before enemy attacks', () => {
        const engine = combat(['BURN'])
        engine.state.player.powers.push({ id: 'METALLICIZE', stacks: 3 })
        engine.state.enemies[0].intent = { kind: 'attack', amount: 4 }
        end(engine)
        expect(engine.state.player.hp).toBe(77)
    })
    it('Berserk+ makes the current enemy turn Vulnerable and grants only one Energy', () => {
        const engine = combat(['BERSERK'], 1)
        engine.state.enemies[0].intent = { kind: 'attack', amount: 8 }
        play(engine, 'BERSERK')
        expect(engine.previewEnemyAttack(engine.state.enemies[0])).toBe(12)
        end(engine)
        expect(engine.state.player.hp).toBe(68)
        expect(engine.state.player.energy).toBe(4)
        expect(powerAmount(engine.state.player, 'VULNERABLE')).toBe(0)
    })
    it('enemy-applied Weak lasts through the following player turn', () => {
        const engine = combat(['STRIKE'])
        engine.state.enemies[0].intent = { kind: 'debuff', debuff: 'WEAK', stacks: 1 }
        end(engine)
        expect(powerAmount(engine.state.player, 'WEAK')).toBe(1)
        engine.state.enemies[0].intent = { kind: 'buff', desc: 'Idle' }
        play(engine, 'STRIKE'); end(engine)
        expect(engine.state.enemies[0].hp).toBe(296)
        expect(powerAmount(engine.state.player, 'WEAK')).toBe(0)
    })
    it.each([0, 1])('exhaust powers and Second Wind use per-card values, upgrade %i', upgrade => {
        const engine = combat(['FEEL_NO_PAIN', 'JUGGERNAUT', 'SECOND_WIND', 'WOUND', 'DEFEND'], upgrade)
        play(engine, 'FEEL_NO_PAIN'); play(engine, 'JUGGERNAUT'); play(engine, 'SECOND_WIND')
        expect(engine.state.player.block).toBe(upgrade ? 22 : 16)
        expect(engine.state.enemies[0].hp).toBe(300 - 4 * (upgrade ? 7 : 5))
        expect(engine.state.player.discardPile.map(card => card.defId)).toContain('SECOND_WIND')
    })
    it('Brutality+ is Innate and does not double its HP loss or draw', () => {
        const deck = [...Array.from({ length: 10 }, () => createCardInstance('STRIKE')), createCardInstance('BRUTALITY', 1)]
        const player = createPlayerFromDeck('innate', deck, 80, 80)
        expect(player.drawPile[0].defId).toBe('BRUTALITY')
        const engine = combat(['BRUTALITY'], 1)
        engine.createCardsInDestination('STRIKE', 'drawPile', 10)
        play(engine, 'BRUTALITY'); end(engine)
        expect(engine.state.player.hp).toBe(79)
        expect(engine.state.player.hand).toHaveLength(6)
    })
    it('statuses and curses cannot be upgraded at campfires', () => {
        expect(canUpgradeCard(createCardInstance('WOUND'))).toBe(false)
        expect(canUpgradeCard(createCardInstance('INJURY'))).toBe(false)
        expect(canUpgradeCard(createCardInstance('SEARING_BLOW', 5))).toBe(true)
    })
    it('every card has readable rules at both upgrade levels', () => {
        for (const id of Object.keys(CARD_DEFS)) {
            for (const upgrade of [0, 1]) expect(cardDescription(createCardInstance(id, upgrade)), id).not.toBe('')
        }
    })
})

describe('review regressions', () => {
    it('Feed grants max HP again when the same card is replayed through Exhume', () => {
        const engine = combat(['FEED', 'EXHUME'])
        engine.state.enemies[0].hp = 10
        engine.state.enemies.push({ ...createDummyEnemy('second'), hp: 10 })
        play(engine, 'FEED')
        expect(engine.state.player.maxHp).toBe(83)
        play(engine, 'EXHUME')
        engine.submitPendingChoice([engine.state.player.exhaustPile.find(card => card.defId === 'FEED')!.instanceId])
        engine.runUntilIdle()
        engine.playCard(engine.state.player.hand.find(card => card.defId === 'FEED')!, ['second'])
        engine.runUntilIdle()
        expect(engine.state.player.maxHp).toBe(86)
    })
    it('Parasite costs max HP only on successful removal, and Omamori prevents acquisition', () => {
        const run = createNewRun({ seed: 'parasite' })
        const parasite = obtainCurse(run, 'PARASITE')
        expect(run.player).toEqual({ hp: 80, maxHp: 80 })
        removeCardByInstanceId(run, parasite.instanceId)
        expect(run.player).toEqual({ hp: 77, maxHp: 77 })
        removeCardByInstanceId(run, parasite.instanceId)
        expect(run.player.maxHp).toBe(77)
        applyRelicAcquisition(run, 'OMAMORI')
        const prevented = obtainCurse(run, 'PARASITE')
        expect(run.deck.some(card => card.instanceId === prevented.instanceId)).toBe(false)
        expect(run.player.maxHp).toBe(77)
    })
    it('Retain preserves cards while Ethereal still exhausts them', () => {
        const original = CARD_DEFS.DEFEND.retain
        CARD_DEFS.DEFEND.retain = true
        try {
            const engine = combat(['DEFEND', 'DAZED'])
            engine.createCardsInDestination('STRIKE', 'drawPile', 8)
            end(engine)
            expect(engine.state.player.hand.filter(card => card.defId === 'DEFEND')).toHaveLength(1)
            expect(engine.state.player.hand).toHaveLength(6)
            expect(engine.state.player.exhaustPile.map(card => card.defId)).toEqual(['DAZED'])
        } finally { CARD_DEFS.DEFEND.retain = original }
    })
})
