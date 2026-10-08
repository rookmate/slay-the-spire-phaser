import type { RelicDef } from '../relics'

export const STARTER_RELICS = {
    RING_OF_THE_SNAKE: { id: 'RING_OF_THE_SNAKE', character: 'silent', name: 'Ring of the Snake', rarity: 'starter', description: 'Draw 2 extra cards on your first turn.', onCombatStart: ({ engine }) => engine.enqueue({ kind: 'DrawCards', count: 2 }) },
    RING_OF_THE_SERPENT: { id: 'RING_OF_THE_SERPENT', replaces: 'RING_OF_THE_SNAKE', character: 'silent', name: 'Ring of the Serpent', rarity: 'boss', description: 'Replaces Ring of the Snake. Draw 1 extra card each turn.', onPlayerTurnStart: ({ engine }) => engine.enqueue({ kind: 'DrawCards', count: 1 }) },
    CRACKED_CORE: { id: 'CRACKED_CORE', character: 'defect', name: 'Cracked Core', rarity: 'starter', description: 'Start each combat with 1 Lightning.', onCombatStart: ({ engine }) => engine.enqueue({ kind: 'ChannelOrb', orbType: 'lightning' }) },
    FROZEN_CORE: { id: 'FROZEN_CORE', replaces: 'CRACKED_CORE', character: 'defect', name: 'Frozen Core', rarity: 'boss', description: 'Replaces Cracked Core. If you have an empty orb slot at turn end, channel 1 Frost.', onPlayerTurnEnd: ({ engine }) => {
        if (engine.state.player.orbs.length < engine.state.player.orbSlots) engine.enqueue({ kind: 'ChannelOrb', orbType: 'frost' })
    } },
    PURE_WATER: { id: 'PURE_WATER', character: 'watcher', name: 'Pure Water', rarity: 'starter', description: 'Start each combat with a Miracle in hand.', onOpeningHand: ({ engine }) => { engine.createCardsInDestination('MIRACLE', 'hand') } },
    HOLY_WATER: { id: 'HOLY_WATER', replaces: 'PURE_WATER', character: 'watcher', name: 'Holy Water', rarity: 'boss', description: 'Replaces Pure Water. Start each combat with 3 Miracles.', onOpeningHand: ({ engine }) => { engine.createCardsInDestination('MIRACLE', 'hand', 3) } },
} satisfies Record<string, RelicDef>
