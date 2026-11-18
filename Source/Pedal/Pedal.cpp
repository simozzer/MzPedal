// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.

#include "Pedal.h"

#include <algorithm>
#include <cmath>

namespace pedal
{

void Pedal::prepare(double sampleRate, int block)
{
    fs = sampleRate > 0.0 ? sampleRate : 48000.0;
    maxBlock = block > 0 ? block : 512;
    wet.assign((size_t) maxBlock, 0.0f);

    pcd.prepare(fs);
    tapClock.prepare(fs);
    onset.prepare(fs);
    throughStep = (float) (1.0 / (0.005 * fs));
    pickStep = 0;
    sincePick = 0;

    {
        const std::lock_guard<std::mutex> hold(settingsLock);
        current = wanted;
    }
    through = current.bypass ? 0.0f : 1.0f;
    lastBpm = -1.0f;
    lastMode = -1;
    fresh = true;
}

void Pedal::setSettings(const Settings& s)
{
    {
        const std::lock_guard<std::mutex> hold(settingsLock);
        wanted = s;
    }
    if (s.mode == Mode::Tap) liveBpm = s.bpm;
    fresh = true;
    ++changes;
}

Settings Pedal::settings() const
{
    const std::lock_guard<std::mutex> hold(settingsLock);
    Settings s = wanted;
    if (s.mode == Mode::Tap) s.bpm = (float) liveBpm.load();   // as tapped
    return s;
}

void Pedal::tap()
{
    ++taps;
    ++changes;   // the tempo, most likely
}

void Pedal::start() { startWanted = true; }
void Pedal::stop()  { stopWanted = true; }

void Pedal::process(const float* in, float* out, int n, double now)
{
    // the settings, if they have changed and nobody is in the middle of changing them
    if (fresh.load() && settingsLock.try_lock())
    {
        current = wanted;
        fresh = false;
        settingsLock.unlock();
    }

    for (int done = 0; done < n;)
    {
        const int len = std::min(n - done, maxBlock);
        std::copy(in + done, in + done + len, wet.begin());
        run(wet.data(), len, now + (double) done / fs, current);

        // the bypass: the effect faded in or out, the guitar under it
        const float target = current.bypass ? 0.0f : 1.0f;
        for (int i = 0; i < len; ++i)
        {
            const float dry = in[done + i];
            through = target > through ? std::min(target, through + throughStep) : std::max(target, through - throughStep);
            out[done + i] = dry + (wet[(size_t) i] - dry) * through;
        }
        done += len;
    }
}

void Pedal::run(float* x, int n, double now, const Settings& s)
{
    pcd.setSettings(s.pcd);

    if ((int) s.mode != lastMode)
    {
        if (s.mode == Mode::Tap) tapClock.start();
        pickStep = 0;
        onset.reset();
        lastMode = (int) s.mode;
    }
    if (s.bpm != lastBpm) { tapClock.setBpm(s.bpm); lastBpm = s.bpm; }
    onset.setSensitivity(s.sensitivity);

    const int tapped = taps.exchange(0);
    const bool startNow = startWanted.exchange(false), stopNow = stopWanted.exchange(false);

    switch (s.mode)
    {
        case Mode::Tap:
        {
            for (int t = 0; t < tapped; ++t) tapClock.tap();
            if (startNow) tapClock.start();
            if (stopNow) tapClock.stop();
            pcd.setHostClock(tapClock.playing(), tapClock.ppq(), tapClock.bpm());
            pcd.process(x, nullptr, n);
            tapClock.advance(n);
            liveBpm = tapClock.bpm();
            shownStep = pcd.step();
            return;
        }

        case Mode::Midi:
        {
            double ppq = 0.0, bpm = 0.0;
            const bool running = midiClock.read(now, ppq, bpm);
            pcd.setHostClock(running, ppq, bpm);
            pcd.process(x, nullptr, n);
            if (running) liveBpm = bpm;
            shownStep = pcd.step();
            return;
        }

        case Mode::Pick:
        {
            // the PCD's own clock stopped: each pick strikes the next step, on the sample it lands
            pcd.setHostClock(false, 0.0, 0.0);
            const long long pause = (long long) (2.0 * fs);   // after two seconds' rest, from the first step again
            int from = 0;
            for (int i = 0; i < n; ++i)
            {
                ++sincePick;
                if (! onset.next(x[i])) continue;

                if (i > from) pcd.process(x + from, nullptr, i - from);
                from = i;
                if (sincePick > pause) pickStep = 0;
                pcd.strike(pickStep);
                shownStep = pickStep;
                pickStep = (pickStep + 1) % pcd::steps;
                sincePick = 0;
            }
            if (n > from) pcd.process(x + from, nullptr, n - from);
            return;
        }
    }
}

} // namespace pedal
