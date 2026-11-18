// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.
//
// The pedal's schematics and its wiring overview. The part references match the stripboard
// layouts in boards.mjs. A blue name is a net: the same name elsewhere is the same wire.

import { Sheet } from './sheet.mjs';

//============================================================================== the main board

export function schematicMain() {
    const s = new Sheet(1020, 740, 'MAIN BOARD - power, true bypass, the input buffer, the Codec Zero\'s output',
        'Part numbers match board-main.svg. A blue name is a net: the same name elsewhere - here, on another sheet, or a board\'s pad - is the same wire.');

    // ---- power
    s.frame(14, 52, 560, 176, 'Power');
    const dc = s.jack(130, 110, '9V DC IN');
    s.text(64, 136, '(centre −)', { size: 8, fill: '#555' });
    s.wire(dc.tip, [180, 110]);
    s.wire(dc.sleeve, [170, 124], [170, 170]).gnd(170, 170);
    s.diode(180, 110, 240, 110, 'D1', '1N5817');
    s.wire([240, 110], [470, 110]).dot(270, 110).dot(310, 110).dot(380, 110);
    s.rail(470, 110, '+9V');
    s.cap(270, 110, 270, 170, 'C1', '100u 25V', true, true).gnd(270, 170);
    s.cap(310, 110, 310, 170, 'C2', '100n 50V').gnd(310, 170);
    const buck = s.box(370, 128, 120, 70, '9V→5V buck', 'Pololu D24V22F5', [['left', 'VIN', 22], ['left', 'GND', 50], ['right', '5V', 22]]);
    s.wire([380, 110], [380, 120], [355, 120], [355, 150], buck.VIN);
    s.wire(buck.GND, [355, 178], [355, 186]).gnd(355, 186);
    s.wire(buck['5V'], [530, 150]).rail(530, 150, '+5V');
    s.note(498, 168, ['to the Pi\'s', 'PWR port', '(micro-USB)'], 8);
    s.note(24, 204, ['Centre negative, as every pedal: use a plastic-bodied', 'DC jack, or its +9 V sleeve touches the metal box.'], 8);

    // ---- Vref
    s.frame(584, 52, 220, 176, 'Half-supply reference');
    s.rail(640, 100, '+9V');
    s.res(640, 100, 640, 150, 'R1', '10k');
    s.wire([640, 150], [720, 150]).dot(640, 150).dot(690, 150);
    s.res(640, 150, 640, 200, 'R2', '10k').gnd(640, 200);
    s.cap(690, 150, 690, 200, 'C4', '47u 25V', true).gnd(690, 200);
    s.net(720, 150, 'VREF (4.5 V)');

    // ---- bypass, buffer, Codec Zero
    s.frame(14, 240, 992, 252, 'True bypass, the input buffer, and the Codec Zero');
    const inp = s.jack(80, 330, 'INPUT');
    s.wire(inp.sleeve, [120, 344], [120, 356]).gnd(120, 356);
    const ka = s.spdt(140, 330, 'K1a');
    s.wire(inp.tip, ka.com);
    const kb = s.spdt(880, 330, 'K1b', true);
    const out = s.jack(950, 330, 'OUTPUT', true);
    s.wire(out.tip, kb.com).dot(900, 330);
    s.wire(out.sleeve, [930, 344], [930, 356]).gnd(930, 356);
    s.wire(ka.nc, [174, 280], [846, 280], kb.nc);
    s.text(510, 274, 'bypass: the relay at rest - the guitar straight from INPUT to OUTPUT', { size: 8.5, anchor: 'middle', fill: '#555', italic: true });
    s.wire([900, 330], [900, 470]).net(900, 470, 'OUTJ → DI board', 'end');

    // FX: through the buffer
    s.wire(ka.no, [210, 341]).dot(210, 341);
    s.res(210, 341, 210, 410, 'R4', '2M2', true).gnd(210, 410);
    s.cap(210, 341, 270, 341, 'C6', '100n film 63V');
    s.wire([270, 341], [310, 341]).dot(290, 341);
    s.res(290, 341, 290, 405, 'R5', '2M2', true);
    s.wire([290, 405], [290, 415]).net(290, 418, 'VREF');
    const u1 = s.opamp(310, 328, 'U1', 'TL071  (7: +9V, 4: GND)');
    s.wire(u1.out, [380, 328]).dot(380, 328);
    s.wire([380, 328], [380, 300], [300, 300], [300, 315], u1.minus);
    s.cap(380, 328, 430, 328, 'C7', '10u 25V', true);
    s.res(430, 328, 490, 328, 'R8', '1k');
    s.wire([490, 328], [550, 328]).dot(510, 328);
    s.res(510, 328, 510, 385, 'R9', '1k', true);
    s.sw(510, 385, 510, 435, 'S1', 'INST/LINE', true).gnd(510, 435);
    const cz = s.box(550, 290, 160, 110, 'Codec Zero', 'on the Pi\'s header',
        [['left', 'AUX IN L+R', 38], ['left', '~gl', 80], ['right', 'AUX OUT L', 38], ['right', '~gr', 80]], '#eef6ee');
    s.text(556, 373, 'GND', { size: 8 }).text(704, 373, 'GND', { size: 8, anchor: 'end' });
    s.wire(cz['~gl'], [535, 370], [535, 380]).gnd(535, 380);
    s.wire(cz['~gr'], [725, 370], [725, 380]).gnd(725, 380);
    s.cap(710, 328, 760, 328, 'C8', '10u 25V', true);
    s.res(760, 328, 820, 328, 'R10', '470R');
    s.wire([820, 328], [840, 328], [840, 341], kb.no).dot(830, 328);
    s.res(830, 328, 830, 400, 'R11', '100k', true).gnd(830, 400);
    s.note(560, 420, ['INST (open): about 1 MΩ, unity gain - guitar and bass, passive or active.',
                      'LINE (closed): 6 dB quieter into the Codec Zero - synths, drum machines, keyboards.',
                      'The Codec Zero\'s own AUX IN gain (alsamixer) sets the level from there.'], 8);

    // ---- the relay driver
    s.frame(14, 502, 992, 224, 'The relay, driven by the Pi');
    s.rail(100, 545, '+5V');
    s.wire([100, 545], [100, 565]);
    s.add('<rect x="90" y="565" width="20" height="40" fill="#fff" stroke="#000" stroke-width="1.2"/>');
    s.text(116, 574, '1 (+)', { size: 7.5 }).text(116, 588, 'K1 coil', { size: 8.5, weight: 'bold' }).text(116, 602, '10 (−)', { size: 7.5 });
    s.wire([100, 605], [100, 625]);
    s.wire([50, 555], [160, 555]).dot(100, 555);
    s.cap(50, 555, 50, 625, 'C3', '47u 25V', true).gnd(50, 625);
    s.diode(160, 625, 160, 555, 'D2', '1N4148');
    s.wire([100, 625], [320, 625]).dot(100, 625).dot(160, 625).dot(260, 625);
    s.rail(260, 545, '+5V');
    s.res(260, 545, 260, 585, 'R19', '1k');
    s.diode(260, 585, 260, 625, 'ON', 'LED', true);
    const q1 = s.npn(312, 649, 'Q1', '2N3904');
    s.gnd(q1.e[0], q1.e[1]);
    s.res(210, 649, 290, 649, 'R18', '1k');
    s.wire([70, 649], [210, 649]).dot(190, 649);
    s.net(70, 640, 'RLY ← hub (Pi BCM 25)');
    s.res(190, 649, 190, 700, 'R20', '10k', true).gnd(190, 700);
    s.note(420, 540, ['The Pi switches the effect in by driving BCM 25 high: Q1 energises K1,',
        'which moves both contacts from NC to NO - the guitar through the buffer,',
        'the Codec Zero and back out - and the ON LED lights.',
        '',
        'BCM 25 rests low while the Pi boots, and R20 holds it low besides, so the',
        'pedal is bypassed until the program is running, and if it ever stops.',
        '',
        'The ON LED is lit by the relay\'s own current, so it always shows what the',
        'relay is really doing. D2 takes the coil\'s kick when it lets go.'], 8.5);
    return s.done();
}

//============================================================================== the DI board

export function schematicDi() {
    const s = new Sheet(1000, 420, 'DI BOARD (optional) - a balanced XLR out, for a desk or an audio interface',
        'Fed from the OUTPUT jack\'s line, after the relay: it carries what the amp gets, effect or bypass. Part numbers match board-di.svg.');
    s.net(80, 140, 'OUTJ (main J10a)', 'end');
    s.wire([80, 140], [100, 140]);
    s.cap(100, 140, 160, 140, 'C9', '100n film 63V');
    s.wire([160, 140], [200, 140]).dot(180, 140);
    s.res(180, 140, 180, 205, 'R12', '1M', true);
    s.wire([180, 205], [180, 215]).net(180, 218, 'VREF2');
    const u2 = s.opamp(200, 127, 'U2', 'TL071  (7: +9V, 4: GND)');
    s.wire([200, 140], u2.plus);
    s.wire(u2.out, [270, 127]).dot(270, 127);
    s.wire([270, 127], [270, 95], [190, 95], [190, 114], u2.minus);
    s.cap(270, 127, 330, 127, 'C10', '22u 25V', true);
    s.wire([330, 127], [360, 127]).dot(345, 127);
    s.res(360, 127, 430, 127, 'R14', '10k');
    s.wire([345, 127], [345, 80], [370, 80]);
    s.sw(370, 80, 420, 80, 'S2 PAD', '');
    s.wire([420, 80], [445, 80], [445, 127]);
    s.wire([430, 127], [480, 127]).dot(445, 127).dot(460, 127);
    s.res(460, 127, 460, 190, 'R15', '1k1').gnd(460, 190);
    s.res(480, 127, 540, 127, 'R16', '100R');
    s.cap(570, 127, 540, 127, 'C11', '10u 100V', true);
    s.wire([570, 127], [663, 127], [663, 136]);
    s.text(615, 121, 'hot', { size: 8, fill: '#555', anchor: 'middle' });
    // the XLR
    s.add('<circle cx="690" cy="155" r="38" fill="#f5f5f5" stroke="#000" stroke-width="1.3"/>');
    s.text(690, 108, 'XLR (male, panel)', { size: 9, weight: 'bold', anchor: 'middle' });
    for (const [n, x, y] of [['2', 668, 140], ['3', 712, 140], ['1', 690, 178]]) {
        s.add(`<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="#000"/>`);
        s.text(x, y + 3, n, { size: 7, anchor: 'middle' });
    }
    s.wire([717, 140], [745, 140], [745, 230], [570, 230]);
    s.text(615, 224, 'cold', { size: 8, fill: '#555', anchor: 'middle' });
    s.cap(570, 230, 540, 230, 'C12', '10u 100V', true);
    s.res(540, 230, 480, 230, 'R17', '100R');
    s.wire([480, 230], [470, 230], [470, 242]).gnd(470, 242);
    s.wire([690, 183], [690, 290], [650, 290]);
    s.sw(650, 290, 600, 290, 'S3', 'LIFT');
    s.wire([600, 290], [580, 290], [580, 302]).gnd(580, 302);
    s.note(452, 72, ['closed: 0 dB', 'open: −20 dB'], 7.5);

    // VREF2 and the supply
    s.rail(80, 290, '+9V');
    s.res(80, 290, 80, 340, 'R21', '10k');
    s.wire([80, 340], [175, 340]).dot(80, 340).dot(145, 340);
    s.res(80, 340, 80, 390, 'R22', '10k').gnd(80, 390);
    s.cap(145, 340, 145, 390, 'C21', '47u 25V', true).gnd(145, 390);
    s.net(175, 340, 'VREF2');
    s.rail(240, 290, '+9V');
    s.cap(240, 290, 240, 350, 'C22', '100n 50V').gnd(240, 350);
    s.text(252, 380, 'at U2', { size: 8, fill: '#555' });

    s.note(330, 330, [
        'Impedance-balanced: hot is driven through R16 and C11, cold held to ground through R17 and C12 - the',
        'same impedance - so the desk rejects hum picked up along the cable.',
        'C11 and C12 block a desk\'s +48 V phantom power: rated 100 V, their + towards the XLR.',
        'Use an XLR whose pin 1 is apart from its metal housing (Neutrik D-series), or the box undoes LIFT.',
        'For the most hum rejection, a 10:1 DI transformer can take the place of R16, R17, C11 and C12.'], 8.5);
    return s.done();
}

//============================================================================== controls and MIDI

export function schematicControls() {
    const s = new Sheet(1020, 820, 'CONTROLS AND MIDI - the control hub, the knobs, the screen, MIDI IN',
        'The Codec Zero uses GPIO 2, 3 (I2C, shared), 18-21 (audio), 23, 24 and 27. Everything here uses other pins. Part numbers match board-hub.svg.');

    // the Pi's pins, as wires from the underside of its header to the hub
    const pins = [['1  3V3', 100], ['3  SDA (BCM 2)', 120], ['5  SCL (BCM 3)', 140], ['6  GND', 160], ['2  5V', 180],
        ['10  RXD (BCM 15)', 200], ['11  BCM 17', 220], ['22  BCM 25', 240], ['29  BCM 5', 260], ['31  BCM 6', 280],
        ['32  BCM 12', 300], ['36  BCM 16', 320], ['37  BCM 26', 340]];
    const pi = s.box(30, 60, 180, 300, 'Raspberry Pi Zero 2 W', 'pin number  (BCM)', pins.map(([n, y]) => ['right', n, y - 60]), '#f2f7ee');
    s.note(36, 376, ['Each wire from the pin\'s underside goes', 'to the hub\'s pad of the same number', '(P1, P3 ... P37), and on from there.'], 8);
    const stubs = [['2  5V', '5V (U3 pin 8)'], ['10  RXD (BCM 15)', 'MIDI RX'], ['11  BCM 17', 'ENC SW'], ['22  BCM 25', 'RLY → main J8'],
        ['29  BCM 5', 'ENC A'], ['31  BCM 6', 'ENC B'], ['32  BCM 12', 'TEMPO'], ['36  BCM 16', 'TAP'], ['37  BCM 26', 'ON']];
    for (const [pin, name] of stubs) { const [x, y] = pi[pin]; s.wire([x, y], [240, y]).net(240, y, name); }

    // I2C: the knob board and the screen
    const adc = s.box(380, 70, 160, 260, 'ADS7830 knob board', 'Adafruit 5836 - 0x48', [
        ['left', 'VIN', 30], ['left', 'SDA', 50], ['left', 'SCL', 70], ['left', 'GND', 90],
        ['right', 'A0', 100], ['right', 'A1', 120], ['right', 'A2', 140], ['right', 'A3', 160],
        ['right', 'A4', 180], ['right', 'A5', 200], ['right', 'A6', 220], ['right', 'A7', 240],
    ], '#eef3fb');
    s.wire(pi['1  3V3'], adc.VIN).wire(pi['3  SDA (BCM 2)'], adc.SDA).wire(pi['5  SCL (BCM 3)'], adc.SCL).wire(pi['6  GND'], adc.GND);
    s.text(300, 94, 'through the hub\'s Q pads,', { size: 7.5, fill: '#555', anchor: 'middle' });
    s.text(300, 112, 'and a STEMMA QT cable', { size: 7.5, fill: '#555', anchor: 'middle' });
    s.note(392, 196, ['STEMMA QT sockets on', 'both sides: plug-in', 'cables, no soldering.', '', 'The program must', 'leave its internal', 'reference off: REF', 'is VIN, so the knobs', 'use all their travel.'], 7.5);
    ['DRIVE', 'SHAPE', 'TONE', 'FDBK', 'PUSH', 'DECAY', 'MIX', 'LEVEL'].forEach((k, i) => {
        const y = 170 + i * 20;
        s.wire([540, y], [580, y]);
        s.text(586, y + 3, `${k} - pot ${i + 1}'s wiper`, { size: 8 });
    });
    const oled = s.box(380, 350, 160, 50, '0.96" OLED', 'Adafruit 326 - SSD1306, 0x3C', [['top', '~qt', 80]], '#eef3fb');
    s.dashed([460, 330], oled['~qt']);
    s.text(466, 344, 'STEMMA QT cable', { size: 7.5, fill: '#555' });

    // one pot, in full
    s.frame(730, 60, 270, 200, 'Each of the 8 knobs');
    s.rail(800, 110, 'VIN (3.3 V)');
    const pot = s.pot(800, 110, 190, 'B10K', 'linear');
    s.wire(pot.wiper, [870, 150]).net(870, 150, 'to its A pin');
    s.gnd(800, 190);
    s.note(742, 226, ['Swap the outer two wires if a knob runs', 'backwards. Daisy-chain VIN and GND', 'from pot to pot.'], 8);

    // MIDI IN
    s.frame(560, 340, 446, 262, 'MIDI IN - opto-isolated, as the MIDI spec has it');
    s.add('<circle cx="620" cy="450" r="30" fill="#f5f5f5" stroke="#000" stroke-width="1.3"/>');
    for (const [n, x, y] of [['4', 602, 442], ['5', 638, 442], ['2', 620, 462]]) {
        s.add(`<circle cx="${x}" cy="${y}" r="4" fill="#fff" stroke="#000"/>`);
        s.text(x, y + 3, n, { size: 6.5, anchor: 'middle' });
    }
    s.text(620, 496, 'MIDI IN (5-pin DIN)', { size: 9, weight: 'bold', anchor: 'middle' });
    s.text(620, 508, 'pin 2: not connected', { size: 7.5, anchor: 'middle', fill: '#555' });
    s.wire([602, 438], [602, 390], [650, 390]);
    s.res(650, 390, 700, 390, 'R31', '220R');
    s.wire([700, 390], [750, 390]).dot(725, 390);
    s.wire([638, 438], [638, 425], [665, 425], [665, 520], [750, 520]).dot(725, 520);
    s.diode(725, 520, 725, 390, 'D3', '1N4148', false, true);
    const u3 = s.box(750, 372, 110, 170, '6N138', 'U3',
        [['left', '2 A', 18], ['left', '3 K', 148], ['right', '8 Vcc', 18], ['right', '6 Vo', 80], ['right', '5 GND', 148], ['bottom', '7', 55]], '#fff');
    s.wire(u3['8 Vcc'], [925, 390]).dot(890, 390);
    s.rail(890, 390, '+5V');
    s.cap(925, 390, 925, 440, 'C31', '100n 50V', false, true).gnd(925, 440);
    s.wire(u3['6 Vo'], [985, 452]).dot(960, 452);
    s.res(985, 452, 985, 395, 'R32', '470R', true);
    s.wire([985, 395], [985, 385]).rail(985, 385, '3V3');
    s.wire([960, 452], [960, 475]).net(960, 475, 'MIDI RX', 'end');
    s.wire(u3['5 GND'], [880, 520], [880, 530]).gnd(880, 530);
    s.res(805, 542, 805, 580, 'R33', '10k');
    s.gnd(805, 580);
    s.note(570, 618, ['MIDI RX is the Pi\'s serial port, at 31250 baud: in config.txt, dtoverlay=midi-uart0 and',
        'dtoverlay=disable-bt, and the serial console off in raspi-config. A USB MIDI device can also go in',
        'the Pi\'s USB port, through an OTG adapter.'], 8);

    // the panel
    s.frame(14, 600, 540, 210, 'The panel: encoder, footswitches, TEMPO LED');
    const enc = s.box(40, 640, 130, 110, 'Encoder (EC11)', 'with push switch',
        [['right', 'A', 44], ['right', 'B', 62], ['right', 'SW', 80], ['right', 'C', 98], ['left', 'SW\'', 98]], '#fbf3e6');
    s.wire(enc.A, [220, 684]).net(220, 684, 'ENC A');
    s.wire(enc.B, [220, 702]).net(220, 702, 'ENC B');
    s.wire(enc.SW, [220, 720]).net(220, 720, 'ENC SW');
    s.wire(enc.C, [190, 738], [190, 748]).gnd(190, 748);
    s.text(196, 735, '(the middle pin of A, C, B)', { size: 7, fill: '#555' });
    s.wire(enc["SW'"], [30, 738], [30, 760]).gnd(30, 760);
    s.net(320, 650, 'TAP', 'end');
    s.sw(320, 650, 380, 650, 'TAP', 'footswitch');
    s.wire([380, 650], [395, 650], [395, 660]).gnd(395, 660);
    s.net(320, 700, 'ON', 'end');
    s.sw(320, 700, 380, 700, 'ON', 'footswitch');
    s.wire([380, 700], [395, 700], [395, 710]).gnd(395, 710);
    s.net(320, 760, 'TEMPO', 'end');
    s.res(320, 760, 380, 760, 'R34', '470R');
    s.diode(380, 760, 440, 760, 'TEMPO LED', '', true);
    s.wire([440, 760], [460, 760], [460, 770]).gnd(460, 770);
    s.note(440, 640, ['Footswitches: soft-touch', 'momentary, each between', 'its pin and GND. The Pi\'s', 'pull-ups hold them high;', 'the program debounces.'], 8);
    return s.done();
}

//============================================================================== the wiring overview

export function wiringOverview() {
    const s = new Sheet(1000, 790, 'WIRING OVERVIEW - what goes where, inside the box',
        'Boxes are boards and modules; lines are the wires between them, by the pads they go to. The circuits are on the other sheets.');
    const panel = '#fbf3e6', board = '#eef3fb', pi = '#eef6ee';

    // the panel's audio and power parts
    const left = [['INPUT jack', 'right side', 'J3'], ['OUTPUT jack', 'left side', 'J4'], ['9V DC jack', 'rear; plastic body', 'J1'],
                  ['INST/LINE toggle', 'rear', 'J7'], ['ON LED', 'top', 'J9']];
    const main = s.box(220, 90, 200, 290, 'MAIN BOARD', 'board-main.svg', [
        ['left', 'J3', 20], ['left', 'J4', 80], ['left', 'J1', 140], ['left', 'J7', 200], ['left', 'J9', 260],
        ['right', 'J5', 60], ['right', 'J6', 100], ['right', 'J8', 160], ['right', 'J10', 230], ['bottom', 'J2', 100],
    ], board);
    left.forEach(([name, where, j], i) => {
        const b = s.box(20, 90 + i * 60, 130, 40, name, where, [['right', '~', 20]], panel);
        s.wire(b['~'], main[j]);
    });

    const buck = s.box(220, 420, 200, 40, '9V→5V buck', '', [['top', '~', 100]], board);
    s.wire(main.J2, buck['~']);
    s.text(320, 476, 'its 5V out → the Pi\'s PWR port, by a short micro-USB lead', { size: 8, anchor: 'middle', fill: '#1a5fb4' });

    const stack = s.box(500, 90, 230, 150, 'Pi Zero 2 W + Codec Zero', 'the Codec Zero plugged on top', [
        ['left', 'AUX IN', 60], ['left', 'AUX OUT', 100], ['top', '~pwr', 60], ['bottom', 'header pins, underneath', 115],
    ], pi);
    s.wire(main.J5, stack['AUX IN']).wire(main.J6, stack['AUX OUT']);
    s.wire(stack['~pwr'], [560, 74]).net(560, 74, 'PWR (micro-USB) ← 5V');

    const hub = s.box(500, 300, 230, 230, 'CONTROL HUB', 'board-hub.svg', [
        ['top', '~pi', 115], ['left', 'RLY', 30], ['right', 'I2C', 30], ['right', 'encoder', 70], ['right', 'TAP', 115],
        ['right', 'ON', 160], ['right', 'TEMPO LED', 205], ['bottom', 'MIDI', 115],
    ], board);
    s.wire(stack['header pins, underneath'], hub['~pi']);
    s.text(622, 272, 'short wires, Pi pin to P pad', { size: 8, fill: '#555' });
    s.wire(main.J8, [460, 250], [460, 330], hub.RLY);

    const di = s.box(220, 590, 200, 90, 'DI BOARD (optional)', 'board-di.svg', [['top', 'J10', 100], ['right', 'J11', 40], ['right', 'J12', 70]], board);
    s.wire(main.J10, [440, 320], [440, 570], [320, 570], di.J10);
    const xlr = s.box(220, 720, 200, 40, 'XLR, PAD and LIFT', 'left side', [['top', '~', 100]], panel);
    s.wire(di.J11, [440, 630], [440, 700], [320, 700], xlr['~']);
    s.wire(di.J12, [440, 660]);

    const adc = s.box(790, 90, 190, 70, 'ADS7830 knob board', '8 pots on A0-A7', [['left', 'QT', 35], ['bottom', '~qt', 95]], board);
    const oled = s.box(790, 190, 190, 50, '0.96" OLED', 'top, behind its window', [['top', '~qt', 95]], board);
    s.wire(hub.I2C, [760, 330], [760, 125], adc.QT);
    s.wire(adc['~qt'], oled['~qt']);
    s.text(755, 290, 'STEMMA QT cables', { size: 8, fill: '#555', anchor: 'end' });
    [['encoder + push', 'top', 'encoder'], ['TAP footswitch', '', 'TAP'], ['ON footswitch', '', 'ON'], ['TEMPO LED', 'top', 'TEMPO LED']]
        .forEach(([name, where, pin], i) => {
            const y = hub[pin][1];
            const b = s.box(790, y - 17, 190, 34, name, where, [['left', '~', 17]], panel);
            s.wire(hub[pin], b['~']);
        });
    const midi = s.box(560, 580, 110, 40, 'MIDI IN', '5-pin DIN, rear', [['top', '~', 55]], panel);
    s.wire(hub.MIDI, midi['~']);

    s.note(20, 420, ['Grounds: keep every wire', 'short, and join the jacks\'', 'sleeves to the main board', 'only.'], 8.5);
    s.note(700, 600, ['The Codec Zero needs nothing but the Pi\'s', 'header: its power and its audio clocks come', 'from the Pi. Its own button, LEDs, speaker', 'terminals and microphones are not used.'], 8.5);
    return s.done();
}
