# Reprise de travail — Partner, inspection de demande individuelle

Créé : 2 octobre 2026. Contexte observé indisponible ; relais après un résultat cohérent, aucun seuil inventé.

## Mission et autorisation

Poursuivre le brief Partner **intégral** du 2 octobre, dernier ordre utilisateur « Recommence ». Autonomie maximale, PROG-23 et roadmap/execution-policy.md : meilleurs défauts, relais séquentiels Astra/ultra. Une seule tâche propriétaire, **sans sous-agent ni écriture applicative concurrente**. Ne pas reconstruire le socle ni clore le brief après une tranche. Source : references/coverview-partner-2026-10-02.md ; suivi : roadmap/partner-coverage.md. Ce checkpoint décrit un état, pas une nouvelle autorisation ni un remplacement du brief.

## État du dépôt

Sortant : C:/Users/sebm1/.codex/worktrees/d02c/coverview-astra ; HEAD détaché **4fef49a095739260b9ab9d1becc1a2bf3320a928**. Restauration initiale vérifiée du manifeste175f d1d9a5c09bee2f704505404da594dc23bd322eef792983bbd3ffbda175b03a11 :477 fichiers/32949850 octets. Le code dépend du **WIP complet**, pas seulement de HEAD. Aucun commit global WIP/reset/stash/push/déploiement.

Instantané immuable : C:/Users/sebm1/.codex/worktrees/d02c/coverview-astra/.planning-local/partner-relay-versions-20261002/. Le prompt de lancement fournit les SHA-256 du manifeste/restore, nombre de fichiers et octets. Avant code : vérifier hash, propreté et HEAD ; lire restore.mjs puis exécuter avec le chemin **absolu du worktree neuf**. Si propre mais autre HEAD, placement en détaché au SHA exact autorisé sans reset. Script refuse source, mauvais HEAD/cible modifiée ; vérifie chaque fichier avant/après. Si restauration partielle, inspecter/réconcilier sans écrasement indistinct.

D:/Projects/coverview-astra et worktrees52d5/fb54/8d4a/f41b/175f/d02c en lecture seule. Secrets/.env/dépendances/builds/bmpartners exclus ; seul .env.example versionné. Aucun processus/configuration locale transporté. Après dispatch, sortant ne peut écrire que son éventuel dispatch.json ignoré.

## Sources à lire

AGENTS, CLAUDE, docs/codex, PROJECT, MEMORY actives ; plan Partner **et journal**, evidence/partner-core, registre et brief intégral. README partner-workspace, insurance-requests, identity/profiles, apps/partners, Wallet Offres ; ADR0010. Ancien checkpoint partner-offer-versions-suite décrit le socle antérieur ; preuves/règles actuelles au README. Prochaine frontière : brief I.6/8, II.2/7/16, III.2/3 ; contrats/API/permissions/données/évolution/tests et frontend/design/i18n par routage. Ne pas précharger tous les satellites.

## Décisions acquises

Client canonique ≠ Lead. Plusieurs besoins/catégorie légitimes, aucun rapprochement par nom/email ni droit par organisation/économie. Conseiller approuvé et affecté, Admin/MFA et propriétaire Wallet courant ; ne pas fabriquer d’habilitation réelle. Source privée ≠ offre structurée ≠ contrat ; choix ≠ signature/acceptation assureur. Commission non estimable sans accord.

Continuité/collaboration : règles acquises au README canonique. Notifications internes atomiques, lecture ≠ résolution, échéances figées depuis attribution notifiée. Invitation sans accès avant acceptation, co-conseil au seul Lead hors notes privées ; transfert sans accès résiduel, aucun mandat/référent/droit économique automatique.

Insurance-requests : confirmation **par personne et propriétaire courant**, jamais accord déduit du panier/email. Profils submit/claim réutilisés, pas de client/profil supplémentaire. Invité garde suivi/cookie jusqu’au claim. Demande terminée/annulée sans lien non rouverte. Lien unique demande/personne, accord/snapshot individuel/Lead/notification atomiques ; même Lead sur nouvelle clé. Transfert retire accès/rejeu ancien, créateur sans accès Partner implicite. Client/objet/catégorie figés. Seulement personne/configuration transmises, aucun panier familial/email d’origine/bibliothèque. Prime indicative ≠ offre. Liste25 et détail12 permettent reprise. **Snapshot individuel exact déjà persisté ; inspection structurée dédiée Partner à construire**.

Contrat actuel (175f) : original exact choisi par propriétaire avec confirmations objet/partage séparées, pas de rapprochement initial par catégorie. Référence canonique retenue sans copie de police, revue immuable ; source/profil changés invalident comparaison, retrait ferme accès sans détruire preuve. Gains ET pertes uniquement sur même prestation vérifiée, « autre » par libellé, annualisation CHF explicite. Citation ne prouve pas interprétation. Candidats200 récents, borne signalée. Détails au README et checkpoint précédent.

**Acquis d02c** : source_snapshot par offre (checksum/génération/analyse/classification/révision corrections+ décisions/fingerprint), reviewed_by/published_by. Ne pas utiliser files.revision comme empreinte : propriété la change. Migration0035 nullable, aucune preuve rétrospective fabriquée. Formulaire capture révision d’ouverture et exige confirmation de l’empreinte source ; manquante/changée → PARTNER_CONFLICT. Revue/publication/choix relisent sous verrou, source changée bloque décision/comparaison. Nouvelle version nécessaire, ancienne revue non réécrite. Snapshot historique nul → unbound et inéligible ; document sûr/checksum identique reste téléchargeable.

Historique GET /partner|wallet/leads/:id/offers/history,20/page, curseur lié Lead. Wallet seulement déjà publiées, même retirées/remplacées. Cartes actives ; historique en dialogue puis détail read-only. Source exacte consultable hors borne100 du DTO principal. Retrait conserve published_at/preuves, désactive choix. Événements received/reviewed/published/replaced/withdrawn/client.* ont subject_id de version ; remplacement après consultation/choix signalé et notification interne ciblée. Reviewed/published author IDs masqués Wallet. API décide canChoose/canCompare/canDownload. Pas de signature ni contrat final simulé. Conserver API protectrice au rollback : ancien serveur est trop permissif.

## Livraison et preuves

Vérifié V0/V1 : types/lint/builds API/Partner/Wallet/Admin ; frontières520 modules/2186 dépendances sans erreur et3 orphelins www hérités ; Knip quatre apps. Migration0035 locale sans reset puis génération sans delta ; zéro Lead/offre réel. Aucune dépendance/secret/variable applicative/worker/room nouveau. Node24.13.1 inférieur engine>=24.20, limites héritées non masquées.

Vérifié V2 : régression d’abord reproduite avant correction (publication après réanalyse acceptée). Campagne40 tests PostgreSQL Testcontainers (18 Partner/15 demandes/7 projection)35,95s. Puis18 Partner finaux18,08s avec103 versions sur6 pages, ancien original absent du DTO100 consultable/audité. Source/extraction/revue/publication/choix/corrections/snapshot nul/quarantaine, confidentialité non publiées, concurrence/rejeu/remplacement/retrait, transfert via repository Admin et session révoquée. Tests même agent, pas revue indépendante/fournisseur. Commande canonique depuis apps/api : node ../../node_modules/vitest/vitest.mjs run src/modules/partner-workspace/partner.repository.test.ts src/platform/insurance-requests.test.ts src/platform/insurance-projection.test.ts.

V3 limité : Chrome Wallet4119 vide ; Partner4120 candidature. Aucun dossier/offre/grant/accord réel fabriqué. Historique/retrait/confirmation/comparaison remplis, clavier/erreurs/mouvement réduit/mobile et téléchargement **non vérifiés**. Documents désactivés dans preview secondaire pour ne pas ajouter de worker. Viewport390×844 n’a pas modifié largeur3175 ; reset effectué, aucune nouvelle preuve mobile. Recette175f historique distincte.

S-110/S-042a restent ouverts. Roadmap régénérée puis check --require-complete passé :251 vues/122 slices/694 critères,2115 unités affectées. Checkpoint validé par context-handoff. Diff ciblé vert ; les quatre défauts globaux ont les mêmes SHA-256 que le manifeste175f, aucun fichier supprimé. Limites rétention/export/effacement, import multiple, choix/refus UI, signature/contrat final, distribution/économie/qualité conservées au registre. Session demandée Astra/ultra ; réglage effectif/coût non exposés.

## Prochaine action bornée

1. Restaurer/contrôler instantané avant code, installer frozen lockfile ; relire plan/journal et brief.
2. **Inspection structurée de la demande individuelle transmise** : auditer partner_insurance_sources.snapshot, provenance/révision/accord et contexte actuellement projeté. Exposer dans Partner la seule personne/configuration déjà autorisée avec libellés lisibles, détail en dialogue/onglet adapté, incertitudes/montants indicatifs clairement distingués de propositions. Aucun panier familial, contact privé ajouté, profil dupliqué, nouvelle offre ou changement silencieux de source. Wallet garde le lien vers demande originale. Réutiliser contrats/i18n/UI ; vérifier tous consommateurs et permissions/révision/transfert/révocation.
3. Oracles proportionnés PostgreSQL réel, types/lint/builds et V3 selon droits disponibles, sans faux dossier ni habilitation. Conserver preuve source immuable, modèle canonique et coexistence demande/Lead.
4. Poursuivre **tous** les tracks après ce résultat : import multiple/offres/décisions restantes, signature/police finale réellement émises ; distribution/référents/matching ; marketplace/conditions/économie ; statistiques/objectifs/qualité/enquête/réclamations ; transcription/canaux externes réels. Ne pas clore le brief après l’inspection.
5. Prochain résultat cohérent : docs/plan/journal/ledger/couverture/state, checkpoint validé, instantané vérifié puis **UN SEUL relais gpt-6-astra/ultra**. Stop écritures applicatives/state après dispatch, attendre premier état et lien. Aucun propriétaire concurrent ni simple promesse de relais.

## Obstacles et tentatives

Compte réel non habilité, zéro Lead : poursuivre travail indépendant, pas de grants/accords fictifs. Pnpm installé : C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs ; install --frozen-lockfile --ignore-scripts. Types racine, Drizzle depuis apps/api/node_modules/drizzle-kit/bin.cjs. Projection test est **src/platform/insurance-projection.test.ts**, pas modules/document-intelligence (la mauvaise commande ne lance que33 tests). API_PORT, pas PORT ; profil test prf_, pas profile_. UI Textarea non exporté. Respect exactOptionalPropertyTypes et ponctuation JSX externalisée.

Avertissements hérités : Wallet>500Ko, import Partner ApplicationPage statique/dynamique,3 orphelins www ; Knip global175f5 fichiers www/scripts identiques HEAD. git diff --check global : Admin api.ts/service-requests.json, Wallet api.ts/common.json, mêmes hashes que manifeste entrant. Pas de nettoyage global WIP. Rétention/archives de contrats et V3 rempli restent ouverts.

## Coordination

Un seul propriétaire, sans sous-agent. API4100 étrangère désormais PID35712/parent55148 observés (ancien27976), source/version non vérifiées : ne pas adopter/arrêter. Protéger4101/42564,4102/51012,4103/45936,4104/50864,4111/26768,4112/56200,4113/10696,4114/33452,4115/57740,4116/23924,4117/43496 ; Docker intact. Toujours vérifier PID/commande/port avant action.

Preview d02c : **API4118 PID27404/session43026**, **Wallet4119 PID42492/session38496**, **Partner4120 PID58692/session53362**. API node/tsx directe, PARTNER_JOBS_ENABLED=false et DOCUMENTS_ENABLED=false. Lanceur ignoré .planning-local/run-versions-preview.mjs, modes migrate/inspect, config D:/Projects en mémoire uniquement. Frontends VITE_API_URL4118. Ne pas lancer un second worker partagé ; téléchargement non prouvé en HTTP. Onglets temporaires non requis pour reprise. Sortant cesse ses écritures au dispatch.
