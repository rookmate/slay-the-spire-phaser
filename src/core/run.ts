import type { AcquisitionStep } from './relics/acquisitions'
import { changeMaxHp, gainGold } from './health'
import { CHARACTERS, type CharacterId, type RunMode } from './characters'
import type { EventCheckpoint, EventCombat } from './events/model'
import type { Act } from './acts'
import { RNG } from './rng'
import { CARD_DEFS, canRemoveCard, canUpgradeCard, createCardCopy, createCardInstance, createStarterDeck } from './cards'
import { clampAscension as clampAscensionLevel, getAscensionStartingMaxHp } from './ascension'
import { tryPreventCurse } from './relics'
import type { CardInstance } from './state'
import type { PotionId } from './potions'
import type { UnknownWeights } from './map'
import type { PendingRoom } from './progression'

export type RelicId =
    | 'ASTROLABE' | 'EMPTY_CAGE' | 'DOLLYS_MIRROR' | 'PANDORAS_BOX' | 'BOTTLED_FLAME' | 'BOTTLED_LIGHTNING' | 'BOTTLED_TORNADO' | 'CALLING_BELL' | 'CAULDRON' | 'TINY_HOUSE' | 'WAR_PAINT' | 'WHETSTONE' | 'PEAR' | 'LEES_WAFFLE' | 'POTION_BELT' | 'QUESTION_CARD' | 'FROZEN_EGG' | 'MOLTEN_EGG' | 'TOXIC_EGG' | 'CERAMIC_FISH' | 'DARKSTONE_PERIAPT' | 'ECTOPLASM' | 'FUSION_HAMMER' | 'CURSED_KEY' | 'BLACK_STAR' | 'PRAYER_WHEEL' | 'WHITE_BEAST_STATUE' | 'PRISMATIC_SHARD' | 'NLOTHS_GIFT' | 'MATRYOSHKA' | 'NLOTHS_HUNGRY_FACE' | 'MEAT_ON_THE_BONE' | 'FACE_OF_CLERIC' | 'MAW_BANK' | 'MEAL_TICKET' | 'ETERNAL_FEATHER' | 'REGAL_PILLOW' | 'DREAM_CATCHER' | 'PEACE_PIPE' | 'SHOVEL' | 'SINGING_BOWL' | 'JUZU_BRACELET' | 'TINY_CHEST' | 'SSSERPENT_HEAD' | 'WING_BOOTS' | 'FROZEN_EYE' | 'CULTIST_HEADPIECE' | 'SPIRIT_POOP'
    | 'BLOOD_VIAL' | 'ODDLY_SMOOTH_STONE' | 'DATA_DISK' | 'SYMBIOTIC_VIRUS' | 'NUCLEAR_BATTERY' | 'RUNIC_CAPACITOR' | 'NINJA_SCROLL' | 'TEARDROP_LOCKET' | 'DU_VU_DOLL' | 'FOSSILIZED_HELIX' | 'CLOCKWORK_SOUVENIR' | 'TWISTED_FUNNEL' | 'MUTAGENIC_STRENGTH' | 'GREMLIN_VISAGE' | 'PANTOGRAPH' | 'SLING_OF_COURAGE' | 'GIRYA' | 'ANCIENT_TEA_SET' | 'ENCHIRIDION' | 'TOOLBOX' | 'GAMBLING_CHIP' | 'DAMARU' | 'BRIMSTONE' | 'CAPTAINS_WHEEL' | 'STONE_CALENDAR' | 'INCENSE_BURNER' | 'INSERTER' | 'ART_OF_WAR' | 'POCKETWATCH' | 'CLOAK_CLASP' | 'EMOTION_CHIP' | 'WARPED_TONGS' | 'NILRYS_CODEX' | 'DEAD_BRANCH' | 'RUNIC_CUBE' | 'SELF_FORMING_CLAY' | 'SNECKO_EYE' | 'NUNCHAKU' | 'PEN_NIB' | 'KUNAI' | 'SHURIKEN' | 'ORNAMENTAL_FAN' | 'DUALITY' | 'INK_BOTTLE' | 'LETTER_OPENER' | 'BIRD_FACED_URN' | 'MUMMIFIED_HAND' | 'ORANGE_PELLETS' | 'HOVERING_KITE' | 'TOUGH_BANDAGES' | 'TINGSHA' | 'SUNDIAL' | 'THE_ABACUS' | 'MELANGE' | 'CALIPERS' | 'ICE_CREAM' | 'RUNIC_PYRAMID' | 'RUNIC_DOME' | 'VELVET_CHOKER' | 'SLAVERS_COLLAR' | 'VIOLET_LOTUS' | 'GOLD_PLATED_CABLES' | 'GOLDEN_EYE' | 'SNECKO_SKULL' | 'CHAMPION_BELT' | 'GINGER' | 'TURNIP' | 'TORII' | 'TUNGSTEN_ROD' | 'THE_BOOT' | 'PAPER_KRANE' | 'ODD_MUSHROOM' | 'RED_SKULL' | 'STRIKE_DUMMY' | 'WRIST_BLADE' | 'CHEMICAL_X' | 'GREMLIN_HORN' | 'THE_SPECIMEN' | 'HAND_DRILL' | 'STRANGE_SPOON' | 'BLUE_CANDLE' | 'MEDICAL_KIT' | 'UNCEASING_TOP' | 'NECRONOMICON'
    | 'SACRED_BARK' | 'LIZARD_TAIL' | 'MAGIC_FLOWER' | 'TOY_ORNITHOPTER'
    | 'RING_OF_THE_SNAKE' | 'RING_OF_THE_SERPENT' | 'CRACKED_CORE' | 'FROZEN_CORE' | 'PURE_WATER' | 'HOLY_WATER'
    | 'MANGO' | 'OLD_COIN' | 'THREAD_AND_NEEDLE'
    | 'CIRCLET' | 'MEMBERSHIP_CARD' | 'SMILING_MASK' | 'COURIER' | 'ORRERY'
    | 'GOLDEN_IDOL' | 'BLOODY_IDOL' | 'MARK_OF_THE_BLOOM' | 'RED_MASK' | 'NEOWS_LAMENT'
    | 'BURNING_BLOOD'
    | 'BLACK_BLOOD'
    | 'SOZU'
    | 'BUSTED_CROWN'
    | 'COFFEE_DRIPPER'
    | 'MARK_OF_PAIN'
    | 'PHILOSOPHERS_STONE'
    | 'ANCHOR'
    | 'LANTERN'
    | 'VAJRA'
    | 'BAG_OF_PREPARATION'
    | 'BRONZE_SCALES'
    | 'STRAWBERRY'
    | 'PRESERVED_INSECT'
    | 'OMAMORI'
    | 'AKABEKO'
    | 'ORICHALCUM'
    | 'CENTENNIAL_PUZZLE'
    | 'BAG_OF_MARBLES'
    | 'HORN_CLEAT'
    | 'HAPPY_FLOWER'
    | 'PAPER_FROG'
    | 'MERCURY_HOURGLASS'
    | 'CHARONS_ASHES'

export interface RelicStateEntry {
    charges?: number
    counter?: number
}

export interface RunState {
    earnedAchievements?: import('./achievements/catalog').AchievementId[]
    pendingAcquisitions?: AcquisitionStep[]
    acquisitionSequence?: number
    seenRelics?: RelicId[]
    unlockedCardIds?: string[]
    unlockedRelicIds?: RelicId[]
    keysEnabled?: boolean
    initialMaxHp?: number
    stats?: import('./score').RunStats
    modifiers?: import('./modes/modifiers').ModifierId[]
    endlessLoop?: number
    blights?: Partial<Record<import('./modes/endless').BlightId, number>>
    pendingBlights?: import('./modes/endless').BlightId[]
    startingDraft?: import('./modes/setup').StartingDraft
    character: CharacterId
    mode: RunMode
    runId?: string
    rareCardOffset?: number
    potionChance?: number
    elapsedSeconds?: number
    keys: { ruby: boolean; emerald: boolean; sapphire: boolean }
    burningEliteActive?: boolean
    secondBoss?: boolean
    hallwayCount?: number
    mapRows?: number
    seed: string
    act: Act
    floor: number
    gold: number
    player: { maxHp: number; hp: number }
    relics: RelicId[]
    potions: PotionId[]
    maxPotionSlots: number
    merchantRemoveCost: number
    deck: CardInstance[]
    neowFull?: boolean
    neowCompleted: boolean
    neowSeed: string
    neowChoiceId?: string
    bossRelicChoicePending?: { sourceBossId: string; choices: RelicId[] }
    cardsSeen?: number
    actsCleared?: number[]
    cursesObtained?: number
    cardsRemoved?: number
    relicState?: Partial<Record<RelicId, RelicStateEntry>>
    eventState?: EventCheckpoint
    eventCombat?: EventCombat
    eventHistory?: Partial<Record<string, boolean>>
    runFlags?: Record<string, boolean>
    asc: number
    mapProgress?: { currentNodeId?: string }
    unknownWeights?: UnknownWeights
    rewardReturnRoom?: PendingRoom
    pendingRoom?: PendingRoom
    combatCount?: number
}

export interface NewRunOptions {
    character?: CharacterId
    seed?: string
    ascension?: number
    mode?: RunMode
    previousRunReachedBoss?: boolean
}
export function createNewRun(options: NewRunOptions = {}): RunState {
    const { character = 'ironclad', seed, ascension: asc = 0, previousRunReachedBoss = false } = options
    const spec = CHARACTERS[character]
    const s = seed ?? Math.random().toString(36).slice(2)
    const rng = new RNG(s)
    const deck: CardInstance[] = createStarterDeck(character)
    rng.shuffleInPlace(deck)
    const normalizedAsc = clampAscensionLevel(asc)
    const startingMaxHp = getAscensionStartingMaxHp(normalizedAsc, spec.maxHp)
    if (normalizedAsc >= 10) deck.push(createCardInstance('ASCENDERS_BANE'))
    return {
        character, mode: options.mode ?? (seed === undefined ? 'standard' : 'seeded'),
        runId: crypto.randomUUID(),
        elapsedSeconds: 0, initialMaxHp: startingMaxHp, stats: {},
        keys: { ruby: false, emerald: false, sapphire: false },
        hallwayCount: 0,
        mapRows: 16,
        seed: s,
        act: 1,
        floor: 1,
        gold: 99,
        player: { maxHp: startingMaxHp, hp: normalizedAsc >= 6 ? Math.round(startingMaxHp * 0.9) : startingMaxHp },
        relics: [spec.starterRelic],
        potions: [],
        maxPotionSlots: normalizedAsc >= 11 ? 2 : 3,
        merchantRemoveCost: 75,
        deck,
        neowFull: seed !== undefined || previousRunReachedBoss,
        neowCompleted: false,
        neowSeed: `${s}-neow`,
        neowChoiceId: undefined,
        mapProgress: {},
        combatCount: 0,
        cardsSeen: 0,
        actsCleared: [],
        cursesObtained: 0,
        cardsRemoved: 0,
        relicState: {},
        eventHistory: {},
        runFlags: {},
        asc: normalizedAsc,
    }
}

const STORAGE_KEY = 'sts_run_v7'

export function obtainCard(run: RunState, defId: string, destination: 'deck' = 'deck', upgradeLevel = 0): CardInstance {
    const card = createCardInstance(defId, upgradeLevel)
    if (destination === 'deck') obtainCardInstance(run, card)
    return card
}

export function obtainCurse(run: RunState, curseId: string): CardInstance {
    return obtainCard(run, curseId)
}

export function removeCardByInstanceId(run: RunState, instanceId: string): CardInstance | undefined {
    const index = run.deck.findIndex(card => card.instanceId === instanceId)
    if (index < 0 || !canRemoveCard(run.deck[index])) return undefined
    const [removed] = run.deck.splice(index, 1)
    run.cardsRemoved = (run.cardsRemoved ?? 0) + 1
    if (removed.defId === 'PARASITE') {
        run.player.maxHp = Math.max(1, run.player.maxHp - 3)
        run.player.hp = Math.min(run.player.hp, run.player.maxHp)
    }
    return removed
}

export function getCurseCards(run: RunState): CardInstance[] {
    return run.deck.filter(card => CARD_DEFS[card.defId]?.type === 'curse')
}

export function saveRun(run: RunState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(run))
}

export function loadRun(): RunState | undefined {
    const s = localStorage.getItem(STORAGE_KEY)
    if (!s) return undefined
    try {
        const parsed: unknown = JSON.parse(s)
        if (!parsed || typeof parsed !== 'object') return undefined
        const run = parsed as RunState
        if (typeof run.seed !== 'string' || ![1, 2, 3, 4].includes(run.act) || !Number.isFinite(run.gold)
            || !run.player || !Number.isFinite(run.player.hp) || !Number.isFinite(run.player.maxHp)
            || !Array.isArray(run.deck) || run.deck.some(card => !card || !CARD_DEFS[card.defId] || typeof card.instanceId !== 'string')
            || !Array.isArray(run.relics) || !Array.isArray(run.potions)) return undefined
        run.character ??= 'ironclad'
        run.mode ??= 'standard'
        run.keys ??= { ruby: false, emerald: false, sapphire: false }
        run.mapRows ??= 15
        run.asc = clampAscensionLevel(run.asc)
        run.hallwayCount ??= run.combatCount ?? 0
        return run
    } catch {
        return undefined
    }
}

export function clearSavedRun(): void {
    localStorage.removeItem(STORAGE_KEY)
}

export function obtainCardInstance(run: RunState, card: CardInstance): CardInstance {
    const copies = run.modifiers?.includes('HOARDER') ? 3 : 1
    const gained = [card, ...Array.from({ length: copies - 1 }, () => createCardCopy(card))]
    for (const entry of gained) obtainSingleCard(run, entry)
    return card
}
function obtainSingleCard(run: RunState, card: CardInstance): CardInstance {
    const type = CARD_DEFS[card.defId].type
    if (type === 'curse') {
        if (tryPreventCurse(run, card.defId)) return card
        run.cursesObtained = (run.cursesObtained ?? 0) + 1
        if (run.relics.includes('DARKSTONE_PERIAPT')) changeMaxHp(run, 6)
    }
    const egg = type === 'attack' ? 'MOLTEN_EGG' : type === 'skill' ? 'TOXIC_EGG' : type === 'power' ? 'FROZEN_EGG' : undefined
    if (egg && run.relics.includes(egg) && card.upgradeLevel === 0 && canUpgradeCard(card)) card.upgradeLevel++
    run.deck.push(card)
    if (run.relics.includes('CERAMIC_FISH')) gainGold(run, 9)
    return card
}
