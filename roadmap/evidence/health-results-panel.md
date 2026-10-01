# Volet des résultats et identité des offres — 1 octobre 2026

Mandat utilisateur exécuté en autonomie ; plan : `roadmap/plans/health-results-panel.plan.md`. Branche `codex/health-map-polish`. Session Codex GPT-6 ; l'interface ne fournit pas de réglage d'effort vérifiable dans ce contexte. Pas de délégation supplémentaire, de publication ni de push.

## Vérifié

- Questionnaire uniquement dans le volet de liste, toujours monté pour conserver réponses et notes en session. Même publication React avant peinture pour question, résultat, chargement et classement ; une réponse obsolète reste bloquée par le séquenceur existant. Prix accessible avant de démarrer le guide et en cas de désactivation/échec du moteur.
- Navigateur local, profil fictif 1990-06-15, Jura : prime minimale → premier contact → professionnels. Le choix multisélection ne navigue pas avant Continuer. Le libre choix fait remonter Atupri 527.50 CHF devant les modèles imposant un premier contact ; Sanitas TelMed 456 CHF reste le premier du classement tarifaire sans cette contrainte. Ouverture du détail puis Retour à la liste : question et réponses conservées.
- Badges issus de `leaders`, sans score recalculé dans WWW. « Le plus adapté » n'apparaît qu'après objectif renseigné ; astérisque et réserve tant que le résultat n'est pas établi. Le label « le moins cher » précise son périmètre au survol. Coûts annuels, conditions et explications restent accessibles sous chaque ligne personnalisée.
- Fiche sans encadré de prix ni texte « Prime mensuelle », CHF au-dessus de / mois. Bouton ghost Retour à la liste, poids calculé 700. Onglets Données/Prestations/Club : icônes outline et soulignements bleu/vert/rouge. Les sources/prestations réelles sont toujours chargées.
- Format bureau 1280×720 et mobile 390×844 : liste, ouverture de fiche, retour, onglets ; aucune largeur de page excédentaire. Les captures intermédiaires pendant la transition du dialogue peuvent être floutées ; la capture stabilisée est correcte.
- Frontaliers France : 13 offres ; première Helsana 225 CHF/mois. Tag LAMal frontaliers ; aucun crédit de redistribution et aucun questionnaire suisse dans la fiche.
- Logos : 32 identifiants OFSP sur 32, 32 images chargées dans une planche inspectée visuellement. SVG SLKK réextrait sans son conteneur masqué et couleurs EGK reprises du CSS officiel. SHA-256 et provenance par assureur dans `apps/www/src/assets/health-insurers/provenance.json`. SVG sans script ni ressource distante ; rendu local, aucune requête du visiteur vers les sites des assureurs. Planche de recette temporaire supprimée du site.
- 52 tests du module health-insurance réussis, dont 5 nouveaux : crédit 2027 indépendant de la prime, pas de report à 2028, exclusion des frontaliers, multiplicité des contacts documentés, exclusion des conditions non confirmées/périmées/non applicables aux enfants.
- Types WWW : 80 fichiers, zéro erreur/avertissement/indice. Types API et lint ciblé réussis. Build WWW : 45 pages ; avertissement préexistant de taille du chunk ShaderGradient.

## Source de redistribution

[Notice OFEV 2027, page 1, publiée par sodalis](https://www.sodalis.ch/writable/media/1789710416-Merkblatt_Rueckverteilung_CO2-_und_VOC-Abgaben_2027.pdf) : 57 CHF par personne et par an, personnes domiciliées en Suisse avec assurance de base suisse. [Page officielle sodalis 2027](https://www.sodalis.ch/de/allgemein/aktuelles/umweltabgabe-2027-190) : 4.75 CHF par mois. Vérification du 1 octobre 2026. Le lien OFEV historique de la page redirige vers une page générale ; le PDF complet 2027 est la preuve datée retenue. Les montants 2026 trouvés par recherche n'ont pas été réutilisés.

L'API annote les offres pour 2027 uniquement. La ligne représente exclusivement les taxes CO₂/COV, pas une réduction de réserves ni un subside. L'infobulle indique que le montant est déduit par la caisse et pas encore soustrait de la prime affichée. Le moteur conserve ses coûts bruts : aucune double déduction, aucun avantage artificiel entre caisses.

## Fait, limites précises

- Suivi de la souris à chaque pointermove, y compris au-dessus de la bulle grâce au hit-test de la région sous-jacente. Coordonnées projetées dans le repère de la carte, sans transition de position ; le garde-fou de bord conserve la bulle lisible. Le marqueur circulaire central est supprimé. Le déplacement continu à haute fréquence n'a pas pu être exercé avec l'API d'automatisation disponible, qui expose clic/glisser mais pas déplacement sans bouton ; le code et la disparition du marqueur ont été contrôlés.
- Vitesse ShaderGradient passée de 0.035 à 0.045. Le repli et les préférences de mouvement réduit existants restent actifs ; aucune nouvelle dépendance. Recette mobile en viewport, pas sur matériel tactile physique.
- Les contacts exacts des modèles sans preuve 2027 restent inconnus. Le tag de catégorie générale n'affirme pas des portes d'entrée supplémentaires. Aucune prestation ajoutée ou inventée.
- Mutuel Assurance et Philos utilisent l'identité Groupe Mutuel du site officiel ; sana24.ch redirige vers Visana. Les identifiants juridiques et noms de marque ne sont pas fusionnés. Cette association visuelle n'hérite aucune prestation d'une société sœur.

## Livraison et périmètre

Aucune migration, aucune donnée personnelle persistée, aucun événement/room/job, aucune permission ou variable d'environnement modifiée. API publique de lecture/calcul existante, Admin/Wallet inchangés. Aucun compte ni demande d'offre créé durant la recette. L'API de développement a redémarré normalement lors des écritures ; un premier appel a été retenté après cette interruption. Les autres travaux préexistants du dépôt ne sont ni réinitialisés ni inclus dans le commit ciblé.

Suite déjà identifiée, non exécutée : validation des conditions frontalières, selon `roadmap/plans/health-frontier-conditions.plan.md`. La couverture documentaire 2027 reste partielle comme indiqué dans le registre opérateur ; cette retouche visuelle ne vaut pas validation contractuelle.
