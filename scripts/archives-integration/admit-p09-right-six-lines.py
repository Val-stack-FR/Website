"""Root inspection of one qualified EXIF6 derivative ROI, with exact pixels."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps

source = Path('Z:/Codex/repos/PHD-Maine-paleography-harness/data/private/transcription-campaign/p09-right-six-line-roi-preparation-20261004-v1')
output = Path.cwd() / '.private/archives-integration/p09-right-six-lines-physical-admission-20261004-v1'
digest = lambda data: hashlib.sha256(data).hexdigest()
freeze_bytes = (source / 'freeze.json').read_bytes()
assert digest(freeze_bytes) == '0e52a9f417e73900081b0080d4953b25fe115165c46c10a6c6bb642658e8a38b'
freeze = json.loads(freeze_bytes)
for record in freeze['outputs']:
    assert digest((source / record['path']).read_bytes()) == record['sha256']
jpeg = source / 'qualified-derivative.reference.jpg'
assert digest(jpeg.read_bytes()) == 'cfadf5a4f4b9639cf2eb0cf78f62e97299df6804705413d98783f68b87a9b798'
with Image.open(jpeg) as native, Image.open(source / 'roi.png') as roi:
    assert native.size == (3968, 2976) and native.getexif().get(274) == 6
    consultation = ImageOps.exif_transpose(native).convert('RGB')
    assert consultation.size == (2976, 3968) and roi.size == (1800, 905)
    a = consultation.crop((200, 575, 2000, 1480))
    b = native.convert('RGB').crop((575, 976, 1480, 2776)).transpose(Image.Transpose.ROTATE_270)
    assert a.tobytes() == b.tobytes() == roi.convert('RGB').tobytes()
output.mkdir()
proof = {'passed': True, 'verdict': 'GO-SIX-PARTIAL-LOCAL-LINE-FRAGMENTS-FOR-READING',
    'freeze_sha256': digest(freeze_bytes), 'roi_sha256': '1dc59e2bfe5112f379d46a66caefacda6bf025365b4b5747a661914d32d7aa19',
    'source_jpeg_sha256': digest(jpeg.read_bytes()), 'root_inspected': ['roi.png', 'six-baselines.preview.png', 'consultation.preview.png', 'measurement.context.png'],
    'consultation_ltwh': [200,575,1800,905], 'native_ltwh': [575,976,905,1800], 'exif': 6,
    'pixels_from_both_frames_exact': True, 'local_lines': ['R01','R02','R03','R04','R05','R06'],
    'both_horizontal_ends_outside_roi': True, 'R01_top_and_R06_bottom_may_be_partial': True,
    'previous_overview_and_left_exposure_declared': True, 'blind_reading_claim': False,
    'new_originals_opened': 0, 'accepted_readings': 0, 'public_mount_executed': False}
(output / 'verification.json').write_text(json.dumps(proof, indent=2) + '\n', encoding='utf-8')
(output / 'HANDOFF.md').write_text('# P09 droite — admission de six fragments\n\nRoot a inspecté ROI, six baselines et deux contextes. Les six groupes sont distincts et successifs ; '
    'leurs extrémités horizontales sont coupées, R01 haut/R06 bas potentiellement partiels. '
    'Pixels vérifiés fraîchement dans consultation EXIF6 et rectangle natif pivoté, orientation une seule fois. '
    'GO pour lecture indépendante de ces seuls fragments avec lacunes aux bords ; aucun texte/identité/continuité confirmé et aucune lecture absolument aveugle revendiquée. '
    'Les sorties fermées et le JPEG qualifié restent exacts.\n', encoding='utf-8')
print(json.dumps({'passed': True, 'admitted_local_fragments': 6, 'accepted_readings': 0}))
