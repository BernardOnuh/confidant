#!/bin/sh
# Build the Confidant demo: narration + score, frames, silent video, final mix.
# usage: ./build.sh WORK_DIR OUT.mp4 [elevenlabs|say]
# Screens in shots/ come from the site running locally (npm run dev) on the recorded rounds.
set -e
cd "$(dirname "$0")"
WORK="$1"; OUT="$2"; ENGINE="${3:-elevenlabs}"
mkdir -p "$WORK"; rm -rf "$WORK/frames"
python3 -I audio.py "$WORK" --engine "$ENGINE"
python3 -I render_frames.py "$WORK/frames" --page demo.html
[ -x "$WORK/encode" ] || swiftc -O encode.swift -o "$WORK/encode" 2>/dev/null
[ -x "$WORK/finish" ] || swiftc -O finish.swift -o "$WORK/finish" 2>/dev/null
"$WORK/encode" "$WORK/frames" "$WORK/silent.mp4" 30
"$WORK/finish" "$WORK/silent.mp4" "$WORK/mix.json" "$OUT"
