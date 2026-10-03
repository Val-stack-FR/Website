export function textElement(document, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = String(text);
  if (className) element.className = className;
  return element;
}

export function proposalStatus(snapshot, proposal) {
  const decision = snapshot.decisions.find(item => item.proposal_id === proposal.proposal_id);
  if (decision) return decision.outcome === 'accept' ? 'Acceptée — simulation' : 'Refusée — simulation';
  return proposal.base_revision === snapshot.current_revision.text_revision ? 'En attente' : 'En attente — base périmée';
}

export function renderCollection(document, target, items, renderItem, emptyMessage) {
  target.replaceChildren(...(items.length ? items.map(renderItem) : [textElement(document, 'p', emptyMessage, 'muted')]));
}

export function proposalCard(document, snapshot, proposal) {
  const card = document.createElement('article');
  card.className = 'entry';
  card.append(
    textElement(document, 'h3', proposalStatus(snapshot, proposal)),
    textElement(document, 'p', `${proposal.proposal_id} · base ${proposal.base_revision}`, 'metadata'),
    textElement(document, 'pre', proposal.replacement_text, 'passage'),
    textElement(document, 'p', proposal.reason),
    textElement(document, 'p', `${proposal.created_at} · ${proposal.evidence_refs.join(', ')}`, 'metadata'),
  );
  return card;
}

export function revisionCard(document, revision) {
  const card = document.createElement('article');
  card.className = 'entry';
  card.append(
    textElement(document, 'h3', revision.text_revision),
    textElement(document, 'pre', revision.text, 'passage'),
    textElement(document, 'p', revision.decision_id ? `Décision simulée : ${revision.decision_id}` : 'Texte initial entièrement inventé.', 'metadata'),
  );
  return card;
}

export function decisionCard(document, decision) {
  const card = document.createElement('article');
  card.className = 'entry';
  card.append(
    textElement(document, 'h3', decision.outcome === 'accept' ? 'Acceptation simulée' : 'Refus simulé'),
    textElement(document, 'p', `${decision.decision_id} · ${decision.proposal_id}`, 'metadata'),
    textElement(document, 'p', decision.reason),
    textElement(document, 'p', `${decision.base_revision} → ${decision.text_revision} · ${decision.created_at}`, 'metadata'),
  );
  return card;
}
