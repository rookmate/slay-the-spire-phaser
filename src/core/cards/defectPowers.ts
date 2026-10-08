import type { CardDef } from '../state'
import { upgraded as up, definePower as power } from './builders'
export const DEFECT_POWERS: Record<string, CardDef> = {
    BIASED_COGNITION: power('BIASED_COGNITION', 'Biased Cognition', 1, 'rare', 'BIASED_COGNITION', 1, 1, c => `Gain ${up(c, 4, 5)} Focus. Lose 1 Focus each turn.`, {
        onPlay: ({ engine, card }) => { engine.applyPowerToPlayer('FOCUS', up(card, 4, 5)); engine.applyPowerToPlayer('BIASED_COGNITION', 1) }
    }),
    BUFFER: power('BUFFER', 'Buffer', 2, 'rare', 'BUFFER', 1, 2, c => `Prevent the next ${up(c, 1, 2)} instances of HP loss.`),
    CAPACITOR: power('CAPACITOR', 'Capacitor', 1, 'uncommon', 'FOCUS', 0, 0, c => `Gain ${up(c, 2, 3)} orb slots.`, { onPlay: ({ engine, card }) => engine.enqueue({ kind: 'ChangeOrbSlots', amount: up(card, 2, 3) }) }),
    CREATIVE_AI: power('CREATIVE_AI', 'Creative AI', 3, 'rare', 'CREATIVE_AI', 1, 1, () => 'Add a random Power to your hand each turn.', { upgrade: { cost: 2 } }),
    DEFRAGMENT: power('DEFRAGMENT', 'Defragment', 1, 'uncommon', 'FOCUS', 1, 2, c => `Gain ${up(c, 1, 2)} Focus.`),
    ECHO_FORM: power('ECHO_FORM', 'Echo Form', 3, 'rare', 'ECHO_FORM', 1, 1, () => 'The first card each turn plays twice.', { ethereal: true, upgrade: { ethereal: false } }),
    ELECTRODYNAMICS: power('ELECTRODYNAMICS', 'Electrodynamics', 2, 'rare', 'ELECTRODYNAMICS', 1, 1, c => `Lightning hits all enemies. Channel ${up(c, 2, 3)} Lightning.`, { onPlay: ({ engine, card }) => {
        engine.applyPowerToPlayer('ELECTRODYNAMICS', 1); for (let i = 0; i < up(card, 2, 3); i++) engine.enqueue({ kind: 'ChannelOrb', orbType: 'lightning' })
    } }),
    HEATSINKS: power('HEATSINKS', 'Heatsinks', 1, 'uncommon', 'HEATSINKS', 1, 2, c => `Draw ${up(c, 1, 2)} whenever you play a Power.`),
    HELLO_WORLD: power('HELLO_WORLD', 'Hello World', 1, 'uncommon', 'HELLO_WORLD', 1, 1, () => 'Add a random Common card to hand each turn.', { upgrade: { innate: true } }),
    LOOP: power('LOOP', 'Loop', 1, 'uncommon', 'LOOP', 1, 2, c => `Trigger your first orb's passive ${up(c, 1, 2)} times at turn start.`),
    MACHINE_LEARNING: power('MACHINE_LEARNING', 'Machine Learning', 1, 'rare', 'MACHINE_LEARNING', 1, 1, () => 'Draw 1 extra card each turn.', { upgrade: { innate: true } }),
    SELF_REPAIR: power('SELF_REPAIR', 'Self Repair', 1, 'uncommon', 'SELF_REPAIR', 7, 10, c => `Heal ${up(c, 7, 10)} HP at the end of combat.`),
    STATIC_DISCHARGE: power('STATIC_DISCHARGE', 'Static Discharge', 1, 'uncommon', 'STATIC_DISCHARGE', 1, 2, c => `Channel ${up(c, 1, 2)} Lightning when an Attack deals unblocked damage to you.`),
    STORM: power('STORM', 'Storm', 1, 'uncommon', 'STORM', 1, 1, () => 'Channel 1 Lightning whenever you play a Power.', { upgrade: { innate: true } }),
}
