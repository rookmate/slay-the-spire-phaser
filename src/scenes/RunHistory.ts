import { roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { loadMeta, type RunHistoryEntry } from '../core/meta'
import { CHARACTERS } from '../core/characters'
import { CARD_DEFS, createCardInstance } from '../core/cards'
import { RELIC_DEFS } from '../core/relics'
import { CardGrid } from '../ui/CardGrid'
import { menuButton, menuText } from '../ui/menu'

type EntryTab = 'Summary' | 'Deck' | 'Relics'
export class RunHistoryScene extends Phaser.Scene {
    private page = 0
    constructor() { super('RunHistory') }
    create(): void { this.page = 0; this.render() }
    private clear(): void {
        for (const child of [...this.children.list]) child.destroy()
        roomBackdrop(this)
    }
    private render(): void {
        this.clear()
        const history = loadMeta().history ?? [], pages = Math.max(1, Math.ceil(history.length / 6))
        this.page = Math.min(this.page, pages - 1)
        this.add.text(24, 20, `Run History  ·  ${history.length} runs`, { ...menuText, fontSize: '26px' })
        if (!history.length) this.add.text(24, 95, 'Completed runs will appear here.', menuText)
        history.slice(this.page * 6, this.page * 6 + 6).forEach((entry, i) => menuButton(this, 24, 75 + i * 50,
            `${entry.date.slice(0, 10)}  ${CHARACTERS[entry.character].name} A${entry.ascension}  ·  ${entry.result}  ·  ${entry.score} points`, () => this.showEntry(entry)))
        menuButton(this, 24, 403, 'Back', () => this.scene.start('MainMenu'))
        menuButton(this, 150, 403, 'Previous', () => { this.page--; this.render() }, this.page > 0)
        this.add.text(290, 411, `${this.page + 1} / ${pages}`, menuText)
        menuButton(this, 390, 403, 'Next', () => { this.page++; this.render() }, this.page + 1 < pages)
    }
    private showEntry(entry: RunHistoryEntry, tab: EntryTab = 'Summary', relicPage = 0): void {
        this.clear()
        this.add.text(24, 20, `${CHARACTERS[entry.character].name} · ${entry.result.toUpperCase()} · ${entry.score} points`, { ...menuText, fontSize: '22px' })
        ;(['Summary', 'Deck', 'Relics'] as const).forEach((name, i) => menuButton(this, 24 + i * 175, 60,
            name === 'Summary' ? name : `${name} (${name === 'Deck' ? entry.deck.length : entry.relics.length})`,
            () => this.showEntry(entry, name), true, { primary: tab === name, pressed: tab === name }))
        if (tab === 'Summary') {
            const minutes = Math.floor(entry.elapsedSeconds / 60), seconds = Math.floor(entry.elapsedSeconds % 60)
            const fields = [
                ['Date (UTC)', entry.date.replace('T', ' ').slice(0, 19)],
                ['Mode', entry.mode[0].toUpperCase() + entry.mode.slice(1)],
                ['Ascension', String(entry.ascension)],
                ['Floor reached', String(entry.floor)],
                ['Acts cleared', entry.actsCleared.length ? entry.actsCleared.join(', ') : 'None'],
                ['Time played', `${minutes}m ${seconds.toString().padStart(2, '0')}s`],
            ]
            fields.forEach(([label, value], i) => {
                const x = 24 + (i % 2) * 380, y = 120 + Math.floor(i / 2) * 68
                this.add.text(x, y, label, { ...menuText, fontSize: '13px', color: '#bdb3a1' })
                this.add.text(x, y + 22, value, menuText)
            })
            this.add.text(24, 326, `Seed: ${entry.seed}`, { ...menuText, fontSize: '14px', wordWrap: { width: 740 } })
        } else if (tab === 'Deck') {
            if (!entry.deck.length) this.add.text(24, 135, 'No cards recorded for this run.', menuText)
            else new CardGrid(this, this.add.container(0, 0), entry.deck.filter(c => CARD_DEFS[c.id]).map(c => createCardInstance(c.id, c.upgrade)), 110)
        } else {
            const pages = Math.max(1, Math.ceil(entry.relics.length / 4))
            entry.relics.slice(relicPage * 4, relicPage * 4 + 4).forEach((id, i) => {
                const relic = RELIC_DEFS[id], y = 115 + i * 66
                this.add.text(24, y, relic.name, { ...menuText, color: '#d8bc78' })
                this.add.text(260, y, relic.description, { ...menuText, fontSize: '14px', wordWrap: { width: 510 } })
            })
            if (!entry.relics.length) this.add.text(24, 135, 'No relics recorded for this run.', menuText)
            menuButton(this, 24, 402, 'Previous', () => this.showEntry(entry, tab, relicPage - 1), relicPage > 0)
            this.add.text(170, 410, `${relicPage + 1} / ${pages}`, menuText)
            menuButton(this, 270, 402, 'Next', () => this.showEntry(entry, tab, relicPage + 1), relicPage + 1 < pages)
        }
        menuButton(this, 630, 402, 'Back to history', () => this.render())
    }
}
