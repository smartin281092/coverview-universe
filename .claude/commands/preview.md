---
description: Lance les applications en local et rend le panneau de test complet — URLs, comptes, cartes de test, points à vérifier, suite à donner
---
Objectif : permettre de tout tester depuis un navigateur, sans ouvrir de terminal.

1. Exécute `node scripts/preview.mjs start`. Si des apps ne répondent pas, lis les dernières lignes du log concerné dans `.preview/` et dis **ce qui bloque** — ne relance pas en boucle. Si les personas sont absentes, lance `pnpm db:seed` puis `node scripts/preview.mjs info`.

2. Restitue le panneau produit par le script **tel quel**, avec les URLs en clair pour qu'elles soient ouvrables d'un clic. N'y ajoute ni ne retranche aucun identifiant : la source de vérité est le module de personas des seeds (ENV-07), jamais cette commande.

3. Ajoute une section **À tester maintenant** :
   - s'il existe une slice en cours (`roadmap/backlog.yaml` en statut `running` — PROG-03), dérive les points du plan `roadmap/plans/S-xxx.plan.md` — un point par critère de DoD observable à l'écran, formulé comme une observation attendue (« la liste affiche l'état vide avec le bouton Créer »), jamais comme « vérifier que ça marche » ;
   - indique pour chaque point **avec quelle persona** le tester ;
   - reprends le parcours de fumée du script uniquement si aucune slice n'est en cours.

4. Termine par **Suite à donner**, en deux lignes copiables :
   - si tout est conforme → `/ship S-xxx` sous Claude ; sous Codex : `Applique .claude/commands/ship.md pour S-xxx`
   - sinon → une ligne prête à compléter : `Échec preview S-xxx : <ce que tu as observé> sur <persona> à <URL>` — l'échec sera consigné dans le journal de vérification du plan (PROG-18, §6.4), et deux échecs sur la même cible imposent un changement de stratégie.
   Ajoute ensuite le sujet de la **prochaine slice** : première entrée `ready` de `roadmap/backlog.yaml`, titre et objectif en une ligne.

Applique PROG-18 pour distinguer le démarrage du panneau, un parcours V3 réellement observé avec les outils disponibles et une validation humaine V5. Ne classe rien en « vérifié » sans l'oracle correspondant.

Aucun `db:reset` ni migration destructive dans cette commande. Si le schéma est en retard, dis-le et propose la commande — ne l'exécute pas d'office (ENV-05, G-05).
