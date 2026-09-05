# Plan — S-xxx : <titre>

> Statut : brouillon | soumis | approuvé (« GO S-xxx ») | rejeté — diff_from : <plan précédent si itération>
> **Session recommandée** (PROG-12) : <tier T-rapide|T-standard|T-profond|T-frontière> · effort <low|medium|high|xhigh|max> — <justification en une ligne>
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
