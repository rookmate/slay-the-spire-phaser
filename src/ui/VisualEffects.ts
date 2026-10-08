import { loadSettings } from '../core/settings'
import { playCue } from './sound'
import Phaser from 'phaser'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'
import { Card } from './Card'

export class VisualEffects {
    private scene: Phaser.Scene
    private damageNumbers: Phaser.GameObjects.Text[] = []
    private impacts = new Set<Phaser.GameObjects.Graphics>()
    private damageNumberPool: Phaser.GameObjects.Text[] = []
    private playedCards = new Set<Card>()

    constructor(scene: Phaser.Scene) {
        this.scene = scene
    }

    playCard(card: Card, x: number, y: number): void {
        if (loadSettings().reducedMotion) { card.destroy(); return }
        this.playedCards.add(card)
        card.setName('played-card').setDepth(COMBAT_UI_CONFIG.depths.dragCard)
        this.scene.tweens.add({ targets: card, x: x - Card.CARD_WIDTH * 0.15, y: y - Card.CARD_HEIGHT * 0.15,
            scale: 0.3, alpha: 0, duration: 200, ease: 'Cubic.In',
            onComplete: () => { this.playedCards.delete(card); card.destroy() } })
    }

    showDamageNumber(amount: number, x: number, y: number, isHealing = false): void {
        playCue(isHealing ? 'heal' : 'damage')
        const reducedMotion = loadSettings().reducedMotion
        if (this.damageNumbers.length >= 20) return
        // Get or create a damage number text object
        let damageText = this.damageNumberPool.pop()
        if (!damageText) {
            damageText = this.scene.add.text(0, 0, '', {
                resolution: 2, fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
                fontSize: '24px',
                color: isHealing ? '#00ff00' : '#ff4444',
                stroke: '#000000',
                strokeThickness: 2
            })
            damageText.setDepth(10000)
        }

        // Configure the damage number
        damageText.setText(amount.toString()).setColor(isHealing ? '#b8e994' : '#ff7766')
        damageText.setPosition(x, y)
        damageText.setAlpha(1)
        damageText.setScale(1)
        damageText.setVisible(true)

        // Add to active damage numbers
        this.damageNumbers.push(damageText)

        // Animate the damage number
        this.scene.tweens.add({
            targets: damageText,
            y: reducedMotion ? y : y - 60,
            alpha: 0,
            scale: reducedMotion ? 1 : 1.2,
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

    showImpact(x: number, y: number, kind: 'hit' | 'block' | 'power' | 'orb' | 'stance', color = 0xe3c698): void {
        if (loadSettings().reducedMotion || this.impacts.size >= 20) return
        const mark = this.scene.add.graphics({ x, y }).setDepth(90)
        this.impacts.add(mark)
        mark.lineStyle(kind === 'hit' ? 4 : 2, color, 0.9)
        if (kind === 'hit') {
            mark.lineBetween(-22, 20, 22, -20); mark.lineBetween(-8, 26, 25, -8)
        } else if (kind === 'block') {
            mark.strokePoints([{ x: -20, y: -20 }, { x: 20, y: -20 }, { x: 18, y: 10 }, { x: 0, y: 25 }, { x: -18, y: 10 }], true)
        } else {
            mark.strokeCircle(0, 0, kind === 'stance' ? 38 : 22)
            for (let i = 0; i < 4; i++) { const angle = i * Math.PI / 2; mark.lineBetween(Math.cos(angle) * 28, Math.sin(angle) * 28, Math.cos(angle) * 35, Math.sin(angle) * 35) }
        }
        this.scene.tweens.add({ targets: mark, alpha: 0, scale: kind === 'hit' ? 1.15 : 1.4, duration: 240, onComplete: () => { this.impacts.delete(mark); mark.destroy() } })
    }

    screenShake(intensity: number = 1, duration: number = COMBAT_UI_CONFIG.animations.screenShakeDuration): void {
        if (loadSettings().reducedMotion) return
        this.scene.cameras.main.shake(duration, intensity * COMBAT_UI_CONFIG.animations.screenShakeIntensity)
    }

    flashText(text: Phaser.GameObjects.Text, color: number = 0xff4444, duration: number = 60): void {
        if (loadSettings().reducedMotion) return
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
        for (const card of this.playedCards) { this.scene.tweens.killTweensOf(card); card.destroy() }
        this.playedCards.clear()
        for (const mark of this.impacts) { this.scene.tweens.killTweensOf(mark); mark.destroy() }
        this.impacts.clear()
        for (const text of this.damageNumbers) this.scene.tweens.killTweensOf(text)
        // Clean up all active damage numbers
        this.damageNumbers.forEach(text => text.destroy())
        this.damageNumberPool.forEach(text => text.destroy())

        this.damageNumbers = []
        this.damageNumberPool = []
    }
}
