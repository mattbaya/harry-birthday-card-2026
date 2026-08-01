# Happy 87th Birthday, Harry! — Boppers-Style Card

A browser-based 3D birthday card built for Harry Baya. It features real wombat models, animated letter cubes, a squad of wombats that dig burrows and steal tiles, confetti physics, and a soundfont-rendered "Happy Birthday" arrangement.

## Live Demo

Play it live at: https://phred.boppers.net/harrys-birthday-2026/

Or open `index.html` in a modern browser (Chrome works best; Brave may need Shields down for WebGL).

## What's Inside

- `index.html` — the full card (Three.js scene, wombat state machines, audio scheduler).
- `audio/` — rendered audio, beat timing, and note events for soundfont playback.
- `models/wombat.stl` — the cute wombat figurine model.
- `lib/` — Three.js r128, the Boppers engine helpers, symbol factory, and STL loader.
- `scripts/generate_happy_birthday_wav.py` — regenerates the music/audio assets.

## Music

The arrangement uses the FluidR3_GM soundfont via `soundfont-player` in the browser:

- Banjo lead
- Violin lead / harmony
- Acoustic bass
- Drum kit (kick, snare, hi-hat)

A silent MP3 fallback is included to drive the visual timing and sound bars.

## Wombat Behaviors

- Wander the floor nose-first.
- Dance to the beat.
- Dig burrows (real sink-in holes).
- Carry letter cubes horizontally in their mouths.
- Run off-screen to fetch ladders, set them up, and climb to high letters.
- Plow through settled confetti and push it toward burrows.

## Regenerating Assets

```bash
python3 scripts/generate_happy_birthday_wav.py
```

This re-creates the WAV, MP3, beat timing JSON, and note-events JSON.

## License

Personal project for Harry Baya. The wombat STL is the "Cute Wombat Figurine" from Printables.
