"""Read-only analytical orientation of one qualified derivative, never an original."""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image

source = Path('../PHD-Maine-archives-import/data/private/media-release/p09-rest-prepared-20261004-v1/candidate/media/cb1abad61a1b06e9c2ed1f66f1d235094ee2be119513053a9999fd13576a7c42.jpg')
out = Path('.private/archives-integration/p09-left-orientation-20261004-v1')
assert not out.exists(), 'Fresh orientation record required'
raw = source.read_bytes()
assert len(raw) == 3522303 and sha256(raw).hexdigest() == source.stem
with Image.open(source) as image:
    assert image.size == (3968, 2976) and image.mode == 'RGB'
    # Chosen from observed baselines, not inferred from invalid source EXIF 0.
    oriented = image.transpose(Image.Transpose.ROTATE_270)
    assert oriented.size == (2976, 3968)
    out.mkdir()
    target = out / 'consultation-cw90.png'
    oriented.save(target, format='PNG')
record = {
    'source_object_id': 'object:path-e76414a7078ef7de151189fb156b8d85bec253e7945b495508ae19c98731ca99',
    'qualified_derivative_sha256': source.stem,
    'original_opened': False,
    'native_dimensions': [3968, 2976],
    'consultation_dimensions': [2976, 3968],
    'consultation_transform': 'manual-cw90-after-physical-observation',
    'source_exif_value_reported_by_upstream': 0,
    'source_exif_status': 'invalid-reported',
    'historical_orientation': 'unknown',
    'resampling': False,
    'source_derivative_modified': False,
    'canonical_view_id': None,
    'canonical_bbox': None,
    'text_or_reading_created': False,
    'consultation_png': {'file': target.name, 'sha256': sha256(target.read_bytes()).hexdigest(), 'bytes': target.stat().st_size},
}
(out / 'orientation.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'path': str(target.resolve()), 'record': str((out / 'orientation.json').resolve()), 'consultation_dimensions': record['consultation_dimensions']}))
