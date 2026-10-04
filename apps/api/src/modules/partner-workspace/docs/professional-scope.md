# Stabilité du périmètre professionnel

Propriétaire : partner-workspace. Décision déléguée du relais 5944, brief I.4/10.2–10.4/13/19–20. [Preuves et limites](../../../../../../roadmap/evidence/partner-core.md#relais-5944--stabilité-du-périmètre-professionnel).

## Parties déclarées et portée

La candidature canonique du membre reste la source de ses parties déclarées. `apply` conserve le membre et son identifiant d'organisation après un complément ou un rejet ; une nouvelle candidature ne crée pas une deuxième organisation ni un profil client. Les noms déclarés ne sont pas une vérification d'identité juridique. L'historique général de candidature ne contient pas toutes les anciennes parties : aucune reconstitution rétroactive n'est effectuée.

Une révision professionnelle monotone suit le nom déclaré du membre, le nom d'organisation déclaré, l'identifiant d'organisation et l'ensemble des catégories demandées. Toute modification de ces éléments rend les anciennes déclarations de compétence et de convention inapplicables au périmètre courant, même après un retour aux anciennes valeurs. Changer l'ensemble des catégories invalide conservativement tous les constats du membre, y compris pour une catégorie conservée. L'ordre et les répétitions de catégories ne changent pas cet ensemble. Une modification de coordonnées, langues, zones ou qualifications libres, ainsi qu'une décision d'habilitation, ne modifie pas cette révision : ces faits restent distincts d'un examen de la pièce et de sa déclaration figées.

Les déclarations enregistrent la révision professionnelle, les noms déclarés et l'organisation existante, sans copier un profil ni le fichier original. Les décisions restent append-only et rattachées à la même déclaration. Le dossier distingue périmètre actuel, modifié et inconnu. Les lignes antérieures sans révision ou sans parties enregistrées sont inconnues et ne peuvent pas produire un constat favorable courant ; les noms actuels ne sont jamais injectés comme noms historiques.

## Parcours et contrôles

Le membre relit les parties affichées, dépose une nouvelle déclaration pour le périmètre courant et la fait examiner par un autre Admin habilité avec MFA récent. Une nouvelle déclaration ne reprend aucune ancienne décision favorable ; le même original sûr peut être réemployé selon les règles documentaires existantes. Le téléchargement historique reste privé et conditionné à la sécurité de la source. Retrait et remplacement conservent les preuves.

La déclaration transmet la révision professionnelle affichée en plus de la révision du dossier. Le serveur les compare sous verrou avant tout dépôt. Une révision absente ou périmée impose une relecture et ne crée aucun fichier. Le périmètre figé conditionne également examen, upload, confirmation et retry ; un aller-retour ne rend pas les droits de reprise. Le rejeu idempotent conserve la commande initiale et reprojette l'état courant, sans refaire la déclaration sur de nouvelles parties. Un nouvel examen après changement exige une nouvelle déclaration.

Les formulaires conservent leur périmètre d'ouverture et leur contenu sur réessai ; une modification observée pendant l'édition invite à revenir au dossier. Les boutons de reprise utilisent la capacité serveur `canResume`. Historique et examen affichent les parties d'origine et la raison d'inapplicabilité. La candidature explique les effets d'une modification avant resoumission. Cache privé/session, relecture 10 s, masquage sur erreur et dialogues existants sont conservés.

La continuité consomme uniquement le résumé documentaire de compétence ; déclaration, fichier et noms historiques restent privés. Déclaration et membre courant sont lus dans un seul instantané PostgreSQL pour ce résumé. Un périmètre modifié/inconnu laisse la compétence parmi les critères manquants. Une convention ne prouve toujours aucune solution distribuable exacte. Aucun nouveau droit, score, attribution, commission, notification, room ou horloge de Lead n'est déduit.

## Migration et exploitation

Migration additive **0042** : révision du membre, révisions de déclaration nullables et noms figés de compétence. Le trigger de membre augmente la révision lorsque les parties ou catégories changent, y compris pour une écriture de l'ancienne API ; il refuse implicitement la remise à une ancienne révision en recalculant la valeur. Pas de backfill de preuve, ni suppression de déclaration/décision/original. Les contraintes autorisent NULL pour les lignes historiques et imposent une révision positive lorsqu'elle est connue. Le trigger est SQL versionné, absent du modèle déclaratif Drizzle ; conserver la migration lors d'une reconstruction.

Déployer migration, API et UI compatibles ensemble pour activer ce parcours. Les champs de réponse additifs ont des défauts prudents (périmètre inconnu, reprise interdite). Un ancien formulaire ne fournit pas la révision et doit être rechargé ; un rejeu d'une commande antérieure au changement de contrat peut également être refusé par son empreinte idempotente. Une ancienne API de lecture ignore ces protections : elle ne doit pas servir les dossiers professionnels après activation. Rollback applicatif : fermer ces parcours ou revenir à une version comprenant 0042, conserver colonnes/trigger/preuves, puis correctif en avant ; pas de down destructif. Aucun paquet, fournisseur, variable ou worker ajouté.

PII additionnelle : noms du membre et de l'organisation figés dans la déclaration de compétence, déjà présents dans la convention. Pas de PII supplémentaire dans les événements. Les règles privées de fichiers, rétention, export et effacement restent celles du dossier professionnel, avec S-130/S-131 ouverts.

## État réel

V0–V2 vérifiés sur le code final : types/lint/builds, migrations répétées, absence de delta de génération et PostgreSQL isolé. La régression de compétence a été reproduite avant correction. Les tests couvrent changements/aller-retour, concurrence, droits courants, reprise/rejeu, conservation et déclarations héritées inconnues. Deux revues du même agent, aucune revue indépendante ni preuve fournisseur revendiquée.

0042 appliquée localement sans reset. Base réelle : aucun membre Partner, Lead, offre ou justificatif professionnel. V3 des formulaires peuplés, clavier/mobile et stockage/scanner reste non vérifié : le fichier WorkOS indiqué par la configuration locale partagée est absent. Aucun runtime secondaire lancé, aucune permission ni preuve réelle créée. Le brief, S-110 et S-042a restent ouverts.
