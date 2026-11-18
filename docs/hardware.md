# MzPedal: the hardware

A Raspberry Pi Zero 2 W with Raspberry Pi's own **Codec Zero** sound board on it, in a Hammond
1590X, with eight knobs, a push-encoder and a small screen, two footswitches, true bypass, MIDI
in, and outputs for an amp, a desk or an audio interface.

- **Inputs:** one jack for anything - guitar or bass (passive or active), or a synth, drum
  machine or keyboard, with an **INST/LINE** switch. **MIDI IN** on a 5-pin DIN, for a clock.
- **Outputs:** **OUTPUT**, to an amp or a line input; and an optional balanced **DI OUT**
  (XLR), with **PAD** and ground **LIFT**, to a desk or an audio interface.

No fine soldering: every small chip comes on a ready-made board, or plugs into a socket. The
soldering is wires to big lugs, and parts with legs into stripboard at 2.54 mm.

## The diagrams

All in [diagrams/](diagrams/), drawn from [src/](src/) - the stripboard layouts are checked
against their circuits as they are drawn (see the end).

| | |
|---|---|
| [wiring-overview.svg](diagrams/wiring-overview.svg) | what goes where in the box: the boards, the modules, the panel, and the wires between |
| [schematic-main.svg](diagrams/schematic-main.svg) | power, the true bypass, the input buffer, INST/LINE, the Codec Zero, the relay driver |
| [board-main.svg](diagrams/board-main.svg) | the main board, on stripboard: parts, cuts, links and every wire off it |
| [schematic-controls.svg](diagrams/schematic-controls.svg) | the Pi's pins, the knobs, the screen, the encoder, the footswitches, MIDI IN |
| [board-hub.svg](diagrams/board-hub.svg) | the control hub, on stripboard: the Pi's wires to the panel's, and MIDI IN |
| [schematic-di.svg](diagrams/schematic-di.svg) | the optional DI out |
| [board-di.svg](diagrams/board-di.svg) | the DI board, on stripboard |
| [drill-template.svg](drill-template.svg) | the box's holes, at 1:1 |

## Check before buying or drilling

1. **The relay's pins.** The layout uses the Panasonic TQ2-5V's: coil on 1 and 10, NC 2 and 9,
   common 3 and 8, NO 4 and 7, rows 7.62 mm apart. Check the datasheet of the one you buy -
   and the relay itself with a meter before soldering (the main board's notes say how).
2. **The screen's window.** The template's 24 x 13 mm is for a 0.96" OLED's visible area; check
   it against your module before cutting.
3. **The DIN socket.** Panel MIDI sockets vary: drill to fit the one you have.

## The box

**Hammond 1590X**: 145 x 121 x 52 mm outside. Stood upright, footswitches nearest you.

| Where | What | Hole |
|---|---|---|
| Top | 8 pots, 16 mm, M7 bushing | 7.5 mm |
| Top | push-encoder (EC11 type), M7 bushing | 7.5 mm |
| Top | screen window, 0.96" OLED | 24 x 13 mm, cut and filed |
| Top | 2 LEDs, 5 mm, in bezels | 8 mm |
| Top | 2 soft-touch momentary footswitches | 12 mm |
| Right side | INPUT, 1/4" mono jack | 9.5 mm |
| Left side | OUTPUT, 1/4" mono jack | 9.5 mm |
| Left side | *optional* DI OUT, XLR (Neutrik D-series) | 24 mm, and its 2 screw holes |
| Left side | *optional* PAD and LIFT, mini toggles | 6 mm each |
| Rear | MIDI IN, 5-pin DIN panel socket | about 16 mm - to fit |
| Rear | INST/LINE, mini toggle | 6 mm |
| Rear | 9 V DC, 2.1 mm, plastic body, centre negative | 12 mm |

Positions: [drill-template.svg](drill-template.svg), printed at 100% - its check line must
measure 100 mm. Centre punch through it, drill a 3 mm pilot, then step up.

## Parts

Approximate UK prices, for planning - check before ordering. About **£125-£165** for the
pedal with the DI, before a power supply and postage.

| | Part | Notes | About |
|---|---|---|---|
| 1 | Raspberry Pi Zero 2 W **with header** (the WH) | | £15-£18 |
| 1 | Raspberry Pi **Codec Zero** | plugs onto the header; no soldering | £18-£20 |
| 1 | microSD card, 16 GB or more | | £5-£8 |
| 1 | Hammond 1590X | | £15-£20 |
| 1 | Adafruit ADS7830 8-channel ADC (5836), STEMMA QT | the knobs | £6-£8 |
| 1 | Adafruit 0.96" 128 x 64 OLED (326), STEMMA QT | or a generic SSD1306 I2C module with pins fitted | £5-£18 |
| 2 | STEMMA QT cables: one 4-pin to female sockets, one QT to QT | no soldering | £2-£4 |
| 8 | 16 mm B10K linear pots, and 8 knobs | | £15-£25 |
| 1 | EC11-type rotary encoder with push switch, and a knob | | £2-£3 |
| 2 | soft-touch momentary footswitches (normally open) | | £6-£10 |
| 1 | Panasonic TQ2-5V relay (DPDT, 5 V, non-latching) | | £2-£4 |
| 2 | TL071 op-amps, and 8-pin sockets | U1 on the main board, U2 on the DI | £1-£2 |
| 1 | 6N138 opto-isolator, and an 8-pin socket | MIDI IN | £1 |
| 1 | 9 V to 5 V buck converter, 2 A or more - e.g. Pololu D24V22F5 | | £10-£13 |
| 1 | short micro-USB lead, or a micro-USB plug with screw terminals | the buck to the Pi | £2-£4 |
| 2 | 1/4" mono jacks | | £3-£6 |
| 1 | 2.1 mm DC jack, **plastic bodied** | | £1-£2 |
| 1 | 5-pin DIN panel socket (female) | MIDI IN | £1-£3 |
| 3 | mini toggle switches (SPST, or SPDT using two lugs) | INST/LINE; PAD and LIFT for the DI | £3-£6 |
| 2 | 5 mm LEDs and bezels | ON, TEMPO | £1-£2 |
| | resistors, capacitors, diodes, a 2N3904, stripboard, wire, pin headers, standoffs | as listed on each board | £8-£12 |
| | *optional DI:* Neutrik NC3MD-L-1 XLR (or similar, with a separate pin 1) | | £3-£5 |

The resistors and capacitors for each board are listed beside its layout. A 9 V supply rated
**1 A** or more: the Pi and Codec Zero take up to about 0.6-0.7 A at 9 V, more than many
pedalboard outlets give.

## The Pi's pins

The Codec Zero plugs onto the Pi's header and uses GPIO 2 and 3 (I2C, shared with the knobs and
the screen), 18-21 (its audio), 23, 24 and 27 (its own LEDs and button). The rest use other pins,
wired from the **underside** of the Pi's header - each pin's solder joint, at 2.54 mm - to the
control hub's P pads:

| Pi pin | BCM | Hub pad | To |
|---|---|---|---|
| 1 | 3.3 V | P1 | the knob board, the screen, the MIDI pull-up |
| 2 | 5 V | P2 | the 6N138 |
| 3, 5 | 2, 3 | P3, P5 | I2C: the knob board (0x48) and the screen (0x3C), with the Codec Zero (0x1a) |
| 6 | GND | P6 | |
| 10 | 15 (RXD) | P10 | MIDI IN, from the 6N138 |
| 11 | 17 | P11 | encoder push switch |
| 22 | 25 | P22 | the relay - low at boot, so the pedal starts bypassed |
| 29, 31 | 5, 6 | P29, P31 | encoder A, B |
| 32 | 12 | P32 | TEMPO LED |
| 36 | 16 | P36 | TAP footswitch |
| 37 | 26 | P37 | ON footswitch |

## How it works

**The audio.** INPUT goes to the relay. At rest - unpowered, booting, or if the program stops -
the relay joins INPUT straight to OUTPUT: true bypass. Switched on, it sends the input through
U1, a buffer with about 1 MOhm input impedance (so a passive guitar keeps its top end), into the
Codec Zero; the Pi plays MzPCD; the Codec Zero's output comes back through the relay to OUTPUT.

- **INST/LINE.** INST: the buffer at unity gain. LINE: the same, 6 dB quieter into the Codec
  Zero, so a synth's or a drum machine's hotter level does not clip it. The Codec Zero's own AUX
  IN gain, in the software, sets the level from there.
- **OUTPUT** carries up to the Codec Zero's 1 V rms: fine for an amp's input or a line input.
- **DI OUT** (optional) takes the OUTPUT line - effect or bypass, what the amp gets - through its
  own buffer, so it never loads the guitar, to a balanced XLR. PAD drops it 20 dB for a mic
  input; LIFT breaks a hum loop. Its capacitors are rated 100 V, against a desk's phantom power.

**MIDI IN.** A 6N138 opto-isolator, as the MIDI spec has it, so the pedal and the MIDI source
never share a ground. The Pi reads it on its serial port at 31250 baud. A USB MIDI device can
also go into the Pi's USB port, through an OTG adapter.

**The relay** is driven by BCM 25 through Q1. BCM 25 rests low while the Pi boots, and R20 holds
it low besides. The ON LED is lit by the relay's own current, so it shows what the relay is
really doing.

**Power.** 9 V in, through a Schottky diode against a reversed supply, to the buffers; a buck
converter makes 5 V for the Pi (through its micro-USB power port, so it keeps its own fuse) and
the relay. The Codec Zero takes its power from the Pi.

## Putting it together

1. **The Pi first, on the bench.** Raspberry Pi OS Lite (64-bit) on the card; the Codec Zero
   on the header. Install the pedal software and run `PedalCheck --bench`. Play something into
   the Codec Zero's AUX IN and out of its AUX OUT, by its pins, to hear it work.
2. **The boards.** Make the cuts first and check each with a meter; then the links, the low
   parts, the sockets, the tall parts last. Check each board for shorts between neighbouring
   strips before powering it.
3. **The main board**, on the bench with the jacks and the Pi: with the Pi off, the guitar goes
   straight through. Then the relay test: 5 V on the hub's RELAY wire clicks it.
4. **The hub**, the knob board and the screen: `i2cdetect -y 1` shows 0x1a, 0x3c and 0x48.
   Then the encoder, the footswitches and MIDI IN.
5. **The box.** Drill and finish it; fit the panel parts; mount the Pi and the boards on
   standoffs, the boards' copper away from the box (or on insulating tape); wire it up as the
   overview shows.
6. **Set the levels.** INST, a hard strum: raise the Codec Zero's AUX IN gain until it just
   stops short of clipping. Then the pedal's LEVEL, so bypassed and on are as loud as each other.

## The software for it

The program already runs the effect, the three clocks and the commands. Still to come, for this
hardware: reading the knobs (the ADS7830, with its internal reference left off), the encoder and
the footswitches; the relay, the LEDs and the screen; and MIDI from the serial port. The Pi needs,
in `/boot/firmware/config.txt`:

    dtparam=i2c_arm=on
    dtoverlay=disable-bt
    dtoverlay=midi-uart0

and the serial console turned off in `raspi-config`. The Codec Zero is found by its own EEPROM;
Raspberry Pi's `Pi-Codec` state files set up its AUX IN and AUX OUT.

## The diagrams' sources

`src/boards.mjs` holds the three stripboards as data - each part's pins, and the net each pin is
meant to be on; `src/schematics.mjs` draws the schematics. `node docs/src/build.mjs` checks
every board - every net joined, no two nets touching, no two parts in one hole, no part lying
across another's leads - and draws nothing if any is wrong.
