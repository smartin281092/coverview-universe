# Plan — Mesure d'audience PostHog avec consentement (9 octobre 2026)

> Statut : approuvé par la demande de l'utilisateur et ses réponses du 9 octobre 2026 (mandat PROG-23)
> **Session réelle** : Claude Code, Claude Opus 5.5, effort max
> **Budget** : une session

## Réponses de l'utilisateur (questions bloquantes)

| ref | question | réponse |
|---|---|---|
| A-1 | Consentement | **Bandeau de consentement** : PostHog complet (cookies, suivi entre visites) seulement après accord, sur le site, Wallet et Partner. Admin exclu. |
| A-2 | Enregistrement des sessions | **Oui dans Wallet et Partner, tout masqué** (textes et champs). |
| A-3 | Région | **EU** (`eu.i.posthog.com`, interface `eu.posthog.com`). |
| A-4 | Assistant `npx @posthog/wizard` | Non utilisé : il réécrit le code avec les réglages par défaut (sans consentement, textes capturés), demande une autorisation OAuth sur le compte et écrit dans `.env`, que l'agent ne lit ni n'écrit. Intégration équivalente faite à la main. |

## Objectif

Mesurer l'usage du site, de Wallet et de Partner avec PostHog EU, uniquement après un accord explicite, sans donnée personnelle dans les événements, l'accord pouvant être retiré aussi facilement qu'il est donné.

## Décisions posées (réversibles)

- Rien de PostHog n'est chargé avant l'accord : le SDK est importé dynamiquement au moment de l'accord (MKT-09).
- Accord par surface (le site, Wallet et Partner ont des origines distinctes), conservé en `localStorage` avec sa version ; « Cookies » dans le pied de page rouvre le choix.
- Deux boutons de même poids, « Refuser » et « Accepter ».
- Événements sans texte : capture automatique avec textes et attributs masqués, chaînes de requête retirées des adresses (LAUNCH-04). Identifiant opaque de l'utilisateur dans Wallet et Partner, jamais l'email ni le nom.
- Enregistrement des sessions dans Wallet et Partner seulement (A-2), tous textes et champs masqués ; désactivé sur le site, où il n'a pas été demandé.
- Sans clé PostHog configurée, ni bandeau ni SDK : la production reste inchangée tant que la clé n'est pas fournie au build.
- Code commun dans `@coverview/ui/consent` (bandeau et cycle de vie PostHog), jamais importé par Admin.

## Definition of Done

- [x] Aucun appel ni script PostHog avant l'accord ; refus et retrait coupent la capture — oracle : V2 tests du stockage d'accord, V3 réseau observé sur la page (journal 5–6).
- [ ] Bandeau sur le site, Wallet et Partner ; « Cookies » le rouvre — oracle : V3 navigateur.
- [x] Événements sans texte ni requête d'adresse — oracle : V2 test de l'assainissement (journal 2).
- [x] `.env.example`, README, ADR-0011 et inventaire des traceurs (README du site) à jour — oracle : relecture.
- [x] Types, lint, tests, builds, knip — oracle : V0–V2 (journal 2–4).

## Hors-périmètre

- Pages légales (politique de confidentialité et politique cookies, LAUNCH-02) : à publier avant toute transaction ; elles devront citer PostHog.
- Événements produit côté serveur (LAUNCH-04) et définition de l'activation dans `PROJECT.md`.
- Clé de production au build du site et activation de l'enregistrement des sessions dans les réglages du projet PostHog.

## Journal de vérification

| # | cible | oracle | résultat | suite |
|---|---|---|---|---|
| 1 | SDK | `pnpm add posthog-js` dans `@coverview/ui` (politique d'ancienneté du dépôt) | 1.438.2, Apache-2.0 et MIT ; script d'installation de `core-js` (appel au financement) refusé et commenté | — |
| 2 | Accord et événements | `analytics-consent.test.ts` (Wallet) | 3/3 : choix mémorisé et redemandé si ancien ou illisible, adresses réduites au chemin, rien sans clé | — |
| 3 | Chargement | build du site (45 pages), Wallet, Partner, Admin | SDK dans un fichier à part (304 Ko, 101 Ko compressés) importé seulement à l'accord, jamais préchargé par les pages ; aucune trace dans Admin | — |
| 4 | Contrôles | `tsc` UI/Wallet/Partner/Admin, `astro check` (0 erreur), ESLint, `vitest` Wallet 22/22, dependency-cruiser 0 erreur, knip identique à `main` | verts | Bandeau et capture réels à observer avec une clé |
| 5 | Accord et retrait, vrai SDK | page de test temporaire, clé factice, hôte local injoignable (port 9), réseau et stockage relevés | avant choix : ni script ni appel ; « Refuser » : rien ; « Accepter » : SDK chargé, appels vers l'hôte configuré seulement. **Échec du retrait** : `reset()` après `opt_out_capturing()` efface la réponse donnée au SDK, qui recapture, et le cookie `ph_*` reste | SDK éteint par défaut (`opt_out_capturing_by_default`), refus qui vide son stockage (`opt_out_persistence_by_default`), plus de `reset()` au retrait ; identité suivie seulement avec l'accord |
| 6 | Même page après correctif | accepter connecté, retirer, se déconnecter pendant le refus, ré-accepter, se connecter, se déconnecter, refuser puis recharger, ré-accepter | identifiant opaque après accord ; retrait : capture coupée, cookie et stockage local `ph_*` effacés, aucun nouvel appel (seulement des renvois d'événements déjà captés) ; déconnexion pendant le refus : rien ; ré-accord : nouveau visiteur anonyme ; déconnexion avec accord : nouveau visiteur, capture maintenue ; après rechargement refusé : ni script ni appel ; ré-accord : capture reprise | reste un identifiant d'onglet en `sessionStorage` jusqu'à la fermeture, documenté |
