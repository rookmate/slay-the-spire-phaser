/** Original SVG artwork, kept as source so silhouettes and colors remain editable. */
export const ink = '#211d27'
export const bone = '#eee0b8'
export const metal = '#a9b6b0'
export const path = (d: string, fill: string, stroke = ink) => `<path d="${d}" fill="${fill}" stroke="${stroke}"/>`
export const circle = (x: number, y: number, r: number, fill: string) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`
export const ellipse = (x: number, y: number, rx: number, ry: number, fill: string) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`
export const eyes = (x = 64, y = 51, color = bone) => path(`m${x - 19} ${y - 4} 13 5-12 4m25-4 13-5-1 9Z`, color)
export const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="180" viewBox="0 0 128 144"><ellipse cx="64" cy="134" rx="43" ry="6" fill="#111016" opacity=".4"/><g stroke="${ink}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`
export const blade = (x: number, y: number, length = 58) => path(`m${x} ${y} 5-${length} 5 ${length}-5 9Z`, metal) + path(`m${x - 7} ${y + 6} 24 0m-12 0v19`, 'none', '#c6a35f')
export function robed(color: string, head: string, accessory = ''): string {
    return path('m47 64-17 66 69 0-15-65Z', color) + path('m46 72-30 25 13 9 26-23m28-11 22 24-12 10-18-24', color)
        + path('m55 84-9 39m27-39 10 38', 'none', '#cbb28d') + head + accessory
}
export function armored(color: string, helm: string, accessory = ''): string {
    return path('m40 113-4 17 20 2 8-24 9 24 21-2-7-17-5-48-36 0Z', color)
        + path('m40 64-20 12 3 18 20-8m44-22 20 12-3 18-19-8', color)
        + path('m47 69 17 10 18-10-2 38H49Z', '#c7b27d') + helm + accessory
}
