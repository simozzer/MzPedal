# MzPedal

**[MzPCD](https://github.com/simozzer/MzPCD), the pattern-controlled distortion, as a guitar
pedal**, on a Raspberry Pi Zero 2 W. One of 32 patterns pushes the drive, the tone and the
feedback on every step. A pedal has no DAW to follow, so the pattern steps on with a **tap
tempo**, a **MIDI clock**, or the **pick** itself.

The sound is MzPCD's, compiled from its repository: ReBirth's distortion, as
[OpenRB-338](https://github.com/pingw33n/openrb-338) decoded it, with MzPCD's tone and
feedback loop, and [MzPCF](https://github.com/simozzer/MzPCF)'s patterns.

**Where it is:** the program runs headless, takes the guitar in from a sound card and puts
the pedal out, and is driven by typed commands. The hardware is designed - a Pi Zero 2 W and a
Codec Zero in a Hammond 1590X, with eight knobs, an encoder and a screen, true bypass, MIDI IN
and an optional DI out: [docs/hardware.md](docs/hardware.md), with full schematics, stripboard
layouts and a drilling template. The program's side of it - the knobs, the switches, the relay
and the screen - is next, and will send the same commands.

## What steps the pattern on

- **`mode tap`** - a footswitch, as a delay pedal's tap. After two seconds without one, a tap
  starts the pattern again from its first step, on the tap; each tap after that sets the
  tempo from the last few and pulls the beat onto the tap. Until it is tapped it plays at
  `bpm`.
- **`mode midi`** - a MIDI clock, from a drum machine, a sequencer or
  [MzDebirth](https://github.com/simozzer/MzDebirth): START, STOP, CONTINUE and SONG POSITION
  are followed, and so is a clock that sends none of them. Any MIDI input plugged in - USB, or
  a DIN interface - is listened to, and one plugged in later is found.
- **`mode pick`** - each note picked strikes the next step. It listens for the pick's click,
  above 1.5 kHz, where a string still ringing has gone quiet, so a quick run of notes is each
  heard and a note swelling in on the volume knob is not. `sens` sets how light a pick still
  counts. After two seconds' rest the pattern starts again from its first step.

## The commands

One a line, typed at the program, or sent to it while it runs as a service:

    echo "drive 100" > /run/mzpedal/control

The controls take the units the plugin's panel shows; a control alone says where it is:

| | |
|---|---|
| `pattern` 1-32, `rate` 8, 16 or 32 | which pattern, and how long a step is |
| `drive` 0-127, `shape` 0-127 | ReBirth's AMOUNT and SHAPE; SHAPE 0 its hard clip |
| `tone` 0-100, `fdbk` 0-100 | dark to bright; the amp-style feedback |
| `push-drive` 0-127, `push-tone` -100-100, `push-fdbk` 0-100 | how far a full step pushes each |
| `decay` 0-100 | how fast a push dies away, 15 ms to 1.5 s |
| `mix` 0-100, `level` -24-12 dB | dry to all through it; the output |
| `mode` tap, midi or pick; `bpm`; `sens` 0-100 | what steps the pattern on |
| `bypass` on, off or toggle | a soft bypass: faded over 5 ms, never a click |
| `tap`, `start`, `stop` | TAP's footswitch; from the first step; still |
| `show`, `status`, `save`, `help`, `quit` | everything; the sound card, CPU and dropouts |

The settings save themselves a second after they stop changing, written beside the old file
and moved over it, so pulling the power never leaves them half-written. They are the same
commands, one a line, in `~/.config/MzPedal/settings.txt`.

## On the Pi

On a Raspberry Pi Zero 2 W (or a 3, 4 or 5) with 64-bit Raspberry Pi OS Lite, Bookworm or
later: download `MzPedal-<version>-linux-arm64.tar.gz`, unpack it, and

    sudo ./install.sh

That installs it as a service that starts at boot, and starts again if it ever stops, with
real-time priority for the audio and the CPU held at full speed. Then:

    mzpedal --list                  the sound cards there are
    sudo nano /etc/default/mzpedal  which one, and the block size
    sudo systemctl restart mzpedal
    journalctl -u mzpedal -f        what it says
    echo status > /run/mzpedal/control

`status` says the CPU it takes, any dropouts, the delay through it, and whether the audio got
real-time priority. **First, on the Pi itself, run `PedalCheck --bench`**: it says how much of
one core the pedal takes, at 32, 64 and 128 samples a block. On a desktop PC it is under 1%.

To try it at a desk without the service, stop that (`sudo systemctl stop mzpedal`) and run
`mzpedal --device <part of the card's name>`, typing the commands.

## Building

Beside this repository: [JUCE](https://github.com/juce-framework/JUCE) 9.0.2 (`../JUCE`),
[MzPCD](https://github.com/simozzer/MzPCD) (`../MzPCD`) and
[MzPCF](https://github.com/simozzer/MzPCF) (`../MzPCF`).

    .\build.ps1                 Windows: the checks, then the program, to try at the desk
    .\build.ps1 -Bench          and the benchmark

On Linux, or on the Pi itself (`sudo apt install g++ cmake libasound2-dev`):

    cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j4
    ./build/PedalCheck --bench

GitHub builds and checks it for arm64 and x86_64 on every push, and packs the arm64 build as
the download (`.github/workflows/linux.yml`).

## Layout

    Source/Main.cpp        the program: the sound card, MIDI in, the commands, the service's chores
    Source/Pedal/          the pedal - plain C++, no JUCE
      Pedal.h/.cpp         MzPCD's effect, the three clocks, the bypass
      Clock.h/.cpp         the tap tempo and the MIDI clock
      Onset.h/.cpp         the pick detector
      Commands.h/.cpp      the commands, and the settings saved as them
    Tests/PedalCheck.cpp   the checks, and the benchmark
    linux/                 the service, its settings and install.sh

## Licence

Created by Simon Moscrop. Free software under the GNU AGPL v3; see [LICENSE](LICENSE).
MzPCD's distortion, compiled from its repository, is a port of OpenRB-338's, under the GNU GPL
v3, which section 13 of each licence lets it be combined with.
