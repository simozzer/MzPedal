<#
    MzPedal - Created by Simon Moscrop
    Free software under the GNU AGPL v3; see LICENSE.

    Build the checks and the program on Windows, to try the pedal at the desk before the Pi.

        .\build.ps1           the checks, then the program
        .\build.ps1 -Bench    and how much of one core the pedal takes

    MzPCD, MzPCF and JUCE are compiled from beside this repository: ..\MzPCD, ..\MzPCF and
    ..\JUCE. The Pi's own build is GitHub's (.github/workflows/linux.yml), or the same cmake
    run on the Pi.
#>
param([switch]$Bench)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) { Write-Error "No Visual Studio found. Install VS Community with 'Desktop development with C++'." }
$vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vsPath) { Write-Error "Visual Studio is installed but the C++ tools are not." }

$cmake = (Get-Command cmake -ErrorAction SilentlyContinue).Source
if (-not $cmake) { $cmake = Join-Path $vsPath "Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe" }
if (-not (Test-Path $cmake)) { Write-Error "No cmake on the PATH and none inside Visual Studio." }

$build = Join-Path $root "build"
if (-not (Test-Path (Join-Path $build "CMakeCache.txt"))) {
    & $cmake -S $root -B $build
    if ($LASTEXITCODE -ne 0) { Write-Error "cmake configure failed" }
}

& $cmake --build $build --config Release -- /m /v:minimal | Where-Object { $_ -match "error|warning C" }
if ($LASTEXITCODE -ne 0) { Write-Error "the build failed" }

$check = Join-Path $build "Release\PedalCheck.exe"
if ($Bench) { & $check --bench } else { & $check }
if ($LASTEXITCODE -ne 0) { Write-Error "the pedal failed its checks" }

Write-Host ""
Write-Host "ok  -  $(Join-Path $build 'MzPedal_artefacts\Release\mzpedal.exe')" -ForegroundColor Green
