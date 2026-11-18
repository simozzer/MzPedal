#!/bin/sh
#
# MzPedal: installs the program and starts it at boot, as a service.
#
#   sudo ./install.sh              install, and start it
#   sudo ./install.sh --remove     stop it, and take it all away (the settings are kept)
#
# Run from the unpacked folder, on 64-bit Raspberry Pi OS (Bookworm or later).
#
set -e

here=$(cd "$(dirname "$0")" && pwd)

if [ "$(id -u)" -ne 0 ]; then
    echo "Run it with sudo:  sudo ./install.sh"
    exit 1
fi

user=${SUDO_USER:-$(logname 2>/dev/null || echo root)}

if [ "$1" = "--remove" ]; then
    systemctl disable --now mzpedal 2>/dev/null || true
    rm -f /etc/systemd/system/mzpedal.service /usr/local/bin/mzpedal /usr/local/bin/PedalCheck
    systemctl daemon-reload
    echo "Removed. /etc/default/mzpedal and the settings in ~$user/.config/MzPedal are left."
    exit 0
fi

install -m 0755 "$here/mzpedal" /usr/local/bin/mzpedal
install -m 0755 "$here/PedalCheck" /usr/local/bin/PedalCheck

# the sound card and block size: kept if already there, so a reinstall does not lose them
[ -f /etc/default/mzpedal ] || install -m 0644 "$here/mzpedal.default" /etc/default/mzpedal

sed "s/@USER@/$user/" "$here/mzpedal.service" > /etc/systemd/system/mzpedal.service
usermod -a -G audio "$user"

systemctl daemon-reload
systemctl enable --now mzpedal
systemctl restart mzpedal

echo
echo "MzPedal is running, and will start at every boot, as $user."
echo "  what it says:         journalctl -u mzpedal -f"
echo "  a command:            echo status > /run/mzpedal/control"
echo "  the sound card:       sudo nano /etc/default/mzpedal, then sudo systemctl restart mzpedal"
echo "  the sound cards:      mzpedal --list"
