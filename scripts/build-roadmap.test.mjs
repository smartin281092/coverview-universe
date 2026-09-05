import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,readdirSync,realpathSync,lstatSync,rmSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,isAbsolute,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from './build-roadmap.mjs';

const scripts=dirname(fileURLToPath(import.meta.url));
const prefix='coverview-roadmap-build-';
const question={ref:'bible.question.005',question:'Valider le périmètre du document de test ?',options:['Oui, périmètre limité','Différer'],recommended:0,blocks:'Activation réelle du document'};
const source='Source synthétique de test : une exigence de document persistant.\n';

function fixture(t,{orphan=false,state={schema_version:1,slices:{}}}={}) {
  const parent=realpathSync(tmpdir()),root=mkdtempSync(join(parent,prefix));
  const local=path=>{
    const target=resolve(root,path),rel=relative(root,target);
    assert.ok(rel&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith(`..${process.platform==='win32'?'\\':'/'}`),'Le fichier doit rester dans la fixture');
    return target;
  };
  const put=(path,value)=>{const target=local(path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,value,'utf8');};
  const putJSON=(path,value)=>put(path,`${JSON.stringify(value,null,2)}\n`);
  t.after(()=>{
    // Vérifier le chemin absolu et son confinement avant toute suppression récursive.
    const actual=realpathSync(root),rel=relative(parent,actual);
    assert.equal(lstatSync(root).isSymbolicLink(),false);
    assert.equal(actual,root);
    assert.ok(rel&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..\\')&&!rel.startsWith('../'));
    assert.ok(basename(actual).startsWith(prefix));
    rmSync(actual,{recursive:true,force:false});
  });
  const units=[{id:'bible.v15.p0001',kind:'paragraph',domain:'documents-signature',source_anchors:['p0001'],source_link:'bible.extracted.md#p0001',section_path:[{anchor:'p0001',title:'82. Workflow C - Recherche LPP'}],source_statement:'Conserver une demande documentaire.'}];
  if(orphan)units.push({id:'bible.v15.p0002',kind:'paragraph',domain:'documents-signature',source_anchors:['p0002'],source_link:'bible.extracted.md#p0002',section_path:[],source_statement:'Une seconde exigence non affectée.'});
  put('references/source.docx',source);
  putJSON('docs/product/requirements.json',{source:'references/source.docx',sha256:createHash('sha256').update(source).digest('hex'),units});
  put('docs/product/open-questions.md',`${question.ref} : ${question.question}\n`);
  put('docs/data.md','');
  putJSON('roadmap/specs/test.json',[{
    id:'S-001',title:'Conserver un document de test',milestone:'M2',objective:'La personne retrouve son document enregistré.',depends_on:[],apps:['api','client'],modules:['documents'],mode:'local-fixtures',priority:1,session_budget:1,
    journey:['Déposer le document puis le relire après rechargement.'],data:['Document privé avec propriétaire.'],permissions:['Le propriétaire seulement peut ouvrir son document.'],events_jobs:['Aucun job nécessaire.'],fixtures:['Deux propriétaires et un document de test.'],
    integrations:{simulated:[],real:['Stockage local du document'],activation_slices:[]},
    criteria:[{criterion:'Le document enregistré peut être relu uniquement par son propriétaire.',source_ranges:[[1,1]],oracle:'V2',test:'Enregistrer, recharger puis refuser la lecture par un autre compte.'}],
    questions:[question],satellites:['data.md'],exclusions:[],risks:['Une fuite doit être refusée côté serveur.'],out_of_scope:['Aucune transmission externe.'],split_trigger:'Découper après un résultat documentaire autonome si nécessaire.',
  }]);
  putJSON('roadmap/state.json',state);
  putJSON('roadmap/source-links.json',[]);
  putJSON('roadmap/context.json',[]);
  return {root,local,put,putJSON};
}

test('génération puis --check CLI : roundtrip déterministe sur une fixture minimale',t=>{
  const f=fixture(t),before=readFileSync(f.local('roadmap/state.json'),'utf8');
  const first=build(f.root,{requireComplete:true});
  assert.equal(first.summary.slices,1);
  assert.equal(first.summary.assigned_units,1);
  assert.equal(first.files.length,9);
  assert.equal(first.changed.length,first.files.length);
  const bytes=new Map(first.files.map(path=>[path,readFileSync(f.local(path),'utf8')]));
  assert.deepEqual(build(f.root,{check:true,requireComplete:true}).changed,[]);
  assert.deepEqual(build(f.root,{requireComplete:true}).changed,[]);
  for(const[path,value]of bytes)assert.equal(readFileSync(f.local(path),'utf8'),value);
  // Copier seulement les deux modules nécessaires au vrai point d'entrée CLI.
  for(const name of ['build-roadmap.mjs','roadmap-lib.mjs'])f.put(`scripts/${name}`,readFileSync(join(scripts,name),'utf8'));
  const cli=spawnSync(process.execPath,[f.local('scripts/build-roadmap.mjs'),'--check','--require-complete'],{cwd:f.root,encoding:'utf8',shell:false});
  assert.equal(cli.status,0,cli.stderr);
  assert.match(cli.stdout,/Vues à jour/);
  assert.equal(readFileSync(f.local('roadmap/state.json'),'utf8'),before);
});

test('--check détecte une vue modifiée ou absente sans la réparer silencieusement',t=>{
  const f=fixture(t);build(f.root);
  const target=f.local('roadmap/plans/S-001.plan.md');
  writeFileSync(target,'Modification manuelle non canonique.\n','utf8');
  assert.throws(()=>build(f.root,{check:true}),/Vues manquantes ou périmées/);
  assert.equal(readFileSync(target,'utf8'),'Modification manuelle non canonique.\n');
  const repaired=build(f.root);
  assert.deepEqual(repaired.changed,['roadmap/plans/S-001.plan.md']);
  unlinkSync(target);
  assert.throws(()=>build(f.root,{check:true}),/roadmap\/plans\/S-001\.plan\.md/);
});

test('source modifiée et exigence orpheline bloquent avant toute génération',t=>{
  const f=fixture(t,{orphan:true});
  const before=readdirSync(f.local('roadmap')).sort();
  assert.throws(()=>build(f.root,{requireComplete:true}),/Couverture incomplète : 1 unités/);
  assert.deepEqual(readdirSync(f.local('roadmap')).sort(),before);
  // Le mode de travail incomplet reste explicite et utilisable sans le gate final.
  assert.equal(build(f.root).context.coverage.unassigned.length,1);
  const roadmap=readFileSync(f.local('ROADMAP.md'),'utf8');
  f.put('references/source.docx',`${source}Altération non réconciliée.\n`);
  assert.throws(()=>build(f.root),/La bible a changé/);
  assert.equal(readFileSync(f.local('ROADMAP.md'),'utf8'),roadmap);
});

test('décisions, journal et ledger persistent ; CRLF équivaut à LF pour --check',t=>{
  const state={schema_version:1,slices:{'S-001':{
    status:'ready',approval:'GO S-001 · 1a',session:'gpt-6-astra / ultra observé',cost:'non observable',
    decisions:[{ref:question.ref,question:question.question,answer:'Périmètre limité approuvé',evidence:'Message utilisateur du test'}],
    verification_attempts:[{target:'lecture inter-compte',oracle:'V2',observed:'Refus absent dans le premier essai',decision:'Corriger la policy puis changer le cas de diagnostic'}],
    notes:['La preuve est conservée.'],ledger:{verified:[],done_unverified:['Écran créé'],assumed:['Aucune règle légale déduite']},
  }}};
  const f=fixture(t,{state}),stateBefore=readFileSync(f.local('roadmap/state.json'),'utf8');
  const result=build(f.root),plan=readFileSync(f.local('roadmap/plans/S-001.plan.md'),'utf8'),prompt=readFileSync(f.local('roadmap/prompts/S-001.prompt.md'),'utf8');
  assert.ok(plan.indexOf('## Questions bloquantes')<plan.indexOf('## Objectif'));
  for(const value of ['GO S-001 · 1a','Périmètre limité approuvé','Message utilisateur du test','lecture inter-compte','Refus absent','Corriger la policy','Écran créé','La preuve est conservée.'])assert.ok(plan.includes(value),value);
  assert.ok(!plan.includes('Aucune tentative enregistrée'));
  assert.ok(!plan.includes('[object Object]'));
  assert.ok(plan.includes('bible.v15.p0001'));
  assert.ok(!prompt.includes('bible.v15.p0001'));
  assert.ok(prompt.includes('../plans/S-001.plan.md#s-001-c01'));
  for(const path of result.files){const original=readFileSync(f.local(path),'utf8');writeFileSync(f.local(path),original.replace(/\r?\n/g,'\r\n'),'utf8');}
  assert.deepEqual(build(f.root,{check:true,requireComplete:true}).changed,[]);
  assert.equal(readFileSync(f.local('roadmap/state.json'),'utf8'),stateBefore);
});

test('mandat séquentiel : relais explicite sans GO répété ni réponse inventée',t=>{
  const execution={active:true,mode:'sequential-fresh-tasks',authorization:'Exécuter la roadmap et choisir les meilleurs défauts.',evidence:'Message utilisateur autorisant la séquence.'};
  const state={schema_version:1,execution,slices:{}};
  const f=fixture(t,{state});build(f.root);
  const prompt=readFileSync(f.local('roadmap/prompts/S-001.prompt.md'),'utf8');
  assert.match(prompt,/mandat séquentiel PROG-23/);
  assert.match(prompt,/sélectionner et justifier les réponses restantes/);
  assert.match(prompt,/créer immédiatement la tâche suivante gpt-6-astra \/ ultra/);
  assert.ok(!prompt.includes('Répondre « GO S-001'));
  assert.ok(!prompt.includes('sans l’exécuter automatiquement'));
  assert.deepEqual(JSON.parse(readFileSync(f.local('roadmap/state.json'),'utf8')),state);
  f.putJSON('roadmap/state.json',{...state,slices:{'S-001':{status:'ready',approval:'Mandat utilisateur délégué',decisions:[]}}});
  assert.throws(()=>build(f.root),/réponse et preuve absentes/);
});

test('un mandat désactivé ou incomplet ne déclenche pas un relais autorisé',t=>{
  const execution={active:false,mode:'sequential-fresh-tasks',authorization:'Ancien mandat.',evidence:'Message de test.'};
  const f=fixture(t,{state:{schema_version:1,execution,slices:{}}});build(f.root);
  assert.match(readFileSync(f.local('roadmap/prompts/S-001.prompt.md'),'utf8'),/Répondre « GO S-001/);
  f.putJSON('roadmap/state.json',{schema_version:1,execution:{...execution,active:true,evidence:''},slices:{}});
  assert.throws(()=>build(f.root),/Mandat d’exécution séquentielle incomplet/);
});
