import { loadCharacterPortraits } from '../ui/portraits'
import Phaser from 'phaser'
import { ENEMIES } from '../core/enemies'
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
        loadCharacterPortraits(this)
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
        this.load.image('enemy:CHOSEN', cultistWebp)
        this.load.image('enemy:BYRD', louseWebp)
        this.load.image('enemy:SPHERIC_GUARDIAN', jawwarmWebp)
        this.load.image('enemy:GREMLIN_LEADER', gremlinWebp)
        this.load.image('enemy:GREMLIN_MINION', gremlinWebp)
        this.load.image('enemy:RED_SLAVER', slaverWebp)
        this.load.image('enemy:BLUE_SLAVER', slaverWebp)
        this.load.image('enemy:TASKMASTER', slaverWebp)
        this.load.image('enemy:THE_COLLECTOR', cultistWebp)
        this.load.image('enemy:TORCH_HEAD', cultistWebp)
    }

    create(): void {
        // Every encounter needs a targetable portrait, including newly added foes.
        // Fallback portraits remain placeholders until original enemy art is available.
        for (const enemy of Object.values(ENEMIES)) {
            const key = `enemy:${enemy.id}`
            if (this.textures.exists(key)) continue
            const art = this.make.graphics({ x: 0, y: 0 })
            const color = enemy.tags?.includes('boss') ? 0x993b50 : enemy.tags?.includes('elite') ? 0x8b7446 : 0x547b82
            art.fillStyle(color, 1).fillCircle(48, 45, 32)
            art.lineStyle(3, 0xd0b98e).strokeCircle(48, 45, 32)
            art.fillStyle(0xeee0ba).fillTriangle(29, 35, 40, 39, 31, 43).fillTriangle(67, 35, 56, 39, 65, 43)
            art.lineStyle(3, 0x17131a).lineBetween(36, 57, 60, 57)
            art.generateTexture(key, 96, 90); art.destroy()
        }
        // Go to Main Menu first
        this.scene.start('MainMenu')
    }
}
