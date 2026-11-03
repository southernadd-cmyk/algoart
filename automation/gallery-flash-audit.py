#!/usr/bin/env python3
"""Conservative frame-by-frame flash screening; NOT a WCAG conformance certificate."""
import csv,json,subprocess
from collections import deque
from fractions import Fraction
from pathlib import Path
import numpy as np

SW,SH=1152,480
W,H=576,240  # Half-size spatial area sampling; NO skipped temporal frames
PW,PH=W//3,H//2
x=np.arange(256,dtype=np.float32)/255
LIN=np.where(x<=.04045,x/12.92,((x+.055)/1.055)**2.4)

def transitions(before,after):
    a=LIN[before];b=LIN[after]
    r0,g0,b0=(a[:,:,i] for i in range(3))
    r1,g1,b1=(b[:,:,i] for i in range(3))
    y0=.2126*r0+.7152*g0+.0722*b0
    y1=.2126*r1+.7152*g1+.0722*b1
    d=y1-y0; dark=np.minimum(y0,y1)<.8
    up=(d>=.1)&dark;down=(d<=-.1)&dark
    def uv(r,g,b):
        X=.4124564*r+.3575761*g+.1804375*b
        Y=.2126729*r+.7151522*g+.0721750*b
        Z=.0193339*r+.1191920*g+.9503041*b
        den=X+15*Y+3*Z+1e-7
        return 4*X/den,9*Y/den
    u0,v0=uv(r0,g0,b0);u1,v1=uv(r1,g1,b1)
    moved=(u1-u0)**2+(v1-v0)**2>.04
    red0=(before[:,:,0].astype(np.float32)/(before.sum(axis=2,dtype=np.float32)+1e-7)>=.8)&(before[:,:,0]>12)
    red1=(after[:,:,0].astype(np.float32)/(after.sum(axis=2,dtype=np.float32)+1e-7)>=.8)&(after[:,:,0]>12)
    return up,down,(~red0)&red1&moved,red0&(~red1)&moved,float(y1.mean()),float(np.abs(d).mean())

class Region:
    def __init__(self):
        self.sign=[None,None];self.last=[-100.,-100.]
        self.finished=[deque(),deque()];self.max_pairs=[0,0];self.events=[0,0]
    def update(self,t,areas):
        for k,(positive,negative) in enumerate(((areas[0],areas[1]),(areas[2],areas[3]))):
            if max(positive,negative)<.25:continue
            direction=1 if positive>=negative else -1
            self.events[k]+=1
            if self.sign[k] is not None and direction!=self.sign[k] and t-self.last[k]<=1:
                q=self.finished[k];q.append(t)
                while q and q[0]<t-1:q.popleft()
                self.max_pairs[k]=max(self.max_pairs[k],len(q))
            self.sign[k]=direction;self.last[k]=t

def sample_regions(masks):
    out=[]
    for ya,yb,xa,xb in [(0,PH,0,PW),(0,PH//2,0,PW//2),
        (0,PH//2,PW//2,PW),(PH//2,PH,0,PW//2),(PH//2,PH,PW//2,PW)]:
        out.append(tuple(float(mask[ya:yb,xa:xb].mean()) for mask in masks))
    return out

def analyze(name,path,writer):
    metadata=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0',
      '-show_entries','stream=width,height,avg_frame_rate','-of','json',str(path)],text=True))['streams'][0]
    assert (metadata['width'],metadata['height'])==(SW,SH)
    fps=float(Fraction(metadata['avg_frame_rate']))
    assert 15<=fps<=60
    cmd=['ffmpeg','-nostdin','-v','error','-i',str(path),'-an','-vsync','0',
         '-vf',f'scale={W}:{H}:flags=area','-pix_fmt','rgb24','-f','rawvideo','pipe:1']
    pipe=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    regions=[[Region() for _ in range(5)] for _ in range(6)]
    results=[{'panel':i+1,'largest_up_area':0.,'largest_down_area':0.,
      'largest_to_red_area':0.,'largest_from_red_area':0.,'largest_mean_luminance_step':0.} for i in range(6)]
    first=[];previous=None;frames=0;size=W*H*3
    def check(previous,current,index,loop=False):
        for panel in range(6):
            y=(panel//3)*PH;x=(panel%3)*PW
            m=transitions(previous[y:y+PH,x:x+PW],current[y:y+PH,x:x+PW])
            zones=sample_regions(m[:4]);a=zones[0]
            data=results[panel]
            for key,value in zip(('largest_up_area','largest_down_area','largest_to_red_area','largest_from_red_area'),a):
                data[key]=max(data[key],round(value,6))
            data['largest_mean_luminance_step']=max(data['largest_mean_luminance_step'],round(m[5],6))
            t=index/fps
            for z,areas in enumerate(zones):regions[panel][z].update(t,areas)
            writer.writerow([name,panel+1,index,round(t,4),int(loop),
                *(round(v,6) for v in a),round(m[4],6),round(m[5],6)])
    while True:
        raw=pipe.stdout.read(size)
        if not raw:break
        if len(raw)!=size:raise RuntimeError(f'{name}: incomplete decoded frame')
        current=np.frombuffer(raw,dtype=np.uint8).reshape(H,W,3)
        if frames<=round(fps):first.append(current.copy())
        if previous is not None:check(previous,current,frames)
        previous=current;frames+=1
    error=pipe.stderr.read().decode('utf8','replace')
    if pipe.wait()!=0:raise RuntimeError(f'{name}: {error}')
    assert frames>10*fps, f'{name}: too few frames'
    for i,frame in enumerate(first):
        check(previous,frame,frames+i,True);previous=frame
    for panel,item in enumerate(results):
        item['max_general_pairs_in_any_second']=max(z.max_pairs[0] for z in regions[panel])
        item['max_red_pairs_in_any_second']=max(z.max_pairs[1] for z in regions[panel])
        item['large_area_general_transitions']=regions[panel][0].events[0]
        item['large_area_red_transitions']=regions[panel][0].events[1]
        item['review_candidate']=(item['max_general_pairs_in_any_second']>3 or
                                  item['max_red_pairs_in_any_second']>3)
    return {'name':name,'fps':fps,'frames':frames,'loop_boundary_checked':True,'panels':results}

def self_test():
    z=Region()
    for i in range(24):
        if i%3==0:
            sign=(i//3)%2;z.update(i/24,(float(sign),float(1-sign),0,0))
    assert z.max_pairs[0]>3
    a=np.zeros((PH,PW,3),dtype=np.uint8);b=np.full_like(a,255)
    assert transitions(a,b)[0].mean()==1

def main():
    self_test()
    output=Path('flash-audit-results');output.mkdir(exist_ok=True)
    files=[('bank-one',Path('gallery/visit/touchdesigner/six-screen-installation.webm')),
           ('bank-two',Path('gallery/visit/touchdesigner/bank-two/six-screen-installation.webm'))]
    with (output/'frame-by-frame.csv').open('w',newline='') as stream:
        writer=csv.writer(stream)
        writer.writerow(('video','panel','frame','time_seconds','loop_wrap','area_up',
          'area_down','area_to_red','area_from_red','mean_luminance','mean_luminance_step'))
        videos=[analyze(name,path,writer) for name,path in files]
    report={'type':'conservative automated flash screening, not WCAG certification',
      'scope':'All 12 live six-screen atlas feeds, every decoded frame, including wrap',
      'thresholds':'>=0.1 absolute linear luminance change (darker <0.8); saturated-red chromaticity shift >0.2',
      'spatial_method':'Anti-aliased half-resolution, whole-panel plus four quarter-panel regions; >=25% region area as review candidate',
      'limitations':'Does not measure gallery viewing angle, whole rendered viewport, or fallback-generated animation; not independently certified PEAT analysis',
      'videos':videos}
    (output/'summary.json').write_text(json.dumps(report,indent=2)+'\n')
    print('FRAME-BY-FRAME FLASH AUDIT (conservative screening; NOT a WCAG certificate)')
    for v in videos:
        print(f"\n{v['name']}: {v['frames']} frames at {v['fps']} fps, six panels, plus loop wrap")
        for p in v['panels']:
            print(f" panel {p['panel']}: general={p['max_general_pairs_in_any_second']} pairs/s"
              f" red={p['max_red_pairs_in_any_second']} pairs/s"
              f" max-up={p['largest_up_area']:.3f} max-down={p['largest_down_area']:.3f}"
              f" red-to={p['largest_to_red_area']:.3f} red-from={p['largest_from_red_area']:.3f}"
              f" REVIEW={p['review_candidate']}")
    print('JSON summary and all per-frame panel metrics saved as workflow artifacts.')
if __name__=='__main__':main()
