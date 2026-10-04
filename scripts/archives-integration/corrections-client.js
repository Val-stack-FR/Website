(() => {
  'use strict';
  const passageId = 'text:atelier-494756c2009be577ad11a5eb0a662d38';
  const form = document.querySelector('#correction-form');
  const source = document.querySelector('#correction-source');
  const replacement = document.querySelector('#correction-replacement');
  const reason = document.querySelector('#correction-reason');
  const submit = document.querySelector('#correction-submit');
  const status = document.querySelector('#correction-status');
  let current, lastPayload, key, initialEditorValue;
  const request = async (path, options = {}) => {
    const response = await fetch('/api/archive/preview/' + path, { ...options, credentials: 'same-origin', redirect: 'error' });
    if (!(response.headers.get('content-type') ?? '').startsWith('application/json')) throw new Error('Réponse indisponible.');
    const data = await response.json();
    if (data.simulation !== true || data.identity_verified !== false || data.human_validation_enabled !== false || data.reading_confirmed !== false) throw new Error('État du service inattendu.');
    if (!response.ok) throw new Error(response.status === 409 ? 'La lecture source a changé. Rechargez la page avant de proposer à nouveau.' : 'La proposition n’a pas été enregistrée. Vous pouvez réessayer.');
    return { data, status: response.status };
  };
  const initialize = async () => {
    const { data } = await request('passage?passage_id=' + encodeURIComponent(passageId));
    if (data.passage?.passage_id !== passageId || typeof data.current_revision?.text !== 'string' || !Array.isArray(data.passage.evidence_refs) || !Array.isArray(data.revisions)) throw new Error('Passage indisponible.');
    current = data;
    source.textContent = data.current_revision.text;
    source.dataset.textRevision = data.current_revision.text_revision;
    replacement.value = data.current_revision.text;
    initialEditorValue = replacement.value;
    const list = document.querySelector('#correction-history');
    for (const revision of data.revisions) {
      const item = document.createElement('li');
      item.textContent = 'Version ' + revision.revision_number + ' · ' + (revision.decision_id === null ? 'lecture conservée, non validée' : 'révision');
      list.append(item);
    }
    submit.disabled = false;
    status.textContent = 'Le passage est prêt. Votre proposition conservera la lecture actuelle jusqu’à son examen.';
  };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!current || submit.disabled || !form.reportValidity()) return;
    const proposedText = replacement.value === initialEditorValue ? current.current_revision.text : replacement.value;
    const payload = JSON.stringify({ passage_id: passageId, base_revision: current.current_revision.text_revision, replacement_text: proposedText, reason: reason.value, evidence_refs: current.passage.evidence_refs, simulation: true });
    if (payload !== lastPayload) { key = crypto.randomUUID(); lastPayload = payload; }
    submit.disabled = true;
    delete status.dataset.proposalId;
    status.textContent = 'Enregistrement en cours…';
    try {
      const { data } = await request('corrections', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: payload });
      if (typeof data.proposal?.proposal_id !== 'string') throw new Error('Reçu de proposition indisponible.');
      status.textContent = 'Proposition enregistrée, en attente d’examen. Référence : ' + data.proposal.proposal_id;
      status.dataset.proposalId = data.proposal.proposal_id;
    } catch (error) { status.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  initialize().catch(error => { status.textContent = error.message; });
})();
