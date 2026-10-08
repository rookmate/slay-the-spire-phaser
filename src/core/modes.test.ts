import { describe, expect, it } from 'vitest'
import { createDefaultMeta } from './meta'
import { createProfileRun, chooseStartingCard, dailyConfiguration } from './modes/setup'
import { hasModifier, toggleModifier } from './modes/modifiers'
import { beginEndlessLoop, takeBlight } from './modes/endless'
import { createNewRun, obtainCard } from './run'
import { createCombatEngine } from './combat'
import { changeMaxHp, healRun } from './health'
import { getRunMap } from './map'
import { finishBossCombat, advanceAct, finishRewards } from './campaign'
import { generateRewardBundle } from './rewards'
import { canUseCampfire } from './campfire'
import { Engine, createDummyEnemy, createPlayerFromDeck } from './engine'
import { CARD_DEFS, createCardInstance } from './cards'
import { getRunDestination } from './progression'
import { selectCombatCardPool } from './contentPools'

describe('run modifiers and endless checkpoints', () => {
    it('uses a stable daily setup for a UTC date and does not carry modifiers into standard runs', () => {
        expect(dailyConfiguration(new Date('2026-10-08T00:01Z'))).toEqual(dailyConfiguration(new Date('2026-10-08T23:59Z')))
        expect(dailyConfiguration(new Date('2026-10-09T00:01Z')).seed).not.toBe(dailyConfiguration(new Date('2026-10-08T23:59Z')).seed)
        const run = createProfileRun(createDefaultMeta(), { modifiers: ['ONE_HIT_WONDER'] })
        expect(run.modifiers).toEqual([]); expect(run.player.maxHp).toBe(80)
    })
    it('resumes all 15 draft picks and keeps sealed choices stable', () => {
        let run = createProfileRun(createDefaultMeta(), { mode: 'custom', seed: 'draft', modifiers: ['DRAFT'] })
        expect(run.deck).toHaveLength(0); expect(getRunDestination(run).scene).toBe('StartingDeck')
        for (let i = 0; i < 15; i++) {
            const id = run.startingDraft!.choices[0].instanceId
            run = JSON.parse(JSON.stringify(run))
            expect(chooseStartingCard(run, id)).toBe(true)
        }
        expect(run.deck).toHaveLength(15); expect(run.startingDraft).toBeUndefined()
        run = createProfileRun(createDefaultMeta(), { mode: 'custom', modifiers: ['SEALED_DECK'] })
        const ids = run.startingDraft!.choices.map(c => c.instanceId)
        chooseStartingCard(run, ids[3]); expect(run.startingDraft!.choices.map(c => c.instanceId)).toEqual(ids.filter(id => id !== ids[3]))
    })
    it('copies Hoarder acquisitions before egg upgrades and respects Omamori charges', () => {
        const run = createNewRun(); run.modifiers = ['HOARDER']; run.relics.push('MOLTEN_EGG', 'OMAMORI'); run.relicState = { OMAMORI: { charges: 2 } }
        obtainCard(run, 'SEARING_BLOW'); expect(run.deck.filter(c => c.defId === 'SEARING_BLOW').map(c => c.upgradeLevel)).toEqual([1, 1, 1])
        obtainCard(run, 'REGRET'); expect(run.deck.filter(c => c.defId === 'REGRET')).toHaveLength(1)
    })
    it('generates one path and hides keys before they unlock', () => {
        const run = createProfileRun(createDefaultMeta(), { mode: 'custom', seed: 'single', modifiers: ['CERTAIN_FUTURE'] })
        const map = getRunMap(run)
        expect(map.nodes).toHaveLength(16); expect(map.startIds).toHaveLength(1)
        expect(map.nodes.some(n => n.burning)).toBe(false)
        expect(canUseCampfire(run, 'recall')).toBe(false)
    })
    it('applies custom combat effects and makes former card unlocks available to generation', () => {
        const run = createProfileRun(createDefaultMeta(), { mode: 'custom', modifiers: ['LETHALITY', 'TERMINAL', 'BLUE_CARDS'] })
        const engine = createCombatEngine(run, 'monster')
        expect(engine.state.player.powers).toContainEqual(expect.objectContaining({ id: 'STRENGTH', stacks: 3 }))
        expect(engine.state.player.orbSlots).toBe(1)
        expect(selectCombatCardPool(engine, { source: 'generated' })).toContain('BALL_LIGHTNING')
        expect(selectCombatCardPool(engine, { source: 'any_generated' })).toContain('ECHO_FORM')
    })
    it('replaces Vintage card rewards, triples Midas gold, and disables smithing', () => {
        const meta = createDefaultMeta(), run = createNewRun({ seed: 'reward-modes' }), control = structuredClone(run)
        run.modifiers = ['VINTAGE', 'MIDAS']
        const normal = generateRewardBundle('same', 'hallway', control, meta)
        const modified = generateRewardBundle('same', 'hallway', run, meta)
        expect(modified.items.some(i => i.kind === 'cards')).toBe(false)
        expect(modified.items.some(i => i.kind === 'relic')).toBe(true)
        expect(modified.items.find(i => i.kind === 'gold')?.amount).toBe(normal.items.find(i => i.kind === 'gold')!.amount * 3)
        expect(canUseCampfire(run, 'smith')).toBe(false)
    })
    it('saves an endless boss reward and starts a new map after the choice', () => {
        const run = createNewRun({ seed: 'loops' }), meta = createDefaultMeta()
        run.modifiers = ['ENDLESS', 'BLIGHT_CHESTS']; run.act = 3; run.neowCompleted = true
        expect(finishBossCombat(run, meta)).toBe('Rewards')
        expect(finishRewards(run)).toBe('BossRelic')
        advanceAct(run); expect(run.act).toBe(1); expect(run.endlessLoop).toBe(1)
        const map = getRunMap(run); expect(map.nodes.some(n => n.kind === 'chest')).toBe(false)
        run.act = 1; finishBossCombat(run, meta); expect(finishRewards(run)).toBe('BlightChest')
        const resumed = JSON.parse(JSON.stringify(run))
        expect(getRunDestination(resumed).scene).toBe('BlightChest')
        expect(takeBlight(resumed, resumed.pendingBlights[0])).toBe(true)
        expect(Object.values(resumed.blights)).toEqual([1])
    })
    it('scales endless enemies and limits healing and max HP after Muzzle', () => {
        const run = createNewRun({ seed: 'endless-hp' }), control = createCombatEngine(structuredClone(run), 'monster')
        beginEndlessLoop(run)
        const modified = createCombatEngine(run, 'monster')
        expect(modified.state.enemies[0].maxHp).toBe(Math.round(control.state.enemies[0].maxHp * 1.5))
        run.endlessLoop = 3; run.player.hp = 20
        expect(healRun(run, 10)).toBe(5)
        changeMaxHp(run, 10); expect(run.player.maxHp).toBe(80)
        changeMaxHp(run, -10); expect(run.player.maxHp).toBe(70)
    })
    it('blocks further cards at 15 in Time Maze but still permits potions and Curses', () => {
        const run = createNewRun(); run.endlessLoop = 2
        const deck = Array.from({ length: 20 }, () => createCardInstance('ANGER'))
        const player = createPlayerFromDeck('maze', deck, 80, 80); player.hand = deck.slice(0, 10); player.drawPile = deck.slice(10)
        const enemy = createDummyEnemy('enemy'); enemy.hp = enemy.maxHp = 9999; enemy.intent = { kind: 'buff', desc: 'Wait' }
        const engine = new Engine('maze', player, [enemy], { run })
        for (let i = 0; i < 15; i++) { if (!player.hand.length) { engine.enqueue({ kind: 'DrawCards', count: 10 }); engine.runUntilIdle() } engine.playCard(player.hand[0], ['enemy']); engine.runUntilIdle() }
        expect(engine.state.turnNumber).toBe(1); expect(engine.state.cardsPlayed).toBe(15)
        const hp = enemy.hp; engine.playCard(player.hand[0], ['enemy']); engine.runUntilIdle(); expect(enemy.hp).toBe(hp)
        expect(engine.canUsePotion('FIRE_POTION', ['enemy'])).toBe(true)
        run.relics.push('BLUE_CANDLE'); const curse = createCardInstance('REGRET'); player.hand.push(curse)
        engine.playCard(curse, []); engine.runUntilIdle(); expect(player.hand).not.toContain(curse)
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle(); expect(engine.state.turnNumber).toBe(2)
    })
    it('keeps Insanity free of rare cards and resolves Daily Mods deterministically', () => {
        const run = createProfileRun(createDefaultMeta(), { mode: 'custom', seed: 'insanity', modifiers: ['INSANITY'] })
        expect(run.deck).toHaveLength(50); expect(run.deck.every(c => CARD_DEFS[c.defId].rarity !== 'rare')).toBe(true)
        const options = { mode: 'custom' as const, seed: 'mods', modifiers: ['DAILY_MODS', 'ENDLESS', 'ONE_HIT_WONDER'] as const }
        const a = createProfileRun(createDefaultMeta(), { ...options, modifiers: [...options.modifiers] }), b = createProfileRun(createDefaultMeta(), { ...options, modifiers: [...options.modifiers] })
        expect(a.modifiers).toEqual(b.modifiers); expect(a.modifiers).toHaveLength(4); expect(a.modifiers).toContain('ENDLESS'); expect(a.player.maxHp).toBeGreaterThan(1)
    })
    it('rejects incompatible custom selections', () => {
        expect(toggleModifier(['DRAFT'], 'SEALED_DECK')).toEqual(['SEALED_DECK'])
        expect(hasModifier({ modifiers: toggleModifier(['ENDLESS'], 'THE_ENDING') }, 'ENDLESS')).toBe(false)
    })
})
