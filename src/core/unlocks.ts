import type { RelicId } from './run'

export interface UnlockBundle {
    tier: number
    label: string
    cards: string[]
    relics: RelicId[]
}

const BASE_UNLOCKED_CARDS = [
    'CLEAVE',
    'POMMEL_STRIKE',
    'SHRUG_IT_OFF',
    'TWIN_STRIKE',
    'BODY_SLAM',
    'IRON_WAVE',
    'ANGER',
    'CLOTHESLINE',
    'CLASH',
    'METALLICIZE',
    'FEEL_NO_PAIN',
    'UPPERCUT',
    'BATTLE_TRANCE',
    'BLOODLETTING',
    'DROPKICK',
    'FLAME_BARRIER',
    'PUMMEL',
    'SEEING_RED',
    'SHOCKWAVE',
    'BARRICADE',
    'DEMON_FORM',
    'FIEND_FIRE',
    'BLUDGEON',
    'IMPERVIOUS',
    'REAPER',
    'SWORD_BOOMERANG',
    'THUNDERCLAP',
    'SPOT_WEAKNESS',
    'BURNING_PACT',
    'GHOSTLY_ARMOR',
    'SEARING_BLOW',
    'BERSERK',
    'BRUTALITY',
    'EXHUME',
] as const

const BASE_UNLOCKED_RELICS = [
    'ANCHOR',
    'LANTERN',
    'VAJRA',
    'BAG_OF_PREPARATION',
    'BRONZE_SCALES',
    'PRESERVED_INSECT',
] as const satisfies readonly RelicId[]

export const IRONCLAD_UNLOCK_TRACK: UnlockBundle[] = [
    { tier: 1, label: 'Sharper Openings', cards: ['ARMAMENTS', 'HEMOKINESIS', 'LIMIT_BREAK'], relics: ['STRAWBERRY'] },
    { tier: 2, label: 'Power At A Price', cards: ['HEAVY_BLADE', 'INTIMIDATE', 'OFFERING'], relics: ['OMAMORI'] },
    { tier: 3, label: 'Recycling', cards: ['HEADBUTT', 'ENTRENCH', 'DOUBLE_TAP'], relics: ['AKABEKO'] },
    { tier: 4, label: 'Scaling Core', cards: ['PERFECTED_STRIKE', 'POWER_THROUGH', 'CORRUPTION'], relics: ['ORICHALCUM'] },
    { tier: 5, label: 'Exhaust Engine', cards: ['TRUE_GRIT', 'SENTINEL', 'JUGGERNAUT'], relics: ['CENTENNIAL_PUZZLE'] },
    { tier: 6, label: 'Late Burst', cards: ['WARCRY', 'WHIRLWIND', 'DARK_EMBRACE'], relics: ['BAG_OF_MARBLES'] },
    { tier: 7, label: 'Tactical Pressure', cards: ['DISARM', 'FLEX', 'RECKLESS_CHARGE'], relics: ['HAPPY_FLOWER'] },
    { tier: 8, label: 'Engine Pieces', cards: ['RAGE', 'EVOLVE', 'SECOND_WIND'], relics: ['PAPER_FROG'] },
    { tier: 9, label: 'Status Fire', cards: ['COMBUST', 'FIRE_BREATHING', 'RAMPAGE'], relics: ['MERCURY_HOURGLASS'] },
    { tier: 10, label: 'Finisher Tools', cards: ['IMMOLATE', 'FEED', 'DUAL_WIELD'], relics: ['CHARONS_ASHES'] },
]

export function getBaseUnlockedCardIds(): string[] {
    return [...BASE_UNLOCKED_CARDS]
}

export function getBaseUnlockedRelicIds(): RelicId[] {
    return [...BASE_UNLOCKED_RELICS]
}
