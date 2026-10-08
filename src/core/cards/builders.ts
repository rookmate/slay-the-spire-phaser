import { attackAmount } from './helpers'
import type { CardDef, CardInstance } from '../state'
export type PlayContext = Parameters<NonNullable<CardDef['onPlay']>>[0]
export const upgraded = (card: CardInstance, base: number, plus: number): number => card.upgradeLevel > 0 ? plus : base
export const singleEnemy = { type: 'single_enemy' as const, required: true }
export const allEnemies = { type: 'all_enemies' as const }

export function attack(ctx: PlayContext, amount: number, hits = 1, targets = ctx.targets): void {
    for (const target of targets) ctx.engine.enqueue({ kind: 'DealMultiDamage', source: ctx.source, target,
        amount: attackAmount(ctx.engine, ctx.card, amount), hits, sourceCardInstanceId: ctx.card.instanceId })
}
export function block(ctx: PlayContext, amount: number): void {
    ctx.engine.enqueue({ kind: 'GainBlock', target: ctx.source, amount, blockSource: 'card' })
}
export function draw(ctx: PlayContext, count: number): void { ctx.engine.enqueue({ kind: 'DrawCards', count }) }
export function energy(ctx: PlayContext, amount: number): void { ctx.engine.enqueue({ kind: 'GainEnergy', amount }) }

export function defineAttack(id: string, name: string, cost: number, rarity: CardDef['rarity'], damage: number, plus: number, extra: Partial<CardDef> = {}): CardDef {
    return { id, name, cost, rarity, type: 'attack', baseDamage: damage, upgrade: { baseDamage: plus }, targeting: singleEnemy,
        onPlay: ctx => attack(ctx, upgraded(ctx.card, damage, plus)), ...extra }
}
export function defineSkill(id: string, name: string, cost: number, rarity: CardDef['rarity'], description: CardDef['description'], onPlay: CardDef['onPlay'], extra: Partial<CardDef> = {}): CardDef {
    return { id, name, cost, rarity, type: 'skill', description, onPlay, ...extra }
}
export function definePower(id: string, name: string, cost: number, rarity: CardDef['rarity'], powerId: import('../state').PowerId, amount: number, plus: number, description: CardDef['description'], extra: Partial<CardDef> = {}): CardDef {
    return { id, name, cost, rarity, type: 'power', description, onPlay: ({ engine, card }) => engine.applyPowerToPlayer(powerId, upgraded(card, amount, plus)), ...extra }
}
