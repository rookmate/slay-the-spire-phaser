import type { Act } from './acts'
import { CARD_DEFS, canUpgradeCard, createCardCopy, createCardInstance, getUnlockedCollectibleCards } from './cards'
import { ACT_BOSSES, bossEncounter } from './encounters'
import { changeMaxHp, gainGold, healRun } from './health'
import { generateMap } from './map'
import type { MetaState } from './meta'
import { applyRelicAcquisition, getCardRewardChoiceCount, RELIC_DEFS } from './relics'
import { cardChoices, drawRelic } from './rewardPools'
import { generateRewardBundle, type RewardBundle } from './rewards'
import { RNG } from './rng'
import { obtainCurse, removeCardByInstanceId, type RunState } from './run'
import type { CardInstance } from './state'
import { EVENT_DEFS } from './events/definitions'
import type { EventChoiceDef, EventId, EventResolution } from './events/model'
export { EVENT_DEFS }
export type { EventChoiceDef, EventId, EventResolution } from './events/model'
export type EventChoiceId = string

const shared: EventId[] = ['UPGRADE_SHRINE', 'GOLDEN_SHRINE', 'TRANSMOGRIFIER', 'DUPLICATOR', 'WHEEL_OF_CHANGE']
const pools: Record<Act, EventId[]> = {
    1: ['WORLD_OF_GOOP', 'CLERIC', 'GOLDEN_IDOL', 'BIG_FISH', 'SCRAP_OOZE', 'LIVING_WALL', 'THE_SSSSERPENT'],
    2: ['FORGOTTEN_ALTAR', 'THE_MAUSOLEUM', 'BEGGAR', 'THE_JOUST', 'ANCIENT_WRITING', 'THE_LIBRARY'],
    3: ['FALLING', 'WINDING_HALLS', 'MIND_BLOOM', 'THE_MOAI_HEAD', 'MYSTERIOUS_SPHERE', 'SECRET_PORTAL', 'SENSORY_STONE', 'RED_MASK_TOMB'],
    4: [],
}
export function getEventPool(act: Act): EventId[] { return [...pools[act], ...shared] }
export function generateEvent(act: Act, seed: string, run?: RunState): EventId {
    const available = getEventPool(act).filter(id => !run || (!run.eventHistory?.[id] && (EVENT_DEFS[id].eligible?.(run) ?? true)))
    // Exhausted events leave a harmless shrine instead of repeating forced costs.
    return available.length ? available[new RNG(seed).int(0, available.length - 1)] : 'UPGRADE_SHRINE'
}
export function eventSeed(run: RunState): string { return `${run.seed}-event-${run.act}-${run.mapProgress?.currentNodeId ?? run.floor}` }
export function initializeEvent(run: RunState, meta: MetaState, id?: EventId): void {
    if (run.eventState) return
    const eventId = id ?? generateEvent(run.act, eventSeed(run), run)
    run.eventState = { id: eventId }
    run.eventHistory ??= {}; run.eventHistory[eventId] = true
    const rng = new RNG(eventSeed(run))
    if (eventId === 'FALLING') run.eventState.cards = ['skill', 'power', 'attack'].flatMap(type => {
        const pool = run.deck.filter(card => CARD_DEFS[card.defId].type === type)
        return pool.length ? [pool[rng.int(0, pool.length - 1)].instanceId] : []
    })
    if (eventId === 'THE_LIBRARY') run.eventState.cards = cardChoices(rng, meta, 20, run, 'shop')
}
export function getEventChoices(run: RunState): EventChoiceDef[] {
    if (!run.eventState || run.eventState.resolved) return []
    return EVENT_DEFS[run.eventState.id].choices(run)
}
export function transformCard(run: RunState, meta: MetaState, instanceId: string, seed: string): CardInstance | undefined {
    const original = run.deck.find(card => card.instanceId === instanceId)
    if (!original || original.defId === 'ASCENDERS_BANE') return undefined
    const def = CARD_DEFS[original.defId]
    const pool = (def.type === 'curse' ? Object.values(CARD_DEFS).filter(c => c.type === 'curse' && c.id !== 'ASCENDERS_BANE').map(c => c.id)
        : def.color === 'colorless' ? Object.values(CARD_DEFS).filter(c => c.color === 'colorless' && c.poolEnabled).map(c => c.id)
        : getUnlockedCollectibleCards(meta)).filter(id => id !== original.defId)
    if (!pool.length || !removeCardByInstanceId(run, instanceId)) return undefined
    const id = pool[new RNG(seed).int(0, pool.length - 1)]
    if (def.type === 'curse') return obtainCurse(run, id)
    const next = createCardInstance(id); run.deck.push(next); return next
}

export function resolveEventChoice(run: RunState, meta: MetaState, eventId: EventId, choiceId: string, seed: string, selection?: { cardInstanceId?: string; cardId?: string }): EventResolution {
    initializeEvent(run, meta, eventId)
    const state = run.eventState!
    if (state.id !== eventId || state.resolved) return { notes: state.notes ?? [] }
    const choice = getEventChoices(run).find(c => c.id === choiceId)
    if (!choice || choice.disabled?.(run)) return { notes: ['That choice is unavailable.'] }
    const selected = run.deck.find(c => c.instanceId === selection?.cardInstanceId)
    if (choice.requiresSelection && choice.requiresSelection !== 'reward') {
        if (!selected || (choice.requiresSelection !== 'copy' && selected.defId === 'ASCENDERS_BANE') || (choice.requiresSelection === 'upgrade' && !canUpgradeCard(selected))) return { notes: ['Choose an eligible card.'] }
    }
    if (choice.requiresSelection === 'reward' && !state.cards?.includes(selection?.cardId ?? '')) return { notes: ['Choose one of the offered cards.'] }
    const rng = new RNG(`${seed}-${state.attempts ?? 0}`)
    const notes: string[] = []
    const result: EventResolution = { notes }
    const worse = (normal: number, high: number) => run.asc >= 15 ? high : normal
    const damage = (amount: number) => { run.player.hp = Math.max(0, run.player.hp - amount); notes.push(`Lost ${amount} HP.`) }
    const heal = (amount: number) => { notes.push(`Healed ${healRun(run, amount)} HP.`) }
    const gold = (amount: number) => { gainGold(run, amount); notes.push(`Gained ${amount} Gold.`) }
    const relic = (rare = false) => { const id = drawRelic(rng, meta, run.relics, rare ? 'rare' : undefined); applyRelicAcquisition(run, id); notes.push(`Obtained ${RELIC_DEFS[id].name}.`) }
    const curse = (id: string) => { const before = run.deck.length; obtainCurse(run, id); notes.push(run.deck.length > before ? `Obtained ${CARD_DEFS[id].name}.` : 'Omamori blocked the curse.') }
    const maxHp = (amount: number) => { changeMaxHp(run, amount); notes.push(`${amount >= 0 ? 'Gained' : 'Lost'} ${Math.abs(amount)} max HP.`) }
    let finished = true
    const rewards = (bundle: RewardBundle) => { run.pendingRoom = { scene: 'Rewards', rewards: bundle }; result.nextScene = 'Rewards' }
    switch (choiceId) {
        case 'WORLD_OF_GOOP_REACH': damage(11); gold(75); break
        case 'WORLD_OF_GOOP_LEAVE': { const lost = Math.min(run.gold, rng.int(worse(20, 35), worse(50, 75))); run.gold -= lost; notes.push(`Lost ${lost} Gold.`); break }
        case 'CLERIC_HEAL': run.gold -= 35; heal(Math.floor(run.player.maxHp / 4)); break
        case 'CLERIC_PURGE': run.gold -= worse(50, 75); break
        case 'BEGGAR_GIVE': run.gold -= 75; break
        case 'GOLDEN_IDOL_TAKE': applyRelicAcquisition(run, 'GOLDEN_IDOL'); state.step = 'trap'; finished = false; notes.push('You take the idol. The trap springs.'); break
        case 'IDOL_INJURY': curse('INJURY'); break
        case 'IDOL_DAMAGE': damage(Math.floor(run.player.maxHp * worse(0.25, 0.35))); break
        case 'IDOL_MAX_HP': maxHp(-Math.floor(run.player.maxHp * worse(0.08, 0.1))); break
        case 'BIG_FISH_BANANA': heal(Math.floor(run.player.maxHp / 3)); break
        case 'BIG_FISH_DONUT': maxHp(5); break
        case 'BIG_FISH_BOX': curse('REGRET'); relic(); break
        case 'THE_JOUST_OWNER': case 'THE_JOUST_MURDERER': {
            run.gold -= 50
            const ownerWins = rng.random() < 0.3
            if (ownerWins === (choiceId === 'THE_JOUST_OWNER')) gold(ownerWins ? 250 : 100)
            else notes.push('Your rider lost the wager.')
            break
        }
        case 'SCRAP_OOZE_SEARCH': {
            const attempt = state.attempts ?? 0
            damage(worse(3, 5) + attempt)
            if (run.player.hp > 0 && rng.random() < 0.25 + attempt * 0.1) relic()
            else { state.attempts = attempt + 1; finished = false; notes.push('The relic is still buried.') }
            break
        }
        case 'THE_SSSSERPENT_AGREE': gold(worse(175, 150)); curse('DOUBT'); break
        case 'ALTAR_IDOL': run.relics = run.relics.filter(id => id !== 'GOLDEN_IDOL'); applyRelicAcquisition(run, 'BLOODY_IDOL'); notes.push('Obtained Bloody Idol.'); break
        case 'FORGOTTEN_ALTAR_BLOOD': maxHp(5); damage(Math.floor(run.player.maxHp * worse(0.25, 0.35))); break
        case 'FORGOTTEN_ALTAR_DESECRATE': curse('DECAY'); break
        case 'THE_MAUSOLEUM_OPEN': if (rng.random() < worse(0.5, 1)) curse('WRITHE'); relic(); break
        case 'WRITING_UPGRADE': for (const card of run.deck) if (CARD_DEFS[card.defId].rarity === 'basic' && /^(STRIKE|DEFEND)(_|$)/.test(card.defId) && canUpgradeCard(card)) card.upgradeLevel++; notes.push('Upgraded all Strikes and Defends.'); break
        case 'LIBRARY_READ': run.deck.push(createCardInstance(selection!.cardId!)); notes.push(`Obtained ${CARD_DEFS[selection!.cardId!].name}.`); break
        case 'LIBRARY_SLEEP': heal(Math.floor(run.player.maxHp * worse(0.33, 0.2))); break
        case 'SHRINE_PRAY': gold(worse(100, 50)); break
        case 'SHRINE_DESECRATE': gold(275); curse('REGRET'); break
        case 'WHEEL_SPIN': {
            switch (rng.int(0, 5)) {
                case 0: gold(100 * run.act); break
                case 1: relic(); break
                case 2: heal(run.player.maxHp); break
                case 3: curse('DECAY'); break
                case 4: state.step = 'remove'; finished = false; notes.push('The wheel offers to remove a card.'); break
                case 5: damage(Math.floor(run.player.maxHp * worse(0.1, 0.15))); break
            }
            break
        }
        case 'HALLS_MADNESS': run.deck.push(createCardInstance('MADNESS'), createCardInstance('MADNESS')); damage(Math.round(run.player.maxHp * worse(0.125, 0.18))); break
        case 'HALLS_WRITHE': curse('WRITHE'); heal(Math.floor(run.player.maxHp * worse(0.25, 0.2))); break
        case 'HALLS_MAX_HP': maxHp(-Math.floor(run.player.maxHp * 0.05)); break
        case 'BLOOM_AWAKE': for (const card of run.deck) if (canUpgradeCard(card)) card.upgradeLevel++; applyRelicAcquisition(run, 'MARK_OF_THE_BLOOM'); notes.push('All cards upgraded. Healing is sealed.'); break
        case 'BLOOM_RICH': gold(999); curse('NORMALITY'); curse('NORMALITY'); break
        case 'BLOOM_HEALTHY': heal(run.player.maxHp); curse('DOUBT'); break
        case 'MOAI_HP': maxHp(-Math.floor(run.player.maxHp * worse(0.125, 0.18))); heal(run.player.maxHp); break
        case 'MOAI_IDOL': run.relics = run.relics.filter(id => id !== 'GOLDEN_IDOL'); gold(333); break
        case 'BLOOM_WAR': case 'SPHERE_FIGHT': {
            const bundle = generateRewardBundle(`${seed}-reward`, 'hallway', run, meta)
            bundle.items = bundle.items.filter(i => i.kind !== 'gold')
            bundle.items.unshift({ kind: 'gold', amount: choiceId === 'BLOOM_WAR' ? (run.asc >= 13 ? 25 : 50) : rng.int(45, 55) }, { kind: 'relic', relicId: drawRelic(rng, meta, run.relics, 'rare') })
            run.eventCombat = { enemies: choiceId === 'BLOOM_WAR' ? bossEncounter(ACT_BOSSES[1][rng.int(0, 2)]) : ['ORB_WALKER', 'ORB_WALKER'], rewards: bundle }
            run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }; result.nextScene = 'Combat'; break
        }
        case 'PORTAL_ENTER': {
            const boss = generateMap(run.seed, run.act, run.mapRows ?? 16, 7, run.asc).nodes.find(n => n.kind === 'boss')!
            run.mapProgress = { currentNodeId: boss.id }; run.floor = 50
            run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }; result.nextScene = 'Combat'; break
        }
        case 'SENSORY_1': case 'SENSORY_2': case 'SENSORY_3': {
            const count = Number(choiceId.slice(-1)); if (count > 1) damage((count - 1) * 5)
            rewards({ tier: 'hallway', items: Array.from({ length: count }, () => ({ kind: 'cards', choices: cardChoices(rng, meta, getCardRewardChoiceCount(run), run, 'colorless') })) }); break
        }
        case 'MASK_WEAR': gold(222); break
        case 'MASK_PAY': run.gold = 0; applyRelicAcquisition(run, 'RED_MASK'); notes.push('Obtained Red Mask.'); break
        default: if (choiceId.startsWith('FALL_')) { removeCardByInstanceId(run, choiceId.slice(5)); notes.push('Released the card.'); }
    }
    if (selected) {
        if (choice.requiresSelection === 'remove') { removeCardByInstanceId(run, selected.instanceId); notes.push(`Removed ${CARD_DEFS[selected.defId].name}.`) }
        if (choice.requiresSelection === 'upgrade') { selected.upgradeLevel++; notes.push(`Upgraded ${CARD_DEFS[selected.defId].name}.`) }
        if (choice.requiresSelection === 'transform') { result.transformedCard = transformCard(run, meta, selected.instanceId, seed); notes.push(`Transformed into ${CARD_DEFS[result.transformedCard!.defId].name}.`) }
        if (choice.requiresSelection === 'copy') { run.deck.push(createCardCopy(selected)); notes.push(`Copied ${CARD_DEFS[selected.defId].name}.`) }
    }
    if (run.player.hp <= 0) { finished = true; result.nextScene = 'RunSummary' }
    state.resolved = finished; state.notes = notes.length ? notes : ['You continue on your way.']
    return result
}
