import { expect, test } from '@playwright/test'
import { button, downloadProfile, scene, tap, touchDrag, watch } from './driver'

declare global { interface Window { __releaseAudio?: AudioContext[] } }

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 })
test('touch combat, rotation, audio unlock and profile export work in the built game', async ({ page }, info) => {
    const observed = watch(page)
    await page.addInitScript(() => {
        const contexts: AudioContext[] = []; window.__releaseAudio = contexts
        window.AudioContext = class extends AudioContext {
            constructor(options?: AudioContextOptions) { super(options); contexts.push(this) }
        }
    })
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Rotate to play' })).toBeVisible()
    await expect(page.locator('#app')).toHaveAttribute('inert', '')
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(page.getByRole('dialog', { name: 'Rotate to play' })).toBeHidden()
    await expect(scene(page, 'MainMenu')).toBeVisible()
    await tap(page, 'Settings'); await expect(scene(page, 'Settings')).toBeVisible()
    try {
        await expect.poll(() => page.evaluate(() => window.__releaseAudio?.some(context => context.state === 'running') ?? false)).toBe(true)
    } finally {
        await info.attach('audio-unlock', {
            body: JSON.stringify(await page.evaluate(() => ({
                hidden: document.hidden,
                contexts: window.__releaseAudio?.map(context => ({ state: context.state, currentTime: context.currentTime })),
            }))),
            contentType: 'application/json',
        })
    }
    await tap(page, 'Reduced motion: off'); await expect(button(page, 'Reduced motion: on')).toBeEnabled()
    await tap(page, 'Profile backup'); await expect(scene(page, 'Profile')).toBeVisible()
    const exported = await downloadProfile(page, true)
    expect(JSON.parse(exported.buffer.toString()).settings.reducedMotion).toBe(true)
    const bounds = (await page.locator('canvas').boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(845); expect(bounds.y + bounds.height).toBeLessThanOrEqual(391)
    await info.attach('landscape-profile', { body: await page.screenshot(), contentType: 'image/png' })

    await tap(page, 'Back'); await tap(page, 'Seeded')
    await page.getByRole('textbox', { name: 'Run seed' }).fill('release-0')
    await tap(page, 'New Run'); await expect(scene(page, 'Neow')).toBeVisible()
    await tap(page, /^Gain 10% max HP/); await expect(scene(page, 'Map')).toBeVisible()
    await tap(page, /^Floor .*Fight/); await expect(scene(page, 'Combat')).toBeVisible()
    const handCount = await button(page, /^Play /).count()
    await touchDrag(page, /^Play Strike/, /^Target /)
    await expect(button(page, /^Play /)).toHaveCount(handCount - 1)
    await tap(page, 'End Turn')
    await expect(scene(page, 'Combat').getByRole('status')).toContainText('Turn 2.')
    const hand = await button(page, /^Play /).allTextContents()
    const status = await scene(page, 'Combat').getByRole('status').textContent()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('dialog', { name: 'Rotate to play' })).toBeVisible()
    await expect(scene(page, 'Combat')).toBeHidden()
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(scene(page, 'Combat')).toBeVisible()
    await expect(button(page, /^Play /)).toHaveText(hand)
    await expect(scene(page, 'Combat').getByRole('status')).toHaveText(status!)
    await tap(page, 'End Turn')
    await expect(scene(page, 'Combat').getByRole('status')).toContainText('Turn 3.')
    await info.attach('landscape-combat', { body: await page.screenshot(), contentType: 'image/png' })
    expect(observed.errors).toEqual([]); expect(observed.missing).toEqual([])
})
