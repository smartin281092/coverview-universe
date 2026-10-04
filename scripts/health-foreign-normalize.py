"""Normalize official EU/EFTA/UK premiums. Archives every age subgroup, no Swiss tariffs reused."""
import csv, datetime, hashlib, json, pathlib
from decimal import Decimal
ROOT = pathlib.Path(__file__).resolve().parents[1] / 'data/health-insurance/2027'
URL = 'https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0VVLmNzdg%3D%3D'
payload = (ROOT / 'premiums-eu.csv').read_bytes()
digest = hashlib.sha256(payload).hexdigest()
dataset = 'hfe_' + digest[:28]
rows, seen = [], set()
ages = {'AKA_03_ERW':'adult','AKA_02_JUG':'young_adult','AKA_01_KIN':'child'}
for raw in csv.DictReader(payload.decode('utf-8-sig').splitlines()):
    assert raw['Geschäftsjahr']=='2027' and raw['Erhebungsjahr']=='2026'
    assert raw['Tarif']=='BASE' and raw['Tariftyp']=='BASE' and raw['Hoheitsgebiet']=='P_OKPEU'
    age, deductible = ages[raw['Altersklasse']], int(raw['Franchise'].split('_')[-1])
    assert deductible == (0 if age=='child' else 300)
    assert raw['Unfalleinschluss'] in ('MIT_UNF','OHN_UNF')
    amount = Decimal(raw['Prämie'])*100
    assert amount == int(amount) and amount >= 0
    grain = [int(raw['Versicherer']),raw['Land'],age,raw['Altersuntergruppe'],raw['Unfalleinschluss'],deductible]
    key = json.dumps(grain)
    assert key not in seen, 'Duplicate EU premium'
    seen.add(key)
    rows.append(dict(id='hfp_'+hashlib.sha256((dataset+key).encode()).hexdigest()[:28],dataset_id=dataset,insurer_id=grain[0],country=grain[1],age_group=age,age_subgroup=grain[3],accident=grain[4]=='MIT_UNF',deductible=deductible,monthly_premium_minor=int(amount),raw=raw))
assert rows and len({r['country'] for r in rows})==30
result = dict(dataset=dict(id=dataset,year=2027,source_url=URL,sha256=digest),rows=rows)
(ROOT/'foreign-normalized.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
quality = dict(datasetId=dataset,year=2027,sourceUrl=URL,sha256=digest,rows=len(rows),insurers=len({r['insurer_id'] for r in rows}),countries=sorted({r['country'] for r in rows}),ageSubgroups=sorted({r['age_subgroup'] for r in rows}),note='K1 only for individual child ranking; K3 archived. Ordinary deductible only. No inference of Swiss model benefits or affiliation rights.')
(ROOT/'foreign-quality.json').write_text(json.dumps(quality,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(quality,ensure_ascii=False))
