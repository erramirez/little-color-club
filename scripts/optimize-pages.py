"""Retain full resolution; remove subtle RGB tint without quantizing outlines.
Originals live outside the repo. Brightest-channel grayscale preserves the dark-line
barrier at every threshold in the source image. No dimensions or shapes change.
"""
from pathlib import Path
from PIL import Image
import numpy as np
import shutil, json
root = Path(__file__).resolve().parents[1]
backup = Path('/private/tmp/color-club-original-pages-20261004')
backup.mkdir(exist_ok=True)
results = []
for path in sorted((root / 'dist/pages').glob('*.png')):
    original = backup / path.name
    if not original.exists(): shutil.copy2(path, original)
    image = Image.open(original).convert('RGB')
    pixels = np.array(image)
    gray = pixels.max(axis=2)
    assert np.array_equal(pixels.max(axis=2) < 105, gray < 105)
    Image.fromarray(gray).save(path, 'PNG', optimize=True)
    decoded = np.array(Image.open(path))
    assert np.array_equal(gray, decoded)
    results.append({'file': path.name, 'before': original.stat().st_size,
                    'after': path.stat().st_size, 'width': image.width,
                    'height': image.height, 'maximum_channel_change': int((pixels.max(2)-pixels.min(2)).max())})
(root / 'art-review/optimization-2026-10-04.json').write_text(json.dumps(results, indent=2))
print(json.dumps({'pages': len(results), 'before': sum(r['before'] for r in results),
                  'after': sum(r['after'] for r in results), 'originals': str(backup)}))
