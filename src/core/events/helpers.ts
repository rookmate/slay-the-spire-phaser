import { canRemoveCard, canUpgradeCard } from '../cards'
import type { RunState } from '../run'
import type { EventChoiceDef, EventDef, EventId } from './model'
export const choice = (id: string, label: string, description = '', extra: Partial<EventChoiceDef> = {}): EventChoiceDef => ({ id, label, description, ...extra })
export const leave = () => choice('LEAVE', 'Leave')
export const worse = (run: RunState, normal: number, asc: number) => run.asc >= 15 ? asc : normal
export const cost = (amount: number) => (run: RunState) => run.gold < amount
export const remove = (id: string, label: string, description = 'Remove 1 card.'): EventChoiceDef => choice(id, label, description, { requiresSelection: 'remove', disabled: run => !run.deck.some(canRemoveCard) })
export const upgrade = (id: string): EventChoiceDef => choice(id, 'Upgrade', 'Upgrade 1 card.', { requiresSelection: 'upgrade', disabled: run => !run.deck.some(canUpgradeCard) })
export const transform = (id: string): EventChoiceDef => choice(id, 'Transform', 'Transform 1 card.', { requiresSelection: 'transform', disabled: run => !run.deck.some(canRemoveCard) })
export const event = (id: EventId, title: string, body: string, choices: EventDef['choices'], eligible?: EventDef['eligible']): EventDef => ({ id, title, body, choices, eligible })
