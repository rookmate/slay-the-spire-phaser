import Phaser from 'phaser'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'

export class VisualEffects {
    private scene: Phaser.Scene
    private damageNumbers: Phaser.GameObjects.Text[] = []
    private damageNumberPool: Phaser.GameObjects.Text[] = []

    constructor(scene: Phaser.Scene) {
        this.scene = scene
    }

    showDamageNumber(amount: number, x: number, y: number, isHealing = false): void {
        // Get or create a damage number text object
        let damageText = this.damageNumberPool.pop()
        if (!damageText) {
            damageText = this.scene.add.text(0, 0, '', {
                fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
                fontSize: '24px',
                color: isHealing ? '#00ff00' : '#ff4444',
                stroke: '#000000',
                strokeThickness: 2
            })
            damageText.setDepth(10000)
        }

        // Configure the damage number
        damageText.setText(amount.toString())
        damageText.setPosition(x, y)
        damageText.setAlpha(1)
        damageText.setScale(1)
        damageText.setVisible(true)

        // Add to active damage numbers
        this.damageNumbers.push(damageText)

        // Animate the damage number
        this.scene.tweens.add({
            targets: damageText,
            y: y - 60,
            alpha: 0,
            scale: 1.2,
            duration: COMBAT_UI_CONFIG.animations.damageNumberDuration,
            ease: 'Power2',
            onComplete: () => {
                // Remove from active list and return to pool
                const index = this.damageNumbers.indexOf(damageText)
                if (index > -1) {
                    this.damageNumbers.splice(index, 1)
                }
                damageText.setVisible(false)
                this.damageNumberPool.push(damageText)
            }
        })
    }

    screenShake(intensity: number = 1, duration: number = COMBAT_UI_CONFIG.animations.screenShakeDuration): void {
        this.scene.cameras.main.shake(duration, intensity * COMBAT_UI_CONFIG.animations.screenShakeIntensity)
    }

    flashText(text: Phaser.GameObjects.Text, color: number = 0xff4444, duration: number = 60): void {
        this.scene.tweens.add({
            targets: text,
            tint: color,
            duration: duration,
            yoyo: true,
            repeat: 0,
            onComplete: () => text.clearTint(),
        })
    }

    destroy(): void {
        // Clean up all active damage numbers
        this.damageNumbers.forEach(text => text.destroy())
        this.damageNumberPool.forEach(text => text.destroy())

        this.damageNumbers = []
        this.damageNumberPool = []
    }
}
