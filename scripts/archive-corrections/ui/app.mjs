import { createReplayKeys, draftAfterRefresh } from './state.mjs';
import { textElement, proposalStatus, renderCollection, proposalCard, revisionCard, decisionCard } from './render.mjs';

const element = id => document.getElementById(id);
const keys = createReplayKeys();
let snapshot;
let draft;
let busy = false;
let configuration;
let csrfToken;
const sessionMode = () => configuration?.auth_mode === 'local_owner_session';

function status(message, error = false) {
  element('status').textContent = message;
  element('status').dataset.error = String(error);
}

function buttons() {
  element('refresh').disabled = busy;
  for (const id of ['use-current', 'proposal-submit']) element(id).disabled = busy || !snapshot;
  for (const id of ['accept', 'reject']) element(id).disabled = busy || !snapshot || !element('decision-proposal').value || (sessionMode() && !csrfToken);
  element('login').disabled = busy;
  element('logout').disabled = busy || !csrfToken;
}

function selectedProposal() {
  return snapshot?.proposals.find(item => item.proposal_id === element('decision-proposal').value);
}

function selectedPreview() {
  const proposal = selectedProposal();
  element('selected-text').textContent = proposal?.replacement_text ?? '';
  element('selected-status').textContent = proposal ? `${proposalStatus(snapshot, proposal)} · ${proposal.reason}` : '';
  buttons();
}

function render(next) {
  snapshot = next;
  const firstLoad = draft === undefined;
  draft = draftAfterRefresh(draft, snapshot);
  if (firstLoad) {
    element('proposal-base').value = draft.base_revision;
    element('replacement-text').value = draft.replacement_text;
    for (const id of ['replacement-text', 'proposal-reason']) element(id).disabled = false;
  }
  element('current-revision').textContent = snapshot.current_revision.text_revision;
  element('current-text').textContent = snapshot.current_revision.text;
  element('current-evidence').textContent = `${snapshot.data_kind === 'synthetic' ? 'Preuve fictive' : 'Références du passage non relu'} : ${snapshot.passage.evidence_refs.join(', ')}`;
  renderCollection(document, element('proposals'), snapshot.proposals, item => proposalCard(document, snapshot, item), 'Aucune proposition pour le moment.');
  renderCollection(document, element('revisions'), snapshot.revisions, item => revisionCard(document, item), 'Aucune révision.');
  renderCollection(document, element('decisions'), snapshot.decisions, item => decisionCard(document, item), 'Aucune décision simulée.');
  const select = element('decision-proposal');
  const chosen = select.value;
  const placeholder = textElement(document, 'option', 'Choisir une proposition');
  placeholder.value = '';
  select.replaceChildren(placeholder, ...snapshot.proposals.map(proposal => {
    const option = textElement(document, 'option', `${proposal.proposal_id} · ${proposalStatus(snapshot, proposal)}`);
    option.value = proposal.proposal_id;
    return option;
  }));
  select.value = chosen; // Refresh preserves selection, reason and the original decision base.
  selectedPreview();
}

async function loadHistory() {
  if (sessionMode()) {
    const auth = await fetch('/v1/auth/session', { cache: 'no-store' });
    const state = await auth.json();
    if (!auth.ok) throw new Error('session');
    csrfToken = state.authenticated ? state.csrf_token : undefined;
    element('session-status').textContent = csrfToken ? 'Session locale ouverte. Aucune identité historique attestée.' : 'Déconnecté. La file de propositions reste privée.';
  }
  const route = csrfToken ? '/v1/owner/history' : `/v1/passages/${encodeURIComponent(configuration.passage_id)}`;
  const response = await fetch(route, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || data.simulation !== true || data.data_kind !== configuration.data_kind) throw new Error('history');
  render({ ...data, proposals: data.proposals ?? [], decisions: data.decisions ?? [] });
  if (sessionMode() && !csrfToken) element('proposals').textContent = 'File privée : connectez-vous pour consulter les propositions et leurs motifs.';
}

const errors = {
  revision_conflict: 'Cette base est périmée. Votre texte, motif et base sont conservés. Actualisez pour comparer, puis choisissez explicitement une nouvelle base ou proposition.',
  owner_test_required: 'Le secret de propriétaire local de test est absent ou incorrect. Votre décision et sa base sont conservées.',
  owner_session_required: 'La session locale est absente ou expirée. Reconnectez-vous ; votre décision et sa base sont conservées.',
  csrf_required: 'La session doit être actualisée avant cette décision. Votre saisie et sa base sont conservées.',
  proposal_decided: 'Cette proposition possède déjà une décision. Votre saisie reste conservée.',
  idempotency_conflict: 'Cette clé correspond déjà à une autre saisie. Vos champs sont conservés ; une modification crée une nouvelle clé.',
  invalid_text: 'Le texte ou motif doit être non vide, respecter sa longueur et ne contenir aucun contrôle hors TAB/LF/CR. Votre saisie reste conservée.',
};

async function submit(scope, payload, secret) {
  const attempt = keys.prepare(scope, payload);
  busy = true;
  buttons();
  try {
    const response = await fetch(`/v1/${scope === 'proposal' ? 'proposals' : 'decisions'}`, {
      method: 'POST', cache: 'no-store', headers: {
        'Content-Type': 'application/json', 'Idempotency-Key': attempt.key,
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        ...(scope === 'decision' && sessionMode() && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      }, body: attempt.body,
    });
    const data = await response.json();
    if (!response.ok) {
      status(errors[data.error?.code] ?? 'La demande a été refusée. Tous vos champs et leur base sont conservés.', true);
      return;
    }
    const recorded = data[scope];
    const message = `${scope === 'proposal' ? 'Proposition enregistrée' : 'Décision simulée enregistrée'} : ${recorded[`${scope}_id`]}.${data.replayed ? ' Rejeu confirmé, sans doublon.' : ''}`;
    try {
      await loadHistory();
      status(`${message} Votre saisie et sa base restent conservées.`);
    } catch {
      status(`${message} L’historique n’a pas pu être actualisé ; vous pouvez réessayer la même action sans doublon.`, true);
    }
  } catch {
    status('Réponse réseau incertaine. Votre saisie, base et clé sont conservées : réessayez la même action sans modification pour confirmer son résultat. Une modification crée une nouvelle clé.', true);
  } finally {
    busy = false;
    buttons();
  }
}

for (const id of ['replacement-text', 'proposal-reason']) {
  element(id).addEventListener('input', () => {
    draft.replacement_text = element('replacement-text').value;
    draft.reason = element('proposal-reason').value;
    keys.changed('proposal');
  });
}
element('decision-reason').addEventListener('input', () => keys.changed('decision'));
element('decision-proposal').addEventListener('change', () => {
  element('decision-base').value = selectedProposal()?.base_revision ?? '';
  keys.changed('decision');
  selectedPreview();
});
element('use-current').addEventListener('click', () => {
  draft.base_revision = snapshot.current_revision.text_revision;
  element('proposal-base').value = draft.base_revision;
  keys.changed('proposal');
  status('La version affichée est maintenant votre base choisie. Votre texte et votre motif sont conservés ; aucune proposition ni décision n’a été créée.');
});
element('proposal-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!busy && draft) submit('proposal', {
    ...draft, replacement_text: element('replacement-text').value, reason: element('proposal-reason').value,
  });
});
element('decision-form').addEventListener('submit', event => {
  event.preventDefault();
  const proposal = selectedProposal();
  const outcome = event.submitter?.value;
  if (busy || !proposal || !['accept', 'reject'].includes(outcome)) return;
  submit('decision', {
    proposal_id: proposal.proposal_id, base_revision: element('decision-base').value, outcome,
    reason: element('decision-reason').value, evidence_refs: [...snapshot.passage.evidence_refs], simulation: true,
  }, element('owner-secret').value);
});
element('clear-secret').addEventListener('click', () => {
  element('owner-secret').value = '';
  status('Secret effacé de cette page. Les autres saisies restent conservées.');
});
window.addEventListener('pagehide', () => { element('owner-secret').value = ''; element('owner-passphrase').value = ''; csrfToken = undefined; keys.clear(); });
window.addEventListener('pageshow', () => { element('owner-secret').value = ''; element('owner-passphrase').value = ''; });
element('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !sessionMode()) return;
  busy = true;
  buttons();
  try {
    const response = await fetch('/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: element('owner-passphrase').value }),
    });
    const data = await response.json();
    element('owner-passphrase').value = '';
    if (!response.ok) {
      status(data.error?.code === 'login_throttled' ? 'Trop de tentatives. Patientez une minute avant de réessayer.' : 'Accès local refusé. La file reste privée.', true);
      return;
    }
    csrfToken = data.csrf_token;
    await loadHistory();
    status('Session locale ouverte. Vos propositions et décisions de simulation sont maintenant consultables.');
  } catch { status('Connexion locale indisponible. Vos autres saisies sont conservées.', true); }
  finally { element('owner-passphrase').value = ''; busy = false; buttons(); }
});
element('logout').addEventListener('click', async () => {
  if (busy || !csrfToken) return;
  busy = true;
  buttons();
  try {
    const response = await fetch('/v1/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
    if (!response.ok) throw new Error('logout');
    csrfToken = undefined;
    await loadHistory();
    status('Session locale fermée. La file est de nouveau privée.');
  } catch { status('Fermeture non confirmée. Actualisez pour vérifier la session.', true); }
  finally { busy = false; buttons(); }
});
element('refresh').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  buttons();
  try {
    await loadHistory();
    status('Historique actualisé. Vos saisies, bases, sélection et clés restent conservées ; aucune décision n’a été prise.');
  } catch { status('Historique indisponible. Vos saisies et leurs bases restent conservées.', true); }
  finally { busy = false; buttons(); }
});

buttons();
fetch('/v1/health', { cache: 'no-store' }).then(response => response.json()).then(async config => {
  configuration = config;
  element('session-controls').hidden = !sessionMode();
  element('legacy-help').hidden = sessionMode();
  element('legacy-secret').hidden = sessionMode();
  element('owner-secret').disabled = sessionMode();
  element('owner-passphrase').disabled = !sessionMode();
  if (sessionMode()) element('owner-heading').textContent = 'Accès propriétaire local';
  if (config.data_kind === 'historical-local') {
    document.title = 'Atelier privé local — Monbezon non relu';
    element('workshop-label').textContent = 'Passage réel non relu · essai privé local';
    element('scope-help').textContent = 'Passage réel Monbezon non relu, chargé depuis un paquet vérifié pour un essai privé. Les décisions restent des simulations locales : aucune lecture historique ni identité de Val n’est validée ici.';
    element('scope-footer').textContent = 'Consultation privée locale · droits publics en attente · aucune source originale modifiée · aucune publication.';
    element('proposal-reason-label').textContent = 'Motif de la proposition sur ce passage non relu';
    element('revision-heading').textContent = 'Révisions locales du passage non relu';
  }
  await loadHistory();
  status(config.data_kind === 'synthetic' ? 'Passage fictif chargé. Vous pouvez proposer une variante ; seules les décisions de test changent sa version.' : 'Passage Monbezon non relu chargé. Toute décision reste une simulation locale séparée du corpus.');
})
  .catch(() => status('Service indisponible. Actualisez pour réessayer.', true));
