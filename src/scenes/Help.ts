import Phaser from 'phaser'
import { BASICS, GLOSSARY, type HelpSection } from '../ui/help/content'

export interface HelpData { owner: string; context?: HelpSection[]; onClose?: () => void; returnFocus?: HTMLElement | null }

/** Launch over the live scene so choices, settings destinations and the run clock stay intact. */
export function openHelp(scene: Phaser.Scene, context?: HelpSection[], onClose?: () => void): void {
    if (scene.scene.isActive('Help')) return
    scene.scene.launch('Help', { owner: scene.scene.key, context, onClose, returnFocus: document.activeElement as HTMLElement | null } satisfies HelpData)
    scene.scene.pause()
}

export class HelpScene extends Phaser.Scene {
    constructor() { super('Help') }
    create(data: HelpData): void {
        this.scene.bringToTop()
        const previousFocus = data.returnFocus
        const panel = document.createElement('section')
        panel.className = 'game-help'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Game guide')
        const header = document.createElement('header'), title = document.createElement('h1'), close = document.createElement('button')
        title.textContent = 'Game guide'; close.textContent = 'Back to game'
        const exit = () => this.scene.stop()
        close.onclick = exit; header.append(title, close)
        const nav = document.createElement('nav'); nav.setAttribute('aria-label', 'Guide sections')
        const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Find a rule or status'; search.setAttribute('aria-label', 'Find a rule or status')
        const content = document.createElement('div'); content.className = 'game-help-content'; content.tabIndex = 0; content.setAttribute('aria-label', 'Guide entries')
        const sources: [string, HelpSection[]][] = [...(data.context ? [['This fight', data.context] as [string, HelpSection[]]] : []), ['How to play', BASICS], ['Status effects', GLOSSARY]]
        let selected = 0
        const render = () => {
            content.replaceChildren(); content.scrollTop = 0
            const query = search.value.trim().toLowerCase()
            sources[selected][1].forEach(section => {
                const entries = section.entries.filter(entry => `${entry.title} ${entry.description}`.toLowerCase().includes(query))
                if (!entries.length) return
                const group = document.createElement('section'), heading = document.createElement('h2'), list = document.createElement('dl')
                heading.textContent = section.title; group.append(heading, list)
                for (const entry of entries) {
                    const term = document.createElement('dt'), detail = document.createElement('dd')
                    term.textContent = entry.title; detail.textContent = entry.description; list.append(term, detail)
                }
                content.append(group)
            })
            if (!content.childElementCount) { const empty = document.createElement('p'); empty.textContent = 'No matching entries. Try another word.'; content.append(empty) }
            Array.from(nav.children).forEach((button, index) => button.setAttribute('aria-pressed', String(index === selected)))
        }
        sources.forEach(([label], index) => {
            const button = document.createElement('button'); button.textContent = label
            button.onclick = () => { selected = index; search.value = ''; render() }; nav.append(button)
        })
        search.oninput = render
        panel.append(header, nav, search, content)
        document.getElementById('app')!.append(panel)
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !event.repeat) { event.preventDefault(); event.stopPropagation(); exit(); return }
            if (event.key === 'Tab') {
                const elements = [...panel.querySelectorAll<HTMLElement>('button,input,[tabindex="0"]')]
                const next = elements.indexOf(document.activeElement as HTMLElement) + (event.shiftKey ? -1 : 1)
                if (next < 0 || next >= elements.length) { event.preventDefault(); elements[(next + elements.length) % elements.length].focus() }
            }
        }
        panel.addEventListener('keydown', key)
        render(); close.focus()
        const destroy = () => {
            panel.remove()
            this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown)
        }
        const shutdown = () => {
            destroy()
            this.events.off(Phaser.Scenes.Events.DESTROY, destroy)
            const restoreFocus = () => queueMicrotask(() => { if (previousFocus?.isConnected) previousFocus.focus() })
            if (this.scene.isPaused(data.owner)) {
                this.scene.get(data.owner).events.once(Phaser.Scenes.Events.RESUME, restoreFocus)
                this.scene.resume(data.owner)
            } else restoreFocus()
            data.onClose?.()
        }
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown)
        this.events.once(Phaser.Scenes.Events.DESTROY, destroy)
    }
}
