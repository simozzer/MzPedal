// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.

#include "Commands.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <functional>
#include <sstream>
#include <vector>

namespace pedal
{

namespace
{
    //
    // A control: its name, its range in the panel's units, and how those map to the settings.
    //
    struct Control
    {
        const char* name;
        const char* help;
        float lo, hi;
        std::function<float(const Settings&)> get;
        std::function<void(Settings&, float)> set;
    };

    const std::vector<Control>& controls()
    {
        using S = Settings;
        // a control the PCD keeps as a number `scale` times smaller than the panel shows it:
        // ReBirth's 0 to 127 kept as 0 to 1, a percentage as a fraction
        auto control = [] (const char* name, const char* help, float lo, float hi, float pcd::Settings::*f, float scale)
        {
            return Control { name, help, lo, hi,
                             [f, scale] (const S& s) { return s.pcd.*f * scale; },
                             [f, scale] (S& s, float v) { s.pcd.*f = v / scale; } };
        };

        static const std::vector<Control> table = {
            { "pattern", "which of the 32 patterns, 1 to 32", 1, 32,
              [] (const S& s) { return (float) s.pcd.pattern + 1; },
              [] (S& s, float v) { s.pcd.pattern = (int) std::lround(v) - 1; } },
            { "rate", "a step's length: 8, 16 or 32 (an eighth, sixteenth or thirty-second)", 8, 32,
              [] (const S& s) { return s.pcd.rate == pcd::Rate::Eighth ? 8.0f : s.pcd.rate == pcd::Rate::ThirtySecond ? 32.0f : 16.0f; },
              [] (S& s, float v) { s.pcd.rate = v < 12 ? pcd::Rate::Eighth : v < 24 ? pcd::Rate::Sixteenth : pcd::Rate::ThirtySecond; } },

            control("drive", "ReBirth's AMOUNT, 0 to 127", 0, 127, &pcd::Settings::drive, 127),
            control("shape", "ReBirth's SHAPE, 0 to 127: 0 a hard clip", 0, 127, &pcd::Settings::shape, 127),
            control("tone", "dark to bright, 0 to 100", 0, 100, &pcd::Settings::tone, 100),
            control("fdbk", "feedback, 0 to 100", 0, 100, &pcd::Settings::feedback, 100),

            control("push-drive", "how far a step pushes the drive, 0 to 127", 0, 127, &pcd::Settings::driveAmount, 127),
            control("push-tone", "how far a step moves the tone, -100 to 100", -100, 100, &pcd::Settings::toneAmount, 100),
            control("push-fdbk", "how far a step pushes the feedback, 0 to 100", 0, 100, &pcd::Settings::feedbackAmount, 100),
            control("decay", "how fast a step's push dies away, 0 (15 ms) to 100 (1.5 s)", 0, 100, &pcd::Settings::decay, 100),

            control("mix", "dry to all through the effect, 0 to 100", 0, 100, &pcd::Settings::mix, 100),
            { "level", "output, -24 to +12 dB", -24, 12,
              [] (const S& s) { return s.pcd.level; },
              [] (S& s, float v) { s.pcd.level = v; } },

            { "bpm", "TAP's tempo, 30 to 300", (float) TapClock::minBpm, (float) TapClock::maxBpm,
              [] (const S& s) { return s.bpm; },
              [] (S& s, float v) { s.bpm = v; } },
            { "sens", "how small a pick PICK hears, 0 to 100", 0, 100,
              [] (const S& s) { return s.sensitivity * 100.0f; },
              [] (S& s, float v) { s.sensitivity = v / 100.0f; } },
        };
        return table;
    }

    const char* modeName(Mode m) { return m == Mode::Midi ? "midi" : m == Mode::Pick ? "pick" : "tap"; }

    std::string number(float v)
    {
        char text[32];
        std::snprintf(text, sizeof text, "%g", std::round(v * 100.0f) / 100.0f);
        return text;
    }

    std::vector<std::string> words(const std::string& line)
    {
        std::vector<std::string> w;
        std::istringstream in(line.substr(0, line.find('#')));   // # starts a comment
        for (std::string s; in >> s;)
        {
            std::transform(s.begin(), s.end(), s.begin(), [] (unsigned char c) { return (char) std::tolower(c); });
            w.push_back(s);
        }
        return w;
    }
}

std::string Commands::run(const std::string& line)
{
    const auto w = words(line);
    if (w.empty()) return {};
    const std::string& what = w[0];
    const std::string value = w.size() > 1 ? w[1] : std::string();

    if (what == "help") return help();
    if (what == "tap")   { pedal.tap();   return "tap"; }
    if (what == "start") { pedal.start(); return "from the first step"; }
    if (what == "stop")  { pedal.stop();  return "stopped"; }

    Settings s = pedal.settings();

    if (what == "show")
    {
        std::string out;
        for (const auto& c : controls()) out += std::string(c.name) + " " + number(c.get(s)) + "\n";
        out += std::string("mode ") + modeName(s.mode) + "\n";
        out += std::string("bypass ") + (s.bypass ? "on" : "off") + "\n";
        out += "step " + (pedal.step() < 0 ? std::string("-") : std::to_string(pedal.step() + 1));
        if (s.mode != Mode::Pick) out += "   tempo " + number((float) pedal.bpm());
        return out;
    }

    if (what == "mode")
    {
        if (value == "tap") s.mode = Mode::Tap;
        else if (value == "midi") s.mode = Mode::Midi;
        else if (value == "pick") s.mode = Mode::Pick;
        else return "mode: tap, midi or pick";
        pedal.setSettings(s);
        return std::string("mode ") + modeName(s.mode);
    }

    if (what == "bypass")
    {
        if (value == "on") s.bypass = true;
        else if (value == "off") s.bypass = false;
        else if (value.empty() || value == "toggle") s.bypass = ! s.bypass;
        else return "bypass: on, off or toggle";
        pedal.setSettings(s);
        return std::string("bypass ") + (s.bypass ? "on" : "off");
    }

    for (const auto& c : controls())
    {
        if (what != c.name) continue;
        if (value.empty()) return std::string(c.name) + " " + number(c.get(s));

        char* end = nullptr;
        const float v = std::strtof(value.c_str(), &end);
        if (end == value.c_str() || *end != '\0' || ! std::isfinite(v))
            return std::string(c.name) + ": " + c.help;

        c.set(s, std::clamp(v, c.lo, c.hi));
        pedal.setSettings(s);
        return std::string(c.name) + " " + number(c.get(s));
    }

    return "no such command: " + what + " (help lists them)";
}

std::string Commands::save() const
{
    const Settings s = pedal.settings();
    std::string out = "# MzPedal's settings: each line a command, as typed at the pedal\n";
    for (const auto& c : controls()) out += std::string(c.name) + " " + number(c.get(s)) + "\n";
    out += std::string("mode ") + modeName(s.mode) + "\n";
    out += std::string("bypass ") + (s.bypass ? "on" : "off") + "\n";
    return out;
}

int Commands::load(const std::string& text)
{
    int failed = 0;
    std::istringstream in(text);
    for (std::string line; std::getline(in, line);)
    {
        const auto w = words(line);
        if (w.empty()) continue;
        const std::string reply = run(line);
        if (reply.rfind("no such", 0) == 0 || reply.find(": ") != std::string::npos) ++failed;
    }
    return failed;
}

std::string Commands::help()
{
    std::string out = "Each control, then a value - or alone, to show it:\n";
    for (const auto& c : controls())
    {
        char line[160];
        std::snprintf(line, sizeof line, "  %-11s %s\n", c.name, c.help);
        out += line;
    }
    out += "  mode        what steps the pattern on: tap, midi or pick\n"
           "  bypass      on, off or toggle\n"
           "And:\n"
           "  tap         a tap of the tempo\n"
           "  start/stop  TAP: the pattern from its first step, or still\n"
           "  show        everything, the step playing and the tempo\n"
           "  status      the sound card, the CPU it takes and any dropouts\n"
           "  save        save the settings now (they save themselves too)\n"
           "  quit";
    return out;
}

} // namespace pedal
