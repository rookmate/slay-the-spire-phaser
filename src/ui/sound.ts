import type Phaser from 'phaser'
import { loadSettings, SETTINGS_CHANGED } from '../core/settings'
import type { RunState } from '../core/run'
import { beatDuration, notesAt, trackForScene, type MusicTrack } from './music'
export type SoundCue = 'card' | 'damage' | 'heal' | 'turn' | 'block' | 'power' | 'exhaust' | 'victory' | 'defeat'
const cues: Record<SoundCue, { pitches: number[]; voice: OscillatorType; duration: number }> = {
    card: { pitches: [61, 68], voice: 'triangle', duration: 0.07 },
    damage: { pitches: [43, 34], voice: 'triangle', duration: 0.07 },
    heal: { pitches: [72, 76, 79], voice: 'sine', duration: 0.1 },
    turn: { pitches: [55, 62], voice: 'sine', duration: 0.11 },
    block: { pitches: [57, 45], voice: 'sine', duration: 0.06 },
    power: { pitches: [60, 67, 72], voice: 'sine', duration: 0.09 },
    exhaust: { pitches: [68, 56, 44], voice: 'triangle', duration: 0.045 },
    victory: { pitches: [62, 65, 69, 74], voice: 'sine', duration: 0.16 },
    defeat: { pitches: [57, 53, 50, 45], voice: 'triangle', duration: 0.18 },
}
let active: SoundDirector | undefined

/** Owns one audio context and scheduler for a game, including pause and cleanup. */
export class SoundDirector {
    private context?: AudioContext
    private master?: GainNode
    private musicGain?: GainNode
    private effectsGain?: GainNode
    private track: MusicTrack = trackForScene('MainMenu')
    private timer?: ReturnType<typeof setInterval>
    private step = 0
    private nextTime = 0
    private voices = new Map<OscillatorNode, 'music' | 'effect'>()
    private lastCue = new Map<SoundCue, number>()
    private disposed = false

    unlock = (): void => {
        if (this.disposed || typeof AudioContext === 'undefined') return
        try {
            if (!this.context) {
                this.context = new AudioContext()
                this.master = this.context.createGain(); this.master.connect(this.context.destination)
                this.musicGain = this.context.createGain(); this.musicGain.connect(this.master)
                this.effectsGain = this.context.createGain(); this.effectsGain.connect(this.master)
                this.nextTime = this.context.currentTime + 0.03
                this.timer = setInterval(this.schedule, 100)
            }
            this.applySettings()
            if (!document.hidden && this.context.state === 'suspended') void this.context.resume().catch(() => {})
        } catch { /* Devices without audio still support gameplay. */ }
    }
    applySettings = (): void => {
        if (!this.context) return
        const settings = loadSettings(), now = this.context.currentTime
        this.master!.gain.setTargetAtTime(settings.sound ? settings.volume : 0, now, 0.02)
        this.musicGain!.gain.setTargetAtTime(settings.music ? settings.musicVolume : 0, now, 0.02)
        this.effectsGain!.gain.setTargetAtTime(settings.effectsVolume, now, 0.02)
        if (!settings.sound || !settings.music) this.stopMusicVoices()
    }
    visibility = (): void => {
        if (!this.context) return
        if (document.hidden) { this.stopMusicVoices(); void this.context.suspend().catch(() => {}) }
        else { this.nextTime = this.context.currentTime + 0.03; void this.context.resume().catch(() => {}) }
    }
    setTrack(track: MusicTrack): void {
        if (track.theme === this.track.theme && track.combat === this.track.combat && track.boss === this.track.boss) return
        this.track = track; this.step = 0
        this.stopMusicVoices()
        if (this.context) this.nextTime = this.context.currentTime + 0.03
    }
    cue(kind: SoundCue): void {
        this.unlock()
        const context = this.context, settings = loadSettings()
        if (!context || context.state !== 'running' || document.hidden || !settings.sound || !settings.effectsVolume) return
        if (context.currentTime - (this.lastCue.get(kind) ?? -1) < 0.08) return
        this.lastCue.set(kind, context.currentTime)
        const cue = cues[kind]
        cue.pitches.forEach((pitch, i) => this.note(pitch, context.currentTime + i * cue.duration * 0.5, cue.duration, 0.09, cue.voice, 'effect'))
    }
    private schedule = (): void => {
        const context = this.context, settings = loadSettings()
        if (!context || context.state !== 'running' || document.hidden || !settings.sound || !settings.music || !settings.musicVolume) return
        if (this.nextTime < context.currentTime) this.nextTime = context.currentTime + 0.03
        const beat = beatDuration(this.track)
        while (this.nextTime < context.currentTime + 0.22) {
            for (const note of notesAt(this.track, this.step)) this.note(note.pitch, this.nextTime, note.beats * beat, note.volume, note.voice, 'music')
            this.nextTime += beat; this.step = (this.step + 1) % 64
        }
    }
    private note(pitch: number, time: number, duration: number, volume: number, voice: OscillatorType, group: 'music' | 'effect'): void {
        const context = this.context!
        const oscillator = context.createOscillator(), gain = context.createGain()
        oscillator.type = voice; oscillator.frequency.value = 440 * 2 ** ((pitch - 69) / 12)
        gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + Math.min(0.04, duration / 4))
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
        oscillator.connect(gain); gain.connect(group === 'music' ? this.musicGain! : this.effectsGain!)
        this.voices.set(oscillator, group)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator) }
        oscillator.start(time); oscillator.stop(time + duration + 0.02)
    }
    private stopMusicVoices(): void {
        for (const [voice, group] of this.voices) if (group === 'music') { try { voice.stop() } catch { /* Already stopped. */ } }
    }
    destroy(): void {
        this.disposed = true
        if (this.timer) clearInterval(this.timer)
        for (const voice of this.voices.keys()) { try { voice.stop() } catch { /* Already stopped. */ } }
        this.voices.clear()
        if (this.context) void this.context.close().catch(() => {})
    }
}
export function attachSound(game: Phaser.Game): void {
    active?.destroy()
    const sound = active = new SoundDirector()
    document.addEventListener('pointerdown', sound.unlock)
    document.addEventListener('keydown', sound.unlock)
    document.addEventListener('visibilitychange', sound.visibility)
    window.addEventListener(SETTINGS_CHANGED, sound.applySettings)
    game.events.on('poststep', () => {
        const scene = game.scene.getScenes(true)[0] as Phaser.Scene & { run?: RunState; roomKind?: string }
        if (scene) sound.setTrack(trackForScene(scene.scene.key, scene.run?.act, scene.roomKind === 'boss'))
    })
    game.events.once('destroy', () => {
        document.removeEventListener('pointerdown', sound.unlock); document.removeEventListener('keydown', sound.unlock)
        document.removeEventListener('visibilitychange', sound.visibility); window.removeEventListener(SETTINGS_CHANGED, sound.applySettings)
        sound.destroy(); if (active === sound) active = undefined
    })
}
export function playCue(kind: SoundCue): void { active?.cue(kind) }
