# Profil personnel et reprise — S-013a

## Périmètre

`identity_profiles` reste le seul profil canonique par utilisateur WorkOS. Les dossiers privés supplémentaires et les sections Finances/Santé appartiennent au [module profiles](../../profiles/README.md), sans deuxième copie des informations générales du titulaire. La page Wallet `/profile`, accessible depuis le compte public, prépare les informations et l’adresse sans imposer la connexion. Chaque passage d’étape enregistre le brouillon côté serveur. Après connexion WorkOS, la personne choisit explicitement de rattacher ce brouillon ; le serveur renvoie l’étape conservée. Une saisie non envoyée ne devient pas une sauvegarde.

Contrats : `packages/contracts/src/profile.ts`. Commandes : `identity.profile.repository.ts`. Frontières HTTP : `identity.profile.routes.ts`. Preuves : [ledger S-013a](../../../../../../roadmap/evidence/S-013a.md). S-013 conserve les raccordements aux producteurs de documents, analyses, simulations, comparaisons et favoris, ainsi que l’OCR et la recette foyer.

## Invariants et décisions

- **profile.owner.1** — Le propriétaire canonique est la seule autorité de lecture/écriture. Un rôle administratif ou une appartenance familiale ne donne aucun accès implicite. Confidentialité individuelle et séparation image/champs : ADR-0002 et choix délégué PROG-23 du 6 septembre 2026. Aucun grant ou email ne décide d’un droit.
- **profile.draft.1** — Handle navigateur aléatoire HttpOnly, SameSite=Lax, Secure sur HTTPS ; seul son hash est stocké. Première lecture sans record en base ; premier enregistrement explicite crée le brouillon. Durée technique d’accès 24h, sans durée légale déduite. Un brouillon rattaché n’est plus lisible anonymement.
- **profile.attach.1** — Rattachement explicite avec session WorkOS valide et cookie du brouillon. Verrous utilisateur/profil/brouillon, contrôle expiration et propriétaire, fusion et audit atomiques. Autre propriétaire refusé. Callback OAuth toujours à usage unique ; seule la continuation `profile` enregistrée côté serveur peut sélectionner le retour profil, jamais de `returnUrl` libre.
- **profile.confirmation.1** — Saisie de valeurs uniquement ; provenance, score et instant non acceptés du frontend. Confirmation propriétaire explicite. Brouillon divergent = proposition, sans remplacement canonique. Confirmation finale après résolution des propositions. Origines CoverView/extraction attendent leurs producteurs, sans endpoint public pour les fabriquer.
- **profile.choice.1** — `profile.prefill` version `1`, facultatif et désactivé par défaut : préremplir les seules démarches personnelles autorisées. Historique décision/version/finalité/acteur/instant ; retrait depuis le récapitulatif. Ni conditions juridiques, ni marketing, ni partage foyer. Les futurs consommateurs relisent ce choix et leurs propres droits.

## Contrats et concurrence

Commandes avec révision optimiste et `Idempotency-Key` : même clé/payload rejoue la réponse, autre payload refusé. Les gardes propriété/expiration précèdent tout rejeu anonyme. Origine/Host/CSRF et limite de débit aussi sur le brouillon. WorkOS précède la transaction SQL ; sessions/révocations locales relues sous verrou avant mutation.

Lectures privées propriétaires, choix paginés par20. Aucun champ privé dans les contenus publics. Cache Wallet par identité/session, sans stockage personnel persistant navigateur. Mutations invalidant les vues ; audit transactionnel sans valeurs. Aucun consommateur asynchrone justifiant bus/outbox dans ce parcours.

Extension demandée le 8 septembre 2026 : numéro AVS (`avsNumber`) et profession (`occupation`) facultatifs, saisis et effaçables par leur propriétaire. Le numéro AVS reste une chaîne ; points et espaces de saisie sont acceptés, puis le contrat partagé normalise `756.xxxx.xxxx.xx`. Préfixe 756, treize chiffres et clé EAN-13 suivent la [structure publiée par la Centrale de compensation](https://www.zas.admin.ch/fr/numero-avs-identificateur). Ce contrôle détecte les erreurs de saisie ; il ne vérifie ni l’attribution ni la validité administrative auprès d’UPI. La profession est un texte de 160 caractères maximum. Ces champs identifiants restent privés dans le JSON canonique et les brouillons existants, sans migration SQL ni transmission à l’extracteur. Les lecteurs compatibles doivent rester déployés après une première saisie.

## Manifeste S-130/S-131

| Catégorie             | Propriétaire / classification                                                          | Export, rectification, conservation                                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profil/propositions   | Utilisateur ; nom/prénom, naissance, nationalité, adresse et confirmation identifiants | Rectification disponible ; export/effacement/rétention juridique S-130/S-131. Aucune copie/numéro de pièce collecté.                                                                                 |
| Brouillon             | Navigateur puis utilisateur réclamant ; champs identifiants                            | Accès technique24h, refus après expiration/claim. Purge définitive/export des objets rattachés S-131, aucun délai juridique déduit.                                                                  |
| Choix                 | Utilisateur ; préférence et preuve technique                                           | Historique append-only, correction par nouveau choix ; export/effacement/rétention S-130/S-131.                                                                                                      |
| Réponses idempotentes | Propriétaire de commande ; snapshot privé et hash requête                              | TTL technique24h et purge bornée ; réponse protégée comme la commande. Aucun cookie brut, aucun hash à exporter.                                                                                     |
| Audit                 | Acteur/ressource ; action/date/corrélation                                             | Sans valeurs. Export/anonymisation/rétention S-130/S-131.                                                                                                                                            |
| Images d’identité     | Originaux privés dans document-intelligence, séparés des champs                        | Dépôt et association recto/verso autorisés par la demande S-042a ; voir le [module documentaire](../../document-intelligence/README.md). Aucun droit familial implicite ni durée juridique inventée. |

Migration additive compatible N-1, rollback applicatif conservant tables/colonnes. Aucun reset/effacement comme rollback. RLS non activée comme dans l’existant : limite DATA-09 DEVRAIT, contrôles propriétaires et concurrence à vérifier sur le parcours réel.
