# Client HTTP CoverView

## Résumé

Frontière HTTP commune des surfaces, dérivée des schémas de `@coverview/contracts`.

## Périmètre

Sondes de disponibilité et personas locales, avec timeout, annulation, corrélation et validation runtime. Les sessions WorkOS viendront en S-000b.

## Règles métier et invariants

Aucun accès base ou règle métier. Toute réponse externe est validée ; les erreurs exposent un code stable sans URL de connexion.

## Permissions

Aucun credential ni cookie envoyé dans le socle. Le serveur décide des droits et de l'exposition des données.

## État réel

Client HTTP connecté à l'API ; la sélection locale d'une persona ne crée aucune session.
