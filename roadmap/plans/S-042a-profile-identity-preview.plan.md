# S-042a — Profil et prévisualisation des pièces d’identité

Extension autorisée par la demande utilisateur du 8 septembre 2026 et le mandat d’autonomie de `roadmap/execution-policy.md`. S-042a reste la seule slice en cours ; cette extension ne clôture pas ses autres critères.

## Objectif et décisions

- Ajouter numéro AVS et profession, facultatifs, aux données générales des personnes (titulaire et profils gérés), avec persistance canonique et consommateurs Admin cohérents.
- Associer une pièce d’identité séparément à chaque profil, avec originaux privés existants et nouvelle association persistante. L’association titulaire reste partagée avec procuration et mandat de gestion. Aucun droit familial, pouvoir de signature ou statut KYC n’en découle.
- Reconnaître carte d’identité, passeport ou permis de séjour depuis une preuve OCR disponible, jamais depuis le nom du fichier ; permettre une correction explicite du type. Le passeport ne nécessite qu’une page, les autres pièces acceptent un document combiné ou deux faces. Une détection inconnue reste inconnue.
- Ajouter la pièce en bas de la page du profil. Un clic ouvre les originaux ensemble, disposés selon les proportions et l’écran, avec zoom tactile/molette, déplacement, téléchargement et fermeture.
- Précision utilisateur reçue pendant l’implémentation : conserver la segmentation au maximum, sans récapitulatif concentrant les champs. Générales/Finances/Santé et leurs étapes restent ; la dernière étape devient Validation avec confirmation et choix associés, sans répétition de toutes les valeurs. Les données et la garde de sortie sont conservées.

## Périmètre et sécurité

Contrats profil/document, API identity/document-intelligence et repositories, client API, Wallet profil/autorisations, champs Admin consommateurs. Routes existantes compatibles (`self` par défaut), validation stricte, autorisation du propriétaire et du profil, révision et idempotence. Migration additive seulement, originaux conservés. Les médias privés restent en mémoire ; annulation réseau et révocation des URL blob à la fermeture/changement de portée, portail à l’intérieur de la frontière privée.

Règles chargées : frontend, design, i18n, contrats, données, API, stockage, sécurité/permissions, environnement, livraison/programme. Les agents spécialisés lisent les satellites de leur périmètre. Aucune dépendance ni nouveau fournisseur prévu. Hors périmètre : déploiement/DNS, signature et validation juridique, création de documents fictifs de recette, suppression d’originaux existants.

## Vérification attendue

1. AVS/profession : validation, sauvegarde/relecture/effacement, isolation entre personnes ; tests de persistance réels adaptés au risque.
2. Association : compatibilité titulaire, profils distincts, refus de document étranger ou d’un autre profil, conflits/répétitions, type déclaré/détecté, passeport une page, suppression/quarantaine sans faux statut prêt.
3. Wallet : champs et pièces visibles pour le profil sélectionné ; même comportement de pièce dans procuration et mandat ; pas de mutation de données réelles pour une simple vérification visuelle.
4. Visionneuse : disposition responsive, clavier/Échap/focus, zoom molette/pincement et drag, originaux téléchargeables inchangés, fermeture et confidentialité.
5. Types/lint/build/frontières ciblés puis recette navigateur réelle sur les données disponibles. Les gestes ou documents non accessibles seront explicitement distingués des vérifications effectuées.

## Journal et ledger

Implémentation intégrée au commit `14c6aa4`, migration additive 0012 appliquée en local sans reset, API et preview synchronisées. Le [ledger de cette extension](../evidence/profile-identity-preview.md) conserve les oracles et leurs limites : types/lint/build/frontières, 9 tests PostgreSQL, 9 tests client HTTP et 300 cas de géométrie passés ; profils titulaire/personne gérée, Validation, passeport mobile et présence de la pièce dans les deux autorisations observés en navigateur réel.

Les images privées réelles, gestes tactiles physiques, lecteur PDF natif et nouvelle reconnaissance OCR restent non vérifiés en parcours réel. Aucun document de recette fictif ni consentement n’a été ajouté au compte. S-042a reste la seule slice en cours ; ses autres critères ne sont pas clos par cette extension.

## Extension société — demande utilisateur suivante

Pour une société, remplacer la pièce d’identité par l’extrait du registre du commerce, y compris le dépôt et la prévisualisation. Un fichier du profil société contient l’extrait complet ; aucun choix de passeport ou de recto-verso. Le serveur détermine le type de profil et conserve les exigences d’identité des personnes, l’isolation, les originaux, les contrôles de téléchargement et les états de quarantaine/suppression. L’association est une déclaration du propriétaire, sans preuve juridique ni classification artificielle. Aucune migration ou nouvelle forme de contrat public ; [preuves et limites](../evidence/profile-identity-preview.md#extrait-du-registre-du-commerce-pour-les-sociétés).

## Retrait de Validation — dernière précision utilisateur

La demande explicite suivante remplace la décision initiale de conserver une étape Validation : la retirer de toutes les rubriques des profils. Conserver les deux étapes contenant les champs, terminer par Enregistrer et calculer chaque rubrique sur leur moyenne. Les anciens liens et états `review` ouvrent la deuxième étape ; conserver les contrats et preuves historiques, sans migration destructive. Le choix facultatif de préremplissage du titulaire et son historique restent à la fin d’Adresse, sans activation implicite. Vérifier les calculs persistés, l’isolation, les types/builds et la navigation réelle ; [journal de vérification](../evidence/profile-step-donuts.md).
