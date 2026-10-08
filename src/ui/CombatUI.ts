import { resolveCard } from '../core/cards'
import { playCue } from './sound'
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
    private selectedCard?: CardInstance
    private keyHandler?: (event: KeyboardEvent) => void
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
            if (event.kind === 'CardPlayed') playCue('card')
            if (event.kind === 'TurnChanged' && event.turn === 'player') playCue('turn')
            if (event.kind === 'Healed' && event.amount > 0 && event.target === this.engine.state.player.id) this.visualEffects.showDamageNumber(event.amount, 110, 95, true)
            if (event.kind === 'DamageApplied') {
                const enemyIndex = this.engine.state.enemies.findIndex(enemy => enemy.id === event.target)
                if (enemyIndex >= 0) {
                    this.enemyDisplay.flashEnemyText(enemyIndex)
                    const sprite = this.enemyDisplay.getEnemySprites()[enemyIndex]
                    if (sprite && event.amount > 0) this.visualEffects.showDamageNumber(event.amount, sprite.x, sprite.y - 25)
                }
                if (event.target === this.engine.state.player.id && event.amount > 0) { this.visualEffects.screenShake(); this.visualEffects.showDamageNumber(event.amount, 110, 95) }
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
        if (this.keyHandler) this.scene.input.keyboard?.off('keydown', this.keyHandler)
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

    private clearTargeting(): void {
        this.selectedCard = undefined
        this.pendingPotionIndex = null
        this.pendingText?.destroy()
        this.pendingText = undefined
    }

    private setupEventHandlers(): void {
        this.keyHandler = (event: KeyboardEvent) => {
            if (event.repeat) return
            if (event.key === 'Escape') {
                this.clearTargeting()
                this.dragSystem.cancelDrag(); this.playerDisplay.closePotionMenu(); this.overlayManager.close(); return
            }
            if (this.dragSystem.isCurrentlyDragging() || !this.engine.canAcceptInput() || this.overlayManager.isOpen() || this.playerDisplay.isPotionMenuOpen()) return
            if (event.key.toLowerCase() === 'e') { this.clearTargeting(); this.onEnd?.(); return }
            if (!/^[0-9]$/.test(event.key)) return
            const index = event.key === '0' ? 9 : Number(event.key) - 1, card = this.engine.state.player.hand[index]
            if (!card) return
            this.clearTargeting()
            const def = resolveCard(card)
            if (def.targeting?.type === 'single_enemy' || def.targeting?.type === 'any') {
                this.selectedCard = card; this.pendingPotionIndex = null; this.pendingText?.destroy()
                this.pendingText = this.scene.add.text(400, 24, `${def.name}: select an enemy`, { fontFamily: 'monospace', fontSize: '16px', color: '#fff', backgroundColor: '#333' }).setOrigin(0.5).setDepth(6000)
            } else this.onPlay?.(card, def.targeting?.type === 'all_enemies' ? this.engine.state.enemies.filter(e => e.hp > 0).map(e => e.id) : def.targeting?.type === 'player' ? [this.engine.state.player.id] : [])
        }
        this.scene.input.keyboard?.on('keydown', this.keyHandler)

        this.handManager.setOnCardDrag((card, cardIndex, pointer) => {
            if (this.engine.getPendingChoice() || this.playerDisplay.isPotionMenuOpen()) return
            this.clearTargeting()
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
            if (this.selectedCard) {
                const card = this.selectedCard; this.selectedCard = undefined; this.pendingText?.destroy(); this.pendingText = undefined
                this.onPlay?.(card, [this.engine.state.enemies[enemyIndex].id]); return
            }
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
            if (this.engine.getPendingChoice() || this.dragSystem.isCurrentlyDragging()) return
            this.clearTargeting()
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
            this.selectedCard = undefined; this.pendingText?.destroy(); this.pendingText = undefined
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
