import { describe, expect, it } from 'vitest'
import { createCombatEngine } from '../../core/combat'
import { createNewRun } from '../../core/run'
import { orbValues, triggerOrb } from '../../core/combat/orbs'
import { combatHelp, enemyEffects, enemyIntent } from './combat'

function fixture() {
    const run = createNewRun({ seed: 'help', character: 'defect' })
    run.eventCombat = { enemies: ['CORRUPT_HEART'], rewards: { tier: 'boss', items: [] } }
    return { run, engine: createCombatEngine(run, 'boss') }
}
describe('combat help', () => {
    it('does not reveal hidden intents and includes boss counters', () => {
        const { run, engine } = fixture(), enemy = engine.state.enemies[0]
        enemy.intent = { kind: 'multi_attack', amount: 12, hits: 3 }
        expect(enemyIntent(engine, enemy)).toBe(`Attack ${engine.previewEnemyAttack(enemy)} × 3`)
        run.relics.push('RUNIC_DOME')
        expect(enemyIntent(engine, enemy)).toBe('Intent hidden by Runic Dome')
        const entries = combatHelp(engine, enemy.id)[0].entries
        expect(JSON.stringify(entries)).not.toContain('Attack 12')
        expect(enemyEffects(engine, enemy).map(entry => entry.title)).toEqual(expect.arrayContaining(['Invincible: 300 remaining', 'Beat of Death: 1']))
    })
    it('distinguishes the mandatory Awakened One second phase from Darkling revival', () => {
        const { engine } = fixture(), enemy = engine.state.enemies[0]
        enemy.halfDead = true; enemy.specId = 'AWAKENED_ONE'
        expect(enemyEffects(engine, enemy).at(-1)?.description).toContain('even if its Cultists')
        enemy.specId = 'DARKLING'
        expect(enemyEffects(engine, enemy).at(-1)?.description).toContain('unless')
    })
    it('explains relic exceptions and combines the Combust implementation counter', () => {
        const { run, engine } = fixture()
        run.relics.push('ODD_MUSHROOM', 'PAPER_KRANE', 'VIOLET_LOTUS')
        engine.state.player.character = 'watcher'
        engine.state.player.powers = [{ id: 'COMBUST', stacks: 10 }, { id: 'COMBUST_HP_LOSS', stacks: 2 }, { id: 'VULNERABLE', stacks: 1 }]
        engine.state.enemies[0].powers = [{ id: 'WEAK', stacks: 2 }]
        const help = JSON.stringify(combatHelp(engine))
        expect(help).toContain('Current HP cost: 2')
        expect(help).not.toContain('Combust Hp Loss')
        expect(help).toContain('extra damage taken to 25%')
        expect(help).toContain('reduction to 40%')
        expect(help).toContain('Leaving Calm grants 3 energy')
    })
    it('uses the same orb values for rules and inspection', () => {
        const { engine } = fixture(), player = engine.state.player
        player.powers = [{ id: 'FOCUS', stacks: -1 }]
        const frost = { type: 'frost' as const, storedDamage: 0 }
        player.orbs = [frost, { type: 'dark', storedDamage: 19 }, { type: 'plasma', storedDamage: 0 }]
        const before = player.block
        triggerOrb(engine, frost, 'evoke'); engine.runUntilIdle()
        expect(player.block - before).toBe(orbValues(frost, -1).evoke)
        const text = JSON.stringify(combatHelp(engine, player.id))
        expect(text).toContain('Gains 1 Block at end of turn, or 4 when Evoked')
        expect(text).toContain('Evoke deals 19')
        expect(text).toContain('Gains 1 energy at start of turn, or 2 when Evoked')
    })
})
