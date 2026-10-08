import type { PowerId } from './state'
import type { CharacterId } from './characters'
import type { RunState } from './run'
import { healRun } from './health'
import type { PotionDef, PotionId } from './potions/model'
import { UTILITY_POTIONS } from './potions/utility'
export type { PotionDef, PotionId } from './potions/model'
function power(id: PotionId, name: string, rarity: PotionDef['rarity'], powerId: PowerId, amount: number, description: string, character?: CharacterId, target: PotionDef['target'] = 'player'): PotionDef {
    return { id, name, rarity, target, description, character, use: (engine, targets, multiplier) => engine.enqueue({ kind: 'ApplyPower', target: target === 'single_enemy' ? targets[0] : engine.state.player.id, powerId, stacks: amount * multiplier }) }
}
export const POTION_DEFS: Record<PotionId, PotionDef> = {
    ...UTILITY_POTIONS,
    ANCIENT_POTION: power('ANCIENT_POTION', 'Ancient Potion', 'uncommon', 'ARTIFACT', 1, 'Gain 1 Artifact.'),
    CULTIST_POTION: power('CULTIST_POTION', 'Cultist Potion', 'rare', 'RITUAL', 1, 'Gain 1 Ritual.'),
    DEXTERITY_POTION: power('DEXTERITY_POTION', 'Dexterity Potion', 'common', 'DEXTERITY', 2, 'Gain 2 Dexterity.'),
    DUPLICATION_POTION: power('DUPLICATION_POTION', 'Duplication Potion', 'uncommon', 'DUPLICATION', 1, 'Your next card this turn plays twice.'),
    ESSENCE_OF_STEEL: power('ESSENCE_OF_STEEL', 'Essence of Steel', 'uncommon', 'PLATED_ARMOR', 4, 'Gain 4 Plated Armor.'),
    FEAR_POTION: power('FEAR_POTION', 'Fear Potion', 'common', 'VULNERABLE', 3, 'Apply 3 Vulnerable.', undefined, 'single_enemy'),
    FOCUS_POTION: power('FOCUS_POTION', 'Focus Potion', 'common', 'FOCUS', 2, 'Gain 2 Focus.', 'defect'),
    GHOST_IN_A_JAR: power('GHOST_IN_A_JAR', 'Ghost in a Jar', 'rare', 'INTANGIBLE', 1, 'Gain 1 Intangible.', 'silent'),
    HEART_OF_IRON: power('HEART_OF_IRON', 'Heart of Iron', 'rare', 'METALLICIZE', 6, 'Gain 6 Metallicize.', 'ironclad'),
    POISON_POTION: power('POISON_POTION', 'Poison Potion', 'common', 'POISON', 6, 'Apply 6 Poison.', 'silent', 'single_enemy'),
    REGEN_POTION: power('REGEN_POTION', 'Regen Potion', 'uncommon', 'REGENERATION', 5, 'Gain 5 Regeneration.'),
    STRENGTH_POTION: power('STRENGTH_POTION', 'Strength Potion', 'common', 'STRENGTH', 2, 'Gain 2 Strength.'),
    WEAK_POTION: power('WEAK_POTION', 'Weak Potion', 'common', 'WEAK', 3, 'Apply 3 Weak.', undefined, 'single_enemy'),
    AMBROSIA: { id: 'AMBROSIA', name: 'Ambrosia', rarity: 'rare', character: 'watcher', target: 'player', scalable: false, description: 'Enter Divinity.', use: engine => engine.enqueue({ kind: 'ChangeStance', stance: 'divinity' }) },
    BLOCK_POTION: { id: 'BLOCK_POTION', name: 'Block Potion', rarity: 'common', target: 'player', description: 'Gain 12 Block.', use: (engine, _targets, m) => engine.enqueue({ kind: 'GainBlock', target: engine.state.player.id, amount: 12 * m }) },
    BLOOD_POTION: { id: 'BLOOD_POTION', name: 'Blood Potion', rarity: 'common', character: 'ironclad', target: 'player', description: 'Heal 20% of max HP.', use: (engine, _targets, m) => engine.enqueue({ kind: 'Heal', target: engine.state.player.id, amount: Math.floor(engine.state.player.maxHp * 0.2 * m) }), useOutsideCombat: (run, m) => { healRun(run, Math.floor(run.player.maxHp * 0.2 * m)) } },
    BOTTLED_MIRACLE: { id: 'BOTTLED_MIRACLE', name: 'Bottled Miracle', rarity: 'common', character: 'watcher', target: 'none', description: 'Add 2 Miracles to hand.', use: (engine, _targets, m) => { engine.createCardsInDestination('MIRACLE', 'hand', 2 * m) } },
    CUNNING_POTION: { id: 'CUNNING_POTION', name: 'Cunning Potion', rarity: 'uncommon', character: 'silent', target: 'none', description: 'Add 3 upgraded Shivs to hand.', use: (engine, _targets, m) => { engine.createCardsInDestination('SHIV', 'hand', 3 * m, 1) } },
    ENERGY_POTION: { id: 'ENERGY_POTION', name: 'Energy Potion', rarity: 'common', target: 'player', description: 'Gain 2 Energy.', use: (engine, _targets, m) => engine.enqueue({ kind: 'GainEnergy', amount: 2 * m }) },
    ESSENCE_OF_DARKNESS: { id: 'ESSENCE_OF_DARKNESS', name: 'Essence of Darkness', rarity: 'rare', character: 'defect', target: 'none', description: 'Channel a Dark orb per orb slot.', use: (engine, _targets, m) => { for (let i = 0; i < engine.state.player.orbSlots * m; i++) engine.enqueue({ kind: 'ChannelOrb', orbType: 'dark' }) } },
    EXPLOSIVE_POTION: { id: 'EXPLOSIVE_POTION', name: 'Explosive Potion', rarity: 'common', target: 'none', description: 'Deal 10 damage to all enemies.', use: (engine, _targets, m) => { for (const enemy of engine.state.enemies.filter(e => e.hp > 0)) engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: enemy.id, amount: 10 * m, damageType: 'effect' }) } },
    FAIRY_IN_A_BOTTLE: { id: 'FAIRY_IN_A_BOTTLE', name: 'Fairy in a Bottle', rarity: 'rare', target: 'none', description: 'Automatically revive with 30% max HP when you would die.', autoRevivePercent: 0.3, canUse: () => false, use: () => { /* Consumed by the lethal-damage handler. */ } },
    FIRE_POTION: { id: 'FIRE_POTION', name: 'Fire Potion', rarity: 'common', target: 'single_enemy', description: 'Deal 20 damage.', use: (engine, targets, m) => engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: targets[0], amount: 20 * m, damageType: 'effect' }) },
    FLEX_POTION: { id: 'FLEX_POTION', name: 'Flex Potion', rarity: 'common', target: 'player', description: 'Gain 5 Strength, then lose 5 at turn end.', use: (engine, _targets, m) => { engine.applyPowerToPlayer('STRENGTH', 5 * m); engine.applyPowerToPlayer('STRENGTH_DOWN_NEXT_TURN', 5 * m) } },
    LIQUID_BRONZE: { id: 'LIQUID_BRONZE', name: 'Liquid Bronze', rarity: 'uncommon', target: 'player', description: 'Gain 3 Thorns this combat.', use: (engine, _targets, m) => engine.configurePlayerCombatBonuses({ baseThorns: engine.getBaseThorns() + 3 * m }) },
    POTION_OF_CAPACITY: { id: 'POTION_OF_CAPACITY', name: 'Potion of Capacity', rarity: 'uncommon', character: 'defect', target: 'player', description: 'Gain 2 orb slots.', use: (engine, _targets, m) => engine.enqueue({ kind: 'ChangeOrbSlots', amount: 2 * m }) },
    SPEED_POTION: { id: 'SPEED_POTION', name: 'Speed Potion', rarity: 'common', target: 'player', description: 'Gain 5 Dexterity, then lose 5 at turn end.', use: (engine, _targets, m) => { engine.applyPowerToPlayer('DEXTERITY', 5 * m); engine.applyPowerToPlayer('DEXTERITY_DOWN', 5 * m) } },
    SWIFT_POTION: { id: 'SWIFT_POTION', name: 'Swift Potion', rarity: 'common', target: 'player', description: 'Draw 3.', use: (engine, _targets, m) => engine.enqueue({ kind: 'DrawCards', count: 3 * m }) },
}
export function potionMultiplier(run: Pick<RunState, 'relics'> | undefined, id: PotionId): number {
    return POTION_DEFS[id].scalable !== false && run?.relics.includes('SACRED_BARK') ? 2 : 1
}
export function usePotionOutsideCombat(run: RunState, index: number): boolean {
    const id = run.potions[index], def = POTION_DEFS[id]
    if (!def?.useOutsideCombat || run.player.hp <= 0) return false
    run.potions.splice(index, 1); def.useOutsideCombat(run, potionMultiplier(run, id))
    if (run.relics.includes('TOY_ORNITHOPTER')) healRun(run, 5)
    return true
}
