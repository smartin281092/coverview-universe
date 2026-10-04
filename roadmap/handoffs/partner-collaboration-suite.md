# Reprise de travail — Partner, collaboration explicite

Créé : 2 octobre 2026. Contexte observé : non disponible ; relais à un résultat cohérent, aucun seuil inventé.

## Mission et autorisation

Poursuivre le brief Partner **intégral** du 2 octobre, dernier ordre utilisateur « Recommence ». Autonomie maximale et relais séquentiels Astra/ultra autorisés par roadmap/execution-policy.md. Une seule tâche propriétaire, sans sous-agent ni écriture applicative concurrente. Ne pas reconstruire le socle et ne pas clore le brief après cette tranche. Le texte utilisateur est dans references/coverview-partner-2026-10-02.md, son registre dans roadmap/partner-coverage.md.

## État du dépôt

Propriétaire sortant : C:/Users/sebm1/.codex/worktrees/fb54/coverview-astra ; HEAD détaché **4fef49a095739260b9ab9d1becc1a2bf3320a928**. Les 446 fichiers WIP du relais 52d5 ont été restaurés après vérification du manifeste attendu et de chaque fichier. Aucun commit global du WIP hérité, stash, reset, push ni déploiement. Le code exige le WIP, pas seulement HEAD.

Nouvel instantané immuable : C:/Users/sebm1/.codex/worktrees/fb54/coverview-astra/.planning-local/partner-relay-settings-20261002/. Empreinte manifest.json transmise dans le prompt de lancement. Avant mutation : vérifier empreinte, HEAD et propreté, lire restore.mjs puis l'exécuter avec le chemin absolu du worktree neuf. Il refuse sa source et tout worktree modifié, vérifie toutes les empreintes. Si le worktree neuf est propre mais au mauvais HEAD, le placer sans reset sur le SHA exact. Si restauration partielle : inspecter/réconcilier, ne jamais écraser/reset indistinctement. Secrets/.env/dépendances/builds/bmpartners exclus ; .env.example contient les seuls placeholders versionnés.

D:/Projects/coverview-astra, le worktree 52d5 et désormais fb54 sont des sources **en lecture seule** pour le relais. D:/Projects porte réellement codex/health-map-polish, pas main. Configuration locale uniquement lue en mémoire. Après dispatch, seul le fichier ignoré dispatch.json peut être écrit par le sortant.

## Sources à lire

AGENTS.md, CLAUDE.md, PROJECT.md, docs/codex.md, MEMORY actives ; roadmap/plans/partner-core.plan.md **et son journal**, roadmap/evidence/partner-core.md, roadmap/partner-coverage.md. README propriétaire apps/api/src/modules/partner-workspace/README.md, ADR-0010, apps/partners/README.md et Wallet Offres. Brief I.3/10/11/19–20 et II.2/8/16 pour collaboration ; puis I.6/II.2 et README insurance-requests pour le raccordement. Charger les satellites utiles via CLAUDE, pas la bible entière.

## Décisions acquises

Client canonique identity/profiles ≠ Lead ; plusieurs Leads même catégorie légitimes. Aucun accès par email, organisation ou droit économique. Conseiller validé et affecté, Admin/MFA, propriétaire Wallet courant. Ne pas fabriquer de grant réel pour tester. Source privée originale conservée, offre structurée/versionnée ≠ PDF ≠ contrat ; choix client ≠ signature/acceptation assureur. Aucune rémunération estimable sans accord.

Continuité : notification interne persistée atomiquement = livraison dans l'application, pas email/SMS. Lire ≠ résoudre. Horloge depuis attribution notifiée ; ouverture/acceptation/note ne la réinitialisent pas. Attentes avec motif/réexamen, prochaine action après contact, reprise humaine CoverView +4 h après dépassement non justifié, zéro matching ou réattribution automatique inventée. Retrait/expiration d'accès traite tâches/RDV via handoffWork. Audit système explicite partner-continuity-v1, aucun utilisateur artificiel.

Paramètres maintenant livrés : version Admin immuable, motif/auteur/date, API GET/POST /admin/partner/continuity ; page Admin /partner/continuity. Défauts délégués et limites canoniques dans README : acceptation 4 h réglable 1–24, première action 24 h calendaires, calendrier désactivé initialement. Plage/jours/fermetures explicites Europe/Zurich peuvent reporter une échéance hors plage à l'ouverture suivante, maximum 7 jours. Dates et version figées par attribution ; changement de politique non rétroactif. Anciens Leads sans nouvelles dates : première action +24 h conservée, aucune acceptation rétroactive. Délai d'acceptation dépassé => alertes responsable/Admin, pas déplacement de première action ni reprise anticipée. Absences individuelles et matching restent ouverts.

## Livraison et preuves

**Vérifié V0/V1** : types et builds API/Admin/Partner/Wallet, lint ciblé et Knip quatre apps. Frontières 498 modules/2 055 dépendances, zéro erreur et 3 avertissements www préexistants. Migration additive 0031 appliquée localement, hash retrouvé dans Drizzle, génération suivante sans delta. Base locale observée : zéro Lead, zéro politique persistée ; aucune donnée/grant de test dans ce runtime. Aucun secret, dépendance ou variable nouvelle.

**Vérifié V2** : 9 tests Partner PostgreSQL finaux passent (11,04 s), migrations rejouées deux fois en Testcontainers. Six scénarios antérieurs plus Admin/MFA/concurrence/révisions/rejeu/dates figées, acceptation/alertes/résolution/compteurs/filtres, calendrier/DST/fermeture/plafond. La paire SQL de dates et la politique nulle sont protégées. Tests du même agent, pas une revue indépendante. Les déplacements temporels du test de rappel déplacent désormais les dates figées sans changer les assertions. Les filtres/listes et dashboard de retard ne reposent plus seulement sur due_at.

**V3 limité** : navigateur Chrome, Admin 4112 /partner/continuity avec session réelle => « Accès réservé — Ce compte n'a pas accès à cet espace ». Formulaire opérationnel, historique et mobile non vérifiés avec compte habilité. Ne pas relancer une recette privilégiée en inventant une permission. Précédent relais : Wallet vide/filtre mobile et candidature Partner observés. Aucun email/SMS, offre, signature ou message externe de test.

Roadmap régénérée puis check --require-complete passé : 251 vues/122 slices. S-110 et S-042a restent ouverts ; la preuve de planification ne prouve pas la livraison du brief. Détails et corrections dans ledger/plan.

## Prochaine action bornée

1. Restaurer l'instantané dans le worktree neuf, installer via lockfile, vérifier les sources et reprendre le plan.
2. Réaliser **collaboration/co-conseil/transfert explicites** : apport ponctuel, co-conseil avec référent maintenu, transfert durable. Périmètre, accès, communications, responsabilités et accord explicites ; liberté du client conservée. Réutiliser contributor/assign/handoffWork/notifications/audit existants, compléter leur parcours réel et protections. Aucun accès collectif implicite, matching ou accord économique fictif. Examiner notamment les collaborateurs déjà stockables mais sans commande/UI publique complète. Conserver l'historique, notes privées, documents, tâches et RDV.
3. Raccorder les demandes insurance-requests aux Leads sans double client ni rupture du suivi invité/Wallet, des profils et consentements. Puis continuer les autres tracks du registre : contrat exact actuel/comparaison sourcée, distribution/économie/qualité/signature lorsque preuve réelle disponible.
4. Au résultat cohérent suivant, actualiser ledger/couverture/état et créer **un seul relais autorisé** avec tout le périmètre. Ne pas se contenter d'une promesse de continuer et ne pas déclarer le brief terminé.

## Obstacles et tentatives

Compte navigateur non habilité ; poursuivre tout travail indépendant. Node 24.13.1 dans PATH face à engine >=24.20 : écart hérité non masqué. Pnpm fonctionnel : C:/Users/sebm1/AppData/Local/pnpm/.tools/@pnpm+exe/12.3.4/node_modules/@pnpm/exe/bin/pnpm.mjs ; install --frozen-lockfile --ignore-scripts. Workspaces api/client/admin/partners. TypeScript depuis racine, Vitest depuis apps/api, drizzle generate depuis apps/api.

Ne pas répéter : réattribuer au même conseiller est un conflit métier, pas une erreur à supprimer ; Textarea n'est pas exporté par UI (contrôle natif existant utilisé) ; Omit doit être distributif sur LeadCommand ; propriété cursor:undefined non admise par exactOptionalPropertyTypes ; recherche racine Wallet contient profile, à filtrer pour contrat strict notifications. Le nouveau conseiller ne peut pas rattacher seul un client sans accès préalable. Les lectures d'audit doivent conserver la projection d'acteurs système. Une API antérieure aux dates figées ignorerait le calendrier : conserver une version compatible après activation, ne pas effacer les tables au rollback.

La migration 0031 générée a été ajustée avant application pour CHECK/NULL et compatibilité des anciennes écritures ; schéma/snapshot/migration alignés, drizzle generate sans delta. Aucun test désactivé. Avertissements hérités : chunks Wallet >500 Ko, import ApplicationPage statique/dynamique Partner, trois orphelins www.

## Coordination

Une seule tâche propriétaire ; aucune écriture applicative/state.json dans fb54 après dispatch. Snapshot immuable. Les anciens API29928/Partner47352/Wallet53152 de 52d5 ont été arrêtés seulement après vérification PID/commande/port.

Runtime fb54 : **API4100 PID49656, session7304** ; **Partner4104 PID55496, session74729** ; **Wallet4111 PID57032, session53946** ; **Admin4112 PID53520, session19233**. Vérifier encore PID/commande/port avant remplacement. Les Vite préexistants **Wallet4101 PID42564 / Admin4102 PID51012** sont protégés : ne pas les arrêter/adopter. Autres stacks Docker intactes. Les modifications d'un nouveau worktree ne sont pas servies par ces processus.

Lanceur local ignoré .planning-local/run-partner-api.mjs dans fb54 : previewEnvironment('D:/Projects/coverview-astra','api') lu en mémoire, AUTH_PARTNER_ORIGIN=4104, CORS inclut4111/4112, PARTNER_JOBS_ENABLED=true. Le mode migrate exécute seulement maintenance migrate. Aucune copie/affichage de secret. AUTH_ADMIN_ORIGIN reste celui de la configuration source ; 4112 est une surface de recette partageant le cookie existant, pas une nouvelle configuration AuthKit. Un seul worker propriétaire par runtime ; désactiver celui d'une API secondaire partageant la base.

CUA Chrome id2 : précédents onglets Partner2058645000 et Wallet2058645014. Admin de recette2058645023 était un onglet de refus, non conservé volontairement. Aucun viewport temporaire actif. Lire la documentation CUA à toute nouvelle session ; pas de capture Codex hors vocal.
