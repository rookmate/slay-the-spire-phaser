import { expect, test } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { createCardInstance } from '../../src/core/cards'
import { boot, clickText, expectScene, inspect } from './driver'

test('guide is searchable, keyboard accessible and returns to its invoking scene', async ({ page }) => {
    const errors = await boot(page)
    await clickText(page, 'Help'); await expectScene(page, 'Help')
    const guide = page.getByRole('dialog', { name: 'Game guide' })
    await expect(guide.getByRole('heading', { name: 'Your turn' })).toBeVisible()
    await guide.getByRole('button', { name: 'Status effects' }).click()
    await guide.getByRole('searchbox').fill('poison')
    await expect(guide).toContainText('bypassing Block')
    await guide.getByRole('searchbox').fill('nonexistent status')
    await expect(guide).toContainText('No matching entries')
    await page.keyboard.press('Escape'); await expectScene(page, 'MainMenu')
    await clickText(page, 'Settings'); await clickText(page, 'Game guide')
    await page.keyboard.press('Escape'); await expectScene(page, 'Settings')
    await clickText(page, 'Back'); await expectScene(page, 'MainMenu')
    expect(errors).toEqual([])
})

test('touch effects inspection clears targeting, pauses the fight and preserves state', async ({ page }) => {
    const run = createNewRun({ seed: 'help-combat' })
    run.neowCompleted = true; run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    run.deck = Array.from({ length: 5 }, () => createCardInstance('STRIKE'))
    run.relics.push('RUNIC_DOME')
    const errors = await boot(page, run), initial = await inspect(page)
    await page.keyboard.press('1')
    const label = (await inspect(page)).texts.find(text => text.enabled && text.text.startsWith('Effects ?') && text.x > 250)!.text
    await clickText(page, label); await expectScene(page, 'Help')
    await expect(page.getByRole('dialog')).toContainText('Intent hidden by Runic Dome')
    await page.keyboard.press('e')
    await page.keyboard.press('Escape'); await expectScene(page, 'Combat')
    expect((await inspect(page)).state).toEqual(initial.state)
    await page.keyboard.press('Escape'); await expectScene(page, 'CombatMenu')
    await clickText(page, 'Game guide'); await expectScene(page, 'Help')
    await page.getByRole('button', { name: 'Back to game' }).click(); await expectScene(page, 'CombatMenu')
    await clickText(page, 'Resume'); expect((await inspect(page)).state).toEqual(initial.state)
    expect(errors).toEqual([])
})


test('landscape guide remains usable and cleans up when the game is destroyed', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await boot(page); await clickText(page, 'Help')
    const close = page.getByRole('button', { name: 'Back to game' })
    await expect(close).toBeInViewport()
    await page.getByRole('button', { name: 'Status effects' }).click()
    await page.getByRole('searchbox').fill('wreath')
    await expect(page.getByRole('dialog')).toContainText('additional damage per hit')
    await page.evaluate(() => window.__testGame.destroy(true))
    await expect(page.getByRole('dialog')).toHaveCount(0)
})
