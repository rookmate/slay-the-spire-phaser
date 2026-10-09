import { expect, test, type Locator, type Page } from '@playwright/test'
import { createNewRun } from '../../src/core/run'
import { createCardInstance } from '../../src/core/cards'
import { boot, expectScene, inspect } from './driver'

test.use({ hasTouch: true })

async function tabTo(page: Page, target: Locator): Promise<void> {
    for (let i = 0; i < 100; i++) {
        if (await target.evaluate(element => element === document.activeElement)) return
        await page.keyboard.press('Tab')
    }
    throw new Error(`Could not reach ${await target.textContent()} with Tab`)
}
async function activate(page: Page, target: Locator): Promise<void> {
    await tabTo(page, target); await page.keyboard.press('Enter')
}

test('keyboard-only menu, blessing and map path reaches a fight with visible focus', async ({ page }) => {
    const errors = await boot(page)
    await activate(page, page.getByRole('button', { name: 'New Run', exact: true }))
    await expectScene(page, 'Neow')
    const choices = (await inspect(page)).options!
    const option = choices.find(option => !option.requiresSelection)!
    await activate(page, page.getByRole('button', { name: `${option.label}. ${option.description}`, exact: true }))
    await expectScene(page, 'Map')
    const route = page.getByRole('button', { name: /^Floor .*Fight/ }).first()
    await tabTo(page, route)
    await expect(page.locator('.game-access[data-scene="Map"] .access-focus')).toBeVisible()
    await page.keyboard.press('Enter'); await expectScene(page, 'Combat')
    await expect(page.getByRole('button', { name: 'End Turn', exact: true })).toBeEnabled()
    await expect(page.locator('.game-access[data-scene="MainMenu"]')).toHaveCount(0)
    expect(errors).toEqual([])
})

test('keyboard combat plays targeted cards, resolves a choice and claims rewards', async ({ page }) => {
    const run = createNewRun({ seed: 'access-combat' })
    run.neowCompleted = true; run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    run.relics.push('CURSED_KEY')
    run.eventCombat = { enemies: ['CULTIST'], rewards: { tier: 'hallway', items: [{ kind: 'cards', choices: ['SHRUG_IT_OFF', 'ANGER', 'POMMEL_STRIKE'] }] } }
    run.deck = ['TRUE_GRIT', 'BLUDGEON', 'BLUDGEON', 'BLUDGEON', 'BLUDGEON'].map(id => createCardInstance(id, 1))
    const errors = await boot(page, run)
    await activate(page, page.getByRole('button', { name: /^Play True Grit/ }))
    await expect(page.getByRole('button', { name: /^Play / })).toHaveCount(0)
    const select = page.getByRole('button', { name: /^Select Bludgeon/ }).first()
    await activate(page, select)
    await expect.poll(async () => (await inspect(page)).choice).toBeUndefined()
    await activate(page, page.getByRole('button', { name: /^Play Bludgeon/ }).first())
    await activate(page, page.getByRole('button', { name: /^Target Cultist/ }))
    if ((await inspect(page)).scene === 'Combat') {
        await activate(page, page.getByRole('button', { name: 'End Turn', exact: true }))
        await activate(page, page.getByRole('button', { name: /^Play Bludgeon/ }).first())
        await activate(page, page.getByRole('button', { name: /^Target Cultist/ }))
    }
    await expectScene(page, 'Rewards')
    await activate(page, page.getByRole('button', { name: /^Take Shrug It Off/ }))
    await activate(page, page.getByRole('button', { name: 'Continue', exact: true }))
    await expectScene(page, 'Map')
    expect(errors).toEqual([])
})

test('nested card inspection traps focus, restores it and honors disabled controls', async ({ page }) => {
    const run = createNewRun({ seed: 'access-inspect' })
    run.neowCompleted = true; run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    run.deck = Array.from({ length: 5 }, () => createCardInstance('BLUDGEON'))
    const errors = await boot(page, run)
    await activate(page, page.getByRole('button', { name: 'Draw pile', exact: true }))
    await expect(page.getByRole('button', { name: 'End Turn', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Draw pile', exact: true })).toBeFocused()
    const inspectCard = page.getByRole('button', { name: /^Inspect Bludgeon/ }).first()
    await activate(page, inspectCard)
    const close = page.getByRole('button', { name: /^Close Bludgeon/ })
    await expect(close).toBeFocused()
    await page.keyboard.press('Escape'); await expect(inspectCard).toBeFocused()
    await activate(page, page.getByRole('button', { name: 'Menu', exact: true }))
    await expectScene(page, 'CombatMenu')
    await expect(page.locator('.game-access[data-scene="Combat"]')).toBeHidden()
    await activate(page, page.getByRole('button', { name: 'Resume', exact: true }))
    await expectScene(page, 'Combat')
    expect(await page.locator('.game-access').count()).toBe(1)
    expect(errors).toEqual([])
})

test('seed input accepts combat shortcut letters and rotation blocks semantic controls', async ({ page }) => {
    await boot(page)
    await activate(page, page.getByRole('button', { name: 'Seeded', exact: true }))
    const input = page.getByRole('textbox', { name: 'Run seed' })
    await tabTo(page, input); await page.keyboard.type('e123')
    await expect(input).toHaveValue('e123')
    await expectScene(page, 'MainMenu')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('#app')).toHaveAttribute('inert', '')
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(page.locator('#app')).not.toHaveAttribute('inert', '')
    await activate(page, page.getByRole('button', { name: 'Help', exact: true }))
    await expectScene(page, 'Help')
    await page.keyboard.press('Escape'); await expectScene(page, 'MainMenu')
    await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeFocused()
})


test('targeted potions focus the enemy and repeated menu renders dispose old controls', async ({ page }) => {
    const run = createNewRun({ seed: 'access-potion' })
    run.neowCompleted = true; run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }; run.potions = ['FIRE_POTION']
    await boot(page, run)
    const before = (await inspect(page)).state!.enemies[0].hp
    await activate(page, page.getByRole('button', { name: /^Potion 1: Fire Potion/ }))
    await activate(page, page.getByRole('button', { name: 'Use', exact: true }))
    const target = page.getByRole('button', { name: /^Target / }).first()
    await expect(target).toBeFocused()
    await page.keyboard.press('Enter')
    expect((await inspect(page)).state!.enemies[0].hp).toBeLessThan(before)
    await activate(page, page.getByRole('button', { name: 'Menu', exact: true }))
    await activate(page, page.getByRole('button', { name: 'Main menu', exact: true }))
    for (let i = 0; i < 4; i++) {
        await activate(page, page.getByRole('button', { name: 'Seeded', exact: true }))
        await page.keyboard.press('Shift+Tab')
        await expect(page.getByRole('button', { name: 'Standard', exact: true })).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('button', { name: 'Help', exact: true })).toHaveCount(1)
        await expect(page.locator('.game-access')).toHaveCount(1)
    }
})
