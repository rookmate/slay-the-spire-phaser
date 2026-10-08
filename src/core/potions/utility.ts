import type { PotionDef } from './model'
import { canUpgradeCard, createCardInstance, resolveCard } from '../cards'
import { discoverCards, offerCards } from '../combat/choices'
import { canObtainPotion } from '../relics'
import { drawPotion } from '../rewardPools'
import { canIncreaseMaxHp, changeMaxHp } from '../health'

export const UTILITY_POTIONS = {
    ATTACK_POTION: { id: 'ATTACK_POTION', name: 'Attack Potion', rarity: 'common', target: 'none', description: 'Choose an Attack. It costs 0 this turn.', use: (engine, _targets, copies) => discoverCards(engine, 'attack-potion', { type: 'attack', copies }) },
    SKILL_POTION: { id: 'SKILL_POTION', name: 'Skill Potion', rarity: 'common', target: 'none', description: 'Choose a Skill. It costs 0 this turn.', use: (engine, _targets, copies) => discoverCards(engine, 'skill-potion', { type: 'skill', copies }) },
    POWER_POTION: { id: 'POWER_POTION', name: 'Power Potion', rarity: 'common', target: 'none', description: 'Choose a Power. It costs 0 this turn.', use: (engine, _targets, copies) => discoverCards(engine, 'power-potion', { type: 'power', copies }) },
    COLORLESS_POTION: { id: 'COLORLESS_POTION', name: 'Colorless Potion', rarity: 'common', target: 'none', description: 'Choose a colorless card. It costs 0 this turn.', use: (engine, _targets, copies) => discoverCards(engine, 'colorless-potion', { colorless: true, copies }) },
    BLESSING_OF_THE_FORGE: { id: 'BLESSING_OF_THE_FORGE', name: 'Blessing of the Forge', rarity: 'common', target: 'none', scalable: false, description: 'Upgrade every card in your hand.', use: engine => { for (const card of engine.state.player.hand) if (canUpgradeCard(card)) card.upgradeLevel++ } },
    ELIXIR: { id: 'ELIXIR', name: 'Elixir', rarity: 'uncommon', character: 'ironclad', target: 'none', scalable: false, description: 'Exhaust any number of cards from your hand.', use: engine => {
        const cards = engine.state.player.hand; if (!cards.length) return
        engine.beginChoice({ zone: 'hand', prompt: 'Choose cards to exhaust', sourceCardInstanceId: 'elixir', eligibleInstanceIds: cards.map(c => c.instanceId), minSelections: 0, maxSelections: cards.length, canSkip: true,
            onSubmit: ids => { engine.exhaustCardsInHand(c => ids.includes(c.instanceId)) } })
    } },
    GAMBLERS_BREW: { id: 'GAMBLERS_BREW', name: "Gambler's Brew", rarity: 'uncommon', target: 'none', scalable: false, description: 'Discard any number of cards and draw that many.', use: engine => {
        const cards = engine.state.player.hand; if (!cards.length) return
        engine.beginChoice({ zone: 'hand', prompt: 'Choose cards to discard', sourceCardInstanceId: 'gamblers-brew', eligibleInstanceIds: cards.map(c => c.instanceId), minSelections: 0, maxSelections: cards.length, canSkip: true,
            onSubmit: ids => { engine.discardCards(ids); engine.enqueue({ kind: 'DrawCards', count: ids.length }) } })
    } },
    LIQUID_MEMORIES: { id: 'LIQUID_MEMORIES', name: 'Liquid Memories', rarity: 'uncommon', target: 'none', description: 'Return a card from discard. It costs 0 this turn.', use: (engine, _targets, count) => {
        const cards = engine.state.player.discardPile; if (!cards.length) return
        const n = Math.min(count, cards.length)
        engine.beginChoice({ zone: 'discard', prompt: `Return ${n} cards`, sourceCardInstanceId: 'liquid-memories', eligibleInstanceIds: cards.map(c => c.instanceId), minSelections: n, maxSelections: n, canSkip: false,
            onSubmit: ids => { for (const id of ids) { const card = engine.moveCardToDestination(id, 'discard', 'hand'); if (card) card.costForTurn = 0 } } })
    } },
    SNECKO_OIL: { id: 'SNECKO_OIL', name: 'Snecko Oil', rarity: 'rare', target: 'none', description: 'Draw 5. Randomize costs in your hand from 0 to 3.', use: (engine, _targets, multiplier) => {
        engine.enqueue({ kind: 'DrawCards', count: 5 * multiplier }); engine.afterQueuedEffects(() => { for (const card of engine.state.player.hand) if (!resolveCard(card).xCost && !resolveCard(card).unplayable) { delete card.costForTurn; delete card.costUntilPlayed; card.costForCombat = engine.rng.int(0, 3) } })
    } },
    DISTILLED_CHAOS: { id: 'DISTILLED_CHAOS', name: 'Distilled Chaos', rarity: 'uncommon', target: 'none', description: 'Play the top 3 cards of your draw pile.', use: (engine, _targets, multiplier) => { for (let i = 0; i < 3 * multiplier; i++) engine.enqueue({ kind: 'PlayTopCard', exhaust: false }) } },
    STANCE_POTION: { id: 'STANCE_POTION', name: 'Stance Potion', rarity: 'uncommon', character: 'watcher', target: 'none', scalable: false, description: 'Enter Calm or Wrath.', use: engine => {
        offerCards(engine, ['CALM', 'WRATH'].map(id => createCardInstance(id)), 'stance-potion', card => engine.enqueue({ kind: 'ChangeStance', stance: card.defId === 'CALM' ? 'calm' : 'wrath' }), false)
    } },
    SMOKE_BOMB: { id: 'SMOKE_BOMB', name: 'Smoke Bomb', rarity: 'rare', target: 'none', scalable: false, description: 'Escape a non-boss combat. Receive no rewards.', canUse: engine => !engine.state.enemies.some(e => e.tags?.includes('boss')) && !(engine.state.enemies.filter(e => e.hp > 0 && ['SPIRE_SHIELD', 'SPIRE_SPEAR'].includes(e.specId ?? '')).length === 2), use: engine => {
        engine.state.escaped = true
    } },
    FRUIT_JUICE: { id: 'FRUIT_JUICE', name: 'Fruit Juice', rarity: 'rare', target: 'player', description: 'Gain 5 max HP.', use: (engine, _targets, multiplier) => {
        if (!canIncreaseMaxHp(engine.run)) return
        const amount = 5 * multiplier; engine.state.player.maxHp += amount; engine.enqueue({ kind: 'Heal', target: engine.state.player.id, amount })
    }, useOutsideCombat: (run, multiplier) => changeMaxHp(run, 5 * multiplier) },
    ENTROPIC_BREW: { id: 'ENTROPIC_BREW', name: 'Entropic Brew', rarity: 'rare', target: 'none', scalable: false, description: 'Fill your empty potion slots with random potions.', use: engine => {
        if (engine.run) while (canObtainPotion(engine.run)) engine.run.potions.push(drawPotion(engine.rng, engine.run.character, 'generated'))
    }, useOutsideCombat: run => { refillOutside(run) } },
} satisfies Record<string, PotionDef>
import { RNG } from '../rng'
import type { RunState } from '../run'
function refillOutside(run: RunState): void {
    const rng = new RNG(`${run.seed}-entropic-${run.floor}-${run.potions.join('-')}`)
    while (canObtainPotion(run)) run.potions.push(drawPotion(rng, run.character, 'generated'))
}
