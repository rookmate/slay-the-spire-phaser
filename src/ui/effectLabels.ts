/** Keep the battlefield summary on one line; hover labels contain every effect. */
export function summarizeEffects(labels: string[], maxCharacters: number): string {
    if (labels.join('  ').length <= maxCharacters) return labels.join('  ')
    if (labels.length === 1) return `${labels[0].slice(0, maxCharacters - 1)}…`
    for (let count = labels.length - 1; count > 0; count--) {
        const summary = `${labels.slice(0, count).join('  ')} +${labels.length - count}`
        if (summary.length <= maxCharacters) return summary
    }
    return `${labels[0].slice(0, maxCharacters - 4)}… +${labels.length - 1}`
}
