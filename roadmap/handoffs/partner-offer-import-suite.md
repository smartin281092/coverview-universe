# Reprise de travail — Partner, import multiple d’offres

Créé : 2 octobre 2026. Contexte observé indisponible ; relais après résultat cohérent, aucun seuil inventé.

## Mission et autorisation

Poursuivre le brief Partner **intégral** du 2 octobre, dernier ordre utilisateur « Recommence ». Autonomie maximale, PROG-23 et roadmap/execution-policy.md : meilleurs défauts, relais séquentiels **gpt-6-astra / ultra**. Une seule tâche propriétaire, **sans sous-agent ni écriture applicative concurrente**. Ne pas reconstruire le socle ni clore le brief après une tranche. Source : references/coverview-partner-2026-10-02.md ; suivi : roadmap/partner-coverage.md. Ce checkpoint décrit un état, pas une nouvelle autorisation ni un remplacement du brief.

## État du dépôt

Sortant : C:/Users/sebm1/.codex/worktrees/7a52/coverview-astra ; HEAD détaché **4fef49a095739260b9ab9d1becc1a2bf3320a928**. Restauration d02c vérifiée : manifeste2992bec54dfe59a80c8046608ed5001d7332909d969e22a165645ad20315e7c9,485 fichiers/33338513 octets. Le code dépend du **WIP complet**, pas seulement de HEAD. Aucun commit global WIP/reset/stash/push/déploiement.

Instantané immuable : C:/Users/sebm1/.codex/worktrees/7a52/coverview-astra/.planning-local/partner-relay-inspection-20261002/. Le prompt de lancement fournit SHA-256 du manifeste/restore, nombre de fichiers et octets. Avant code : vérifier les hashes, propreté et HEAD ; lire restore.mjs puis exécuter avec le chemin **absolu du worktree neuf**. Si propre mais autre HEAD, placement en détaché au SHA exact autorisé sans reset. Script refuse source, mauvais HEAD/cible modifiée ; vérifie chaque fichier avant/après. Si restauration partielle, inspecter/réconcilier sans écrasement indistinct. Installer frozen lockfile sans scripts.

D:/Projects/coverview-astra et worktrees52d5/fb54/8d4a/f41b/175f/d02c/7a52 en lecture seule. Secrets/.env/dépendances/builds/bmpartners exclus ; seul .env.example versionné. Aucun processus/configuration locale transporté. Après dispatch, sortant ne peut écrire que son éventuel dispatch.json ignoré.

## Sources à lire

AGENTS, CLAUDE, docs/codex, PROJECT, MEMORY actives ; plan Partner **et journal**, evidence/partner-core, registre et brief intégral. README partner-workspace, apps/partners, Wallet Offres et ADR0010 ; README document-intelligence/files à la frontière d’import. Ancien checkpoint partner-request-inspection-suite décrit le socle d02c ; règles actuelles aux README canoniques. Prochaine frontière : brief III.1/4–5/15 et III.11–13, I.8/13 ; contrats/API/permissions/données/évolution/tests, frontend/design/i18n, stockage/événements/jobs selon routage. Ne pas précharger tous les satellites.

## Décisions acquises

Client canonique ≠ Lead. Plusieurs besoins/catégorie légitimes, aucun rapprochement par nom/email ni droit par organisation/économie. Conseiller approuvé et affecté, Admin/MFA et propriétaire Wallet courant ; ne pas fabriquer d’habilitation réelle. Source privée ≠ offre structurée ≠ contrat ; choix ≠ signature/acceptation assureur. Commission non estimable sans accord.

Continuité/collaboration : règles au README canonique. Notifications internes atomiques, lecture ≠ résolution, échéances figées depuis attribution notifiée. Invitation sans accès avant acceptation, co-conseil au seul Lead hors notes privées ; transfert sans accès résiduel, aucun mandat/référent/droit économique automatique.

Insurance-requests : confirmation **par personne et propriétaire courant**, jamais accord déduit du panier/email. Profils submit/claim réutilisés, pas de client/profil supplémentaire. Invité garde suivi/cookie jusqu’au claim. Demande terminée/annulée sans lien non rouverte. Lien unique demande/personne, accord/snapshot/Lead/notification atomiques ; même Lead sur nouvelle clé. Transfert retire accès/rejeu ancien, créateur sans accès Partner implicite. Client/objet/catégorie figés. Seulement personne/configuration transmises, aucun panier familial/email d’origine/bibliothèque. Prime indicative ≠ offre. Liste25 et détail12 permettent reprise.

Contrat actuel (175f) : original exact choisi/partagé par propriétaire, jamais par catégorie. Référence canonique sans copie ; source/profil changés invalident comparaison, retrait ferme accès sans détruire preuve. Gains ET pertes sur même prestation vérifiée, annualisation CHF explicite, candidats200 récents. Détails au README canonique.

Offres (d02c) : source_snapshot par version (checksum/génération/analyse/classification/révision corrections+décisions/fingerprint), reviewed_by/published_by. files.revision ne définit pas l’empreinte : propriété la change. Migration0035 nullable, aucune preuve rétroactive fabriquée. Formulaire capture révision d’ouverture et exige confirmation de l’empreinte source ; absente/changée → PARTNER_CONFLICT. Revue/publication/choix relisent sous verrou ; source changée bloque décision/comparaison. Nouvelle version requise, ancienne revue non réécrite. Historique sans snapshot → unbound/inéligible ; original sûr de checksum identique reste téléchargeable.

Historique /partner|wallet/leads/:id/offers/history,20/page, curseur lié Lead ; Wallet seulement déjà publiées, même retirées/remplacées. Cartes actives, détail read-only, source consultable hors borne100. Retrait conserve published_at/preuves et désactive choix. Événements liés à la version ; remplacement après consultation/choix signalé/notifié. Auteurs masqués Wallet. API décide canChoose/canCompare/canDownload ; conserver API protectrice au rollback. Règles détaillées au README.

**Acquis 7a52** : GET /partner/leads/:id/insurance-request lit seulement partner_insurance_sources après contrôle actuel sous verrous session/habilitation/Lead. Conseiller/co-conseiller lecture opérationnelle, responsable habilité/Admin-MFA ; pas créateur Wallet non affecté, collègue, invitation ou progression seule. Contrat insuranceLeadSourceSchema réutilise insuranceItemSchema ; identité/profil/modèle/localité/franchise/accident/région incohérents → unavailable/null, provenance conservée. Dialogue depuis synthèse : données déclarées, configuration, prime indicative, absences/incertitudes, accord/date/révision figés. Année tarifaire absente, jamais déduite du catalogue ou de redistribution. Changements source/profil ne réécrivent pas la preuve. Consultation auditée assigned, dédupliquée30min, aucune révision/action utile/notification/offre changée. Aucun schéma nouveau. Cache privé, purge à fermeture, relecture15s/masquage sur erreur. Wallet garde sa demande originale.

## Livraison et preuves

V0/V1 : types/lint/builds quatre apps, frontières521 modules/2193 dépendances sans erreur (3 orphelins www hérités), Knip ciblé. Dernière correction Intl vérifiée Partner. Aucune dépendance/secret/variable/room/worker/migration nouvelle. Compatibilité/rollback au README. Zéro Lead/source/demande soumise réels, comptages seulement.

V2 : **41 tests PostgreSQL Testcontainers** (18 Partner,16 demandes,7 projection),66,15s. Confidentialité d’une personne, preuve immuable, invitation/co-conseil/retrait/progression/affectation, expiration/MFA/session révoquée, incohérences, audit concurrent ; transfert réel de profil via repository Admin et preuve inchangée. Commande depuis apps/api : node ../../node_modules/vitest/vitest.mjs run src/platform/insurance-requests.test.ts src/modules/partner-workspace/partner.repository.test.ts src/platform/insurance-projection.test.ts. Même agent, pas revue indépendante ni intégration fournisseur.

V3 limité : Chrome Wallet4122 vide ; Partner4123 candidature. Aucun dossier/offre/grant/accord réel fabriqué. Dialogue d’inspection, historique/retrait/confirmation/comparaison remplis, clavier/erreurs/mouvement réduit/mobile et téléchargement **non vérifiés**. Documents désactivés dans preview secondaire pour ne pas ajouter de worker. Tentative mobile d02c sans effet, ne pas la revendiquer ; recette mobile175f historique distincte.

S-110/S-042a ouverts. Roadmap et checkpoint contrôlés avant instantané selon ledger. Node24.13.1 sous engine>=24.20 ; session demandée Astra/ultra, réglage effectif/coût non exposés. Rétention/export/effacement restent ouverts ; aucune durée juridique inventée.

## Prochaine action bornée

1. Restaurer/contrôler instantané avant code ; relire plan/journal et brief, consigner la décision déléguée.
2. **Import multiple d’offres** : auditer l’ajout unitaire et la chaîne documentaire privée. Sélectionner plusieurs originaux pour un même Lead/objet autorisé, progression/résultat/réessai par document, états d’analyse/quarantaine/absent/incertain visibles. Plusieurs documents ≠ une seule offre ni publication automatique. Préserver empreinte exacte confirmée, révision figée du formulaire, idempotence/concurrence et historique ; aucun doublon au rejeu, aucun remplacement d’une autre version par simple nom. Réutiliser stockage/contrats/composants existants. Choisir la frontière d’implémentation la plus petite donnant un parcours cohérent, sans service simulé ni extraction inventée.
3. Oracles proportionnés PostgreSQL réel, droits/courses/erreurs partielles/reprise, types/lint/builds et V3 selon accès réels, sans faux dossier ni habilitation. Revoir tous consommateurs et retours d’erreur, annulation/fermeture et source changée avant sauvegarde/publication. Décisions restantes (dont refus UI) à poursuivre ensuite selon budget cohérent.
4. Poursuivre **tous** les tracks : décisions/signature/police finale réellement émises ; distribution/référents/matching ; marketplace/conditions/économie ; statistiques/objectifs/qualité/enquête/réclamations ; transcription/canaux externes réels. Ne pas clore le brief après import multiple.
5. Prochain résultat cohérent : docs/plan/journal/ledger/couverture/state, checkpoint validé, instantané vérifié puis **UN SEUL relais gpt-6-astra/ultra**. Stop écritures applicatives/state après dispatch, attendre premier état et lien. Aucun propriétaire concurrent ni simple promesse de relais.

## Obstacles et tentatives

Compte réel non habilité, zéro Lead : poursuivre travail indépendant, pas de grants/accords fictifs. Pnpm installé : C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs ; install --frozen-lockfile --ignore-scripts. Types racine, Drizzle depuis apps/api/node_modules/drizzle-kit/bin.cjs. Wallet = apps/client (pas apps/wallet) pour Knip/types/builds. Projection test = src/platform/insurance-projection.test.ts. API_PORT, pas PORT ; profil test prf_, pas profile_. UI Textarea non exporté. Respect exactOptionalPropertyTypes et ponctuation JSX externalisée.

Avertissements hérités : Wallet>500Ko, import Partner ApplicationPage statique/dynamique,3 orphelins www ; Knip global175f5 fichiers www/scripts inchangés HEAD. git diff --check global : Admin api.ts/service-requests.json, Wallet api.ts/common.json, comparer leurs SHA-256 au manifeste entrant ; pas de nettoyage global WIP. Rétention/archives de contrats et V3 rempli restent ouverts.

## Coordination

Un seul propriétaire, sans sous-agent. API4100 étrangère PID52956/parent55148 observés (précédemment35712), source/version non vérifiées : ne pas adopter/arrêter. Protéger4101/42564,4102/51012,4103/45936,4104/50864,4111/26768,4112/56200,4113/10696,4114/33452,4115/57740,4116/23924,4117/43496 ; Docker intact. Toujours vérifier PID/commande/port avant action.

Preview d02c protégée : API4118 PID27404/session43026, Wallet4119 PID42492/session38496, Partner4120 PID58692/session53362. Preview7a52 : **API4121 PID37544/session99531**, **Wallet4122 PID54844/session39545**, **Partner4123 PID36552/session72491**. API node/tsx directe, PARTNER_JOBS_ENABLED=false et DOCUMENTS_ENABLED=false. Lanceur ignoré .planning-local/run-inspection-preview.mjs, mode inspect ; config D:/Projects en mémoire seulement. Frontends VITE_API_URL4121. Ne pas lancer un second worker partagé ; téléchargement non prouvé en HTTP. Onglets temporaires non requis pour reprise. Sortant cesse ses écritures au dispatch.
