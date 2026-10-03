function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// Page memory only. No token is included in payloads, keys or this cache.
export function createReplayKeys(newId = () => crypto.randomUUID()) {
  const attempts = new Map();
  return {
    prepare(scope, payload) {
      const signature = canonical(payload);
      let attempt = attempts.get(scope);
      if (!attempt || attempt.signature !== signature) {
        attempt = { key: `ui-${newId()}`, signature, body: JSON.stringify(payload) };
        attempts.set(scope, attempt);
      }
      return { key: attempt.key, body: attempt.body };
    },
    changed(scope) { attempts.delete(scope); },
    clear() { attempts.clear(); },
  };
}

export function initialProposalDraft(snapshot) {
  return {
    passage_id: snapshot.passage.passage_id,
    base_revision: snapshot.current_revision.text_revision,
    replacement_text: snapshot.current_revision.text,
    reason: '', evidence_refs: [...snapshot.passage.evidence_refs], simulation: true,
  };
}

// Refresh never changes an existing draft or its revision. Choosing another base is explicit.
export function draftAfterRefresh(draft, snapshot) {
  return draft ?? initialProposalDraft(snapshot);
}
