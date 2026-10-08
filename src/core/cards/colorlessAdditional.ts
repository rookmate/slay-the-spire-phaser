import { shuffleDrawPile } from '../combat/piles'
import type { CardDef, CardType } from '../state'
import { resolveCard } from '../cards'
import { powerAmount } from '../combatMath'
import { discoverCards, generateCard } from '../combat/choices'
import { chooseOneCard } from './helpers'
import { attack, block, draw, upgraded as up, singleEnemy, allEnemies, defineAttack, defineSkill as skill, definePower as power, type PlayContext } from './builders'
const findCard = (ctx: PlayContext, type: CardType) => ctx.engine.afterQueuedEffects(() => chooseOneCard(ctx.engine, {
    card: ctx.card, zone: 'draw', prompt: `Choose an ${type}`, eligibleInstanceIds: ctx.engine.state.player.drawPile.filter(c => resolveCard(c).type === type).map(c => c.instanceId),
    onSubmit: id => { ctx.engine.moveCardToDestination(id, 'draw', 'hand') },
}))
export const ADDITIONAL_COLORLESS: Record<string, CardDef> = {
    BLIND: skill('BLIND', 'Blind', 0, 'uncommon', c => `Apply 2 Weak${c.upgradeLevel ? ' to all enemies' : ''}.`, ctx => {
        for (const target of ctx.targets) ctx.engine.enqueue({ kind: 'ApplyPower', target, powerId: 'WEAK', stacks: 2 })
    }, { targeting: singleEnemy, upgrade: { targeting: allEnemies } }),
    CHRYSALIS: skill('CHRYSALIS', 'Chrysalis', 2, 'rare', c => `Shuffle ${up(c, 3, 5)} random Skills into your draw pile. They cost 0 this combat.`, ctx => {
        for (let i = 0; i < up(ctx.card, 3, 5); i++) generateCard(ctx.engine, { type: 'skill', zeroCost: 'combat', destination: 'drawPile' })
    }, { exhaust: true }),
    DARK_SHACKLES: skill('DARK_SHACKLES', 'Dark Shackles', 0, 'uncommon', c => `Enemy loses ${up(c, 9, 15)} Strength this turn.`, ctx => {
        const enemy = ctx.engine.getEntity(ctx.targets[0])!, blocked = powerAmount(enemy, 'ARTIFACT') > 0
        ctx.engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH', stacks: -up(ctx.card, 9, 15) })
        if (!blocked) ctx.engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'STRENGTH_UP_NEXT_TURN', stacks: up(ctx.card, 9, 15) })
    }, { targeting: singleEnemy, exhaust: true }),
    DEEP_BREATH: skill('DEEP_BREATH', 'Deep Breath', 0, 'uncommon', c => `Shuffle discard into your draw pile. Draw ${up(c, 1, 2)}.`, ctx => {
        shuffleDrawPile(ctx.engine); draw(ctx, up(ctx.card, 1, 2))
    }),
    DISCOVERY: skill('DISCOVERY', 'Discovery', 1, 'uncommon', () => 'Choose 1 of 3 random cards. It costs 0 this turn.', ctx => ctx.engine.afterQueuedEffects(() => discoverCards(ctx.engine, ctx.card.instanceId)), { exhaust: true, upgrade: { exhaust: false } }),
    ENLIGHTENMENT: skill('ENLIGHTENMENT', 'Enlightenment', 0, 'uncommon', c => `Reduce costs above 1 in your hand to 1 this ${c.upgradeLevel ? 'combat' : 'turn'}.`, ctx => {
        for (const card of ctx.engine.state.player.hand) if (!resolveCard(card).xCost && ctx.engine.getCardCost(card) > 1) {
            card.costForTurn = 1; if (ctx.card.upgradeLevel) card.costForCombat = 1
        }
    }),
    FORETHOUGHT: skill('FORETHOUGHT', 'Forethought', 0, 'uncommon', c => `Put ${c.upgradeLevel ? 'any number of cards' : 'a card'} from hand on the bottom of your draw pile. They cost 0 until played.`, ctx => ctx.engine.afterQueuedEffects(() => {
        const hand = ctx.engine.state.player.hand; if (!hand.length) return
        ctx.engine.beginChoice({ zone: 'hand', prompt: 'Choose cards for the bottom of your draw pile', sourceCardInstanceId: ctx.card.instanceId, eligibleInstanceIds: hand.map(c => c.instanceId),
            minSelections: ctx.card.upgradeLevel ? 0 : 1, maxSelections: ctx.card.upgradeLevel ? hand.length : 1, canSkip: !!ctx.card.upgradeLevel,
            onSubmit: ids => { for (const id of ids) { const card = ctx.engine.moveCardToDestination(id, 'hand', 'drawPileBottom'); if (card) card.costUntilPlayed = 0 } } })
    })),
    HAND_OF_GREED: defineAttack('HAND_OF_GREED', 'Hand of Greed', 2, 'rare', 20, 25, { description: c => `If Fatal, gain ${up(c, 20, 25)} Gold.`, onFatal: ({ engine, card }) => engine.changeGold(up(card, 20, 25)) }),
    IMPATIENCE: skill('IMPATIENCE', 'Impatience', 0, 'uncommon', c => `If there are no Attacks in your hand, draw ${up(c, 2, 3)}.`, ctx => { if (!ctx.engine.state.player.hand.some(c => resolveCard(c).type === 'attack')) draw(ctx, up(ctx.card, 2, 3)) }),
    JACK_OF_ALL_TRADES: skill('JACK_OF_ALL_TRADES', 'Jack of All Trades', 0, 'uncommon', c => `Add ${up(c, 1, 2)} random colorless cards to your hand.`, ctx => { for (let i = 0; i < up(ctx.card, 1, 2); i++) generateCard(ctx.engine, { colorless: true }) }, { exhaust: true }),
    MAGNETISM: power('MAGNETISM', 'Magnetism', 2, 'rare', 'MAGNETISM', 1, 1, () => 'Add a random colorless card to your hand each turn.', { upgrade: { cost: 1 } }),
    MAYHEM: power('MAYHEM', 'Mayhem', 2, 'rare', 'MAYHEM', 1, 1, () => 'Play the top card of your draw pile at the start of each turn.', { upgrade: { cost: 1 } }),
    METAMORPHOSIS: skill('METAMORPHOSIS', 'Metamorphosis', 2, 'rare', c => `Shuffle ${up(c, 3, 5)} random Attacks into your draw pile. They cost 0 this combat.`, ctx => {
        for (let i = 0; i < up(ctx.card, 3, 5); i++) generateCard(ctx.engine, { type: 'attack', zeroCost: 'combat', destination: 'drawPile' })
    }, { exhaust: true }),
    MIND_BLAST: defineAttack('MIND_BLAST', 'Mind Blast', 2, 'uncommon', 0, 0, { innate: true, upgrade: { cost: 1 }, description: () => 'Deal damage equal to the size of your draw pile.', onPlay: ctx => attack(ctx, ctx.engine.state.player.drawPile.length) }),
    PANACHE: power('PANACHE', 'Panache', 0, 'rare', 'PANACHE', 10, 14, c => `Every 5 cards played in a turn, deal ${up(c, 10, 14)} damage to all enemies.`),
    PANIC_BUTTON: skill('PANIC_BUTTON', 'Panic Button', 0, 'uncommon', () => 'You cannot gain Block from cards for 2 turns.', ctx => { block(ctx, up(ctx.card, 30, 40)); ctx.engine.applyPowerToPlayer('NO_BLOCK', 2) }, { baseBlock: 30, upgrade: { baseBlock: 40 }, exhaust: true }),
    PURITY: skill('PURITY', 'Purity', 0, 'uncommon', c => `Exhaust up to ${up(c, 3, 5)} cards from hand.`, ctx => ctx.engine.afterQueuedEffects(() => {
        const hand = ctx.engine.state.player.hand; if (!hand.length) return
        ctx.engine.beginChoice({ zone: 'hand', prompt: 'Choose cards to exhaust', sourceCardInstanceId: ctx.card.instanceId, eligibleInstanceIds: hand.map(c => c.instanceId), minSelections: 0, maxSelections: Math.min(hand.length, up(ctx.card, 3, 5)), canSkip: true,
            onSubmit: ids => { ctx.engine.exhaustCardsInHand(c => ids.includes(c.instanceId)) } })
    }), { exhaust: true }),
    SADISTIC_NATURE: power('SADISTIC_NATURE', 'Sadistic Nature', 0, 'rare', 'SADISTIC_NATURE', 5, 7, c => `When you apply a debuff to an enemy, deal ${up(c, 5, 7)} damage to it.`),
    SECRET_TECHNIQUE: skill('SECRET_TECHNIQUE', 'Secret Technique', 0, 'rare', () => 'Move a Skill from your draw pile to hand.', ctx => findCard(ctx, 'skill'), { exhaust: true, upgrade: { exhaust: false } }),
    SECRET_WEAPON: skill('SECRET_WEAPON', 'Secret Weapon', 0, 'rare', () => 'Move an Attack from your draw pile to hand.', ctx => findCard(ctx, 'attack'), { exhaust: true, upgrade: { exhaust: false } }),
    THE_BOMB: skill('THE_BOMB', 'The Bomb', 2, 'rare', c => `After 3 turn ends, deal ${up(c, 40, 50)} damage to all enemies.`, ctx => { ctx.engine.state.bombs ??= []; ctx.engine.state.bombs.push({ turns: 3, damage: up(ctx.card, 40, 50) }) }),
    THINKING_AHEAD: skill('THINKING_AHEAD', 'Thinking Ahead', 0, 'rare', () => 'Draw 2, then put a card from hand on top of your draw pile.', ctx => {
        draw(ctx, 2); ctx.engine.afterQueuedEffects(() => chooseOneCard(ctx.engine, { card: ctx.card, zone: 'hand', prompt: 'Put a card on top', eligibleInstanceIds: ctx.engine.state.player.hand.map(c => c.instanceId), onSubmit: id => { ctx.engine.moveCardToDestination(id, 'hand', 'drawPileTop') } }))
    }, { exhaust: true, upgrade: { exhaust: false } }),
    TRANSMUTATION: skill('TRANSMUTATION', 'Transmutation', 0, 'rare', c => `Add X random ${c.upgradeLevel ? 'upgraded ' : ''}colorless cards to hand. They cost 0 this turn.`, ctx => { for (let i = 0; i < ctx.spentEnergy; i++) generateCard(ctx.engine, { colorless: true, zeroCost: 'turn', upgrade: !!ctx.card.upgradeLevel }) }, { xCost: true, exhaust: true }),
    TRIP: skill('TRIP', 'Trip', 0, 'uncommon', c => `Apply 2 Vulnerable${c.upgradeLevel ? ' to all enemies' : ''}.`, ctx => {
        for (const target of ctx.targets) ctx.engine.enqueue({ kind: 'ApplyPower', target, powerId: 'VULNERABLE', stacks: 2 })
    }, { targeting: singleEnemy, upgrade: { targeting: allEnemies } }),
    VIOLENCE: skill('VIOLENCE', 'Violence', 0, 'rare', c => `Move ${up(c, 3, 4)} random Attacks from your draw pile to hand.`, ctx => {
        const candidates = ctx.engine.state.player.drawPile.filter(c => resolveCard(c).type === 'attack'); ctx.engine.rng.shuffleInPlace(candidates)
        for (const card of candidates.slice(0, up(ctx.card, 3, 4))) ctx.engine.moveCardToDestination(card.instanceId, 'draw', 'hand')
    }, { exhaust: true }),
}
