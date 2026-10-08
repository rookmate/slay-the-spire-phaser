import type Phaser from 'phaser'
import type { Act } from '../core/acts'
import { palette } from './theme'

/** Art and act tint stay behind the battlefield and never consume gameplay RNG. */
export function drawBattlefield(scene: Phaser.Scene, act: Act): Phaser.GameObjects.Graphics {
    const { width, height } = scene.scale
    if (scene.textures.exists('art:battle')) scene.add.image(width / 2, height / 2, 'art:battle').setDisplaySize(width, height).setDepth(-20)
    const g = scene.add.graphics().setDepth(-19)
    const tint = { 1: 0x291d12, 2: 0x13332b, 3: 0x312137, 4: 0x471821 }[act]
    g.fillStyle(tint, 0.18).fillRect(0, 0, width, height)
    g.fillStyle(palette.ink, 0.94).fillRect(0, 0, width, 39).fillRect(0, height - 46, width, 46)
    g.lineStyle(1, palette.line, 0.8).lineBetween(16, 39, width - 16, 39).lineBetween(16, height - 46, width - 16, height - 46)
    return g
}
