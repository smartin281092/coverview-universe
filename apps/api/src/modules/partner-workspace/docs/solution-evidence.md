# Sources de solution et de convention pour une offre exacte

Propriétaire : partner-workspace. Décisions déléguées du 3 octobre 2026, relais 6ab2 ; brief I.10.3/13/15, II.1, III.2/15. [Plan et inconnues](../../../../../../roadmap/plans/partner-need-solution-evidence.plan.md), [preuves et limites](../../../../../../roadmap/evidence/partner-core.md#relais-6ab2--sources-de-solution-et-de-convention).

## Identité et portée

**partner.solution-evidence.1** — Le point d’entrée est une version exacte d’offre du Lead, identifiée par son ID immuable. Version, référence, activité, état, date de revue et validité restent distincts. Le besoin est relu dans son périmètre actuel, avec sa révision et la demande de changement d’interlocuteur. Consulter cette offre ne sélectionne pas une solution pour le client.

**partner.solution-evidence.2** — Les noms de compagnie et de produit de l’offre sont des textes libres. Le répertoire commercial des conventions ne constitue pas une identité juridique vérifiée. La compagnie à examiner est donc un choix facultatif, initialement vide, éphémère, jamais rapproché automatiquement d’un libellé. Ce choix ne confirme aucun lien entre l’offre et la convention. Une compagnie absente reste non représentée ; aucun alias automatique n’est créé.

**partner.solution-evidence.3** — La réponse conserve toujours `companyMatch=unconfirmed` et `assessment=human_review_required`. Identité de la compagnie, périmètre du produit, admission du client, droits de distribution et accord économique restent à examiner. Un examen général favorable ou limité ne les valide pas. Les six contrôles des bilans d’adéquation restent inchangés. Aucun montant, commission, habilitation, classement ou attribution n’est déduit.

## Sources et audience

**partner.solution-evidence.4** — La lecture joint la version exacte au dernier dossier personnel de convention pour la catégorie actuelle du besoin et la compagnie choisie. Les [règles du dossier de convention](conventions.md) font autorité pour son sens, ses parties, sa portée, sa validité et son historique. Une nouvelle déclaration ou un retrait ne fait jamais réapparaître un ancien examen favorable. Une portée professionnelle modifiée reste indisponible, même après un aller-retour de libellé.

**partner.solution-evidence.5** — La garde personnelle du bilan est réutilisée : session actuelle, activité/catégorie/organisation courantes et responsabilité ou contribution de conseil au Lead. Manager seul, voisin et Wallet sont exclus. Un Admin ne consulte ici que ses propres sources lorsqu’il intervient personnellement sur le Lead, avec permission et MFA récents. Aucun `advisorId` client n’est accepté ; un contributeur consulte son dossier, jamais celui du responsable. Les droits sont revérifiés après l’attente de lecture pour refuser une session, un MFA ou une habilitation arrivée à échéance.

**partner.solution-evidence.6** — Besoin, offre et convention sont lus en transaction repeatable read, datés par un seul instant de transaction, y compris leurs échéances. Le résultat est un instantané daté : un changement postérieur n’y est pas rétroactivement incorporé. La relecture révèle les nouveaux états. Une modification conflictuelle d’une ligne verrouillée provoque une erreur409 et exige relecture. Les sources d’offre courante/modifiée/indisponible/non liée/désactivée et de convention absente/disponible/modifiée/indisponible/désactivée restent explicites. Une preuve téléchargeable ne devient pas pour autant une preuve applicable.

## Parcours, API et exploitation

Partner → Lead → Offres → « Examiner la solution et mes conventions ». Besoin et offre sont présentés, puis la compagnie choisie permet d’examiner la convention. Le dossier personnel existant s’ouvre à cette compagnie et cette catégorie pour l’original et l’historique ; les dialogues se remplacent. Le retour masque la réponse précédente jusqu’à relecture. Cache par session/Lead/offre/compagnie, gcTime0, relecture10s et manuelle, erreur masquante ; aucune persistance navigateur. La sélection locale de compagnie disparaît à la fermeture.

GET `/partner/leads/:id/offers/:offerId/solution-evidence`, query stricte `companyId` facultatif. Contrats Zod et client HTTP communs ; aucune route Wallet. La projection contient des données privées déjà autorisées, notamment les textes et noms déclarés de la convention, mais aucun ID de son fichier ni contenu original. L’ouverture et le téléchargement utilisent leurs routes privées existantes et leurs contrôles actuels.

Aucune écriture de décision ou d’association, événement, room, job ou notification dans cette lecture. Les commandes des dossiers existants conservent leurs effets et audits. Aucune migration, dépendance, variable, permission ou fournisseur ajouté. Les tables pending0049–0051 ne sont pas nécessaires à cette route ; les tests la lisent sans elles. Cette compatibilité ne permet pas d’activer les autres nouveaux parcours sur un schéma incomplet.0046–0048 restent non appliquées à la base partagée et0049–0051 hors catalogue protégé ; aucun déploiement effectué. Rollback applicatif sans transformation de données.

Types/lint/builds et tests PostgreSQL18 isolés constituent les preuves disponibles. Examen et antivirus des fixtures sont synthétiques. Le parcours rempli, le clavier, le mobile et les originaux réels restent non vérifiés sans nouvel accès WorkOS. Les limites héritées RLS et rétention/export/effacement S-130/S-131 restent ouvertes. La prochaine tranche doit auditer une association canonique sourcée et révisable avant toute appréciation précise ; l’identité juridique et les droits de distribution ne doivent pas être supposés.
