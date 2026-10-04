"""Read-only live oracle against the archived 2026 CSVs; synthetic profiles only."""
import csv
import gzip
import json
import pathlib
import urllib.request
import urllib.error
from decimal import Decimal

ROOT = pathlib.Path(__file__).resolve().parents[1] / 'data/health-insurance/2026'
BASE = 'http://127.0.0.1:4100/health-insurance'
def request(path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE+path, data=data, headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)

models = {}
with gzip.open(ROOT/'normalized.jsonl.gz','rt',encoding='utf8') as lines:
    for line in lines:
        item=json.loads(line)
        if item['table']=='health_models': models[item['row']['id']]=item['row']
        elif item['table']=='health_premiums': break
with gzip.open(ROOT/'premiums.csv.gz','rt',encoding='utf-8-sig',newline='') as source:
    raw=list(csv.DictReader(source))
foreign=list(csv.DictReader((ROOT/'premiums-eu.csv').read_text('utf-8-sig').splitlines()))
checked=0
for birth,region,deductible,accident in [(1990,'VD-1',2500,True),(2008,'AG-0',0,True),(2001,'GE-0',300,False),(2010,'SZ-0',600,False)]:
    context=dict(year=2026,birthYear=birth,regionId=region,deductible=deductible,accident=accident)
    options=request('/current/options',context)
    assert options['status']=='available'
    age='AKL-KIN' if birth>=2008 else 'AKL-JUG' if birth>=2001 else 'AKL-ERW'
    subgroup='K1' if age=='AKL-KIN' else ''
    candidates={(int(r['Versicherer']),r['Tarif']):r for r in raw if r['Kanton']==region[:2] and r['Region']==f'PR-REG CH{region[-1]}' and r['Altersklasse']==age and r['Altersuntergruppe']==subgroup and r['Franchise']==f'FRA-{deductible}' and r['Unfalleinschluss']==('MIT-UNF' if accident else 'OHN-UNF')}
    assert len(options['offers'])==len(candidates)
    for offer in options['offers']:
        r=candidates[(offer['insurerId'],models[offer['modelId']]['tariff_code'])]
        assert offer['monthlyPremiumMinor']==int(Decimal(r['Prämie'])*100)
        assert offer['accident']==accident and offer['deductible']==deductible
        assert 'firstContacts' not in offer and 'redistribution' not in offer
        checked+=1
    baseline=next(o for o in options['offers'] if not o['restricted'])
    target=request('/compare',dict(year=2027,birthYear=birth,regionId=region,deductible=300 if birth==2008 else deductible,accident=accident))
    current={k:context[k] for k in ('year','regionId','deductible','accident')}
    current['modelId']=baseline['modelId']
    result=request('/current/compare',dict(birthYear=birth,current=current,offerIds=[o['id'] for o in target['offers']]))
    assert result['status']=='available' and len(result['differences'])==len(target['offers'])
    for difference in result['differences']:
        offer=next(o for o in target['offers'] if o['id']==difference['offerId'])
        expected=baseline['monthlyPremiumMinor']-offer['monthlyPremiumMinor']
        assert difference['monthlySavingMinor']==expected and difference['annualSavingMinor']==12*expected
        assert difference['ageGroupChanged']==(birth in (2008,2001))

context=dict(year=2026,birthYear=1990,regionId='EU-FR',deductible=300,accident=True)
options=request('/current/options',context)
assert options['status']=='available'
for offer in options['offers']:
    r=next(r for r in foreign if int(r['Versicherer'])==offer['insurerId'] and r['Land']=='EU FR' and r['Altersklasse']=='AKL-ERW' and r['Unfalleinschluss']=='MIT-UNF')
    assert offer['monthlyPremiumMinor']==int(Decimal(r['Prämie'])*100)
    checked+=1
assert request('/current/options',dict(context,regionId='VD-1',municipalityId=999999))['status']=='location_required'
assert request('/current/options',dict(context,regionId='VD-1',birthYear=2008,deductible=2500))['status']=='invalid_deductible'
try:
    request('/current/options',dict(context,year=2027))
    raise AssertionError('Mixed year accepted')
except urllib.error.HTTPError as error: assert error.code==400
print(json.dumps(dict(status='passed',sourcePremiumsChecked=checked,scenarios=4,foreignCountry='FR',ageTransitions=[2008,2001],mutations=0)))
