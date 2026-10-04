"""Merge the product-page research batches of 4 October 2026 into research/review-c.json.

Usage: python -X utf8 scripts/health-benefit-research-merge.py <directory with output-batch-*.json>
Every insurer, model and canonical type is checked against inventory.json and benefit-taxonomy.json.
`new:` proposals are applied only through the reviewed TYPE_DECISIONS below (None = not an advantage,
dropped with its reason). Nothing is inferred: unknown proposals, ids or enum values stop the merge.
"""
import json
import sys
from pathlib import Path

RESEARCH = Path(__file__).resolve().parents[1] / 'data/health-insurance/2027/research'
CLASSIFICATIONS = {'model_condition', 'base_service', 'commercial', 'supplementary', 'public_service', 'legal_common', 'unknown'}
VERIFICATIONS = {'verified', 'partial', 'contradictory', 'inaccessible'}
SCOPES = {'model', 'all_base_insured', 'members', 'supplementary'}
QUALITIES = {'official', 'contract', 'marketing'}
# Reviewed decisions for researcher proposals: canonical key, or (None, reason) when not an advantage.
TYPE_DECISIONS = {
    'new:pharmacy_consultation_access': (None, 'Accès en pharmacie facturé selon les règles ordinaires : condition de parcours, pas une prestation supplémentaire.'),
    'new:base_cost_share_credited_to_supplementary': (None, 'Mécanisme propre aux complémentaires (prise en compte de la participation de base), sans avantage du modèle de base.'),
    'new:basic_premium_family_discount': (None, 'Rabais de prime dès le 2e ou 3e enfant : déjà intégré aux tarifs officiels (sous-groupes K3 à K5), pas une prestation.'),
    'new:basic_family_premium_discount': (None, 'Rabais de prime dès le 2e ou 3e enfant : déjà intégré aux tarifs officiels (sous-groupes K3 à K5), pas une prestation.'),
    'new:family_basic_premium_discount': (None, 'Rabais de prime dès le 2e ou 3e enfant : déjà intégré aux tarifs officiels (sous-groupes K3 à K5), pas une prestation.'),
    'new:annual_payment_discount': ('premium_payment_discount', None),
    'new:premium_prepayment_discount': ('premium_payment_discount', None),
    'new:complementary_medicine_advice': ('medical_advice_hotline_free', None),
    'new:generic_price_discount': ('medication_price_discount', None),
    'new:non_health_insurance_discount': ('insurance_bundle_discount', None),
    'new:legal_protection_free': ('insurance_bundle_discount', None),
    'new:copay_reduction': ('care_cost_share_waiver', None),
    'new:patient_legal_protection': ('health_legal_protection', None),
    'new:health_legal_protection': ('health_legal_protection', None),
}
SIBLINGS = (None, 'Rabais de prime dès le 2e ou 3e enfant : déjà intégré aux tarifs officiels (sous-groupes K3 à K5), pas une prestation.')
# One proposal name used for different facts: decided per insurer after reading each fact.
INSURER_DECISIONS = {
    'new:base_premium_discount': {343: SIBLINGS, 1479: SIBLINGS, 1535: SIBLINGS, 455: ('premium_payment_discount', None)},
}
# Reviewed type corrections of a researcher mapping (insurer, title prefix) -> canonical key.
FACT_TYPE_OVERRIDES = {
    (509, 'Entrée gratuite dans ~90 piscines'): 'fitness_discounts',
}
# Findings of the 1 October research replaced or not confirmed on 4 October (benefit id -> reason).
RETIRED = {
    'benefit_c05bc645724764104f16615b': 'Carte-piscine décrite à nouveau le 4 octobre avec ses conditions (complémentaires, âge) ; ancienne contradiction levée.',
    'benefit_8edea6bab592c024b8167b8e': 'Offre ORTHO-TEAM reprise le 4 octobre avec la même validité (jusqu’au 31.12.2027) sous le type des produits de santé.',
    'benefit_cf8a8bcd230dd7868a67877a': 'Remplacée par la fiche du 4 octobre sur les cours de promotion de la santé (complémentaires).',
    'benefit_5f56e206b9dd99ec3d206747': 'Remplacée par la fiche du 4 octobre (bon Migros limité au 31.12.2026).',
    'benefit_58896f3fbe9228f7c291f81d': 'Conseil santé24 repris le 4 octobre depuis les conditions spéciales 2027 et la page produit.',
    'benefit_14ec6480b5b6476d1b63316d': 'Conseil santé24 repris le 4 octobre depuis les conditions spéciales 2027 et la page produit.',
    'benefit_2bc2831493fdde4c641f8e88': 'Conseil santé24 repris le 4 octobre depuis les conditions spéciales 2027 et la page produit.',
    'benefit_c5800ddae3bb1d41d740aff0': 'Non confirmée le 4 octobre : la page partenaires citée renvoie une erreur.',
    'benefit_b2736692952079c2fadae47d': 'Coordination Hôpital de confiance reprise le 4 octobre (coordinatrice dédiée dès 2027).',
}
FIELDS = ['type', 'insurerTerm', 'title', 'modelIds', 'scope', 'classification', 'effect', 'conditions', 'exclusions', 'activation',
          'costSharing', 'amount', 'extraCostCHF', 'requiresSameBase', 'requiresSupplementary', 'supplementaryProducts',
          'yearExplicit2027', 'validFrom', 'validUntil', 'verification', 'source', 'proposedType']


def merge(directory):
    inventory = json.loads((RESEARCH / 'inventory.json').read_text(encoding='utf-8-sig'))
    taxonomy = json.loads((RESEARCH / 'benefit-taxonomy.json').read_text(encoding='utf-8'))
    types = {item['key'] for item in taxonomy['types']}
    owner = {model['id']: model['insurer_id'] for model in inventory['models']}
    merged = dict(checkedAt='2026-10-04', method='Pages produit officielles de chaque modèle, pages services/club/application et conditions liées ; protocole et taxonomie canonique du 4 octobre 2026. Aucun contact avec les assureurs.',
                  typeDecisions={key: value[0] for key, value in TYPE_DECISIONS.items()},
                  insurerTypeDecisions={key: {str(insurer): value[0] for insurer, value in decisions.items()} for key, decisions in INSURER_DECISIONS.items()},
                  retiredFindings=RETIRED, dropped=[], insurers=[])
    for path in sorted(Path(directory).glob('output-batch-*.json')):
        batch = json.loads(path.read_text(encoding='utf-8-sig'))
        for company in batch['insurers']:
            insurer = company['insurerId']
            insurer_models = {model_id for model_id, value in owner.items() if value == insurer}
            assert insurer_models, (path.name, insurer)
            models = []
            for model in company['models']:
                assert owner.get(model['modelId']) == insurer, (insurer, model['modelId'])
                models.append({key: model.get(key) for key in ['modelId', 'productPages', 'status', 'access', 'notes']})
            benefits = []
            for raw in company['benefits']:
                fact = {key: raw.get(key) for key in FIELDS}
                if fact['type'].startswith('new:'):
                    decided = INSURER_DECISIONS.get(fact['type'], {}).get(insurer) or TYPE_DECISIONS.get(fact['type'])
                    assert decided, (insurer, fact['type'], fact['title'])
                    decision, reason = decided
                    if decision is None:
                        merged['dropped'].append(dict(insurerId=insurer, title=fact['title'], proposedType=fact['type'], reason=reason))
                        continue
                    fact['proposedType'], fact['type'] = fact['type'], decision
                for (owner_id, prefix), corrected in FACT_TYPE_OVERRIDES.items():
                    if owner_id == insurer and fact['title'].startswith(prefix):
                        fact['proposedType'], fact['type'] = fact['type'], corrected
                assert fact['type'] in types, (insurer, fact['type'])
                assert fact['classification'] in CLASSIFICATIONS and fact['verification'] in VERIFICATIONS and fact['scope'] in SCOPES, (insurer, fact['title'])
                assert fact['modelIds'] and set(fact['modelIds']) <= insurer_models, (insurer, fact['title'])
                source = fact['source']
                assert source['url'].startswith('https://') and source.get('quality') in QUALITIES, (insurer, fact['title'])
                source['passage'] = source['passage'][:300]
                benefits.append({key: value for key, value in fact.items() if value is not None or key in ['costSharing', 'extraCostCHF', 'requiresSameBase', 'requiresSupplementary', 'validFrom', 'validUntil']})
            merged['insurers'].append(dict(insurerId=insurer, brand=company['brand'], pagesVisited=company.get('pagesVisited', []), models=models, benefits=benefits, notes=company.get('notes', '')))
    covered = {model['modelId'] for company in merged['insurers'] for model in company['models']}
    missing = sorted(set(owner) - covered)
    merged['insurers'].sort(key=lambda company: company['insurerId'])
    (RESEARCH / 'review-c.json').write_text(json.dumps(merged, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(dict(insurers=len(merged['insurers']), models=len(covered), missingModels=missing,
                          benefits=sum(len(company['benefits']) for company in merged['insurers']), dropped=len(merged['dropped'])), ensure_ascii=False))


if __name__ == '__main__':
    merge(sys.argv[1])
