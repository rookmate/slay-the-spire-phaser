import { describe, expect, it } from 'vitest'
import { createDefaultMeta } from './meta'
import { createNewRun, obtainCard } from './run'
import { createCardInstance } from './cards'
import { EVENT_DEFS, eventSeed, getEventChoices, initializeEvent, resolveEventChoice } from './events'
import { flipEventCard } from './events/additionalResolution'
import { createCombatEngine } from './combat'
import { finishRewards } from './campaign'
import { getRunDestination } from './progression'
import { createEnemyState } from './enemies'

function fixture(id: keyof typeof EVENT_DEFS, ascension = 0) {
    const run = createNewRun({ seed: `event-${id}`, ascension }), meta = createDefaultMeta()
    run.act = 2; run.floor = 25; run.neowCompleted = true; run.pendingRoom = { scene: 'Event' }; run.gold = 500
    initializeEvent(run, meta, id)
    const choose = (choice: string, cardInstanceId?: string) => resolveEventChoice(run, meta, id, choice, eventSeed(run), { cardInstanceId })
    return { run, meta, choose }
}

describe('complete event catalog', () => {
    it('contains all 51 random events with valid choices at initialization', () => {
        expect(Object.keys(EVENT_DEFS)).toHaveLength(51)
        for (const id of Object.keys(EVENT_DEFS) as (keyof typeof EVENT_DEFS)[]) {
            const { run } = fixture(id)
            expect(run.eventState?.id).toBe(id)
            expect(id === 'MATCH_AND_KEEP' || getEventChoices(run).length > 0).toBe(true)
        }
    })
    it('keeps Match and Keep choices and remaining attempts across reloads', () => {
        const { run } = fixture('MATCH_AND_KEEP')
        const board = run.eventState!.matching!
        const a = 0, b = board.cards.findIndex((id, i) => i !== a && id === board.cards[a])
        const length = run.deck.length
        expect(flipEventCard(run, a)).toBe(true)
        const resumed = JSON.parse(JSON.stringify(run))
        expect(flipEventCard(resumed, b)).toBe(true)
        expect(resumed.deck).toHaveLength(length + 1)
        expect(resumed.eventState.matching.attempts).toBe(4)
        expect(flipEventCard(resumed, b)).toBe(false)
    })
    it('requires all five Match and Keep attempts and awards matching curses', () => {
        const { run } = fixture('MATCH_AND_KEEP')
        run.eventState!.matching = { cards: ['REGRET', 'REGRET', 'STRIKE', 'DEFEND'], matched: [], revealed: [], attempts: 2 }
        flipEventCard(run, 0); flipEventCard(run, 1)
        expect(run.deck.some(c => c.defId === 'REGRET')).toBe(true)
        flipEventCard(run, 2); flipEventCard(run, 3)
        expect(run.eventState!.resolved).toBe(true)
    })
    it('saves the exact Note for Yourself card and refuses a repeated trade', () => {
        const { run, meta, choose } = fixture('NOTE_FOR_YOURSELF')
        const given = obtainCard(run, 'RITUAL_DAGGER', 'deck', 1); given.permanentDamage = 12
        choose('NOTE_TRADE', given.instanceId)
        expect(meta.noteCard).toMatchObject({ defId: 'RITUAL_DAGGER', upgradeLevel: 1, permanentDamage: 12 })
        expect(run.deck.some(c => c.defId === 'IRON_WAVE')).toBe(true)
        const length = run.deck.length; choose('NOTE_TRADE', run.deck[0].instanceId); expect(run.deck).toHaveLength(length)
        const next = createNewRun(); initializeEvent(next, meta, 'NOTE_FOR_YOURSELF')
        expect(next.eventState!.noteCard).toMatchObject(meta.noteCard!)
    })
    it('resumes a second card transformation without charging twice', () => {
        const { run, choose } = fixture('DESIGNER')
        run.eventState!.counts = { twoTransforms: 1 }
        const [a, b] = run.deck
        choose('DESIGN_TRANSFORM', a.instanceId)
        expect(run.gold).toBe(440); expect(run.eventState!.resolved).toBe(false)
        const resumed = JSON.parse(JSON.stringify(run))
        resolveEventChoice(resumed, createDefaultMeta(), 'DESIGNER', 'DESIGN_TRANSFORM', eventSeed(resumed), { cardInstanceId: b.instanceId })
        expect(resumed.gold).toBe(440); expect(resumed.eventState.resolved).toBe(true)
        expect(resumed.deck.some((c: { instanceId: string }) => c.instanceId === a.instanceId || c.instanceId === b.instanceId)).toBe(false)
    })
    it('takes Cursed Tome payments in order and resolves once', () => {
        const { run, choose } = fixture('CURSED_TOME', 15), hp = run.player.hp
        choose('TOME_READ'); choose('TOME_READ'); choose('TOME_READ')
        expect(run.player.hp).toBe(hp - 6)
        choose('TOME_TAKE'); const relics = [...run.relics]
        expect(run.player.hp).toBe(hp - 21); expect(run.relics).toHaveLength(2)
        choose('TOME_TAKE'); expect(run.relics).toEqual(relics); expect(run.player.hp).toBe(hp - 21)
    })
    it('scales Ghosts at Ascension 15 and preserves bottled Strikes for Vampires', () => {
        const { run, choose } = fixture('COUNCIL_OF_GHOSTS', 15)
        choose('GHOST_ACCEPT'); expect(run.player.maxHp).toBe(38); expect(run.deck.filter(c => c.defId === 'APPARITION')).toHaveLength(3)
        const vampires = fixture('VAMPIRES'); const strike = vampires.run.deck.find(c => c.defId === 'STRIKE')!; strike.bottled = 'BOTTLED_FLAME'
        vampires.choose('VAMPIRE_ACCEPT')
        expect(vampires.run.deck.filter(c => c.defId === 'STRIKE')).toEqual([strike])
        expect(vampires.run.deck.filter(c => c.defId === 'BITE')).toHaveLength(5)
    })
    it('returns from a Skull potion reward without ending the event or increasing the floor', () => {
        const { run, choose } = fixture('KNOWING_SKULL')
        choose('SKULL_POTION'); expect(run.pendingRoom?.scene).toBe('Rewards')
        const resumed = JSON.parse(JSON.stringify(run))
        expect(finishRewards(resumed)).toBe('Event'); expect(resumed.floor).toBe(25)
        expect(resumed.eventState.resolved).toBe(false); expect(getRunDestination(resumed).scene).toBe('Event')
        expect(getEventChoices(resumed).find(c => c.id === 'SKULL_POTION')!.description).toContain('7 HP')
    })
    it('starts the Colosseum with no rewards and a resumable second fight', () => {
        const { run, choose } = fixture('COLOSSEUM')
        choose('COLOSSEUM_FIRST')
        expect(run.eventCombat).toMatchObject({ enemies: ['RED_SLAVER', 'BLUE_SLAVER'], resumeEvent: true, rewards: { items: [] } })
        expect(run.eventState!.resolved).toBe(false)
        expect(getEventChoices(run).map(c => c.id)).toEqual(['COLOSSEUM_SECOND', 'LEAVE'])
        run.eventCombat = undefined; choose('COLOSSEUM_SECOND')
        expect(run.eventCombat).toMatchObject({ enemies: ['GREMLIN_NOB', 'TASKMASTER'] })
        expect(run.eventCombat!.rewards.items.filter(i => i.kind === 'relic')).toHaveLength(2)
    })
    it('uses unique bandit enemy behavior and starts event Lagavulin awake with Siphon Soul', () => {
        const { run, choose } = fixture('MASKED_BANDITS'); choose('BANDITS_FIGHT')
        const engine = createCombatEngine(run, 'monster')
        expect(engine.state.enemies.map(e => e.specId)).toEqual(['POINTY', 'ROMEO', 'BEAR'])
        expect(engine.state.enemies[2].intent).toMatchObject({ kind: 'buff', desc: 'Bear Hug' })
        run.eventCombat = { enemies: ['LAGAVULIN'], awakeLagavulin: true, rewards: { tier: 'elite', items: [] } }
        expect(createCombatEngine(run, 'elite').state.enemies[0].intent).toMatchObject({ kind: 'buff', desc: 'Siphon Soul' })
        expect(createEnemyState('POINTY', 'p', 7).maxHp).toBe(34)
    })
    it('removes only removable curses at the fountain and gives the correct bonfire reward', () => {
        const fountain = fixture('DIVINE_FOUNTAIN'); fountain.run.deck.push(createCardInstance('ASCENDERS_BANE'), createCardInstance('REGRET'))
        fountain.choose('FOUNTAIN_DRINK'); expect(fountain.run.deck.some(c => c.defId === 'REGRET')).toBe(false); expect(fountain.run.deck.some(c => c.defId === 'ASCENDERS_BANE')).toBe(true)
        const fire = fixture('BONFIRE_SPIRITS'); fire.run.player.hp = 20
        const card = obtainCard(fire.run, 'IMMOLATE'); fire.choose('BONFIRE_OFFER', card.instanceId)
        expect(fire.run.player).toEqual({ hp: 90, maxHp: 90 }); expect(fire.run.deck.some(c => c.instanceId === card.instanceId)).toBe(false)
    })
    it('can give Nloth a bottle without leaving an invisible bottled card', () => {
        const { run, choose } = fixture('NLOTH'); run.relics.push('BOTTLED_FLAME'); run.deck[0].bottled = 'BOTTLED_FLAME'; run.eventState!.relics = ['BOTTLED_FLAME', 'BURNING_BLOOD']
        choose('NLOTH_BOTTLED_FLAME'); expect(run.deck[0].bottled).toBeUndefined(); expect(run.relics).toContain('NLOTHS_GIFT')
    })
})
