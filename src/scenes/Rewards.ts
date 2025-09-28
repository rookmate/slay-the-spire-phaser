import Phaser from 'phaser'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { CARD_DEFS } from '../core/cards'
import { Card } from '../ui/Card'

export class RewardsScene extends Phaser.Scene {
    run!: RunState
    constructor() { super('Rewards') }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }

        // Title at the top
        this.add.text(this.scale.width / 2, 30, 'Victory! Choose a card:', { ...style, fontSize: '24px' })
            .setOrigin(0.5, 0)

        // Generate card choices
        const pool = Object.entries(CARD_DEFS)
            .filter(([_, def]) => def.rarity && def.rarity !== 'basic')
            .map(([id]) => id)
        const rng = new Phaser.Math.RandomDataGenerator([this.run.seed + ':' + this.run.floor])
        const choices = [] as string[]
        const copy = [...pool]
        for (let i = 0; i < 3 && copy.length > 0; i++) {
            const idx = Math.floor(rng.frac() * copy.length)
            const [id] = copy.splice(idx, 1)
            choices.push(id)
        }

        // Display cards horizontally centered
        const cardSpacing = 140
        const startX = this.scale.width / 2 - (choices.length - 1) * cardSpacing / 2
        const cardY = this.scale.height / 2 - 50

        // Store all card objects so we can hide them later
        const cardObjects: Card[] = []

        choices.forEach((id, i) => {
            const card = { defId: id, upgraded: false } as any
            const cardX = startX + i * cardSpacing

            const cardObj = new Card(this, card, {
                x: cardX,
                y: cardY,
                scale: 0.8,
                interactive: true
            })

            // Add the card directly to the scene
            this.add.existing(cardObj)
            cardObjects.push(cardObj)

            // Ensure the card is properly interactive
            cardObj.setInteractive({
                useHandCursor: true
            })

            // Add click handler
            cardObj.on('pointerdown', () => {
                // Add card to deck
                this.run.deck.push({ defId: id, upgraded: false })

                // Hide all other cards
                cardObjects.forEach((otherCard) => {
                    if (otherCard !== cardObj) {
                        otherCard.setVisible(false)
                    }
                })

                // Move selected card to center
                cardObj.setPosition(this.scale.width / 2, cardY)
                cardObj.setScale(1.0) // Make it slightly larger

                // Disable interaction on the selected card
                cardObj.setInteractive(false)


                // Enable continue button
                enableContinueButton()
            })
        })

        // Continue button centered at bottom (initially disabled)
        const continueButton = this.add.text(this.scale.width / 2, this.scale.height - 60, 'Continue', {
            ...style,
            backgroundColor: '#666',
            padding: { x: 12, y: 8 },
            fontSize: '20px'
        })
            .setOrigin(0.5, 0.5)
            .setInteractive({ useHandCursor: false })

        // Store reference to continue button for later activation
        let cardSelected = false

        // Update continue button click handler
        continueButton.on('pointerdown', () => {
            if (cardSelected) {
                this.run.gold += 20
                this.run.floor += 1
                saveRun(this.run)
                this.scene.start('Map', { run: this.run })
            }
        })

        // Function to enable continue button after card selection
        const enableContinueButton = () => {
            cardSelected = true
            continueButton.setStyle({ backgroundColor: '#333' })
            continueButton.setInteractive({ useHandCursor: true })
        }
    }
}


