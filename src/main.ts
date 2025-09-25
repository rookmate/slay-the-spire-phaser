import Phaser from 'phaser'
import { BootScene } from './scenes/Boot'
import { CombatScene } from './scenes/Combat'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 450,
  parent: 'app',
  backgroundColor: '#1a1a1a',
  scene: [BootScene, CombatScene],
}

// eslint-disable-next-line no-new
new Phaser.Game(config)
