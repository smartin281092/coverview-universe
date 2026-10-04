CoverView Partner — Brief fonctionnel intégral

Version consolidée — 2 octobre 2026

Ce document réunit le brief général corrigé, les approfondissements du modèle Lead et du suivi client, ainsi que la gestion des offres et leur affichage dans Wallet. Les trois parties forment un seul périmètre de développement : leurs prescriptions sont complémentaires.

Le Lead est l’unité opérationnelle de travail ; le Client est l’unité de relation ; les offres et contrats sont partagés avec Wallet selon leurs états et les droits de chaque utilisateur.

Les exemples de personnes, montants, offres et objectifs sont illustratifs. Ils ne constituent ni des données clients réelles ni des offres de compagnies vérifiées.

PARTIE I — BRIEF GÉNÉRAL CORRIGÉ

1. Mission et vision du produit

Développer CoverView Partner, la plateforme B2B de collaboration, d’apport d’affaires et de suivi des demandes clients de CoverView.

La plateforme permet aux partenaires de transmettre des leads, de recevoir des demandes, de collaborer avec d’autres conseillers, de suivre l’avancement des affaires et de connaître leurs droits à rémunération. Les clients, leurs demandes, leurs offres et leurs contrats restent reliés à leur espace CoverView Wallet, dans le respect des autorisations et des périmètres d’intervention.

Partner ne doit pas être conçu comme un simple tableau de contacts ou une marketplace déconnectée du suivi. Il doit organiser une chaîne complète :

Besoin client → qualification → recommandation → attribution → rendez-vous → conseil → résultat documenté → rémunération → suivi dans Wallet.

CoverView assure la coordination et le contrôle de cette chaîne. Lorsqu’un partenaire ne peut plus assurer sa mission ou ne respecte pas ses engagements de suivi, une solution de remplacement doit être recherchée sans perdre l’historique du dossier.

Partner est également l’outil quotidien de suivi client, de tâches et de progression commerciale de CoverView et de ses conseillers. Chaque carte du pipeline représente un Lead, et non un client. Un même client peut avoir plusieurs Leads indépendants, notamment par contrat, demande de contrat, demande d’offre ou besoin nécessitant un suivi.

Promesse à matérialiser

> Chaque client bénéficie d’un interlocuteur adapté à sa demande, d’un suivi traçable, d’une comparaison compréhensible des solutions et d’un dispositif de recours lorsqu’il n’est pas correctement accompagné.

Le label CoverView représente cet engagement de service et de contrôle qualité. Il ne doit pas être présenté comme une certification indépendante.

L’ambition de proposer « le meilleur partenaire et la meilleure solution » doit se traduire par des critères vérifiables : adéquation au besoin, compétences, disponibilité, qualité du suivi, solutions réellement accessibles et transparence des comparaisons. L’interface ne doit pas affirmer une supériorité absolue lorsque le marché analysé ou les informations disponibles ne permettent pas de la démontrer.

2. Périmètre des trois applications

|Application|Responsabilité fonctionnelle                                                                                                                                                                                                                         |
|-----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Partner**|Gestion des leads et demandes, pipeline, Kanban, tâches, collaboration, marketplace, rendez-vous, documents, offres, suivi des affaires, conditions commerciales, rémunérations, statistiques et objectifs.                                          |
|**Wallet** |Espace du client : demandes, interlocuteurs, rendez-vous, informations partagées, offres, comparaisons, choix, validations, signatures, contrats, audits, retours qualité et préférences de communication.                                           |
|**Admin**  |Validation et supervision des partenaires, habilitations, règles d’attribution, surveillance du suivi, contrôle qualité, conditions économiques, rapprochement des commissions, traitement des litiges, statistiques globales et objectifs du réseau.|

Une même demande doit présenter un état cohérent dans les trois applications, sans exposer les mêmes informations à tous les utilisateurs.

Les informations et fonctions déjà présentes dans l’écosystème CoverView doivent être réutilisées et complétées, sans créer un deuxième dossier client indépendant.

Les offres insérées dans un Lead et destinées à être présentées au client alimentent son onglet Offres dans Wallet. Elles y deviennent consultables, comparables, sélectionnables et, lorsque le parcours le permet, validables et signables.

3. Acteurs, responsabilités et notions métier

3.1. Types d’utilisateurs

|Acteur                                       |Capacités principales                                                                                                                                                                                                                                                                                  |
|---------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Apporteur / fournisseur de leads**         |Transmettre des demandes, suivre leur progression, compléter les informations autorisées et consulter sa rémunération.                                                                                                                                                                                 |
|**Conseiller**                               |Recevoir, qualifier et traiter les demandes qui lui sont attribuées ; proposer des solutions ; organiser les rendez-vous ; documenter le conseil ; transmettre une demande ou solliciter un spécialiste. Consulter les opportunités publiées dans la marketplace dans la limite de leur fiche publique.|
|**Responsable d’une organisation partenaire**|Superviser les utilisateurs, demandes, affectations et conditions commerciales de son organisation, uniquement selon une habilitation de responsable explicitement accordée. Cette fonction ne donne pas aux conseillers ordinaires un accès général aux Leads de l’organisation.                      |
|**Entreprise génératrice de leads**          |Déposer des demandes et les proposer selon un modèle de rémunération autorisé : pourcentage au succès ou prix fixe.                                                                                                                                                                                    |
|**Équipe CoverView**                         |Coordonner le réseau, qualifier les demandes, contrôler le suivi, traiter les alertes et assurer les reprises de dossier selon les droits accordés.                                                                                                                                                    |
|**Administrateur CoverView**                 |Voir tous les Leads, clients, offres et contrats du réseau ; valider ou suspendre les accès ; régler les politiques ; superviser les données économiques ; suivre les statistiques et objectifs ; arbitrer les litiges.                                                                                |
|**Client Wallet**                            |Exprimer ses besoins, choisir ses préférences, prendre rendez-vous, consulter les éléments partagés, comparer les offres, sélectionner et signer les propositions selon le parcours et demander un changement d’interlocuteur.                                                                         |

Une personne ou organisation peut cumuler plusieurs rôles, mais ses droits doivent rester explicites.

L’inscription comme fournisseur de leads ne doit pas conférer automatiquement le droit de conseiller ou de proposer des contrats. Les vérifications doivent correspondre aux activités réellement exercées et au statut de l’intervenant. La FINMA distingue notamment la simple mise à disposition d’informations de l’activité de conseil ou de proposition de contrats, y compris par voie électronique. [R1]

3.2. Distinguer le client de ses Leads et demandes

Un client n’est pas un Lead.

Le client est une personne ou une organisation disposant d’un dossier Wallet. Un Lead représente une demande commerciale ou de conseil précise : demande de contrat, demande d’offre, contrat à comparer ou à remplacer, besoin identifié, renouvellement, modification ou demande nécessitant un suivi jusqu’à résolution.

Un même client peut avoir plusieurs Leads simultanés ou successifs, plusieurs contrats et plusieurs conseillers référents selon les catégories. Chaque Lead possède son propre cycle, son responsable, ses tâches, ses rendez-vous, ses offres et son résultat.

Distinguer également :

|Notion                               |Définition                                                              |
|-------------------------------------|------------------------------------------------------------------------|
|**Apporteur initial**                |Acteur à l’origine du Lead.                                             |
|**Conseiller référent par catégorie**|Interlocuteur habituel du client pour un domaine donné.                 |
|**Responsable du Lead**              |Personne actuellement chargée de faire progresser ce Lead.              |
|**Contributeur**                     |Intervenant associé explicitement à une partie de la mission.           |
|**Mandat**                           |Cadre définissant les pouvoirs et responsabilités confiés par le client.|
|**Droit économique**                 |Droit à rémunération sur une affaire ou un événement défini.            |

L’attribution d’un Lead ne transfère pas automatiquement tous les contrats, tous les mandats, tous les autres Leads ou toute la relation commerciale du client.

La relation fonctionnelle est la suivante : Client → 0..N Leads → 0..N offres par Lead → 0..N contrats → Wallet.

3.3. Modes de collaboration

Prévoir trois modes : apport ponctuel, co-conseil avec maintien du référent, et transfert durable du suivi.

Chaque mode précise les responsabilités, les accès, les communications autorisées et la répartition de rémunération. Le client conserve la possibilité de demander un autre interlocuteur.

En cas de co-conseil, chaque intervenant doit être explicitement affecté au Lead et à son périmètre. L’appartenance à une organisation ou la connaissance du client ne suffit pas à ouvrir l’ensemble de ses dossiers.

4. Inscription, validation et gestion des accès

Toute nouvelle inscription à Partner doit passer par une validation CoverView avant l’accès aux fonctions opérationnelles.

Le parcours recueille l’identité, l’organisation, le rôle demandé, les coordonnées, les domaines d’intervention, les langues, les zones géographiques et les justificatifs applicables.

Prévoir les états suivants :

Inscription commencée → dossier soumis → complément demandé → validé / refusé → éventuellement suspendu ou fermé.

Avant validation, l’utilisateur accède uniquement à son dossier d’inscription, aux demandes de complément et aux informations nécessaires à sa candidature. Il ne peut pas parcourir la marketplace ni consulter des clients.

Depuis Admin, CoverView doit pouvoir valider une organisation et ses utilisateurs séparément, restreindre certaines activités, demander des documents, fixer une date de réexamen, suspendre un utilisateur ou bloquer une organisation entière.

Toute décision doit comporter un auteur, une date, un motif et, lorsque pertinent, une date de révision.

La suspension doit déclencher un traitement des Leads actifs, et pas seulement empêcher la connexion. Elle ne doit ni effacer les preuves, ni supprimer arbitrairement les droits économiques acquis.

L’administrateur CoverView dispose de la vision globale. Un conseiller ne peut pas parcourir librement les Leads de CoverView : il accède à ceux qui lui sont attribués et aux fiches des opportunités rendues publiques dans la marketplace. Ses éventuels droits d’apporteur restent limités au suivi prévu par son accord.

5. Navigation et organisation des écrans Partner

L’interface doit adapter sa navigation et son contenu au rôle de l’utilisateur.

|Espace                      |Contenu attendu                                                                                                                                      |
|----------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
|**Accueil**                 |Actions prioritaires, Leads à accepter, retards, rendez-vous, alertes, résumé économique et progression des objectifs.                               |
|**Leads et demandes**       |Vues Kanban et liste ; séparation entre Leads apportés, reçus, attribués et suivis en collaboration. Une carte correspond à un Lead, pas à un client.|
|**Clients**                 |Dossiers accessibles, référents par catégorie et Leads associés dans le périmètre de visibilité de l’utilisateur.                                    |
|**Marketplace**             |Leads disponibles, publications de l’utilisateur, candidatures, réservations et transactions.                                                        |
|**Agenda**                  |Rendez-vous, disponibilités, absences et capacité d’accueil.                                                                                         |
|**Tâches**                  |Actions du jour, rappels, tâches à venir, terminées et en retard, avec accès direct aux Leads concernés.                                             |
|**Rémunérations**           |Prévisions, montants confirmés, encaissements, réserves, versements, reprises et justificatifs.                                                      |
|**Conditions commerciales** |Accords de réception et d’apport, règles de publication et conditions applicables.                                                                   |
|**Statistiques**            |Activité, conversion, pipeline, économie, qualité et comparaison des périodes selon les droits.                                                      |
|**Objectifs**               |Cibles individuelles, d’équipe, de partenaire et globales ; progression, réalisé, écart et historique.                                               |
|**Qualité et notifications**|Retours clients, actions correctives, événements importants et demandes CoverView.                                                                   |
|**Profil et organisation**  |Compétences, présentation, langues, disponibilités, équipe et justificatifs.                                                                         |

L’accueil doit mettre en avant ce qui nécessite une action, plutôt qu’accumuler des indicateurs sans suite possible.

6. Création d’un Lead et rattachement à Wallet

6.1. Création guidée

Permettre de créer un Lead depuis Partner, depuis Wallet et depuis les autres parcours CoverView autorisés.

Le formulaire doit être progressif et adapté au besoin. Les informations déjà connues ne doivent pas être redemandées inutilement.

Recueillir notamment :

|Ensemble                    |Informations                                                                                                    |
|----------------------------|----------------------------------------------------------------------------------------------------------------|
|**Identification**          |Nom, prénom ou organisation, email, téléphone si disponible, langue.                                            |
|**Besoin**                  |Catégorie, sous-catégorie, contrat ou objet concerné, objectif, situation actuelle, échéance et degré d’urgence.|
|**Préférences**             |Téléphone, visio, bureau ou domicile ; disponibilités ; zone de déplacement ; conseiller souhaité.              |
|**Qualification**           |Informations nécessaires à une première orientation et à une éventuelle estimation économique.                  |
|**Historique**              |Démarches déjà effectuées, intervenants précédents, offres existantes et raison du transfert.                   |
|**Origine et autorisations**|Source du contact, apporteur, date, information du client et autorisation de transmission selon le parcours.    |
|**Documents**               |Contrats, offres et pièces utiles, avec visibilité définie.                                                     |

Permettre un brouillon incomplet. En revanche, une publication ou une attribution doit exiger les informations minimales correspondant au type de Lead.

6.2. Compte Wallet automatique

À partir de l’email, rechercher un rattachement possible à un dossier existant. Si aucun dossier ne correspond, préparer automatiquement un espace Wallet à activer, avec invitation du client selon le parcours autorisé.

La création de cet espace ne vaut ni authentification, ni acceptation d’un mandat, ni autorisation marketing.

La connaissance de l’email ne doit jamais suffire à consulter un Wallet existant. Le rattachement et l’ouverture des accès nécessitent les vérifications et autorisations prévues.

Ne pas révéler à un apporteur non autorisé qu’une adresse correspond déjà à un client CoverView. Prévoir le traitement des emails erronés, adresses partagées, doublons et changements de coordonnées. Une adresse commune à un ménage ne justifie pas de fusionner automatiquement ses membres.

Le parcours doit informer le client sur les finalités et les destinataires de ses données, y compris lorsque celles-ci ont été fournies par un tiers. Le PFPDT rappelle que le devoir d’information s’applique également aux collectes indirectes. [R2]

6.3. Leads multiples et doublons

Détecter les Leads potentiellement identiques, sans bloquer un nouveau Lead légitime d’un client existant.

Lorsqu’un client exprime plusieurs besoins, permettre plusieurs Leads indépendants, éventuellement regroupés par une demande principale. Leur traitement, leur clôture et leur rémunération peuvent être distincts.

Deux véhicules différents, deux contrats différents ou deux demandes d’offre distinctes peuvent donc produire deux Leads pour le même client, même dans la même catégorie.

Une fusion doit préserver l’origine, les contributions, les justificatifs et les éventuelles contestations d’attribution.

7. Pipeline, Kanban et cartes de Leads

Proposer une vue Kanban et une vue liste partageant les mêmes filtres et données.

Prévoir des filtres par catégorie, conseiller, apporteur, organisation, statut, urgence, prochaine échéance, ancienneté, origine, modèle économique, état financier et présence d’une alerte.

Permettre d’enregistrer des vues personnelles ou d’équipe. Les vues et les filtres ne doivent jamais élargir les permissions de l’utilisateur.

Le Kanban par défaut du conseiller est Mes Leads. L’administrateur peut consulter le pipeline global, tous les conseillers, tous les partenaires et l’ensemble des catégories.

Contenu d’une carte

Une carte représente un Lead et doit afficher les informations nécessaires pour décider de la prochaine action : client ou identifiant autorisé, besoin, produit ou contrat concerné, statut, responsable, apporteur si pertinent, prochaine étape, échéance, prochain rendez-vous, dernier contact utile, tâches ouvertes et alertes.

La valeur économique affichée dépend du rôle : part potentielle de l’utilisateur, montant confirmé ou somme disponible. Elle ne doit pas laisser croire qu’une estimation est déjà acquise.

Les détails restent dans la fiche du dossier. Ne pas surcharger la carte avec toutes les notes, documents et communications.

Le déplacement d’une carte doit déclencher les contrôles correspondant au nouveau statut. Un Lead ne peut pas être marqué comme signé, conclu ou perdu sans les informations nécessaires.

Un même client peut apparaître plusieurs fois dans le Kanban, avec des statuts différents pour chacun de ses Leads.

8. Fiche détaillée d’un Lead

La fiche doit comporter un en-tête synthétique permanent : client, besoin, statut, responsable, apporteur, priorité, valeur potentielle, prochaine action, échéance et éventuelle alerte.

Les actions disponibles dépendent du rôle et de l’état du dossier : accepter, appeler, envoyer un email ou un message, programmer, ajouter une tâche, demander un document, créer ou ajouter une offre, transmettre, publier, clôturer ou signaler un problème.

Organisation par onglets

|Onglet                       |Contenu                                                                                                            |
|-----------------------------|-------------------------------------------------------------------------------------------------------------------|
|**Synthèse / Vue d’ensemble**|Besoin, contexte, informations importantes, complétude, recommandation initiale, progression et prochaines étapes. |
|**Client et besoins**        |Données utiles du Wallet, préférences, référents, autorisations et autres Leads accessibles associés.              |
|**Activité**                 |Chronologie des changements, communications, rendez-vous, attributions et interventions.                           |
|**Notes et échanges**        |Notes privées, échanges entre intervenants et messages partagés avec le client, clairement distingués.             |
|**Tâches**                   |Actions assignées, rappels, échéances, responsables, priorités et statuts.                                         |
|**Rendez-vous**              |Rendez-vous passés et futurs, reports, annulations et absences.                                                    |
|**Documents et contrats**    |Pièces, offres sources, contrats, versions et demandes de complément.                                              |
|**Offres**                   |Propositions rattachées au Lead, origine, extraction, versions, publication Wallet, choix du client et signature.  |
|**Analyse et propositions**  |Audit, recommandations, comparaisons entre offres et avec le contrat actuel, hypothèses et décisions du conseiller.|
|**Rémunération**             |Accord applicable, estimation, répartition, preuves, réserves et paiements.                                        |
|**Qualité**                  |Retours clients, vérifications, anomalies et actions correctives, selon les permissions.                           |

Masquer les onglets non accessibles plutôt que présenter des espaces vides ou des informations partiellement révélatrices.

Chaque note, document ou message doit indiquer son audience : auteur seul, organisation habilitée, intervenants explicitement affectés, client ou équipe CoverView.

La transmission d’un Lead ne doit pas partager automatiquement les notes privées ni toutes les autres pièces du Wallet.

9. Cycle de vie et clôture des Leads

Ne pas confondre l’avancement commercial, l’attribution, le suivi qualité et l’état financier.

États fonctionnels à prendre en charge

|Dimension      |États principaux                                                                                                                                                                                                                                                                                    |
|---------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Traitement** |Brouillon, nouveau, à qualifier, prêt à attribuer, à contacter, contacté, rendez-vous à planifier, rendez-vous planifié, rendez-vous effectué, analyse en cours, offre demandée, offre reçue, offre présentée, décision client, signature en cours, signé, attente compagnie, contrat émis, terminé.|
|**Attribution**|Non attribué, proposé, accepté, en transfert, publié en marketplace, à réattribuer, repris par CoverView.                                                                                                                                                                                           |
|**Attente**    |Attente du client, d’un document, d’une compagnie, d’une date convenue ou d’un arbitrage ; reporté.                                                                                                                                                                                                 |
|**Résultat**   |Contrat conclu, résolution sans contrat, perdu, refusé, annulé, refus client, absence de solution adaptée, abandon, sans suite, doublon, demande invalide.                                                                                                                                          |
|**Finance**    |Estimé, confirmé, encaissé, réservé, disponible, versé, repris ou contesté.                                                                                                                                                                                                                         |

Les vues Kanban peuvent regrouper certains états pour rester lisibles. Certaines situations sont des statuts secondaires plutôt que des colonnes obligatoires.

Clôture motivée

À la clôture, demander une raison structurée et un commentaire lorsque nécessaire.

|Motif                                       |Suite attendue                                                              |
|--------------------------------------------|----------------------------------------------------------------------------|
|Compétence ou convention manquante          |Proposition de réorientation.                                               |
|Disponibilité incompatible                  |Nouveau créneau ou autre conseiller.                                        |
|Projet reporté                              |Réactivation à une date choisie.                                            |
|Client injoignable                          |Relances limitées, puis mise en attente ou clôture documentée.              |
|Client ne souhaitant plus poursuivre        |Arrêt des sollicitations relatives à ce Lead.                               |
|Solution actuelle adaptée                   |Résolution positive sans nouveau contrat.                                   |
|Insatisfaction                              |Ouverture d’un suivi qualité et proposition de changement.                  |
|Refus d’une compagnie                       |Motif documenté ; recherche d’une alternative pertinente lorsqu’elle existe.|
|Prix, concurrent ou conditions insuffisantes|Motif documenté, éventuelle modification ou proposition alternative adaptée.|

Ne pas redistribuer automatiquement tout Lead non converti. Un bon conseil peut aboutir à ne rien changer.

Un Lead signé peut rester actif pour l’émission de la police, le contrôle du contrat final, la réception des documents, les commissions, un éventuel décommissionnement, le contrôle qualité et les tâches post-signature.

10. Attribution, collaboration et matchmaking

10.1. Attribution manuelle et transmission

Un utilisateur autorisé peut attribuer un Lead à un conseiller, le proposer à une organisation, solliciter un spécialiste, le transférer ou le publier sur la marketplace.

Le conseiller peut lui-même transmettre un Lead, dans les limites de ses droits et de l’accord applicable. Il doit préciser le motif, le mode de collaboration, le périmètre transmis et les conséquences économiques.

L’intervention précédente reste visible dans l’historique. Le transfert ne remet pas arbitrairement à zéro les droits de l’apporteur ou des contributeurs.

10.2. Priorité au conseiller habituel

Rechercher d’abord le conseiller référent du client pour la catégorie concernée : troisième pilier, maladie, véhicule ou autre catégorie.

Le privilégier s’il est habilité, compétent, disponible et en mesure de respecter les préférences du client. Cette priorité n’est pas absolue : le client peut choisir quelqu’un d’autre et CoverView peut intervenir en cas de conflit, d’insatisfaction ou de défaut de suivi.

10.3. Ordre des critères de matching

|Niveau                     |Critères                                                                                                                |
|---------------------------|------------------------------------------------------------------------------------------------------------------------|
|**Éligibilité obligatoire**|Accès actif, activités autorisées, compétences, conventions, langue, zone, disponibilité et absence de conflit bloquant.|
|**Adéquation client**      |Expertise sur le besoin, continuité de relation, mode de rendez-vous, créneau, complexité et qualité documentée.        |
|**Départage**              |Choix du client, capacité disponible et répartition équilibrée entre profils suffisamment adaptés.                      |

La rémunération doit être traitée séparément de l’adéquation. Une rémunération supérieure ne doit pas rendre éligible un conseiller inadapté ni modifier une recommandation de produit.

Appliquer ces règles également aux conseillers CoverView. Les décisions manuelles qui s’écartent de la proposition du système doivent être motivées et traçables.

La prévention des conflits d’intérêts et la transparence des rémunérations font partie des obligations applicables à l’intermédiation ; le classement et les explications au client doivent être cohérents avec ces exigences. [R3]

10.4. Explication et absence de solution

Présenter une justification compréhensible : expertise pertinente, langue, créneau disponible, possibilité de déplacement ou continuité du suivi.

Si aucun profil ne convient, ne pas afficher un « meilleur conseiller » artificiel. Orienter le Lead vers une file de prise en charge CoverView et proposer une alternative explicite.

11. Règle des 24 heures et continuité du suivi

11.1. Définition opérationnelle

Conserver une règle de référence de 24 heures sans première action utile après notification de l’attribution.

Le délai commence à l’attribution notifiée et ne redémarre pas lorsqu’un conseiller ouvre la fiche, accepte le Lead ou modifie une note.

Une action utile correspond notamment à une tentative réelle de contact documentée, un échange avec le client ou un rendez-vous convenu. Une ouverture de dossier, un changement cosmétique de statut ou une note automatique ne suffisent pas.

Une tentative infructueuse doit s’accompagner d’une prochaine étape. Elle ne protège pas indéfiniment le dossier contre une réattribution.

11.2. Calendrier et exceptions

Par défaut, exprimer la règle en heures calendaires. Les éventuels reports liés aux plages de service, jours non ouvrés ou absences doivent être explicitement configurés dans Admin et reflétés dans l’échéance exacte affichée.

Prévoir un délai d’acceptation distinct, réglable, sans permettre qu’il repousse indéfiniment le délai de première action.

Un rendez-vous ultérieur demandé par le client, une attente documentée ou un report validé peut suspendre l’escalade. Toute suspension doit avoir un motif et une date de réexamen.

11.3. Escalade et réattribution

Prévoir un rappel avant l’échéance, une alerte à son dépassement et une réattribution en l’absence d’action ou de justification valable.

Le transfert effectif doit ajuster les accès, conserver l’historique et informer le partenaire sortant. Les droits financiers déjà établis restent traités selon l’accord.

Le client doit recevoir une notification email, SMS ou Wallet selon ses préférences, avec l’identité du nouvel interlocuteur et la prochaine étape. Ne pas promettre qu’un conseiller va appeler avant qu’un interlocuteur soit effectivement désigné.

Un Lead ne doit pas circuler sans fin entre partenaires. Prévoir un nombre maximal de réattributions automatiques, puis une reprise humaine CoverView.

11.4. Suivi après la première prise en charge

Le contrôle ne s’arrête pas au premier appel. Chaque Lead actif doit avoir un responsable, une prochaine action et une échéance, sauf attente justifiée.

Détecter également les offres non suivies, rendez-vous sans compte rendu, attentes expirées, contrats annoncés sans document et Leads devenus inactifs.

12. Prise de rendez-vous depuis Wallet

Le client choisit un ou plusieurs sujets sous forme de cartes avec icônes, puis son mode de rendez-vous : téléphone, visio, bureau ou domicile.

Le système propose prioritairement le conseiller habituel de la catégorie lorsqu’il convient, puis des alternatives éligibles. Chaque profil présente photo, nom, organisation, compétences pertinentes, langues, note exploitable et raison de la proposition.

Si les sujets nécessitent plusieurs spécialistes, proposer un rendez-vous conjoint lorsqu’il est réalisable ou plusieurs rendez-vous coordonnés. Ne pas multiplier automatiquement les sollicitations.

L’agenda doit être responsive, avec une navigation familière de type Google Agenda : changement de période, lecture claire des créneaux et sélection simple sur mobile.

Les disponibilités doivent tenir compte de la durée du rendez-vous, des absences, des autres engagements, du temps de préparation et des déplacements.

Avant confirmation, afficher le récapitulatif : sujets, conseiller, date, heure, durée, lieu ou mode de connexion et documents éventuellement nécessaires.

Prévoir confirmation, rappels, annulation, report, absence client, absence conseiller et changement d’intervenant. Une modification doit être répercutée dans Wallet et Partner sans créer de rendez-vous contradictoires.

Le rendez-vous doit être relié au Lead concerné, ou aux Leads concernés lorsque plusieurs demandes sont traitées pendant le même rendez-vous, sans fusionner leurs cycles indépendants.

13. Recommandations automatiques et audit des offres

Dès que les données sont suffisantes, proposer une orientation initiale automatique, clairement distinguée d’une recommandation finale validée.

L’analyse doit évoluer avec les informations du client, les documents et les propositions reçues.

Périmètre de comparaison

Selon le besoin, examiner les primes ou cotisations, prestations, garanties, exclusions, franchises, limitations, conditions d’admission, refus, frais, contraintes de sortie et adéquation à la situation du client.

Pour la prévoyance, intégrer notamment l’horizon, les versements, les frais, les valeurs de rachat, les garanties, la stratégie d’investissement et les conséquences d’un remplacement.

L’audit doit pouvoir conclure qu’il est préférable de conserver le contrat actuel.

Les offres déposées dans un Lead doivent conserver leur document source, faire l’objet d’une extraction de données, de calculs et d’une comparaison entre elles ainsi qu’avec le contrat actuel correspondant. Leur représentation client dans Wallet doit permettre une lecture prestation par prestation et conduire au choix, à la validation et à la signature selon le parcours.

Transparence des résultats

Chaque analyse doit préciser les données utilisées, leur date, les documents sources, les hypothèses, les informations manquantes et le périmètre de marché couvert.

Distinguer une solution présente sur le marché, une solution accessible au client et une solution distribuable par le réseau.

Ne pas présenter comme certaine une admission, une performance, une économie ou une couverture encore conditionnelle. Ne pas inventer une exclusion ou un refus absent des documents.

Une analyse incomplète ou contradictoire doit déclencher une demande de complément ou une vérification humaine. Le conseiller peut s’écarter de la suggestion, mais doit documenter les raisons importantes.

L’apporteur ne voit les propositions et audits que si ses droits le permettent. Une commission ne donne pas, à elle seule, accès au contenu du conseil.

14. Marketplace et modalités de mise à disposition

14.1. Publication d’un Lead

Un partenaire peut publier un Lead pour manque de temps, absence de convention, besoin trop spécialisé ou volonté de collaboration.

La publication précise le besoin, la qualification, l’ancienneté, les démarches déjà réalisées, le motif de transmission, les contraintes, le mode de collaboration et les conditions économiques.

Avant attribution autorisée, présenter une fiche limitée aux éléments nécessaires pour apprécier l’adéquation. Ne pas exposer publiquement l’identité complète, les coordonnées ou les documents sensibles.

La « zone publique » désigne ici la marketplace commune aux partenaires validés et autorisés, et non un annuaire de données clients ouvert sur Internet.

Par défaut, un Lead ne peut avoir qu’un seul responsable opérationnel et une seule réservation active. La collaboration à plusieurs relève d’un mode explicite de co-conseil.

14.2. Modèles de rémunération des fournisseurs

|Modèle                   |Fonctionnement attendu                                                                                                                                                                     |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Pourcentage au succès**|Le fournisseur obtient une part de la commission selon une base, un événement déclencheur et des conditions convenus.                                                                      |
|**Prix fixe du Lead**    |Le fournisseur facture un montant défini au payeur identifié, selon un événement convenu : acceptation et mise à disposition autorisée, ou qualification particulière prévue dans l’accord.|

Le prix fixe et le pourcentage au succès sont des alternatives par défaut. Aucun cumul implicite.

Pour le prix fixe, préciser avant acceptation le prix, le payeur, le bénéficiaire, le déclenchement de l’exigibilité, les critères de validité, les délais de contestation et les cas de remplacement ou remboursement.

Une réattribution pour défaut de suivi ne doit pas créer automatiquement une deuxième vente ni un remboursement non prévu.

14.3. Rémunération de CoverView

Dans le modèle initial, CoverView est rémunéré sur les commissions des contrats et non sur la vente du Lead.

Le prix fixe payé au fournisseur constitue un flux distinct. Il ne doit pas être enregistré comme une commission CoverView.

Prévoir la possibilité d’activer ultérieurement d’autres modèles, mais uniquement après décision Admin, conditions explicites et validation de leur applicabilité. Aucune facturation supplémentaire de CoverView ne doit apparaître implicitement.

14.4. Réservation et acceptation

Avant acceptation, le conseiller doit connaître le périmètre de la mission, les informations disponibles, ses engagements de suivi et la répartition économique.

Prévoir candidature, proposition directe, réservation temporaire, acceptation, refus motivé et expiration.

Une réservation ne doit pas permettre de bloquer durablement un dossier sans le traiter.

14.5. Enchères et offres concurrentes

Conserver la possibilité d’un mode enchères ou de propositions économiques concurrentes, désactivé par défaut.

Ce mode doit préciser ce qui fait l’objet de l’offre : prix payé au fournisseur ou partage de commission. Il ne doit pas exposer les conditions confidentielles des autres partenaires.

Seuls les profils éligibles peuvent participer. Le montant proposé ne doit pas annuler les exigences d’adéquation, de qualité et de choix du client.

L’activation de ce mode nécessite des règles spécifiques approuvées dans Admin ; il ne doit pas devenir le fonctionnement implicite du matching.

15. Conditions commerciales et moteur de rémunération

15.1. Page de conditions des partenaires

Chaque partenaire autorisé dispose d’une page pour déclarer ses conditions de réception et de transmission, notamment lorsqu’il met un Lead à disposition sur la marketplace.

Les conditions doivent préciser l’organisation concernée, les catégories de produits, les compagnies, la période de validité, les bases de calcul, les commissions, les bonus éventuels, les réserves, les reprises, les délais et les justificatifs.

CoverView doit pouvoir connaître les conditions exactes et totales nécessaires au calcul, et pas uniquement le pourcentage annoncé à l’apporteur.

Les informations confidentielles ne sont pas visibles par les autres partenaires. Les obligations de transparence envers le client restent traitées séparément ; elles ne doivent pas être contournées par les réglages de confidentialité B2B. [R3]

15.2. Accords applicables à une affaire

Chaque Lead doit être rattaché à la version acceptée de son accord. Une modification ultérieure ne doit pas réécrire rétroactivement les conditions déjà convenues.

Prévoir les signatures tardives, plusieurs contrats issus d’un Lead, les contributeurs multiples, les changements de conseiller et les reprises après départ d’un partenaire.

Une condition manquante ou incompatible doit être signalée. Ne pas inventer de taux, de commission nulle ou de calcul par défaut.

15.3. Calculs et estimations

Distinguer la commission potentielle en cas de conclusion, une éventuelle valeur probabilisée, la commission confirmée et les montants réellement disponibles.

Afficher les hypothèses et une fourchette lorsque l’incertitude est significative. Sans données suffisantes, afficher « non estimable ».

Dans un partage simple où tous les pourcentages utilisent la même base B :

Part apporteur = B × taux apporteur

Part CoverView = B × taux CoverView

Part exécutant = B − autres parts prévues

La base et les déductions autorisées doivent être explicites. Bloquer tout partage dépassant le montant distribuable.

Les offres alternatives d’un même besoin ne doivent pas être additionnées comme si elles allaient toutes être conclues.

15.4. Encaissements, réserves et reprises

Prendre en charge les deux circuits : encaissement par CoverView puis répartition, ou encaissement par le partenaire puis reversement.

Suivre séparément les montants estimés, confirmés, encaissés, retenus en réserve, disponibles, versés, repris et contestés.

Une réserve est une retenue temporaire ; elle ne doit pas être comptée une deuxième fois comme perte définitive.

Les montants deviennent disponibles selon les preuves d’encaissement et les conditions de l’accord. Une simple signature déclarée ne doit pas rendre automatiquement une commission payable.

Le rapprochement doit relier l’affaire, le contrat, le bordereau ou justificatif de rémunération et le règlement. Prévoir encaissements partiels, écarts, impayés, corrections et décommissionnements.

Les règles applicables par branche, les plafonds éventuels et les modalités fiscales doivent être renseignés et validés avant activation du modèle concerné.

16. Appels, transcriptions et assistance à la qualité

Permettre d’enregistrer les appels autorisés et de produire une transcription, un résumé, les sujets abordés, les engagements, les prochaines actions et les points à vérifier.

L’enregistrement doit être précédé d’une information claire et de l’accord prévu pour ce dispositif. Le client doit pouvoir poursuivre sans enregistrement.

Distinguer les finalités : compte rendu, preuve, contrôle qualité, formation et amélioration du conseil. Le PFPDT souligne notamment que les exceptions limitées à certaines transactions téléphoniques ne permettent pas de réutiliser librement les enregistrements à des fins d’évaluation ou de formation. [R4]

Prévoir des accès restreints, une conservation définie, la suppression selon les règles applicables et la traçabilité des consultations.

Les suggestions issues d’une transcription doivent renvoyer au passage source. Une transcription corrigée doit rester distinguable de sa version initiale.

Aucune sanction ne doit reposer exclusivement sur une interprétation automatique du ton, d’une phrase ou d’un transcript. Les points sensibles doivent être vérifiés par une personne habilitée.

Les appels, transcriptions, résumés, engagements et tâches résultantes doivent être rattachés au Lead concerné et alimenter sa timeline.

17. Contrôle qualité et enquêtes de satisfaction

17.1. Enquête à la fin d’un Lead

Déclencher une enquête lorsque le Lead est terminé, avec un questionnaire adapté au service réellement reçu, y compris lorsqu’aucun contrat n’a été conclu.

Demander : « Êtes-vous satisfait du service / conseil reçu ? »

Le client attribue une note de 1 à 5 étoiles.

|Note                  |Parcours                                                                                                                                                                        |
|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**5 étoiles**         |Proposer une liste de choses positives en sélection multiple, un commentaire facultatif, puis inviter le client à laisser une note ou un avis Google.                           |
|**4 étoiles ou moins**|Ne pas proposer l’avis Google à cette étape. Demander ce qui pourrait être amélioré, avec sélection de motifs, commentaire libre et possibilité de demander un rappel CoverView.|

L’invitation à publier un avis Google dépend de la note : elle est proposée uniquement après une note de 5 étoiles.

Terminer par : « Merci pour votre retour ! »

Distinguer l’expérience avec CoverView, le conseiller et l’assureur lorsque cela est pertinent. Les réponses internes alimentent le suivi qualité CoverView.

17.2. Contrôles CoverView

Prévoir des appels et emails qualité pour vérifier la prise de contact, la tenue du rendez-vous, la clarté du conseil, la réception des documents et l’éventuelle signature de contrats.

Comparer les réponses du client avec l’état déclaré du dossier. Une incohérence doit créer une action de vérification, pas une accusation automatique.

Les confirmations clients peuvent signaler une affaire non déclarée, mais ne remplacent pas la preuve d’encaissement des commissions.

Prévoir un suivi après conclusion et des contrôles ciblés en cas de risque, sans multiplier les sollicitations sur un même client.

17.3. Réclamations et continuité

Chaque réclamation doit avoir un responsable, une priorité, une échéance et un historique.

Permettre un rappel CoverView, une vérification du dossier, une demande d’explication au partenaire, un changement d’interlocuteur et une clôture motivée.

Ne pas considérer une réclamation comme résolue uniquement parce que le conseiller a répondu.

18. Profils, notes et évaluation des partenaires

Les conseillers et organisations disposent d’un profil présentant photo ou logo, nom, rôle, spécialités, langues, modes de rendez-vous, zone d’intervention et éléments de qualité publiables.

Distinguer trois dimensions d’évaluation :

|Dimension                               |Exemples                                                                        |
|----------------------------------------|--------------------------------------------------------------------------------|
|**Expérience client**                   |Écoute, clarté, ponctualité, compréhension, absence de pression.                |
|**Qualité opérationnelle et du conseil**|Suivi, documentation, justification des recommandations, réclamations examinées.|
|**Fiabilité économique**                |Déclarations, rapprochements, paiements, reprises et anomalies vérifiées.       |

Les indicateurs financiers détaillés et les scores de risque restent internes aux personnes habilitées et accessibles à l’administrateur CoverView. La note publique doit préciser sa période, son volume d’observations et sa méthode générale.

Ne pas assimiler automatiquement une forte conversion à du bon conseil, ni une résiliation à une faute. Comparer autant que possible des dossiers de catégorie, ancienneté et difficulté comparables.

Prévoir un traitement prudent des profils disposant de peu d’historique et une possibilité de contester des données erronées.

Évaluer également les apporteurs sur la qualité de leurs informations, la validité des autorisations, les doublons et la conformité entre le Lead annoncé et la réalité.

19. Centre de notifications et supervision Admin

19.1. Notifications

Prévoir un centre de notifications relié aux dossiers, avec niveau de priorité, destinataire responsable, date et action attendue.

Couvrir notamment les attributions, acceptations, retraits du pipeline, échéances, réattributions, rendez-vous, messages, documents manquants, audits, offres publiées ou mises à jour, décisions client, signatures déclarées, commissions, reprises, retours qualité et changements d’accès.

Une notification lue n’est pas une tâche accomplie. Les alertes nécessitant une action doivent rester ouvertes jusqu’à résolution.

Distinguer notifications de service et communications marketing. Respecter les préférences et limiter les doublons entre les différentes applications.

Les emails et SMS ne doivent pas contenir de données sensibles inutiles ; ils orientent vers l’espace approprié.

19.2. Pilotage Admin

Admin doit réunir la gestion des inscriptions, habilitations, partenaires, conseillers, conventions, capacités, règles de matching, délais, publications marketplace, conditions économiques, réserves, litiges, contrôles qualité, statistiques et objectifs.

Prévoir des files de travail actionnables : Leads sans responsable, dossiers en retard, réattributions répétées, justificatifs expirés, commissions non rapprochées, contrats potentiellement non déclarés et réclamations urgentes.

Les actions sensibles doivent afficher leurs conséquences avant confirmation et conserver une trace de la décision.

L’administrateur CoverView doit pouvoir tout voir et filtrer l’ensemble du réseau. Les autres collaborateurs CoverView accèdent aux informations selon leur mission ; leur appartenance à l’équipe ne doit pas ouvrir indistinctement tous les dossiers sensibles sans habilitation correspondante.

20. Confidentialité, droits et règles de protection

Les accès doivent dépendre du rôle, de l’organisation, de l’affectation au Lead, du mandat et des autorisations applicables.

L’administrateur CoverView possède la vision globale. Le conseiller ordinaire ne consulte que les Leads qui lui sont attribués et les fiches publiques des Leads de la marketplace. Un rôle distinct d’apporteur ou de responsable peut donner des droits supplémentaires limités, explicitement accordés ; aucun accès collectif implicite ne doit être créé.

Retirer l’accès opérationnel lors d’une fin de mission ou d’une suspension, tout en conservant les éléments nécessaires aux droits économiques, aux obligations de conservation et au traitement d’un litige.

Prévoir des parcours pour consulter ou rectifier les données, revoir les autorisations, demander un changement d’interlocuteur, exercer les droits applicables et comprendre les traitements importants.

Une réattribution ne doit pas autoriser implicitement la prospection sur d’autres besoins.

Les scores internes relatifs à des personnes ne doivent pas être considérés comme soustraits à tout droit d’accès simplement parce qu’ils ne sont pas affichés publiquement. [R5]

Avant activation des traitements sensibles, documenter les finalités, destinataires, conservations, responsabilités et risques. Examiner notamment la nécessité d’une analyse d’impact : elle est requise lorsque le traitement est susceptible d’entraîner un risque élevé pour les personnes. [R6]

Les conditions de diffusion, d’enregistrement, de rémunération et les mentions du label doivent faire l’objet d’une validation adaptée avant mise en service.

21. Indicateurs de pilotage et objectifs

Les tableaux de bord doivent distinguer activité, qualité et économie.

|Domaine                   |Indicateurs attendus                                                                                           |
|--------------------------|---------------------------------------------------------------------------------------------------------------|
|**Prise en charge**       |Délai de première action, contact utile, rendez-vous tenus, dépassements et réattributions.                    |
|**Résolution**            |Leads résolus avec ou sans contrat, abandons et motifs de clôture.                                             |
|**Qualité**               |Satisfaction, réclamations examinées, actions correctives et défauts de suivi.                                 |
|**Économie**              |Commissions potentielles, confirmées, encaissées, réservées, versées et reprises.                              |
|**Rentabilité CoverView** |Recettes et coûts de qualification, traitement, contrôle et suivi, par Lead et par branche lorsque disponibles.|
|**Fiabilité du réseau**   |Qualité des apports, déclarations complètes, montants rapprochés et litiges.                                   |
|**Continuité Wallet**     |Documents disponibles, offres publiées, contrats centralisés et suivi réalisé après conclusion.                |
|**Capacité**              |Leads sans spécialiste adapté, disponibilités manquantes et concentration des attributions.                    |
|**Activité et conversion**|Contacts, rendez-vous, offres, signatures, tâches, taux de transformation et durée des étapes.                 |
|**Objectifs**             |Cible, réalisé, progression, écart et historique par conseiller, équipe, partenaire et CoverView.              |

Afficher la période, le périmètre et la définition des indicateurs. Ne pas présenter une donnée indisponible comme un résultat nul.

Les tableaux économiques ne doivent pas devenir le seul instrument d’évaluation des conseillers.

Prévoir un espace Statistiques, un module Objectifs, un dashboard personnel conseiller et un dashboard global Admin, détaillés dans la partie II.

22. Exigences d’expérience utilisateur

L’interface doit être lisible, progressive et adaptée à un usage quotidien.

Mettre en avant la prochaine action, distinguer les informations certaines des estimations et réserver les détails aux espaces appropriés. Utiliser des libellés compréhensibles : préférer « Lead à prendre en charge » à « Lead non consommé ».

Les statuts doivent rester compréhensibles sans dépendre uniquement de la couleur. Prévoir des états vides utiles, des explications sur les actions indisponibles et une navigation mobile adaptée.

Les actions sensibles — transmission, publication, modification économique, retrait d’accès — doivent préciser leurs effets et leurs destinataires.

L’utilisateur doit pouvoir revenir à sa vue, ses filtres et son contexte après consultation d’un dossier.

Le parcours principal de travail est Dashboard → Leads / Kanban → fiche Lead, avec le client comme vue transverse. Les fonctions de détail doivent être segmentées en onglets pour éviter une vue unique surchargée.

23. Critères d’acceptation fonctionnels

Le développement doit permettre de vérifier les scénarios suivants de bout en bout.

|Scénario                                                        |Résultat attendu                                                                                                                                  |
|----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
|Un partenaire s’inscrit                                         |Aucun accès opérationnel avant validation ; traitement complet depuis Admin.                                                                      |
|Un apporteur saisit un client existant                          |Pas de Wallet dupliqué ni de révélation d’informations sans autorisation.                                                                         |
|Un nouveau client est transmis                                  |Espace Wallet préparé et activation encadrée ; aucun consentement implicite.                                                                      |
|Un client a plusieurs besoins ou plusieurs demandes de contrat  |Plusieurs Leads distincts, avec référents adaptés et suivi coordonné, sans fusion des cycles indépendants.                                        |
|Deux contrats ou véhicules d’un même client doivent être traités|Chaque demande peut posséder sa carte, ses tâches, ses offres et son statut, même dans la même catégorie.                                         |
|Un apporteur consulte son Lead                                  |Progression et rémunération visibles ; offres et données sensibles limitées à ses droits.                                                         |
|Un conseiller consulte son pipeline                             |Seuls ses Leads attribués sont visibles ; il n’accède pas aux autres Leads du réseau.                                                             |
|Un conseiller consulte la marketplace                           |Seules les fiches publiques des Leads publiés lui sont présentées avant attribution autorisée.                                                    |
|L’administrateur consulte Partner ou Admin                      |Vision globale de tous les Leads, clients, offres, conseillers, partenaires, conditions, statistiques et objectifs.                               |
|Un Lead change de colonne                                       |Les justificatifs et contrôles du nouveau statut sont exigés.                                                                                     |
|Un Lead passe en rendez-vous planifié                           |Date, heure, conseiller, méthode, lieu ou lien et durée sont vérifiés ; le rendez-vous correspondant est créé ou associé.                         |
|Un conseiller transmet un dossier                               |Motif, périmètre, historique, notifications et droits économiques conservés.                                                                      |
|Un conseiller habituel convient                                 |Il est proposé prioritairement, sans neutraliser le choix du client.                                                                              |
|Aucun conseiller ne convient                                    |Reprise par CoverView, sans fausse promesse de disponibilité.                                                                                     |
|Aucune action utile n’intervient sous 24 heures                 |Alerte et réattribution selon la règle affichée et ses exceptions explicites.                                                                     |
|Un rendez-vous futur est convenu                                |Pas de retrait injustifié pour inactivité ; suivi repris à l’échéance prévue.                                                                     |
|Le client refuse de poursuivre                                  |Arrêt des sollicitations, pas redistribution automatique.                                                                                         |
|Le contrat actuel est adapté                                    |Clôture positive sans vente et sans pénalité qualité automatique.                                                                                 |
|Un Lead est publié à prix fixe                                  |Payeur, prix, déclencheur et contestation connus ; absence de frais CoverView implicites sur la vente.                                            |
|Une rémunération au succès est conclue                          |Version de l’accord conservée et répartition explicable.                                                                                          |
|Une commission est seulement estimée                            |Elle ne figure pas parmi les sommes disponibles.                                                                                                  |
|Une reprise intervient                                          |Les soldes sont corrigés sans double comptabilisation de la réserve.                                                                              |
|Un client signale un contrat non déclaré                        |Vérification ouverte et rapprochement demandé, sans sanction automatique.                                                                         |
|Un client refuse l’enregistrement                               |Le conseil reste possible sans enregistrement.                                                                                                    |
|Un client donne une note de 5 étoiles                           |Liste de points positifs à choix multiples, puis invitation à laisser une note ou un avis Google.                                                 |
|Un client donne une note de 4 étoiles ou moins                  |Parcours d’amélioration, commentaire ou rappel éventuel ; pas d’invitation Google à cette étape.                                                  |
|Un conseiller est suspendu                                      |Accès retiré, Leads pris en charge, historique et droits financiers préservés.                                                                    |
|Un audit manque d’informations                                  |Résultat limité ou suspendu, avec complément ou contrôle humain demandé.                                                                          |
|Un client change de conseiller                                  |Continuité de son Wallet et de ses documents, avec révision des accès.                                                                            |
|Des offres sont insérées dans un Lead                           |Documents sources conservés, données extraites et analysées, offres destinées au client publiées dans Wallet.                                     |
|Le client compare des offres                                    |Comparaison prestation par prestation entre offres et avec le contrat actuel correspondant, avec avantages, pertes et incertitudes visibles.      |
|Le client choisit puis signe une offre                          |Choix, validation et signature synchronisés avec le Lead ; version précise conservée ; émission et acceptation de la compagnie suivies séparément.|
|Un utilisateur suit ses objectifs                               |Cible, réalisé, progression et écart visibles sur son périmètre, avec accès aux affaires qui composent les indicateurs.                           |

Le périmètre attendu est un parcours réellement utilisable, du dépôt du Lead au suivi après conclusion. Chaque changement d’état doit produire ses effets sur les responsabilités, les accès, les notifications, la qualité et la rémunération — sans transformer la centralisation dans CoverView en partage indiscriminé des données ou en perte de liberté pour le client.

PARTIE II — APPROFONDISSEMENTS DU MODÈLE LEAD ET DU SUIVI CLIENT

Principe fondamental : Client ≠ Lead

Dans CoverView Partner, le Client et le Lead sont deux objets distincts.

Le Client représente la personne ou l’entreprise et constitue le dossier central lié à Wallet.

Le Lead représente une demande commerciale ou de conseil précise liée à ce client.

Un même client peut donc avoir autant de Leads que nécessaire, simultanément ou successivement.

Exemples :

• Lead « Assurance véhicule Tesla Model Y ».
• Lead « Assurance véhicule Porsche 911 ».
• Lead « LAMal 2027 ».
• Lead « Complémentaire hospitalisation ».
• Lead « 3e pilier A ».
• Lead « Protection juridique ».
• Lead « RC ménage ».
• Lead « Analyse / remplacement d’un contrat existant ».

Le Lead correspond donc généralement à :

• Une demande de contrat.
• Une demande d’offre.
• Un besoin identifié.
• Une opportunité commerciale.
• Une demande de comparaison.
• Une demande de modification ou remplacement.
• Un renouvellement.
• Une demande nécessitant un suivi jusqu’à résolution.

Le client constitue la vue globale de la relation.

Les Leads constituent les unités opérationnelles permettant de faire avancer chaque besoin du client.

1. Le Lead comme objet central de travail

Chaque Lead doit être utilisable comme un véritable dossier opérationnel.

Il doit permettre de suivre :

• Son propriétaire / conseiller responsable.
• Le partenaire ayant fourni le Lead.
• Le client concerné.
• Le type de besoin.
• Le ou les produits concernés.
• La compagnie actuelle.
• Les compagnies ou solutions envisagées.
• La valeur économique potentielle.
• La commission potentielle.
• La rémunération potentielle de l’apporteur.
• La rémunération potentielle CoverView.
• Le statut commercial.
• La progression.
• Les tâches.
• Les rendez-vous.
• Les rappels.
• Les prochaines étapes.
• Les documents.
• Les offres.
• Les contrats.
• Les échanges.
• Les notes internes.
• L’historique complet du Lead.
• Les alertes.
• Les échéances.
• Les raisons d’échec ou de clôture.
• Les contrôles qualité.

Le Lead doit pouvoir vivre pendant toute la durée du processus, depuis sa création jusqu’à sa conclusion, son abandon ou sa clôture.

Il doit également pouvoir continuer à exister après la signature lorsque des actions restent nécessaires :

• Émission de la police.
• Contrôle du contrat.
• Réception des documents.
• Suivi de commission.
• Décommissionnement éventuel.
• Contrôle qualité.
• Tâches post-signature.

2. Relation Client → Leads → Contrats

La structure fonctionnelle doit être pensée comme suit :

Client

→ Possède plusieurs Leads.

→ Chaque Lead peut générer zéro, un ou plusieurs contrats.

→ Chaque contrat est ensuite rattaché au Wallet du client.

Exemple

Client : Marc Dupont

Lead #142 — LAMal 2027

• Offre Helsana.
• Offre CSS.
• Contrat final Helsana.

Lead #175 — Assurance automobile

• Offre Vaudoise.
• Offre Baloise.
• Contrat final Vaudoise.

Lead #204 — 3e pilier

• Analyse existante.
• Proposition Liechtenstein Life.
• Contrat final.

Les Leads restent consultables depuis le client afin de reconstituer tout l’historique commercial et de conseil, dans le périmètre autorisé de l’utilisateur ; l’administrateur dispose de l’historique global.

Inversement, depuis un Lead, il doit être possible d’ouvrir immédiatement le dossier client et les autres Leads accessibles liés à ce client.

3. Partner comme outil de suivi client et CRM opérationnel

Partner n’est pas uniquement une application de distribution de Leads.

Il doit également être utilisé par CoverView et ses conseillers comme outil quotidien de suivi commercial et client.

Il doit permettre de savoir immédiatement :

• Ce qui doit être fait aujourd’hui.
• Quels clients doivent être rappelés.
• Quels rendez-vous sont prévus.
• Quels Leads n’avancent plus.
• Quelles offres sont attendues.
• Quels documents manquent.
• Quelles signatures sont attendues.
• Quels contrats viennent d’être signés.
• Quelles commissions restent à confirmer.
• Quels Leads risquent d’être perdus.
• Quelles tâches sont en retard.

Partner doit donc combiner :

Gestion de Leads + pipeline + tâches + rendez-vous + activité client + suivi économique.

4. Kanban des Leads

Le Kanban constitue l’une des vues centrales de Partner.

Chaque carte représente un Lead, et non un client.

Un même client peut donc apparaître plusieurs fois dans le Kanban s’il possède plusieurs demandes actives.

Exemple

Marc Dupont peut simultanément apparaître dans :

• « Offre en préparation » pour son assurance automobile.
• « Rendez-vous planifié » pour son troisième pilier.
• « Documents manquants » pour son assurance maladie.

Colonnes principales

La configuration doit pouvoir évoluer, mais prévoir notamment :

1. Nouveau.
2. À qualifier.
3. À contacter.
4. Contacté.
5. Rendez-vous à planifier.
6. Rendez-vous planifié.
7. Rendez-vous effectué.
8. Analyse en cours.
9. Offre demandée.
10. Offre reçue.
11. Offre présentée.
12. Décision client.
13. Signature en cours.
14. Signé.
15. Attente compagnie.
16. Contrat émis.
17. Terminé.

Prévoir également des états spécifiques tels que :

• En attente client.
• En attente document.
• En attente compagnie.
• Reporté.
• Marketplace.
• À réattribuer.
• Perdu.
• Refusé.
• Annulé.
• Sans suite.

Certaines situations peuvent être représentées sous forme de statut secondaire plutôt que de colonne afin d’éviter un Kanban excessivement large.

5. Déplacement intelligent des Leads

Les cartes doivent pouvoir être déplacées directement entre les colonnes.

Un déplacement peut provoquer automatiquement des actions associées.

Déplacement vers « Rendez-vous planifié »

Demander ou vérifier :

• Date.
• Heure.
• Conseiller.
• Type de rendez-vous.
• Lieu ou lien.
• Durée.

Créer automatiquement le rendez-vous correspondant, ou associer le rendez-vous existant pour ne pas le dupliquer.

Déplacement vers « Offre demandée »

Permettre de renseigner :

• Compagnie.
• Produit.
• Date de demande.
• Documents envoyés.
• Interlocuteur éventuel.

Déplacement vers « Offre reçue »

Associer l’offre ou le document. L’offre alimente le processus d’extraction, d’analyse, de publication Wallet et de comparaison détaillé dans la partie III.

Déplacement vers « Signé »

Demander :

• Compagnie.
• Produit.
• Date de signature.
• Montant / prime.
• Commission estimée.
• Document signé.
• Date d’effet.

Déplacement vers « Perdu »

Demander obligatoirement le motif.

Exemples :

• Prix.
• Client ne souhaite plus poursuivre.
• Client ne répond plus.
• Concurrent.
• Solution existante conservée.
• Refus compagnie.
• Conditions insuffisantes.
• Mauvais timing.
• Conseiller non adapté.
• Autre.

Selon le motif, Partner peut proposer une nouvelle action :

• Relance future.
• Réattribution.
• Marketplace.
• Changement de conseiller.
• Clôture définitive.

La conservation d’une solution existante adaptée doit pouvoir être requalifiée en résolution positive sans contrat, plutôt qu’être automatiquement comptée comme un échec qualité.

6. Carte Lead

Chaque carte du Kanban doit rester compacte tout en donnant les informations permettant d’agir immédiatement.

Afficher notamment :

• Nom du client.
• Avatar éventuel.
• Type de besoin.
• Produit ou catégorie.
• Conseiller responsable.
• Partenaire apporteur si pertinent.
• Prochaine action.
• Échéance.
• Prochain rendez-vous.
• Nombre de tâches ouvertes.
• Alertes.
• Valeur économique potentielle.
• Indicateur de retard.
• Nombre de jours dans l’étape actuelle.

Des indicateurs visuels doivent permettre d’identifier immédiatement :

• Lead sans activité récente.
• Lead urgent.
• Tâche en retard.
• Rendez-vous aujourd’hui.
• Document manquant.
• Lead proche de la limite de 24 heures.
• Commission importante.
• Lead nécessitant une intervention CoverView.

7. Fiche Lead

Lorsqu’un Lead est ouvert, l’utilisateur accède à une fiche détaillée.

En-tête

Toujours afficher :

• Client.
• Catégorie.
• Statut.
• Conseiller.
• Apporteur.
• Valeur potentielle.
• Prochaine étape.
• Échéance.
• Date de création.
• Temps écoulé dans le statut actuel.

Actions principales :

• Appeler.
• Envoyer un email.
• Envoyer un message.
• Ajouter une tâche.
• Programmer un rendez-vous.
• Ajouter un document.
• Créer une offre.
• Modifier le responsable.
• Transférer.
• Publier sur Marketplace.
• Clôturer.

Onglets

Organiser intelligemment les fonctionnalités par onglets afin de ne jamais présenter toutes les informations dans une seule vue.

Prévoir notamment :

Vue d’ensemble

Résumé du besoin, progression, prochaines actions et informations essentielles.

Activité

Timeline complète de tous les événements du Lead.

Tâches

Tâches ouvertes, terminées, échéances, responsables et rappels.

Rendez-vous

Rendez-vous passés et futurs.

Notes

Notes internes liées au Lead, avec leurs audiences et droits respectifs.

Documents

Offres, contrats, justificatifs et autres fichiers.

Offres

Toutes les propositions commerciales réalisées, avec leurs données structurées, versions, états de publication, choix client et signatures.

Analyse

Recommandation CoverView, comparaison et éléments d’audit.

Rémunération

Commission potentielle, confirmée et répartitions.

Qualité

Feedback client, contrôles CoverView et éventuelles alertes.

8. Tâches et prochaines étapes

Chaque Lead doit pouvoir posséder plusieurs tâches.

Une tâche comprend :

• Titre.
• Description.
• Responsable.
• Échéance.
• Priorité.
• Rappel.
• Statut.
• Lien avec un Lead.
• Éventuellement lien avec un rendez-vous ou document.

Exemples :

• Rappeler le client.
• Demander le certificat d’assurance.
• Envoyer une proposition.
• Attendre une offre AXA.
• Vérifier le questionnaire santé.
• Faire signer le contrat.
• Contrôler l’émission de la police.
• Transmettre la commission au partenaire.

Prochaine action principale

Chaque Lead actif doit idéalement disposer d’une prochaine action principale. Une attente justifiée doit également prévoir une date de réexamen.

Cela doit permettre de répondre très facilement à la question :

> « Quelle est la prochaine chose à faire pour faire avancer cette affaire ? »

Un Lead sans prochaine étape depuis un certain délai doit apparaître dans les alertes.

9. Permissions et visibilité des Leads

Les droits de visibilité sont essentiels.

Administrateur CoverView

L’administrateur peut voir :

• Tous les Leads.
• Tous les clients.
• Toutes les organisations.
• Tous les conseillers.
• Tous les partenaires.
• La Marketplace.
• Tous les statuts.
• Toutes les statistiques.
• Tous les responsables de Leads.
• Tous les transferts.
• Les conditions commerciales.
• Les rémunérations.
• Les contrôles qualité.
• Les alertes.
• Les offres, contrats et activités rattachés aux Leads.
• Les objectifs individuels, d’équipe, de partenaire et globaux.

L’administrateur doit pouvoir filtrer l’ensemble du réseau.

Conseiller

Un conseiller ne peut voir que :

1. Les Leads qui lui sont attribués

Il dispose alors des informations correspondant à son rôle et à son périmètre d’intervention. En cas de collaboration, l’affectation au Lead doit être explicite.

2. Les Leads publiés dans la zone publique / Marketplace

Les informations visibles avant acquisition ou attribution sont limitées aux données nécessaires à son évaluation.

Il ne doit jamais pouvoir parcourir librement tous les Leads de CoverView, ni ceux des autres conseillers de son organisation du seul fait de son appartenance à celle-ci.

3. Les droits distincts explicitement accordés

Une vue « Leads de mon équipe » est réservée au rôle distinct de responsable habilité. Elle n’ajoute aucun droit au rôle de conseiller ordinaire.

Lorsqu’un conseiller est aussi apporteur, il peut suivre ses Leads transmis dans les limites de son accord d’apporteur, sans conserver automatiquement tout l’accès opérationnel après transfert.

Partenaire apporteur

Il voit ses Leads transmis ainsi que les informations de progression auxquelles son accord lui donne droit.

Il peut, selon les règles de collaboration, ne voir que :

• Statut.
• Progression.
• Résultat.
• Rémunération.

Ou disposer d’un niveau d’information supérieur si l’accord le prévoit.

Marketplace

Les Leads disponibles sur la Marketplace constituent une zone commune accessible aux partenaires autorisés.

Ils doivent être anonymisés ou partiellement masqués tant qu’ils n’ont pas été attribués.

Le partenaire voit suffisamment d’informations pour décider s’il est intéressé, mais pas les données personnelles et documents auxquels il n’a pas encore de droit d’accès.

10. Vues Kanban personnalisées

Chaque conseiller doit disposer par défaut d’un Kanban filtré sur :

> **Mes Leads**

Prévoir également, uniquement dans le périmètre des rôles et permissions correspondants :

• Leads de mon équipe, pour le responsable habilité uniquement.
• Leads apportés.
• Leads reçus.
• Leads Marketplace.
• Leads urgents.
• Leads en retard.
• Leads sans prochaine action.
• Leads avec rendez-vous cette semaine.
• Leads signés.
• Leads perdus.
• Leads en attente.

L’administrateur peut créer ses propres vues globales.

Exemples :

> « Tous les Leads 3A »

> « Leads maladie sans contact depuis 48 heures »

> « Affaires de plus de CHF 2’000 de commission potentielle »

> « Leads de Sébastien ayant un rendez-vous cette semaine »

> « Leads signés en septembre »

Les utilisateurs peuvent enregistrer leurs filtres comme vues favorites. Un filtre enregistré ne donne jamais accès à des Leads autrement invisibles.

11. Statistiques

Partner doit comporter un espace Statistiques permettant aux partenaires, conseillers, responsables d’équipe habilités et administrateurs de suivre leur activité.

Les données visibles dépendent des permissions.

Activité

Afficher notamment :

• Nouveaux Leads.
• Leads actifs.
• Leads clôturés.
• Leads signés.
• Leads perdus.
• Leads Marketplace reçus.
• Leads Marketplace transmis.
• Rendez-vous planifiés.
• Rendez-vous effectués.
• Tâches terminées.
• Tâches en retard.

Conversion

Afficher :

• Taux de contact.
• Taux de rendez-vous.
• Taux de transformation.
• Lead → rendez-vous.
• Rendez-vous → offre.
• Offre → signature.
• Délai moyen avant premier contact.
• Délai moyen avant rendez-vous.
• Délai moyen avant signature.
• Durée moyenne totale du cycle.

Les taux doivent pouvoir être filtrés par :

• Conseiller.
• Partenaire.
• Source.
• Catégorie.
• Produit.
• Compagnie.
• Période.

Chaque filtre reste limité aux données auxquelles l’utilisateur est autorisé à accéder.

Pipeline

Afficher :

• Nombre de Leads par étape.
• Valeur économique potentielle du pipeline.
• Valeur pondérée.
• Commissions potentielles.
• Commissions signées.
• Commissions encaissées.

Permettre de comparer :

• Mois actuel.
• Mois précédent.
• Trimestre.
• Année.
• Période personnalisée.

Qualité

Afficher :

• Satisfaction moyenne.
• Nombre d’avis.
• Taux de Leads suivis dans les délais.
• Taux de réattribution.
• Plaintes.
• Contrôles qualité.
• Dossiers sans activité.
• Contrats non documentés.

12. Objectifs

Ajouter un véritable module Objectifs.

Les objectifs peuvent être définis :

• Par conseiller.
• Par équipe.
• Par partenaire.
• Pour CoverView globalement.

Ils peuvent porter sur les catégories suivantes.

Activité

• Nombre de contacts.
• Nombre de rendez-vous.
• Nombre d’offres.
• Nombre de suivis réalisés.

Résultats

• Nombre de signatures.
• Nombre de contrats.
• Montant de commissions.
• Chiffre d’affaires.
• Valeur de pipeline.

Conversion

• Taux de transformation.
• Taux de rendez-vous.
• Taux offre → signature.

Qualité

• Satisfaction moyenne.
• Délai moyen de prise en charge.
• Pourcentage de Leads traités dans les délais.
• Taux de suivi complet.

Chaque objectif comprend :

• Indicateur.
• Période.
• Cible.
• Progression.
• Réalisé.
• Écart.
• Historique.

Exemple

Objectif octobre : CHF 30’000 de commissions signées.

CHF 21’400 réalisés.

Progression : 71 %, arrondie à l’unité.

Les objectifs doivent apparaître de manière synthétique sur le dashboard.

13. Dashboard personnel du conseiller

Le dashboard d’un conseiller doit répondre immédiatement à :

> « Qu’est-ce que j’ai à faire aujourd’hui ? »

et :

> « Où en suis-je par rapport à mes objectifs ? »

Prévoir notamment les ensembles suivants.

Priorités du jour

• Leads à contacter.
• Rappels.
• Rendez-vous.
• Tâches en retard.
• Dossiers nécessitant une action.

Pipeline

• Leads actifs par étape.
• Nouveaux Leads.
• Signatures attendues.
• Valeur du pipeline.

Objectifs

• Signatures.
• Commissions.
• Rendez-vous.
• Progression du mois.

Alertes

• Lead sans activité.
• Lead bientôt réattribué.
• Document manquant.
• Offre attendue.
• Contrôle qualité.

Activité récente

Timeline synthétique des derniers événements.

14. Dashboard Admin CoverView

L’administrateur dispose d’une vision beaucoup plus complète permettant de piloter toute l’activité.

Afficher notamment les ensembles suivants.

Vue réseau

• Nombre de partenaires actifs.
• Nombre de conseillers actifs.
• Nouveaux inscrits.
• Demandes de validation.
• Partenaires suspendus.

Pipeline global

• Leads totaux.
• Leads actifs.
• Répartition par catégorie.
• Répartition par conseiller.
• Répartition par partenaire.
• Valeur totale.
• Commissions potentielles.
• Commissions signées.

Activité

• Leads entrants.
• Leads distribués.
• Leads Marketplace.
• Rendez-vous.
• Signatures.

Suivi

• Leads sans action.
• Leads de plus de 24 heures concernés par la règle de prise en charge.
• Leads sans prochaine étape.
• Leads en retard.
• Nombre de réattributions.

Qualité

• Satisfaction.
• Alertes.
• Réclamations.
• Contrôles en attente.
• Anomalies.

Performance

• Comparaison des conseillers.
• Comparaison des partenaires.
• Conversion.
• Cycle de vente.
• Commissions.
• Atteinte des objectifs.

Ces données doivent être filtrables et permettre d’ouvrir directement les Leads concernés.

15. Satisfaction client et avis Google

Conserver strictement le parcours souhaité.

Lorsqu’un Lead / une demande client est terminé, demander :

> **« Êtes-vous satisfait du service / conseil reçu ? »**

Note de 1 à 5 étoiles.

Si 5 étoiles

Afficher une sélection multiple permettant d’indiquer ce qui a été particulièrement apprécié.

Exemples :

• Qualité du conseil.
• Disponibilité.
• Réactivité.
• Clarté.
• Écoute.
• Professionnalisme.
• Simplicité du processus.
• Qualité des solutions proposées.

Puis proposer au client de laisser une note / un avis Google.

Si 4 étoiles ou moins

Ne pas proposer l’avis Google à cette étape.

Demander :

> **« Qu’est-ce qui pourrait être amélioré ? »**

Permettre :

• Sélection de motifs.
• Commentaire libre.
• Demande de rappel éventuelle.

Ces réponses alimentent les contrôles qualité CoverView.

Terminer le parcours par :

> **« Merci pour votre retour ! »**

16. Le Lead comme point de raccordement de toute l’activité

Tous les événements commerciaux doivent pouvoir être rattachés à un Lead.

Exemples :

• Email envoyé.
• Appel.
• Transcript.
• Rendez-vous.
• Tâche.
• Document.
• Offre.
• Contrat.
• Changement de statut.
• Changement de conseiller.
• Transfert Marketplace.
• Recommandation automatique.
• Feedback client.
• Contrôle qualité.
• Commission.
• Paiement.

La timeline du Lead doit ainsi permettre de reconstituer exactement ce qui s’est passé depuis sa création.

Les consultations, questions, demandes de modification, sélections et signatures d’offres réalisées par le client dans Wallet alimentent également cette timeline.

17. Principe UX fondamental

Partner doit être conçu autour de trois niveaux.

Niveau 1 — Dashboard

Que dois-je faire ?

Niveau 2 — Pipeline / Kanban

Où en sont mes affaires ?

Niveau 3 — Lead

Que se passe-t-il exactement avec cette demande ?

Le Client vient ensuite comme vue transverse permettant de répondre à :

> **« Quelle est ma relation complète avec cette personne ? »**

La logique générale devient donc :

Dashboard → Leads → Client → Wallet / Contrats

et non :

Client → énorme dossier contenant toutes les opérations sans distinction.

18. Modèle fonctionnel d’ensemble

CoverView Partner doit fonctionner simultanément comme :

• Plateforme B2B de transmission de Leads.
• Marketplace de Leads.
• Pipeline commercial.
• Kanban.
• CRM opérationnel.
• Gestionnaire de tâches.
• Outil de prise de rendez-vous.
• Outil de collaboration entre partenaires.
• Outil de suivi des commissions.
• Outil de contrôle qualité.
• Outil de suivi des performances.
• Outil de fixation et suivi d’objectifs.

Le Lead constitue l’unité centrale de travail.

Le Client constitue l’unité centrale de relation.

Le Contrat constitue l’unité centrale du patrimoine assurantiel dans Wallet.

La relation est donc :

CLIENT

↓

0..N LEADS / DEMANDES

↓

0..N OFFRES PAR LEAD

↓

0..N CONTRATS

↓

WALLET

Partner gère principalement tout ce qui se déroule entre l’apparition du besoin et sa résolution, ainsi que les tâches de suivi et les opérations économiques qui y restent liées.

Wallet conserve ensuite la vision pérenne du client, de ses contrats et de leur suivi. Il présente également les offres en cours de décision, leurs comparaisons et leur parcours de validation / signature.

L’administrateur CoverView dispose de la vision globale de l’ensemble du réseau et des Leads.

Les conseillers disposent des affaires qui leur sont attribuées et des opportunités volontairement rendues accessibles dans la Marketplace. Les éventuels droits d’apporteur ou de responsable sont explicites, distincts et limités à leur périmètre.

Wallet = patrimoine, contrats, offres et décisions du client.

Partner = Leads, demandes, opportunités, tâches et travail commercial.

Admin = supervision globale du réseau et de son activité.

Un client qui demande simultanément une assurance voiture, une LAMal et un troisième pilier donne donc trois Leads avec trois cycles indépendants, pas un dossier client unique impossible à piloter.

PARTIE III — GESTION DES OFFRES DANS LES LEADS ET AFFICHAGE DANS WALLET

1. Principe général

Les offres commerciales et propositions d’assurance sont rattachées directement au Lead concerné.

Une offre peut provenir de plusieurs sources :

• Générée ou exportée depuis un logiciel d’offre.
• Déposée manuellement par le conseiller.
• Reçue d’un partenaire.
• Reçue directement d’une compagnie.
• Ajoutée depuis un email ou un document.
• Créée depuis un outil CoverView.
• Importée sous forme de PDF ou autre document.

Dès qu’une offre est ajoutée à un Lead, elle devient un objet exploitable dans CoverView.

Le système doit :

1. Conserver le document original.
2. Identifier la compagnie et le produit.
3. Extraire les informations structurées utiles.
4. Rattacher l’offre au bon Lead et au bon client.
5. Analyser ses principales caractéristiques.
6. La comparer aux autres offres du Lead.
7. La comparer, lorsque pertinent, au contrat actuellement détenu par le client.
8. Publier les informations destinées au client dans Wallet.
9. Permettre au client de consulter, comparer et sélectionner une proposition.
10. Permettre ensuite sa validation et, lorsque le parcours le permet, sa signature.

Le fonctionnement global devient ainsi :

Lead → offres reçues → données extraites → analyse CoverView → comparaison → affichage Wallet → choix du client → validation / signature → contrat → ajout au Wallet.

Le Lead n’est pas seulement le suivi commercial : il est aussi le conteneur des offres soumises au client, tandis que Wallet en fournit la vue client lisible, comparable et actionnable.

2. Une offre est un objet distinct du document

Ne pas réduire une offre au PDF qui a été téléchargé.

Chaque offre doit disposer des éléments suivants.

Document source

Le fichier original remis par le conseiller, le partenaire ou l’assureur.

Données structurées

Les éléments identifiés dans l’offre.

Exemples :

• Compagnie.
• Produit.
• Variante.
• Numéro ou référence d’offre.
• Date d’émission.
• Date de validité.
• Prime.
• Fréquence de paiement.
• Franchise.
• Sommes assurées.
• Garanties.
• Prestations.
• Exclusions.
• Limitations.
• Réserves.
• Options.
• Rabais.
• Durée.
• Date d’effet.
• Conditions particulières.
• Frais.
• Informations liées à la résiliation.
• Éventuels éléments nécessitant une vérification.

Les données dépendent naturellement de la catégorie de produit.

Données calculées

CoverView peut compléter les données brutes par des calculs.

Exemples :

• Coût annuel.
• Coût mensuel équivalent.
• Économie par rapport au contrat actuel.
• Différence de prime.
• Différence de couverture.
• Valeur estimée de certains avantages.
• Prestations ajoutées.
• Prestations perdues.
• Franchises comparées.
• Coût sur plusieurs années lorsque pertinent.
• Évolution d’un capital.
• Frais cumulés.
• Indicateurs propres au produit.

Analyse

L’offre peut ensuite recevoir une analyse CoverView permettant d’en expliquer les avantages, inconvénients et différences par rapport aux alternatives.

3. Extraction et validation des informations

Lorsqu’un document est ajouté au Lead, CoverView doit extraire automatiquement les informations disponibles.

L’interface doit distinguer :

• Données extraites avec suffisamment de confiance.
• Données calculées.
• Données ajoutées manuellement.
• Données nécessitant une vérification.
• Données absentes du document.

Le conseiller doit pouvoir vérifier et corriger les informations avant que les éléments sensibles soient considérés comme définitifs.

Le document original reste toujours accessible afin qu’il soit possible de revenir à la source.

Une donnée corrigée ne doit pas modifier le document d’origine.

Les informations incertaines ou absentes ne doivent pas être converties automatiquement en absence de couverture. Les hypothèses et les calculs doivent rester identifiables dans la comparaison.

4. Gestion des offres dans Partner

Ajouter dans la fiche Lead un onglet Offres dédié.

Il doit permettre de :

• Ajouter une nouvelle offre.
• Importer plusieurs offres.
• Voir les offres reçues.
• Identifier leur source.
• Visualiser leur statut.
• Consulter les données extraites.
• Compléter ou corriger les informations.
• Demander une nouvelle version.
• Comparer les offres.
• Marquer une offre comme expirée.
• Remplacer une offre tout en conservant son historique.
• Sélectionner les offres visibles côté client.
• Suivre le choix du client.
• Lancer le processus de validation ou de signature.

Statuts d’une offre

Prévoir notamment :

• Document reçu.
• Extraction en cours.
• À vérifier.
• Prête.
• Publiée dans Wallet.
• Consultée par le client.
• Sélectionnée.
• Refusée.
• Expirée.
• Remplacée.
• À signer.
• Signée.
• Annulée.

Le statut de l’offre est distinct du statut général du Lead : plusieurs offres d’un même Lead peuvent avoir des états différents.

5. Synchronisation avec Wallet

Une offre validée pour présentation au client doit apparaître automatiquement dans le Wallet du client.

Prévoir un espace Offres dans Wallet.

Le client ne doit pas avoir besoin de recevoir plusieurs PDF par email ni de comprendre seul des documents parfois très complexes.

Il doit retrouver ses propositions dans une interface homogène CoverView.

Exemple — Mes offres

Assurance automobile

Vaudoise

CHF 1’280 / an.

Offre reçue le 4 octobre.

Valable jusqu’au 31 octobre.

Baloise

CHF 1’390 / an.

Offre reçue le 5 octobre.

Valable jusqu’au 2 novembre.

Contrat actuel : AXA

CHF 1’510 / an.

Bouton : Comparer les 3.

Ces montants et conditions constituent un exemple d’interface fictif, et non des offres commerciales vérifiées.

L’espace Offres peut regrouper les propositions par Lead, catégorie et objet assuré, afin de ne pas mélanger les offres de plusieurs véhicules, contrats ou demandes simultanées d’un même client.

6. Comparateur d’offres dans Wallet

Le client doit pouvoir comparer plusieurs offres côte à côte.

Le comparateur ne doit pas se limiter au prix.

Il doit permettre de comparer prestation par prestation.

Selon le produit, afficher par exemple :

|Élément                 |Actuel   |Offre A  |Offre B   |
|------------------------|---------|---------|----------|
|Prime annuelle          |CHF 1’510|CHF 1’280|CHF 1’390 |
|Franchise               |CHF 500  |CHF 500  |CHF 500   |
|Collision               |Incluse  |Incluse  |Incluse   |
|Dommages parking        |CHF 2’000|CHF 5’000|Non inclus|
|Assistance Europe       |Oui      |Oui      |Oui       |
|Véhicule de remplacement|3 jours  |7 jours  |5 jours   |

Le tableau ci-dessus illustre la présentation et utilise des données fictives.

Le système doit pouvoir mettre en évidence :

• Prestations identiques.
• Prestations supplémentaires.
• Prestations supprimées.
• Meilleures limites.
• Limites inférieures.
• Exclusions différentes.
• Économies.
• Surcoûts.

Le client doit comprendre immédiatement :

> « Qu’est-ce que je paie ? »

> « Qu’est-ce que j’obtiens ? »

> « Qu’est-ce que je gagne ? »

> « Qu’est-ce que je perds ? »

7. Comparaison avec le contrat actuel

Lorsque Wallet connaît déjà le contrat actuel correspondant au besoin traité dans le Lead, il doit être automatiquement proposé comme référence.

Exemple

Lead : changement d’assurance automobile.

Le système identifie :

Contrat actuel : AXA — véhicule Tesla Model Y.

Les nouvelles offres peuvent alors être comparées directement au contrat AXA.

Le comparateur doit faire apparaître les différences clairement.

Exemples :

• CHF 230 moins cher par année.
• Dommages parking : CHF 5’000 au lieu de CHF 2’000.
• Véhicule de remplacement amélioré.
• Perte de la couverture X.
• Franchise identique.

Le contrat actuel ne doit pas être présenté comme devant nécessairement être remplacé.

Le résultat peut parfaitement être :

> **Votre contrat actuel reste plus intéressant pour votre situation.**

Le rattachement doit concerner le bon contrat et le bon objet assuré, pas simplement un contrat de la même catégorie. En cas de doute entre plusieurs contrats du client, demander une confirmation plutôt que choisir arbitrairement.

8. Comparaison intelligente des prestations

Les noms utilisés par les compagnies peuvent être différents pour des prestations comparables.

Le système doit donc comparer les prestations réellement couvertes, et pas uniquement faire correspondre les libellés textuels.

Exemple

Une compagnie peut utiliser :

• « Assistance mobilité ».

Une autre :

• « Assistance Europe ».

Une autre :

• « Service mobilité Plus ».

Le comparateur doit pouvoir regrouper ces éléments dans une catégorie comparable lorsqu’ils correspondent réellement à un même besoin, tout en conservant les différences de conditions.

Pour chaque prestation, prévoir :

• Catégorie normalisée.
• Description de l’offre.
• Montant ou limite.
• Conditions.
• Exclusions.
• Source dans le document.
• Éventuelle remarque CoverView.

9. Vue simplifiée et vue détaillée

Le client ne doit pas être noyé sous des dizaines de lignes.

Prévoir deux niveaux.

Vue synthétique

Afficher les différences les plus importantes :

• Prix.
• Principales garanties.
• Principaux avantages.
• Principales pertes.
• Exclusions significatives.
• Recommandation ou points d’attention.

Vue détaillée

Permettre ensuite d’ouvrir :

> **Voir toutes les prestations**

et afficher le comparatif complet.

L’objectif est de rendre la comparaison extrêmement rapide tout en conservant la possibilité d’aller dans le détail.

10. Analyse et recommandation CoverView

Au-dessus du tableau brut, CoverView peut afficher une synthèse structurée.

Exemple — Ce qui change avec cette offre

Vous économisez

CHF 230 / année.

Vous améliorez

• Dommages parking.
• Véhicule de remplacement.
• Assistance à l’étranger.

Vous perdez

• Couverture des effets personnels au-delà de CHF X.

À savoir

• Franchise identique.
• Certaines prestations nécessitent les conditions mentionnées dans l’offre.

Cette synthèse doit être liée aux informations effectivement extraites et vérifiées dans les documents. Le contenu de cet exemple est illustratif et n’ajoute pas de garanties absentes des documents d’un dossier réel.

Ne jamais masquer une différence négative uniquement parce qu’une offre est recommandée.

11. Sélection d’une offre par le client

Depuis Wallet, le client peut indiquer qu’une proposition l’intéresse.

Prévoir notamment :

• Choisir cette offre.
• J’ai une question.
• Demander une modification.
• Je préfère conserver mon contrat actuel.

La sélection doit être immédiatement répercutée dans le Lead.

Exemple

> Marc Dupont a sélectionné l’offre Vaudoise à 14:42.

Le conseiller reçoit une notification et le Lead peut évoluer automatiquement vers :

Décision client → Signature en cours.

Cette évolution s’applique lorsque le parcours de signature est effectivement ouvert. Si des informations ou une validation restent nécessaires, le Lead doit rester dans un état correspondant à la prochaine action réelle.

12. Validation avant signature

Avant une signature, présenter un récapitulatif clair :

• Compagnie.
• Produit.
• Prime.
• Principales garanties.
• Date d’effet.
• Durée éventuelle.
• Franchise.
• Informations importantes.
• Documents concernés.

Demander au client de confirmer son choix.

Lorsque le dossier nécessite encore une validation par le conseiller ou la compagnie, ne pas présenter la décision comme une acceptation définitive de la compagnie.

Exemple

> **Vous souhaitez poursuivre avec cette offre. Votre conseiller finalise maintenant le dossier.**

13. Signature depuis Wallet

Lorsque le type d’offre et le parcours le permettent, le client doit pouvoir signer directement depuis Wallet.

Le processus est rattaché à :

• Un client.
• Un Lead.
• Une offre précise.
• Une version précise du document.

Une nouvelle version de l’offre doit empêcher de signer accidentellement l’ancienne version.

Avant signature, afficher les documents qui vont être signés.

Après signature :

1. Enregistrer la date et l’heure.
2. Conserver la version signée.
3. Modifier le statut de l’offre.
4. Modifier la progression du Lead.
5. Notifier le conseiller.
6. Déclencher les éventuelles tâches restantes.
7. Commencer le suivi du contrat.

Le Lead ne doit pas nécessairement être immédiatement considéré comme totalement terminé.

Il peut encore nécessiter :

• Transmission à la compagnie.
• Acceptation par la compagnie.
• Émission de la police.
• Contrôle du contrat final.
• Suivi de la commission.

14. Passage Offre → Contrat

Une offre sélectionnée puis effectivement conclue doit pouvoir être transformée ou reliée à un Contrat Wallet.

Ne pas recréer manuellement toutes les informations déjà connues.

Réutiliser :

• Compagnie.
• Produit.
• Garanties.
• Prestations.
• Prime.
• Dates.
• Documents.
• Informations du client.

Le contrat final émis par la compagnie devient cependant la référence contractuelle.

Si les conditions finales diffèrent de l’offre signée, signaler l’écart et demander un contrôle.

Exemple

> **La prime de la police finale diffère de CHF 42 de l’offre acceptée. Vérification nécessaire.**

Le lien entre le contrat final, le Lead, l’offre retenue et sa version signée doit être conservé.

15. Historique et versions des offres

Une offre peut évoluer avant la signature.

Exemple — Vaudoise automobile

• V1 — CHF 1’330.
• V2 — CHF 1’280 après modification de franchise.

Conserver les deux versions mais présenter clairement la V2 comme version active.

Le comparateur côté client utilise par défaut uniquement les versions actives.

Le conseiller affecté au Lead et l’administrateur peuvent consulter l’historique complet de ses offres.

Une offre précédemment consultée par le client puis modifiée doit apparaître comme mise à jour.

L’exemple de modification de franchise illustre la gestion des versions ; les évolutions de prime et de garanties doivent être décrites à partir des documents réellement reçus.

16. Synchronisation en temps réel du Lead

Les interactions du client dans Wallet doivent alimenter immédiatement Partner.

Dans la timeline du Lead, prévoir des événements tels que :

• Offre publiée dans Wallet.
• Offre consultée.
• Comparateur ouvert.
• Document consulté.
• Client pose une question.
• Client demande une modification.
• Offre sélectionnée.
• Offre refusée.
• Contrat actuel conservé.
• Processus de signature commencé.
• Document signé.

Cela permet au conseiller de comprendre précisément où en est le client et de déterminer sa prochaine action.

Ces événements ne doivent pas être utilisés pour générer des relances excessives.

17. Notifications

Côté client

Informer notamment lorsque :

• Une nouvelle offre est disponible.
• Une offre a été mise à jour.
• Une comparaison est disponible.
• Une offre arrive à expiration.
• Une action est nécessaire.
• Un document est prêt à signer.
• La signature a été enregistrée.

Côté conseiller

Informer notamment lorsque :

• Une offre est consultée.
• Le client pose une question.
• Une modification est demandée.
• Une offre est sélectionnée.
• Une offre est refusée.
• Une signature est réalisée.

Ces notifications doivent respecter le périmètre du Lead, les préférences et les règles de limitation des doublons du centre de notifications.

18. Statistiques liées aux offres

Ajouter aux statistiques Partner :

• Nombre d’offres envoyées.
• Nombre moyen d’offres par Lead.
• Délai moyen entre création du Lead et première offre.
• Délai moyen entre offre et décision.
• Taux d’ouverture des offres.
• Taux de sélection.
• Taux offre → signature.
• Taux de conservation du contrat actuel.
• Offres par compagnie.
• Taux de sélection par compagnie.
• Économies moyennes proposées.
• Différences entre offre et contrat final.

Ces indicateurs doivent pouvoir être filtrés par conseiller, partenaire, catégorie, compagnie, source et période, sans dépasser les permissions de visibilité de l’utilisateur.

19. Interaction avec les objectifs

Permettre également des objectifs tels que :

• X offres préparées.
• X offres présentées.
• X décisions obtenues.
• X signatures.
• Taux offre → signature supérieur à X %.
• Délai moyen de préparation inférieur à X jours.

Le volume d’offres ne doit cependant jamais devenir à lui seul un indicateur de qualité.

20. Modèle fonctionnel final

La chaîne fonctionnelle de CoverView Partner devient :

CLIENT

↓

LEAD / DEMANDE

↓

0..N OFFRES

↓

EXTRACTION + ANALYSE

↓

COMPARAISON AVEC LES AUTRES OFFRES

↓

COMPARAISON AVEC LE CONTRAT ACTUEL

↓

PUBLICATION DANS WALLET

↓

CHOIX CLIENT

↓

VALIDATION

↓

SIGNATURE

↓

ACCEPTATION / ÉMISSION

↓

CONTRAT WALLET

↓

SUIVI + QUALITÉ + COMMISSION

Ainsi, Partner est l’espace de production et de suivi du conseiller, tandis que Wallet est l’espace de compréhension, de comparaison et de décision du client.

Les deux utilisent exactement le même Lead et les mêmes offres sous-jacentes, avec des vues et des droits différents selon l’utilisateur.

Partner n’est donc pas seulement un CRM ou une marketplace : c’est aussi l’endroit où le conseiller construit le dossier qui sera rendu intelligible dans Wallet. Le conseiller travaille avec les documents, offres, tâches et états ; le client reçoit une représentation claire : voici ce que vous avez, voici ce qui vous est proposé, voici les différences, voici ce que vous pouvez choisir et signer.

RÉFÉRENCES DOCUMENTAIRES

Les références ci-dessous sont reprises des briefs précédents pour les points déjà mentionnés sur l’intermédiation, l’information des personnes, les enregistrements et la protection des données. Cette consolidation du brief ne constitue pas une nouvelle vérification juridique de ces sources.

[R1] FINMA — Intermédiation d’assurance. Distinction entre mise à disposition d’informations et activité d’intermédiation.

https://www.finma.ch/fr/autorisation/intermediation-dassurance/

[R2] PFPDT — Devoir d’informer. Information sur la collecte des données, ses finalités et ses destinataires, y compris lors d’une collecte indirecte.

https://www.edoeb.admin.ch/fr/devoir-dinformer

[R3] FINMA — Obligations des intermédiaires d’assurance. Prévention des conflits d’intérêts et transparence des rémunérations.

https://www.finma.ch/fr/surveillance/versicherungsvermittler/pflichten-fuer-versicherungsvermittlerinnen-und–vermittler/

[R4] PFPDT — Enregistrement de conversations. Information des participants, finalités et limites des exceptions applicables.

https://www.edoeb.admin.ch/fr/enregistrement-de-conversations

[R5] PFPDT — Connaître et faire valoir mes droits. Droits des personnes concernées par le traitement de leurs données.

https://www.edoeb.admin.ch/fr/connaitre-et-faire-valoir-mes-droits

[R6] PFPDT — Analyse d’impact relative à la protection des données personnelles. Examen des risques des traitements envisagés.

https://www.edoeb.admin.ch/fr/analyse-dimpact-relative-a-la-protection-des-donnees-personnelles
