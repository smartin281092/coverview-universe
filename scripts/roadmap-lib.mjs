import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, relative, isAbsolute} from 'node:path';

const fail = message => {throw new Error(message);};
const strings = (value, name, nonempty=false) => {
  if (!Array.isArray(value) || value.some(x=>typeof x!=='string'||!x.trim()) || (nonempty&&!value.length)) fail(`Liste invalide : ${name}`);
};
export function safePath(root, path) {
  if (typeof path!=='string'||!path) fail('Chemin attendu.');
  const target=resolve(root,path), rel=relative(root,target);
  if (isAbsolute(rel)||rel==='..'||rel.startsWith('../')||rel.startsWith('..\\')) fail(`Chemin hors dépôt : ${path}`);
  return target;
}
export function resolveRanges(units,ranges,label='source_ranges') {
  if (!Array.isArray(ranges)) fail(`Plages absentes : ${label}`);
  for (const r of ranges) if (!Array.isArray(r)||r.length!==2||!r.every(Number.isInteger)||r[0]<1||r[1]<r[0]||r[1]>3062) fail(`Plage invalide : ${label}`);
  for (const [a,b] of ranges) if (!units.some(u=>u.source_anchors.some(p=>Number(p.slice(1))>=a&&Number(p.slice(1))<=b))) fail(`Plage sans source : ${label} ${a}-${b}`);
  return units.filter(u=>!['heading','glossary'].includes(u.kind)&&u.source_anchors.some(p=>ranges.some(([a,b])=>Number(p.slice(1))>=a&&Number(p.slice(1))<=b))).map(u=>u.id);
}
export function sortSlices(slices) {
  const byId=new Map(slices.map(s=>[s.id,s]));
  if (byId.size!==slices.length) fail('IDs de slices dupliqués.');
  const done=new Set(), result=[];
  for (const s of slices) for (const d of s.depends_on) if (!byId.has(d)) fail(`Dépendance inconnue : ${s.id} → ${d}`);
  while (result.length<slices.length) {
    const next=slices.filter(s=>!done.has(s.id)&&s.depends_on.every(d=>done.has(d))).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id))[0];
    if (!next) fail(`Cycle de dépendances : ${slices.filter(s=>!done.has(s.id)).map(s=>s.id).join(', ')}`);
    result.push(next); done.add(next.id);
  }
  return result;
}
export function validateModel(slices, units, state, questionText, root) {
  const ids=new Set(slices.map(s=>s.id));
  const questionIds=new Set(questionText.match(/bible\.question\.\d{3}\b/g)||[]);
  for (const s of slices) {
    if (!/^S-\d{3}[a-z]?$/.test(s.id)) fail(`ID slice invalide : ${s.id}`);
    for (const key of ['title','objective','milestone','split_trigger']) if (typeof s[key]!=='string'||!s[key].trim()) fail(`${s.id} : ${key} absent`);
    if (!['foundation','local-fixtures','integration','release'].includes(s.mode)) fail(`${s.id} : mode invalide`);
    if (s.session_budget!==1||!Number.isFinite(s.priority)) fail(`${s.id} : budget/priorité invalide`);
    for (const key of ['depends_on','apps','modules','journey','data','permissions','events_jobs','fixtures','satellites','exclusions','risks','out_of_scope']) strings(s[key],`${s.id}.${key}`,['journey','permissions','fixtures'].includes(key));
    if (new Set(s.depends_on).size!==s.depends_on.length) fail(`${s.id} : dépendance dupliquée`);
    for (const path of s.satellites) if (root&&!existsSync(safePath(root,`docs/${path}`))) fail(`${s.id} : satellite absent ${path}`);
    for (const key of ['simulated','real','activation_slices']) strings(s.integrations?.[key],`${s.id}.integrations.${key}`);
    for (const id of s.integrations.activation_slices) if (!ids.has(id)||id===s.id) fail(`${s.id} : activation inconnue ou réflexive ${id}`);
    if (!Array.isArray(s.criteria)||!s.criteria.length) fail(`${s.id} : aucun critère`);
    s.criteria.forEach((c,i)=>{
      if (!c.criterion?.trim()||!c.test?.trim()||!['V0','V1','V2','V3','V5'].includes(c.oracle)) fail(`${s.id} critère ${i+1} incomplet`);
      resolveRanges(units,c.source_ranges,`${s.id}-C${i+1}`);
    });
    if (!Array.isArray(s.questions)) fail(`${s.id} : questions absentes`);
    for (const q of s.questions) {
      if (!q.ref||!(/^project\.[\w.-]+$/.test(q.ref)||questionIds.has(q.ref))||!q.question?.trim()||!q.blocks?.trim()) fail(`${s.id} : question invalide ${q.ref}`);
      strings(q.options,`${s.id}.${q.ref}.options`,true);
      if(q.options.length<2||!Number.isInteger(q.recommended)||!q.options[q.recommended]) fail(`${s.id} : défaut/options invalides ${q.ref}`);
    }
  }
  const order=sortSlices(slices);
  if (!state||state.schema_version!==1||typeof state.slices!=='object'||Array.isArray(state.slices)) fail('État de programme invalide.');
  let running=0;
  for (const [id,v] of Object.entries(state.slices)) {
    if (!ids.has(id)||!['idea','specified','ready','running','review','done'].includes(v.status)) fail(`État de slice inconnu/invalide : ${id}`);
    if (v.status==='running') running++;
    if (['ready','running','review','done'].includes(v.status)&&!v.approval?.trim()) fail(`${id} : autorisation effective absente`);
    if (['ready','running','review','done'].includes(v.status)) for (const q of slices.find(s=>s.id===id).questions) {
      if(!v.decisions?.some(d=>d.ref===q.ref&&d.question===q.question&&d.answer?.trim()&&d.evidence?.trim())) fail(`${id} : réponse et preuve absentes pour ${q.ref} — ${q.question}`);
    }
    if(v.status==='running'&&!slices.find(s=>s.id===id).depends_on.every(d=>state.slices[d]?.status==='done')) fail(`${id} : dépendances non terminées`);
  }
  if(running>1) fail('Plusieurs slices running.');
  return order;
}
export function compileCoverage(slices, inventory, extraLinks, context) {
  const allIds=new Set(inventory.units.map(u=>u.id));
  if (allIds.size!==inventory.units.length) fail('IDs source dupliqués.');
  const assignments=slices.flatMap(s=>s.criteria.map((c,i)=>({id:`${s.id}-C${String(i+1).padStart(2,'0')}`,disposition:'implementation',criterion:c.criterion,oracle:c.oracle,test:c.test,source_ids:resolveRanges(inventory.units,c.source_ranges),slices:[s.id]})));
  for (const link of extraLinks) {
    const entry=assignments.find(a=>a.id===link.criterion_ref);
    if(!entry||!link.reason?.trim()) fail(`Lien complémentaire invalide : ${link.criterion_ref}`);
    const ids=resolveRanges(inventory.units,link.source_ranges);
    if(!ids.length) fail(`Lien complémentaire sans source : ${link.criterion_ref}`);
    entry.source_ids=[...new Set([...entry.source_ids,...ids])];
  }
  const implemented=new Set(assignments.flatMap(a=>a.source_ids));
  const seenContext=new Set();
  for (const [i,c] of context.entries()) {
    if(!c.reason?.trim()) fail('Justification contexte absente.');
    strings(c.source_ids,'contexte',true);
    for (const id of c.source_ids) {
      if(!allIds.has(id)) fail(`Source inconnue : ${id}`);
      if(implemented.has(id)||seenContext.has(id)) fail(`Source affectée en contexte et ailleurs : ${id}`);
      seenContext.add(id);
    }
    assignments.push({id:`CTX-${String(i+1).padStart(3,'0')}`,disposition:'context',criterion:c.reason,source_ids:c.source_ids,slices:[]});
  }
  const assigned=new Set([...implemented,...seenContext]);
  return {schema_version:2,source_inventory:'docs/product/requirements.json',source_sha256:inventory.sha256,meaning:'Couverture de planification seulement ; aucune preuve d’implémentation.',summary:{slices:slices.length,criteria:assignments.filter(a=>a.disposition==='implementation').length,implementation_units:implemented.size,context_units:seenContext.size,assigned_units:assigned.size,total_units:allIds.size},assignments,unassigned:inventory.units.filter(u=>!assigned.has(u.id)).map(u=>u.id)};
}
export function loadRoadmap(root) {
  const read=p=>readFileSync(safePath(root,p),'utf8');
  const json=p=>JSON.parse(read(p));
  const inventory=json('docs/product/requirements.json');
  const hash=createHash('sha256').update(readFileSync(safePath(root,inventory.source))).digest('hex');
  if(hash!==inventory.sha256) fail('La bible a changé : réconcilier inventaire et affectations.');
  const files=readdirSync(safePath(root,'roadmap/specs')).filter(f=>f.endsWith('.json')).sort();
  const slices=files.flatMap(file=>json(`roadmap/specs/${file}`).map(s=>({...s,spec_file:`roadmap/specs/${file}`})));
  const state=json('roadmap/state.json');
  const order=validateModel(slices,inventory.units,state,read('docs/product/open-questions.md'),root);
  const coverage=compileCoverage(slices,inventory,json('roadmap/source-links.json'),json('roadmap/context.json'));
  return {slices,order,state,inventory,coverage};
}
