import type { CardDef } from '../state'
import { canUpgradeCard, resolveCard } from '../cards'
import { scry } from '../combat/scry'
import { attackAmount } from './helpers'
import { attack, block, draw, energy, upgraded as up, allEnemies, defineAttack as card } from './builders'
export const WATCHER_ATTACKS: Record<string, CardDef> = {
    BOWLING_BASH: card('BOWLING_BASH', 'Bowling Bash', 1, 'common', 7, 10, { description: () => 'Hit this enemy once per living enemy.', onPlay: ctx => attack(ctx, up(ctx.card, 7, 10), ctx.engine.countLivingEnemies()) }),
    BRILLIANCE: card('BRILLIANCE', 'Brilliance', 1, 'rare', 12, 16, { description: () => 'Add damage equal to Mantra gained this combat.', onPlay: ctx => attack(ctx, up(ctx.card, 12, 16) + (ctx.engine.state.mantraGained ?? 0)) }),
    CARVE_REALITY: card('CARVE_REALITY', 'Carve Reality', 1, 'uncommon', 6, 10, { description: () => 'Add a Smite to your hand.', onPlay: ctx => { attack(ctx, up(ctx.card, 6, 10)); ctx.engine.createCardsInDestination('SMITE', 'hand') } }),
    CONCLUDE: card('CONCLUDE', 'Conclude', 1, 'uncommon', 12, 16, { targeting: allEnemies, description: () => 'End your turn.', onPlay: ctx => { attack(ctx, up(ctx.card, 12, 16)); ctx.engine.afterQueuedEffects(() => ctx.engine.requestEndTurn()) } }),
    CONSECRATE: card('CONSECRATE', 'Consecrate', 0, 'common', 5, 8, { targeting: allEnemies }),
    CRUSH_JOINTS: card('CRUSH_JOINTS', 'Crush Joints', 1, 'common', 8, 10, { description: c => `If the previous card was a Skill, apply ${up(c, 1, 2)} Vulnerable.`, onPlay: ctx => {
        attack(ctx, up(ctx.card, 8, 10)); if (ctx.engine.state.previousCardType === 'skill') ctx.engine.enqueue({ kind: 'ApplyPower', target: ctx.targets[0], powerId: 'VULNERABLE', stacks: up(ctx.card, 1, 2) })
    } }),
    CUT_THROUGH_FATE: card('CUT_THROUGH_FATE', 'Cut Through Fate', 1, 'common', 7, 9, { description: c => `Scry ${up(c, 2, 3)}. Draw 1.`, onPlay: ctx => {
        attack(ctx, up(ctx.card, 7, 9)); ctx.engine.afterQueuedEffects(() => scry(ctx.engine, up(ctx.card, 2, 3), ctx.card.instanceId)); draw(ctx, 1)
    } }),
    EMPTY_FIST: card('EMPTY_FIST', 'Empty Fist', 1, 'common', 9, 14, { description: () => 'Exit your stance.', onPlay: ctx => { attack(ctx, up(ctx.card, 9, 14)); ctx.engine.enqueue({ kind: 'ChangeStance', stance: 'neutral' }) } }),
    FEAR_NO_EVIL: card('FEAR_NO_EVIL', 'Fear No Evil', 1, 'uncommon', 8, 11, { description: () => 'If the enemy intends to attack, enter Calm.', onPlay: ctx => {
        attack(ctx, up(ctx.card, 8, 11)); const intent = ctx.engine.state.enemies.find(e => e.id === ctx.targets[0])?.intent
        if (intent?.kind === 'attack' || intent?.kind === 'multi_attack') ctx.engine.enqueue({ kind: 'ChangeStance', stance: 'calm' })
    } }),
    FLURRY_OF_BLOWS: card('FLURRY_OF_BLOWS', 'Flurry of Blows', 0, 'common', 4, 6, { description: () => 'Returns from discard when you change stance.' }),
    FLYING_SLEEVES: card('FLYING_SLEEVES', 'Flying Sleeves', 1, 'common', 4, 6, { retain: true, description: () => 'Hit twice.', onPlay: ctx => attack(ctx, up(ctx.card, 4, 6), 2) }),
    FOLLOW_UP: card('FOLLOW_UP', 'Follow-Up', 1, 'common', 7, 11, { description: () => 'Gain 1 Energy if the previous card was an Attack.', onPlay: ctx => { attack(ctx, up(ctx.card, 7, 11)); if (ctx.engine.state.previousCardType === 'attack') energy(ctx, 1) } }),
    JUST_LUCKY: card('JUST_LUCKY', 'Just Lucky', 0, 'common', 3, 4, { baseBlock: 2, upgrade: { baseBlock: 3, baseDamage: 4 }, description: c => `Scry ${up(c, 1, 2)} before gaining Block and dealing damage.`, onPlay: ctx => {
        ctx.engine.afterQueuedEffects(() => scry(ctx.engine, up(ctx.card, 1, 2), ctx.card.instanceId)); block(ctx, up(ctx.card, 2, 3)); attack(ctx, up(ctx.card, 3, 4))
    } }),
    LESSON_LEARNED: card('LESSON_LEARNED', 'Lesson Learned', 2, 'rare', 10, 13, { exhaust: true, description: () => 'If this kills a non-minion, permanently upgrade a random card in your deck.', onPlay: ctx => {
        const enemy = ctx.engine.state.enemies.find(e => e.id === ctx.targets[0])!, alive = enemy.hp > 0
        attack(ctx, up(ctx.card, 10, 13)); ctx.engine.afterQueuedEffects(() => {
            if (!alive || enemy.hp > 0 || enemy.halfDead || enemy.tags?.includes('minion')) return
            const cards = ctx.engine.run?.deck.filter(canUpgradeCard) ?? []; if (cards.length) cards[ctx.engine.rng.int(0, cards.length - 1)].upgradeLevel++
        })
    } }),
    RAGNAROK: card('RAGNAROK', 'Ragnarok', 3, 'rare', 5, 6, { targeting: { type: 'none' }, description: c => `Hit random enemies ${up(c, 5, 6)} times.`, onPlay: ctx => {
        for (let i = 0; i < up(ctx.card, 5, 6); i++) ctx.engine.enqueue({ kind: 'RandomAttack', source: ctx.source, amount: attackAmount(ctx.engine, ctx.card, up(ctx.card, 5, 6)), sourceCardInstanceId: ctx.card.instanceId })
    } }),
    REACH_HEAVEN: card('REACH_HEAVEN', 'Reach Heaven', 2, 'uncommon', 10, 15, { description: () => 'Shuffle a Through Violence into your draw pile.', onPlay: ctx => { attack(ctx, up(ctx.card, 10, 15)); ctx.engine.createCardsInDestination('THROUGH_VIOLENCE', 'drawPile') } }),
    SANDS_OF_TIME: card('SANDS_OF_TIME', 'Sands of Time', 4, 'uncommon', 20, 26, { retain: true, description: () => 'When retained, costs 1 less this combat.', onRetain: ({ card }) => { card.costForCombat = Math.max(0, (card.costForCombat ?? 4) - 1) } }),
    SASH_WHIP: card('SASH_WHIP', 'Sash Whip', 1, 'common', 8, 10, { description: c => `If the previous card was an Attack, apply ${up(c, 1, 2)} Weak.`, onPlay: ctx => {
        attack(ctx, up(ctx.card, 8, 10)); if (ctx.engine.state.previousCardType === 'attack') ctx.engine.enqueue({ kind: 'ApplyPower', target: ctx.targets[0], powerId: 'WEAK', stacks: up(ctx.card, 1, 2) })
    } }),
    SIGNATURE_MOVE: card('SIGNATURE_MOVE', 'Signature Move', 2, 'uncommon', 30, 40, { description: () => 'Playable only if there are no other Attacks in hand.', canPlay: ({ engine, card }) => !engine.state.player.hand.some(c => c.instanceId !== card.instanceId && resolveCard(c).type === 'attack') }),
    TALK_TO_THE_HAND: card('TALK_TO_THE_HAND', 'Talk to the Hand', 1, 'uncommon', 5, 7, { exhaust: true, description: c => `Gain ${up(c, 2, 3)} Block each time you attack this enemy afterward.`, onPlay: ctx => { attack(ctx, up(ctx.card, 5, 7)); ctx.engine.enqueue({ kind: 'ApplyPower', target: ctx.targets[0], powerId: 'TALK_TO_THE_HAND', stacks: up(ctx.card, 2, 3) }) } }),
    TANTRUM: card('TANTRUM', 'Tantrum', 1, 'uncommon', 3, 3, { resolveDestination: 'drawPile', description: c => `Hit ${up(c, 3, 4)} times. Enter Wrath. Shuffle this card into your draw pile.`, onPlay: ctx => { attack(ctx, 3, up(ctx.card, 3, 4)); ctx.engine.enqueue({ kind: 'ChangeStance', stance: 'wrath' }) } }),
    WALLOP: card('WALLOP', 'Wallop', 2, 'uncommon', 9, 12, { description: () => 'Gain Block equal to HP damage dealt.', onPlay: ctx => ctx.engine.enqueue({ kind: 'DealDamage', source: ctx.source, target: ctx.targets[0], amount: attackAmount(ctx.engine, ctx.card, up(ctx.card, 9, 12)), blockOnDamage: true }) }),
    WEAVE: card('WEAVE', 'Weave', 0, 'uncommon', 4, 6, { description: () => 'Returns from discard when you Scry.' }),
    WHEEL_KICK: card('WHEEL_KICK', 'Wheel Kick', 2, 'uncommon', 15, 20, { description: () => 'Draw 2.', onPlay: ctx => { attack(ctx, up(ctx.card, 15, 20)); draw(ctx, 2) } }),
    WINDMILL_STRIKE: card('WINDMILL_STRIKE', 'Windmill Strike', 2, 'uncommon', 7, 10, { retain: true, description: c => `When retained, gains ${up(c, 4, 5)} damage this combat.`, onRetain: ({ engine, card }) => { engine.modifyCardCombatBonusDamage(card.instanceId, up(card, 4, 5)) } }),
}
