# Mémoire CoverView

## Actives

Aucune entrée activée. L'identité du projet vit dans PROJECT.md ; les décisions initiales sont directement tracées dans les ADR et satellites indiqués, conformément à DOC-10.

## Candidats

- MEM-101 · piège · La CLI locale et l'application Codex exposent des efforts différents ; consulter CDX-02 avant de lancer une slice avec la préférence PROG-12. (Initialisation, 2026-09-05 · confiance haute · revoir avant 2026-12-04 · candidat)
- MEM-102 · fait · La reprise à contexte propre possède un checkpoint validable, mais aucun compteur de contexte consommable par l'agent n'a été identifié ; voir CDX-03 pour la limite précise. (Initialisation, 2026-09-05 · confiance haute · revoir avant 2026-12-04 · candidat)

- MEM-103 · piège · Les ports libres peuvent appartenir à une plage exclue Windows ; la décision de ports isolés et son diagnostic sont dans le ledger S-000a. Ne pas modifier les réservations système pour contourner ce cas. (S-000a, 2026-09-05 · confiance haute · revoir avant 2026-12-04 · candidat)
- MEM-104 · piège · Les exécutions agent d’Astro peuvent se détacher automatiquement ; le wrapper et la preview gardent un seul superviseur, voir apps/www/README.md et scripts/preview.mjs. (S-000a, 2026-09-05 · confiance haute · revoir avant 2026-12-04 · candidat)
- MEM-105 · décision · La compatibilité de TypeScript avec les outils imposés et la provenance du preset sont documentées au ledger S-000a ; conserver une exception explicite plutôt que désactiver un contrôle. (S-000a, 2026-09-05 · confiance haute · revoir avant 2026-12-04 · candidat)
- MEM-106 · piège · Sous Windows, le watcher API natif Node et le binaire pnpm épinglé ont été nécessaires à pnpm dev via Turbo ; voir apps/api/README.md et README.md. (S-000a, 2026-09-05 · confiance haute · revoir avant 2026-12-04 · candidat)

- MEM-107 · décision · Les défauts de préparation WorkOS S-000b sont consignés dans state.json sous project.workos et project.auth-methods ; cette sélection ne prouve aucun accès ni habilitation externe. (S-000b préparation, 2026-09-05 · confiance haute · revoir avant 2026-12-04 · candidat)

- MEM-108 · piège · Les horloges fournisseur et locale ne suffisent pas à sélectionner les sessions d’une révocation globale ; les corrections et oracles bornés sont dans le ledger S-000b et le module identity. (S-000b, 2026-09-06 · confiance haute · revoir avant 2026-12-05 · candidat)
- MEM-109 · fait · Le projet WorkOS a été identifié en lecture seule ; l’état et le diff exact préparé sont au ledger S-000b. L’absence de clé process et d’identités autorisées conserve la tranche en review et n’autorise que les suites indépendantes. (S-000b, 2026-09-06 · confiance haute · revoir avant 2026-12-05 · candidat)

- MEM-110 · piège · L’ajout direct de Sharp a initialement produit une jonction pnpm sans son suffixe de peer ; résolution outillée de la même version et vérification frozen/build dans le ledger S-010. (S-010, 2026-09-06 · confiance haute · revoir avant 2026-12-05 · candidat)
- MEM-111 · décision · S-011 reprend le français initial déjà fixé par PROJECT ; réponse déléguée à bible.question.004 consignée dans state, sans preuve éditoriale externe ni locale additionnelle déduite. (Relais S-011, 2026-09-06 · confiance haute · revoir avant 2026-12-05 · candidat)

- MEM-112 · décision · La mécanique éditoriale S-011 reste en préversion non indexable ; provenance et gardes, types JSON-LD conditionnels et limites de validation sont décrits dans le README www et le ledger S-011. Le choix local ne fournit ni biographie validée, ni source Instagram, ni collecte CRM. (S-011, 2026-09-06 · confiance haute · revoir avant 2026-12-05 · candidat)
- MEM-113 · piège · Un retour de détail vers l’index racine perd la position d’une liste paginée ; le retour vers la page calculée et une ancre focalisable est vérifié en S-011. La restauration native du focus par retour navigateur reste distincte de cet oracle explicite. (S-011, 2026-09-06 · confiance haute · revoir avant 2026-12-05 · candidat)

- MEM-114 · correction utilisateur · Après rejet de la preview, l’utilisateur a réaffirmé l’interdiction des fixtures, smoke tests et tests de surface. La priorité au parcours réel est persistée dans execution-policy.md ; configuration WorkOS réellement appliquée et intervention serveur restante dans le ledger S-000b. Ne pas reprendre les décomptes de tests historiques comme preuve de fonctionnement. (Reprise S-000b, 2026-09-06 · confiance haute · revoir avant 2026-12-05 · candidat)

- MEM-115 · correction utilisateur · Refonte blanche, sections ouvertes, bentos courts uniquement et bibliothèque commune demandées explicitement ; ADR-0006 remplace la palette initiale et la restriction de partage statique Astro. Le ledger marketing-redesign décrit cette tentative, désormais remplacée par ADR-0007, sans clore l’identité ou la collecte commerciale. (Refonte, 2026-09-06 · confiance haute · revoir avant 2026-12-05 · candidat)

- MEM-116 · correction utilisateur · La référence xAI fournie remplace la direction précédente : source intacte dans references/xai-style-reference.md, décision et substitutions de fontes dans ADR-0007, résultat et limites dans roadmap/evidence/xai-redesign.md. Aucune validation esthétique humaine ni connexion WorkOS réelle déduite de la refonte. (Refonte xAI, 2026-09-06 · confiance haute · revoir avant 2026-12-05 · candidat)

- MEM-117 · correction utilisateur · Preset shadcn et Geist réaffirmés ; MONTECH V.02 fourni remplace les rôles Geist Mono, fond blanc/cards en aplat sans bordure ni ombre. ADR-0008 gouverne les composants et la typographie, résultat dans roadmap/evidence/shadcn-typography.md. (Typographie, 2026-09-06 · confiance haute · revoir avant 2026-12-05 · candidat)

Ces candidats attendent une revue ; ils ne constituent pas des règles concurrentes des références citées.
