"""Freeze the physically inspected partial body; earlier six-fragment crops stay immutable."""
from pathlib import Path
from hashlib import sha256
import importlib.util
import json
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
spec = importlib.util.spec_from_file_location('reviewed_left_body_roi_freeze_v5', helper)
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
out = Path('.private/archives-integration/p09-left-full-view-roi-20261004-v1')
roi = {'x': 350, 'y': 250, 'width': 2626, 'height': 3300}
module.create_freeze(consultation, out, roi, native_width=3968, native_height=2976,
                     consultation_transform='manual-clockwise-90', source_exif_tag=0,
                     source_exif_status='reported-invalid',
                     source_exif_provenance='Closed upstream media receipt; no original opened here.')
freeze_sha = sha256((out / 'freeze.json').read_bytes()).hexdigest()
proof = module.verify_freeze(out / 'freeze.json', consultation, expected_freeze_sha256=freeze_sha, requested_roi=roi)
assert proof['passed'] and proof['native_box'] == {'x': 250, 'y': 0, 'width': 3300, 'height': 2626}
binding = {'source_object_id': orientation['source_object_id'], 'qualified_derivative_sha256': orientation['qualified_derivative_sha256'],
           'consultation_png_sha256': orientation['consultation_png']['sha256'], 'freeze_sha256': freeze_sha,
           'crop_sha256': proof['roi_sha256'], 'roi': roi, 'native_box': proof['native_box'],
           'transform': 'manual-clockwise-90', 'physical_scope': 'Partial left body across visible physical baselines; right side clipped. Upper annotations and bottom stamp are not body text. Final crop inspection pending.',
           'word_bbox': None, 'canonical_view_id': None, 'historical_orientation': 'unknown',
           'original_opened': False, 'prior_readings_modified': False, 'helper_sha256': sha256(helper.read_bytes()).hexdigest(), 'schema_sha256': sha256(schema.read_bytes()).hexdigest()}
for name, data in [('source-binding.json', binding), ('verification.json', proof)]:
    with (out / name).open('x', encoding='utf-8', newline='\n') as stream: json.dump(data, stream, indent=2); stream.write('\n')
print(json.dumps({'out': str(out.resolve()), 'freeze_sha256': freeze_sha, 'crop_sha256': proof['roi_sha256'], 'native_box': proof['native_box']}))
