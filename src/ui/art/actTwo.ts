import { path, circle, ellipse, eyes, robed, armored, blade, bone, metal } from './shapes'
const face = (color: string, mask = false) => ellipse(64, 45, 21, 25, color) + eyes(64, 42) + (mask ? path('m45 48 38 0-7 23H52Z', '#38313b') : path('m53 60 22 0', 'none'))
const bandit = (color: string, gear: string, mask = true) => armored(color, face('#b7987a', mask), gear)
const slaver = (red: boolean) => bandit(red ? '#a65e53' : '#668d9a', path('m44 28 17-13 25 15-2 10-40-2Z', red ? '#b66a5c' : '#7299a8') + (red ? blade(105, 86) : path('M17 83q-13-42 0-44 22-1 10 36-7 21-13 44', 'none', '#c3ab75')))
const shell = (color: string) => path('m20 105 4-23 26-21 35 1 25 23-3 29-22 10-52-1Z', color) + path('m26 97 15-31 23 44 21-45 18 32m-63 27 24-14 20 16', 'none', '#d1be97')
export const ACT_TWO_ART = {
    POINTY: bandit('#647479', blade(14, 91, 43) + blade(105, 91, 43)),
    ROMEO: bandit('#a45755', path('m45 29 12-17 23 8 10 18-30-8Z', '#382c38') + blade(108, 87)),
    BEAR: armored('#785b4c', face('#ab8365') + path('m40 57 19 22 25-7 6-24-14 12-21 1Z', '#443b37'), path('m12 69 28 1 4 40-28 8Z', '#b0a99a') + path('m91 81 14 27 13-25', 'none', '#b28f67')),
    LOOTER: bandit('#65516c', path('m40 39 10-22 32 1 9 29-15-10-23 5Z', '#7e6881') + path('m95 98 14-9 13 23-4 18-26-3Z', '#aa9257')),
    MUGGER: bandit('#685640', path('m43 29 4-16h35l7 24-16-2-7-12-13 14Z', '#463c36') + path('m14 95-5-29 13-9 13 29Z', '#a38d61')),
    SLAVER_RED: slaver(true), RED_SLAVER: slaver(true), SLAVER_BLUE: slaver(false), BLUE_SLAVER: slaver(false),
    SNECKO: path('M18 129q-16-32 28-49l18-21q-7-12-23-7L27 38 41 21 73 18 95 35 91 54 77 72Q52 88 55 104q17 7 31-11l19 7-5 27Z', '#85a573') + ellipse(83, 38, 13, 15, '#d6c86e') + circle(84, 38, 5, '#492e51') + path('m48 94 21 3m-27 9 25 7M35 44l-14 5', 'none', '#ced299'),
    CHOSEN: robed('#4c676c', path('m41 51 8-27 14-15 19 14 7 36-26-11Z', '#547982') + path('m51 43 24-1-11 26Z', bone) + circle(64, 46, 4, '#d99860'), path('m107 39-10 91', 'none', '#c1a066') + circle(108, 30, 13, '#aa815c')),
    BYRD: path('M66 110 31 89 8 50l40 15-6-36 30 25 23-24-3 33 26-9-17 37Z', '#58666d') + ellipse(66, 81, 21, 33, '#839298') + path('m49 48 18-26 24 27-25 21Z', '#3d4754') + path('m77 45 22 11-24 5Z', '#c1a76b') + circle(70, 42, 4, '#d3b783') + path('m59 112-4 18-11 1m25-19 6 18 13 0', 'none', '#b9a275'),
    SPHERIC_GUARDIAN: circle(65, 75, 44, '#827b58') + path('m24 74h82M37 42q57 41 0 67m44-70q-57 41 0 67', 'none', '#d4b578') + circle(65, 75, 18, '#46585c') + circle(65, 75, 8, '#b4d3bc') + path('m38 121-13 10m53-9 17 10', 'none', metal),
    SHELLED_PARASITE: path('m29 100-13 27 19-10 12-7m33-3 13 18 18 3-11-26', '#9f8b6b') + shell('#ad876a') + path('m43 72 1-40 23-19 20 22-9 44Z', '#8b6a56') + eyes(63, 44) + path('m54 55 9 11 12-12', bone),
    SNAKE_PLANT: path('m20 133q5-44 35-61L40 41l16-21 19 4 16 23-13 25q34 24 32 58Z', '#54765c') + path('m58 27 11 8 17-3-8 27-21 4-12-17Z', '#a27968') + path('m50 37 8 8 4-10 8 12 8-10', bone) + path('m45 96-30-16 10 38m58-23 30-10-5 35m-45-42v48', 'none', '#a8b879'),
    CENTURION: armored('#796957', path('m39 59 7-31 18-12 25 19-2 36-24-13Z', '#a49579') + path('m61 29 21 1-4 28-12-2Z', '#45414a') + path('m46 25 2-13 39-2 4 20', '#a9574b'), path('m11 67 27-8 13 17-8 46-25 4-8-16Z', '#ad8e57') + blade(104, 92, 66)),
    MYSTIC: robed('#747b96', face('#c5b098') + path('m42 31 14-19 22 3 15 25-21-10-21 8Z', '#c4bfc0'), path('m20 103-3-44', 'none', '#ac9366') + circle(18, 47, 12, '#b6d5c2') + path('m70 83 19 30-31 5Z', '#ccc7b0')),
    BOOK_OF_STABBING: path('m19 42 40-11 7 15 42-4-5 68-39 9-11-10-34 9Z', '#925759') + path('m24 36 36-7 6 8 34-3-4 66-29 5-10-9-32 7Z', '#e5d3ab') + path('m60 35 2 66M33 51l17-4m-17 13 17-4m23-3 15-2m-16 14 17-2', 'none', '#a98f79') + blade(96, 93, 54) + path('m42 121-3 13m33-19 13 12', 'none', '#694352'),
    GREMLIN_MINION: bandit('#809467', path('m43 31-17-12 14 28m42-13 19-14-10 31', '#809467') + blade(104, 100, 24)),
    GREMLIN_LEADER: armored('#8d7959', face('#9caa73') + path('m44 27-9-16 23 8 18-12 8 25', '#c9ae68'), path('m14 114 10-66 17 2-6 66Z', '#ae9b68') + path('m96 68 21-24', 'none', metal)),
    TASKMASTER: bandit('#484448', path('m43 25 42 0 7 12-53 1Z', '#6f534c') + path('M104 99q20-28 7-53-11-15-4-30M16 97q-16-17-8-34', 'none', '#c2a376')),
    TORCH_HEAD: robed('#665744', path('m47 56 9-19 1-28 17 24 15-15-1 34-22 20Z', '#da9558') + path('m57 58 9-25 11 26-13 8Z', '#f6d18d'), path('m30 111 68 0', 'none', '#b99c61')),
    THE_COLLECTOR: robed('#446a60', path('m37 56 17-24 30-2 9 35-24 14Z', '#9c8861') + eyes(65, 49, '#caddae') + path('m40 40-12-25 24 13m31 5 18-19-7 33', '#7b694a'), path('m107 30-6 98', 'none', '#bc9360') + path('m96 27 11-17 12 16-12 13Z', '#a9c991') + path('m42 92 26 12 18-15', 'none', '#a4af87')),
    THE_CHAMP: armored('#617280', path('m39 63 4-33 40-6 14 25-14 26-24-7Z', '#b4b8ad') + eyes(68, 47, '#4a4f52') + path('m42 30-4-21 16 9 11-14 11 13 15-9-6 24Z', '#d3b475'), blade(106, 105, 92) + path('m10 75 26-5 8 17-5 31-25 7-7-27Z', '#826571')),
    BRONZE_ORB: circle(64, 73, 35, '#b78d58') + circle(64, 73, 24, '#6b6255') + circle(64, 73, 12, '#d6debd') + path('m64 31v-17m-41 60H9m98 0h13M45 109l-9 19m47-19 9 19', 'none', '#bda270'),
    BRONZE_AUTOMATON: armored('#b28f60', path('m43 29 22-15 23 18-6 28-37-1Z', '#c8ac75') + circle(65, 40, 10, '#d4e1c1'), path('m43 74 21-15 22 15-5 29H49Z', '#686e66') + circle(65, 82, 12, '#d7ddae') + path('m15 81-4 24 20 5 3-24m69-5 12 24-20 5-3-24', '#d2b075')),
}
