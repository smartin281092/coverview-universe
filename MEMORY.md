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

Ces candidats attendent une revue ; ils ne constituent pas des règles concurrentes des références citées.
