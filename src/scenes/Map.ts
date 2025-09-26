import Phaser from 'phaser'
import type { RunState } from '../core/run'
import { RNG } from '../core/rng'
import { generateMap, resolveUnknown, updateUnknownWeights, defaultUnknownWeights, type GeneratedMap, type MapNode } from '../core/map'

export class MapScene extends Phaser.Scene {
    run!: RunState
    gmap!: GeneratedMap
    unknownWeights = defaultUnknownWeights()

    constructor() {
        super('Map')
    }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }
        this.add.text(16, 16, `Floor ${this.run.floor}  HP ${this.run.player.hp}/${this.run.player.maxHp}  Gold ${this.run.gold}`, style)

        // Generate map for this act
        this.gmap = generateMap(this.run.seed, 1)
        this.drawGraph()
    }

    private enterNode(node: MapNode): void {
        const rng = new RNG(`${this.run.seed}-unknown-${this.run.floor}`)
        if (node.kind === 'unknown') {
            const outcome = resolveUnknown(rng, this.unknownWeights)
            this.unknownWeights = updateUnknownWeights(this.unknownWeights, outcome)
            if (outcome === 'monster') { this.scene.start('Combat', { run: this.run }); return }
            if (outcome === 'shop') { this.scene.start('Shop', { run: this.run }); return }
            if (outcome === 'chest') { this.scene.start('Rewards', { run: this.run }); return }
            this.scene.start('Event', { run: this.run }); return
        }
        const kind = node.kind
        if (kind === 'monster') { this.scene.start('Combat', { run: this.run }); return }
        if (kind === 'rest') { this.scene.start('Campfire', { run: this.run }); return }
        if (kind === 'shop') { this.scene.start('Shop', { run: this.run }); return }
        if (kind === 'chest') { this.scene.start('Rewards', { run: this.run }); return }
        if (kind === 'elite') { this.scene.start('Combat', { run: this.run }); return }
        if (kind === 'boss') { this.scene.start('Combat', { run: this.run }); return }
        this.scene.start('Event', { run: this.run })
    }

    private drawGraph(): void {
        const style = { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' } as const
        const cellW = 90
        const cellH = 40
        const left = 40
        const top = 60

        // Draw edges
        const g = this.add.graphics()
        g.lineStyle(1, 0x666666, 1)
        for (const n of this.gmap.nodes) {
            for (const to of n.edgesTo) {
                const m = this.gmap.byId[to]
                const x1 = left + n.col * cellW
                const y1 = top + (this.gmap.rows - 1 - n.row) * cellH
                const x2 = left + m.col * cellW
                const y2 = top + (this.gmap.rows - 1 - m.row) * cellH
                g.lineBetween(x1, y1, x2, y2)
            }
        }

        // Draw nodes
        for (const n of this.gmap.nodes) {
            const x = left + n.col * cellW
            const y = top + (this.gmap.rows - 1 - n.row) * cellH
            this.add.text(x - 20, y - 10, this.iconFor(n.kind), { ...style, backgroundColor: '#222', padding: { x: 6, y: 2 } })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.enterNode(n))
            this.add.text(x + 14, y - 10, n.kind, { fontFamily: 'monospace', fontSize: '12px', color: '#aaa' })
        }
    }

    private iconFor(kind: string): string {
        switch (kind) {
            case 'monster': return 'M'
            case 'elite': return 'E'
            case 'rest': return 'R'
            case 'shop': return '$'
            case 'unknown': return '?'
            case 'chest': return 'C'
            case 'boss': return 'B'
            case 'start': return 'S'
            default: return '·'
        }
    }
}


