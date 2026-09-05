# Plan — S-xxx : <titre>

> Statut : brouillon | soumis | approuvé (« GO S-xxx ») | rejeté — diff_from : <plan précédent si itération>
> **Session requise** (PROG-12) : GPT-6 Astra (`gpt-6-astra`) · effort `ultra` — <objectif qui justifie le périmètre de cette session>
> **Session réelle** (renseignée à la livraison, PROG-08) : <modèle + effort effectivement utilisés>
> **Budget** (PROG-14) : <N sessions attendues> — au-delà, redécouper plutôt que prolonger

## Questions bloquantes (PROG-15) — réponse requise avant GO

> Supprimer cette section si aucune inconnue ne coche les critères PROG-15 — c'est le cas courant.
> Une inconnue bloquante ne compte pas dans le plafond de 3 questions (G-01).

1. <Question fermée>
   (a) <option>   ← défaut proposé
   (b) <option>

→ Répondre : « GO S-xxx · 1a » — ou « GO S-xxx · défauts »

## Objectif (reformulé)
<Résultat utilisateur concret. Une phrase de critère de fin.>

## Couverture et paquet de contexte (PROG-21)

- Exigences : <IDs inventaire + ancrages de la bible, sans recopier tout le document>
- Prompt : <roadmap/prompts/S-xxx.prompt.md>
- Dépendances : <slices done requises>
- Mode : <données fictives / services réels ; intégrations encore simulées nommées>
- Reprise : <roadmap/handoffs/…> — protocole `docs/codex.md`

## Hypothèses posées (réversibles uniquement — PROG-15)
- <Hypothèse explicite — à invalider si fausse> · rayon d'impact : <ce qu'il faut changer si elle est fausse>

## Inconnues réversibles → questions bornées (≤ 3, G-01)
1. <Question fermée>

## Definition of Done — avec oracles (PROG-10)
- [ ] <Critère> — oracle : V2 `pnpm test <path>`
- [ ] <Critère> — oracle : V3 parcours réel <étapes>
- [ ] Ledger sans « supposé » sur les éléments critiques — V5 revue

## Périmètre
- Modules : <modules/…> · Apps : <api, client…>
- Permissions : <resource.action…> · Données/migrations : <…>
- Événements / rooms : <…> · Jobs : <…>

## Satellites à charger
<data.md, api.md, …> — exclusions : <marketing-web.md, …>

## Journal de vérification (§6.4 — origine HRN-LOOP-006)

Une ligne par tentative de vérification échouée sur une même cible. **À la 2e ligne sur la même cible : changer de stratégie** (diagnostic explicite, réduction de portée, escalade) — jamais un retry à l'identique.

| # | Cible | Oracle | Observé | Décision |
|---|---|---|---|---|
|   |       |        |         |          |

## Risques et mitigations
- <Risque> → <Mitigation>

## Hors-périmètre de cette slice
- <Explicitement différé>
