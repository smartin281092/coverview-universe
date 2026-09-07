# S-042a — bibliothèque documentaire et entrée des autorisations

Mandat : demande utilisateur du 7 septembre 2026 dans la tâche courante ; exécution autorisée selon `execution-policy.md`. Extension prioritaire de la slice active, sans clôture artificielle de sa recette.

## Information externe manquante

Réponse utilisateur du 7 septembre : trois PDF dans `D:/Projects/coverview-astra/references` (LSA45, mandat, procuration limitée). CoverView est la nouvelle marque de Bassa Martin Partners Sàrl, même entité, coordonnées, inscriptions FINMA et assurance RC. Remplacer le nom d'usage dans les textes en conservant une mention de la personne morale. Préremplir depuis le profil et placer les actions de signature dans une barre fixe. Le fournisseur et le niveau de signature ne sont pas encore définis : préparer la lecture réelle, mais ne produire ni signature simulée ni autorisation active sans preuve. La procuration limitée n'autorise aucune gestion et expire après six mois ; le mandat comporte une signature du mandataire également.

Extension explicitement demandée : l'extraction complète automatiquement les champs vides du profil, avec provenance documentaire, sans les marquer confirmés par l'utilisateur. Les valeurs déjà présentes sont conservées ; les divergences apparaissent en orange dans le profil et la vérification. Une demande de correction peut être préparée depuis la vérification et retrouvée dans Mes demandes. Sans destinataire et transport validés, elle reste à transmettre, jamais présentée comme envoyée. Pas de rétroécriture automatique des profils à partir d'anciens documents pendant la recette.

## Travail indépendant autorisé

- Titres documentaires issus du contenu, classement détaillé, nom original conservé séparément ; dates seules dans la ligne secondaire ; espacement de liste réduit.
- Recherche et tri sur toute la bibliothèque du propriétaire (plafond existant de 200 documents), pagination de 20, regroupement par mois de dépôt ou classification. Pas de filtrage limité à la page courante.
- Métadonnées additives dans l’analyse JSON ; anciennes analyses lisibles, titres repris de leurs en-têtes lisibles si présents, sinon libellé de classification. Aucune relecture payante automatique ni modification de l’original.
- Préparer l’entrée Mes autorisations et l’encart pastel refermable selon les éléments de signature réellement disponibles ; aucun état actif ou signé simulé.

## Oracles

Lint/typage/build ciblés ; recherche/tri/pagination et isolation du propriétaire vérifiés sur PostgreSQL réel sans modifier les pièces de l’utilisateur ; navigation et rendu réel Wallet sur ordinateur et smartphone. Un traitement documentaire ne prouve ni un droit de récupération ni une capacité de gestion d’assurance.

Règles : G-02/G-06/G-12/G-13/G-14, DATA-06/07, FRONT-14, LLM-04/08. Aucun secret, droits nouveaux, fichier utilisateur effacé ou transmission à un prestataire de signature non défini. Modules concernés : document-intelligence, contrats/client API, Wallet ; périmètre signatures à compléter après réponse.
