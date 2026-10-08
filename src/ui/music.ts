import type { Act } from '../core/acts'
export type MusicTheme = 'menu' | 'rest' | 'exordium' | 'city' | 'beyond' | 'ending'
export interface MusicTrack { theme: MusicTheme; combat: boolean; boss: boolean }
export interface Note { pitch: number; beats: number; volume: number; voice: OscillatorType }
const scores: Record<MusicTheme, { root: number; melody: number[]; bass: number[] }> = {
    menu: { root: 50, melody: [12, 0, 19, 0, 15, 0, 14, 0, 12, 0, 10, 0, 7, 0, 0, 0], bass: [0, -2, -5, -2] },
    rest: { root: 53, melody: [12, 0, 16, 0, 19, 0, 16, 0, 14, 0, 12, 0, 9, 0, 0, 0], bass: [0, -3, -5, -3] },
    exordium: { root: 50, melody: [12, 0, 15, 19, 17, 0, 15, 0, 14, 0, 10, 12, 7, 0, 0, 0], bass: [0, -5, -2, -7] },
    city: { root: 48, melody: [12, 13, 0, 19, 17, 0, 13, 0, 12, 0, 10, 13, 7, 0, 8, 0], bass: [0, 1, -5, -2] },
    beyond: { root: 47, melody: [19, 0, 14, 0, 12, 15, 0, 14, 10, 0, 7, 0, 14, 0, 0, 0], bass: [0, -3, -7, -5] },
    ending: { root: 45, melody: [12, 0, 13, 0, 19, 0, 18, 0, 13, 0, 12, 0, 7, 0, 6, 0], bass: [0, -1, -5, -1] },
}
export function trackForScene(scene: string, act: Act = 1, boss = false): MusicTrack {
    const theme = ['MainMenu', 'Settings', 'RunHistory', 'DeckBuilder', 'Profile', 'Achievements'].includes(scene) ? 'menu'
        : scene === 'Campfire' || scene === 'RunSummary' ? 'rest' : (['exordium', 'city', 'beyond', 'ending'] as const)[act - 1]
    return { theme, combat: scene === 'Combat', boss: scene === 'Combat' && boss }
}
export function beatDuration(track: MusicTrack): number { return track.boss ? 0.26 : track.combat ? 0.34 : 0.48 }
/** A composed 64-step phrase. Audio never reads or advances the game's RNG. */
export function notesAt(track: MusicTrack, step: number): Note[] {
    const score = scores[track.theme], bar = Math.floor(step / 16) % 4, offset = score.bass[bar], notes: Note[] = []
    const melody = score.melody[step % 16]
    if (melody) notes.push({ pitch: score.root + melody + (bar === 3 ? -12 : 0), beats: 1.8, volume: 0.06, voice: 'sine' })
    if (step % 8 === 0) for (const interval of [0, 7, track.theme === 'rest' ? 16 : 15])
        notes.push({ pitch: score.root + offset + interval - 12, beats: 7.5, volume: 0.022, voice: 'sine' })
    if (track.combat && step % 2 === 0) notes.push({ pitch: score.root + offset - 12 + (step % 4 ? 7 : 0), beats: 0.7, volume: track.boss ? 0.065 : 0.04, voice: 'triangle' })
    return notes
}
