import { canRemoveCard, canUpgradeCard, createCardCopy, resolveCard } from '../cards'
import { transformCard } from '../events'
import { changeMaxHp } from '../health'
import type { MetaState } from '../meta'
import { applyRelicAcquisition, blocksPotionGain, getCardRewardChoiceCount } from '../relics'
import { cardChoices, drawPotion, drawRelic } from '../rewardPools'
import { RNG } from '../rng'
import { obtainCard, obtainCardInstance, removeCardByInstanceId, type RelicId, type RunState } from '../run'
import type { CardType } from '../state'
import type { PotionId } from '../potions'

type Selection = { kind: 'select'; operation: 'transform' | 'remove' | 'copy' | 'bottle'; count: number; cardType?: CardType; upgrade?: boolean; selected?: string[] }
export type AcquisitionStep = { source: RelicId; sequence?: number } & (Selection
    | { kind: 'cards'; choices?: string[] }
    | { kind: 'potion'; potionId?: PotionId }
    | { kind: 'relic'; rarity?: 'common' | 'uncommon' | 'rare' }
    | { kind: 'transform_starters' })

export function queueAcquisition(run: RunState, step: AcquisitionStep): void {
    run.pendingAcquisitions ??= []
    run.acquisitionSequence = (run.acquisitionSequence ?? 0) + 1
    run.pendingAcquisitions.push({ ...step, sequence: run.acquisitionSequence })
}
export function queueCardRewards(run: RunState, source: RelicId, count: number): void {
    for (let i = 0; i < count; i++) queueAcquisition(run, { source, kind: 'cards' })
}
export function acquisitionCandidates(run: RunState, step: AcquisitionStep) {
    if (step.kind !== 'select') return []
    return run.deck.filter(card => !step.selected?.includes(card.instanceId)
        && (step.operation === 'copy' || canRemoveCard(card))
        && (!step.cardType || resolveCard(card).type === step.cardType))
}
/** Each completed step is removed before its effects can enqueue more acquisitions. */
export function prepareAcquisition(run: RunState, meta: MetaState): AcquisitionStep | undefined {
    while (run.pendingAcquisitions?.length) {
        const step = run.pendingAcquisitions[0]
        const rng = new RNG(`${run.seed}-acquisition-${step.source}-${step.sequence ?? run.pendingAcquisitions.length}`)
        if (step.kind === 'select') {
            const available = acquisitionCandidates(run, step)
            step.count = Math.min(step.count, available.length + (step.selected?.length ?? 0))
            if ((step.selected?.length ?? 0) < step.count) return step
            resolveSelection(run, meta, step); run.pendingAcquisitions.shift(); continue
        }
        if (step.kind === 'cards') {
            step.choices ??= cardChoices(rng, meta, getCardRewardChoiceCount(run), run, step.source === 'ORRERY' ? 'orrery' : 'hallway')
            return step
        }
        if (step.kind === 'potion') {
            step.potionId ??= drawPotion(rng, run.character, 'uniform')
            if (!blocksPotionGain(run) && run.potions.length >= run.maxPotionSlots) return step
            if (!blocksPotionGain(run)) run.potions.push(step.potionId)
            run.pendingAcquisitions.shift(); continue
        }
        run.pendingAcquisitions.shift()
        if (step.kind === 'relic') applyRelicAcquisition(run, drawRelic(rng, meta, run, step.rarity))
        if (step.kind === 'transform_starters') for (const [index, card] of [...run.deck].entries()) {
            if (/^(STRIKE|DEFEND)(_|$)/.test(card.defId) && canRemoveCard(card)) transformCard(run, meta, card.instanceId, `${run.seed}-pandora-${step.sequence}-${index}`)
        }
    }
    return undefined
}
function resolveSelection(run: RunState, meta: MetaState, step: { source: RelicId; sequence?: number } & Selection): void {
    for (const [index, id] of (step.selected ?? []).entries()) {
        const card = run.deck.find(c => c.instanceId === id)
        if (!card) continue
        if (step.operation === 'remove') removeCardByInstanceId(run, id)
        if (step.operation === 'copy') obtainCardInstance(run, createCardCopy(card))
        if (step.operation === 'bottle') card.bottled = step.source
        if (step.operation === 'transform') {
            const transformed = transformCard(run, meta, id, `${run.seed}-${step.source}-${step.sequence}-${index}`)
            if (transformed && step.upgrade && canUpgradeCard(transformed)) transformed.upgradeLevel++
        }
    }
}
export function chooseAcquisition(run: RunState, meta: MetaState, choice?: string | number): boolean {
    const step = run.pendingAcquisitions?.[0]
    if (!step) return false
    if (step.kind === 'select') {
        if (typeof choice !== 'string' || !acquisitionCandidates(run, step).some(c => c.instanceId === choice)) return false
        step.selected ??= []; step.selected.push(choice)
        prepareAcquisition(run, meta); return true
    }
    if (step.kind === 'cards') {
        if (choice === '__bowl' && run.relics.includes('SINGING_BOWL')) changeMaxHp(run, 2)
        else {
            if (choice !== undefined && (typeof choice !== 'string' || !step.choices?.includes(choice))) return false
            if (typeof choice === 'string') obtainCard(run, choice)
        }
    } else if (step.kind === 'potion') {
        if (choice !== undefined && (typeof choice !== 'number' || !run.potions[choice] || !step.potionId)) return false
        if (typeof choice === 'number' && !blocksPotionGain(run)) run.potions[choice] = step.potionId!
    } else return false
    run.pendingAcquisitions!.shift(); prepareAcquisition(run, meta); return true
}
