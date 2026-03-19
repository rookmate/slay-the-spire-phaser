import type { RoomKind } from './map'
import type { RunState, RelicId } from './run'

export interface RelicDef {
    id: RelicId
    name: string
    description: string
    rarity: 'starter' | 'common' | 'uncommon' | 'boss'
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
    BURNING_BLOOD: { id: 'BURNING_BLOOD', name: 'Burning Blood', description: 'Heal 6 HP after combat.', rarity: 'starter' },
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
    if (run.relics.includes(relicId)) return
    run.relics.push(relicId)
    if (relicId === 'STRAWBERRY') {
        run.player.maxHp += 7
        run.player.hp += 7
    }
}

export function getPostCombatHeal(relics: RelicId[]): number {
    return relics.includes('BURNING_BLOOD') ? 6 : 0
}
