import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { EmittedEvent } from '../core/actions'
import type { CardInstance } from '../core/state'
import type { RunState } from '../core/run'
import { POTION_DEFS } from '../core/potions'
import { HandManager } from './HandManager'
import { EnemyDisplay } from './EnemyDisplay'
import { PlayerDisplay } from './PlayerDisplay'
import { DragSystem } from './DragSystem'
import { OverlayManager } from './OverlayManager'
import { VisualEffects } from './VisualEffects'
import { CombatChoiceOverlay } from './CombatChoiceOverlay'

export class CombatUI {
    private scene: Phaser.Scene
    private engine: Engine
    private run: RunState
    private handManager: HandManager
    private enemyDisplay: EnemyDisplay
    private playerDisplay: PlayerDisplay
    private dragSystem: DragSystem
    private overlayManager: OverlayManager
    private visualEffects: VisualEffects
    private choiceOverlay: CombatChoiceOverlay
    private pendingPotionIndex: number | null = null
    private pendingText?: Phaser.GameObjects.Text

    private onPlay?: (card: CardInstance, targets: string[]) => void
    private onPotion?: (potionIndex: number, targets: string[]) => void
    private onEnd?: () => void
    private onSubmitChoice?: (instanceIds: string[]) => void
    private onCancelChoice?: () => void
    private pointerMoveHandler?: (pointer: Phaser.Input.Pointer) => void
    private pointerUpHandler?: (pointer: Phaser.Input.Pointer) => void
    private resizeHandler?: () => void

    constructor(scene: Phaser.Scene, engine: Engine, run: RunState) {
        this.scene = scene
        this.engine = engine
        this.run = run
        this.handManager = new HandManager(scene, engine)
        this.enemyDisplay = new EnemyDisplay(scene, engine)
        this.playerDisplay = new PlayerDisplay(scene, engine, run)
        this.dragSystem = new DragSystem(scene, engine)
        this.overlayManager = new OverlayManager(scene, engine)
        this.visualEffects = new VisualEffects(scene)
        this.choiceOverlay = new CombatChoiceOverlay(scene, engine)
        this.setupEventHandlers()
        this.handManager.rebuildHand()
    }

    onPlayCard(callback: (card: CardInstance, targets: string[]) => void): void {
        this.onPlay = callback
    }

    onUsePotion(callback: (potionIndex: number, targets: string[]) => void): void {
        this.onPotion = callback
    }

    onEndTurn(callback: () => void): void {
        this.onEnd = callback
    }

    onSubmitPendingChoice(callback: (instanceIds: string[]) => void): void {
        this.onSubmitChoice = callback
    }

    onCancelPendingChoice(callback: () => void): void {
        this.onCancelChoice = callback
    }

    refreshRunData(run: RunState): void {
        this.run = run
        this.playerDisplay.setRun(run)
    }

    apply(events: EmittedEvent[]): void {
        for (const event of events) {
            if (event.kind === 'DamageApplied') {
                const enemyIndex = this.engine.state.enemies.findIndex(enemy => enemy.id === event.target)
                if (enemyIndex >= 0) this.enemyDisplay.flashEnemyText(enemyIndex)
                if (event.target === 'player') this.visualEffects.screenShake()
            }
        }
        this.update()
    }

    update(): void {
        this.handManager.rebuildHand()
        this.enemyDisplay.update()
        this.playerDisplay.update()
        this.overlayManager.refreshOverlays()
        this.choiceOverlay.refresh(this.engine.getPendingChoice())
    }

    destroy(): void {
        if (this.pointerMoveHandler) this.scene.input.off('pointermove', this.pointerMoveHandler)
        if (this.pointerUpHandler) this.scene.input.off('pointerup', this.pointerUpHandler)
        if (this.resizeHandler) this.scene.scale.off('resize', this.resizeHandler)
        this.pendingText?.destroy()
        this.handManager.destroy()
        this.enemyDisplay.destroy()
        this.playerDisplay.destroy()
        this.dragSystem.destroy()
        this.overlayManager.destroy()
        this.visualEffects.destroy()
        this.choiceOverlay.destroy()
    }

    private setupEventHandlers(): void {
        this.handManager.setOnCardDrag((card, cardIndex, pointer) => {
            if (this.pendingPotionIndex !== null || this.engine.getPendingChoice()) return
            this.dragSystem.startDrag(card, cardIndex, pointer)
        })

        this.dragSystem.setOnCardPlay((card, targets) => {
            if (this.engine.getPendingChoice()) return
            this.onPlay?.(card, targets)
            this.update()
        })
        this.dragSystem.setGetEnemyAtPoint((x, y) => this.enemyDisplay.getEnemyAtPoint(x, y))
        this.dragSystem.setGetEnemySprites(() => this.enemyDisplay.getEnemySprites())
        this.dragSystem.setGetPlayerSprite(() => this.playerDisplay.getPlayerSprite())

        this.enemyDisplay.setOnEnemyClick((enemyIndex) => {
            if (this.engine.getPendingChoice()) return
            if (this.pendingPotionIndex === null) return
            const potionId = this.run.potions[this.pendingPotionIndex]
            if (!potionId) return
            const potion = POTION_DEFS[potionId]
            if (potion.target !== 'single_enemy') return
            this.onPotion?.(this.pendingPotionIndex, [this.engine.state.enemies[enemyIndex].id])
            this.pendingPotionIndex = null
            this.pendingText?.destroy()
            this.pendingText = undefined
        })

        this.playerDisplay.setOnUsePotion((potionIndex) => {
            if (this.engine.getPendingChoice()) return
            const potionId = this.run.potions[potionIndex]
            if (!potionId) return
            const potion = POTION_DEFS[potionId]
            if (potion.target === 'single_enemy') {
                this.pendingPotionIndex = potionIndex
                this.pendingText?.destroy()
                this.pendingText = this.scene.add.text(this.scene.scale.width / 2, 24, 'Select an enemy for potion', {
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    color: '#ffffff',
                    backgroundColor: '#333333',
                    padding: { x: 8, y: 6 },
                }).setOrigin(0.5, 0)
                return
            }
            const targets = potion.target === 'player' ? [this.engine.state.player.id] : []
            this.onPotion?.(potionIndex, targets)
        })

        this.playerDisplay.setOnEndTurn(() => {
            if (this.pendingPotionIndex !== null || this.engine.getPendingChoice()) return
            this.onEnd?.()
            this.update()
        })
        this.playerDisplay.setOnOpenDeck(() => this.overlayManager.openDeckOverlay())
        this.choiceOverlay.setOnSubmit((instanceIds) => this.onSubmitChoice?.(instanceIds))
        this.choiceOverlay.setOnCancel(() => this.onCancelChoice?.())

        this.pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
            if (this.dragSystem.isCurrentlyDragging()) this.dragSystem.updateDrag(pointer)
        }
        this.pointerUpHandler = (pointer: Phaser.Input.Pointer) => {
            if (!this.dragSystem.isCurrentlyDragging()) return
            const played = this.dragSystem.endDrag(pointer)
            if (played) this.handManager.rebuildHand()
        }
        this.scene.input.on('pointermove', this.pointerMoveHandler)
        this.scene.input.on('pointerup', this.pointerUpHandler)

        this.resizeHandler = () => {
            this.enemyDisplay.handleScreenResize()
            this.handManager.rebuildHand()
            this.playerDisplay.update()
        }
        this.scene.scale.on('resize', this.resizeHandler)
    }
}
