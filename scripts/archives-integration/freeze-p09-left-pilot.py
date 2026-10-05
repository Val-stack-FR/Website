"""Create the first selected detail ROI with a reviewed, isolated helper."""
from pathlib import Path
from hashlib import sha256
import importlib.util
import json
import sys

harness = Path('../PHD-Maine-paleography-harness').resolve()
helper = harness / 'data/private/roi-freeze-mvp-20261004-v5/code/roi_freeze.py'
schema = helper.with_name('roi-freeze.schema.json')
assert sha256(helper.read_bytes()).hexdigest() == 'b501df4ab894321ecfe21b09b5f62a62331c4baec43398cf515c341a5a06b23b'
assert sha256(schema.read_bytes()).hexdigest() == 'df1daec75d6d71b4fdcbc520310986ba96eec7e49cf11730a94eebdbee37d1ef'
orientation_dir = Path('.private/archives-integration/p09-left-orientation-20261004-v1')
orientation = json.loads((orientation_dir / 'orientation.json').read_text(encoding='utf-8'))
assert orientation['qualified_derivative_sha256'] == 'cb1abad61a1b06e9c2ed1f66f1d235094ee2be119513053a9999fd13576a7c42'
consultation = orientation_dir / orientation['consultation_png']['file']
assert sha256(consultation.read_bytes()).hexdigest() == orientation['consultation_png']['sha256']
spec = importlib.util.spec_from_file_location('reviewed_roi_freeze_v5', helper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert sys.argv[1:] in ([], ['v2'], ['v3']), 'Only the physically inspected candidates are supported.'
candidate = sys.argv[1] if sys.argv[1:] else 'v1'
out = Path('.private/archives-integration/p09-left-pilot-roi-20261004-' + candidate)
roi = {'x': 350, 'y': 250 if candidate != 'v1' else 310, 'width': 2626, 'height': {'v1': 960, 'v2': 935, 'v3': 985}[candidate]}
module.create_freeze(consultation, out, roi, native_width=3968, native_height=2976,
                     consultation_transform='manual-clockwise-90', source_exif_tag=0,
                     source_exif_status='reported-invalid',
                     source_exif_provenance='Closed upstream media receipt; source original was not opened here.')
freeze = out / 'freeze.json'
freeze_sha = sha256(freeze.read_bytes()).hexdigest()
proof = module.verify_freeze(freeze, consultation, expected_freeze_sha256=freeze_sha, requested_roi=roi)
assert proof['passed'] and proof['native_box'] == {'x': roi['y'], 'y': 0, 'width': roi['height'], 'height': 2626}
binding = {
    'source_object_id': orientation['source_object_id'],
    'qualified_derivative_sha256': orientation['qualified_derivative_sha256'],
    'consultation_png_sha256': orientation['consultation_png']['sha256'],
    'freeze_sha256': freeze_sha,
    'crop_sha256': proof['roi_sha256'],
    'roi': roi, 'native_box': proof['native_box'],
    'transform': 'manual-clockwise-90',
    'physical_scope': 'Candidate first six body baselines, right side physically clipped; Root visual gate pending.',
    'canonical_bbox': None, 'canonical_view_id': None,
    'original_opened': False, 'old_pilot_or_reading_modified': False,
    'helper_sha256': sha256(helper.read_bytes()).hexdigest(),
    'schema_sha256': sha256(schema.read_bytes()).hexdigest(),
    'historical_orientation': 'unknown',
}
(out / 'source-binding.json').write_text(json.dumps(binding, indent=2) + '\n', encoding='utf-8')
(out / 'verification.json').write_text(json.dumps(proof, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'out': str(out.resolve()), 'freeze_sha256': freeze_sha, 'crop_sha256': proof['roi_sha256'], 'native_box': proof['native_box']}))
