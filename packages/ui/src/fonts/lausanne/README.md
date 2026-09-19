# Lausanne

Police principale de toutes les interfaces via `--cv-font-sans` : [ADR-0009](../../../../../adr/0009-lausanne.md).

Huit WOFF2 originaux, copiés sans conversion depuis le [téléchargement Ramp](../../../../../references/ramp-fonts/README.md) : poids 300, 350, 400, 700, romains et italiques. Les URL et SHA-256 sont conservés dans [sources.json](../../../../../references/ramp-fonts/sources.json).

`fonts.css` déclare chaque face avec son poids exact et `font-display: swap`. Vite/Astro résolvent les URL locales et produisent des assets hachés auto-hébergés. Le navigateur charge les variantes nécessaires à la page. Les poids CSS 500 et 600 sélectionnent respectivement les faces 400 et 700 ; aucun poids variable n’est déclaré.
