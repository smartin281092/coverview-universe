# Incident OpenAI et animation antivirus — 2026-09-07

Demande : expliquer/corriger « OpenAI momentanément occupé » sur le document de recette, ajouter une animation pendant le contrôle antivirus. S-042a reste en cours.

**Vérifié, diagnostic réel** : appel minimal Responses avec le même magasin DPAPI et le modèle documentaire, sans document ni données personnelles, `store:false`, sortie plafonnée à 16 tokens. HTTP429, `error.code=credit_balance_exhausted`, `error.type=insufficient_quota`. Aucun contenu ou secret affiché. Le compte API exige une correction de facturation/crédits par son titulaire ; aucune transaction effectuée. L’analyse OCR n’a pas réussi.

**Correctif** : distinguer le quota fournisseur épuisé du débit limité en lisant uniquement code/type dans un corps borné ; message français dédié, erreur non retryable. Pas de modification des réservations, du budget propriétaire ou des données existantes. Les anciennes erreurs génériques restent génériques, sans prétendre connaître leur cause rétroactivement.

**Animation** : indicateur GSAP sur les états serveur queued/scanning/reading, liste et détail. Rotation décorative sans pourcentage inventé, statut textuel conservé, `prefers-reduced-motion` suivi et animations nettoyées au démontage. GSAP déjà installé ; exception Knip supprimée pour Wallet, conservée pour le marketing encore sans animation.

**Vérifié V0/V1/V2** : 8 cas unitaires de frontière HTTP (quota, débit, accès, indisponibilité, corps invalide/surdimensionné) ; réponses contrôlées sans appel ni document réel dans ces tests. Première exécution : assertion exigeant une propriété `cause` présente avec valeur undefined alors qu’elle est absente ; correction vers une assertion explicite d’absence, 8/8 ensuite. Build et typage API/Wallet réussis ; frontières/Knip réussis. Lint a détecté le type `any` du flux HTTP ; lecture validée comme Uint8Array, lint ciblé et 8 tests rejoués avec succès.

**Limites** : animation pendant un nouveau scan réel à confirmer ; aucun nouveau transfert du document utilisateur vers OpenAI, aucun changement de session ou migration. Le bundle Wallet inclut désormais GSAP (environ 228 Ko gzip contre 200 Ko avant) ; avertissement Vite préexistant, seuil inchangé.

Sources : [erreurs OpenAI](https://developers.openai.com/api/docs/guides/error-codes), [GSAP matchMedia et nettoyage](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/).
