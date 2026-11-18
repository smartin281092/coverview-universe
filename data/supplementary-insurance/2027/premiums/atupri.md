# Atupri — relevé des primes LCA 2027 dans le calculateur officiel

**État au 2026-11-18 : aucun prix relevé, `atupri.csv` n'existe pas.** Le pare-feu applicatif d'Atupri refuse Chromium sans interface dès la première page (« Web Page Blocked! », HTTP 500, Attack ID 20000051). Le brief demande l'arrêt en cas de blocage : rien n'a été contourné (pas d'agent utilisateur déguisé), aucun prix n'a été affiché, lu ni estimé.

Pour reprendre, il faut une décision sur le mode d'accès (voir « Blocage »), puis `node premiums/collectors/atupri.mjs`.

## Calculateur

- URL publique : https://calculateur-de-primes.atupri.ch ; formulaire réel sur https://shop.atupri.ch/fr (« Calcul des primes - Atupri », application Next.js, build 1.2.6).
- Formulaire d'entrée (lu dans le HTML servi) : femme / homme / enfant à naître, prénom et nom facultatifs, date de naissance, NPA et localité, case « Vous venez d'arriver en Suisse ? », puis « Choisir les assurances ». « Ajouter une personne » : 12 personnes au plus selon le code.
- Sans navigateur, `calculateur-de-primes.atupri.ch` sert encore l'ancienne application « Atupri Prämienrechner » (version 7.0.19) et ses traductions `premcalc-locales/fr.json` ; la redirection vers `shop.atupri.ch` n'a pas été observée ici.

## Blocage

- `chromium.launch()` sans option, `locale: 'fr-CH'` : HTTP 500 et page « Web Page Blocked! » sur `shop.atupri.ch/fr` comme sur `calculateur-de-primes.atupri.ch`, à chaque essai (4 essais, dont l'exécution du script).
- Cause isolée avec 4 requêtes `curl` sur `shop.atupri.ch/fr` : seul l'agent utilisateur contenant `HeadlessChrome` déclenche le blocage (500) ; `curl` par défaut, `accept-language: fr-CH` seul et l'en-tête `sec-ch-ua` seul passent (200). La règle vise donc la signature du navigateur sans interface, pas l'adresse ni le débit.
- `robots.txt` des deux hôtes autorise tout (`User-Agent: *`, `Allow: /`).
- Non fait : changer l'agent utilisateur de Playwright, ce qui reviendrait à contourner la règle du pare-feu.
- Tenté puis abandonné : rejouer le parcours avec un client HTTP simple, non déguisé. Les lectures sans état ci-dessous ont répondu ; la création d'un brouillon d'offre (`offerLead.create`) a été refusée par le système de permissions de la session avant tout envoi (motif : accès non autorisé). Aucun brouillon n'a été créé chez Atupri.
- Décision à prendre par le responsable du projet : accord d'Atupri, relevé depuis un navigateur ordinaire piloté à la main, ou autorisation explicite d'un autre mode d'accès.

## Hôtes

| Hôte | Rôle | Résultat |
| --- | --- | --- |
| `shop.atupri.ch` | calculateur (pages, scripts, API tRPC `/api/trpc`, session `/api/auth`) | refuse Chromium sans interface ; répond à `curl` |
| `calculateur-de-primes.atupri.ch` | adresse publique du calculateur, ancienne application | idem |
| `www.atupri.ch` | site public | `robots.txt` renvoie 301, rien d'autre demandé |
| `atupri.ch`, `fonts.atupri.ch` | site, polices | non sollicités |
| `a.storyblok.com` | images du CMS | non sollicité (la page n'a jamais été rendue) |

Aucun hôte refusé par le proxy de la session n'a été rencontré.

## Points d'API

Observés (requêtes `curl`, lecture seule, 1 s d'écart) :

- `GET https://shop.atupri.ch/api/trpc/utils.getInsuranceBegin?batch=1&input={"0":{"json":null,"meta":{"values":["undefined"]}}}` (en-tête `x-trpc-source: nextjs-react`) → `"2026-12-01"` : début d'assurance proposé par défaut le 2026-11-18.
- `GET …/api/trpc/utils.getPostalCodes?batch=1&input={"0":{"json":{"q":"1003","m":"ALL"}}}` → identifiants de localité :

| NPA | Localité (commune) | `postalCodeId` | Autres communes proposées |
| --- | --- | --- | --- |
| 1003 | Lausanne (Lausanne) | `150-5586` | aucune |
| 1204 | Genève (Genève) | `370-6621` | aucune |
| 1950 | Sion (Sion) | `1200-6266` | Grimisuat, Savièse |
| 2000 | Neuchâtel (Neuchâtel) | `1254-6458` | Milvignes |
| 1700 | Fribourg (Fribourg) | `916-2196` | Düdingen, Granges-Paccot, Tafers |
| 2800 | Delémont (Delémont) | `1551-6711` | Courrendlin, Develier |

Lus dans le code de l'application (bundles `_next/static/chunks`), **jamais émis ni observés** :

- `offerLead.create` (mutation) : `{ language, postalCode, insuredPersons[] { gender FEMALE|MALE|UNKNOWN, dateOfBirth, unborn, firstName?, lastName?, postalCodeId, insuranceBegin } }` ; crée un brouillon d'offre côté serveur (identifiant et code PIN).
- Session : `signIn("passphrase", { offerLeadId, passphrase: <NPA> })` via `/api/auth`, puis page `/offer/<offerLeadId>/person/<personId>/insurance`.
- `offerLead.person.getAll { offerLeadId }`, `offerLead.person.getOffer { offerLeadId, personId }` (donne `offerId`).
- **Prix** : `offerLead.cartesianProduct.getGroup { offerLeadId, personId, offerId, group, insuranceBegin }`, un appel par groupe. Réponse attendue : tableau de `{ id, name, group, insuranceBegin, tariff, price { amount, currency }, criteria[] { name, type, valueType, value }, pricingElements[] { name, price } }`, soit toutes les combinaisons de critères d'un produit.
- `offerLead.product.getInsuranceBegin { …, productName }` : dates de début possibles par produit (`listValues` ou `rangeValues`).
- `offerLead.cartesianProduct.getExcludedProducts`, `offerLead.getTotal` (total et rabais appliqués), `offerLead.person.add | update | delete | changePostalCode | selectProduct`.
- À ne jamais appeler : `offerLead.continueLater`, `utils.validateEmail`, tout ce qui concerne `applicationLead` (proposition) et l'envoi d'offre.

## Méthode prévue et état du script

`collectors/atupri.mjs` : ouvre le calculateur, saisit jusqu'à 12 personnes par brouillon dans le formulaire (prénom « Test », aucune coordonnée), clique « Choisir les assurances », puis rejoue depuis la page `getGroup` pour chaque personne et chaque groupe, 1,1 s entre deux requêtes, arrêt sur blocage.

- Exécuté : l'ouverture, qui reconnaît la page de blocage et sort avec le code 2 sans rien écrire (vérifié le 2026-11-18).
- Non exécuté : saisie du formulaire, capture, rejeu, conversion en lignes, contrôle à l'écran. Cette partie est écrite d'après le HTML servi et les schémas du code ; sélecteurs et `rowsFromGroup` sont à relire contre les premières réponses réelles (`--raw-dir`).
- Garde-fou : le CSV n'est écrit que si au moins 3 prix du profil pilote se retrouvent dans le texte de la page.
- Choix non vérifiés : `monthly_chf` = `price.amount` ; `variant` = critères du produit hors accident ; `accident` déduit d'un critère dont le nom contient « accident » ou « unfall » ; début demandé 2027-01-01, la date renvoyée étant notée ligne par ligne.

## Profil

Prévu : début 01.01.2027, 1003 Lausanne (les cinq autres localités via `--localities`), naissances au 15.06 de 1947 à 2026, femme et homme, sans assurance de base, nouvelle souscription. Réellement appliqué : aucun. Le calculateur propose par défaut le 01.12.2026 ; la disponibilité du 01.01.2027 n'a pas été vue.

## Produits du calculateur

Aucun produit n'a été affiché. Connu par le code seulement : cinq groupes interrogés par l'application, `basic.insurance` (LAMal, hors périmètre), `supplementary.insurance`, `hospital.insurance`, `dental.insurance`, `capital.insurance` (capital invalidité et décès par accident), plus `daily.allowance.insurance`, que la page de choix n'interroge pas. Les noms de produits et de variantes viennent de la réponse de prix et du CMS, non lus. `../insurers/atupri.json` n'existe pas : `product_key` restera vide.

Indice non confronté au calculateur actuel, tiré des traductions de l'ancienne application : rabais de 5 % sur Mivita Reala, Comforta et Hôpital avec un modèle de base alternatif d'Atupri (Mivita Reala seul avec le modèle Standard), et mention d'un rabais de 10 % sur Mivita, Comforta ou Hôpital lié à l'assurance de base. À vérifier pour relever une prime sans base.

## Limites d'âge

Aucune constatée.

## Vérifications à l'écran

Aucune : aucun prix n'a été affiché.

## Anomalies

- Le calculateur ne peut pas être ouvert avec la méthode du brief (Playwright sans option) ; le blocage vient d'Atupri, pas du proxy de la session.
- Chaque profil exige la création d'un brouillon d'offre côté Atupri (`offerLead`) : il n'existe pas de requête de prix sans état. À 12 personnes par brouillon, le profil standard demande 14 brouillons par localité.
