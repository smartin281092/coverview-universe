# Livraison de l'initialisation CoverView

Journal historique. L'état après rédaction des slices est dans [la livraison de roadmap](review.md).

Date : 2026-09-05. Périmètre autorisé : plan `roadmap/plans/INIT-harness.plan.md` et demande utilisateur ; phase documentaire BOOT-10.

## Résultat

Harness adapté à Codex et conservé compatible avec les procédures Claude ; décisions enregistrées dans PROJECT/ADR/satellites ; source maître indexée et intégralement extraite ; charte et assets conservés ; structure de roadmap et templates préparés. Le dossier est prêt pour écrire ensuite la roadmap complète et les objectifs/prompts de slices.

| Élément | Statut | Preuve / portée |
|---|---|---|
| Routage et cohérence formelle du harness | vérifié | `node evals/lint-referentiel.mjs` : zéro erreur, zéro avertissement |
| Runner Codex/Claude et checkpoint portable | vérifié | `node --test evals/run.test.mjs scripts/context-handoff.test.mjs` : 10 tests réussis |
| Hook Claude existant | vérifié | `node evals/guard-bash.test.mjs` : 26 tests réussis ; cela ne prouve pas son activation dans Codex |
| Prompt d'évaluation | vérifié | `node evals/run.mjs --dry` génère le prompt, aucun appel modèle |
| Fidélité de la bible extraite | vérifié | `python scripts/extract-bible.py --check` avec runtime documenté : hash, paragraphes, tableaux et médias concordants |
| Couverture de lecture | vérifié | 2945/2945 paragraphes non vides, 108 tableaux/603 lignes, 258 titres et 114 sections numérotées ; 2115 unités de source |
| Synthèse produit | fait non vérifié | Lecture analysée : 33 capacités, 13 workflows, 15 frontières candidates, 31 groupes de questions ; jugement métier à revoir lors de l'atomisation, pas une preuve d'implémentation |
| Charte et assets | vérifié | `node scripts/verify-brand.mjs` : 46 tokens cohérents, 18 contrastes, 6 sources intactes |
| Registre de planification | vérifié | `node scripts/verify-planning.mjs` : source intacte, 3 réservations de slices ; 0/2115 unités affectées, ce reste est l'étape suivante |
| Refus d'une couverture prématurée | vérifié | Le même contrôle avec `--require-complete` échoue avec code 1 comme attendu tant que la roadmap n'est pas écrite |
| Checkpoint initial | vérifié | `node scripts/context-handoff.mjs check roadmap/handoffs/initialisation.md` passe ; structure seulement, pas capteur de contexte |
| Liens et propreté du diff | vérifié | 483 liens locaux des artefacts livrés contrôlés, aucune cible manquante ; `git diff --check` passe |
| Domaine, hosting et WorkOS | fait non vérifié | Choix enregistrés ; comptes, ressources et paramètres réels non inspectés ; aucune mutation distante |
| Dépôt GitHub | vérifié | `origin` est le dépôt fourni, `git ls-remote` n'a retourné aucune référence à l'initialisation ; commits locaux, aucun push |

## Limites explicites

- Le compteur de contexte actif n'est pas exposé aux outils de cette session. Le seuil de 70 % est enregistré et la reprise à contexte propre préparée ; une bascule automatique exacte n'est pas opérationnelle. Voir CDX-03.
- L'outil desktop expose Astra/Ultra pour créer une tâche ; la CLI locale inspectée refuse Ultra. Aucun réglage incompatible ni repli silencieux installé. La campagne modèle de routage avec cette paire et les canaris humains n'ont pas été exécutés.
- Le body fourni et la bordure décorative ont des contrastes limités ; les dérivations accessibles sont explicites dans la charte. La disposition réelle des composants sera vérifiée à la première slice UI.
- Le DOCX est la source maître intacte. Le PDF autonome RET-1 qu'il cite n'est pas fourni séparément ; aucune concordance avec ce PDF ni pagination Word rendue n'est prétendue.
- La roadmap détaillée, l'atomisation des critères et les prompts par slice restent à écrire à l'étape demandée ensuite. Aucun faux statut `done` n'est attribué aux capacités de la bible.

## État technique et reprise

Apps concernées aujourd'hui : aucune app exécutée ; tous les futurs frontends sont décrits dans PROJECT. Données persistées : documentation, extraits de référence et tokens locaux. Aucune migration, permission applicative, room, événement ou job implémenté. Aucune dépendance de package ajoutée ; scripts Node/Python sans dépendance externe. Variables futures WorkOS et modes fictifs préparés dans le template env, sans secret réel.

Session réelle d'initialisation : Codex, modèle communiqué par l'environnement « GPT-6 » ; effort effectif non observable. Préférence des futures slices et lancement explicite : PROG-12/CDX-02. Coût de cette session non observable, donc non renseigné.

Dérogation de procédure : bootstrap documentaire avant roadmap/scaffold, expressément demandé par l'utilisateur et nommé BOOT-10. Écarts du harness corrigés dans le périmètre : anciennes valeurs auth/preset/tier/hébergement, confusion V3/V5 et dépendance temps réel prématurée ; trace dans CHANGELOG et cas de routage ajoutés. Le favicon source non carré est signalé dans la charte pour une future exportation ; original préservé.

Mémoire initialisée ; trois entrées de backlog en `idea`, aucune en `running`. Gabarit de plan et de prompt prêts, aucun plan d'application approuvé. Checkpoint de reprise dans `roadmap/handoffs/initialisation.md`. L'historique Git conserve l'entrée d'origine et l'adaptation documentaire.
