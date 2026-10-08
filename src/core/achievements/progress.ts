import { CARD_DEFS, resolveCard } from '../cards'
import { isDebuff, powerAmount } from '../combatMath'
import type { Engine } from '../engine'
import type { MetaState } from '../meta'
import type { RunState } from '../run'
import type { CardInstance, EnemyState } from '../state'
import { ACHIEVEMENTS, ACHIEVEMENT_IDS, type AchievementCombat, type AchievementId } from './catalog'

export function earnAchievement(run: RunState | undefined, id: AchievementId): void {
    if (!run || (id === 'MY_LUCKY_DAY' ? run.mode !== 'daily' : run.mode !== 'standard' || !!run.modifiers?.length)) return
    const earned = run.earnedAchievements ??= []
    if (!earned.includes(id)) earned.push(id)
}
function metrics(engine: Engine): AchievementCombat {
    return engine.state.achievementStats ??= { exhausted: 0, attacks: 0, shivs: 0, plasma: 0, poisonKills: [] }
}
export function achievementCardPlayed(engine: Engine, card: CardInstance): void {
    const stats = metrics(engine)
    if (resolveCard(card).type === 'attack') stats.attacks++
    if (card.defId === 'SHIV') stats.shivs++
    checkCombatAchievements(engine)
}
export function achievementExhausted(engine: Engine): void { metrics(engine).exhausted++; checkCombatAchievements(engine) }
export function achievementTurnStarted(engine: Engine): void { const stats = metrics(engine); stats.shivs = 0; stats.plasma = 0 }
export function achievementOrbChanneled(engine: Engine, type: string): void {
    if (type === 'plasma') metrics(engine).plasma++
    checkCombatAchievements(engine)
}
export function achievementKilled(engine: Engine, victim: EnemyState, poison = false): void {
    if (victim.hp > 0 || victim.escaped) return
    // Awakened One's first phase is the game's explicit turn-one exception.
    if (victim.specId === 'AWAKENED_ONE' && victim.halfDead && (engine.state.turnNumber ?? 1) === 1) earnAchievement(engine.run, 'YOU_ARE_NOTHING')
    if (victim.halfDead) return
    if (victim.specId === 'TRANSIENT') earnAchievement(engine.run, 'THE_TRANSIENT')
    const kills = metrics(engine).poisonKills
    if (poison && !kills.includes(victim.id)) kills.push(victim.id)
    if (kills.length >= 3) earnAchievement(engine.run, 'PLAGUE')
}
export function checkCombatAchievements(engine: Engine): void {
    const run = engine.run
    if (!run || run.mode !== 'standard') return
    const state = engine.state, player = state.player, stats = metrics(engine)
    const check = (condition: boolean, id: AchievementId) => { if (condition) earnAchievement(run, id) }
    check(stats.exhausted >= 20, 'THE_PACT')
    check(player.energy >= 9, 'ADRENALINE')
    check(player.block >= 99, 'IMPERVIOUS'); check(player.block >= 999, 'BARRICADED')
    check(powerAmount(player, 'STRENGTH') >= 50, 'JAXXED'); check(powerAmount(player, 'FOCUS') >= 25, 'FOCUSED')
    check(state.enemies.some(enemy => powerAmount(enemy, 'POISON') >= 99), 'CATALYST')
    check(new Set(player.powers.filter(power => power.stacks > 0 && power.id !== 'COMBUST_HP_LOSS' && !isDebuff(power.id, power.stacks)).map(power => power.id)).size >= 10, 'POWERFUL')
    check(stats.shivs >= 10, 'NINJA'); check(stats.plasma >= 9, 'NEON'); check((state.cardsPlayed ?? 0) >= 25, 'INFINITY')
    check(run.floor > 3 && player.hand.length + player.drawPile.length + player.discardPile.length <= 3, 'PURITY')
}
const bossAchievements: Record<string, AchievementId> = {
    THE_GUARDIAN: 'THE_GUARDIAN', HEXAGHOST: 'THE_GHOST', SLIME_BOSS: 'THE_BOSS', THE_CHAMP: 'THE_CHAMPION',
    BRONZE_AUTOMATON: 'THE_AUTOMATON', THE_COLLECTOR: 'THE_COLLECTOR', DONU: 'THE_SHAPES', AWAKENED_ONE: 'THE_CROW', TIME_EATER: 'THE_TIME_EATER',
}
export function combatAchievements(run: RunState, engine: Engine): void {
    if (!engine.state.victory || engine.state.escaped || engine.state.enemies.some(enemy => enemy.escaped)) return
    if (engine.state.player.hp === 1) earnAchievement(run, 'SHRUG_IT_OFF')
    if (metrics(engine).attacks === 0) earnAchievement(run, 'COME_AT_ME')
    const bosses = engine.state.enemies.filter(enemy => enemy.tags?.includes('boss'))
    if (!bosses.length) return
    for (const boss of bosses) if (boss.specId && bossAchievements[boss.specId]) earnAchievement(run, bossAchievements[boss.specId])
    if (!(engine.state.enemyDamageTaken ?? 0)) earnAchievement(run, 'PERFECT')
    if ((engine.state.turnNumber ?? 1) === 1) earnAchievement(run, 'YOU_ARE_NOTHING')
}
const gems = { ironclad: 'RUBY', silent: 'EMERALD', defect: 'SAPPHIRE', watcher: 'AMETHYST' } as const
export function campaignAchievements(run: RunState): void {
    if (!run.actsCleared?.includes(3)) return
    earnAchievement(run, gems[run.character]); earnAchievement(run, 'ASCEND_0')
    if (run.asc >= 10) earnAchievement(run, 'ASCEND_10')
    if (run.asc >= 20) earnAchievement(run, 'ASCEND_20')
    if ((run.elapsedSeconds ?? Infinity) < 1200) earnAchievement(run, 'SPEED_CLIMBER')
    if (run.deck.length <= 5) earnAchievement(run, 'MINIMALIST')
    if (run.relics.length === 1) earnAchievement(run, 'WHO_NEEDS_RELICS')
    if (run.deck.every(card => !['uncommon', 'rare'].includes(CARD_DEFS[card.defId].rarity ?? 'special'))) earnAchievement(run, 'COMMON_SENSE')
}
export function endingAchievements(run: RunState): void {
    if (run.actsCleared?.includes(4)) earnAchievement(run, `${gems[run.character]}_PLUS`)
}
/** No storage or UI here: callers commit the updated profile at their checkpoint. */
export function commitAchievements(meta: MetaState, run: RunState, date = new Date().toISOString()): AchievementId[] {
    const unlocked: AchievementId[] = [], saved = meta.achievements ??= {}
    const add = (id: AchievementId) => {
        if (saved[id]) return
        saved[id] = date; unlocked.push(id)
        const [title, detail] = ACHIEVEMENTS[id]
        ;(meta.notifications ??= []).push({ id: `achievement:${id}`, title: `Achievement: ${title}`, detail })
    }
    for (const id of run.earnedAchievements ?? []) if (ACHIEVEMENTS[id]) add(id)
    if (saved.RUBY_PLUS && saved.EMERALD_PLUS && saved.SAPPHIRE_PLUS) add('THE_END')
    if (ACHIEVEMENT_IDS.filter(id => id !== 'ETERNAL_ONE').every(id => saved[id])) add('ETERNAL_ONE')
    return unlocked
}
