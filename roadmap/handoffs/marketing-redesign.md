# Refonte marketing et système commun — 6 septembre 2026

## Instruction et périmètre

L’utilisateur rejette aussi la correction intermédiaire et autorise explicitement à tout recommencer visuellement : site public pensé conversion et SEO dès la première version, structure inspirée d’IM8, qualité visuelle et système inspirés d’Apple, fond de base blanc, ancienne palette abandonnée. Bibliothèque de composants commune aux applications. Sections ouvertes, aucune section emballée en card ; cards réservées à des bentos courts avec illustration ou grand chiffre. Ces exigences priment les choix visuels précédents du harness (ADR-0006).

Le commit local `a1f958f` conserve la reprise précédente ; il n’est pas une validation du rendu. Main reste `bdef821`. Aucun push ni déploiement. Stack existante Astro/React/Fastify et hébergement Infomaniak conservés.

## Travail

1. Examiner IM8 et Apple, puis retenir une direction unique : blanc, noir doux, ample typographie, grandes respirations, images de qualité et couleur d’action discrète. Pas de reconstruction des pages précédentes en changeant seulement les couleurs.
2. Réécrire la narration marketing depuis la bible : proposition de valeur, problèmes concrets, bénéfices, fonctionnement, comparaison des approches, objections/FAQ et appels à l’action cohérents. Aucun témoignage, résultat, certification, nombre de clients ou tarif inventé. Structurer les pages par intention SEO et relier les contenus utiles.
3. Étendre `packages/ui` comme source commune des tokens et composants de présentation, exploitable par les apps React et le rendu statique Astro. Appliquer le système aux apps, sans modifier leur protocole d’identité.
4. Recomposer le site public : accueil complet puis gabarits marketing, éditoriaux et compte. Les sections n’ont pas de conteneur card ; quelques bentos répondent strictement à la demande. Accessibilité, responsive, métadonnées et performance du rendu intégrés.
5. Parcourir la version réelle et compiler. Pas de nouvelles fixtures, smoke tests ni batterie de contrôles de surface. Les capacités non encore implémentées ne deviennent pas fonctionnelles par le texte.

## Continuité WorkOS

Callback exact et Magic Auth déjà configurés dans coverview / LocalHost. Clé serveur et login réel toujours en attente ; lanceur masqué prêt dans une fenêtre dédiée. Cette refonte n’annule pas ce travail. La reprise reste dans la tâche courante, sans déclarer l’identité terminée ni ouvrir artificiellement ses dépendances.

## État après exécution

Refonte appliquée et compilée, rendus réels inspectés sur ordinateur et mobile. Détails dans le [ledger](../evidence/marketing-redesign.md). Site à `http://127.0.0.1:4103/`. Les trois applications utilisent le système commun. La connexion WorkOS demeure le travail en attente de saisie serveur ; aucune slice dépendante n’est déclarée terminée.
