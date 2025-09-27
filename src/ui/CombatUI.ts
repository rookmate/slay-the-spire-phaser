import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { EmittedEvent } from '../core/actions'
import { CARD_DEFS } from '../core/cards'
import type { CardInstance, EnemyState } from '../core/state'
import { CardView } from './CardView'

export class CombatUI {
    private scene: Phaser.Scene
    private engine: Engine
    private handButtons: Phaser.GameObjects.Text[] = []
    private handCards: CardView[] = []
    private enemyTexts: Phaser.GameObjects.Text[] = []
    private playerSprite?: Phaser.GameObjects.Image
    private enemySprites: Phaser.GameObjects.Image[] = []

    private onPlay?: (card: CardInstance, targets: string[]) => void
    private onEnd?: () => void

    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
        this.build()
    }

    private build(): void {
        const p = this.engine.state.player
        const style = { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' }
        this.scene.add.text(16, 16, 'Player', style)
        // Player sprite
        this.playerSprite = this.scene.add.image(120, 180, 'player:ironclad').setScale(0.35)
        const playerStats = this.scene.add.text(16, 40, this.playerStatsText(), style)

        // Enemy sprites and labels
        this.enemySprites.forEach(s => s.destroy())
        this.enemySprites = []
        this.enemyTexts = []
        this.engine.state.enemies.forEach((e, i) => {
            const texKey = `enemy:${e.specId ?? e.name.toUpperCase().replace(/\s+/g, '_')}`
            const sprite = this.scene.add.image(600, 160 + i * 80, texKey).setScale(0.5)
            this.enemySprites.push(sprite)
            const label = this.scene.add.text(500, 120 + i * 80, this.enemyText(e), style)
            this.enemyTexts.push(label)
        })

        // Hand buttons
        const rebuildHand = () => {
            this.handButtons.forEach(b => b.destroy())
            this.handButtons = []
            this.handCards.forEach(c => c.destroy())
            this.handCards = []
            p.hand.forEach((card, i) => {
                const cardView = new CardView(this.scene, card, { x: 16 + i * 100, y: 290, scale: 1, interactive: true })
                this.scene.add.existing(cardView)
                cardView.on('pointerdown', () => {
                    const target = this.engine.state.enemies.find(e => e.hp > 0)?.id
                    if (!target) return
                    this.onPlay?.(card, [target])
                    playerStats.setText(this.playerStatsText())
                    this.refreshEnemies()
                    rebuildHand()
                })
                this.handCards.push(cardView)
            })
        }

        rebuildHand()

        this.scene.add.text(16, 360, 'End Turn', {
            ...style,
            backgroundColor: '#550000',
            padding: { x: 6, y: 4 },
        })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.onEnd?.()
                playerStats.setText(this.playerStatsText())
                this.refreshEnemies()
                rebuildHand()
            })
    }

    private playerStatsText(): string {
        const p = this.engine.state.player
        return `HP ${p.hp}/${p.maxHp}  Block ${p.block}  Energy ${p.energy}  Hand ${p.hand.length}`
    }

    private enemyText(e: EnemyState): string {
        let intent = ''
        if (e.intent?.kind === 'attack') intent = `  Intent: ${e.intent.amount} ⚔`
        else if (e.intent?.kind === 'block') intent = `  Intent: ${e.intent.amount} 🛡`
        else if (e.intent?.kind === 'debuff') intent = `  Intent: ${e.intent.debuff} ↓`
        else intent = `  Intent: Buff ✦`
        return `${e.name}  HP ${e.hp}/${e.maxHp}  Block ${e.block}${intent}`
    }

    private refreshEnemies(): void {
        this.enemyTexts.forEach((t, i) => t.setText(this.enemyText(this.engine.state.enemies[i])))
        // hide defeated
        this.engine.state.enemies.forEach((e, i) => {
            const spr = this.enemySprites[i]
            if (!spr) return
            spr.setAlpha(e.hp > 0 ? 1 : 0.3)
        })
    }

    apply(events: EmittedEvent[]): void {
        if (events.length === 0) return
        // Simple feedback: flash red when damage applied, update labels
        for (const e of events) {
            if (e.kind === 'DamageApplied') {
                const idx = this.engine.state.enemies.findIndex(en => en.id === e.target)
                if (idx >= 0) {
                    const txt = this.enemyTexts[idx]
                    this.scene.tweens.add({
                        targets: txt,
                        tint: 0xff4444,
                        duration: 60,
                        yoyo: true,
                        repeat: 0,
                        onComplete: () => txt.clearTint(),
                    })
                }
                // if player damaged, shake camera
                if (e.target === 'player') {
                    this.scene.cameras.main.shake(100, 0.004)
                }
            }
        }
        this.refreshEnemies()
    }

    onPlayCard(fn: (card: CardInstance, targets: string[]) => void): void {
        this.onPlay = fn
    }

    onEndTurn(fn: () => void): void {
        this.onEnd = fn
    }
}


