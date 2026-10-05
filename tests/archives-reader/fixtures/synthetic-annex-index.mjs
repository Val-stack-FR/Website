const SOURCE_FICHES = 'object:synthetic-fiches';
const SOURCE_VARIANTS = 'object:synthetic-variants';

const specifications = [
  {
    key: 'aubin-saules', number: '101', label: 'Aubin du Rivage',
    heading: 'Aubin du Rivage, branche fictive des Saules', date: '1401', title: 'Éclaireur',
    place: 'Val-aux-Lunes', holding: 'Maison imaginaire des Saules', jurisdiction: 'Cour fictive du Rivage'
  },
  {
    key: 'aubin-brumes', number: '102', label: 'Aubin du Rivage',
    heading: 'Aubin du Rivage, branche fictive des Brumes', date: '1407', title: 'Messager',
    place: 'Pré-des-Brumes', holding: 'Maison imaginaire des Brumes', jurisdiction: 'Cour fictive des Brumes'
  },
  {
    key: 'beatrice', number: '203', label: 'Béatrice des Brumes',
    heading: 'Béatrice des Brumes, personnage de démonstration', date: '1412', title: 'Arpenteuse',
    place: 'Clairvallon', holding: 'Domaine imaginaire de Clairvallon', jurisdiction: 'Cour fictive du Vallon'
  },
  {
    key: 'colin', number: '304', label: 'Colin du Pré',
    heading: 'Colin du Pré, personnage de démonstration', date: '1420', title: 'Gardien',
    place: 'Pré-Vert', holding: 'Domaine imaginaire du Pré-Vert', jurisdiction: 'Cour fictive du Pré'
  },
  {
    key: 'diane', number: '405', label: 'Diane des Ormes',
    heading: 'Diane des Ormes, personnage de démonstration', date: '1433', title: 'Médiatrice',
    place: 'Ormeraie', holding: 'Domaine imaginaire de l’Ormeraie', jurisdiction: 'Cour fictive des Ormes'
  }
];

export function syntheticAnnexIndex() {
  const dates = [];
  const entries = [];
  const fiches = [];
  const locators = [];

  const addLocator = (id, recordNumber, field, source = SOURCE_FICHES, table = 'synthetic/fiches-demo.csv') => {
    const evidenceLocatorId = `evidence:synthetic-${id}`;
    locators.push({
      digital_object_id: source,
      evidence_locator_id: evidenceLocatorId,
      field,
      key_field: source === SOURCE_FICHES ? 'fiche_n' : 'variant_id',
      key_value: String(recordNumber),
      original_page: null,
      record_number: recordNumber,
      table
    });
    return evidenceLocatorId;
  };

  for (const [position, specification] of specifications.entries()) {
    const ficheId = `row:synthetic-${specification.key}`;
    const dateId = `date:synthetic-${specification.key}`;
    const dateLocator = addLocator(`date-${specification.key}`, position + 1, 'Date');
    dates.push({
      certainty: 'unknown', date_id: dateId,
      earliest: `${specification.date}-01-01`, latest: `${specification.date}-12-31`,
      evidence_locator_ids: [dateLocator], expression: specification.date,
      notes: 'Expression inventée pour la fixture de test.', precision: 'year'
    });

    const nameMentionIds = [`mention:synthetic-${specification.key}-label`, `mention:synthetic-${specification.key}-heading`];
    const nameValues = [specification.label, specification.heading];
    for (const [namePosition, literal] of nameValues.entries()) {
      const mentionId = nameMentionIds[namePosition];
      entries.push({
        claim_id: null, date_id: null,
        entry_id: `entry:synthetic-${specification.key}-name-${namePosition + 1}`,
        evidence_locator_id: addLocator(`${specification.key}-name-${namePosition + 1}`, position + 1,
          namePosition === 0 ? 'Nom fictif' : 'Intitulé fictif'),
        fiche_id: ficheId, identity_status: 'unresolved', literal,
        name_mention_id: mentionId, origin: 'synthetic-cell', person_id: null, scope: 'name'
      });
    }

    const scopedValues = [
      ['title', 'Qualificatif fictif', specification.title],
      ['place', 'Lieu fictif', specification.place],
      ['holding', 'Seigneurie fictive', specification.holding],
      ['jurisdiction', 'Juridiction fictive', specification.jurisdiction]
    ];
    const claimIds = [];
    for (const [scope, field, literal] of scopedValues) {
      const claimId = `claim:synthetic-${specification.key}-${scope}`;
      claimIds.push(claimId);
      entries.push({
        claim_id: claimId, date_id: dateId,
        entry_id: `entry:synthetic-${specification.key}-${scope}`,
        evidence_locator_id: addLocator(`${specification.key}-${scope}`, position + 1, field),
        fiche_id: ficheId, identity_status: 'unresolved', literal,
        name_mention_id: null, origin: 'synthetic-cell', person_id: null, scope
      });
    }

    const citationLocator = addLocator(`${specification.key}-citation`, position + 1, 'Référence fictive');
    fiches.push({
      candidate_basis: 'Fixture inventée sans identification historique', candidate_person_ids: [],
      claim_ids: claimIds, date_id: dateId, fiche_id: ficheId, fiche_n: specification.number,
      identity_status: 'unresolved', label: specification.label, missing_fields: [],
      name_mention_ids: nameMentionIds, person_heading: specification.heading,
      review_status: 'unreviewed',
      source_citations: [{ evidence_locator_id: citationLocator, field: 'Référence fictive', literal: `notice-${specification.number}` }],
      source_heading: 'Source synthétique'
    });
  }

  const homonymFiches = fiches.slice(0, 2).map(fiche => fiche.fiche_id);
  for (const [position, literal] of ['Aubin du Rivage (index fictif)', 'Aubin l’Aîné (index fictif)'].entries()) {
    entries.push({
      candidate_fiche_ids: homonymFiches, claim_id: null, date_id: null,
      entry_id: `entry:synthetic-variant-${position + 1}`,
      evidence_locator_id: addLocator(`variant-${position + 1}`, position + 1, 'Variante fictive', SOURCE_VARIANTS,
        'synthetic/variants-demo.csv'),
      fiche_id: null, identity_status: 'unknown', literal, name_mention_id: null,
      origin: 'synthetic-index-variant', person_id: `person:synthetic-aubin-${position + 1}`,
      scope: 'variant', source_occurrence_in_fiche: false, variant_ordinal: position + 1
    });
  }

  return {
    access_tier: 'project',
    ambiguities: [{
      ambiguity_id: 'ambiguity:synthetic-aubin', fiche_ids: homonymFiches, merged: false,
      normalized_name: 'aubin du rivage',
      notes: 'Deux fiches fictives portent le même nom ; aucune identité commune ou distincte n’est affirmée.',
      status: 'unresolved-same-name'
    }],
    canonical_schema_version: '1.0.0', dates, entries, fiches,
    index_profile: 'atelier-tuce-annex-query/0.1.0', legacy_candidates: [],
    limitations: [
      'Fixture synthétique limitée à cinq fiches ; un résultat nul ne concerne aucun autre corpus.',
      'Les variantes inventées servent uniquement au test de rattachement candidat.'
    ],
    locators, method: 'synthetic/annex-query-test/1.0.0', package_id: 'package:synthetic-annex-search',
    publication: { approved_for_publication: false, status: 'review-pending' }, rights_status: 'unknown',
    scopes: ['name', 'variant', 'title', 'place', 'holding', 'jurisdiction'],
    sources: [
      { byte_size: 100, digital_object_id: SOURCE_FICHES, logical_uri: 'synthetic:fiches-demo', sha256: 'a'.repeat(64) },
      { byte_size: 50, digital_object_id: SOURCE_VARIANTS, logical_uri: 'synthetic:variants-demo', sha256: 'b'.repeat(64) }
    ]
  };
}

