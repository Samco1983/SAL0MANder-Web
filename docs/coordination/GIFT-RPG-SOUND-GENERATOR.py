"""Original SAL0MANder sound design; mathematical synthesis, no samples or copied music.
Requires Python 3 + NumPy. Run: python generate_library.py [--only CUE_ID]
"""
from pathlib import Path
import argparse, hashlib, json, math, wave
import numpy as np

ROOT = Path(__file__).resolve().parent
SR = 44100

def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)

def envelope(t, duration, attack=0.008, release=0.15, decay=2.0):
    return np.sin(np.minimum(t / attack, 1) * np.pi / 2) ** 2 * np.exp(-decay * t / duration) * np.sin(np.minimum(np.maximum(duration-t, 0) / release, 1) * np.pi / 2) ** 2

def tone(midi, duration, kind='bell'):
    t = np.arange(round(duration * SR)) / SR
    f = hz(midi)
    if kind == 'warm':
        sound = sum(amp * np.sin(2*np.pi*f*ratio*t + phase) for ratio, amp, phase in [(1, .72, 0), (1.002, .16, .3), (2, .20, .2), (3, .075, .5), (.5, .09, .1)])
        return sound * envelope(t, duration, .075, .35, .35)
    if kind == 'harp':
        sound = sum((.7 / k**1.6) * np.sin(2*np.pi*f*k*t) * np.exp(-k*.7*t) for k in range(1, 7) if f*k < 18000)
        return sound * envelope(t, duration, .003, .11, 2.3)
    if kind == 'soft':
        sound = .8*np.sin(2*np.pi*f*t) + .16*np.sin(2*np.pi*f*2*t) + .04*np.sin(2*np.pi*f*3*t)
        return sound * envelope(t, duration, .013, .07, 1.2)
    # A struck bell's higher partials decay faster than its mellow fundamental.
    sound = np.zeros(len(t))
    for ratio, amp, fall in [(1, .72, 1.5), (2.01, .23, 3.5), (3.96, .075, 6), (6.14, .035, 9)]:
        if f*ratio < 18000:
            sound += amp*np.sin(2*np.pi*f*ratio*t)*np.exp(-fall*t)
    return sound * envelope(t, duration, .006, .14, .5)

class Cue:
    def __init__(self, name, duration):
        self.name = name
        self.duration = duration
        self.audio = np.zeros((round(duration * SR), 2), dtype=np.float64)
        self.rng = np.random.default_rng(int(hashlib.sha256(name.encode()).hexdigest()[:8], 16))
    def add(self, signal, start, gain=1, pan=0):
        offset = max(0, round(start * SR))
        n = min(len(signal), len(self.audio)-offset)
        if n <= 0: return
        angle = (pan+1)*np.pi/4
        self.audio[offset:offset+n, 0] += signal[:n]*gain*np.cos(angle)
        self.audio[offset:offset+n, 1] += signal[:n]*gain*np.sin(angle)
    def note(self, midi, start, duration=.6, gain=.3, kind='bell', pan=0):
        self.add(tone(midi, duration, kind), start, gain, pan)
    def chord(self, notes, start, duration, gain=.2, kind='warm'):
        for i, midi in enumerate(notes):
            self.note(midi, start, duration, gain/math.sqrt(len(notes)), kind, -.45+.9*i/max(1,len(notes)-1))
    def arp(self, notes, start=0, spacing=.1, duration=.65, gain=.3, kind='harp', alternate=True):
        for i, midi in enumerate(notes):
            self.note(midi, start+i*spacing, duration, gain, kind, (-.42 if i%2 == 0 else .42) if alternate else 0)
    def air(self, start, duration, gain=.08, low=900, high=6500, shape='swell', pan=0):
        n = round(duration * SR)
        t = np.arange(n)/SR
        spectrum = np.fft.rfft(self.rng.standard_normal(n))
        freq = np.fft.rfftfreq(n, 1/SR)
        mask = np.clip((freq-low)/max(100,low), 0, 1)*np.clip((high-freq)/max(200,high*.3),0,1)
        sound = np.fft.irfft(spectrum*mask, n)
        sound /= max(np.max(np.abs(sound)), 1e-8)
        shape_env = np.sin(np.pi*t/duration)**2 if shape == 'swell' else envelope(t,duration,.003,.04,4)
        self.add(sound*shape_env,start,gain,pan)
    def sweep(self, start, duration, first=280, last=1700, gain=.12, pan=0):
        t=np.arange(round(duration*SR))/SR
        freq=first*(last/first)**(t/duration)
        phase=2*np.pi*np.cumsum(freq)/SR
        sound=(np.sin(phase)+.2*np.sin(phase*2))*envelope(t,duration,.025,.08,1.1)
        self.add(sound,start,gain,pan)
    def impact(self, start=0, gain=.15, duration=.28, low=115):
        self.sweep(start,duration,low,low*.45,gain)
        self.air(start,.10,gain*.3,1800,8000,'hit')
    def finish(self, peak=.40, reverb=.17):
        dry = self.audio.copy()
        for seconds, strength, swap in [(.037,.45,False),(.071,.35,True),(.113,.28,False),(.179,.21,True),(.241,.15,False)]:
            delay = round(seconds * SR)
            source=dry[:,::-1] if swap else dry
            self.audio[delay:] += source[:-delay] * reverb * strength
        self.audio -= self.audio.mean(axis=0)
        fade_in=min(round(.003*SR),len(self.audio))
        fade_out=min(round(.055*SR),len(self.audio))
        self.audio[:fade_in] *= np.sin(np.linspace(0,np.pi/2,fade_in))[:,None]**2
        self.audio[-fade_out:] *= np.cos(np.linspace(0,np.pi/2,fade_out))[:,None]**2
        highest = np.max(np.abs(self.audio))
        if highest: self.audio *= peak/highest
        self.audio[0]=0
        self.audio[-1]=0
        return np.rint(self.audio*32767).astype('<i2')

def victory_warm(c):
    c.impact(.03,.13,.30,130)
    c.air(.0,.7,.09,1200,7500)
    c.chord([48,55,60,64,69],.03,2.25,.25)
    c.arp([72,76,79,86,88,79,84],.11,.18,1.35,.31,'harp')
    c.chord([53,60,64,69],.75,1.75,.19)
    c.chord([48,55,62,64,72],1.47,2.55,.26)
    c.arp([84,88,91],1.47,.085,1.8,.22,'bell')
    c.note(96,1.92,1.2,.085,'bell',.25)

def victory_crystal(c):
    c.chord([62,69,74,78],.05,2.8,.18)
    c.arp([74,81,86,90],.0,.105,1.35,.29,'bell')
    c.arp([81,78,86],.66,.16,1.8,.23,'harp')
    c.air(.55,1,.055,3600,11500,pan=.4)
    c.note(98,1.16,1.45,.10,'bell',-.4)

def victory_heroic(c):
    for t in [0,.28,.56]: c.impact(t,.12,.25,100)
    c.chord([43,50,55,59],.05,2.1,.31)
    c.arp([67,67,74,71],.08,.24,.6,.24,'soft')
    c.air(.72,1.0,.10,700,6200)
    c.chord([48,55,60,64],1.05,2.2,.25)
    c.arp([76,79,84,86],1.02,.15,1.55,.25,'harp')
    c.chord([43,50,59,62,67],1.96,2.65,.33)
    c.arp([83,86,91],2.0,.075,1.65,.21,'bell')

def victory_quiet(c):
    c.chord([53,60,64,69],.12,3.25,.21)
    c.arp([77,84,81],.0,.26,1.9,.24,'harp')
    c.air(.12,1.4,.035,1800,8500)
    c.note(88,1.12,1.7,.15,'bell',.5)
    c.chord([60,65,69,72],1.25,2.10,.17)

def heart_bloom(c):
    c.impact(.04,.16,.22,155)
    c.impact(.26,.13,.24,130)
    c.chord([60,64,69],.15,1.8,.19)
    c.arp([76,79,84,88,91],.23,.11,1.1,.23,'bell')
    c.air(.2,.55,.08,1600,9000)

def heart_confetti(c):
    c.impact(.02,.15,.16,190)
    for i,m in enumerate([91,84,96,88,93,86,100,91]):
        c.note(m,.045+i*.047,.55,.13,'bell',-.8+i*.22)
    c.air(.02,.27,.18,2400,11000,'hit')
    c.arp([72,79,84],.05,.08,.75,.19,'harp')

def heart_hug(c):
    c.chord([57,64,69,73],.04,1.75,.25)
    c.sweep(.05,.35,300,610,.055,-.35)
    c.note(81,.20,.65,.20,'soft',-.2)
    c.note(85,.47,1.0,.18,'bell',.3)
    c.impact(.05,.08,.22,88)
    c.impact(.32,.055,.24,88)

def reveal_tile(c):
    c.air(0,.22,.10,2200,9000)
    c.sweep(.015,.18,630,1480,.055)
    c.arp([84,91],.045,.12,.60,.20,'bell')

def reveal_ripple(c):
    for i,m in enumerate([72,79,83,86,83,79]):
        c.note(m,.03+i*.15,.75,.23,'harp',math.sin(i*1.2)*.75)
    c.chord([60,67,74],.18,1.4,.14)
    c.air(.08,.40,.045,1100,5500)

def magic_stardust(c):
    for i,m in enumerate([96,88,100,91,86,98,93,103,88,96,91,100]):
        c.note(m,.03+i*.115,.64,.11+.025*(i%3),'bell',float(c.rng.uniform(-.85,.85)))
    c.chord([60,67,71],.18,1.95,.12)
    c.air(.05,1.45,.07,3000,12000)

def magic_portal(c):
    c.chord([50,57,60,65],.08,2.35,.23)
    c.sweep(.0,.85,180,920,.095,-.25)
    c.sweep(.1,.85,280,1360,.05,.25)
    c.air(.15,1.0,.09,500,6500)
    c.arp([81,84,88,93],.83,.13,1.1,.18,'bell')

def gift_box(c):
    c.impact(.0,.23,.15,210)
    c.note(55,.01,.12,.14,'harp',-.2)
    c.impact(.13,.10,.16,260)
    c.air(.12,.32,.13,1600,9000,'hit')
    c.arp([79,84,88,91],.16,.065,.85,.22,'bell')

def gift_envelope(c):
    c.air(.00,.19,.17,1800,7600,pan=-.3)
    c.air(.14,.25,.12,2600,10500,pan=.3)
    c.air(.32,.20,.09,2200,7000,pan=-.15)
    c.arp([76,83,88],.38,.085,.64,.17,'harp')

def gift_ribbon(c):
    c.arp([88,84,79,76,72],.0,.075,.67,.18,'harp')
    c.sweep(.0,.48,780,290,.045,-.2)
    c.air(.03,.44,.08,1600,7000)
    c.chord([72,76,83],.51,1.16,.17,'bell')

def correct_bright(c):
    c.note(79,0,.25,.22,'harp',-.2)
    c.note(86,.09,.49,.23,'bell',.2)
    c.air(.04,.10,.025,4200,9500,'hit')

def correct_discovery(c):
    c.arp([76,79,86],.02,.13,.62,.25,'bell')
    c.chord([60,67],.0,.88,.12)
    c.air(.05,.26,.035,1700,7500)

def correct_combo(c):
    c.impact(.0,.08,.15,210)
    c.arp([72,76,79,84,88],.01,.055,.55,.23,'harp')
    c.note(91,.32,.59,.12,'bell',.4)

def correct_gentle(c):
    c.chord([72,79],.015,.59,.22,'soft')
    c.note(84,.1,.44,.075,'bell',.2)

def piece_snap(c):
    c.impact(.00,.21,.10,320)
    c.note(67,.008,.23,.19,'harp')
    c.note(86,.035,.22,.05,'bell',.2)

def piece_rotate(c):
    c.air(.0,.075,.13,900,3800,'hit',-.2)
    c.sweep(.015,.10,520,370,.10)
    c.note(72,.045,.21,.12,'harp',.25)

def piece_cluster(c):
    for i,m in enumerate([60,67,72,76]):
        c.note(m,i*.057,.37,.20,'harp',-.35+i*.23)
        c.impact(i*.057,.06,.075,220+i*35)
    c.note(84,.23,.55,.10,'bell')

def piece_lock(c):
    c.impact(.0,.2,.14,150)
    c.note(55,.012,.22,.12,'harp',-.3)
    c.chord([72,76],.07,.43,.16,'bell')

def ui_hover(c):
    c.note(81,.0,.16,.22,'soft')
    c.note(93,.003,.10,.028,'harp')

def ui_select(c):
    c.note(79,.0,.24,.22,'harp')
    c.note(86,.028,.25,.14,'bell',.2)
    c.air(.0,.055,.035,1500,6000,'hit')

def ui_back(c):
    c.arp([76,69],.0,.065,.26,.22,'harp')
    c.air(.04,.1,.025,700,3000)

def ui_open(c):
    c.air(.0,.2,.08,1200,6500)
    c.arp([67,74,79],.02,.065,.39,.21,'harp')
    c.note(86,.15,.48,.07,'bell')

def ui_close(c):
    c.chord([64,71],.0,.4,.19,'soft')
    c.sweep(.07,.16,460,230,.07)
    c.air(.04,.19,.05,1400,6200)

def ui_retry(c):
    c.note(69,.01,.29,.22,'soft',-.15)
    c.note(67,.25,.44,.17,'harp',.15)
    c.chord([55,62],.18,.56,.095)

# Distinct recipes, not copies or filename-only variations. Gains allow mild UI playback.
CUES = [
    ('victory_warm_magic','victory',4.4,'Default: a warm rising harp fanfare, soft low impact, suspended harmony and resolving bell crown.',victory_warm,.42),
    ('victory_crystal_crown','victory',3.2,'Bright crystalline ascent with alternating stereo bells and a high sparkling crown.',victory_crystal,.38),
    ('victory_heroic_sunrise','victory',4.8,'Three soft low pulses lead a broad warm harmony into a longer rising heroic finish.',victory_heroic,.42),
    ('victory_quiet_wonder','victory',3.6,'Gentle spacious harp and suspended major-color harmony for a calm achievement.',victory_quiet,.33),
    ('heart_bloom','heart-burst',2.2,'Two soft heart-like pulses bloom into five rising bells and a warm chord.',heart_bloom,.38),
    ('heart_confetti','heart-burst',1.4,'A rounded pop throws a short scatter of high sparkles across the stereo field.',heart_confetti,.35),
    ('heart_warm_hug','heart-burst',1.9,'An embracing warm chord, paired pulse and soft rising chime; a quieter hearts option.',heart_hug,.32),
    ('magic_reveal_tile','magic-reveal',.95,'Small airy lift and two clear chimes for uncovering one picture tile.',reveal_tile,.30),
    ('magic_reveal_ripple','magic-reveal',1.8,'Six harp droplets travel left to right over a quiet open harmony.',reveal_ripple,.34),
    ('magic_stardust_shower','magic-reveal',2.4,'Twelve irregular bell sparks float through a diffuse airy shimmer.',magic_stardust,.33),
    ('magic_portal_bloom','magic-reveal',2.7,'Low suspended harmony and paired rising glides open into four distant bells.',magic_portal,.37),
    ('gift_box_pop','gift-open',1.5,'Two soft wooden-style impacts open into an airy burst and a quick bell tumble.',gift_box,.37),
    ('gift_envelope_unfold','gift-open',1.25,'Three synthesized paper-like rustles end with a light harp invitation.',gift_envelope,.31),
    ('gift_ribbon_unwind','gift-open',1.8,'A falling harp ribbon and breathy glide resolve into a welcoming bell chord.',gift_ribbon,.34),
    ('correct_bright_pick','correct-answer',.68,'Quick ascending harp-to-bell answer confirmation.',correct_bright,.29),
    ('correct_small_discovery','correct-answer',1.15,'Three rising bells with a warm low foundation for a newly discovered answer.',correct_discovery,.32),
    ('correct_combo_flourish','correct-answer',1.0,'A tight five-note harp run and small bell star for a streak or bonus.',correct_combo,.32),
    ('correct_gentle_yes','correct-answer',.7,'A mellow open interval and tiny overtone; comfortable for repeated answers.',correct_gentle,.25),
    ('piece_soft_snap','piece-place',.38,'Rounded tactile snap with a small wooden pluck and faint bright edge.',piece_snap,.29),
    ('piece_rotate_tick','piece-place',.36,'A brief hollow rustle and downward pitch turn for rotating one piece.',piece_rotate,.25),
    ('piece_cluster_settle','piece-place',.88,'Four close soft clicks and climbing plucks settle into a quiet chime.',piece_cluster,.31),
    ('piece_lock_chime','piece-place',.60,'A low cushioned lock followed by a restrained two-note glass chord.',piece_lock,.29),
    ('ui_hover_glint','UI',.20,'Very short, low-volume rounded glint; optional hover, never continuous.',ui_hover,.18),
    ('ui_select_crystal','UI',.34,'Short harp click with a delicate upper bell for a confirmed selection.',ui_select,.25),
    ('ui_back_step','UI',.43,'Two descending plucks signal a step back without sounding like an error.',ui_back,.23),
    ('ui_open_panel','UI',.72,'Three light ascending plucks and a small air swell for opening a panel.',ui_open,.26),
    ('ui_close_panel','UI',.62,'Warm short harmony folds downward with a soft breath.',ui_close,.23),
    ('ui_retry_hint','UI',.82,'Gentle descending response for try-again feedback without a harsh alarm.',ui_retry,.25),
]

def write_cue(spec):
    ident,category,duration,description,recipe,peak=spec
    cue=Cue(ident,duration)
    recipe(cue)
    pcm=cue.finish(peak)
    dest=ROOT/category/(ident+'.wav')
    dest.parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(dest),'wb') as out:
        out.setnchannels(2); out.setsampwidth(2); out.setframerate(SR); out.writeframes(pcm.tobytes())
    unit=pcm.astype(float)/32768
    measured=float(np.abs(unit).max())
    rms=float(np.sqrt(np.mean(unit**2)))
    assert np.isfinite(unit).all() and measured < .55 and np.max(np.abs(pcm)) < 32767
    assert np.all(pcm[0]==0) and np.all(pcm[-1]==0)
    return dict(id=ident,category=category,path=dest.relative_to(ROOT).as_posix(),duration_seconds=len(pcm)/SR,peak_linear=round(measured,6),peak_dbfs=round(20*np.log10(measured),2),rms_dbfs=round(20*np.log10(rms),2),sample_rate=SR,channels=2,format='PCM 16-bit WAV',bytes=dest.stat().st_size,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),description=description,recommended_gain=.65,provenance='Original deterministic mathematical synthesis; no recordings, soundfonts or copied melody.')

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--only'); args=parser.parse_args()
    specs=[s for s in CUES if args.only is None or s[0]==args.only]
    if not specs: raise SystemExit('Unknown cue id')
    items=[write_cue(spec) for spec in specs]
    assert len({item['sha256'] for item in items})==len(items)
    manifest=dict(library='SAL0MANder Original RPG Effects — first library',default_victory='victory/victory_warm_magic.wav',synthesis='NumPy additive/inharmonic synthesis, filtered deterministic noise, short stereo reflections',provenance='New original sound design. No external samples, soundfont, recordings, API or franchise music. Synthesized effects are not real animal recordings.',script='generate_library.py',script_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),cues=items)
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'cues':len(items),'default':str(ROOT/'victory/victory_warm_magic.wav'),'total_bytes':sum(x['bytes'] for x in items),'max_peak_dbfs':max(x['peak_dbfs'] for x in items)},indent=2))
if __name__=='__main__': main()
