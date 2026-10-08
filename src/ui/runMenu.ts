import type Phaser from 'phaser'
import { saveRun, type RunState } from '../core/run'
import { menuButton } from './menu'
/** Noncombat rooms share an inventory and a way to leave a saved run. */
export function addRunMenu(scene: Phaser.Scene, run: RunState): void {
    menuButton(scene, 618, 8, 'Bag', () => { saveRun(run); scene.scene.start('Inventory', { run }) }).setDepth(6000)
    menuButton(scene, 690, 8, 'Menu', () => { saveRun(run); scene.scene.start('MainMenu') }).setDepth(6000)
}
