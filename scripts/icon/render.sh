#!/bin/sh
# Renders the app icon from scripts/icon/icon.svg into public/ (needs librsvg: brew install librsvg).
# The text uses the Mac's Avenir Next, so render on a Mac.
set -e
cd "$(dirname "$0")/../.."
for s in 512 192 180 48; do rsvg-convert -w $s -h $s scripts/icon/icon.svg -o public/icon-$s.png; done
echo "icons written to public/"
