import { expect, test } from '@playwright/test'
import { CHARACTERS, CHARACTER_IDS } from '../../src/core/characters'
import { CARD_DEFS } from '../../src/core/cards'
import { createDefaultMeta, getCharacterProgress } from '../../src/core/meta'
import { boot, clickText, expectScene, inspect } from './driver'

for (const character of CHARACTER_IDS) test(`a fresh profile can start ${character} with its complete card collection`, async ({ page }) => {
    const errors = await boot(page)
    await clickText(page, CHARACTERS[character].name)
    await clickText(page, 'New Run'); await expectScene(page, 'Neow')
    const run = (await inspect(page)).run!
    expect(run.character).toBe(character)
    expect(run.player.maxHp).toBe(CHARACTERS[character].maxHp)
    expect(run.unlockedCardIds).toEqual(expect.arrayContaining(Object.values(CARD_DEFS).filter(card => card.color === character).map(card => card.id)))
    expect(errors).toEqual([])
})

test('old character locks disappear and the library includes former card unlocks', async ({ page }) => {
    const errors = await boot(page), meta = createDefaultMeta()
    for (const id of CHARACTER_IDS) Object.assign(getCharacterProgress(meta, id), { unlocked: false, xp: 120 })
    await page.evaluate(meta => localStorage.setItem('sts_meta_v2', JSON.stringify(meta)), meta)
    await page.reload(); await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
    for (const character of CHARACTER_IDS) await clickText(page, CHARACTERS[character].name)
    await clickText(page, 'Card Library'); await clickText(page, 'Watcher')
    const library = await inspect(page)
    expect(library.cards.some(card => card.defId === 'ALPHA')).toBe(true)
    expect(library.texts.some(text => text.text === 'Locked')).toBe(false)
    await clickText(page, 'Back'); await clickText(page, 'Watcher'); await clickText(page, 'New Run')
    await expectScene(page, 'Neow')
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sts_meta_v2')!))
    for (const character of CHARACTER_IDS) expect(saved.characters[character]).toMatchObject({ unlocked: true, xp: 120, unlockTier: 0, ascension: 0 })
    expect(errors).toEqual([])
})
