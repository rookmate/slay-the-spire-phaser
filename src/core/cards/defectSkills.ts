import { shuffleDrawPile } from '../combat/piles'
import type { CardDef, ChoiceZone } from '../state'
import type { OrbType } from '../combat/resources'
import { resolveCard } from '../cards'
import { generateCard } from '../combat/choices'
import { chooseOneCard } from './helpers'
import { block, draw, energy, upgraded as up, defineSkill as skill, type PlayContext } from './builders'
const channel = (ctx: PlayContext, orbType: OrbType, count = 1) => { for (let i = 0; i < count; i++) ctx.engine.enqueue({ kind: 'ChannelOrb', orbType }) }
const choose = (ctx: PlayContext, zone: ChoiceZone, prompt: string, onSubmit: (id: string) => void) => ctx.engine.afterQueuedEffects(() => chooseOneCard(ctx.engine, { card: ctx.card, zone, prompt, eligibleInstanceIds: ctx.engine.getCardsInZone(zone).map(c => c.instanceId), onSubmit }))
export const DEFECT_SKILLS: Record<string, CardDef> = {
    AGGREGATE: skill('AGGREGATE', 'Aggregate', 1, 'uncommon', c => `Gain 1 Energy per ${up(c, 4, 3)} cards in your draw pile.`, ctx => energy(ctx, Math.floor(ctx.engine.state.player.drawPile.length / up(ctx.card, 4, 3)))),
    AMPLIFY: skill('AMPLIFY', 'Amplify', 1, 'rare', c => `Play your next ${up(c, 1, 2)} Powers twice this turn.`, ctx => ctx.engine.applyPowerToPlayer('AMPLIFY', up(ctx.card, 1, 2))),
    AUTO_SHIELDS: skill('AUTO_SHIELDS', 'Auto-Shields', 1, 'uncommon', c => `If you have no Block, gain ${up(c, 11, 15)} Block.`, ctx => { if (ctx.engine.state.player.block === 0) block(ctx, up(ctx.card, 11, 15)) }),
    BOOT_SEQUENCE: skill('BOOT_SEQUENCE', 'Boot Sequence', 0, 'uncommon', undefined, ctx => block(ctx, up(ctx.card, 10, 13)), { innate: true, exhaust: true, baseBlock: 10, upgrade: { baseBlock: 13 } }),
    CHAOS: skill('CHAOS', 'Chaos', 1, 'uncommon', c => `Channel ${up(c, 1, 2)} random orbs.`, ctx => { const types: OrbType[] = ['lightning', 'frost', 'dark', 'plasma']; for (let i = 0; i < up(ctx.card, 1, 2); i++) channel(ctx, types[ctx.engine.rng.int(0, 3)]) }),
    CHARGE_BATTERY: skill('CHARGE_BATTERY', 'Charge Battery', 1, 'common', () => 'Gain 1 Energy next turn.', ctx => { block(ctx, up(ctx.card, 7, 10)); ctx.engine.applyPowerToPlayer('ENERGY_NEXT_TURN', 1) }, { baseBlock: 7, upgrade: { baseBlock: 10 } }),
    CHILL: skill('CHILL', 'Chill', 0, 'uncommon', () => 'Channel 1 Frost per living enemy.', ctx => channel(ctx, 'frost', ctx.engine.countLivingEnemies()), { exhaust: true, upgrade: { innate: true } }),
    CONSUME: skill('CONSUME', 'Consume', 2, 'uncommon', c => `Gain ${up(c, 2, 3)} Focus. Lose 1 orb slot.`, ctx => { ctx.engine.applyPowerToPlayer('FOCUS', up(ctx.card, 2, 3)); ctx.engine.enqueue({ kind: 'ChangeOrbSlots', amount: -1 }) }),
    COOLHEADED: skill('COOLHEADED', 'Coolheaded', 1, 'common', c => `Channel 1 Frost. Draw ${up(c, 1, 2)}.`, ctx => { channel(ctx, 'frost'); draw(ctx, up(ctx.card, 1, 2)) }),
    DARKNESS: skill('DARKNESS', 'Darkness', 1, 'uncommon', c => `Channel 1 Dark.${c.upgradeLevel ? ' Trigger all Dark passives.' : ''}`, ctx => {
        channel(ctx, 'dark'); if (ctx.card.upgradeLevel) ctx.engine.afterQueuedEffects(() => { for (const orb of ctx.engine.state.player.orbs) if (orb.type === 'dark') ctx.engine.enqueue({ kind: 'TriggerOrb', orb, mode: 'passive' }) })
    }),
    DOUBLE_ENERGY: skill('DOUBLE_ENERGY', 'Double Energy', 1, 'uncommon', () => 'Double your remaining Energy.', ctx => energy(ctx, ctx.engine.state.player.energy), { exhaust: true, upgrade: { cost: 0 } }),
    EQUILIBRIUM: skill('EQUILIBRIUM', 'Equilibrium', 2, 'uncommon', () => 'Retain your hand this turn.', ctx => { block(ctx, up(ctx.card, 13, 16)); ctx.engine.applyPowerToPlayer('EQUILIBRIUM', 1) }, { baseBlock: 13, upgrade: { baseBlock: 16 } }),
    FISSION: skill('FISSION', 'Fission', 0, 'rare', c => `${c.upgradeLevel ? 'Evoke' : 'Remove'} all your orbs. Gain 1 Energy and draw 1 per orb.`, ctx => {
        const count = ctx.engine.state.player.orbs.length
        if (ctx.card.upgradeLevel) for (let i = 0; i < count; i++) ctx.engine.enqueue({ kind: 'EvokeOrb' })
        else ctx.engine.state.player.orbs = []
        energy(ctx, count); draw(ctx, count)
    }, { exhaust: true }),
    FORCE_FIELD: skill('FORCE_FIELD', 'Force Field', 4, 'uncommon', () => 'Costs 1 less per Power played this combat.', ctx => block(ctx, up(ctx.card, 12, 16)), { baseBlock: 12, upgrade: { baseBlock: 16 }, dynamicCost: ({ engine, cost }) => Math.max(0, cost - (engine.state.powersPlayed ?? 0)) }),
    FUSION: skill('FUSION', 'Fusion', 2, 'uncommon', () => 'Channel 1 Plasma.', ctx => channel(ctx, 'plasma'), { upgrade: { cost: 1 } }),
    GENETIC_ALGORITHM: skill('GENETIC_ALGORITHM', 'Genetic Algorithm', 1, 'uncommon', c => `Gain ${c.permanentBlock ?? 1} Block. Permanently gain ${up(c, 2, 3)} more Block on this card.`, ctx => {
        block(ctx, ctx.card.permanentBlock ?? 1)
        const gain = up(ctx.card, 2, 3); ctx.card.permanentBlock = (ctx.card.permanentBlock ?? 1) + gain
        const original = ctx.engine.run?.deck.find(c => c.instanceId === ctx.card.instanceId)
        if (original) original.permanentBlock = (original.permanentBlock ?? 1) + gain
    }, { exhaust: true }),
    GLACIER: skill('GLACIER', 'Glacier', 2, 'uncommon', () => 'Channel 2 Frost.', ctx => { block(ctx, up(ctx.card, 7, 10)); channel(ctx, 'frost', 2) }, { baseBlock: 7, upgrade: { baseBlock: 10 } }),
    HOLOGRAM: skill('HOLOGRAM', 'Hologram', 1, 'common', () => 'Return a card from discard to your hand.', ctx => { block(ctx, up(ctx.card, 3, 5)); choose(ctx, 'discard', 'Return a card', id => { ctx.engine.moveCardToDestination(id, 'discard', 'hand') }) }, { baseBlock: 3, exhaust: true, upgrade: { baseBlock: 5, exhaust: false } }),
    LEAP: skill('LEAP', 'Leap', 1, 'common', undefined, ctx => block(ctx, up(ctx.card, 9, 12)), { baseBlock: 9, upgrade: { baseBlock: 12 } }),
    MULTI_CAST: skill('MULTI_CAST', 'Multi-Cast', 0, 'rare', c => `Evoke your first orb X${c.upgradeLevel ? '+1' : ''} times.`, ctx => { const repeats = ctx.spentEnergy + up(ctx.card, 0, 1); if (repeats) ctx.engine.enqueue({ kind: 'EvokeOrb', repeats }) }, { xCost: true }),
    OVERCLOCK: skill('OVERCLOCK', 'Overclock', 0, 'uncommon', c => `Draw ${up(c, 2, 3)}. Add a Burn to discard.`, ctx => { draw(ctx, up(ctx.card, 2, 3)); ctx.engine.afterQueuedEffects(() => { ctx.engine.createCardsInDestination('BURN', 'discardPile') }) }),
    RAINBOW: skill('RAINBOW', 'Rainbow', 2, 'rare', () => 'Channel 1 Lightning, 1 Frost, and 1 Dark.', ctx => { channel(ctx, 'lightning'); channel(ctx, 'frost'); channel(ctx, 'dark') }, { exhaust: true, upgrade: { exhaust: false } }),
    REBOOT: skill('REBOOT', 'Reboot', 0, 'rare', c => `Shuffle hand and discard into your draw pile. Draw ${up(c, 4, 6)}.`, ctx => {
        shuffleDrawPile(ctx.engine, true); draw(ctx, up(ctx.card, 4, 6))
    }, { exhaust: true }),
    RECYCLE: skill('RECYCLE', 'Recycle', 1, 'uncommon', () => 'Exhaust a card in hand. Gain Energy equal to its cost.', ctx => choose(ctx, 'hand', 'Recycle a card', id => {
        const c = ctx.engine.state.player.hand.find(c => c.instanceId === id)!
        const cost = resolveCard(c).unplayable ? 0 : ctx.engine.getCardCost(c); ctx.engine.handleExhaustFromHand(c); energy(ctx, cost)
    }), { upgrade: { cost: 0 } }),
    RECURSION: skill('RECURSION', 'Recursion', 1, 'common', () => 'Evoke your first orb and channel it again.', ctx => {
        const orb = ctx.engine.state.player.orbs[0]; if (!orb) return
        ctx.engine.enqueue({ kind: 'EvokeOrb' }); ctx.engine.enqueue({ kind: 'ChannelOrb', orbType: orb.type, storedDamage: orb.storedDamage })
    }, { upgrade: { cost: 0 } }),
    REINFORCED_BODY: skill('REINFORCED_BODY', 'Reinforced Body', 0, 'uncommon', c => `Gain ${up(c, 7, 9)} Block X times.`, ctx => { for (let i = 0; i < ctx.spentEnergy; i++) block(ctx, up(ctx.card, 7, 9)) }, { xCost: true }),
    REPROGRAM: skill('REPROGRAM', 'Reprogram', 1, 'uncommon', c => `Lose ${up(c, 1, 2)} Focus. Gain ${up(c, 1, 2)} Strength and Dexterity.`, ctx => {
        ctx.engine.applyPowerToPlayer('FOCUS', -up(ctx.card, 1, 2)); ctx.engine.applyPowerToPlayer('STRENGTH', up(ctx.card, 1, 2)); ctx.engine.applyPowerToPlayer('DEXTERITY', up(ctx.card, 1, 2))
    }),
    SEEK: skill('SEEK', 'Seek', 0, 'rare', c => `Move ${up(c, 1, 2)} cards from your draw pile to your hand.`, ctx => ctx.engine.afterQueuedEffects(() => {
        const cards = ctx.engine.state.player.drawPile; const n = Math.min(cards.length, up(ctx.card, 1, 2)); if (!n) return
        ctx.engine.beginChoice({ zone: 'draw', prompt: `Choose ${n} cards`, sourceCardInstanceId: ctx.card.instanceId, eligibleInstanceIds: cards.map(c => c.instanceId), minSelections: n, maxSelections: n, canSkip: false,
            onSubmit: ids => { for (const id of ids) ctx.engine.moveCardToDestination(id, 'draw', 'hand') } })
    }), { exhaust: true }),
    SKIM: skill('SKIM', 'Skim', 1, 'uncommon', c => `Draw ${up(c, 3, 4)}.`, ctx => draw(ctx, up(ctx.card, 3, 4))),
    STACK: skill('STACK', 'Stack', 1, 'common', c => `Gain Block equal to your discard pile size${c.upgradeLevel ? ' +3' : ''}.`, ctx => block(ctx, ctx.engine.state.player.discardPile.length + up(ctx.card, 0, 3))),
    STEAM_BARRIER: skill('STEAM_BARRIER', 'Steam Barrier', 0, 'common', c => `Gain ${up(c, 6, 8)} Block. This card loses 1 Block this combat.`, ctx => {
        const runtime = ctx.engine.getCombatCardRuntime(ctx.card.instanceId); block(ctx, up(ctx.card, 6, 8) + (runtime.bonusBlock ?? 0)); runtime.bonusBlock = (runtime.bonusBlock ?? 0) - 1
    }),
    TEMPEST: skill('TEMPEST', 'Tempest', 0, 'uncommon', c => `Channel X${c.upgradeLevel ? '+1' : ''} Lightning.`, ctx => channel(ctx, 'lightning', ctx.spentEnergy + up(ctx.card, 0, 1)), { xCost: true, exhaust: true }),
    TURBO: skill('TURBO', 'TURBO', 0, 'common', c => `Gain ${up(c, 2, 3)} Energy. Add a Void to discard.`, ctx => { energy(ctx, up(ctx.card, 2, 3)); ctx.engine.createCardsInDestination('VOID', 'discardPile') }),
    WHITE_NOISE: skill('WHITE_NOISE', 'White Noise', 1, 'uncommon', () => 'Add a random Power to your hand. It costs 0 this turn.', ctx => { generateCard(ctx.engine, { type: 'power', zeroCost: 'turn' }) }, { exhaust: true, upgrade: { cost: 0 } }),
}
