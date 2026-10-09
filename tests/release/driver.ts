import { expect, type Page } from '@playwright/test'

export const scene = (page: Page, name: string) => page.locator(`.game-access[data-scene="${name}"]:not([hidden])`)
export const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' })
export async function activate(page: Page, name: string | RegExp): Promise<void> { await button(page, name).first().press('Enter') }
async function controlCenter(page: Page, name: string | RegExp) {
    await button(page, name).first().focus()
    // The production focus outline follows the rendered canvas control's bounds.
    const ring = page.locator('.game-access:not([hidden]) .access-focus:not([hidden])')
    await expect(ring).toBeVisible()
    const bounds = (await ring.boundingBox())!
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}
export async function tap(page: Page, name: string | RegExp): Promise<void> {
    const point = await controlCenter(page, name)
    await page.touchscreen.tap(point.x, point.y)
}
export async function touchDrag(page: Page, fromName: RegExp, toName: RegExp): Promise<void> {
    const from = await controlCenter(page, fromName), to = await controlCenter(page, toName)
    // Playwright has native taps but no common touch-drag API across these engines.
    // Dispatch the DOM touch sequence through the shipped canvas input handler.
    await page.evaluate(async ({ from, to }) => {
        const canvas = document.querySelector('canvas')!
        const dispatch = (type: string, x: number, y: number) => {
            const touch = { identifier: 7, target: canvas, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y }
            const touches = type === 'touchend' ? [] : [touch]
            const event = new Event(type, { bubbles: true, cancelable: true })
            Object.assign(event, { touches, targetTouches: touches, changedTouches: [touch] })
            canvas.dispatchEvent(event)
        }
        dispatch('touchstart', from.x, from.y)
        for (let step = 1; step <= 5; step++) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
            dispatch('touchmove', from.x + (to.x - from.x) * step / 5, from.y + (to.y - from.y) * step / 5)
        }
        dispatch('touchend', to.x, to.y)
    }, { from, to })
}
export function watch(page: Page) {
    const errors: string[] = [], missing: string[] = [], resources: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('requestfailed', request => missing.push(`${request.failure()?.errorText} ${request.url()}`))
    page.on('response', response => {
        resources.push(response.url())
        if (response.status() >= 400) missing.push(`${response.status()} ${response.url()}`)
    })
    return { errors, missing, resources }
}
export async function open(page: Page): Promise<void> {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(scene(page, 'MainMenu')).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible()
    expect(await page.evaluate(() => '__testGame' in window)).toBe(false)
    expect(await page.locator('script[src^="/assets/"]').count()).toBe(1)
    expect(await page.locator('script[src*="/@vite/client"]').count()).toBe(0)
}
export async function downloadProfile(page: Page, touch = false) {
    const pending = page.waitForEvent('download')
    if (touch) await tap(page, 'Export profile'); else await activate(page, 'Export profile')
    const download = await pending, stream = await download.createReadStream(), chunks = []
    for await (const chunk of stream!) chunks.push(chunk)
    return { name: download.suggestedFilename(), buffer: Buffer.concat(chunks) }
}
