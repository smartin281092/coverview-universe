# Appréciation personnelle de l’expertise par besoin

## Sens et parcours

Propriétaire : partner-workspace ; brief I.10.3/18/20. Fiche Lead → Mon adéquation → Mes preuves pour ce besoin → Apprécier mon expertise. Le conseiller examine le besoin exact et ses [sources générales de compétence](need-expertise-evidence.md), puis consigne une appréciation privée : expertise confirmée personnellement dans le périmètre examiné, spécialiste nécessaire ou éléments à clarifier.

Périmètre réellement examiné (10–500caractères), limites/inconnues, motif lié aux sources et prochaine vérification/complément/spécialiste (chacun10–1000), échéance et confirmation explicites. Nouvelle appréciation toujours vide, sans positif présélectionné. Ne pas saisir d’identité de tiers ni de détails confidentiels inutiles. La suite est une note à traiter humainement, aucune sollicitation de spécialiste ou tâche créée automatiquement.

Le positif exige la dernière source disponible, examinée à sa révision courante, non expirée, de portée professionnelle actuelle et de catégorie couverte. Couverture générale complète ou limitée : l’humain doit apprécier le lien précis au besoin et ses limites ; le système ne fait aucune analyse sémantique. Échéance positive au plus tard celle de l’examen documentaire. Sans ces preuves, spécialiste et clarification restent possibles ; absence de preuve ne signifie pas incapacité. Une demande client ouverte interdit le positif. Ces garde-fous de produit ne sont pas une certification juridique.

Preuve générale, expertise précise, habilitation et solution distribuable demeurent distinctes. Les bilans v1/v2 et leurs six contrôles restent inchangés. Aucun score, classement, attribution, mandat, rendez-vous, horloge, tâche, notification, capacité ou conflit modifié.

## Audience et sources

GET/POST `/partner/leads/:id/expertise-review`, historique GET `beforeRevision` facultatif, contrats/client dédiés. Aucun advisorId accepté. Même garde personnelle que le bilan : responsable/contributeur de conseil actuellement autorisé, session/membre/organisation/activité/catégorie/Lead actif ; Admin lui-même affecté avec permission/MFA actuels. Manager seul, voisin, Wallet et superviseur Admin d’autrui exclus. Perte de mandat : aucun accès résiduel au dossier, à l’historique ou au retrait.

Contexte réutilisé de `partner.need-context.ts` : sujet/propriétaire canonique, portée du besoin/profil, révisions professionnelles et de membre, mandat, préférences, référent et demande client. Les révisions monotones empêchent la réactivation après aller-retour. Les changements de capacité/agenda/conflits seuls ne concluent ni n’invalident l’expertise.

Chaque version précise fige le besoin, les textes de l’appréciation et les références exactes : ID de déclaration, ID/révision de décision documentaire, révisions courante/examinée de l’original, états source/examen et échéance de celui-ci. La décision référencée porte déjà son auteur/date/portée/couverture et la déclaration ses parties. Aucun original, checksum, clé/URL de stockage, déclaration générale ou motif général recopié dans la nouvelle preuve. La lecture courante réemploie le lecteur propriétaire et son composant de présentation ; ouverture du dossier existant à sa catégorie actuelle pour original/historique/retrait/remplacement.

## Validité, concurrence et rejeu

Versions immuables, pas d’édition/suppression. États : manquant, retiré, portée ou sources à réexaminer, expiré, enregistré. Seul enregistré expose une position effective. Retrait motivé sans position/périmètre/limites/suite/échéance, conservant l’histoire. Dernière version seulement, aucun ancien favorable réactivé après retrait/remplacement/expiration. Échéance de l’examen documentaire passée modifie la base de sources et impose un réexamen ; échéance personnelle passée seule produit expiré. La disponibilité documentaire est une capacité actuelle, pas une nouvelle preuve.

Historique20 borné au sujet canonique courant ; le curseur ne modifie pas le courant. Propriétaire transféré : même sujet, nouvelle portée ; autre sujet rattaché : aucune ancienne histoire exposée. L’historique reste explicitement passé, même pour une ancienne échéance future.

Lecture repeatable read datée ; mutation/rejeu sous verrous acteur/session, membre/organisation, Lead, profil canonique puis original en partage. L’instant est pris après le dernier verrou ; droits à échéance revérifiés après cette attente. Révision/empreinte exactes et échéance encore future contrôlées avant insertion. Remplacement/examen documentaire se sérialisent par le membre, changement du fichier par le verrou de source. Version, commande idempotente et audit atomiques. Rejeu exact : droits et situation actuels, aucune nouvelle version ; clé réutilisée avec un autre contenu refusée. Origine/CSRF/débit/session et audit Admin HTTP existants conservés.

## Interface et exploitation

Vues courant/sources/formulaire/historique/détail remplaçantes, RHF/Zod, i18n et composants existants. Le besoin et les références initiales restent figés pendant la saisie ; modification détectée bloque une nouvelle commande. Clé/contenu de la première commande conservés en mémoire même lorsqu’une erreur GET masque/remonte le formulaire. Réponse incertaine : réessai identique possible après échéance ; refus4xx : relecture puis nouveau formulaire. Fermeture/retour abandonne cette reprise proposée, sans annuler une écriture éventuellement réussie. Aucun stockage navigateur persistant.

Cache session/Lead, gcTime0, relecture10s/manuelle, erreur masquante. Retour depuis formulaire/sources/dossier général masque les données jusqu’à relecture. Source ouverte depuis le dossier précis utilise sa catégorie actuelle, sans emprunter une ancienne réponse du dialogue parent. Focus placé dans les vues, fermeture empêchée pendant soumission ; parcours clavier/mobile réels non observés.

0051 hors catalogue : `apps/api/drizzle-pending/0051_partner_need_expertise/`, SQL/snapshot/entry. Table `partner_need_expertise_reviews`, FK/indexes/contraintes de révision/action/textes/JSON/date ; aucun backfill. Génération temporaire avec0049 et0050, puis génération sans delta. Tests appliquent cette chaîne deux fois en PostgreSQL18 isolé.100fichiers Drizzle et6artefacts0049/0050 conservés byte-for-byte.

**Activation non livrée.** Le `db:migrate` normal n’applique pas0049–0051. Intégration future explicitement autorisée du catalogue complet puis migrations → API → UI requises. Ne pas activer sans0051. Anciennes routes de preuves/bilans et autres dossiers restent indépendantes de cette table.0046–0048 toujours non appliquées à la base partagée ; aucune lecture/décompte/migration partagée effectuée ici. Rollback applicatif ferme le nouveau parcours et conserve les preuves.

Audit privé `need_expertise.decided.v1`/`need_expertise.withdrawn.v1`, auteur personnel, sujet=version, texte vide et Lead nul ; aucune donnée de besoin/source/position/motif diffusée. Aucun job/room/permission/paquet/variable/fournisseur nouveau. RLS héritée ; S-130/S-131 doivent raccorder rétention/export/effacement de cet objet personnel attaché au Lead/sujet/auteur, avec audience courante. Aucune durée juridique ou service d’effacement inventé.

## Preuves et limites

[Plan et journal84e4](../../../../../../roadmap/plans/partner-need-expertise-decision.plan.md), [ledger](../../../../../../roadmap/evidence/partner-core.md#relais-84e4--appréciation-personnelle-de-lexpertise). V0–V2 isolés, deux revues du même agent sans indépendance ; V3 rempli/clavier/mobile non effectué faute de nouvel accès WorkOS depuisc902. Aucun callback/montage invalidé retenté, aucun runtime partagé utilisé ou accès réel fabriqué. Le brief intégral, S-110 et S-042a restent ouverts.
