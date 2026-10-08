import { describe, expect, it } from 'vitest'
import { createCardInstance } from './cards'
import { awardUnlockXp, createDefaultMeta, getCharacterProgress, getEffectiveUnlockedCardIds, getEffectiveUnlockedRelicIds, keysUnlocked } from './meta'
import { createNewRun } from './run'
import { recordRunResult } from './runResults'
import { calculateScore } from './score'
import { UNLOCK_TRACKS } from './unlocks'

describe('original character progression', () => {
    it('awards at most one unlock per result with capped carryover', () => {
        const meta = createDefaultMeta()
        expect(awardUnlockXp(meta, 'silent', 299)).toBeUndefined()
        expect(awardUnlockXp(meta, 'silent', 1)?.cards).toContain('CATALYST')
        expect(getCharacterProgress(meta, 'silent')).toMatchObject({ unlockTier: 1, xp: 0 })
        expect(awardUnlockXp(meta, 'silent', 9999)?.relics).toContain('DU_VU_DOLL')
        expect(getCharacterProgress(meta, 'silent')).toMatchObject({ unlockTier: 2, xp: 999 })
        expect(getCharacterProgress(meta, 'ironclad').unlockTier).toBe(0)
    })
    it('unlocks all original bundles without gating the other base cards', () => {
        const meta = createDefaultMeta()
        for (const character of ['ironclad', 'silent', 'defect', 'watcher'] as const) {
            for (let i = 0; i < 5; i++) awardUnlockXp(meta, character, 3000)
            expect(getCharacterProgress(meta, character).unlockTier).toBe(5)
            for (const bundle of UNLOCK_TRACKS[character]) {
                for (const id of bundle.cards) expect(getEffectiveUnlockedCardIds(meta).has(id)).toBe(true)
                for (const id of bundle.relics) expect(getEffectiveUnlockedRelicIds(meta).has(id)).toBe(true)
            }
        }
    })
    it('keeps Ascension per character and advances after an Act 4 loss', () => {
        const meta = createDefaultMeta(), run = createNewRun({ character: 'silent', mode: 'standard' })
        run.actsCleared = [1, 2, 3]; run.act = 4; run.floor = 54
        expect(recordRunResult(meta, run, 'defeat').unlockedNext).toBe(true)
        expect(getCharacterProgress(meta, 'silent').ascension).toBe(1)
        expect(getCharacterProgress(meta, 'ironclad').ascension).toBe(0)
        recordRunResult(meta, run, 'defeat'); expect(meta.totalRuns).toBe(1); expect(meta.history).toHaveLength(1)
    })
    it.each(['seeded', 'custom', 'daily'] as const)('grants %s XP without standard Ascension or keys', mode => {
        const meta = createDefaultMeta(), run = createNewRun({ character: 'defect', mode, seed: 'mode' })
        run.actsCleared = [1, 2, 3]; run.floor = 51; run.neowCompleted = true
        const result = recordRunResult(meta, run, 'victory')
        expect(result.unlockBundle?.cards).toContain('ECHO_FORM')
        expect(result.unlockedNext).toBe(false); expect(keysUnlocked(meta)).toBe(false)
    })
    it('opens characters in sequence and keys after all three original character clears', () => {
        const meta = createDefaultMeta()
        recordRunResult(meta, createNewRun({ mode: 'standard' }), 'defeat')
        expect(getCharacterProgress(meta, 'silent').unlocked).toBe(true)
        recordRunResult(meta, createNewRun({ character: 'silent', mode: 'standard' }), 'victory')
        expect(getCharacterProgress(meta, 'defect').unlocked).toBe(true)
        expect(getCharacterProgress(meta, 'watcher').unlocked).toBe(false)
        recordRunResult(meta, createNewRun({ character: 'defect', mode: 'standard' }), 'victory')
        expect(getCharacterProgress(meta, 'watcher').unlocked).toBe(true)
        expect(keysUnlocked(meta)).toBe(false)
        recordRunResult(meta, createNewRun({ mode: 'standard' }), 'victory')
        expect(keysUnlocked(meta)).toBe(true)
    })
})
describe('run scoring', () => {
    it('applies Ascension only to the qualifying subtotal, and collector to each card name once', () => {
        const run = createNewRun({ ascension: 20 }); run.neowCompleted = true; run.floor = 10
        run.stats = { hallwayWins: 3, elites: { 1: 2 }, bosses: 1, perfectElites: 1, perfectBosses: 1, combo: true, overkill: true }
        run.deck = Array.from({ length: 8 }, () => createCardInstance('ANGER'))
        const score = calculateScore(run, false)
        expect(score.lines.find(line => line.label === 'Collector')?.points).toBe(25)
        expect(score.lines.find(line => line.label === 'Ascension')?.points).toBe(251)
        expect(score.total).toBe(527)
    })
    it('does not give victory deck bonuses to an abandoned starter deck', () => {
        const run = createNewRun()
        expect(calculateScore(run, false).total).toBe(0)
        expect(calculateScore(run, false).lines.some(line => ['Pauper', 'Highlander'].includes(line.label))).toBe(false)
    })
})
