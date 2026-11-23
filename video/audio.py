#!/usr/bin/env python3
"""Narration and a quiet score for the Confidant demo, plus timeline.js (scene times, captions) and mix.json.

usage: python3 -I audio.py WORK_DIR [--engine elevenlabs|say]

Lines play one after another; each line opens its scene, so the pictures follow the narration.
elevenlabs: the voice in demo.json. The key comes from ELEVENLABS_API_KEY, video/.env, or ~/sealr/assets/video/.env,
  and is never printed. Replies are cached in ~/.cache/confidant-video, so re-renders spend no credits.
say: a macOS voice, for drafts.
"""
import argparse
import hashlib
import json
import math
import os
import re
import socket
import struct
import subprocess
import urllib.error
import urllib.request
import wave
from pathlib import Path

# Some networks' resolver fails for hosts that public DNS answers; fall back to asking 1.1.1.1 directly
# (the same fallback as src/http.mjs in the app).
_getaddrinfo = socket.getaddrinfo


def _fallback_getaddrinfo(host, *args, **kw):
    try:
        return _getaddrinfo(host, *args, **kw)
    except socket.gaierror:
        out = subprocess.run(["dig", "+short", host, "@1.1.1.1"], capture_output=True, text=True).stdout.split()
        ip = next((a for a in out if re.fullmatch(r"[0-9.]+", a)), None)
        if not ip:
            raise
        return _getaddrinfo(ip, *args, **kw)


socket.getaddrinfo = _fallback_getaddrinfo

HERE = Path(__file__).resolve().parent
CACHE = Path.home() / ".cache" / "confidant-video"
RATE = 22050


def load_key():
    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"].strip()
    for env in (HERE / ".env", Path.home() / "sealr" / "assets" / "video" / ".env"):
        if env.exists():
            for line in env.read_text().splitlines():
                name, _, value = line.partition("=")
                if name.strip() == "ELEVENLABS_API_KEY" and value.strip():
                    return value.strip().strip("'\"")
    raise SystemExit("no ELEVENLABS_API_KEY")


def tts(text, voice, key):
    body = {"text": text, "model_id": voice["model_id"], "voice_settings": voice["settings"]}
    path = "/v1/text-to-speech/%s?output_format=mp3_44100_128" % voice["elevenlabs_voice_id"]
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / hashlib.sha256(json.dumps([path, body], sort_keys=True).encode()).hexdigest()[:24]
    if cached.exists():
        return cached.read_bytes()
    req = urllib.request.Request("https://api.elevenlabs.io" + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        raise SystemExit("ElevenLabs HTTP %d: %s" % (e.code, e.read().decode(errors="replace")[:300]))
    cached.write_bytes(data)
    return data


def seconds(path):
    for line in subprocess.run(["afinfo", str(path)], capture_output=True, text=True).stdout.splitlines():
        if "estimated duration" in line:
            return float(line.split(":")[1].split()[0])
    raise RuntimeError(path)


def score(path, length, scenes):
    """A soft warm pad (gold, like the brand), a light pulse once the demo gets going, and small chimes on cuts."""
    n = int(length * RATE)
    buf = [0.0] * n

    def add(start, dur, fn):
        a = int(start * RATE)
        for i in range(int(dur * RATE)):
            if 0 <= a + i < n:
                buf[a + i] += fn(i / RATE)

    chords = [(110, 164.8, 220, 277.2), (98, 146.8, 196, 246.9), (87.3, 130.8, 174.6, 220), (98, 146.8, 196, 293.7)]
    bar = 8.0
    for k in range(int(length / bar) + 1):
        freqs = chords[k % 4]
        def pad(t, freqs=freqs):
            env = min(1.0, t / 2.0, max(0.0, (bar + 2 - t) / 2.0))
            return 0.05 * env * sum(math.sin(2 * math.pi * f * t + .3 * math.sin(t * .4 + j)) for j, f in enumerate(freqs)) / len(freqs)
        add(k * bar, bar + 2, pad)
    start = scenes["question"][0]
    beat = 60 / 84
    t = start
    while t < length - 4:
        add(t, 0.25, lambda x: 0.12 * math.sin(2 * math.pi * (62 - 30 * x) * x) * math.exp(-x * 16))
        add(t + beat / 2, 0.05, lambda x: 0.03 * math.sin(2 * math.pi * 5000 * x) * math.exp(-x * 90))
        t += beat
    for name, (a, _) in scenes.items():
        if a > 0.5:
            add(a, 1.0, lambda x: 0.05 * math.sin(2 * math.pi * 1568 * x) * math.exp(-x * 5) + 0.03 * math.sin(2 * math.pi * 2093 * x) * math.exp(-x * 6))
    fade = int(3 * RATE)
    for i in range(fade):
        buf[n - fade + i] *= 1 - i / fade
    peak = max(abs(x) for x in buf) or 1
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(32767 * 0.8 * x / peak)) for x in buf))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("work")
    ap.add_argument("--engine", choices=["say", "elevenlabs"], default="elevenlabs")
    args = ap.parse_args()
    work = Path(args.work)
    (work / "audio").mkdir(parents=True, exist_ok=True)
    spec = json.loads((HERE / "demo.json").read_text())
    key = load_key() if args.engine == "elevenlabs" else None

    t, lines, clips = spec["lead_in"], [], []
    for line in spec["lines"]:
        text = line.get("speak", line["text"])
        if key:
            clip = work / "audio" / ("%s.mp3" % line["id"])
            clip.write_bytes(tts(text, spec["voice"], key))
        else:
            clip = work / "audio" / ("%s.aiff" % line["id"])
            subprocess.run(["say", "-v", "Samantha", "-r", "170", "-o", str(clip), text], check=True)
        dur = seconds(clip)
        lines.append({"id": line["id"], "scene": line["scene"], "text": line["text"], "start": round(t, 3), "end": round(t + dur, 3)})
        clips.append({"file": str(clip), "start": round(t, 3), "volume": 1.0})
        t += dur + line["gap"]
    length = round(lines[-1]["end"] + spec["tail"], 2)

    scenes, order = {}, []
    for l in lines:
        if l["scene"] not in scenes:
            order.append(l["scene"])
            scenes[l["scene"]] = [l["start"] - 0.3, None]
    for i, name in enumerate(order):
        scenes[name][1] = round(scenes[order[i + 1]][0], 3) if i + 1 < len(order) else length
        scenes[name][0] = max(0.0, round(scenes[name][0], 3)) if i else 0.0

    score(work / "audio" / "score.wav", length, scenes)
    (HERE / "timeline.js").write_text("window.LINES = %s;\nwindow.SCENES = %s;\nwindow.TOTAL = %s;\n" % (json.dumps(lines), json.dumps(scenes), length))
    mix = {"duration": length, "voice": clips, "sfx": [], "voice_ranges": [[l["start"], l["end"]] for l in lines],
           "music": {"file": str(work / "audio" / "score.wav"), "volume": 0.7, "duck_to": 0.35}}
    (work / "mix.json").write_text(json.dumps(mix, indent=1))
    print("%d lines · %d characters · %.1fs" % (len(lines), sum(len(l.get("speak", l["text"])) for l in spec["lines"]), length))
    for name in order:
        print("  %-12s %6.1f – %6.1f" % (name, *scenes[name]))


if __name__ == "__main__":
    main()
