# Plan — Partner : intégration, activation et fonctions restantes

> Statut : **approuvé** — réponses utilisateur du 4 octobre 2026 : « 1a 2a 3b ». diff_from : [lot 4/4](partner-conclusion-integration.plan.md), interrompu le 4 octobre à 01h30.
> **Session requise** : Claude Code, Claude Opus 5.5, effort max. La reprise quitte la chaîne de relais Codex (décision 1a).
> **Session réelle** : Claude Code, Claude Opus 5.5, effort max (C1 à C6 le 4 octobre 2026, C7 et C8 le 6 octobre 2026).
> **Budget** : plusieurs sessions. Une phase livrée est commitée sur `claude/partner-integration` avant la suivante.

## Décisions acquises (réponses aux questions bloquantes du bilan du 4 octobre)

1. **1a — Reprise et intégration.** Le WIP du worktree Codex `9783` est rapatrié, commité sur une branche dédiée et fusionné avec `D:\Projects`. Plus de relais Codex : le travail continue dans ce dépôt.
2. **2a — Matching.** Le système classe les intervenants à partir des déclarations **validées par l'Admin** (compétences, conventions, langues, zones, disponibilités, capacité, conflits). Il explique chaque proposition. Un humain décide, et tout écart avec la proposition est motivé et tracé. L'appréciation personnelle et la distribution favorable restent des dossiers distincts.
3. **3b — Priorité.** Après l'intégration, les fonctions manquantes passent avant la recette réelle et la simplification UX.

## Objectif

Rendre tout le [brief I–III](../../references/coverview-partner-2026-10-02.md) disponible dans une seule branche intégrée, activée sur la base locale. Les reliquats fonctionnels doivent être codés et vérifiés avant la recette réelle avec l'utilisateur.

## Phases

### A — Sécuriser, fusionner, activer

- [x] Commits de plomberie, sans toucher aux fichiers. Snapshot du 2 octobre (`claude/partner-snapshot-20261002`), chaîne des 17 états de relais (`claude/partner-program`), travail source du 2–3 octobre (`claude/partner-integration`, parents snapshot + `97ce34b`). Arbres comparés à leurs sources : 0 écart.
- [x] Fusion à trois voies sur la base exacte. Seule la métadonnée Drizzle était en conflit : deux migrations 0029.
- [x] Catalogue unifié 0000–0065. Les migrations `drizzle-pending` 0049–0064 sont intégrées à l'octet près. La migration santé devient `0065_bumpy_mentallo` et conserve son horodatage déjà enregistré en base locale. Les 16 tests qui assemblaient un catalogue temporaire migrent désormais le catalogue normal.
- [x] Vérification cumulée. Lint complet vert. Premier passage de la suite complète : 733/744. Huit échecs venaient de deadlocks entre déclencheurs de profil et chemins Partner (corrigés à la source par 0066 et le mappage 409), deux d'attentes figées sur l'état « en attente » (alignées), un d'un bug de configuration préexistant (corrigé, G-07). Second passage : **72/72 fichiers, 744/744 tests**.
- [x] Sauvegarde `pg_dump` (28,5 Mo, `.planning-local/backups/`, ignoré par Git), puis migration de la base locale : 47 → 67 migrations, 28 → 70 tables Partner. 0065 était déjà enregistrée, aucune entrée sautée.
- [x] Avance rapide de `D:\Projects` sur la fusion (`f0a3813`). L'API de preview a rechargé, `/health` répond `ready`. Documents propriétaires mis à jour : les mentions « hors catalogue » sont déclarées historiques.

### C — Fonctions restantes, dans l'ordre

1. **Matching système et réattribution automatique bornée** (I.10.2–10.4, I.11.3, II.9). Classement expliqué depuis les déclarations validées, exclusion des conflits déclarés, départage par choix client, capacité et répartition, rémunération exclue. Écart manuel motivé. Après 24 h sans action utile : proposition au candidat suivant, nombre maximal configuré, puis reprise humaine CoverView. — *Livré le 4 octobre (`c9998c9`, `641d3ef`), V0–V2 : suite complète 748/748.*
2. **Profils publics et évaluations** (I.18, I.12) : profil publiable, trois dimensions séparées, note avec période, volume et méthode, prudence à faible volume, contestation, évaluation des apporteurs. — *Livré le 4 octobre, V0–V2 : suite complète 74/74 fichiers, 751/751 tests. Photo de profil et profil d’organisation reportés en C8 (C2b).*
3. **Wallet d'un nouveau client** (I.6.2, scénario 3) : espace préparé, invitation et activation encadrées, sans révélation ni consentement implicite. Traitement des emails erronés et des adresses partagées. — *Livré le 4 octobre, V0–V2 et envoi Mailpit réel ; parcours Wallet avec un vrai compte WorkOS en phase B.*
4. **Comparaison** (I.13, III.7–10) : catégories de prestations normalisées, proposition automatique du contrat actuel quand l'objet est identifiable (confirmation sinon), orientation initiale automatique distincte de la recommandation finale, spécificités prévoyance. — *C4a livré le 4 octobre (prestations normalisées, montants structurés, matrice serveur), C4b livré le 4 octobre (orientation automatique, recommandation validée, analyse incomplète), C4c livré le 4 octobre (termes de prévoyance sourcés, contrat actuel proposé sur repère exact), V0–V2.*
5. **Pilotage quotidien** (I.7, II.6/10/14) : vues d'équipe et prédéfinies, indicateurs de carte, dashboard Admin complet. — *C5a livré le 4 octobre (vues, filtres, tri, compteurs, vues partagées), C5b et C5c livrés le 4 octobre (indicateurs de carte, pilotage du réseau Admin), V0–V2.*
6. **Temps réel et agenda** (III.16, I.12, I.21) : diffusion Partner↔Wallet, rendez-vous conjoint, rentabilité CoverView si ses données existent. — *C6a livré le 4 octobre (flux SSE Partner et Wallet, audience décidée à chaque envoi, resynchronisation), V0–V2 dont flux HTTP réel. C6b livré le 4 octobre (rendez-vous conjoint : invitation Wallet, confirmation par le spécialiste, temps protégé en base), V0–V2. C6c livré le 4 octobre (recettes CoverView au pilotage du réseau, réseau et branches, même calcul que les statistiques ; coûts non saisis, rentabilité non calculée), V0–V2.*
7. **Droits des personnes** (I.20, S-130/S-131) : export, rectification, conservation et suppression contrôlée, cloisonnement en base. Aucune durée légale inventée.
   - *C7a, livré le 6 octobre* : « Mes données » Wallet et Partner, scores internes R5, preuve de copie.
   - *C7b* : demandes de rectification, d'effacement, d'accès complet ou autres, répondues par l'Admin.
   - *C7c* : effacement contrôlé de la couche d'identification, preuves conservées et déclarées.
   - Vérification V0–V2, dont un HTTP réel.
   - Pas de RLS : écart assumé, comme dans tout le projet. Aucune durée et aucune purge (S-131).
8. **Reliquats** (entrée le 6 octobre) : gestion d'équipe du responsable, restrictions fines et réexamens automatiques (I.4), contrat non déclaré signalé par le client (I.17.2), audit incomplet → demande de complément (I.13), plus la photo et le profil d'organisation reportés de C2.
   - *C8a, livré le 6 octobre (`4e0616c`)* : habilitations (journal des décisions, organisation validée à part, restrictions, réexamens automatiques, file Admin).
   - *C8b, livré le 6 octobre (`c67b06f`)* : équipe du responsable (invitation, page Équipe, fin d'adhésion, réattribution dans l'équipe).
   - *C8c, livré le 6 octobre (`a78ff26`)* : photo de profil et profil d'organisation.
   - *C8d, livré le 6 octobre* : contrat non déclaré signalé par le client (déclarations, vérification interne, rapprochement, issue, file dédiée).
   - *C8e* : analyse incomplète → demande de complément au client.
   - Correctif préalable, G-07 : l'action de notification `review_participation` (C6b) manquait au contrat.

#### C1 — Conception retenue (avant code)

- **Candidats.** Conseillers approuvés de la catégorie : organisation approuvée, rôle conseiller, réexamen non échu, accès non révoqué. Au plus 100 candidats sont évalués. Le responsable courant est exclu, et pour une réattribution automatique, tous les responsables de la chaîne automatique aussi.
- **Éligibilité (sinon exclu, avec le motif compté).**
  - compétence examinée et valide (`reviewed` ou `limited`) ;
  - convention examinée et valide pour la catégorie ;
  - langue ou canton qui ne diffèrent pas d'un souhait client confirmé ;
  - pas d'absence déclarée en cours ;
  - capacité déclarée différente de « indisponible ».
  - Une donnée manquante reste « à confirmer » : elle n'exclut pas, mais elle classe plus bas et elle est signalée.
- **Classement lexicographique, explicable et sans aucune donnée économique.**
  1. référent confirmé du client pour la catégorie ;
  2. nombre de critères client concordants (langue, zone, mode), puis nombre d'inconnues ;
  3. compétence de catégorie avant compétence limitée ;
  4. disponibilité déclarée dans les 14 jours ;
  5. capacité ouverte, puis au cas par cas ;
  6. charge observée la plus faible ;
  7. moins d'attributions sur 30 jours ;
  8. identifiant, pour un ordre stable.
- **Restitution.** `GET /partner/leads/:id/matching`, réservé à l'Admin avec MFA : rang, critères, raisons et réserves sous forme de clés i18n, compteurs d'exclusion. Aucune donnée privée en texte libre. Sans candidat éligible, aucun « meilleur conseiller » n'est affiché : la file CoverView est proposée.
- **Décision humaine.**
  - La commande `assign` accepte un `matchingBasis` facultatif ; un classement périmé renvoie `409`.
  - Le motif, déjà obligatoire, devient le motif d'écart quand le choix n'est pas le premier éligible.
  - Une décision immuable conserve le classement (10 premiers), les exclusions, le choix, le rang et l'indicateur d'écart.
- **Réattribution automatique bornée.** La politique de continuité ajoute `automaticReassignments` (0–3, défaut 1). À l'échéance non justifiée, ou après perte d'habilitation, le worker propose le dossier au premier éligible si le quota n'est pas atteint depuis la dernière décision humaine. Le candidat doit accepter : c'est la décision humaine de l'intervenant. Sinon, reprise humaine CoverView comme aujourd'hui. Décision de type `automatic` et notifications existantes.

#### C2 — Conception retenue (avant code)

- **Profil publiable par version.**
  - Présentation libre bornée et photo facultative ; la photo passe par le circuit documentaire des preuves professionnelles (antivirus, finalité `partner_profile_photo`, images seulement).
  - Le reste vient des sources déjà validées : spécialités (compétences examinées), langues et cantons (pratique déclarée), modes de rendez-vous.
  - Soumission par le membre, examen Admin avec MFA (publication ou refus motivé), historique immuable. Une modification crée une nouvelle version à examiner ; la version publiée précédente reste affichée jusque-là.
- **Évaluations calculées à la lecture, en trois dimensions séparées.**
  - Expérience client : notes 1 à 5 des enquêtes de fin de demande, attribuées au responsable au moment de la clôture par une table d'attribution que remplit un déclencheur.
  - Qualité opérationnelle : prise en charge dans le délai, réclamations examinées, suivi documenté.
  - Fiabilité économique : dossiers, contestations, reprises du lot 2.
  - Période glissante de 12 mois, volume et méthode affichés. La note publique n'apparaît qu'à partir de 5 avis ; sinon « pas encore assez d'avis ». Une conversion n'est jamais comptée comme qualité.
- **Audiences.** Profil publié et note publique : Wallet (interlocuteur, propositions), membres Partner, Admin. Dimensions internes : la personne elle-même (droit d'accès, R5) et l'Admin ; la fiabilité économique est réservée à cette personne et à l'Admin.
- **Contestation.** La personne conteste un élément précis (enquête, réclamation) avec un motif. L'Admin accepte ou refuse avec un motif. Un élément accepté sort du calcul, avec trace.
- **Apporteurs.** Évaluation interne pour l'Admin : demandes transmises, doublons et demandes invalides, autorisation de transmission, écarts entre besoin annoncé et réalité constatée.

#### C3 — Conception retenue (avant code)

- **Invitation.** Une invitation Wallet se prépare sur une demande au contact non rattaché qui porte un email : par l'Admin, ou par le responsable courant s'il a le droit de contact (jamais par un simple apporteur).
  - Le serveur ne dit jamais si l'adresse correspond déjà à un compte : la même invitation part dans tous les cas.
  - Jeton aléatoire stocké haché, validité de 14 jours, une seule invitation active par demande.
  - Annulation et nouvel envoi après correction d'un email erroné.
- **Envoi.** Adaptateur d'envoi : Mailpit par son API HTTP en mode local (`EXTERNAL_ADAPTER_MODE=local`). Sinon, l'invitation reste « préparée, non envoyée, aucun fournisseur configuré ». Aucun faux envoi, aucun lien transmis par un autre canal.
- **Information.** Le message et l'écran d'acceptation présentent la notice versionnée `client-invitation-notice-v1` : auteur de la collecte, finalités, destinataires, droits (collecte indirecte, PFPDT).
- **Activation.** Le client ouvre `/activation` ; le jeton passe du fragment de l'URL au `sessionStorage`. Il s'authentifie avec WorkOS (continuation « activation »). Le serveur vérifie le jeton et l'égalité de l'email vérifié du compte avec celui de l'invitation.
  - « Cette demande me concerne » rattache la demande au compte (sujet personnel) ; « Elle ne me concerne pas » la laisse non rattachée et prévient le responsable.
  - Ni mandat, ni consentement marketing, ni fusion de membres d'un ménage n'est déduit.

#### C4 — Conception retenue (avant code)

Découpage en trois sous-étapes, chacune commitée avec ses tests : **C4a** prestations normalisées et comparateur, **C4b** orientation automatique et recommandation validée, **C4c** prévoyance et contrat actuel proposé.

**Conflit signalé et arbitré.** Le relais 175f (défaut délégué PROG-23) exclut « toute recommandation automatique et toute déduction numérique de meilleure couverture ». Le brief I.13 et III.6–10, instruction de l'utilisateur, demande une orientation initiale automatique et la mise en évidence des meilleures et moindres limites. Le brief prime. Les garde-fous de 175f sont conservés :

- l'orientation est factuelle et bornée aux éléments vérifiés et sourcés ;
- la comparaison numérique n'utilise que des montants structurés, vérifiés, sourcés, de même unité et de même période ;
- une valeur libre différente reste « modifiée », sans promesse d'équivalence ;
- absence et incertitude restent distinctes de l'exclusion.

**C4a — Prestations normalisées et comparateur.**

- Référentiel versionné `benefit-catalog-v1` dans les contrats. Il définit des catégories normalisées par catégorie de besoin, chacune avec un mode de comparaison :
  - couverture incluse ou exclue ;
  - limite, où le montant le plus haut est le meilleur ;
  - franchise, où le montant le plus bas est le meilleur ;
  - durée en jours ;
  - texte, sans comparaison numérique.
- Une prestation (offre ou revue du contrat actuel) reçoit, de façon additive, une catégorie normalisée et un montant structuré facultatif `{ valeur, unité CHF/jours/%, période événement/année/total }`. Le libellé de la compagnie, la valeur libre, les conditions, les exclusions et la source restent inchangés.
- La catégorie est suggérée depuis le libellé par un dictionnaire déterministe ; l'intervenant la confirme ou la corrige à la revue. Les anciennes clés sont reprises par une table de correspondance, et « autre » reste regroupé par libellé normalisé.
- Une seule comparaison, calculée par le serveur :
  - colonnes : le contrat actuel relié et revu, puis les versions actives comparables ;
  - lignes : les catégories normalisées ;
  - états par cellule face à la référence : identique, ajoutée (exclusion vérifiée → inclusion vérifiée), retirée, meilleure limite, limite inférieure, exclusions différentes, modifiée, à vérifier, absente.
- Synthèse par offre — « je paie, j'obtiens, je gagne, je perds » : différence annuelle vérifiée, gains et pertes toujours affichés ensemble, exclusions différentes, points à vérifier.
- Wallet : tableau unique, contrat actuel compris, en vue synthétique avec « Voir toutes les prestations ». Partner : le même tableau en lecture. Le regroupement côté client par libellé disparaît.

**C4b — Orientation automatique et recommandation validée.**

- Orientation `orientation-v1`, calculée à la lecture et jamais enregistrée comme une décision.
  - Par offre :
    - incomplète : prime ou prestation décisive non vérifiée ;
    - avantageuse : pas plus chère, aucune perte vérifiée, au moins une économie ou un gain ;
    - maintien préférable : pas moins chère et sans aucun gain vérifié ;
    - arbitrage : tous les autres cas.
  - Synthèse du dossier. Sans contrat actuel relié, la comparaison porte entre offres et ne conclut jamais au maintien.
- Libellé constant « Orientation automatique, non validée ». Transparence affichée :
  - données utilisées et date de revue ;
  - originaux (version, page) ;
  - hypothèses (annualisation) ;
  - informations manquantes ;
  - périmètre de marché (« offres reçues dans ce dossier ») ;
  - distinction entre marché, accessible et distribuable, reprise des contrôles de `solution-evidence` : admission et droits de distribution non établis par défaut.
- Recommandation finale de l'intervenant, en version immuable : offre et version précises, maintien du contrat actuel, ou aucune.
  - Elle porte un motif et des points d'attention ; un écart avec l'orientation exige un motif d'écart.
  - Elle est publiée explicitement dans Wallet avec son auteur et sa date.
  - Une nouvelle version d'offre ou une nouvelle revue du contrat actuel la rend « à revoir ».
- Une analyse incomplète ou contradictoire crée une tâche « Compléter l'analyse » et une notification au responsable. Rien de conditionnel n'est présenté comme certain.

**C4c — Prévoyance et contrat actuel proposé.**

- Bloc prévoyance structuré, chaque valeur sourcée et vérifiée :
  - horizon ;
  - versements (montant, fréquence) ;
  - frais d'entrée, de gestion et de sortie ;
  - valeurs de rachat par année ;
  - capital garanti ;
  - décès et libération du paiement des primes ;
  - stratégie de placement ;
  - conséquences d'un remplacement : valeur de rachat actuelle et perte, nouveaux délais, questionnaire de santé.
- Contrat actuel proposé :
  - correspondance entre catégorie de besoin et domaines d'assurance ;
  - la demande peut porter un repère d'objet (numéro de police actuel, plaque, objet assuré) ;
  - une seule police du profil exact, de domaine compatible et de repère identique, est présélectionnée avec sa raison ;
  - sinon, rien n'est présélectionné et la liste est triée ;
  - la confirmation du propriétaire (même objet, partage) reste toujours requise.

#### C6 — Conception retenue (avant code)

Découpage en trois sous-étapes commitées séparément : **C6a** diffusion immédiate Partner ↔ Wallet, **C6b** rendez-vous conjoint, **C6c** rentabilité CoverView.

**C6a — Diffusion immédiate (brief III.16, I.12 « répercutée dans Wallet et Partner »).**

- **Transport : SSE** (RT-01, invalidation unidirectionnelle) sur `GET /partner/live` et `GET /wallet/live`.
  - Authentification par la session du surface, contrôle d'hôte, Admin sous MFA comme les autres routes Partner.
  - Limites : 4 flux par utilisateur, 512 au total (RT-18).
  - La session est revérifiée chaque minute : un flux révoqué se ferme (RT-11).
- **Source.** Des déclencheurs `pg_notify` sur `partner_events` (Lead changé) et `partner_notifications` (centre de notifications) suivent la validation de la transaction. Un auditeur `LISTEN` par instance d'API alimente un hub en mémoire. Aucun broker ajouté (ARCH-04).
- **Audience** (RT-07, RT-10). Le producteur ne choisit rien.
  - Pour chaque Lead changé, regroupé sur 250 ms, le hub vérifie pour chaque connexion la visibilité réelle (`visible(actor)`) avant d'envoyer quoi que ce soit.
  - Une notification n'atteint que son destinataire, ou les administrateurs pour l'audience CoverView.
- **Contrat public minimal** (RT-09, RT-16) :
  - `lead.changed.v1 { leadId, at }` et `notifications.changed.v1 { at }`, avec un identifiant de séquence par flux ;
  - jamais le contenu du dossier : le client relit par l'API avec ses propres droits.
- **Clients.** Partner et Wallet ouvrent un `EventSource`.
  - À chaque événement, ils invalident les requêtes du Lead, des listes et des notifications.
  - À la reconnexion, ils resynchronisent tout (RT-14).
  - Le rafraîchissement périodique existant reste le filet de sécurité.

**C6b — Rendez-vous conjoint (brief I.12).**

La lecture du module montre que deux des trois volets de I.12 existent déjà :

- « plusieurs rendez-vous coordonnés » : la réservation Wallet coordonnée (2 à 5 propositions de conseillers différents, créneaux disjoints, une seule transaction) ;
- « relié aux Leads concernés » : les liens de rendez-vous (jusqu'à 9 Leads du même client, pour le même conseiller).

Il manque **un même rendez-vous réunissant plusieurs spécialistes**. Conception retenue :

- **Initiative du client, depuis Wallet.** Sur un rendez-vous futur planifié, le client invite le conseiller d'une autre de ses demandes ouvertes, pour le même sujet (lui-même ou le même profil géré).
  - L'invité est le responsable de cette demande, ou un contributeur avec droits de conseil et de contact, habilité dans sa catégorie.
  - Aucun professionnel n'apprend l'existence d'une autre demande sans ce geste du client. Chacun ne voit que le nom et l'organisation des autres, jamais le contenu de l'autre demande.
  - Aucune sollicitation automatique : une invitation par geste du client, au plus 3 spécialistes invités par rendez-vous, aucune nouvelle invitation du même professionnel après un refus pour ce rendez-vous.
- **Réalisable.** L'invitation n'est possible que si l'invité paraît disponible : disponibilité déclarée couvrant le créneau, aucun engagement protégé en conflit. Le client n'en voit qu'un oui/non ; sinon Wallet l'oriente vers les rendez-vous coordonnés existants.
- **Consentement du spécialiste.** L'invité confirme en saisissant sa préparation et ses déplacements (zéro pour téléphone et visio), avec les attestations de ses propres rendez-vous. La protection horaire est revérifiée à la confirmation. Il peut refuser.
- **Effets de la confirmation.**
  - Le temps de l'invité est protégé par la garde en base des conseillers principaux, étendue aux participations : deux engagements du même professionnel ne peuvent plus se chevaucher, qu'il soit hôte ou participant.
  - La demande de l'invité passe en « rendez-vous planifié » avec sa propre prochaine action ; son cycle reste indépendant.
  - L'hôte, le client et l'invité voient le rendez-vous conjoint et l'état de chaque participation.
- **Changements sans contradiction.**
  - Annulation du rendez-vous, par le client, l'hôte ou une reprise du dossier : toutes les participations prennent fin, et chaque demande concernée revient à « rendez-vous à planifier » si rien d'autre n'est prévu.
  - Report par l'hôte : une participation confirmée devient « à reconfirmer ». Sa protection horaire ne vaut plus que pour les termes confirmés (révision des termes du rendez-vous).
  - Retrait de l'invité avant le début : sa demande revient à « rendez-vous à planifier », l'hôte et le client sont avertis.
  - Perte d'accès de l'invité à sa demande : sa participation prend fin.
- **Issue.** Chaque spécialiste consigne l'issue pour sa propre demande : l'hôte par la commande existante, l'invité sur sa participation.
- **Agenda.** L'agenda Partner de l'invité montre ses participations, à confirmer ou confirmées ; le détail de sa demande les affiche aussi.
- **Données.** Une table additive `partner_appointment_participants` porte :
  - le rendez-vous, la demande de l'invité et le professionnel ;
  - l'état, la révision des termes acceptés, les tampons, les attestations et l'issue.
  - Unicité : une participation active par rendez-vous et par professionnel, et par demande.
- **Rendu différé.** L'invitation par l'hôte d'un contributeur de sa propre demande et le report conjoint en une seule opération sont reportés : annuler puis réserver à nouveau reste possible.

**C6c — Rentabilité CoverView (I.21).**

- Le revenu CoverView existe pour les affaires Marketplace (`coverview_revenue`). Il est affiché au pilotage du réseau par période, pour le réseau et par branche. Le détail par Lead et par partenaire reste dans les statistiques (périmètre organisation), ouvertes depuis l'aperçu avec la même période.
- Aucune donnée de coûts n'existe : la rentabilité n'est pas calculée et l'interface le dit. Aucun coût n'est supposé.

#### C7 — Conception retenue (avant code)

Entrée de tranche le 6 octobre 2026, instruction « Continue avec C7 ». Session réelle : Claude Code, Claude Opus 5.5, effort max.

Découpage en trois sous-étapes commitées séparément :
- **C7a** consulter et exporter ses données, scores internes (R5) ;
- **C7b** demandes relatives aux données ;
- **C7c** effacement contrôlé.

Périmètre : le programme Partner seul. S-130 et S-131 restent ouverts pour le reste de la plateforme (identité, documents, demandes d'offre, conversations hors Partner, sauvegardes).

**Décision déléguée (PROG-23)**
- **ref** : `bible.question.006`, périmètre Partner.
- **question** : matrice d'export et de conservation des données Partner.
- **answer** : matrice v1 par catégorie.
  - Libre-service : ce que l'espace montre déjà, plus, pour ses propres demandes, les coordonnées, le contexte transmis et la provenance.
  - Notes et tâches internes des intervenants : par une demande d'accès complet examinée par CoverView.
  - Téléchargement authentifié, généré à la demande, sans copie stockée.
  - Conservation : aucune durée définie, purge automatique non activée.
  - Effacement : sur demande, décidé par l'Admin sous MFA après aperçu, preuves et droits économiques conservés et déclarés.
- **evidence** :
  - brief I.20 et [R5] ;
  - défauts de S-130 et S-131 ;
  - LAUNCH-03 et DATA-14 ;
  - l'existant :
    - aucun export, aucune demande suivie, aucun effacement Partner ;
    - stockage objet chiffré par l'application, donc aucune URL présignée possible ;
    - un téléchargement de document déjà servi par l'API et audité.

Cette décision ne fournit ni durée légale, ni conformité, ni avis juridique : la politique de conservation reste à faire valider avant toute purge (S-131, S-137).

**Écart assumé : pas de cloisonnement en base (RLS) dans C7.**
- Le projet entier écarte RLS (DEVRAIT DATA-09, justifié à S-000b et dans le module identité). La visibilité Partner est une seule politique SQL (`partner.policy.ts`), injectée dans toutes les lectures.
- Un RLS utile exigerait un rôle d'exécution distinct et un contexte par requête sur 78 tables et environ 31 000 lignes. Un RLS partiel donnerait une fausse assurance.
- C7 ajoute à la place des tests d'isolation sur chaque nouvelle lecture : autre client, profil transféré, autre professionnel, session révoquée.
- RLS reste une tranche transverse à part.

**C7a — Consulter et exporter ses données.**
- **Registre des traitements v1** dans les contrats. Il est affiché dans Wallet et Partner et repris dans chaque export. Par catégorie : finalité, destinataires, provenance, durée.
  - La durée est toujours « non définie, politique à valider ».
  - Il liste aussi les traitements automatisés existants (`orientation-v1`, matching expliqué, réattribution automatique bornée), le responsable (CoverView Sàrl) et le moyen d'exercer ses droits.
  - Faits du produit, pas un texte juridique.
- **Wallet, « Mes données »** (onglet du compte), pour soi et ses profils gérés :
  - les compteurs par catégorie et le registre ;
  - l'export JSON lisible par machine.
- **Contenu de l'export Wallet** : la composition des lectures Wallet existantes, avec exactement les mêmes droits.
  - Par demande : le détail Wallet, l'historique des offres, les polices finales, les propositions de rendez-vous, les communications, la qualité et les enquêtes.
  - En plus : le bloc « coordonnées et provenance » de ses propres demandes (email, téléphone, langue, contexte, repère d'objet, source, autorisation de transmission). Ce bloc est aujourd'hui masqué au client.
  - Puis les préférences, les référents et les notifications.
  - Bornes : 100 demandes au plus, chaque liste à sa borne existante. Une troncature est déclarée dans le manifeste, jamais silencieuse.
- **Partner, « Mes données »** du professionnel, et export :
  - candidature et adhésion, déclarations et décisions les concernant, profil public, évaluations et contestations ;
  - **les scores internes jusqu'ici réservés à l'Admin** (R5) : leur ligne dans chaque classement de matching (rang, critères, réserves, exclusion et motif, choisi ou non, sans les autres candidats ni le contenu du dossier), et leur évaluation d'apporteur.
- **Téléchargement** :
  - session authentifiée de la surface et contrôle de l'hôte ;
  - généré à la demande, sans copie stockée, en pièce jointe sans cache ;
  - limité à 6 par heure ;
  - chaque export laisse une **preuve de traitement** immuable `partner_data_exports` : auteur, session, surface, version du manifeste, sujets, compteurs, accès complet ou non. Aucun contenu.

**C7b — Demandes relatives aux données.**
- **Types et dépôt** : rectification, effacement, accès complet ou autre (opposition, limitation, question), déposés depuis Wallet (pour soi ou un profil géré) ou depuis Partner (pour soi).
  - Le dépôt porte : catégorie de la matrice, demande concernée facultative (visible par le demandeur et du même sujet), message de 2000 caractères au plus.
  - 5 demandes ouvertes au plus par personne ; retrait possible tant qu'aucune réponse n'est donnée.
- **Traitement par l'Admin sous MFA** : file filtrable, prise en charge, réponse motivée.
  - Rectification et « autre » : faite, partiellement faite ou refusée. Une correction elle-même passe par les parcours existants, déclarations et contestations comprises.
  - Accès complet : accordé ou refusé. S'il est accordé, l'export du demandeur inclut pendant 14 jours les notes, tâches et journal interne de ses demandes.
- **Données** : table `partner_data_requests`. Les transitions vont en avant seulement ; tout est immuable après réponse ou retrait. La réponse est visible du demandeur dans « Mes données ».
- Aucun email ni centre de notifications : `partner_notifications` exige un Lead.

**C7c — Effacement contrôlé (client Wallet).**
- **Aperçu calculé par le serveur**, pour le sujet de la demande, demande par demande :
  - **en cours** : bloque, à clôturer d'abord par les parcours existants ;
  - **conservée entière**, encore reliée au compte, avec son motif : conclusion ou signature, droits économiques ou mandat, litige ou réclamation ouverte, contestation en cours ;
  - **effaçable**.
- **Exécution** : par l'Admin sous MFA, avec une clé d'idempotence, l'empreinte de l'aperçu et une attestation qu'aucune autre obligation de conservation ne s'applique. Une transaction unique traite chaque demande effaçable :
  - nom, objet, contexte, coordonnées, repère d'objet, source et prochaine action effacés ;
  - titre, nom du client, tâches et lieux de rendez-vous remplacés par un marqueur neutre (« Demande effacée », « Client effacé », « Tâche effacée », « Lieu effacé ») ;
    - ce sont des champs de contenu libre, et le produit n'a qu'une langue ; c'est `client_erased_at` qui dit l'effacement ;
    - le résultat et le motif de clôture sont des codes sans contenu personnel, et ils restent ;
  - textes du journal effacés ;
  - données importées de la demande d'offre réduites aux deux identifiants techniques qu'exige leur contrainte ;
  - email d'invitation remplacé par l'adresse réservée `erased@coverview.invalid` : la garde de l'invitation n'admet cette seule modification que dans la transaction d'effacement (variable de transaction, migration 0076) ;
  - préférences et notifications Wallet supprimées ;
  - lien avec le compte et le profil rompu, `client_erased_at` daté, la demande d'effacement référencée.
  - Les déclencheurs existants de changement de client invalident ensuite les enquêtes, réclamations, préférences de communication et enregistrements de ces demandes : ils cessent de compter dans les évaluations.
  - Les référents du sujet sont supprimés quand plus aucune demande conservée ne le concerne.
- **Ce qui reste, déclaré dans l'aperçu, la réponse et le registre.**
  - Les preuves protégées par les gardes existantes restent telles quelles, y compris leurs références au compte (auteur, propriétaire), jusqu'à une politique validée (S-131) :
    - journal des actions, sans ses textes ;
    - propositions de rendez-vous et comptes rendus d'échanges ;
    - enregistrements, transcriptions, enquêtes et réclamations ;
    - recommandations et leurs motifs, analyses professionnelles, classements de matching.
  - Les documents de l'espace client utilisés comme sources restent marqués comme liés.
  - La demande d'offre d'origine, les documents et le compte relèvent d'autres modules (S-131) : tant que le compte existe, ses références restent rattachables.
- **Purge automatique : non implémentée.** Aucune durée n'est définie, et le registre l'affiche.

#### C8 — Conception retenue (avant code)

Entrée de tranche le 6 octobre 2026, instruction « Continue avec C8 ». Session réelle : Claude Code, Claude Opus 5.5, effort max. Cinq sous-étapes commitées séparément, dans l'ordre de leurs dépendances : l'équipe s'appuie sur le journal et les restrictions, le profil d'organisation sur l'équipe.

**Décisions déléguées (PROG-23)**, réponses par défaut du 6 octobre 2026 :

| ref | question | answer | evidence |
|---|---|---|---|
| C8-1 | Que peut restreindre CoverView, et avec quel effet ? | Liste fermée : nouvelles demandes confiées, transmission de demandes, marketplace, catégories exclues. Une restriction arrête les nouveaux engagements ; les dossiers en cours continuent, la suspension reste l'outil qui les retire. Une date de réexamen de restriction alimente la file Admin ; rien n'est levé automatiquement. | I.4 « restreindre certaines activités », I.19.2 conséquences affichées ; G-01 : jamais élargir un accès sans décision humaine |
| C8-2 | Que fait un réexamen arrivé à échéance ? | L'accès cesse comme aujourd'hui (dossiers traités par le worker). Le système ouvre en plus le réexamen : état « complément demandé », décision automatique au journal, rappel 30 jours avant dans Partner et dans la file Admin. Même règle pour une organisation qui porte une date. | I.4 « fixer une date de réexamen », existant `review_due_at` coupure sèche sans suite |
| C8-3 | Comment un collègue rejoint-il une organisation ? | Invitation du responsable, liée à l'adresse vérifiée du compte invité, valable 14 jours ; elle s'accepte en déposant sa candidature, que CoverView valide à part. Pas d'email en C8 : l'invitation apparaît dans Partner à la connexion. | I.3, I.4 « valider une organisation et ses utilisateurs séparément » ; aucun parcours existant, organisations à un seul membre |
| C8-4 | Quels pouvoirs pour le responsable ? | Voir son équipe (état, rôles, réexamen, types de restriction sans motif, charge), inviter, mettre fin à l'adhésion d'un collègue (ni soi-même ni un autre responsable) avec traitement de ses dossiers, réattribuer dans l'équipe avec motif, lire les conditions commerciales de l'équipe. Jamais : valider, attribuer un rôle, restreindre, voir les flux financiers d'un collègue. | I.3 « superviser les utilisateurs, demandes, affectations et conditions commerciales » ; I.20 aucun accès collectif implicite |
| C8-5 | Photo et logo ? | Images JPEG, PNG ou WebP de 5 Mo au plus, réencodées dans le navigateur (métadonnées retirées), antivirus, servies par l'API seulement à l'audience du profil publié. Profil d'organisation rédigé par le responsable, publié après examen CoverView. | I.18 ; conception C2 ; STOR-04, écart déclaré : pas de retraitement serveur |
| C8-6 | Comment traiter un contrat signalé par le client ? | Confirmations du client (questions factuelles de l'enquête, signalement Wallet, contact qualité consigné par CoverView), comparées par le serveur à l'état déclaré. Un écart ouvre une vérification, jamais une réclamation ; CoverView peut demander un rapprochement au professionnel et clôt avec une issue. Aucune écriture financière, aucun effet sur les évaluations. | I.17.2, I.23 « vérification ouverte et rapprochement demandé, sans sanction automatique » |
| C8-7 | Que déclenche une analyse incomplète ? | Le professionnel demande un complément au client (éléments, message, échéance), le client répond dans Wallet (texte, documents, contrat de référence). L'avis « analyse à compléter » suit le responsable courant et se réévalue dans le temps. Les manques côté professionnel restent sa vérification humaine. | I.13 « demande de complément ou vérification humaine », I.23 « résultat limité ou suspendu » |

Ces défauts sont des choix de produit. Ils ne valent ni conformité, ni avis juridique, ni validation des durées.

**C8a — Habilitations (I.4).**
- **Journal des décisions** `partner_access_decisions`, immuable : examen d'un membre, examen d'une organisation, restriction, réexamen automatique, fin d'adhésion par le responsable (C8b). Chaque décision porte auteur (ou acteur système), date, motif et, s'il y a lieu, état, rôles, restrictions et date de réexamen. Aucune reprise de l'historique antérieur : il commence à la migration.
- **Organisation validée à part.** `POST /admin/partner/organizations/:id/review` : état, motif, date de réexamen, révision. Bloquer une organisation traite les dossiers de tous ses membres (fonction commune avec l'examen d'un membre). L'examen d'un membre peut encore valider l'organisation pour une première candidature, mais la décision est journalisée à part.
- **Restrictions** (`partner_members.restrictions`, révision propre pour ne pas invalider rendez-vous ni propositions) :
  - nouvelles demandes confiées : exclu du matching (motif « restreint »), des propositions automatiques, des attributions de l'Admin ou du responsable, des transferts et co-conseils, des réservations marketplace, de l'auto-attribution à la création ;
  - transmission de demandes : plus de création ;
  - marketplace : ni publication, ni candidature, ni réservation ;
  - catégories exclues : les mêmes effets, limités à ces catégories.
  - Décision Admin sous MFA, motif, date de réexamen facultative, aperçu des dossiers en cours qui continuent.
- **Réexamens automatiques.** Dans le tick du worker de continuité : membre ou organisation approuvé dont la date est échue → « complément demandé », décision automatique (`partner-continuity-v1`), événement. Le membre met à jour et resoumet sa candidature, CoverView réexamine. Rappel à 30 jours dans l'accueil et la candidature Partner.
- **File Admin** dans l'écran des candidatures (Partner, mode Admin) : à examiner, réexamens à 30 jours ou échus, restrictions à réexaminer, justificatifs échus ou à 30 jours (compétences et conventions). Dialogues restrictions, organisation (membres, conséquences, décision) et historique.
- **Partner** : restrictions en vigueur avec motif et historique de ses propres décisions dans « Profil et organisation » ; copie de données complétée (R5).

**C8b — Équipe du responsable (I.3, I.4).**
- **Invitation** `partner_team_invitations` : adresse normalisée, 14 jours, au plus 20 ouvertes et 10 nouvelles par jour et par organisation, annulable. Le serveur refuse seulement l'adresse d'un membre actuel de la même organisation ; il ne révèle rien d'autre.
- **Acceptation** : l'invité voit l'invitation si l'adresse vérifiée de son compte correspond. Il l'accepte en déposant sa candidature : rattachement à l'organisation, nom d'organisation imposé, validation CoverView à part. Impossible depuis une adhésion approuvée ou suspendue.
- **Page Équipe** (`/team`, responsable) : membres avec état, rôles, réexamen, types de restriction (sans motif), dossiers en cours et en retard ; invitations ; conditions commerciales de l'équipe en lecture.
- **Fin d'adhésion** d'un collègue par le responsable : motif, aperçu des conséquences, état « fermé », traitement des dossiers comme une suspension, décision journalisée. Ni soi-même, ni un autre responsable : CoverView s'en charge.
- **Réattribution dans l'équipe** : la commande `assign` est ouverte au responsable pour un dossier de son équipe, vers un collègue éligible et non restreint, avec motif ; même décision tracée que l'Admin, sans accès au classement.
- **Registre** : le responsable devient destinataire des données opérationnelles de l'équipe.

**C8c — Photo et profil d'organisation (I.18, report de C2).**
- Finalités documentaires `partner_profile_photo` et `partner_organization_logo`, masquées de la bibliothèque Wallet comme les autres preuves professionnelles.
- Photo facultative jointe à une version de profil ; logo et présentation de l'organisation en versions immuables, soumises par le responsable, examinées par l'Admin sous MFA (jamais par un membre de l'organisation).
- Publication seulement si l'image est analysée et saine. Lecture par l'API, audience du profil publié, type MIME détecté parmi JPEG, PNG et WebP.
- Wallet, Partner et Admin affichent la photo et le bloc organisation.

**C8d — Contrat non déclaré signalé par le client (I.17.2).**
- **Confirmations du client** `partner_client_confirmations` : canal (enquête, Wallet, appel, email), faits (contact, rendez-vous, documents, contrat ; oui, non, ne sait pas), compagnie et date facultatives, état déclaré comparé au même instant.
- **Écarts** calculés par le serveur : contrat signalé mais non déclaré, contrat déclaré mais non confirmé, contact, rendez-vous ou documents non confirmés. « Ne sait pas » n'en crée aucun.
- **Vérification** : cas qualité `verification`, interne, une seule ouverte par demande. Action Admin « demander un rapprochement » au professionnel concerné, qui lit les faits et répond. Clôture avec issue (confirmé, infondé, non concluant).
- **Bornes** : jamais une réclamation, aucun effet sur les évaluations, aucune écriture financière ; la confirmation du client ne vaut pas preuve d'encaissement. Les questions factuelles rejoignent l'enquête unique, sans sollicitation supplémentaire.
- **File** : filtre « contrats potentiellement non déclarés » et compteur (I.19.2).

**C8e — Analyse incomplète → demande de complément (I.13).**
- **Diagnostic** des manques par origine : client (contrat de référence à confirmer ou absent), professionnel (valeurs à vérifier), compagnie (prestations absentes de l'offre).
- **Demande de complément** au client par le responsable, le responsable d'équipe ou un contributeur avec droit de contact : éléments, message, échéance ; notification Wallet ; suspension du suivi jusqu'à l'échéance sur option explicite.
- **Réponse Wallet** : texte, documents de l'espace partagés (original conservé), confirmation du contrat de référence par le parcours existant. Le professionnel est notifié et clôt la demande.
- **Avis existant corrigé** : il suit le responsable courant après une réattribution, il est réévalué par le worker (offre échue, source modifiée), et le lien ouvre l'onglet des offres. La notification d'action tient lieu de tâche : le plan C4b annonçait aussi une tâche, jamais créée, ce qui est corrigé ici dans la documentation.

### B — Recette réelle et simplification (après C)

Les 33 scénarios I.23 se déroulent avec de vrais comptes WorkOS : candidat, Admin avec MFA, conseiller, apporteur, client Wallet. Revue produit critique, mobile et clavier. Cette phase exige la présence de l'utilisateur.

## Definition of Done — oracles

- [ ] A : typecheck des 8 espaces, `drizzle-kit generate` sans écart, lint et tests complets verts, base locale migrée, `D:\Projects` sur la branche intégrée. V0–V2 et V1 migration.
- [ ] Chaque item C : contrats Zod, API avec autorisation serveur, SDK et UI Partner/Wallet/Admin concernées. Tests PostgreSQL des invariants de droits, d'isolation, de concurrence et d'idempotence. Document propriétaire et couverture mis à jour. V0–V2.
- [ ] B : scénarios I.23 observés en réel. V3, puis revue humaine V5.
- [ ] Ledger sans élément critique « supposé » ; brief, S-110 et S-042a fermés seulement sur preuve réelle.

## Périmètre

- Modules : `partner-workspace` (propriétaire), `identity`, `profiles`, `document-intelligence`, `authorizations`, `insurance-requests`, `health-insurance` en lecture. Apps : `api`, `partners`, `client`, `admin`.
- Permissions : réemploi des politiques Partner existantes (aucun accès par organisation seule, email ou commission). Admin global sous MFA.
- Données : migrations additives à partir de 0066, générées depuis le catalogue normal. Une seconde génération doit sortir sans écart.
- Événements et jobs : bus et outbox existants. BullMQ pour l'escalade 24 h. Pas de nouveau broker.

## Satellites à charger

architecture, backend, api, contracts, data, permissions, security, testing, frontend, design, i18n, events, jobs, realtime (item 6), email (item 3), conventions. Exclusions : marketing-web, seo, geo, billing.

## Hypothèses réversibles

- Les déclarations validées par l'Admin suffisent à l'éligibilité du matching (décision 2a). Rayon d'impact : le module de matching seul, pas les dossiers existants.
- Pas de fournisseur email ou SMS de production : Mailpit en local. Rayon d'impact : l'adaptateur d'envoi.
- C5 : « sans activité récente » = 7 jours sans événement autre qu'une consultation ; « limite des 24 heures proche » = moins de 4 heures (seuil des alertes existantes) ; vues d'équipe réservées au rôle `manager`. Défauts réversibles ; rayon d'impact : `summary()` et la liste du dépôt Partner.
- C3 : validité de 14 jours, 3 invitations par destinataire et par 24 heures, 3 tentatives d'envoi, 5 minutes d'attente par tentative. Défauts réversibles ; rayon d'impact : constantes de `partner.invitations.ts` et document propriétaire.
- C3 : peuvent inviter l'Admin, le responsable courant habilité et un contributeur avec droit de contact ; jamais un apporteur seul. Rayon d'impact : `access()` du module invitations.
- C6b : l'initiative du rendez-vous conjoint revient au client depuis Wallet ; au plus 3 spécialistes par rendez-vous ; plus de sollicitation après un refus ou un retrait ; un report demande une reconfirmation ; chaque spécialiste consigne l'issue de sa demande. Défauts réversibles ; rayon d'impact : `partner.joint-appointments.ts`, ses routes et les panneaux Wallet et Partner.
- C3, dérogation signalée à MAIL-02 (« Mailpit via SMTP ») : la convention locale `EXTERNAL_ADAPTER_MODE` + `MAILPIT_URL` HTTP est suivie (§4), sans nouvelle dépendance. Rayon d'impact : `platform/mailer.ts` ; un fournisseur de production s'ajoutera derrière l'interface `Mailer`.

## Journal de vérification

| # | Cible | Oracle | Observé | Décision |
|---|---|---|---|---|
| 1 | Migration locale | `db:migrate` via pnpm | Échec masqué par le CLI ; base inchangée (transaction) | Diagnostic : la maintenance exige `AUTH_ENABLED=false` |
| 2 | Migration locale | tsx depuis la racine | Module tsx introuvable à la racine | Changement de stratégie : binaire local `apps/api` ; troisième essai réussi |
| 3 | C1 matching | tests ciblés puis `tsc` | Tests verts ; `tsc` signale des tableaux non typés dans le test, que Vitest ne vérifie pas | Correction `641d3ef` ; `tsc` désormais lancé avant chaque commit |
| 4 | C2 profils et évaluations | suite complète Vitest | 74/74 fichiers, 751/751 tests | Commit C2 seul, travail C3 exclu |
| 5 | C2 en isolation | `tsc` des 7 espaces, travail C3 remisé | 0 erreur | Sauvegarde, avance rapide, migration 0068 locale ; `/health` prêt |
| 6 | C3 invitations | tests ciblés | 5/6 : une annulation invalide lève l'erreur Zod de façon synchrone | Assertion corrigée (`toThrow` synchrone) ; 6/6 |
| 7 | Adaptateur Mailpit | envoi réel vers Mailpit local | Message reçu : texte et HTML, lien, notice, étiquette, référence ; score HTML 94 % | Oracle réel de l'adaptateur |
| 8 | C3 complet | suite complète Vitest, builds API/Partner/Wallet, depcruise, knip | 75/75 fichiers, 758/758 tests ; builds verts ; depcruise sans erreur ; knip identique au commit précédent (préexistant) | Commit C3, travail C4 exclu |
| 9 | C4a moteur | tests unitaires | 8/8 après correction d'une attente (« à vérifier » distinct de « absente ») | — |
| 10 | C4a bout en bout | test PostgreSQL | Échec : colonnes attendues dans l'ordre de création, servies dans l'ordre des cartes (récentes d'abord) | Attente corrigée, ordre des cartes conservé ; 1/1 |
| 11 | C4a frontières | dependency-cruiser | 4 cycles : import de type `partner-benefits` → `partner` | Liste des besoins locale, cohérence imposée au typecheck des appelants ; 0 erreur |
| 12 | C4a complet | suite complète, builds, knip | 77/77 fichiers, 767/767 tests ; builds verts ; knip inchangé (préexistant) | Commit C4a, brouillon C4b hors dépôt |
| 13 | C4b recommandation | tests PostgreSQL | Échecs : reprise idempotente comparée avec une date de calcul variable ; date d'échéance SQL non ISO dans le test | Comparaison de l'historique seul, date ISO passée en paramètre |
| 14 | C4b orientation | test PostgreSQL | Sans contrat actuel, une offre incomplète laissait « offres comparées » | Orientation insuffisante tant qu'une offre est incomplète |
| 15 | C4b signal d'analyse | test PostgreSQL | L'ajout d'une offre non revue ouvrait le signal | Signal calculé sur les offres revues seulement |
| 16 | C4b complet | suite complète | 3 échecs : des tests vérifient qu'une relecture du dossier est identique, or la date de calcul changeait | Date des données utilisées (`asOf`), projection déterministe ; 5 fichiers / 93 tests repassés |
| 17 | Activation locale | état des worktrees | `D:Projectscoverview-astra` basculé sur `main` (`ba49851`, sans le travail Partner) ; une autre session travaille dans `coverview-astra-health` depuis C4a | Aucune avance rapide ni migration de la base locale partagée sans accord (risque d'ordre des migrations entre branches) ; suites complètes dans un worktree figé `coverview-astra-suite` |
| 18 | C4c proposition | test PostgreSQL | Aucune police candidate : le gabarit de test n'avait ni en-tête de police émise ni textes sources présents sur la page | Gabarit corrigé (« Police automobile », sources sur la page) ; 1/1 |
| 19 | C4b, C4c, C5a, C5 | suites complètes dans des worktrees figés | `883015b` : 79/79 fichiers, 775/775 tests ; `c3bfd0b` : 81/81, 780/780 ; `3b64bae` : 82/82, 782/782 ; `9a114f8` : 83/83, 784/784 | Branche `claude/partner-integration` avancée sur la pointe vérifiée ; base locale et `D:Projects` inchangés en attendant l'accord |
| 20 | C5a vues | tests PostgreSQL | Création refusée sans prochaine action, puis conflit en réattribuant un conseiller déjà responsable de sa propre création | Gabarit de test corrigé ; 3/3 |
| 21 | Alignement local (tâches de la session santé) | suite complète sur la fusion `3f9fbd2` | 83/83 fichiers, 790/790 tests | Sauvegarde `pg_dump` (29,1 Mo), avance rapide de `main`, `pnpm install` (lockfile déjà à jour), migrations 0070–0071 appliquées (72 entrées) ; `/health` prêt, nouvelles routes servies |
| 22 | C6a flux HTTP | lecture du serveur avant le test réel | Sockets inactives coupées à 10 s (`connectionTimeout`) alors que le battement est à 25 s ; arrêt bloqué par un flux ouvert (`onClose` attend les requêtes en cours) | Délai désactivé pour le flux seul, fermeture en `preClose` ; le test de maintien au-delà de 10 s échoue sans le correctif (oracle contrôlé) |
| 23 | C6a complet | test PostgreSQL, typecheck des 4 espaces, builds, frontières | 5/5 ; 0 erreur ; builds API, Partner, Wallet verts ; depcruise 0 erreur ; knip sans nouveau signalement | Commit C6a |
| 24 | C6a suite complète | Vitest sur `8b9fd47` (worktree figé) | 84/84 fichiers, 795/795 tests | — |
| 25 | C6b notifications | relecture avant test | L'invitation, enregistrée sur les deux demandes, aurait refermé par son second événement la question ouverte au spécialiste | Seules une réponse ou une fin de participation ferment la question |
| 26 | C6b parcours | tests PostgreSQL | 4/4 en échec : ordre de tri attendu ; notifications d'information enregistrées déjà résolues (convention existante de `put`) | Attentes corrigées (envoyées / à traiter) ; 4/4 |
| 27 | C6b complet | typecheck des 6 espaces, 6 fichiers de tests existants touchés, builds, frontières | 0 erreur ; 119/119 ; builds API, Partner, Wallet verts ; depcruise 0 erreur ; knip sans nouveau signalement | Commit C6b |
| 28 | C6c lecture préalable | lecture du pilotage existant | La recette CoverView existait déjà dans les statistiques (Admin, période, périmètre, branche, détail par Lead) ; aucune donnée de coût n'existe | Réemploi du calcul dans l'aperçu réseau, sans duplication ; coûts déclarés non saisis |
| 29 | C6c | scénario économique existant + test d'aperçu, typecheck, build Admin | 12/12 ; même recette (1000 centimes) dans les deux écrans et dans la branche concernée ; autre branche « pas d'observation » | Commit C6c |
| 30 | C7a scores internes | test PostgreSQL | Délai d'instruction dépassé : la lecture de l'évaluation d'apporteur ouvrait sa propre transaction pendant que la lecture englobante tenait le verrou de session | Lecture sortie de la transaction ; 3/3 |
| 31 | C7a HTTP réel | serveur réel, double du fournisseur d'identité | Quota de copies compté par adresse IP, tentative refusée comprise : des personnes derrière un même réseau l'auraient partagé | Clé par condensé de la session ; un voisin garde son quota ; 4/4 (`1d56714`) |
| 32 | C7a complet | typecheck des 5 espaces, lint, builds API/Wallet/Partner, frontières, knip, suite API complète (`9eacde1`) | 0 erreur ; depcruise 0 erreur ; knip identique à `main` ; 74/74 fichiers, 764/764 tests | Sauvegarde 29,1 Mo, avance rapide de `main`, migration 0074 locale (75 entrées) |
| 33 | Parcours navigateur (V3) | préversion locale | `scripts/preview.mjs` ne démarre pas : le `.env` pointe `WORKOS_ENV_FILE` vers le dossier Codex `9b02`, absent avant le nettoyage du 6 octobre ; sans WorkOS, aucune session réelle | Oracle HTTP réel (ligne 31) ; V3 avec un vrai compte WorkOS en phase B, après correction du `.env` par l'utilisateur |
| 34 | C7b | tests PostgreSQL | 2 échecs : attente HTTP sans la liste `requests` ; scénario sans note interne à révéler | Attentes et scénario corrigés ; 5/5 |
| 35 | C7b complet | typecheck des 6 espaces, lint, builds des 4 apps, frontières, knip, suite API complète (`1b63d21`) | 0 erreur ; inchangé ; 74/74, 766/766 | Commit `1b63d21` |
| 36 | C7c | test PostgreSQL | Clôture refusée (motif « refus du client » exige ce résultat) ; puis lieu vidé refusé par le contrat d'affichage d'un rendez-vous (3 caractères au moins) | Scénario corrigé ; marqueur « Lieu effacé » ; 6/6, puis 15/15 avec invitations et profils |
| 37 | C7c complet | typecheck, lint, builds, frontières, knip, seconde génération Drizzle | 0 erreur, aucun écart | Commit `e37236f` ; sauvegarde 29,1 Mo, avance rapide de `main`, migrations 0075–0076 locales (77 entrées) |
| 38 | Suite complète du dépôt | `pnpm test` à la racine sur `e37236f` (worktree figé) | 85/86 fichiers, 806/807 tests ; un échec dans `partner-marketplace-economy.test.ts` (« bounds co-advice access at the mission expiry »), qui ne laisse que 1,2 s entre réservation et expiration | Même fichier seul sur le même commit : 10/10. Test sensible au temps sous charge, antérieur à C7, qui ne touche pas la marketplace : signalé (G-07), tâche de stabilisation proposée, rien de désactivé |
| 39 | Centre de notifications (C6b) | test contrôlé : contrat sans puis avec l'action `review_participation` | Sans la correction, la lecture du centre du spécialiste invité échoue (ZodError) ; avec, 4/4 | Commit `a00a3de`, défaut repéré pendant l'exploration de C8 (G-07) |
| 40 | C8a habilitations | tests PostgreSQL | 4/4 ; ajout du référent retiré pour couvrir le filtre SQL commun, 4/4 | — |
| 41 | C8a non-régression | 10 suites touchées par l'examen refactoré (dépôt, matching, marketplace, vues, navigation, qualité, réservations, rendez-vous conjoints, droits, profils) | 10/10 fichiers, 95/95 tests | — |
| 42 | C8a frontières | typecheck des 7 espaces, seconde génération Drizzle, depcruise, knip | 0 erreur ; aucun écart ; 0 erreur ; deux exports inutilisés (`accessItem`, `DecisionHistory`) | Exports retirés, knip identique à `main` |
| 43 | Méthode | comparaison knip avec `main` par remise des fichiers suivis | La suite API complète tournait en arrière-plan sur le même arbre : passage potentiellement contaminé | Passage arrêté et relancé ; les comparaisons avec `main` se feront dans un worktree séparé |
| 44 | C8a complet | suite API complète relancée, puis le commit seul dans le worktree figé `coverview-astra-suite3` (typecheck des 6 espaces, lint et format des fichiers mixtes) | 75/75 fichiers, 771/771 tests ; 0 erreur | Commit `4e0616c` sans le travail C8b en cours (index composé) ; sauvegarde 29,1 Mo, avance rapide de `main`, migration 0077 locale (78 entrées) |
| 45 | C8b équipe | tests PostgreSQL | 4/4 au premier passage | — |
| 46 | C8b complet | 11 suites touchées, puis suite API complète du commit dans `coverview-astra-suite3` ; typecheck, lint, depcruise, knip, seconde génération Drizzle | 11/11 fichiers, 85/85 tests ; 76/76 fichiers, 775/775 tests ; 0 erreur, knip identique à `main`, aucun écart | Commit `c67b06f` ; sauvegarde 29,1 Mo, avance rapide de `main`, migration 0078 locale (79 entrées) |
| 47 | C8c garde des images | test PostgreSQL | Le déclencheur commun aux deux tables lisait `NEW.logo_document_id` sur une version de profil : PL/pgSQL résout tous les champs de l'expression | Branches imbriquées par table (migration 0079 jamais appliquée, corrigée en place) ; 2/2 |
| 48 | C8c complet | 11 suites touchées (profils, justificatifs, conventions, documents, droits, images) ; typecheck des 7 espaces | 11/11 fichiers, 60/60 tests ; 0 erreur | — |
| 49 | C8c suite complète | suite API complète du commit dans `coverview-astra-suite3` | 77/77 fichiers, 777/777 tests | Commit `a78ff26` ; sauvegarde 29,1 Mo, avance rapide de `main`, migration 0079 locale (80 entrées) |
| 50 | C8d déclarations | tests PostgreSQL | Quatre échecs : contact déclaré attendu à tort, réponse du professionnel refusée par le schéma de réponse, date d'échange antérieure à la demande dans le test, `declared.contract` nul sur une demande ouverte | Attente corrigée ; schéma de réponse élargi ; date courante ; `coalesce` en SQL ; 3/3 |
| 51 | C8d visibilité | relecture du plan en construisant l'écran Wallet | La vérification ouverte depuis Wallet était visible du client, alors que le plan la veut interne : son résumé et l'indicateur `verificationOpened` révélaient l'écart | Vérification interne quel que soit le canal ; la file Wallet ne retient plus l'auteur ; tests : 404 pour le client, liste Wallet intacte, aucun indicateur ; 3/3 |
| 52 | C8d formulaire d'enquête | typecheck Wallet | Le `pipe` du formulaire refuse les valeurs par défaut du contrat (`insurer`, `signedOn`) | Première étape typée `z.custom<ClientFacts>()`, le contrat valide toujours en seconde étape |
| 53 | Méthode | Prettier passé sur tous les fichiers modifiés | Quatre Markdown non formatés au départ (mémoire, README, couverture, qualité) recevaient des changements sans rapport | Textes repris depuis `HEAD` avec les seuls ajouts C8d (G-13) ; Prettier réservé aux fichiers déjà propres |
| 54 | C8d complet | 7 suites touchées (confirmations, qualité, contrats qualité, droits, diffusion, profils, rendez-vous conjoints) ; typecheck des 7 espaces, lint, builds des 3 apps, depcruise, knip, seconde génération Drizzle | 7/7 fichiers, 39/39 tests ; 0 erreur ; knip : `declaredFacts` et `compareFacts` exportés sans usage, rendus locaux, puis identique à `main` ; aucun écart | — |

## Risques et mitigations

- Complexité existante (~25 700 lignes de module, 65 composants Partner) → réemployer les structures acquises. Aucun dossier préparatoire supplémentaire sans parcours utilisable.
- Base locale partagée → sauvegarde `pg_dump` avant chaque migration, migrations additives uniquement.
- Preview utilisateur active depuis `D:\Projects` → fusion et vérification dans `D:\Projects\coverview-astra-integration`, une seule avance rapide à la fin de A.

## Hors périmètre ou dépendances externes

URL Google réelle, fournisseurs email/SMS de production, téléphonie et enregistrement automatique, signature qualifiée si les compagnies l'exigent, durées légales et analyse d'impact, référentiel vérifié des compagnies et produits, déploiement.
