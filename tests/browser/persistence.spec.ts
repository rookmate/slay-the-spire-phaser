import { expect, test, type Page } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { boot, clickText, expectScene, inspect } from './driver'

async function failNextRunWrite(page: Page) {
    await page.evaluate(() => {
        const set = Storage.prototype.setItem
        let failed = false
        Storage.prototype.setItem = function (key, value) {
            if (key === 'sts_run_v7' && !failed) { failed = true; throw new DOMException('Full storage', 'QuotaExceededError') }
            set.call(this, key, value)
        }
    })
}
async function downloadCheckpoint(page: Page) {
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download unsaved checkpoint' }).click()
    const stream = await (await pending).createReadStream(), chunks = []
    for await (const chunk of stream!) chunks.push(chunk)
    return JSON.parse(Buffer.concat(chunks).toString())
}

test('only one tab can write, and closing it releases the profile for another tab', async ({ page, context }) => {
    const errors = await boot(page)
    const other = await context.newPage(); await other.goto('/tests/browser/')
    await expect(other.getByRole('dialog')).toContainText('Profile open in another tab')
    expect(await page.evaluate(() => localStorage.getItem('sts_run_v7'))).toBeNull()
    await page.close()
    await other.getByRole('button', { name: 'Retry opening profile' }).click()
    await other.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    await clickText(other, 'New Run'); await expectScene(other, 'Neow')
    expect(errors).toEqual([])
})

test('a failed purchase can be exported and retried without duplicating it', async ({ page }) => {
    const run = createNewRun({ seed: 'save-purchase' }); run.neowCompleted = true; run.gold = 1000; run.pendingRoom = { scene: 'Shop' }
    const errors = await boot(page, run), before = await inspect(page)
    const stored = await page.evaluate(() => localStorage.getItem('sts_run_v7'))
    await failNextRunWrite(page)
    await clickText(page, before.texts.find(t => t.enabled && t.y === 190 && t.text.endsWith(' G'))!.text)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Your last action could not be saved')
    expect(await page.evaluate(() => localStorage.getItem('sts_run_v7'))).toBe(stored)
    const pending = await downloadCheckpoint(page)
    expect(pending.run.deck).toHaveLength(before.run!.deck.length + 1)
    expect(pending.run.gold).toBeLessThan(before.run!.gold)
    expect(pending.run.pendingRoom.inventory.cards).toHaveLength(before.inventory!.cards.length - 1)
    await page.keyboard.press('Escape'); await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Retry save' }).click()
    await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    await clickText(page, 'Continue'); await expectScene(page, 'Shop')
    const after = (await inspect(page)).run!
    expect(after.gold).toBe(pending.run.gold); expect(after.deck).toEqual(pending.run.deck)
    expect(errors).toEqual([])
})

test('replacing a run commits its old result and new checkpoint together', async ({ page }) => {
    const errors = await boot(page), run = createNewRun({ seed: 'old-checkpoint' })
    await page.evaluate(run => localStorage.setItem('sts_run_v7', JSON.stringify(run)), run)
    await page.reload(); await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    const before = await page.evaluate(() => ({ meta: localStorage.getItem('sts_meta_v2'), run: localStorage.getItem('sts_run_v7') }))
    await clickText(page, 'New Run'); await failNextRunWrite(page); await clickText(page, 'Abandon saved run and start')
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await page.evaluate(() => ({ meta: localStorage.getItem('sts_meta_v2'), run: localStorage.getItem('sts_run_v7') }))).toEqual(before)
    const pending = await downloadCheckpoint(page)
    expect(pending.meta.history).toHaveLength(1); expect(pending.meta.history[0].id).toBe(run.runId)
    await page.getByRole('button', { name: 'Retry save' }).click()
    await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    const after = await page.evaluate(() => ({ meta: JSON.parse(localStorage.getItem('sts_meta_v2')!), run: JSON.parse(localStorage.getItem('sts_run_v7')!) }))
    expect(after.meta.history).toHaveLength(1); expect(after.run.runId).toBe(pending.run.runId)
    expect(errors).toEqual([])
})

for (const scene of ['Shop', 'Combat', 'MainMenu'] as const) test(`foreign replacement blocks ${scene} and every save writer`, async ({ page, context }) => {
    const run = createNewRun({ seed: `stale-${scene}` }); run.neowCompleted = true
    if (scene === 'Shop') run.pendingRoom = { scene: 'Shop' }
    if (scene === 'Combat') run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    const errors = await boot(page, scene === 'MainMenu' ? undefined : run)
    const other = await context.newPage(); await other.goto('/tests/browser/')
    await expect(other.getByRole('dialog')).toContainText('Profile open in another tab')
    // A legacy/non-game writer can still change storage despite the cooperative Web Lock.
    const replacement = { ...run, gold: 999 }
    await other.evaluate(run => localStorage.setItem('sts_run_v7', JSON.stringify(run)), replacement)
    await expect(page.getByRole('dialog')).toContainText('Your save changed in another tab')
    const rejected = await page.evaluate(async run => {
        const runPath = '/src/core/run.ts', metaPath = '/src/core/meta.ts', settingsPath = '/src/core/settings.ts'
        const r = await import(runPath), m = await import(metaPath), s = await import(settingsPath)
        return [() => r.saveRun(run), () => r.clearSavedRun(), () => m.saveMeta(m.createDefaultMeta()), () => s.saveSettings(s.defaultSettings())]
            .map(write => { try { write(); return false } catch { return true } })
    }, run)
    expect(rejected).toEqual([true, true, true, true])
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sts_run_v7')!).gold)).toBe(999)
    expect(errors).toEqual([])
})

test('denied storage at startup shows its own recovery instructions', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage denied', 'SecurityError') } }))
    await page.goto('/tests/browser/')
    await expect(page.getByRole('dialog')).toContainText('Browser storage is unavailable')
    await expect(page.getByRole('dialog')).not.toContainText('interrupted')
    expect(await page.getByRole('dialog').getByRole('button').allTextContents()).toEqual(['Reload'])
    expect(errors).toEqual([])
})

for (const result of ['victory', 'defeat'] as const) test(`a failed ${result} checkpoint resumes at its result instead of replaying the room`, async ({ page }) => {
    const errors = await boot(page)
    await failNextRunWrite(page)
    const run = createNewRun({ seed: `terminal-${result}` }); run.neowCompleted = true; run.act = 3
    if (result === 'victory') { run.runFlags = { victory: true }; run.actsCleared = [1, 2, 3] }
    else { run.player.hp = 0; run.pendingRoom = { scene: 'Combat', roomKind: 'boss' } }
    await page.evaluate(async run => {
        const path = '/src/core/run.ts'
        try { (await import(path)).saveRun(run) } catch { /* The persistence listener presents recovery. */ }
    }, run)
    await page.getByRole('button', { name: 'Retry save' }).click()
    await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    await clickText(page, 'Continue'); await expectScene(page, 'RunSummary')
    const history = await page.evaluate(() => JSON.parse(localStorage.getItem('sts_meta_v2')!).history)
    expect(history).toHaveLength(1); expect(history[0]).toMatchObject({ id: run.runId, result })
    expect(await page.evaluate(() => localStorage.getItem('sts_run_v7'))).toBeNull()
    expect(errors).toEqual([])
})
