# Reprise de travail — Partner, décisions Wallet

Créé : 2 octobre 2026. Contexte observé indisponible ; relais après résultat cohérent, aucun seuil inventé.

## Mission et autorisation

Poursuivre le brief Partner **intégral** du 2 octobre, dernier ordre utilisateur « Recommence ». Autonomie maximale, PROG-23 et roadmap/execution-policy.md : meilleurs défauts, relais séquentiels **gpt-6-astra / ultra**. Une seule tâche propriétaire, **sans sous-agent ni écriture applicative concurrente**. Ne pas reconstruire le socle ni clore le brief après une tranche. Source : references/coverview-partner-2026-10-02.md ; suivi : roadmap/partner-coverage.md. Ce checkpoint décrit un état, pas une nouvelle autorisation ni un remplacement du brief.

## État du dépôt

Sortant : C:/Users/sebm1/.codex/worktrees/c0e2/coverview-astra ; HEAD détaché **4fef49a095739260b9ab9d1becc1a2bf3320a928**. Restauration7a52 vérifiée : manifeste97b6eb6834b025b4e9aca641de13607c73b8b841d550f3ef865bc2680cdb2c90,487 fichiers/33394649octets. Le code dépend du **WIP complet**, pas seulement de HEAD. Aucun commit global WIP/reset/stash/push/déploiement.

Instantané immuable : C:/Users/sebm1/.codex/worktrees/c0e2/coverview-astra/.planning-local/partner-relay-imports-20261002/. Le prompt de lancement fournit SHA-256 du manifeste/restore, nombre de fichiers et octets. Avant code : vérifier les hashes, propreté et HEAD ; lire restore.mjs puis exécuter avec le chemin **absolu du worktree neuf**. Si propre mais autre HEAD, placement en détaché au SHA exact autorisé sans reset. Script refuse source, mauvais HEAD/cible modifiée ; vérifie chaque fichier avant/après. Si restauration partielle, inspecter/réconcilier sans écrasement indistinct. Installer frozen lockfile sans scripts.

D:/Projects/coverview-astra et worktrees52d5/fb54/8d4a/f41b/175f/d02c/7a52/c0e2 en lecture seule. Secrets/.env/dépendances/builds/bmpartners exclus ; seul .env.example versionné. Aucun processus/configuration locale transporté. Après dispatch, sortant ne peut écrire que son éventuel dispatch.json ignoré.

## Sources à lire

AGENTS, CLAUDE, docs/codex, PROJECT, MEMORY actives ; plan Partner **et journal**, evidence/partner-core, registre et brief intégral. README partner-workspace, apps/partners, Wallet Offres, document-intelligence et ADR0010. Règles courantes dans les README canoniques, checkpoints antérieurs seulement pour l’histoire. Prochaine frontière : III.11–13/16–17, I.8/13 ; contrats/API/permissions/données/évolution/tests, frontend/design/i18n, événements/jobs selon routage. Ne pas précharger tous les satellites.

## Décisions acquises

Client canonique ≠ Lead. Plusieurs besoins/catégorie légitimes, aucun rapprochement par nom/email ni droit par organisation/économie. Conseiller approuvé et affecté, Admin/MFA et propriétaire Wallet courant ; ne pas fabriquer d’habilitation réelle. Source privée ≠ offre structurée ≠ contrat ; choix ≠ signature/acceptation assureur. Commission non estimable sans accord.

Continuité/collaboration : règles au README canonique. Notifications internes atomiques, lecture ≠ résolution, échéances figées depuis attribution notifiée. Invitation sans accès avant acceptation, co-conseil au seul Lead hors notes privées ; transfert sans accès résiduel, aucun mandat/référent/droit économique automatique. Matching pas activé.

Insurance-requests : confirmation par personne/propriétaire courant, jamais déduite du panier/email ; profils submit/claim réutilisés, invité garde suivi/cookie. Lien unique demande/personne, accord/snapshot/Lead/notification atomiques ; transfert retire ancien accès et conserve le Lead. Portée figée. Inspection7a52 : seulement personne/configuration/provenance historiques sous verrous ; incohérence → unavailable, aucune reconstruction depuis profil/catalogue. Pas de panier familial/email/bibliothèque. Prime indicative ≠ offre, année tarifaire absente. Audit30min sans action utile/révision/notification.

Contrat actuel175f : original exact choisi/partagé par propriétaire, jamais par catégorie. Référence canonique sans copie ; source/profil changés invalident comparaison, retrait ferme accès sans détruire preuve. Gains ET pertes sur même prestation vérifiée, annualisation CHF explicite, candidats200 récents. Détails au README.

Versions d02c : source_snapshot exact par version, reviewed_by/published_by ; files.revision seul n’est pas l’empreinte (transfert de propriété). 0035 nullable sans preuve rétroactive. Formulaire : révision d’ouverture et confirmation d’empreinte ; absente/changée → conflit. Revue/publication/choix sous verrou ; nouvelle version si source changée. Anciennes sans snapshot non certifiées, original sûr de checksum identique téléchargeable. Historique20/page, Wallet seulement déjà publiées même retirées/remplacées ; cartes actives. Décisions/notifications liées à version. API décide canChoose/canCompare/canDownload ; choix ≠ signature. Composition de l’empreinte au README.

**Acquis c0e2** : migration0036 partner_offer_imports lie Lead/fichier/checksum/auteur/date/éventuelle première offre. Unicité Lead/checksum et document, jamais nom ; mêmes octets renommés retrouvent reçu, même nom/contenu différent distinct. Création pending retenu et reçu atomiques, révision Lead requise, rejeu clés/concurrence sans doublon. Client/objet/catégorie non modifiables dès un import. GET/POST /partner/leads/:id/offer-imports, content/source/retry par reçu ; aucune file Wallet. Liste20/cursor Lead, sélection10 fichiers/20Mio, envoi séquentiel, états/réessai indépendants. Source sûre requise ; quarantaine bloquée. Retry explicite révision documentaire + clé, outbox/budget/worker existants. Lecture absente/partielle/échouée ne vaut pas revue. Préparer via OfferDialog exige source exacte ; reçu consommé une seule première fois, remplacement explicite existant ensuite. Aucun import ne publie/avance le Lead/ne notifie client.

Accès imports : droits opérationnels actuels sous verrous ; contribution de conseil hors draft/completed pour écrire. Repreneur autorisé continue original du prédécesseur, sans bibliothèque implicite. Propriétaire documentaire/budget initial conservés. Upload vérifie octets avant/après stockage et droits avant/après puis sous verrou de confirmation ; révocation pendant put laisse pending sans outbox. File persistante, resélection des mêmes octets après fermeture, aucun localStorage privé. Rejeu initial avant actualisation explicite d’un conflit. Pending retenus exclus du nettoyage24h : **API ET worker compatibles requis avant activation**, conserver cette protection au rollback. Rétention/export/effacement S-130/S-131 restent ouverts. Règles/rollback détaillés au README, pas de paquet/secret/variable/room/worker ajouté.

## Livraison et preuves

V0/V1 vérifiés : types/lint/builds API/Partner/Wallet/Admin ; frontières524 modules/2216 dépendances,0 erreur/3 orphelins www hérités ; Knip ciblé quatre apps. 0036 appliquée sans reset, génération suivante sans delta. Types/lint/build Partner repassés après revue UI lecture seule/motifs de traitement/conflit de retry.

V2 : **48 tests PostgreSQL Testcontainers**,4 fichiers,47,33s :21 Partner,4 document-workflows,16 demandes,7 projection. Commande depuis apps/api : node ../../node_modules/vitest/vitest.mjs run src/modules/partner-workspace/partner.repository.test.ts src/platform/document-workflows.test.ts src/platform/insurance-requests.test.ts src/platform/insurance-projection.test.ts. Droits/rejeu/concurrence/déduplication/états/retry/quarantaine/scope/pagination/reprise/retrait/audit et invariants antérieurs. Test révocation pendant put et nettoyage utilise PostgreSQL + **stockage mémoire**, pas preuve MinIO/ClamAV/OpenAI. Revue même agent seulement.

V3 limité : Chrome Partner4126 candidature ; Wallet4125 vide. Base réelle0 Lead/import/offre. Aucun dossier/offre/grant/accord réel fabriqué. Import rempli, source/historique/comparaison/décisions remplis, erreurs/clavier/mouvement réduit/mobile et téléchargement HTTP **non vérifiés**. Preview secondaire sans routes/worker documentaires pour préserver l’instance commune. Pas de fournisseur simulé présenté comme réel.

S-110/S-042a ouverts ; programme partiel. Roadmap/checkpoint/instantané à contrôler selon ledger. Node24.13.1 sous engine>=24.20 ; réglage réel/coût non observables.

## Prochaine action bornée

1. Restaurer/contrôler instantané avant code ; relire plan/journal et brief, consigner les décisions déléguées.
2. **Décisions Wallet restantes** : auditer choix/question/modification/conservation existants et refus API, puis proposer le refus explicite dans l’interface avec récapitulatif et motif adapté au brief. Chaque décision doit viser le Lead/objet/version exacts, être idempotente et auditée, résister à remplacement/retrait/source changée/transfert/révocation. Vérifier notifications internes immédiates, résolution des actions correspondantes et prochaine action réelle Partner ; ne pas marquer signé, contrat émis ou accepté par assureur. Réutiliser contrats/composants/politiques existants. Choisir la tranche cohérente sans inventer un raccordement fournisseur.
3. Oracles proportionnés PostgreSQL réel, courses/rejeux et confidentialité, types/lint/builds, revue produit et V3 selon accès disponibles ; aucun consentement/dossier/grant fictif. Préserver revue/version/historique/import et contrat exact. Recettes non accessibles restent nommées sans bloquer le travail indépendant.
4. Poursuivre **tous** les tracks : signature/police finale réellement émises ; distribution/référents/matching ; marketplace/conditions/économie ; statistiques/objectifs/qualité/enquête/réclamations ; transcription/canaux réels. Le brief n’est pas terminé après les décisions.
5. Après résultat cohérent : docs/plan/journal/ledger/couverture/state, checkpoint validé, instantané complet vérifié puis **UN SEUL relais gpt-6-astra/ultra**. Stop écritures applicatives/state après dispatch, attendre premier état et lien. Aucun propriétaire concurrent ni simple promesse de relais.

## Obstacles et tentatives

Compte réel non habilité, zéro Lead : ne pas fabriquer de grants/accords/dossiers. Pnpm : C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs ; install --frozen-lockfile --ignore-scripts. API build.mjs depuis apps/api, pas racine. Drizzle apps/api/node_modules/drizzle-kit/bin.cjs. Wallet = apps/client, pas apps/wallet. API_PORT, pas PORT ; profils prf_, pas profile_. Textarea non exporté. Respect exactOptionalPropertyTypes, champs optionnels et i18n.

Avertissements hérités Wallet>500Ko/import ApplicationPage,3 orphelins www ; Knip global175f5 fichiers inchangés HEAD. Quatre défauts diff globaux : Admin api.ts/service-requests.json et Wallet api.ts/common.json, comparer SHA au manifeste entrant sans nettoyage global. Tentative viewport mobile d02c sans effet ; ne pas revendiquer ce contrôle. Aucun reset/stash/commit WIP global.

## Coordination

Propriétaire unique, sans sous-agent. API4100 étrangère PID52956/parent55148 précédemment observés, source/version non vérifiées : ne pas adopter/arrêter. Protéger4101/42564,4102/51012,4103/45936,4104/50864,4111/26768,4112/56200,4113/10696,4114/33452,4115/57740,4116/23924,4117/43496 ; Docker intact. Revalider PID/commande/port avant intervention.

Previews protégées d02c : API4118/PID27404, Wallet4119/42492, Partner4120/58692. 7a52 : API4121/37544, Wallet4122/54844, Partner4123/36552. c0e2 : **API4124 PID56764/session28355**, **Wallet4125 PID39464/session70124**, **Partner4126 PID47488/session43848**. Lanceur ignoré .planning-local/run-import-preview.mjs, config D:/Projects en mémoire seulement, PARTNER_JOBS_ENABLED=false et DOCUMENTS_ENABLED=false. Frontends VITE_API_URL4124. Ne pas lancer second worker partagé. Onglets temporaires non requis. Sortant cesse ses écritures applicatives/state dès dispatch.
