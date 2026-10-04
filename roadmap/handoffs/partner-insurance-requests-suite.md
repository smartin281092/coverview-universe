# Reprise de travail — Partner, demandes d’assurance existantes

Créé : 2 octobre 2026. Contexte observé non disponible ; relais à un résultat cohérent, aucun seuil inventé.

## Mission et autorisation

Poursuivre le brief Partner **intégral** du 2 octobre, dernier ordre utilisateur « Recommence ». Autonomie maximale et relais séquentiels Astra/ultra autorisés par roadmap/execution-policy.md. Une seule tâche propriétaire, sans sous-agent ni écriture applicative concurrente. Ne pas reconstruire le socle ni clore le brief après cette tranche. Source complète : references/coverview-partner-2026-10-02.md ; registre de chaque exigence : roadmap/partner-coverage.md.

## État du dépôt

Propriétaire sortant : C:/Users/sebm1/.codex/worktrees/8d4a/coverview-astra ; HEAD détaché **4fef49a095739260b9ab9d1becc1a2bf3320a928**. Les 451 fichiers WIP du relais fb54 ont été restaurés après contrôle du manifeste et de chaque fichier. Aucun commit global du WIP hérité, stash, reset, push ni déploiement. Le code exige le WIP, pas seulement HEAD.

Instantané immuable : C:/Users/sebm1/.codex/worktrees/8d4a/coverview-astra/.planning-local/partner-relay-collaboration-20261002/. Empreinte manifest.json fournie dans le prompt de lancement. Avant mutation : vérifier empreinte, HEAD et propreté, lire restore.mjs puis l’exécuter avec le chemin absolu du worktree neuf. Il refuse sa source et tout worktree modifié, vérifie chaque empreinte. Si le worktree neuf est propre mais au mauvais HEAD, le placer sans reset sur le SHA exact. Si restauration partielle : inspecter/réconcilier sans écrasement indistinct. Secrets/.env/dépendances/builds/bmpartners exclus ; .env.example contient les placeholders versionnés.

D:/Projects/coverview-astra, 52d5, fb54 et désormais 8d4a sont des sources **en lecture seule**. D:/Projects porte codex/health-map-polish, pas main. Configuration locale uniquement lue en mémoire. Après dispatch, seul le fichier ignoré dispatch.json peut être écrit par le sortant.

## Sources à lire

AGENTS.md, CLAUDE.md, PROJECT.md, docs/codex.md, MEMORY actives ; roadmap/plans/partner-core.plan.md **et son journal**, roadmap/evidence/partner-core.md et roadmap/partner-coverage.md. README propriétaires partner-workspace, insurance-requests, identity/profiles, apps/partners et Wallet Offres ; ADR-0010. Brief I.6/II.2 et parcours source du panier pour le prochain raccordement ; I.3/10/11/19–20 et II.8/16 pour la collaboration. Charger les satellites utiles via CLAUDE, pas la bible entière.

## Décisions acquises

Client canonique identity/profiles ≠ Lead ; plusieurs Leads même catégorie sont légitimes. Aucun accès par email, organisation ou droit économique. Conseiller validé et affecté, Admin/MFA, propriétaire Wallet courant. Ne pas fabriquer de grant réel pour tester. Source privée originale conservée, offre structurée/versionnée ≠ PDF ≠ contrat ; choix client ≠ signature/acceptation assureur. Aucune rémunération estimable sans accord.

Continuité acquise : notification interne persistée atomiquement = livraison dans l’application, pas email/SMS. Lire ≠ résoudre. Horloge depuis attribution notifiée ; ouverture/acceptation/note ne la réinitialisent pas. Attentes motivées datées, prochaine action après contact, reprise humaine CoverView +4 h après dépassement non justifié ; aucune réattribution automatique inventée. Paramètres Admin versionnés : acceptation 4 h réglable 1–24, première action 24 h calendaires, calendrier désactivé initialement. Jours/plage/fermetures explicites Europe/Zurich ; report maximal 7 jours. Dates/version figées par attribution, changements non rétroactifs ; anciennes premières actions +24 h conservées, aucune acceptation rétroactive. Voir README pour règles exactes.

Collaboration maintenant implémentée : proposition immuable sans accès préalable, responsable/Admin propose et seul le destinataire habilité accepte. Co-conseil maintient le responsable, accès lecture/contribution au seul Lead et communication directe seulement si explicite. Apport ponctuel transmet ce Lead en conservant une projection de progression pour le sortant ; transfert durable transmet le suivi de ce Lead sans accès opérationnel résiduel. Aucun mode ne transfère toute la relation client ni le référent de catégorie. Droits propres préexistants du créateur/manager conservés. Périmètre, responsabilités, communication, motif et référence économique consignés ; aucun accord exécutable, taux ou paiement fictif.

Acceptation conserve horloges/attentes/échéances ; tâches ouvertes reprises, RDV futurs du sortant annulés à replanifier, engagements des autres collaborateurs autorisés préservés. Invitations devenues obsolètes annulées ; retrait d’accès termine la collaboration. Notes privées exclues des projections. Édition de client/objet/catégorie bloquée pendant mission/invitation active. Wallet montre les intervenants et permet une demande motivée d’autre interlocuteur à CoverView, sans réattribution promise. Une notification client découle seulement d’un événement d’audience client.

## Livraison et preuves

**Vérifié V0/V1** : types/lint/builds API/Admin/Partner/Wallet et Knip quatre apps. Frontières 503 modules/2 090 dépendances, zéro erreur et trois avertissements www hérités. Migration additive 0032 appliquée localement, génération suivante sans delta. Base réelle inspectée : zéro Lead, collaboration et politique persistée ; aucun grant/dossier/offre de recette. Aucun secret, dépendance ou variable nouvelle. Derniers builds Partner/Wallet après les traductions passent.

**Vérifié V2** : 13 scénarios Partner PostgreSQL finaux passent en 16,10 s ; migrations rejouées deux fois dans Testcontainers. Les neuf scénarios antérieurs passent ; quatre nouveaux couvrent invitation sans accès, acceptation/rejeu, portée lecture/contribution, notes privées, communication/publication interdites hors périmètre, retrait, transmission et progression, conservation des dates/attentes, reprise tâches/RDV, demande Wallet et deux transferts concurrents avec un seul gagnant. Tests écrits/revus par le même agent (TEST-10), pas une preuve indépendante ou fournisseur.

**V3 limité** : Chrome, /collaborations sur Partner4104 servi par 8d4a, session réelle => « Rejoindre CoverView Partner ». Formulaires de proposition/réponse, historique peuplé, choix des participants, demande Wallet et revue visuelle/clavier/mobile autorisée **non vérifiés** faute d’habilitation. Le précédent refus Admin reste une limite. Aucun email/SMS, offre ou signature envoyé.

Roadmap régénérée puis check --require-complete passé : 251 vues/122 slices ; S-110 et S-042a restent ouverts. Cette preuve de planification ne prouve pas la livraison du brief. État runtime final distinct de la recette ci-dessus : notre API s’est arrêtée, voir Coordination.

## Prochaine action bornée

1. Restaurer le snapshot vérifié dans le worktree neuf, installer par lockfile et reprendre le plan/journal.
2. Raccorder **insurance-requests aux Leads** en réutilisant le panier, les profils et les consentements existants. Examiner submit/claim/transferts et les droits du propriétaire courant avant de choisir le point de raccordement. Lien source unique et idempotent par demande/personne pertinente ; rattrapage borné et reprenable. Ne pas dupliquer les clients ni rapprocher par email/homonymie. Préserver suivi invité par cookie et projection Wallet après rattachement/transfert du profil. Décider explicitement les cas sans propriétaire canonique ou sans accord de transmission, sans créer d’accès implicite.
3. Vérifier en PostgreSQL les doublons/concurrence, projections et transferts ; observer le parcours réel accessible, sans grants inventés. Mettre à jour les README, ledger et couverture avec les limites réelles.
4. Poursuivre tout le registre : contrat actuel exact et comparaison sourcée, distribution/référents/matching, marketplace/accords/économie, qualité/objectifs/enquête/réclamations, transcription/signature/contrat final quand leur raccordement réel est disponible. Aucun track ne disparaît après cette tranche.
5. Au prochain résultat cohérent, actualiser preuves/état/checkpoint, figer une copie vérifiée et créer **un seul relais Astra/ultra autorisé**. Ne pas s’arrêter avec une promesse ni déclarer le brief terminé.

## Obstacles et tentatives

Compte réel non habilité : poursuivre le travail indépendant sans élargir ses droits. Node24.13.1 face à engine>=24.20, écart hérité non masqué. Pnpm fonctionnel : C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs ; install --frozen-lockfile --ignore-scripts. Workspaces api/client/admin/partners ; TypeScript depuis racine, Vitest/drizzle depuis apps/api.

Erreurs corrigées : qualifier c.revision dans UPDATE/FROM ; refus d’accès du lecteur protégé =404, pas403 ; FormData du bouton de décision inclut le submitter ; pas d’export inutilisé ; pas de Textarea exporté dans UI. Réattribution au même conseiller reste un conflit. Omit distributif sur LeadCommand, pas de cursor:undefined en exactOptionalPropertyTypes. Recherche Wallet contient profile à filtrer. Ne pas réintroduire les doubles notifications Wallet ni accorder un droit de contact implicite au co-conseiller. Historique/archives au-delà de 100 reçus bornés, rétention et économie restent ouverts. Avertissements hérités conservés : chunks Wallet >500 Ko, import ApplicationPage statique/dynamique et orphelins www.

## Coordination

Une seule tâche propriétaire, aucune écriture applicative/state.json dans 8d4a après dispatch. Les processus fb54 API49656/Partner55496/Wallet57032/Admin53520 ont été remplacés après vérification d’identité et de port.

Préviews 8d4a encore observées : **Partner4104 PID50864 session89908**, **Wallet4111 PID26768 session36898**, **Admin4112 PID56200 session76802**. Vérifier PID/commande/port avant remplacement ; elles ne servent pas automatiquement le nouveau worktree. Préexistants **Wallet4101 PID42564 / Admin4102 PID51012** protégés. Docker intact.

**Changement constaté en préparation du relais** : notre API4100 PID36716/session69919 est terminée (exit1, origine non établie). Le port4100 est désormais tenu par PID58176, parent55148 « node --watch --import tsx src/main.ts », processus étranger à notre lanceur ; il n’a pas été arrêté/adopté. Le checkout et la version réellement servis sont non vérifiés. Ne pas supposer que les dernières corrections 8d4a sont exposées, ni démarrer un second worker sur la base partagée. Résoudre la propriété du runtime avant toute recette opérationnelle ; le code et les tests isolés peuvent avancer indépendamment.

Lanceur ignoré 8d4a .planning-local/run-partner-api.mjs disponible comme référence : previewEnvironment('D:/Projects/coverview-astra','api') lu en mémoire, AUTH_PARTNER_ORIGIN4104, CORS4111/4112, PARTNER_JOBS_ENABLED=true. Mode migrate=maintenance, inspect=comptages. Ne copier/afficher aucun secret ; AUTH_ADMIN_ORIGIN inchangé,4112 partage le cookie existant. Un seul worker propriétaire. Les snapshots ne transportent ni configuration locale ni processus.

CUA Chrome id2 : Partner2058645000 et Wallet2058645014. Partner est sur /collaborations mais affiche candidature. Aucun viewport temporaire activé par cette tâche. Lire la documentation CUA au début d’une session ; pas de capture Codex hors vocal.
