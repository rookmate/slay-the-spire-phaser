import { resolveCard } from './cards'
import { blockAmount } from './combatMath'
import type { Engine } from './engine'
import type { CardInstance } from './state'

/** Extra instructions accompany the ordinary damage/block line, in every card view. */
const instructions: Record<string, (upgraded: boolean) => string> = {
    BLOOD_FOR_BLOOD: () => 'Costs 1 less each time you lose HP this combat.',
    HAVOC: () => 'Play the top card of your draw pile, then Exhaust it.',
    INFERNAL_BLADE: () => 'Add a random Attack to hand. It costs 0 this turn.',
    INFLAME: u => `Gain ${u ? 3 : 2} Strength.`,
    RUPTURE: u => `When a card causes you to lose HP, gain ${u ? 2 : 1} Strength.`,
    SEVER_SOUL: () => 'Exhaust all non-Attacks in hand.',
    VOID: () => 'When drawn, lose 1 Energy.',
    ASCENDERS_BANE: () => 'Cannot be removed from your deck.',
    BASH: u => `Apply ${u ? 3 : 2} Vulnerable.`,
    BARRICADE: () => 'Keep Block between turns.',
    METALLICIZE: u => `At turn end, gain ${u ? 4 : 3} Block.`,
    DEMON_FORM: u => `Each turn, gain ${u ? 3 : 2} Strength.`,
    CORRUPTION: () => 'Skills cost 0 and Exhaust.',
    FEEL_NO_PAIN: u => `Whenever a card Exhausts, gain ${u ? 4 : 3} Block.`,
    JUGGERNAUT: u => `Whenever you gain Block, deal ${u ? 7 : 5} damage to a random enemy.`,
    DARK_EMBRACE: () => 'Whenever a card Exhausts, draw 1.',
    BRUTALITY: () => 'Each turn, lose 1 HP and draw 1.',
    BERSERK: u => `Gain ${u ? 1 : 2} Vulnerable. Each turn, gain 1 Energy.`,
    DOUBLE_TAP: u => `Play your next ${u ? '2 Attacks' : 'Attack'} twice this turn.`,
    EXHUME: () => 'Return an Exhausted card to hand. Cannot choose Exhume.',
    FIEND_FIRE: () => 'Exhaust your hand. Hit once per card Exhausted.',
    POMMEL_STRIKE: u => `Draw ${u ? 2 : 1}.`,
    SHRUG_IT_OFF: () => 'Draw 1.',
    TWIN_STRIKE: () => 'Hit twice.',
    BODY_SLAM: () => 'Base damage equals your Block.',
    ANGER: () => 'Add a copy to discard.',
    CLOTHESLINE: u => `Apply ${u ? 3 : 2} Weak.`,
    UPPERCUT: u => `Apply ${u ? 2 : 1} Weak and Vulnerable.`,
    SWORD_BOOMERANG: u => `Hit a random enemy ${u ? 4 : 3} times.`,
    THUNDERCLAP: () => 'Apply 1 Vulnerable to all enemies.',
    HEADBUTT: () => 'Put a card from discard on top of draw pile.',
    HEAVY_BLADE: u => `Strength counts ${u ? 5 : 3} times.`,
    PERFECTED_STRIKE: u => `Base damage +${u ? 3 : 2} per Strike card in combat.`,
    TRUE_GRIT: u => u ? 'Exhaust a card from hand.' : 'Exhaust a random card from hand.',
    WARCRY: u => `Draw ${u ? 2 : 1}, then put a card from hand on top of draw pile.`,
    WILD_STRIKE: () => 'Shuffle a Wound into draw pile.',
    CLASH: () => 'Requires only Attacks in hand.',
    ARMAMENTS: u => `Upgrade ${u ? 'your hand' : 'a card in hand'} for this combat.`,
    BATTLE_TRANCE: u => `Draw ${u ? 4 : 3}. Cannot draw again this turn.`,
    BLOODLETTING: u => `Lose 3 HP. Gain ${u ? 3 : 2} Energy.`,
    BURNING_PACT: u => `Exhaust a card from hand, then draw ${u ? 3 : 2}.`,
    DROPKICK: () => 'If target is Vulnerable, gain 1 Energy and draw 1.',
    ENTRENCH: () => 'Double your Block.',
    FLAME_BARRIER: u => `When attacked this turn, deal ${u ? 6 : 4} damage back.`,
    HEMOKINESIS: () => 'Lose 2 HP.',
    INTIMIDATE: u => `Apply ${u ? 2 : 1} Weak to all enemies.`,
    POWER_THROUGH: () => 'Add 2 Wounds to hand.',
    PUMMEL: u => `Hit ${u ? 5 : 4} times.`,
    SEEING_RED: () => 'Gain 2 Energy.',
    SEARING_BLOW: () => 'Can be upgraded repeatedly.',
    SENTINEL: u => `On Exhaust, gain ${u ? 3 : 2} Energy.`,
    SHOCKWAVE: u => `Apply ${u ? 5 : 3} Weak and Vulnerable to all enemies.`,
    SPOT_WEAKNESS: u => `If target intends to attack, gain ${u ? 4 : 3} Strength.`,
    DISARM: u => `Target loses ${u ? 3 : 2} Strength.`,
    FLEX: u => `Gain ${u ? 4 : 2} Strength this turn.`,
    RECKLESS_CHARGE: () => 'Shuffle a Dazed into draw pile.',
    RAGE: u => `This turn, gain ${u ? 5 : 3} Block whenever you play an Attack.`,
    EVOLVE: u => `When you draw a Status, draw ${u ? 2 : 1}.`,
    SECOND_WIND: u => `Exhaust non-Attacks from hand. Gain ${u ? 7 : 5} Block for each.`,
    WHIRLWIND: () => 'Repeat X times.',
    OFFERING: u => `Lose 6 HP. Gain 2 Energy. Draw ${u ? 5 : 3}.`,
    LIMIT_BREAK: () => 'Double your Strength.',
    REAPER: () => 'Heal for unblocked damage dealt.',
    COMBUST: u => `At turn end, lose 1 HP and deal ${u ? 7 : 5} damage to all enemies.`,
    FIRE_BREATHING: u => `When drawing a Status or Curse, deal ${u ? 10 : 6} damage to all enemies.`,
    RAMPAGE: u => `This card gains ${u ? 8 : 5} damage this combat.`,
    IMMOLATE: () => 'Add a Burn to discard.',
    FEED: u => `On non-Minion kill, gain ${u ? 4 : 3} max HP.`,
    DUAL_WIELD: u => `Copy an Attack or Power in hand ${u ? 'twice' : 'once'}.`,
    BURN: u => `At turn end, take ${u ? 4 : 2} damage. Block applies.`,
    REGRET: () => 'At turn end, lose 1 HP per card in hand.',
    PAIN: () => 'While in hand, lose 1 HP whenever you play a card.',
    PARASITE: () => 'Removing this card costs 3 max HP.',
}

export function cardDescription(card: CardInstance, engine?: Engine, targetId?: string): string {
    const def = resolveCard(card)
    const lines: string[] = []
    let base = def.baseDamage
    if (engine && def.damage) base = def.damage({ card, player: engine.state.player })
    if (base !== undefined) {
        const amount = engine ? engine.previewDamage(engine.state.player.id, targetId,
            engine.modifyOutgoingAttackDamageFromPlayer(base, card.instanceId)) : base
        lines.push(`${amount} damage${def.targeting?.type === 'all_enemies' ? ' to all enemies' : ''}.`)
    }
    if (def.baseBlock !== undefined) {
        const amount = engine ? blockAmount(def.baseBlock, engine.state.player, 'card') : def.baseBlock
        lines.push(`${amount} Block.`)
    }
    const extra = def.description?.(card) ?? instructions[card.defId]?.(card.upgradeLevel > 0)
    if (extra) lines.push(extra)
    if (def.innate) lines.push('Innate.')
    if (def.retain) lines.push('Retain.')
    if (def.unplayable) lines.push('Unplayable.')
    if (def.ethereal) lines.push('Ethereal.')
    if (def.exhaust) lines.push('Exhaust.')
    return lines.join('\n')
}
