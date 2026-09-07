# Préparation GSAP — 2026-09-07

Demande explicite : ajouter GSAP au marketing et à Wallet pour leurs prochaines animations. Ajout préparatoire uniquement ; aucune nouvelle animation visible ni clôture de S-042a.

## Dépendance (DEP-01)

Paquet officiel `gsap`, dépendance directe de `apps/www` et `apps/client`, lockfile produit par pnpm. Choix explicite de l’utilisateur pour les timelines et animations à venir ; aucune bibliothèque équivalente déjà présente. Types intégrés, aucune dépendance transitive ajoutée ; paquet décompressé d’environ 6,3 Mo, sans import dans les bundles actuels. Installation réussie avec validation des politiques de chaîne d’approvisionnement pnpm.

Licence standard propre à GSAP, annoncée avant ajout conformément à DEP-01. Sources : [installation officielle](https://gsap.com/docs/v3/Installation/) et déclaration de licence des métadonnées npm ; la page web de licence a renvoyé un écran de vérification automatique.

Exception explicite G-08 : `ignoreDependencies: ["gsap"]` limité aux deux workspaces dans Knip, car l’installation précède volontairement son premier consommateur. Retirer chaque exception au premier import fonctionnel dans l’application concernée. Aucun import artificiel ni chargement global pour rendre la dépendance utilisée.

## Vérification

**Vérifié V0/V1** : installation, builds et typage des deux applications (9 tâches Turbo réussies avec dépendances partagées), dependency-cruiser et Knip réussis. Astro : aucune erreur ni avertissement de typage. Vite signale le chunk Wallet de 639 Ko minifiés / 200 Ko gzip ; GSAP n’est pas importé dans ce bundle. Aucun test ajouté pour cette préparation sans changement de comportement. pnpm a normalisé une référence de peer dependency React DOM existante dans le lockfile, sans mise à jour de sa version.
