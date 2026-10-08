import { z } from 'zod'
import { CARD_DEFS } from '../cards'
import { RELIC_DEFS } from '../relics'
import { POTION_DEFS } from '../potions'
import { ENEMIES } from '../enemies'
import { EVENT_DEFS } from '../events/definitions'
import { MODIFIERS } from '../modes/modifiers'
import { BLIGHTS } from '../modes/endless'
import { getRunMap } from '../map'
import type { RunState, RelicId } from '../run'
import type { PotionId } from '../potions'
import type { EnemyKey } from '../encounters'
import type { EventId } from '../events/model'
import type { ModifierId } from '../modes/modifiers'
import type { BlightId } from '../modes/endless'
import type { MetaState } from '../meta'
import { ACHIEVEMENTS, type AchievementId } from '../achievements/catalog'

const text = z.string().max(2048), id = z.string().min(1).max(128)
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const finite = z.number().finite(), flag = z.boolean(), date = z.iso.datetime()
const list = <T extends z.ZodType>(item: T) => z.array(item).max(10000)
const known = <T extends string>(registry: object) => id.refine(value => Object.hasOwn(registry, value), 'Unknown content ID').transform(value => value as T)
const cardId = known<string>(CARD_DEFS), relicId = known<RelicId>(RELIC_DEFS), potionId = known<PotionId>(POTION_DEFS)
const achievementId = known<AchievementId>(ACHIEVEMENTS)
const character = z.enum(['ironclad', 'silent', 'defect', 'watcher']), mode = z.enum(['standard', 'seeded', 'daily', 'custom'])
const ascension = count.max(20), act = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
const noteCard = z.strictObject({ defId: cardId, upgradeLevel: count, permanentDamage: count.optional(), permanentBlock: count.optional() })
const card = noteCard.extend({ instanceId: id, storedHits: count.optional(), bottled: z.union([flag, relicId]).optional(),
    costUntilPlayed: finite.optional(), retained: flag.optional(), costForCombat: finite.optional(), costForTurn: finite.optional(), confusedCost: finite.optional() })
const reward = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('gold'), amount: count }),
    z.strictObject({ kind: z.literal('cards'), choices: list(cardId), upgrades: list(count).optional() }).refine(item => !item.upgrades || item.upgrades.length === item.choices.length, 'Card upgrade count differs from choices'),
    z.strictObject({ kind: z.literal('relic'), relicId }), z.strictObject({ kind: z.literal('potion'), potionId }),
    z.strictObject({ kind: z.literal('boss_relics'), choices: list(relicId) }),
])
const rewards = z.strictObject({ tier: z.enum(['hallway', 'elite', 'boss', 'chest']), items: list(reward), claimed: list(count).optional(), advanceFloor: flag.optional() })
    .refine(bundle => (bundle.claimed ?? []).every(index => index < bundle.items.length) && new Set(bundle.claimed).size === (bundle.claimed?.length ?? 0), 'Invalid claimed reward index')
const shop = z.strictObject({ cards: list(cardId), version: z.literal(2).optional(), relic: relicId.optional(), relics: list(relicId).optional(),
    cardPrices: list(count).optional(), relicPrices: list(count).optional(), potionPrices: list(count).optional(), saleIndex: count.optional(),
    removalUsed: flag.optional(), restockCount: count.optional(), potions: list(potionId) })
    .refine(stock => (!stock.cardPrices || stock.cardPrices.length === stock.cards.length) && (!stock.potionPrices || stock.potionPrices.length === stock.potions.length)
        && (!stock.relicPrices || stock.relicPrices.length === (stock.relics?.length ?? 0)) && (stock.saleIndex === undefined || stock.saleIndex < stock.cards.length), 'Invalid shop prices or sale')
const room = z.discriminatedUnion('scene', [
    z.strictObject({ scene: z.literal('Chest'), rewardSeed: text }),
    z.strictObject({ scene: z.literal('Combat'), roomKind: z.enum(['monster', 'elite', 'boss']) }),
    z.strictObject({ scene: z.literal('Rewards'), rewards }), z.strictObject({ scene: z.literal('Shop'), inventory: shop.optional() }),
    z.strictObject({ scene: z.enum(['Campfire', 'Event']) }),
])
const acquisitionBase = { source: relicId, sequence: count.optional() }
const acquisition = z.discriminatedUnion('kind', [
    z.strictObject({ ...acquisitionBase, kind: z.literal('select'), operation: z.enum(['transform', 'remove', 'copy', 'bottle']), count,
        cardType: z.enum(['attack', 'skill', 'power', 'status', 'curse']).optional(), upgrade: flag.optional(), selected: list(id).optional() }),
    z.strictObject({ ...acquisitionBase, kind: z.literal('cards'), choices: list(cardId).optional() }),
    z.strictObject({ ...acquisitionBase, kind: z.literal('potion'), potionId: potionId.optional() }),
    z.strictObject({ ...acquisitionBase, kind: z.literal('relic'), rarity: z.enum(['common', 'uncommon', 'rare']).optional() }),
    z.strictObject({ ...acquisitionBase, kind: z.literal('transform_starters') }),
])
const matching = z.strictObject({ cards: z.array(cardId).length(12), matched: z.array(count.max(11)).max(12), revealed: z.array(count.max(11)).max(2), attempts: count.max(5) })
    .refine(board => new Set(board.matched).size === board.matched.length && new Set(board.revealed).size === board.revealed.length, 'Duplicate board index')
const event = z.strictObject({ id: known<EventId>(EVENT_DEFS), counts: z.record(id, count).optional(), relics: list(relicId).optional(), potionId: potionId.optional(),
    transformEligibleIds: list(id).optional(), gold: count.optional(), noteCard: noteCard.optional(), matching: matching.optional(),
    step: id.optional(), attempts: count.optional(), resolved: flag.optional(), notes: list(text).optional(), cards: list(id).optional() })
const stats = z.strictObject({ hallwayWins: count.optional(), elites: z.partialRecord(z.enum(['1', '2', '3', '4']), count).optional(),
    bosses: count.optional(), perfectElites: count.optional(), perfectBosses: count.optional(), unknownRooms: count.optional(), goldEarned: count.optional(), overkill: flag.optional(), combo: flag.optional() })

export const runSchema: z.ZodType<RunState> = z.strictObject({
    earnedAchievements: list(achievementId).optional(), pendingAcquisitions: list(acquisition).optional(), acquisitionSequence: count.optional(),
    seenRelics: list(relicId).optional(), unlockedCardIds: list(cardId).optional(), unlockedRelicIds: list(relicId).optional(), keysEnabled: flag.optional(),
    initialMaxHp: count.positive().optional(), stats: stats.optional(), modifiers: list(known<ModifierId>(MODIFIERS)).optional(), endlessLoop: count.optional(),
    blights: z.record(known<BlightId>(BLIGHTS), count).optional(), pendingBlights: list(known<BlightId>(BLIGHTS)).optional(),
    startingDraft: z.strictObject({ kind: z.enum(['draft', 'sealed']), remaining: count.max(15), picked: count.max(15), choices: list(card) }).optional(),
    character: character.default('ironclad'), mode: mode.default('standard'), runId: id.optional(), rareCardOffset: finite.optional(), potionChance: finite.min(0).max(1).optional(),
    elapsedSeconds: finite.nonnegative().optional(), keys: z.strictObject({ ruby: flag, emerald: flag, sapphire: flag }).default({ ruby: false, emerald: false, sapphire: false }),
    burningEliteActive: flag.optional(), secondBoss: flag.optional(), hallwayCount: count.optional(), mapRows: z.union([z.literal(15), z.literal(16)]).default(15),
    seed: id, act, floor: count.positive(), gold: count,
    player: z.strictObject({ maxHp: count.positive(), hp: count }).refine(player => player.hp <= player.maxHp, 'HP exceeds maximum'),
    relics: list(relicId), potions: list(potionId), maxPotionSlots: count.min(1).max(5), merchantRemoveCost: count, deck: list(card),
    neowFull: flag.optional(), neowCompleted: flag, neowSeed: text, neowChoiceId: id.optional(),
    bossRelicChoicePending: z.strictObject({ sourceBossId: known<EnemyKey>(ENEMIES), choices: list(relicId) }).optional(),
    cardsSeen: count.optional(), actsCleared: list(act).optional(), cursesObtained: count.optional(), cardsRemoved: count.optional(),
    relicState: z.record(relicId, z.strictObject({ charges: finite.optional(), counter: finite.optional() })).optional(), eventState: event.optional(),
    eventCombat: z.strictObject({ enemies: z.array(known<EnemyKey>(ENEMIES)).min(1).max(10), resumeEvent: flag.optional(), awakeLagavulin: flag.optional(), rewards }).optional(),
    eventHistory: z.record(known<EventId>(EVENT_DEFS), flag).optional(), runFlags: z.record(id, flag).optional(), asc: ascension.default(0),
    mapProgress: z.strictObject({ currentNodeId: id.optional() }).optional(),
    unknownWeights: z.strictObject({ event: finite.nonnegative(), monster: finite.nonnegative(), shop: finite.nonnegative(), chest: finite.nonnegative(), elite: finite.nonnegative().optional() }).optional(),
    rewardReturnRoom: room.optional(), pendingRoom: room.optional(), combatCount: count.optional(),
}).superRefine((run, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message })
    const event = run.eventState
    if (event?.id === 'THE_LIBRARY' && event.cards?.some(id => !Object.hasOwn(CARD_DEFS, id))) fail('Unknown event card')
    if (event?.id === 'DEAD_ADVENTURER' && event.cards?.some(id => !['gold', 'relic', 'nothing'].includes(id))) fail('Invalid adventurer reward')
    if (run.potions.length > run.maxPotionSlots) fail('Too many potions')
    const ids = new Set(run.deck.map(card => card.instanceId))
    if (event && !event.resolved && ['FALLING', 'WE_MEET_AGAIN'].includes(event.id) && event.cards?.some(id => !ids.has(id))) fail('Unknown event card instance')
    if (ids.size !== run.deck.length) fail('Duplicate deck instance ID')
    if (run.mapProgress?.currentNodeId && !getRunMap(run).byId[run.mapProgress.currentNodeId]) fail('Saved map node does not exist')
    for (const step of run.pendingAcquisitions ?? []) if (step.kind === 'select' && ((step.selected?.length ?? 0) > step.count || new Set(step.selected).size !== (step.selected?.length ?? 0) || step.selected?.some(id => !ids.has(id)))) fail('Invalid acquisition selection')
})
const characterProgress = z.strictObject({ unlocked: flag, ascension, unlockTier: count.max(5), xp: count, act3Cleared: flag, previousRunReachedBoss: flag })
const history = z.strictObject({ id, date, character, mode, seed: id, ascension, result: z.enum(['victory', 'defeat']), floor: count, actsCleared: list(act),
    score: count, elapsedSeconds: finite.nonnegative(), deck: list(z.strictObject({ id: cardId, upgrade: count })), relics: list(relicId) })
export const metaSchema: z.ZodType<MetaState> = z.strictObject({
    version: z.literal(3).optional(), customUnlocked: flag.optional(), characters: z.record(character, characterProgress).optional(), history: z.array(history).max(500).optional(),
    noteCard: noteCard.optional(), previousRunReachedBoss: flag.optional(), lastRecordedRunId: id.optional(), bestAscensionUnlocked: ascension, totalWins: count, totalRuns: count,
    ironcladUnlockTier: count.max(5), unlockedCardIds: list(cardId), unlockedRelicIds: list(relicId), achievements: z.record(achievementId, date).optional(),
    notifications: z.array(z.strictObject({ id: text, title: text, detail: text })).max(500).optional(),
}).refine(meta => meta.totalWins <= meta.totalRuns, 'Wins exceed runs')
export const settingsSchema = z.strictObject({ sound: flag, volume: finite.min(0).max(1), reducedMotion: flag,
    music: flag.default(true), musicVolume: finite.min(0).max(1).default(0.45), effectsVolume: finite.min(0).max(1).default(1) })
export const profileSchema = z.strictObject({ format: z.literal('rookmate.spire.profile'), version: z.literal(1), exportedAt: date,
    meta: metaSchema, run: runSchema.optional(), settings: settingsSchema })
export type Profile = z.infer<typeof profileSchema>
