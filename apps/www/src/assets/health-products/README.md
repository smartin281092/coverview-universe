# Illustrations des modèles d'assurance

Packagings conceptuels créés avec l'outil intégré imagegen à la demande de l'utilisateur, à partir de son image `MediTel Health Insurance Product Display.png` (1 octobre 2026). Ce ne sont pas des packagings officiels ni des preuves de prestations.

La composition reprend le coffret en perspective, sa tranche, les surfaces géométriques ton sur ton, le fond blanc, les ombres de studio et les accessoires de la référence. Les palettes et logos viennent des actifs officiels voisins dans `../health-insurers/`, dont la provenance est conservée. Les mentions se limitent à la marque, au nom exact du modèle et à « Assurance maladie de base ».

Un actif WebP par identifiant de modèle, indépendamment de la prime, de la franchise et de l'accident. `HealthProductImage` sert le même actif en fiche et dans le checkout. Import à URL locale ; aucun chargement de logo ou d'image sur un site tiers. Les dimensions de présentation sont réservées pour éviter les sauts de mise en page.

L'inventaire, la couverture effective et les SHA-256 sont dans `manifest.json`. Les prompts utilisés et leurs références sont dans `prompts.json`. Les contrôles visuels sont consignés dans `roadmap/evidence/health-product-packaging.md`. Ne pas confondre image disponible et condition médicale vérifiée.

Pour préparer un actif déjà généré, depuis la racine : `node scripts/health-packaging-assets.mjs <modelId> <pngSource>`. Le script exporte en WebP de 768 px sans retouche de contenu. Pour reproduire une image, utiliser le prompt correspondant avec l'outil intégré imagegen et les références indiquées ; ce script ne lance aucune API de génération.
