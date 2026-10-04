# Autorisations et signatures

## Parcours

Demande utilisateur du 9 septembre 2026 : signature tracée dans Wallet, acceptation explicite et document horodaté conservé. `GET /authorizations/:kind` prépare la procuration ou le mandat du profil demandé ; `POST /authorizations/:kind/sign` conserve la preuve dans PostgreSQL. `GET /authorizations/status` et `/authorizations/receipts/:id` exposent le statut courant et l’archive privée. La page de signature revient à l’action via un identifiant validé, jamais une redirection arbitraire.

Le texte canonique versionné réside dans `packages/contracts/src/authorization-texts.json`, partagé avec l’affichage LSA45. Une signature contient le document exact, les données d’identification/contact affichées, le tracé normalisé et borné, le signataire, le lieu, l’acceptation explicite, la date serveur et l’empreinte de l’ensemble. AVS, Finances et Santé ne sont pas inclus. Le document signé est ensuite affiché depuis cette archive, sans substitution par les coordonnées futures du profil. Le PDF téléchargeable dérive de cette archive et joint aussi son JSON exact. Les pages sont rendues en images pour conserver les caractères disponibles dans les polices du navigateur ; le texte du PDF n’est donc pas sélectionnable, son contenu structuré reste dans la pièce jointe JSON.

## Autorité et conservation

Contrôles Host/session/CSRF, validation partagée, propriétaire et profil exact ; les profils gérés exigent une déclaration explicite d’habilitation du signataire. Cette déclaration ne prétend pas vérifier un pouvoir externe. Sous verrou du compte/session, révision et empreinte du document empêchent de signer un contenu remplacé. La commande est idempotente ; sa clé et son empreinte restent dans la preuve de signature, pas dans un cache expirant. Une preuve révoquée ne peut être rejouée. Une signature par propriétaire/profil/type/version actif est garantie en SQL.

Il s’agit de la signature du client, pas d’une contresignature CoverView simulée ni d’une signature électronique qualifiée. Aucune affirmation de validité juridique générale n’est déduite de ces contrôles. `readAuthorizationStatus` ne considère que la version courante non révoquée, pour le profil exact. Les notifications compagnies exigent ce mandat côté serveur, y compris lors d’une reprise de commande. Le changement d’adresse ne réécrit pas la preuve d’origine.

La table `authorization_signatures` conserve des données personnelles et le tracé ; elles ne sont pas écrites dans les logs. Les helpers d’activité ne retournent que les métadonnées datées, bornées à 200 entrées avec indicateur de troncature. L’archive signée ne dépend pas de la suppression d’un scan. Les durées légales et les parcours globaux d’export/effacement restent à traiter dans S-130/S-131, sans durée inventée. Aucun événement externe, email ou job de signature ; aucune dépendance ajoutée.

## Réception dans l’Admin et clôture des actions

Une signature courante termine immédiatement l’action correspondante dans Wallet. Les actions procuration/mandat et lecture LSA45 n’acceptent aucune réponse libre ni commande générique de résolution ; les anciens messages conservés en historique ne remplacent pas la preuve et ne créent plus un état En cours. La notice exige sa propre ouverture enregistrée et ne produit pas de notification de signature.

`GET /admin/notifications`, protégé par `administration.access`, MFA et audit d’accès, fournit les réceptions de procurations/mandats signés. La signature persistée constitue directement la notification : aucun envoi asynchrone susceptible d’être perdu et aucun doublon lors du rejeu. Projection SQL limitée aux identifiants, type, nom du profil lors de la signature, compte de rattachement actuel, date et révocation éventuelle ; ni tracé ni contenu signé complet dans la liste. Pagination stable par date/identifiant, 20 entrées par page. L’Admin actualise cette liste toutes les 15 secondes et ouvre le dossier du bon profil ; pas de statut lu/non lu ni de validation administrative exigée pour terminer l’action. Les signatures déjà enregistrées sont incluses. Un transfert garde sa date de réception et montre le nouveau rattachement avec la révocation, sans fabriquer une nouvelle réception.

Extension sans migration : les tables de preuves et leur idempotence existantes restent la source de vérité. Les tests de signatures contrôlent la notification unique, les deux types de document, la pagination et les métadonnées révoquées ; les tests HTTP identity couvrent absence de session, permission, MFA et retrait des droits pour cette route.

## Vérifications

Migration additive `0015` ; tests PostgreSQL de signature, isolation, révisions, acceptation, bornes, rejeu, session/révocation et stabilité du contenu après modification du profil. Résultats et limites de recette : [journal du Centre d’action](../../../../../roadmap/evidence/document-action-center.md).
