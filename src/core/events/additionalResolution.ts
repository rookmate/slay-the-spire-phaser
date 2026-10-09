import { CARD_DEFS, RANDOM_CURSE_IDS, canRemoveCard, canUpgradeCard, createCardInstance, createCardCopy } from '../cards'
import { selectCardPool } from '../contentPools'
import { changeMaxHp, gainGold, healRun, loseRunHp } from '../health'
import type { MetaState } from '../meta'
import { getCharacterProgress } from '../meta'
import { applyRelicAcquisition, blocksPotionGain } from '../relics'
import { drawPotion, drawRelic } from '../rewardPools'
import { generateRewardBundle, type RewardBundle } from '../rewards'
import type { RNG } from '../rng'
import { obtainCard, obtainCardInstance, obtainCurse, removeCardByInstanceId, type RelicId, type RunState } from '../run'
import type { CardInstance } from '../state'
import type { EventResolution } from './model'
import type { EnemyKey } from '../encounters'

export function initializeAdditionalEvent(run: RunState, meta: MetaState, rng: RNG): void {
    const state = run.eventState!
    if (state.id === 'NLOTH') { state.relics = [...run.relics]; rng.shuffleInPlace(state.relics); state.relics = state.relics.slice(0, 2) }
    if (state.id === 'DESIGNER') state.counts = { randomUpgrade: rng.int(0, 1), twoTransforms: rng.int(0, 1) }
    if (state.id === 'NOTE_FOR_YOURSELF') state.noteCard = { ...(meta.noteCard ?? { defId: 'IRON_WAVE', upgradeLevel: 0 }) }
    if (state.id === 'WE_MEET_AGAIN') {
        const cards = run.deck.filter(c => canRemoveCard(c) && !['basic'].includes(CARD_DEFS[c.defId].rarity ?? '') && CARD_DEFS[c.defId].type !== 'curse')
        state.cards = cards.length ? [cards[rng.int(0, cards.length - 1)].instanceId] : []
        if (run.potions.length) state.potionId = run.potions[rng.int(0, run.potions.length - 1)]
        state.gold = run.gold >= 50 ? rng.int(50, Math.min(run.gold, 150)) : 50
    }
    if (state.id === 'DEAD_ADVENTURER') { state.counts = { enemy: rng.int(0, 2) }; state.cards = ['gold', 'relic', 'nothing']; rng.shuffleInPlace(state.cards) }
    if (state.id === 'MATCH_AND_KEEP') {
        const pool = selectCardPool({ character: run.character, source: 'reward', unlockedIds: run.unlockedCardIds, meta })
        const pick = (ids: string[]) => ids[rng.int(0, ids.length - 1)]
        const pairs = ['common', 'uncommon', 'rare'].map(rarity => pick(pool.filter(id => CARD_DEFS[id].rarity === rarity)))
        pairs.push(pick(RANDOM_CURSE_IDS), rng.random() < 0.5 ? 'STRIKE' + (run.character === 'ironclad' ? '' : '_' + run.character.toUpperCase()) : 'DEFEND' + (run.character === 'ironclad' ? '' : '_' + run.character.toUpperCase()))
        pairs.push(run.asc >= 15 ? pick(RANDOM_CURSE_IDS) : pick(selectCardPool({ character: run.character, source: 'colorless' })))
        const cards = pairs.flatMap(id => [id, id]); rng.shuffleInPlace(cards)
        state.matching = { cards, matched: [], revealed: [], attempts: 5 }
    }
}
export function noteEventEligible(run: RunState, meta: MetaState): boolean {
    return run.mode !== 'daily' && run.asc < 15 && (run.asc === 0 || run.asc < getCharacterProgress(meta, run.character).ascension)
}
export function flipEventCard(run: RunState, index: number): boolean {
    const state = run.eventState, board = state?.matching
    if (!board || state?.resolved || !board.cards[index] || board.matched.includes(index)) return false
    if (board.revealed.length === 2) board.revealed = []
    if (board.revealed.includes(index) || board.attempts <= 0) return false
    board.revealed.push(index)
    if (board.revealed.length === 2) {
        board.attempts--
        const [a, b] = board.revealed
        if (board.cards[a] === board.cards[b]) { obtainCard(run, board.cards[a]); board.matched.push(a, b) }
        if (!board.attempts || board.matched.length === board.cards.length) { state!.resolved = true; state!.notes = ['The game is over. Matched cards have been added to your deck.'] }
    }
    return true
}
export function upgradeRandomCards(run: RunState, rng: RNG, count: number): void {
    const cards = run.deck.filter(canUpgradeCard); rng.shuffleInPlace(cards)
    for (const card of cards.slice(0, count)) card.upgradeLevel++
}

/** Extra events use the same selection validation and checkpoint finalization as the original events. */
export function resolveAdditionalEvent(run: RunState, meta: MetaState, id: string, rng: RNG, result: EventResolution, selected?: CardInstance): boolean {
    const state = run.eventState!, notes = result.notes
    const worse = (a: number, b: number) => run.asc >= 15 ? b : a
    const damage = (amount: number) => { notes.push(`Lost ${loseRunHp(run, amount)} HP.`) }
    const relic = (id = drawRelic(rng, meta, run)) => { applyRelicAcquisition(run, id); notes.push(`Obtained ${id.toLowerCase().replaceAll('_', ' ')}.`) }
    const offerPotions = (count: number, resume = false) => {
        if (blocksPotionGain(run)) return
        const rewards: RewardBundle = { tier: 'hallway', advanceFloor: !resume, items: Array.from({ length: count }, () => ({ kind: 'potion', potionId: drawPotion(rng, run.character, 'uniform') })) }
        if (resume) run.rewardReturnRoom = { scene: 'Event' }
        run.pendingRoom = { scene: 'Rewards', rewards }; result.nextScene = 'Rewards'
    }
    const fight = (enemies: EnemyKey[], bundle: RewardBundle, elite = false, resume = false) => {
        run.eventCombat = { enemies, rewards: bundle, resumeEvent: resume }
        run.pendingRoom = { scene: 'Combat', roomKind: elite ? 'elite' : 'monster' }; result.nextScene = 'Combat'
    }
    const normalRewards = () => generateRewardBundle(`${run.seed}-event-combat-${run.floor}`, 'hallway', run, meta)
    switch (id) {
        case 'WING_PRAY': damage(7); break
        case 'WING_DESTROY': gainGold(run, rng.int(50, 80)); break
        case 'LIGHT_ENTER': damage(Math.ceil(run.player.maxHp * worse(0.2, 0.3))); upgradeRandomCards(run, rng, 2); break
        case 'MUSHROOM_EAT': healRun(run, Math.floor(run.player.maxHp / 4)); obtainCurse(run, 'PARASITE'); break
        case 'MUSHROOM_FIGHT': { const bundle = normalRewards(); bundle.items.push({ kind: 'relic', relicId: 'ODD_MUSHROOM' }); fight(['FUNGI_BEAST', 'FUNGI_BEAST', 'FUNGI_BEAST'], bundle); break }
        case 'GHOST_ACCEPT': changeMaxHp(run, -Math.floor(run.player.maxHp / 2)); for (let i = 0; i < worse(5, 3); i++) obtainCard(run, 'APPARITION'); break
        case 'VAMPIRE_ACCEPT': case 'VAMPIRE_VIAL':
            if (id === 'VAMPIRE_ACCEPT') changeMaxHp(run, -Math.floor(run.player.maxHp * 0.3))
            else run.relics = run.relics.filter(r => r !== 'BLOOD_VIAL')
            for (const card of [...run.deck]) if (/^STRIKE(_|$)/.test(card.defId)) removeCardByInstanceId(run, card.instanceId)
            for (let i = 0; i < 5; i++) obtainCard(run, 'BITE')
            break
        case 'TOME_READ': state.attempts = (state.attempts ?? 0) + 1; damage(state.attempts); return false
        case 'TOME_TAKE': damage(worse(10, 15)); relic((['NECRONOMICON', 'ENCHIRIDION', 'NILRYS_CODEX'] as const)[rng.int(0, 2)]); break
        case 'TOME_STOP': damage(3); break
        case 'NEST_DAGGER': damage(6); obtainCard(run, 'RITUAL_DAGGER'); break
        case 'NEST_GOLD': gainGold(run, worse(99, 50)); break
        case 'AUGMENT_JAX': obtainCard(run, 'JAX'); break
        case 'AUGMENT_MUTAGEN': relic('MUTAGENIC_STRENGTH'); break
        case 'AUGMENT_TRANSFORM': case 'DESIGN_TRANSFORM':
            if (state.step !== 'transform') { if (id === 'DESIGN_TRANSFORM') run.gold -= worse(60, 75); state.step = 'transform'; state.attempts = 1; return false }
            break
        case 'VAGRANT_GOLD': run.gold -= 85; relic(); break
        case 'VAGRANT_ROB': obtainCurse(run, 'SHAME'); relic(); break
        case 'FOUNTAIN_DRINK': for (const card of [...run.deck]) if (CARD_DEFS[card.defId].type === 'curse') removeCardByInstanceId(run, card.instanceId); break
        case 'BONFIRE_OFFER': {
            const def = CARD_DEFS[selected!.defId]
            if (def.type === 'curse') relic('SPIRIT_POOP')
            else if (def.rarity === 'common') healRun(run, 5)
            else if (def.rarity === 'uncommon') healRun(run, run.player.maxHp)
            else if (def.rarity === 'rare') { changeMaxHp(run, 10); healRun(run, run.player.maxHp) }
            break
        }
        case 'FORGE_RUMMAGE': relic('WARPED_TONGS'); obtainCurse(run, 'PAIN'); break
        case 'LAB_SEARCH': offerPotions(3); break
        case 'WOMAN_1': case 'WOMAN_2': case 'WOMAN_3': { const count = Number(id.slice(-1)); run.gold -= 10 + count * 10; offerPotions(count); break }
        case 'WOMAN_LEAVE': if (run.asc >= 15) damage(Math.floor(run.player.maxHp * 0.05)); break
        case 'FACE_TOUCH': damage(Math.max(1, Math.floor(run.player.maxHp / 10))); gainGold(run, worse(75, 50)); break
        case 'FACE_TRADE': relic((['FACE_OF_CLERIC', 'SSSERPENT_HEAD', 'NLOTHS_HUNGRY_FACE', 'GREMLIN_VISAGE', 'CULTIST_HEADPIECE'] as const)[rng.int(0, 4)]); break
        case 'SKULL_POTION': case 'SKULL_GOLD': case 'SKULL_CARD': case 'SKULL_LEAVE': {
            const key = id.slice(6); state.counts ??= {}; damage(6 + (state.counts[key] ?? 0)); state.counts[key] = (state.counts[key] ?? 0) + 1
            state.attempts = (state.attempts ?? 0) + 1
            if (id === 'SKULL_GOLD') gainGold(run, 90)
            if (id === 'SKULL_POTION' && run.player.hp > 0) offerPotions(1, true)
            if (id === 'SKULL_CARD') { const pool = selectCardPool({ character: run.character, source: 'colorless', rarity: 'uncommon' }); obtainCard(run, pool[rng.int(0, pool.length - 1)]) }
            return id === 'SKULL_LEAVE'
        }
        case 'MEET_POTION': run.potions.splice(run.potions.indexOf(state.potionId!), 1); relic(); break
        case 'MEET_GOLD': run.gold -= state.gold!; relic(); break
        case 'MEET_CARD': removeCardByInstanceId(run, state.cards![0]); relic(); break
        case 'NOTE_TRADE': {
            const saved = createCardInstance(state.noteCard?.defId ?? 'IRON_WAVE', state.noteCard?.upgradeLevel ?? 0)
            Object.assign(saved, state.noteCard)
            meta.noteCard = { defId: selected!.defId, upgradeLevel: selected!.upgradeLevel, permanentDamage: selected!.permanentDamage, permanentBlock: selected!.permanentBlock }
            obtainCardInstance(run, createCardCopy(saved)); break
        }
        case 'DESIGN_RANDOM': run.gold -= worse(40, 50); upgradeRandomCards(run, rng, 2); break
        case 'DESIGN_UPGRADE': run.gold -= worse(40, 50); break
        case 'DESIGN_REMOVE': run.gold -= worse(60, 75); break
        case 'DESIGN_FULL': run.gold -= worse(90, 110); break
        case 'DESIGN_PUNCH': damage(worse(3, 5)); break
        case 'BANDITS_PAY': run.gold = 0; break
        case 'BANDITS_FIGHT': { const bundle = normalRewards(); bundle.items = bundle.items.filter(i => i.kind !== 'gold'); bundle.items.push({ kind: 'gold', amount: rng.int(25, 35) }, { kind: 'relic', relicId: 'RED_MASK' }); fight(['POINTY', 'ROMEO', 'BEAR'], bundle); break }
        case 'COLOSSEUM_FIRST': state.step = 'second'; fight(['RED_SLAVER', 'BLUE_SLAVER'], { tier: 'hallway', items: [], advanceFloor: false }, false, true); return false
        case 'COLOSSEUM_SECOND': {
            const bundle = generateRewardBundle(`${run.seed}-colosseum-${run.floor}`, 'elite', run, meta, { includeRelics: false })
            bundle.items = bundle.items.filter(i => i.kind === 'cards' || i.kind === 'potion')
            bundle.items.push({ kind: 'gold', amount: 100 }, { kind: 'relic', relicId: drawRelic(rng, meta, run, 'uncommon') }, { kind: 'relic', relicId: drawRelic(rng, meta, run, 'rare') })
            fight(['GREMLIN_NOB', 'TASKMASTER'], bundle, true); break
        }
        case 'ADVENTURER_SEARCH': {
            const attempt = state.attempts ?? 0
            state.attempts = attempt + 1
            if (rng.random() < worse(0.25, 0.35) + attempt * 0.25) {
                const bundle = generateRewardBundle(`${run.seed}-adventurer-${run.floor}`, 'elite', run, meta, { includeRelics: false })
                bundle.items = bundle.items.filter(i => i.kind === 'cards' || i.kind === 'potion')
                if (state.cards?.includes('gold')) bundle.items.push({ kind: 'gold', amount: 30 })
                if (state.cards?.includes('relic')) bundle.items.push({ kind: 'relic', relicId: drawRelic(rng, meta, run) })
                fight([['GREMLIN_NOB'], ['LAGAVULIN'], ['SENTRY', 'SENTRY', 'SENTRY']][state.counts?.enemy ?? 0] as EnemyKey[], bundle, true)
                run.eventCombat!.awakeLagavulin = true
            } else {
                const loot = state.cards?.shift()
                if (loot === 'gold') gainGold(run, 30)
                else if (loot === 'relic') relic()
                else notes.push('You find nothing.')
                return !state.cards?.length
            }
            break
        }
        default:
            if (id.startsWith('NLOTH_')) {
                const lost = id.slice(6) as RelicId
                if (!state.relics?.includes(lost)) return false
                run.relics = run.relics.filter(r => r !== lost)
                for (const card of run.deck) if (card.bottled === lost) card.bottled = undefined
                relic('NLOTHS_GIFT')
            }
    }
    return true
}
