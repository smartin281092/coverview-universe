# Présentation et illustrations des modèles d’assurance

Mandat utilisateur du 1 octobre 2026 ; plan : `roadmap/plans/health-product-packaging.plan.md`. Application : WWW, fiche du modèle et parcours de demande d’offre. Autorisation autonome PROG-23, audit visuel indépendant borné selon CDX-05. Session Codex GPT-6, effort non exposé par l’environnement.

## Interface — vérifiée

- Pastilles Prestations et Club issues du même catalogue chargé et du même filtre que leurs listes. Pas de zéro artificiel pendant le chargement. La requête est annulée lors d’un changement de contexte.
- Logo puis nom du modèle ; suppression du nom de compagnie redondant. Illustration au-dessus du prix ; badge « Le moins cher » à droite du bloc du prix.
- Même illustration dans les premières étapes du checkout et dans les lignes du panier. Aucun changement de prix, de classement ou de transition métier.
- Suppression du libellé répétitif « À contrôler pour cette année ». Les conditions incertaines restent identifiées dans les détails ; leur statut contractuel n’a pas été transformé en prestation confirmée.

Oracles : contrôle navigateur de PharMed/Assura et HMO/Atupri, sur bureau 1280×720 et viewport mobile 390×844. PharMed : 0 prestation, 5 Club et 5 lignes. HMO : 1 prestation, 0 Club et une ligne ; détail conditionnel encore accessible. Badge tarifaire à droite, nom sous logo, image en fiche et miniature de 78 px visibles dès le choix invité/Wallet. Pas de débordement horizontal mobile ni d’erreur console observée. Aucun compte ni demande créé pendant la recette ; les onglets temporaires ont été fermés. Le tactile matériel n’a pas été testé.

## Illustrations — couverture vérifiée

Inventaire et actifs : 167/167 modèles couverts, soit 153 modèles suisses et 14 identifiants frontaliers, 32 assureurs. Source : catalogue 2027 du comparateur, rapproché des logos officiels déjà présents. Les noms exacts et les couleurs sont consignés dans `apps/www/src/assets/health-products/manifest.json`. Les 167 prompts sont dans `apps/www/src/assets/health-products/prompts.json`.

Génération avec l’outil intégré imagegen à partir de l’image MediTel fournie et du logo de chaque compagnie. Une photographie conceptuelle par identifiant de modèle : coffret en perspective, facettes ton sur ton, fond blanc, ombres et accessoires médicaux. Aucun texte de prestation ni promesse contractuelle ajouté. Ces illustrations ne constituent pas des packagings officiels.

Export WebP 768×768 avec la dépendance Sharp déjà présente ; aucune nouvelle dépendance, clé ou API externe. Les 167 images totalisent 5 575 634 octets (environ 33 Ko par modèle) ; chaque dimension et empreinte a été vérifiée lors de la constitution du manifeste. Les fichiers sont locaux et servis par WWW. Les prompts et les empreintes permettent de retrouver chaque génération. Le script d’export n’effectue que la compression et le dimensionnement.

## Vérifications techniques

- **Vérifié** : typecheck WWW, 82 fichiers sans erreur ni avertissement ; ESLint ciblé sur les composants, le contenu et le script d’export.
- **Vérifié** : manifeste final, 167 images 768×768 et 167 prompts ; build WWW terminé avec 45 pages ; diff ciblé sans erreur d’espacement.
- **Vérifié** : contrôle visuel des 167 actifs, dont les 14 frontaliers. 154 sans observation, 13 avec observation secondaire, aucun rejet. Rapport nominatif et empreintes : `roadmap/evidence/health-product-packaging-visual-review.json`.

Les observations secondaires sont quatre contrastes atténués (Aquilana BASE, Einsiedler BASE, CONCORDIA MyDoc, KKV Medicasa) et les neuf compositions sana24. Pour sana24, le nom est exact et lisible, mais le wordmark est une interprétation sous l’arc du groupe Visana ; l’actif source officiel est celui de Visana après redirection de sana24.ch. Sa fidélité à un logo officiel sana24 distinct n’est pas certifiée. Ces variantes conceptuelles sont conservées ; elles ne servent pas de remplacement aux logos officiels du header.

Le build conserve l’avertissement Vite sur des chunks dépassant 500 Ko, déjà présent avant cette évolution. Aucune règle de contrôle n’a été désactivée. Pas de nouveaux tests unitaires pour ces modifications de présentation : recette réelle et contrôles ciblés des actifs.

Les 167 fichiers ont également été retrouvés dans la sortie `_astro` du build. Le formatage Prettier de tous les fichiers de cette modification est conforme.

## Frontières et limites

Pas de modification serveur, migration, variable d’environnement, rôle, permission, événement, room ou job. Aucun profil de santé n’est transmis à la génération d’images ; seuls marque, modèle, palette et références visuelles sont utilisés. Aucun envoi réel d’offre. Aucun déploiement ni push. Les travaux préexistants Admin/API/Wallet/WWW hors de ce périmètre restent hors du commit.

La revue visuelle vérifie lisibilité, identité, palette et cadrage ; elle ne certifie pas une reproduction du logo au pixel près. Les données de prestations et les conditions de l’année conservent leur statut de vérification métier existant. Les modèles ajoutés ultérieurement devront recevoir leur propre actif ; le composant masque une image manquante au lieu d’en attribuer une autre.
