import Phaser from 'phaser'
// import { createNewRun, loadRun, saveRun } from '../core/run'
import ironcladPng from '@sprites/Ironclad.png'
import slaverWebp from '@sprites/slaver.webp'
import looterPng from '@sprites/looter.png'
import gremlinWebp from '@sprites/gremlin.webp'
import fungiPng from '@sprites/fungi-beast.png'
import louseGreenWebp from '@sprites/lousegreen.webp'
import louseWebp from '@sprites/louse.webp'
import jawwarmWebp from '@sprites/jawwarm.webp'
import cultistWebp from '@sprites/cultist.webp'
import acidSlimeWebp from '@sprites/acid-slime.webp'
import spikeSlimeWebp from '@sprites/spike-slime.webp'

export class BootScene extends Phaser.Scene {
    constructor() {
        super('Boot')
    }

    preload(): void {
        // Player
        this.load.image('player:ironclad', ironcladPng)
        // Enemies
        this.load.image('enemy:SLAVER_RED', slaverWebp)
        this.load.image('enemy:SLAVER_BLUE', slaverWebp)
        this.load.image('enemy:LOOTER', looterPng)
        this.load.image('enemy:JAW_WORM', jawwarmWebp)
        this.load.image('enemy:RED_LOUSE', louseWebp)
        this.load.image('enemy:GREEN_LOUSE', louseGreenWebp)
        this.load.image('enemy:CULTIST', cultistWebp)
        this.load.image('enemy:FUNGI_BEAST', fungiPng)
        this.load.image('enemy:SNEAKY_GREMLIN', gremlinWebp)
        this.load.image('enemy:MAD_GREMLIN', gremlinWebp)
        this.load.image('enemy:FAT_GREMLIN', gremlinWebp)
        this.load.image('enemy:SHIELD_GREMLIN', gremlinWebp)
        this.load.image('enemy:WIZARD_GREMLIN', gremlinWebp)
        this.load.image('enemy:SPIKE_SLIME_S', spikeSlimeWebp)
        this.load.image('enemy:SPIKE_SLIME_M', spikeSlimeWebp)
        this.load.image('enemy:SPIKE_SLIME_L', spikeSlimeWebp)
        this.load.image('enemy:ACID_SLIME_S', acidSlimeWebp)
        this.load.image('enemy:ACID_SLIME_M', acidSlimeWebp)
        this.load.image('enemy:ACID_SLIME_L', acidSlimeWebp)
        this.load.image('enemy:GREMLIN_NOB', gremlinWebp)
        this.load.image('enemy:SENTRY', cultistWebp)
        this.load.image('enemy:LAGAVULIN', cultistWebp)
        this.load.image('enemy:THE_GUARDIAN', spikeSlimeWebp)
        this.load.image('enemy:SLIME_BOSS', acidSlimeWebp)
        this.load.image('enemy:SHELLED_PARASITE', fungiPng)
        this.load.image('enemy:SNECKO', cultistWebp)
        this.load.image('enemy:BOOK_OF_STABBING', slaverWebp)
        this.load.image('enemy:THE_CHAMP', slaverWebp)
    }

    create(): void {
        // Go to Main Menu first
        this.scene.start('MainMenu')
    }
}
