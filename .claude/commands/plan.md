---
description: Crée le plan persisté d'une slice et le soumet (PROG-07) — usage /plan S-012
---
Lis docs/program.md et roadmap/backlog.yaml. Pour la slice $ARGUMENTS : vérifie ses dépendances (PROG-05), crée roadmap/plans/$ARGUMENTS.plan.md depuis templates/slice.plan.md (satellites à charger et exclusions inclus), renseigne la ligne « Session recommandée » (modèle + effort, PROG-12) d'après le profil réel de la slice, classe chaque inconnue selon PROG-15 — bloquante (données persistées, droit, argent/délai/irréversible, migration si infirmée) ou réversible. Les bloquantes vont en tête du plan au format fermé avec défaut proposé (PROG-16) et ne comptent pas dans le plafond ; les réversibles deviennent des hypothèses posées avec leur rayon d'impact, ou au plus 3 questions bornées (G-01). Soumets ensuite le plan et attends mon « GO $ARGUMENTS » — portant les réponses s'il y a des questions bloquantes. N'exécute rien avant.

Si tu te surprends à écrire une hypothèse sur un montant, une date d'effet, un arrondi, un droit ou une suppression : c'est une question bloquante, pas une hypothèse. Ne la reclasse pas pour aller plus vite.
