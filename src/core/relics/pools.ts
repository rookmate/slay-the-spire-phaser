import { hasModifier } from '../modes/modifiers'
import { canRemoveCard, resolveCard } from '../cards'
import { createDefaultMeta, type MetaState } from '../meta'
import { getUnlockedRelicPool, RELIC_DEFS, type RelicDef } from '../relics'
import type { RNG } from '../rng'
import type { RelicId, RunState } from '../run'

type RelicRun = Pick<RunState, 'relics'> & Partial<RunState>
const restRelics: RelicId[] = ['GIRYA', 'SHOVEL', 'PEACE_PIPE']
const floorLimits: Partial<Record<RelicId, number>> = {
    TINY_CHEST: 35, MATRYOSHKA: 40, WING_BOOTS: 40, ECTOPLASM: 17,
    ANCIENT_TEA_SET: 48, CERAMIC_FISH: 48, COURIER: 48, DARKSTONE_PERIAPT: 48, DREAM_CATCHER: 48,
    FROZEN_EGG: 48, MOLTEN_EGG: 48, TOXIC_EGG: 48, JUZU_BRACELET: 48, MAW_BANK: 48, MEAL_TICKET: 48,
    MEAT_ON_THE_BONE: 48, OLD_COIN: 48, OMAMORI: 48, POTION_BELT: 48, PRAYER_WHEEL: 48,
    PEACE_PIPE: 48, SHOVEL: 48, PRESERVED_INSECT: 52, QUESTION_CARD: 48, REGAL_PILLOW: 48, SINGING_BOWL: 48, SMILING_MASK: 48, GIRYA: 48,
}
export function eligibleRelic(run: RelicRun, id: RelicId): boolean {
    const def = RELIC_DEFS[id]
    if (id === 'PRISMATIC_SHARD' && hasModifier(run, 'DIVERSE')) return false
    if (id === 'PANDORAS_BOX' && ['DRAFT', 'SEALED_DECK', 'SHINY', 'INSANITY'].some(mod => run.modifiers?.includes(mod as import('../modes/modifiers').ModifierId))) return false
    if (run.relics.includes(id) || run.seenRelics?.includes(id)) return false
    if (def.character && def.character !== (run.character ?? 'ironclad')) return false
    if (def.replaces && !run.relics.includes(def.replaces)) return false
    if ((run.floor ?? 1) > (floorLimits[id] ?? Infinity)) return false
    if (restRelics.includes(id) && restRelics.filter(relic => run.relics.includes(relic)).length >= 2) return false
    const type = id === 'BOTTLED_FLAME' ? 'attack' : id === 'BOTTLED_LIGHTNING' ? 'skill' : id === 'BOTTLED_TORNADO' ? 'power' : undefined
    if (type && !run.deck?.some(card => canRemoveCard(card) && resolveCard(card).type === type && resolveCard(card).rarity !== 'basic')) return false
    return true
}
function offered(run: RelicRun, ids: RelicId[]): void {
    run.seenRelics ??= []
    for (const id of ids) if (id !== 'CIRCLET' && !run.seenRelics.includes(id)) run.seenRelics.push(id)
}
export function drawRelic(rng: RNG, meta: MetaState, view: RelicRun | RelicId[], rarity?: RelicDef['rarity'], exclude: RelicId[] = []): RelicId {
    const run: RelicRun = Array.isArray(view) ? { relics: view } : view
    const roll = rng.random()
    const selected = rarity ?? (roll < 0.5 ? 'common' : roll < 0.83 ? 'uncommon' : 'rare')
    const eligible = (id: RelicId) => !exclude.includes(id) && eligibleRelic(run, id) && (!run.unlockedRelicIds || run.unlockedRelicIds.includes(id))
    let pool = (run.unlockedRelicIds ? run.unlockedRelicIds.filter(id => RELIC_DEFS[id].rarity === selected) : getUnlockedRelicPool(meta, selected)).filter(eligible)
    if (!pool.length && !rarity) pool = (run.unlockedRelicIds ? run.unlockedRelicIds.filter(id => ['common', 'uncommon', 'rare'].includes(RELIC_DEFS[id].rarity)) : getUnlockedRelicPool(meta)).filter(eligible)
    const id = pool.length ? pool[rng.int(0, pool.length - 1)] : 'CIRCLET'
    offered(run, [id]); return id
}
export function drawBossRelics(rng: RNG, view: RelicRun | RelicId[], meta: MetaState = createDefaultMeta(), count = 3): RelicId[] {
    const run: RelicRun = Array.isArray(view) ? { relics: view } : view
    const pool = (run.unlockedRelicIds ? run.unlockedRelicIds.filter(id => RELIC_DEFS[id].rarity === 'boss') : getUnlockedRelicPool(meta, 'boss')).filter(id => eligibleRelic(run, id) && (!run.unlockedRelicIds || run.unlockedRelicIds.includes(id)))
    rng.shuffleInPlace(pool)
    const choices: RelicId[] = pool.length ? pool.slice(0, count) : ['CIRCLET']
    offered(run, choices); return choices
}
