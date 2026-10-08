import type { CardDef } from '../state'
import { attack, upgraded as up, defineAttack, defineSkill } from './builders'
const cards: Record<string, CardDef> = {
    APPARITION: defineSkill('APPARITION', 'Apparition', 1, undefined, () => 'Gain 1 Intangible.', ctx => ctx.engine.applyPowerToPlayer('INTANGIBLE', 1), { exhaust: true, ethereal: true, upgrade: { ethereal: false } }),
    BITE: defineAttack('BITE', 'Bite', 1, undefined, 7, 8, { description: c => `Heal ${up(c, 2, 3)} HP.`, onPlay: ctx => { attack(ctx, up(ctx.card, 7, 8)); ctx.engine.enqueue({ kind: 'Heal', target: ctx.source, amount: up(ctx.card, 2, 3) }) } }),
    JAX: defineSkill('JAX', 'J.A.X.', 0, undefined, c => `Lose 3 HP. Gain ${up(c, 2, 3)} Strength.`, ctx => { ctx.engine.enqueue({ kind: 'LoseHp', target: ctx.source, amount: 3 }); ctx.engine.applyPowerToPlayer('STRENGTH', up(ctx.card, 2, 3)) }),
    RITUAL_DAGGER: defineAttack('RITUAL_DAGGER', 'Ritual Dagger', 1, undefined, 15, 15, { exhaust: true, description: c => `If Fatal, permanently gain ${up(c, 3, 5)} damage.`, onPlay: ctx => attack(ctx, ctx.card.permanentDamage ?? 15), onFatal: ({ engine, card }) => {
        card.permanentDamage = (card.permanentDamage ?? 15) + up(card, 3, 5)
        const original = engine.run?.deck.find(c => c.instanceId === card.instanceId)
        if (original) original.permanentDamage = card.permanentDamage
    } }),
}
export const EVENT_CARDS: Record<string, CardDef> = Object.fromEntries(Object.entries(cards).map(([id, card]) => [id, { ...card, color: 'colorless', poolEnabled: false }]))
