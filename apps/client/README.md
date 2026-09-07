# Wallet — espace personnel

## Résumé

Wallet propose le profil personnel, le compte et les appareils connectés. Français dès le départ, textes externalisés dans `src/locales/fr/common.json` et `profile.json`.

## Périmètre

`/` et `/account` ouvrent le même parcours de compte et vérifient la véritable disponibilité de l’identité. `/profile` prépare un profil en trois étapes facultatives, avant ou après connexion. Chaque étape s’enregistre sur le serveur ; après WorkOS, le rattachement explicite reprend l’étape du brouillon et propose les divergences sans écraser le profil. `/profile?view=choices` remplace le formulaire par l’historique du choix personnel tout en conservant la saisie en mémoire. Aucun contrat, analyse ni document fictif n’est présenté comme un parcours utilisable.

Sur smartphone, le shell unique expose Profil, Compte et Appareils dans une barre basse à icônes et libellés. Le menu Sheet shadcn ouvre les repères publics, gère le focus et Échap ; les safe areas sont réservées. La barre s’efface pendant la saisie et tous les boutons Wallet conservent une cible d’au moins 44 px. S-042a ajoute Documents et adapte la grille à quatre destinations.

Les outils de développement restent accessibles par leur adresse directe, hors navigation produit : `/preview` présente les personas fictives renvoyées par le backend local, `/states` montre les primitives d’états et `/diagnostics` vérifie la santé de l’API. Ces trois routes sont réservées à `import.meta.env.DEV`. Les liens ouvrent une autre page et aucun contenu hors FAQ ne se déplie (FRONT-14).

`/account` vérifie la disponibilité de la connexion puis la session serveur ; il affiche le profil, ouvre `/workspace/:userId`, `/devices` et le compte du site public. Le serveur contrôle la propriété de l’espace. La liste des appareils remplace ses pages de 20 entrées maximum, permet de fermer un appareil et propose les déconnexions locale/globale. Les données métier demeurent absentes.

L’action Authenticator ouvre la page dédiée de l’espace équipe en développement. En build, elle passe par le retour de connexion équipe fixé par l’API, puis le compte donne accès à Authenticator ; aucune origine d’administration déployée n’est inventée. L’inscription reste une action du propriétaire sans droit administratif implicite.

## Règles métier et invariants

La présentation utilise le preset shadcn Geist/Montech de [UI](../../packages/ui/README.md), conformément à ADR-0008, avec la composition ouverte conservée d’ADR-0007. Le layout de compte partagé reçoit uniquement des textes et icônes ; les décisions d’identité restent dans cette app. Compte, profil, appareils, déconnexion et états sont des sections ouvertes sans card.

Aucune règle métier ni secret de session durable frontend. Le réseau passe par `@coverview/api-client` ; les réponses sont validées par ses schémas. Source du socle : [API platform](../api/src/platform/README.md). TanStack Query conserve santé/personas fraîches 15 secondes et libère leur cache inutilisé après une minute.

L’identité est relue à chaque montage/focus, sans retry automatique. Pendant cette vérification, les données privées ne sont pas affichées. Le cache privé inclut identité et session, est périmé immédiatement et supprimé dès qu’il n’a plus d’observateur. Tout changement d’identité/session, refus d’authentification ou déconnexion annule les requêtes privées et les retire. Un résultat tardif d’une requête annulée ne modifie pas le cache de l’identité suivante. Les mutations ont un CSRF en mémoire et une clé d’idempotence conservée lors d’un retry ; aucune persistance navigateur.

La demande de déconnexion place immédiatement la commande exacte en mémoire hors du parcours privé et efface son cache. Un résultat perdu reste « à confirmer », sans prétendre que le serveur a fermé l’accès ; une réponse pending confirme la fermeture CoverView et permet de terminer la fermeture distante. Le bouton de reprise conserve CSRF, portée et clé. Fermer/recharger la page ou revenir au compte abandonne cette reprise locale ; cela ne prouve pas la fermeture distante. Aucun événement, room ou job frontend.

## Permissions

WorkOS s’ouvre via la route serveur de connexion, avec retour fixé côté API. Les cookies sensibles restent HttpOnly et les droits viennent du serveur. Aucun ID, email ou permission ne peut être défini par une persona locale. Lorsque l’API annonce la connexion désactivée, le compte affiche son indisponibilité et n’invente aucun login.

## État réel

Coquille S-000a et parcours d’identité S-000b implémentés. Les oracles et limites sont consignés dans les preuves de chaque slice ; ce code ne prouve aucune connexion WorkOS réelle. Les exemples de refus/expiration sont explicitement marqués comme exemples locaux.

## Développement et dépendances

`pnpm --filter client dev` écoute uniquement sur `127.0.0.1:4101` avec port strict. `build` produit le bundle Vite ; `typecheck` vérifie TypeScript strict. `VITE_API_URL` est une URL publique optionnelle : par défaut `http://127.0.0.1:4100` en développement, origine de la page en build. Un déploiement avec API séparée doit fournir son origine explicite ; aucun déploiement n’est réalisé ici.

`VITE_WEBSITE_URL` peut définir l’origine du site ; défaut local `http://127.0.0.1:4103`, cible de projet `https://coverview.ch` en build. Ces URLs publiques doivent correspondre aux origines réellement approuvées côté identité ; elles n’accordent aucun droit.

Stack imposée : React/Vite, TanStack Router (routes par code), TanStack Query (server state), i18next/react-i18next (catalogues), Tailwind et [UI shadcn partagée](../../packages/ui/README.md). Le formulaire profil utilise React Hook Form et le resolver Zod sur les contrats partagés, comme l’espace équipe. Les packages directs ont des licences MIT, sauf Lucide ISC et GSAP sous sa licence standard propre. Aucune donnée du profil en localStorage ; cache privé borné à l’identité/session et saisie temporaire en mémoire.

GSAP anime l’indicateur de traitement documentaire dans la liste et la fiche : attente, antivirus et lecture. `DocumentProcessingIndicator` respecte `prefers-reduced-motion` et libère son contexte au démontage React. L’exception Knip préparatoire a été retirée pour Wallet ; [installation](../../roadmap/evidence/gsap-setup.md) et [correctif quota/animation](../../roadmap/evidence/document-quota-animation.md).

Sources officielles consultées : [TanStack Router](https://tanstack.com/router/latest/docs/framework/react), [Query defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [shadcn CLI](https://ui.shadcn.com/docs/cli). Versions stables résolues via le registre npm le 2026-09-05, fixées dans le lockfile par l’installation racine.

## Documents S-042a

`/documents` et `/documents/$documentId` portent le dépôt, les originaux, la lecture facultative OpenAI et la confirmation par champ. Le serveur reste propriétaire des règles ; [README documentaire](../api/src/modules/document-intelligence/README.md) et [preuves](../../roadmap/evidence/S-042a.md). Les panneaux privés sont rendus sous IdentityBoundary pour rester masqués pendant la revalidation sans perdre le fichier sélectionné. Les mutations documentaires sont isolées par identité/session, libérées au démontage et purgées à la perte d’identité. Le parcours réel reste à valider selon le ledger.

La fiche place les informations extraites juste sous le titre. `DocumentProgress` montre une activité indéterminée pendant transfert et traitement, avec l’étape serveur réelle et réduction des animations ; aucun pourcentage n’est mesuré par le contrat actuel. [Demande utilisateur, actions et vérifications](../../roadmap/evidence/document-reading-ux.md).

Les espacements de page Wallet sont communs dans `src/styles.css` : 24 px sous le menu, 16 px sous les retours (`wallet-back-link`) et 4 px sous les sur-titres (`wallet-page-eyebrow` et le composant `SectionHeading`). Les conteneurs de portail documentaire utilisent `display: contents` pour ne pas ajouter d’espace dans la page.

`DocumentLoadingMessage` accompagne les traitements longs avec des textes adaptés à chaque étape. Cadence, gestion des interruptions et vérifications dans le [ledger des messages d’attente](../../roadmap/evidence/document-loading-messages.md).
