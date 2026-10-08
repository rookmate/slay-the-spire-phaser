import Phaser from 'phaser'
import { loadSettings, saveSettings } from '../core/settings'
import { menuButton, menuText } from '../ui/menu'
import { playCue } from '../ui/sound'
export class SettingsScene extends Phaser.Scene {
    constructor() { super('Settings') }
    create(): void { this.render() }
    private render(): void {
        this.children.removeAll(true)
        const settings = loadSettings()
        this.add.text(24, 24, 'Settings', { ...menuText, fontSize: '26px' })
        menuButton(this, 24, 90, `Sound: ${settings.sound ? 'on' : 'off'}`, () => { settings.sound = !settings.sound; saveSettings(settings); playCue('card'); this.render() })
        this.add.text(24, 150, `Volume: ${Math.round(settings.volume * 100)}%`, menuText)
        menuButton(this, 225, 139, '-', () => { settings.volume = Math.max(0, settings.volume - 0.1); saveSettings(settings); this.render() })
        menuButton(this, 275, 139, '+', () => { settings.volume = Math.min(1, settings.volume + 0.1); saveSettings(settings); playCue('card'); this.render() })
        menuButton(this, 24, 199, `Reduced motion: ${settings.reducedMotion ? 'on' : 'off'}`, () => { settings.reducedMotion = !settings.reducedMotion; saveSettings(settings); this.render() })
        this.add.text(24, 270, 'Combat controls\n1–0: select a card   E: end turn   Escape: cancel\nSelect an enemy to confirm a targeted card or potion.\nDrag a card upward or onto an enemy to play it.', { ...menuText, lineSpacing: 10 })
        menuButton(this, 24, 399, 'Back', () => this.scene.start('MainMenu'))
    }
}
