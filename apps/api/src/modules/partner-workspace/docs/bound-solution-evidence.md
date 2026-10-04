# Lecture conjointe d’une association et d’une convention

Propriétaire : partner-workspace. Décisions SOL10–13, relais cc7b du 3 octobre 2026 ; brief I.10.3/13/15 et III.1–3/15. [Plan et audit](../../../../../../roadmap/plans/partner-bound-solution-evidence.plan.md), [preuves](../../../../../../roadmap/evidence/partner-core.md#relais-cc7b--lecture-conjointe-association-et-convention). Les propriétaires [association documentaire](solution-binding.md), [sources v1](solution-evidence.md) et [conventions](conventions.md) conservent leurs règles.

## Sens du rapprochement

**partner.bound-evidence.1** — La consultation v2 joint le besoin actuel, la version exacte d’offre, la dernière association personnelle applicable et le dernier dossier personnel de convention à la catégorie actuelle et à la compagnie explicitement choisie. Une association `recorded` peut guider un choix humain, jamais fournir une identité canonique. Compagnie/produit libres ne sont pas rapprochés. `companyMatch=unconfirmed`, identités juridique/produit non vérifiées et les cinq contrôles solution restent inchangés.

**partner.bound-evidence.2** — Aucun choix de compagnie à l’ouverture, même si une association existe. Une action explicite permet de reprendre la compagnie de son rapprochement personnel ; un choix exploratoire différent reste possible. Le serveur distingue absence de choix, absence d’association actuelle, association sans compagnie, autre compagnie et correspondance avec le rapprochement humain courant. La correspondance décrit seulement ce choix : une convention expirée, retirée ou indisponible ne la transforme pas en droit de distribution.

**partner.bound-evidence.3** — Seule l’association courante `recorded` fournit compagnie, mentions, motif, révision, date et échéance à la consultation conjointe. Retrait, expiration, source/offre/portée modifiée ou aller-retour : aucun ancien contenu utilisé comme rapprochement courant. L’historique demeure dans le dossier propriétaire. Une demande client de changement reste visible et invalide la reprise selon les règles d’association. Une nouvelle version d’offre ne réutilise pas l’association d’une autre version ou d’un autre Lead.

**partner.bound-evidence.4** — La convention actuelle conserve ses parties déclarées, son examen exact et sa révision, son périmètre/couverture/dates et les états/révisions de sa source. Le lecteur propriétaire applique retrait/remplacement, validité future/expiration et portée professionnelle monotone. La déclaration et l’examen général ne contiennent pas de clauses structurées démontrant la distribution du produit exact ; le résultat le dit explicitement. Aucun avis précis positif ou négatif n’est déduit ou persisté. Une information absente ne signifie pas non-couverture. Admission, économie et six contrôles des bilans restent ouverts.

## Cohérence, audience et minimisation

**partner.bound-evidence.5** — Une transaction repeatable read et un unique `assessedAt` datent les sources ensemble. Le GET verrouille et vérifie acteur/session, membre/organisation, Lead et profil canonique avec la garde personnelle existante ; droits à échéance revérifiés après les attentes. Un changement concurrent d’une ligne verrouillée peut imposer409/relecture. Un changement documentaire postérieur à l’instantané apparaît lors de la relecture ; la date de consultation reste explicite.

**partner.bound-evidence.6** — Responsable ou contributeur actuel de conseil uniquement, avec activité/catégorie/session courantes ; Admin doit être lui-même affecté avec permission/MFA. Aucun advisorId reçu. Wallet, manager seul, voisin, Admin non affecté et contributeur révoqué sont exclus. Un contributeur voit ses propres sources. Les contrats Wallet/détail partagé/bilans ne sont pas enrichis.

La projection ne transporte ni texte de page entière, ni historique, ni ID de fichier de convention, ni référence de stockage/checksum. Les cinq passages exacts déjà autorisés de l’association actuelle restent bornés et résolus par son propriétaire. Original d’offre et dossier de convention utilisent leurs routes privées actuelles, réautorisées au téléchargement. Aucune copie supplémentaire de source ou décision.

## Parcours et compatibilité

Partner → Lead → Offres → Sources de solution : offre/besoin, état du rapprochement, puis vue remplaçante des mentions/motif/échéance. Le bouton nommé à la compagnie précise qu’il reprend le rapprochement humain. La vue convention montre le sens du choix, la référence datée de l’association et la convention actuelle ; les détails d’association et le dossier d’original/historique restent accessibles sans empiler les dialogues.

Cache session/Lead/offre/compagnie/version, gcTime0, relecture10s/manuelle et après retour des dossiers. Une erreur masque l’ancienne réponse ; retour/relecture explicites masquent le contenu jusqu’au résultat. Aucun stockage navigateur. Les nouvelles vues utilisent les composants et traductions existants, un titre focalisable et des liens d’original autorisés. Aucun nouveau formulaire ni commande.

GET `/partner/leads/:id/offers/:offerId/solution-evidence?version=2`, query stricte avec `companyId` facultatif. Contrat/client dédiés. Sans version ou avec version1, réponse et lecteur v1 inchangés, indépendants de0052. Une erreur de schéma de déploiement n’est jamais transformée en absence d’association.

## Exploitation et limites

Aucune écriture métier, migration nouvelle, événement, room, job, permission, variable, dépendance ou fournisseur ajouté. Audit Admin HTTP existant conservé. Les commandes/idempotences des dossiers existants restent inchangées. Aucun effet sur offre, choix client, Lead, attribution, tâches, rendez-vous, horloges, notifications, capacité, conflits, expertise ou convention.

V2 exige0052 et sa chaîne complète, actuellement hors catalogue ;0046–0048 restent non appliquées à la base partagée. Intégration explicitement autorisée puis migrations→API→UI avant activation. Rollback applicatif : revenir au client v1 et conserver les données. Aucune base partagée lue ou migrée.117protections conservées, aucune activation/déploiement.

V0/V1/V2 isolés et deux revues statiques du même agent ne prouvent ni original réel ni fournisseur ni parcours habilité. V3 rempli/clavier/mobile ouvert sans nouvel accès WorkOS ; RLS/S-130/S-131 et brief/S-110/S-042a restent ouverts. La persistance d’une appréciation précise exige d’abord des preuves de clauses et un lien documenté aux parties/produit ; le choix humain seul ne suffit pas.
