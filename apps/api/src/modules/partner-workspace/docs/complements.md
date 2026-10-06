# Analyse incomplète et complément du client (C8e)

Décision C8-7 du [plan d'achèvement](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.13 : « demande de complément ou vérification humaine ». L'analyse elle-même est décrite dans [orientation et recommandation](orientation-recommendation.md).

## Avis « Analyse comparative à compléter »

- **Destinataire.** Il va au responsable courant, ou à CoverView sans responsable. Une réattribution le déplace, comme les autres avis d'action de la demande.
- **Réévaluation.** Le serveur relit l'analyse après chaque commande qui change ses entrées, et à chaque passage du worker de continuité pour une demande qui a des offres revues ou un avis ouvert. Une offre échue ou un original modifié ouvrent donc l'avis sans aucune commande ; une analyse qui conclut de nouveau le résout.
- **Lien.** L'avis ouvre l'onglet des offres.
- **Pas de tâche.** L'avis d'action tient lieu de tâche. Le plan C4b annonçait aussi une tâche « Compléter l'analyse », jamais créée : c'est corrigé ici, rien n'est ajouté.

## Ce qui manque, par origine

Le serveur calcule, sur les offres revues, ce que l'analyse ne peut pas encore établir :

| Origine       | Ce qui est montré                                                                       | Qui agit                                 |
| ------------- | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| Client        | contrat de référence absent, à reconfirmer (source changée ou disparue) ou confirmé     | le client, sur demande                   |
| Professionnel | offres dont la prime ou des valeurs restent à vérifier, revue du contrat actuel à faire | le professionnel, lui-même               |
| Compagnie     | prestations absentes d'une offre : une information à obtenir, jamais une exclusion      | le professionnel, auprès de la compagnie |

Les vérifications du professionnel restent humaines : le client ne complète que ce qui le concerne.

## Demande de complément au client

- **Qui demande.** Le responsable qui a accepté la demande, un contributeur avec droits de conseil, d'édition et de contact, ou le responsable de l'organisation du responsable. Ni le client, ni CoverView, ni un autre membre.
- **Contenu.** Un à trois éléments (contrat de référence, documents, information), un message de 10 à 2000 caractères, une échéance d'une heure à 30 jours.
  - Une seule demande à la fois par demande de conseil ; la suivante attend la clôture.
  - Le client reçoit l'avis Wallet `complement.requested`, action « Compléter ma demande ».
- **Suivi en attente, sur option explicite.** La demande pose l'attente habituelle de la demande jusqu'à l'échéance, avec son motif. Elle se lève comme toute attente : par une action du professionnel qui la lève (contact, rendez-vous, reprise du suivi), ou à l'échéance.
- **Réponse du client, une fois.**
  - Un texte, des documents de son espace, ou les deux (5 au plus). Chaque document est partagé tel quel : l'original reste dans l'espace et ne peut plus être supprimé.
  - Le contrat de référence se confirme par le parcours existant ; la demande indique alors la date de confirmation.
  - Le responsable courant reçoit l'avis `complement.answered`, action « Examiner le complément ».
- **Document partagé.** Servi au professionnel et au client tant que l'espace du client garde exactement cette version ; chaque consultation par un professionnel est journalisée (une fois par demi-heure).
- **Clôture par le professionnel.** « Complément traité » après une réponse ; « sans réponse » après l'échéance ; « retirée » à tout moment avant une réponse. Une note interne facultative ; le client voit l'issue, jamais la note. La clôture résout les avis de la demande.

## Données et garanties

- **Tables** (migration 0081) : `partner_complement_requests`, `partner_complement_answers`, `partner_complement_closures`.
  - La demande, sa réponse et sa clôture sont écrites une fois ; l'état en découle.
  - Des gardes en base imposent un sujet courant, une échéance future, une seule demande ouverte, la réponse du seul client avant clôture et l'issue cohérente avec la réponse et l'échéance.
- **Changement de client** de la demande : les demandes ouvertes sont invalidées et leurs avis résolus, comme les autres preuves qualité.
- **Événements** : `complement.requested.v1`, `complement.answered.v1`, `complement.closed.v1`, `complement.document_viewed.v1`.
- **API** : `GET|POST /partner/leads/:id/complements`, `POST /partner/leads/:id/complements/:requestId/close`, `GET /wallet/leads/:id/complements`, `GET /wallet/leads/:id/complement-candidates`, `POST /wallet/leads/:id/complements/:requestId/answer`, `GET /{partner|wallet}/leads/:id/complements/:requestId/documents/:documentId/source`.
- **Données personnelles.** La copie Wallet contient les demandes et leurs réponses, dans la catégorie « demandes » du registre, inchangé. Un effacement les conserve telles quelles, comme preuves protégées déclarées dans l'aperçu.

## Limites

- Aucun email : la demande arrive par l'avis Wallet.
- La demande ne relance pas le client automatiquement ; l'échéance dépassée est signalée au professionnel.
- La route de téléchargement n'est vérifiée qu'au niveau du dépôt : le banc HTTP désactive les documents.
