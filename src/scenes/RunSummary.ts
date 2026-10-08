import { roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { CHARACTERS } from '../core/characters'
import { getCharacterProgress, loadMeta, saveMeta } from '../core/meta'
import { recordRunResult } from '../core/runResults'
import { clearSavedRun, type RunState } from '../core/run'
import { calculateScore } from '../core/score'
import { UNLOCK_XP } from '../core/unlocks'
import { menuButton, menuText } from '../ui/menu'
export class RunSummaryScene extends Phaser.Scene {
    constructor() { super('RunSummary') }
    create(data: { run: RunState; result: 'victory' | 'defeat' }): void {
        roomBackdrop(this)
        const meta = loadMeta(), run = data.run
        const result = recordRunResult(meta, run, data.result), progress = getCharacterProgress(meta, run.character)
        saveMeta(meta); clearSavedRun()
        this.add.text(24, 20, `${CHARACTERS[run.character].name} · ${data.result.toUpperCase()}`, { ...menuText, fontSize: '26px' })
        this.add.text(24, 66, `${run.mode} · Ascension ${run.asc} · Floor ${run.floor}`, menuText)
        this.add.text(24, 100, `Score ${result.score}`, { ...menuText, fontSize: '25px', color: '#dbc5a3' })
        const score = calculateScore(run, data.result === 'victory')
        let page = 0
        const scoreText = this.add.text(24, 144, '', { ...menuText, fontSize: '14px', lineSpacing: 6 })
        const showScore = () => scoreText.setText(score.lines.slice(page * 9, page * 9 + 9).map(b => `${b.label}: ${b.points}`).join('\n'))
        showScore()
        if (score.lines.length > 9) menuButton(this, 24, 350, 'More score details', () => { page = (page + 1) % Math.ceil(score.lines.length / 9); showScore() })
        this.add.text(410, 100, `XP tier ${progress.unlockTier}/5\n${UNLOCK_XP[progress.unlockTier] ? `XP ${progress.xp}/${UNLOCK_XP[progress.unlockTier]}` : 'Relic progression complete'}\n\n${result.unlockedNext ? `Unlocked Ascension ${progress.ascension}` : `Highest Ascension: ${progress.ascension}`}`, { ...menuText, lineSpacing: 8 })
        if (result.unlockBundle?.relics.length) this.add.text(410, 250, `New relics\n${result.unlockBundle.label}`, { ...menuText, color: '#b8e994', wordWrap: { width: 355 } })
        this.add.text(410, 345, `Seed: ${run.seed}`, { ...menuText, fontSize: '13px', wordWrap: { width: 350 } })
        menuButton(this, 24, 404, 'Back to Main Menu', () => this.scene.start('MainMenu'))
    }
}
