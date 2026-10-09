import Phaser from 'phaser'
import { menuButton, menuText } from '../ui/menu'
import { headingText, palette } from '../ui/theme'

/** The paused Combat scene owns the live fight; its entry save stays untouched. */
export class CombatMenuScene extends Phaser.Scene {
    constructor() { super('CombatMenu') }

    create(): void {
        this.scene.bringToTop()
        this.add.rectangle(0, 0, 800, 450, palette.ink, 0.9).setOrigin(0).setInteractive()
        this.add.text(400, 76, 'Paused', headingText).setOrigin(0.5)
        menuButton(this, 290, 126, 'Resume', () => this.resumeCombat(), true, { primary: true, width: 220 })
        menuButton(this, 290, 182, 'Settings', () => this.scene.start('Settings', { returnTo: 'CombatMenu' }), true, { width: 220 })
        menuButton(this, 290, 238, 'Main menu', () => {
            this.scene.stop('Combat')
            this.scene.start('MainMenu')
        }, true, { width: 220 })
        this.add.text(400, 310, 'Resume keeps your current turn.\nLeaving to the main menu will restart this fight on Continue.', {
            ...menuText, fontSize: '14px', color: palette.muted, align: 'center', lineSpacing: 8,
        }).setOrigin(0.5, 0)
        const escape = (event: KeyboardEvent) => { if (!event.repeat) this.resumeCombat() }
        this.input.keyboard?.on('keydown-ESC', escape)
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ESC', escape))
    }

    private resumeCombat(): void {
        this.scene.resume('Combat')
        this.scene.stop()
    }
}
