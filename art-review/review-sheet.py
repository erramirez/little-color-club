import json,sys
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
pages=[p for p in json.loads((root/'art-review/catalog.json').read_text()) if p['theme']==sys.argv[1]]
s=Image.new('RGB',(1680,900),'#eee9dd');d=ImageDraw.Draw(s)
for i,p in enumerate(pages):
 path=root/'dist/pages'/f"{p['id']}.png"
 x=(i%4)*420+12;y=(i//4)*450+10
 if path.exists():
  im=Image.open(path);im.thumbnail((395,395));s.paste(im,(x,y))
 d.text((x,y+405),p['title'],fill='black')
s.save(root/'art-review'/f'{sys.argv[1].lower().replace(" ","-")}-review.jpg',quality=92)
