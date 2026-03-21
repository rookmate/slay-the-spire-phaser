import { describe, expect, it } from 'vitest'
import { getAscensionEnemyDamageMultiplier, getAscensionEnemyHpMultiplier, pickMoreAggressiveIntent } from './ascension'
import { CARD_DEFS, createCardInstance, getUnlockedCollectibleCards, resolveCard } from './cards'
import type { CardInstance, PlayerState } from './state'
import { Engine, createDummyEnemy, createSimplePlayer } from './engine'
import { RNG } from './rng'
import { createEnemyFromSpec, rollEngineIntentForEnemy } from './enemies'
import { applyRelicAcquisition, BOSS_RELIC_POOL, blocksPotionGain, canRestAtCampfire, getCardRewardChoiceCount, getCombatRelicBonuses, getMerchantRemoveBaseCost, getPostCombatHeal, getRelicEnergyBonus, getRelicState, getShopPriceMultiplier, getUnlockedRelicPool } from './relics'
import { generateRewardBundle } from './rewards'
import { clampAscension, getEffectiveUnlockedCardIds, getEffectiveUnlockedRelicIds, getSelectableAscensions, grantNextIroncladUnlock, unlockNextAscension } from './meta'
import { createNewRun, obtainCurse } from './run'
import { applyNeowOption, getNeowRareCardChoices, getRandomNeowRelic, rollNeowOptions } from './neow'
import { generateEncounter } from './encounters'
import { generateEvent, getEventPool, resolveEventChoice, transformCard } from './events'
import { generateMap } from './map'

function createPlayerWithHand(handIds: string[]): PlayerState {
    const player = createSimplePlayer('test-player')
    const hand: CardInstance[] = handIds.map(defId => createCardInstance(defId))
    player.hand = hand
    player.deck = [...hand]
    player.drawPile = []
    player.discardPile = []
    player.exhaustPile = []
    player.energy = 3
    player.hp = 200
    player.maxHp = 200
    player.powers = []
    return player
}

function playAndResolve(engine: Engine, card: CardInstance, targets: string[]): void {
    engine.playCard(card, targets)
    engine.runUntilIdle()
}

describe('deferred card systems', () => {
    it('creates new runs with instance ids and upgrade levels', () => {
        const run = createNewRun('run-seed')

        expect(run.deck).toHaveLength(10)
        expect(run.deck.every(card => typeof card.instanceId === 'string' && card.upgradeLevel === 0)).toBe(true)
        expect(run.neowCompleted).toBe(false)
        expect(run.act).toBe(1)
        expect(run.asc).toBe(0)
    })

    it('creates ascension runs with lowered starting hp at a5+', () => {
        const run = createNewRun('a5-seed', 5)

        expect(run.asc).toBe(5)
        expect(run.player.maxHp).toBe(75)
        expect(run.player.hp).toBe(75)
    })

    it('unlocks ascensions sequentially and clamps progression at a10', () => {
        const meta = { bestAscensionUnlocked: 0, totalWins: 0, totalRuns: 0, ironcladUnlockTier: 0, unlockedCardIds: [], unlockedRelicIds: [] }

        expect(getSelectableAscensions(meta)).toEqual([0])
        expect(unlockNextAscension(meta, 0)).toBe(true)
        expect(meta.bestAscensionUnlocked).toBe(1)
        expect(unlockNextAscension(meta, 0)).toBe(false)
        meta.bestAscensionUnlocked = 10
        expect(unlockNextAscension(meta, 10)).toBe(false)
        expect(clampAscension(14)).toBe(10)
    })

    it('starts with the base unlock pool and grants ironclad tiers sequentially', () => {
        const meta = { bestAscensionUnlocked: 0, totalWins: 0, totalRuns: 0, ironcladUnlockTier: 0, unlockedCardIds: [], unlockedRelicIds: [] }

        expect(getEffectiveUnlockedCardIds(meta).has('CLEAVE')).toBe(true)
        expect(getEffectiveUnlockedCardIds(meta).has('ARMAMENTS')).toBe(false)
        expect(getEffectiveUnlockedRelicIds(meta).has('ANCHOR')).toBe(true)
        expect(getEffectiveUnlockedRelicIds(meta).has('STRAWBERRY')).toBe(false)

        const bundle = grantNextIroncladUnlock(meta)
        expect(bundle?.tier).toBe(1)
        expect(meta.ironcladUnlockTier).toBe(1)
        expect(getEffectiveUnlockedCardIds(meta).has('ARMAMENTS')).toBe(true)
        expect(getEffectiveUnlockedRelicIds(meta).has('STRAWBERRY')).toBe(true)
    })

    it('extends the ironclad unlock track to ten tiers and grants tier seven after six wins', () => {
        const meta = { bestAscensionUnlocked: 0, totalWins: 0, totalRuns: 0, ironcladUnlockTier: 0, unlockedCardIds: [], unlockedRelicIds: [] }

        for (let i = 0; i < 6; i++) grantNextIroncladUnlock(meta)
        const bundle = grantNextIroncladUnlock(meta)

        expect(bundle?.tier).toBe(7)
        expect(meta.ironcladUnlockTier).toBe(7)
        expect(getEffectiveUnlockedCardIds(meta).has('DISARM')).toBe(true)
        expect(getEffectiveUnlockedRelicIds(meta).has('HAPPY_FLOWER')).toBe(true)
    })

    it('rolls deterministic neow options and applies rewards', () => {
        const run = createNewRun('neow-seed')
        const meta = {
            bestAscensionUnlocked: 0,
            totalWins: 0,
            totalRuns: 0,
            ironcladUnlockTier: 0,
            unlockedCardIds: [],
            unlockedRelicIds: [],
        }
        grantNextIroncladUnlock(meta)
        grantNextIroncladUnlock(meta)
        grantNextIroncladUnlock(meta)
        grantNextIroncladUnlock(meta)
        grantNextIroncladUnlock(meta)
        grantNextIroncladUnlock(meta)
        const options = rollNeowOptions(run.neowSeed)
        const rerolled = rollNeowOptions(run.neowSeed)
        const relicId = getRandomNeowRelic(`${run.neowSeed}-GAIN_COMMON_RELIC_REGRET`, run, meta)
        const rareChoices = getNeowRareCardChoices(`${run.neowSeed}-GAIN_RARE_CARD_PAIN`, meta)

        expect(options.map(option => option.id)).toEqual(rerolled.map(option => option.id))
        expect(options.filter(option => option.category === 'benefit')).toHaveLength(2)
        expect(options.filter(option => option.category === 'tradeoff')).toHaveLength(2)
        expect(rareChoices.every(cardId => getEffectiveUnlockedCardIds(meta).has(cardId))).toBe(true)

        applyNeowOption(run, 'GAIN_COMMON_RELIC_REGRET', { rewardRelicId: relicId })
        expect(run.relics).toContain(relicId)
        expect(run.deck.some(card => card.defId === 'REGRET')).toBe(true)
        expect(run.neowCompleted).toBe(true)
        expect(run.neowChoiceId).toBe('GAIN_COMMON_RELIC_REGRET')

        const secondRun = createNewRun('neow-seed-2')
        applyNeowOption(secondRun, 'GAIN_RARE_CARD_PAIN', { rewardCardId: rareChoices[0] })
        expect(secondRun.deck.some(card => card.defId === rareChoices[0])).toBe(true)
        expect(secondRun.deck.some(card => card.defId === 'PAIN')).toBe(true)
    })

    it('resolves upgrade levels and searing blow scaling', () => {
        const strike = resolveCard(createCardInstance('STRIKE', 1))
        const bodySlam = resolveCard(createCardInstance('BODY_SLAM', 1))
        const searingBlow = resolveCard(createCardInstance('SEARING_BLOW', 3))

        expect(strike.baseDamage).toBe(9)
        expect(strike.name).toBe('Strike+')
        expect(bodySlam.cost).toBe(0)
        expect(searingBlow.name).toBe('Searing Blow+3')
        expect(searingBlow.baseDamage).toBe(27)
    })

    it('creates a pending choice and blocks other combat input until resolved', () => {
        const player = createPlayerWithHand(['ARMAMENTS', 'STRIKE'])
        const engine = new Engine('choice-seed', player, [createDummyEnemy('e1')])
        const armaments = engine.state.player.hand[0]
        const strike = engine.state.player.hand[1]

        engine.playCard(armaments, [])
        engine.runUntilIdle()

        expect(engine.getPendingChoice()?.zone).toBe('hand')
        expect(engine.playCard(strike, ['e1'])).toEqual([])

        engine.submitPendingChoice([strike.instanceId])
        engine.runUntilIdle()

        expect(engine.getPendingChoice()).toBeUndefined()
        expect(engine.state.player.hand.find(card => card.instanceId === strike.instanceId)?.upgradeLevel).toBe(1)
    })

    it('headbutt moves a chosen discard card to the top of the draw pile', () => {
        const player = createPlayerWithHand(['HEADBUTT'])
        const returned = createCardInstance('STRIKE')
        player.discardPile = [returned]
        const engine = new Engine('headbutt-seed', player, [createDummyEnemy('e1')])

        engine.playCard(engine.state.player.hand[0], ['e1'])
        engine.runUntilIdle()

        expect(engine.getPendingChoice()?.zone).toBe('discard')
        engine.submitPendingChoice([returned.instanceId])
        engine.runUntilIdle()

        expect(engine.state.player.drawPile[0]?.instanceId).toBe(returned.instanceId)
        expect(engine.state.enemies[0].hp).toBe(31)
    })

    it('warcry draws before prompting for a card to place on top', () => {
        const player = createPlayerWithHand(['WARCRY'])
        const drawn = createCardInstance('STRIKE')
        player.drawPile = [drawn]
        const engine = new Engine('warcry-seed', player, [createDummyEnemy('e1')])

        engine.playCard(engine.state.player.hand[0], [])
        engine.runUntilIdle()

        expect(engine.state.player.hand.map(card => card.instanceId)).toContain(drawn.instanceId)
        expect(engine.getPendingChoice()?.eligibleInstanceIds).toContain(drawn.instanceId)

        engine.submitPendingChoice([drawn.instanceId])
        engine.runUntilIdle()

        expect(engine.state.player.drawPile[0]?.instanceId).toBe(drawn.instanceId)
    })

    it('burning pact exhausts the selected card, draws cards, and triggers sentinel', () => {
        const player = createPlayerWithHand(['BURNING_PACT', 'SENTINEL'])
        player.drawPile = [createCardInstance('STRIKE'), createCardInstance('DEFEND')]
        const sentinel = player.hand[1]
        const engine = new Engine('burning-pact-seed', player, [createDummyEnemy('e1')])

        engine.playCard(player.hand[0], [])
        engine.runUntilIdle()
        engine.submitPendingChoice([sentinel.instanceId])
        engine.runUntilIdle()

        expect(engine.state.player.energy).toBe(4)
        expect(engine.state.player.exhaustPile.map(card => card.instanceId)).toContain(sentinel.instanceId)
        expect(engine.state.player.hand.map(card => card.defId)).toEqual(['STRIKE', 'DEFEND'])
    })

    it('exhume cannot return the card currently being played', () => {
        const player = createPlayerWithHand(['EXHUME'])
        const strike = createCardInstance('STRIKE')
        player.exhaustPile = [strike]
        const engine = new Engine('exhume-seed', player, [createDummyEnemy('e1')])

        const exhume = player.hand[0]
        engine.playCard(exhume, [])
        engine.runUntilIdle()

        expect(engine.getPendingChoice()?.eligibleInstanceIds).toEqual([strike.instanceId])
        engine.submitPendingChoice([strike.instanceId])
        engine.runUntilIdle()

        expect(engine.state.player.hand.map(card => card.instanceId)).toContain(strike.instanceId)
        expect(engine.state.player.exhaustPile.map(card => card.instanceId)).toContain(exhume.instanceId)
    })

    it('power through creates wounds in hand', () => {
        const player = createPlayerWithHand(['POWER_THROUGH'])
        const engine = new Engine('power-through-seed', player, [createDummyEnemy('e1')])

        playAndResolve(engine, engine.state.player.hand[0], [])

        expect(engine.state.player.block).toBe(15)
        expect(engine.state.player.hand.map(card => card.defId)).toEqual(['WOUND', 'WOUND'])
    })

    it('flex grants temporary strength and removes it at end of turn', () => {
        const player = createPlayerWithHand(['FLEX'])
        const enemy = createDummyEnemy('e1')
        enemy.intent = { kind: 'buff', desc: 'Idle' }
        const engine = new Engine('flex-seed', player, [enemy])

        playAndResolve(engine, player.hand[0], [])
        expect(engine.state.player.powers.find(power => power.id === 'STRENGTH')?.stacks).toBe(2)

        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        expect(engine.state.player.powers.find(power => power.id === 'STRENGTH')?.stacks ?? 0).toBe(0)
        expect(engine.state.player.powers.find(power => power.id === 'STRENGTH_DOWN_NEXT_TURN')).toBeUndefined()
    })

    it('second wind exhausts all non-attacks in hand and gains block per exhausted card', () => {
        const player = createPlayerWithHand(['SECOND_WIND', 'DEFEND', 'STRIKE', 'WOUND'])
        const engine = new Engine('second-wind-seed', player, [createDummyEnemy('e1')])

        playAndResolve(engine, player.hand[0], [])

        expect(engine.state.player.block).toBe(10)
        expect(engine.state.player.exhaustPile.map(card => card.defId).sort()).toEqual(['DEFEND', 'SECOND_WIND', 'WOUND'])
        expect(engine.state.player.hand.map(card => card.defId)).toEqual(['STRIKE'])
    })

    it('evolve draws extra when a status is drawn and fire breathing damages all enemies on status draw', () => {
        const player = createPlayerWithHand(['EVOLVE'])
        player.drawPile = [createCardInstance('DAZED'), createCardInstance('STRIKE')]
        const enemy = createDummyEnemy('e1')
        const engine = new Engine('evolve-seed', player, [enemy])

        playAndResolve(engine, player.hand[0], [])
        engine.enqueue({ kind: 'ApplyPower', target: player.id, powerId: 'FIRE_BREATHING', stacks: 6 })
        engine.enqueue({ kind: 'DrawCards', count: 1 })
        engine.runUntilIdle()

        expect(engine.state.player.hand.map(card => card.defId)).toContain('DAZED')
        expect(engine.state.player.hand.map(card => card.defId)).toContain('STRIKE')
        expect(engine.state.enemies[0].hp).toBe(34)
    })

    it('rampage scales only its own combat damage across repeated plays', () => {
        const player = createPlayerWithHand(['RAMPAGE'])
        const enemy = createDummyEnemy('e1')
        const engine = new Engine('rampage-seed', player, [enemy])

        const rampage = player.hand[0]
        playAndResolve(engine, rampage, ['e1'])
        const replay = engine.state.player.discardPile.shift()!
        engine.state.player.hand.push(replay)
        playAndResolve(engine, replay, ['e1'])

        expect(engine.state.enemies[0].hp).toBe(19)
    })

    it('feed grants max hp only when it kills the target', () => {
        const player = createPlayerWithHand(['FEED'])
        const enemy = createDummyEnemy('e1')
        enemy.hp = 10
        const engine = new Engine('feed-seed', player, [enemy])

        playAndResolve(engine, player.hand[0], ['e1'])

        expect(engine.state.player.maxHp).toBe(203)
        expect(engine.state.player.hp).toBe(203)
    })

    it('dual wield copies an attack or power card in hand and preserves upgrade level', () => {
        const player = createPlayerWithHand(['DUAL_WIELD', 'STRIKE'])
        player.hand[1].upgradeLevel = 1
        const engine = new Engine('dual-wield-seed', player, [createDummyEnemy('e1')])

        engine.playCard(player.hand[0], [])
        engine.runUntilIdle()
        engine.submitPendingChoice([player.hand[0].instanceId])
        engine.runUntilIdle()

        const strikes = engine.state.player.hand.filter(card => card.defId === 'STRIKE')
        expect(strikes).toHaveLength(2)
        expect(strikes.every(card => card.upgradeLevel === 1)).toBe(true)
    })

    it('new potions apply their combat effects', () => {
        const player = createPlayerWithHand(['DEFEND'])
        const enemy = createDummyEnemy('e1')
        const engine = new Engine('potion-seed', player, [enemy])

        engine.usePotion('ENERGY_POTION', [player.id])
        engine.usePotion('DEXTERITY_POTION', [player.id])
        playAndResolve(engine, player.hand[0], [])
        engine.usePotion('WEAK_POTION', ['e1'])
        engine.usePotion('EXPLOSIVE_POTION', [])

        expect(engine.state.player.energy).toBe(4)
        expect(engine.state.player.block).toBe(7)
        expect(engine.state.enemies[0].powers.find(power => power.id === 'WEAK')?.stacks).toBe(3)
        expect(engine.state.enemies[0].hp).toBe(30)
    })

    it('new relic hooks and boss relic rules work in combat and campfire helpers', () => {
        const run = createNewRun('new-relics-seed')
        run.relics = ['HAPPY_FLOWER', 'PAPER_FROG', 'MERCURY_HOURGLASS', 'CHARONS_ASHES', 'MARK_OF_PAIN', 'PHILOSOPHERS_STONE', 'COFFEE_DRIPPER']
        run.relicState = {}
        const player = createPlayerWithHand(['SECOND_WIND', 'DEFEND', 'STRIKE'])
        player.drawPile = []
        const enemy = createDummyEnemy('e1')
        enemy.powers.push({ id: 'VULNERABLE', stacks: 1 })
        enemy.intent = { kind: 'buff', desc: 'Idle' }
        const engine = new Engine('new-relics-engine', player, [enemy], { run })
        engine.configurePlayerCombatBonuses({ baseEnergyPerTurn: 3 })
        engine.initializeCombat()
        engine.runUntilIdle()

        expect(canRestAtCampfire(run)).toBe(false)
        expect(engine.state.enemies[0].powers.find(power => power.id === 'STRENGTH')?.stacks).toBe(1)
        expect(engine.state.player.drawPile.filter(card => card.defId === 'WOUND')).toHaveLength(2)
        expect(engine.state.enemies[0].hp).toBe(35)

        playAndResolve(engine, player.hand[2], ['e1'])
        expect(engine.state.enemies[0].hp).toBe(24)

        playAndResolve(engine, player.hand[0], [])
        expect(engine.state.enemies[0].hp).toBe(14)

        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()
        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        expect(engine.state.player.energy).toBe(4)
    })

    it('ghostly armor exhausts itself when left in hand at end of turn', () => {
        const player = createPlayerWithHand(['GHOSTLY_ARMOR'])
        const engine = new Engine('ghostly-armor-seed', player, [createDummyEnemy('e1')])

        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        expect(engine.state.player.exhaustPile.map(card => card.defId)).toContain('GHOSTLY_ARMOR')
    })

    it('dazed exhausts itself at end of turn', () => {
        const player = createPlayerWithHand(['DAZED'])
        const engine = new Engine('dazed-seed', player, [createDummyEnemy('e1')])

        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        expect(engine.state.player.exhaustPile.map(card => card.defId)).toContain('DAZED')
    })

    it('slimed is playable for 1 energy and exhausts on use', () => {
        const player = createPlayerWithHand(['SLIMED'])
        const engine = new Engine('slimed-seed', player, [createDummyEnemy('e1')])

        playAndResolve(engine, player.hand[0], [])

        expect(engine.state.player.energy).toBe(2)
        expect(engine.state.player.exhaustPile.map(card => card.defId)).toContain('SLIMED')
    })

    it('clumsy exhausts at end of turn and regret loses hp based on hand size', () => {
        const player = createPlayerWithHand(['CLUMSY', 'REGRET', 'STRIKE'])
        const enemy = createDummyEnemy('e1')
        enemy.intent = { kind: 'buff', desc: 'Idle' }
        const engine = new Engine('curse-turn-seed', player, [enemy])

        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        expect(engine.state.player.exhaustPile.map(card => card.defId)).toContain('CLUMSY')
        expect(engine.state.player.hp).toBe(197)
    })

    it('pain causes hp loss whenever a card is played', () => {
        const player = createPlayerWithHand(['PAIN', 'STRIKE'])
        const engine = new Engine('pain-seed', player, [createDummyEnemy('e1')])

        playAndResolve(engine, player.hand[1], ['e1'])

        expect(engine.state.player.hp).toBe(199)
    })

    it('omamori blocks the next two curses, including parasite max hp loss', () => {
        const run = createNewRun('omamori-seed')
        applyRelicAcquisition(run, 'OMAMORI')

        const beforeMaxHp = run.player.maxHp
        obtainCurse(run, 'PARASITE')
        obtainCurse(run, 'REGRET')
        obtainCurse(run, 'INJURY')

        expect(run.player.maxHp).toBe(beforeMaxHp)
        expect(run.deck.some(card => card.defId === 'PARASITE')).toBe(false)
        expect(run.deck.some(card => card.defId === 'REGRET')).toBe(false)
        expect(run.deck.some(card => card.defId === 'INJURY')).toBe(true)
        expect(getRelicState(run, 'OMAMORI').charges).toBe(0)
    })

    it('akabeko buffs the first attack card across repeated hits and bag of marbles applies vulnerable at combat start', () => {
        const run = createNewRun('akabeko-seed')
        run.relics = ['AKABEKO', 'BAG_OF_MARBLES']
        run.relicState = {}
        const player = createPlayerWithHand(['WHIRLWIND'])
        player.energy = 2
        const enemy = createDummyEnemy('e1')
        const engine = new Engine('akabeko-engine', player, [enemy], { run })
        engine.configurePlayerCombatBonuses({ baseEnergyPerTurn: 3 })
        engine.initializeCombat()
        engine.runUntilIdle()

        playAndResolve(engine, player.hand[0], ['e1'])

        expect(engine.state.enemies[0].powers.find(power => power.id === 'VULNERABLE')?.stacks).toBe(1)
        expect(engine.state.enemies[0].hp).toBe(0)
    })

    it('orichalcum, centennial puzzle, and horn cleat trigger from relic hooks', () => {
        const run = createNewRun('hook-relics')
        run.relics = ['ORICHALCUM', 'CENTENNIAL_PUZZLE', 'HORN_CLEAT']
        run.relicState = {}
        const player = createPlayerWithHand([])
        player.drawPile = [createCardInstance('STRIKE'), createCardInstance('DEFEND'), createCardInstance('BASH')]
        const enemy = createDummyEnemy('e1')
        enemy.intent = { kind: 'buff', desc: 'Idle' }
        const engine = new Engine('hook-engine', player, [enemy], { run })
        engine.configurePlayerCombatBonuses({ baseEnergyPerTurn: 3 })
        engine.initializeCombat()
        engine.runUntilIdle()

        engine.enqueue({ kind: 'LoseHp', target: player.id, amount: 2 })
        engine.runUntilIdle()
        expect(engine.state.player.hand.map(card => card.defId)).toEqual(['STRIKE', 'DEFEND', 'BASH'])

        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        expect(engine.state.player.block).toBe(14)
    })

    it('whirlwind spends all remaining energy and is repeated by double tap', () => {
        const player = createPlayerWithHand(['DOUBLE_TAP', 'WHIRLWIND'])
        const engine = new Engine('whirlwind-seed', player, [createDummyEnemy('e1')])

        playAndResolve(engine, player.hand[0], [])
        playAndResolve(engine, engine.state.player.hand[0], ['e1'])

        expect(engine.state.player.energy).toBe(0)
        expect(engine.state.enemies[0].hp).toBe(20)
    })

    it('seeing red exhausts and grants energy', () => {
        const player = createPlayerWithHand(['SEEING_RED'])
        const engine = new Engine('seeing-red-seed', player, [createDummyEnemy('e1')])

        playAndResolve(engine, player.hand[0], [])

        expect(engine.state.player.energy).toBe(5)
        expect(engine.state.player.exhaustPile.map(card => card.defId)).toContain('SEEING_RED')
    })

    it('flame barrier deals retaliatory damage on attack', () => {
        const player = createPlayerWithHand(['FLAME_BARRIER'])
        const enemy = createDummyEnemy('e1')
        enemy.intent = { kind: 'attack', amount: 5 }
        const engine = new Engine('flame-barrier-seed', player, [enemy])

        playAndResolve(engine, player.hand[0], [])
        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        expect(engine.state.enemies[0].hp).toBe(36)
        expect(engine.state.player.hp).toBe(200)
    })

    it('reaper heals only for actual unblocked damage', () => {
        const player = createPlayerWithHand(['REAPER'])
        player.hp = 10
        player.maxHp = 80
        const enemy = createDummyEnemy('e1')
        enemy.block = 3
        const engine = new Engine('reaper-seed', player, [enemy])

        playAndResolve(engine, player.hand[0], ['e1'])

        expect(engine.state.player.hp).toBe(11)
    })

    it('dropkick refunds energy when the target is vulnerable', () => {
        const player = createPlayerWithHand(['DROPKICK'])
        player.drawPile = [createCardInstance('STRIKE')]
        const enemy = createDummyEnemy('e1')
        enemy.powers.push({ id: 'VULNERABLE', stacks: 1 })
        const engine = new Engine('dropkick-seed', player, [enemy])

        playAndResolve(engine, player.hand[0], ['e1'])

        expect(engine.state.player.energy).toBe(3)
        expect(engine.state.player.hand.map(card => card.defId)).toContain('STRIKE')
    })

    it('corruption makes skills free and exhausts them', () => {
        const player = createPlayerWithHand(['DEFEND'])
        player.powers.push({ id: 'CORRUPTION', stacks: 1 })
        const engine = new Engine('corruption-seed', player, [createDummyEnemy('e1')])

        playAndResolve(engine, player.hand[0], [])

        expect(engine.state.player.energy).toBe(3)
        expect(engine.state.player.exhaustPile.map(card => card.defId)).toContain('DEFEND')
    })

    it('gremlin nob gains strength when the player plays a skill', () => {
        const player = createPlayerWithHand(['DEFEND'])
        const enemy = createEnemyFromSpec(new RNG('nob-seed'), 'GREMLIN_NOB', 'e1')
        const engine = new Engine('nob-engine-seed', player, [enemy])

        engine.playCard(player.hand[0], [])

        expect(engine.state.enemies[0].powers.find(power => power.id === 'STRENGTH')?.stacks).toBe(2)
    })

    it('lagavulin wakes after taking damage', () => {
        const player = createPlayerWithHand([])
        const enemy = createEnemyFromSpec(new RNG('laga-seed'), 'LAGAVULIN', 'e1')
        const engine = new Engine('laga-engine-seed', player, [enemy])

        engine.enqueue({ kind: 'DealDamage', source: player.id, target: enemy.id, amount: 10 })
        engine.runUntilIdle()

        expect(engine.state.enemies[0].aiState?.asleep).toBe(false)
    })

    it('sentries add dazed to discard pile on bolt turns', () => {
        const player = createPlayerWithHand([])
        const enemies = [
            createEnemyFromSpec(new RNG('s1'), 'SENTRY', 'e1'),
            createEnemyFromSpec(new RNG('s2'), 'SENTRY', 'e2'),
            createEnemyFromSpec(new RNG('s3'), 'SENTRY', 'e3'),
        ]
        const engine = new Engine('sentries-seed', player, enemies)

        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        expect(engine.state.player.hand.filter(card => card.defId === 'DAZED')).toHaveLength(4)
    })

    it('the guardian enters defense mode after enough damage', () => {
        const player = createPlayerWithHand([])
        const enemy = createEnemyFromSpec(new RNG('guardian-seed'), 'THE_GUARDIAN', 'e1')
        const engine = new Engine('guardian-engine-seed', player, [enemy])

        engine.enqueue({ kind: 'DealDamage', source: player.id, target: enemy.id, amount: 35 })
        engine.runUntilIdle()

        expect(engine.state.enemies[0].aiState?.mode).toBe('defense')
        expect(engine.state.enemies[0].block).toBeGreaterThanOrEqual(20)
    })

    it('slime boss splits into two medium slimes exactly once', () => {
        const player = createPlayerWithHand([])
        const enemy = createEnemyFromSpec(new RNG('slime-boss'), 'SLIME_BOSS', 'e1')
        const engine = new Engine('slime-boss-engine', player, [enemy])

        engine.enqueue({ kind: 'DealDamage', source: player.id, target: enemy.id, amount: 80 })
        engine.runUntilIdle()

        expect(engine.state.enemies).toHaveLength(2)
        expect(engine.state.enemies.map(entry => entry.specId).sort()).toEqual(['ACID_SLIME_M', 'SPIKE_SLIME_M'])

        const enemyIds = engine.state.enemies.map(entry => entry.id)
        engine.enqueue({ kind: 'DealDamage', source: player.id, target: enemyIds[0], amount: 1 })
        engine.runUntilIdle()
        expect(engine.state.enemies).toHaveLength(2)
    })

    it('byrd becomes downed after three player attack hits and then recovers flying', () => {
        const player = createPlayerWithHand([])
        const enemy = createEnemyFromSpec(new RNG('byrd-seed'), 'BYRD', 'e1')
        const engine = new Engine('byrd-engine', player, [enemy])

        engine.enqueue({ kind: 'DealDamage', source: player.id, target: enemy.id, amount: 8 })
        engine.enqueue({ kind: 'DealDamage', source: player.id, target: enemy.id, amount: 8 })
        engine.enqueue({ kind: 'DealDamage', source: player.id, target: enemy.id, amount: 8 })
        engine.runUntilIdle()

        expect(engine.state.enemies[0].aiState?.downed).toBe(true)
        expect(engine.state.enemies[0].aiState?.flying).toBe(false)

        engine.state.enemies[0].intent = rollEngineIntentForEnemy(new RNG('byrd-recover'), engine.state.enemies[0], engine.state)
        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        expect(engine.state.enemies[0].aiState?.flying).toBe(true)
    })

    it('gremlin leader summons minions up to the battlefield cap', () => {
        const player = createPlayerWithHand([])
        const leader = createEnemyFromSpec(new RNG('leader-seed'), 'GREMLIN_LEADER', 'e1')
        const engine = new Engine('leader-engine', player, [leader])

        engine.state.enemies[0].intent = { kind: 'summon', desc: 'Call Reinforcements' }
        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        expect(engine.state.enemies.filter(enemy => enemy.hp > 0)).toHaveLength(3)
        expect(engine.state.enemies.some(enemy => enemy.specId === 'GREMLIN_MINION')).toBe(true)
    })

    it('taskmaster adds wounds to discard pile on lash turns', () => {
        const player = createPlayerWithHand([])
        const taskmaster = createEnemyFromSpec(new RNG('taskmaster-seed'), 'TASKMASTER', 'e1')
        taskmaster.aiState = { cycle: 1, move: 'lash' }
        taskmaster.intent = { kind: 'attack', amount: 9 }
        const engine = new Engine('taskmaster-engine', player, [taskmaster])

        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        const woundCount = [...engine.state.player.hand, ...engine.state.player.discardPile, ...engine.state.player.drawPile]
            .filter(card => card.defId === 'WOUND')
        expect(woundCount).toHaveLength(2)
    })

    it('the collector resummons torch heads and phase shifts below half hp', () => {
        const player = createPlayerWithHand([])
        const collector = createEnemyFromSpec(new RNG('collector-seed'), 'THE_COLLECTOR', 'e1')
        const torchOne = createEnemyFromSpec(new RNG('torch-1'), 'TORCH_HEAD', 'e2')
        const torchTwo = createEnemyFromSpec(new RNG('torch-2'), 'TORCH_HEAD', 'e3')
        const engine = new Engine('collector-engine', player, [collector, torchOne, torchTwo])

        engine.removeEnemy('e2')
        engine.removeEnemy('e3')
        engine.state.enemies[0].intent = { kind: 'summon', desc: 'Raise Torch Heads' }
        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        expect(engine.state.enemies.filter(enemy => enemy.specId === 'TORCH_HEAD' && enemy.hp > 0)).toHaveLength(2)

        engine.enqueue({ kind: 'DealDamage', source: player.id, target: 'e1', amount: 160 })
        engine.runUntilIdle()

        expect(engine.state.enemies.find(enemy => enemy.id === 'e1')?.aiState?.enraged).toBe(true)
    })

    it('keeps status cards out of collectible pools and reward bundles', () => {
        const meta = {
            bestAscensionUnlocked: 0,
            totalWins: 0,
            totalRuns: 0,
            ironcladUnlockTier: 0,
            unlockedCardIds: [],
            unlockedRelicIds: [],
        }
        const rewards = generateRewardBundle('reward-seed', 'elite', ['BURNING_BLOOD'], meta)
        const rewardCards = rewards.items.find(item => item.kind === 'cards')

        expect(CARD_DEFS.WOUND.poolEnabled).toBe(false)
        expect(CARD_DEFS.DAZED.poolEnabled).toBe(false)
        expect(CARD_DEFS.BURN.poolEnabled).toBe(false)
        expect(CARD_DEFS.SLIMED.poolEnabled).toBe(false)
        expect(rewardCards && rewardCards.kind === 'cards' && rewardCards.choices.every(id => CARD_DEFS[id].type !== 'status')).toBe(true)
    })

    it('computes combat relic bonuses and reward bundles', () => {
        const bonuses = getCombatRelicBonuses(['BURNING_BLOOD', 'ANCHOR', 'LANTERN', 'BRONZE_SCALES', 'PRESERVED_INSECT'], 'elite')
        const meta = {
            bestAscensionUnlocked: 0,
            totalWins: 0,
            totalRuns: 0,
            ironcladUnlockTier: 0,
            unlockedCardIds: [],
            unlockedRelicIds: [],
        }
        const rewards = generateRewardBundle('reward-seed-2', 'elite', ['BURNING_BLOOD'], meta)

        expect(bonuses.startingBlock).toBe(10)
        expect(bonuses.energyBonus).toBe(1)
        expect(bonuses.startingThorns).toBe(3)
        expect(bonuses.eliteHpMultiplier).toBe(0.75)
        expect(rewards.items.some(item => item.kind === 'relic')).toBe(true)
        expect(rewards.items.some(item => item.kind === 'cards')).toBe(true)
    })

    it('keeps rewards and relic pools within the unlocked content', () => {
        const meta = {
            bestAscensionUnlocked: 0,
            totalWins: 0,
            totalRuns: 0,
            ironcladUnlockTier: 0,
            unlockedCardIds: [],
            unlockedRelicIds: [],
        }
        const rewards = generateRewardBundle('unlock-reward', 'elite', ['BURNING_BLOOD'], meta)
        const rewardCards = rewards.items.find(item => item.kind === 'cards')
        const rewardRelic = rewards.items.find(item => item.kind === 'relic')

        const unlockedCards = new Set(getUnlockedCollectibleCards(meta))
        const unlockedRelics = new Set(getUnlockedRelicPool(meta))
        expect(rewardCards && rewardCards.kind === 'cards' && rewardCards.choices.every(cardId => unlockedCards.has(cardId))).toBe(true)
        expect(rewardRelic && rewardRelic.kind === 'relic' && unlockedRelics.has(rewardRelic.relicId)).toBe(true)
    })

    it('applies ascension hallway gold, shop, and map modifiers', () => {
        const ascRun = createNewRun('asc-run', 8)
        const meta = {
            bestAscensionUnlocked: 0,
            totalWins: 0,
            totalRuns: 0,
            ironcladUnlockTier: 0,
            unlockedCardIds: [],
            unlockedRelicIds: [],
        }
        const hallwayRewards = generateRewardBundle('a4-reward', 'hallway', ascRun, meta, { roomKind: 'monster' })
        const map = generateMap('a6-map', 1, 15, 7, 6)
        const eliteCount = map.nodes.filter(node => node.kind === 'elite').length

        const goldReward = hallwayRewards.items.find(item => item.kind === 'gold')
        expect(goldReward && goldReward.kind === 'gold' && goldReward.amount).toBeLessThanOrEqual(16)
        expect(getShopPriceMultiplier(ascRun)).toBe(1.1)
        expect(getMerchantRemoveBaseCost(ascRun)).toBe(100)
        expect(eliteCount).toBeGreaterThanOrEqual(3)
    })

    it('applies ascension combat scaling helpers and hallway intent upgrades', () => {
        const boss = createEnemyFromSpec(new RNG('champ-boss'), 'THE_CHAMP', 'e1')
        const elite = createEnemyFromSpec(new RNG('book-elite'), 'BOOK_OF_STABBING', 'e2')
        const first = { kind: 'block', amount: 12 } as const
        const second = { kind: 'attack', amount: 9 } as const

        expect(getAscensionEnemyHpMultiplier(1, 'elite')).toBeCloseTo(1.15)
        expect(getAscensionEnemyHpMultiplier(3, 'elite')).toBeCloseTo(1.265)
        expect(getAscensionEnemyDamageMultiplier(2, elite)).toBeCloseTo(1.1)
        expect(getAscensionEnemyDamageMultiplier(10, boss)).toBeCloseTo(1.265)
        expect(pickMoreAggressiveIntent(first, second)).toEqual(second)
    })

    it('applies boss relic hooks and boss reward generation', () => {
        const run = createNewRun('boss-relic-seed')
        applyRelicAcquisition(run, 'BLACK_BLOOD')

        expect(run.relics).not.toContain('BURNING_BLOOD')
        expect(getPostCombatHeal(run.relics)).toBe(12)
        expect(blocksPotionGain(['SOZU'])).toBe(true)
        expect(getCardRewardChoiceCount(['BUSTED_CROWN'])).toBe(1)
        expect(getRelicEnergyBonus(['SOZU', 'BUSTED_CROWN'])).toBe(2)

        const meta = {
            bestAscensionUnlocked: 0,
            totalWins: 0,
            totalRuns: 0,
            ironcladUnlockTier: 0,
            unlockedCardIds: [],
            unlockedRelicIds: [],
        }
        const bossRewards = generateRewardBundle('boss-seed', 'boss', ['BLACK_BLOOD'], meta)
        expect(bossRewards.items.some(item => item.kind === 'boss_relics')).toBe(true)
        expect(BOSS_RELIC_POOL).toEqual(expect.arrayContaining(['COFFEE_DRIPPER', 'MARK_OF_PAIN', 'PHILOSOPHERS_STONE']))
    })

    it('omits potion rewards when sozu is owned', () => {
        const meta = {
            bestAscensionUnlocked: 0,
            totalWins: 0,
            totalRuns: 0,
            ironcladUnlockTier: 0,
            unlockedCardIds: [],
            unlockedRelicIds: [],
        }
        const rewards = Array.from({ length: 8 }, (_, index) => generateRewardBundle(`sozu-${index}`, 'elite', ['SOZU'], meta))
        expect(rewards.every(bundle => bundle.items.every(item => item.kind !== 'potion'))).toBe(true)
    })

    it('generates act two encounters from the act two pool only', () => {
        const hallway = generateEncounter(new RNG('act2-hallway'), 2, 'hallway', 0)
        const elite = generateEncounter(new RNG('act2-elite'), 2, 'elite', 0)
        const boss = generateEncounter(new RNG('act2-boss'), 2, 'boss', 0)

        expect([
            'CHOSEN',
            'BYRD',
            'SPHERIC_GUARDIAN',
            'SHELLED_PARASITE',
            'SNECKO',
            'LOOTER',
        ]).toContain(hallway[0])
        expect([
            ['BOOK_OF_STABBING'],
            ['GREMLIN_LEADER'],
            ['RED_SLAVER', 'BLUE_SLAVER', 'TASKMASTER'],
        ]).toContainEqual(elite)
        expect([
            ['THE_CHAMP'],
            ['THE_COLLECTOR', 'TORCH_HEAD', 'TORCH_HEAD'],
        ]).toContainEqual(boss)
    })

    it('resolves seeded act one events with curse and economy effects', () => {
        const run = createNewRun('event-seed')
        const eventId = generateEvent(1, `${run.seed}-event-floor`)

        expect(getEventPool(1)).toContain(eventId)

        const meta = {
            bestAscensionUnlocked: 0,
            totalWins: 0,
            totalRuns: 0,
            ironcladUnlockTier: 0,
            unlockedCardIds: [],
            unlockedRelicIds: [],
        }

        resolveEventChoice(run, meta, 'GOLDEN_IDOL', 'GOLDEN_IDOL_TAKE', 'idol-seed')
        expect(run.gold).toBe(199)
        expect(run.deck.some(card => card.defId === 'INJURY')).toBe(true)

        const secondRun = createNewRun('event-seed-2')
        resolveEventChoice(secondRun, meta, 'BIG_FISH', 'BIG_FISH_BOX', 'fish-seed')
        expect(secondRun.relics.length).toBeGreaterThan(1)
        expect(secondRun.deck.some(card => card.defId === 'REGRET')).toBe(true)
    })

    it('supports transform events deterministically and act two event pools', () => {
        const run = createNewRun('transform-seed')
        const meta = {
            bestAscensionUnlocked: 0,
            totalWins: 0,
            totalRuns: 0,
            ironcladUnlockTier: 0,
            unlockedCardIds: [],
            unlockedRelicIds: [],
        }
        const original = run.deck[0]
        const transformed = transformCard(run, meta, original.instanceId, 'living-wall-seed')

        expect(transformed).toBeDefined()
        expect(transformed?.defId).not.toBe(original.defId)
        expect(transformed?.upgradeLevel).toBe(0)
        expect(CARD_DEFS[transformed!.defId].type).not.toBe('status')
        expect(CARD_DEFS[transformed!.defId].type).not.toBe('curse')
        expect(getEffectiveUnlockedCardIds(meta).has(transformed!.defId)).toBe(true)
        expect(getEventPool(2)).toEqual(['CLERIC', 'UPGRADE_SHRINE', 'FORGOTTEN_ALTAR', 'THE_MAUSOLEUM', 'BEGGAR'])
    })
})
