import type { CardEngineApi, CardInstance, ChoiceZone } from '../state'

export function playerStrength(engine: { state: { player: { powers: Array<{ id: string; stacks: number }> } } }): number {
    return engine.state.player.powers.find(power => power.id === 'STRENGTH')?.stacks ?? 0
}

export function attackAmount(engine: CardEngineApi, card: CardInstance, base: number): number {
    return engine.modifyOutgoingAttackDamageFromPlayer?.(base, card.instanceId) ?? (base + playerStrength(engine))
}

export function isUpgraded(card: CardInstance): boolean {
    return card.upgradeLevel > 0
}

export function chooseOneCard(engine: CardEngineApi, opts: {
    card: CardInstance
    prompt: string
    zone: ChoiceZone
    eligibleInstanceIds: string[]
    canSkip?: boolean
    onSubmit: (instanceId: string) => void
}): void {
    if (opts.eligibleInstanceIds.length === 0) return
    engine.beginChoice?.({
        prompt: opts.prompt,
        zone: opts.zone,
        eligibleInstanceIds: opts.eligibleInstanceIds,
        minSelections: 1,
        maxSelections: 1,
        canSkip: opts.canSkip ?? false,
        sourceCardInstanceId: opts.card.instanceId,
        onSubmit: (instanceIds) => {
            const instanceId = instanceIds[0]
            if (!instanceId) return
            opts.onSubmit(instanceId)
        },
    })
}

