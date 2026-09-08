# Revue de mémoire — 8 septembre 2026

Revue documentaire effectuée à la demande `/memory-review`, sous le mandat d’autonomie déjà confirmé dans [execution-policy.md](../execution-policy.md). MEM-03/04/05 et DOC-10/11 appliqués sans déclarer de validation humaine spécialisée ni activer automatiquement une entrée.

## Inventaire et résultat

37 entrées candidates, 36 identifiants distincts : MEM-123 était présent deux fois. Aucune entrée active, donc aucune entrée active expirée. Les dates de revue des candidats étaient toutes à venir (4–6 décembre 2026).

Les destinations ci-dessous ont été relues. Six candidats nécessitaient un complément dans leur documentation propriétaire ; les autres décisions utiles y figuraient déjà ou appartiennent à un historique explicitement remplacé. Aucun candidat ne nécessite un état actif parallèle. Après revue, les sections Actives et Candidats restent présentes et vides, avec un lien vers cette trace.

Le contenu avant revue est conservé dans Git, `MEMORY.md` au commit `0f578f8`. Les états WorkOS périmés sont reproduits ci-dessous avec leur dépréciation ; les ADR conservent eux-mêmes les choix visuels remplacés. Ce journal est un historique de traitement, pas une nouvelle source de règles.

## Disposition de chaque identifiant

### MEM-101 — Déjà documenté

Destination / preuve : [CDX-02](../../docs/codex.md#cdx-02--session-astra-ultra-et-compatibilité-réelle). Constat daté de compatibilité CLI/application ; aucune capacité actuelle réévaluée.

### MEM-102 — Déjà documenté

Destination / preuve : [CDX-03](../../docs/codex.md#cdx-03--relais-à-70--du-contexte). Reprise et limite de télémétrie déjà explicites.

### MEM-103 — Déjà documenté

Destination / preuve : [README racine](../../README.md#commencer). Diagnostic des plages exclues Windows et protection des réservations système.

### MEM-104 — Promu

Destination / preuve : [README www](../../apps/www/README.md#développement-et-dépendances). Supervision Astro ; dev.mjs et marqueur de preview relus.

### MEM-105 — Archivé

Destination / preuve : [Ledger S-000a](S-000a.md) et [provenance UI](../../packages/ui/README.md). Décision de compatibilité du socle conservée ; ne fige pas une version actuelle ni ne réactive une exception sans diagnostic.

### MEM-106 — Déjà documenté

Destination / preuve : [README API](../../apps/api/README.md) et [README racine](../../README.md#commencer). Watcher Node et exécutable pnpm natif.

### MEM-107 — Déjà documenté

Destination / preuve : [Activation identity](../../apps/api/src/modules/identity/README.md#activer-et-vérifier-localement). La configuration choisie ne prouve ni accès ni habilitation ; décisions de préparation conservées au suivi S-000b.

### MEM-108 — Déjà documenté

Destination / preuve : [Invariants identity](../../apps/api/src/modules/identity/README.md#règles-métier-et-invariants). Sérialisation des connexions et révocations ; retrait local avant distant.

### MEM-109 — Déprécié

Destination / preuve : [État réel identity](../../apps/api/src/modules/identity/README.md#état-réel) et [S-000b](S-000b.md). Ancien blocage faute de clé et d’identités remplacé par la recette réelle de clôture ; texte original conservé ci-dessous.

### MEM-110 — Promu

Destination / preuve : [README www](../../apps/www/README.md#développement-et-dépendances). Diagnostic de résolution Sharp/pnpm depuis le ledger S-010, sans transformer l’incident en mise à jour systématique.

### MEM-111 — Déjà documenté

Destination / preuve : [Langues du projet](../../PROJECT.md#langues-et-données). Français initial et limites des choix éditoriaux.

### MEM-112 — Déjà documenté

Destination / preuve : [README www](../../apps/www/README.md#règles-métier-et-invariants). Préversion, provenance, auteurs, données structurées et limites de collecte.

### MEM-113 — Promu

Destination / preuve : [README www](../../apps/www/README.md#vérifier-les-parcours). Retour vers la bonne page paginée et distinction du focus natif.

### MEM-114 — Déjà documenté

Destination / preuve : [Mandat](../execution-policy.md#décider-et-exécuter). Priorité au parcours réel ; essais historiques non assimilés à une preuve de livraison.

### MEM-115 — Partiellement remplacé

Destination / preuve : [ADR-0006](../../adr/0006-marketing-design-system.md), [ADR-0007](../../adr/0007-xai-design-reference.md), [ADR-0008](../../adr/0008-shadcn-geist-montech.md). Ancienne direction visuelle historique ; partage statique et composition ouverte restent couverts par les ADR en vigueur.

### MEM-116 — Partiellement remplacé

Destination / preuve : [ADR-0007](../../adr/0007-xai-design-reference.md) et [ADR-0008](../../adr/0008-shadcn-geist-montech.md). Composition xAI conservée ; anciennes substitutions de fontes remplacées par Geist/Montech. Décision d’origine conservée dans l’ADR.

### MEM-117 — Déjà documenté

Destination / preuve : [ADR-0008](../../adr/0008-shadcn-geist-montech.md) et [UI](../../packages/ui/README.md). Preset réel, fontes, cards et provenance.

### MEM-118 — Déprécié

Destination / preuve : [S-000b](S-000b.md) et [État réel identity](../../apps/api/src/modules/identity/README.md#état-réel). Échec initial du callback dépassé par sa réparation ; autorisation des identités conservée dans sa preuve d’origine. Texte original ci-dessous.

### MEM-119 — Déjà documenté

Destination / preuve : [Activation identity](../../apps/api/src/modules/identity/README.md#activer-et-vérifier-localement). Émetteur AuthKit distinct de la découverte OIDC, normalisation locale bornée.

### MEM-120 — Déjà documenté

Destination / preuve : [Parcours Authenticator](../../apps/api/src/modules/identity/README.md#parcours-propriétaire-authenticator). Fraîcheur auth_time signée et absence de persistance du QR.

### MEM-121 — Déjà documenté

Destination / preuve : [Revue produit](../execution-policy.md#revue-produit-avant-validation-de-chaque-slice). Revue critique puis vérification finale avant clôture.

### MEM-122 — Déjà documenté

Destination / preuve : [Permissions identity](../../apps/api/src/modules/identity/README.md#permissions) et [trace opérateur](S-000b-admin-grant.md). Attribution nominative locale déjà tracée ; aucune nouvelle habilitation.

### MEM-123 — Doublon fusionné

Destination / preuve : [Mandat utilisateur](../execution-policy.md#mandat-utilisateur). Les deux occurrences concernent la même préférence d’autonomie ; une seule destination, aucun nouvel ID.

### MEM-124 — Déjà documenté

Destination / preuve : [Mandat](../execution-policy.md#décider-et-exécuter) et [Documents](../../apps/api/src/modules/document-intelligence/README.md). Priorité mobile/documents ; conservation et extraction sourcée avec exception ultérieure pour les champs vides explicitée par le module.

### MEM-125 — Promu

Destination / preuve : [UI](../../packages/ui/README.md#règles-de-présentation-et-invariants). Conflit hidden/display hors couche et largeur avec scrollbar, depuis la recette S-013a.

### MEM-126 — Déjà documenté

Destination / preuve : [Mandat](../execution-policy.md#décider-et-exécuter) et [Documents](../../apps/api/src/modules/document-intelligence/README.md#asynchrone-et-ia). Choix OpenAI et limites d’activation/conformité.

### MEM-127 — Déjà documenté

Destination / preuve : [Exploitation documentaire](../../apps/api/src/modules/document-intelligence/README.md#exploitation) et [frontières](../../apps/api/src/modules/document-intelligence/README.md#parcours-et-frontières). Clé DPAPI indépendante et résolution des PUT conditionnels MinIO.

### MEM-128 — Déjà documenté

Destination / preuve : [Asynchrone documentaire](../../apps/api/src/modules/document-intelligence/README.md#asynchrone-et-ia). Adapter Redis explicite, démarrage du worker et protection du superviseur WorkOS.

### MEM-129 — Déjà documenté

Destination / preuve : [Activation identity](../../apps/api/src/modules/identity/README.md#activer-et-vérifier-localement) et [reconnexion](identity-session-reconnect.md). Rotation d’une session connue sans réactivation d’une révocation.

### MEM-130 — Promu

Destination / preuve : [README Wallet](../../apps/client/README.md#documents-s-042a). Présentation sans nom de fournisseur/modèle, transparence du traitement et priorité aux informations extraites.

### MEM-131 — Promu

Destination / preuve : [Règles transverses](../../PROJECT.md#règles-transverses) et [revue documentaire](../../apps/api/src/modules/document-intelligence/README.md#revue-et-profil-compatible). Identité commerciale fournie ajoutée au projet ; remplissage des champs vides déjà documenté chez son propriétaire.

### MEM-132 — Déjà documenté

Destination / preuve : [README Wallet](../../apps/client/README.md#documents-s-042a). Compagnies choisies, coordonnées sur place, indications rouge/vert et absence d’autorisation implicite.

### MEM-133 — Déjà documenté

Destination / preuve : [README Wallet](../../apps/client/README.md#documents-s-042a) et [contrats documentaires](../../apps/api/src/modules/document-intelligence/README.md#compagnies-et-contrats-documentaires). Menus, titres, fiche compagnie et agrégats sourcés.

### MEM-134 — Déjà documenté

Destination / preuve : [Profils](../../apps/api/src/modules/profiles/README.md) et [pièce d’identité](../../apps/api/src/modules/document-intelligence/README.md#pièce-didentité-du-titulaire). Sections médicales, personnes/entités privées, association recto-verso du titulaire.

### MEM-135 — Déjà documenté

Destination / preuve : [UI](../../packages/ui/README.md#état-réel) et [Wallet](../../apps/client/README.md#documents-s-042a). Preset Select, tokens sombres, titre avant pastilles ; actualisation CSS également tracée dans la recette récente.

### MEM-136 — Déjà documenté

Destination / preuve : [Wallet](../../apps/client/README.md#documents-s-042a) et [Profils](../../apps/api/src/modules/profiles/README.md#données-et-progression). Carte compagnie, hauteur des onglets et médecin traitant déjà documentés.

MEM-123 représente deux entrées dans l’inventaire de départ : les deux sont retirées après rapprochement avec le même mandat, sans perdre leurs références S-013/S-013a dans l’historique Git.

## Constats dépréciés — texte d’origine conservé

**MEM-109 — déprécié le 8 septembre 2026.** Remplacé par la clôture réelle S-000b du 6 septembre et l’état réel documenté dans identity ; ne plus utiliser ce blocage de préparation comme état courant.

> Le projet WorkOS a été identifié en lecture seule ; l’état et le diff exact préparé sont au ledger S-000b. L’absence de clé process et d’identités autorisées conserve la tranche en review et n’autorise que les suites indépendantes. (S-000b, 2026-09-06 · confiance haute · revoir avant 2026-12-05 · candidat)

**MEM-118 — déprécié le 8 septembre 2026 pour son état d’échec.** Réparation et recette réelle consignées dans S-000b ; l’autorisation initiale des identités demeure dans ce ledger et n’est pas annulée.

> L’utilisateur autorise deux identités réelles pour la recette WorkOS et les identités fictives LocalHost ; inventaire et limites d’habilitation dans le ledger S-000b. L’OTP fournisseur accepté ne prouve pas une session CoverView : premier callback en échec. (S-000b reprise, 2026-09-06 · confiance haute · revoir avant 2026-12-05 · candidat)

## Vérification et limites

Revue de traçabilité, sans nouvelle recette WorkOS, IA, sécurité, conformité ou revalidation des versions de logiciels. Les preuves datées restent datées. Aucun statut de slice, permission, secret, code produit ou dépendance modifié. Les fichiers non liés déjà présents dans le checkout sont préservés.

**Vérifié** : `node evals/lint-referentiel.mjs` passe avec zéro erreur et zéro avertissement ; couverture des 36 identifiants uniques, sections mémoire vides et 55 liens locaux du journal contrôlés ; `git diff --check` passe. Le premier lint signalait les anciens identifiants devenus sans définition après retrait des candidats : chaque identifiant dispose maintenant d’une rubrique de trace stable dans ce journal. Aucun contrôle ni règle du linter modifié.

Session : Codex GPT-6 ; effort effectif non exposé indépendamment.
