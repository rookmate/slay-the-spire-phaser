import { createCombatCard } from '../combat/cardCreation'
import type { CardDef } from '../state'
import { CARD_DEFS, createCardInstance } from '../cards'
import { powerAmount, HAND_LIMIT } from '../combatMath'
import { selectCombatCardPool } from '../contentPools'
import { offerCards } from '../combat/choices'
import { scry } from '../combat/scry'
import { chooseOneCard } from './helpers'
import { block, draw, upgraded as up, singleEnemy, defineSkill as skill, type PlayContext } from './builders'
const stance = (ctx: PlayContext, stance: 'calm' | 'wrath' | 'neutral' | 'divinity') => ctx.engine.enqueue({ kind: 'ChangeStance', stance })
const mantra = (ctx: PlayContext, count: number) => ctx.engine.applyPowerToPlayer('MANTRA', count)
export const WATCHER_SKILLS: Record<string, CardDef> = {
    ALPHA: skill('ALPHA', 'Alpha', 1, 'rare', () => 'Shuffle a Beta into your draw pile.', ctx => { ctx.engine.createCardsInDestination('BETA', 'drawPile') }, { exhaust: true, upgrade: { innate: true } }),
    BLASPHEMY: skill('BLASPHEMY', 'Blasphemy', 1, 'rare', () => 'Enter Divinity. Die at the start of your next turn.', ctx => { stance(ctx, 'divinity'); ctx.engine.applyPowerToPlayer('BLASPHEMER', 1) }, { exhaust: true, upgrade: { retain: true } }),
    COLLECT: skill('COLLECT', 'Collect', 0, 'uncommon', c => `Add a Miracle+ to your hand at the start of the next X${c.upgradeLevel ? '+1' : ''} turns.`, ctx => ctx.engine.applyPowerToPlayer('COLLECT', ctx.spentEnergy + up(ctx.card, 0, 1)), { xCost: true, exhaust: true }),
    CONJURE_BLADE: skill('CONJURE_BLADE', 'Conjure Blade', 0, 'rare', c => `Shuffle an Expunger with X${c.upgradeLevel ? '+1' : ''} hits into your draw pile.`, ctx => {
        const [created] = ctx.engine.createCardsInDestination('EXPUNGER', 'drawPile'); created.storedHits = ctx.spentEnergy + up(ctx.card, 0, 1)
    }, { xCost: true, exhaust: true }),
    CRESCENDO: skill('CRESCENDO', 'Crescendo', 1, 'common', () => 'Enter Wrath.', ctx => stance(ctx, 'wrath'), { retain: true, exhaust: true, upgrade: { cost: 0 } }),
    DECEIVE_REALITY: skill('DECEIVE_REALITY', 'Deceive Reality', 1, 'uncommon', () => 'Add a Safety to your hand.', ctx => { block(ctx, up(ctx.card, 4, 7)); ctx.engine.createCardsInDestination('SAFETY', 'hand') }, { baseBlock: 4, upgrade: { baseBlock: 7 } }),
    DEUS_EX_MACHINA: skill('DEUS_EX_MACHINA', 'Deus Ex Machina', 0, 'rare', c => `When drawn, exhaust this and add ${up(c, 2, 3)} Miracles to your hand.`, undefined, { unplayable: true, onDraw: ({ engine, card }) => {
        engine.afterQueuedEffects(() => { engine.handleExhaustFromHand(card); engine.createCardsInDestination('MIRACLE', 'hand', up(card, 2, 3)) })
    } }),
    EMPTY_BODY: skill('EMPTY_BODY', 'Empty Body', 1, 'common', () => 'Exit your stance.', ctx => { block(ctx, up(ctx.card, 7, 10)); stance(ctx, 'neutral') }, { baseBlock: 7, upgrade: { baseBlock: 10 } }),
    EMPTY_MIND: skill('EMPTY_MIND', 'Empty Mind', 1, 'uncommon', c => `Draw ${up(c, 2, 3)}. Exit your stance.`, ctx => { draw(ctx, up(ctx.card, 2, 3)); stance(ctx, 'neutral') }),
    EVALUATE: skill('EVALUATE', 'Evaluate', 1, 'common', () => 'Shuffle an Insight into your draw pile.', ctx => { block(ctx, up(ctx.card, 6, 10)); ctx.engine.createCardsInDestination('INSIGHT', 'drawPile') }, { baseBlock: 6, upgrade: { baseBlock: 10 } }),
    FOREIGN_INFLUENCE: skill('FOREIGN_INFLUENCE', 'Foreign Influence', 0, 'uncommon', c => `Choose 1 of 3 Attacks from any color.${c.upgradeLevel ? ' It costs 0 this turn.' : ''}`, ctx => ctx.engine.afterQueuedEffects(() => {
        const pool = selectCombatCardPool(ctx.engine, { source: 'any_generated', type: 'attack' }); ctx.engine.rng.shuffleInPlace(pool)
        offerCards(ctx.engine, pool.slice(0, 3).map(id => createCardInstance(id)), ctx.card.instanceId, chosen => {
            if (ctx.card.upgradeLevel) chosen.costForTurn = 0
            ctx.engine.insertCard(createCombatCard(ctx.engine, chosen), 'hand')
        })
    }), { exhaust: true }),
    HALT: skill('HALT', 'Halt', 0, 'common', c => `Gain ${up(c, 3, 4)} Block. In Wrath, gain ${up(c, 9, 14)} additional Block.`, ctx => { block(ctx, up(ctx.card, 3, 4)); if (ctx.engine.state.player.stance === 'wrath') block(ctx, up(ctx.card, 9, 14)) }),
    INDIGNATION: skill('INDIGNATION', 'Indignation', 1, 'uncommon', c => `In Wrath, apply ${up(c, 3, 5)} Vulnerable to all enemies. Otherwise enter Wrath.`, ctx => {
        if (ctx.engine.state.player.stance !== 'wrath') stance(ctx, 'wrath')
        else for (const enemy of ctx.engine.state.enemies.filter(e => e.hp > 0)) ctx.engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'VULNERABLE', stacks: up(ctx.card, 3, 5) })
    }),
    INNER_PEACE: skill('INNER_PEACE', 'Inner Peace', 1, 'uncommon', c => `In Calm, draw ${up(c, 3, 4)}. Otherwise enter Calm.`, ctx => { if (ctx.engine.state.player.stance === 'calm') draw(ctx, up(ctx.card, 3, 4)); else stance(ctx, 'calm') }),
    JUDGMENT: skill('JUDGMENT', 'Judgment', 1, 'rare', c => `If the enemy has at most ${up(c, 30, 40)} HP, set its HP to 0.`, ctx => {
        const enemy = ctx.engine.state.enemies.find(e => e.id === ctx.targets[0]); if (!enemy || enemy.hp > up(ctx.card, 30, 40)) return
        ctx.engine.enqueue({ kind: 'SetHp', target: enemy.id, hp: 0 })
    }, { targeting: singleEnemy }),
    MEDITATE: skill('MEDITATE', 'Meditate', 1, 'uncommon', c => `Return ${up(c, 1, 2)} cards from discard and retain them. Enter Calm. End your turn.`, ctx => {
        ctx.engine.afterQueuedEffects(() => {
            const cards = ctx.engine.state.player.discardPile, count = Math.min(cards.length, up(ctx.card, 1, 2)); if (!count) return
            ctx.engine.beginChoice({ zone: 'discard', prompt: `Return ${count} cards`, sourceCardInstanceId: ctx.card.instanceId, eligibleInstanceIds: cards.map(c => c.instanceId), minSelections: count, maxSelections: count, canSkip: false,
                onSubmit: ids => { for (const id of ids) { const card = ctx.engine.moveCardToDestination(id, 'discard', 'hand'); if (card) card.retained = true } } })
        }); stance(ctx, 'calm'); ctx.engine.afterQueuedEffects(() => ctx.engine.requestEndTurn())
    }),
    OMNISCIENCE: skill('OMNISCIENCE', 'Omniscience', 4, 'rare', () => 'Choose a card from your draw pile. Play it twice, then exhaust it.', ctx => ctx.engine.afterQueuedEffects(() => {
        chooseOneCard(ctx.engine, { card: ctx.card, zone: 'draw', prompt: 'Play a card twice', eligibleInstanceIds: ctx.engine.state.player.drawPile.map(c => c.instanceId), onSubmit: id => {
            ctx.engine.enqueue({ kind: 'AutoPlayCard', cardInstanceId: id, zone: 'draw', repeats: 2, exhaust: true, allowPendingTurnEnd: true })
        } })
    }), { exhaust: true, upgrade: { cost: 3 } }),
    PERSEVERANCE: skill('PERSEVERANCE', 'Perseverance', 1, 'uncommon', c => `Gain ${up(c, 5, 7)} Block. Gains ${up(c, 2, 3)} Block when retained.`, ctx => block(ctx, up(ctx.card, 5, 7) + (ctx.engine.getCombatCardRuntime(ctx.card.instanceId).bonusBlock ?? 0)), {
        retain: true, onRetain: ({ engine, card }) => { const runtime = engine.getCombatCardRuntime(card.instanceId); runtime.bonusBlock = (runtime.bonusBlock ?? 0) + up(card, 2, 3) }
    }),
    PRAY: skill('PRAY', 'Pray', 1, 'uncommon', c => `Gain ${up(c, 3, 4)} Mantra. Shuffle an Insight into your draw pile.`, ctx => { mantra(ctx, up(ctx.card, 3, 4)); ctx.engine.createCardsInDestination('INSIGHT', 'drawPile') }),
    PRESSURE_POINTS: skill('PRESSURE_POINTS', 'Pressure Points', 1, 'common', c => `Apply ${up(c, 8, 11)} Mark. All enemies lose HP equal to their Mark.`, ctx => {
        ctx.engine.enqueue({ kind: 'ApplyPower', target: ctx.targets[0], powerId: 'MARK', stacks: up(ctx.card, 8, 11) })
        ctx.engine.afterQueuedEffects(() => { for (const enemy of ctx.engine.state.enemies.filter(e => e.hp > 0)) ctx.engine.enqueue({ kind: 'LoseHp', target: enemy.id, amount: powerAmount(enemy, 'MARK'), fromCard: false }) })
    }, { targeting: singleEnemy }),
    PROSTRATE: skill('PROSTRATE', 'Prostrate', 0, 'common', c => `Gain ${up(c, 2, 3)} Mantra.`, ctx => { mantra(ctx, up(ctx.card, 2, 3)); block(ctx, 4) }, { baseBlock: 4 }),
    PROTECT: skill('PROTECT', 'Protect', 2, 'common', undefined, ctx => block(ctx, up(ctx.card, 12, 16)), { retain: true, baseBlock: 12, upgrade: { baseBlock: 16 } }),
    SANCTITY: skill('SANCTITY', 'Sanctity', 1, 'uncommon', () => 'If the previous card was a Skill, draw 2.', ctx => { block(ctx, up(ctx.card, 6, 9)); if (ctx.engine.state.previousCardType === 'skill') draw(ctx, 2) }, { baseBlock: 6, upgrade: { baseBlock: 9 } }),
    SCRAWL: skill('SCRAWL', 'Scrawl', 1, 'rare', () => 'Draw until your hand is full.', ctx => draw(ctx, HAND_LIMIT - ctx.engine.state.player.hand.length), { exhaust: true, upgrade: { cost: 0 } }),
    SIMMERING_FURY: skill('SIMMERING_FURY', 'Simmering Fury', 1, 'uncommon', c => `Next turn, enter Wrath and draw ${up(c, 2, 3)}.`, ctx => ctx.engine.applyPowerToPlayer('SIMMERING_FURY', up(ctx.card, 2, 3))),
    SPIRIT_SHIELD: skill('SPIRIT_SHIELD', 'Spirit Shield', 2, 'rare', c => `Gain ${up(c, 3, 4)} Block per card in hand.`, ctx => block(ctx, up(ctx.card, 3, 4) * ctx.engine.state.player.hand.length)),
    SWIVEL: skill('SWIVEL', 'Swivel', 2, 'uncommon', () => 'Your next Attack costs 0.', ctx => { block(ctx, up(ctx.card, 8, 11)); ctx.engine.applyPowerToPlayer('FREE_ATTACK', 1) }, { baseBlock: 8, upgrade: { baseBlock: 11 } }),
    THIRD_EYE: skill('THIRD_EYE', 'Third Eye', 1, 'common', c => `Scry ${up(c, 3, 5)}.`, ctx => { block(ctx, up(ctx.card, 7, 9)); ctx.engine.afterQueuedEffects(() => scry(ctx.engine, up(ctx.card, 3, 5), ctx.card.instanceId)) }, { baseBlock: 7, upgrade: { baseBlock: 9 } }),
    TRANQUILITY: skill('TRANQUILITY', 'Tranquility', 1, 'common', () => 'Enter Calm.', ctx => stance(ctx, 'calm'), { retain: true, exhaust: true, upgrade: { cost: 0 } }),
    VAULT: skill('VAULT', 'Vault', 3, 'rare', () => 'End your turn and take another before enemies act.', ctx => { ctx.engine.state.extraTurn = true; ctx.engine.requestEndTurn() }, { exhaust: true, upgrade: { cost: 2 } }),
    WAVE_OF_THE_HAND: skill('WAVE_OF_THE_HAND', 'Wave of the Hand', 1, 'uncommon', c => `Whenever you gain Block this turn, apply ${up(c, 1, 2)} Weak to all enemies.`, ctx => ctx.engine.applyPowerToPlayer('WAVE_OF_THE_HAND', up(ctx.card, 1, 2))),
    WISH: skill('WISH', 'Wish', 3, 'rare', c => `Choose ${up(c, 6, 8)} Plated Armor, ${up(c, 3, 4)} Strength, or ${up(c, 25, 30)} Gold.`, ctx => ctx.engine.afterQueuedEffects(() => {
        const cards = ['LIVE_FOREVER', 'BECOME_ALMIGHTY', 'FAME_AND_FORTUNE'].map(id => createCardInstance(id, ctx.card.upgradeLevel))
        offerCards(ctx.engine, cards, ctx.card.instanceId, card => CARD_DEFS[card.defId].onPlay!({ ...ctx, card }), false)
    }), { exhaust: true }),
    WORSHIP: skill('WORSHIP', 'Worship', 2, 'uncommon', () => 'Gain 5 Mantra.', ctx => mantra(ctx, 5), { upgrade: { retain: true } }),
    WREATH_OF_FLAME: skill('WREATH_OF_FLAME', 'Wreath of Flame', 1, 'uncommon', c => `Your next Attack deals ${up(c, 5, 8)} extra damage.`, ctx => ctx.engine.applyPowerToPlayer('WREATH_OF_FLAME', up(ctx.card, 5, 8))),
}
