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
        const sprite = this.scene.add.image(600, 160 + index * 80, texKey).setScale(0.5)
        sprite.setInteractive()
        sprite.setDepth(5)
        this.enemySprites.push(sprite)
    }

    private createEnemyIntentText(enemy: EnemyState, index: number, style: any): void {
        const sprite = this.enemySprites[index]
        const intentText = this.scene.add
            .text(sprite.x, sprite.y - 80, this.getEnemyText(enemy), style)
            .setOrigin(0.5, 1)
            .setDepth(10)
        this.enemyTexts.push(intentText)
    }

    private createEnemyHpText(enemy: EnemyState, index: number, style: any): void {
        const sprite = this.enemySprites[index]
        const hpText = this.scene.add
            .text(sprite.x, sprite.y + 60, this.getEnemyHpLabel(enemy), style)
            .setOrigin(0.5, 0)
            .setDepth(1)
        this.enemyHpTexts.push(hpText)
    }

    private createEnemyNameText(enemy: EnemyState, index: number, style: any): void {
        const sprite = this.enemySprites[index]
        const nameText = this.scene.add
            .text(sprite.x, sprite.y - 60, enemy.name, style)
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

    update(): void {
        this.updateEnemyTexts()
        this.updateEnemyVisibility()
        this.updateHpTexts()
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

    destroy(): void {
        this.clearEnemies()
    }
}
