# Reprise de travail — Partner, contrat actuel exact et comparaison

Créé : 2 octobre 2026. Contexte observé non disponible ; relais à un résultat cohérent, aucun seuil inventé.

## Mission et autorisation

Poursuivre le brief Partner **intégral** du 2 octobre, dernier ordre utilisateur « Recommence ». Autonomie maximale et relais séquentiels Astra/ultra autorisés par roadmap/execution-policy.md / PROG-23. Une seule tâche propriétaire, sans sous-agent ni écriture applicative concurrente. Ne pas reconstruire le socle ni clore le brief après une tranche. Source intégrale : references/coverview-partner-2026-10-02.md ; registre : roadmap/partner-coverage.md. Le checkpoint décrit l’état, pas un remplacement des sources maîtres.

## État du dépôt

Sortant : C:/Users/sebm1/.codex/worktrees/f41b/coverview-astra ; HEAD détaché **4fef49a095739260b9ab9d1becc1a2bf3320a928**. Les 459 fichiers WIP de 8d4a ont été restaurés après contrôle du manifeste e64aeb0e… et de chaque fichier. Aucun commit global du WIP hérité, reset, stash, push ou déploiement. Le code exige ce WIP, pas seulement HEAD.

Instantané immuable : C:/Users/sebm1/.codex/worktrees/f41b/coverview-astra/.planning-local/partner-relay-insurance-20261002/. Le prompt de lancement donne l’empreinte SHA-256 du manifeste, le nombre de fichiers et les octets. Avant code : vérifier hash, état et HEAD, lire restore.mjs puis l’exécuter avec le chemin ABSOLU du worktree neuf. Si propre mais au mauvais HEAD, placement en HEAD détaché au SHA exact autorisé, sans reset. Le script refuse source, mauvais HEAD et worktree modifié, vérifie toutes les empreintes avant/après. Restauration partielle : inspecter/réconcilier, jamais écrasement indistinct.

D:/Projects/coverview-astra, 52d5, fb54, 8d4a et désormais f41b en lecture seule. Secrets/.env/dépendances/builds/bmpartners exclus ; seul .env.example versionné. Aucun processus/configuration locale n’est transporté. Après dispatch le sortant n’écrit que son éventuel dispatch.json ignoré.

## Sources à lire

AGENTS.md, CLAUDE.md, docs/codex.md, PROJECT.md, MEMORY actives ; roadmap/plans/partner-core.plan.md **avec son journal**, roadmap/evidence/partner-core.md, roadmap/partner-coverage.md et brief intégral. README partner-workspace, insurance-requests, profiles, identity, document-intelligence/contrats, apps/partners, Wallet Offres, ADR-0010. Pour le résultat suivant : brief I.13 et III.6–7/10/14, documents/polices exactes et droits de lecture ; charger les satellites nécessaires via CLAUDE, pas tout le référentiel.

## Décisions acquises

Client canonique identity/profiles ≠ Lead ; plusieurs besoins même catégorie légitimes. Aucun droit par email, nom, organisation ou économie. Conseiller approuvé ET affecté, Admin/MFA, propriétaire Wallet courant. Ne pas fabriquer de grant réel pour tester. Source privée conservée, données structurées/versionnées ≠ PDF ≠ contrat ; choix client ≠ signature/acceptation assureur. Aucune commission estimable sans accord.

Continuité : notification interne persistée atomiquement, lecture ≠ résolution. Horloge depuis attribution notifiée, pas depuis ouverture/acceptation/note. Attentes motivées datées, prochaine action après contact ; reprise humaine CoverView à +4 h après dépassement non justifié. Paramètres Admin versionnés, acceptation par défaut4 h réglable1–24, première action24 h, calendrier désactivé initialement. Europe/Zurich, jours/plage/fermetures explicites, report maximal7 jours. Dates/version figées à l’attribution, changements non rétroactifs ; premières actions historiques+24 h conservées, aucune acceptation rétroactive. Aucun matching/réattribution automatique inventé. Détails au README.

Collaboration : proposition immuable sans accès avant acceptation par destinataire habilité. Co-conseil maintient responsable, lecture/contribution du seul Lead hors notes privées, communication directe seulement si explicite. Apport transmet ce Lead avec progression pour sortant ; transfert durable sans accès opérationnel résiduel. Aucun transfert de toute la relation client/référent de catégorie. Droits propres distincts préexistants conservés. Horloges/attentes inchangées, tâches reprises et RDV futurs sortant annulés à replanifier, invitations obsolètes annulées. Wallet demande un autre interlocuteur sans réattribution promise. Économie seulement référencée, aucun accord/taux/paiement fictif.

**Acquis f41b** : Wallet Offres → reprise du comparateur → demande initiale → confirmation individuelle explicite par propriétaire actuel. Le panier historique ne prouve aucun accord Partner. Invité sans profil : suivi inchangé, claim existant avant transmission. Profil géré créé par submit/claim réutilisé, aucun nouveau client/profil/identité ni rapprochement email. Demande terminée/annulée sans lien : pas de réouverture. Source unique `(request_id, person_id)` + Lead + accord versionné + événement + notification CoverView atomiques ; reprise/rejeu avec nouvelle clé retourne le même Lead. Transfert du profil conserve le Lead et la preuve, retire l’accès ancien propriétaire/rejeu ; sa qualité de créateur ne donne pas un accès Partner implicite. Édition du client/objet/catégorie du Lead lié bloquée. Le conseiller reçoit uniquement cette personne/configuration, aucun email original ni lecture implicite Wallet. Prime indicative/contextuelle, aucune offre reçue ou couverture simulée.

Rattrapage par la liste existante25 demandes puis12 personnes maximum, confirmation de chaque source manquante, liens persistants reprenables. Pas de batch inventant des accords. Cookie invité, submit/claim et historique source conservés ; transitions Admin de la demande et Lead distinctes, aucune synchronisation de statut inventée. Retour Wallet du Lead à la demande initiale filtrée. Snapshot individuel exact en base, inspection structurée dédiée Partner encore à compléter. Le choix explicite d’un profil existant dans le panier lui-même reste un autre parcours.

## Livraison et preuves

**Vérifié V0/V1** : types/lint/builds API/Admin/Partner/Wallet ; Knip quatre apps ; frontières507 modules/2111 dépendances, zéro erreur et trois avertissements www hérités. Migration additive0033 appliquée localement sans reset, génération suivante sans delta. Zéro Lead, lien source et demande soumise dans la base réelle ; aucun grant/dossier/offre/accord de recette. Aucun nouveau secret/paquet/variable/worker.

**Vérifié V2** : campagne finale28 tests PostgreSQL18 Testcontainers (15 insurance-requests,13 Partner),27,47 s. Refus sans profil/consentement/propriété, concurrence/rejeu, aucun client supplémentaire, unicité événement/notification, cookie/historique, transfert par repository Admin, projection familiale, refus ancien propriétaire/session révoquée, blocage réaffectation source. Migrations rejouées, anciens invariants actifs. Tests écrits/revus par le même agent (TEST-10), pas une preuve fournisseur ni indépendante.

**V3 limité** : Chrome sur Wallet4114/API4113 de ce worktree, session réelle : Demandes/Offres vides, lien reprise présent et activé au clavier. Mobile390×844 lisible sans débordement horizontal ; viewport rétabli. Dialogue rempli/accord/Lead/retour source et parcours Partner non vérifiés faute de demande réelle/habilitation. Aucun faux consentement ni données de démonstration créés. Précédents refus candidature Partner et Admin restent valides comme limites, pas comme recette des formulaires.

Roadmap régénérée et check --require-complete passé251 vues/122 slices ; S-110 et S-042a restent ouverts. Node24.13.1 face à engine>=24.20 non masqué. Session demandée gpt-6-astra/ultra, réglage effectif non observable.

## Prochaine action bornée

1. Restaurer le snapshot contrôlé avant code, installer par lockfile, reprendre plan/journal et registre entier.
2. Raccorder le **contrat actuel exact** du même objet/personne à la comparaison Partner/Wallet. Examiner documents/insurance/profils canoniques et transferts ; ne pas dupliquer contrat/patrimoine ou pièces. Proposer seulement une correspondance prouvée ; ambiguïté → confirmation explicite, jamais un contrat arbitraire de même catégorie. Contrat/source/version précis, droits courants à chaque lecture/mutation.
3. Comparaison sourcée : gains ET pertes, franchises/exclusions/conditions, absence/incertitude distinctes ; champs calculés traçables et maintien du contrat possible. Original conservé, choix client séparé de signature et acceptation/émission. PostgreSQL réel pour isolation/concurrence/transferts/révisions ; V3 selon accès disponibles, sans données réelles fabriquées.
4. Conserver et poursuivre **tout** le périmètre : offres/versions/publication/décisions puis signature/contrat final, distribution/référents/matching, marketplace/conditions immuables/économie, statistiques/objectifs/qualité/enquête/réclamations, transcription et canaux externes seulement réellement raccordés. Aucun track supprimé après cette tranche.
5. Au résultat cohérent suivant : plan/journal/README/ledger/couverture/état, checkpoint validé, snapshot vérifié, **UN SEUL relais Astra/ultra**. Après dispatch, cesser écritures applicatives/state, attendre son premier état et donner le lien. Pas de clôture artificielle du brief ni simple promesse.

## Obstacles et tentatives

Compte réel non habilité et aucune demande réelle : avancer sur code/tests indépendants sans donner de droits ni fabriquer de consentement. Pnpm : node C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs install --frozen-lockfile --ignore-scripts. Depuis apps/api : Vitest via ../../node_modules/vitest/vitest.mjs ; Drizzle via node_modules/drizzle-kit/bin.cjs. TypeScript depuis racine. Ne pas répéter le mauvais chemin Vitest.

Corrections f41b : parse Zod synchrone testé avec expect(callback), résultat pg typé pour lint, API_PORT et non PORT. Avertissements hérités : chunks Wallet>500 Ko, import ApplicationPage statique/dynamique, trois orphelins www. Écart DSN-04 : petit formulaire natif à une case, comme motif existant ; textes externalisés. Pas de Textarea UI exporté, conserver composant natif si nécessaire. Rétention/export/effacement et anciens reçus au-delà des bornes restent ouverts.

## Coordination

Une seule tâche propriétaire. Ne pas arrêter/adopter l’API4100 : dernier PID51648, parent55148 « node --watch --import tsx src/main.ts », source/version non vérifiées, étranger à notre lanceur. Anciennes previews8d4a : Partner4104 PID50864/session89908, Wallet4111 PID26768/session36898, Admin4112 PID56200/session76802 ; protéger aussi Wallet4101 PID42564 et Admin4102 PID51012. Vérifier identités/ports avant toute intervention, Docker et sources intacts.

Preview dédiée f41b : **API4113 PID10696/session49221**, **Wallet4114 PID33452/session36155**. API avec PARTNER_JOBS_ENABLED=false et DOCUMENTS_ENABLED=false : aucun second worker sur la base partagée. La dernière API relancée sert le code final. Lanceur ignoré `.planning-local/run-insurance-preview.mjs`, configuration D:/Projects lue en mémoire ; modes migrate/inspect. Wallet VITE_API_URL4113. Cette preview ne prouve pas les routes documentaires désactivées ; ne pas les activer avec un deuxième worker sans résoudre la propriété du runtime existant. Vérifier le PID avant remplacement, ne transporter aucun secret. Aucun onglet/viewport navigateur temporaire nécessaire au relais.
