# Landing 3a premium — livraison du 19 septembre 2026

Mandat utilisateur : créer la landing à partir du guide joint, avec direction premium Ramp/Awesomic, carte Wallet en 3D, chiffres et illustrations animés. [Plan et décisions](../plans/landing-3a-premium.plan.md). Session réelle : GPT-6, effort non observable indépendamment.

## Pages annexes et miroirs — 22 septembre

Mandat complémentaire : reprendre les pages destinées aux prospects, à commencer par `/etudes-de-cas/maintien`, et supprimer les mentions de fabrication éditoriale dans tous les contenus et Markdown publics. Session : GPT-6, effort non observable indépendamment.

| Élément | Statut | Preuve |
| --- | --- | --- |
| Textes publics | Vérifié | Cas, rapport, sources, fondateur, FAQ, outils, services, retraite, pages d’orientation et libellés partagés relus. Suppression des notes de validation et d’origine automatique. Les sources internes restent dans le frontmatter et ne sont plus émises comme citations publiques. |
| HTML et Markdown cohérents | Vérifié | `check-www` : 41 pages, 18 miroirs, 71 entités structurées, 1068 liens, 94 ancres, zéro page orpheline. Contrôle supplémentaire d’absence des notes internes sur les 60 fichiers HTML/MD générés, 404 comprise. |
| Disponibilité réelle | Vérifié dans le contenu | Accès libre aux simulateurs, connexion requise pour Wallet ; les parcours futurs restent qualifiés. Aucun formulaire ni nouveau service opérationnel ajouté. |
| Exemples et preuves | Vérifié | Cas et rapport toujours fictifs, schéma inchangé, quatre tests existants réussis. Résultats clients et vue historique rétrospective distingués. La page de modèles emploie des critères de choix plutôt qu’un classement non étayé des professionnels. |
| Qualité technique | Vérifié | Astro Check : 55 fichiers, zéro erreur/avertissement ; ESLint ciblé ; build 42 pages ; `git diff --check` sur le périmètre. Logs locaux `.preview/editorial-build.log` et `.preview/editorial-check-www.json`. |
| Lecture réelle | Vérifié | Cas de maintien inspecté dans le navigateur, grand écran puis 390 px ; aucun débordement du document. Tableau des critères à deux colonnes contrôlé à 390 px, défilement limité à sa région. Taille restaurée. |

L’exécution simultanée du build et du lint a rencontré la pression mémoire virtuelle Windows. Après diagnostic, exécution séquentielle : build avec un thread Rayon et plafond Node de 512 Mo, lint avec 768 Mo (256 Mo était insuffisant), contrôles avec 512 Mo. Aucun seuil de qualité, schéma ou test existant n’a été abaissé. Le nouvel oracle ajoute uniquement le contrôle des notes internes ; le total réduit des entités structurées reflète le retrait des citations du document de travail, pas une suppression d’Article, Person ou FAQ.

Périmètre : `www`, oracle, README, plan et ledger dédiés. Aucune dépendance, donnée persistée, migration, permission, événement, room, job ou variable d’environnement durable ajouté. Backend, Wallet, Admin et roadmap de la slice concurrente préservés. Le contrôle du dépôt connecté n’a pas été répété. Preview et index vides restent inchangés ; aucune publication ni hausse de conversion mesurée revendiquée. Consigne éditoriale conservée dans le README www. Suite éventuelle : branchement du contact réel dans son mandat existant, sans le lancer dans cette tâche.

## Révision du 22 septembre — captures, indépendance et rapport retraite

- **Copywriting conversion/réassurance vérifié :** nouvelle demande utilisateur appliquée aux textes du hero, du rapport, des simulateurs, de la méthode, des résultats, de Wallet, de la FAQ, du CTA final et du dialogue d’entrée. Voix directe de CoverView, bénéfices concrets et libre décision ; plus de « selon le fondateur » ni de notes de recette publiques. Accès sans compte clairement limité aux simulations et connexion Wallet annoncée avant le clic. Les périodes, le caractère illustratif des exemples et les risques restent lisibles. Préférence durable précisée dans le README.
- **Recette de cette révision :** aperçu rechargé, contenu public et dialogue des performances contrôlés, entrée Wallet/simulation vérifiée à 320 px sans débordement, viewport normal restauré. ESLint ciblé, `git diff --check`, build et `check-www` passent ; FAQ HTML/JSON-LD cohérente, 41 pages contrôlées. LCP synthétique local 252 ms, CLS 0,0121, JS 2804 octets gzip. Première compilation interrompue par manque de mémoire virtuelle Rolldown ; seconde compilation réussie avec `RAYON_NUM_THREADS=1` limité au processus et restauré après exécution. Aucun seuil ni oracle modifié. **Non mesuré :** effet commercial sur la conversion, aucun test sur trafic réel effectué.

- **Correction éditoriale vérifiée :** à la demande de l’utilisateur, retrait de « Les frais inclus ne sont pas précisés dans les captures » et reformulation des commentaires de travail similaires (informations non fournies, avis du fondateur, contrôle des sources) dans les textes publics. Les observations de vérification restent dans ce ledger et la provenance interne. Les périodes, la distinction rétrospective/rendement affiché et les mentions de risque sont conservées. Contrôle du texte effectivement rendu dans le navigateur, ESLint ciblé et `git diff --check` réussis. Préférence enregistrée dans le README du site.

- **Vérifié :** sept pièces jointes copiées sans retouche, empreintes enregistrées. Les trois chiffres principaux reprennent 32,27 %, 29,78 % et 32,29 %, sans changer leur période. Le dialogue contient aussi les vues 36,30 %, 32,37 %, 31,01 % et History. Les chiffres restent présents dans le HTML initial ; leurs compteurs conservent deux décimales après animation. PNG locaux transformés en WebP par Astro, sans service externe.
- **Vérifié :** la mention explicite de la première capture est respectée : History simule l’allocation actuelle sur des données historiques. Les 21,34 % p.a. et 295,40 % cumulés ne sont pas présentés comme des rendements réalisés par un client. Pas de dates d’arbitrage, de frais, de nombre de clients distincts, de moyenne ou de causalité déduits des graphes. Les liens de provenance sont dans le manifeste local des captures.
- **Fait non vérifié indépendamment :** statut de courtier indépendant non lié et accompagnement des clients déclarés par l’utilisateur. Le contenu reprend cette source, sans prétendre avoir vérifié l’inscription au registre. [Terminologie officielle consultée](https://www.finma.ch/fr/autorisation/intermediation-dassurance/). La vocation de rechercher les meilleures solutions adaptées n’est pas un classement garanti du marché.
- **Vérifié :** aperçu du rapport remplacé par deux exemples pédagogiques distincts : 1’080’000 CHF / (30 × 12) = 3’000 CHF par mois ; 442’800 CHF / (300 × 12) = 123 ans. Égalités contrôlées par Node assert. Capital initial nul, rendement net nul, absence d’inflation/fiscalité et caractère hypothétique des capitaux cibles explicités. Les exemples ne sont pas attribués à un client ; l’analyse réelle nécessite budget, rentes, avoirs et horizon. Aucun moteur de retraite ni nouveau parcours de collecte livré.
- **Vérifié :** rendu à 1440, 390 et 320 px ; pas de débordement horizontal des cartes, du rapport ou du dialogue. Ouverture des deux dialogues, Échap, focus initial sur Fermer puis retour au bouton d’origine. Les sept captures sont consultables, dont la vue History en bas du dialogue. En pause : dialogues visibles (opacité 1) et animations des images désactivées (`animation-name: none`). Taux des simulateurs conservés à 2 % et 16 %. Viewport normal et animations restaurés ; console sans erreur ni avertissement.
- **Vérifié :** ESLint ciblé, Astro Check sur 55 fichiers (zéro erreur/avertissement), build 42 pages et `check-www` réussis. 41 pages HTML, 1065 liens, 102 ancres, zéro page orpheline. Accueil : 2804 octets JS gzip, LCP synthétique local 236 ms, CLS 0. Même protocole et mêmes seuils ; aucune adaptation de l’oracle pour cette révision. Une erreur de typage initiale sur la correspondance des images a été corrigée par clés littérales exhaustives, sans assertion non-null ni relâchement des contrôles.
- Périmètre : `www`, assets et documentation dédiée. Pas de modification API/Wallet/Admin, de dépendance, de migration, de publication ou d’envoi des captures à un tiers.

## Révision utilisateur — roue compacte, seize marques et titre sur deux lignes

- **Vérifié :** le H1 forme deux lignes aux largeurs 1519, 1024, 390 et 320 px. La grille accorde davantage d’espace au texte, avec taille de police adaptée. La roue est réduite uniformément en 3D et inclinée à −19° sur Z et −35° sur X ; les seize cartes sont espacées sur une même couronne.
- **Vérifié :** ajout de Pax, Liechtenstein Life, Finpension, VIAC, UBS, Swissquote, La Mobilière, Swiss Life, Raiffeisen, Zurich et Retraites Populaires. CSS, Helsana et Assura ne sont plus importés ; Baloise est remplacé par le [nouveau logo officiel Helvetia](https://www.helvetia-baloise.com/corporate/hb/en/home/news-stories/publications/media-releases/2026/20260205.html). Les quatre autres marques existantes restent dans la roue. Sources et empreintes conservées dans le manifeste des assets.
- **Vérifié :** les dix-sept images des seize marques chargent localement, dont les deux fichiers du logo Swissquote. Inspection visuelle bureau, tablette et mobile sans débordement horizontal. Rotation et atténuation des logos en arrière-plan conservées.
- **Vérifié :** ESLint ciblé, Astro Check (51 fichiers, zéro erreur/avertissement), build (42 pages) et `check-www` passent. Accueil : 2797 octets JS gzip, LCP synthétique local 224 ms, CLS 0 ; 41 pages HTML, liens et index contrôlés. Même protocole local et mêmes limites de mesure que ci-dessous ; aucune modification de l’oracle pour cette révision.
- Périmètre : présentation de l’accueil, fichiers de marque locaux et documentation. Aucune dépendance, logique métier, API ou publication supplémentaire.

## Révision utilisateur — 16 %, Wallet, titres et couronne 3D

- **Vérifié :** scénario B à 16 % dans le HTML, la légende, la courbe et les recalculs ; plafond des taux à 20 %. Les valeurs initiales sont partagées entre SSR et script. À 300 CHF/mois pendant 30 ans : 2045374,1242 CHF pour B et environ 1897995 CHF d’écart avec A. Test de référence à 16 % et borne à 20 % réussis ; trois tests au total.
- **Vérifié :** titres de la landing rendus par `TitleText.astro`, seconde phrase ou suite du premier saut de ligne en `lab(2.83994 0.367254 0.969091 / 0.6)`. Couleur calculée contrôlée dans le navigateur pour les onze grands titres concernés. Le bloc stratégie passe sur fond clair et conserve son illustration sombre pour garantir la lisibilité de cette teinte.
- **Vérifié :** objectif Wallet enrichi dans la section dédiée : centraliser, comprendre et analyser les contrats avec rigueur, en fonction de la situation personnelle. La carte membre animée reste dans cette section.
- **Vérifié :** hero remplacé par huit logos existants en couronne CSS 3D, inclinée sur deux axes. La rotation et l’opacité sont synchronisées par le même angle, de 12 % derrière à 100 % devant. Les huit images se chargent localement ; provenance conservée dans `apps/www/src/assets/companies/provenance.json`. Aucun partenariat revendiqué. La pause fige l’angle (101,026° observés à deux lectures), puis la rotation reprend ; aucune erreur/alerte console.
- **Vérifié :** inspection bureau, simulateur à 390 px et couronne à 320 px sans débordement horizontal. Modifier un versement conserve B à 16 % et un champ valide. Le viewport normal est restauré après la recette.
- **Vérifié :** lint ciblé, Astro Check (51 fichiers, zéro erreur/avertissement), build, trois tests et `check-www`. Résultats finaux : 2797 octets JS gzip sur l’accueil, LCP synthétique local 260 ms, CLS 0 ; liens, FAQ, indexation et dialogue en pause passent sans nouvelle adaptation des seuils. Les chiffres de la livraison initiale ci-dessous sont historiques.
- **Fait non vérifié :** la moyenne historique Hyperion citée par l’utilisateur n’a pas de série de rendements jointe. Les 16 % sont utilisés comme paramètre de simulation, sans ajout d’une performance historique certifiée au contenu. Aucun backend, dépôt documentaire, permission, job, migration, dépendance ou déploiement ajouté.

## Ledger de la livraison initiale

| Élément | Statut | Oracle et portée |
| --- | --- | --- |
| Accueil Astro complet, contenu français externalisé, nouvelle navigation | Vérifié | Build, Astro Check (49 fichiers, zéro erreur/avertissement), HTML initial et inspection dans le navigateur |
| Carte fournie en perspective, reflet, inclinaison au pointeur et lévitation ; graphiques, compteurs et scènes animés | Vérifié | Rendu bureau et mobile dans l’aperçu ; aucune bibliothèque supplémentaire ni service distant |
| Simulateurs de capitalisation et d’inflation | Vérifié | Trois tests Vitest des équations ; manipulation réelle des champs et curseurs ; taux nuls et synchronisation des paramètres |
| CTA vers un choix Wallet connecté / simulation sans compte | Vérifié | Ouverture et fermeture du dialogue, Échap et restauration du focus ; liens locaux vers les routes Wallet existantes |
| Pause des animations, FAQ et dialogue visible en mode pause | Vérifié | Recette navigateur ; régression automatisée dans `check-www` avec contrôle d’opacité |
| Responsive | Vérifié | Inspection à 1519 px, 390 px et 320 px ; absence de débordement horizontal ; calculateurs et dialogue utilisables |
| SEO et contenu statique | Vérifié | `check-www` : 41 pages contrôlées, 18 miroirs, 112 entités structurées, 1065 liens, 101 ancres, zéro page orpheline ; `noindex` et index publics vides conservés |
| Poids et stabilité du rendu initial | Vérifié | Mesure synthétique locale finale : accueil 2491 octets JS gzip, LCP 348 ms, CLS 0,0026 ; onze gabarits sous les seuils existants |
| Préférence système de réduction des mouvements | Fait non vérifié sur un OS réglé ainsi | Branches CSS/JS présentes et relues ; la pause manuelle équivalente a été exercée |
| Déploiement, acquisition anonyme complète, résultats clients et INP terrain | Fait non vérifié / hors périmètre | Aucun déploiement ni backend d’audit anonyme ajouté ; aucun résultat client, classement ou rendement réel revendiqué |

## Brief couvert

Les douze intentions du guide sont représentées : hero et entrée d’analyse ; compréhension du contrat ; intérêts composés ; inflation ; critères de comparaison ; méthode ; stratégie ; cas illustratif de maintien ; continuité au fil de la vie ; Wallet et liberté ; FAQ ; CTA final. Les preuves commerciales non fournies sont remplacées par une méthode explicite et un cas étiqueté illustratif. Les références visuelles consultées sont Ramp, Awesomic, Skiper37, Bklit, ShaderGradient et Animmaster ; leur style n’est pas une source d’affirmations métier.

La carte PNG fournie reste intacte. Astro la transforme en WebP de présentation (environ 10 et 16 Ko selon la taille), sans export vers un tiers. La 3D est réalisée par transformations CSS avec perspective, SVG et JavaScript local. Les fontes locales Lausanne/Montech sont conservées. Les styles de la landing sont isolés ; les autres pages et les thèmes Wallet/Admin restent inchangés.

## Calculs et recette

- Capitalisation : taux annuel effectif converti en taux mensuel ; versements investis en fin de mois. À 300 CHF/mois pendant 30 ans, 147379,0451 CHF à 2 % et 292353,8919 CHF à 6 %, soit environ 144975 CHF d’écart. Il s’agit de scénarios constants, sans garantie ; les frais, fiscalité et risques sont explicités dans les hypothèses.
- Inflation : `capital / (1 + inflation)^années`. 300000 CHF sur 30 ans à 4 % donnent environ 92496 CHF de pouvoir d’achat actuel ; le capital nominal n’est pas diminué par le calcul.
- Vérifications interactives : 600 CHF/mois, 30 ans et deux taux nuls donnent 216000 CHF pour chaque scénario et zéro écart ; inflation nulle conserve 300000 CHF. Une saisie de 357 CHF est conservée et synchronisée au curseur ; 2,37 % est ramené au pas affiché de 2,4 % à la sortie du champ.
- Les données de simulation restent dans la page : aucun stockage, événement de collecte, requête API ou tracker ajouté. Aucun dossier privé utilisé pendant la recette.

## Outillage et adaptations explicites (G-08)

L’oracle existant `scripts/check-www.mjs` supposait zéro script public hors `/account` et des questions FAQ dans des titres. Il autorise désormais exactement un module local sur l’accueil ; les autres pages éditoriales gardent zéro script. Les questions et réponses des FAQ natives sont comparées au JSON-LD, y compris lorsqu’elles sont repliées.

Le seuil JavaScript reste **100 KiB gzip**. Son application porte maintenant sur les scripts effectivement chargés par chaque gabarit représentatif, imports et scripts inline compris, conformément à MKT-06. Le total de tous les chunks émis est encore rapporté séparément (112287 octets gzip) : il comprend notamment des chunks React et compte qui ne sont pas chargés par la landing. Ce changement de mesure est déclaré, aucun seuil n’a été relevé. L’attente des images pour le rendu initial exclut les images lazy hors écran, qui attendaient sinon leur intersection indéfiniment. Une régression contrôle l’ouverture du dialogue avec les animations en pause.

Oracles finaux : ESLint ciblé, Astro Check, build Astro et `node scripts/check-www.mjs` réussis. Les trois tests mathématiques ont réussi. `git diff --check` sur le périmètre réussit. Les logs de travail sont dans `.preview/landing-build.log` et `.preview/landing-check-www.json` (artefacts locaux ignorés). La console navigateur inspectée ne signalait ni erreur ni avertissement.

Les mesures sont faites en Chromium headless, loopback, viewport 1280×900, sans ralentissement réseau, après chargement des polices/images puis observation de 750 ms. Elles ne représentent ni un réseau mobile réel ni du RUM. Les vues mobile ont été inspectées dans le navigateur de l’app, puis la taille normale et l’accueil ont été restaurés.

## Périmètre et limites

Application modifiée : `www`, plus son oracle et sa documentation. Aucune dépendance, migration, table, permission, room, événement, job ou variable d’environnement supplémentaire. `PUBLIC_WALLET_URL` existante est réutilisée ; défaut local 4101, repli `/account` en build sans origine configurée. Aucun changement du lockfile pour cette tâche. Les modifications préexistantes API/Wallet/Admin et de S-042a sont préservées.

L’audit documentaire complet sans compte est absent ; le dialogue et la FAQ l’indiquent. Le parcours d’authentification et de dépôt Wallet n’a pas été revalidé de bout en bout dans cette tâche. La landing présente la méthode et des simulations, sans performance historique, témoignage ou couverture de marché inventés. L’aperçu reste local à `http://127.0.0.1:4103/`.

Suivi : plan dédié clôturé avec ces preuves ; aucun état de slice concurrente modifié. Aucun candidat mémoire métier nouveau. Un audit anonyme réel demanderait un mandat backend distinct (identité temporaire, dépôt, confidentialité et continuité de compte) ; aucune suite produit n’a été lancée implicitement.
