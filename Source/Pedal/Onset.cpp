// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.

#include "Onset.h"

#include <algorithm>
#include <cmath>

namespace pedal
{

namespace
{
    float coef(double seconds, double fs) { return (float) (1.0 - std::exp(-1.0 / (seconds * fs))); }
}

void Onset::prepare(double sampleRate)
{
    fs = sampleRate > 0.0 ? sampleRate : 48000.0;
    hpCoef = (float) std::exp(-2.0 * 3.14159265358979 * 1500.0 / fs);
    attack = coef(0.0003, fs);
    release = coef(0.010, fs);
    lookBack = std::clamp((int) std::lround(0.005 * fs), 1, historyLength - 1);
    holdoff = (int) std::lround(0.050 * fs);
    reset();
}

void Onset::reset()
{
    hp1X = hp1Y = hp2X = hp2Y = level = 0.0f;
    history.fill(0.0f);
    at = 0;
    since = holdoff;
}

void Onset::setSensitivity(float s)
{
    s = std::clamp(s, 0.0f, 1.0f);
    ratio = 3.0f - 1.5f * s;                                  // a leap of 9.5 dB down to 3.5 dB
    floor = std::pow(10.0f, (-36.0f - 24.0f * s) / 20.0f);   // -36 dBFS down to -60
}

bool Onset::next(float x)
{
    // the top end: two one-pole high-passes at 1.5 kHz
    const float a = hpCoef * (hp1Y + x - hp1X);
    hp1X = x;
    hp1Y = a;
    const float b = hpCoef * (hp2Y + a - hp2X);
    hp2X = a;
    hp2Y = b;

    // how loud it is, quick to rise and quick to fall
    const float r = std::fabs(b);
    level += (r - level) * (r > level ? attack : release);

    // and how loud it was 5 ms ago
    const float before = history[(size_t) ((at - lookBack + historyLength) % historyLength)];
    history[(size_t) at] = level;
    at = (at + 1) % historyLength;

    if (since < holdoff) { ++since; return false; }
    if (level > floor && level > before * ratio)
    {
        since = 0;
        return true;
    }
    return false;
}

} // namespace pedal
