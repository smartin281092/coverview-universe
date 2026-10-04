# Recherche C — prestations supplémentaires des modèles, 4 octobre 2026

Artefacts : `review-c.json` (fusion des neuf lots, script `scripts/health-benefit-research-merge.py`), taxonomie canonique `benefit-taxonomy.json`, catalogue assemblé par `scripts/health-research-catalog.py`. Recherche documentaire sur les sites officiels des assureurs, sans compte, formulaire ni contact. Les instructions éventuellement présentes dans les pages ont été traitées comme des données. Passages en paraphrase française.

## Méthode

Pour chacun des 153 modèles des 32 assureurs du jeu Priminfo 2027 : page produit du modèle, pages services, club, application, télémédecine, pharmacie et prévention de l’assureur, conditions du modèle lorsqu’elles sont liées. Les constats du 1er octobre ont servi de point de départ et ont été revérifiés. Une prestation est une fiche par avantage et par ensemble de modèles concernés, avec source, passage, date de consultation, portée (modèle, toute la base, membres, complémentaire), gratuité, conditions et indication explicite ou non de 2027.

**Exclus d’office** : prestations LAMal communes à tous les assureurs (y compris l’exonération légale de franchise des vaccinations OPAS 12a), rabais de prime du modèle déjà inclus dans le tarif officiel, rabais de fratrie déjà publiés dans les sous-groupes tarifaires K3 à K5, services purement administratifs. Une prestation légale présentée comme un avantage reste visible avec la nature « socle légal commun » et n’est jamais valorisée.

## Uniformisation

Chaque fiche est rattachée à un seul des 40 types canoniques de six familles (télémédecine, pharmacie, participation aux coûts, prévention, orientation des soins, avantages membres). Le nom donné par l’assureur reste dans la fiche (`insurerTerm`) : par exemple Medgate, Medi24, santé24, sanmed24, sumis24 ou concordiaMed deviennent « Conseil médical gratuit 24h/24 » ; BetterDoc, Terminservice ou centre d’expertise deviennent « Recherche de spécialiste et rendez-vous ». Les 68 anciens groupes libres sont rattachés par une table explicite (`legacyGroups`).

Valorisation : 29 types `service` ou `financial` peuvent être choisis par le visiteur et servir de filtre ; les types `condition` décrivent le parcours (premier contact) ; les types `none` restent informatifs (escompte de paiement, parrainage, rabais sur complémentaires ou autres assurances, fonds de solidarité).

Propositions de nouveaux types : 11 fiches écartées avec motif (accès facturé sans avantage, mécanisme propre aux complémentaires, rabais de fratrie déjà tarifés) ; les autres ont été rattachées à un type existant ou à trois types créés après revue (`premium_payment_discount`, `health_legal_protection`, `insurance_bundle_discount`). Une proposition homonyme a été arbitrée assureur par assureur.

## Résultat

**Vérifié mécaniquement** : 32 assureurs, 153 modèles couverts, aucun modèle manquant ni rattaché à un autre assureur ; 1014 pages consultées ; 486 fiches recherchées, 477 retenues dans le catalogue après déduplication des fiches contractuelles déjà curées (liste Sanitas TelMed Plus 2027). 142 modèles « recherchés », 11 « partiels » (sana24 sans site propre, Visana HMO plus et Tel Care, documents introuvables ou communs).

Catalogue `catalog_fe98064955579fb8923847f0` : 514 fiches (477 du 4 octobre, 37 du 1er octobre conservées : parcours contractuels et liste TelMed Plus), 812 passages de source, 227 dossiers opérateur. 419 fiches vérifiées, 90 partielles, 5 contradictoires (chacune avec dossier). 60 fiches portent une indication explicite 2027. 275 fiches sont offertes avec la base seule (gratuites, sans complémentaire, source officielle, validité atteignant 2027) et couvrent 143 modèles ; 77 exigent une complémentaire.

Remplacements : 101 fiches du 1er octobre remplacées lorsque la recherche du 4 octobre documente le même type pour le même assureur, ou retirées après revue explicite (offre expirée, page en erreur, doublon). Liste et motifs dans `operator-report.md`.

## Points de vigilance

- **Année** : la plupart des pages ne datent pas leurs avantages. Un avantage non daté reste « annoncé, maintien 2027 à confirmer » ; il peut compter comme service souhaité mais rend le résultat provisoire s’il départage le meneur, et il ne produit jamais de montant.
- **Groupes** : les entités Groupe Mutuel (Avenir, Mutuel, Philos) partagent les mêmes pages et conditions ; les fiches sont dupliquées par entité avec leurs propres modèles. Visana, Galenos et sana24 partagent des conditions qui les nomment ; un avantage publié seulement par Visana n’est pas propagé sans document nommant l’entité.
- **Contradictions** : rabais Zur Rose ÖKK (FR/DE), opticien Club Assura, réduction de quote-part Medicasa sodalis, rabais Mivita Atupri ; dossiers ouverts, aucune valorisation.
- **Non vérifié** : disponibilité locale des réseaux et pharmacies, conditions complètes des annexes non publiées, maintien en 2027 des offres non datées.
