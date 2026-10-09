import { actionButton } from '../ui/accessibility'
import { UI_FONT, roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { createCardInstance } from '../core/cards'
import { loadMeta, type MetaState } from '../core/meta'
import { POTION_DEFS } from '../core/potions'
import { getRunDestination } from '../core/progression'
import { RELIC_DEFS } from '../core/relics'
import { acquisitionCandidates, chooseAcquisition, prepareAcquisition } from '../core/relics/acquisitions'
import { saveRun, type RunState } from '../core/run'
import { CardGrid } from '../ui/CardGrid'

/** Acquisitions pause their saved room until every mandatory choice is complete. */
export class RelicAcquisitionScene extends Phaser.Scene {
    run!: RunState
    private meta!: MetaState
    constructor() { super('RelicAcquisition') }
    create(data: { run: RunState }): void {
        this.run = data.run; this.meta = loadMeta(); this.render()
    }
    private choose(choice?: string | number): void {
        if (!chooseAcquisition(this.run, this.meta, choice)) return
        saveRun(this.run); this.render()
    }
    private button(x: number, y: number, label: string, choice?: string | number): void {
        const button = this.add.text(x, y, label, { resolution: 2, fontFamily: UI_FONT, fontSize: '16px', color: '#fff', backgroundColor: '#353126', padding: { x: 10, y: 8 } })
        actionButton(button, label, () => this.choose(choice))
    }
    private render(): void {
        const step = prepareAcquisition(this.run, this.meta)
        saveRun(this.run)
        if (!step) { const next = getRunDestination(this.run); this.scene.start(next.scene, next.data); return }
        for (const child of [...this.children.list]) child.destroy()
        roomBackdrop(this)
        const def = RELIC_DEFS[step.source]
        this.add.text(24, 20, def.name, { resolution: 2, fontFamily: UI_FONT, fontSize: '26px', color: '#fff' })
        const instruction = step.kind === 'select' ? `Choose ${step.count - (step.selected?.length ?? 0)} card(s) to ${step.operation}.` : step.kind === 'cards' ? 'Choose a card or skip.' : 'Replace a potion or skip.'
        this.add.text(24, 65, instruction, { resolution: 2, fontFamily: UI_FONT, fontSize: '18px', color: '#d0c5ae' })
        if (step.kind === 'select' || step.kind === 'cards') {
            const cards = step.kind === 'select' ? acquisitionCandidates(this.run, step) : (step.choices ?? []).map(id => createCardInstance(id))
            const parent = this.add.container(0, 0)
            new CardGrid(this, parent, cards, 110, card => this.choose(step.kind === 'select' ? card.instanceId : card.defId))
            if (step.kind === 'cards') {
                this.button(675, 398, 'Skip')
                if (this.run.relics.includes('SINGING_BOWL')) this.button(445, 398, '+2 max HP', '__bowl')
            }
        } else if (step.kind === 'potion' && step.potionId) {
            const potion = POTION_DEFS[step.potionId]
            this.add.text(24, 115, `${potion.name}\n${potion.description}`, { resolution: 2, fontFamily: UI_FONT, fontSize: '18px', color: '#fff', wordWrap: { width: 740 } })
            this.run.potions.forEach((id, i) => this.button(24 + i % 3 * 252, 220 + Math.floor(i / 3) * 60, POTION_DEFS[id].name, i))
            this.button(675, 398, 'Skip')
        }
    }
}
