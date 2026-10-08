import type Phaser from 'phaser'
import type { Act } from '../core/acts'

/** Quiet scenery stays behind the combat information and never uses gameplay RNG. */
export function drawBattlefield(scene: Phaser.Scene, act: Act): Phaser.GameObjects.Graphics {
    const palettes = { 1: [0x242321, 0x33312a, 0x665943], 2: [0x232827, 0x303937, 0x6b745c], 3: [0x27232e, 0x373143, 0x7d6c83], 4: [0x2d2129, 0x422d38, 0x875365] } as const
    const [background, stone, detail] = palettes[act]
    const g = scene.add.graphics().setDepth(-20), { width, height } = scene.scale
    g.fillStyle(background).fillRect(0, 0, width, height)
    g.fillStyle(stone, 0.55)
    for (let i = 0; i < 6; i++) {
        const x = 12 + i * 148
        g.fillRect(x, 42, 16, 152); g.fillRect(x - 5, 180, 26, 14)
        g.lineStyle(3, stone, 0.8).beginPath().moveTo(x + 16, 92).lineTo(x + 50, 52).lineTo(x + 80, 44).lineTo(x + 130, 92).strokePath()
    }
    g.fillStyle(stone, 0.35).fillRect(0, 184, width, 25)
    g.lineStyle(1, detail, 0.25).lineBetween(0, 184, width, 184)
    for (let i = 0; i < 8; i++) g.lineBetween(i * 112, 184, i * 112 - 30, 207)
    g.fillStyle(0x151416, 0.8).fillRect(0, 0, width, 44).fillRect(0, height - 46, width, 46)
    return g
}
