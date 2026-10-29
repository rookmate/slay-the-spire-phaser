import { describe, expect, it } from 'vitest'
import { simulateInteractions, finishStartingChoices } from '../../tests/support/interactions'
import { CARD_DEFS, canRemoveCard, canUpgradeCard, createCardInstance } from './cards'
import { CHARACTER_IDS } from './characters'
import { EVENT_DEFS, eventSeed, getEventChoices, initializeEvent, resolveEventChoice, type EventId } from './events'
import { flipEventCard } from './events/additionalResolution'
import { createDefaultMeta } from './meta'
import { createProfileRun } from './modes/setup'
import type { ModifierId } from './modes/modifiers'
import { RNG } from './rng'
import { calculateScore } from './score'
import type { RunState } from './run'
import { finishRewards } from './campaign'

function assertRun(run: RunState) {
    expect(new Set(run.deck.map(card => card.instanceId)).size).toBe(run.deck.length)
    expect(run.deck.every(card => !!CARD_DEFS[card.defId] && Number.isInteger(card.upgradeLevel))).toBe(true)
    expect(run.player.hp).toBeGreaterThanOrEqual(0); expect(run.player.hp).toBeLessThanOrEqual(run.player.maxHp)
    expect(run.gold).toBeGreaterThanOrEqual(0)
    for (const victory of [false, true]) {
        const before = JSON.stringify(run), score = calculateScore(run, victory)
        expect(Number.isFinite(score.total)).toBe(true)
        expect(score.total).toBe(Math.max(0, score.lines.reduce((sum, line) => sum + line.points, 0)))
        expect(calculateScore(JSON.parse(before), victory)).toEqual(score)
        expect(JSON.stringify(run)).toBe(before)
    }
}

const combatCases = Number(process.env.INTERACTION_SEEDS ?? 96)
if (!Number.isInteger(combatCases) || combatCases < 1 || combatCases > 10000) throw new Error('INTERACTION_SEEDS must be an integer from 1 to 10000')

describe('seeded interaction campaign', () => {
    it.each(Array.from({ length: combatCases }, (_, index) => index))('replays mixed combat fixture %i within 100 actions / 10 turns', index => {
        const seed = `interactions-v1-${index}`
        expect(simulateInteractions(seed, index)).toEqual(simulateInteractions(seed, index))
    })

    it.each(Object.keys(EVENT_DEFS) as EventId[])('walks bounded %s branches with checkpoint recovery', id => {
        for (let variant = 0; variant < 8; variant++) {
            const seed = `events-v1-${id}-${variant}`, rng = new RNG(seed), meta = createDefaultMeta()
            let run = createProfileRun(meta, { seed, character: CHARACTER_IDS[variant % 4], mode: 'custom', ascension: variant % 2 ? 20 : 0, modifiers: variant < 4 ? ['HOARDER'] : ['DIVERSE'] })
            run.act = id === 'SECRET_PORTAL' ? 3 : 2; run.floor = 25; run.gold = 500
            run.deck.push(...['REGRET', 'IMMOLATE', 'FOOTWORK'].map(id => createCardInstance(id)))
            run.relics.push(...(variant % 2 ? ['TUNGSTEN_ROD', 'OMAMORI', 'DARKSTONE_PERIAPT'] as const : ['BLOODY_IDOL', 'BLOOD_VIAL', 'GOLDEN_IDOL'] as const))
            run.pendingRoom = { scene: 'Event' }; initializeEvent(run, meta, id)
            const trace: string[] = []
            try {
                for (let step = 0; step < 12 && !run.eventState!.resolved && run.player.hp > 0; step++) {
                    run = JSON.parse(JSON.stringify(run))
                    if (run.eventState!.matching) {
                        const board = run.eventState!.matching
                        const available = board.cards.map((_, i) => i).filter(i => !board.matched.includes(i) && (board.revealed.length === 2 || !board.revealed.includes(i)))
                        const index = available[rng.int(0, available.length - 1)]
                        trace.push(`flip ${index}`); expect(flipEventCard(run, index)).toBe(true)
                    } else {
                        const offered = getEventChoices(run)
                        for (const disabled of offered.filter(choice => choice.disabled?.(run))) {
                            const before = JSON.stringify(run)
                            resolveEventChoice(run, meta, id, disabled.id, eventSeed(run))
                            expect(JSON.stringify(run)).toBe(before)
                        }
                        const choices = offered.filter(choice => !choice.disabled?.(run))
                        expect(choices.length).toBeGreaterThan(0)
                        // The first variant follows costly multi-step branches instead of leaving early.
                        const choice = variant === 0 ? choices[0] : choices[(variant + step) % choices.length]
                        const cards = run.deck.filter(card => choice.requiresSelection === 'upgrade' ? canUpgradeCard(card)
                            : canRemoveCard(card) && (choice.requiresSelection !== 'transform' || !run.eventState!.transformEligibleIds || run.eventState!.transformEligibleIds.includes(card.instanceId)))
                        trace.push(choice.id)
                        const result = resolveEventChoice(run, meta, id, choice.id, eventSeed(run), { cardInstanceId: cards[0]?.instanceId, cardId: run.eventState!.cards?.[0] })
                        expect(result.notes).not.toContain('Choose an eligible card.')
                        if (result.nextScene === 'Combat' || result.nextScene === 'RunSummary') break
                        if (result.nextScene === 'Rewards' && !run.eventState!.resolved) finishRewards(run)
                    }
                    assertRun(run)
                }
                assertRun(run)
                if (run.eventState?.resolved) {
                    const before = JSON.stringify(run)
                    resolveEventChoice(run, meta, id, trace.at(-1)!, eventSeed(run))
                    expect(JSON.stringify(run)).toBe(before)
                }
            } catch (error) { throw new Error(`seed=${seed}\n${trace.join('\n')}\n${String(error)}`) }
        }
    })

    const combinations: ModifierId[][] = [
        ['DRAFT', 'ALL_STAR', 'HOARDER', 'DIVERSE'], ['SEALED_DECK', 'SPECIALIZED', 'HOARDER', 'COLORLESS_CARDS'],
        ['SHINY', 'DIVERSE', 'MY_TRUE_FORM', 'CURSED_RUN'], ['INSANITY', 'ALL_STAR', 'PRAISE_SNECKO'],
        ['CHIMERA', 'BLUE_CARDS', 'INCEPTION', 'LETHALITY'], ['DAILY_MODS', 'ENDLESS', 'BLIGHT_CHESTS'],
        ['STARTER_DECK', 'BINARY', 'VINTAGE', 'MIDAS'], ['ONE_HIT_WONDER', 'TERMINAL', 'NIGHT_TERRORS'],
    ]
    it.each(CHARACTER_IDS)('finishes and reloads custom starting choices for %s', character => {
        for (const modifiers of combinations) {
            const seed = `modifiers-v1-${character}-${modifiers[0]}`, rng = new RNG(seed)
            let run = createProfileRun(createDefaultMeta(), { character, seed, mode: 'custom', modifiers })
            run = JSON.parse(JSON.stringify(run)); finishStartingChoices(run, rng); assertRun(run)
            expect(run.deck.length).toBeGreaterThan(0)
        }
    })
})
