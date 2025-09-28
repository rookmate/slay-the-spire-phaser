import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { EmittedEvent } from '../core/actions'
import type { CardInstance } from '../core/state'
import { HandManager } from './HandManager'
import { EnemyDisplay } from './EnemyDisplay'
import { PlayerDisplay } from './PlayerDisplay'
import { DragSystem } from './DragSystem'
import { OverlayManager } from './OverlayManager'
import { VisualEffects } from './VisualEffects'

export class CombatUI {
    private scene: Phaser.Scene
    private engine: Engine

    // Component instances
    private handManager!: HandManager
    private enemyDisplay!: EnemyDisplay
    private playerDisplay!: PlayerDisplay
    private dragSystem!: DragSystem
    private overlayManager!: OverlayManager
    private visualEffects!: VisualEffects

    private onPlay?: (card: CardInstance, targets: string[]) => void
    private onEnd?: () => void

    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
        this.initializeComponents()
        this.setupEventHandlers()
    }

    private initializeComponents(): void {
        // Initialize all components
        this.handManager = new HandManager(this.scene, this.engine)
        this.enemyDisplay = new EnemyDisplay(this.scene, this.engine)
        this.playerDisplay = new PlayerDisplay(this.scene, this.engine)
        this.dragSystem = new DragSystem(this.scene, this.engine)
        this.overlayManager = new OverlayManager(this.scene, this.engine)
        this.visualEffects = new VisualEffects(this.scene)

        // Initialize the hand display
        this.handManager.rebuildHand()
    }

    private setupEventHandlers(): void {
        // Set up component callbacks
        this.handManager.setOnCardDrag((card, cardIndex, pointer) => {
            this.dragSystem.startDrag(card, cardIndex, pointer)
        })

        this.handManager.setOnCardPlay((card, targets) => {
            this.onPlay?.(card, targets)
            this.update()
        })

        this.dragSystem.setOnCardPlay((card, targets) => {
            this.onPlay?.(card, targets)
            this.update()
        })

        this.dragSystem.setGetEnemyAtPoint((x, y) => {
            return this.enemyDisplay.getEnemyAtPoint(x, y)
        })

        this.playerDisplay.setOnEndTurn(() => {
            this.onEnd?.()
            this.update()
        })

        this.playerDisplay.setOnOpenDeck(() => {
            this.overlayManager.openDeckOverlay()
        })

        // Set up global input handlers
        this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.dragSystem.isCurrentlyDragging()) {
                this.dragSystem.updateDrag(pointer)
            }
        })

        this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (this.dragSystem.isCurrentlyDragging()) {
                const targetFound = this.dragSystem.endDrag(pointer)
                if (targetFound) {
                    this.handManager.rebuildHand()
                }
            }
        })

        // Handle screen resize events
        this.scene.scale.on('resize', () => {
            this.handleScreenResize()
        })
    }

    update(): void {
        this.handManager.rebuildHand()
        this.enemyDisplay.update()
        this.playerDisplay.update()
        this.overlayManager.refreshOverlays()
    }

    apply(events: EmittedEvent[]): void {
        if (events.length === 0) return

        // Process events for visual feedback
        for (const event of events) {
            if (event.kind === 'DamageApplied') {
                const enemyIndex = this.engine.state.enemies.findIndex(enemy => enemy.id === event.target)
                if (enemyIndex >= 0) {
                    this.enemyDisplay.flashEnemyText(enemyIndex)
                }

                // Screen shake for player damage
                if (event.target === 'player') {
                    this.visualEffects.screenShake()
                }
            }
        }

        this.update()
    }

    onPlayCard(fn: (card: CardInstance, targets: string[]) => void): void {
        this.onPlay = fn
    }

    onEndTurn(fn: () => void): void {
        this.onEnd = fn
    }

    private handleScreenResize(): void {
        // Rebuild layouts when screen size changes
        this.enemyDisplay.handleScreenResize()
        this.handManager.rebuildHand()
        this.playerDisplay.update()
    }

    destroy(): void {
        // Destroy all components
        this.handManager.destroy()
        this.enemyDisplay.destroy()
        this.playerDisplay.destroy()
        this.dragSystem.destroy()
        this.overlayManager.destroy()
        this.visualEffects.destroy()
    }
}