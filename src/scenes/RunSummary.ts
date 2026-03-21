import Phaser from 'phaser'
import { getAscensionLabel } from '../core/ascension'
import { CARD_DEFS } from '../core/cards'
import { grantNextIroncladUnlock, loadMeta, saveMeta, unlockNextAscension } from '../core/meta'
import { clearSavedRun, type RunState } from '../core/run'
import { getRelicDisplayName } from '../core/relics'
import { IRONCLAD_UNLOCK_TRACK, type UnlockBundle } from '../core/unlocks'

export class RunSummaryScene extends Phaser.Scene {
    constructor() { super('RunSummary') }

    create(data: { run: RunState; result: 'victory' | 'defeat' }): void {
        const style = { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' }
        const meta = loadMeta()
        let unlockedNext = false
        let unlockBundle: UnlockBundle | undefined
        meta.totalRuns += 1
        if (data.result === 'victory') {
            meta.totalWins += 1
            unlockedNext = unlockNextAscension(meta, data.run.asc)
            unlockBundle = grantNextIroncladUnlock(meta)
        }
        saveMeta(meta)

        this.add.text(16, 16, `Run ${data.result.toUpperCase()}!`, style)
        this.add.text(16, 54, `Ascension cleared: ${getAscensionLabel(data.run.asc)}`, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#cccccc',
        })
        this.add.text(16, 82, `Acts cleared: ${(data.run.actsCleared ?? []).join(', ') || 'None'}`, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#cccccc',
        })
        this.add.text(16, 110, `Deck size: ${data.run.deck.length}`, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#cccccc',
        })
        const curseCards = data.run.deck.filter(card => CARD_DEFS[card.defId]?.type === 'curse')
        this.add.text(16, 138, `Curses: ${curseCards.length > 0 ? curseCards.map(card => CARD_DEFS[card.defId].name).join(', ') : 'None'}`, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#d4b2d4',
            wordWrap: { width: 720 },
        })
        this.add.text(16, 170, `Relics: ${data.run.relics.map(id => getRelicDisplayName(data.run, id)).join(', ') || 'None'}`, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#cccccc',
            wordWrap: { width: 720 },
        })
        this.add.text(16, 214, `Ascension unlock: ${unlockedNext ? `Unlocked ${getAscensionLabel(meta.bestAscensionUnlocked)}` : 'No new unlock'}`, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: unlockedNext ? '#b8e994' : '#cccccc',
        })
        this.add.text(16, 242, `Highest unlocked: ${getAscensionLabel(meta.bestAscensionUnlocked)}`, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#cccccc',
        })
        this.add.text(16, 270, `Ironclad unlocks: ${meta.ironcladUnlockTier}/${IRONCLAD_UNLOCK_TRACK.length}`, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#cccccc',
        })
        const unlockSummary = unlockBundle
            ? `Unlocked Tier ${unlockBundle.tier}: ${unlockBundle.label}`
            : data.result === 'defeat'
                ? 'No unlock from defeat'
                : 'No further Ironclad unlocks'
        this.add.text(16, 298, unlockSummary, {
            fontFamily: 'monospace',
            fontSize: '15px',
            color: unlockBundle ? '#b8e994' : '#cccccc',
            wordWrap: { width: 760 },
        })
        if (unlockBundle) {
            this.add.text(16, 324, `Cards: ${unlockBundle.cards.map(id => CARD_DEFS[id].name).join(', ')}`, {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#cccccc',
                wordWrap: { width: 760 },
            })
            this.add.text(16, 348, `Relic: ${unlockBundle.relics.map(id => getRelicDisplayName(data.run, id)).join(', ')}`, {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#cccccc',
                wordWrap: { width: 760 },
            })
        }
        clearSavedRun()
        this.add.text(16, unlockBundle ? 388 : 336, 'Back to Main Menu', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('MainMenu'))
    }
}
