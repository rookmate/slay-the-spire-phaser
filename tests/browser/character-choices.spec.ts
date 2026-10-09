import { expect, test, type Page } from '@playwright/test'
import { createCardInstance } from '../../src/core/cards'
import { createCombatEngine } from '../../src/core/combat'
import type { CharacterId } from '../../src/core/characters'
import type { Engine } from '../../src/core/engine'
import { createNewRun } from '../../src/core/run'
import type { CardInstance, CombatState } from '../../src/core/state'
import { boot, clickCard, clickText, inspect, playCardWithKeyboard } from './driver'

// Find a deterministic opening deal before boot. Every action after boot uses UI input.
function fixture(character: CharacterId, deck: CardInstance[], accepts: (engine: Engine) => boolean) {
    for (let index = 0; index < 2000; index++) {
        const run = createNewRun({ character, seed: `choices-${character}-${index}` })
        run.neowCompleted = true; run.deck = deck; run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
        if (accepts(createCombatEngine(structuredClone(run), 'boss'))) return run
    }
    throw new Error(`No opening deal for ${character}`)
}
const cards = (...ids: string[]) => ids.map(id => createCardInstance(id))
const fill = (id: string, count: number) => Array.from({ length: count }, () => createCardInstance(id))
const has = (engine: Engine, ...ids: string[]) => ids.every(id => engine.state.player.hand.some(card => card.defId === id))
async function play(page: Page, id: string, target?: number) {
    const card = (await inspect(page)).state!.player.hand.find(card => card.defId === id)!
    expect(card, `Card ${id} in hand`).toBeDefined()
    await playCardWithKeyboard(page, card.instanceId, target)
}
function uniqueOwnership(state: CombatState) {
    const player = state.player
    const ids = [...player.hand, ...player.drawPile, ...player.discardPile, ...player.exhaustPile, ...state.limbo.map(entry => entry.card)].map(card => card.instanceId)
    expect(new Set(ids).size).toBe(ids.length)
}
async function chooseFromPages(page: Page, id: string) {
    for (let pageIndex = 0; pageIndex < 20; pageIndex++) {
        const ui = await inspect(page)
        if (ui.cards.some(card => card.depth === 7000 && card.enabled && card.id === id)) {
            await clickCard(page, id); return pageIndex
        }
        await clickText(page, 'Next')
    }
    throw new Error(`Card ${id} missing from choice`)
}

test('Silent resolves both Burst/Acrobatics discard choices and the Tactician/Reflex triggers', async ({ page }) => {
    const run = fixture('silent', [...cards('BURST', 'ACROBATICS', 'TACTICIAN', 'REFLEX'), ...fill('DEFEND_SILENT', 12)], engine => has(engine, 'BURST', 'ACROBATICS', 'TACTICIAN', 'REFLEX'))
    const errors = await boot(page, run)
    await play(page, 'BURST'); await play(page, 'ACROBATICS')
    const first = await inspect(page); uniqueOwnership(first.state!)
    await clickCard(page, first.state!.player.hand.find(card => card.defId === 'TACTICIAN')!.instanceId)
    const second = await inspect(page)
    expect(second.choice!.id).not.toBe(first.choice!.id)
    expect(second.state!.player.energy).toBe(2); uniqueOwnership(second.state!)
    await chooseFromPages(page, second.state!.player.hand.find(card => card.defId === 'REFLEX')!.instanceId)
    const after = await inspect(page)
    expect(after.choice).toBeUndefined(); expect(after.state!.discardsThisTurn).toBe(2)
    expect(after.state!.player.hand).toHaveLength(10)
    for (const id of ['BURST', 'ACROBATICS', 'TACTICIAN', 'REFLEX']) expect(after.state!.player.discardPile.filter(card => card.defId === id)).toHaveLength(1)
    uniqueOwnership(after.state!)
    await play(page, 'DEFEND_SILENT'); expect((await inspect(page)).state!.player.block).toBe(5)
    expect(errors).toEqual([])
})

for (const skip of [false, true]) test(`Silent retain ${skip ? 'Skip' : 'Confirm'} resolves the turn and preserves only selected cards`, async ({ page }) => {
    const plans = createCardInstance('WELL_LAID_PLANS', 1)
    const run = fixture('silent', [plans, ...fill('DEFEND_SILENT', 11)], engine => has(engine, 'WELL_LAID_PLANS'))
    const errors = await boot(page, run), initial = await inspect(page)
    await play(page, 'WELL_LAID_PLANS'); await clickText(page, 'End Turn')
    const choice = (await inspect(page)).choice!, retained = skip ? [] : choice.eligibleInstanceIds.slice(0, 2)
    for (const id of retained) await clickCard(page, id)
    await clickText(page, skip ? 'Skip' : 'Confirm')
    const after = await inspect(page)
    expect(after.choice).toBeUndefined(); expect(after.state!.turnNumber).toBe(initial.state!.turnNumber! + 1)
    for (const id of choice.eligibleInstanceIds) expect(after.state!.player.hand.some(card => card.instanceId === id)).toBe(retained.includes(id))
    uniqueOwnership(after.state!)
    await play(page, 'DEFEND_SILENT'); expect(errors).toEqual([])
})

test('Defect Seek+ keeps a selection across pages and moves Void without its draw penalty', async ({ page }) => {
    const seek = createCardInstance('SEEK', 1)
    const run = fixture('defect', [seek, ...cards('VOID'), ...fill('DEFEND_DEFECT', 18)], engine => has(engine, 'SEEK') && engine.state.player.drawPile.findIndex(card => card.defId === 'VOID') >= 6)
    const errors = await boot(page, run), initial = await inspect(page)
    await play(page, 'SEEK')
    const choice = await inspect(page), first = choice.cards.find(card => card.depth === 7000 && card.enabled)!.id
    const voidCard = choice.state!.player.drawPile.find(card => card.defId === 'VOID')!
    await clickCard(page, first)
    expect(await chooseFromPages(page, voidCard.instanceId)).toBeGreaterThan(0)
    await clickText(page, 'Confirm')
    const after = await inspect(page)
    expect(after.choice).toBeUndefined(); expect(after.state!.player.energy).toBe(initial.state!.player.energy)
    expect(after.state!.player.hand).toHaveLength(initial.state!.player.hand.length + 1)
    for (const id of [first, voidCard.instanceId]) expect(after.state!.player.hand.some(card => card.instanceId === id)).toBe(true)
    expect(after.state!.player.exhaustPile.filter(card => card.instanceId === seek.instanceId)).toHaveLength(1)
    uniqueOwnership(after.state!)
    await play(page, 'DEFEND_DEFECT'); expect(errors).toEqual([])
})

test('Defect Amplify repeats Defragment with one energy payment and one card instance', async ({ page }) => {
    const run = fixture('defect', cards('AMPLIFY', 'DEFRAGMENT', 'DEFEND_DEFECT', 'DEFEND_DEFECT', 'DEFEND_DEFECT'), () => true)
    const errors = await boot(page, run)
    await play(page, 'AMPLIFY'); await play(page, 'DEFRAGMENT')
    const after = await inspect(page)
    expect(after.state!.player.powers).toContainEqual(expect.objectContaining({ id: 'FOCUS', stacks: 2 }))
    expect(after.state!.powersPlayed).toBe(2); expect(after.state!.player.energy).toBe(1)
    uniqueOwnership(after.state!)
    await play(page, 'DEFEND_DEFECT'); expect(errors).toEqual([])
})

for (const skip of [false, true]) test(`Watcher Scry ${skip ? 'Skip' : 'Confirm'} returns Weave and draws after the choice`, async ({ page }) => {
    const run = fixture('watcher', [...cards('CUT_THROUGH_FATE', 'WEAVE'), ...fill('DEFEND_WATCHER', 10)], engine => has(engine, 'CUT_THROUGH_FATE') && (skip ? has(engine, 'WEAVE') : engine.state.player.drawPile.slice(0, 2).some(card => card.defId === 'WEAVE')))
    const errors = await boot(page, run)
    if (skip) await play(page, 'WEAVE', 0)
    const before = (await inspect(page)).state!, top = before.player.drawPile.slice(0, 2)
    await play(page, 'CUT_THROUGH_FATE', 0)
    const pending = await inspect(page)
    expect(pending.choice!.cards!.map(card => card.instanceId)).toEqual(top.map(card => card.instanceId))
    expect(pending.state!.player.drawPile).toEqual(before.player.drawPile)
    if (!skip) for (const card of top) await clickCard(page, card.instanceId)
    await clickText(page, skip ? 'Skip' : 'Confirm')
    const after = await inspect(page), drawn = before.player.drawPile[skip ? 0 : 2]
    expect(after.choice).toBeUndefined()
    expect(after.state!.player.hand.some(card => card.defId === 'WEAVE')).toBe(true)
    expect(after.state!.player.hand.some(card => card.instanceId === drawn.instanceId)).toBe(true)
    expect(after.state!.discardsThisTurn).toBe(0)
    if (!skip) for (const card of top.filter(card => card.defId !== 'WEAVE')) expect(after.state!.player.discardPile.some(discard => discard.instanceId === card.instanceId)).toBe(true)
    uniqueOwnership(after.state!)
    await play(page, 'DEFEND_WATCHER'); expect(errors).toEqual([])
})

test('Watcher nested Omniscience resolves each dialog, enters Divinity and exhausts each card once', async ({ page }) => {
    const outer = createCardInstance('OMNISCIENCE', 1), nested = createCardInstance('OMNISCIENCE'), worship = createCardInstance('WORSHIP'), protect = createCardInstance('PROTECT')
    const run = fixture('watcher', [outer, nested, worship, protect, ...fill('DEFEND_WATCHER', 6)], engine => engine.state.player.hand.some(card => card.instanceId === outer.instanceId) && [nested, worship, protect].every(card => engine.state.player.drawPile.some(draw => draw.instanceId === card.instanceId)))
    const errors = await boot(page, run)
    await playCardWithKeyboard(page, outer.instanceId)
    const choiceIds: number[] = []
    for (const card of [nested, worship, protect]) {
        const ui = await inspect(page); uniqueOwnership(ui.state!)
        choiceIds.push(ui.choice!.id)
        await chooseFromPages(page, card.instanceId)
    }
    expect(new Set(choiceIds).size).toBe(3)
    const after = await inspect(page)
    expect(after.choice).toBeUndefined(); expect(after.state!.player.stance).toBe('divinity')
    expect(after.state!.player.block).toBe(24)
    expect(after.state!.player.exhaustPile.map(card => card.instanceId).sort()).toEqual([outer, nested, worship, protect].map(card => card.instanceId).sort())
    uniqueOwnership(after.state!)
    await play(page, 'DEFEND_WATCHER'); expect(errors).toEqual([])
})
