import { addRunMenu } from '../ui/runMenu'
import { loadSettings } from '../core/settings'
import { canEnterMapNode, enterMapNode } from '../core/relics/campaignRules'
import Phaser from 'phaser'
import { getAscensionLabel } from '../core/ascension'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { RNG } from '../core/rng'
import { getRunMap, type GeneratedMap, type MapNode } from '../core/map'
import { getRelicDisplayName } from '../core/relics'
import { getRunDestination } from '../core/progression'

export class MapScene extends Phaser.Scene {
    run!: RunState
    gmap!: GeneratedMap
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
        if (this.run.pendingAcquisitions?.length) { this.scene.start('RelicAcquisition', { run: this.run }); return }
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }
        this.add.text(16, 16, `Floor ${this.run.floor}  HP ${this.run.player.hp}/${this.run.player.maxHp}  Gold ${this.run.gold}`, style)
        this.add.text(16, 40, `Relics: ${this.run.relics.map(id => getRelicDisplayName(this.run, id)).join(', ') || 'None'}  Potions: ${this.run.potions.length}/${this.run.maxPotionSlots}`, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#cccccc',
        })
        this.add.text(16, 60, `Act ${this.run.act}  ${getAscensionLabel(this.run.asc)}  Keys: ${Object.entries(this.run.keys).filter(([, held]) => held).map(([key]) => key).join(", ") || "none"}`, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#cccccc',
        })

        // Generate map for this act
        this.gmap = getRunMap(this.run)
        this.drawGraph()
        addRunMenu(this, this.run)

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
        if (!this.isSelectable(node)) return
        const rng = new RNG(`${this.run.seed}-unknown-${this.run.floor}`)
        const kind = enterMapNode(this.run, this.gmap, node, rng)
        this.run.burningEliteActive = Boolean(this.run.keysEnabled !== false && node.burning && !this.run.keys.emerald)
        if (kind === 'monster' || kind === 'elite' || kind === 'boss') {
            this.run.pendingRoom = { scene: 'Combat', roomKind: kind }
        } else if (kind === 'rest') {
            this.run.pendingRoom = { scene: 'Campfire' }
        } else if (kind === 'shop') {
            this.run.pendingRoom = { scene: 'Shop' }
        } else if (kind === 'chest') {
            const rewardKind = node.kind === 'unknown' ? 'unknown-chest' : 'chest'
            this.run.pendingRoom = {
                scene: 'Chest', rewardSeed: `${this.run.seed}-reward-${node.id}-${rewardKind}`,
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
            const label = this.add.text(x + 14, y - 10, n.burning && !this.run.keys.emerald ? 'burning elite' : n.kind, { fontFamily: 'monospace', fontSize: '12px', color: '#aaa' })
            this.mapLayer.add(t)
            this.mapLayer.add(label)
        }

        this.contentHeight = this.gmap.rows * cellH + 40
    }

    private isSelectable(n: MapNode): boolean {
        return canEnterMapNode(this.run, this.gmap, n)
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
        if (loadSettings().reducedMotion) return
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
