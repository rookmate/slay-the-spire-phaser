import type { CardDef } from '../state'
import { attackAmount, chooseOneCard } from './helpers'

export const STARTER_CARDS: Record<string, CardDef> = {
    NEUTRALIZE: { id: 'NEUTRALIZE', name: 'Neutralize', color: 'silent', type: 'attack', rarity: 'basic', poolEnabled: false, cost: 0,
        baseDamage: 3, upgrade: { baseDamage: 4 }, targeting: { type: 'single_enemy', required: true }, description: card => `Apply ${card.upgradeLevel ? 2 : 1} Weak.`,
        onPlay: ({ engine, source, targets, card }) => {
            engine.enqueue({ kind: 'DealDamage', source, target: targets[0], amount: attackAmount(engine, card, card.upgradeLevel ? 4 : 3) })
            engine.enqueue({ kind: 'ApplyPower', target: targets[0], powerId: 'WEAK', stacks: card.upgradeLevel ? 2 : 1 })
        } },
    SURVIVOR: { id: 'SURVIVOR', name: 'Survivor', color: 'silent', type: 'skill', rarity: 'basic', poolEnabled: false, cost: 1,
        baseBlock: 8, upgrade: { baseBlock: 11 }, description: () => 'Discard 1.',
        onPlay: ({ engine, source, card }) => {
            engine.enqueue({ kind: 'GainBlock', target: source, amount: card.upgradeLevel ? 11 : 8, blockSource: 'card' })
            engine.deferChoice(() => chooseOneCard(engine, { card, prompt: 'Choose a card to discard', zone: 'hand', eligibleInstanceIds: engine.state.player.hand.map(c => c.instanceId), onSubmit: id => engine.discardCards([id]) }))
        } },
    ZAP: { id: 'ZAP', name: 'Zap', color: 'defect', type: 'skill', rarity: 'basic', poolEnabled: false, cost: 1, upgrade: { cost: 0 },
        description: () => 'Channel 1 Lightning.', onPlay: ({ engine }) => engine.enqueue({ kind: 'ChannelOrb', orbType: 'lightning' }) },
    DUALCAST: { id: 'DUALCAST', name: 'Dualcast', color: 'defect', type: 'skill', rarity: 'basic', poolEnabled: false, cost: 1, upgrade: { cost: 0 },
        description: () => 'Evoke your first orb twice.', onPlay: ({ engine }) => engine.enqueue({ kind: 'EvokeOrb', repeats: 2 }) },
    ERUPTION: { id: 'ERUPTION', name: 'Eruption', color: 'watcher', type: 'attack', rarity: 'basic', poolEnabled: false, cost: 2, upgrade: { cost: 1 }, baseDamage: 9,
        targeting: { type: 'single_enemy', required: true }, description: () => 'Enter Wrath.',
        onPlay: ({ engine, source, targets, card }) => {
            engine.enqueue({ kind: 'DealDamage', source, target: targets[0], amount: attackAmount(engine, card, 9) })
            engine.enqueue({ kind: 'ChangeStance', stance: 'wrath' })
        } },
    VIGILANCE: { id: 'VIGILANCE', name: 'Vigilance', color: 'watcher', type: 'skill', rarity: 'basic', poolEnabled: false, cost: 2, upgrade: { baseBlock: 12 }, baseBlock: 8,
        description: () => 'Enter Calm.', onPlay: ({ engine, source, card }) => {
            engine.enqueue({ kind: 'GainBlock', target: source, amount: card.upgradeLevel ? 12 : 8, blockSource: 'card' })
            engine.enqueue({ kind: 'ChangeStance', stance: 'calm' })
        } },
    MIRACLE: { id: 'MIRACLE', name: 'Miracle', color: 'colorless', type: 'skill', poolEnabled: false, cost: 0, retain: true, exhaust: true, upgrade: {},
        description: card => `Gain ${card.upgradeLevel ? 2 : 1} Energy.`, onPlay: ({ engine, card }) => engine.enqueue({ kind: 'GainEnergy', amount: card.upgradeLevel ? 2 : 1 }) },
}
for (const color of ['silent', 'defect', 'watcher'] as const) {
    const attack = `STRIKE_${color.toUpperCase()}`; const defend = `DEFEND_${color.toUpperCase()}`
    STARTER_CARDS[attack] = { id: attack, name: 'Strike', color, type: 'attack', rarity: 'basic', poolEnabled: false, cost: 1, baseDamage: 6, upgrade: { baseDamage: 9 }, targeting: { type: 'single_enemy', required: true } }
    STARTER_CARDS[defend] = { id: defend, name: 'Defend', color, type: 'skill', rarity: 'basic', poolEnabled: false, cost: 1, baseBlock: 5, upgrade: { baseBlock: 8 } }
}
