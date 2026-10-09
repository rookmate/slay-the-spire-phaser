import { roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { loadSettings, saveSettings } from '../core/settings'
import { menuButton, menuText } from '../ui/menu'
import { playCue } from '../ui/sound'
export class SettingsScene extends Phaser.Scene {
    private returnTo: 'MainMenu' | 'CombatMenu' = 'MainMenu'
    constructor() { super('Settings') }
    create(data: { returnTo?: 'MainMenu' | 'CombatMenu' } = {}): void {
        this.returnTo = data.returnTo ?? 'MainMenu'
        this.scene.bringToTop()
        const escape = (event: KeyboardEvent) => { if (!event.repeat) this.scene.start(this.returnTo) }
        this.input.keyboard?.on('keydown-ESC', escape)
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ESC', escape))
        this.render()
    }
    private render(): void {
        this.children.removeAll(true)
        roomBackdrop(this)
        const settings = loadSettings()
        const change = (action: () => void) => { action(); saveSettings(settings); playCue('card'); this.render() }
        this.add.text(24, 24, 'Settings', { ...menuText, fontSize: '26px' })
        menuButton(this, 24, 90, `Sound: ${settings.sound ? 'on' : 'off'}`, () => change(() => { settings.sound = !settings.sound }))
        const level = (key: 'volume' | 'musicVolume' | 'effectsVolume', label: string, y: number, prefix = '') => {
            this.add.text(24, y + 11, `${label}: ${Math.round(settings[key] * 100)}%`, menuText)
            for (const [x, delta, mark] of [[240, -0.1, '-'], [320, 0.1, '+']] as const)
                menuButton(this, x, y, `${prefix}${mark}`, () => change(() => { settings[key] = Math.max(0, Math.min(1, Math.round((settings[key] + delta) * 100) / 100)) }))
        }
        level('volume', 'Volume', 139)
        menuButton(this, 24, 199, `Music: ${settings.music ? 'on' : 'off'}`, () => change(() => { settings.music = !settings.music }))
        level('musicVolume', 'Music level', 246, 'Music ')
        level('effectsVolume', 'Effects level', 296, 'FX ')
        menuButton(this, 24, 346, `Reduced motion: ${settings.reducedMotion ? 'on' : 'off'}`, () => change(() => { settings.reducedMotion = !settings.reducedMotion }))
        this.add.text(440, 90, 'Combat controls\n\n1–0: select a card\nAlt + 1–0: inspect a card\nE: end turn\nEscape: cancel\n\nSelect an enemy to confirm.\nDrag a card upward to play it.\nHover or tap ? for full rules.', { ...menuText, fontSize: '14px', lineSpacing: 8 })
        if (this.returnTo === 'MainMenu') menuButton(this, 440, 346, 'Profile backup', () => this.scene.start('Profile'))
        menuButton(this, 24, 399, 'Back', () => this.scene.start(this.returnTo))
    }
}
