# Créneaux personnels proposés et réservation Wallet

Propriétaire des décisions déléguées BKG1–5 (I.12, II.5/8). [Plan et preuves](../../../../../../roadmap/plans/partner-booking-slots.plan.md). Une proposition de modalités n’est ni un matching ni une validation globale du conseil : capacité, expertise, conflits et distribution conservent leurs contrôles propres.

## BKG1 — Deux accords distincts

Le conseiller approuvé d’une organisation approuvée, dans sa catégorie et avant l’échéance de son habilitation, propose personnellement de un à cinq horaires exacts pour une demande ouverte liée à un propriétaire canonique. Il doit être responsable ayant accepté ou contributeur advice actif éditable et contactable. Le rôle Admin n’autorise aucune substitution ; le responsable d’organisation n’offre pas l’agenda d’un collègue.

Chaque option reprend la création personnelle et son contrôle de disponibilité déclarée courante, mode souhaité confirmé, absence de demande de changement d’interlocuteur et absence de chevauchement sur toute la préparation, les trajets et le rendez-vous. Le conseiller confirme explicitement les engagements extérieurs, sa capacité, la préparation/déplacements et sa volonté d’honorer l’un des créneaux si les conditions restent valables. Cela ne prétend pas que le client ait déjà accepté. Wallet demande ensuite au propriétaire actuel de confirmer l’option exacte : date, durée, mode, lieu et conseiller.

## BKG2 — Proposition, expiration et occupation

Modalités et attestations immuables, de une à cinq options aux dates de début distinctes, expiration explicitement choisie dans les sept jours et avant le début occupé de chaque option. Bornes techniques réversibles ; aucun tarif ou classement. Une proposition active par Lead, index unique en base. Aucune occupation ni première action utile à la proposition ; le conseiller peut la retirer explicitement. Une expiration autorise une nouvelle proposition, l’ancienne restant invalidée/historisée. Une proposition dont les sources ont changé doit être retirée/renouvelée, jamais éditée silencieusement.

Une seule réservation par proposition, exactement une option choisie. La publication ne garantit pas que l’option restera libre : la réservation recontrôle les sources et l’occupation courante. Deux clients sur deux Leads sont sérialisés sur le planning du même conseiller. Réponse incertaine : même contenu et même clé, projection réautorisée ; contenu différent sur même clé rejeté. Un autre choix après réservation ne crée rien.

## BKG3 — Autorisation et péremption

Acteur/session authentiques → membre/organisation → Lead → contributions/proposition → planning → profil canonique ; relecture acteur/session, propriétaire et horloge après attente. L’identifiant conseiller vient de la proposition immuable, jamais du client. Les helpers d’évaluation et de temps acceptent un conseiller explicite interne ; ils n’inventent ni session ni acteur professionnel.

Empreinte du Lead/révision/périmètre, propriétaire/sujet/révision canonique et habilitation ; empreinte de chaque contrôle de créneau (disponibilité/préférences/révisions). Toute modification de révision du Lead est conservativement périmante. Les triggers 0056 invalident définitivement une proposition ouverte lors d’un changement de mandat, d’attribution, de sujet, de cycle, de clôture, de contribution, d’habilitation ou d’organisation. Le retour aux valeurs anciennes ne rend pas l’accord réutilisable. Une collision temporaire rend seulement l’option momentanément indisponible ; les droits et consentements restent recontrôlés.

GET/POST `/partner/leads/:id/booking-proposals`, POST `…/:proposalId/withdraw` ; GET `/wallet/leads/:id/booking-proposals`, POST `…/:proposalId/reserve`. Corps stricts, clé idempotente sur écritures, protections CSRF/session/rate-limit existantes. Lecture personnelle Partner, propriétaire Wallet courant seulement. Historique borné aux vingt dernières propositions ; Wallet exclut les anciens sujets/propriétaires et ne reçoit que les modalités partagées, nom déclaré du conseiller, expiration, issue, option retenue et identifiant du rendez-vous. Aucune preuve, buffer, agenda privé ou autre Lead.

## BKG4 — Rendez-vous, cycle et preuves

La réservation réutilise la création d’engagement : rendez-vous, jalon planifié, première action utile si absente et occupation protégée. Toute prochaine action existante ou attente sur l’origine est conservée avec son échéance ; l’action de rendez-vous standard est créée seulement en l’absence de celles-ci. Tâches, autres demandes de même personne/catégorie, cycles associés, offres, attribution et économie ne changent pas. Pas d’association automatique ; les liaisons explicites acquises restent disponibles après création, de même que le report et l’annulation Wallet.

`partner_booking_proposals` conserve auteur, sujet/propriétaire, modalités/attestations, empreinte, expiration, date, retrait/invalidation ou reçu avec option et rendez-vous. La table de temps existante conserve les deux accords et sources du choix avec le conseiller réel ; l’audit conserve le véritable acteur Wallet. Tout est atomique, y compris événements, notifications et idempotence. Une annulation ultérieure ne réécrit pas le reçu de réservation.

Événements versionnés `appointment.slots_offered.v1` / `appointment.slots_withdrawn.v1` au client, `client.appointment_reserved.v1` au responsable et au conseiller distinct encore autorisé ; confirmation de rendez-vous existante au Wallet. Aucun job, room, fournisseur, email, variable ou dépendance. Preuve privée de temps sans Lead public. Données personnelles nouvelles : relations sujet/auteur/propriétaire et modalités de rendez-vous ; propriétaire fonctionnel du dossier courant et auteur de sa déclaration. Export/effacement/rétention : S-130/S-131 ouverts, aucune durée légale inventée, pas d’export générique de preuves privées.

## BKG5 — Interface, activation et limites

Partner → demande → Rendez-vous → Créneaux proposés ; ajout dans le dialogue de contrôle existant, retour à la liste des options, expiration et quatre attestations vides, publication/retrait. Wallet → demande → Mes rendez-vous → créneaux proposés → choix → accord vide → confirmation, puis détails/annulation existants. Dialogues remplaçants, cache privé session `gcTime:0`, rafraîchissement dix secondes, données masquées après erreur ; la première commande est conservée même si la consultation de la demande échoue. Les messages ne présentent pas l’évaluation déclarative comme une certification.

0056 est additive **hors catalogue normal**, dépendante du catalogue complet normal + pending0049–0055. Génération avec trois globs, seconde génération sans delta, deux migrations successives en PostgreSQL18 jetable. Aucun fichier entrant de migration modifié, aucune base partagée consultée/appliquée. Intégration explicite des migrations puis API puis UI avant activation ; retour arrière par retrait des entrées/écritures, conservation des preuves, pas de DROP ni résurrection. V0/V1/V2 au ledger ; V3 authentifié rempli/clavier/mobile non exécuté, aucune activation déclarée. Matching complet/multi-spécialistes et brief entier restent ouverts.
