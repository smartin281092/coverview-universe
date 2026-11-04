# Logo Hyperion

- `hyperion-logo-original.png` : le logo fourni par l’utilisateur le 4 novembre 2026 (PNG 1254 × 1254, noir sur blanc), copié sans retouche ; empreinte et pièce jointe d’origine dans `provenance.json`.
- `logo.svg` : sa vectorisation, dessinée à partir de la géométrie mesurée pixel par pixel dans l’original : quatre crochets à pans coupés à 45° (demi-côté 282, trait 57, pan coupé 117, demi-ouverture 69) et un astérisque de quatre barres de 300 × 50 à 45° les unes des autres, dans un repère centré ; idéalisation symétrique (l’original mesure 568 × 560 px). Recouvrement avec l’original : 95,2 % (indice de Jaccard), les écarts se limitant à des bandes de 1 à 3 px sur les bords, dues à l’anticrénelage et à l’asymétrie de l’original. Un seul `path` sans attribut de remplissage : la couleur vient de la CSS quand il est inliné.

`components/hyperion/hyperion-logo.ts` lit ce SVG au build ; `HyperionLogo.astro` l’inline (héros, clôture) et `HyperionIllustration.astro` le pose en blanc sur le coffret. Ne pas modifier `logo.svg` à la main : remesurer depuis l’original et consigner les nouveaux paramètres ici.
