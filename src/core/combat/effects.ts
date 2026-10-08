import { hasMuzzle } from '../modes/endless'
import { combatHealingAmount } from '../health'
import { CARD_DEFS } from '../cards'
import { gainMantra } from './stances'
import { hpLossAmount, recordHeartDamage, enemyDeathPowers } from './hp'
import type { Engine } from '../engine'
import type { Action, EmittedEvent, EntityId } from '../actions'
import { blockAmount, isDebuff, powerAmount } from '../combatMath'
import { onEnemyAttackDamage, onEnemyDamaged, onEnemyHitByPlayerAttack } from '../enemies'
import { triggerRelicPlayerHpLost } from '../relics'

export type CombatEffect = Extract<
    Action,
    { kind: 'SetHp' | 'Heal' | 'DealDamage' | 'RandomAttack' | 'DealMultiDamage' | 'LoseHp' | 'GainBlock' | 'ApplyPower' }
>
export function resolveCombatEffect(engine: Engine, action: CombatEffect, evts: EmittedEvent[]): void {
    switch (action.kind) {
        case 'SetHp': {
            const target = engine.getEntity(action.target)
            if (!target || target.hp <= 0) break
            const previous = target.hp
            target.hp = Math.max(0, Math.min(target.maxHp, action.hp))
            if ('name' in target) { onEnemyDamaged(engine, target, previous - target.hp); enemyDeathPowers(engine, target) }
            evts.push({ kind: 'HpLost', target: target.id, amount: previous - target.hp, resultingHp: target.hp })
            break
        }
        case 'Heal': {
            heal(engine, action.target, action.amount, evts)
            break
        }
        case 'DealDamage': {
            const target = engine.getEntity(action.target)
            if (!target || target.hp <= 0) break
            const source = engine.getEntity(action.source)
            if (source && source.hp <= 0 && action.damageType !== 'thorns') break
            const damage = engine.previewDamage(action.source, action.target, action.amount, action.damageType)
            if (source === engine.state.player && damage >= 99 && (action.damageType ?? 'attack') === 'attack') engine.state.scoreOverkill = true
            const previousBlock = target.block
            const blockUsed = Math.min(target.block, damage)
            target.block -= blockUsed
            const buffered = powerAmount(target, 'BUFFER') > 0
            let unblocked = damage - blockUsed
            if (source === engine.state.player && (action.damageType ?? 'attack') === 'attack' && unblocked > 0 && unblocked < 5 && engine.run?.relics.includes('THE_BOOT')) unblocked = 5
            const actualDamage = hpLossAmount(engine, target, unblocked, (action.damageType ?? 'attack') === 'attack', unblocked > damage - blockUsed)
            if (actualDamage > 0) {
                target.hp = Math.max(0, target.hp - actualDamage)
                if (target === engine.state.player) {
                    if (source !== engine.state.player) engine.state.enemyDamageTaken = (engine.state.enemyDamageTaken ?? 0) + actualDamage
                    engine.state.hpLossCount = (engine.state.hpLossCount ?? 0) + 1
                    if (action.fromCard) triggerRupture(engine)
                    if ((action.damageType ?? 'attack') === 'attack' && powerAmount(target, 'PLATED_ARMOR') > 0)
                        engine.setPowerStacks(target, 'PLATED_ARMOR', powerAmount(target, 'PLATED_ARMOR') - 1)
                }
                recordHeartDamage(target, actualDamage)
            }

            evts.push({
                kind: 'DamageApplied',
                source: action.source,
                target: action.target,
                amount: Math.round(damage),
                actualDamage,
                resultingHp: target.hp,
                resultingBlock: target.block,
            })

            if (action.blockOnDamage && actualDamage > 0) engine.enqueue({ kind: 'GainBlock', target: action.source, amount: actualDamage })

            if (action.lifestealTo && actualDamage > 0) {
                heal(engine, action.lifestealTo, actualDamage, evts)
            }

            if (target === engine.state.player && damage > blockUsed && !buffered && (action.damageType ?? 'attack') === 'attack')
                for (let i = 0; i < powerAmount(target, 'STATIC_DISCHARGE'); i++) engine.enqueue({ kind: 'ChannelOrb', orbType: 'lightning' })

            if (target === engine.state.player && actualDamage > 0 && engine.run) {
                triggerRelicPlayerHpLost(engine.getRelicContext(), actualDamage)
            }

            if (
                source &&
                'name' in source &&
                target === engine.state.player &&
                (action.damageType ?? 'attack') === 'attack'
            )
                onEnemyAttackDamage(engine, source, damage, actualDamage)
            if ('name' in target) { onEnemyDamaged(engine, target, actualDamage); enemyDeathPowers(engine, target) }
            if (
                'name' in target &&
                source?.id === engine.state.player.id &&
                (action.damageType ?? 'attack') === 'attack'
            ) {
                if (previousBlock > 0 && target.block === 0 && engine.run?.relics.includes('HAND_DRILL')) engine.enqueue({ kind: 'ApplyPower', target: target.id, powerId: 'VULNERABLE', stacks: 2 })
                const talk = powerAmount(target, 'TALK_TO_THE_HAND')
                if (talk > 0) engine.enqueue({ kind: 'GainBlock', target: engine.state.player.id, amount: talk })
                const envenom = powerAmount(engine.state.player, 'ENVENOM')
                if (actualDamage > 0 && envenom > 0 && target.hp > 0) engine.enqueue({ kind: 'ApplyPower', target: target.id, powerId: 'POISON', stacks: envenom })
                const armor = powerAmount(target, 'PLATED_ARMOR')
                if (actualDamage > 0 && armor > 0) {
                    engine.setPowerStacks(target, 'PLATED_ARMOR', armor - 1)
                    if (armor === 1 && target.specId === 'SHELLED_PARASITE')
                        target.intent = { kind: 'buff', desc: 'Stunned' }
                }
                onEnemyHitByPlayerAttack(engine, target, actualDamage)
                if (target.hp <= 0 && action.sourceCardInstanceId)
                    onEnemyKilledByCard(engine, action.sourceCardInstanceId, target.id)
            }

            if (source && (action.damageType ?? 'attack') === 'attack') {
                const thorns = target.powers.find((power) => power.id === 'THORNS')?.stacks ?? 0
                if (thorns > 0 && source.hp > 0 && source.id !== target.id) {
                    engine.enqueue({
                        kind: 'DealDamage',
                        source: target.id,
                        target: source.id,
                        amount: thorns,
                        damageType: 'thorns',
                    })
                }
            }

            break
        }
        case 'RandomAttack': {
            const living = engine.state.enemies.filter((enemy) => enemy.hp > 0)
            if (living.length)
                engine.enqueue({
                    kind: 'DealDamage',
                    source: action.source,
                    target: living[engine.rng.int(0, living.length - 1)].id,
                    amount: action.amount,
                    sourceCardInstanceId: action.sourceCardInstanceId,
                })
            break
        }
        case 'DealMultiDamage': {
            for (let i = 0; i < action.hits; i++) {
                engine.enqueue({
                    kind: 'DealDamage',
                    source: action.source,
                    target: action.target,
                    amount: action.amount,
                    damageType: action.damageType,
                    sourceCardInstanceId: action.sourceCardInstanceId,
                })
            }
            break
        }
        case 'LoseHp': {
            const target = engine.getEntity(action.target)
            if (!target) break
            const lost = hpLossAmount(engine, target, action.amount)
            target.hp = Math.max(0, target.hp - lost)
            if (target === engine.state.player && lost > 0) {
                engine.state.hpLossCount = (engine.state.hpLossCount ?? 0) + 1
                if (action.fromCard !== false) triggerRupture(engine)
            }
            recordHeartDamage(target, lost)
            if ('name' in target) { onEnemyDamaged(engine, target, lost); enemyDeathPowers(engine, target) }
            evts.push({ kind: 'HpLost', target: action.target, amount: action.amount, resultingHp: target.hp })
            if (target === engine.state.player && lost > 0 && engine.run) {
                triggerRelicPlayerHpLost(engine.getRelicContext(), lost)
            }
            break
        }
        case 'GainBlock': {
            const target = engine.getEntity(action.target)
            if (!target) break
            const amount = blockAmount(action.amount, target, action.blockSource)
            target.block += amount
            evts.push({ kind: 'BlockGained', target: action.target, amount, resultingBlock: target.block })
            if (target === engine.state.player) {
                const wave = powerAmount(target, 'WAVE_OF_THE_HAND')
                if (wave > 0 && amount > 0) for (const enemy of engine.state.enemies.filter(e => e.hp > 0)) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'WEAK', stacks: wave })
                const juggernaut = engine.state.player.powers.find((power) => power.id === 'JUGGERNAUT')?.stacks ?? 0
                if (juggernaut > 0 && amount > 0) {
                    const living = engine.state.enemies.filter((enemy) => enemy.hp > 0)
                    if (living.length > 0) {
                        const picked = living[engine.rng.int(0, living.length - 1)]
                        engine.enqueue({
                            kind: 'DealDamage',
                            source: engine.state.player.id,
                            target: picked.id,
                            amount: juggernaut,
                            damageType: 'effect',
                        })
                    }
                }
            }
            break
        }
        case 'ApplyPower': {
            const target = engine.getEntity(action.target)
            if (!target || target.hp <= 0 || action.stacks === 0) break
            if (target === engine.state.player && ((action.powerId === 'WEAK' && engine.run?.relics.includes('GINGER')) || (action.powerId === 'FRAIL' && engine.run?.relics.includes('TURNIP')))) break
            if (isDebuff(action.powerId, action.stacks) && powerAmount(target, 'ARTIFACT') > 0) {
                engine.setPowerStacks(target, 'ARTIFACT', powerAmount(target, 'ARTIFACT') - 1)
                break
            }
            if (target === engine.state.player && action.powerId === 'MANTRA') { gainMantra(engine, action.stacks); break }
            const stacks = action.stacks + (target !== engine.state.player && action.powerId === 'POISON' && action.stacks > 0 && engine.run?.relics.includes('SNECKO_SKULL') ? 1 : 0)
            if (target !== engine.state.player && action.powerId === 'VULNERABLE' && action.stacks > 0 && engine.run?.relics.includes('CHAMPION_BELT')) engine.enqueue({ kind: 'ApplyPower', target: target.id, powerId: 'WEAK', stacks: 1 })
            const current = target.powers.find((power) => power.id === action.powerId)
            if (current) current.stacks += stacks
            else target.powers.push({ id: action.powerId, stacks, fresh: engine.state.turn === 'enemy' })
            if (current && current.stacks === 0) target.powers = target.powers.filter((power) => power !== current)
            const sadistic = powerAmount(engine.state.player, 'SADISTIC_NATURE')
            if (target !== engine.state.player && isDebuff(action.powerId, action.stacks) && sadistic > 0) engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: target.id, amount: sadistic, damageType: 'effect', origin: 'power' })
            evts.push({ kind: 'PowerApplied', target: action.target, powerId: action.powerId, stacks })
            break
        }
    }
}

function triggerRupture(engine: Engine): void {
    const stacks = powerAmount(engine.state.player, 'RUPTURE')
    if (stacks > 0) engine.enqueue({ kind: 'ApplyPower', target: engine.state.player.id, powerId: 'STRENGTH', stacks })
}

function heal(engine: Engine, targetId: EntityId, amount: number, events: EmittedEvent[]): void {
    const target = engine.getEntity(targetId)
    if (!target || (targetId === engine.state.player.id && engine.run?.relics.includes('MARK_OF_THE_BLOOM'))) return
    if (targetId === engine.state.player.id) amount = combatHealingAmount(engine.run, amount)
    target.hp = Math.min(target.maxHp, target.hp + amount)
    events.push({ kind: 'Healed', target: targetId, amount, resultingHp: target.hp })
}

function onEnemyKilledByCard(engine: Engine, cardInstanceId: string, _enemyId: EntityId): void {
    const runtime = engine.getCombatCardRuntime(cardInstanceId)
    if (runtime.triggered) return
    const card = [
        ...engine.state.player.hand,
        ...engine.state.player.drawPile,
        ...engine.state.player.discardPile,
        ...engine.state.player.exhaustPile,
        ...(engine.getLimboCard() ? [engine.getLimboCard()!] : []),
        ...engine.state.player.deck,
    ].find((entry) => entry.instanceId === cardInstanceId)
    const victim = engine.state.enemies.find((enemy) => enemy.id === _enemyId)
    const regrowing =
        victim?.halfDead && !(victim.specId === 'DARKLING' && !engine.state.enemies.some((enemy) => enemy.hp > 0))
    if (!card || regrowing || victim?.tags?.includes('minion')) return
    CARD_DEFS[card.defId].onFatal?.({ engine, card })
    if (card.defId !== 'FEED' || hasMuzzle(engine.run)) return
    runtime.triggered = true
    const gain = card.upgradeLevel > 0 ? 4 : 3
    engine.state.player.maxHp += gain
    engine.enqueue({ kind: 'Heal', target: engine.state.player.id, amount: gain })
}
