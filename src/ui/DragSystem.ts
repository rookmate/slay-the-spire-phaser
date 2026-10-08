import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { CardInstance } from '../core/state'
import { resolveCard } from '../core/cards'
import { Card } from './Card'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'
import { UI_FONT } from './theme'

type Point = { x: number; y: number }
type Selection = {
    view: Card
    card: CardInstance
    mode: 'drag' | 'keyboard'
    aimed: boolean
    start: Point
    grab: Point
    previewTarget?: string
}

export class DragSystem {
    private scene: Phaser.Scene
    private engine: Engine
    private selection?: Selection
    private aim: Phaser.GameObjects.Graphics
    private hint: Phaser.GameObjects.Text
    private onCardPlay?: (view: Card, targets: string[]) => void
    private onSelectionChange?: (view?: Card) => void
    private getEnemyAtPoint?: (x: number, y: number) => number
    private getEnemySprites?: () => Phaser.GameObjects.Image[]
    private getPlayerSprite?: () => Phaser.GameObjects.Image | undefined

    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
        this.aim = scene.add.graphics().setDepth(COMBAT_UI_CONFIG.depths.dragPreview).setName('card-targeting')
        this.hint = scene.add.text(scene.scale.width / 2, 24, '', {
            resolution: 2, fontFamily: UI_FONT, fontSize: '14px', color: '#f4d58a',
            backgroundColor: '#211e18', padding: { x: 12, y: 6 },
        }).setOrigin(0.5).setDepth(COMBAT_UI_CONFIG.depths.dragPreview).setVisible(false)
        scene.events.on(Phaser.Scenes.Events.UPDATE, this.drawAim, this)
    }

    setOnCardPlay(callback: (view: Card, targets: string[]) => void): void { this.onCardPlay = callback }
    setOnSelectionChange(callback: (view?: Card) => void): void { this.onSelectionChange = callback }
    setGetEnemyAtPoint(callback: (x: number, y: number) => number): void { this.getEnemyAtPoint = callback }
    setGetEnemySprites(callback: () => Phaser.GameObjects.Image[]): void { this.getEnemySprites = callback }
    setGetPlayerSprite(callback: () => Phaser.GameObjects.Image | undefined): void { this.getPlayerSprite = callback }

    startDrag(view: Card, _cardIndex: number, pointer: Phaser.Input.Pointer): void {
        this.begin(view, 'drag', pointer)
    }

    selectCard(view: Card): void { this.begin(view, 'keyboard', this.scene.input.activePointer) }

    private begin(view: Card, mode: Selection['mode'], pointer: Phaser.Input.Pointer): void {
        if (this.isCurrentlyDragging()) return
        this.cancelDrag()
        const card = view.getCardInstance(), targeting = resolveCard(card).targeting?.type
        const aimed = targeting === 'single_enemy' || targeting === 'any'
        const candidates = aimed ? this.engine.state.enemies.filter(enemy => enemy.hp > 0).map(enemy => [enemy.id]) : [this.automaticTargets(card)]
        if (!candidates.some(targets => this.engine.canPlayCard(card, targets))) return
        this.selection = { view, card, mode, aimed,
            start: { x: pointer.worldX, y: pointer.worldY }, grab: { x: pointer.worldX - view.x, y: pointer.worldY - view.y } }
        this.onSelectionChange?.(view)
        this.drawAim()
    }

    updateDrag(pointer: Phaser.Input.Pointer): void {
        const selection = this.selection
        if (!selection) return
        // Attacks stay lifted in the hand so neither the card nor the pointer hides the target.
        if (selection.mode === 'drag' && !selection.aimed) {
            this.scene.tweens.killTweensOf(selection.view)
            selection.view.setPosition(
                Phaser.Math.Clamp(pointer.worldX - selection.grab.x, 16, this.scene.scale.width - Card.CARD_WIDTH - 16),
                Phaser.Math.Clamp(pointer.worldY - selection.grab.y, 52, this.scene.scale.height - Card.CARD_HEIGHT - 56))
        }
        this.drawAim()
    }

    private automaticTargets(card: CardInstance): string[] {
        const targeting = resolveCard(card).targeting?.type
        if (targeting === 'all_enemies') return this.engine.state.enemies.filter(enemy => enemy.hp > 0).map(enemy => enemy.id)
        if (targeting === 'player') return [this.engine.state.player.id]
        return []
    }

    private dropTargets(pointer: Phaser.Input.Pointer): string[] | undefined {
        const selection = this.selection
        if (!selection) return
        let targets: string[]
        if (selection.aimed) {
            const index = this.getEnemyAtPoint?.(pointer.worldX, pointer.worldY) ?? -1
            const enemy = this.engine.state.enemies[index]
            if (!enemy || enemy.hp <= 0) return
            targets = [enemy.id]
        } else {
            if (selection.start.y - pointer.worldY < 50) return
            targets = this.automaticTargets(selection.card)
        }
        return this.engine.canPlayCard(selection.card, targets) ? targets : undefined
    }

    endDrag(pointer: Phaser.Input.Pointer): boolean {
        if (!this.isCurrentlyDragging()) return false
        const targets = this.dropTargets(pointer)
        if (targets) this.commit(targets)
        else this.cancelDrag()
        return targets !== undefined
    }

    selectEnemy(index: number): boolean {
        const selection = this.selection, enemy = this.engine.state.enemies[index]
        if (selection?.mode !== 'keyboard' || !enemy || !this.engine.canPlayCard(selection.card, [enemy.id])) return false
        this.commit([enemy.id])
        return true
    }

    private commit(targets: string[]): void {
        const view = this.selection!.view
        this.cancelDrag()
        this.onCardPlay?.(view, targets)
    }

    private drawAim(): void {
        this.aim.clear()
        const selection = this.selection
        if (!selection) return
        const pointer = this.scene.input.activePointer, targets = this.dropTargets(pointer)
        const color = targets ? 0xf4d58a : 0xb8aa8d
        const sprites = this.getEnemySprites?.() ?? []
        const targetId = selection.aimed ? targets?.[0] : undefined
        if (targetId !== selection.previewTarget) {
            selection.previewTarget = targetId
            selection.view.setCombatPreview(this.engine, targetId)
        }
        sprites.forEach((sprite, index) => {
            const enemy = this.engine.state.enemies[index]
            if (!enemy || enemy.hp <= 0) return
            if (!selection.aimed && resolveCard(selection.card).targeting?.type !== 'all_enemies') return
            const chosen = targets?.includes(enemy.id), bounds = sprite.getBounds()
            this.aim.lineStyle(chosen ? 2 : 1, chosen ? 0xf4d58a : 0xb8aa8d, chosen ? 1 : 0.45)
            this.aim.strokeEllipse(sprite.x, bounds.bottom + 4, bounds.width + 16, 10)
            if (chosen) {
                const x = bounds.left - 5, y = bounds.top - 5, right = bounds.right + 5, bottom = bounds.bottom + 5
                for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [right, y, -1, 1], [x, bottom, 1, -1], [right, bottom, -1, -1]]) {
                    this.aim.lineBetween(cx, cy, cx + dx * 10, cy)
                    this.aim.lineBetween(cx, cy, cx, cy + dy * 10)
                }
            }
        })
        if (selection.aimed) {
            const sprite = sprites[this.engine.state.enemies.findIndex(enemy => enemy.id === targetId)]
            const start = new Phaser.Math.Vector2(selection.view.x + Card.CARD_WIDTH / 2, selection.view.y - 7)
            const end = new Phaser.Math.Vector2(sprite?.x ?? pointer.worldX, sprite?.y ?? pointer.worldY)
            if (Phaser.Math.Distance.BetweenPoints(start, end) > 24) {
                const curve = new Phaser.Curves.CubicBezier(start, new Phaser.Math.Vector2(start.x, start.y - 85), new Phaser.Math.Vector2(end.x, end.y + 45), end)
                this.aim.lineStyle(6, 0x171610, 0.8).strokePoints(curve.getPoints(32))
                this.aim.lineStyle(2, color, 1).strokePoints(curve.getPoints(32))
                const angle = curve.getTangent(1).angle(), size = 10
                this.aim.fillStyle(color).fillTriangle(end.x, end.y,
                    end.x - Math.cos(angle - 0.45) * size, end.y - Math.sin(angle - 0.45) * size,
                    end.x - Math.cos(angle + 0.45) * size, end.y - Math.sin(angle + 0.45) * size)
            }
        } else if (targets && resolveCard(selection.card).targeting?.type !== 'all_enemies') {
            const player = this.getPlayerSprite?.()
            if (player) this.aim.lineStyle(2, color).strokeEllipse(player.x, player.getBounds().bottom + 3, 80, 12)
        }
        const enemy = this.engine.state.enemies.find(enemy => enemy.id === targetId)
        const instruction = selection.aimed
            ? enemy ? `${selection.mode === 'drag' ? 'Release' : 'Click'} to play on ${enemy.name}` : 'Aim at an enemy'
            : targets ? 'Release to play' : 'Drag upward to play'
        this.hint.setText(`${instruction}  ·  Esc to cancel`).setColor(targets ? '#f4d58a' : '#c3b69c').setVisible(true)
    }

    cancelDrag(): void {
        if (!this.selection) return
        this.selection.view.setCombatPreview(this.engine)
        this.selection = undefined
        this.aim.clear()
        this.hint.setVisible(false)
        this.onSelectionChange?.()
    }

    isCurrentlyDragging(): boolean { return this.selection?.mode === 'drag' }
    isTargeting(): boolean { return !!this.selection }

    destroy(): void {
        this.cancelDrag()
        this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.drawAim, this)
        this.aim.destroy()
        this.hint.destroy()
    }
}
