# Adéquation minimale du référent au besoin

## Périmètre et parcours

Propriétaire : partner-workspace. Brief I.10.2–10.4/12/18/20 et II.7. Wallet → Offres → demande → « Adéquation du référent au besoin » ; Partner et supervision Admin → fiche Lead → « Référent habituel et continuité ». Le bilan rapproche les souhaits actuels et les déclarations partageables du seul référent confirmé pour cette catégorie. Sources et dates s'ouvrent dans une seconde vue du dialogue, sans allonger la page.

Le référent demeure un choix de relation, distinct du responsable et des contributeurs de cette demande. Ce parcours n'attribue aucun Lead et ne vérifie ni éligibilité globale, capacité ni créneau réservable. Le [bilan personnel](advisor-assessment.md) demeure séparé, avec ses propres droits et ses sources privées.

## Audience et priorité du client

**partner.referent-assessment.1** — GET `/wallet|partner/leads/:id/referent-assessment` utilise un contrat dédié, sans identifiant de conseiller en entrée. Wallet exige le propriétaire canonique courant ; Partner exige l'accès opérationnel existant à ce Lead. Admin conserve permission et MFA, manager reste limité à son équipe habilitée. Vue de progression, apporteur après transfert, voisin et simple référent sans affectation n'obtiennent aucun accès supplémentaire. Chaque lecture recontrôle session, membre/organisation, Lead et profil. Un rôle administratif ne remplace jamais la propriété dans la route Wallet.

**partner.referent-assessment.2** — Le [choix du référent](../README.md#référents-habituels-et-continuité--relais-b920) suit sa confirmation et la propriété/révision du profil, y compris après aller-retour. Le besoin clos et la demande ouverte de changement d'interlocuteur priment. Aucun bilan candidat n'est retourné pour ces états, ni pour absence de rattachement/choix, choix CoverView, référent indisponible ou confirmation à renouveler. L'identité d'un choix indisponible ou périmé n'est pas projetée dans ce nouveau contrat. L'état explique la reprise nécessaire sans rouvrir, attribuer ou solliciter le client.

## Critères et sources

**partner.referent-assessment.3** — Seuls les souhaits [actuellement confirmés pour le besoin](advice-preferences.md) sont utilisés. Le nouveau contrat retourne leurs trois valeurs et date, sans historique ni ancien sujet ; une confirmation invalidée retourne des valeurs nulles. Les [langues et cantons](professional-practice.md) viennent du résumé partageable existant. Comparateur serveur commun avec le bilan personnel : vide/manquant/portée modifiée = inconnu ; code absent d'une liste renseignée = écart déclaré ; code présent = correspondance déclarée. Téléphone/visio confirmés rendent le canton physique non applicable sans prouver un droit territorial.

**partner.referent-assessment.4** — Sans paramètre ou avec `version=1`, le mode reste inconnu, raison `shared_source_unavailable`, et le contrat initial est conservé. `version=2` compare les seuls [modes explicitement partagés](shared-modes.md), avec état/date et priorité aux souhaits actuels. Aucun dossier de [disponibilités](professional-availability.md) n'est lu, même pour déduire un booléen. Modes privés, plages et absences restent exclus ; publication/retrait et consentement sont séparés.

**partner.referent-assessment.5** — La compétence reprend seulement le statut, la portée partageable et les dates du [résumé documentaire existant](../README.md#justificatifs-professionnels-et-examen--relais-8a00), avec ses contrôles de source et de [périmètre professionnel](professional-scope.md). Aucun original/nom de fichier, déclaration, motif ou examinateur n'est projeté. Compétence de catégorie ne prouve pas expertise du besoin précis. Conventions/solution exacte, disponibilité réelle, capacité, conflits, expertise précise et qualité demeurent à vérifier. Aucun score, classement, certification, commission ou supériorité n'est produit.

## Cohérence, interface et effets

Lecture dans un instantané PostgreSQL repeatable read avec transaction_timestamp initial, gardes session/membre/Lead et verrous de profil canoniques. Un changement concurrent d'une ligne verrouillée donne `PARTNER_CONFLICT`409 puis relecture. Les sources sont celles de l'instant indiqué, pas une garantie future. La projection n'est pas insérée dans le détail partagé du Lead et ne copie pas le DTO personnel. Les résumés de continuité historiques restent compatibles ; le nouveau dialogue lit son propre endpoint.

Cache privé par utilisateur/session/Lead, gcTime0, aucune persistance navigateur. Relecture10s et bouton Actualiser ; erreur masque les données précédentes, y compris le titre renvoyé. Les sources sont dérivées de la réponse courante. Raisons textuelles, badges non décisionnels, détails remplaçants et primitives d'erreur/chargement du design system. La confirmation du référent conserve son parcours Wallet distinct.

Aucune écriture métier, événement, notification, horloge, tâche, rendez-vous, affectation ou consentement modifié. Audit Admin HTTP existant seulement. Aucun paquet, variable, fournisseur, job ou room nouveau. Le partage v2 utilise la migration0047 documentée dans son référentiel. Les originaux et sources restent dans leurs périmètres de rétention/export/effacement existants S-130/S-131 ; aucune nouvelle durée juridique. Dérogation RLS héritée conservée. Déploiement v2 :0047 puis API puis interfaces ; rollback en retirant route/entrées, sans transformation de données.0046 et0047 restent non appliquées à la base locale partagée ; aucun SQL ou snapshot de migration antérieur modifié.

## État réel

Implémentation et oracles au [ledger1cbd](../../../../../../roadmap/evidence/partner-core.md#relais-1cbd--adéquation-minimale-du-référent). Tests PostgreSQL isolés, deux revues statiques du même agent ; aucune indépendance revendiquée. V3 rempli/clavier/mobile non vérifié : aucun nouvel accès WorkOS depuis le blocagec902. Aucun callback historique retenté, session/grant/client réel fabriqué, runtime ou base partagée modifié. Le brief intégral, S-110 et S-042a demeurent ouverts.
