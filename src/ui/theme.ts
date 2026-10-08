import type Phaser from 'phaser'

export const UI_FONT = 'Barlow, sans-serif'
export const DISPLAY_FONT = 'Barlow Condensed, sans-serif'
export const palette = {
    ink: 0x151512, surface: 0x24231e, line: 0x5a4e3a, copper: 0xbd8153,
    paper: 0xe6d8b9, text: '#f0e7d3', muted: '#b4aa94', gold: '#dfbd7f',
} as const
export const bodyText = { resolution: 2, fontFamily: UI_FONT, fontSize: '16px', color: palette.text }
export const headingText = { resolution: 2, fontFamily: DISPLAY_FONT, fontSize: '28px', fontStyle: 'bold', color: palette.text }

/** Decoration belongs to the scene and is rebuilt with its other display objects. */
export function roomBackdrop(scene: Phaser.Scene, illustration = 'art:spire'): void {
    const { width, height } = scene.scale
    scene.add.rectangle(0, 0, width, height, palette.ink).setOrigin(0).setDepth(-100)
    if (scene.textures.exists(illustration)) scene.add.image(width / 2, height / 2, illustration).setDisplaySize(width, height).setAlpha(0.23).setDepth(-99)
    const lines = scene.add.graphics().setDepth(-98)
    lines.fillStyle(palette.ink, 0.7).fillRect(0, 0, width, 64).fillRect(0, height - 58, width, 58)
    lines.lineStyle(1, palette.line, 0.55).lineBetween(24, 63, width - 24, 63).lineBetween(24, height - 58, width - 24, height - 58)
}

export async function loadGameFonts(): Promise<void> {
    await Promise.allSettled([
        document.fonts.load('400 16px Barlow'),
        document.fonts.load('600 16px Barlow'),
        document.fonts.load('600 32px "Barlow Condensed"'),
    ])
}
