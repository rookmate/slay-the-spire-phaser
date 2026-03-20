import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { RunState } from '../core/run'
import { POTION_DEFS } from '../core/potions'
import { getRelicDisplayName } from '../core/relics'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'

export class PlayerDisplay {
    private scene: Phaser.Scene
    private engine: Engine
    private run: RunState
    private playerSprite?: Phaser.GameObjects.Image
    private playerHpText?: Phaser.GameObjects.Text
    private playerNameText?: Phaser.GameObjects.Text
    private energyText?: Phaser.GameObjects.Text
    private drawIcon?: Phaser.GameObjects.Text
    private endTurnButton?: Phaser.GameObjects.Text
    private powerText?: Phaser.GameObjects.Text
    private relicText?: Phaser.GameObjects.Text
    private potionTexts: Phaser.GameObjects.Text[] = []

    private onEndTurn?: () => void
    private onOpenDeck?: () => void
    private onUsePotion?: (index: number) => void
    private resizeHandler?: (gameSize: Phaser.Structs.Size) => void

    constructor(scene: Phaser.Scene, engine: Engine, run: RunState) {
        this.scene = scene
        this.engine = engine
        this.run = run
        this.build()
    }

    setOnEndTurn(callback: () => void): void {
        this.onEndTurn = callback
    }

    setOnOpenDeck(callback: () => void): void {
        this.onOpenDeck = callback
    }

    setOnUsePotion(callback: (index: number) => void): void {
        this.onUsePotion = callback
    }

    setRun(run: RunState): void {
        this.run = run
        this.rebuildPotions()
        this.update()
    }

    private build(): void {
        this.createPlayerSprite()
        this.createPlayerHpText()
        this.createPlayerNameText()
        this.createEnergyDisplay()
        this.createDrawIcon()
        this.createEndTurnButton()
        this.createPowerText()
        this.createRelicText()
        this.rebuildPotions()
        this.setupResizeHandler()
    }

    private createPlayerSprite(): void {
        this.playerSprite = this.scene.add.image(120, 180, 'player:ironclad').setScale(0.35)
    }

    private createPlayerHpText(): void {
        if (!this.playerSprite) return
        this.playerHpText = this.scene.add.text(this.playerSprite.x, this.playerSprite.y + 80, this.getPlayerHpLabel(), {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.hpFontSize,
            color: COMBAT_UI_CONFIG.styles.color,
        }).setOrigin(0.5, 0)
    }

    private createPlayerNameText(): void {
        if (!this.playerSprite) return
        this.playerNameText = this.scene.add.text(this.playerSprite.x, this.playerSprite.y - 70, 'Ironclad', {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.fontSize,
            color: COMBAT_UI_CONFIG.styles.color,
        }).setOrigin(0.5, 1).setAlpha(0)
        this.playerSprite.setInteractive()
        this.playerSprite.on('pointerover', () => this.playerNameText?.setAlpha(1))
        this.playerSprite.on('pointerout', () => this.playerNameText?.setAlpha(0))
    }

    private createEnergyDisplay(): void {
        const { height } = this.scene.scale
        this.energyText = this.scene.add.text(72, height - 56, this.getPlayerStatsText(), {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.fontSize,
            color: COMBAT_UI_CONFIG.styles.color,
            backgroundColor: COMBAT_UI_CONFIG.colors.energyBg,
            padding: { x: 6, y: 4 },
        }).setOrigin(0, 1)
    }

    private createDrawIcon(): void {
        const { height } = this.scene.scale
        this.drawIcon = this.scene.add.text(16, height - 16, '🃏', {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.iconFontSize,
            color: COMBAT_UI_CONFIG.styles.color,
            padding: { x: 6, y: 2 },
            backgroundColor: COMBAT_UI_CONFIG.colors.discardBg,
        }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onOpenDeck?.())
    }

    private createEndTurnButton(): void {
        const { width, height } = this.scene.scale
        this.endTurnButton = this.scene.add.text(width - 66, height - 46, 'End\nTurn', {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.fontSize,
            color: COMBAT_UI_CONFIG.styles.color,
            backgroundColor: COMBAT_UI_CONFIG.colors.endTurnBg,
            padding: { x: 6, y: 4 },
        }).setOrigin(1, 1)
        this.endTurnButton.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(
                -this.endTurnButton.displayOriginX,
                -this.endTurnButton.displayOriginY,
                this.endTurnButton.width,
                this.endTurnButton.height,
            ),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true,
        }).on('pointerdown', () => this.onEndTurn?.())
    }

    private createPowerText(): void {
        this.powerText = this.scene.add.text(120, 278, this.getPlayerPowers(), {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#bbbbbb',
        }).setOrigin(0.5, 0)
    }

    private createRelicText(): void {
        this.relicText = this.scene.add.text(16, 16, this.getRelicText(), {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#dddddd',
        })
    }

    private rebuildPotions(): void {
        this.potionTexts.forEach(text => text.destroy())
        this.potionTexts = []
        const startX = 16
        const startY = 318
        this.run.potions.forEach((potion, index) => {
            const text = this.scene.add.text(startX + index * 110, startY, POTION_DEFS[potion].name, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#ffffff',
                backgroundColor: '#3a3a3a',
                padding: { x: 6, y: 4 },
            }).setInteractive({ useHandCursor: true })
            text.on('pointerdown', () => this.onUsePotion?.(index))
            this.potionTexts.push(text)
        })
    }

    private setupResizeHandler(): void {
        this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
            this.drawIcon?.setPosition(16, gameSize.height - 16)
            this.energyText?.setPosition(72, gameSize.height - 56)
            this.endTurnButton?.setPosition(gameSize.width - 66, gameSize.height - 46)
        }
        this.scene.scale.on('resize', this.resizeHandler)
    }

    private getPlayerHpLabel(): string {
        const player = this.engine.state.player
        return `🛡 ${player.block}  ♥ ${player.hp}/${player.maxHp}`
    }

    private getPlayerStatsText(): string {
        return `⚡ ${this.engine.state.player.energy}/${this.engine.getBaseEnergyPerTurn()}`
    }

    private getPlayerPowers(): string {
        if (this.engine.state.player.powers.length === 0) return ''
        return this.engine.state.player.powers.map(power => `${power.id}:${power.stacks}`).join('  ')
    }

    private getRelicText(): string {
        return `Relics: ${this.run.relics.map(id => getRelicDisplayName(this.run, id)).join(', ')}`
    }

    update(): void {
        this.playerHpText?.setText(this.getPlayerHpLabel())
        this.energyText?.setText(this.getPlayerStatsText())
        this.powerText?.setText(this.getPlayerPowers())
        this.relicText?.setText(this.getRelicText())
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
        this.powerText?.destroy()
        this.relicText?.destroy()
        this.potionTexts.forEach(text => text.destroy())
    }
}
