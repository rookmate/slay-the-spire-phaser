import { describe, expect, it } from 'vitest'
import { CARD_SIZE, combatLayout, enemySlots, handPositions } from './layout'

describe('combat layout bounds', () => {
    for (const count of [1, 5, 10, 15]) {
        it(`keeps a ${count}-card hand accessible above the controls, including hover`, () => {
            for (const hovered of [null, 0, Math.floor(count / 2), count - 1]) {
                const positions = handPositions(800, 450, count, hovered)
                positions.forEach((position, index) => {
                    expect(position.x).toBeGreaterThanOrEqual(16)
                    expect(position.x + CARD_SIZE.width).toBeLessThanOrEqual(784)
                    expect(position.y + CARD_SIZE.height).toBeLessThan(combatLayout(800, 450).footerTop)
                    if (index > 0) expect(position.x).toBeGreaterThan(positions[index - 1].x)
                })
            }
        })
    }
    it('gives each of five enemies a distinct slot above the hand', () => {
        const slots = enemySlots(800, 450, 5)
        slots.forEach((slot, index) => {
            expect(slot.x - slot.width / 2).toBeGreaterThanOrEqual(240)
            expect(slot.x + slot.width / 2).toBeLessThanOrEqual(784)
            expect(slot.y + slot.height).toBeLessThan(handPositions(800, 450, 5, 0)[0].y)
            if (index > 0) expect(slot.x - slot.width / 2).toBeGreaterThan(slots[index - 1].x + slots[index - 1].width / 2)
        })
    })
})
