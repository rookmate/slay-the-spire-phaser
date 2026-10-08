import { roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { MODIFIERS, MODIFIER_IDS, toggleModifier, type ModifierId } from '../core/modes/modifiers'
import { menuButton, menuText } from '../ui/menu'
export class CustomModifiersScene extends Phaser.Scene {
    private modifiers: ModifierId[] = []
    private page = 0
    constructor() { super('CustomModifiers') }
    create(data: { modifiers: ModifierId[] }): void { this.modifiers = [...data.modifiers]; this.page = 0; this.render() }
    private render(): void {
        this.children.removeAll(true)
        roomBackdrop(this)
        this.add.text(24, 20, 'Custom modifiers', { ...menuText, fontSize: '26px' })
        MODIFIER_IDS.slice(this.page * 8, this.page * 8 + 8).forEach((id, index) => {
            const x = 24 + index % 2 * 388, y = 76 + Math.floor(index / 2) * 80, def = MODIFIERS[id]
            menuButton(this, x, y, `${this.modifiers.includes(id) ? '[x]' : '[ ]'} ${def.name}`, () => { this.modifiers = toggleModifier(this.modifiers, id); this.render() })
            this.add.text(x, y + 38, def.description, { ...menuText, fontSize: '12px', wordWrap: { width: 360 } })
        })
        menuButton(this, 24, 404, 'Previous', () => { this.page--; this.render() }, this.page > 0)
        menuButton(this, 164, 404, 'Next', () => { this.page++; this.render() }, (this.page + 1) * 8 < MODIFIER_IDS.length)
        menuButton(this, 640, 404, 'Done', () => this.scene.start('MainMenu', { modifiers: this.modifiers }))
    }
}
