import { defineSkill as skill } from './builders'
import type { CardDef } from '../state'
import { resolveCard } from '../cards'
import { blockAmount, powerAmount } from '../combatMath'
import { canObtainPotion } from '../relics'
import { drawPotion } from '../rewardPools'
import { chooseDiscard, generateCard } from '../combat/choices'
import { chooseOneCard } from './helpers'
import { block, draw, energy, upgraded as up, singleEnemy, type PlayContext } from './builders'


const power = (ctx: PlayContext, id: Parameters<typeof ctx.engine.applyPowerToPlayer>[0], stacks: number, target = ctx.source) => ctx.engine.enqueue({ kind: 'ApplyPower', target, powerId: id, stacks })
const discard = (ctx: PlayContext, count: number, after?: () => void) => ctx.engine.afterQueuedEffects(() => chooseDiscard(ctx.engine, count, ctx.card.instanceId, after))
const chooseHand = (ctx: PlayContext, prompt: string, onSubmit: (id: string) => void) => ctx.engine.afterQueuedEffects(() => chooseOneCard(ctx.engine, { card: ctx.card, prompt, zone: 'hand', eligibleInstanceIds: ctx.engine.state.player.hand.map(c => c.instanceId), onSubmit }))
export const SILENT_SKILLS: Record<string, CardDef> = {
    ACROBATICS: skill('ACROBATICS', 'Acrobatics', 1, 'common', c => `Draw ${up(c, 3, 4)}. Discard 1.`, ctx => { draw(ctx, up(ctx.card, 3, 4)); discard(ctx, 1) }),
    ADRENALINE: skill('ADRENALINE', 'Adrenaline', 0, 'rare', c => `Gain ${up(c, 1, 2)} Energy. Draw 2.`, ctx => { energy(ctx, up(ctx.card, 1, 2)); draw(ctx, 2) }, { exhaust: true }),
    ALCHEMIZE: skill('ALCHEMIZE', 'Alchemize', 1, 'rare', () => 'Obtain a random potion.', ctx => { const run = ctx.engine.run; if (run && canObtainPotion(run)) run.potions.push(drawPotion(ctx.engine.rng, run.character, 'generated')) }, { exhaust: true, upgrade: { cost: 0 } }),
    BACKFLIP: skill('BACKFLIP', 'Backflip', 1, 'common', () => 'Draw 2.', ctx => { block(ctx, up(ctx.card, 5, 8)); draw(ctx, 2) }, { baseBlock: 5, upgrade: { baseBlock: 8 } }),
    BLADE_DANCE: skill('BLADE_DANCE', 'Blade Dance', 1, 'common', c => `Add ${up(c, 3, 4)} Shivs to your hand.`, ctx => { ctx.engine.createCardsInDestination('SHIV', 'hand', up(ctx.card, 3, 4)) }),
    BLUR: skill('BLUR', 'Blur', 1, 'uncommon', () => 'Keep Block at the start of your next turn.', ctx => { block(ctx, up(ctx.card, 5, 8)); power(ctx, 'BLUR', 1) }, { baseBlock: 5, upgrade: { baseBlock: 8 } }),
    BOUNCING_FLASK: skill('BOUNCING_FLASK', 'Bouncing Flask', 2, 'uncommon', c => `Apply 3 Poison to a random enemy ${up(c, 3, 4)} times.`, ctx => {
        for (let i = 0; i < up(ctx.card, 3, 4); i++) ctx.engine.afterQueuedEffects(() => {
            const enemies = ctx.engine.state.enemies.filter(e => e.hp > 0)
            if (enemies.length) power(ctx, 'POISON', 3, enemies[ctx.engine.rng.int(0, enemies.length - 1)].id)
        })
    }),
    BULLET_TIME: skill('BULLET_TIME', 'Bullet Time', 3, 'rare', () => 'Cards in hand cost 0 this turn. You cannot draw this turn.', ctx => {
        power(ctx, 'NO_DRAW', 1)
        for (const c of ctx.engine.state.player.hand) if (!resolveCard(c).xCost && !resolveCard(c).unplayable) c.costForTurn = 0
    }, { upgrade: { cost: 2 } }),
    BURST: skill('BURST', 'Burst', 1, 'rare', c => `Play your next ${up(c, 1, 2)} Skills twice this turn.`, ctx => power(ctx, 'BURST', up(ctx.card, 1, 2))),
    CALCULATED_GAMBLE: skill('CALCULATED_GAMBLE', 'Calculated Gamble', 0, 'uncommon', () => 'Discard your hand. Draw that many cards.', ctx => {
        const ids = ctx.engine.state.player.hand.map(c => c.instanceId); ctx.engine.discardCards(ids); draw(ctx, ids.length)
    }, { exhaust: true, upgrade: { exhaust: false } }),
    CATALYST: skill('CATALYST', 'Catalyst', 1, 'uncommon', c => `${c.upgradeLevel ? 'Triple' : 'Double'} the enemy's Poison.`, ctx => power(ctx, 'POISON', powerAmount(ctx.engine.getEntity(ctx.targets[0])!, 'POISON') * up(ctx.card, 1, 2), ctx.targets[0]), { exhaust: true, targeting: singleEnemy }),
    CLOAK_AND_DAGGER: skill('CLOAK_AND_DAGGER', 'Cloak and Dagger', 1, 'common', c => `Add ${up(c, 1, 2)} Shivs to your hand.`, ctx => { block(ctx, 6); ctx.engine.createCardsInDestination('SHIV', 'hand', up(ctx.card, 1, 2)) }, { baseBlock: 6 }),
    CONCENTRATE: skill('CONCENTRATE', 'Concentrate', 0, 'uncommon', c => `Discard ${up(c, 3, 2)}. Gain 2 Energy.`, ctx => discard(ctx, up(ctx.card, 3, 2), () => energy(ctx, 2))),
    CORPSE_EXPLOSION: skill('CORPSE_EXPLOSION', 'Corpse Explosion', 2, 'rare', c => `Apply ${up(c, 6, 9)} Poison. When it dies, deal its max HP to all enemies.`, ctx => { power(ctx, 'POISON', up(ctx.card, 6, 9), ctx.targets[0]); power(ctx, 'CORPSE_EXPLOSION', 1, ctx.targets[0]) }, { targeting: singleEnemy }),
    CRIPPLING_CLOUD: skill('CRIPPLING_CLOUD', 'Crippling Cloud', 2, 'uncommon', c => `Apply ${up(c, 4, 7)} Poison and 2 Weak to all enemies.`, ctx => {
        for (const enemy of ctx.engine.state.enemies.filter(e => e.hp > 0)) { power(ctx, 'POISON', up(ctx.card, 4, 7), enemy.id); power(ctx, 'WEAK', 2, enemy.id) }
    }, { exhaust: true }),
    DEADLY_POISON: skill('DEADLY_POISON', 'Deadly Poison', 1, 'common', c => `Apply ${up(c, 5, 7)} Poison.`, ctx => power(ctx, 'POISON', up(ctx.card, 5, 7), ctx.targets[0]), { targeting: singleEnemy }),
    DEFLECT: skill('DEFLECT', 'Deflect', 0, 'common', undefined, ctx => block(ctx, up(ctx.card, 4, 7)), { baseBlock: 4, upgrade: { baseBlock: 7 } }),
    DISTRACTION: skill('DISTRACTION', 'Distraction', 1, 'uncommon', () => 'Add a random Skill to your hand. It costs 0 this turn.', ctx => { generateCard(ctx.engine, { type: 'skill', zeroCost: 'turn' }) }, { exhaust: true, upgrade: { cost: 0 } }),
    DODGE_AND_ROLL: skill('DODGE_AND_ROLL', 'Dodge and Roll', 1, 'common', c => `Gain ${up(c, 4, 6)} Block next turn too.`, ctx => {
        block(ctx, up(ctx.card, 4, 6)); power(ctx, 'BLOCK_NEXT_TURN', blockAmount(up(ctx.card, 4, 6), ctx.engine.state.player, 'card'))
    }, { baseBlock: 4, upgrade: { baseBlock: 6 } }),
    DOPPELGANGER: skill('DOPPELGANGER', 'Doppelganger', 0, 'rare', c => `Next turn, draw X${c.upgradeLevel ? '+1' : ''} and gain X${c.upgradeLevel ? '+1' : ''} Energy.`, ctx => {
        const n = ctx.spentEnergy + up(ctx.card, 0, 1); power(ctx, 'DRAW_NEXT_TURN', n); power(ctx, 'ENERGY_NEXT_TURN', n)
    }, { xCost: true, exhaust: true }),
    ESCAPE_PLAN: skill('ESCAPE_PLAN', 'Escape Plan', 0, 'uncommon', c => `Draw 1. If it is a Skill, gain ${up(c, 3, 5)} Block.`, ctx => {
        ctx.engine.state.lastDrawnCard = undefined; draw(ctx, 1); ctx.engine.afterQueuedEffects(() => { const last = ctx.engine.state.lastDrawnCard; if (last && resolveCard(last).type === 'skill') block(ctx, up(ctx.card, 3, 5)) })
    }),
    EXPERTISE: skill('EXPERTISE', 'Expertise', 1, 'uncommon', c => `Draw until you have ${up(c, 6, 7)} cards in hand.`, ctx => draw(ctx, Math.max(0, up(ctx.card, 6, 7) - ctx.engine.state.player.hand.length))),
    LEG_SWEEP: skill('LEG_SWEEP', 'Leg Sweep', 2, 'uncommon', c => `Apply ${up(c, 2, 3)} Weak.`, ctx => { power(ctx, 'WEAK', up(ctx.card, 2, 3), ctx.targets[0]); block(ctx, up(ctx.card, 11, 14)) }, { targeting: singleEnemy, baseBlock: 11, upgrade: { baseBlock: 14 } }),
    MALAISE: skill('MALAISE', 'Malaise', 0, 'rare', c => `Enemy loses X${c.upgradeLevel ? '+1' : ''} Strength and gains that much Weak.`, ctx => {
        const n = ctx.spentEnergy + up(ctx.card, 0, 1); power(ctx, 'STRENGTH', -n, ctx.targets[0]); power(ctx, 'WEAK', n, ctx.targets[0])
    }, { xCost: true, exhaust: true, targeting: singleEnemy }),
    NIGHTMARE: skill('NIGHTMARE', 'Nightmare', 3, 'rare', () => 'Choose a card in hand. Add 3 copies next turn.', ctx => chooseHand(ctx, 'Copy a card for next turn', id => {
        const card = ctx.engine.state.player.hand.find(c => c.instanceId === id)!
        ctx.engine.state.nextTurnCopies ??= []; ctx.engine.state.nextTurnCopies.push(...Array.from({ length: 3 }, () => ({ ...card, costForTurn: undefined })))
    }), { exhaust: true, upgrade: { cost: 2 } }),
    OUTMANEUVER: skill('OUTMANEUVER', 'Outmaneuver', 1, 'common', c => `Gain ${up(c, 2, 3)} Energy next turn.`, ctx => power(ctx, 'ENERGY_NEXT_TURN', up(ctx.card, 2, 3))),
    PHANTASMAL_KILLER: skill('PHANTASMAL_KILLER', 'Phantasmal Killer', 1, 'rare', () => 'Your Attacks deal double damage next turn.', ctx => power(ctx, 'PHANTASMAL_KILLER', 1), { upgrade: { cost: 0 } }),
    PIERCING_WAIL: skill('PIERCING_WAIL', 'Piercing Wail', 1, 'common', c => `All enemies lose ${up(c, 6, 8)} Strength this turn.`, ctx => {
        for (const enemy of ctx.engine.state.enemies.filter(e => e.hp > 0)) {
            // Artifact blocks both the loss and its restoration marker together.
            if (powerAmount(enemy, 'ARTIFACT') > 0) power(ctx, 'STRENGTH', -up(ctx.card, 6, 8), enemy.id)
            else { power(ctx, 'STRENGTH', -up(ctx.card, 6, 8), enemy.id); power(ctx, 'STRENGTH_UP_NEXT_TURN', up(ctx.card, 6, 8), enemy.id) }
        }
    }, { exhaust: true }),
    PREPARED: skill('PREPARED', 'Prepared', 0, 'common', c => `Draw ${up(c, 1, 2)}. Discard ${up(c, 1, 2)}.`, ctx => { draw(ctx, up(ctx.card, 1, 2)); discard(ctx, up(ctx.card, 1, 2)) }),
    REFLEX: skill('REFLEX', 'Reflex', 0, 'uncommon', c => `When manually discarded, draw ${up(c, 2, 3)}.`, undefined, { unplayable: true, onDiscard: ({ engine, card }) => engine.enqueue({ kind: 'DrawCards', count: up(card, 2, 3) }) }),
    SETUP: skill('SETUP', 'Setup', 1, 'uncommon', () => 'Put a card from hand on top of your draw pile. It costs 0 until played.', ctx => chooseHand(ctx, 'Set up a card', id => {
        const card = ctx.engine.moveCardToDestination(id, 'hand', 'drawPileTop'); if (card) card.costUntilPlayed = 0
    }), { upgrade: { cost: 0 } }),
    STORM_OF_STEEL: skill('STORM_OF_STEEL', 'Storm of Steel', 1, 'rare', c => `Discard your hand. Add that many Shivs${c.upgradeLevel ? '+' : ''}.`, ctx => {
        const ids = ctx.engine.state.player.hand.map(c => c.instanceId); ctx.engine.discardCards(ids)
        ctx.engine.afterQueuedEffects(() => { ctx.engine.createCardsInDestination('SHIV', 'hand', ids.length, up(ctx.card, 0, 1)) })
    }),
    TACTICIAN: skill('TACTICIAN', 'Tactician', 0, 'uncommon', c => `When manually discarded, gain ${up(c, 1, 2)} Energy.`, undefined, { unplayable: true, onDiscard: ({ engine, card }) => engine.enqueue({ kind: 'GainEnergy', amount: up(card, 1, 2) }) }),
    TERROR: skill('TERROR', 'Terror', 1, 'uncommon', () => 'Apply 99 Vulnerable.', ctx => power(ctx, 'VULNERABLE', 99, ctx.targets[0]), { targeting: singleEnemy, exhaust: true, upgrade: { cost: 0 } }),
}
