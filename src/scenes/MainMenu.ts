import { saveCheckpoint } from '../core/checkpoint'
import { bindAction } from '../ui/accessibility'
import { openHelp } from './Help'
import { characterTexture } from '../ui/portraits'
import Phaser from 'phaser'
import { createNewRun, loadRun } from '../core/run'
import { getCharacterProgress, loadMeta } from '../core/meta'
import { recordRunResult } from '../core/runResults'
import { UNLOCK_XP } from '../core/unlocks'
import { completedRunResult, getRunDestination } from '../core/progression'
import { CHARACTERS, CHARACTER_IDS, type CharacterId, type RunMode } from '../core/characters'
import { createProfileRun, dailyConfiguration } from '../core/modes/setup'
import { menuButton, menuText } from '../ui/menu'
import { DISPLAY_FONT, palette } from '../ui/theme'
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
        this.replaceConfirmed = false
        this.render()
        if (!performance.getEntriesByName('spire:menu-ready').length) {
            this.game.events.once(Phaser.Core.Events.POST_RENDER, () => performance.mark('spire:menu-ready'))
        }
    }
    private render(): void {
        this.seedInput?.destroy(); this.seedInput = undefined
        for (const child of [...this.children.list]) child.destroy()
        const meta = loadMeta(), saved = loadRun(), progress = getCharacterProgress(meta, this.character), character = CHARACTERS[this.character]
        if (this.textures.exists('art:spire')) this.add.image(400, 225, 'art:spire').setDisplaySize(800, 450)
        this.add.rectangle(0, 0, 465, 410, palette.ink, 0.52).setOrigin(0)
        this.add.text(32, 14, 'SLAY THE SPIRE', { resolution: 2, fontFamily: DISPLAY_FONT, fontSize: '51px', color: '#f5e7c9' }).setResolution(2)
        this.add.text(35, 76, 'Choose your character. Begin the climb.', { ...menuText, fontSize: '13px', color: palette.muted }).setResolution(2)
        this.add.rectangle(34, 100, 401, 1, palette.line).setOrigin(0)

        CHARACTER_IDS.forEach((id, i) => {
            const selected = id === this.character
            const x = 34 + i * 104
            this.add.rectangle(x, 113, 94, 71, selected ? 0x443527 : 0x191a16, 0.92).setOrigin(0).setStrokeStyle(1, selected ? palette.copper : palette.line, selected ? 1 : 0.5)
            this.add.image(x + 47, 136, ...characterTexture(this, id)).setDisplaySize(37, 44)
            const button = this.add.text(x, 114, CHARACTERS[id].name, { ...menuText, fontSize: '13px', fontStyle: 'bold', align: 'center', fixedWidth: 94, fixedHeight: 69, padding: { top: 45 }, color: palette.text }).setResolution(2)
            button.setData('character', id)
            const selectCharacter = () => {
                this.character = id; this.ascension = 0; this.replaceConfirmed = false; this.render()
            }
            bindAction(button, selectCharacter, { label: `${CHARACTERS[id].name}: ${CHARACTERS[id].description}`, enabled: () => this.mode !== 'daily', pressed: () => this.character === id, id: `character:${id}` })
            if (this.mode !== 'daily') button.setInteractive({ useHandCursor: true }).on('pointerdown', selectCharacter).on('pointerover', () => button.setColor(palette.gold)).on('pointerout', () => button.setColor(palette.text))
        })
        this.add.text(34, 196, character.name, { resolution: 2, fontFamily: DISPLAY_FONT, fontSize: '29px', color: palette.text }).setResolution(2)
        this.add.text(434, 204, `${character.maxHp} HP  ·  XP tier ${progress.unlockTier}/5`, { ...menuText, fontSize: '13px', color: palette.gold }).setOrigin(1, 0).setResolution(2)
        this.add.text(34, 234, character.description, { ...menuText, fontSize: '14px', color: '#c7bca5', wordWrap: { width: 405 } }).setResolution(2)
        ;(['standard', 'seeded', 'daily', 'custom'] as const).forEach((mode, i) => {
            const x = 34 + i * 104, selected = this.mode === mode
            menuButton(this, x, 272, mode[0].toUpperCase() + mode.slice(1), () => {
                this.mode = mode; this.replaceConfirmed = false
                if (mode === 'daily') { this.character = dailyConfiguration().character; this.ascension = 0 }
                this.render()
            }, mode !== 'custom' || !!meta.customUnlocked, { width: 94, quiet: true }).setFontSize(14)
            if (selected) this.add.rectangle(x + 12, 306, 70, 2, palette.copper).setOrigin(0)
        })
        if (this.mode === 'daily') {
            const daily = dailyConfiguration()
            this.add.text(34, 318, `${daily.seed}\nLocal challenge · scores saved on this device`, { ...menuText, fontSize: '13px', color: palette.muted, lineSpacing: 3 }).setResolution(2)
        } else {
            this.ascension = Math.min(this.ascension, this.mode === 'custom' ? 20 : progress.ascension)
            this.add.text(34, 323, `Ascension ${this.ascension}`, { ...menuText, fontSize: '14px' }).setResolution(2)
            menuButton(this, 142, 314, '-', () => { this.ascension = Math.max(0, this.ascension - 1); this.render() }, true, { description: 'Decrease Ascension' })
            menuButton(this, 181, 314, '+', () => { this.ascension = Math.min(this.mode === 'custom' ? 20 : progress.ascension, this.ascension + 1); this.render() }, true, { description: 'Increase Ascension' })
            if (this.mode === 'seeded' || this.mode === 'custom') {
                const input = document.createElement('input')
                input.type = 'text'; input.value = this.seed; input.placeholder = this.mode === 'custom' ? 'Random seed' : 'Enter seed'; input.maxLength = 64
                input.setAttribute('aria-label', 'Run seed'); input.style.width = '202px'
                input.addEventListener('input', () => { this.seed = input.value.trim() })
                this.seedInput = this.add.dom(234, 315, input).setOrigin(0)
            } else this.add.text(434, 324, UNLOCK_XP[progress.unlockTier] ? `${progress.xp} / ${UNLOCK_XP[progress.unlockTier]} XP` : 'Relic progression complete', { ...menuText, fontSize: '13px', color: palette.muted }).setOrigin(1, 0).setResolution(2)
        }
        const label = this.replaceConfirmed ? saved && completedRunResult(saved) ? 'Finish saved run and start' : 'Abandon saved run and start' : 'New Run'
        menuButton(this, 34, 360, label, () => {
            if (this.mode === 'seeded' && !this.seed) return
            if (saved && !this.replaceConfirmed) { this.replaceConfirmed = true; this.render(); return }
            const currentMeta = loadMeta()
            if (saved) recordRunResult(currentMeta, saved, completedRunResult(saved) ?? 'defeat')
            const run = createProfileRun(currentMeta, { character: this.character, mode: this.mode, ascension: this.ascension, seed: this.mode === 'seeded' || this.mode === 'custom' ? this.seed || undefined : undefined, modifiers: this.modifiers })
            saveCheckpoint(currentMeta, run)
            const next = getRunDestination(run); this.scene.start(next.scene, next.data)
        }, true, { primary: true, width: this.replaceConfirmed ? 402 : 195 })
        if (!this.replaceConfirmed) {
            if (this.mode === 'custom') menuButton(this, 241, 360, `Modifiers (${this.modifiers.length})`, () => this.scene.start('CustomModifiers', { modifiers: this.modifiers }), true, { width: 195 })
            else menuButton(this, 241, 360, 'Continue', () => { if (saved) { const next = getRunDestination(saved); this.scene.start(next.scene, next.data) } }, !!saved, { width: 195 })
        }
        if (saved && this.mode === 'custom' && !this.replaceConfirmed) menuButton(this, 660, 20, 'Continue', () => { const next = getRunDestination(saved); this.scene.start(next.scene, next.data) }, true, { quiet: true })
        this.add.image(609, 267, ...characterTexture(this, this.character)).setDisplaySize(238, 238)
        this.add.text(609, 395, this.mode === 'daily' ? 'Daily challenge' : character.name, { resolution: 2, fontFamily: DISPLAY_FONT, fontSize: '20px', color: '#f1dec0' }).setOrigin(0.5).setResolution(2)
        this.add.rectangle(0, 410, 800, 40, palette.ink, 0.96).setOrigin(0)
        this.add.rectangle(24, 410, 752, 1, palette.line).setOrigin(0)
        const links: [string, string][] = [['Card Library', 'DeckBuilder'], ['Run History', 'RunHistory'], ['Achievements', 'Achievements'], ['Settings', 'Settings']]
        links.forEach(([title, scene], i) => menuButton(this, 24 + i * 150, 414, title, () => this.scene.start(scene, scene === 'DeckBuilder' ? { run: saved ?? createNewRun() } : undefined), true, { quiet: true, width: 136 }).setFontSize(14))
        menuButton(this, 648, 414, 'Help', () => openHelp(this), true, { quiet: true, width: 104 }).setFontSize(14)
    }
}
