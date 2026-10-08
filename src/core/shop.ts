import { selectCardPool } from './contentPools'
import { cardColors, hasModifier } from './modes/modifiers'
import { spendAtShop } from './relics/campaignRules'
import { CARD_DEFS } from './cards'
import type { MetaState } from './meta'
import { POTION_DEFS } from './potions'
import type { ShopInventory } from './progression'
import { applyRelicAcquisition, canObtainPotion, getShopPriceMultiplier, RELIC_DEFS } from './relics'
import { drawPotion, drawRelic, rollCardRarity } from './rewardPools'
import { RNG } from './rng'
import { obtainCard, removeCardByInstanceId, type RunState } from './run'

const cardBase = { common: 50, uncommon: 75, rare: 150, basic: 50 }
function cardPrice(id: string, rng: RNG): number {
    const def = CARD_DEFS[id]
    const base = cardBase[def.rarity ?? 'common'] * (def.color === 'colorless' ? 1.2 : 1)
    return rng.int(Math.round(base * 0.9), Math.round(base * 1.1))
}
function relicPrice(id: keyof typeof RELIC_DEFS, rng: RNG): number {
    const rarity = RELIC_DEFS[id].rarity
    const base = rarity === 'rare' ? 300 : rarity === 'uncommon' ? 250 : 150
    return rng.int(Math.round(base * 0.95), Math.round(base * 1.05))
}
function potionPrice(id: keyof typeof POTION_DEFS, rng: RNG): number {
    const base = POTION_DEFS[id].rarity === 'rare' ? 100 : POTION_DEFS[id].rarity === 'uncommon' ? 75 : 50
    return rng.int(Math.round(base * 0.95), Math.round(base * 1.05))
}
function shopSeed(run: RunState): string { return `${run.seed}-shop-${run.act}-${run.mapProgress?.currentNodeId ?? run.floor}` }
function pickCard(run: RunState, meta: MetaState, rng: RNG, type: string, exclude: string[], colorlessRarity?: 'uncommon' | 'rare'): string {
    const all = colorlessRarity ? Object.values(CARD_DEFS).filter(c => c.color === 'colorless' && c.poolEnabled && c.rarity === colorlessRarity).map(c => c.id) : selectCardPool({ character: run.character, source: 'shop', colors: cardColors(run), meta, unlockedIds: run.unlockedCardIds }).filter(id => CARD_DEFS[id].type === type)
    const available = all.filter(id => !exclude.includes(id))
    const rarity = colorlessRarity ?? rollCardRarity(rng, run, 'shop', false)
    const matching = available.filter(id => CARD_DEFS[id].rarity === rarity)
    const pool = matching.length ? matching : available.length ? available : all
    return pool[rng.int(0, pool.length - 1)]
}
export function generateShop(run: RunState, meta: MetaState): ShopInventory {
    const rng = new RNG(shopSeed(run))
    const cards: string[] = []
    for (const type of ['attack', 'attack', 'skill', 'skill', 'power']) cards.push(pickCard(run, meta, rng, type, cards))
    for (const rarity of ['uncommon', 'rare'] as const) cards.push(pickCard(run, meta, rng, '', cards, rarity))
    const relics: ShopInventory['relics'] = []
    // Smiling Mask is never sold. The third slot is reserved for shop relics.
    for (let i = 0; i < 3; i++) relics.push(drawRelic(rng, meta, run, i === 2 ? 'shop' : undefined, [...relics, 'SMILING_MASK']))
    const potions = Array.from({ length: 3 }, () => drawPotion(rng, run.character))
    const saleIndex = rng.int(0, 4)
    return { version: 2, cards, relics, potions, saleIndex, cardPrices: cards.map((id, i) => Math.floor(cardPrice(id, rng) * (i === saleIndex ? 0.5 : 1))), relicPrices: relics.map(id => relicPrice(id, rng)), potionPrices: potions.map(id => potionPrice(id, rng)), removalUsed: false, restockCount: 0 }
}
/** Preserve old saves' remaining stock rather than giving a fresh shop on resume. */
export function normalizeShop(run: RunState, stock: ShopInventory): ShopInventory {
    const rng = new RNG(`${shopSeed(run)}-legacy`)
    stock.relics ??= stock.relic ? [stock.relic] : []
    stock.cardPrices ??= stock.cards.map(id => cardPrice(id, rng))
    stock.relicPrices ??= stock.relics.map(id => relicPrice(id, rng))
    stock.potionPrices ??= stock.potions.map(id => potionPrice(id, rng))
    stock.version = 2
    return stock
}
export function shopPrice(run: RunState, base: number): number { return Math.max(0, Math.round(base * getShopPriceMultiplier(run))) }
export function removalPrice(run: RunState): number { return run.relics.includes('SMILING_MASK') ? 50 : shopPrice(run, run.merchantRemoveCost) }
export function purchaseRemoval(run: RunState, stock: ShopInventory, instanceId: string): boolean {
    const cost = removalPrice(run)
    if (hasModifier(run, 'HOARDER') || stock.removalUsed || run.gold < cost) return false
    if (!removeCardByInstanceId(run, instanceId)) return false
    spendAtShop(run, cost)
    run.merchantRemoveCost += 25
    stock.removalUsed = true
    return true
}
export function purchaseShopItem(run: RunState, meta: MetaState, stock: ShopInventory, kind: 'cards' | 'relics' | 'potions', index: number): boolean {
    normalizeShop(run, stock)
    const ids = stock[kind]!
    const prices = kind === 'cards' ? stock.cardPrices! : kind === 'relics' ? stock.relicPrices! : stock.potionPrices!
    const id = ids[index]
    if (!id || !Number.isFinite(prices[index])) return false
    const cost = shopPrice(run, prices[index])
    if (run.gold < cost || (kind === 'potions' && !canObtainPotion(run))) return false
    if (kind === 'relics' && run.relics.includes(id as keyof typeof RELIC_DEFS) && id !== 'CIRCLET') return false
    const rng = new RNG(`${shopSeed(run)}-restock-${stock.restockCount ?? 0}`)
    spendAtShop(run, cost)
    if (kind === 'cards') obtainCard(run, id)
    if (kind === 'relics') applyRelicAcquisition(run, id as keyof typeof RELIC_DEFS)
    if (kind === 'potions') run.potions.push(id as keyof typeof POTION_DEFS)
    ids.splice(index, 1); prices.splice(index, 1)
    if (stock.saleIndex !== undefined && kind === 'cards') {
        if (stock.saleIndex === index) stock.saleIndex = undefined
        else if (stock.saleIndex > index) stock.saleIndex--
    }
    if (run.relics.includes('COURIER')) {
        stock.restockCount = (stock.restockCount ?? 0) + 1
        if (kind === 'cards') {
            const def = CARD_DEFS[id]
            const next = pickCard(run, meta, rng, def.type, stock.cards, def.color === 'colorless' ? def.rarity as 'uncommon' | 'rare' : undefined)
            stock.cards.push(next); stock.cardPrices!.push(cardPrice(next, rng))
        } else if (kind === 'relics') {
            const next = drawRelic(rng, meta, run, undefined, [...stock.relics!, 'SMILING_MASK'])
            stock.relics!.push(next); stock.relicPrices!.push(relicPrice(next, rng) / (run.asc >= 16 ? 1.1 : 1))
        } else { const next = drawPotion(rng, run.character); stock.potions.push(next); stock.potionPrices!.push(potionPrice(next, rng)) }
    }
    return true
}
