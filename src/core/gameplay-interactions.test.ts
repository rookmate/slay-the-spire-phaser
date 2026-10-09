import { describe, expect, it } from 'vitest'
import { CARD_DEFS } from './cards'
import { CHARACTER_IDS } from './characters'
import { createDefaultMeta } from './meta'
import { chooseStartingCard, createProfileRun } from './modes/setup'
import { createNewRun } from './run'
import { eventSeed, initializeEvent, resolveEventChoice } from './events'
import { changeMaxHp, loseRunHp } from './health'
import { getRunDestination } from './progression'

for (const character of CHARACTER_IDS) describe(`${character} All Star starting decks`, () => {
    it.each(['DRAFT', 'SEALED_DECK'] as const)('keeps all five extra cards through every %s reload and final pick', modifier => {
        let run = createProfileRun(createDefaultMeta(), { character, mode: 'custom', seed: 'all-star-reloads', modifiers: [modifier, 'ALL_STAR'] })
        const extras = structuredClone(run.deck), picks = modifier === 'DRAFT' ? 15 : 10
        expect(extras).toHaveLength(5)
        expect(extras.every(card => CARD_DEFS[card.defId].color === 'colorless')).toBe(true)
        for (let i = 0; i < picks; i++) {
            run = JSON.parse(JSON.stringify(run))
            expect(run.deck.slice(0, 5)).toEqual(extras)
            expect(chooseStartingCard(run, run.startingDraft!.choices[0].instanceId)).toBe(true)
        }
        expect(run.startingDraft).toBeUndefined(); expect(run.deck).toHaveLength(picks + 5)
        expect(run.deck.filter(card => CARD_DEFS[card.defId].color === 'colorless')).toEqual(extras)
        expect(chooseStartingCard(run, extras[0].instanceId)).toBe(false)
        expect(run.deck).toHaveLength(picks + 5); expect(getRunDestination(run).scene).toBe('Map')
    })
})

function event(id: 'KNOWING_SKULL' | 'CURSED_TOME' | 'WORLD_OF_GOOP', rod = true) {
    let run = createNewRun({ seed: 'rod-payments' })
    run.neowCompleted = true; run.act = 2; run.pendingRoom = { scene: 'Event' }
    if (rod) run.relics.push('TUNGSTEN_ROD')
    const meta = createDefaultMeta(); initializeEvent(run, meta, id)
    return {
        get run() { return run },
        reload() { run = JSON.parse(JSON.stringify(run)) },
        choose(choice: string) { return resolveEventChoice(run, meta, id, choice, eventSeed(run)) },
    }
}

describe('Tungsten Rod outside combat', () => {
    it('reduces each Knowing Skull payment while escalating its original price after reload', () => {
        const game = event('KNOWING_SKULL'), original = game.run.player.hp
        expect(game.choose('SKULL_GOLD').notes).toContain('Lost 5 HP.')
        expect(game.run.player.hp).toBe(original - 5)
        game.reload()
        expect(game.choose('SKULL_GOLD').notes).toContain('Lost 6 HP.')
        expect(game.run.player.hp).toBe(original - 11)
        expect(game.choose('SKULL_LEAVE').notes).toContain('Lost 5 HP.')
        expect(game.run.player.hp).toBe(original - 16)
    })
    it('reduces payments in both event resolvers and leaves unreduced costs alone', () => {
        for (const rod of [false, true]) {
            const skull = event('KNOWING_SKULL', rod), goop = event('WORLD_OF_GOOP', rod)
            skull.choose('SKULL_GOLD'); goop.choose('WORLD_OF_GOOP_REACH')
            expect(skull.run.player.hp).toBe(80 - 6 + Number(rod))
            expect(goop.run.player.hp).toBe(80 - 11 + Number(rod))
        }
    })
    it('can prevent a one-HP payment entirely, but never reduces max-HP loss', () => {
        const tome = event('CURSED_TOME')
        expect(tome.choose('TOME_READ').notes).toContain('Lost 0 HP.')
        expect(tome.run.player.hp).toBe(80)
        tome.reload(); expect(tome.choose('TOME_READ').notes).toContain('Lost 1 HP.')
        changeMaxHp(tome.run, -10)
        expect(tome.run.player).toEqual({ hp: 70, maxHp: 70 })
        expect(loseRunHp(tome.run, 0)).toBe(0)
    })
    it('keeps one HP at the reduced boundary and still ends lethal events', () => {
        const survives = event('KNOWING_SKULL'); survives.run.player.hp = 6
        expect(survives.choose('SKULL_LEAVE').nextScene).not.toBe('RunSummary')
        expect(survives.run.player.hp).toBe(1)
        const dies = event('KNOWING_SKULL'); dies.run.player.hp = 5
        expect(dies.choose('SKULL_LEAVE').nextScene).toBe('RunSummary')
        expect(dies.run.player.hp).toBe(0)
        expect(getRunDestination(dies.run)).toMatchObject({ scene: 'RunSummary', data: { result: 'defeat' } })
    })
})
