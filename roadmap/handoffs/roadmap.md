# Reprise de travail — roadmap

Checkpoint historique de rédaction ; l'exécution est désormais autorisée par [le mandat](../execution-policy.md) et démarre avec [S-000a](S-000a-start.md).

Créé : 2026-09-05.
Contexte observé : non disponible ; checkpoint préventif, aucun seuil de 70 % mesuré.

## Mission et autorisation

La demande d'adapter le harness Claude à Codex et d'indexer la bible est traitée. La demande suivante de rédiger la roadmap complète et les objectifs/prompts Astra Ultra est traitée à son tour. Cette autorisation couvre la rédaction et son outillage local, aucune slice applicative n'est encore autorisée. Les futures instructions utilisateur peuvent autoriser leur périmètre sans demande répétée.

## État du dépôt

Dépôt D:/Projects/coverview-astra, branche main, remote origin vers smartin281092/coverview-universe. La livraison de roadmap est versionnée dans le commit conventionnel décrivant les slices Astra Ultra ; vérifier git log et git status avant mutation. Le commit précédent de préparation est 73740c7. Aucun push, changement de service, ressource Horizon ou DNS pendant la rédaction. Aucun code d'application scaffoldé.

## Sources à lire

AGENTS.md puis CLAUDE.md, PROJECT.md, entrées actives de MEMORY.md et docs/codex.md. Consulter ROADMAP.md, roadmap/index.md, roadmap/README.md et le plan/prompt exact de la prochaine slice. Les specs JSON sont canoniques pour la rédaction ; state.json est canonique pour statut, autorisations, réponses, essais et preuves. Les vues se régénèrent par scripts/build-roadmap.mjs. Ne pas recharger la bible entière : ancrages par critère et coverage.json.

## Décisions acquises

PROJECT et ses ADR portent WorkOS coverview, preset shadcn et charte, détails en modal/panneau/page sauf FAQ, données fictives locales, Infomaniak Horizon avec protection absolue des instances existantes et dépendances, domaine coverview.ch et Astra Ultra. Bible complète, y compris capacités dites futures. Les autres décisions restent dans les plans et le registre ; aucun défaut recommandé n'est approuvé implicitement.

## Livraison et preuves

120 slices, 682 critères, 247 vues générées ; couverture 2 115/2 115 unités (1 742 reliées aux critères, 373 contexte qualifié). DAG sans cycle et toutes les slices sur le chemin final S-140. Toutes specified, état d'exécution vide. Contrôles de source, génération/fraîcheur et tests de planification passés ; détails et limites dans roadmap/review.md. Aucune preuve de fonctionnalité produit. LPP S-021/S-022/S-036/S-041 inclus ; calibrations décomposées et assistants pro S-122 ajoutés en revue.

## Prochaine action bornée

Si l'utilisateur autorise le lancement, lire le plan S-000a et son prompt, vérifier l'autorisation effective puis livrer uniquement ce socle local. Sinon traiter sa revue de roadmap et mettre à jour les sources canoniques, sans lancer le développement. Réutiliser les décisions déjà acquises. Les futurs statuts ready/running requièrent approbation et réponses exactes avec preuve dans state.json.

## Obstacles et tentatives

Aucun obstacle documentaire restant. Questions de droits, méthodes/calibrations, conditions commerciales et comptes tiers bloquent leur comportement futur seulement. RET-1 autonome absent, concordance avec ce PDF non vérifiée. CLI locale précédemment inspectée incompatible Ultra ; utiliser la surface qui expose réellement la paire PROG-12. Pas de compteur de contexte disponible. Les contrôles de documents ne valent ni conseil financier validé ni recette produit.

## Coordination

Sous-agent acquisition : critères et générateur/tests ; Retire : critères, sous-campagnes et tests de guards ; opérations : critères, liens transverses et S-122. Leurs livrables sont intégrés ; aucune tâche d'implémentation ni processus applicatif n'est lancé. Vérifier l'absence d'écriture concurrente avant reprise. Les scripts de rédaction .planning-local sont temporaires et ignorés, non nécessaires à la maintenance ; seules les sources versionnées font foi.
