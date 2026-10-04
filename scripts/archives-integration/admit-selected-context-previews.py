"""Record Root inspection and fresh pixel checks of three bounded previews."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path.cwd()
base = root / '.private/archives-integration'
selected = base / 'publication-package-20261004-v24-r2/site/dist'
output = base / 'selected-contexts-physical-admission-20261004-v1'
digest = lambda data: hashlib.sha256(data).hexdigest()

def checked(path, expected):
    data = path.read_bytes()
    assert digest(data) == expected, str(path)
    return data

def pixels(jpeg, jpeg_sha, png, png_sha, bbox, dimensions, exif):
    checked(jpeg, jpeg_sha)
    checked(png, png_sha)
    with Image.open(jpeg) as full, Image.open(png) as preview:
        assert list(full.size) == dimensions and full.getexif().get(274) == exif
        native = full.convert('RGB').crop(tuple(bbox))
        assert preview.size == native.size and preview.convert('RGB').tobytes() == native.tobytes()
        result = {'native_bbox': bbox, 'crop_dimensions': list(preview.size),
                  'jpeg_sha256': jpeg_sha, 'preview_sha256': png_sha,
                  'decoded_pixels_sha256': digest(native.tobytes()),
                  'pixels_native_exact': True, 'root_preview_visually_inspected': True,
                  'consultation_transform': 'identity', 'word_bbox': None,
                  'historical_confirmation': False, 'localization_status': 'probable'}
    checked(jpeg, jpeg_sha)
    return result

projection_bytes = checked(root / '.private/archives-next-readings/h07-file-library-ui-20261004-v1/reviewed-r2/projection.json', '0226236c79d5bebc79a0746852f065f4a27a68ba911e2e2fa4939be3520b9517')
projection = json.loads(projection_bytes)
media = Path('Z:/Codex/repos/PHD-Maine-archives-import/data/private/media-release/h07-e113-line2-context-localization-20261004-v1')
local_bytes = checked(media / 'localizations.json', 'b09fb4b5b031f44de8301b8ba34e97b62eccf33a6c48d9480460e46bac38c959')
manifest_bytes = checked(media / 'preview-manifest.json', '9fd4c41bcae2fb97412542aad5ce37ec39efffd89482ba13fb797e72a0f0bac2')
local, manifest = json.loads(local_bytes), json.loads(manifest_bytes)
rows = []
for record in local['localizations']:
    binding = [(file, point) for file in projection['files'] for point in file['points'] if point['key'] == record['existing_point_id']]
    assert len(binding) == 1
    file, point = binding[0]
    assert point['quote'] == record['exact_candidate'] and point['lineNumber'] == record['local_transcription_line_number']
    assert point['context'] == record['text_context_exact'] and point['word_bbox'] is None
    assert record['word_bbox'] is None and record['canonical_act_id'] is None
    preview = next(item for item in manifest['previews'] if item['existing_point_id'] == record['existing_point_id'])
    assert preview['native_bbox_with_context'] == record['native_bbox_with_context']
    jpeg = selected / 'archives/media/draft' / (record['selected_JPEG_sha256'] + '.jpg')
    png = media / 'previews' / Path(preview['uri']).name
    row = pixels(jpeg, record['selected_JPEG_sha256'], png, preview['sha256'], record['native_bbox_with_context'], [2976, 3968], 1)
    row.update({'source_object_id': file['sourceObject'], 'point_id': point['key'], 'candidate': point['quote'], 'local_line': 2,
                'source_version': record['source_version'], 'source_text_sha256': record['source_text_sha256'],
                'preview_path': str(png), 'context_observation': 'Neighbouring words retained; obstructed end of the second group is not reconstructed.'})
    rows.append(row)

p09 = Path('Z:/Codex/repos/PHD-Maine-paleography-harness/data/private/transcription-campaign/p09-l07-context-localization-20261004-v1')
candidate_bytes = (p09 / 'candidate.json').read_bytes()
candidate = json.loads(candidate_bytes)
assert candidate['point']['id'] == 'point-l07' and candidate['point']['quote'] == 'vre' and candidate['point']['lineNumber'] == 7
assert candidate['source']['source_edition'] == 'author-full-view-r0' and candidate['word_bbox'] is None
assert candidate['source']['source_body_sha256'] == 'b827189b0e30ad119e825bfdd8e2267c3321c635891dd08581d16ac080c1dee1'
source = candidate['source']
jpeg = selected / 'archives/next-readings/media' / (source['source_derivative_sha256'] + '.jpg')
row = pixels(jpeg, source['source_derivative_sha256'], p09 / candidate['preview']['uri'], candidate['preview']['sha256'], candidate['rectangle_native_xyxy'], [3968, 2976], None)
row.update({'source_object_id': source['source_object_id'], 'point_id': 'point-l07', 'candidate': 'vre', 'local_line': 7,
            'source_version': 'author-full-view-r0', 'source_text_sha256': source['source_body_sha256'],
            'preview_path': str(p09 / candidate['preview']['uri']), 'context_observation': 'Target group and neighbouring groups; a little of the next baseline at lower edge. Full selected JPEG also inspected.'})
rows.append(row)
output.mkdir()
(output / 'verification.json').write_text(json.dumps({'passed': True, 'verdict': 'GO-THREE-NATIVE-CONTEXT-GEOMETRIES-ONLY',
    'selected_package': 'v24-r2', 'e113_localizations_sha256': digest(local_bytes), 'e113_preview_manifest_sha256': digest(manifest_bytes),
    'p09_candidate_sha256': digest(candidate_bytes), 'records': rows, 'final_freeze_pending': True,
    'new_originals_opened': 0, 'accepted_readings': 0, 'public_mount_executed': False}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(output / 'HANDOFF.md').write_text('# Trois petits contextes — inspection Root\n\nGO pour la géométrie de Mʳie et [Rousselière ?] en ligne locale 2 E.113, et vre en ligne physique locale 7 P09 r0. '
    'Les trois PNG ont été ouverts ; le JPEG P09 sélectionné aussi. Les pixels des trois régions ont été comparés fraîchement aux deux seuls JPEG sélectionnés, avec orientation identity et sources inchangées. '
    'Le second groupe E.113 est obstrué : aucune fin restituée, aucun lieu identifié. Les citations, variantes et états restent candidats. '
    'Ce reçu autorise la préparation du freeze/crop définitif avec le helper existant ; il ne produit ni crop public ni validation historique. word_bbox null, aucun original ouvert.\n', encoding='utf-8')
print(json.dumps({'passed': True, 'geometries': len(rows), 'final_freeze_pending': True, 'accepted_readings': 0}))
