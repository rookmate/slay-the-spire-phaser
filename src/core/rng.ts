import seedrandom from 'seedrandom'

export class RNG {
    private prng: seedrandom.PRNG
    readonly seed: string

    constructor(seed: string) {
        this.seed = seed
        this.prng = seedrandom(seed)
    }

    random(): number {
        return this.prng.quick()
    }

    int(minInclusive: number, maxInclusive: number): number {
        const r = this.random()
        return Math.floor(r * (maxInclusive - minInclusive + 1)) + minInclusive
    }

    shuffleInPlace<T>(arr: T[]): void {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1))
            const tmp = arr[i]
            arr[i] = arr[j]
            arr[j] = tmp
        }
    }
}


