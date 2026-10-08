import Phaser from 'phaser'
import { BootScene } from './scenes/Boot'
import { CombatScene } from './scenes/Combat'
import { MapScene } from './scenes/Map'
import { EventScene } from './scenes/Event'
import { CampfireScene } from './scenes/Campfire'
import { ShopScene } from './scenes/Shop'
import { RewardsScene } from './scenes/Rewards'
import { MainMenuScene } from './scenes/MainMenu'
import { RunSummaryScene } from './scenes/RunSummary'
import { DeckBuilderScene } from './scenes/DeckBuilder'
import { NeowScene } from './scenes/Neow'
import { BossRelicScene } from './scenes/BossRelic'
import type { RunState } from './core/run'
import { advanceRunClock, checkpointRunClock } from './core/runClock'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 450,
  parent: 'app',
  backgroundColor: '#1a1a1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: 800,
      height: 450
    },
    max: {
      width: 1920,
      height: 1080
    }
  },
  scene: [BootScene, MainMenuScene, NeowScene, MapScene, CombatScene, EventScene, CampfireScene, ShopScene, RewardsScene, BossRelicScene, RunSummaryScene, DeckBuilderScene],
}

export function createGame(): Phaser.Game {
  const game = new Phaser.Game(config)
  let sinceSave = 0
  game.events.on(Phaser.Core.Events.POST_STEP, (_time: number, delta: number) => {
    const scene = game.scene.getScenes(true)[0] as Phaser.Scene & { run?: RunState }
    if (!scene?.run || ['MainMenu', 'RunSummary', 'DeckBuilder'].includes(scene.scene.key) || document.hidden) return
    advanceRunClock(scene.run, delta)
    sinceSave += delta
    if (sinceSave >= 1000) { checkpointRunClock(scene.run); sinceSave = 0 }
  })
  return game
}
