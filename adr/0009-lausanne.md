# ADR-0009 — Lausanne comme police principale

Statut : accepté sur demande explicite de l’utilisateur, le 19 septembre 2026.

## Décision

Lausanne remplace Geist pour les titres et le corps sur toutes les apps et le site marketing. Cette décision remplace uniquement le choix de police principale d’ADR-0008 ; le preset shadcn et Montech restent en place.

Les huit WOFF2 téléchargés depuis Ramp sont auto-hébergés dans `packages/ui/src/fonts/lausanne`. Le thème partagé porte les déclarations et le token `--cv-font-sans` (DSN-02, MKT-06). L’export d’autorisation utilise ce même token et attend ses faces avant de mesurer et dessiner le texte.

Les poids disponibles sont 300, 350, 400 et 700, en romain et italique. Les poids CSS existants sont conservés : la sélection standard des faces utilise 400 pour une demande 500 et 700 pour une demande 600. Aucun fichier variable ni poids intermédiaire n’est inventé.

La provenance, les empreintes et l’état des droits restent documentés dans `references/ramp-fonts/sources.json` et son README. Le téléchargement ne constitue pas une vérification de licence.

## Vérification

Voir [le relevé de vérification](../roadmap/evidence/lausanne-font.md).
