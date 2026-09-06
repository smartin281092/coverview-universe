# Espace équipe — accès protégé

## Résumé

Surface indépendante destinée aux équipes CoverView. Le compte est l’entrée principale, avec autorisation administrative et MFA côté serveur ; aucun CRM ni dossier opérationnel n’est présenté comme disponible.

## Périmètre

`/` et `/account` ouvrent le même parcours d’accès équipe. L’action de connexion et les erreurs arrivent avant les explications secondaires sur mobile. La navigation produit se limite à cet accès, sans diagnostics ni données de démonstration.

`/preview`, `/states` et `/diagnostics` restent accessibles uniquement par leur adresse directe en développement : profils fictifs locaux, démonstration explicite des états UI et santé de l’API. Les profils viennent de l’API ; leur sélection est un état React local qui ne crée aucune session. Navigation et détails sur des pages séparées, conformément à FRONT-14.

`/account` demande l’identité puis l’autorisation administrative au serveur. Un refus reste un refus, même si le navigateur déclare un rôle. L’exigence MFA ouvre `/mfa` : démarrage d’un challenge, code à six chiffres de l’application d’authentification existante, puis relecture de la session et de l’accès après rotation serveur. Aucun enrôlement ou secret TOTP frontend ; un facteur absent affiche une instruction d’assistance. Un code refusé exige un nouveau challenge.

## Règles métier et invariants

Texte français externalisé dans `src/locales/fr/common.json`. Aucun credential PostgreSQL, aucune lecture DB, room ou job. Réseau via `@coverview/api-client` uniquement. Santé et personas utilisent un cache TanStack Query frais 15 secondes, collecté après une minute. L’identité se vérifie à chaque montage/focus ; les données privées sont masquées pendant cette vérification. Le cache privé, borné à identité/session, est périmé immédiatement et supprimé sans observateur, au changement de session, au refus d’authentification et à la déconnexion. Les requêtes sont annulées avant retrait, y compris l’identité lors du logout ; aucun retry automatique de mutation.

Les commandes CSRF et idempotence restent en mémoire. Dès la demande de logout, le profil disparaît et la commande est conservée hors du parcours privé. Une réponse perdue laisse le résultat à confirmer ; une réponse pending confirme la fermeture locale et permet la reprise distante. Recharger/fermer la page abandonne ce contexte de reprise sans prouver l’état distant. Pendant une simple revalidation de la même session, le formulaire MFA reste monté mais masqué/inactif ; le challenge et le code restent utilisables au retour d’un authentificateur. Source du socle : [API platform](../api/src/platform/README.md).

## Permissions

Le nom `admin` n’accorde aucun droit. Seul le serveur confirme une habilitation explicite et une preuve MFA valide ; aucune permission du DTO `/me` ne remplace `/identity/admin`. L’API décide aussi de l’exposition locale des fixtures. Les routes d’exemples sont désactivées hors build de développement. Une configuration d’identité désactivée présente une connexion indisponible.

## État réel

Coquille et parcours d’identité/MFA implémentés ; les données et états d’exemple portent leur caractère fictif. Les preuves de slice distinguent contrôles locaux et accès WorkOS réellement exécuté ; ce README ne prouve aucune habilitation externe.

## Développement et dépendances

`pnpm --filter admin dev` écoute sur `127.0.0.1:4102`, port strict. `build` produit un bundle Vite indépendant ; `typecheck` applique TypeScript strict. `VITE_API_URL` optionnelle : API locale en développement, origine de la page en build. Une API déployée séparément exige sa propre origine explicite.

Stack et provenance partagées avec [Wallet](../client/README.md#développement-et-dépendances) ; composants et preset dans [UI](../../packages/ui/README.md). Les pages, routes, catalogues et état local restent propres à cette application (ARCH-13).

Le formulaire MFA utilise la stack imposée react-hook-form, resolver Zod et schéma partagé dans `@coverview/contracts`. Le champ natif utilise les tokens existants, un label, l’autocomplétion OTP, un focus initial et des erreurs accessibles. Aucun composant visuel externe ajouté.
