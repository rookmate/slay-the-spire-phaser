import { loadSettings } from '../core/settings'
let context: AudioContext | undefined
/** Original, short synthesized cues; no external audio assets. */
export function playCue(kind: 'card' | 'damage' | 'heal' | 'turn'): void {
    const settings = loadSettings()
    if (!settings.sound || !settings.volume || typeof AudioContext === 'undefined') return
    try {
        context ??= new AudioContext()
        if (context.state === 'suspended') void context.resume()
        const oscillator = context.createOscillator(), gain = context.createGain(), time = context.currentTime
        oscillator.type = kind === 'damage' ? 'triangle' : 'sine'
        const pitch = { card: 390, damage: 140, heal: 590, turn: 260 }[kind]
        oscillator.frequency.setValueAtTime(pitch, time)
        oscillator.frequency.exponentialRampToValueAtTime(pitch * (kind === 'heal' ? 1.5 : 0.7), time + 0.12)
        gain.gain.setValueAtTime(settings.volume * 0.12, time)
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14)
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(time); oscillator.stop(time + 0.15)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    } catch { /* Audio may be unavailable on a device; gameplay remains usable. */ }
}
