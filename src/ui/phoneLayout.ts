import Phaser from 'phaser'

/** Pause only scenes that were running before a phone rotated to portrait. */
export function attachPhoneLayout(game: Phaser.Game): void {
    const portrait = window.matchMedia('(any-pointer: coarse) and (max-width: 600px) and (orientation: portrait)')
    const app = document.getElementById('app')!
    const prompt = document.createElement('div')
    prompt.className = 'rotate-prompt'
    prompt.hidden = true
    prompt.setAttribute('role', 'dialog')
    prompt.setAttribute('aria-modal', 'true')
    prompt.setAttribute('aria-labelledby', 'rotate-title')
    const title = document.createElement('h1')
    title.id = 'rotate-title'; title.textContent = 'Rotate to play'
    const detail = document.createElement('p')
    detail.textContent = 'Turn your phone sideways to continue. Your game is paused.'
    prompt.append(title, detail)
    document.body.append(prompt)
    const paused = new Set<string>()
    const update = () => {
        const blocked = portrait.matches
        prompt.hidden = !blocked
        app.inert = blocked
        if (blocked) {
            for (const scene of game.scene.getScenes(true)) {
                // Loading must finish before the first playable screen is paused.
                if (scene.scene.key === 'Boot') continue
                paused.add(scene.scene.key)
                scene.scene.pause()
            }
        } else {
            for (const key of paused) if (game.scene.isPaused(key)) game.scene.resume(key)
            paused.clear()
        }
    }
    portrait.addEventListener('change', update)
    game.events.on(Phaser.Core.Events.POST_STEP, update)
    game.events.once(Phaser.Core.Events.DESTROY, () => {
        portrait.removeEventListener('change', update)
        game.events.off(Phaser.Core.Events.POST_STEP, update)
        app.inert = false
        prompt.remove()
    })
    update()
}
