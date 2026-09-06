# Refonte xAI — 6 septembre 2026

Instruction utilisateur : appliquer sa [référence xAI](../../references/xai-style-reference.md), conservée telle que fournie. [ADR-0007](../../adr/0007-xai-design-reference.md) remplace la direction visuelle précédente ; le partage statique de composants décidé dans ADR-0006 reste acquis. Le commit `f8e1e07` conserve une version rejetée, pas une validation du rendu. Session poursuivie sur le même hôte, GPT-6 ; effort effectif non observable.

## Résultat et preuves

- **Vérifié, composition publique** : accueil recomposé en six sections — hero textuel centré, deux guides sur surfaces crème, méthode ouverte, quatre ressources, FAQ et appel à l’action final. Les anciens visuels 3D et bleus sont retirés du rendu. Les aperçus des deux bentos reprennent les repères des lectures contrat et retraite, avec le libellé « Guide de lecture » ; aucun écran privé, score ou résultat personnel fictif.
- **Vérifié, contenu et navigation réelle** : parcours accueil → overview → services jusqu’à `#3e-pilier`, menu → explorateur, FAQ ouverte et lectures associées parcourus par la tâche racine. Les CTA conduisent aux contenus disponibles ou au compte, sans promettre un dépôt de contrat, une analyse ou un calcul actif. Le contenu métier reste fondé sur la bible ; aucune preuve commerciale, qualification, performance, tarification ou recommandation financière individuelle ajoutée.
- **Vérifié, système commun** : présentation partagée dans `packages/ui`, consommée par Astro statique, Wallet et l’espace équipe. Tokens, boutons, typographie et états applicatifs suivent la nouvelle référence. Le protocole d’identité et les décisions serveur ne sont pas modifiés par cette présentation.
- **Vérifié, lecture du rendu** : pages publiques inspectées à 1440, 390 et 320 px ; Wallet et équipe lus sur ordinateur et mobile. Captures locales sous `.preview/`, notamment `xai-final-home-1440.png`, `xai-final-home-390.png`, `xai-guide-390.png`, `xai-faq-390.png` et `client-xai-*.png`. Une revue indépendante du rendu a identifié une dernière retouche de l’échelle typographique mobile.
- **Vérifié, dernière retouche typographique** : H1 mobile à 48 px, H2 à 30/36 px, ressources à 16/24 px et métadonnées à 10 px. Les tailles de H1 hors échelle ont été retirées. La racine a relu le PNG final complet à 320 px et l’aperçu social `og.png`. La largeur réelle de la page est égale au viewport à 320 et 390 px, sans débordement observé. Captures disponibles : `xai-final-typography-320.png` et `xai-final-typography-390.png` ; la relecture finale explicitement rapportée porte sur celle à 320 px.
- **Vérifié, compilation et frontières** : la racine a exécuté avec succès `pnpm lint`, `pnpm typecheck` sur sept packages, `pnpm boundaries` sur 133 modules et 294 dépendances, puis `pnpm build` sur six tâches. Après la dernière correction CSS, `pnpm --filter www build` a de nouveau réussi avec 42 pages. L’avertissement Vite préexistant de bundle supérieur à 500 kB reste visible ; aucun seuil relevé. Ces vérifications ne prouvent pas un parcours WorkOS.
- **Vérifié, audit des dépendances** : `pnpm audit --audit-level high` a répondu « No known vulnerabilities found ». Ce résultat rapporte l’état des avis connus au moment de l’audit ; il ne constitue pas un audit de sécurité du produit.

## Dépendances et sources

**Vérifié** : Inter Variable et Geist Mono Variable sont auto-hébergées par `@fontsource-variable/inter` et `@fontsource-variable/geist-mono`, installées avec pnpm et inscrites dans le lockfile. Ces substitutions sont autorisées par la référence utilisateur. Les manifestes installés déclarent OFL-1.1 ; sources officielles consultées : [Inter chez Fontsource](https://fontsource.org/fonts/inter) et [Geist Mono chez Fontsource](https://fontsource.org/fonts/geist-mono). Les versions exécutables restent dans les manifestes et le lockfile. L’intégration statique Astro/React et le partage de `@coverview/ui` proviennent de la refonte précédente ; aucune autre bibliothèque de composants n’est introduite ici.

## Portée et limites

**Vérifié pour cette refonte** : aucun test, fixture ou smoke test ajouté, exécuté ou supprimé. Les retraits de scénarios de surface consignés dans le [ledger précédent](marketing-redesign.md) appartiennent à cette étape antérieure. Les inspections visuelles et parcours de lecture ne constituent ni une validation humaine du design ni une preuve de conversion persistante. Aucune qualification de conformité « 100 % » n’est revendiquée.

**Fait, diffusion non vérifiée** : contenu, métadonnées et maillage SEO préparés ; pages conservées en préversion `noindex`. Aucune publication, indexation, diffusion ou performance SEO prouvée.

**WorkOS non terminé** : callback exact et Magic Auth appliqués antérieurement dans coverview / LocalHost. La clé serveur et une connexion réelle restent attendues ; aucun login, OTP ou MFA déclaré validé par cette refonte.

Aucun changement de données, API, migration, authentification, rôle, job ou déploiement. Les limites des outils métier, de la collecte commerciale et de S-000b restent distinctes de cette nouvelle présentation. La racine tient l’état, le plan et la mémoire ; aucune acceptation humaine n’est déduite des vérifications techniques et visuelles.
