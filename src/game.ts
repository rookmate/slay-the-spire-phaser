import { ProfileRecoveryScene } from './scenes/ProfileRecovery'
import './style.css'
import { AchievementsScene } from './scenes/Achievements'
import { ProfileScene } from './scenes/Profile'
import { recoverProfileImport } from './core/profile/storage'
import { attachNotifications } from './ui/notifications'
import { attachSound } from './ui/sound'
import { attachPhoneLayout } from './ui/phoneLayout'
import { ChestScene } from './scenes/Chest'
import { InventoryScene } from './scenes/Inventory'
import { SettingsScene } from './scenes/Settings'
import { RunHistoryScene } from './scenes/RunHistory'
import { StartingDeckScene } from './scenes/StartingDeck'
import { BlightChestScene } from './scenes/BlightChest'
import { CustomModifiersScene } from './scenes/CustomModifiers'
import { RelicAcquisitionScene } from './scenes/RelicAcquisition'
import Phaser from 'phaser'
import { BootScene } from './scenes/Boot'
import { CombatScene } from './scenes/Combat'
import { CombatMenuScene } from './scenes/CombatMenu'
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
import { attachRunClock } from './core/runClock'
import { attachStorageSync } from './ui/storageSync'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 450,
  dom: { createContainer: true },
  audio: { noAudio: true },
  parent: 'app',
  backgroundColor: '#151512',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    max: {
      width: 1920,
      height: 1080
    }
  },
  scene: [BootScene, ProfileRecoveryScene, AchievementsScene, ProfileScene, ChestScene, InventoryScene, SettingsScene, RunHistoryScene, StartingDeckScene, BlightChestScene, CustomModifiersScene, RelicAcquisitionScene, MainMenuScene, NeowScene, MapScene, CombatScene, CombatMenuScene, EventScene, CampfireScene, ShopScene, RewardsScene, BossRelicScene, RunSummaryScene, DeckBuilderScene],
}

export function createGame(): Phaser.Game {
  try { recoverProfileImport() }
  catch {
    const game = new Phaser.Game({ ...config, scene: [ProfileRecoveryScene] })
    attachPhoneLayout(game)
    return game
  }
  const game = new Phaser.Game(config)
  attachPhoneLayout(game)
  attachStorageSync(game)
  attachSound(game)
  attachNotifications(game)
  attachRunClock(game)
  return game
}
