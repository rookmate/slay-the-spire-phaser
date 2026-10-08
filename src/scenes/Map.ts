import Phaser from 'phaser'
import { getAscensionLabel } from '../core/ascension'
import { loadMeta } from '../core/meta'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { RNG } from '../core/rng'
import { generateMap, resolveUnknown, updateUnknownWeights, defaultUnknownWeights, type GeneratedMap, type MapNode, type RoomKind, type UnknownOutcome } from '../core/map'
import { generateRewardBundle } from '../core/rewards'
import { getRelicDisplayName } from '../core/relics'
import { getRunDestination } from '../core/progression'

export class MapScene extends Phaser.Scene {
    run!: RunState
    gmap!: GeneratedMap
    unknownWeights = defaultUnknownWeights()
    private meta = loadMeta()
    private currentNodeId?: string
    private mapLayer!: Phaser.GameObjects.Container
    private contentHeight = 0
    private isDragging = false
    private dragStartY = 0
    private layerStartY = 0

    constructor() {
        super('Map')
    }

    create(data: { run: RunState }): void {
        this.run = data.run
        this.meta = loadMeta()
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }
        this.add.text(16, 16, `Floor ${this.run.floor}  HP ${this.run.player.hp}/${this.run.player.maxHp}  Gold ${this.run.gold}`, style)
        this.add.text(16, 40, `Relics: ${this.run.relics.map(id => getRelicDisplayName(this.run, id)).join(', ') || 'None'}  Potions: ${this.run.potions.length}/${this.run.maxPotionSlots}`, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#cccccc',
        })
        this.add.text(16, 60, `Act ${this.run.act}  Ascension ${getAscensionLabel(this.run.asc)}`, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#cccccc',
        })

        // Generate map for this act
        this.gmap = generateMap(this.run.seed, this.run.act, 15, 7, this.run.asc)
        this.currentNodeId = this.run.mapProgress?.currentNodeId
        this.drawGraph()

        // Scroll with mouse wheel and drag (bind fresh every time we enter Map)
        this.input.removeAllListeners('wheel')
        this.input.removeAllListeners('pointerdown')
        this.input.removeAllListeners('pointerup')
        this.input.removeAllListeners('pointermove')
        this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
            if (!this.mapLayer) return
            const maxY = 60
            const visible = this.scale.height - 120
            const minY = Math.min(maxY, maxY - Math.max(0, this.contentHeight - visible))
            this.mapLayer.y = Phaser.Math.Clamp(this.mapLayer.y - dy, minY, maxY)
        })
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            this.isDragging = true
            this.dragStartY = p.y
            this.layerStartY = this.mapLayer?.y ?? 0
        })
        this.input.on('pointerup', () => { this.isDragging = false })
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!this.isDragging || !this.mapLayer) return
            const delta = p.y - this.dragStartY
            const maxY = 60
            const visible = this.scale.height - 120
            const minY = Math.min(maxY, maxY - Math.max(0, this.contentHeight - visible))
            this.mapLayer.y = Phaser.Math.Clamp(this.layerStartY + delta, minY, maxY)
        })
    }

    private enterNode(node: MapNode): void {
        const rng = new RNG(`${this.run.seed}-unknown-${this.run.floor}`)
        this.currentNodeId = node.id
        this.run.mapProgress = { currentNodeId: node.id }
        let kind: RoomKind | UnknownOutcome = node.kind
        if (node.kind === 'unknown') {
            const outcome = resolveUnknown(rng, this.unknownWeights)
            this.unknownWeights = updateUnknownWeights(this.unknownWeights, outcome)
            kind = outcome
        }

        if (kind === 'monster' || kind === 'elite' || kind === 'boss') {
            this.run.pendingRoom = { scene: 'Combat', roomKind: kind }
        } else if (kind === 'rest') {
            this.run.pendingRoom = { scene: 'Campfire' }
        } else if (kind === 'shop') {
            this.run.pendingRoom = { scene: 'Shop' }
        } else if (kind === 'chest') {
            const rewardKind = node.kind === 'unknown' ? 'unknown-chest' : 'chest'
            this.run.pendingRoom = {
                scene: 'Rewards',
                rewards: generateRewardBundle(`${this.run.seed}-reward-${node.id}-${rewardKind}`, 'chest', this.run, this.meta, { roomKind: 'chest', asc: this.run.asc }),
            }
        } else {
            this.run.pendingRoom = { scene: 'Event' }
        }
        saveRun(this.run)
        const destination = getRunDestination(this.run)
        this.scene.start(destination.scene, destination.data)
    }

    private drawGraph(): void {
        const style = { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' } as const
        const cellW = 90
        const cellH = 40
        const left = 40
        const top = 0

        if (this.mapLayer) this.mapLayer.destroy(true)
        this.mapLayer = this.add.container(0, 80)

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
        this.mapLayer.add(g)

        // Draw nodes
        for (const n of this.gmap.nodes) {
            const x = left + n.col * cellW
            const y = top + (this.gmap.rows - 1 - n.row) * cellH
            const isClickable = this.isSelectable(n)
            const t = this.add.text(x - 20, y - 10, this.iconFor(n.kind), { ...style, backgroundColor: isClickable ? '#222' : '#111', padding: { x: 6, y: 2 }, color: isClickable ? '#ffffff' : '#555555' })
            if (isClickable) {
                t.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.enterNode(n))
                // Add pulsating animation for available paths
                this.addPulsateAnimation(t)
            }
            const label = this.add.text(x + 14, y - 10, n.kind, { fontFamily: 'monospace', fontSize: '12px', color: '#aaa' })
            this.mapLayer.add(t)
            this.mapLayer.add(label)
        }

        this.contentHeight = this.gmap.rows * cellH + 40
    }

    private isSelectable(n: MapNode): boolean {
        // If no current node yet, only bottom row starts are valid
        if (!this.currentNodeId) return n.row === this.gmap.rows - 1 && n.kind === 'start'
        // Otherwise must be a forward edge of current node
        const cur = this.gmap.byId[this.currentNodeId]
        if (!cur) return false
        return cur.edgesTo.includes(n.id)
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

    private addPulsateAnimation(node: Phaser.GameObjects.Text): void {
        // Create a subtle pulsating effect by scaling and changing alpha
        this.tweens.add({
            targets: node,
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0.8,
            duration: 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        })
    }
}
