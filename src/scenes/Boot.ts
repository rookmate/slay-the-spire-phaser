import { installCardArt, loadCardArt } from '../ui/art/cards'
import { installCharacterPortraits, loadCharacterPortraits } from '../ui/portraits'
import { loadEnemyPortraits } from '../ui/art/enemies'
import Phaser from 'phaser'
import { loadGameFonts } from '../ui/theme'

export class BootScene extends Phaser.Scene {
    private fontsReady?: Promise<void>
    constructor() { super('Boot') }
    preload(): void {
        this.fontsReady = loadGameFonts()
        loadCharacterPortraits(this)
        loadEnemyPortraits(this)
        this.load.image('art:spire', '/art/spire.webp')
        this.load.image('art:battle', '/art/battle.webp')
        loadCardArt(this)
    }
    async create(): Promise<void> {
        installCharacterPortraits(this)
        installCardArt(this)
        await this.fontsReady
        if (this.scene.isActive()) this.scene.start('MainMenu')
    }
}
