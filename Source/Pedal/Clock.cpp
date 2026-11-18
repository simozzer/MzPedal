// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.

#include "Clock.h"

#include <algorithm>
#include <cmath>

namespace pedal
{

//============================================================================== TapClock

void TapClock::prepare(double sampleRate)
{
    fs = sampleRate > 0.0 ? sampleRate : 48000.0;
    now = lastTap = 0;
    tapped = false;
    intervalCount = intervalAt = 0;
}

void TapClock::setBpm(double bpm)
{
    if (std::isfinite(bpm)) tempo = std::clamp(bpm, minBpm, maxBpm);
}

void TapClock::start()
{
    running = true;
    beat = 0.0;
}

void TapClock::tap()
{
    const double gap = (double) (now - lastTap) / fs;

    // a footswitch's bounce, or a double press: not a tap
    if (tapped && gap < 60.0 / maxBpm * 0.5) return;

    if (! tapped || gap > 2.0)
    {
        // a new run: from the first step, now
        intervalCount = intervalAt = 0;
        start();
    }
    else
    {
        intervals[intervalAt] = gap;
        intervalAt = (intervalAt + 1) % remembered;
        intervalCount = std::min(intervalCount + 1, remembered);

        double sum = 0.0;
        for (int i = 0; i < intervalCount; ++i) sum += intervals[i];
        setBpm(60.0 * intervalCount / sum);

        // the beat onto the tap
        beat = std::max(0.0, std::round(beat));
        running = true;
    }

    lastTap = now;
    tapped = true;
}

void TapClock::advance(int n)
{
    if (running) beat += (double) n * tempo / 60.0 / fs;
    now += n;
}

//============================================================================== MidiClock

void MidiClock::message(const uint8_t* data, int size, double time)
{
    if (size < 1) return;
    const std::lock_guard<std::mutex> hold(lock);
    State& s = state;

    switch (data[0])
    {
        case 0xf8:   // a clock
        {
            // the tempo, from the time since the clock before - stopped or not
            const double dt = time - s.lastTick;
            if (s.ticked && dt > 0.005 && dt < 0.2)   // 12.5 to 500 bpm; anything else is a gap
            {
                s.period = s.timed ? s.period + (dt - s.period) * 0.05 : dt;
                s.timed = true;
            }
            s.ticked = true;
            if (s.transport && ! s.running) { s.lastTick = time; return; }   // stopped: the tempo, but not the count
            ++s.ticks;
            s.lastTick = time;
            if (! s.transport) s.running = true;   // clocks alone: follow them
            break;
        }
        case 0xfa:   // START: the next clock is the top
            s.transport = s.running = true;
            s.ticks = -1;
            break;
        case 0xfb:   // CONTINUE: on from where it stopped
            s.transport = s.running = true;
            break;
        case 0xfc:   // STOP
            s.transport = true;
            s.running = false;
            break;
        case 0xf2:   // SONG POSITION, in sixteenths: the next clock is there
            if (size >= 3) s.ticks = (long long) ((data[1] & 0x7f) | ((data[2] & 0x7f) << 7)) * 6 - 1;
            break;
        default:
            break;
    }
}

bool MidiClock::read(double time, double& ppq, double& bpm)
{
    if (lock.try_lock())
    {
        seen = state;
        lock.unlock();
    }

    const State& s = seen;
    if (! s.running || s.ticks < 0 || s.period <= 0.0) return false;

    const double since = time - s.lastTick;
    if (since > 0.5) return false;   // the clocks have stopped coming

    const double between = std::clamp(since / s.period, 0.0, 0.999);   // never past the next clock
    ppq = ((double) s.ticks + between) / 24.0;
    bpm = 60.0 / (s.period * 24.0);
    return true;
}

} // namespace pedal
