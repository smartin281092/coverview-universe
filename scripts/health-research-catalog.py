"""Reproducible assembly of reviewed sources; no invented benefits or year rollover.
Run with Python -X utf8. The API importer validates the complete contract and joins.
"""
import csv
import gzip
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'data/health-insurance/2027'
RESEARCH = ROOT / 'research'
YEAR, CHECKED = 2027, '2026-10-01'

def ident(prefix, value):
    return prefix + hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:24]

def prose(value):
    return ' '.join(value) if isinstance(value, list) else value or ''

def build():
    assembly_path = RESEARCH / 'assembly.json'
    if not assembly_path.exists():
        assembly_path.write_text(json.dumps({'assembledAt': datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')}, indent=2)+'\n', encoding='utf-8')
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
    def source(raw, year=False, quality=None):
        key = ident('src_', [raw['url'], raw.get('page'), raw.get('passage')])
        # A PDF is not necessarily a contract. Only curated contractual sources are marked as such.
        contractual = raw['url'] in [
            'https://sumiswalder.ch/20/wp-content/uploads/2026/09/HMO-plus-AVB-Sumiswalder-2027.pdf',
            'https://www.sanitas.com/content/dam/sanitas-internet/Dokumente/KOBE_Befreiung_TelMed_fr.pdf',
            'https://www.sanitas.com/content/dam/sanitas-internet/Dokumente/6009_Sanitas_AVB_KVG_fr.pdf',
        ] or (raw['url'].startswith('https://dam.swica.ch/') and '2027' in raw['title'] and 'CS ' in raw['title'])
        entry = dict(id=key, url=raw['url'], title=raw['title'], passage=prose(raw.get('passage')), page=raw.get('page'), checkedAt=CHECKED,
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
    for company in insurers:
        for raw in company.get('benefits', []):
            model_ids = raw.get('modelIds', [])
            bid = ident('benefit_', [company['insurerId'], raw['title'], model_ids, raw['source']['url']])
            refs = [source(raw['source'], raw.get('yearConfirmed', False))]
            financial, telemedicine = {'kind':'none'}, 'unknown' if raw['category'] == 'telemedicine' else 'not_applicable'
            # This explicit mapping was inspected in the 2027 TelMed Plus table, never inferred from the group/brand.
            if company['insurerId']==1509 and raw['yearConfirmed'] and raw['source']['url'].endswith('KOBE_Befreiung_TelMed_fr.pdf'):
                baskets = {'Conseil initial pharmacie':'partner_pharmacy_advice', 'Consultation télémédicale':'partner_teleconsultation', 'Vaccinations admissibles':'opas12a_vaccination', 'Prévention gynécologique':'opas12eb_gynecology'}
                if raw['title'] in baskets: financial = dict(kind='eligible_care_waiver', deductible=True, copay=True, careGroup=baskets[raw['title']])
                if raw['title']=='Consultation télémédicale': telemedicine='free_consultation'
            if raw['title']=='Téléconsultation MultiAccess facturée': telemedicine='billed_consultation'
            fact = dict(id=bid, insurerId=company['insurerId'], modelIds=model_ids, year=YEAR, title=raw['title'], equivalenceGroup=raw['equivalenceGroup'], classification=raw['classification'],
                        category=raw['category'], effect=prose(raw.get('effect')), conditions=prose(raw.get('conditions')), exclusions=prose(raw.get('excluded')), activation=prose(raw.get('activation')),
                        geography=sorted(set(region for model in models if model['id'] in model_ids for region in model['regions'])), beneficiary=raw.get('beneficiary','person'), frequency=raw.get('frequency'), capMinor=raw.get('capMinor'),extraCostMinor=raw.get('extraCostMinor'),
                        validFrom=raw.get('validFrom'), validUntil=raw.get('validUntil'),yearConfirmed=raw.get('yearConfirmed',False),requiresSameBase=raw.get('requiresSameBase'),requiresSupplementary=raw.get('requiresSupplementary'),supplementaryProducts=raw.get('supplementaryProducts',[]),
                        verification=raw['verification'],sourceIds=refs,operatorCaseIds=[],financial=financial,utility='services' if raw['classification'] not in ['legal_common','unknown'] else 'none',telemedicine=telemedicine)
            # Question targeting only, not a clinical or contractual exclusion. Reviewed named baskets.
            if fact['equivalenceGroup'] in ['gynecology_screening_no_cost_share', 'menopause_medicines_no_cost_share']:
                fact['questionAudience'] = 'female'
            benefits.append(fact)
            if raw.get('operatorQuestion'):
                concerned=[model for model in models if model['insurerId']==company['insurerId'] and (not model_ids or model['id'] in model_ids)]
                case=dict(id=ident('review_',[bid,'benefit']),insurerId=company['insurerId'],insurerName=company['legalName'],modelIds=[m['id'] for m in concerned],modelNames=[m['name'] for m in concerned],year=YEAR,regions=sorted(set(region for m in concerned for region in m['regions'])),rule=raw['title'],confirmed=prose(raw['effect']),missing=prose(raw['operatorQuestion']),sourceIds=refs,
                          impact='Périmètre, accès, gratuité ou utilité du service à confirmer avant valorisation différentielle.',provisionalTreatment='Information affichée avec ses réserves. Montant certain nul sauf formule et conditions personnelles explicitement validées pour cette année.',question=prose(raw['operatorQuestion']),action='Vérifier le passage et les exclusions ; demander une confirmation précise à l’assureur si le document ne suffit pas.',priority='blocking' if raw['verification']=='contradictory' else 'important',status='open',owner=None,revision=0,history=[dict(at=assembled_at,actor='documentary_research',action='created',note='Contrôle de condition commerciale ou contractuelle, sans profil de santé.')])
                fact['operatorCaseIds']=[case['id']];cases.append(case)
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
    catalog=dict(year=YEAR,datasetId=dataset,checkedAt=CHECKED,insurers=[dict(id=c['insurerId'],legalName=c['legalName'],brand=c['brand'],groupName=c.get('groupName'),aliases=c.get('aliases',[])) for c in insurers],models=models,benefits=benefits,sources=list(sources.values()),cases=cases)
    catalog={'id':ident('catalog_',catalog),**catalog}
    (ROOT/'recommendation-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'operator-reviews.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    with (ROOT/'research-coverage.csv').open('w',encoding='utf-8-sig',newline='') as out:
        writer=csv.writer(out);writer.writerow(['assureur_id','compagnie','modele_id','modele','code_tarif','annee','regions','statut','sources','manquant'])
        for m in models: writer.writerow([m['insurerId'],m['insurerName'],m['id'],m['name'],m['tariffCode'],YEAR,';'.join(m['regions']),m['status'],';'.join(m['sourceIds']),m['missing']])
    report=[f'# Contrôle documentaire maladie {YEAR}',f'Version {catalog["id"]} · consulté le {CHECKED}.',f'{len(insurers)} assureurs, {len(models)} modèles examinés sur {len(inventory["models"])}. {sum(m["status"]=="verified" for m in models)} modèles entièrement vérifiés ; {sum(m["status"]=="not_researched" for m in models)} non examinés. {len(benefits)} fiches, {len(sources)} passages de source, {len(cases)} dossiers de contrôle.',
            'La couverture de recherche n’est pas une certification d’exhaustivité des prestations. Les sources non confirmées pour 2027 restent conditionnelles. Aucun message aux assureurs envoyé. Les modèles et entités sont rapprochés des identifiants Priminfo, sans extrapolation de groupe.']
    for case in sorted(cases,key=lambda item:(['blocking','important','secondary'].index(item['priority']),item['insurerId'],item['id'])):
        report += [f'## {case["insurerName"]} ({case["insurerId"]}) — {", ".join(case["modelNames"])}',f'{case["id"]} · {case["year"]} · {case["priority"]} · {case["status"]} · responsable non attribué',f'Régions : {", ".join(case["regions"])}',f'**Confirmé** : {case["confirmed"]}',f'**À confirmer** : {case["missing"]}',f'**Impact** : {case["impact"]}',f'**Traitement provisoire** : {case["provisionalTreatment"]}',f'**Question** : {case["question"]}',f'**Action** : {case["action"]}']
        for ref in case['sourceIds']:
            src=sources[ref];report += [f'- [{src["title"]}]({src["url"]})'+(f' · p. {src["page"]}' if src['page'] else '')+f' : {src["passage"]}']
    (ROOT/'operator-report.md').write_text('\n\n'.join(report)+'\n',encoding='utf-8')
    print(json.dumps(dict(catalog=catalog['id'],insurers=len(insurers),models=len(models),benefits=len(benefits),sources=len(sources),cases=len(cases)),ensure_ascii=False))
if __name__=='__main__': build()
