import type { Engine } from '../../src/core/engine'
import { resolveCard } from '../../src/core/cards'
import type { CardInstance, CombatState, EnemyState } from '../../src/core/state'
import type { GeneratedMap, MapNode } from '../../src/core/map'

// A deterministic, deliberately small player for the end-to-end run. It only
// chooses legal actions from visible information; the browser executes them.
const priorities: Record<string, number> = {
    FOOTWORK: 95, NOXIOUS_FUMES: 90, DEADLY_POISON: 70, BOUNCING_FLASK: 70, CATALYST: 85, CORPSE_EXPLOSION: 90,
    BACKFLIP: 80, LEG_SWEEP: 80, DASH: 75, BLADE_DANCE: 70, CLOAK_AND_DAGGER: 70, AFTER_IMAGE: 90,
    PIERCING_WAIL: 65, DODGE_AND_ROLL: 65, BLUR: 65, DIE_DIE_DIE: 70, ADRENALINE: 90,
    GLACIER: 90, COOLHEADED: 85, DEFRAGMENT: 95, CAPACITOR: 85, LOOP: 90, ELECTRODYNAMICS: 95,
    SELF_REPAIR: 90, CHILL: 80, BALL_LIGHTNING: 80, COLD_SNAP: 85, LEAP: 60, CHARGE_BATTERY: 65, REINFORCED_BODY: 75,
    ECHO_FORM: 95, CREATIVE_AI: 70, BUFFER: 85, DOOM_AND_GLOOM: 65, ZAP: 45, DUALCAST: 40,
    DEVA_FORM: 100, ESTABLISHMENT: 90, TANTRUM: 100, RUSHDOWN: 85, TRANQUILITY: 75, INNER_PEACE: 75, EMPTY_MIND: 75, FLURRY_OF_BLOWS: 80, FASTING: 80, TALK_TO_THE_HAND: 95, MENTAL_FORTRESS: 90, LIKE_WATER: 90, WALLOP: 85, PROTECT: 75, HALT: 70,
    EMPTY_FIST: 80, EMPTY_BODY: 70, FEAR_NO_EVIL: 85, WHEEL_KICK: 70, CUT_THROUGH_FATE: 80, CARVE_REALITY: 80,
    CONSECRATE: 60, FLYING_SLEEVES: 65, ERUPTION: 90, VIGILANCE: 60, DEVOTION: 90, WORSHIP: 70, PROSTRATE: 70,
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

export function choosePlay(state: CombatState, legal: ReturnType<Engine['getPlayableCards']>): { card: CardInstance; enemyIndex?: number } | undefined {
    const player = state.player
    const living = state.enemies.filter(enemy => enemy.hp > 0)
    const incoming = (player.stance === 'wrath' ? 2 : 1) * living.reduce((sum, enemy) => sum + incomingDamage(enemy), 0) * (stacks(player, 'VULNERABLE') ? 1.5 : 1)
    const passiveBlock = player.orbs.filter(orb => orb.type === 'frost').length * Math.max(0, 2 + stacks(player, 'FOCUS')) + stacks(player, 'METALLICIZE') + stacks(player, 'PLATED_ARMOR')
    const blockNeeded = Math.max(0, incoming - player.block - passiveBlock)
    const choices: Array<{ card: CardInstance; enemyIndex?: number; score: number }> = []
    for (const { card, cost, targets } of legal) {
        const def = resolveCard(card)
        const enemy = def.targeting?.type === 'single_enemy' ? living.find(enemy => enemy.id === targets[0]) : undefined
        let score = player.hand.length >= 8 ? 0.2 : 0
        const attackTargets = enemy ? [enemy] : def.targeting?.type === 'all_enemies' ? living : []
        for (const target of attackTargets) {
            const base = card.defId === 'BODY_SLAM' ? player.block : def.baseDamage ?? 0
            const hits = card.defId === 'TWIN_STRIKE' || card.defId === 'FLYING_SLEEVES' ? 2 : card.defId === 'TANTRUM' ? (card.upgradeLevel ? 4 : 3) : card.defId === 'PUMMEL' ? 4 : 1
            const damage = Math.max(0, Math.floor((base + stacks(player, 'STRENGTH')) * (player.stance === 'wrath' ? 2 : player.stance === 'divinity' ? 3 : 1) * (stacks(player, 'WEAK') ? 0.75 : 1) * (stacks(target, 'VULNERABLE') ? 1.5 : 1)) * hits - target.block)
            score += Math.min(Math.max(0, damage), target.hp) + Math.min(damage + target.block, target.block) * 0.8
            if (damage >= target.hp) score += 12 + incomingDamage(target) * 2
            if (player.character === 'watcher' && def.type === 'attack') score -= Math.max(0, stacks(target, 'THORNS') * hits - player.block) * 2.5
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
        const id = card.defId
        const future = living.some(e => e.hp > 30)
        if (def.type === 'power' && !['INFLAME', 'DEMON_FORM', 'METALLICIZE'].includes(id)) score += future ? cardPriority(id) * 0.6 + 12 : 4
        if (['DEADLY_POISON', 'BOUNCING_FLASK', 'CORPSE_EXPLOSION'].includes(id)) score += future ? 25 : 8
        if (id === 'CATALYST') score += (enemy ? stacks(enemy, 'POISON') : 0) * (card.upgradeLevel ? 2 : 1)
        if (id === 'NEUTRALIZE' && enemy && !stacks(enemy, 'WEAK')) score += incomingDamage(enemy) * 0.5 + 3
        if (['BLADE_DANCE', 'CLOAK_AND_DAGGER'].includes(id)) score += id === 'BLADE_DANCE' ? (card.upgradeLevel ? 16 : 12) : 4
        if (id === 'ADRENALINE') score += 45
        if (['BACKFLIP', 'COOLHEADED', 'CUT_THROUGH_FATE', 'WHEEL_KICK'].includes(id) && player.hand.length < 8) score += 7
        if (['ZAP', 'BALL_LIGHTNING', 'COLD_SNAP', 'GLACIER', 'COOLHEADED', 'CHILL'].includes(id)) score += 10 + stacks(player, 'FOCUS') * 3
        if (id === 'DUALCAST' && player.orbs.length) score += player.orbs[0].type === 'frost' ? Math.min(blockNeeded, 2 * (5 + stacks(player, 'FOCUS'))) : player.orbs[0].type === 'dark' ? player.orbs[0].storedDamage * 2 : 16
        if (id === 'LEG_SWEEP' && enemy && !stacks(enemy, 'WEAK')) score += incomingDamage(enemy) * 0.6
        if (id === 'PIERCING_WAIL') score += Math.max(0, incoming - player.block) * 0.8
        if (['INNER_PEACE', 'TRANQUILITY'].includes(id) && player.stance !== 'calm') score += 15
        if (id === 'EMPTY_MIND') score += player.stance === 'calm' ? 25 : 12
        if (id === 'TALK_TO_THE_HAND' && enemy && enemy.hp > 15) score += 35
        if (id === 'WALLOP') score += Math.min(blockNeeded, (def.baseDamage ?? 0) * (player.stance === 'wrath' ? 2 : 1)) * 1.8
        if (['WORSHIP', 'PROSTRATE'].includes(id) && future) score += 20
        if (id === 'MIRACLE' && player.hand.some(c => resolveCard(c).cost > player.energy)) score += 50
        if (id === 'ERUPTION' || id === 'TANTRUM') {
            const canExit = legal.some(p => ['VIGILANCE', 'EMPTY_BODY', 'EMPTY_FIST', 'FEAR_NO_EVIL', 'EMPTY_MIND', 'INNER_PEACE', 'TRANQUILITY'].includes(p.card.defId) && (p.card.defId !== 'FEAR_NO_EVIL' || living.some(e => p.targets.includes(e.id) && incomingDamage(e) > 0)) && p.cost <= player.energy - cost + (player.stance === 'calm' ? 2 : 0))
            const wrathIncoming = incoming * (player.stance === 'wrath' ? 1 : 2)
            if (wrathIncoming > player.block && !canExit && !(living.length === 1 && living[0].hp <= (def.baseDamage ?? 0))) continue
            score += player.stance !== 'wrath' ? 60 : 0
        }
        if (['VIGILANCE', 'EMPTY_BODY', 'EMPTY_FIST', 'FEAR_NO_EVIL', 'EMPTY_MIND', 'INNER_PEACE', 'TRANQUILITY'].includes(id) && (id !== 'FEAR_NO_EVIL' || enemy && incomingDamage(enemy) > 0)) {
            if (player.stance === 'wrath' && incoming > player.block) {
                const attackFirst = legal.some(p => p.card.instanceId !== card.instanceId && resolveCard(p.card).type === 'attack' && !['EMPTY_FIST', 'FEAR_NO_EVIL'].includes(p.card.defId) && p.cost <= player.energy - cost)
                if (attackFirst) continue
                score += incoming
            }
            else if (id === 'VIGILANCE' && player.stance !== 'calm') score += 6
            if (player.stance === 'wrath' && incoming <= player.block && player.energy > cost) score -= 15
        }
        choices.push({ card, enemyIndex: enemy ? state.enemies.indexOf(enemy) : undefined, score: score / Math.max(0.75, cost) })
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
