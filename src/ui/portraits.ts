import type Phaser from 'phaser'
/** Original vector silhouettes for characters without a bundled portrait. */
export function loadCharacterPortraits(scene: Phaser.Scene): void {
    const frame = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="190" viewBox="0 0 160 190">${body}</svg>`
    const portraits = {
        silent: frame('<path d="M33 175 42 83 58 40 83 14 110 44 127 178Z" fill="#42583c" stroke="#bac79b" stroke-width="3"/><path d="m57 50 25-24 24 25-11 45H66Z" fill="#d9d6bd"/><path d="m66 57 12 7-14 3m31-10-12 7 14 3" fill="#171b16"/><path d="m74 71 9-1 8 15-15 5Z" fill="#292b25"/><path d="m56 105-35 41 21 1 32-30m34-10 26 40-18-2-25-29" fill="#768b62"/><path d="m18 154 31-26-20 41Zm102-17 27 15-15 20Z" fill="#b9c3bf"/><path d="m73 100-11 73m29-73 15 73" stroke="#283523" stroke-width="8"/>'),
        defect: frame('<path d="m45 169 10-74 55-1 18 75-21 9-10-52-9 56-23-1-5-53-2 47Z" fill="#476671" stroke="#b8cfcd" stroke-width="3"/><path d="m54 36 28-19 28 22-8 46-45-1Z" fill="#748f94" stroke="#b8cfcd" stroke-width="3"/><path d="m61 50 43-1-11 19-25-2Z" fill="#202d32"/><circle cx="83" cy="57" r="9" fill="#e9bf67"/><path d="m49 99-27 38 10 7 34-26m40-21 23 39-11 9-29-27" fill="#536f75" stroke="#b8cfcd" stroke-width="3"/><circle cx="82" cy="113" r="15" fill="#e9bf67"/><circle cx="82" cy="113" r="7" fill="#fff0b5"/><circle cx="24" cy="34" r="11" fill="#82bcc2"/><path d="m23 24-4 12h9l-4 9" fill="none" stroke="#eaf6dd" stroke-width="2"/>'),
        watcher: frame('<path d="m38 178 18-82 51-2 23 99Z" fill="#675376" stroke="#c5aacd" stroke-width="3"/><path d="m54 43 23-21 30 19-7 44-42-2Z" fill="#d3af90"/><path d="m53 39 4-12 48-1 8 21-13-6-36 2Z" fill="#292531"/><path d="m58 51 45-2-2 15-41 2Z" fill="#837093"/><path d="m53 107-27 31 12 13 37-31m26-18 20 20 25-26 6 11-24 38-38-22" fill="#a98baf"/><path d="m40 175 32-55 24 7 27 48" fill="#b39ac0"/><path d="m141 32-2 150" stroke="#d0b67d" stroke-width="6"/><circle cx="141" cy="32" r="12" fill="none" stroke="#d0b67d" stroke-width="5"/>'),
    }
    for (const [id, svg] of Object.entries(portraits)) scene.load.svg(`player:${id}`, `data:image/svg+xml;base64,${btoa(svg)}`)
}
