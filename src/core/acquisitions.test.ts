import { describe, expect, it } from 'vitest'
import { canRemoveCard, createCardInstance, resolveCard } from './cards'
import { initializeEvent, resolveEventChoice } from './events'
import { useCampfire } from './campfire'
import { createDefaultMeta, getEffectiveUnlockedCardIds } from './meta'
import { getRunDestination } from './progression'
import { applyRelicAcquisition, RELIC_DEFS } from './relics'
import { chooseAcquisition, prepareAcquisition } from './relics/acquisitions'
import { eligibleRelic } from './relics/pools'
import { drawBossRelics, drawRelic } from './rewardPools'
import { generateRewardBundle } from './rewards'
import { RNG } from './rng'
import { createNewRun, obtainCard, type RunState } from './run'
import { purchaseShopItem } from './shop'

const meta = () => createDefaultMeta()
const reload = (run: RunState): RunState => JSON.parse(JSON.stringify(run))
describe('saved relic acquisition choices', () => {
    it('resumes Astrolabe mid-selection and transforms exactly the original three cards', () => {
        let run = createNewRun({ seed: 'astro' }); run.neowCompleted = true
        applyRelicAcquisition(run, 'ASTROLABE')
        const ids = run.deck.slice(0, 3).map(c => c.instanceId)
        expect(chooseAcquisition(run, meta(), ids[0])).toBe(true)
        run = reload(run)
        expect(getRunDestination(run).scene).toBe('RelicAcquisition')
        expect(chooseAcquisition(run, meta(), ids[0])).toBe(false)
        chooseAcquisition(run, meta(), ids[1]); chooseAcquisition(run, meta(), ids[2])
        expect(run.deck).toHaveLength(10)
        expect(run.deck.filter(c => c.upgradeLevel === 1)).toHaveLength(3)
        expect(ids.every(id => !run.deck.some(c => c.instanceId === id))).toBe(true)
        expect(getRunDestination(run).scene).toBe('Map')
    })
    it('uses seed and selected deck order, never UUIDs, for transformations', () => {
        const runs = [createNewRun({ seed: 'same-astro' }), createNewRun({ seed: 'same-astro' })]
        for (const run of runs) {
            applyRelicAcquisition(run, 'ASTROLABE')
            for (const card of run.deck.slice(0, 3)) chooseAcquisition(run, meta(), card.instanceId)
            applyRelicAcquisition(run, 'PANDORAS_BOX'); prepareAcquisition(run, meta())
        }
        expect(runs[0].deck.map(c => c.defId)).toEqual(runs[1].deck.map(c => c.defId))
    })
    it('bottles a card, makes it innate and prevents removal', () => {
        const run = createNewRun(); const bash = run.deck.find(c => c.defId === 'BASH')!
        applyRelicAcquisition(run, 'BOTTLED_FLAME'); chooseAcquisition(run, meta(), bash.instanceId)
        expect(resolveCard(bash).innate).toBe(true); expect(canRemoveCard(bash)).toBe(false)
    })
    it('preserves a paid shop and Orrery rewards through reload without recharging', () => {
        let run = createNewRun({ seed: 'orrery' }); run.neowCompleted = true; run.gold = 1000
        const inventory = { cards: [], relics: ['ORRERY' as const], relicPrices: [150], potions: [] }
        run.pendingRoom = { scene: 'Shop', inventory }
        expect(purchaseShopItem(run, meta(), inventory, 'relics', 0)).toBe(true)
        expect(run.gold).toBe(850)
        expect(run.pendingAcquisitions).toHaveLength(5)
        for (let i = 0; i < 5; i++) {
            prepareAcquisition(run, meta()); const choices = run.pendingAcquisitions![0]
            run = reload(run); expect(prepareAcquisition(run, meta())).toEqual(choices)
            chooseAcquisition(run, meta())
        }
        expect(getRunDestination(run).scene).toBe('Shop'); expect(run.gold).toBe(850)
        expect(run.pendingRoom).toMatchObject({ inventory: { relics: [] } })
    })
    it('applies card-gain relics to copies and prevents cursed copies with Omamori', () => {
        const run = createNewRun(); run.relics = ['TOXIC_EGG', 'CERAMIC_FISH', 'DARKSTONE_PERIAPT']
        const gold = run.gold; const max = run.player.maxHp
        const skill = obtainCard(run, 'SHRUG_IT_OFF'); expect(skill.upgradeLevel).toBe(1)
        obtainCard(run, 'REGRET'); expect(run.player.maxHp).toBe(max + 6); expect(run.gold).toBe(gold + 18)
        applyRelicAcquisition(run, 'OMAMORI'); obtainCard(run, 'DOUBT')
        expect(run.deck.some(c => c.defId === 'DOUBT')).toBe(false)
        expect(run.gold).toBe(gold + 18); expect(run.player.maxHp).toBe(max + 6)
    })
    it('upgrades bottled cards in events without losing bottle protection', () => {
        const run = createNewRun(); const bash = run.deck.find(c => c.defId === 'BASH')!
        applyRelicAcquisition(run, 'BOTTLED_FLAME'); chooseAcquisition(run, meta(), bash.instanceId)
        initializeEvent(run, meta(), 'UPGRADE_SHRINE')
        resolveEventChoice(run, meta(), 'UPGRADE_SHRINE', 'UPGRADE_SHRINE_UPGRADE', 'bottle-upgrade', { cardInstanceId: bash.instanceId })
        expect(bash.upgradeLevel).toBe(1); expect(bash.bottled).toBe('BOTTLED_FLAME')
        expect(run.eventState?.resolved).toBe(true)
    })
    it('completes an empty mandatory selection without a softlock', () => {
        const run = createNewRun(); run.deck = [createCardInstance('ASCENDERS_BANE')]
        applyRelicAcquisition(run, 'EMPTY_CAGE'); expect(prepareAcquisition(run, meta())).toBeUndefined()
        expect(run.deck).toHaveLength(1)
    })
})
describe('campaign relic rules and pools', () => {
    it('offers character-appropriate boss relics and does not reoffer seen relics', () => {
        const run = createNewRun({ character: 'silent', seed: 'boss-pool' }); run.deck.push(createCardInstance('DIE_DIE_DIE'))
        for (let i = 0; i < 20; i++) for (const id of drawBossRelics(new RNG(`boss-${i}`), run, meta())) {
            expect(RELIC_DEFS[id].character === undefined || RELIC_DEFS[id].character === 'silent').toBe(true)
        }
        const chest = createNewRun({ seed: 'chest-pool' })
        const drawn = Array.from({ length: 15 }, (_, i) => drawRelic(new RNG(`relic-${i}`), meta(), chest))
        expect(new Set(drawn).size).toBe(drawn.length)
    })
    it('applies bottle, late-floor, and campfire restrictions to relic eligibility', () => {
        const run = createNewRun(); expect(eligibleRelic(run, 'BOTTLED_TORNADO')).toBe(false)
        run.deck.push(createCardInstance('INFLAME')); expect(eligibleRelic(run, 'BOTTLED_TORNADO')).toBe(true)
        run.floor = 49; expect(eligibleRelic(run, 'MAW_BANK')).toBe(false)
        run.relics.push('SHOVEL', 'GIRYA'); expect(eligibleRelic(run, 'PEACE_PIPE')).toBe(false)
    })
    it('grants extra rewards and consumes chest charges once', () => {
        const run = createNewRun({ seed: 'extra-rewards' }); run.relics = ['BLACK_STAR', 'PRAYER_WHEEL', 'WHITE_BEAST_STATUE']
        expect(generateRewardBundle('elite', 'elite', run, meta()).items.filter(i => i.kind === 'relic')).toHaveLength(2)
        const normal = generateRewardBundle('normal', 'hallway', run, meta())
        expect(normal.items.filter(i => i.kind === 'cards')).toHaveLength(2)
        expect(normal.items.some(i => i.kind === 'potion')).toBe(true)
        applyRelicAcquisition(run, 'MATRYOSHKA'); applyRelicAcquisition(run, 'CURSED_KEY')
        expect(generateRewardBundle('chest', 'chest', run, meta()).items.filter(i => i.kind === 'relic')).toHaveLength(2)
        expect(run.relicState?.MATRYOSHKA?.charges).toBe(1)
        expect(run.deck.some(c => resolveCard(c).type === 'curse')).toBe(true)
    })
    it('resolves rest bonuses once and carries saved choices out of the rest room', () => {
        const run = createNewRun(); run.neowCompleted = true; run.player.hp = 1
        run.pendingRoom = { scene: 'Campfire' }; run.relics = ['DREAM_CATCHER', 'REGAL_PILLOW']
        expect(useCampfire(run, 'rest')).toBe(true); expect(run.player.hp).toBe(40)
        expect(useCampfire(run, 'rest')).toBe(false); expect(getRunDestination(run).scene).toBe('RelicAcquisition')
        const smith = createNewRun(); smith.pendingRoom = { scene: 'Campfire' }; smith.relics = ['FUSION_HAMMER']
        expect(useCampfire(smith, 'smith', smith.deck[0].instanceId)).toBe(false)
    })
    it('includes each character base cards and former card unlocks immediately', () => {
        const unlocked = getEffectiveUnlockedCardIds(meta())
        for (const id of ['ARMAMENTS', 'DAGGER_THROW', 'BALL_LIGHTNING', 'CUT_THROUGH_FATE']) expect(unlocked.has(id)).toBe(true)
        for (const id of ['HEAVY_BLADE', 'CATALYST', 'ECHO_FORM', 'BLASPHEMY']) expect(unlocked.has(id)).toBe(true)
    })
})
