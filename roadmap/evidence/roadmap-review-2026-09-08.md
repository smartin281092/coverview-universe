# Revue de roadmap — 8 septembre 2026

Revue PROG-11 demandée par `/review-roadmap`. Les corrections documentaires sont appliquées sous le [mandat d’autonomie](../execution-policy.md). Périmètre : graphe complet, états enregistrés et preuves récentes des parcours livrés ou en cours ; pas de nouvelle recette applicative ni de relecture sémantique intégrale de la bible.

## État et ordre retenu

122 slices : **4 done, 1 running, 1 review, 116 specified**, aucune ready ni idea. Les slices done restent S-000a, S-000b, S-013a et S-010. Aucun statut n’est avancé par cette revue.

| Ordre | Résultat | Décision |
|---|---|---|
| 1 | S-042a — documents et profil | Conserver running et son propriétaire ; consolider les preuves des critères initiaux avant clôture. |
| 2 | S-080 — entrant et opportunités CRM | Dépendances S-000b/S-013a done ; priorité 70 → 31 pour respecter le mandat. Questions de droits et de définition commerciale à résoudre à l’entrée, sans inventer de faits externes. |
| 3 | S-011 — contenus et acquisition | Conserver review ; priorité 111 → 32. Reprendre le raccord de collecte après S-080 et obtenir les preuves éditoriales manquantes. |
| 4 | S-012 — FAQ et attribution | Priorité 112 → 33 ; attend toujours S-011 et S-080 done. |

Ce changement aligne le tri canonique sur l’ordre déjà demandé. S-081 (dossiers/tâches, priorité 35) et S-017 (documents procéduraux, priorité 40) suivent ; aucune capacité ni dépendance n’est supprimée. L’éligibilité technique de S-080 n’autorise pas une seconde slice running pendant S-042a. Un blocage externe de S-011 permet seulement une reprise indépendante selon le mandat, jamais une clôture artificielle.

## Preuves et corrections de lecture

- **Vérifié documentairement — S-042a** : le checkpoint « OpenAI absent / sessions expirées / CUA indisponible » est historique. Une [analyse réelle a été confirmée par l’utilisateur](document-reading-ux.md), et la fiche authentifiée observée. Les [onglets d’identité et en-têtes Wallet](identity-tabs-heading-spacing.md) disposent également d’une recette mobile/desktop. Ces éléments rejoignent l’état canonique avec leur portée exacte.
- **Reste à vérifier — S-042a** : consolider le ledger C01–C07, notamment conservation de l’original, isolation, échecs/reprises antivirus-OCR, provenance, confirmation sans écrasement, erreurs accessibles et suppression sans résurrection. Les preuves techniques existantes et la réussite d’une analyse ne démontrent pas à elles seules tous ces parcours. La capture physique de carte reste non exercée selon le [ledger profil](profile-sections-identity-attachment.md).
- **Travail en cours — extension Admin** : des modifications locales d’administration des utilisateurs et de ciblage documentaire sont présentes dans le checkout partagé. Elles ne sont ni livrées ni validées par cette revue. Leur propriétaire doit conserver une frontière de livraison distincte et vérifier permissions, MFA, audit et cible explicite ; appliquer PROG-14 avant tout nouvel élargissement. Les signatures et transmissions des slices S-017/S-018/S-035 et suivantes ne deviennent pas implicitement des critères de clôture du dépôt documentaire initial.
- **Reste à vérifier — S-011** : validation biographique C01, source Instagram/liens réciproques C04 et collecte/reprise/CRM C06 restent ouverts dans [son ledger](S-011.md). Les mentions anciennes d’absence de WorkOS réel et de slice éligible sont annotées comme historiques : S-000b et S-013a sont désormais done. Les refontes visuelles ne valident pas ces critères métier.

Les retours récents sur les onglets et titres justifient de conserver la revue des parcours réels avant clôture. Ils ne justifient pas une nouvelle slice de refonte globale. Les coûts constatés ne permettent pas ici un arbitrage chiffré ; aucun coût ni délai n’est estimé à partir du nombre de slices.

## Purge et contrôles

Aucune idea à purger. Aucune mémoire active expirée ni candidat restant après la [revue mémoire du même jour](memory-review-2026-09-08.md) ; ses 37 entrées et leurs destinations restent tracées.

Le générateur affiche désormais les slices réellement running/review à la place du départ périmé sur S-000a. Les vues sont régénérées depuis specs/state. La couverture conserve **694 critères et 2 115/2 115 unités source** : 1 742 reliées aux critères, 373 de contexte, aucune non affectée. Les contrôles de génération, graphe, planification et référentiel attestent la cohérence documentaire ; ils ne valent pas recette produit.

**Vérifié** : génération puis `--check --require-complete`, vérification de planification complète, 27 tests existants de l’outillage, lint du référentiel sans erreur ni avertissement, liens locaux du rapport, affichage des statuts actuels et `git diff --check`. Aucune dépendance ni nouveau test de surface ajouté.
