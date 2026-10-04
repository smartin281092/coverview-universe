# Sources personnelles d’expertise pour un besoin

## Sens et parcours

Propriétaire : partner-workspace ; brief I.10.3/18/20. Fiche Lead → Mon adéquation → Mes preuves pour ce besoin. Cette consultation rapproche le besoin actuel des preuves déjà présentes dans le dossier personnel de compétence de sa catégorie : déclaration, parties déclarées, dernier examen motivé, couverture, portée et dates. Elle permet de vérifier les limites documentaires avant une appréciation humaine précise, sans recopier une déclaration dans un deuxième formulaire.

Aucune appréciation par besoin n’est enregistrée. Le résultat reste `human_review_required` ; preuve générale, expertise précise, habilitation et solution distribuable sont distinctes. Aucun score, classement, attribution, validation juridique ou contrôle restant levé. Une demande client de changement ouverte demeure visible. L’absence de preuve documentée ne signifie pas incapacité.

Le bouton ouvre le dossier personnel existant à la catégorie exacte, en remplaçant le dialogue. Consultation de l’original, historique, remplacement et retrait utilisent ses routes et ses autorisations propres. Aucune information client n’y est copiée. Retour aux preuves puis au bilan : chargement masquant les données antérieures jusqu’à la relecture. Cache utilisateur/session/Lead, gcTime0, relecture10s/manuelle, erreur masquante, aucun stockage navigateur. Navigation et clavier réels restent à observer en V3.

## Sources et instant de lecture

GET `/partner/leads/:id/expertise-evidence`, contrat et client dédiés version1. Besoin exact : titre, catégorie, objet, contexte et révision de portée. Seul le dernier enregistrement du dossier personnel est projeté, jamais un ancien favorable après retrait, expiration ou remplacement. Les règles propriétaires de [compétence](../README.md#justificatifs-professionnels-et-examen--relais-8a00) et de [portée professionnelle](professional-scope.md) restent appliquées par leurs lecteurs existants.

L’état de source distingue manquant, disponible, modifié depuis l’examen, indisponible et consultation documentaire désactivée. Révisions actuelle et examinée affichées séparément ; une source disponible ne prouve aucune adéquation. L’état documentaire reste distinct de la portée professionnelle, de l’expiration et de la décision. Aucun raisonnement sémantique automatisé entre les textes.

Une transaction repeatable read fournit besoin, mandat, profil et preuve au même instant daté `assessedAt`. Le résumé évalue l’expiration à cet instant, y compris si un verrou retarde la réponse. La relecture révèle les changements postérieurs ; une modification concurrente d’une ligne verrouillée peut produire409 et impose une relecture. Timeout du pool existant. Le lecteur de compétence conserve son instant par défaut pour les autres consommateurs.

## Audience et minimisation

Même garde que le [bilan personnel](advisor-assessment.md) : responsable ou contributeur de conseil actuellement autorisé, session/membre/organisation/activité/catégorie et Lead actif. Manager seul, voisin, Wallet et supervision Admin d’autrui exclus. Admin lui-même affecté avec permission/MFA actuels seulement ; son exception de catégorie ne crée pas de preuve professionnelle. Aucun advisorId accepté, même en querystring. Un contributeur voit ses propres preuves, jamais celles du responsable.

La projection privée contient le nom de fichier, la déclaration et le motif/auteur d’examen nécessaires à la comparaison. Elle retire documentId et canDownload ; aucun checksum, clé de stockage, URL ou contenu binaire. Le téléchargement existant réautorise l’original dans son audience propre. Aucun ajout au détail partagé du Lead, au bilan du référent ou à Wallet. Les contrats v1/v2 du bilan et leurs six contrôles restent inchangés.

## Exploitation et limites

Lecture sans persistance métier, aucune migration nouvelle. Aucun changement de responsabilité, horloge, rendez-vous, tâche, notification, préférence, capacité ou conflit. Aucun événement/job/room/permission/paquet/fournisseur/variable ajouté. Audit d’accès Admin HTTP existant conservé. RLS et rétention/export/effacement des sources restent hérités ; S-130/S-131 ouverts, aucune durée juridique inventée.

La route ne dépend pas de0049/0050, vérifié avec leurs tables absentes. Le point d’entrée UI passe toutefois par le bilan v2 et requiert son schéma existant0048 ; cette tranche ne l’active pas.0046–0048 restent non appliquées à la base partagée ;0049/0050 hors catalogue et `db:migrate` normal ne les applique pas. Déployer API puis UI sur un schéma compatible ; rollback applicatif retire la consultation et conserve toutes les preuves. Aucun déploiement ni accès à la base partagée effectué.

[Preuves5ce9](../../../../../../roadmap/evidence/partner-core.md#relais-5ce9--sources-personnelles-dexpertise-par-besoin) :82tests distincts validés en campagnes séparées, dont7nouveaux, PostgreSQL18 isolé ; types/lint/builds/frontières/Knip ciblé. Deux revues du même agent sans indépendance. V3 rempli/clavier/mobile non effectué sans nouvel accès WorkOS. Appréciation précise persistée, adéquation complète et tous tracks I–III restent ouverts.
