import type Phaser from 'phaser'
import type { resolveCard } from '../../core/cards'
import type { CardInstance } from '../../core/state'

/** Frame order matches the original painted sheet; upgrades retain the base illustration. */
export const ILLUSTRATED_CARDS = [
    'STRIKE', 'DEFEND', 'BASH', 'WHIRLWIND', 'DEMON_FORM', 'FIEND_FIRE', 'SHRUG_IT_OFF', 'BLUDGEON',
    'STRIKE_SILENT', 'DEFEND_SILENT', 'NEUTRALIZE', 'SURVIVOR', 'DEADLY_POISON', 'SHIV', 'WRAITH_FORM', 'CORPSE_EXPLOSION',
    'STRIKE_DEFECT', 'DEFEND_DEFECT', 'ZAP', 'DUALCAST', 'GLACIER', 'ELECTRODYNAMICS', 'ECHO_FORM', 'DARKNESS',
    'STRIKE_WATCHER', 'DEFEND_WATCHER', 'ERUPTION', 'VIGILANCE', 'MIRACLE', 'TALK_TO_THE_HAND', 'BLASPHEMY', 'FORESIGHT',
] as const
const frames = Object.fromEntries(ILLUSTRATED_CARDS.map((id, frame) => [id, frame]))
const fallback = {
    ironclad: { attack: 0, skill: 1, power: 4 }, silent: { attack: 8, skill: 11, power: 14 },
    defect: { attack: 16, skill: 17, power: 22 }, watcher: { attack: 24, skill: 27, power: 31 },
    colorless: { attack: 0, skill: 28, power: 31 },
}
export function cardArtFrame(card: Pick<CardInstance, 'defId'>, def: ReturnType<typeof resolveCard>): number {
    const dedicated = frames[card.defId]
    if (dedicated !== undefined) return dedicated
    if (def.type === 'curse') return 23
    if (def.type === 'status') return 5
    return fallback[def.color ?? 'colorless'][def.type]
}
export function loadCardArt(scene: Phaser.Scene): void {
    scene.load.image('art:cards', '/art/cards-detailed.webp')
}
export function installCardArt(scene: Phaser.Scene): void {
    if (!scene.textures.exists('art:cards')) return
    const texture = scene.textures.get('art:cards')
    // The generated sheet has a shorter third row. Crop the measured boundaries,
    // with four pixels inset so painted grid lines never bleed into a card.
    const edges = [0, 192, 384, 560, 768], width = 192
    ILLUSTRATED_CARDS.forEach((_, i) => {
        const row = Math.floor(i / 8)
        texture.add(i, 0, i % 8 * width + 4, edges[row] + 4, width - 8, edges[row + 1] - edges[row] - 8)
    })
}
