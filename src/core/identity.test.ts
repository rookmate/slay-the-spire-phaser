import { afterEach, expect, it, vi } from 'vitest'
import { createIdentity } from './identity'
import { createNewRun } from './run'
import { createCardInstance } from './cards'

afterEach(() => vi.unstubAllGlobals())
it('uses random bytes when HTTP disables the UUID convenience API', () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto)
    vi.stubGlobal('crypto', { getRandomValues })
    const first = createNewRun({ seed: 'http-preview' }), second = createNewRun({ seed: 'http-preview' })
    expect(first.runId).toMatch(/^[0-9a-f]{32}$/); expect(first.runId).not.toBe(second.runId)
    expect(createCardInstance('STRIKE').instanceId).toMatch(/^strike-[0-9a-f]{32}$/)
    expect(new Set(Array.from({ length: 100 }, createIdentity)).size).toBe(100)
})
it('keeps a unique sequence when crypto is entirely unavailable', () => {
    vi.stubGlobal('crypto', undefined)
    expect(new Set(Array.from({ length: 100 }, createIdentity)).size).toBe(100)
})
