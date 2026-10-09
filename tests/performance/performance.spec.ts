import { expect, test, type TestInfo } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { createCardInstance } from '../../src/core/cards'
import { createNewRun } from '../../src/core/run'
import { clickText, inspect, playCardWithKeyboard } from '../browser/driver'
import { percentile, startProbe, type Samples } from './probe'

const baseline = process.env.PERFORMANCE_BASELINE === '1'
const enforceTiming = process.env.PERFORMANCE_TIMING === '1'
const fixtureUrl = 'http://127.0.0.1:5191/tests/browser/'

async function saveSamples(testInfo: TestInfo, name: string, samples: unknown) {
    const path = testInfo.outputPath(name)
    await writeFile(path, JSON.stringify(samples, null, 2))
    await testInfo.attach(name, { path, contentType: 'application/json' })
}

test('shipping build cold menu readiness under a defined mobile lab profile', async ({ browser }, testInfo) => {
    const runs = []
    for (let repeat = 0; repeat < 3; repeat++) {
        const context = await browser.newContext({ viewport: { width: 844, height: 390 } }), page = await context.newPage()
        const cdp = await context.newCDPSession(page)
        await cdp.send('Network.enable')
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 10_000_000 / 8, uploadThroughput: 1_000_000 / 8 })
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        await page.goto('http://127.0.0.1:5190/')
        await page.waitForFunction(() => performance.getEntriesByName('spire:menu-ready').length > 0)
        runs.push(await page.evaluate(() => ({ readyMs: performance.getEntriesByName('spire:menu-ready')[0].startTime,
            resources: performance.getEntriesByType('resource').map(entry => { const r = entry as PerformanceResourceTiming; return { url: new URL(r.name).pathname, encodedBytes: r.encodedBodySize, decodedBytes: r.decodedBodySize } }) })))
        await context.close()
    }
    await saveSamples(testInfo, 'cold-start.json', { browser: browser.version(), profile: 'Chromium, 4x CPU, 10Mbps down, 40ms latency, cold cache; local Vite preview does not gzip JS', runs })
    console.log(JSON.stringify({ coldMenuReadyP75: percentile(runs.map(run => run.readyMs), 0.75) }))
})

test('dense combat keeps surviving views and stays responsive in a minified fixture', async ({ browser }, testInfo) => {
    const runs: Samples[] = []
    for (let repeat = 0; repeat < 3; repeat++) {
        const context = await browser.newContext({ viewport: { width: 844, height: 390 } }), page = await context.newPage()
        const run = createNewRun({ seed: `performance-${repeat}`, character: 'silent' })
        run.neowCompleted = true
        run.deck = Array.from({ length: 10 }, () => createCardInstance('BACKSTAB'))
        run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
        run.eventCombat = { enemies: ['TRANSIENT', 'TRANSIENT', 'TRANSIENT', 'TRANSIENT', 'TRANSIENT'], rewards: { tier: 'hallway', items: [] } }
        await context.addInitScript(saved => localStorage.setItem('sts_run_v7', JSON.stringify(saved)), run)
        await page.goto(fixtureUrl)
        await page.waitForFunction(() => window.__testGame?.scene.isActive('MainMenu'))
        await clickText(page, 'Continue')
        const initial = await inspect(page)
        expect(initial.state!.player.hand).toHaveLength(10)
        const cdp = await context.newCDPSession(page)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        await page.waitForTimeout(300)
        await startProbe(page)
        for (const card of initial.state!.player.hand) await playCardWithKeyboard(page, card.instanceId, 0)
        await page.waitForTimeout(500)
        runs.push(await page.evaluate(() => window.__performanceProbe()))
        await context.close()
    }
    const summary = {
        refreshes: runs.map(run => run.applies.length), replacements: runs.map(run => run.replacements),
        uiApplyP95: percentile(runs.flatMap(run => run.applies), 0.95), frameWorkP95: percentile(runs.flatMap(run => run.frameWork), 0.95),
        frameIntervalP95: percentile(runs.flatMap(run => run.frameIntervals), 0.95),
        observedInteractionP95: percentile(runs.flatMap(run => Object.values(run.interactions)), 0.95),
        longTasks: runs.flatMap(run => run.longTasks),
    }
    console.log(JSON.stringify(summary))
    await saveSamples(testInfo, 'combat-performance.json', { browser: browser.version(), profile: 'Minified fixture, Chromium, 844x390, 4x CPU; three ten-card/five-enemy fights', summary, runs })
    if (!baseline) {
        expect(summary.refreshes).toEqual([10, 10, 10])
        expect(summary.replacements).toEqual([0, 0, 0])
    }
    if (enforceTiming) {
        // Discrete input work and animated frames have different budgets. Shared
        // CI hardware reports timings; enforce these on the documented lab host.
        expect(summary.uiApplyP95).toBeLessThanOrEqual(50)
        expect(summary.frameWorkP95).toBeLessThanOrEqual(10)
        expect(summary.observedInteractionP95).toBeLessThanOrEqual(200)
    }
})
