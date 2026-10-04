"""Reproducible Priminfo 2027 download, profiling and normalization. Python + openpyxl.

python scripts/health-normalize.py [--download]
No credentials, personal data or database writes. CSV originals retained losslessly as gzip.
"""
import argparse
import csv
import datetime
import gzip
import hashlib
import io
import json
import pathlib
import sys
import unicodedata
import urllib.request
from collections import Counter
from decimal import Decimal
import openpyxl

parser = argparse.ArgumentParser()
parser.add_argument('--year', type=int, choices=(2026,2027), default=2027)
parser.add_argument('--download', action='store_true')
ARGS = parser.parse_args()
YEAR = ARGS.year
ROOT = pathlib.Path(__file__).resolve().parents[1] / f'data/health-insurance/{YEAR}'
URLS = {
    'premiums.csv.gz': 'https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1Byw6RtaWVuX0NILmNzdg%3D%3D',
    'tariffs.csv.gz': 'https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL1RhcmlmZS5jc3Y%3D',
    'coverage.csv.gz': 'https://opendata.bagnet.ch/?r=/download&path=L1ByYWVtaWVuL0Vpbnp1Z3NnZWJpZXRlLmNzdg%3D%3D',
    'regions.xlsx': 'https://www.priminfo.admin.ch/downloads/praemienregionen.xlsx',
    'insurers.xlsx': 'https://www.priminfo.admin.ch/downloads/assureurs-maladie-admis-2026-10.xlsx',
}

def sha(value):
    return hashlib.sha256(value).hexdigest()

def key(*parts):
    return sha(json.dumps(parts, ensure_ascii=False).encode())[:28]

def normalize(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value.lower()) if unicodedata.category(c) != 'Mn')

def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    if ARGS.download:
        assert YEAR == 2027, 'For 2026 use archived files and sources.json; live endpoints contain a different year'
        sources = []
        for filename, url in URLS.items():
            data = urllib.request.urlopen(url, timeout=60).read(70_000_001)
            assert len(data) <= 70_000_000, 'Source too large'
            (ROOT / filename).write_bytes(gzip.compress(data, mtime=0) if filename.endswith('.gz') else data)
            sources.append(dict(file=filename,url=url,sha256=sha(data),bytes=len(data),retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat()))
        (ROOT/'sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2),encoding='utf8')
    sources = json.loads((ROOT/'sources.json').read_text('utf8'))
    for source in sources:
        raw = (ROOT/source['file']).read_bytes()
        if source['file'].endswith('.gz'): raw=gzip.decompress(raw)
        assert sha(raw)==source['sha256'], f"Source integrity failed: {source['file']}"
    # A corrected transformation must create a new immutable snapshot even with identical inputs.
    normalizer_sha256 = sha(pathlib.Path(__file__).read_bytes())
    identity_sha = sha((ROOT/'insurers-brands.json').read_bytes()) if YEAR==2026 else ''
    dataset = 'hi_' + key(normalizer_sha256, identity_sha, *[s['sha256'] for s in sources])
    def read_csv(filename):
        return list(csv.DictReader(gzip.open(ROOT/filename,'rt',encoding='utf-8-sig',newline=''), delimiter=';' if YEAR==2026 and filename!='premiums.csv.gz' else ','))
    premiums=read_csv('premiums.csv.gz'); tariffs=read_csv('tariffs.csv.gz'); coverage=read_csv('coverage.csv.gz')
    for collection in (premiums,tariffs,coverage):
        assert collection and all(r['Geschäftsjahr']==str(YEAR) and r['Erhebungsjahr']==str(YEAR-1) for r in collection), 'Wrong publication year'
    insurer_ids={int(r['Versicherer']) for r in premiums}
    insurers={int(r[1]):str(r[3]).strip() for r in openpyxl.load_workbook(ROOT/'insurers.xlsx',read_only=True,data_only=True).worksheets[1].values if isinstance(r[1],(int,float)) and r[3]}
    assert insurer_ids <= insurers.keys(), f'Missing insurer IDs: {insurer_ids-insurers.keys()}'
    model_rows={}
    for r in tariffs:
        if r['Kategorie']!='MOD':continue
        mid=(int(r['Versicherer']),r['Tarif'])
        assert mid not in model_rows
        assert r['Tariftyp'] in (('BASE','HAM','HMO','DIV') if YEAR==2026 else ('BASE','PRAXIS','TEL_DIG','FLEX','PHARM'))
        model_rows[mid]=dict(id='hm_'+key(dataset,*mid),dataset_id=dataset,insurer_id=mid[0],tariff_code=mid[1],name=r['Name_FR'].strip() or r['Name_DE'].strip(),category=r['Tariftyp'])
    region_rows={}
    for r in premiums:
        rid=r['Kanton']+'-'+r['Region'][-1]
        region_rows[rid]=dict(id=dataset+'_'+rid,dataset_id=dataset,region_id=rid,canton=r['Kanton'],number=int(r['Region'][-1]))
    w=openpyxl.load_workbook(ROOT/'regions.xlsx',read_only=True,data_only=True)
    assert str(YEAR) in str(w['Informations']['A1'].value)
    localities={}
    for r in list(w['A_COM'].values)[5:]:
        if not isinstance(r[0],(int,float)):continue
        bfs,canton,municipality,region,district,npa,locality=r
        rid=f'{canton}-{int(region)}'
        assert rid in region_rows
        lid='hl_'+key(dataset,int(bfs),str(int(npa)),locality)
        localities[lid]=dict(id=lid,dataset_id=dataset,region_key=region_rows[rid]['id'],municipality_id=int(bfs),municipality=municipality,postal_code=str(int(npa)),locality=locality,search_text=normalize(f'{npa} {locality} {municipality}'))
    eligibility={}
    for r in coverage:
        mid=model_rows[(int(r['Versicherer']),r['Tarif'])]['id'];rid=region_rows[r['Kanton']+'-'+r['Region'][-1]]['id']
        assert r['Eingeschränkt'] in ('N','Y')
        municipalities=[int(x) for x in r['Gemeinden-BFS'].split(',') if x.strip()]
        assert (r['Eingeschränkt']=='Y') == bool(municipalities)
        eid='he_'+key(mid,rid)
        assert eid not in eligibility
        eligibility[eid]=dict(id=eid,model_id=mid,region_key=rid,restricted=r['Eingeschränkt']=='Y',municipality_ids=municipalities)
    rows=[];seen=set();ages={'AKA_03_ERW':'adult','AKA_02_JUG':'young_adult','AKA_01_KIN':'child','AKL-ERW':'adult','AKL-JUG':'young_adult','AKL-KIN':'child'}
    for r in premiums:
        model=model_rows[(int(r['Versicherer']),r['Tarif'])];rid=region_rows[r['Kanton']+'-'+r['Region'][-1]]['id']
        assert model['category']==(r['Tariftyp'].removeprefix('TAR-') if YEAR==2026 else r['Tariftyp'])
        amount=Decimal(r['Prämie'])*100
        assert amount==int(amount) and amount>=0
        deductible=int(r['Franchise'].replace('-', '_').split('_')[-1]);age=ages[r['Altersklasse']]
        assert deductible in ([0,100,200,300,400,500,600] if age=='child' else [300,500,1000,1500,2000,2500])
        assert r['Unfalleinschluss'] in (('MIT-UNF','OHN-UNF') if YEAR==2026 else ('MIT_UNF','OHN_UNF'))
        subgroup=r['Altersuntergruppe']
        if YEAR==2026 and age!='child':
            assert subgroup==''
            subgroup='E1' if age=='adult' else 'J1'
        grain=(model['id'],rid,age,subgroup,r['Unfalleinschluss'],deductible)
        assert grain not in seen,'Duplicate premium grain';seen.add(grain)
        eid='he_'+key(model['id'],rid)
        if model['category']=='BASE' and eid not in eligibility:
            eligibility[eid]=dict(id=eid,model_id=model['id'],region_key=rid,restricted=False,municipality_ids=[])
        assert eid in eligibility, 'Missing geographical eligibility'
        rows.append(dict(id='hp_'+key(*grain),dataset_id=dataset,model_id=model['id'],region_key=rid,age_group=age,age_subgroup=subgroup,accident=r['Unfalleinschluss'] in ('MIT_UNF','MIT-UNF'),deductible=deductible,monthly_premium_minor=int(amount),currency='CHF',raw=r))
    counts=dict(premiums=len(rows),models=len(model_rows),insurers=len(insurer_ids),localities=len(localities),regions=len(region_rows),swissRegions=sum(r['canton'] not in ('ZE','ZR') for r in region_rows.values()),eligibility=len(eligibility))
    identities=[]
    if YEAR==2026:
        identities=[{k:r[k] for k in ('id','name','brand')} for r in json.loads((ROOT/'insurers-brands.json').read_text('utf8'))]
        assert {r['id'] for r in identities}==insurer_ids, 'Incomplete historical identities'
        assert all(r['name'] and r['brand'] for r in identities)
    with gzip.open(ROOT/'normalized.jsonl.gz','wt',encoding='utf8',newline='\n') as out:
        def emit(table,row):out.write(json.dumps(dict(table=table,row=row),ensure_ascii=False,separators=(',',':'))+'\n')
        emit('health_datasets',dict(id=dataset,year=YEAR,active=False,sources=sources,counts=counts,insurer_identities=identities))
        for iid in sorted(insurer_ids):emit('health_insurers',dict(id=iid,name=insurers[iid]))
        for table,collection in [('health_models',model_rows.values()),('health_regions',region_rows.values()),('health_localities',localities.values()),('health_eligibility',eligibility.values()),('health_premiums',rows)]:
            for r in collection:emit(table,r)
    profile=dict(datasetId=dataset,normalizerSha256=normalizer_sha256,counts=counts,years=[YEAR],duplicates=0,missingModels=0,missingEligibility=0,cantons=dict(Counter(r['Kanton'] for r in premiums)),ageSubgroups={r['Tarif']:r['Name_FR'] for r in tariffs if r['Kategorie']=='ALT'},note='ZE/ZR archived, excluded from Swiss map and comparison. K1 used for children; family discounts retained but require insurer eligibility confirmation.')
    (ROOT/'quality.json').write_text(json.dumps(profile,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(profile,ensure_ascii=False))

if __name__=='__main__':main()
