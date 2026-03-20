import type { RoomKind } from './map'
import type { RunState, RelicId } from './run'

export interface RelicDef {
    id: RelicId
    name: string
    description: string
    rarity: 'starter' | 'common' | 'uncommon' | 'boss'
    energyPerTurn?: number
    postCombatHeal?: number
    blocksPotionGain?: boolean
    cardRewardChoiceDelta?: number
}

export interface CombatRelicBonuses {
    drawBonus: number
    energyBonus: number
    startingBlock: number
    startingStrength: number
    startingThorns: number
    eliteHpMultiplier: number
}

export const RELIC_DEFS: Record<RelicId, RelicDef> = {
    BURNING_BLOOD: { id: 'BURNING_BLOOD', name: 'Burning Blood', description: 'Heal 6 HP after combat.', rarity: 'starter', postCombatHeal: 6 },
    BLACK_BLOOD: { id: 'BLACK_BLOOD', name: 'Black Blood', description: 'Heal 12 HP after combat.', rarity: 'boss', postCombatHeal: 12 },
    SOZU: { id: 'SOZU', name: 'Sozu', description: 'Gain 1 Energy at the start of each turn. You can no longer obtain Potions.', rarity: 'boss', energyPerTurn: 1, blocksPotionGain: true },
    BUSTED_CROWN: { id: 'BUSTED_CROWN', name: 'Busted Crown', description: 'Gain 1 Energy at the start of each turn. Future card rewards have 2 fewer choices.', rarity: 'boss', energyPerTurn: 1, cardRewardChoiceDelta: -2 },
    ANCHOR: { id: 'ANCHOR', name: 'Anchor', description: 'Start each combat with 10 Block.', rarity: 'common' },
    LANTERN: { id: 'LANTERN', name: 'Lantern', description: 'Gain 1 Energy on turn 1.', rarity: 'common' },
    VAJRA: { id: 'VAJRA', name: 'Vajra', description: 'Start combat with 1 Strength.', rarity: 'common' },
    BAG_OF_PREPARATION: { id: 'BAG_OF_PREPARATION', name: 'Bag of Preparation', description: 'Draw 2 additional cards on turn 1.', rarity: 'common' },
    BRONZE_SCALES: { id: 'BRONZE_SCALES', name: 'Bronze Scales', description: 'Start combat with 3 Thorns.', rarity: 'common' },
    STRAWBERRY: { id: 'STRAWBERRY', name: 'Strawberry', description: 'Gain 7 Max HP.', rarity: 'common' },
    PRESERVED_INSECT: { id: 'PRESERVED_INSECT', name: 'Preserved Insect', description: 'Elites have 25% less HP.', rarity: 'uncommon' },
}

export const MVP_RELIC_POOL: RelicId[] = [
    'ANCHOR',
    'LANTERN',
    'VAJRA',
    'BAG_OF_PREPARATION',
    'BRONZE_SCALES',
    'STRAWBERRY',
    'PRESERVED_INSECT',
]

export const BOSS_RELIC_POOL: RelicId[] = [
    'BLACK_BLOOD',
    'SOZU',
    'BUSTED_CROWN',
]

export function getCombatRelicBonuses(relics: RelicId[], roomKind: RoomKind): CombatRelicBonuses {
    const bonuses: CombatRelicBonuses = {
        drawBonus: 0,
        energyBonus: 0,
        startingBlock: 0,
        startingStrength: 0,
        startingThorns: 0,
        eliteHpMultiplier: 1,
    }

    if (relics.includes('ANCHOR')) bonuses.startingBlock += 10
    if (relics.includes('LANTERN')) bonuses.energyBonus += 1
    if (relics.includes('VAJRA')) bonuses.startingStrength += 1
    if (relics.includes('BAG_OF_PREPARATION')) bonuses.drawBonus += 2
    if (relics.includes('BRONZE_SCALES')) bonuses.startingThorns += 3
    if (roomKind === 'elite' && relics.includes('PRESERVED_INSECT')) bonuses.eliteHpMultiplier = 0.75

    return bonuses
}

export function applyRelicAcquisition(run: RunState, relicId: RelicId): void {
    if (relicId === 'BLACK_BLOOD') {
        run.relics = run.relics.filter(id => id !== 'BURNING_BLOOD')
    }
    if (run.relics.includes(relicId)) return
    run.relics.push(relicId)
    if (relicId === 'STRAWBERRY') {
        run.player.maxHp += 7
        run.player.hp += 7
    }
}

export function getPostCombatHeal(relics: RelicId[]): number {
    return relics.reduce((highest, relicId) => Math.max(highest, RELIC_DEFS[relicId]?.postCombatHeal ?? 0), 0)
}

export function canObtainPotion(run: Pick<RunState, 'relics' | 'potions' | 'maxPotionSlots'>): boolean {
    return !blocksPotionGain(run.relics) && run.potions.length < run.maxPotionSlots
}

export function getRelicEnergyBonus(relics: RelicId[]): number {
    return relics.reduce((sum, relicId) => sum + (RELIC_DEFS[relicId]?.energyPerTurn ?? 0), 0)
}

export function blocksPotionGain(relics: RelicId[]): boolean {
    return relics.some(relicId => RELIC_DEFS[relicId]?.blocksPotionGain)
}

export function getCardRewardChoiceCount(relics: RelicId[], baseChoices = 3): number {
    const delta = relics.reduce((sum, relicId) => sum + (RELIC_DEFS[relicId]?.cardRewardChoiceDelta ?? 0), 0)
    return Math.max(1, baseChoices + delta)
}
