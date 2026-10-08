import Phaser from 'phaser'
import { createNewRun, loadRun, saveRun } from '../core/run'
import { getCharacterProgress, loadMeta, saveMeta } from '../core/meta'
import { recordRunResult } from '../core/runResults'
import { UNLOCK_XP } from '../core/unlocks'
import { getRunDestination } from '../core/progression'
import { CHARACTERS, CHARACTER_IDS, type CharacterId, type RunMode } from '../core/characters'
import { createProfileRun, dailyConfiguration } from '../core/modes/setup'
import { menuButton, menuText } from '../ui/menu'
import type { ModifierId } from '../core/modes/modifiers'

export class MainMenuScene extends Phaser.Scene {
    private seedInput?: Phaser.GameObjects.DOMElement
    private character: CharacterId = 'ironclad'
    private mode: RunMode = 'standard'
    private ascension = 0
    private seed = ''
    private modifiers: ModifierId[] = []
    private replaceConfirmed = false
    constructor() { super('MainMenu') }
    create(data: { modifiers?: ModifierId[] } = {}): void {
        this.events.once('shutdown', () => { this.seedInput?.destroy(); this.seedInput = undefined })
        if (data.modifiers) { this.modifiers = data.modifiers; this.mode = 'custom' }
        const meta = loadMeta()
        if (this.mode === 'custom' && !meta.customUnlocked) { this.mode = 'standard'; this.modifiers = [] }
        if (this.mode !== 'daily' && !getCharacterProgress(meta, this.character).unlocked) this.character = 'ironclad'
        this.replaceConfirmed = false
        this.render()
    }
    private render(): void {
        this.seedInput?.destroy(); this.seedInput = undefined
        this.children.removeAll(true)
        const meta = loadMeta(), saved = loadRun(), progress = getCharacterProgress(meta, this.character)
        this.add.text(24, 18, 'Slay the Spire', { ...menuText, fontSize: '28px', color: '#eee' })
        this.add.text(24, 53, 'A Phaser fan recreation', { ...menuText, fontSize: '13px', color: '#aaa' })
        menuButton(this, 615, 22, 'Continue', () => { if (saved) { const next = getRunDestination(saved); this.scene.start(next.scene, next.data) } }, !!saved)
        CHARACTER_IDS.forEach((id, i) => {
            const unlocked = getCharacterProgress(meta, id).unlocked || this.mode === 'daily'
            const button = menuButton(this, 24 + i * 190, 93, `${id === this.character ? '> ' : ''}${CHARACTERS[id].name}${unlocked ? '' : ' [locked]'}`, () => {
                this.character = id; this.ascension = 0; this.replaceConfirmed = false; this.render()
            }, unlocked && this.mode !== 'daily')
            if (id === this.character) button.setColor(`#${CHARACTERS[id].color.toString(16).padStart(6, '0')}`)
        })
        this.add.text(24, 142, CHARACTERS[this.character].description, menuText)
        this.add.text(24, 169, `HP ${CHARACTERS[this.character].maxHp}   Unlocks ${progress.unlockTier}/5${UNLOCK_XP[progress.unlockTier] ? `   XP ${progress.xp}/${UNLOCK_XP[progress.unlockTier]}` : ''}`, { ...menuText, fontSize: '14px' })
        ;(['standard', 'seeded', 'daily', 'custom'] as const).forEach((mode, i) => menuButton(this, 24 + i * 190, 204, `${this.mode === mode ? '> ' : ''}${mode[0].toUpperCase() + mode.slice(1)}`, () => {
            this.mode = mode; this.replaceConfirmed = false
            if (mode === 'daily') { this.character = dailyConfiguration().character; this.ascension = 0 }
            else if (!getCharacterProgress(meta, this.character).unlocked) this.character = 'ironclad'
            this.render()
        }, mode !== 'custom' || !!meta.customUnlocked))
        if (this.mode === 'daily') {
            const daily = dailyConfiguration()
            this.add.text(24, 256, `${daily.seed}\nLocal daily challenge. Scores are saved on this device.`, { ...menuText, lineSpacing: 7 })
        } else {
            this.ascension = Math.min(this.ascension, this.mode === 'custom' ? 20 : progress.ascension)
            this.add.text(24, 262, `Ascension: ${this.ascension}`, menuText)
            menuButton(this, 198, 250, '-', () => { this.ascension = Math.max(0, this.ascension - 1); this.render() })
            menuButton(this, 245, 250, '+', () => { this.ascension = Math.min(this.mode === 'custom' ? 20 : progress.ascension, this.ascension + 1); this.render() })
            if (this.mode === 'seeded' || this.mode === 'custom') {
                this.add.text(332, 262, 'Seed', menuText)
                const input = document.createElement('input')
                input.type = 'text'; input.value = this.seed; input.placeholder = this.mode === 'custom' ? 'Random' : 'Enter seed'; input.maxLength = 64
                input.setAttribute('aria-label', 'Run seed'); input.style.cssText = 'width:300px;padding:8px;background:#222;color:#eee;border:1px solid #777;font:16px monospace;'
                input.addEventListener('input', () => { this.seed = input.value.trim() })
                this.seedInput = this.add.dom(396, 252, input).setOrigin(0)
            }
            if (this.mode === 'custom') menuButton(this, 24, 302, `Modifiers (${this.modifiers.length})`, () => this.scene.start('CustomModifiers', { modifiers: this.modifiers }))
            else this.add.text(24, 307, this.mode === 'seeded' ? 'Seeded runs earn XP. Ascension advances in standard runs.' : 'Climb three acts. Unlock new cards as you play.', { ...menuText, fontSize: '14px' })
        }
        const label = this.replaceConfirmed ? 'Abandon saved run and start' : 'New Run'
        menuButton(this, 24, 356, label, () => {
            if (this.mode === 'seeded' && !this.seed) return
            if (saved && !this.replaceConfirmed) { this.replaceConfirmed = true; this.render(); return }
            if (saved) recordRunResult(meta, saved, 'defeat')
            const run = createProfileRun(meta, { character: this.character, mode: this.mode, ascension: this.ascension, seed: this.mode === 'seeded' || this.mode === 'custom' ? this.seed || undefined : undefined, modifiers: this.modifiers })
            saveMeta(meta); saveRun(run)
            const next = getRunDestination(run); this.scene.start(next.scene, next.data)
        })
        menuButton(this, 24, 407, 'Card Library', () => this.scene.start('DeckBuilder', { run: saved ?? createNewRun() }))
        menuButton(this, 225, 407, 'Run History', () => this.scene.start('RunHistory'))
        menuButton(this, 590, 407, 'Achievements', () => this.scene.start('Achievements'))
        menuButton(this, 425, 407, 'Settings', () => this.scene.start('Settings'))
    }
}
