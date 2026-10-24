"""Reproducible assembly of reviewed sources; no invented benefits or year rollover.
Run with Python -X utf8. The API importer validates the complete contract and joins.
Benefits are normalised to the canonical taxonomy of research/benefit-taxonomy.json: the insurer's own
wording stays in title/insurerTerm, the uniform type in equivalenceGroup.
"""
import csv
import gzip
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'data/health-insurance/2027'
RESEARCH = ROOT / 'research'
YEAR, CHECKED = 2027, '2026-10-01'
# Product-page research of every model (review-c), consulted after the 2027 premium publication.
CHECKED_C = '2026-10-04'
TAXONOMY = json.loads((RESEARCH / 'benefit-taxonomy.json').read_text(encoding='utf-8'))
TYPES = {item['key']: item for item in TAXONOMY['types']}
LEGACY = TAXONOMY['legacyGroups']
CARE_GROUPS = {'teleconsultation_cost_share_waiver': 'telemedicine', 'generic_cost_share_waiver': 'generics',
               'screening_cost_share_waiver': 'screening', 'vaccination_cost_share_waiver': 'vaccination', 'care_cost_share_waiver': 'listed_care'}
FEMALE = re.compile(r'gyn|mammo|du sein|ménopause|feminavita|femme|grossesse', re.I)

def utility_of(group, classification):
    # Conditions describe the pathway; only services and cost advantages can be preferred.
    return 'services' if TYPES[group]['valuation'] in ['service', 'financial'] and classification not in ['legal_common', 'unknown'] else 'none'

def telemedicine_of(group, sharing):
    if group == 'medical_advice_hotline_free': return 'triage_only'
    if group == 'teleconsultation_access': return 'billed_consultation'
    if group == 'digital_health_services': return 'platform_only'
    if group == 'teleconsultation_cost_share_waiver':
        if sharing and sharing.get('deductibleWaived') and sharing.get('copayWaived'): return 'free_consultation'
        if sharing and sharing.get('deductibleWaived') and sharing.get('copayWaived') is False: return 'deductible_only'
        return 'unknown'
    return 'unknown' if TYPES[group]['family'] == 'telemedicine' else 'not_applicable'

def money(value):
    return round(value * 100) if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0 else None

def ident(prefix, value):
    return prefix + hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:24]

def prose(value):
    return ' '.join(value) if isinstance(value, list) else value or ''

def build():
    assembly_path = RESEARCH / 'assembly.json'
    if not assembly_path.exists():
        assembly_path.write_text(json.dumps({'assembledAt': datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')}, indent=2)+'\n', encoding='utf-8', newline='\n')
    assembled_at = json.loads(assembly_path.read_text(encoding='utf-8'))['assembledAt']
    inventory = json.loads((RESEARCH / 'inventory.json').read_text(encoding='utf-8-sig'))
    reviews = [json.loads((RESEARCH / f'review-{part}.json').read_text(encoding='utf-8-sig')) for part in ['a', 'b']]
    insurers = [company for review in reviews for company in review['insurers']]
    assert {item['insurerId'] for item in insurers} == {item['id'] for item in inventory['insurers']}
    researched_models = {model['modelId']: (company, model) for company in insurers for model in company['models']}
    assert set(researched_models) == {model['id'] for model in inventory['models']}
    region_keys, model_regions, dataset = {}, {}, None
    with gzip.open(ROOT / 'normalized.jsonl.gz', 'rt', encoding='utf-8') as stream:
        for line in stream:
            item = json.loads(line); row = item['row']
            if item['table'] == 'health_datasets': dataset = row['id']
            elif item['table'] == 'health_regions' and row['canton'] not in ['ZE', 'ZR']: region_keys[row['id']] = row['region_id']
            elif item['table'] == 'health_eligibility': model_regions.setdefault(row['model_id'], set()).add(row['region_key'])
    sources, models, benefits, cases = {}, [], [], []
    def source(raw, year=False, quality=None, checked=CHECKED):
        key = ident('src_', [raw['url'], raw.get('page'), raw.get('passage')])
        # A PDF is not necessarily a contract. Only curated contractual sources are marked as such.
        contractual = raw['url'] in [
            'https://sumiswalder.ch/20/wp-content/uploads/2026/09/HMO-plus-AVB-Sumiswalder-2027.pdf',
            'https://www.sanitas.com/content/dam/sanitas-internet/Dokumente/KOBE_Befreiung_TelMed_fr.pdf',
            'https://www.sanitas.com/content/dam/sanitas-internet/Dokumente/6009_Sanitas_AVB_KVG_fr.pdf',
        ] or (raw['url'].startswith('https://dam.swica.ch/') and '2027' in raw['title'] and 'CS ' in raw['title'])
        entry = dict(id=key, url=raw['url'], title=raw['title'], passage=prose(raw.get('passage')), page=raw.get('page'), checkedAt=checked,
                     quality=quality or ('contract' if contractual else 'official'), yearExplicit=bool(raw.get('yearExplicit') or year))
        if key in sources: entry['yearExplicit'] |= sources[key]['yearExplicit']
        sources[key] = entry
        return key
    for original in inventory['models']:
        company, review = researched_models[original['id']]
        regions = sorted(region_keys[key] for key in model_regions.get(original['id'], set()) if key in region_keys)
        refs = list(dict.fromkeys(source(raw) for raw in review.get('sources', [])))
        standard = original['category'] == 'BASE'
        model = dict(id=original['id'], insurerId=company['insurerId'], insurerName=company['legalName'], name=original['name'], tariffCode=original['tariff_code'], year=YEAR,
                     category=original['category'], regions=regions, status=review['status'], sourceIds=refs, confirmed=prose(review.get('confirmed')), missing=prose(review.get('missing')),
                     access=dict(contacts=['free'] if standard else [], multipleEntry=None, mandatory=not standard, verifiedYear=standard,
                                 obligations='Libre choix dans le cadre légal de l’assurance de base.' if standard else 'Les obligations et le réseau de l’année sélectionnée restent à vérifier.', networkUrl=None, professionalAdmission={}))
        models.append(model)
        if model['missing'] or review.get('operatorQuestion'):
            cases.append(dict(id=ident('review_', [YEAR, model['id'], 'conditions']), insurerId=company['insurerId'], insurerName=company['legalName'], modelIds=[model['id']], modelNames=[model['name']], year=YEAR, regions=regions,
                              rule='Conditions annuelles, accès et avantages du modèle', confirmed=model['confirmed'], missing=model['missing'], sourceIds=refs,
                              impact='Une condition de parcours peut changer la compatibilité ; une condition financière ou d’éligibilité peut modifier le coût ou l’utilité.',
                              provisionalTreatment='Aucun avantage non confirmé pour 2027 ne crée une économie certaine. Les contraintes de réseau non vérifiées restent à vérifier, sans exclusion automatique.',
                              question=prose(review.get('operatorQuestion')) or 'Merci de confirmer les conditions contractuelles 2027 et les points manquants ci-dessus.',
                              action='Contrôler les documents et annexes cités, puis obtenir une confirmation écrite des éléments manquants auprès de l’assureur. Aucun message envoyé automatiquement.',
                              priority='important' if standard and review.get('priority') == 'blocking' else review.get('priority', 'important'), status='open', owner=None, revision=0,
                              history=[dict(at=assembled_at, actor='documentary_research', action='created', note='Dossier issu de la recherche officielle ; aucune donnée personnelle.')]))
    # Product-page research of 4 October 2026: one file per insurer batch, merged in review-c.json.
    review_c = json.loads((RESEARCH / 'review-c.json').read_text(encoding='utf-8-sig')) if (RESEARCH / 'review-c.json').exists() else {'insurers': []}
    retired = review_c.get('retiredFindings', {})
    fresh_types = {(company['insurerId'], LEGACY.get(raw['type'], raw['type'])) for company in review_c['insurers'] for raw in company.get('benefits', [])}
    kept_strong = set()
    superseded = []
    for company in insurers:
        for raw in company.get('benefits', []):
            model_ids = raw.get('modelIds', [])
            bid = ident('benefit_', [company['insurerId'], raw['title'], model_ids, raw['source']['url']])
            group = LEGACY[raw['equivalenceGroup']]
            refs = [source(raw['source'], raw.get('yearConfirmed', False))]
            strong = raw.get('yearConfirmed') or sources[refs[0]]['quality'] == 'contract'
            # Fresher research of the same insurer and type supersedes partial findings; dated or
            # contractual findings and pathway conditions stay. Explicit retirements are reviewed.
            if bid in retired or (TYPES[group]['valuation'] != 'condition' and not strong and (company['insurerId'], group) in fresh_types):
                superseded.append(dict(id=bid, insurerId=company['insurerId'], title=raw['title'], type=group, reason=retired.get(bid, 'superseded_by_review_c')))
                continue
            if strong: kept_strong.add((company['insurerId'], group, raw['source']['url']))
            financial, telemedicine = {'kind':'none'}, telemedicine_of(group, None)
            # This explicit mapping was inspected in the 2027 TelMed Plus table, never inferred from the group/brand.
            if company['insurerId']==1509 and raw['yearConfirmed'] and raw['source']['url'].endswith('KOBE_Befreiung_TelMed_fr.pdf'):
                baskets = {'Conseil initial pharmacie':'partner_pharmacy_advice', 'Consultation télémédicale':'partner_teleconsultation', 'Vaccinations admissibles':'opas12a_vaccination', 'Prévention gynécologique':'opas12eb_gynecology'}
                if raw['title'] in baskets: financial = dict(kind='eligible_care_waiver', deductible=True, copay=True, careGroup=baskets[raw['title']])
                if raw['title']=='Consultation télémédicale': telemedicine='free_consultation'
            if raw['title']=='Téléconsultation MultiAccess facturée': telemedicine='billed_consultation'
            fact = dict(id=bid, insurerId=company['insurerId'], modelIds=model_ids, year=YEAR, title=raw['title'], equivalenceGroup=group, classification=raw['classification'],
                        category=TYPES[group]['family'], effect=prose(raw.get('effect')), conditions=prose(raw.get('conditions')), exclusions=prose(raw.get('excluded')), activation=prose(raw.get('activation')),
                        geography=sorted(set(region for model in models if model['id'] in model_ids for region in model['regions'])), beneficiary=raw.get('beneficiary','person'), frequency=raw.get('frequency'), capMinor=raw.get('capMinor'),extraCostMinor=raw.get('extraCostMinor'),
                        validFrom=raw.get('validFrom'), validUntil=raw.get('validUntil'),yearConfirmed=raw.get('yearConfirmed',False),requiresSameBase=raw.get('requiresSameBase'),requiresSupplementary=raw.get('requiresSupplementary'),supplementaryProducts=raw.get('supplementaryProducts',[]),
                        verification=raw['verification'],sourceIds=refs,operatorCaseIds=[],financial=financial,utility=utility_of(group, raw['classification']),telemedicine=telemedicine)
            # Question targeting only, not a clinical or contractual exclusion. Reviewed named baskets.
            if raw['equivalenceGroup'] in ['gynecology_screening_no_cost_share', 'menopause_medicines_no_cost_share']:
                fact['questionAudience'] = 'female'
            benefits.append(fact)
            if raw.get('operatorQuestion'):
                concerned=[model for model in models if model['insurerId']==company['insurerId'] and (not model_ids or model['id'] in model_ids)]
                case=dict(id=ident('review_',[bid,'benefit']),insurerId=company['insurerId'],insurerName=company['legalName'],modelIds=[m['id'] for m in concerned],modelNames=[m['name'] for m in concerned],year=YEAR,regions=sorted(set(region for m in concerned for region in m['regions'])),rule=raw['title'],confirmed=prose(raw['effect']),missing=prose(raw['operatorQuestion']),sourceIds=refs,
                          impact='Périmètre, accès, gratuité ou utilité du service à confirmer avant valorisation différentielle.',provisionalTreatment='Information affichée avec ses réserves. Montant certain nul sauf formule et conditions personnelles explicitement validées pour cette année.',question=prose(raw['operatorQuestion']),action='Vérifier le passage et les exclusions ; demander une confirmation précise à l’assureur si le document ne suffit pas.',priority='blocking' if raw['verification']=='contradictory' else 'important',status='open',owner=None,revision=0,history=[dict(at=assembled_at,actor='documentary_research',action='created',note='Contrôle de condition commerciale ou contractuelle, sans profil de santé.')])
                fact['operatorCaseIds']=[case['id']];cases.append(case)
    names = {company['insurerId']: company['legalName'] for company in insurers}
    by_id = {model['id']: model for model in models}
    for company in review_c['insurers']:
        insurer_models = [model['id'] for model in models if model['insurerId'] == company['insurerId']]
        for researched in company.get('models', []):
            model = by_id[researched['modelId']]
            pages = [source(dict(url=url, title=f"{company['brand']} — page produit {model['name']}", passage='Paraphrase : page produit officielle consultée pour l’inventaire des prestations supplémentaires.', page=None), checked=CHECKED_C) for url in researched.get('productPages', [])[:3]]
            model['sourceIds'] = list(dict.fromkeys(model['sourceIds'] + pages))
            # The ways in that the insurer's own pages document (user request, 24 October 2026:
            # « exactement à quoi ça correspond »): shown as published, still unconfirmed for the
            # year (verifiedYear) until a 2027 document names them, so the engine ignores them.
            documented = researched.get('access') or {}
            if model['category'] != 'BASE' and documented.get('contacts'):
                model['access'].update(contacts=documented['contacts'], multipleEntry=documented.get('multipleEntry'))
            if researched.get('status') == 'researched':
                model['missing'] = model['missing'].replace('Inventaire exhaustif des avantages et exclusions.', 'Maintien 2027 des avantages annoncés sur la page produit (recherche du 4 octobre 2026).')
                for case in cases:
                    if case['id'] == ident('review_', [YEAR, model['id'], 'conditions']):
                        case.update(missing=model['missing'], sourceIds=model['sourceIds'])
        for raw in company.get('benefits', []):
            group = raw['type']
            assert group in TYPES, (company['insurerId'], group)
            model_ids = [model_id for model_id in raw['modelIds'] if model_id in insurer_models]
            assert model_ids and len(model_ids) == len(raw['modelIds']), (company['insurerId'], raw['title'])
            src = raw['source']
            if (company['insurerId'], group, src['url']) in kept_strong: continue
            year = bool(raw.get('yearExplicit2027'))
            refs = [source(dict(url=src['url'], title=src['title'], passage=src['passage'], page=src.get('page')), year, src.get('quality') if src.get('quality') in ['contract', 'marketing'] else None, CHECKED_C)]
            bid = ident('benefit_', [company['insurerId'], raw['title'], model_ids, src['url']])
            sharing, amount = raw.get('costSharing') or {}, raw.get('amount') or {}
            financial = {'kind': 'none'}
            # Amounts are only structured from verified contractual facts of the model or base insurance;
            # other cost advantages stay descriptive (a family or unqualified cap is never an adult cap).
            structured = sources[refs[0]]['quality'] == 'contract' and raw['verification'] == 'verified' and raw['classification'] in ['model_condition', 'base_service']
            if structured and group in CARE_GROUPS and (sharing.get('deductibleWaived') or sharing.get('copayWaived')):
                financial = dict(kind='eligible_care_waiver', deductible=bool(sharing.get('deductibleWaived')), copay=bool(sharing.get('copayWaived')), careGroup=f"{CARE_GROUPS[group]}_{company['insurerId']}")
            elif structured and group == 'copay_cap_reduced' and money(amount.get('capCHF')) is not None:
                financial = dict(kind='copay_cap', capMinor=money(amount['capCHF']))
            fact = dict(id=bid, insurerId=company['insurerId'], modelIds=model_ids, year=YEAR, title=raw['title'], insurerTerm=raw.get('insurerTerm') or raw['title'], equivalenceGroup=group,
                        classification=raw['classification'], category=TYPES[group]['family'], effect=raw.get('effect') or '', conditions=raw.get('conditions') or '', exclusions=raw.get('exclusions') or '',
                        activation=raw.get('activation') or '', geography=sorted(set(region for model in models if model['id'] in model_ids for region in model['regions'])), beneficiary='person',
                        frequency=amount.get('frequency'), capMinor=money(amount.get('capCHF')), extraCostMinor=money(raw.get('extraCostCHF')),
                        validFrom=raw.get('validFrom') or ('2027-01-01' if year else None), validUntil=raw.get('validUntil'), yearConfirmed=year,
                        requiresSameBase=raw.get('requiresSameBase'), requiresSupplementary=raw.get('requiresSupplementary'), supplementaryProducts=raw.get('supplementaryProducts') or [],
                        verification=raw['verification'], sourceIds=refs, operatorCaseIds=[], financial=financial, utility=utility_of(group, raw['classification']), telemedicine=telemedicine_of(group, sharing))
            if group in ['screening_cost_share_waiver', 'care_cost_share_waiver', 'preventive_checkup'] and FEMALE.search(raw['title'] + ' ' + fact['effect']):
                fact['questionAudience'] = 'female'
            benefits.append(fact)
            if raw['verification'] in ['contradictory', 'inaccessible']:
                concerned = [by_id[model_id] for model_id in model_ids]
                case = dict(id=ident('review_', [bid, 'benefit']), insurerId=company['insurerId'], insurerName=names[company['insurerId']], modelIds=model_ids, modelNames=[m['name'] for m in concerned], year=YEAR,
                            regions=sorted(set(region for m in concerned for region in m['regions'])), rule=raw['title'], confirmed=fact['effect'], missing=raw.get('note') or 'Sources officielles contradictoires ou illisibles pour cette prestation.', sourceIds=refs,
                            impact='Présence, gratuité ou périmètre de la prestation à confirmer avant toute valorisation.', provisionalTreatment='Prestation affichée avec réserve ; aucune utilité ni économie tant que la contradiction n’est pas levée.',
                            question=f"Confirmez pour 2027 la prestation « {raw['title']} » : modèles concernés, gratuité et conditions.", action='Comparer les sources citées ; demander une confirmation écrite à l’assureur si elles divergent. Aucun message envoyé automatiquement.',
                            priority='blocking' if raw['verification'] == 'contradictory' else 'important', status='open', owner=None, revision=0,
                            history=[dict(at=assembled_at, actor='documentary_research', action='created', note='Recherche des pages produit du 4 octobre 2026, sans profil de santé.')])
                fact['operatorCaseIds'] = [case['id']]; cases.append(case)
    # Exact named pathways supported by the inspected 2027 documents. No category inference.
    pathways={
        'hm_584fd456c50df26a1a8255daf247':(['gp','phone','pharmacy'],True),
        'hm_19c1b552f42ac88cd8b7d8814594':(['network'],False),
        'hm_46f193ce5522fb4a049032a5d888':(['pharmacy','phone','video'],True),
        'hm_6914c2d10fa43f05bd47b54821b8':(['network'],False),
        'hm_ad8e447ccf0c7c3305c845bbf811':(['phone','video'],True),
        'hm_2c14709923d4854c9445423bddae':(['video'],False),
    }
    for model in models:
        if model['id'] in pathways:
            facts=[fact for fact in benefits if model['id'] in fact['modelIds'] and fact['yearConfirmed'] and fact['verification']=='verified' and fact['classification']=='model_condition']
            assert facts, model['id']
            model['sourceIds']=list(dict.fromkeys(model['sourceIds']+[ref for fact in facts for ref in fact['sourceIds']]))
            model['access'].update(contacts=pathways[model['id']][0],multipleEntry=pathways[model['id']][1],mandatory=True,verifiedYear=True,obligations=' '.join(fact['effect']+' '+fact['conditions']+' '+fact['exclusions'] for fact in facts))
            if model['id'] in ['hm_ad8e447ccf0c7c3305c845bbf811','hm_2c14709923d4854c9445423bddae']: model['access']['ageScope']='adult'
    legal_refs=[source(dict(url='https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/oc/2026/336/fr/pdf-a/fedlex-data-admin-ch-eli-oc-2026-336-fr-pdf-a.pdf',title='RO 2026 336 — modifications OPAS applicables en 2027',passage='Pages 2, 6 et 8 : vaccination par pharmaciens qualifiés dès 2027, dispositions HPV et ajout de Glaris aux programmes colorectaux dès juillet 2026.',page=2),True,'contract'),source(dict(url='https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1995/4964_4964_4964/20270101/fr/pdf-a/fedlex-data-admin-ch-eli-cc-1995-4964_4964_4964-20270101-fr-pdf-a.pdf',title='OPAS consolidée — état affiché au 01.01.2027',passage='Divergence constatée le 01.10.2026, pages 24 et 33 : ancienne clause HPV et liste sans Glaris, malgré le RO publié. Ne pas résoudre par une question personnelle.',page=33),True,'official'),source(dict(url='https://www.bag.admin.ch/fr/vaccinations-prophylactiques',title='OFSP — franchise et quote-part des vaccinations',passage='Vaccinations et conseils admissibles OPAS 12a exonérés de franchise depuis 2026 ; quote-part restante. Conditions de prestations à lire avec RO 2026 336.',page=None),False,'official')]
    for company in insurers:
        concerned=[model for model in models if model['insurerId']==company['insurerId']]
        cases.append(dict(id=f'OPAS-2027-CONSOLIDATION-336-{company["insurerId"]}',insurerId=company['insurerId'],insurerName=company['legalName'],modelIds=[m['id'] for m in concerned],modelNames=[m['name'] for m in concerned],year=YEAR,regions=sorted(set(region for m in concerned for region in m['regions'])),rule='Socle OPAS 2027 — divergence du document consolidé',confirmed='Le RO 2026 336 publié contient les modifications pharmacie/HPV et Glaris. La franchise vaccinale admissible est commune à tous les assureurs ; seule la quote-part restante peut être différenciante.',missing='Le PDF consolidé affichant 2027 conserve les anciennes clauses. Confirmation de consolidation et revue juridique des paniers exacts nécessaires.',sourceIds=legal_refs,impact='Évite d’attribuer comme avantage exclusif une exonération légale commune ou une fausse inéligibilité cantonale.',provisionalTreatment='Socle vaccinal versionné selon RO ; dépistages non ventilés par programme et médicaments à quote-part non qualifiée exclus du calcul certain. Aucun cumul de maxima.',question='Confirmez la consolidation applicable et l’intégration des modifications du RO 2026 336. Pour TelMed Plus, vérifiez séparément le socle des sept paniers et les taux LS.',action='Référent juridique/catalogue : revoir les articles, notes, dates et qualifications de paniers ; comparer la prochaine consolidation officielle. Ne pas demander un arbitrage contractuel à l’utilisateur.',priority='important',status='open',owner=None,revision=0,history=[dict(at=assembled_at,actor='documentary_research',action='created',note='PDF et tableaux contrôlés visuellement, empreintes dans le rapport health-adaptive-rules-audit.md. Aucun contact externe.')]))
    # Synonyms are the insurers' own names found for each type (data, never matched automatically).
    terms = {}
    for fact in benefits: terms.setdefault(fact['equivalenceGroup'], set()).add(fact.get('insurerTerm') or fact['title'])
    benefit_types = [dict(key=item['key'], family=item['family'], label=item['label'], description=item['description'],
                          synonyms=sorted(terms.get(item['key'], set()), key=lambda term: (term.casefold(), term))[:80], valuation=item['valuation']) for item in TAXONOMY['types']]
    assert all(fact['equivalenceGroup'] in TYPES and fact['category'] == TYPES[fact['equivalenceGroup']]['family'] for fact in benefits)
    catalog=dict(year=YEAR,datasetId=dataset,checkedAt=CHECKED_C if review_c['insurers'] else CHECKED,insurers=[dict(id=c['insurerId'],legalName=c['legalName'],brand=c['brand'],groupName=c.get('groupName'),aliases=c.get('aliases',[])) for c in insurers],models=models,benefitTypes=benefit_types,benefits=benefits,sources=list(sources.values()),cases=cases)
    catalog={'id':ident('catalog_',catalog),**catalog}
    (ROOT/'recommendation-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8', newline='\n')
    (ROOT/'operator-reviews.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2)+'\n',encoding='utf-8', newline='\n')
    with (ROOT/'research-coverage.csv').open('w',encoding='utf-8-sig',newline='') as out:
        writer=csv.writer(out,lineterminator='\n');writer.writerow(['assureur_id','compagnie','modele_id','modele','code_tarif','annee','regions','statut','sources','manquant'])
        for m in models: writer.writerow([m['insurerId'],m['insurerName'],m['id'],m['name'],m['tariffCode'],YEAR,';'.join(m['regions']),m['status'],';'.join(m['sourceIds']),m['missing']])
    report=[f'# Contrôle documentaire maladie {YEAR}',f'Version {catalog["id"]} · conditions consultées le {CHECKED}, pages produit et prestations le {CHECKED_C}.',f'{len(insurers)} assureurs, {len(models)} modèles examinés sur {len(inventory["models"])}. {sum(m["status"]=="verified" for m in models)} modèles entièrement vérifiés ; {sum(m["status"]=="not_researched" for m in models)} non examinés. {len(benefits)} fiches, {len(benefit_types)} types uniformisés, {len(sources)} passages de source, {len(cases)} dossiers de contrôle.',
            'La couverture de recherche n’est pas une certification d’exhaustivité des prestations. Les sources non confirmées pour 2027 restent conditionnelles. Aucun message aux assureurs envoyé. Les modèles et entités sont rapprochés des identifiants Priminfo, sans extrapolation de groupe.']
    if superseded:
        report += ['## Fiches du 1er octobre remplacées par la recherche du 4 octobre', 'Une fiche partielle est remplacée lorsque la recherche plus récente documente le même type de prestation pour le même assureur, ou retirée après revue explicite.']
        report += [f'- {item["insurerId"]} · {item["title"]} → {item["type"]} ({item["reason"]})' for item in superseded]
    for case in sorted(cases,key=lambda item:(['blocking','important','secondary'].index(item['priority']),item['insurerId'],item['id'])):
        report += [f'## {case["insurerName"]} ({case["insurerId"]}) — {", ".join(case["modelNames"])}',f'{case["id"]} · {case["year"]} · {case["priority"]} · {case["status"]} · responsable non attribué',f'Régions : {", ".join(case["regions"])}',f'**Confirmé** : {case["confirmed"]}',f'**À confirmer** : {case["missing"]}',f'**Impact** : {case["impact"]}',f'**Traitement provisoire** : {case["provisionalTreatment"]}',f'**Question** : {case["question"]}',f'**Action** : {case["action"]}']
        for ref in case['sourceIds']:
            src=sources[ref];report += [f'- [{src["title"]}]({src["url"]})'+(f' · p. {src["page"]}' if src['page'] else '')+f' : {src["passage"]}']
    (ROOT/'operator-report.md').write_text('\n\n'.join(report)+'\n',encoding='utf-8', newline='\n')
    print(json.dumps(dict(catalog=catalog['id'],insurers=len(insurers),models=len(models),benefits=len(benefits),sources=len(sources),cases=len(cases)),ensure_ascii=False))
if __name__=='__main__': build()
