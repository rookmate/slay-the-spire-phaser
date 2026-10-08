import type { RelicDef } from '../relics'
import { canUpgradeCard, resolveCard } from '../cards'
import { changeMaxHp, gainGold, healRun } from '../health'
import { RNG } from '../rng'
import { obtainCurse, type RunState } from '../run'
import { queueAcquisition, queueCardRewards } from './acquisitions'
function upgradeRandom(run: RunState, seed: string, count: number, type?: 'attack' | 'skill'): void {
    const cards = run.deck.filter(c => canUpgradeCard(c) && (!type || resolveCard(c).type === type)); new RNG(`${run.seed}-${seed}`).shuffleInPlace(cards)
    for (const card of cards.slice(0, count)) card.upgradeLevel++
}
export const RUN_EFFECT_RELICS = {
    ASTROLABE: { id: 'ASTROLABE', name: 'Astrolabe', rarity: 'boss', description: 'Transform 3 cards and upgrade them.', onAcquire: run => queueAcquisition(run, { source: 'ASTROLABE', kind: 'select', operation: 'transform', count: 3, upgrade: true }) },
    EMPTY_CAGE: { id: 'EMPTY_CAGE', name: 'Empty Cage', rarity: 'boss', description: 'Remove 2 cards.', onAcquire: run => queueAcquisition(run, { source: 'EMPTY_CAGE', kind: 'select', operation: 'remove', count: 2 }) },
    DOLLYS_MIRROR: { id: 'DOLLYS_MIRROR', name: "Dolly's Mirror", rarity: 'shop', description: 'Copy a card in your deck.', onAcquire: run => queueAcquisition(run, { source: 'DOLLYS_MIRROR', kind: 'select', operation: 'copy', count: 1 }) },
    PANDORAS_BOX: { id: 'PANDORAS_BOX', name: "Pandora's Box", rarity: 'boss', description: 'Transform all Strikes and Defends.', onAcquire: run => queueAcquisition(run, { source: 'PANDORAS_BOX', kind: 'transform_starters' }) },
    BOTTLED_FLAME: { id: 'BOTTLED_FLAME', name: 'Bottled Flame', rarity: 'uncommon', description: 'Choose an Attack to start each combat in hand.', onAcquire: run => queueAcquisition(run, { source: 'BOTTLED_FLAME', kind: 'select', operation: 'bottle', cardType: 'attack', count: 1 }) },
    BOTTLED_LIGHTNING: { id: 'BOTTLED_LIGHTNING', name: 'Bottled Lightning', rarity: 'uncommon', description: 'Choose a Skill to start each combat in hand.', onAcquire: run => queueAcquisition(run, { source: 'BOTTLED_LIGHTNING', kind: 'select', operation: 'bottle', cardType: 'skill', count: 1 }) },
    BOTTLED_TORNADO: { id: 'BOTTLED_TORNADO', name: 'Bottled Tornado', rarity: 'uncommon', description: 'Choose a Power to start each combat in hand.', onAcquire: run => queueAcquisition(run, { source: 'BOTTLED_TORNADO', kind: 'select', operation: 'bottle', cardType: 'power', count: 1 }) },
    CALLING_BELL: { id: 'CALLING_BELL', name: 'Calling Bell', rarity: 'boss', description: 'Obtain Curse of the Bell and a common, uncommon, and rare relic.', onAcquire: run => {
        obtainCurse(run, 'CURSE_OF_THE_BELL'); for (const rarity of ['common', 'uncommon', 'rare'] as const) queueAcquisition(run, { source: 'CALLING_BELL', kind: 'relic', rarity })
    } },
    CAULDRON: { id: 'CAULDRON', name: 'Cauldron', rarity: 'shop', description: 'Obtain 5 random potions.', onAcquire: run => { for (let i = 0; i < 5; i++) queueAcquisition(run, { source: 'CAULDRON', kind: 'potion' }) } },
    TINY_HOUSE: { id: 'TINY_HOUSE', name: 'Tiny House', rarity: 'boss', description: 'Gain 50 Gold and 5 max HP. Upgrade a random card. Obtain a potion and a card reward.', onAcquire: run => {
        gainGold(run, 50); changeMaxHp(run, 5); upgradeRandom(run, 'tiny-house', 1); queueAcquisition(run, { source: 'TINY_HOUSE', kind: 'potion' }); queueCardRewards(run, 'TINY_HOUSE', 1)
    } },
    WAR_PAINT: { id: 'WAR_PAINT', name: 'War Paint', rarity: 'common', description: 'Upgrade 2 random Skills.', onAcquire: run => upgradeRandom(run, 'war-paint', 2, 'skill') },
    WHETSTONE: { id: 'WHETSTONE', name: 'Whetstone', rarity: 'common', description: 'Upgrade 2 random Attacks.', onAcquire: run => upgradeRandom(run, 'whetstone', 2, 'attack') },
    PEAR: { id: 'PEAR', name: 'Pear', rarity: 'uncommon', description: 'Gain 10 max HP.', onAcquire: run => changeMaxHp(run, 10) },
    LEES_WAFFLE: { id: 'LEES_WAFFLE', name: "Lee's Waffle", rarity: 'shop', description: 'Gain 7 max HP and heal to full.', onAcquire: run => { changeMaxHp(run, 7); healRun(run, run.player.maxHp) } },
    POTION_BELT: { id: 'POTION_BELT', name: 'Potion Belt', rarity: 'common', description: 'Gain 2 potion slots.', onAcquire: run => { run.maxPotionSlots += 2 } },
    QUESTION_CARD: { id: 'QUESTION_CARD', name: 'Question Card', rarity: 'uncommon', description: 'Card rewards offer one additional card.', cardRewardChoiceDelta: 1 },
    FROZEN_EGG: { id: 'FROZEN_EGG', name: 'Frozen Egg', rarity: 'uncommon', description: 'Upgrade Powers added to your deck.' },
    MOLTEN_EGG: { id: 'MOLTEN_EGG', name: 'Molten Egg', rarity: 'uncommon', description: 'Upgrade Attacks added to your deck.' },
    TOXIC_EGG: { id: 'TOXIC_EGG', name: 'Toxic Egg', rarity: 'uncommon', description: 'Upgrade Skills added to your deck.' },
    CERAMIC_FISH: { id: 'CERAMIC_FISH', name: 'Ceramic Fish', rarity: 'common', description: 'Gain 9 Gold for each card added to your deck.' },
    DARKSTONE_PERIAPT: { id: 'DARKSTONE_PERIAPT', name: 'Darkstone Periapt', rarity: 'uncommon', description: 'Gain 6 max HP whenever you obtain a Curse.' },
    ECTOPLASM: { id: 'ECTOPLASM', name: 'Ectoplasm', rarity: 'boss', energyPerTurn: 1, description: 'Gain 1 Energy each turn. You cannot gain Gold.' },
    FUSION_HAMMER: { id: 'FUSION_HAMMER', name: 'Fusion Hammer', rarity: 'boss', energyPerTurn: 1, description: 'Gain 1 Energy each turn. You cannot Smith at rest sites.' },
    CURSED_KEY: { id: 'CURSED_KEY', name: 'Cursed Key', rarity: 'boss', energyPerTurn: 1, description: 'Gain 1 Energy each turn. Opening a non-boss chest gives a Curse.' },
    BLACK_STAR: { id: 'BLACK_STAR', name: 'Black Star', rarity: 'boss', description: 'Elites drop an extra relic.' },
    PRAYER_WHEEL: { id: 'PRAYER_WHEEL', name: 'Prayer Wheel', rarity: 'rare', description: 'Normal enemy rewards include an extra card reward.' },
    WHITE_BEAST_STATUE: { id: 'WHITE_BEAST_STATUE', name: 'White Beast Statue', rarity: 'uncommon', description: 'Every combat reward includes a potion.' },
    PRISMATIC_SHARD: { id: 'PRISMATIC_SHARD', name: 'Prismatic Shard', rarity: 'shop', description: 'Combat card rewards include every color. Gain an orb slot if you have none.', onCombatStart: ({ engine }) => { if (engine.state.player.orbSlots === 0) engine.enqueue({ kind: 'ChangeOrbSlots', amount: 1 }) } },
    NLOTHS_GIFT: { id: 'NLOTHS_GIFT', name: "N'loth's Gift", rarity: 'event', description: 'Triple the base chance of rare cards in combat rewards.' },
    MATRYOSHKA: { id: 'MATRYOSHKA', name: 'Matryoshka', rarity: 'uncommon', description: 'The next 2 non-boss chests contain an extra relic.', onAcquire: run => { run.relicState ??= {}; run.relicState.MATRYOSHKA = { charges: 2 } } },
    NLOTHS_HUNGRY_FACE: { id: 'NLOTHS_HUNGRY_FACE', name: "N'loth's Hungry Face", rarity: 'event', description: 'Your next non-boss chest is empty.', onAcquire: run => { run.relicState ??= {}; run.relicState.NLOTHS_HUNGRY_FACE = { charges: 1 } } },
    MEAT_ON_THE_BONE: { id: 'MEAT_ON_THE_BONE', name: 'Meat on the Bone', rarity: 'uncommon', description: 'Heal 12 HP after combat if you have half HP or less.' },
    FACE_OF_CLERIC: { id: 'FACE_OF_CLERIC', name: 'Face of Cleric', rarity: 'event', description: 'Gain 1 max HP after combat.' },
    MAW_BANK: { id: 'MAW_BANK', name: 'Maw Bank', rarity: 'common', description: 'Gain 12 Gold when climbing a floor, until you spend Gold at a shop.', onAcquire: run => { run.relicState ??= {}; run.relicState.MAW_BANK = { charges: 1 } } },
    MEAL_TICKET: { id: 'MEAL_TICKET', name: 'Meal Ticket', rarity: 'common', description: 'Heal 15 HP when entering a shop.' },
    ETERNAL_FEATHER: { id: 'ETERNAL_FEATHER', name: 'Eternal Feather', rarity: 'uncommon', description: 'At rest sites, heal 3 HP per 5 cards in your deck.' },
    REGAL_PILLOW: { id: 'REGAL_PILLOW', name: 'Regal Pillow', rarity: 'common', description: 'Heal 15 extra HP when resting.' },
    DREAM_CATCHER: { id: 'DREAM_CATCHER', name: 'Dream Catcher', rarity: 'common', description: 'Receive a card reward after resting.' },
    PEACE_PIPE: { id: 'PEACE_PIPE', name: 'Peace Pipe', rarity: 'rare', description: 'You may remove a card at rest sites.' },
    SHOVEL: { id: 'SHOVEL', name: 'Shovel', rarity: 'rare', description: 'You may dig for a relic at rest sites.' },
    SINGING_BOWL: { id: 'SINGING_BOWL', name: 'Singing Bowl', rarity: 'uncommon', description: 'Take 2 max HP instead of a card reward.' },
    JUZU_BRACELET: { id: 'JUZU_BRACELET', name: 'Juzu Bracelet', rarity: 'common', description: 'Unknown rooms never become normal combats.' },
    TINY_CHEST: { id: 'TINY_CHEST', name: 'Tiny Chest', rarity: 'common', description: 'Every fourth unknown room becomes a chest.' },
    SSSERPENT_HEAD: { id: 'SSSERPENT_HEAD', name: 'Ssserpent Head', rarity: 'event', description: 'Gain 50 Gold when entering an unknown room.' },
    WING_BOOTS: { id: 'WING_BOOTS', name: 'Wing Boots', rarity: 'rare', description: 'Choose an unconnected room on the next row up to 3 times.', onAcquire: run => { run.relicState ??= {}; run.relicState.WING_BOOTS = { charges: 3 } } },
    FROZEN_EYE: { id: 'FROZEN_EYE', name: 'Frozen Eye', rarity: 'shop', description: 'View the draw pile in its actual order.' },
    CULTIST_HEADPIECE: { id: 'CULTIST_HEADPIECE', name: 'Cultist Headpiece', rarity: 'event', description: 'CAW! CAAAW!' },
    SPIRIT_POOP: { id: 'SPIRIT_POOP', name: 'Spirit Poop', rarity: 'event', description: 'An unpleasant keepsake. Lose 1 final score.' },
} satisfies Record<string, RelicDef>
