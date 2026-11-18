// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.
//
// The pedal's three stripboards. Each pin says which net it is meant to be on; the checks in
// stripboard.mjs hold the layout to that.

// a part's pin: [column, row, net, name]
const R = (ref, value, a, b, min = 3) => ({ ref, value, type: 'R', min, pins: [a, b] });
const C = (ref, value, a, b, min = 1) => ({ ref, value, type: 'C', min, pins: [a, b] });   // a ceramic fits 1; a film 5 mm box, 2
const E = (ref, value, plus, minus) => ({ ref, value, type: 'E', min: 1, pins: [plus, minus] });
const D = (ref, value, anode, cathode, min = 4, fill) => ({ ref, value, type: 'D', min, fill, pins: [anode, cathode] });
const pad = (tag, label, c, r, net, side) => ({ tag, label, c, r, net, side });

//============================================================================== the main board
//
// Power in, the bypass relay and its driver, the input buffer, and the Codec Zero's output
// back to the relay.
//
export const main = {
    title: 'MAIN BOARD - power, bypass relay, input buffer (30 x 22 holes)',
    cols: 30, rows: 22,
    cuts: [
        [4, 3], [13, 3],
        [13, 4],
        [4, 5], [13, 5], [23, 5],
        [4, 6], [21, 6],
        [21, 7],
        [13, 8],
        [13, 9],
        [13, 10], [21, 10],
        [13, 11],
        [13, 12], [21, 12],
        [13, 13], [23, 13],
        [23, 14],
        [13, 15], [23, 15],
        [23, 16],
        [23, 17],
        [21, 20],
    ],
    links: [
        [2, 3, 2, 8],      // V5: the relay's coil to the V5 strip
        [12, 3, 12, 9],    // COLL down to the transistor
        [3, 11, 3, 22],    // GND
        [13, 2, 13, 22],   // GND: top rail to bottom rail
        [15, 17, 15, 22],  // GND to the buffer's strip
        [1, 6, 1, 20],     // FX IN down to the buffer
        [30, 1, 30, 15],   // V9 to the op-amp
        [20, 15, 20, 19],  // the buffer's output to its - input
        [27, 16, 27, 19],
    ],
    parts: [
        // the relay: TQ2-5V, pins 1-5 down the left, 10-6 up the right (5 and 6 not fitted)
        { ref: 'K1', value: 'TQ2-5V', type: 'K', pins: [
            [3, 3, 'V5', '1'], [3, 4, 'BYP', '2'], [3, 5, 'INJ', '3'], [3, 6, 'FXIN', '4'],
            [6, 3, 'COLL', '10'], [6, 4, 'BYP', '9'], [6, 5, 'OUTJ', '8'], [6, 6, 'FXOUT', '7'],
        ] },
        E('C3', '47u 25V', [1, 3, 'V5'], [1, 2, 'GND']),
        D('D2', '1N4148', [11, 3, 'COLL'], [11, 8, 'V5']),
        { ref: 'Q1', value: '2N3904', type: 'Q', pins: [[7, 11, 'GND', 'E'], [7, 10, 'BASE', 'B'], [7, 9, 'COLL', 'C']] },
        { ...R('R18', '1k', [9, 15, 'RLY'], [9, 10, 'BASE']), labelLeft: true },
        R('R20', '10k', [10, 15, 'RLY'], [10, 11, 'GND']),
        R('R19', '1k', [5, 8, 'V5'], [5, 13, 'LEDA']),

        // the Codec Zero's output, back to the relay
        R('R11', '100k', [14, 6, 'FXOUT'], [14, 2, 'GND']),
        R('R10', '470R', [16, 6, 'FXOUT'], [16, 10, 'OC']),
        E('C8', '10u 25V', [15, 12, 'AUXOUT'], [15, 10, 'OC']),

        // power
        D('D1', '1N5817', [27, 5, 'IN9'], [27, 1, 'V9'], 4, '#333'),
        E('C1', '100u 25V', [25, 1, 'V9'], [25, 2, 'GND']),
        C('C2', '100n 50V', [26, 1, 'V9'], [26, 2, 'GND']),
        R('R1', '10k', [26, 15, 'V9'], [26, 21, 'VREF']),
        R('R2', '10k', [21, 21, 'VREF'], [21, 17, 'GND']),
        E('C4', '47u 25V', [28, 21, 'VREF'], [28, 22, 'GND']),

        // the input buffer: TL071, pins 1-4 down the left, 8-5 up the right
        { ref: 'U1', value: 'TL071', type: 'IC', pins: [
            [22, 14, 'NUL1', '1'], [22, 15, 'OPO', '2'], [22, 16, 'OPP', '3'], [22, 17, 'GND', '4'],
            [25, 14, 'NC8', '8'], [25, 15, 'V9', '7'], [25, 16, 'OPO', '6'], [25, 17, 'NUL5', '5'],
        ] },
        R('R4', '2M2', [16, 20, 'FXIN'], [16, 17, 'GND']),
        { ...C('C6', '100n film 63V', [18, 20, 'FXIN'], [18, 16, 'OPP'], 2), labelLeft: true },
        R('R5', '2M2', [19, 16, 'OPP'], [19, 21, 'VREF']),
        E('C7', '10u 25V', [28, 16, 'OPO'], [28, 13, 'OPOC']),
        R('R8', '1k', [27, 13, 'OPOC'], [27, 10, 'AUXIN']),
        R('R9', '1k', [25, 10, 'AUXIN'], [25, 7, 'S1T']),
    ],
    pads: [
        pad('J1+', 'DC jack: +9 V (its sleeve)', 25, 5, 'IN9'), pad('J1-', 'DC jack: 0 V (its centre pin)', 21, 2, 'GND'),
        pad('J2a', 'buck converter VIN', 23, 1, 'V9'), pad('J2b', 'buck converter GND', 22, 2, 'GND'),
        pad('J2c', 'buck converter 5V out', 3, 8, 'V5'),
        pad('J3', 'INPUT jack tip', 1, 5, 'INJ'), pad('J3s', 'INPUT jack sleeve', 2, 2, 'GND'),
        pad('J4', 'OUTPUT jack tip', 9, 5, 'OUTJ'), pad('J4s', 'OUTPUT jack sleeve', 9, 2, 'GND'),
        pad('J5', 'Codec Zero AUX IN, L and R together', 29, 10, 'AUXIN'), pad('J5g', 'Codec Zero AUX IN GND', 29, 22, 'GND'),
        pad('J6', 'Codec Zero AUX OUT L', 19, 12, 'AUXOUT'), pad('J6g', 'Codec Zero AUX OUT GND', 19, 2, 'GND'),
        pad('J7', 'INST/LINE toggle', 29, 7, 'S1T'), pad('J7g', 'INST/LINE toggle, other side', 28, 2, 'GND'),
        pad('J8', 'hub: RELAY', 6, 15, 'RLY'), pad('J8g', 'hub: GND', 6, 11, 'GND'),
        pad('J9+', 'ON LED anode (long lead)', 2, 13, 'LEDA'), pad('J9-', 'ON LED cathode', 4, 9, 'COLL'),
        pad('J10a', 'DI board: OUT line', 8, 5, 'OUTJ'), pad('J10b', 'DI board: 9V', 20, 1, 'V9'), pad('J10c', 'DI board: GND', 20, 2, 'GND'),
    ],
};

//============================================================================== the DI board
//
// Optional. Its own buffer on the OUTPUT jack's line, so it never loads the guitar, then the
// pad and the impedance-balanced XLR legs, with 100 V capacitors against phantom power.
//
export const di = {
    title: 'DI BOARD (optional) - balanced XLR out (20 x 23 holes)',
    cols: 20, rows: 23,
    cuts: [[9, 5], [9, 6], [9, 7], [9, 8], [9, 10]],
    links: [
        [20, 1, 20, 6],    // V9 to the op-amp
        [2, 2, 2, 8],      // GND to the op-amp
        [3, 2, 3, 12],     // GND, top rail to the middle one
        [1, 12, 1, 23],    // GND, middle rail to the bottom one
        [7, 6, 7, 9],      // the op-amp's output to its - input
        [13, 7, 13, 9],
    ],
    parts: [
        { ref: 'U2', value: 'TL071', type: 'IC', pins: [
            [8, 5, 'NUL1', '1'], [8, 6, 'DIO', '2'], [8, 7, 'DIP', '3'], [8, 8, 'GND', '4'],
            [11, 5, 'NC8', '8'], [11, 6, 'V9', '7'], [11, 7, 'DIO', '6'], [11, 8, 'NUL5', '5'],
        ] },
        C('C22', '100n 50V', [10, 1, 'V9'], [10, 2, 'GND']),
        C('C9', '100n film 63V', [5, 4, 'OUTJ'], [5, 7, 'DIP'], 2),
        R('R12', '1M', [4, 7, 'DIP'], [4, 11, 'VREF2']),
        R('R21', '10k', [16, 6, 'V9'], [16, 11, 'VREF2']),
        R('R22', '10k', [6, 11, 'VREF2'], [6, 8, 'GND']),
        E('C21', '47u 25V', [18, 11, 'VREF2'], [18, 12, 'GND']),
        E('C10', '22u 25V', [15, 9, 'DIO'], [15, 10, 'DIC']),
        R('R14', '10k', [12, 10, 'DIC'], [12, 13, 'DIM']),
        R('R15', '1k1', [5, 13, 'DIM'], [5, 8, 'GND']),
        R('R16', '100R', [14, 13, 'DIM'], [14, 16, 'X2N']),
        E('C11', '10u 100V', [16, 17, 'XLR2'], [16, 16, 'X2N']),
        E('C12', '10u 100V', [16, 19, 'XLR3'], [16, 20, 'X3N']),
        R('R17', '100R', [14, 20, 'X3N'], [14, 23, 'GND']),
    ],
    pads: [
        pad('J10a', 'main board J10a: the OUT line', 1, 4, 'OUTJ'),
        pad('J10b', 'main board J10b: 9V', 1, 1, 'V9'), pad('J10c', 'main board J10c: GND', 4, 2, 'GND'),
        pad('J11a', 'PAD toggle', 20, 10, 'DIC'), pad('J11b', 'PAD toggle, other side', 20, 13, 'DIM'),
        pad('J12a', 'XLR pin 2 (hot)', 20, 17, 'XLR2'), pad('J12b', 'XLR pin 3 (cold)', 20, 19, 'XLR3'),
        pad('J12c', 'LIFT toggle; its other side to XLR pin 1', 20, 23, 'GND'),
    ],
};

//============================================================================== the control hub
//
// Where the Pi's pins meet the panel: a strip for each, the Pi's wire at the left and the
// panel's at the right. And the MIDI input: a 6N138 opto-isolator, as the MIDI spec has it,
// powered from 5 V, its output pulled up to the Pi's 3.3 V.
//
export const hub = {
    title: 'CONTROL HUB - the Pi to the panel, and MIDI IN (24 x 20 holes)',
    cols: 24, rows: 20,
    cuts: [
        [11, 12], [11, 14], [11, 15], [11, 16], [11, 17], [11, 18], [11, 19],
    ],
    links: [
        [9, 12, 9, 16],    // the opto's LED anode, up to the diode's strip
        [15, 13, 15, 15],  // 5 V to the opto
        [23, 2, 23, 14],   // 3.3 V down to the pull-up
        [22, 18, 22, 20],  // the opto's ground
        [11, 1, 11, 20],   // GND, top to bottom
    ],
    parts: [
        { ref: 'U3', value: '6N138', type: 'IC', pins: [
            [10, 15, 'NCA', '1'], [10, 16, 'OPTA', '2'], [10, 17, 'OPTK', '3'], [10, 18, 'NCB', '4'],
            [13, 15, 'V5', '8'], [13, 16, 'OBASE', '7'], [13, 17, 'MIDIRX', '6'], [13, 18, 'GND', '5'],
        ] },
        R('R31', '220R', [6, 19, 'DIN4'], [6, 16, 'OPTA']),
        D('D3', '1N4148', [4, 17, 'OPTK'], [4, 12, 'OPTA']),
        R('R32', '470R', [18, 17, 'MIDIRX'], [18, 14, 'V33']),
        R('R33', '10k', [20, 16, 'OBASE'], [20, 20, 'GND']),
        C('C31', '100n 50V', [16, 15, 'V5'], [16, 18, 'GND']),
        R('R34', '470R', [8, 11, 'TEMPO'], [8, 14, 'LEDT']),
    ],
    pads: [
        // the Pi's side: wires to the pins on the underside of its header
        pad('P6', 'Pi pin 6: GND', 1, 1, 'GND'),
        pad('P1', 'Pi pin 1: 3.3 V', 1, 2, 'V33'),
        pad('P3', 'Pi pin 3: SDA (BCM 2)', 1, 3, 'SDA'),
        pad('P5', 'Pi pin 5: SCL (BCM 3)', 1, 4, 'SCL'),
        pad('P29', 'Pi pin 29: BCM 5', 1, 5, 'ENCA'),
        pad('P31', 'Pi pin 31: BCM 6', 1, 6, 'ENCB'),
        pad('P11', 'Pi pin 11: BCM 17', 1, 7, 'ENCSW'),
        pad('P36', 'Pi pin 36: BCM 16', 1, 8, 'TAP'),
        pad('P37', 'Pi pin 37: BCM 26', 1, 9, 'ON'),
        pad('P22', 'Pi pin 22: BCM 25', 1, 10, 'RLY'),
        pad('P32', 'Pi pin 32: BCM 12', 1, 11, 'TEMPO'),
        pad('P2', 'Pi pin 2: 5 V', 1, 13, 'V5'),
        pad('P10', 'Pi pin 10: RXD (BCM 15)', 24, 17, 'MIDIRX'),
        // the panel's side
        pad('Q-', 'I2C cable: GND (black)', 24, 1, 'GND'),
        pad('Q+', 'I2C cable: 3.3 V (red)', 24, 2, 'V33'),
        pad('QD', 'I2C cable: SDA (blue)', 24, 3, 'SDA'),
        pad('QC', 'I2C cable: SCL (yellow)', 24, 4, 'SCL'),
        pad('EA', 'encoder A', 22, 5, 'ENCA'), pad('EB', 'encoder B', 22, 6, 'ENCB'), pad('ES', 'encoder push switch', 22, 7, 'ENCSW'),
        pad('T', 'TAP footswitch', 22, 8, 'TAP'), pad('O', 'ON footswitch', 22, 9, 'ON'),
        pad('RL', 'main board J8: RELAY', 22, 10, 'RLY'),
        pad('EC', 'encoder C (middle pin)', 13, 1, 'GND'), pad('ES-', 'encoder push switch, other pin', 15, 1, 'GND'),
        pad('T-', 'TAP footswitch, other side', 17, 1, 'GND'), pad('O-', 'ON footswitch, other side', 19, 1, 'GND'),
        pad('L-', 'TEMPO LED cathode', 21, 1, 'GND'), pad('RG', 'main board J8g: GND', 9, 1, 'GND'),
        pad('L+', 'TEMPO LED anode (long lead)', 2, 14, 'LEDT'),
        pad('M4', 'MIDI DIN socket pin 4', 1, 19, 'DIN4'),
        pad('M5', 'MIDI DIN socket pin 5', 1, 17, 'OPTK'),
    ],
};
