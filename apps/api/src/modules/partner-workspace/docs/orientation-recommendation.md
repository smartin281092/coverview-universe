# Orientation automatique et recommandation validée

C4b du [plan de reprise](../../../../../../roadmap/plans/partner-completion.plan.md), brief I.13 et III.10. L'orientation est calculée par le système à partir de la [comparaison des offres](offer-comparison.md). La recommandation est la position de l'intervenant. Les deux restent toujours distinctes, et seule la seconde engage quelqu'un.

## Orientation automatique `orientation-v1`

Elle est calculée à la lecture, n'est jamais enregistrée comme une décision et porte l'étiquette constante « Orientation automatique, non validée ». Elle se lit dans `leadDetail.offerOrientation` sur Partner et Wallet, chacun avec les offres qu'il voit.

Par offre, à partir des seules cellules vérifiées et sourcées :

| Statut | Condition |
|---|---|
| `incomplete` | prime non vérifiée (offre ou contrat actuel), ou une cellule « à vérifier » |
| `advantage` | pas plus chère, aucune perte vérifiée, et une économie ou un gain vérifié |
| `keep_current` | pas moins chère et aucun gain vérifié |
| `tradeoff` | tous les autres cas |
| `comparable` | sans contrat actuel relié : offre complète, sans conclusion |

Pour le dossier :

- **une offre paraît avantageuse** dès qu'il y en a une. La suggestion est celle qui économise le plus, puis celle qui améliore le plus ;
- **conserver le contrat actuel paraît préférable** quand toutes les offres sont complètes et en `keep_current` ;
- **arbitrage** quand toutes sont complètes sans suggestion ;
- **informations insuffisantes** dans les autres cas, et sans contrat actuel dès qu'une offre est incomplète ;
- **offres comparées entre elles** sans contrat actuel relié, quand toutes sont complètes : aucune conclusion sur un maintien.

Pour chaque offre, l'orientation liste les améliorations, les pertes, les points à savoir (exclusions ou valeurs différentes), les points à vérifier et les informations absentes. Une absence n'est jamais une perte.

**Transparence**, affichée sous « Données utilisées et limites » :

- date des données les plus récentes utilisées (revue d'offre, confirmation du contrat actuel). Les mêmes données donnent toujours la même orientation ;
- versions comparées et date de leur revue ;
- revue du contrat actuel ;
- facteur d'annualisation ;
- périmètre : les offres reçues dans ce dossier et leurs compagnies, pas l'ensemble du marché ;
- hypothèses (CHF uniquement, valeurs vérifiées et sourcées, montants comparés seulement à unité et période égales) ;
- disponibilité : une offre reçue existe sur le marché ; l'admission par la compagnie et les droits de distribution restent « non établis ».

## Recommandation validée

`GET|POST /partner/leads/:id/recommendations`. La permission est celle de la conclusion : droit de conseil, publication des offres de la demande, demande ouverte. Le client et un apporteur n'y ont pas accès.

- **Choix possibles :** une version publiée encore comparable (revue, source inchangée, non échue), le maintien du contrat actuel, ou aucune recommandation pour l'instant.
- **Base de lecture.** La recommandation porte sur ce que le client voit. Le serveur calcule l'orientation et une empreinte (`basis`) sur les versions publiées et la revue du contrat actuel. Une recommandation lue sur une base ancienne est refusée (`409`).
- **Écart motivé.** Le serveur indique pour chaque choix s'il s'écarte de la suggestion de l'orientation, ou s'il recommande une option alors que l'orientation est insuffisante. Dans ce cas, un motif d'écart d'au moins 20 caractères est exigé (`PARTNER_ACTION_REQUIRED`). Ce motif reste réservé aux professionnels ; Wallet ne le reçoit jamais.
- **Versions immuables** (`partner_offer_recommendations`, 0070, déclencheur sans mise à jour ni suppression). Chaque version garde son auteur, sa date, le motif, les points d'attention, l'orientation du moment et sa base.
- **Publication.** Elle est immédiate dans Wallet, avec l'auteur (« nom (organisation) ») et la date. L'événement `recommendation.published` crée une notification Wallet « Examiner les offres ». Elle ne vaut ni choix du client, ni signature, ni acceptation de la compagnie.
- **À revoir.** Une nouvelle version publiée, une offre retirée ou une nouvelle revue du contrat actuel rendent la recommandation « à revoir » partout. Wallet affiche alors que le conseiller la réexamine, au lieu d'un contenu périmé.

## Analyse incomplète

Après chaque commande qui modifie les entrées de la comparaison (ajout, revue, publication ou retrait d'offre ; liaison, retrait ou revue du contrat actuel), le serveur relit l'orientation sur les offres revues. Les offres encore en attente de revue sont un travail en cours, pas une analyse incomplète.

Tant qu'elle reste insuffisante, une notification « Analyse comparative à compléter » est ouverte. Elle va au responsable, ou à CoverView sans responsable, avec l'action « Examiner les offres ». Elle se résout dès que l'analyse peut conclure et se rouvre si elle redevient incomplète. Rien de conditionnel n'est présenté au client comme certain.

Depuis C8e, l'avis suit le responsable courant, se réévalue au passage du worker de continuité (offre échue, original modifié) et ouvre l'onglet des offres. Il tient lieu de tâche : aucune tâche « Compléter l'analyse » n'est créée. Le professionnel voit ce qui manque par origine et peut demander un complément au client ([règles](complements.md)).

## Limites

- Les spécificités prévoyance et la proposition automatique du contrat actuel relèvent de C4c.
- L'admission et les droits de distribution ne sont pas encore rapprochés des conventions examinées : ils restent « non établis » par défaut.
- Aucune comparaison avec des offres hors dossier ou avec un référentiel de marché.
