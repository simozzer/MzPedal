cmake_minimum_required(VERSION 3.22)

project(MzPedal VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

#
# The effect is MzPCD's, and its patterns and clock MzPCF's, each compiled from its own
# repository beside this one, as JUCE is - so the pedal, the plugin and MzDebirth's rack are
# one and the same sound. Override with -DJUCE_PATH=, -DMZPCD_PATH= or -DMZPCF_PATH=.
#
set(JUCE_PATH  "${CMAKE_CURRENT_SOURCE_DIR}/../JUCE"  CACHE PATH "Where JUCE is checked out")
set(MZPCD_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../MzPCD" CACHE PATH "Where MzPCD is checked out")
set(MZPCF_PATH "${CMAKE_CURRENT_SOURCE_DIR}/../MzPCF" CACHE PATH "Where MzPCF is checked out")

foreach(repo MZPCD MZPCF)
    if(NOT EXISTS "${${repo}_PATH}/Source")
        message(FATAL_ERROR "No ${repo} at ${${repo}_PATH} - clone it beside this repository, or pass -D${repo}_PATH=")
    endif()
endforeach()

set(ENGINE_SOURCES
    Source/Pedal/Pedal.cpp
    Source/Pedal/Clock.cpp
    Source/Pedal/Onset.cpp
    Source/Pedal/Commands.cpp
    "${MZPCD_PATH}/Source/PCD/Pcd.cpp"
    "${MZPCF_PATH}/Source/PCF/Pcf.cpp")

set(ENGINE_INCLUDES Source "${MZPCD_PATH}/Source/PCD" "${MZPCF_PATH}/Source")

#
# The checks, and the benchmark: no JUCE and no sound card, so they run anywhere - on the
# build machine, and on the Pi itself (PedalCheck --bench).
#
add_executable(PedalCheck Tests/PedalCheck.cpp ${ENGINE_SOURCES})
target_include_directories(PedalCheck PRIVATE ${ENGINE_INCLUDES})
if(MSVC)
    target_compile_options(PedalCheck PRIVATE /W4)
else()
    target_compile_options(PedalCheck PRIVATE -Wall -Wextra)
endif()

enable_testing()
add_test(NAME pedal COMMAND PedalCheck)

#
# The program: a JUCE console app, no window - the sound card and MIDI through JUCE (ALSA on
# Linux), nothing of its GUI, so it needs no X11 and runs on Raspberry Pi OS Lite.
#
option(PEDAL_APP "Build the program, as well as the checks (needs JUCE)" ON)

if(PEDAL_APP)
    if(NOT EXISTS "${JUCE_PATH}/CMakeLists.txt")
        message(FATAL_ERROR "No JUCE at ${JUCE_PATH} - clone it beside this repository, or pass -DJUCE_PATH=")
    endif()
    add_subdirectory("${JUCE_PATH}" JUCE)

    juce_add_console_app(MzPedal
        PRODUCT_NAME "mzpedal"
        COMPANY_NAME "simozzer"
        VERSION      "${PROJECT_VERSION}")

    set_target_properties(MzPedal PROPERTIES OUTPUT_NAME "mzpedal")   # the name it is run by
    target_sources(MzPedal PRIVATE Source/Main.cpp ${ENGINE_SOURCES})
    target_include_directories(MzPedal PRIVATE ${ENGINE_INCLUDES})

    target_compile_definitions(MzPedal PRIVATE
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
        JUCE_JACK=0
        JUCE_DISPLAY_SPLASH_SCREEN=0
        MZPEDAL_VERSION="${PROJECT_VERSION}")

    target_link_libraries(MzPedal
        PRIVATE
            juce::juce_audio_devices
        PUBLIC
            juce::juce_recommended_config_flags
            juce::juce_recommended_lto_flags
            juce::juce_recommended_warning_flags)
endif()
