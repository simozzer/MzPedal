// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.

#pragma once

#include "Pedal.h"

#include <string>

namespace pedal
{

//
// The pedal, in words: one command a line, each a control and its value in the units the
// plugin's panel shows, or something to do.
//
//     drive 90        shape 40        pattern 9       mode pick
//     tap             bypass toggle   show            help
//
// A terminal types them; the knobs and footswitches will send the same; and the settings are
// saved as them, one control a line, so a saved file is read back by running it.
//
class Commands
{
public:
    explicit Commands(Pedal& p) : pedal(p) {}

    // runs one line, and says what it did - or why it could not
    std::string run(const std::string& line);

    // every control as a line to set it, to save
    std::string save() const;

    // runs each line of saved settings; how many would not run
    int load(const std::string& text);

    static std::string help();

private:
    Pedal& pedal;
};

} // namespace pedal
