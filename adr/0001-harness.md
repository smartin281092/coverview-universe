# ADR-0001 — Instanciation du harness CoverView

Date : 2026-09-05 · Statut : accepté pour l'initialisation explicitement demandée.
Source reçue : HARNESS_VERSION **2.1.0**. Adaptation locale : **3.0.0-coverview.1**. Les changements de sens sont tracés dans CHANGELOG ; cette version n'est pas annoncée comme une release du harness amont.

## Contexte et décision

Adopter le harness SaaS solo fourni, adapté à Claude Code et Codex par un référentiel commun ; AGENTS reste un pointeur. Appliquer le mode documentaire BOOT-10 avant la planification détaillée souhaitée ensuite. La demande d'adaptation autorise ce travail ; aucune slice applicative n'est exécutée.

| Invariant | Forme retenue | Porteur |
|---|---|---|
| Journal | Git, plans et backlog versionnés | PROG-13 |
| Oracles | Vérifications proportionnées, faits et preuves distincts | PROG-10, G-18 |
| Plan avant exécution | Futurs plans persistés et autorisation du périmètre | G-17, PROG-07 |
| Secrets | Interdiction et gitignore ; capacités réelles de l'hôte explicites, pas de sandbox prétendue | G-04, ENV-06, CDX-04 |
| Modèle | Paire explicitement demandée pour les slices ; session réellement observée enregistrée | PROG-12, CDX-02 |
| Budget de travail | Portée d'une session cible et décision de redécoupage ; aucune borne machine prétendue | PROG-14 |
| Coût | Relevé uniquement si observable ; jamais inventé | PROG-14 |
| Évaluation | Linter, tests des outils, éval de routage et canaris distincts | EVAL-01, EVAL-04 |
| Replay | Non exigible en profil solo ; reprise par artefacts | CDX-03 |

Stack conservée : pnpm/Turborepo, TypeScript, Fastify/Zod, Drizzle/Postgres, React/Vite/TanStack, Astro, Redis/BullMQ et composants à introduire au premier besoin. Versions stables à vérifier lors de l'installation future, pas installées pendant cette préparation.

Dérogations explicitement demandées : fournisseur WorkOS (ADR-0003), preset et marque (ADR-0004), cible Infomaniak (ADR-0005), modèle/effort et reprise Codex (PROG-12 / CDX-03). Le défaut B2B générique ne décide pas la tenancy du produit (ADR-0002).

## Alternatives et conséquences

Dupliquer les règles pour Codex et Claude créerait deux référentiels divergents ; conserver un pointeur et des procédures lisibles par les deux. Une configuration Ultra incompatible avec la CLI serait trompeuse : la préférence s'applique au lancement par la surface compatible. Aucune télémétrie de contexte exploitable n'existe ici : la reprise est préparée, son seuil exact n'est pas automatisé.

## Évolution

Réviser par ADR si le périmètre ou les choix changent. Conserver les sources intactes et l'historique ; ne pas écraser l'adaptation locale par une copie du harness amont.
