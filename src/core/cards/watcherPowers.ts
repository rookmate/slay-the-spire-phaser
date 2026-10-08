import type { CardDef } from '../state'
import { upgraded as up, definePower as power } from './builders'
export const WATCHER_POWERS: Record<string, CardDef> = {
    BATTLE_HYMN: power('BATTLE_HYMN', 'Battle Hymn', 1, 'uncommon', 'BATTLE_HYMN', 1, 1, () => 'Add a Smite to hand each turn.', { upgrade: { innate: true } }),
    DEVA_FORM: power('DEVA_FORM', 'Deva Form', 3, 'rare', 'DEVA_FORM', 1, 1, () => 'Each turn, gain extra Energy, increasing by 1 every turn.', { ethereal: true, upgrade: { ethereal: false } }),
    DEVOTION: power('DEVOTION', 'Devotion', 1, 'rare', 'DEVOTION', 2, 3, c => `Gain ${up(c, 2, 3)} Mantra each turn.`),
    ESTABLISHMENT: power('ESTABLISHMENT', 'Establishment', 1, 'rare', 'ESTABLISHMENT', 1, 1, () => 'Retained cards cost 1 less this combat.', { upgrade: { innate: true } }),
    FASTING: power('FASTING', 'Fasting', 2, 'uncommon', 'FASTING', 1, 1, c => `Gain ${up(c, 3, 4)} Strength and Dexterity. Gain 1 less Energy each turn.`, { onPlay: ({ engine, card }) => { engine.applyPowerToPlayer('STRENGTH', up(card, 3, 4)); engine.applyPowerToPlayer('DEXTERITY', up(card, 3, 4)); engine.applyPowerToPlayer('FASTING', 1) } }),
    FORESIGHT: power('FORESIGHT', 'Foresight', 1, 'uncommon', 'FORESIGHT', 3, 4, c => `Scry ${up(c, 3, 4)} at the start of each turn.`),
    LIKE_WATER: power('LIKE_WATER', 'Like Water', 1, 'uncommon', 'LIKE_WATER', 5, 7, c => `Gain ${up(c, 5, 7)} Block at turn end if in Calm.`),
    MASTER_REALITY: power('MASTER_REALITY', 'Master Reality', 1, 'rare', 'MASTER_REALITY', 1, 1, () => 'Upgrade cards created during combat.', { upgrade: { cost: 0 } }),
    MENTAL_FORTRESS: power('MENTAL_FORTRESS', 'Mental Fortress', 1, 'uncommon', 'MENTAL_FORTRESS', 4, 6, c => `Gain ${up(c, 4, 6)} Block when you change stance.`),
    NIRVANA: power('NIRVANA', 'Nirvana', 1, 'uncommon', 'NIRVANA', 3, 4, c => `Gain ${up(c, 3, 4)} Block when you Scry.`),
    RUSHDOWN: power('RUSHDOWN', 'Rushdown', 1, 'uncommon', 'RUSHDOWN', 2, 2, () => 'Draw 2 when you enter Wrath.', { upgrade: { cost: 0 } }),
    STUDY: power('STUDY', 'Study', 2, 'uncommon', 'STUDY', 1, 1, () => 'Shuffle an Insight into your draw pile at each turn end.', { upgrade: { cost: 1 } }),
}
