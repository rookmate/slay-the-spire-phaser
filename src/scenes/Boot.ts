import Phaser from 'phaser'
import { createNewRun, loadRun, saveRun } from '../core/run'

export class BootScene extends Phaser.Scene {
    constructor() {
        super('Boot')
    }

    preload(): void {
        // Placeholder: could load assets here
    }

    create(): void {
        const existing = loadRun()
        const run = existing ?? createNewRun()
        saveRun(run)
        this.scene.start('Map', { run })
    }
}


