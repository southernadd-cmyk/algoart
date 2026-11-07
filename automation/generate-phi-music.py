#!/usr/bin/env python3
"""Deterministic PROPORTION PIECE φ audio studies. Original synthesis; no samples.
Requires numpy and ffmpeg. Output: three Ogg Vorbis recordings.
"""
import argparse, math, subprocess, tempfile, wave
from pathlib import Path
import numpy as np

PHI=(1+5**.5)/2
ANGLE=2*math.pi/(PHI*PHI)
FS=24000

def blank(seconds):
    return np.zeros((round(seconds*FS),2),dtype=np.float32)

def place(y,start,sound,pan=0.,gain=1.):
    i=round(FS*start)
    if i>=len(y):return
    n=min(len(sound),len(y)-i)
    if n<=0:return
    left=math.cos((pan+1)*math.pi/4)
    right=math.sin((pan+1)*math.pi/4)
    y[i:i+n,0]+=sound[:n]*gain*left
    y[i:i+n,1]+=sound[:n]*gain*right

def pad(freq,seconds,amp=.3,wobble=.05,harmonics=(1.,.22,.09),rise=1.2,fall=1.8,phase=0.):
    n=round(seconds*FS);t=np.arange(n,dtype=np.float64)/FS
    warp=.0018*np.sin(2*np.pi*wobble*t+phase)+.0006*np.sin(2*np.pi*(wobble/PHI)*t+phase*.7)
    carrier=2*np.pi*freq*(t+warp)
    v=np.zeros(n,dtype=np.float64)
    for h,a in enumerate(harmonics,1):
        v+=a*np.sin(carrier*h+(h-1)*.19)
    attack=np.minimum(1,t/max(.02,rise))**1.6
    release=np.minimum(1,np.maximum(0,seconds-t)/max(.02,fall))**1.6
    return (v*attack*release*amp).astype(np.float32)

def bell(freq,seconds=4.,brightness=.8):
    n=round(seconds*FS);t=np.arange(n,dtype=np.float64)/FS
    harmonics=[(1,1),(2.005,.16*brightness),(3.87,.10*brightness),(5.21,.048*brightness)]
    v=np.zeros(n,dtype=np.float64)
    for k,(ratio,weight) in enumerate(harmonics):
        v+=weight*np.sin(2*np.pi*freq*ratio*t+.13*k)*np.exp(-t/(1.0+1.8/(k+1)))
    return (v*(1-np.exp(-t/.009))*.20).astype(np.float32)

def midi(n):return 440*2**((n-69)/12)

def resonance():
    """Simultaneous sound frequencies are exact powers of φ, not octave tuning."""
    y=blank(89)
    anchors=[0,13,34,55,68,89]
    for section,(start,end) in enumerate(zip(anchors,anchors[1:])):
        length=end-start
        root=86*(PHI**((section%3)*.14))
        for k in range(5):
            freq=root*PHI**k
            a=(.18 if section in (0,4) else .26)*PHI**(-.58*k)
            s=pad(freq,length+1.3,amp=a,wobble=.028+.006*k,rise=2.2,fall=3.4,phase=section*.73+k*ANGLE)
            place(y,max(0,start-.45),s,pan=math.sin(k*ANGLE)*.45)
    for start,finish,freq in ((0,34,43),(34,55,53),(55,89,43)):
        place(y,start,pad(freq,finish-start+2,.125,.022,(1.,.07),3,4,phase=.3),pan=-.05)
    return y

def angle():
    """Golden-angle phase determines note selection, stereo position, and onsets."""
    y=blank(89)
    notes=[50,53,55,57,60,62,65,67,69,72,74,77]
    sections=[(0,21,0),(21,34,3),(34,55,-2),(55,89,5)]
    t=.2;j=0
    while t<88:
        phase=(j*ANGLE)%(2*math.pi)
        idx=round((phase/(2*math.pi))*len(notes))%len(notes)
        shift=next((s[2] for s in sections if s[0]<=t<s[1]),0)
        m=notes[idx]+shift
        f=(t/55)**1.2 if t<=55 else max(.25,(89-t)/34)**.8
        place(y,t,bell(midi(m),3.65,.74),pan=math.sin(phase)*.72,gain=.47+.48*f)
        if j%8 in (0,3):
            place(y,t+.07,bell(midi(m-12),5.2,.4),pan=-math.sin(phase)*.45,gain=.32)
        t+=.67+.38*((j*PHI)%1)+(.11 if j%13 in (0,5,8) else 0)
        j+=1
    place(y,0,pad(midi(38),89,.095,.013,(1.,.12),5,7),pan=0)
    reverb=y.copy()
    for delay,gain in ((.173,.19),(.277,.13),(.443,.08)):
        shift=int(delay*FS)
        y[shift:]+=reverb[:-shift]*gain
    return y

def measure():
    """Fibonacci 34:21:34 structure, with guaranteed change at 55/89 = 61.8%."""
    y=blank(89)
    chords=[(50,57,62),(53,60,65),(55,62,67),(48,55,60)]
    for start,end,ci in ((0,21,0),(21,34,1),(34,55,2),(55,76,3),(76,89,0)):
        for k,n in enumerate(chords[ci]):
            a=.055 if start<34 else .078
            place(y,start,pad(midi(n-12),end-start+1.1,a,.032,(1.,.15,.04),2.3,3.3,phase=k*1.3),pan=(k-1)*.35)
    fib=[1,2,3,5,8,5,3,2]
    t=1.2;k=0
    while t<87:
        ci=0 if t<21 else 1 if t<34 else 2 if t<55 else 3 if t<76 else 0
        chord=chords[ci]
        pitch=chord[(k*2+int((k*PHI)%3))%3]+(12 if k%8==5 else 0)
        a=.7 if t<34 else (1 if t<55 else .65)
        place(y,t,bell(midi(pitch),4,.45),pan=math.sin(k*ANGLE)*.3,gain=a*.85)
        t+=fib[k%len(fib)]*.52;k+=1
    for q,offset in enumerate((0,3,7)):
        place(y,55,bell(midi(62+offset),6.3,.65),pan=(q-1)*.3,gain=.53)
    for start in np.arange(0,89,PHI**2*2.5):
        place(y,float(start),bell(midi(38),5,.14),pan=.12,gain=.18)
    return y

def finish(y):
    a=min(len(y)//3,round(1.2*FS));b=min(len(y)//3,round(2.8*FS))
    y[:a]*=np.linspace(0,1,a)[:,None]
    y[-b:]*=np.linspace(1,0,b)[:,None]
    peak=np.max(np.abs(y))
    if peak>0:y=y*(.75/peak)
    return np.clip(y,-.87,.87)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--outdir',default='gallery/visit/audio')
    args=parser.parse_args()
    out=Path(args.outdir);out.mkdir(parents=True,exist_ok=True)
    for name,y in [('phi-resonances',resonance()),('golden-angle',angle()),('golden-measure',measure())]:
        y=finish(y);target=out/(name+'.ogg')
        with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
            with wave.open(tmp.name,'wb') as wf:
                wf.setnchannels(2);wf.setsampwidth(2);wf.setframerate(FS)
                wf.writeframes((np.clip(y,-1,1)*32767).astype('<i2').tobytes())
            subprocess.run(['ffmpeg','-v','error','-y','-i',tmp.name,'-c:a','libvorbis','-q:a','3',str(target)],check=True)
        print(f'{target}: {target.stat().st_size} bytes, {len(y)/FS:.0f}s')

if __name__=='__main__':main()
