import { describe, expect, it } from 'vitest'
import { CARD_DEFS } from '../../core/cards'
import { CARD_ART, CARD_ART_SHEETS } from './cardCatalog'

describe('card illustrations', () => {
    it('assigns every card its own source, including curses, statuses, and generated cards', () => {
        expect(Object.keys(CARD_ART).sort()).toEqual(Object.keys(CARD_DEFS).sort())
        const sources = Object.values(CARD_ART).map(source => `${source.file}:${source.x}:${source.y}`)
        expect(new Set(sources).size).toBe(Object.keys(CARD_DEFS).length)
        expect(CARD_ART_SHEETS.flatMap(sheet => [...sheet.cards]).length).toBe(Object.keys(CARD_DEFS).length)
    })
    it('keeps every crop inside its sheet with room for the edge inset', () => {
        for (const source of Object.values(CARD_ART)) {
            expect(source.x).toBeGreaterThan(0); expect(source.y).toBeGreaterThan(0)
            expect(source.width).toBeGreaterThan(0); expect(source.height).toBeGreaterThan(0)
            expect(source.x + source.width).toBeLessThan(1536)
            expect(source.y + source.height).toBeLessThan(768)
        }
    })
})
