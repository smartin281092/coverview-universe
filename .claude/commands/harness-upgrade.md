---
description: Met à niveau le référentiel de ce projet depuis une version plus récente du harness (BOOT-08) — usage /harness-upgrade ../saas-harness
---
Lis `HARNESS_VERSION` de ce projet et celui du harness source situé en $ARGUMENTS (défaut : demander le chemin). Lis ensuite `CHANGELOG.md` du source.

**N'écrase JAMAIS le référentiel local par une copie en masse.** Ce projet a pu déroger à des règles par ADR, ajouter des satellites, ajuster des seuils : une copie par-dessus efface des décisions sans laisser de trace. La mise à niveau se fait **entrée de changelog par entrée de changelog**.

1. Si les versions sont identiques, dis-le et arrête-toi. Rien d'autre.

2. Pour chaque version du changelog entre la version locale (exclue) et celle du source (incluse), et pour chaque entrée de cette version : localise dans ce projet la règle ou le fichier concerné par son **identifiant**, et classe l'entrée en :
   - **applicable telle quelle** — le projet est conforme à l'état d'avant, le correctif s'applique sans conflit ;
   - **en conflit** — le projet a divergé (dérogation en ADR, seuil ajusté, fichier réécrit). Nomme la divergence et sa source (quel ADR, quelle slice) ;
   - **sans objet** — la règle porte sur une surface absente de ce projet.

3. Rends un tableau : version · entrée · identifiants · classement · action proposée. Trie par gravité en te servant du type d'incrément : les **correctifs** d'abord (une erreur factuelle ou un garde-fou défaillant se porte partout, sans discussion), puis le **majeur**, puis le **mineur**.

4. **Attends ma validation avant d'appliquer quoi que ce soit.** Applique ensuite uniquement ce que j'ai retenu, en un commit par version du changelog — pas un commit fourre-tout : l'historique doit dire quelle version a été portée quand.

5. À la fin : mets à jour `HARNESS_VERSION` local, ajoute une ligne à `ADR-0001` (version portée, date, entrées écartées **et pourquoi** — une entrée écartée sans motif se re-proposera à chaque mise à niveau), puis lance `node evals/lint-referentiel.mjs` et `node evals/guard-bash.test.mjs`. Si `CLAUDE.md` §5 ou un satellite a bougé, signale que `/eval-routing` est à passer avant merge (EVAL-02) — ne le lance pas d'office, il consomme un appel modèle.

Si le harness source est inaccessible, dis-le et arrête-toi : ne reconstitue pas le changelog de mémoire.
