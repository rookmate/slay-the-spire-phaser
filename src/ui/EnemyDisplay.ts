import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { EnemyState } from '../core/state'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'

export class EnemyDisplay {
    private scene: Phaser.Scene
    private engine: Engine
    private enemySprites: Phaser.GameObjects.Image[] = []
    private enemyTexts: Phaser.GameObjects.Text[] = []
    private enemyHpTexts: Phaser.GameObjects.Text[] = []
    private enemyNameTexts: Phaser.GameObjects.Text[] = []

    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
        this.build()
    }

    private build(): void {
        this.clearEnemies()
        this.createEnemies()
    }

    private clearEnemies(): void {
        this.enemySprites.forEach(sprite => sprite.destroy())
        this.enemyTexts.forEach(text => text.destroy())
        this.enemyHpTexts.forEach(text => text.destroy())
        this.enemyNameTexts.forEach(text => text.destroy())

        this.enemySprites = []
        this.enemyTexts = []
        this.enemyHpTexts = []
        this.enemyNameTexts = []
    }

    private createEnemies(): void {
        const style = {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.fontSize,
            color: COMBAT_UI_CONFIG.styles.color
        }
        const hpStyle = {
            ...style,
            fontSize: COMBAT_UI_CONFIG.styles.hpFontSize
        }

        this.engine.state.enemies.forEach((enemy, i) => {
            this.createEnemySprite(enemy, i)
            this.createEnemyIntentText(enemy, i, style)
            this.createEnemyHpText(enemy, i, hpStyle)
            this.createEnemyNameText(enemy, i, style)
        })
    }

    private createEnemySprite(enemy: EnemyState, index: number): void {
        const texKey = `enemy:${enemy.specId ?? enemy.name.toUpperCase().replace(/\s+/g, '_')}`
        const position = this.calculateEnemyPosition(index)
        const sprite = this.scene.add.image(position.x, position.y, texKey).setScale(0.5)
        sprite.setInteractive()
        sprite.setDepth(5)
        this.enemySprites.push(sprite)
    }

    private createEnemyIntentText(enemy: EnemyState, index: number, style: any): void {
        const sprite = this.enemySprites[index]
        const textPosition = this.calculateTextPosition(sprite, 'intent')
        const intentText = this.scene.add
            .text(textPosition.x, textPosition.y, this.getEnemyText(enemy), style)
            .setOrigin(0.5, 1)
            .setDepth(10)
        this.enemyTexts.push(intentText)
    }

    private createEnemyHpText(enemy: EnemyState, index: number, style: any): void {
        const sprite = this.enemySprites[index]
        const textPosition = this.calculateTextPosition(sprite, 'hp')
        const hpText = this.scene.add
            .text(textPosition.x, textPosition.y, this.getEnemyHpLabel(enemy), style)
            .setOrigin(0.5, 0)
            .setDepth(1)
        this.enemyHpTexts.push(hpText)
    }

    private createEnemyNameText(enemy: EnemyState, index: number, style: any): void {
        const sprite = this.enemySprites[index]
        const textPosition = this.calculateTextPosition(sprite, 'name')
        const nameText = this.scene.add
            .text(textPosition.x, textPosition.y, enemy.name, style)
            .setOrigin(0.5, 1)
            .setAlpha(0)
            .setDepth(9)
        this.enemyNameTexts.push(nameText)

        // Set up hover interactions
        sprite.on('pointerover', () => nameText.setAlpha(1))
        sprite.on('pointerout', () => nameText.setAlpha(0))
    }

    private getEnemyText(enemy: EnemyState): string {
        if (enemy.intent?.kind === 'attack') return `${enemy.intent.amount} ⚔`
        if (enemy.intent?.kind === 'block') return `${enemy.intent.amount} 🛡`
        if (enemy.intent?.kind === 'debuff') return `${enemy.intent.debuff} ↓`
        return `Buff ✦`
    }

    private getEnemyHpLabel(enemy: EnemyState): string {
        return `🛡 ${enemy.block}  ♥ ${enemy.hp}/${enemy.maxHp}`
    }

    private calculateEnemyPosition(index: number): { x: number; y: number } {
        const enemyCount = this.engine.state.enemies.length
        const screenWidth = this.scene.cameras.main.width
        const screenHeight = this.scene.cameras.main.height

        // Dynamic positioning based on enemy count
        if (enemyCount === 1) {
            // Single enemy: center position
            return { x: screenWidth * 0.75, y: screenHeight * 0.4 }
        } else if (enemyCount === 2) {
            // Two enemies: side by side
            const baseX = screenWidth * 0.7
            const baseY = screenHeight * 0.4
            const spacing = 120
            return {
                x: baseX + (index === 0 ? -spacing / 2 : spacing / 2),
                y: baseY
            }
        } else if (enemyCount <= 4) {
            // 3-4 enemies: 2x2 grid
            const baseX = screenWidth * 0.65
            const baseY = screenHeight * 0.35
            const spacingX = 140
            const spacingY = 100
            const row = Math.floor(index / 2)
            const col = index % 2
            return {
                x: baseX + col * spacingX,
                y: baseY + row * spacingY
            }
        } else {
            // 5+ enemies: vertical column with adaptive spacing
            const baseX = screenWidth * 0.75
            const availableHeight = screenHeight * 0.6
            const spacing = Math.max(60, availableHeight / enemyCount)
            const startY = screenHeight * 0.2
            return {
                x: baseX,
                y: startY + index * spacing
            }
        }
    }

    private calculateTextPosition(sprite: Phaser.GameObjects.Image, textType: 'intent' | 'hp' | 'name'): { x: number; y: number } {
        const enemyCount = this.engine.state.enemies.length
        const baseX = sprite.x
        const baseY = sprite.y

        // Get base position for text type
        let position = this.getBaseTextPosition(baseX, baseY, textType, enemyCount)

        // Apply collision avoidance if needed
        position = this.avoidTextCollisions(position, textType, sprite)

        return position
    }

    private getBaseTextPosition(baseX: number, baseY: number, textType: 'intent' | 'hp' | 'name', enemyCount: number): { x: number; y: number } {
        switch (textType) {
            case 'intent':
                return {
                    x: baseX,
                    y: baseY - (enemyCount > 4 ? 50 : 80)
                }
            case 'hp':
                return {
                    x: baseX,
                    y: baseY + (enemyCount > 4 ? 40 : 60)
                }
            case 'name':
                return {
                    x: baseX,
                    y: baseY - (enemyCount > 4 ? 80 : 120)
                }
            default:
                return { x: baseX, y: baseY }
        }
    }

    private avoidTextCollisions(position: { x: number; y: number }, textType: string, currentSprite: Phaser.GameObjects.Image): { x: number; y: number } {
        const enemyCount = this.engine.state.enemies.length

        // For high enemy counts, use alternative positioning to avoid overlaps
        if (enemyCount > 4) {
            const spriteIndex = this.enemySprites.indexOf(currentSprite)
            if (spriteIndex >= 0) {
                // Alternate text positioning for crowded layouts
                const alternateSide = spriteIndex % 2 === 0
                switch (textType) {
                    case 'intent':
                        return {
                            x: position.x + (alternateSide ? -30 : 30),
                            y: position.y
                        }
                    case 'hp':
                        return {
                            x: position.x + (alternateSide ? -20 : 20),
                            y: position.y
                        }
                }
            }
        }

        return position
    }

    update(): void {
        this.updateEnemyTexts()
        this.updateEnemyVisibility()
        this.updateHpTexts()
        this.updateTextPositions()
    }

    private updateTextPositions(): void {
        // Update text positions when enemy count changes or screen resizes
        this.enemyTexts.forEach((text, i) => {
            const sprite = this.enemySprites[i]
            if (sprite && text) {
                const position = this.calculateTextPosition(sprite, 'intent')
                text.setPosition(position.x, position.y)
            }
        })

        this.enemyHpTexts.forEach((text, i) => {
            const sprite = this.enemySprites[i]
            if (sprite && text) {
                const position = this.calculateTextPosition(sprite, 'hp')
                text.setPosition(position.x, position.y)
            }
        })

        this.enemyNameTexts.forEach((text, i) => {
            const sprite = this.enemySprites[i]
            if (sprite && text) {
                const position = this.calculateTextPosition(sprite, 'name')
                text.setPosition(position.x, position.y)
            }
        })
    }

    private updateEnemyTexts(): void {
        this.enemyTexts.forEach((text, i) => {
            const enemy = this.engine.state.enemies[i]
            if (enemy) {
                text.setText(this.getEnemyText(enemy))
            }
        })
    }

    private updateEnemyVisibility(): void {
        this.engine.state.enemies.forEach((enemy, i) => {
            const sprite = this.enemySprites[i]
            if (sprite) {
                sprite.setAlpha(enemy.hp > 0 ? 1 : 0.3)
            }
        })
    }

    private updateHpTexts(): void {
        this.engine.state.enemies.forEach((enemy, i) => {
            const hpText = this.enemyHpTexts[i]
            if (hpText) {
                hpText.setText(this.getEnemyHpLabel(enemy))
            }
        })
    }

    getEnemyAtPoint(x: number, y: number): number {
        for (let i = 0; i < this.enemySprites.length; i++) {
            const sprite = this.enemySprites[i]
            if (sprite && this.engine.state.enemies[i].hp > 0) {
                const bounds = sprite.getBounds()
                if (x >= bounds.x && x <= bounds.x + bounds.width &&
                    y >= bounds.y && y <= bounds.y + bounds.height) {
                    return i
                }
            }
        }
        return -1
    }

    getEnemySprites(): Phaser.GameObjects.Image[] {
        return this.enemySprites
    }

    flashEnemyText(index: number): void {
        const text = this.enemyTexts[index]
        if (text) {
            this.scene.tweens.add({
                targets: text,
                tint: 0xff4444,
                duration: 60,
                yoyo: true,
                repeat: 0,
                onComplete: () => text.clearTint(),
            })
        }
    }

    handleScreenResize(): void {
        // Rebuild enemy layout when screen size changes
        this.build()
    }

    getLayoutInfo(): { enemyCount: number; layout: string; spacing: number } {
        const enemyCount = this.engine.state.enemies.length
        let layout = 'single'
        let spacing = 0

        if (enemyCount === 2) {
            layout = 'horizontal'
            spacing = 120
        } else if (enemyCount <= 4) {
            layout = 'grid'
            spacing = 140
        } else {
            layout = 'vertical'
            spacing = Math.max(60, this.scene.cameras.main.height * 0.6 / enemyCount)
        }

        return { enemyCount, layout, spacing }
    }

    destroy(): void {
        this.clearEnemies()
    }
}
