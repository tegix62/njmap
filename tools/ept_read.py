# Read the points of an Entwine Point Tile (EPT) lidar set inside a square round a point, over HTTP: only the octree nodes that touch it are fetched.
# Used by tools/lidar_parts.py for the USGS sets on the public usgs-lidar-public bucket (and NOAA's, with base=).
import json, math, io, sys, urllib.request
import numpy as np, laspy
from concurrent.futures import ThreadPoolExecutor
BASE='https://s3-us-west-2.amazonaws.com/usgs-lidar-public/'
def merc(lon,lat): return lon*20037508.34/180, math.log(math.tan((90+lat)*math.pi/360))*6378137
def get(u): 
    for i in range(4):
        try: return urllib.request.urlopen(u, timeout=60).read()
        except Exception as e: err=e
    raise err
def points(ds, lon, lat, R, depth_max=None, base=None):
    global BASE
    if base: BASE=base
    meta=json.loads(get(BASE+ds+'/ept.json'))
    b=meta['bounds']
    from pyproj import Transformer
    cx,cy=Transformer.from_crs(4326,int(meta['srs']['horizontal']),always_xy=True).transform(lon,lat)
    q=(cx-R,cy-R,cx+R,cy+R)
    hier={}
    def load_h(key):
        hier.update(json.loads(get(BASE+ds+f'/ept-hierarchy/{key}.json')))
    load_h('0-0-0-0')
    out=[]; todo=[(0,0,0,0,b)]; keys=[]
    while todo:
        d,x,y,z,bb=todo.pop()
        k=f'{d}-{x}-{y}-{z}'
        if k not in hier: continue
        if hier[k]==-1: load_h(k)
        if bb[3]<q[0] or bb[0]>q[2] or bb[4]<q[1] or bb[1]>q[3]: continue
        if hier.get(k,0)>0: keys.append(k)
        mx,my,mz=[(bb[i]+bb[i+3])/2 for i in range(3)]
        for dx in (0,1):
            for dy in (0,1):
                for dz in (0,1):
                    nb=[mx if dx else bb[0], my if dy else bb[1], mz if dz else bb[2], bb[3] if dx else mx, bb[4] if dy else my, bb[5] if dz else mz]
                    todo.append((d+1,2*x+dx,2*y+dy,2*z+dz,nb))
    def rd(k):
        las=laspy.read(io.BytesIO(get(BASE+ds+f'/ept-data/{k}.laz')))
        X,Y,Z=np.asarray(las.x),np.asarray(las.y),np.asarray(las.z); C=np.asarray(las.classification)
        m=(X>=q[0])&(X<=q[2])&(Y>=q[1])&(Y<=q[3])
        return X[m],Y[m],Z[m],C[m]
    with ThreadPoolExecutor(12) as ex: res=list(ex.map(rd,keys))
    X,Y,Z,C=(np.concatenate([r[i] for r in res]) for i in range(4))
    return X,Y,Z,C,len(keys)
if __name__=='__main__':
    ds,lon,lat,R=sys.argv[1],float(sys.argv[2]),float(sys.argv[3]),float(sys.argv[4])
    X,Y,Z,C,n=points(ds,lon,lat,R,base=sys.argv[5] if len(sys.argv)>5 else None)
    print(ds,'nodes',n,'points',len(X),'z',Z.min() if len(Z) else None,Z.max() if len(Z) else None, 'classes',np.unique(C)[:10])
