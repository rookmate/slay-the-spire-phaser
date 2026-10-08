import type Phaser from 'phaser'
export const menuText = { fontFamily: 'monospace', fontSize: '16px', color: '#ddd' }
export function menuButton(scene: Phaser.Scene, x: number, y: number, label: string, action: () => void, enabled = true): Phaser.GameObjects.Text {
    const button = scene.add.text(x, y, label, { ...menuText, backgroundColor: '#333333', padding: { x: 10, y: 8 } }).setAlpha(enabled ? 1 : 0.4)
    if (enabled) button.setInteractive({ useHandCursor: true }).on('pointerdown', action)
    return button
}
