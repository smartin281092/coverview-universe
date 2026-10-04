# Offres Wallet

Chaque demande ouvre « Rendez-vous associés » en remplaçant sa fiche : modalités enregistrées, état courant ou à réexaminer, issue applicable et20dernières versions. Aucun autre Lead ni temps privé. [Audience canonique et limites](../../../../api/src/modules/partner-workspace/docs/appointment-links.md). Relecture10s, cache session et masquage sur erreur ;0055 hors catalogue, activation et V3 remplis ouverts.

Le bilan demande désormais la version2 et compare le mode souhaité aux [seuls modes explicitement partagés](../../../../api/src/modules/partner-workspace/docs/shared-modes.md) par le référent actuel. Retrait, absence ou portée modifiée gardent une inconnue ; historique et disponibilités privés exclus. La réponse v1 reste compatible.

Chaque demande propose « Adéquation du référent au besoin » : critères séparés, sources partageables et inconnues explicites dans un dialogue. L'accès suit le propriétaire courant ; cache session/Lead supprimé à fermeture, relecture10s/manuelle, erreur masquant le résultat. [Règles propriétaires](../../../../api/src/modules/partner-workspace/docs/referent-assessment.md). Aucun dossier de disponibilités privé partagé ; V3 rempli reste ouvert.

« Mes référents habituels » ouvre un dialogue indépendant des demandes : choix du profil et de la catégorie, état courant, formulaire de préférence avec confirmation explicite et historique paginé. Le responsable d’une demande reste affiché séparément. Révisions profil/choix et contenu de retry sont figés ; état privé masqué en cas d’erreur d’accès. [Règles canoniques](../../../../api/src/modules/partner-workspace/README.md#référents-habituels-et-continuité--relais-b920). V0–V2 passent. V3 b920 : Offres vide, dialogue/profil/catégories observés ; session expirée avant lecture du référent, callback WorkOS4133 non configuré. Enregistrement, historique rempli, clavier/mobile non vérifiés, aucun choix de recette enregistré.

## Résumé

`/offers` présente les demandes et propositions du profil Wallet sélectionné. Les [règles et permissions canoniques](../../../../api/src/modules/partner-workspace/README.md) appartiennent à Partner.

## Périmètre

Création d'une demande indépendante sur un profil existant, offres groupées par Lead/objet, comparaison des prestations normalisées, lecture des sources, choix, question, modification et demande de conserver le contrat actuel.

## Règles métier et invariants

Les informations absentes restent « non renseigné ». La confirmation enregistre un choix et n'annonce aucune signature ni acceptation de compagnie. Les mutations portent la révision du Lead et la version précise d'offre. Relecture périodique HTTP ; aucune room ni diffusion temps réel présentée comme active.

## Permissions

`IdentityBoundary`, profil actuellement possédé et seules offres publiées. L'email seul n'ouvre aucun dossier. Consentement explicite lors de la nouvelle demande. Les détails privés du conseiller ne sont jamais renvoyés par l'API Wallet.

## État réel

« Préférences de conseil » dans chaque demande permet de confirmer langue, mode et canton souhaités, puis de consulter l'historique. Révisions propres, confirmation explicite et lecture des choix anciens distincte. [Règles canoniques](../../../../api/src/modules/partner-workspace/docs/advice-preferences.md). V0–V2 vérifiés en6469 ; V3 rempli/clavier/mobile non effectué faute de configuration WorkOS, aucun runtime ni donnée de recette réelle créé.

« Langues et zones du référent » ouvre le résumé déclaratif disponible dans la continuité du Lead. Aucun accès au dossier privé du professionnel ; langue/zone du besoin restent à examiner. [Règles communes](../../../../api/src/modules/partner-workspace/docs/professional-practice.md). V0–V2 vérifiés en ce17 ; dialogue peuplé/clavier/mobile non vérifié.

La continuité conserve la compétence parmi les éléments à examiner après un changement de périmètre professionnel, y compris un aller-retour. Le résumé reste distinct des pièces et parties historiques privées. [Règles communes](../../../../api/src/modules/partner-workspace/docs/professional-scope.md), V0–V2 vérifiés en5944 ; recette Wallet peuplée toujours ouverte.

La continuité du référent affiche le statut documentaire de compétence, sa portée et sa validité, sans pièce professionnelle, déclaration ou motif privé. Les autres critères restent à examiner, aucun droit/score/attribution automatique. [Règles canoniques](../../../../api/src/modules/partner-workspace/README.md#justificatifs-professionnels-et-examen--relais-8a00). Types/build et PostgreSQL vérifiés, projection remplie non vérifiée dans Wallet.

Build/types et écran vide/formulaire mobiles vérifiés. Publication, décisions et rattachement explicite du contrat actuel vérifiés dans PostgreSQL isolé ; recette remplie non effectuée faute de données réelles et de session Partner habilitée. Signature/acceptation et recette de la police finale restent à compléter dans [le plan](../../../../../roadmap/plans/partner-core.plan.md).

La page /offers/notifications, accessible depuis Offres, présente les notifications de service du profil détenu, leur lecture personnelle et les liens vers les demandes. La lecture ne résout pas une action ; une décision client ou le traitement métier la résout. Cache privé par utilisateur/session/filtre, interrogation 15 s. L'état vide et le filtre ont été observés avec la session réelle à 390 px ; aucune notification ou offre fictive n'a été créée dans la base locale.

La fiche d'une demande affiche désormais le responsable et les co-conseillers actifs, avec une demande motivée de changement d'interlocuteur. Celle-ci conserve le dossier et ouvre une alerte CoverView sans effectuer de réattribution automatique. Les changements effectivement acceptés sont notifiés dans Wallet. Les termes économiques et les notes privées restent absents de cette projection. Ce parcours est vérifié en PostgreSQL ; sa recette remplie avec des acteurs habilités reste ouverte.

Depuis Offres, « Reprendre une demande du comparateur » ouvre la liste canonique des demandes d’assurance. Le détail propose une confirmation par personne puis le même Lead, avec retour vers la demande initiale. Dialogue séparé, case non précochée, clé conservée sur réessai et cache privé par session ; droits et consentement sont contrôlés côté serveur selon les [règles Partner](../../../../api/src/modules/partner-workspace/README.md#demandes-dassurance-existantes--relais-f41b). Aucun profil dupliqué. Le lien de navigation et l’état vide ont été observés sur la session réelle à 390 px ; formulaire rempli et retour depuis un Lead existant restent non vérifiés V3 faute de demande réelle, sans données fabriquées.

Le détail propose le contrat actuel exact par sélection du propriétaire, confirmation d’objet et de partage séparées, puis retrait possible. Les états source modifiée/indisponible, informations manquantes ou incertaines restent explicites. Comparaison synthétique des gains **et** pertes, détail des valeurs/conditions/exclusions/citations en dialogue, annualisation traçable calculée par l’API. Aucun rapprochement automatique par catégorie. Les [règles de référence et de comparaison](../../../../api/src/modules/partner-workspace/README.md#contrat-actuel-exact-et-comparaison--relais-175f) sont canoniques. Formulaire react-hook-form/Zod, aucune option précochée, révision capturée à l’ouverture et clé stable sur réessai ; original consultable avant partage. V3 du dialogue peuplé et de ses erreurs/clavier/mobile reste ouvert ; seul l’état vide réel a été observé à 390×844 sans débordement horizontal.

L’historique explicite présente les versions déjà publiées, y compris retirées/remplacées, par pages de 20 puis détail en dialogue partagé. Les anciennes versions restent en lecture seule ; original accessible selon les droits courants et l’état documentaire. Les cartes signalent le changement depuis une consultation/choix et une source devenue non fiable ; l’API détermine comparaison et décisions permises. Récapitulatif sur la version exacte, confirmation désactivée si elle devient inéligible. [Règles de version et de publication](../../../../api/src/modules/partner-workspace/README.md#versions-doffres-et-publication--relais-d02c). Types/build et PostgreSQL vérifiés ; aucun historique rempli ou téléchargement réel revendiqué V3.

Le refus explicite ouvre le récapitulatif de la version avec motif obligatoire ; toutes les réponses conservent le Lead, le profil et la révision affichés. Un conflit impose une relecture, une réponse réseau incertaine propose un rejeu identique avec contenu figé. Succès distinct pour chaque décision. Le centre de notifications affiche compagnie/produit/version et reste accessible au propriétaire courant après transfert. Les [règles de décision et de résolution](../../../../api/src/modules/partner-workspace/README.md#décisions-wallet-et-suivi-par-version--relais-b9b3) sont canoniques. Le doublon de clé i18n history qui masquait ses libellés structurés a été retiré. V0–V2 passent ; V3 b9b3 observe uniquement Offres et notifications vides, aucun refus réel réalisé.

« Polices finales » ouvre l’historique paginé des polices reçues, avec sélection explicite d’une version publiée et d’un original du profil exact dans Documents. Trois confirmations non précochées, révision et clé figées, reprise identique après réponse réseau incertaine. Détail : faits de la police, constats/citations, écart documentaire de prime, originaux et retour au document canonique. Retirer le partage ferme l’accès du Lead sans effacer le document ni résilier le contrat. La référence actuelle reste distincte. [Règles canoniques](../../../../api/src/modules/partner-workspace/README.md#police-finale-reçue-et-contrôle--relais-1a5a). Signature/acceptation compagnie demeurent manquantes ; aucun statut contractuel déduit. V0–V2 vérifiés, V3 1a5a limité à l’état vide réel sur 4131.

Les conventions professionnelles privées sont exclues des documents et offres Wallet. Aucun original ni résultat détaillé de leur examen n’est projeté au client ; le critère de continuité conventions reste manquant sans compagnie/solution exactes. [Périmètre canonique](../../../../api/src/modules/partner-workspace/docs/conventions.md). Régressions documentaires vérifiées en PostgreSQL ; aucune nouvelle recette Wallet remplie dans cc1c.
