import { access, bindAction } from '../ui/accessibility'
import { characterTexture } from '../ui/portraits'
import { addRunMenu } from '../ui/runMenu'
import { canEnterMapNode } from '../core/relics/campaignRules'
import Phaser from 'phaser'
import { getAscensionLabel } from '../core/ascension'
import { CHARACTERS } from '../core/characters'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { enterRoom } from '../core/rooms'
import { getRunMap, type GeneratedMap, type MapNode, type RoomKind } from '../core/map'
import { getRelicDisplayName } from '../core/relics'
import { getRunDestination } from '../core/progression'
import { bodyText, headingText, palette, roomBackdrop } from '../ui/theme'
import { mapLayout } from '../ui/layout'
import { drawMapIcon } from '../ui/mapIcons'

const actNames = { 1: 'The Exordium', 2: 'The City', 3: 'The Beyond', 4: 'The Ending' }
const roomNames: Record<RoomKind, string> = { monster: 'Fight', elite: 'Elite', rest: 'Rest', shop: 'Merchant', unknown: 'Unknown', chest: 'Treasure', boss: 'Boss', start: 'Start' }

export class MapScene extends Phaser.Scene {
    run!: RunState
    gmap!: GeneratedMap
    private mapLayer!: Phaser.GameObjects.Container
    private contentHeight = 0
    private dragging = false
    private dragged = false
    private pressedNode?: string
    private dragStartX = 0
    private dragStartY = 0
    private layerStartY = 0
    constructor() { super('Map') }

    create(data: { run: RunState }): void {
        this.run = data.run
        this.dragging = false; this.dragged = false; this.pressedNode = undefined
        if (this.run.pendingAcquisitions?.length) { this.scene.start('RelicAcquisition', { run: this.run }); return }
        roomBackdrop(this)
        this.gmap = getRunMap(this.run)
        this.add.text(24, 14, actNames[this.run.act], headingText).setResolution(2)
        this.add.text(25, 48, `Act ${this.run.act} · ${getAscensionLabel(this.run.asc)}`, { ...bodyText, fontSize: '12px', color: palette.muted }).setResolution(2)
        this.drawSidebar()
        this.drawGraph()
        addRunMenu(this, this.run)
        this.bindScrolling()
    }

    private drawSidebar(): void {
        this.add.image(55, 114, ...characterTexture(this, this.run.character)).setDisplaySize(42, 50)
        this.add.text(87, 91, CHARACTERS[this.run.character].name, { ...headingText, fontSize: '23px' }).setResolution(2)
        this.add.text(87, 121, `${this.run.player.hp}/${this.run.player.maxHp} HP · ${this.run.gold} gold`, { ...bodyText, fontSize: '13px', color: palette.gold }).setResolution(2)
        this.add.text(24, 160, `Floor ${this.run.floor}`, { ...headingText, fontSize: '25px' }).setResolution(2)
        this.add.text(24, 194, 'Choose your next room.', { ...bodyText, fontSize: '14px', color: palette.muted }).setResolution(2)
        const legend: RoomKind[] = ['monster', 'elite', 'rest', 'shop', 'unknown', 'chest']
        const icons = this.add.graphics()
        legend.forEach((kind, i) => {
            const x = 34 + i % 2 * 105, y = 235 + Math.floor(i / 2) * 36
            drawMapIcon(icons, kind, x, y, 0xc1a575)
            this.add.text(x + 18, y - 8, roomNames[kind], { ...bodyText, fontSize: '13px', color: palette.muted }).setResolution(2)
        })
        this.add.text(24, 339, `Potions ${this.run.potions.length}/${this.run.maxPotionSlots}`, { ...bodyText, fontSize: '13px', color: palette.muted }).setResolution(2)
        const keys = Object.entries(this.run.keys).filter(([, held]) => held).map(([key]) => key).join(', ')
        this.add.text(24, 361, `Keys: ${keys || 'none'}`, { ...bodyText, fontSize: '12px', color: palette.gold, wordWrap: { width: 199 } }).setResolution(2)
        this.add.text(24, 410, `Relics: ${this.run.relics.map(id => getRelicDisplayName(this.run, id)).join(', ') || 'None'}`, { ...bodyText, fontSize: '12px', color: palette.muted, wordWrap: { width: 740 } }).setResolution(2)
    }

    private drawGraph(): void {
        const { viewport, cellHeight, nodeX } = mapLayout(this.scale.width, this.gmap.cols)
        this.add.rectangle(viewport.x, viewport.y, viewport.width, viewport.height, 0xd7c7a4).setOrigin(0).setStrokeStyle(1, 0x89714b).setData('mapViewport', true)
        const paper = this.add.graphics().lineStyle(1, 0x8c7453, 0.12)
        for (let y = viewport.y + 9; y < viewport.bottom; y += 11) paper.lineBetween(viewport.x + 7, y, viewport.right - 7, y)
        this.mapLayer = this.add.container(0, viewport.y)
        const maskShape = this.make.graphics({ x: 0, y: 0 }).fillStyle(0xffffff).fillRect(viewport.x, viewport.y, viewport.width, viewport.height)
        const mask = maskShape.createGeometryMask(); this.mapLayer.setMask(mask)
        this.events.once('shutdown', () => { mask.destroy(); maskShape.destroy() })
        const current = this.run.mapProgress?.currentNodeId
        const edges = this.add.graphics()
        for (const node of this.gmap.nodes) for (const id of node.edgesTo) {
            const next = this.gmap.byId[id], active = node.id === current
            edges.lineStyle(active ? 2 : 1, active ? 0x885329 : 0x78684d, active ? 1 : 0.42)
                .lineBetween(nodeX(node.col), 32 + node.row * cellHeight, nodeX(next.col), 32 + next.row * cellHeight)
        }
        this.mapLayer.add(edges)
        for (const node of this.gmap.nodes) {
            const x = nodeX(node.col), y = 32 + node.row * cellHeight, available = canEnterMapNode(this.run, this.gmap, node), selected = current === node.id
            const color = available ? 0x3e2b1b : selected ? 0x714c2c : 0x8f8066
            const ring = this.add.circle(x, y, 16, available ? 0xf3e5c5 : selected ? 0xc6a978 : 0xd7c7a4).setStrokeStyle(available ? 2 : 1, color)
            ring.setData('mapNodeId', node.id)
            if (available) ring.setInteractive({ useHandCursor: true }).on('pointerup', (pointer: Phaser.Input.Pointer) => {
                if (this.pressedNode === node.id && !this.dragged && viewport.contains(pointer.x, pointer.y)) this.enterNode(node)
            })
            if (available) bindAction(ring, () => this.enterNode(node), { id: `room:${node.id}`, label: `Floor ${node.row + 1}, ${node.burning && !this.run.keys.emerald ? 'Burning elite' : roomNames[node.kind]}, path ${node.col + 1}. Leads to ${node.edgesTo.map(id => roomNames[this.gmap.byId[id].kind]).join(', ') || 'the next act'}.`, onFocus: () => this.scrollTo(viewport.y + viewport.height / 2 - y) })
            const icon = this.add.graphics(); drawMapIcon(icon, node.kind, x, y, color)
            const label = this.add.text(x, y + 19, node.burning && !this.run.keys.emerald ? 'Burning elite' : roomNames[node.kind], { ...bodyText, fontSize: '10px', fontStyle: available ? 'bold' : 'normal', color: available ? '#49301c' : '#867458' }).setOrigin(0.5, 0).setResolution(2)
            this.mapLayer.add([ring, icon, label])
            if (selected) this.mapLayer.add(this.add.text(x + 20, y - 9, 'You', { ...bodyText, fontSize: '11px', color: '#6e3f23' }).setResolution(2))
        }
        this.contentHeight = this.gmap.rows * cellHeight + 16
        const nextRows = this.gmap.nodes.filter(node => canEnterMapNode(this.run, this.gmap, node)).map(node => node.row)
        const row = nextRows.length ? Math.max(...nextRows) : this.gmap.rows - 1
        this.scrollTo(viewport.bottom - 55 - (32 + row * cellHeight))
        this.add.text(viewport.x + 12, viewport.bottom - 17, 'Scroll to explore the route', { ...bodyText, fontSize: '10px', color: '#786347', backgroundColor: '#d7c7a4' }).setResolution(2)
    }

    private scrollTo(y: number): void {
        const { viewport } = mapLayout(this.scale.width, this.gmap.cols)
        this.mapLayer.y = Phaser.Math.Clamp(y, Math.min(viewport.y, viewport.bottom - this.contentHeight), viewport.y)
        access(this).refresh()
    }

    private bindScrolling(): void {
        const { viewport } = mapLayout(this.scale.width, this.gmap.cols)
        const wheel = (pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
            if (viewport.contains(pointer.x, pointer.y)) { this.dragged = true; this.scrollTo(this.mapLayer.y - dy) }
        }
        const down = (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
            this.dragging = viewport.contains(pointer.x, pointer.y); this.dragged = false
            this.pressedNode = this.dragging ? objects.find(object => object.getData('mapNodeId'))?.getData('mapNodeId') : undefined
            this.dragStartX = pointer.x
            this.dragStartY = pointer.y; this.layerStartY = this.mapLayer.y
        }
        const move = (pointer: Phaser.Input.Pointer) => {
            if (!this.dragging) return
            const delta = pointer.y - this.dragStartY
            if (Math.hypot(pointer.x - this.dragStartX, delta) > 5) this.dragged = true
            if (this.dragged) this.scrollTo(this.layerStartY + delta)
        }
        const up = () => { this.dragging = false; this.pressedNode = undefined }
        this.input.on('wheel', wheel).on('pointerdown', down).on('pointermove', move).on('pointerup', up).on('pointerupoutside', up)
        this.events.once('shutdown', () => {
            this.input.off('wheel', wheel).off('pointerdown', down).off('pointermove', move).off('pointerup', up).off('pointerupoutside', up)
        })
    }

    private enterNode(node: MapNode): void {
        if (!enterRoom(this.run, node)) return
        saveRun(this.run)
        const next = getRunDestination(this.run); this.scene.start(next.scene, next.data)
    }
}
