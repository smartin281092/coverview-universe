"""Normalize official EU/EFTA/UK premiums. Archives every age subgroup, no Swiss tariffs reused."""
import argparse, csv, datetime, hashlib, json, pathlib
from decimal import Decimal
parser=argparse.ArgumentParser()
parser.add_argument('--year',type=int,choices=(2026,2027),default=2027)
YEAR=parser.parse_args().year
ROOT = pathlib.Path(__file__).resolve().parents[1] / f'data/health-insurance/{YEAR}'
URL = 'https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0VVLmNzdg%3D%3D'
payload = (ROOT / 'premiums-eu.csv').read_bytes()
if YEAR==2026:
    source=next(s for s in json.loads((ROOT/'sources.json').read_text('utf8')) if s['file']=='premiums-eu.csv')
    assert hashlib.sha256(payload).hexdigest()==source['sha256']
    URL=source['url']
digest = hashlib.sha256(payload).hexdigest()
dataset = 'hfe_' + digest[:28]
rows, seen = [], set()
ages = {'AKA_03_ERW':'adult','AKA_02_JUG':'young_adult','AKA_01_KIN':'child','AKL-ERW':'adult','AKL-JUG':'young_adult','AKL-KIN':'child'}
for raw in csv.DictReader(payload.decode('utf-8-sig').splitlines()):
    assert raw['Geschäftsjahr']==str(YEAR) and raw['Erhebungsjahr']==str(YEAR-1)
    assert raw['Tarif']=='BASE' and raw['Tariftyp']=='BASE' and raw['Hoheitsgebiet']==('EU' if YEAR==2026 else 'P_OKPEU')
    age, deductible = ages[raw['Altersklasse']], int(raw['Franchise'].replace('-', '_').split('_')[-1])
    assert deductible == (0 if age=='child' else 300)
    assert raw['Unfalleinschluss'] in (('MIT-UNF','OHN-UNF') if YEAR==2026 else ('MIT_UNF','OHN_UNF'))
    amount = Decimal(raw['Prämie'])*100
    assert amount == int(amount) and amount >= 0
    subgroup=raw['Altersuntergruppe']
    if YEAR==2026 and age!='child':
        assert subgroup==''
        subgroup='E1' if age=='adult' else 'J1'
    grain = [int(raw['Versicherer']),raw['Land'].removeprefix('EU '),age,subgroup,raw['Unfalleinschluss'],deductible]
    key = json.dumps(grain)
    assert key not in seen, 'Duplicate EU premium'
    seen.add(key)
    rows.append(dict(id='hfp_'+hashlib.sha256((dataset+key).encode()).hexdigest()[:28],dataset_id=dataset,insurer_id=grain[0],country=grain[1],age_group=age,age_subgroup=grain[3],accident=grain[4] in ('MIT_UNF','MIT-UNF'),deductible=deductible,monthly_premium_minor=int(amount),raw=raw))
assert rows and len({r['country'] for r in rows})==30
result = dict(dataset=dict(id=dataset,year=YEAR,source_url=URL,sha256=digest),rows=rows)
(ROOT/'foreign-normalized.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
quality = dict(datasetId=dataset,year=YEAR,sourceUrl=URL,sha256=digest,rows=len(rows),insurers=len({r['insurer_id'] for r in rows}),countries=sorted({r['country'] for r in rows}),ageSubgroups=sorted({r['age_subgroup'] for r in rows}),note='K1 only for individual child ranking; K3 archived. Ordinary deductible only. No inference of Swiss model benefits or affiliation rights.')
(ROOT/'foreign-quality.json').write_text(json.dumps(quality,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(quality,ensure_ascii=False))
