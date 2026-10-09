import { describe, expect, it } from 'vitest'
import { CARD_DEFS, createCardInstance, resolveCard } from '../../core/cards'
import { cardArtFrame, ILLUSTRATED_CARDS } from './cards'

describe('card illustrations', () => {
    it('assigns a distinct frame to every illustrated card and retains it on upgrade', () => {
        expect(ILLUSTRATED_CARDS).toHaveLength(32)
        const frames = ILLUSTRATED_CARDS.map(id => {
            expect(CARD_DEFS[id]).toBeDefined()
            const base = createCardInstance(id), upgraded = createCardInstance(id, 1)
            const frame = cardArtFrame(base, resolveCard(base))
            expect(cardArtFrame(upgraded, resolveCard(upgraded))).toBe(frame)
            return frame
        })
        expect(new Set(frames).size).toBe(32)
    })
    it('has a valid atlas frame for every card, including curses, statuses, and colorless cards', () => {
        for (const id of Object.keys(CARD_DEFS)) {
            const card = createCardInstance(id), frame = cardArtFrame(card, resolveCard(card))
            expect(Number.isInteger(frame), id).toBe(true)
            expect(frame, id).toBeGreaterThanOrEqual(0)
            expect(frame, id).toBeLessThan(32)
        }
    })
})
