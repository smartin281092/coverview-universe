# Refonte marketing — 6 septembre 2026

Mandat explicite : ancienne palette abandonnée, fond blanc, design inspiré d’Apple, composition marketing inspirée d’IM8, conversion et SEO, bibliothèque commune, sections ouvertes et cards réservées aux bentos illustrés. [Plan](../handoffs/marketing-redesign.md) et [ADR-0006](../../adr/0006-marketing-design-system.md). Même session de reprise S-000b ; aucun changement de modèle.

## Résultat et vérification

- **Vérifié, interface publique réelle** : accueil recomposé avec promesse, orientation, problème, trois bentos illustrés, méthode, besoins, transparence, FAQ et prochain pas. Navigation par besoins et footer commun. Visuel original ImageGen optimisé par Astro. Orientation, compte et gabarits éditoriaux ouverts, sans section en card.
- **Vérifié, contenu et navigation** : onze MDX réécrits, dont services, méthode, vision, retraite, benchmark, FAQ et deux articles. Revue indépendante des CTA et du sens. Parcours accueil → orientation → services réellement suivi jusqu’à `#3e-pilier`. Aucun résultat financier, preuve commerciale, client, tarif ou prestation inventé.
- **Vérifié, système commun** : tokens, styles, boutons, états ouverts et composants de présentation dans `packages/ui`, consommés par Astro statique, Wallet et équipe. Compte, appareils et MFA recomposés sans changer le protocole d’identité ni les permissions.
- **Vérifié, rendu** : captures du serveur réel en 1440, 390 et 320 px, plus lecture Chrome grand écran. Césure du hero corrigée à 320 px ; action principale avant l’image. FAQ ouverte et lectures suivies. Wallet/équipe inspectés sur ordinateur et mobile par leur agent propriétaire. Captures locales `.preview/marketing-*` et `.preview/{client,admin}-white-*`, lues réellement ; aucune validation humaine de l’esthétique revendiquée.
- **Vérifié, compilation** : `pnpm lint`, `pnpm typecheck`, `pnpm boundaries` et `pnpm build` passent. Sept packages typés ; aucun diagnostic Astro. Avertissements préexistants de bundles Vite supérieurs à 500 kB maintenus, aucun seuil relevé.
- **Fait, diffusion non vérifiée** : titres/descriptions, canonical, Organization/WebSite/FAQPage, maillage et aperçu social PNG 1200 × 630 produit au build depuis le texte de l’accueil. URL SVG historique conservée par endpoint statique. HTML complet sans hydratation marketing. Préversion locale non indexable ; aucune publication, soumission Search Console ou performance SEO réelle revendiquée.

## Vérification proportionnée

Aucun nouveau test, fixture, smoke test ou faux parcours produit ajouté ou exécuté pour cette refonte. Quatre anciens scénarios de `tests/e2e/editorial.spec.mjs` retirés explicitement selon l’instruction utilisateur : assertions de textes/métadonnées, pages d’indisponibilité, comparaison recopiée et cas/rapport fictifs. Seul le parcours fonctionnel pagination → détail → retour ancré/focus reste. Tests d’identité/sécurité conservés, jamais comptés comme preuve d’une connexion réelle. Le contrôle historique `check:www` n’a pas été lancé ni compté comme preuve de produit livré. Les anciennes preuves S-010/S-011 ne sont pas transposées à cette version.

## Dépendances et corrections

Intégration officielle `@astrojs/react` ajoutée, MIT, version stable et peers contrôlés au registre npm et dans la [documentation officielle Astro](https://docs.astro.build/en/guides/integrations-guide/react/). React/React DOM et types reprennent les versions des autres apps. Nécessaire au partage de composants demandé, rendu statique sans bundle React envoyé pour ces sections ; aucun nouveau framework applicatif. Lockfile produit par pnpm. Dépendance directe Geist de www devenue redondante retirée : la fonte appartient au thème partagé.

Deux patches ont été refusés avant écriture, puis corrigés ; un verrou transitoire du watcher a retardé l’écriture d’overview, ensuite achevée et réellement parcourue. Le serveur existant conservait une résolution Sharp périmée après changement de dépendances : import et build réussis avec le paquet installé, puis relance du seul www par son superviseur. Première relance trop proche de l’arrêt expirée, suivante réussie après fermeture effective. Aucun nouveau paquet image, migration ou processus étranger arrêté.

## Continuité et limites

**WorkOS reste à terminer** : callback exact et Magic Auth appliqués dans coverview / LocalHost. Lors du dernier constat l’API attendait encore la saisie masquée de la clé serveur et une connexion réelle. Aucun OTP, login, profil canonique réel ou MFA admin déclaré réussi. Le lanceur et la question de saisie sont conservés.

Les dépôts de contrats, analyses, calculateurs et collecte commerciale ne sont pas ouverts ; le contenu l’indique aux points concernés. Cette refonte ne clôt pas artificiellement S-000b ou les critères de conversion persistante de S-011. Aucun nouveau rôle, donnée personnelle, migration, job, événement, tracker, email, déploiement ou DNS. Hébergement Infomaniak conservé ; services locaux et volumes préservés.
