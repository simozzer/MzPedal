// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.

#pragma once

#include <cstdint>
#include <mutex>

namespace pedal
{

//
// A pedal has no DAW, so no timeline to follow. These stand in for it: each says, at the top
// of every block, where the beat is - in quarter notes - and how fast it is going, which is
// all the PCD's own clock asks of a host.
//

//
// TAP TEMPO. The beat from a footswitch, as a delay pedal's.
//
// After a pause of two seconds or more, a tap starts a new run: the pattern starts again from
// its first step, on the tap, at the tempo it had. Each tap after that, within two seconds of
// the one before, sets the tempo from the last few taps and pulls the beat onto the tap, so
// the pattern locks to the playing.
//
class TapClock
{
public:
    static constexpr double minBpm = 30.0, maxBpm = 300.0;

    void prepare(double sampleRate);

    // audio thread, at the top of a block: a tap, now
    void tap();

    void start();                 // from the first step, at the tempo it has
    void stop() { running = false; }
    void setBpm(double bpm);

    bool playing() const { return running; }
    double ppq() const { return beat; }
    double bpm() const { return tempo; }

    // after a block of n samples
    void advance(int n);

private:
    static constexpr int remembered = 4;   // the taps the tempo is averaged over, less one

    double fs = 48000.0;
    double tempo = 120.0, beat = 0.0;
    bool running = false;
    long long now = 0, lastTap = 0;
    bool tapped = false;
    double intervals[remembered] {};
    int intervalCount = 0, intervalAt = 0;
};

//
// MIDI CLOCK. The beat from a drum machine, a sequencer or a DAW: 24 clocks to the quarter
// note, with START, CONTINUE, STOP and SONG POSITION.
//
// The MIDI input's thread hands each message in as it arrives, timed; the audio thread asks
// where the clock is at the top of each block. Between clocks the position runs on at the
// tempo the clocks have been arriving at, but never past the next clock, so it never runs
// ahead and has to step back. A source that sends clocks but never a START is followed from
// its first clock; one that sends START and STOP is followed as they say.
//
class MidiClock
{
public:
    // the MIDI input's thread: a message, as it arrived, at `time` seconds
    void message(const uint8_t* data, int size, double time);

    // audio thread: where the beat is at `time` seconds, and the tempo. False while stopped,
    // before the first clock, or if the clocks have stopped coming.
    bool read(double time, double& ppq, double& bpm);

private:
    struct State
    {
        bool running = false;     // after a START or CONTINUE, until a STOP
        bool transport = false;   // whether a START, CONTINUE or STOP has ever come
        long long ticks = -1;     // the clock last counted, from the top; -1 before the first
        double lastTick = 0.0;
        double period = 60.0 / 120.0 / 24.0;   // 120 bpm, until the clocks say otherwise
        bool timed = false;                    // whether the clocks have said
        bool ticked = false;                   // whether a clock has ever come
    };

    std::mutex lock;   // the MIDI thread waits on it; the audio thread only ever tries it
    State state, seen; // seen: the audio thread's last copy, if the lock was busy
};

} // namespace pedal
