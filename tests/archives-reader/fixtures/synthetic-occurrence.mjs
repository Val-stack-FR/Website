// Entirely invented derivative for portable functional checks. No corpus pixels.
export function syntheticOccurrence() {
  const before = '1. texte inventé\n2. dit 😀 ';
  const after = ' suite inventée\r\n3. fin';
  const start = Array.from(before).length + 50;
  return {
    schema_version: 'h05-real-occurrence/0.1.0',
    occurrence_id: 'occurrence:invented-functional-test-001',
    scope: 'corpus',
    simulation: false,
    publication_status: 'private',
    review_status: 'unreviewed',
    reading_status: 'unresolved',
    source: {
      digital_object_id: `object:path-${'a'.repeat(64)}`,
      view_id: `object:path-${'a'.repeat(64)}`,
      relative_path: 'PRIVATE-PATH-DO-NOT-RENDER/photo-invented.jpg',
      sha256: 'b'.repeat(64),
      byte_size: 1000,
      width: 400,
      height: 300,
      corpus_root_reference: 'env:PHD_CORPUS_ROOT',
      approved_review_id: `review:${'c'.repeat(64)}`
    },
    transcription: {
      source_object_id: `object:path-${'d'.repeat(64)}`,
      source_sha256: 'e'.repeat(64),
      text_id: 'text:invented-001',
      text_revision: 'e'.repeat(64),
      profile_sha256: 'f'.repeat(64),
      span: { start, end: start + 4, units: 'unicode-codepoints-half-open-r0' },
      observed_text: '----',
      context_line: '2. dit 😀 ---- suite inventée',
      context_before: before,
      context_after: after,
      working_reading: '[lacune non resolue]',
      alternatives: [],
      alternatives_note: 'No lexical reading in this invented fixture.'
    },
    locator: {
      view_id: `object:path-${'a'.repeat(64)}`,
      context_bbox: { x: 50, y: 100, width: 250, height: 50, units: 'pixels', reference_frame: 'original-view' },
      target_bbox: null
    },
    alignment: {
      status: 'candidate', confidence: 'possible',
      line_context_matches: ['dit', 'suite inventée'],
      basis: 'INTERNAL-ALIGNMENT-BASIS-DO-NOT-RENDER'
    },
    pixel_observation: {
      tool: 'view_image', detail: 'original', completed: true,
      observed_at: '2026-01-01T12:00:00Z', native_width: 400, native_height: 300,
      display_measurement: { width: 400, height: 300, x: 50, y: 100, selection_width: 250, selection_height: 50 },
      measurement_method: 'INTERNAL-METHOD-DO-NOT-RENDER',
      viewer_resize_notice: 'INTERNAL-VIEWER-NOTICE-DO-NOT-RENDER',
      evidence_ref: 'PRIVATE-EVIDENCE-DO-NOT-RENDER'
    },
    author: {
      kind: 'ai', agent_id: 'codex:invented-test', provider: 'Invented provider',
      model: 'INTERNAL-MODEL-DO-NOT-RENDER', method_version: 'h05-real-occurrence/0.1.0'
    },
    hand: { value: null, certainty: 'unknown', basis: 'Not asserted.' },
    language: { value: null, certainty: 'unknown', basis: 'Not asserted.' },
    date: { value: null, certainty: 'unknown', basis: 'Not asserted.' },
    entity_id: null, memory_promoted: false, measured_gain: null,
    canonical_closeout: false, limitations: ['PRIVATE-LIMITATION-DO-NOT-RENDER'],
    document_id: null, act_id: null, witness_id: null
  };
}
