import type { CardDef } from '../state'
import { resolveCard } from '../cards'
import { attackAmount } from './helpers'
import { attack, draw, energy, upgraded as up, allEnemies, defineAttack as card } from './builders'
export const DEFECT_ATTACKS: Record<string, CardDef> = {
    ALL_FOR_ONE: card('ALL_FOR_ONE', 'All for One', 2, 'rare', 10, 14, { description: () => 'Return cost 0 cards from discard to your hand.', onPlay: ctx => {
        attack(ctx, up(ctx.card, 10, 14)); ctx.engine.afterQueuedEffects(() => {
            for (const c of [...ctx.engine.state.player.discardPile]) if (!resolveCard(c).xCost && !resolveCard(c).unplayable && ctx.engine.getCardCost(c) === 0) ctx.engine.moveCardToDestination(c.instanceId, 'discard', 'hand')
        })
    } }),
    BALL_LIGHTNING: card('BALL_LIGHTNING', 'Ball Lightning', 1, 'common', 7, 10, { description: () => 'Channel 1 Lightning.', onPlay: ctx => { attack(ctx, up(ctx.card, 7, 10)); ctx.engine.enqueue({ kind: 'ChannelOrb', orbType: 'lightning' }) } }),
    BARRAGE: card('BARRAGE', 'Barrage', 1, 'common', 4, 6, { description: () => 'Hit once for each orb you have.', onPlay: ctx => attack(ctx, up(ctx.card, 4, 6), ctx.engine.state.player.orbs.length) }),
    BEAM_CELL: card('BEAM_CELL', 'Beam Cell', 0, 'common', 3, 4, { description: c => `Apply ${up(c, 1, 2)} Vulnerable.`, onPlay: ctx => { attack(ctx, up(ctx.card, 3, 4)); ctx.engine.enqueue({ kind: 'ApplyPower', target: ctx.targets[0], powerId: 'VULNERABLE', stacks: up(ctx.card, 1, 2) }) } }),
    BLIZZARD: card('BLIZZARD', 'Blizzard', 1, 'uncommon', 0, 0, { targeting: allEnemies, description: c => `Deal ${up(c, 2, 3)} damage per Frost channeled this combat to all enemies.`, onPlay: ctx => attack(ctx, up(ctx.card, 2, 3) * ctx.engine.state.orbsChanneled.frost) }),
    BULLSEYE: card('BULLSEYE', 'Bullseye', 1, 'uncommon', 8, 11, { description: c => `Apply ${up(c, 2, 3)} Lock-On.`, onPlay: ctx => { attack(ctx, up(ctx.card, 8, 11)); ctx.engine.enqueue({ kind: 'ApplyPower', target: ctx.targets[0], powerId: 'LOCK_ON', stacks: up(ctx.card, 2, 3) }) } }),
    CLAW: card('CLAW', 'Claw', 0, 'common', 3, 5, { description: () => 'Increase all existing Claw cards by 2 damage this combat.', onPlay: ctx => {
        attack(ctx, up(ctx.card, 3, 5)); ctx.engine.afterQueuedEffects(() => {
            const p = ctx.engine.state.player
            const cards = [...p.hand, ...p.drawPile, ...p.discardPile, ...p.exhaustPile, ctx.card]
            for (const c of cards) if (c.defId === 'CLAW') ctx.engine.modifyCardCombatBonusDamage(c.instanceId, 2)
        })
    } }),
    COLD_SNAP: card('COLD_SNAP', 'Cold Snap', 1, 'common', 6, 9, { description: () => 'Channel 1 Frost.', onPlay: ctx => { attack(ctx, up(ctx.card, 6, 9)); ctx.engine.enqueue({ kind: 'ChannelOrb', orbType: 'frost' }) } }),
    COMPILE_DRIVER: card('COMPILE_DRIVER', 'Compile Driver', 1, 'common', 7, 10, { description: () => 'Draw 1 for each different orb type you have.', onPlay: ctx => { attack(ctx, up(ctx.card, 7, 10)); draw(ctx, new Set(ctx.engine.state.player.orbs.map(o => o.type)).size) } }),
    CORE_SURGE: card('CORE_SURGE', 'Core Surge', 1, 'rare', 11, 15, { exhaust: true, description: () => 'Gain 1 Artifact.', onPlay: ctx => { attack(ctx, up(ctx.card, 11, 15)); ctx.engine.applyPowerToPlayer('ARTIFACT', 1) } }),
    DOOM_AND_GLOOM: card('DOOM_AND_GLOOM', 'Doom and Gloom', 2, 'uncommon', 10, 14, { targeting: allEnemies, description: () => 'Channel 1 Dark.', onPlay: ctx => { attack(ctx, up(ctx.card, 10, 14)); ctx.engine.enqueue({ kind: 'ChannelOrb', orbType: 'dark' }) } }),
    FTL: card('FTL', 'FTL', 0, 'uncommon', 5, 6, { description: c => `If fewer than ${up(c, 3, 4)} cards were played before this, draw 1.`, onPlay: ctx => { attack(ctx, up(ctx.card, 5, 6)); if ((ctx.engine.state.cardsPlayed ?? 1) - 1 < up(ctx.card, 3, 4)) draw(ctx, 1) } }),
    GO_FOR_THE_EYES: card('GO_FOR_THE_EYES', 'Go for the Eyes', 0, 'common', 3, 4, { description: c => `If the enemy intends to attack, apply ${up(c, 1, 2)} Weak.`, onPlay: ctx => {
        attack(ctx, up(ctx.card, 3, 4)); const intent = ctx.engine.state.enemies.find(e => e.id === ctx.targets[0])?.intent
        if (intent?.kind === 'attack' || intent?.kind === 'multi_attack') ctx.engine.enqueue({ kind: 'ApplyPower', target: ctx.targets[0], powerId: 'WEAK', stacks: up(ctx.card, 1, 2) })
    } }),
    HYPERBEAM: card('HYPERBEAM', 'Hyperbeam', 2, 'rare', 26, 34, { targeting: allEnemies, description: () => 'Lose 3 Focus.', onPlay: ctx => { attack(ctx, up(ctx.card, 26, 34)); ctx.engine.applyPowerToPlayer('FOCUS', -3) } }),
    MELTER: card('MELTER', 'Melter', 1, 'uncommon', 10, 14, { description: () => 'Remove the enemy\'s Block before damage.', onPlay: ctx => { const target = ctx.engine.getEntity(ctx.targets[0]); if (target) target.block = 0; attack(ctx, up(ctx.card, 10, 14)) } }),
    METEOR_STRIKE: card('METEOR_STRIKE', 'Meteor Strike', 5, 'rare', 24, 30, { description: () => 'Channel 3 Plasma.', onPlay: ctx => { attack(ctx, up(ctx.card, 24, 30)); for (let i = 0; i < 3; i++) ctx.engine.enqueue({ kind: 'ChannelOrb', orbType: 'plasma' }) } }),
    REBOUND: card('REBOUND', 'Rebound', 1, 'common', 9, 12, { description: () => 'The next card you play this turn returns to the top of your draw pile.', onPlay: ctx => { attack(ctx, up(ctx.card, 9, 12)); ctx.engine.applyPowerToPlayer('REBOUND', 1) } }),
    RIP_AND_TEAR: card('RIP_AND_TEAR', 'Rip and Tear', 1, 'uncommon', 7, 9, { targeting: { type: 'none' }, description: () => 'Hit random enemies twice.', onPlay: ctx => { for (let i = 0; i < 2; i++) ctx.engine.enqueue({ kind: 'RandomAttack', source: ctx.source, amount: attackAmount(ctx.engine, ctx.card, up(ctx.card, 7, 9)), sourceCardInstanceId: ctx.card.instanceId }) } }),
    SCRAPE: card('SCRAPE', 'Scrape', 1, 'uncommon', 7, 10, { description: c => `Draw ${up(c, 4, 5)}. Discard drawn cards that do not cost 0.`, onPlay: ctx => {
        attack(ctx, up(ctx.card, 7, 10)); const original = new Set(ctx.engine.state.player.hand.map(c => c.instanceId)); draw(ctx, up(ctx.card, 4, 5))
        ctx.engine.afterQueuedEffects(() => ctx.engine.discardCards(ctx.engine.state.player.hand.filter(c => !original.has(c.instanceId) && (resolveCard(c).unplayable || resolveCard(c).xCost || ctx.engine.getCardCost(c) !== 0)).map(c => c.instanceId)))
    } }),
    STREAMLINE: card('STREAMLINE', 'Streamline', 2, 'common', 15, 20, { description: () => 'This card costs 1 less this combat.', onPlay: ctx => { attack(ctx, up(ctx.card, 15, 20)); ctx.card.costForCombat = Math.max(0, (ctx.card.costForCombat ?? 2) - 1) } }),
    SUNDER: card('SUNDER', 'Sunder', 3, 'uncommon', 24, 32, { description: () => 'Gain 3 Energy if this kills an enemy.', onPlay: ctx => {
        const enemy = ctx.engine.state.enemies.find(e => e.id === ctx.targets[0])!; const alive = enemy.hp > 0
        attack(ctx, up(ctx.card, 24, 32)); ctx.engine.afterQueuedEffects(() => { if (alive && enemy.hp <= 0 && !enemy.halfDead) energy(ctx, 3) })
    } }),
    SWEEPING_BEAM: card('SWEEPING_BEAM', 'Sweeping Beam', 1, 'common', 6, 9, { targeting: allEnemies, description: () => 'Draw 1.', onPlay: ctx => { attack(ctx, up(ctx.card, 6, 9)); draw(ctx, 1) } }),
    THUNDER_STRIKE: card('THUNDER_STRIKE', 'Thunder Strike', 3, 'rare', 7, 9, { targeting: { type: 'none' }, description: () => 'Hit a random enemy for each Lightning channeled this combat.', onPlay: ctx => {
        for (let i = 0; i < ctx.engine.state.orbsChanneled.lightning; i++) ctx.engine.enqueue({ kind: 'RandomAttack', source: ctx.source, amount: attackAmount(ctx.engine, ctx.card, up(ctx.card, 7, 9)), sourceCardInstanceId: ctx.card.instanceId })
    } }),
}
