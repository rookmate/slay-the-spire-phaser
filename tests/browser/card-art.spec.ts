import { test, expect } from '@playwright/test'
import type Phaser from 'phaser'
import type { Card } from '../../src/ui/Card'
import { createNewRun } from '../../src/core/run'
import { createCardInstance } from '../../src/core/cards'
import { CARD_ART } from '../../src/ui/art/cardCatalog'
import { CARD_ART_CACHE_LIMIT } from '../../src/ui/art/cards'
import { boot, clickText, inspect } from './driver'

async function renderCards(page: import('@playwright/test').Page, ids: string[]) {
    await page.evaluate(async ids => {
        const cardPath = '/src/ui/Card.ts', corePath = '/src/core/cards.ts'
        const { Card } = await import(cardPath), { createCardInstance } = await import(corePath)
        const game = window.__testGame, scene = game.scene.getScene('MainMenu')
        for (const card of (game.registry.get('art-test-cards') ?? []) as Card[]) card.destroy()
        game.registry.set('art-test-cards', ids.map((id, i) => {
            const card = new Card(scene, createCardInstance(id), { x: 20 + i % 5 * 132, y: 110 })
            scene.add.existing(card); return card
        }))
    }, ids)
    await page.waitForFunction(ids => ids.every(id => window.__testGame.textures.exists(`card-art:${id}`)), ids)
}

test('all 372 cards have distinct rendered art while the texture cache stays bounded', async ({ page }) => {
    test.setTimeout(120_000)
    const requests: string[] = []; page.on('request', request => { if (/\/art\/cards-/.test(request.url())) requests.push(request.url()) })
    const errors = await boot(page)
    expect(requests).toEqual([])
    const ids = Object.keys(CARD_ART), hashes: number[] = []
    for (let start = 0; start < ids.length; start += 12) {
        const batch = ids.slice(start, start + 12)
        await renderCards(page, batch)
        const result = await page.evaluate(ids => {
            const textures = window.__testGame.textures
            return { hashes: ids.map(id => {
                const image = textures.get(`card-art:${id}`).getSourceImage() as HTMLCanvasElement
                const pixels = image.getContext('2d')!.getImageData(0, 0, image.width, image.height).data
                let hash = 2166136261
                for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619)
                return hash >>> 0
            }), cached: textures.getTextureKeys().filter(key => key.startsWith('card-art:')).length,
            bytes: textures.getTextureKeys().filter(key => /^(art:|enemy:|player:|card-art:)/.test(key)).reduce((sum, key) =>
                sum + textures.get(key).source.reduce((bytes, source) => bytes + source.width * source.height * 4, 0), 0) }
        }, batch)
        hashes.push(...result.hashes)
        expect(result.cached).toBeLessThanOrEqual(CARD_ART_CACHE_LIMIT)
        expect(result.bytes).toBeLessThanOrEqual(32 * 1024 * 1024)
    }
    expect(new Set(hashes).size).toBe(ids.length)
    // Revisiting art that was evicted must load it again correctly.
    await renderCards(page, ['STRIKE', 'BASH', 'ZAP', 'ERUPTION', 'DEADLY_POISON'])
    await clickText(page, 'Card Library')
    await page.waitForFunction(() => ['ANGER', 'ARMAMENTS', 'BARRICADE', 'BASH', 'BATTLE_TRANCE'].every(id => window.__testGame.textures.exists(`card-art:${id}`)))
    await page.setViewportSize({ width: 844, height: 390 })
    await page.screenshot({ path: 'test-results/card-art-phone.png' })
    expect(errors).toEqual([])
})

test('upgrades retain their illustration and transformed cards acquire their own art', async ({ page }) => {
    const errors = await boot(page)
    await renderCards(page, ['ZAP'])
    const result = await page.evaluate(async () => {
        const corePath = '/src/core/cards.ts', { createCardInstance } = await import(corePath)
        const card = window.__testGame.registry.get('art-test-cards')[0] as Card
        card.refresh(createCardInstance('ZAP', 1))
        const image = card.list.find(child => child.type === 'Image') as Phaser.GameObjects.Image
        const upgraded = image.texture.key
        card.refresh(createCardInstance('FORESIGHT', 1))
        return { upgraded, oldArtHidden: !image.visible }
    })
    expect(result).toEqual({ upgraded: 'card-art:ZAP', oldArtHidden: true })
    await page.waitForFunction(() => window.__testGame.textures.exists('card-art:FORESIGHT'))
    const transformed = await page.evaluate(() => {
        const card = window.__testGame.registry.get('art-test-cards')[0] as Card
        const image = card.list.find(child => child.type === 'Image') as Phaser.GameObjects.Image
        return { texture: image.texture.key, visible: image.visible, width: image.displayWidth, height: image.displayHeight, label: card.accessLabel() }
    })
    expect(transformed.texture).toBe('card-art:FORESIGHT'); expect(transformed.visible).toBe(true)
    expect(transformed.width).toBeCloseTo(112); expect(transformed.height).toBeCloseTo(112)
    expect(transformed.label).toContain('Foresight+'); expect(errors).toEqual([])
})

test('missing artwork leaves card rules, inspection, and gameplay usable', async ({ page }) => {
    await page.route('**/art/cards-detailed.webp', route => route.abort())
    const run = createNewRun({ seed: 'missing-card-art' }); run.neowCompleted = true; run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    run.deck = Array.from({ length: 5 }, () => createCardInstance('DEFEND'))
    const errors = await boot(page, run)
    expect(await page.evaluate(() => window.__testGame.textures.exists('card-art:DEFEND'))).toBe(false)
    await page.getByRole('button', { name: /^Inspect Defend\./ }).first().press('Enter')
    expect((await inspect(page)).texts.some(t => t.depth === 5900 && t.text === '5 Block.')).toBe(true)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^Play Defend\./ }).first().press('Enter')
    await expect.poll(async () => (await inspect(page)).state!.player.block).toBe(5)
    expect(errors).toEqual([])
})

test('a later acquisition retries a failed sheet without automatic retry traffic', async ({ page }) => {
    let requests = 0
    await page.route('**/art/cards-detailed.webp', route => ++requests === 1 ? route.fulfill({ status: 503, body: 'Temporarily unavailable' }) : route.continue())
    const errors = await boot(page)
    const acquire = (id: string) => page.evaluate(async id => {
        const path = '/src/ui/art/cards.ts', { acquireCardArt } = await import(path)
        const game = window.__testGame
        const releases = game.registry.get('art-test-releases') ?? []
        releases.push(acquireCardArt(game.scene.getScene('MainMenu'), id, () => game.registry.set(`art-ready:${id}`, true)))
        game.registry.set('art-test-releases', releases)
    }, id)
    const failed = page.waitForResponse(response => response.url().endsWith('/art/cards-detailed.webp') && response.status() === 503)
    await acquire('STRIKE'); await failed
    await page.waitForTimeout(100)
    await acquire('BASH'); await acquire('ZAP')
    expect(requests).toBe(1)
    expect(await page.evaluate(() => window.__testGame.textures.exists('card-art:STRIKE'))).toBe(false)
    await page.waitForTimeout(1100)
    expect(requests).toBe(1)
    await acquire('ERUPTION')
    await page.waitForFunction(() => ['STRIKE', 'BASH', 'ZAP', 'ERUPTION'].every(id => window.__testGame.registry.get(`art-ready:${id}`)))
    expect(requests).toBe(2)
    await page.evaluate(() => { for (const release of window.__testGame.registry.get('art-test-releases')) release() })
    expect(errors).toEqual([])
})

test('destroying cards or the game during a sheet request releases pending work', async ({ page }) => {
    let resume!: () => void
    const held = new Promise<void>(resolve => { resume = resolve })
    let requested!: () => void
    const request = new Promise<void>(resolve => { requested = resolve })
    let requests = 0
    await page.route('**/art/cards-detailed.webp', async route => { requests++; requested(); await held; await route.continue().catch(() => {}) })
    const errors = await boot(page)
    await page.evaluate(async () => {
        const cardPath = '/src/ui/Card.ts', corePath = '/src/core/cards.ts'
        const { Card } = await import(cardPath), { createCardInstance } = await import(corePath)
        const scene = window.__testGame.scene.getScene('MainMenu')
        const card = new Card(scene, createCardInstance('STRIKE'), { x: 0, y: 0 }) as Card
        card.destroy()
        const live = new Card(scene, createCardInstance('ZAP'), { x: 20, y: 100 }) as Card
        scene.add.existing(live)
    })
    await request; resume()
    await page.waitForFunction(() => window.__testGame.textures.exists('card-art:ZAP'))
    expect(requests).toBe(1)
    expect(await page.evaluate(() => window.__testGame.textures.exists('card-art:STRIKE'))).toBe(false)

    let releaseLate!: () => void
    const late = new Promise<void>(resolve => { releaseLate = resolve })
    let lateRequested!: () => void
    const pending = new Promise<void>(resolve => { lateRequested = resolve })
    await page.route('**/art/cards-01.webp', async route => { lateRequested(); await late; await route.continue().catch(() => {}) })
    await page.evaluate(async () => {
        const cardPath = '/src/ui/Card.ts', corePath = '/src/core/cards.ts'
        const { Card } = await import(cardPath), { createCardInstance } = await import(corePath)
        const scene = window.__testGame.scene.getScene('MainMenu')
        scene.add.existing(new Card(scene, createCardInstance('BLOOD_FOR_BLOOD'), { x: 200, y: 100 }))
    })
    await pending
    await page.evaluate(() => window.__testGame.destroy(true))
    await expect(page.locator('canvas')).toHaveCount(0)
    releaseLate()
    await page.waitForTimeout(100)
    expect(errors).toEqual([])
})
