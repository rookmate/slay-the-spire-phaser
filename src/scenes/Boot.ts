import { loadCharacterPortraits } from '../ui/portraits'
import { loadEnemyPortraits } from '../ui/art/enemies'
import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
    constructor() { super('Boot') }
    preload(): void {
        loadCharacterPortraits(this)
        loadEnemyPortraits(this)
    }
    create(): void { this.scene.start('MainMenu') }
}
