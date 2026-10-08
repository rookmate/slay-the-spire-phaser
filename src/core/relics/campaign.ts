import { queueCardRewards } from './acquisitions'
import { changeMaxHp, gainGold } from '../health'
import type { RelicDef } from '../relics'

/** Campaign and merchant effects are handled at their owning transaction boundary. */
export const CAMPAIGN_RELICS = {
    MANGO: { id: 'MANGO', name: 'Mango', rarity: 'rare', description: 'Gain 14 max HP.', onAcquire: run => changeMaxHp(run, 14) },
    OLD_COIN: { id: 'OLD_COIN', name: 'Old Coin', rarity: 'rare', description: 'Gain 300 Gold.', onAcquire: run => gainGold(run, 300) },
    THREAD_AND_NEEDLE: { id: 'THREAD_AND_NEEDLE', name: 'Thread and Needle', rarity: 'rare', description: 'Start combat with 4 Plated Armor.', onCombatStart: ({ engine }) => engine.enqueue({ kind: 'ApplyPower', target: engine.state.player.id, powerId: 'PLATED_ARMOR', stacks: 4 }) },
    CIRCLET: { id: 'CIRCLET', name: 'Circlet', rarity: 'event', description: 'A keepsake awarded when a relic pool is empty.' },
    MEMBERSHIP_CARD: { id: 'MEMBERSHIP_CARD', name: 'Membership Card', rarity: 'shop', description: 'All merchant prices are halved.' },
    SMILING_MASK: { id: 'SMILING_MASK', name: 'Smiling Mask', rarity: 'common', description: 'Removing a card at a shop always costs 50 Gold.' },
    COURIER: { id: 'COURIER', name: 'The Courier', rarity: 'uncommon', description: 'Merchant stock replenishes after purchases. Prices are reduced by 20%.' },
    ORRERY: { id: 'ORRERY', name: 'Orrery', rarity: 'shop', onAcquire: run => queueCardRewards(run, 'ORRERY', 5), description: 'Choose cards from 5 card rewards when acquired.' },
    GOLDEN_IDOL: { id: 'GOLDEN_IDOL', name: 'Golden Idol', rarity: 'event', description: 'Enemies drop 25% more Gold.' },
    BLOODY_IDOL: { id: 'BLOODY_IDOL', name: 'Bloody Idol', rarity: 'event', description: 'Whenever you gain Gold, heal 5 HP.' },
    MARK_OF_THE_BLOOM: { id: 'MARK_OF_THE_BLOOM', name: 'Mark of the Bloom', rarity: 'event', description: 'You can no longer heal.' },
    RED_MASK: { id: 'RED_MASK', name: 'Red Mask', rarity: 'event', description: 'At combat start, apply 1 Weak to all enemies.', onCombatStart: ({ engine }) => {
        for (const enemy of engine.state.enemies) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'WEAK', stacks: 1 })
    } },
    NEOWS_LAMENT: { id: 'NEOWS_LAMENT', name: "Neow's Lament", rarity: 'event', description: 'Enemies in your first 3 combats have 1 HP.', onAcquire: run => { run.relicState ??= {}; run.relicState.NEOWS_LAMENT = { charges: 3 } } },
} satisfies Record<string, RelicDef>
