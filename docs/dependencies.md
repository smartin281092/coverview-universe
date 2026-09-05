# Politique de dépendances

> **Résumé** : Checklist avant tout ajout (besoin réel, maintenance, licence, sécurité) ; lockfile intouchable à la main ; mises à jour outillées et auditées ; règles anti-typosquatting pour l'agent.

## DEP-01 — Avant d'ajouter un paquet

Répondre dans l'ordre :

1. Le besoin est-il couvert par la stdlib Node, la plateforme, ou une dépendance **déjà présente** ?
2. Le paquet est-il maintenu (commits récents, issues traitées), largement adopté, de taille raisonnable ?
3. Licence compatible : allowlist `MIT`, `Apache-2.0`, `BSD`, `ISC` ; toute licence copyleft (GPL/AGPL) ou inhabituelle DOIT être signalée avant ajout.
4. Historique de sécurité et surface transitive acceptables ?
5. Vaut-il mieux écrire les ~30 lignes nous-mêmes ? (Pas de dépendance pour 10 lignes triviales.)

## DEP-02 — Lockfile

Le lockfile est committé, jamais édité à la main, jamais régénéré en masse dans une PR fonctionnelle. Versions : ranges cohérents avec la politique du repo (caret par défaut, exact pour les paquets critiques).

## DEP-03 — Mises à jour

Cadence régulière via outillage (Renovate/Dependabot) ; les mises à jour majeures sont des PR dédiées avec lecture du changelog. Jamais de mise à jour massive mélangée à une fonctionnalité (G-13).

## DEP-04 — Audit

`audit` (ou équivalent) en CI ; vulnérabilités critiques bloquantes ; exceptions documentées avec échéance.

## DEP-05 — Règles spécifiques à l'agent IA (G-16)

- Toute dépendance ajoutée est **déclarée dans le compte rendu** avec sa justification DEP-01.
- Vérifier le **nom exact** du paquet (risque de typosquatting) et qu'il correspond bien au projet officiel.
- Préférer systématiquement une dépendance déjà présente à une nouvelle équivalente.
- Ne jamais ajouter une dépendance pour contourner un problème de configuration ou de typage.
- `patch-package` (ou équivalent) en dernier recours uniquement, documenté.
