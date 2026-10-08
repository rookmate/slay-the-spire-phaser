import { UI_FONT } from './theme'
import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { CardInstance, PendingChoiceView } from '../core/state'
import { CardGrid } from './CardGrid'

export class CombatChoiceOverlay {
    private scene: Phaser.Scene
    private engine: Engine
    private container?: Phaser.GameObjects.Container
    private selectedInstanceIds = new Set<string>()
    private grid?: CardGrid
    private currentChoice?: PendingChoiceView
    private onSubmit?: (instanceIds: string[]) => void
    private onCancel?: () => void

    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
    }

    setOnSubmit(callback: (instanceIds: string[]) => void): void {
        this.onSubmit = callback
    }

    setOnCancel(callback: () => void): void {
        this.onCancel = callback
    }

    refresh(choice?: PendingChoiceView): void {
        const nextKey = choice?.id
        const currentKey = this.currentChoice?.id
        if (nextKey === currentKey) return

        this.currentChoice = choice
        this.selectedInstanceIds.clear()
        this.container?.destroy(true)
        this.container = undefined
        this.grid = undefined

        if (!choice) return

        const zoneCards = choice.cards ?? this.engine.getCardsInZone(choice.zone)
        const overlay = this.scene.add.container(0, 0).setDepth(7000)
        this.container = overlay

        const bg = this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0x090909, 0.86)
            .setOrigin(0, 0)
            .setInteractive()
        overlay.add(bg)

        overlay.add(this.scene.add.text(24, 20, choice.prompt, {
            resolution: 2, fontFamily: UI_FONT,
            fontSize: '20px',
            color: '#f0f0f0',
        }))

        overlay.add(this.scene.add.text(24, 52, `Zone: ${choice.zone}   Pick ${choice.minSelections}-${choice.maxSelections}`, {
            resolution: 2, fontFamily: UI_FONT,
            fontSize: '13px',
            color: '#adadad',
        }))

        const eligibleIds = new Set(choice.eligibleInstanceIds)
        this.grid = new CardGrid(this.scene, overlay, zoneCards, 92,
            card => { this.handleCardSelection(card); this.grid?.refresh() },
            card => eligibleIds.has(card.instanceId),
            card => this.selectedInstanceIds.has(card.instanceId),
        )
        const footerY = this.scene.scale.height - 52
        const confirm = this.scene.add.text(this.scene.scale.width - 24, footerY, 'Confirm', {
            resolution: 2, fontFamily: UI_FONT,
            fontSize: '16px',
            color: '#f0f0f0',
            backgroundColor: '#2c2c2c',
            padding: { x: 10, y: 7 },
        }).setOrigin(1, 0)
        confirm.setInteractive({ useHandCursor: true })
        confirm.on('pointerdown', () => {
            if (!this.canSubmit()) return
            this.onSubmit?.([...this.selectedInstanceIds])
        })
        overlay.add(confirm)

        if (choice.canSkip) {
            const skip = this.scene.add.text(this.scene.scale.width - 122, footerY, 'Skip', {
                resolution: 2, fontFamily: UI_FONT,
                fontSize: '16px',
                color: '#f0f0f0',
                backgroundColor: '#1d1d1d',
                padding: { x: 10, y: 7 },
            }).setOrigin(1, 0).setInteractive({ useHandCursor: true })
            skip.on('pointerdown', () => this.onCancel?.())
            overlay.add(skip)
        }
    }

    destroy(): void {
        this.container?.destroy(true)
        this.container = undefined
        this.grid = undefined
        this.currentChoice = undefined
        this.selectedInstanceIds.clear()
    }

    private handleCardSelection(card: CardInstance): void {
        const choice = this.currentChoice
        if (!choice) return

        if (choice.maxSelections === 1 && choice.minSelections === 1) {
            this.onSubmit?.([card.instanceId])
            return
        }

        if (this.selectedInstanceIds.has(card.instanceId)) {
            this.selectedInstanceIds.delete(card.instanceId)
            return
        }

        if (this.selectedInstanceIds.size >= choice.maxSelections) return
        this.selectedInstanceIds.add(card.instanceId)
    }

    private canSubmit(): boolean {
        if (!this.currentChoice) return false
        return this.selectedInstanceIds.size >= this.currentChoice.minSelections
            && this.selectedInstanceIds.size <= this.currentChoice.maxSelections
    }
}
