"""Original soundtrack for the 52 s process film, synthesised locally (no samples, no licence).

The score follows the picture:
- the tempo is the press cadence (one sheet every 0.4909 s, 122.2 BPM): every beat is a sheet;
- each part of the film has its own section: feeder intro, offset groove, die-cutting in half time
  with the platen impact, folder-gluer groove with the folds and the glue, packing breakdown,
  delivery and a resolved ending on the closed box;
- each visible event has its sound: sucker pick, platen cut, stripping pins, folds, glue,
  tape, van door, box lids; every camera cut gets a swish, every chapter change an impact.
Usage: python3 outils/musique.py SORTIE.wav"""
import sys, wave
import numpy as np

SR = 48000; DUR = 52.1; N = int(SR * DUR)
BEAT = np.pi * .25 / 1.6          # the press cadence, in seconds
BAR = 4 * BEAT
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

# Picture timeline (seconds), taken from js/scene.js, impression.js, decoupe.js.
CUTS = [2.45, 4, 4.7, 7, 9.1, 11.7, 14, 15.65, 17.9, 20.75, 23.6, 26, 27.55, 29, 32, 36, 38, 42, 45, 47.6]
SECTIONS = [(0, 'intro'), (4, 'offset'), (14, 'decoupe'), (26, 'collage'), (38, 'emballage'), (45, 'final')]
CHAPTERS = [4, 14, 26, 38, 45]
CUT = 19.42                       # the platen closes on the sheet
PINS = 21.0                       # stripping pins go down
PUSH = 24.39                      # blanks pushed out
FOLDS = [33.32, 35.16]            # first and second fold complete
GLUE = (29.0, 31.0)               # bead laid in the close-up
TAPE = (39.6, 41.6)               # the case is closed and taped
PILE = 38.0                       # last pile lowered into the case
VAN = (44.2, 45.0)
LIDS = [49.3, 50.1, 51.6]         # unpacking: open, bottom closed, top closed


def section(t):
    s = SECTIONS[0][1]
    for t0, name in SECTIONS:
        if t >= t0: s = name
    return s


def env(n, a, d):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) if a > 0 else np.ones(n)
    return e * np.exp(-t / d)


def lp(x, fc, q=1.0):
    """Zero-phase low-pass by FFT, with a soft roll-off above fc (Hz)."""
    n = len(x); f = np.fft.rfftfreq(n, 1 / SR)
    h = 1 / np.sqrt(1 + (f / fc) ** (4 * q))
    return np.fft.irfft(np.fft.rfft(x) * h, n)


def hp(x, fc):
    n = len(x); f = np.fft.rfftfreq(n, 1 / SR)
    h = 1 - 1 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(np.fft.rfft(x) * h, n)


def add(sig, t, gain=1., pan=0.):
    i = int(round(t * SR))
    if i >= N or i + len(sig) <= 0: return
    a = max(0, -i); j = min(N, i + len(sig))
    L[max(i, 0):j] += sig[a:j - i] * gain * np.sqrt((1 - pan) / 2) * 1.41
    R[max(i, 0):j] += sig[a:j - i] * gain * np.sqrt((1 + pan) / 2) * 1.41


def osc(freq, n, shape='saw', det=0.):
    t = np.arange(n) / SR; out = np.zeros(n)
    for d in ([0.] if not det else [-det, 0., det]):
        ph = freq * (1 + d) * t + rng.random()
        out += {'saw': 2 * (ph % 1) - 1, 'sq': np.sign(np.sin(2 * np.pi * ph)), 'sin': np.sin(2 * np.pi * ph),
                'tri': 2 * np.abs(2 * (ph % 1) - 1) - 1}[shape]
    return out / (1 if not det else 3)


# --- Drums and hits -------------------------------------------------------------------------
def kick(power=1.):
    n = int(.4 * SR); t = np.arange(n) / SR
    f = 46 + 120 * np.exp(-t / .028); ph = 2 * np.pi * np.cumsum(f) / SR
    click = hp(rng.standard_normal(n), 2000) * env(n, .0003, .004) * .3
    return (np.tanh(np.sin(ph) * env(n, .001, .16) * 1.6 * power) + click)


def snare():
    n = int(.3 * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 190 * t) * env(n, .001, .06)
    noise = hp(lp(rng.standard_normal(n), 8000), 900) * env(n, .001, .11)
    return body * .5 + noise * .8


def clap():
    n = int(.3 * SR); e = env(n, .001, .09)
    for k in (.008, .017, .026): e = e + np.roll(env(n, .001, .008), int(k * SR)) * .7
    return hp(lp(rng.standard_normal(n), 6000), 800) * e * .6


def hat(open_=False):
    n = int((.22 if open_ else .05) * SR)
    return hp(rng.standard_normal(n), 7000) * env(n, .0005, .07 if open_ else .014) * .6


def shaker():
    n = int(.09 * SR)
    return hp(lp(rng.standard_normal(n), 9000), 4000) * env(n, .02, .03) * .5


def impact(size=1.):
    n = int(2.2 * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (34 + 60 * np.exp(-t / .07)) * t) * env(n, .002, .55 * size)
    crash = hp(rng.standard_normal(n), 3000) * env(n, .002, .35 * size) * .12
    metal = sum(np.sin(2 * np.pi * f * t) * env(n, .001, .25) for f in (523, 811, 1307)) * .06
    return np.tanh((boom + crash + metal) * 1.4)


def swish(length=.5, up=True):
    n = int(length * SR); t = np.arange(n) / SR; x = rng.standard_normal(n)
    shape = (t / length) ** 2 if up else np.exp(-t / (length * .25))
    lo, hi = lp(x, 900), lp(x, 6000)
    return (lo * (1 - t / length) + hi * (t / length)) * shape * .35


def riser(length):
    n = int(length * SR); t = np.arange(n) / SR; u = t / length
    noise = hp(rng.standard_normal(n), 300) * u ** 2.5 * .3
    tone = osc(1, n, 'saw')
    ph = np.cumsum(110 * 2 ** (u * 2)) / SR
    tone = (2 * (ph % 1) - 1) * u ** 2 * .12
    return lp(noise + tone, 5000)


# --- Foley of the machines -----------------------------------------------------------------
def pneumatic():   # sucker pick: a short hiss
    n = int(.12 * SR)
    return hp(lp(rng.standard_normal(n), 7000), 2500) * env(n, .004, .035) * .5


def clank():       # steel on steel: pins, stops
    n = int(.5 * SR); t = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * f * t) * env(n, .0005, d) for f, d in ((1450, .06), (2210, .04), (3390, .03), (620, .12))) * .25


def snap():        # board folding on its crease
    n = int(.08 * SR)
    return lp(hp(rng.standard_normal(n), 1200), 7000) * env(n, .0005, .012) * 1.2


def glue():        # glue bead: a soft wet squeeze
    n = int(2 * SR); t = np.arange(n) / SR
    x = lp(rng.standard_normal(n), 1400) * (.5 + .5 * np.sin(2 * np.pi * 9 * t) ** 2)
    return hp(x, 200) * np.minimum(1, t / .2) * np.minimum(1, (2 - t) / .3) * .35


def tape(length):  # tape pulled along the case
    n = int(length * SR); t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 1500) * (.6 + .4 * np.sin(2 * np.pi * 37 * t))
    return lp(x, 8000) * np.minimum(1, t / .05) * np.minimum(1, (length - t) / .08) * .3


def thud():
    n = int(.4 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (70 + 40 * np.exp(-t / .03)) * t) * env(n, .002, .09) + lp(rng.standard_normal(n), 600) * env(n, .001, .05) * .5


# --- Harmony ----------------------------------------------------------------------------------
def hz(m): return 440 * 2 ** ((m - 69) / 12)
# A minor, F, C, G (verse) and F, G, Am, C... root MIDI and chord MIDI.
PROG = {'intro': [(45, [57, 60, 64])],
        'offset': [(45, [57, 60, 64, 71]), (41, [57, 60, 65, 69]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])],
        'decoupe': [(41, [53, 57, 60, 65]), (43, [55, 59, 62, 67]), (45, [57, 60, 64, 69]), (45, [57, 60, 64, 69])],
        'collage': [(48, [60, 64, 67, 71]), (43, [59, 62, 67, 71]), (45, [57, 60, 64, 72]), (41, [57, 60, 65, 72])],
        'emballage': [(41, [57, 60, 65, 69]), (48, [55, 60, 64, 67])],
        'final': [(41, [57, 60, 65, 69]), (43, [55, 59, 62, 67]), (48, [55, 60, 64, 67, 72])]}


def pad(notes, length, cutoff):
    n = int(length * SR)
    x = sum(osc(hz(m), n, 'saw', .006) for m in notes) / len(notes)
    e = np.minimum(1, np.arange(n) / (.3 * SR)) * np.minimum(1, (n - np.arange(n)) / (.4 * SR))
    return lp(x, cutoff) * e


def pluck(m, length=.25, bright=3000):
    n = int(length * SR)
    return lp(osc(hz(m), n, 'sq') * .5 + osc(hz(m) * 2, n, 'saw') * .3, bright) * env(n, .002, length * .35)


def bass(m, length, cutoff=500):
    n = int(length * SR)
    x = osc(hz(m), n, 'saw') * .7 + osc(hz(m) / 2, n, 'sin') * .6
    return np.tanh(lp(x, cutoff) * 1.5) * env(n, .003, length * .8)


# --- Arrangement ------------------------------------------------------------------------------
duck = np.ones(N)  # sidechain: pads and bass breathe with the kick


def kick_at(t, power=1.):
    add(kick(power), t, .62)
    i = int(t * SR); n = int(.28 * SR)
    if i < N:
        curve = 1 - .55 * np.exp(-np.arange(min(n, N - i)) / (.07 * SR))
        duck[i:i + len(curve)] = np.minimum(duck[i:i + len(curve)], curve)


music = np.zeros((2, N))
def add_music(sig, t, gain=1., pan=0.):
    i = int(round(t * SR)); j = min(N, i + len(sig))
    if i >= N: return
    music[0, i:j] += sig[:j - i] * gain * np.sqrt((1 - pan) / 2) * 1.41
    music[1, i:j] += sig[:j - i] * gain * np.sqrt((1 + pan) / 2) * 1.41


nbars = int(DUR / BAR) + 1
for b in range(nbars):
    t0 = b * BAR
    if t0 >= DUR: break
    sec = section(t0 + .01)
    prog = PROG[sec]; root, chord = prog[b % len(prog)]
    # Pads: closed in the intro, opening with the press, warm and wide at the end.
    cutoff = {'intro': 700 + 300 * (t0 / 4), 'offset': 2400, 'decoupe': 1600, 'collage': 3000, 'emballage': 1800, 'final': 2600}[sec]
    add_music(pad(chord, BAR + .3, cutoff), t0, .16, -.25)
    add_music(pad([m + 12 for m in chord[:2]], BAR + .3, cutoff), t0, .06, .3)
    for k in range(16):
        t = t0 + k * BEAT / 4
        if t >= DUR - .3: continue
        beat, sub = divmod(k, 4)
        # Bass: rolling sixteenths at the press, half-time pulse at the die-cutter, offbeats at the gluer.
        if sec == 'offset' and sub in (0, 2, 3):
            add_music(bass(root + (12 if sub == 3 else 0), BEAT / 4 * .9, 700), t, .30)
        elif sec == 'decoupe' and k in (0, 6, 8, 11):
            add_music(bass(root, BEAT * .9, 380), t, .42)
        elif sec == 'collage' and sub == 2:
            add_music(bass(root + (7 if beat == 3 else 0), BEAT / 2, 800), t, .32)
        elif sec == 'final' and k in (0, 8):
            add_music(bass(root, BEAT * 1.8, 450), t, .30)
        elif sec == 'emballage' and k == 0:
            add_music(bass(root, BAR * .9, 350), t, .22)
        # Arpeggio: one note per sixteenth on the press, every eighth on the gluer.
        if sec == 'offset' and t > 4.6:
            m = chord[(k * 3) % len(chord)] + 12
            add_music(pluck(m, .18, 2500 + 1500 * ((t - 4) / 10)), t, .09, .35 * (1 if k % 2 else -1))
        if sec == 'collage' and sub % 2 == 0:
            m = chord[(k // 2) % len(chord)] + 12
            add_music(pluck(m, .3, 4200), t, .08, .3 * (1 if k % 4 else -1))
        if sec == 'final' and sub == 0 and t > 46.2:
            add_music(pluck(chord[beat % len(chord)] + 24, .6, 3500), t, .07, .2)
        # Drums.
        if sec in ('offset', 'collage'):
            if sub == 0: kick_at(t)
            if sub == 2: add(hat(), t, .055, -.3)
            if sub in (1, 3): add(hat(), t, .035, .3)
            if beat in (1, 3) and sub == 0: add(clap() if sec == 'collage' else snare(), t, .32 if sec == 'offset' else .28, .05)
            if sec == 'collage' and sub == 3: add(shaker(), t, .06, .45)
        elif sec == 'decoupe':
            if k in (0, 10): kick_at(t, 1.2)
            if k == 8: add(snare(), t, .42)
            if sub == 2: add(hat(), t, .06, -.3)
        elif sec == 'intro' and t > 1.0:
            if sub == 0: kick_at(t, .55 + .45 * t / 4)
            if sub == 2 and t > 2.5: add(hat(), t, .05, -.3)
        elif sec == 'emballage':
            if k == 0: kick_at(t, .6)
            if k == 8: add(clap(), t, .14)
            if sub == 2: add(shaker(), t, .06, .4)
        elif sec == 'final' and t < 50.6:
            if sub == 0 and beat in (0, 2): kick_at(t, .8)
            if beat in (1, 3) and sub == 0: add(clap(), t, .2)
            if sub == 2: add(hat(), t, .055, -.3)

# The sucker picks a sheet on every beat while the feeder is on screen.
for i in range(int(4.7 / BEAT) + 1):
    add(pneumatic(), i * BEAT + .03, .18, -.5)
# Die-cutter: the press builds up, closes on the sheet, the pins strip, the blanks leave.
add(riser(CUT - 18.4), 18.4, .55)
add(impact(1.2), CUT, .7); add(clank(), CUT + .02, .25, .2)
for i in range(4): add(clank(), PINS + i * .06, .12, -.2 + i * .12)
add(swish(.6, False), PUSH, .5, .3)
# Gluer: the bead, then each fold snaps on its crease.
add(glue(), GLUE[0], .5, .1)
for f in FOLDS: add(snap(), f, .6, -.2); add(pluck(81, .4, 5000), f, .07, .3)
# Packing, loading, delivery.
add(thud(), PILE + 1.38, .5)
add(tape(TAPE[1] - TAPE[0]), TAPE[0], .45, .2)
add(thud(), VAN[0], .35, -.3); add(swish(.8, True), VAN[0] - .8, .3)
for t in LIDS: add(snap(), t, .35, .1)
# Camera cuts: a swish into each shot; a riser and an impact on each chapter change.
for c in CUTS:
    if c in CHAPTERS:
        add(riser(1.2), c - 1.2, .45); add(impact(.9 if c < 38 else .6), c, .55 if c < 38 else .35)
    else:
        add(swish(.45), c - .45, .25)
# Ending: a held chord that rings out after the box is closed.
add_music(pad([53, 57, 60, 64, 69, 72], 3.0, 3000), 49.2, .2)

music *= duck
L += music[0]; R += music[1]
# Room: short early reflections plus a longer tail.
for buf in (L, R):
    for dl, g in ((.029, .12), (.043, .09), (.11, .06), (.19, .04)):
        d = int(dl * SR); buf[d:] += buf[:-d] * g
t = np.arange(N) / SR
fade = np.minimum(1, t / .6) * np.clip((DUR - t) / 1.6, 0, 1)
L *= fade; R *= fade
# Gentle bus compression and loudness normalisation.
for buf in (L, R): buf[:] = np.tanh(buf * 1.2) / 1.2
peak = max(np.abs(L).max(), np.abs(R).max()); L /= peak * 1.12; R /= peak * 1.12
data = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('ok', DUR, 's', 'tempo', round(60 / BEAT, 1), 'BPM')
