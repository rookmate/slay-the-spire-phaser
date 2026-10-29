import { expect, it } from 'vitest'
import { Engine, createDummyEnemy, createPlayerFromDeck } from './engine'
import { powerAmount } from './combatMath'
import { createCardInstance } from './cards'
import { createDefaultMeta } from './meta'
import { createProfileRun } from './modes/setup'
import { applyRelicAcquisition } from './relics'
import { chooseAcquisition } from './relics/acquisitions'

it('Astrolabe upgrades every Hoarder copy before acquisition, including across reloads', () => {
    const meta = createDefaultMeta()
    let run = createProfileRun(meta, { seed: 'astrolabe-hoarder', mode: 'custom', modifiers: ['HOARDER'] })
    run.deck = ['STRIKE', 'DEFEND', 'BASH'].map(id => createCardInstance(id))
    const originals = run.deck.map(card => card.instanceId)
    applyRelicAcquisition(run, 'ASTROLABE')
    for (const id of originals) {
        run = JSON.parse(JSON.stringify(run))
        expect(chooseAcquisition(run, meta, id)).toBe(true)
    }
    expect(run.pendingAcquisitions).toEqual([])
    expect(run.deck).toHaveLength(9)
    expect(run.deck.map(card => card.upgradeLevel)).toEqual(Array(9).fill(1))
})

function combat(ids: string[]) {
    const run = createProfileRun(createDefaultMeta(), { seed: 'block-trigger-replay', mode: 'custom', modifiers: ['DIVERSE'] })
    run.deck = ids.map(id => createCardInstance(id)); run.relics = []
    const player = createPlayerFromDeck(run.seed, run.deck, 80, 80)
    player.hand = player.drawPile.splice(0)
    return new Engine(run.seed, player, [createDummyEnemy('enemy')], { run })
}
function play(engine: Engine, id: string) {
    const action = engine.getPlayableCards().find(action => action.card.defId === id)!
    expect(action, id).toBeDefined()
    engine.playCard(action.card, action.targets); engine.runUntilIdle()
}

it('Body Slam reads Block after After Image and Rage resolve', () => {
    const engine = combat(['AFTER_IMAGE', 'RAGE', 'BODY_SLAM'])
    play(engine, 'AFTER_IMAGE'); play(engine, 'RAGE')
    expect(engine.state.player.block).toBe(1)
    play(engine, 'BODY_SLAM')
    expect(engine.state.player.block).toBe(5)
    expect(engine.state.enemies[0].hp).toBe(35)
})

it('Entrench doubles the Block granted by its own After Image trigger', () => {
    const engine = combat(['AFTER_IMAGE', 'ENTRENCH'])
    play(engine, 'AFTER_IMAGE'); play(engine, 'ENTRENCH')
    expect(powerAmount(engine.state.player, 'AFTER_IMAGE')).toBe(1)
    expect(engine.state.player.block).toBe(2)
})

it('keeps Wreath of Flame through deferred Body Slam damage and consumes it before the next Attack', () => {
    const engine = combat(['WREATH_OF_FLAME', 'BODY_SLAM', 'STRIKE'])
    engine.state.player.block = 2
    play(engine, 'WREATH_OF_FLAME'); play(engine, 'BODY_SLAM')
    expect(engine.state.enemies[0].hp).toBe(33)
    expect(powerAmount(engine.state.player, 'WREATH_OF_FLAME')).toBe(0)
    play(engine, 'STRIKE')
    expect(engine.state.enemies[0].hp).toBe(27)
})
