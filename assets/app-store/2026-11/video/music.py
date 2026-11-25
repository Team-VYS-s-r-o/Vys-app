"""Epická hudba pro video o aplikaci VYS — celá syntetizovaná (numpy + scipy), žádné licence.
120 BPM, d moll → e moll na koordinátora, závěr E dur. Údery sedí přesně na střihy scén."""
import json
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
SCENES = dict(intro=0.0, parent=3.5, kid=9.0, tap=14.5, coach=17.0, coord=22.0, outro=26.0, end=29.5)
TOTAL = SCENES['end'] + 0.6
N = int(TOTAL * SR)
rng = np.random.default_rng(7)


def hz(note):
    names = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
    name, octave = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[name] + (octave - 4) * 12 - 9) / 12)


def lowpass(x, cutoff, order=2):
    return signal.sosfilt(signal.butter(order, cutoff, 'low', fs=SR, output='sos'), x)


def highpass(x, cutoff, order=2):
    return signal.sosfilt(signal.butter(order, cutoff, 'high', fs=SR, output='sos'), x)


def bandpass(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def saw(freq, dur, voices=3, spread=0.006):
    t = np.arange(int(dur * SR)) / SR
    out = np.zeros_like(t)
    for i in range(voices):
        det = 1 + spread * (i - (voices - 1) / 2)
        phase = (t * freq * det + rng.random()) % 1.0
        out += 2 * phase - 1
    return out / voices


def env(dur, attack, decay, sustain=0.0, release=0.05):
    n = int(dur * SR)
    e = np.ones(n) * sustain
    a = max(1, int(attack * SR))
    d = max(1, int(decay * SR))
    r = max(1, int(release * SR))
    e[:a] = np.linspace(0, 1, a)[: len(e[:a])]
    seg = e[a:a + d]
    seg[:] = np.linspace(1, sustain, d)[: len(seg)]
    e[-r:] *= np.linspace(1, 0, r)[-len(e[-r:]):]
    return e


class Bus:
    def __init__(self):
        self.l = np.zeros(N)
        self.r = np.zeros(N)

    def add(self, sig, t, gain=1.0, pan=0.0):
        i = int(t * SR)
        if i >= N:
            return
        sig = sig[: N - i]
        self.l[i:i + len(sig)] += sig * gain * (1 - max(0, pan))
        self.r[i:i + len(sig)] += sig * gain * (1 + min(0, pan))


def reverb(x, seconds=2.4, damp=5000):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (seconds * SR / 6.2))
    ir = lowpass(ir, damp)
    ir /= np.sqrt(np.sum(ir ** 2))
    return signal.fftconvolve(x, ir)[: len(x)]


strings, brass, choir, drums, hits, fx = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()


def stab(note, dur=0.11, bright=3800):
    return lowpass(saw(hz(note), dur + 0.08), bright) * env(dur + 0.08, 0.006, dur, 0.0, 0.05)


def pad(notes, dur, cutoff=1400, attack=0.5, release=0.6):
    out = sum(saw(hz(n), dur, voices=5, spread=0.004) for n in notes) / len(notes)
    return lowpass(out, cutoff, 4) * env(dur, attack, 0.1, 1.0, release)


def aah(notes, dur, attack=0.7):
    raw = sum(saw(hz(n), dur, voices=5, spread=0.005) for n in notes) / len(notes)
    voiced = bandpass(raw, 520, 760) * 1.0 + bandpass(raw, 950, 1250) * 0.7 + bandpass(raw, 2300, 2900) * 0.35
    return voiced * env(dur, attack, 0.1, 1.0, 0.7)


def taiko(size=1.0):
    dur = 0.7
    t = np.arange(int(dur * SR)) / SR
    f = 48 + 70 * np.exp(-t * 22)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (6.5 / size))
    skin = lowpass(rng.standard_normal(len(t)), 900) * np.exp(-t * 28) * 0.9
    click = bandpass(rng.standard_normal(len(t)), 900, 3600) * np.exp(-t * 55) * 0.55 * size
    knock = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
    return np.tanh((body + skin + knock) * 2.2) * 0.8 + click


def impact():
    dur = 3.2
    t = np.arange(int(dur * SR)) / SR
    f = 30 + 55 * np.exp(-t * 5)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.5)
    crash = highpass(lowpass(rng.standard_normal(len(t)), 7000), 250) * np.exp(-t * 2.6) * 0.5
    thud = lowpass(rng.standard_normal(len(t)), 220) * np.exp(-t * 9) * 1.4
    return np.tanh((sub * 1.6 + thud) * 1.6) * 0.75 + crash


def riser(dur, strength=1.0):
    t = np.arange(int(dur * SR)) / SR
    x = t / dur
    noise = highpass(rng.standard_normal(len(t)), 900) * x ** 2.4 * 0.5
    sweep = np.sin(2 * np.pi * np.cumsum(180 * 2 ** (x * 3.1)) / SR) * x ** 2 * 0.22
    return (noise + sweep) * strength


def whoosh(dur=0.42):
    t = np.arange(int(dur * SR)) / SR
    x = t / dur
    return bandpass(rng.standard_normal(len(t)), 500, 5200) * np.sin(np.pi * x) ** 2 * 0.5


def blip(freq=1320, dur=0.09):
    t = np.arange(int(dur * SR)) / SR
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * 26)


BEAT = 0.5
SIX = BEAT / 4
PROG_D = [['D3', 'F3', 'A3', 'D4'], ['Bb2', 'D3', 'F3', 'Bb3'], ['F3', 'A3', 'C4', 'F4'], ['C3', 'E3', 'G3', 'C4']]
PROG_E = [['E3', 'G3', 'B3', 'E4'], ['C3', 'E3', 'G3', 'C4'], ['G3', 'B3', 'D4', 'G4'], ['D3', 'F#3', 'A3', 'D4']]
ARP = [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 2, 3, 2, 3, 2]


def up(note, octaves=1):
    return note[:-1] + str(int(note[-1]) + octaves)


def ostinato(start, end, prog, level, high=False, first_bar=0):
    t = start
    bar = first_bar
    while t < end - 1e-6:
        chord = prog[bar % 4]
        for step in range(16):
            ts = t + step * SIX
            if ts >= end - 1e-6:
                break
            note = chord[ARP[step]]
            accent = 1.0 if step % 4 == 0 else 0.62
            strings.add(stab(note), ts, level * accent, pan=-0.25)
            strings.add(stab(up(note)), ts, level * accent * 0.55, pan=0.3)
            if high:
                strings.add(stab(up(note, 2), bright=5200), ts, level * accent * 0.3, pan=0.1)
        t += 2.0
        bar += 1


def chords(start, end, prog, level, with_choir=False, first_bar=0):
    t = start
    bar = first_bar
    while t < end - 1e-6:
        chord = prog[bar % 4]
        dur = min(2.0, end - t) + 0.25
        low = [up(chord[0], -1), chord[0], chord[2]]
        brass.add(pad(low, dur, cutoff=1300, attack=0.12), t, level, pan=0.0)
        brass.add(pad([up(n) for n in chord[1:]], dur, cutoff=2600, attack=0.25), t, level * 0.75, pan=0.15)
        if with_choir:
            choir.add(aah([up(n) for n in chord[1:]], dur), t, level * 0.9, pan=-0.1)
        t += 2.0
        bar += 1


def drum_bar(t, level, roll=False):
    for offset, size in [(0.0, 1.0), (0.75, 0.6), (1.0, 0.9), (1.5, 0.65)]:
        drums.add(taiko(size), t + offset, level * size)
    if roll:
        for k in range(4):
            drums.add(taiko(0.45), t + 1.75 + k * 0.0625, level * (0.3 + 0.12 * k))


def drum_range(start, end, level, roll_last=True):
    t = start
    while t < end - 1e-6:
        drum_bar(t, level, roll=roll_last and (t + 2.0 >= end - 1e-6 or int(round((t - start) / 2)) % 2 == 1))
        t += 2.0


S = SCENES
# — úvod: temný dron, tep a stoupání do prvního úderu
brass.add(pad(['D1', 'D2', 'A2'], S['parent'] + 0.4, cutoff=420, attack=1.6, release=0.3), 0.0, 0.9)
strings.add(pad(['A4', 'D5'], S['parent'], cutoff=2600, attack=2.6, release=0.1) * np.linspace(0.2, 1, int(S['parent'] * SR)), 0.0, 0.32)
for k, t in enumerate([0.0, 1.0, 2.0, 2.5, 3.0, 3.25]):
    drums.add(taiko(0.7), t, 0.34 + 0.07 * k)
fx.add(riser(2.2), S['parent'] - 2.2, 0.9)

# — rodič: první úder, smyčcové ostinato a bubny
hits.add(impact(), S['parent'], 1.0)
ostinato(S['parent'], S['kid'], PROG_D, 0.55)
chords(S['parent'], S['kid'], PROG_D, 0.5)
drum_range(S['parent'], S['parent'] + 4.0, 0.62)
drums.add(taiko(1.0), S['parent'] + 4.0, 0.62)
drums.add(taiko(0.7), S['parent'] + 4.75, 0.5)
drums.add(taiko(0.9), S['parent'] + 5.0, 0.6)
for k in range(4):
    drums.add(taiko(0.45), S['kid'] - 0.25 + k * 0.0625, 0.3 + 0.1 * k)
fx.add(riser(1.0, 0.7), S['kid'] - 1.0, 0.8)

# — dítě: jasnější, o oktávu výš, přidá se melodie
hits.add(impact(), S['kid'], 0.8)
ostinato(S['kid'], S['tap'], PROG_D, 0.58, high=True, first_bar=3)
chords(S['kid'], S['tap'], PROG_D, 0.55, first_bar=3)
drum_range(S['kid'], S['kid'] + 4.0, 0.66)
drums.add(taiko(1.0), S['kid'] + 4.0, 0.66)
drums.add(taiko(0.8), S['kid'] + 5.0, 0.6)
for note, t, dur in [('D5', 0.0, 0.9), ('F5', 1.0, 0.9), ('E5', 2.0, 0.9), ('C5', 3.0, 0.45), ('D5', 3.5, 0.45), ('A5', 4.0, 1.4)]:
    brass.add(pad([note, up(note, -1)], dur + 0.2, cutoff=2400, attack=0.05, release=0.25), S['kid'] + t, 0.42, pan=0.2)

# — pípnutí kartičky: ztišení, napětí a stoupání do nejsilnější části
brass.add(pad(['Bb1', 'Bb2', 'F3'], 1.4, cutoff=700, attack=0.3), S['tap'], 0.75)
brass.add(pad(['C2', 'C3', 'G3'], 1.4, cutoff=900, attack=0.3), S['tap'] + 1.25, 0.8)
strings.add(pad(['D5', 'F5'], 2.5, cutoff=3000, attack=1.2, release=0.1), S['tap'], 0.3)
for t in [0.0, 0.5, 1.0, 1.5, 1.75, 2.0, 2.125, 2.25, 2.375]:
    drums.add(taiko(0.6), S['tap'] + t, 0.3 + 0.12 * t)
fx.add(riser(1.6), S['coach'] - 1.6, 1.0)

# — trenér: naplno, se sborem
hits.add(impact(), S['coach'], 1.0)
ostinato(S['coach'], S['coord'], PROG_D, 0.6, high=True)
chords(S['coach'], S['coord'], PROG_D, 0.6, with_choir=True)
drum_range(S['coach'], S['coach'] + 4.0, 0.74)
drums.add(taiko(1.0), S['coach'] + 4.0, 0.74)
drums.add(taiko(0.8), S['coach'] + 4.5, 0.6)
for k in range(4):
    drums.add(taiko(0.5), S['coord'] - 0.25 + k * 0.0625, 0.34 + 0.12 * k)
fx.add(riser(0.9, 0.8), S['coord'] - 0.9, 0.8)

# — koordinátor: o tón výš (e moll), vrchol
hits.add(impact(), S['coord'], 0.95)
ostinato(S['coord'], S['outro'], PROG_E, 0.62, high=True)
chords(S['coord'], S['outro'], PROG_E, 0.64, with_choir=True)
drum_range(S['coord'], S['outro'], 0.8)
for note, t, dur in [('E5', 0.0, 0.9), ('G5', 1.0, 0.9), ('F#5', 2.0, 0.9), ('B5', 3.0, 1.0)]:
    brass.add(pad([note, up(note, -1)], dur + 0.2, cutoff=2600, attack=0.05, release=0.25), S['coord'] + t, 0.46, pan=-0.2)
fx.add(riser(1.2), S['outro'] - 1.2, 1.0)

# — závěr: poslední úder a dlouhý akord E dur
hits.add(impact(), S['outro'], 1.1)
final = S['end'] - S['outro'] + 0.5
brass.add(pad(['E1', 'E2', 'B2', 'E3'], final, cutoff=1000, attack=0.05, release=2.2), S['outro'], 0.85)
brass.add(pad(['G#3', 'B3', 'E4', 'G#4'], final, cutoff=2200, attack=0.1, release=2.2), S['outro'], 0.5)
choir.add(aah(['E4', 'G#4', 'B4', 'E5'], final, attack=0.3), S['outro'], 0.7)
strings.add(pad(['E5', 'B5'], final, cutoff=3600, attack=0.4, release=2.2), S['outro'], 0.26)
drums.add(taiko(1.0), S['outro'] + 2.0, 0.7)
hits.add(impact(), S['outro'] + 2.0, 0.45)

# — zvuky střihu (časy z animace)
events = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else {}
for t in events.get('whoosh', []):
    fx.add(whoosh(), t - 0.2, 0.55, pan=0.0)
for t in events.get('pop', []):
    fx.add(blip(1320) + np.pad(blip(1980, 0.07), (int(0.06 * SR), 0))[: int(0.09 * SR)], t, 0.35)
for t in events.get('beep', []):
    fx.add(blip(1568, 0.16) * 1.0, t, 0.5)
    fx.add(blip(2093, 0.2), t + 0.11, 0.5)


def render(bus, wet, room=2.4, damp=5000):
    l = bus.l + reverb(bus.l, room, damp) * wet
    r = bus.r + reverb(bus.r, room, damp) * wet
    return l, r


mix_l = np.zeros(N)
mix_r = np.zeros(N)
for bus, gain, wet, room in [(strings, 1.5, 0.9, 2.2), (brass, 0.95, 0.8, 2.6), (choir, 1.1, 1.3, 3.0), (drums, 0.85, 0.5, 1.8), (hits, 0.62, 0.9, 3.2), (fx, 0.7, 0.6, 1.6)]:
    l, r = render(bus, wet, room)
    mix_l += l * gain
    mix_r += r * gain

mix = np.stack([highpass(mix_l, 28), highpass(mix_r, 28)], axis=1)
mix = np.tanh(mix * 0.9 / np.percentile(np.abs(mix), 99.7)) 
fade = np.ones(N)
tail = int(1.3 * SR)
fade[-tail:] = np.linspace(1, 0, tail) ** 1.5
mix *= fade[:, None]
mix = mix / np.max(np.abs(mix)) * 0.94
wavfile.write(sys.argv[1], SR, (mix * 32767).astype(np.int16))
print('ok', sys.argv[1], round(TOTAL, 2), 's')
