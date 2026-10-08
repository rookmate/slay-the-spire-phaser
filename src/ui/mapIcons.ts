import type Phaser from 'phaser'
import type { RoomKind } from '../core/map'

/** Small ink symbols remain sharp at every canvas scale. */
export function drawMapIcon(g: Phaser.GameObjects.Graphics, kind: RoomKind, x: number, y: number, color: number): void {
    g.lineStyle(1.6, color, 1).fillStyle(color, 1)
    if (kind === 'monster' || kind === 'elite') {
        g.lineBetween(x - 7, y - 8, x + 7, y + 8).lineBetween(x + 7, y - 8, x - 7, y + 8)
        g.lineBetween(x - 8, y + 3, x - 3, y + 8).lineBetween(x + 3, y + 8, x + 8, y + 3)
        if (kind === 'elite') g.strokeCircle(x, y - 1, 11)
    } else if (kind === 'rest') {
        g.strokeTriangle(x, y - 11, x - 7, y + 4, x + 7, y + 4)
        g.lineBetween(x - 9, y + 8, x + 9, y + 8).lineBetween(x, y - 1, x - 2, y + 4)
    } else if (kind === 'shop') {
        g.strokeRoundedRect(x - 8, y - 3, 16, 13, 3).strokeTriangle(x - 5, y - 10, x + 5, y - 10, x, y - 3)
        g.fillCircle(x, y + 3, 2)
    } else if (kind === 'chest') {
        g.strokeRect(x - 9, y - 5, 18, 14).lineBetween(x - 9, y, x + 9, y).fillRect(x - 2, y - 2, 4, 5)
    } else if (kind === 'boss') {
        g.beginPath().moveTo(x - 10, y - 7).lineTo(x - 5, y - 1).lineTo(x, y - 11).lineTo(x + 5, y - 1).lineTo(x + 10, y - 7).lineTo(x + 7, y + 7).lineTo(x - 7, y + 7).closePath().strokePath()
    } else if (kind === 'unknown') {
        g.beginPath().moveTo(x - 5, y - 6).lineTo(x - 2, y - 10).lineTo(x + 5, y - 8).lineTo(x + 5, y - 3).lineTo(x, y + 1).lineTo(x, y + 4).strokePath().fillCircle(x, y + 9, 1.5)
    } else g.strokeCircle(x, y, 5)
}
