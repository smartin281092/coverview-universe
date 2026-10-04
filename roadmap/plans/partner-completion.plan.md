# Plan — Partner : intégration, activation et fonctions restantes

> Statut : **approuvé** — réponses utilisateur du 4 octobre 2026 : « 1a 2a 3b ». diff_from : [lot 4/4](partner-conclusion-integration.plan.md), interrompu le 4 octobre à 01h30.
> **Session requise** : Claude Code, Claude Opus 5.5, effort max. La reprise quitte la chaîne de relais Codex (décision 1a).
> **Session réelle** : Claude Code, Claude Opus 5.5, effort max (C1 à C5, 4 octobre 2026).
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
6. **Temps réel et agenda** (III.16, I.12, I.21) : diffusion Partner↔Wallet, rendez-vous conjoint, rentabilité CoverView si ses données existent.
7. **Droits des personnes** (I.20, S-130/S-131) : export, rectification, conservation et suppression contrôlée, cloisonnement en base. Aucune durée légale inventée.
8. **Reliquats** : gestion d'équipe du responsable, restrictions fines et réexamens automatiques (I.4), contrat non déclaré signalé par le client (I.17.2), audit incomplet → demande de complément (I.13).

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

## Risques et mitigations

- Complexité existante (~25 700 lignes de module, 65 composants Partner) → réemployer les structures acquises. Aucun dossier préparatoire supplémentaire sans parcours utilisable.
- Base locale partagée → sauvegarde `pg_dump` avant chaque migration, migrations additives uniquement.
- Preview utilisateur active depuis `D:\Projects` → fusion et vérification dans `D:\Projects\coverview-astra-integration`, une seule avance rapide à la fin de A.

## Hors périmètre ou dépendances externes

URL Google réelle, fournisseurs email/SMS de production, téléphonie et enregistrement automatique, signature qualifiée si les compagnies l'exigent, durées légales et analyse d'impact, référentiel vérifié des compagnies et produits, déploiement.
