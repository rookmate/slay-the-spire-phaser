import type Phaser from 'phaser'
import { CARD_ART } from './cardCatalog'

export const CARD_ART_CACHE_LIMIT = 64
export const CARD_ART_SIZE = 128
interface Entry { id: string; key: string; listeners: Set<(texture: string) => void>; used: number }
const caches = new WeakMap<Phaser.Game, CardArtCache>()

/** Only visible cards acquire art. Unused textures form a bounded cache; source
 * sheets are decoded once per concurrent batch and released after extraction. */
class CardArtCache {
    private entries = new Map<string, Entry>()
    private pending = new Map<string, AbortController>()
    private failures = new Map<string, { attempts: number; retryAt: number }>()
    private clock = 0
    private disposed = false
    private textures: Phaser.Textures.TextureManager
    constructor(game: Phaser.Game) {
        this.textures = game.textures
        game.events.once('destroy', () => {
            this.disposed = true
            for (const controller of this.pending.values()) controller.abort()
            this.pending.clear(); this.entries.clear()
            // The game owns and destroys its TextureManager.
        })
    }
    acquire(id: string, ready: (texture: string) => void): () => void {
        const source = CARD_ART[id]
        if (!source || this.disposed) return () => {}
        let entry = this.entries.get(id)
        if (!entry) {
            entry = { id, key: `card-art:${id}`, listeners: new Set(), used: ++this.clock }
            this.entries.set(id, entry)
        }
        entry.listeners.add(ready); entry.used = ++this.clock
        if (this.textures.exists(entry.key)) ready(entry.key)
        else this.load(source.file)
        this.trim()
        return () => { entry.listeners.delete(ready); entry.used = ++this.clock; this.trim() }
    }
    private load(file: string): void {
        if (this.pending.has(file) || Date.now() < (this.failures.get(file)?.retryAt ?? 0)) return
        const controller = new AbortController()
        this.pending.set(file, controller)
        void this.extract(file, controller)
    }
    private async extract(file: string, controller: AbortController): Promise<void> {
        let bitmap: ImageBitmap | undefined
        try {
            const response = await fetch(`/art/${file}.webp`, { signal: controller.signal })
            if (!response.ok) throw new Error(`Card illustration unavailable: ${file}`)
            bitmap = await createImageBitmap(await response.blob())
            if (this.disposed) return
            this.failures.delete(file)
            for (const entry of this.entries.values()) {
                const source = CARD_ART[entry.id]
                if (source.file !== file || !entry.listeners.size || this.textures.exists(entry.key)) continue
                const canvas = document.createElement('canvas')
                canvas.width = canvas.height = CARD_ART_SIZE
                const context = canvas.getContext('2d')
                if (!context) continue
                context.drawImage(bitmap, source.x, source.y, source.width, source.height, 0, 0, CARD_ART_SIZE, CARD_ART_SIZE)
                this.textures.addCanvas(entry.key, canvas)
                for (const ready of entry.listeners) ready(entry.key)
            }
        } catch {
            // Text, rules and card actions remain usable when artwork cannot load.
            if (!this.disposed) {
                const attempts = Math.min((this.failures.get(file)?.attempts ?? 0) + 1, 6)
                this.failures.set(file, { attempts, retryAt: Date.now() + Math.min(1000 * 2 ** (attempts - 1), 30_000) })
            }
        } finally {
            bitmap?.close()
            this.pending.delete(file)
            if (!this.disposed) this.trim()
        }
    }
    private trim(): void {
        if (this.disposed || this.entries.size <= CARD_ART_CACHE_LIMIT) return
        const unused = [...this.entries.values()].filter(entry => !entry.listeners.size).sort((a, b) => a.used - b.used)
        for (const entry of unused) {
            if (this.entries.size <= CARD_ART_CACHE_LIMIT) break
            if (this.textures.exists(entry.key)) this.textures.remove(entry.key)
            this.entries.delete(entry.id)
        }
    }
}
export function acquireCardArt(scene: Phaser.Scene, id: string, ready: (texture: string) => void): () => void {
    const game = scene.sys.game
    let cache = caches.get(game)
    if (!cache) { cache = new CardArtCache(game); caches.set(game, cache) }
    return cache.acquire(id, ready)
}
