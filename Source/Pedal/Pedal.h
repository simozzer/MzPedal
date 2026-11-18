// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.

#pragma once

#include "Clock.h"
#include "Onset.h"

#include "Pcd.h"   // MzPCD's effect, compiled from its repository

#include <atomic>
#include <cstdint>
#include <mutex>
#include <vector>

namespace pedal
{

// What steps the pattern on.
enum class Mode { Tap, Midi, Pick };

//
// Everything the pedal is set to: the PCD's own panel, and the pedal's.
//
struct Settings
{
    pcd::Settings pcd;

    Mode  mode = Mode::Tap;
    float bpm = 120.0f;          // TAP's tempo until it is tapped
    float sensitivity = 0.5f;    // PICK's SENS, 0 to 1
    bool  bypass = false;
};

//
// MzPCD as a pedal: one guitar in, mono, through the PCD, its pattern stepped on by a tap
// tempo, a MIDI clock or the pick.
//
// The bypass is a soft one: the effect fades out over 5 ms and the guitar comes straight
// through, so it never clicks. The PCD runs on underneath it, so switched back in, its
// feedback and its pattern are where they would have been.
//
// The audio thread calls process(); anything else - the footswitches, the knobs, the MIDI
// input, a terminal - may call the rest, from any thread, at any time.
//
class Pedal
{
public:
    void prepare(double sampleRate, int maxBlock);

    // audio thread: n samples of the guitar to n of the pedal's output; in may be out. `now`
    // is the time in seconds, on the clock the MIDI input stamps its messages with.
    void process(const float* in, float* out, int n, double now);

    // any thread
    void setSettings(const Settings&);
    Settings settings() const;
    void tap();
    void start();   // TAP: from the first step again
    void stop();    // TAP: the pattern still, the knobs alone setting the effect
    void midi(const uint8_t* data, int size, double time) { midiClock.message(data, size, time); }

    int step() const { return shownStep.load(std::memory_order_relaxed); }   // 0 to 15, -1 none
    float envelope() const { return pcd.envelope(); }
    double bpm() const { return liveBpm.load(std::memory_order_relaxed); }    // TAP's or MIDI's, as it is now
    unsigned revision() const { return changes.load(); }                      // goes up with every change

    // the delay the effect makes, in samples
    static constexpr int latency() { return pcd::Pcd::latency(); }

private:
    void run(float* x, int n, double now, const Settings&);

    pcd::Pcd pcd;
    TapClock tapClock;
    MidiClock midiClock;
    Onset onset;

    double fs = 48000.0;
    int maxBlock = 512;
    std::vector<float> wet;

    // the settings, handed to the audio thread
    mutable std::mutex settingsLock;
    Settings wanted, current;
    std::atomic<bool> fresh { true };
    std::atomic<unsigned> changes { 0 };

    std::atomic<int> taps { 0 };
    std::atomic<bool> startWanted { false }, stopWanted { false };
    int lastMode = -1;   // none yet: the first block starts TAP's clock
    float lastBpm = -1.0f;

    // PICK: the step the next pick strikes, and how long since the last
    int pickStep = 0;
    long long sincePick = 0;

    float through = 1.0f, throughStep = 0.0f;   // how much of the effect is heard; the bypass fades it

    std::atomic<int> shownStep { -1 };
    std::atomic<double> liveBpm { 120.0 };
};

} // namespace pedal
