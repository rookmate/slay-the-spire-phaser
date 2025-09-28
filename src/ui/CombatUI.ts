import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { EmittedEvent } from '../core/actions'
import type { CardInstance, EnemyState } from '../core/state'
import { Card } from './Card'

export class CombatUI {
    private scene: Phaser.Scene
    private engine: Engine
    private handButtons: Phaser.GameObjects.Text[] = []
    private handCards: Card[] = []
    private handContainer?: Phaser.GameObjects.Container
    private handInputArea?: Phaser.GameObjects.Rectangle // Add this line
    private enemyTexts: Phaser.GameObjects.Text[] = []
    private playerHpText?: Phaser.GameObjects.Text
    private playerSprite?: Phaser.GameObjects.Image
    private enemySprites: Phaser.GameObjects.Image[] = []
    private enemyHpTexts: Phaser.GameObjects.Text[] = []
    private playerNameText?: Phaser.GameObjects.Text
    private enemyNameTexts: Phaser.GameObjects.Text[] = []
    private discardIcon?: Phaser.GameObjects.Text
    private discardOverlay?: Phaser.GameObjects.Container
    private discardList?: Phaser.GameObjects.Container
    private discardContentHeight = 0
    private drawIcon?: Phaser.GameObjects.Text
    private energyText?: Phaser.GameObjects.Text
    private readonly maxEnergyPerTurn = 3
    private deckOverlay?: Phaser.GameObjects.Container
    private deckList?: Phaser.GameObjects.Container
    private deckContentHeight = 0

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
        const hpStyle = { ...style, fontSize: '14px' }
        // Player sprite
        this.playerSprite = this.scene.add.image(120, 180, 'player:ironclad').setScale(0.35)
        // Draw pile (bottom-left) and Energy just above-right of it
        {
            const { height } = this.scene.scale
            this.drawIcon = this.scene.add.text(16, height - 16, '🃏', {
                ...style,
                fontSize: '24px',
                padding: { x: 6, y: 2 },
                backgroundColor: '#333333',
            }).setOrigin(0, 1)
            this.drawIcon.setDepth(1000)
            this.drawIcon.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openDeckOverlay())
            this.energyText = this.scene.add.text(16 + 56, height - 16 - 40, this.playerStatsText(), {
                ...style,
                backgroundColor: '#222',
                padding: { x: 6, y: 4 },
            }).setOrigin(0, 1)
            this.energyText.setDepth(1000)
        }
        // Player HP under sprite
        this.playerHpText = this.scene.add
            .text(this.playerSprite.x, this.playerSprite.y + 80, this.playerHpLabel(), hpStyle)
            .setOrigin(0.5, 0)
        // Player name on hover
        this.playerNameText = this.scene.add
            .text(this.playerSprite.x, this.playerSprite.y - 70, 'Ironclad', style)
            .setOrigin(0.5, 1)
            .setAlpha(0)
        this.playerSprite.setInteractive()
        this.playerSprite.on('pointerover', () => this.playerNameText?.setAlpha(1))
        this.playerSprite.on('pointerout', () => this.playerNameText?.setAlpha(0))

        // Enemy sprites and labels
        this.enemySprites.forEach(s => s.destroy())
        this.enemySprites = []
        this.enemyTexts = []
        this.enemyHpTexts.forEach(t => t.destroy())
        this.enemyHpTexts = []
        this.enemyNameTexts.forEach(t => t.destroy())
        this.enemyNameTexts = []
        this.engine.state.enemies.forEach((e, i) => {
            const texKey = `enemy:${e.specId ?? e.name.toUpperCase().replace(/\s+/g, '_')}`
            const sprite = this.scene.add.image(600, 160 + i * 80, texKey).setScale(0.5)
            sprite.setInteractive()
            sprite.setDepth(5)
            this.enemySprites.push(sprite)
            const intentText = this.scene.add
                .text(sprite.x, sprite.y - 80, this.enemyText(e), style)
                .setOrigin(0.5, 1)
                .setDepth(10)
            this.enemyTexts.push(intentText)
            const hp = this.scene.add
                .text(sprite.x, sprite.y + 60, this.enemyHpLabel(e), hpStyle)
                .setOrigin(0.5, 0)
                .setDepth(1)
            this.enemyHpTexts.push(hp)
            const nameText = this.scene.add
                .text(sprite.x, sprite.y - 60, e.name, style)
                .setOrigin(0.5, 1)
                .setAlpha(0)
                .setDepth(9)
            this.enemyNameTexts.push(nameText)
            sprite.on('pointerover', () => nameText.setAlpha(1))
            sprite.on('pointerout', () => nameText.setAlpha(0))
        })

        // Hand: simple fan layout with proper centering
        const layoutHand = () => {
            const n = this.handCards.length
            const screenW = this.scene.scale.width
            const screenH = this.scene.scale.height
            if (n === 0) return

            // Simple linear fan with slight curve
            const centerX = screenW / 2
            const baseY = screenH - 150
            const cardSpacing = 60 // spacing between card centers
            const totalWidth = (n - 1) * cardSpacing
            const startX = centerX - totalWidth / 2

            for (let i = 0; i < n; i++) {
                const view = this.handCards[i]
                const x = startX + i * cardSpacing
                const y = baseY + Math.sin((i / (n - 1)) * Math.PI) * 15 // slight curve
                const rotation = (i - (n - 1) / 2) * 0.08 // rotation per position
                const depth = 200 + i

                view.setPosition(x, y)
                view.setRotation(rotation)
                view.setDepth(depth)
                view.setScale(1)
                view.setData('baseX', x)
                view.setData('baseY', y)
                view.setData('baseRot', rotation)
                view.setData('baseDepth', depth)
            }
        }

        // Apply hover state: raise hovered card, scale it, straighten rotation; push siblings slightly aside
        const applyHoverState = (hoverIndex: number | null) => {
            const n = this.handCards.length
            const siblingShift = 20
            for (let i = 0; i < n; i++) {
                const view = this.handCards[i]
                const bx = view.getData('baseX') as number
                const by = view.getData('baseY') as number
                const br = view.getData('baseRot') as number
                const bd = view.getData('baseDepth') as number
                if (hoverIndex === i) {
                    view.setDepth(5000)
                    this.scene.tweens.add({
                        targets: view,
                        x: bx,
                        y: by - 50,
                        rotation: 0,
                        scale: 1.1,
                        duration: 120,
                        ease: 'Sine.Out',
                    })
                } else if (hoverIndex != null) {
                    const dir = Math.sign(i - hoverIndex)
                    this.scene.tweens.add({
                        targets: view,
                        x: bx + dir * siblingShift,
                        y: by,
                        rotation: br,
                        scale: 1,
                        duration: 120,
                        ease: 'Sine.Out',
                    })
                } else {
                    this.scene.tweens.add({
                        targets: view,
                        x: bx,
                        y: by,
                        rotation: br,
                        scale: 1,
                        duration: 120,
                        ease: 'Sine.Out',
                        onComplete: () => view.setDepth(bd),
                    })
                }
            }
        }

        const rebuildHand = () => {
            this.handButtons.forEach(b => b.destroy())
            this.handButtons = []
            this.handCards.forEach(c => c.destroy())
            this.handCards = []

            // Create or recreate hand container
            if (this.handContainer) {
                this.handContainer.destroy()
            }
            this.handContainer = this.scene.add.container(0, 0)
            this.handContainer.setDepth(200)

            p.hand.forEach((card) => {
                // Create card with interactive disabled to avoid conflicts
                const cardSprite = new Card(this.scene, card, { x: 0, y: 0, scale: 1, interactive: false })
                this.handContainer!.add(cardSprite)
                this.handCards.push(cardSprite)
            })

            // Set up a single interactive area for the entire hand
            setupHandInput()
            layoutHand()
        }

        // Set up input handling for the hand
        const setupHandInput = () => {
            // Remove existing hand input if any
            if (this.handInputArea) {
                this.handInputArea.destroy()
            }

            // Create a large invisible rectangle that covers the hand area
            const screenW = this.scene.scale.width
            const screenH = this.scene.scale.height
            const centerX = screenW / 2
            const baseY = screenH - 150

            this.handInputArea = this.scene.add.rectangle(
                centerX,
                baseY,
                screenW,
                200,
                0x000000,
                0 // Completely transparent
            )
            this.handInputArea.setDepth(100) // Below cards but above background
            this.handInputArea.setInteractive()

            let currentHoverIndex: number | null = null

            this.handInputArea.on('pointermove', (pointer: Phaser.Input.Pointer) => {
                // Find all cards at this pointer position
                const cardsAtPoint = Card.getCardsAtPoint(pointer.worldX, pointer.worldY)
                const topCard = cardsAtPoint[0]

                if (topCard) {
                    const topIndex = this.handCards.indexOf(topCard)
                    if (topIndex !== currentHoverIndex) {
                        currentHoverIndex = topIndex
                        applyHoverState(topIndex)
                    }
                } else if (currentHoverIndex !== null) {
                    currentHoverIndex = null
                    applyHoverState(null)
                }
            })

            this.handInputArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                const topCard = Card.getTopCardAtPoint(pointer.worldX, pointer.worldY)
                if (topCard) {
                    const cardIndex = this.handCards.indexOf(topCard)
                    if (cardIndex !== -1) {
                        const target = this.engine.state.enemies.find(e => e.hp > 0)?.id
                        if (!target) return
                        this.onPlay?.(this.engine.state.player.hand[cardIndex], [target])
                        this.refreshEnergy()
                        this.refreshEnemies()
                        rebuildHand()
                    }
                }
            })
        }

        rebuildHand()

        const { width, height } = this.scene.scale
        // Discard pile icon (bottom-right)
        this.discardIcon = this.scene.add.text(width - 16, height - 16, '🂠', {
            ...style,
            fontSize: '24px',
            padding: { x: 6, y: 2 },
            backgroundColor: '#333333',
        })
            .setOrigin(1, 1)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.openDiscardOverlay())

        // End Turn slightly above-left of discard icon
        const endTurn = this.scene.add.text(width - 16 - 50, height - 16 - 30, 'End\nTurn', {
            ...style,
            backgroundColor: '#550000',
            padding: { x: 6, y: 4 },
        })
            .setOrigin(1, 1)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.onEnd?.()
                this.refreshEnergy()
                this.refreshEnemies()
                rebuildHand()
            })
        endTurn.setDepth(1000)
        this.discardIcon.setDepth(1000)
        this.scene.scale.on('resize', (gameSize: any) => {
            this.discardIcon?.setPosition(gameSize.width - 16, gameSize.height - 16)
            endTurn.setPosition(gameSize.width - 16 - 50, gameSize.height - 16 - 30)
            this.drawIcon?.setPosition(16, gameSize.height - 16)
            this.energyText?.setPosition(16 + 56, gameSize.height - 16 - 40)
            layoutHand()
        })
    }

    private playerStatsText(): string {
        const p = this.engine.state.player
        return `⚡ ${p.energy}/${this.maxEnergyPerTurn}`
    }

    private enemyText(e: EnemyState): string {
        if (e.intent?.kind === 'attack') return `${e.intent.amount} ⚔`
        if (e.intent?.kind === 'block') return `${e.intent.amount} 🛡`
        if (e.intent?.kind === 'debuff') return `${e.intent.debuff} ↓`
        return `Buff ✦`
    }

    private refreshEnemies(): void {
        this.enemyTexts.forEach((t, i) => t.setText(this.enemyText(this.engine.state.enemies[i])))
        // hide defeated
        this.engine.state.enemies.forEach((e, i) => {
            const spr = this.enemySprites[i]
            if (!spr) return
            spr.setAlpha(e.hp > 0 ? 1 : 0.3)
        })
        this.refreshHp()
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
        this.refreshDiscardOverlay()
        this.refreshDeckOverlay()
        this.refreshEnergy()
    }

    onPlayCard(fn: (card: CardInstance, targets: string[]) => void): void {
        this.onPlay = fn
    }

    onEndTurn(fn: () => void): void {
        this.onEnd = fn
    }

    private playerHpLabel(): string {
        const p = this.engine.state.player
        return `🛡 ${p.block}  ♥ ${p.hp}/${p.maxHp}`
    }

    private enemyHpLabel(e: EnemyState): string {
        return `🛡 ${e.block}  ♥ ${e.hp}/${e.maxHp}`
    }

    private refreshHp(): void {
        if (this.playerHpText) this.playerHpText.setText(this.playerHpLabel())
        this.engine.state.enemies.forEach((e, i) => {
            const t = this.enemyHpTexts[i]
            if (t) t.setText(this.enemyHpLabel(e))
        })
    }

    private refreshEnergy(): void {
        if (this.energyText) this.energyText.setText(this.playerStatsText())
    }

    private openDiscardOverlay(): void {
        if (this.discardOverlay) {
            this.closeDiscardOverlay()
        }
        const { width, height } = this.scene.scale
        const overlay = this.scene.add.container(0, 0)
        overlay.setDepth(2000)
        const bg = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0, 0)
        bg.setInteractive()
        bg.on('pointerdown', () => this.closeDiscardOverlay())
        overlay.add(bg)

        const title = this.scene.add.text(16, 16, 'Discard Pile', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' })
        overlay.add(title)

        const close = this.scene.add.text(width - 16, 16, 'Close', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff', backgroundColor: '#444', padding: { x: 8, y: 6 } })
            .setOrigin(1, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.closeDiscardOverlay())
        overlay.add(close)

        const list = this.scene.add.container(0, 60)
        overlay.add(list)
        const colW = 100
        const rowHCard = 140
        const cols = 6
        const pile = this.engine.state.player.discardPile
        pile.forEach((card, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            const view = new Card(this.scene, card, { x: 16 + col * colW, y: row * rowHCard, scale: 0.5 })
            list.add(view)
        })
        const totalRows = Math.ceil(pile.length / cols)
        this.discardContentHeight = totalRows * rowHCard

        const onWheel = (_p: any, _go: any, _dx: number, dy: number) => {
            const viewportHeight = this.scene.scale.height - 120
            const minY = 60 - Math.max(0, this.discardContentHeight - viewportHeight)
            const maxY = 60
            list.y = Phaser.Math.Clamp(list.y - dy, minY, maxY)
        }
        this.scene.input.on('wheel', onWheel)

        // Save refs for cleanup
        this.discardOverlay = overlay
        this.discardList = list
            // Attach cleanup function on overlay for wheel
            ; (overlay as any)._wheelHandler = onWheel
    }

    private closeDiscardOverlay(): void {
        if (!this.discardOverlay) return
        const handler = (this.discardOverlay as any)._wheelHandler
        if (handler) this.scene.input.off('wheel', handler)
        this.discardOverlay.destroy(true)
        this.discardOverlay = undefined
        this.discardList = undefined
    }

    private refreshDiscardOverlay(): void {
        if (!this.discardOverlay || !this.discardList) return
        this.discardList.removeAll(true)
        const colW = 100
        const rowHCard = 140
        const cols = 6
        const pile = this.engine.state.player.discardPile
        pile.forEach((card, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            const view = new Card(this.scene, card, { x: 16 + col * colW, y: row * rowHCard, scale: 0.5 })
            this.discardList!.add(view)
        })
        const totalRows = Math.ceil(pile.length / cols)
        this.discardContentHeight = totalRows * rowHCard
    }

    private openDeckOverlay(): void {
        if (this.deckOverlay) {
            this.closeDeckOverlay()
        }
        const { width, height } = this.scene.scale
        const overlay = this.scene.add.container(0, 0)
        overlay.setDepth(2000)
        const bg = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0, 0)
        bg.setInteractive()
        bg.on('pointerdown', () => this.closeDeckOverlay())
        overlay.add(bg)

        const title = this.scene.add.text(16, 16, 'Draw Pile', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' })
        overlay.add(title)

        const close = this.scene.add.text(width - 16, 16, 'Close', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff', backgroundColor: '#444', padding: { x: 8, y: 6 } })
            .setOrigin(1, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.closeDeckOverlay())
        overlay.add(close)

        const list = this.scene.add.container(0, 60)
        overlay.add(list)
        const colW = 100
        const rowHCard = 140
        const cols = 6
        const pile = this.engine.state.player.drawPile
        pile.forEach((card, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            const view = new Card(this.scene, card, { x: 16 + col * colW, y: row * rowHCard, scale: 0.5 })
            list.add(view)
        })
        const totalRows = Math.ceil(pile.length / cols)
        this.deckContentHeight = totalRows * rowHCard

        const onWheel = (_p: any, _go: any, _dx: number, dy: number) => {
            const viewportHeight = this.scene.scale.height - 120
            const minY = 60 - Math.max(0, this.deckContentHeight - viewportHeight)
            const maxY = 60
            list.y = Phaser.Math.Clamp(list.y - dy, minY, maxY)
        }
        this.scene.input.on('wheel', onWheel)

        this.deckOverlay = overlay
        this.deckList = list
            ; (overlay as any)._wheelHandler = onWheel
    }

    private closeDeckOverlay(): void {
        if (!this.deckOverlay) return
        const handler = (this.deckOverlay as any)._wheelHandler
        if (handler) this.scene.input.off('wheel', handler)
        this.deckOverlay.destroy(true)
        this.deckOverlay = undefined
        this.deckList = undefined
    }

    private refreshDeckOverlay(): void {
        if (!this.deckOverlay || !this.deckList) return
        this.deckList.removeAll(true)
        const colW = 100
        const rowHCard = 140
        const cols = 6
        const pile = this.engine.state.player.drawPile
        pile.forEach((card, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            const view = new Card(this.scene, card, { x: 16 + col * colW, y: row * rowHCard, scale: 0.5 })
            this.deckList!.add(view)
        })
        const totalRows = Math.ceil(pile.length / cols)
        this.deckContentHeight = totalRows * rowHCard
    }

    // Clean up method to properly destroy all UI elements
    public destroy(): void {
        // Clear all card sprites from the static registry
        Card.clearAllCards()

        // Destroy hand input area
        if (this.handInputArea) {
            this.handInputArea.destroy()
        }

        // Destroy hand container and cards
        if (this.handContainer) {
            this.handContainer.destroy()
        }

        // Destroy overlays
        if (this.discardOverlay) {
            this.closeDiscardOverlay()
        }
        if (this.deckOverlay) {
            this.closeDeckOverlay()
        }

        // Destroy other UI elements
        this.handButtons.forEach(b => b.destroy())
        this.enemySprites.forEach(s => s.destroy())
        this.enemyTexts.forEach(t => t.destroy())
        this.enemyHpTexts.forEach(t => t.destroy())
        this.enemyNameTexts.forEach(t => t.destroy())

        // Destroy remaining elements
        this.playerSprite?.destroy()
        this.playerHpText?.destroy()
        this.playerNameText?.destroy()
        this.discardIcon?.destroy()
        this.drawIcon?.destroy()
        this.energyText?.destroy()
    }
}