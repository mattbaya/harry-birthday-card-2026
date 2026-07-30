#!/usr/bin/env python3
"""Generate a richer synthesized 'Happy Birthday' WAV for the birthday card.

Arrangement:
- Phrase 1: banjo lead, bass, light drums
- Phrase 2: fiddle lead, bass, drums
- Phrase 3: banjo + fiddle harmony, bass, drums
- Phrase 4: fiddle lead, banjo arpeggios, bass, drums

The melody is repeated 3 times for a longer loopable track.
"""
import math
import wave
import struct
import random
from pathlib import Path
import json

OUT_WAV = Path('/home/phred/.openclaw/agents/phred/demos/audio/happy-birthday-2026.wav')
OUT_MP3 = Path('/home/phred/.openclaw/agents/phred/demos/audio/happy-birthday-2026.mp3')
OUT_TIMING = Path('/home/phred/.openclaw/agents/phred/demos/audio/happy-birthday-2026-timing.json')
OUT_NOTES = Path('/home/phred/.openclaw/agents/phred/demos/audio/happy-birthday-2026-notes.json')
OUT_WAV.parent.mkdir(exist_ok=True)

SAMPLE_RATE = 44100
TEMPO_BPM = 120
BEAT = 60.0 / TEMPO_BPM  # quarter note in seconds

NOTE_FREQ = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00,
    'A3': 220.00, 'Bb3': 233.08,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00,
    'A4': 440.00, 'Bb4': 466.16, 'C5': 523.25, 'D5': 587.33, 'E5': 659.25,
    'F5': 698.46, 'G5': 783.99,
    'R': 0,
}

VERSE_MELODY = [
    ('C4', 0.75), ('C4', 0.25), ('D4', 1.0), ('C4', 1.0), ('F4', 1.0), ('E4', 2.0),
    ('C4', 0.75), ('C4', 0.25), ('D4', 1.0), ('C4', 1.0), ('G4', 1.0), ('F4', 2.0),
    ('C4', 0.75), ('C4', 0.25), ('C5', 1.0), ('A4', 1.0), ('F4', 1.0), ('E4', 1.0), ('D4', 2.0),
    ('Bb4', 0.75), ('Bb4', 0.25), ('A4', 1.0), ('F4', 1.0), ('G4', 1.0), ('F4', 2.0),
]

MELODY = VERSE_MELODY * 3

VERSE_CHORDS = [
    ('C3', 'E3', 'G3'), ('C3', 'E3', 'G3'), ('C3', 'E3', 'G3'), ('C3', 'E3', 'G3'),
    ('F3', 'A3', 'C4'), ('C3', 'E3', 'G3'), ('C3', 'E3', 'G3'), ('C3', 'E3', 'G3'),
    ('C3', 'E3', 'G3'), ('C3', 'E3', 'G3'), ('G3', 'Bb3', 'D4'), ('C3', 'E3', 'G3'),
    ('C3', 'E3', 'G3'), ('C3', 'E3', 'G3'), ('F3', 'A3', 'C4'), ('C3', 'E3', 'G3'),
    ('G3', 'Bb3', 'D4'), ('C3', 'E3', 'G3'),
]
CHORDS = VERSE_CHORDS * 3


def mix(*tracks):
    length = len(tracks[0])
    out = [0.0] * length
    for tr in tracks:
        for i in range(length):
            out[i] += tr[i]
    peak = max(abs(s) for s in out) or 1.0
    if peak > 1.0:
        out = [s / peak for s in out]
    return out


def render_track(events, voice_fn, total_samples):
    track = [0.0] * total_samples
    cursor = 0
    for ev in events:
        note, beats = ev[0], ev[1]
        vel = ev[2] if len(ev) > 2 else 1.0
        duration = beats * BEAT
        freq = NOTE_FREQ[note]
        n = int(duration * SAMPLE_RATE)
        if freq > 0:
            samples = voice_fn(freq, duration, vel)
            for i, s in enumerate(samples):
                if cursor + i < total_samples:
                    track[cursor + i] += s
        cursor += n
    return track


def apply_adsr(samples, attack, decay, sustain, release):
    """Apply ADSR envelope by sample indices."""
    n = len(samples)
    out = samples[:]
    for i in range(n):
        if i < attack:
            env = i / attack if attack else 1.0
        elif i < attack + decay:
            env = 1.0 - (1.0 - sustain) * ((i - attack) / decay)
        elif i < n - release:
            env = sustain
        else:
            env = sustain * ((n - i) / release) if release else 0.0
        out[i] *= env
    return out


def karplus_strong(freq, duration, vel=1.0):
    """Plucked string using Karplus-Strong (great for banjo)."""
    n = int(duration * SAMPLE_RATE)
    delay = int(round(SAMPLE_RATE / freq))
    if delay < 2:
        delay = 2
    buf = [random.uniform(-1, 1) for _ in range(delay)]
    samples = []
    for i in range(n):
        # Average of first two samples with slight damping
        val = 0.5 * (buf[0] + buf[1])
        buf.append(val * 0.996)  # decay
        buf.pop(0)
        samples.append(val * vel)
    # Quick pluck emphasis
    attack = min(int(0.005 * SAMPLE_RATE), n // 8)
    for i in range(attack):
        samples[i] *= i / attack
    return samples


def banjo(freq, duration, vel=1.0):
    """Bright banjo pluck: Karplus-Strong + high harmonics + snap noise."""
    samples = karplus_strong(freq, duration, vel * 0.7)
    # Add a bright noise snap at the very beginning
    snap_len = min(int(0.015 * SAMPLE_RATE), len(samples))
    for i in range(snap_len):
        noise = (random.random() - 0.5) * 0.25 * (1 - i / snap_len)
        samples[i] += noise * vel
    # Boost treble by adding a higher, faster-decaying pluck
    high = karplus_strong(freq * 2.01, duration, vel * 0.15)
    for i in range(len(samples)):
        samples[i] += high[i]
    return samples


def fiddle(freq, duration, vel=1.0):
    """Violin/fiddle: sawtooth with vibrato, bow noise, and warm envelope."""
    n = int(duration * SAMPLE_RATE)
    samples = []
    attack = int(0.08 * SAMPLE_RATE)
    release = int(0.25 * SAMPLE_RATE)
    for i in range(n):
        t = i / SAMPLE_RATE
        # Vibrato: 6 Hz, 1.5% depth
        vib = 1.0 + 0.015 * math.sin(2 * math.pi * 6.0 * t)
        phase = 2 * math.pi * freq * vib * t
        # Saw-ish with rounded harmonics (sum 1/h)
        v = 0.0
        for h in range(1, 12):
            v += math.sin(phase * h) / h
        v *= 0.18
        # Bow scratch noise
        if i < n - release:
            v += (random.random() - 0.5) * 0.035
        # Envelope
        if i < attack:
            env = i / attack
        elif i > n - release:
            env = (n - i) / release
        else:
            env = 1.0
        samples.append(v * env * vel)
    return samples


def bass(freq, duration, vel=1.0):
    """Round bass with triangle body and quick punch."""
    n = int(duration * SAMPLE_RATE)
    samples = []
    attack = int(0.02 * SAMPLE_RATE)
    release = int(0.18 * SAMPLE_RATE)
    for i in range(n):
        t = i / SAMPLE_RATE
        phase = 2 * math.pi * freq * t
        # Triangle-ish: sum of odd harmonics alternating sign
        v = 0.5 * math.sin(phase)
        v += 0.15 * math.sin(phase * 3) * -1
        v += 0.05 * math.sin(phase * 5)
        if i < attack:
            env = i / attack
        elif i > n - release:
            env = (n - i) / release
        else:
            env = 1.0
        samples.append(v * env * vel)
    return samples


def kick(duration, vel=1.0):
    n = int(duration * SAMPLE_RATE)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        # Pitch drop from ~130Hz
        freq = 130 * math.exp(-t / 0.035)
        body = math.sin(2 * math.pi * freq * t)
        # Punch click
        click = 0.0
        if i < 80:
            click = (random.random() - 0.5) * (1 - i / 80) * 0.4
        env = math.exp(-t / 0.12)
        samples.append((body * 0.7 + click) * env * vel)
    return samples


def snare(duration, vel=1.0):
    n = int(duration * SAMPLE_RATE)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        # Noise + small tonal component
        noise = random.random() - 0.5
        tone = math.sin(2 * math.pi * 180 * t) * 0.15
        env = math.exp(-t / 0.07)
        samples.append((noise + tone) * env * vel)
    return samples


def hi_hat(duration, vel=1.0):
    n = int(duration * SAMPLE_RATE)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        # High-pass-ish noise (just bright noise)
        noise = random.random() - 0.5
        env = math.exp(-t / 0.03)
        samples.append(noise * env * vel * 0.5)
    return samples


def make_drums(total_samples):
    track = [0.0] * total_samples
    beat_samples = int(BEAT * SAMPLE_RATE)
    beats_total = int(total_samples / beat_samples) + 1
    for beat in range(beats_total):
        idx = beat * beat_samples
        if idx >= total_samples:
            break
        measure_beat = beat % 3
        if measure_beat == 0:
            sample = kick(BEAT, 0.8)
        elif measure_beat == 2:
            sample = snare(BEAT, 0.5)
        else:
            sample = hi_hat(BEAT, 0.25)
        for i, s in enumerate(sample):
            if idx + i < total_samples:
                track[idx + i] += s
    return track


def make_bass(total_samples):
    track = [0.0] * total_samples
    beat_samples = int(BEAT * SAMPLE_RATE)
    chord_idx = 0
    cursor = 0
    for note, beats in MELODY:
        n = int(beats * SAMPLE_RATE)
        chord = CHORDS[min(chord_idx, len(CHORDS) - 1)]
        root = chord[0]
        if beats >= 1.0:
            s1 = bass(NOTE_FREQ[root], BEAT * 0.9, 0.8)
            fifth = chord[2]
            s2 = bass(NOTE_FREQ[fifth], BEAT * 0.9, 0.6)
            for i, s in enumerate(s1):
                if cursor + i < total_samples:
                    track[cursor + i] += s
            if beats >= 2.0 and cursor + beat_samples < total_samples:
                for i, s in enumerate(s2):
                    if cursor + beat_samples + i < total_samples:
                        track[cursor + beat_samples + i] += s
        cursor += n
        chord_idx += 1
    return track


def make_leads(total_samples):
    banjo_track = [0.0] * total_samples
    fiddle_track = [0.0] * total_samples
    cursor = 0
    phrase = 0
    phrase_beats = 0.0
    for idx, (note, beats) in enumerate(MELODY):
        n = int(beats * SAMPLE_RATE)
        freq = NOTE_FREQ[note]
        phrase_pattern = phrase % 4
        if freq > 0:
            if phrase_pattern in (0, 2):
                sample = banjo(freq, beats * BEAT, 0.9)
                for i, s in enumerate(sample):
                    if cursor + i < total_samples:
                        banjo_track[cursor + i] += s
            if phrase_pattern in (1, 2, 3):
                harmonize = (phrase_pattern == 3 and idx % 3 == 0 and freq > NOTE_FREQ['C3'])
                f = freq / 2 if harmonize else freq
                v = 0.7 if phrase_pattern == 3 else 0.9
                sample = fiddle(f, beats * BEAT, v)
                for i, s in enumerate(sample):
                    if cursor + i < total_samples:
                        fiddle_track[cursor + i] += s
        cursor += n
        phrase_beats += beats
        if phrase_beats >= 6:
            phrase += 1
            phrase_beats -= 6
    return banjo_track, fiddle_track


def make_beat_times():
    beats = []
    total_beats = 0.0
    for note, beats_len in MELODY:
        whole_beats = int(beats_len)
        frac = beats_len - whole_beats
        for b in range(whole_beats):
            beats.append(round(total_beats + b * BEAT, 4))
        if frac > 0.001:
            beats.append(round(total_beats + whole_beats * BEAT, 4))
        total_beats += beats_len * BEAT
    seen = set()
    out = []
    for b in beats:
        if b not in seen:
            seen.add(b)
            out.append(b)
    return sorted(out)


def make_notes():
    """Generate note events for soundfont playback in the browser."""
    notes = []

    # Melody: banjo/fiddle per phrase
    cursor = 0.0
    phrase = 0
    phrase_beats = 0.0
    for idx, (note, beats) in enumerate(MELODY):
        duration = beats * BEAT
        phrase_pattern = phrase % 4
        if note != 'R':
            if phrase_pattern in (0, 2):
                notes.append({
                    'instrument': 'banjo',
                    'note': note,
                    'start': round(cursor, 4),
                    'duration': round(duration * 0.95, 4),
                    'velocity': 0.9
                })
            if phrase_pattern in (1, 2, 3):
                harmonize = (phrase_pattern == 3 and idx % 3 == 0 and NOTE_FREQ[note] > NOTE_FREQ['C3'])
                n = note
                v = 0.7 if phrase_pattern == 3 else 0.9
                if harmonize:
                    # Lower octave for harmony
                    base = note[:-1]
                    octv = int(note[-1]) - 1
                    n = f'{base}{octv}'
                notes.append({
                    'instrument': 'violin',
                    'note': n,
                    'start': round(cursor, 4),
                    'duration': round(duration * 0.95, 4),
                    'velocity': v
                })
        cursor += duration
        phrase_beats += beats
        if phrase_beats >= 6:
            phrase += 1
            phrase_beats -= 6

    # Bass line
    cursor = 0.0
    chord_idx = 0
    for note, beats in MELODY:
        duration = beats * BEAT
        chord = CHORDS[min(chord_idx, len(CHORDS) - 1)]
        root = chord[0]
        if beats >= 1.0:
            notes.append({
                'instrument': 'acoustic_bass',
                'note': root,
                'start': round(cursor, 4),
                'duration': round(BEAT * 0.9, 4),
                'velocity': 0.8
            })
            if beats >= 2.0:
                fifth = chord[2]
                notes.append({
                    'instrument': 'acoustic_bass',
                    'note': fifth,
                    'start': round(cursor + BEAT, 4),
                    'duration': round(BEAT * 0.9, 4),
                    'velocity': 0.6
                })
        cursor += duration
        chord_idx += 1

    # Drums: kick on beat 1, snare on beat 3, hi-hat on beat 2
    beats_total = int(sum(b for _, b in MELODY)) + 1
    for beat in range(beats_total):
        t = beat * BEAT
        measure_beat = beat % 3
        if measure_beat == 0:
            notes.append({'instrument': 'percussion', 'note': 'C2', 'start': round(t, 4), 'duration': 0.1, 'velocity': 0.8})
        elif measure_beat == 2:
            notes.append({'instrument': 'percussion', 'note': 'D2', 'start': round(t, 4), 'duration': 0.1, 'velocity': 0.5})
        else:
            notes.append({'instrument': 'percussion', 'note': 'F#2', 'start': round(t, 4), 'duration': 0.05, 'velocity': 0.25})

    return sorted(notes, key=lambda x: (x['start'], x['instrument']))


def main():
    total_beats = sum(b for _, b in MELODY)
    total_samples = int(total_beats * BEAT * SAMPLE_RATE) + int(1.0 * SAMPLE_RATE)

    banjo_track, fiddle_track = make_leads(total_samples)
    bass_track = make_bass(total_samples)
    drum_track = make_drums(total_samples)

    # Balance
    banjo_track = [s * 0.95 for s in banjo_track]
    fiddle_track = [s * 0.85 for s in fiddle_track]
    bass_track = [s * 0.75 for s in bass_track]
    drum_track = [s * 0.6 for s in drum_track]

    samples = mix(banjo_track, fiddle_track, bass_track, drum_track)

    peak = max(abs(s) for s in samples) or 1.0
    samples = [s / peak * 0.85 for s in samples]

    with wave.open(str(OUT_WAV), 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        for s in samples:
            w.writeframes(struct.pack('<h', int(max(-1, min(1, s)) * 32767)))

    duration = len(samples) / SAMPLE_RATE
    print(f'Wrote {OUT_WAV} ({duration:.2f}s, {TEMPO_BPM} BPM)')

    try:
        import subprocess
        subprocess.run([
            'ffmpeg', '-y', '-i', str(OUT_WAV), '-vn', '-ar', '44100', '-ac', '1',
            '-b:a', '192k', str(OUT_MP3)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f'Wrote {OUT_MP3}')
    except Exception as e:
        print(f'Could not create MP3: {e}')

    timing = {'bpm': TEMPO_BPM, 'beats': make_beat_times()}
    OUT_TIMING.write_text(json.dumps(timing, indent=2))
    print(f'Wrote {OUT_TIMING}')

    notes = {
        'bpm': TEMPO_BPM,
        'duration': round(len(samples) / SAMPLE_RATE, 2),
        'instruments': ['banjo', 'violin', 'acoustic_bass', 'percussion'],
        'notes': make_notes()
    }
    OUT_NOTES.write_text(json.dumps(notes, indent=2))
    print(f'Wrote {OUT_NOTES}')


if __name__ == '__main__':
    main()
