import type { Engine } from '../../core/engine'
import type { EnemyState, PlayerState } from '../../core/state'
import { CHARACTERS } from '../../core/characters'
import { powerAmount } from '../../core/combatMath'
import { orbValues } from '../../core/combat/orbs'
import { POWER_HELP, titleCase, type HelpEntry, type HelpSection } from './content'

export function enemyIntent(engine: Engine, enemy: EnemyState): string {
    if (engine.run?.relics.includes('RUNIC_DOME')) return 'Intent hidden by Runic Dome'
    const intent = enemy.intent
    if (intent?.kind === 'attack') return `Attack ${engine.previewEnemyAttack(enemy)}`
    if (intent?.kind === 'multi_attack') return `Attack ${engine.previewEnemyAttack(enemy)} × ${intent.hits}`
    if (intent?.kind === 'block') return `Block ${intent.amount}`
    if (intent?.kind === 'debuff') return titleCase(intent.debuff)
    if (intent?.kind === 'status') return `Add ${intent.count} ${titleCase(intent.createdDefId)}`
    if (intent?.kind === 'summon') return 'Summon'
    return intent?.desc ?? 'Buff'
}

export function powerEntries(engine: Engine, entity: PlayerState | EnemyState): HelpEntry[] {
    return entity.powers.filter(power => power.stacks !== 0 && power.id !== 'COMBUST_HP_LOSS').map(power => {
        let description = POWER_HELP[power.id]
        if (power.id === 'COMBUST') description += ` Current HP cost: ${powerAmount(entity, 'COMBUST_HP_LOSS') || 1}.`
        if (power.id === 'WEAK' && entity !== engine.state.player && engine.run?.relics.includes('PAPER_KRANE')) description += ' Paper Krane changes this enemy\'s reduction to 40%.'
        if (power.id === 'VULNERABLE' && engine.run?.relics.includes(entity === engine.state.player ? 'ODD_MUSHROOM' : 'PAPER_FROG'))
            description += entity === engine.state.player ? ' Odd Mushroom changes your extra damage taken to 25%.' : ' Paper Frog changes this enemy\'s extra damage taken to 75%.'
        return { title: `${titleCase(power.id)}: ${power.stacks}`, description }
    })
}

export function enemyEffects(engine: Engine, enemy: EnemyState): HelpEntry[] {
    const entries = powerEntries(engine, enemy)
    const add = (title: string, description: string) => entries.push({ title, description })
    if (enemy.specId === 'BYRD') {
        if (enemy.aiState?.flying) add(`Flying: ${Math.max(0, ((enemy.asc ?? 0) >= 17 ? 4 : 3) - Number(enemy.aiState.hitsTaken ?? 0))} hits remaining`, 'Takes half attack damage until knocked down by enough attack hits in one turn.')
        if (enemy.aiState?.downed) add('Downed', 'Flight is disabled. This enemy must recover before flying again.')
    }
    if (enemy.specId === 'TIME_EATER') add(`Time Warp: ${enemy.aiState?.cards ?? 0}/12`, 'Every 12 cards played ends your turn and grants the Time Eater 2 Strength.')
    if (enemy.specId === 'CORRUPT_HEART') {
        add(`Invincible: ${Math.max(0, ((enemy.asc ?? 0) >= 19 ? 200 : 300) - Number(enemy.aiState?.damageThisTurn ?? 0))} remaining`, 'Damage this enemy can still take this turn. The limit resets next turn.')
        add(`Beat of Death: ${((enemy.asc ?? 0) >= 19 ? 2 : 1) + (Number(enemy.aiState?.buffs ?? 0) >= 2 ? 1 : 0)}`, 'Deals this much damage to you whenever you play a card. Block can absorb it.')
    }
    if (enemy.specId === 'GIANT_HEAD') add(`Slow: ${enemy.aiState?.slow ?? 0}`, POWER_HELP.SLOW)
    if (engine.state.enemies.filter(e => e.hp > 0 && ['SPIRE_SHIELD', 'SPIRE_SPEAR'].includes(e.specId ?? '')).length === 2)
        add(enemy.id === (engine.state.facingEnemyId ?? engine.state.enemies[0].id) ? 'Facing' : 'Behind', 'Attacks from the enemy behind you deal 50% extra damage. Targeting an enemy turns you to face it.')
    if (enemy.halfDead) add('Reviving', enemy.specId === 'AWAKENED_ONE' ? 'Will return for its second phase, even if its Cultists have been defeated.' : 'Will return unless the encounter\'s other enemies are defeated in time.')
    return entries
}

export function combatHelp(engine: Engine, entityId?: string): HelpSection[] {
    const player = engine.state.player
    const sections: HelpSection[] = []
    if (!entityId || entityId === player.id) {
        const entries = [{ title: `${player.hp}/${player.maxHp} HP · ${player.block} Block · ${player.energy} energy`, description: 'Block absorbs damage before HP is lost. Energy pays for cards this turn.' }, ...powerEntries(engine, player)]
        if (player.orbSlots) {
            entries.push({ title: `Orbs: ${player.orbs.length}/${player.orbSlots} slots · Focus ${powerAmount(player, 'FOCUS')}`, description: 'Orbs are listed first to last. Channeling with full slots Evokes the first orb.' })
            for (const [index, orb] of player.orbs.entries()) {
                const { passive, evoke } = orbValues(orb, powerAmount(player, 'FOCUS'))
                const descriptions = {
                    lightning: `Deals ${passive} damage at end of turn, or ${evoke} when Evoked. ${powerAmount(player, 'ELECTRODYNAMICS') ? 'Hits all enemies.' : 'Hits a random enemy.'} Lock-On increases orb damage to that enemy.`,
                    frost: `Gains ${passive} Block at end of turn, or ${evoke} when Evoked.`,
                    dark: `Stores ${passive} more damage at end of turn. Evoke deals ${evoke} to the lowest-HP enemy. Lock-On increases orb damage to that enemy.`,
                    plasma: `Gains ${passive} energy at start of turn, or ${evoke} when Evoked. Focus does not change Plasma.`,
                }
                entries.push({ title: `Orb ${index + 1}: ${titleCase(orb.type)}`, description: descriptions[orb.type] })
            }
        }
        if (player.character === 'watcher' || player.stance !== 'neutral') entries.push({ title: `Stance: ${titleCase(player.stance)}`, description: `Wrath doubles attack damage dealt and taken. Leaving Calm grants ${engine.run?.relics.includes('VIOLET_LOTUS') ? 3 : 2} energy. Entering Divinity grants 3 energy and triples attack damage; it ends next turn.` })
        sections.push({ title: CHARACTERS[player.character].name, entries })
    }
    for (const enemy of engine.state.enemies.filter(enemy => !entityId || enemy.id === entityId)) sections.push({
        title: enemy.name,
        entries: [{ title: `${enemy.hp}/${enemy.maxHp} HP · ${enemy.block} Block`, description: enemyIntent(engine, enemy) }, ...enemyEffects(engine, enemy)],
    })
    return sections
}
