# CoverView Partner

Dans la synthèse d’un Lead autorisé, « Référent habituel et continuité » ouvre la préférence de catégorie et les raisons/critères encore à examiner. Demande de changement d’interlocuteur et clôture priment la suggestion ; aucune affectation ou disponibilité annoncée par ce dialogue. [Règles canoniques](../api/src/modules/partner-workspace/README.md#référents-habituels-et-continuité--relais-b920). Types/build et PostgreSQL vérifiés ; projection remplie et mobile non vérifiés V3, aucune habilitation réelle créée.

## Résumé

Espace opérationnel des professionnels CoverView : Dashboard → Leads → fiche à onglets, avec Clients comme vue transverse. Le [module API](../api/src/modules/partner-workspace/README.md) possède les règles métier.

## Périmètre

Candidature, supervision des candidatures pour l'Admin habilité, tableau de bord, pipeline Kanban/liste avec filtres URL, création/édition, fiche, tâches, agenda, notes et offres versionnées. L'import utilise le stockage privé existant et propose les données extraites à vérifier. Les versions prêtes sont publiables dans Wallet. Les rubriques non réalisées du brief ne sont pas des écrans de démonstration.

## Règles métier et invariants

Une carte représente une demande, pas une personne. Les mutations transmettent révision et clé idempotente. Un déplacement ouvre le formulaire correspondant et attend le contrôle serveur. Aucun déplacement libre vers « signé ». Dates saisies en Europe/Zurich, montants CHF en centimes via le contrat commun. Les libellés français sont externalisés.

## Permissions

Connexion WorkOS sur la surface `partners`. Aucun accès opérationnel avant approbation ; chaque page est filtrée par le serveur. L'administrateur rejoint le contrôle MFA existant, sans élévation locale. Les données privées sont séparées par utilisateur/session dans Query et relues après chaque mutation. Aucun localStorage de dossier.

## État réel

Build, TypeScript et lint ciblés vérifiés. Candidature mobile et retour WorkOS réels observés. La recette opérationnelle nécessite une session habilitée existante ; aucune permission de test n'a été accordée au compte réel. [Ledger](../../roadmap/evidence/partner-core.md).

## Développement

L’onglet Offres propose la file d’import multiple : 10 originaux par sélection, 20 Mio chacun, envoi séquentiel et résultat/réessai individuel. Les dépôts restent liés au Lead après fermeture ; resélectionner le même fichier termine un envoi interrompu. La file paginée est relue toutes les 5 secondes et indique traitement, quarantaine, lecture partielle/absente/échouée ; seules les capacités API proposent lecture, retry explicite et préparation. L’ajout est masqué en lecture seule. Préparer ouvre le formulaire de revue existant avec la source exacte, aucune publication automatique. [Règles canoniques](../api/src/modules/partner-workspace/README.md#import-multiple-doriginaux--relais-c0e2). V0/V1 et tests PostgreSQL passent ; formulaire rempli, erreurs/clavier/mobile et stockage HTTP réels restent non vérifiés faute d’habilitation/dossier réels.

`pnpm --filter partners dev` : Vite, `127.0.0.1:4104`, port strict. `VITE_API_URL`, `VITE_WALLET_URL`, `VITE_ADMIN_URL` configurent les destinations publiques. Origine API et paramètres AuthKit : [`.env.example`](../../.env.example). Dépendances de la stack déjà utilisée par Wallet/Admin, mêmes versions résolues ; aucune nouvelle bibliothèque tierce introduite.

La page /notifications présente les actions en attente et l'historique avec responsable, priorité, date, lecture personnelle et lien vers le Lead. Admin accède aussi à cette file depuis sa supervision Partner. Actualisation 15 s et invalidation après mutation ; le bouton de lecture ne résout pas l'action. La fiche affiche les échéances calculées par l'API. Ce parcours est couvert en PostgreSQL ; le compte navigateur disponible reste non habilité.

`/collaborations` présente les propositions reçues/envoyées et les reçus après transmission. L'onglet Collaboration du Lead permet au responsable/Admin de proposer une intervention ; les termes sont consultés dans un dialogue, la réponse est explicite. Les tâches/RDV proposent les intervenants autorisés, les commandes visibles suivent les permissions serveur. Cache privé, invalidation après mutation, contrôle optimiste et clé conservée en cas de réessai. Le formulaire principal utilise react-hook-form/Zod existants ; les petits formulaires natifs suivent les composants du module. Aucun accès réel accordé pour la recette : les formulaires opérationnels et leur revue mobile restent non vérifiés V3.

L’onglet Offres montre la référence contractuelle que le propriétaire a explicitement partagée, son original/version et la comparaison calculée côté serveur. Les contributeurs autorisés peuvent vérifier les prestations via un dialogue sourcé ; un type de prestation lisible remplace la saisie de clés techniques. Gains/pertes ensemble, détail en dialogue partagé avec Wallet. [Règles et invalidation](../api/src/modules/partner-workspace/README.md#contrat-actuel-exact-et-comparaison--relais-175f). Aucun accès implicite à la bibliothèque Wallet ; la nouvelle revue visuelle opérationnelle reste non vérifiée faute d’habilitation réelle.

L’ajout/remplacement exige de consulter et confirmer la source exacte ; sauvegarde révisionnée et empreinte contrôlée côté serveur. Revue/publication s’appliquent à cette version, avec auteur/date conservés. Retrait motivé en dialogue distinct ; historique paginé puis détail en lecture seule. L’onglet Offres montre les versions actives et avertit d’une source changée ou d’un remplacement depuis consultation/choix. [Règles canoniques](../api/src/modules/partner-workspace/README.md#versions-doffres-et-publication--relais-d02c). Recette remplie non vérifiée, session réelle toujours limitée à la candidature.

La synthèse d’un Lead issu du comparateur propose « Consulter la demande transmise » aux intervenants opérationnels autorisés. Le dialogue présente la personne et sa configuration historiques, les absences/incertitudes, la prime indicative et la preuve d’accord, sans reconstruire les données depuis le profil ou le catalogue actuels. Cache privé supprimé à fermeture, relecture périodique et masquage du contenu en cas d’erreur d’accès. [Règles d’inspection](../api/src/modules/partner-workspace/README.md#inspection-de-la-demande-individuelle--relais-7a52). Types/lint/build et oracles PostgreSQL passent ; dialogue rempli, clavier et mobile restent non vérifiés V3 faute d’habilitation/dossier réels.

Les réponses Wallet identifient la compagnie, le produit et la version dans les notifications et l'activité. Les réponses ouvertes sont signalées dans la fiche ; leur bouton ouvre le formulaire de contact existant pour consigner l'échange réel et sa prochaine étape. Le lien depuis une notification de réponse rejoint l'activité. La publication d'une nouvelle offre ne masque plus une réponse à traiter. [Règles canoniques](../api/src/modules/partner-workspace/README.md#décisions-wallet-et-suivi-par-version--relais-b9b3). Les types/builds et PostgreSQL sont vérifiés ; le compte réel reste non habilité, recette remplie non effectuée.

« Polices finales » dans l’onglet Offres présente les liens historiques par pages de 20 puis le détail documentaire : version exacte, faits de police, prime annualisée/delta, cinq points sourcés et preuves manquantes. Les contributeurs habilités peuvent contrôler un point ; révision présentée et contenu de retry sont figés, extraits exacts obligatoires pour une concordance/différence. Contrôle masqué si source/droits invalidés, cache privé relu toutes les 10 s. [Règles canoniques](../api/src/modules/partner-workspace/README.md#police-finale-reçue-et-contrôle--relais-1a5a). V0–V2 vérifiés ; V3 limité à la candidature réelle sur 4132, aucun contrôle rempli revendiqué.
