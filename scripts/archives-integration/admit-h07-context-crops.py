"""Admit the two selected, visually inspected native context extracts only."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path.cwd()
base = root / '.private/archives-integration'
source = Path('Z:/Codex/repos/PHD-Maine-archives-import/data/private/media-release/h07-two-word-context-crops-20261004-v1')
review = Path('Z:/Codex/repos/PHD-Maine-paleography-harness/data/private/transcription-campaign/h07-two-word-roi-review-20261004-v1/review.json')
output = base / 'h07-context-crops-root-admission-20261004-v1'
def digest(value):
    return hashlib.sha256(value).hexdigest()
def checked(path, pin):
    value = path.read_bytes()
    assert digest(value) == pin, str(path)
    return value
mapping_bytes = checked(source / 'crop-point-route-map.json', '4c22bcf8c74cfa0e92bc6e67fde277deaf55bb7b2dcf864d71570482481e0070')
review_bytes = checked(review, '45b68a44eaa34f02d58dfdc306669285e818b0a0f7939fef10765f40c111ff67')
mapping, independent = json.loads(mapping_bytes), json.loads(review_bytes)
assert independent['verdict'] == 'GO-METADATA-AND-NATIVE-BOUNDS'
assert len(mapping['records']) == len(independent['rows']) == 2
rows = []
for record in mapping['records']:
    pair = [row for row in independent['rows'] if row['text_evidence']['point_id'] == record['existing_point_id']]
    assert len(pair) == 1
    pair = pair[0]
    assert pair['source_object_id'] == record['source_object_id']
    assert pair['selected_derivative_sha256'] == record['selected_JPEG_sha256']
    assert pair['text_evidence']['quote'] == record['exact_candidate']
    assert pair['text_evidence']['local_line_number'] == record['local_transcription_line_number']
    assert pair['proposed_context_rectangle'] == record['native_bbox_with_context']
    assert record['word_bbox'] is None and record['canonical_act_id'] is None
    jpeg = base / 'publication-package-20261004-v20/site/dist' / record['selected_JPEG_proposed_route'].lstrip('/')
    png = source / record['slug'] / 'roi.png'
    checked(jpeg, record['selected_JPEG_sha256'])
    checked(png, record['crop_sha256'])
    with Image.open(jpeg) as photo, Image.open(png) as crop:
        assert list(photo.size) == record['native_dimensions'] == [2976, 3968]
        assert record['consultation_transform'] == 'identity'
        assert photo.getexif().get(274) == record['Root_reported_selected_derivative_EXIF']
        region = photo.convert('RGB').crop(tuple(record['native_bbox_with_context']))
        assert list(crop.size) == record['crop_dimensions']
        assert region.tobytes() == crop.convert('RGB').tobytes()
        assert digest(region.tobytes()) == record['crop_decoded_pixel_sha256']
    rows.append({
        'point_id': record['existing_point_id'], 'source_object_id': record['source_object_id'],
        'candidate': record['exact_candidate'], 'local_line': record['local_transcription_line_number'],
        'jpeg_sha256': record['selected_JPEG_sha256'], 'crop_sha256': record['crop_sha256'],
        'native_rectangle': record['native_bbox_with_context'], 'route': record['proposed_public_crop_route'],
        'pixels_native_exact': True, 'root_png_visually_inspected': True,
        'context_includes_target_group_and_adjacent_word': True,
        'word_bbox': None, 'historical_confirmation': False,
    })
output.mkdir()
proof = {'passed': True, 'verdict': 'GO-TWO-NATIVE-CONTEXTS-FOR-INTEGRATION',
         'mapping_sha256': digest(mapping_bytes), 'independent_review_sha256': digest(review_bytes),
         'records': rows, 'new_originals_opened': 0, 'accepted_readings': 0}
(output / 'verification.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(output / 'HANDOFF.md').write_text(
    '# Deux contextes H07 — admission Root\n\nGO pour deux petits extraits uniquement. '
    'Les PNG E.133 et E.113 ont été ouverts en taille native par Root. '
    'Ils montrent le groupe candidat et son contexte proche ; aucune lecture historique confirmée. '
    'La revue indépendante des citations/versions/bornes est jointe par point et objet exacts. '
    'Comparaison fraîche : pixels RGB identiques aux régions des deux seuls JPEG sélectionnés v20, '
    'sans transformation, filtre ni modification des sources. '
    'Numéros locaux de transcription seulement ; word_bbox et acte canonique restent nulls. '
    'Montage public local et parcours tactile restent à vérifier.\n', encoding='utf-8')
print(json.dumps({'passed': True, 'native_contexts_admitted': len(rows), 'accepted_readings': 0}))
