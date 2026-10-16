# Commandes 3e pilier de horizon3.finance

Depuis le 14 octobre 2026 ([plan S-042a](../../../../../../roadmap/plans/S-042a-horizon3-intake.plan.md)). Un client commande une solution 3e pilier sur horizon3.finance ; son navigateur envoie la commande à CoverView, qui la garde une seule fois, avertit en interne et la fait suivre par un seul compte.

## Contrat public

`POST https://api.coverview.ch/api/public/h3/contact`, `Content-Type: application/json`, corps de 4 Ko au plus. Schéma exécutable : `@coverview/contracts/partner-intake`.

| champ                    | règle                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`                 | `"horizon3"`                                                                                                                                                              |
| `requestId`              | GUID (8-4-4-4-12 hexadécimal), clé de déduplication                                                                                                                       |
| `firstName`, `lastName`  | 1 à 80 caractères                                                                                                                                                         |
| `email`                  | adresse valide, 254 caractères au plus                                                                                                                                    |
| `phone`                  | chiffres, espaces et `+ ( ) . / -`, 6 à 40 caractères                                                                                                                     |
| `birthYear`              | entier, de 1900 à l’année en cours                                                                                                                                        |
| `investment`             | francs, positif ou nul, deux décimales au plus                                                                                                                            |
| `frequency`              | `monthly`, `quarterly`, `semiannual`, `yearly`, `annual`, `once` ou `single` ; une autre valeur en minuscules (30 caractères au plus) est gardée et affichée telle quelle |
| `initialCapital`         | francs, positif ou nul, deux décimales au plus, ou `null`                                                                                                                 |
| `productId`              | entier positif ou nul, ou `null`                                                                                                                                          |
| `productName`, `company` | 1 à 120 caractères                                                                                                                                                        |
| `strategyId`             | 1 à 60 caractères                                                                                                                                                         |

Les champs inconnus sont ignorés et jamais conservés.

| réponse                                     | cas                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `200 { "success": true, "requestId": "…" }` | commande enregistrée, ou reprise identique : rien n’est recréé, aucun nouvel avis |
| `422 PARTNER_IDEMPOTENCY_REUSED`            | même `requestId`, autre contenu                                                   |
| `400 PLATFORM_INVALID_REQUEST`              | champ manquant ou invalide, corps qui n’est pas un objet JSON                     |
| `413`                                       | corps de plus de 4 Ko                                                             |
| `429`                                       | plus de 10 requêtes par minute depuis la même adresse, invalides comprises        |

Une erreur a la forme `{ "error": { "code", "message", "requestId" } }` ; ce `requestId`-là identifie la requête HTTP chez CoverView, pas la commande.

**CORS.** Pour cette route seulement : origines exactes `H3_ORIGINS` (par défaut `https://horizon3.finance`, `https://www.horizon3.finance`, `http://127.0.0.1:5187`, `http://localhost:5187`), méthodes `POST` et `OPTIONS`, en-tête `Content-Type`, sans cookies, pré-vol gardé 10 minutes. Les autres routes gardent leurs propres origines.

**Sécurité.** L’appel part du navigateur du visiteur : aucune clé secrète ne peut l’authentifier. C’est une exception à SEC-05 (signature), compensée par les origines exactes, la taille, la validation stricte et la limite par adresse. Un client hors navigateur peut aussi appeler l’endpoint : une commande est une demande à qualifier, jamais une preuve d’identité.

## Suivi

**Enregistrement.** Avant la réponse, une ligne par couple `(source, requestId)` dans `partner_external_requests` : données validées, montants en centimes (DATA-11), empreinte SHA-256 du contenu.

**Lead.** Il est ouvert pour le compte `H3_OWNER_EMAIL` (par défaut `sebastien@coverview.ch`) : exactement un compte actif avec cette adresse, casse ignorée.

- Catégorie prévoyance, intitulé « 3e pilier · Prénom Nom », objet « Produit · Compagnie ».
- Étape « À contacter », déjà accepté, priorité haute.
- Action « Contacter le client au sujet de sa commande 3e pilier » sous 24 h.
- Transmission à un autre intervenant non autorisée : la modifier demande de cocher l’autorisation, comme pour tout Lead.
- Sans ce compte, la commande attend ; la tâche ouvre son Lead dès que le compte existe. Un échec à l’ouverture ne fait pas perdre la commande : la tâche réessaie.

**Exception de visibilité (PERM-06, politique documentée).** `partner_leads.restricted_to` réserve le Lead à ce compte.

- Le prédicat central `visible()` l’applique : aucun autre administrateur, conseiller ou gestionnaire ne le liste ni ne l’ouvre. Flux temps réel, notifications et compteurs du tableau Admin suivent.
- Réattribution, collaboration et marketplace sont refusées (403). La base refuse tout autre responsable (`partner_lead_restricted`).
- La continuité garde ses rappels, mais ne propose ni ne remonte jamais ce Lead. Ses rappels ne vont jamais dans la file CoverView.
- Le client lui-même, s’il est un jour invité et relié dans Wallet, voit sa demande comme toute autre.

**Avis interne.** Destinataire `H3_NOTIFY_EMAIL` (par défaut `sebastien@coverview.ch`), gabarit `horizon3-request-v2` en texte et HTML ; aperçu local : `/local/emails/horizon3-request`.

- Contenu : nom, email et téléphone du client, produit, compagnie, stratégie, versement, capital, référence et lien vers le Lead. Les coordonnées y figurent par choix explicite de l’utilisateur du 16 octobre 2026 (réponse Q-3 b), au-delà du minimum de MAIL-06 : l’avis ne part qu’à l’adresse interne configurée.
- Envoi par la tâche Partner, chaque minute (MAIL-01).
- Un refus est retenté après 5 minutes par tentative faite, 10 tentatives au plus.
- Un envoi interrompu depuis plus de 10 minutes repart : un avis peut arriver deux fois, jamais pas du tout.
- 60 avis par heure au plus (MAIL-07).
- Sans fournisseur d’email, l’avis attend sans consommer d’essai.

## Données personnelles (DATA-14)

| donnée                                                       | nature                 | où                                                                  |
| ------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------- |
| prénom, nom, email, téléphone                                | identifiantes          | `partner_external_requests.data`, Lead (nom du client, coordonnées) |
| année de naissance                                           | identifiante indirecte | idem, contexte du Lead                                              |
| versement, fréquence, capital, produit, compagnie, stratégie | financières            | idem                                                                |

Jamais dans les logs, qui ne portent que des compteurs. Prénom, nom, email et téléphone figurent dans l’avis interne (Q-3 b). Aucune durée de conservation n’est définie, comme pour les Leads. L’effacement et l’export de ces commandes restent à traiter (hors périmètre S-042a).

## Exploitation

- Variables : `H3_ORIGINS`, `H3_NOTIFY_EMAIL`, `H3_OWNER_EMAIL`, côté serveur seulement. En local, désigner le compte avec lequel Partner est ouvert.
- Les avis partent avec les tâches Partner (`PARTNER_JOBS_ENABLED`) dès qu’un fournisseur d’email existe (Mailpit en local, Resend en production), comptes ouverts ou non ; l’ouverture des Leads attend que le compte désigné existe. Mise en production du 16 octobre 2026 : [plan](../../../../../../roadmap/plans/deploy-full-2026-10-16.plan.md).
- Migration 0083, additive : table, colonne nullable, contraintes, acteur système `partner-intake-v1` admis dans le journal. En cas de retour arrière, garder table et colonne : les supprimer effacerait des commandes reçues.
- Un retour arrière du code seul rendrait ces Leads visibles des autres administrateurs. Avant un tel retour, retirer les commandes du suivi partagé ou garder ce prédicat.
