import { installCharacterPortraits, loadCharacterPortraits } from '../ui/portraits'
import { loadEnemyPortraits } from '../ui/art/enemies'
import Phaser from 'phaser'
import { loadGameFonts } from '../ui/theme'

export class BootScene extends Phaser.Scene {
    constructor() { super('Boot') }
    preload(): void {
        loadCharacterPortraits(this)
        loadEnemyPortraits(this)
        this.load.image('art:spire', '/art/spire.webp')
        this.load.image('art:battle', '/art/battle.webp')
        this.load.image('art:cards', '/art/cards.webp')
    }
    async create(): Promise<void> {
        installCharacterPortraits(this)
        if (this.textures.exists('art:cards')) {
            const texture = this.textures.get('art:cards'), source = texture.getSourceImage()
            const width = Math.floor(source.width / 3), height = Math.floor(source.height / 2)
            for (let i = 0; i < 6; i++) texture.add(i, 0, i % 3 * width + 4, Math.floor(i / 3) * height + 4, width - 8, height - 8)
        }
        await loadGameFonts()
        if (this.scene.isActive()) this.scene.start('MainMenu')
    }
}
