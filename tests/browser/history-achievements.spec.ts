import { test, expect, type Page } from '@playwright/test'
import { createDefaultMeta, type MetaState, type RunHistoryEntry } from '../../src/core/meta'
import { ACHIEVEMENT_IDS } from '../../src/core/achievements/catalog'
import { RELIC_DEFS } from '../../src/core/relics'
import { createNewRun } from '../../src/core/run'
import { boot, clickText, expectScene, inspect } from './driver'

async function seedMeta(page: Page, meta: MetaState) {
    await page.evaluate(meta => localStorage.setItem('sts_meta_v2', JSON.stringify(meta)), meta)
}
async function expectText(page: Page, text: string) {
    await expect.poll(async () => (await inspect(page)).texts.some(t => t.text.includes(text))).toBe(true)
}
function entry(index: number): RunHistoryEntry {
    return { id: `history-${index}`, date: '2026-10-08T12:34:56.000Z', character: 'silent', mode: 'seeded', seed: `recorded-seed-${index}`,
        ascension: 12, result: 'defeat', floor: 51, actsCleared: [1, 2], score: 900 + index, elapsedSeconds: 3723,
        deck: Array.from({ length: 8 }, () => ({ id: 'NEUTRALIZE', upgrade: 1 })), relics: ['RING_OF_THE_SNAKE', 'ANCHOR', 'BAG_OF_MARBLES', 'LANTERN', 'VAJRA'] }
}

test('history retains its list page and exposes saved summary, upgraded deck, and paginated relics', async ({ page }) => {
    const errors = await boot(page), meta = createDefaultMeta(); meta.history = Array.from({ length: 7 }, (_, i) => entry(i))
    await seedMeta(page, meta); await clickText(page, 'Run History'); await clickText(page, 'Next'); await expectText(page, '2 / 2')
    await clickText(page, '2026-10-08  Silent A12  ·  defeat  ·  906 points')
    for (const text of ['2026-10-08 12:34:56', 'Seeded', 'Ascension', 'Acts cleared', '1, 2', '62m 03s', 'recorded-seed-6']) await expectText(page, text)
    await expect(page.getByRole('button', { name: 'Summary', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await clickText(page, 'Deck (8)')
    await expect(page.getByRole('button', { name: /Inspect Neutralize\+/ })).toHaveCount(5)
    await clickText(page, 'Next'); await expect(page.getByRole('button', { name: /Inspect Neutralize\+/ })).toHaveCount(3)
    await clickText(page, 'Relics (5)'); await expectText(page, RELIC_DEFS.ANCHOR.description)
    await clickText(page, 'Next'); await expectText(page, 'Vajra'); await expectText(page, '2 / 2')
    await clickText(page, 'Back to history'); await expectText(page, '2 / 2')
    expect(await page.getByRole('button', { name: /906 points/ }).count()).toBe(1)
    await page.screenshot({ path: 'test-results/history-list.png' })
    expect(errors).toEqual([])
})

test('history empty views and phone landscape summary stay within the canvas', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    const errors = await boot(page)
    await clickText(page, 'Run History'); await expectText(page, 'Completed runs will appear here.')
    await clickText(page, 'Back')
    const meta = createDefaultMeta(), empty = entry(0); empty.deck = []; empty.relics = []; empty.actsCleared = []; meta.history = [empty]
    await seedMeta(page, meta); await clickText(page, 'Run History'); await clickText(page, '2026-10-08  Silent A12  ·  defeat  ·  900 points')
    await expectText(page, 'None')
    await page.screenshot({ path: 'test-results/history-summary-phone.png' })
    const view = await inspect(page)
    expect(view.texts.every(t => t.x >= 0 && t.x + t.width <= 800 && t.y + t.height <= 450)).toBe(true)
    await clickText(page, 'Deck (0)'); await expectText(page, 'No cards recorded')
    await clickText(page, 'Relics (0)'); await expectText(page, 'No relics recorded')
    expect(errors).toEqual([])
})

test('achievement filters show dates, reset pagination, and handle both empty states', async ({ page }) => {
    const errors = await boot(page)
    await clickText(page, 'Achievements'); await clickText(page, 'Earned (0)'); await expectText(page, 'Your first achievement is waiting')
    await clickText(page, 'Back')
    const meta = createDefaultMeta(); meta.achievements = Object.fromEntries(ACHIEVEMENT_IDS.slice(0, 6).map(id => [id, '2026-10-08T12:00:00Z']))
    await seedMeta(page, meta); await clickText(page, 'Achievements'); await clickText(page, 'Earned (6)')
    await expectText(page, 'Earned 2026-10-08'); await clickText(page, 'Next'); await expectText(page, '2 / 2')
    await clickText(page, 'Locked (40)'); await expectText(page, '1 / 8'); await expectText(page, 'The Shapes')
    await expect(page.getByRole('button', { name: 'Locked (40)', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.screenshot({ path: 'test-results/achievements.png' })
    await clickText(page, 'Back'); meta.achievements = Object.fromEntries(ACHIEVEMENT_IDS.map(id => [id, '2026-10-08T12:00:00Z']))
    await seedMeta(page, meta); await clickText(page, 'Achievements'); await clickText(page, 'Locked (0)'); await expectText(page, 'Every achievement earned')
    expect(errors).toEqual([])
})

test('a Daily victory earns My Lucky Day and survives reload in achievements and history', async ({ page }) => {
    const errors = await boot(page), run = createNewRun({ seed: 'daily-polish', mode: 'daily', character: 'watcher' })
    run.act = 3; run.floor = 51; run.actsCleared = [1, 2, 3]; run.elapsedSeconds = 1259
    await page.evaluate(run => window.__testGame.scene.getScene('MainMenu').scene.start('RunSummary', { run, result: 'victory' }), run)
    await expectScene(page, 'RunSummary'); await clickText(page, 'Back to Main Menu'); await clickText(page, 'Achievements'); await clickText(page, 'Earned (1)')
    await expectText(page, 'My Lucky Day'); const date = await page.evaluate(() => JSON.parse(localStorage.getItem('sts_meta_v2')!).achievements.MY_LUCKY_DAY)
    await page.reload(); await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    await clickText(page, 'Achievements'); await clickText(page, 'Earned (1)'); await expectText(page, 'My Lucky Day')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sts_meta_v2')!).achievements.MY_LUCKY_DAY)).toBe(date)
    await clickText(page, 'Back'); await clickText(page, 'Run History')
    await page.getByRole('button', { name: /Watcher A0.*victory/ }).press('Enter')
    await expectText(page, 'Daily'); await expectText(page, '20m 59s'); await expectText(page, '1, 2, 3')
    expect(errors).toEqual([])
})
