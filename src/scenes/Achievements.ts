import { roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { ACHIEVEMENTS, ACHIEVEMENT_IDS } from '../core/achievements/catalog'
import { loadMeta } from '../core/meta'
import { menuButton, menuText } from '../ui/menu'

export class AchievementsScene extends Phaser.Scene {
    private page = 0
    private filter: 'all' | 'earned' | 'locked' = 'all'
    constructor() { super('Achievements') }
    create(): void { this.render() }
    private render(): void {
        this.children.removeAll(true)
        roomBackdrop(this)
        const earned = loadMeta().achievements ?? {}
        const ids = ACHIEVEMENT_IDS.filter(id => this.filter === 'all' || (this.filter === 'earned') === !!earned[id])
        const pages = Math.max(1, Math.ceil(ids.length / 5)); this.page = Math.min(this.page, pages - 1)
        this.add.text(24, 20, `Achievements  ${Object.keys(earned).length}/${ACHIEVEMENT_IDS.length}`, { ...menuText, fontSize: '24px' })
        this.add.text(24, 57, 'Standard runs qualify. My Lucky Day requires a Daily win.', { ...menuText, fontSize: '13px', color: '#bdb3a1' })
        ;(['all', 'earned', 'locked'] as const).forEach((filter, i) => menuButton(this, 24 + i * 160, 83, `${this.filter === filter ? '> ' : ''}${filter}`, () => { this.filter = filter; this.page = 0; this.render() }))
        ids.slice(this.page * 5, this.page * 5 + 5).forEach((id, i) => {
            const y = 132 + i * 50, [name, description] = ACHIEVEMENTS[id]
            this.add.text(24, y, `${earned[id] ? '✓' : '·'} ${name}`, { ...menuText, color: earned[id] ? '#d8bc78' : '#aaa' })
            this.add.text(285, y, description, { ...menuText, fontSize: '13px', wordWrap: { width: 475 } })
            if (earned[id]) this.add.text(42, y + 20, earned[id].slice(0, 10), { ...menuText, fontSize: '10px', color: '#999' })
        })
        if (!ids.length) this.add.text(24, 155, 'No achievements in this view yet.', menuText)
        menuButton(this, 24, 402, 'Back', () => this.scene.start('MainMenu'))
        menuButton(this, 180, 402, 'Previous', () => { this.page--; this.render() }, this.page > 0)
        this.add.text(355, 410, `${this.page + 1} / ${pages}`, menuText)
        menuButton(this, 450, 402, 'Next', () => { this.page++; this.render() }, this.page + 1 < pages)
    }
}
