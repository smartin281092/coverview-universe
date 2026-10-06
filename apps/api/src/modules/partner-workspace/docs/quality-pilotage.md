# Qualité, communications et pilotage — lot 3

Propriétaire des décisions QP1–6 du [plan et journal](../../../../../../roadmap/plans/partner-quality-pilotage.plan.md). [Brief I.16–21, II.11–16, III.18–19](../../../../../../references/coverview-partner-2026-10-02.md). Parcours implémentés et vérifiés en isolation ; activation et recette authentifiée ouvertes. Les preuves et écarts vivent dans le [ledger](../../../../../../roadmap/evidence/partner-core.md#lot-34--suivi-qualite-et-pilotage-aa64).

## Enquête et suites de qualité

Une transition effective vers `completed`, même sans vente, crée une enquête unique par Lead et une notification Wallet persistée. Le sujet et son propriétaire canonique d’origine sont figés. Aucun backfill d’anciens dossiers. Sans propriétaire, une notification de dépendance CoverView remplace l’invitation ; aucun client ni envoi n’est inventé. Cette dépendance reste à reprendre lors de l’activation, sans invitation tardive automatique.

Seul le propriétaire d’origine encore canonique répond. Une réponse est immuable : 5 étoiles → positifs multiples, commentaire facultatif puis destination Google configurée ; 1–4 → améliorations, commentaire et rappel facultatif sans Google. Réception réelle avant l’invitation Google ; fin « Merci pour votre retour ! ». Aucune URL initiale. Admin/MFA renseigne une URL HTTPS Google permise avec référence de source et revue explicite. « Non configuré » reste distinct d’une invitation envoyée.

Une réponse ≤4 crée atomiquement un dossier de vérification, ou de rappel si demandé. Wallet peut aussi demander un rappel ou déposer une réclamation ; le professionnel peut consigner un signalement sur un Lead qu’il peut encore consulter. Dossier distinct de l’étape commerciale : responsabilité initiale de la file CoverView, priorité, échéance interne de triage à 24 h calendaires, puis auteur Admin identifié, prochaine action, date et historique. Ce défaut est opérationnel, pas un délai légal ni une promesse d’appel.

Prise en charge, suivi, demande d’explication, vérification, clôture ou réouverture sont révisionnés. Une clôture exige résultat vérifié humainement, motif et aucune action restante. Une réponse du client ou du déclarant ne clôt rien. La clôture commerciale ne résout pas les dossiers qualité. Les actions partagées produisent des notifications minimales ; demande d’explication et rappel ne prétendent pas envoyer ou effectuer un contact externe.

Admin consulte le dossier et ses notes internes. Wallet ne lit que les dossiers partagés avec lui et les actions explicitement partagées. Le professionnel ne lit que ses propres signalements encore autorisés et leurs actions partagées au déclarant. Un dossier interne ne devient pas public par une case cochée sur une action. Les métadonnées privées de suite/échéance/intervenant sont masquées. Après transfert du sujet, les dossiers invalidés restent traitables par Admin, sans partage vers le nouveau propriétaire.

## Déclarations du client et vérification (C8d)

Décision C8-6 du [plan d'achèvement](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.17.2 et I.19.2.

- **Déclarations du client** `partner_client_confirmations` (migration 0080).
  - Canaux : questions factuelles de l'enquête unique, sans sollicitation de plus ; déclaration depuis Wallet ; appel ou email consigné par CoverView (Admin).
  - Faits : contact, rendez-vous, documents, contrat ; oui, non ou ne sait pas. Compagnie et date de signature facultatives, seulement pour un contrat déclaré conclu.
  - Le serveur relève l'état déclaré de la demande au même instant. La ligne est immuable ; seule une invalidation de contexte la masque (transfert du sujet, effacement).
  - Bornes : un formulaire Wallet resté à « ne sait pas » n'envoie rien ; trois déclarations Wallet par demande et par 24 h (`PARTNER_RATE_LIMITED`). Un contact qualité porte une date entre la création de la demande et maintenant, un résumé et une confirmation de fidélité.
  - L'enquête stocke la note et les motifs à part ; les faits deviennent une déclaration.
- **État déclaré** comparé : premier contact utile ou échange « atteint » ; rendez-vous tenu ; offre publiée ; résultat contrat, étape de signature à contrat émis, ou police finale active.
- **Écarts** calculés par le serveur : contrat signalé non déclaré (priorité haute), contrat déclaré non confirmé, contact, rendez-vous ou documents non confirmés. « Ne sait pas » n'en crée aucun.
- **Vérification.** Un écart ouvre un cas `verification` interne à CoverView, quel que soit le canal. Une seule est ouverte par demande ; les déclarations suivantes la rejoignent.
  - Jamais une réclamation : aucun effet sur les évaluations, aucune écriture financière.
  - Une déclaration ne vaut pas preuve d'encaissement d'une commission.
- **Qui lit quoi.**
  - Le client relit ses propres déclarations (enquête, Wallet) dans « Qualité et suivi ». Jamais l'état déclaré, les écarts, ni l'existence d'une vérification.
  - CoverView lit les déclarations, l'état déclaré et les écarts dans le cas. La file filtre les « contrats potentiellement non déclarés » et compte les vérifications ouvertes.
  - Le professionnel à qui un rapprochement est demandé lit le cas, les faits et l'état déclaré, jamais le commentaire libre du client.
- **Rapprochement.** L'action Admin `request_reconciliation` s'adresse au responsable courant de la demande, et à lui seul (`PARTNER_INVALID_ASSIGNEE`), avec l'avis `quality.reconciliation`.
  - Sa réponse reste entre lui et CoverView, jamais partagée au client. Elle résout l'avis.
- **Clôture.** Une vérification liée à une déclaration se clôt avec une issue : confirmée, infondée ou non concluante (garde SQL). La clôture résout les avis de rapprochement ; aucune suite automatique.
- **API.** `GET|POST /wallet/leads/:id/confirmations` ; `GET /partner/leads/:id/confirmations` et `POST /partner/leads/:id/quality-contacts` (Admin) ; filtre `reason=undeclared_contract` de la file Admin. Événement `quality.confirmation_recorded.v1`.
- **Données.** L'export Wallet contient les déclarations du client (`confirmations`). Les contacts consignés par CoverView n'y figurent qu'avec un accès complet accordé (`internal.qualityContacts`). Registre v3. Conservation : catégorie retenue « enquêtes, réclamations et déclarations » jusqu'à une politique validée.

## Communications et accord préalable

Les préférences de service sont confirmées et versionnées par le propriétaire Wallet ; aucune assimilation au marketing. Absence de choix = inconnu. Wallet demeure le canal de stockage interne. Le compte rendu d’un échange manuel exige canal, date réelle, résultat, résumé, source consultée, prochaine action et échéance. Contact atteint/reçu peut faire avancer une étape initiale vers `contacted` ; aucun contrat ni signature n’en est déduit.

Le conseiller affecté ou co-conseiller avec `can_edit` ET `can_contact` et mandat courant demande un accord préalable pour un enregistrement externe. La demande porte Lead, sujet, propriétaire, conseiller/révision professionnelle, canal, finalités exactes, notice sourcée, validité et conservation déclarée. Le propriétaire accepte, refuse ou retire. Refus/retrait n’empêche pas le conseil manuel. Aucune durée légale, source, consentement ou captation réelle n’est préremplie par le système.

Seule une transcription humaine provenant d’une source effectivement relue peut être consignée ici. La date du contact est postérieure à l’accord et antérieure à sa fin. Les attestations concernent tous les participants et la fidélité de la source. Version initiale puis corrections motivées immuables, date de contact conservée, passages avec intervenant et repère ; historique paginé. Une suite humaine cite exactement un passage de la dernière version et crée une tâche réelle du Lead, sans recopier le passage sensible dans la description de tâche. Les consultations de texte sont journalisées.

Retrait, expiration ou contexte modifié masquent immédiatement transcriptions et tâches citées dans ce dossier. Sujet/propriétaire, périmètre du Lead, conseiller/responsabilité, mandat, droits de contact, statut/organisation/révision professionnelle sont revérifiés. Les changements de profil invalident aussi l’accord ; un retour aux anciennes valeurs ne le ressuscite pas. Les tâches déjà créées restent des tâches opérationnelles sans texte sensible copié. Aucun fournisseur de téléphonie ou transcription automatique, aucun email/SMS et aucune sanction automatique ajoutés.

## Statistiques et objectifs

`/statistics` applique les droits opérationnels actuels avant toute agrégation. Un droit de progression seul ne donne pas les sources de conseil. Populations : soi, individu autorisé, équipe explicite de membres d’une organisation, organisation ou réseau Admin/MFA. Les managers sont limités à leur organisation. Filtres période semi-ouverte, catégorie, source, produit, compagnie et intervenants restent soumis aux mêmes droits.

Chaque indicateur précise unité, définition, grain, population et dénominateur. Les flux datés, cohortes et états courants sont séparés. Comparaison à la période précédente de même durée ; aucun état courant n’est présenté comme un historique reconstitué. Déclinaisons mois/mois précédent/trimestre/année/personnalisée en Europe/Zurich. Les sources paginées utilisent les mêmes lignes que les totaux ; une moyenne sans observation reste inconnue, un décompte réellement vide vaut zéro. Satisfaction consultable en détail uniquement par Admin ; aucune note qualité déduite du volume ou de la conversion.

Ouverture d’offre = événement `client.view`, sélection ≠ signature, police partagée ≠ signature. Signatures réelles, taux correspondants et commissions signées restent indisponibles faute de preuve canonique. Comparaisons de primes et polices réutilisent les projections documentaires existantes ; source retirée ou changée = observation non comparable, couverture connue affichée. Les alternatives d’offre ne deviennent pas plusieurs contrats.

Les agrégats économiques rejouent le registre canonique aux bornes d’inscription des écritures, contrepassations comprises. Estimé/pondéré/confirmé/encaissé/disponible/réservé/versé/repris/recouvré/contesté/dû sont distincts. Allocation et centimes résiduels identiques au dossier économique. Parts personnelles seulement pour un professionnel ; être manager ne donne aucune finance d’équipe. Admin peut consulter les agrégats autorisés et la part CoverView. La visibilité statistique exige en plus l’accès opérationnel courant au Lead ; les droits financiers conservés après retrait se consultent dans Rémunérations, pas par ces statistiques.

Bornes explicites : 10 000 Leads et contributions, 500 dossiers économiques et 10 000 écritures au total, 1 000 écritures par dossier, 100 sources documentaires par période. Dépassement = refus ou état de volume explicite, jamais somme partielle. Décompositions top20 et suggestions top100 signalées comme tronquées. Ces bornes doivent évoluer avant d’être atteintes.

`/goals` conserve cible, sens minimum/maximum, indicateur, population, filtres, période, motif, auteur et versions. Chacun crée ses objectifs personnels ; le responsable ceux de son équipe/organisation ; Admin ceux d’autrui ou du réseau. Un objectif individuel imposé par Admin est lisible par le titulaire mais modifiable seulement par Admin. Population immuable après création, autres changements par nouvelle version. Réalisé, écart et progression réutilisent les mêmes mesures ; source inconnue = progression inconnue. Synthèses sur les dashboards Partner et supervision Admin.

## API, données et exploitation

Contrats Zod `partner-quality`, `partner-communications`, `partner-pilotage` ; méthodes du SDK Partner existant. Routes privées qualité/enquêtes/communications sous `/partner`, `/wallet` et `/admin/partner`, statistiques/objectifs sous `/partner/pilotage` et `/partner/goals`. Auth/session, origine/CSRF, Admin/MFA, transactions, révisions, idempotence et relecture courante réutilisées. Aucun nouveau rôle, secret, paquet, fournisseur, room ou worker.

Migration additive **0059**, 14 tables, **hors catalogue normal**. Catalogue temporaire normal + tous pending0049–0058, trois globs Drizzle, seconde génération sans delta ; guards SQL manuels après génération. Double migration PostgreSQL18 jetable. Ne pas régénérer en écrasant ces guards. Les catalogues précédents et bases partagées n’ont pas été modifiés. Déployer/activer seulement après préparation explicite du catalogue complet, sauvegarde et validation d’environnement ; aucun rollback par suppression des preuves.

| Catégorie privée pour S-130/S-131 | Propriétaire et données | Export/rétention à activer |
| --- | --- | --- |
| Enquêtes/réponses | Sujet canonique, propriétaire initial, note/motifs/commentaire/dates | Export du sujet, masquage après transfert ; conservation/effacement à valider |
| Dossiers/actions qualité | Sujet et déclarant, responsables Admin, notes/audiences/suites | Export selon audience, notes privées exclues des exports client ; preuve de résolution conservée |
| Préférences/comptes rendus | Sujet/propriétaire, auteur, canaux/date/source/résumé | Portée du propriétaire, invalidation sans restauration ; durées à établir |
| Accords/transcriptions/actions/consultations | Sujet, propriétaire, conseiller, finalités, source/passages/versions/lecteurs | Masquage à échéance/retrait effectif ; purge physique, droits de tiers et conservation probatoire encore à raccorder |
| Objectifs/versions | Créateur, personnes/organisation ciblées, cible/filtre/motif | Export de périmètre autorisé, pas des sources financières d’autrui ; archivage logique versionné |
| Configuration qualité | Admin, URL Google, source/date de revue | Configuration administrative avec histoire ; aucune donnée de notation publiée vers Google |

L’immutabilité protège l’audit applicatif, elle ne certifie pas la conformité juridique ni l’effacement. RLS, exports, purge, durée juridiquement validée et activation restent des travaux explicites de S-130/S-131 et lot4. Aucun consentement, transcription, client ou accord réel n’a été créé pour les tests.
