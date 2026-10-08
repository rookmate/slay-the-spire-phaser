import { defineAttack as card } from './builders'
import { resolveCard } from '../cards'
import type { CardDef } from '../state'
import { powerAmount } from '../combatMath'
import { chooseDiscard } from '../combat/choices'
import { attack, block, draw, energy, upgraded as up, allEnemies, type PlayContext } from './builders'


const status = (ctx: PlayContext, id: 'POISON' | 'WEAK' | 'CHOKE', amount: number) => ctx.engine.enqueue({ kind: 'ApplyPower', target: ctx.targets[0], powerId: id, stacks: amount })
export const SILENT_ATTACKS: Record<string, CardDef> = {
    ALL_OUT_ATTACK: card('ALL_OUT_ATTACK', 'All-Out Attack', 1, 'uncommon', 10, 14, { targeting: allEnemies, description: () => 'Discard a random card.',
        onPlay: ctx => { attack(ctx, up(ctx.card, 10, 14)); ctx.engine.afterQueuedEffects(() => { const hand = ctx.engine.state.player.hand; if (hand.length) ctx.engine.discardCards([hand[ctx.engine.rng.int(0, hand.length - 1)].instanceId]) }) } }),
    BACKSTAB: card('BACKSTAB', 'Backstab', 0, 'uncommon', 11, 15, { innate: true, exhaust: true }),
    BANE: card('BANE', 'Bane', 1, 'common', 7, 10, { description: () => 'Hit twice if the enemy is Poisoned.',
        onPlay: ctx => attack(ctx, up(ctx.card, 7, 10), powerAmount(ctx.engine.getEntity(ctx.targets[0])!, 'POISON') > 0 ? 2 : 1) }),
    CHOKE: card('CHOKE', 'Choke', 2, 'uncommon', 12, 12, { description: c => `For each later card this turn, this enemy loses ${up(c, 3, 5)} HP.`,
        onPlay: ctx => { attack(ctx, 12); status(ctx, 'CHOKE', up(ctx.card, 3, 5)) } }),
    DAGGER_SPRAY: card('DAGGER_SPRAY', 'Dagger Spray', 1, 'common', 4, 6, { targeting: allEnemies, description: () => 'Hit all enemies twice.', onPlay: ctx => attack(ctx, up(ctx.card, 4, 6), 2) }),
    DAGGER_THROW: card('DAGGER_THROW', 'Dagger Throw', 1, 'common', 9, 12, { description: () => 'Draw 1. Discard 1.',
        onPlay: ctx => { attack(ctx, up(ctx.card, 9, 12)); draw(ctx, 1); ctx.engine.afterQueuedEffects(() => chooseDiscard(ctx.engine, 1, ctx.card.instanceId)) } }),
    DASH: card('DASH', 'Dash', 2, 'uncommon', 10, 13, { baseBlock: 10, upgrade: { baseDamage: 13, baseBlock: 13 }, onPlay: ctx => { block(ctx, up(ctx.card, 10, 13)); attack(ctx, up(ctx.card, 10, 13)) } }),
    DIE_DIE_DIE: card('DIE_DIE_DIE', 'Die Die Die', 1, 'rare', 13, 17, { exhaust: true, targeting: allEnemies }),
    ENDLESS_AGONY: card('ENDLESS_AGONY', 'Endless Agony', 0, 'uncommon', 4, 6, { exhaust: true, description: () => 'When drawn, add a copy to your hand.', onDraw: ({ engine, card }) => { engine.copyCardToHand(card.instanceId) } }),
    EVISCERATE: card('EVISCERATE', 'Eviscerate', 3, 'uncommon', 7, 9, { description: () => 'Hit 3 times. Costs 1 less per discard this turn.', dynamicCostScope: 'turn', dynamicCost: ({ engine, cost }) => cost - engine.state.discardsThisTurn, onPlay: ctx => attack(ctx, up(ctx.card, 7, 9), 3) }),
    FINISHER: card('FINISHER', 'Finisher', 1, 'uncommon', 6, 8, { description: () => 'Hit once for each previous Attack this turn.', onPlay: ctx => attack(ctx, up(ctx.card, 6, 8), Math.max(0, (ctx.engine.state.attacksThisTurn ?? 1) - 1)) }),
    FLECHETTES: card('FLECHETTES', 'Flechettes', 1, 'uncommon', 4, 6, { description: () => 'Hit once per Skill in your hand.', onPlay: ctx => attack(ctx, up(ctx.card, 4, 6), ctx.engine.state.player.hand.filter(c => resolveCard(c).type === 'skill').length) }),
    FLYING_KNEE: card('FLYING_KNEE', 'Flying Knee', 1, 'common', 8, 11, { description: () => 'Gain 1 Energy next turn.', onPlay: ctx => { attack(ctx, up(ctx.card, 8, 11)); ctx.engine.applyPowerToPlayer('ENERGY_NEXT_TURN', 1) } }),
    GLASS_KNIFE: card('GLASS_KNIFE', 'Glass Knife', 1, 'rare', 8, 12, { description: () => 'Hit twice. This card loses 2 damage this combat.',
        onPlay: ctx => { attack(ctx, up(ctx.card, 8, 12), 2); ctx.engine.afterQueuedEffects(() => { ctx.engine.modifyCardCombatBonusDamage(ctx.card.instanceId, -2) }) } }),
    GRAND_FINALE: card('GRAND_FINALE', 'Grand Finale', 0, 'rare', 50, 60, { targeting: allEnemies, description: () => 'Playable only with an empty draw pile.', canPlay: ({ engine }) => engine.state.player.drawPile.length === 0 }),
    HEEL_HOOK: card('HEEL_HOOK', 'Heel Hook', 1, 'uncommon', 5, 8, { description: () => 'If the enemy is Weak, gain 1 Energy and draw 1.', onPlay: ctx => { attack(ctx, up(ctx.card, 5, 8)); if (powerAmount(ctx.engine.getEntity(ctx.targets[0])!, 'WEAK') > 0) { energy(ctx, 1); draw(ctx, 1) } } }),
    MASTERFUL_STAB: card('MASTERFUL_STAB', 'Masterful Stab', 0, 'uncommon', 12, 16, { description: () => 'Costs 1 more per time you lost HP this combat.', dynamicCost: ({ engine, card, cost }) => cost + (engine.getCombatCardRuntime(card.instanceId).hpLossCount ?? 0) }),
    POISONED_STAB: card('POISONED_STAB', 'Poisoned Stab', 1, 'common', 6, 8, { description: c => `Apply ${up(c, 3, 4)} Poison.`, onPlay: ctx => { attack(ctx, up(ctx.card, 6, 8)); status(ctx, 'POISON', up(ctx.card, 3, 4)) } }),
    PREDATOR: card('PREDATOR', 'Predator', 2, 'uncommon', 15, 20, { description: () => 'Draw 2 extra cards next turn.', onPlay: ctx => { attack(ctx, up(ctx.card, 15, 20)); ctx.engine.applyPowerToPlayer('DRAW_NEXT_TURN', 2) } }),
    QUICK_SLASH: card('QUICK_SLASH', 'Quick Slash', 1, 'common', 8, 12, { description: () => 'Draw 1.', onPlay: ctx => { attack(ctx, up(ctx.card, 8, 12)); draw(ctx, 1) } }),
    RIDDLE_WITH_HOLES: card('RIDDLE_WITH_HOLES', 'Riddle with Holes', 2, 'uncommon', 3, 4, { description: () => 'Hit 5 times.', onPlay: ctx => attack(ctx, up(ctx.card, 3, 4), 5) }),
    SKEWER: card('SKEWER', 'Skewer', 0, 'uncommon', 7, 10, { xCost: true, description: () => 'Hit X times.', onPlay: ctx => attack(ctx, up(ctx.card, 7, 10), ctx.spentEnergy) }),
    SLICE: card('SLICE', 'Slice', 0, 'common', 6, 9),
    SNEAKY_STRIKE: card('SNEAKY_STRIKE', 'Sneaky Strike', 2, 'common', 12, 16, { description: () => 'If you discarded this turn, gain 2 Energy.', onPlay: ctx => { attack(ctx, up(ctx.card, 12, 16)); if (ctx.engine.state.discardsThisTurn > 0) energy(ctx, 2) } }),
    SUCKER_PUNCH: card('SUCKER_PUNCH', 'Sucker Punch', 1, 'common', 7, 9, { description: c => `Apply ${up(c, 1, 2)} Weak.`, onPlay: ctx => { attack(ctx, up(ctx.card, 7, 9)); status(ctx, 'WEAK', up(ctx.card, 1, 2)) } }),
    UNLOAD: card('UNLOAD', 'Unload', 1, 'rare', 14, 18, { description: () => 'Discard every non-Attack in your hand.', onPlay: ctx => { attack(ctx, up(ctx.card, 14, 18)); ctx.engine.afterQueuedEffects(() => ctx.engine.discardCards(ctx.engine.state.player.hand.filter(c => resolveCard(c).type !== 'attack').map(c => c.instanceId))) } }),
    SHIV: card('SHIV', 'Shiv', 0, undefined, 4, 6, { color: 'colorless', poolEnabled: false, exhaust: true,
        onPlay: ctx => attack(ctx, up(ctx.card, 4, 6) + powerAmount(ctx.engine.state.player, 'ACCURACY')) }),
}
