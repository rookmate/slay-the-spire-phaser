export const CARD_SIZE = { width: 120, height: 180 } as const
export const HAND_HOVER_LIFT = 18

export function mapLayout(width: number, columns: number) {
    const viewport = { x: 246, y: 80, width: width - 270, height: 318, right: width - 24, bottom: 398,
        contains: (x: number, y: number) => x >= 246 && x <= width - 24 && y >= 80 && y <= 398 }
    return { viewport, cellHeight: 64, nodeX: (column: number) => viewport.x + 35 + column * (viewport.width - 70) / Math.max(1, columns - 1) }
}

export function combatLayout(width: number, height: number) {
    const footerTop = height - 46
    const handTop = footerTop - CARD_SIZE.height - 10
    return {
        hand: { x: 16, y: handTop, width: width - 32, height: CARD_SIZE.height },
        battlefield: { x: width * 0.3, y: 48, width: width * 0.7 - 16, height: handTop - 72 },
        footerTop,
        piles: [0, 1].map(index => ({ x: width - 150, y: footerTop + index * 22 })),
    }
}

export function handPositions(width: number, height: number, count: number, hovered: number | null = null) {
    const { hand } = combatLayout(width, height)
    const spacing = count > 1 ? Math.min(CARD_SIZE.width + 8, (hand.width - CARD_SIZE.width) / (count - 1)) : 0
    const startX = (width - CARD_SIZE.width - Math.max(0, count - 1) * spacing) / 2
    return Array.from({ length: count }, (_, index) => ({
        x: Math.max(hand.x, Math.min(width - hand.x - CARD_SIZE.width,
            startX + index * spacing + (hovered === null ? 0 : Math.sign(index - hovered) * 12))),
        y: hand.y - (index === hovered ? HAND_HOVER_LIFT : 0),
    }))
}

export function enemySlots(width: number, height: number, count: number) {
    const area = combatLayout(width, height).battlefield
    const slotWidth = area.width / Math.max(1, count)
    return Array.from({ length: count }, (_, index) => ({
        x: area.x + (index + 0.5) * slotWidth,
        y: area.y,
        width: slotWidth - 8,
        height: area.height,
    }))
}

export function cardGridLayout(width: number, height: number, top: number) {
    const columns = Math.max(1, Math.floor((width - 40) / (CARD_SIZE.width + 12)))
    const rows = Math.max(1, Math.floor((height - top - 68) / (CARD_SIZE.height + 12)))
    return { columns, pageSize: columns * rows, x: 20, y: top, footerY: height - 52 }
}
