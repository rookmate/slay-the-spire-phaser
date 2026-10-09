import { expect, test } from '@playwright/test'
import type Phaser from 'phaser'
import type { Card } from '../../src/ui/Card'
import type { Engine } from '../../src/core/engine'
import { createNewRun } from '../../src/core/run'
import { createCardInstance } from '../../src/core/cards'
import { boot, inspect } from './driver'

test.use({ hasTouch: true })

test('every base and upgraded card keeps its complete text within the card', async ({ page }) => {
    test.setTimeout(120_000)
    // This test measures typography; artwork coverage lives in card-art.spec.ts.
    await page.route('**/art/cards-*.webp', route => route.abort())
    const errors = await boot(page)
    const result = await page.evaluate(async () => {
        const cardPath = '/src/ui/Card.ts', corePath = '/src/core/cards.ts', textPath = '/src/core/cardText.ts'
        const { Card } = await import(cardPath), { CARD_DEFS, createCardInstance, canUpgradeCard, resolveCard } = await import(corePath)
        const { cardDescription } = await import(textPath)
        const scene = window.__testGame.scene.getScene('MainMenu')
        const variants = Object.keys(CARD_DEFS).flatMap(id => {
            const base = createCardInstance(id)
            return canUpgradeCard(base) ? [base, createCardInstance(id, 1)] : [base]
        })
        variants.push(createCardInstance('SEARING_BLOW', 123))
        for (const id of ['LESSON_LEARNED', 'BLIZZARD', 'FORETHOUGHT', 'TRANSMUTATION']) variants.push({ ...createCardInstance(id, 1), bottled: true })
        const failures: unknown[] = []
        let smallestBody = 12, smallestTitle = 13
        for (const instance of variants) {
            const card = new Card(scene, instance, { x: 0, y: 0, locked: true }) as Card
            const [title, , type, body, hint, inspect] = card.list.filter(child => child.type === 'Text') as Phaser.GameObjects.Text[]
            const expected = cardDescription(instance).replace(/\n/g, ' '), name = resolveCard(instance).name
            const inside = title.x >= 8 && title.x + title.displayWidth <= 90.01 && title.y >= 3.99 && title.y + title.displayHeight <= 32.01
                && type.y + type.displayHeight <= body.y && body.x + body.displayWidth <= 110.01 && body.y + body.displayHeight <= 165.01
                && hint.y >= 166 && inspect.y >= 166 && inspect.y + inspect.displayHeight <= 180
            if (!inside || body.text !== expected || title.text !== name || title.getWrappedText().map(line => line.trim()).join(' ') !== name
                || body.scaleX !== 1 || title.scaleX !== 1 || parseFloat(String(body.style.fontSize)) < 10) {
                failures.push({ name, expected, actual: body.text, titleLines: title.getWrappedText(), body: [body.width, body.height, body.scaleX, body.style.fontSize], title: [title.width, title.height, title.scaleX], inside })
            }
            smallestBody = Math.min(smallestBody, parseFloat(String(body.style.fontSize)))
            smallestTitle = Math.min(smallestTitle, parseFloat(String(title.style.fontSize)))
            card.destroy()
        }
        return { failures, variants: variants.length, smallestBody, smallestTitle }
    })
    expect(result.failures).toEqual([])
    expect(result.variants).toBeGreaterThan(725)
    expect(result.smallestBody).toBeGreaterThanOrEqual(10)
    expect(errors).toEqual([])
})

test('refresh restores larger text and long cards remain inspectable at shop scale on a phone', async ({ page }) => {
    const errors = await boot(page)
    const result = await page.evaluate(async () => {
        const cardPath = '/src/ui/Card.ts', corePath = '/src/core/cards.ts'
        const { Card } = await import(cardPath), { createCardInstance } = await import(corePath)
        const scene = window.__testGame.scene.getScene('MainMenu')
        for (const child of [...scene.children.list]) child.destroy()
        scene.add.rectangle(0, 0, 800, 450, 0x24231e).setOrigin(0)
        const card = new Card(scene, createCardInstance('LESSON_LEARNED', 1), { x: 30, y: 100, scale: 0.70 }) as Card
        scene.add.existing(card)
        const texts = () => card.list.filter(child => child.type === 'Text') as Phaser.GameObjects.Text[]
        const longSize = parseFloat(String(texts()[3].style.fontSize))
        const longTitleSize = parseFloat(String(texts()[0].style.fontSize))
        card.refresh(createCardInstance('STRIKE'))
        const shortSize = parseFloat(String(texts()[3].style.fontSize))
        const shortTitleSize = parseFloat(String(texts()[0].style.fontSize))
        card.refresh(createCardInstance('LESSON_LEARNED', 1))
        const ids = ['FORETHOUGHT', 'BLIZZARD', 'TRANSMUTATION', 'METAMORPHOSIS', 'GENETIC_ALGORITHM']
        for (const [i, id] of ids.entries()) scene.add.existing(new Card(scene, createCardInstance(id, 1), { x: 145 + i * 115, y: 100, scale: 0.70 }))
        return { longSize, shortSize, longTitleSize, shortTitleSize, finalSize: parseFloat(String(texts()[3].style.fontSize)) }
    })
    expect(result.longSize).toBeLessThan(result.shortSize)
    expect(result.shortSize).toBe(12)
    expect(result.shortTitleSize).toBeGreaterThan(result.longTitleSize)
    expect(result.finalSize).toBe(result.longSize)
    await page.waitForFunction(() => ['LESSON_LEARNED', 'FORETHOUGHT', 'BLIZZARD', 'TRANSMUTATION', 'METAMORPHOSIS', 'GENETIC_ALGORITHM'].every(id => window.__testGame.textures.exists(`card-art:${id}`)))
    await page.setViewportSize({ width: 844, height: 390 })
    await page.screenshot({ path: 'test-results/card-text-phone.png' })
    const ui = await inspect(page), lesson = ui.cards.find(card => card.defId === 'LESSON_LEARNED')!
    await page.touchscreen.tap(ui.canvas.x + (lesson.x + lesson.width * 110 / 120) * ui.canvas.scaleX,
        ui.canvas.y + (lesson.y + lesson.height * 170 / 180) * ui.canvas.scaleY)
    const detail = (await inspect(page)).texts.filter(text => text.depth === 5900)
    expect(detail.some(text => text.text.includes('permanently upgrade') && text.text.includes('Exhaust.'))).toBe(true)
    for (const text of detail) { expect(text.y).toBeGreaterThanOrEqual(0); expect(text.y + text.height).toBeLessThanOrEqual(450) }
    await page.keyboard.press('Escape')
    expect(errors).toEqual([])
})

test('target previews keep complete rules and fit large damage values', async ({ page }) => {
    const run = createNewRun({ seed: 'card-text-preview' }); run.neowCompleted = true
    run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    run.deck = Array.from({ length: 5 }, () => createCardInstance('LESSON_LEARNED', 1))
    const errors = await boot(page, run)
    const result = await page.evaluate(async () => {
        const path = '/src/core/cardText.ts', { cardDescription } = await import(path)
        const scene = window.__testGame.scene.getScene('Combat') as Phaser.Scene & { engine: Engine }
        const findCard = (children: Phaser.GameObjects.GameObject[]): Card | undefined => {
            for (const child of children) {
                if ('getCardInstance' in child) return child as Card
                if (child.type === 'Container') { const found = findCard((child as Phaser.GameObjects.Container).list); if (found) return found }
            }
        }
        const card = findCard(scene.children.list)!
        const engine = scene.engine, target = engine.state.enemies[0].id
        engine.state.player.powers.push({ id: 'STRENGTH', stacks: 123456789 })
        card.setCombatPreview(engine, target)
        const texts = card.list.filter(child => child.type === 'Text') as Phaser.GameObjects.Text[], body = texts[3]
        return { text: body.text, expected: cardDescription(card.getCardInstance(), engine, target).replace(/\n/g, ' '), width: body.displayWidth, height: body.displayHeight, effectiveSize: parseFloat(String(body.style.fontSize)) * body.scaleY }
    })
    expect(result.text).toBe(result.expected)
    expect(result.text).toContain('Exhaust.')
    expect(result.width).toBeLessThanOrEqual(100)
    expect(result.height).toBeLessThanOrEqual(60)
    expect(result.effectiveSize).toBeGreaterThanOrEqual(9)
    expect(errors).toEqual([])
})
