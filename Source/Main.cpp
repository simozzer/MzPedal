// MzPedal - Created by Simon Moscrop
// Free software under the GNU AGPL v3; see LICENSE.
//
// The pedal's program: no window, the sound card's input through the PCD and out again, the
// pattern stepped on by a tap, a MIDI clock or the pick. It is driven by commands, one a line,
// typed at it - or, on the pedal, sent by its knobs and footswitches - and keeps its settings
// itself, so it comes back as it was however the power goes.
//
//     mzpedal --list                     the sound cards and MIDI inputs
//     mzpedal [--device <part of its name>] [--rate 48000] [--buffer 64] [--input 1]
//                 [--midi all|none|<part of a name>] [--settings <file>] [--control <pipe>]
//

#include <juce_audio_devices/juce_audio_devices.h>

#include "Pedal/Commands.h"
#include "Pedal/Pedal.h"

#include <algorithm>
#include <atomic>
#include <csignal>
#include <fstream>
#include <iostream>
#include <map>
#include <mutex>
#include <thread>

#if JUCE_LINUX
 #include <pthread.h>
 #include <sched.h>
 #include <sys/mman.h>
 #include <sys/stat.h>
 #include <unistd.h>
#endif

namespace
{
std::atomic<bool> quitWanted { false };
void onSignal(int) { quitWanted = true; }

std::mutex printing;
void say(const juce::String& s)
{
    const std::lock_guard<std::mutex> hold(printing);
    std::cout << s << std::endl;
}

struct Options
{
    juce::String device, type, midi = "all", control;   // control: a named pipe to take commands from
    double rate = 48000.0;
    int buffer = 64;
    int input = 0;   // which input the guitar is on, from 0
    bool list = false, help = false;
    juce::File settings = juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
                              .getChildFile("MzPedal").getChildFile("settings.txt");
};

Options parse(int argc, char* argv[])
{
    Options o;
    for (int i = 1; i < argc; ++i)
    {
        const juce::String a(argv[i]);
        const bool more = i + 1 < argc;
        if (a == "--list") o.list = true;
        else if (a == "--help" || a == "-h") o.help = true;
        else if (a == "--device" && more) o.device = argv[++i];
        else if (a == "--type" && more) o.type = argv[++i];
        else if (a == "--rate" && more) o.rate = juce::String(argv[++i]).getDoubleValue();
        else if (a == "--buffer" && more) o.buffer = juce::String(argv[++i]).getIntValue();
        else if (a == "--input" && more) o.input = juce::jmax(0, juce::String(argv[++i]).getIntValue() - 1);
        else if (a == "--midi" && more) o.midi = argv[++i];
        else if (a == "--control" && more) o.control = argv[++i];
        else if (a == "--settings" && more) o.settings = juce::File::getCurrentWorkingDirectory().getChildFile(argv[++i]);
        else { say("not understood: " + a + " (--help says what is)"); o.help = true; }
    }
    return o;
}

const char* usage =
    "MzPedal: MzPCD as a guitar pedal.\n"
    "\n"
    "  --list               the sound cards and MIDI inputs, then stop\n"
    "  --device <name>      the sound card, by any part of its name (default: the system's)\n"
    "  --type <name>        its kind: ALSA on Linux, Windows Audio or ASIO on Windows\n"
    "  --rate <hz>          the sample rate (48000)\n"
    "  --buffer <samples>   the block size: smaller is less delay, if the Pi keeps up (64)\n"
    "  --input <n>          which input the guitar is on, from 1 (1)\n"
    "  --midi <which>       MIDI inputs for the clock: all, none or part of a name (all)\n"
    "  --settings <file>    where the settings are kept\n"
    "  --control <pipe>     Linux: commands from a named pipe too, for the service\n"
    "\n"
    "Then type commands, one a line; help lists them.";

//
// The sound card's callback: the guitar in, the pedal, and the same out of every output.
//
class Audio final : public juce::AudioIODeviceCallback
{
public:
    Audio(pedal::Pedal& p, int in) : pedal(p), input(in) {}

    std::atomic<int> realtime { -1 };   // whether the audio thread got real-time priority: -1 not yet asked

    void audioDeviceAboutToStart(juce::AudioIODevice* d) override
    {
        const int block = juce::jmax(d->getCurrentBufferSizeSamples(), 64);
        silence.assign((size_t) juce::jmax(block, 4096), 0.0f);
        pedal.prepare(d->getCurrentSampleRate(), block);
        asked = false;
    }

    void audioDeviceStopped() override {}

    void audioDeviceIOCallbackWithContext(const float* const* in, int numIn, float* const* out, int numOut,
                                          int n, const juce::AudioIODeviceCallbackContext&) override
    {
        if (! asked) raisePriority();
        if (numOut < 1 || out[0] == nullptr) return;

        const float* guitar = input < numIn && in[input] != nullptr ? in[input] : nullptr;
        if (guitar == nullptr || (size_t) n > silence.size())
        {
            for (int c = 0; c < numOut; ++c)
                if (out[c] != nullptr) juce::FloatVectorOperations::clear(out[c], n);
            if (guitar == nullptr && (size_t) n <= silence.size()) guitar = silence.data();
            else return;
        }

        pedal.process(guitar, out[0], n, juce::Time::getMillisecondCounterHiRes() * 0.001);
        for (int c = 1; c < numOut; ++c)
            if (out[c] != nullptr) juce::FloatVectorOperations::copy(out[c], out[0], n);
    }

private:
    // On Linux, the audio thread to real-time - JUCE asks only for high. Done once, from the
    // thread itself. It needs the right to (LimitRTPRIO in the service, or rtprio in limits.conf).
    void raisePriority()
    {
        asked = true;
       #if JUCE_LINUX
        sched_param p {};
        p.sched_priority = 80;
        realtime = pthread_setschedparam(pthread_self(), SCHED_FIFO, &p) == 0 ? 1 : 0;
       #else
        realtime = 1;   // left to the system's own audio
       #endif
    }

    pedal::Pedal& pedal;
    int input;
    bool asked = false;
    std::vector<float> silence;
};

//
// MIDI in: the clock's messages, timed as they arrive. Every input there is is listened to,
// or those named, and one plugged in later is found within a couple of seconds.
//
class Midi final : public juce::MidiInputCallback
{
public:
    Midi(pedal::Pedal& p, juce::String which) : pedal(p), filter(std::move(which)) {}

    void refresh()
    {
        if (filter == "none") return;
        const auto available = juce::MidiInput::getAvailableDevices();

        for (const auto& d : available)
        {
            if (open.count(d.identifier) != 0) continue;
            if (filter != "all" && ! d.name.containsIgnoreCase(filter)) continue;
            if (d.name.containsIgnoreCase("Midi Through")) continue;   // ALSA's loopback, never a clock
            if (auto m = juce::MidiInput::openDevice(d.identifier, this))
            {
                m->start();
                say("MIDI in: " + d.name);
                open[d.identifier] = std::move(m);
            }
        }

        for (auto it = open.begin(); it != open.end();)
        {
            const bool there = std::any_of(available.begin(), available.end(),
                                           [&it] (const auto& d) { return d.identifier == it->first; });
            if (there) { ++it; continue; }
            say("MIDI in gone: " + it->second->getName());
            it = open.erase(it);
        }
    }

    void handleIncomingMidiMessage(juce::MidiInput*, const juce::MidiMessage& m) override
    {
        pedal.midi(m.getRawData(), m.getRawDataSize(), m.getTimeStamp());
    }

private:
    pedal::Pedal& pedal;
    juce::String filter;
    std::map<juce::String, std::unique_ptr<juce::MidiInput>> open;
};

//
// The message thread's chores, a few times a second: stopping when asked, finding MIDI inputs,
// saving the settings once they have stopped changing, and the status line kept up to date.
//
class Chores final : public juce::Timer
{
public:
    Chores(pedal::Pedal& p, pedal::Commands& c, juce::AudioDeviceManager& d, Audio& a, Midi& m, juce::File f)
        : pedal(p), commands(c), devices(d), audio(a), midi(m), file(std::move(f)), saved(p.revision())
    {
        midi.refresh();
        updateStatus();
        startTimer(250);
    }

    juce::String status() const
    {
        const std::lock_guard<std::mutex> hold(statusLock);
        return statusLine;
    }

    void saveNow()
    {
        file.getParentDirectory().createDirectory();
        // written to a file beside it and moved over it, so a power cut leaves one or the other
        if (! file.replaceWithText(commands.save()))
            say("could not save the settings to " + file.getFullPathName());
        saved = pedal.revision();
    }

    void timerCallback() override
    {
        if (quitWanted.load())
        {
            juce::MessageManager::getInstance()->stopDispatchLoop();
            return;
        }

        if (++ticks % 8 == 0) midi.refresh();

        // saved a second after the last change, so turning a knob is not a stream of writes to the card
        const unsigned now = pedal.revision();
        if (now != lastSeen) { lastSeen = now; quietFor = 0; }
        else if (now != saved && ++quietFor >= 4) saveNow();

        updateStatus();
    }

private:
    void updateStatus()
    {
        juce::String s;
        if (auto* d = devices.getCurrentAudioDevice())
        {
            const double rate = d->getCurrentSampleRate();
            const int through = d->getInputLatencyInSamples() + d->getOutputLatencyInSamples() + pedal::Pedal::latency();
            s << d->getTypeName() << ": " << d->getName() << ", " << juce::String(rate / 1000.0, 1) << " kHz, "
              << d->getCurrentBufferSizeSamples() << " samples a block\n"
              << "delay through it about " << juce::String(1000.0 * through / rate, 1) << " ms; "
              << "CPU " << juce::String(devices.getCpuUsage() * 100.0, 1) << "%; "
              << "dropouts " << juce::String(juce::jmax(0, d->getXRunCount())) << "; "
              << "real-time " << (audio.realtime.load() > 0 ? "yes" : audio.realtime.load() == 0 ? "NO (see the README)" : "-");
        }
        else s = "no sound card open";

        const std::lock_guard<std::mutex> hold(statusLock);
        statusLine = s;
    }

    pedal::Pedal& pedal;
    pedal::Commands& commands;
    juce::AudioDeviceManager& devices;
    Audio& audio;
    Midi& midi;
    juce::File file;
    unsigned saved, lastSeen = 0;
    int quietFor = 0, ticks = 0;
    mutable std::mutex statusLock;
    juce::String statusLine;
};

void list(juce::AudioDeviceManager& devices)
{
    for (auto* type : devices.getAvailableDeviceTypes())
    {
        type->scanForDevices();
        say(type->getTypeName() + ":");
        for (const auto& n : type->getDeviceNames(true))  say("  in   " + n);
        for (const auto& n : type->getDeviceNames(false)) say("  out  " + n);
    }
    say("MIDI inputs:");
    for (const auto& d : juce::MidiInput::getAvailableDevices()) say("  " + d.name);
}
} // namespace

int main(int argc, char* argv[])
{
    const Options o = parse(argc, argv);
    if (o.help) { say(usage); return 0; }

    juce::MessageManager::getInstance();
    juce::AudioDeviceManager devices;

    if (o.list)
    {
        list(devices);
        juce::MessageManager::deleteInstance();
        return 0;
    }

   #if JUCE_LINUX
    // kept in memory, so a page coming back from the card never holds up the sound
    if (mlockall(MCL_CURRENT | MCL_FUTURE) != 0) say("could not lock the program into memory (LimitMEMLOCK)");
   #endif

    pedal::Pedal pedal;
    pedal::Commands commands(pedal);
    if (o.settings.existsAsFile())
    {
        const int failed = commands.load(o.settings.loadFileAsString().toStdString());
        say("settings from " + o.settings.getFullPathName() + (failed > 0 ? " (" + juce::String(failed) + " lines not understood)" : ""));
    }

    if (o.type.isNotEmpty()) devices.setCurrentAudioDeviceType(o.type, false);

    // the sound card by any part of its name - ALSA's are long - the first that has it; its
    // inputs and outputs found apart, as Windows names them apart
    juce::String inName = o.device, outName = o.device;
    if (o.device.isNotEmpty())
    {
        if (devices.getCurrentDeviceTypeObject() == nullptr && ! devices.getAvailableDeviceTypes().isEmpty())
            devices.setCurrentAudioDeviceType(devices.getAvailableDeviceTypes()[0]->getTypeName(), false);
        if (auto* type = devices.getCurrentDeviceTypeObject())
        {
            type->scanForDevices();
            auto match = [&o] (const juce::StringArray& names)
            {
                if (names.contains(o.device)) return o.device;
                for (const auto& n : names)
                    if (n.containsIgnoreCase(o.device)) return n;
                return o.device;
            };
            inName = match(type->getDeviceNames(true));
            outName = match(type->getDeviceNames(false));
        }
    }

    juce::AudioDeviceManager::AudioDeviceSetup want;
    want.inputDeviceName = inName;
    want.outputDeviceName = outName;
    want.sampleRate = o.rate;
    want.bufferSize = o.buffer;
    want.useDefaultInputChannels = false;
    want.inputChannels.setBit(o.input);
    want.useDefaultOutputChannels = true;

    const auto error = devices.initialise(o.input + 1, 2, nullptr, true, outName, &want);
    if (error.isNotEmpty())
    {
        say("no sound card: " + error);
        juce::MessageManager::deleteInstance();
        return 1;
    }

    Audio audio(pedal, o.input);
    Midi midi(pedal, o.midi);
    devices.addAudioCallback(&audio);

    std::signal(SIGINT, onSignal);
    std::signal(SIGTERM, onSignal);

    {
        Chores chores(pedal, commands, devices, audio, midi, o.settings);

        if (auto* d = devices.getCurrentAudioDevice())
            say("MzPedal on " + d->getName() + " - type help for the commands");

        // a command, from wherever it came; false once it is quit
        auto handle = [&commands, &chores] (const std::string& line)
        {
            const auto w = juce::String(line).trim().toLowerCase();
            if (w == "quit" || w == "exit") { quitWanted = true; return false; }
            if (w == "status") say(chores.status());
            else if (w == "save")
            {
                juce::MessageManager::callAsync([&chores] { chores.saveNow(); });
                say("saved");
            }
            else if (const auto reply = commands.run(line); ! reply.empty()) say(reply);
            return true;
        };

        // from whoever is at the terminal; under the service there is nobody, and this simply ends
        std::thread([handle]
        {
            for (std::string line; std::getline(std::cin, line);)
                if (! handle(line)) return;
        }).detach();

       #if JUCE_LINUX
        // and from a named pipe, for the pedal running as a service: echo drive 100 > it. Each
        // writer's lines are run, then it waits for the next; the replies go to the journal.
        if (o.control.isNotEmpty())
        {
            const auto path = o.control.toStdString();
            ::unlink(path.c_str());
            if (::mkfifo(path.c_str(), 0660) != 0) say("could not make the control pipe " + o.control);
            else
            {
                say("commands also from " + o.control);
                std::thread([handle, path]
                {
                    for (;;)
                    {
                        std::ifstream pipe(path);   // waits here for a writer
                        for (std::string line; std::getline(pipe, line);)
                            if (! handle(line)) return;
                    }
                }).detach();
            }
        }
       #endif

        juce::MessageManager::getInstance()->runDispatchLoop();

        devices.removeAudioCallback(&audio);
        chores.saveNow();
    }

    devices.closeAudioDevice();
    juce::MessageManager::deleteInstance();
    std::_Exit(0);   // the terminal's thread may still be waiting on a line that will never come
}
