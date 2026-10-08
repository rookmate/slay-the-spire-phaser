import { CARD_DEFS, resolveCard } from '../../src/core/cards'
import type { CardInstance, CombatState, EnemyState } from '../../src/core/state'
import type { GeneratedMap, MapNode } from '../../src/core/map'

// A deterministic, deliberately small player for the end-to-end run. It only
// chooses legal actions from visible information; the browser executes them.
const priorities: Record<string, number> = {
    INFLAME: 90, CARNAGE: 65, SEVER_SOUL: 55, APOTHEOSIS: 99, MASTER_OF_STRATEGY: 75, DEMON_FORM: 100, REAPER: 95, SPOT_WEAKNESS: 90, SHRUG_IT_OFF: 80,
    FLAME_BARRIER: 80, METALLICIZE: 75, TWIN_STRIKE: 70, CLEAVE: 70,
    IRON_WAVE: 65, POMMEL_STRIKE: 65, UPPERCUT: 60, SWORD_BOOMERANG: 60,
    IMPERVIOUS: 65, GHOSTLY_ARMOR: 60, BATTLE_TRANCE: 60, ANGER: 55,
    CLOTHESLINE: 50, THUNDERCLAP: 45, BLUDGEON: 45, BODY_SLAM: 35,
}
export const cardPriority = (id: string) => priorities[id] ?? 0
const stacks = (entity: CombatState['player'] | EnemyState, id: string) => entity.powers.find(power => power.id === id)?.stacks ?? 0

export function incomingDamage(enemy: EnemyState): number {
    if (enemy.hp <= 0) return 0
    const intent = enemy.intent
    const hits = intent?.kind === 'multi_attack' ? intent.hits : 1
    const base = intent?.kind === 'attack' || intent?.kind === 'multi_attack' ? intent.amount + stacks(enemy, 'STRENGTH') : 0
    return Math.floor(base * (stacks(enemy, 'WEAK') ? 0.75 : 1)) * hits
}

export function choosePlay(state: CombatState): { card: CardInstance; enemyIndex?: number } | undefined {
    const player = state.player
    const living = state.enemies.filter(enemy => enemy.hp > 0)
    const incoming = living.reduce((sum, enemy) => sum + incomingDamage(enemy), 0) * (stacks(player, 'VULNERABLE') ? 1.5 : 1)
    const blockNeeded = Math.max(0, incoming - player.block)
    const choices: Array<{ card: CardInstance; enemyIndex?: number; score: number }> = []
    for (const card of player.hand) {
        const def = resolveCard(card)
        const cost = card.costForTurn ?? card.costForCombat ?? card.confusedCost ?? def.cost
        if (def.unplayable || cost > player.energy || (def.type === 'attack' && stacks(player, 'ENTANGLED') > 0)) continue
        if ((state.cardsPlayed ?? 0) >= 3 && player.hand.some(c => c.defId === 'NORMALITY')) continue
        if (card.defId === 'CLASH' && player.hand.some(entry => CARD_DEFS[entry.defId].type !== 'attack')) continue
        const targets = def.targeting?.type === 'single_enemy' ? living : [undefined]
        for (const enemy of targets) {
            let score = 0
            const attackTargets = enemy ? [enemy] : def.targeting?.type === 'all_enemies' ? living : []
            for (const target of attackTargets) {
                const base = card.defId === 'BODY_SLAM' ? player.block : def.baseDamage ?? 0
                const hits = card.defId === 'TWIN_STRIKE' ? 2 : card.defId === 'PUMMEL' ? 4 : 1
                const damage = Math.max(0, Math.floor((base + stacks(player, 'STRENGTH')) * (stacks(player, 'WEAK') ? 0.75 : 1) * (stacks(target, 'VULNERABLE') ? 1.5 : 1)) * hits - target.block)
                score += Math.min(damage, target.hp)
                if (damage >= target.hp) score += 12 + incomingDamage(target) * 2
                if (card.defId === 'REAPER') score += Math.min(damage, target.hp, player.maxHp - player.hp) * 2
            }
            score += Math.min(blockNeeded, (def.baseBlock ?? 0) + (def.baseBlock ? stacks(player, 'DEXTERITY') : 0)) * 1.8
            if (card.defId === 'INFLAME') score += 45
            if (card.defId === 'APOTHEOSIS') score += 90
            if (card.defId === 'MASTER_OF_STRATEGY' && player.hand.length < 8) score += 15
            if (card.defId === 'DEMON_FORM') score += living.some(e => e.hp > 35) ? 90 : 0
            if (card.defId === 'SPOT_WEAKNESS' && living.some(e => incomingDamage(e) > 0)) score += 40
            if (card.defId === 'METALLICIZE') score += 24
            if (card.defId === 'BATTLE_TRANCE' && player.hand.length < 8) score += 20
            if (card.defId === 'POMMEL_STRIKE' || card.defId === 'SHRUG_IT_OFF') score += 3
            if (card.defId === 'SWORD_BOOMERANG') score += (3 + stacks(player, 'STRENGTH')) * 3
            if (card.defId === 'BASH' && enemy && !stacks(enemy, 'VULNERABLE')) score += 7
            if (card.defId === 'UPPERCUT' && enemy && !stacks(enemy, 'WEAK')) score += incomingDamage(enemy) * 0.5 + 5
            if (card.defId === 'FLAME_BARRIER') score += living.filter(e => incomingDamage(e) > 0).length * 4
            choices.push({ card, enemyIndex: enemy ? state.enemies.indexOf(enemy) : undefined, score: score / Math.max(0.75, cost) })
        }
    }
    return choices.filter(choice => choice.score > 0).sort((a, b) => b.score - a.score)[0]
}

export function chooseRoute(map: GeneratedMap, currentId?: string): MapNode {
    const costs: Record<string, number> = { boss: 0, rest: -5, chest: -8, shop: -2, unknown: 1, monster: 3, elite: 30, start: 0 }
    const memo = new Map<string, number>()
    function cost(node: MapNode): number {
        if (!memo.has(node.id)) memo.set(node.id, costs[node.kind] + (node.edgesTo.length ? Math.min(...node.edgesTo.map(id => cost(map.byId[id]))) : 0))
        return memo.get(node.id)!
    }
    const available = (currentId ? map.byId[currentId].edgesTo : map.startIds).map(id => map.byId[id])
    return available.sort((a, b) => cost(a) - cost(b))[0]
}
