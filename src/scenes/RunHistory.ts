import { roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { loadMeta, type RunHistoryEntry } from '../core/meta'
import { CHARACTERS } from '../core/characters'
import { CARD_DEFS, createCardInstance } from '../core/cards'
import { CardGrid } from '../ui/CardGrid'
import { menuButton, menuText } from '../ui/menu'
export class RunHistoryScene extends Phaser.Scene {
    private page = 0
    constructor() { super('RunHistory') }
    create(): void { this.page = 0; this.render() }
    private render(): void {
        for (const child of [...this.children.list]) child.destroy()
        roomBackdrop(this)
        const history = loadMeta().history ?? []
        this.add.text(24, 20, 'Run History', { ...menuText, fontSize: '26px' })
        if (!history.length) this.add.text(24, 95, 'Completed runs will appear here.', menuText)
        history.slice(this.page * 6, this.page * 6 + 6).forEach((entry, i) => menuButton(this, 24, 75 + i * 50, `${entry.date.slice(0, 10)}  ${CHARACTERS[entry.character].name.padEnd(8)} A${entry.ascension}  ${entry.result}  ${entry.score} points`, () => this.showEntry(entry)))
        menuButton(this, 24, 403, 'Back', () => this.scene.start('MainMenu'))
        menuButton(this, 150, 403, 'Previous', () => { this.page--; this.render() }, this.page > 0)
        menuButton(this, 300, 403, 'Next', () => { this.page++; this.render() }, (this.page + 1) * 6 < history.length)
    }
    private showEntry(entry: RunHistoryEntry): void {
        for (const child of [...this.children.list]) child.destroy()
        roomBackdrop(this)
        this.add.text(24, 20, `${CHARACTERS[entry.character].name} · ${entry.result} · ${entry.score} points`, { ...menuText, fontSize: '22px' })
        this.add.text(24, 58, `${entry.mode} · Seed ${entry.seed} · Floor ${entry.floor} · ${Math.floor(entry.elapsedSeconds / 60)}m`, menuText)
        new CardGrid(this, this.add.container(0, 0), entry.deck.filter(c => CARD_DEFS[c.id]).map(c => createCardInstance(c.id, c.upgrade)), 104, undefined)
        menuButton(this, 650, 402, 'Back', () => this.render())
    }
}
