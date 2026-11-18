// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.
//
// Builds docs/diagrams/*.svg: checks each stripboard against its circuit first, and draws
// nothing if any board is wrong.
//
//     node docs/src/build.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { check, draw } from './stripboard.mjs';
import * as boards from './boards.mjs';
import * as schematics from './schematics.mjs';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'diagrams');
mkdirSync(out, { recursive: true });

const legends = {
    main: {
        legendWidth: 360,
        notes: [
            '24 cuts: make them first, and check each with a meter.',
            "The wire link in column M runs over that column's cuts.",
            'Resistors 1/4 W metal film; C1 25 V, other electrolytics 16 V.',
            'U1 in an 8-pin socket, its notch (pin 1) at the top.',
            'Electrolytics: + as marked. Diodes: the band as drawn.',
            'K1: check it before soldering. At rest pins 3-2 and 8-9',
            'conduct; 5 V on 1 (+) and 10 (-) clicks it, and then 3-4',
            'and 8-7 conduct instead. Pins 5 and 6 are not fitted.',
            'Q1: 2N3904 with its flat face to the right, as drawn. A BC547',
            'has its leads the other way round: turn it to match E, B, C.',
        ],
    },
    di: {
        legendWidth: 250,
        notes: [
            '5 cuts. U2 in an 8-pin socket, notch at the top.',
            'C11, C12: + towards the XLR. C10: + towards U2.',
            'Optional: leave the board out and nothing else changes.',
        ],
    },
    hub: {
        legendWidth: 380,
        notes: [
            '7 cuts, all in column K; the link in column K runs over them.',
            'P pads: short wires to the pins on the underside of the',
            "Pi's header, by physical pin number.",
            'Panel pads: fit pin headers and use plug-in leads, or',
            'solder the panel wires straight on.',
            'U3 in an 8-pin socket, its notch (pin 1) at the top.',
        ],
    },
};

let bad = 0;
for (const [name, board] of Object.entries(boards)) {
    const problems = check(board);
    if (problems.length) {
        console.error(`${name}: ${problems.length} problems`);
        for (const p of problems) console.error(`   ${p}`);
        bad += problems.length;
        continue;
    }
    writeFileSync(join(out, `board-${name}.svg`), draw({ ...board, ...legends[name] }));
    console.log(`board-${name}.svg   checked: every net joined, none touching`);
}
if (bad) process.exit(1);

for (const [name, make] of Object.entries(schematics)) {
    const file = name.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + '.svg';   // schematicMain -> schematic-main.svg
    writeFileSync(join(out, file), make());
    console.log(file);
}
