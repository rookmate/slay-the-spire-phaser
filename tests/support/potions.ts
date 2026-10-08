import type { Engine } from '../../src/core/engine'
import { POTION_DEFS, type PotionId } from '../../src/core/potions'
import { incomingDamage } from './policy'

/** Spend consumables against dangerous fights using only the visible board. */
export function choosePotion(engine: Engine): { index: number; targets: string[] } | undefined {
    const { player, enemies, turnNumber } = engine.state
    const living = enemies.filter(enemy => enemy.hp > 0)
    const danger = living.reduce((n, enemy) => n + incomingDamage(enemy), 0) * (player.stance === 'wrath' ? 2 : 1) - player.block
    const sustain: PotionId[] = ['STRENGTH_POTION', 'DEXTERITY_POTION', 'ESSENCE_OF_STEEL', 'CULTIST_POTION', 'LIQUID_BRONZE', 'ANCIENT_POTION']
    for (const [index, id] of (engine.run?.potions ?? []).entries()) {
        const def = POTION_DEFS[id]
        const enemy = [...living].sort((a, b) => (id === 'FIRE_POTION' ? a.hp - b.hp : b.hp - a.hp))[0]
        if (!enemy) return
        const targets = def.target === 'single_enemy' ? [enemy.id] : def.target === 'player' ? [player.id] : []
        if (!engine.canUsePotion(id, targets)) continue
        if (sustain.includes(id) && turnNumber === 1 && (enemy.maxHp >= 100 || living.length >= 3)
            || id === 'REGEN_POTION' && player.hp <= player.maxHp - 15
            || id === 'FIRE_POTION' && enemy.hp <= 20 && danger > 0
            || id === 'EXPLOSIVE_POTION' && living.length >= 2
            || id === 'WEAK_POTION' && danger >= 15
            || id === 'BLOCK_POTION' && danger >= 12 && player.energy === 0
            || id === 'AMBROSIA' && player.energy >= 2 && living.some(enemy => enemy.hp >= 30)
            || id === 'ENERGY_POTION' && player.energy === 0 && player.hand.length >= 3 && danger > 5
            || id === 'SWIFT_POTION' && player.energy > 0 && player.hand.length <= 2) return { index, targets }
    }
}
