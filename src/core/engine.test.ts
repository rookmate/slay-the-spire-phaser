import { describe, expect, it } from 'vitest'
import { CARD_DEFS, createCardInstance, resolveCard } from './cards'
import type { CardInstance, PlayerState } from './state'
import { Engine, createDummyEnemy, createSimplePlayer } from './engine'
import { RNG } from './rng'
import { createEnemyFromSpec } from './enemies'
import { applyRelicAcquisition, blocksPotionGain, getCardRewardChoiceCount, getCombatRelicBonuses, getPostCombatHeal, getRelicEnergyBonus } from './relics'
import { generateRewardBundle } from './rewards'
import { createNewRun } from './run'
import { applyNeowOption, getNeowRareCardChoices, getRandomNeowRelic, rollNeowOptions } from './neow'
import { generateEncounter } from './encounters'
import { generateEvent, resolveEventChoice } from './events'

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
    })

    it('rolls deterministic neow options and applies rewards', () => {
        const run = createNewRun('neow-seed')
        const options = rollNeowOptions(run.neowSeed)
        const rerolled = rollNeowOptions(run.neowSeed)
        const relicId = getRandomNeowRelic(`${run.neowSeed}-GAIN_COMMON_RELIC_REGRET`, run)
        const rareChoices = getNeowRareCardChoices(`${run.neowSeed}-GAIN_RARE_CARD_PAIN`)

        expect(options.map(option => option.id)).toEqual(rerolled.map(option => option.id))
        expect(options.filter(option => option.category === 'benefit')).toHaveLength(2)
        expect(options.filter(option => option.category === 'tradeoff')).toHaveLength(2)

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

    it('keeps status cards out of collectible pools and reward bundles', () => {
        const rewards = generateRewardBundle('reward-seed', 'elite', ['BURNING_BLOOD'])
        const rewardCards = rewards.items.find(item => item.kind === 'cards')

        expect(CARD_DEFS.WOUND.poolEnabled).toBe(false)
        expect(CARD_DEFS.DAZED.poolEnabled).toBe(false)
        expect(CARD_DEFS.BURN.poolEnabled).toBe(false)
        expect(CARD_DEFS.SLIMED.poolEnabled).toBe(false)
        expect(rewardCards && rewardCards.kind === 'cards' && rewardCards.choices.every(id => CARD_DEFS[id].type !== 'status')).toBe(true)
    })

    it('computes combat relic bonuses and reward bundles', () => {
        const bonuses = getCombatRelicBonuses(['BURNING_BLOOD', 'ANCHOR', 'LANTERN', 'BRONZE_SCALES', 'PRESERVED_INSECT'], 'elite')
        const rewards = generateRewardBundle('reward-seed-2', 'elite', ['BURNING_BLOOD'])

        expect(bonuses.startingBlock).toBe(10)
        expect(bonuses.energyBonus).toBe(1)
        expect(bonuses.startingThorns).toBe(3)
        expect(bonuses.eliteHpMultiplier).toBe(0.75)
        expect(rewards.items.some(item => item.kind === 'relic')).toBe(true)
        expect(rewards.items.some(item => item.kind === 'cards')).toBe(true)
    })

    it('applies boss relic hooks and boss reward generation', () => {
        const run = createNewRun('boss-relic-seed')
        applyRelicAcquisition(run, 'BLACK_BLOOD')

        expect(run.relics).not.toContain('BURNING_BLOOD')
        expect(getPostCombatHeal(run.relics)).toBe(12)
        expect(blocksPotionGain(['SOZU'])).toBe(true)
        expect(getCardRewardChoiceCount(['BUSTED_CROWN'])).toBe(1)
        expect(getRelicEnergyBonus(['SOZU', 'BUSTED_CROWN'])).toBe(2)

        const bossRewards = generateRewardBundle('boss-seed', 'boss', ['BLACK_BLOOD'])
        expect(bossRewards.items.some(item => item.kind === 'boss_relics')).toBe(true)
    })

    it('omits potion rewards when sozu is owned', () => {
        const rewards = Array.from({ length: 8 }, (_, index) => generateRewardBundle(`sozu-${index}`, 'elite', ['SOZU']))
        expect(rewards.every(bundle => bundle.items.every(item => item.kind !== 'potion'))).toBe(true)
    })

    it('generates act two encounters from the act two pool only', () => {
        const hallway = generateEncounter(new RNG('act2-hallway'), 2, 'hallway', 0)
        const elite = generateEncounter(new RNG('act2-elite'), 2, 'elite', 0)
        const boss = generateEncounter(new RNG('act2-boss'), 2, 'boss', 0)

        expect(['SHELLED_PARASITE', 'SNECKO', 'LOOTER', 'CULTIST']).toContain(hallway[0])
        expect(elite).toEqual(['BOOK_OF_STABBING'])
        expect(boss).toEqual(['THE_CHAMP'])
    })

    it('resolves seeded act one events with curse and economy effects', () => {
        const run = createNewRun('event-seed')
        const eventId = generateEvent(1, `${run.seed}-event-floor`)

        expect(['WORLD_OF_GOOP', 'CLERIC', 'UPGRADE_SHRINE', 'GOLDEN_IDOL', 'BIG_FISH', 'THE_JOUST']).toContain(eventId)

        resolveEventChoice(run, 'GOLDEN_IDOL', 'GOLDEN_IDOL_TAKE', 'idol-seed')
        expect(run.gold).toBe(199)
        expect(run.deck.some(card => card.defId === 'INJURY')).toBe(true)

        const secondRun = createNewRun('event-seed-2')
        resolveEventChoice(secondRun, 'BIG_FISH', 'BIG_FISH_BOX', 'fish-seed')
        expect(secondRun.relics.length).toBeGreaterThan(1)
        expect(secondRun.deck.some(card => card.defId === 'REGRET')).toBe(true)
    })
})
