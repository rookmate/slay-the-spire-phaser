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

// eslint-disable-next-line no-new
new Phaser.Game(config)
