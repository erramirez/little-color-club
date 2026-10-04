"""Read-only raster quality checks; never rewrites generated assets."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
def enclosed_sizes(mask):
 parent=[]; counts=[]; edges=[]; previous=[]
 def find(i):
  while parent[i]!=i:
   parent[i]=parent[parent[i]];i=parent[i]
  return i
 def union(a,b):
  a,b=find(a),find(b)
  if a!=b:parent[b]=a;counts[a]+=counts[b];edges[a]|=edges[b]
 for y,row in enumerate(mask):
  changes=np.flatnonzero(np.diff(np.r_[False,row,False]))
  current=[];j=0
  for start,end in zip(changes[::2],changes[1::2]):
   i=len(parent);parent.append(i);counts.append(int(end-start));edges.append(y in (0,len(mask)-1) or start==0 or end==len(row));current.append((start,end,i))
   while j<len(previous) and previous[j][1]<=start:j+=1
   k=j
   while k<len(previous) and previous[k][0]<end:
    union(i,previous[k][2]);k+=1
  previous=current
 return [counts[i] for i in range(len(parent)) if parent[i]==i and not edges[i] and counts[i]>=100]
def thin_ink_fraction(mask):
 def widths(m):
  x=np.arange(m.shape[1])[None,:]
  left=np.concatenate((np.zeros((m.shape[0],1),dtype=bool),m[:,:-1]),axis=1)
  right=np.concatenate((m[:,1:],np.zeros((m.shape[0],1),dtype=bool)),axis=1)
  starts=np.maximum.accumulate(np.where(m & ~left,x,-1),axis=1)
  ends=np.minimum.accumulate(np.where(m & ~right,x,m.shape[1])[:,::-1],axis=1)[:,::-1]
  return ends-starts+1
 if not mask.any():return 0
 thickness=np.minimum(widths(mask),widths(mask.T).T)
 return float((thickness[mask]<=2).mean())
root=Path(__file__).resolve().parents[1]
report=[]
for page in json.loads((root/'art-review/catalog.json').read_text()):
 path=root/'dist/pages'/page.get('asset',f"{page['id']}.png")
 if not path.exists(): continue
 im=Image.open(path).convert('RGB'); a=np.asarray(im); gray=a.mean(axis=2)
 dark=gray<100; white=gray>245
 colors=np.max(a.astype(int),axis=2)-np.min(a.astype(int),axis=2)
 # Measure enclosed white regions at the actual 900px drawing resolution.
 small=np.asarray(im.resize((900,900),Image.Resampling.LANCZOS)).mean(axis=2)
 enclosed=enclosed_sizes(small>223)
 failures=[]
 if page.get('revision')==2 and sum(v<900 for v in enclosed)>25:failures.append('too many small regions')
 if page.get('revision')==2 and len(enclosed)>80:failures.append('too many enclosed regions')
 if page.get('revision')==2 and thin_ink_fraction(small<100)>.10:failures.append('too many thin ink runs')
 if min(im.size)<1000:failures.append('low resolution')
 if white.mean()<.65:failures.append('too little white coloring space')
 if dark.mean()<.005 or dark.mean()>.20:failures.append('unexpected ink coverage')
 if (colors>15).mean()>.005:failures.append('unwanted color')
 if len(enclosed)<5:failures.append('few enclosed tap-fill areas')
 report.append(dict(id=page['id'],title=page['title'],size=im.size,white_fraction=round(float(white.mean()),4),ink_fraction=round(float(dark.mean()),4),colored_fraction=round(float((colors>15).mean()),5),enclosed_regions=len(enclosed),largest_enclosed_pixels=max(enclosed,default=0),small_regions=sum(100<=v<900 for v in enclosed),large_regions=sum(v>=900 for v in enclosed),median_region_pixels=round(float(np.median(enclosed)),1) if enclosed else 0,thin_ink_fraction=round(thin_ink_fraction(small<100),4),failures=failures))
(root/'art-review/raster-checks.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'checked':len(report),'flagged':[p for p in report if p['failures']]}))
