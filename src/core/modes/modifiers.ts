import { CHARACTER_IDS } from '../characters'
import type { CardColor } from '../state'
import type { RunState } from '../run'
const mod = (name: string, description: string, group: 'start' | 'pool' | 'challenge' | 'custom') => ({ name, description, group })
export const MODIFIERS = {
    DRAFT: mod('Draft', 'Choose 15 cards, one from each offer of three.', 'start'),
    SEALED_DECK: mod('Sealed Deck', 'Choose 10 cards from a pool of 30.', 'start'),
    SHINY: mod('Shiny', 'Start with one of every rare card in your card pool.', 'start'),
    INSANITY: mod('Insanity', 'Start with a random deck of 50 cards.', 'start'),
    CHIMERA: mod('Chimera', 'Start with a deck drawn from all four characters.', 'start'),
    SPECIALIZED: mod('Specialized', 'Add five copies of one random card to your starting deck.', 'start'),
    ALL_STAR: mod('All Star', 'Start with five extra colorless cards.', 'start'),
    HEIRLOOM: mod('Heirloom', 'Start with one rare relic.', 'start'),
    CURSED_RUN: mod('Cursed Run', 'Replace your starter relic with Cursed Key, Darkstone Periapt, and Du-Vu Doll. Gain a Curse after each boss.', 'start'),
    DIVERSE: mod('Diverse', 'Every character’s cards appear in rewards and shops.', 'pool'),
    RED_CARDS: mod('Red Cards', 'Include Ironclad cards in rewards and shops.', 'pool'),
    GREEN_CARDS: mod('Green Cards', 'Include Silent cards in rewards and shops.', 'pool'),
    BLUE_CARDS: mod('Blue Cards', 'Include Defect cards in rewards and shops. Gain an orb slot.', 'pool'),
    PURPLE_CARDS: mod('Purple Cards', 'Include Watcher cards in rewards and shops.', 'pool'),
    COLORLESS_CARDS: mod('Colorless Cards', 'Include colorless cards in rewards.', 'pool'),
    VINTAGE: mod('Vintage', 'Normal enemies reward a relic instead of cards.', 'pool'),
    HOARDER: mod('Hoarder', 'Obtain two extra copies of each card you gain. Merchant removal is disabled.', 'pool'),
    FLIGHT: mod('Flight', 'Travel to any room on the next row.', 'pool'),
    CERTAIN_FUTURE: mod('Certain Future', 'The map has one path.', 'pool'),
    CONTROLLED_CHAOS: mod('Controlled Chaos', 'Start with Frozen Eye. Add 10 random cards to the bottom of your draw pile each turn.', 'pool'),
    TIME_DILATION: mod('Time Dilation', 'Enemies start combat with Slow.', 'pool'),
    BIG_GAME_HUNTER: mod('Big Game Hunter', 'More elites appear. Their card rewards are rare.', 'challenge'),
    LETHALITY: mod('Lethality', 'You and every enemy start combat with 3 Strength.', 'challenge'),
    NIGHT_TERRORS: mod('Night Terrors', 'Rest to full HP, then lose 5 max HP.', 'challenge'),
    BINARY: mod('Binary', 'Card rewards offer one fewer card.', 'challenge'),
    MIDAS: mod('Midas', 'Combat rewards give triple Gold. Smithing is disabled.', 'challenge'),
    TERMINAL: mod('Terminal', 'Lose 1 max HP on entering a room. Start combat with 5 Plated Armor.', 'challenge'),
    DEADLY_EVENTS: mod('Deadly Events', 'Unknown rooms can contain elites and contain more chests.', 'challenge'),
    DAILY_MODS: mod('Daily Mods', 'Choose three random daily modifiers, replacing other modifiers except Endless or The Ending.', 'custom'),
    PRAISE_SNECKO: mod('Praise Snecko', 'Replace your starting relic with Snecko Eye.', 'custom'),
    INCEPTION: mod('Inception', 'Replace your starting relic with Unceasing Top.', 'custom'),
    MY_TRUE_FORM: mod('My True Form', 'Start with Demon Form, Wraith Form, Echo Form, and Deva Form.', 'custom'),
    ONE_HIT_WONDER: mod('One Hit Wonder', 'Start with 1 max HP.', 'custom'),
    STARTER_DECK: mod('Starter Deck', 'Start with Busted Crown and Binary.', 'custom'),
    THE_ENDING: mod('The Ending', 'Enable keys and the final act.', 'custom'),
    ENDLESS: mod('Endless', 'After Act 3, return to Act 1 with your deck and increasingly severe blights.', 'custom'),
    BLIGHT_CHESTS: mod('Blight Chests', 'After the first endless loop, boss chests offer blights.', 'custom'),
} as const
export type ModifierId = keyof typeof MODIFIERS
export const MODIFIER_IDS = Object.keys(MODIFIERS) as ModifierId[]
export function hasModifier(run: Partial<RunState> | undefined, id: ModifierId): boolean { return !!run?.modifiers?.includes(id) }
export function toggleModifier(current: ModifierId[], id: ModifierId): ModifierId[] {
    if (current.includes(id)) return current.filter(value => value !== id)
    const incompatible: ModifierId[][] = [['DRAFT', 'SEALED_DECK'], ['SHINY', 'INSANITY'], ['ENDLESS', 'THE_ENDING'], ['INCEPTION', 'PRAISE_SNECKO']]
    let next = current.filter(value => !incompatible.some(group => group.includes(id) && group.includes(value)))
    if (id === 'DIVERSE') next = next.filter(value => !['RED_CARDS', 'GREEN_CARDS', 'BLUE_CARDS', 'PURPLE_CARDS'].includes(value))
    if (['RED_CARDS', 'GREEN_CARDS', 'BLUE_CARDS', 'PURPLE_CARDS'].includes(id)) next = next.filter(value => value !== 'DIVERSE')
    return [...next, id]
}
export function cardColors(run: Partial<RunState>, rewards = false): CardColor[] {
    const colors: CardColor[] = hasModifier(run, 'DIVERSE') ? [...CHARACTER_IDS] : [run.character ?? 'ironclad']
    for (const [id, color] of [['RED_CARDS', 'ironclad'], ['GREEN_CARDS', 'silent'], ['BLUE_CARDS', 'defect'], ['PURPLE_CARDS', 'watcher']] as const)
        if (hasModifier(run, id) && !colors.includes(color)) colors.push(color)
    if (rewards && hasModifier(run, 'COLORLESS_CARDS')) colors.push('colorless')
    return colors
}
