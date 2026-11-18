// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.
//
// The pedal's checks, and its benchmark. No JUCE, no sound card: the pedal's clocks, its
// pick detector, its bypass and its commands, run on made-up guitar.
//
//     PedalCheck            the checks
//     PedalCheck --bench    and how much of one core the pedal takes - run it on the Pi
//

#include "Pedal/Commands.h"
#include "Pedal/Pedal.h"

#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <random>
#include <string>
#include <vector>

using namespace pedal;

namespace
{
    int failures = 0;
    constexpr double fs = 48000.0;
    constexpr double pi = 3.14159265358979323846;

    void check(bool ok, const char* what, const std::string& detail = {})
    {
        std::printf("%s  %-58s %s\n", ok ? "ok  " : "FAIL", what, detail.c_str());
        if (! ok) ++failures;
    }

    template <class... A> std::string fmt(const char* f, A... a)
    {
        char s[200];
        std::snprintf(s, sizeof s, f, a...);
        return s;
    }

    //
    // Made-up guitar: picked notes over a little hiss. Each is a click from the pick, a few
    // milliseconds of noise, and twenty harmonics dying away - the higher, the faster, as a
    // string's do. A new pick on a string stops what it was playing.
    //
    struct Pluck { double at; double hz; float level; };

    std::vector<float> guitar(const std::vector<Pluck>& plucks, double seconds, unsigned seed = 1)
    {
        std::vector<float> x((size_t) (seconds * fs), 0.0f);
        std::mt19937 rng(seed);
        std::normal_distribution<float> hiss(0.0f, 0.0003f);   // about -70 dBFS
        std::uniform_real_distribution<float> click(-1.0f, 1.0f);
        for (auto& v : x) v = hiss(rng);

        for (size_t p = 0; p < plucks.size(); ++p)
        {
            const auto& k = plucks[p];
            const size_t from = (size_t) (k.at * fs);
            const size_t to = p + 1 < plucks.size() ? (size_t) (plucks[p + 1].at * fs) : x.size();   // the next pick stops it
            for (size_t i = from; i < to && i < x.size(); ++i)
            {
                const double t = (double) (i - from) / fs;
                const double attack = std::min(1.0, t / 0.001);
                double v = 0.0;
                for (int h = 1; h <= 20; ++h)
                    v += std::sin(2.0 * pi * k.hz * h * t) / h * std::exp(-t * (1.5 + k.hz * h / 150.0));
                if (t < 0.004) v += 0.3 * click(rng) * (1.0 - t / 0.004);   // the pick
                x[i] += (float) (k.level * attack * v);
            }
        }
        return x;
    }

    // runs a pedal over x in blocks, calling each(block start sample) first
    template <class F>
    std::vector<float> play(Pedal& p, const std::vector<float>& x, int block, F&& each)
    {
        std::vector<float> out(x.size());
        for (size_t at = 0; at < x.size(); at += (size_t) block)
        {
            const int n = (int) std::min<size_t>((size_t) block, x.size() - at);
            each((long long) at);
            p.process(x.data() + at, out.data() + at, n, (double) at / fs);
        }
        return out;
    }

    Pedal& fresh(Pedal& p, Mode mode)
    {
        Settings s;
        s.mode = mode;
        p.setSettings(s);
        p.prepare(fs, 64);
        return p;
    }
}

//============================================================================== the clocks

static void tapTempo()
{
    std::printf("\nTAP TEMPO\n");

    Pedal p;
    fresh(p, Mode::Tap);

    // taps every 0.6 s - 100 bpm - from half a second in; then the steps, 16ths, should fall
    // every 0.15 s, the first on the first tap
    std::vector<long long> taps;
    for (int t = 0; t < 4; ++t) taps.push_back((long long) ((0.5 + 0.6 * t) * fs));

    std::vector<double> stepTimes;
    int lastStep = -2;
    const std::vector<float> silence((size_t) (5.0 * fs), 0.0f);
    play(p, silence, 48, [&] (long long at)
    {
        for (long long t : taps)
            if (t >= at && t < at + 48) p.tap();
        const int s = p.step();
        if (s != lastStep && at > taps.front()) stepTimes.push_back((double) at / fs);
        lastStep = s;
    });

    check(std::fabs(p.bpm() - 100.0) < 0.5, "four taps 0.6 s apart are 100 bpm", fmt("%.2f bpm", p.bpm()));

    // the steps after the last tap
    double worst = 0.0;
    int counted = 0;
    for (size_t i = 1; i < stepTimes.size(); ++i)
        if (stepTimes[i - 1] > 2.5)
        {
            worst = std::max(worst, std::fabs(stepTimes[i] - stepTimes[i - 1] - 0.15));
            ++counted;
        }
    check(counted > 8 && worst < 0.0015, "and the steps go by every 0.15 s", fmt("%d steps, %.2f ms out at worst", counted, worst * 1000));

    const bool firstOnTap = ! stepTimes.empty() && std::fabs(stepTimes.front() - 0.5) < 0.002;
    check(firstOnTap, "a run of taps starts on the first tap", fmt("first step at %.3f s", stepTimes.empty() ? -1.0 : stepTimes.front()));

    // a bounce, 20 ms after a tap, is not a tap
    {
        TapClock c;
        c.prepare(fs);
        c.setBpm(120);
        c.tap();
        c.advance((int) (0.5 * fs));
        c.tap();
        c.advance((int) (0.02 * fs));
        c.tap();
        check(std::fabs(c.bpm() - 120.0) < 0.5, "a footswitch's bounce is not a tap", fmt("%.1f bpm", c.bpm()));
    }
}

static void midiClock()
{
    std::printf("\nMIDI CLOCK\n");

    MidiClock m;
    const uint8_t clock = 0xf8, start = 0xfa, stop = 0xfc;
    std::mt19937 rng(7);
    std::uniform_real_distribution<double> jitter(-0.001, 0.001);   // USB MIDI's, about a millisecond

    double ppq = 0, bpm = 0;
    check(! m.read(0.0, ppq, bpm), "nothing before the clock starts");

    // START at 1 s, then clocks at 120 bpm - 24 to the beat, every 20.8 ms - for 4 s
    const double period = 60.0 / 120.0 / 24.0;
    m.message(&start, 1, 1.0);
    double t = 1.0 + 0.001;
    double lastPpq = -1;
    bool backwards = false;
    int ticks = 0;
    for (; t < 5.0; t += period, ++ticks)
    {
        m.message(&clock, 1, t + jitter(rng));
        // the audio thread asks a few times between each clock
        for (double q = t + 0.002; q < t + period; q += 0.006)
            if (m.read(q, ppq, bpm))
            {
                backwards |= ppq < lastPpq - 1e-9;
                lastPpq = ppq;
            }
    }
    check(std::fabs(bpm - 120.0) < 2.0, "24 clocks a beat at 120 bpm read as 120", fmt("%.2f bpm", bpm));
    check(! backwards, "and the beat never steps back, however the clocks jitter");
    check(std::fabs(lastPpq - ticks / 24.0) < 0.05, "and is where the clocks have counted to", fmt("%.3f beats of %.3f", lastPpq, ticks / 24.0));

    m.message(&stop, 1, t);
    check(! m.read(t + 0.01, ppq, bpm), "STOP stops it");

    // a clock that never sends START is followed from its first clock
    MidiClock free;
    for (int i = 0; i < 48; ++i) free.message(&clock, 1, 0.5 + i * period);
    const bool runs = free.read(0.5 + 47 * period + 0.001, ppq, bpm);
    check(runs && std::fabs(ppq - 47.0 / 24.0) < 0.01, "clocks with no START are followed from the first",
          fmt("%.3f beats", ppq));

    // and it stops when they stop coming
    check(! free.read(0.5 + 48 * period + 1.0, ppq, bpm), "and let go of when they stop coming");

    // in the pedal: the first step falls on the first clock after START
    Pedal p;
    fresh(p, Mode::Midi);
    double firstStep = -1;
    std::vector<double> steps;
    int last = -1;
    const std::vector<float> silence((size_t) (3.0 * fs), 0.0f);
    play(p, silence, 48, [&] (long long at)
    {
        const double now = (double) at / fs;
        // START at 0.5 s and clocks from 0.51 s, each delivered as it falls in this block
        const double blockEnd = now + 48.0 / fs;
        if (0.5 >= now && 0.5 < blockEnd) p.midi(&start, 1, 0.5);
        for (int k = 0; k < 24 * 5; ++k)
        {
            const double tk = 0.51 + k * period;
            if (tk >= now && tk < blockEnd) p.midi(&clock, 1, tk);
        }
        const int s = p.step();
        if (s != last && s >= 0)
        {
            if (firstStep < 0) firstStep = now;
            steps.push_back(now);
        }
        last = s;
    });
    check(firstStep > 0.5 && firstStep < 0.515, "the pedal's pattern starts on the first clock", fmt("at %.4f s", firstStep));
    double worst = 0;
    for (size_t i = 2; i < steps.size(); ++i) worst = std::max(worst, std::fabs(steps[i] - steps[i - 1] - 0.125));
    check(steps.size() > 10 && worst < 0.0025, "and steps every sixteenth, 125 ms at 120",
          fmt("%zu steps, %.2f ms out at worst", steps.size(), worst * 1000));
}

//============================================================================== the pick

static void pick()
{
    std::printf("\nSTRIKE ON THE PICK\n");

    // a riff: picked notes of all sizes, some quick, some left ringing, a repeat of the same
    // note while it still rings, and a last one quiet
    const std::vector<Pluck> plucks = {
        { 0.30, 82.4, 0.5f }, { 0.55, 82.4, 0.5f }, { 0.80, 110.0, 0.4f }, { 0.92, 123.5, 0.3f },
        { 1.20, 146.8, 0.6f }, { 1.90, 196.0, 0.2f }, { 2.05, 196.0, 0.25f }, { 2.40, 329.6, 0.3f },
        { 2.52, 293.7, 0.3f }, { 2.64, 246.9, 0.3f }, { 3.50, 82.4, 0.8f }, { 4.40, 164.8, 0.05f },
    };
    const auto x = guitar(plucks, 5.5);

    Onset o;
    o.prepare(fs);
    o.setSensitivity(0.5f);
    std::vector<double> heard;
    for (size_t i = 0; i < x.size(); ++i)
        if (o.next(x[i])) heard.push_back((double) i / fs);

    // each pick heard once, within 5 ms
    int matched = 0;
    double late = 0;
    for (const auto& k : plucks)
        for (double h : heard)
            if (h >= k.at - 0.0005 && h < k.at + 0.005)
            {
                ++matched;
                late = std::max(late, h - k.at);
                break;
            }
    check(matched == (int) plucks.size() && heard.size() == plucks.size(),
          "every pick of a riff is heard, once", fmt("%d of %zu, %zu heard", matched, plucks.size(), heard.size()));
    check(late < 0.005, "and heard within 5 ms", fmt("%.2f ms late at worst", late * 1000));

    // a long note, its volume swelling and wavering - a volume knob, a tremolo - picks nothing
    {
        std::vector<float> swell((size_t) (4.0 * fs));
        for (size_t i = 0; i < swell.size(); ++i)
        {
            const double t = (double) i / fs;
            const double level = std::min(1.0, t / 1.5) * (0.7 + 0.3 * std::sin(2.0 * pi * 5.0 * t));
            swell[i] = (float) (0.3 * level * std::sin(2.0 * pi * 110.0 * t));
        }
        Onset s;
        s.prepare(fs);
        s.setSensitivity(0.5f);
        int falsePicks = 0;
        for (float v : swell) falsePicks += s.next(v) ? 1 : 0;
        check(falsePicks == 0, "a note swelling in, with tremolo, is not a pick", fmt("%d heard", falsePicks));
    }

    // the hiss alone, turned right up: nothing
    {
        const auto hiss = guitar({}, 3.0);
        Onset s;
        s.prepare(fs);
        s.setSensitivity(1.0f);
        int heardHiss = 0;
        for (float v : hiss) heardHiss += s.next(v) ? 1 : 0;
        check(heardHiss == 0, "the hiss under it is not, even at full SENS", fmt("%d heard", heardHiss));
    }

    // in the pedal: each pick steps the pattern on, from the first step
    Pedal p;
    fresh(p, Mode::Pick);
    std::vector<int> seen;
    int last = -1;
    play(p, x, 64, [&] (long long)
    {
        const int s = p.step();
        if (s != last && s >= 0) seen.push_back(s);
        last = s;
    });
    // the last step, struck in the last block, is read after it
    if (p.step() != last && p.step() >= 0) seen.push_back(p.step());
    bool inOrder = seen.size() >= 3 && seen[0] == 0;
    for (size_t i = 1; i < seen.size(); ++i)
        if (seen[i] != 0) inOrder &= seen[i] == seen[i - 1] + 1;   // 0 again after a rest
    check(inOrder, "the pedal steps on with each pick, from the first step",
          fmt("%zu steps", seen.size()));
}

//============================================================================== the pedal

static void bypassAndCommands()
{
    std::printf("\nTHE BYPASS, AND THE COMMANDS\n");

    const auto x = guitar({ { 0.1, 110.0, 0.5f }, { 0.6, 147.0, 0.5f } }, 1.2);

    Pedal p;
    Commands c(p);
    fresh(p, Mode::Tap);
    c.run("drive 110");
    c.run("bypass on");
    p.prepare(fs, 64);   // starts bypassed, with no fade
    const auto through = play(p, x, 64, [] (long long) {});
    float apart = 0;
    for (size_t i = 0; i < x.size(); ++i) apart = std::max(apart, std::fabs(through[i] - x[i]));
    check(apart == 0.0f, "bypassed, the guitar comes through untouched", fmt("%.2g apart", apart));

    c.run("bypass toggle");
    const auto on = play(p, x, 64, [] (long long) {});
    float moved = 0, step = 0;
    for (size_t i = 0; i < x.size(); ++i) moved = std::max(moved, std::fabs(on[i] - x[i]));
    for (size_t i = 1; i < on.size(); ++i) step = std::max(step, std::fabs(on[i] - on[i - 1]));
    check(moved > 0.05f, "switched in, it is distorted", fmt("%.3f apart", moved));
    check(std::isfinite(step) && step < 1.0f, "and comes in without a click", fmt("largest step %.3f", step));

    // the commands, and the settings saved as them
    std::string reply = c.run("drive 90");
    check(reply == "drive 90", "a command sets a control", reply);
    reply = c.run("drive 400");
    check(reply == "drive 127", "and holds it to its range", reply);
    check(c.run("drive loud").find("0 to 127") != std::string::npos, "and says what it takes when it can't");

    // each control lands in the PCD's own units: 0 to 1, or -1 to 1
    {
        Pedal fresh;
        Commands f(fresh);
        for (const char* line : { "drive 127", "shape 0", "tone 25", "push-tone -40", "push-drive 63.5", "mix 80", "level -6" })
            f.run(line);
        const auto& s = fresh.settings().pcd;
        const bool right = s.drive == 1.0f && s.shape == 0.0f && std::fabs(s.tone - 0.25f) < 1e-6f
                        && std::fabs(s.toneAmount + 0.4f) < 1e-6f && std::fabs(s.driveAmount - 0.5f) < 1e-6f
                        && std::fabs(s.mix - 0.8f) < 1e-6f && s.level == -6.0f;
        check(right, "each control is set in the PCD's own units",
              fmt("drive %.2f tone %.2f push-tone %.2f push-drive %.2f mix %.2f", s.drive, s.tone, s.toneAmount, s.driveAmount, s.mix));
        const pcd::Settings defaults;
        check(Commands(fresh).run("push-fdbk") == "push-fdbk 0" && defaults.toneAmount == 0.0f,
              "and a control at its default reads as it", Pedal().settings().pcd.toneAmount == 0.0f ? "" : "push-tone off");
    }
    reply = c.run("pattern 9");
    check(reply == "pattern 9" && p.settings().pcd.pattern == 8, "patterns count from 1", reply);
    check(c.run("frobnicate").rfind("no such", 0) == 0, "an unknown command is said to be");

    c.run("mode pick");
    c.run("sens 70");
    c.run("push-tone -40");
    const std::string saved = c.save();

    Pedal q;
    Commands d(q);
    const int failed = d.load(saved);
    check(failed == 0 && d.save() == saved, "saved settings read back as they were",
          fmt("%d lines failed", failed));
}

//============================================================================== the bench

static void bench()
{
    std::printf("\nHOW MUCH OF ONE CORE\n");

    // a minute of a riff, picked, through the pedal with everything working: the feedback, the
    // pattern pushing all three, the pick detector - in the blocks a pedal runs at
    const auto riff = guitar({ { 0.0, 82.4, 0.5f }, { 0.25, 110.0, 0.4f }, { 0.5, 146.8, 0.5f }, { 0.75, 98.0, 0.4f } }, 1.0);
    for (Mode mode : { Mode::Tap, Mode::Pick })
        for (int block : { 32, 64, 128 })
        {
            Pedal p;
            Settings s;
            s.mode = mode;
            s.pcd.feedback = 0.4f;
            s.pcd.toneAmount = 0.5f;
            s.pcd.feedbackAmount = 0.3f;
            s.pcd.shape = 0.4f;
            p.setSettings(s);
            p.prepare(fs, block);

            std::vector<float> out((size_t) block);
            const int seconds = 60;
            const auto t0 = std::chrono::steady_clock::now();
            for (int sec = 0; sec < seconds; ++sec)
                for (size_t at = 0; at + (size_t) block <= riff.size(); at += (size_t) block)
                    p.process(riff.data() + at, out.data(), block, sec + (double) at / fs);
            const double took = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
            std::printf("      %-4s at %3d samples a block: %5.2f%% of one core\n",
                        mode == Mode::Tap ? "TAP" : "PICK", block, 100.0 * took / seconds);
        }
}

int main(int argc, char** argv)
{
    std::printf("MzPedal's checks\n");
    tapTempo();
    midiClock();
    pick();
    bypassAndCommands();

    if (argc > 1 && std::strcmp(argv[1], "--bench") == 0) bench();

    std::printf("\n%s\n", failures == 0 ? "all checks passed" : fmt("%d FAILED", failures).c_str());
    return failures == 0 ? 0 : 1;
}
