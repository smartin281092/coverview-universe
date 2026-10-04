# CoverView Partner

Fiche Lead → Mon adéquation → Examiner mes conflits : périmètre examiné, trois positions explicites, motif, échéance et confirmation ; retrait/historique privés. [Règles et activation](../api/src/modules/partner-workspace/docs/need-conflicts.md).0050 hors catalogue, V3 rempli/clavier/mobile ouvert.

Fiche Lead → Mon adéquation → « Décider de ma capacité pour ce besoin » : appréciation personnelle, motif/échéance/confirmation vides, retrait et historique privés, sans attribution ni effet sur le suivi. [Règles et activation](../api/src/modules/partner-workspace/docs/need-capacity.md).0049 préparée hors catalogue ; ne pas activer le parcours avant son intégration/migration. V3 rempli/clavier/mobile ouvert.

Profil → « Capacité personnelle » : appréciation privée avec échéance choisie, retrait et historique ; compteurs séparés de responsabilités/contributions. Candidatures permet la lecture Admin. [Règles propriétaires](../api/src/modules/partner-workspace/docs/personal-capacity.md). Migration0048 isolée seulement ; V3 rempli ouvert.

Profil → « Modes partagés avec mes clients » : publication personnelle avec audience explicite, retrait et historique ; consultation Admin depuis Candidatures. Le bilan du référent demande v2 et compare ces seuls modes aux souhaits courants. [Règles propriétaires](../api/src/modules/partner-workspace/docs/shared-modes.md). Migration0047 isolée seulement ; V3 rempli ouvert.

« Référent habituel et continuité » lit désormais le [bilan minimal du référent](../api/src/modules/partner-workspace/docs/referent-assessment.md) : critères langue/canton/mode explicitement partagé et sources datées dans une seconde vue. Demande client/clôture/choix invalide empêchent le bilan candidat ; relecture10s/manuelle et masquage sur erreur. V3 rempli reste ouvert.

Fiche Lead → « Mon adéquation au besoin » : critères séparés langue/canton/mode, compétence documentée, continuité et inconnues, puis sources datées dans une seconde vue du dialogue. « Examiner ma capacité » ouvre une vue remplaçante privée : dernière déclaration, portée/échéance/état et compteurs séparés ; les six vérifications humaines restent ouvertes. Le lecteur demande explicitement v2, cache utilisateur/session/version/Lead et erreur masquant le bilan. Réservé au conseiller personnellement affecté, sans modification du suivi. [Règles et limites](../api/src/modules/partner-workspace/docs/advisor-assessment.md). V3 rempli reste ouvert.

Fiche Lead → Rendez-vous → « Reporter mon rendez-vous » : récapitulatif avant/après, contrôles et nouvelles attestations, même engagement/conseiller et histoire conservée. [Règles](../api/src/modules/partner-workspace/docs/appointment-rescheduling.md). Historique privé dans le contrôle ; notification interne minimale Wallet/Partner. V0–V2 vérifiés,0046 requise et V3 rempli ouvert.

Fiche Lead → Rendez-vous → « Programmer mon rendez-vous » : proposition personnelle avec préparation/trajets, contrôle serveur, récapitulatif et attestations explicites avant création atomique. [Règles](../api/src/modules/partner-workspace/docs/appointment-creation.md). Le suivi existant est réutilisé ; durées/attestations privées.0046 requise, V3 rempli ouvert.

Dans « Contrôler mon rendez-vous », « Organiser mon temps » permet de confirmer préparation et trajets, avec récapitulatif, historique et conflits atomiques. [Règles et limites](../api/src/modules/partner-workspace/docs/appointment-time.md). La date convenue est conservée ; migration0046 requise avant activation, testée en PostgreSQL isolé seulement. V3 rempli reste ouvert.

Agenda et l'onglet Rendez-vous proposent « Contrôler mon rendez-vous » sur ses engagements programmés. Le [contrôle privé](../api/src/modules/partner-workspace/docs/appointment-assessment.md) compare déclarations actuelles, chevauchement et souhait client sans modifier l'engagement. Préparation/déplacement/capacité restent à vérifier ; V3 rempli est ouvert.

Depuis Profil et Agenda, « Modes et disponibilités » ouvre la déclaration personnelle et son historique ; Candidatures permet la consultation Admin. [Règles et limites canoniques](../api/src/modules/partner-workspace/docs/professional-availability.md). Les plages déclarées ne sont pas encore des créneaux réservables et ne modifient pas les rendez-vous convenus. V3 rempli reste ouvert faute de configuration WorkOS.

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

La synthèse opérationnelle du Lead propose « Préférences de conseil », également en supervision Admin : consultation des souhaits confirmés par le propriétaire Wallet, sans édition professionnelle. [Règles et migration0044](../api/src/modules/partner-workspace/docs/advice-preferences.md). V0–V2 vérifiés en6469 ; V3 rempli/clavier/mobile non effectué faute de configuration WorkOS, aucun runtime6469 lancé.

Profil et Candidatures proposent « Langues et zones d'intervention » : déclaration personnelle, lecture Admin, historique paginé et réessai identique. Le résumé autorisé du référent reste déclaratif. [Règles et migration0043](../api/src/modules/partner-workspace/docs/professional-practice.md). V0–V2 vérifiés en ce17 ; formulaire rempli, clavier/mobile non vérifiés, configuration WorkOS source absente et aucun runtime ce17 lancé.

Les dossiers professionnels affichent les parties figées et les périmètres modifiés/inconnus. Candidature et formulaires expliquent la nouvelle déclaration nécessaire ; une modification pendant l'édition laisse le périmètre d'ouverture visible, la reprise est déterminée côté serveur. [Règles et migration0042](../api/src/modules/partner-workspace/docs/professional-scope.md). V0–V2 vérifiés, recette habilitée/clavier/mobile non vérifiée ; aucun runtime lancé en5944 faute de configuration WorkOS source.

Profil/candidature donne accès aux justificatifs professionnels après première candidature ; Admin les examine depuis Candidatures. Dialogue par catégorie avec aperçu/historique20, déclaration+original, reprise/réessai, examen motivé et retrait. Formulaires RHF/Zod, clé/contenu figés au retry, conflit impose relecture, cache privé supprimé à fermeture et masque le contenu après erreur ; favorable indisponible sans original sûr. [Règles canoniques](../api/src/modules/partner-workspace/README.md#justificatifs-professionnels-et-examen--relais-8a00). V0–V2 passent ; V3 8a00 limité à connexion absente puis callback WorkOS4136 refusé. Aucun formulaire rempli, clavier/mobile ou fournisseur réel revendiqué.

Build, TypeScript et lint ciblés vérifiés. Candidature mobile et retour WorkOS réels observés. La recette opérationnelle nécessite une session habilitée existante ; aucune permission de test n'a été accordée au compte réel. [Ledger](../../roadmap/evidence/partner-core.md).

## Développement

Depuis Profil et supervision Candidatures, « Conventions de distribution » ouvre un dossier privé par compagnie/catégorie : dépôt, reprise exacte, examen motivé, retrait et historique paginé. Les parties d'origine et la portée sont visibles ; requête privée relue toutes les 10 s, cache masqué sur erreur, commande figée au réessai et relecture après conflit. RHF/Zod et composants existants ; aucune habilitation déduite. [Règles canoniques](../api/src/modules/partner-workspace/docs/conventions.md). V0–V2 vérifiés ; recette remplie/clavier/mobile non vérifiée, configuration WorkOS source absente en cc1c.

L’onglet Offres propose la file d’import multiple : 10 originaux par sélection, 20 Mio chacun, envoi séquentiel et résultat/réessai individuel. Les dépôts restent liés au Lead après fermeture ; resélectionner le même fichier termine un envoi interrompu. La file paginée est relue toutes les 5 secondes et indique traitement, quarantaine, lecture partielle/absente/échouée ; seules les capacités API proposent lecture, retry explicite et préparation. L’ajout est masqué en lecture seule. Préparer ouvre le formulaire de revue existant avec la source exacte, aucune publication automatique. [Règles canoniques](../api/src/modules/partner-workspace/README.md#import-multiple-doriginaux--relais-c0e2). V0/V1 et tests PostgreSQL passent ; formulaire rempli, erreurs/clavier/mobile et stockage HTTP réels restent non vérifiés faute d’habilitation/dossier réels.

`pnpm --filter partners dev` : Vite, `127.0.0.1:4104`, port strict. `VITE_API_URL`, `VITE_WALLET_URL`, `VITE_ADMIN_URL` configurent les destinations publiques. Origine API et paramètres AuthKit : [`.env.example`](../../.env.example). Dépendances de la stack déjà utilisée par Wallet/Admin, mêmes versions résolues ; aucune nouvelle bibliothèque tierce introduite.

La page /notifications présente les actions en attente et l'historique avec responsable, priorité, date, lecture personnelle et lien vers le Lead. Admin accède aussi à cette file depuis sa supervision Partner. Actualisation 15 s et invalidation après mutation ; le bouton de lecture ne résout pas l'action. La fiche affiche les échéances calculées par l'API. Ce parcours est couvert en PostgreSQL ; le compte navigateur disponible reste non habilité.

`/collaborations` présente les propositions reçues/envoyées et les reçus après transmission. L'onglet Collaboration du Lead permet au responsable/Admin de proposer une intervention ; les termes sont consultés dans un dialogue, la réponse est explicite. Les tâches/RDV proposent les intervenants autorisés, les commandes visibles suivent les permissions serveur. Cache privé, invalidation après mutation, contrôle optimiste et clé conservée en cas de réessai. Le formulaire principal utilise react-hook-form/Zod existants ; les petits formulaires natifs suivent les composants du module. Aucun accès réel accordé pour la recette : les formulaires opérationnels et leur revue mobile restent non vérifiés V3.

L’onglet Offres montre la référence contractuelle que le propriétaire a explicitement partagée, son original/version et la comparaison calculée côté serveur. Les contributeurs autorisés peuvent vérifier les prestations via un dialogue sourcé ; un type de prestation lisible remplace la saisie de clés techniques. Gains/pertes ensemble, détail en dialogue partagé avec Wallet. [Règles et invalidation](../api/src/modules/partner-workspace/README.md#contrat-actuel-exact-et-comparaison--relais-175f). Aucun accès implicite à la bibliothèque Wallet ; la nouvelle revue visuelle opérationnelle reste non vérifiée faute d’habilitation réelle.

L’ajout/remplacement exige de consulter et confirmer la source exacte ; sauvegarde révisionnée et empreinte contrôlée côté serveur. Revue/publication s’appliquent à cette version, avec auteur/date conservés. Retrait motivé en dialogue distinct ; historique paginé puis détail en lecture seule. L’onglet Offres montre les versions actives et avertit d’une source changée ou d’un remplacement depuis consultation/choix. [Règles canoniques](../api/src/modules/partner-workspace/README.md#versions-doffres-et-publication--relais-d02c). Recette remplie non vérifiée, session réelle toujours limitée à la candidature.

La synthèse d’un Lead issu du comparateur propose « Consulter la demande transmise » aux intervenants opérationnels autorisés. Le dialogue présente la personne et sa configuration historiques, les absences/incertitudes, la prime indicative et la preuve d’accord, sans reconstruire les données depuis le profil ou le catalogue actuels. Cache privé supprimé à fermeture, relecture périodique et masquage du contenu en cas d’erreur d’accès. [Règles d’inspection](../api/src/modules/partner-workspace/README.md#inspection-de-la-demande-individuelle--relais-7a52). Types/lint/build et oracles PostgreSQL passent ; dialogue rempli, clavier et mobile restent non vérifiés V3 faute d’habilitation/dossier réels.

Les réponses Wallet identifient la compagnie, le produit et la version dans les notifications et l'activité. Les réponses ouvertes sont signalées dans la fiche ; leur bouton ouvre le formulaire de contact existant pour consigner l'échange réel et sa prochaine étape. Le lien depuis une notification de réponse rejoint l'activité. La publication d'une nouvelle offre ne masque plus une réponse à traiter. [Règles canoniques](../api/src/modules/partner-workspace/README.md#décisions-wallet-et-suivi-par-version--relais-b9b3). Les types/builds et PostgreSQL sont vérifiés ; le compte réel reste non habilité, recette remplie non effectuée.

« Polices finales » dans l’onglet Offres présente les liens historiques par pages de 20 puis le détail documentaire : version exacte, faits de police, prime annualisée/delta, cinq points sourcés et preuves manquantes. Les contributeurs habilités peuvent contrôler un point ; révision présentée et contenu de retry sont figés, extraits exacts obligatoires pour une concordance/différence. Contrôle masqué si source/droits invalidés, cache privé relu toutes les 10 s. [Règles canoniques](../api/src/modules/partner-workspace/README.md#police-finale-reçue-et-contrôle--relais-1a5a). V0–V2 vérifiés ; V3 limité à la candidature réelle sur 4132, aucun contrôle rempli revendiqué.
