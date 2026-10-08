import type { RelicDef } from '../relics'
import { getRelicState } from '../relics'
import { resolveCard } from '../cards'
import { generateCard, offerCards } from '../combat/choices'
import { createCombatCard } from '../combat/cardCreation'
import { selectCombatCardPool } from '../contentPools'
export const COMBAT_START_RELICS = {
    BLOOD_VIAL: { id: 'BLOOD_VIAL', name: 'Blood Vial', rarity: 'common', description: 'Heal 2 HP at combat start.', onCombatStart: ({ engine }) => engine.enqueue({ kind: 'Heal', target: engine.state.player.id, amount: 2 }) },
    ODDLY_SMOOTH_STONE: { id: 'ODDLY_SMOOTH_STONE', name: 'Oddly Smooth Stone', rarity: 'common', description: 'Start combat with 1 Dexterity.', onCombatStart: ({ engine }) => engine.applyPowerToPlayer('DEXTERITY', 1) },
    DATA_DISK: { id: 'DATA_DISK', name: 'Data Disk', rarity: 'common', character: 'defect', description: 'Start combat with 1 Focus.', onCombatStart: ({ engine }) => engine.applyPowerToPlayer('FOCUS', 1) },
    SYMBIOTIC_VIRUS: { id: 'SYMBIOTIC_VIRUS', name: 'Symbiotic Virus', rarity: 'uncommon', character: 'defect', description: 'Start combat with a Dark orb.', onCombatStart: ({ engine }) => engine.enqueue({ kind: 'ChannelOrb', orbType: 'dark' }) },
    NUCLEAR_BATTERY: { id: 'NUCLEAR_BATTERY', name: 'Nuclear Battery', rarity: 'boss', character: 'defect', description: 'Start combat with a Plasma orb.', onCombatStart: ({ engine }) => engine.enqueue({ kind: 'ChannelOrb', orbType: 'plasma' }) },
    RUNIC_CAPACITOR: { id: 'RUNIC_CAPACITOR', name: 'Runic Capacitor', rarity: 'shop', character: 'defect', description: 'Start combat with 3 extra orb slots.', onCombatStart: ({ engine }) => engine.enqueue({ kind: 'ChangeOrbSlots', amount: 3 }) },
    NINJA_SCROLL: { id: 'NINJA_SCROLL', name: 'Ninja Scroll', rarity: 'uncommon', character: 'silent', description: 'Start combat with 3 Shivs.', onOpeningHand: ({ engine }) => { engine.createCardsInDestination('SHIV', 'hand', 3) } },
    TEARDROP_LOCKET: { id: 'TEARDROP_LOCKET', name: 'Teardrop Locket', rarity: 'uncommon', character: 'watcher', description: 'Start combat in Calm.', onCombatStart: ({ engine }) => engine.enqueue({ kind: 'ChangeStance', stance: 'calm' }) },
    DU_VU_DOLL: { id: 'DU_VU_DOLL', name: 'Du-Vu Doll', rarity: 'rare', description: 'Start combat with 1 Strength for each Curse in your deck.', onCombatStart: ({ engine, run }) => engine.applyPowerToPlayer('STRENGTH', run.deck.filter(c => resolveCard(c).type === 'curse').length) },
    FOSSILIZED_HELIX: { id: 'FOSSILIZED_HELIX', name: 'Fossilized Helix', rarity: 'rare', description: 'Prevent the first HP loss each combat.', onCombatStart: ({ engine }) => engine.applyPowerToPlayer('BUFFER', 1) },
    CLOCKWORK_SOUVENIR: { id: 'CLOCKWORK_SOUVENIR', name: 'Clockwork Souvenir', rarity: 'shop', description: 'Start combat with 1 Artifact.', onCombatStart: ({ engine }) => engine.applyPowerToPlayer('ARTIFACT', 1) },
    TWISTED_FUNNEL: { id: 'TWISTED_FUNNEL', name: 'Twisted Funnel', rarity: 'shop', character: 'silent', description: 'Apply 4 Poison to all enemies at combat start.', onCombatStart: ({ engine }) => {
        for (const enemy of engine.state.enemies) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'POISON', stacks: 4 })
    } },
    MUTAGENIC_STRENGTH: { id: 'MUTAGENIC_STRENGTH', name: 'Mutagenic Strength', rarity: 'event', description: 'Start combat with 3 temporary Strength.', onCombatStart: ({ engine }) => { engine.applyPowerToPlayer('STRENGTH', 3); engine.applyPowerToPlayer('STRENGTH_DOWN_NEXT_TURN', 3) } },
    GREMLIN_VISAGE: { id: 'GREMLIN_VISAGE', name: 'Gremlin Visage', rarity: 'event', description: 'Start combat with 1 Weak.', onCombatStart: ({ engine }) => engine.applyPowerToPlayer('WEAK', 1) },
    PANTOGRAPH: { id: 'PANTOGRAPH', name: 'Pantograph', rarity: 'uncommon', description: 'Heal 25 HP at the start of boss combats.', onCombatStart: ({ engine }) => { if (engine.state.enemies.some(e => e.tags?.includes('boss'))) engine.enqueue({ kind: 'Heal', target: engine.state.player.id, amount: 25 }) } },
    SLING_OF_COURAGE: { id: 'SLING_OF_COURAGE', name: 'Sling of Courage', rarity: 'shop', description: 'Start elite combats with 2 Strength.', onCombatStart: ({ engine }) => { if (engine.state.enemies.some(e => e.tags?.includes('elite'))) engine.applyPowerToPlayer('STRENGTH', 2) } },
    GIRYA: { id: 'GIRYA', name: 'Girya', rarity: 'rare', description: 'Lift at rest sites up to 3 times, gaining 1 starting Strength each time.', onCombatStart: ({ engine, run }) => engine.applyPowerToPlayer('STRENGTH', getRelicState(run, 'GIRYA').counter ?? 0) },
    ANCIENT_TEA_SET: { id: 'ANCIENT_TEA_SET', name: 'Ancient Tea Set', rarity: 'common', description: 'After entering a rest site, start your next combat with 2 extra Energy.', onCombatStart: ({ engine, run }) => {
        const state = getRelicState(run, 'ANCIENT_TEA_SET'); if (state.charges) { engine.enqueue({ kind: 'GainEnergy', amount: 2 }); state.charges = 0 }
    } },
    ENCHIRIDION: { id: 'ENCHIRIDION', name: 'Enchiridion', rarity: 'event', description: 'Start combat with a random Power that costs 0 this turn.', onOpeningHand: ({ engine }) => { generateCard(engine, { type: 'power', zeroCost: 'turn' }) } },
    TOOLBOX: { id: 'TOOLBOX', name: 'Toolbox', rarity: 'shop', description: 'At combat start, choose one of 3 colorless cards to add to your hand.', onOpeningHand: ({ engine }) => {
        const pool = selectCombatCardPool(engine, { source: 'generated', colors: ['colorless'] }); engine.rng.shuffleInPlace(pool)
        offerCards(engine, pool.slice(0, 3).map(id => createCombatCard(engine, id)), 'toolbox', card => engine.insertCard(card, 'hand'))
    } },
    GAMBLING_CHIP: { id: 'GAMBLING_CHIP', name: 'Gambling Chip', rarity: 'rare', description: 'At combat start, discard any number of cards and draw that many.', onOpeningHand: ({ engine }) => {
        const hand = engine.state.player.hand; if (!hand.length) return
        engine.beginChoice({ zone: 'hand', sourceCardInstanceId: 'gambling-chip', prompt: 'Choose cards to replace', eligibleInstanceIds: hand.map(c => c.instanceId), minSelections: 0, maxSelections: hand.length, canSkip: true,
            onSubmit: ids => { engine.discardCards(ids); engine.enqueue({ kind: 'DrawCards', count: ids.length }) } })
    } },
} satisfies Record<string, RelicDef>
