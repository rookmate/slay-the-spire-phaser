import type Phaser from 'phaser'
import type { EnemyKey } from '../../core/encounters'
import { ACT_ONE_ART } from './actOne'
import { ACT_TWO_ART } from './actTwo'
import { ACT_THREE_ART } from './actThree'
import { svg } from './shapes'

/** Exhaustive registry: adding an encounter requires choosing its illustration. */
export const ENEMY_ART = { ...ACT_ONE_ART, ...ACT_TWO_ART, ...ACT_THREE_ART } satisfies Record<EnemyKey, string>
export function loadEnemyPortraits(scene: Phaser.Scene): void {
    for (const [id, body] of Object.entries(ENEMY_ART)) scene.load.svg(`enemy:${id}`, `data:image/svg+xml;base64,${btoa(svg(body))}`)
}
