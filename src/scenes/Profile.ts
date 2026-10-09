import { roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { backupProfile, exportProfile, importProfile, MAX_PROFILE_BYTES, parseProfile, JOURNAL_KEY } from '../core/profile/storage'
import type { Profile } from '../core/profile/schema'
import { menuButton, menuText } from '../ui/menu'

export class ProfileScene extends Phaser.Scene {
    private fileInput?: Phaser.GameObjects.DOMElement
    private pending?: Profile
    private message = ''
    private reading = false
    private generation = 0
    constructor() { super('Profile') }
    create(): void {
        this.pending = undefined; this.message = ''; this.reading = false; this.generation++
        this.events.once('shutdown', () => { this.generation++; this.pending = undefined; this.fileInput?.destroy(); this.fileInput = undefined })
        this.render()
    }
    private attempt(action: () => void): void {
        try { action() } catch (error) {
            this.pending = undefined
            if (localStorage.getItem(JOURNAL_KEY)) { this.scene.start('ProfileRecovery'); return }
            this.message = error instanceof Error ? error.message : 'Could not access the profile.'
        }
        this.render()
    }
    private render(): void {
        this.fileInput?.destroy(); this.fileInput = undefined
        for (const child of [...this.children.list]) child.destroy()
        roomBackdrop(this)
        this.add.text(24, 20, 'Profile backup', { ...menuText, fontSize: '26px' })
        this.add.text(24, 65, 'Export progress, achievements, settings, and your saved run.\nCombat resumes from the start of its room.', { ...menuText, lineSpacing: 8 })
        menuButton(this, 24, 130, 'Export profile', () => this.attempt(() => {
            const url = URL.createObjectURL(new Blob([exportProfile()], { type: 'application/json' }))
            const link = document.createElement('a'); link.href = url; link.download = `spire-profile-${new Date().toISOString().slice(0, 10)}.json`; link.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
            this.message = 'Profile exported.'
        }), !this.reading)
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.setAttribute('aria-label', 'Import profile file')
        input.style.cssText = 'width:340px;font-size:14px;'
        input.disabled = this.reading
        input.addEventListener('change', async () => {
            const file = input.files?.[0]; if (!file) return
            this.pending = undefined; this.message = 'Reading profile…'; this.reading = true
            const generation = this.generation; this.render()
            try {
                if (file.size > MAX_PROFILE_BYTES) throw new Error('Profile exceeds the 2 MB limit.')
                const json = await file.text()
                if (generation !== this.generation) return
                this.pending = parseProfile(json); this.message = ''
            } catch (error) { if (generation === this.generation) this.message = error instanceof Error ? error.message : 'Cannot read that file.' }
            if (generation === this.generation) { this.reading = false; this.render() }
        })
        this.fileInput = this.add.dom(370, 141, input).setOrigin(0)
        menuButton(this, 24, 181, 'Preview previous backup', () => this.attempt(() => { this.pending = backupProfile(); this.message = '' }), !this.reading)
        if (this.pending) {
            const profile = this.pending, run = profile.run
            this.add.text(24, 237, `${profile.meta.totalRuns} recorded runs · ${Object.keys(profile.meta.achievements ?? {}).length} achievements\nSaved run: ${run ? `${run.character}, Act ${run.act}, floor ${run.floor}` : 'none'}\nThis replaces the current profile. A local backup will be kept.`, { ...menuText, fontSize: '14px', lineSpacing: 8, wordWrap: { width: 752 } })
            menuButton(this, 24, 327, 'Replace profile', () => this.attempt(() => {
                importProfile(profile); this.pending = undefined; this.message = 'Profile imported. Continue your saved run from the main menu.'
            }))
            menuButton(this, 252, 327, 'Cancel import', () => { this.pending = undefined; this.message = 'Import cancelled. Your profile is unchanged.'; this.render() })
        }
        if (this.message) this.add.text(24, 238, this.message.slice(0, 300), { ...menuText, fontSize: '14px', color: '#e4c692', wordWrap: { width: 735 }, lineSpacing: 6 })
        menuButton(this, 24, 402, 'Back', () => this.scene.start('MainMenu'))
    }
}
