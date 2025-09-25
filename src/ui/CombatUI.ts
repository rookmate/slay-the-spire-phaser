import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { EmittedEvent } from '../core/actions'
import { CARD_DEFS } from '../core/cards'
import type { CardInstance, EnemyState } from '../core/state'

export class CombatUI {
    private scene: Phaser.Scene
    private engine: Engine
    private handButtons: Phaser.GameObjects.Text[] = []
    private enemyTexts: Phaser.GameObjects.Text[] = []

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
        const playerStats = this.scene.add.text(16, 40, this.playerStatsText(), style)

        // Enemy labels
        this.enemyTexts = this.engine.state.enemies.map((e, i) =>
            this.scene.add.text(400, 40 + i * 40, this.enemyText(e), style)
        )

        // Hand buttons
        const rebuildHand = () => {
            this.handButtons.forEach(b => b.destroy())
            this.handButtons = []
            p.hand.forEach((card, i) => {
                const def = CARD_DEFS[card.defId]
                const btn = this.scene.add.text(16 + i * 120, 300, `${def.name} (${def.cost})`, {
                    ...style,
                    backgroundColor: '#333',
                    padding: { x: 6, y: 4 },
                })
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => {
                        const target = this.engine.state.enemies.find(e => e.hp > 0)?.id
                        if (!target) return
                        this.onPlay?.(card, [target])
                        playerStats.setText(this.playerStatsText())
                        this.refreshEnemies()
                        rebuildHand()
                    })
                this.handButtons.push(btn)
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
        return `${e.name}  HP ${e.hp}/${e.maxHp}  Block ${e.block}${intent}`
    }

    private refreshEnemies(): void {
        this.enemyTexts.forEach((t, i) => t.setText(this.enemyText(this.engine.state.enemies[i])))
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


