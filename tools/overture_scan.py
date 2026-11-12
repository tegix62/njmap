import sys,pickle,re,urllib.request,urllib.parse
sys.path.insert(0,'/tmp/nj')
from cands import L
import pyarrow.parquet as pq, fsspec
from concurrent.futures import ThreadPoolExecutor
base='https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/'
def keys_of(pre):
    keys=[];tok=None
    while True:
        u=base+f'?list-type=2&prefix={pre}'+(f'&continuation-token={urllib.parse.quote(tok)}' if tok else '')
        x=urllib.request.urlopen(u).read().decode()
        keys+=re.findall(r'<Key>([^<]+\.parquet)</Key>',x)
        m=re.search(r'<NextContinuationToken>([^<]+)</NextContinuationToken>',x)
        if not m:break
        tok=m.group(1)
    return keys
which=sys.argv[1]  # building | building_part | segment
if which=='segment': pre='release/2026-10-21.0/theme=transportation/type=segment/'; cols=['names','class','subtype','geometry','bbox']
else: pre=f'release/2026-10-21.0/theme=buildings/type={which}/'; cols=(['height','num_floors','names','class','geometry','bbox'] if which=='building' else ['height','min_height','geometry','bbox'])
keys=keys_of(pre);print(len(keys),'files',flush=True)
RX,RY=0.0075,0.0052
W=[(i,(lo-RX,la-RY,lo+RX,la+RY)) for i,(n,lo,la,*_) in enumerate(L)]
def scan(k):
    out=[]
    try:
        pf=pq.ParquetFile(fsspec.open(base+k,'rb',block_size=2*1024*1024).open());md=pf.metadata
        ix={md.schema.column(i).path:i for i in range(md.num_columns)}
        for g in range(md.num_row_groups):
            rg=md.row_group(g);st=lambda n:(rg.column(ix[n]).statistics.min,rg.column(ix[n]).statistics.max)
            hit=[i for i,B in W if not(st('bbox.xmax')[1]<B[0] or st('bbox.xmin')[0]>B[2] or st('bbox.ymax')[1]<B[1] or st('bbox.ymin')[0]>B[3])]
            if not hit: continue
            for r in pf.read_row_group(g,columns=cols).to_pylist():
                b=r['bbox']
                for i in hit:
                    B=dict(W)[i]
                    if B[0]<b['xmin'] and b['xmax']<B[2] and B[1]<b['ymin'] and b['ymax']<B[3]:
                        r2=dict(r);r2['geometry']=bytes(r['geometry']);r2['_i']=i;out.append(r2)
    except Exception as e: print('err',k,e,flush=True)
    return out
rows=[]
with ThreadPoolExecutor(16) as ex:
    for res in ex.map(scan,keys): rows+=res
pickle.dump(rows,open(f'/tmp/nj/{which}.pkl','wb'));print(which,len(rows),'rows',flush=True)
