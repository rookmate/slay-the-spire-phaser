import type Phaser from 'phaser'

interface ActionOptions {
    label: string | (() => string)
    enabled?: () => boolean
    pressed?: () => boolean
    id?: string
    onFocus?: () => void
    persistent?: boolean
}
type View = Phaser.GameObjects.GameObject & { getBounds?: () => Phaser.Geom.Rectangle; x?: number; y?: number; visible?: boolean; alpha?: number }
interface Binding { view: View; button: HTMLButtonElement; action: () => void; options: ActionOptions; key: string }
let focusNextScene = false
const scopes = new WeakMap<Phaser.Scene, SceneAccess>()

function inside(view: View, parent: Phaser.GameObjects.GameObject): boolean {
    for (let item: Phaser.GameObjects.GameObject | null = view; item; item = item.parentContainer) if (item === parent) return true
    return false
}
function visible(view: View): boolean {
    for (let item: View | null = view; item; item = item.parentContainer) if (item.visible === false || item.alpha === 0 || item.name === 'played-card') return false
    return !!view.scene
}

/** One semantic tree per scene. Updates follow renders/actions, never the frame loop. */
export class SceneAccess {
    private root = document.createElement('section')
    private tree = document.createElement('div')
    private text = document.createElement('p')
    private actions = document.createElement('div')
    private live = document.createElement('p')
    private focusRing = document.createElement('div')
    private bindings = new Map<View, Binding>()
    private modals: { view: View; focus?: string; close?: () => void }[] = []
    private pending = false
    private disposed = false
    private focusKey?: string
    private restoreKey?: string
    private focusModal = false
    private readonly change = () => this.refresh()
    private readonly focusChanged = () => { if (!this.root.contains(document.activeElement)) this.focusRing.hidden = true }

    private scene: Phaser.Scene
    constructor(scene: Phaser.Scene) {
        this.scene = scene
        this.root.className = 'game-access'; this.root.dataset.scene = scene.scene.key
        this.tree.className = 'access-tree'
        const heading = document.createElement('h1'); heading.textContent = scene.scene.key.replace(/([a-z])([A-Z])/g, '$1 $2')
        this.root.setAttribute('aria-label', heading.textContent)
        this.live.setAttribute('role', 'status'); this.live.setAttribute('aria-live', 'polite'); this.live.setAttribute('aria-atomic', 'true')
        this.focusRing.className = 'access-focus'; this.focusRing.hidden = true; this.focusRing.setAttribute('aria-hidden', 'true')
        this.tree.append(heading, this.text, this.actions, this.live); this.root.append(this.tree, this.focusRing)
        document.getElementById('app')!.append(this.root)
        this.root.addEventListener('keydown', event => {
            if (event.key === 'Escape' && this.modals.at(-1)?.close) { event.preventDefault(); event.stopPropagation(); this.modals.at(-1)?.close?.(); return }
            if (event.key !== 'Tab' || !this.modals.length) return
            const buttons = [...this.bindings.values()].filter(binding => !binding.button.hidden && !binding.button.disabled).map(binding => binding.button)
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement) + (event.shiftKey ? -1 : 1)
            if (buttons.length && (index < 0 || index >= buttons.length)) { event.preventDefault(); buttons[(index + buttons.length) % buttons.length].focus() }
        })
        for (const event of ['create', 'pause', 'resume', 'sleep', 'wake']) scene.events.on(event, this.change)
        scene.scale.on('resize', this.change)
        document.addEventListener('focusin', this.focusChanged)
        scene.events.once('shutdown', this.destroy, this)
        scene.events.once('destroy', this.destroy, this)
    }

    bind(view: View, action: () => void, options: ActionOptions): void {
        const existing = this.bindings.get(view)
        if (existing) { existing.options = options; existing.action = action; this.refresh(); return }
        const button = document.createElement('button'); button.type = 'button'
        const key = options.id ?? `${view.type}:${view.x ?? 0}:${view.y ?? 0}:${typeof options.label === 'string' ? options.label.replace(/:.*/, '') : this.bindings.size}`
        const binding = { view, button, action, options, key }
        button.onclick = () => {
            if (!this.isAvailable(binding) || button.disabled) return
            binding.action(); this.refresh()
        }
        button.onfocus = () => { this.focusKey = key; binding.options.onFocus?.(); this.positionFocus(binding) }
        button.onblur = () => { this.focusRing.hidden = true }
        this.bindings.set(view, binding); this.actions.append(button)
        view.once('destroy', () => {
            if (document.activeElement === button) this.restoreKey = key
            button.remove(); this.bindings.delete(view); this.refresh()
        })
        this.refresh()
    }

    modal(view: View, close?: () => void): void {
        if (this.modals.some(modal => modal.view === view)) return
        this.modals.push({ view, focus: this.focusKey, close }); this.focusModal = true
        view.once('destroy', () => {
            const index = this.modals.findIndex(modal => modal.view === view)
            if (index < 0) return
            const [modal] = this.modals.splice(index, 1)
            this.restoreKey = modal.focus; this.refresh()
        })
        this.refresh()
    }

    focus(id: string): void { this.restoreKey = id; this.refresh() }

    announce(message: string): void { if (this.live.textContent !== message) this.live.textContent = message }

    refresh(): void {
        if (this.pending || this.disposed) return
        this.pending = true
        queueMicrotask(() => { this.pending = false; if (!this.disposed) this.sync() })
    }

    private isAvailable(binding: Binding): boolean {
        if (!this.scene.scene.isActive() || !visible(binding.view)) return false
        const modal = this.modals.at(-1)?.view
        return !modal || inside(binding.view, modal) || !!binding.options.persistent
    }

    private sync(): void {
        const active = this.scene.scene.isActive()
        this.root.hidden = !active
        for (const view of this.scene.children.list) if (view.type === 'DOMElement') {
            const node = (view as Phaser.GameObjects.DOMElement).node
            if (node instanceof HTMLElement) node.inert = !active || !!this.modals.length
        }
        if (!active) { this.focusRing.hidden = true; return }
        for (const binding of this.bindings.values()) {
            const { button, options } = binding
            button.hidden = !this.isAvailable(binding)
            button.disabled = options.enabled ? !options.enabled() : false
            const label = typeof options.label === 'string' ? options.label : options.label()
            if (button.textContent !== label) button.textContent = label
            if (options.pressed) button.setAttribute('aria-pressed', String(options.pressed()))
        }
        // Read visible narrative and counters. Actions are registered explicitly, never inferred here.
        const lines: string[] = []
        const visit = (view: View) => {
            if (!visible(view) || view.getData('accessCard')) return
            if (view.type === 'Text' && !this.bindings.has(view)) lines.push((view as Phaser.GameObjects.Text).text)
            if (view.type === 'Container') (view as Phaser.GameObjects.Container).list.forEach(visit)
        }
        const modal = this.modals.at(-1)?.view
        if (modal) visit(modal); else this.scene.children.list.forEach(visit)
        const summary = lines.join('. ')
        if (this.text.textContent !== summary) this.text.textContent = summary
        const available = [...this.bindings.values()].filter(binding => !binding.button.hidden && !binding.button.disabled)
        const restore = this.restoreKey && available.find(binding => binding.key === this.restoreKey)
        if (restore) restore.button.focus()
        else if (this.focusModal) available.find(binding => modal && inside(binding.view, modal))?.button.focus()
        else if (this.restoreKey || focusNextScene) available[0]?.button.focus()
        if (available.length) focusNextScene = false
        this.restoreKey = undefined; this.focusModal = false
        const focused = available.find(binding => binding.button === document.activeElement)
        if (focused) this.positionFocus(focused)
    }

    private positionFocus(binding: Binding): void {
        if (!this.isAvailable(binding)) return
        const bounds = binding.view.getBounds?.()
        if (!bounds) return
        const canvas = this.scene.game.canvas.getBoundingClientRect(), app = this.root.getBoundingClientRect()
        const sx = canvas.width / this.scene.scale.width, sy = canvas.height / this.scene.scale.height
        Object.assign(this.focusRing.style, { left: `${canvas.left - app.left + bounds.x * sx - 3}px`, top: `${canvas.top - app.top + bounds.y * sy - 3}px`, width: `${bounds.width * sx + 6}px`, height: `${bounds.height * sy + 6}px` })
        this.focusRing.hidden = false
    }

    private destroy(): void {
        if (this.disposed) return
        if (this.root.contains(document.activeElement) || this.restoreKey) focusNextScene = true
        this.disposed = true; this.root.remove(); scopes.delete(this.scene)
        for (const event of ['create', 'pause', 'resume', 'sleep', 'wake']) this.scene.events.off(event, this.change)
        this.scene.events.off('shutdown', this.destroy, this); this.scene.events.off('destroy', this.destroy, this)
        this.scene.scale.off('resize', this.change); document.removeEventListener('focusin', this.focusChanged)
        this.bindings.clear(); this.modals = []
    }
}
export function access(scene: Phaser.Scene): SceneAccess {
    let scope = scopes.get(scene)
    if (!scope) { scope = new SceneAccess(scene); scopes.set(scene, scope) }
    return scope
}
export function bindAction(view: View, action: () => void, options: ActionOptions): void {
    if (typeof document === 'undefined') return
    access(view.scene).bind(view, action, options)
}
export function actionButton<T extends View>(view: T, label: string, action: () => void, enabled = true): T {
    if (enabled) {
        if (!view.input) view.setInteractive({ useHandCursor: true })
        view.on('pointerdown', action)
    }
    bindAction(view, action, { label, enabled: () => enabled })
    return view
}
export function editingText(event: KeyboardEvent): boolean {
    return event.target instanceof HTMLElement && !!event.target.closest('input,textarea,select,[contenteditable="true"]')
}
