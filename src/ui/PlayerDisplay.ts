import { characterTexture } from './portraits'
import { UI_FONT } from './theme'
import { CHARACTERS } from '../core/characters'
import { powerAmount } from '../core/combatMath'
import { potionMultiplier } from '../core/potions'
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
    private resourceText?: Phaser.GameObjects.Text
    private potionMenu?: Phaser.GameObjects.Container
    private potionKey = ''
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

    private build(): void {
        this.createPlayerSprite()
        this.createPlayerHpText()
        this.createPlayerNameText()
        this.createEnergyDisplay()
        this.createDrawIcon()
        this.createEndTurnButton()
        this.createPowerText()
        this.createRelicText()
        this.resourceText = this.scene.add.text(16, 42, '', { resolution: 2, fontFamily: UI_FONT, fontSize: '10px', color: '#dbc5a3', wordWrap: { width: 215 } })
        this.rebuildPotions()
        this.setupResizeHandler()
    }

    private createPlayerSprite(): void {
        this.playerSprite = this.scene.add.image(110, 111, ...characterTexture(this.scene, this.run.character)).setDisplaySize(77, 91)
    }

    private createPlayerHpText(): void {
        if (!this.playerSprite) return
        this.playerHpText = this.scene.add.text(this.playerSprite.x, 157, this.getPlayerHpLabel(), {
            resolution: 2, fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: '12px',
            color: COMBAT_UI_CONFIG.styles.color,
        }).setOrigin(0.5, 0)
    }

    private createPlayerNameText(): void {
        if (!this.playerSprite) return
        this.playerNameText = this.scene.add.text(this.playerSprite.x, 48, this.getPlayerDetails(), {
            resolution: 2, fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
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
            resolution: 2, fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: '14px', fontStyle: 'bold',
            color: COMBAT_UI_CONFIG.styles.color,
            backgroundColor: COMBAT_UI_CONFIG.colors.energyBg,
            padding: { x: 6, y: 4 },
        }).setOrigin(0, 1)
    }

    private createDrawIcon(): void {
        const { height } = this.scene.scale
        this.drawIcon = this.scene.add.text(16, height - 12, 'Draw', {
            resolution: 2, fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: '13px',
            color: COMBAT_UI_CONFIG.styles.color,
            padding: { x: 8, y: 7 },
            backgroundColor: COMBAT_UI_CONFIG.colors.discardBg,
        }).setOrigin(0, 1).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onOpenDeck?.())
    }

    private createEndTurnButton(): void {
        const { width, height } = this.scene.scale
        this.endTurnButton = this.scene.add.text(width - 16, height - 12, 'End Turn', {
            resolution: 2, fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: '14px', fontStyle: 'bold',
            color: COMBAT_UI_CONFIG.styles.color,
            backgroundColor: COMBAT_UI_CONFIG.colors.endTurnBg,
            padding: { x: 14, y: 7 },
        }).setOrigin(1, 1).setResolution(2)
        this.endTurnButton.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onEndTurn?.())
            .on('pointerover', () => this.endTurnButton?.setBackgroundColor('#c37d4d'))
            .on('pointerout', () => this.endTurnButton?.setBackgroundColor(COMBAT_UI_CONFIG.colors.endTurnBg))
    }

    private createPowerText(): void {
        this.powerText = this.scene.add.text(110, 178, this.getPlayerPowers(), {
            resolution: 2, fontFamily: UI_FONT,
            fontSize: '10px',
            color: '#bbbbbb',
        }).setOrigin(0.5, 0)
    }

    private createRelicText(): void {
        this.relicText = this.scene.add.text(16, 16, this.getRelicText(), {
            resolution: 2, fontFamily: UI_FONT,
            fontSize: '11px',
            color: '#dddddd',
            wordWrap: { width: this.scene.scale.width - 32 },
        })
    }

    private rebuildPotions(): void {
        this.potionKey = this.run.potions.join(',')
        this.potionTexts.forEach(text => text.destroy())
        this.potionTexts = []
        const startX = 180
        const startY = combatLayout(this.scene.scale.width, this.scene.scale.height).footerTop + 10
        this.run.potions.forEach((potion, index) => {
            const text = this.scene.add.text(startX + index * 82, startY, POTION_DEFS[potion].name.replace(' Potion', ''), {
                resolution: 2, fontFamily: UI_FONT,
                fontSize: '10px', fixedWidth: 78, fixedHeight: 34, wordWrap: { width: 66 },
                color: '#ffffff',
                backgroundColor: '#353126',
                padding: { x: 6, y: 4 },
            }).setInteractive({ useHandCursor: true })
            text.on('pointerdown', () => this.openPotionMenu(index))
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
        return `${player.hp}/${player.maxHp} HP${player.block ? ` · ${player.block} Block` : ''}`
    }

    private getPlayerStatsText(): string {
        return `Energy ${this.engine.state.player.energy}/${this.engine.getBaseEnergyPerTurn()}`
    }

    private getPlayerPowers(): string {
        if (this.engine.state.player.powers.length === 0) return ''
        return summarizeEffects(this.engine.state.player.powers.map(power => `${power.id}:${power.stacks}`), 32)
    }

    private getPlayerDetails(): string {
        return [CHARACTERS[this.run.character].name, 'Orbs: passive / evoke', this.getResourceText(), ...this.engine.state.player.powers.map(power => `${power.id}:${power.stacks}`)].join('\n')
    }

    private getRelicText(): string {
        return `Relics: ${this.run.relics.map(id => getRelicDisplayName(this.run, id)).join(', ')}`
    }

    update(): void {
        if (this.potionKey !== this.run.potions.join(',')) this.rebuildPotions()
        this.resourceText?.setText(this.getResourceText())
        this.playerHpText?.setText(this.getPlayerHpLabel())
        this.energyText?.setText(this.getPlayerStatsText())
        this.powerText?.setText(this.getPlayerPowers())
        this.playerNameText?.setText(this.getPlayerDetails())
        this.relicText?.setText(this.getRelicText())
    }

    private getResourceText(): string {
        const player = this.engine.state.player
        const lines: string[] = []
        if (player.orbSlots) {
            const focus = powerAmount(player, 'FOCUS')
            lines.push(player.orbs.map(orb => {
                const passive = orb.type === 'plasma' ? 1 : Math.max(0, (orb.type === 'frost' ? 2 : orb.type === 'dark' ? 6 : 3) + focus)
                const evoke = orb.type === 'dark' ? orb.storedDamage : orb.type === 'plasma' ? 2 : Math.max(0, (orb.type === 'frost' ? 5 : 8) + focus)
                return `${orb.type[0].toUpperCase()} ${passive}/${evoke}`
            }).concat(Array.from({ length: player.orbSlots - player.orbs.length }, () => '○')).join(' · '))
        }
        if (player.character === 'watcher' || player.stance !== 'neutral') lines.push(`${player.stance.toUpperCase()} · Mantra ${powerAmount(player, 'MANTRA')}/10`)
        return lines.join('\n')
    }
    isPotionMenuOpen(): boolean { return !!this.potionMenu }
    closePotionMenu(): void { this.potionMenu?.destroy(true); this.potionMenu = undefined }
    private openPotionMenu(index: number): void {
        if (!this.engine.canAcceptInput()) return
        this.closePotionMenu()
        const id = this.run.potions[index], def = POTION_DEFS[id]
        const menu = this.scene.add.container(0, 0).setDepth(12000); this.potionMenu = menu
        menu.add(this.scene.add.rectangle(0, 0, 800, 450, 0, 0.6).setOrigin(0).setInteractive())
        menu.add(this.scene.add.rectangle(200, 80, 400, 200, 0x222222).setOrigin(0).setStrokeStyle(1, 0x777777))
        menu.add(this.scene.add.text(218, 100, `${def.name}${potionMultiplier(this.run, id) === 2 ? ' ×2' : ''}\n\n${def.description}`, { resolution: 2, fontFamily: UI_FONT, fontSize: '16px', color: '#fff', wordWrap: { width: 365 } }))
        const buttons: [string, () => void][] = [
            ['Use', () => { this.closePotionMenu(); this.onUsePotion?.(index) }],
            ['Discard', () => { this.run.potions.splice(index, 1); this.closePotionMenu(); this.rebuildPotions() }],
            ['Cancel', () => this.closePotionMenu()],
        ]
        buttons.forEach(([label, action], i) => {
            const text = this.scene.add.text(218 + i * 122, 230, label, { resolution: 2, fontFamily: UI_FONT, fontSize: '16px', color: '#fff', backgroundColor: '#493c29', padding: { x: 8, y: 8 } })
            const enabled = label !== 'Use' || !def.autoRevivePercent
            if (enabled) text.setInteractive({ useHandCursor: true }).on('pointerdown', action)
            else text.setAlpha(0.4)
            menu.add(text)
        })
    }
    getPlayerSprite(): Phaser.GameObjects.Image | undefined {
        return this.playerSprite
    }

    destroy(): void {
        if (this.resizeHandler) this.scene.scale.off('resize', this.resizeHandler)
        this.closePotionMenu()
        this.resourceText?.destroy()
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
