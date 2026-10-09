import { CARD_DEFS, createCardInstance } from '../cards'
import { CHARACTER_IDS, type CharacterId } from '../characters'
import { selectCardPool } from '../contentPools'
import { getCharacterProgress, getDailySeed, getEffectiveUnlockedCardIds, getEffectiveUnlockedRelicIds, keysUnlocked, type MetaState } from '../meta'
import { applyRelicAcquisition, RELIC_DEFS } from '../relics'
import { drawRelic } from '../rewardPools'
import { RNG } from '../rng'
import { createNewRun, obtainCard, type NewRunOptions, type RunState } from '../run'
import type { CardInstance } from '../state'
import { cardColors, hasModifier, MODIFIERS, MODIFIER_IDS, toggleModifier, type ModifierId } from './modifiers'

export interface StartingDraft { kind: 'draft' | 'sealed'; remaining: number; picked: number; choices: CardInstance[] }
export function dailyConfiguration(date = new Date()): { seed: string; character: CharacterId; modifiers: ModifierId[] } {
    const seed = getDailySeed(date), rng = new RNG(seed)
    const character = CHARACTER_IDS[rng.int(0, 3)], modifiers: ModifierId[] = []
    for (const group of ['start', 'pool', 'challenge'] as const) {
        const pool = MODIFIER_IDS.filter(id => MODIFIERS[id].group === group && !(id === 'BLUE_CARDS' && character === 'defect') && !(id === 'RED_CARDS' && character === 'ironclad') && !(id === 'GREEN_CARDS' && character === 'silent') && !(id === 'PURPLE_CARDS' && character === 'watcher'))
        modifiers.push(pool[rng.int(0, pool.length - 1)])
    }
    return { seed, character, modifiers }
}
function draftChoices(run: RunState, count: number, seed: string): CardInstance[] {
    const pool = selectCardPool({ character: run.character, colors: cardColors(run, true), source: 'reward', unlockedIds: run.unlockedCardIds })
    const rng = new RNG(seed)
    const choices: CardInstance[] = []
    for (let i = 0; i < count; i++) {
        const rarity = rng.random() < 0.65 ? 'common' : 'uncommon'
        const matching = pool.filter(id => CARD_DEFS[id].rarity === rarity && (count > 3 || !choices.some(card => card.defId === id)))
        const available = matching.length ? matching : pool
        choices.push(createCardInstance(available[rng.int(0, available.length - 1)]))
    }
    return choices
}
export function createProfileRun(meta: MetaState, options: NewRunOptions & { modifiers?: ModifierId[] } = {}): RunState {
    const config = options.mode === 'daily' ? { ...options, ...dailyConfiguration(), ascension: 0 } : options
    const character = config.character ?? 'ironclad'
    const progress = getCharacterProgress(meta, character)
    const run = createNewRun({ ...config, previousRunReachedBoss: progress.previousRunReachedBoss })
    run.unlockedCardIds = run.mode === 'daily' ? Object.keys(CARD_DEFS) : [...getEffectiveUnlockedCardIds(meta)]
    run.unlockedRelicIds = run.mode === 'daily' ? Object.keys(RELIC_DEFS) as RunState['relics'] : [...getEffectiveUnlockedRelicIds(meta)]
    run.modifiers = ['daily', 'custom'].includes(run.mode) ? (config.modifiers ?? []).reduce(toggleModifier, []) : []
    if (hasModifier(run, 'DAILY_MODS')) {
        const pool = MODIFIER_IDS.filter(id => MODIFIERS[id].group !== 'custom')
        new RNG(`${run.seed}-daily-mods`).shuffleInPlace(pool)
        let rolled: ModifierId[] = []
        for (const id of pool) { const next = toggleModifier(rolled, id); if (next.length > rolled.length) rolled = next; if (rolled.length === 3) break }
        run.modifiers = [...run.modifiers.filter(id => ['ENDLESS', 'THE_ENDING'].includes(id)), ...rolled]
    }
    run.keysEnabled = ['standard', 'seeded'].includes(run.mode) ? keysUnlocked(meta) : hasModifier(run, 'THE_ENDING')
    if (run.mode === 'daily') meta.customUnlocked = true
    if (!['daily', 'custom'].includes(run.mode)) return run
    run.neowCompleted = true
    const rng = new RNG(`${run.seed}-modifiers`)
    const pool = selectCardPool({ character, source: 'reward', colors: cardColors(run, true), unlockedIds: run.unlockedCardIds })
    const random = (ids = pool) => ids[rng.int(0, ids.length - 1)]
    if (hasModifier(run, 'CHIMERA')) run.deck = ['BASH', 'SURVIVOR', 'ZAP', 'ERUPTION', 'STRIKE', 'STRIKE_SILENT', 'STRIKE_DEFECT', 'DEFEND', 'DEFEND_SILENT', 'DEFEND_WATCHER'].map(id => createCardInstance(id))
    if (hasModifier(run, 'SHINY')) run.deck = pool.filter(id => CARD_DEFS[id].rarity === 'rare').map(id => createCardInstance(id))
    if (hasModifier(run, 'INSANITY')) run.deck = draftChoices(run, 50, `${run.seed}-insanity`)
    if (hasModifier(run, 'DRAFT') || hasModifier(run, 'SEALED_DECK')) {
        if (!hasModifier(run, 'INSANITY')) run.deck = []
        const sealed = hasModifier(run, 'SEALED_DECK')
        run.startingDraft = { kind: sealed ? 'sealed' : 'draft', remaining: sealed ? 10 : 15, picked: 0, choices: draftChoices(run, sealed ? 30 : 3, `${run.seed}-draft-0`) }
    }
    if (hasModifier(run, 'SPECIALIZED')) { const id = random(); for (let i = 0; i < 5; i++) obtainCard(run, id) }
    if (hasModifier(run, 'ALL_STAR')) {
        const colorless = selectCardPool({ character, source: 'colorless' })
        for (let i = 0; i < 5; i++) obtainCard(run, random(colorless))
    }
    if (hasModifier(run, 'MY_TRUE_FORM')) run.deck.push(...['DEMON_FORM', 'WRAITH_FORM', 'ECHO_FORM', 'DEVA_FORM'].map(id => createCardInstance(id)))
    if (hasModifier(run, 'CURSED_RUN')) run.relics = ['CURSED_KEY', 'DARKSTONE_PERIAPT', 'DU_VU_DOLL']
    if (hasModifier(run, 'INCEPTION')) run.relics = ['UNCEASING_TOP']
    if (hasModifier(run, 'PRAISE_SNECKO')) run.relics = ['SNECKO_EYE']
    if (hasModifier(run, 'CONTROLLED_CHAOS')) applyRelicAcquisition(run, 'FROZEN_EYE')
    if (hasModifier(run, 'HEIRLOOM')) applyRelicAcquisition(run, drawRelic(rng, meta, run, 'rare'))
    if (hasModifier(run, 'STARTER_DECK')) {
        applyRelicAcquisition(run, 'BUSTED_CROWN'); if (!hasModifier(run, 'BINARY')) run.modifiers.push('BINARY')
    }
    if (hasModifier(run, 'ONE_HIT_WONDER')) run.player = { hp: 1, maxHp: 1 }
    if (run.asc >= 10 && !run.deck.some(card => card.defId === 'ASCENDERS_BANE')) run.deck.push(createCardInstance('ASCENDERS_BANE'))
    run.initialMaxHp = run.player.maxHp
    return run
}
export function chooseStartingCard(run: RunState, id: string): boolean {
    const draft = run.startingDraft
    const card = draft?.choices.find(c => c.instanceId === id)
    if (!draft || !card) return false
    obtainCard(run, card.defId); draft.remaining--; draft.picked++
    if (!draft.remaining) run.startingDraft = undefined
    else if (draft.kind === 'sealed') draft.choices = draft.choices.filter(c => c.instanceId !== id)
    else draft.choices = draftChoices(run, 3, `${run.seed}-draft-${draft.picked}`)
    return true
}
