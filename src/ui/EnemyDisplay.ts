import { loadSettings } from '../core/settings'
import type Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { EnemyState } from '../core/state'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'
import { enemySlots } from './layout'
import { summarizeEffects } from './effectLabels'

export class EnemyDisplay {
    private scene: Phaser.Scene
    private engine: Engine
    private enemySprites: Phaser.GameObjects.Image[] = []
    private enemyTexts: Phaser.GameObjects.Text[] = []
    private enemyHpTexts: Phaser.GameObjects.Text[] = []
    private enemyTitleTexts: Phaser.GameObjects.Text[] = []
    private enemyNameTexts: Phaser.GameObjects.Text[] = []
    private enemyPowerTexts: Phaser.GameObjects.Text[] = []
    private enemyIds: string[] = []
    private healthBars: Phaser.GameObjects.Rectangle[] = []
    private healthTracks: Phaser.GameObjects.Rectangle[] = []
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
            resolution: 2, fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.fontSize,
            color: COMBAT_UI_CONFIG.styles.color,
        }

        const slots = enemySlots(this.scene.cameras.main.width, this.scene.cameras.main.height, this.engine.state.enemies.length)
        this.engine.state.enemies.forEach((enemy, index) => {
            this.enemyIds.push(enemy.id)
            const slot = slots[index]
            const texture = `enemy:${enemy.specId ?? enemy.name.toUpperCase().replace(/\s+/g, '_')}`
            const sprite = this.scene.add.image(slot.x, slot.y + 70, texture).setInteractive({ useHandCursor: true })
            sprite.setScale(Math.min((slot.width - 8) / sprite.width, 78 / sprite.height))
            sprite.on('pointerdown', () => {
                if (enemy.hp > 0) this.onEnemyClick?.(index)
            })
            this.enemySprites.push(sprite)
            const barWidth = Math.min(80, slot.width - 12)
            this.healthTracks.push(this.scene.add.rectangle(slot.x - barWidth / 2, slot.y + 109, barWidth, 3, 0x443239).setOrigin(0))
            this.healthBars.push(this.scene.add.rectangle(slot.x - barWidth / 2, slot.y + 109, barWidth * enemy.hp / enemy.maxHp, 3, 0xc88a78).setOrigin(0))

            const labelStyle = { ...style, fontSize: '12px', align: 'center', wordWrap: { width: slot.width } }
            const nameLength = Math.max(5, Math.floor(slot.width / 5.5))
            this.enemyTitleTexts.push(this.scene.add.text(slot.x, slot.y + 19, enemy.name.length <= nameLength ? enemy.name : `${enemy.name.slice(0, nameLength - 1)}…`, { ...labelStyle, fontSize: '9px', color: '#c5b69a' }).setOrigin(0.5, 0))
            const intent = this.scene.add.text(slot.x, slot.y, this.getEnemyText(enemy), labelStyle).setOrigin(0.5, 0)
            const hp = this.scene.add.text(slot.x, slot.y + 114, this.getEnemyHpLabel(enemy), labelStyle).setOrigin(0.5, 0)
            const name = this.scene.add.text(Math.min(this.scene.cameras.main.width - 110, slot.x), slot.y, this.getEnemyDetails(enemy), {
                ...labelStyle, wordWrap: { width: 200 }, backgroundColor: '#111111', padding: { x: 6, y: 4 },
            }).setOrigin(0.5, 0).setAlpha(0).setDepth(6000)
            const powers = this.scene.add.text(slot.x, slot.y + 129, this.getEnemySummary(enemy, slot.width), {
                fontFamily: style.fontFamily, fontSize: '10px', color: '#ccbfa5',
            }).setOrigin(0.5, 0)

            sprite.on('pointerover', () => name.setAlpha(1))
            sprite.on('pointerout', () => name.setAlpha(0))

            this.enemyTexts.push(intent)
            this.enemyHpTexts.push(hp)
            this.enemyNameTexts.push(name)
            this.enemyPowerTexts.push(powers)
        })
    }

    private clearEnemies(): void {
        this.healthBars.forEach(item => item.destroy()); this.healthTracks.forEach(item => item.destroy())
        this.healthBars = []; this.healthTracks = []
        this.enemySprites.forEach(item => item.destroy())
        this.enemyTexts.forEach(item => item.destroy())
        this.enemyHpTexts.forEach(item => item.destroy())
        this.enemyTitleTexts.forEach(item => item.destroy())
        this.enemyTitleTexts = []
        this.enemyNameTexts.forEach(item => item.destroy())
        this.enemyPowerTexts.forEach(item => item.destroy())
        this.enemySprites = []
        this.enemyTexts = []
        this.enemyHpTexts = []
        this.enemyNameTexts = []
        this.enemyPowerTexts = []
        this.enemyIds = []
    }

    private getEnemyText(enemy: EnemyState): string {
        if (this.engine.run?.relics.includes('RUNIC_DOME')) return '?'
        if (enemy.intent?.kind === 'attack') return `Attack ${this.engine.previewEnemyAttack(enemy)}`
        if (enemy.intent?.kind === 'multi_attack') return `Attack ${this.engine.previewEnemyAttack(enemy)}×${enemy.intent.hits}`
        if (enemy.intent?.kind === 'block') return `Block ${enemy.intent.amount}`
        if (enemy.intent?.kind === 'debuff') return `${enemy.intent.debuff} ↓`
        if (enemy.intent?.kind === 'status') return `${enemy.intent.createdDefId} x${enemy.intent.count}`
        if (enemy.intent?.kind === 'summon') return `Summon`
        return enemy.intent?.desc ?? 'Buff'
    }

    private getEnemyHpLabel(enemy: EnemyState): string {
        return `${enemy.hp}/${enemy.maxHp}${enemy.block ? ` · ${enemy.block} Block` : ''}`
    }

    private getEnemyPowers(enemy: EnemyState): string[] {
        const parts = enemy.powers.map(power => `${power.id}:${power.stacks}`)
        if (enemy.specId === 'BYRD') {
            if (enemy.aiState?.flying) parts.push(`FLYING:${Math.max(0, ((enemy.asc ?? 0) >= 17 ? 4 : 3) - Number(enemy.aiState?.hitsTaken ?? 0))}`)
            if (enemy.aiState?.downed) parts.push('DOWNED')
        }
        if (enemy.specId === 'TIME_EATER') parts.unshift(`TIME WARP:${enemy.aiState?.cards ?? 0}/12`)
        if (enemy.specId === 'CORRUPT_HEART') parts.unshift(`INVINCIBLE:${Math.max(0, ((enemy.asc ?? 0) >= 19 ? 200 : 300) - Number(enemy.aiState?.damageThisTurn ?? 0))}`, `BEAT:${((enemy.asc ?? 0) >= 19 ? 2 : 1) + (Number(enemy.aiState?.buffs ?? 0) >= 2 ? 1 : 0)}`)
        if (enemy.specId === 'GIANT_HEAD') parts.unshift(`SLOW:${enemy.aiState?.slow ?? 0}`)
        if (this.engine.state.enemies.filter(e => e.hp > 0 && ['SPIRE_SHIELD', 'SPIRE_SPEAR'].includes(e.specId ?? '')).length === 2) parts.unshift(enemy.id === (this.engine.state.facingEnemyId ?? this.engine.state.enemies[0].id) ? 'FACING' : 'BEHIND:+50%')
        if (enemy.halfDead) parts.unshift('REVIVING')
        return parts
    }

    private getEnemyDetails(enemy: EnemyState): string {
        return [enemy.name, ...this.getEnemyPowers(enemy)].join('\n')
    }

    private getEnemySummary(enemy: EnemyState, width: number): string {
        return summarizeEffects(this.getEnemyPowers(enemy), Math.floor(width / 6.1))
    }

    update(): void {
        const enemies = this.engine.state.enemies
        if (enemies.length !== this.enemyIds.length || enemies.some((enemy, index) => enemy.id !== this.enemyIds[index])) {
            this.build()
        }
        const slots = enemySlots(this.scene.cameras.main.width, this.scene.cameras.main.height, enemies.length)
        this.engine.state.enemies.forEach((enemy, index) => {
            this.healthBars[index]?.setDisplaySize(Math.min(80, slots[index].width - 12) * Math.max(0, enemy.hp / enemy.maxHp), 3)
            this.enemyTexts[index]?.setText(this.getEnemyText(enemy))
            this.enemyHpTexts[index]?.setText(this.getEnemyHpLabel(enemy))
            this.enemyPowerTexts[index]?.setText(this.getEnemySummary(enemy, slots[index].width))
            this.enemyNameTexts[index]?.setText(this.getEnemyDetails(enemy))
            this.enemySprites[index]?.setAlpha(enemy.hp > 0 ? 1 : 0.25)
        })
    }

    getEnemyAtPoint(x: number, y: number): number {
        for (let i = 0; i < this.enemySprites.length; i++) {
            const sprite = this.enemySprites[i]
            const enemy = this.engine.state.enemies[i]
            if (!sprite || !enemy || enemy.hp <= 0) continue
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
        if (!text || loadSettings().reducedMotion) return
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
