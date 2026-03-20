import Phaser from 'phaser'
import { createNewRun, loadRun, saveRun, /*type RunState */ } from '../core/run'
import { /*getDailySeed, */loadMeta } from '../core/meta'

export class MainMenuScene extends Phaser.Scene {
    constructor() { super('MainMenu') }

    create(): void {
        const style = { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' }
        const meta = loadMeta()
        this.add.text(16, 16, 'Slay the Spire (Phaser) - Main Menu', style)
        this.add.text(16, 50, `Ascension unlocked: ${meta.bestAscensionUnlocked}`, style)

        this.add.text(16, 100, 'Continue', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                const run = loadRun()
                if (!run) return
                if (run.bossRelicChoicePending) this.scene.start('BossRelic', { run })
                else if (!run.neowCompleted) this.scene.start('Neow', { run })
                else this.scene.start('Map', { run })
            })

        this.add.text(16, 140, 'New Run (A0)', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                const run = createNewRun()
                saveRun(run)
                this.scene.start('Neow', { run })
            })

        // this.add.text(16, 180, 'Daily Run', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
        //     .setInteractive({ useHandCursor: true })
        //     .on('pointerdown', () => {
        //         const run = createNewRun(getDailySeed())
        //         saveRun(run)
        //         this.scene.start('Map', { run })
        //     })

        // // Quick Ascension toggle (A0/A1)
        // const ascLabel = this.add.text(16, 220, 'Ascension: 0', style)
        // let ascension = 0
        // this.add.text(200, 216, '(click to increase)', { fontFamily: 'monospace', fontSize: '14px', color: '#aaa' })
        //     .setInteractive({ useHandCursor: true })
        //     .on('pointerdown', () => {
        //         ascension = (ascension + 1) % (meta.bestAscensionUnlocked + 2)
        //         ascLabel.setText(`Ascension: ${ascension}`)
        //     })
        // this.add.text(16, 260, 'New Run (Ascension)', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
        //     .setInteractive({ useHandCursor: true })
        //     .on('pointerdown', () => {
        //         const run = createNewRun()
        //             // stash ascension in run via gold field hack for simplicity (or extend RunState)
        //             ; (run as RunState & { asc?: number }).asc = ascension
        //         saveRun(run)
        //         this.scene.start('Map', { run })
        //     })

        this.add.text(16, 300, 'Card Library', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                const run = loadRun() ?? createNewRun()
                saveRun(run)
                this.scene.start('DeckBuilder', { run })
            })
    }
}

