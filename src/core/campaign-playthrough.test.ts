import { expect, it } from 'vitest'
import { simulateCampaign } from '../../tests/support/campaign'

it.each([
    ['ironclad', 'available-ironclad-177'],
    ['silent', 'available-silent-525'],
    ['defect', 'available-defect-354'],
    ['watcher', 'available-watcher-2274'],
] as const)('plays a legal %s starter deck through three acts and checkpoint recovery', (character, seed) => {
    const { run, scene, history } = simulateCampaign(seed, character, true)
    expect(scene, history.slice(-5).join('\n')).toBe('RunSummary')
    expect(run.player.hp, history.slice(-5).join('\n')).toBeGreaterThan(0)
    expect(run.actsCleared).toEqual([1, 2, 3])
    expect(run.stats?.bosses).toBe(3)
    expect(run.stats?.hallwayWins).toBeGreaterThan(0)
    expect(run.stats?.goldEarned).toBeGreaterThan(0)
    expect(run.runFlags?.reachedFirstBoss).toBe(true)
})
