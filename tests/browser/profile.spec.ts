import { test, expect } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { createDefaultMeta } from '../../src/core/meta'
import { createCardInstance } from '../../src/core/cards'
import { JOURNAL_KEY } from '../../src/core/profile/storage'
import { boot, clickText, expectScene, inspect } from './driver'

function importedProfile() {
    const run = createNewRun({ seed: 'portable-save', character: 'silent' }); run.neowCompleted = true
    run.pendingRoom = { scene: 'Rewards', rewards: { tier: 'hallway', items: [{ kind: 'gold', amount: 12 }], claimed: [0] } }
    run.gold = 111
    const meta = createDefaultMeta(); meta.totalRuns = 8; meta.achievements = { ADRENALINE: '2026-01-01T00:00:00.000Z' }
    return { format: 'rookmate.spire.profile', version: 1, exportedAt: '2026-01-01T00:00:00.000Z', meta, run,
        settings: { sound: false, volume: 0.3, music: false, musicVolume: 0.2, effectsVolume: 0.7, reducedMotion: true } }
}
async function chooseFile(page: import('@playwright/test').Page, data: unknown) {
    await page.getByLabel('Import profile file').setInputFiles({ name: 'profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
}

test('profile preview and cancellation preserve saves; import and export retain the reward checkpoint', async ({ page }) => {
    const errors = await boot(page), profile = importedProfile()
    await clickText(page, 'Settings'); await clickText(page, 'Profile backup'); await expectScene(page, 'Profile')
    const before = await page.evaluate(() => ({ ...localStorage }))
    await chooseFile(page, profile)
    await expect.poll(async () => (await inspect(page)).texts.some(t => t.text.includes('8 recorded runs'))).toBe(true)
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(before)
    await clickText(page, 'Cancel import'); expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(before)
    await chooseFile(page, profile); await expect.poll(async () => (await inspect(page)).texts.some(t => t.text === 'Replace profile')).toBe(true)
    await clickText(page, 'Replace profile')
    const download = page.waitForEvent('download'); await clickText(page, 'Export profile')
    const exported = await download, stream = await exported.createReadStream(), chunks = []
    for await (const chunk of stream!) chunks.push(chunk)
    const data = JSON.parse(Buffer.concat(chunks).toString())
    expect(data.run).toEqual(profile.run); expect(data.meta.achievements).toEqual(profile.meta.achievements); expect(data.settings).toEqual(profile.settings)
    await page.reload(); await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    await clickText(page, 'Continue'); await expectScene(page, 'Rewards'); await clickText(page, 'Continue')
    expect((await inspect(page)).run!.gold).toBe(111)
    expect(errors).toEqual([])
})

test('invalid nested imports show an error and previous backups require confirmation', async ({ page }) => {
    const errors = await boot(page)
    await clickText(page, 'Settings'); await clickText(page, 'Profile backup')
    const invalid = importedProfile(); invalid.run.deck[0].defId = 'BOGUS'
    const original = await page.evaluate(() => ({ ...localStorage }))
    await chooseFile(page, invalid)
    await expect.poll(async () => (await inspect(page)).texts.some(t => t.text.startsWith('Invalid profile'))).toBe(true)
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(original)
    await chooseFile(page, importedProfile()); await expect.poll(async () => (await inspect(page)).texts.some(t => t.text === 'Replace profile')).toBe(true)
    await clickText(page, 'Replace profile'); await clickText(page, 'Preview previous backup')
    expect((await inspect(page)).texts.some(t => t.text.includes('0 recorded runs'))).toBe(true)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sts_meta_v2')!).totalRuns)).toBe(8)
    await clickText(page, 'Replace profile'); expect(await page.evaluate(() => localStorage.getItem('sts_run_v7'))).toBeNull()
    expect(errors).toEqual([])
})

test('startup recovers an interrupted import before loading its saved run', async ({ page }) => {
    const errors = await boot(page), original = importedProfile()
    await page.evaluate(({ journal, original }) => {
        localStorage.setItem(journal, JSON.stringify({ sts_meta_v2: JSON.stringify(original.meta), sts_run_v7: JSON.stringify(original.run), sts_settings_v1: JSON.stringify(original.settings) }))
        localStorage.setItem('sts_meta_v2', '{"invalid":true}'); localStorage.removeItem('sts_run_v7')
    }, { journal: JOURNAL_KEY, original })
    await page.reload(); await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    expect(await page.evaluate(key => localStorage.getItem(key), JOURNAL_KEY)).toBeNull()
    await clickText(page, 'Achievements'); expect((await inspect(page)).texts.some(t => t.text.includes('1/46'))).toBe(true)
    await clickText(page, 'Back'); await clickText(page, 'Continue'); await expectScene(page, 'Rewards')
    expect((await inspect(page)).run!.runId).toBe(original.run.runId); expect(errors).toEqual([])
})

test('a combat achievement notifies once and remains earned after reloading its room', async ({ page }) => {
    const run = createNewRun({ seed: 'achievement-ui', mode: 'standard' }); run.neowCompleted = true
    run.deck = Array.from({ length: 5 }, () => createCardInstance('DEFEND')); run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    run.potions = ['ENERGY_POTION', 'ENERGY_POTION', 'ENERGY_POTION']
    const errors = await boot(page, run)
    for (let i = 0; i < 3; i++) { await clickText(page, 'Energy'); await clickText(page, 'Use') }
    await expect(page.getByRole('status')).toContainText('Adrenaline')
    const first = await page.evaluate(() => JSON.parse(localStorage.getItem('sts_meta_v2')!).achievements.ADRENALINE)
    await page.reload(); await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    await clickText(page, 'Continue'); for (let i = 0; i < 3; i++) { await clickText(page, 'Energy'); await clickText(page, 'Use') }
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sts_meta_v2')!).achievements.ADRENALINE)).toBe(first)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sts_meta_v2')!).notifications)).toEqual([])
    expect(errors).toEqual([])
})

test('failed rollback immediately blocks gameplay and profile writes until recovery succeeds', async ({ page }) => {
    const errors = await boot(page), original = importedProfile()
    await page.evaluate(original => {
        original.meta.notifications = [{ id: 'old-notice', title: 'Existing unlock', detail: 'Pending notice' }]
        localStorage.setItem('sts_meta_v2', JSON.stringify(original.meta))
        localStorage.setItem('sts_run_v7', JSON.stringify(original.run))
        localStorage.setItem('sts_settings_v1', JSON.stringify(original.settings))
    }, { ...original, meta: { ...original.meta, notifications: [] as { id: string; title: string; detail: string }[] } })
    await clickText(page, 'Settings'); await clickText(page, 'Profile backup')
    const next = importedProfile(); next.run.runId = 'replacement'
    await chooseFile(page, next); await expect.poll(async () => (await inspect(page)).texts.some(t => t.text === 'Replace profile')).toBe(true)
    await page.evaluate(() => {
        const set = Storage.prototype.setItem
        Storage.prototype.setItem = function (key, value) { if (key === 'sts_run_v7') throw new DOMException('Simulated full storage', 'QuotaExceededError'); set.call(this, key, value) }
    })
    await clickText(page, 'Replace profile'); await expectScene(page, 'ProfileRecovery')
    const blocked = await inspect(page)
    expect(blocked.texts.filter(t => t.enabled).map(t => t.text)).toEqual(['Retry recovery', 'Download recovery journal'])
    expect(await page.getByLabel('Import profile file').count()).toBe(0)
    const frozen = await page.evaluate(() => ({ ...localStorage }))
    expect(frozen[JOURNAL_KEY]).toBeTruthy(); expect(frozen.sts_run_v7).toBeUndefined()
    await page.waitForTimeout(1100); expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(frozen)
    await clickText(page, 'Retry recovery'); await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    await clickText(page, 'Continue'); await expectScene(page, 'Rewards')
    expect((await inspect(page)).run!.runId).toBe(original.run.runId)
    expect(await page.evaluate(key => localStorage.getItem(key), JOURNAL_KEY)).toBeNull(); expect(errors).toEqual([])
})
