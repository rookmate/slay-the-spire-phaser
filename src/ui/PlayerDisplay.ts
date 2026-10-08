import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { RunState } from '../core/run'
import { POTION_DEFS } from '../core/potions'
import { getRelicDisplayName } from '../core/relics'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'
import { combatLayout } from './layout'
import { summarizeEffects } from './effectLabels'

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
        this.playerSprite = this.scene.add.image(110, 116, 'player:ironclad').setScale(0.23)
    }

    private createPlayerHpText(): void {
        if (!this.playerSprite) return
        this.playerHpText = this.scene.add.text(this.playerSprite.x, this.playerSprite.y + 38, this.getPlayerHpLabel(), {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.hpFontSize,
            color: COMBAT_UI_CONFIG.styles.color,
        }).setOrigin(0.5, 0)
    }

    private createPlayerNameText(): void {
        if (!this.playerSprite) return
        this.playerNameText = this.scene.add.text(this.playerSprite.x, 48, this.getPlayerDetails(), {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: '11px',
            color: COMBAT_UI_CONFIG.styles.color,
            backgroundColor: '#111111', padding: { x: 6, y: 4 }, wordWrap: { width: 190 },
        }).setOrigin(0.5, 0).setAlpha(0).setDepth(6000)
        this.playerSprite.setInteractive()
        this.playerSprite.on('pointerover', () => this.playerNameText?.setAlpha(1))
        this.playerSprite.on('pointerout', () => this.playerNameText?.setAlpha(0))
    }

    private createEnergyDisplay(): void {
        const { height } = this.scene.scale
        this.energyText = this.scene.add.text(78, height - 12, this.getPlayerStatsText(), {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.fontSize,
            color: COMBAT_UI_CONFIG.styles.color,
            backgroundColor: COMBAT_UI_CONFIG.colors.energyBg,
            padding: { x: 6, y: 4 },
        }).setOrigin(0, 1)
    }

    private createDrawIcon(): void {
        const { height } = this.scene.scale
        this.drawIcon = this.scene.add.text(16, height - 12, '🃏', {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.iconFontSize,
            color: COMBAT_UI_CONFIG.styles.color,
            padding: { x: 6, y: 2 },
            backgroundColor: COMBAT_UI_CONFIG.colors.discardBg,
        }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onOpenDeck?.())
    }

    private createEndTurnButton(): void {
        const { width, height } = this.scene.scale
        this.endTurnButton = this.scene.add.text(width - 16, height - 12, 'End Turn', {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.fontSize,
            color: COMBAT_UI_CONFIG.styles.color,
            backgroundColor: COMBAT_UI_CONFIG.colors.endTurnBg,
            padding: { x: 6, y: 4 },
        }).setOrigin(1, 1)
        this.endTurnButton.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onEndTurn?.())
    }

    private createPowerText(): void {
        this.powerText = this.scene.add.text(110, 178, this.getPlayerPowers(), {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#bbbbbb',
        }).setOrigin(0.5, 0)
    }

    private createRelicText(): void {
        this.relicText = this.scene.add.text(16, 16, this.getRelicText(), {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#dddddd',
            wordWrap: { width: this.scene.scale.width - 32 },
        })
    }

    private rebuildPotions(): void {
        this.potionTexts.forEach(text => text.destroy())
        this.potionTexts = []
        const startX = 180
        const startY = combatLayout(this.scene.scale.width, this.scene.scale.height).footerTop + 10
        this.run.potions.forEach((potion, index) => {
            const text = this.scene.add.text(startX + index * 128, startY, POTION_DEFS[potion].name, {
                fontFamily: 'monospace',
                fontSize: '11px',
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
            this.drawIcon?.setPosition(16, gameSize.height - 12)
            this.energyText?.setPosition(78, gameSize.height - 12)
            this.endTurnButton?.setPosition(gameSize.width - 16, gameSize.height - 12)
            this.rebuildPotions()
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
        return summarizeEffects(this.engine.state.player.powers.map(power => `${power.id}:${power.stacks}`), 32)
    }

    private getPlayerDetails(): string {
        return ['Ironclad', ...this.engine.state.player.powers.map(power => `${power.id}:${power.stacks}`)].join('\n')
    }

    private getRelicText(): string {
        return `Relics: ${this.run.relics.map(id => getRelicDisplayName(this.run, id)).join(', ')}`
    }

    update(): void {
        this.playerHpText?.setText(this.getPlayerHpLabel())
        this.energyText?.setText(this.getPlayerStatsText())
        this.powerText?.setText(this.getPlayerPowers())
        this.playerNameText?.setText(this.getPlayerDetails())
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
