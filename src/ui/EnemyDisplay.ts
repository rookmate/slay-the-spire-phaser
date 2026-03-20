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
    private enemyPowerTexts: Phaser.GameObjects.Text[] = []
    private onEnemyClick?: (enemyIndex: number) => void

    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
        this.build()
    }

    setOnEnemyClick(callback: (enemyIndex: number) => void): void {
        this.onEnemyClick = callback
    }

    private build(): void {
        this.clearEnemies()
        const style = {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.fontSize,
            color: COMBAT_UI_CONFIG.styles.color,
        }

        this.engine.state.enemies.forEach((enemy, index) => {
            const position = this.calculateEnemyPosition(index)
            const texture = `enemy:${enemy.specId ?? enemy.name.toUpperCase().replace(/\s+/g, '_')}`
            const sprite = this.scene.add.image(position.x, position.y, texture).setScale(0.5).setInteractive()
            sprite.on('pointerdown', () => this.onEnemyClick?.(index))
            this.enemySprites.push(sprite)

            const intent = this.scene.add.text(position.x, position.y - 80, this.getEnemyText(enemy), style).setOrigin(0.5, 1)
            const hp = this.scene.add.text(position.x, position.y + 55, this.getEnemyHpLabel(enemy), { ...style, fontSize: COMBAT_UI_CONFIG.styles.hpFontSize }).setOrigin(0.5, 0)
            const name = this.scene.add.text(position.x, position.y - 120, enemy.name, style).setOrigin(0.5, 1).setAlpha(0)
            const powers = this.scene.add.text(position.x, position.y + 78, this.getEnemyPowers(enemy), { ...style, fontSize: '12px', color: '#bbbbbb' }).setOrigin(0.5, 0)

            sprite.on('pointerover', () => name.setAlpha(1))
            sprite.on('pointerout', () => name.setAlpha(0))

            this.enemyTexts.push(intent)
            this.enemyHpTexts.push(hp)
            this.enemyNameTexts.push(name)
            this.enemyPowerTexts.push(powers)
        })
    }

    private clearEnemies(): void {
        this.enemySprites.forEach(item => item.destroy())
        this.enemyTexts.forEach(item => item.destroy())
        this.enemyHpTexts.forEach(item => item.destroy())
        this.enemyNameTexts.forEach(item => item.destroy())
        this.enemyPowerTexts.forEach(item => item.destroy())
        this.enemySprites = []
        this.enemyTexts = []
        this.enemyHpTexts = []
        this.enemyNameTexts = []
        this.enemyPowerTexts = []
    }

    private getEnemyText(enemy: EnemyState): string {
        if (enemy.intent?.kind === 'attack') return `${enemy.intent.amount} ⚔`
        if (enemy.intent?.kind === 'multi_attack') return `${enemy.intent.amount}x${enemy.intent.hits} ⚔`
        if (enemy.intent?.kind === 'block') return `${enemy.intent.amount} 🛡`
        if (enemy.intent?.kind === 'debuff') return `${enemy.intent.debuff} ↓`
        if (enemy.intent?.kind === 'status') return `${enemy.intent.createdDefId} x${enemy.intent.count}`
        if (enemy.intent?.kind === 'summon') return `Summon`
        return enemy.intent?.desc ?? 'Buff'
    }

    private getEnemyHpLabel(enemy: EnemyState): string {
        return `🛡 ${enemy.block}  ♥ ${enemy.hp}/${enemy.maxHp}`
    }

    private getEnemyPowers(enemy: EnemyState): string {
        const parts = enemy.powers.map(power => `${power.id}:${power.stacks}`)
        if (enemy.specId === 'BYRD') {
            if (enemy.aiState?.flying) parts.push(`FLYING:${Math.max(0, 3 - Number(enemy.aiState?.hitsTaken ?? 0))}`)
            if (enemy.aiState?.downed) parts.push('DOWNED')
        }
        return parts.join('  ')
    }

    private calculateEnemyPosition(index: number): { x: number; y: number } {
        const enemyCount = this.engine.state.enemies.length
        const screenWidth = this.scene.cameras.main.width
        const screenHeight = this.scene.cameras.main.height
        if (enemyCount === 1) return { x: screenWidth * 0.75, y: screenHeight * 0.4 }
        if (enemyCount === 2) return { x: screenWidth * 0.68 + index * 120, y: screenHeight * 0.38 }
        if (enemyCount <= 4) return { x: screenWidth * 0.62 + (index % 2) * 140, y: screenHeight * 0.32 + Math.floor(index / 2) * 110 }
        return { x: screenWidth * 0.75, y: screenHeight * 0.18 + index * 60 }
    }

    update(): void {
        this.engine.state.enemies.forEach((enemy, index) => {
            this.enemyTexts[index]?.setText(this.getEnemyText(enemy))
            this.enemyHpTexts[index]?.setText(this.getEnemyHpLabel(enemy))
            this.enemyPowerTexts[index]?.setText(this.getEnemyPowers(enemy))
            this.enemySprites[index]?.setAlpha(enemy.hp > 0 ? 1 : 0.25)
        })
    }

    getEnemyAtPoint(x: number, y: number): number {
        for (let i = 0; i < this.enemySprites.length; i++) {
            const sprite = this.enemySprites[i]
            const enemy = this.engine.state.enemies[i]
            if (!sprite || enemy.hp <= 0) continue
            const bounds = sprite.getBounds()
            if (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) return i
        }
        return -1
    }

    getEnemySprites(): Phaser.GameObjects.Image[] {
        return this.enemySprites
    }

    flashEnemyText(index: number): void {
        const text = this.enemyTexts[index]
        if (!text) return
        this.scene.tweens.add({
            targets: text,
            tint: 0xff4444,
            duration: 60,
            yoyo: true,
            onComplete: () => text.clearTint(),
        })
    }

    handleScreenResize(): void {
        this.build()
    }

    destroy(): void {
        this.clearEnemies()
    }
}
