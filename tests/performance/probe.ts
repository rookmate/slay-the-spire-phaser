import type { Page } from '@playwright/test'
import type { Card } from '../../src/ui/Card'
import type { EmittedEvent } from '../../src/core/actions'

export async function startProbe(page: Page) {
    await page.evaluate(() => {
        const game = window.__testGame
        const scene = game.scene.getScene('Combat') as unknown as {
            ui: { apply: (events: EmittedEvent[]) => void; handManager: { getHandCards: () => Card[] } }
        }
        const samples = { applies: [] as number[], replacements: 0, frameWork: [] as number[], frameIntervals: [] as number[], longTasks: [] as number[], interactions: {} as Record<number, number> }
        const apply = scene.ui.apply
        scene.ui.apply = function(events) {
            const before = new Map(this.handManager.getHandCards().map(card => [card.getCardInstance().instanceId, card]))
            const start = performance.now()
            apply.call(this, events)
            samples.applies.push(performance.now() - start)
            for (const card of this.handManager.getHandCards()) {
                const old = before.get(card.getCardInstance().instanceId)
                if (old && old !== card) samples.replacements++
            }
        }
        let start = 0, previous = 0
        const pre = () => { start = performance.now(); if (previous) samples.frameIntervals.push(start - previous); previous = start }
        const post = () => samples.frameWork.push(performance.now() - start)
        game.events.on('prestep', pre); game.events.on('postrender', post)
        const tasks = new PerformanceObserver(list => list.getEntries().forEach(entry => samples.longTasks.push(entry.duration)))
        tasks.observe({ type: 'longtask' })
        const events = new PerformanceObserver(list => list.getEntries().forEach(entry => {
            const event = entry as PerformanceEventTiming
            if (event.interactionId) samples.interactions[event.interactionId] = Math.max(samples.interactions[event.interactionId] ?? 0, entry.duration)
        }))
        events.observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit)
        window.__performanceProbe = () => {
            scene.ui.apply = apply; game.events.off('prestep', pre); game.events.off('postrender', post)
            tasks.disconnect(); events.disconnect()
            return samples
        }
    })
}
export type Samples = { applies: number[]; replacements: number; frameWork: number[]; frameIntervals: number[]; longTasks: number[]; interactions: Record<number, number> }
declare global {
    interface Window { __performanceProbe: () => Samples }
    interface PerformanceEventTiming { readonly interactionId: number }
}
export function percentile(values: number[], p: number): number {
    if (!values.length) return 0
    return [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]
}
