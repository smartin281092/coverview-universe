# Décisions à résoudre par slice

> Vue générée depuis les spécifications et `roadmap/state.json`. Modifier les sources canoniques puis régénérer. La planification ne prouve aucune implémentation.

Les options recommandées sont des propositions. Une réponse explicite doit être enregistrée puis promue selon PROG-17. Chaque question bloque son périmètre indiqué, pas toute la roadmap.

[Registre de la bible](../docs/product/open-questions.md) · [Plans](index.md) · [État](state.json)

## bible.question.001

### S-032 — question 1

[S-032](plans/S-032.plan.md) · Activer Group Wrapped seulement après validation d’usage individuel et consentement révocable par métrique ?

- (a) Oui, gate humain préalable maintenu — défaut proposé
- (b) Fournir dès maintenant validation d’usage et règles de confidentialité

Bloque : Activation Group Wrapped

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-071 — question 3

[S-071](plans/S-071.plan.md) · Activer API/white-label B2B après validation documentée sur cas réels, tout en développant le parcours fixture maintenant ?

- (a) Oui, implémenter intégralement puis activer seulement les accords/périmètres validés. — défaut proposé
- (b) Attendre les cas réels pour développer aussi l'interface B2B ; conserver néanmoins toutes les slices au backlog.

Bloque : Moment d'activation de la distribution avancée.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.002

### S-051 — question 1

[S-051](plans/S-051.plan.md) · Confirmer que « facturation séparée des simulations » n'autorise aucune facturation par simulation après achat ?

- (a) Conserver l'interdiction de facturer à la simulation ; facturer uniquement les services définis. — défaut proposé
- (b) Réviser explicitement la bible avant toute politique contradictoire.

Bloque : Modèle de facturation et droits Plan.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.004

### S-011 — question 1

[S-011](plans/S-011.plan.md) · Publier initialement tous ces contenus en français avec clés et architecture i18n extensibles ?

- (a) Oui, français initial comme PROJECT — défaut proposé
- (b) Ajouter dès maintenant des locales explicitement fournies

Bloque : Liste des traductions publiables, sans bloquer la structure FR

Autorisation : Mandat utilisateur du 2026-09-05 : enchaînement et choix des meilleurs défauts autorisés — roadmap/execution-policy.md. Réponse : enregistrée ci-dessous.

- `bible.question.004` · Publier initialement tous ces contenus en français avec clés et architecture i18n extensibles ? → **(a) Oui, français initial comme PROJECT. Réutiliser les contenus FR et conserver une architecture extensible ; aucune locale supplémentaire fournie.** · preuve : PROJECT.md, Langues et données ; décision déléguée de préparation du 2026-09-06 selon roadmap/execution-policy.md / PROG-23.

### S-099 — question 2

[S-099](plans/S-099.plan.md) · Quelles langues valider pour ce premier parcours vocal réel ?

- (a) FR avec vocabulaire suisse et noms propres du corpus, autres langues désactivées explicitement — défaut proposé
- (b) FR/DE/IT/EN après jeux de tests et validation de chacune

Bloque : Langues effectivement annoncées comme supportées.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.005

### S-042a — question 4

[S-042a](plans/S-042a.plan.md) · Le scan constitue-t-il une vérification réglementaire ?

- (a) Non, extraction et préremplissage seulement — défaut proposé
- (b) Capacité KYC distincte qualifiée

Bloque : Libellés produit

Autorisation : Demande explicite utilisateur du 6 septembre 2026 : mobile Wallet puis conservation de tous les documents déposés, y compris identité, classification et extraction profil ; choix locaux délégués PROG-23, aucune validation juridique déduite.. Réponse : enregistrée ci-dessous.

- `bible.question.005` · Le scan constitue-t-il une vérification réglementaire ? → **Non, extraction et préremplissage seulement** · preuve : Demande explicite utilisateur du 6 septembre 2026 : mobile Wallet puis conservation de tous les documents déposés, y compris identité, classification et extraction profil ; choix locaux délégués PROG-23, aucune validation juridique déduite.

### S-017 — question 1

[S-017](plans/S-017.plan.md) · Utiliser d’abord des templates marqués démonstration puis exiger validation de chaque périmètre/texte avant document réel ?

- (a) Oui, aucune procuration réelle non validée — défaut proposé
- (b) Fournir maintenant templates et périmètres déjà validés

Bloque : Génération juridiquement utilisable et signature réelle

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-018 — question 1

[S-018](plans/S-018.plan.md) · Définir la matrice type de document→niveau de signature avant toute activation réelle, sans qualifier juridiquement la preuve de test ?

- (a) Oui, gate de S-035 — défaut proposé
- (b) Fournir maintenant la matrice et son validateur

Bloque : Activation de signatures réelles seulement

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-021 — question 1

[S-021](plans/S-021.plan.md) · Le dossier LPP exige-t-il une autorisation spécifique validée distincte de la procuration générale de renseignements ?

- (a) Oui, template LPP et niveau de signature à valider — défaut proposé
- (b) Procuration générale suffisante après confirmation explicite du périmètre

Bloque : Signature et transmission juridiquement utilisables

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-035 — question 1

[S-035](plans/S-035.plan.md) · La matrice de signature par famille et son fournisseur ont-ils été explicitement validés avant connexion ?

- (a) Oui, décision et identifiant fournisseur à joindre au GO — défaut proposé
- (b) Non, conserver cette intégration bloquée sans substitution

Bloque : Toute signature réelle

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-042 — question 2

[S-042](plans/S-042.plan.md) · Confirmer que l’extraction OCR ne constitue pas un contrôle d’identité réglementaire, tout KYC exigeant une capacité distincte validée ?

- (a) Oui, extraction/préremplissage uniquement — défaut proposé
- (b) Fournir un service KYC et périmètre déjà validés

Bloque : Qualification et promesse de vérification d’identité

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-036 — question 2

[S-036](plans/S-036.plan.md) · Chaque autorisation signée couvre-t-elle précisément destinataire et recherche demandée ?

- (a) Oui, preuve de validation à joindre — défaut proposé
- (b) Non, corriger mandat avant transmission

Bloque : Envoi de données/document réel

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.006

### S-013a — question 1

[S-013a](plans/S-013a.plan.md) · Séparer dès le modèle la durée de conservation des images d’identité de celle des champs extraits, avec durées à valider avant pièces réelles ?

- (a) Oui, aucune durée légale déduite — défaut proposé
- (b) Fournir maintenant la matrice de conservation approuvée

Bloque : Conservation et ingestion de vraies pièces uniquement

Autorisation : Mandat PROG-23 réaffirmé dans la création de cette tâche ; roadmap/execution-policy.md.. Réponse : enregistrée ci-dessous.

- `bible.question.006` · Séparer dès le modèle la durée de conservation des images d’identité de celle des champs extraits, avec durées à valider avant pièces réelles ? → **Oui, aucune durée légale déduite** · preuve : Décision déléguée PROG-23, 2026-09-06 : roadmap/execution-policy.md ; confidentialité ADR-0002, ingestion de pièces désactivée sans matrice approuvée.

### S-042a — question 2

[S-042a](plans/S-042a.plan.md) · Quelle conservation opérationnelle des documents ?

- (a) Conserver volontairement les originaux jusqu’à suppression propriétaire, séparer dérivés et champs, sans délai juridique déduit — défaut proposé
- (b) Politique catégorielle déjà fournie

Bloque : Cycle de vie local

Autorisation : Demande explicite utilisateur du 6 septembre 2026 : mobile Wallet puis conservation de tous les documents déposés, y compris identité, classification et extraction profil ; choix locaux délégués PROG-23, aucune validation juridique déduite.. Réponse : enregistrée ci-dessous.

- `bible.question.006` · Quelle conservation opérationnelle des documents ? → **Conserver volontairement les originaux jusqu’à suppression propriétaire, séparer dérivés et champs, sans délai juridique déduit** · preuve : Demande explicite utilisateur du 6 septembre 2026 : mobile Wallet puis conservation de tous les documents déposés, y compris identité, classification et extraction profil ; choix locaux délégués PROG-23, aucune validation juridique déduite.

### S-023 — question 2

[S-023](plans/S-023.plan.md) · Valider conservation par type de pièce avant ingestion de documents personnels réels ?

- (a) Oui, matrice dédiée image/texte/extraction — défaut proposé
- (b) Conserver le corpus fictif seulement jusqu’à décision

Bloque : Ingestion réelle sensible S-037/042

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-130 — question 1

[S-130](plans/S-130.plan.md) · Quel périmètre et quelle remise adopter pour les exports et rectifications ?

- (a) Valider une matrice par catégorie de données et un téléchargement authentifié temporaire — défaut proposé
- (b) Fournir une autre procédure documentée de remise et correction

Bloque : Catégories exportables, destinataires et durée de lien ; aucun délai légal inventé.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-131 — question 1

[S-131](plans/S-131.plan.md) · Quelle politique de conservation et quelles exceptions appliquer ?

- (a) Faire valider la matrice complète et les legal holds avant activation des purges — défaut proposé
- (b) Fournir une politique déjà validée à transcrire et vérifier

Bloque : Suppression réelle, délais et conservation après restauration.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-091 — question 2

[S-091](plans/S-091.plan.md) · Quelle conservation et quel partage appliquer aux conversations de couverture ?

- (a) Rétention par type validée et choix explicite résumé/conversation complète lors du support — défaut proposé
- (b) Autre politique documentée avec mêmes droits export/suppression

Bloque : Conservation et partage réels des conversations/pièces.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-093 — question 3

[S-093](plans/S-093.plan.md) · Quel partage proposer au support ?

- (a) Choix explicite entre résumé contrôlé et conversation complète, prévisualisable avant transmission — défaut proposé
- (b) Résumé seul initialement avec transmission complète sur consentement séparé

Bloque : Transmission réelle des conversations et politique de conservation.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-035 — question 2

[S-035](plans/S-035.plan.md) · La politique de conservation de document/preuve et sous-traitant est-elle approuvée ?

- (a) Oui, joindre matrice approuvée — défaut proposé
- (b) Non, conserver uniquement essais non personnels

Bloque : Production de pièces personnelles

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-039 — question 2

[S-039](plans/S-039.plan.md) · Conserver les questions brutes selon une durée explicitement approuvée, avec option de collecte désactivée ?

- (a) Oui, durée/finalité à fournir — défaut proposé
- (b) Ne pas conserver le texte brut, seulement statistiques non personnelles

Bloque : Rétention des questions libres

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-042 — question 1

[S-042](plans/S-042.plan.md) · Les règles exactes image/champs/confirmation et droits d’accès sensibles sont-elles validées avant scan personnel ?

- (a) Oui, matrice de S-131 jointe au GO — défaut proposé
- (b) Non, corpus synthétique seulement

Bloque : Pièces personnelles réelles

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-013 — question 1

[S-013](plans/S-013.plan.md) · Séparer dès le modèle la durée de conservation des images d’identité de celle des champs extraits, avec durées à valider avant pièces réelles ?

- (a) Oui, aucune durée légale déduite — défaut proposé
- (b) Fournir maintenant la matrice de conservation approuvée

Bloque : Conservation et ingestion de vraies pièces uniquement

Autorisation : PROG-23 : roadmap/execution-policy.md ; découpage explicite après inspection des producteurs absents.. Réponse : enregistrée ci-dessous.

- `bible.question.006` · Séparer dès le modèle la durée de conservation des images d’identité de celle des champs extraits, avec durées à valider avant pièces réelles ? → **Oui, aucune durée légale déduite** · preuve : Décision déléguée PROG-23, 2026-09-06 : roadmap/execution-policy.md ; confidentialité ADR-0002, ingestion de pièces désactivée sans matrice approuvée.

### S-089 — question 2

[S-089](plans/S-089.plan.md) · Quelle rétention appliquer aux emails et pièces synchronisés ?

- (a) Durées par finalité/type validées et suppression/export exerçables — défaut proposé
- (b) Archive limitée aux messages explicitement rattachés avec durées validées

Bloque : Stockage réel des messages et pièces.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.007

### S-042a — question 3

[S-042a](plans/S-042a.plan.md) · Une extraction peut-elle remplacer automatiquement un champ confirmé ?

- (a) Non, confirmation propriétaire des propositions — défaut proposé
- (b) Uniquement avec matrice évaluée et validée

Bloque : Matérialisation profil

Autorisation : Demande explicite utilisateur du 6 septembre 2026 : mobile Wallet puis conservation de tous les documents déposés, y compris identité, classification et extraction profil ; choix locaux délégués PROG-23, aucune validation juridique déduite.. Réponse : enregistrée ci-dessous.

- `bible.question.007` · Une extraction peut-elle remplacer automatiquement un champ confirmé ? → **Non, confirmation propriétaire des propositions** · preuve : Demande explicite utilisateur du 6 septembre 2026 : mobile Wallet puis conservation de tous les documents déposés, y compris identité, classification et extraction profil ; choix locaux délégués PROG-23, aucune validation juridique déduite.

### S-016 — question 1

[S-016](plans/S-016.plan.md) · Les valeurs du tableau §20.2 deviennent-elles les paramètres initiaux du calcul rapide, explicitement simplifiés et distincts des méthodes non calibrées ?

- (a) Oui, valeurs source telles qu’indiquées — défaut proposé
- (b) Fournir une version métier initiale différente et sourcée

Bloque : Activation des defaults de calcul rapide

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-023 — question 1

[S-023](plans/S-023.plan.md) · Un conflit ou faible confiance doit-il toujours produire une revue sans écraser la donnée vérifiée, seuils par type à valider ?

- (a) Oui, matrice de seuils approuvée avant automatisation réelle — défaut proposé
- (b) Toutes les extractions requièrent d’abord confirmation humaine

Bloque : Matérialisation automatique et seuils

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-025 — question 1

[S-025](plans/S-025.plan.md) · Présenter la qualité initiale comme complétude des données et non précision statistique tant que la calibration est absente ?

- (a) Oui, libellé complétude explicite — défaut proposé
- (b) Fournir une mesure validée et son protocole

Bloque : Affichage chiffré de précision statistique

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-026 — question 1

[S-026](plans/S-026.plan.md) · Bloquer l’activation publique des notes tant que poids, méthodes Investment Age/DNA/Freshness et cohortes minimales n’ont pas été validés ?

- (a) Oui, fixtures nommées jusque S-038 — défaut proposé
- (b) Fournir maintenant les méthodes et corpus validés

Bloque : Scoring/benchmark exploitable sur données réelles

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-024 — question 1

[S-024](plans/S-024.plan.md) · Valider un seuil de complétude par indicateur plutôt qu’un score unique autorisant tous les calculs ?

- (a) Oui, conditions minimales versionnées par indicateur — défaut proposé
- (b) Exiger validation humaine de chaque audit avant diffusion

Bloque : Déclenchement et diffusion automatiques de résultats réels

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-028 — question 1

[S-028](plans/S-028.plan.md) · Valider équation de capital nécessaire, rendement de décaissement/marge/plafond de cotisation avant résultat réel, en gardant les valeurs source du parcours rapide explicites ?

- (a) Oui, méthode et référence de plafond documentées avant S-038 — défaut proposé
- (b) Fournir maintenant la méthode et les plafonds applicables

Bloque : Résultats cibles réels et contrainte de cotisation

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-029 — question 1

[S-029](plans/S-029.plan.md) · Quelle famille initiale doit être validée pour l’accumulation réelle ?

- (a) Monte-Carlo documenté avec calibration/corrélations approuvées — défaut proposé
- (b) Moving block bootstrap avec données et fenêtres approuvées
- (c) Périodes historiques glissantes avec méthode approuvée

Bloque : Méthode financière réelle, pas moteur de jobs/fixtures

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-030 — question 1

[S-030](plans/S-030.plan.md) · Valider règles de compatibilité, contraintes et recherche de cotisation minimale avant recommendation réelle ?

- (a) Oui, règles/corpus approuvés puis S-038 — défaut proposé
- (b) Limiter en réel à comparaison descriptive jusqu’à validation

Bloque : Optimisation et décompte compatible réels

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-027 — question 1

[S-027](plans/S-027.plan.md) · Valider pondérations du score World et convention des frontières de paliers avant interprétation réelle ?

- (a) Oui, paramètres séparés des exemples — défaut proposé
- (b) Utiliser une visualisation neutre tant que la méthode reste non validée

Bloque : Qualification des paliers sur données réelles

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-034 — question 1

[S-034](plans/S-034.plan.md) · Valider règles classes/niveaux/équipements comme représentation ludique explicable, sans remplacer métriques financières ?

- (a) Oui, règles de représentation documentées — défaut proposé
- (b) Conserver uniquement métaphores sans niveau numérique

Bloque : Niveaux et classes calculés

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-050 — question 2

[S-050](plans/S-050.plan.md) · Comment traiter le score de préparation tant que sa méthode n'est pas validée ?

- (a) Afficher un exemple fictif étiqueté et bloquer tout score personnel réel. — défaut proposé
- (b) Fournir et approuver la formule calibrée avant le score personnel.

Bloque : Calcul personnel du score de préparation.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-096 — question 2

[S-096](plans/S-096.plan.md) · Comment traiter une extraction conflictuelle ou peu fiable ?

- (a) Revue humaine obligatoire avant changement d’une valeur confirmée ; seuils documentés par type — défaut proposé
- (b) Autres seuils et règles de priorité fournis avec corpus validé

Bloque : Mises à jour automatiques issues d’extraction réelle.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-037 — question 2

[S-037](plans/S-037.plan.md) · Quels résultats autorisent l’auto-matérialisation après évaluation ?

- (a) Matrice seuils par champ/type approuvée — défaut proposé
- (b) Aucun, revue humaine systématique initiale

Bloque : Écriture automatique d’extractions

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-040 — question 1

[S-040](plans/S-040.plan.md) · Les sources marché/cohortes et règles de normalisation historiques sont-elles approuvées avant calcul réel ?

- (a) Oui, fournisseurs/licences/méthodes exacts à joindre — défaut proposé
- (b) Non, conserver uniquement catalogue sourcé sans métriques de marché activées

Bloque : Données de rendement/benchmark réelles

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-043 — question 1

[S-043](plans/S-043.plan.md) · Les méthodes d'accumulation, capital cible, corrélations et corpus ont-elles des paramètres exacts approuvés ?

- (a) Conserver le périmètre réel bloqué tant que décisions et corpus ne sont pas joints. — défaut proposé
- (b) Joindre la méthode, les paramètres et le corpus validés au GO.

Bloque : Équations et paramètres du moteur d'accumulation réel.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-044 — question 1

[S-044](plans/S-044.plan.md) · Les définitions Score/DNA/Investment Age/Freshness, pondérations, cohortes et seuils d'abstention sont-ils approuvés ?

- (a) Maintenir chaque métrique réelle non activée tant que sa définition et son corpus indépendant manquent. — défaut proposé
- (b) Joindre les décisions exactes et les corpus approuvés au GO.

Bloque : Chaque famille de score/benchmark réelle concernée.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-044 — question 2

[S-044](plans/S-044.plan.md) · Les gains de complétude et seuils de revue humaine sont-ils validés séparément de toute précision statistique ?

- (a) Bloquer la qualification de précision et l'escalade automatique jusqu'aux règles approuvées. — défaut proposé
- (b) Fournir gains/seuils et preuves de calibration validés.

Bloque : Complétude, abstention et escalade humaine.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-045 — question 1

[S-045](plans/S-045.plan.md) · Les règles de compatibilité, pondérations World et corpus attendus sont-ils explicitement validés ?

- (a) Conserver compatibilité/World personnels non activés tant que règles et corpus manquent. — défaut proposé
- (b) Joindre les définitions, limites et corpus approuvés au GO.

Bloque : Compatibilité réelle, effort complémentaire et score de trajectoire World.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-038 — question 1

[S-038](plans/S-038.plan.md) · Les méthodes score/cohortes/Investment Age/World/capital cible/compatibilité et corpus sont-elles validées avec paramètres exacts ?

- (a) Oui, joindre décisions et corpus au GO — défaut proposé
- (b) Non, conserver famille concernée non activée sans substitut

Bloque : Chaque famille de calcul réel concernée

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-136 — question 1

[S-136](plans/S-136.plan.md) · Qui valide les méthodes et quelles tolérances constituent une acceptation ?

- (a) Nommer un validateur compétent et approuver les cas/tolérances avant publication — défaut proposé
- (b) Fournir une validation indépendante existante et vérifier sa correspondance exacte

Bloque : Statut validé et crédibilité publique des métriques ; pas la démonstration sur fixtures.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.008

### S-013a — question 2

[S-013a](plans/S-013a.plan.md) · Le profil individuel reste privé tant qu’aucun consentement explicite par ressource n’accorde un accès au foyer ?

- (a) Oui, aucun partage familial implicite — défaut proposé
- (b) Fournir une matrice de droits alternative explicite

Bloque : Accès multi-membres et délégations non définis

Autorisation : Mandat PROG-23 réaffirmé dans la création de cette tâche ; roadmap/execution-policy.md.. Réponse : enregistrée ci-dessous.

- `bible.question.008` · Le profil individuel reste privé tant qu’aucun consentement explicite par ressource n’accorde un accès au foyer ? → **Oui, aucun partage familial implicite** · preuve : Décision déléguée PROG-23, 2026-09-06 : roadmap/execution-policy.md ; confidentialité ADR-0002, ingestion de pièces désactivée sans matrice approuvée.

### S-081 — question 1

[S-081](plans/S-081.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-080 — question 1

[S-080](plans/S-080.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-014 — question 1

[S-014](plans/S-014.plan.md) · Réserver création/correction à Admin et permettre à Intelligence uniquement des propositions jusqu’à matrice approuvée ?

- (a) Oui, publication Admin séparée — défaut proposé
- (b) Fournir maintenant les droits professionnels détaillés

Bloque : Rôles de création/publication au-delà du gestionnaire Admin autorisé

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-015 — question 1

[S-015](plans/S-015.plan.md) · Une publication exige-t-elle une validation par une personne distincte du créateur ?

- (a) Oui pour données financières publiables — défaut proposé
- (b) Non, même personne autorisée avec preuve et trace

Bloque : Séparation exacte des responsabilités de publication

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-082 — question 1

[S-082](plans/S-082.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-032 — question 2

[S-032](plans/S-032.plan.md) · Chaque participant choisit-il séparément les métriques visibles, sans héritage des droits du foyer ?

- (a) Oui, consentement individuel explicite — défaut proposé
- (b) Fournir autre modèle explicite respectant confidentialité

Bloque : Droits multi-participants

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-050 — question 1

[S-050](plans/S-050.plan.md) · Pour le premier foyer, retenir le partage nominatif explicite de chaque membre avant d'agréger ses données ?

- (a) Partage explicite par membre, avec périmètres à valider avant activation. — défaut proposé
- (b) Définir et approuver une autre matrice d'accès avant d'implémenter l'agrégation.

Bloque : Schéma de consentement, agrégation et consultation du foyer.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-054 — question 3

[S-054](plans/S-054.plan.md) · Les événements et budgets communs doivent-ils être éditables uniquement selon des droits explicites de chaque membre ?

- (a) Oui, matrice nominative à valider et refus par défaut. — défaut proposé
- (b) Définir un autre modèle documenté de consentement avant l'édition partagée.

Bloque : Édition du foyer et lecture des données du conjoint.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-067 — question 1

[S-067](plans/S-067.plan.md) · Quels droits appliquer à la publication de méthodes et paramètres ?

- (a) Rôles explicites de proposition/validation/publication à approuver, refus par défaut ; aucune permission tirée de l'appartenance au foyer. — défaut proposé
- (b) Fournir une autre matrice nominative avant gouvernance.

Bloque : Publication et lecture transversale des paramètres/usages.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-086 — question 2

[S-086](plans/S-086.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-087 — question 2

[S-087](plans/S-087.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-088 — question 1

[S-088](plans/S-088.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-094 — question 1

[S-094](plans/S-094.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-095 — question 2

[S-095](plans/S-095.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-108 — question 3

[S-108](plans/S-108.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-110 — question 1

[S-110](plans/S-110.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-111 — question 2

[S-111](plans/S-111.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-040 — question 2

[S-040](plans/S-040.plan.md) · Les droits de rediffusion et accès professionnels ont-ils été définis par source ?

- (a) Oui, matrice champs/surfaces approuvée — défaut proposé
- (b) Aucune rediffusion publique tant que les droits manquent

Bloque : Publication de données sous licence

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-112 — question 1

[S-112](plans/S-112.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-112 — question 2

[S-112](plans/S-112.plan.md) · Quels droits de contribution Intelligence approuver ?

- (a) Lecture/analyse des données autorisées et proposition sourcée, publication via Admin distincte — défaut proposé
- (b) Publication déléguée à certains professionnels avec matrice, validation et audit explicites

Bloque : Édition/publication réelles des données professionnelles.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-013 — question 2

[S-013](plans/S-013.plan.md) · Le profil individuel reste privé tant qu’aucun consentement explicite par ressource n’accorde un accès au foyer ?

- (a) Oui, aucun partage familial implicite — défaut proposé
- (b) Fournir une matrice de droits alternative explicite

Bloque : Accès multi-membres et délégations non définis

Autorisation : PROG-23 : roadmap/execution-policy.md ; découpage explicite après inspection des producteurs absents.. Réponse : enregistrée ci-dessous.

- `bible.question.008` · Le profil individuel reste privé tant qu’aucun consentement explicite par ressource n’accorde un accès au foyer ? → **Oui, aucun partage familial implicite** · preuve : Décision déléguée PROG-23, 2026-09-06 : roadmap/execution-policy.md ; confidentialité ADR-0002, ingestion de pièces désactivée sans matrice approuvée.

### S-113 — question 1

[S-113](plans/S-113.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-071 — question 2

[S-071](plans/S-071.plan.md) · Limiter par défaut partenaires/employeurs/API au suivi commercial sans patrimoine de foyer ?

- (a) Oui, chaque scope de données supplémentaire exige consentement et matrice approuvés. — défaut proposé
- (b) Fournir un modèle de partage explicite plus restreint par canal.

Bloque : Permissions API, accès employeurs et partage de patrimoine.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-121 — question 3

[S-121](plans/S-121.plan.md) · Quel périmètre initial autoriser pour les équipes internes ?

- (a) Accès aux objets explicitement affectés à la personne ou à son équipe, avec droits financiers distincts — défaut proposé
- (b) Accès transversal des conseillers selon une matrice métier fournie avant implémentation

Bloque : Autorisations réelles des lectures, mutations et projections Admin ; les personas isolées locales restent explicitement fictives.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-122 — question 1

[S-122](plans/S-122.plan.md) · Quelle portée métier explicite autoriser aux assistants Partners et Intelligence au-delà des lectures déjà permises ?

- (a) Conserver strictement leurs droits existants, avec tâches d’analyse sur objets explicitement partagés — défaut proposé
- (b) Accorder des mutations supplémentaires seulement après ajout à la matrice de droits approuvée

Bloque : Nouvelles mutations et tâches professionnelles dont la permission n’est pas encore définie ; ne pas redemander les droits déjà validés par S110/S112.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.009

### S-081 — question 2

[S-081](plans/S-081.plan.md) · Quel modèle de workflow initial valider avant les automatismes métier ?

- (a) Templates versionnés par type de dossier, avec transitions, responsable, délais et conditions validés dans le plan — défaut proposé
- (b) Workflow unique dont toutes les variantes et exceptions sont définies dans le plan

Bloque : Transitions, délais de relance/SLA, clôture et affectations automatiques hors fixtures.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-021 — question 2

[S-021](plans/S-021.plan.md) · Valider les champs, pièces et destinataires du formulaire LPP avant d’automatiser la transmission ?

- (a) Oui, template organisme approuvé — défaut proposé
- (b) Saisie assistée par opérateur dans un dossier suivi

Bloque : Champs obligatoires métier et passage READY_TO_SIGN réel

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-022 — question 1

[S-022](plans/S-022.plan.md) · Clôturer une recherche sans avoir trouvé comme COMPLETED avec résultat négatif explicite, sans passer ASSET_IDENTIFIED ?

- (a) Oui, résultat final typé trouvé/non trouvé/incomplet — défaut proposé
- (b) Fournir un état terminal supplémentaire approuvé

Bloque : Sémantique de clôture en absence d’avoir

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-020 — question 1

[S-020](plans/S-020.plan.md) · Valider un template de dossier récupération comprenant états par compagnie, responsables, délais de relance et critères de clôture avant automatisation ?

- (a) Oui, template à approuver dans le plan — défaut proposé
- (b) Traitement assisté sans relance automatique jusqu’à décision

Bloque : Timers/SLA/transitions non précisés, pas création locale du dossier

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-031 — question 1

[S-031](plans/S-031.plan.md) · La demande de validation du Full Audit crée-t-elle un dossier de vérification, l’opportunité commerciale seulement après qualification ?

- (a) Oui, dossiers et opportunités distincts — défaut proposé
- (b) Fournir un workflow de qualification différent explicite

Bloque : Automatisation de la qualification experte

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-033 — question 1

[S-033](plans/S-033.plan.md) · Une revue générale annuelle est-elle déclenchée sur date de dernière décision, avec dossier attribué et validation avant recommandation client ?

- (a) Oui, cadence/règles à approuver explicitement — défaut proposé
- (b) Revue seulement à la demande jusqu’à cadence définie

Bloque : Calendrier de revue et diffusion automatiques

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-083 — question 2

[S-083](plans/S-083.plan.md) · Quel modèle de workflow initial valider avant les automatismes métier ?

- (a) Templates versionnés par type de dossier, avec transitions, responsable, délais et conditions validés dans le plan — défaut proposé
- (b) Workflow unique dont toutes les variantes et exceptions sont définies dans le plan

Bloque : Transitions, délais de relance/SLA, clôture et affectations automatiques hors fixtures.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-084 — question 2

[S-084](plans/S-084.plan.md) · Quel modèle de workflow initial valider avant les automatismes métier ?

- (a) Templates versionnés par type de dossier, avec transitions, responsable, délais et conditions validés dans le plan — défaut proposé
- (b) Workflow unique dont toutes les variantes et exceptions sont définies dans le plan

Bloque : Transitions, délais de relance/SLA, clôture et affectations automatiques hors fixtures.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-063 — question 3

[S-063](plans/S-063.plan.md) · Réutiliser les états/tâches/responsabilités du dossier commun pour Strategy ?

- (a) Oui, préciser le template Strategy sans second workflow autonome. — défaut proposé
- (b) Faire approuver un template distinct relié au même dossier.

Bloque : Template, responsable et prochaines actions du dossier expert.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-085 — question 1

[S-085](plans/S-085.plan.md) · Quel modèle de workflow initial valider avant les automatismes métier ?

- (a) Templates versionnés par type de dossier, avec transitions, responsable, délais et conditions validés dans le plan — défaut proposé
- (b) Workflow unique dont toutes les variantes et exceptions sont définies dans le plan

Bloque : Transitions, délais de relance/SLA, clôture et affectations automatiques hors fixtures.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-065 — question 2

[S-065](plans/S-065.plan.md) · Utiliser un template de tâche Care avec responsable, échéance et prochaine action explicitement définis ?

- (a) Oui, réutiliser le workflow commun après validation du template. — défaut proposé
- (b) Fournir un workflow Care distinct lié au même dossier.

Bloque : Escalade, SLA et prise en charge des alertes.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-066 — question 2

[S-066](plans/S-066.plan.md) · Rattacher toute revue au dossier existant avec un template annuel/événement approuvé ?

- (a) Oui, même dossier et types de revue explicites. — défaut proposé
- (b) Fournir un autre regroupement de dossiers autorisé et ses règles.

Bloque : États, responsable, échéance et documents de Review.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-093 — question 1

[S-093](plans/S-093.plan.md) · Quel modèle de workflow initial valider avant les automatismes métier ?

- (a) Templates versionnés par type de dossier, avec transitions, responsable, délais et conditions validés dans le plan — défaut proposé
- (b) Workflow unique dont toutes les variantes et exceptions sont définies dans le plan

Bloque : Transitions, délais de relance/SLA, clôture et affectations automatiques hors fixtures.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-036 — question 1

[S-036](plans/S-036.plan.md) · Valider un registre par organisme avec canal, destinataire, pièces, délais et preuve attendue ; utiliser humain assisté lorsque aucun canal automatisable n’est approuvé ?

- (a) Oui, aucun endpoint supposé — défaut proposé
- (b) Fournir canaux et intégrations déjà contractuellement approuvés

Bloque : Toute transmission/relance réelle

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-041 — question 1

[S-041](plans/S-041.plan.md) · Valider règle de clôture/réouverture et gestion des réponses partielles par type de demande ?

- (a) Oui, templates approuvés avant traitement autonome — défaut proposé
- (b) Revue humaine obligatoire pour toute clôture initiale

Bloque : Automatisation de clôture/réouverture

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-100 — question 1

[S-100](plans/S-100.plan.md) · Quel modèle de workflow initial valider avant les automatismes métier ?

- (a) Templates versionnés par type de dossier, avec transitions, responsable, délais et conditions validés dans le plan — défaut proposé
- (b) Workflow unique dont toutes les variantes et exceptions sont définies dans le plan

Bloque : Transitions, délais de relance/SLA, clôture et affectations automatiques hors fixtures.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.010

### S-080 — question 2

[S-080](plans/S-080.plan.md) · Quelle définition des étapes et revenus autoriser ?

- (a) Valider séparément étapes configurables, probabilités commerciales et états signé/acquis/facturé/attendu/encaissé/reversé — défaut proposé
- (b) Fournir une autre nomenclature comptable et commerciale explicite avant calcul

Bloque : Calculs et reporting financiers hors données fictives, commissions, objectifs et forecasts.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-086 — question 1

[S-086](plans/S-086.plan.md) · Quelle définition des étapes et revenus autoriser ?

- (a) Valider séparément étapes configurables, probabilités commerciales et états signé/acquis/facturé/attendu/encaissé/reversé — défaut proposé
- (b) Fournir une autre nomenclature comptable et commerciale explicite avant calcul

Bloque : Calculs et reporting financiers hors données fictives, commissions, objectifs et forecasts.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-087 — question 1

[S-087](plans/S-087.plan.md) · Quelle définition des étapes et revenus autoriser ?

- (a) Valider séparément étapes configurables, probabilités commerciales et états signé/acquis/facturé/attendu/encaissé/reversé — défaut proposé
- (b) Fournir une autre nomenclature comptable et commerciale explicite avant calcul

Bloque : Calculs et reporting financiers hors données fictives, commissions, objectifs et forecasts.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-085 — question 2

[S-085](plans/S-085.plan.md) · Quelle définition des étapes et revenus autoriser ?

- (a) Valider séparément étapes configurables, probabilités commerciales et états signé/acquis/facturé/attendu/encaissé/reversé — défaut proposé
- (b) Fournir une autre nomenclature comptable et commerciale explicite avant calcul

Bloque : Calculs et reporting financiers hors données fictives, commissions, objectifs et forecasts.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-110 — question 2

[S-110](plans/S-110.plan.md) · Quelle définition des étapes et revenus autoriser ?

- (a) Valider séparément étapes configurables, probabilités commerciales et états signé/acquis/facturé/attendu/encaissé/reversé — défaut proposé
- (b) Fournir une autre nomenclature comptable et commerciale explicite avant calcul

Bloque : Calculs et reporting financiers hors données fictives, commissions, objectifs et forecasts.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-119 — question 1

[S-119](plans/S-119.plan.md) · Quelle définition des étapes et revenus autoriser ?

- (a) Valider séparément étapes configurables, probabilités commerciales et états signé/acquis/facturé/attendu/encaissé/reversé — défaut proposé
- (b) Fournir une autre nomenclature comptable et commerciale explicite avant calcul

Bloque : Calculs et reporting financiers hors données fictives, commissions, objectifs et forecasts.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-121 — question 2

[S-121](plans/S-121.plan.md) · Quelle définition des étapes et revenus autoriser ?

- (a) Valider séparément étapes configurables, probabilités commerciales et états signé/acquis/facturé/attendu/encaissé/reversé — défaut proposé
- (b) Fournir une autre nomenclature comptable et commerciale explicite avant calcul

Bloque : Calculs et reporting financiers hors données fictives, commissions, objectifs et forecasts.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.011

### S-083 — question 1

[S-083](plans/S-083.plan.md) · Quel périmètre Google synchroniser au départ ?

- (a) Comptes et alias professionnels, labels et calendriers explicitement sélectionnés ; aucun import global — défaut proposé
- (b) Règles professionnelles plus fines documentées et testées avant connexion

Bloque : OAuth, synchronisation, envoi et rétention réels Gmail/Calendar ; sens et conflit à confirmer au plan.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-084 — question 1

[S-084](plans/S-084.plan.md) · Quel périmètre Google synchroniser au départ ?

- (a) Comptes et alias professionnels, labels et calendriers explicitement sélectionnés ; aucun import global — défaut proposé
- (b) Règles professionnelles plus fines documentées et testées avant connexion

Bloque : OAuth, synchronisation, envoi et rétention réels Gmail/Calendar ; sens et conflit à confirmer au plan.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-089 — question 1

[S-089](plans/S-089.plan.md) · Quel périmètre Google synchroniser au départ ?

- (a) Comptes et alias professionnels, labels et calendriers explicitement sélectionnés ; aucun import global — défaut proposé
- (b) Règles professionnelles plus fines documentées et testées avant connexion

Bloque : OAuth, synchronisation, envoi et rétention réels Gmail/Calendar ; sens et conflit à confirmer au plan.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-041 — question 2

[S-041](plans/S-041.plan.md) · Les comptes/labels et règles de rattachement autorisés à traiter ces réponses ont-ils été explicitement définis ?

- (a) Oui, périmètre S-089 joint et limité — défaut proposé
- (b) Dépôt humain assisté des réponses uniquement jusqu’à validation

Bloque : Ingress email réel de dossiers

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-090 — question 1

[S-090](plans/S-090.plan.md) · Quel périmètre Google synchroniser au départ ?

- (a) Comptes et alias professionnels, labels et calendriers explicitement sélectionnés ; aucun import global — défaut proposé
- (b) Règles professionnelles plus fines documentées et testées avant connexion

Bloque : OAuth, synchronisation, envoi et rétention réels Gmail/Calendar ; sens et conflit à confirmer au plan.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.012

### S-012 — question 1

[S-012](plans/S-012.plan.md) · Le chat FAQ doit-il répondre uniquement depuis le corpus public publié avec abstention hors corpus ?

- (a) Oui, corpus public exclusivement — défaut proposé
- (b) Ajouter des sources publiques externes explicitement approuvées

Bloque : Retrieval et fournisseur réel S-039

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-094 — question 2

[S-094](plans/S-094.plan.md) · Quel cadre fournisseur et conversations valider pour l'IA ?

- (a) Fournisseur avec résidence, rétention, DPA et non-réutilisation des données validés, contexte canonique borné — défaut proposé
- (b) Hébergement de modèle dédié avec les mêmes preuves et limites définies

Bloque : Appels modèles réels, partage/mémoire et conservation des conversations ; aucun choix fournisseur réputé acquis.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-037 — question 1

[S-037](plans/S-037.plan.md) · Le fournisseur OCR/classification et ses règles de résidence/rétention/réutilisation sont-ils approuvés ?

- (a) Oui, décision exacte jointe au GO — défaut proposé
- (b) Non, intégrer uniquement corpus synthétique sans données personnelles

Bloque : Traitement de vraies pièces

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-039 — question 1

[S-039](plans/S-039.plan.md) · Le fournisseur et ses conditions de données pour FAQ publique sont-ils approuvés, avec aucune source privée ?

- (a) Oui, décision exacte au GO — défaut proposé
- (b) Non, conserver recherche FAQ sans génération

Bloque : Appels LLM réels

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-098 — question 1

[S-098](plans/S-098.plan.md) · Quel cadre fournisseur et conversations valider pour l'IA ?

- (a) Fournisseur avec résidence, rétention, DPA et non-réutilisation des données validés, contexte canonique borné — défaut proposé
- (b) Hébergement de modèle dédié avec les mêmes preuves et limites définies

Bloque : Appels modèles réels, partage/mémoire et conservation des conversations ; aucun choix fournisseur réputé acquis.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-072 — question 2

[S-072](plans/S-072.plan.md) · Réutiliser strictement fournisseur, rétention et périmètre de contexte IA déjà validés pour S-098 ?

- (a) Oui, aucun nouveau fournisseur ni extension de données sans décision explicite. — défaut proposé
- (b) Définir un périmètre Retire plus restreint avant activation.

Bloque : Contexte financier transmis au LLM réel.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-122 — question 2

[S-122](plans/S-122.plan.md) · Quel partage de conversation professionnelle autoriser si ce cas n’a pas encore été tranché ?

- (a) Conversation personnelle ou liée à l’objet explicitement partagé, sans accès automatique de toute l’équipe — défaut proposé
- (b) Partage d’équipe selon une matrice explicite approuvée pour les objets concernés

Bloque : Partage d’historique professionnel nouveau uniquement ; fournisseur et rétention déjà validés sont réutilisés.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.013

### S-095 — question 1

[S-095](plans/S-095.plan.md) · Quel registre initial d'actions IA approuver ?

- (a) Lecture, brouillons, tâches et notes réversibles ; aperçu lié au payload puis confirmation pour tous effets sensibles — défaut proposé
- (b) Registre limité à lecture et brouillons jusqu'à validation détaillée des mutations

Bloque : Activation des actions métier, seuils d'escalade et règles d'annulation/compensation.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-096 — question 1

[S-096](plans/S-096.plan.md) · Quel registre initial d'actions IA approuver ?

- (a) Lecture, brouillons, tâches et notes réversibles ; aperçu lié au payload puis confirmation pour tous effets sensibles — défaut proposé
- (b) Registre limité à lecture et brouillons jusqu'à validation détaillée des mutations

Bloque : Activation des actions métier, seuils d'escalade et règles d'annulation/compensation.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-098 — question 3

[S-098](plans/S-098.plan.md) · Quel registre initial d'actions IA approuver ?

- (a) Lecture, brouillons, tâches et notes réversibles ; aperçu lié au payload puis confirmation pour tous effets sensibles — défaut proposé
- (b) Registre limité à lecture et brouillons jusqu'à validation détaillée des mutations

Bloque : Activation des actions métier, seuils d'escalade et règles d'annulation/compensation.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-072 — question 1

[S-072](plans/S-072.plan.md) · Limiter les premières actions Retire IA à lecture, brouillon de scénario et tâche de revue avec confirmation ?

- (a) Oui, registre explicite approuvé ; actes financiers interdits. — défaut proposé
- (b) Fournir un registre plus restreint avant activation.

Bloque : Actions Retire autorisées et niveau de confirmation.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-100 — question 2

[S-100](plans/S-100.plan.md) · Quel registre initial d'actions IA approuver ?

- (a) Lecture, brouillons, tâches et notes réversibles ; aperçu lié au payload puis confirmation pour tous effets sensibles — défaut proposé
- (b) Registre limité à lecture et brouillons jusqu'à validation détaillée des mutations

Bloque : Activation des actions métier, seuils d'escalade et règles d'annulation/compensation.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-121 — question 1

[S-121](plans/S-121.plan.md) · Quel registre initial d'actions IA approuver ?

- (a) Lecture, brouillons, tâches et notes réversibles ; aperçu lié au payload puis confirmation pour tous effets sensibles — défaut proposé
- (b) Registre limité à lecture et brouillons jusqu'à validation détaillée des mutations

Bloque : Activation des actions métier, seuils d'escalade et règles d'annulation/compensation.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-122 — question 3

[S-122](plans/S-122.plan.md) · Quel sous-ensemble du registre existant rendre disponible aux nouvelles surfaces ?

- (a) Lectures autorisées, brouillons et tâches d’analyse permises, tous effets sensibles conservant leurs politiques existantes — défaut proposé
- (b) Autres actions nommées après validation explicite des schémas, droits et confirmations par surface

Bloque : Actions nouvelles dont l’exposition Partners/Intelligence n’a pas été approuvée ; aucun nouveau pouvoir financier implicite.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.014

### S-097 — question 1

[S-097](plans/S-097.plan.md) · Quel premier parcours vocal activer ?

- (a) Transcription en ligne, FR initial à confirmer, aperçu éditable, audio supprimé selon politique validée ; pas d'action hors ligne — défaut proposé
- (b) Transcription multilingue et brouillons hors ligne avec règles de stockage et resynchronisation validées

Bloque : Fournisseur, langues/noms propres, rétention audio, PWA et synchronisation réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-099 — question 1

[S-099](plans/S-099.plan.md) · Quel premier parcours vocal activer ?

- (a) Transcription en ligne, FR initial à confirmer, aperçu éditable, audio supprimé selon politique validée ; pas d'action hors ligne — défaut proposé
- (b) Transcription multilingue et brouillons hors ligne avec règles de stockage et resynchronisation validées

Bloque : Fournisseur, langues/noms propres, rétention audio, PWA et synchronisation réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.015

### S-091 — question 1

[S-091](plans/S-091.plan.md) · Quelle politique contractuelle approuver avant une réponse client réelle ?

- (a) Hiérarchie configurable et datée, catégories prudentes de la bible, escalade des contradictions et cas sensibles — défaut proposé
- (b) Politique spécifique par produit/assureur fournie avant activation

Bloque : Hiérarchie de clauses, seuils, catégories, nom/ton et escalades obligatoires hors fixtures.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-092 — question 1

[S-092](plans/S-092.plan.md) · Quelle politique contractuelle approuver avant une réponse client réelle ?

- (a) Hiérarchie configurable et datée, catégories prudentes de la bible, escalade des contradictions et cas sensibles — défaut proposé
- (b) Politique spécifique par produit/assureur fournie avant activation

Bloque : Hiérarchie de clauses, seuils, catégories, nom/ton et escalades obligatoires hors fixtures.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-093 — question 2

[S-093](plans/S-093.plan.md) · Quelle politique contractuelle approuver avant une réponse client réelle ?

- (a) Hiérarchie configurable et datée, catégories prudentes de la bible, escalade des contradictions et cas sensibles — défaut proposé
- (b) Politique spécifique par produit/assureur fournie avant activation

Bloque : Hiérarchie de clauses, seuils, catégories, nom/ton et escalades obligatoires hors fixtures.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-098 — question 2

[S-098](plans/S-098.plan.md) · Quelle politique contractuelle approuver avant une réponse client réelle ?

- (a) Hiérarchie configurable et datée, catégories prudentes de la bible, escalade des contradictions et cas sensibles — défaut proposé
- (b) Politique spécifique par produit/assureur fournie avant activation

Bloque : Hiérarchie de clauses, seuils, catégories, nom/ton et escalades obligatoires hors fixtures.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.016

### S-101 — question 1

[S-101](plans/S-101.plan.md) · Quel cadre de pass et de validation partenaire retenir ?

- (a) Apple et Google Wallet via fournisseur validé, jetons opaques courts et validation serveur en ligne obligatoire — défaut proposé
- (b) Intégrations directes Apple et Google, mêmes règles de portée, rotation et révocation documentées

Bloque : Choix fournisseur, appareils, design/champs, deep links, expiration/rotation et scanners de production.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-106 — question 1

[S-106](plans/S-106.plan.md) · Quel cadre de pass et de validation partenaire retenir ?

- (a) Apple et Google Wallet via fournisseur validé, jetons opaques courts et validation serveur en ligne obligatoire — défaut proposé
- (b) Intégrations directes Apple et Google, mêmes règles de portée, rotation et révocation documentées

Bloque : Choix fournisseur, appareils, design/champs, deep links, expiration/rotation et scanners de production.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-102 — question 1

[S-102](plans/S-102.plan.md) · Quel cadre de pass et de validation partenaire retenir ?

- (a) Apple et Google Wallet via fournisseur validé, jetons opaques courts et validation serveur en ligne obligatoire — défaut proposé
- (b) Intégrations directes Apple et Google, mêmes règles de portée, rotation et révocation documentées

Bloque : Choix fournisseur, appareils, design/champs, deep links, expiration/rotation et scanners de production.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.017

### S-103 — question 1

[S-103](plans/S-103.plan.md) · Quelles règles Miles commercialiser ?

- (a) Points non monétaires et non transférables ; barèmes, plafonds, expiration, financement et reprises validés avant publication — défaut proposé
- (b) Autre unité ou transférabilité après validation juridique, fiscale et comptable explicite

Bloque : Tout barème, valeur, échéance, niveau, montant comptable et règle de règlement réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-104 — question 1

[S-104](plans/S-104.plan.md) · Quelles règles Miles commercialiser ?

- (a) Points non monétaires et non transférables ; barèmes, plafonds, expiration, financement et reprises validés avant publication — défaut proposé
- (b) Autre unité ou transférabilité après validation juridique, fiscale et comptable explicite

Bloque : Tout barème, valeur, échéance, niveau, montant comptable et règle de règlement réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-105 — question 2

[S-105](plans/S-105.plan.md) · Quelles règles Miles commercialiser ?

- (a) Points non monétaires et non transférables ; barèmes, plafonds, expiration, financement et reprises validés avant publication — défaut proposé
- (b) Autre unité ou transférabilité après validation juridique, fiscale et comptable explicite

Bloque : Tout barème, valeur, échéance, niveau, montant comptable et règle de règlement réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-107 — question 2

[S-107](plans/S-107.plan.md) · Quelles règles Miles commercialiser ?

- (a) Points non monétaires et non transférables ; barèmes, plafonds, expiration, financement et reprises validés avant publication — défaut proposé
- (b) Autre unité ou transférabilité après validation juridique, fiscale et comptable explicite

Bloque : Tout barème, valeur, échéance, niveau, montant comptable et règle de règlement réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-108 — question 1

[S-108](plans/S-108.plan.md) · Quelles règles Miles commercialiser ?

- (a) Points non monétaires et non transférables ; barèmes, plafonds, expiration, financement et reprises validés avant publication — défaut proposé
- (b) Autre unité ou transférabilité après validation juridique, fiscale et comptable explicite

Bloque : Tout barème, valeur, échéance, niveau, montant comptable et règle de règlement réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-109 — question 1

[S-109](plans/S-109.plan.md) · Quelles règles Miles commercialiser ?

- (a) Points non monétaires et non transférables ; barèmes, plafonds, expiration, financement et reprises validés avant publication — défaut proposé
- (b) Autre unité ou transférabilité après validation juridique, fiscale et comptable explicite

Bloque : Tout barème, valeur, échéance, niveau, montant comptable et règle de règlement réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-119 — question 2

[S-119](plans/S-119.plan.md) · Quelles règles Miles commercialiser ?

- (a) Points non monétaires et non transférables ; barèmes, plafonds, expiration, financement et reprises validés avant publication — défaut proposé
- (b) Autre unité ou transférabilité après validation juridique, fiscale et comptable explicite

Bloque : Tout barème, valeur, échéance, niveau, montant comptable et règle de règlement réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.018

### S-104 — question 2

[S-104](plans/S-104.plan.md) · Quels premiers rewards autoriser ?

- (a) Services CoverView et vouchers partenaires approuvés ; assurance/cashback/Miles+cash bloqués tant que leurs conditions ne sont pas validées — défaut proposé
- (b) Catalogue incluant ces catégories après leurs validations juridiques, fiscales, financières et opérationnelles

Bloque : Catalogue réel, no-show, stock, annulation, litiges et onboarding des partenaires ; toutes catégories restent à implémenter.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-105 — question 1

[S-105](plans/S-105.plan.md) · Quels premiers rewards autoriser ?

- (a) Services CoverView et vouchers partenaires approuvés ; assurance/cashback/Miles+cash bloqués tant que leurs conditions ne sont pas validées — défaut proposé
- (b) Catalogue incluant ces catégories après leurs validations juridiques, fiscales, financières et opérationnelles

Bloque : Catalogue réel, no-show, stock, annulation, litiges et onboarding des partenaires ; toutes catégories restent à implémenter.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-106 — question 2

[S-106](plans/S-106.plan.md) · Quels premiers rewards autoriser ?

- (a) Services CoverView et vouchers partenaires approuvés ; assurance/cashback/Miles+cash bloqués tant que leurs conditions ne sont pas validées — défaut proposé
- (b) Catalogue incluant ces catégories après leurs validations juridiques, fiscales, financières et opérationnelles

Bloque : Catalogue réel, no-show, stock, annulation, litiges et onboarding des partenaires ; toutes catégories restent à implémenter.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-107 — question 1

[S-107](plans/S-107.plan.md) · Quels premiers rewards autoriser ?

- (a) Services CoverView et vouchers partenaires approuvés ; assurance/cashback/Miles+cash bloqués tant que leurs conditions ne sont pas validées — défaut proposé
- (b) Catalogue incluant ces catégories après leurs validations juridiques, fiscales, financières et opérationnelles

Bloque : Catalogue réel, no-show, stock, annulation, litiges et onboarding des partenaires ; toutes catégories restent à implémenter.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-108 — question 2

[S-108](plans/S-108.plan.md) · Quels premiers rewards autoriser ?

- (a) Services CoverView et vouchers partenaires approuvés ; assurance/cashback/Miles+cash bloqués tant que leurs conditions ne sont pas validées — défaut proposé
- (b) Catalogue incluant ces catégories après leurs validations juridiques, fiscales, financières et opérationnelles

Bloque : Catalogue réel, no-show, stock, annulation, litiges et onboarding des partenaires ; toutes catégories restent à implémenter.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-111 — question 1

[S-111](plans/S-111.plan.md) · Quels premiers rewards autoriser ?

- (a) Services CoverView et vouchers partenaires approuvés ; assurance/cashback/Miles+cash bloqués tant que leurs conditions ne sont pas validées — défaut proposé
- (b) Catalogue incluant ces catégories après leurs validations juridiques, fiscales, financières et opérationnelles

Bloque : Catalogue réel, no-show, stock, annulation, litiges et onboarding des partenaires ; toutes catégories restent à implémenter.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-109 — question 2

[S-109](plans/S-109.plan.md) · Quels premiers rewards autoriser ?

- (a) Services CoverView et vouchers partenaires approuvés ; assurance/cashback/Miles+cash bloqués tant que leurs conditions ne sont pas validées — défaut proposé
- (b) Catalogue incluant ces catégories après leurs validations juridiques, fiscales, financières et opérationnelles

Bloque : Catalogue réel, no-show, stock, annulation, litiges et onboarding des partenaires ; toutes catégories restent à implémenter.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-109 — question 3

[S-109](plans/S-109.plan.md) · Quel montage approuver pour assurance offerte et cashback ?

- (a) Implémenter via un prestataire et des conditions spécifiques validés, chaque catégorie activée seulement avec sa preuve juridique/comptable — défaut proposé
- (b) Conserver les catégories techniquement prêtes mais désactivées tant que montage ou prestataire manque

Bloque : Assurance, cashback, équivalence monétaire et rewards externes réels ; aucun élément supprimé du périmètre.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-119 — question 3

[S-119](plans/S-119.plan.md) · Quels premiers rewards autoriser ?

- (a) Services CoverView et vouchers partenaires approuvés ; assurance/cashback/Miles+cash bloqués tant que leurs conditions ne sont pas validées — défaut proposé
- (b) Catalogue incluant ces catégories après leurs validations juridiques, fiscales, financières et opérationnelles

Bloque : Catalogue réel, no-show, stock, annulation, litiges et onboarding des partenaires ; toutes catégories restent à implémenter.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-119 — question 4

[S-119](plans/S-119.plan.md) · Quel moyen de règlement partenaire valider ?

- (a) Prestataire de paiement encadré avec onboarding, compte destinataire et preuve de versement vérifiables — défaut proposé
- (b) Processus bancaire autorisé avec validation, export d’ordre et import de preuve rapprochée, sans paiement prétendu avant preuve

Bloque : Versements réels, taxes/arrondis, périodicité, corrections et responsabilité par financeur.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.019

### S-114 — question 1

[S-114](plans/S-114.plan.md) · Quel cadre permet d'activer Exchange ?

- (a) Conserver le développement isolé puis activer uniquement après qualification juridique, opérateur/fonds/KYC et règles de règlement validés — défaut proposé
- (b) Rester en démonstration isolée tant que ces validations et prestataires manquent

Bloque : Exposition, fonds, rémunération, KYC, settlement et mise à disposition commerciale réels, sans suppression du périmètre.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-115 — question 1

[S-115](plans/S-115.plan.md) · Quel cadre permet d'activer Exchange ?

- (a) Conserver le développement isolé puis activer uniquement après qualification juridique, opérateur/fonds/KYC et règles de règlement validés — défaut proposé
- (b) Rester en démonstration isolée tant que ces validations et prestataires manquent

Bloque : Exposition, fonds, rémunération, KYC, settlement et mise à disposition commerciale réels, sans suppression du périmètre.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-120 — question 1

[S-120](plans/S-120.plan.md) · Quel cadre permet d'activer Exchange ?

- (a) Conserver le développement isolé puis activer uniquement après qualification juridique, opérateur/fonds/KYC et règles de règlement validés — défaut proposé
- (b) Rester en démonstration isolée tant que ces validations et prestataires manquent

Bloque : Exposition, fonds, rémunération, KYC, settlement et mise à disposition commerciale réels, sans suppression du périmètre.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-116 — question 1

[S-116](plans/S-116.plan.md) · Quel cadre permet d'activer Exchange ?

- (a) Conserver le développement isolé puis activer uniquement après qualification juridique, opérateur/fonds/KYC et règles de règlement validés — défaut proposé
- (b) Rester en démonstration isolée tant que ces validations et prestataires manquent

Bloque : Exposition, fonds, rémunération, KYC, settlement et mise à disposition commerciale réels, sans suppression du périmètre.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.020

### S-016 — question 2

[S-016](plans/S-016.plan.md) · Conserver 100000 comme cible de profil Retire, afficher seulement le nombre réellement calculé ?

- (a) Oui, cible et exécution séparées — défaut proposé
- (b) Fournir des profils et budgets alternatifs explicites

Bloque : Règles de lancement des profils lourds

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-029 — question 2

[S-029](plans/S-029.plan.md) · Valider profil général 10000 avec budget/diagnostics et limites avant activation ?

- (a) Oui, exécution mesurée et N exact — défaut proposé
- (b) Fournir profils alternatifs et seuils explicites

Bloque : Budget, convergence et politique d’exécution réelle

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-056 — question 1

[S-056](plans/S-056.plan.md) · Comment autoriser le profil Retire cible 100 000 ?

- (a) Exécuter un profil configurable sur fixtures puis exiger mesures de convergence/coût/seuils avant promesse réelle. — défaut proposé
- (b) Faire approuver directement les profils et seuils à partir d'une étude fournie.

Bloque : Profil personnel réel, coût admis et critères de convergence.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-043 — question 2

[S-043](plans/S-043.plan.md) · Le profil N, diagnostics et seuils de convergence de l'accumulation sont-ils approuvés ?

- (a) Conserver le moteur en démonstration jusqu'à configuration et corpus approuvés. — défaut proposé
- (b) Joindre explicitement configuration, tolérances et diagnostics validés.

Bloque : Probabilités réelles et promesse de précision.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-038 — question 2

[S-038](plans/S-038.plan.md) · Le profil N, diagnostics et seuils de convergence de l’accumulation sont-ils approuvés ?

- (a) Oui, configuration/corpus explicitement joints — défaut proposé
- (b) Non, conserver moteur sur corpus de démonstration

Bloque : Probabilités réelles

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-076 — question 1

[S-076](plans/S-076.plan.md) · Autoriser la cible 100 000 seulement après seuils de convergence, temps et coût explicitement approuvés ?

- (a) Oui, profil limité à ce qui est mesuré et validé. — défaut proposé
- (b) Fournir des plafonds et critères validés avant les essais.

Bloque : Coût et promesse de précision du profil Retire.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-068 — question 3

[S-068](plans/S-068.plan.md) · Autoriser la cible 100 000 seulement après seuils de convergence, temps et coût explicitement approuvés ?

- (a) Oui, profil limité à ce qui est mesuré et validé. — défaut proposé
- (b) Fournir des plafonds et critères validés avant les essais.

Bloque : Coût et promesse de précision du profil Retire.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.021

### S-029 — question 3

[S-029](plans/S-029.plan.md) · Confirmer définition §56.3 pour accumulation, séparée de la soutenabilité Retire ?

- (a) Oui, cible atteinte à l’âge choisi/premier âge au seuil — défaut proposé
- (b) Fournir définition alternative explicitement sourcée

Bloque : Sens probabiliste publié

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-056 — question 2

[S-056](plans/S-056.plan.md) · Définir les événements de soutenabilité Retire séparément du Target Age à 50 % ?

- (a) Oui, aucune réutilisation implicite ; approuver événement et horizon avant probabilités réelles. — défaut proposé
- (b) Fournir une autre correspondance explicitement validée.

Bloque : Probabilités 80/90/95/99 % et événement de succès.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-053 — question 2

[S-053](plans/S-053.plan.md) · Quelle définition utiliser pour la réussite du revenu réel ?

- (a) Soumettre une définition explicite de maintien du revenu sur l'horizon Retire, sans reprendre Target Age 50 %. — défaut proposé
- (b) Fournir une définition métier alternative avant calcul.

Bloque : Real Income Success Rate et niveaux de soutenabilité.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-062 — question 2

[S-062](plans/S-062.plan.md) · Les événements et horizons de succès doivent-ils être partagés avec le Range approuvé ?

- (a) Oui, une définition canonique commune à Range et optimisation. — défaut proposé
- (b) Fournir des événements distincts justifiés avant implémentation.

Bloque : Interprétation cohérente des niveaux de soutenabilité.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-043 — question 3

[S-043](plans/S-043.plan.md) · L'événement de réussite accumulation et l'horizon sont-ils approuvés selon §56.3 ?

- (a) Faire approuver cible à âge donné et premier âge au seuil avant sortie réelle. — défaut proposé
- (b) Fournir une convention différente explicitement validée avant calcul réel.

Bloque : Sémantique du calcul réel.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-038 — question 3

[S-038](plans/S-038.plan.md) · Événement de réussite accumulation et horizon sont-ils approuvés selon §56.3 ?

- (a) Oui, cible à âge et premier âge au seuil — défaut proposé
- (b) Fournir convention différente avant toute sortie réelle

Bloque : Sémantique du calcul réel

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-076 — question 2

[S-076](plans/S-076.plan.md) · Les événements et horizons de réussite Retire sont-ils approuvés séparément du Target Age d'accumulation ?

- (a) Maintenir les probabilités Retire bloquées jusqu'à définition explicite. — défaut proposé
- (b) Joindre événements/horizons et cas attendus validés.

Bloque : Probabilités personnelles de maintien du revenu réel.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.022

### S-028 — question 2

[S-028](plans/S-028.plan.md) · Conserver 25 ans uniquement pour le calcul rapide et déléguer longévité/couple à Retire ?

- (a) Oui, horizons distincts affichés — défaut proposé
- (b) Fournir une autre convention explicite pour le rapide

Bloque : Horizon du calcul cible rapide

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-054 — question 1

[S-054](plans/S-054.plan.md) · Avant paramètres démographiques validés, conserver des profils de vie fictifs explicitement choisis sans assimiler 25 ans à l'espérance de vie ?

- (a) Oui, données de démonstration et mode personnel réel bloqué. — défaut proposé
- (b) Fournir distributions, horizon et règles de couple approuvés avant le moteur personnel.

Bloque : Longévité réelle, ordre des décès et horizon de calcul.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-074 — question 2

[S-074](plans/S-074.plan.md) · Le paquet de longévité comprend-il distributions, couple, décès et horizon explicitement validés ?

- (a) Maintenir la vie personnelle non activable jusqu'à ces décisions documentées. — défaut proposé
- (b) Joindre le modèle démographique et son domaine validés au GO.

Bloque : Admissibilité des données de vie pour simulation Retire.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.023

### S-058 — question 1

[S-058](plans/S-058.plan.md) · Comment concilier 80/17/3 avec Income en CHF et Safety en années ?

- (a) Conserver les références côte à côte ; bloquer toute initialisation/recalibrage personnel jusqu'à règle de priorité approuvée. — défaut proposé
- (b) Fournir la priorité, l'initialisation et les règles de recalibrage validées.

Bloque : Allocation personnelle et calibrage des poches.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-059 — question 1

[S-059](plans/S-059.plan.md) · Comment définir besoin résiduel et priorité des seuils Safety face aux 3 % ?

- (a) Faire approuver la définition et la priorité avant allocation personnelle ; conserver les deux références en fixtures. — défaut proposé
- (b) Fournir une méthode de dimensionnement validée à intégrer.

Bloque : Dimensionnement réel Income/Safety.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-061 — question 3

[S-061](plans/S-061.plan.md) · La restauration Income/Safety doit-elle utiliser la même priorité approuvée que leur dimensionnement ?

- (a) Oui, un seul jeu de priorités versionnées ; aucune nouvelle règle locale. — défaut proposé
- (b) Définir une priorité de récupération distincte, explicitement validée.

Bloque : Initialisation et récupération cohérentes des poches.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-075 — question 1

[S-075](plans/S-075.plan.md) · La priorité 80/17/3 versus cibles de flux, l'initialisation et le recalibrage sont-ils explicitement approuvés ?

- (a) Bloquer la calibration personnelle concernée tant que la politique exacte manque. — défaut proposé
- (b) Joindre politique, périmètre et corpus approuvés au GO.

Bloque : Dimensionnement et recalibrage réels des poches.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.024

### S-061 — question 2

[S-061](plans/S-061.plan.md) · L'indexation du high-water mark doit-elle suivre l'inflation personnalisée ou une règle propre de 4 % ?

- (a) Ne pas trancher implicitement ; faire approuver la règle, apports/retraits et bonus avant calcul personnel. — défaut proposé
- (b) Adopter une règle propre à 4 % uniquement après validation explicite et documentée.

Bloque : High-water mark, bonus et comparaisons de pouvoir d'achat.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-075 — question 2

[S-075](plans/S-075.plan.md) · L'indexation HWM, le traitement des apports/retraits et le bonus ont-ils une règle validée ?

- (a) Conserver ce chemin non activable sans décision explicite, sans choisir entre 4 % et inflation personnalisée. — défaut proposé
- (b) Joindre les conventions et oracles indépendants approuvés.

Bloque : High-water mark et bonus personnels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.025

### S-053 — question 1

[S-053](plans/S-053.plan.md) · Comment associer Range aux niveaux 80/90/95/99 % ?

- (a) Bloquer le mapping personnel tant qu'une table explicite n'est pas validée ; fixtures identifiées uniquement. — défaut proposé
- (b) Faire approuver une table et ses événements/horizons avant publication.

Bloque : Calcul et libellés personnalisés du Range.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-076 — question 3

[S-076](plans/S-076.plan.md) · La table plancher/recommandé/prospérité possède-t-elle un mapping explicitement approuvé ?

- (a) Garder Range personnel indisponible tant que la table n'est pas validée. — défaut proposé
- (b) Joindre le mapping et son domaine de validité au GO.

Bloque : Correspondance entre Range et niveaux de réussite.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.026

### S-054 — question 2

[S-054](plans/S-054.plan.md) · Comment livrer EMS initialement ?

- (a) Stress activé par défaut avec budget net documenté de démonstration, puis sources validées avant vente. — défaut proposé
- (b) Attendre des coûts/prestations validés pour rendre EMS personnel disponible.

Bloque : Profondeur EMS et périmètre vendable initial.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-070 — question 2

[S-070](plans/S-070.plan.md) · Le périmètre Plan vendu doit-il correspondre exactement aux phases et à l'EMS effectivement disponibles et validés ?

- (a) Oui, toutes les capacités restent planifiées mais seules celles validées sont commercialisées. — défaut proposé
- (b) Attendre validation de l'intégralité de Retire avant toute première vente.

Bloque : Périmètre vendable et phase d'ouverture commerciale.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.027

### S-033 — question 2

[S-033](plans/S-033.plan.md) · Distinguer droits du suivi général des droits Care Retire, sans accorder Care à tout audit ?

- (a) Oui, accès produit séparés — défaut proposé
- (b) Fournir politique commerciale commune explicite

Bloque : Éligibilité commerciale du monitoring

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-051 — question 2

[S-051](plans/S-051.plan.md) · Quels droits permanents et recalculs le Plan doit-il conserver ?

- (a) Conserver les résultats achetés ; documenter les recalculs inclus avant toute restriction, sans frais par simulation. — défaut proposé
- (b) Fournir une autre matrice contractuelle conforme à l'accès permanent et sans facturation à la simulation.

Bloque : Accès permanent, recalculs et articulation avec Care.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-064 — question 1

[S-064](plans/S-064.plan.md) · À la fin de Care, conserver le Plan et ses résultats tout en arrêtant seulement le monitoring défini contractuellement ?

- (a) Oui, matrice de droits/recalculs à approuver avant implementation ; aucune facture à la simulation. — défaut proposé
- (b) Fournir une autre matrice compatible avec le Plan permanent et la bible.

Bloque : Fin de Care, conservation, recalculs et monitoring.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-063 — question 2

[S-063](plans/S-063.plan.md) · Le crédit de CHF 390 doit-il exiger un Plan payé et non remboursé vérifiable ?

- (a) Oui, lien unique au paiement éligible ; traiter les exceptions par règle explicite approuvée. — défaut proposé
- (b) Définir une autre règle d'éligibilité documentée avant le crédit.

Bloque : Éligibilité, reprise et unicité du crédit Plan → Strategy.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-065 — question 1

[S-065](plans/S-065.plan.md) · Déclencher Care seulement sur échéances et changements expressément approuvés, en conservant toujours les versions ?

- (a) Oui, configurer règles/fréquences/seuils avant activation ; fixtures jusque-là. — défaut proposé
- (b) Fournir directement un calendrier et des règles d'alerte validées.

Bloque : Déclenchement personnel et fréquence des recalculs.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-069 — question 2

[S-069](plans/S-069.plan.md) · Faut-il valider les effets du remboursement et des impayés sur crédit/droits tout en préservant le contrat d'accès permanent ?

- (a) Oui, matrice explicite avant tests/activation des transitions financières. — défaut proposé
- (b) Fournir une matrice contractuelle existante à appliquer.

Bloque : Reprise de crédit, impayés et droits après remboursement.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.028

### S-056 — question 3

[S-056](plans/S-056.plan.md) · En l'absence de distributions, calibration et fréquence validées, garder les modèles fixtures et bloquer les runs dits fiables ?

- (a) Oui, définir/valider la méthode avant activation. — défaut proposé
- (b) Fournir la méthode complète, jeux de référence et calibration à intégrer.

Bloque : Simulation réelle présentée comme décision utilisable.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-053 — question 3

[S-053](plans/S-053.plan.md) · Autoriser les métriques réelles uniquement avec fiscalité, coûts/dettes, actualisation et événements formellement définis ?

- (a) Oui ; données fictives et états indisponibles jusqu'à validation. — défaut proposé
- (b) Fournir immédiatement les méthodes validées et leurs jeux de référence.

Bloque : Métriques économiques et probabilités personnelles.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-057 — question 1

[S-057](plans/S-057.plan.md) · Faut-il séparer entièrement les stress forcés des probabilités jusqu'à validation d'une méthode de pondération ?

- (a) Oui, résultats distincts et aucune fréquence combinée. — défaut proposé
- (b) Fournir et faire valider les poids/calibration avant agrégation.

Bloque : Probabilités combinant stress historiques/forcés et Monte-Carlo.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-058 — question 2

[S-058](plans/S-058.plan.md) · Utiliser les plafonds seulement après validation de la taxonomie look-through et de leur périmètre ?

- (a) Oui, contrôle fixture ; exposition réelle indéterminée si taxonomie/source manque. — défaut proposé
- (b) Fournir taxonomie et limites applicables validées avant publication.

Bloque : Contrôle réel des plafonds et classifications Growth.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-059 — question 2

[S-059](plans/S-059.plan.md) · Les critères de dette supportable et de couverture du dividende doivent-ils rester non concluants sans seuils approuvés ?

- (a) Oui, montrer les données et un état indéterminé jusqu'à validation. — défaut proposé
- (b) Fournir les seuils de qualité et leur calibration avant un diagnostic réel.

Bloque : Diagnostic de qualité Income.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-060 — question 2

[S-060](plans/S-060.plan.md) · Les seuils de drawdown, plancher et marge doivent-ils rester fixtures avant formalisation ?

- (a) Oui, blocage des conclusions personnelles tant que seuils/coûts ne sont pas validés. — défaut proposé
- (b) Fournir la méthode et les bornes validées à intégrer.

Bloque : Utilisation simulée personnelle et Max Lombard Usage.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-061 — question 1

[S-061](plans/S-061.plan.md) · Comment traiter base du drawdown, inclusivité, cadence et dernier recours avant formalisation ?

- (a) Soumettre une table explicite de transitions et bloquer les chemins personnels non définis ; fixtures seulement. — défaut proposé
- (b) Fournir toutes les conventions validées avant implémentation personnelle.

Bloque : Machine de flux, réductions budgétaires et dernier recours.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-062 — question 1

[S-062](plans/S-062.plan.md) · Comment activer l'optimisation personnelle tant que objectifs, ruine, coûts, fiscalité et break-even ne sont pas formalisés ?

- (a) Exiger définitions et jeux de référence approuvés ; calcul fixture explicitement limité jusque-là. — défaut proposé
- (b) Fournir le modèle complet validé avant le développement du mode personnel.

Bloque : Objectifs/contraintes, break-even et optimum réel.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-067 — question 2

[S-067](plans/S-067.plan.md) · Toute version de modèle destinée au réel doit-elle avoir méthodes, sources, jeux de référence et preuve de validation ?

- (a) Oui, publication réelle bloquée si l'un manque. — défaut proposé
- (b) Définir un périmètre validé plus restreint, documenté paramètre par paramètre.

Bloque : Gouvernance de méthodes et sources réelles.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-075 — question 3

[S-075](plans/S-075.plan.md) · Les flux, objectifs d'optimisation, fiscalité, coûts/dettes et contraintes disposent-ils de cas indépendants validés ?

- (a) Oui uniquement après définitions et preuves jointes ; sinon maintenir le périmètre bloqué. — défaut proposé
- (b) Fournir un dossier de validation équivalent avec critères exacts.

Bloque : Fiabilité des flux, contraintes et optimisation réelle.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-076 — question 4

[S-076](plans/S-076.plan.md) · Les méthodes et calibrations doivent-elles passer des cas de référence approuvés indépendamment du code ?

- (a) Oui, résultats personnels non activables avant ces preuves. — défaut proposé
- (b) Fournir un dossier de validation équivalent avec ses critères documentés.

Bloque : Fiabilité annoncée des métriques et stress réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-068 — question 2

[S-068](plans/S-068.plan.md) · Les méthodes et calibrations doivent-elles passer des cas de référence approuvés indépendamment du code ?

- (a) Oui, résultats personnels non activables avant ces preuves. — défaut proposé
- (b) Fournir un dossier de validation équivalent avec ses critères documentés.

Bloque : Fiabilité annoncée des calculs réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.029

### S-022 — question 2

[S-022](plans/S-022.plan.md) · Limiter les suites immédiates à information/demande accompagnée, tout transfert exigeant une autorisation et un dossier distincts ?

- (a) Oui, aucune instruction de transfert automatique — défaut proposé
- (b) Fournir un processus de transfert déjà validé

Bloque : Actions après avoir identifié

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-052 — question 1

[S-052](plans/S-052.plan.md) · En l'absence de règle officielle complète pour une caisse, faut-il bloquer ses options réelles et demander les pièces ?

- (a) Oui, garder uniquement l'exemple fictif et ouvrir une demande documentaire. — défaut proposé
- (b) Limiter explicitement les options à un sous-ensemble documenté et validé.

Bloque : Calcul réel de rente partielle, mix et prestations survivants.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-060 — question 1

[S-060](plans/S-060.plan.md) · Garder Lombard exclusivement comme scénario sans prêteur ni capacité de tirage, jusqu'à validation des conditions et du périmètre ?

- (a) Oui, aucun crédit disponible ni exécution dans cette roadmap Retire. — défaut proposé
- (b) Définir séparément un périmètre de crédit avec prestataire et autorisations explicites avant toute extension.

Bloque : Commercialisation des scénarios Lombard réels ; toute exécution de crédit.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-074 — question 1

[S-074](plans/S-074.plan.md) · Quelles sources de caisse, survivants, longévité et EMS utiliser avant les résultats réels ?

- (a) Fournir/autoriser des documents et datasets officiels datés, puis validation métier par périmètre ; aucun fournisseur choisi implicitement. — défaut proposé
- (b) Valider explicitement un prestataire de données et son périmètre avant connexion.

Bloque : Accès réel aux données LPP/Life/EMS et conditions Lombard.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-068 — question 1

[S-068](plans/S-068.plan.md) · Quelles sources de caisse, survivants, longévité et EMS utiliser avant les résultats réels ?

- (a) Fournir/autoriser des documents et datasets officiels datés, puis validation métier par périmètre ; aucun fournisseur choisi implicitement. — défaut proposé
- (b) Valider explicitement un prestataire de données et son périmètre avant connexion.

Bloque : Accès réel aux données LPP/Life/EMS et conditions Lombard.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-113 — question 2

[S-113](plans/S-113.plan.md) · Quel usage professionnel autoriser des sources LPP et contraintes financières ?

- (a) Analyse et proposition documentées, seules sources et règles validées utilisables, aucune exécution financière — défaut proposé
- (b) Analyse sur sous-périmètre validé explicitement, autres options bloquées tant que preuves manquent

Bloque : Présentation de résultats crédibles et recommandations dans Intelligence.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-070 — question 1

[S-070](plans/S-070.plan.md) · N'activer que les domaines LPP/EMS/Lombard couverts par une validation humaine documentée et datée ?

- (a) Oui, blocage ciblé si preuve absente ; aucune validation déduite du code. — défaut proposé
- (b) Fournir un dossier de validation existant avec périmètre et responsables identifiés.

Bloque : Commercialisation et recommandations personnelles Retire.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.030

### S-051 — question 3

[S-051](plans/S-051.plan.md) · Les prix source doivent-ils rester des fixtures tant que TVA, annulation et contenu vendable ne sont pas approuvés ?

- (a) Oui, checkout explicitement simulé jusqu'à S-069/S-073. — défaut proposé
- (b) Valider un catalogue commercial complet avant une activation réelle.

Bloque : Vente réelle et règles de taxe/annulation.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-064 — question 2

[S-064](plans/S-064.plan.md) · Valider renouvellement, grâce impayé, résiliation et conditions de Care avant un abonnement réel ?

- (a) Oui, cycles fixtures tant que ces conditions manquent. — défaut proposé
- (b) Fournir les conditions complètes à appliquer dans Stripe.

Bloque : Abonnement réel et effets financiers des transitions.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-063 — question 1

[S-063](plans/S-063.plan.md) · Avant activation Strategy, faire approuver nombre/durée de rendez-vous, livrable expert, annulation, TVA et facturation ?

- (a) Oui, garder le service fictif jusqu'à conditions complètes validées. — défaut proposé
- (b) Fournir les conditions de service approuvées avant activation.

Bloque : Exécution et vente réelles de Strategy.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-066 — question 1

[S-066](plans/S-066.plan.md) · Définir avant vente la durée, le livrable, l'annulation et la facturation de Review séparément de Care ?

- (a) Oui, maintenir une revue fixture tant que les conditions manquent. — défaut proposé
- (b) Fournir des conditions approuvées et le périmètre du service.

Bloque : Prestation et paiement Review réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-069 — question 1

[S-069](plans/S-069.plan.md) · Les conditions commerciales complètes doivent-elles être validées avant toute configuration live ?

- (a) Oui, intégrer/tester d'abord Stripe test, puis n'activer que le catalogue approuvé. — défaut proposé
- (b) Fournir le catalogue et conditions live déjà approuvés avant cette slice.

Bloque : Prix vendables, TVA, annulation, remboursement et facturation réels.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-073 — question 1

[S-073](plans/S-073.plan.md) · Autoriser le catalogue live uniquement pour offres et conditions effectivement validées ?

- (a) Oui, activation circonscrite après preuves et identifiants live autorisés ; aucune vente implicite pendant les tests. — défaut proposé
- (b) Attendre une ouverture simultanée de toutes les offres validées.

Bloque : Encaissements live et ouverture commerciale.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## bible.question.031

### S-071 — question 1

[S-071](plans/S-071.plan.md) · Comment activer distribution/employeurs/white-label et éventuelle fidélité Retire ?

- (a) Accords et barèmes explicites validés, aucune commission/Miles/remise par défaut ; fixtures jusque-là. — défaut proposé
- (b) Fournir des accords approuvés couvrant chaque canal et ses conditions.

Bloque : Règles commerciales, droits distributeurs et gains/rewards.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

### S-073 — question 2

[S-073](plans/S-073.plan.md) · Quels canaux ouvrir après les essais sur cas réels ?

- (a) Seulement partenaires/employeurs/API/white-label couverts par accords et scopes approuvés. — défaut proposé
- (b) Conserver tous les canaux fermés jusqu'à un lancement conjoint validé.

Bloque : Activation réelle de la distribution et de ses règles commerciales.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## project.auth-methods

### S-000b — question 2

[S-000b](plans/S-000b.plan.md) · Si les méthodes constatées diffèrent du parcours email/OTP, quel changement appliquer ?

- (a) Configurer le parcours email/OTP et MFA admin dans cet environnement de test après présentation du diff — défaut proposé
- (b) Conserver les méthodes actuelles et faire valider une modification du parcours source avant intégration

Bloque : Modification WorkOS des méthodes ou callbacks, seulement si un écart réel est constaté.

Autorisation : Mandat utilisateur du 2026-09-05 : enchaînement et choix des meilleurs défauts autorisés — roadmap/execution-policy.md. Réponse : enregistrée ci-dessous.

- `project.auth-methods` · Si les méthodes constatées diffèrent du parcours email/OTP, quel changement appliquer ? → **Option a : si un écart est réellement constaté, préparer et présenter le diff exact des méthodes et callbacks pour configurer email/OTP et MFA admin dans l’environnement de développement identifié. Conserver les configurations sans rapport avec ce parcours.** · preuve : Callback exact, Magic Auth, homepage www et MFA Optional enregistrés et relus après confirmations utilisateur. Le callback réel confirme que l’issuer de l’access token est distinct de la découverte OIDC ; normalisation locale bornée corrigée. Aucun facteur Authenticator ni droit admin attribué. Détails : roadmap/evidence/S-000b.md.

## project.documents.local-processing

### S-042a — question 1

[S-042a](plans/S-042a.plan.md) · Quel traitement pour la première ingestion réelle ?

- (a) API OpenAI pour OCR/classification/extraction et futures capacités IA ; antivirus et stockage privés locaux — défaut proposé
- (b) Moteurs de lecture exclusivement locaux

Bloque : Choix effectif des moteurs

Autorisation : Demande explicite utilisateur du 6 septembre 2026 : mobile Wallet puis conservation de tous les documents déposés, y compris identité, classification et extraction profil ; choix locaux délégués PROG-23, aucune validation juridique déduite.. Réponse : enregistrée ci-dessous.

- `project.documents.local-processing` · Quel traitement pour la première ingestion réelle ? → **API OpenAI pour OCR/classification/extraction et futures capacités IA ; antivirus et stockage privés locaux** · preuve : Instruction utilisateur pendant S-042a : Pour la lecture OCR et toutes les fonctionnalités dont nous aurons besoin de l’IA d’ailleurs on peut utiliser l’API de chatgpt. Remplace le choix exclusivement local antérieur ; documentation officielle Responses/file inputs/structured outputs/your-data consultée le 6 septembre 2026.

## project.git-push

### S-000c — question 2

[S-000c](plans/S-000c.plan.md) · Publier le commit testé sur origin et activer le pipeline préparé ?

- (a) Autoriser le premier push normal du commit revu vers main — défaut proposé
- (b) Conserver les commits locaux jusqu’à instruction explicite

Bloque : Premier push uniquement si l’autorisation n’est pas encore acquise.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## project.hosting-target

### S-000c — question 1

[S-000c](plans/S-000c.plan.md) · Quel projet/région, quelles nouvelles ressources et quelle URL de test approuver après l’inventaire ?

- (a) Présenter et autoriser le plan minimal de ressources dédiées et un sous-domaine isolé de coverview.ch — défaut proposé
- (b) Indiquer un autre dimensionnement ou sous-domaine dans le même cloud

Bloque : Provisioning, coût et DNS ; aucune instance déjà présente ne devient réutilisable.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## project.legal-review

### S-137 — question 1

[S-137](plans/S-137.plan.md) · Quelle personne habilitée valide les textes et les activations concernées ?

- (a) Faire valider une matrice de textes/version/parcours par les responsables juridique et métier désignés — défaut proposé
- (b) Réutiliser des textes déjà validés avec preuve de leur périmètre applicable

Bloque : Publication juridique et commerciale, pas création des écrans fictifs.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## project.recovery

### S-132 — question 1

[S-132](plans/S-132.plan.md) · Quels objectifs de reprise et quelles cibles dédiées utiliser ?

- (a) Mesurer sur environnement isolé puis faire approuver RPO/RTO et fréquence de sauvegarde avant production — défaut proposé
- (b) Fournir les objectifs opérationnels déjà convenus

Bloque : Engagements de disponibilité, fréquence/stockage facturables et campagne distante.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## project.release

### S-140 — question 1

[S-140](plans/S-140.plan.md) · Autoriser l’ouverture du commit testé et des capacités validées sur coverview.ch ?

- (a) Approuver le manifeste, le diff DNS et les seules ressources dédiées après la recette complète — défaut proposé
- (b) Conserver l’environnement de test privé jusqu’à une date d’ouverture choisie

Bloque : Ouverture publique, DNS final et activation commerciale effective ; l’autorisation de planifier ne vaut pas lancement.

Autorisation : aucune enregistrée. Réponse : **non enregistrée**.

Aucune réponse à cette question exacte.

## project.workos

### S-000b — question 1

[S-000b](plans/S-000b.plan.md) · Quel environnement et quelles identités WorkOS utiliser pour vérifier les flux réels ?

- (a) Utiliser l’environnement de développement du projet coverview et des identités de test explicitement autorisées — défaut proposé
- (b) Fournir un autre environnement isolé et les identités autorisées

Bloque : Connexion tierce et attribution administrative ; un nom de projet ne vaut pas client ID.

Autorisation : Mandat utilisateur du 2026-09-05 : enchaînement et choix des meilleurs défauts autorisés — roadmap/execution-policy.md. Réponse : enregistrée ci-dessous.

- `project.workos` · Quel environnement et quelles identités WorkOS utiliser pour vérifier les flux réels ? → **Option a : utiliser l’environnement de développement du projet coverview et des identités de test explicitement autorisées. Identifier d’abord cet environnement en lecture seule ; ne déduire aucun client ID, compte autorisé ou droit administratif du nom du projet.** · preuve : WorkOS coverview/LocalHost et deux emails réels explicitement autorisés. Le 2026-09-06, callback réparé puis comptes BMP et Hook réellement connectés et persistés ; isolation croisée, continuité et révocations vérifiées. Habilitation administrative encore absente. Détails : roadmap/evidence/S-000b.md.
