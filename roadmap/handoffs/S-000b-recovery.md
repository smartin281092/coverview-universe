# Reprise — parcours compte et preview

Créé : 2026-09-06. Reprise explicitement demandée dans la tâche S-000b après rejet utilisateur de la preview : rendu insuffisant, parcours non fonctionnels, WorkOS non activé et arrêt mal signalé. Ce retour est une instruction de correction ; aucun GO supplémentaire nécessaire pour les changements locaux.

## État et périmètre

Worktree 4133 synchronisé sans perte par fast-forward sur main `bdef821733c1c714d50d7712b19562bfe26837f7`, incluant S-010 et la livraison locale S-011. Preview précédente arrêtée avant synchronisation ; Docker du seul compose S-000b conservé. Pas de modification concurrente observée ; S-011 est en revue, aucune nouvelle slice éligible n’avait été lancée.

La preview précédente servait encore `94f6939`, et les écrans Wallet/admin demeuraient techniques même dans main. Réponse visée : surfaces de compte cohérentes, pages publiques lisibles sur mobile et parcours WorkOS activable réellement. Les tests simulés ne closent pas la connexion réelle.

## Actions autorisées

1. Rendre compte/connexion prioritaires dans Wallet et équipe ; garder fixtures et diagnostics sur leurs routes techniques, hors navigation produit.
2. Corriger hiérarchie visuelle, ordre des CTA mobile et navigation publique dans les limites de charte/preset et des contenus déjà livrés. Conserver disponibilité exacte des futurs outils, sans fabriquer calculs ni résultats.
3. Revérifier l’environnement WorkOS identifié, les clés disponibles pour ce projet, la configuration exacte et le parcours login/callback/logout. Protéger secrets et permissions ; préparer complètement toute action exigeant une intervention utilisateur précise.
4. Tester les comportements changés puis ouvrir la version corrigée. Ne pas présenter comme terminé un outil futur ni une connexion non exécutée.

## Coordination et oracles

Instruction utilisateur réaffirmée en cours de reprise : pas de fixtures, smoke tests ni autres tests de surface. Délégations réorientées immédiatement : UI réelle, injection serveur et parcours WorkOS réel ; ne pas développer une nouvelle batterie simulée. Le mandat canonique a été précisé dans execution-policy.md pour conserver cette correction au relais.

Racine : identité, configuration serveur, WorkOS, roadmap et preview. Délégations bornées : client/admin et tests socle ; www et tests publics. Revue séparée du rendu et du parcours. Préserver les commits reçus et les processus étrangers. État S-000b reprend running ; S-011 conserve review. Le mandat séquentiel reste applicable après résolution du blocage et recette réelle.

Santé HTTP, typage et rendu ne prouvent ni authentification, ni OTP, ni MFA réels. Critères C01/C03/C05 du plan S-000b inchangés ; journal de reprise au ledger S-000b. Aucune clé réelle trouvée dans les variables Process/User/Machine ; le contrôle des .env du projet ne lit vers la sortie que les noms des clés présentes.
