import { roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { ACHIEVEMENTS, ACHIEVEMENT_IDS } from '../core/achievements/catalog'
import { loadMeta } from '../core/meta'
import { menuButton, menuText } from '../ui/menu'

export class AchievementsScene extends Phaser.Scene {
    private page = 0
    private filter: 'all' | 'earned' | 'locked' = 'all'
    constructor() { super('Achievements') }
    create(): void { this.page = 0; this.filter = 'all'; this.render() }
    private render(): void {
        for (const child of [...this.children.list]) child.destroy()
        roomBackdrop(this)
        const earned = loadMeta().achievements ?? {}
        const earnedCount = ACHIEVEMENT_IDS.filter(id => earned[id]).length
        const ids = ACHIEVEMENT_IDS.filter(id => this.filter === 'all' || (this.filter === 'earned') === !!earned[id])
        const pages = Math.max(1, Math.ceil(ids.length / 5)); this.page = Math.min(this.page, pages - 1)
        this.add.text(24, 20, `Achievements  ${earnedCount}/${ACHIEVEMENT_IDS.length}`, { ...menuText, fontSize: '24px' })
        this.add.text(24, 57, 'Standard runs qualify. My Lucky Day requires a Daily win.', { ...menuText, fontSize: '13px', color: '#bdb3a1' })
        const counts = { all: ACHIEVEMENT_IDS.length, earned: earnedCount, locked: ACHIEVEMENT_IDS.length - earnedCount }
        ;(['all', 'earned', 'locked'] as const).forEach((filter, i) => menuButton(this, 24 + i * 180, 83,
            `${filter[0].toUpperCase() + filter.slice(1)} (${counts[filter]})`,
            () => { this.filter = filter; this.page = 0; this.render() }, true, { primary: this.filter === filter, pressed: this.filter === filter }))
        ids.slice(this.page * 5, this.page * 5 + 5).forEach((id, i) => {
            const y = 132 + i * 50, [name, description] = ACHIEVEMENTS[id]
            this.add.text(24, y, name, { ...menuText, color: earned[id] ? '#d8bc78' : '#aaa' })
            this.add.text(285, y, description, { ...menuText, fontSize: '13px', wordWrap: { width: 475 } })
            this.add.text(24, y + 22, earned[id] ? `Earned ${earned[id].slice(0, 10)}` : 'Locked', { ...menuText, fontSize: '11px', color: '#bdb3a1' })
        })
        if (!ids.length) this.add.text(24, 155, this.filter === 'earned' ? 'Your first achievement is waiting. Start a Standard run.' : 'Every achievement earned. The Spire remembers.', menuText)
        menuButton(this, 24, 402, 'Back', () => this.scene.start('MainMenu'))
        menuButton(this, 180, 402, 'Previous', () => { this.page--; this.render() }, this.page > 0)
        this.add.text(355, 410, `${this.page + 1} / ${pages}`, menuText)
        menuButton(this, 450, 402, 'Next', () => { this.page++; this.render() }, this.page + 1 < pages)
    }
}
