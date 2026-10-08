import type { RelicDef } from '../relics'
export const UTILITY_RELICS = {
    SACRED_BARK: { id: 'SACRED_BARK', name: 'Sacred Bark', rarity: 'boss', description: 'Double the effectiveness of potions.' },
    LIZARD_TAIL: { id: 'LIZARD_TAIL', name: 'Lizard Tail', rarity: 'rare', description: 'Once per run, revive with 50% of max HP.', onAcquire: run => { run.relicState ??= {}; run.relicState.LIZARD_TAIL = { charges: 1 } } },
    MAGIC_FLOWER: { id: 'MAGIC_FLOWER', character: 'ironclad', name: 'Magic Flower', rarity: 'rare', description: 'Healing is 50% stronger during combat.' },
    TOY_ORNITHOPTER: { id: 'TOY_ORNITHOPTER', name: 'Toy Ornithopter', rarity: 'common', description: 'Heal 5 HP whenever you use a potion.' },
} satisfies Record<string, RelicDef>
