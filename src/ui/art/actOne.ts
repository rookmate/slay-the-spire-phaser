import { path, circle, ellipse, eyes, robed, blade, bone, metal } from './shapes'

function slime(acid: boolean, size: number): string {
    const color = acid ? '#88a95a' : '#7771a0'
    const spikes = acid ? circle(39, 84, 9, '#b8cf80') + circle(85, 108, 7, '#b8cf80')
        : path('m25 84-11-18 24 6m16-15 4-24 15 24m16 14 26-14-10 29', '#b1acc4')
    return `<g transform="translate(${64 * (1 - size)} ${130 * (1 - size)}) scale(${size})">`
        + spikes + path('M14 121Q20 97 29 83Q32 50 66 59Q103 56 105 95L119 119Q109 137 90 128Q65 139 42 128Q19 137 14 121Z', color)
        + eyes(64, 91) + path('m50 109q15 12 31-2', 'none') + '</g>'
}
function louse(color: string): string {
    return path('m28 85-13 20 20 2m11-12-5 26 21-6m34-24 17 15-13 6m-22-8 5 24 16-10', 'none', '#b4a26b')
        + ellipse(65, 74, 46, 35, color) + path('m50 43-8 56m29-57-5 64m23-52-1 42', 'none', '#d0bd88')
        + path('m26 68-9-22m14 26 3-28', 'none') + eyes(36, 76)
}
function gremlin(color: string, gear: string, belly = false): string {
    return path('m46 101-15 26 20 3 15-18 14 17 20-3-16-26', color)
        + ellipse(65, 87, belly ? 39 : 25, 29, color)
        + path('m40 44-21-11 14 28 17 5m32-22 26-11-12 28-15 5', color)
        + ellipse(65, 53, 26, 23, color) + eyes(65, 49) + path('m49 62 6 11 6-8 13 6 7-13', bone)
        + path('m41 80-18 11 2 16m64-28 16 12-5 20', 'none', color) + gear
}
export const ACT_ONE_ART = {
    CULTIST: robed('#66506c', path('m43 47 16-31 27 12 2 36-31 5Z', '#343243') + path('m46 40-25 17 29 8 17-18Z', bone) + circle(56, 39, 3, '#d2935c'), path('m102 51-9 78', 'none', '#88765a')),
    JAW_WORM: path('M23 120Q12 84 37 57Q56 32 88 49Q121 71 103 124Z', '#a26f43') + path('M26 95Q31 55 63 58Q98 64 101 98L86 116H40Z', '#342830') + path('m32 75 10 20 7-28 9 24 10-29 7 29 11-19 6 22M39 107l8-13 10 14 10-17 11 16 9-11', bone) + eyes(73, 50, '#d5c572'),
    RED_LOUSE: louse('#a65750'), GREEN_LOUSE: louse('#668851'),
    ACID_SLIME_S: slime(true, 0.62), ACID_SLIME_M: slime(true, 0.82), ACID_SLIME_L: slime(true, 1),
    SPIKE_SLIME_S: slime(false, 0.62), SPIKE_SLIME_M: slime(false, 0.82), SPIKE_SLIME_L: slime(false, 1),
    FUNGI_BEAST: path('m33 117-7 14h19l10-15 23 0 10 15h20l-8-26-55-21Z', '#918357') + ellipse(64, 96, 37, 27, '#a69b73') + path('M18 82Q25 26 68 35Q99 32 112 81Q67 103 18 82Z', '#a36469') + circle(45, 61, 10, '#e8c396') + circle(79, 51, 7, '#e8c396') + circle(92, 77, 8, '#e8c396') + eyes(63, 105),
    SNEAKY_GREMLIN: gremlin('#759169', blade(102, 86, 32)),
    MAD_GREMLIN: gremlin('#bb7a60', path('m23 84-9-25 18-5 12 25Z', '#77606a')),
    FAT_GREMLIN: gremlin('#9d8b5a', path('m49 84 27 0 5 20H44Z', '#695241'), true),
    SHIELD_GREMLIN: gremlin('#859064', path('m12 69 28-5 12 12-8 39-18 12-14-15Z', '#8b9a9a') + path('m23 80 15-4-3 34-11 6Z', '#c6b47e')),
    WIZARD_GREMLIN: gremlin('#9290a7', path('m35 39 31-33 30 35Z', '#654f7d') + path('m104 60-4 65', 'none', '#b69762') + circle(107, 49, 10, '#a8c8ac')),
    GREMLIN_NOB: path('m36 107-12 23h26l13-24 15 24h28l-16-28 1-33-10-10-32 0-17 21Z', '#b16c56') + ellipse(62, 67, 36, 38, '#ba785c') + path('m37 37-15-21 6 34m56-13 15-21-6 35', bone) + eyes(62, 43) + path('m45 58 7 13 8-8 12 8 9-15', bone) + path('m101 112-7-66 18-10 9 64Z', '#79664c'),
    LAGAVULIN: path('m31 102-17 23m29-17-7 21m49-23 10 23m4-32 17 25', 'none', '#a38d74') + path('M22 99Q11 42 51 26Q90 12 107 57L111 110 78 127 38 119Z', '#68666f') + path('m37 39 21 70m0-80 21 79m1-74 15 61M29 74l66-17M28 97l76-18', 'none', '#b1a69c') + eyes(66, 112, '#e0ad71'),
    SENTRY: path('m35 121 9-18-9-23 8-23-2-29 24-13 24 13-2 29 8 23-9 23 9 18Z', '#82928a') + path('m48 36 17-9 15 9-4 15-13 8-13-8Z', '#52675f') + circle(64, 78, 17, '#d5bd72') + circle(64, 78, 7, '#f8ecd0') + path('m50 116 12-12 15 12M45 64l-21 8m62-8 20 8', 'none', '#c0c8b0'),
    SLIME_BOSS: slime(true, 1) + path('m33 64 5-13 53 0 9 13Z', '#24272b') + path('m46 51-2-28 39-2 5 30Z', '#41434a') + path('m47 43 39-2', 'none', '#b66855'),
    HEXAGHOST: path('M64 19 101 40 107 87 65 123 19 87 24 40Z', '#394a4b') + path('m64 34 25 16v34L64 107 39 84V50Z', '#789d82') + circle(64, 69, 19, '#dce5ae') + path('m53 64 8 8-9 7m23-15-8 8 9 7', 'none') + [0, 1, 2, 3, 4, 5].map(i => `<g transform="rotate(${i * 60} 64 69)">${path('M55 13q-5-17 9-10 14-7 9 10l-9 12Z', '#b9d79b')}</g>`).join(''),
    THE_GUARDIAN: path('m29 97-19 31 25 0 18-27m28-4 16 31 24-2-13-30', '#86928e') + path('M19 82 35 35 64 23 95 37 111 82 94 106 37 106Z', '#5f7473') + path('m35 38 27 14 32-13-13 39H45Z', '#c1b587') + path('m31 84 19-12 27 0 20 12-14 24H45Z', '#8c9b88') + circle(64, 90, 12, '#d8a363') + circle(64, 90, 5, '#f7e5a4') + path('m61 28 0 21m-40 33 23 5m40 0 24-4', 'none', metal),
}
