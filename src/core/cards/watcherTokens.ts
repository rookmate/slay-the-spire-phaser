import type { CardDef } from '../state'
import { attack, block, draw, upgraded as up, defineAttack, defineSkill, definePower } from './builders'
const tokens: Record<string, CardDef> = {
    CALM: defineSkill('CALM', 'Calm', 0, undefined, () => 'Enter Calm.', ctx => ctx.engine.enqueue({ kind: 'ChangeStance', stance: 'calm' })),
    WRATH: defineSkill('WRATH', 'Wrath', 0, undefined, () => 'Enter Wrath.', ctx => ctx.engine.enqueue({ kind: 'ChangeStance', stance: 'wrath' })),
    SMITE: defineAttack('SMITE', 'Smite', 1, undefined, 12, 16, { retain: true, exhaust: true }),
    SAFETY: defineSkill('SAFETY', 'Safety', 1, undefined, undefined, ctx => block(ctx, up(ctx.card, 12, 16)), { baseBlock: 12, upgrade: { baseBlock: 16 }, retain: true, exhaust: true }),
    INSIGHT: defineSkill('INSIGHT', 'Insight', 0, undefined, c => `Draw ${up(c, 2, 3)}.`, ctx => draw(ctx, up(ctx.card, 2, 3)), { retain: true, exhaust: true }),
    THROUGH_VIOLENCE: defineAttack('THROUGH_VIOLENCE', 'Through Violence', 0, undefined, 20, 30, { retain: true, exhaust: true }),
    BETA: defineSkill('BETA', 'Beta', 2, undefined, () => 'Shuffle an Omega into your draw pile.', ctx => { ctx.engine.createCardsInDestination('OMEGA', 'drawPile') }, { exhaust: true, upgrade: { cost: 1 } }),
    OMEGA: definePower('OMEGA', 'Omega', 3, undefined, 'OMEGA', 50, 60, c => `Deal ${up(c, 50, 60)} damage to all enemies at each turn end.`),
    EXPUNGER: defineAttack('EXPUNGER', 'Expunger', 1, undefined, 9, 15, { description: c => `Hit ${c.storedHits ?? 0} times.`, onPlay: ctx => attack(ctx, up(ctx.card, 9, 15), ctx.card.storedHits ?? 0) }),
    BECOME_ALMIGHTY: defineSkill('BECOME_ALMIGHTY', 'Become Almighty', 0, undefined, c => `Gain ${up(c, 3, 4)} Strength.`, ctx => ctx.engine.applyPowerToPlayer('STRENGTH', up(ctx.card, 3, 4))),
    FAME_AND_FORTUNE: defineSkill('FAME_AND_FORTUNE', 'Fame and Fortune', 0, undefined, c => `Gain ${up(c, 25, 30)} Gold.`, ctx => { ctx.engine.changeGold(up(ctx.card, 25, 30)) }),
    LIVE_FOREVER: defineSkill('LIVE_FOREVER', 'Live Forever', 0, undefined, c => `Gain ${up(c, 6, 8)} Plated Armor.`, ctx => ctx.engine.applyPowerToPlayer('PLATED_ARMOR', up(ctx.card, 6, 8))),
}
export const WATCHER_TOKENS: Record<string, CardDef> = Object.fromEntries(Object.entries(tokens).map(([id, card]) => [id, { ...card, color: 'colorless', poolEnabled: false }]))
