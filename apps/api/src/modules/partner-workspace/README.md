# Partner — Leads et offres partagés avec Wallet

## Résumé

Ce module fournit le dossier opérationnel de chaque besoin. Partner sert le conseiller/apporteur ; Admin supervise ; Wallet présente les offres et enregistre les décisions du client. Le brief du 2 octobre 2026 est suivi dans [le plan](../../../../../roadmap/plans/partner-core.plan.md). Frontière et permissions : [ADR-0010](../../../../../adr/0010-partner-leads-wallet.md).

## Périmètre

Candidature puis validation séparée utilisateur/organisation ; création et édition de Leads ; pipeline/liste ; attribution administrative ; contact utile, prochaine action, attente motivée, tâches, rendez-vous sans chevauchement, notes et clôture motivée. Chaque Lead possède ses offres versionnées, originales conservées, extraction existante, revue humaine, publication et choix Wallet. Les listes sont bornées et filtrées avant pagination.

Les demandes d'assurance historiques restent dans `insurance-requests` : leur raccordement automatique n'est pas encore livré. Marketplace, accords/rémunérations, matching, réattributions automatiques, rendez-vous autonomes du client, contrats émis/signatures, objectifs et qualité restent à réaliser. Aucun taux, paiement, fournisseur de signature ou police n'est simulé.

## Règles métier et invariants

- Plusieurs Leads indépendants peuvent concerner la même personne et la même catégorie. Les identifiants canoniques référencent `identity` et `profiles`, sans table Client dupliquée. Un contact non rattaché reste à vérifier ; connaître son email ne révèle aucun Wallet.
- Un brouillon est éditable mais ne démarre pas le délai. La première action utile est distincte de l'acceptation et des notes. L'échéance de référence est 24 heures calendaires depuis l'attribution enregistrée, avec attente justifiée et date de réexamen. Les alertes sont calculées ; elles ne constituent pas une preuve d'envoi email/SMS ni une réattribution automatique.
- Une clôture « contrat actuel adapté » compte comme résolution sans contrat. La clôture sans contrat annule les tâches ouvertes et les rendez-vous futurs. Le journal est conservé.
- Toutes les commandes sont transactionnelles, révisionnées et idempotentes. Après transfert, le rejeu ne restitue jamais une ancienne réponse privilégiée. Le retrait du rôle de conseil ou la suspension place les Leads actifs en attente de réattribution.
- Les offres alternatives ne sont pas additionnées comme des contrats. Le montant économique reste « non estimable » sans accord : aucun taux par défaut.
- Une publication exige une source disponible/scannée, un montant vérifié, les informations incertaines traitées et un client rattaché. Une donnée absente reste inconnue, sans déduction d'absence de couverture. Une prestation vérifiée indique sa source. Une correction produit une version et conserve l'original.
- Wallet sélectionne une version active publiée et non expirée. Le choix laisse le Lead en décision client ; il ne fabrique aucune signature. Une ancienne version remplacée n'est plus sélectionnable. La consultation d'une source est journalisée, dédupliquée sur 30 minutes.

## Permissions

WorkOS et cookie serveur existants, contrôle d'origine/CSRF sur les mutations, aucune permission créée au démarrage. `administration.access` avec MFA récent ouvre la vue globale. Un conseiller doit être approuvé avec organisation approuvée, habilitation non expirée et affectation explicite ; l'auto-affectation reste limitée aux catégories de sa candidature validée. Un responsable possède une vue d'équipe explicite, sans droit de proposer une offre s'il n'a pas aussi le rôle conseiller.

Un apporteur voit la progression de ses Leads ; seul son brouillon non attribué est éditable. Les offres, contacts détaillés et tâches des dossiers transférés sont masqués. Une note privée reste réservée à son auteur, y compris face à l'administrateur. Wallet voit les événements destinés au client, les rendez-vous et les offres effectivement publiées du profil actuellement possédé. Les filtres ne créent aucun droit.

## État réel

**Partiellement fonctionnel** : types, builds et tests d'intégrité PostgreSQL passent. WorkOS réel et l'écran de candidature sans habilitation ont été observés ; Wallet affiche l'espace Offres vide et le formulaire mobile. Le compte réel disponible n'a pas d'habilitation Partner/Admin : création opérationnelle, attribution, import puis publication et choix ne sont pas encore prouvés de bout en bout en navigateur. [Preuves et limites](../../../../../roadmap/evidence/partner-core.md).

## API, persistance et exploitation

Contrats et client sous `@coverview/{contracts,api-client}/partner`. Routes `/partner/{context,application,dashboard,work,directory,leads}`, `/admin/partner/applications` et `/wallet/leads`. Le téléchargement `/partner|wallet/leads/:id/offers/:offerId/source` passe par la frontière publique du module documentaire.

Migrations additives 0027–0028 : tables Partner, surface d'authentification `partners`, finalité documentaire `lead_offer`, rétention et lien source. `AUTH_PARTNER_ORIGIN` doit correspondre exactement à une origine CORS autorisée ; pas de secret nouveau. HTTP privé sans cache partagé. Les frontends ont des caches bornés à l'utilisateur et sa session.

Le journal `partner_events` sert la timeline autorisée. Aucun nouveau job, room ou transport temps réel n'est actuellement actif. Les uploads utilisent les jobs documentaires existants (antivirus et lecture OpenAI), annoncés avant envoi ; `lead_offer` évite l'enrichissement accidentel du profil du conseiller et l'apparition comme contrat détenu.

Vérification ciblée : `pnpm --filter api test src/modules/partner-workspace/partner.repository.test.ts`. PostgreSQL isolé réel, identités de test explicitement synthétiques ; ce test n'est pas une preuve d'intégration fournisseur ni de recette utilisateur.
