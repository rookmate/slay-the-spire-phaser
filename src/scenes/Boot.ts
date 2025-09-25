import Phaser from 'phaser'
// import { createNewRun, loadRun, saveRun } from '../core/run'

export class BootScene extends Phaser.Scene {
    constructor() {
        super('Boot')
    }

    preload(): void {
        // Placeholder: could load assets here
    }

    create(): void {
        // Go to Main Menu first
        this.scene.start('MainMenu')
    }
}


