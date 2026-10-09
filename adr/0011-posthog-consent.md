# ADR-0011 — Mesure d'audience PostHog après consentement

- Date : 2026-10-09 · Statut : accepté (demande et réponses de l'utilisateur du 9 octobre 2026)

## Contexte

L'utilisateur demande PostHog sur le site, Wallet et Partner, pas sur Admin. MKT-09 interdit tout traceur avant un consentement explicite ; LAUNCH-04 interdit toute donnée personnelle dans les événements. Les écrans de Wallet et Partner montrent des données d'assurance, de santé et d'identité. L'assistant `npx @posthog/wizard` intègre PostHog avec ses réglages par défaut, sans consentement, et écrit les clés dans `.env`.

## Décision

PostHog Cloud UE (`eu.i.posthog.com`) mesure le site, Wallet et Partner, seulement après « Accepter » dans un bandeau propre à chaque surface. Le SDK `posthog-js` est importé au moment de l'accord, jamais avant ; refuser est aussi simple qu'accepter, et « Cookies » rouvre le choix. Le SDK reste éteint par défaut, même après une réinitialisation : un refus ou un retrait arrête la capture et efface ses cookies et son stockage. Les événements gardent la structure des clics sans texte ni attributs, et des adresses sans chaîne de requête. Wallet et Partner identifient la personne par son identifiant interne opaque, sans email ni nom. Ils enregistrent les sessions avec tous les textes et toutes les saisies masqués ; le site ne les enregistre pas. Le code commun vit dans `@coverview/ui/consent` et `@coverview/ui/analytics`, qu'Admin n'importe pas. Sans clé configurée, rien n'est chargé.

## Alternatives considérées

- L'assistant PostHog — écarté : réglages incompatibles avec MKT-09 et LAUNCH-04, écriture dans `.env`, autorisation OAuth sur le compte.
- Une mesure sans cookie ni bandeau — proposée, écartée par l'utilisateur au profit d'un PostHog complet après accord.

## Conséquences

PostHog devient un sous-traitant : la politique de confidentialité, la politique cookies et la liste des sous-traitants (LAUNCH-02) doivent le citer avant toute transaction. La mesure ne couvre que les visiteurs qui acceptent. Après un retrait, seuls restent la réponse donnée à PostHog (1 ou 0) et, jusqu'à la fermeture de l'onglet, un identifiant d'onglet ; les événements déjà captés avec l'accord peuvent encore partir s'ils étaient en attente d'envoi. Le SDK pèse environ 100 Ko compressés, chargés après l'accord seulement. L'enregistrement des sessions doit aussi être activé dans les réglages du projet PostHog. Les événements produit côté serveur (LAUNCH-04) restent à faire.

## Stratégie de migration / retour arrière

Retirer la clé des variables d'environnement désactive tout, bandeau compris, sans changement de code. Relever la version d'accord dans `analytics.ts` redemande le choix à tous.
