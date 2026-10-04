"""Compare local revision density with the previous illustrations."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
review=root/'art-review';rev=review/'revision-2'
before={p['id']:p for p in json.loads((rev/'before-raster-checks.json').read_text())}
after={p['id']:p for p in json.loads((review/'raster-checks.json').read_text())}
catalog=json.loads((review/'catalog.json').read_text())
rows=[]
for p in catalog:
 a=after[p['id']];b=before.get(p['id']);kind='retained' if p.get('revision')!=2 else ('new-graphic-novel' if p['theme']=='Graphic Novels' else 'simplified')
 rows.append(dict(id=p['id'],title=p['title'],kind=kind,before_regions=b['enclosed_regions'] if b else None,after_regions=a['enclosed_regions'],before_small_regions=b['small_regions'] if b else None,after_small_regions=a['small_regions'],after_thin_ink_fraction=a['thin_ink_fraction'],flags=a['failures']))
simplified=[r for r in rows if r['kind']=='simplified'];novels=[r for r in rows if r['kind']=='new-graphic-novel']
old_cat=json.loads((rev/'before-catalog.json').read_text());old_comics=[before[p['id']] for p in old_cat if p['theme']=='Comics']
mean=lambda xs:round(sum(xs)/len(xs),1)
summary=dict(total_pages=len(rows),simplified=len(simplified),new_graphic_novel_scenes=len(novels),retained=sum(r['kind']=='retained' for r in rows),before_mean_regions=mean([p['enclosed_regions'] for p in before.values()]),after_mean_regions=mean([p['enclosed_regions'] for p in after.values()]),simplified_before_mean_regions=mean([r['before_regions'] for r in simplified]),simplified_after_mean_regions=mean([r['after_regions'] for r in simplified]),simplified_before_small_regions=sum(r['before_small_regions'] for r in simplified),simplified_after_small_regions=sum(r['after_small_regions'] for r in simplified),old_comic_mean_regions=mean([p['enclosed_regions'] for p in old_comics]),new_graphic_novel_mean_regions=mean([r['after_regions'] for r in novels]),all_max_regions=max(p['enclosed_regions'] for p in after.values()),redrawn_max_small_regions=max(r['after_small_regions'] for r in rows if r['kind']!='retained'),flags=[r for r in rows if r['flags']])
(rev/'comparisons.json').write_text(json.dumps(dict(summary=summary,pages=rows),indent=2,ensure_ascii=False)+'\n')
print(json.dumps(summary))
