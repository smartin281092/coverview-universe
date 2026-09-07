# Contrats publics

## Résumé

Schémas Zod exécutables consommés par Fastify et le client HTTP commun.

## Périmètre

Santé, projection des personas fictives locales et DTO d’identité : configuration, profil/session sans token durable, espace du propriétaire, accès admin, liste bornée d’appareils, déconnexion, challenge/vérification MFA. Aucun modèle ORM, accès réseau ou secret.

`profile.ts` définit les champs facultatifs (dont téléphone et e-mail de contact), leur origine saisie/confirmation/extraction, propositions du brouillon, étapes et mutations versionnées. La liste facultative `insuranceCompanies` utilise les identifiants du répertoire `companies.ts` : null ou absent signifie aucun choix enregistré, tableau vide signifie choix explicitement vidé. Les entrées n’acceptent ni propriétaire choisi par le client, ni source OCR, ni confiance fabriquée ; seul le serveur attribue `document_extracted` et sa provenance. `documents.ts` porte originaux, analyses, classement, recherche, comparaisons et demandes de changement. Déployer les lecteurs des nouveaux champs et origines avant activation des écritures ; protocole dans le README documentaire.

## Règles métier et invariants

Les types publics dérivent des schémas (CTR-02/CTR-05). Les personas sont un contrat de démonstration du socle, pas des rôles ou identités produit.

## Permissions

L'exposition des personas est contrôlée par `apps/api/src/platform/config.ts` et le serveur. La validation d'un DTO ne confère aucun droit.

## État réel

Contrats du socle et d’identité ; l’existence d’un schéma ne prouve aucun accès WorkOS. Les entrées de mutation sont strictes, les dates en ISO et les codes d’erreur stables. Le code MFA est borné à six chiffres.
