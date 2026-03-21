import Phaser from 'phaser'
import { createNewRun, loadRun, saveRun, /*type RunState */ } from '../core/run'
import { /*getDailySeed, */getSelectableAscensions, loadMeta } from '../core/meta'
import { IRONCLAD_UNLOCK_TRACK } from '../core/unlocks'
import { getAscensionLabel } from '../core/ascension'

export class MainMenuScene extends Phaser.Scene {
    constructor() { super('MainMenu') }

    create(): void {
        const style = { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' }
        const meta = loadMeta()
        const selectableAscensions = getSelectableAscensions(meta)
        let ascension = selectableAscensions[0] ?? 0
        this.add.text(16, 16, 'Slay the Spire (Phaser) - Main Menu', style)
        this.add.text(16, 50, `Ascension unlocked: ${meta.bestAscensionUnlocked}`, style)
        this.add.text(16, 74, `Ironclad unlock tier: ${meta.ironcladUnlockTier}/${IRONCLAD_UNLOCK_TRACK.length}`, {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#cccccc',
        })

        this.add.text(16, 100, 'Continue', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                const run = loadRun()
                if (!run) return
                if (run.bossRelicChoicePending) this.scene.start('BossRelic', { run })
                else if (!run.neowCompleted) this.scene.start('Neow', { run })
                else this.scene.start('Map', { run })
            })

        this.add.text(16, 140, 'New Run', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                const run = createNewRun(undefined, ascension)
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

        const ascLabel = this.add.text(16, 220, `Ascension: ${getAscensionLabel(ascension)}`, style)
        const updateAscensionLabel = () => ascLabel.setText(`Ascension: ${getAscensionLabel(ascension)}`)
        this.add.text(220, 220, '-', { ...style, backgroundColor: '#333', padding: { x: 10, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                ascension = Math.max(0, ascension - 1)
                updateAscensionLabel()
            })
        this.add.text(270, 220, '+', { ...style, backgroundColor: '#333', padding: { x: 10, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                ascension = Math.min(meta.bestAscensionUnlocked, ascension + 1)
                updateAscensionLabel()
            })

        this.add.text(16, 300, 'Card Library', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                const run = loadRun() ?? createNewRun()
                saveRun(run)
                this.scene.start('DeckBuilder', { run })
            })
    }
}
