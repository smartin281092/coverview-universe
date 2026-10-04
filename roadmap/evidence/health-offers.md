# Carte et demandes d’offre — 30 septembre 2026

Mandat : [plan](../plans/health-offers.plan.md). Session Codex GPT-6 ; modèle précis/effort non exposés par la télémétrie de cette reprise, aucun réglage prétendu. Audits indépendants en lecture seule ; un seul propriétaire des mutations. Aucun commit global, déploiement ou reset du workspace préexistant.

## Vérifié

- Carte : popup au-dessus avec pointeur inférieur ; ouverture réelle d’un modèle puis CTA d’offre ; disparition à la sortie ; zoom 1 → 1,35 et déplacement constaté sur la transformation SVG. Vue 390 × 844 sans débordement horizontal, contrôles 44 px, dropdowns du design system.
- Guide : clic sur une réponse fait passer de la question 1 à la question 2. Icône question centrée. Recherche de localité dans le formulaire sans soumission involontaire.
- Navigateur : email de fixture sur un **serveur local distinct avec fournisseur désactivé**, saisie Test Parcours, commune 1003 Lausanne, modèle Atupri HMO, franchise 2 500, accident inclus ; prix officiel recalculé **456,00 CHF/mois**, panier, récapitulatif, soumission persistante puis suivi après actualisation. Demande locale `inq_1736c6c8-974f-4b0d-bc52-01408990ed0b`. Aucun email externe ni transmission à un assureur. Lottie SVG observé dans le suivi bureau/mobile.
- PostgreSQL isolé : 9 tests demande/HTTP, 5 tests fournisseur WorkOS (14 au total). Isolation invité, cookie/Host/origine/CSRF, clé de commande, prix serveur, écritures concurrentes, rejeu, OTP réservé/tentatives, limite par email, propriétaire révoqué, création atomique de deux dossiers familiaux, MFA/permission Admin, ordre des transitions, récupération vérifiée, transfert réel de chacun des dossiers et masquage des données de l’autre personne dans les reçus.
- Types API/Wallet/Admin ; Astro : 73 fichiers, zéro erreur/avertissement. Builds API, Wallet, Admin et www (45 pages). Lint ciblé et formatage TypeScript/CSS/JSON ; Prettier ne dispose pas de parseur Astro dans le projet, les deux pages sont vérifiées par Astro.
- Frontières : zéro erreur de dependency-cruiser. Knip conserve quatre fichiers www inutilisés préexistants ; trois avertissements d’orphelins préexistants. Scanner de bundles : 93 fichiers sans configuration serveur.
- Migrations 0021, 0022, 0023 générées et appliquées localement ; suite sur PostgreSQL neuf passée. Les migrations de correctif retirent l’unicité trop large du brouillon navigateur, sans supprimer ses données.
- Entrée « Demandes d’assurance » et route Admin accessibles dans le navigateur ; la protection exige une connexion réelle. Liste et mutations autorisées exercées au niveau PostgreSQL avec sessions/permissions isolées, pas avec un administrateur WorkOS humain dans le navigateur.

## Fait, vérification externe restante

- Magic Auth utilise le SDK WorkOS et la validation canonique des sessions/JWT. Création non vérifiée après choix Wallet et demande explicite du code, OTP, rattachement et redirection Wallet implémentés. **Réception d’un OTP réel et parcours complet avec une session WorkOS réelle non exécutés** ; aucun compte fictif créé chez le fournisseur pour la recette.
- Pointer Events : déplacement tactile, pinch à deux pointeurs, persistance du popup après levée du doigt, fermeture au tap extérieur. Largeur mobile vérifiée ; geste sur matériel tactile physique non exécuté par l’outil disponible.
- Admin : tableau filtrable/paginé, détail, transitions et historique ; Wallet : liste/détail par profil, informations associées et suivi animé. Le traitement effectif par une caisse reste une action de l’équipe, sans automatisation ni simulation d’envoi.

## Dépendance et limites

`lottie-web` ajouté à UI : rendu demandé de JSON vectoriel original, player **light** chargé à la demande, sans moteur d’expressions ; arrêt/démontage propre, image SVG statique de secours, préférence de mouvement réduit. Licence MIT, projet officiel Airbnb, aucune dépendance transitive runtime nouvelle. Le build mesure le player à environ 47,43 kB gzip. Sources : [options](https://github.com/airbnb/lottie-web/wiki/loadAnimation-options), [projet/licence](https://github.com/airbnb/lottie-web).

`pnpm audit --prod` signale 8 vulnérabilités préexistantes (6 modérées, 2 hautes), dont les deux hautes de `brace-expansion` via shadcn/ts-morph ; aucune attribuée à Lottie. Pas de mise à jour massive hors périmètre. Warnings de chunks Wallet/Admin > 500 kB conservés. Node local v24.13.1 inférieur au minimum du dépôt ; commandes ci-dessus exécutées avec succès, pas de mise à niveau globale.

La vérification globale `check:www` utilise une autre automatisation navigateur ; elle n’a pas été relancée pendant cette recette CUA. Son contrat d’îlot a été étendu précisément à la route de suivi. Les autres règles éditoriales restent inchangées.

Nettoyage : la demande navigateur de fixture, son challenge et sa réservation email ont été retirés avec identifiant/adresse exacts ; serveurs temporaires 4200/4203 arrêtés. Préviews API 4100 (WorkOS activé), Wallet 4101, Admin 4102 et www 4103 disponibles. Le test local n’encombre pas la liste Admin livrée.

Suite documentée et non exécutée : [recette externe](../plans/health-offers-acceptance.plan.md).

Confirmation utilisateur : CoverView est bien la marque de Bassa Martin Partners Sàrl. Notice publique avec art. 45, données et CGV, sans case de validation. L’enrichissement initial des prestations/clubs reste **partiel**, documenté dans [health-2027](health-2027.md) ; ce chantier ne le transforme pas en inventaire exhaustif.

## Ajustement invité / Wallet

- **Vérifié** : au clic sur « Demander une offre », deux choix explicites précèdent l’email. Invité continue directement vers la personne ; Wallet demande un code de connexion/création et ne continue qu’après vérification. L’offre HMO, l’année 1990, l’accident inclus et la franchise 2 500 sont conservés. Retour entre les parcours contrôlé. Vue bureau et 390 × 844 contrôlées dans le navigateur.
- **Vérifié** : en invité, brouillon sans propriétaire, `email_verified=false`, aucune ligne challenge/réservation email et aucun appel d’authentification. Le test navigateur utilise l’API locale 4200 avec fournisseur désactivé ; la voie Wallet affiche alors honnêtement son indisponibilité et reste à l’étape d’accès.
- **Vérifié** : 16 tests passent (11 demande/HTTP sur PostgreSQL isolé, 5 WorkOS). Deux nouveaux tests couvrent le panier invité conservé lors du rattachement avec une session canonique correspondante, l’absence d’authentification par simple connaissance de l’email et le refus d’une session différente/révoquée. Les tests ajoutés sont relus dans cette même session, pas une recette humaine indépendante.
- **Vérifié** : types API/Wallet/Admin et Astro (73 fichiers, zéro diagnostic), ESLint ciblé, builds API/www (45 pages), vues roadmap à jour. Pas de dépendance ni migration supplémentaire, pas de modification des autorisations Admin ou des événements/jobs.
- **Fait, non vérifié extérieurement** : connexion/création WorkOS par OTP et réutilisation du Wallet connecté implémentées ; la réception et la saisie d’un OTP réel n’ont pas été réalisées par l’agent. La prévisualisation principale est laissée à son étape de connexion en cours.
- **Nettoyage** : serveurs temporaires 4200/4203 arrêtés, réservation de l’email de fixture retirée. Le brouillon `inq_2f22adf2-e948-4198-abd7-9519e7970a18` a changé d’adresse pendant la recette : le garde-fou d’effacement par identifiant **et** email a refusé de le supprimer ; il est conservé. Les cookies localhost sont partagés entre ports : une future recette simultanée doit aussi isoler l’hôte navigateur, pas seulement les ports. Aucun identifiant/email privé n’est reproduit ici.
