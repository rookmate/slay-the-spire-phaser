import Phaser from 'phaser'

export class BootScene extends Phaser.Scene {
    constructor() {
        super('Boot')
    }

    preload(): void {
        // Placeholder: could load assets here
    }

    create(): void {
        this.scene.start('Combat')
    }
}


