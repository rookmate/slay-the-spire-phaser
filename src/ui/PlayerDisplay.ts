import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'

export class PlayerDisplay {
    private scene: Phaser.Scene
    private engine: Engine
    private playerSprite?: Phaser.GameObjects.Image
    private playerHpText?: Phaser.GameObjects.Text
    private playerNameText?: Phaser.GameObjects.Text
    private energyText?: Phaser.GameObjects.Text
    private drawIcon?: Phaser.GameObjects.Text
    private endTurnButton?: Phaser.GameObjects.Text

    private onEndTurn?: () => void
    private onOpenDeck?: () => void
    private resizeHandler?: (gameSize: Phaser.Structs.Size) => void

    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
        this.build()
    }

    setOnEndTurn(callback: () => void): void {
        this.onEndTurn = callback
    }

    setOnOpenDeck(callback: () => void): void {
        this.onOpenDeck = callback
    }

    private build(): void {
        this.createPlayerSprite()
        this.createPlayerHpText()
        this.createPlayerNameText()
        this.createEnergyDisplay()
        this.createDrawIcon()
        this.createEndTurnButton()
        this.setupResizeHandler()
    }

    private createPlayerSprite(): void {
        this.playerSprite = this.scene.add.image(120, 180, 'player:ironclad').setScale(0.35)
    }

    private createPlayerHpText(): void {
        if (!this.playerSprite) return

        const hpStyle = {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.hpFontSize,
            color: COMBAT_UI_CONFIG.styles.color
        }

        this.playerHpText = this.scene.add
            .text(this.playerSprite.x, this.playerSprite.y + 80, this.getPlayerHpLabel(), hpStyle)
            .setOrigin(0.5, 0)
    }

    private createPlayerNameText(): void {
        if (!this.playerSprite) return

        const style = {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.fontSize,
            color: COMBAT_UI_CONFIG.styles.color
        }

        this.playerNameText = this.scene.add
            .text(this.playerSprite.x, this.playerSprite.y - 70, 'Ironclad', style)
            .setOrigin(0.5, 1)
            .setAlpha(0)

        this.playerSprite.setInteractive()
        this.playerSprite.on('pointerover', () => this.playerNameText?.setAlpha(1))
        this.playerSprite.on('pointerout', () => this.playerNameText?.setAlpha(0))
    }

    private createEnergyDisplay(): void {
        const { height } = this.scene.scale
        const style = {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.fontSize,
            color: COMBAT_UI_CONFIG.styles.color,
            backgroundColor: COMBAT_UI_CONFIG.colors.energyBg,
            padding: { x: 6, y: 4 }
        }

        this.energyText = this.scene.add.text(16 + 56, height - 16 - 40, this.getPlayerStatsText(), style)
            .setOrigin(0, 1)
            .setDepth(COMBAT_UI_CONFIG.depths.ui)
    }

    private createDrawIcon(): void {
        const { height } = this.scene.scale
        const style = {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.iconFontSize,
            color: COMBAT_UI_CONFIG.styles.color,
            padding: { x: 6, y: 2 },
            backgroundColor: COMBAT_UI_CONFIG.colors.discardBg
        }

        this.drawIcon = this.scene.add.text(16, height - 16, '🃏', style)
            .setOrigin(0, 1)
            .setDepth(COMBAT_UI_CONFIG.depths.ui)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.onOpenDeck?.())
    }

    private createEndTurnButton(): void {
        const { width, height } = this.scene.scale
        const style = {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.fontSize,
            color: COMBAT_UI_CONFIG.styles.color,
            backgroundColor: COMBAT_UI_CONFIG.colors.endTurnBg,
            padding: { x: 6, y: 4 }
        }

        this.endTurnButton = this.scene.add.text(width - 16 - 50, height - 16 - 30, 'End\nTurn', style)
            .setOrigin(1, 1)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.onEndTurn?.()
                this.update()
            })
            .setDepth(COMBAT_UI_CONFIG.depths.ui)
    }

    private setupResizeHandler(): void {
        this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
            this.handleResize(gameSize)
        }
        this.scene.scale.on('resize', this.resizeHandler)
    }

    private handleResize(gameSize: Phaser.Structs.Size): void {
        this.drawIcon?.setPosition(16, gameSize.height - 16)
        this.energyText?.setPosition(16 + 56, gameSize.height - 16 - 40)
        this.endTurnButton?.setPosition(gameSize.width - 16 - 50, gameSize.height - 16 - 30)
    }

    private getPlayerHpLabel(): string {
        const player = this.engine.state.player
        return `🛡 ${player.block}  ♥ ${player.hp}/${player.maxHp}`
    }

    private getPlayerStatsText(): string {
        const player = this.engine.state.player
        return `⚡ ${player.energy}/${COMBAT_UI_CONFIG.layout.maxEnergyPerTurn}`
    }

    update(): void {
        this.updateHpText()
        this.updateEnergyText()
    }

    private updateHpText(): void {
        if (this.playerHpText) {
            this.playerHpText.setText(this.getPlayerHpLabel())
        }
    }

    private updateEnergyText(): void {
        if (this.energyText) {
            this.energyText.setText(this.getPlayerStatsText())
        }
    }

    getPlayerSprite(): Phaser.GameObjects.Image | undefined {
        return this.playerSprite
    }

    destroy(): void {
        if (this.resizeHandler) this.scene.scale.off('resize', this.resizeHandler)
        this.playerSprite?.destroy()
        this.playerHpText?.destroy()
        this.playerNameText?.destroy()
        this.energyText?.destroy()
        this.drawIcon?.destroy()
        this.endTurnButton?.destroy()
    }
}
