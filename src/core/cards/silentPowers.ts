import { definePower as power } from './builders'
import type { CardDef } from '../state'
import { upgraded as up } from './builders'

export const SILENT_POWERS: Record<string, CardDef> = {
    A_THOUSAND_CUTS: power('A_THOUSAND_CUTS', 'A Thousand Cuts', 2, 'rare', 'THOUSAND_CUTS', 1, 2, c => `Each card you play deals ${up(c, 1, 2)} damage to all enemies.`),
    ACCURACY: power('ACCURACY', 'Accuracy', 1, 'uncommon', 'ACCURACY', 4, 6, c => `Shivs deal ${up(c, 4, 6)} extra damage.`),
    AFTER_IMAGE: power('AFTER_IMAGE', 'After Image', 1, 'rare', 'AFTER_IMAGE', 1, 1, () => 'Gain 1 Block for each card you play.', { upgrade: { innate: true } }),
    CALTROPS: power('CALTROPS', 'Caltrops', 1, 'uncommon', 'THORNS', 3, 5, c => `Deal ${up(c, 3, 5)} damage back when attacked.`, { onPlay: ({ engine, card }) => engine.configurePlayerCombatBonuses({ baseThorns: engine.getBaseThorns() + up(card, 3, 5) }) }),
    ENVENOM: power('ENVENOM', 'Envenom', 2, 'rare', 'ENVENOM', 1, 1, () => 'Apply 1 Poison each time an Attack deals unblocked damage.', { upgrade: { cost: 1 } }),
    FOOTWORK: power('FOOTWORK', 'Footwork', 1, 'uncommon', 'DEXTERITY', 2, 3, c => `Gain ${up(c, 2, 3)} Dexterity.`),
    INFINITE_BLADES: power('INFINITE_BLADES', 'Infinite Blades', 1, 'uncommon', 'INFINITE_BLADES', 1, 1, () => 'Add a Shiv to your hand each turn.', { upgrade: { innate: true } }),
    NOXIOUS_FUMES: power('NOXIOUS_FUMES', 'Noxious Fumes', 1, 'uncommon', 'NOXIOUS_FUMES', 2, 3, c => `Each turn, apply ${up(c, 2, 3)} Poison to all enemies.`),
    TOOLS_OF_THE_TRADE: power('TOOLS_OF_THE_TRADE', 'Tools of the Trade', 1, 'rare', 'TOOLS_OF_THE_TRADE', 1, 1, () => 'Each turn, draw 1 and discard 1.', { upgrade: { cost: 0 } }),
    WELL_LAID_PLANS: power('WELL_LAID_PLANS', 'Well-Laid Plans', 1, 'uncommon', 'WELL_LAID_PLANS', 1, 2, c => `At turn end, retain up to ${up(c, 1, 2)} cards.`),
    WRAITH_FORM: power('WRAITH_FORM', 'Wraith Form', 3, 'rare', 'WRAITH_FORM', 1, 1, c => `Gain ${up(c, 2, 3)} Intangible. Lose 1 Dexterity at each turn end.`, {
        onPlay: ({ engine, card }) => { engine.applyPowerToPlayer('INTANGIBLE', up(card, 2, 3)); engine.applyPowerToPlayer('WRAITH_FORM', 1) }
    }),
}
