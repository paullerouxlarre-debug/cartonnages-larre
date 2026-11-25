"""Original 52 s soundtrack for the process film, synthesised locally (no samples, no licence).
Steady industrial groove at 112 BPM, a soft hit on every camera cut, calmer from the packing on.
Usage: python3 outils/musique.py SORTIE.wav"""
import sys, numpy as np, wave
SR=48000; DUR=52.1; BPM=112; BEAT=60/BPM
N=int(SR*DUR); L=np.zeros(N); R=np.zeros(N)
rng=np.random.default_rng(3)
CUTS=[2.45,4,4.7,7,9.1,11.7,14,15.65,17.9,20.75,23.6,26,27.55,29,32,36,38,42,45,47.6]
def env(n,a,d):
    t=np.arange(n)/SR; e=np.minimum(1,t/a) if a>0 else np.ones(n); return e*np.exp(-t/d)
def add(sig,t,gain=1,pan=0):
    i=int(t*SR); j=min(N,i+len(sig))
    if i>=N: return
    L[i:j]+=sig[:j-i]*gain*(1-pan)*.5*2**.5/1.41; R[i:j]+=sig[:j-i]*gain*(1+pan)*.5*2**.5/1.41
def kick():
    n=int(.35*SR); t=np.arange(n)/SR; f=48+90*np.exp(-t/.03); ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*env(n,.001,.12)
def hat(open_=False):
    n=int((.18 if open_ else .05)*SR); x=rng.standard_normal(n); x=np.diff(np.concatenate([[0],x]))
    return x*env(n,.0005,.06 if open_ else .015)*.5
def clap():
    n=int(.25*SR); x=rng.standard_normal(n); e=env(n,.001,.07)
    for k in (.010,.021): e+=np.roll(env(n,.001,.01),int(k*SR))*.6
    return np.convolve(x,np.ones(6)/6,'same')*e*.5
def tone(freq,dur,shape='saw',a=.01,d=.3,det=0):
    n=int(dur*SR); t=np.arange(n)/SR; out=np.zeros(n)
    for dd in ([0] if not det else [-det,det]):
        ph=(freq*(1+dd))*t
        out+= (2*(ph%1)-1) if shape=='saw' else np.sin(2*np.pi*ph)
    return out*env(n,a,d)
def lowpass(x,c):
    a=np.broadcast_to(np.asarray(c,float),x.shape); y=np.zeros_like(x); s=0.
    for i in range(len(x)): s+=a[i]*(x[i]-s); y[i]=s
    return y
def hit():
    n=int(1.6*SR); t=np.arange(n)/SR
    boom=np.sin(2*np.pi*(38+40*np.exp(-t/.08))*t)*env(n,.002,.45)
    noise=lowpass(rng.standard_normal(n),.05)*env(n,.002,.35)
    return boom*.9+noise*.8
def riser(len_):
    n=int(len_*SR); t=np.arange(n)/SR
    x=lowpass(rng.standard_normal(n),.02+.2*(t/len_)**2)*(t/len_)**2
    return x*.35
# chords: A minor, F, C, G (one bar each), root notes in Hz
prog=[(110.0,[220,261.63,329.63]),(87.31,[174.61,220,261.63]),(130.81,[196,261.63,329.63]),(98.0,[196,246.94,293.66])]
bar=4*BEAT; nb=int(DUR/bar)+1
calm=38.0
for b in range(nb):
    t0=b*bar; root,ch=prog[b%4]
    if t0>=DUR: break
    machine=t0<calm
    # pad
    pad=sum(tone(f,bar+.4,'saw',a=.4,d=3,det=.004) for f in ch)/3
    add(lowpass(pad,.02 if machine else .012),t0,.10)
    # bass on eighths (machine) or half notes (calm)
    steps=8 if machine else 2
    for k in range(steps):
        tt=t0+k*bar/steps
        b_=tone(root/2 if k%2==0 else root,bar/steps*.9,'saw',a=.005,d=.18)
        add(lowpass(b_,.03),tt,.22 if machine else .14)
    for k in range(4):
        tb=t0+k*BEAT
        if tb<1.0 or tb>50.3: continue
        if machine or tb<45:
            add(kick(),tb,.55 if machine else .3)
        if machine and k in (1,3): add(clap(),tb,.25,.1)
        for h in range(2):
            th=tb+h*BEAT/2
            if machine: add(hat(h==1 and k==3),th,.12 if h else .07,-.3)
        # mechanical tick, like a sheet passing a sensor
        if machine: add(tone(2400,.03,'sin',a=.001,d=.008),tb+BEAT*.75,.05,.4)
for c in CUTS:
    add(riser(.6),c-.6,.6 if c<calm else .35)
    add(hit(),c,.33 if c<calm else .2)
# fades
t=np.arange(N)/SR; fade=np.minimum(1,t/1.0)*np.clip((DUR-t)/2.2,0,1)
L*=fade; R*=fade
# small room: two feedback delays
for buf in (L,R):
    for dl,g in ((int(.031*SR),.25),(int(.047*SR),.18)):
        echo=np.zeros(N); src=buf.copy()
        for k in range(1,6): echo[dl*k:]+=src[:N-dl*k]*(g*.5)**k
        buf+=echo
m=max(np.abs(L).max(),np.abs(R).max()); L/=m*1.12; R/=m*1.12
data=(np.stack([L,R],1)*32767).astype(np.int16)
with wave.open(sys.argv[1],'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('ok', DUR, 's')
