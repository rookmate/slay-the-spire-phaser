import { CARD_DEFS, createCardInstance, resolveCard } from '../../src/core/cards'
import { createCombatEngine } from '../../src/core/combat'
import { CHARACTER_IDS } from '../../src/core/characters'
import type { Engine } from '../../src/core/engine'
import { createDefaultMeta } from '../../src/core/meta'
import { createProfileRun, chooseStartingCard } from '../../src/core/modes/setup'
import type { ModifierId } from '../../src/core/modes/modifiers'
import { RNG } from '../../src/core/rng'
import type { RelicId } from '../../src/core/run'

// Deliberately artificial mixed decks, not winning strategies or parity fixtures.
const packages: { cards: string[]; relics: RelicId[]; modifiers: ModifierId[] }[] = [
    { cards: ['CORRUPTION', 'DARK_EMBRACE', 'FEEL_NO_PAIN', 'FIEND_FIRE', 'EXHUME'], relics: ['DEAD_BRANCH', 'STRANGE_SPOON', 'CHARONS_ASHES'], modifiers: ['DIVERSE', 'CONTROLLED_CHAOS'] },
    { cards: ['CALCULATED_GAMBLE', 'ACROBATICS', 'REFLEX', 'TACTICIAN', 'CONCENTRATE', 'WELL_LAID_PLANS'], relics: ['TOUGH_BANDAGES', 'TINGSHA', 'HOVERING_KITE', 'UNCEASING_TOP'], modifiers: ['DIVERSE', 'LETHALITY'] },
    { cards: ['ECHO_FORM', 'AMPLIFY', 'SEEK', 'REBOUND', 'ALL_FOR_ONE', 'RECYCLE'], relics: ['MUMMIFIED_HAND', 'ORANGE_PELLETS', 'SUNDIAL', 'THE_ABACUS'], modifiers: ['DIVERSE', 'TIME_DILATION'] },
    { cards: ['OMNISCIENCE', 'VAULT', 'MEDITATE', 'ESTABLISHMENT', 'WORSHIP', 'SCRAWL'], relics: ['NECRONOMICON', 'GOLDEN_EYE', 'MELANGE', 'RUNIC_PYRAMID'], modifiers: ['DIVERSE', 'TERMINAL'] },
    { cards: ['DOUBLE_TAP', 'BURST', 'HAVOC', 'MAYHEM', 'DISCOVERY', 'FORETHOUGHT'], relics: ['VELVET_CHOKER', 'INK_BOTTLE', 'PEN_NIB'], modifiers: ['DIVERSE', 'PRAISE_SNECKO'] },
    { cards: ['REGRET', 'NORMALITY', 'NECRONOMICURSE', 'BURN', 'SLIMED', 'OFFERING'], relics: ['BLUE_CANDLE', 'MEDICAL_KIT', 'TUNGSTEN_ROD', 'TORII'], modifiers: ['DIVERSE', 'INCEPTION'] },
]

export function interactionFixture(seed: string, index: number) {
    const character = CHARACTER_IDS[index % CHARACTER_IDS.length], pack = packages[Math.floor(index / 4) % packages.length]
    const rng = new RNG(`${seed}-fixture`)
    const run = createProfileRun(createDefaultMeta(), { seed, character, ascension: index % 21, mode: 'custom', modifiers: pack.modifiers })
    const pool = Object.keys(CARD_DEFS).filter(id => CARD_DEFS[id].poolEnabled)
    rng.shuffleInPlace(pool)
    run.deck = [...pack.cards, ...pool.slice(0, 12)].map(id => createCardInstance(id, rng.int(0, 1)))
    run.relics.push(...pack.relics.filter(id => !run.relics.includes(id)))
    run.act = (Math.floor(index / 24) % 4 + 1) as 1 | 2 | 3 | 4
    return run
}

export function assertCombatInvariants(engine: Engine): void {
    const { player, enemies, limbo } = engine.state
    const cards = [...player.hand, ...player.drawPile, ...player.discardPile, ...player.exhaustPile, ...limbo.map(entry => entry.card)]
    if (new Set(cards.map(card => card.instanceId)).size !== cards.length) throw new Error('Duplicate combat card ownership')
    if (player.hand.length > 10) throw new Error('Hand exceeds ten cards')
    for (const entity of [player, ...enemies]) {
        for (const value of [entity.hp, entity.maxHp, entity.block, ...entity.powers.map(power => power.stacks)])
            if (!Number.isFinite(value)) throw new Error('Non-finite combat resource')
        if (entity.hp < 0 || entity.hp > entity.maxHp || entity.block < 0) throw new Error('Invalid HP/block bounds')
    }
    if (!Number.isFinite(player.energy) || player.energy < 0) throw new Error('Invalid energy')
    if (engine.state.victory && engine.state.defeat) throw new Error('Victory and defeat both set')
    const choice = engine.getPendingChoice()
    if (choice) {
        const available = engine.getCardsInZone(choice.zone).map(card => card.instanceId)
        if (choice.minSelections > choice.maxSelections || choice.minSelections > choice.eligibleInstanceIds.length
            || choice.eligibleInstanceIds.some(id => !available.includes(id))) throw new Error('Unfulfillable pending choice')
    }
}

export function simulateInteractions(seed: string, index: number) {
    const run = interactionFixture(seed, index), engine = createCombatEngine(run, run.act === 4 ? 'boss' : index % 3 === 0 ? 'elite' : 'monster'), rng = new RNG(`${seed}-actions`)
    const trace: string[] = []
    try {
        assertCombatInvariants(engine)
        for (let step = 0; step < 100 && (engine.state.turnNumber ?? 1) <= 10 && !engine.state.victory && !engine.state.defeat; step++) {
            const choice = engine.getPendingChoice()
            if (choice) {
                if (choice.canSkip && rng.random() < 0.25) {
                    trace.push(`skip ${choice.prompt}`); engine.cancelPendingChoice()
                } else {
                    const ids = [...choice.eligibleInstanceIds]; rng.shuffleInPlace(ids)
                    const count = rng.int(choice.minSelections, choice.maxSelections)
                    trace.push(`choose ${choice.prompt}: ${ids.slice(0, count).map(id => engine.getCardsInZone(choice.zone).find(c => c.instanceId === id)!.defId).join(',')}`)
                    engine.submitPendingChoice(ids.slice(0, count))
                }
            } else {
                const legal = engine.getPlayableCards()
                if (legal.length && rng.random() < 0.9) {
                    const play = legal[rng.int(0, legal.length - 1)]
                    trace.push(`play ${play.card.defId}+${play.card.upgradeLevel} -> ${play.targets.join(',')}`)
                    if (!engine.playCard(play.card, play.targets).some(event => event.kind === 'CardPlayed')) throw new Error('Advertised legal play rejected')
                } else { trace.push('end turn'); engine.enqueue({ kind: 'EndTurn' }) }
            }
            engine.runUntilIdle(); assertCombatInvariants(engine)
            if (!engine.state.victory && !engine.state.defeat && !engine.getPendingChoice()) {
                const p = engine.state.player, owned = [...p.hand, ...p.drawPile, ...p.discardPile, ...p.exhaustPile]
                for (const card of run.deck.filter(card => resolveCard(card).type !== 'power'))
                    if (!owned.some(entry => entry.instanceId === card.instanceId)) throw new Error(`Lost original card ${card.defId}`)
            }
        }
    } catch (error) { throw new Error(`seed=${seed} fixture=${index}\n${trace.join('\n')}\n${String(error)}`) }
    const player = engine.state.player
    return { trace, turn: engine.state.turnNumber, victory: engine.state.victory, defeat: engine.state.defeat,
        hp: player.hp, energy: player.energy, powers: player.powers,
        piles: [player.hand, player.drawPile, player.discardPile, player.exhaustPile].map(pile => pile.map(card => ({ defId: card.defId, upgradeLevel: card.upgradeLevel, cost: engine.getCardCost(card) }))),
        enemies: engine.state.enemies.map(enemy => ({ hp: enemy.hp, powers: enemy.powers })) }
}

export function finishStartingChoices(run: ReturnType<typeof createProfileRun>, rng: RNG): void {
    for (let step = 0; run.startingDraft && step < 15; step++) {
        const choices = run.startingDraft.choices
        if (!chooseStartingCard(run, choices[rng.int(0, choices.length - 1)].instanceId)) throw new Error('Starting choice rejected')
    }
    if (run.startingDraft || run.deck.some(card => !resolveCard(card))) throw new Error('Unfinished starting deck')
}
