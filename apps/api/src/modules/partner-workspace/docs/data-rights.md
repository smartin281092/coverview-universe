# Droits des personnes

C7 du [plan de reprise](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.20 : « prévoir des parcours pour consulter ou rectifier les données […], exercer les droits applicables et comprendre les traitements importants » ; « les scores internes relatifs à des personnes ne doivent pas être considérés comme soustraits à tout droit d'accès » [R5].

Périmètre : les données du programme Partner. S-130 et S-131 restent ouverts pour l'identité, les documents, les demandes d'offre, le compte et les sauvegardes.

## Décision déléguée

`bible.question.006`, périmètre Partner, réponse par défaut du 6 octobre 2026 (PROG-23) :

- matrice v1 par catégorie ;
- copie générée à la demande, sans copie stockée ;
- aucune durée de conservation définie, aucune purge automatique ;
- effacement sur demande, décidé par l'Admin sous MFA.

Elle ne fournit ni durée légale, ni conformité, ni avis juridique (S-137).

## Consulter et exporter (C7a)

| Surface                                                  | Copie                                                                                                                                                                                                                                                                                     | En plus de ce que l'espace montre                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Wallet, compte → « Mes données »                         | Pour soi et ses profils gérés : demandes, rendez-vous, offres, polices finales, propositions de rendez-vous, rendez-vous conjoints, préférences, référents (sans la liste des candidats), communications, qualité, enquêtes, conclusions, mandats, relations, réouvertures, notifications | Coordonnées, contexte, repère d'objet, **provenance** et autorisation de transmission de ses propres demandes            |
| Partner, « Mes données » (aussi pour un membre suspendu) | Adhésion, déclarations et leurs décisions, profil, évaluation et contestations, objectifs, rémunérations                                                                                                                                                                                  | Sa ligne dans chaque **classement de matching** conservé et son **évaluation d'apporteur**, jusqu'ici réservés à l'Admin |

- **Mêmes droits que l'écran.** La copie additionne les lectures que l'espace fait déjà, au même instant : rien n'est réimplémenté.
  - Une section refusée avec les droits courants est déclarée dans le manifeste (`unavailable`). Une borne atteinte l'est aussi (`truncated`, 100 demandes au plus).
  - Toute autre erreur arrête la copie : jamais une copie partielle présentée comme entière.
- **Classement de matching.** La personne voit sa propre ligne seulement : catégorie, date, rang, choisie ou non, première ou non, critères.
  - Ni les autres candidats, ni la demande, ni le motif libre de la décision.
- **Téléchargement.** `POST /{wallet|partner}/data/exports` renvoie le fichier JSON, sans cache.
  - La requête est authentifiée et protégée par CSRF.
  - Six tentatives par heure et par session : la clé de limite est un condensé du cookie de session, pas l'adresse IP.
- **Preuve de traitement.** Chaque copie laisse `partner_data_exports` (migration 0074) :
  - contenu : auteur, session, surface, version du manifeste, compteurs, accès complet ou non ;
  - jamais le contenu de la copie ;
  - la ligne est immuable.
- **Registre des traitements** `partner-data-register-v2` (v2 depuis C8 : décisions d'habilitation dans la catégorie adhésion).
  - Pour chaque catégorie : finalité, destinataires, provenance et durée. La durée est toujours « non définie, à valider ».
  - Il nomme les traitements automatisés (orientation non validée, matching expliqué, réattribution bornée) et le responsable.
  - Il est affiché dans un panneau latéral et écrit dans chaque copie : en français dans le fichier (INTL-06), par les catalogues dans les écrans.

## Demandes relatives aux données (C7b)

- **Dépôt.**
  - Types : rectification, effacement, accès complet (Wallet seulement), autre (opposition, limitation, question).
  - Un message de 10 à 2000 caractères, une catégorie et une demande de conseil facultatives. La demande de conseil doit être visible du demandeur et de même sujet.
  - Cinq demandes ouvertes au plus par personne ; une demande identique n'est pas déposée deux fois ; retrait possible tant qu'aucune réponse n'est donnée.
- **Traitement** dans Admin, « Droits des personnes » :
  - file des demandes ouvertes, la plus ancienne d'abord ;
  - prise en charge, puis réponse motivée, que la personne lit dans « Mes données ».

| Type                     | Issues possibles à la main                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Rectification            | faite, partiellement faite, refusée (la correction elle-même passe par les parcours existants) |
| Effacement Wallet        | refusée ; « faite » n'existe que par l'exécution (C7c)                                         |
| Effacement professionnel | répondue, refusée : aucun outil ne l'exécute                                                   |
| Accès complet            | accordé (14 jours), refusé                                                                     |
| Autre                    | répondue, refusée                                                                              |

- **Accès complet accordé.** Pendant 14 jours, la copie Wallet du demandeur inclut, pour ce sujet seulement, les notes internes, les tâches et le journal complet de ses demandes. Le manifeste indique `complete`.
- **Données.** `partner_data_requests` (migration 0075) :
  - transitions en avant, une révision par changement, figée après réponse ou retrait, jamais supprimée ;
  - des contraintes lient les issues aux types.
- **Pas de notification.** `partner_notifications` exige un Lead : la réponse se lit dans « Mes données », et la file Admin donne le nombre de demandes à traiter.

## Effacement contrôlé (C7c)

1. **Aperçu.** `GET /admin/partner/data-requests/:id/erasure` liste les demandes du sujet non encore effacées. Pour chacune :
   - **en cours** : bloque l'exécution, à clôturer d'abord ;
   - **conservée**, avec ses motifs ;
   - **effaçable**.

   | Motif de conservation        | Fait constaté                                                               |
   | ---------------------------- | --------------------------------------------------------------------------- |
   | contrat ou signature         | conclusion active, signature, police finale                                 |
   | droits économiques ou mandat | réservation marketplace                                                     |
   | réclamation ouverte          | réclamation non invalidée et non close                                      |
   | contestation en cours        | contestation sans décision d'une enquête ou d'une réclamation de la demande |
   - Un profil géré transféré, ou plus de 100 demandes, bloque aussi l'exécution.
   - L'aperçu nomme ce qui restera conservé.

2. **Exécution.** `POST` du même chemin. Conditions :
   - l'Admin sous MFA ;
   - une clé d'idempotence ;
   - l'empreinte de l'aperçu, recalculée sur des lignes verrouillées ;
   - une attestation : « aucune autre obligation de conservation ne s'applique » ;
   - la réponse destinée à la personne.

   Pour chaque demande effaçable, en une transaction :
   - **Champs effacés** : coordonnées, contexte, repère d'objet, source, objet, prochaine action et textes du journal.
   - **Marqueur neutre** dans les champs obligatoires : « Demande effacée », « Client effacé », « Tâche effacée », « Lieu effacé ».
   - **Données de la demande d'offre** importées : réduites aux identifiants exigés par leur contrainte.
   - **Email d'invitation** : remplacé par `erased@coverview.invalid`.
     - La garde de l'invitation n'admet cette seule modification que si la variable de transaction `coverview.partner_erasure` est posée (migration 0076).
     - Hors effacement, l'adresse reste immuable.
   - **Suppressions** : préférences de conseil, notifications Wallet et leurs lectures.
   - **Lien** : le lien avec le compte et le profil est rompu, `client_erased_at` est daté et la demande d'effacement est référencée.
   - **Référents** du sujet : supprimés si aucune demande conservée ne le concerne.
   - La demande est répondue « faite » ou « partiellement faite », avec un résumé : compteurs et demandes conservées avec leurs motifs, sans contenu.

3. **Effets en chaîne.** Les déclencheurs existants de changement de client invalident les enquêtes, réclamations, préférences de communication et enregistrements de ces demandes : ils ne comptent plus dans les évaluations.
4. **Ce qui reste**, dit dans l'aperçu, la réponse et Wallet :
   - **Preuves protégées par les gardes**, telles quelles et avec leurs références au compte (auteur, propriétaire) :
     - journal des actions, sans ses textes ;
     - propositions de rendez-vous et comptes rendus ;
     - enregistrements, transcriptions, enquêtes et réclamations ;
     - recommandations, analyses professionnelles et classements.
   - **Documents de l'espace** utilisés comme sources : toujours marqués liés.
   - **Demande d'offre d'origine et compte** : ils relèvent de S-131. Tant que le compte existe, ses références restent rattachables.
5. **Pas de purge automatique** : aucune durée n'est définie.

## Écart assumé

Pas de RLS (DATA-09 DEVRAIT), comme dans tout le projet. Des tests d'isolation couvrent chaque nouvelle lecture : autre client, profil transféré, autre professionnel, session révoquée, autre surface.

## Preuves

`apps/api/src/platform/partner-data-rights.test.ts`, PostgreSQL réel :

- la copie Wallet, profil géré et provenance compris, sans rien d'un autre client ;
- le transfert d'un profil ;
- la preuve immuable ;
- les refus : session révoquée, autre surface ;
- les scores internes, la personne seulement ;
- en HTTP réel, avec un double du fournisseur d'identité : CSRF, absence de cache, quota par session sans pénaliser un voisin ;
- le cycle des demandes, avec l'accès complet qui ouvre les notes internes ;
- l'effacement :
  - aperçu, blocage et motif de conservation ;
  - empreinte périmée refusée et rejeu idempotent ;
  - effets en base ;
  - garde de l'invitation intacte hors effacement.
