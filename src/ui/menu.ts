import { bindAction } from './accessibility'
import type Phaser from 'phaser'
import { bodyText, palette } from './theme'
export const menuText = bodyText
export function menuButton(scene: Phaser.Scene, x: number, y: number, label: string, action: () => void, enabled = true, options: { primary?: boolean; width?: number; quiet?: boolean; description?: string } = {}): Phaser.GameObjects.Text {
    const background = options.quiet ? '#151512' : options.primary ? '#a8643c' : '#353126'
    const button = scene.add.text(x, y, label, { ...menuText, fontStyle: 'bold', backgroundColor: background, fixedWidth: options.width ?? 0, align: options.width ? 'center' : 'left', padding: { x: 12, y: 8 } }).setAlpha(enabled ? 1 : 0.38).setResolution(2)
    if (enabled) button.setInteractive({ useHandCursor: true }).on('pointerdown', action)
        .on('pointerover', () => button.setBackgroundColor(options.primary ? '#c37d4d' : '#4b4130').setColor(palette.text))
        .on('pointerout', () => button.setBackgroundColor(background).setColor(palette.text))
    bindAction(button, action, { label: options.description ?? label, enabled: () => enabled, persistent: label === 'Menu' })
    return button
}
