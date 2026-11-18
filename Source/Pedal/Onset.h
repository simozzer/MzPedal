// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.

#pragma once

#include <array>

namespace pedal
{

//
// STRIKE ON THE PICK. Hears each new note picked, so the pattern can step on with the
// playing rather than with a tempo.
//
// A pick is a click: a burst of top end, and a string's brightest harmonics, which die away
// within a few tens of milliseconds. So it listens above about 300 Hz, where a string still
// ringing has gone quiet and a new pick is loud, and hears a pick as that top end leaping -
// by SENS's ratio within 5 ms. A note swelling in on the volume knob, or wavering with a
// tremolo, rises far slower than that; a thump on the body is mostly below it. After a pick
// it does not listen again for 50 ms.
//
// SENS sets how big a leap is a pick, and how quiet one still counts: 0 hears only a hard
// pick, 1 every note, hammer-ons included.
//
class Onset
{
public:
    void prepare(double sampleRate);
    void reset();
    void setSensitivity(float s);

    // one sample of the dry guitar: whether a pick lands on it
    bool next(float x);

private:
    static constexpr int historyLength = 512;   // enough for 5 ms at up to 96 kHz

    double fs = 48000.0;
    float hpCoef = 0.0f, hp1X = 0.0f, hp1Y = 0.0f, hp2X = 0.0f, hp2Y = 0.0f;
    float attack = 0.0f, release = 0.0f, level = 0.0f;
    std::array<float, historyLength> history {};
    int at = 0, lookBack = 240;
    float ratio = 2.0f, floor = 0.005f;
    int holdoff = 2400, since = 0;
};

} // namespace pedal
