import { access, editingText } from './accessibility'
import { enemyIntent } from './help/combat'
import { UI_FONT } from './theme'
import { menuButton } from './menu'
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
import type { Card } from './Card'

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
    private keyHandler?: (event: KeyboardEvent) => void
    private pendingPotionIndex: number | null = null
    private pendingText?: Phaser.GameObjects.Text

    private onPlay?: (card: CardInstance, targets: string[]) => void
    private onPotion?: (potionIndex: number, targets: string[]) => void
    private onEnd?: () => void
    private onMenu?: () => void
    private onSubmitChoice?: (instanceIds: string[]) => void
    private onCancelChoice?: () => void
    private pointerMoveHandler?: (pointer: Phaser.Input.Pointer) => void
    private pointerUpHandler?: (pointer: Phaser.Input.Pointer) => void
    private resizeHandler?: () => void
    private cancelDragHandler = () => this.dragSystem.cancelDrag()

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
        this.handManager.refreshHand()
        menuButton(scene, 624, 8, 'Menu', () => this.onMenu?.()).setDepth(13000)
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

    onOpenMenu(callback: () => void): void { this.onMenu = callback }

    clearTransientInput(): void {
        this.clearTargeting()
        this.handManager.inspectCard(-1)
        this.playerDisplay.closePotionMenu()
        this.overlayManager.close()
        this.choiceOverlay.dismissInspection()
    }

    onSubmitPendingChoice(callback: (instanceIds: string[]) => void): void {
        this.onSubmitChoice = callback
    }

    onCancelPendingChoice(callback: () => void): void {
        this.onCancelChoice = callback
    }

    apply(events: EmittedEvent[]): void {
        for (const event of events) {
            if (event.kind === 'CardPlayed') playCue('card')
            if (event.kind === 'CardExhausted') playCue('exhaust')
            if (event.kind === 'TurnChanged' && event.turn === 'player') playCue('turn')
            if (event.kind === 'Healed' && event.amount > 0 && event.target === this.engine.state.player.id) this.visualEffects.showDamageNumber(event.amount, 110, 95, true)
            if (event.kind === 'OrbChanneled') {
                playCue('power')
                this.visualEffects.showImpact(110, 115, 'orb', { lightning: 0xe6ca77, frost: 0xa2d8d7, dark: 0xaf96c5, plasma: 0xefb989 }[event.orbType])
            }
            if (event.kind === 'StanceChanged') {
                playCue('power')
                this.visualEffects.showImpact(110, 115, 'stance', { neutral: 0xc6bea9, calm: 0x9cc7d1, wrath: 0xe28d7b, divinity: 0xf6d67f }[event.stance])
            }
            if (!('target' in event)) continue
            const enemyIndex = this.engine.state.enemies.findIndex(enemy => enemy.id === event.target)
            const sprite = enemyIndex >= 0 ? this.enemyDisplay.getEnemySprites()[enemyIndex] : undefined
            const x = sprite?.x ?? 110, y = sprite?.y ?? 115
            if (event.kind === 'BlockGained' && event.amount > 0) { playCue('block'); this.visualEffects.showImpact(x, y, 'block', 0xa9ccd6) }
            if (event.kind === 'PowerApplied') this.visualEffects.showImpact(x, y, 'power', event.powerId === 'POISON' ? 0xadd07b : 0xccb28d)
            if (event.kind === 'DamageApplied' && event.amount > 0) {
                if (enemyIndex >= 0) this.enemyDisplay.flashEnemyText(enemyIndex)
                this.visualEffects.showImpact(x, y, event.actualDamage > 0 ? 'hit' : 'block', event.actualDamage > 0 ? 0xe3c698 : 0xa9ccd6)
                if (event.actualDamage > 0) this.visualEffects.showDamageNumber(event.actualDamage, x, y - 25)
                else playCue('block')
                if (event.target === this.engine.state.player.id && event.actualDamage > 0) this.visualEffects.screenShake()
            }
            if (event.kind === 'HpLost' && event.amount > 0) this.visualEffects.showDamageNumber(event.amount, x, y - 25)
        }
        this.update()
        const player = this.engine.state.player
        access(this.scene).announce(`Turn ${this.engine.state.turnNumber}. ${player.hp} HP, ${player.block} Block, ${player.energy} energy. ${this.engine.state.enemies.filter(enemy => enemy.hp > 0).map(enemy => `${enemy.name}: ${enemy.hp} HP, ${enemyIntent(this.engine, enemy)}`).join('. ')}`)
    }

    update(): void {
        this.dragSystem.cancelDrag()
        this.handManager.refreshHand()
        this.enemyDisplay.update()
        this.playerDisplay.update()
        this.overlayManager.refreshOverlays()
        this.choiceOverlay.refresh(this.engine.getPendingChoice())
        access(this.scene).refresh()
    }

    destroy(): void {
        if (this.keyHandler) this.scene.input.keyboard?.off('keydown', this.keyHandler)
        if (this.pointerMoveHandler) this.scene.input.off('pointermove', this.pointerMoveHandler)
        if (this.pointerUpHandler) this.scene.input.off('pointerup', this.pointerUpHandler)
        this.scene.input.off('pointerupoutside', this.cancelDragHandler)
        this.scene.game.events.off(Phaser.Core.Events.BLUR, this.cancelDragHandler)
        if (this.resizeHandler) this.scene.scale.off('resize', this.resizeHandler)
        this.pendingText?.destroy()
        this.dragSystem.destroy()
        this.handManager.destroy()
        this.enemyDisplay.destroy()
        this.playerDisplay.destroy()
        this.overlayManager.destroy()
        this.visualEffects.destroy()
        this.choiceOverlay.destroy()
    }

    private clearTargeting(): void {
        this.dragSystem.cancelDrag()
        this.pendingPotionIndex = null
        this.pendingText?.destroy()
        this.pendingText = undefined
    }

    private playCard(view: Card, targets: string[]): void {
        const card = view.getCardInstance()
        if (!this.engine.canPlayCard(card, targets)) return
        const targetIndex = this.engine.state.enemies.findIndex(enemy => enemy.id === targets[0])
        const target = targetIndex >= 0 ? this.enemyDisplay.getEnemySprites()[targetIndex] : this.playerDisplay.getPlayerSprite()
        this.handManager.detachCard(view)
        this.visualEffects.playCard(view, target?.x ?? 400, target?.y ?? 110)
        this.onPlay?.(card, targets)
    }

    private activateCard(view: Card): void {
        if (!this.engine.canAcceptInput() || this.overlayManager.isOpen() || this.playerDisplay.isPotionMenuOpen()) return
        this.clearTargeting()
        const def = resolveCard(view.getCardInstance())
        if (def.targeting?.type === 'single_enemy' || def.targeting?.type === 'any') {
            this.dragSystem.selectCard(view)
            const target = this.engine.state.enemies.find(enemy => this.engine.canPlayCard(view.getCardInstance(), [enemy.id]))
            if (target) access(this.scene).focus(`target:${target.id}`)
            access(this.scene).announce(`Select an enemy for ${def.name}.`)
        } else this.playCard(view, def.targeting?.type === 'all_enemies' ? this.engine.state.enemies.filter(e => e.hp > 0).map(e => e.id) : def.targeting?.type === 'player' ? [this.engine.state.player.id] : [])
    }

    private setupEventHandlers(): void {
        this.handManager.setOnActivate(view => this.activateCard(view))
        this.keyHandler = (event: KeyboardEvent) => {
            if (event.repeat || editingText(event)) return
            if (event.key === 'Escape') {
                if (this.choiceOverlay.dismissInspection()) return
                const dismiss = this.dragSystem.isTargeting() || this.pendingPotionIndex !== null || this.handManager.isInspecting()
                    || this.playerDisplay.isPotionMenuOpen() || this.overlayManager.isOpen()
                if (dismiss) this.clearTransientInput()
                else this.onMenu?.()
                return
            }
            if (this.dragSystem.isCurrentlyDragging() || !this.engine.canAcceptInput() || this.overlayManager.isOpen() || this.playerDisplay.isPotionMenuOpen()) return
            if (event.key.toLowerCase() === 'e') { this.clearTargeting(); this.onEnd?.(); return }
            if (!/^[0-9]$/.test(event.key)) return
            const index = event.key === '0' ? 9 : Number(event.key) - 1, card = this.engine.state.player.hand[index]
            if (!card) return
            if (event.altKey) { this.handManager.inspectCard(index); return }
            this.activateCard(this.handManager.getHandCards()[index])
        }
        this.scene.input.keyboard?.on('keydown', this.keyHandler)

        this.handManager.setOnCardDrag((card, cardIndex, pointer) => {
            if (this.engine.getPendingChoice() || this.playerDisplay.isPotionMenuOpen()) return
            this.clearTargeting()
            this.dragSystem.startDrag(card, cardIndex, pointer)
        })

        this.dragSystem.setOnCardPlay((view, targets) => this.playCard(view, targets))
        this.dragSystem.setOnSelectionChange(view => this.handManager.focusCard(view))
        this.dragSystem.setGetEnemyAtPoint((x, y) => this.enemyDisplay.getEnemyAtPoint(x, y))
        this.dragSystem.setGetEnemySprites(() => this.enemyDisplay.getEnemySprites())
        this.dragSystem.setGetPlayerSprite(() => this.playerDisplay.getPlayerSprite())

        this.enemyDisplay.setOnEnemyClick((enemyIndex) => {
            if (this.engine.getPendingChoice()) return
            if (this.dragSystem.selectEnemy(enemyIndex)) return
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
                    resolution: 2, fontFamily: UI_FONT,
                    fontSize: '16px',
                    color: '#ffffff',
                    backgroundColor: '#353126',
                    padding: { x: 8, y: 6 },
                }).setOrigin(0.5, 0)
                const target = this.engine.state.enemies.find(enemy => enemy.hp > 0)
                if (target) access(this.scene).focus(`target:${target.id}`)
                access(this.scene).announce(`Select an enemy for ${potion.name}.`)
                return
            }
            const targets = potion.target === 'player' ? [this.engine.state.player.id] : []
            this.onPotion?.(potionIndex, targets)
        })

        this.playerDisplay.setOnEndTurn(() => {
            if (this.pendingPotionIndex !== null || this.engine.getPendingChoice() || this.dragSystem.isCurrentlyDragging()) return
            this.clearTargeting()
            this.onEnd?.()
        })
        this.overlayManager.setOnOpen(() => { this.clearTargeting(); this.handManager.inspectCard(-1) })
        this.playerDisplay.setOnInspect(() => this.overlayManager.openStatus(this.engine.state.player.id))
        this.enemyDisplay.setOnInspect(id => this.overlayManager.openStatus(id))
        this.playerDisplay.setOnOpenDeck(() => this.overlayManager.openDeckOverlay())
        this.choiceOverlay.setOnSubmit((instanceIds) => this.onSubmitChoice?.(instanceIds))
        this.choiceOverlay.setOnCancel(() => this.onCancelChoice?.())

        this.pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
            if (this.dragSystem.isTargeting()) this.dragSystem.updateDrag(pointer)
        }
        this.pointerUpHandler = (pointer: Phaser.Input.Pointer) => {
            if (!this.dragSystem.isCurrentlyDragging()) return
            this.dragSystem.endDrag(pointer)
        }
        this.scene.input.on('pointermove', this.pointerMoveHandler)
        this.scene.input.on('pointerup', this.pointerUpHandler)
        this.scene.input.on('pointerupoutside', this.cancelDragHandler)
        this.scene.game.events.on(Phaser.Core.Events.BLUR, this.cancelDragHandler)

        this.resizeHandler = () => {
            this.dragSystem.cancelDrag()
            this.enemyDisplay.handleScreenResize()
            this.handManager.refreshHand()
            this.playerDisplay.update()
        }
        this.scene.scale.on('resize', this.resizeHandler)
    }
}
